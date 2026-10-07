"""Break the 2025 update on purpose and require the checks to go red.

Each mutation is a mistake this update could plausibly have left behind, and
every one of them is SILENT in play: the client still installs, the menu still
draws, and the connection simply does not work. A check that cannot catch them
is not worth keeping — the whole point is that the last three rounds of this
were diagnosed from a screenshot because nothing said anything.

    python3 ryn-2025-mutate.py [ryn.js]
"""
import subprocess, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "ryn/Ryn_Type_2.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/ryn2025_mut.js"
base = open(SRC, encoding="utf-8").read()

CHECKS = [
    ("hooks", ["node", "harness/ryn-hooks-check.js"]),
    ("proto", ["node", "harness/ryn-protocol-2025.js"]),
]

MUTATIONS = [
    # ── the fatal one this update actually caused ──────────────────────────
    ("_enc goes back to the 2024 names (TDZ at load)",
     '"try{return{Hi:$1,Eo:yf,jt:So,Ro:vf,Po:Ll,mode:Ws," +',
     '"try{return{Hi:$1,Eo:Eo,jt:jt,Ro:Ro,Po:Po,mode:Ws," +'),
    ("_enc is bound eagerly again, so a rename throws at load",
     "\"try{Object.defineProperty(RYN,'_enc',{configurable:true,get:function(){\" +",
     "\"RYN._enc=(function(){\" +"),
    ("the inner guard is removed, so a rename takes the game down",
     '"maskFrom:kf,applyMask:Nl,maskVal:bf};}catch(e){return null}}})}catch(e){}" +',
     '"maskFrom:kf,applyMask:Nl,maskVal:bf};}}})}catch(e){}" +'),
    # ── the socket handle ──────────────────────────────────────────────────
    ("exposeGameNet stops accepting the obfuscator's ![]",
     'Hook.replace("exposeGameNet", /const (\\w+)=\\{socket:null,connected:(!1|!\\[\\]),socketId:/,',
     'Hook.replace("exposeGameNet", /const (\\w+)=\\{socket:null,connected:(!1),socketId:/,'),
    # ── the login latch ────────────────────────────────────────────────────
    ("the connect latch is never handed out",
     '"let $1=!1,$2=!1;RYN._Login._releaseConnect=function(){$2=!1};" +',
     '"let $1=!1,$2=!1;" +'),
    ("xh's early returns stop releasing the latch",
     '"$1RYN._Login._releaseConnect();$2$3RYN._Login._releaseConnect();$4");',
     '"$1$2$3$4");'),
    ("a disconnect stops releasing both flags",
     '"$1$2=!1,$3=!1,RYN._Login._onDisconnect(),");',
     '"$1RYN._Login._onDisconnect(),");'),
    # ── the protocol ───────────────────────────────────────────────────────
    ("incoming frames are no longer unmasked",
     "            enc.applyMask(bytes, enc.maskVal(cryptoIn.mask, cryptoIn.received));\n", ""),
    ("the receive counter stops advancing",
     "cryptoIn.received = (cryptoIn.received || 0) + 1;",
     "cryptoIn.received = 1;"),
    ("io-init's fifth field is ignored, so every session is unpinned",
     "const pinned = args[4] === 1;", "const pinned = false;"),
    ("the key is no longer mixed with the seed",
     "const key = pinned && enc.mixKey ? enc.mixKey(baseKey, seed) : baseKey;",
     "const key = baseKey;"),
    ("the opcode tables lose BUILD_SALT",
     "tables: pinned && enc.salt != null ? enc.Po(seed, enc.salt) : enc.Po(seed),",
     "tables: enc.Po(seed),"),
    ("no mask is derived, so nothing is masked either way",
     "mask: pinned && enc.maskFrom ? enc.maskFrom(key) : null,", "mask: null,"),
    ("outgoing bot frames stop being masked",
     "            enc.applyMask(d.subarray(enc.jt), enc.maskVal(botCrypto.mask, n));\n", ""),
    ("the outgoing mask covers the signature too",
     "enc.applyMask(d.subarray(enc.jt), enc.maskVal(botCrypto.mask, n));",
     "enc.applyMask(d, enc.maskVal(botCrypto.mask, n));"),
    # ── the renderer hooks this update broke ───────────────────────────────
    ("the render loop hooks go back to the 2024 anchors",
     'Hook.append("preRenderLoop", /function \\w+\\(\\)\\{\\w+=Date\\.now\\(\\),\\w+=\\w+-\\w+,\\w+=\\w+,/, "RYN._Renderer._preRender();");',
     'Hook.append("preRenderLoop", /\\)\\}\\}\\(\\);function \\w+\\(\\)\\{/, "RYN._Renderer._preRender();");'),
    ("the frame-end hook goes back to the 2024 anchor",
     'Hook.append("postRenderLoop", /\\w+\\(\\),\\w+\\(\\),requestAnimFrame\\(\\w+\\)/, ";RYN._Renderer._postRender();");',
     'Hook.append("postRenderLoop", /\\w+,\\w+\\(\\),requestAnimFrame\\(\\w+\\)/, ";RYN._Renderer._postRender();");'),
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
