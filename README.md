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
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
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

---

# novastorm 1.4 (ryn)

`novastorm_1.4_ryn.user.js` is a second, separate userscript kept in this repo
— the novastorm 1.4 client, not the ReUp Mix build. Nothing above applies to
it; it has its own menu, its own protocol layer, and its own placer.

## Replace — removed

The Whiteout-style replacer is gone from the script: the `rynUpdateSnapshot` /
`rynReplacePick` / `rynDoReplace` block, both of its call sites in
`getPredictObjects`, the `replace` config key, the **Placers → Preplacer →
Enable Replace** toggle, and its share of the placers hotkey (which now toggles
Auto Place + Preplace only). Saved settings are also filtered on load, so a
`replace` key left in an old `localStorage` entry cannot put the flag back.

## Hit On Spike — added

**Combat → Instakills → Hit On Spike** (on by default, `hitOnSpike`).

Fires the bull hat swing with the turret gear on top when the enemy is on a
spike and reachable:

1. **He is on the spike and I can reach him.** One of our spikes is under him
   (now or at his predicted position), or my next swing knocks him into one,
   and he is inside primary range both where he stands and where he is heading
   — so the hit lands this tick.
2. **His trap just broke and cannot be replaced.** The trap that was holding
   him is destroyed, he is loose, no placeable trap slot would catch him again
   (including the trap item being at its limit), but a spike of ours is next to
   him — knock him into it at once instead of waiting on a re-trap that is not
   coming. The spike search runs on a wider margin here, and the window stays
   open for a few ticks after the break.

Both go out through the instakill queue the script already uses: `"turret"`
equips the turret gear (hat 53) so its shot fires, `"primary"` equips the bull
hat (hat 7) and swings. The turret leg costs a tick, so it is only taken while
he is pinned on the spike and cannot walk away; on a knockback, or with no
turret shot ready, the bull hit goes out on the tick it was detected.

```sh
node tools/test-hit-on-spike.js   # geometry + gating cases for the block
node --check novastorm_1.4_ryn.user.js
```

## Performance — added

New **Performance** tab in the menu.

### Unlock FPS (`fpsUnlock`, on; `fpsLimit`, default 240)

`requestAnimationFrame` is paced to the monitor, so the game loop could never
run faster than the panel. The unlock drives the same loop from a
`MessageChannel` port instead — a macrotask with no vsync gate and none of
`setTimeout`'s 4ms clamp — so frames go out as fast as the main thread can
produce them and the counter is no longer pinned to the refresh rate.
`fpsLimit` paces the loop (0 = uncapped). Two deliberate exceptions: the first
frames still go through `requestAnimationFrame`, because that is what makes the
unpatch layer stop the bundle's own renderer painting over the mod; and a hidden
tab is paced down to 60 whatever the setting says — `rAF` would have stopped
there entirely, and a background tab eating a core is the one thing this must
not do.

The FPS readouts now count loop frames instead of screen refreshes, so the
number shown is the rate the game is actually running at.

### Light Render (`lightRender`, on)

Quality-neutral render work, nothing about what gets drawn changes:

- The five layer passes each walked the whole `gameObjects` array — destroyed
  entries included — so a map full of bases was scanned five times a frame to
  draw it once. The active objects are now collected once at the top of the
  frame and bucketed by layer; only the layer 0 pass still takes the full list,
  because it is the one that has to call `update()` on every active object.
  `tools/test-performance.js` checks each layer draws exactly what the old full
  pass drew, in the same order.
- The spike markers skip objects that are off screen.
- The minimap — a 300×300 canvas cleared and fully redrawn every frame — runs at
  30Hz, with the skipped delta carried over so its ping animation keeps its
  speed.
- The main canvas is created with `alpha: false` (the game paints its own
  background every frame) and `desynchronized: true` (takes a frame of input lag
  out). Unknown hints are ignored by the browser.
- The FPS/ping overlay writes to the DOM when its text changes rather than once
  per frame.

Turning the toggle off puts the original five full passes and the per-frame
minimap back.

### Ping Stabilizer (`pingStabilizer`, on)

The round trip itself is the network's business; these two things were not:

- Ping is sampled every second instead of every 2.5, over a rolling 20-sample
  window, so the readout follows the line instead of lagging it and the average
  no longer jumps when the buffer is wiped. Jitter (the spread of the window) is
  shown next to it.
- The placer's tick timer ran on the raw last round trip, so one spike moved the
  placement window by that many ms. It runs on the median of the recent samples
  now, clamped into the 111ms tick — a single spike no longer shifts when the
  packets go out. Turning the toggle off restores the raw value.

```sh
node tools/test-performance.js   # scheduler, ping stats, render-list equivalence
```
