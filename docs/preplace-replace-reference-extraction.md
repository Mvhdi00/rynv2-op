# Reference extraction — Whiteout (Preplace) and Luna (Replace)

Companion to `novastorm-preplace-replace-analysis.md`.

Rule applied throughout: nothing is listed as reference behaviour unless it was
located and read in the supplied files. Where a mechanism exists but is **dead**
in the reference, it is labelled dead. Where a mechanism is **absent**, that is
stated rather than filled in from elsewhere.

Line numbers: `Whiteout_v4.js`, `Luna_Fixed.user.js`, `novastorm_1.4_ryn.user.js`
as supplied.

---

## Part 1 — Whiteout v4 as the Preplace reference

### 1.0 What is live and what is not

Whiteout contains two complete preplacer implementations. Only one runs.

| Symbol | Line | Status |
|---|---|---|
| `objDmgPot` → `assumeBreak` → `checkItemLocation3` → `gradeAngles` → `checkPlacement` | 14736 / 6102 / 12345 / 12569 | **live** |
| `traps.preplacer(findObj)` | 9844 | **dead** — only caller is inside the block commented out at 16501 (`//traps.preplacer(FANEYEATASALAD) rip old preplacer`) |
| `traps.replacer(findObj)` | 9619 | **dead** — no caller anywhere in the file |
| `preplace()` / `checkPreplace()` / `preplaceTimeout` / `aboutToBreak` | 8322 / 8378 / 5056 | belong to the dead path above |

The dead functions are still readable and coherent, and §1.7 pulls two ideas
out of them — but they are not "how Whiteout preplaces", and I am not presenting
them as such.

### 1.1 Multi-object break-aware legality — `checkItemLocation3` (6102)

The single most transferable mechanism.

```js
this.checkItemLocation3 = function(e, n, I, r, S, a, outplace, obj) {
    for (var h = 0; h < liztobj.length; ++h) {
        const asd = liztobj[h];
        var u = asd.blocker ? asd.blocker : asd.getScale(r, asd.isItem);
        let distance = hypot(e - asd.x, n - asd.y) < I + u
        if(distance){
            obj.overlap.push(asd)
            obj.preplacer.push(asd.assumeBreak)
            obj.sids.push(asd.sid)
        }
    }
    if(obj.preplacer.includes(false)) return !1;
    return !(...river check...)
}
```

It does not early-return on the first blocker. It collects **every** overlapping
object and the `assumeBreak` flag of each, then declares the spot placeable iff
**all** of them are predicted to break.

Contrast NovaStorm (13355):

```js
customObjects.splice(customObjects.indexOf(findObject), 1);
```

NovaStorm can pretend exactly **one** object is gone. A spot blocked by two
spikes that will both die to the same hit is invisible to it. Whiteout's version
also hands back `overlap`/`sids` as a by-product, so the caller knows *what* it
is placing over — NovaStorm discards that.

There is a cheaper single-ignore variant too, `checkItemLocationPrePlace` (6135),
which filters on `tmp.sid != objToIgnore.sid` — semantically NovaStorm's splice,
but without copying the object array every tick.

### 1.2 Threat model — `objDmgPot` (14736)

```js
for(let x = 0; x < nearPlayers.length; x++){
    const _ = nearPlayers[x];
    if (_.sid == player.sid) continue;
    _.bDmg = _?.secondaryIndex === 10 && (_.secondaryReload === 0) ?
        {dmg:(sortWeaponVariant(_.secondaryVariant) * 75 * 3.3), wep: 10} :
    _?.primary && (_.primaryReloads === 0) ?
        {dmg:_?.primary?.dmg * 3.3 * sortWeaponVariant(_.primaryVariant), wep: _.primaryIndex} : 0
    if(_.bDmg === 0) continue;
    for(let i = 0; i < nearObjects.length; i++){
        const object = nearObjects[i];
        object.assumeBreak = false;
        if(object.type !== null || !object?.owner?.sid) continue;
        const d_o = UWUTILS.getDist(_,object,2,0) <= (items.weapons[_.bDmg.wep].range + object.scale);
        if (!d_o) continue;
        object.dmgpot = _.bDmg.dmg;
        if (_.antiBull) object.likelyDmg = _.bDmg.dmg;
        if (object.likelyDmg >= object.health) breakObjs.push(object);
        if (object.dmgpot >= object.health){ object.assumeBreak = true; continue; }
    }
}
```

