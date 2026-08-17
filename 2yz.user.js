// ==UserScript==
// @name         2yz
// @namespace    2yz
// @version      1.0.0
// @description  Decision-engine client for moomoo.io: one world model, one prediction layer, one target system, one arbiter, one packet scheduler.
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
"use strict";

/* ---- 00-log.js ---- */
/* ===========================================================================
 * 2yz / Log
 * ---------------------------------------------------------------------------
 * Errors inside a per-tick loop are easy to lose: the same one fires sixty
 * times a second and either floods the console or gets swallowed by a bare
 * catch. This collapses repeats and keeps the last of each so the debug panel
 * can show what actually went wrong.
 * =========================================================================== */

const Log = (function () {
    const seen = new Map();

    return {
        error(scope, err) {
            const key = scope + ':' + (err && err.message ? err.message : String(err));
            const entry = seen.get(key);
            if (entry) {
                entry.count++;
                entry.last = Date.now();
                return;
            }
            seen.set(key, { scope, err, count: 1, first: Date.now(), last: Date.now() });
            console.warn('[2yz] ' + scope + ':', err);
        },

        info(scope, message) {
            console.log('[2yz] ' + scope + ': ' + message);
        },

        entries() {
            return Array.from(seen.values()).sort((a, b) => b.last - a.last);
        }
    };
})();


/* ---- 01-defs.js ---- */
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

const DRIVERS = {
  "extractedAt": "2026-08-17T03:21:39.563Z",
  "source": {
    "index": "src/game_index.js",
    "vendor": "src/game_vendor.js"
  },
  "protocol": {
    "signatureBytes": 6,
    "encryptedMode": 1,
    "tableSalt": 1,
    "c2sAlphabet": [
      "M",
      "D",
      "9",
      "e",
      "F",
      "z",
      "H",
      "K",
      "L",
      "N",
      "b",
      "P",
      "Q",
      "c",
      "6",
      "S",
      "0"
    ],
    "s2cAlphabet": [
      "A",
      "B",
      "C",
      "D",
      "E",
      "a",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "X",
      "Y",
      "Z",
      "g",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0"
    ],
    "hmac": "sha256-truncated",
    "codec": "msgpack"
  },
  "config": {
    "maxScreenWidth": 1920,
    "maxScreenHeight": 1080,
    "serverUpdateRate": 9,
    "maxPlayers": 40,
    "maxPlayersHard": 50,
    "collisionDepth": 6,
    "minimapRate": 3000,
    "colGrid": 10,
    "clientSendRate": 5,
    "healthBarWidth": 50,
    "healthBarPad": 4.5,
    "iconPadding": 15,
    "iconPad": 0.9,
    "deathFadeout": 3000,
    "crownIconScale": 60,
    "crownPad": 35,
    "chatCountdown": 3000,
    "chatCooldown": 500,
    "inSandbox": null,
    "maxAge": 100,
    "gatherAngle": 1.208304866765305,
    "gatherWiggle": 10,
    "hitReturnRatio": 0.25,
    "hitAngle": 1.5707963267948966,
    "playerScale": 35,
    "playerSpeed": 0.0016,
    "playerDecel": 0.993,
    "nameY": 34,
    "skinColors": [
      "#bf8f54",
      "#cbb091",
      "#896c4b",
      "#fadadc",
      "#ececec",
      "#c37373",
      "#4c4c4c",
      "#ecaff7",
      "#738cc3",
      "#8bc373"
    ],
    "animalCount": 7,
    "aiTurnRandom": 0.06,
    "cowNames": [
      "Sid",
      "Steph",
      "Bmoe",
      "Romn",
      "Jononthecool",
      "Fiona",
      "Vince",
      "Nathan",
      "Nick",
      "Flappy",
      "Ronald",
      "Otis",
      "Pepe",
      "Mc Donald",
      "Theo",
      "Fabz",
      "Oliver",
      "Jeff",
      "Jimmy",
      "Helena",
      "Reaper",
      "Ben",
      "Alan",
      "Naomi",
      "XYZ",
      "Clever",
      "Jeremy",
      "Mike",
      "Destined",
      "Stallion",
      "Allison",
      "Meaty",
      "Sophia",
      "Vaja",
      "Joey",
      "Pendy",
      "Murdoch",
      "Theo",
      "Jared",
      "July",
      "Sonia",
      "Mel",
      "Dexter",
      "Quinn",
      "Milky"
    ],
    "shieldAngle": 1.0471975511965976,
    "weaponVariants": [
      {
        "id": 0,
        "src": "",
        "xp": 0,
        "val": 1
      },
      {
        "id": 1,
        "src": "_g",
        "xp": 3000,
        "val": 1.1
      },
      {
        "id": 2,
        "src": "_d",
        "xp": 7000,
        "val": 1.18
      },
      {
        "id": 3,
        "src": "_r",
        "poison": true,
        "xp": 12000,
        "val": 1.18
      }
    ],
    "resourceTypes": [
      "wood",
      "food",
      "stone",
      "points"
    ],
    "areaCount": 7,
    "treesPerArea": 9,
    "bushesPerArea": 3,
    "totalRocks": 32,
    "goldOres": 7,
    "riverWidth": 724,
    "riverPadding": 114,
    "waterCurrent": 0.0011,
    "waveSpeed": 0.0001,
    "waveMax": 1.3,
    "treeScales": [
      150,
      160,
      165,
      175
    ],
    "bushScales": [
      80,
      85,
      95
    ],
    "rockScales": [
      80,
      85,
      90
    ],
    "snowBiomeTop": 2400,
    "snowSpeed": 0.75,
    "maxNameLength": 15,
    "mapScale": 14400,
    "mapPingScale": 40,
    "mapPingTime": 2200,
    "MAX_ATTACK": 0.6,
    "MAX_SPAWN_DELAY": 1,
    "MAX_SPEED": 0.3,
    "MAX_TURN_SPEED": 0.3,
    "DAY_INTERVAL": 1440000
  },
  "itemGroups": [
    {
      "id": 0,
      "name": "food",
      "layer": 0
    },
    {
      "id": 1,
      "name": "walls",
      "place": true,
      "limit": 30,
      "layer": 0
    },
    {
      "id": 2,
      "name": "spikes",
      "place": true,
      "limit": 15,
      "layer": 0
    },
    {
      "id": 3,
      "name": "mill",
      "place": true,
      "limit": 7,
      "sandboxLimit": 299,
      "layer": 1
    },
    {
      "id": 4,
      "name": "mine",
      "place": true,
      "limit": 1,
      "layer": 0
    },
    {
      "id": 5,
      "name": "trap",
      "place": true,
      "limit": 6,
      "layer": -1
    },
    {
      "id": 6,
      "name": "booster",
      "place": true,
      "limit": 12,
      "sandboxLimit": 299,
      "layer": -1
    },
    {
      "id": 7,
      "name": "turret",
      "place": true,
      "limit": 2,
      "layer": 1
    },
    {
      "id": 8,
      "name": "watchtower",
      "place": true,
      "limit": 12,
      "layer": 1
    },
    {
      "id": 9,
      "name": "buff",
      "place": true,
      "limit": 4,
      "layer": -1
    },
    {
      "id": 10,
      "name": "spawn",
      "place": true,
      "limit": 1,
      "layer": -1
    },
    {
      "id": 11,
      "name": "sapling",
      "place": true,
      "limit": 2,
      "layer": 0
    },
    {
      "id": 12,
      "name": "blocker",
      "place": true,
      "limit": 3,
      "layer": -1
    },
    {
      "id": 13,
      "name": "teleporter",
      "place": true,
      "limit": 2,
      "sandboxLimit": 299,
      "layer": -1
    }
  ],
  "projectiles": [
    {
      "indx": 0,
      "layer": 0,
      "src": "arrow_1",
      "dmg": 25,
      "speed": 1.6,
      "scale": 103,
      "range": 1000
    },
    {
      "indx": 1,
      "layer": 1,
      "dmg": 25,
      "scale": 20
    },
    {
      "indx": 0,
      "layer": 0,
      "src": "arrow_1",
      "dmg": 35,
      "speed": 2.5,
      "scale": 103,
      "range": 1200
    },
    {
      "indx": 0,
      "layer": 0,
      "src": "arrow_1",
      "dmg": 30,
      "speed": 2,
      "scale": 103,
      "range": 1200
    },
    {
      "indx": 1,
      "layer": 1,
      "dmg": 16,
      "scale": 20
    },
    {
      "indx": 0,
      "layer": 0,
      "src": "bullet_1",
      "dmg": 50,
      "speed": 3.6,
      "scale": 160,
      "range": 1400
    }
  ],
  "weapons": [
    {
      "id": 0,
      "type": 0,
      "name": "tool hammer",
      "desc": "tool for gathering all resources",
      "src": "hammer_1",
      "length": 140,
      "width": 140,
      "xOff": -3,
      "yOff": 18,
      "dmg": 25,
      "range": 65,
      "gather": 1,
      "speed": 300
    },
    {
      "id": 1,
      "type": 0,
      "age": 2,
      "name": "hand axe",
      "desc": "gathers resources at a higher rate",
      "src": "axe_1",
      "length": 140,
      "width": 140,
      "xOff": 3,
      "yOff": 24,
      "dmg": 30,
      "spdMult": 1,
      "range": 70,
      "gather": 2,
      "speed": 400
    },
    {
      "id": 2,
      "type": 0,
      "age": 8,
      "pre": 1,
      "name": "great axe",
      "desc": "deal more damage and gather more resources",
      "src": "great_axe_1",
      "length": 140,
      "width": 140,
      "xOff": -8,
      "yOff": 25,
      "dmg": 35,
      "spdMult": 1,
      "range": 75,
      "gather": 4,
      "speed": 400
    },
    {
      "id": 3,
      "type": 0,
      "age": 2,
      "name": "short sword",
      "desc": "increased attack power but slower move speed",
      "src": "sword_1",
      "iPad": 1.3,
      "length": 130,
      "width": 210,
      "xOff": -8,
      "yOff": 46,
      "dmg": 35,
      "spdMult": 0.85,
      "range": 110,
      "gather": 1,
      "speed": 300
    },
    {
      "id": 4,
      "type": 0,
      "age": 8,
      "pre": 3,
      "name": "katana",
      "desc": "greater range and damage",
      "src": "samurai_1",
      "iPad": 1.3,
      "length": 130,
      "width": 210,
      "xOff": -8,
      "yOff": 59,
      "dmg": 40,
      "spdMult": 0.8,
      "range": 118,
      "gather": 1,
      "speed": 300
    },
    {
      "id": 5,
      "type": 0,
      "age": 2,
      "name": "polearm",
      "desc": "long range melee weapon",
      "src": "spear_1",
      "iPad": 1.3,
      "length": 130,
      "width": 210,
      "xOff": -8,
      "yOff": 53,
      "dmg": 45,
      "knock": 0.2,
      "spdMult": 0.82,
      "range": 142,
      "gather": 1,
      "speed": 700
    },
    {
      "id": 6,
      "type": 0,
      "age": 2,
      "name": "bat",
      "desc": "fast long range melee weapon",
      "src": "bat_1",
      "iPad": 1.3,
      "length": 110,
      "width": 180,
      "xOff": -8,
      "yOff": 53,
      "dmg": 20,
      "knock": 0.7,
      "range": 110,
      "gather": 1,
      "speed": 300
    },
    {
      "id": 7,
      "type": 0,
      "age": 2,
      "name": "daggers",
      "desc": "really fast short range weapon",
      "src": "dagger_1",
      "iPad": 0.8,
      "length": 110,
      "width": 110,
      "xOff": 18,
      "yOff": 0,
      "dmg": 20,
      "knock": 0.1,
      "range": 65,
      "gather": 1,
      "hitSlow": 0.1,
      "spdMult": 1.13,
      "speed": 100
    },
    {
      "id": 8,
      "type": 0,
      "age": 2,
      "name": "stick",
      "desc": "great for gathering but very weak",
      "src": "stick_1",
      "length": 140,
      "width": 140,
      "xOff": 3,
      "yOff": 24,
      "dmg": 1,
      "spdMult": 1,
      "range": 70,
      "gather": 7,
      "speed": 400
    },
    {
      "id": 9,
      "type": 1,
      "age": 6,
      "name": "hunting bow",
      "desc": "bow used for ranged combat and hunting",
      "src": "bow_1",
      "req": [
        "wood",
        4
      ],
      "length": 120,
      "width": 120,
      "xOff": -6,
      "yOff": 0,
      "projectile": 0,
      "spdMult": 0.75,
      "speed": 600
    },
    {
      "id": 10,
      "type": 1,
      "age": 6,
      "name": "great hammer",
      "desc": "hammer used for destroying structures",
      "src": "great_hammer_1",
      "length": 140,
      "width": 140,
      "xOff": -9,
      "yOff": 25,
      "dmg": 10,
      "spdMult": 0.88,
      "range": 75,
      "sDmg": 7.5,
      "gather": 1,
      "speed": 400
    },
    {
      "id": 11,
      "type": 1,
      "age": 6,
      "name": "wooden shield",
      "desc": "blocks projectiles and reduces melee damage",
      "src": "shield_1",
      "length": 120,
      "width": 120,
      "shield": 0.2,
      "xOff": 6,
      "yOff": 0,
      "spdMult": 0.7
    },
    {
      "id": 12,
      "type": 1,
      "age": 8,
      "pre": 9,
      "name": "crossbow",
      "desc": "deals more damage and has greater range",
      "src": "crossbow_1",
      "req": [
        "wood",
        5
      ],
      "aboveHand": true,
      "armS": 0.75,
      "length": 120,
      "width": 120,
      "xOff": -4,
      "yOff": 0,
      "projectile": 2,
      "spdMult": 0.7,
      "speed": 700
    },
    {
      "id": 13,
      "type": 1,
      "age": 9,
      "pre": 12,
      "name": "repeater crossbow",
      "desc": "high firerate crossbow with reduced damage",
      "src": "crossbow_2",
      "req": [
        "wood",
        10
      ],
      "aboveHand": true,
      "armS": 0.75,
      "length": 120,
      "width": 120,
      "xOff": -4,
      "yOff": 0,
      "projectile": 3,
      "spdMult": 0.7,
      "speed": 230
    },
    {
      "id": 14,
      "type": 1,
      "age": 6,
      "name": "mc grabby",
      "desc": "steals resources from enemies",
      "src": "grab_1",
      "length": 130,
      "width": 210,
      "xOff": -8,
      "yOff": 53,
      "dmg": 0,
      "steal": 250,
      "knock": 0.2,
      "spdMult": 1.05,
      "range": 125,
      "gather": 0,
      "speed": 700
    },
    {
      "id": 15,
      "type": 1,
      "age": 9,
      "pre": 12,
      "name": "musket",
      "desc": "slow firerate but high damage and range",
      "src": "musket_1",
      "req": [
        "stone",
        10
      ],
      "aboveHand": true,
      "rec": 0.35,
      "armS": 0.6,
      "hndS": 0.3,
      "hndD": 1.6,
      "length": 205,
      "width": 205,
      "xOff": 25,
      "yOff": 0,
      "projectile": 5,
      "hideProjectile": true,
      "spdMult": 0.6,
      "speed": 1500
    }
  ],
  "items": [
    {
      "group": {
        "id": 0,
        "name": "food",
        "layer": 0
      },
      "name": "apple",
      "desc": "restores 20 health when consumed",
      "req": [
        "food",
        10
      ],
      "scale": 22,
      "holdOffset": 15,
      "heal": 20
    },
    {
      "age": 3,
      "group": {
        "id": 0,
        "name": "food",
        "layer": 0
      },
      "name": "cookie",
      "desc": "restores 40 health when consumed",
      "req": [
        "food",
        15
      ],
      "scale": 27,
      "holdOffset": 15,
      "heal": 40
    },
    {
      "age": 7,
      "group": {
        "id": 0,
        "name": "food",
        "layer": 0
      },
      "name": "cheese",
      "desc": "restores 30 health and another 50 over 5 seconds",
      "req": [
        "food",
        25
      ],
      "scale": 27,
      "holdOffset": 15,
      "heal": 30,
      "healOverTime": {
        "perTick": 10,
        "ticks": 5
      }
    },
    {
      "group": {
        "id": 1,
        "name": "walls",
        "place": true,
        "limit": 30,
        "layer": 0
      },
      "name": "wood wall",
      "desc": "provides protection for your village",
      "req": [
        "wood",
        10
      ],
      "projDmg": true,
      "health": 380,
      "scale": 50,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 3,
      "group": {
        "id": 1,
        "name": "walls",
        "place": true,
        "limit": 30,
        "layer": 0
      },
      "name": "stone wall",
      "desc": "provides improved protection for your village",
      "req": [
        "stone",
        25
      ],
      "health": 900,
      "scale": 50,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "pre": 1,
      "group": {
        "id": 1,
        "name": "walls",
        "place": true,
        "limit": 30,
        "layer": 0
      },
      "name": "castle wall",
      "desc": "provides powerful protection for your village",
      "req": [
        "stone",
        35
      ],
      "health": 1500,
      "scale": 52,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "group": {
        "id": 2,
        "name": "spikes",
        "place": true,
        "limit": 15,
        "layer": 0
      },
      "name": "spikes",
      "desc": "damages enemies when they touch them",
      "req": [
        "wood",
        20,
        "stone",
        5
      ],
      "health": 400,
      "dmg": 20,
      "scale": 49,
      "spritePadding": -23,
      "holdOffset": 8,
      "placeOffset": -5
    },
    {
      "age": 5,
      "group": {
        "id": 2,
        "name": "spikes",
        "place": true,
        "limit": 15,
        "layer": 0
      },
      "name": "greater spikes",
      "desc": "damages enemies when they touch them",
      "req": [
        "wood",
        30,
        "stone",
        10
      ],
      "health": 500,
      "dmg": 35,
      "scale": 52,
      "spritePadding": -23,
      "holdOffset": 8,
      "placeOffset": -5
    },
    {
      "age": 9,
      "pre": 1,
      "group": {
        "id": 2,
        "name": "spikes",
        "place": true,
        "limit": 15,
        "layer": 0
      },
      "name": "poison spikes",
      "desc": "poisons enemies when they touch them",
      "req": [
        "wood",
        35,
        "stone",
        15
      ],
      "health": 600,
      "dmg": 30,
      "pDmg": 5,
      "scale": 52,
      "spritePadding": -23,
      "holdOffset": 8,
      "placeOffset": -5
    },
    {
      "age": 9,
      "pre": 2,
      "group": {
        "id": 2,
        "name": "spikes",
        "place": true,
        "limit": 15,
        "layer": 0
      },
      "name": "spinning spikes",
      "desc": "damages enemies when they touch them",
      "req": [
        "wood",
        30,
        "stone",
        20
      ],
      "health": 500,
      "dmg": 45,
      "turnSpeed": 0.003,
      "scale": 52,
      "spritePadding": -23,
      "holdOffset": 8,
      "placeOffset": -5
    },
    {
      "group": {
        "id": 3,
        "name": "mill",
        "place": true,
        "limit": 7,
        "sandboxLimit": 299,
        "layer": 1
      },
      "name": "windmill",
      "desc": "generates gold over time",
      "req": [
        "wood",
        50,
        "stone",
        10
      ],
      "health": 400,
      "pps": 1,
      "turnSpeed": 0.0016,
      "spritePadding": 25,
      "iconLineMult": 12,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": 5
    },
    {
      "age": 5,
      "pre": 1,
      "group": {
        "id": 3,
        "name": "mill",
        "place": true,
        "limit": 7,
        "sandboxLimit": 299,
        "layer": 1
      },
      "name": "faster windmill",
      "desc": "generates more gold over time",
      "req": [
        "wood",
        60,
        "stone",
        20
      ],
      "health": 500,
      "pps": 1.5,
      "turnSpeed": 0.0025,
      "spritePadding": 25,
      "iconLineMult": 12,
      "scale": 47,
      "holdOffset": 20,
      "placeOffset": 5
    },
    {
      "age": 8,
      "pre": 1,
      "group": {
        "id": 3,
        "name": "mill",
        "place": true,
        "limit": 7,
        "sandboxLimit": 299,
        "layer": 1
      },
      "name": "power mill",
      "desc": "generates more gold over time",
      "req": [
        "wood",
        100,
        "stone",
        50
      ],
      "health": 800,
      "pps": 2,
      "turnSpeed": 0.005,
      "spritePadding": 25,
      "iconLineMult": 12,
      "scale": 47,
      "holdOffset": 20,
      "placeOffset": 5
    },
    {
      "age": 5,
      "group": {
        "id": 4,
        "name": "mine",
        "place": true,
        "limit": 1,
        "layer": 0
      },
      "type": 2,
      "name": "mine",
      "desc": "allows you to mine stone",
      "req": [
        "wood",
        20,
        "stone",
        100
      ],
      "iconLineMult": 12,
      "scale": 65,
      "holdOffset": 20,
      "placeOffset": 0
    },
    {
      "age": 5,
      "group": {
        "id": 11,
        "name": "sapling",
        "place": true,
        "limit": 2,
        "layer": 0
      },
      "type": 0,
      "name": "sapling",
      "desc": "allows you to farm wood",
      "req": [
        "wood",
        150
      ],
      "iconLineMult": 12,
      "colDiv": 0.5,
      "scale": 110,
      "holdOffset": 50,
      "placeOffset": -15
    },
    {
      "age": 4,
      "group": {
        "id": 5,
        "name": "trap",
        "place": true,
        "limit": 6,
        "layer": -1
      },
      "name": "pit trap",
      "desc": "pit that traps enemies if they walk over it",
      "req": [
        "wood",
        30,
        "stone",
        30
      ],
      "trap": true,
      "ignoreCollision": true,
      "hideFromEnemy": true,
      "health": 500,
      "colDiv": 0.2,
      "scale": 50,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 4,
      "group": {
        "id": 6,
        "name": "booster",
        "place": true,
        "limit": 12,
        "sandboxLimit": 299,
        "layer": -1
      },
      "name": "boost pad",
      "desc": "provides boost when stepped on",
      "req": [
        "stone",
        20,
        "wood",
        5
      ],
      "ignoreCollision": true,
      "boostSpeed": 1.5,
      "health": 150,
      "colDiv": 0.7,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "group": {
        "id": 7,
        "name": "turret",
        "place": true,
        "limit": 2,
        "layer": 1
      },
      "doUpdate": true,
      "name": "turret",
      "desc": "defensive structure that shoots at enemies",
      "req": [
        "wood",
        200,
        "stone",
        150
      ],
      "health": 800,
      "projectile": 1,
      "shootRange": 700,
      "shootRate": 2200,
      "scale": 43,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "group": {
        "id": 8,
        "name": "watchtower",
        "place": true,
        "limit": 12,
        "layer": 1
      },
      "name": "platform",
      "desc": "platform to shoot over walls and cross over water",
      "req": [
        "wood",
        20
      ],
      "ignoreCollision": true,
      "zIndex": 1,
      "health": 300,
      "scale": 43,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "group": {
        "id": 9,
        "name": "buff",
        "place": true,
        "limit": 4,
        "layer": -1
      },
      "name": "healing pad",
      "desc": "standing on it will slowly heal you",
      "req": [
        "wood",
        30,
        "food",
        10
      ],
      "ignoreCollision": true,
      "healCol": 15,
      "health": 400,
      "colDiv": 0.7,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 9,
      "group": {
        "id": 10,
        "name": "spawn",
        "place": true,
        "limit": 1,
        "layer": -1
      },
      "name": "spawn pad",
      "desc": "you will spawn here when you die but it will dissapear",
      "req": [
        "wood",
        100,
        "stone",
        100
      ],
      "health": 400,
      "ignoreCollision": true,
      "spawnPoint": true,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "group": {
        "id": 12,
        "name": "blocker",
        "place": true,
        "limit": 3,
        "layer": -1
      },
      "name": "blocker",
      "desc": "blocks building in radius",
      "req": [
        "wood",
        30,
        "stone",
        25
      ],
      "ignoreCollision": true,
      "blocker": 300,
      "health": 400,
      "colDiv": 0.7,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": -5
    },
    {
      "age": 7,
      "group": {
        "id": 13,
        "name": "teleporter",
        "place": true,
        "limit": 2,
        "sandboxLimit": 299,
        "layer": -1
      },
      "name": "teleporter",
      "desc": "teleports you to a random point on the map",
      "req": [
        "wood",
        60,
        "stone",
        60
      ],
      "ignoreCollision": true,
      "teleport": true,
      "health": 200,
      "colDiv": 0.7,
      "scale": 45,
      "holdOffset": 20,
      "placeOffset": -5
    }
  ],
  "hats": [
    {
      "id": 45,
      "name": "Shame!",
      "dontSell": true,
      "price": 0,
      "scale": 120,
      "desc": "hacks are for losers"
    },
    {
      "id": 51,
      "name": "Moo Cap",
      "price": 0,
      "scale": 120,
      "desc": "coolest mooer around"
    },
    {
      "id": 50,
      "name": "Apple Cap",
      "price": 0,
      "scale": 120,
      "desc": "apple farms remembers"
    },
    {
      "id": 28,
      "name": "Moo Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 29,
      "name": "Pig Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 30,
      "name": "Fluff Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 36,
      "name": "Pandou Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 37,
      "name": "Bear Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 38,
      "name": "Monkey Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 44,
      "name": "Polar Head",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 35,
      "name": "Fez Hat",
      "price": 0,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 42,
      "name": "Enigma Hat",
      "price": 0,
      "scale": 120,
      "desc": "join the enigma army"
    },
    {
      "id": 43,
      "name": "Blitz Hat",
      "price": 0,
      "scale": 120,
      "desc": "hey everybody i'm blitz"
    },
    {
      "id": 49,
      "name": "Bob XIII Hat",
      "price": 0,
      "scale": 120,
      "desc": "like and subscribe"
    },
    {
      "id": 57,
      "name": "Pumpkin",
      "price": 50,
      "scale": 120,
      "desc": "Spooooky"
    },
    {
      "id": 8,
      "name": "Bummle Hat",
      "price": 100,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 2,
      "name": "Straw Hat",
      "price": 500,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 15,
      "name": "Winter Cap",
      "price": 600,
      "scale": 120,
      "desc": "allows you to move at normal speed in snow",
      "coldM": 1
    },
    {
      "id": 5,
      "name": "Cowboy Hat",
      "price": 1000,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 4,
      "name": "Ranger Hat",
      "price": 2000,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 18,
      "name": "Explorer Hat",
      "price": 2000,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 31,
      "name": "Flipper Hat",
      "price": 2500,
      "scale": 120,
      "desc": "have more control while in water",
      "watrImm": true
    },
    {
      "id": 1,
      "name": "Marksman Cap",
      "price": 3000,
      "scale": 120,
      "desc": "increases arrow speed and range",
      "aMlt": 1.3
    },
    {
      "id": 10,
      "name": "Bush Gear",
      "price": 3000,
      "scale": 160,
      "desc": "allows you to disguise yourself as a bush"
    },
    {
      "id": 48,
      "name": "Halo",
      "price": 3000,
      "scale": 120,
      "desc": "no effect"
    },
    {
      "id": 6,
      "name": "Soldier Helmet",
      "price": 4000,
      "scale": 120,
      "desc": "reduces damage taken but slows movement",
      "spdMult": 0.94,
      "dmgMult": 0.75
    },
    {
      "id": 23,
      "name": "Anti Venom Gear",
      "price": 4000,
      "scale": 120,
      "desc": "makes you immune to poison",
      "poisonRes": 1
    },
    {
      "id": 13,
      "name": "Medic Gear",
      "price": 5000,
      "scale": 110,
      "desc": "slowly regenerates health over time",
      "healthRegen": 3
    },
    {
      "id": 9,
      "name": "Miners Helmet",
      "price": 5000,
      "scale": 120,
      "desc": "earn 1 extra gold per resource",
      "extraGold": 1
    },
    {
      "id": 32,
      "name": "Musketeer Hat",
      "price": 5000,
      "scale": 120,
      "desc": "reduces cost of projectiles",
      "projCost": 0.5
    },
    {
      "id": 7,
      "name": "Bull Helmet",
      "price": 6000,
      "scale": 120,
      "desc": "increases damage done but drains health",
      "healthRegen": -5,
      "dmgMultO": 1.5,
      "spdMult": 0.96
    },
    {
      "id": 22,
      "name": "Emp Helmet",
      "price": 6000,
      "scale": 120,
      "desc": "turrets won't attack but you move slower",
      "antiTurret": 1,
      "spdMult": 0.7
    },
    {
      "id": 12,
      "name": "Booster Hat",
      "price": 6000,
      "scale": 120,
      "desc": "increases your movement speed",
      "spdMult": 1.16
    },
    {
      "id": 26,
      "name": "Barbarian Armor",
      "price": 8000,
      "scale": 120,
      "desc": "knocks back enemies that attack you",
      "dmgK": 0.6
    },
    {
      "id": 21,
      "name": "Plague Mask",
      "price": 10000,
      "scale": 120,
      "desc": "melee attacks deal poison damage",
      "poisonDmg": 5,
      "poisonTime": 6
    },
    {
      "id": 46,
      "name": "Bull Mask",
      "price": 10000,
      "scale": 120,
      "desc": "bulls won't target you unless you attack them",
      "bullRepel": 1
    },
    {
      "id": 14,
      "name": "Windmill Hat",
      "topSprite": true,
      "price": 10000,
      "scale": 120,
      "desc": "generates points while worn",
      "pps": 1.5
    },
    {
      "id": 11,
      "name": "Spike Gear",
      "topSprite": true,
      "price": 10000,
      "scale": 120,
      "desc": "deal damage to players that damage you",
      "dmg": 0.45
    },
    {
      "id": 53,
      "name": "Turret Gear",
      "topSprite": true,
      "price": 10000,
      "scale": 120,
      "desc": "you become a walking turret",
      "turret": {
        "proj": 1,
        "range": 700,
        "rate": 2500
      },
      "spdMult": 0.7
    },
    {
      "id": 20,
      "name": "Samurai Armor",
      "price": 12000,
      "scale": 120,
      "desc": "increased attack speed and fire rate",
      "atkSpd": 0.78
    },
    {
      "id": 58,
      "name": "Dark Knight",
      "price": 12000,
      "scale": 120,
      "desc": "restores health when you deal damage",
      "healD": 0.4
    },
    {
      "id": 27,
      "name": "Scavenger Gear",
      "price": 15000,
      "scale": 120,
      "desc": "earn double points for each kill",
      "kScrM": 2
    },
    {
      "id": 40,
      "name": "Tank Gear",
      "price": 15000,
      "scale": 120,
      "desc": "increased damage to buildings but slower movement",
      "spdMult": 0.3,
      "bDmg": 3.3
    },
    {
      "id": 52,
      "name": "Thief Gear",
      "price": 15000,
      "scale": 120,
      "desc": "steal half of a players gold when you kill them",
      "goldSteal": 0.5
    },
    {
      "id": 55,
      "name": "Bloodthirster",
      "price": 20000,
      "scale": 120,
      "desc": "Restore Health when dealing damage. And increased damage",
      "healD": 0.25,
      "dmgMultO": 1.2
    },
    {
      "id": 56,
      "name": "Assassin Gear",
      "price": 20000,
      "scale": 120,
      "desc": "Go invisible when not moving. Can't eat. Increased speed",
      "noEat": true,
      "spdMult": 1.1,
      "invisTimer": 1000
    }
  ],
  "accessories": [
    {
      "id": 12,
      "name": "Snowball",
      "price": 1000,
      "scale": 105,
      "xOff": 18,
      "desc": "no effect"
    },
    {
      "id": 9,
      "name": "Tree Cape",
      "price": 1000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 10,
      "name": "Stone Cape",
      "price": 1000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 3,
      "name": "Cookie Cape",
      "price": 1500,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 8,
      "name": "Cow Cape",
      "price": 2000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 11,
      "name": "Monkey Tail",
      "price": 2000,
      "scale": 97,
      "xOff": 25,
      "desc": "Super speed but reduced damage",
      "spdMult": 1.35,
      "dmgMultO": 0.2
    },
    {
      "id": 17,
      "name": "Apple Basket",
      "price": 3000,
      "scale": 80,
      "xOff": 12,
      "desc": "slowly regenerates health over time",
      "healthRegen": 1
    },
    {
      "id": 6,
      "name": "Winter Cape",
      "price": 3000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 4,
      "name": "Skull Cape",
      "price": 4000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 5,
      "name": "Dash Cape",
      "price": 5000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 2,
      "name": "Dragon Cape",
      "price": 6000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 1,
      "name": "Super Cape",
      "price": 8000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 7,
      "name": "Troll Cape",
      "price": 8000,
      "scale": 90,
      "desc": "no effect"
    },
    {
      "id": 14,
      "name": "Thorns",
      "price": 10000,
      "scale": 115,
      "xOff": 20,
      "desc": "no effect"
    },
    {
      "id": 15,
      "name": "Blockades",
      "price": 10000,
      "scale": 95,
      "xOff": 15,
      "desc": "no effect"
    },
    {
      "id": 20,
      "name": "Devils Tail",
      "price": 10000,
      "scale": 95,
      "xOff": 20,
      "desc": "no effect"
    },
    {
      "id": 16,
      "name": "Sawblade",
      "price": 12000,
      "scale": 90,
      "spin": true,
      "xOff": 0,
      "desc": "deal damage to players that damage you",
      "dmg": 0.15
    },
    {
      "id": 13,
      "name": "Angel Wings",
      "price": 15000,
      "scale": 138,
      "xOff": 22,
      "desc": "slowly regenerates health over time",
      "healthRegen": 3
    },
    {
      "id": 19,
      "name": "Shadow Wings",
      "price": 15000,
      "scale": 138,
      "xOff": 22,
      "desc": "increased movement speed",
      "spdMult": 1.1
    },
    {
      "id": 18,
      "name": "Blood Wings",
      "price": 20000,
      "scale": 178,
      "xOff": 26,
      "desc": "restores health when you deal damage",
      "healD": 0.2
    },
    {
      "id": 21,
      "name": "Corrupt X Wings",
      "price": 20000,
      "scale": 178,
      "xOff": 26,
      "desc": "deal damage to players that damage you",
      "dmg": 0.25
    }
  ]
};

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


