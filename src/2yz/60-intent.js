/* ===========================================================================
 * 2yz / Intents
 * ---------------------------------------------------------------------------
 * Modules never act. They describe what they would like to happen and hand it
 * to the Arbiter. That is the whole reason 2yz does not need any module to know
 * about any other: Safe Soldier cannot stamp on Combat because it has no way to
 * reach the socket, only a way to ask.
 *
 * Every intent carries the four things arbitration needs:
 *
 *   urgency     how badly this wants to happen, 0..100
 *   confidence  how sure the module is that it is still correct, 0..1
 *   cost        how many outbound frames it will spend
 *   validate()  re-checked immediately before execution, never at creation
 *
 * The last one is what makes stale actions impossible rather than unlikely: an
 * intent built two ticks ago is re-tested against live state at the moment it
 * would be sent, and dropped if the world moved underneath it.
 * =========================================================================== */

class Intent {
    constructor(kind, opts) {
        this.kind = kind;
        this.source = opts.source;
        this.urgency = opts.urgency != null ? opts.urgency : 50;
        this.confidence = opts.confidence != null ? opts.confidence : 1;
        this.createdTick = GameState.tick;
        this.target = opts.target || null;
        this.cost = opts.cost != null ? opts.cost : 1;
        this.meta = opts.meta || {};
        this.rejectedReason = null;
    }

    /* Effective priority. Confidence scales urgency rather than gating it, so a
     * half-sure emergency still outranks a certain convenience. */
    get priority() { return this.urgency * (0.5 + 0.5 * this.confidence); }

    /* Overridden by subclasses. Returning a string means "drop me, here is
     * why" -- the string ends up in the debug overlay. */
    validate() { return null; }

    /* How many outbound frames executing this will consume. */
    frameCost() { return this.cost; }

    describe() { return this.kind + '<' + this.source + '>'; }
}

/* Build one item at one angle. Auto Place, Preplace, Replace, Spike Tick and
 * Auto Mills all produce this shape; only their urgency and reasons differ. */
class PlacementIntent extends Intent {
    constructor(opts) {
        /* A build costs: select item, attack down, attack up, reselect weapon. */
        super('Placement', Object.assign({ cost: 4 }, opts));
        this.candidate = opts.candidate;
        this.itemId = opts.candidate.itemId;
        this.angle = opts.candidate.angle;
        this.reason = opts.reason || opts.candidate.reasons.join(',');
        /* Placement origin the candidate was computed against; null means the
         * player's live position. */
        this.origin = opts.origin || null;
        this.releaseAt = opts.releaseAt || 0;
    }

    validate() {
        if (!GameState.inGame || !GameState.self || !GameState.self.alive) return 'not-in-game';
        if (GameState.isItemLimit(this.itemId)) return 'item-limit';
        if (this.target && (!this.target.visible || !this.target.alive)) return 'target-gone';
        if (!PlacementEngine.stillValid(this.candidate, this.origin)) return 'position-blocked';
        const maxAge = Config.get('placement.maxIntentAgeTicks');
        if (GameState.tick - this.createdTick > maxAge) return 'stale';
        return null;
    }

    describe() { return 'Place[' + (Defs.items[this.itemId] || {}).name + ']<' + this.source + '>'; }
}

/* Replace a specific existing object with a new one, once it breaks. Carries
 * the object it is replacing so the Arbiter can drop it the moment that object
 * turns out to survive. */
class ReplaceIntent extends PlacementIntent {
    constructor(opts) {
        super(opts);
        this.kind = 'Replace';
        this.doomedObject = opts.doomedObject;
        this.doomedSid = opts.doomedObject ? opts.doomedObject.sid : null;
    }

    validate() {
        /* The replacement is only correct while the thing it replaces is still
         * there and still doomed. If it already broke, the ordinary placement
         * path owns that spot now. */
        if (this.doomedSid != null && !GameState.objects.has(this.doomedSid)) return 'already-broken';
        const base = super.validate();
        /* The doomed object is expected to be in the way -- that is the point --
         * so a blocked position is only fatal once it is gone. */
        if (base === 'position-blocked') return null;
        return base;
    }

