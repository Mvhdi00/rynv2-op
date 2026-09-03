# Game rules, verified against `src/game_index.js`

These are facts about the shipped game bundle, not about any client's opinion of
it. Every entry names the exact source line(s) so you can re-check after a bundle
update. `src/game_vendor.js` is the msgpack codec + polyfills the bundle decodes
frames with; it has no game rules of its own.

## Collision: `ignoreCollision` and traps (`game_index.js:933-943`)

```js
this.checkCollision = function(h, u, p) {
  ...
  if (u.ignoreCollision)
    u.trap && !h.noTrap && u.owner != h && !(u.owner && u.owner.team && u.owner.team == h.team)
      ? (h.lockMove = !0, ...) : ...
```

An object with `ignoreCollision` does not push a player at all, **except** a trap
(`u.trap`), which still sets `lockMove` on anyone standing on it who is not its
owner and not on the owner's team. Practical consequence: **a player is never
blocked by their own traps**, while spikes (which do not set `ignoreCollision`)
block everyone including their owner. If you're writing placement or escape logic,
this is the one exception to "ignoreCollision things don't matter for movement."

There is no layer-based filter in the collision path — every active object in the
grid gets collision-checked against a player each tick.

## `ItemGroups[group].layer` drives `PlayerObject.layer` (`game_index.js:991`, `:1420-1421`)

```js
w.layer = P || f.layer,        // :991
...
this.layer = this.group != null ? this.group.layer : ...   // :1420-1421
```

An item's `layer` is read straight from its `ItemGroups` entry onto the placed
object, and collision/placement logic keys off `PlayerObject.layer` from there —
not off the item id or type directly. **This is not hypothetical**: RYN v4's own
`ItemGroups[8]` (the platform group) shipped with `layer: -1` where the real
bundle has `layer: 1`, so RYN treated placed platforms as a pass-under layer like
traps and boost pads. Fixed in `tools/build-reup.js` ("Driver correction", the
`edit()` call around line 107). If you touch anything layer-sensitive, diff the
client's `ItemGroups` table against `drivers/game-drivers.json` — don't trust
either one from memory. `node tools/verify-drivers.js` automates this diff.

## Tick rate: `1e3 / 9` ≈ 111.1 ms

`SocketManager.TICK = 1e3 / 9` is defined identically in two places in
`src/RYN_Client_v4.js` (lines 6250 and 7356) — it is a client-side constant the
userscript maintains to match the server's cadence, not something read out of
`game_index.js` at runtime. Some client timing code doesn't reference the
constant at all and just hardcodes the literal, e.g.
`Math.max(1, 111 - minPingTime)` in the placement/retrap timers
(`RYN_Client_v4.js:12817`, `:13539`). If you change the tick assumption, grep for
the bare number `111` as well as `SocketManager.TICK` — both exist in the
codebase for the same quantity.

## Protocol handshake (`game_index.js:415-445`, `drivers/game-drivers.json`)

The first frame after connecting is an `"io-init"` message (checked at
`game_index.js:428`). Its payload carries a per-connection seed and key:

```js
if (m === "io-init") {
  s.socketId = g[0],
  g[3] === Ht ? Z = { mode: Ht, key: Ro(g[2]), tables: Po(g[1] >>> 0), seq: 0 } : Z = null,
  ...
```

`Po(g[1] >>> 0)` derives the per-connection c2s/s2c opcode permutation from a
seed; `Ro(g[2])` derives the per-connection signing key. `drivers/game-drivers.json`
records the extracted, verified shape of this: `protocol.signatureBytes: 6`,
`protocol.encryptedMode: 1`, `protocol.tableSalt: 1`, plus the full `c2sAlphabet` /
`s2cAlphabet` arrays. A client that doesn't speak this handshake (`Luna_Client_1.1.js`,
which predates it — see `references/client-differences.md`) cannot connect to the
current game at all; there is no fallback path in the bundle for an old client.

## What to re-check after a bundle update

`tools/extract-drivers.js` regenerates `drivers/game-drivers.json` from
`src/game_index.js` and `src/game_vendor.js`. Run it first, then
`node tools/verify-drivers.js` and `node tools/check-hooks.js` to see what drifted
before touching any client code — see `references/build-discipline.md`.
