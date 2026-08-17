/* ===========================================================================
 * 2yz / AutoBuy
 * ---------------------------------------------------------------------------
 * Buy the hats and accessories the defensive and offensive modules want to
 * wear, so they stop being no-ops on a fresh account.
 *
 * Safe Soldier and Combat's damage hat both refuse to act on a hat that is not
 * owned (DefenseIntent.validate returns 'hat-not-owned'). Without this module
 * that is a permanent refusal rather than a temporary one.
 *
 * Prices come from the shipped hat and accessory tables. The wanted list is
 * config, by NAME, resolved against those tables -- so it cannot point at an id
 * that no longer means what it did.
 * =========================================================================== */

const AutoBuy = {
    name: 'AutoBuy',

    tick() {
        if (!Config.get('utility.autoBuy.enabled')) return null;
        if (!GameState.inGame) return null;

        const reserve = Config.get('utility.autoBuy.pointReserve');
        const budget = GameState.resources.points - reserve;
        if (budget <= 0) return null;

        const want = this.wanted();
        for (const entry of want) {
            const owned = entry.accessory ? GameState.tails : GameState.skins;
            if (owned[entry.id]) continue;
            if (entry.price > budget) continue;
            return new BuyIntent({
                source: this.name,
                urgency: Config.get('utility.autoBuy.urgency'),
                confidence: 1,
                id: entry.id,
                accessory: entry.accessory,
                price: entry.price,
                label: entry.name
            });
        }
        return null;
    },

    /* The configured names, resolved to real table entries. Anything that does
     * not resolve is dropped rather than guessed at. */
    wanted() {
        const names = Config.get('utility.autoBuy.wanted')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        const out = [];
        for (const name of names) {
            const hat = Defs.hats.find((h) => h.name.toLowerCase() === name);
            if (hat && hat.price != null) {
                out.push({ id: hat.id, name: hat.name, price: hat.price, accessory: false });
                continue;
            }
            const acc = Defs.accessories.find((a) => a.name.toLowerCase() === name);
            if (acc && acc.price != null) {
                out.push({ id: acc.id, name: acc.name, price: acc.price, accessory: true });
            }
        }
        return out;
    },

    debugState() {
        if (!GameState.inGame) return null;
        return {
            points: GameState.resources.points,
            missing: this.wanted()
                .filter((e) => !(e.accessory ? GameState.tails : GameState.skins)[e.id])
                .map((e) => e.name + '(' + e.price + ')')
        };
    }
};
