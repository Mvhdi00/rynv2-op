// Ryn's 1v1 opponent: a server-side player that plays to win, at full strength, all the
// time. Every tick it reads the whole fight (both players' health, reloads, hats, traps,
// spikes, the ground around) and picks what wins: an insta when it kills, a trap under
// you and spikes all around it, a boost pad to rush in, a hit that knocks you onto its
// spikes, circling you while it reloads, spikes and traps built where the fight goes, a
// turret near the fight, pre-healing against your insta, breaking out of your traps.
// It plays through the same Player code as you: hats and accessories, weapons that
// reload only while held, eating (never inside the shame window), items placed in front
// of it, and the server's own collisions and knockback.
module.exports = function (tools) {
	const { UTILS, config, items, hatById, accById, time, server, removeObject } = tools

	const NAMES = ['Zyro', 'kaito', 'Nyx', 'pollo', 'ghost', 'Raze', 'mooster', 'Vex', 'lumi', 'sigma', 'Kairo', 'yuno']
	const POLEARM = 5
	const MUSKET = 15
	const GREAT_HAMMER = 10
	const FOOD = 1 // cookie, 40 health
	const WALL = 4 // stone wall
	const SPIKE = 7 // greater spikes
	const TRAP = 15
	const BOOST = 16
	const TURRET = 17
	const HAT = { soldier: 6, bull: 7, booster: 12, tank: 40, emp: 22 }
	const ACC = { monkey: 11, blood: 18, shadow: 19, corrupt: 21 }
	const TIER_XP = 30000 // emerald
	const TICK = () => 1000 / config.serverUpdateRate

	const rand = (a, b) => a + Math.random() * (b - a)
	const angDiff = (a, b) => Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI)
	const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
	const dirTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x)
	const weapon = id => items.weapons[id]
	const reach = (id, targetScale) => (weapon(id) && weapon(id).range ? weapon(id).range : 0) + targetScale
	const placeDist = (p, id) => p.scale + items.list[id].scale + (items.list[id].placeOffset || 0)
	const variantVal = xp => {
		let v = 1
		for (const w of config.weaponVariants) if ((xp || 0) >= w.xp) v = w.val
		return v
	}

	function setup(d, opts) {
		d.spar = {
			targetSid: opts.target,
			score: d.spar ? d.spar.score : { bot: 0, you: 0 },
			said: -1e9,
			combo: [],
			mode: '',
			next: {},
			orbit: 1,
			orbitUntil: 0,
			last: { x: 0, y: 0, at: 0 },
			unstick: null,
			rushUntil: 0,
			afterHit: false
		}
		d.opts.primary = POLEARM
		d.opts.secondary = MUSKET
		d.opts.tier = 'emerald'
		d.opts.hat = HAT.soldier
		d.opts.heal = false
		if (!opts.name) d.name = NAMES[UTILS.randInt(0, NAMES.length - 1)]
	}

	// after (re)spawning: the full kit, like a player who has played a while
	function equip(d) {
		const p = d.p
		p.items = [FOOD, WALL, SPIKE, 12, TRAP, BOOST, TURRET]
		p.wood = p.food = p.stone = 999999
		p.points = 999999
		p.age = Math.max(p.age, 9)
		p.weapons = [POLEARM, MUSKET]
		p.weaponIndex = POLEARM
		p.weaponXP[POLEARM] = TIER_XP
		p.weaponXP[MUSKET] = TIER_XP
		p.weaponXP[GREAT_HAMMER] = TIER_XP
		wear(p, HAT.soldier, ACC.corrupt)
		const S = d.spar
		S.combo = []
		S.next = {}
		S.rushUntil = 0
		S.lastHp = p.health
	}

	function wear(p, hat, acc) {
		if (hat !== undefined && p.skinIndex !== hat) {
			const h = hatById(hat)
			if (h) {
				p.skin = h
				p.skinIndex = hat
			}
		}
		if (acc !== undefined && p.tailIndex !== acc) {
			const a = accById(acc)
			if (a) {
				p.tail = a
				p.tailIndex = acc
			}
		}
	}

	function say(d, lines) {
		const S = d.spar
		if (time.clock - S.said < 4000 || Math.random() < 0.4) return
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
		let bestD = 3000
		for (const q of players) {
			if (q === d.p || !q.alive || q.rynDummy) continue
			const dd = dist(d.p, q)
			if (dd < bestD) {
				bestD = dd
				best = q
			}
		}
		return best
	}

	// ---- the ground around: one pass over the objects near the fight ----
	function survey(p, t, objects) {
		const near = []
		const mine = []
		const theirs = []
		const cx = (p.x + t.x) / 2
		const cy = (p.y + t.y) / 2
		const r = Math.max(700, dist(p, t) / 2 + 500)
		for (const o of objects) {
			if (!o.active || Math.abs(o.x - cx) > r || Math.abs(o.y - cy) > r) continue
			near.push(o)
			if (o.owner === p) mine.push(o)
			else if (o.owner === t) theirs.push(o)
		}
		return { near: near, mine: mine, theirs: theirs }
	}

	// can an item go at angle a in front of p (the server checks objects and water)
	function canPlace(p, id, a, objects) {
		const item = items.list[id]
		const r = placeDist(p, id)
		const x = p.x + r * Math.cos(a)
		const y = p.y + r * Math.sin(a)
		if (x < item.scale || y < item.scale || x > config.mapScale - item.scale || y > config.mapScale - item.scale) return null
		for (const o of objects) {
			if (!o.active) continue
			const blockS = o.blocker ? o.blocker : o.getScale(0.6, o.isItem)
			if (Math.hypot(x - o.x, y - o.y) < item.scale + blockS) return null
		}
		if (y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return null
		if (config.secretPool && (x < 0 || (x < 140 && Math.abs(y - config.mapScale / 2) < config.secretPool.gorgeHalf + 140))) return null
		return { x: x, y: y }
	}

	function place(p, id, a, objects, S, budget) {
		if (S.placed >= budget) return false
		const item = items.list[id]
		if (!canPlace(p, id, a, objects) || !p.canBuild(item)) return false
		const keep = p.dir
		p.dir = a
		p.buildItem(item)
		p.buildIndex = -1
		p.dir = keep
		S.placed++
		return true
	}

	// when a kind of building is at its limit, the one farthest from the fight goes
	function recycle(p, t, mine, id, cap) {
		const group = items.list[id].group
		const same = mine.filter(o => o.group && o.group.id === group.id)
		const limit = Math.min(cap, config.inSandbox ? cap : group.limit || cap)
		if (same.length < limit) return
		same.sort((a, b) => dist(b, t) - dist(a, t))
		removeObject(same[0])
	}

	// where two circles meet: the spots at placing distance from me that sit on a ring around you
	function ringSpots(p, rp, t, rt) {
		const d = dist(p, t)
		if (d > rp + rt || d < Math.abs(rp - rt) || d === 0) return []
		const a = (rp * rp - rt * rt + d * d) / (2 * d)
		const h = Math.sqrt(Math.max(0, rp * rp - a * a))
		const ux = (t.x - p.x) / d
		const uy = (t.y - p.y) / d
		const mx = p.x + a * ux
		const my = p.y + a * uy
		return [
			{ x: mx - h * uy, y: my + h * ux },
			{ x: mx + h * uy, y: my - h * ux }
		]
	}

	function think(d, delta, players, objects) {
		const p = d.p
		const S = d.spar
		p.mouseState = 0
		p.gathering = 0
		p.moveDir = undefined
		S.placed = 0
		const t = opponentOf(d, players)
		if (!t) {
			S.mode = 'waiting for you'
			S.combo = []
			wear(p, HAT.soldier, ACC.shadow)
			return
		}
		// you respawned far away: come find you instead of walking across the map
		const far = dist(p, t)
		if (far > 2200) {
			S.farFor = (S.farFor || 0) + delta
			if (S.farFor > 2500) {
				S.farFor = 0
				const a = UTILS.randFloat(-Math.PI, Math.PI)
				p.x = Math.max(100, Math.min(config.mapScale - 100, t.x + 750 * Math.cos(a)))
				p.y = Math.max(100, Math.min(config.mapScale - 100, t.y + 750 * Math.sin(a)))
				p.xVel = p.yVel = 0
			}
		} else {
			S.farFor = 0
		}

		const now = time.clock
		const tick = TICK()
		const D = dist(p, t)
		const toT = dirTo(p, t)
		const lead = ms => ({ x: t.x + t.xVel * ms, y: t.y + t.yVel * ms })
		const at = lead(tick * 0.6)
		const aim = dirTo(p, at)
		const ready = id => !(p.reloads[id] > 0)
		const rP = ready(POLEARM)
		const rM = ready(MUSKET)
		const myReach = reach(POLEARM, t.scale) - 6
		const tPrimary = t.weapons[0]
		const tSecondary = t.weapons[1]
		const tReady = id => id === undefined || !(t.reloads[id] > 0)
		const tReach = reach(tPrimary, p.scale) + 14
		const tRanged = tSecondary !== undefined && weapon(tSecondary) && weapon(tSecondary).projectile !== undefined
		const tSoldier = t.skinIndex === HAT.soldier ? 0.75 : t.skin && t.skin.dmgMult ? t.skin.dmgMult : 1
		const threat = D < tReach + 90 && (t.skinIndex === HAT.bull || (tReady(tPrimary) && tReady(tSecondary) && tSecondary !== undefined))
		const g = survey(p, t, objects)
		const canEat = p.shameTimer <= 0 && Date.now() - (p.hitTime || 0) > 125
		const hp = p.health
		const trappedMe = !!p.lockMove
		const trappedThem = !!t.lockMove
		const polearmHit = weapon(POLEARM).dmg * 1.5 * variantVal(p.weaponXP[POLEARM])
		const musketHit = items.projectiles[weapon(MUSKET).projectile].dmg
		const cool = key => !(S.next[key] > now)
		const arm = (key, ms) => (S.next[key] = now + ms)
		let hat = D > 650 ? HAT.booster : HAT.soldier
		let acc = D > 650 ? ACC.monkey : ACC.corrupt
		let weaponHeld = POLEARM
		let attack = false
		let aimDir = aim
		S.mode = 'fighting'

		// ---- eating: right after the shame window, earlier when an insta is coming ----
		const healLine = threat ? 86 : trappedMe ? 80 : 64
		if (hp < healLine && canEat) {
			p.buildItem(items.list[FOOD])
			p.buildIndex = -1
			if (hp < 45) S.mode = 'healing'
		}

		// ---- a combo already started finishes first ----
		if (S.combo.length) {
			const step = S.combo.shift()
			if (step === 'musket') {
				weaponHeld = MUSKET
				attack = true
				aimDir = dirTo(p, lead(tick))
				S.mode = 'insta'
			} else if (step === 'polearm') {
				weaponHeld = POLEARM
				hat = HAT.bull
				acc = ACC.blood
				attack = true
				S.mode = 'insta'
			}
		} else if (trappedMe) {
			// ---- caught in your trap: hit you if you are right there, else break out with tank gear ----
			const trap = g.near.find(o => o.trap && o.owner !== p && dist(o, p) < 95)
			if (rP && D <= myReach && angDiff(aim, toT) < 1) {
				hat = HAT.bull
				acc = ACC.blood
				attack = true
				S.mode = 'hitting from the trap'
			} else if (trap) {
				weaponHeld = rP ? POLEARM : MUSKET
				hat = HAT.tank
				aimDir = dirTo(p, trap)
				attack = weaponHeld === POLEARM
				S.mode = 'breaking your trap'
			}
			// spikes around me so you cannot walk in to finish me
			for (let k = 0; k < 6 && S.placed < 1 && cool('guard'); k++) {
				if (place(p, SPIKE, toT + (k - 2.5) * 0.7, objects, S, 1)) arm('guard', 700)
			}
		} else {
			// ---- offence ----
			const expected = (polearmHit + musketHit) * tSoldier
			const killable = t.health <= expected - 3
			const finisher = t.health <= musketHit * tSoldier - 2
			const rushing = now < S.rushUntil
			const aimed = angDiff(aim, toT) < 1.05
			if (rP && rM && D <= myReach && D > 75 && aimed && (killable || trappedThem || rushing || t.shameTimer > 0)) {
				// insta: bull + polearm now, the musket next tick
				hat = HAT.bull
				acc = ACC.blood
				attack = true
				S.combo = ['musket']
				S.mode = 'insta'
				S.rushUntil = 0
				say(d, ['ez', 'too slow', 'sit', 'gg'])
			} else if (rP && rM && D > myReach && D < myReach + 90 && killable && aimed && !trappedThem) {
				// reverse insta: the musket first, then step in with the polearm
				weaponHeld = MUSKET
				attack = true
				aimDir = dirTo(p, lead(tick))
				S.combo = ['polearm']
				S.mode = 'reverse insta'
			} else if (S.afterHit && rM && finisher && D < 650) {
				// the hit left you low: finish with the musket
				weaponHeld = MUSKET
				attack = true
				aimDir = dirTo(p, lead(tick))
				S.mode = 'finishing'
			} else if (rP && D <= myReach && aimed) {
				hat = HAT.bull
				acc = ACC.blood
				attack = true
				S.mode = 'hitting'
			} else if (rM && !rP && D > myReach + 40 && D < 700 && t.health < 100 && Math.hypot(t.xVel, t.yVel) < 0.25) {
				// a musket shot at range when you stand still
				weaponHeld = MUSKET
				attack = true
				aimDir = dirTo(p, lead(tick * 1.2))
				S.mode = 'shooting'
			} else if (!rM && D > tReach + 20) {
				// a weapon only reloads while held: hold the musket while out of your reach
				weaponHeld = MUSKET
			}
		}
		S.afterHit = attack && weaponHeld === POLEARM

		// ---- building: traps under you, spikes around you, boost pads, a field where the fight is ----
		if (!trappedMe) {
			const mySpikes = g.mine.filter(o => o.dmg)
			const myTraps = g.mine.filter(o => o.trap)
			// a trap right under you
			if (!trappedThem && D < 150 && D > 40 && cool('trap')) {
				recycle(p, t, g.mine, TRAP, 6)
				const a = dirTo(p, lead(tick))
				if (place(p, TRAP, a, objects, S, 2)) {
					arm('trap', 1400)
					S.mode = 'trapping you'
				}
			}
			// you are trapped: ring the trap with spikes and circle you (a trap blocks building
			// within its own size, so the ring goes just outside it)
			if (trappedThem && D < 260) {
				S.mode = attack ? S.mode : 'surrounding you'
				const trap = g.near.find(o => o.trap && o.owner !== t && dist(o, t) < 90)
				const center = trap || t
				const radii = trap ? [104, 114] : [90, 100]
				for (const r of radii) {
					for (const spot of ringSpots(p, placeDist(p, SPIKE), center, r)) {
						if (S.placed >= 2) break
						recycle(p, t, g.mine, SPIKE, 15)
						place(p, SPIKE, dirTo(p, spot), objects, S, 2)
					}
				}
			}
			// rush: a boost pad toward you, then ride it in for the insta
			if (!trappedThem && rP && rM && D > 230 && D < 520 && cool('rush') && S.placed < 2) {
				recycle(p, t, g.mine, BOOST, 6)
				if (place(p, BOOST, toT, objects, S, 2)) {
					arm('rush', 3500)
					S.rushUntil = now + 1100
					S.mode = 'rushing in'
				}
			}
			// pressured and reloading: a spike between us
			if (threat && !rP && D < 190 && cool('block') && S.placed < 2) {
				recycle(p, t, g.mine, SPIKE, 15)
				if (place(p, SPIKE, toT + rand(-0.35, 0.35), objects, S, 2)) arm('block', 900)
			}
			// a field of spikes and traps where the fight goes, and a turret near it
			if (D > 260 && S.placed < 1 && cool('field')) {
				const near = mySpikes.filter(o => dist(o, p) < 500).length
				if (near < 6) {
					recycle(p, t, g.mine, SPIKE, 15)
					const side = toT + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.4)
					if (place(p, SPIKE, side, objects, S, 1)) arm('field', 650)
				} else if (myTraps.filter(o => dist(o, p) < 500).length < 2) {
					recycle(p, t, g.mine, TRAP, 6)
					if (place(p, TRAP, toT + rand(-1, 1), objects, S, 1)) arm('field', 650)
				}
			}
			if (D < 900 && cool('turret') && S.placed < 1 && !g.mine.some(o => o.shootRange && dist(o, t) < 700)) {
				recycle(p, t, g.mine, TURRET, 2)
				if (place(p, TURRET, toT + Math.PI + rand(-0.8, 0.8), objects, S, 1)) arm('turret', 6000)
				else arm('turret', 1500)
			}
		}

		// ---- moving ----
		let mx = 0
		let my = 0
		const toward = (x, y, w) => {
			const a = Math.atan2(y - p.y, x - p.x)
			mx += Math.cos(a) * w
			my += Math.sin(a) * w
		}
		if (!trappedMe) {
			const lowAndStuck = hp < 40 && !canEat
			// knock you onto one of my spikes: stand on the far side of you from it
			const pushSpike = rP ? g.mine.find(o => o.dmg && dist(o, t) < 140 && dist(o, p) > dist(o, t)) : null
			if (lowAndStuck || p.shameTimer > 0) {
				S.mode = 'backing off to heal'
				toward(p.x * 2 - t.x, p.y * 2 - t.y, 1.4)
				hat = HAT.booster
				acc = ACC.monkey
				if (cool('cover') && D < 260) {
					if (place(p, SPIKE, toT, objects, S, 2) || place(p, WALL, toT, objects, S, 2)) arm('cover', 500)
				}
			} else if (now < S.rushUntil) {
				toward(t.x, t.y, 1.5)
			} else if (trappedThem) {
				// circle you just inside reach, so every side gets spikes
				const ring = Math.min(myReach - 25, 150)
				const around = toT + Math.PI + S.orbit * 0.9
				toward(t.x + ring * Math.cos(around), t.y + ring * Math.sin(around), 1)
			} else if (pushSpike) {
				const away = dirTo(pushSpike, t)
				toward(t.x + Math.cos(away) * (myReach - 30), t.y + Math.sin(away) * (myReach - 30), 1.3)
				if (S.mode === 'fighting') S.mode = 'lining up a spike push'
			} else if (rP) {
				// come in at an angle, not in a straight line a musket can follow
				const side = toT + S.orbit * 0.45
				const gap = D - (myReach - 20)
				toward(p.x + Math.cos(side) * 100, p.y + Math.sin(side) * 100, Math.max(-1, Math.min(1.2, gap / 80)))
				if (S.mode === 'fighting') S.mode = gap > 60 ? 'closing in' : 'looking for a hit'
			} else {
				// reloading: circle just outside your reach
				const ring = Math.max(tReach + 30, 200)
				const around = Math.atan2(p.y - t.y, p.x - t.x) + S.orbit * 0.5
				toward(t.x + ring * Math.cos(around), t.y + ring * Math.sin(around), 1)
				if (S.mode === 'fighting') S.mode = 'circling, reloading'
			}
			if (now >= S.orbitUntil) {
				S.orbit = Math.random() < 0.5 ? -1 : 1
				S.orbitUntil = now + rand(600, 1700)
			}
			// a musket pointed at me: step sideways
			if (tRanged && t.weaponIndex === tSecondary && tReady(tSecondary) && angDiff(t.dir, dirTo(t, p)) < 0.3) {
				const side = toT + (Math.PI / 2) * S.orbit
				mx += Math.cos(side) * 1.4
				my += Math.sin(side) * 1.4
			}
			// keep off your spikes, slide around trees, rocks and walls
			for (const o of g.near) {
				if (o.owner === p || o.ignoreCollision) continue
				const dd = dist(o, p)
				const room = o.scale * (o.isItem ? 1 : 0.85) + p.scale + (o.dmg && o.owner !== p ? 70 : 30)
				if (dd >= room) continue
				const away = dirTo(o, p)
				const k = (room - dd) / room
				mx += Math.cos(away) * 2.2 * k
				my += Math.sin(away) * 2.2 * k
				// and slide along it toward where I was going
				const tangent = away + Math.PI / 2 * (angDiff(away + Math.PI / 2, Math.atan2(my, mx)) < Math.PI / 2 ? 1 : -1)
				mx += Math.cos(tangent) * 0.8 * k
				my += Math.sin(tangent) * 0.8 * k
			}
			// stuck on something: step aside for a moment
			if (now - S.last.at > 500) {
				const moved = Math.hypot(p.x - S.last.x, p.y - S.last.y)
				if (moved < 12 && Math.hypot(mx, my) > 0.5 && !trappedMe) S.unstick = { until: now + 600, dir: Math.atan2(my, mx) + (Math.random() < 0.5 ? 1.3 : -1.3) }
				S.last = { x: p.x, y: p.y, at: now }
			}
			if (S.unstick && now < S.unstick.until) {
				mx = Math.cos(S.unstick.dir)
				my = Math.sin(S.unstick.dir)
			}
			if (Math.hypot(mx, my) > 0.1) p.moveDir = Math.atan2(my, mx)
		}

		// ---- finally: hands, hat, aim ----
		p.weaponIndex = weaponHeld
		wear(p, hat, acc)
		p.dir = aimDir
		if (attack) {
			p.mouseState = 1
			p.gathering = 1
		}
	}

	function kill(d, victim, killer) {
		// called when someone in a duel dies; keeps score and a little chat
		const S = d.spar
		if (!S) return
		if (victim === d.p) {
			S.score.you++
			S.said = -1e9
			say(d, ['gg', 'gg wp', 'nice one', 'ok you got me'])
		} else if (killer === d.p) {
			S.score.bot++
			S.said = -1e9
			say(d, ['gg', 'ez', 'gg wp', 'again?'])
		}
	}

	return { setup: setup, equip: equip, think: think, kill: kill }
}
