# The 2025 game update, and what it did to RYN

The game shipped a new bundle (`index-cfaab428.js` + `vendor-a3a301f0.js`).
RYN works by rewriting that bundle with ~54 regex patches, so a bundle change
is a RYN change whether anyone edits RYN or not.

```
node harness/ryn-hooks-check.js      # every hook: does it match, does it resolve
node harness/ryn-protocol-2025.js    # the wire format, read out of the new bundle
python3 harness/ryn-2025-mutate.py   # 17 mutations, all caught
```

---

## The fatal one: the client killed the game at load

`exposeCryptoFns` injected, eagerly, at byte ~35,000 of the bundle:

```js
RYN._enc = { Eo: Eo, Hi: $1, jt: jt, Po: Po, Ro: Ro }
```

Those five names came from the 2024 bundle. In the new bundle **all four of
`Eo`, `jt`, `Po`, `Ro` still exist** — as a keybind map, the Turnstile token, a
DOM button and an array — and every one is declared with `let`/`const` *later*:

| name | declared at | injection at |
| --- | --- | --- |
| `Eo` | 46,017 | 35,036 |
| `Ro` | 128,135 | 35,036 |
| `jt` | 137,211 | 35,036 |
| `Po` | 143,675 | 35,036 |

Reading a `let` binding before its declaration is a **TDZ ReferenceError**,
thrown while the rewritten bundle is still evaluating. Not one broken feature —
the whole game dies at load. The script installs, the menu never works, and
RYN's own logging says nothing.

Two changes make that unrepeatable: `_enc` is now a **lazy getter** (names
resolve when a bot first sends, by which time every declaration has run) wrapped
in **try/catch** (a future rename degrades the bot path instead of taking the
client down).

## The wire format moved

Read out of the new bundle, not assumed:

| | 2024 | 2025 |
| --- | --- | --- |
| signature width | 6 bytes | 6 bytes |
| encrypted mode | 1 | 1 |
| **c2s opcodes** | 17 | **21** — added `T R A V` |
| **s2c opcodes** | 36 | **38** — added `W F` |
| **key** | `keyFromHex(hex)` | `pinned ? mixKey(keyFromHex(hex), seed) : keyFromHex(hex)` |
| **opcode tables** | `tables(seed)` | `pinned ? tables(seed, BUILD_SALT) : tables(seed)` |
| **masking** | none | every frame XOR-masked, keyed on a per-message counter |
| **io-init** | `[id, seed, hex, mode]` | `[id, seed, hex, mode, pinned]` |
| **socket URL** | `?token=` | `?b=<BUILD_ID>` **and** `?token=` |

`BUILD_ID`, `mixKey` and `BUILD_SALT` come from a new module the bundle
imports, `moomoo-protocol`. **RYN does not reimplement any of it** — it reaches
the game's own primitives through the bundle's scope, which is why the update
needed a rebinding and not a reimplementation.

A client that builds the pre-2025 session connects, sends frames the server
discards, and decodes incoming frames to garbage. Nothing throws. RYN's bot
sockets (which sign their own frames) now unmask incoming, read io-init's fifth
field, mix the key, salt the tables and mask outgoing payloads.

## The login latch, again, in a new shape

```js
let En=!1,Cn=!1;
function Tc(){if(Cn)return;Cn=!0;const e=jt?"cf:"+jt:void 0;Hc(),xh(e)}
```

`Cn` latches, then `xh` has **two paths that return without connecting** (no
server available; server full), leaving it set. And the disconnect handler
clears it on exactly one path:

```js
function qs(e){if(!(!En&&!Cn)){if(Q.close(),e==="Game updated - please reload"){En=!1,Cn=!1,...;return}
  ...
  Yo(e==="disconnected"?"Disconnected. Press play to rejoin."
    :e==="Socket error"?"Couldn't reach that server. Press play to try again.":...)
```

So the game tells you to press play, and pressing play is a no-op. Its own retry
(`hh`) only covers signed-in players and gives up after two attempts, so a guest
is stuck. Three rewrites fix it, and **none of them changes whether to
connect** — only that a failure stays retryable.

## Hook status

**36 → 46** of 54 hooks match the new bundle, and every one that matches
resolves.

Fixed: `exposeCryptoFns` (fatal), `exposeGameNet` (the obfuscator writes `!1`
as `![]`), `connectLatchFix` + `connectGuardRelease` + `disconnectRelease`
(new login shape), `preRenderLoop`, `postRenderLoop`, `mapSelfColor`,
`chatMute`, `resourceTint`.

Still absent, and the report names each:

| hook | why |
| --- | --- |
| `buildingTint` | obsolete — the renderer now fetches every sprite through one getter, which `resourceTint` already wraps |
| `gameInit`, `RemovePingState` | no safe equivalent found. `RemovePingCall` still matches and already suppresses the ping send; guessing a target for these risked breaking RYN's own ping readout, so they are left and reported |
| `mapPreRender`, `totalDamage`, `preRender`, `playerDied`, `meleeHands` | **already broken before this update** — they do not match the 2024 bundle either |

## What the checks now catch that they did not

`ryn-hooks-check.js` verifies two things per hook, because only one of them is
obvious: does the pattern **match**, and do the identifiers it **injects**
resolve at that point. A match-only check is green for the TDZ crash above.

Calibration matters: a TDZ is certain and fails the run; "no declaration found"
is a note, because a browser global and a word inside a replaced string literal
look identical from the outside. The first version cried wolf on seven healthy
hooks — `(callback)=>(event)=>callback(event)` has its own parameters, and
`"FRVR"` plus the flags argument `"g"` was being joined into an invented
identifier `FRVRg`.

It also holds a **baseline** of the 46 hooks that match. A hook dropping out of
that set fails the run: six mutations broke a hook and left every other check
green, because reporting a non-match without failing on it is a log line, not a
test.

## Not verified

The live server accepting any of this, and the `moomoo-protocol` module itself
(it is not in this repo; RYN reaches it through the bundle). RYN does not boot
in this harness and did not before this update.