/* ---- 02-utils.js ---- */
/* ===========================================================================
 * 2yz / Utils
 * ---------------------------------------------------------------------------
 * The geometry here is transcribed from src/game_index.js so that 2yz's idea
 * of "in range", "colliding" and "on the line" matches the server's exactly.
 * Argument orders are the game's, not the conventional ones -- getDirection
 * returns the direction from the SECOND point to the FIRST, and lineInRect
 * takes the rectangle before the segment. Both are kept as-is on purpose.
 * =========================================================================== */

const U = {
    PI: Math.PI,
    PI2: Math.PI * 2,

    toRad(deg) { return (deg * Math.PI) / 180; },
    toDeg(rad) { return (rad * 180) / Math.PI; },

    /* game_index.js:515  qo */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /* Squared distance, for comparisons that never need the root. */
    getDistanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    /* game_index.js:518  Fo -- atan2(y1 - y2, x1 - x2) */
    getDirection(x1, y1, x2, y2) {
        return Math.atan2(y1 - y2, x1 - x2);
    },

    /* game_index.js:521  Xo -- shortest absolute angular separation */
    getAngleDist(a, b) {
        const d = Math.abs(b - a) % (Math.PI * 2);
        return d > Math.PI ? Math.PI * 2 - d : d;
    },

    /* game_index.js:537  Ko -- the game rounds coordinates and angles before
     * they go on the wire, so anything 2yz compares against a received value
     * has to be rounded the same way. */
    fixTo(value, places) {
        return value ? parseFloat(value.toFixed(places)) : 0;
    },

    /* game_index.js:543  Jo -- segment (x1,y1)->(x2,y2) against axis-aligned
     * rect (minX,minY)-(maxX,maxY). This is a Liang-Barsky style clip; it is
     * the game's own containment test, used for hit arcs and projectiles. */
    lineInRect(minX, minY, maxX, maxY, x1, y1, x2, y2) {
        let lo = x1;
        let hi = x2;
        if (x1 > x2) { lo = x2; hi = x1; }
        if (hi > maxX) hi = maxX;
        if (lo < minX) lo = minX;
        if (lo > hi) return false;

        let yLo = y1;
        let yHi = y2;
        const dx = x2 - x1;
        if (Math.abs(dx) > 1e-7) {
            const slope = (y2 - y1) / dx;
            const intercept = y1 - slope * x1;
            yLo = slope * lo + intercept;
            yHi = slope * hi + intercept;
        }
        if (yLo > yHi) { const t = yHi; yHi = yLo; yLo = t; }
        if (yHi > maxY) yHi = maxY;
        if (yLo < minY) yLo = minY;
        return !(yLo > yHi);
    },

    /* Distance from a point to a segment. Used for escape-route width and for
     * "does this spike sit on the lane the enemy is walking down". */
    pointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return U.getDistance(px, py, x1, y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        return U.getDistance(px, py, x1 + t * dx, y1 + t * dy);
    },

    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    /* Small fixed-capacity ring, for movement history. Avoids the repeated
     * array shift() that a plain array of samples would cost every tick. */
    Ring: class Ring {
        constructor(capacity) {
            this.capacity = capacity;
            this.items = new Array(capacity);
            this.head = 0;
            this.size = 0;
        }
        push(value) {
            this.items[this.head] = value;
            this.head = (this.head + 1) % this.capacity;
            if (this.size < this.capacity) this.size++;
        }
        /* 0 = most recent. */
        at(index) {
            if (index >= this.size) return undefined;
            return this.items[(this.head - 1 - index + this.capacity * 2) % this.capacity];
        }
        clear() { this.head = 0; this.size = 0; }
    }
};


/* ---- 10-transport.js ---- */
/* ===========================================================================
 * 2yz / Transport
 * ---------------------------------------------------------------------------
 * 2yz does not reach into the game bundle. It attaches one level lower, at the
 * socket, and keeps its own view of the world built from the wire. That choice
 * is what makes the rest of the client independent: there is no minified
 * identifier anywhere in 2yz, so a rebuild of the game bundle cannot silently
 * unbind a hook.
 *
 * Everything in this file is a transcription of the shipped transport in
 * src/game_index.js:
 *
 *   Co   292-ish  splitmix-style seeded PRNG
 *   Oi   292      seeded Fisher-Yates permutation of an opcode alphabet
 *   Po   312      builds {c2s, s2c} from the io-init seed
 *   Vt   320      SHA-256
 *   Ao   381      HMAC-SHA256
 *   Eo   397      HMAC truncated to protocol.signatureBytes
 *   Ro   400      hex string -> bytes
 *   O    409      the socket itself: io-init handling, framing, send
 *
 * Frame layout, secure mode (game_index.js:467-480):
 *   [ 6 bytes HMAC-SHA256(key, payload) ][ payload = msgpack([op, args, seq]) ]
 *
 * 2yz takes ownership of the sequence counter. Every outbound frame -- the
 * game's own as much as 2yz's -- is decoded, re-numbered and re-signed here, so
 * there is exactly one writer to the socket and exactly one seq series. That is
 * what lets PacketScheduler reorder, drop and budget packets safely.
 * =========================================================================== */

const Transport = (function () {
    const NativeWebSocket = window.WebSocket;
    const nativeSend = NativeWebSocket.prototype.send;

    const utf8enc = new TextEncoder();
    const utf8dec = new TextDecoder();

    /* ---------------------------------------------------------------- msgpack */

    function Writer() {
        this.buf = new Uint8Array(2048);
        this.view = new DataView(this.buf.buffer);
        this.pos = 0;
    }
    Writer.prototype.need = function (n) {
        if (this.pos + n <= this.buf.byteLength) return;
        let size = this.buf.byteLength * 2;
        while (size < this.pos + n) size *= 2;
        const next = new Uint8Array(size);
        next.set(this.buf);
        this.buf = next;
        this.view = new DataView(next.buffer);
    };
    Writer.prototype.u8 = function (v) { this.need(1); this.view.setUint8(this.pos++, v); };
    Writer.prototype.u16 = function (v) { this.need(2); this.view.setUint16(this.pos, v); this.pos += 2; };
    Writer.prototype.u32 = function (v) { this.need(4); this.view.setUint32(this.pos, v); this.pos += 4; };
    Writer.prototype.i8 = function (v) { this.need(1); this.view.setInt8(this.pos++, v); };
    Writer.prototype.i16 = function (v) { this.need(2); this.view.setInt16(this.pos, v); this.pos += 2; };
    Writer.prototype.i32 = function (v) { this.need(4); this.view.setInt32(this.pos, v); this.pos += 4; };
    Writer.prototype.f64 = function (v) { this.need(8); this.view.setFloat64(this.pos, v); this.pos += 8; };
    Writer.prototype.raw = function (b) { this.need(b.length); this.buf.set(b, this.pos); this.pos += b.length; };

    function encodeValue(w, v) {
        if (v === null || v === undefined) return w.u8(0xc0);
        const t = typeof v;
        if (t === 'boolean') return w.u8(v ? 0xc3 : 0xc2);
        if (t === 'number') return encodeNumber(w, v);
        if (t === 'string') return encodeString(w, v);
        if (Array.isArray(v)) {
            const n = v.length;
            if (n < 16) w.u8(0x90 | n);
            else if (n < 65536) { w.u8(0xdc); w.u16(n); }
            else { w.u8(0xdd); w.u32(n); }
            for (let i = 0; i < n; i++) encodeValue(w, v[i]);
            return undefined;
        }
        if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
            const b = v instanceof ArrayBuffer
                ? new Uint8Array(v)
                : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
            if (b.length < 256) { w.u8(0xc4); w.u8(b.length); }
            else if (b.length < 65536) { w.u8(0xc5); w.u16(b.length); }
            else { w.u8(0xc6); w.u32(b.length); }
            return w.raw(b);
        }
        const keys = Object.keys(v);
        const n = keys.length;
        if (n < 16) w.u8(0x80 | n);
        else if (n < 65536) { w.u8(0xde); w.u16(n); }
        else { w.u8(0xdf); w.u32(n); }
        for (let i = 0; i < n; i++) {
            encodeString(w, keys[i]);
            encodeValue(w, v[keys[i]]);
        }
        return undefined;
    }

    function encodeNumber(w, v) {
        if (!Number.isSafeInteger(v)) { w.u8(0xcb); return w.f64(v); }
        if (v >= 0) {
            if (v < 128) return w.u8(v);
            if (v < 256) { w.u8(0xcc); return w.u8(v); }
            if (v < 65536) { w.u8(0xcd); return w.u16(v); }
            if (v < 4294967296) { w.u8(0xce); return w.u32(v); }
            w.u8(0xcb); return w.f64(v);
        }
        if (v >= -32) return w.u8(0xe0 | (v + 32));
        if (v >= -128) { w.u8(0xd0); return w.i8(v); }
        if (v >= -32768) { w.u8(0xd1); return w.i16(v); }
        if (v >= -2147483648) { w.u8(0xd2); return w.i32(v); }
        w.u8(0xcb); return w.f64(v);
    }

    function encodeString(w, s) {
        const b = utf8enc.encode(s);
        const n = b.length;
        if (n < 32) w.u8(0xa0 | n);
        else if (n < 256) { w.u8(0xd9); w.u8(n); }
        else if (n < 65536) { w.u8(0xda); w.u16(n); }
        else { w.u8(0xdb); w.u32(n); }
        w.raw(b);
    }

    function encode(value) {
        const w = new Writer();
        encodeValue(w, value);
        return w.buf.subarray(0, w.pos);
    }

    function Reader(bytes) {
        this.b = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.pos = 0;
    }
    Reader.prototype.read = function () {
        const c = this.view.getUint8(this.pos++);
        if (c < 0x80) return c;                       // positive fixint
        if (c >= 0xe0) return c - 256;                // negative fixint
        if (c >= 0xa0 && c <= 0xbf) return this.str(c & 0x1f);
        if (c >= 0x90 && c <= 0x9f) return this.arr(c & 0x0f);
        if (c >= 0x80 && c <= 0x8f) return this.map(c & 0x0f);
        switch (c) {
            case 0xc0: return null;
            case 0xc2: return false;
            case 0xc3: return true;
            case 0xc4: return this.bin(this.u8());
            case 0xc5: return this.bin(this.u16());
            case 0xc6: return this.bin(this.u32());
            case 0xca: { const v = this.view.getFloat32(this.pos); this.pos += 4; return v; }
            case 0xcb: { const v = this.view.getFloat64(this.pos); this.pos += 8; return v; }
            case 0xcc: return this.u8();
            case 0xcd: return this.u16();
            case 0xce: return this.u32();
            case 0xcf: { const hi = this.u32(); const lo = this.u32(); return hi * 4294967296 + lo; }
            case 0xd0: { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
            case 0xd1: { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
            case 0xd2: { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
            case 0xd3: { const hi = this.view.getInt32(this.pos); const lo = this.view.getUint32(this.pos + 4); this.pos += 8; return hi * 4294967296 + lo; }
            case 0xd9: return this.str(this.u8());
            case 0xda: return this.str(this.u16());
            case 0xdb: return this.str(this.u32());
            case 0xdc: return this.arr(this.u16());
            case 0xdd: return this.arr(this.u32());
            case 0xde: return this.map(this.u16());
            case 0xdf: return this.map(this.u32());
            default: throw new Error('2yz: unsupported msgpack byte 0x' + c.toString(16));
        }
    };
    Reader.prototype.u8 = function () { return this.view.getUint8(this.pos++); };
    Reader.prototype.u16 = function () { const v = this.view.getUint16(this.pos); this.pos += 2; return v; };
    Reader.prototype.u32 = function () { const v = this.view.getUint32(this.pos); this.pos += 4; return v; };
    Reader.prototype.str = function (n) {
        const s = utf8dec.decode(this.b.subarray(this.pos, this.pos + n));
        this.pos += n;
        return s;
    };
    Reader.prototype.bin = function (n) {
        const s = this.b.subarray(this.pos, this.pos + n);
        this.pos += n;
        return s;
    };
    Reader.prototype.arr = function (n) {
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = this.read();
        return out;
    };
    Reader.prototype.map = function (n) {
        const out = {};
        for (let i = 0; i < n; i++) { const k = this.read(); out[k] = this.read(); }
        return out;
    };

    function decode(bytes) { return new Reader(bytes).read(); }

    /* ------------------------------------------------------- opcode tables */

    /* game_index.js:283  Co */
    function seededRandom(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 1831565813) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* game_index.js:292  Oi */
    function permute(alphabet, seed) {
        const n = alphabet.length;
        const order = alphabet.map((_, i) => i);
        const rand = seededRandom(seed >>> 0);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
        }
        const enc = {};
        const dec = {};
        for (let i = 0; i < n; i++) {
            enc[alphabet[i]] = order[i];
            dec[order[i]] = alphabet[i];
        }
        return { enc, dec };
    }

    /* game_index.js:312  Po -- tableSalt comes from drivers, not from a literal */
    function buildTables(seed) {
        const salted = (seed ^ Math.imul(Defs.protocol.tableSalt, 2654435761)) >>> 0;
        return {
            c2s: permute(Defs.protocol.c2sAlphabet, salted),
            s2c: permute(Defs.protocol.s2cAlphabet, (salted ^ 2246822507) >>> 0)
        };
    }

    /* ------------------------------------------------------------ SHA-256 */

    const K = new Uint32Array([
        1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
        2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
        1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
        264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
        2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
        113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
        1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
        3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
        430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
        1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
        2428436474, 2756734187, 3204031479, 3329325298
    ]);

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    /* game_index.js:320  Vt */
    function sha256(bytes) {
        const h = new Uint32Array([
            1779033703, 3144134277, 1013904242, 2773480762,
            1359893119, 2600822924, 528734635, 1541459225
        ]);
        const len = bytes.length;
        const bitLen = len * 8;
        const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
        padded.set(bytes);
        padded[len] = 0x80;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bitLen >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

        const w = new Uint32Array(64);
        for (let off = 0; off < padded.length; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let a = h[0], b = h[1], c = h[2], d = h[3];
            let e = h[4], f = h[5], g = h[6], hh = h[7];
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) | 0;
                hh = g; g = f; f = e;
                e = (d + t1) | 0;
                d = c; c = b; b = a;
                a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
            h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
            h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
        }
        const out = new Uint8Array(32);
        const ov = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
        return out;
    }

    const BLOCK = 64;

    /* game_index.js:381  Ao */
    function hmac(key, message) {
        let k = key;
        if (k.length > BLOCK) k = sha256(k);
        const padded = new Uint8Array(BLOCK);
        padded.set(k);
        const inner = new Uint8Array(BLOCK + message.length);
        const outer = new Uint8Array(BLOCK + 32);
        for (let i = 0; i < BLOCK; i++) {
            inner[i] = padded[i] ^ 0x36;
            outer[i] = padded[i] ^ 0x5c;
        }
        inner.set(message, BLOCK);
        outer.set(sha256(inner), BLOCK);
        return sha256(outer);
    }

    /* game_index.js:397  Eo -- width comes from drivers, not from a literal 6 */
    function sign(key, payload) {
        return hmac(key, payload).subarray(0, Defs.protocol.signatureBytes);
    }

    /* game_index.js:400  Ro */
    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    /* -------------------------------------------------------------- session */

    const session = {
        socket: null,
        mode: null,       // null until io-init; Defs.protocol.encryptedMode when secure
        key: null,
        tables: null,
        seq: 0,
        ready: false
    };

    const listeners = { inbound: [], outbound: [], open: [], close: [] };

    function emit(channel, a, b) {
        const list = listeners[channel];
        for (let i = 0; i < list.length; i++) {
            try { list[i](a, b); } catch (err) { Log.error('transport/' + channel, err); }
        }
    }

    /* Turn a decoded outbound frame back into bytes, stamping a fresh seq.
     * This is the ONLY place a c2s frame is serialised. */
    function frame(name, args) {
        if (session.mode === Defs.protocol.encryptedMode && session.tables) {
            const op = session.tables.c2s.enc[name];
            if (op === undefined) return null;
            const seq = ++session.seq;
            const payload = encode([op, args, seq]);
            const sig = sign(session.key, payload);
            const out = new Uint8Array(Defs.protocol.signatureBytes + payload.length);
            out.set(sig, 0);
            out.set(payload, Defs.protocol.signatureBytes);
            return out;
        }
        return encode([name, args]);
    }

    /* Decode an outbound frame produced by the game bundle, so 2yz can see what
     * the human is doing and can re-stamp it. Returns {name, args} or null. */
    function unframe(bytes) {
        try {
            if (session.mode === Defs.protocol.encryptedMode && session.tables) {
                const payload = bytes.subarray(Defs.protocol.signatureBytes);
                const parsed = decode(payload);
                if (!Array.isArray(parsed)) return null;
                const name = session.tables.c2s.dec[parsed[0]];
                if (name === undefined) return null;
                return { name, args: parsed[1] || [] };
            }
            const parsed = decode(bytes);
            if (!Array.isArray(parsed)) return null;
            return { name: parsed[0], args: parsed[1] || [] };
        } catch (err) {
            return null;
        }
    }

    function handleInbound(bytes) {
        let parsed;
        try { parsed = decode(bytes); } catch (err) { return; }
        if (!Array.isArray(parsed)) return;

        let name = parsed[0];
        const args = parsed[1] || [];

        if (name === 'io-init') {
            if (args[3] === Defs.protocol.encryptedMode) {
                session.mode = Defs.protocol.encryptedMode;
                session.key = hexToBytes(args[2]);
                session.tables = buildTables(args[1] >>> 0);
                session.seq = 0;
            } else {
                session.mode = null;
                session.key = null;
                session.tables = null;
            }
            session.ready = true;
            emit('open', session);
            return;
        }

        if (session.tables && typeof name === 'number') {
            name = session.tables.s2c.dec[name];
            if (name === undefined) return;
        }
        emit('inbound', name, args);
    }

    /* --------------------------------------------------------------- hook */

    function install() {
        const proto = NativeWebSocket.prototype;
        const origSend = proto.send;

        proto.send = function (data) {
            if (this !== session.socket) return origSend.call(this, data);

            const bytes = data instanceof Uint8Array
                ? data
                : data instanceof ArrayBuffer
                    ? new Uint8Array(data)
                    : null;
            if (!bytes) return origSend.call(this, data);

            const parsed = unframe(bytes);
            if (!parsed) return origSend.call(this, data);

            /* Hand the game's own packet to the scheduler rather than letting it
             * through directly. The scheduler decides whether it survives, and
             * re-frames it so the seq series stays 2yz's. */
            emit('outbound', parsed.name, parsed.args);
            return undefined;
        };

        window.WebSocket = function PatchedWebSocket(url, protocols) {
            const socket = protocols === undefined
                ? new NativeWebSocket(url)
                : new NativeWebSocket(url, protocols);

            /* The game only opens one game socket; the newest one wins. */
            session.socket = socket;
            session.mode = null;
            session.tables = null;
            session.key = null;
            session.seq = 0;
            session.ready = false;

            socket.addEventListener('message', function (event) {
                if (!(event.data instanceof ArrayBuffer)) return;
                handleInbound(new Uint8Array(event.data));
            });
            socket.addEventListener('close', function () {
                if (session.socket === socket) {
                    session.ready = false;
                    session.tables = null;
                    emit('close', session);
                }
            });
            return socket;
        };
        window.WebSocket.prototype = NativeWebSocket.prototype;
        /* readyState constants are non-enumerable on the native constructor, so
         * Object.assign would miss them and any `WebSocket.OPEN` comparison in
         * the game bundle would become undefined. */
        window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
        window.WebSocket.OPEN = NativeWebSocket.OPEN;
        window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
        window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
    }

    return {
        install,
        session,
        encode,
        decode,
        frame,
        /* Put a framed packet on the wire. PacketScheduler is the only caller. */
        write(name, args) {
            const socket = session.socket;
            if (!socket || socket.readyState !== 1) return false;
            const bytes = frame(name, args);
            if (!bytes) return false;
            nativeSend.call(socket, bytes);
            return true;
        },
        on(channel, fn) { listeners[channel].push(fn); },
        isReady() { return session.ready && session.socket && session.socket.readyState === 1; }
    };
})();


/* ---- 11-net.js ---- */
/* ===========================================================================
 * 2yz / Net
 * ---------------------------------------------------------------------------
 * Round-trip time and outbound packet accounting. Both are inputs the modules
 * need and neither belongs to any one of them: Preplace times its release
 * against RTT, and PacketScheduler budgets against the send rate.
 *
 * The game pings every 2500ms (game_index.js:5610-5614, C2S "0" -> S2C "0"),
 * so 2yz reads the RTT off that exchange instead of adding traffic of its own.
 * =========================================================================== */

const Net = (function () {
    let pingSentAt = 0;
    let ping = 0;
    const pingSamples = new U.Ring(8);

    /* Sliding one-second window of outbound frames. */
    let windowStart = 0;
    let windowCount = 0;

    return {
        install() {
            Transport.on('outbound', function (name) {
                if (name === Defs.C2S.PING) pingSentAt = Date.now();
            });
            Transport.on('inbound', function (name) {
                if (name !== Defs.S2C.PING_RESULT || !pingSentAt) return;
                const rtt = Date.now() - pingSentAt;
                pingSentAt = 0;
                pingSamples.push(rtt);
                let sum = 0;
                for (let i = 0; i < pingSamples.size; i++) sum += pingSamples.at(i);
                ping = sum / pingSamples.size;
            });
        },

        pingMs() { return ping; },

        /* Lowest RTT seen recently. Preplace releases against this rather than
         * the mean, because releasing early is recoverable and releasing late
         * is not. */
        minPingMs() {
            if (!pingSamples.size) return ping;
            let min = Infinity;
            for (let i = 0; i < pingSamples.size; i++) min = Math.min(min, pingSamples.at(i));
            return min;
        },

        countFrame() {
            const now = Date.now();
            if (now - windowStart >= 1000) {
                windowStart = now;
                windowCount = 0;
            }
            windowCount++;
        },

        framesThisSecond() {
            if (Date.now() - windowStart >= 1000) return 0;
            return windowCount;
        },

        /* Frames still available in the current second under the configured cap. */
        budgetRemaining() {
            return Math.max(0, Config.get('network.packetsPerSecond') - this.framesThisSecond());
        }
    };
})();


/* ---- 20-gamestate.js ---- */
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
    /* The age tier the pending upgrade choices belong to. UPDATE_UPGRADES
     * carries it, and the upgrade index space is only meaningful against it
     * (game_index.js:4734). */
    upgradeAge: 0,

    /* The spawn payload the game itself last sent. Respawn replays it verbatim
     * rather than reconstructing a name and skin, which would be guessing. */
    lastSpawn: null,

    /* Kills seen this life, for kill-chat. */
    killsThisLife: 0,

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
        this.killsThisLife = 0;
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


/* ---- 21-router.js ---- */
/* ===========================================================================
 * 2yz / Router
 * ---------------------------------------------------------------------------
 * Wire -> GameState. The only place inbound packets are interpreted, and the
 * only place the outbound stream is read for human intent.
 *
 * Every branch below cites the handler in src/game_index.js it mirrors.
 * =========================================================================== */

const Router = (function () {
    const S = Defs.S2C;
    const C = Defs.C2S;

    function upsertPlayer(sid) {
        let p = GameState.players.get(sid);
        if (!p) {
            p = new Entity(sid);
            GameState.players.set(sid, p);
        }
        return p;
    }

    /* --------------------------------------------------------------- inbound */

    const inbound = {
        /* xl -- game_index.js:4629. Argument is the local player's sid. */
        [S.SETUP_GAME](sid) {
            GameState.mySid = sid;
            GameState.inGame = true;
            GameState.self = upsertPlayer(sid);
            /* Ownership buckets were built against the old sid. */
            GameState.myObjects.clear();
            GameState.teamObjects.clear();
            GameState.enemyObjects.clear();
            for (const obj of GameState.objects.values()) GameState.indexObject(obj);
            Events.emit('spawn', GameState.self);
        },

        /* Nl -- game_index.js:5515.
         * data = [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
         * (getData/setData, game_index.js:2291-2305) */
        [S.ADD_PLAYER](data, isYou) {
            const p = upsertPlayer(data[1]);
            p.id = data[0];
            p.name = data[2];
            p.x1 = p.x2 = data[3];
            p.y1 = p.y2 = data[4];
            p.d1 = p.d2 = data[5];
            p.health = data[6];
            p.maxHealth = data[7];
            p.scale = data[8];
            p.alive = true;
            p.history.clear();
            if (isYou) {
                GameState.mySid = p.sid;
                GameState.self = p;
                GameState.inGame = true;
                Events.emit('spawn', p);
            }
        },

        /* zl -- game_index.js:5533. Argument is the player's id, not sid. */
        [S.REMOVE_PLAYER](id) {
            for (const [sid, p] of GameState.players) {
                if (p.id === id) {
                    GameState.players.delete(sid);
                    Events.emit('playerLeft', p);
                    break;
                }
            }
        },

        /* Jl -- game_index.js:5551. Flat, stride 13, field order in
         * Defs.PLAYER_FIELDS. This is the tick packet: everything downstream is
         * driven off it. */
        [S.UPDATE_PLAYERS](flat) {
            const now = Date.now();
            for (const p of GameState.players.values()) p.visible = false;

            const stride = Defs.STRIDE.UPDATE_PLAYERS;
            for (let i = 0; i + stride <= flat.length; i += stride) {
                const p = GameState.players.get(flat[i]);
                if (!p) continue;
                p.t1 = p.t2 === 0 ? now : p.t2;
                p.t2 = now;
                p.x1 = p.x2;
                p.y1 = p.y2;
                p.x2 = flat[i + 1];
                p.y2 = flat[i + 2];
                p.d1 = p.d2;
                p.d2 = flat[i + 3];
                p.buildIndex = flat[i + 4];
                p.weaponIndex = flat[i + 5];
                p.weaponVariant = flat[i + 6];
                p.team = flat[i + 7];
                p.isLeader = flat[i + 8];
                p.skinIndex = flat[i + 9];
                p.tailIndex = flat[i + 10];
                p.zIndex = flat[i + 12];
                p.visible = true;

                /* weaponIndex only reports what is held right now, so the two
                 * slots are latched separately. Ranges, damage and reload speed
                 * for the slot the enemy is NOT holding come from these. */
                if (p.weaponIndex != null && p.weaponIndex < 9) {
                    p.primaryIndex = p.weaponIndex;
                    p.primaryVariant = p.weaponVariant;
                } else if (p.weaponIndex != null && p.weaponIndex > 8) {
                    p.secondaryIndex = p.weaponIndex;
                    p.secondaryVariant = p.weaponVariant;
                }
            }

            GameState.tick++;
            GameState.lastTickDelta = GameState.tickTime ? now - GameState.tickTime : Defs.TICK_MS;
            GameState.tickTime = now;
            Events.emit('tick');
        },

        /* Vl -- game_index.js:5432. Flat, stride 8, fields in Defs.OBJECT_FIELDS.
         * ownerSid < 0 means an unowned natural resource. */
        [S.LOAD_OBJECTS](flat) {
            const stride = Defs.STRIDE.LOAD_OBJECTS;
            for (let i = 0; i + stride <= flat.length; i += stride) {
                GameState.addObject(
                    flat[i], flat[i + 1], flat[i + 2], flat[i + 3],
                    flat[i + 4], flat[i + 5], flat[i + 6],
                    flat[i + 7] >= 0 ? flat[i + 7] : null
                );
            }
        },

        /* Il -- game_index.js:4710 */
        [S.KILL_OBJECT](sid) { GameState.removeObject(sid); },

        /* Ml -- game_index.js:4707 */
        [S.KILL_ALL_OBJECTS](ownerSid) { GameState.removeObjectsOf(ownerSid); },

        /* $l -- game_index.js:5547 */
        [S.UPDATE_HEALTH](sid, health) {
            const p = GameState.players.get(sid);
            if (!p) return;
            const drop = p.health - health;
            p.health = health;
            if (drop > 0) {
                p.lastHealthDrop = drop;
                p.lastHitTick = GameState.tick;
                Events.emit('damage', p, drop);
            }
            if (health <= 0) p.alive = false;
        },

        /* Nn -- game_index.js:4402 */
        [S.UPDATE_ITEMS](list, isWeapon) {
            if (!list) return;
            if (isWeapon) GameState.weapons = list;
            else GameState.items = list;
        },

        /* Yl -- game_index.js:5540 */
        [S.UPDATE_ITEM_COUNTS](groupId, count) {
            GameState.itemCounts[groupId] = count;
        },

        /* Kl -- game_index.js:5543. Generic "set one field on the local player". */
        [S.UPDATE_VALUE](key, value) {
            if (key === 'kills' && value > GameState.resources.kills) {
                GameState.killsThisLife += value - GameState.resources.kills;
                Events.emit('kill', value);
            }
            if (key in GameState.resources) GameState.resources[key] = value;
            else if (key === 'points') GameState.resources.points = value;
            if (GameState.self && (key === 'health' || key === 'maxHealth')) {
                GameState.self[key] = value;
            }
        },

        /* Sl -- game_index.js:4684 */
        [S.KILL_PLAYER]() {
            GameState.inGame = false;
            if (GameState.self) GameState.self.alive = false;
            Events.emit('death');
        },



        /* Pl -- game_index.js:5038, startAnim(didHit, weaponIndex). This is how
         * 2yz sees every swing in the world, including enemies', which is what
         * the reload model and Anti Smart Tick are built on. */
        [S.ATTACK_ANIM](sid, didHit, weaponIndex) {
            const p = GameState.players.get(sid);
            if (!p) return;
            Events.emit('attack', p, weaponIndex, didHit);
        },

        /* jn -- age/XP. Only the age matters, for which items are unlocked. */
        [S.UPDATE_AGE](xp, maxXp, age) {
            if (age != null) GameState.age = age;
        },

        /* Un -- game_index.js:4734. (points, ageTier). Both are needed: the
         * upgrade index space is only valid for the tier it was offered for. */
        [S.UPDATE_UPGRADES](points, ageTier) {
            GameState.upgradePoints = points;
            if (ageTier != null) GameState.upgradeAge = ageTier;
        },

        /* al -- game_index.js:4220.
         *   isEquip truthy -> the item is now worn  (skinIndex / tailIndex)
         *   isEquip falsy   -> the item is now owned (skins[id] / tails[id])
         * This is the only source for which hats we may equip, so Safe Soldier
         * and Combat's damage-hat swap both depend on it. */
        [S.UPDATE_STORE](isEquip, id, isAccessory) {
            if (isAccessory) {
                if (isEquip) { if (GameState.self) GameState.self.tailIndex = id; }
                else GameState.tails[id] = 1;
            } else if (isEquip) {
                if (GameState.self) GameState.self.skinIndex = id;
            } else {
                GameState.skins[id] = 1;
            }
        },

        /* Ja -- game_index.js:4006. Team membership changes who owns what, so
         * the object buckets have to be rebuilt. */
        [S.SET_TEAM](team) {
            if (GameState.self) GameState.self.team = team;
            GameState.myObjects.clear();
            GameState.teamObjects.clear();
            GameState.enemyObjects.clear();
            for (const obj of GameState.objects.values()) GameState.indexObject(obj);
        },

        /* _l -- game_index.js:5444. A Turret Gear discharged. This is the only
         * observable that starts a turret's cooldown, so without it the turret
         * reads as permanently ready and Safe Soldier over-projects. */
        [S.SHOOT_TURRET](sid) {
            const p = GameState.players.get(sid);
            if (p) Events.emit('turretFired', p);
        }
    };

    /* -------------------------------------------------------------- outbound
     * Frames the game bundle tried to send. 2yz records the human's intent and
     * then re-emits through the scheduler, so nothing reaches the socket except
     * via one path. */
    function handleOutbound(name, args) {
        const input = GameState.input;
        switch (name) {
            case C.AIM_DIR:
                input.aimDir = args[0];
                break;
            case C.MOVE_DIR:
                input.moveDir = args[0];
                break;
            case C.MOVE_STOP:
                input.moveDir = null;
                break;
            case C.ATTACK:
                input.attacking = !!args[0];
                break;
            case C.TOGGLE:
                if (args[0] === 1) input.autoGather = !input.autoGather;
                break;
            case C.SPAWN:
                /* Keep the exact payload so respawn can replay it. */
                GameState.lastSpawn = args[0];
                GameState.killsThisLife = 0;
                break;
            default:
                break;
        }
        Scheduler.submitPassthrough(name, args);
    }

    function install() {
        Transport.on('inbound', function (name, args) {
            const fn = inbound[name];
            if (fn) fn.apply(null, args);
        });
        Transport.on('outbound', handleOutbound);
        Transport.on('close', function () { GameState.reset(); });
    }

    return { install, inbound };
})();


