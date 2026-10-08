# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the **Ryn Type 2** core with the Luna Client
features RYN never had, repaired against the game bundle it actually has to run
on and verified against it.

Build output: **`ReUp_Mix.user.js`**

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | Ryn Type 2 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation, truncated-HMAC frame prefix, per-frame xorshift mask, WebAssembly key mixer | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

Luna 1.1 predates the current transport entirely — it is a fork of the old
webpack `bundle.js` and cannot connect to the shipped game at all. So its code
could not be merged in; its features were ported onto the RYN core instead, and
everything else in RYN was left alone.

## The transport the game speaks now

Extracted from the shipped assets by `tools/extract-drivers.js` and recorded in
`drivers/game-drivers.json`.

The socket URL carries the build id — `?b=s16nvz` — and the server answers
`io-init` with `[socketId, seed, keyHex, mode, pinned]`. On a **pinned**
connection (`pinned === 1`):

```
key     = mixKey(hex(keyHex), seed)        // WebAssembly, from moomoo-protocol
tables  = shuffle(alphabets, seed, BUILD_SALT)
mask    = { c2s: word0(key) ^ 3266489909, s2c: word1(key) ^ 668265263 }
```

and every frame is masked:

```
c2s   sig = HMAC-SHA256(key, msgpack([opcode, args, ++seq]))[0..6]
      frame = sig || msgpack(...)        payload XOR xorshift32(mask.c2s ^ word0(sig))
s2c   frame XOR xorshift32(mask.s2c ^ imul(++received, 2654435761))
```

Three things here are new, and each one is a connection that silently stops
working if the client does not have it:

- **the key mixer** — the key is not the key the server sent; it is that key
  XORed with a byte stream from a one-function WebAssembly module. Sign with
  the unmixed key and every frame is rejected.
- **the frame sequence** — the c2s payload is `[opcode, args, seq]`, not
  `[opcode, args]`.
- **the per-frame mask** — applied in place, on a counter the session owns, so
  unmasking a frame the game is about to unmask itself corrupts both.

The alphabets also grew: 17 → 21 c2s names and 36 → 38 s2c names. The old
counts are the `legacyCount` fields, and they are what an **unpinned**
connection still uses, along with salt 1 and no mask.

## What this build fixes

`tools/check-hooks.js` runs the client's own hook list against
`src/game_index.js` exactly as shipped. Nine of the 71 did not bind.

### The four that name the transport

`cryptoSession`, `cryptoInbound`, `cryptoSign`, `cryptoOutbound` are what fill
in `RYN._enc` — the game's own signing function, hex reader, table builder,
mask splitter, keystream, `mixKey` and `BUILD_SALT`, for RYN's own sockets to
use. All four missed, for the reason the client's own comment predicts: the
obfuscator routes a call through a throwaway wrapper on some builds and not
others, so `hl(B,Ad)` is written `o["tU&W"](hl,B,Ad)` and a pattern pinned to
the first shape misses the second.

Rather than pin them to the second shape, each now accepts either — the wrapper
prefix is optional and the separator after the function name is `(` or `,`. All
thirteen fields resolve to real bindings instead of `null`. `fastSign` had the
same problem and is fixed the same way.

With them unbound, bots fell back to `RynWire` for everything and to capturing
the `moomoo-protocol` module for `mixKey` alone — one capture away from no bot
being able to join at all.

### `gameInit` — the one that stopped the game starting

`RYN.startGame()` fetches a captcha token and hands it to `RYN._gameInit`,
which this hook is what fills in. Its pattern was written against a 2024 shape
the bundle no longer has, so `_gameInit` stayed the empty stub it is declared
as and **starting the game from RYN's own menu did nothing at all**.

It is now anchored on the connect entry's own first statement — picking the
selected server and bailing out when there is none — which is the same site
`connectGuardRelease` already uses, and which carries a message unique in the
bundle.

### `RenderGrid` — the one that was deleting the wrong code

Each grid loop's condition grew a flag of the game's own ahead of the bound
check (`for(var n=…;fi&&n<oe;n+=f)`), and the pattern required the condition to
be the bound check alone.

This one is worth measuring rather than trusting: the hook checker reports how
much each rewrite moved. The 2024 pattern matched **924 characters** of this
bundle; the re-anchored one removes **116** — exactly the two loops.

### `nameColor`, `buildingTint`

`nameColor`'s tail required a `{color:…}` object that 2025 no longer builds; the
part being replaced is unchanged, so the tail is dropped. `buildingTint` and
`buildingTint2025` are two shapes of one site and only one can ever be present,
so the 2024 one is now only attempted when the 2025 one was not found — which
is why 71/71 bind rather than 70/71.

### The constants `learn()` stopped reading

`RynWire.learn()` reads the protocol constants off the bundle's own text. On
this bundle it found the alphabets and nothing else: its other anchor expects
salt, signature width and mode to be declared in one run ahead of the c2s
alphabet, and the bundle splits them across two statements. All three fell back
to the values written into the class.

They happen to be right, which is the problem — nothing said when they would
stop being. Each is now read from the code that uses it:

| | read from |
|---|---|
| transport mode | the `const` the alphabet declaration opens with |
| signature width | the offset the payload is written at, after the signature at 0 |
| legacy salt | the branch the alphabet slice is gated on |

