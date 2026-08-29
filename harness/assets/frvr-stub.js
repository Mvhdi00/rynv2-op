/* Stand-in for the FRVR SDK the real page loads before the game bundle.
 *
 * boot-check.js sets up its own version of this before the page's scripts run,
 * to put the SDK into a state the real site can be in. This file is a page
 * script, so it used to run afterwards and quietly overwrite it — every mode
 * that test thought it was exercising was really the healthy one. Stand aside
 * when someone has already staged a mode. */
if (!window.__frvrMode) {
  window.frvrSdkInitPromise = Promise.resolve();
  window.FRVR = {
    bootstrapper: { complete() {} },
    tracker: { levelStart() {}, levelEnd() {} },
    ads: { show() { return Promise.resolve(); } },
    channelCharacteristics: { allowNavigation: true },
    setChannel() {},
  };
  window.turnstile = {
    render() { return "stub"; },
    reset() {},
    remove() {},
    getResponse() { return "stub-token"; },
  };

}
