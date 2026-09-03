# Client differences

This repo currently holds **two input clients and one build output** — not two
competing versions of the same client. Map which file you're actually looking
at before porting anything between them; they are not structurally comparable.

| | RYN Client v4 (`src/RYN_Client_v4.js`) | Luna Client 1.1 (`src/Luna_Client_1.1.js`) | ReUp Mix (`ReUp_Mix.user.js`) |
|---|---|---|---|
| Lines | 25,974 | 19,804 | 26,194 |
| Form | Userscript — rewrites the loaded game bundle at `document-start` via `Hook.append/prepend/replace` | Full fork of an old webpack `bundle.js` | Built from RYN v4 by `tools/build-reup.js`, with select Luna features ported in |
| Protocol | Current: per-connection opcode permutation + 6-byte frame signature (`game_index.js:428`, `drivers/game-drivers.json`) | Plain msgpack `[type, args]` — predates the current transport entirely | Same as RYN v4 (it *is* RYN v4's base) |
| Connects to the live game | Yes | **No** — the handshake it speaks doesn't exist server-side anymore | Yes — this is the file to load and test against moomoo.io |
| Placer | `AutoPlacer` (`:12057`) and `AutoRetrap` (`:12916`), each with their own `_isItemLimit`, `_canPlace`, etc. | Luna's original placer: `getConfig`, `canPlace`, `addPredictObject`, `getPrePlaceAngles`, `getPrePlaceObject` | RYN's `AutoPlacer`, carrying Luna's function set renamed to RYN's `_`-prefixed convention, rebuilt on RYN's `grid2D` — see the porting table below |
| Prediction | `Entity.pos.future` only — one tick of straight-line extrapolation (`:2507-2525`) | not surveyed for this skill — see caveat below | same as RYN v4 |
| Module system | `ModuleHandler.staticModules` + `this.modules[]` (`:18093`) | not surveyed for this skill — see caveat below | same as RYN v4 |

**Caveat on the Luna column:** rows marked "not surveyed" are left blank rather
than guessed. This skill has only verified the specific Luna-vs-RYN claims
`README.md`'s own porting table makes (reproduced below) — not Luna's full class
layout. If a task needs a Luna-only feature RYN doesn't have, read
`src/Luna_Client_1.1.js` directly before porting; don't assume it mirrors RYN's
structure just because both are moomoo.io clients.

## Why RYN is the base, not Luna

Only RYN speaks the protocol the current game actually uses (see
`references/game-rules.md`). Luna 1.1 cannot connect at all, so none of its code
was merged in directly — its useful features were re-implemented as RYN modules
instead, and the rest of RYN was left untouched. This is why "port a Luna
feature" means "read what Luna does, then write a RYN module that does the same
thing," never "copy Luna's code in."

## What was ported from Luna into ReUp Mix, and what wasn't (from `README.md`, spot-checked)

Ported: Username Cycler, Spike/Mill Rotation toggles, five menu theme presets —
all confirmed present as real settings keys and `edit()` calls in
`tools/build-reup.js`.

Not ported, per `README.md`, with its stated reason — worth reading before
assuming a Luna feature is missing and re-adding it:

- Song / auto-chat lyric loop — RYN's Music page already covers this more fully.
- Autoplacer/preplace/replace — already covered above; RYN's `AutoPlacer` *is*
  Luna's placer, ported.
- Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement/spikepush —
  already present in RYN, in some cases as direct ports (`LunaPathfinder`,
  `LunaSafeWalk`).
- "ai hat predict" (`autsh1`) / "ai triangulation" (`triangle2`) — Luna menu
  entries with no implementation behind them; there is nothing to port.

## Two verified historical bugs, as a model for what "check the real source" catches

1. **`ItemGroups[8]` layer mismatch** — RYN v4 shipped `layer: -1` for the
   platform item group; the real bundle has `layer: 1`. See
   `references/game-rules.md`. Fixed in `tools/build-reup.js`'s "Driver
   correction" edit.
2. **`AutoPlacer._isItemLimit` sandbox/limit mixup** — see
   `references/verification-rules.md` for the full story. Fixed in the same
   build script's "Autoplacer item-limit check" edit.

Both were caught by diffing the client against the actual shipped bundle or
against a sibling method that got it right — not by intuition about what the
values "should" be.

## If another client shows up

Aurora, x18k, 13ms laffer, COOKIE, luminary, or any other moomoo.io userscript
client attached to a future session is **not** covered by anything in this
file. Don't assume it shares RYN's or Luna's internal structure. Repeat the
mapping workflow in `SKILL.md` (grep for `nearestEnemy`, find the real
placer/module classes, find the real spatial index) against it directly, and
add a verified column to the table above once you have — don't extrapolate from
this table to a client you haven't opened.
