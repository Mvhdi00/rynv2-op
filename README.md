# ReUp Mix (Luna × Ryn)

A merged moomoo.io userscript: the RYN Client v4 core with the Luna Client
features RYN never had, built against the game bundles in `src/` and verified
against them.

Build output: **`ReUp_Mix.user.js`**

The repo also carries a second, unrelated build —
[**LRC AI Lyrics**](#lrc-ai-lyrics-ryn-type-2), which adds automatic
synchronised lyrics to Ryn Type 2's Music library. It shares nothing with the
mix but this repository.

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

## Layout

Both builds, and everything they are built from:

```
ReUp_Mix.user.js          ReUp Mix build output
Ryn_Type_2_LRC.user.js    Ryn Type 2 + LRC AI build output
drivers/game-drivers.json protocol + data tables extracted from the game bundle
src/RYN_Client_v4.js      base client (input)
src/Luna_Client_1.1.js    Luna client, kept for reference (input)
src/Ryn_Type_2.user.js    Ryn Type 2, unmodified (input)
src/lrc/lrc-ai.js         the LRC AI module (input)
src/game_index.js         game bundle: protocol, data tables, engine
src/game_vendor.js        game bundle: msgpack codec, polyfills
tools/extract-drivers.js  game bundle  -> drivers/game-drivers.json
tools/verify-drivers.js   client tables vs. drivers/game-drivers.json
tools/check-hooks.js      client's bundle-rewrite hooks vs. the game bundle
tools/build-reup.js       src/RYN_Client_v4.js -> ReUp_Mix.user.js
tools/build-lrc.js        src/Ryn_Type_2.user.js + src/lrc -> Ryn_Type_2_LRC.user.js
tools/test-lrc.js         headless test suite for the LRC AI module
```

## Build

```sh
node tools/extract-drivers.js    # refresh drivers from src/game_*.js
node tools/build-reup.js         # produce ReUp_Mix.user.js
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

---

# LRC AI Lyrics (Ryn Type 2)

A second, independent build in this repo: **`Ryn_Type_2_LRC.user.js`** — Ryn
Type 2 with automatic synchronised lyrics for the Music library.

Today the Music page asks the user to do four things by hand: find the song,
find its `.lrc` on lrclib.net, download it, and paste it in. The guide in the
"Add song" section spells all four out. This automates every one of them, and
adds the step nobody could do by hand — translating the lyrics to English
without moving a single timestamp.

## What it does

Every row in the library gets one extra button:

| Button | Meaning |
|---|---|
| `LRC AI` | nothing cached yet — press to find lyrics |
| `LRC AI: Loading...` | identifying the song, or fetching |
| `LRC AI: Translating...` | translating, with an *n/total* count in the tooltip |
| `✓ LRC` | ready — click for the details panel |
| `LRC: no sync` | lyrics exist, but only unsynchronised ones |
| `Retry LRC` | nothing found, or the file failed validation |

Press it once. After that, playing the song loads the cached English lyrics
and synchronises them against the audio, with no further network traffic and
no further translation — through the player's **existing** chat-sync loop, so
all four sync modes (me / bots / mixed / unified), the 30-character chunking
and the 2200 ms spacing behave exactly as they always have.

`✓ LRC` opens a panel with the song, artist, detected source language,
translation provider, line count, sync status, cache state, lyrics source,
and a per-song **offset** control (−250 / +250 / 0, or type a value). Lyrics
arriving early? Raise the offset. Late? Lower it. The cached `.lrc` is never
edited — the shift is applied to the runtime timeline and takes effect on the
next line, without replaying anything.

## How it integrates

It wraps, it does not rewrite. The module hooks exactly four MusicPlayer
methods — `play`, `seekTo`, `_renderSongList`, `_save` — each of which calls
the original first and then adds lyric behaviour inside a guard. No existing
method body is modified, the Music page's HTML and stylesheet are untouched,
and the diff against the base client is two header lines plus one contiguous
insertion.

It reuses rather than duplicates:

| Need | What it uses |
|---|---|
| sending to chat | `_tickSync` -> `_sendChat` / `_sendLyric*` -> `PacketManager`. There is no second chat path. |
| the sync loop | the player's existing RAF tick. No new interval, no new RAF, no per-frame work added. |
| chat-width reflow | `_reflowLRC`, so a downloaded line is split for the 30-char cap the same way a pasted one is. |
| toasts | `_toast` |
| storage | the same IndexedDB-with-localStorage-fallback pattern as `_openDB` |

Components, each independent: `LRCManager`, `SongIdentifier`, `LRCFetcher`,
`LRCParser`, `LanguageDetector`, `TranslationManager`, `LRCValidator`,
`LRCCache`, `SyncEngine`, `ChatLyricsSender`, `LRCUI`.

## The pipeline

Identify (including the file's own ID3 tags) -> cache check -> source
(pasted `.lrc`, then LRCLIB, NetEase, Textyl in turn) -> parse -> validate ->
detect language -> translate -> validate the translation -> cache -> ready.

**A synced `.lrc` already pasted into the song is the first source tried** —
it is on the machine, it costs no request, and the user chose it deliberately.
That is the answer for a song whose only `.lrc` is in another language: paste
it into the Add-song box, press the button, and get it back in English with
its timestamps untouched. Replacing that pasted file later invalidates the
cache, so the button returns to `LRC AI` instead of serving the old
translation.

**Otherwise three providers are tried in order**, each validated on its own
so one answering with the wrong release falls through to the next instead of
ending the run:

| | Provider | Why it is there |
|---|---|---|
| 1 | [LRCLIB](https://lrclib.net) | Public, key-less, CORS-enabled, and already the provider the Music page's own guide points at. |
| 2 | NetEase Cloud Music | Its Japanese, Korean and Chinese catalogue is far deeper than LRCLIB's — which is exactly where LRCLIB comes up empty. Its own `tlyric` is a Chinese translation and is ignored; the original goes through this module instead, so the output is English rather than a translation of a translation. |
| 3 | Textyl | One request, second-resolution timings. Coarser than a real `.lrc`, so it is last: only reached when the other two have nothing, where coarse beats nothing. |

Synchronised lyrics always win over plain; candidates are scored on title,
artist and duration, and a weak best match is rejected rather than accepted.

**Each provider is asked up to three different ways.** One query is not
enough: a downloaded file's library title is usually just the filename, its
artist field is usually empty, and the artist is often buried in the title as
`Artist - Track`. The query shapes are tried best-first and stop early on a
strong hit.

**The file's own ID3 tags lead that list.** A track ripped off YouTube is
called `【MV】Lemon／米津玄師 (Official Video) [4K]`, which is a poor thing to
search a lyrics database with — while its tags carry `Lemon` and `米津玄師`,
which find it. ID3v2.2/2.3/2.4 and ID3v1 are all read, with the v2 encoding
byte honoured and Shift-JIS attempted for v1 (Japanese taggers wrote it there
for years). It costs no request: the bytes are already in the data URL, and
only the first megabyte plus the last 128 bytes are decoded, so a 20 MB song
is never base64-decoded in full. Tags are used for **searching only** — never
folded into `songId`, which would re-key every song already cached.

**Language detection is offline.** Script ranges settle Japanese, Korean,
Chinese, Arabic, Russian, Hindi, Hebrew, Thai and Greek outright; Latin
script falls through to stopword and diacritic scoring across English,
Spanish, French, German, Portuguese, Italian, Turkish, Dutch, Polish,
Indonesian and Vietnamese. Only when that is not confident does it spend one
request asking a translation provider what it sees. **Lyrics already in
English are never sent to a translator.**

**Translation is one request per _unique_ line**, never a batch that could
come back with a different number of lines than it went out with. Choruses
repeat, so a 60-line lyric is usually 30-40 requests, run 4 at a time.
Providers are tried in order (Google's `translate_a` gtx endpoint, then
Lingva, then MyMemory) and the first that answers is kept for the song. A
line no provider can translate keeps its original words — a timestamp is
never dropped because a request failed.

**Timestamps survive exactly.** Each parsed line keeps the literal bracket
text it came from, and `english.lrc` is written back from that string rather
than from a re-derived number, so `[00:24.999]` stays `[00:24.999]` and not
`[00:24.99]`. Only the words change:

```
[00:12.50]君を忘れない        ->  [00:12.50]I won't forget you
[00:15.20]いつまでも          ->  [00:15.20]Forever
```

## Cache

The brief's `RynData/Lyrics/<SongID>/` layout maps onto IndexedDB, since a
userscript has no filesystem:

```
RynData/Lyrics/<SongID>/metadata.json  ->  RynLRCDB.meta[songId]
RynData/Lyrics/<SongID>/original.lrc   ->  RynLRCDB.lyrics[songId].originalLrc
RynData/Lyrics/<SongID>/english.lrc    ->  RynLRCDB.lyrics[songId].englishLrc
```

`RynLRCDB` is deliberately a **separate database** from the player's
`BeeMusicDB`. Adding a store to that one means opening it at a higher
version, and a second connection doing that can knock the music library's own
connection over — not a risk worth taking for a lyrics cache.

Metadata lives in its own store so one small read paints every button in the
list without pulling any `.lrc` bodies into memory.

Requests happen **only** on `LRC AI` and `Retry LRC`. A failure is cached too,
which is what stops the module retrying by itself: only the button asks again.

## Song identity

A filename is not an identity, so:

```
songId = SHA-256(title | artist | content-hash) truncated to 32 hex
```

The content hash covers a data URL's length plus its head and tail, so two
different files called `song.mp3` cannot share a cache entry — and renaming a
song does not throw its lyrics away.

Duration is deliberately **not** part of the id. It arrives asynchronously
from the audio element, so folding it in would give one song two different
ids depending on whether metadata had loaded yet. It is stored in metadata
instead, where it does the same job better: it is what LRCLIB is asked to
match, what the validator checks the timeline against, and what invalidates a
cache entry when it drifts by more than 5 seconds.

## Validation

Before anything is marked ready: at least one parseable timestamp, at least
three lines carrying words, and timestamps in order and non-negative.

**Is this `.lrc` even for this song?** Three pieces of evidence, strongest
first:

| Evidence | Catches |
|---|---|
| `[length:]` — the file's own claim about the track's duration | A different song whose timeline *shape* would otherwise pass. Language-independent, and the sharpest of the three. |
| `[ti:]` / `[ar:]` — which song the file says it is | An outright wrong file, quoted back in the rejection: *the .lrc is titled "Bohemian Rhapsody", this song is "Lemon"*. |
| The timeline envelope against the real duration | Lyrics running past the end, or covering a fraction of it. |

Two guards against false rejections, both of which matter more than the
checks themselves:

- Names are compared **only against the file's own ID3 tags**, never the
  library title. Songs get named `song1` and `my fav`, and failing a good
  `.lrc` because its `[ti:]` does not match arbitrary user text would be
  worse than the mismatch being hunted. No tags on the file, no name check.
- Names are compared **only when both sides are in the same script**. A
  romanised `[ti:Lemon]` against a title stored as `レモン` is the same song
  and scores zero on token overlap, so that comparison is skipped rather
  than failed.

What confirmed the match is recorded and shown in the details panel, so
"matched by title, artist, track length" is distinguishable from "matched by
track length" — the latter being the case a different song of similar length
could also produce.

The translation must return the same number of lyric events with the same
timestamps; if it does not, the song is not marked ready. Failures surface as
`LRC unavailable` or `No synchronised lyrics found`, with the reason recorded
in the details panel.

## Security

Downloaded lyrics are treated as plain text and nothing else. Control
characters, bidi overrides and zero-width formatting are stripped and lines
are length-capped at parse time, before the text can reach either a chat
packet or the DOM. Every element the module creates is built with
`createElement` / `textContent` — the module never assigns lyric, metadata or
provider text through `innerHTML`.

## Things worth knowing

- **Chat sync is not switched on for you.** Lyrics load and the engine arms
  automatically, but sending them into the game's chat stays behind the
  existing *Chat sync* toggles. The details panel says so when they are off.
- **A song with no `.lrc` anywhere still has the manual route.** Paste one
  into the Add-song box; it is then the first thing `LRC AI` reaches for, and
  gets translated and cached like any other source.
- **Unsynchronised lyrics are labelled, not faked.** If only plain lyrics
  exist they are cached and the button reads `LRC: no sync`; nothing invents
  timestamps for them. A synchronisation engine could be added later without
  touching anything else.
- **A large seek now cancels queued chat chunks.** Jumping more than 3
  seconds bumps `_songSessionId`, which is the player's own guard on its
  pending sends. This applies to hand-pasted lyrics too — previously those
  chunks would arrive late over the new position.
- **Lyrics are found, never invented.** There is no speech-to-text and no
  asking a model to write the words: both would produce a file that looks
  right and does not match the audio, which the brief rules out. When no
  provider has the song, it says so.
- **CORS is unverified against the live services.** The build sandbox's
  network policy blocks every one of these hosts, so the request shapes are
  written from their documented APIs but have not been exercised against the
  real ones. Each provider fails independently and silently, so a host that
  refuses browser origins costs one wasted request and the next provider
  answers; if all of them are blocked the button reads `Retry LRC` rather
  than the client breaking.

## Build and test

```sh
node tools/build-lrc.js     # src/Ryn_Type_2.user.js + src/lrc/lrc-ai.js -> Ryn_Type_2_LRC.user.js
node tools/test-lrc.js      # 188 checks
node --check Ryn_Type_2_LRC.user.js
```

The build verifies all twelve hook sites in the base client before injecting
anything, so dropping in a newer Ryn Type 2 that renamed one of them fails
the build rather than shipping a button that does nothing.

`test-lrc.js` runs the module headlessly against the **real** `_parseLRC`,
`_reflowLRC`, `_wrapText`, `_splitLine`, `_tickSync` and `seekTo`, extracted
verbatim from the base client — so the playback assertions are against the
actual chat loop, not a stand-in for it. It covers the parser (multi-timestamp
lines, metadata, malformed input, precision, round-tripping), language
detection, validation, the binary search, a full Japanese prepare-to-playback
run, seek in both directions, offset, song change, every failure path, ID3
reading (v2.2/2.3/2.4 text encodings, v1 with Shift-JIS, and six kinds of
malformed input), the "is this the right song" checks including both
false-rejection guards, provider fall-through, a pasted `.lrc` as the source (used, translated, invalidated when replaced, and
fallen through when it does not match), storage with IndexedDB refused, and that the wrappers leave a song with
hand-pasted lyrics behaving exactly as before.

---
