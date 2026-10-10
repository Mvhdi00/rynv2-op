// Ryn's sparring partner: a server-side player that fights you the way a person does.
// It has no connection, so it is given a person's limits on purpose: it sees you
// late (its ping plus a reaction time), aims with an error, and only knows what a
// client could see (your position, weapon, hat, health, a trap under you, the swing
// of your weapons). Everything it does goes through the same Player code as you:
// hats, weapon switches that reload only while held, eating (shame included),
// spikes and traps placed in front of it, the insta of bull hat + polearm then
// musket.
module.exports = function (tools) {
	const { UTILS, config, items, hatById, time, server } = tools

	const LEVELS = {
		easy: { react: 380, aimErr: 0.2, mistake: 0.18, insta: 0, spikes: false, traps: false, antiInsta: false, healAt: 45, healDelay: 420, strafe: 0.35, kite: false, spikePush: false, hatSwap: false, food: 0 },
		normal: { react: 250, aimErr: 0.11, mistake: 0.09, insta: 0.35, spikes: true, traps: false, antiInsta: true, healAt: 55, healDelay: 280, strafe: 0.6, kite: true, spikePush: false, hatSwap: true, food: 1 },
		hard: { react: 170, aimErr: 0.06, mistake: 0.04, insta: 0.7, spikes: true, traps: true, antiInsta: true, healAt: 62, healDelay: 190, strafe: 0.8, kite: true, spikePush: true, hatSwap: true, food: 1 },
		pro: { react: 110, aimErr: 0.03, mistake: 0.015, insta: 0.95, spikes: true, traps: true, antiInsta: true, healAt: 68, healDelay: 135, strafe: 1, kite: true, spikePush: true, hatSwap: true, food: 1 }
	}
	const STYLES = {
		classic: { primary: 5, secondary: 15, label: 'polearm + musket' },
		hammer: { primary: 4, secondary: 10, label: 'katana + great hammer' },
		bow: { primary: 3, secondary: 12, label: 'short sword + crossbow' },
		daggers: { primary: 7, secondary: 15, label: 'daggers + musket' }
	}
	const NAMES = ['Zyro', 'kaito', 'Nyx', 'pollo', 'ghost', 'Raze', 'mooster', 'Vex', 'lumi', 'sigma', 'Kairo', 'yuno']
	const TIER_XP = { normal: 0, gold: 3000, diamond: 7000, ruby: 12000, emerald: 30000 }
	const SOLDIER = 6
	const BULL = 7
	const BOOSTER = 12
	const SPIKES = 7
	const TRAP = 15
	const TICK = () => 1000 / config.serverUpdateRate

	const rand = (a, b) => a + Math.random() * (b - a)
	const angDiff = (a, b) => Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI)
	const weapon = id => items.weapons[id]
	const reachOf = (id, other) => (weapon(id) && weapon(id).range ? weapon(id).range : 0) + (other ? other.scale : 35)
	const variantVal = xp => {
		let v = 1
		for (const w of config.weaponVariants) if ((xp || 0) >= w.xp) v = w.val
		return v
	}

	function setup(d, opts) {
		const level = LEVELS[opts.level] ? opts.level : 'normal'
		let style = STYLES[opts.style] ? opts.style : 'classic'
		if (opts.style === 'random') style = Object.keys(STYLES)[UTILS.randInt(0, Object.keys(STYLES).length - 1)]
		d.spar = {
			level: level,
			L: LEVELS[level],
			style: style,
			ping: Math.max(0, Math.min(400, Number(opts.ping) || 80)),
			targetSid: opts.target,
			hist: [],
			oppSwing: {},
			insta: 0,
			strafe: 1,
			strafeUntil: 0,
			nextSpike: 0,
			nextTrap: 0,
			lastHp: 100,
			hurtAt: -1e9,
			score: d.spar ? d.spar.score : { bot: 0, you: 0 },
			said: -1e9
		}
		d.opts.primary = STYLES[style].primary
		d.opts.secondary = STYLES[style].secondary
		d.opts.tier = opts.tier || (level === 'easy' ? 'gold' : level === 'normal' ? 'diamond' : 'ruby')
		d.opts.hat = SOLDIER
		d.opts.heal = false
		if (!opts.name) d.name = NAMES[UTILS.randInt(0, NAMES.length - 1)]
	}

	// after (re)spawning: a full kit and resources, like a player who has played a while
	function equip(d) {
		const p = d.p
		const S = d.spar
		p.items = [S.L.food ? 1 : 0, 3, SPIKES, 10, TRAP]
		p.wood = p.food = p.stone = 99999
		p.points = 99999
		p.weaponXP[d.opts.primary] = TIER_XP[d.opts.tier] || 0
		p.weaponXP[d.opts.secondary] = TIER_XP[d.opts.tier] || 0
		p.skin = hatById(SOLDIER)
		p.skinIndex = SOLDIER
		S.insta = 0
		S.hist = []
		S.lastHp = p.health
	}

	function say(d, lines) {
		const S = d.spar
		if (time.clock - S.said < 4000 || Math.random() < 0.35) return
		S.said = time.clock
		server.sendAll('ch', [d.p.sid, lines[UTILS.randInt(0, lines.length - 1)]])
	}

	const opponentOf = (d, players) => {
		const S = d.spar
		if (S.targetSid !== undefined) {
			const t = players.find(q => q.sid === S.targetSid)
			return t && t.alive ? t : null
		}
		let best = null
		let bestD = 2500
		for (const q of players) {
			if (q === d.p || !q.alive || q.rynDummy) continue
			const dd = UTILS.getDistance(d.p.x, d.p.y, q.x, q.y)
			if (dd < bestD) {
				bestD = dd
				best = q
			}
		}
		return best
	}

	// what a client would have seen of the opponent, ping + reaction ago
	function observe(d, t) {
		const S = d.spar
		const prev = S.hist[S.hist.length - 1]
		const swings = {}
		for (const w of t.weapons) if (w !== undefined && prev && (t.reloads[w] || 0) > (prev.reloads[w] || 0) + 1) swings[w] = time.tick
		Object.assign(S.oppSwing, swings)
		S.hist.push({
			tick: time.tick,
			x: t.x,
			y: t.y,
			xVel: t.xVel,
			yVel: t.yVel,
			dir: t.dir,
			w: t.weaponIndex,
			hat: t.skinIndex,
			hp: t.health,
			trapped: !!t.lockMove,
			reloads: Object.assign({}, t.reloads),
			swing: Object.assign({}, S.oppSwing)
		})
		if (S.hist.length > 40) S.hist.shift()
		const late = Math.round((S.ping + S.L.react * rand(0.8, 1.25)) / TICK())
		return S.hist[Math.max(0, S.hist.length - 1 - late)]
	}

	function placeAt(p, itemId, angle) {
		const item = items.list[itemId]
		const keep = p.dir
		p.dir = angle
		p.buildItem(item)
		p.dir = keep
	}

	function nearObjects(objects, x, y, r, test) {
		const out = []
		for (const o of objects) if (o.active && test(o) && Math.abs(o.x - x) <= r && Math.abs(o.y - y) <= r && UTILS.getDistance(o.x, o.y, x, y) <= r) out.push(o)
		return out
	}

	function think(d, delta, players, objects) {
		const p = d.p
		const S = d.spar
		const L = S.L
		const t = opponentOf(d, players)
		p.mouseState = 0
		p.gathering = 0
		p.moveDir = undefined
		if (!t) {
			// nobody to fight: wait where it is, soldier on
			S.mode = 'waiting'
			S.hist = []
			p.skin = hatById(SOLDIER)
			p.skinIndex = SOLDIER
			return
		}
		// you respawned far away: come find you instead of crossing the whole map
		const far = UTILS.getDistance(p.x, p.y, t.x, t.y)
		if (far > 2200) {
			S.farFor = (S.farFor || 0) + delta
			if (S.farFor > 2500) {
				S.farFor = 0
				const a = UTILS.randFloat(-Math.PI, Math.PI)
				p.x = Math.max(100, Math.min(config.mapScale - 100, t.x + 750 * Math.cos(a)))
				p.y = Math.max(100, Math.min(config.mapScale - 100, t.y + 750 * Math.sin(a)))
				p.xVel = p.yVel = 0
				S.hist = []
			}
		} else {
			S.farFor = 0
		}
		const v = observe(d, t)
		const primary = d.opts.primary
		const secondary = d.opts.secondary
		const wP = weapon(primary)
		const wS = weapon(secondary)
		const dist = UTILS.getDistance(p.x, p.y, v.x, v.y)
		const toOpp = UTILS.getDirection(v.x, v.y, p.x, p.y)
		// lead the target by where it was going, then miss a little like a hand does
		const lead = 1.2
		const aimX = v.x + v.xVel * TICK() * lead
		const aimY = v.y + v.yVel * TICK() * lead
		const aim = UTILS.getDirection(aimX, aimY, p.x, p.y) + rand(-1, 1) * L.aimErr
		const myReach = reachOf(primary, t) - 6
		const ready = id => !(p.reloads[id] > 0)
		const hp = p.health
		const tick = time.tick
		const slip = () => Math.random() < L.mistake

		// what the opponent can do to me, from what I saw
		const oppPrimary = t.weapons[0]
		const oppSecondary = t.weapons[1]
		const oppReach = reachOf(oppPrimary, p) + 12
		const seenReady = id => {
			const at = v.swing[id]
			return at === undefined || (v.tick - at) * TICK() >= (weapon(id) ? weapon(id).speed || 0 : 0)
		}
		const oppMusket = oppSecondary === 15 || oppSecondary === 9 || oppSecondary === 12 || oppSecondary === 13
		const instaThreat = dist < oppReach + 70 && (v.hat === BULL || (oppMusket && seenReady(oppPrimary) && seenReady(oppSecondary)))

		// my own health: notice a hit after a reaction time, never eat inside the 120ms shame window
		if (hp < S.lastHp - 0.5) S.hurtAt = time.clock
		S.lastHp = hp

		// ---- insta in progress ----
		if (S.insta === 1) {
			S.mode = 'insta'
			p.weaponIndex = secondary
			p.dir = aim
			p.mouseState = 1
			p.gathering = 1
			S.insta = 2
			return
		}
		if (S.insta === 2) {
			S.insta = 0
			p.weaponIndex = primary
			p.skin = hatById(SOLDIER)
			p.skinIndex = SOLDIER
		}

		// ---- eat ----
		let healAt = L.healAt
		if (L.antiInsta && instaThreat) healAt = Math.max(healAt, 82)
		const canEat = p.shameTimer <= 0 && Date.now() - (p.hitTime || 0) > 125 && time.clock - S.hurtAt >= L.healDelay
		S.mode = 'fighting'
		if (hp < healAt && canEat && !slip()) {
			p.buildItem(items.list[p.items[0]])
			p.buildIndex = -1
			S.mode = 'healing'
		}

		// ---- hats: soldier in a fight, booster to chase, bull on the tick it hits ----
		const hat = dist > 520 ? BOOSTER : SOLDIER
		p.skin = hatById(hat)
		p.skinIndex = hat
		p.weaponIndex = primary

		// ---- trapped: break out ----
		if (p.lockMove) {
			const traps = nearObjects(objects, p.x, p.y, 90, o => o.trap && o.owner !== p)
			if (traps.length) {
				const tr = traps[0]
				// the hammer breaks traps fastest; otherwise whichever weapon is ready
				const hammer = secondary === 10 ? secondary : null
				if (hammer !== null && ready(hammer)) p.weaponIndex = hammer
				else if (ready(primary)) p.weaponIndex = primary
				else p.weaponIndex = hammer !== null ? hammer : primary
				p.dir = UTILS.getDirection(tr.x, tr.y, p.x, p.y)
				p.mouseState = 1
				p.gathering = 1
				S.mode = 'breaking a trap'
				return
			}
		}

		// ---- weapons ----
		p.dir = aim
		const musketInsta = wS && wS.projectile === 5 && L.insta > 0
		const killable = v.hp <= (wP.dmg * 1.5 * variantVal(p.weaponXP[primary]) + 50) * (v.hat === SOLDIER ? 0.75 : 1)
		if (musketInsta && ready(primary) && ready(secondary) && dist <= myReach && dist > 70 && angDiff(aim, toOpp) < 0.5) {
			const go = killable ? Math.random() < L.insta : v.trapped ? Math.random() < L.insta * 0.8 : Math.random() < L.insta * 0.06
			if (go && !slip()) {
				p.skin = hatById(BULL)
				p.skinIndex = BULL
				p.weaponIndex = primary
				p.mouseState = 1
				p.gathering = 1
				S.insta = 1
				S.mode = 'insta'
				say(d, ['ez', 'gg', 'too slow', 'sit'])
				return
			}
		}
		let attacking = false
		if (ready(primary) && dist <= myReach && angDiff(aim, toOpp) < 0.6) {
			attacking = true
			if (L.hatSwap) {
				p.skin = hatById(BULL)
				p.skinIndex = BULL
			}
		} else if (wS && wS.projectile !== undefined && wS.projectile !== 5 && ready(secondary) && dist > myReach && dist < 650) {
			// crossbow style: poke from range
			p.weaponIndex = secondary
			attacking = true
		} else if (!ready(secondary) && dist < 420 && !(ready(primary) && dist <= myReach + 40)) {
			// a weapon only reloads while it is held, so hold the one that still needs it,
			// but not while chasing: the musket is slow to carry
			p.weaponIndex = secondary
		}
		if (attacking && !slip()) {
			p.mouseState = 1
			p.gathering = 1
		}

		// ---- spikes and traps ----
		if (L.traps && tick >= S.nextTrap && dist < 165 && dist > 70 && !v.trapped && !attacking) {
			S.mode = 'trapping'
			placeAt(p, TRAP, toOpp)
			S.nextTrap = tick + Math.round(rand(2800, 4200) / TICK())
		} else if (L.spikes && tick >= S.nextSpike && dist < 230 && !attacking) {
			placeAt(p, SPIKES, toOpp + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1))
			S.nextSpike = tick + Math.round(rand(1300, 2400) / TICK())
		}

		// ---- movement ----
		let mx = 0
		let my = 0
		const toward = (x, y, w) => {
			const a = UTILS.getDirection(x, y, p.x, p.y)
			mx += Math.cos(a) * w
			my += Math.sin(a) * w
		}
		const lowAndStuck = hp < 35 && !canEat
		let want
		if (lowAndStuck) want = 480
		else if (ready(primary) || !L.kite) want = myReach - 18
		else want = Math.max(oppReach + 28, myReach + 20)
		if (S.mode === 'fighting') S.mode = lowAndStuck ? 'backing off' : attacking ? 'hitting' : dist > want + 40 ? 'closing in' : ready(primary) ? 'looking for a hit' : 'reloading, spacing'
		// spike push: stand so my hit knocks them into my spike
		let pushing = false
		if (L.spikePush && ready(primary)) {
			const mine = nearObjects(objects, v.x, v.y, 260, o => o.owner === p && o.dmg)
			if (mine.length) {
				const s = mine[0]
				const away = UTILS.getDirection(v.x, v.y, s.x, s.y)
				toward(v.x + Math.cos(away) * (myReach - 25), v.y + Math.sin(away) * (myReach - 25), 1.4)
				pushing = true
				if (S.mode === 'looking for a hit' || S.mode === 'closing in') S.mode = 'lining up a spike push'
			}
		}
		if (!pushing) {
			const gap = dist - want
			if (Math.abs(gap) > 12) toward(v.x, v.y, Math.max(-1, Math.min(1, gap / 120)))
		}
		// strafe like a person: change side every so often, more when a musket is pointed at me
		if (time.clock >= S.strafeUntil) {
			S.strafe = Math.random() < 0.5 ? -1 : 1
			S.strafeUntil = time.clock + rand(500, 1500)
		}
		const aimed = oppMusket && v.w === oppSecondary && angDiff(v.dir, UTILS.getDirection(p.x, p.y, v.x, v.y)) < 0.3
		const side = toOpp + (Math.PI / 2) * S.strafe
		const strafeW = L.strafe * (aimed ? 1.2 : dist < 400 ? 0.55 : 0.2)
		mx += Math.cos(side) * strafeW
		my += Math.sin(side) * strafeW
		// keep off enemy spikes
		for (const o of nearObjects(objects, p.x, p.y, 170, o => o.dmg && o.owner !== p)) {
			const a = UTILS.getDirection(p.x, p.y, o.x, o.y)
			const k = (170 - UTILS.getDistance(p.x, p.y, o.x, o.y)) / 170
			mx += Math.cos(a) * 2 * k
			my += Math.sin(a) * 2 * k
		}
		if (Math.hypot(mx, my) > 0.15) p.moveDir = Math.atan2(my, mx)
	}

	function kill(d, victim, killer) {
		// called when someone in a duel dies; keeps score and a little chat
		const S = d.spar
		if (!S) return
		if (victim === d.p) {
			S.score.you++
			say(d, ['gg', 'gg wp', 'nice one', 'ok you got me'])
		} else if (killer === d.p) {
			S.score.bot++
			S.said = 0
			say(d, ['gg', 'ez', 'gg wp', 'again?'])
		}
	}

	return { LEVELS: LEVELS, STYLES: STYLES, setup: setup, equip: equip, think: think, kill: kill }
}