Worth taking:

- **All `nearPlayers`, not just the nearest.** NovaStorm's `getPrePlaceObject`
  (13297) only ever looks at `nearestEnemy`.
- **`object.type !== null` skips natural resources.** NovaStorm has no such
  filter and relies on trees/rocks having no usable `health`.
- **Two tiers.** `dmgpot` (any ready weapon in range) drives `assumeBreak`;
  `likelyDmg`, gated on `_.antiBull`, drives `breakObjs`. "Could break" and
  "will probably break" are separate signals. NovaStorm has one.
- **Hammer special case**: `secondaryIndex === 10` → `variant × 75 × 3.3`.
  NovaStorm's equivalent at 13303 checks `weapons[1] == 10` but then runs it
  through the generic `items.weapons[weapon].dmg * (sDmg || 1)` path.
- **Ready-weapon gate** (`secondaryReload === 0` / `primaryReloads === 0`),
  which NovaStorm also has in a different form (`lastPrimaryReload <
  primaryReload[sid]`, 13302) — NovaStorm's is the reload *edge*, arguably
  sharper.

Things Whiteout does **not** do here, so I am not attributing them to it:

- It does **not** check hat ownership for the enemy — the `3.3` is hard-coded,
  exactly as in NovaStorm. (The hat-aware form `(hat === 40 ? 3.3 : 1)` appears
  only in `breakShit` (14766), which models *our own* hits, not the enemy's.)
- It does **not** apply an aim cone. `config.gatherAngle` is used in
  `breakShit`, again for our own hits, not in `objDmgPot`.
- It does **not** restrict to our own buildings — `!object?.owner?.sid` only
  requires an owner. It also does not require the player to be an enemy; only
  `_.sid == player.sid` is skipped, so teammates count as threats.

**Defect in the reference — do not port.** `object.assumeBreak = false` sits
*inside* the per-player loop (14750). A second player in `nearPlayers` resets
flags a first player set. The reset belongs in the `liztobj` clear at the top,
next to `dmgpot = 0`.

### 1.3 Candidate generation — `findAvailableAngles` (12277)

```js
function findAvailableAngles(item, thisAng, vel, xd = PI / 75){
    const interval = xd;
    const x = vel ? player.x3 : player.x2
    const y = vel ? player.y3 : player.y2
    for (let offset = thisAng; offset <= thisAng + PI2; offset += interval) { ... }
```

Three properties NovaStorm's `getPrePlaceAngles` (13061) lacks:

1. **Resolution is a parameter.** Default `PI/75` = 150 steps; `findAvailableAnglesR`
   (14224) uses `PI/60` = 120; `enemyPlacement` (12543) uses `PI/25` = 50.
   NovaStorm is hard-wired to 72.
2. **The sweep is anchored at a caller-supplied angle**, not always at 0, so
   candidates are enumerated outward from a meaningful direction.
3. **`vel` selects the predicted position `player.x3` over `player.x2`.**

Point 3 is the reference confirmation for the gap flagged in the main analysis:
NovaStorm's `getConfig`/`canPlace` already accept a `velocity` flag (12782,
12790) and `getPrePlaceAngles` never passes it, so preplace validates against
the current position and commits ~111 ms later. Whiteout parameterises exactly
this and uses the predicted position.

### 1.4 Enemy-side prediction — `enemyPlacement` (12543)

A second, coarser sweep computed **around the enemy** rather than around us,
returning `{ onPlayer, possible, placeRange }` — where `onPlayer` is the subset
whose placement point lands within `i.scale + 35` of *us*.

`gradeAngles` then consumes it as `enemy.placePot.possible` (12369) to raise
`placePriority` on our own candidates that collide with spots the enemy could
use. NovaStorm has nothing equivalent — it models where the enemy will *be*
(`xVel/yVel`), never where the enemy can *build*.

