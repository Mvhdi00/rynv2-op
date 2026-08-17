# 2YZ Source Map

Where each behaviour in 2yz came from, what was taken, and why.

Function and variable names below are the real ones from the supplied files.
Line numbers are from the uploaded copies as read:

| Source | File as read | Role |
|---|---|---|
| NovaStorm 1.4 | `novastorm_1.4.txt` (21,109 lines) | Auto Place, Anti Smart Tick, Safe Soldier, Auto Heal, Auto Mills, Spike Tick |
| Whiteout v4 | `Whiteout_v4.js` (22,539 lines) | Preplace |
| Luna Client (fixed) 1.1.1 | `Luna_Fixed.user.js` (19,974 lines) | Replace |
| TND | `tnd1.txt` (37,825 lines) | Combat |
| Game bundle | `12.txt` → `src/game_index.js` | Authoritative definitions |
| Game vendor | `2_2.txt` → `src/game_vendor.js` | msgpack codec |

The two game files were byte-identical to the copies already in this
repository (`md5 2d0c58e8…` and `bc8ea367…`), so 2yz builds against
`src/game_index.js` and `src/game_vendor.js` directly.

---

## Inventory

All four reference clients are **forks of the game bundle**, not overlays: each
ships its own copy of the webpack game plus a transport shim that translates the
old plain-msgpack `[type, args]` calls into the current secure framing.
NovaStorm makes this explicit — `window.UNPATCH_CLIENT = true` on line 14,
then an `EXP` shim (lines 15–400) with its own msgpack writer, opcode tables and
HMAC. Whiteout does the same under `WhiteoutNet`, TND under `installMohControl`.

2yz does not fork the bundle. See *Architecture* for why.

```
NovaStorm                                Whiteout
├── getConfig            12620           └── preplace              8322
├── canPlace             12628               checkPreplace         8378
├── addPredictObject     12663               checkCanPrePlace      8510
├── isItemLimit          12670               calcVel              14869
├── updateAngles         12726               calcNewVel           12957
├── getPerfectAngles     12906               x3/y3 assignment     15266
├── checkPredictObjects  12744
├── isAutoPlaceAngle     13023           Luna
├── isPrePlaceAngle      12921           ├── getPrePlaceObject
├── getPrePlaceObject    13122           ├── getPredictObjects
├── getPredictObjects    13157           └── prePlace2 (menu id)  19253
├── canSmartTick         12303
├── doSmartTickAnti      12237           TND
├── canTrapTick          12543           ├── doInsta              35944
├── canVelocitySpikeTick 12171           ├── kbInsta              22517
├── canShamePlace        12437           ├── regInsta             20102
├── place                12575           ├── enemyPlacement       36030
├── heal                 12582           └── shieldBypass
├── hatFc                16160
└── io.send / packets    19870
```

---

## Feature matrix