/* ---- 22-tracker.js ---- */
/* ===========================================================================
 * 2yz / EntityTracker
 * ---------------------------------------------------------------------------
 * Everything derived from raw state, computed once per tick, in one place.
 * Velocity, facing, reload clocks, trap containment and spike contact all live
 * here so that Combat, the placement modules and the defensive modules read the
 * same numbers rather than each recomputing them.
 *
 * Reload clocks are inferred rather than read: the server tells every client
 * about every swing (S2C ATTACK_ANIM, game_index.js:5038), and weapon cooldowns
 * are in the shipped weapon table, so a swing plus a table lookup gives a
 * cooldown that is correct for weapons 2yz never sees the owner select.
 * =========================================================================== */

const EntityTracker = (function () {
    /* sid -> {primary: msRemaining, secondary: msRemaining, turret: msRemaining} */
    const reloads = new Map();

    /* Turret Gear fire rate, from the shipped hat table rather than a literal. */
    const turretHat = Defs.hats.find((h) => h.turret);
    const TURRET_RATE = turretHat ? turretHat.turret.rate : null;

    function reloadOf(sid) {
        let r = reloads.get(sid);
        if (!r) {
            r = { primary: 0, secondary: 0, turret: 0 };
            reloads.set(sid, r);
        }
        return r;
    }

    function onAttack(player, weaponIndex) {
        const r = reloadOf(player.sid);
        const weapon = Defs.weapons[weaponIndex];
        if (!weapon) return;
        if (weapon.type === 0) {
            r.primary = weapon.speed;
            player.primaryIndex = weaponIndex;
        } else {
            r.secondary = weapon.speed;
            player.secondaryIndex = weaponIndex;
        }
        Events.emit('swing', player, weaponIndex);
    }

    function tickReloads(dt) {
        for (const r of reloads.values()) {
            if (r.primary > 0) r.primary = Math.max(0, r.primary - dt);
            if (r.secondary > 0) r.secondary = Math.max(0, r.secondary - dt);
            if (r.turret > 0) r.turret = Math.max(0, r.turret - dt);
        }
    }

    /* Rebuild the near-object list. Range is generous enough to cover the
     * furthest thing any module asks about (turret range is the widest figure
     * in the shipped tables) and is computed once, not per module. */
    let NEAR_RANGE = 900;
    (function deriveNearRange() {
        let max = 0;
        for (const w of Defs.weapons) if (w.range > max) max = w.range;
        for (const h of Defs.hats) if (h.turret && h.turret.range > max) max = h.turret.range;
        NEAR_RANGE = max + 200;
    })();

    function rebuildNearObjects() {
        const me = GameState.self;
        const out = GameState.nearObjects;
        out.length = 0;
        if (!me) return;
        const r2 = NEAR_RANGE * NEAR_RANGE;
        for (const obj of GameState.objects.values()) {
            if (!obj.active) continue;
            if (U.getDistanceSq(me.x2, me.y2, obj.x, obj.y) <= r2) out.push(obj);
        }
    }

    /* Velocity from the interpolation pair. The game moves entities between two
     * server snapshots, so (x2 - x1) over the snapshot interval is the per-tick
     * displacement -- the same quantity the server integrates. */
    function updateMotion(p, dt) {
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        p.xVel = dx;
        p.yVel = dy;
        p.speed = Math.sqrt(dx * dx + dy * dy);

        p.prevMoveDir = p.moveDir;
        if (p.speed > 0.05) {
            p.moveDir = Math.atan2(dy, dx);
            p.dirChange = U.getAngleDist(p.prevMoveDir, p.moveDir);
        } else {
            p.dirChange = 0;
        }
        p.history.push({ x: p.x2, y: p.y2, dir: p.moveDir, speed: p.speed, t: p.t2 });
    }

    /* Trap containment and spike contact, from the live object list. The game's
     * own rule (game_index.js:2540-ish, checkCollision) is that a trap holds a
     * player when the player's centre is inside the trap's scale and the trap is
     * not the player's own or a teammate's. */
    function updateContacts(p) {
        p.trapped = false;
        p.trapObject = null;
        p.onSpike = null;

        const objects = GameState.nearObjects;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj.active) continue;
            const d = U.getDistance(p.x2, p.y2, obj.x, obj.y);

            if (obj.trap && d < obj.scale) {
                const ownerIsFriendly = obj.ownerSid === p.sid || (
                    obj.ownerSid != null && GameState.isAlly(obj.ownerSid) && GameState.isAlly(p.sid)
                );
                if (!ownerIsFriendly) {
                    p.trapped = true;
                    p.trapObject = obj;
                }
            }

            if (obj.damage > 0 && d < obj.scale + p.scale) {
                p.onSpike = obj;
            }
        }
    }

    function onDamage(player, amount) {
        /* Spike contact at the moment of a health drop is what "spikeDamage"
         * means everywhere downstream: the enemy is being hurt by a structure,
         * so a tick placed on them will land. */
        if (player.onSpike) player.spikeDamage = amount;
    }

    function onTick() {
        const dt = GameState.lastTickDelta;
        if (!GameState.self) { Events.emit('trackerReady'); return; }
        tickReloads(dt);
        rebuildNearObjects();

        for (const p of GameState.players.values()) {
            if (!p.visible) continue;
            updateMotion(p, dt);
            updateContacts(p);
        }

        /* spikeDamage is a one-tick flag, cleared after everyone downstream has
         * had the tick to read it. */
        Events.emit('trackerReady');
        for (const p of GameState.players.values()) p.spikeDamage = 0;
    }

    return {
        install() {
            Events.on('attack', onAttack);
            Events.on('damage', onDamage);
            Events.on('turretFired', function (player) {
                if (TURRET_RATE != null) reloadOf(player.sid).turret = TURRET_RATE;
            });
            Events.on('tick', onTick);
            Events.on('playerLeft', (p) => reloads.delete(p.sid));
        },

        /* --- reload queries, used by Combat and the tick modules ----------- */
        reloadOf,
        primaryReady(sid) { return reloadOf(sid).primary <= 0; },
        secondaryReady(sid) { return reloadOf(sid).secondary <= 0; },
        primaryRemaining(sid) { return reloadOf(sid).primary; },
        secondaryRemaining(sid) { return reloadOf(sid).secondary; },
        turretReady(sid) { return TURRET_RATE != null && reloadOf(sid).turret <= 0; },

        /* --- effective stats, hat and variant included -------------------- */

        weaponOf(player, slot) {
            if (player === GameState.self) {
                return slot === 0 ? GameState.weapons[0] : GameState.weapons[1];
            }
            return slot === 0 ? player.primaryIndex : player.secondaryIndex;
        },

        variantOf(player, slot) {
            return slot === 0 ? player.primaryVariant : player.secondaryVariant;
        },

        hatOf(player) {
            return player.skinIndex ? Defs.hats.find((h) => h.id === player.skinIndex) : null;
        },

        /* Damage a swing of `slot` would do to a player, with weapon variant,
         * Bull Helmet's dmgMultO and the target's Soldier Helmet dmgMult all
         * applied -- every multiplier read from the shipped tables. */
        playerDamage(attacker, slot, victim) {
            const idx = this.weaponOf(attacker, slot);
            const weapon = Defs.weapons[idx];
            if (!weapon || weapon.dmg == null) return 0;
            let dmg = weapon.dmg;
            const variant = Defs.config.weaponVariants[this.variantOf(attacker, slot)];
            if (variant) dmg *= variant.val;
            const aHat = this.hatOf(attacker);
            if (aHat && aHat.dmgMultO) dmg *= aHat.dmgMultO;
            if (victim) {
                const vHat = this.hatOf(victim);
                if (vHat && vHat.dmgMult) dmg *= vHat.dmgMult;
            }
            return dmg;
        },

        /* Damage a swing of `slot` would do to a structure. Tank Gear's bDmg is
         * the building multiplier; sDmg is the weapon's own structure factor. */
        structureDamage(attacker, slot) {
            const idx = this.weaponOf(attacker, slot);
            const weapon = Defs.weapons[idx];
            if (!weapon || weapon.dmg == null) return 0;
            let dmg = weapon.dmg * (weapon.sDmg || 1);
            const variant = Defs.config.weaponVariants[this.variantOf(attacker, slot)];
            if (variant) dmg *= variant.val;
            const hat = this.hatOf(attacker);
            if (hat && hat.bDmg) dmg *= hat.bDmg;
            return dmg;
        },

        rangeOf(player, slot) {
            const weapon = Defs.weapons[this.weaponOf(player, slot)];
            return weapon ? weapon.range : 0;
        },

        /* Movement speed multiplier from hat and held weapon, both from tables. */
        speedMultOf(player) {
            let mult = 1;
            const hat = this.hatOf(player);
            if (hat && hat.spdMult) mult *= hat.spdMult;
            const weapon = Defs.weapons[player.weaponIndex];
            if (weapon && weapon.spdMult) mult *= weapon.spdMult;
            const acc = player.tailIndex
                ? Defs.accessories.find((a) => a.id === player.tailIndex)
                : null;
            if (acc && acc.spdMult) mult *= acc.spdMult;
            return mult;
        },

        /* Does `slot`'s swing get through the target's shield? The game gives a
         * shield an arc of config.shieldAngle centred on the holder's facing;
         * an attack arriving inside that arc is blocked. */
        shieldBypass(attacker, victim) {
            const shield = Defs.weapons[victim.weaponIndex];
            if (!shield || !shield.shield) return true;
            const incoming = U.getDirection(attacker.x2, attacker.y2, victim.x2, victim.y2);
            return U.getAngleDist(victim.d2, incoming) > Defs.config.shieldAngle;
        }
    };
})();


/* ---- 30-prediction.js ---- */
/* ===========================================================================
 * 2yz / Prediction
 * ---------------------------------------------------------------------------
 * One prediction layer for the whole client. Combat, Auto Place, Preplace,
 * Replace, Spike Tick, Anti Smart Tick and Safe Soldier all call in here; none
 * of them integrates a position of its own.
 *
 * The integrator is the game's own, read off the player update step in
 * src/game_index.js:2330-2374. Per update of `f` ms the game does, in this
 * order:
 *
 *   1. vel += dirUnit * playerSpeed * mult * f      (accelerate)
 *   2. pos += vel * f                               (move, on the new vel)
 *   3. vel *= playerDecel^f                         (then decay)
 *
 * Working in per-tick displacement D rather than velocity, that collapses to
 *
 *   D(n) = D(n-1) * playerDecel^f  +  playerSpeed * mult * f^2
 *
 * which is the single recurrence this layer integrates. playerSpeed (0.0016)
 * and playerDecel (0.993) come from the shipped config, not from literals.
 *
 * Three branches, because which one an entity is on is not observable:
 *
 *   accel  holding a direction  -- the full recurrence
 *   decel  released, coasting   -- decay only
 *   hold   at terminal speed    -- displacement carries unchanged
 *
 * `hold` is not redundant with `accel`. They agree only when the observed
 * displacement is exactly at the recurrence's fixed point, and 2yz cannot
 * always compute that point: the game's speed multiplier folds in biome, water
 * current, slowMult and the target's accessory, and none of those are on the
 * wire for other players. `hold` covers a steady walker whose terminal speed
 * we cannot derive, which is the common case.
 *
 * The layer picks whichever branch best explains where the entity actually
 * ended up last tick and reports the fit as `confidence`. A module that needs
 * certainty (Preplace) gates on that number; one that only needs a hint
 * (target sorting) ignores it.
 * =========================================================================== */

const Prediction = (function () {
    const SPEED = Defs.config.playerSpeed;
    const DECEL = Defs.config.playerDecel;

    /* Cache keyed by (sid, horizonTicks), invalidated every tick. Several
     * modules ask for the same horizon on the same entity in one pass; without
     * this the integrator would run five or six times for one answer. */
    let cache = new Map();
    let cacheTick = -1;

    function cacheKey(sid, ticks, mode) { return sid + ':' + ticks + ':' + mode; }

    function ensureCache() {
        if (cacheTick !== GameState.tick) {
            cache = new Map();
            cacheTick = GameState.tick;
        }
    }

    /* Integrate one entity forward. `mode` is 'accel', 'decel', 'hold' or
     * 'auto'. Fractional `ticks` are supported: the whole steps run the
     * recurrence and the remainder is a linear carry of the last displacement. */
    function integrate(entity, ticks, mode, dirOverride) {
        const stepMs = Defs.TICK_MS;
        const mult = EntityTracker.speedMultOf(entity);

        let x = entity.x2;
        let y = entity.y2;
        let vx = entity.xVel;
        let vy = entity.yVel;

        /* A held player is going nowhere regardless of which branch fit. */
        const resolved = mode === 'auto'
            ? (entity.trapped ? 'decel' : (entity.predictMode || 'accel'))
            : mode;

        let dir = dirOverride;
        if (dir == null) dir = entity.moveDir;

        const decay = resolved === 'hold' ? 1 : Math.pow(DECEL, stepMs);
        let ax = 0;
        let ay = 0;
        if (resolved === 'accel' && entity.speed > 0.05 && !entity.trapped) {
            let cx = Math.cos(dir);
            let cy = Math.sin(dir);
            const len = Math.sqrt(cx * cx + cy * cy);
            if (len !== 0) { cx /= len; cy /= len; }
            /* playerSpeed * mult * f, applied to velocity, then f again when
             * that velocity is turned into displacement -- hence f squared. */
            ax = cx * SPEED * mult * stepMs * stepMs;
            ay = cy * SPEED * mult * stepMs * stepMs;
        }

        const whole = Math.floor(ticks);
        for (let i = 0; i < whole; i++) {
            vx = vx * decay + ax;
            vy = vy * decay + ay;
            x += vx;
            y += vy;
        }
        const rest = ticks - whole;
        if (rest > 0) {
            const nx = vx * decay + ax;
            const ny = vy * decay + ay;
            x += nx * rest;
            y += ny * rest;
            vx = nx;
            vy = ny;
        }
        return { x, y, vx, vy, mode: resolved };
    }

    /* How well each branch explained the last observed step. Computed once per
     * entity per tick and stored on the entity. */
    function scoreBranches(entity) {
        if (entity.history.size < 2) {
            entity.predictMode = 'auto';
            entity.predictConfidence = 0.4;
            return;
        }
        const prev = entity.history.at(1);
        const now = entity.history.at(0);
        if (!prev || !now) return;

        /* Two samples back, so the step being scored is one the entity has
         * already taken and we know the answer to. */
        const older = entity.history.at(2);
        if (!older) {
            entity.predictMode = 'accel';
            entity.predictConfidence = 0.4;
            return;
        }

        /* Replay the step from `prev` to `now` under each assumption, starting
         * from the displacement that was observed going into `prev`. */
        const probe = {
            x2: prev.x,
            y2: prev.y,
            xVel: prev.x - older.x,
            yVel: prev.y - older.y,
            speed: prev.speed,
            moveDir: prev.dir,
            trapped: entity.trapped,
            skinIndex: entity.skinIndex,
            tailIndex: entity.tailIndex,
            weaponIndex: entity.weaponIndex
        };

        let bestMode = 'accel';
        let bestErr = Infinity;
        for (const mode of ['accel', 'decel', 'hold']) {
            const guess = integrate(probe, 1, mode, prev.dir);
            const err = U.getDistance(guess.x, guess.y, now.x, now.y);
            if (err < bestErr) { bestErr = err; bestMode = mode; }
        }
        entity.predictMode = bestMode;
        entity.predictFitError = bestErr;

        /* Confidence falls with fit error and with how sharply the entity just
         * turned. A player who reversed direction this tick is not predictable
         * regardless of how well the integrator fit. */
        const fit = U.clamp(1 - bestErr / Config.get('prediction.fitTolerance'), 0, 1);
        const steady = U.clamp(1 - entity.dirChange / Math.PI, 0, 1);
        entity.predictConfidence = fit * 0.6 + steady * 0.4;
    }

    return {
        install() {
            Events.on('trackerReady', function () {
                for (const p of GameState.players.values()) {
                    if (p.visible) scoreBranches(p);
                }
            });
        },

        /* Position `ticks` server ticks from now. `ticks` may be fractional. */
        at(entity, ticks, mode) {
            if (!entity) return null;
            ensureCache();
            const m = mode || entity.predictMode || 'auto';
            const key = cacheKey(entity.sid, ticks, m);
            const hit = cache.get(key);
            if (hit) return hit;
            const result = integrate(entity, ticks, m);
            result.confidence = entity.predictConfidence != null ? entity.predictConfidence : 0.4;
            cache.set(key, result);
            return result;
        },

        /* One tick ahead, the horizon the placement modules use: an object
         * placed now lands on the server roughly one tick from now. */
        next(entity) { return this.at(entity, 1); },

        /* Where the entity will be when a packet sent now arrives, accounting
         * for the round trip. Combat uses this for range checks. */
        atLatency(entity) {
            const rtt = Net.pingMs();
            return this.at(entity, U.clamp(rtt / Defs.TICK_MS, 0, 4));
        },

        confidence(entity) {
            return entity && entity.predictConfidence != null ? entity.predictConfidence : 0;
        },

        /* True when the entity turned hard enough this tick that any candidate
         * built from an earlier prediction should be thrown away. Preplace and
         * Replace both invalidate on this. */
        changedDirection(entity, thresholdRad) {
            if (!entity) return true;
            return entity.dirChange > (thresholdRad != null ? thresholdRad : Config.get('prediction.recalcAngle'));
        },

        /* Will `entity` collide with `obj` on its way to its predicted spot?
         * Used for escape-route scoring and for knockback-into-spike checks. */
        pathHits(entity, obj, ticks) {
            const future = this.at(entity, ticks);
            const pad = entity.scale + obj.scale;
            return U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                entity.x2, entity.y2, future.x, future.y
            );
        },

        /* Where knockback would throw `victim` if hit from (fromX, fromY).
         * The game applies hitReturnRatio of the attacker's push along the
         * attacker->victim direction. */
        knockbackTo(victim, fromX, fromY, distance) {
            const angle = U.getDirection(victim.x2, victim.y2, fromX, fromY);
            const d = distance != null ? distance : Config.get('prediction.knockbackDistance');
            return {
                x: victim.x2 + d * Math.cos(angle),
                y: victim.y2 + d * Math.sin(angle),
                angle
            };
        },

        debugState(entity) {
            if (!entity) return null;
            const n = this.next(entity);
            return {
                mode: entity.predictMode,
                confidence: Math.round(this.confidence(entity) * 100) / 100,
                speed: Math.round(entity.speed * 100) / 100,
                dirChange: Math.round(entity.dirChange * 100) / 100,
                next: { x: Math.round(n.x), y: Math.round(n.y) }
            };
        }
    };
})();


/* ---- 31-targeting.js ---- */
/* ===========================================================================
 * 2yz / Targeting
 * ---------------------------------------------------------------------------
 * One target system. Combat, Auto Place, Preplace, Replace, Spike Tick, Anti
 * Smart Tick and Safe Soldier all read `Targeting.primary` -- there is no
 * second notion of "the enemy" anywhere in the client.
 *
 * The score is deliberately not "nearest wins". A player at 250 who is winding
 * up a great-hammer matters more than one at 180 who is walking away, and the
 * placement modules want the target whose movement they can actually cut off.
 * =========================================================================== */

const Targeting = (function () {
    let primary = null;
    let candidates = [];
    let lastSwitchTick = -999;

    function isValid(p) {
        if (!p || !p.visible || !p.alive) return false;
        if (p.sid === GameState.mySid) return false;
        if (!GameState.self) return false;
        if (!p.isEnemyOf(GameState.self)) return false;
        return true;
    }

    /* Threat: how much damage this player could land on us in the near term,
     * from the shipped tables via EntityTracker. Both slots count, weighted by
     * how close each is to being off cooldown. */
    function threatOf(p) {
        const me = GameState.self;
        if (!me) return 0;
        const dist = U.getDistance(me.x2, me.y2, p.x2, p.y2);

        let threat = 0;
        for (let slot = 0; slot < 2; slot++) {
            const idx = EntityTracker.weaponOf(p, slot);
            if (idx == null) continue;
            const weapon = Defs.weapons[idx];
            if (!weapon) continue;
            const reach = weapon.range + me.scale + p.scale;
            if (dist > reach * 1.6) continue;

            const remaining = slot === 0
                ? EntityTracker.primaryRemaining(p.sid)
                : EntityTracker.secondaryRemaining(p.sid);
            const readiness = weapon.speed ? U.clamp(1 - remaining / weapon.speed, 0, 1) : 1;
            const inReach = dist <= reach ? 1 : 0.35;
            threat += EntityTracker.playerDamage(p, slot, me) * readiness * inReach;
        }

        /* A player closing on us is more dangerous than one at the same range
         * holding still. */
        const closing = closingRate(p);
        if (closing > 0) threat *= 1 + U.clamp(closing / 20, 0, 0.5);
        return threat;
    }

    /* Positive when the gap is shrinking, in units per tick. */
    function closingRate(p) {
        const me = GameState.self;
        if (!me) return 0;
        const now = U.getDistance(me.x2, me.y2, p.x2, p.y2);
        const soon = Prediction.next(p);
        const meSoon = Prediction.next(me);
        const later = U.getDistance(meSoon.x, meSoon.y, soon.x, soon.y);
        return now - later;
    }

    function score(p) {
        const me = GameState.self;
        const dist = U.getDistance(me.x2, me.y2, p.x2, p.y2);
        const w = {
            distance: Config.get('combat.weightDistance'),
            threat: Config.get('combat.weightThreat'),
            vulnerable: Config.get('combat.weightVulnerable')
        };

        /* Distance term, normalised against the search radius so the weights
         * stay comparable. */
        const radius = Config.get('combat.targetRadius');
        const near = U.clamp(1 - dist / radius, 0, 1);

        /* Vulnerability: trapped, low, already bleeding on a spike, or shield
         * pointing the wrong way -- all reasons to commit to this one. */
        let vulnerable = 0;
        if (p.trapped) vulnerable += 0.5;
        if (p.onSpike) vulnerable += 0.2;
        vulnerable += U.clamp(1 - p.health / p.maxHealth, 0, 1) * 0.3;
        if (GameState.self && EntityTracker.shieldBypass(GameState.self, p)) vulnerable += 0.1;

        const threat = U.clamp(threatOf(p) / 100, 0, 1);
        return near * w.distance + threat * w.threat + vulnerable * w.vulnerable;
    }

    function recompute() {
        const me = GameState.self;
        candidates = [];
        if (!me || !GameState.inGame) { primary = null; return; }

        const radius = Config.get('combat.targetRadius');
        for (const p of GameState.players.values()) {
            if (!isValid(p)) continue;
            if (U.getDistance(me.x2, me.y2, p.x2, p.y2) > radius) continue;
            p.targetScore = score(p);
            p.threat = threatOf(p);
            candidates.push(p);
        }
        candidates.sort((a, b) => b.targetScore - a.targetScore);

        const best = candidates[0] || null;

        if (!primary || !isValid(primary)) {
            primary = best;
            lastSwitchTick = GameState.tick;
            return;
        }

        if (!best || best === primary) return;

        /* Hysteresis. Swapping targets mid-sequence throws away a wound-up
         * insta and a half-built trap, so a challenger has to be clearly better
         * and the current target has to have been held for a moment. */
        const held = GameState.tick - lastSwitchTick;
        const margin = Config.get('combat.switchMargin');
        const minHold = Config.get('combat.switchMinTicks');
        if (held >= minHold && best.targetScore > primary.targetScore * (1 + margin)) {
            const previous = primary;
            primary = best;
            lastSwitchTick = GameState.tick;
            Events.emit('targetSwitched', best, previous);
        }
    }

    return {
        install() { Events.on('trackerReady', recompute); },

        get primary() { return isValid(primary) ? primary : null; },
        get all() { return candidates; },

        /* Anyone hostile inside `range`, for multi-enemy decisions such as
         * whether Safe Soldier should stay defensive. */
        within(range) {
            const me = GameState.self;
            if (!me) return [];
            return candidates.filter((p) => U.getDistance(me.x2, me.y2, p.x2, p.y2) <= range);
        },

        distanceTo(p) {
            const me = GameState.self;
            if (!me || !p) return Infinity;
            return U.getDistance(me.x2, me.y2, p.x2, p.y2);
        },

        threatOf,
        closingRate,

        /* Total incoming damage 2yz believes is on its way. Auto Heal and Safe
         * Soldier both budget against this one number. */
        incomingDamage() {
            const me = GameState.self;
            if (!me) return 0;
            let total = 0;
            for (const p of candidates) total += threatOf(p);
            if (me.onSpike) total += me.onSpike.damage;
            return total;
        },

        debugState() {
            const t = this.primary;
            if (!t) return { target: null, candidates: candidates.length };
            return {
                target: t.name || t.sid,
                sid: t.sid,
                distance: Math.round(this.distanceTo(t)),
                score: Math.round(t.targetScore * 100) / 100,
                threat: Math.round(t.threat),
                trapped: t.trapped,
                candidates: candidates.length
            };
        }
    };
})();


/* ---- 40-placement.js ---- */
/* ===========================================================================
 * 2yz / PlacementEngine
 * ---------------------------------------------------------------------------
 * WHERE. Every placement in 2yz -- Auto Place, Preplace, Replace, Spike Tick,
 * Auto Mills -- asks this engine for candidates and gets back a ranked list
 * with a reason attached to each. The modules decide WHETHER and WHEN; none of
 * them computes a position.
 *
 * Candidate generation follows the ring-sweep the reference clients use: the
 * item can only ever be built at playerScale + item.scale + placeOffset from
 * the player (game_index.js:2458), so the whole search space is one angle.
 *
 * Two things are kept from NovaStorm's sweep because they are genuinely better
 * than a naive scan:
 *
 *   - boundary angles. An angle that is placeable while its neighbour is not
 *     sits flush against an existing structure. Those are the angles that seal
 *     gaps rather than leaving a hole, and they stay usable one tick longer
 *     than open-field angles. NovaStorm calls them "perfect"; 2yz scores them.
 *
 *   - knockback chaining. A spike is worth more when the hit that lands on it
 *     throws the target onto another one. NovaStorm ranks these by the angular
 *     agreement between the push direction and the follow-up spike; 2yz keeps
 *     that measure and folds it into the score.
 *
 * Everything else -- the scoring, the reason codes, the caching, the reuse
 * between modules -- is 2yz's.
 * =========================================================================== */

/* One evaluated ring position. */
class Candidate {
    constructor(itemId, angle, x, y, scale) {
        this.itemId = itemId;
        this.angle = angle;
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.placeable = false;
        this.boundary = false;
        this.score = 0;
        this.reasons = [];
        this.rejected = null;
    }
    add(reason, weight) {
        this.reasons.push(reason);
        this.score += weight;
    }
}

