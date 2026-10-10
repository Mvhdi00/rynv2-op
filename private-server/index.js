require('dotenv').config()
const WebSocket = require('ws')
const msgpack = require('msgpack-lite')
const http = require('http')
const url = require('url')
const inquirer = require('inquirer')
const fetch = require('node-fetch')
const pkg = require('./package.json')

async function checkLatest() {
	const response = await fetch(
		'https://raw.githubusercontent.com/kookywarrior/moomooio-private-server/main/package.json'
	)
	const data = await response.json()
	return data.version === pkg.version
}

var MODE = process.env.MODE
var PASSWORD = process.env.PASSWORD
var PREFIX = process.env.PREFIX
const PORT = process.env.PORT || 1234
var server = new WebSocket.Server({ noServer: true })

let delta,
	now,
	lastUpdate = Date.now()
var ais = []
var players = []
var gameObjects = []
var projectiles = []
// messages to one connection: Ryn's admin panel when it is there, the game's notice otherwise
function rynTell(conn, text) {
	if (conn && typeof conn.rynNotice === 'function') conn.rynNotice(String(text))
	else if (conn) server.send(conn.id, 'ch', [-1, String(text)])
}

function findPlayerByID(id) {
	for (let i = 0; i < players.length; ++i) {
		if (players[i].id === id) {
			return players[i]
		}
	}
	return null
}
function findPlayerBySID(sid) {
	for (let i = 0; i < players.length; ++i) {
		if (players[i].sid === sid) {
			return players[i]
		}
	}
	return null
}
const UTILS = require('./src/utils')
let config = require('./src/config')
let GameObject = require('./src/gameObject.js')
let items = require('./src/items.js')
let ObjectManager = require('./src/objectManager.js')
let Player = require('./src/player.js')
let store = require('./src/store.js')
let Projectile = require('./src/projectile.js')
let ProjectileManager = require('./src/projectileManager.js')
let AiManager = require('./src/aiManager.js')
let AI = require('./src/ai.js')
let TribeManager = require('./src/tribeManager.js')
let Tribe = require('./src/tribe.js')
let objectManager = new ObjectManager(
	GameObject,
	gameObjects,
	UTILS,
	config,
	players,
	server
)
let aiManager = new AiManager(
	ais,
	AI,
	players,
	items,
	objectManager,
	config,
	UTILS,
	scoreCallback,
	server
)
let projectileManager = new ProjectileManager(
	Projectile,
	projectiles,
	players,
	ais,
	objectManager,
	items,
	config,
	UTILS,
	server
)
let tribeManager = new TribeManager(Tribe, findPlayerBySID, server)
let hats = store.hats,
	accessories = store.accessories

// Ryn's admin tools (src/ryn.js); the getters follow setupServer's new arrays
const ryn = require('./src/ryn.js')({
	UTILS,
	config,
	items,
	hats,
	accessories,
	server,
	get players() {
		return players
	},
	get ais() {
		return ais
	},
	get gameObjects() {
		return gameObjects
	},
	get projectiles() {
		return projectiles
	},
	get objectManager() {
		return objectManager
	},
	get aiManager() {
		return aiManager
	},
	findPlayerBySID,
	newPlayer: (id, sid) =>
		new Player(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback, MODE),
	allocSid() {
		for (let sid = 1; sid < 1000; sid++) {
			if (!playersSid.includes(sid)) {
				playersSid.push(sid)
				return sid
			}
		}
		return 0
	},
	freeSid(sid) {
		const i = playersSid.indexOf(sid)
		if (i !== -1) playersSid.splice(i, 1)
	},
	updateLeaderboard: () => updateLeaderboard(),
	debug(p, text) {
		const conn = connection[p.id]
		if (conn && typeof conn.rynDebug === 'function') conn.rynDebug(text)
	},
	iconCallback: () => iconCallback(),
	setTickRate(rate) {
		config.serverUpdateRate = rate
		clearInterval(rynTickTimer)
		rynTickTimer = setInterval(gameTick, 1000 / rate)
	}
})

var connection = {}
server.send = function (id, type, data = []) {
	if (connection[id]) {
		// Ryn's packet inspector
		if (connection[id].rynTap) connection[id].rynTap(1, UTILS.OldToNew(type, 'RECEIVE'), data)
		connection[id].send(
			new Uint8Array(
				Array.from(msgpack.encode([UTILS.OldToNew(type, 'RECEIVE'), data]))
			)
		)
	}
}
server.sendAll = function (type, data = []) {
	for (let i = 0; i < players.length; i++) {
		let tmpPlayer = players[i]
		if (tmpPlayer) {
			server.send(tmpPlayer.id, type, data)
		}
	}
}

