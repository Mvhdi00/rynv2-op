/* Stand-in for the FRVR SDK the real page loads before the game bundle. */
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