| Feature | Source | Original implementation | Extracted concept | 2yz module | Why selected |
|---|---|---|---|---|---|
| **Auto Place** | NovaStorm | `updateAngles` → `getPerfectAngles` → `checkPredictObjects` → `isAutoPlaceAngle` | 72-step ring sweep; boundary ("perfect") angles where placeability flips; three tactical questions — intercepts target, chains knockback into own spikes, blocks own line | `40-placement.js` (where) + `50-mod-autoplace.js` (whether) | The sweep and the boundary-angle idea are the strongest placement primitives in the four sources. The priority ladder was **not** taken — see below. |
| **Preplace** | Whiteout | `checkCanPrePlace` reading `player[pre ? "x3" : "x2"]`; `x3/y3` set from `calcVel().real`; release via `preplaceTimeout - performance.now()` | Validate the ring against the *future* player position, not the current one; release early by ping so the build lands on the tick it was computed for | `51-mod-preplace.js` | The only source that validates placement against a predicted position. NovaStorm's "preplace" is break-prediction (which 2yz classes as Replace), not movement-leading. |
| **Replace** | Luna | `getPrePlaceObject()` + the `customObjects.splice(customObjects.indexOf(findObject), 1)` sweep in `getPredictObjects` | Find a structure whose health is at or below the next swing's damage; sweep with it removed from the collision set so the gap it will leave reads as free; build into that gap | `52-mod-replace.js` | Luna's genuine replacement logic. **Luna's menu toggle labelled "replace" (`prePlace2`, line 19253) is dead** — one occurrence in the whole file, no default in the vars block, no reader. It was not ported; the working logic under `getPrePlaceObject` was. |
| **Spike Tick** | NovaStorm | `canTrapTick` (12543), `canVelocitySpikeTick` (12171) | The timing conditions: target held, our hammer ready, holder breakable in one swing, target not already bleeding, push must not travel toward us | `53-mod-spiketick.js` | Correct conditions. Split from placement: NovaStorm's `canTrapTick` sweeps the ring itself via `getPrePlaceAngles` just to answer "is now the moment", then the placer sweeps again. 2yz shares one cached sweep. |
| **Anti Smart Tick** | NovaStorm | `doSmartTickAnti` (12237) | Sweep the ring **around the enemy**, find positions they could build that would touch us once free, project our knockback out of each, and wait if it lands on one of their spikes | `54-mod-antismarttick.js` | The detection is right. Rebuilt as a `HoldIntent` so it can lose an arbitration, and bounded so a patient enemy cannot pin the client indefinitely. |
| **Safe Soldier** | NovaStorm | `totalDmgPot` accumulator (15100–15170), `hatFc` (16160), `soldierAnti` | Itemised projection of every damage source that can land this tick — each enemy slot gated on reload and reach, turret, structure contact, knockback-into-spike — capped, then compared against a threshold | `55-mod-safesoldier.js` | The accumulator is the good idea. Every figure now comes from the shipped tables (NovaStorm hard-codes `45` for spike damage and `25` for turret). |
| **Auto Heal** | NovaStorm | `heal(value)` (12582) — `for (i = 0; i < value; i += items.list[items[0]].heal) place(items[0])` | One build sequence per food item, count derived from the food's own heal value | `56-mod-autoheal.js` | Right shape. 2yz adds a frame budget, a shame gate, and accounts for over-time healing. |
| **Auto Mills** | NovaStorm | mill block in `getPredictObjects` (13358), its own comment: "SHIT AUTO MILLS" | Mills trail behind the direction of travel, spread by the mill's own scale (`angle ± toRad(scale + scale/2)`) | `57-mod-automills.js` | Only the trailing placement and scale-derived spread. The rest is the module's suppression logic, which NovaStorm lacks. |
| **Combat** | TND | `doInsta` (35944), `kbInsta` (22517), `shieldBypass`, `E.pr`/`E.sr`, `nEnemy.np.real` / `E.np.accel` | A burst is a sequence across ticks with a re-check between halves; order depends on the weapon pair; range checked against both current and predicted positions; shield arc checked before committing; damage hat belongs to the swing | `41-combat.js` | The strongest combat model of the four. Rebuilt onto intents — see below. |
| **Prediction** | Game bundle (primary), Whiteout (confirming) | `PlayerObject` update step, `src/game_index.js:2330-2374`; Whiteout's `calcVel` (14869) | `D(n) = D(n-1)·playerDecel^f + playerSpeed·mult·f²`, and the accel/decel branch ambiguity | `30-prediction.js` | Taken from the **game**, not from Whiteout, because the game is authoritative. Whiteout's `calcVel` was used to confirm the reading and contributed the accel-vs-decel branch-selection idea. |
| **Targeting** | TND (concept) | `nEnemy` selection, `botEnemies` | Threat as a first-class term rather than pure distance | `31-targeting.js` | 2yz's scoring and hysteresis are its own; TND has no target-switch damping. |
| **Weapon selection** | NovaStorm + TND | `getPredictWeapon` (12636); TND's `primary`/`secondary`/`hold` | Reload state drives which slot is usable; pair order matters | `41-combat.js` | Merged: NovaStorm's reload-driven selection, TND's pair ordering. |
| **Packet handling** | Game bundle | `O.connect` / `O.send`, `src/game_index.js:409-490`; `Po`/`Oi`/`Vt`/`Ao`/`Eo`/`Ro` (292–404) | Opcode permutation from the io-init seed, 6-byte truncated HMAC-SHA256 prefix, `[opcode, args, seq]` payload | `10-transport.js` | Transcribed from the game. NovaStorm's `EXP` shim implements the same algorithm; the game was used as the source of record and the shim as a cross-check. |
| **Packet budget** | NovaStorm | `packets++` / `packets = 0` per second (19874), gate `packets + 5 > 119` | A hard per-second frame cap that placement respects | `11-net.js` + `62-scheduler.js` | Sound idea. In 2yz the budget is reserved during arbitration, so an action is refused rather than truncated. |
| **State management** | — | — | — | `20-gamestate.js` | 2yz's own. All four sources keep state in module-level globals inside the forked bundle. |
| **Priority system** | — | — | — | `61-arbiter.js` | 2yz's own. None of the four sources has one. |

