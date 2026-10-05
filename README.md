# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

This repo also builds **`Luna_Client.user.js`** — Luna 1.1 with Ryn Type 2's
Music page and Ryn's LRC AI. See [Luna Client: Music page](#luna-client-music-page).

---

## Why RYN is the base

The two clients are not the same kind of thing:

| | RYN Client v4 | Luna Client 1.1 |
|---|---|---|
| Form | Userscript that rewrites the game bundle at load | A fork of the whole game bundle |
| Protocol | Per-connection opcode permutation + truncated-HMAC frame prefix | Plain msgpack `[type, args]` |
| Runs on the current game | Yes | No |

The game shipped in `src/game_index.js` negotiates an opcode table per
connection (`io-init[3] === 1`), permutes the c2s/s2c alphabets from a seed,
and prefixes every client frame with 6 HMAC bytes. Luna 1.1 predates that
transport entirely — it is a fork of the old webpack `bundle.js` and cannot
connect to the current game at all.

So Luna's code could not be merged in as code. Its features were ported across
onto the RYN core instead, and everything else in RYN was left alone.

## What the mix changes

### Ported from Luna

| Feature | Where it lives |
|---|---|
| **Username Cycler** | Misc → ReUp Mix. Advances `#nameInput` through a comma-separated list on every spawn. |
| **Spike Rotation / Mill Rotation** | Misc → ReUp Mix. Off freezes spinning spikes and mills so their hitboxes are readable. |
| **Menu themes** | Misc → ReUp Mix. Five accent presets (Ryn / NVG / Ice / Red / Void). |

Luna features that were **not** ported, and why:

- *Song / auto-chat lyric loop* — RYN already has a fuller version of this
  (the Music page, with chunked chat sending and session tracking).
- *Autoplacer / preplace / replace* — see below; RYN's `AutoPlacer` **is**
  Luna's placer, ported.
- *Killchat, shame combat, anti-KB, autobuy, pathfinding, AI movement /
  spikepush* — already present in RYN, in several cases as direct ports
  (`LunaPathfinder`, `LunaSafeWalk`).
- *"ai hat predict" (`autsh1`) and "ai triangulation" (`triangle2`)* — these
  are menu entries in Luna with no implementation behind them. Nothing to port.

### The placer

Luna's placer was already ported into RYN before this merge — `AutoPlacer`
carries Luna's function set under RYN's naming (`getConfig` → `_getConfig`,
`canPlace` → `_canPlace`, `addPredictObject` → `_addPredictObject`,
`getPrePlaceAngles` → `_getPrePlaceAngles`, `getPrePlaceObject` →
`_getPrePlaceObject`), rebuilt on RYN's spatial grid. Luna's whole placer menu
is present and then some:

| Luna | ReUp Mix |
|---|---|
| `autoPlace` | `_autoplacer` |
| `placeRange` | `_autoplacerRadius` |
| `prePlace` | `_preplacer` |
| `prePlace2` (replace) | `_replacer` |
| — | `_placeAttempts`, `_glotusPlacer`, `_placerRetrapCombo` |

`_lunaExactPlacer` picks between the two decision sets: **on** restricts spike
placement to Luna's original conditions, **off** (the default) adds RYN's extra
heuristics — seals-exit, double-spike, bounces-onto-spike, touches-enemy.

**Bug fixed in the placer.** `AutoPlacer._isItemLimit` read
`group.sandboxLimit || 99` and never looked at `group.limit`. Outside sandbox
that made the cap 99 for everything without a `sandboxLimit` — spikes (real
limit 15), traps (6), turrets (2), mines (1) — and 299 for the three that have
one. The limit gate effectively never fired, so the placer kept spending
placement ticks on items it could not place.

This came straight from Luna, which has the same expression. The rest of the
client already gets it right: `ClientPlayer.getItemCount` picks `sandboxLimit`
only when actually in sandbox and falls back to `group.limit` otherwise, and
`AutoRetrap._isItemLimit` is written against that. `AutoPlacer` now makes the
same call, so all three agree.