const PlacementEngine = (function () {
    /* Cache of one sweep, keyed by item and by the object set it was computed
     * against. Auto Place, Spike Tick and Replace all want the spike sweep in
     * the same tick; without this it would run three times. */
    let sweepCache = new Map();
    let sweepTick = -1;

    function ensureCache() {
        if (sweepTick !== GameState.tick) {
            sweepCache = new Map();
            sweepTick = GameState.tick;
        }
    }

    /* Ring position for an item at an angle, optionally around a predicted
     * position rather than the current one. */
    function positionFor(itemId, angle, origin) {
        const item = Defs.items[itemId];
        if (!item) return null;
        const d = Defs.placeDistance(itemId);
        return {
            x: origin.x + d * Math.cos(angle),
            y: origin.y + d * Math.sin(angle),
            scale: item.scale
        };
    }

    /* Sweep the ring. `opts.origin` defaults to the local player's current
     * position; `opts.objects` defaults to the live near list. Passing an
     * object list with one entry removed is how Replace asks "what would fit
     * here once that breaks". */
    function sweep(itemId, opts) {
        opts = opts || {};
        const me = GameState.self;
        if (!me || itemId == null || !Defs.items[itemId]) return [];

        const origin = opts.origin || { x: me.x2, y: me.y2 };
        const objects = opts.objects || null;
        const steps = opts.steps || Config.get('placement.angleSteps');

        const key = itemId + ':' + steps + ':'
            + Math.round(origin.x) + ':' + Math.round(origin.y) + ':'
            + (objects ? 'custom' + objects.length : 'live');

        if (!opts.noCache) {
            ensureCache();
            const hit = sweepCache.get(key);
            if (hit) return hit;
        }

        const atLimit = GameState.isItemLimit(itemId);
        const item = Defs.items[itemId];
        const out = new Array(steps);

        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * U.PI2;
            const pos = positionFor(itemId, angle, origin);
            const c = new Candidate(itemId, angle, pos.x, pos.y, pos.scale);
            if (atLimit) {
                c.rejected = 'item-limit';
            } else if (!GameState.checkItemLocation(pos.x, pos.y, pos.scale, 0.6, item.id, false, objects)) {
                c.rejected = 'blocked';
            } else {
                c.placeable = true;
            }
            out[i] = c;
        }

        markBoundaries(out);
        if (!opts.noCache) sweepCache.set(key, out);
        return out;
    }

    /* An angle is a boundary when placeability flips between it and its
     * neighbour. Both sides of the flip are marked, because either can be the
     * one flush against the structure depending on sweep direction. */
    function markBoundaries(list) {
        const n = list.length;
        for (let i = 0; i < n; i++) {
            const prev = list[(i - 1 + n) % n];
            if (list[i].placeable && !prev.placeable) list[i].boundary = true;
            if (prev.placeable && !list[i].placeable) prev.boundary = true;
        }
    }

    /* ------------------------------------------------------------- scoring */

    /* Will a structure at (c.x, c.y) be in contact with the target as the
     * target moves from where it is to where it is predicted to be? This is the
     * swept test the reference clients use, not a point-in-circle at the
     * current position, so it still fires on a target crossing the spot. */
    function interceptsTarget(c, target, pad) {
        const p = Prediction.next(target);
        const reach = pad != null ? pad : target.scale + c.scale;
        return U.lineInRect(
            c.x - reach, c.y - reach, c.x + reach, c.y + reach,
            target.x2, target.y2, p.x, p.y
        );
    }

    /* Spikes we own that a knocked-back target could be thrown onto. */
    function ownSpikes() {
        const out = [];
        for (const obj of GameState.myObjects) if (obj.active && obj.damage > 0) out.push(obj);
        for (const obj of GameState.teamObjects) if (obj.active && obj.damage > 0) out.push(obj);
        return out;
    }

    /* If a hit landed from this candidate, would the push carry the target onto
     * one of our spikes -- and how squarely? Returns null when it would not.
     * Lower `spread` is a straighter line from push direction to follow-up
     * spike, which is what makes the chain actually connect. */
    function knockbackChain(c, target) {
        const kb = Prediction.knockbackTo(target, c.x, c.y);
        const spikes = ownSpikes();
        let best = null;
        for (let i = 0; i < spikes.length; i++) {
            const s = spikes[i];
            const pad = s.scale + target.scale;
            const onPath = U.lineInRect(
                s.x - pad, s.y - pad, s.x + pad, s.y + pad,
                target.x2, target.y2, kb.x, kb.y
            );
            if (!onPath) continue;
            const toSpike = Math.atan2(s.y - target.y2, s.x - target.x2);
            const spread = U.getAngleDist(kb.angle, toSpike);
            if (!best || spread < best.spread) best = { spike: s, spread };
        }
        return best;
    }

    /* Does this candidate wall us off from the target, or from where we are
     * heading? A spike that blocks our own swing is worse than no spike. */
    function blocksOurLine(c, target) {
        const me = GameState.self;
        const pad = c.scale + Config.get('placement.losPadding');
        const blocksToTarget = U.lineInRect(
            c.x - pad, c.y - pad, c.x + pad, c.y + pad,
            me.x2, me.y2, target.x2, target.y2
        );
        const ahead = Prediction.at(me, Config.get('placement.lookaheadTicks'));
        const blocksAhead = U.lineInRect(
            c.x - pad, c.y - pad, c.x + pad, c.y + pad,
            me.x2, me.y2, ahead.x, ahead.y
        );
        return { blocksToTarget, blocksAhead };
    }

    /* Which way could the target still leave? Sampled around the target at the
     * radius it would clear in `escapeTicks`; an angle counts as open when no
     * damaging structure and no candidate sits on it. Fewer open angles means a
     * candidate that closes one is worth more. */
    function escapeAngles(target, extraBlocker) {
        const samples = Config.get('placement.escapeSamples');
        const reach = Math.max(60, target.speed * Config.get('placement.escapeTicks') * 8);
        const blockers = [];
        for (const obj of GameState.nearObjects) {
            if (obj.active && (obj.damage > 0 || obj.trap || obj.blocker)) blockers.push(obj);
        }
        let open = 0;
        for (let i = 0; i < samples; i++) {
            const a = (i / samples) * U.PI2;
            const ex = target.x2 + reach * Math.cos(a);
            const ey = target.y2 + reach * Math.sin(a);
            let blocked = false;
            for (let j = 0; j < blockers.length; j++) {
                const b = blockers[j];
                if (U.pointToSegment(b.x, b.y, target.x2, target.y2, ex, ey) < b.scale + target.scale) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked && extraBlocker) {
                if (U.pointToSegment(extraBlocker.x, extraBlocker.y, target.x2, target.y2, ex, ey)
                    < extraBlocker.scale + target.scale) blocked = true;
            }
            if (!blocked) open++;
        }
        return open;
    }

    /* Score a sweep against a target and return it ranked. `intent` shapes the
     * weights: 'trap' wants containment, 'spike' wants damage and chaining,
     * 'utility' wants to stay out of the way. */
    function rank(candidates, target, intent) {
        const me = GameState.self;
        if (!me) return [];

        const w = Config.section('placement.weights');
        const scored = [];
        const baselineEscape = target ? escapeAngles(target, null) : 0;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (!c.placeable) continue;
            c.score = 0;
            c.reasons.length = 0;

            if (c.boundary) c.add('boundary', w.boundary);

            if (target) {
                const dist = U.getDistance(c.x, c.y, target.x2, target.y2);
                const contact = c.scale + target.scale;

                if (interceptsTarget(c, target)) c.add('intercepts', w.intercept);

                /* Proximity, normalised so that "touching" is 1 and anything
                 * beyond twice contact range contributes nothing. */
                const closeness = U.clamp(1 - (dist - contact) / contact, 0, 1);
                if (closeness > 0) c.add('close', closeness * w.proximity);

                if (intent === 'spike') {
                    const chain = knockbackChain(c, target);
                    if (chain) {
                        /* A straighter chain scores higher: spread 0 is dead-on. */
                        const quality = U.clamp(1 - chain.spread / (Math.PI / 2), 0, 1);
                        c.add('chain', w.knockbackChain * quality);
                        c.chain = chain;
                    }

                    /* Pushing the target back into us is the wrong direction --
                     * that is a free hit for them. NovaStorm gates this at
                     * PI/5 between push direction and target->player; 2yz keeps
                     * the gate and makes it a config value. */
                    const push = U.getDirection(target.x2, target.y2, c.x, c.y);
                    const towardMe = U.getDirection(me.x2, me.y2, target.x2, target.y2);
                    if (U.getAngleDist(push, towardMe) < Config.get('placement.pushbackGuard')) {
                        c.add('pushes-toward-us', -w.pushbackPenalty);
                    }
                }

                if (intent === 'trap' || intent === 'spike') {
                    const after = escapeAngles(target, c);
                    if (after < baselineEscape) {
                        const closed = (baselineEscape - after) / Math.max(1, baselineEscape);
                        c.add('closes-escape', closed * w.escapeClosure);
                    }
                    if (after === 0) c.add('encloses', w.enclosure);
                }

                const los = blocksOurLine(c, target);
                if (los.blocksToTarget) c.add('blocks-our-line', -w.losPenalty);
                if (los.blocksAhead) c.add('blocks-our-path', -w.pathPenalty);
            }

            if (intent === 'utility') {
                /* Mills and other utility structures should sit behind us and
                 * never across the line we are about to walk. */
                const los = target ? blocksOurLine(c, target) : { blocksAhead: false, blocksToTarget: false };
                if (los.blocksAhead) c.add('blocks-our-path', -w.pathPenalty);
                const behind = U.getAngleDist(
                    c.angle,
                    (GameState.input.moveDir != null ? GameState.input.moveDir : me.d2) + Math.PI
                );
                c.add('behind', U.clamp(1 - behind / Math.PI, 0, 1) * w.utilityBehind);
            }

            scored.push(c);
        }

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    return {
        sweep,
        rank,
        positionFor,
        interceptsTarget,
        knockbackChain,
        escapeAngles,
        ownSpikes,

        /* Convenience: sweep + rank in one call, the shape most modules want. */
        best(itemId, target, intent, opts) {
            const list = sweep(itemId, opts);
            const ranked = rank(list, target, intent);
            return ranked.length ? ranked[0] : null;
        },

        bestN(itemId, target, intent, n, opts) {
            const list = sweep(itemId, opts);
            return rank(list, target, intent).slice(0, n);
        },

        /* Re-check a candidate immediately before it is sent. Positions move,
         * objects appear, and a candidate computed two ticks ago may now be
         * inside something. Every placement intent runs through this. */
        stillValid(candidate, origin) {
            if (!candidate) return false;
            if (GameState.isItemLimit(candidate.itemId)) return false;
            const me = GameState.self;
            if (!me) return false;
            const base = origin || { x: me.x2, y: me.y2 };
            const pos = positionFor(candidate.itemId, candidate.angle, base);
            if (!pos) return false;
            const item = Defs.items[candidate.itemId];
            if (!GameState.checkItemLocation(pos.x, pos.y, pos.scale, 0.6, item.id, false, null)) return false;
            candidate.x = pos.x;
            candidate.y = pos.y;
            return true;
        }
    };
})();


/* ---- 41-combat.js ---- */
/* ===========================================================================
 * 2yz / CombatEngine
 * ---------------------------------------------------------------------------
 * Attack decisions, weapon choice, timing and validation. The concepts here are
 * the ones TND is built on, rebuilt against 2yz's state:
 *
 *   - a burst is a scheduled sequence across ticks, not a single swing. TND
 *     awaits a tick between the two halves of an insta and re-checks the target
 *     still exists before committing the second; 2yz models that as a Sequence
 *     with a per-step revalidation hook.
 *
 *   - order depends on the pair. TND runs secondary-then-primary when the
 *     primary is a short-range dagger-class weapon paired with a great hammer,
 *     and primary-then-secondary otherwise, because the slower weapon has to be
 *     the one whose travel is covered by the other's animation.
 *
 *   - range is checked against both the current and the predicted position, so
 *     a burst is not thrown away because the target was a frame out of reach.
 *
 *   - shield arc is checked before committing. A swing into a raised shield is
 *     wasted, and worse, it resets the cooldown that the next opening needs.
 *
 *   - a hat swap belongs to the swing, not to the tick. Damage hats go on for
 *     the frame the hit lands and come off immediately after.
 *
 * What is not taken from TND: its global mutable flags (instaing, instaToggle,
 * hold, aim[0]) and its async/await packet emission. Both are replaced by the
 * intent/arbiter path, so combat cannot fire a packet behind the scheduler's
 * back and cannot deadlock on an await that never resolves.
 * =========================================================================== */

/* An ordered set of steps to run across consecutive ticks. */
class Sequence {
    constructor(name, steps, meta) {
        this.name = name;
        this.steps = steps;
        this.index = 0;
        this.meta = meta || {};
        this.startedTick = GameState.tick;
        this.dead = false;
    }
    get current() { return this.steps[this.index]; }
    get done() { return this.index >= this.steps.length; }
    advance() { this.index++; }
    kill(reason) { this.dead = true; this.deadReason = reason; }
}

const CombatEngine = (function () {
    let active = null;

    /* A knockback secondary: a weapon whose value against a player is the push
     * rather than the damage. In the shipped table that is exactly the weapons
     * carrying a structure multiplier (sDmg), which is the great hammer. */
    function isKnockbackSecondary(weaponIndex) {
        const w = Defs.weapons[weaponIndex];
        return !!(w && w.sDmg && w.sDmg > 1);
    }

    /* Slot the burst should open with.
     *
     * TND reverses the order for `(primary == 4 || primary == 5) && secondary == 10`
     * -- katana or polearm paired with the great hammer -- so the hammer swings
     * first and the slow primary lands inside its recovery. 2yz reproduces that
     * set from the shipped range table rather than from the ids: katana (118)
     * and polearm (142) are the only primaries above the long-reach threshold,
     * so the rule keeps working if the ids ever move. */
    function openingSlot(primaryIdx, secondaryIdx) {
        if (!isKnockbackSecondary(secondaryIdx)) return 0;
        const primary = Defs.weapons[primaryIdx];
        if (!primary) return 0;
        return primary.range > Config.get('combat.longReachRange') ? 1 : 0;
    }

    /* Would a hit landed from where we are throw the target onto one of our
     * spikes? This is what makes a hammer burst worth its cooldown even though
     * the hammer's own player damage is negligible -- the chain is the damage.
     * Reuses PlacementEngine's chain measure so combat and placement agree on
     * what "will connect" means. */
    function hasKnockbackChain(target) {
        const me = GameState.self;
        const probe = { x: me.x2, y: me.y2, scale: me.scale };
        return PlacementEngine.knockbackChain(probe, target) != null;
    }

    function inReach(target, slot) {
        const me = GameState.self;
        const reach = EntityTracker.rangeOf(me, slot) + me.scale + target.scale;
        const now = U.getDistance(me.x2, me.y2, target.x2, target.y2);
        if (now <= reach) return true;
        /* Give the burst the benefit of where both of us will be when the
         * packet lands. */
        const t = Prediction.atLatency(target);
        const m = Prediction.atLatency(me);
        return U.getDistance(m.x, m.y, t.x, t.y) <= reach;
    }

    /* Everything that has to hold for a burst to be worth starting. */
    function canBurst(target) {
        const me = GameState.self;
        if (!me || !target) return false;
        if (!Config.get('combat.burstEnabled')) return false;
        if (GameState.weapons[1] == null) return false;
        if (!EntityTracker.primaryReady(me.sid)) return false;
        if (!EntityTracker.secondaryReady(me.sid)) return false;
        if (!EntityTracker.shieldBypass(me, target)) return false;
        if (!inReach(target, 0) && !inReach(target, 1)) return false;
        return true;
    }

    /* Total damage a full burst would land, both slots, hats included. */
    function burstDamage(target) {
        const me = GameState.self;
        return EntityTracker.playerDamage(me, 0, target)
            + EntityTracker.playerDamage(me, 1, target);
    }

    function buildBurst(target) {
        const me = GameState.self;
        const primaryIdx = GameState.weapons[0];
        const secondaryIdx = GameState.weapons[1];
        const first = openingSlot(primaryIdx, secondaryIdx);
        const second = first === 0 ? 1 : 0;

        const damageHat = Defs.HAT.BULL;

        const stepFor = (slot) => ({
            slot,
            weapon: slot === 0 ? primaryIdx : secondaryIdx,
            hat: damageHat,
            /* Re-run immediately before this step is emitted. */
            validate(seq) {
                const t = seq.meta.target;
                if (!t || !t.visible || !t.alive) return 'target-gone';
                if (t !== Targeting.primary) return 'target-switched';
                if (!inReach(t, slot)) return 'out-of-reach';
                if (!EntityTracker.shieldBypass(GameState.self, t)) return 'shielded';
                return null;
            }
        });

        return new Sequence('burst', [stepFor(first), stepFor(second)], {
            target,
            expectedDamage: burstDamage(target)
        });
    }

    /* Single swing, for when only one slot is off cooldown or the burst gate
     * refused. */
    function buildSwing(target, slot) {
        return new Sequence('swing', [{
            slot,
            weapon: slot === 0 ? GameState.weapons[0] : GameState.weapons[1],
            hat: Defs.HAT.BULL,
            validate(seq) {
                const t = seq.meta.target;
                if (!t || !t.visible || !t.alive) return 'target-gone';
                if (!inReach(t, slot)) return 'out-of-reach';
                return null;
            }
        }], { target, expectedDamage: EntityTracker.playerDamage(GameState.self, slot, target) });
    }

    return {
        install() {
            Events.on('targetSwitched', function () {
                /* A sequence aimed at someone else is worthless. Dropping it
                 * here is what stops a burst from finishing into thin air. */
                if (active && !active.done) active.kill('target-switched');
            });
            Events.on('death', function () { active = null; });
        },

        get activeSequence() { return active && !active.dead && !active.done ? active : null; },

        /* Called once per tick by the runtime. Returns the AttackIntent for
         * this tick, or null. */
        decide() {
            const me = GameState.self;
            if (!me || !GameState.inGame || !me.alive) { active = null; return null; }
            if (!Config.get('combat.enabled')) { active = null; return null; }

            const target = Targeting.primary;
            if (!target) { active = null; return null; }

            /* Continue an in-flight sequence before starting a new one. */
            if (active && !active.dead && !active.done) {
                const step = active.current;
                const bad = step.validate ? step.validate(active) : null;
                if (bad) {
                    active.kill(bad);
                    Events.emit('sequenceCancelled', active, bad);
                    active = null;
                } else {
                    return new AttackIntent({
                        source: 'Combat',
                        urgency: Config.get('combat.urgencyBurst'),
                        confidence: 1,
                        target,
                        slot: step.slot,
                        weapon: step.weapon,
                        hat: step.hat,
                        angle: this.aimAngle(target),
                        sequence: active
                    });
                }
            }

            /* Hold fire while a shield is between us and the target and we have
             * no way through -- the swing would only feed their cooldown. */
            if (!EntityTracker.shieldBypass(me, target)) return null;

            if (canBurst(target)) {
                /* Three reasons a burst is worth both cooldowns:
                 *   - it does enough raw damage on its own;
                 *   - the target is held and cannot walk out of the follow-up;
                 *   - the secondary is a knockback weapon and there is a spike
                 *     for it to throw them onto, which is where the damage
                 *     actually comes from in a hammer pair.
                 * Without the third, the polearm-and-hammer pair would never
                 * fire, because its raw two-slot damage is below any sensible
                 * threshold. */
                const damage = burstDamage(target);
                const worthIt = damage >= Config.get('combat.minBurstDamage')
                    || target.trapped
                    || (isKnockbackSecondary(GameState.weapons[1]) && hasKnockbackChain(target));
                if (worthIt) {
                    active = buildBurst(target);
                    const step = active.current;
                    return new AttackIntent({
                        source: 'Combat',
                        urgency: Config.get('combat.urgencyBurst'),
                        confidence: Prediction.confidence(target),
                        target,
                        slot: step.slot,
                        weapon: step.weapon,
                        hat: step.hat,
                        angle: this.aimAngle(target),
                        sequence: active
                    });
                }
            }

            /* Single swing on whichever slot is ready and in reach. */
            for (const slot of [0, 1]) {
                const ready = slot === 0
                    ? EntityTracker.primaryReady(me.sid)
                    : EntityTracker.secondaryReady(me.sid);
                if (!ready) continue;
                if (GameState.weapons[slot] == null) continue;
                if (!inReach(target, slot)) continue;

                active = buildSwing(target, slot);
                const step = active.current;
                return new AttackIntent({
                    source: 'Combat',
                    urgency: Config.get('combat.urgencySwing'),
                    confidence: Prediction.confidence(target),
                    target,
                    slot: step.slot,
                    weapon: step.weapon,
                    hat: step.hat,
                    angle: this.aimAngle(target),
                    sequence: active
                });
            }

            return null;
        },

        /* Where to point. Leads the target by the predicted travel over the
         * round trip, so the swing arc covers where they will be. */
        aimAngle(target) {
            const me = GameState.self;
            if (!target) return GameState.input.aimDir;
            if (!Config.get('combat.leadTarget')) {
                return U.getDirection(target.x2, target.y2, me.x2, me.y2);
            }
            const t = Prediction.atLatency(target);
            return U.getDirection(t.x, t.y, me.x2, me.y2);
        },

        /* Exposed for the tick modules: is the target currently a free hit? */
        isOpen(target) {
            const me = GameState.self;
            if (!me || !target) return false;
            return EntityTracker.shieldBypass(me, target)
                && (inReach(target, 0) || inReach(target, 1));
        },

        inReach,
        burstDamage,

        debugState() {
            const seq = this.activeSequence;
            return {
                enabled: Config.get('combat.enabled'),
                sequence: seq ? seq.name + ' ' + (seq.index + 1) + '/' + seq.steps.length : null,
                target: Targeting.primary ? Targeting.primary.sid : null,
                primaryReady: GameState.self ? EntityTracker.primaryReady(GameState.self.sid) : null,
                secondaryReady: GameState.self ? EntityTracker.secondaryReady(GameState.self.sid) : null
            };
        }
    };
})();


/* ---- 50-mod-autoplace.js ---- */
/* ===========================================================================
 * 2yz / AutoPlace
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's updateAngles / checkPredictObjects /
 * isAutoPlaceAngle (novastorm_1.4.txt:12726-13108).
 *
 * What was worth keeping from it: the ring sweep, boundary ("perfect") angles,
 * and the three tactical questions it asks -- does this hit the target, does it
 * chain them into another spike, does it wall off my own swing.
 *
 * What was not: the priority ladder. NovaStorm answers those questions as a
 * chain of `if (...) return true`, so a candidate that hits the target but also
 * blocks the player's line wins on the first clause and the second is never
 * reached. 2yz scores instead (PlacementEngine.rank), so a candidate that is
 * good on one axis and bad on another loses to one that is decent on both.
 *
 * Its own reasons to hold fire, which NovaStorm does not have: it will not
 * spend a placement on a target it cannot predict, and it will not place while
 * the trap it is standing in is about to break.
 * =========================================================================== */

