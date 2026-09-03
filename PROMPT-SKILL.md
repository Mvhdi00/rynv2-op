# PROMPT — build a `moomoo-mods` skill

> Paste this as your prompt. Attach the RYN clients, the reference clients and
> the game bundle if they are not already in the repo.

---

## Goal

Create a Claude Code skill named **`moomoo-mods`** that carries the knowledge
needed to modify moomoo.io userscript clients (RYN, Luna, Aurora, x18k, 13ms
laffer, COOKIE, luminary and friends) without re-deriving it every session.

Use the **`skill-creator`** skill to build it. Install it as a **project** skill
so it travels with the repository and every session in it loads automatically:

```
.claude/skills/moomoo-mods/SKILL.md
.claude/skills/moomoo-mods/references/*.md
```

Commit it.

---

## Why this skill exists

A prior session added a single-target aim lock and a trap-enclosure layer to two
RYN builds. Roughly a third of the effort went to re-finding classes inside
24k–26k line files, and five defects were knowledge failures, not reasoning
failures:

1. A method was called that did not exist on the class (`book.clear()`; the real
   API was `invalidateAll(reason, engine)`). `node --check` passed it. It would
   have thrown mid-combat.
2. A shared field was read on a code path that runs before the field is set
   (`frame.motion` read in `sense()`, which runs before `predict()`), so a
   feature silently fell back to a default.
3. A widening search pass degraded into "anywhere near the target", which is
   exactly the spike-spam the spec forbade.
4. A tie-break scored on distance when every candidate sat on a ring at equal
   distance, so the winner was whichever the loop hit first.
5. Two test assertions passed vacuously because `[].every(...)` is `true`.

Every one is preventable with written-down knowledge. That is what this skill
is for.

---

## What the skill must contain

Keep `SKILL.md` lean — a sharp description plus the decision rules. Put the
heavy material in `references/` files that get read on demand.

### `SKILL.md`

A description that triggers on: moomoo.io, moomoo mods, userscript client, RYN,
Luna, Aurora, spike tick, preplace, replace, autoplacer, trap tick, placement
engine, bundle hooks.

Then the workflow, in order:

1. **Read the references first.** When several client files are attached, they
   are the corpus, not decoration. Checksum them against anything already in the
   repo (some uploads are byte-identical copies). Report what each contains and
   what prior art is worth borrowing, before writing code.
2. **Map the target client.** Grep every `nearestEnemy` read; find where
   preplace and replace actually live; find any existing placement engine,
   prediction system, escape geometry, and spike-tick guard. Extend what exists;
   never build a second one beside it.
3. **Design against the game files, not intuition.**
4. **Edit through anchors, never in place.**
5. **Verify before claiming done.**

### `references/game-rules.md`

The authoritative rules, quoted from the shipped bundle with line references:

- `checkCollision`: an `ignoreCollision` object does not push a player, with the
  single exception of a trap, which sets `lockMove` on anyone who is not its
  owner and not on the owner's team. Consequence: **a player's own traps do not
  constrain them**, while spikes are walls whoever owns them.
- Every active object in the grid is collision-checked — there is no layer
  filter on the movement path.
- `ItemGroups[group].layer` is read straight into `PlayerObject.layer`, which
  the collision and placement paths key off.
- Tick is `1000 / 9` ≈ 111 ms.
- The current protocol negotiates an opcode table per connection, permutes the
  c2s/s2c alphabets from a seed, and prefixes every client frame with HMAC
  bytes. Clients that predate it (Luna 1.1) cannot connect at all.

### `references/client-architecture.md`

The shapes that recur across these clients:

- `ModuleHandler.staticModules` + `this.modules[]`, and why array order is the
  execution order. Adding a module first in the array makes every other module
  see what it leaves behind.
- The tick pipeline: `PlayerManager.postTick()` → `EnemyManager.handleEnemies()`
  → `myPlayer.tickUpdate()` → `ModuleHandler.postTick()` → the module loop.
- `EnemyManager.nearestEnemy` is recomputed every tick and is commonly read by
  several modules independently. **This is the classic defect**: two selectors
  on the same frame with no memory between ticks.
- `PlayerManager.enemies` is the already-validated enemy list — alive, visible,
  not a teammate, not one of our own bots. Use it rather than inventing entity
  rules.
- `ObjectManager.grid2D` is a spatial hash with 100-unit cells;
  `query(x, y, search, cb)` covers ±`search` cells. `search: 2` is a 500×500
  window — local. Never scan the map.
- `Entity.pos = {previous, current, future}`; `setFuturePosition()` makes
  `future` exactly one tick of travel and sets `speed` / `move_dir`.