let playersSid = []
server.addListener('connection', function (conn) {
	while (true) {
		conn.id = UTILS.randomString(10)
		let returnvalue = true
		for (let i = 0; i < players.length; i++) {
			if (conn.id === players[i].id) {
				returnvalue = false
				break
			}
		}
		if (returnvalue) break
	}

	conn.sid = 1
	while (true) {
		if (!playersSid.includes(conn.sid)) {
			playersSid.push(conn.sid)
			break
		}
		conn.sid++
	}

	connection[conn.id] = conn
	conn.on('error', console.log)
	conn.on('close', function () {
		let tmpPlayer = findPlayerByID(conn.id)
		if (!tmpPlayer) return
		if (tmpPlayer.team && MODE !== 'HOCKEY') {
			if (tmpPlayer.isLeader) {
				server.sendAll('ad', [tmpPlayer.team])
				tribeManager.deleteTribe(tmpPlayer.team)
			} else {
				tribeManager.getTribe(tmpPlayer.team).removePlayer(tmpPlayer)
			}
		}
		server.sendAll('4', [conn.id])
		objectManager.removeAllItems(tmpPlayer.sid, server)
		for (let i = 0; i < players.length; ++i) {
			if (players[i].id == conn.id) {
				players.splice(i, 1)
				const tmpIndex = playersSid.indexOf(conn.sid)
				if (tmpIndex !== -1) {
					playersSid.splice(tmpIndex, 1)
				}
				updateLeaderboard()
				iconCallback()
				break
			}
		}
	})

	// Ryn's admin panel reads the server's state through this
	conn.rynState = function () {
		const me = findPlayerByID(conn.id)
		return {
			me: me ? { sid: me.sid, name: me.name, alive: me.alive, admin: !!me.admin, god: !!me.rynGod, x: me.x, y: me.y, weapons: (me.weapons || []).slice(), xp: (me.weapons || []).map(w => (me.weaponXP && me.weaponXP[w]) || 0), hat: me.skinIndex || 0, acc: me.tailIndex || 0, shame: me.shameCount || 0, shameTimer: Math.max(0, Math.round(me.shameTimer || 0)) } : null,
			players: players.map(p => ({ sid: p.sid, name: p.name, alive: p.alive, god: !!p.rynGod, health: Math.round(p.health), maxHealth: p.maxHealth, age: p.age, dummy: !!p.rynDummy, x: Math.round(p.x), y: Math.round(p.y) })),
			world: { mobs: !!config.spawnMobs, hostile: !!config.spawnHostile, bosses: !!config.spawnBosses },
			mode: MODE
		}
	}

	const onMessage = function (message) {
		let data,
			parsed,
			type,
			error = false
		try {
			data = new Uint8Array(message)
			parsed = msgpack.decode(data)
			type = UTILS.NewToOld(parsed[0], 'SEND')
			data = parsed[1]
			if (conn.rynTap) conn.rynTap(0, parsed[0], data)
		} catch (e) {
			error = true
			conn.close()
		}
		if (error) return
		const events = {
			pp: pingSocket,
			sp: enterGame,
			rmd: resetMoveDir,
			c: sendAtckState,
			33: sendMoveDir,
			2: sendDir,
			5: selectToBuild,
			6: sendUpgrade,
			7: sendLockGather,
			ch: sendMessage,
			'13c': storeFunction,
			8: createAllaince,
			9: leaveAlliance,
			10: sendJoinRequest,
			11: decideJoinRequest,
			12: kickFromClan,
			14: sendMapPing
		}
		if (events[type]) {
			try {
				events[type].apply(undefined, data)
			} catch (error) {}
		}

		function pingSocket() {
			server.send(conn.id, 'pp')
		}

		function enterGame(data) {
			if (MODE === 'HOCKEY' && config.isStarted) return
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer) {
				tmpPlayer.spawn(data.moofoll)
				tmpPlayer.visible = false

				let location = objectManager.fetchSpawnObj(tmpPlayer.sid)
				if (!location) {
					const alivePlayers = players.filter(
						p => p.alive && p.sid !== tmpPlayer.sid
					)
					if (alivePlayers.length > 0) {
						const ref = alivePlayers[UTILS.randInt(0, alivePlayers.length - 1)]
						const angle = UTILS.randFloat(-Math.PI, Math.PI)
						const dist = UTILS.randInt(100, 500)
						let spawnX = Math.min(
							config.mapScale - 50,
							Math.max(50, ref.x + dist * Math.cos(angle))
						)
						let spawnY = Math.min(
							config.mapScale - 50,
							Math.max(50, ref.y + dist * Math.sin(angle))
						)
						location = [spawnX, spawnY]
					} else {
						location = [
							UTILS.randInt(0, config.mapScale),
							UTILS.randInt(0, config.mapScale)
						]
					}
				}

				tmpPlayer.setData([
					tmpPlayer.id,
					tmpPlayer.sid,
					data.name,
					location[0],
					location[1],
					0,
					100,
					100,
					config.playerScale,
					data.skin
				])
				server.send(conn.id, '1', [tmpPlayer.sid])
				if (typeof conn.rynDebug === 'function') conn.rynDebug('spawned at ' + Math.round(location[0]) + ', ' + Math.round(location[1]) + ' (' + players.length + ' players on the server)')
				updateLeaderboard()

				var playerName = data.name
					? (data.name + '')
							.slice(0, config.maxNameLength)
							.replace(/[^\w:\(\)\/? -]+/gim, ' ')
							.replace(/[^\x00-\x7F]/g, ' ')
							.trim()
					: ''
				if (conn.rynOwner || (config.adminNames && config.adminNames.includes(playerName))) {
					tmpPlayer.admin = true
					rynTell(conn, '[Server] Welcome, ' + playerName + '! SID: ' + tmpPlayer.sid)
				}
			}
		}

		function resetMoveDir() {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				tmpPlayer.resetMoveDir()
			}
		}

		function sendAtckState(mouseState, dir) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (dir) {
					tmpPlayer.dir = dir
				}
				tmpPlayer.mouseState = mouseState
				if (mouseState) {
					if (tmpPlayer.buildIndex >= 0) {
						for (let i = 0; i < items.list.length; i++) {
							if (i === tmpPlayer.buildIndex) {
								tmpPlayer.buildItem(items.list[i])
								break
							}
						}
					} else {
						tmpPlayer.gathering = mouseState
					}
				}
			}
		}

		function sendMoveDir(newMoveDir) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				tmpPlayer.moveDir = newMoveDir
			}
		}

		function sendDir(newDir) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				tmpPlayer.dir = newDir
			}
		}

		function selectToBuild(index, wpn) {
			if (MODE === 'HOCKEY') return
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (wpn) {
					tmpPlayer.buildIndex = -1
					tmpPlayer.weaponIndex = index
				} else {
					var canbuild = true
					for (let i = 0; i < items.list.length; i++) {
						if (i === index) {
							canbuild = tmpPlayer.canBuild(items.list[i])
							break
						}
					}
					if (!canbuild || tmpPlayer.buildIndex === index) {
						tmpPlayer.buildIndex = -1
					} else {
						tmpPlayer.buildIndex = index
					}
				}
			}
		}

		function sendLockGather(type) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (type === 0) {
					tmpPlayer.lockDir = tmpPlayer.lockDir ? 0 : 1
				} else if (type === 1) {
					tmpPlayer.autoGather = tmpPlayer.autoGather ? 0 : 1
				}
			}
		}

		function sendMessage(message) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (!tmpPlayer || !tmpPlayer.alive) return

			if (message === `${PREFIX}sid`) {
				rynTell(conn, '[Info] Your SID: ' + tmpPlayer.sid + ' | Name: ' + tmpPlayer.name)
				return
			}

			if (message.startsWith(PREFIX) && tmpPlayer.admin) {
				if (ryn.command(conn, tmpPlayer, message.slice(PREFIX.length), msg => rynTell(conn, msg))) return
				if (message === `${PREFIX}s`) {
					for (let i = 0; i < 9; i++) {
						tmpPlayer.addResource(3, 999999, true)
					}
					tmpPlayer.addResource(2, 999999, true)
					tmpPlayer.addResource(1, 999999, true)
					tmpPlayer.addResource(0, 999999, true)
				} else if (message.startsWith(`${PREFIX}speed`)) {
					var speedmlt = message.replace(PREFIX + 'speed ', '')
					if (UTILS.isNumber(parseFloat(speedmlt))) {
						tmpPlayer.speed = parseFloat(speedmlt)
					}
				} else if (message.startsWith(`${PREFIX}tp`)) {
					var tmpArgs = message.replace(PREFIX + 'tp ', '').split(' ')
					if (tmpArgs[1] == null) {
						var tmpObj = findPlayerBySID(parseInt(tmpArgs[0]))
						if (tmpObj) {
							tmpPlayer.x = tmpObj.x
							tmpPlayer.y = tmpObj.y
						}
					} else {
						const tmpX = parseInt(tmpArgs[0])
						const tmpY = parseInt(tmpArgs[1])
						if (UTILS.isNumber(tmpX) && UTILS.isNumber(tmpY)) {
							tmpPlayer.x = tmpX
							tmpPlayer.y = tmpY
						}
					}
				} else if (message.startsWith(`${PREFIX}v`)) {
					var msg = message.replace(PREFIX + 'v ', '')
					switch (msg) {
						case 'emerald':
							tmpPlayer.weaponXP[tmpPlayer.weaponIndex] = 30000
							break
						case 'ruby':
							tmpPlayer.weaponXP[tmpPlayer.weaponIndex] = 12000
							break
						case 'diamond':
							tmpPlayer.weaponXP[tmpPlayer.weaponIndex] = 7000
							break
						case 'gold':
							tmpPlayer.weaponXP[tmpPlayer.weaponIndex] = 3000
							break
						case 'normal':
							tmpPlayer.weaponXP[tmpPlayer.weaponIndex] = 0
							break
					}
				} else if (message === PREFIX + 'die') {
					tmpPlayer.kill(tmpPlayer)
				} else if (message.startsWith(`${PREFIX}upgrade`)) {
					var msg = message.replace(PREFIX + 'upgrade ', '')
					sendUpgrade(parseInt(msg))
				} else if (message.startsWith(PREFIX + 'dmg')) {
					if (message === PREFIX + 'dmg') {
						tmpPlayer.customDmg = null
					} else {
						var dmg = message.replace(PREFIX + 'dmg ', '')
						if (UTILS.isNumber(parseFloat(dmg))) {
							tmpPlayer.customDmg = parseFloat(dmg)
						}
					}
				} else if (message === PREFIX + 'b') {
					for (let i = 0; i < players.length; i++) {
						objectManager.removeAllItems(players[i].sid, server)
						for (let j = 0; j < items.groups.length; j++) {
							players[i].changeItemAllCount(j, 0)
						}
					}
				} else if (message.startsWith(PREFIX + 'kill ')) {
					var killSid = parseInt(message.replace(PREFIX + 'kill ', ''))
					var killTarget = findPlayerBySID(killSid)
					if (killTarget && killTarget.alive) {
						killTarget.kill(null)
					}
				} else if (message === PREFIX + 'mobs off') {
					config.spawnMobs = false
					for (let i = 0; i < ais.length; i++) {
						ais[i].active = false
						ais[i].alive = false
					}
					rynTell(conn, '[Admin] Mobs off.')
				} else if (message === PREFIX + 'mobs on') {
					config.spawnMobs = true
					rynTell(conn, '[Admin] Mobs on. Restart the server for them to spawn.')
				} else if (message === PREFIX + 'hostile off') {
					config.spawnHostile = false
					const hostileTypes = [2, 3, 4, 9, 10, 13, 14]
					for (let i = 0; i < ais.length; i++) {
						if (hostileTypes.includes(ais[i].index)) {
							ais[i].active = false
							ais[i].alive = false
						}
					}
					rynTell(conn, '[Admin] Hostile mobs off.')
				} else if (message === PREFIX + 'hostile on') {
					config.spawnHostile = true
					rynTell(conn, '[Admin] Hostile mobs on.')
				} else if (message === PREFIX + 'bosses off') {
					config.spawnBosses = false
					const bossTypes = [6, 7, 8, 11, 13, 14]
					for (let i = 0; i < ais.length; i++) {
						if (bossTypes.includes(ais[i].index)) {
							ais[i].active = false
							ais[i].alive = false
						}
					}
					rynTell(conn, '[Admin] Bosses off.')
				} else if (message === PREFIX + 'bosses on') {
					config.spawnBosses = true
					rynTell(conn, '[Admin] Bosses on.')
				} else if (message === PREFIX + 'players') {
					var list = players
						.filter(p => p.alive)
						.map(p => p.name + '(sid:' + p.sid + ')')
						.join(', ')
					rynTell(conn, '[Admin] Players: ' + (list || 'none'))
				} else if (
					MODE === 'HOCKEY' &&
					message === PREFIX + 'start' &&
					!config.isStarted
				) {
					var tmpObj = findPlayerBySID(1)
					if (tmpObj) {
						tmpObj.spawn(false)
						tmpObj.visible = false
						tmpObj.setData([
							tmpObj.id,
							tmpObj.sid,
							' ',
							(3000 + 43 + (40 - 2) * 43 * 2 + (3000 + 43)) / 2,
							(3000 + 43 + (20 - 2) * 43 * 2 + (3000 + 43)) / 2,
							Math.PI / 2,
							0,
							100,
							config.playerScale,
							4
						])
						tmpObj.weaponIndex = 11
						const teams = UTILS.randTeam(
							players.slice(1),
							(players.length - 1) / 2
						)
						Array.from(teams[0]).forEach(tmpppl => {
							if (tmpppl) {
								tmpppl.team = 'Team 1'
								tmpppl.x = 3000 + 43
								tmpppl.y = UTILS.randFloat(
									3000 + 43,
									3000 + 43 + (20 - 2) * 43 * 2
								)
							}
						})
						if (teams[1]) {
							Array.from(teams[1]).forEach(tmpppl => {
								if (tmpppl) {
									tmpppl.team = 'Team 2'
									tmpppl.x = 3000 + 43 + (40 - 2) * 43 * 2
									tmpppl.y = UTILS.randFloat(
										3000 + 43,
										3000 + 43 + (20 - 2) * 43 * 2
									)
								}
							})
						}
						config.isStarted = true
					}
				}
			} else {
				server.sendAll('ch', [tmpPlayer.sid, message.toString()])
			}
		}

		function sendUpgrade(index) {
			if (index < 0 || index > items.weapons.length + items.list.length) return

			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (items.weapons[index]) {
					if (tmpPlayer.weaponIndex < 9 && index < 9) {
						tmpPlayer.weaponIndex = index
					} else if (!(tmpPlayer.weaponIndex < 9) && !(index < 9)) {
						tmpPlayer.weaponIndex = index
					}
					tmpPlayer.weapons[index < 9 ? 0 : 1] = index
					server.send(conn.id, '17', [tmpPlayer.weapons, 1])
				} else {
					index -= 16
					if (
						tmpPlayer.buildIndex !== -1 &&
						items.list[index].group.id ===
							items.list[tmpPlayer.buildIndex].group.id
					) {
						tmpPlayer.buildIndex = index
					}

					let addedItem = false
					for (let i = 0; i < tmpPlayer.items.length; i++) {
						if (
							items.list[tmpPlayer.items[i]].group.id ===
							items.list[index].group.id
						) {
							tmpPlayer.items[i] = index
							addedItem = true
							break
						}
					}
					if (!addedItem) {
						tmpPlayer.items.push(index)
					}
					server.send(conn.id, '17', [tmpPlayer.items])
				}
				tmpPlayer.upgrAge++
				tmpPlayer.upgradePoints--
				server.send(conn.id, '16', [tmpPlayer.upgradePoints, tmpPlayer.upgrAge])
			}
		}

		function storeFunction(type, id, index) {
			if (MODE === 'HOCKEY') return

			try {
				type = parseInt(type)
				id = parseInt(id)
				index = parseInt(index)
			} catch (error) {
				return
			}

			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				var tmpObj = null
				if (id !== 0) {
					if (index) {
						for (let i = 0; i < accessories.length; ++i) {
							if (accessories[i].id === id) {
								tmpObj = accessories[i]
								break
							}
						}
					} else {
						for (let i = 0; i < hats.length; i++) {
							if (hats[i].id === id) {
								tmpObj = hats[i]
								break
							}
						}
					}
				} else {
					if (index) {
						tmpPlayer.tail = null
						tmpPlayer.tailIndex = id
						server.send(conn.id, 'us', [1, id, index])
					} else {
						tmpPlayer.skin = null
						tmpPlayer.skinIndex = id
						server.send(conn.id, 'us', [1, id, index])
					}
				}

				if (index) {
					if (type) {
						if (tmpObj.price <= tmpPlayer.points) {
							tmpPlayer.addResource(3, -tmpObj.price)
							tmpPlayer.tails[id] = 1
							server.send(conn.id, 'us', [0, id, index])
						}
					} else if (tmpPlayer.tails[id]) {
						tmpPlayer.tail = tmpObj
						tmpPlayer.tailIndex = id
						server.send(conn.id, 'us', [1, id, index])
					}
				} else {
					if (type) {
						if (tmpObj.price <= tmpPlayer.points) {
							tmpPlayer.addResource(3, -tmpObj.price)
							tmpPlayer.skins[id] = 1
							server.send(conn.id, 'us', [0, id, index])
						}
					} else if (tmpPlayer.skins[id]) {
						tmpPlayer.skin = tmpObj
						tmpPlayer.skinIndex = id
						server.send(conn.id, 'us', [1, id, index])
					}
				}
			}
		}

		function createAllaince(name) {
			if (MODE === 'HOCKEY') return
			if (typeof name !== 'string' || name.length <= 0) return

			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (tribeManager.getTribe(name) == null) {
					const tmpClan = tribeManager.createTribe(name, tmpPlayer)
					server.sendAll('ac', [tmpClan.getData()])
					server.send(conn.id, 'st', [name, 1])
				}
			}
		}

		function leaveAlliance() {
			if (MODE === 'HOCKEY') return
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				if (tmpPlayer.isLeader) {
					server.sendAll('ad', [tmpPlayer.team])
					tribeManager.deleteTribe(tmpPlayer.team)
				} else {
					tribeManager.getTribe(tmpPlayer.team).removePlayer(tmpPlayer)
					server.send(conn.id, 'st', [null, 0])
				}
			}
		}

		function kickFromClan(sid) {
			if (MODE === 'HOCKEY') return
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive && tmpPlayer.isLeader) {
				const tmpObj = findPlayerBySID(sid)
				if (tmpObj) {
					tribeManager.getTribe(tmpPlayer.team).removePlayer(tmpObj)
					server.send(tmpObj.id, 'st', [null, 0])
				}
			}
		}

		function sendJoinRequest(sid) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive) {
				const tmpClan = tribeManager.getTribe(sid)
				if (tmpClan) {
					let isRequestSent = false
					for (let i = 0; i < tmpClan.joinQueue.length; i++) {
						if (tmpClan.joinQueue[i][1] === conn.id) {
							isRequestSent = true
							break
						}
					}

					if (!isRequestSent) {
						tmpClan.joinQueue.push([tmpPlayer.sid, tmpPlayer.id])
						server.send(findPlayerBySID(tmpClan.ownerID).id, 'an', [
							tmpPlayer.sid,
							tmpPlayer.name
						])
					}
				}
			}
		}

		function decideJoinRequest(sid, join) {
			let tmpPlayer = findPlayerByID(conn.id)
			if (tmpPlayer && tmpPlayer.alive && tmpPlayer.isLeader) {
				const tmpObj = findPlayerBySID(sid)
				const tmpClan = tribeManager.getTribe(tmpPlayer.team)
				if (tmpClan && tmpObj) {
					let queue = tmpClan.joinQueue.shift()
					if (queue[1] !== tmpObj.id) return
					if (join && tmpObj.team == null) {
						tmpClan.addPlayer(tmpObj)
						server.send(tmpObj.id, 'st', [tmpPlayer.team, 0])
					}
				}
			}
		}

		function sendMapPing(type) {
			if (type) {
				let tmpPlayer = findPlayerByID(conn.id)
				if (tmpPlayer && tmpPlayer.alive) {
					if (tmpPlayer.team) {
						for (let i = 0; i < players.length; i++) {
							if (players[i] && players[i].team === tmpPlayer.team) {
								server.send(players[i].id, 'p', [tmpPlayer.x, tmpPlayer.y])
							}
						}
					} else {
						server.send(conn.id, 'p', [tmpPlayer.x, tmpPlayer.y])
					}
				}
			}
		}
	}
	conn.on('message', onMessage)
	// the rest of what Ryn's panel reads and does without chat
	conn.rynWorld = function () {
		return ryn.world(findPlayerByID(conn.id))
	}
	conn.rynCall = function (name, arg) {
		const me = findPlayerByID(conn.id)
		const alive = me && me.alive ? me : null
		switch (name) {
			case 'me':
				return me ? { sid: me.sid, alive: me.alive, x: me.x, y: me.y, health: me.health, shame: me.shameCount || 0, shameTimer: Math.max(0, Math.round(me.shameTimer || 0)) } : null
			case 'panel':
				return ryn.panelState(me)
			case 'series':
				return ryn.series(me)
			case 'replay':
				return ryn.replay()
			case 'benchGuard':
				return ryn.benchGuard(me, !!arg)
			case 'benchEvents':
				return ryn.benchEvents(arg)
			case 'placeMany':
				return alive ? ryn.placeMany(me, arg.what, arg.owner, arg.points) : null
			case 'removeAt':
				return ryn.removeAt(arg.x, arg.y, arg.r)
			case 'removeSids':
				return ryn.removeSids(arg)
			case 'restoreObjs':
				return ryn.restoreObjs(arg)
			case 'copyBase':
				return alive ? ryn.copyBase(me, arg) : null
			case 'pasteBase':
				return alive ? ryn.pasteBase(me, arg.stamp, arg.rotate) : null
			case 'stats':
				return ryn.stats(me)
			case 'log':
				return ryn.log(arg)
			case 'clearLog':
				return ryn.clearLog()
			case 'snapshot':
				return ryn.snapshot(me)
			case 'restore':
				return ryn.restore(me, arg)
			case 'scenarios':
				return ryn.scenarios()
			case 'physics':
				return ryn.physics()
		}
		return null
	}
	// Ryn's admin panel sends its commands as chat from the owner, without the chat box
	conn.rynCommand = function (text) {
		const tmpPlayer = findPlayerByID(conn.id)
		if (!tmpPlayer || !tmpPlayer.alive) return false
		onMessage(msgpack.encode([UTILS.OldToNew('ch', 'SEND'), [PREFIX + String(text).replace(/^[!]/, '')]]))
		return true
	}

	let tmpA = new Player(
		conn.id,
		conn.sid,
		config,
		UTILS,
		projectileManager,
		objectManager,
		players,
		ais,
		items,
		hats,
		accessories,
		server,
		scoreCallback,
		iconCallback,
		MODE
	)
	players.push(tmpA)
	tmpA.visible = false

	server.send(conn.id, 'io-init', [conn.id])
	let teamsData = []
	for (const key in tribeManager.tribes) {
		teamsData.push(tribeManager.tribes[key].getData())
	}
	server.send(conn.id, 'id', [{ teams: teamsData }])
})

