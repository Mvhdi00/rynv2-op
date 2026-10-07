"""Break the fixes on purpose and require the BROWSER test to go red.

The static checks (ryn-2025-mutate.py) cover what can be read off the code.
These are the ones that can only be seen by running it: a card that opens
under the lobby, a Turnstile render that gets refused, a masked frame that
decodes to garbage, a player that is never drawn.

    python3 harness/ryn-boot-mutate.py [ryn.js]
"""
import subprocess, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "ryn/Ryn_Type_2.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/ryn_boot_mut.js"
base = open(SRC, encoding="utf-8").read()

MUTATIONS = [
    ("late", "the injector eats the `;` between the two imports (the reported bug)",
     """([^"'\\n]+)\\5/g;""", """([^"'\\n]+)\\5\\s*;?/g;"""),
    ("fast+pinned", "the main socket unmasks the game's shared buffer in place",
     "                bytes = bytes.slice();\n", ""),
    ("fast", "the first ping goes out inside the io-init event",
     "          setTimeout(() => {\n            try {\n              PacketManager2.pingRequest();\n            } catch (_) {}\n          }, 0);",
     "          PacketManager2.pingRequest();"),
    ("fast", "the WebGL renderer is not adopted",
     'Hook.replace("adoptRenderer",', 'false && Hook.replace("adoptRenderer",'),
    ("fast", "the player update is read with the 2024 stride",
     "PlayerManager2.updatePlayer(this.proto2025 === false ? temp[1] : this._players2024(args[0], args[1], args[2]));",
     "PlayerManager2.updatePlayer(temp[1]);"),
    ("fast", "an animal the table does not know is read off undefined",
     "  const animalType = type => Animals_default[type] || ANIMAL_UNKNOWN;",
     "  const animalType = type => Animals_default[type > 11 ? 99 : type];"),
    ("fast", "the server panel reads only the 2024 <select>",
     "        const servers = rynServers();\n        if (servers !== null) {\n          if (!serversHooked",
     "        const servers = null;\n        if (servers !== null) {\n          if (!serversHooked"),
    ("fast", "the API host goes back to api.moomoo.io",
     '    if (pinned || plain) return "https://api-" + (plain || pinned[1]) + "2.moomoo.io";\n', ""),
    ("fast", "FRVR is stubbed and blocked again (no sign-in)",
     "    blockProperty(win, \"onbeforeunload\");\n",
     "    blockProperty(win, \"onbeforeunload\");\n    win.FRVR = { bootstrapper: { complete() {} }, tracker: { levelStart() {} }, ads: { show() { return Promise.resolve(); } }, setChannel() {} };\n    blockProperty(win, \"FRVR\");\n"),
    ("fast", "the Sign in button stays in the menu RYN hides",
     '      const signIn = doc.getElementById("signInButton");', '      const signIn = null;'),
    ("fast", "the account card opens under the lobby",
     '      [ "verifyDialog", "accountCard", "profileCard", "clanCard", "confirmCard" ].forEach(id => lift(id, false));', ""),
    ("late", "the page's own copy renders Turnstile too",
     "        if (fromPage) return \"ryn-page-copy\";\n", ""),
]

print(SRC + " — break it on purpose, confirm the browser test goes red\n")
missed = 0
for mode, label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-62s SKIPPED — anchor matched %d times" % (label, n))
        missed += 1
        continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    r = subprocess.run(["node", "harness/boot-2025.js", mode, MUT], capture_output=True, text=True, timeout=400)
    fails = [l.strip()[4:].strip() for l in r.stdout.splitlines() if l.strip().startswith("FAIL")]
    if fails:
        print("  %-62s caught (%s): %s" % (label, mode, fails[0][:60]))
    else:
        print("  %-62s MISSED (%s) — every check stayed green" % (label, mode))
        missed += 1

print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
