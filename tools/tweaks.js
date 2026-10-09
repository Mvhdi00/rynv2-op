/*
 * tweaks.js
 *
 * Preferences the user asked for, as opposed to repairs (tools/repairs.js):
 * nothing here is broken in the base, it is just set the way they want it.
 * Applied by tools/fix-ryn.js after the repairs.
 *
 *   pool50        the token pool holds up to 50, and 50 by default
 *   quietChecks   the bottom-right corner stays empty unless Cloudflare wants a
 *                 click
 *   crabArena     what the game says about the Crab King and its arena, kept
 *                 for the fleet; nothing is built there, and no Flipper there
 *   crabMovement  "Crabking movment" in the Bots menu: bots fight the Crab King
 *                 and step out of every attack it announces (needs crabArena)
 */

const GROUPS = { pool50, quietChecks, crabArena, crabMovement };

function apply(editor, groups = Object.keys(GROUPS)) {
  for (const name of groups) {
    if (!GROUPS[name]) throw new Error("no tweak named " + name);
    GROUPS[name](editor);
  }
}

/* ------------------------------------------------------------------ *
 * The token pool: 50, and 50 by default
 *
 * Refilling needs nothing: the keeper tops the shelf back up to the target
 * every 2.5 s, and every token taken starts a refill, for as long as the pool
 * is on and you are in a game.
 * ------------------------------------------------------------------ */

function pool50(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "pool: 50 by default, 50 at most",
    `  const TURNSTILE_POOL_DEFAULT = 4;
  const TURNSTILE_POOL_MAX = 24;`,
    `  const TURNSTILE_POOL_DEFAULT = 50;
  const TURNSTILE_POOL_MAX = 50;`
  );

  edit(
    "pool: the setting's default is 50",
    `    _tokenPoolTarget: 4,`,
    `    _tokenPoolTarget: 50,
    // Set once the stored pool size has been moved to 50 (see below).
    _tokenPool50: false,`
  );

  edit(
    "pool: the slider goes to 50",
    `id=\\"_tokenPoolTarget\\" type=\\"range\\" step=\\"1\\" min=\\"1\\" max=\\"24\\"`,
    `id=\\"_tokenPoolTarget\\" type=\\"range\\" step=\\"1\\" min=\\"1\\" max=\\"50\\"`
  );

  /* Every setting is saved at load, defaults included, so a size stored before
   * this — the old default 4, or one the old cap of 24 clipped — would win over
   * the new default. It is moved to 50 once; anything set after that is kept. */
  edit(
    "pool: a stored size from before is moved to 50 once",
    `  const settings = {
    ...defaultSettings,
    ...storedSettings
  };`,
    `  const settings = {
    ...defaultSettings,
    ...storedSettings
  };
  if (!settings._tokenPool50) {
    settings._tokenPoolTarget = 50;
    settings._tokenPool50 = true;
  }`
  );
}

/* ------------------------------------------------------------------ *
 * A quiet corner
 *
 * Every Cloudflare check and every bot attempt has a card in the bottom-right
 * dock. Now a card is only seen while it carries `ryn-cf-ask` — which RynCF
 * sets when Cloudflare wants a click (before-interactive-callback) and takes
 * off when the click is done — so nothing shows while checks run on their own.
 *
 * Hidden with opacity, not display or position: the widget inside has to stay
 * laid out and on screen for Cloudflare to finish a check that needs no click.
 * `!important` because the cards fade in with an animation that would
 * otherwise set their opacity back.
 *
 * What the cards used to say when something went wrong still goes somewhere:
 * a bot's failure to the console and the small toast, a pool check's to the
 * console (the pool backs off and tries again on its own).
 * ------------------------------------------------------------------ */