### Driver correction

`ItemGroups[8]` — the platform group — carried `layer: -1` in RYN. The shipped
bundle has `layer: 1`.

That value is not cosmetic: `PlayerObject` reads `ItemGroups[itemGroup].layer`
straight into its own `.layer`, which the collision and placement paths key
off, so a platform was being treated as a pass-under layer like traps and boost
pads. Corrected to `1`.

This was the only mismatch across item groups, weapons, items, hats,
accessories, and config — see [Verification](#verification).

### Removed

RYN v4 opened with this:

```js
if (!localStorage.getItem("_ryn_sent")) {
  fetch("https://webhook.site/d1428dcc-.../?t=" + Date.now());
  localStorage.setItem("_ryn_sent", "1");
}
```

A first-run ping to a third-party webhook endpoint, fired before anything else
and never surfaced to the user. It carries no payload beyond the hit itself,
but nothing in the client needs it. It is stripped from the build.

---

## Luna Client: Music page

`Luna_Client.user.js` is the Luna 1.1 build that runs on the current protocol
(`src/Luna_Client_1.1_fixed.js`) with Ryn Type 2's **Music** page, and Ryn's
**LRC AI** lyrics module, added to its menu as a new **music** tab.

### What came over from Ryn

- **Now playing** — equalizer art, title / artist, like and save, previous /
  play-pause / next, loop, shuffle, seek bar, volume.
- **Library** — every song with like / save / delete, and filter chips
  (All songs, ♥ Liked, ★ Saved).
- **Add song** — title, artist, a URL or a local file (up to 20 MB), an `.lrc`
  file or pasted lyrics, "auto-play and sync when added", Save lyrics, and
  Ryn's step-by-step guide.
- **Chat sync** — one switch that types each lyric line into chat as the song
  reaches it. Lines longer than chat's 30 characters are split and spread
  across the gap to the next line; no two lines go out closer than 1.5 s.
  Plus Auto delay, a manual delay slider, Test chat, Send All Lyrics and a
  debug log.
- **Backup & restore** — export to JSON and import back. A backup exported from
  Ryn imports too.
- **LRC AI** — Ryn's module, verbatim, and behaving as in Ryn. Every song has
  an `LRC AI` button; pressing it finds the song's synced lyrics (LRCLIB, then
  NetEase, then Textyl — or the lyrics already pasted into the song), checks
  they belong to it, translates them to English if needed, and caches them.
  From then on the song plays with them in chat sync, with no request.
  `✓ LRC` opens the details panel (source, language, translation, per-song
  offset, Re-fetch, Clear cache); `Retry LRC` asks again after a miss.

### LRC AI: what was changed to fit Luna

`src/luna-music/lrc-ai.js` is Ryn's module copied as-is. The only edits, each
marked `Luna:` in the file:

1. Its database and localStorage keys carry a Luna prefix (`LunaLRCDB`,
   `luna_lrc_*`), so Luna never reads, overwrites or clears Ryn's own lyrics
   cache on the same site.
2. Ryn draws the button and the panel into its menu iframe. Luna's menu has no
   iframe, so they are drawn into the Music page.
3. Its stylesheet is scoped to the Music page, and the details panel is sized
   to Luna's 900×620 menu instead of the screen, so it shows whole there.
4. Luna's player already drops queued chat parts on every seek; one line in
   the seek hook follows that, so a per-song offset still applies live after a
   seek.

The player needed one change for it: when the library loads it now keeps the
`lrcId` / `lrcHash` / `lrcTags` fields Ryn's module stores on each song (as
Ryn's player does), so cached lyrics are found again after a reload.

### Left out, as asked

- **Bot sync modes** — mixed, bots only, unified and the sync-bot switch. There
  is one chat sync, and it sends from you.
- **Albums** — the album grid, album picker and album filters. Album tags on
  imported Ryn songs are dropped.
- **LRC AI** — the automatic lyrics fetch / translate module.

