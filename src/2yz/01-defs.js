/* ===========================================================================
 * 2yz / Defs
 * ---------------------------------------------------------------------------
 * Every game constant, id, table and packet name in 2yz enters through this
 * file and nowhere else. The tables themselves are injected at build time from
 * drivers/game-drivers.json, which tools/extract-drivers.js reads out of
 * src/game_index.js. Nothing here is typed in by hand, so nothing here can
 * drift from the shipped game.
 *
 * The packet name maps below are transcribed from the send/handler sites in
 * src/game_index.js; each entry carries the line it came from so it can be
 * re-checked. tools/verify-2yz.js re-derives them and fails the build on a
 * mismatch.
 * =========================================================================== */

const DRIVERS = __2YZ_DRIVERS__;

const Defs = {
    config: DRIVERS.config,
    weapons: DRIVERS.weapons,
    items: DRIVERS.items,
    itemGroups: DRIVERS.itemGroups,
    hats: DRIVERS.hats,
    accessories: DRIVERS.accessories,
    projectiles: DRIVERS.projectiles,
    protocol: DRIVERS.protocol,

    /* --- client -> server ------------------------------------------------
     * Transcribed from the O.send call sites in src/game_index.js. */
    C2S: {
        SPAWN: 'M',        // 4612  O.send("M", {name, moofoll, skin})
        AIM_DIR: 'D',      // 4826  O.send("D", Ci())      Ci() = mouse aim, fixTo 2
        MOVE_DIR: '9',     // 4585  O.send("9", ul())      ul() = WASD dir, fixTo 2
        MOVE_STOP: 'e',    // 4553  O.send("e")            clears held keys
        ATTACK: 'F',       // 4580  O.send("F", state, buildIndex>=0 ? Ci() : null)
        SELECT: 'z',       // 4599  O.send("z", id, isItem)
        TOGGLE: 'K',       // 4590  K,0 = lock direction   4596  K,1 = auto gather
        MAP_PING: 'S',     // 4593  O.send("S", 1)         'R' key / mapDisplay click
        UPGRADE: 'H',      // 4775  O.send("H", index)
        STORE: 'c',        // 4292  c,0 = buy   4295  c,1 = equip   (id, type)
        CHAT: '6',         // 4451  O.send("6", text.slice(0,30))
        ALLY_CREATE: 'L',  // 4133
        ALLY_LEAVE: 'N',   // 4138
        ALLY_ANSWER: 'P',  // 4122  O.send("P", sid, accept)
        ALLY_KICK: 'Q',    // 4127
        ALLY_JOIN: 'b',    // 4130
        PING: '0'          // 5613  O.send("0")  every 2500ms
    },

    /* --- server -> client ------------------------------------------------
     * Transcribed from the handler map passed to O.connect (game_index.js:3515). */
    S2C: {
        INIT: 'A',              // Wa   teams
        DISCONNECT: 'B',        // zt
        SETUP_GAME: 'C',        // xl   yourSID
        ADD_PLAYER: 'D',        // Nl   (data[], isYou)
        REMOVE_PLAYER: 'E',     // zl   (id)
        UPDATE_PLAYERS: 'a',    // Jl   flat, stride 13
        LEADERBOARD: 'G',       // Tl
        LOAD_OBJECTS: 'H',      // Vl   flat, stride 8
        UPDATE_AI: 'I',         // Xl
        GATHER_ANIM_AI: 'J',    // Fl
        ATTACK_ANIM: 'K',       // Pl   (sid, didHit, weaponIndex)
        WIGGLE_OBJECT: 'L',     // Wl   (dir, sid)
        SHOOT_TURRET: 'M',      // _l   (sid, dir)
        UPDATE_VALUE: 'N',      // Kl   (key, value, updateView)
        UPDATE_HEALTH: 'O',     // $l   (sid, health)
        KILL_PLAYER: 'P',       // Sl
        KILL_OBJECT: 'Q',       // Il   (sid)
        KILL_ALL_OBJECTS: 'R',  // Ml   (sid)
        UPDATE_ITEM_COUNTS: 'S',// Yl   (groupId, count)
        UPDATE_AGE: 'T',        // jn
        UPDATE_UPGRADES: 'U',   // Un
        UPDATE_ITEMS: 'V',      // Nn   (list, isWeapon)
        ADD_PROJECTILE: 'X',    // Ll
        REMOVE_PROJECTILE: 'Y', // ql   (sid, range)
        SERVER_SHUTDOWN: 'Z',   // Ul
        ADD_ALLIANCE: 'g',      // $a
        SET_TEAM: '3',          // Ja   (team, isOwner)
        UPDATE_STORE: '5',      // al   (isEquip, id, isAccessory)
        CHAT_MESSAGE: '6',      // dl   (sid, text)
        PING_RESULT: '0',       // Zl
        /* Documented for completeness; 2yz reads health changes from
         * UPDATE_HEALTH instead, which is exact rather than rounded for
         * display. Verified against the bundle by tools/verify-2yz.js. */
        SHOW_TEXT: '8'          // vl   (x, y, value, type)  damage numbers
    },

    /* --- flat-packet strides, from the decode loops in game_index.js ----- */
    STRIDE: {
        UPDATE_PLAYERS: 13,   // Jl  5551
        LOAD_OBJECTS: 8       // Vl  5432
    },

    /* Field order inside one UPDATE_PLAYERS record (game_index.js:5556-5576). */
    PLAYER_FIELDS: [
        'sid', 'x', 'y', 'dir', 'buildIndex', 'weaponIndex', 'weaponVariant',
        'team', 'isLeader', 'skinIndex', 'tailIndex', 'iconIndex', 'zIndex'
    ],

    /* Field order inside one LOAD_OBJECTS record (game_index.js:5433-5437). */
    OBJECT_FIELDS: [
        'sid', 'x', 'y', 'dir', 'scale', 'type', 'itemId', 'ownerSid'
    ],

    /* Item-group ids, resolved from the shipped itemGroups table by name so a
     * renumbering upstream cannot silently repoint them. */
    GROUP: {},

    /* Hats 2yz swaps between. Resolved by name against the shipped hat table.
     * Values are ids; the effects they are chosen for are in the table itself
     * (Soldier dmgMult 0.75, Bull dmgMultO 1.5, Tank bDmg 3.3, Booster spdMult 1.16). */
    HAT: {}

};

