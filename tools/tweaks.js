/*
 * tweaks.js
 *
 * Preferences the user asked for, as opposed to repairs (tools/repairs.js):
 * nothing here is broken in the base, it is just set the way they want it.
 * Applied by tools/fix-ryn.js after the repairs.
 *
 *   pool50       the token pool holds up to 50, and 50 by default
 *   quietChecks  the bottom-right corner stays empty unless Cloudflare wants a
 *                click
 */

const GROUPS = { pool50, quietChecks };

function apply(editor, groups = Object.keys(GROUPS)) {
  for (const name of groups) {
    if (!GROUPS[name]) throw new Error("no tweak named " + name);
    GROUPS[name](editor);
  }
}

/* ------------------------------------------------------------------ *
 * The token pool: 50, and 50 by default
 *
 * Refilling needs nothing: the keeper tops the shelf back up to the target
 * every 2.5 s, and every token taken starts a refill, for as long as the pool
 * is on and you are in a game.
 * ------------------------------------------------------------------ */

function pool50(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "pool: 50 by default, 50 at most",
    `  const TURNSTILE_POOL_DEFAULT = 4;
  const TURNSTILE_POOL_MAX = 24;`,
    `  const TURNSTILE_POOL_DEFAULT = 50;
  const TURNSTILE_POOL_MAX = 50;`
  );

  edit(
    "pool: the setting's default is 50",
    `    _tokenPoolTarget: 4,`,
    `    _tokenPoolTarget: 50,
    // Set once the stored pool size has been moved to 50 (see below).
    _tokenPool50: false,`
  );

  edit(
    "pool: the slider goes to 50",
    `id=\\"_tokenPoolTarget\\" type=\\"range\\" step=\\"1\\" min=\\"1\\" max=\\"24\\"`,
    `id=\\"_tokenPoolTarget\\" type=\\"range\\" step=\\"1\\" min=\\"1\\" max=\\"50\\"`
  );

  /* Every setting is saved at load, defaults included, so a size stored before
   * this — the old default 4, or one the old cap of 24 clipped — would win over
   * the new default. It is moved to 50 once; anything set after that is kept. */
  edit(
    "pool: a stored size from before is moved to 50 once",
    `  const settings = {
    ...defaultSettings,
    ...storedSettings
  };`,
    `  const settings = {
    ...defaultSettings,
    ...storedSettings
  };
  if (!settings._tokenPool50) {
    settings._tokenPoolTarget = 50;
    settings._tokenPool50 = true;
  }`
  );
}

/* ------------------------------------------------------------------ *
 * A quiet corner
 *
 * Every Cloudflare check and every bot attempt has a card in the bottom-right
 * dock. Now a card is only seen while it carries `ryn-cf-ask` — which RynCF
 * sets when Cloudflare wants a click (before-interactive-callback) and takes
 * off when the click is done — so nothing shows while checks run on their own.
 *
 * Hidden with opacity, not display or position: the widget inside has to stay
 * laid out and on screen for Cloudflare to finish a check that needs no click.
 * `!important` because the cards fade in with an animation that would
 * otherwise set their opacity back.
 *
 * What the cards used to say when something went wrong still goes somewhere:
 * a bot's failure to the console and the small toast, a pool check's to the
 * console (the pool backs off and tries again on its own).
 * ------------------------------------------------------------------ */

function quietChecks(editor) {
  const edit = (label, find, replace) => editor.edit(label, find, replace);

  edit(
    "quiet: a card is seen only while Cloudflare wants a click",
    "@keyframes ryn-cf-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n`;",
    "@keyframes ryn-cf-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n" +
      "#ryn-cf-dock .ryn-cf-card:not(.ryn-cf-ask) { opacity: 0 !important; pointer-events: none !important; }\n" +
      "#ryn-cf-dock .ryn-cf-more { display: none !important; }\n`;"
  );

  edit(
    "quiet: a bot's failure goes to the console and the toast",
    `        fail: (text, retry) => {
          if (att.closed) return;
          att.host.style.display = "none";
          att.say(text, "bad");`,
    `        fail: (text, retry) => {
          if (att.closed) return;
          // Its card is not shown, so the reason is said where it is seen.
          try {
            rynBotNotice(att.label + ": " + text);
          } catch (_) {}
          att.host.style.display = "none";
          att.say(text, "bad");`
  );

  edit(
    "quiet: a pool check's failure goes to the console",
    `        if (error && error.message !== "cancelled") {
          this._say(job, error.message, "bad");`,
    `        if (error && error.message !== "cancelled") {
          try {
            console.warn("[RYN] " + job.kind + " (" + job.label + "): " + error.message);
          } catch (_) {}
          this._say(job, error.message, "bad");`
  );
}

module.exports = { apply, GROUPS };
