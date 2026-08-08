/*
 * Guard the load-time fixes in both builds.
 *
 * These are the failures that never reach the network layer: a stale server
 * endpoint, a global the current page no longer defines, a captcha widget that
 * is not there. Each one aborts startup, so the packet work behind it never
 * gets a chance to run. They are easy to reintroduce when re-patching, so they
 * are asserted here rather than left to a manual read.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ae86 = fs.readFileSync(path.join(ROOT, 'Ae86_v10_2_Fixed.user.js'), 'utf8');
const x18k = fs.readFileSync(path.join(ROOT, 'x18k_7_4_Fixed.user.js'), 'utf8');
const game = fs.readFileSync(path.join(ROOT, 'src/game_index.js'), 'utf8');

const ENDPOINT = (/\/servers\?v=([0-9.]+)/.exec(game) || [])[1];

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

console.log(`shipped server endpoint: /servers?v=${ENDPOINT}`);

console.log('\nAe86');
check('no relative /serverData fetch', !ae86.includes('"/serverData"'));
check(`fetches /servers?v=${ENDPOINT}`, ae86.includes(`/servers?v=${ENDPOINT}`));
check('inline-list global is guarded',
  !/(?<!typeof )\bvultr\.servers\b/.test(ae86.replace(/typeof vultr !== "undefined" && vultr && this\.processServers\(vultr\.servers\)/, '')) ||
  ae86.includes('typeof vultr !== "undefined"'));
check('no unguarded processServers(vultr.servers)',
  !/(?<!&& )this\.processServers\(vultr\.servers\)/.test(ae86));

console.log('\nx18k');
check('no stale /servers?v=1.26', !x18k.includes('servers?v=1.26'));
check(`fetches /servers?v=${ENDPOINT}`, x18k.includes(`/servers?v=${ENDPOINT}`));
check('dead rawgit @require removed', !x18k.includes('rawgit.com'));
check('no load-time read of the msgpack global', !/\bKe = msgpack\b/.test(x18k));
check('captcha gate releases the button when altcha is absent',
  x18k.includes('btn.classList.remove("disabled")'));
check('altcha checkbox is not dereferenced unguarded',
  !/getElementById\("altcha_checkbox"\)\.click\(\)/.test(x18k));
check('promo element removal is guarded',
  !/document\.getElementById\("promoImgHolder"\)\.remove\(\)/.test(x18k));

console.log('');
if (failures) { console.log(`${failures} check(s) FAILED`); process.exit(1); }
console.log('Bootstrap checks passed.');
