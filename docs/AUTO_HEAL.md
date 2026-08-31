# Auto Heal (RYN v5.5)

Shame is eleven lines of server code, and they are in the bundle this client is
built against. Everything below follows from reading them.

## The mechanic, from `src/game_index.js`

```js
changeHealth(f, w) {
    if (f > 0 && this.health >= this.maxHealth) return false;   // 2418
    f < 0 && (this.hitTime = Date.now())                        // 2422
}

buildItem(f) {                                                   // 2454
    if (this.canBuild(f) && ...) {                               // 2458  needs the food
        let V = false;
        if (f.consume) {
            if (this.hitTime) {                                  // 2461
                const W = Date.now() - this.hitTime;
                this.hitTime = 0;                                // 2463  one press per hit
                W <= 120 ? (this.shameCount++,                   // 2464  +1
                    this.shameCount >= 8 && (this.shameTimer = 3e4, this.shameCount = 0))
                        : (this.shameCount -= 2, ...)            // 2466  -2
            }
            this.shameTimer <= 0 && (V = f.consume(this));       // 2469  no heal while locked
        }
        V && (this.useRes(f), ...)                               // 2475  food only spent if it healed
    }
}
```

Five consequences, and the whole module is built on them:

1. Shame moves **only** on a food press, and only while `hitTime` is set — so
   only after damage, and only once per hit.
2. Direction is decided by the server's own `Date.now() - hitTime`: **≤120ms is
   +1, over 120ms is −2**. That subtraction is the only way shame goes down
   short of the 30-second lock expiring.
3. The arithmetic runs **before** the heal, and `changeHealth` refuses a heal at
   full health — so a press at full health books its −2 and never reaches
   `useRes`. Three packets, no food. Free shame.
4. At 8 the server arms 30 seconds and healing stops. The press that takes the
   count to 8 does not heal either — so **at 7, pressing inside the window is
   strictly worse than not pressing at all**.
5. `canBuild` gates everything on affording the food: a press you cannot pay for
   is not a free −2, it is nothing.

## What was there before

novastorm's rule, inside `AntiInsta.postTick`. It asks only about health:

```js
healing = tempHealth <= totalDmgPot
if ((healing && shameCount < 7) || (tickCount - damageTick > 0)) && tempHealth < maxHealth
    press ceil(gap / restore) times
```

It cannot reduce shame — it never presses at full health — and it measures in
whole ticks rather than against the 120ms the server actually uses. The guard in
`ModuleHandler.heal` held a press for exactly one tick, then sent it regardless.

## The module

`AutoHeal` (`moduleName: "autoHeal"`), immediately after `antiInsta` in the
module order.

```
ledger        mirrors the server's two fields: shameCount, and hitTime as a
              pending judgement. Every press in the client reports into it.
window        (now - seen) + pong, the same arithmetic the old guard used
hold          shouldHold(), which ModuleHandler.heal now asks instead of
              deciding alone: wait out the window when waiting is free, go
              when it is not, refuse at the ceiling
survival      emergency / quiet / free / low — see the comment in the source
anticipation  the window is open and a hit is one tick away: top up now, on a
              -2, instead of after the hit on a +1
harvest       the press that exists only to book the -2, at full health if need
              be, once per judgement, only while the count is above zero
```

Toggles: Combat → Defense → **Autoheal** (existing) and its sub-option **Shame
Harvest**. Counters: `client._ModuleHandler.staticModules.autoHeal.stats`.

### Where it deliberately refuses

Under sustained damage the press is judged against the server's `hitTime` **at
arrival**, and anything that lands during the half-round-trip flight overwrites
it. So a `-2` the client is sure about can still be a `+1`. The ledger books
those pessimistically, and at the ceiling it refuses rather than gamble: a wrong
refusal costs one heal, a wrong press costs thirty seconds of every heal after
it.

## Tests

```sh
node tools/auto-heal-harness.js     # 18 scenarios, 46 checks
```

The harness runs the real module against a transcription of the server code
above, with a latency model, and ends with three side-by-side runs against the
rule it replaces. Measured, same transport, same server:

| pattern | old | new |
|---|---|---|
| spike contact 36 hp/s, nothing EnemyManager can price | min 0, **died**, shame 3 | min 36, **survived**, shame 7, no lock |
| normal trade, one hit / 0.7s, from shame 6 | shame 0 | shame 0 |
| already at the ceiling under pressure | **2 locks** | **0 locks** |