const AutoPlace = {
    name: 'AutoPlace',

    tick() {
        if (!Config.get('placement.autoPlace.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;

        const range = Config.get('placement.autoPlace.range');
        if (Targeting.distanceTo(target) > range) return null;

        /* A target mid-turn is not worth spending a spike on -- by the time the
         * build lands they are somewhere else. Preplace exists for the case
         * where the movement IS predictable. */
        const confidence = Prediction.confidence(target);
        if (confidence < Config.get('placement.autoPlace.minConfidence')) return null;

        const intents = [];
        const spikeId = GameState.spikeItem;
        const trapId = GameState.trapItem;

        if (spikeId != null && Config.get('placement.autoPlace.spikes')) {
            const best = PlacementEngine.best(spikeId, target, 'spike');
            if (best && best.score >= Config.get('placement.autoPlace.minScore')) {
                intents.push(new PlacementIntent({
                    source: this.name,
                    urgency: Config.get('placement.autoPlace.urgency'),
                    confidence,
                    target,
                    candidate: best,
                    reason: best.reasons.join(',')
                }));
            }
        }

        if (trapId != null && Config.get('placement.autoPlace.traps')) {
            /* A trap only pays when neither of us is already held: trapping a
             * trapped player wastes the item, and placing one while we are
             * stuck seals us in with them. */
            if (!target.trapped && !me.trapped) {
                const best = PlacementEngine.best(trapId, target, 'trap');
                if (best && best.score >= Config.get('placement.autoPlace.minScore')) {
                    intents.push(new PlacementIntent({
                        source: this.name,
                        /* A trap that actually closes their last exit is worth
                         * more than a spike; one that does not is worth less. */
                        urgency: best.reasons.indexOf('encloses') >= 0
                            ? Config.get('placement.autoPlace.urgencyEnclose')
                            : Config.get('placement.autoPlace.urgency') - 5,
                        confidence,
                        target,
                        candidate: best,
                        reason: best.reasons.join(',')
                    }));
                }
            }
        }

        return intents;
    },

    debugState() {
        const target = Targeting.primary;
        if (!target || !GameState.spikeItem) return null;
        const ranked = PlacementEngine.bestN(GameState.spikeItem, target, 'spike', 3);
        return {
            top: ranked.map((c) => ({
                angle: Math.round(U.toDeg(c.angle)),
                score: Math.round(c.score * 10) / 10,
                why: c.reasons.join(',')
            }))
        };
    }
};


/* ---- 51-mod-preplace.js ---- */
/* ===========================================================================
 * 2yz / Preplace
 * ---------------------------------------------------------------------------
 * Source concept: Whiteout's preplace / checkCanPrePlace / checkPreplace
 * (Whiteout_v4.js:8322, 8378, 8510) and the velocity model behind them
 * (calcVel, Whiteout_v4.js:14869).
 *
 * The idea Whiteout gets right, and the reason it is the reference here rather
 * than NovaStorm: it validates the placement against where the player WILL be,
 * not where they are. checkCanPrePlace reads `player[pre ? "x3" : "x2"]`, and
 * x3 is the integrated next-tick position. A ring computed around the current
 * position is already wrong by the time the build packet lands, which is why a
 * present-tense placer misses on anything moving.
 *
 * Also kept: the release timing. Whiteout arms a `preplaceTimeout` and fires at
 * `timeout - ping`, so the build arrives at the server on the tick it was
 * computed for rather than a tick late.
 *
 * Not kept: the setTimeout chains and chainPlace's fixed repeat counts, which
 * fire regardless of whether the prediction survived the wait. In 2yz the
 * armed placement is an intent, it is revalidated at release, and a direction
 * change past the configured threshold destroys it before it can be sent.
 * =========================================================================== */

const Preplace = {
    name: 'Preplace',

    /* The currently armed placement, if any. */
    armed: null,

    install() {
        Events.on('trackerReady', () => this.invalidate());
        Events.on('targetSwitched', () => this.disarm('target-switched'));
        Events.on('death', () => this.disarm('death'));
    },

    disarm(reason) {
        if (!this.armed) return;
        const was = this.armed;
        this.armed = null;
        if (was.timer) clearTimeout(was.timer);
        if (was.intent) was.intent.cancelled = true;
        Events.emit('preplaceDisarmed', was, reason);
    },

    /* Run every tick before anything reads the armed placement. A prediction is
     * only valid while the movement it was built from holds. */
    invalidate() {
        const a = this.armed;
        if (!a) return;
        const target = a.intent.target;

        if (!target || !target.visible || !target.alive) return this.disarm('target-gone');
        if (target !== Targeting.primary) return this.disarm('target-switched');

        if (Prediction.changedDirection(target)) return this.disarm('direction-changed');

        /* Compare where the target actually got to against where the armed
         * prediction said they would be. Drift past the tolerance means the
         * model was wrong, whatever the direction test says. */
        const drift = U.getDistance(target.x2, target.y2, a.predicted.x, a.predicted.y);
        if (drift > Config.get('placement.preplace.driftTolerance')) return this.disarm('drift');

        if (GameState.tick - a.armedTick > Config.get('placement.preplace.maxAgeTicks')) {
            return this.disarm('expired');
        }
        return undefined;
    },

    tick() {
        if (!Config.get('placement.preplace.enabled')) return null;
        if (this.armed) return null;

        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;
        if (Targeting.distanceTo(target) > Config.get('placement.preplace.range')) return null;

        /* Preplace is the module that most needs the prediction to be right, so
         * it has the strictest confidence gate in the client. */
        const confidence = Prediction.confidence(target);
        if (confidence < Config.get('placement.preplace.minConfidence')) return null;

        /* Nothing to lead if they are not moving. */
        if (target.speed < Config.get('placement.preplace.minSpeed')) return null;

        const horizon = Config.get('placement.preplace.horizonTicks');

        /* Origin: where WE will be. Whiteout's x3/y3. */
        const myFuture = Prediction.at(me, horizon);
        /* Aim point: where THEY will be. */
        const theirFuture = Prediction.at(target, horizon);

        /* A shadow of the target at its future position, so PlacementEngine
         * scores candidates against the interception point rather than against
         * where the target currently stands. */
        const shadow = Object.create(target);
        shadow.x2 = theirFuture.x;
        shadow.y2 = theirFuture.y;
        shadow.x1 = target.x2;
        shadow.y1 = target.y2;

        const itemId = Config.get('placement.preplace.useTrap') && GameState.trapItem != null
            && !target.trapped
            ? GameState.trapItem
            : GameState.spikeItem;
        if (itemId == null) return null;

        const candidates = PlacementEngine.sweep(itemId, {
            origin: { x: myFuture.x, y: myFuture.y }
        });
        const ranked = PlacementEngine.rank(candidates, shadow, itemId === GameState.trapItem ? 'trap' : 'spike');
        const best = ranked[0];
        if (!best || best.score < Config.get('placement.preplace.minScore')) return null;

        const intent = new PlacementIntent({
            source: this.name,
            urgency: Config.get('placement.preplace.urgency'),
            confidence,
            target,
            candidate: best,
            origin: { x: myFuture.x, y: myFuture.y },
            reason: 'preplace:' + best.reasons.join(',')
        });

        /* Arm rather than return. The placement is correct for a moment that
         * has not arrived yet; sending it now would land it a tick early. */
        this.arm(intent, theirFuture, horizon);
        return null;
    },

    /* Release so the frame reaches the server on the predicted tick: schedule
     * the horizon, less the one-way trip. Whiteout uses the low-water ping for
     * this rather than the mean, because arriving early still works and
     * arriving late does not. */
    arm(intent, predicted, horizon) {
        const leadMs = horizon * Defs.TICK_MS;
        const oneWay = Net.minPingMs() / 2;
        const delay = Math.max(0, leadMs - oneWay - Config.get('placement.preplace.releaseBias'));

        const record = {
            intent,
            predicted,
            armedTick: GameState.tick,
            timer: null
        };
        this.armed = record;

        record.timer = setTimeout(() => {
            record.timer = null;
            if (this.armed !== record) return;
            this.armed = null;
            /* Scheduler revalidates one last time before the write. */
            const ok = Scheduler.runDeferred(intent);
            Events.emit('preplaceReleased', intent, ok);
        }, delay);

        Events.emit('preplaceArmed', record);
    },

    debugState() {
        const a = this.armed;
        if (!a) return { armed: null };
        return {
            armed: a.intent.describe(),
            angle: Math.round(U.toDeg(a.intent.angle)),
            predicted: { x: Math.round(a.predicted.x), y: Math.round(a.predicted.y) },
            ageTicks: GameState.tick - a.armedTick
        };
    }
};


/* ---- 52-mod-replace.js ---- */
/* ===========================================================================
 * 2yz / Replace
 * ---------------------------------------------------------------------------
 * Source: Luna.
 *
 * A note on where the logic actually came from, because the obvious answer is
 * wrong. Luna's menu carries a toggle labelled "replace" with the id
 * `prePlace2` (Luna_Fixed.user.js:19253). That id appears exactly once in the
 * whole file: in the menu row. Nothing reads it, it has no entry in the
 * defaults block next to `prePlace`, and no code branches on it. It is a dead
 * switch, like the `autsh1` and `triangle2` entries Luna also ships.
 *
 * Luna's real replacement logic is `getPrePlaceObject()` plus the candidate
 * generation around it (Luna_Fixed.user.js, getPrePlaceObject / getPredictObjects).
 * It works like this:
 *
 *   1. find an object that is about to be destroyed -- health at or below the
 *      damage the next swing will do, from either the local player gathering
 *      or the enemy's next hit;
 *   2. sweep the ring with that object removed from the collision set
 *      (`customObjects.splice(indexOf(findObject), 1)`), so the sweep answers
 *      "what fits once it is gone" rather than "what fits now";
 *   3. build the replacement into the gap as it opens.
 *
 * That is a genuinely better idea than anything equivalent in the other three
 * sources, and it is what 2yz implements. NovaStorm inherited the same function
 * verbatim, so the lineage is Luna's either way.
 *
 * What 2yz adds, because Luna does not ask it: whether the replacement is
 * actually an improvement. Luna replaces whatever is breaking with whatever
 * fits. 2yz scores the gap through PlacementEngine like any other placement and
 * declines when the replacement would score below what is being lost -- a
 * spike replaced by a spike that blocks our own swing is a downgrade, and
 * replacing a resource we are farming with a structure is not a replacement at
 * all.
 * =========================================================================== */

const Replace = {
    name: 'Replace',

    /* sid -> {object, breaksAtTick, byWhom} */
    doomed: new Map(),

    install() {
        Events.on('swing', (player, weaponIndex) => this.projectBreak(player, weaponIndex));
        Events.on('objectRemoved', (obj) => this.doomed.delete(obj.sid));
        Events.on('trackerReady', () => this.expire());
    },

    expire() {
        for (const [sid, entry] of this.doomed) {
            if (GameState.tick > entry.breaksAtTick + Config.get('placement.replace.graceTicks')) {
                this.doomed.delete(sid);
            }
        }
    },

    /* Someone swung. Work out which structure that swing kills. This is Luna's
     * step 1, but driven by the observed swing rather than by polling reload
     * state, so it fires on the tick the damage is actually committed. */
    projectBreak(player, weaponIndex) {
        if (!Config.get('placement.replace.enabled')) return;
        const weapon = Defs.weapons[weaponIndex];
        if (!weapon) return;

        const slot = weapon.type === 0 ? 0 : 1;
        const damage = EntityTracker.structureDamage(player, slot);
        if (damage <= 0) return;

        const reach = weapon.range + player.scale;
        const aim = player.d2;

        for (const obj of GameState.nearObjects) {
            if (!obj.active || !obj.isItem) continue;
            if (obj.health === Infinity) continue;

            const dist = U.getDistance(player.x2, player.y2, obj.x, obj.y);
            if (dist - obj.scale > reach) continue;

            /* The swing has an arc; something behind the swinger is not hit. */
            const toObj = U.getDirection(obj.x, obj.y, player.x2, player.y2);
            if (U.getAngleDist(aim, toObj) > Defs.config.gatherAngle) continue;

            if (obj.health > damage) continue;

            this.doomed.set(obj.sid, {
                object: obj,
                breaksAtTick: GameState.tick + 1,
                byWhom: player.sid
            });
        }
    },

    tick() {
        if (!Config.get('placement.replace.enabled')) return null;
        const me = GameState.self;
        if (!me || !this.doomed.size) return null;

        const target = Targeting.primary;
        const intents = [];
        const maxPerTick = Config.get('placement.replace.maxPerTick');

        for (const entry of this.doomed.values()) {
            if (intents.length >= maxPerTick) break;
            const obj = entry.object;
            if (!obj.active) continue;

            /* Only replace what is worth replacing. A resource node breaking is
             * not a hole in our defence. */
            if (!this.worthReplacing(obj, target)) continue;

            const dist = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (dist > Config.get('placement.replace.range')) continue;

            const itemId = this.replacementFor(obj, target);
            if (itemId == null) continue;
            if (GameState.isItemLimit(itemId)) continue;

            /* Luna's step 2: sweep with the doomed object removed, so the gap it
             * is about to leave is treated as free space. */
            const objects = GameState.nearObjects.filter((o) => o !== obj);
            const candidates = PlacementEngine.sweep(itemId, { objects, noCache: true });
            const ranked = PlacementEngine.rank(
                candidates, target,
                itemId === GameState.trapItem ? 'trap' : 'spike'
            );

            /* Only the candidates that actually land in the gap are
             * replacements; anything else is just an ordinary placement and
             * AutoPlace owns it. */
            const inGap = ranked.filter(
                (c) => U.getDistance(c.x, c.y, obj.x, obj.y) < obj.scale + c.scale
            );
            const best = inGap[0];
            if (!best) continue;

            /* 2yz's addition: is this better than what is being lost? */
            const replacedValue = this.valueOf(obj, target);
            if (best.score < replacedValue + Config.get('placement.replace.improvementMargin')) {
                continue;
            }

            intents.push(new ReplaceIntent({
                source: this.name,
                urgency: Config.get('placement.replace.urgency'),
                confidence: target ? Prediction.confidence(target) : 0.8,
                target,
                candidate: best,
                doomedObject: obj,
                reason: 'replace:' + obj.name + '->' + best.reasons.join(',')
            }));
        }

        return intents.length ? intents : null;
    },

    /* Ours, and load-bearing. Somebody else's spike breaking is their problem. */
    worthReplacing(obj, target) {
        if (!obj.isItem) return false;
        if (obj.ownerSid == null) return false;
        if (obj.ownerSid !== GameState.mySid && !GameState.isAlly(obj.ownerSid)) return false;
        if (!(obj.damage > 0 || obj.trap || obj.blocker)) return false;
        if (!target) return Config.get('placement.replace.replaceOutOfCombat');
        return U.getDistance(obj.x, obj.y, target.x2, target.y2)
            <= Config.get('placement.replace.relevanceRange');
    },

    /* Like for like where possible: a trap holds, a spike hurts, and swapping
     * one for the other changes what the structure was doing. */
    replacementFor(obj) {
        if (obj.trap) return GameState.trapItem != null ? GameState.trapItem : GameState.spikeItem;
        if (obj.damage > 0) return GameState.spikeItem;
        return GameState.wallItem;
    },

    /* What the doomed object was worth, on the same scale PlacementEngine
     * scores candidates on, so the two are comparable. */
    valueOf(obj, target) {
        if (!target) return 0;
        const shadow = new Candidate(obj.itemId, 0, obj.x, obj.y, obj.scale);
        shadow.placeable = true;
        const ranked = PlacementEngine.rank([shadow], target, obj.trap ? 'trap' : 'spike');
        return ranked.length ? ranked[0].score : 0;
    },

    debugState() {
        return {
            doomed: Array.from(this.doomed.values()).map((e) => ({
                sid: e.object.sid,
                name: e.object.name,
                breaksAt: e.breaksAtTick
            }))
        };
    }
};


/* ---- 53-mod-spiketick.js ---- */
/* ===========================================================================
 * 2yz / SpikeTick
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's canTrapTick and canVelocitySpikeTick
 * (novastorm_1.4.txt:12543 and 12171).
 *
 * Spike Tick is WHEN, and only WHEN. NovaStorm mixes the two -- canTrapTick
 * sweeps the ring itself via getPrePlaceAngles to decide whether the moment is
 * right, and then the placer sweeps it again to decide where. 2yz splits them:
 * PlacementEngine answers where, this module answers whether now is the moment,
 * and the two share one sweep.
 *
 * The timing conditions, which are what NovaStorm actually gets right:
 *
 *   - the target must be held. A tick on someone who can walk out of the
 *     knockback is a wasted spike and a wasted cooldown.
 *   - our hammer must be off cooldown, because the sequence is spike-then-break
 *     and there is no point starting it without the break.
 *   - the structure holding them has to be one we can break in a single swing,
 *     which is a table lookup against secondary structure damage.
 *   - the target must not already be bleeding on a spike -- that tick is
 *     already happening.
 *   - the push must not throw them toward us. NovaStorm gates this at PI/5
 *     between push direction and target->player; the same gate lives in
 *     PlacementEngine so every module inherits it.
 * =========================================================================== */

const SpikeTick = {
    name: 'SpikeTick',

    tick() {
        if (!Config.get('placement.spikeTick.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) return null;

        if (!this.windowOpen(target)) return null;

        const spikeId = GameState.spikeItem;
        if (spikeId == null || GameState.isItemLimit(spikeId)) return null;

        /* WHERE comes from the shared engine, off the same cached sweep
         * AutoPlace uses this tick. */
        const ranked = PlacementEngine.bestN(spikeId, target, 'spike', 4);
        const contact = Config.get('placement.spikeTick.contactRange');

        /* Of the good candidates, take one that will actually be touching the
         * target -- a tick is a contact hit, not an area denial. */
        const best = ranked.find(
            (c) => U.getDistance(c.x, c.y, target.x2, target.y2) < c.scale + contact
        );
        if (!best) return null;

        return new PlacementIntent({
            source: this.name,
            /* Higher than ordinary placement: the window is narrow and closes
             * when their trap breaks. */
            urgency: Config.get('placement.spikeTick.urgency'),
            confidence: Prediction.confidence(target),
            target,
            candidate: best,
            reason: 'spiketick:' + best.reasons.join(',')
        });
    },

    /* Is this the tick? */
    windowOpen(target) {
        const me = GameState.self;

        /* Already taking structure damage -- the tick is in progress. */
        if (target.spikeDamage > 0 || target.onSpike) return false;

        /* The sequence needs the hammer. */
        if (!EntityTracker.secondaryReady(me.sid)) return false;
        const secondary = Defs.weapons[GameState.weapons[1]];
        if (!secondary || !secondary.sDmg) return false;

        const holder = target.trapObject;
        if (!holder) return false;

        /* Ours: breaking someone else's trap frees the target for nothing. */
        if (holder.ownerSid !== GameState.mySid && !GameState.isAlly(holder.ownerSid)) return false;

        /* One swing has to finish it, or the target walks before the second. */
        const breakDamage = EntityTracker.structureDamage(me, 1);
        if (holder.health > breakDamage) return false;

        /* Both the trap and the target have to be inside reach. */
        const reach = EntityTracker.rangeOf(me, 1) + me.scale;
        if (U.getDistance(me.x2, me.y2, holder.x, holder.y) > reach + holder.scale) return false;
        if (Targeting.distanceTo(target) > reach + target.scale) return false;

        return true;
    },

    debugState() {
        const target = Targeting.primary;
        if (!target) return { window: false, why: 'no-target' };
        return {
            window: this.windowOpen(target),
            targetTrapped: target.trapped,
            hammerReady: GameState.self ? EntityTracker.secondaryReady(GameState.self.sid) : null
        };
    }
};


/* ---- 54-mod-antismarttick.js ---- */
/* ===========================================================================
 * 2yz / AntiSmartTick
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's doSmartTickAnti (novastorm_1.4.txt:12237) and the
 * anti-spike-tick damage projection in its tick loop (novastorm_1.4.txt:15118).
 *
 * The situation it defends: we are held in a trap, the enemy has a hammer off
 * cooldown, and there is a ring position around US where they could drop a
 * spike such that breaking out walks us straight into it. Breaking the trap on
 * this tick is exactly what they are waiting for.
 *
 * NovaStorm's detection is the right one and 2yz keeps its shape: sweep the
 * ring around the ENEMY (not around us), check each position with the game's
 * own placement test, and for any position that would land within contact of
 * us, project our knockback out of it and see whether it lands on one of their
 * spikes. If it does, wait.
 *
 * Two things are rebuilt rather than copied:
 *
 *   - NovaStorm expresses the answer by mutating shared flags (`autoBreak`,
 *     `predictWeapon`) from inside a predicate, so the function both reports
 *     and acts. Here it returns a HoldIntent, which the Arbiter weighs against
 *     whatever it would suppress. It can lose.
 *
 *   - the hold is bounded. NovaStorm re-derives the wait every tick with no
 *     ceiling, so a patient enemy can pin the client indefinitely. 2yz expires
 *     the hold after a configured number of ticks and takes the hit, because
 *     bleeding out in a trap is worse than eating one spike.
 * =========================================================================== */

const AntiSmartTick = {
    name: 'AntiSmartTick',

    heldSinceTick: -1,

    tick() {
        if (!Config.get('defense.antiSmartTick.enabled')) return null;
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target) { this.heldSinceTick = -1; return null; }

        if (!me.trapped || !me.trapObject) { this.heldSinceTick = -1; return null; }

        /* Already bleeding: waiting costs more than the spike would. */
        if (me.onSpike) { this.heldSinceTick = -1; return null; }

        /* Only a threat while they can actually place and swing. */
        if (!EntityTracker.secondaryReady(target.sid)) { this.heldSinceTick = -1; return null; }

        const threat = this.findTrap(target);
        if (!threat) { this.heldSinceTick = -1; return null; }

        if (this.heldSinceTick < 0) this.heldSinceTick = GameState.tick;
        const heldFor = GameState.tick - this.heldSinceTick;
        const maxHold = Config.get('defense.antiSmartTick.maxHoldTicks');
        if (heldFor > maxHold) {
            /* Give up: the trap we are in is doing damage of its own, and an
             * unbounded wait is how a client gets held until it dies. */
            this.heldSinceTick = -1;
            return null;
        }

        return new HoldIntent({
            source: this.name,
            urgency: Config.get('defense.antiSmartTick.urgency'),
            confidence: threat.confidence,
            target,
            reason: 'smart-tick-setup',
            /* Hold the break, not the whole client. Combat can still swing at
             * the player; what must not happen is the structure break that
             * releases us into the waiting spike. */
            blocks: ['Placement', 'Replace'],
            untilTick: GameState.tick + 1,
            meta: { threat }
        });
    },

    /* Sweep the ring around the enemy for a spike position that would catch us
     * on the way out. Returns the worst one found, or null. */
    findTrap(enemy) {
        const me = GameState.self;
        /* Enemy loadouts are not on the wire -- UPDATE_ITEMS (S2C 'V') is sent
         * only to the owning client -- so the threat is modelled with the spike
         * we ourselves have slotted. That is the right assumption at the ages
         * where this matters, and erring toward the larger spike makes the
         * defence conservative rather than blind. */
        const spikeId = GameState.spikeItem;
        if (spikeId == null) return null;

        const item = Defs.items[spikeId];
        if (!item) return null;

        const steps = Config.get('defense.antiSmartTick.sweepSteps');
        const distance = Defs.placeDistance(spikeId);
        const contact = me.scale + item.scale;

        /* Their spikes are what our knockback would land on. */
        const enemySpikes = [];
        for (const obj of GameState.enemyObjects) {
            if (obj.active && obj.damage > 0) enemySpikes.push(obj);
        }

        let worst = null;

        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * U.PI2;
            const x = enemy.x2 + distance * Math.cos(angle);
            const y = enemy.y2 + distance * Math.sin(angle);

            /* Could they actually build there? Same test the server runs, with
             * the trap holding us excluded because it is about to break. */
            const objects = GameState.nearObjects.filter((o) => o !== me.trapObject);
            if (!GameState.checkItemLocation(x, y, item.scale, 0.6, item.id, false, objects)) continue;

            /* Would it be touching us once we are free? */
            if (U.getDistance(me.x2, me.y2, x, y) > contact) continue;

            /* Where would that spike's contact throw us? */
            const kb = Prediction.knockbackTo(me, x, y);

            /* Onto one of theirs? */
            for (let j = 0; j < enemySpikes.length; j++) {
                const s = enemySpikes[j];
                const pad = s.scale + me.scale;
                const lands = U.lineInRect(
                    s.x - pad, s.y - pad, s.x + pad, s.y + pad,
                    me.x2, me.y2, kb.x, kb.y
                );
                if (!lands) continue;

                const chainDamage = s.damage + item.dmg;
                if (!worst || chainDamage > worst.damage) {
                    worst = {
                        x, y, angle,
                        into: s,
                        damage: chainDamage,
                        /* Confidence is how sure we are they will take it: a
                         * ready hammer and a target in reach makes it likely. */
                        confidence: U.clamp(
                            (EntityTracker.secondaryReady(enemy.sid) ? 0.6 : 0.2)
                            + (Targeting.distanceTo(enemy) < 200 ? 0.3 : 0),
                            0, 1
                        )
                    };
                }
            }
        }

        return worst;
    },

    debugState() {
        const me = GameState.self;
        const target = Targeting.primary;
        if (!me || !target || !me.trapped) return { holding: false };
        const threat = this.findTrap(target);
        return {
            holding: !!threat,
            heldTicks: this.heldSinceTick < 0 ? 0 : GameState.tick - this.heldSinceTick,
            projectedDamage: threat ? threat.damage : 0
        };
    }
};


/* ---- 55-mod-safesoldier.js ---- */
/* ===========================================================================
 * 2yz / SafeSoldier
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's damage-potential accumulator and hatFc
 * (novastorm_1.4.txt:15100-15220 and 16160).
 *
 * NovaStorm builds a running `totalDmgPot` out of every damage source that
 * could land this tick -- an enemy's primary if we are inside its reach and its
 * cooldown is up, their secondary, a turret, poison, and 45 for a spike our
 * knockback would carry us into -- caps it at 140, and calls `soldierAnti` once
 * it crosses 100. That accumulator is the good idea here, and 2yz keeps it,
 * with every figure read from the shipped tables instead of hard-coded.
 *
 * Rebuilt rather than copied:
 *
 *   - NovaStorm's hatFc is a straight-line cascade of assignments where the
 *     last matching branch silently wins, so Soldier-for-safety and Bull-for-
 *     damage are decided by source order rather than by which matters more.
 *     Here the defensive hat is a DefenseIntent with an urgency proportional to
 *     the projected damage, and Combat's offensive hat is an ordinary intent
 *     too. The Arbiter picks, so a lethal incoming hit outranks a damage hat
 *     and a survivable one does not.
 *
 *   - the spike figure. NovaStorm uses a literal 45; 2yz reads the actual
 *     damage of the actual structure it projects us into.
 * =========================================================================== */

const SafeSoldier = {
    name: 'SafeSoldier',

    lastProjection: null,

    tick() {
        if (!Config.get('defense.safeSoldier.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive) return null;

        const projection = this.projectDamage();
        this.lastProjection = projection;

        const soldier = Defs.HAT.SOLDIER;
        if (soldier == null || !GameState.skins[soldier]) return null;
        if (me.skinIndex === soldier) return null;

        const threshold = Config.get('defense.safeSoldier.threshold');
        if (projection.total < threshold) return null;

        /* Urgency rises with how close the projection is to killing us: a hit
         * that takes half our health is worth a hat, one that kills us is worth
         * more than anything else on the tick. */
        const lethality = U.clamp(projection.total / Math.max(1, me.health), 0, 1.5);
        const urgency = Config.get('defense.safeSoldier.urgencyBase')
            + lethality * Config.get('defense.safeSoldier.urgencyScale');

        return new DefenseIntent({
            source: this.name,
            urgency,
            confidence: projection.confidence,
            target: Targeting.primary,
            hat: soldier,
            reason: 'incoming-' + Math.round(projection.total),
            meta: projection
        });
    },

    /* Everything that could land on us this tick, itemised. */
    projectDamage() {
        const me = GameState.self;
        const out = { hits: 0, secondary: 0, turret: 0, spike: 0, total: 0, confidence: 0.5, sources: [] };
        if (!me) return out;

        const enemies = Targeting.within(Config.get('defense.safeSoldier.scanRange'));
        let certainty = 0;

        for (const enemy of enemies) {
            const dist = U.getDistance(me.x2, me.y2, enemy.x2, enemy.y2);

            for (let slot = 0; slot < 2; slot++) {
                const idx = EntityTracker.weaponOf(enemy, slot);
                if (idx == null) continue;
                const weapon = Defs.weapons[idx];
                if (!weapon || weapon.dmg == null) continue;

                const reach = weapon.range + me.scale + enemy.scale;
                /* Use the predicted gap: a player closing fast is in range by
                 * the time their swing resolves. */
                const closing = Prediction.next(enemy);
                const meNext = Prediction.next(me);
                const soon = U.getDistance(meNext.x, meNext.y, closing.x, closing.y);
                if (Math.min(dist, soon) > reach) continue;

                const ready = slot === 0
                    ? EntityTracker.primaryReady(enemy.sid)
                    : EntityTracker.secondaryReady(enemy.sid);
                if (!ready) continue;

                if (!EntityTracker.shieldBypass(enemy, me)) continue;

                const dmg = EntityTracker.playerDamage(enemy, slot, me);
                if (slot === 0) out.hits += dmg; else out.secondary += dmg;
                out.sources.push({ sid: enemy.sid, slot, dmg: Math.round(dmg) });
                certainty += 0.35;
            }

            /* Turret Gear, from the shipped hat table. */
            const hat = EntityTracker.hatOf(enemy);
            if (hat && hat.turret && dist <= hat.turret.range && EntityTracker.turretReady(enemy.sid)) {
                const proj = Defs.projectiles[hat.turret.proj];
                if (proj && proj.dmg) {
                    out.turret += proj.dmg;
                    out.sources.push({ sid: enemy.sid, slot: 'turret', dmg: proj.dmg });
                    certainty += 0.2;
                }
            }
        }

        /* Structure contact, now or after a knockback we can already see coming. */
        if (me.onSpike) {
            out.spike += me.onSpike.damage;
            out.sources.push({ slot: 'spike', dmg: me.onSpike.damage });
            certainty += 0.5;
        } else {
            const worst = this.spikeOnKnockbackPath();
            if (worst) {
                out.spike += worst.damage;
                out.sources.push({ slot: 'spike-projected', dmg: worst.damage });
                certainty += 0.25;
            }
        }

        out.total = out.hits + out.secondary + out.turret + out.spike;

        /* NovaStorm caps the accumulator so a crowd cannot inflate it past what
         * one tick can actually deliver. The cap is the largest single-tick
         * total the game can produce, taken from the tables. */
        const cap = Config.get('defense.safeSoldier.damageCap');
        if (out.total > cap) out.total = cap;

        /* Soldier Helmet's own reduction, so the projection is what we would
         * take AFTER wearing it -- otherwise the module keeps the hat on for
         * damage it has already prevented. */
        const soldier = Defs.hats.find((h) => h.id === Defs.HAT.SOLDIER);
        out.mitigated = soldier && soldier.dmgMult ? out.total * soldier.dmgMult : out.total;

        out.confidence = U.clamp(certainty, 0, 1);
        return out;
    },

    /* The worst enemy spike a knockback from the nearest enemy would push us
     * onto. Returns null when there is none. */
    spikeOnKnockbackPath() {
        const me = GameState.self;
        const enemy = Targeting.primary;
        if (!enemy) return null;

        const kb = Prediction.knockbackTo(me, enemy.x2, enemy.y2);
        let worst = null;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            const pad = obj.scale + me.scale;
            const lands = U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                me.x2, me.y2, kb.x, kb.y
            );
            if (!lands) continue;
            if (!worst || obj.damage > worst.damage) worst = { object: obj, damage: obj.damage };
        }
        return worst;
    },

    debugState() {
        const p = this.lastProjection;
        if (!p) return null;
        return {
            total: Math.round(p.total),
            mitigated: Math.round(p.mitigated || p.total),
            confidence: Math.round(p.confidence * 100) / 100,
            sources: p.sources
        };
    }
};


/* ---- 56-mod-autoheal.js ---- */
/* ===========================================================================
 * 2yz / AutoHeal
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's heal() and its heal gate
 * (novastorm_1.4.txt:12582 and 15226).
 *
 * NovaStorm's rule is: if projected incoming damage would kill us, or a tick
 * has passed since we were last hit, eat until full -- `for (i = 0; i < value;
 * i += items.list[items[0]].heal) place(items[0])`. The loop is the right shape
 * (one build packet per food item, count derived from the food's heal value
 * rather than guessed) and 2yz keeps it.
 *
 * What it does not do, and 2yz does:
 *
 *   - budget the food. Eating to full costs four frames per apple. At low
 *     health with a full second of packets already spent, NovaStorm queues them
 *     anyway and they are dropped mid-sequence, which leaves the client holding
 *     an apple. Here the count is clamped to what the frame budget can actually
 *     carry, and the restore is part of the same intent.
 *
 *   - respect shame. Eating past the shame ceiling gives the food away and
 *     resets nothing; HealIntent.validate refuses it.
 *
 *   - heal in the gap rather than into the hit. If a burst is already in flight
 *     and we would survive it, healing after it lands is worth more than
 *     healing before -- the heal that matters is the one that is not
 *     immediately erased.
 * =========================================================================== */

const AutoHeal = {
    name: 'AutoHeal',

    tick() {
        if (!Config.get('defense.autoHeal.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const foodId = GameState.foodItem;
        if (foodId == null) return null;
        const food = Defs.items[foodId];
        if (!food || !food.heal) return null;

        /* Total health one item is worth. Cheese restores 30 immediately and a
         * further 10 per tick for 5 ticks; both figures come from probing the
         * item's own consume() at extraction time, so counting only the instant
         * part would make 2yz eat roughly twice as much cheese as it needs. */
        const perItem = food.heal
            + (food.healOverTime ? food.healOverTime.perTick * food.healOverTime.ticks : 0);

        const missing = me.maxHealth - me.health;
        if (missing <= 0) return null;

        const incoming = SafeSoldier.lastProjection
            ? (SafeSoldier.lastProjection.mitigated || SafeSoldier.lastProjection.total)
            : Targeting.incomingDamage();

        const lethal = incoming >= me.health;
        const hurt = missing >= Config.get('defense.autoHeal.minMissing');
        const quiet = GameState.tick - me.lastHitTick > Config.get('defense.autoHeal.calmTicks');

        /* Three reasons to eat, in descending order of how much it matters. */
        let urgency = null;
        let reason = null;
        if (lethal) {
            urgency = Config.get('defense.autoHeal.urgencyLethal');
            reason = 'lethal-incoming';
        } else if (hurt && quiet) {
            urgency = Config.get('defense.autoHeal.urgencyTopUp');
            reason = 'top-up';
        } else if (hurt && incoming > 0 && me.health - incoming < Config.get('defense.autoHeal.dangerFloor')) {
            urgency = Config.get('defense.autoHeal.urgencyDanger');
            reason = 'below-floor';
        }
        if (urgency == null) return null;

        /* How many items to eat: enough to cover what is missing plus what is
         * incoming, never more than one full bar's worth. */
        const wanted = lethal ? missing + incoming : missing;
        /* Under fire the over-time portion arrives too late to matter, so a
         * lethal projection is budgeted against the instant heal only. */
        let count = Math.ceil(wanted / (lethal ? food.heal : perItem));

        /* Clamp to the frame budget. Four frames per item, and leave room for
         * whatever else the tick still owes. */
        const framesEach = 4;
        const reserve = Config.get('defense.autoHeal.frameReserve');
        const affordable = Math.floor((Net.budgetRemaining() - reserve) / framesEach);
        count = Math.min(count, affordable, Config.get('defense.autoHeal.maxItems'));
        if (count < 1) return null;

        return new HealIntent({
            source: this.name,
            urgency,
            confidence: lethal ? 1 : 0.8,
            target: Targeting.primary,
            itemId: foodId,
            count,
            meta: { reason, incoming: Math.round(incoming), missing }
        });
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        return {
            health: me.health,
            incoming: Math.round(Targeting.incomingDamage()),
            shame: me.shameCount,
            food: GameState.foodItem
        };
    }
};


/* ---- 57-mod-automills.js ---- */
/* ===========================================================================
 * 2yz / AutoMills
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's mill block inside getPredictObjects
 * (novastorm_1.4.txt:13358), the one its own comment calls "SHIT AUTO MILLS".
 *
 * The one good idea in it: mills go behind you, spread by the mill's own scale
 * (`angle -/+ toRad(scale + scale/2)`), so a walking player leaves a wall of
 * them rather than a pile. 2yz keeps the trailing placement and the
 * scale-derived spread, and gets the angles from PlacementEngine's 'utility'
 * ranking, which already prefers positions behind the direction of travel and
 * penalises anything across the path ahead.
 *
 * Everything else about NovaStorm's version is a problem this module exists to
 * fix. It runs on the same tick budget as the placer, in the same pass, with
 * only `!nearestTrap` between it and spending three build sequences while the
 * player is being tick-chained. Here it is the lowest-urgency producer in the
 * client and it withdraws entirely when anything real is happening -- so the
 * Arbiter never has to choose between a mill and a spike, because on a tick
 * where a spike is wanted the mill intent is not offered at all.
 * =========================================================================== */

const AutoMills = {
    name: 'AutoMills',

    tick() {
        if (!Config.get('utility.autoMills.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const millId = GameState.millItem;
        if (millId == null || GameState.isItemLimit(millId)) return null;

        if (this.suppressed()) return null;

        /* Trailing direction: opposite whichever way we are actually going. */
        const heading = GameState.input.moveDir != null ? GameState.input.moveDir : me.moveDir;
        if (heading == null) return null;

        const ranked = PlacementEngine.bestN(millId, Targeting.primary, 'utility', 8);
        if (!ranked.length) return null;

        const behind = heading + Math.PI;
        const spread = Config.get('utility.autoMills.spreadFactor');
        const item = Defs.items[millId];
        /* NovaStorm's spread: the mill's own scale, in degrees, times a factor.
         * Reading it from the item keeps the spacing right if the item changes. */
        const step = U.toRad(item.scale * spread);

        const wanted = [behind, behind - step, behind + step]
            .slice(0, Config.get('utility.autoMills.perTick'));

        const intents = [];
        for (const angle of wanted) {
            /* Take the ranked candidate nearest each wanted angle, so the mill
             * still lands somewhere legal when the exact angle is blocked. */
            let best = null;
            let bestGap = Infinity;
            for (const c of ranked) {
                const gap = U.getAngleDist(c.angle, angle);
                if (gap < bestGap && gap <= step) { bestGap = gap; best = c; }
            }
            if (!best) continue;
            if (intents.some((i) => i.candidate === best)) continue;

            intents.push(new PlacementIntent({
                source: this.name,
                urgency: Config.get('utility.autoMills.urgency'),
                confidence: 1,
                target: null,
                candidate: best,
                reason: 'mill-trail'
            }));
        }

        return intents.length ? intents : null;
    },

    /* Every reason not to be building mills. This is the module's real job:
     * the placement itself is trivial, staying out of the way is not. */
    suppressed() {
        const me = GameState.self;

        /* Anything hostile nearby and mills are the wrong use of the tick. */
        const enemies = Targeting.within(Config.get('utility.autoMills.safeRadius'));
        if (enemies.length) return true;

        /* Held, hurt or bleeding. */
        if (me.trapped || me.onSpike) return true;
        if (me.health < me.maxHealth * Config.get('utility.autoMills.minHealthFraction')) return true;

        /* Combat has something in flight. */
        if (CombatEngine.activeSequence) return true;
        if (Preplace.armed) return true;

        /* Resource floor: mills are worth building only out of surplus. The
         * cost comes from the item's own requirement, not a guess. */
        const item = Defs.items[GameState.millItem];
        if (item && item.req) {
            for (let i = 0; i < item.req.length; i += 2) {
                const resource = item.req[i];
                const amount = item.req[i + 1];
                const have = GameState.resources[resource];
                if (have == null) continue;
                const reserve = Config.get('utility.autoMills.resourceReserve');
                if (have - amount < reserve) return true;
            }
        }

        /* Frame budget: mills never eat into what a real action might need. */
        if (Net.budgetRemaining() < Config.get('utility.autoMills.frameFloor')) return true;

        return false;
    },

    debugState() {
        return {
            suppressed: GameState.self ? this.suppressed() : true,
            mill: GameState.millItem,
            count: GameState.itemCounts[Defs.GROUP.MILL] || 0,
            limit: Defs.groupLimit(Defs.GROUP.MILL)
        };
    }
};


/* ---- 58-mod-autobreak.js ---- */
/* ===========================================================================
 * 2yz / AutoBreak
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's autoBreak block and its selectWeaponAndBreak
 * helper (novastorm_1.4.txt:14008-14040).
 *
 * This module closes the one architectural gap the first build shipped with.
 * Anti Smart Tick decides when NOT to break out of a trap -- but nothing in
 * 2yz actually broke out, so the hold guarded a decision the client never made.
 * Combat only ever targets players; a structure is a different kind of target
 * and gets its own module.
 *
 * NovaStorm's weapon-selection ladder is the part worth keeping, and it is a
 * genuinely good piece of reasoning:
 *
 *   - a fast primary that can one-shot the structure beats the hammer, because
 *     the swing recovers sooner and the follow-up lands earlier;
 *   - otherwise the hammer, if the structure is in its reach;
 *   - otherwise the primary;
 *   - and while trapped, a fast primary in range regardless, because being
 *     free one tick sooner outweighs the damage difference.
 *
 * 2yz keeps that order, reads every damage and range figure from the shipped
 * tables, and adds the priority NovaStorm leaves implicit: what to break first
 * when several things qualify.
 * =========================================================================== */

const AutoBreak = {
    name: 'AutoBreak',

    tick() {
        if (!Config.get('combat.autoBreak.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const target = this.pick();
        if (!target) return null;

        const choice = this.chooseWeapon(target.object);
        if (!choice) return null;

        return new BreakIntent({
            source: this.name,
            urgency: target.urgency,
            confidence: 1,
            target: Targeting.primary,
            object: target.object,
            slot: choice.slot,
            weapon: choice.weapon,
            angle: U.getDirection(target.object.x, target.object.y, me.x2, me.y2),
            reason: target.reason
        });
    },

    /* What to break, in descending order of how much it matters. */
    pick() {
        const me = GameState.self;
        const enemy = Targeting.primary;

        /* 1. The trap holding us. Nothing else matters while we cannot move.
         *    Anti Smart Tick may veto this through its HoldIntent -- that is
         *    exactly the interaction it exists for. */
        if (me.trapped && me.trapObject && this.reachable(me.trapObject)) {
            return {
                object: me.trapObject,
                urgency: Config.get('combat.autoBreak.urgencyEscape'),
                reason: 'escape-trap'
            };
        }

        /* 2. An enemy structure standing between us and the target. Breaking it
         *    is what re-opens the swing. */
        if (enemy && Config.get('combat.autoBreak.clearLine')) {
            const blocker = this.lineBlocker(enemy);
            if (blocker) {
                return {
                    object: blocker,
                    urgency: Config.get('combat.autoBreak.urgencyClear'),
                    reason: 'clear-line'
                };
            }
        }

        /* 3. An enemy spike close enough to hurt us where we stand. */
        if (Config.get('combat.autoBreak.clearHazards')) {
            const hazard = this.nearestHazard();
            if (hazard) {
                return {
                    object: hazard,
                    urgency: Config.get('combat.autoBreak.urgencyHazard'),
                    reason: 'clear-hazard'
                };
            }
        }

        return null;
    },

    reachable(obj) {
        const me = GameState.self;
        const reach = Math.max(
            EntityTracker.rangeOf(me, 0),
            GameState.weapons[1] != null ? EntityTracker.rangeOf(me, 1) : 0
        );
        return U.getDistance(me.x2, me.y2, obj.x, obj.y) <= reach + me.scale + obj.scale;
    },

    /* An enemy structure sitting on the line from us to the target. */
    lineBlocker(enemy) {
        const me = GameState.self;
        let best = null;
        let bestDist = Infinity;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || !obj.isItem) continue;
            if (!this.reachable(obj)) continue;
            const pad = obj.scale;
            const onLine = U.lineInRect(
                obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                me.x2, me.y2, enemy.x2, enemy.y2
            );
            if (!onLine) continue;
            const d = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
    },

    /* The enemy spike we are standing on or about to be pushed into. */
    nearestHazard() {
        const me = GameState.self;
        if (me.onSpike && me.onSpike.ownerSid != null
            && !GameState.isAlly(me.onSpike.ownerSid)
            && this.reachable(me.onSpike)) {
            return me.onSpike;
        }
        let best = null;
        let bestDist = Infinity;
        for (const obj of GameState.enemyObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            if (!this.reachable(obj)) continue;
            const d = U.getDistance(me.x2, me.y2, obj.x, obj.y);
            if (d > obj.scale + me.scale + Config.get('combat.autoBreak.hazardMargin')) continue;
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
    },

    /* NovaStorm's ladder, with the figures read from the tables. */
    chooseWeapon(obj) {
        const me = GameState.self;
        const primary = GameState.weapons[0];
        const secondary = GameState.weapons[1];

        const inRange = (slot) => {
            const idx = slot === 0 ? primary : secondary;
            if (idx == null) return false;
            const w = Defs.weapons[idx];
            if (!w || w.range == null) return false;
            return U.getDistance(me.x2, me.y2, obj.x, obj.y) <= w.range + me.scale + obj.scale;
        };

        const primaryFast = Defs.weapons[primary]
            && Defs.weapons[primary].speed < Config.get('combat.autoBreak.fastPrimarySpeed');
        const primaryOneShot = EntityTracker.structureDamage(me, 0) >= obj.health;
        const secondaryIsHammer = secondary != null
            && Defs.weapons[secondary] && Defs.weapons[secondary].sDmg > 1;

        /* A slot that is still on cooldown cannot break anything this tick. */
        const ready = (slot) => (slot === 0
            ? EntityTracker.primaryReady(me.sid)
            : EntityTracker.secondaryReady(me.sid));

        if (primaryFast && primaryOneShot && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        if (secondaryIsHammer && inRange(1) && ready(1)) {
            return { slot: 1, weapon: secondary };
        }
        if (!secondaryIsHammer && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        if (me.trapped && primaryFast && inRange(0) && ready(0)) {
            return { slot: 0, weapon: primary };
        }
        return null;
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        const t = this.pick();
        return {
            trapped: me.trapped,
            breaking: t ? t.object.name + ' (' + t.reason + ')' : null,
            weapon: t ? this.chooseWeapon(t.object) : null
        };
    }
};


/* ---- 59-mod-movement.js ---- */
/* ===========================================================================
 * 2yz / Movement
 * ---------------------------------------------------------------------------
 * Source concepts: NovaStorm's canAutoPush and isNearestEnemyPushPlayer
 * (novastorm_1.4.txt:13757 and 13780).
 *
 * This is the module that most needs restraint, so its default is off. 2yz
 * normally never sends a movement packet at all -- the player's own MOVE_DIR
 * passes through untouched and the client is a decision layer on top of human
 * movement. This module is the exception, and it only speaks when it has a
 * specific reason:
 *
 *   anti-knockback  a hit is about to throw us onto a structure; lean into the
 *                   push so the displacement lands short of it
 *   safe walk       the direction we are already going runs into an enemy spike
 *                   inside the next second; steer to the nearest clear heading
 *   push            walking into the target would carry them onto one of our
 *                   spikes, and the lane is clear of hazards for us
 *
 * NovaStorm's canAutoPush is the good idea here: before committing to a push,
 * sweep every object on the lane and refuse if the lane costs us more than it
 * costs them. Its hazard classes -- enemy spikes, boost pads, teleporters --
 * come from the shipped item table rather than the id literals NovaStorm uses.
 * =========================================================================== */

const Movement = {
    name: 'Movement',

    tick() {
        if (!Config.get('movement.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        /* Order matters: surviving beats positioning beats aggression. */
        return this.antiKnockback(me)
            || this.safeWalk(me)
            || this.push(me)
            || null;
    },

    /* --------------------------------------------------------- anti-knockback
     * A hit coming from the enemy pushes us along enemy->us. If that push lands
     * us on a damaging structure, moving INTO the incoming direction shortens
     * the displacement enough to stop short of it. */
    antiKnockback(me) {
        if (!Config.get('movement.antiKnockback')) return null;
        const enemy = Targeting.primary;
        if (!enemy) return null;

        /* Only worth it when a hit is actually imminent. */
        if (!EntityTracker.primaryReady(enemy.sid) && !EntityTracker.secondaryReady(enemy.sid)) {
            return null;
        }
        const reach = Math.max(
            EntityTracker.rangeOf(enemy, 0),
            enemy.secondaryIndex != null ? EntityTracker.rangeOf(enemy, 1) : 0
        ) + me.scale + enemy.scale;
        if (Targeting.distanceTo(enemy) > reach) return null;

        const kb = Prediction.knockbackTo(me, enemy.x2, enemy.y2);
        const hazard = this.hazardOnSegment(me.x2, me.y2, kb.x, kb.y, me.scale);
        if (!hazard) return null;

        /* Lean toward the attacker: the push and our movement partly cancel. */
        const into = U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2);
        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencyAntiKnockback'),
            confidence: Prediction.confidence(enemy),
            target: enemy,
            angle: into,
            reason: 'anti-kb',
            holdTicks: 1
        });
    },

    /* ------------------------------------------------------------- safe walk
     * The heading the player is already using, projected forward. If it runs
     * into a hazard, pick the nearest heading that does not. */
    safeWalk(me) {
        if (!Config.get('movement.safeWalk')) return null;
        const heading = GameState.input.moveDir;
        if (heading == null) return null;

        const reach = Config.get('movement.lookaheadDistance');
        const endX = me.x2 + reach * Math.cos(heading);
        const endY = me.y2 + reach * Math.sin(heading);
        if (!this.hazardOnSegment(me.x2, me.y2, endX, endY, me.scale)) return null;

        /* Sweep outward from the intended heading so the correction is the
         * smallest one that works, rather than the first one found. */
        const steps = Config.get('movement.avoidSteps');
        for (let i = 1; i <= steps; i++) {
            const offset = (i / steps) * (Math.PI * 0.75);
            for (const sign of [1, -1]) {
                const candidate = heading + sign * offset;
                const cx = me.x2 + reach * Math.cos(candidate);
                const cy = me.y2 + reach * Math.sin(candidate);
                if (this.hazardOnSegment(me.x2, me.y2, cx, cy, me.scale)) continue;
                return new MoveIntent({
                    source: this.name,
                    urgency: Config.get('movement.urgencySafeWalk'),
                    confidence: 1,
                    target: Targeting.primary,
                    angle: candidate,
                    reason: 'safe-walk',
                    holdTicks: 1
                });
            }
        }
        /* Every direction is blocked -- stopping beats walking into it. */
        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencySafeWalk'),
            confidence: 1,
            target: Targeting.primary,
            angle: null,
            reason: 'boxed-in',
            holdTicks: 1
        });
    },

    /* ------------------------------------------------------------------ push
     * Walk into the target when body-blocking would carry them onto one of our
     * spikes. NovaStorm gates this on the lane being clear for US, which is the
     * part that stops a push from being a mutual suicide. */
    push(me) {
        if (!Config.get('movement.autoPush')) return null;
        const enemy = Targeting.primary;
        if (!enemy) return null;
        if (me.trapped) return null;

        const gap = Targeting.distanceTo(enemy);
        if (gap > Config.get('movement.pushRange')) return null;

        /* Where would shoving them take them? */
        const shove = U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2);
        const dist = Config.get('movement.pushDistance');
        const endX = enemy.x2 + dist * Math.cos(shove);
        const endY = enemy.y2 + dist * Math.sin(shove);

        let lands = null;
        for (const obj of GameState.myObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            const pad = obj.scale + enemy.scale;
            if (U.lineInRect(obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad,
                enemy.x2, enemy.y2, endX, endY)) { lands = obj; break; }
        }
        if (!lands) return null;

        /* NovaStorm's guard: the lane we would walk down must be clear for us. */
        if (this.hazardOnSegment(me.x2, me.y2, enemy.x2, enemy.y2, me.scale)) return null;

        return new MoveIntent({
            source: this.name,
            urgency: Config.get('movement.urgencyPush'),
            confidence: Prediction.confidence(enemy),
            target: enemy,
            angle: U.getDirection(enemy.x2, enemy.y2, me.x2, me.y2),
            reason: 'push-into-spike',
            holdTicks: 1
        });
    },

    /* ---------------------------------------------------------------- shared
     * Anything on this segment that would hurt or displace us. Hazard classes
     * come from the item table: dmg for spikes, boostSpeed for pads, teleport
     * for teleporters, trap for pit traps we do not own. */
    hazardOnSegment(x1, y1, x2, y2, radius) {
        const objects = GameState.nearObjects;
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj.active || !obj.isItem) continue;

            const ours = obj.ownerSid != null
                && (obj.ownerSid === GameState.mySid || GameState.isAlly(obj.ownerSid));

            const item = obj.item || {};
            const hurts = obj.damage > 0 && !ours;
            const holds = obj.trap && !ours;
            const shoves = !!item.boostSpeed;
            const ports = !!item.teleport;
            if (!hurts && !holds && !shoves && !ports) continue;

            if (U.pointToSegment(obj.x, obj.y, x1, y1, x2, y2) < obj.scale + radius) return obj;
        }
        return null;
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        const heading = GameState.input.moveDir;
        return {
            enabled: Config.get('movement.enabled'),
            heading: heading == null ? null : Math.round(U.toDeg(heading)),
            hazardAhead: heading == null ? null : !!this.hazardOnSegment(
                me.x2, me.y2,
                me.x2 + Config.get('movement.lookaheadDistance') * Math.cos(heading),
                me.y2 + Config.get('movement.lookaheadDistance') * Math.sin(heading),
                me.scale
            )
        };
    }
};


/* ---- 5a-mod-autoupgrade.js ---- */
/* ===========================================================================
 * 2yz / AutoUpgrade
 * ---------------------------------------------------------------------------
 * Take age upgrades automatically.
 *
 * The index space is the game's own, read off the offer builder at
 * game_index.js:4734: weapons occupy indices 0..weapons.length-1, items follow
 * at weapons.length + itemIndex. An entry is only offered when its `age`
 * matches the tier the server just announced AND its `pre` prerequisite is
 * already owned. 2yz reproduces exactly that filter rather than sending a
 * hard-coded sequence of indices, which is what breaks the moment a build order
 * diverges or the server offers a different tier.
 *
 * The preference order is a config list of item and weapon NAMES, resolved
 * against the shipped tables. Names rather than ids, so a table renumbering
 * upstream cannot silently repoint a choice at something else.
 * =========================================================================== */

const AutoUpgrade = {
    name: 'AutoUpgrade',

    tick() {
        if (!Config.get('utility.autoUpgrade.enabled')) return null;
        if (!GameState.inGame) return null;
        if (GameState.upgradePoints <= 0) return null;

        const offers = this.offers();
        if (!offers.length) return null;

        const pick = this.choose(offers);
        if (!pick) return null;

        return new UpgradeIntent({
            source: this.name,
            urgency: Config.get('utility.autoUpgrade.urgency'),
            confidence: 1,
            index: pick.index,
            label: pick.name,
            forAge: GameState.upgradeAge
        });
    },

    /* Exactly the filter the game applies when it builds the upgrade row. */
    offers() {
        const tier = GameState.upgradeAge;
        const out = [];

        for (let i = 0; i < Defs.weapons.length; i++) {
            const w = Defs.weapons[i];
            if (w.age !== tier) continue;
            if (w.pre != null && GameState.weapons.indexOf(w.pre) < 0) continue;
            out.push({ index: i, name: w.name, kind: 'weapon' });
        }
        for (let i = 0; i < Defs.items.length; i++) {
            const it = Defs.items[i];
            if (it.age !== tier) continue;
            if (it.pre != null && GameState.items.indexOf(it.pre) < 0) continue;
            out.push({ index: Defs.weapons.length + i, name: it.name, kind: 'item' });
        }
        return out;
    },

    /* First match in the preference list wins; anything unlisted is taken only
     * if the list produced nothing and the fallback is on, so an unattended
     * client still ages up rather than sitting on unspent points. */
    choose(offers) {
        const order = Config.get('utility.autoUpgrade.order')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        for (const wanted of order) {
            const hit = offers.find((o) => o.name.toLowerCase() === wanted);
            if (hit) return hit;
        }
        if (Config.get('utility.autoUpgrade.takeAnything')) return offers[0];
        return null;
    },

    debugState() {
        if (!GameState.inGame) return null;
        return {
            points: GameState.upgradePoints,
            tier: GameState.upgradeAge,
            offers: this.offers().map((o) => o.name)
        };
    }
};


/* ---- 5b-mod-autobuy.js ---- */
/* ===========================================================================
 * 2yz / AutoBuy
 * ---------------------------------------------------------------------------
 * Buy the hats and accessories the defensive and offensive modules want to
 * wear, so they stop being no-ops on a fresh account.
 *
 * Safe Soldier and Combat's damage hat both refuse to act on a hat that is not
 * owned (DefenseIntent.validate returns 'hat-not-owned'). Without this module
 * that is a permanent refusal rather than a temporary one.
 *
 * Prices come from the shipped hat and accessory tables. The wanted list is
 * config, by NAME, resolved against those tables -- so it cannot point at an id
 * that no longer means what it did.
 * =========================================================================== */

const AutoBuy = {
    name: 'AutoBuy',

    tick() {
        if (!Config.get('utility.autoBuy.enabled')) return null;
        if (!GameState.inGame) return null;

        const reserve = Config.get('utility.autoBuy.pointReserve');
        const budget = GameState.resources.points - reserve;
        if (budget <= 0) return null;

        const want = this.wanted();
        for (const entry of want) {
            const owned = entry.accessory ? GameState.tails : GameState.skins;
            if (owned[entry.id]) continue;
            if (entry.price > budget) continue;
            return new BuyIntent({
                source: this.name,
                urgency: Config.get('utility.autoBuy.urgency'),
                confidence: 1,
                id: entry.id,
                accessory: entry.accessory,
                price: entry.price,
                label: entry.name
            });
        }
        return null;
    },

    /* The configured names, resolved to real table entries. Anything that does
     * not resolve is dropped rather than guessed at. */
    wanted() {
        const names = Config.get('utility.autoBuy.wanted')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        const out = [];
        for (const name of names) {
            const hat = Defs.hats.find((h) => h.name.toLowerCase() === name);
            if (hat && hat.price != null) {
                out.push({ id: hat.id, name: hat.name, price: hat.price, accessory: false });
                continue;
            }
            const acc = Defs.accessories.find((a) => a.name.toLowerCase() === name);
            if (acc && acc.price != null) {
                out.push({ id: acc.id, name: acc.name, price: acc.price, accessory: true });
            }
        }
        return out;
    },

    debugState() {
        if (!GameState.inGame) return null;
        return {
            points: GameState.resources.points,
            missing: this.wanted()
                .filter((e) => !(e.accessory ? GameState.tails : GameState.skins)[e.id])
                .map((e) => e.name + '(' + e.price + ')')
        };
    }
};


/* ---- 5c-mod-autorespawn.js ---- */
/* ===========================================================================
 * 2yz / AutoRespawn
 * ---------------------------------------------------------------------------
 * Respawn after death by replaying the exact payload the game itself sent.
 *
 * The spawn packet carries {name, moofoll, skin} (game_index.js:4612). 2yz
 * records that payload when the game sends it (Router.handleOutbound) and plays
 * it back rather than reconstructing one, because a reconstructed payload would
 * mean guessing the player's name and skin choice.
 *
 * The delay exists because respawning on the same frame as the death packet is
 * both suspicious and useless -- the death screen has not finished processing.
 * =========================================================================== */

const AutoRespawn = {
    name: 'AutoRespawn',

    deadSinceTick: -1,
    deadAt: 0,

    install() {
        Events.on('death', () => {
            this.deadSinceTick = GameState.tick;
            this.deadAt = Date.now();
        });
        Events.on('spawn', () => { this.deadSinceTick = -1; });
    },

    tick() {
        if (!Config.get('utility.autoRespawn.enabled')) return null;
        if (GameState.inGame) return null;
        if (this.deadSinceTick < 0) return null;
        if (!GameState.lastSpawn) return null;

        if (Date.now() - this.deadAt < Config.get('utility.autoRespawn.delayMs')) return null;

        return new SpawnIntent({
            source: this.name,
            urgency: Config.get('utility.autoRespawn.urgency'),
            confidence: 1,
            payload: GameState.lastSpawn
        });
    },

    debugState() {
        return {
            dead: !GameState.inGame,
            haveSpawnPayload: !!GameState.lastSpawn,
            waitedMs: this.deadSinceTick < 0 ? 0 : Date.now() - this.deadAt
        };
    }
};


/* ---- 5d-mod-autogather.js ---- */
/* ===========================================================================
 * 2yz / AutoGather
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's needAutoGather (novastorm_1.4.txt:15316).
 *
 * The game's auto-gather toggle (C2S TOGGLE with 1) holds the attack down, so
 * it both farms resources and keeps a weapon swinging. NovaStorm's rule is that
 * it should be ON while the player is actually engaged or gathering, and OFF
 * while a defensive situation is live -- because a held attack fights the
 * client's own swing timing and burns the cooldown a burst needs.
 *
 * 2yz keeps that shape and states the conflict explicitly: the toggle is turned
 * off whenever Combat has a sequence in flight, because a held attack makes
 * per-tick swing scheduling meaningless.
 * =========================================================================== */

const AutoGather = {
    name: 'AutoGather',

    tick() {
        if (!Config.get('utility.autoGather.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const desired = this.shouldHold();
        if (GameState.input.autoGather === desired) return null;

        return new ToggleIntent({
            source: this.name,
            urgency: Config.get('utility.autoGather.urgency'),
            confidence: 1,
            which: 1,
            desired,
            reason: desired ? 'gather-on' : 'gather-off'
        });
    },

    shouldHold() {
        const me = GameState.self;

        /* A held attack and a scheduled burst cannot both own the swing. */
        if (CombatEngine.activeSequence) return false;

        /* Defensive situations want the swing free. */
        if (me.trapped || me.onSpike) return false;
        if (SafeSoldier.lastProjection
            && SafeSoldier.lastProjection.total >= Config.get('defense.safeSoldier.threshold')) {
            return false;
        }

        /* No enemy nearby: farming is the whole point. */
        const enemies = Targeting.within(Config.get('utility.autoGather.combatRadius'));
        if (!enemies.length) return true;

        /* Enemy nearby but out of reach and we are not committed -- keep
         * gathering, it is free value. */
        const target = Targeting.primary;
        return !!target && !CombatEngine.isOpen(target);
    },

    debugState() {
        return {
            on: GameState.input.autoGather,
            wants: GameState.self ? this.shouldHold() : null
        };
    }
};


/* ---- 5e-mod-shamereset.js ---- */
/* ===========================================================================
 * 2yz / ShameReset
 * ---------------------------------------------------------------------------
 * Source concept: NovaStorm's shouldResetShame flag and the hatFc branch that
 * acts on it (novastorm_1.4.txt:15208 and 16188).
 *
 * Shame is the game's anti-heal-spam counter: past a threshold, eating stops
 * restoring health. The counter decays on its own, and the Bull Helmet's
 * healthRegen of -5 (from the shipped hat table) drains health continuously,
 * which is what makes wearing it during a lull the standard way to burn the
 * counter down without wasting food.
 *
 * NovaStorm sets its flag when nothing is happening -- no projected damage, no
 * structure contact, no poison -- and clears it the same tick. 2yz keeps that
 * condition, and adds the two things NovaStorm's version does not check: it
 * refuses while health is low enough that the drain itself is a risk, and it
 * yields to Safe Soldier by carrying a lower urgency, so an incoming hit always
 * wins the hat slot.
 *
 * Note on what 2yz can and cannot see: the local player's shame count is not
 * transmitted as a field. It is inferred from heals that produced no health
 * change, which is the only observable the protocol offers.
 * =========================================================================== */

const ShameReset = {
    name: 'ShameReset',

    /* Inferred, not received. A heal that moved the health bar means the
     * counter is not blocking yet; one that did not means it is. */
    pendingHeal: null,

    install() {
        Events.on('healSent', () => {
            const me = GameState.self;
            if (!me) return;
            this.pendingHeal = { tick: GameState.tick, health: me.health };
        });

        Events.on('trackerReady', () => {
            const me = GameState.self;
            const p = this.pendingHeal;
            if (!me || !p) return;
            /* Give the server a tick to apply it. */
            if (GameState.tick <= p.tick) return;
            this.pendingHeal = null;
            if (me.health > p.health) me.shameCount = Math.max(0, me.shameCount - 1);
            else if (me.health === p.health && me.health < me.maxHealth) me.shameCount++;
        });

        Events.on('spawn', () => {
            this.pendingHeal = null;
            if (GameState.self) GameState.self.shameCount = 0;
        });
    },

    tick() {
        if (!Config.get('defense.shameReset.enabled')) return null;
        const me = GameState.self;
        if (!me || !me.alive || !GameState.inGame) return null;

        const bull = Defs.HAT.BULL;
        if (bull == null || !GameState.skins[bull]) return null;
        if (me.skinIndex === bull) return null;

        if (me.shameCount < Config.get('defense.shameReset.minShame')) return null;

        /* Only during a genuine lull -- the drain is a cost, and wearing a
         * damage hat while something is incoming is Safe Soldier's problem. */
        if (me.trapped || me.onSpike) return null;
        if (Targeting.incomingDamage() > 0) return null;
        if (Targeting.within(Config.get('defense.shameReset.safeRadius')).length) return null;

        /* The hat drains health; do not wear it into a hole. */
        const floor = Config.get('defense.shameReset.minHealthFraction');
        if (me.health < me.maxHealth * floor) return null;

        return new DefenseIntent({
            source: this.name,
            /* Deliberately below Safe Soldier's base, so any real threat
             * takes the hat slot instead. */
            urgency: Config.get('defense.shameReset.urgency'),
            confidence: 1,
            target: null,
            hat: bull,
            reason: 'burn-shame-' + me.shameCount
        });
    },

    debugState() {
        const me = GameState.self;
        if (!me) return null;
        return {
            shame: me.shameCount,
            ceiling: Config.get('defense.shameCeiling'),
            wearing: me.skinIndex
        };
    }
};


/* ---- 5f-mod-autochat.js ---- */
/* ===========================================================================
 * 2yz / AutoChat
 * ---------------------------------------------------------------------------
 * Kill messages and a rotating idle line.
 *
 * The game truncates chat at 30 characters and rate-limits it with
 * chatCooldown (500ms) and chatCountdown (3000ms), both from the shipped
 * config. 2yz honours the longer of the two rather than picking a delay, so it
 * cannot get itself muted by outrunning the server's own limiter.
 *
 * Every message is a ChatIntent, so it competes for the packet budget like
 * anything else and is dropped rather than queued when the budget is spent.
 * =========================================================================== */

const AutoChat = {
    name: 'AutoChat',

    pending: null,
    lastSentAt: 0,
    rotation: 0,

    install() {
        Events.on('kill', () => {
            if (!Config.get('chat.killChat')) return;
            const lines = this.lines(Config.get('chat.killLines'));
            if (!lines.length) return;
            this.pending = {
                text: lines[GameState.killsThisLife % lines.length],
                reason: 'kill'
            };
        });
        Events.on('death', () => { this.pending = null; });
    },

    lines(raw) {
        return String(raw).split('|').map((s) => s.trim()).filter(Boolean);
    },

    /* The game's own limiter, from config rather than a chosen number. */
    cooldownMs() {
        return Math.max(Defs.config.chatCooldown, Config.get('chat.minGapMs'));
    },

    tick() {
        if (!Config.get('chat.enabled')) return null;
        if (!GameState.inGame) return null;
        if (Date.now() - this.lastSentAt < this.cooldownMs()) return null;

        let message = this.pending;
        this.pending = null;

        if (!message && Config.get('chat.idleChat')) {
            const gap = Config.get('chat.idleGapMs');
            if (Date.now() - this.lastSentAt >= gap) {
                const lines = this.lines(Config.get('chat.idleLines'));
                if (lines.length && !Targeting.primary) {
                    message = { text: lines[this.rotation % lines.length], reason: 'idle' };
                    this.rotation++;
                }
            }
        }

        if (!message) return null;
        this.lastSentAt = Date.now();

        return new ChatIntent({
            source: this.name,
            urgency: Config.get('chat.urgency'),
            confidence: 1,
            text: message.text,
            reason: message.reason
        });
    },

    debugState() {
        return {
            pending: this.pending ? this.pending.text : null,
            sinceLastMs: Date.now() - this.lastSentAt,
            kills: GameState.killsThisLife
        };
    }
};


/* ---- 60-intent.js ---- */
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


/* ---- 61-arbiter.js ---- */
/* ===========================================================================
 * 2yz / Arbiter
 * ---------------------------------------------------------------------------
 * One place decides what happens each tick.
 *
 * The rules, in order:
 *
 *   1. Everything is validated first. An intent that no longer describes the
 *      world is dropped before it can win anything.
 *
 *   2. Holds are resolved before winners are picked. A hold does not beat other
 *      intents by outranking them; it removes the specific kinds it blocks from
 *      the pool, and only if it outranks the best intent of that kind. That is
 *      what "must not blindly override Combat" means in practice -- Safe
 *      Soldier and Anti Smart Tick can veto, but only when their case is
 *      stronger than what they are vetoing.
 *
 *   3. One winner per exclusive lane. Attack, Placement and Heal each occupy
 *      the build/attack slots, so at most one runs per tick; Defense is a hat
 *      swap and rides along with whatever won.
 *
 *   4. Remaining frame budget is honoured. An intent that cannot afford its
 *      frames this tick loses to one that can, rather than being half-sent.
 * =========================================================================== */

const Arbiter = (function () {
    /* Lanes that cannot run together, because they all drive the same build and
     * attack packets. */
    const EXCLUSIVE = ['Attack', 'Placement', 'Replace', 'Heal', 'Break'];

    /* Kinds that may run at most once per tick even though they do not compete
     * for the build slot -- two upgrades or two moves in one tick is always a
     * mistake, but they can coexist with an attack. */
    const SINGLETON = ['Move', 'Upgrade', 'Buy', 'Spawn', 'Toggle', 'Chat', 'Defense'];

    let lastDecision = null;

    function byPriority(a, b) { return b.priority - a.priority; }

    function resolve(intents) {
        const dropped = [];
        const live = [];

        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            if (!intent) continue;
            const bad = intent.validate();
            if (bad) {
                intent.rejectedReason = bad;
                dropped.push(intent);
                continue;
            }
            live.push(intent);
        }

        const holds = live.filter((i) => i.kind === 'Hold').sort(byPriority);
        const actionable = live.filter((i) => i.kind !== 'Hold');

        /* Apply holds. A hold only suppresses a kind when it outranks the best
         * intent of that kind -- otherwise the thing it wants to stop was more
         * important than the stopping. */
        const suppressed = new Set();
        for (const hold of holds) {
            for (const kind of hold.blocks) {
                const best = actionable
                    .filter((i) => i.kind === kind && !suppressed.has(i))
                    .sort(byPriority)[0];
                if (!best || hold.priority > best.priority) {
                    for (const intent of actionable) {
                        if (intent.kind === kind) {
                            intent.rejectedReason = 'held:' + hold.reason;
                            suppressed.add(intent);
                        }
                    }
                }
            }
        }

        const pool = actionable.filter((i) => !suppressed.has(i)).sort(byPriority);

        const winners = [];
        let budget = Net.budgetRemaining();
        let exclusiveTaken = false;
        const singletonTaken = new Set();

        for (const intent of pool) {
            const isExclusive = EXCLUSIVE.indexOf(intent.kind) >= 0;
            if (isExclusive && exclusiveTaken) {
                intent.rejectedReason = 'lane-taken';
                suppressed.add(intent);
                continue;
            }
            if (SINGLETON.indexOf(intent.kind) >= 0 && singletonTaken.has(intent.kind)) {
                intent.rejectedReason = 'lane-taken';
                suppressed.add(intent);
                continue;
            }
            const cost = intent.frameCost();
            if (cost > budget) {
                intent.rejectedReason = 'no-budget';
                suppressed.add(intent);
                continue;
            }
            budget -= cost;
            if (isExclusive) exclusiveTaken = true;
            if (SINGLETON.indexOf(intent.kind) >= 0) singletonTaken.add(intent.kind);
            winners.push(intent);
        }

        lastDecision = {
            tick: GameState.tick,
            submitted: intents.length,
            winners,
            holds,
            rejected: dropped.concat(Array.from(suppressed)),
            budgetBefore: Net.budgetRemaining(),
            budgetAfter: budget
        };

        return winners;
    }

    return {
        resolve,
        get lastDecision() { return lastDecision; },
        debugState() {
            if (!lastDecision) return null;
            return {
                submitted: lastDecision.submitted,
                winners: lastDecision.winners.map((i) => i.describe() + ' p=' + Math.round(i.priority)),
                rejected: lastDecision.rejected.map((i) => i.describe() + ' ' + i.rejectedReason),
                budget: lastDecision.budgetAfter
            };
        }
    };
})();


/* ---- 62-scheduler.js ---- */
/* ===========================================================================
 * 2yz / PacketScheduler
 * ---------------------------------------------------------------------------
 * The only writer to the socket. Nothing else in 2yz calls Transport.write, and
 * the game bundle cannot reach the socket at all -- Transport hands its frames
 * here instead (Router.handleOutbound), so a single queue carries both.
 *
 * What it does:
 *
 *   ordering       lane order is fixed: defense hats, then the action, then the
 *                  restore. A build that forgets to reselect the weapon leaves
 *                  the player holding a wall.
 *   dedup          repeated aim/move directions inside a tick collapse to one,
 *                  and the game's own >0.3rad gate is preserved.
 *   budget         a hard cap per second; the arbiter has already reserved
 *                  against it, and anything that arrives late is dropped rather
 *                  than queued into the next second.
 *   cancellation   queued frames carry the intent that produced them, so a
 *                  cancelled sequence takes its unsent frames with it.
 *   validation     the last check happens here, one frame before the write.
 *
 * Frame costs quoted in the intents are the counts emitted below; they are not
 * estimates.
 * =========================================================================== */

const Scheduler = (function () {
    /* Frames to send this tick, in order. */
    let queue = [];
    /* Frames the game bundle produced this tick, held until flush so 2yz can
     * merge them with its own rather than interleaving unpredictably. */
    let passthrough = [];

    let lastAimSent = null;
    let lastMoveSent;
    let heldWeapon = null;
    let lastFlush = { sent: 0, dropped: 0, entries: [] };

    function push(name, args, intent, tag) {
        queue.push({ name, args, intent: intent || null, tag: tag || name });
    }

    /* --- packet builders, one per game action ---------------------------- */

    function emitSelectItem(itemId, intent) {
        push(Defs.C2S.SELECT, [itemId, true], intent, 'select-item');
    }

    function emitSelectWeapon(weaponId, intent) {
        push(Defs.C2S.SELECT, [weaponId, false], intent, 'select-weapon');
    }

    function emitAttack(angle, intent) {
        push(Defs.C2S.ATTACK, [1, angle], intent, 'attack-down');
        push(Defs.C2S.ATTACK, [0, angle], intent, 'attack-up');
    }

    function emitAim(angle, intent) {
        push(Defs.C2S.AIM_DIR, [U.fixTo(angle, 2)], intent, 'aim');
    }

    function emitEquip(id, type, intent) {
        push(Defs.C2S.STORE, [1, id, type], intent, 'equip');
    }

    function emitBuy(id, type, intent) {
        push(Defs.C2S.STORE, [0, id, type], intent, 'buy');
    }

    function emitMove(angle, intent) {
        if (angle == null) push(Defs.C2S.MOVE_STOP, [], intent, 'move-stop');
        else push(Defs.C2S.MOVE_DIR, [U.fixTo(angle, 2)], intent, 'move');
    }

    /* --- intent execution ------------------------------------------------ */

    /* Build one item, then put the weapon back. This is the sequence the game
     * itself performs when a player builds (select, press, release, reselect);
     * skipping the restore is what leaves a client stuck in build mode. */
    function executePlacement(intent) {
        const angle = intent.angle;
        emitAim(angle, intent);
        emitSelectItem(intent.itemId, intent);
        emitAttack(angle, intent);
        if (heldWeapon != null) emitSelectWeapon(heldWeapon, intent);
    }

    function executeAttack(intent) {
        if (intent.hat != null && GameState.skins[intent.hat]) {
            emitEquip(intent.hat, 0, intent);
        }
        emitAim(intent.angle, intent);
        if (intent.weapon != null) {
            emitSelectWeapon(intent.weapon, intent);
            heldWeapon = intent.weapon;
        }
        emitAttack(intent.angle, intent);
    }

    function executeHeal(intent) {
        Events.emit('healSent', intent);
        for (let i = 0; i < intent.count; i++) {
            emitSelectItem(intent.itemId, intent);
            emitAttack(null, intent);
        }
        if (heldWeapon != null) emitSelectWeapon(heldWeapon, intent);
    }

    function executeDefense(intent) {
        if (intent.hat != null) emitEquip(intent.hat, 0, intent);
    }

    /* Breaking is a swing like any other, but aimed at a fixed point. */
    function executeBreak(intent) {
        emitAim(intent.angle, intent);
        if (intent.weapon != null) {
            emitSelectWeapon(intent.weapon, intent);
            heldWeapon = intent.weapon;
        }
        emitAttack(intent.angle, intent);
    }

    function executeMove(intent) { emitMove(intent.angle, intent); }

    function executeUpgrade(intent) {
        push(Defs.C2S.UPGRADE, [intent.index], intent, 'upgrade');
    }

    function executeBuy(intent) {
        emitBuy(intent.id, intent.accessory ? 1 : 0, intent);
    }

    function executeSpawn(intent) {
        push(Defs.C2S.SPAWN, [intent.payload], intent, 'spawn');
    }

    function executeToggle(intent) {
        push(Defs.C2S.TOGGLE, [intent.which], intent, 'toggle');
    }

    function executeChat(intent) {
        push(Defs.C2S.CHAT, [intent.text], intent, 'chat');
    }

    function execute(intent) {
        switch (intent.kind) {
            case 'Placement':
            case 'Replace': return executePlacement(intent);
            case 'Attack': return executeAttack(intent);
            case 'Heal': return executeHeal(intent);
            case 'Defense': return executeDefense(intent);
            case 'Break': return executeBreak(intent);
            case 'Move': return executeMove(intent);
            case 'Upgrade': return executeUpgrade(intent);
            case 'Buy': return executeBuy(intent);
            case 'Spawn': return executeSpawn(intent);
            case 'Toggle': return executeToggle(intent);
            case 'Chat': return executeChat(intent);
            case 'Hold': return undefined;
            default: return undefined;
        }
    }

    /* --- flush ------------------------------------------------------------ */

    /* Collapse repeats inside one tick. Two aim packets in a tick is one aim
     * packet; two selects of the same weapon is one select. */
    function dedupe(entries) {
        const out = [];
        let lastSelect = null;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            if (e.name === Defs.C2S.AIM_DIR) {
                const angle = e.args[0];
                /* Same gate the game applies (game_index.js:4585): below 0.3rad
                 * of change the server keeps the old facing anyway. */
                if (lastAimSent != null && angle != null
                    && Math.abs(angle - lastAimSent) <= Config.get('network.aimEpsilon')) continue;
                /* Only the last aim of a tick can matter. */
                let laterAim = false;
                for (let j = i + 1; j < entries.length; j++) {
                    if (entries[j].name === Defs.C2S.AIM_DIR) { laterAim = true; break; }
                }
                if (laterAim) continue;
                lastAimSent = angle;
            }

            if (e.name === Defs.C2S.MOVE_DIR || e.name === Defs.C2S.MOVE_STOP) {
                /* When 2yz steers, its direction is the one that counts: a
                 * passthrough move from the game would immediately undo an
                 * anti-knockback correction. Only the last move of the tick
                 * survives, and a 2yz-owned one beats a passthrough. */
                let overridden = false;
                for (let j = i + 1; j < entries.length; j++) {
                    const later = entries[j];
                    if (later.name !== Defs.C2S.MOVE_DIR && later.name !== Defs.C2S.MOVE_STOP) continue;
                    if (e.intent == null || later.intent != null) { overridden = true; break; }
                }
                if (overridden) continue;
                const key = e.name + ':' + e.args[0];
                if (lastMoveSent === key) continue;
                lastMoveSent = key;
            }

            if (e.tag === 'select-item' || e.tag === 'select-weapon') {
                const key = e.tag + ':' + e.args[0];
                if (lastSelect === key) continue;
                lastSelect = key;
            } else if (e.name === Defs.C2S.ATTACK) {
                /* An attack invalidates the select cache: the next build has to
                 * reselect even if it is the same item. */
                lastSelect = null;
            }

            out.push(e);
        }
        return out;
    }

    function flush() {
        /* Game frames first for anything that is pure state (movement, chat,
         * store, upgrades); 2yz's own actions go after so a build is not
         * interrupted by a movement packet mid-sequence. */
        const entries = dedupe(passthrough.concat(queue));
        queue = [];
        passthrough = [];

        let sent = 0;
        let dropped = 0;
        const log = [];

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            /* Last-moment validation. A sequence cancelled while its earlier
             * frames were in this same queue takes the rest with it. */
            if (e.intent) {
                if (e.intent.sequence && e.intent.sequence.dead) {
                    dropped++;
                    log.push({ tag: e.tag, dropped: 'sequence-cancelled' });
                    continue;
                }
                if (e.intent.cancelled) {
                    dropped++;
                    log.push({ tag: e.tag, dropped: 'cancelled' });
                    continue;
                }
            }

            if (Net.budgetRemaining() <= 0) {
                dropped++;
                log.push({ tag: e.tag, dropped: 'budget' });
                continue;
            }

            if (Transport.write(e.name, e.args)) {
                Net.countFrame();
                sent++;
                log.push({ tag: e.tag, name: e.name });
            } else {
                dropped++;
                log.push({ tag: e.tag, dropped: 'socket' });
            }
        }

        lastFlush = { sent, dropped, entries: log };
    }

    return {
        install() {
            Events.on('spawn', function () {
                lastAimSent = null;
                lastMoveSent = undefined;
                heldWeapon = GameState.weapons ? GameState.weapons[0] : null;
            });
        },

        /* Frames the game bundle produced. They are not 2yz's, so they are not
         * arbitrated -- but they still go through one queue, one dedupe and one
         * budget. */
        submitPassthrough(name, args) {
            /* Track what the human has selected so a build can restore it. */
            if (name === Defs.C2S.SELECT && args[1] !== true) heldWeapon = args[0];
            passthrough.push({ name, args, intent: null, tag: 'game:' + name });
        },

        /* Called by the runtime with the arbiter's winners. */
        run(winners) {
            for (let i = 0; i < winners.length; i++) execute(winners[i]);
            flush();
        },

        /* Emitted outside the tick loop, for the delayed release Preplace uses. */
        runDeferred(intent) {
            const bad = intent.validate();
            if (bad) {
                intent.rejectedReason = bad;
                Events.emit('intentDropped', intent, bad);
                return false;
            }
            execute(intent);
            flush();
            return true;
        },

        get heldWeapon() { return heldWeapon; },
        get lastFlush() { return lastFlush; },

        debugState() {
            return {
                sent: lastFlush.sent,
                dropped: lastFlush.dropped,
                budget: Net.budgetRemaining(),
                pps: Net.framesThisSecond(),
                held: heldWeapon
            };
        }
    };
})();


/* ---- 70-config.js ---- */
/* ===========================================================================
 * 2yz / Config
 * ---------------------------------------------------------------------------
 * One schema. The menu is generated from it and the code reads through it, so a
 * setting that exists is a setting that does something -- there is no second
 * list to drift out of sync, and a control with no reader cannot be built
 * because the control IS the reader's storage.
 *
 * tools/verify-2yz.js walks this schema and greps the module sources for a
 * matching Config.get / Config.section call. A key with no reader fails the
 * build. That is the mechanical version of "no fake settings".
 *
 * Every leaf carries: label, description, type, default, and for numbers a
 * range. Defaults are the values the analysis settled on, and where a figure
 * comes from a game table it is derived rather than typed.
 * =========================================================================== */

const Config = (function () {
    const STORAGE_KEY = '2yz.config.v1';

    /* --- schema --------------------------------------------------------- */

    const schema = {
        combat: {
            _label: 'Combat',
            _desc: 'Target selection, weapon choice and swing timing.',
            enabled: {
                label: 'Enable Combat', type: 'bool', def: true,
                desc: 'Master switch for automatic attacking. Off leaves aiming and swinging entirely to you.'
            },
            targetRadius: {
                label: 'Target Radius', type: 'number', def: 400, min: 100, max: 1000, step: 10,
                desc: 'How far out to consider enemies. Beyond this they are ignored by every module, not just Combat.'
            },
            weightDistance: {
                label: 'Priority: Proximity', type: 'number', def: 1.0, min: 0, max: 3, step: 0.1,
                desc: 'How much closeness counts when ranking targets.'
            },
            weightThreat: {
                label: 'Priority: Threat', type: 'number', def: 1.4, min: 0, max: 3, step: 0.1,
                desc: 'How much a target\'s ability to hurt you counts. Raise to prefer whoever is winding up on you.'
            },
            weightVulnerable: {
                label: 'Priority: Vulnerability', type: 'number', def: 1.2, min: 0, max: 3, step: 0.1,
                desc: 'How much being trapped, low or exposed counts. Raise to finish wounded targets.'
            },
            switchMargin: {
                label: 'Switch Margin', type: 'number', def: 0.25, min: 0, max: 1, step: 0.05,
                desc: 'A new target must score this much better before Combat drops the current one. Higher is stickier.'
            },
            switchMinTicks: {
                label: 'Switch Cooldown', type: 'number', def: 3, min: 0, max: 20, step: 1,
                desc: 'Ticks to hold a target before any switch is allowed. Stops flip-flopping between two equals.'
            },
            burstEnabled: {
                label: 'Burst Sequences', type: 'bool', def: true,
                desc: 'Chain both weapon slots across consecutive ticks when both are off cooldown.'
            },
            minBurstDamage: {
                label: 'Minimum Burst Damage', type: 'number', def: 60, min: 0, max: 200, step: 5,
                desc: 'Do not spend both cooldowns for less than this, unless the target is trapped and cannot escape.'
            },
            longReachRange: {
                label: 'Long-Reach Threshold', type: 'number', def: 115, min: 60, max: 160, step: 1,
                desc: 'A primary with more reach than this swings second in a burst, after a knockback secondary. At the default this is the katana and the polearm.'
            },
            leadTarget: {
                label: 'Lead Moving Targets', type: 'bool', def: true,
                desc: 'Aim at where the target will be when the packet lands rather than where it is now.'
            },
            urgencyBurst: {
                label: 'Urgency: Burst', type: 'number', def: 70, min: 0, max: 100, step: 1,
                desc: 'How strongly a burst competes against placement and defence for the tick.'
            },
            urgencySwing: {
                label: 'Urgency: Single Swing', type: 'number', def: 55, min: 0, max: 100, step: 1,
                desc: 'How strongly one swing competes for the tick.'
            },

            autoBreak: {
                _label: 'Auto Break',
                _desc: 'Swing at structures: escape traps, clear the line to the target, remove hazards.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Break structures automatically. Without this, Anti Smart Tick guards an escape the client never attempts.' },
                clearLine: { label: 'Clear Blocked Line', type: 'bool', def: true, desc: 'Break an enemy structure standing between you and the target.' },
                clearHazards: { label: 'Clear Hazards', type: 'bool', def: true, desc: 'Break an enemy spike close enough to hurt you where you stand.' },
                hazardMargin: {
                    label: 'Hazard Margin', type: 'number', def: 25, min: 0, max: 120, step: 5,
                    desc: 'Extra distance past contact at which an enemy spike still counts as worth removing.'
                },
                fastPrimarySpeed: {
                    label: 'Fast Primary Threshold', type: 'number', def: 400, min: 100, max: 800, step: 50,
                    desc: 'Milliseconds. A primary quicker than this is preferred over the hammer when it can break the structure in one hit, because it recovers sooner.'
                },
                urgencyEscape: { label: 'Urgency: Escape Trap', type: 'number', def: 80, min: 0, max: 100, step: 1, desc: 'Very high: nothing else matters while you cannot move.' },
                urgencyClear: { label: 'Urgency: Clear Line', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'How strongly clearing a blocked swing competes for the tick.' },
                urgencyHazard: { label: 'Urgency: Clear Hazard', type: 'number', def: 40, min: 0, max: 100, step: 1, desc: 'How strongly removing a nearby enemy spike competes for the tick.' }
            }
        },

        placement: {
            _label: 'Placement',
            _desc: 'Where structures go, and which module gets to put one there.',
            angleSteps: {
                label: 'Sweep Resolution', type: 'number', def: 72, min: 24, max: 144, step: 12,
                desc: 'Positions tested around you per sweep. Higher finds tighter gaps and costs more CPU.'
            },
            lookaheadTicks: {
                label: 'Path Lookahead', type: 'number', def: 2, min: 1, max: 6, step: 1,
                desc: 'How far ahead your own movement is projected when checking a structure would not wall you in.'
            },
            losPadding: {
                label: 'Line-of-Sight Padding', type: 'number', def: 5, min: 0, max: 30, step: 1,
                desc: 'Extra margin around a structure when testing whether it blocks your own swing.'
            },
            escapeSamples: {
                label: 'Escape Samples', type: 'number', def: 16, min: 8, max: 48, step: 4,
                desc: 'Directions sampled around a target when measuring how many exits it still has.'
            },
            escapeTicks: {
                label: 'Escape Horizon', type: 'number', def: 3, min: 1, max: 8, step: 1,
                desc: 'How far a target is assumed to be able to run when measuring its exits.'
            },
            pushbackGuard: {
                label: 'Pushback Guard', type: 'number', def: 0.6283, min: 0, max: 1.57, step: 0.05,
                desc: 'Radians. A spike whose knockback would push the target toward you within this angle is penalised.'
            },
            maxIntentAgeTicks: {
                label: 'Placement Intent Lifetime', type: 'number', def: 2, min: 1, max: 10, step: 1,
                desc: 'Ticks a queued placement stays valid before it is discarded as stale.'
            },

            weights: {
                _label: 'Scoring Weights',
                _desc: 'How the placement engine ranks one position against another. These apply to every placing module.',
                intercept: {
                    label: 'Intercepts Target', type: 'number', def: 40, min: 0, max: 100, step: 1,
                    desc: 'Reward for a position the target will actually walk into.'
                },
                proximity: {
                    label: 'Proximity', type: 'number', def: 15, min: 0, max: 100, step: 1,
                    desc: 'Reward for being close to the target, scaled so touching is full marks.'
                },
                boundary: {
                    label: 'Flush Against Structure', type: 'number', def: 12, min: 0, max: 100, step: 1,
                    desc: 'Reward for a position that sits flush against something already there, sealing the gap.'
                },
                knockbackChain: {
                    label: 'Knockback Chain', type: 'number', def: 35, min: 0, max: 100, step: 1,
                    desc: 'Reward for a spike whose hit throws the target onto another of your spikes.'
                },
                escapeClosure: {
                    label: 'Closes Escape', type: 'number', def: 30, min: 0, max: 100, step: 1,
                    desc: 'Reward proportional to how many of the target\'s exits this position removes.'
                },
                enclosure: {
                    label: 'Full Enclosure', type: 'number', def: 45, min: 0, max: 100, step: 1,
                    desc: 'Bonus for a position that takes the target\'s last exit.'
                },
                losPenalty: {
                    label: 'Blocks Your Swing', type: 'number', def: 30, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a structure that would come between you and the target.'
                },
                pathPenalty: {
                    label: 'Blocks Your Path', type: 'number', def: 20, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a structure across the direction you are moving.'
                },
                pushbackPenalty: {
                    label: 'Pushes Target At You', type: 'number', def: 25, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a spike whose knockback hands the target a free approach.'
                },
                utilityBehind: {
                    label: 'Utility Trails Behind', type: 'number', def: 20, min: 0, max: 100, step: 1,
                    desc: 'Reward for putting mills and other utility structures behind your direction of travel.'
                }
            },

            autoPlace: {
                _label: 'Auto Place',
                _desc: 'Reactive spikes and traps around a target you are already fighting.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Place spikes and traps against the current target.' },
                spikes: { label: 'Place Spikes', type: 'bool', def: true, desc: 'Allow spike placement.' },
                traps: { label: 'Place Traps', type: 'bool', def: true, desc: 'Allow trap placement when neither of you is already held.' },
                range: {
                    label: 'Range', type: 'number', def: 350, min: 50, max: 600, step: 10,
                    desc: 'Stop placing when the target is further away than this.'
                },
                minScore: {
                    label: 'Minimum Score', type: 'number', def: 25, min: 0, max: 100, step: 1,
                    desc: 'Reject any position that does not reach this score. Raise to place only when it clearly helps.'
                },
                minConfidence: {
                    label: 'Minimum Prediction Confidence', type: 'number', def: 0.35, min: 0, max: 1, step: 0.05,
                    desc: 'Skip the tick when the target\'s movement is too erratic to place against.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 50, min: 0, max: 100, step: 1, desc: 'How strongly ordinary placements compete for the tick.' },
                urgencyEnclose: { label: 'Urgency: Enclosure', type: 'number', def: 65, min: 0, max: 100, step: 1, desc: 'Raised urgency for a placement that takes the target\'s last exit.' }
            },

            preplace: {
                _label: 'Preplace',
                _desc: 'Structures built for where the target is going, released so they land on the predicted tick.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Arm placements against predicted movement.' },
                useTrap: { label: 'Prefer Trap', type: 'bool', def: true, desc: 'Lead with a trap when the target is not already held; otherwise lead with a spike.' },
                range: { label: 'Range', type: 'number', def: 300, min: 50, max: 600, step: 10, desc: 'Stop preplacing beyond this distance.' },
                horizonTicks: {
                    label: 'Prediction Horizon', type: 'number', def: 2, min: 1, max: 6, step: 1,
                    desc: 'How many ticks ahead the interception point is computed. Higher leads further and is easier to dodge.'
                },
                minConfidence: {
                    label: 'Minimum Confidence', type: 'number', def: 0.6, min: 0, max: 1, step: 0.05,
                    desc: 'The strictest confidence gate in the client. A preplace built on a bad prediction is a wasted item.'
                },
                minSpeed: {
                    label: 'Minimum Target Speed', type: 'number', def: 2, min: 0, max: 20, step: 0.5,
                    desc: 'Do not lead a target that is standing still -- Auto Place covers that case.'
                },
                minScore: { label: 'Minimum Score', type: 'number', def: 30, min: 0, max: 100, step: 1, desc: 'Reject interception points below this score.' },
                driftTolerance: {
                    label: 'Drift Tolerance', type: 'number', def: 45, min: 5, max: 200, step: 5,
                    desc: 'Cancel an armed placement once the target has strayed this far from where it was predicted to be.'
                },
                maxAgeTicks: { label: 'Armed Lifetime', type: 'number', def: 4, min: 1, max: 12, step: 1, desc: 'Ticks an armed placement survives before it is dropped unfired.' },
                releaseBias: {
                    label: 'Release Bias', type: 'number', def: 10, min: -50, max: 50, step: 1,
                    desc: 'Milliseconds to fire early. Early still lands; late does not.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 60, min: 0, max: 100, step: 1, desc: 'How strongly a preplace competes for the tick.' }
            },

            replace: {
                _label: 'Replace',
                _desc: 'Rebuild a structure into the gap left by one that is about to break.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Watch for structures about to be destroyed and fill the gap as it opens.' },
                range: { label: 'Range', type: 'number', def: 300, min: 50, max: 600, step: 10, desc: 'Only replace structures within this distance of you.' },
                relevanceRange: {
                    label: 'Relevance Range', type: 'number', def: 250, min: 50, max: 600, step: 10,
                    desc: 'A structure this far from the target is not part of the fight and is not worth replacing.'
                },
                improvementMargin: {
                    label: 'Improvement Margin', type: 'number', def: 5, min: 0, max: 50, step: 1,
                    desc: 'The replacement must score this much better than what it replaces. Stops swapping a good spike for a worse one.'
                },
                replaceOutOfCombat: { label: 'Replace Out Of Combat', type: 'bool', def: false, desc: 'Also replace structures when there is no target. Off saves resources.' },
                maxPerTick: { label: 'Max Per Tick', type: 'number', def: 1, min: 1, max: 4, step: 1, desc: 'How many replacements may be offered in one tick.' },
                graceTicks: { label: 'Prediction Grace', type: 'number', def: 3, min: 1, max: 10, step: 1, desc: 'Ticks a break prediction is kept after its expected break time.' },
                urgency: { label: 'Urgency', type: 'number', def: 58, min: 0, max: 100, step: 1, desc: 'How strongly a replacement competes for the tick.' }
            },

            spikeTick: {
                _label: 'Spike Tick',
                _desc: 'Timing only. Where the spike goes is decided by the placement engine.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Place a spike into a held target at the moment the trap can be broken.' },
                contactRange: {
                    label: 'Contact Range', type: 'number', def: 55, min: 20, max: 120, step: 5,
                    desc: 'How close the spike must land to the target to count as a contact tick rather than area denial.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 75, min: 0, max: 100, step: 1, desc: 'High by default: the window is narrow and closes when the trap breaks.' }
            }
        },

        defense: {
            _label: 'Defense',
            _desc: 'Damage projection, hat swaps and healing.',
            shameCeiling: {
                label: 'Shame Ceiling', type: 'number', def: 7, min: 0, max: 12, step: 1,
                desc: 'Stop eating once shame reaches this. Past it the food is given away for nothing.'
            },

            antiSmartTick: {
                _label: 'Anti Smart Tick',
                _desc: 'Refuse to break out of a trap on the tick the enemy is waiting for.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Detect a spike setup around your exit and hold the break.' },
                sweepSteps: {
                    label: 'Sweep Resolution', type: 'number', def: 36, min: 12, max: 72, step: 6,
                    desc: 'Positions tested around the enemy when looking for the spike they could drop on your exit.'
                },
                maxHoldTicks: {
                    label: 'Maximum Hold', type: 'number', def: 6, min: 1, max: 30, step: 1,
                    desc: 'Give up and break out after this many ticks. An unbounded wait is how a patient enemy pins you until you die.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 68, min: 0, max: 100, step: 1, desc: 'How strongly the hold competes against the placement it suppresses.' }
            },

            safeSoldier: {
                _label: 'Safe Soldier',
                _desc: 'Wear the damage-reduction hat when the projected incoming hit justifies it.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Swap to Soldier Helmet against projected incoming damage.' },
                threshold: {
                    label: 'Damage Threshold', type: 'number', def: 45, min: 0, max: 140, step: 5,
                    desc: 'Projected incoming damage needed before the hat is worth the swap.'
                },
                damageCap: {
                    label: 'Projection Cap', type: 'number', def: 140, min: 50, max: 300, step: 10,
                    desc: 'Upper bound on the projection, so a crowd cannot inflate it past what one tick can deliver.'
                },
                scanRange: { label: 'Scan Range', type: 'number', def: 400, min: 100, max: 800, step: 20, desc: 'How far out to look for sources of incoming damage.' },
                urgencyBase: { label: 'Urgency: Base', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'Urgency for a survivable projected hit.' },
                urgencyScale: { label: 'Urgency: Lethality Scale', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'Added urgency in proportion to how close the projection comes to killing you.' }
            },

            autoHeal: {
                _label: 'Auto Heal',
                _desc: 'Eat food, budgeted against the packet allowance.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Eat automatically when hurt or about to be.' },
                minMissing: { label: 'Minimum Missing Health', type: 'number', def: 20, min: 1, max: 100, step: 1, desc: 'Do not eat for less than this much missing health.' },
                calmTicks: { label: 'Calm Delay', type: 'number', def: 1, min: 0, max: 10, step: 1, desc: 'Ticks since the last hit before a routine top-up is allowed.' },
                dangerFloor: { label: 'Danger Floor', type: 'number', def: 40, min: 0, max: 100, step: 5, desc: 'Eat when the projected hit would leave you below this.' },
                maxItems: { label: 'Max Items Per Tick', type: 'number', def: 5, min: 1, max: 12, step: 1, desc: 'Upper bound on food eaten in one tick.' },
                frameReserve: {
                    label: 'Frame Reserve', type: 'number', def: 12, min: 0, max: 60, step: 2,
                    desc: 'Packets kept back for other actions. Healing never spends the whole allowance.'
                },
                urgencyLethal: { label: 'Urgency: Lethal', type: 'number', def: 95, min: 0, max: 100, step: 1, desc: 'Urgency when the projected hit would kill you.' },
                urgencyDanger: { label: 'Urgency: Danger', type: 'number', def: 62, min: 0, max: 100, step: 1, desc: 'Urgency when the projected hit would leave you below the floor.' },
                urgencyTopUp: { label: 'Urgency: Top Up', type: 'number', def: 25, min: 0, max: 100, step: 1, desc: 'Urgency for a routine heal between fights.' }
            },

            shameReset: {
                _label: 'Shame Reset',
                _desc: 'Burn down the anti-heal-spam counter during a lull by wearing the draining hat.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Wear Bull Helmet while safe so its health drain clears accumulated shame.' },
                minShame: { label: 'Minimum Shame', type: 'number', def: 3, min: 1, max: 12, step: 1, desc: 'Inferred shame level at which burning it down is worth the drain.' },
                safeRadius: { label: 'Safe Radius', type: 'number', def: 450, min: 100, max: 900, step: 25, desc: 'Refuse if any enemy is within this distance.' },
                minHealthFraction: { label: 'Minimum Health', type: 'number', def: 0.75, min: 0.2, max: 1, step: 0.05, desc: 'Fraction of full health below which the hat\'s drain is itself the risk.' },
                urgency: { label: 'Urgency', type: 'number', def: 20, min: 0, max: 100, step: 1, desc: 'Deliberately below Safe Soldier, so any real threat takes the hat slot instead.' }
            }
        },

        utility: {
            _label: 'Utility',
            _desc: 'Economy actions, which always yield to anything real.',
            autoMills: {
                _label: 'Auto Mills',
                _desc: 'Trail mills behind you while nothing else is happening.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Build mills behind you when idle and safe. Off by default -- it spends resources.' },
                perTick: { label: 'Mills Per Tick', type: 'number', def: 3, min: 1, max: 5, step: 1, desc: 'How many mills to offer in one tick.' },
                spreadFactor: {
                    label: 'Spread Factor', type: 'number', def: 1.5, min: 0.5, max: 3, step: 0.1,
                    desc: 'Multiplier on the mill\'s own scale for the angular gap between them, so they form a line rather than a pile.'
                },
                safeRadius: { label: 'Safe Radius', type: 'number', def: 500, min: 100, max: 1000, step: 20, desc: 'Stop building if any enemy is within this distance.' },
                minHealthFraction: { label: 'Minimum Health', type: 'number', def: 0.9, min: 0, max: 1, step: 0.05, desc: 'Fraction of full health below which mills are not worth the tick.' },
                resourceReserve: { label: 'Resource Reserve', type: 'number', def: 200, min: 0, max: 2000, step: 50, desc: 'Never spend a resource below this. Keeps material back for spikes and traps.' },
                frameFloor: { label: 'Frame Floor', type: 'number', def: 40, min: 0, max: 100, step: 5, desc: 'Packets that must remain in the allowance before a mill may be offered.' },
                urgency: { label: 'Urgency', type: 'number', def: 5, min: 0, max: 100, step: 1, desc: 'Lowest in the client by design: a mill never wins a contested tick.' }
            },

            autoUpgrade: {
                _label: 'Auto Upgrade',
                _desc: 'Spend age upgrade points automatically.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Take an upgrade as soon as points are offered.' },
                order: {
                    label: 'Preference Order', type: 'text',
                    def: 'katana,polearm,great hammer,pit trap,greater spikes,spikes,windmill,mine,turret,castle wall,stone wall',
                    desc: 'Comma-separated item and weapon names, best first. Names are resolved against the game\'s own tables, so a renumbering upstream cannot repoint a choice.'
                },
                takeAnything: {
                    label: 'Take Anything Offered', type: 'bool', def: true,
                    desc: 'If nothing in the preference list is on offer, take the first available rather than sitting on unspent points.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 30, min: 0, max: 100, step: 1, desc: 'How strongly an upgrade competes for the tick.' }
            },

            autoBuy: {
                _label: 'Auto Buy',
                _desc: 'Buy the hats the defensive and offensive modules want to wear.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Buy hats when affordable. Without it, Safe Soldier and the damage hat are permanent no-ops on a fresh account.' },
                wanted: {
                    label: 'Shopping List', type: 'text',
                    def: 'Soldier Helmet,Bull Helmet,Booster Hat,Tank Gear,Turret Gear',
                    desc: 'Comma-separated hat and accessory names, in buying order. Prices come from the game\'s own tables.'
                },
                pointReserve: {
                    label: 'Point Reserve', type: 'number', def: 0, min: 0, max: 20000, step: 500,
                    desc: 'Never spend below this many points.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 12, min: 0, max: 100, step: 1, desc: 'Low: a purchase never displaces a fight.' }
            },

            autoRespawn: {
                _label: 'Auto Respawn',
                _desc: 'Rejoin after death by replaying the game\'s own spawn packet.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Respawn automatically. Off by default so death stays a decision you make.' },
                delayMs: { label: 'Delay', type: 'number', def: 1200, min: 0, max: 10000, step: 100, desc: 'Milliseconds to wait after death before rejoining.' },
                urgency: { label: 'Urgency', type: 'number', def: 90, min: 0, max: 100, step: 1, desc: 'High, but it only ever competes with other intents while dead.' }
            },

            autoGather: {
                _label: 'Auto Gather',
                _desc: 'Hold the attack for farming, and release it when the swing is needed.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Toggle the game\'s auto-gather to match the situation. Off by default: it moves your hands for you.' },
                combatRadius: { label: 'Combat Radius', type: 'number', def: 400, min: 100, max: 900, step: 25, desc: 'An enemy inside this distance counts as combat for the purpose of releasing the held attack.' },
                urgency: { label: 'Urgency', type: 'number', def: 15, min: 0, max: 100, step: 1, desc: 'Low: the toggle is cheap and never urgent.' }
            }
        },

        movement: {
            _label: 'Movement',
            _desc: 'The only part of 2yz that steers for you. Off by default; your own movement passes through untouched.',
            enabled: { label: 'Enable Movement', type: 'bool', def: false, desc: 'Master switch. While off, 2yz never sends a movement packet.' },
            antiKnockback: {
                label: 'Anti Knockback', type: 'bool', def: true,
                desc: 'When an incoming hit would throw you onto a structure, lean into the push so the displacement lands short of it.'
            },
            safeWalk: {
                label: 'Safe Walk', type: 'bool', def: true,
                desc: 'Steer around enemy spikes, traps, boost pads and teleporters on the heading you are already using.'
            },
            autoPush: {
                label: 'Auto Push', type: 'bool', def: false,
                desc: 'Body-block the target toward one of your spikes, but only when the lane is clear of hazards for you.'
            },
            lookaheadDistance: {
                label: 'Lookahead Distance', type: 'number', def: 240, min: 60, max: 600, step: 20,
                desc: 'How far ahead the current heading is projected when checking for hazards.'
            },
            avoidSteps: {
                label: 'Avoidance Resolution', type: 'number', def: 6, min: 2, max: 16, step: 1,
                desc: 'How many headings either side are tried when steering around a hazard. The smallest correction that works is chosen.'
            },
            pushRange: {
                label: 'Push Range', type: 'number', def: 120, min: 40, max: 300, step: 10,
                desc: 'Stop trying to body-block beyond this distance.'
            },
            pushDistance: {
                label: 'Push Projection', type: 'number', def: 160, min: 50, max: 400, step: 10,
                desc: 'How far a shove is assumed to carry the target when checking whether it lands them on a spike.'
            },
            urgencyAntiKnockback: { label: 'Urgency: Anti Knockback', type: 'number', def: 72, min: 0, max: 100, step: 1, desc: 'How strongly the knockback correction competes for the tick.' },
            urgencySafeWalk: { label: 'Urgency: Safe Walk', type: 'number', def: 50, min: 0, max: 100, step: 1, desc: 'How strongly hazard avoidance competes for the tick.' },
            urgencyPush: { label: 'Urgency: Push', type: 'number', def: 35, min: 0, max: 100, step: 1, desc: 'How strongly body-blocking competes for the tick.' }
        },

        chat: {
            _label: 'Chat',
            _desc: 'Automatic messages, rate-limited by the game\'s own chat cooldown.',
            enabled: { label: 'Enable Chat', type: 'bool', def: false, desc: 'Master switch for automatic messages. Off by default.' },
            killChat: { label: 'Kill Messages', type: 'bool', def: true, desc: 'Say a line after a kill.' },
            killLines: {
                label: 'Kill Lines', type: 'text', def: 'gg|nice try|too easy|sit down',
                desc: 'Pipe-separated lines, used in rotation. Truncated to 30 characters, which is the game\'s own limit.'
            },
            idleChat: { label: 'Idle Messages', type: 'bool', def: false, desc: 'Say a line periodically while no enemy is nearby.' },
            idleLines: {
                label: 'Idle Lines', type: 'text', def: '2yz|.|..',
                desc: 'Pipe-separated lines, used in rotation while idle.'
            },
            idleGapMs: { label: 'Idle Gap', type: 'number', def: 20000, min: 3000, max: 120000, step: 1000, desc: 'Milliseconds between idle messages.' },
            minGapMs: {
                label: 'Minimum Gap', type: 'number', def: 900, min: 500, max: 10000, step: 100,
                desc: 'Floor on the gap between messages. The larger of this and the game\'s own chat cooldown is used, so 2yz cannot outrun the server\'s limiter.'
            },
            urgency: { label: 'Urgency', type: 'number', def: 8, min: 0, max: 100, step: 1, desc: 'Low: a message never displaces an action.' }
        },

        overlay: {
            _label: 'Overlay',
            _desc: 'Drawing. 2yz renders on its own canvas over the game, reproducing the game\'s camera; nothing it draws feeds a decision.',
            enabled: { label: 'Enable Overlay', type: 'bool', def: false, desc: 'Master switch for all drawing.' },
            showTargets: { label: 'Targets', type: 'bool', def: true, desc: 'Ring every candidate; highlight the current target and draw the line to it.' },
            showHealth: { label: 'Health Numbers', type: 'bool', def: true, desc: 'Print each candidate\'s health above them.' },
            showPrediction: { label: 'Prediction', type: 'bool', def: true, desc: 'Draw where each candidate is predicted to be.' },
            predictionTicks: { label: 'Prediction Horizon', type: 'number', def: 3, min: 1, max: 8, step: 1, desc: 'How many ticks ahead the prediction marker is drawn.' },
            showPlacement: { label: 'Placement Candidates', type: 'bool', def: true, desc: 'Draw the top-ranked spike positions the placement engine picked.' },
            placementCount: { label: 'Candidates Shown', type: 'number', def: 3, min: 1, max: 10, step: 1, desc: 'How many ranked positions to draw.' },
            showHazards: { label: 'Hazards', type: 'bool', def: true, desc: 'Ring enemy spikes and traps, and your own spikes faintly.' },
            showRanges: { label: 'Weapon Ranges', type: 'bool', def: false, desc: 'Draw your weapon reach, dimmed while on cooldown.' }
        },

        prediction: {
            _label: 'Prediction',
            _desc: 'The one movement model every module shares.',
            recalcAngle: {
                label: 'Direction-Change Threshold', type: 'number', def: 0.5, min: 0.05, max: 3.14, step: 0.05,
                desc: 'Radians. A target that turns more sharply than this in one tick invalidates anything predicted from its old heading.'
            },
            knockbackDistance: {
                label: 'Knockback Distance', type: 'number', def: 200, min: 50, max: 400, step: 10,
                desc: 'How far a hit is assumed to push a player, used for chain and escape projections.'
            },
            fitTolerance: {
                label: 'Fit Tolerance', type: 'number', def: 40, min: 5, max: 200, step: 5,
                desc: 'Units of replay error at which confidence reaches zero. Lower makes every module more cautious about acting on a prediction.'
            }
        },

        network: {
            _label: 'Network',
            _desc: 'Packet budget and the single send path.',
            packetsPerSecond: {
                label: 'Packet Budget', type: 'number', def: 110, min: 20, max: 200, step: 5,
                desc: 'Hard cap on outbound frames per second, shared by 2yz and the game\'s own traffic. The scheduler reserves against this before anything is sent.'
            },
            aimEpsilon: {
                label: 'Aim Epsilon', type: 'number', def: 0.3, min: 0, max: 1, step: 0.05,
                desc: 'Radians. Aim changes smaller than this are dropped -- the game applies the same gate, so sending them is pure waste.'
            }
        },

        debug: {
            _label: 'Debug',
            _desc: 'Diagnostics. All off by default.',
            enabled: { label: 'Enable Debug Overlay', type: 'bool', def: false, desc: 'Master switch for the on-screen panel.' },
            prediction: { label: 'Prediction', type: 'bool', def: false, desc: 'Show target velocity, predicted position, model branch and confidence.' },
            targeting: { label: 'Targeting', type: 'bool', def: false, desc: 'Show the current target, its score and the candidate count.' },
            placement: { label: 'Placement', type: 'bool', def: false, desc: 'Show the top-ranked positions and why each scored as it did.' },
            combat: { label: 'Combat', type: 'bool', def: false, desc: 'Show combat state, the active sequence and reload readiness.' },
            arbiter: { label: 'Arbitration', type: 'bool', def: false, desc: 'Show every intent submitted this tick, which won, and why the rest were rejected.' },
            packets: { label: 'Packets', type: 'bool', def: false, desc: 'Show frames sent and dropped, and the remaining budget.' },
            modules: { label: 'Modules', type: 'bool', def: false, desc: 'Show each module\'s own state.' }
        }
    };

    /* --- storage -------------------------------------------------------- */

    const values = {};

    function isLeaf(node) {
        return node && typeof node === 'object' && 'type' in node && 'def' in node;
    }

    function walk(node, path, fn) {
        for (const key in node) {
            if (key.startsWith('_')) continue;
            const child = node[key];
            const childPath = path ? path + '.' + key : key;
            if (isLeaf(child)) fn(childPath, child);
            else walk(child, childPath, fn);
        }
    }

    function nodeAt(path) {
        const parts = path.split('.');
        let node = schema;
        for (const part of parts) {
            if (!node) return null;
            node = node[part];
        }
        return node || null;
    }

    walk(schema, '', function (path, leaf) { values[path] = leaf.def; });

    function load() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
        if (!saved) return;
        for (const path in saved) {
            if (path in values) values[path] = saved[path];
        }
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (e) { /* storage disabled */ }
    }

    return {
        schema,
        load,
        save,

        get(path) {
            if (!(path in values)) {
                Log.error('config', new Error('unknown key ' + path));
                return undefined;
            }
            return values[path];
        },

        set(path, value) {
            const leaf = nodeAt(path);
            if (!leaf || !isLeaf(leaf)) return false;
            let v = value;
            if (leaf.type === 'number') {
                v = parseFloat(v);
                if (isNaN(v)) return false;
                if (leaf.min != null) v = Math.max(leaf.min, v);
                if (leaf.max != null) v = Math.min(leaf.max, v);
            } else if (leaf.type === 'bool') {
                v = !!v;
            } else if (leaf.type === 'text') {
                v = String(v);
            }
            values[path] = v;
            save();
            return true;
        },

        /* Whole sub-tree as a flat object of leaf-name -> value. Used where a
         * module wants a bag of related numbers, such as the scoring weights. */
        section(path) {
            const node = nodeAt(path);
            if (!node) return {};
            const out = {};
            for (const key in node) {
                if (key.startsWith('_')) continue;
                if (isLeaf(node[key])) out[key] = values[path + '.' + key];
            }
            return out;
        },

        reset() {
            walk(schema, '', function (p, leaf) { values[p] = leaf.def; });
            save();
        },

        /* Every leaf path, for the verifier and the menu builder. */
        keys() {
            const out = [];
            walk(schema, '', function (p) { out.push(p); });
            return out;
        },

        leafAt(path) {
            const node = nodeAt(path);
            return isLeaf(node) ? node : null;
        },

        all() { return Object.assign({}, values); }
    };
})();


