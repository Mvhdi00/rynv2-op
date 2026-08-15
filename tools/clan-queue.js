  // ==========================================================================
  // Clan joining, one bot at a time.
  //
  // Every bot ran its own two-tick countdown and then sent joinClan, so forty
  // bots all sent inside the same ~200ms. The server takes one and the rest are
  // noise, and nothing ever checked whether a given bot actually got in — the
  // counter just reset and it fired again.
  //
  // This is a single rotation over the bots that are not in yet: one sends,
  // 1.5s passes, its clan name is read back to see whether it worked, and the
  // turn moves on. A bot that failed stays in the rotation and is tried again
  // after everyone else has had a go, which is what stops one stuck bot from
  // blocking the queue behind it.
  //
  // The state is per owner rather than per bot for the same reason the volley's
  // is: the bots have to agree on whose turn it is.
  // ==========================================================================
  const CLAN_QUEUE = new WeakMap;
  const CLAN_TURN_MS = 1500;

  function clanQueue(owner) {
    let q = CLAN_QUEUE.get(owner);
    if (q === void 0) {
      q = {
        current: null,
        nextAt: 0,
        cursor: 0,
        pending: null,
        joined: 0,
        total: 0,
        failed: 0
      };
      CLAN_QUEUE.set(owner, q);
    }
    return q;
  }

  // True when this bot holds the current slot. Whichever bot ticks first once
  // the slot has expired does the bookkeeping for everyone: it grades the bot
  // that just went, then hands the turn to the next one that still needs it.
  function clanTakeTurn(owner, bot, ownerClan, now) {
    const q = clanQueue(owner);
    const bots = [ ...owner.clients ];
    q.total = bots.length;
    if (bots.length === 0) return false;

    if (now < q.nextAt) {
      return q.current === bot;
    }

    // Grade the bot whose slot just ran out. Reading its clan name back is the
    // whole verification — there is no join acknowledgement to listen for.
    if (q.pending !== null) {
      const ok = q.pending.myPlayer && q.pending.myPlayer.clanName === ownerClan;
      if (!ok) q.failed += 1;
      q.pending = null;
    }

    // Count who is in, and find the next one who is not, starting after whoever
    // went last so a failure goes to the back of the queue rather than being
    // retried immediately.
    let joined = 0;
    for (let i = 0; i < bots.length; i++) {
      const p = bots[i].myPlayer;
      if (p && p.clanName === ownerClan) joined += 1;
    }
    q.joined = joined;

    let next = null;
    for (let step = 0; step < bots.length; step++) {
      const i = (q.cursor + step) % bots.length;
      const candidate = bots[i];
      const p = candidate.myPlayer;
      if (!p || !p.inGame) continue;
      if (p.clanName === ownerClan) continue;
      next = candidate;
      q.cursor = (i + 1) % bots.length;
      break;
    }

    q.current = next;
    if (next === null) {
      // Everyone is in. Idle until something changes.
      q.nextAt = now + CLAN_TURN_MS;
      return false;
    }
    q.pending = next;
    q.nextAt = now + CLAN_TURN_MS;
    return q.current === bot;
  }

  // Used by the Re-check button and by the bot counter in the HUD.
  function clanAudit(owner) {
    const q = clanQueue(owner);
    const ownerClan = owner.myPlayer ? owner.myPlayer.clanName : null;
    const bots = [ ...owner.clients ];
    let joined = 0, alive = 0;
    for (let i = 0; i < bots.length; i++) {
      const p = bots[i].myPlayer;
      if (!p || !p.inGame) continue;
      alive += 1;
      if (ownerClan !== null && p.clanName === ownerClan) joined += 1;
    }
    q.joined = joined;
    q.total = bots.length;
    return {
      joined: joined,
      alive: alive,
      total: bots.length,
      clan: ownerClan
    };
  }

  // Drop everything and start the rotation over from the top. Bots already in
  // the clan are skipped by the turn picker, so this costs nothing for them.
  function clanRecheck(owner) {
    const q = clanQueue(owner);
    q.current = null;
    q.pending = null;
    q.cursor = 0;
    q.nextAt = 0;
    q.failed = 0;
    return clanAudit(owner);
  }
