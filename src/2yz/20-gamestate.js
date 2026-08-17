/* ===========================================================================
 * 2yz / GameState
 * ---------------------------------------------------------------------------
 * The single authoritative world model. Every module reads from here; no module
 * keeps its own copy of a player, an object, a velocity or a tick number.
 *
 * State is rebuilt from the wire, so the packet layouts below are the ones in
 * src/game_index.js and the line numbers point at the decode loops there.
 * =========================================================================== */

class Entity {
    constructor(sid) {
        this.sid = sid;
        this.id = -1;
        this.name = '';
        this.isAI = false;

        /* Interpolation pair, mirroring the game's x1/x2 naming: x1 is where the
         * entity was at the previous server tick, x2 where it is now. */
        this.x1 = 0; this.y1 = 0;
        this.x2 = 0; this.y2 = 0;
        this.d1 = 0; this.d2 = 0;
        this.t1 = 0; this.t2 = 0;

        this.health = 100;
        this.maxHealth = 100;
        this.scale = Defs.config.playerScale;

        this.buildIndex = -1;
        this.weaponIndex = 0;
        this.weaponVariant = 0;
        this.team = null;
        this.isLeader = 0;
        this.skinIndex = 0;
        this.tailIndex = 0;
        this.zIndex = 0;

        this.visible = false;
        this.alive = true;

        /* Last seen primary/secondary, kept separately because weaponIndex only
         * ever reports the one currently held. */
        this.primaryIndex = null;
        this.secondaryIndex = null;
        this.primaryVariant = 0;
        this.secondaryVariant = 0;

        /* Derived per tick by EntityTracker. */
        this.xVel = 0;
        this.yVel = 0;
        this.speed = 0;
        this.moveDir = 0;
        this.prevMoveDir = 0;
        this.dirChange = 0;
        this.history = new U.Ring(8);

        this.trapped = false;
        this.trapObject = null;
        this.spikeDamage = 0;
        this.shameCount = 0;
        this.lastHitTick = -1;
        this.lastHealthDrop = 0;
    }

    get x() { return this.x2; }
    get y() { return this.y2; }

    isEnemyOf(other) {
        if (!other) return false;
        if (this.sid === other.sid) return false;
        if (this.team != null && other.team != null && this.team === other.team) return false;
        return true;
    }
}

class WorldObject {
    constructor(sid, x, y, dir, scale, type, itemId, ownerSid) {
        this.sid = sid;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.scale = scale;
        this.type = type;         // -1 for placed items, >=0 for natural resources
        this.itemId = itemId;
        this.ownerSid = ownerSid;
        this.active = true;

        const item = itemId >= 0 ? Defs.items[itemId] : null;
        this.item = item;
        this.isItem = !!item;
        this.group = item ? item.group : null;
        this.name = item ? item.name : 'resource';
        this.layer = item && item.group && item.group.layer != null ? item.group.layer : 0;

        this.trap = !!(item && item.trap);
        this.damage = item && item.dmg ? item.dmg : 0;
        this.blocker = item && item.blocker ? item.blocker : null;
        this.ignoreCollision = !!(item && item.ignoreCollision);
        this.colDiv = item && item.colDiv ? item.colDiv : 1;
        this.health = item && item.health ? item.health : Infinity;
        this.maxHealth = this.health;
    }

    /* game_index.js:1451 -- the game's own scale rule. Natural resources of
     * type 2/3 and placed items use their raw scale; everything else is
     * shrunk by 0.6 * scaleMult. */
    getScale(scaleMult, isItemCheck) {
        const m = scaleMult || 1;
        const base = this.isItem || this.type === 2 || this.type === 3 ? 1 : 0.6 * m;
        return this.scale * base * (isItemCheck ? 1 : this.colDiv);
    }
}