- `SocketManager.pong`, `minPingTime`, `TICK` for network timing.
- `Settings_default` / `defaultSettings`, and that the menu binds inputs to
  settings **by element id** — an id with no matching setting only complains at
  runtime, in the console.
- `EntityRenderer._render(ctx, entity, player)` runs per entity per frame with
  interpolated `entity.x/y`; `RYN._offset` converts world to screen. Drawing
  here follows a target smoothly with no smoothing code of your own.
- `Hook.replace / append / prepend` rewrite the game bundle at load; every hook
  must still bind after a change.

### `references/build-discipline.md`

- `src/*` are inputs and are never edited. Changes are anchored string edits in
  `tools/build-*.js`, producing a separate `.user.js`.
- Every edit goes through a helper that throws when the anchor is **missing or
  ambiguous**. These clients duplicate whole classes, so an anchor that looks
  unique often is not — widen it with surrounding context until it is.
- Verification that must pass before saying done:
  ```sh
  node tools/build-<x>.js          # all anchors bind
  node --check <output>.user.js    # syntax
  node tools/test-<x>.js           # behaviour
  node tools/verify-drivers.js     # data tables vs the bundle (where present)
  node tools/check-hooks.js        # bundle hooks still bind (where present)
  ```

### `references/verification-rules.md`

Each rule with the defect it prevents:

- **Never call a method you have not seen defined.** Grep for `name(` in the
  target and confirm the signature. `node --check` passes calls to methods that
  do not exist.
- **Prove call ordering before reading a field off a shared object.** Check
  every entry point, not just the common one.
- **A fallback must never be "anywhere near the target".** Every search pass
  stays anchored to a validated opening; when nothing qualifies, place nothing.
- **Tie-breaks must be tactical.** Distance is not a tie-break when everything
  is equidistant.
- **Test against the built artifact.** Slice the classes under test out of the
  output file and run them with the client's own geometry and prediction
  helpers. A test that re-implements the logic tests nothing.
- **`[].every(...)` is `true`.** Assert length before asserting a property.
- **Check every menu input id resolves to a real setting**, statically.
- **Do not modify unrelated systems.** Movement and self-defence modules
  legitimately keep their own target. Name the exclusions and pin them with a
  test.

### `references/client-differences.md`

Concrete, because assuming one build's structure applies to another caused a
full re-derivation:

| | RYN v4 | RYN Type 2 v5.4 |
|---|---|---|
| Lines | ~26k | ~24k |
| Preplace / Replace | inside `AutoPlacer`, duplicated again in `AutoRetrap` | inside `RynPlacementEngine` |
| `AutoRetrap` | present | absent |
| Glotus parity mode | present | absent |
| Prediction | none — `pos.future` only | `TargetMotion`: velocity, acceleration, heading stability, confidence |
| Escape geometry | `SiegeAnalysis` called ad hoc | engine computes `_exits` per frame |
| Spike-tick guard | check `ModuleHandler.activeModule` | `lunaSpikeTickBusy()` helper exists |
| Placement pipeline | hand-rolled | `ThreatAnalyzer` → `CandidateGenerator` → `AngleSolver` → `PlacementScorer` → `PlacementPlanner` → `PlacementExecutor`, with `PreplaceBook`, `ConflictResolver`, `PlacementScheduler` |

Rule: **map the build before designing.** Never port a patch between them
unchanged.

---

## Source material

Everything above is already written down in this repository — mine it rather
than reconstructing it:

- `README.md` — the target lock and enclosure sections describe both builds
- `PROMPT.md` — the phased workflow and the engineering rules
- `tools/build-reup.js` — anchored edits against RYN v4, with rationale comments
- `tools/build-ryn-type2.js` — anchored edits against Type 2
- `tools/test-target-lock.js`, `tools/test-ryn-type2.js` — the test patterns
- `src/game_index.js` — the authoritative game rules

---

## Constraints

- `SKILL.md` stays short. If it grows past roughly 150 lines, the excess belongs
  in `references/`.
- Reference files are loaded on demand, so they can be detailed — but every
  claim in them must be checked against the actual source, with a file and line.
  **Do not write a rule you have not verified.** A confidently wrong reference
  is worse than no reference.
- Do not include anything user-specific or secret.
- No content about evading detection or bans.

---

## Validate before finishing

1. Confirm the skill is discovered: it appears in the skills list for this
   project.
2. Spot-check three claims in the references against the real source files and
   correct any that do not hold.
3. State plainly what the skill does **not** cover.