### 1.5 Scoring instead of a boolean cascade — `gradeAngles` (12345)

NovaStorm's `isPrePlaceAngle` (13088) is six early-return rules; the first match
wins, and ties are broken only by distance to the doomed object (13483).

Whiteout accumulates points per candidate:

```js
if(trarp.preplacer.includes(true) && trarp.placePriority){
    trarp.preplace = true;
    trarp.points += 1;
} else if(trarp.used !== -1){
    trap.splice(t - splicedTraps, 1); splicedTraps++; continue;
}
...
if (dAng(caf(player, tarp), enemy.aim2) > 1.3 && ...) tarp.points -= 4;
if(plyrDist <= 100) trarp.points += 1;
if(plyrDist <= 20.4) trarp.points += 1;
```

Two things to take:

- **`preplace` is a *derived* flag**, set only when the candidate overlaps at
  least one object predicted to break **and** the spot is high priority. In
  NovaStorm `preplace: true` is asserted by the caller (13488/13499) regardless
  of whether the chosen angle actually overlaps the doomed object.
- **Negative scores exist.** NovaStorm has no way to express "placeable but a
  bad idea"; every rule is an accept.

### 1.6 Dispatch, caps and budget — `checkPlacement` (12569)

```js
if(obj.preplace && obj.placePriority && ppAmt < 2 && secPacket <= 60){
    setTimeout(() => { placers(obj.item.id,obj.angle); prioLoc.push(obj); },
               game.tickRate - window.pingTime)
    return true;
} else if(obj.placePriority && ppAmt < 3 && secPacket <= 60){
    placers(obj.item.id,obj.angle); prioLoc.push(obj); return true;
}
canPlace = objectManager.checkItemLocation(obj.x, obj.y, obj.scale, .6, obj.item.id, false)
if(canPlace){ placers(obj.item.id,obj.angle); return true; }
return false;
```

- Preplace commits are deferred to `game.tickRate - window.pingTime` — the same
  idea as NovaStorm's `111 - tickPing()` (15474). Independent confirmation that
  NovaStorm's commit timing is the right shape.
- **Per-tick caps** (`ppAmt < 2`, `ppAmt < 3`) and a **packet-rate gate**
  (`secPacket <= 60`) on the preplace tiers specifically.
- **The fall-through re-verifies with the plain, non-preplace
  `checkItemLocation` before placing.** A candidate that only qualified under
  break-assumption does not get placed as an ordinary placement. NovaStorm never
  re-checks anything between deciding at tick time and sending ~111 ms later.

Budget-aware degradation also appears one level up, in `findAvailableAngles`
(12292):

```js
let canPlace = secPacket <= 90 ? objectManager.checkItemLocation3(...) : objectManager.checkItemLocation(...)
```

The expensive break-aware test is used only while the packet budget allows.

### 1.7 Movement prediction — `calcNewVel` (12957)

Real integration, matching the constants in NovaStorm's own bundle
(`playerSpeed` 0.0016 at 16816, `playerDecel` 0.993 at 16817):

```js
cosX && (_.speedXD += cosX * .0016 * mult * time)
let velXD = xVel*pow(.993,time), velYD = yVel*pow(.993,time),
    accel = {x:x2+velX,y:y2+velY}, decel = {x:x2+velXD,y:y2+velYD},
```

`mult` is `set.maxSpeed`, built at 7610-7621 from `(this.buildIndex >= 0 ? 0.5 :
1)` × weapon `spdMult` × skin/tail `spdMult` × snow biome × `slowMult`. The
`buildIndex` term matters directly here: you move at half speed while placing.

The part worth stealing is the **hypothesis selection**:

```js
if(_?.velocity!=undefined && _.sid!=player.sid)
  real = cdf(_, _.oldPos) == 0
      || (cdf(_,_.velocity?.accel) > cdf(_,_.velocity?.decel) && dAng(_.movDir,_.pmovDir)<=.3)
      || _.trapped
      ? decel : accel;
```

