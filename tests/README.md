# Tests

```
node tests/ports.test.js       # 23 assertions: packets, automill, and the reverted regions
node tests/bots.test.js        # 32 assertions: bot random movement, milling while wandering
node tests/botcombat.test.js   # 69 assertions: auto break, kiting, shields, volley, train, counter, Be Angel
node tests/clan.test.js        # 28 assertions: clan rotation, HUD, Be Angel vs cowboy
```

The suite lifts the classes under test straight out of the built userscript by
source range and runs them in a VM against a stub client — `AntiInsta`,
`Automill`, the `Vector` class, the item and hat tables and the spatial grid are
the exact lines that ship, not reimplementations. If the build drifts, the range
lookups throw rather than silently testing nothing.

# Build

`RYN_v5.4.user.js` is generated, not hand-edited:

```
node tools/build-v5.4.js src/RYN_Client_v5.3.js RYN_v5.4.user.js
```

`src/RYN_Client_v5.3.js` is the unmodified v5.3 client. The script applies 62
exact-string edits, each asserted to match exactly once, so a change to the base
file fails the build instead of quietly dropping a feature. Everything the script
does not name is byte-identical to v5.3 — including the whole
`AutoPlacer` / preplace / replace path.
