/* ===========================================================================
 * 2yz / Menu
 * ---------------------------------------------------------------------------
 * The menu is generated from Config.schema, not written out beside it. Adding a
 * setting to the schema adds the control; there is no list of controls to keep
 * in step, and a control cannot exist for a key nothing reads because the key
 * IS where the reader gets its value.
 *
 * Categories and their nesting come straight from the schema shape, so the menu
 * mirrors the architecture: Combat, Placement (Auto Place / Preplace / Replace
 * / Spike Tick / Scoring Weights), Defense (Anti Smart Tick / Safe Soldier /
 * Auto Heal), Utility, Prediction, Network, Debug.
 * =========================================================================== */

const Menu = (function () {
    let root = null;
    let visible = false;
    let activeTab = 'combat';

    const CSS = `
    #tyz-root{position:fixed;top:60px;left:20px;width:460px;max-height:78vh;z-index:2147483000;
      font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8e8ee;
      background:#14141aee;border:1px solid #33333f;border-radius:10px;
      box-shadow:0 12px 40px #0009;display:none;flex-direction:column;overflow:hidden}
    #tyz-root.tyz-open{display:flex}
    #tyz-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1c1c25;
      border-bottom:1px solid #33333f;cursor:move;user-select:none}
    #tyz-head b{font-size:14px;letter-spacing:.08em}
    #tyz-head .tyz-sub{color:#8b8b9c;font-size:11px;margin-left:auto}
    #tyz-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:8px 10px 0;background:#1c1c25}
    .tyz-tab{padding:5px 10px;border-radius:6px 6px 0 0;background:#24242f;color:#9a9aad;
      cursor:pointer;border:1px solid transparent;border-bottom:none}
    .tyz-tab.on{background:#14141a;color:#fff;border-color:#33333f}
    #tyz-body{padding:12px;overflow-y:auto;flex:1}
    .tyz-group{margin-bottom:14px;border:1px solid #2a2a34;border-radius:8px;overflow:hidden}
    .tyz-group>h4{margin:0;padding:7px 10px;background:#20202a;font-size:12px;font-weight:600;
      letter-spacing:.04em;color:#cfcfe0}
    .tyz-group>p{margin:0;padding:6px 10px;color:#7d7d90;font-size:11px;border-bottom:1px solid #2a2a34}
    .tyz-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid #22222c}
    .tyz-row:first-of-type{border-top:none}
    .tyz-label{flex:1;min-width:0}
    .tyz-label .n{display:block;color:#e8e8ee}
    .tyz-label .d{display:block;color:#75758a;font-size:10.5px;margin-top:1px}
    .tyz-ctl{flex:0 0 132px;display:flex;align-items:center;gap:6px;justify-content:flex-end}
    .tyz-ctl input[type=range]{width:92px;accent-color:#6f7dff}
    .tyz-ctl input[type=checkbox]{width:15px;height:15px;accent-color:#6f7dff}
    .tyz-ctl input.tyz-text{width:130px;background:#0e0e14;color:#e8e8ee;border:1px solid #3a3a4a;
      border-radius:5px;padding:3px 6px;font:inherit}
    .tyz-row:has(input.tyz-text){align-items:flex-start}
    .tyz-ctl:has(input.tyz-text){flex:0 0 140px}
    .tyz-val{min-width:38px;text-align:right;color:#a9a9c0;font-variant-numeric:tabular-nums}
    #tyz-foot{display:flex;gap:8px;padding:9px 12px;background:#1c1c25;border-top:1px solid #33333f}
    #tyz-foot button{background:#2a2a38;color:#d8d8e6;border:1px solid #3a3a4a;border-radius:6px;
      padding:5px 11px;cursor:pointer;font:inherit}
    #tyz-foot button:hover{background:#343446}
    #tyz-foot .tyz-hint{margin-left:auto;color:#75758a;align-self:center}
    #tyz-debug{position:fixed;top:60px;right:20px;width:390px;max-height:80vh;overflow-y:auto;
      z-index:2147482999;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfe8d8;
      background:#0e1410ee;border:1px solid #24382c;border-radius:8px;padding:10px;display:none;
      white-space:pre-wrap}
    #tyz-debug.tyz-open{display:block}
    #tyz-debug h5{margin:8px 0 3px;color:#7fd8a4;font-size:11px;letter-spacing:.06em}
    #tyz-debug h5:first-child{margin-top:0}
    `;

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        if (attrs) for (const k in attrs) {
            if (k === 'text') node.textContent = attrs[k];
            else if (k === 'html') node.innerHTML = attrs[k];
            else node.setAttribute(k, attrs[k]);
        }
        if (children) for (const c of children) if (c) node.appendChild(c);
        return node;
    }

    function isLeaf(node) {
        return node && typeof node === 'object' && 'type' in node && 'def' in node;
    }

    function buildRow(path, leaf) {
        const ctl = el('div', { class: 'tyz-ctl' });

        if (leaf.type === 'bool') {
            const input = el('input', { type: 'checkbox' });
            input.checked = !!Config.get(path);
            input.addEventListener('change', () => Config.set(path, input.checked));
            ctl.appendChild(input);
        } else if (leaf.type === 'text') {
            const input = el('input', { type: 'text', class: 'tyz-text' });
            input.value = String(Config.get(path));
            input.addEventListener('change', () => Config.set(path, input.value));
            ctl.appendChild(input);
        } else {
            const readout = el('span', { class: 'tyz-val', text: String(Config.get(path)) });
            const input = el('input', {
                type: 'range',
                min: String(leaf.min),
                max: String(leaf.max),
                step: String(leaf.step != null ? leaf.step : 1)
            });
            input.value = String(Config.get(path));
            input.addEventListener('input', function () {
                Config.set(path, input.value);
                readout.textContent = String(Config.get(path));
            });
            ctl.appendChild(input);
            ctl.appendChild(readout);
        }

        return el('div', { class: 'tyz-row' }, [
            el('div', { class: 'tyz-label' }, [
                el('span', { class: 'n', text: leaf.label }),
                el('span', { class: 'd', text: leaf.desc })
            ]),
            ctl
        ]);
    }

    /* Render one schema node. Leaves become rows; sub-objects become nested
     * groups, so the menu's shape is the schema's shape. */
    function buildGroup(node, path, label, desc) {
        const group = el('div', { class: 'tyz-group' });
        group.appendChild(el('h4', { text: label }));
        if (desc) group.appendChild(el('p', { text: desc }));

        const nested = [];
        for (const key in node) {
            if (key.startsWith('_')) continue;
            const child = node[key];
            const childPath = path ? path + '.' + key : key;
            if (isLeaf(child)) group.appendChild(buildRow(childPath, child));
            else nested.push(buildGroup(child, childPath, child._label || key, child._desc));
        }
        const wrap = el('div', null, [group].concat(nested));
        return wrap;
    }

    function renderTab(name) {
        activeTab = name;
        const body = root.querySelector('#tyz-body');
        body.innerHTML = '';
        const node = Config.schema[name];
        body.appendChild(buildGroup(node, name, node._label || name, node._desc));
        for (const tab of root.querySelectorAll('.tyz-tab')) {
            tab.classList.toggle('on', tab.dataset.tab === name);
        }
    }

    function makeDraggable(handle, panel) {
        let dragging = false;
        let ox = 0;
        let oy = 0;
        handle.addEventListener('mousedown', function (e) {
            dragging = true;
            const rect = panel.getBoundingClientRect();
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            e.preventDefault();
        });
        window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            panel.style.left = (e.clientX - ox) + 'px';
            panel.style.top = (e.clientY - oy) + 'px';
        });
        window.addEventListener('mouseup', function () { dragging = false; });
    }

    return {
        install() {
            const style = el('style', { text: CSS });
            document.head.appendChild(style);

            const head = el('div', { id: 'tyz-head' }, [
                el('b', { text: '2yz' }),
                el('span', { class: 'tyz-sub', text: 'Esc to toggle' })
            ]);

            const tabs = el('div', { id: 'tyz-tabs' });
            for (const name in Config.schema) {
                const node = Config.schema[name];
                const tab = el('div', { class: 'tyz-tab', text: node._label || name });
                tab.dataset.tab = name;
                tab.addEventListener('click', () => renderTab(name));
                tabs.appendChild(tab);
            }

            const foot = el('div', { id: 'tyz-foot' });
            const resetBtn = el('button', { text: 'Reset defaults' });
            resetBtn.addEventListener('click', function () {
                Config.reset();
                renderTab(activeTab);
            });
            foot.appendChild(resetBtn);
            foot.appendChild(el('span', { class: 'tyz-hint', text: 'settings save as you change them' }));

            root = el('div', { id: 'tyz-root' }, [
                head, tabs, el('div', { id: 'tyz-body' }), foot
            ]);
            document.body.appendChild(root);
            makeDraggable(head, root);
            renderTab(activeTab);

            /* Escape opens the menu. The game itself binds no handler to it
             * (nothing in src/game_index.js reads keyCode 27), so this takes a
             * key that was otherwise unused rather than shadowing a game
             * control.
             *
             * Capture phase, because the chat box and the name field close
             * themselves on Escape and would otherwise swallow it. When one of
             * those has focus the key is left alone: closing the box the player
             * is typing in is what they meant by pressing it. */
            window.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape' && e.keyCode !== 27) return;
                const active = document.activeElement;
                const tag = active && active.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                e.stopPropagation();
                Menu.toggle();
            }, true);
        },

        toggle() {
            visible = !visible;
            root.classList.toggle('tyz-open', visible);
        },

        get visible() { return visible; }
    };
})();
