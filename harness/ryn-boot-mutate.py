"""Break the fixes on purpose and require the BROWSER test to go red.

The static checks (ryn-2025-mutate.py) cover what can be read off the code.
These are the ones that can only be seen by running it: a card that opens
under the lobby, a Turnstile render that gets refused, a masked frame that
decodes to garbage, a player that is never drawn.

    python3 harness/ryn-boot-mutate.py [ryn.js]
"""
import os, subprocess, sys, tempfile

SRC = sys.argv[1] if len(sys.argv) > 1 else "ryn/Ryn_Type_2.user.js"
MUT = os.path.join(tempfile.mkdtemp(prefix="ryn-boot-mutate-"), "ryn_boot_mut.js")
base = open(SRC, encoding="utf-8").read()

# Each entry: (mode, label, old, new) — or, for a mistake that takes more than
# one edit, (mode, label, [(old, new), ...]); an optional last element is
# extra environment for the run.
MUTATIONS = [
    # ── round two: login, frame rate, the numbers ─────────────────────────
    ("late", "the page's own copy of the game runs beside RYN's again",
     "      docProto.createElement = stopPageCopy;\n", ""),
    ("fast+interactive", "the loading screen borrows the Cloudflare box again",
     '    if (document.getElementById("verifyDialog") !== null) {\n      return false;\n    }\n    const widget = document.getElementById("turnstileWidget");',
     '    const widget = document.getElementById("turnstileWidget");'),
    ("late", "the zoom resizes the game every frame again", [
        ("      if (w === this._appliedW && h === this._appliedH) {\n        return;\n      }\n", ""),
        ('Hook.replace("viewport",', 'false && Hook.replace("viewport",'),
    ]),
    ("late", "the HP number is drawn from its left edge again",
     '  const GL2D_PROPS = {\n    font: "30px Hammersmith One",\n    textAlign: "center",',
     '  const GL2D_PROPS = {\n    font: "30px Hammersmith One",\n    textAlign: "start",'),
    ("fast+hidpi", "RYN's overlay is sized by its pixels on a scaled screen",
     "          if (sw && cv.style.width !== sw) cv.style.width = sw;\n          if (sh && cv.style.height !== sh) cv.style.height = sh;\n", ""),
    # ── round three: the ticks the server does not send, the new animals ──
    ("late+grind+quiet", "RYN waits for the server's ticks again (no tick watchdog)",
     "        this._watchTicks(decoded[1]);\n", "", {"NO_BOTS": "1"}),
    ("late+grind+heartbeat", "one empty update stands the tick watchdog down",
     "        if (this._emptyRun >= 3) {", "        if (this._emptyRun >= 1) {", {"NO_BOTS": "1"}),
    ("late+trap", "Trap Animal knows only the 2024 animals again",
     "      return animal.isDanger && animal.canBeTrapped();", "      return [ 2, 3, 4 ].includes(animal.type);", {"NO_BOTS": "1"}),
    ("late+trap", "an animal standing still is nobody's nearest animal again",
     "      if (this.proto2025 === true) {\n        for (const r of this._seenAnimals.values()) {",
     "      if (false) {\n        for (const r of this._seenAnimals.values()) {", {"NO_BOTS": "1"}),
    ("late+trap", "Trap Animal spends a trap on a crab no trap can hold",
     "      return animal.isDanger && animal.canBeTrapped();", "      return animal.isDanger;", {"NO_BOTS": "1"}),
    ("late", "the zoom-out cap is frozen at load again",
     '"const $1={valueOf:function(){return $2*1.15}};"', '"const $1=$2*1.15;"', {"NO_BOTS": "1"}),
    ("fast+pinned", "RynSign signs wrong and never checks itself", [
        ("_K = new Int32Array([ 1116352408, 1899447441,", "_K = new Int32Array([ 1116352409, 1899447441,"),
        ("      if (k.checks < this._CHECKS) {", "      if (false) {"),
    ]),
    ("late", "the injector eats the `;` between the two imports (the reported bug)",
     """([^"'\\n]+)\\5/g;""", """([^"'\\n]+)\\5\\s*;?/g;"""),
    ("fast+pinned", "the main socket unmasks the game's shared buffer in place",
     "                bytes = bytes.slice();\n", ""),
    ("fast", "the first ping goes out inside the io-init event",
     "          setTimeout(() => {\n            // One task on, the bundle has built its session from this io-init.\n            if (own && !own._bundle) own._ready = true;\n            try {\n              PacketManager2.pingRequest();\n            } catch (_) {}\n          }, 0);",
     "          if (own && !own._bundle) own._ready = true;\n          PacketManager2.pingRequest();"),
    ("fast", "the WebGL renderer is not adopted",
     'Hook.replace("adoptRenderer",', 'false && Hook.replace("adoptRenderer",'),
    ("fast", "the player update is read with the 2024 stride",
     "PlayerManager2.updatePlayer(this.proto2025 === false ? args[0] : this._players2024(args[0], args[1], args[2]));",
     "PlayerManager2.updatePlayer(args[0]);"),
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
    ("fast", "the lobby has no Sign in of its own (the empty box beside Play)",
     "        signInButton.hidden = isIn || gameSignIn === null || !shownByGame(gameSignIn);", "        signInButton.hidden = true;", {"NO_BOTS": "1"}),
    ("fast", "the account card opens under the lobby",
     '      [ "verifyDialog", "accountCard", "profileCard", "clanCard", "confirmCard" ].forEach(id => lift(id, false));', ""),
    # Withdrawn, not missed: "the page's own copy renders Turnstile too"
    # (removing wrapTurnstile's `fromPage` refusal). Since the page's own copy
    # is stopped at its first line it never reaches Turnstile, so the refusal
    # is unreachable here — kept in the client as the fallback for a bundle
    # whose first line the stop does not catch, and replaced by a mutation of
    # the stop itself:
    ("late", "the page's module is let run on after RYN's copy has started",
     "        throw stopped;\n      };\n      docProto.createElement = stopPageCopy;",
     "        return nativeCreateElement.apply(this, arguments);\n      };\n      docProto.createElement = stopPageCopy;"),
    # ── round four: a kill, shame, bots on the live join ───────────────────
    ("late+kill", "the corpse is drawn through the sign-in card's opener again",
     'Hook.prepend("renderPlayer", /function (\\w+)\\(\\w+,(\\w+)\\)\\{\\2=\\2\\|\\|\\w+,\\2\\.lineWidth=/,',
     'Hook.prepend("renderPlayer", /function (\\w+)\\(\\w+,\\w+\\)\\{\\w+=\\w+\\|\\|\\w+,/,', {"NO_BOTS": "1"}),
    ("late+heal", "every player's max health is undefined (Math.LN1 left unset)",
     "Math.LN1 = 100;\n", "", {"NO_BOTS": "1"}),
    ("fast+slowclick", "a bot's Cloudflare check gives up after 20 s again",
     '          to = setTimeout(() => fail("nobody answered the Cloudflare check"), 12e4);', '          to = setTimeout(() => fail("turnstile timeout"), 2e4);'),
    ("fast+tserror", "a bot whose check failed falls back on your spent token again",
     '      if (!token) {\n        rynBotNotice("No Cloudflare check for the bot (" + (why || "nothing came back") + "). " +',
     '      if (!token) {\n        token = "cf:" + RYN._myClient._turnstileToken;\n      }\n      if (!token) {\n        rynBotNotice("No Cloudflare check for the bot (" + (why || "nothing came back") + "). " +'),
    ("fast", "bot names lose their number again",
     "    return stem.slice(0, Math.max(1, 15 - tail.length)) + tail;", "    return base;"),
    ("fast", "a bot's name is not checked against taken names",
     "        if (!await this.taken(name)) return name;", "        return name;"),
    ("fast", "a bot joins as a device of its own again, not as this browser",
     "        did: rynDeviceId() || void 0,", "        did: void 0,"),
    ("fast+silentname", "a bot never notices the server ignoring its spawn",
     "          if (!e.renamed) {", "          if (false) {"),
    ("fast+kickname", "a bot turned away by the server is not told why",
     '          rynBotNotice("The server turned a bot away: " + (reason || "no reason given"));\n', ""),
    # ── bots: RYN's own login and its own session ──────────────────────────
    ("fast", "a bot skips /join and connects with the raw captcha token",
     "        let joined = await rynJoinTicket(host, token.slice(3));", '        let joined = { ticket: null, error: "network" };'),
    ("fast+pinned+reshaped", "a bot's session is borrowed from the bundle or not at all (the live-build bug)",
     '    const fn = (a, b) => typeof a === "function" ? a : b;', "    const fn = (a, b) => a;"),
    ("fast+members", "a bot refused as a guest is not told why",
     '          rynBotNotice((RYN_JOIN_REFUSED[joined.error] || "The join API refused this bot (" + joined.error + ").") +\n            (joined.status ? " [HTTP " + joined.status + "]" : ""));\n', ""),
    ("fast+members", "a bot refused as a guest tries the server with the raw token anyway",
     '        } else if (joined.error !== "network") {', '        } else if (false) {'),
    ("fast+busy", "a bot told \"too many joins\" gives up at once",
     '        for (let retry = 1; joined.error === "busy" && retry <= 2; retry++) {', '        for (let retry = 1; false; retry++) {'),
    ("fast", "a bot's socket URL leaves out the build id",
     'url = origin + "/?token=" + encodeURIComponent(token) + (buildId != null ? "&b=" + encodeURIComponent(buildId) : "");',
     'url = origin + "/?token=" + encodeURIComponent(token);'),
    # ── round five: signed in, the live build's drawing, the lobby ────────
    ("fast+signedin", "a bot finds no Cloudflare when the game never loaded it (signed in)", [
        ("  const generateTurnstileToken = () => rynTurnstile().then(() => _mintHiddenToken(), () => _mintHiddenToken());",
         "  const generateTurnstileToken = () => _mintHiddenToken();"),
        ("            rynTurnstile().catch(() => {});\n", ""),
    ]),
    ("fast+signedin", "Cloudflare is loaded only when the first bot asks for it",
     "            rynTurnstile().catch(() => {});\n", ""),
    ("fast+interactive", "a bot's check that wants a click comes to the middle of the screen again",
     '          label = document.createElement("div");\n          label.textContent = "Cloudflare wants a click to let your bot in";',
     '          holder.style.cssText = "position:fixed;left:50%;top:38%;transform:translateX(-50%);width:300px;height:65px;z-index:2147483647;";\n          label = document.createElement("div");\n          label.textContent = "Cloudflare wants a click to let your bot in";'),
    ("late+restyled", "your name is coloured only where the nameColor hook found its code", [
        ("            const color = Renderer._nameColorByText(str);", "            const color = null;"),
        ("      if (performance.now() - this._nameTopAt < 300) return;", "      return;"),
    ], {"NO_BOTS": "1"}),
    ("late+restyled+oddname", "your name is not redrawn from the player when the renderer hides it",
     "      if (performance.now() - this._nameTopAt < 300) return;", "      return;", {"NO_BOTS": "1"}),
    ("late+restyled", "the grid goes only where the RenderGrid hook found its code",
     "      if (origLine !== null) {\n        M.line = function(x1, y1, x2, y2) {", "      if (false) {\n        M.line = function(x1, y1, x2, y2) {", {"NO_BOTS": "1"}),
    ("late+hats+spritefail", "a picture the site refused once stays missing",
     "      const SPRITE_RETRY_MS = [ 1500, 5e3, 15e3 ];", "      const SPRITE_RETRY_MS = [];", {"NO_BOTS": "1"}),
    ("late+boss", "the Crab King has no health bar of its own again",
     'Hook.replace("bossLikeAnimal",', 'false && Hook.replace("bossLikeAnimal",', {"NO_BOTS": "1"}),
    ("late+grind+quiet+lag", "Auto Grind taps on the tick again instead of holding across it", [
        ("      if (reloading.isReloaded(action.weapon, 2)) {", "      if (reloading.isReloaded(action.weapon)) {"),
        ("        ModuleHandler.grindHold = true;\n      }", "        ModuleHandler.shouldAttack = true;\n      }"),
    ], {"NO_BOTS": "1"}),
    ("fast+signedin", "the friends list opens under the lobby",
     "        if (dialog !== null && dialog !== doc.body) {", "        if (false) {", {"NO_BOTS": "1"}),
    ("fast", "Clan and Friends are not in the lobby",
     "      account.appendChild(clanButton);\n      account.appendChild(friendsButton);\n", "", {"NO_BOTS": "1"}),
    ("fast+signedin", "the loading screen holds on a clock after it is ready",
     "    const wait = Math.max(260, MIN_VISIBLE - (Date.now() - openedAt));", "    const wait = Math.max(2600, MIN_VISIBLE - (Date.now() - openedAt));", {"NO_BOTS": "1"}),
    ("fast+signedin", "the loading screen waits for Cloudflare though you are signed in",
     '      if (signedIn) return "Opening your session";\n', "", {"NO_BOTS": "1"}),
    ("fast+pinned", "a bot masks its frames keyed on the sequence number",
     "enc.maskVal(botCrypto.mask.c2s, o)", "enc.maskVal(botCrypto.mask.c2s, n)"),
    ("fast+pinned", "a bot unmasks incoming frames through bf",
     "enc.applyMask(bytes, enc.maskIn(cryptoIn.mask.s2c, cryptoIn.received));",
     "enc.applyMask(bytes, enc.maskVal(cryptoIn.mask.s2c, cryptoIn.received));"),
]

print(SRC + " — break it on purpose, confirm the browser test goes red\n")
missed = 0
for entry in MUTATIONS:
    mode, label = entry[0], entry[1]
    rest = list(entry[2:])
    env = rest.pop() if rest and isinstance(rest[-1], dict) else {}
    edits = rest[0] if len(rest) == 1 else [(rest[0], rest[1])]
    mutant, bad_anchor = base, None
    for old, new in edits:
        n = mutant.count(old)
        if n != 1:
            bad_anchor = n
            break
        mutant = mutant.replace(old, new)
    if bad_anchor is not None:
        print("  %-62s SKIPPED — anchor matched %d times" % (label, bad_anchor))
        missed += 1
        continue
    open(MUT, "w", encoding="utf-8").write(mutant)
    r = subprocess.run(["node", "harness/boot-2025.js", mode, MUT], capture_output=True, text=True, timeout=600,
                       env=dict(os.environ, **env))
    fails = [l.strip()[4:].strip() for l in r.stdout.splitlines() if l.strip().startswith("FAIL")]
    if fails:
        print("  %-62s caught (%s): %s" % (label, mode, fails[0][:60]))
    else:
        print("  %-62s MISSED (%s) — every check stayed green" % (label, mode))
        missed += 1

print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