and a value that cannot be found is reported instead of quietly assumed.
`tools/check-wire.js` checks this on an instance whose constants are wiped
first, so "it read them" and "it fell back to values that happen to match"
cannot be confused — which is how this went unnoticed.

### A key mixer to fall back on

RYN takes `mixKey` from the game's `moomoo-protocol` module and has nothing to
fall back on, so a build where that capture misses means every bot signs with
an unmixed key. The mixer is one WebAssembly function with no control flow, so
the build writes it out in JavaScript from `drivers/game-drivers.json`:

```
x = ((i + 1) * 2654435761) ^ seed
x = x * 3850160783;  x = x + 973754700;  x = x * 3252231511
…
return (x >>> 11) & 255
```

The disassembly is checked against the module during extraction and the result
is checked against it again by `check-wire.js`, so it cannot drift without a
verifier saying so. It is a fallback, not a replacement — the module's own
export is still preferred — and because it is pinned to one build id, the
runtime drift check says so out loud if the game is serving a different one.

## Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — RYN's `AutoPlacer` **is** Luna's placer,
  ported: Luna's function set under RYN's naming, rebuilt on RYN's spatial
  grid, with Luna's whole placer menu and then some. `_lunaExactPlacer` picks
  between the two decision sets — on restricts spike placement to Luna's
  original conditions, off adds RYN's extra heuristics.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — menu
  entries in Luna with no implementation behind them. Nothing to port.

## What the base already fixed

Three things this build used to patch are in Ryn Type 2 already, and the build
says so rather than failing on a missing anchor:

- `AutoPlacer._isItemLimit` reads the real group limit (it used to read
  `group.sandboxLimit || 99`, which made the cap 99 for everything without a
  sandbox limit, so the gate never fired).
- `ItemGroups[8]`, the platform group, carries `layer: 1` to match the bundle.
- The first-run beacon to a third-party webhook endpoint is gone.

---

## Layout

```
ReUp_Mix.user.js           the build output — this is the script to install
drivers/game-drivers.json  protocol + data tables extracted from the game assets
src/Ryn_Type_2.user.js     base client (input, unmodified)
src/Luna_Client_1.1.js     Luna client, kept for reference (input)
src/game_index.js          game bundle, as served: protocol, data tables, engine
src/game_vendor.js         game bundle, as served: msgpack codec, polyfills
src/game_protocol.js       the moomoo-protocol module: BUILD_ID, BUILD_SALT, mixKey
tools/deobfuscate.js       undo the obfuscator: strings, numbers, operator wrappers
tools/game-wire.js         the game's transport, by name and running
tools/extract-drivers.js   game assets      -> drivers/game-drivers.json
tools/verify-drivers.js    client tables    vs drivers/game-drivers.json
tools/check-wire.js        client transport vs the game's own functions
tools/check-hooks.js       client hooks     vs the bundle, as served
tools/build-reup.js        src/Ryn_Type_2.user.js -> ReUp_Mix.user.js
```

The game bundles are checked in **exactly as served**, not beautified. The hook
patterns are written against that text, so matching them against it is the
match the client will really make — no re-minification, no approximating the
obfuscator's output.

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
```

## Verification

```sh
node tools/verify-drivers.js     # data tables + the embedded manifest
node tools/check-wire.js         # the transport, function for function
node tools/check-hooks.js        # every bundle-rewrite hook
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (49), accessories (21), weapons (16), items (23), item
  groups (14), projectiles (6) and 42 scalar config keys all match
  `src/game_index.js`.
- **Transport** — the client's opcode tables, hex reader, mask split, both
  keystream seeds, keystream, frame signature and key mixer all agree with the
  game's own functions, over a spread of keys, seeds and every frame length up
  to two keystream rounds. `learn()` reads every protocol constant off the
  bundle rather than falling back.
- **Hooks** — 71/71 bind.

### Reading the bundle

`tools/deobfuscate.js` undoes three things the obfuscator does, on the text as
shipped: it resolves the string-decoder calls (four string arrays across the
two assets, 708 call sites), rejoins split literals, folds the
arithmetic-encoded numbers, and inlines the throwaway operator wrappers
(`i["UdUrE"](a,b)` → `a >>> b`, 180 of them).

Two guards, both of which have already caught a bug in this tooling:

- Every rewrite is handed to the real parser before anything is read out of it.
- The transport is evaluated **twice** — once from the full rewrite, once from
  the rewrite that stops before the operator pass — and the two are run against
  each other.

The second one exists because the first is not enough. The operator-unwrapper's
first version substituted a wrapper's parameters one after another, so
`function (o, s) { return o >>> s }` called as `(s, 7)` came out as `7 >>> 7`:
valid code, in the middle of the PRNG the opcode tables are shuffled with, and
in the SHA-256 the frame signature is built on. It parsed. It produced a
complete, plausible, wrong answer, and it was reported as drift in the
*client*. The cross-check turns that class of mistake into a failed extraction.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load: frame signature
width, transport mode, live opcode table size against the salted or legacy
count as appropriate, and the game's live build id against the one the
built-in key mixer is for. A change on the server side shows up as a console
warning instead of as packets that quietly stop being understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are cosmetic and
  naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; a mix should not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
