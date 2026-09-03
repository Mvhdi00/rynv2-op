# Build discipline, verified against `tools/build-reup.js`

## Inputs vs. output

`src/RYN_Client_v4.js`, `src/Luna_Client_1.1.js`, `src/game_index.js`, and
`src/game_vendor.js` are **inputs**. `tools/build-reup.js` reads
`src/RYN_Client_v4.js` as its `BASE` (line 21) and writes `ReUp_Mix.user.js` as
`OUT` (line 22) — it never writes back into `src/`. A change that needs to ship
goes into `tools/build-reup.js` as an anchored edit, not into the `src/` file
directly, or it's gone the next time the build runs and silently gets nobody's
attention, since the build doesn't diff its input against your hand-edit.

## The anchor helper (`tools/build-reup.js:32-38`)

```js
function edit(label, find, replace) {
  const parts = code.split(find);
  if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
  if (parts.length > 2) throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
  code = parts[0] + replace + parts[1];
  applied.push(label);
}
```

Every code-level edit in the build script goes through `edit()`. It throws
loudly on a **missing** anchor (the string doesn't appear) and on an
**ambiguous** one (it appears more than once) — a build failure, not a
half-applied script. This matters more than it sounds like it should:
`RYN_Client_v4.js` duplicates whole classes (`AutoPlacer` and `AutoRetrap` repeat
most of their own logic against each other) and repeats small expressions
(`_isItemLimit(spikeId, myPlayer)`-shaped checks appear at four separate line
ranges). A `find` string that looks unique because you only skimmed one instance
of it will make `edit()` throw "ambiguous" the moment you actually run the
build — which is the point. Widen the anchor with real surrounding context
(a preceding class name, an adjacent unique line) until `parts.length === 2`,
rather than picking the first occurrence blind.

Two other edit paths exist beside `edit()`:

- A one-off `code.match(/regex/)` + `code.replace(...)` for the webhook-beacon
  removal (lines 76-85), used because that block's exact text isn't worth
  hand-typing as a `find` string.
- `patchPage(constName, anchorHtml, insertHtml)` (lines 337-356) for **menu
  markup**: it locates a `const <constName> = "...";` page-string declaration,
  `eval()`s the literal to get real HTML, does a plain substring `.replace`, and
  re-serializes with `JSON.stringify`. New menu HTML goes through this, not
  `edit()` — the page constants are JS string literals, not source code, so
  `edit()`'s raw-source split isn't the right tool.

## Driver data: `drivers/game-drivers.json`

`tools/extract-drivers.js` pulls tables (item groups, weapons, items, hats,
accessories, protocol constants) out of `src/game_index.js` /
`src/game_vendor.js` into `drivers/game-drivers.json`. `tools/verify-drivers.js`
and the build's own embedded `ReUpDrivers.check()` (added by the `edit()` call
at `build-reup.js:472-506`, run 15s after connecting) both diff the client's
tables against **that JSON file**, not against `src/game_index.js` directly. If
a change touches item/hat/accessory/weapon/protocol data, regenerate the JSON
first — otherwise you're verifying against a stale snapshot and it'll pass
cleanly while actually being wrong.

## Full pipeline, in order

```sh
node tools/extract-drivers.js                   # refresh drivers/game-drivers.json from src/game_*.js
node tools/build-reup.js                        # src/RYN_Client_v4.js -> ReUp_Mix.user.js; throws on any stale/ambiguous anchor
node tools/verify-drivers.js ReUp_Mix.user.js   # client data tables vs. drivers/game-drivers.json
node tools/check-hooks.js ReUp_Mix.user.js      # needs: npm i --no-save terser (not a committed dependency — no package.json in this repo)
node --check ReUp_Mix.user.js                   # syntax only
```

`tools/verify-drivers.js` defaults to checking `src/RYN_Client_v4.js` if you
don't pass a path (line 22); pass `ReUp_Mix.user.js` explicitly to check what
actually ships. `tools/check-hooks.js` defaults to `ReUp_Mix.user.js` already
(line 29).

## There is no behavior test runner in this repo

Unlike the data/hook checks above, nothing here exercises *logic* — `node --check`
only proves the file parses. It will accept a call to a method that was never
defined anywhere (`some.thing.clear()` when the real API is
`invalidateAll(reason, engine)`, to take a hypothetical of exactly the shape this
codebase's class-duplication makes easy to introduce) and only fail once that
line actually runs. Before claiming a new feature works:

1. Load `ReUp_Mix.user.js` in a real browser session against moomoo.io and
   exercise the feature directly, or
2. Write a small Node harness that lifts the specific class under test out of
   the built file the way `tools/check-hooks.js` already does for `Regexer`
   (`sliceBlock(startMarker, endMarker)`, `check-hooks.js:44-53`, then
   `vm.runInContext` to actually execute it) and drive it with real inputs.

A test that re-implements the class's logic instead of running the actual class
tests your re-implementation, not the shipped code — see
`references/verification-rules.md`.
