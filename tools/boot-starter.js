/**
 * The deferred-boot preamble every repaired mod ships.
 *
 * These scripts install their transport at document-start -- they have to, the
 * bundle captures WebSocket.prototype.send once at load -- but their bodies
 * build menus and read the page, so the body waits.
 *
 * What it waits FOR is the part that took two rounds to get right. The first
 * version waited for `readyState !== "loading"` and `#gameUI`, which sounds
 * like "the page is ready" and is not the same thing as "the bundle has run".
 * The bundle is a deferred module: readyState stops being "loading" when
 * parsing ends, and deferred modules run *after* that. So the two could land
 * either way round, and which one won was a coin toss decided by how fast the
 * bundle came off the network -- the same install working on one refresh and
 * not the next. Booting first is not harmless: CaraMila dereferences elements
 * the bundle creates and dies on the spot, and a client replacement's renderer
 * ends up underneath the bundle's, which paints over it every frame.
 *
 * The bundle sets `window.loadedScript = !0` before it starts its own render
 * loop, so that is the marker. `readyState === "complete"` is the way out if
 * the bundle never arrives -- by then every deferred script has run or failed.
 *
 * One source for all three builders, so they cannot drift apart again.
 */
function bootStarter(name) {
  return `
(function ${name}Start(tries) {
    tries = tries || 0;
    var page = document.readyState !== "loading" && document.getElementById("gameUI");
    var bundle = window.loadedScript === true || document.readyState === "complete";
    if ((!page || !bundle) && tries < 400) {
        return setTimeout(function () { ${name}Start(tries + 1); }, 50);
    }
    ${name}();
})();
`;
}

module.exports = { bootStarter };