---

## What was deliberately not taken

**NovaStorm's priority ladders.** `isAutoPlaceAngle` (13023) and
`isPrePlaceAngle` (12921) are chains of `if (…) return true`. A candidate that
hits the target *and* blocks the player's own swing returns `true` on the first
clause; the blocking clause is never evaluated. 2yz scores every axis and sums
(`PlacementEngine.rank`), so a candidate that is good on one axis and bad on
another loses to one that is decent on both.

**NovaStorm's `isItemLimit`.**

```js
let limit = (group.sandboxLimit || 99);
```

Outside sandbox this caps everything without a `sandboxLimit` at 99 — spikes
(real limit 15), traps (6), turrets (2), mines (1) — and at 299 for the three
that have one, so the gate effectively never fires. `Defs.groupLimit` picks
`sandboxLimit` only when `config.inSandbox`, and falls back to `group.limit`.
The same expression appears in Luna, which is where NovaStorm inherited it.

**NovaStorm's `hatFc`.** A straight-line cascade of assignments where the last
matching branch silently wins, so the defensive hat and the damage hat are
resolved by source order rather than by which matters more. In 2yz both are
intents and the Arbiter decides.

**TND's global combat flags.** `instaing`, `instaToggle`, `hold`, `aim[0]`,
`visAim` are module-level mutables written from inside `async` functions that
`await nextTick()` between packet sends. A sequence that loses its target mid-
await can leave `instaing` stuck true. 2yz's `Sequence` carries its own state and
is killed by the `targetSwitched` event.

**TND's direct sends.** `ee.send("D", …)` and `ee.send("z", …)` are called from
inside `doInsta` itself, bypassing any scheduler. In 2yz nothing but
`PacketScheduler` reaches the socket.

**Whiteout's `chainPlace` repeat counts.** `preplace` schedules
`chainPlace(id, rad, 6, 4, …)` on a `setTimeout` that fires regardless of whether
the prediction survived the wait. 2yz revalidates at release and drops the
placement if the target turned.

**Everything else from Whiteout, Luna and TND.** Only the systems named in the
matrix were studied and rebuilt. No menu, rendering, chat, pathfinding, autobuy
or store code from any source is present.

---

## Facts taken from the game files, not invented

Every one of these was read out of `src/game_index.js` and is re-checked by
`tools/verify-2yz.js` or extracted by `tools/extract-drivers.js`.

