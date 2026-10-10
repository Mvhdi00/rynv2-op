// Ryn's side of the private server: admin commands, test dummies, time control,
// stats and the combat log, the map editor, world saves, scenarios, rules and the
// Crab King's controls. index.js hands the server's state over through ctx; its
// getters always return the current arrays.
module.exports = function (ctx) {
	const UTILS = ctx.UTILS
	const config = ctx.config
	const items = ctx.items
	const hats = ctx.hats
	const accessories = ctx.accessories
	const server = ctx.server

	const time = { paused: false, scale: 1, steps: 0, tick: 0, clock: 0 }
	const rules = { dmgMult: 1, gatherMult: 1 }
	const king = { speed: 1, damage: 1 }
	config.rynRules = rules
	config.rynKing = king
	const log = []
	let dummies = []
	let dummyCount = 0

	const ANIMALS = { cow: 0, pig: 1, bull: 2, bully: 3, wolf: 4, duck: 5, quack: 5, moostafa: 6, treasure: 7, moofie: 8, boar: 9, yeti: 10, king: 11, crabking: 11, sheep: 12, crab: 13, crabling: 14 }
	const NATURE = { tree: [0, 'treeScales'], bush: [1, 'bushScales'], stone: [2, 'rockScales'], rock: [2, 'rockScales'], gold: [3, null], cactus: [1, 'bushScales'] }
	const TIERS = { normal: 0, gold: 3000, diamond: 7000, ruby: 12000, emerald: 30000 }
	const BEHAVIORS = ['idle', 'walk', 'circle', 'chase', 'attack', 'insta']

	const num = v => (v === undefined || v === '' ? NaN : Number(v))
	const players = () => ctx.players
	const itemByName = name => {
		if (name === undefined) return null
		const n = String(name).toLowerCase().replace(/[_-]/g, ' ')
		if (/^\d+$/.test(n)) return items.list[Number(n)] || null
		return items.list.find(it => it.name === n) || items.list.find(it => it.name.replace(/\s/g, '') === n.replace(/\s/g, '')) || null
	}
	const setHealth = (p, value) => {
		p.health = Math.max(1, Math.min(p.maxHealth, value))
		for (const q of players()) {
			if (p.sentTo[q.id]) server.send(q.id, 'h', [p.sid, Math.round(p.health)])
		}
	}
	const moveTo = (p, x, y) => {
		p.x = x
		p.y = y
		p.xVel = 0
		p.yVel = 0
	}
	const aiName = a => (ctx.aiManager && ctx.aiManager.aiTypes[a.index] && ctx.aiManager.aiTypes[a.index].name) || 'animal'

	// ---- time ----
	const api = {}
	api.time = time
	api.beginTick = function (delta) {
		if (time.paused) {
			if (time.steps > 0) {
				time.steps--
				const step = 1000 / config.serverUpdateRate
				time.tick++
				time.clock += step
				stepProbes()
				return { run: true, delta: step }
			}
			return { run: false, delta: 0 }
		}
		const scaled = delta * time.scale
		time.tick++
		time.clock += scaled
		stepProbes()
		return { run: true, delta: scaled }
	}

	// ---- combat log and stats ----
	// what a hit came from: a weapon, a building (spikes), an animal or nothing
	const sourceOf = (doer, src) => {
		if (src && src.isAI) return { from: src.sid, name: aiName(src), ai: true, kind: 'animal' }
		if (src && src !== doer && src.name && !src.isPlayer) return { from: doer ? doer.sid : null, name: doer ? doer.name : null, ai: false, kind: src.name }
		if (doer && doer.isAI) return { from: doer.sid, name: aiName(doer), ai: true, kind: 'animal' }
		if (doer) return { from: doer.sid, name: doer.name, ai: false, kind: doer.isPlayer ? 'w' + doer.weaponIndex : null }
		return { from: null, name: null, ai: false, kind: null }
	}
	// knockback probes: where a hit player was, then where the next ticks moved it
	const probes = []
	const physics = []
	config.rynHealth = function (target, amount, doer, src) {
		if (amount < 0 && doer && doer.isPlayer && doer !== target && rules.dmgMult !== 1) amount *= rules.dmgMult
		if (amount !== 0) {
			const s = sourceOf(doer, src)
			log.push({
				tick: time.tick,
				at: time.clock,
				to: target.sid,
				toName: target.isAI ? aiName(target) : target.name,
				ai: !!target.isAI,
				from: s.from,
				fromName: s.name,
				fromAi: s.ai,
				kind: s.kind,
				amount: Math.round(amount * 10) / 10,
				hp: Math.max(0, Math.round((target.health + amount) * 10) / 10),
				weapon: doer && doer.isPlayer && doer !== target && s.kind && s.kind[0] === 'w' ? doer.weaponIndex : null
			})
			if (log.length > 400) log.shift()
			if (amount < 0 && !target.isAI && doer !== target && (s.from !== null || s.ai) && !probes.some(p => p.t === target && p.tick === time.tick)) {
				const w = s.kind && s.kind[0] === 'w' ? items.weapons[Number(s.kind.slice(1))] : null
				// the push the server gives: melee 0.3 + the weapon's knock, spikes 1.5, per ms
				let push = null
				if (src === doer && w && w.projectile === undefined) push = 0.3 + (w.knock || 0)
				else if (src && src !== doer && src.dmg && !src.isAI) push = 1.5 * (src.weightM || 1)
				probes.push({ t: target, tick: time.tick, x: target.x, y: target.y, kind: s.kind, push: push, steps: [] })
			}
		}
		return amount
	}
	const stepProbes = function () {
		for (let i = probes.length - 1; i >= 0; i--) {
			const p = probes[i]
			p.steps.push(Math.round(UTILS.getDistance(p.x, p.y, p.t.x, p.t.y)))
			if (p.steps.length >= 6) {
				probes.splice(i, 1)
				const first = p.steps.find(d => d > 0) || 0
				physics.push({
					tick: p.tick,
					name: p.t.name,
					kind: p.kind,
					first: first,
					total: p.steps[p.steps.length - 1],
					// Ryn's model: the first tick moves the push times one 111ms tick
					ryn: p.push === null ? null : Math.round(p.push * 1000 / 9)
				})
				if (physics.length > 12) physics.shift()
			}
		}
	}
	api.physics = () => physics.slice()
	api.log = function (limit) {
		return log.slice(-(limit || 40))
	}
	api.stats = function (me) {
		if (!me) return null
		const now = time.clock
		const mine = log.filter(e => e.from === me.sid && !e.fromAi && e.amount < 0 && !(e.to === me.sid && !e.ai))
		const recent = mine.filter(e => now - e.at <= 5000)
		const dps = recent.reduce((s, e) => s - e.amount, 0) / 5
		// biggest damage on one target inside one tick
		let burst = 0
		const byTick = {}
		for (const e of mine) {
			if (now - e.at > 60000) continue
			const k = e.tick + ':' + (e.ai ? 'a' : 'p') + e.to
			byTick[k] = (byTick[k] || 0) - e.amount
			if (byTick[k] > burst) burst = byTick[k]
		}
		// time to kill: first hit after the target was last at full health, until it hit 0
		const kills = []
		const first = {}
		for (const e of log) {
			const k = (e.ai ? 'a' : 'p') + e.to
			if (e.amount > 0) continue
			if (e.from === me.sid && !e.fromAi && first[k] === undefined) first[k] = e.at
			if (e.hp <= 0 && first[k] !== undefined) {
				kills.push({ name: e.toName, ms: Math.round(e.at - first[k]) })
				delete first[k]
			}
		}
		// heal timing: from damage on me to my next heal
		const heals = []
		let hurtAt = null
		let hurtTick = null
		for (const e of log) {
			if (e.to !== me.sid || e.ai) continue
			if (e.amount < 0 && hurtAt === null) {
				hurtAt = e.at
				hurtTick = e.tick
			} else if (e.amount > 0 && hurtAt !== null) {
				heals.push({ ms: Math.round(e.at - hurtAt), ticks: e.tick - hurtTick })
				hurtAt = null
			}
		}
		// instas: my damage on one target inside two ticks; a kill that way counts as a success
		let instaTries = 0
		let instaKills = 0
		const windows = {}
		for (const e of log) {
			if (e.from !== me.sid || e.fromAi || e.amount >= 0 || (e.to === me.sid && !e.ai)) continue
			const k = (e.ai ? 'a' : 'p') + e.to
			const w = windows[k]
			if (w && e.tick - w.tick <= 1) {
				w.sum -= e.amount
				w.dead = w.dead || e.hp <= 0
			} else {
				if (w && w.sum >= 80) {
					instaTries++
					if (w.dead) instaKills++
				}
				windows[k] = { tick: e.tick, sum: -e.amount, dead: e.hp <= 0 }
			}
		}
		for (const k in windows) {
			if (windows[k].sum >= 80) {
				instaTries++
				if (windows[k].dead) instaKills++
			}
		}
		const lastHeals = heals.slice(-10)
		return {
			tick: time.tick,
			dps: Math.round(dps),
			burst: Math.round(burst),
			kills: kills.slice(-5),
			heals: lastHeals,
			healAvg: lastHeals.length ? Math.round(lastHeals.reduce((s, h) => s + h.ms, 0) / lastHeals.length) : null,
			shame: me.shameCount || 0,
			instaTries: instaTries,
			instaKills: instaKills,
			taken: Math.round(log.filter(e => e.to === me.sid && !e.ai && e.amount < 0 && now - e.at <= 5000).reduce((s, e) => s - e.amount, 0))
		}
	}
	api.clearLog = function () {
		log.length = 0
	}

	// ---- dummies ----
	const nearestTarget = p => {
		let best = null
		let bestD = 1600
		for (const q of players()) {
			if (q === p || !q.alive || q.rynDummy) continue
			const d = UTILS.getDistance(p.x, p.y, q.x, q.y)
			if (d < bestD) {
				bestD = d
				best = q
			}
		}
		return best
	}
	const hatById = id => hats.find(h => h.id === id) || null
	const accById = id => accessories.find(a => a.id === id) || null
	function equipDummy(d) {
		const p = d.p
		const o = d.opts
		const primary = items.weapons[o.primary] && items.weapons[o.primary].type === 0 ? o.primary : 5
		const secondary = items.weapons[o.secondary] && items.weapons[o.secondary].type === 1 ? o.secondary : null
		p.weapons = secondary === null ? [primary] : [primary, secondary]
		p.weaponIndex = primary
		p.weaponXP = []
		p.weaponXP[primary] = TIERS[o.tier] || 0
		if (secondary !== null) p.weaponXP[secondary] = TIERS[o.tier] || 0
		p.items = [o.food === 'cookie' ? 1 : 0, 3, 6, 10, 15]
		p.skin = hatById(o.hat)
		p.skinIndex = p.skin ? o.hat : 0
		p.tail = accById(o.acc)
		p.tailIndex = p.tail ? o.acc : 0
		d.restHat = p.skinIndex
	}
	function respawnDummy(d) {
		const p = d.p
		p.spawn(true)
		p.setData([p.id, p.sid, d.name, d.home.x, d.home.y, 0, 100, 100, config.playerScale, d.opts.skinColor || 0])
		p.rynGod = !!d.opts.god
		equipDummy(d)
		d.brain = { t: 0, wanderT: 0, healAt: null, insta: 0, instaWait: 0, angle: UTILS.randFloat(0, Math.PI * 2) }
	}
	function addDummy(x, y, opts) {
		const sid = ctx.allocSid()
		if (!sid) return null
		const p = ctx.newPlayer('dummy-' + sid + '-' + UTILS.randomString(4), sid)
		p.rynDummy = true
		ctx.players.push(p)
		dummyCount++
		const d = {
			p: p,
			name: (opts && opts.name) || 'Dummy ' + dummyCount,
			behavior: BEHAVIORS.includes(opts && opts.behavior) ? opts.behavior : 'idle',
			home: { x: x, y: y },
			opts: Object.assign({ primary: 5, secondary: null, tier: 'normal', hat: 0, acc: 0, heal: false, healAt: 0.6, healDelay: 120, food: 'apple', god: false }, opts || {}),
			brain: null,
			deadFor: 0
		}
		respawnDummy(d)
		dummies.push(d)
		ctx.updateLeaderboard()
		ctx.iconCallback()
		return d
	}
	function removeDummy(d) {
		const p = d.p
		ctx.objectManager.removeAllItems(p.sid, server)
		const i = ctx.players.indexOf(p)
		if (i >= 0) ctx.players.splice(i, 1)
		ctx.freeSid(p.sid)
		server.sendAll('4', [p.id])
		dummies = dummies.filter(x => x !== d)
	}
	api.clearDummies = function () {
		for (const d of dummies.slice()) removeDummy(d)
		dummyCount = 0
		ctx.updateLeaderboard()
		ctx.iconCallback()
	}
	function steer(p, tx, ty) {
		p.moveDir = UTILS.getDirection(tx, ty, p.x, p.y)
	}
	function thinkDummy(d, delta) {
		const p = d.p
		if (!p.alive) {
			d.deadFor += delta
			if (d.deadFor >= 3000) {
				d.deadFor = 0
				respawnDummy(d)
			}
			return
		}
		const b = d.brain
		b.t += delta
		const target = nearestTarget(p)
		const dist = target ? UTILS.getDistance(p.x, p.y, target.x, target.y) : Infinity
		if (target) p.dir = UTILS.getDirection(target.x, target.y, p.x, p.y)
		p.moveDir = undefined
		const fromHome = UTILS.getDistance(p.x, p.y, d.home.x, d.home.y)
		switch (d.behavior) {
			case 'walk':
				b.wanderT -= delta
				if (b.wanderT <= 0) {
					b.wanderT = UTILS.randInt(900, 2200)
					b.angle = UTILS.randFloat(-Math.PI, Math.PI)
				}
				p.moveDir = fromHome > 350 ? UTILS.getDirection(d.home.x, d.home.y, p.x, p.y) : b.angle
				break
			case 'circle':
				b.angle += delta * 0.0011
				steer(p, d.home.x + 220 * Math.cos(b.angle), d.home.y + 220 * Math.sin(b.angle))
				break
			case 'chase':
			case 'attack':
			case 'insta': {
				const w = items.weapons[p.weapons[0]]
				const reach = w.range + (target ? target.scale : 35)
				if (target && dist > reach * 0.8) steer(p, target.x, target.y)
				break
			}
			default:
				if (fromHome > 60) steer(p, d.home.x, d.home.y)
		}
		p.mouseState = 0
		p.gathering = 0
		if (target && (d.behavior === 'attack' || d.behavior === 'insta')) {
			const w = items.weapons[p.weaponIndex]
			const reach = w.projectile !== undefined ? 700 : w.range + target.scale
			if (d.behavior === 'insta' && p.weapons[1] !== undefined) {
				instaStep(d, dist, target)
			} else if (dist <= reach) {
				p.mouseState = 1
				p.gathering = 1
			}
		}
		if (d.opts.heal && p.health < p.maxHealth * d.opts.healAt) {
			if (b.healAt === null) b.healAt = b.t + d.opts.healDelay
			if (b.t >= b.healAt) {
				const food = items.list[p.items[0]]
				const keep = p.buildIndex
				p.buildItem(food)
				p.buildIndex = keep
				b.healAt = null
			}
		} else {
			b.healAt = null
		}
	}
	// a two-tick insta like a player's: bull hat and the primary, then the secondary
	function instaStep(d, dist, target) {
		const p = d.p
		const b = d.brain
		const primary = p.weapons[0]
		const secondary = p.weapons[1]
		const reach = items.weapons[primary].range + target.scale
		if (b.instaWait > 0) b.instaWait -= 1
		if (b.insta === 0) {
			const ready = !(p.reloads[primary] > 0) && !(p.reloads[secondary] > 0)
			if (ready && b.instaWait <= 0 && dist <= reach) {
				p.skin = hatById(7)
				p.skinIndex = p.skin ? 7 : p.skinIndex
				p.weaponIndex = primary
				p.mouseState = 1
				p.gathering = 1
				b.insta = 1
			}
		} else if (b.insta === 1) {
			p.weaponIndex = secondary
			p.mouseState = 1
			p.gathering = 1
			b.insta = 2
		} else {
			p.weaponIndex = primary
			p.skin = hatById(d.restHat)
			p.skinIndex = p.skin ? d.restHat : 0
			b.insta = 0
			b.instaWait = 8
		}
	}
	api.thinkDummies = function (delta) {
		for (const d of dummies) thinkDummy(d, delta)
	}
	api.dummyCount = () => dummies.length

	// ---- map editor ----
	function placeItem(item, x, y, dir, owner) {
		const obj = ctx.objectManager.add(ctx.objectManager.objects.length, x, y, dir, item.scale, item.type, item, false, owner || null)
		if (owner) {
			if (item.group.limit) owner.changeItemCount(item.group.id, 1)
			if (item.pps) owner.pps += item.pps
		}
		return obj
	}
	function placeNature(kind, x, y) {
		const n = NATURE[kind]
		const scales = n[1] ? config[n[1]] : null
		const scale = scales ? scales[UTILS.randInt(0, scales.length - 1)] : 74
		return ctx.objectManager.add(ctx.objectManager.objects.length, x, y, UTILS.randFloat(-Math.PI, Math.PI), scale, n[0], null, false, null)
	}
	function removeObject(obj) {
		ctx.objectManager.disableObj(obj)
		ctx.objectManager.hitObj(obj, 0)
	}
	api.place = function (what, x, y, owner) {
		const kind = String(what || '').toLowerCase()
		if (NATURE[kind]) return placeNature(kind, x, y) ? kind : null
		const item = itemByName(kind)
		if (!item || item.consume) return null
		placeItem(item, x, y, 0, owner)
		return item.name
	}
	api.removeNear = function (x, y, r) {
		let best = null
		let bestD = r
		for (const o of ctx.gameObjects) {
			if (!o.active) continue
			const d = UTILS.getDistance(x, y, o.x, o.y) - o.scale
			if (d < bestD) {
				bestD = d
				best = o
			}
		}
		if (best) removeObject(best)
		return best ? best.name || 'object' : null
	}
	function clearArea(x, y, r, includeNature) {
		let n = 0
		for (const o of ctx.gameObjects) {
			if (o.active && (includeNature || o.owner) && UTILS.getDistance(x, y, o.x, o.y) <= r) {
				removeObject(o)
				n++
			}
		}
		return n
	}

	// ---- world saves ----
	api.snapshot = function (me) {
		const tag = o => {
			if (!o.owner) return null
			if (me && o.owner === me) return 'me'
			const i = dummies.findIndex(d => d.p === o.owner)
			return i >= 0 ? 'd' + i : null
		}
		return {
			v: 1,
			objects: ctx.gameObjects.filter(o => o.active).map(o => [Math.round(o.x), Math.round(o.y), Math.round(o.dir * 100) / 100, o.scale, o.type, o.id === undefined ? -1 : o.id, tag(o)]),
			dummies: dummies.map(d => ({ x: Math.round(d.p.x), y: Math.round(d.p.y), name: d.name, behavior: d.behavior, opts: d.opts })),
			me: me ? [Math.round(me.x), Math.round(me.y)] : null,
			rules: Object.assign({}, rules),
			king: Object.assign({}, king)
		}
	}
	api.restore = function (me, snap) {
		if (!snap || snap.v !== 1 || !Array.isArray(snap.objects)) return false
		api.clearDummies()
		for (const o of ctx.gameObjects) if (o.active) removeObject(o)
		for (const p of players()) {
			for (let g = 0; g < items.groups.length; g++) if (p.itemCounts && p.itemCounts[g]) p.changeItemAllCount(g, 0)
			p.pps = 0
		}
		const made = (snap.dummies || []).map(s => addDummy(s.x, s.y, Object.assign({}, s.opts, { name: s.name, behavior: s.behavior })))
		for (const [x, y, dir, scale, type, id, owner] of snap.objects) {
			if (id >= 0 && items.list[id]) {
				const o = owner === 'me' ? me : owner && owner[0] === 'd' && made[Number(owner.slice(1))] ? made[Number(owner.slice(1))].p : null
				placeItem(items.list[id], x, y, dir, o)
			} else {
				ctx.objectManager.add(ctx.objectManager.objects.length, x, y, dir, scale, type, null, false, null)
			}
		}
		if (snap.rules) Object.assign(rules, snap.rules)
		if (snap.king) Object.assign(king, snap.king)
		if (me && snap.me) moveTo(me, snap.me[0], snap.me[1])
		return true
	}

	// ---- scenarios ----
	const SCENARIOS = {
		trapped: 'Enemy in your trap with your spikes around it',
		push: 'Enemy in front of your spike line, to knock into it',
		metrapped: 'You in an enemy trap, enemy spikes around, an insta dummy on you',
		surrounded: 'Four dummies attacking you',
		duel: 'One dummy with soldier helmet and auto heal fighting you',
		crab: 'The Crab King arena'
	}
	api.scenarios = () => SCENARIOS
	api.scenario = function (me, name) {
		if (!SCENARIOS[name]) return false
		api.clearDummies()
		clearArea(me.x, me.y, 650, false)
		const a = me.dir
		const at = (r, off) => ({ x: me.x + r * Math.cos(a + (off || 0)), y: me.y + r * Math.sin(a + (off || 0)) })
		const spikes = itemByName('spikes')
		const trap = itemByName('pit trap')
		switch (name) {
			case 'trapped': {
				const c = at(170)
				addDummy(c.x, c.y, { behavior: 'idle', heal: true, hat: 6 })
				placeItem(trap, c.x, c.y, 0, me)
				for (let k = 0; k < 4; k++) {
					const s = k * Math.PI / 2 + Math.PI / 4
					placeItem(spikes, c.x + 98 * Math.cos(a + s), c.y + 98 * Math.sin(a + s), 0, me)
				}
				break
			}
			case 'push': {
				const c = at(170)
				addDummy(c.x, c.y, { behavior: 'idle', heal: true })
				for (let k = -1; k <= 1; k++) {
					const s = at(170 + 90, k * 0.36)
					placeItem(spikes, s.x, s.y, 0, me)
				}
				break
			}
			case 'metrapped': {
				const c = at(160)
				const dm = addDummy(c.x, c.y, { behavior: 'insta', primary: 5, secondary: 15, hat: 6, heal: true })
				if (dm) {
					placeItem(trap, me.x, me.y, 0, dm.p)
					for (let k = 0; k < 3; k++) {
						const s = k * (Math.PI * 2 / 3) + Math.PI / 3
						placeItem(spikes, me.x + 100 * Math.cos(a + s), me.y + 100 * Math.sin(a + s), 0, dm.p)
					}
				}
				break
			}
			case 'surrounded':
				for (let k = 0; k < 4; k++) {
					const c = at(320, k * Math.PI / 2)
					addDummy(c.x, c.y, { behavior: 'attack', primary: [5, 3, 1, 4][k], hat: 6 })
				}
				break
			case 'duel': {
				const c = at(420)
				addDummy(c.x, c.y, { behavior: 'attack', primary: 5, secondary: 10, hat: 6, heal: true, healDelay: 150 })
				break
			}
			case 'crab':
				moveTo(me, -900, config.mapScale / 2)
				break
		}
		return true
	}

	// ---- the Crab King ----
	const kings = () => ctx.ais.filter(a => a.active && a.index === 11)
	api.kings = () => kings().map(k => ({ sid: k.sid, health: Math.round(k.health), maxHealth: k.maxHealth, state: k.state || 0, phase: k.crab ? k.crab.phase : 'idle', dead: !!k.spawnCounter, respawnIn: k.spawnCounter ? Math.round(k.spawnCounter / 1000) : 0 }))

	// ---- state for the panel ----
	api.world = function () {
		return {
			tick: time.tick,
			players: players().filter(p => p.alive).map(p => [p.sid, p.x, p.y, p.scale, p.dir, p.health, p.maxHealth]),
			ais: ctx.ais.filter(a => a.active && a.alive && !a.spawnCounter).map(a => [a.sid, a.index, a.x, a.y, a.scale, a.health, a.maxHealth, a.state || 0])
		}
	}
	api.panelState = function () {
		return {
			time: { paused: time.paused, scale: time.scale, tick: time.tick },
			rules: Object.assign({ sandbox: !!config.inSandbox, tickRate: config.serverUpdateRate }, rules),
			king: Object.assign({}, king),
			kings: api.kings(),
			dummies: dummies.length
		}
	}

	// ---- chat commands (also what the panel sends) ----
	api.command = function (conn, me, text, tell) {
		const args = String(text).trim().split(/\s+/)
		const cmd = (args.shift() || '').toLowerCase()
		const who = v => {
			if (v === undefined) return me
			const p = ctx.findPlayerBySID(parseInt(v))
			if (!p) tell('[Admin] No player with SID ' + v)
			return p
		}
		switch (cmd) {
			case 'help':
				;[
					'!ping <ms> [jitter]  !god [sid]  !heal [sid]  !hp <n> [sid]  !age <n> [sid]  !res <n> [sid]',
					'!hat <id> [sid]  !acc <id> [sid]  !give weapon <id> [tier] [sid]  !give item <id> [sid]',
					'!spawn <animal> [count]  !dummy <idle|walk|circle|chase|attack|insta> [count] [p= s= tier= hat= heal=1 delay= god=1]',
						'!dummy clear | remove <sid> | set <sid> <kind>',
					'!place <item|tree|bush|stone|gold> [count]  !remove  !clearnear <r>',
					'!time pause|play|step [n]|speed <x>  !scenario <name>  !rules dmg|gather|sandbox|tick <v>',
					'!king respawn|attack|hp <n>|speed <x>|damage <x>  !bring <sid>  !arena  !tp <sid>|<x> <y>',
					'!s  !speed <n>  !v <tier>  !dmg [n]  !upgrade <n>  !kill <sid>  !die  !b  !mobs|hostile|bosses on|off'
				].forEach(tell)
				return true
			case 'ping': {
				const ms = Math.max(0, Math.min(2000, num(args[0]) || 0))
				const jitter = Math.max(0, Math.min(1000, num(args[1]) || 0))
				if (typeof conn.rynSetPing !== 'function') {
					tell('[Admin] Fake ping only works inside Ryn')
					return true
				}
				conn.rynSetPing(ms, jitter)
				tell(ms ? '[Admin] Ping ' + ms + 'ms' + (jitter ? ' +-' + jitter + 'ms' : '') : '[Admin] Ping off')
				return true
			}
			case 'spawn': {
				const kind = ANIMALS[(args[0] || '').toLowerCase()]
				if (kind === undefined) {
					tell('[Admin] Animals: ' + Object.keys(ANIMALS).join(' '))
					return true
				}
				const count = Math.max(1, Math.min(20, num(args[1]) || 1))
				const arena = kind === 11 || kind === 13 || kind === 14
				const home = config.secretPool.pool[0]
				const inArena = me.x < 0 && UTILS.inSecretPool(config, me.x, me.y, 100)
				for (let i = 0; i < count; i++) {
					let x = me.x + 300 * Math.cos(me.dir) + UTILS.randInt(-60, 60)
					let y = me.y + 300 * Math.sin(me.dir) + UTILS.randInt(-60, 60)
					if (arena && !(x < 0 && UTILS.inSecretPool(config, x, y, 300))) {
						x = (inArena ? me.x : home[0]) + UTILS.randInt(-150, 150)
						y = (inArena ? me.y : home[1]) + UTILS.randInt(-150, 150)
					}
					const ai = ctx.aiManager.spawn(x, y, me.dir + Math.PI, kind)
					if (kind === 13 || kind === 14) ai.minion = true
				}
				tell('[Admin] Spawned ' + count + ' ' + args[0] + (arena && !inArena ? ' in the Crab King arena' : ''))
				return true
			}
			case 'hp': {
				const p = who(args[1])
				if (p && !isNaN(num(args[0]))) {
					setHealth(p, num(args[0]))
					tell('[Admin] ' + p.name + ' health ' + Math.round(p.health))
				}
				return true
			}
			case 'heal': {
				const p = who(args[0])
				if (p) {
					setHealth(p, p.maxHealth)
					tell('[Admin] Healed ' + p.name)
				}
				return true
			}
			case 'god': {
				const p = who(args[0])
				if (p) {
					p.rynGod = !p.rynGod
					tell('[Admin] God mode ' + (p.rynGod ? 'on' : 'off') + ' for ' + p.name)
				}
				return true
			}
			case 'age': {
				const p = who(args[1])
				const target = Math.min(config.maxAge, num(args[0]))
				if (p && !isNaN(target)) {
					while (p.age < target && p.age < config.maxAge) p.earnXP(p.maxXP - p.XP)
					tell('[Admin] ' + p.name + ' age ' + p.age)
				}
				return true
			}
			case 'res': {
				const p = who(args[1])
				const amount = num(args[0])
				if (p && !isNaN(amount)) {
					for (let type = 0; type < 3; type++) p.addResource(type, amount - p[config.resourceTypes[type]], true)
					p.points = amount
					server.send(p.id, '9', ['points', Math.round(p.points), 1])
					tell('[Admin] ' + p.name + ' resources ' + amount)
				}
				return true
			}
			case 'hat':
			case 'acc': {
				const p = who(args[1])
				const id = num(args[0])
				const tail = cmd === 'acc'
				const item = (tail ? accessories : hats).find(h => h.id === id)
				if (p && !item && id !== 0) tell('[Admin] No ' + (tail ? 'accessory' : 'hat') + ' ' + args[0])
				if (p && (item || id === 0)) {
					if (tail) {
						if (item) p.tails[id] = 1
						p.tail = item || null
						p.tailIndex = id
					} else {
						if (item) p.skins[id] = 1
						p.skin = item || null
						p.skinIndex = id
					}
					if (item) server.send(p.id, 'us', [0, id, tail ? 1 : 0])
					server.send(p.id, 'us', [1, id, tail ? 1 : 0])
					tell('[Admin] ' + p.name + (tail ? ' accessory ' : ' hat ') + (item ? item.name : 'off'))
				}
				return true
			}
			case 'give': {
				const kind = (args[0] || '').toLowerCase()
				if (kind === 'weapon') {
					const w = items.weapons[num(args[1])]
					const tier = TIERS[(args[2] || 'normal').toLowerCase()] !== undefined ? (args[2] || 'normal').toLowerCase() : 'normal'
					const p = who(TIERS[(args[2] || '').toLowerCase()] !== undefined ? args[3] : args[2])
					if (!w) tell('[Admin] No weapon ' + args[1])
					if (p && w) {
						if (p.weapons[w.type] === p.weaponIndex) p.weaponIndex = w.id
						p.weapons[w.type] = w.id
						p.weaponXP[w.id] = TIERS[tier]
						server.send(p.id, '17', [p.weapons, 1])
						tell('[Admin] ' + p.name + ' got ' + w.name + (tier !== 'normal' ? ' (' + tier + ')' : ''))
					}
					return true
				}
				if (kind === 'item') {
					const it = items.list[num(args[1])]
					const p = who(args[2])
					if (!it) tell('[Admin] No item ' + args[1])
					if (p && it) {
						const slot = p.items.findIndex(i => items.list[i] && items.list[i].group.id === it.group.id)
						if (slot >= 0) p.items[slot] = it.id
						else p.items.push(it.id)
						if (p.buildIndex >= 0 && items.list[p.buildIndex] && items.list[p.buildIndex].group.id === it.group.id) p.buildIndex = it.id
						server.send(p.id, '17', [p.items])
						tell('[Admin] ' + p.name + ' got ' + it.name)
					}
					return true
				}
				tell('[Admin] !give weapon <id> [tier] [sid]  or  !give item <id> [sid]')
				return true
			}
			case 'bring': {
				const p = who(args[0])
				if (p && p !== me) {
					moveTo(p, me.x + 80 * Math.cos(me.dir), me.y + 80 * Math.sin(me.dir))
					tell('[Admin] Brought ' + p.name)
				}
				return true
			}
			case 'arena':
				moveTo(me, -900, config.mapScale / 2)
				tell('[Admin] Crab King arena')
				return true
			case 'dummy': {
				const sub = (args[0] || 'idle').toLowerCase()
				if (sub === 'clear') {
					const n = dummies.length
					api.clearDummies()
					tell('[Admin] Removed ' + n + ' dummies')
					return true
				}
				if (sub === 'remove' || sub === 'set') {
					const d = dummies.find(x => x.p.sid === parseInt(args[1]))
					if (!d) {
						tell('[Admin] No dummy with SID ' + args[1])
					} else if (sub === 'remove') {
						removeDummy(d)
						ctx.updateLeaderboard()
						ctx.iconCallback()
						tell('[Admin] Removed ' + d.name)
					} else if (BEHAVIORS.includes(args[2])) {
						d.behavior = args[2]
						d.home = { x: d.p.x, y: d.p.y }
						tell('[Admin] ' + d.name + ' now ' + args[2])
					}
					return true
				}
				if (!BEHAVIORS.includes(sub)) {
					tell('[Admin] Dummy kinds: ' + BEHAVIORS.join(' ') + '  (or !dummy clear | remove <sid> | set <sid> <kind>)')
					return true
				}
				const count = Math.max(1, Math.min(10, num(args[1]) || 1))
				// options as key=value: p (primary) s (secondary) tier hat acc heal delay god food
				const opts = { behavior: sub, hat: sub === 'insta' ? 6 : 0, secondary: sub === 'insta' ? 15 : null }
				for (const pair of args.slice(2)) {
					const [k, v] = pair.split('=')
					if (k === 'p' && !isNaN(num(v))) opts.primary = num(v)
					else if (k === 's') opts.secondary = v === 'none' || isNaN(num(v)) ? null : num(v)
					else if (k === 'tier' && TIERS[v] !== undefined) opts.tier = v
					else if (k === 'hat' && !isNaN(num(v))) opts.hat = num(v)
					else if (k === 'acc' && !isNaN(num(v))) opts.acc = num(v)
					else if (k === 'heal') opts.heal = v === '1' || v === 'on'
					else if (k === 'delay' && !isNaN(num(v))) opts.healDelay = Math.max(0, Math.min(2000, num(v)))
					else if (k === 'god') opts.god = v === '1' || v === 'on'
					else if (k === 'food') opts.food = v
				}
				let made = 0
				for (let i = 0; i < count; i++) {
					const ang = me.dir + (i - (count - 1) / 2) * 0.5
					const d = addDummy(me.x + 260 * Math.cos(ang), me.y + 260 * Math.sin(ang), Object.assign({}, opts))
					if (d) made++
				}
				tell('[Admin] ' + made + ' ' + sub + ' dumm' + (made === 1 ? 'y' : 'ies'))
				return true
			}
			case 'place': {
				const count = Math.max(1, Math.min(12, num(args[1]) || 1))
				let placed = null
				for (let i = 0; i < count; i++) {
					const ang = me.dir + (i - (count - 1) / 2) * 0.45
					const r = me.scale + 70
					placed = api.place(args[0], me.x + r * Math.cos(ang), me.y + r * Math.sin(ang), me) || placed
				}
				tell(placed ? '[Admin] Placed ' + count + ' ' + placed : '[Admin] Nothing called ' + args[0])
				return true
			}
			case 'placeat': {
				const owner = args[3] === 'none' ? null : args[3] ? ctx.findPlayerBySID(parseInt(args[3])) : me
				const placed = api.place(args[0], num(args[1]), num(args[2]), owner)
				tell(placed ? '[Admin] Placed ' + placed : '[Admin] Nothing called ' + args[0])
				return true
			}
			case 'remove':
			case 'removeat': {
				const x = cmd === 'removeat' ? num(args[0]) : me.x + 120 * Math.cos(me.dir)
				const y = cmd === 'removeat' ? num(args[1]) : me.y + 120 * Math.sin(me.dir)
				const gone = api.removeNear(x, y, 90)
				tell(gone ? '[Admin] Removed ' + gone : '[Admin] Nothing there')
				return true
			}
			case 'clearnear': {
				const r = Math.max(50, Math.min(3000, num(args[0]) || 500))
				tell('[Admin] Removed ' + clearArea(me.x, me.y, r, args[1] === 'all') + ' objects')
				return true
			}
			case 'time': {
				const sub = (args[0] || '').toLowerCase()
				if (sub === 'pause') time.paused = true
				else if (sub === 'play') time.paused = false
				else if (sub === 'step') {
					time.paused = true
					time.steps += Math.max(1, Math.min(50, num(args[1]) || 1))
				} else if (sub === 'speed') time.scale = Math.max(0.05, Math.min(4, num(args[1]) || 1))
				tell('[Admin] Time ' + (time.paused ? 'paused' : 'running') + ' at x' + time.scale + ', tick ' + time.tick)
				return true
			}
			case 'scenario': {
				const name = (args[0] || '').toLowerCase()
				if (!api.scenario(me, name)) {
					tell('[Admin] Scenarios: ' + Object.keys(SCENARIOS).join(' '))
					return true
				}
				tell('[Admin] Scenario: ' + SCENARIOS[name])
				return true
			}
			case 'rules': {
				const key = (args[0] || '').toLowerCase()
				const v = num(args[1])
				if (key === 'dmg' && v > 0) rules.dmgMult = Math.min(100, v)
				else if (key === 'gather' && v > 0) rules.gatherMult = Math.min(100, v)
				else if (key === 'sandbox') config.inSandbox = args[1] !== 'off'
				else if (key === 'tick' && v >= 1) ctx.setTickRate(Math.max(1, Math.min(30, v)))
				tell('[Admin] Damage x' + rules.dmgMult + ', gather x' + rules.gatherMult + ', ' + (config.inSandbox ? 'sandbox' : 'normal costs') + ', ' + config.serverUpdateRate + ' ticks/s')
				return true
			}
			case 'king': {
				const sub = (args[0] || '').toLowerCase()
				const list = kings()
				if (sub === 'respawn') {
					if (!list.length) {
						const home = config.secretPool.pool[0]
						ctx.aiManager.spawn(home[0], home[1], Math.PI, 11)
					}
					for (const k of list) {
						if (k.spawnCounter) k.spawnCounter = 1
						k.health = k.maxHealth
						k.crab = null
						k.state = 0
					}
					tell('[Admin] Crab King back at full health')
				} else if (sub === 'attack') {
					for (const k of list) if (k.crab) k.crab.next = 0
					tell('[Admin] Crab King attacks')
				} else if (sub === 'speed' && num(args[1]) > 0) {
					king.speed = Math.min(5, num(args[1]))
					tell('[Admin] Crab King speed x' + king.speed)
				} else if (sub === 'hp' && num(args[1]) > 0) {
				for (const k of list) k.health = Math.min(k.maxHealth, num(args[1]))
				tell('[Admin] Crab King health ' + Math.min(list[0] ? list[0].maxHealth : 0, num(args[1])))
			} else if (sub === 'damage' && num(args[1]) >= 0) {
					king.damage = Math.min(20, num(args[1]))
					tell('[Admin] Crab King damage x' + king.damage)
				} else {
					const k = list[0]
					tell(k ? '[Admin] Crab King ' + Math.round(k.health) + '/' + k.maxHealth + (k.spawnCounter ? ', back in ' + Math.round(k.spawnCounter / 1000) + 's' : ', ' + (k.crab ? k.crab.phase : 'idle')) : '[Admin] No Crab King')
				}
				return true
			}
		}
		return false
	}
	return api
}
