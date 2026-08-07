/* ------------------------------------------------------------------ *
 * ReUp Aim - the angle engine folded into RYN v5
 *
 * This is injected into both the OWNER and the PLAYER build. The PLAYER
 * build is obfuscated, so nothing in here may lean on a name from inside
 * the client: everything it needs comes through window.RYN, which the
 * client publishes (_myClient, _settings, _ZoomHandler, _offset), or is
 * handed in by the call sites.
 *
 * What it is for:
 *
 *   - The client aims with atan2(mouse - screen centre). That is only the
 *     direction of the cursor while the player is at the centre of the
 *     screen, and the camera lerps toward the player rather than sitting
 *     on it, so the moment you move, it is not. Rebuilt here from the
 *     camera the frame was drawn with.
 *   - The facing is only resent once it is 0.3 rad - 17 degrees - away
 *     from what the server has. Made adaptive.
 *   - Autobreak sweeps 72 angles for the facing that hits the most
 *     things; the answer is always on the edge of some object's hit
 *     window, which a sweep only lands on by luck. Solved exactly.
 *   - Optional target lock, led for movement and arrow flight.
 *
 * Angles stay in radians. Nothing here sends a packet; the client keeps
 * doing that, including rounding to two decimals on the wire, which is
 * what the vanilla game sends and is left alone on purpose.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  /* Config.serverUpdateRate. One tick is how stale our idea of everyone
   * else's position is, before latency. */
  var TICK_MS = 1000 / 9;
  /* Weapon id -> projectile speed in units per ms, from the game's own
   * projectile table: bow 1.6, crossbow 2.5, repeater 2, musket 3.6. */
  var PROJECTILE_SPEED = { 9: 1.6, 12: 2.5, 13: 2, 15: 3.6 };
  /* Used when the client's settings object does not carry the key yet -
   * a build patched before its menu was, or a fresh profile. */
  var DEFAULTS = {
    _smartAim: true,
    _targetLock: false,
    _targetLockRange: 400,
    _smartBreakAngle: true
  };

  function bridge() {
    return typeof window !== "undefined" ? window.RYN : null;
  }

  var engine = {
    mouseX: 0,
    mouseY: 0,
    known: false,

    setting: function (name) {
      try {
        var ryn = bridge();
        var settings = ryn && ryn._settings;
        if (settings && Object.prototype.hasOwnProperty.call(settings, name)) {
          return settings[name];
        }
      } catch (error) {}
      return DEFAULTS[name];
    },

    normalize: function (angle) {
      var wrapped = angle % TAU;
      if (wrapped > Math.PI) return wrapped - TAU;
      if (wrapped < -Math.PI) return wrapped + TAU;
      return wrapped;
    },

    /* Unsigned shortest distance between two angles. */
    angleDist: function (a, b) {
      return Math.abs(this.normalize(b - a));
    },

    setMouse: function (x, y) {
      this.mouseX = x;
      this.mouseY = y;
      this.known = true;
    },

    /* The cursor in world coordinates, rebuilt from the camera and zoom
     * the frame was actually drawn with. RYN._offset is the top-left
     * corner of the view, so the camera is that plus half a viewport,
     * and one CSS pixel is 1/scale world units.
     *
     * Null means the camera is not up yet, which is the caller's cue to
     * leave the vanilla behaviour alone. */
    worldMouse: function () {
      if (!this.known) return null;
      try {
        var ryn = bridge();
        if (!ryn || !ryn._offset || !ryn._ZoomHandler) return null;
        var smooth = ryn._ZoomHandler._scale._smooth;
        var viewW = Number(smooth._w);
        var viewH = Number(smooth._h);
        if (!(viewW > 0) || !(viewH > 0)) return null;
        var scale = Math.max(window.innerWidth / viewW, window.innerHeight / viewH);
        if (!(scale > 0)) return null;
        var offset = ryn._offset;
        if (offset.x === 0 && offset.y === 0) return null;
        var camX = offset.x + viewW / 2;
        var camY = offset.y + viewH / 2;
        return {
          x: camX + (this.mouseX - window.innerWidth / 2) / scale,
          y: camY + (this.mouseY - window.innerHeight / 2) / scale,
          camX: camX,
          camY: camY
        };
      } catch (error) {
        return null;
      }
    },

    /* Angle from where the player actually is to the point under the
     * cursor - the angle they mean, rather than the one the centre of
     * the screen happens to describe. */
    cursorAngle: function (client) {
      try {
        var myPlayer = client && client.myPlayer;
        if (!myPlayer || !myPlayer.inGame) return null;
        var world = this.worldMouse();
        if (world === null) return null;
        var pos = myPlayer.pos.current;
        /* The camera trails the player by a few pixels. Much more than
         * that and it is following something else - spectate, ghost - or
         * has gone stale, and correcting against it would be worse than
         * not correcting at all. */
        if (Math.hypot(world.camX - pos.x, world.camY - pos.y) > 400) return null;
        var dx = world.x - pos.x;
        var dy = world.y - pos.y;
        if (dx * dx + dy * dy < 4) return null;
        return Math.atan2(dy, dx);
      } catch (error) {
        return null;
      }
    },

    /* Where to point so the hit lands on a moving target: their position
     * advanced by the time our command needs to reach the server, plus
     * flight time when the weapon throws something. `speed` on an entity
     * is the distance it covered over the last server tick. */
    leadAngle: function (client, target) {
      try {
        var myPlayer = client.myPlayer;
        var from = myPlayer.pos.current;
        var to = target.pos.current;
        var packets = client.PacketManager;
        var ping = (packets && packets.pong) || 0;
        var speed = target.speed || 0;
        var moveDir = target.move_dir || 0;
        var vx = Math.cos(moveDir) * speed;
        var vy = Math.sin(moveDir) * speed;
        var ticks = (ping / 2 + TICK_MS) / TICK_MS;
        var weaponID = myPlayer.weapon && myPlayer.weapon.current;
        var projectileSpeed = PROJECTILE_SPEED[weaponID];
        if (projectileSpeed > 0) {
          for (var i = 0; i < 2; i++) {
            var flight = Math.hypot(to.x + vx * ticks - from.x, to.y + vy * ticks - from.y) / projectileSpeed;
            ticks = (ping / 2 + TICK_MS + flight) / TICK_MS;
          }
        }
        /* Four ticks is the ceiling, so a sprinting target on a bad ping
         * cannot swing the aim off them entirely. */
        ticks = Math.max(0, Math.min(4, ticks));
        return Math.atan2(to.y + vy * ticks - from.y, to.x + vx * ticks - from.x);
      } catch (error) {
        return null;
      }
    },

    /* Nearest enemy, weighted toward the one the cursor is already
     * pointing at, so the lock sharpens the choice instead of taking it
     * away. Null when nobody is in range. */
    pickTarget: function (client) {
      try {
        var myPlayer = client && client.myPlayer;
        var playerManager = client && client.PlayerManager;
        if (!myPlayer || !myPlayer.inGame || !playerManager || !playerManager.enemies) return null;
        var from = myPlayer.pos.current;
        var range = Number(this.setting("_targetLockRange")) || 400;
        var cursor = this.cursorAngle(client);
        var best = null;
        var bestScore = -Infinity;
        for (var i = 0; i < playerManager.enemies.length; i++) {
          var enemy = playerManager.enemies[i];
          if (!enemy || enemy === myPlayer || !enemy.pos) continue;
          var dx = enemy.pos.current.x - from.x;
          var dy = enemy.pos.current.y - from.y;
          var distance = Math.hypot(dx, dy);
          if (distance > range) continue;
          var score = 1 - distance / range;
          if (cursor !== null) {
            score += 1.5 * (1 - this.angleDist(cursor, Math.atan2(dy, dx)) / Math.PI);
          }
          if (score > bestScore) {
            bestScore = score;
            best = enemy;
          }
        }
        return best;
      } catch (error) {
        return null;
      }
    },

    /* The angle the owner should be facing, or null to leave the facing
     * to whatever else decided it. */
    resolve: function (client) {
      if (this.setting("_targetLock")) {
        var target = this.pickTarget(client);
        if (target !== null) {
          var led = this.leadAngle(client, target);
          if (led !== null) return led;
        }
      }
      if (this.setting("_smartAim")) return this.cursorAngle(client);
      return null;
    },

    /* ---------------------------------------------------------------- *
     * Entry points the patched client calls into
     * ---------------------------------------------------------------- */

    /* End of InputHandler.handleMouseMove. The original body has already
     * run, so this only has to correct what it decided. */
    onMouseMove: function (input, event) {
      try {
        var x = event.clientX;
        var y = event.clientY;
        /* Track the cursor whether or not the player is following it, so
         * locking rotation stops freezing the coordinates the movement
         * and placement code reads. */
        input.mouse.x = x;
        input.mouse.y = y;
        var client = input.client;
        if (!client || !client.isOwner) return;
        this.setMouse(x, y);
        if (!input.rotation || !this.setting("_smartAim")) return;
        var angle = this.cursorAngle(client);
        if (angle !== null) client._ModuleHandler._currentAngle = angle;
      } catch (error) {}
    },

    /* Start of InputHandler.cursorPosition. The stock version places the
     * cursor relative to the player, which assumes the player is at the
     * centre of the screen, and reads the target zoom rather than the
     * smoothed one the frame was drawn at. */
    cursorWorld: function (input) {
      try {
        var client = input && input.client;
        if (!client || !client.isOwner || !this.setting("_smartAim")) return null;
        var world = this.worldMouse();
        if (world === null) return null;
        var ryn = bridge();
        var Vector = ryn && ryn._offset && ryn._offset.constructor;
        if (typeof Vector !== "function") return null;
        return new Vector(world.x, world.y);
      } catch (error) {
        return null;
      }
    },

    /* Top of ModuleHandler.postTick, before the modules run. The cursor
     * keeps pointing at the same place on the screen while the player and
     * the camera move under it, so the angle it describes is only still
     * true if it is recomputed - a mousemove is not the only thing that
     * changes it. Modules run after this and can still take the facing
     * for whatever they are doing. */
    tickAim: function (moduleHandler) {
      try {
        var client = moduleHandler && moduleHandler.client;
        if (!client || !client.isOwner) return;
        var input = client.InputHandler;
        if (!input || !input.rotation) return;
        var aim = this.resolve(client);
        if (aim !== null) moduleHandler._currentAngle = aim;
      } catch (error) {}
    },

    /* How far the server's idea of our facing may drift before it is
     * corrected. The stock 0.3 rad is 17 degrees given away on every hit
     * and every placement, and none of that slack buys anything when
     * there is packet budget to spare. The sender already drops repeats
     * of the same wire angle, so the tight figure costs at most one
     * packet a tick. */
    angleThreshold: function (moduleHandler) {
      try {
        if (!this.setting("_smartAim")) return 0.3;
        var count = moduleHandler && moduleHandler.packetCount;
        var limit = moduleHandler && moduleHandler.packetLimit;
        /* If the budget cannot be read, assume there is none to spend. */
        if (typeof count !== "number" || typeof limit !== "number") return 0.3;
        if (count + 12 > limit) return 0.3;
        var enemyManager = moduleHandler.client && moduleHandler.client.EnemyManager;
        return enemyManager && enemyManager.nearestEnemy ? 0.02 : 0.12;
      } catch (error) {
        return 0.3;
      }
    },

    /* UpdateAttack.getAttackAngle. The swing is sent later in the tick
     * than the facing was chosen, so with the lock on, the lead is
     * recomputed here against the target's newest position. */
    attackAngle: function (client, fallback) {
      try {
        if (!client || !client.isOwner || !this.setting("_targetLock")) return fallback;
        var target = this.pickTarget(client);
        if (target === null) return fallback;
        var led = this.leadAngle(client, target);
        return led === null ? fallback : led;
      } catch (error) {
        return fallback;
      }
    },

    /* Autobreak's search for the facing that hits the most objects. A
     * facing either covers an object or it does not, and it stops
     * covering it exactly on the edge of that object's window, so the
     * best facing always sits on one of those edges. Offering both sides
     * of every edge covers every distinct outcome - dodging an object is
     * worth points too - and with a handful of objects in range it is
     * less work than the 72 angle sweep it replaces. */
    breakCandidates: function (from, seed, gatherAngle, target, nearestEnemy, hittable, nonHittable, inRange) {
      var out = [];
      if (!this.setting("_smartBreakAngle")) {
        for (var g = 0; g < 72; g++) out.push((g / 72) * TAU);
        return out;
      }
      out.push(seed);
      var nudge = 1e-4;
      var self = this;
      var add = function (object, cone) {
        try {
          if (!object || !object.pos || !inRange(object)) return;
          var angle = Math.atan2(object.pos.current.y - from.y, object.pos.current.x - from.x);
          out.push(angle, angle + cone - nudge, angle - cone + nudge, angle + cone + nudge, angle - cone - nudge);
        } catch (error) {}
      };
      add(target, gatherAngle / 2);
      add(nearestEnemy, gatherAngle);
      var i;
      if (hittable) for (i = 0; i < hittable.length; i++) add(hittable[i], gatherAngle);
      if (nonHittable) for (i = 0; i < nonHittable.length; i++) add(nonHittable[i], gatherAngle);
      return out;
    }
  };

  if (typeof window !== "undefined") window.__ReUpAim = engine;
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
})();