### Where it differs from Ryn, and why

A few things in Ryn's page were present but did nothing, or broke; they work
here:

- **Auto delay** had a switch and no code behind it. Here it sends each line
  early by your measured ping, so it lands in chat on the beat.
- **Status messages** ("Title required", "Could not load this song", …) went to
  an element that did not exist. They now show as a toast.
- **Artist** was asked for in the form but never saved.
- **★ Save** set a flag nothing used. It now has its own filter.
- **Debug log** was an empty box. It now logs each line and whether it was sent
  or dropped.
- **Save lyrics** with an empty box wiped the song's lyrics. It now refuses.
- **Deleting the playing song** left it resumable. It now stops.
- **Song titles and artists** were written in as HTML, so an imported backup
  could inject markup. They are written as text.
- The Web Audio graph is gone. It only ever connected the first song, and that
  song went silent after a seek. Volume works the same way without it.

And a few adaptations to Luna:

- Luna's menu is in the game page, not an iframe like Ryn's. Typing in the
  page's text boxes no longer reaches the game's keys (so "v" does not place a
  spike and Enter does not open chat), and the mouse wheel scrolls the page
  instead of zooming the game.
- Luna's menu grid had no row size, so a tab taller than the menu was clipped
  instead of scrolling. The row is now pinned to the menu's height.
- The seek bar sits on its own line, because Luna's fixed 900 px menu left it
  about 100 px wide inline.
- The page's accent follows Luna's theme. Volume, loop, shuffle, delay and auto
  delay are saved with Luna's settings. Chat sync always starts off, so a
  reload never starts typing into chat by itself.
- The library is stored in its own IndexedDB database (`LunaMusicDB`), separate
  from Ryn's.

### How it is wired

The page lives in `src/luna-music/` as plain files: markup, stylesheet,
player, and Ryn's `lrc-ai.js`, which attaches to the player by wrapping
`play`, `seekTo`, `_renderSongList` and `_save`, exactly as in Ryn.
`tools/build-luna.js` splices them into the Luna base. As with the ReUp build,
every edit is anchored to an exact string, and a missing or ambiguous anchor
fails the build. The menu is built outside `app.js`, so `app.js` exports a small
`window.__lunaMusicChat` bridge next to Luna's other `window.*` exports. Chat
goes out through Luna's own `sendChat()`, the same packet the chat box sends.

```sh
node tools/build-luna.js           # produce Luna_Client.user.js
node tools/test-luna-music.js      # headless Chromium; needs playwright
```

`test-luna-music.js` mounts the Music module and Luna's menu from the build on a
blank page, with a recorder standing in for the chat bridge. It covers playback,
sync timing and line splitting, nothing sent out of game, library actions,
filters, Save lyrics, Send All Lyrics, export / import, persistence across a
reload, and the key and wheel guards.

For LRC AI it answers LRCLIB and Google Translate itself, in the shapes those
services return, and checks Ryn's behaviour: nothing is requested until the
button is pressed; the button finds a Japanese song, translates it, and the
playing song switches to English at once; chat sync then sends the English
lines on time; the details panel, and a live offset after a seek; replays and
reloads served from the cache with no request; a miss remembered and retried
only by the button; pasted Spanish lyrics translated without a search;
"Translation unavailable" when no translation service answers; Clear cache;
and Ryn's own cache left untouched.

`test-luna-chat-e2e.js` covers what that one cannot: whether chat sync
actually reaches the game. It loads the **whole** `Luna_Client.user.js` into a
stand-in moomoo page and connects it to a local WebSocket server that speaks
the game's protocol (io-init handshake, spawn). The server checks every frame
the way the game server must: the 6-byte HMAC-SHA256 signature with Node's own
crypto, the sequence number, and the opcode through tables built by the game's
own functions taken from `src/game_index.js`. Checked: each lyric line arrives
as the game's chat packet, at most 30 characters, within ±0.25 s of its
timestamp (±0.1 s in practice); Test chat and Send All Lyrics arrive; nothing
is sent while dead; and an LRC AI timeline arrives in English.