const GameState = {
    inGame: false,
    mySid: -1,
    self: null,

    players: new Map(),     // sid -> Entity
    animals: new Map(),     // sid -> Entity
    objects: new Map(),     // sid -> WorldObject

    /* Object buckets, maintained incrementally on add/remove instead of being
     * refiltered every tick. */
    myObjects: new Set(),
    teamObjects: new Set(),
    enemyObjects: new Set(),

    tick: 0,
    tickTime: 0,
    lastTickDelta: Defs.TICK_MS,

    /* Mirrors of the local player's inventory, from UPDATE_ITEMS / UPDATE_ITEM_COUNTS. */
    items: [0, 3, 6, 10, 14],
    weapons: [0, null],
    itemCounts: {},
    resources: { food: 0, wood: 0, stone: 0, points: 0, kills: 0 },
    skins: {},
    tails: {},
    age: 1,
    upgradePoints: 0,

    /* What the human is doing, observed from the outbound stream. */
    input: {
        aimDir: 0,
        moveDir: null,
        attacking: false,
        autoGather: false,
        lastAimSent: null,
        lastMoveSent: null
    },

    reset() {
        this.inGame = false;
        this.players.clear();
        this.animals.clear();
        this.objects.clear();
        this.myObjects.clear();
        this.teamObjects.clear();
        this.enemyObjects.clear();
        this.self = null;
        this.tick = 0;
    },

    getPlayer(sid) { return this.players.get(sid) || null; },

    isAlly(sid) {
        if (sid === this.mySid) return true;
        const me = this.self;
        const other = this.players.get(sid);
        if (!me || !other || me.team == null) return false;
        return me.team === other.team;
    },

    /* ------------------------------------------------------------- objects */

    indexObject(obj) {
        if (obj.ownerSid == null || obj.ownerSid < 0) return;
        if (obj.ownerSid === this.mySid) this.myObjects.add(obj);
        else if (this.isAlly(obj.ownerSid)) this.teamObjects.add(obj);
        else this.enemyObjects.add(obj);
    },

    deindexObject(obj) {
        this.myObjects.delete(obj);
        this.teamObjects.delete(obj);
        this.enemyObjects.delete(obj);
    },

    addObject(sid, x, y, dir, scale, type, itemId, ownerSid) {
        const existing = this.objects.get(sid);
        if (existing) this.deindexObject(existing);
        const obj = new WorldObject(sid, x, y, dir, scale, type, itemId, ownerSid);
        this.objects.set(sid, obj);
        this.indexObject(obj);
        return obj;
    },

    removeObject(sid) {
        const obj = this.objects.get(sid);
        if (!obj) return null;
        obj.active = false;
        this.objects.delete(sid);
        this.deindexObject(obj);
        Events.emit('objectRemoved', obj);
        return obj;
    },

    removeObjectsOf(ownerSid) {
        for (const [sid, obj] of this.objects) {
            if (obj.ownerSid === ownerSid) {
                obj.active = false;
                this.objects.delete(sid);
                this.deindexObject(obj);
                Events.emit('objectRemoved', obj);
            }
        }
    },

    /* Objects close enough to matter for placement and collision. Rebuilt once
     * per tick by EntityTracker and shared by everything downstream. */
    nearObjects: [],

    /* --------------------------------------------------- placement validity
     * game_index.js:911 checkItemLocation. The shipped signature has no object
     * list -- it always walks the live one. 2yz takes an explicit list so the
     * placement modules can ask "would this fit if that object were gone",
     * which is what Replace needs. Passing null uses the live near-list. */
    checkItemLocation(x, y, scale, scaleMult, itemId, ignoreWater, objects) {
        const list = objects || this.nearObjects;
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (!o.active) continue;
            const oScale = o.blocker ? o.blocker : o.getScale(scaleMult, o.isItem);
            if (U.getDistance(x, y, o.x, o.y) < scale + oScale) return false;
        }
        if (ignoreWater || itemId === 18) return true;
        const half = Defs.config.mapScale / 2;
        const river = Defs.config.riverWidth / 2;
        return !(y >= half - river && y <= half + river);
    },

    /* True when the group's placement cap is already reached. Uses the real cap
     * from Defs.groupLimit, not sandboxLimit-or-99. */
    isItemLimit(itemId) {
        const item = Defs.items[itemId];
        if (!item || !item.group) return true;
        const groupId = item.group.id;
        const count = this.itemCounts[groupId] || 0;
        return count >= Defs.groupLimit(groupId);
    },

    /* Which item id the local player has slotted for a given group. */
    itemForGroup(groupId) {
        for (let i = 0; i < this.items.length; i++) {
            const item = Defs.items[this.items[i]];
            if (item && item.group && item.group.id === groupId) return this.items[i];
        }
        return null;
    },

    get spikeItem() { return this.itemForGroup(Defs.GROUP.SPIKES); },
    get trapItem() { return this.itemForGroup(Defs.GROUP.TRAP); },
    get millItem() { return this.itemForGroup(Defs.GROUP.MILL); },
    get foodItem() { return this.itemForGroup(Defs.GROUP.FOOD); },
    get wallItem() { return this.itemForGroup(Defs.GROUP.WALLS); },
    get turretItem() { return this.itemForGroup(Defs.GROUP.TURRET); }
};

/* Tiny synchronous event bus. Modules react to world changes here rather than
 * polling, which is what keeps the per-tick work proportional to what actually
 * changed. */
const Events = {
    map: new Map(),
    on(name, fn) {
        if (!this.map.has(name)) this.map.set(name, []);
        this.map.get(name).push(fn);
    },
    emit(name, a, b) {
        const list = this.map.get(name);
        if (!list) return;
        for (let i = 0; i < list.length; i++) {
            try { list[i](a, b); } catch (err) { Log.error('event/' + name, err); }
        }
    }
};
