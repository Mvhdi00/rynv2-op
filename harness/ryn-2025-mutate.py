"""Break the 2025 update on purpose and require the checks to go red.

Each mutation is a mistake this update could plausibly have left behind, and
every one of them is SILENT in play: the client still installs, the menu still
draws, and the connection simply does not work. A check that cannot catch them
is not worth keeping — the whole point is that the last three rounds of this
were diagnosed from a screenshot because nothing said anything.

    python3 ryn-2025-mutate.py [ryn.js]
"""
import os, subprocess, sys, tempfile

SRC = sys.argv[1] if len(sys.argv) > 1 else "ryn/Ryn_Type_2.user.js"
MUT = os.path.join(tempfile.mkdtemp(prefix="ryn-mutate-"), "ryn2025_mut.js")
base = open(SRC, encoding="utf-8").read()

CHECKS = [
    ("hooks", ["node", "harness/ryn-hooks-check.js"]),
    ("proto", ["node", "harness/ryn-protocol-2025.js"]),
    ("rewrite", ["node", "harness/ryn-rewrite-check.js"]),
    ("sign", ["node", "harness/ryn-sign-check.js"]),
]

MUTATIONS = [
    # ── the frame rate, the HP number's neighbours, names ─────────────────
    ("exposeResize no longer finds the game's resize handler",
     r'/window\.addEventListener\("resize",(\w+)\.checkTrusted\((\w+)\)\)/',
     r'/window\.addEventListener\("resize",(\w+)\.checkTrusted\((\w+)\),!0\)/'),
    ("viewport no longer finds the tail of the game's resize",
     r'\5\.resize\(\6\*\3\)/, "RYN._Renderer._viewport', r'\5\.resize\(\6\)/, "RYN._Renderer._viewport'),
    ("nameColor no longer finds where the game picks a name's colour",
     r'(\w+)=\1\?(\w+):"#fff",(\w+)=\{color:\4,/', r'(\w+)=\1\?(\w+):"#fff",(\w+)=\{colour:\4,/'),
    # ── frame signatures ───────────────────────────────────────────────────
    ("fastSign no longer finds the game's signing call",
     r'\],\w+\),\w+=new Uint8Array\(\w+\+\w+\[)/,', r'\],\w+\),\w+=new Uint16Array\(\w+\+\w+\[)/,'),
    ("RynSign has a wrong SHA-256 round constant",
     "_K = new Int32Array([ 1116352408, 1899447441,", "_K = new Int32Array([ 1116352409, 1899447441,"),
    ("RynSign never checks itself against the game",
     "      if (k.checks < this._CHECKS) {", "      if (false) {"),
    ("RynSign signs alone from the first frame",
     "    _CHECKS = 3;", "    _CHECKS = 0;"),
    # ── the injector: the update that never ran ────────────────────────────
    ("the import pattern eats the `;` the next import needs",
     """([^"'\\n]+)\\5/g;""", """([^"'\\n]+)\\5\\s*;?/g;"""),
    ("import.meta is left in the bundle",
     '      code = code.replace(/\\bimport\\.meta\\.url\\b/g, JSON.stringify(src)).replace(/\\bimport\\.meta\\b/g, "({url:" + JSON.stringify(src) + "})");\n', ""),
    ("moomoo-protocol is resolved against /assets/ instead of the import map",
     "        const mapped = Injector_importMap.resolve(spec);\n        return mapped !== null ? mapped : spec;",
     "        return toAbs(spec);"),
    # ── the rewrite: hooks that ate the bundle or wandered off ─────────────
    ("RenderGrid goes back to the 2024 pattern (deletes `const Oe`)",
     '    Hook.replace("RenderGrid", /(\\.globalAlpha=\\.06;const (\\w+)=\\w+\\/18;)for\\(var (\\w+)=[^;]+;\\3<\\w+;\\3\\+=\\2\\)\\3>0&&\\w+\\.line\\([^)]*\\);for\\(let (\\w+)=[^;]+;\\4<\\w+;\\4\\+=\\2\\)\\4>0&&\\w+\\.line\\([^)]*\\);/, "$1");\n',
     '    Hook.replace("RenderGrid", /("#91b2db".+?)(for.+?)(\\w+\\.stroke)/, "$1$3");\n'),
    ("renderItemPush goes back to the 2024 anchor (wanders into aura maths)",
     '    Hook.replace("renderItemPush", /if\\((\\w+)=(\\w+)\\[(\\w+)\\],(\\w+)=\\1\\.x\\+\\1\\.xWiggle-(\\w+),/, "if($1=$2[$3],RYN._Renderer._renderObjects.push($1),$4=$1.x+$1.xWiggle-$5,");\n',
     '    Hook.append("renderItemPush", /,(\\w+)\\.blocker,\\w+.+?2\\)\\)/, ",RYN._Renderer._renderObjects.push($1)");\n'),
    ("sdkReady only accepts window.FRVR, which maskFRVR has already rewritten",
     "/window\\.frvrSdkInitPromise\\.then\\(\\(\\)=>(?:window\\.)?FRVR",
     "/window\\.frvrSdkInitPromise\\.then\\(\\(\\)=>window\\.FRVR"),
    # ── the renderer and the frame ─────────────────────────────────────────
    ("the WebGL renderer is no longer adopted", '    Hook.replace("adoptRenderer", /(\\w+)=(\\w+)\\((\\w+),(\\w+)\\?\\{pageSize:\\+\\4\\[1\\],maxPages:\\+\\4\\[2\\]\\}:null\\);/, "$1=RYN._Renderer._adopt($2($3,$4?{pageSize:+$4[1],maxPages:+$4[2]}:null),$3);");\n', ""),
    ("the frame is no longer guarded", '    Hook.replace("frameGuard", /(\\w+)\\(\\),(\\w+)\\(\\),requestAnimFrame\\((\\w+)\\)/, "RYN._Renderer._frame($1),$2(),requestAnimFrame($3)");\n', ""),
    ("the render loop hooks go back to the 2024 anchors",
     'Hook.append("preRenderLoop", /function \\w+\\(\\)\\{\\w+=Date\\.now\\(\\),\\w+=\\w+-\\w+,\\w+=\\w+,/, "RYN._Renderer._preRender();");',
     'Hook.append("preRenderLoop", /\\)\\}\\}\\(\\);function \\w+\\(\\)\\{/, "RYN._Renderer._preRender();");'),
    # ── the server list ────────────────────────────────────────────────────
    ("the server model is no longer exposed", '    Hook.replace("exposeServers", /const (\\w+)=\\{init:function\\((\\w+)\\)\\{(\\w+)=\\2\\.baseHost,/, "const $1=RYN._servers={init:function($2){$3=$2.baseHost,");\n', ""),
    # ── the socket handle and the session ──────────────────────────────────
    ("exposeGameNet stops accepting the obfuscator's ![]",
     'Hook.replace("exposeGameNet", /const (\\w+)=\\{socket:null,connected:(!1|!\\[\\]),socketId:/,',
     'Hook.replace("exposeGameNet", /const (\\w+)=\\{socket:null,connected:(!1),socketId:/,'),
    ("_enc names a minified identifier again",
     '"Eo:" + cryptoRef(cryptoName(cryptoSign, 1)),', '"Eo:yf",'),
    ("_enc is bound eagerly again, so a rename throws at load",
     "\"try{Object.defineProperty(RYN,'_enc',{configurable:true,get:function(){\" +",
     "\"RYN._enc=(function(){\" +"),
    ("the inner guard is removed, so a missing name takes the game down",
     '"};}catch(e){return null}}})}catch(e){}" +', '"};}}})}catch(e){}" +'),
    # ── the login latch ────────────────────────────────────────────────────
    ("the connect latch is never handed out",
     '"let $1=!1,$2=!1;RYN._Login._releaseConnect=function(){$2=!1};" +', '"let $1=!1,$2=!1;" +'),
    ("xh's early returns stop releasing the latch",
     '"$1RYN._Login._releaseConnect();$2$3RYN._Login._releaseConnect();$4");', '"$1$2$3$4");'),
    ("a disconnect stops releasing both flags",
     '"$1$2=!1,$3=!1,RYN._Login._onDisconnect(),");', '"$1RYN._Login._onDisconnect(),");'),
    # ── the pinned session ─────────────────────────────────────────────────
    ("the main socket unmasks the game's shared buffer in place again",
     "                bytes = bytes.slice();\n", ""),
    ("the main socket advances the game's receive count",
     "(cryptoIn.received >>> 0) + 1", "++cryptoIn.received"),
    ("incoming frames are keyed through bf, the send-side function",
     "enc.applyMask(bytes, enc.maskIn(cryptoIn.mask.s2c, cryptoIn.received));",
     "enc.applyMask(bytes, enc.maskVal(cryptoIn.mask.s2c, cryptoIn.received));"),
    ("a bot's receive counter stops advancing",
     "cryptoIn.received = (cryptoIn.received || 0) + 1;", "cryptoIn.received = 1;"),
    ("io-init's fifth field is ignored, so every session is unpinned",
     "const pinned = args[4] === 1;", "const pinned = false;"),
    ("the key is no longer mixed with the seed",
     "const key = pinned && enc.mixKey ? enc.mixKey(baseKey, seed) : baseKey;", "const key = baseKey;"),
    ("the opcode tables lose BUILD_SALT",
     "tables: pinned && enc.salt != null ? enc.Po(seed, enc.salt) : enc.Po(seed),", "tables: enc.Po(seed),"),
    ("no mask is derived, so nothing is masked either way",
     "mask: pinned && enc.maskFrom ? enc.maskFrom(key) : null,", "mask: null,"),
    ("outgoing bot frames stop being masked",
     "            enc.applyMask(d.subarray(enc.jt), enc.maskVal(botCrypto.mask.c2s, o));\n", ""),
    ("outgoing bot frames are keyed on the sequence number again",
     "enc.maskVal(botCrypto.mask.c2s, o)", "enc.maskVal(botCrypto.mask.c2s, n)"),
    ("the outgoing mask covers the signature too",
     "enc.applyMask(d.subarray(enc.jt), enc.maskVal(botCrypto.mask.c2s, o));",
     "enc.applyMask(d, enc.maskVal(botCrypto.mask.c2s, o));"),
    ("the first ping goes out in the io-init event again (raw, unsigned)",
     "          setTimeout(() => {\n            try {\n              PacketManager2.pingRequest();\n            } catch (_) {}\n          }, 0);",
     "          PacketManager2.pingRequest();"),
    ("RYN sends on the main socket before the game has a session",
     "(crypto._bundle || !this.client.isOwner)", "true"),
]

print(SRC + " — break the 2025 update on purpose, confirm a check goes red\n")
print("  each mutation is run past: %s\n" % ", ".join(n for n, _ in CHECKS))
missed = 0
for label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-52s SKIPPED — anchor matched %d times" % (label, n))
        missed += 1
        continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    caught, detail = [], ""
    for name, cmd in CHECKS:
        r = subprocess.run(cmd + [MUT], capture_output=True, text=True)
        fails = [l for l in (r.stdout + r.stderr).splitlines()
                 if l.strip().startswith("FAIL") or l.strip().startswith("FATAL")]
        # A check that cannot even load the mutant has still noticed it.
        if fails or r.returncode != 0:
            caught.append(name)
            if not detail:
                detail = fails[0].strip().lstrip("FAIL").lstrip("FATAL").strip() if fails else "non-zero exit"
    if caught:
        print("  %-52s caught by %-12s %s" % (label, "+".join(caught), detail[:42]))
    else:
        print("  %-52s MISSED — every check stayed green" % label)
        missed += 1

print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
