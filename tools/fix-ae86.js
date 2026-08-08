/*
 * src/Ae86_v10.2_deobfuscated.js -> Ae86_v10_2_Fixed.user.js
 *
 * Ae86 v10.2 is a fork of the pre-permutation moomoo.io bundle, so it speaks a
 * transport the current server no longer accepts. This applies the transport
 * fixes and nothing else; every edit is anchored to an exact string in the
 * input and a missing or ambiguous anchor fails the build, so a different Ae86
 * build surfaces as an error rather than a half-patched script.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'src/Ae86_v10.2_deobfuscated.js');
const CORE = path.join(ROOT, 'src/moomoo-transport.js');
const SHIM = path.join(ROOT, 'src/ae86-protocol.js');
const OUT = path.join(ROOT, 'Ae86_v10_2_Fixed.user.js');

let src = fs.readFileSync(IN, 'utf8');
const edits = [];

function edit(label, find, replace) {
  const first = src.indexOf(find);
  if (first === -1) throw new Error(`[fix-ae86] anchor not found: ${label}\n---\n${find}\n---`);
  if (src.indexOf(find, first + 1) !== -1) throw new Error(`[fix-ae86] anchor is ambiguous: ${label}`);
  src = src.slice(0, first) + replace + src.slice(first + find.length);
  edits.push(label);
}

/* ------------------------------------------------------------------ *
 * 1. Ship the protocol shim inside the userscript.
 * ------------------------------------------------------------------ */
{
  const header = '// ==/UserScript==\n';
  const shim = fs.readFileSync(CORE, 'utf8') + '\n' + fs.readFileSync(SHIM, 'utf8');
  edit('inject protocol shim', header, header + '\n' + shim + '\n');
}

/* ------------------------------------------------------------------ *
 * 2. Drop the obfuscator's anti-debug timer.
 *
 * It runs a `debugger`/infinite-loop trap every 4s against whoever opens
 * devtools. It is part of the protection wrapper, not the client.
 * ------------------------------------------------------------------ */
edit('disable anti-debug timer',
  '  _0x51597b.setInterval(_0x169ee5, 4000);',
  '  void _0x51597b;');

/* ------------------------------------------------------------------ *
 * 3. Main socket: negotiate the transport on io-init.
 *
 * The shipped bundle fires the "connected" callback from io-init, not from
 * onopen, because nothing can be sent until the key and opcode tables have
 * arrived. Ae86 fired it from onopen and so sent its first packets into a
 * transport that was not set up yet.
 * ------------------------------------------------------------------ */
edit('main socket: inbound + ready callback',
  `          this.socket.onmessage = function (_0x37e4da) {
            var _0x1126b9 = new Uint8Array(_0x37e4da.data);
            var _0x5fe955 = _0x42e0ef.decode(_0x1126b9);
            var _0x12256e = _0x5fe955[0];
            var _0x1126b9 = _0x5fe955[1];
            _0x12256e == "io-init" ? _0x41d620.socketId = _0x1126b9[0] : _0x54e712[_0x12256e].apply(undefined, _0x1126b9);
          };
          this.socket.onopen = function () {
            _0x41d620.connected = true;
            _0x5dea48();
          };`,
  `          var _0xreadyFired = false;
          this.socket.onmessage = function (_0x37e4da) {
            var _0x5fe955 = _0x42e0ef.decode(new Uint8Array(_0x37e4da.data));
            var _0x12256e = _0x5fe955[0];
            var _0x1126b9 = _0x5fe955[1];
            if (_0x12256e === "io-init") {
              _0x41d620.socketId = _0x1126b9[0];
              _0x41d620.proto = window.Ae86Proto.createState(_0x1126b9);
              if (!_0xreadyFired) {
                _0xreadyFired = true;
                _0x5dea48();
              }
              return;
            }
            var _0xname = window.Ae86Proto.decodeName(_0x41d620.proto, _0x12256e);
            if (_0xname === undefined) {
              return;
            }
            var _0xhandler = _0x54e712[_0xname];
            if (_0xhandler) {
              _0xhandler.apply(undefined, _0x1126b9);
            }
          };
          this.socket.onopen = function () {
            _0x41d620.connected = true;
          };`);

/* ------------------------------------------------------------------ *
 * 4. Main socket: sign and permute outbound frames.
 * ------------------------------------------------------------------ */
