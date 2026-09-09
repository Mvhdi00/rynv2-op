"""Break the login fix on purpose and require login-latch.js to go red.

The fix is three regex rewrites of a minified bundle plus a supervisor class.
Both halves are easy to get subtly wrong in a way that still parses and still
prints "ok", so every load-bearing line gets a mutation that must be caught.

    python3 login-latch-mutate.py
"""
import subprocess, sys

SRC = "ryn/Ryn_Type_2.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/login_mut.js"
base = open(SRC, encoding="utf-8").read()

MUTATIONS = [
    # ── the bundle rewrites ────────────────────────────────────────────────
    ("the latch goes back to burning before the branch",
     '"function $3(){!$4||$2||($5||$6?$7?($2=!0,$8(\\"cf:\\"+$7)):RYN._Login._noToken():($2=!0,$7?$8(\\"cf:\\"+$7):$8()))}"',
     '"function $3(){!$4||$2||($2=!0,$5||$6?$7&&$8(\\"cf:\\"+$7):$7?$8(\\"cf:\\"+$7):$8())}"'),
    ("the fix connects with no token at all",
     '($5||$6?$7?($2=!0,$8(\\"cf:\\"+$7)):RYN._Login._noToken()',
     '($5||$6?($2=!0,$8(\\"cf:\\"+$7)),0?0:0:RYN._Login._noToken()'),
    ("the connect latch is never released",
     'RYN._Login._releaseConnect=function(){$2=!1};',
     ''),
    ("the disconnect handler stops releasing anything",
     '"function $1($2){$3=!1,RYN._Login._onDisconnect(),$4.close(),$5($2)}"',
     '"function $1($2){$3=!1,$4.close(),$5($2)}"'),
    ("the spawn latch is never released",
     'RYN._Login._releaseSpawn=function(){$3=!1};',
     ''),
    ("the connect pattern no longer matches the bundle",
     r'/let (\w+)=\!1,(\w+)=\!1;function (\w+)\(\)\{\!(\w+)\|\|\2\|\|\(\2=\!0,(\w+)\|\|(\w+)\?(\w+)&&(\w+)\("cf:"\+\7\):\7\?\8\("cf:"\+\7\):\8\(\)\)\}/,'
     "\n        \"let $1=!1,$2=!1;RYN._Login._releaseConnect=function(){$2=!1};\" +",
     r'/let (\w+)=\!1,(\w+)=\!1;function (\w+)\(\)\{\!(\w+)\|\|\2\|\|\(\2=\!0,(\w+)\|\|(\w+)\?(\w+)&&(\w+)\("XX:"\+\7\):\7\?\8\("cf:"\+\7\):\8\(\)\)\}/,'
     "\n        \"let $1=!1,$2=!1;RYN._Login._releaseConnect=function(){$2=!1};\" +"),
    # ── the supervisor ─────────────────────────────────────────────────────
    ("the container is emptied instead of replaced",
     "        const fresh = el.cloneNode(false);\n"
     "        if (el.parentNode) {\n"
     "          el.parentNode.replaceChild(fresh, el);\n"
     "          return fresh;\n"
     "        }",
     "        el.innerHTML = \"\";\n        return el;"),
    ("it renders with callbacks of its own instead of the game's",
     "          callback: t => {\n"
     "            this._renders = 0;\n"
     "            try { window.onGotTurnstileToken && window.onGotTurnstileToken(t); } catch (e) {}\n"
     "          },",
     "          callback: t => { this._renders = 0; },"),
    ("the retry cap is removed, so a blocked challenge spins forever",
     "      if (this._renders >= RYN_LOGIN_MAX_RENDERS) return false;\n      this._renders++;",
     "      this._renders++;"),
    ("it renders into a hidden container",
     "      return el && el.offsetParent !== null ? el : null;",
     "      return el;"),
    ("_onDisconnect stops releasing the spawn latch",
     "      try { this._releaseSpawn(); } catch (e) {}\n",
     ""),
    ("_onDisconnect stops releasing the connect latch",
     "      try { this._releaseConnect(); } catch (e) {}\n      try { this._releaseSpawn(); } catch (e) {}",
     "      try { this._releaseSpawn(); } catch (e) {}"),
    ("it stops noticing that #enterGame holds a token",
     '      return !!btn && !btn.classList.contains("disabled");',
     "      return false;"),
    ("_render stops guarding against a missing Turnstile API",
     "      if (!ts || !el) return false;",
     "      if (!el) return false;"),
]

print("login fix — break it on purpose, confirm login-latch.js goes red\n")
missed = 0
for label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-52s SKIPPED — anchor matched %d times" % (label, n))
        missed += 1
        continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    r = subprocess.run(["node", "harness/login-latch.js", MUT],
                       capture_output=True, text=True)
    fails = [l for l in (r.stdout + r.stderr).splitlines() if l.strip().startswith("FAIL")]
    # A mutant the bench cannot even load has still been noticed: an anchor it
    # needs is gone. That is red, not a skip.
    if fails or r.returncode != 0:
        first = fails[0].strip()[4:].strip() if fails else "non-zero exit"
        print("  %-52s caught  %s" % (label, first[:44]))
    else:
        print("  %-52s MISSED — the bench stayed green" % label)
        missed += 1

print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
