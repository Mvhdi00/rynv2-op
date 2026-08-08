/*
 * Ae86 v10.2 name maps.
 *
 * Ae86 is a fork of the pre-permutation bundle, so every packet name it uses
 * differs from the shipped one. Both maps were recovered by comparing handler
 * bodies between the two bundles one at a time — the correspondence turned out
 * to be positional, but that was checked rather than assumed.
 *
 * Requires src/moomoo-transport.js.
 */
(function (root) {
  'use strict';

  // Ae86 (old bundle) outbound name -> shipped bundle name.
  var C2S_MAP = {
    'sp': 'M',    // spawn
    '2': 'D',     // move direction
    '33': '9',    // aim / turn
    'rmd': 'e',   // reset move dir
    'c': 'F',     // attack state
    '5': 'z',     // select item / weapon
    '6': 'H',     // buy upgrade
    '7': 'K',     // lock dir (0) / auto attack (1)
    '8': 'L',     // create alliance
    '9': 'N',     // leave alliance
    '10': 'b',    // kick from alliance
    '11': 'P',    // respond to alliance request
    '12': 'Q',    // send alliance request
    '13c': 'c',   // store equip/buy (skin 0 / tail 1)
    'ch': '6',    // chat
    '14': 'S',    // ping / map marker
    'pp': '0'     // latency probe
  };

  // Shipped bundle inbound name -> Ae86 (old bundle) name.
  var S2C_MAP = {
    'A': 'id',    // init teams
    'B': 'd',     // disconnect
    'C': '1',     // setup game
    'D': '2',     // add player
    'E': '4',     // remove player
    'a': '33',    // update players
    'G': '5',     // update leaderboard
    'H': '6',     // load game objects
    'I': 'a',     // update AI
    'J': 'aa',    // animate AI
    'K': '7',     // gather animation
    'L': '8',     // wiggle object
    'M': 'sp',    // shoot turret / set dir
    'N': '9',     // update player value
    'O': 'h',     // update health
    'P': '11',    // kill player
    'Q': '12',    // kill object (disable by sid)
    'R': '13',    // kill all objects by owner
    'S': '14',    // update item counts
    'T': '15',    // update XP / age
    'U': '16',    // update upgrades
    'V': '17',    // update items / weapons
    'X': '18',    // add projectile
    'Y': '19',    // remaining projectile range
    'Z': '20',    // server shutdown notice
    'g': 'ac',    // add alliance
    '1': 'ad',    // delete alliance
    '2': 'an',    // alliance notification
    '3': 'st',    // set player team
    '4': 'sa',    // set alliance players
    '5': 'us',    // update store items
    '6': 'ch',    // chat message
    '7': 'mm',    // minimap
    '8': 't',     // show text
    '9': 'p',     // ping map
    '0': 'pp'     // latency reply
  };

  root.Ae86Proto = root.MooTransport.create({ c2s: C2S_MAP, s2c: S2C_MAP });
})(typeof window !== 'undefined' ? window : globalThis);
