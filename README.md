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
ReUp_Mix.user.js          the build output — this is the script to install
Whiteout_Abdo.user.js     the Whiteout client, repaired against the same bundle
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Whiteout_Abdo_v4.js   Whiteout v4 as received, kept for reference (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/verify-whiteout.js  Whiteout's tables + transport vs. the game bundle
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

---

# Whiteout (hanabira / nexoos)

`Whiteout_Abdo.user.js` is the Whiteout v4 client — a second, unrelated
userscript — repaired against the same bundles in `src/`. It is not built from
RYN and shares no code with the mix; it is checked in here because it is
verified against the same drivers.

Unlike RYN, Whiteout does not rewrite the game bundle. It lets the bundle run,
kills its render loop (`window.requestAnimFrame`), draws `gameCanvas` itself,
and rides the bundle's socket. Everything below follows from that.

## What was broken

### The transport

Whiteout spoke the old wire format: `msgpack([type, args])` with single-letter
opcodes, sent raw. The shipped game negotiates a per-connection opcode
permutation on `io-init`, numbers every client frame with a sequence counter,
and prefixes it with 6 bytes of truncated HMAC-SHA256. Nothing Whiteout sent
was parseable by the server, and nothing the server sent was parseable by
Whiteout — `s2c` types arrive as permuted integers, and its handler table is
keyed by letters.

The client now carries the bundle's transport verbatim: SHA-256, the HMAC
construction, the seeded Fisher-Yates that derives both alphabets from the
`io-init` seed, and a msgpack codec written to match `src/game_vendor.js`
byte-for-byte. Every socket gets its own crypto context, so the bot sockets
are framed correctly too.

Outgoing frames are re-signed with a single counter owned by the client, so the
sequence stays contiguous across both the bundle's packets and Whiteout's own
— dropping a packet in the filter no longer leaves a hole in the sequence.

### The entry point

Two separate problems, both fatal before a frame was ever sent.

**The hook was installed too late.** The bundle captures
`WebSocket.prototype.send` and the `WebSocket` constructor at module scope
(`src/game_index.js:34-35`), before any `document-end` userscript runs. A
prototype patch applied afterwards is never called, so `WS` was never assigned
and the message listener was never attached. The script is now `@run-at
document-start`: it patches the prototype and the constructor before the bundle
reads them, captures `io-init` from the constructor hook (which fires before
the bundle assigns `onmessage`), and defers its own body until `window.config`
and the game DOM exist.

**The body threw at load.** `adCard.remove()` on line 2573 — `#adCard` and
`#promoImgHolder` no longer exist in the page, so this was a `TypeError` at top
level that killed every statement after it. The `$(...)` calls near the end
were a second one: jQuery is not on the page any more. Both are gone; DOM
lookups that may miss are guarded, and the jQuery calls are plain
`querySelectorAll`.

### Everything else

| | |
|---|---|
| **msgpack** | Was fetched from Greasy Fork at runtime with a `<script>` tag. Now inlined, and checked against `src/game_vendor.js`. |
| **Argument shapes** | Whiteout appends internal flags and caller labels to its packets (`packet("9", dir, 1, "sendMoveDir")`). Only `"D"` was trimmed before sending. The wire layer now shapes every opcode to the arity the bundle uses, padding with nil, so traffic matches the vanilla client. |
| **Bot sockets** | Sent the pre-permutation opcodes `a`/`G`/`d` (move / select / attack) and read `setupGame` as `"1"`. Remapped to `9`/`z`/`F` and `C`. |
| **`skin: "__proto__"`** | The old cyan-skin exploit, sent on every spawn — including from the bots, unconditionally. Spawn now clamps to a real index. See below. |
| **Sprite paths** | `.././img/`, `./../img/` and absolute `https://moomoo.io/img/` were mixed; the bundle uses `./img/`. Unified. |
| **Item limits** | Sandbox was hardcoded to 299/99/296 at four sites. Replaced with the bundle's rule, `sandboxLimit \|\| max(limit * 3, 99)` in sandbox and `limit` outside it, and the three missing `sandboxLimit` fields were added to the group table. |
| **`tmpObj` leaks** | `addPlayerToList` read `tmpObj` — never declared in that scope. It threw on the first `updatePlayers`, i.e. immediately after spawn. A second site assigned to an undeclared `tmpObj` inside the projectile loop. |
| **`receiveChat`** | Dereferenced the sender before checking it resolved, so a message from an unknown sid threw. |
| **`packet("B")`** | `B` is not a c2s opcode; the call was a no-op prank payload. Removed. |
| **Userscript banner** | The bundle detects extension managers and injects a `#userscript-warning` bar. Removed on sight. |

### One deliberate behaviour change

Whiteout sent `skin: "__proto__"` when the player picked the 11th skin colour —
a colour it adds client-side that the server's table does not have. That is a
long-patched exploit, and a bad value on the one packet that has to succeed. The
spawn packet now clamps `skin` to the range the bundle actually ships, captured
before Whiteout extends the list. The extra colour still renders locally; it is
no longer sent. **If you want the exploit back, it is one line in the `"M"`
branch of `outgoing`.**

## Verification

```sh
node --check Whiteout_Abdo.user.js
node tools/verify-whiteout.js
```

`verify-whiteout.js` instantiates the client's `Items` and `Store` classes in a
sandbox and diffs them field-by-field against `drivers/game-drivers.json`, then
checks the transport constants, the sprite paths, and that every opcode the
client sends or handles exists in the bundle's alphabets.

Current state: item groups (14), weapons (16), items (23), projectiles (6),
hats (46) and accessories (21) match the bundle on every field including
`name`, `desc` and `src`; 17 outgoing opcodes and 34 `s2c` handlers all
resolve; signature width, transport mode, table salt and both alphabets are
present.

Beyond the static check, the transport was exercised in a headless browser
against the bundle's own codec: frames the client emits are decoded and their
HMACs re-derived with the functions lifted out of `src/game_index.js` and
`src/game_vendor.js`, and the client is driven through connect, spawn, a full
`s2c` message sweep, real keyboard and mouse input, and every menu control.

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