    describe() { return 'Replace[' + (Defs.items[this.itemId] || {}).name + ']<' + this.source + '>'; }
}

/* Swing at a target. */
class AttackIntent extends Intent {
    constructor(opts) {
        /* select weapon, attack down, attack up. */
        super('Attack', Object.assign({ cost: 3 }, opts));
        this.slot = opts.slot;
        this.weapon = opts.weapon;
        this.hat = opts.hat || null;
        this.angle = opts.angle;
        this.sequence = opts.sequence || null;
    }

    validate() {
        if (!GameState.inGame || !GameState.self || !GameState.self.alive) return 'not-in-game';
        if (this.sequence && this.sequence.dead) return 'sequence-cancelled';
        if (!this.target || !this.target.visible || !this.target.alive) return 'target-gone';
        const step = this.sequence ? this.sequence.current : null;
        if (step && step.validate) return step.validate(this.sequence);
        return null;
    }
}

/* Eat food until a health figure is reached. */
class HealIntent extends Intent {
    constructor(opts) {
        super('Heal', opts);
        this.itemId = opts.itemId;
        this.count = opts.count;
        this.cost = 4 * opts.count;
    }

    validate() {
        if (!GameState.self || !GameState.self.alive) return 'not-in-game';
        if (GameState.self.health >= GameState.self.maxHealth) return 'already-full';
        /* Eating while shamed wastes the food and the tick. */
        if (GameState.self.shameCount >= Config.get('defense.shameCeiling')) return 'shamed';
        return null;
    }
}

/* Wear a hat for defensive reasons. Distinct from the hat attached to an
 * AttackIntent, which is offensive and lasts one swing. */
class DefenseIntent extends Intent {
    constructor(opts) {
        super('Defense', Object.assign({ cost: 1 }, opts));
        this.hat = opts.hat;
        this.reason = opts.reason;
    }

    validate() {
        if (!GameState.self || !GameState.self.alive) return 'not-in-game';
        if (this.hat != null && !GameState.skins[this.hat]) return 'hat-not-owned';
        if (GameState.self.skinIndex === this.hat) return 'already-worn';
        return null;
    }

    describe() { return 'Defense[' + this.reason + ']<' + this.source + '>'; }
}

/* Deliberately do nothing this tick, and say why. Anti Smart Tick uses this to
 * hold a break that would otherwise walk us onto a spike; because it is an
 * intent rather than a flag, it competes on urgency like everything else
 * instead of silently suppressing other modules. */
class HoldIntent extends Intent {
    constructor(opts) {
        super('Hold', Object.assign({ cost: 0 }, opts));
        this.blocks = opts.blocks || [];
        this.reason = opts.reason;
        this.untilTick = opts.untilTick != null ? opts.untilTick : GameState.tick + 1;
    }

    validate() {
        if (GameState.tick > this.untilTick) return 'expired';
        return null;
    }

    describe() { return 'Hold[' + this.reason + ']<' + this.source + '>'; }
}

/* Swing at a structure rather than a player. Breaking is what frees us from a
 * trap and what opens a wall, and it is a different decision from attacking a
 * player: the target does not move, the damage figure is the structure one, and
 * the weapon choice is driven by which slot can finish it in a single hit. */
class BreakIntent extends Intent {
    constructor(opts) {
        /* aim, select weapon, attack down, attack up. */
        super('Break', Object.assign({ cost: 4 }, opts));
        this.object = opts.object;
        this.objectSid = opts.object ? opts.object.sid : null;
        this.slot = opts.slot;
        this.weapon = opts.weapon;
        this.angle = opts.angle;
        this.reason = opts.reason;
    }

    validate() {
        if (!GameState.inGame || !GameState.self || !GameState.self.alive) return 'not-in-game';
        if (this.objectSid == null || !GameState.objects.has(this.objectSid)) return 'object-gone';
        const me = GameState.self;
        const reach = EntityTracker.rangeOf(me, this.slot) + me.scale + this.object.scale;
        if (U.getDistance(me.x2, me.y2, this.object.x, this.object.y) > reach) return 'out-of-reach';
        return null;
    }

