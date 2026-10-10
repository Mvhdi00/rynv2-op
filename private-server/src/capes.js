// Accessories whose effect the game only gives in its store text ("5% faster", "no snow
// slowdown", ...). The game's files carry the code for every other hat and accessory
// property, but not for these, so they follow the text. Two amounts are not in the text
// and are ours: Thorns heals 10% of the damage of the hit, Devils Tail bleeds 5 a second.
//
// config.storeEffects = false turns them off, with the Emerald tier's lifesteal (also only
// in the game's data): tools/server-parity.js compares everything else with the game's code.
var SUPER = 1
var DRAGON = 2
var COOKIE = 3
var SKULL = 4
var DASH = 5
var WINTER = 6
var TROLL = 7
var COW = 8
var TREE = 9
var STONE = 10
var SNOWBALL = 12
var THORNS = 14
var BLOCKADES = 15
var DEVIL = 20

var SUPER_MS = 10000
var DRAGON_MS = 5000

module.exports = function (config) {
	var on = function () {
		return config.storeEffects !== false
	}
	var wears = function (p, id) {
		return !!(p && p.tail && p.tailIndex === id) && on()
	}
	var capes = {
		on: on,
		wears: wears,
		// time-limited buffs run on game time, so they stop when the world is paused
		tick: function (p, delta) {
			if (p.capeSuper > 0) p.capeSuper -= delta
			if (p.capeDragon > 0) p.capeDragon -= delta
		},
		speed: function (p) {
			return (wears(p, DASH) ? 1.05 : 1) * (wears(p, SUPER) && p.capeSuper > 0 ? 1.15 : 1)
		},
		snow: function (p) {
			if (wears(p, WINTER)) return 1
			if (wears(p, SNOWBALL)) return 1 - (1 - config.snowSpeed) / 2
			return config.snowSpeed
		},
		// damage a player deals, melee or shot
		damage: function (p) {
			return (wears(p, SUPER) && p.capeSuper > 0 ? 1.05 : 1) * (wears(p, DRAGON) && p.capeDragon > 0 ? 1.05 : 1)
		},
		hitPlayer: function (p) {
			if (wears(p, DRAGON)) p.capeDragon = DRAGON_MS
		},
		killed: function (p) {
			if (wears(p, SUPER)) p.capeSuper = SUPER_MS
		},
		// resource type: 0 wood (tree), 1 food (bush, cactus), 2 stone (rock)
		gather: function (p, type) {
			if (type === 0 && wears(p, TREE)) return 1
			if (type === 1 && wears(p, COOKIE)) return 1
			if (type === 2 && wears(p, STONE)) return 1
			return 0
		},
		// gold for a kill: the kill leader (the crown) and kills by your spikes
		killGold: function (doer, victim, src) {
			var mult = 1
			if (wears(doer, SKULL) && victim.iconIndex === 1) mult *= 3
			if (wears(doer, TROLL) && src && src.isItem && src.dmg && src.owner === doer) mult *= 2
			return mult
		},
		// gold and food for a cow
		cow: function (doer, ai) {
			return ai.index === 0 && wears(doer, COW) ? 1.5 : 1
		},
		shotTaken: function (p) {
			return wears(p, BLOCKADES) ? 0.75 : 1
		},
		thorns: function (p) {
			return wears(p, THORNS) ? 0.1 : 0
		},
		bleed: function (doer, target) {
			if (!wears(doer, DEVIL) || !target.dmgOverTime) return
			// a longer poison stays
			if (target.dmgOverTime.dmg && target.dmgOverTime.time > 2) return
			target.dmgOverTime.dmg = 5
			target.dmgOverTime.time = 2
			target.dmgOverTime.doer = doer
		}
	}
	return capes
}