// GAME TICK
function gameTick() {
	now = Date.now()
	delta = now - lastUpdate
	lastUpdate = now

	// Ryn's time control: paused, stepped or slowed ticks still send the world.
	// Nothing Ryn adds may stop a tick, so each of its steps is fenced off.
	let rynTick = { run: true, delta: delta }
	try {
		rynTick = ryn.beginTick(delta)
	} catch (e) {
		console.log('ryn beginTick', e)
	}
	delta = rynTick.delta
	if (rynTick.run) {
	try {
		ryn.thinkDummies(delta)
	} catch (e) {
		console.log('ryn dummies', e)
	}
	for (let i = 0; i < players.length; ++i) {
		let tmpObj = players[i]
		if (tmpObj) {
			tmpObj.update(delta)
		}
	}

	for (let i = 0; i < ais.length; i++) {
		let tmpObj = ais[i]
		if (tmpObj) {
			tmpObj.update(delta)
		}
	}

	for (let i = 0; i < players.length; ++i) {
		let tmpObj = players[i]
		if (tmpObj && tmpObj.alive) {
			if (tmpObj.shootCount > 0) {
				tmpObj.shootCount -= delta
			} else if (tmpObj.skin && tmpObj.skin.turret) {
				var tmpPlayer, bestDst, tmpDist
				for (let i = 0; i < players.length; ++i) {
					if (
						players[i].alive &&
						!(players[i].skin && players[i].skin.antiTurret) &&
						players[i].sid !== tmpObj.sid &&
						!(tmpObj.team && tmpObj.team == players[i].team)
					) {
						tmpDist = UTILS.getDistance(
							tmpObj.x,
							tmpObj.y,
							players[i].x,
							players[i].y
						)
						if (
							tmpDist <= tmpObj.skin.turret.range &&
							(!tmpPlayer || tmpDist < bestDst)
						) {
							bestDst = tmpDist
							tmpPlayer = players[i]
						}
					}
				}
				for (let i = 0; i < ais.length; ++i) {
					if (ais[i].alive && ais[i].hostile) {
						tmpDist = UTILS.getDistance(tmpObj.x, tmpObj.y, ais[i].x, ais[i].y)
						if (
							tmpDist <= tmpObj.skin.turret.range &&
							(!tmpPlayer || tmpDist < bestDst)
						) {
							bestDst = tmpDist
							tmpPlayer = ais[i]
						}
					}
				}
				if (tmpPlayer) {
					tmpObj.shootCount = tmpObj.skin.turret.rate
					projectileManager.addProjectile(
						tmpObj.x,
						tmpObj.y,
						UTILS.getDirection(tmpPlayer.x, tmpPlayer.y, tmpObj.x, tmpObj.y),
						tmpObj.skin.turret.range,
						1.5,
						tmpObj.skin.turret.proj,
						tmpObj
					)
				}
			}
		}
	}

	for (let i = 0; i < objectManager.updateObjects.length; i++) {
		let tmpObj = objectManager.updateObjects[i]
		if (tmpObj.shootCount > 0) {
			tmpObj.shootCount -= delta
		} else {
			var tmpPlayer, bestDst, tmpDist
			for (let i = 0; i < players.length; ++i) {
				if (
					players[i].alive &&
					!(players[i].skin && players[i].skin.antiTurret) &&
					players[i].sid !== tmpObj.owner.sid &&
					!(tmpObj.owner.team && tmpObj.owner.team == players[i].team)
				) {
					tmpDist = UTILS.getDistance(
						tmpObj.x,
						tmpObj.y,
						players[i].x,
						players[i].y
					)
					if (
						tmpDist <= tmpObj.shootRange &&
						(!tmpPlayer || tmpDist < bestDst)
					) {
						bestDst = tmpDist
						tmpPlayer = players[i]
					}
				}
			}
			for (let i = 0; i < ais.length; ++i) {
				if (ais[i].alive && ais[i].hostile) {
					tmpDist = UTILS.getDistance(tmpObj.x, tmpObj.y, ais[i].x, ais[i].y)
					if (
						tmpDist <= tmpObj.shootRange &&
						(!tmpPlayer || tmpDist < bestDst)
					) {
						bestDst = tmpDist
						tmpPlayer = ais[i]
					}
				}
			}
			if (tmpPlayer) {
				tmpObj.dir = UTILS.getDirection(
					tmpPlayer.x,
					tmpPlayer.y,
					tmpObj.x,
					tmpObj.y
				)
				tmpObj.shootCount = tmpObj.shootRate
				projectileManager.addProjectile(
					tmpObj.x,
					tmpObj.y,
					tmpObj.dir,
					tmpObj.shootRange,
					1.5,
					tmpObj.projectile,
					tmpObj.owner,
					tmpObj.sid
				)
				server.sendAll('sp', [tmpObj.sid, tmpObj.dir])
			}
		}
	}

	for (let i = 0; i < projectiles.length; i++) {
		projectiles[i].update(delta)
	}
	try {
		ryn.endTick()
	} catch (e) {
		console.log('ryn endTick', e)
	}
	}

	for (let j = 0; j < players.length; j++) {
		let tmpPlayer = players[j]
		// Ryn's dummies have nobody to send to
		if (tmpPlayer && !tmpPlayer.rynDummy) {
			const tmpPlayersData = []
			for (let i = 0; i < players.length; ++i) {
				let tmpObj = players[i]
				if (tmpObj && tmpPlayer.canSee(tmpObj)) {
					if (!tmpObj.sentTo[tmpPlayer.id]) {
						tmpObj.sentTo[tmpPlayer.id] = 1
						server.send(tmpPlayer.id, '2', [
							[
								tmpObj.id,
								tmpObj.sid,
								tmpObj.name,
								tmpObj.x,
								tmpObj.y,
								tmpObj.dir,
								tmpObj.health,
								tmpObj.maxHealth,
								config.playerScale,
								tmpObj.skinColor
							],
							tmpObj.id === tmpPlayer.id
						])
					}
					if (tmpObj.alive) {
						tmpPlayersData.push(
							tmpObj.sid,
							tmpObj.x,
							tmpObj.y,
							tmpObj.dir,
							tmpObj.buildIndex,
							tmpObj.weaponIndex,
							config.fetchVariant(tmpObj).id,
							tmpObj.team,
							tmpObj.isLeader ? 1 : 0,
							tmpObj.shameTimer > 0 ? 45 : tmpObj.skinIndex,
							tmpObj.tailIndex,
							tmpObj.iconIndex,
							tmpObj.zIndex
						)
					}
				}
			}
			// The current game reads players as [positions, looks, gone]: positions are
			// sid, x, y, dir*100; looks are sid + the nine look fields; gone lists the sids
			// that left this player's view since the last update.
			const posData = []
			const lookData = []
			const seenPlayers = new Set()
			for (let i = 0; i < tmpPlayersData.length; i += 13) {
				const sid = tmpPlayersData[i]
				seenPlayers.add(sid)
				posData.push(sid, tmpPlayersData[i + 1], tmpPlayersData[i + 2], Math.round(tmpPlayersData[i + 3] * 100))
				lookData.push(sid)
				for (let k = 4; k < 13; k++) lookData.push(tmpPlayersData[i + k])
			}
			const gonePlayers = []
			if (tmpPlayer.rynSeenPlayers) {
				for (const sid of tmpPlayer.rynSeenPlayers) if (!seenPlayers.has(sid)) gonePlayers.push(sid)
			}
			tmpPlayer.rynSeenPlayers = seenPlayers
			server.send(tmpPlayer.id, '33', [posData, lookData, gonePlayers])

			const tmpAiData = []
			for (let i = 0; i < ais.length; ++i) {
				let tmpObj = ais[i]
				if (tmpObj && tmpObj.alive && tmpPlayer.canSee(tmpObj)) {
					tmpAiData.push(
						tmpObj.sid,
						tmpObj.index,
						tmpObj.x,
						tmpObj.y,
						Math.round(tmpObj.dir * 100),
						tmpObj.health,
						tmpObj.nameIndex,
						tmpObj.state || 0
					)
				}
			}
			const seenAi = new Set()
			for (let i = 0; i < tmpAiData.length; i += 8) seenAi.add(tmpAiData[i])
			const goneAi = []
			if (tmpPlayer.rynSeenAi) {
				for (const sid of tmpPlayer.rynSeenAi) if (!seenAi.has(sid)) goneAi.push(sid)
			}
			tmpPlayer.rynSeenAi = seenAi
			server.send(tmpPlayer.id, 'a', [tmpAiData, goneAi])

			const tmpObjectsData = []
			for (let i = 0; i < gameObjects.length; i++) {
				let tmpObj = gameObjects[i]
				if (
					tmpObj &&
					tmpObj.active &&
					tmpPlayer.canSee(tmpObj) &&
					tmpObj.visibleToPlayer(tmpPlayer) &&
					!tmpObj.sentTo[tmpPlayer.id]
				) {
					tmpObj.sentTo[tmpPlayer.id] = 1
					tmpObjectsData.push(
						tmpObj.sid,
						tmpObj.x,
						tmpObj.y,
						tmpObj.dir,
						tmpObj.scale,
						tmpObj.type,
						tmpObj.id,
						tmpObj.owner ? tmpObj.owner.sid : -1
					)
				}
			}
			server.send(tmpPlayer.id, '6', [tmpObjectsData])
		}
	}
}
let rynTickTimer = setInterval(gameTick, 1000 / config.serverUpdateRate)