    describe() { return 'Break[' + (this.object ? this.object.name : '?') + ']<' + this.source + '>'; }
}

/* Steer. 2yz only ever sends a movement direction when it has a reason to
 * override the player's; the rest of the time the player's own MOVE_DIR passes
 * through untouched. */
class MoveIntent extends Intent {
    constructor(opts) {
        super('Move', Object.assign({ cost: 1 }, opts));
        /* null means "stop", which is a distinct packet (C2S MOVE_STOP). */
        this.angle = opts.angle;
        this.reason = opts.reason;
        this.holdTicks = opts.holdTicks != null ? opts.holdTicks : 1;
    }

    validate() {
        if (!GameState.inGame || !GameState.self || !GameState.self.alive) return 'not-in-game';
        if (GameState.tick - this.createdTick > this.holdTicks) return 'expired';
        return null;
    }

    describe() { return 'Move[' + this.reason + ']<' + this.source + '>'; }
}

/* Take one age upgrade. The index space is the game's own: weapon indices
 * first, then items offset by weapons.length (game_index.js:4734). */
class UpgradeIntent extends Intent {
    constructor(opts) {
        super('Upgrade', Object.assign({ cost: 1 }, opts));
        this.index = opts.index;
        this.label = opts.label;
        this.forAge = opts.forAge;
    }

    validate() {
        if (!GameState.inGame) return 'not-in-game';
        if (GameState.upgradePoints <= 0) return 'no-points';
        /* The offer is only valid for the tier it was made for; taking a stale
         * index would pick whatever now sits at that slot. */
        if (this.forAge !== GameState.upgradeAge) return 'stale-tier';
        return null;
    }

    describe() { return 'Upgrade[' + this.label + ']<' + this.source + '>'; }
}

/* Buy a hat or an accessory. */
class BuyIntent extends Intent {
    constructor(opts) {
        super('Buy', Object.assign({ cost: 1 }, opts));
        this.id = opts.id;
        this.accessory = !!opts.accessory;
        this.price = opts.price;
        this.label = opts.label;
    }

    validate() {
        if (!GameState.inGame) return 'not-in-game';
        const owned = this.accessory ? GameState.tails : GameState.skins;
        if (owned[this.id]) return 'already-owned';
        if (GameState.resources.points < this.price) return 'too-expensive';
        return null;
    }

    describe() { return 'Buy[' + this.label + ']<' + this.source + '>'; }
}

/* Respawn, replaying the payload the game itself sent. */
class SpawnIntent extends Intent {
    constructor(opts) {
        super('Spawn', Object.assign({ cost: 1 }, opts));
        this.payload = opts.payload;
    }

    validate() {
        if (GameState.inGame) return 'already-alive';
        if (!this.payload) return 'no-payload';
        if (!Transport.isReady()) return 'socket-not-ready';
        return null;
    }
}

/* Flip one of the game's own toggles (auto-gather, direction lock). */
class ToggleIntent extends Intent {
    constructor(opts) {
        super('Toggle', Object.assign({ cost: 1 }, opts));
        this.which = opts.which;   // 0 = lock direction, 1 = auto gather
        this.desired = opts.desired;
        this.reason = opts.reason;
    }

    validate() {
        if (!GameState.inGame || !GameState.self || !GameState.self.alive) return 'not-in-game';
        if (this.which === 1 && GameState.input.autoGather === this.desired) return 'already-set';
        return null;
    }

    describe() { return 'Toggle[' + this.reason + ']<' + this.source + '>'; }
}

/* Say something. The game truncates at 30 characters (game_index.js:4451), so
 * so does this. */
class ChatIntent extends Intent {
    constructor(opts) {
        super('Chat', Object.assign({ cost: 1 }, opts));
        this.text = String(opts.text).slice(0, 30);
        this.reason = opts.reason;
    }

    validate() {
        if (!GameState.inGame) return 'not-in-game';
        if (!this.text) return 'empty';
        return null;
    }

    describe() { return 'Chat[' + this.reason + ']<' + this.source + '>'; }
}