Each tick it keeps both an accelerating and a decelerating prediction, then
picks by **scoring last tick's two predictions against where the enemy actually
turned up**. That is a self-correcting predictor, and it costs almost nothing.
NovaStorm's `xVel = x2 * 2 - lastX` (14016) is a single unconditional
hypothesis with no feedback.

Whiteout stacks these into a horizon ladder — `x3` (+1 tick, 15266), `x4` via
`calcNewVel`, `x5` via `calcFVel` (13049), `x6` via `calcMVel` (13141).

### 1.8 Knockback modelling — `knockInto` (12308)

```js
if(fastHypot(closestPoint.x-objs[i].x, closestPoint.y-objs[i].y) <= (objs[i].name == "pit trap" ? 47.5 : objs[i].realScale + 35) && distance < obj.closest){
    obj.closest = distance; obj.building = objs[i]
    if(distance <= 150 && distance >= 50 && (objs[i].group?.name == "spikes" || objs[i].type === 1) && dAng(dir,caf(spike,objs[i])) <= .17){
        obj.bounce = true;
    } else { obj.bounce = false }
}
```

Compared with NovaStorm's `closestSpikeToKb` (13396): Whiteout clamps travel to
`Math.min(distance, 170)` and tests the **endpoint** against a radius, where
NovaStorm projects a fixed 200 units and does a segment-vs-square test (13424).
Whiteout also requires a **distance band** (50–150) and a tight **alignment
tolerance** (`dAng <= .17`, ~9.7°) before calling it a bounce; NovaStorm's
alignment is a soft ranking with no threshold, so its "best" bounce can still be
badly aligned as long as it is the least-bad candidate.

### 1.9 From the dead path (§1.0), labelled as such

Two ideas in `this.replacer` (9619) / `this.preplacer` (9844) are worth noting
even though neither function runs:

- **Bounded outward angle scan.** `const step = .375; const maxOffset =
  Math.min(angleDiffEdge + .25, 3);` with `angleDiffEdge = Math.asin(radius /
  dist)` (9645-9653) — the search width is derived from the geometry (the
  angular half-width the target subtends) instead of sweeping the full circle.
  Cheaper and better-targeted than 72 uniform steps.
- **Bounce validation before committing.** 9654-9660 computes the knockback
  direction, rejects it if `checkLineCollision` finds an obstruction, projects
  45 units, and only fires if an actual damaging object sits at the landing
  spot.

---

## Part 2 — Luna 1.1 as the Replace reference

I have to report this plainly rather than manufacture a contribution.

### 2.1 Luna's "replace" toggle is a stub

`prePlace2` occurs **exactly once** in the whole file:

```js
{ type: 'toggle', name: "replace", id: "prePlace2" }     // 19253
```

There is no `prePlace2` key in Luna's `window.vars` defaults (the placer block
at 19103 has `prePlace: true` only), and the id is read nowhere. It is the same
class of entry as Luna's `autsh1` and `triangle2`, which the repo README already
records as menu entries with nothing behind them.

### 2.2 Luna's live replace is NovaStorm's live replace

`getPredictObjects` diffs to **zero** between the two files ignoring whitespace
(Luna 11783-12030 vs NovaStorm 13322-13570). `getPrePlaceObject`, `canPlace`,
`getConfig`, `getPrePlaceAngles`, `getPerfectAngles` and `place` are identical.
The `spamPrePlacer` block is identical:

```js
setTimeout(function () {
    if (spamPrePlacer) {
        for (let object of predictObjects) {
            if (!object.preplace) continue;
            if (packets + 5 > 119) break;
            place(object.id, object.angle);
            placedAngles.push(object.angle);
            io.send("D", getAttackDir());
        }
    }
}, 111 - minPingTime);                            // Luna 14012 / NovaStorm 15489
```

`settings.spampreplace = true` is an orphan in Luna too (Luna 164) — NovaStorm
inherited a dead flag, it did not create one.

### 2.3 NovaStorm's two changes to Luna's preplacer — both improvements, keep them

