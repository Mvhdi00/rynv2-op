# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | RYN Client v4 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation + truncated-HMAC frame prefix | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

The game shipped in `src/game_index.js` negotiates an opcode table per
connection (`io-init[3] === 1`), permutes the c2s/s2c alphabets from a seed,
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 predates that
transport entirely — it is a fork of the old webpack `bundle.js` and cannot
connect to the current game at all.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

## What the mix changes

### Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — see below; RYN's `AutoPlacer` **is**
  Luna's placer, ported.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — these
  are menu entries in Luna with no implementation behind them. Nothing to port.

### The placer

Luna's placer was already ported into RYN before this merge — `AutoPlacer`
carries Luna's function set under RYN's naming (`getConfig` → `_getConfig`,
`canPlace` → `_canPlace`, `addPredictObject` → `_addPredictObject`,
`getPrePlaceAngles` → `_getPrePlaceAngles`, `getPrePlaceObject` →
`_getPrePlaceObject`), rebuilt on RYN's spatial grid. Luna's whole placer menu
is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

**Bug fixed in the placer.** `AutoPlacer._isItemLimit` read
`group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
that made the cap 99 for everything without a `sandboxLimit` — spikes (real
limit 15), traps (6), turrets (2), mines (1) — and 299 for the three that have
one. The limit gate effectively never fired, so the placer kept spending
placement ticks on items it could not place.

This came straight from Luna, which has the same expression. The rest of the
client already gets it right: `ClientPlayer.getItemCount` picks `sandboxLimit`
only when actually in sandbox and falls back to `group.limit` otherwise, and
`AutoRetrap._isItemLimit` is written against that. `AutoPlacer` now makes the
same call, so all three agree.

### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification).

### Removed

RYN v4 opened with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in the client needs it. It is stripped from the build.

---

## Ryn Type 2: the Auto Heal upgrade

`Ryn_Type_2.user.js` is Ryn Type 2 v5.4 with its existing Auto Heal extended.
The module was not replaced — `AntiInsta.postTick` still opens with novastorm's
rule (sum `potentialDamage + potentialSpikeDamage`, cap at 140, ×0.75 for
soldier, +5 for bull, heal if it reaches your health), `ShameReset` still owns
the bull-tick latch, and the placer, preplace, replace, spike tick and packet
architecture are untouched.

### The shame rule, as the server actually writes it

`src/game_index.js`, inside `buildItem` for a consumable:

```js
if (this.hitTime) {
    const W = Date.now() - this.hitTime;
    this.hitTime = 0;                       // ← the eat clears it
    W <= 120 ? (this.shameCount++, this.shameCount >= 8 && (this.shameTimer = 3e4, ...))
             : (this.shameCount -= 2, ...)
}
this.shameTimer <= 0 && (V = f.consume(this))
```

Four consequences the client had not been modelling:

- **The first eat of a batch is the only one that moves shame.** It clears
  `hitTime`, so an emergency burst costs `+1`, not `+N`.
- **Shame only falls if you eat more than 120 ms after taking damage.** With no
  damage there is no stamp and eating does nothing, so recovery is rate-limited
  by incoming hits, not by food.
- **The bookkeeping runs before `consume`,** and `changeHealth` returns `false`
  at full health, so `useRes` never fires. Eating at 100 HP with an aged stamp
  is **−2 for no food and no wasted heal**.
- **Bull Helmet manufactures the stamps.** `healthRegen: -5` once a second
  (`serverUpdateRate` 9, so every ninth tick) is one stamp a second, −2 a
  second: 7 → 0 in four seconds.

### What was wrong

- **Bull-hat shame recovery was unreachable.** `ShameReset` set `forceHat = 7`
  at module index 35; the Safe Soldier block at the foot of
  `ModuleHandler.postTick` stamped `forceHat = 6` whenever an enemy was inside
  300 px. In a fight, shame only ever went up.
- That same block runs **after** `autoHat` (index 55) has already sent the
  equip, so what it wrote never reached the wire at all.
- `tempHealth >= maxHealth` returned early, so the free full-health −2 was never
  taken.
- The Anti detectors — `velocityTickThreat`, `reverseInsta`, `toolHammerInsta`,
  `rangedBowInsta`, `spikeSyncThreat` — only steered `DefaultHat`. The heal
  decision never saw any of them.
- `_healsInFlight` cleared its ledger on *any* health movement, so the bull
  helmet's own −5 wiped it every second and the next tick paid twice.
- `heal()` deferred every apple inside the shame window, including the one
  `AntiInsta` raised *because* the damage was lethal.
- Three heal paths (`AntiInsta`, `AntiSync`, `Placer`) plus two independent
  deferral queues (130 ms and 139 ms), no shared budget, no emergency reserve.

### What it does now

- `Player.bookShameEat` / `canDrainShame` / `shameStampPending` mirror the
  server's `hitTime` exactly, booked at send time so the full-health case is
  visible. Bull/poison tick detection now also matches the ×0.75 values, so the
  cycle is not lost when soldier goes on.
- `AntiInsta._assessThreats` collects every named Anti into one mask, each
  carrying the damage its sequence implies, and the heal takes the worse of that
  and novastorm's sum — so several live threats resolve together. Covered: Insta,
  Velocity Tick, Reverse Insta, Musket/Bow, Primary + Musket/Bow (novastorm's
  400 px term, previously absent), Spike Push, Knockback Tick, Spike Tick, One
  Tick (novastorm computes it and never reads it — here it is live), Spam
  Daggers + Bull, Spam Bow, Turret, Shame.
- `AntiInsta._assessShame` owns the shame budget and decides when Bull is safe;
  `ShameReset` keeps the timing and the latch.
- `ModuleHandler.requestDefenseHat` / `resolveDefenseHat` arbitrate Soldier vs
  Bull by priority, resolved inside `autoHat` so the decision reaches the wire.
  Authority is narrow: it displaces soldier freely, bull only for a threat-level
  soldier call, and never touches tank, turret or spike gear.
- Four heal modes — emergency (bounded at a full bar, spends the reserve),
  proactive (Misery's pre-heal, but only while it is free), full-health shame
  drain, and the routine top-up — over one packet ledger with a 12-packet
  emergency reserve, a food cap and a per-tick cap.

**Shame never intentionally exceeds 7.** `heal()` refuses the one eat that would
cost a point once `shameCount` is at 7, so the rule holds from every call site
rather than depending on each one remembering. Misery's `lethalSpikeHealOverride`
— which heals through 7 when the predicted damage is lethal — is deliberately
not taken.

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ryn_Type_2.user.js        Ryn Type 2 v5.4, with the upgraded Auto Heal
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/source-slice.js     lifts classes, methods and constants out of a client
tools/autoheal-harness.js runs Ryn Type 2's Auto Heal code in a stubbed world
tools/test-autoheal.js    the Auto Heal test suite
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

For Ryn Type 2 and its Auto Heal:

```sh
node --check Ryn_Type_2.user.js
node tools/verify-drivers.js Ryn_Type_2.user.js
node tools/test-autoheal.js
```

`test-autoheal.js` does not restate the Auto Heal logic. `source-slice.js` lifts
the real `AntiInsta` class, the `ModuleHandler` heal and hat methods and the
`Player` shame methods straight out of `Ryn_Type_2.user.js` by signature, and
the harness runs them against a stubbed EnemyManager, ProjectileManager and
socket with a clock the tests drive. Edit the client and the suite is testing
the edit; delete a method it slices and it fails loudly rather than silently
passing against a stale copy.

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load — frame signature
width, transport mode, live opcode table size. A server-side protocol change
shows up as a console warning instead of as packets that quietly stop being
understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
