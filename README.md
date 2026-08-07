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

# RYN Client v5

`RYN_Client_v5_OWNER.user.js` is the readable, edit-me build.
`RYN_Client_v5_PLAYER.user.js` is derived from it and is what gets handed out.

```
tools/build-player.js     OWNER -> PLAYER (name tag, RYN_ROLE, owner-only rows)
tools/obfuscate.js        renames identifiers, encodes every string
tools/strip-comments.js   removes JS comments, keeps the userscript header
tools/e2e-hooks.js        boots a build in a browser against the real bundle
```

## Build

```sh
node tools/build-player.js
node tools/obfuscate.js RYN_Client_v5_PLAYER.user.js
```

`build-player.js` changes exactly three things and fails loudly if any of the
three anchors is missing or ambiguous, so the two builds cannot drift apart:
the `@name` tag, `RYN_ROLE`, and the owner-only **Mark RYN Players** row in
Visuals.

`obfuscate.js` runs two passes. Terser first (`compress: false` — renaming only,
nothing rewrites the logic), which packs the file and mangles names including the
two top-level ones. Then javascript-obfuscator, which moves every string literal
into a base64-encoded, rotated, shuffled array behind wrapper functions, renames
every local to a hex name, and rewrites object keys as computed lookups. Both
passes are seeded, so the same input always produces byte-identical output.

Nothing readable survives except two things that cannot be touched: the
userscript metadata block, which Tampermonkey parses, and the regex literals,
which *are* the bundle-rewrite hook patterns. `obfuscate.js` re-scans both sides
and refuses to write if a single regex literal moved.

Off on purpose: `controlFlowFlattening` and `deadCodeInjection` cost real frame
time in a client that hooks the render loop, `stringArrayCallsTransform` added
half a megabyte and a wrapper call in front of every string read, and
`debugProtection` would fight whoever maintains the build.

## Verification

```sh
node tools/check-hooks.js RYN_Client_v5_OWNER.user.js
node tools/verify-drivers.js RYN_Client_v5_OWNER.user.js
node --check RYN_Client_v5_OWNER.user.js

node tools/e2e-hooks.js RYN_Client_v5_PLAYER.user.js   # works on obfuscated builds
```

The first three want the **pre-obfuscation** build: `check-hooks.js` locates the
`Regexer` class by name, which the obfuscated player build no longer has.

`e2e-hooks.js` answers the question the others cannot — *does this build, as
shipped, still rewrite the bundle?* It serves a fake moomoo.io whose bundle is
`src/game_*.js`, loads the client at document-start the way a userscript would,
lets it discover the script tag, fetch it and rewrite it, then intercepts the
`Function()` call the client hands the result to and checks the rewritten source
for all 27 injections. No game needs to run, and it does not care what anything
in the client is named.

41/41 hooks bind, including the four that drive the world tint:

| Hook | What it rewrites |
|---|---|
| `objectAlpha` | scales the per-object `globalAlpha` in the object loop |
| `buildingTint` | swaps the item sprite for a tinted copy |
| `resourceTint` | same, for trees / bushes / rocks / gold |
| `animalTint` | routes animal draws through `_drawAnimal` |

The tint itself is a per-sprite cache: each sprite is drawn once into an
offscreen canvas and overlaid with purple through `source-atop`, so the fill
lands on the sprite and not on the empty space around it. Transparency is a
separate `globalAlpha` multiply, which is what the **Tint Transparency** slider
in Visuals drives (0% solid, 100% invisible).

## RYN Link

Neither build says anything on its own. Nothing is sent on spawn and nothing is
sent on a timer — the check runs only when you type it.

Type one of `RYN_LINK.ask` in chat and every RYN build in the lobby answers with
`RYN_LINK.reply`, which records that player in `RYNPresence` and draws their name
red. Defaults:

```js
ask:   [ "!ryn!", "hi" ],   // what you type, by hand
reply: "!ryn?"              // what a RYN build answers
```

Matching is exact, so `hi guys` does not count as `hi`. An answer is never read
as a question, so two RYN players cannot bounce replies off each other. A player
answers at most once per 6s however many times the check is typed, and never
answers its own.

`hi` is in the list because it reads as ordinary chat, but it costs stealth: any
stranger who types it makes every RYN build in the lobby answer. Cut it from
`RYN_LINK.ask` if that matters more than looking innocuous.
