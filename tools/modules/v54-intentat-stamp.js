      cand.expected = cand.value;
      // A directed intent is stamped against now, not against whatever frame
      // the engine last built. The engine only builds a frame while it is
      // planning, so with preplace off there is either no frame at all or a
      // stale one, and stamping from it gave the intent a createdTick of 0 —
      // born already past RPE_INTENT_LIFETIME, so its consumer rejected it as
      // "expired" on every tick after the sixth. When the engine is planning
      // the live frame is this tick's and this is the same stamp as before.
      const tick = this.client._ModuleHandler.tickCount;
      const live = this._threat.frame;
      PlacementIntent.stamp(cand, live && live.tick === tick ? live : {
        tick: tick,
        target: null,
        targetId: null,
        targetPos: null,
        myPos: myPos
      }, opts.lifetime);
      return cand;
    }

    // Sends an intent a consumer has already validated.