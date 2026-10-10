var PI2 = Math.PI * 2
module.exports = function (sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
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
		this.boss = data.boss
		this.diver = data.diver
		// the Crab King and its crabs live in the arena west of the map
		this.arena = index === 11 || index === 13 || index === 14
		this.state = 0
		this.crab = null
		this.minion = false
		this.owner = null
		this.minions = []
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
					this.x = this.startX || UTILS.randInt(0, config.mapScale)
					this.y = this.startY || UTILS.randInt(0, config.mapScale)
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
			var isKing = this.index === 11
			if (isKing) {
				try {
					this.crabKingUpdate(delta)
				} catch (e) {
					this.crab = null
				}
			}
			var charging = false
			var slowMlt = 1
			if (
				!this.arena &&
				!this.zIndex &&
				!this.lockMove &&
				this.y >= config.mapScale / 2 - config.riverWidth / 2 &&
				this.y <= config.mapScale / 2 + config.riverWidth / 2
			) {
				slowMlt = 0.33
				this.xVel += config.waterCurrent * delta
			}
			if (isKing) {
			} else if (this.lockMove) {
				this.xVel = 0
				this.yVel = 0
			} else if (this.waitCount > 0) {
				this.waitCount -= delta
				if (this.waitCount <= 0) {
					if (this.chargePlayer) {
						var tmpPlayer, bestDst, tmpDist
						for (let i = 0; i < players.length; ++i) {
							if (players[i].alive && !(players[i].skin && players[i].skin.bullRepel)) {
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
				} else if (this.chargeTarget && this.chargeTarget.alive) {
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
			if (!isKing && this.hitWait > 0) {
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
									tmpObj.changeHealth(-this.dmg, null, this)
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
				// arena animals stay in the arena; slide along its walls
				var fits = function (x, y) {
					return x + tmpScale <= 0 && UTILS.inSecretPool(config, x, y, tmpScale)
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
					this.x = this.startX || UTILS.randInt(0, config.mapScale)
					this.y = this.startY || (this.index === 10 ? UTILS.randInt(0, config.snowBiomeTop) : UTILS.randInt(0, config.mapScale))
				}
				this.health = this.maxHealth
				this.runFrom = null
				if (doer) {
					scoreCallback(doer, this.killScore)
					if (this.drop) {
						for (var i = 0; i < this.drop.length; ) {
							doer.addResource(config.resourceTypes.indexOf(this.drop[i]), this.drop[i + 1])
							i += 2
						}
					}
				}
			}
		}
	}

	// CRAB KING:
	// The game draws the King and its warnings but leaves what it does to the server.
	// It shows the King's state (1 going under, 2 under water, 3 coming up) and
	// warnings sent as W [kind, x, y, r, ms, x2, y2]: 3 a slam, 4 a charge line,
	// 1 a ring, 0 a splash where it surfaces. The attacks below are built on those.
	var CRAB_SLAM = 3
	var CRAB_LINE = 4
	var CRAB_RING = 1
	var CRAB_SPLASH = 0
	this.crabWarn = function (kind, x, y, r, ms, x2, y2) {
		if (x2 === undefined) {
			x2 = x
			y2 = y
		}
		var probe = { x: (x + x2) / 2, y: (y + y2) / 2, scale: r + Math.abs(x2 - x) / 2 + Math.abs(y2 - y) / 2 }
		for (var i = 0; i < players.length; ++i) {
			if (players[i].canSee(probe)) {
				server.send(players[i].id, "cw", [kind, Math.round(x), Math.round(y), r, ms, Math.round(x2), Math.round(y2)])
			}
		}
	}
	// returns the sids it hit
	this.crabHurt = function (x, y, r, dmg, knock, hitList) {
		var hit = []
		for (var i = 0; i < players.length; ++i) {
			var p = players[i]
			if (!p.alive || (hitList && hitList[p.sid])) continue
			if (UTILS.getDistance(x, y, p.x, p.y) <= r + p.scale) {
				if (hitList) hitList[p.sid] = 1
				hit.push(p.sid)
				var dir = UTILS.getDirection(p.x, p.y, x, y)
				p.changeHealth(-dmg, null, this)
				p.xVel += knock * Math.cos(dir)
				p.yVel += knock * Math.sin(dir)
			}
		}
		return hit
	}
	// Ryn's dodge counter: did the attack catch the player it was aimed at
	this.crabDone = function (hit) {
		var c = this.crab
		if (config.rynKingAttack && c && c.victim !== undefined) config.rynKingAttack(this, c.kind, c.victim, hit || [])
	}
	this.crabTurn = function (dir, delta) {
		this.dir %= PI2
		var netAngle = (this.dir - dir + PI2) % PI2
		var amnt = Math.min(Math.abs(netAngle - PI2), netAngle, this.turnSpeed * delta)
		var sign = netAngle - Math.PI >= 0 ? 1 : -1
		this.dir = (this.dir + sign * amnt + PI2) % PI2
	}
	this.crabWalk = function (dir, delta, mult) {
		this.xVel += this.speed * mult * delta * Math.cos(dir)
		this.yVel += this.speed * mult * delta * Math.sin(dir)
	}
	this.crabEnd = function (rest) {
		this.crab.phase = "idle"
		this.crab.next = rest
		this.state = 0
	}
	this.crabSummon = function () {
		this.minions = this.minions.filter(function (m) {
			return m.active && m.alive && m.minion
		})
		var room = 8 - this.minions.length
		var kinds = [14, 14, 14, 13]
		for (var i = 0; i < kinds.length && room > 0; i++) {
			var a = UTILS.randFloat(-Math.PI, Math.PI)
			var d = this.scale + UTILS.randInt(80, 260)
			var x = this.x + d * Math.cos(a)
			var y = this.y + d * Math.sin(a)
			if (!this.spawnAi || !UTILS.inSecretPool(config, x, y, 40)) continue
			var m = this.spawnAi(x, y, a, kinds[i])
			m.minion = true
			m.owner = this
			this.minions.push(m)
			room--
		}
	}
	// how far the King's facing is from a direction, 0..PI
	this.crabOff = function (dir) {
		var d = Math.abs(((dir - this.dir) % PI2 + PI2 + Math.PI) % PI2 - Math.PI)
		return d
	}
	this.crabKingUpdate = function (delta) {
		var c = this.crab
		if (!c) c = this.crab = { phase: "idle", t: 0, next: 2500, summon: 9000, x: 0, y: 0, r: 0, dir: 0, len: 0, hit: null, alone: 0, travel: 0 }
		var tune = config.rynKing || { speed: 1, damage: 1 }
		var dmgMult = tune.damage
		var target = null
		var best = Infinity
		for (var i = 0; i < players.length; ++i) {
			var p = players[i]
			if (p.alive && p.x < 0) {
				var d = UTILS.getDistance(this.x, this.y, p.x, p.y)
				if (d <= this.viewRange && d < best) {
					best = d
					target = p
				}
			}
		}
		// it heals under water, and slowly when nobody is around
		if (this.state === 2) {
			this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.015 * (delta / 1000))
		}
		c.alone = target ? 0 : c.alone + delta
		if (c.alone > 5000) {
			this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.005 * (delta / 1000))
		}
		// nobody stands inside the King, except while it is under water
		if (this.state !== 2) {
			for (var k = 0; k < players.length; ++k) {
				var q = players[k]
				if (!q.alive) continue
				var qd = UTILS.getDistance(this.x, this.y, q.x, q.y)
				var room = this.scale * 0.8 + q.scale
				if (qd < room) {
					var qa = qd > 0 ? UTILS.getDirection(q.x, q.y, this.x, this.y) : UTILS.randFloat(-Math.PI, Math.PI)
					var nx = this.x + room * Math.cos(qa)
					var ny = this.y + room * Math.sin(qa)
					if (nx - q.scale >= 0 || UTILS.inSecretPool(config, nx, ny, q.scale)) {
						q.x = nx
						q.y = ny
					}
				}
			}
		}
		c.t -= delta
		switch (c.phase) {
			case "idle": {
				this.state = 0
				if (!target) {
					c.next = Math.max(c.next, 1500)
					if (UTILS.getDistance(this.x, this.y, this.startX, this.startY) > 80) {
						var home = UTILS.getDirection(this.startX, this.startY, this.x, this.y)
						this.crabTurn(home, delta)
						// a crab walks where it faces; it turns first
						if (this.crabOff(home) < 0.6) this.crabWalk(this.dir, delta, tune.speed)
					}
					return
				}
				var face = UTILS.getDirection(target.x, target.y, this.x, this.y)
				this.crabTurn(face, delta)
				var off = this.crabOff(face)
				if (best > this.hitRange * 0.7 && off < 0.6) this.crabWalk(this.dir, delta, tune.speed)
				c.next -= delta
				c.summon -= delta
				if (c.summon <= 0) {
					this.crabSummon()
					c.summon = 15000
				}
				// it only attacks what it is looking at
				if (c.next > 0 || off > 0.35) return
				var low = this.health < this.maxHealth * 0.4
				var canSlam = best <= this.hitRange + target.scale
				var canCharge = best <= 1150 && off < 0.25
				var pick = null
				if (tune.only) {
					// Ryn's practice mode: one attack, again and again (the King walks in for slams and charges)
					if (tune.only === "slam") pick = canSlam ? "slam" : null
					else if (tune.only === "charge") pick = canCharge ? "charge" : null
					else pick = tune.only
				} else if (canSlam) pick = "slam"
				else if (low && UTILS.randInt(0, 1)) pick = "dive"
				else if (canCharge && UTILS.randInt(0, 2)) pick = "charge"
				else if (UTILS.randInt(0, 1)) pick = "ring"
				else pick = "dive"
				if (!pick) return
				c.kind = pick
				c.victim = target.sid
				if (pick === "slam") {
					// slam in front of the King
					c.phase = "slam"
					c.t = this.hitDelay
					c.r = 360
					c.x = this.x + 160 * Math.cos(this.dir)
					c.y = this.y + 160 * Math.sin(this.dir)
					this.crabWarn(CRAB_SLAM, c.x, c.y, c.r, c.t)
				} else if (pick === "charge") {
					// charge along the line it faces
					c.phase = "chargeWind"
					c.t = 900
					c.dir = this.dir
					c.len = Math.min(1100, best + 250)
					c.hit = {}
					this.crabWarn(CRAB_LINE, this.x, this.y, this.scale, c.t, this.x + c.len * Math.cos(c.dir), this.y + c.len * Math.sin(c.dir))
				} else if (pick === "ring") {
					// a ring of water under the target
					c.phase = "ring"
					c.t = 1100
					c.r = 240
					c.x = target.x
					c.y = target.y
					this.crabWarn(CRAB_RING, c.x, c.y, c.r, c.t)
				} else {
					// go under and come up beneath the target
					c.phase = "dive1"
					c.t = 700
					this.state = 1
				}
				return
			}
			case "slam":
				this.xVel *= 0.5
				this.yVel *= 0.5
				if (c.t <= 0) {
					for (var a = 0; a < players.length; ++a) {
						if (players[a].canSee(this)) server.send(players[a].id, "aa", [this.sid])
					}
					this.crabDone(this.crabHurt(c.x, c.y, c.r, this.dmg * dmgMult, 0.9))
					this.crabEnd(1400)
				}
				return
			case "chargeWind":
				// it holds the line it showed
				this.xVel = 0
				this.yVel = 0
				if (c.t <= 0) {
					c.phase = "charge"
					c.travel = 0
					this.dir = c.dir
				}
				return
			case "charge": {
				var v = 0.6 * tune.speed
				this.dir = c.dir
				this.xVel = v * Math.cos(c.dir)
				this.yVel = v * Math.sin(c.dir)
				c.travel += v * delta
				this.crabHurt(this.x, this.y, this.scale * 0.8, this.dmg * dmgMult, 1.1, c.hit)
				if (c.travel >= c.len) {
					this.xVel = 0
					this.yVel = 0
					this.crabDone(Object.keys(c.hit).map(Number))
					this.crabEnd(1800)
				}
				return
			}
			case "ring":
				if (c.t <= 0) {
					this.crabDone(this.crabHurt(c.x, c.y, c.r, 30 * dmgMult, 0.6))
					this.crabEnd(1200)
				}
				return
			case "dive1":
				this.state = 1
				this.xVel = 0
				this.yVel = 0
				if (c.t <= 0) {
					c.phase = "dive2"
					c.t = 1600
					c.travel = 0
					this.state = 2
					c.x = target ? target.x : this.x
					c.y = target ? target.y : this.y
				}
				return
			case "dive2": {
				this.state = 2
				if (target) {
					c.x = target.x
					c.y = target.y
				}
				var gap = UTILS.getDistance(this.x, this.y, c.x, c.y)
				var go = UTILS.getDirection(c.x, c.y, this.x, this.y)
				var sv = Math.min(0.4 * tune.speed, gap / Math.max(delta, 1))
				if (c.travel >= 900) sv = 0
				this.xVel = sv * Math.cos(go)
				this.yVel = sv * Math.sin(go)
				c.travel += sv * delta
				if (gap > 1) this.dir = go
				if (c.t <= 0 || gap < 40) {
					c.phase = "dive3"
					c.t = 1650
					this.state = 3
					this.xVel = 0
					this.yVel = 0
					this.crabWarn(CRAB_SPLASH, this.x, this.y, 330, c.t)
				}
				return
			}
			case "dive3":
				this.state = 3
				this.xVel = 0
				this.yVel = 0
				if (c.t <= 0) {
					this.crabDone(this.crabHurt(this.x, this.y, 330, 60 * dmgMult, 1.2))
					this.crabEnd(2200)
				}
				return
		}
	}
}
