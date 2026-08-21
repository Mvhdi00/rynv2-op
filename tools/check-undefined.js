// Undefined-identifier sweep for YoRHa_System.user.js.
//
//   npm i --no-save acorn acorn-walk
//   node tools/check-undefined.js [path/to/file.js]
//
// `node --check` only parses. It happily accepts a file that reads a variable
// nobody declares — which is exactly the shape of bug a large hand-revert
// leaves behind: the declaration is removed with the feature, the reader is
// restored with the original code, and the two never meet until a frame runs.
// That is a runtime ReferenceError no syntax check can see.
//
// This walks the real scope chain and reports every identifier that is read but
// never bound anywhere up that chain and is not a known global.
const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const FILE = process.argv[2] || (__dirname + '/../YoRHa_System.user.js');
const src = fs.readFileSync(FILE, 'utf8');

const GLOBALS = new Set([
    'window', 'document', 'console', 'Math', 'JSON', 'Date', 'Object', 'Array', 'String',
    'Number', 'Boolean', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Function',
    'Promise', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'RegExp',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage',
    'location', 'navigator', 'history', 'screen', 'performance', 'fetch', 'XMLHttpRequest',
    'WebSocket', 'Image', 'Audio', 'Blob', 'File', 'FileReader', 'FormData', 'Headers',
    'Request', 'Response', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'atob',
    'btoa', 'crypto', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array',
    'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'BigInt',
    'globalThis', 'undefined', 'NaN', 'Infinity', 'arguments', 'this', 'module', 'exports',
    'require', 'process', 'Buffer', 'global', '__webpack_require__', 'alert', 'prompt',
    'confirm', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'CustomEvent',
    'Event', 'Node', 'Element', 'HTMLElement', 'DOMParser', 'CSS', 'Intl', 'queueMicrotask',
    'structuredClone', 'AbortController', 'Worker', 'importScripts', 'self', 'top', 'parent',
    'frames', 'opener', 'GM_info', 'GM', 'unsafeWindow', 'msgpack', 'Reflect'
]);

const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true });

// ---------------------------------------------------------------- scopes
function newScope(parent, kind) { return { parent, kind, names: new Set() }; }
const scopes = new Map();          // node -> scope
const root = newScope(null, 'global');

function declarePattern(pat, scope) {
    if (!pat) return;
    switch (pat.type) {
    case 'Identifier': scope.names.add(pat.name); break;
    case 'ObjectPattern': pat.properties.forEach(p => declarePattern(p.value || p.argument, scope)); break;
    case 'ArrayPattern': pat.elements.forEach(e => declarePattern(e, scope)); break;
    case 'AssignmentPattern': declarePattern(pat.left, scope); break;
    case 'RestElement': declarePattern(pat.argument, scope); break;
    }
}

// Pass 1: build scopes and collect declarations, hoisting `var` and functions
// to the nearest function scope the way the engine does.
function funcScopeOf(scope) {
    let s = scope;
    while (s && s.kind === 'block') s = s.parent;
    return s || root;
}
function build(node, scope) {
    scopes.set(node, scope);
    const isFunc = /Function/.test(node.type);
    let inner = scope;
    if (isFunc) {
        inner = newScope(scope, 'function');
        if (node.id && node.type === 'FunctionExpression') inner.names.add(node.id.name);
        node.params.forEach(p => declarePattern(p, inner));
    } else if (node.type === 'BlockStatement' || node.type === 'ForStatement' ||
               node.type === 'ForInStatement' || node.type === 'ForOfStatement' ||
               node.type === 'SwitchStatement') {
        inner = newScope(scope, 'block');
    } else if (node.type === 'CatchClause') {
        inner = newScope(scope, 'block');
        declarePattern(node.param, inner);
    } else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        if (node.id) scope.names.add(node.id.name);
        inner = newScope(scope, 'block');
        if (node.id) inner.names.add(node.id.name);
    }

    if (node.type === 'VariableDeclaration') {
        const target = node.kind === 'var' ? funcScopeOf(scope) : scope;
        node.declarations.forEach(d => declarePattern(d.id, target));
    }
    if (node.type === 'FunctionDeclaration' && node.id) funcScopeOf(scope).names.add(node.id.name);

    for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
        const v = node[key];
        const kids = Array.isArray(v) ? v : [v];
        for (const c of kids) {
            if (c && typeof c.type === 'string') {
                scopes.set(c, inner);
                build(c, inner);
            }
        }
    }
}
build(ast, root);

function resolves(name, scope) {
    for (let s = scope; s; s = s.parent) if (s.names.has(name)) return true;
    return GLOBALS.has(name);
}

// Pass 2: every identifier that is actually READ.
const bad = new Map();
walk.ancestor(ast, {
    Identifier(node, _st, ancestors) {
        const parent = ancestors[ancestors.length - 2];
        if (!parent) return;
        // Not a read: property names, keys, labels, declarations, params.
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
        if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
        if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) return;
        if (parent.type === 'PropertyDefinition' && parent.key === node && !parent.computed) return;
        if (parent.type === 'VariableDeclarator' && parent.id === node) return;
        if (/Function/.test(parent.type) && (parent.id === node || parent.params.includes(node))) return;
        if (parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') return;
        if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' ||
            parent.type === 'ContinueStatement') return;
        if (parent.type === 'CatchClause' && parent.param === node) return;
        if (['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement'].includes(parent.type)) return;
        if (parent.type === 'Property' && ancestors.some(a => /Pattern/.test(a.type))) return;

        let scope = scopes.get(node);
        // Ancestor walk gives the node; its scope is whichever we recorded.
        if (!scope) {
            for (let i = ancestors.length - 2; i >= 0 && !scope; i--) scope = scopes.get(ancestors[i]);
        }
        if (resolves(node.name, scope || root)) return;
        if (!bad.has(node.name)) bad.set(node.name, []);
        bad.get(node.name).push(node.loc.start.line);
    }
});

if (bad.size === 0) {
    console.log('no undefined identifiers in ' + FILE.replace(/^.*\//, ''));
    process.exit(0);
}
console.log('read but never declared:\n');
for (const [name, lines] of [...bad].sort((a, b) => b[1].length - a[1].length)) {
    console.log('  ' + name.padEnd(28) + lines.length + 'x   line ' + lines.slice(0, 6).join(', ') +
                (lines.length > 6 ? ', …' : ''));
}
process.exit(1);
