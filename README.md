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

## RYN Type 2 — the Auto Heal

`Ryn_Type_2.user.js` is a separate client from the mix above. Its Auto Heal was
a port of novastorm 1.4's; it has been deleted and rebuilt from scratch around
one rule: **shame is a resource, the ideal is 0, and it never passes 7.**

### Why shame is the axis

`Player.buildItem` in `src/game_index.js` is the whole mechanic:

```js
if (f.consume) {
    if (this.hitTime) {
        const W = Date.now() - this.hitTime;
        this.hitTime = 0;
        W <= 120 ? (this.shameCount++,
                    this.shameCount >= 8 && (this.shameTimer = 3e4, this.shameCount = 0))
                 : (this.shameCount -= 2, this.shameCount <= 0 && (this.shameCount = 0));
    }
    this.shameTimer <= 0 && (V = f.consume(this));
}
```

Four things fall out of it, and the design is built on them:

- **Shame moves on the first consume after a hit and on no other.** Five apples
  in one burst cost what one costs, so healing always goes out in bursts.
- **`hitTime` is set by any negative `changeHealth`, self-inflicted included.**
  Bull Helmet is `healthRegen: -5` on the one-second regen tick, so wearing bull
  manufactures a hit to spend — and the consume that answers it is worth −2.
  That is the only reason bull is ever equipped here.
- **The arithmetic runs before the consume, and whether it lands is irrelevant.**
  At full health `changeHealth` refuses before `useRes`, so a scrub at 100 HP
  costs three packets, no food, and still takes 2 off the counter.
- **The server measures the gap, not us.** A hit landing while a consume is in
  the air re-arms `hitTime` and the server measures *that* hit instead. No
  consume is ever certain to be a decrement.

Hitting 8 sets `shameTimer = 30000`: half a minute in which every apple is
discarded. So the ceiling is not enforced by predicting each heal — it is
enforced by not eating at 7 at all, with one exception: a scrub taken when
nothing can reach us and, if bull is on, early enough in the drain's second
that the consume cannot arrive after the next one. That exception is what keeps
7 from being a dead end, since shame only moves on a consume.

### Shape

| | |
|---|---|
| `AhLedger` | what hit me, and what it was — hits and shots claimed against the damage ledger, the remainder is contact damage |
| `AhShame` | the counter as an upper bound, the ceiling, the scrub window, the drain phase |
| `AhThreat` | every Anti, folded into `now` and a three-tick `burst` |
| `AhBudget` | the packet allowance, with a reserve that survives it |
| `AhPlan` | hat, then heal, then the shame gate, then the budget |
| `RynAutoHeal` | sense → predict → decide → execute, once a tick |

The Antis are sensors, not actors: none of them sends a packet or picks a hat.
`AhPlan` resolves all of them in one pass, which is what stops two of them
fighting over the hat or spending the budget twice. Anti Insta Kill, Reverse
Insta, Velocity Tick, Musket/Bow, Tool Hammer Insta, Spike Sync, Spike Push,
Knockback Tick, Spike Tick (placement and contact), Turret, One Tick, Primary +
Musket/Bow, Spam Daggers + Bull, Spam Bow, Poison, Smart Tick and Shame all
feed the same picture.

Only **Soldier (6)** and **Bull (7)** are ever equipped. Soldier's
`dmgMult: 0.75` is the only incoming-damage reduction in the game — no accessory
carries one — so a diamond polearm's 45 × 1.5 × 1.18 = 79.65 arrives as 59.74
behind it. Bull is the pump above. DefaultHat, UtilityHat, the instakill modules
and DefaultAcc keep everything else; the Auto Heal no longer picks accessories
at all, and `ModuleHandler.forceAcc` — which existed only for the old cascade —
is gone with it.

The threat picture is read from what `EnemyManager`, `ProjectileManager` and the
per-player predictions already compute once a tick rather than walked again, so
the module owns one grid query (Anti Smart Tick, only while trapped with a great
hammer) and one placement sweep, angle-bounded to about ten candidates instead
of 36. No intervals, no timeouts, no per-frame work.

### Verification

```sh
node --check Ryn_Type_2.user.js
node tools/verify-drivers.js Ryn_Type_2.user.js
node tools/autoheal-tests.js
node tools/autoheal-stress.js
```

The two suites cut the module out of the built file, so they cannot be run
against a stale copy. Current state: 99 scenario checks and 21 stress checks
pass. The stress run drives 100,000 ticks against a server model that applies
`buildItem` verbatim, with round trips from 30ms to 300ms and four combat
shapes — **peak shame 7, zero lockouts**, at 2.5µs per tick with eight enemies
and six bolts in the air (server ticks are 111,000µs apart).

---

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ryn_Type_2.user.js        RYN Type 2 v5.4, with the rebuilt Auto Heal
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/autoheal-harness.js cuts the Auto Heal out of the build and stubs a client
tools/autoheal-tests.js   Auto Heal scenarios, one behaviour at a time
tools/autoheal-stress.js  the shame invariant against a server model, and cost
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