function updateLeaderboard() {
	const tmpLeaderboardData = []
	for (const player of players
		.filter(player => player.alive)
		.sort(UTILS.sortByPoints)
		.slice(0, 10)) {
		tmpLeaderboardData.push(player.sid, player.name, player.points)
	}
	server.sendAll('5', [tmpLeaderboardData])
}

// Update Leaderboard
setInterval(() => {
	for (let i = 0; i < players.length; i++) {
		if (players[i].pps) {
			scoreCallback(players[i], players[i].pps)
		}
	}
	updateLeaderboard()
}, 1000)

// SEND MAP DATA
setInterval(() => {
	for (const key in tribeManager.tribes) {
		const tmpMembers = tribeManager.tribes[key].members
		const tmpPlayersID = []
		const posData = []
		for (let i = 0; i < tmpMembers.length; i++) {
			const tmpPlayer = findPlayerBySID(tmpMembers[i])
			tmpPlayersID.push(tmpPlayer.id)
			posData.push(tmpPlayer.x, tmpPlayer.y)
		}
		for (let i = 0; i < tmpPlayersID.length; i++) {
			server.send(tmpPlayersID[i], 'mm', [
				posData.filter((value, index) => ![i * 2, i * 2 + 1].includes(index))
			])
		}
	}
	for (let i = 0; i < players.length; i++) {
		if (players[i].team == null) {
			server.send(players[i].id, 'mm', [0])
		}
	}
}, 3000)