function quietChecks(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "quiet: a card is seen only while Cloudflare wants a click",
    "@keyframes ryn-cf-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n`;",
    "@keyframes ryn-cf-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n" +
      "#ryn-cf-dock .ryn-cf-card:not(.ryn-cf-ask) { opacity: 0 !important; pointer-events: none !important; }\n" +
      "#ryn-cf-dock .ryn-cf-more { display: none !important; }\n`;"
  );

  edit(
    "quiet: a bot's failure goes to the console and the toast",
    `        fail: (text, retry) => {
          if (att.closed) return;
          att.host.style.display = "none";
          att.say(text, "bad");`,
    `        fail: (text, retry) => {
          if (att.closed) return;
          // Its card is not shown, so the reason is said where it is seen.
          try {
            rynBotNotice(att.label + ": " + text);
          } catch (_) {}
          att.host.style.display = "none";
          att.say(text, "bad");`
  );

  edit(
    "quiet: a pool check's failure goes to the console",
    `        if (error && error.message !== "cancelled") {
          this._say(job, error.message, "bad");`,
    `        if (error && error.message !== "cancelled") {
          try {
            console.warn("[RYN] " + job.kind + " (" + job.label + "): " + error.message);
          } catch (_) {}
          this._say(job, error.message, "bad");`
  );
}

/* ------------------------------------------------------------------ *
 * The Crab King's arena
 *
 * The game (index-3d3599b6.js) puts the Crab King in a "secret pool" west of
 * the map's edge, up the river through a gorge, and tells the client three
 * things about it that RYN did not read:
 *
 *   - where the arena is: config.secretPool, the gorge (x -1500 to 0, 520
 *     either side of the river's centre line) and five pools [x, y, r] — all
 *     at x < 0, where the map itself has nothing;
 *   - each attack before it lands: s2c "W" (the bundle's qh), [kind, x, y, r,
 *     ms, x2, y2], a warning drawn on the ground for ms plus one server tick —
 *     1 a blue ring, 3 an orange ring, 4 a charge lane from (x, y) to
 *     (x2, y2), anything else a splash where it comes back up. RYN's switch
 *     had no case for it;
 *   - whether it is under water: the eighth field of each animal in "I"
 *     (1 going under, 2 under, 3 coming back up), which RYN's parser read
 *     past and dropped.
 *
 * RynCrab keeps all three for the fleet, from whichever connection saw them.
 *
 * And two things the user saw in the arena. Nothing can be built there, but
 * the automatic placers kept trying — every placement now stops at the arena
 * (place, its resend, requestPlace/Many and canPlace, which the placement
 * engine's batch asks). And the biome hats put the Flipper on, because
 * pointInRiver() only looks at y and the gorge is the river carried on west;
 * west of the map's edge it no longer counts.
 * ------------------------------------------------------------------ */

