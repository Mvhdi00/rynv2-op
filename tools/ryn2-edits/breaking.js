/*
 * Breaking felt slow. During a quiet spell (nobody in view moving, so the 2025
 * server sends no player update) RYN runs its own ticks, 89 ms after the server
 * tick each one stands for, and the reload send-ahead only covered the round
 * trip. Every swing of a break, a grind or a farm then waited one tick longer
 * than its reload: 5 ticks instead of 4 with a tool hammer. The send-ahead now
 * covers that lag as well. Ticks the server actually sends are unchanged.
 *
 * Edits are anchored on the build after tools/build-ryn2.js's own edits.
 */
module.exports = [
  {
    label: "SocketManager: remember whether the last tick was synthetic, expose its lag",
    find: `    _emptyAt=0;
    _watchTicks(args) {`,
    replace: `    _emptyAt=0;
    // Whether the tick RYN ran last was one of its own (_quietTick) rather than
    // the server's update. Set where each kind of tick is run, and read by the
    // modules that tick runs, which run a moment after it.
    _synthetic=false;
    /* How far behind the server's own tick the tick RYN is running now is
     * being decided. A real update is acted on as it arrives, so nothing. A
     * synthetic tick stands in for the server's tick k + 1 and lands 89 ms
     * after that tick's update would have (the 200 ms grace above, less the
     * tick it stands in for), so a frame sent from it reaches the server 89 ms
     * later than one sent from a real tick would. Anything that sends a tick
     * early to cover the round trip has to cover this as well. */
    get tickLag() {
      return this._synthetic ? 200 - this.TICK : 0;
    }
    _watchTicks(args) {`
  },
  {
    label: "SocketManager: a real player update is a real tick",
    find: `       case "a":
        this._tick(decoded[1]);`,
    replace: `       case "a":
        this._synthetic = false;
        this._tick(decoded[1]);`
  },
  {
    label: "SocketManager: a quiet tick is a synthetic tick",
    find: `      try {
        this._tick([ [], [], [] ]);`,
    replace: `      this._synthetic = true;
      try {
        this._tick([ [], [], [] ]);`
  },
  {
    label: "Reloading: send-ahead covers the synthetic tick's lag",
    find: `      const pingAccount = Math.floor(SocketManager2.pong / SocketManager2.TICK);`,
    replace: `      // Ticks to send ahead by: the round trip, plus, on a tick RYN ran itself
      // because the server had nothing to say, the time that tick already runs
      // behind the server's (SocketManager.tickLag). Without the second term a
      // swing decided on a quiet tick reached the server just after the tick
      // it was meant for whenever the round trip ran more than 22 ms past a
      // whole number of ticks (22-110 ms, 133-220 ms), and every swing of a
      // break, a grind or a farm then stood one tick longer than its reload.
      const pingAccount = Math.floor((SocketManager2.pong + SocketManager2.tickLag) / SocketManager2.TICK);`
  }
];
