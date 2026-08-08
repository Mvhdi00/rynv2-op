/*
 * x18k 7.4 name maps.
 *
 * x18k forked a much later bundle than Ae86 did: its inbound handler table is
 * already keyed by the current 36 names, and 13 of its 16 outbound names are
 * current too. Only three drifted, and the script already rewrites those
 * inline before encoding ("PacketFix"). They are repeated here so the
 * translation holds even on the paths that skip those inline rewrites, and
 * because mapping a name that is already correct is a no-op.
 *
 * What x18k was missing is the transport itself, not the vocabulary.
 *
 * Requires src/moomoo-transport.js.
 */
(function (root) {
  'use strict';

  // x18k outbound name -> shipped bundle name. Everything else passes through.
  var C2S_MAP = {
    'd': 'F',   // attack state
    'a': '9',   // aim / turn
    'G': 'z'    // select item / weapon
  };

  // Inbound names already match the shipped bundle, so nothing to translate.
  var S2C_MAP = {};

  root.X18kProto = root.MooTransport.create({ c2s: C2S_MAP, s2c: S2C_MAP });
})(typeof window !== 'undefined' ? window : globalThis);