/* ---- 71-ui.js ---- */
/* ===========================================================================
 * 2yz / Menu
 * ---------------------------------------------------------------------------
 * The menu is generated from Config.schema, not written out beside it. Adding a
 * setting to the schema adds the control; there is no list of controls to keep
 * in step, and a control cannot exist for a key nothing reads because the key
 * IS where the reader gets its value.
 *
 * Categories and their nesting come straight from the schema shape, so the menu
 * mirrors the architecture: Combat, Placement (Auto Place / Preplace / Replace
 * / Spike Tick / Scoring Weights), Defense (Anti Smart Tick / Safe Soldier /
 * Auto Heal), Utility, Prediction, Network, Debug.
 * =========================================================================== */

const Menu = (function () {
    let root = null;
    let visible = false;
    let activeTab = 'combat';

    const CSS = `
    #tyz-root{position:fixed;top:60px;left:20px;width:460px;max-height:78vh;z-index:2147483000;
      font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8e8ee;
      background:#14141aee;border:1px solid #33333f;border-radius:10px;
      box-shadow:0 12px 40px #0009;display:none;flex-direction:column;overflow:hidden}
    #tyz-root.tyz-open{display:flex}
    #tyz-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1c1c25;
      border-bottom:1px solid #33333f;cursor:move;user-select:none}
    #tyz-head b{font-size:14px;letter-spacing:.08em}
    #tyz-head .tyz-sub{color:#8b8b9c;font-size:11px;margin-left:auto}
    #tyz-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:8px 10px 0;background:#1c1c25}
    .tyz-tab{padding:5px 10px;border-radius:6px 6px 0 0;background:#24242f;color:#9a9aad;
      cursor:pointer;border:1px solid transparent;border-bottom:none}
    .tyz-tab.on{background:#14141a;color:#fff;border-color:#33333f}
    #tyz-body{padding:12px;overflow-y:auto;flex:1}
    .tyz-group{margin-bottom:14px;border:1px solid #2a2a34;border-radius:8px;overflow:hidden}
    .tyz-group>h4{margin:0;padding:7px 10px;background:#20202a;font-size:12px;font-weight:600;
      letter-spacing:.04em;color:#cfcfe0}
    .tyz-group>p{margin:0;padding:6px 10px;color:#7d7d90;font-size:11px;border-bottom:1px solid #2a2a34}
    .tyz-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid #22222c}
    .tyz-row:first-of-type{border-top:none}
    .tyz-label{flex:1;min-width:0}
    .tyz-label .n{display:block;color:#e8e8ee}
    .tyz-label .d{display:block;color:#75758a;font-size:10.5px;margin-top:1px}
    .tyz-ctl{flex:0 0 132px;display:flex;align-items:center;gap:6px;justify-content:flex-end}
    .tyz-ctl input[type=range]{width:92px;accent-color:#6f7dff}
    .tyz-ctl input[type=checkbox]{width:15px;height:15px;accent-color:#6f7dff}
    .tyz-ctl input.tyz-text{width:130px;background:#0e0e14;color:#e8e8ee;border:1px solid #3a3a4a;
      border-radius:5px;padding:3px 6px;font:inherit}
    .tyz-row:has(input.tyz-text){align-items:flex-start}
    .tyz-ctl:has(input.tyz-text){flex:0 0 140px}
    .tyz-val{min-width:38px;text-align:right;color:#a9a9c0;font-variant-numeric:tabular-nums}
    #tyz-foot{display:flex;gap:8px;padding:9px 12px;background:#1c1c25;border-top:1px solid #33333f}
    #tyz-foot button{background:#2a2a38;color:#d8d8e6;border:1px solid #3a3a4a;border-radius:6px;
      padding:5px 11px;cursor:pointer;font:inherit}
    #tyz-foot button:hover{background:#343446}
    #tyz-foot .tyz-hint{margin-left:auto;color:#75758a;align-self:center}
    #tyz-debug{position:fixed;top:60px;right:20px;width:390px;max-height:80vh;overflow-y:auto;
      z-index:2147482999;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfe8d8;
      background:#0e1410ee;border:1px solid #24382c;border-radius:8px;padding:10px;display:none;
      white-space:pre-wrap}
    #tyz-debug.tyz-open{display:block}
    #tyz-debug h5{margin:8px 0 3px;color:#7fd8a4;font-size:11px;letter-spacing:.06em}
    #tyz-debug h5:first-child{margin-top:0}
    `;

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        if (attrs) for (const k in attrs) {
            if (k === 'text') node.textContent = attrs[k];
            else if (k === 'html') node.innerHTML = attrs[k];
            else node.setAttribute(k, attrs[k]);
        }
        if (children) for (const c of children) if (c) node.appendChild(c);
        return node;
    }

    function isLeaf(node) {
        return node && typeof node === 'object' && 'type' in node && 'def' in node;
    }

    function buildRow(path, leaf) {
        const ctl = el('div', { class: 'tyz-ctl' });

        if (leaf.type === 'bool') {
            const input = el('input', { type: 'checkbox' });
            input.checked = !!Config.get(path);
            input.addEventListener('change', () => Config.set(path, input.checked));
            ctl.appendChild(input);
        } else if (leaf.type === 'text') {
            const input = el('input', { type: 'text', class: 'tyz-text' });
            input.value = String(Config.get(path));
            input.addEventListener('change', () => Config.set(path, input.value));
            ctl.appendChild(input);
        } else {
            const readout = el('span', { class: 'tyz-val', text: String(Config.get(path)) });
            const input = el('input', {
                type: 'range',
                min: String(leaf.min),
                max: String(leaf.max),
                step: String(leaf.step != null ? leaf.step : 1)
            });
            input.value = String(Config.get(path));
            input.addEventListener('input', function () {
                Config.set(path, input.value);
                readout.textContent = String(Config.get(path));
            });
            ctl.appendChild(input);
            ctl.appendChild(readout);
        }

        return el('div', { class: 'tyz-row' }, [
            el('div', { class: 'tyz-label' }, [
                el('span', { class: 'n', text: leaf.label }),
                el('span', { class: 'd', text: leaf.desc })
            ]),
            ctl
        ]);
    }

    /* Render one schema node. Leaves become rows; sub-objects become nested
     * groups, so the menu's shape is the schema's shape. */
    function buildGroup(node, path, label, desc) {
        const group = el('div', { class: 'tyz-group' });
        group.appendChild(el('h4', { text: label }));
        if (desc) group.appendChild(el('p', { text: desc }));

        const nested = [];
        for (const key in node) {
            if (key.startsWith('_')) continue;
            const child = node[key];
            const childPath = path ? path + '.' + key : key;
            if (isLeaf(child)) group.appendChild(buildRow(childPath, child));
            else nested.push(buildGroup(child, childPath, child._label || key, child._desc));
        }
        const wrap = el('div', null, [group].concat(nested));
        return wrap;
    }

    function renderTab(name) {
        activeTab = name;
        const body = root.querySelector('#tyz-body');
        body.innerHTML = '';
        const node = Config.schema[name];
        body.appendChild(buildGroup(node, name, node._label || name, node._desc));
        for (const tab of root.querySelectorAll('.tyz-tab')) {
            tab.classList.toggle('on', tab.dataset.tab === name);
        }
    }

    function makeDraggable(handle, panel) {
        let dragging = false;
        let ox = 0;
        let oy = 0;
        handle.addEventListener('mousedown', function (e) {
            dragging = true;
            const rect = panel.getBoundingClientRect();
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            e.preventDefault();
        });
        window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            panel.style.left = (e.clientX - ox) + 'px';
            panel.style.top = (e.clientY - oy) + 'px';
        });
        window.addEventListener('mouseup', function () { dragging = false; });
    }

    return {
        install() {
            const style = el('style', { text: CSS });
            document.head.appendChild(style);

            const head = el('div', { id: 'tyz-head' }, [
                el('b', { text: '2yz' }),
                el('span', { class: 'tyz-sub', text: 'ShiftT to toggle' })
            ]);

            const tabs = el('div', { id: 'tyz-tabs' });
            for (const name in Config.schema) {
                const node = Config.schema[name];
                const tab = el('div', { class: 'tyz-tab', text: node._label || name });
                tab.dataset.tab = name;
                tab.addEventListener('click', () => renderTab(name));
                tabs.appendChild(tab);
            }

            const foot = el('div', { id: 'tyz-foot' });
            const resetBtn = el('button', { text: 'Reset defaults' });
            resetBtn.addEventListener('click', function () {
                Config.reset();
                renderTab(activeTab);
            });
            foot.appendChild(resetBtn);
            foot.appendChild(el('span', { class: 'tyz-hint', text: 'settings save as you change them' }));

            root = el('div', { id: 'tyz-root' }, [
                head, tabs, el('div', { id: 'tyz-body' }), foot
            ]);
            document.body.appendChild(root);
            makeDraggable(head, root);
            renderTab(activeTab);

            window.addEventListener('keydown', function (e) {
                /* Never steal a key while the player is typing in chat or the
                 * name box. */
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
                    e.preventDefault();
                    Menu.toggle();
                }
            });
        },

        toggle() {
            visible = !visible;
            root.classList.toggle('tyz-open', visible);
        },

        get visible() { return visible; }
    };
})();


