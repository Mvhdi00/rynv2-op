#!/usr/bin/env node
/**
 * Rebuilds Annihilator.v0.8.9.js from the untouched original.
 *
 * The repair is small and mechanical, so it is expressed as a build rather
 * than as edits in place: metadata, the shared transport shim, and three
 * seams where the mod's own socket code hands over to it. Everything the mod's
 * author wrote -- including the chat-command reference at the top -- survives
 * untouched; the shim goes in comment-free, so nothing in the shipped file is
 * annotation that was not there before.
 *
 * Usage: node tools/build-annihilator.js [original.js]
 */
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ORIGINAL = process.argv[2] || path.join(ROOT, 'reference', 'annihilator-original.js');
const OUT = path.join(ROOT, 'Annihilator.v0.8.9.js');

let src = fs.readFileSync(ORIGINAL, 'utf8');

function expect(needle) {
  if (src.indexOf(needle) < 0) {
    console.error('build-annihilator: could not find\n  ' + needle.split('\n')[0]);
    process.exit(1);
  }
}

/* --- metadata -------------------------------------------------------------
 * "document_start" is not a value Tampermonkey accepts, so it fell back to
 * document-end -- after the bundle had taken its reference to
 * WebSocket.prototype.send. And rawgit.com has been dead since 2019; a
 * @require that fails aborts the whole userscript before its first statement.
 */
expect('// @run-at       document_start');
src = src.replace('// @run-at       document_start', '// @run-at       document-start');
expect('// @require      https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js\n');
src = src.replace('// @require      https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js\n', '');

/* --- the transport shim --------------------------------------------------- */
// The block ends on a line that is exactly ")();": searching for the substring
// finds the inner "})();" of the Turnstile hook first and truncates it.
const extLines = fs.readFileSync(path.join(ROOT, 'ExternalClient.user.js'), 'utf8').split('\n');
const a = extLines.indexOf('const EXP = (function() {');
const b = extLines.indexOf(')();', a);
if (a < 0 || b < 0) { console.error('could not find the EXP core'); process.exit(1); }
const shim = stripComments(extLines.slice(a, b + 1).join('\n'), { metadata: false }).out;

const marker = '// ==/UserScript==\n';
const at = src.indexOf(marker) + marker.length;
src = src.slice(0, at) + '\n' + shim + '\n' + src.slice(at);

/* --- seam 1: the socket hook ---------------------------------------------- */
expect('WebSocket.prototype.nsend = WebSocket.prototype.send;');
src = src.replace(`WebSocket.prototype.nsend = WebSocket.prototype.send;
WebSocket.prototype.send = function (message, sid) {
    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", event => {
            if (event.code == 4001) {
                window.location.reload();
            }
        });
    }
    if (WS == this) {
        dontSend = false;
        let data = new Uint8Array(message);
        let parsed = window.msgpack.decode(data);
        let type = parsed[0];
        data = parsed[1];
        if (type == "6") {`,
`function sendFiltered(sock, type, data) {
    {
        dontSend = false;
        if (type == "6") {`);

/* --- seam 2: the send, and the two packet helpers -------------------------
 * The bare block above stands where "if (WS == this) {" used to open, so every
 * let in the 240 lines between keeps the block scope it had and the body needed
 * no reindenting. packet() reached these filters by going back through
 * WS.send, so it now calls sendFiltered directly; origPacket() used WS.nsend
 * to skip them, so it still skips them.
 */
expect('            let binary = window.msgpack.encode([type, data]);\n            this.nsend(binary);');
src = src.replace(`        if (!dontSend) {
            let binary = window.msgpack.encode([type, data]);
            this.nsend(binary);`,
`        if (!dontSend) {
            EXP.send(sock, type, data);`);

expect(`    } else {
        this.nsend(message);
    }
};
function packet(type) {`);
src = src.replace(`    } else {
        this.nsend(message);
    }
};
function packet(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    let binary = window.msgpack.encode([type, data]);
    WS.send(binary);
}
function origPacket(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    let binary = window.msgpack.encode([type, data]);
    WS.nsend(binary);
}`,
`    }
}

EXP.setHandler(function (message, sid) {
    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", event => {
            if (event.code == 4001) {
                window.location.reload();
            }
        });
    }
    if (WS != this) return EXP.nativeSend.call(this, message);
    const unframed = EXP.unframe(this, message);
    if (!unframed) return EXP.nativeSend.call(this, message);
    sendFiltered(this, unframed.type, unframed.args);
});

function packet(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    sendFiltered(WS, type, data);
}
function origPacket(type) {
    let data = Array.prototype.slice.call(arguments, 1);
    EXP.send(WS, type, data);
}`);

/* --- seam 3: incoming ------------------------------------------------------ */
expect(`function getMessage(message, sid) {
    let data = new Uint8Array(message.data);
    let parsed = window.msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];`);
src = src.replace(`function getMessage(message, sid) {
    let data = new Uint8Array(message.data);
    let parsed = window.msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];`,
`function getMessage(message, sid) {
    let parsed = EXP.receive(message.target || WS, message.data);
    if (!parsed) return;
    let type = parsed.type;
    let data = parsed.args;`);

fs.writeFileSync(OUT, src);
console.log('wrote', path.relative(ROOT, OUT), '-', src.split('\n').length, 'lines');
