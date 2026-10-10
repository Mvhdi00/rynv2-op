# Ryn private server

kookywarrior's moomoo.io private server (MIT, see `LICENSE`), run by Ryn Type 2
inside the page instead of as a Node program. Lobby → Mode → **Private** reloads the
tab into it; Play and Ryn's bots then connect to it instead of moomoo's servers.

`tools/build-private-server.js` wraps these files into the `RynPrivateServer` block
in `RynType2.user.js` and swaps the Node-only modules (`ws`, `http`, `inquirer`,
`node-fetch`, `dotenv`) for in-page shims. Edit here, then:

```sh
node tools/build-private-server.js
```

Changes from the copy it came from:

- `src/utils.js`: the `io-init` handshake had no name in the packet table and went
  out as `null`, so the game never finished connecting.
- `index.js`: players and animals go out in the format the current game reads
  (`a`: positions with dir×100, looks, and the sids that left view; `I`: eight
  fields per animal plus the gone list).
- `index.js`: server chat goes out from sid `-1`, which the game shows as a
  notice; sid `0` matched nobody, so replies never showed.
- `index.js`: the page owner's own connection is admin (`conn.rynOwner`); bots
  are not. `src/config.js` no longer hands admin to a fixed name.
- Messages translated to English; `package` renamed to `pkg` (reserved in strict
  mode).
- `msgpack.js` is the codec from the game's own vendor bundle, replacing
  `msgpack-lite`.