/* ---- 72-debug.js ---- */
/* ===========================================================================
 * 2yz / Debug
 * ---------------------------------------------------------------------------
 * Optional, off by default, and every section behind its own switch so the
 * panel can be narrowed to the thing being investigated.
 *
 * The panel reads each subsystem's own debugState(). Nothing computes a figure
 * specially for display, so what is shown is the state the client actually
 * decided on, not a re-derivation of it.
 * =========================================================================== */

const Debug = (function () {
    let panel = null;
    let lastRender = 0;

    /* Recent decisions that are invisible in a per-tick snapshot because they
     * happen between ticks or resolve immediately: a preplace arming and then
     * being thrown away, an intent dropped at the last check, a burst cancelled
     * mid-sequence. Without this the panel can only ever show the outcome, not
     * the reason. */
    const journal = new U.Ring(24);

    function record(kind, detail) {
        journal.push({ tick: GameState.tick, kind, detail });
    }

    function journalEntries() {
        const out = [];
        for (let i = 0; i < journal.size; i++) {
            const e = journal.at(i);
            if (e) out.push('t' + e.tick + ' ' + e.kind + ' ' + e.detail);
        }
        return out;
    }

    function section(title, value) {
        if (value == null) return '';
        return '<h5>' + title + '</h5>' + JSON.stringify(value, null, 1) + '\n';
    }

    function render() {
        if (!Config.get('debug.enabled')) {
            if (panel) panel.classList.remove('tyz-open');
            return;
        }
        if (!panel) return;
        panel.classList.add('tyz-open');

        /* Refresh at a readable rate rather than every tick. */
        const now = Date.now();
        if (now - lastRender < 100) return;
        lastRender = now;

        let out = '';

        out += section('world', {
            inGame: GameState.inGame,
            tick: GameState.tick,
            players: GameState.players.size,
            objects: GameState.objects.size,
            near: GameState.nearObjects.length,
            ping: Math.round(Net.pingMs())
        });

        if (Config.get('debug.targeting')) out += section('targeting', Targeting.debugState());

        if (Config.get('debug.prediction')) {
            const t = Targeting.primary;
            out += section('prediction', t ? Prediction.debugState(t) : { target: null });
        }

        if (Config.get('debug.combat')) out += section('combat', CombatEngine.debugState());

        if (Config.get('debug.placement')) out += section('placement', AutoPlace.debugState());

        if (Config.get('debug.arbiter')) {
            out += section('arbiter', Arbiter.debugState());
            out += section('journal', journalEntries());
        }

        if (Config.get('debug.packets')) out += section('packets', Scheduler.debugState());

        if (Config.get('debug.modules')) {
            out += section('preplace', Preplace.debugState());
            out += section('replace', Replace.debugState());
            out += section('spikeTick', SpikeTick.debugState());
            out += section('antiSmartTick', AntiSmartTick.debugState());
            out += section('safeSoldier', SafeSoldier.debugState());
            out += section('autoHeal', AutoHeal.debugState());
            out += section('autoMills', AutoMills.debugState());
            out += section('autoBreak', AutoBreak.debugState());
            out += section('movement', Movement.debugState());
            out += section('autoUpgrade', AutoUpgrade.debugState());
            out += section('autoBuy', AutoBuy.debugState());
            out += section('autoRespawn', AutoRespawn.debugState());
            out += section('autoGather', AutoGather.debugState());
            out += section('shameReset', ShameReset.debugState());
            out += section('autoChat', AutoChat.debugState());
            out += section('overlay', Overlay.debugState());
        }

        const errors = Log.entries();
        if (errors.length) {
            out += section('errors', errors.slice(0, 5).map((e) => ({
                scope: e.scope,
                message: e.err && e.err.message ? e.err.message : String(e.err),
                count: e.count
            })));
        }

        panel.innerHTML = out;
    }

    return {
        install() {
            panel = document.createElement('div');
            panel.id = 'tyz-debug';
            document.body.appendChild(panel);

            Events.on('preplaceArmed', (rec) => record('preplace-armed',
                rec.intent.describe() + ' @' + Math.round(U.toDeg(rec.intent.angle)) + 'deg'));
            Events.on('preplaceDisarmed', (rec, why) => record('preplace-disarmed', why));
            Events.on('preplaceReleased', (intent, ok) => record('preplace-released',
                intent.describe() + (ok ? ' sent' : ' refused:' + intent.rejectedReason)));
            Events.on('intentDropped', (intent, why) => record('intent-dropped',
                intent.describe() + ' ' + why));
            Events.on('sequenceCancelled', (seq, why) => record('sequence-cancelled',
                seq.name + ' ' + why));
            Events.on('tick', function () {
                try { render(); } catch (err) { Log.error('debug', err); }
            });
        }
    };
})();


