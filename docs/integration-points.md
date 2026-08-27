# Step 1 — exact integration points

Line numbers refer to `src/novastorm_1.4.js`, the pristine baseline. Edits land
in `NovaStorm.user.js`. The two are byte-identical at commit `a7b788e`, so the
audit at step 9 is `diff src/novastorm_1.4.js NovaStorm.user.js`.

---

## 0. Output target — proceeding under a stated assumption

I asked three times where the code should go and the phases kept advancing, so I
have made the call rather than block again:

- `src/novastorm_1.4.js` — the unmodified upload, never edited, matching how
  `src/RYN_Client_v4.js` and `src/Luna_Client_1.1.js` are treated.
- `NovaStorm.user.js` — the working script at repo root, matching
  `ReUp_Mix.user.js`.

No build machinery. The userscript is edited directly, which is what "keep
modifications localized" implies and what makes the diff the audit.

**This is reversible.** If you want these changes ported onto ReUp Mix's
`AutoPlacer` (`_preplacer` / `_replacer`) instead, every design document
transfers unchanged — only the anchors below change. Say so before step 2 and
nothing is wasted.

---

## 1. Sites modified in place

### P1 — enemy movement model
**`src/novastorm_1.4.js:14002-14017`**, inside `updatePlayers`' parse loop.

```js
const lastX = tmpObj.x2, lastY = tmpObj.y2;
...
tmpObj.xVel = tmpObj.x2 * 2 - lastX;
tmpObj.yVel = tmpObj.y2 * 2 - lastY;
```

`lastX`/`lastY` are already in scope. Appended after the existing `xVel`/`yVel`
assignment: per-tick displacement, `Math.hypot` speed, `movDir`/`pmovDir`,
stability counter, two prediction hypotheses, error EMA, confidence.

Existing lines are not altered — `xVel`/`yVel` keep their current meaning and
every current reader is unaffected. Invariant I9: one predictor, extended in
place.

### P2 — intent metadata
**`12825-12832`**, `addPredictObject`.

```js
function addPredictObject(id, angle, preplace) {
    let config = getConfig(id, angle);
    for (let object of predictObjects) {
        if (object.id != 17 && UTILS.getDistance(...) < (config.scale + object.scale)) return;
    }
    predictObjects.push({ id: id, angle: angle, name: ..., x: ..., y: ..., scale: ..., preplace: preplace });
}
```

Optional fourth parameter `meta`, spread into the pushed record. **All ten call
sites pass exactly three arguments** (verified), so Auto Place, Auto Mills, the
manual keys and grind are behaviourally untouched. The dedup loop is not
modified.

### P3 — item limit
**`12834-12841`**, `isItemLimit`.

```js
let limit = (group.sandboxLimit || 99);
if (myPlayer.itemCounts[group.id] >= limit) {
```

Restore Luna's correct expression (`Luna_Fixed.user.js:11296`) using
`UTILS.isSandbox` (16807), **not** `config.inSandbox` (16806, which reads
`process.env.VULTR_SCHEME` and is undefined in a browser).

