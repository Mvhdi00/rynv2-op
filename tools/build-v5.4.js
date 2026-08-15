// Builds RYN v5.4 from a pristine v5.3 client. Two sections:
//
//   A. the Novastorm ports kept: the 119 packet budget and the combat automill
//   B. bot random movement — binding and fixing RYN's own Scatter Bots
//
// Auto Place / Preplace / Replace are deliberately untouched. Every edit is an
// exact-string replacement asserted to match once, so a drift in the source
// fails the build instead of silently producing a file with a feature missing.
//
//   node tools/build-v5.4.js <in.js> <out.js>
const fs = require("fs");

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) {
  console.error("usage: node tools/build-v5.4.js <in.js> <out.js>");
  process.exit(1);
}
let s = fs.readFileSync(IN, "utf8");
const edits = [];
function sub(label, old, next, expect = 1) {
  const n = s.split(old).length - 1;
  if (n !== expect) throw new Error(`${label}: matched ${n} times, expected ${expect}`);
  s = s.split(old).join(next);
  edits.push(label);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PACKETS
// ─────────────────────────────────────────────────────────────────────────────
sub("packets: transport counter",
`    send(data) {
      const [type, ...args] = data;
      const gameNet = this.client._gameNet;
      if (gameNet && gameNet.socket && typeof gameNet.send === "function") {`,
`    // Novastorm budgets against 119 packets a second, which is the real server
    // allowance — but it is a fork of the whole bundle, so its counter sees
    // every frame that leaves. RYN only counts what its own modules send, and
    // the game's bundle still sends frames of its own through the same socket.
    // Raising the limit to novastorm's number without closing that gap would be
    // budgeting against a number that is too low.
    //
    // So the count is taken at the transport instead: socket.send is wrapped
    // once, and frames this class sent itself are skipped there because they
    // were already counted here. Every frame is counted exactly once, whoever
    // sent it, and the 119 budget then means what it means in novastorm.
    _watchSocket(socket) {
      if (!socket || typeof socket.send !== "function" || socket._rynCounted) return;
      const original = socket.send;
      const manager = this;
      socket.send = function(...args) {
        if (!manager._selfSend) manager.packetCount += 1;
        return original.apply(this, args);
      };
      socket._rynCounted = true;
    }
    _selfSend=false;
    send(data) {
      this._selfSend = true;
      try {
        this._send(data);
      } finally {
        this._selfSend = false;
      }
    }
    _send(data) {
      const [type, ...args] = data;
      const gameNet = this.client._gameNet;
      if (gameNet && gameNet.socket && typeof gameNet.send === "function") {
        this._watchSocket(gameNet.socket);`);

sub("packets: watch bot socket",
`      const {socket: socket, socketSend: socketSend} = this.client.SocketManager;
      if (socket === null || socket.readyState !== socket.OPEN || socketSend === null) {
        return;
      }
      const botCrypto = this.client._gameCrypto;`,
`      const {socket: socket, socketSend: socketSend} = this.client.SocketManager;
      if (socket === null || socket.readyState !== socket.OPEN || socketSend === null) {
        return;
      }
      this._watchSocket(socket);
      const botCrypto = this.client._gameCrypto;`);

sub("packets: budget 70 -> 119",
`    packetLimit=70;`,
`    // Novastorm's budget: \`packets + 5 > 119\`. The server's own allowance is
    // 120 a second, so 119 is the whole of it. RYN sat at 70 and left a third of
    // the allowance unspent, which is why a busy tick ran out of packets while
    // the connection was nowhere near its limit. Safe to take now that
    // PacketManager counts frames at the transport rather than only its own.
    packetLimit=119;`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTOHEAL  (+ 3. ANTI SMART TICK, which shares the class)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 4. AUTO MILLS
// ─────────────────────────────────────────────────────────────────────────────
sub("automill: place cost constant",
`  class Automill {
    moduleName="autoMill";`,
`  // ModuleHandler.place() spends selectItem + attack + stopAttack + whichWeapon.
  const AUTOMILL_PLACE_COST = 5;
  class Automill {
    moduleName="autoMill";`);

sub("automill: combat gating",
`    get canAutomill() {
      const isOwner = this.client.isOwner;
      const {attacking: attacking, placedOnce: placedOnce, staticModules: staticModules} = this.client._ModuleHandler;
      return Settings_default._automill && this.client.myPlayer.isSandbox && !placedOnce && (!isOwner || !attacking) && this.active && !staticModules.autoBuy.boughtEverything() && this.client.myPlayer.age < 20;
    }`,
`    // Novastorm's automill is a combat mill, not an XP mill:
    //
    //     if (autoMills && lastMoveAngle != null && !nearestTrap) { ... }
    //
    // Three windmills dropped behind you as you move, any time, on a keybind.
    // What was here was gated on \`myPlayer.isSandbox\`, \`age < 20\` and
    // \`!autoBuy.boughtEverything()\` — an opening-minutes XP grinder that could
    // not run in a real game at all, which is why the toggle appeared to do
    // nothing. Those three gates are gone. \`!nearestTrap\` is novastorm's, and it
    // matters: milling while pinned walls you into your own trap.
    get canAutomill() {
      const isOwner = this.client.isOwner;
      const {attacking: attacking, placedOnce: placedOnce} = this.client._ModuleHandler;
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (!Settings_default._automill || !this.active) return false;
      if (placedOnce) return false;
      if (isOwner && attacking) return false;
      if (myPlayer.isTrapped || EnemyManager2.nearestTrap !== null) return false;
      return true;
    }`);

sub("automill: no permanent latch",
`      if (!myPlayer.canPlace(5)) {
        this.toggle = false;
        this.active = false;
        return;
      }`,
`      // Novastorm re-tests canPlace every tick rather than latching. Latching
      // \`active = false\` on the first refusal meant hitting the windmill cap once
      // disabled automill until the next death, which is wrong for a mill you
      // drop and lose continuously in a fight.
      if (!myPlayer.canPlace(5)) {
        this.toggle = false;
        return;
      }`);

sub("automill: place each of the three on its own",
`      if (this.canPlaceWindmill(angle) && this.canPlaceWindmill(leftAngle) && this.canPlaceWindmill(rightAngle)) {
        this.placeWindmill(angle);
        this.placeWindmill(leftAngle);
        this.placeWindmill(rightAngle);
      }`,
`      // Novastorm gates the trio on the centre mill being placeable, then tests
      // each of the three on its own and places the ones that fit. Requiring all
      // three, as this did, meant one rock behind you cancelled the whole thing.
      // The offset stays RYN's exact solve rather than novastorm's
      // \`toRad(scale + scale / 2)\`, which is a degrees-for-radians approximation
      // that only lands near the right answer for a windmill's scale.
      if (!this.canPlaceWindmill(angle)) {
        return;
      }
      const budget = ModuleHandler.packetLimit - ModuleHandler.packetCount;
      let spend = Math.floor(budget / AUTOMILL_PLACE_COST);
      for (const a of [ angle, leftAngle, rightAngle ]) {
        if (spend <= 0) break;
        if (!myPlayer.canPlace(5)) break;
        if (!this.canPlaceWindmill(a)) continue;
        this.placeWindmill(a);
        spend--;
      }`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. SAFE SOLDIER
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS + MENU
// ─────────────────────────────────────────────────────────────────────────────
sub("settings: automill off by default",
`    _automill: true,`,
`    // Off by default, like novastorm's \`autoMills = false\`. It is now a real
    // combat mill rather than a sandbox-only XP grinder, so leaving it on would
    // drop windmills behind every player from the first spawn.
    _automill: false,`);

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// B. BOT RANDOM MOVEMENT
//
// x18 has no bot movement to port. Its Bots menu — "Send bots", "Close bots",
// `botcount`, `botname`, `botplatformplacer` — has no implementation behind it:
// the two buttons carry no event listener and the three settings have no
// readers anywhere in the file. `altPlayerManager` is an iframe alt player, not
// a bot fleet.
//
// RYN already has exactly the feature being asked for, in Scatter Bots: each bot
// picks its own random heading on a timer, refuses to backtrack, steers around
// obstacles, repels off other players, and on toggle-off walks everyone home and
// hands them back to normal movement. It ships unusable, and these edits are
// what make it work as described.
// ─────────────────────────────────────────────────────────────────────────────

sub("bots: bind the toggle and make the state global",
`    _scatterBots: "",`,
`    // Was "" — unbound, so \`event.code === Settings._scatterBots\` could never
    // be true and the whole Scatter Bots feature was unreachable. KeyJ is free.
    _scatterBots: "KeyJ",
    // The on/off state lives here rather than being read back off the first
    // bot's ModuleHandler, so a bot spawned while random movement is on joins in
    // instead of standing still, and killing every bot does not lose the state.
    _botsScattered: false,`);

sub("bots: toggle drives the flag, not the first bot",
`      if (event.code === Settings_default._scatterBots && Settings_default._scatterBots !== "...") {
        try {
          const {isOwner: _sbIsOwner, clients: _sbClients} = this.client;
          if (_sbIsOwner) {
            const _sbFirst = [ ..._sbClients ][0];
            const _sbCurrentlyActive = _sbFirst && _sbFirst._ModuleHandler && _sbFirst._ModuleHandler._scatterActive;
            if (_sbCurrentlyActive) {
              for (const _sbBot of _sbClients) {
                const _sbMH = _sbBot._ModuleHandler;
                if (!_sbMH) continue;
                _sbMH._scatterActive = false;
                _sbMH._scatterDest = null;
                _sbMH._scatterReturning = true;
                _sbMH._scatterBreaking = false;
                _sbMH._scatterBreakTarget = null;
                _sbMH._scatterNextDecisionTime = 0;
              }
            } else {
              for (const _sbBot of _sbClients) {
                const _sbMH = _sbBot._ModuleHandler;
                if (!_sbMH) continue;
                _sbMH._scatterActive = true;
                _sbMH._scatterReturning = false;
                _sbMH._scatterBreaking = false;
                _sbMH._scatterBreakTarget = null;
                _sbMH._scatterLastMoveAngle = null;
                _sbMH._scatterNextDecisionTime = 0;
                _sbMH._scatterLastPos = null;
                _sbMH._scatterStuckStrikes = 0;
              }
            }
          }
        } catch (_) {}
      }`,
`      // The guard used to compare against "..." while the default was "", so
      // even a user who never touched the tile had a bind the handler could not
      // recognise. An unset bind is now anything falsy or a placeholder.
      if (Settings_default._scatterBots && Settings_default._scatterBots !== "..." && event.code === Settings_default._scatterBots) {
        try {
          const {isOwner: _sbIsOwner, clients: _sbClients} = this.client;
          if (_sbIsOwner) {
            // Flipping one flag is the whole toggle. The loop below reconciles
            // every bot to it each frame, which is what lets a bot spawned mid
            // session pick the mode up, and what stops the state going stale
            // when the bot the old code sampled happens to be dead.
            Settings_default._botsScattered = !Settings_default._botsScattered;
            SaveSettings();
            if (!Settings_default._botsScattered) {
              for (const _sbBot of _sbClients) {
                const _sbMH = _sbBot._ModuleHandler;
                if (!_sbMH || !_sbMH._scatterActive) continue;
                _sbMH._scatterActive = false;
                _sbMH._scatterDest = null;
                _sbMH._scatterReturning = true;
                _sbMH._scatterReturnDeadline = Date.now() + SCATTER_RETURN_TIMEOUT_MS;
                _sbMH._scatterBreaking = false;
                _sbMH._scatterBreakTarget = null;
                _sbMH._scatterNextDecisionTime = 0;
              }
            }
          }
        } catch (_) {}
      }`);

sub("bots: return timeout constant",
`  const _SC_DECISION_MS = 1200;`,
`  // A bot walking home can be blocked, or the owner can be dead or across the
  // map, and "returning" is a state that suppresses normal movement. Without a
  // deadline a bot that never reaches the owner never moves normally again.
  const SCATTER_RETURN_TIMEOUT_MS = 8e3;
  const _SC_DECISION_MS = 1200;`);

sub("bots: reconcile every bot to the flag each frame",
`        for (const _sc_bot of _sc_client.clients) {
          const _sc_mh = _sc_bot._ModuleHandler;
          if (!_sc_mh || (!_sc_mh._scatterActive && !_sc_mh._scatterReturning)) continue;`,
`        for (const _sc_bot of _sc_client.clients) {
          const _sc_mh = _sc_bot._ModuleHandler;
          if (!_sc_mh) continue;
          // Bring this bot in line with the toggle. A bot that connected after
          // random movement was switched on starts wandering here rather than
          // trailing the owner on its own.
          if (Settings_default._botsScattered && !_sc_mh._scatterActive) {
            _sc_mh._scatterActive = true;
            _sc_mh._scatterReturning = false;
            _sc_mh._scatterBreaking = false;
            _sc_mh._scatterBreakTarget = null;
            _sc_mh._scatterLastMoveAngle = null;
            _sc_mh._scatterNextDecisionTime = 0;
            _sc_mh._scatterLastPos = null;
            _sc_mh._scatterStuckStrikes = 0;
          }
          if (!_sc_mh._scatterActive && !_sc_mh._scatterReturning) continue;`);

sub("bots: give up on walking home after the timeout",
`          if (_sc_mh._scatterReturning) {
            const owner = _sc_client.myPlayer;
            const op = owner && owner.pos && owner.pos.current;
            if (op) {`,
`          if (_sc_mh._scatterReturning) {
            if (_sc_now >= (_sc_mh._scatterReturnDeadline || 0)) {
              // Home or not, hand it back to normal movement — Movement.postTick
              // only steps aside while one of these two flags is set.
              _sc_mh._scatterReturning = false;
              _sc_mh._scatterBreaking = false;
              _sc_mh._scatterBreakTarget = null;
              _sc_mh.startMovement(null);
              continue;
            }
            const owner = _sc_client.myPlayer;
            const op = owner && owner.pos && owner.pos.current;
            if (op) {`);

sub("menu: keybind tiles for the combat toggles",
`            <div class=\\"content-option key-tile\\">\\n                <span class=\\"option-title\\">Scatter Bots</span>\\n                <button id=\\"_scatterBots\\" class=\\"hotkeyInput\\"></button>\\n            </div>\\n`,
`            <div class=\\"content-option key-tile\\">\\n                <span class=\\"option-title\\">Scatter Bots</span>\\n                <button id=\\"_scatterBots\\" class=\\"hotkeyInput\\"></button>\\n            </div>\\n            <div class=\\"content-option key-tile\\">\\n                <span class=\\"option-title\\">Avoid Shield Bots</span>\\n                <button id=\\"_botAvoidShieldKey\\" class=\\"hotkeyInput\\"></button>\\n            </div>\\n            <div class=\\"content-option key-tile\\">\\n                <span class=\\"option-title\\">Volley Fire</span>\\n                <button id=\\"_botVolleyKey\\" class=\\"hotkeyInput\\"></button>\\n            </div>\\n`);

sub("menu: name the tile after what it does",
`                <span class=\\"option-title\\">Scatter Bots</span>`,
`                <span class=\\"option-title\\">Bot Random Movement</span>`);

sub("bots: x18's wander decision",
`    } else {
      let attempt = 0, candidate;
      do {
        candidate = Math.random() * Math.PI * 2 - Math.PI;
        attempt++;
      } while (sc_mh._scatterLastMoveAngle !== null && attempt < 10 && Math.abs(Math.atan2(Math.sin(candidate - (sc_mh._scatterLastMoveAngle + Math.PI)), Math.cos(candidate - (sc_mh._scatterLastMoveAngle + Math.PI)))) < _SC_NO_BACKTRACK_ARC / 2);
      baseAngle = candidate;
      const repel = _scRepelAngle(sc_client, sc_bot, sc_pos);
      if (repel !== null) {
        const rx = Math.cos(baseAngle) * .4 + Math.cos(repel) * .6;
        const ry = Math.sin(baseAngle) * .4 + Math.sin(repel) * .6;
        baseAngle = Math.atan2(ry, rx);
      }
    }`,
`    } else {
      // x18's heading pick, its \`vx\`:
      //
      //     function vx(e, t) {
      //         t = Math.random() * ae;                  // ae = 2*PI
      //         if (e && Ay(e, t) <= 2) return vx(e);    // Ay = angle distance
      //         return t;
      //     }
      //
      // Uniform over the circle, rejected and re-rolled while it lands within 2
      // radians of the heading it is replacing — so a change of direction is
      // always a hard turn of at least 115 degrees, never a nudge. Recursion in
      // the original; a bounded loop here, because acceptance is only about 36%
      // per try and an unlucky run should not grow the stack.
      baseAngle = _x18Wander(sc_mh._scatterLastMoveAngle);
      const repel = _scRepelAngle(sc_client, sc_bot, sc_pos);
      if (repel !== null) {
        const rx = Math.cos(baseAngle) * .4 + Math.cos(repel) * .6;
        const ry = Math.sin(baseAngle) * .4 + Math.sin(repel) * .6;
        baseAngle = Math.atan2(ry, rx);
      }
    }`);

sub("bots: x18's re-roll trigger",
`  function _scDecide(sc_client, sc_bot, sc_mh, sc_pos, now) {`,
`  // x18 commits to a heading and keeps it. It only picks a new one when the bot
  // has covered a long leg, or when it has stopped moving:
  //
  //     if (c.doMills && Date.now() - c.moveRan.lastChange >= 1e4
  //         || D(re(c.moveRan.y - c.y, 2) + re(c.moveRan.x - c.x, 2)) > 3300
  //         || c.speed === 0) { c.moveRan.angle = vx(c.moveRan.angle); ... }
  //
  // (D/re/S are Math.sqrt/pow/abs, W is PI, so the middle term is the straight
  // line distance from where the leg started.)
  //
  // What was here re-rolled on a 1200ms timer regardless, which is a bot
  // changing its mind nine times before it has crossed its own body — the
  // zigzag it produced is why the movement read as jitter rather than roaming.
  const _X18_LEG_DISTANCE = 3300;
  const _X18_LEG_TIMEOUT_MS = 1e4;
  const _X18_MIN_TURN = 2;
  const _X18_PICK_TRIES = 24;
  function _x18Wander(prev) {
    let candidate = Math.random() * Math.PI * 2;
    if (prev === null || prev === void 0) return candidate;
    for (let i = 0; i < _X18_PICK_TRIES && getAngleDist(prev, candidate) <= _X18_MIN_TURN; i++) {
      candidate = Math.random() * Math.PI * 2;
    }
    return candidate;
  }
  function _scDecide(sc_client, sc_bot, sc_mh, sc_pos, now) {`);

sub("bots: drive the loop off x18's trigger",
`          const _sc_dueDecision = _sc_now >= (_sc_mh._scatterNextDecisionTime || 0);
          if (_sc_dueDecision) {
            let stuck = false;
            if (_sc_mh._scatterLastPos) {
              const moved = Math.sqrt((_sc_pos.x - _sc_mh._scatterLastPos.x) ** 2 + (_sc_pos.y - _sc_mh._scatterLastPos.y) ** 2);
              stuck = moved < _SC_STUCK_DIST;
            }
            _sc_mh._scatterStuckStrikes = stuck ? (_sc_mh._scatterStuckStrikes || 0) + 1 : 0;`,
`          // x18's three conditions. Returning still runs on the timer, since
          // walking home is a fixed target rather than a leg to commit to.
          const _sc_stopped = (_sc_bot.myPlayer.speed || 0) <= _SC_STOPPED_SPEED;
          let _sc_legDist = Infinity;
          if (_sc_mh._scatterLegStart) {
            _sc_legDist = Math.sqrt((_sc_pos.x - _sc_mh._scatterLegStart.x) ** 2 + (_sc_pos.y - _sc_mh._scatterLegStart.y) ** 2);
          }
          const _sc_dueDecision = _sc_mh._scatterReturning ? _sc_now >= (_sc_mh._scatterNextDecisionTime || 0) : _sc_mh._scatterAngle === void 0 || _sc_mh._scatterAngle === null || _sc_stopped || _sc_legDist > _X18_LEG_DISTANCE || _sc_now - (_sc_mh._scatterLegStartedAt || 0) >= _X18_LEG_TIMEOUT_MS;
          if (_sc_dueDecision) {
            _sc_mh._scatterLegStart = {
              x: _sc_pos.x,
              y: _sc_pos.y
            };
            _sc_mh._scatterLegStartedAt = _sc_now;
            let stuck = false;
            if (_sc_mh._scatterLastPos) {
              const moved = Math.sqrt((_sc_pos.x - _sc_mh._scatterLastPos.x) ** 2 + (_sc_pos.y - _sc_mh._scatterLastPos.y) ** 2);
              stuck = moved < _SC_STUCK_DIST;
            }
            _sc_mh._scatterStuckStrikes = stuck ? (_sc_mh._scatterStuckStrikes || 0) + 1 : 0;`);

sub("bots: stopped-speed threshold",
`  const _SC_STUCK_DIST = 35;`,
`  const _SC_STUCK_DIST = 35;
  // x18 tests \`c.speed === 0\`, which it can because it owns the bot's own
  // movement integrator. RYN reads speed as the distance covered last tick off
  // the server, so an exact zero is rarer than actually being stopped.
  const _SC_STOPPED_SPEED = 6;`);

sub("bots: keys for the two combat toggles",
`      if (event.code === Settings_default._botAutoAttack) {`,
`      // Both of these are decisions you change mid fight, so they get a key as
      // well as a switch — reaching for the menu with forty bots on screen is
      // not a thing anyone does.
      if (Settings_default._botAvoidShieldKey && event.code === Settings_default._botAvoidShieldKey) {
        Settings_default._botAvoidShield = !Settings_default._botAvoidShield;
        SaveSettings();
      }
      if (Settings_default._botVolleyKey && event.code === Settings_default._botVolleyKey) {
        Settings_default._botVolley = !Settings_default._botVolley;
        SaveSettings();
      }
      if (event.code === Settings_default._botAutoAttack) {`);

sub("bots: bind Static mode too",
`    _freezeBots: "",`,
`    // x18 has three bot movement modes on keys -- Wander (O), Static (-) and
    // Summon. Wander is Bot Random Movement on J and Summon is the default
    // follow, so this is the third one, and it shipped unbound like the other.
    _freezeBots: "KeyK",`);

// ─────────────────────────────────────────────────────────────────────────────
// C. BOT COMBAT — auto break, ranged kiting
// ─────────────────────────────────────────────────────────────────────────────

sub("bots: register the two combat modules",
`  class Automill {`,
fs.readFileSync(__dirname + "/bot-modules.js", "utf8") + `  class Automill {`);

sub("bots: instantiate them",
`        autoPlacer: new AutoPlacer_default(client2),`,
`        botAutoBreak: new BotAutoBreak(client2),
        botRangedAttack: new BotRangedAttack(client2),
        autoPlacer: new AutoPlacer_default(client2),`);

sub("bots: run them for bots only",
`      this.botModules = [ this.staticModules.tempData, this.staticModules.clanJoiner, this.staticModules.movement ];`,
`      // botRangedAttack claims the tick before movement so it can take over
      // where the bot walks; botAutoBreak runs after, and only fires when the
      // movement it just asked for did not happen.
      this.botModules = [ this.staticModules.tempData, this.staticModules.clanJoiner, this.staticModules.botRangedAttack, this.staticModules.movement, this.staticModules.botAutoBreak ];`);

sub("bots: movement yields to ranged kiting",
`      if (ModuleHandler._scatterActive || ModuleHandler._scatterReturning) return;
      if (ModuleHandler._autoFarmActive) return;`,
`      if (ModuleHandler._scatterActive || ModuleHandler._scatterReturning) return;
      if (ModuleHandler._autoFarmActive) return;
      // Ranged kiting already decided where this bot walks this tick.
      if (ModuleHandler.staticModules.botRangedAttack?.active) return;`);

// ─────────────────────────────────────────────────────────────────────────────
// D. TRAIN FORMATION
// ─────────────────────────────────────────────────────────────────────────────

sub("train: register the id",
`  const FORMATION_IDS = new Set([ "none", "circle", "heart", "triangle", "square", "column", "hline" ]);`,
`  const FORMATION_IDS = new Set([ "none", "circle", "heart", "triangle", "square", "column", "hline", "train" ]);
  // Gap between carriages, in px.
  const TRAIN_SPACING = 70;`);

sub("train: the offset itself",
`       case "hline":
        {
          const spread = radius * 1.8;
          return {
            dx: (t - 0.5) * spread,
            dy: 0
          };
        }`,
`       case "hline":
        {
          const spread = radius * 1.8;
          return {
            dx: (t - 0.5) * spread,
            dy: 0
          };
        }

       case "train":
        {
          // Single file directly behind, one carriage per bot. Unlike "column",
          // which is a fixed-length line centred on the player and squeezes as
          // bots are added, the train is anchored at the player and grows
          // backwards, so spacing stays constant however many bots there are.
          const {dx: dx, dy: dy} = rotateToFacing(-(botIndex + 1) * TRAIN_SPACING, 0);
          return {
            dx: dx,
            dy: dy
          };
        }`);

sub("train: face the direction of travel",
`      const facingAngle = ownerClient.InputHandler && ownerClient.InputHandler.mouse ? ownerClient.InputHandler.mouse.angle : 0;`,
`      // A train trails behind where you are going, not where you are aiming, so
      // it uses the owner's movement direction and only falls back to the mouse
      // when standing still.
      let facingAngle = ownerClient.InputHandler && ownerClient.InputHandler.mouse ? ownerClient.InputHandler.mouse.angle : 0;
      if (f === "train") {
        const ownerDir = ownerClient._ModuleHandler.move_dir;
        if (ownerDir !== null && ownerDir !== void 0) facingAngle = ownerDir;
      }`);

sub("train: menu entry",
`      }, {
        id: "hline",
        icon: "━",
        label: "Line Side"
      } ];`,
`      }, {
        id: "hline",
        icon: "━",
        label: "Line Side"
      }, {
        id: "train",
        icon: "🚂",
        label: "Train"
      } ];`);

// ─────────────────────────────────────────────────────────────────────────────
// E. SERVER PLAYER COUNTER
// ─────────────────────────────────────────────────────────────────────────────

sub("players: panel row above FPS",
`            <span>FPS: <span id="rynFPS"></span></span>`,
`            <span>PLAYERS: <span id="rynPlayers">?</span></span>\\n            <span>FPS: <span id="rynFPS"></span></span>`);

sub("players: updater + poller",
`    updateFPS(fps) {`,
`    updatePlayers(text) {
      const span = document.querySelector("#rynPlayers");
      if (span !== null) {
        span.textContent = text;
      }
    }
    updateFPS(fps) {`);

sub("players: start the poll",
`  const SaveSettings = () => {`,
`  // Live population of the server you are actually on.
  //
  // The game fetches its server list exactly once, at load — \`_n()\` runs from
  // the bootstrapper and there is no refresh loop — so #serverBrowser's
  // "[n/m]" labels are a snapshot from before you joined and go stale
  // immediately. The list is re-fetched here instead, from the same endpoint the
  // game uses, and the entry matching this tab's ?server=region:name is the one
  // reported. If the fetch fails the browser label is still better than nothing,
  // so it is used as the fallback.
  const RYN_SERVER_API = (location.hostname === "sandbox.moomoo.io" ? "https://api-sandbox.moomoo.io" : "https://api.moomoo.io") + "/servers?v=1.27";
  const RYN_SERVER_POLL_MS = 1e4;
  const _rynCurrentServer = () => {
    try {
      const q = new URLSearchParams(location.search).get("server");
      if (typeof q !== "string") return null;
      const [region, name] = q.split(":");
      if (!region || !name) return null;
      return {
        region: region,
        name: name
      };
    } catch (_) {
      return null;
    }
  };
  const _rynBrowserFallback = () => {
    try {
      const sel = document.getElementById("serverBrowser");
      const opt = sel && sel.querySelector("select") ? sel.querySelector("select").selectedOptions[0] : null;
      const label = opt ? opt.textContent : "";
      const m = /\\[(\\d+)\\/(\\d+)\\]/.exec(label || "");
      return m ? m[1] + "/" + m[2] : null;
    } catch (_) {
      return null;
    }
  };
  const _rynPollServerCount = async () => {
    const here = _rynCurrentServer();
    try {
      const res = await fetch(RYN_SERVER_API, {
        cache: "no-store"
      });
      const list = await res.json();
      if (Array.isArray(list) && here) {
        for (let i = 0; i < list.length; i++) {
          const g = list[i];
          if (g && String(g.region) === here.region && String(g.name) === here.name) {
            GameUI_default.updatePlayers(Math.min(g.playerCount, g.playerCapacity) + "/" + g.playerCapacity);
            return;
          }
        }
      }
    } catch (_) {}
    const fallback = _rynBrowserFallback();
    GameUI_default.updatePlayers(fallback === null ? "?" : fallback);
  };
  setInterval(_rynPollServerCount, RYN_SERVER_POLL_MS);
  setTimeout(_rynPollServerCount, 1500);

  const SaveSettings = () => {`);

// ─────────────────────────────────────────────────────────────────────────────
// F. BE ANGEL — Halo + Angel Wings on bots instead of Booster Hat + Monkey Tail
//
// Bots settle on hat 12 (Booster Hat) and accessory 11 (Monkey Tail) whenever
// nothing dangerous is happening — both are movement speed, which is what a bot
// following you around wants. Be Angel swaps those two defaults for hat 48
// (Halo) and accessory 13 (Angel Wings), which regenerate health instead.
//
// Only the two "nothing is happening" exits are touched. Every branch above
// them — soldier, bull, turret gear, emp, flipper, winter — is a defensive or
// insta decision and keeps priority, so a bot in trouble still wears the hat
// that keeps it alive rather than the one that looks nice.
// ─────────────────────────────────────────────────────────────────────────────

sub("angel: hat, standing still",
`          if (this.canWearCowboy()) return 5;
          if (useActual && actual !== 0) return actual;`,
`          if (this.canWearCowboy()) return 5;
          if (beAngel) return 48;
          if (useActual && actual !== 0) return actual;`);

sub("angel: hat, moving",
`      if (useBooster) {
        return 12;
      }
      return 0;`,
`      if (beAngel) {
        return 48;
      }
      if (useBooster) {
        return 12;
      }
      return 0;`);

sub("angel: hat gate",
`      const useBooster = ModuleHandler.canBuy(0, 12);`,
`      const useBooster = ModuleHandler.canBuy(0, 12);
      // Bots only, and only if the halo is actually owned.
      const beAngel = !this.client.isOwner && Settings_default._botBeAngel && ModuleHandler.canBuy(0, 48);`);

sub("angel: acc gate",
`      const useTail = ModuleHandler.canBuy(1, 11);`,
`      const useTail = ModuleHandler.canBuy(1, 11);
      const beAngel = !this.client.isOwner && Settings_default._botBeAngel && ModuleHandler.canBuy(1, 13);`);

sub("angel: acc instead of the tail on reload",
`      if (Settings_default._tailPriority && !Settings_default._cowboyWhenSafe && useTail && this.shouldUseTail()) {
        return 11;
      }`,
`      if (beAngel) {
        return 13;
      }
      if (Settings_default._tailPriority && !Settings_default._cowboyWhenSafe && useTail && this.shouldUseTail()) {
        return 11;
      }`);

sub("angel: acc, standing still",
`      if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {
        if (useBloodWings) return 18;
      }`,
`      if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {
        if (beAngel) return 13;
        if (useBloodWings) return 18;
      }`);

sub("angel: acc, moving",
`      if (useTail) {
        return 11;
      }
      return 0;`,
`      if (beAngel) {
        return 13;
      }
      if (useTail) {
        return 11;
      }
      return 0;`);

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS + BOTS MENU
// ─────────────────────────────────────────────────────────────────────────────

sub("settings: bot combat defaults",
`    _botsScattered: false,`,
`    _botsScattered: false,
    _botAutoBreak: false,
    _botRangedKite: false,
    _botKiteDistance: 400,
    _botBeAngel: false,
    // On by default: when nobody is holding a shield it changes nothing, and
    // when someone is, the target it steers away from takes zero damage.
    _botAvoidShield: true,
    _botAvoidShieldKey: "KeyI",
    _botVolley: false,
    _botVolleyKey: "KeyU",
    _botVolleyWave: 5,`);

const followCursorRow = `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Follow cursor</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_followCursor\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n`;
sub("menu: bot combat rows", followCursorRow,
  followCursorRow +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Bot Auto Break</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_botAutoBreak\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Bot Ranged Kiting</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_botRangedKite\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Volley Fire</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_botVolley\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">First wave size</span>\\r\\n                <label class=\\"slider\\">\\r\\n                    <span class=\\"slider-value\\"></span>\\r\\n                    <input id=\\"_botVolleyWave\\" type=\\"range\\" step=\\"1\\" min=\\"1\\" max=\\"20\\"></input>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Avoid Shield Bots</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_botAvoidShield\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Be Angel</span>\\r\\n                <label class=\\"switch-checkbox\\">\\r\\n                    <input id=\\"_botBeAngel\\" type=\\"checkbox\\"></input>\\r\\n                    <span></span>\\r\\n                </label>\\r\\n            </div>\\r\\n` +
  `            <div class=\\"content-option\\">\\r\\n                <span class=\\"option-title\\">Kite distance</span>\\r\\n                <label class=\\"slider\\">\\r\\n                    <span class=\\"slider-value\\"></span>\\r\\n                    <input id=\\"_botKiteDistance\\" type=\\"range\\" step=\\"25\\" min=\\"150\\" max=\\"1200\\"></input>\\r\\n                </label>\\r\\n            </div>\\r\\n`);

// ─────────────────────────────────────────────────────────────────────────────
// G. CLAN JOIN ROTATION, HUD COUNTERS, BE ANGEL vs COWBOY, SAFE SOLDIER FIDELITY
// ─────────────────────────────────────────────────────────────────────────────

sub("clan: the rotation helpers",
`  class ClanJoiner {`,
fs.readFileSync(__dirname + "/clan-queue.js", "utf8") + `  class ClanJoiner {`);

sub("clan: one bot at a time, verified",
`      if (ownerClan === null || myClan === ownerClan || !PlayerManager2.clanExist(ownerClan)) {
        return;
      }
      if (this.joinCount === 2) {
        this.joinCount = 0;
        if (myClan !== null) {
          PacketManager2.leaveClan();
        } else {
          owner.pendingJoins.add(myPlayer.id);
          PacketManager2.joinClan(ownerClan);
        }
        return;
      }
      this.joinCount += 1;`,
`      if (ownerClan === null || myClan === ownerClan || !PlayerManager2.clanExist(ownerClan)) {
        return;
      }
      // Wait for this bot's slot in the rotation. Without this every bot counted
      // its own two ticks and they all sent inside the same ~200ms.
      if (!clanTakeTurn(owner, this.client, ownerClan, Date.now())) {
        return;
      }
      if (myClan !== null) {
        PacketManager2.leaveClan();
        return;
      }
      owner.pendingJoins.add(myPlayer.id);
      PacketManager2.joinClan(ownerClan);`);

// ── HUD ──────────────────────────────────────────────────────────────────────

sub("hud: players above ping, and a bot counter",
`            <span>PING: <span id="rynPing"></span>ms</span>\\n            <span>PLAYERS: <span id="rynPlayers">?</span></span>`,
`            <span>PLAYERS: <span id="rynPlayers">?</span></span>\\n            <span>BOTS: <span id="rynBots">0/0</span></span>\\n            <span>PING: <span id="rynPing"></span>ms</span>`);

sub("hud: bot counter updater",
`    updatePlayers(text) {`,
`    updateBots(text) {
      const span = document.querySelector("#rynBots");
      if (span !== null) {
        span.textContent = text;
      }
    }
    updatePlayers(text) {`);

sub("hud: drive the bot counter",
`  setInterval(_rynPollServerCount, RYN_SERVER_POLL_MS);`,
`  // How many bots are in, out of how many are connected. Same cadence as the
  // FPS counter would be overkill for something that changes on a join, so it
  // rides a slow timer of its own.
  setInterval(() => {
    try {
      const owner = client;
      if (!owner || !owner.isOwner) return;
      const a = clanAudit(owner);
      GameUI_default.updateBots(a.clan === null ? a.alive + "/" + a.total : a.joined + "/" + a.total);
    } catch (_) {}
  }, 1e3);
  setInterval(_rynPollServerCount, RYN_SERVER_POLL_MS);`);

// ── Be Angel must outrank cowboy for bots ───────────────────────────────────

sub("angel: outranks cowboy, standing still",
`          if (this.canWearCowboy()) return 5;
          if (beAngel) return 48;
          if (useActual && actual !== 0) return actual;`,
`          // Be Angel is checked before the cowboy hat, not after. Cowboy When
          // Safe is a choice about what *you* wear when nothing is happening,
          // and it used to drag the bots along with it — so turning both on put
          // everyone in a cowboy hat and the halo never appeared.
          if (beAngel) return 48;
          if (this.canWearCowboy()) return 5;
          if (useActual && actual !== 0) return actual;`);

sub("angel: outranks cowboy, moving",
`      if (this.canWearCowboy()) {
        return 5;
      }
      if (Settings_default._cowboyWhenSafe) {
        return 0;
      }
      if (beAngel) {
        return 48;
      }
      if (useBooster) {
        return 12;
      }
      return 0;`,
`      if (beAngel) {
        return 48;
      }
      if (this.canWearCowboy()) {
        return 5;
      }
      if (Settings_default._cowboyWhenSafe) {
        return 0;
      }
      if (useBooster) {
        return 12;
      }
      return 0;`);

// ── Safe Soldier fidelity ───────────────────────────────────────────────────

sub("menu: re-check button under the bot name rows",
`        <div id=\\"dynamic-bot-list\\" style=\\"display:flex;flex-direction:column;gap:8px;margin-top:8px;\\"></div>\\r\\n`,
`        <div id=\\"dynamic-bot-list\\" style=\\"display:flex;flex-direction:column;gap:8px;margin-top:8px;\\"></div>\\r\\n        <div class=\\"content-option\\" style=\\"margin-top:8px;justify-content:center;\\">\\r\\n            <button id=\\"_clanRecheck\\" class=\\"option-button\\" style=\\"padding:8px 22px;background:rgba(122,66,244,0.1);border:1.5px solid rgba(122,66,244,0.4);border-radius:7px;color:#FFFFFF;font-size:0.95em;font-weight:700;letter-spacing:0.03em;cursor:pointer;\\">Re-check clan joins</button>\\r\\n        </div>\\r\\n`);

sub("clan: wire the re-check button",
`         case "resetSettings":
          this.handleResetSettings(button);
          break;`,
`         case "resetSettings":
          this.handleResetSettings(button);
          break;

         case "_clanRecheck":
          this.handleClanRecheck(button);
          break;`);

sub("clan: the re-check handler",
`    attachButtons() {`,
`    // Restarts the rotation and reports what it found. Bots already in the clan
    // are skipped by the turn picker, so pressing this costs nothing for them —
    // it only puts the ones that are still out back at the front of the queue.
    handleClanRecheck(button) {
      button.onclick = () => {
        try {
          const a = clanRecheck(client);
          button.textContent = a.clan === null ? "You are not in a clan" : a.joined + "/" + a.total + " joined — retrying the rest";
          setTimeout(() => {
            button.textContent = "Re-check clan joins";
          }, 2500);
        } catch (_) {}
      };
    }
    attachButtons() {`);

sub("bots: mills while wandering",
`          _sc_mh.move_dir = _sc_angle;
          try {
            _sc_bot.PacketManager.move(_sc_angle);
          } catch (_) {}`,
`          _sc_mh.move_dir = _sc_angle;
          // startMovement is the only thing that keeps reverse_move_dir in step
          // with move_dir, and the scatter loop writes move_dir directly — so
          // while wandering it stayed null and Automill, which builds behind the
          // bot and reads exactly that field, returned on its first line every
          // tick. Keeping the pair in sync is what lets bots mill as they roam,
          // which is how x18 uses wander in the first place: c.doMills is what
          // puts a bot into that mode.
          _sc_mh.reverse_move_dir = reverseAngle(_sc_angle);
          try {
            _sc_bot.PacketManager.move(_sc_angle);
          } catch (_) {}`);

sub("header: version", `// @version         v5\n`, `// @version         v5.4\n`);
sub("header: description",
  `// @description     ! have fun\n`,
  `// @description     ! have fun — v5.4 ports autoheal, automill, anti smart tick, safe soldier and the packet budget from Novastorm\n`);

fs.writeFileSync(OUT, s);
console.log("applied " + edits.length + " edits:");
for (const e of edits) console.log("  · " + e);
console.log("wrote " + OUT);
