# Preplace / Replace patch tooling

How the preplace and replace features got into the two RYN v5 userscripts, and
how to redo it if either build is regenerated upstream.

## The two features

**Preplace** — when one of our spikes or traps is about to be broken, send the
replacement placement *before* the break lands. The server processes the break
first, so the slot is free by the time our packet is handled and there is no gap
for the enemy to walk into. Trigger is `PlayerObject.canBeDestroyed` on the
current tick (an enemy in range can finish it now), or a damage estimate showing
the building is within `_prePlaceHits` swings of dying.

What gets placed depends on who is pinned, following the reference client:

| situation | placement | aimed at |
|---|---|---|
| the doomed building *is* our trap holding the enemy | retrap burst | the enemy |
| enemy pinned by something else | spike | their trap |
| nobody pinned | trap | the doomed slot |
| we are the pinned one | spike | whatever has us |

The retrap burst refills several slots around us at once instead of one, so
whichever opens up as the trap dies gets taken. The reference fans 16 angles;
that costs more packets than a RYN tick has, so the burst takes the best
`PREPLACE_RETRAP_ANGLES` toward the enemy and stops at the packet budget.

**Replace** — when one of our spikes or traps *is* destroyed, drop a new one into
the hole on the same tick. Reads `ObjectManager.deletedObjects`, which the client
already fills with nearby player objects removed this tick. Priority order:

1. we are pinned -> spike at our captor (this is what breaks the cycle)
2. our trap on them broke -> re-pin, aimed where they are heading
3. they just escaped (`wasTrapped()`) -> trap, aimed where they are heading
4. they are pinned and within `REPLACE_TRAP_REACH` -> spike into their trap
5. otherwise -> spike toward the break direction

## Deliberately not ported

- The reference aims a retrap so the enemy is knocked into an adjacent friendly
  spike. RYN's `AutoPlacer` already runs `SiegeAnalysis.knockInto` and
  `_findClosestSpikeToKb` every tick, so this would duplicate a live system.
- Placing traps around yourself after escaping one — RYN covers that with
  `AntiTrapStar` and `AntiTrapProtect`.
- Breaking the trap you are stuck in — RYN's `AntiRetrap`.
- `shameGrind` variants and the reference's spike-tick folding: RYN has no
  `shameGrind`, and runs spike tick as its own `spikeTick*` modules.

Unrelated but worth knowing: `AutoPlacer` reads `client._retrapQuadrant` to mask
off a quadrant of placement angles, and nothing in the build ever sets it. It is
inert, and was left alone.

Both live as ordinary RYN modules (`postTick`), respect the packet budget, and
sit in the module order as `replacer` → `autoPlacer` → `prePlacer`.

## OWNER build

Plain source, so it is edited directly:

- the two module classes go in after `const AutoPlacer_default = AutoPlacer;`
- `menu_owner.js` splices the Combat rows and Keybinds tiles into the page markup
- settings keys, module registration and the hotkey handlers are hand-edited

## PLAYER build

The player script is javascript-obfuscator output: one encrypted string array
plus ~2200 nested forwarder functions. It is patched without being
de-obfuscated.

1. `deob.js` evaluates the string array, the decoder and the rotation IIFE, then
   resolves every forwarder and constant-folds all `wrapper(a,b)` calls. It emits
   a folded copy **and** an anchor map recording, for every fold, the matching
   offsets in both files.
2. `mapback.js` turns an offset in the folded copy into one in the untouched
   build. It only answers for positions in the *gaps* between folds — the regions
   the fold left byte-for-byte identical — and reports when a position is not.
3. `patch_player.js` locates each insertion point in the readable folded copy,
   maps it back, checks the surrounding gap is identical on both sides, and
   splices in plain JS. Every edit is an insertion: no original byte is rewritten.

The module block is lifted straight out of the OWNER build and renamed
(`Settings_default` → `_0x35d81b`, `PlayerObject` → `_0xcd92ac`) so the two
builds cannot drift.

The menu pages are encrypted string-array entries and cannot be edited in place,
so the player wraps the two page references in `getFrameContent` with
`RYN_PP_COMBAT` / `RYN_PP_KEYS`, which graft on the same rows at runtime. Both
are no-ops if their anchor is missing.

    node deob.js ../../RYN_Client_v5_PLAYER.user.js player_stage1.js
    node patch_player.js

`patch_player.js` is not idempotent — re-run it against a clean copy of the
build.

## Tests

    node test_modules.js            # placement logic, owner build
    node test_modules.js --player   # the same cases against the player build
    node test_menu.js               # menu wiring and markup in both builds

`test_modules.js` slices the module block out of the shipped file and drives it
with stubbed managers, so it tests what actually ships rather than a copy.
