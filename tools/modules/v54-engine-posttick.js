      // Housekeeping before the gate, not after it. The ledger's only expiry
      // used to sit below this early return, so with preplace off every
      // reservation ever made — and every place() makes one through
      // ModuleHandler._notePlacement — outlived its ttl forever. Anything that
      // asks the ledger whether ground is free then gets a permanent no. Spike
      // tick is the caller that noticed. This changes nothing about how
      // preplace or replace decide anything; it only stops entries outliving
      // the two or three ticks they were granted.
      this.ledger.expire(this.client._ModuleHandler.tickCount);
      if (modes.length === 0) {
        if (this.book.records.length) this.book.invalidateAll("disabled", this);
        return;
      }