**Pending your decision:** global fix (recommended — it is a regression against
NovaStorm's own base and affects Auto Place through `canPlace`), or shadowed into
a Preplace/Replace-local helper to keep Auto Place bit-identical. Default if you
don't answer: global, with the Auto Place delta reported at step 3.

### P4 — Preplace branch
**`13342-13509`**, the body of

```js
if (window.vars.prePlace && nearestEnemy && UTILS.getDistance(...) < 300 && !(nearestTrap && spikeDmgCount > 0)) {
    let findObject = getPrePlaceObject();
    smartTickSpike = null;
```

Wholly replaced by the gate chain from `preplace-design.md` §6. `getPrePlaceObject`
is *not* deleted here — it moves to Replace at step 5, so between steps 2 and 5
it is unreferenced. That gap is intentional and closes at step 5.

`smartTickSpike` (1473) starts receiving a meaningful value; nothing reads it
(`spiketick-compatibility.md` §6).

### P5 — timer block
**`15454-15489`**, the three `setTimeout` registrations.

- 1 ms warm-up (15455-15463): **deleted**. Its two `getPrePlaceAngles` calls are
  wrong-arity dead code; only the `io.send("D", …)` had an effect.
- commit at `111 - tickPing()` (15465-15474): snapshot the batch at registration;
  call `revalidate(intent)` before `place()`; send nothing on failure (SV7).
- replace at `111 - minPingTime` (15476-15489): `minPingTime` dropped as a timing
  base; becomes Replace's conditional retry at step 5.

No new timer, no `clearTimeout` (I10).

### P6 — ban keying
**`12902-12907`**, inside `updateAngles`.

```js
for (let placedAngle of placedAngles) {
    const matchingAngle = angles.find(a => Math.abs(a.angle - placedAngle) < 0.01);
    if (matchingAngle && matchingAngle.placeable) bannedAngles.set(placedAngle, tick + 18);
}
```

`updateAngles` is frozen by the Auto Place contract (AC1), so this block is **not
edited**. Instead Preplace/Replace maintain their own position-keyed entries in
the same `bannedAngles` map and read them locally. Auto Place's angle-keyed
behaviour is unchanged; the map simply also carries position keys that only the
new systems consult.

*Open risk:* two key shapes in one map. If that reads as too clever at
implementation time, the fallback is a second small map — a data structure, not a
second mechanism. I will flag it at step 2 if it happens.

---

## 2. Sites read, never written

| what | where |
|---|---|
| Auto Place ownership oracle | `isAutoPlaceAngle` (13185) + selectors (12933-13045) |
| Spike Tick state | `instaKill`, `insta.*` (14855-14949) |
| world snapshot | `visibleObjects` (14122), `spikes_our`/`traps_our` (14126-14127) |
| enemy set | `enemiesNear` (14084) |
| loss evidence | `removedObjects` (10577), before the 13333 clear |
| landing evidence | `spawnedObjectSids` (11979) |
| collision / geometry | `canPlace` (12790), `getConfig` (12782), `checkItemLocation` (18557) |
| ownership | `isObjectOur` (12870) |
| angle distance | `UTILS.getAngleDist` (20325) |
| packet budget | `packets` (1522) |

---

## 3. Added

| item | placement |
|---|---|
| tick context builder | beside `getPredictObjects` |
| `revalidate(intent)` | beside `place` (12737) |
| `usefulness()` — shared scorer | beside `isPrePlaceAngle` |
| escape-route analysis | port of `src/RYN_Client_v4.js:11935`, ~30 lines |

---

## 4. Deleted — step 8 only, after confirmation

Nothing is removed until steps 2-7 prove it unreferenced. Each has been verified
unread in the baseline; each will be re-verified before deletion.

| target | lines | evidence |
|---|---|---|
| `placeTick` | 12207, 13329, 13566 | written 3×, read 0× |
| `setPlaceTick()` | 13562-13569 | only writes `placeTick` |
| `updateAngles2` | 12912-12921 | never called |
| wrong-arity sweeps | 15459-15460 | `objects.length` undefined; result discarded |
| Spike Tick predicate calls in `isPrePlaceAngle` | 13149, 13152, 13168 | I1 |
| unconditional `if (isTrap) return true;` | 13178 | I3 |
| `settings.spampreplace` | 1504 | never read |
| `settings.autoPlace` | 1505 | never read |
| `prePlaceInterval` | 12296 | declared only |
| `prePlaceObjects` (outer) | 12209 | declared only |

`window.vars.placeRange` (20597) is **not** deleted — it is Auto Place's dead
slider, out of scope.

---

## 5. Never touched

`updateAngles` · `checkPredictObjects` · `isAutoPlaceAngle` · Auto Place branch
(13511-13515) · immediate commit loop (15419-15426) · `canTrapTick` ·
`canSmartTick` · `canShamePlace` · `canShamePlus` · `advancedShameCombat` ·
`canAutoShame` · `instaKill` ladder + executor (14855-14949) · `hatFc` ·
Auto Mills (13520-13541) · manual place keys (13543-13554) · turret grind ·
`place()` · `checkItemLocation` · `io.send` · the packet layer · `heal()`

---

## 6. Verification gates in the order you specified

| step | gate |
|---|---|
| 2 — Preplace | `node --check`; I1-I14; PF1-PF3 |
| 3 — Auto Place | AC1-AC6, especially **AC3**: Auto Place's emitted angle set may grow, never shrink |
| 4 — Spike Tick | ST1-ST7, especially **ST3**: the `instaKill` token sequence is unchanged |
| 5 — Replace | I1-I14; SV1-SV7 |
| 6 — Auto Place | AC1-AC6 re-run |
| 7 — Spike Tick | ST1-ST7 re-run |
| 8 — deletions | re-confirm each target unreferenced |
| 9 — audit | IN1-IN8, PF1-PF7; **IN8**: with both systems disabled, the emitted packet sequence matches the baseline |

Steps 3/4 and 6/7 are static checks — grep and diff against
`src/novastorm_1.4.js` — not live play. Live behaviour needs you at a keyboard;
I will say plainly what I have and have not verified.

---

## 7. Two answers that change the work

Neither blocks step 2; both are cheaper to answer now than to retrofit.

1. **`isItemLimit`** (P3) — global or shadowed? Default: global.
2. **Spike Tick imminence** — active-only, cheap-prefix predicate (recommended),
   or one additive line in the Spike Tick block? Default: cheap-prefix, since it
   needs no permission to touch frozen code.

Ready for step 2 on your word.
