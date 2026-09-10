"""Break Oracle's connection on purpose and require oracle-net.js to go red.

Every one of these is a mistake the port could plausibly have made and that
still parses, still connects, and then silently fails — which is the shape of
bug the old client had. A check that cannot catch them is not worth keeping.

    python3 oracle-net-mutate.py
"""
import subprocess, sys

SRC = "oracle/Oracle_Laffer_v1.2.user.js"
MUT = "/tmp/claude-0/-home-user-rynv2-op/84985967-839c-5cb9-84f9-ceebbe0cce70/scratchpad/oracle_mut.js"
base = open(SRC, encoding="utf-8").read()

MUTATIONS = [
    # ── the frame ──────────────────────────────────────────────────────────
    ("frames go out unsigned, the way they used to",
     "                    var payload = msgpack.encode([op, data, ++oracleNet.seq]);\n"
     "                    var signature = RevTransport.sign(oracleNet.key, payload);\n"
     "                    binary = new Uint8Array(RevTransport.signatureBytes + payload.length);\n"
     "                    binary.set(signature, 0);\n"
     "                    binary.set(payload, RevTransport.signatureBytes);",
     "                    binary = msgpack.encode([op, data, ++oracleNet.seq]);"),
    ("the opcode is sent as its letter instead of through the table",
     "                    var payload = msgpack.encode([op, data, ++oracleNet.seq]);",
     "                    var payload = msgpack.encode([type, data, ++oracleNet.seq]);"),
    ("the sequence number never advances",
     "++oracleNet.seq]);", "oracleNet.seq]);"),
    ("the signature is written after the payload instead of before",
     "                    binary.set(signature, 0);\n"
     "                    binary.set(payload, RevTransport.signatureBytes);",
     "                    binary.set(payload, 0);\n"
     "                    binary.set(signature, payload.length);"),
    ("an opcode the server does not take is sent anyway",
     "                    if (op === undefined) return;", "                    if (op === undefined) op = 0;"),
    # ── the handshake ──────────────────────────────────────────────────────
    ("frames go out before io-init again",
     "                    if (!oracleHandshake) return;\n", ""),
    ("the connect callback moves back to onopen",
     "                    this.socket.onopen = function () {\n"
     "                        _this.connected = true;\n"
     "                    };",
     "                    this.socket.onopen = function () {\n"
     "                        _this.connected = true;\n"
     "                        if (!calledBack) { calledBack = true; callback(); }\n"
     "                    };"),
    ("io-init no longer builds the signed session",
     "                            oracleNet = oracleNetInit(data);\n", ""),
    # ── incoming ───────────────────────────────────────────────────────────
    ("incoming numeric opcodes are no longer mapped back",
     "                        type = oracleNetType(type);\n", ""),
    ("an unknown opcode throws again, as it used to",
     "                        var handler = events[type];\n"
     "                        if (handler) handler.apply(undefined, data);",
     "                        events[type].apply(undefined, data);"),
    # ── reconnect ──────────────────────────────────────────────────────────
    ("close() leaves the dead socket in place",
     "                this.socket = null;\n", ""),
    ("close() keeps the stale signed session",
     "                oracleNet = null;\n                oracleHandshake = false;\n", ""),
    ("a disconnect no longer clears inGame",
     "            inGame = false;\n            // Read BEFORE close() clears it",
     "            // Read BEFORE close() clears it"),
    ("a disconnect no longer releases the connect guard",
     "            oracleConnecting = false;\n            showLoadingText(reason);",
     "            showLoadingText(reason);"),
    ("a new ping interval is started on every callback again",
     "                if (oraclePingTimer === null) {\n"
     "                    oraclePingTimer = setInterval(() => pingSocket(), 2500);\n                }",
     "                setInterval(() => pingSocket(), 2500);"),
    # ── the address ────────────────────────────────────────────────────────
    ("the host drops the region",
     '                : server.key + "." + server.region + "." + ORACLE_BASE_URL;',
     '                : server.key + "." + ORACLE_BASE_URL;'),
    # The bug that produced the report: the port belongs to the /ping probe,
    # not to the socket, and dialling it fails at the TCP level — an onerror
    # then an onclose, i.e. "Socket error" followed by "disconnected".
    ("the record's port is put back into the socket host",
     '            return server.region == 0\n'
     '                ? "localhost"\n'
     '                : server.key + "." + server.region + "." + ORACLE_BASE_URL;',
     '            let host = server.region == 0\n'
     '                ? "localhost"\n'
     '                : server.key + "." + server.region + "." + ORACLE_BASE_URL;\n'
     '            if (server.port) host += ":" + server.port;\n'
     '            return host;'),
    ("the baseUrl follows the API host onto sandbox",
     'const ORACLE_BASE_URL = "moomoo.io";',
     'const ORACLE_BASE_URL = ORACLE_SANDBOX ? "sandbox.moomoo.io" : "moomoo.io";'),
    ("the dev API host is dropped",
     '            : ORACLE_DEV ? "https://api-dev.moomoo.io"\n', ""),
    ("the token loses its cf: prefix on the first attempt",
     '                if (oracleToken) address += "?token=" + encodeURIComponent("cf:" + oracleToken);\n'
     '                wsAddress = address;',
     '                if (oracleToken) address += "?token=" + encodeURIComponent(oracleToken);\n'
     '                wsAddress = address;'),
    # ── the fallback ───────────────────────────────────────────────────────
    ("the candidate list collapses back to a single pick",
     "            return pool;", "            return pool.slice(0, 1);"),
    ("full servers are offered as candidates",
     "            const notFull = usable.filter(s => s.playerCount !== s.playerCapacity);",
     "            const notFull = usable;"),
    ("the ranking prefers the emptiest instead of the fullest",
     "                .sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0));",
     "                .sort((a, b) => (a.playerCount || 0) - (b.playerCount || 0));"),
    ("a real disconnect is retried against another server",
     "            if (hadHandshake) { oracleTries = 0; oracleCandidates = []; return; }\n", ""),
    ("the retry is unbounded",
     "            if (oracleTries >= ORACLE_MAX_TRIES || !oracleCandidates.length) return;",
     "            if (!oracleCandidates.length) return;"),
    ("the handshake flag is read after close() has cleared it",
     "            const hadHandshake = oracleHandshake;\n            io.close();",
     "            io.close();\n            const hadHandshake = oracleHandshake;"),
    ("the retry drops the token from the address",
     '            if (oracleToken) address += "?token=" + encodeURIComponent("cf:" + oracleToken);\n'
     '            try { showLoadingText("Connecting..."); } catch (e) {}',
     '            try { showLoadingText("Connecting..."); } catch (e) {}'),
    # ── the ghosts ─────────────────────────────────────────────────────────
    ("the transport block is removed but the client still calls it",
     "const RevTransport = (function () {", "const RevTransportX = (function () {"),
    ("the window.WebSocket hook comes back",
     "        window.OriginalWebSocket = window.WebSocket;",
     "        window.OriginalWebSocket = window.WebSocket;\n        window.WebSocket = class { constructor(a){} };"),
    ("the dead rawgit @require comes back",
     "// @require      https://code.jquery.com/jquery-3.6.0.min.js",
     "// @require      https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js\n"
     "// @require      https://code.jquery.com/jquery-3.6.0.min.js"),
]

print("Oracle connection — break it on purpose, confirm oracle-net.js goes red\n")
missed = 0
for label, old, new in MUTATIONS:
    n = base.count(old)
    if n != 1:
        print("  %-52s SKIPPED — anchor matched %d times" % (label, n))
        missed += 1
        continue
    open(MUT, "w", encoding="utf-8").write(base.replace(old, new))
    r = subprocess.run(["node", "harness/oracle-net.js", MUT], capture_output=True, text=True)
    fails = [l for l in (r.stdout + r.stderr).splitlines() if l.strip().startswith("FAIL")]
    # A mutant the bench cannot even load has still been noticed: an anchor it
    # needs is gone. That is red, not a skip.
    if fails or r.returncode != 0:
        first = fails[0].strip()[4:].strip() if fails else "non-zero exit"
        print("  %-52s caught  %s" % (label, first[:46]))
    else:
        print("  %-52s MISSED — the bench stayed green" % label)
        missed += 1

print("\n  %d of %d mutations caught" % (len(MUTATIONS) - missed, len(MUTATIONS)))
sys.exit(1 if missed else 0)
