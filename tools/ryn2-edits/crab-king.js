/*
 * Crab King (and any boss animal): drawn like every other creature — its name
 * above it, RYN's health bar and HP number under it — instead of the game's
 * one bar across the top of the screen, shown only while you stand in its pool.
 *
 * Edits are anchored on the build after tools/build-ryn2.js's own edits.
 */
module.exports = [
  {
    label: "bossBar + bossNameY hooks (formatCode2)",
    find: `    Hook.prepend("renderEntity", /\\w+\\.health>NUM{0}.+?(\\w+)\\.fillStyle=(\\w+)==(\\w+)/, ";RYN._Renderer._guardCall(RYN._hooks._EntityRenderer,\\"_render\\",$1,$2,$3);false&&");
`,
    replace: `    Hook.prepend("renderEntity", /\\w+\\.health>NUM{0}.+?(\\w+)\\.fillStyle=(\\w+)==(\\w+)/, ";RYN._Renderer._guardCall(RYN._hooks._EntityRenderer,\\"_render\\",$1,$2,$3);false&&");
    /* Bosses. The entity pass sets a boss aside before the branch every other
     * creature is drawn in, so it gets no name over it and no bar under it;
     * instead, and only while you stand in its pool, the game draws one bar
     * across the top of the screen:
     *     if(p=$[t]||ye[t-$.length],p.visible&&p.isBoss)p.active&&Ju(W.x,W.y)&&(u=u||p);else if(...)
     * RYN's overlay is called from inside that ordinary branch (renderEntity,
     * above), so the Crab King never had RYN's bar or HP number either. The
     * set-aside test now keeps out only a boss that is no longer active; a live
     * one falls through and is drawn like any other animal — its name above
     * it, RYN's bar and HP under it — and the top bar is not drawn for it.
     * Players in the game's boss mode still get the top bar; that is the next
     * branch and is left alone. */
    Hook.replace("bossBar", /(\\w+)\\.visible&&\\1\\.isBoss\\)\\1\\.active&&\\w+\\(\\w+\\.x,\\w+\\.y\\)&&\\((\\w+)=\\2\\|\\|\\1\\);/, "$1.visible&&$1.isBoss&&!$1.active);");
    // ...and the name over a boss is lifted clear of its sprite, by the same
    // measure as RYN's bar under it (Renderer._bodyRadius). For anything that
    // is not a boss the line computes exactly what it did.
    Hook.replace("bossNameY", /const (\\w+)=(\\w+)\\.y-(\\w+)-\\2\\.scale-(\\w+)\\.nameY,/, "const $1=$2.y-$3-RYN._Renderer._bodyRadius($2)-$4.nameY,");
`,
    why: "The boss branch of the game's entity pass is the single choke point: it is what keeps the Crab King out of the ordinary nameplate/health-bar branch (where RYN's renderEntity overlay is called) and what feeds the top-of-screen boss bar. Letting a live boss fall through draws its name above and RYN's bar + HP under it, and never sets the top-bar variable for it. The second hook lifts the boss's nameplate above its 1.2x sprite and outline ring, matching the bar below."
  },
  {
    label: "Renderer._bodyRadius + renderBar offset and submerged colour",
    find: `    renderBar(ctx, entity) {
      const {barWidth: barWidth, barHeight: barHeight, barPad: barPad} = Config_default;
      const totalWidth = barWidth + barPad;
      const scale = entity.scale + 34;`,
    replace: `    /* How far out from an entity's centre its bar (below) and its name (above,
     * bossNameY hook) start, before the usual gap. That is its scale, as the
     * game measures every creature — except a boss. The game draws a boss with
     * its sprite at 1.2 times its scale (times spriteMlt) and an outline ring
     * almost that wide, so for the Crab King (scale 280, drawn at 336) a bar at
     * scale + 34 ran through the ring and the claws. A boss is measured to the
     * edge of its sprite instead. */
    _bodyRadius(entity) {
      return entity.isBoss ? entity.scale * 1.2 * (entity.spriteMlt || 1) : entity.scale;
    }
    renderBar(ctx, entity) {
      const {barWidth: barWidth, barHeight: barHeight, barPad: barPad} = Config_default;
      const totalWidth = barWidth + barPad;
      const scale = this._bodyRadius(entity) + 34;`,
    why: "renderBar placed the bar at entity.scale + 34; for the Crab King that is 314 units below its centre, inside its 336-unit sprite and across the outline ring the game draws for a boss at 0.87-0.97 of the sprite radius. Bosses are measured to the sprite edge; every other entity is unchanged."
  },
  {
    label: "renderBar: game's submerged-boss colour",
    find: `        const color = PlayerManager.isEnemyTarget(myPlayer, target) ? "#cc5151" : "#8ecc51";`,
    replace: `        // A boss below the surface (dive, submerged, rising) takes the blue the
        // game's own boss bar turned for it, so dropping that bar loses nothing.
        const color = entity.isBoss && entity.state >= 1 && entity.state <= 3 ? "#5f87c4" : PlayerManager.isEnemyTarget(myPlayer, target) ? "#cc5151" : "#8ecc51";`,
    why: "The removed top-of-screen bar was the only thing that showed the boss was under water (#5f87c4 while state is 1, 2 or 3, see oh() in the bundle); the under-body bar carries the same cue."
  },
  {
    label: "renderHP offset follows the bar",
    find: `      const offset = entity.scale + nameY + barPad + containerHeight;`,
    replace: `      const offset = this._bodyRadius(entity) + nameY + barPad + containerHeight;`,
    why: "The HP number sits under the bar; it has to move with it for a boss, or it would be drawn inside the Crab King's sprite above its own bar."
  }
];
