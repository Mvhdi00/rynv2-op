# Ryn private server

kookywarrior's moomoo.io private server (MIT, see `LICENSE`), run by Ryn Type 2
inside the page instead of as a Node program. Lobby → Mode → **Private** reloads the
tab into it; Play and Ryn's bots then connect to it instead of moomoo's servers.

In private mode the game's join step (`POST api…moomoo.io/join`) is answered by Ryn
itself, for guests and signed-in players alike, so nothing reaches moomoo's join
server and a refusal there does not keep you out of your own server.

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

## Synced with the current game (12d386a8)

Checked table by table against the game bundle (parsed statically, nothing run):

- Hats: Scout Hat (59), Frost Helm (60), Crab Shell (61). The Crab Shell cannot be
  bought; killing the Crab King gives it.
- Animals: Boar (9), Yeti (10, in the snow), Crab King (11), Sheep (12), Crab (13),
  Crabling (14), with the game's stats.
- Emerald weapon tier (30000 XP): poison and 15% lifesteal on melee hits.
- Weapon and item upgrade prerequisites (`pre`), group sandbox limits, the game's
  view range (1920x1080) and skin colours.
- The arena west of the map (`config.secretPool`): through the gorge at the river,
  five pools and the passage behind the waterfall. The river is calm in its last
  700 units, so the gorge can be walked into. Nothing can be built in it, and the
  King's whole body stays west of the map edge.

## Crab King

The game only draws the King: its state (1 going under, 2 under water, 3 coming up)
and warnings sent as `W [kind, x, y, r, ms, x2, y2]` - 3 a slam, 4 a charge line,
1 a ring, anything else a splash where it surfaces. Its behaviour here is built on
those and is ours, not moomoo's: slam when you are close, charge along a line, a
ring under you, dive and come up under you, and crabs every 15 seconds (eight at
most). It cannot be hurt under water and comes back 3 minutes after it dies.

## Admin commands

The page owner is admin. `!help` lists everything. Added by Ryn:

| Command | |
|---|---|
| `!ping <ms> [jitter]` | fake round-trip ping for you and your bots, `0` turns it off; kept across reloads |
| `!spawn <animal> [count]` | in front of you; crabs and the King go to the arena |
| `!hp <n> [sid]`, `!heal [sid]`, `!god [sid]` | health and god mode, yours by default |
| `!age <n> [sid]`, `!res <amount> [sid]` | age with its upgrade points, all resources |
| `!hat <id> [sid]`, `!acc <id> [sid]` | equip anything, `0` takes it off |
| `!arena` | into the Crab King's arena |

Also fixed: `!mobs off`, `!hostile off` and `!bosses off` sent packet `'11'` per
animal, which is the game's "you died" packet; removed animals now just drop out
of view.

## Admin panel

In private mode the game's own admin button (`#adminButton`, hidden for normal
accounts) is shown and opens Ryn's admin panel instead of the game's. The panel
drives the server through the owner's connection (`conn.rynCommand`, which feeds
the chat handler; `conn.rynState` for players and world switches), and server
replies to the owner go to the panel (`conn.rynNotice`) instead of the game's gold
notice. Everything in `!help` has a button; the panel can be dragged anywhere and
holds your own buttons (several commands each, optional hotkey).
