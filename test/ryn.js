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

console.log('\n5. the code behind them is gone, not merely unreachable');

// Removing the switch and the setting makes a feature inert, because every
// `if (!Settings_default._x) return` guard then reads undefined. That is not
// the same as removing it: the bodies were still in the file. These check the
// bodies are actually gone.
{
  const left = [];
  src.split('\n').forEach((l, i) => {
    for (const id of Object.keys(REMOVED)) {
      let p = -1;
      while ((p = l.indexOf(id, p + 1)) >= 0) {
        const after = l[p + id.length];
        if (after && /[A-Za-z0-9]/.test(after)) continue;
        left.push((i + 1) + ': ' + l.trim().slice(0, 70));
        break;
      }
    }
  });
  check(left.length === 0,
        'not one mention of any removed setting survives anywhere in the file' +
        (left.length ? ' -- found ' + left.length + ', e.g. ' + left[0] : ''));
}

// classes that existed for nothing but a removed feature
for (const cls of ['AutoGatherBreak', 'TrapRebuild', 'LunaSafeWalk', 'AutoRetrap',
                   'AutoHitToShame', 'LunaPathfinder']) {
  check(original.includes('class ' + cls) && !src.includes('class ' + cls + ' '),
        'class ' + cls + ' is gone');
  check(!src.includes(cls + '_default = ' + cls),
        '  and so is its _default alias, which sits packed several to a line');
  check(!new RegExp('new ' + cls + '(_default)?\\(').test(src),
        '  and nothing constructs it any more');
}

// members of classes that do other things as well
for (const [member, feature] of [['_lunaPathBreak', 'Path Break'],
                                 ['_glotusPlace', 'Glotus Placer Mode'],
                                 ['canShamePlace', 'Shame Grind'],
                                 ['canAutoShame', 'Auto Hit to Shame']]) {
  check(original.includes(member) && !src.includes(member),
        feature + ": its member (" + member + ") is gone, and nothing calls it");
}

// the tick lists must not name a module that no longer exists
{
  const bad = [];
  for (const m of src.matchAll(/^\s*this\.(?:modules|botModules) = \[([^\]]*)\];/gm)) {
    for (const e of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
      if (!/^this\.staticModules\.[A-Za-z_$][\w$]*$/.test(e)) bad.push(e.slice(0, 60));
    }
  }
  check(bad.length === 0,
        'every entry left in the tick lists is a well-formed module reference' +
        (bad.length ? ' -- found ' + bad.join(' | ') : ''));
  for (const key of ['autoGatherBreak', 'trapRebuild', 'lunaSafeWalk', 'autoRetrap',
                     'autoHitToShame', 'lunaPathfinder']) {
    check(!src.includes('staticModules.' + key), 'and none of them is ' + key);
  }
}

check(!/if \(Settings_default\._lunaMode\) return;/.test(src),
      'the eight luna-mode early returns are gone');
check(/if \(ModuleHandler\.moduleActive && !myPlayer\.isTrapped\) \{/.test(src),
      'and the one condition that had a live arm kept it, minus the removed half');
check(/if \(ModuleHandler\.shouldAttack\) \{/.test(src),
      'as did the attack condition Auto Gather was one half of');

console.log('\n6. the rest of the client is untouched');
for (const keep of ['_autoplacer', '_normalInstakill', '_velocityTick', '_legitMode', '_autoGrind', '_antiRetrap']) {
  check(src.includes('\\"' + keep + '\\"') || new RegExp('^\\s*' + keep + ':\\s', 'm').test(src),
        keep + ' is still there');
}
{
  const o = original.split('\n').length, n = src.split('\n').length;
  check(n < o && (o - n) > 800 && (o - n) < 3000,
        'and it is the same client with the features cut out, not a rewrite (' +
        o + ' -> ' + n + ' lines, ' +
        Math.round((original.length - src.length) / 1024) + 'KB removed)');
}

console.log('\n' + (fails === 0 ? '=> ALL RYN TESTS PASSED' : '=> ' + fails + ' FAILURE(S)'));
process.exit(fails ? 1 : 0);
