/* The 2025 session primitives, taken out of the game's own bundle and run in
 * Node — so the mock server masks, salts and signs exactly the way the client
 * it is testing does, instead of the way this harness assumes it does.
 *
 *   const proto = require("./proto-2025")([bundle.js]);   // default: the live build
 *   proto.Ll(seed, salt)  proto.kf(key)  proto.wf(mask.s2c, n)  ...
 *
 * The names on the returned object are cfaab428's (vf, Ll, kf, Nl, wf, yf, bf,
 * So, Ws), whatever the bundle calls them:
 *
 *   vf  the hex key parser          Ll  the opcode-table builder (seed[, salt])
 *   kf  the mask maker (key)        Nl  the XOR keystream (bytes, seed), in place
 *   wf  the receive-side mask       bf  the send-side mask (c2s, signature)
 *   yf  the signer (key, payload)   So  the signature width   Ws  the encrypted mode
 *
 * The primitives are found the way RYN finds them — by what the code around
 * them does, each call either direct or routed through one of the
 * obfuscator's proxy objects, which it flips per call site per build (that is
 * all it took for 3d3599b6 to hide them from the old patterns). Their
 * declarations, and everything at the bundle's top level they reach (the
 * string decoder and its array, the rotator, the constants, the SHA-256
 * tables), are then sliced out with acorn + eslint-scope and run in a vm. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const acorn = require("acorn");
const escope = require("eslint-scope");

const DEFAULT_BUNDLE = path.join(__dirname, "fixtures/b3d35/index-3d3599b6.js");

const OB_STR = '(?:\\w+\\(\\d+,"(?:[^"\\\\]|\\\\.)*"\\)|"(?:[^"\\\\]|\\\\.)*")';
const OB_KEY = "(?:\\[" + OB_STR + "(?:\\+" + OB_STR + ")*\\]|\\.\\w+)";
const OB_CALL = g => "(?:\\w+" + OB_KEY + "\\((?<" + g + "P>\\w+),|(?<" + g + "D>\\w+)\\()";
const W = s => new RegExp(s.replace(/\\w/g, "(?:[^\\x00-\\x7F-]|\\$|\\w)"));
const pick = (m, g) => m && m.groups ? m.groups[g + "P"] || m.groups[g + "D"] || m.groups[g] || null : null;

const SESSION = W("(?<key>\\w+)=" + OB_CALL("hex") + "\\w+\\[[^\\]]+\\]\\),(?<mixed>\\w+)=(?<pinned>\\w+)\\?" + OB_CALL("mix") +
  "\\k<key>,(?<seed>\\w+)\\):\\k<key>;(?<sess>\\w+)=\\{mode:(?<mode>\\w+),key:\\k<mixed>,tables:\\k<pinned>\\?" +
  OB_CALL("tables") + "\\k<seed>,(?<salt>\\w+)\\):.*?,seq:0,mask:\\k<pinned>\\?" + OB_CALL("maskFrom") + "\\k<mixed>\\):null,received:0\\}");
const INBOUND = W("(?<sess>\\w+)&&\\k<sess>" + OB_KEY + "&&" + OB_CALL("apply") + "\\w+," + OB_CALL("maskIn") + "\\k<sess>" + OB_KEY + OB_KEY + ",\\+\\+\\k<sess>" + OB_KEY + "\\)");
const SIGN = W("(?<sig>\\w+)=" + OB_CALL("sign") + "(?<sess>\\w+)" + OB_KEY + ",(?<data>\\w+)\\),(?<frame>\\w+)=new Uint8Array\\((?:(?<widthD>\\w+)\\+|\\w+" + OB_KEY + "\\((?<widthP>\\w+),)\\k<data>" + OB_KEY + "\\)");
const OUTBOUND = W("(?<sess>\\w+)" + OB_KEY + "&&" + OB_CALL("apply") + "(?<frame>\\w+)" + OB_KEY + "\\((?<width>\\w+)\\)," + OB_CALL("maskVal") + "\\k<sess>" + OB_KEY + OB_KEY + ",(?<sig>\\w+)\\)\\)");

function names(text) {
  const s = SESSION.exec(text), i = INBOUND.exec(text), g = SIGN.exec(text), o = OUTBOUND.exec(text);
  if (!s || !i || !g || !o) throw new Error("session primitives not found: " + JSON.stringify({ session: !!s, inbound: !!i, sign: !!g, outbound: !!o }));
  const n = {
    vf: pick(s, "hex"), Ll: pick(s, "tables"), kf: pick(s, "maskFrom"), Ws: s.groups.mode,
    Nl: pick(i, "apply"), wf: pick(i, "maskIn"), yf: pick(g, "sign"), So: pick(g, "width"), bf: pick(o, "maskVal"),
  };
  if (pick(o, "apply") !== n.Nl) throw new Error("the receive and send sides disagree on the keystream function");
  return n;
}

// The top-level declarations `roots` reach, transitively, in source order —
// plus the string-array rotators that run on any array kept.
function closureSlice(text, roots) {
  const ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: "module", ranges: true });
  const scope = escope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" }).globalScope.childScopes[0];
  const decl = new Map();
  for (const st of ast.body) {
    if (st.type === "FunctionDeclaration") decl.set(st.id.name, { start: st.start, text: text.slice(st.start, st.end), end: st.end });
    else if (st.type === "VariableDeclaration") {
      for (const d of st.declarations) {
        if (d.id.type === "Identifier") decl.set(d.id.name, { start: d.start, end: d.end, text: "var " + text.slice(d.start, d.end) + ";" });
      }
    }
  }
  const refsIn = (start, end) => {
    const out = new Set();
    const visit = sc => {
      for (const r of sc.references) {
        if (r.identifier.start >= start && r.identifier.end <= end && r.resolved && r.resolved.scope === scope) out.add(r.resolved.name);
      }
      sc.childScopes.forEach(visit);
    };
    visit(scope);
    return out;
  };
  const need = new Set(), queue = [...roots];
  while (queue.length) {
    const n = queue.pop();
    if (need.has(n)) continue;
    need.add(n);
    const d = decl.get(n);
    if (d) for (const r of refsIn(d.start, d.end)) queue.push(r);
  }
  const rot = [];
  for (const st of ast.body) {
    const e = st.type === "ExpressionStatement" && st.expression;
    if (e && e.type === "CallExpression" && /Function/.test(e.callee.type) && e.arguments[0] && e.arguments[0].type === "Identifier" && need.has(e.arguments[0].name)) {
      rot.push({ start: st.start, text: text.slice(st.start, st.end) + ";" });
      for (const r of refsIn(st.start, st.end)) need.add(r);
    }
  }
  return [...[...need].filter(n => decl.has(n)).map(n => decl.get(n)), ...rot].sort((a, b) => a.start - b.start).map(p => p.text).join("\n");
}

module.exports = function load(bundlePath) {
  const text = fs.readFileSync(bundlePath || DEFAULT_BUNDLE, "utf8");
  const n = names(text);
  const code = closureSlice(text, Object.values(n));
  const ctx = vm.createContext({ Math, Uint8Array, Uint32Array, Int32Array, ArrayBuffer, DataView, parseInt, String, Array, Object, Number, TextEncoder, TextDecoder, decodeURIComponent, Error });
  const out = vm.runInContext(code + "\n;({" + Object.entries(n).map(([k, v]) => k + ":" + v).join(",") + "})", ctx);
  return Object.assign(out, { names: n });
};

if (require.main === module) {
  const p = module.exports(process.argv[2]);
  console.log(p.names, "sig", p.So, "mode", p.Ws);
}
