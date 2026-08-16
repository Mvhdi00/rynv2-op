# RYN / ReUp

Two moomoo.io userscripts in one repo, both built against the game bundles in
`src/` and verified against them:

- **`RYN_v5.4.user.js`** — RYN Client v5.4, where the placer work lives.
- **`ReUp_Mix.user.js`** — the earlier Luna × RYN v4 merge, described further down.

---

## The placer (RYN v5.4)

Autoplace, preplace and replace are one module, `AutoPlacer`, and one pass per
tick: it rebuilds the set of builds it wants and flags each one `preplace` or
not. Autoplace goes out immediately; a preplace entry is held and sent again
when the slot it is aimed at frees; replace is that same entry sent a third
time at min-ping, for when the second send lost the race. The decision set is
Luna Client 1.1's, rewritten onto RYN's managers.

What v5.4 adds on top of Luna's version:

| | |
|---|---|
| **Placing while pinned** | Luna places nothing at all when you are in a trap: every spike rung of its ladder needs the *enemy* trapped, and both trap rungs need neither of you trapped. `isTrappedPlaceAngle` is the ladder for being pinned — spikes that can already reach them, spikes on the line they are closing along, the arc they have to come through, and a trap under the only ground they can hit you from. It keeps the lane directly behind you clear so breaking out is not into your own wall. |
| **The slot you are breaking out of** | `_getPrePlaceObject` now prefers the trap holding you over anything else you are swinging at, and the preplace ladder will take that slot with a **spike**. The freed slot is the one the enemy is about to drop a fresh trap into; a spike in it denies the retrap and damages the push. |
| **Origin lead** | The server builds at the position it holds for you when the packet lands, not the one you had when you sent it. The recorder measures that offset from the objects coming back and the probe origin is shifted by it. Pinned, the lead is exactly zero, which is why placement while trapped is the most accurate placement there is. |
| **Retrapping** | A pin is only worth what happens when it ends. An enemy standing in one of your traps is written down, and the note outlives the trap: the tick it breaks, the object is gone and the enemy reads as free, so the note is the only thing that knows a retrap is owed. A fresh trap goes straight back into the slot — a **trap**, ahead of any spike. Luna would only retrap if they were already taking spike damage, and never once the object was gone. The game also clears a trap's `hideFromEnemy` the moment it closes on someone, which Luna's preplace scan did not account for, so the trap holding the enemy was the one object it could never see as a slot about to open. |
| **Free arcs** | Luna asks "is this angle free?" 72 times and works off the samples: a build packed against a neighbour lands up to 2.5° off the tightest angle, and a gap narrower than the grid is invisible. Each blocker forbids exactly one arc of placement angles and it has a closed form, so the free angles are solved for instead — all of them, off one pass over the neighbours. Arc ends are exactly packed, and "pretend this object is gone" becomes a filter rather than a second pass over the world. Luna also never closed the circle, so a run straddling 0 rad lost both its ends; that is fixed. |
| **Aimed angles** | The tangents that put a build exactly on the edge of the enemy's hitbox — now and where they are heading — and the angle into a slot that is opening, are probed as real candidates instead of being rounded onto the 5° grid. |
| **Enemy prediction** | Luna reaches one tick ahead (`pos.future`). The reach segment now runs to where they will be when the build actually exists (ping/2 + a tick), so a spike goes in front of a rush instead of behind it. |
| **Scoring** | Luna's ladders are boolean and ordered, with distance as the tie-break inside a rung. Everything the ladders allow is scored — catches, packing, spike-tick reach, knockback alignment onto spikes you own, what it walls off — and the packet budget is spent best-first. |
| **Recording** | Every send is logged and matched against the object that comes back, which is where the origin lead, the resend delay and the dead-angle bans come from. `RYN_PLACER.recorder.stats` in the console reads back ack latency, jitter, the learned lead, origin error and per-kind success rates. |
| **Budget** | Luna spent to the hard limit. The per-tick cap is 6 builds (4 while pinned), and the placer stops queueing with 20 packets of the per-second allowance still unspent, so heal and anti-insta are never starved by a spike wall. |
| **Speed** | A full tick costs **~29µs** with 14 objects in range, against ~95µs for the previous build and far more than that for Luna's sampling: no collision scan per probed angle, one grid query a tick instead of 144, squared distances throughout, and a smaller sweep for the spikes around the enemy. A preplace resend re-checks the slot first, so a slot someone else filled costs a query instead of five packets. |
| **Correctness** | `getItemByType(7)` is the whole trap/boost/teleport slot; only a real trap now gets the trap ladder. The item-limit check reads the real group limit rather than the sandbox one. |

Three switches in **Combat → Spikes & Traps**, all on by default:

- **Smart Placer** — the scorer. Off leaves Luna's boolean ladders alone.
- **Trapped Placer** — the pinned ladder. Off restores Luna's silence while trapped.
- **Placer Learning** — the recorder feeding back the origin lead, the resend
  delay and the angle bans. Off pins the resend to Luna's fixed `111 - ping`.

```sh
node tools/test-placer.js       # 56 checks, and prints the per-tick cost
node tools/verify-drivers.js RYN_v5.4.user.js
node --check RYN_v5.4.user.js
```

`tools/test-placer.js` lifts `Items`, `ItemGroups`, `Config`, the spatial grid
and the placer itself straight out of the userscript by source anchors and runs
them against a mocked world, so the scenarios exercise the shipped code rather
than a copy of it. Among them: the free arcs are checked against a
quarter-degree brute-force sweep over 60 randomly built worlds, in both
directions — no candidate may land on an object, and no genuinely free angle
may be missed. `RYN_PLACER_SCRIPT=<path>` points it at another build, which is
how the cost of a change gets compared against the build before it.

---

## ReUp Mix (Luna × Ryn)

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

## Layout

```
RYN_v5.4.user.js          RYN Client v5.4 — the placer work lives here
ReUp_Mix.user.js          the build output — this is the script to install
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/test-placer.js      runs RYN v5.4's placer against a mocked world
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