(function resolveIds() {
    for (const g of Defs.itemGroups) Defs.GROUP[g.name.toUpperCase()] = g.id;

    const wantHats = {
        SOLDIER: 'Soldier Helmet',
        BULL: 'Bull Helmet',
        BOOSTER: 'Booster Hat',
        TANK: 'Tank Gear',
        TURRET: 'Turret Gear',
        WINTER: 'Winter Cap',
        FLIPPER: 'Flipper Hat',
        EMP: 'Emp Helmet',
        SPIKE_GEAR: 'Spike Gear'
    };
    for (const key in wantHats) {
        const hat = Defs.hats.find((h) => h.name === wantHats[key]);
        Defs.HAT[key] = hat ? hat.id : null;
    }
})();

/* Derived timings. serverUpdateRate is in ticks/second; every "tick" figure in
 * 2yz is expressed against this rather than a hard-coded 111ms. */
Defs.TICK_MS = 1000 / Defs.config.serverUpdateRate;
Defs.SEND_MS = 1000 / Defs.config.clientSendRate;

/* Placement offset used by the game when it builds an item in front of a
 * player: playerScale + item.scale + (item.placeOffset || 0), from the build
 * branch of PlayerObject (game_index.js:2458). */
Defs.placeDistance = function (itemId) {
    const item = Defs.items[itemId];
    if (!item) return null;
    return Defs.config.playerScale + item.scale + (item.placeOffset || 0);
};

/* Real placement cap for an item's group. The shipped client picks
 * sandboxLimit only when actually in sandbox and falls back to limit
 * otherwise; anything that reads sandboxLimit unconditionally gets a cap of
 * 99+ for items whose real cap is 15, 6, 2 or 1. */
Defs.groupLimit = function (groupId) {
    const group = Defs.itemGroups[groupId];
    if (!group) return 0;
    if (Defs.config.inSandbox && group.sandboxLimit != null) return group.sandboxLimit;
    return group.limit != null ? group.limit : 99;
};