edit('main socket: outbound frames',
  `          var _0x5ec4f3 = Array.prototype.slice.call(arguments, 1);
          var _0x10a29a = _0x42e0ef.encode([_0x31ae90, _0x5ec4f3]);
          this.socket.send(_0x10a29a);`,
  `          var _0x5ec4f3 = Array.prototype.slice.call(arguments, 1);
          var _0x10a29a = window.Ae86Proto.encodeFrame(this.proto, function (_0xv) {
            return _0x42e0ef.encode(_0xv);
          }, _0x31ae90, _0x5ec4f3);
          if (!_0x10a29a) {
            return;
          }
          this.socket.send(_0x10a29a);`);

/* ------------------------------------------------------------------ *
 * 5. Main socket: state is per-connection, so clear it on close.
 * ------------------------------------------------------------------ */
edit('main socket: reset state on close',
  `      close: function () {
        this.socket && this.socket.close();
      }`,
  `      close: function () {
        this.socket && this.socket.close();
        this.socket = null;
        this.connected = false;
        this.proto = null;
      }`);

/* ------------------------------------------------------------------ *
 * 6. Declare the state field alongside the other socket fields.
 * ------------------------------------------------------------------ */
edit('main socket: declare proto field',
  `      socket: null,
      connected: false,
      socketId: -1,`,
  `      socket: null,
      connected: false,
      proto: null,
      socketId: -1,`);

/* ------------------------------------------------------------------ *
 * 7. Connection URL.
 *
 * The shipped bundle connects to `wss://<address>` with the token as the only
 * query parameter. Ae86 still used the old `:8008/?gameIndex=N` form and
 * appended the token with `&`.
 * ------------------------------------------------------------------ */
edit('connection url',
  `        var _0x352f24 = _0x22dbbf ? "wss" : 'ws';
        var _0x34d3aa = _0x352f24 + "://" + _0x2ad292 + ':' + 8008 + "/?gameIndex=" + _0x565f74;
        if (_0x275321) {
          _0x34d3aa += "&token=" + encodeURIComponent(_0x275321);
        }
        tmpAddress = _0x352f24 + "://" + _0x2ad292 + ':' + 8008 + "/?gameIndex=" + _0x565f74;`,
  `        var _0x34d3aa = "wss://" + _0x2ad292;
        tmpAddress = _0x34d3aa;
        if (_0x275321) {
          _0x34d3aa += "?token=" + encodeURIComponent(_0x275321);
        }`);

/* ------------------------------------------------------------------ *
 * 8. Server discovery port: the game moved off 3000 onto 443.
 * ------------------------------------------------------------------ */
edit('vultr client port',
  'new _0x27d978("moomoo.io", 3000, _0x1052c8.maxPlayers, 5, false)',
  'new _0x27d978("moomoo.io", 443, _0x1052c8.maxPlayers, 5, false)');

/* ------------------------------------------------------------------ *
 * 9. Secondary sockets use the same transport, one state each.
 * ------------------------------------------------------------------ */
edit('secondary socket: token separator',
  'let _0x4431c3 = _0x43b864 && new WebSocket(tmpAddress + "&token=" + encodeURIComponent(_0x43b864));',
  'let _0x4431c3 = _0x43b864 && new WebSocket(tmpAddress + "?token=" + encodeURIComponent(_0x43b864));\n  _0x4431c3.proto = null;');

edit('secondary socket: outbound frames',
  `  function _0x7be9bd(_0x6ea41) {
    _0x4431c3.send(new Uint8Array(Array.from(window.msgpack.encode(_0x6ea41))));
  }`,
  `  function _0x7be9bd(_0x6ea41) {
    var _0xframe = window.Ae86Proto.encodeFrame(_0x4431c3.proto, function (_0xv) {
      return window.msgpack.encode(_0xv);
    }, _0x6ea41[0], _0x6ea41[1] || []);
    if (_0xframe) {
      _0x4431c3.send(_0xframe);
    }
  }`);

edit('secondary socket: inbound translation',
  `  _0x4431c3.onmessage = function (_0x1326d0) {
    let _0x40cd37 = window.msgpack.decode(new Uint8Array(_0x1326d0.data));
    let _0x5be0ef;`,
  `  _0x4431c3.onmessage = function (_0x1326d0) {
    let _0x40cd37 = window.msgpack.decode(new Uint8Array(_0x1326d0.data));
    if (_0x40cd37[0] === "io-init") {
      _0x4431c3.proto = window.Ae86Proto.createState(_0x40cd37[1]);
      if (!_0x4431c3.readyFired) {
        _0x4431c3.readyFired = true;
        _0x5bca3f();
      }
      return;
    }
    let _0xname = window.Ae86Proto.decodeName(_0x4431c3.proto, _0x40cd37[0]);
    if (_0xname === undefined) {
      return;
    }
    _0x40cd37 = [_0xname, _0x40cd37[1]];
    let _0x5be0ef;`);

