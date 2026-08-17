/* ===========================================================================
 * 2yz / Arbiter
 * ---------------------------------------------------------------------------
 * One place decides what happens each tick.
 *
 * The rules, in order:
 *
 *   1. Everything is validated first. An intent that no longer describes the
 *      world is dropped before it can win anything.
 *
 *   2. Holds are resolved before winners are picked. A hold does not beat other
 *      intents by outranking them; it removes the specific kinds it blocks from
 *      the pool, and only if it outranks the best intent of that kind. That is
 *      what "must not blindly override Combat" means in practice -- Safe
 *      Soldier and Anti Smart Tick can veto, but only when their case is
 *      stronger than what they are vetoing.
 *
 *   3. One winner per exclusive lane. Attack, Placement and Heal each occupy
 *      the build/attack slots, so at most one runs per tick; Defense is a hat
 *      swap and rides along with whatever won.
 *
 *   4. Remaining frame budget is honoured. An intent that cannot afford its
 *      frames this tick loses to one that can, rather than being half-sent.
 * =========================================================================== */

const Arbiter = (function () {
    /* Lanes that cannot run together, because they all drive the same build and
     * attack packets. */
    const EXCLUSIVE = ['Attack', 'Placement', 'Replace', 'Heal', 'Break'];

    /* Kinds that may run at most once per tick even though they do not compete
     * for the build slot -- two upgrades or two moves in one tick is always a
     * mistake, but they can coexist with an attack. */
    const SINGLETON = ['Move', 'Upgrade', 'Buy', 'Spawn', 'Toggle', 'Chat', 'Defense'];

    let lastDecision = null;

    function byPriority(a, b) { return b.priority - a.priority; }

    function resolve(intents) {
        const dropped = [];
        const live = [];

        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            if (!intent) continue;
            const bad = intent.validate();
            if (bad) {
                intent.rejectedReason = bad;
                dropped.push(intent);
                continue;
            }
            live.push(intent);
        }

        const holds = live.filter((i) => i.kind === 'Hold').sort(byPriority);
        const actionable = live.filter((i) => i.kind !== 'Hold');

        /* Apply holds. A hold only suppresses a kind when it outranks the best
         * intent of that kind -- otherwise the thing it wants to stop was more
         * important than the stopping. */
        const suppressed = new Set();
        for (const hold of holds) {
            for (const kind of hold.blocks) {
                const best = actionable
                    .filter((i) => i.kind === kind && !suppressed.has(i))
                    .sort(byPriority)[0];
                if (!best || hold.priority > best.priority) {
                    for (const intent of actionable) {
                        if (intent.kind === kind) {
                            intent.rejectedReason = 'held:' + hold.reason;
                            suppressed.add(intent);
                        }
                    }
                }
            }
        }

        const pool = actionable.filter((i) => !suppressed.has(i)).sort(byPriority);

        const winners = [];
        let budget = Net.budgetRemaining();
        let exclusiveTaken = false;
        const singletonTaken = new Set();

        for (const intent of pool) {
            const isExclusive = EXCLUSIVE.indexOf(intent.kind) >= 0;
            if (isExclusive && exclusiveTaken) {
                intent.rejectedReason = 'lane-taken';
                suppressed.add(intent);
                continue;
            }
            if (SINGLETON.indexOf(intent.kind) >= 0 && singletonTaken.has(intent.kind)) {
                intent.rejectedReason = 'lane-taken';
                suppressed.add(intent);
                continue;
            }
            const cost = intent.frameCost();
            if (cost > budget) {
                intent.rejectedReason = 'no-budget';
                suppressed.add(intent);
                continue;
            }
            budget -= cost;
            if (isExclusive) exclusiveTaken = true;
            if (SINGLETON.indexOf(intent.kind) >= 0) singletonTaken.add(intent.kind);
            winners.push(intent);
        }

        lastDecision = {
            tick: GameState.tick,
            submitted: intents.length,
            winners,
            holds,
            rejected: dropped.concat(Array.from(suppressed)),
            budgetBefore: Net.budgetRemaining(),
            budgetAfter: budget
        };

        return winners;
    }

    return {
        resolve,
        get lastDecision() { return lastDecision; },
        debugState() {
            if (!lastDecision) return null;
            return {
                submitted: lastDecision.submitted,
                winners: lastDecision.winners.map((i) => i.describe() + ' p=' + Math.round(i.priority)),
                rejected: lastDecision.rejected.map((i) => i.describe() + ' ' + i.rejectedReason),
                budget: lastDecision.budgetAfter
            };
        }
    };
})();