function crabArena(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "crab: what the fleet knows about the Crab King and its arena",
    `  const pointInDesert = position => position.y >= Config_default.mapScale - Config_default.snowBiomeTop;
`,
    `  const pointInDesert = position => position.y >= Config_default.mapScale - Config_default.snowBiomeTop;
  /* ==========================================================================
   * The Crab King
   *
   * What the game tells the client about the boss and its arena
   * (index-3d3599b6.js), kept in one place for the whole fleet.
   *
   * The arena is the "secret pool" west of the map's edge, up the river
   * through a gorge (the bundle's config.secretPool): the gorge runs from
   * x = -1500 to the edge, 520 either side of the river's centre line, and
   * opens into five pools [x, y, r]. The map itself starts at x = 0, so
   * anything west of it is the arena — and nothing can be built there.
   *
   * Every attack is announced before it lands, in s2c "W" (the bundle's qh):
   * [kind, x, y, r, ms, x2, y2], drawn on the ground until ms, plus one server
   * tick, have gone by:
   *   1      a blue ring of radius r
   *   3      an orange ring of radius r
   *   4      a charge from (x, y) to (x2, y2), r either side of the line
   *   other  a splash of radius r: where it comes back up
   * Its state is the eighth field of each animal in "I": 1 going under,
   * 2 under, 3 coming back up (the bundle turns its health bar blue for all
   * three). Crabs (13) and crablings (14) are its adds.
   * ======================================================================== */
  const RYN_CRAB_KING = 11;
  const RYN_CRAB_POOLS = [ [ -2500, 7200, 1150 ], [ -3300, 6750, 750 ], [ -3200, 7750, 700 ], [ -1700, 6900, 600 ], [ -1800, 7550, 600 ] ];
  const RYN_CRAB_GORGE_X0 = -1500;
  const RYN_CRAB_GORGE_HALF = 520;
  const RYN_CRAB_MID_Y = 7200;
  const RYN_CRAB_WATERFALL = {
    x: -3860,
    y: 7250,
    half: 210
  };
  const RYN_CRAB_BODY = 280;
  // A sighting holds this long, which covers a dive: the boss can drop out of
  // the update while it is under.
  const RYN_CRAB_SEEN_MS = 8e3;
  const RYN_CRAB_TICK_MS = 1e3 / 9;
  // Building stops this far short of the gorge's mouth as well: a build is set
  // down up to ~120 out from the player.
  const RYN_CRAB_BUILD_MARGIN = 140;
  const RynCrab = {
    boss: null,
    minions: new Map(),
    warnings: [],
    // How far (x, y) is from the ground the arena can be walked on: <= 0 is on
    // it. The bundle's own Ph, which it lays the arena's rocks out with.
    edge(x, y) {
      let n = -x;
      const off = Math.abs(y - RYN_CRAB_MID_Y) - RYN_CRAB_GORGE_HALF;
      if (x >= RYN_CRAB_GORGE_X0) n = Math.min(n, Math.max(off, 0));
      for (let i = 0; i < RYN_CRAB_POOLS.length; i++) {
        const p = RYN_CRAB_POOLS[i];
        n = Math.min(n, Math.hypot(x - p[0], y - p[1]) - p[2]);
      }
      const w = RYN_CRAB_WATERFALL;
      if (Math.abs(y - w.y) < w.half + 60 && x < w.x) n = Math.min(n, Math.abs(y - w.y) - w.half);
      return n;
    },
    // West of the map's edge: the gorge and the pools.
    inArena(pos) {
      return !!pos && pos.x < 0;
    },
    // Where a build is refused, or would be set down where it is.
    noBuild(pos) {
      return !!pos && (pos.x < 0 || pos.x < RYN_CRAB_BUILD_MARGIN && Math.abs(pos.y - RYN_CRAB_MID_Y) < RYN_CRAB_GORGE_HALF + RYN_CRAB_BUILD_MARGIN);
    },
    watches(type) {
      return type === RYN_CRAB_KING || type === 13 || type === 14;
    },
    noteAnimal(sid, type, x, y, dir, health, state) {
      const now = Date.now();
      if (type !== RYN_CRAB_KING) {
        this.minions.set(sid, {
          sid: sid,
          type: type,
          x: x,
          y: y,
          health: health,
          seenAt: now
        });
        return;
      }
      let b = this.boss;
      if (b === null || b.sid !== sid) {
        b = this.boss = {
          sid: sid,
          x: x,
          y: y,
          dir: dir,
          health: health,
          state: 0,
          stateAt: now,
          seenAt: now
        };
      }
      state = state | 0;
      if (state !== b.state) {
        b.state = state;
        b.stateAt = now;
      }
      b.x = x;
      b.y = y;
      b.dir = dir;
      b.health = health;
      b.seenAt = now;
    },
    // Every connection in sight gets the same "W": it is kept once.
    noteWarning(kind, x, y, r, ms, x2, y2) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || !Number.isFinite(ms)) return;
      if (!Number.isFinite(x2)) x2 = x;
      if (!Number.isFinite(y2)) y2 = y;
      const now = Date.now();
      const end = now + ms + RYN_CRAB_TICK_MS;
      for (let i = 0; i < this.warnings.length; i++) {
        const w = this.warnings[i];
        if (w.kind === kind && w.r === r && Math.abs(w.x - x) < 1 && Math.abs(w.y - y) < 1 && Math.abs(w.x2 - x2) < 1 && Math.abs(w.y2 - y2) < 1 && Math.abs(w.end - end) < 400) return;
      }
      this.warnings.push({
        kind: kind,
        x: x,
        y: y,
        x2: x2,
        y2: y2,
        r: r,
        start: now,
        end: end
      });
      if (this.warnings.length > 64) this.warnings.splice(0, this.warnings.length - 64);
    },
    bossNow(now = Date.now()) {
      const b = this.boss;
      return b !== null && now - b.seenAt < RYN_CRAB_SEEN_MS && b.health > 0 ? b : null;
    },
    minionsNow(now = Date.now()) {
      const out = [];
      for (const [sid, m] of this.minions) {
        if (now - m.seenAt > 1e3 || !(m.health > 0)) this.minions.delete(sid); else out.push(m);
      }
      return out;
    },
    // The warnings still to land, or just landing.
    active(now = Date.now()) {
      this.warnings = this.warnings.filter(w => w.end + 150 > now);
      return this.warnings;
    },
    // How far inside warning w the point (x, y) is, with pad added to its
    // reach: > 0 is hit. A charge is the boss's body carried down the lane,
    // so its reach is never less than the body's.
    depth(w, x, y, pad) {
      if (w.kind === 4) {
        const dx = w.x2 - w.x, dy = w.y2 - w.y;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((x - w.x) * dx + (y - w.y) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.max(w.r, RYN_CRAB_BODY) + pad - Math.hypot(x - (w.x + t * dx), y - (w.y + t * dy));
      }
      return w.r + pad - Math.hypot(x - w.x, y - w.y);
    }
  };
`
  );

  edit(
    "crab: the boss's state and its adds, from each animal row",
    `          r[6] = rows[i + 6];
          r.visible = true;
`,
    `          r[6] = rows[i + 6];
          r.visible = true;
          // The eighth field, the boss's state, is not one RYN's Animal keeps.
          if (RynCrab.watches(r[1])) {
            try {
              RynCrab.noteAnimal(sid, r[1], r[2], r[3], r[4], r[5], rows[i + 7]);
            } catch (_) {}
          }
`
  );

  edit(
    "crab: each attack the boss announces (W)",
    `       case "a":
        this._worldUpdate(decoded[1]);
        break;
`,
    `       case "W":
        // The Crab King's next attack: [kind, x, y, r, ms, x2, y2].
        try {
          RynCrab.noteWarning(temp[1], temp[2], temp[3], temp[4], temp[5], temp[6], temp[7]);
        } catch (_) {}
        break;

       case "a":
        this._worldUpdate(decoded[1]);
        break;
`
  );

  // Building: types 3 and up are the buildings (0, 1 the weapons, 2 food).
  edit(
    "crab: nothing is built in the arena (canPlace, which the engine's batch asks)",
    `      return type !== null && this.getItemByType(type) !== null && this.hasResourcesForType(type) && this.hasItemCountForType(type);
`,
    `      if (type >= 3 && this.pos && RynCrab.noBuild(this.pos.current)) return false;
      return type !== null && this.getItemByType(type) !== null && this.hasResourcesForType(type) && this.hasItemCountForType(type);
`
  );
  edit(
    "crab: nothing is built in the arena (place)",
    `    place(type, angle = this._currentAngle, reset = false) {
      this.totalPlaces += 1;
`,
    `    place(type, angle = this._currentAngle, reset = false) {
      if (type >= 3 && RynCrab.noBuild(this.client.myPlayer.pos.current)) return;
      this.totalPlaces += 1;
`
  );
  edit(
    "crab: nothing is built in the arena (resendPlace)",
    `    resendPlace(type, angle) {
      if (this.packetCount + RPE_PLACE_PACKETS > this.packetLimit) return false;
`,
    `    resendPlace(type, angle) {
      if (type >= 3 && RynCrab.noBuild(this.client.myPlayer.pos.current)) return false;
      if (this.packetCount + RPE_PLACE_PACKETS > this.packetLimit) return false;
`
  );
  edit(
    "crab: nothing is built in the arena (requestPlace)",
    `    requestPlace(type, angle, owner) {
      if (this._placementHitsProtected(type, angle)) {
`,
    `    requestPlace(type, angle, owner) {
      if (type >= 3 && RynCrab.noBuild(this.client.myPlayer.pos.current)) return 0;
      if (this._placementHitsProtected(type, angle)) {
`
  );
  edit(
    "crab: nothing is built in the arena (requestPlaceMany)",
    `    requestPlaceMany(type, angles, owner) {
      let safe = angles;
`,
    `    requestPlaceMany(type, angles, owner) {
      if (type >= 3 && RynCrab.noBuild(this.client.myPlayer.pos.current)) return 0;
      let safe = angles;
`
  );

  edit(
    "crab: no Flipper in the arena",
    `      if (Settings_default._biomehats && useFlipper && !myPlayer.onPlatform) {
        const inRiver = pointInRiver(current) || pointInRiver(future);
`,
    `      if (Settings_default._biomehats && useFlipper && !myPlayer.onPlatform) {
        // The gorge carries the river's y on west of the map: not the river.
        const inRiver = !RynCrab.inArena(current) && (pointInRiver(current) || pointInRiver(future));
`
  );
}