```sh
node tools/test-luna-chat-e2e.js   # headless Chromium + local game server
```

### Chat limits compared with Ryn

The chat path uses Ryn's numbers: 30 characters a message (the game's own
client cuts chat at 30 too), long lines split by Ryn's `_wrapText` and spread
across the gap to the next line (1.6–2.6 s apart), never two lines within
1.5 s, 2.2 s between the parts of one line, 2.3 s for Send All Lyrics. Run
side by side on 2,010 lyric files (10 written by hand, 2,000 random), Ryn's
player and Luna's sent the same messages at the same moments in every case.

Two differences remain, both outside the limits. Auto delay sends each line
early by the measured ping (Ryn's switch did nothing). And a line carrying two
timestamps (`[00:12.00][01:40.00]chorus`) goes out cleanly at both times;
Ryn sends it once, with the second timestamp in the text.

The real lyrics and translation services were not reachable from the
environment this was built in, so they are mocked in both tests. That code is
Ryn's, unchanged.

---

## Layout

```
ReUp_Mix.user.js             the build output — this is the script to install
Luna_Client.user.js          Luna 1.1 + Music page + LRC AI build output
drivers/game-drivers.json    protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js         base client (input)
src/Luna_Client_1.1.js       Luna client, kept for reference (input)
src/Luna_Client_1.1_fixed.js Luna 1.1 on the current protocol (input to build-luna)
src/luna-music/              the Music page: music.html, music.css, music-player.js, lrc-ai.js (Ryn's)
src/game_index.js            game bundle: protocol, data tables, engine
src/game_vendor.js           game bundle: msgpack codec, polyfills
tools/extract-drivers.js     game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js      client tables vs. drivers/game-drivers.json
tools/check-hooks.js         client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js          src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-luna.js          src/Luna_Client_1.1_fixed.js + src/luna-music -> Luna_Client.user.js
tools/test-luna-music.js     headless test of the Music page in the Luna build
tools/test-luna-chat-e2e.js  whole Luna build against a local game server: chat on the wire
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
node tools/build-luna.js         # produce Luna_Client.user.js
```

Every edit in `build-reup.js` is anchored to an exact string in the base
client, and an anchor that is missing or ambiguous fails the build. Dropping in
a newer RYN will surface as a build error rather than a half-merged script.

## Verification

```sh
node tools/verify-drivers.js ReUp_Mix.user.js
node tools/check-hooks.js ReUp_Mix.user.js     # needs: npm i --no-save terser
node --check ReUp_Mix.user.js
```

Current state of the build:

- **Drivers** — hats (46), accessories (21), weapons (16), items (23), item
  groups (14) and 42 scalar config keys all match `src/game_index.js`. The
  client also carries the right frame-signature width, transport mode, table
  salt, and both opcode alphabets.
- **Hooks** — 36/36 bundle-rewrite hooks bind, including the new
  `objectRotation` hook and the pre-existing `freezeTurnSpeed`, which now
  resolves to the animal turn-rate site only.

`check-hooks.js` re-minifies `src/game_index.js` before matching, because the
hook patterns are written against minified code and the bundle checked in here
is beautified. It approximates the shipped asset; it does not reproduce the
original mangled identifiers, which the patterns match generically anyway.

### Runtime drift check

The build embeds a `ReUpDrivers` manifest recording what it was verified
against, and re-checks the observable parts ~15s after load — frame signature
width, transport mode, live opcode table size. A server-side protocol change
shows up as a console warning instead of as packets that quietly stop being
understood.

## Notes

- `_spikeRotation`, `_millRotation` and `_usernameCycler` are excluded from
  Legit Mode — they are cosmetic and naming options, not combat automation.
- Rotation toggles default to **on**, i.e. vanilla behaviour. Luna defaulted
  them off; the mix does not silently change how the game looks on first run.
- `_lowQuality` still freezes all object rotation, as it did in RYN.
