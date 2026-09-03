# Verification rules

Each rule is shown against real code in this repo, not a hypothetical — either
a pattern already here to imitate, or the one bug this project's own history
already had to fix (`git log`: "Fix AutoPlacer item-limit check against real
group limits"). That bug is worth reading in full before writing placement or
limit-checking code of your own:

> `AutoPlacer._isItemLimit` (`RYN_Client_v4.js:12131`) read
> `group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
> that made the effective cap 99 for every item without a `sandboxLimit` (real
> limits: spikes 15, traps 6, turrets 2, mines 1) and 299 for the three that
> have one — so the limit gate never fired, and the placer kept spending
> placement ticks on items it already could not place. `AutoRetrap._isItemLimit`
> (`RYN_Client_v4.js:12988`) was written correctly against
> `ClientPlayer.getItemCount`, right next to the broken copy, the whole time.

Nobody ran the wrong code path in a debugger to find that — reading both
`_isItemLimit` implementations side by side and checking each against
`ClientPlayer.getItemCount` (the actual source of truth) would have caught it
before it shipped. That's the shape of every rule below.

## Never call a method you haven't seen defined on that exact class

`node --check` (or any syntax check) accepts `foo.clear()` whether or not `foo`
has a `clear` method — it only parses. This codebase makes the failure easy:
`AutoPlacer` and `AutoRetrap` are separate classes with separate, similarly-named
methods (`_isItemLimit`, `_canPlace`, `_getPrePlaceAngles`, ...) that can and do
diverge. Before calling `x.method(...)` on a class you didn't just write, grep
that specific class body for `method(` and read the signature — don't assume a
sibling class's version applies.

## Check every call path before trusting a shared field's timing, not just the common one

Shared mutable state (`ModuleHandler.moduleActive`, `_currentAngle`,
`EnemyManager.nearestEnemy`, anything on `Settings_default`) is written and read
from many places. Before reading one of these fields, find every place that
*writes* it and confirm your read happens after the write on every path that
reaches it — not just the path you tested. `references/client-architecture.md`'s
module-order section is the concrete version of this: a module's position in
`ModuleHandler.modules` (line 18237) decides what's already been written by the
time it runs, and that's invisible from inside the module itself.

## A fallback must stay anchored to a validated opening — never widen to "anywhere near"

`AutoPlacer.getBestPlacementAngles` (`RYN_Client_v4.js:5881-5929`) is the model:
every candidate angle it ever returns comes from an actual circle-circle
intersection against objects returned by a **local, fixed-radius**
`grid2D.query(position.x, position.y, 1, ...)` (line 5887), or from a fixed
geometric offset of the caller's own `targetAngle` (lines 5905-5918: ± an angle
computed from the item's own scale, or the reverse angle — never "just try a
wider circle"). If your fallback's response to "nothing qualified" is to loosen
the search radius, the acceptance distance, or the filter that decided
"qualified" in the first place, it has stopped being a fallback and become a
different, unvalidated feature. When nothing qualifies, place nothing — that's
what the existing code does.

## Tie-breaks must fit the actual candidate set

`AutoPlacer._getPrePlaceObject` (`RYN_Client_v4.js:12188-12268`) sorts candidates
by distance to an anchor point, and that's a legitimate tie-break there because
the candidates are breakable objects at genuinely different distances within
weapon range. Distance stops being a valid tie-break the instant the candidate
set is equidistant by construction — e.g. points generated on a fixed-radius
ring around a target. In that case "sort by distance" is a no-op and the real
tie-break is whatever the loop happens to hit first, which is not a decision,
it's an accident. If you're scoring points on a ring (an escape-angle search,
a surround pattern), the tie-break has to be something that actually varies
across the ring: angle to the nearest exit, exposure to other enemies, line of
sight — not distance.

## `[].every(...)` is `true`

`[].every(predicate)` returns `true` for any predicate, because there's nothing
to falsify it against. A guard or test written as "every candidate satisfies X"
silently passes on an empty candidate list, which usually means "found nothing"
— the opposite of what the assertion is meant to confirm. Assert the list is
non-empty (or has the length you expect) before asserting a property holds
across it.

## Check every new menu input id against `defaultSettings`, statically

Confirmed in `references/client-architecture.md`: an id with no matching
`Settings_default` key doesn't throw, doesn't show an error in the UI — the
binder logs one line via `Logger.error` and leaves that control permanently
unwired (`RYN_Client_v4.js:18985-19012` for checkboxes; color pickers, text
inputs, and sliders repeat the same pattern). This is invisible unless you
either read the console or grep for it. Grep `defaultSettings` for every id
you add before you consider the menu wiring done.

## Test against the actual built artifact, not a re-implementation

There is no behavior test runner in this repo yet — see
`references/build-discipline.md` for how to build one when a change needs it
(slice the real class out of `ReUp_Mix.user.js`, `vm`-run it, drive it with real
inputs). A test that reimplements the placement math or the collision rule
under test, then checks its reimplementation against itself, will pass
regardless of whether the actual shipped class is correct. The point of a test
here is to catch drift between what you think the class does and what it
actually does — that only works if the test runs the real class.

## Don't modify unrelated systems

`ModuleHandler.modules` (`RYN_Client_v4.js:18237`) is one shared array serving
~70 independent modules. Movement and self-defense modules (`movement`,
`dashMovement`, `safeWalk`, `lunaSafeWalk`, `lunaPathfinder`) already maintain
their own notion of a target or path, separate from `EnemyManager.nearestEnemy`.
A new targeting or placement feature should read from `EnemyManager` /
`PlayerManager` state; it should not redirect another module's own target
fields to make itself simpler. If you deliberately leave a system alone, say so
in a comment at the point you didn't touch it, and pin the exclusion with a test
once this repo has a harness to write one in.
