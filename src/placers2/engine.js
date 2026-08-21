        // =====================================================================
        //  PLACER II  —  "Preplace 2" / "Replace 2"          (YoRHa System)
        // =====================================================================
        //
        //  A second, independent placement engine. It does not touch, wrap or
        //  reuse the v1 preplacer (`window.vars.prePlace`) or the v1 replacer
        //  (`window.vars.replace`); both of those are left exactly as they were.
        //  Only one of the two engines is ever allowed to run — see yp2Lock().
        //
        //  Four parts:
        //
        //    RECORDER   one sample per server tick. Every item near you is kept
        //               in a registry with its last known position, scale and
        //               health; every enemy gets a short motion history; every
        //               placement this engine asks for is written to a pending
        //               ledger and later confirmed against the world, so the
        //               engine knows its own real accept rate instead of
        //               assuming its packets landed.
        //
        //    PREDICTOR  second-order motion (position + velocity + acceleration,
        //               speed-clamped) instead of the game's one-step guess, and
        //               a break-risk estimate for our own buildings: health vs.
        //               the damage the nearest enemy's ready weapon would do at
        //               its current range.
        //
        //    SCORER     every reachable angle is scored, not matched against a
        //               priority list. Hits, predicted hits, knockback chains
        //               into our own spikes, corridor sealing, retrap value,
        //               self-block, line-of-sight and item scarcity all
        //               contribute; the highest total wins.
        //
        //    EXECUTOR   preplacements ride the existing end-of-tick send path
        //               (addPredictObject -> the 111-ping deferred loop), so the
        //               ghost still draws and the packet budget is still
        //               respected. Replacements can go out the instant the
        //               destroy packet is parsed, which is up to a full tick
        //               earlier than any next-tick path can manage.
        //
        //  Cost control: one neighbourhood array per tick (objects that could
        //  possibly collide with a placement, ~300px, instead of the 1000px
        //  visible set), squared-distance tests, a coarse 36-step ring with
        //  edge refinement, and expensive terms computed only for the few best
        //  candidates. Everything is wrapped: if the engine throws repeatedly it
        //  switches itself off and says so once, and the rest of the mod carries
        //  on untouched.
        // =====================================================================
        const YP2 = (function () {

            // ---- geometry / tuning ------------------------------------------
            const PLAYER_SCALE = 35;      // config.playerScale
            const MAX_STEP     = 42;      // px a player can cover in one tick
            const MAX_ACC      = 14;      // px/tick^2, clamp on the 2nd-order term
            const NEIGH_R      = 340;     // neighbourhood radius
            const COARSE       = 36;      // coarse ring resolution (10 deg)
            const EDGE_ITERS   = 3;       // binary-search steps per obstacle edge
            const EDGE_INSET   = 0.012;   // rad, how far inside the free side to sit
            const MICRO        = 0.035;   // rad, micro-refinement span (~2 deg)
            const TOPK         = 6;       // candidates that get the expensive terms
            const SCORE_MIN    = 30;      // below this, placing is not worth a slot
            const SPAM_SCORE   = 120;     // above this, ask for the second burst
            const KB_PROJECT   = 200;     // knockback projection length
            const PENDING_TTL  = 4;       // ticks to wait before calling a place lost
            const RECENT_TTL   = 5;       // ticks a committed spot stays reserved
            const MAX_THROWS   = 8;       // consecutive throws before self-disable

            // ---- score weights ----------------------------------------------
            const W_HIT_NOW   = 100;   // spike catches the enemy on this tick's path
            const W_HIT_PRED  = 135;   // spike catches them where they are going
            const W_HIT_FAR   = 62;    // ...on the tick after that
            const W_BOUNCE    = 74;    // knockback drives them into another of ours
            const W_TRAP_PRED = 125;   // trap lands on their predicted position
            const W_TRAP_NOW  = 60;    // trap lands on them right now
            const W_RETRAP    = 48;    // trap stacked on a held, bleeding enemy
            const W_SEAL      = 24;    // per escape lane the placement closes
            const W_FREED     = 55;    // replace: how close to the ground freed
            const W_DENY      = 26;    // takes ground the enemy was about to build on
            const W_CLOSE     = 18;    // general closeness to the fight
            const W_REL       = 18;    // learned accept rate for this angle
            const W_CLAIM     = 22;    // ground that is one hit away from opening
            const P_SELF      = -70;   // sits on my own escape corridor
            const P_LOS       = -48;   // blocks my line to the enemy
            const P_SCARCE    = -14;   // per item below the last three
            const P_BANNED    = -26;   // v1 marked this angle as refused lately

            // =================================================================
            //  state, one per player context (you, and every Full-Mod bot)
            // =================================================================
            function fresh() {
                return {
                    tick: -1,
                    objs: new Map(),      // sid -> registry record
                    enemies: new Map(),   // sid -> motion track
                    pending: [],          // placements awaiting a verdict
                    recent: [],           // spots committed in the last few ticks
                    rel: new Map(),       // angle bucket -> {n, ok}
                    armed: new Map(),     // sid -> pre-computed refill for a doomed object
                    doomed: new Map(),    // sid -> footprint of a building about to fall
                    queue: [],            // freed ground waiting for the next tick
                    neigh: [],
                    neighTick: -2,
                    rings: new Map(),
                    commits: 0,           // commits this tick (rate limit)
                    commitTick: -1,
                    throws: 0,
                    off: false,
                    m: {                  // what the recorder actually measured
                        commits: 0, ok: 0, miss: 0, instant: 0, pre: 0, rep: 0,
                        lat: 0, err: 0, errN: 0, us: 0, cand: 0
                    }
                };
            }

            const masterState = fresh();
            const botStates = new WeakMap();

            function state() {
                let owner = null;
                try { owner = inBotCtx() ? botCtx : null; } catch (e) { owner = null; }
                if (!owner) return masterState;
                let s = botStates.get(owner);
                if (!s) { s = fresh(); botStates.set(owner, s); }
                return s;
            }

            // ---- small helpers ----------------------------------------------
            function v(name, dflt) {
                const o = window.vars;
                if (!o) return dflt;
                const x = o[name];
                return (x === undefined || x === null) ? dflt : x;
            }
            function on(name) { return !!v(name, false); }
            function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
            function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
            function now() {
                try { return performance.now(); } catch (e) { return Date.now(); }
            }

            // Squared distance from point (px,py) to the segment a->b. The game
            // collides circles, so this is the honest test; a bounding box (what
            // lineInRect does) over-reports a diagonal approach by up to 41%.
            function segD2(ax, ay, bx, by, px, py) {
                const vx = bx - ax, vy = by - ay;
                const len = vx * vx + vy * vy;
                if (len < 1e-9) return d2(ax, ay, px, py);
                let t = ((px - ax) * vx + (py - ay) * vy) / len;
                t = t < 0 ? 0 : (t > 1 ? 1 : t);
                return d2(ax + t * vx, ay + t * vy, px, py);
            }
            function segHits(ax, ay, bx, by, cx, cy, r) {
                return segD2(ax, ay, bx, by, cx, cy) < r * r;
            }

            // =================================================================
            //  ENGINE OWNERSHIP  —  v2 on means v1 off, always
            // =================================================================
            // The menu already refuses to switch a v1 placer on while a v2 one
            // is running. This is the second lock, on the hot path: whatever a
            // stale config file, another script or a bot context carries, the
            // two engines can never both be live in the same tick.
            function yp2Lock() {
                const o = window.vars;
                if (!o) return false;
                const v2 = !!(o.prePlace2 || o.replace2);
                if (v2) {
                    if (o.prePlace) o.prePlace = false;
                    if (o.replace) o.replace = false;
                }
                return v2;
            }

            // =================================================================
            //  ownership / limits
            // =================================================================
            function ownerSid(o) {
                return (o && o.owner && o.owner.sid != null) ? o.owner.sid : null;
            }
            function isMine(o) {
                const sid = ownerSid(o);
                return sid != null && myPlayer && sid === myPlayer.sid;
            }
            function isOurs(o) {
                const sid = ownerSid(o);
                if (sid == null || !myPlayer) return false;
                if (sid === myPlayer.sid) return true;
                try { return !!isAlly(sid); } catch (e) { return false; }
            }

            // The real cap, which v1's isItemLimit() misses: it reads
            // `group.sandboxLimit || 99` and so believes spikes cap at 99
            // (really 15), traps at 99 (really 6), turrets at 99 (really 2).
            function limitLeft(id) {
                const it = items.list[id];
                if (!it || !it.group) return 0;
                const g = it.group;
                let cap;
                try {
                    cap = (config.isSandbox || config.inSandbox)
                        ? (g.sandboxLimit || Math.max((g.limit || 0) * 3, 99))
                        : g.limit;
                } catch (e) { cap = g.limit; }
                if (cap == null) return 99;
                const have = (myPlayer && myPlayer.itemCounts && myPlayer.itemCounts[g.id]) || 0;
                return cap - have;
            }

            // =================================================================
            //  NEIGHBOURHOOD  —  the only objects a placement can collide with
            // =================================================================
            function neighbourhood(s) {
                if (s.neighTick === tick) return s.neigh;
                const px = myPlayer.x2, py = myPlayer.y2;
                const lim = NEIGH_R * NEIGH_R;
                const out = [];
                const src = visibleObjects || [];
                for (let i = 0; i < src.length; i++) {
                    const o = src[i];
                    if (!o || !o.active) continue;
                    if (d2(px, py, o.x, o.y) > lim) continue;
                    let br;
                    try { br = o.blocker ? o.blocker : o.getScale(0.6, o.isItem); }
                    catch (e) { br = o.scale || 0; }
                    out.push({ o: o, x: o.x, y: o.y, br: br, solid: !o.ignoreCollision, doomed: false });
                }
                s.neigh = out;
                s.neighTick = tick;
                return out;
            }

            // Is (x,y) clear for an item of this scale? Same rule the server
            // uses (circle vs. circle, plus the river), extended with the spots
            // this tick already claimed so the engine never stacks on itself.
            function free(s, x, y, scale, id) {
                const n = (s.neighTick >= tick - 1) ? s.neigh : neighbourhood(s);
                for (let i = 0; i < n.length; i++) {
                    const e = n[i];
                    if (!e.o.active) continue;
                    // A building that the next swing already kills is treated as
                    // gone: the ground it stands on is what a preplacement is
                    // for. If the swing does not land the server refuses the
                    // packet, the ledger records the refusal, and the angle's
                    // reliability drops. That is the trade the whole idea rests
                    // on, and it is now a measured one.
                    if (e.doomed) continue;
                    const r = scale + e.br;
                    if (d2(x, y, e.x, e.y) < r * r) return false;
                }
                try {
                    if (id != 18) {
                        const half = config.mapScale / 2, hw = config.riverWidth / 2;
                        if (y >= half - hw && y <= half + hw) return false;
                    }
                } catch (e) { /* config not up yet */ }
                for (let i = 0; i < predictObjects.length; i++) {
                    const p = predictObjects[i];
                    const r = scale + p.scale;
                    if (d2(x, y, p.x, p.y) < r * r) return false;
                }
                for (let i = 0; i < s.recent.length; i++) {
                    const p = s.recent[i];
                    if (tick - p.tick > RECENT_TTL) continue;
                    const r = scale + p.scale;
                    if (d2(x, y, p.x, p.y) < r * r) return false;
                }
                return true;
            }

            // =================================================================
            //  RECORDER
            // =================================================================
            function record(s) {
                const src = visibleObjects || [];
                for (let i = 0; i < src.length; i++) {
                    const o = src[i];
                    if (!o || !o.isItem || o.sid == null || !o.active) continue;
                    let r = s.objs.get(o.sid);
                    if (!r) { r = { sid: o.sid, first: tick }; s.objs.set(o.sid, r); }
                    r.x = o.x; r.y = o.y; r.scale = o.scale; r.id = o.id;
                    r.trap = !!o.trap; r.dmg = !!o.dmg;
                    r.health = o.health; r.seen = tick;
                    r.mine = isMine(o); r.ours = isOurs(o);
                }
                if (s.objs.size > 400) {
                    for (const [sid, r] of s.objs) if (tick - r.seen > 20) s.objs.delete(sid);
                }
                for (let i = s.recent.length - 1; i >= 0; i--) {
                    if (tick - s.recent[i].tick > RECENT_TTL) s.recent.splice(i, 1);
                }
            }

            // Not every disappearance comes through killObject(): a bot's world
            // deletes objects on its own path, and a mass removal (an owner
            // leaving) never calls it at all. Anything that was here last tick,
            // is well inside the view, and is not here now, is gone — queue it
            // for the tick pass. Objects handled by the instant path are already
            // out of the registry, so nothing is filled twice.
            function sweep(s) {
                if (!on("replace2") || !nearestEnemy) return;
                const inView = 700 * 700;
                for (const [sid, r] of s.objs) {
                    if (r.seen === tick || r.seen !== tick - 1) continue;
                    if (!r.ours) { s.objs.delete(sid); continue; }
                    if (d2(myPlayer.x2, myPlayer.y2, r.x, r.y) > inView) continue;
                    s.objs.delete(sid);
                    r.gone = tick;
                    if (s.queue.length < 4) s.queue.push(r);
                }
            }

            function bucket(id, angle) {
                let a = angle % (Math.PI * 2);
                if (a < 0) a += Math.PI * 2;
                return id * 40 + Math.floor(a / (Math.PI * 2) * 36);
            }
            function note(s, key, ok) {
                let b = s.rel.get(key);
                if (!b) { b = { n: 0, ok: 0 }; s.rel.set(key, b); }
                b.n = b.n * 0.97 + 1;
                b.ok = b.ok * 0.97 + (ok ? 1 : 0);
            }
            function reliability(s, id, angle) {
                const b = s.rel.get(bucket(id, angle));
                if (!b || b.n < 1) return 0.5;
                return (b.ok + 1.5) / (b.n + 3);   // Laplace-smoothed toward 0.5
            }

            // Did the placements we asked for actually appear? This is the
            // measurement the whole engine tunes itself on.
            function verify(s) {
                if (!s.pending.length) return;
                const keep = [];
                const src = visibleObjects || [];
                for (let i = 0; i < s.pending.length; i++) {
                    const p = s.pending[i];
                    const age = tick - p.tick;
                    if (age < 1) { keep.push(p); continue; }
                    let ok = false;
                    for (let j = 0; j < src.length; j++) {
                        const o = src[j];
                        if (!o || !o.active || o.id !== p.id) continue;
                        if (!isMine(o)) continue;
                        if (d2(o.x, o.y, p.x, p.y) < 400) { ok = true; break; }
                    }
                    if (ok) {
                        note(s, p.bucket, true);
                        s.m.ok++;
                        s.m.lat = s.m.lat * 0.8 + age * 0.2;
                        continue;
                    }
                    if (age >= PENDING_TTL) { note(s, p.bucket, false); s.m.miss++; continue; }
                    keep.push(p);
                }
                s.pending = keep;
            }

            // =================================================================
            //  PREDICTOR
            // =================================================================
            function heldBy(e) {
                if (!e || !traps_our) return null;
                for (let i = 0; i < traps_our.length; i++) {
                    const t = traps_our[i];
                    if (d2(t.x, t.y, e.x2, e.y2) < t.scale * t.scale) return t;
                }
                return null;
            }

            function trackEnemies(s) {
                const list = enemiesNear || [];
                for (let i = 0; i < list.length; i++) {
                    const e = list[i];
                    if (!e || e.sid == null) continue;
                    let t = s.enemies.get(e.sid);
                    if (!t) { t = { h: [], pred: null }; s.enemies.set(e.sid, t); }
                    // Score last tick's prediction against what actually arrived.
                    if (t.pred && t.pred.tick === tick) {
                        const err = Math.sqrt(d2(t.pred.x, t.pred.y, e.x2, e.y2));
                        s.m.err = s.m.errN ? (s.m.err * 0.9 + err * 0.1) : err;
                        s.m.errN++;
                    }
                    t.pred = null;
                    t.h.push({ x: e.x2, y: e.y2, tick: tick });
                    if (t.h.length > 4) t.h.shift();
                    t.seen = tick;
                }
                for (const [sid, t] of s.enemies) if (tick - t.seen > 30) s.enemies.delete(sid);
            }

            // Where will this enemy be n ticks from now?
            function predict(s, e, n) {
                if (!e) return null;
                const held = heldBy(e);
                if (held) {
                    const out = { x: e.x2, y: e.y2, conf: 1 };
                    if (n === 1) rememberPrediction(s, e, out);
                    return out;
                }
                let px = e.xVel, py = e.yVel, conf = 0.55;   // the game's own one-step guess
                const t = s.enemies.get(e.sid);
                if (t && t.h.length >= 2) {
                    const l = t.h.length - 1;
                    const a = t.h[l], b = t.h[l - 1];
                    if (a.tick - b.tick === 1) {
                        const vx = a.x - b.x, vy = a.y - b.y;
                        let ax = 0, ay = 0;
                        if (t.h.length >= 3 && b.tick - t.h[l - 2].tick === 1) {
                            ax = clamp(vx - (b.x - t.h[l - 2].x), -MAX_ACC, MAX_ACC);
                            ay = clamp(vy - (b.y - t.h[l - 2].y), -MAX_ACC, MAX_ACC);
                        }
                        let dx = vx * n + 0.5 * ax * n * n;
                        let dy = vy * n + 0.5 * ay * n * n;
                        const step = Math.sqrt(dx * dx + dy * dy), cap = MAX_STEP * n;
                        if (step > cap) { dx = dx / step * cap; dy = dy / step * cap; }
                        px = e.x2 + dx; py = e.y2 + dy;
                        conf = clamp(1 - Math.sqrt(ax * ax + ay * ay) / 26, 0.4, 1);
                    }
                }
                const out = { x: px, y: py, conf: conf };
                if (n === 1) rememberPrediction(s, e, out);
                return out;
            }
            function rememberPrediction(s, e, out) {
                const t = s.enemies.get(e.sid);
                if (t && !t.pred) t.pred = { x: out.x, y: out.y, tick: tick + 1 };
            }

            function readyWeapon(e) {
                if (!e || !e.weapons) return null;
                try {
                    if (e.weapons[1] == 10 && secondaryReload[e.sid] == 1) return e.weapons[1];
                    if (primaryReload[e.sid] == 1) return e.weapons[0];
                } catch (err) { return null; }
                return null;
            }
            function weaponDmg(e, w) {
                const wp = items.weapons[w];
                if (!wp) return 0;
                let variant = 1;
                try { variant = config.weaponVariants[e.weaponVariants[w]].val || 1; } catch (err) { variant = 1; }
                return wp.dmg * (wp.sDmg || 1) * variant * 3.3;   // assume they wear tank gear
            }

            // 0 .. 1: how likely is this building of ours to stop existing?
            function breakRisk(r) {
                if (!r || !r.ours || r.health == null) return 0;
                const list = enemiesNear || [];
                let worst = 0;
                for (let i = 0; i < list.length; i++) {
                    const e = list[i];
                    const w = readyWeapon(e);
                    if (w == null) continue;
                    const reach = (items.weapons[w].range || 0) + r.scale + 12;
                    if (d2(e.x2, e.y2, r.x, r.y) > reach * reach) continue;
                    const dmg = weaponDmg(e, w);
                    if (dmg <= 0) continue;
                    if (r.health <= dmg * 1.05) return 1;
                    if (r.health <= dmg * 2.1) worst = Math.max(worst, 0.5);
                }
                return worst;
            }

            // What one swing of mine would take off a building right now.
            function myBreakDmg() {
                if (!myPlayer || !myPlayer.weapons) return 0;
                let w = null;
                try {
                    if (primaryReload[myPlayer.sid] == 1) w = myPlayer.weapons[0];
                    else if (secondaryReload[myPlayer.sid] == 1) w = myPlayer.weapons[1];
                } catch (e) { return 0; }
                const wp = w == null ? null : items.weapons[w];
                if (!wp) return 0;
                let variant = 1, tank = 1;
                try { variant = config.weaponVariants[myPlayer.weaponVariants[w]].val || 1; } catch (e) { variant = 1; }
                try { tank = isBoughtHat(40, 0) ? 3.3 : 1; } catch (e) { tank = 1; }
                return { dmg: wp.dmg * (wp.sDmg || 1) * variant * tank, range: wp.range || 0 };
            }

            // Everything one hit away from being destroyed — by them, or by me.
            // These are the interesting places to build: the ground opens on the
            // same tick the placement lands.
            function markDoomed(s) {
                s.doomed.clear();
                const range = v("pp2Range", 320);
                const mine = myBreakDmg();
                for (const [sid, r] of s.objs) {
                    if (tick - r.seen > 0) continue;
                    if (d2(myPlayer.x2, myPlayer.y2, r.x, r.y) > range * range) continue;
                    let doomed = r.ours && breakRisk(r) >= 1;
                    if (!doomed && mine && r.health != null && r.health <= mine.dmg) {
                        const reach = mine.range + r.scale;
                        if (d2(myPlayer.x2, myPlayer.y2, r.x, r.y) <= reach * reach) doomed = true;
                    }
                    if (doomed) s.doomed.set(sid, r);
                }
                if (!s.doomed.size) return;
                const n = s.neigh;
                for (let i = 0; i < n.length; i++) {
                    n[i].doomed = s.doomed.has(n[i].o.sid);
                }
            }

            // =================================================================
            //  CANDIDATES  —  coarse ring, then refine the edges
            // =================================================================
            function place1(s, id, it, off, angle, out) {
                const x = myPlayer.x2 + off * Math.cos(angle);
                const y = myPlayer.y2 + off * Math.sin(angle);
                if (!free(s, x, y, it.scale, id)) return false;
                if (out) { out.id = id; out.angle = angle; out.x = x; out.y = y; out.scale = it.scale; }
                return true;
            }

            function candidates(s, id) {
                const cached = s.rings.get(id);
                if (cached && cached.tick === tick && cached.stamp === s.recent.length + predictObjects.length) {
                    return cached.list;
                }
                const it = items.list[id];
                const list = [];
                if (!it) return list;
                const off = 35 + it.scale + (it.placeOffset || 0);
                const step = Math.PI * 2 / COARSE;
                const okFlag = new Array(COARSE);

                for (let i = 0; i < COARSE; i++) {
                    const ang = i * step;
                    const c = {};
                    okFlag[i] = place1(s, id, it, off, ang, c);
                    if (okFlag[i]) list.push(c);
                }
                // Every free/blocked boundary is a wall to hug: binary-search it
                // and add the angle that sits just inside the free side. Those
                // are the placements that seal a gap instead of floating in one.
                for (let i = 0; i < COARSE; i++) {
                    const j = (i + 1) % COARSE;
                    if (okFlag[i] === okFlag[j]) continue;
                    let lo = okFlag[i] ? i * step : j * step;        // free side
                    let hi = okFlag[i] ? j * step : i * step;        // blocked side
                    if (Math.abs(hi - lo) > Math.PI) hi += (hi < lo ? Math.PI * 2 : -Math.PI * 2);
                    const probe = {};
                    for (let k = 0; k < EDGE_ITERS; k++) {
                        const mid = (lo + hi) / 2;
                        if (place1(s, id, it, off, mid, probe)) lo = mid; else hi = mid;
                    }
                    const edge = lo + (hi > lo ? -EDGE_INSET : EDGE_INSET);
                    const c = {};
                    if (place1(s, id, it, off, edge, c)) { c.edge = true; list.push(c); }
                }
                s.m.cand = list.length;
                s.rings.set(id, { tick: tick, stamp: s.recent.length + predictObjects.length, list: list });
                return list;
            }

            // =================================================================
            //  SCORER
            // =================================================================
            function buildCtx(s, opts) {
                const e = nearestEnemy;
                const ctx = {
                    e: e,
                    p1: predict(s, e, 1),
                    p2: predict(s, e, 2),
                    held: heldBy(e),
                    spikeId: myPlayer.items[2],
                    trapId: myPlayer.items[4] || 15,
                    freed: (opts && opts.freed) || null,
                    mode: (opts && opts.mode) || "pre",
                    myFut: null
                };
                if (predictMoveAngle != null) {
                    ctx.myFut = {
                        sx: myPlayer.x2 + Math.cos(predictMoveAngle) * 35,
                        sy: myPlayer.y2 + Math.sin(predictMoveAngle) * 35,
                        fx: myPlayer.x2 + Math.cos(predictMoveAngle) * 200,
                        fy: myPlayer.y2 + Math.sin(predictMoveAngle) * 200
                    };
                }
                return ctx;
            }

            function cheapScore(s, c, ctx) {
                const e = ctx.e;
                const isSpike = c.id === ctx.spikeId;
                const isTrap = c.id === ctx.trapId;
                const hitR = c.scale + PLAYER_SCALE;
                let sc = 0;
                let hit = false;

                if (isSpike) {
                    if (segHits(e.x2, e.y2, e.xVel, e.yVel, c.x, c.y, hitR)) { sc += W_HIT_NOW; hit = true; }
                    if (segHits(e.x2, e.y2, ctx.p1.x, ctx.p1.y, c.x, c.y, hitR)) {
                        sc += W_HIT_PRED * ctx.p1.conf; hit = true;
                    } else if (segHits(ctx.p1.x, ctx.p1.y, ctx.p2.x, ctx.p2.y, c.x, c.y, hitR)) {
                        sc += W_HIT_FAR * ctx.p2.conf; hit = true;
                    }
                    if (hit) {
                        // Knockback runs from the spike through the enemy. Does
                        // that line put them on another of our spikes?
                        const kb = Math.atan2(e.yVel - c.y, e.xVel - c.x);
                        const bx = e.xVel + KB_PROJECT * Math.cos(kb);
                        const by = e.yVel + KB_PROJECT * Math.sin(kb);
                        let best = -1;
                        const ours = spikes_our || [];
                        for (let i = 0; i < ours.length; i++) {
                            const sp = ours[i];
                            if (!segHits(e.xVel, e.yVel, bx, by, sp.x, sp.y, sp.scale + PLAYER_SCALE)) continue;
                            const toSpike = Math.atan2(sp.y - e.yVel, sp.x - e.xVel);
                            let diff = Math.abs(kb - toSpike);
                            if (diff > Math.PI) diff = Math.PI * 2 - diff;
                            const align = 1 - clamp(diff / (Math.PI / 2), 0, 1);
                            if (align > best) best = align;
                        }
                        if (best >= 0) sc += W_BOUNCE * (0.45 + 0.55 * best);
                    }
                    // Solid: it can also get in my own way.
                    if (ctx.myFut && segHits(ctx.myFut.sx, ctx.myFut.sy, ctx.myFut.fx, ctx.myFut.fy, c.x, c.y, hitR)) {
                        sc += P_SELF;
                    }
                    if (segHits(myPlayer.x2, myPlayer.y2, e.x2, e.y2, c.x, c.y, c.scale + 6)) sc += P_LOS;
                } else if (isTrap) {
                    const trapR = c.scale + PLAYER_SCALE;
                    if (!ctx.held) {
                        if (d2(ctx.p1.x, ctx.p1.y, c.x, c.y) < trapR * trapR) sc += W_TRAP_PRED * ctx.p1.conf;
                        else if (segHits(e.x2, e.y2, ctx.p2.x, ctx.p2.y, c.x, c.y, trapR)) sc += W_TRAP_PRED * 0.5 * ctx.p2.conf;
                        if (d2(e.x2, e.y2, c.x, c.y) < trapR * trapR) sc += W_TRAP_NOW;
                    } else {
                        // Already held. A second trap on the same body is only
                        // worth a slot while they are taking spike damage — that
                        // is the tick the first one is about to be broken out of.
                        if (d2(e.x2, e.y2, c.x, c.y) < trapR * trapR && (e.spikeDamage > 0 || breakRisk(snapOf(s, ctx.held)) > 0)) {
                            sc += W_RETRAP;
                        } else {
                            sc -= 30;
                        }
                    }
                }

                // Ground the enemy was about to build on.
                try {
                    for (let i = 0; i < predictEnemyTraps.length; i++) {
                        const t = predictEnemyTraps[i];
                        const r = c.scale + t.scale;
                        if (d2(c.x, c.y, t.x, t.y) < r * r) { sc += W_DENY; break; }
                    }
                } catch (err) { /* no predicted traps yet */ }

                // Standing on ground that is about to open is the preplacement
                // proper — worth a nudge, and worth the second send burst.
                if (s.doomed.size) {
                    for (const [sid, r] of s.doomed) {
                        const rr = c.scale + r.scale;
                        if (d2(c.x, c.y, r.x, r.y) < rr * rr) { sc += W_CLAIM; c.claim = true; break; }
                    }
                }

                if (ctx.freed) {
                    sc += W_FREED * (1 - clamp(Math.sqrt(d2(c.x, c.y, ctx.freed.x, ctx.freed.y)) / 170, 0, 1));
                }
                sc += W_CLOSE * (1 - clamp(Math.sqrt(d2(c.x, c.y, e.x2, e.y2)) / 300, 0, 1));

                const left = limitLeft(c.id);
                if (left <= 3) sc += P_SCARCE * (4 - left);

                sc += W_REL * (reliability(s, c.id, c.angle) - 0.5) * 2;

                try {
                    for (const a of bannedAngles.keys()) {
                        if (Math.abs(a - c.angle) < 0.06) { sc += P_BANNED; break; }
                    }
                } catch (err) { /* map not up yet */ }

                c.hit = hit;
                return sc;
            }

            function snapOf(s, obj) {
                return obj && obj.sid != null ? s.objs.get(obj.sid) : null;
            }

            // How many of the enemy's eight escape lanes does this close?
            // Only the shortlist pays for this.
            function sealGain(s, c, ctx) {
                const e = ctx.e;
                const n = s.neigh;
                let gain = 0;
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    const x = e.x2 + 62 * Math.cos(a), y = e.y2 + 62 * Math.sin(a);
                    let blocked = false;
                    for (let k = 0; k < n.length; k++) {
                        const q = n[k];
                        if (!q.solid || !q.o.active) continue;
                        const r = q.br + PLAYER_SCALE;
                        if (d2(x, y, q.x, q.y) < r * r) { blocked = true; break; }
                    }
                    if (blocked) continue;
                    const r2 = c.scale + PLAYER_SCALE;
                    if (d2(x, y, c.x, c.y) < r2 * r2) gain++;
                }
                return gain;
            }

            // Best candidate for one item, or null.
            function best(s, id, ctx) {
                const list = candidates(s, id);
                if (!list.length) return null;
                let shortlist = [];
                for (let i = 0; i < list.length; i++) {
                    const c = list[i];
                    c.score = cheapScore(s, c, ctx);
                    if (shortlist.length < TOPK) {
                        shortlist.push(c);
                    } else {
                        let worst = 0;
                        for (let k = 1; k < shortlist.length; k++) if (shortlist[k].score < shortlist[worst].score) worst = k;
                        if (c.score > shortlist[worst].score) shortlist[worst] = c;
                    }
                }
                let top = null;
                for (let i = 0; i < shortlist.length; i++) {
                    const c = shortlist[i];
                    if (c.id === ctx.spikeId) c.score += W_SEAL * sealGain(s, c, ctx);
                    if (!top || c.score > top.score) top = c;
                }
                if (!top) return null;

                // Micro-refine the winner: a couple of degrees either way, keep
                // whichever scores highest. Cheap, and it is the difference
                // between clipping the enemy's hitbox and covering it.
                const it = items.list[id];
                const off = 35 + it.scale + (it.placeOffset || 0);
                for (let k = -1; k <= 1; k += 2) {
                    const c = {};
                    if (!place1(s, id, it, off, top.angle + k * MICRO, c)) continue;
                    c.score = cheapScore(s, c, ctx);
                    if (c.id === ctx.spikeId) c.score += W_SEAL * sealGain(s, c, ctx);
                    if (c.score > top.score) top = c;
                }
                return top;
            }

            // =================================================================
            //  EXECUTOR
            // =================================================================
            function budget() {
                try { return packets + 5 <= 119; } catch (e) { return true; }
            }
            function rateLeft(s) {
                if (s.commitTick !== tick) { s.commitTick = tick; s.commits = 0; }
                return v("pp2MaxPerTick", 2) - s.commits;
            }
            function ledger(s, c, kind) {
                s.commits++;
                s.recent.push({ x: c.x, y: c.y, scale: c.scale, tick: tick });
                s.pending.push({ id: c.id, x: c.x, y: c.y, tick: tick, bucket: bucket(c.id, c.angle) });
                s.m.commits++;
                if (kind === "rep") s.m.rep++; else s.m.pre++;
                s.rings.delete(c.id);
            }

            // Preplacement: hand it to the existing end-of-tick sender, which
            // fires at 111-ping and (when asked) again at 111-minPing.
            function commit(s, c, kind) {
                addPredictObject(c.id, c.angle, true);
                ledger(s, c, kind);
            }

            // Replacement: straight onto the wire, in the same turn as the
            // destroy packet that freed the ground.
            function commitNow(s, c) {
                if (!budget()) return false;
                place(c.id, c.angle);
                try { placedAngles.push(c.angle); } catch (e) { /* not in a tick */ }
                ledger(s, c, "rep");
                s.m.instant++;
                return true;
            }

            // =================================================================
            //  PER-TICK SAMPLE
            // =================================================================
            function sample() {
                const s = state();
                if (s.off || s.tick === tick) return;
                s.tick = tick;
                if (!myPlayer || !myPlayer.alive) { s.pending.length = 0; return; }
                yp2Lock();
                s.neighTick = -2;              // world moved, rebuild on demand
                s.rings.clear();
                neighbourhood(s);
                record(s);
                sweep(s);
                trackEnemies(s);
                markDoomed(s);
                verify(s);
                prearm(s);
            }

            // Look one step ahead: any building of ours that is about to be
            // destroyed gets its replacement angle worked out NOW, so the
            // instant path at destroy time is a lookup instead of a search.
            function prearm(s) {
                s.armed.clear();
                if (!on("replace2") || !v("pp2PreArm", true)) return;
                if (!nearestEnemy) return;
                const range = v("pp2Range", 320);
                let budgetN = 2;
                for (const [sid, r] of s.objs) {
                    if (budgetN <= 0) break;
                    if (!r.ours || tick - r.seen > 0) continue;
                    if (d2(myPlayer.x2, myPlayer.y2, r.x, r.y) > range * range) continue;
                    if (breakRisk(r) < 1) continue;
                    const ctx = buildCtx(s, { mode: "rep", freed: r });
                    const pick = pickRefill(s, r, ctx);
                    if (pick) s.armed.set(sid, { id: pick.id, angle: pick.angle, tick: tick });
                    budgetN--;
                }
            }

            function pickRefill(s, r, ctx) {
                const ids = [];
                if (ctx.spikeId != null) ids.push(ctx.spikeId);
                if (!!v("pp2Traps", true) && ctx.trapId != null) ids.push(ctx.trapId);
                let top = null;
                for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    if (limitLeft(id) <= 0) continue;
                    const c = best(s, id, ctx);
                    if (!c) continue;
                    // A trap that was holding the enemy is worth putting back
                    // before anything else, but only while they are loose.
                    if (r.trap && !ctx.held && id === ctx.trapId) c.score += 70;
                    if (!top || c.score > top.score) top = c;
                }
                return (top && top.score >= SCORE_MIN) ? top : null;
            }

            // =================================================================
            //  PUBLIC — preplace pass, once per tick
            // =================================================================
            function preplacePass(s) {
                if (!on("prePlace2")) return;
                if (!nearestEnemy) return;
                const range = v("pp2Range", 320);
                if (d2(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) > range * range) return;
                // Bleeding out inside an enemy trap: v1 stands down here and so
                // does this — the tick belongs to getting out, not to building.
                if (nearestTrap && spikeDmgCount > 0) return;
                if (rateLeft(s) <= 0) return;

                const ctx = buildCtx(s, { mode: "pre" });
                const picks = [];
                const ids = [ctx.spikeId];
                if (!!v("pp2Traps", true) && ctx.trapId != null) ids.push(ctx.trapId);
                for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    if (id == null || limitLeft(id) <= 0) continue;
                    const c = best(s, id, ctx);
                    if (c && c.score >= SCORE_MIN) picks.push(c);
                }
                picks.sort(function (a, b) { return b.score - a.score; });
                for (let i = 0; i < picks.length; i++) {
                    if (rateLeft(s) <= 0) break;
                    commit(s, picks[i], "pre");
                    if (picks[i].score >= SPAM_SCORE || picks[i].claim) spamPrePlacer = true;
                }
            }

            // Freed ground that could not be filled the instant it opened
            // (instant mode off, packet budget spent, nothing scored well).
            function replaceQueuePass(s) {
                if (!on("replace2") || !s.queue.length) { s.queue.length = 0; return; }
                if (!nearestEnemy) { s.queue.length = 0; return; }
                const q = s.queue;
                s.queue = [];
                for (let i = 0; i < q.length; i++) {
                    if (rateLeft(s) <= 0) break;
                    const r = q[i];
                    if (tick - r.gone > 2) continue;
                    const ctx = buildCtx(s, { mode: "rep", freed: r });
                    const pick = pickRefill(s, r, ctx);
                    if (pick) commit(s, pick, "rep");
                }
            }

            // =================================================================
            //  PUBLIC — a building of ours just stopped existing
            // =================================================================
            function onRemoved(sid) {
                const s = state();
                if (s.off) return;
                const r = s.objs.get(sid);
                if (!r) return;
                r.gone = tick;
                s.objs.delete(sid);
                if (!on("replace2")) return;
                if (!r.ours || !myPlayer || !myPlayer.alive || !nearestEnemy) return;

                const range = v("pp2Range", 320);
                if (d2(myPlayer.x2, myPlayer.y2, r.x, r.y) > range * range) return;
                if (d2(nearestEnemy.x2, nearestEnemy.y2, r.x, r.y) > 340 * 340) return;

                if (!v("pp2Instant", true) || rateLeft(s) <= 0 || !budget()) { s.queue.push(r); return; }

                // The object is already inactive, so its ground reads as free.
                // Refresh only if the cached neighbourhood is older than a tick.
                if (s.neighTick < tick - 1) { s.neighTick = -2; neighbourhood(s); }
                s.rings.delete(myPlayer.items[2]);
                s.rings.delete(myPlayer.items[4] || 15);

                const ctx = buildCtx(s, { mode: "rep", freed: r });

                // Pre-armed answer first: it was computed while the building was
                // still standing, so this costs one validity check.
                const armed = s.armed.get(sid);
                if (armed && tick - armed.tick <= 2 && limitLeft(armed.id) > 0) {
                    const it = items.list[armed.id];
                    const off = 35 + it.scale + (it.placeOffset || 0);
                    const c = {};
                    if (place1(s, armed.id, it, off, armed.angle, c)) {
                        s.armed.delete(sid);
                        if (commitNow(s, c)) return;
                    }
                    s.armed.delete(sid);
                }

                const pick = pickRefill(s, r, ctx);
                if (pick) { if (!commitNow(s, pick)) s.queue.push(r); }
            }

            // =================================================================
            //  wrappers — one throw must never cost the mod a tick
            // =================================================================
            function guard(s, fn) {
                try { fn(); s.throws = 0; }
                catch (e) {
                    s.throws++;
                    if (s.throws >= MAX_THROWS) {
                        s.off = true;
                        try { console.warn("[Placer II] disabled after repeated errors", e); } catch (_) {}
                    }
                }
            }

            return {
                // called at the top of getPredictObjects()
                sample: function () {
                    const s = state();
                    if (s.off) return;
                    guard(s, function () { sample(); });
                },
                // called after predictObjects has been cleared for this tick
                run: function () {
                    const s = state();
                    if (s.off || !myPlayer || !myPlayer.alive) return;
                    const t0 = now();
                    guard(s, function () {
                        if (s.tick !== tick) sample();
                        replaceQueuePass(s);
                        preplacePass(s);
                    });
                    s.m.us = s.m.us * 0.9 + (now() - t0) * 100;   // µs, smoothed
                },
                // called from killObject(), before the mod's own bookkeeping
                removed: function (sid) {
                    const s = state();
                    if (s.off) return;
                    guard(s, function () { onRemoved(sid); });
                },
                lock: yp2Lock,
                active: function () { return on("prePlace2") || on("replace2"); },
                metrics: function () {
                    const s = state();
                    const m = s.m;
                    const tried = m.ok + m.miss;
                    return {
                        on: on("prePlace2"), replace: on("replace2"), disabled: s.off,
                        commits: m.commits, instant: m.instant, preplaced: m.pre, replaced: m.rep,
                        confirmed: m.ok, lost: m.miss,
                        accept: tried ? +(m.ok / tried * 100).toFixed(1) : null,
                        landedInTicks: +m.lat.toFixed(2),
                        predictErrorPx: +m.err.toFixed(1),
                        decisionUs: Math.round(m.us),
                        candidates: m.cand,
                        tracked: s.objs.size, pending: s.pending.length
                    };
                },
                report: function () {
                    try { console.table([this.metrics()]); } catch (e) { console.log(this.metrics()); }
                }
            };
        })();

        try { window.YP2 = YP2; } catch (e) { /* sandboxed */ }

        // ---------------------------------------------------------------------
        //  Debug readout. Off by default; costs nothing while off.
        // ---------------------------------------------------------------------
        function yp2Hud() {
            try {
                if (inBotCtx()) return;
                const want = !!(window.vars && window.vars.pp2Debug);
                let el = document.getElementById("yp2-hud");
                if (!want) { if (el) el.remove(); return; }
                if (!el) {
                    el = document.createElement("div");
                    el.id = "yp2-hud";
                    el.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:999998;" +
                        "background:#c7c3b1;color:#454138;border:2px solid #454138;padding:7px 10px;" +
                        "font:11px/1.5 'Jost','Century Gothic',sans-serif;letter-spacing:.5px;" +
                        "white-space:pre;pointer-events:none;box-shadow:3px 3px 0 rgba(69,65,56,.35)";
                    document.body.appendChild(el);
                }
                const m = YP2.metrics();
                el.textContent =
                    "PLACER II  " + (m.disabled ? "FAULT" : (m.on || m.replace ? "LIVE" : "IDLE")) + "\n" +
                    "preplace " + (m.on ? "on" : "off") + "   replace " + (m.replace ? "on" : "off") + "\n" +
                    "placed " + m.commits + "  (instant " + m.instant + ")\n" +
                    "confirmed " + m.confirmed + " / lost " + m.lost +
                    (m.accept == null ? "" : "   " + m.accept + "%") + "\n" +
                    "land " + m.landedInTicks + " ticks   err " + m.predictErrorPx + " px\n" +
                    "decide " + m.decisionUs + " us   angles " + m.candidates;
            } catch (e) { /* HUD is never worth an exception */ }
        }
        setInterval(yp2Hud, 500);

