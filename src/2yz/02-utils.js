/* ===========================================================================
 * 2yz / Utils
 * ---------------------------------------------------------------------------
 * The geometry here is transcribed from src/game_index.js so that 2yz's idea
 * of "in range", "colliding" and "on the line" matches the server's exactly.
 * Argument orders are the game's, not the conventional ones -- getDirection
 * returns the direction from the SECOND point to the FIRST, and lineInRect
 * takes the rectangle before the segment. Both are kept as-is on purpose.
 * =========================================================================== */

const U = {
    PI: Math.PI,
    PI2: Math.PI * 2,

    toRad(deg) { return (deg * Math.PI) / 180; },
    toDeg(rad) { return (rad * 180) / Math.PI; },

    /* game_index.js:515  qo */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /* Squared distance, for comparisons that never need the root. */
    getDistanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    /* game_index.js:518  Fo -- atan2(y1 - y2, x1 - x2) */
    getDirection(x1, y1, x2, y2) {
        return Math.atan2(y1 - y2, x1 - x2);
    },

    /* game_index.js:521  Xo -- shortest absolute angular separation */
    getAngleDist(a, b) {
        const d = Math.abs(b - a) % (Math.PI * 2);
        return d > Math.PI ? Math.PI * 2 - d : d;
    },

    /* game_index.js:537  Ko -- the game rounds coordinates and angles before
     * they go on the wire, so anything 2yz compares against a received value
     * has to be rounded the same way. */
    fixTo(value, places) {
        return value ? parseFloat(value.toFixed(places)) : 0;
    },

    /* game_index.js:543  Jo -- segment (x1,y1)->(x2,y2) against axis-aligned
     * rect (minX,minY)-(maxX,maxY). This is a Liang-Barsky style clip; it is
     * the game's own containment test, used for hit arcs and projectiles. */
    lineInRect(minX, minY, maxX, maxY, x1, y1, x2, y2) {
        let lo = x1;
        let hi = x2;
        if (x1 > x2) { lo = x2; hi = x1; }
        if (hi > maxX) hi = maxX;
        if (lo < minX) lo = minX;
        if (lo > hi) return false;

        let yLo = y1;
        let yHi = y2;
        const dx = x2 - x1;
        if (Math.abs(dx) > 1e-7) {
            const slope = (y2 - y1) / dx;
            const intercept = y1 - slope * x1;
            yLo = slope * lo + intercept;
            yHi = slope * hi + intercept;
        }
        if (yLo > yHi) { const t = yHi; yHi = yLo; yLo = t; }
        if (yHi > maxY) yHi = maxY;
        if (yLo < minY) yLo = minY;
        return !(yLo > yHi);
    },

    /* Distance from a point to a segment. Used for escape-route width and for
     * "does this spike sit on the lane the enemy is walking down". */
    pointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return U.getDistance(px, py, x1, y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        return U.getDistance(px, py, x1 + t * dx, y1 + t * dy);
    },

    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    /* Small fixed-capacity ring, for movement history. Avoids the repeated
     * array shift() that a plain array of samples would cost every tick. */
    Ring: class Ring {
        constructor(capacity) {
            this.capacity = capacity;
            this.items = new Array(capacity);
            this.head = 0;
            this.size = 0;
        }
        push(value) {
            this.items[this.head] = value;
            this.head = (this.head + 1) % this.capacity;
            if (this.size < this.capacity) this.size++;
        }
        /* 0 = most recent. */
        at(index) {
            if (index >= this.size) return undefined;
            return this.items[(this.head - 1 - index + this.capacity * 2) % this.capacity];
        }
        clear() { this.head = 0; this.size = 0; }
    }
};