function scoreCallback(player, amount, setResource) {
	player.points += amount
	player.earnXP(amount)
	server.send(player.id, '9', ['points', Math.round(player.points), 1])
}

function iconCallback() {
	var highestKill = 0
	var highest = null
	for (let i = 0; i < players.length; i++) {
		const player = players[i]
		player.iconIndex = 0
		if (
			player &&
			player.alive &&
			player.kills > 0 &&
			(highest == null || highestKill < player.kills)
		) {
			highest = i
			highestKill = player.kill
		}
	}
	if (highest !== null) {
		players[highest].iconIndex = 1
	}
}

function addBossArenaStones(stoneCount, stoneScale, xCenter, yCenter) {
	const arenaScale = (stoneScale * stoneCount) / Math.PI
	for (let i = 0; i <= stoneCount; i++) {
		let tmpX = xCenter + arenaScale * Math.cos((i * 2 * Math.PI) / stoneCount)
		let tmpY = yCenter + arenaScale * Math.sin((i * 2 * Math.PI) / stoneCount)
		let size = UTILS.randInt(0, 1)
		if (i === 0) {
			tmpX -= 175
			size = 2
		} else if (i === stoneCount) {
			tmpX += 175
			size = 2
		}
		objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			config.rockScales[size],
			2,
			null,
			true,
			null
		)
	}
}

