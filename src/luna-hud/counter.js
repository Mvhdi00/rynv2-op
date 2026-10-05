    // =========================================================================
    //  >>> FPS / PING COUNTER (top centre) <<<
    // =========================================================================
    //
    // Both numbers are measured, nothing is estimated:
    //   FPS   frames the game's own render loop (doUpdate) actually ran in the
    //         last half second — the build counts them in window.__lunaFrames.
    //   Ping  the round trip of Luna's own ping packet to the game server
    //         (window.pingTime), shown only while the socket is open.
    (function () {
        const style = document.createElement('style');
        style.textContent = `
            #luna-fps-ping {
                position: fixed; top: 8px; left: 50%;
                transform: translateX(-50%);
                display: flex; align-items: center; gap: 8px;
                padding: 5px 14px;
                border-radius: 999px;
                background: rgba(5, 5, 8, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.08);
                font-family: 'JetBrains Mono', 'Consolas', monospace;
                font-size: 12px; font-weight: 600;
                font-variant-numeric: tabular-nums;
                color: #ffffff;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
                z-index: 10001;
                pointer-events: none;
                user-select: none;
            }
            #luna-fps-ping .lfp-k { color: #8a8a9b; letter-spacing: 1px; }
            #luna-fps-ping .lfp-v { min-width: 26px; }
            #luna-fps-ping .lfp-sep { width: 1px; height: 11px; background: rgba(255, 255, 255, 0.15); }
            #luna-fps-ping .good { color: #A6D7B2; }
            #luna-fps-ping .ok { color: #E8D29B; }
            #luna-fps-ping .bad { color: #D9A3AB; }
        `;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'luna-fps-ping';
        el.innerHTML =
            '<span class="lfp-k">FPS</span><span class="lfp-v" id="lfp-fps">--</span>' +
            '<span class="lfp-sep"></span>' +
            '<span class="lfp-k">PING</span><span class="lfp-v" id="lfp-ping">--</span>';
        document.body.appendChild(el);
        const fpsEl = el.querySelector('#lfp-fps');
        const pingEl = el.querySelector('#lfp-ping');

        let lastFrames = window.__lunaFrames || 0;
        let lastAt = performance.now();

        function socketOpen() {
            try {
                return window.__lunaMusicChat && window.__lunaMusicChat.status().socket === 'OPEN';
            } catch (e) {
                return false;
            }
        }

        setInterval(() => {
            el.style.display = window.vars.hudCounter === false ? 'none' : '';

            const now = performance.now();
            const frames = window.__lunaFrames || 0;
            const fps = Math.round((frames - lastFrames) * 1000 / Math.max(1, now - lastAt));
            lastFrames = frames;
            lastAt = now;
            fpsEl.textContent = fps;
            fpsEl.className = 'lfp-v ' + (fps >= 55 ? 'good' : fps >= 30 ? 'ok' : 'bad');

            const ping = Number(window.pingTime);
            if (socketOpen() && ping > 0) {
                pingEl.textContent = Math.round(ping) + 'ms';
                pingEl.className = 'lfp-v ' + (ping <= 80 ? 'good' : ping <= 150 ? 'ok' : 'bad');
            } else {
                pingEl.textContent = '--';
                pingEl.className = 'lfp-v';
            }
        }, 500);
    })();
