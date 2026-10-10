var PI2 = Math.PI * 2
var Capes = require('./capes.js')
module.exports = function (sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
	var capes = Capes(config)
	this.sid = sid
	this.isAI = true
	this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1)

	// INIT:
	this.init = function (x, y, dir, index, data) {
		this.x = x
		this.y = y
		this.startX = data.fixedSpawn ? x : null
		this.startY = data.fixedSpawn ? y : null
		this.xVel = 0
		this.yVel = 0
		this.zIndex = 0
		this.dir = dir
		this.dirPlus = 0
		this.index = index
		this.src = data.src
		if (data.name) this.name = data.name
		this.weightM = data.weightM
		this.speed = data.speed
		this.baseSpeed = data.speed
		this.killScore = data.killScore
		this.turnSpeed = data.turnSpeed
		this.scale = data.scale
		this.maxHealth = data.health
		this.leapForce = data.leapForce
		this.health = this.maxHealth
		this.chargePlayer = data.chargePlayer
		this.viewRange = data.viewRange
		this.drop = data.drop
		this.dmg = data.dmg
		this.hostile = data.hostile
		this.dontRun = data.dontRun
		this.hitRange = data.hitRange
		this.hitDelay = data.hitDelay
		this.hitScare = data.hitScare
		this.spriteMlt = data.spriteMlt
		this.nameScale = data.nameScale
		this.colDmg = data.colDmg
		this.noTrap = data.noTrap
		this.spawnDelay = data.spawnDelay
		this.minSpawnRange = data.minSpawnRange
		this.maxSpawnRange = data.maxSpawnRange
		this.boss = data.boss
		this.diver = data.diver
		// the Crab King and its crabs live in the arena west of the map
		this.arena = index === 11 || index === 13 || index === 14
		this.state = 0
		this.crab = null
		this.minion = false
		this.owner = null
		this.minions = []
		this.emerge = 0
		this.hitWait = 0
		this.waitCount = 1000
		this.moveCount = 0
		this.targetDir = 0
		this.active = true
		this.alive = true
		this.runFrom = null
		this.chargeTarget = null
		this.dmgOverTime = {}
	}

	// UPDATE:
	var timerCount = 0
	this.update = function (delta) {
		if (this.active) {
			// SPAWN DELAY:
			if (this.spawnCounter) {
				this.spawnCounter -= delta
				if (this.spawnCounter <= 0) {
					this.spawnCounter = 0
					this.respawnAt()
				}
				return
			}

			// REGENS AND AUTO:
			timerCount -= delta
			if (timerCount <= 0) {
				if (this.dmgOverTime.dmg) {
					this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer)
					this.dmgOverTime.time -= 1
					if (this.dmgOverTime.time <= 0) {
						this.dmgOverTime.dmg = 0
					}
				}
				timerCount = 1000
			}

			// BEHAVIOUR:
			// The Crab King runs the game's own animal code below, like MOOSTAFA. Ryn adds the
			// rest (who it fights, its dive, charge and ring, its crabs, see kingThink);
			// config.rynKingExtras = false leaves only the game's code.
			var isKing = this.index === 11
			var extras = this.arena && config.rynKingExtras !== false
			var special = false
			if (isKing && extras) {
				try {
					special = this.kingThink(delta)
				} catch (e) {
					this.crab = null
				}
			}
			// crabs that just came out of the water
			if (this.emerge > 0) {
				this.emerge -= delta
				if (this.emerge <= 0) {
					this.emerge = 0
					this.state = 0
				}
			}
			// arena animals let go of a player who has left the pools (ours), as if the chase ended
			if (extras && this.chargeTarget && !this.fighter(this.chargeTarget)) {
				this.chargeTarget = null
				this.moveCount = 0
				this.waitCount = 1500
			}
			var charging = false
			var slowMlt = 1
			if (!this.zIndex && !this.lockMove && UTILS.inRiver(config, this.x, this.y)) {
				slowMlt = 0.33
				this.xVel += UTILS.riverCurrent(config, this.x) * delta
			}
			if (special) {
				// a dive, charge or ring moves or holds the King itself
			} else if (this.lockMove) {
				this.xVel = 0
				this.yVel = 0
			} else if (this.waitCount > 0) {
				this.waitCount -= delta
				if (this.waitCount <= 0) {
					// the King goes for whoever is in its pools (ours: the game's King has no
					// chargePlayer, so on its own it only wanders and hits back)
					if (this.chargePlayer || (isKing && extras)) {
						var tmpPlayer, bestDst, tmpDist
						for (let i = 0; i < players.length; ++i) {
							if (players[i].alive && !(players[i].skin && players[i].skin.bullRepel) && !(extras && !this.fighter(players[i]))) {
								tmpDist = UTILS.getDistance(this.x, this.y, players[i].x, players[i].y)
								if (tmpDist <= this.viewRange && (!tmpPlayer || tmpDist < bestDst)) {
									bestDst = tmpDist
									tmpPlayer = players[i]
								}
							}
						}
						if (tmpPlayer) {
							this.chargeTarget = tmpPlayer
							this.moveCount = UTILS.randInt(8000, 12000)
						} else {
							this.moveCount = UTILS.randInt(1000, 2000)
							this.targetDir = UTILS.randFloat(-Math.PI, Math.PI)
						}
					} else {
						this.moveCount = UTILS.randInt(4000, 10000)
						this.targetDir = UTILS.randFloat(-Math.PI, Math.PI)
					}
				}
			} else if (this.moveCount > 0) {
				var tmpSpd = this.speed * slowMlt
				if (this.runFrom && this.runFrom.active && !(this.runFrom.isPlayer && !this.runFrom.alive)) {
					this.targetDir = UTILS.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y)
					tmpSpd *= 1.42
				} else if (this.chargeTarget && this.chargeTarget.alive && !(extras && !this.fighter(this.chargeTarget))) {
					this.targetDir = UTILS.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y)
					tmpSpd *= 1.75
					charging = true
				}
				if (this.hitWait) {
					tmpSpd *= 0.3
				}
				if (this.dir != this.targetDir) {
					this.dir %= PI2
					var netAngle = (this.dir - this.targetDir + PI2) % PI2
					var amnt = Math.min(Math.abs(netAngle - PI2), netAngle, this.turnSpeed * delta)
					var sign = netAngle - Math.PI >= 0 ? 1 : -1
					this.dir += sign * amnt + PI2
				}
				this.dir %= PI2
				this.xVel += tmpSpd * delta * Math.cos(this.dir)
				this.yVel += tmpSpd * delta * Math.sin(this.dir)
				this.moveCount -= delta
				if (this.moveCount <= 0) {
					this.runFrom = null
					this.chargeTarget = null
					this.waitCount = this.hostile ? 1500 : UTILS.randInt(1500, 6000)
				}
			}

			// OBJECT COLL:
			var startX = this.x
			var startY = this.y
			this.zIndex = 0
			this.lockMove = false
			var tmpList
			var tmpSpeed = UTILS.getDistance(0, 0, this.xVel * delta, this.yVel * delta)
			var depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)))
			var tMlt = 1 / depth
			for (let i = 0; i < depth; ++i) {
				if (this.xVel) {
					this.x += this.xVel * delta * tMlt
				}
				if (this.yVel) {
					this.y += this.yVel * delta * tMlt
				}
				tmpList = objectManager.getGridArrays(this.x, this.y, this.scale)
				for (let x = 0; x < tmpList.length; ++x) {
					for (let y = 0; y < tmpList[x].length; ++y) {
						if (tmpList[x][y].active) {
							objectManager.checkCollision(this, tmpList[x][y], tMlt)
						}
					}
				}
			}

			// HITTING:
			var hitting = false
			var kingHits = null
			if (this.hitWait > 0) {
				this.hitWait -= delta
				if (this.hitWait <= 0) {
					hitting = true
					this.hitWait = 0
					if (this.leapForce && !UTILS.randInt(0, 2)) {
						this.xVel += this.leapForce * Math.cos(this.dir)
						this.yVel += this.leapForce * Math.sin(this.dir)
					}
					let tmpList = objectManager.getGridArrays(this.x, this.y, this.hitRange)
					let tmpObj, tmpDst
					for (var t = 0; t < tmpList.length; ++t) {
						for (var x = 0; x < tmpList[t].length; ++x) {
							tmpObj = tmpList[t][x]
							if (tmpObj.health) {
								tmpDst = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y)
								if (tmpDst < tmpObj.scale + this.hitRange) {
									if (tmpObj.changeHealth(-this.dmg * 5)) objectManager.disableObj(tmpObj)
									objectManager.hitObj(tmpObj, UTILS.getDirection(this.x, this.y, tmpObj.x, tmpObj.y))
								}
							}
						}
					}
					for (let x = 0; x < players.length; ++x) {
						if (players[x].canSee(this)) {
							server.send(players[x].id, "aa", [this.sid])
						}
					}
				}
			}

			// PLAYER COLLISIONS:
			if (charging || hitting) {
				let tmpObj, tmpDst, tmpDir
				for (let i = 0; i < players.length; ++i) {
					tmpObj = players[i]
					if (tmpObj && tmpObj.alive) {
						tmpDst = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y)
						if (this.hitRange) {
							if (!this.hitWait && tmpDst <= this.hitRange + tmpObj.scale) {
								if (hitting) {
									tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y)
									if (isKing) (kingHits || (kingHits = [])).push(tmpObj.sid)
									tmpObj.changeHealth(-this.dmg * (isKing && extras ? this.kingDamage() : 1), null, this)
									tmpObj.xVel += 0.6 * Math.cos(tmpDir)
									tmpObj.yVel += 0.6 * Math.sin(tmpDir)
									this.runFrom = null
									this.chargeTarget = null
									this.waitCount = 3000
									this.hitWait = !UTILS.randInt(0, 2) ? 600 : 0
								} else this.hitWait = this.hitDelay
							}
						} else if (tmpDst <= this.scale + tmpObj.scale) {
							tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y)
							tmpObj.changeHealth(-this.dmg, null, this)
							tmpObj.xVel += 0.55 * Math.cos(tmpDir)
							tmpObj.yVel += 0.55 * Math.sin(tmpDir)
						}
					}
				}
			}

			// the King's own hit: shown before it lands, counted for Ryn's dodge stats
			if (isKing && extras) {
				if (hitting) this.kingAttackDone("slam", kingHits || [])
				this.kingWarnHit()
			}

			// DECEL:
			if (this.xVel) {
				this.xVel *= Math.pow(config.playerDecel, delta)
			}
			if (this.yVel) {
				this.yVel *= Math.pow(config.playerDecel, delta)
			}

			// MAP BOUNDARIES:
			var tmpScale = this.scale
			if (this.arena) {
				// the King and its crabs stay in the pools, all of their body; they slide
				// along the edge
				var fits = function (x, y) {
					return UTILS.inArenaPools(config, x, y, tmpScale)
				}
				if (!fits(this.x, this.y)) {
					if (fits(this.x, startY)) {
						this.y = startY
						this.yVel = 0
					} else if (fits(startX, this.y)) {
						this.x = startX
						this.xVel = 0
					} else if (fits(startX, startY)) {
						this.x = startX
						this.y = startY
						this.xVel = 0
						this.yVel = 0
					} else {
						var home = config.secretPool.pool[0]
						this.x = home[0]
						this.y = home[1]
						this.xVel = 0
						this.yVel = 0
					}
				}
			} else if (this.x - tmpScale < 0) {
				this.x = tmpScale
				this.xVel = 0
			} else if (this.x + tmpScale > config.mapScale) {
				this.x = config.mapScale - tmpScale
				this.xVel = 0
			}
			if (this.y - tmpScale < 0) {
				this.y = tmpScale
				this.yVel = 0
			} else if (this.y + tmpScale > config.mapScale) {
				this.y = config.mapScale - tmpScale
				this.yVel = 0
			}
		}
	}

	// WHERE IT COMES BACK:
	// its own spot (fixedSpawn), a band of the map (min/maxSpawnRange), or anywhere, as the
	// game; the Yeti comes back in the snow (ours)
	this.respawnAt = function () {
		if (this.minSpawnRange || this.maxSpawnRange) {
			var lo = config.mapScale * this.minSpawnRange
			var hi = config.mapScale * this.maxSpawnRange
			this.x = UTILS.randInt(lo, hi)
			this.y = UTILS.randInt(lo, hi)
			return
		}
		this.x = this.startX || UTILS.randInt(0, config.mapScale)
		this.y = this.startY || (this.index === 10 ? UTILS.randInt(0, config.snowBiomeTop) : UTILS.randInt(0, config.mapScale))
	}

	// CAN SEE:
	this.canSee = function (other) {
		if (!other) return false
		if (other.skin && other.skin.invisTimer && other.noMovTimer >= other.skin.invisTimer) return false
		var dx = Math.abs(other.x - this.x) - other.scale
		var dy = Math.abs(other.y - this.y) - other.scale
		return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3
	}

	var tmpRatio = 0
	var animIndex = 0
	this.animate = function (delta) {
		if (this.animTime > 0) {
			this.animTime -= delta
			if (this.animTime <= 0) {
				this.animTime = 0
				this.dirPlus = 0
				tmpRatio = 0
				animIndex = 0
			} else {
				if (animIndex == 0) {
					tmpRatio += delta / (this.animSpeed * config.hitReturnRatio)
					this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio))
					if (tmpRatio >= 1) {
						tmpRatio = 1
						animIndex = 1
					}
				} else {
					tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio))
					this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio))
				}
			}
		}
	}

	// ANIMATION:
	this.startAnim = function () {
		this.animTime = this.animSpeed = 600
		this.targetAngle = Math.PI * 0.8
		tmpRatio = 0
		animIndex = 0
	}

	// CHANGE HEALTH:
	this.changeHealth = function (val, doer, runFrom) {
		if (this.active) {
			if (val < 0 && this.index === 11 && this.state === 2) return
			// Ryn's damage rule and combat log
			if (config.rynHealth) val = config.rynHealth(this, val, doer)
			this.health += val
			if (runFrom) {
				if (this.hitScare && !UTILS.randInt(0, this.hitScare)) {
					this.runFrom = runFrom
					this.waitCount = 0
					this.moveCount = 2000
				} else if (this.hostile && this.chargePlayer && runFrom.isPlayer) {
					this.chargeTarget = runFrom
					this.waitCount = 0
					this.moveCount = 8000
				} else if (!this.dontRun) {
					this.runFrom = runFrom
					this.waitCount = 0
					this.moveCount = 2000
				}
			}
			if (val < 0 && this.hitRange && UTILS.randInt(0, 1)) this.hitWait = 500
			if (doer && doer.canSee(this) && val < 0) {
				server.send(doer.id, "t", [Math.round(this.x), Math.round(this.y), Math.round(-val), 1])
			}
			if (this.health <= 0 && this.minion) {
				this.active = false
				this.alive = false
				this.minion = false
				this.owner = null
				if (doer) scoreCallback(doer, this.killScore)
				return
			}
			if (this.health <= 0 && this.index === 11) {
				this.state = 0
				this.crab = null
				// its crabs go back into the water with it (ours)
				for (var mi = 0; mi < this.minions.length; mi++) {
					var mn = this.minions[mi]
					if (mn.active && mn.minion && mn.owner === this) {
						mn.active = false
						mn.alive = false
					}
				}
				this.minions = []
				if (doer && doer.isPlayer && doer.skins && !doer.skins[61]) {
					doer.skins[61] = 1
					server.send(doer.id, "us", [0, 61, 0])
				}
			}
			if (this.health <= 0) {
				if (this.spawnDelay) {
					this.spawnCounter = this.spawnDelay
					this.x = -1000000
					this.y = -1000000
				} else {
					this.respawnAt()
				}
				this.health = this.maxHealth
				this.runFrom = null
				if (doer) {
					// Cow Cape: half as much again from cows
					var cowMult = capes.cow(doer, this)
					scoreCallback(doer, this.killScore * cowMult)
					if (this.drop) {
						for (var i = 0; i < this.drop.length; ) {
							doer.addResource(config.resourceTypes.indexOf(this.drop[i]), this.drop[i + 1] * cowMult)
							i += 2
						}
					}
				}
			}
		}
	}

	// CRAB KING:
	// From the game's files: its numbers (aiTypes 11), its arena (config.secretPool), how
	// the game draws it under water (state 1 going under over 700 ms, 2 under, 3 coming up
	// over 1650 ms) and its warnings, W [kind, x, y, r, ms, x2, y2]: 3 a hit circle, 4 a
	// charge line, 1 a ring, anything else a splash. Its hit is the game's own, run by the
	// animal code above: it holds for hitDelay (700 ms), then everyone within hitRange (400)
	// takes dmg (45) and a 0.6 push, buildings take 5x, and the game's J animation plays.
	// Ours, until they can be measured on the real game: who it fights (players in its
	// pools), when it dives, charges or calls a ring and their sizes and times, its crabs,
	// and its healing. They are tied to its own numbers and its own pace.
	var KING_HIT = 3
	var KING_LINE = 4
	var KING_RING = 1
	var KING_SPLASH = 0
	var GO_UNDER = 700 // the game's animation for state 1
	var COME_UP = 1650 // and for state 3
	var UNDER_MAX = 3000
	var LINE_MAX = 1100
	var RING_R = 250
	var RING_MS = 1100
	var SUMMON_AT = 0.75
	var SUMMON_EVERY = 30000
	var MINIONS_MAX = 6

	// a player in the pools: who the King and its crabs fight (and where the game shows
	// the King's health bar)
	this.fighter = function (p) {
		return !!p && p.alive && UTILS.inArenaPools(config, p.x, p.y, 0)
	}
	this.nearestFighter = function () {
		var best = null
		var bestDst = Infinity
		for (var i = 0; i < players.length; ++i) {
			var p = players[i]
			if (!this.fighter(p) || (p.skin && p.skin.bullRepel)) continue
			var d = UTILS.getDistance(this.x, this.y, p.x, p.y)
			if (d <= this.viewRange && d < bestDst) {
				bestDst = d
				best = p
			}
		}
		return best
	}
	this.kingTune = function () {
		return config.rynKing || { speed: 1, damage: 1 }
	}
	this.kingDamage = function () {
		var t = this.kingTune()
		return t.damage === undefined ? 1 : t.damage
	}
	// how fast it walks when it chases, per ms, from the game's movement: speed x1.75 every
	// tick, then the game's slowdown
	this.kingPace = function (delta) {
		var q = Math.pow(config.playerDecel, delta)
		return (this.baseSpeed * 1.75 * delta) / (1 - q)
	}
	this.kingWarn = function (kind, x, y, r, ms, x2, y2) {
		if (x2 === undefined) {
			x2 = x
			y2 = y
		}
		var probe = { x: (x + x2) / 2, y: (y + y2) / 2, scale: r + Math.abs(x2 - x) / 2 + Math.abs(y2 - y) / 2 }
		for (var i = 0; i < players.length; ++i) {
			if (players[i].canSee(probe)) {
				server.send(players[i].id, "cw", [kind, Math.round(x), Math.round(y), r, Math.round(ms), Math.round(x2), Math.round(y2)])
			}
		}
	}
	// the game's hit, at a spot: everyone within r takes its damage and a 0.6 push away
	this.kingStrike = function (x, y, r, animate, hitList) {
		var hit = []
		if (animate) {
			for (var a = 0; a < players.length; ++a) {
				if (players[a].canSee(this)) server.send(players[a].id, "aa", [this.sid])
			}
		}
		for (var i = 0; i < players.length; ++i) {
			var p = players[i]
			if (!p.alive || (hitList && hitList[p.sid])) continue
			if (UTILS.getDistance(x, y, p.x, p.y) <= r + p.scale) {
				if (hitList) hitList[p.sid] = 1
				hit.push(p.sid)
				var dir = UTILS.getDirection(p.x, p.y, x, y)
				p.changeHealth(-this.dmg * this.kingDamage(), null, this)
				p.xVel += 0.6 * Math.cos(dir)
				p.yVel += 0.6 * Math.sin(dir)
			}
		}
		return hit
	}
	// Ryn's dodge counter: did the attack catch the player it was aimed at
	this.kingAttackDone = function (kind, hit) {
		var c = this.crab
		if (!c) return
		c.warned = false
		if (config.rynKingAttack && c.victim !== undefined) config.rynKingAttack(this, kind, c.victim, hit || [])
	}
	// the game's hit is shown as it starts holding (hitWait), for as long as it holds
	this.kingWarnHit = function () {
		var c = this.crab
		if (!c) return
		if (this.hitWait > 0 && !c.warned) {
			c.warned = true
			c.victim = this.chargeTarget ? this.chargeTarget.sid : undefined
			this.kingWarn(KING_HIT, this.x, this.y, this.hitRange, this.hitWait)
		} else if (!(this.hitWait > 0)) {
			c.warned = false
		}
	}
	this.kingSummon = function () {
		this.minions = this.minions.filter(function (m) {
			return m.active && m.alive && m.minion
		})
		var kinds = [14, 14, 13]
		for (var i = 0; i < kinds.length && this.minions.length < MINIONS_MAX && this.spawnAi; i++) {
			// around the King, wherever there is water for them
			var a, x, y, found = false
			for (var tries = 0; tries < 16 && !found; tries++) {
				a = UTILS.randFloat(-Math.PI, Math.PI)
				var d = this.scale + UTILS.randInt(100, 300)
				x = this.x + d * Math.cos(a)
				y = this.y + d * Math.sin(a)
				found = UTILS.inArenaPools(config, x, y, 40)
			}
			if (!found) continue
			var m = this.spawnAi(x, y, a, kinds[i])
			m.minion = true
			m.owner = this
			// they come up out of the water
			m.state = 3
			m.emerge = COME_UP
			m.waitCount = COME_UP
			this.minions.push(m)
			this.kingWarn(KING_SPLASH, x, y, Math.round(m.scale * 1.5), COME_UP)
		}
	}
	this.kingPick = function (target, tune) {
		var d = UTILS.getDistance(this.x, this.y, target.x, target.y)
		if (tune.only) {
			if (tune.only === "slam") return null
			if (tune.only === "charge") return d <= LINE_MAX ? "charge" : null
			return tune.only
		}
		// close up, its own hit does the work
		if (d <= this.hitRange + target.scale) return null
		var fits = { charge: d >= 350 && d <= LINE_MAX, ring: d <= 1500, dive: d >= 500 }
		var order = ["charge", "ring", "dive"]
		var c = this.crab
		for (var i = 0; i < order.length; i++) {
			var k = order[(c.turn + i) % order.length]
			if (fits[k]) {
				c.turn = (c.turn + i + 1) % order.length
				return k
			}
		}
		return null
	}
	this.kingHold = function () {
		this.xVel = 0
		this.yVel = 0
	}
	this.kingEnd = function (kind, hit) {
		var c = this.crab
		this.kingAttackDone(kind, hit)
		c.phase = "idle"
		c.next = UTILS.randInt(6000, 9000)
		this.state = 0
		// a rest, as after the game's chase
		this.chargeTarget = null
		this.moveCount = 0
		this.waitCount = 1500
	}
	// true while one of its own attacks moves or holds it
	this.kingThink = function (delta) {
		var c = this.crab
		if (!c) c = this.crab = { phase: "idle", t: 0, next: 5000, turn: 0, summon: 0, summoned: false, alone: 0, warned: false, kind: null, victim: undefined }
		var tune = this.kingTune()
		this.speed = this.baseSpeed * (tune.speed || 1)
		var target = this.fighter(this.chargeTarget) ? this.chargeTarget : this.nearestFighter()
		// back a little under water, and slowly with nobody in its pools
		if (this.state === 2) this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.015 * (delta / 1000))
		c.alone = target ? 0 : c.alone + delta
		if (c.alone > 5000) this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.005 * (delta / 1000))
		// its crabs: once it is down to 75%, then every 30 s while it fights
		if (target && this.health <= this.maxHealth * SUMMON_AT) {
			c.summon -= delta
			if (!c.summoned || c.summon <= 0) {
				this.kingSummon()
				c.summoned = true
				c.summon = SUMMON_EVERY
			}
		}
		if (c.phase !== "idle") this.hitWait = 0
		c.t -= delta
		var v, d
		switch (c.phase) {
			case "idle": {
				this.state = 0
				if (!target) {
					c.next = Math.max(c.next, 3000)
					return false
				}
				c.next -= delta * (this.health < this.maxHealth * 0.4 ? 1.5 : 1)
				if (c.next > 0 || this.hitWait > 0) return false
				var pick = this.kingPick(target, tune)
				if (!pick) {
					c.next = 1000
					return false
				}
				c.kind = pick
				c.victim = target.sid
				this.chargeTarget = target
				this.hitWait = 0
				this.kingHold()
				if (pick === "dive") {
					c.phase = "under1"
					c.t = GO_UNDER
					this.state = 1
				} else if (pick === "charge") {
					d = UTILS.getDistance(this.x, this.y, target.x, target.y)
					c.phase = "lineWind"
					c.t = this.hitDelay
					c.dir = UTILS.getDirection(target.x, target.y, this.x, this.y)
					c.len = Math.max(400, Math.min(LINE_MAX, d + 200))
					this.dir = c.dir
					this.kingWarn(KING_LINE, this.x, this.y, this.scale, c.t, this.x + c.len * Math.cos(c.dir), this.y + c.len * Math.sin(c.dir))
				} else {
					c.phase = "ring"
					c.t = RING_MS
					c.x = target.x
					c.y = target.y
					this.kingWarn(KING_RING, c.x, c.y, RING_R, c.t)
				}
				return true
			}
			case "under1":
				this.state = 1
				this.kingHold()
				if (c.t <= 0) {
					c.phase = "under2"
					c.t = UNDER_MAX
					this.state = 2
				}
				return true
			case "under2":
				this.state = 2
				d = target ? UTILS.getDistance(this.x, this.y, target.x, target.y) : 0
				if (target && d > 60 && c.t > 0) {
					v = Math.min(this.kingPace(delta) * 1.5, d / delta)
					this.dir = UTILS.getDirection(target.x, target.y, this.x, this.y)
					this.xVel = v * Math.cos(this.dir)
					this.yVel = v * Math.sin(this.dir)
					return true
				}
				c.phase = "up"
				c.t = COME_UP
				this.state = 3
				this.kingHold()
				this.kingWarn(KING_SPLASH, this.x, this.y, this.hitRange, COME_UP)
				return true
			case "up":
				this.state = 3
				this.kingHold()
				if (c.t <= 0) this.kingEnd("dive", this.kingStrike(this.x, this.y, this.hitRange, true))
				return true
			case "lineWind":
				this.dir = c.dir
				this.kingHold()
				if (c.t <= 0) {
					c.phase = "line"
					c.t = 4000
					c.travel = 0
					c.lx = this.x
					c.ly = this.y
					c.hit = {}
					c.hits = []
				}
				return true
			case "line": {
				var moved = UTILS.getDistance(this.x, this.y, c.lx, c.ly)
				c.travel += moved
				c.lx = this.x
				c.ly = this.y
				c.hits = c.hits.concat(this.kingStrike(this.x, this.y, this.scale, false, c.hit))
				v = this.kingPace(delta) * 2
				var stuck = c.travel > 0 && moved < v * delta * 0.25
				if (c.travel >= c.len || c.t <= 0 || stuck) {
					this.kingHold()
					this.kingEnd("charge", c.hits)
					return true
				}
				this.dir = c.dir
				this.xVel = v * Math.cos(c.dir)
				this.yVel = v * Math.sin(c.dir)
				return true
			}
			case "ring":
				this.kingHold()
				if (target) {
					var face = UTILS.getDirection(target.x, target.y, this.x, this.y)
					this.dir %= PI2
					var net = (this.dir - face + PI2) % PI2
					var amnt = Math.min(Math.abs(net - PI2), net, this.turnSpeed * delta)
					this.dir = (this.dir + (net - Math.PI >= 0 ? 1 : -1) * amnt + PI2) % PI2
				}
				if (c.t <= 0) this.kingEnd("ring", this.kingStrike(c.x, c.y, RING_R, false))
				return true
		}
		c.phase = "idle"
		return false
	}
}