function addTree(treeCount) {
	for (let j = 0; j < treeCount; j++) {
		const tmpX = UTILS.randFloat(0, config.mapScale)
		const tmpY = UTILS.randInt(0, 1)
			? UTILS.randFloat(0, 6850)
			: UTILS.randFloat(7550, 12000)
		const size = config.treeScales[UTILS.randInt(0, 3)]
		let overlap

		for (let i = 0; i < gameObjects.length; i++) {
			if (
				UTILS.getDistance(tmpX, tmpY, gameObjects[i].x, gameObjects[i].y) <
				100 + size
			) {
				overlap = true
				break
			}
		}
		if (overlap) continue

		objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			size,
			0,
			null,
			true,
			null
		)
	}
}

function addBush(bushCount) {
	for (let j = 0; j < bushCount; j++) {
		const tmpX = UTILS.randFloat(0, config.mapScale)
		const tmpY = UTILS.randInt(0, 1)
			? UTILS.randFloat(0, 6850)
			: UTILS.randFloat(7550, 12000)
		const size = config.bushScales[UTILS.randInt(0, 2)]
		let overlap

		for (let i = 0; i < gameObjects.length; i++) {
			if (
				UTILS.getDistance(tmpX, tmpY, gameObjects[i].x, gameObjects[i].y) <
				100 + size
			) {
				overlap = true
				break
			}
		}
		if (overlap) continue

		objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			size,
			1,
			null,
			true,
			null
		)
	}
}