| Fact | Value | Where |
|---|---|---|
| c2s opcodes | `M D 9 e F z H K L N b P Q c 6 S 0` | `O.send` sites, 4122–5613 |
| c2s meanings | `D` = aim dir, `9` = move dir, `F` = attack, `z` = select, `c` = store, `S` = map ping, … | each `O.send` call site |
| s2c opcodes | 36 handler keys | handler map at `O.connect`, 3515 |
| `UPDATE_PLAYERS` layout | stride 13, `[sid,x,y,dir,buildIndex,weaponIndex,weaponVariant,team,isLeader,skinIndex,tailIndex,iconIndex,zIndex]` | `Jl`, 5551 |
| `LOAD_OBJECTS` layout | stride 8, `[sid,x,y,dir,scale,type,itemId,ownerSid]` | `Vl`, 5432 |
| `ADD_PLAYER` layout | `[id,sid,name,x,y,dir,health,maxHealth,scale,skinColor]` | `getData`/`setData`, 2291 |
| Frame signature width | 6 bytes | `jt`, 279 |
| Table salt | 1 | `Io`, 278 |
| Secure mode value | 1 | `Ht`, 280 |
| Opcode permutation | seeded Fisher–Yates, seed `(s ^ imul(salt, 2654435761)) >>> 0`, s2c seed further `^ 2246822507` | `Oi`/`Po`, 292–318 |
| Frame MAC | HMAC-SHA256, truncated to 6 bytes | `Vt`/`Ao`/`Eo`, 320–399 |
| `playerSpeed` | 0.0016 | `Gs`, 154 |
| `playerDecel` | 0.993 | `Ns`, 156 |
| Movement integration order | accelerate → move → decay | `PlayerObject.update`, 2330–2374 |
| `playerScale` | 35 | `Xs`, 153 |
| `serverUpdateRate` | 9 | config, 219 |
| `clientSendRate` | 5 | config, 226 |
| `gatherAngle` | π/2.6 | `_s`, 150 |
| `shieldAngle` | π/3 | `Qs`, 176 |
| `hitReturnRatio` | 0.25 | `qs`, 152 |
| Placement offset | `playerScale + item.scale + (item.placeOffset ?? 0)` | build branch, 2458 |
| Placement collision | `checkItemLocation(x, y, scale, 0.6, id, ignoreWater, placer)` | 911 |
| Object collision scale | `scale * (isItem \|\| type==2 \|\| type==3 ? 1 : 0.6*mult) * colDiv` | `getScale`, 1451 |
| Item group caps | spikes 15, traps 6, mills 7, turrets 2, mines 1, walls 30 | `itemGroups` table |
| Weapon damage / range / cooldown | all 16 weapons | `weapons` table |
| Hat effects | Soldier `dmgMult 0.75`, Bull `dmgMultO 1.5`, Tank `bDmg 3.3`, Turret `{proj:1, range:700, rate:2500}` | `hats` table |
| Food healing | apple 20, cookie 40, cheese 30 + 10×5 over time | probed from each item's own `consume()` — see below |
| Aim-change gate | 0.3 rad | `Tt`, 4585 |
| Ping interval | 2500 ms, c2s `0` → s2c `0` | `os`/`Zl`, 5604–5614 |

**Food healing is not a field in the shipped tables.** The game encodes it as a
function: `consume: function(e) { return e.changeHealth(20, e) }` (1874). A JSON
dump of the item table drops the function, so `item.heal` would be missing and a
client would have to guess. `tools/extract-drivers.js` now runs each item's own
`consume()` against a recording stub and records what it did, so the figures stay
authoritative. NovaStorm reads `items.list[id].heal` — a field that exists in the
older bundle it forked, not in the current one.

## Marked UNKNOWN

Nothing 2yz depends on is unknown. Two things were looked for and are genuinely
not available, and each is handled explicitly rather than guessed:

- **Enemy loadouts.** `UPDATE_ITEMS` (s2c `V`, handler `Nn`, 4402) is sent only
  to the owning client, so 2yz cannot know which spike or trap an enemy has
  slotted. `AntiSmartTick.findTrap` models the threat with our own spike and says
  so in a comment; erring toward the larger item makes the defence conservative.
- **Enemy shame count.** Tracked server-side (`shameTimer`/`shameCount` on
  `PlayerObject`, 2308) and never transmitted. `Entity.shameCount` exists and is
  populated only for the local player. No module branches on an enemy's shame;
  NovaStorm's `nearestEnemy.shameCount > 6` checks read a field its fork
  maintained locally, which the current protocol does not support.