edit('secondary socket: ready on io-init, not onopen',
  `  _0x4431c3.onopen = function () {
    isConnected = true, _0x5bca3f();
  };`,
  `  _0x4431c3.onopen = function () {
    isConnected = true;
  };`);

/* ------------------------------------------------------------------ *
 * 10. Server capacity.
 *
 * Ae86 still thinks a server holds 50 (hard 60); the shipped bundle says 40
 * (hard 50). The value is the lobby size the server picker filters on, so an
 * over-estimate makes it offer servers that then reject the join as full.
 * ------------------------------------------------------------------ */
edit('server capacity',
  '_0x2480f9.exports.maxPlayers = _0xd28018 && _0xd28018.argv.indexOf("--largeserver") != -1 ? 80 : 50;',
  '_0x2480f9.exports.maxPlayers = _0xd28018 && _0xd28018.argv.indexOf("--largeserver") != -1 ? 80 : 40;');

/* ------------------------------------------------------------------ *
 * 11. Sandbox placement limits.
 *
 * mill, booster and teleporter gained a sandboxLimit in the shipped bundle.
 * Only sandbox play reads them, but leaving them out makes the client
 * disagree with the server about how much can be placed there.
 * ------------------------------------------------------------------ */
for (const [group, limit] of [['mill', 0x7], ['booster', 0xc], ['teleporter', 0x2]]) {
  edit(`sandbox limit: ${group}`,
    `      name: "${group}",
      place: true,
      limit: ${limit === 0x7 ? '0x7' : limit === 0xc ? '0xc' : '0x2'},`,
    `      name: "${group}",
      place: true,
      limit: ${limit === 0x7 ? '0x7' : limit === 0xc ? '0xc' : '0x2'},
      sandboxLimit: 0x12b,`);
}

/* ------------------------------------------------------------------ *
 * 12. Server discovery.
 *
 * Ae86 still expects the old page, which shipped the server list inline as a
 * `window.vultr` global and served refreshes from a relative `/serverData`.
 * The current page defines neither: it fetches `api.moomoo.io/servers?v=1.27`
 * and hands the parsed body straight to processServers.
 *
 * The constructor's unguarded read of that global is the worse half — it is a
 * ReferenceError at load, before anything else in the client runs.
 * ------------------------------------------------------------------ */
edit('server discovery: guard the inline-list global',
  `      this.processServers(vultr.servers);
    }`,
  `      // The current page has no inline server list; discovery happens in
      // the fetch below instead.
      typeof vultr !== "undefined" && vultr && this.processServers(vultr.servers);
    }`);

edit('server discovery: fetch the current endpoint',
  `    function _0x5a61d9() {
      var _0x1c317c = new XMLHttpRequest();
      var _0x53658f = "/serverData";
      _0x1c317c.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status == 200) {
            window.vultr = JSON.parse(this.responseText);
            _0x17dbb2.processServers(vultr.servers);
            _0x179f00();
          } else {
            console.error("Failed to load server data with status code:", this.status);
          }
        }
      };
      _0x1c317c.open("GET", _0x53658f, true);
      _0x1c317c.send();
    }`,
  `    function _0x5a61d9() {
      var _0xapi = location.hostname === "sandbox.moomoo.io" || location.hostname === "sandbox-dev.moomoo.io" ? "https://api-sandbox.moomoo.io" : location.hostname === "dev.moomoo.io" || location.hostname === "dev2.moomoo.io" ? "https://api-dev.moomoo.io" : "https://api.moomoo.io";
      fetch(_0xapi + "/servers?v=1.27").then(function (_0xr) {
        return _0xr.json();
      }).then(function (_0xd) {
        // The endpoint returns the server payload itself, not a wrapper with
        // a .servers property like the old inline global had.
        window.vultr = _0xd;
        _0x17dbb2.processServers(_0xd);
        _0x179f00();
      })["catch"](function (_0xe) {
        console.error("Failed to load server data:", _0xe);
      });
    }`);

fs.writeFileSync(OUT, src);
console.log(`Applied ${edits.length} edits:`);
for (const e of edits) console.log(`  - ${e}`);
console.log(`\nWrote ${path.relative(ROOT, OUT)} (${src.length} bytes)`);
