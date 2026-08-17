/* ===========================================================================
 * 2yz / Overlay
 * ---------------------------------------------------------------------------
 * Visuals. Because 2yz does not fork the game's renderer, it cannot hook the
 * draw calls the way the reference clients do -- it draws on its own canvas
 * stacked over the game's, and has to reproduce the camera itself.
 *
 * The camera maths is the game's, from src/game_index.js:
 *
 *   scale  = max(innerWidth / maxScreenWidth, innerHeight / maxScreenHeight)
 *            and the context transform (4466-4472)
 *   camera = lerped toward the player's render position each frame with
 *            step = min(distance * 0.01 * delta, distance)   (4831-4836)
 *
 * The player's own render position is itself interpolated between the last two
 * server snapshots, so this reproduces both stages. The result tracks the game
 * closely; it is not pixel-identical, because the game's delta and ours are
 * different clocks. Anything that must be exact -- a decision, a range check --
 * is made against world coordinates, never against what this draws.
 *
 * Everything here is off by default and none of it feeds a decision. It reads
 * GameState and draws; nothing reads back.
 * =========================================================================== */

const Overlay = (function () {
    let canvas = null;
    let ctx = null;
    let raf = null;

    /* Camera state, lerped the way the game lerps it. */
    let camX = 0;
    let camY = 0;
    let lastFrame = 0;

    function viewportScale() {
        return Math.max(
            window.innerWidth / Defs.config.maxScreenWidth,
            window.innerHeight / Defs.config.maxScreenHeight
        );
    }

    /* Interpolate an entity between its last two snapshots, as the game does
     * between t1 and t2. */
    function renderPos(entity) {
        const span = entity.t2 - entity.t1;
        if (!span || span <= 0) return { x: entity.x2, y: entity.y2 };
        let t = (Date.now() - entity.t2) / span;
        t = U.clamp(t, 0, 1.4);
        return {
            x: entity.x1 + (entity.x2 - entity.x1) * (1 + t),
            y: entity.y1 + (entity.y2 - entity.y1) * (1 + t)
        };
    }

    function updateCamera(delta) {
        const me = GameState.self;
        if (!me) {
            camX = Defs.config.mapScale / 2;
            camY = Defs.config.mapScale / 2;
            return;
        }
        const p = renderPos(me);
        const dist = U.getDistance(camX, camY, p.x, p.y);
        if (dist > 0.05) {
            const dir = U.getDirection(p.x, p.y, camX, camY);
            const step = Math.min(dist * 0.01 * delta, dist);
            camX += step * Math.cos(dir);
            camY += step * Math.sin(dir);
        } else {
            camX = p.x;
            camY = p.y;
        }
    }

    /* World -> CSS pixels, matching the game's context transform. */
    function toScreen(worldX, worldY) {
        const scale = viewportScale();
        const originX = (window.innerWidth - Defs.config.maxScreenWidth * scale) / 2;
        const originY = (window.innerHeight - Defs.config.maxScreenHeight * scale) / 2;
        return {
            x: originX + (worldX - camX + Defs.config.maxScreenWidth / 2) * scale,
            y: originY + (worldY - camY + Defs.config.maxScreenHeight / 2) * scale,
            scale
        };
    }

    function circle(worldX, worldY, radius, colour, width) {
        const p = toScreen(worldX, worldY);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * p.scale, 0, U.PI2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = (width || 2) * p.scale;
        ctx.stroke();
    }

    function line(x1, y1, x2, y2, colour, width) {
        const a = toScreen(x1, y1);
        const b = toScreen(x2, y2);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = colour;
        ctx.lineWidth = (width || 2) * a.scale;
        ctx.stroke();
    }

    function label(worldX, worldY, text, colour) {
        const p = toScreen(worldX, worldY);
        ctx.font = Math.round(13 * p.scale) + 'px system-ui, sans-serif';
        ctx.fillStyle = colour;
        ctx.textAlign = 'center';
        ctx.fillText(text, p.x, p.y);
    }

    /* --------------------------------------------------------------- layers */

    function drawTargets() {
        const me = GameState.self;
        const primary = Targeting.primary;
        for (const p of Targeting.all) {
            const isPrimary = p === primary;
            const colour = isPrimary ? '#ff5470' : '#ffb454';
            circle(p.x2, p.y2, p.scale + 8, colour, isPrimary ? 3 : 2);
            if (isPrimary && me) line(me.x2, me.y2, p.x2, p.y2, 'rgba(255,84,112,0.45)', 2);
            if (Config.get('overlay.showHealth')) {
                label(p.x2, p.y2 - p.scale - 14, Math.round(p.health) + 'hp', colour);
            }
        }
    }

    function drawPrediction() {
        for (const p of Targeting.all) {
            const horizon = Config.get('overlay.predictionTicks');
            const future = Prediction.at(p, horizon);
            line(p.x2, p.y2, future.x, future.y, 'rgba(111,125,255,0.8)', 2);
            circle(future.x, future.y, p.scale, 'rgba(111,125,255,0.55)', 2);
        }
    }

    function drawPlacement() {
        const target = Targeting.primary;
        const spike = GameState.spikeItem;
        if (!target || spike == null) return;
        const ranked = PlacementEngine.bestN(spike, target, 'spike',
            Config.get('overlay.placementCount'));
        for (let i = 0; i < ranked.length; i++) {
            const c = ranked[i];
            const alpha = 0.85 - i * 0.2;
            circle(c.x, c.y, c.scale, 'rgba(127,216,164,' + Math.max(0.2, alpha) + ')', i === 0 ? 3 : 2);
        }
    }

    function drawHazards() {
        for (const obj of GameState.enemyObjects) {
            if (!obj.active) continue;
            if (obj.damage > 0) circle(obj.x, obj.y, obj.scale, 'rgba(255,84,112,0.55)', 2);
            else if (obj.trap) circle(obj.x, obj.y, obj.scale, 'rgba(255,180,84,0.55)', 2);
        }
        for (const obj of GameState.myObjects) {
            if (!obj.active || obj.damage <= 0) continue;
            circle(obj.x, obj.y, obj.scale, 'rgba(127,216,164,0.35)', 1);
        }
    }

    function drawRanges() {
        const me = GameState.self;
        if (!me) return;
        for (let slot = 0; slot < 2; slot++) {
            const idx = GameState.weapons[slot];
            if (idx == null) continue;
            const w = Defs.weapons[idx];
            if (!w || w.range == null) continue;
            const ready = slot === 0
                ? EntityTracker.primaryReady(me.sid)
                : EntityTracker.secondaryReady(me.sid);
            circle(me.x2, me.y2, w.range + me.scale,
                ready ? 'rgba(127,216,164,0.5)' : 'rgba(120,120,140,0.35)', 2);
        }
    }

    function frame() {
        raf = window.requestAnimationFrame(frame);
        if (!Config.get('overlay.enabled')) {
            if (canvas.style.display !== 'none') canvas.style.display = 'none';
            return;
        }
        if (canvas.style.display === 'none') canvas.style.display = 'block';

        const now = Date.now();
        const delta = lastFrame ? now - lastFrame : 16;
        lastFrame = now;

        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!GameState.inGame || !GameState.self) return;
        updateCamera(delta);

        try {
            if (Config.get('overlay.showHazards')) drawHazards();
            if (Config.get('overlay.showRanges')) drawRanges();
            if (Config.get('overlay.showPlacement')) drawPlacement();
            if (Config.get('overlay.showPrediction')) drawPrediction();
            if (Config.get('overlay.showTargets')) drawTargets();
        } catch (err) {
            Log.error('overlay', err);
        }
    }

    return {
        install() {
            canvas = document.createElement('canvas');
            canvas.id = 'tyz-overlay';
            canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;'
                + 'z-index:2147482000;display:none';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
            raf = window.requestAnimationFrame(frame);
        },

        debugState() {
            return {
                enabled: Config.get('overlay.enabled'),
                camera: { x: Math.round(camX), y: Math.round(camY) },
                scale: Math.round(viewportScale() * 100) / 100
            };
        }
    };
})();
