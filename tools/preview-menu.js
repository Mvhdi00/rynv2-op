#!/usr/bin/env node
/* Dump the real 2yz menu as static HTML, one panel per tab.
 *
 * This does not re-implement the menu. It runs the shipped `Menu.install()`
 * against a DOM shim just rich enough for it, then serialises what the real
 * builder produced -- so the preview cannot drift from the client. The CSS is
 * read out of 71-ui.js for the same reason.
 *
 * Usage: node tools/preview-menu.js > 2yz-menu.html
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', '2yz');
const DRIVERS = path.join(ROOT, 'drivers', 'game-drivers.json');

/* ------------------------------------------------------------- DOM shim ---- */

const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);

function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

class Node {
    constructor(tag) {
        this.tagName = String(tag).toUpperCase();
        this.tag = String(tag).toLowerCase();
        this.children = [];
        this.attrs = {};
        this.style = {};
        this.dataset = {};
        this._text = null;
        this._handlers = {};
        this._classes = new Set();

        const self = this;
        this.classList = {
            add(c) { self._classes.add(c); },
            remove(c) { self._classes.delete(c); },
            toggle(c, on) { if (on === undefined) { if (self._classes.has(c)) self._classes.delete(c); else self._classes.add(c); } else if (on) self._classes.add(c); else self._classes.delete(c); },
            contains(c) { return self._classes.has(c); }
        };
    }

    get textContent() { return this._text; }
    set textContent(v) { this._text = v; this.children.length = 0; }

    set innerHTML(v) { if (v === '') this.children.length = 0; else this._text = v; }
    get innerHTML() { return this._text || ''; }

    setAttribute(k, v) {
        if (k === 'class') { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); return; }
        this.attrs[k] = v;
    }
    getAttribute(k) { return this.attrs[k]; }
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
    addEventListener(type, fn) { (this._handlers[type] || (this._handlers[type] = [])).push(fn); }
    removeEventListener() {}

    _walk(out) { out.push(this); for (const c of this.children) c._walk(out); return out; }

    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
        const all = this._walk([]).slice(1);
        if (sel.startsWith('#')) return all.filter((n) => n.attrs.id === sel.slice(1));
        if (sel.startsWith('.')) return all.filter((n) => n._classes.has(sel.slice(1)));
        return all.filter((n) => n.tag === sel.toLowerCase());
    }

    get className() { return Array.from(this._classes).join(' '); }

    toHTML() {
        const parts = [];
        if (this._classes.size) parts.push('class="' + escapeAttr(this.className) + '"');
        for (const k in this.attrs) parts.push(k + '="' + escapeAttr(this.attrs[k]) + '"');
        for (const k in this.dataset) parts.push('data-' + k + '="' + escapeAttr(this.dataset[k]) + '"');
        const styleStr = Object.keys(this.style).map((k) => k + ':' + this.style[k]).join(';');
        if (styleStr) parts.push('style="' + escapeAttr(styleStr) + '"');

        const open = '<' + this.tag + (parts.length ? ' ' + parts.join(' ') : '') + '>';
        if (VOID_TAGS.has(this.tag)) return open;

        let inner = '';
        if (this._text != null) inner = this.tag === 'style' ? this._text : escapeText(this._text);
        for (const c of this.children) inner += c.toHTML();
        return open + inner + '</' + this.tag + '>';
    }
}

/* Inputs need value/checked to round-trip into the markup. */
function decorateInput(node) {
    let value = '';
    let checked = false;
    Object.defineProperty(node, 'value', {
        get() { return value; },
        set(v) { value = v; node.attrs.value = v; }
    });
    Object.defineProperty(node, 'checked', {
        get() { return checked; },
        set(v) { checked = !!v; if (checked) node.attrs.checked = 'checked'; else delete node.attrs.checked; }
    });
}

function makeSandbox() {
    const head = new Node('head');
    const body = new Node('body');
    const doc = {
        readyState: 'complete',
        head,
        body,
        activeElement: null,
        addEventListener() {},
        createElement(tag) {
            const n = new Node(tag);
            if (String(tag).toLowerCase() === 'input') decorateInput(n);
            return n;
        }
    };

    const storage = new Map();
    const sandbox = {
        console, Math, Date, JSON, Map, Set, Number, Object, Array, String,
        Error, RegExp, isNaN, parseFloat, parseInt, Function, Infinity,
        TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
        setTimeout() { return null; }, clearTimeout() {},
        setInterval() { return null; }, clearInterval() {},
        requestAnimationFrame() { return null; },
        innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
        localStorage: {
            getItem: (k) => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, v),
            removeItem: (k) => storage.delete(k)
        },
        document: doc,
        addEventListener() {},
        WebSocket: function () { this.readyState = 3; this.addEventListener = function () {}; }
    };
    sandbox.WebSocket.prototype.send = function () {};
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    return sandbox;
}

/* ------------------------------------------------------------ run client --- */

function buildBundle() {
    const drivers = fs.readFileSync(DRIVERS, 'utf8');
    const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
    const parts = files.map((f) =>
        fs.readFileSync(path.join(SRC, f), 'utf8').split('__2YZ_DRIVERS__').join(drivers.trim()));
    return '(function(){"use strict";\n' + parts.join('\n')
        + '\nConfig.load();\nMenu.install();\nwindow.__menu = {Menu, Config};\n})();';
}

const sandbox = makeSandbox();
vm.createContext(sandbox);
vm.runInContext(buildBundle(), sandbox, { filename: '2yz.preview.js' });

const root = sandbox.document.body.children.find((n) => n.attrs.id === 'tyz-root');
if (!root) throw new Error('menu root was not built');

const styleNode = sandbox.document.head.children.find((n) => n.tag === 'style');
const css = styleNode ? styleNode.textContent : '';

/* Render each tab by invoking the real click handler the menu bound. */
const tabs = root.querySelectorAll('.tyz-tab');
const body = root.querySelector('#tyz-body');
const panels = [];

for (const tab of tabs) {
    const click = (tab._handlers.click || [])[0];
    if (!click) continue;
    click();
    panels.push({
        id: tab.dataset.tab,
        label: tab.textContent,
        html: body.children.map((c) => c.toHTML()).join('')
    });
}

const head = root.querySelector('#tyz-head');
const foot = root.querySelector('#tyz-foot');

/* Count what we are showing, so the page can state it. */
const keys = sandbox.__menu.Config.keys();
const byType = {};
for (const k of keys) {
    const leaf = sandbox.__menu.Config.leafAt(k);
    byType[leaf.type] = (byType[leaf.type] || 0) + 1;
}

process.stdout.write(JSON.stringify({
    css,
    headHTML: head ? head.children.map((c) => c.toHTML()).join('') : '',
    footHTML: foot ? foot.children.map((c) => c.toHTML()).join('') : '',
    panels,
    stats: { total: keys.length, byType }
}, null, 1));
