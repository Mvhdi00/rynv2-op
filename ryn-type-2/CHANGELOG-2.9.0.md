# Ryn Type 2 — 2.9.0 changelog

Base: 2.8.0. Game build: index-3d3599b6 / vendor-a3a301f0 / moomoo-protocol s16nvz.

## Batch 1 — Bots while signed in

- **Cause (confirmed in the bundle and in a Chromium test):** signed in, the game only auto-picks
  members-only servers (`Uc()` keeps `auth` servers for a member, `moveOff()` sorts them first,
  `qi()` moves a member from an open server to a members one on refresh). Bots join as guests,
  so 2.8.0's `createSocket` stopped on a 4.5 s toast before any Cloudflare check. In the test,
  2.8.0 put a signed-in player on the members server every time; 2.9.0 puts them on an open one.
- New setting **Prefer servers bots can join** (`_preferBotServers`, default on; Bots → Fleet,
  and a toggle in the lobby's server list when signed in). Three bundle hooks (`botServerPick`,
  `botServerMoveOff`, `botServerRepick`) make the game's own pick prefer non-members servers.
  A server you pick yourself stays yours (the game's own "picked by you" flag is untouched).
  No effect for guests.
- Lobby server list: members-only rows carry a **Members · no bots** tag (signed in) or
  **Members** (guest).
- Spawn Bot / Connect on a members-only server: a notice that **stays until dismissed**, with
  **Switch server** (picks the best open server; in a game it leaves, and presses Play for you
  once the menu is back). Also shown for /join 403 `auth` and socket close 4003.
- Never silent: no live connection, a members-only server and a build mismatch (`b=` vs the
  protocol module's `BUILD_ID`) are each said on screen. 2.8.0 returned without a word.
- **One card per bot attempt** (bottom-right): status line through every wait (pool token,
  Cloudflare slot, check, join, connect), the Cloudflare widget drawn inside it, × cancels the
  whole attempt, and a failure stays on the card with its reason and **Try again**.
- Cloudflare widget like Glotus's bot checks: theme dark, `retry: "never"`,
  `refresh-expired: "manual"`, 180 s timeout (180 s more once it asks for a click).
- Token pool: a failed round now backs off (5 s, doubling to 60 s) instead of starting a check
  every 2.5 s; the panel says when it is holding. The reap timeout covers the longer checks.
- Bots never use your account: `/join` gets `{captcha, did, host}` only, at the page's own API
  host (api-prod2 / api-sandbox2 — the host Ryn's server list comes from).
- New hook `exposeAccount` (`RYN._account`, the game's account object).
