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

## Layout

```
ReUp_Mix.user.js          the build output — this is the script to install
Ryn_Type_2.user.js        RYN Type 2, standalone userscript (see below)
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/survival-harness.js extracts the real tables + SurvivalCore out of
                          Ryn_Type_2.user.js and evaluates them standalone
tools/survival-world.js   a synthetic world with the surface SurvivalCore reads
tools/survival-tests.js   the survival engine's test and audit suite
```

## RYN Type 2 — Survival Core

`Ryn_Type_2.user.js` is a separate client and a separate script; it is not
built from `src/` and `build-reup.js` does not touch it.

Its autoheal is **Survival Core**, a rebuild of the module from zero. The
previous one (`NovastormHeal`, a novastorm 1.4 / Falcons port) summed five
damage terms into one capped number with no timing in it and compared that to
the health bar. Survival Core instead builds a health curve `H(t)` over the
next nine server ticks — one full period of the game's regen and poison loop —
out of typed, timed, confidence-weighted threats.

### The shame rule

Everything else in the module is subordinate to one policy:

> A food is never sent inside the server's 120ms window unless waiting for
> that window to open would actually kill you.

Not "unless the tier is urgent", not "unless the deadline has passed" — those
are proxies, and a proxy is what lets a 20-damage tap walk the count up. The
forecast can answer the real question exactly: take the *confident* curve, look
at where it is when the window opens, and ask whether we are alive there. If we
are, the food waits, whatever tier asked for it.

Three things make that policy actually hold:

- **The window is measured from the fastest round trip, not the average.** The
  server compares `Date.now() - hitTime` to 120ms at consume time, so what it
  sees is our wait *plus* the trip. An average of 70 on a connection whose
  floor is 40 says "wait 50ms", and every packet that takes the fast path lands
  at 90 — inside the window — and is charged. RYN already records the floor as
  `SocketManager.minPingTime`; the window uses it, and adds the jitter rather
  than subtracting it.
- **Only a *confident* threat may spend a point.** The forecast carries three
  curves: expected (weighted, sizes the heal), worst (p ≥ 0.5, decides whether
  to heal) and sure (p ≥ 0.78, and nothing reads it but the shame rule). "They
  are next to me and the ground is free" is not a reason to pay the server.
- **The count grades the window.** `Player.updateHealth` runs the server's own
  rule on the health echo, so a change in the count is the server's verdict on
  the food just sent. A heal the module *believed* was free and that was charged
  anyway lengthens the window by a tick; a free one gives it back slowly. A heal
  it knew would be charged is not graded at all — grading those is a runaway,
  and it is what walked the count to the wall on a low-ping connection.

Two further consequences of reading the server's code rather than guessing:
shame is charged **per burst, not per food** (`hitTime` is zeroed by the first
consumable), so on the rare tick the module does pay, it stops rationing and
buys a full bar with the point; and an apple at full health while armed is a
free **-2**, because the shame block runs before the consume and the consume is
refused at full health before it spends the food.

The measured result, 900 ticks per run against a real weapon on its real
reload:

| | ping 20 | 45 | 70 | 100 | 140 | 200 |
|---|---|---|---|---|---|---|
| katana | 0 | 0 | 0 | 0 | 0 | 0 |
| bull polearm | 0 | 0 | 0 | 0 | 0 | 0 |
| bull daggers | 0 | 0 | 0 | 0 | 0 | 0 |

(final shame count; no deaths, no lockouts, no learned bias drift)

### The rest of it

Every damage source the client can see or infer goes on one threat list with an
amount, an arrival tick and a confidence: melee and secondary swings, spike
contact and approach, knockback into spikes, the spike ring, trap breaks,
poison on the real one-second loop, turret fire with a line-of-fire test and a
computed travel time, shots already in the air, dagger/bull bursts, musket,
musketbow, reverse insta, velocity tick, clown pressure, reflect gear — Spike
Gear, Sawblade and Corrupt X Wings push a fraction of our own raw weapon damage
back at us on the tick we choose to attack — and anything it cannot classify,
whose rhythm it learns and schedules. Named sequences *promote* the threats
already on the board rather than adding their sum again.

Two corrections to numbers this client was already carrying: the knockback
impulse in `Weapons[].knockback` is already `(0.3 + knock) × 111` and the old
code added another 33.3 to it, and a raised shield *replaces* the weapon-variant
multiplier rather than stacking with it.

Healing also has a packet reservation. `ModuleHandler.packetLimit` became a
getter over `packetLimitRaw - healReserve`, so every placement system in the
client — the placer, the placement engine, replace, preplace, spam preplace,
spike tick, retrap, `resendPlace` — stands aside for a forecast heal without
knowing the reservation exists, and the heal itself measures against the raw
allowance. The food hotkey routes through the module too, so holding it cannot
go behind the shame rule.

There is one switch, **Autoheal**, and it turns the whole thing on. It had
sub-switches for the shame guard, the drain, the reservation and the EMP swap;
none of them was a preference, each was part of the same decision, and turning
any one off left the other three reasoning against a rule that was no longer
true.

```sh
node tools/survival-tests.js
```

174 checks: the 37 scenarios the rebuild was specified against, the shame rule
across the ping range and every weapon class, the derived mechanics above, and
a 20,000-tick chaos run that randomises ping, packet pressure, enemy arrival
and departure, weapon and hat swaps, object id reuse, out-of-order state, trap
state and respawns, asserting no throw, bounded memory, and no shame lockout. The suite runs the shipped file's own bytes: the
harness slices the data tables and the module out of `Ryn_Type_2.user.js` and
evaluates them, so a change to either is a change to what is tested.

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
