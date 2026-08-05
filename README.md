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
Dune_Mod_Fixed.user.js    Dune's mod 0.1.0, repaired
Cowgame_Fixed.user.js     cowgame v7, repaired
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
src/mods/                 the two old-bundle mods, unmodified (input)
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/mod-transport.js    emits the protocol-correct io-client + prologue
tools/fix-mods.js         src/mods/*.js -> *_Fixed.user.js
tools/verify-transport.js emitted transport vs. the game bundle's own
tools/verify-mods.js      built mods: handshake + table diff
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

# Old-bundle mod repairs

Two other mods live here — **Dune's mod 0.1.0** and **cowgame v7** — and they
are the same kind of thing Luna is: forks of the pre-2024 webpack `bundle.js`,
shipped as userscripts that hijack the page's WebSocket and run their own copy
of the game. Neither one broke because of anything it does. The game moved out
from under both of them, in four places.

Build output: **`Dune_Mod_Fixed.user.js`**, **`Cowgame_Fixed.user.js`**

## What was wrong

### 1. The packet layer

Both mods still had the original io-client:

```js
send:      socket.send(msgpack.encode([name, args]))
onmessage: events[parsed[0]].apply(undefined, parsed[1])
io-init:   socketId = data[0]
```

The current server negotiates the transport in `io-init`, which now carries
`[socketId, seed, keyHex, mode]`. When `mode === 1` — which is what the live
server sends — every client frame has to be:

```
[ 6-byte truncated HMAC-SHA256 over the body ] [ msgpack([opcode, args, seq]) ]
```

`opcode` is the packet name's index in a per-connection permutation of a fixed
17-entry alphabet, seeded from `seed`; server frames come back numbered out of
the matching 36-entry alphabet. So the unpatched mods sent frames with no
signature, no sequence and a string where an integer belonged — all dropped —
and every packet they received landed on `events[<number>]`, which is
`undefined`, so `events[type].apply(...)` threw on the first server message.

The io-client in both is now a re-implementation of the bundle's own `Co`,
`Oi`, `Po`, `Vt`, `Ao`, `Eo` and `Ro`.

### 2. Entry

The old io-client fires the connect callback from `onopen`. That is before
`io-init` arrives, so `enterGame()` sent the spawn packet before there was an
opcode table to encode it with. Even with the signing fixed, the player would
connect and never spawn. The shipped bundle calls back from `io-init` instead —
guarded so it fires exactly once — and so do these now.

### 3. The WebSocket lock

This is why the mods appeared to do nothing at all rather than merely
misbehave. The bundle now runs an anti-userscript pass at load:

```js
Object.defineProperty(window, "WebSocket",
    { value: <native>, writable: false, configurable: false })
```

Both mods hook `window.WebSocket` by plain assignment, from inside the bundle,
at `document-end` (cowgame) or `document-idle` (Dune) — after the lock. The
assignment silently does nothing and the mod never sees a connection.

The fix is to get there first. Each script now has a `document-start` prologue
that captures the native constructor, installs its own hook, and locks the
property itself; the bundle reads `window.WebSocket` into a local *before* it
locks it, and its lock is inside a `try/catch`, so an already-locked property
is a no-op it swallows either way.

The mod body still runs at DOM-ready, because it resolves `#enterGame` and
friends at module scope. That leaves a window where the game's server lookup —
a `fetch` — can construct the socket before the mod has registered, so the
prologue queues the address and replays it on registration rather than falling
back to a native socket and quietly handing the connection to the vanilla
client.

### 4. Table drift

| | Was | Game |
|---|---|---|
| Dune: `clientSendRate` | 20 | 5 |
| Dune: `maxPlayers` / `maxPlayersHard` | 50 / 60 | 40 / 50 |
| cowgame: `maxPlayers` / `maxPlayersHard` | 60 / 70 | 40 / 50 |
| cowgame: `skinColors` | 11 entries | 10 |
| cowgame: weapon 3 "short sword" `src` / `yOff` | `samurai_1` / 59 | `sword_1` / 46 |
| both: `MAX_ATTACK`, `MAX_SPAWN_DELAY`, `MAX_SPEED`, `MAX_TURN_SPEED`, `DAY_INTERVAL` | absent | present |

`clientSendRate` is the live one: at 20 the mod put out four times the movement
frames the server expects for the same input. The extra skin colour is an index
the server has no entry for. Short sword had picked up the katana's sprite and
offset — index 3 carrying index 4's values.

The five `MAX_*` keys are mirrored for parity only; the bundle multiplies them
by a factor it currently pins to `0`, so they are inert today.

### Dead references

- Dune `@require`d msgpack from greasyfork and cowgame from **rawgit.com**,
  which has been shut down since 2019. Neither is used: the only consumer is
  the io-client, and it resolves msgpack-lite out of the bundle itself. Both
  lines are dropped.
- cowgame gated its **entire body** on `window.r`, supplied by a
  `@require`d `cow.js` on a CodeSandbox host. With that host gone `window.r` is
  `undefined` and the very first statement throws, so nothing ran. The check is
  kept where the data is present and skipped where it is not.
- cowgame's chat profanity filter was keyed on `type == "ch"` and its clan-name
  padding on `type == "8"`. Both packets were renamed (`"6"` and `"L"`), which
  cowgame already sends — so neither branch had been running. Retargeted.

## Building the repaired mods

```sh
node tools/fix-mods.js          # src/mods/*.js -> *_Fixed.user.js
node tools/verify-transport.js  # emitted crypto/opcode tables vs. the bundle's own
node tools/verify-mods.js       # end-to-end handshake + table diff
node --check Dune_Mod_Fixed.user.js
node --check Cowgame_Fixed.user.js
```

`verify-transport.js` lifts the game's `Po`/`Eo`/`Ro`/`Vt`/`Ao` straight out of
`src/game_index.js`, runs them in a sandbox next to the emitted ones, and
compares: 13,568 opcode-table entries across 256 seeds, plus SHA-256, HMAC and
the 6-byte truncation over message lengths that straddle both the SHA block
boundary and the HMAC key boundary. This matters because a signature computed
with the wrong key schedule, or a table off by one swap, looks exactly like a
working client until the server drops every frame — which is the state the mods
were already in.

`verify-mods.js` loads the rebuilt io-client out of each built userscript with
the bundle's own msgpack-lite, drives a real handshake through it, and takes the
resulting frame apart against the game's opcode table and HMAC. It also confirms
the callback is withheld until `io-init`, that the sequence advances per frame,
that a numeric server opcode reaches the right handler, that an unhandled opcode
does not throw, that the session is dropped on close, and that every packet name
either mod sends exists in the game's c2s alphabet.

## Still there, deliberately

The bundle's anti-userscript pass does three other things, none of which stops
the mods working and none of which is touched:

- a red banner if it detects a userscript manager,
- a `debugger` statement on a 1s interval (only bites with devtools open),
- F12 / Ctrl-Shift-I / Ctrl-U keydown suppression.
