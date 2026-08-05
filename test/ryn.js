// RYN Client v5 v4, with a set of features removed at the request of whoever
// is building on top of it. A removal is only real if the switch is gone, the
// setting is gone, and nothing can reach the code any more -- so all three are
// checked, against the original as the control.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'RYN-Client.v5v4.js'), 'utf8');
const original = fs.readFileSync(path.join(ROOT, 'reference', 'ryn-original.js'), 'utf8');

let fails = 0;
const check = (cond, label) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label);
  if (!cond) fails++;
};

const REMOVED = {
  '_autoGather': 'Auto Gather',
  '_shameGrind': 'Shame Grind',
  '_shameTick': 'Shame Tick',
  '_autoShame': 'Auto Hit to Shame',
  '_autoShameLimit': 'Max Shame',
  '_lunaSafeWalk': 'SafeWalk',
  '_lunaPathfinder': 'Pathfinder',
  '_pathBreak': 'Path Break',
  '_lunaMode': 'Luna Mode',
  '_lockTrappedEnemy': 'Lock Trapped Enemy',
  '_autoRetrap': 'Auto Retrap',
  '_placerRetrapCombo': 'Retrap',
  '_trapRebuild': 'Trap Rebuild',
  '_glotusPlacer': 'Glotus Placer Mode',
  '_preplacer': 'Pre Placer',
  '_replacer': 'Re Placer',
  '_lunaExactPlacer': 'Exact Placer',
};

console.log('\n1. the install beacon');
check(/webhook\.site/.test(original), 'the original fired a one-shot fetch at a webhook.site collector');
check(!/webhook\.site/.test(src), 'which is gone');
check(!/_ryn_sent/.test(src), 'along with the localStorage flag that made it fire once per browser');

console.log('\n2. every switch is out of the menu');
for (const [id, label] of Object.entries(REMOVED)) {
  const inOriginal = original.includes('\\"' + id + '\\"');
  const inBuild = src.includes('\\"' + id + '\\"');
  check(inOriginal && !inBuild, `${label} (${id})`);
}

console.log('\n3. every setting is out of Settings_default');
for (const [id, label] of Object.entries(REMOVED)) {
  const re = new RegExp('^\\s*' + id + ':\\s', 'm');
  check(re.test(original) && !re.test(src), `${label} has no stored default`);
}

console.log('\n4. nothing can switch them back on');
check(!/settings\._lunaMode = false/.test(src) &&
      !/settings\._lunaExactPlacer = false/.test(src) &&
      !/settings\._lockTrappedEnemy = false/.test(src),
      'the parity reset no longer writes to the removed keys');
check(!/Settings_default\._preplacer = checked/.test(src) &&
      !/Settings_default\._replacer = checked/.test(src) &&
      !/Settings_default\._autoRetrap = checked/.test(src),
      'and the Retrap combo case no longer assigns them');
check(/"_legitMode", "_hideHUD"/.test(src),
      'the legit-mode exclusion list has dropped the removed entries');

console.log('\n5. the dead code behind them');
{
  // Every surviving mention must be an entry guard that returns before doing
  // anything -- never a live read that could still steer behaviour.
  const live = [];
  src.split('\n').forEach((l, i) => {
    for (const id of Object.keys(REMOVED)) {
      let p = -1;
      while ((p = l.indexOf(id, p + 1)) >= 0) {
        const after = l[p + id.length];
        if (after && /[A-Za-z0-9]/.test(after)) continue;
        const t = l.trim();
        const isGuard = /^if \(!Settings_default\.|^if \(\(enemy\.shameCount|^if \(MH\.moduleActive \|\| !Settings_default\.|^if \(ModuleHandler\.shouldAttack && !\(|^\/\/|^case "__removed_/.test(t);
        if (!isGuard) live.push((i + 1) + ': ' + t.slice(0, 70));
        break;
      }
    }
  });
  check(live.length === 0,
        'no surviving mention is anything but an inert entry guard' +
        (live.length ? ' -- found ' + live.join(' | ') : ''));
}
check(!/if \(Settings_default\._lunaMode\) return;/.test(src),
      'the eight luna-mode early returns are gone');
check(!/if \(Settings_default\._(lunaPathfinder|glotusPlacer|replacer|lockTrappedEnemy|preplacer)\b/.test(src),
      'so are the blocks that could no longer be entered');
check(/if \(ModuleHandler\.moduleActive && !myPlayer\.isTrapped\) \{/.test(src),
      'and the one condition that had a live arm kept it, minus the removed half');

console.log('\n6. the rest of the client is untouched');
for (const keep of ['_autoplacer', '_normalInstakill', '_velocityTick', '_legitMode', '_autoGrind', '_antiRetrap']) {
  check(src.includes('\\"' + keep + '\\"') || new RegExp('^\\s*' + keep + ':\\s', 'm').test(src),
        keep + ' is still there');
}
check(Math.abs(src.split('\n').length - original.split('\n').length) < 400,
      'and the file is the same client, not a rewrite (' +
      original.split('\n').length + ' -> ' + src.split('\n').length + ' lines)');

console.log('\n' + (fails === 0 ? '=> ALL RYN TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