function addCacti(cactiCount) {
	for (let j = 0; j < cactiCount; j++) {
		const tmpX = UTILS.randFloat(0, config.mapScale)
		const tmpY = UTILS.randFloat(12000, config.mapScale)
		const size = config.bushScales[2]
		let overlap

		for (let i = 0; i < gameObjects.length; i++) {
			if (
				UTILS.getDistance(tmpX, tmpY, gameObjects[i].x, gameObjects[i].y) <
				100 + size
			) {
				overlap = true
				break
			}
		}
		if (overlap) continue

		const tmpObj = objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			size,
			1,
			null,
			true,
			null
		)
		tmpObj.dmg = 35
	}
}

function addStoneGold(stoneCount, isStone) {
	for (let j = 0; j < stoneCount; j++) {
		const tmpX = UTILS.randFloat(0, config.mapScale)
		const tmpY = UTILS.randInt(0, 1)
			? UTILS.randFloat(0, 6850)
			: UTILS.randFloat(7550, config.mapScale)
		const size = config.rockScales[UTILS.randInt(0, 2)]
		let overlap

		for (let i = 0; i < gameObjects.length; i++) {
			if (
				UTILS.getDistance(tmpX, tmpY, gameObjects[i].x, gameObjects[i].y) <
				100 + size
			) {
				overlap = true
				break
			}
		}
		if (overlap) continue

		objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			size,
			isStone ? 2 : 3,
			null,
			true,
			null
		)
	}
}

function addRiverStone(riverStoneCount) {
	for (let j = 0; j < riverStoneCount; j++) {
		const tmpX = UTILS.randFloat(0, config.mapScale)
		const tmpY = UTILS.randFloat(6850, 7550)
		const size = config.rockScales[UTILS.randInt(0, 2)]
		let overlap

		for (let i = 0; i < gameObjects.length; i++) {
			if (
				UTILS.getDistance(tmpX, tmpY, gameObjects[i].x, gameObjects[i].y) <
				100 + size
			) {
				overlap = true
				break
			}
		}
		if (overlap) continue

		objectManager.add(
			objectManager.objects.length,
			tmpX,
			tmpY,
			UTILS.randFloat(-Math.PI, Math.PI),
			size,
			2,
			null,
			true,
			null
		)
	}
}

function addAnimal() {
	if (!config.spawnMobs) return
	// cow, pig, bull, bully, wolf, quack, moostafa, treasure, moofie,
	// boar, yeti, crab king, sheep (crabs and crablings come with the King)
	const animalCount = [10, 10, 10, 2, 15, 2, 1, 1, 1, 6, 2, 1, 10]
	const hostileTypes = [2, 3, 4, 9, 10]
	const bossTypes = [6, 7, 8, 11]
	for (let i = 0; i < animalCount.length; i++) {
		if (!config.spawnHostile && hostileTypes.includes(i)) continue
		if (!config.spawnBosses && bossTypes.includes(i)) continue
		if (config.disabledMobTypes && config.disabledMobTypes.includes(i)) continue
		for (let j = 0; j < animalCount[i]; j++) {
			if (i === 11) {
				const home = config.secretPool.pool[0]
				aiManager.spawn(home[0], home[1], Math.PI, i)
				continue
			}
			if (i === 10) {
				aiManager.spawn(UTILS.randFloat(0, config.mapScale), UTILS.randFloat(0, config.snowBiomeTop), Math.PI / 2, i)
				continue
			}
			aiManager.spawn(
				animalCount[i] === 1
					? config.mapScale / 2
					: UTILS.randFloat(0, config.mapScale),
				animalCount[i] === 1
					? config.mapScale - config.snowBiomeTop / 2
					: UTILS.randFloat(0, config.mapScale),
				Math.PI / 2,
				i
			)
		}
	}
}

