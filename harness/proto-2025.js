/* The 2025 session primitives, taken out of the game's own bundle and run in
 * Node — so the mock server masks, salts and signs exactly the way the client
 * it is testing does, instead of the way this harness assumes it does.
 *
 *   const proto = require("./proto-2025")();          // fixture bundle
 *   proto.Ll(seed, salt)  proto.kf(key)  proto.wf(mask.s2c, n)  ...
 *
 * The bundle keeps them in one obfuscated block: a string-array rotator, the
 * protocol constants, the opcode-table builder, the HMAC, the XOR keystream,
 * and the hex key parser. That block touches no DOM, so it evaluates as is. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

module.exports = function load(bundlePath) {
  const s = fs.readFileSync(bundlePath || path.join(__dirname, "fixtures/moomoo_index_new.js"), "utf8");
  const consts = /const (\w+)=[^,]+,(\w+)=[^,]+,(\w+)=[^,]+,(\w+)=\["M","D","9"[^\]]*\],(\w+)=[^,]+,(\w+)=\["A","B","C"[^\]]*\]/.exec(s);
  if (!consts) throw new Error("protocol constants not found");
  const session = /(\w+)=(\w+)\(\w+\[[^\]]+\]\),(\w+)=(\w+)\?(\w+)\(\1,(\w+)\):\1;(\w+)=\{mode:(\w+),key:\3,tables:\4\?(\w+)\(\6,(\w+)\):.*?,seq:0,mask:\4\?(\w+)\(\3\):null,received:0\}/.exec(s);
  const inbound = /&&(\w+)\(\w+,(\w+)\((\w+)\[\w+\(\d+,"[^"]*"\)\]\[\w+\(\d+,"[^"]*"\)\],\+\+\3\[/.exec(s);
  const sign = /\]\((\w+),(\w+)\[\w+\(\d+,"[^"]*"\)\],(\w+)\),\w+=new Uint8Array\((\w+)\+\3\[/.exec(s);
  const outbound = /(\w+)\(\w+\[\w+\(\d+,"[^"]*"\)\+"ay"\]\(\w+\),(\w+)\(\w+\[/.exec(s);
  if (!session || !inbound || !sign || !outbound) throw new Error("session primitives not found");
  const names = {
    vf: session[2], Ll: session[9], kf: session[11], Nl: inbound[1], wf: inbound[2], yf: sign[1], bf: outbound[2],
    So: consts[2], Ws: consts[3],
  };
  // From the rotator that precedes the constants to the end of the last
  // primitive the block defines.
  const start = s.lastIndexOf("(function(e,t){", consts.index);
  let end = consts.index;
  for (const n of [names.vf, names.Ll, names.kf, names.Nl, names.wf, names.yf, names.bf]) {
    const i = s.indexOf("function " + n + "(");
    if (i < 0) throw new Error("no function " + n);
    let d = 0, k = s.indexOf("{", i);
    for (; k < s.length; k++) { if (s[k] === "{") d++; else if (s[k] === "}") { d--; if (!d) break; } }
    end = Math.max(end, k + 1);
  }
  // The decoder and its string array live just before the block's end.
  const chunk = s.slice(start, end);
  const ctx = vm.createContext({ Math, Uint8Array, Uint32Array, Int32Array, ArrayBuffer, DataView, parseInt, String, Array, Object, Number, TextEncoder, decodeURIComponent });
  const out = vm.runInContext(chunk + "\n;({" + Object.entries(names).map(([k, v]) => k + ":" + v).join(",") + "})", ctx);
  return Object.assign(out, { names });
};

if (require.main === module) {
  const p = module.exports();
  console.log(p.names, "sig", p.So, "mode", p.Ws);
}
