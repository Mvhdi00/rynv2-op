# Tests

```
node tests/ports.test.js       # 31 assertions across the five Novastorm ports
```

The suite lifts the classes under test straight out of the built userscript by
source range and runs them in a VM against a stub client — `AntiInsta`,
`Automill`, the `Vector` class, the item and hat tables and the spatial grid are
the exact lines that ship, not reimplementations. If the build drifts, the range
lookups throw rather than silently testing nothing.

# Build

`RYN_v5.4.user.js` is generated, not hand-edited:

```
node tools/apply-novastorm-ports.js src/RYN_Client_v5.3.js RYN_v5.4.user.js
```

`src/RYN_Client_v5.3.js` is the unmodified v5.3 client. The script applies 21
exact-string edits, each asserted to match exactly once, so a change to the base
file fails the build instead of quietly dropping a feature. Everything the script
does not name is byte-identical to v5.3 — including the whole
`AutoPlacer` / preplace / replace path.