function setupServer() {
	config.isStarted = false
	ais = []
	players = []
	gameObjects = []
	projectiles = []
	connection = []
	playersSid = []
	objectManager = new ObjectManager(
		GameObject,
		gameObjects,
		UTILS,
		config,
		players,
		server
	)
	aiManager = new AiManager(
		ais,
		AI,
		players,
		items,
		objectManager,
		config,
		UTILS,
		scoreCallback,
		server
	)
	projectileManager = new ProjectileManager(
		Projectile,
		projectiles,
		players,
		ais,
		objectManager,
		items,
		config,
		UTILS,
		server
	)
	tribeManager = new TribeManager(Tribe, findPlayerBySID, server)

	server.clients.forEach(socket => {
		if (socket.readyState === WebSocket.OPEN) {
			socket.close()
		}
	})

	if (['NORMAL', 'SANDBOX', 'ZOMBIE'].includes(MODE)) {
		config.inSandbox = MODE === 'SANDBOX'
		config.canHitObj = true
		addBossArenaStones(
			config.totalRocks - 1,
			config.rockScales[1],
			config.mapScale / 2,
			config.mapScale - config.snowBiomeTop / 2
		)
		addTree(200)
		addBush(100)
		addCacti(20)
		addStoneGold(100, true)
		addStoneGold(10, false)
		addRiverStone(15)
		addAnimal()
	} else if (MODE === 'HOCKEY') {
		config.canHitObj = false
		for (let i = 0; i < 40; i++) {
			objectManager.add(
				objectManager.objects.length,
				3000 + i * items.list[18].scale * 2,
				3000,
				0,
				items.list[18].scale,
				items.list[18].id,
				items.list[18]
			)
			objectManager.add(
				objectManager.objects.length,
				3000 + i * items.list[18].scale * 2,
				3000 + 19 * items.list[18].scale * 2,
				0,
				items.list[18].scale,
				items.list[18].id,
				items.list[18]
			)
		}
		for (let i = 0; i < 20; i++) {
			if (i >= 7 && i <= 12) continue
			objectManager.add(
				objectManager.objects.length,
				3000,
				3000 + i * items.list[18].scale * 2,
				Math.PI / 2,
				items.list[18].scale,
				items.list[18].id,
				items.list[18]
			)
			objectManager.add(
				objectManager.objects.length,
				3000 + 39 * items.list[18].scale * 2,
				3000 + i * items.list[18].scale * 2,
				Math.PI / 2,
				items.list[18].scale,
				items.list[18].id,
				items.list[18]
			)
		}

		playersSid = [1]
		let tmpA = new Player(
			UTILS.randomString(10),
			1,
			config,
			UTILS,
			projectileManager,
			objectManager,
			players,
			ais,
			items,
			hats,
			accessories,
			server,
			scoreCallback,
			iconCallback,
			MODE
		)
		players.push(tmpA)
	}
}

const httpServer = http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Request-Method', '*')
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET')
	res.setHeader('Access-Control-Allow-Headers', '*')

	const tmpObj = []
	for (let i = 0; i < players.length; i++) {
		tmpObj.push({
			name: players[i].name,
			sid: players[i].sid
		})
	}
	res.writeHead(200)
	res.end(JSON.stringify(tmpObj))
})

httpServer.on('upgrade', (request, socket, head) => {
	const pathname = url.parse(request.url).pathname?.replace(/\/$/, '')

	if (pathname === '/server') {
		server.handleUpgrade(request, socket, head, ws => {
			server.emit('connection', ws, request)
		})
	} else {
		socket.destroy()
	}
})

httpServer.listen(PORT, () => {
	setupServer()
	commandStart()
})

async function commandStart() {
	console.clear()
	if (!(await checkLatest())) {
		console.log(
			'Update available at https://github.com/kookywarrior/moomooio-private-server'
		)
	}
	console.log(`Private server listening at http://localhost:${PORT}\n`)
	const command = await inquirer.prompt({
		name: 'command',
		type: 'list',
		message: 'Custom command',
		choices: [
			'Change mode',
			'Change password',
			'Change prefix',
			'Kick player',
			'Restart server'
		]
	})
	if (command.command === 'Change mode') {
		const mode = await inquirer.prompt({
			name: 'mode',
			type: 'list',
			message: 'Select mode',
			choices: ['NORMAL', 'SANDBOX', 'HOCKEY']
		})
		const modeType = [['HOCKEY'], ['SANDBOX', 'NORMAL']]
		function areInSameGroup(arg1, arg2) {
			for (const group of modeType) {
				if (group.includes(arg1) && group.includes(arg2)) {
					return true
				}
			}
			return false
		}

		if (areInSameGroup(MODE, mode.mode)) {
			MODE = mode.mode
		} else {
			const restart = await inquirer.prompt({
				name: 'restart',
				type: 'confirm',
				message: 'Are you sure you want to restart server?'
			})
			if (restart.restart) {
				MODE = mode.mode
				setupServer()
			}
		}
	} else if (command.command === 'Change password') {
		const password = await inquirer.prompt({
			name: 'password',
			type: 'input',
			message: 'Input password:'
		})
		PASSWORD = password.password
	} else if (command.command === 'Change prefix') {
		const prefix = await inquirer.prompt({
			name: 'prefix',
			type: 'list',
			message: 'Select prefix',
			choices: [
				'!',
				'?',
				'/',
				'\\',
				'`',
				"'",
				'"',
				':',
				'|',
				';',
				'<',
				'>',
				',',
				'.',
				'~'
			]
		})
		PREFIX = prefix.prefix
	} else if (command.command === 'Kick player') {
		const sid = await inquirer.prompt({
			name: 'sid',
			type: 'number',
			message: 'Input player sid:'
		})
		if (sid.sid != null) {
			for (let i = 0; i < players.length; i++) {
				let tmpPlayer = players[i]
				if (tmpPlayer.sid === sid.sid) {
					if (MODE === 'HOCKEY' && sid.sid !== 1) {
						connection[tmpPlayer.id].close()
						break
					} else {
						connection[tmpPlayer.id].close()
						break
					}
				}
			}
		}
	} else if (command.command === 'Restart server') {
		const restart = await inquirer.prompt({
			name: 'restart',
			type: 'confirm',
			message: 'Are you sure you want to restart server?'
		})
		if (restart.restart) {
			setupServer()
		}
	}
	commandStart()
}
