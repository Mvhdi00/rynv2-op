---
name: moomoo-mods
description: >-
  Knowledge for modifying the moomoo.io userscript clients in this repository —
  RYN Client v4, Luna Client 1.1, and the merged ReUp Mix build — plus the same
  verify-before-you-code workflow for any other moomoo.io userscript client
  attached later (Aurora, x18k, 13ms laffer, COOKIE, luminary, or similar).
  Always use this skill before editing anything under src/, tools/build-*.js,
  drivers/, or ReUp_Mix.user.js, and whenever the task mentions moomoo.io, RYN,
  Luna, ReUp Mix, a moomoo userscript/client, spike tick, preplace, replace,
  autoplacer, trap tick, a placement or targeting engine, bundle hooks, or
  anchored builds — even if the user doesn't name the skill directly. The
  client files are 20k-26k lines each with duplicated classes and no type
  checker; guessing a method or field's shape instead of checking it is the
  single most common way a change here ships broken.
---

# moomoo.io client mods

This repo builds `ReUp_Mix.user.js` — a merged userscript combining
`src/RYN_Client_v4.js` (the base, and the only one of the two source clients
that still speaks the current game's protocol) with select features ported
from `src/Luna_Client_1.1.js` — against the real game bundle in
`src/game_index.js` / `src/game_vendor.js`. Every rule in the reference files
below is checked against that actual source, with a file and line, not
inferred from how similar clients usually work.

**The one bug this project's own history had to fix** is the model for why
this skill exists: `AutoPlacer._isItemLimit` read `group.sandboxLimit || 99`
and never looked at `group.limit`, so the placement cap effectively never
fired outside sandbox. The sibling class `AutoRetrap` had the correct version
of the same check sitting right next to it the whole time. Nothing but reading
both implementations and checking them against the real item-group data would
have caught it. See `references/verification-rules.md` for the full story and
more patterns like it.

## Workflow

### 1. Read the references first

| File | Read it when you need to know about |
|---|---|
| `references/game-rules.md` | Collision, `ignoreCollision`/`lockMove`, item-group layers, tick rate, the connection protocol |
| `references/client-architecture.md` | `ModuleHandler`, the tick pipeline, enemy/target selection, `Entity.pos`/prediction, the spatial grid, settings/menu binding, rendering, bundle hooks |
| `references/build-discipline.md` | How `tools/build-reup.js` turns `src/RYN_Client_v4.js` into `ReUp_Mix.user.js`, the anchor-edit helper, the driver-data pipeline, the full build/verify command sequence |
| `references/verification-rules.md` | The specific failure modes this codebase invites, each shown against real code, before you call something done |
| `references/client-differences.md` | What RYN v4, Luna 1.1, and the ReUp Mix output actually share and don't — read this before assuming a pattern from one applies to another |

If a session attaches a client file that isn't RYN v4, Luna 1.1, or
`ReUp_Mix.user.js` (another mix, a newer version, an unrelated client like
Aurora or x18k), it is new corpus, not decoration: checksum it against what's
already in `src/` in case it's a byte-identical re-upload, skim its structure,
and report what it contains and what's actually reusable *before* writing any
code against it. Don't assume it matches the shape documented here — verify it
the same way this skill's own references were verified (grep the real classes,
read the real methods, check line numbers), and update
`references/client-differences.md` with what you find.

### 2. Map the target client before designing anything

Don't assume the file you're editing has the class or method shape you
remember from another client, or from this skill's references, without
checking. Start with:

```sh
grep -n "nearestEnemy"                 <target>.js   # every place enemy selection is read
grep -n "class AutoPlacer\|class AutoRetrap\|PlacementEngine" <target>.js   # where placement actually lives
grep -n "staticModules\s*=\s*{"        <target>.js   # the module registry, and the array right after it
grep -n "grid2D\|SpatialHash"          <target>.js   # the spatial index in use
grep -n "class Entity\b"               <target>.js   # what prediction state actually exists
```

Extend whatever placement/prediction/targeting system you find. If the target
client already has an `AutoPlacer`-shaped class, do not build a second,
parallel one beside it — that's how two selectors end up disagreeing on the
same tick with no memory between them (see the `nearestEnemy` note in
`references/client-architecture.md`).

### 3. Design against the game files, not intuition

`src/game_index.js` is the authority on collision, layers, item limits, and the
protocol — not any client's implementation of those rules, and not general
moomoo.io knowledge from outside this repo. When a client's behavior and the
game bundle disagree (as with the `ItemGroups[8]` layer bug — see
`references/client-differences.md`), the bundle wins and the client has a bug.

### 4. Edit through anchors, never in place

`src/*` files are inputs and are never hand-edited for a shipped change — see
`references/build-discipline.md` for exactly how `tools/build-reup.js`'s
`edit()` helper works and why an anchor that looks unique often isn't in a
codebase this size with this much duplicated logic.

### 5. Verify before claiming done

At minimum, in order:

```sh
node tools/extract-drivers.js                   # if you touched item/hat/weapon/protocol data
node tools/build-reup.js                        # all anchors must bind
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js      # needs: npm i --no-save terser
node --check ReUp_Mix.user.js                   # syntax only — not a substitute for the above
```

`node --check` passing is not evidence that a new feature works — it only
proves the file parses. There is no behavior-test runner in this repo yet;
`references/build-discipline.md` explains how to build one for what you're
adding (drive the real class straight out of the built file) rather than
testing a re-implementation of it.

## Scope

This skill documents **what's actually in this repository today**: RYN v4,
Luna 1.1 (as a feature reference, not a mergeable codebase), and the ReUp Mix
build — their real architecture, the real game rules they run against, and the
real build pipeline. It does **not** cover: gameplay strategy, any targeting,
prediction, or auto-placement system beyond what's listed in
`references/client-architecture.md` (none of this repo's clients currently
ship velocity/heading prediction, an escape-geometry solver, or a multi-stage
placement pipeline beyond `AutoPlacer`/`AutoRetrap` — if a task asks for one,
it has to be designed and verified from scratch against the rules in
`references/game-rules.md`, not assumed to already exist), Aurora/x18k/13ms
laffer/COOKIE/luminary specifically (no source for these is in this repo; the
workflow above applies to them once one is attached, the specific facts do
not), and anything about evading anti-cheat or ban detection.
