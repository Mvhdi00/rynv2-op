# Luna Client 1.8: Replace

`Luna_Client_misery_preplace.user.js` is Luna 1.1 as fixed by raptor (1.7),
plus a working **Replace** and one set of rules shared by the three placers.

In 1.7 the `replace` toggle (`prePlace2`) was in the menu with nothing behind
it, and the `place range` slider was never read.

## Three placers, one moment each

| Placer | Fires on | Owns |
|---|---|---|
| Autoplace | every tick | the board as it is this tick |
| Preplace | a break it predicts | builds timed to land right after the break |
| Replace | a break that happened (`Q`) | breaks preplace was not covering, or missed |

Every build any of them sends goes into one ledger, keyed by world position.
Each placer skips ground another placer has a build on the way to. A claim
clears when the build shows up (`H`) or after a tick or two.

**Hand-off.** When a break arrives for an object preplace already sent builds
for, replace does not fire. It waits for that tick's update, which the server
sends right behind the break. If one of preplace's builds landed, replace stays
out. If none did, replace takes the ground then.

## What Replace does

It runs on the break packet itself. The one exception is when Luna is in the
middle of an attack routine (`autoaim`); then it places with that tick's update.
The table lists Replace's builds in order of preference:

| Case | Break | Builds |
|---|---|---|
| A, retrap | our trap, with the enemy inside it | a trap on the enemy, then a spike on them if one fits |
| B, spike | our spike, while touching the enemy | a spike on them (knocking them onto our spikes if one can), plus a trap if nothing holds them |
| C, steal | an enemy build within our reach | one build on the freed ground: a spike on them, else a trap that catches them, else a trap, else a spike that does not block our way |

Limits: 2 builds per break and 4 per tick. Replace stops at 100 packets per
second, the same ceiling the old preplace path used, so a heal still fits. It
only answers for an enemy within `replace range` (default 300). Replace builds
flash green on screen.

It does not put back one of our own builds that broke inside our own swing
while Luna is path breaking (`pathBreak`, on by default, toggled with Z).
Otherwise it would rebuild what it is breaking, in a loop.

## Preplace change

1.7 sent preplace from two paths. The second ran before the tick's
predictions were made, so it replayed the previous tick's angles, aimed from
where we stood a tick earlier, and it could not be cancelled. Preplace now has
one send path, at the same moments as before (live ping, lowest ping, and 10ms
after that), always on the current tick's angles and through the ledger.

## Checking it

`tools/luna-harness/run.js` loads the client in headless Chromium with a fake
socket in place of the server. It plays each case and checks the packets the
client sends:

```sh
npm i --no-save playwright msgpack-lite
node tools/luna-harness/run.js
LUNA=some/other.user.js node tools/luna-harness/run.js   # e.g. 1.7, for comparison
```

In the browser console, `lunaPlaceSync.stats` counts breaks, replaces,
hand-offs and skipped builds while you play.
