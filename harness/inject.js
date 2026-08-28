/* Installs a userscript the way its own metadata block asks for.
 *
 * @run-at matters more than it looks: a document-start script sees a bare
 * document and has to survive that, while a document-idle script runs after the
 * page's own scripts and can lean on them — but has already lost every race
 * against the game bundle. Injecting one the way the other expects produces
 * failures that belong to the harness, not the client.
 */
function runAt(source) {
  const m = source.match(/^\/\/\s*@run-at\s+(\S+)/m);
  return m ? m[1].trim() : "document-idle";
}

/* Call before page.goto. Returns a finish() to call after load. */
async function install(page, source) {
  const when = runAt(source);
  if (when === "document-start" || when === "document-body") {
    await page.addInitScript({ content: source });
    return { when, finish: async () => {} };
  }
  return { when, finish: async () => { await page.evaluate(source); } };
}

module.exports = { runAt, install };
