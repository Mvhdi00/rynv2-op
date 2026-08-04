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
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 sends plain
msgpack with no seed, no sequence number and no signature, so as shipped it
cannot connect to the current game.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

(Luna is closer to current than that table suggests — its *opcode names* are
already the ones the game uses, only the frame around them is stale. See
[Luna](#luna-1) for the build that closes that gap.)

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

---

## Luminary

`Luminary_Fixed.user.js` is a second, unrelated build: the luminary
userscript (onion / dreadful, based on wespire) brought onto the current
protocol.

Like Luna, luminary is a fork of the old webpack `bundle.js` — it deletes the
game's own script and runs its own copy of the client. Unlike Luna, its data
tables have not drifted: hats, accessories, weapons and items all diff clean
against `drivers/game-drivers.json`. Only the wire moved, so the fork could be
fixed in place rather than having its features ported off it.

### What was wrong

| | Was | Is |
|---|---|---|
| **Entry** | `@match ://*.moomoo.io/*`, no `@run-at` | scheme-qualified match, `document-start` |
| | removes `<script src=…bundle.js>` | removes the `/assets/index-*.js` + `vendor-*.js` modules and their `modulepreload` links |
| **Packet** | `[name, args]`, plain | `[opcode, args, seq]` behind a 6-byte truncated HMAC-SHA256 |
| | — | opcode alphabets permuted per connection from the `io-init` seed |
| | play starts on `onopen` | play starts on `io-init`, after negotiation |
| **Opcodes** | old names (`sp`, `33`, `ch`, …) | current names (`M`, `9`, `6`, …) |
| **Discovery** | `vultr` global, `/serverData` | `api.moomoo.io/servers` |
| | servers by index, `ip_<hash>.moomoo.io:8008/?gameIndex=` | servers by name, `<key>.<region>.moomoo.io` |
| **Captcha** | reCAPTCHA | Cloudflare Turnstile, `?token=cf:<token>` |
| **Boot** | `ht` flips when the page's reCAPTCHA tag calls `window.captchaCallback` | the build calls it once Turnstile is up |
| | widget renders into `#turnstileWidget` | renders into its own laid-out host |
| **Menu** | `#enterGame` had no `disabled` class | the page ships it disabled; the build clears it |
| | — | overlays only the current client owns are neutralised |
| **Tables** | every placement `limit` flattened to 99 | real limits + `sandboxLimit` |
| | mills carry no `turnSpeed` | restored — mills spin again |
| | five upgrades carry no `pre` | restored — upgrades need their prerequisite |
| | `shieldAngle` widened to `PI/2` | back to the bundle's `PI/3` |
| | `maxPlayers` 100 | 40 |
| **Sandbox** | flat cap of 99 for every group | `sandboxLimit \|\| max(limit * 3, 99)` — 299 for mills, boosters, teleporters |
| | tooltip counts against the normal limit | counts against the sandbox cap |

The `bundle.js` line is why nothing worked at all: the game stopped shipping
it, so the fork removed nothing and both clients ran at once.

The boot rows are why it then hung on *Loading…*. The fork gates connecting on
`lt && ht`; `lt` comes from `window.onload`, but `ht` only flips when
`window.captchaCallback()` fires, and the page used to fire that from its
reCAPTCHA `<script>` tag. Nothing calls it now. Since the fork hides the
loading screen inside the connect callback, no connection means the screen
never lifts. Rendering Turnstile into `#turnstileWidget` would not have helped
either — that node lives inside the menu, which stays `display:none` until
that same callback runs, so the widget would never lay out and never issue a
token.

Then the menu came up dead. Both clients share `#enterGame`, but the page now
ships it with `class="disabled"` and the current client is what takes the class
off, on the turnstile token. The fork predates that class entirely, so it bound
its handler to a button CSS had switched off. The build clears the class, and
neutralises the handful of overlays the current client owns and the fork never
touches — `touch-controls-*` among them, which the current client uses as its
full-screen mouse capture layer.

One more boot hazard: the fork reads `#featuredYoutube` unguarded, two lines
before it initialises `lt`/`ht`. The current client never touches that element,
so if the page dropped it the whole script would abort before it could do
anything. The build diffs the element ids the fork reads against the ones the
shipped client reads and stubs anything in the gap.

### The opcode rename

Both alphabets were renamed wholesale but **not reordered**, so the old names
map onto the new ones position for position — `sp`→`M`, `33`→`9`, `ch`→`6`,
`c`→`F`, `13c`→`c`, and so on for all 17 c2s and 36 s2c opcodes.

That means the translation lives entirely in the socket module: the ~12k lines
of game and mod code above it keep speaking the old names, and nothing else in
the fork had to be touched.

### Sandbox

The bundle resolves the placement cap per group:

```js
inSandbox ? group.sandboxLimit || Math.max(group.limit * 3, 99) : group.limit
```

The fork capped everything at a flat 99 in the gate, and showed the plain
non-sandbox limit in the item tooltip. So mills, boosters and teleporters
stopped at 99 where the server allows 299, and the counter read `x/7` for a
mill instead of `x/299`.

The resource half of the bundle's `canBuild` needed no port — the fork's
`hasRes` already returns `true` in sandbox.

### The rest of the audit

Everything else was diffed field by field against the bundle and came back
clean: weapons (16), hats (46), accessories (21), item groups (14), all 44
config scalars and all 7 config tables (`weaponVariants`, `skinColors`,
`resourceTypes`, the scale tables). Items match too once the two dropped
fields are back.

The fork keeps a few fields the bundle does not ship — `consume` on the three
foods, `range`/`speed` on one projectile — and those stay, because its own
code reads them and nothing on the wire depends on them.

`shieldAngle` is the one deliberate change reverted. The fork's own comment
reads *"was divided by 3"*, so widening it was intentional, but the server
still resolves shield coverage at `PI/3` — a client at `PI/2` mispredicts
every block. Change it back in the source if you want the fork's behaviour.

Not carried over: `MAX_ATTACK`, `MAX_SPEED`, `MAX_TURN_SPEED`,
`MAX_SPAWN_DELAY` and `DAY_INTERVAL`. The fork never reads any of them, and in
the shipped client `DAY_INTERVAL` only appears in two expressions whose results
are discarded.

### Verification

```sh
node tools/build-luminary.js
node tools/verify-luminary.js
node --check Luminary_Fixed.user.js
```

`verify-luminary.js` slices the game's own frame code out of
`src/game_index.js` and the shipped shim out of the built userscript, then runs
them side by side over 500 random seeds and payloads. The permuted opcode
tables and every signature byte agree. It also checks that all 17 opcodes the
fork sends translate, that all 36 handlers it registers are reachable, that
every data table and config value matches the bundle field by field, and that
the entry and menu fixes are all still in place.

What that does **not** cover is a live connection — the wire format is verified
against the shipped client, but no packet has been put on a real server from
here.

---

---

## Luna

`Luna_Fixed.user.js` is the third build: Luna 1.1 on the current transport.

Luna is a bundle fork like luminary but a much later one, and the audit came
back far cleaner. Its **opcode names are already current** — all 17 c2s and
all 36 s2c match the shipped alphabets exactly, which is independent
confirmation of the mapping the luminary build had to derive. Its weapons,
hats, accessories, projectiles and item groups diff clean too, item groups
included: it already carries the real limits and `sandboxLimit`.

Luna also does not delete the game's script. It lets the real client run,
replaces `window.WebSocket` to capture the address that client dials, and
connects its own socket there — so discovery and the captcha are handled by
the real client and never needed porting.

### What was wrong

| | Was | Is |
|---|---|---|
| **Packet** | plain `[name, args]` | `[opcode, args, seq]` behind a 6-byte truncated HMAC-SHA256, permuted from the `io-init` seed |
| | play starts on `onopen` | play starts on `io-init`, after negotiation |
| **Hook** | replaces `window.WebSocket` at document-idle | installs the stub at `document-start`, defers the client to `DOMContentLoaded` |
| **Sandbox** | `inSandbox = process.env.VULTR_SCHEME === "mm_exp"` | hostname, the only signal that resolves in a browser |
| | `canBuild` gated at the normal limits | the bundle's `sandboxLimit \|\| max(limit * 3, 99)` |
| | placer read `sandboxLimit \|\| 99` | same per-group cap |
| **Tables** | five upgrades carry no `pre` | restored |
| **Config** | `maxPlayers`/`maxPlayersHard` `Infinity` | 40 / 50 |

The hook row is the one that stops it dead. `window.WebSocket` is now frozen:

```js
const kn = window.WebSocket;
Object.defineProperty(window, "WebSocket", { value: kn, writable: !1, configurable: !1 });
```

That runs during the client's own module execution. Module scripts are
deferred, so it happens just before `DOMContentLoaded` — after a
document-idle userscript would have run. The stub therefore goes in on its own
at `document-start`, ahead of the freeze, and the rest of Luna waits for a DOM
it can touch. The stub carries a prototype `send`, because the client reads
`window.WebSocket.prototype.send` off it at module scope and calls it later.

`inSandbox` is worth a note: Luna's is a server-side expression, always false
in a browser. The shipped client's own is `Ut && {}.IS_SANDBOX`, equally dead
— the one place it shows sandbox caps it uses the hostname instead, which is
what this build keys off.

`deathFadeout` is left at Luna's `0` rather than the bundle's `3000`. It is a
deliberate change and client-side only, so nothing disagrees with the server
over it.

### Verification

```sh
node tools/build-luna.js
node tools/verify-luna.js
node --check Luna_Fixed.user.js
```

Same frame-code comparison as the luminary build, plus every table, every
config scalar, the sandbox caps, and the ordering that keeps the stub ahead of
the freeze.

---

## Layout

```
ReUp_Mix.user.js          the ReUp Mix build output
Luminary_Fixed.user.js    the luminary build output
Luna_Fixed.user.js        the Luna build output
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Luminary_v3.js        luminary userscript (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-luminary.js   src/Luminary_v3.js   -> Luminary_Fixed.user.js
tools/verify-luminary.js  built script vs. the game bundle's own frame code
tools/build-luna.js       src/Luna_Client_1.1.js -> Luna_Fixed.user.js
tools/verify-luna.js      built script vs. the game bundle's own frame code
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