| | Luna | NovaStorm |
|---|---|---|
| `canSpikeTick` radius | `config.scale + 35` (11593) | `config.scale + 55` (13130) |
| preplace commit delay | `111 - window.pingTime` (13998) | `111 - tickPing()` (15474) |

`tickPing()` (16681) returns the median-smoothed ping when `pingStabilizer` is
on and clamps to [0, 111]; Luna's raw `window.pingTime` does neither. Nothing to
port back.

### 2.4 The one substantive Luna win — and a correction to my earlier report

Luna's item-limit check is **correct**; NovaStorm's is **not**:

```js
// Luna 11296
let limit = config.inSandbox ? group.sandboxLimit || Math.max(group.limit * 3, 99) : group.limit;
if (limit && myPlayer.itemCounts[group.id] >= limit) { return true; }

// NovaStorm 12836
let limit = (group.sandboxLimit || 99);
if (myPlayer.itemCounts[group.id] >= limit) { return true; }
```

**Correction:** in the first analysis I described this as an inherited bug and
framed fixing it as a scope decision — whether to accept a behaviour change in
Auto Place and Auto Mills. That was wrong. It is a **regression NovaStorm
introduced against its own base**. Restoring Luna's expression puts every caller
back on the behaviour it was written against, so it is a regression fix, not a
scope expansion, and decision 1 in the main analysis is moot.

One adjustment is needed on the way back. Luna resolves sandbox via
`config.inSandbox`, defined at Luna 15192 as a hostname test. NovaStorm's
`config.inSandbox` (16806) is instead:

```js
module.exports.inSandbox = process && process.env.VULTR_SCHEME === "mm_exp";
```

— a server-side environment probe that is undefined in a browser. NovaStorm
carries the usable hostname test separately as `UTILS.isSandbox` (16807). The
restored check should use `UTILS.isSandbox`, not `config.inSandbox`.

---

## Part 3 — What this changes in the plan

Confirmed by a reference, promoted:

| Item | Reference | Main-analysis §|
|---|---|---|
| Validate preplace candidates at the predicted position | Whiteout `findAvailableAngles` `vel` → `player.x3` | 2.2.1 |
| Real movement integration for prediction | Whiteout `calcNewVel`; constants already in NovaStorm's bundle | 2.2.5 |
| Re-verify legality immediately before committing | Whiteout `checkPlacement` fall-through | 2.3.5 / 2.4.2 |
| Restore the item-limit check | Luna `isItemLimit` — **regression fix**, not a scope call | 2.2.3 |
| Threat model over all enemies, resources excluded | Whiteout `objDmgPot` | 2.3.3 / 2.3.4 |
| Tighter alignment gate on bounce candidates | Whiteout `knockInto` (`dAng <= .17`, 50–150 band) | 2.2.4 |

New, from the references, not in the first analysis:

- **Multi-object break-aware legality** (Whiteout `checkItemLocation3`) — lift
  NovaStorm's one-doomed-object limit.
- **Adaptive accel/decel hypothesis selection** scored against last tick's
  observation (Whiteout `calcNewVel`).
- **Points-based candidate scoring with penalties**, and `preplace` as a derived
  flag rather than a caller assertion (Whiteout `gradeAngles`).
- **Per-tick placement caps plus packet-budget-driven degradation** — drop to
  the cheap legality test when the budget is tight (Whiteout `checkPlacement`,
  `findAvailableAngles` 12292).
- **Geometry-derived angle search width** (`Math.asin(radius/dist)`) instead of
  a fixed full-circle sweep — from Whiteout's dead `replacer`, labelled.
- **Enemy-side placement prediction** (Whiteout `enemyPlacement`) — flagged as
  available; the largest of these and the least clearly worth its cost in
  NovaStorm's architecture. I would not do this without asking.

Explicitly **not** taken:

- Whiteout's `objDmgPot` `assumeBreak` reset placement (defect, §1.2).
- Whiteout's threat model as a source of hat accuracy or aim-cone filtering — it
  has neither; those remain my own proposals, not reference-backed.
- `traps.preplacer` / `traps.replacer` as architecture — both dead (§1.0).
- Anything from Luna's `prePlace2` — it is a stub (§2.1).