/* ---- 73-overlay.js ---- */
/* ===========================================================================
 * 2yz / Overlay
 * ---------------------------------------------------------------------------
 * Visuals. Because 2yz does not fork the game's renderer, it cannot hook the
 * draw calls the way the reference clients do -- it draws on its own canvas
 * stacked over the game's, and has to reproduce the camera itself.
 *
 * The camera maths is the game's, from src/game_index.js:
 *
 *   scale  = max(innerWidth / maxScreenWidth, innerHeight / maxScreenHeight)
 *            and the context transform (4466-4472)
 *   camera = lerped toward the player's render position each frame with
 *            step = min(distance * 0.01 * delta, distance)   (4831-4836)
 *
 * The player's own render position is itself interpolated between the last two
 * server snapshots, so this reproduces both stages. The result tracks the game
 * closely; it is not pixel-identical, because the game's delta and ours are
 * different clocks. Anything that must be exact -- a decision, a range check --
 * is made against world coordinates, never against what this draws.
 *
 * Everything here is off by default and none of it feeds a decision. It reads
 * GameState and draws; nothing reads back.
 * =========================================================================== */

const Overlay = (function () {
    let canvas = null;
    let ctx = null;
    let raf = null;

    /* Camera state, lerped the way the game lerps it. */
    let camX = 0;
    let camY = 0;
    let lastFrame = 0;

    function viewportScale() {
        return Math.max(
            window.innerWidth / Defs.config.maxScreenWidth,
            window.innerHeight / Defs.config.maxScreenHeight
        );
    }

    /* Interpolate an entity between its last two snapshots, as the game does
     * between t1 and t2. */
    function renderPos(entity) {
        const span = entity.t2 - entity.t1;
        if (!span || span <= 0) return { x: entity.x2, y: entity.y2 };
        let t = (Date.now() - entity.t2) / span;
        t = U.clamp(t, 0, 1.4);
        return {
            x: entity.x1 + (entity.x2 - entity.x1) * (1 + t),
            y: entity.y1 + (entity.y2 - entity.y1) * (1 + t)
        };
    }

    function updateCamera(delta) {
        const me = GameState.self;
        if (!me) {
            camX = Defs.config.mapScale / 2;
            camY = Defs.config.mapScale / 2;
            return;
        }
        const p = renderPos(me);
        const dist = U.getDistance(camX, camY, p.x, p.y);
        if (dist > 0.05) {
            const dir = U.getDirection(p.x, p.y, camX, camY);
            const step = Math.min(dist * 0.01 * delta, dist);
            camX += step * Math.cos(dir);
            camY += step * Math.sin(dir);
        } else {
            camX = p.x;
            camY = p.y;
        }
    }

    /* World -> CSS pixels, matching the game's context transform. */
    function toScreen(worldX, worldY) {
        const scale = viewportScale();
        const originX = (window.innerWidth - Defs.config.maxScreenWidth * scale) / 2;
        const originY = (window.innerHeight - Defs.config.maxScreenHeight * scale) / 2;
        return {
            x: originX + (worldX - camX + Defs.config.maxScreenWidth / 2) * scale,
            y: originY + (worldY - camY + Defs.config.maxScreenHeight / 2) * scale,
            scale
        };
    }

    function circle(worldX, worldY, radius, colour, width) {
        const p = toScreen(worldX, worldY);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * p.scale, 0, U.PI2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = (width || 2) * p.scale;
        ctx.stroke();
    }

    function line(x1, y1, x2, y2, colour, width) {
        const a = toScreen(x1, y1);
        const b = toScreen(x2, y2);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = colour;
        ctx.lineWidth = (width || 2) * a.scale;
        ctx.stroke();
    }

    function label(worldX, worldY, text, colour) {
        const p = toScreen(worldX, worldY);
        ctx.font = Math.round(13 * p.scale) + 'px system-ui, sans-serif';
        ctx.fillStyle = colour;
        ctx.textAlign = 'center';
        ctx.fillText(text, p.x, p.y);
    }

    /* --------------------------------------------------------------- layers */

    function drawTargets() {
        const me = GameState.self;
        const primary = Targeting.primary;
        for (const p of Targeting.all) {
            const isPrimary = p === primary;
            const colour = isPrimary ? '#ff5470' : '#ffb454';
            circle(p.x2, p.y2, p.scale + 8, colour, isPrimary ? 3 : 2);
            if (isPrimary && me) line(me.x2, me.y2, p.x2, p.y2, 'rgba(255,84,112,0.45)', 2);
            if (Config.get('overlay.showHealth')) {
                label(p.x2, p.y2 - p.scale - 14, Math.round(p.health) + 'hp', colour);
            }
        }
    }

    function drawPrediction() {
        for (const p of Targeting.all) {
            const horizon = Config.get('overlay.predictionTicks');
            const future = Prediction.at(p, horizon);
            line(p.x2, p.y2, future.x, future.y, 'rgba(111,125,255,0.8)', 2);
            circle(future.x, future.y, p.scale, 'rgba(111,125,255,0.55)', 2);
        }
    }

    function drawPlacement() {
        const target = Targeting.primary;
        const spike = GameState.spikeItem;
        if (!target || spike == null) return;
        const ranked = PlacementEngine.bestN(spike, target, 'spike',
            Config.get('overlay.placementCount'));
        for (let i = 0; i < ranked.length; i++) {
            const c = ranked[i];
            const alpha = 0.85 - i * 0.2;
            circle(c.x, c.y, c.scale, 'rgba(127,216,164,' + Math.max(0.2, alpha) + ')', i === 0 ? 3 : 2);
        }
    }

    function drawHazards() {
        for (const obj of GameState.enemyObjects) {
            if (!obj.active) continue;
            if (obj.damage > 0) circle(obj.x, obj.y, obj.scale, 'rgba(255,84,112,0.55)', 2);
            else if (obj.trap) circle(obj.x, obj.y, obj.scale, 'rgba(255,180,84,0.55)', 2);
        }
        for (const obj of GameState.myObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            circle(obj.x, obj.y, obj.scale, 'rgba(127,216,164,0.35)', 1);
        }
    }

    function drawRanges() {
        const me = GameState.self;
        if (!me) return;
        for (let slot = 0; slot < 2; slot++) {
            const idx = GameState.weapons[slot];
            if (idx == null) continue;
            const w = Defs.weapons[idx];
            if (!w || w.range == null) continue;
            const ready = slot === 0
                ? EntityTracker.primaryReady(me.sid)
                : EntityTracker.secondaryReady(me.sid);
            circle(me.x2, me.y2, w.range + me.scale,
                ready ? 'rgba(127,216,164,0.5)' : 'rgba(120,120,140,0.35)', 2);
        }
    }

    function frame() {
        raf = window.requestAnimationFrame(frame);
        if (!Config.get('overlay.enabled')) {
            if (canvas.style.display !== 'none') canvas.style.display = 'none';
            return;
        }
        if (canvas.style.display === 'none') canvas.style.display = 'block';

        const now = Date.now();
        const delta = lastFrame ? now - lastFrame : 16;
        lastFrame = now;

        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!GameState.inGame || !GameState.self) return;
        updateCamera(delta);

        try {
            if (Config.get('overlay.showHazards')) drawHazards();
            if (Config.get('overlay.showRanges')) drawRanges();
            if (Config.get('overlay.showPlacement')) drawPlacement();
            if (Config.get('overlay.showPrediction')) drawPrediction();
            if (Config.get('overlay.showTargets')) drawTargets();
        } catch (err) {
            Log.error('overlay', err);
        }
    }

    return {
        install() {
            canvas = document.createElement('canvas');
            canvas.id = 'tyz-overlay';
            canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;'
                + 'z-index:2147482000;display:none';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
            raf = window.requestAnimationFrame(frame);
        },

        debugState() {
            return {
                enabled: Config.get('overlay.enabled'),
                camera: { x: Math.round(camX), y: Math.round(camY) },
                scale: Math.round(viewportScale() * 100) / 100
            };
        }
    };
})();


/* ---- 80-runtime.js ---- */
/* ===========================================================================
 * 2yz / Runtime
 * ---------------------------------------------------------------------------
 * Wiring and the tick loop. The order below is the architecture:
 *
 *   wire        -> world model rebuilt from the frame
 *   track       -> derived state: velocity, reloads, contacts
 *   predict     -> one movement model, scored for confidence
 *   target      -> one target, shared by everything
 *   propose     -> each module offers intents; none of them acts
 *   arbitrate   -> one decision per tick
 *   schedule    -> one writer to the socket
 *
 * The first four are driven by Events ('tick' -> 'trackerReady'), because they
 * must run in that order and nothing downstream is meaningful until they have.
 * The last three run here, once, at the end of the tick.
 * =========================================================================== */

const Runtime = (function () {
    /* Every module that can produce an intent, in no particular order -- the
     * Arbiter ranks them, so this list carries no priority meaning. */
    const producers = [
        AutoPlace,
        Preplace,
        Replace,
        SpikeTick,
        AutoBreak,
        AntiSmartTick,
        SafeSoldier,
        ShameReset,
        AutoHeal,
        Movement,
        AutoGather,
        AutoMills,
        AutoUpgrade,
        AutoBuy,
        AutoRespawn,
        AutoChat
    ];

    function collect() {
        const intents = [];

        /* Combat first only so its sequence state is advanced before the
         * placement modules read CombatEngine.activeSequence. */
        try {
            const attack = CombatEngine.decide();
            if (attack) intents.push(attack);
        } catch (err) {
            Log.error('Combat.decide', err);
        }

        for (let i = 0; i < producers.length; i++) {
            const module = producers[i];
            try {
                const produced = module.tick();
                if (!produced) continue;
                if (Array.isArray(produced)) {
                    for (let j = 0; j < produced.length; j++) intents.push(produced[j]);
                } else {
                    intents.push(produced);
                }
            } catch (err) {
                Log.error(module.name + '.tick', err);
            }
        }
        return intents;
    }

    function onTick() {
        if (!GameState.inGame || !GameState.self) {
            /* Dead or not yet spawned. Only the modules that are meaningful in
             * that state get a turn -- respawn being the whole point of it. */
            let revive = [];
            try {
                const wake = AutoRespawn.tick();
                if (wake) revive = Arbiter.resolve([wake]);
            } catch (err) {
                Log.error('AutoRespawn.tick', err);
            }
            Scheduler.run(revive);
            return;
        }

        const intents = collect();
        let winners = [];
        try {
            winners = Arbiter.resolve(intents);
        } catch (err) {
            Log.error('Arbiter.resolve', err);
        }

        /* A sequence step only advances once its packets are actually queued,
         * so a step dropped for budget is retried rather than skipped. */
        for (let i = 0; i < winners.length; i++) {
            const intent = winners[i];
            if (intent.kind === 'Attack' && intent.sequence) intent.sequence.advance();
        }

        Scheduler.run(winners);
    }

    return {
        start() {
            Config.load();

            /* Transport must be hooked before the game opens its socket, which
             * is why the whole script runs at document-start. */
            Transport.install();
            Net.install();
            Router.install();
            EntityTracker.install();
            Prediction.install();
            Targeting.install();
            CombatEngine.install();
            Scheduler.install();
            Preplace.install();
            Replace.install();
            AutoRespawn.install();
            ShameReset.install();
            AutoChat.install();

            /* The decision pass runs after tracking, prediction and targeting
             * have all had the tick. */
            Events.on('trackerReady', function () {
                try { onTick(); } catch (err) { Log.error('runtime.tick', err); }
            });

            const startUI = function () {
                try {
                    Menu.install();
                    Debug.install();
                    Overlay.install();
                } catch (err) {
                    Log.error('ui', err);
                }
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startUI);
            } else {
                startUI();
            }

            Log.info('runtime', 'started, ' + Config.keys().length + ' settings');
        }
    };
})();


Runtime.start();

})();
