/* ===========================================================================
 * 2yz / AutoUpgrade
 * ---------------------------------------------------------------------------
 * Take age upgrades automatically.
 *
 * The index space is the game's own, read off the offer builder at
 * game_index.js:4734: weapons occupy indices 0..weapons.length-1, items follow
 * at weapons.length + itemIndex. An entry is only offered when its `age`
 * matches the tier the server just announced AND its `pre` prerequisite is
 * already owned. 2yz reproduces exactly that filter rather than sending a
 * hard-coded sequence of indices, which is what breaks the moment a build order
 * diverges or the server offers a different tier.
 *
 * The preference order is a config list of item and weapon NAMES, resolved
 * against the shipped tables. Names rather than ids, so a table renumbering
 * upstream cannot silently repoint a choice at something else.
 * =========================================================================== */

const AutoUpgrade = {
    name: 'AutoUpgrade',

    tick() {
        if (!Config.get('utility.autoUpgrade.enabled')) return null;
        if (!GameState.inGame) return null;
        if (GameState.upgradePoints <= 0) return null;

        const offers = this.offers();
        if (!offers.length) return null;

        const pick = this.choose(offers);
        if (!pick) return null;

        return new UpgradeIntent({
            source: this.name,
            urgency: Config.get('utility.autoUpgrade.urgency'),
            confidence: 1,
            index: pick.index,
            label: pick.name,
            forAge: GameState.upgradeAge
        });
    },

    /* Exactly the filter the game applies when it builds the upgrade row. */
    offers() {
        const tier = GameState.upgradeAge;
        const out = [];

        for (let i = 0; i < Defs.weapons.length; i++) {
            const w = Defs.weapons[i];
            if (w.age !== tier) continue;
            if (w.pre != null && GameState.weapons.indexOf(w.pre) < 0) continue;
            out.push({ index: i, name: w.name, kind: 'weapon' });
        }
        for (let i = 0; i < Defs.items.length; i++) {
            const it = Defs.items[i];
            if (it.age !== tier) continue;
            if (it.pre != null && GameState.items.indexOf(it.pre) < 0) continue;
            out.push({ index: Defs.weapons.length + i, name: it.name, kind: 'item' });
        }
        return out;
    },

    /* First match in the preference list wins; anything unlisted is taken only
     * if the list produced nothing and the fallback is on, so an unattended
     * client still ages up rather than sitting on unspent points. */
    choose(offers) {
        const order = Config.get('utility.autoUpgrade.order')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        for (const wanted of order) {
            const hit = offers.find((o) => o.name.toLowerCase() === wanted);
            if (hit) return hit;
        }
        if (Config.get('utility.autoUpgrade.takeAnything')) return offers[0];
        return null;
    },

    debugState() {
        if (!GameState.inGame) return null;
        return {
            points: GameState.upgradePoints,
            tier: GameState.upgradeAge,
            offers: this.offers().map((o) => o.name)
        };
    }
};