/* ------------------------------------------------------------------ *
 * Crabking movment
 *
 * A switch in the Bots menu. With it on, every bot fights the Crab King
 * while the fleet knows where it is, and steps out of each attack the boss
 * announces (RynCrab, crabArena above). The bot arbiter gives those bots
 * their own mode, BOT_MODE.CRAB, which the follow, roaming and the ranged
 * kite stand down for, and BotCrabKing walks and swings them.
 * ------------------------------------------------------------------ */

function crabMovement(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "crab movement: the setting, off by default",
    `    _botBeAngel: false,
`,
    `    _botBeAngel: false,
    // Crabking movment (Bots menu): fight the Crab King, dodge what it throws.
    _botCrabKing: false,
`
  );

  editor.patchPage(
    "Bots_default",
    `        </div>
    </div>

    <div class="section">
        <div class="section-title">Bot Protection`,
    `            <div class="content-option">
                <div class="opt-main">
                    <span class="option-title">Crabking movment</span>
                    <span class="opt-desc">Bots fight the Crab King while it is in sight and step out of every attack it warns of: rings, charges, and where it comes back up.</span>
                </div>
                <label class="switch-checkbox"><input id="_botCrabKing" type="checkbox"><span></span></label>
            </div>
`
  );

  edit(
    "crab movement: a mode of its own",
    `    SCAN_TRACK: "scanTrack",
    FARMING: "farming",
`,
    `    SCAN_TRACK: "scanTrack",
    CRAB: "crabKing",
    FARMING: "farming",
`
  );
  edit(
    "crab movement: the mode decides where the bot walks",
    `    return m === BOT_MODE.ASSIGNED || m === BOT_MODE.SCAN_ATTACK || m === BOT_MODE.SCAN_TRACK || m === BOT_MODE.GUARDING;
`,
    `    return m === BOT_MODE.ASSIGNED || m === BOT_MODE.SCAN_ATTACK || m === BOT_MODE.SCAN_TRACK || m === BOT_MODE.GUARDING || m === BOT_MODE.CRAB;
`
  );
  edit(
    "crab movement: the arbiter hands it out while the boss is known",
    `      if (Settings_default._botAutoFarmEnabled) return BOT_MODE.FARMING;
`,
    `      if (Settings_default._botCrabKing && RynCrab.bossNow(now) !== null) return BOT_MODE.CRAB;
      if (Settings_default._botAutoFarmEnabled) return BOT_MODE.FARMING;
`
  );
  edit(
    "crab movement: the module",
    `        botScanMission: new BotScanMission(client2),
`,
    `        botScanMission: new BotScanMission(client2),
        botCrabKing: new BotCrabKing(client2),
`
  );
  edit(
    "crab movement: run with the other bot modules, before the follow",
    `this.staticModules.botScanMission, this.staticModules.botExplorer,`,
    `this.staticModules.botScanMission, this.staticModules.botCrabKing, this.staticModules.botExplorer,`
  );

  /* The Monkey Tail cuts damage to a fifth (dmgMultO .2). DefaultAcc only took
   * it off for a player close by, and the boss is an animal, so a bot at the
   * boss kept swinging with it on. At the boss: Blood Wings (each hit heals),
   * else the chosen accessory, else none — never the tail. Away from it the
   * tail's speed still helps with walking in and dodging. */
  edit(
    "crab movement: no Monkey Tail at the boss",
    `      if (Settings_default._tailPriority && !Settings_default._cowboyWhenSafe && useTail && this.shouldUseTail()) {
`,
    `      if (ModuleHandler._rynMode === BOT_MODE.CRAB && ModuleHandler._rynCrabClose) {
        if (useBloodWings) return 18;
        if (useActual && actual !== 11) return actual;
        return 0;
      }
      if (Settings_default._tailPriority && !Settings_default._cowboyWhenSafe && useTail && this.shouldUseTail()) {
`
  );

  edit(
    "crab movement: BotCrabKing",
    `  class BotArbiter {
`,
    `  /* ==========================================================================
   * Crabking movment (Bots menu)
   *
   * With it on, a bot fights the Crab King while the fleet knows where it is
   * (any connection has seen it in the last RYN_CRAB_SEEN_MS). The arbiter
   * hands it BOT_MODE.CRAB, which the follow, roaming and the ranged kite all
   * stand down for, and this module walks and swings it.
   *
   * Every tick it weighs seventeen moves, standing still and sixteen headings,
   * against every warning the boss has put on the ground (RynCrab.warnings):
   * where that move would have it when each one lands, and how deep inside it
   * that is. Being inside outweighs everything else, so a bot in a ring, a
   * charge lane or a splash walks out the moment it is drawn, the shortest
   * safe way, without walking into another one getting out. With nothing to
   * step out of it goes to its own place on a ring round the boss (the bots
   * spread evenly round it, so one charge cannot take them all), just inside
   * its weapon's reach, and swings; a bow or musket shoots from further out.
   * While the boss is under water it holds back and waits for it to come up.
   * Crabs and crablings in reach are hit when the boss is not.
   *
   * The arena's walls (RynCrab.edge) are weighed too, and a bot outside the
   * arena goes to the gorge's mouth first, then up it.
   * ======================================================================== */
  // A player's radius and room to spare, added to every warning's reach.
  const RYN_CRAB_PAD = 80;
  // How far ahead a move is judged: a warning further off than this is
  // judged where the move has the bot by then.
  const RYN_CRAB_LOOK_MS = 1400;
  // px per ms, for a bot that is standing still.
  const RYN_CRAB_SPEED = .2;
  // From the boss's centre, while it is under.
  const RYN_CRAB_HOLD = 700;
  // How far a bow or musket is worth shooting from.
  const RYN_CRAB_RANGED = 650;
  const RYN_CRAB_MOUTH = {
    x: 120,
    y: 7200
  };
  class BotCrabKing {
    moduleName="botCrabKing";
    client;
    // As the follow keeps it: a stop goes out once, not on every tick stood.
    isStopped=true;
    // At the boss and swinging (DefaultAcc takes the Monkey Tail off for it).
    // On at reach + 80, off past reach + 200, so the accessory does not
    // flicker at the edge.
    close=false;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.isStopped = true;
      this.close = false;
    }
    // This bot's share of the circle round the boss.
    _slot(c) {
      let i = 0, n = 0;
      try {
        const bots = c.ownerClient.clientList();
        for (let k = 0; k < bots.length; k++) {
          const mh = bots[k] && bots[k]._ModuleHandler;
          if (!mh || mh._rynMode !== BOT_MODE.CRAB) continue;
          if (bots[k] === c) i = n;
          n++;
        }
      } catch (_) {}
      return Math.PI * 2 * i / Math.max(1, n);
    }
    // me: { x, y, speed (px/ms), reach (px past the boss's edge), ranged,
    // slot (radians) }. Returns { move: heading or null, aim: angle or null,
    // weapon: 0 or 1, dodging }.
    _plan(me, now) {
      const boss = RynCrab.bossNow(now);
      const warnings = RynCrab.active(now);
      const v = Math.max(me.speed || 0, RYN_CRAB_SPEED);
      const under = boss !== null && (boss.state === 1 || boss.state === 2);
      let goal = null;
      if (boss !== null) {
        const ring = under ? RYN_CRAB_HOLD : RYN_CRAB_BODY + Math.max(40, me.reach * .7);
        goal = {
          x: boss.x + Math.cos(me.slot) * ring,
          y: boss.y + Math.sin(me.slot) * ring
        };
        // Outside the arena and off the river's line: the gorge's mouth first.
        if (boss.x < 0 && me.x > -200 && Math.abs(me.y - RYN_CRAB_MID_Y) > RYN_CRAB_GORGE_HALF - 120) goal = RYN_CRAB_MOUTH;
      }
      let dodging = false;
      for (let i = 0; i < warnings.length; i++) {
        if (RynCrab.depth(warnings[i], me.x, me.y, RYN_CRAB_PAD) > 0) {
          dodging = true;
          break;
        }
      }
      let best = null;
      for (let k = -1; k < 16; k++) {
        const d = k < 0 ? null : k * Math.PI / 8;
        const cx = d === null ? 0 : Math.cos(d), cy = d === null ? 0 : Math.sin(d);
        let cost = 0;
        for (let i = 0; i < warnings.length; i++) {
          const w = warnings[i];
          const left = w.end - now;
          const t = Math.max(0, Math.min(left, RYN_CRAB_LOOK_MS));
          const depth = RynCrab.depth(w, me.x + cx * v * t, me.y + cy * v * t, RYN_CRAB_PAD);
          if (depth > 0) cost += (depth + 60) * (4 + 2e3 / Math.max(left, 100));
        }
        // Where the move has it half a second on.
        const hx = me.x + cx * v * 500, hy = me.y + cy * v * 500;
        if (hx < 0) {
          const e = RynCrab.edge(hx, hy);
          if (e > -35) cost += (e + 35) * 6;
        }
        if (boss !== null) {
          const inside = RYN_CRAB_BODY + 35 - Math.hypot(hx - boss.x, hy - boss.y);
          if (inside > 0) cost += inside * 3;
        }
        if (goal !== null) cost += Math.hypot(hx - goal.x, hy - goal.y) * .05;
        if (best === null || cost < best.cost - 1e-9) best = {
          d: d,
          cost: cost
        };
      }
      let aim = null, weapon = 0;
      if (boss !== null && !under) {
        const gap = Math.hypot(boss.x - me.x, boss.y - me.y) - RYN_CRAB_BODY;
        if (gap <= me.reach) {
          aim = Math.atan2(boss.y - me.y, boss.x - me.x);
        } else if (me.ranged && gap <= RYN_CRAB_RANGED) {
          aim = Math.atan2(boss.y - me.y, boss.x - me.x);
          weapon = 1;
        }
      }
      if (aim === null) {
        let near = null, nearGap = Infinity;
        const adds = RynCrab.minionsNow(now);
        for (let i = 0; i < adds.length; i++) {
          const m = adds[i];
          const gap = Math.hypot(m.x - me.x, m.y - me.y) - (m.type === 13 ? 78 : 39);
          if (gap <= me.reach && gap < nearGap) {
            near = m;
            nearGap = gap;
          }
        }
        if (near !== null) aim = Math.atan2(near.y - me.y, near.x - me.x);
      }
      return {
        move: best.d,
        aim: aim,
        weapon: weapon,
        dodging: dodging
      };
    }
    postTick() {
      const c = this.client;
      const mh = c._ModuleHandler;
      if (!mh || c.isOwner || mh._rynMode !== BOT_MODE.CRAB) return;
      const p = c.myPlayer;
      if (!p || !p.inGame || !p.pos) return;
      const now = Date.now();
      const boss = RynCrab.bossNow(now);
      if (boss === null) return;
      const pos = p.pos.current;
      const primary = p.getItemByType(0), secondary = p.getItemByType(1);
      const pw = primary !== null && primary !== void 0 ? DataHandler_default.getWeapon(primary) : null;
      const sw = secondary !== null && secondary !== void 0 ? DataHandler_default.getWeapon(secondary) : null;
      const reach = pw && pw.range || 60;
      const plan = this._plan({
        x: pos.x,
        y: pos.y,
        speed: (p.speed || 0) / RYN_CRAB_TICK_MS,
        reach: reach,
        ranged: !!(sw && sw.projectile !== void 0),
        slot: this._slot(c)
      }, now);
      const gap = Math.hypot(boss.x - pos.x, boss.y - pos.y) - RYN_CRAB_BODY;
      this.close = this.close ? gap <= reach + 200 : gap <= reach + 80;
      mh._rynCrabClose = this.close && boss.state !== 1 && boss.state !== 2;
      if (plan.move === null) {
        if (!this.isStopped) {
          this.isStopped = true;
          mh.stopMovement();
        }
      } else {
        this.isStopped = !mh.startMovement(plan.move);
      }
      if (plan.aim !== null) {
        mh._currentAngle = plan.aim;
        mh.moduleActive = true;
        mh.useAngle = plan.aim;
        mh.forceWeapon = plan.weapon;
        mh.shouldAttack = true;
      } else {
        mh._currentAngle = Math.atan2(boss.y - pos.y, boss.x - pos.x);
      }
    }
  }
  class BotArbiter {
`
  );
}

module.exports = { apply, GROUPS };
