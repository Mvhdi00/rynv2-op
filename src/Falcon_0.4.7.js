// ==UserScript==
// @name         Falcon
// @namespace    -
// @version      0.4.7
// @description  try to take over the world!
// @author       You
// @match        *://*.moomoo.io/*
// @grant        none
// ==/UserScript==

(() => {
    "use strict";
    var e = {
        d: (i, t) => {
            for (var n in t) e.o(t, n) && !e.o(i, n) && Object.defineProperty(i, n, {
                enumerable: !0,
                get: t[n]
            })
        },
        o: (e, i) => Object.prototype.hasOwnProperty.call(e, i)
    };
    e.d({}, {
        D1: () => Pl,
        XG: () => Sl,
        NL: () => Tl,
        it: () => Wl,
        RP: () => al,
        AY: () => dl,
        Bs: () => ol,
        NT: () => Bl,
        ZZ: () => pl,
        h1: () => yl,
        Xh: () => ul,
        l6: () => jl,
        Oi: () => El,
        Lu: () => sl,
        hb: () => fl,
        jG: () => Qr,
        zz: () => ll,
        jT: () => ml,
        Vo: () => Yr,
        CO: () => Xl,
        GM: () => cl,
        HP: () => _l,
        Al: () => gl,
        gZ: () => Ll,
        bk: () => Cl,
        hj: () => Rl,
        CI: () => il,
        Xq: () => Jr,
        Bl: () => Zr,
        e1: () => tl,
        fe: () => nl,
        A9: () => el,
        x2: () => $r,
        s3: () => Hl,
        lp: () => Nl,
        Yn: () => Fl,
        K3: () => hl,
        P3: () => xl,
        rR: () => Gl,
        $O: () => Kr,
        vf: () => Il,
        Xx: () => Ol,
        ZK: () => Dl
    });
    var i = {
        maxScreenWidth: 1920,
        maxScreenHeight: 1080,
        serverUpdateRate: 9,
        serverUpdateSpeed: 1e3 / 9,
        maxPlayers: 40,
        maxPlayersHard: 40,
        collisionDepth: 6,
        minimapRate: 3e3,
        colGrid: 15,
        volanoScale: 320,
        innerVolcanoScale: 100,
        volcanoAnimationDuration: 3200,
        clientSendRate: 5,
        healthBarWidth: 50,
        healthBarPad: 4.5,
        iconPadding: 15,
        iconPad: .9,
        deathFadeout: 3e3,
        crownIconScale: 60,
        crownPad: 35,
        chatCountdown: 3e3,
        chatCooldown: 500,
        inSanbox: !0,
        maxAge: 100,
        gatherAngle: Math.PI / 2.6,
        gatherWiggle: 10,
        hitReturnRatio: .25,
        hitAngle: Math.PI / 2,
        playerScale: 35,
        playerSpeed: .0016,
        playerDecel: .993,
        nameY: 34,
        skinColors: ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db"],
        animalCount: 7,
        aiTurnRandom: .06,
        cowNames: ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"],
        shieldAngle: Math.PI / 3,
        weaponVariants: [{
            id: 0,
            src: "",
            xp: 0,
            val: 1
        }, {
            id: 1,
            src: "_g",
            xp: 3e3,
            val: 1.1
        }, {
            id: 2,
            src: "_d",
            xp: 7e3,
            val: 1.18
        }, {
            id: 3,
            src: "_r",
            poison: !0,
            xp: 12e3,
            val: 1.18
        }],
        fetchVariant: function(e) {
            for (var i = e.weaponXP[e.weaponIndex] || 0, t = 3; t >= 0; --t)
                if (i >= this.weaponVariants[t].xp) return this.weaponVariants[t]
        },
        resourceTypes: ["wood", "food", "stone", "points"],
        areaCount: 7,
        treesPerArea: 9,
        bushesPerArea: 3,
        totalRocks: 32,
        goldOres: 7,
        riverWidth: 724,
        riverPadding: 114,
        waterCurrent: .0011,
        waveSpeed: 1e-4,
        waveMax: 1.3,
        treeScales: [150, 160, 165, 175],
        bushScales: [80, 85, 95],
        rockScales: [80, 85, 95],
        snowBiomeTop: 2400,
        snowSpeed: .75,
        maxNameLength: 15,
        mapScale: 14400,
        mapPingScale: 40,
        mapPingTime: 2200
    };
    const t = i;

    function n(e) {
        return n = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, n(e)
    }

    function r(e) {
        var i, t, r = 4294967296,
            l = new Uint8Array(128),
            d = 0;
        return o(e), l.subarray(0, d);

        function o(e) {
            switch (n(e)) {
                case "undefined":
                    a();
                    break;
                case "boolean":
                    ! function(e) {
                        y(e ? 195 : 194)
                    }(e);
                    break;
                case "number":
                    ! function(e) {
                        if (isFinite(e) && Math.floor(e) === e)
                            if (e >= 0 && e <= 127) y(e);
                            else if (e < 0 && e >= -32) y(e);
                        else if (e > 0 && e <= 255) u([204, e]);
                        else if (e >= -128 && e <= 127) u([208, e]);
                        else if (e > 0 && e <= 65535) u([205, e >>> 8, e]);
                        else if (e >= -32768 && e <= 32767) u([209, e >>> 8, e]);
                        else if (e > 0 && e <= 4294967295) u([206, e >>> 24, e >>> 16, e >>> 8, e]);
                        else if (e >= -2147483648 && e <= 2147483647) u([210, e >>> 24, e >>> 16, e >>> 8, e]);
                        else if (e > 0 && e <= 0x10000000000000000) {
                            var n = e / r,
                                l = e % r;
                            u([211, n >>> 24, n >>> 16, n >>> 8, n, l >>> 24, l >>> 16, l >>> 8, l])
                        } else e >= -0x8000000000000000 && e <= 0x8000000000000000 ? (y(211), p(e)) : u(e < 0 ? [211, 128, 0, 0, 0, 0, 0, 0, 0] : [207, 255, 255, 255, 255, 255, 255, 255, 255]);
                        else t || (i = new ArrayBuffer(8), t = new DataView(i)), t.setFloat64(0, e), y(203), u(new Uint8Array(i))
                    }(e);
                    break;
                case "string":
                    ! function(e) {
                        var i = function(e) {
                                for (var i = !0, t = e.length, n = 0; n < t; n++)
                                    if (e.charCodeAt(n) > 127) {
                                        i = !1;
                                        break
                                    } for (var r = 0, l = new Uint8Array(e.length * (i ? 1 : 4)), d = 0; d !== t; d++) {
                                    var o = e.charCodeAt(d);
                                    if (o < 128) l[r++] = o;
                                    else {
                                        if (o < 2048) l[r++] = o >> 6 | 192;
                                        else {
                                            if (o > 55295 && o < 56320) {
                                                if (++d >= t) throw new Error("UTF-8 encode: incomplete surrogate pair");
                                                var a = e.charCodeAt(d);
                                                if (a < 56320 || a > 57343) throw new Error("UTF-8 encode: second surrogate character 0x" + a.toString(16) + " at index " + d + " out of range");
                                                o = 65536 + ((1023 & o) << 10) + (1023 & a), l[r++] = o >> 18 | 240, l[r++] = o >> 12 & 63 | 128
                                            } else l[r++] = o >> 12 | 224;
                                            l[r++] = o >> 6 & 63 | 128
                                        }
                                        l[r++] = 63 & o | 128
                                    }
                                }
                                return i ? l : l.subarray(0, r)
                            }(e),
                            t = i.length;
                        t <= 31 ? y(160 + t) : u(t <= 255 ? [217, t] : t <= 65535 ? [218, t >>> 8, t] : [219, t >>> 24, t >>> 16, t >>> 8, t]), u(i)
                    }(e);
                    break;
                case "object":
                    null === e ? a() : e instanceof Date ? function(e) {
                        var i = e.getTime() / 1e3;
                        if (0 === e.getMilliseconds() && i >= 0 && i < 4294967296) u([214, 255, i >>> 24, i >>> 16, i >>> 8, i]);
                        else if (i >= 0 && i < 17179869184) {
                            var t = 1e6 * e.getMilliseconds();
                            u([215, 255, t >>> 22, t >>> 14, t >>> 6, t << 2 >>> 0 | i / r, i >>> 24, i >>> 16, i >>> 8, i])
                        } else {
                            var n = 1e6 * e.getMilliseconds();
                            u([199, 12, 255, n >>> 24, n >>> 16, n >>> 8, n]), p(i)
                        }
                    }(e) : Array.isArray(e) ? s(e) : e instanceof Uint8Array || e instanceof Uint8ClampedArray ? function(e) {
                        var i = e.length;
                        u(i <= 15 ? [196, i] : i <= 65535 ? [197, i >>> 8, i] : [198, i >>> 24, i >>> 16, i >>> 8, i]), u(e)
                    }(e) : e instanceof Int8Array || e instanceof Int16Array || e instanceof Uint16Array || e instanceof Int32Array || e instanceof Uint32Array || e instanceof Float32Array || e instanceof Float64Array ? s(e) : function(e) {
                        var i = 0;
                        for (var t in e) i++;
                        for (var n in i <= 15 ? y(128 + i) : u(i <= 65535 ? [222, i >>> 8, i] : [223, i >>> 24, i >>> 16, i >>> 8, i]), e) o(n), o(e[n])
                    }(e)
            }
        }

        function a(e) {
            y(192)
        }

        function s(e) {
            var i = e.length;
            i <= 15 ? y(144 + i) : u(i <= 65535 ? [220, i >>> 8, i] : [221, i >>> 24, i >>> 16, i >>> 8, i]);
            for (var t = 0; t < i; t++) o(e[t])
        }

        function y(e) {
            if (l.length < d + 1) {
                for (var i = 2 * l.length; i < d + 1;) i *= 2;
                var t = new Uint8Array(i);
                t.set(l), l = t
            }
            l[d] = e, d++
        }

        function u(e) {
            if (l.length < d + e.length) {
                for (var i = 2 * l.length; i < d + e.length;) i *= 2;
                var t = new Uint8Array(i);
                t.set(l), l = t
            }
            l.set(e, d), d += e.length
        }

        function p(e) {
            var i, t;
            e >= 0 ? (i = e / r, t = e % r) : (e++, i = ~(i = Math.abs(e) / r), t = ~(t = Math.abs(e) % r)), u([i >>> 24, i >>> 16, i >>> 8, i, t >>> 24, t >>> 16, t >>> 8, t])
        }
    }

    function l(e) {
        var i = 0;
        if (e instanceof ArrayBuffer && (e = new Uint8Array(e)), "object" !== n(e) || void 0 === e.length) throw new Error("Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.");
        if (!e.length) throw new Error("Invalid argument: The byte array to deserialize is empty.");
        e instanceof Uint8Array || (e = new Uint8Array(e));
        var t = r();
        return e.length, t;

        function r() {
            var t = e[i++];
            if (t >= 0 && t <= 127) return t;
            if (t >= 128 && t <= 143) return s(t - 128);
            if (t >= 144 && t <= 159) return y(t - 144);
            if (t >= 160 && t <= 191) return u(t - 160);
            if (192 === t) return null;
            if (193 === t) throw new Error("Invalid byte code 0xc1 found.");
            if (194 === t) return !1;
            if (195 === t) return !0;
            if (196 === t) return a(-1, 1);
            if (197 === t) return a(-1, 2);
            if (198 === t) return a(-1, 4);
            if (199 === t) return p(-1, 1);
            if (200 === t) return p(-1, 2);
            if (201 === t) return p(-1, 4);
            if (202 === t) return o(4);
            if (203 === t) return o(8);
            if (204 === t) return d(1);
            if (205 === t) return d(2);
            if (206 === t) return d(4);
            if (207 === t) return d(8);
            if (208 === t) return l(1);
            if (209 === t) return l(2);
            if (210 === t) return l(4);
            if (211 === t) return l(8);
            if (212 === t) return p(1);
            if (213 === t) return p(2);
            if (214 === t) return p(4);
            if (215 === t) return p(8);
            if (216 === t) return p(16);
            if (217 === t) return u(-1, 1);
            if (218 === t) return u(-1, 2);
            if (219 === t) return u(-1, 4);
            if (220 === t) return y(-1, 2);
            if (221 === t) return y(-1, 4);
            if (222 === t) return s(-1, 2);
            if (223 === t) return s(-1, 4);
            if (t >= 224 && t <= 255) return t - 256;
            throw console.debug("msgpack array:", e), new Error("Invalid byte value '" + t + "' at index " + (i - 1) + " in the MessagePack binary data (length " + e.length + "): Expecting a range of 0 to 255. This is not a byte array.")
        }

        function l(t) {
            for (var n = 0, r = !0; t-- > 0;)
                if (r) {
                    var l = e[i++];
                    n += 127 & l, 128 & l && (n -= 128), r = !1
                } else n *= 256, n += e[i++];
            return n
        }

        function d(t) {
            for (var n = 0; t-- > 0;) n *= 256, n += e[i++];
            return n
        }

        function o(t) {
            var n = new DataView(e.buffer, i, t);
            return i += t, 4 === t ? n.getFloat32(0, !1) : 8 === t ? n.getFloat64(0, !1) : void 0
        }

        function a(t, n) {
            t < 0 && (t = d(n));
            var r = e.subarray(i, i + t);
            return i += t, r
        }

        function s(e, i) {
            e < 0 && (e = d(i));
            for (var t = {}; e-- > 0;) t[r()] = r();
            return t
        }

        function y(e, i) {
            e < 0 && (e = d(i));
            for (var t = []; e-- > 0;) t.push(r());
            return t
        }

        function u(t, n) {
            t < 0 && (t = d(n));
            var r = i;
            return i += t,
                function(e, i, t) {
                    var n = i,
                        r = "";
                    for (t += i; n < t;) {
                        var l = e[n++];
                        if (l > 127)
                            if (l > 191 && l < 224) {
                                if (n >= t) throw new Error("UTF-8 decode: incomplete 2-byte sequence");
                                l = (31 & l) << 6 | 63 & e[n++]
                            } else if (l > 223 && l < 240) {
                            if (n + 1 >= t) throw new Error("UTF-8 decode: incomplete 3-byte sequence");
                            l = (15 & l) << 12 | (63 & e[n++]) << 6 | 63 & e[n++]
                        } else {
                            if (!(l > 239 && l < 248)) throw new Error("UTF-8 decode: unknown multibyte start 0x" + l.toString(16) + " at index " + (n - 1));
                            if (n + 2 >= t) throw new Error("UTF-8 decode: incomplete 4-byte sequence");
                            l = (7 & l) << 18 | (63 & e[n++]) << 12 | (63 & e[n++]) << 6 | 63 & e[n++]
                        }
                        if (l <= 65535) r += String.fromCharCode(l);
                        else {
                            if (!(l <= 1114111)) throw new Error("UTF-8 decode: code point 0x" + l.toString(16) + " exceeds UTF-16 reach");
                            l -= 65536, r += String.fromCharCode(l >> 10 | 55296), r += String.fromCharCode(1023 & l | 56320)
                        }
                    }
                    return r
                }(e, r, t)
        }

        function p(e, t) {
            e < 0 && (e = d(t));
            var n = d(1),
                r = a(e);
            return 255 === n ? function(e) {
                if (4 === e.length) {
                    var t = (e[0] << 24 >>> 0) + (e[1] << 16 >>> 0) + (e[2] << 8 >>> 0) + e[3];
                    return new Date(1e3 * t)
                }
                if (8 === e.length) {
                    var n = (e[0] << 22 >>> 0) + (e[1] << 14 >>> 0) + (e[2] << 6 >>> 0) + (e[3] >>> 2),
                        r = 4294967296 * (3 & e[3]) + (e[4] << 24 >>> 0) + (e[5] << 16 >>> 0) + (e[6] << 8 >>> 0) + e[7];
                    return new Date(1e3 * r + n / 1e6)
                }
                if (12 === e.length) {
                    var d = (e[0] << 24 >>> 0) + (e[1] << 16 >>> 0) + (e[2] << 8 >>> 0) + e[3];
                    i -= 8;
                    var o = l(8);
                    return new Date(1e3 * o + d / 1e6)
                }
                throw new Error("Invalid data length for a date value.")
            }(r) : {
                type: n,
                data: r
            }
        }
    }
    const d = {
        serialize: r,
        deserialize: l,
        encode: r,
        decode: l
    };

    function o(e) {
        return o = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, o(e)
    }
    for (var a, s, y = [{
            id: 0,
            name: "food",
            layer: 0
        }, {
            id: 1,
            name: "walls",
            place: !0,
            limit: 30,
            layer: 0
        }, {
            id: 2,
            name: "spikes",
            place: !0,
            limit: 15,
            layer: 0
        }, {
            id: 3,
            name: "mill",
            sandboxLimit: 299,
            place: !0,
            limit: 7,
            layer: 1
        }, {
            id: 4,
            name: "mine",
            place: !0,
            limit: 1,
            layer: 0
        }, {
            id: 5,
            name: "trap",
            place: !0,
            limit: 6,
            layer: -1
        }, {
            id: 6,
            name: "booster",
            place: !0,
            sandboxLimit: 299,
            limit: 12,
            layer: -1
        }, {
            id: 7,
            name: "turret",
            place: !0,
            limit: 2,
            layer: 1
        }, {
            id: 8,
            name: "watchtower",
            place: !0,
            limit: 12,
            layer: 1
        }, {
            id: 9,
            name: "buff",
            place: !0,
            limit: 4,
            layer: -1
        }, {
            id: 10,
            name: "spawn",
            place: !0,
            limit: 1,
            layer: -1
        }, {
            id: 11,
            name: "sapling",
            place: !0,
            limit: 2,
            layer: 0
        }, {
            id: 12,
            name: "blocker",
            place: !0,
            limit: 3,
            layer: -1
        }, {
            id: 13,
            name: "teleporter",
            place: !0,
            sandboxLimit: 299,
            limit: 2,
            layer: -1
        }], u = ([{
            id: 0,
            type: 0,
            name: "tool hammer",
            desc: "tool for gathering all resources",
            src: "hammer_1",
            length: 140,
            width: 140,
            xOff: -3,
            yOff: 18,
            dmg: 25,
            range: 65,
            gather: 1,
            speed: 300
        }, {
            id: 1,
            type: 0,
            age: 2,
            name: "hand axe",
            desc: "gathers resources at a higher rate",
            src: "axe_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 30,
            spdMult: 1,
            range: 70,
            gather: 2,
            speed: 400
        }, {
            id: 2,
            type: 0,
            age: 8,
            pre: 1,
            name: "great axe",
            desc: "deal more damage and gather more resources",
            src: "great_axe_1",
            length: 140,
            width: 140,
            xOff: -8,
            yOff: 25,
            dmg: 35,
            spdMult: 1,
            range: 75,
            gather: 4,
            speed: 400
        }, {
            id: 3,
            type: 0,
            age: 2,
            name: "short sword",
            desc: "increased attack power but slower move speed",
            src: "sword_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 46,
            dmg: 35,
            spdMult: .85,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 4,
            type: 0,
            age: 8,
            pre: 3,
            name: "katana",
            desc: "greater range and damage",
            src: "samurai_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 59,
            dmg: 40,
            spdMult: .8,
            range: 118,
            gather: 1,
            speed: 300
        }, {
            id: 5,
            type: 0,
            age: 2,
            name: "polearm",
            desc: "long range melee weapon",
            src: "spear_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 45,
            knock: .2,
            spdMult: .82,
            range: 142,
            gather: 1,
            speed: 700
        }, {
            id: 6,
            type: 0,
            age: 2,
            name: "bat",
            desc: "fast long range melee weapon",
            src: "bat_1",
            iPad: 1.3,
            length: 110,
            width: 180,
            xOff: -8,
            yOff: 53,
            dmg: 20,
            knock: .7,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 7,
            type: 0,
            age: 2,
            name: "daggers",
            desc: "really fast short range weapon",
            src: "dagger_1",
            iPad: .8,
            length: 110,
            width: 110,
            xOff: 18,
            yOff: 0,
            dmg: 20,
            knock: .1,
            range: 65,
            gather: 1,
            hitSlow: .1,
            spdMult: 1.13,
            speed: 100
        }, {
            id: 8,
            type: 0,
            age: 2,
            name: "stick",
            desc: "great for gathering but very weak",
            src: "stick_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 1,
            spdMult: 1,
            range: 70,
            gather: 7,
            speed: 400
        }, {
            id: 9,
            type: 1,
            age: 6,
            name: "hunting bow",
            desc: "bow used for ranged combat and hunting",
            src: "bow_1",
            req: ["wood", 4],
            length: 120,
            width: 120,
            xOff: -6,
            yOff: 0,
            dmg: 25,
            projectile: 0,
            spdMult: .75,
            speed: 600
        }, {
            id: 10,
            type: 1,
            age: 6,
            name: "great hammer",
            desc: "hammer used for destroying structures",
            src: "great_hammer_1",
            length: 140,
            width: 140,
            xOff: -9,
            yOff: 25,
            dmg: 10,
            spdMult: .88,
            range: 75,
            sDmg: 7.5,
            gather: 1,
            speed: 400
        }, (a = {
            id: 11,
            type: 1,
            age: 6,
            name: "wooden shield",
            desc: "blocks projectiles and reduces melee damage",
            src: "shield_1",
            length: 120,
            width: 120,
            dmg: 0,
            shield: .2,
            speed: 1,
            xOff: 6,
            yOff: 0,
            spdMult: .7
        }, s = "speed", (s = function(e) {
            var i = function(e) {
                if ("object" != o(e) || !e) return e;
                var i = e[Symbol.toPrimitive];
                if (void 0 !== i) {
                    var t = i.call(e, "string");
                    if ("object" != o(t)) return t;
                    throw new TypeError("@@toPrimitive must return a primitive value.")
                }
                return String(e)
            }(e);
            return "symbol" == o(i) ? i : i + ""
        }(s)) in a ? Object.defineProperty(a, s, {
            value: 1,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : a[s] = 1, a), {
            id: 12,
            type: 1,
            age: 8,
            pre: 9,
            name: "crossbow",
            desc: "deals more damage and has greater range",
            src: "crossbow_1",
            req: ["wood", 5],
            aboveHand: !0,
            armS: .75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            dmg: 35,
            projectile: 2,
            spdMult: .7,
            speed: 700
        }, {
            id: 13,
            type: 1,
            age: 9,
            pre: 12,
            name: "repeater crossbow",
            desc: "high firerate crossbow with reduced damage",
            src: "crossbow_2",
            req: ["wood", 10],
            aboveHand: !0,
            armS: .75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            dmg: 30,
            projectile: 3,
            spdMult: .7,
            speed: 230
        }, {
            id: 14,
            type: 1,
            age: 6,
            name: "mc grabby",
            desc: "steals resources from enemies",
            src: "grab_1",
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 0,
            steal: 250,
            knock: .2,
            spdMult: 1.05,
            range: 125,
            gather: 0,
            speed: 700
        }, {
            id: 15,
            type: 1,
            age: 9,
            pre: 12,
            name: "musket",
            desc: "slow firerate but high damage and range",
            src: "musket_1",
            req: ["stone", 10],
            aboveHand: !0,
            rec: .35,
            armS: .6,
            hndS: .3,
            hndD: 1.6,
            length: 205,
            width: 205,
            xOff: 25,
            yOff: 0,
            dmg: 50,
            projectile: 5,
            hideProjectile: !0,
            spdMult: .6,
            speed: 1500
        }]), p = [{
            group: y[0],
            name: "apple",
            desc: "restores 20 health when consumed",
            req: ["food", 10],
            scale: 22,
            holdOffset: 15
        }, {
            age: 3,
            group: y[0],
            name: "cookie",
            desc: "restores 40 health when consumed",
            req: ["food", 15],
            scale: 27,
            holdOffset: 15
        }, {
            age: 7,
            group: y[0],
            name: "cheese",
            desc: "restores 30 health and another 50 over 5 seconds",
            req: ["food", 25],
            scale: 27,
            holdOffset: 15
        }, {
            group: y[1],
            name: "wood wall",
            desc: "provides protection for your village",
            req: ["wood", 10],
            projDmg: !0,
            health: 380,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 3,
            group: y[1],
            name: "stone wall",
            desc: "provides improved protection for your village",
            req: ["stone", 25],
            health: 900,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            pre: 1,
            group: y[1],
            name: "castle wall",
            desc: "provides powerful protection for your village",
            req: ["stone", 35],
            health: 1500,
            scale: 52,
            holdOffset: 20,
            placeOffset: -5
        }, {
            group: y[2],
            name: "spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 20, "stone", 5],
            health: 400,
            dmg: 20,
            scale: 49,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 5,
            group: y[2],
            name: "greater spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 10],
            health: 500,
            dmg: 35,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 9,
            pre: 1,
            group: y[2],
            name: "poison spikes",
            desc: "poisons enemies when they touch them",
            req: ["wood", 35, "stone", 15],
            health: 600,
            dmg: 30,
            pDmg: 5,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 9,
            pre: 2,
            group: y[2],
            name: "spinning spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 20],
            health: 500,
            dmg: 45,
            turnSpeed: .003,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            group: y[3],
            name: "windmill",
            desc: "generates gold over time",
            req: ["wood", 50, "stone", 10],
            health: 400,
            pps: 1,
            turnSpeed: 0,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 45,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 5,
            pre: 1,
            group: y[3],
            name: "faster windmill",
            desc: "generates more gold over time",
            req: ["wood", 60, "stone", 20],
            health: 500,
            pps: 1.5,
            turnSpeed: 0,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 8,
            pre: 1,
            group: y[3],
            name: "power mill",
            desc: "generates more gold over time",
            req: ["wood", 100, "stone", 50],
            health: 800,
            pps: 2,
            turnSpeed: 0,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 5,
            group: y[4],
            type: 2,
            name: "mine",
            desc: "allows you to mine stone",
            req: ["wood", 20, "stone", 100],
            iconLineMult: 12,
            scale: 65,
            holdOffset: 20,
            placeOffset: 0
        }, {
            age: 5,
            group: y[11],
            type: 0,
            name: "sapling",
            desc: "allows you to farm wood",
            req: ["wood", 150],
            iconLineMult: 12,
            colDiv: .5,
            scale: 110,
            holdOffset: 50,
            placeOffset: -15
        }, {
            age: 4,
            group: y[5],
            name: "pit trap",
            desc: "pit that traps enemies if they walk over it",
            req: ["wood", 30, "stone", 30],
            trap: !0,
            ignoreCollision: !0,
            hideFromEnemy: !0,
            health: 500,
            colDiv: .2,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 4,
            group: y[6],
            name: "boost pad",
            desc: "provides boost when stepped on",
            req: ["stone", 20, "wood", 5],
            ignoreCollision: !0,
            boostSpeed: 1.5,
            health: 150,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: y[7],
            doUpdate: !0,
            name: "turret",
            desc: "defensive structure that shoots at enemies",
            req: ["wood", 200, "stone", 150],
            health: 800,
            projectile: 1,
            shootRange: 700,
            shootRate: 2200,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: y[8],
            name: "platform",
            desc: "platform to shoot over walls and cross over water",
            req: ["wood", 20],
            ignoreCollision: !0,
            zIndex: 1,
            health: 300,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: y[9],
            name: "healing pad",
            desc: "standing on it will slowly heal you",
            req: ["wood", 30, "food", 10],
            ignoreCollision: !0,
            healCol: 15,
            health: 400,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 9,
            group: y[10],
            name: "spawn pad",
            desc: "you will spawn here when you die but it will dissapear",
            req: ["wood", 100, "stone", 100],
            health: 400,
            ignoreCollision: !0,
            spawnPoint: !0,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: y[12],
            name: "blocker",
            desc: "blocks building in radius",
            req: ["wood", 30, "stone", 25],
            ignoreCollision: !0,
            blocker: 300,
            health: 400,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: y[13],
            name: "teleporter",
            desc: "teleports you to a random point on the map",
            req: ["wood", 60, "stone", 60],
            ignoreCollision: !0,
            teleport: !0,
            health: 200,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }], c = 0; c < p.length; c++) p[c].id = c;
    const f = {
        groups: y,
        projectiles: [{
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 25,
            speed: 1.6,
            scale: 103,
            range: 1e3
        }, {
            indx: 1,
            layer: 1,
            dmg: 25,
            scale: 20
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 35,
            speed: 2.5,
            scale: 103,
            range: 1200
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 30,
            speed: 2,
            scale: 103,
            range: 1200
        }, {
            indx: 1,
            layer: 1,
            dmg: 16,
            scale: 20
        }, {
            indx: 0,
            layer: 0,
            src: "bullet_1",
            dmg: 50,
            speed: 3.6,
            scale: 160,
            range: 1400
        }],
        weapons: u,
        list: p
    };

    function h(e) {
        return h = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, h(e)
    }

    function x() {
        x = function() {
            return i
        };
        var e, i = {},
            t = Object.prototype,
            n = t.hasOwnProperty,
            r = Object.defineProperty || function(e, i, t) {
                e[i] = t.value
            },
            l = "function" == typeof Symbol ? Symbol : {},
            d = l.iterator || "@@iterator",
            o = l.asyncIterator || "@@asyncIterator",
            a = l.toStringTag || "@@toStringTag";

        function s(e, i, t) {
            return Object.defineProperty(e, i, {
                value: t,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[i]
        }
        try {
            s({}, "")
        } catch (e) {
            s = function(e, i, t) {
                return e[i] = t
            }
        }

        function y(e, i, t, n) {
            var l = i && i.prototype instanceof v ? i : v,
                d = Object.create(l.prototype),
                o = new C(n || []);
            return r(d, "_invoke", {
                value: O(e, t, o)
            }), d
        }

        function u(e, i, t) {
            try {
                return {
                    type: "normal",
                    arg: e.call(i, t)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        i.wrap = y;
        var p = "suspendedStart",
            c = "suspendedYield",
            f = "executing",
            m = "completed",
            g = {};

        function v() {}

        function b() {}

        function w() {}
        var k = {};
        s(k, d, (function() {
            return this
        }));
        var S = Object.getPrototypeOf,
            P = S && S(S(A([])));
        P && P !== t && n.call(P, d) && (k = P);
        var I = w.prototype = v.prototype = Object.create(k);

        function T(e) {
            ["next", "throw", "return"].forEach((function(i) {
                s(e, i, (function(e) {
                    return this._invoke(i, e)
                }))
            }))
        }

        function D(e, i) {
            function t(r, l, d, o) {
                var a = u(e[r], e, l);
                if ("throw" !== a.type) {
                    var s = a.arg,
                        y = s.value;
                    return y && "object" == h(y) && n.call(y, "__await") ? i.resolve(y.__await).then((function(e) {
                        t("next", e, d, o)
                    }), (function(e) {
                        t("throw", e, d, o)
                    })) : i.resolve(y).then((function(e) {
                        s.value = e, d(s)
                    }), (function(e) {
                        return t("throw", e, d, o)
                    }))
                }
                o(a.arg)
            }
            var l;
            r(this, "_invoke", {
                value: function(e, n) {
                    function r() {
                        return new i((function(i, r) {
                            t(e, n, i, r)
                        }))
                    }
                    return l = l ? l.then(r, r) : r()
                }
            })
        }

        function O(i, t, n) {
            var r = p;
            return function(l, d) {
                if (r === f) throw Error("Generator is already running");
                if (r === m) {
                    if ("throw" === l) throw d;
                    return {
                        value: e,
                        done: !0
                    }
                }
                for (n.method = l, n.arg = d;;) {
                    var o = n.delegate;
                    if (o) {
                        var a = E(o, n);
                        if (a) {
                            if (a === g) continue;
                            return a
                        }
                    }
                    if ("next" === n.method) n.sent = n._sent = n.arg;
                    else if ("throw" === n.method) {
                        if (r === p) throw r = m, n.arg;
                        n.dispatchException(n.arg)
                    } else "return" === n.method && n.abrupt("return", n.arg);
                    r = f;
                    var s = u(i, t, n);
                    if ("normal" === s.type) {
                        if (r = n.done ? m : c, s.arg === g) continue;
                        return {
                            value: s.arg,
                            done: n.done
                        }
                    }
                    "throw" === s.type && (r = m, n.method = "throw", n.arg = s.arg)
                }
            }
        }

        function E(i, t) {
            var n = t.method,
                r = i.iterator[n];
            if (r === e) return t.delegate = null, "throw" === n && i.iterator.return && (t.method = "return", t.arg = e, E(i, t), "throw" === t.method) || "return" !== n && (t.method = "throw", t.arg = new TypeError("The iterator does not provide a '" + n + "' method")), g;
            var l = u(r, i.iterator, t.arg);
            if ("throw" === l.type) return t.method = "throw", t.arg = l.arg, t.delegate = null, g;
            var d = l.arg;
            return d ? d.done ? (t[i.resultName] = d.value, t.next = i.nextLoc, "return" !== t.method && (t.method = "next", t.arg = e), t.delegate = null, g) : d : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, g)
        }

        function M(e) {
            var i = {
                tryLoc: e[0]
            };
            1 in e && (i.catchLoc = e[1]), 2 in e && (i.finallyLoc = e[2], i.afterLoc = e[3]), this.tryEntries.push(i)
        }

        function j(e) {
            var i = e.completion || {};
            i.type = "normal", delete i.arg, e.completion = i
        }

        function C(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(M, this), this.reset(!0)
        }

        function A(i) {
            if (i || "" === i) {
                var t = i[d];
                if (t) return t.call(i);
                if ("function" == typeof i.next) return i;
                if (!isNaN(i.length)) {
                    var r = -1,
                        l = function t() {
                            for (; ++r < i.length;)
                                if (n.call(i, r)) return t.value = i[r], t.done = !1, t;
                            return t.value = e, t.done = !0, t
                        };
                    return l.next = l
                }
            }
            throw new TypeError(h(i) + " is not iterable")
        }
        return b.prototype = w, r(I, "constructor", {
            value: w,
            configurable: !0
        }), r(w, "constructor", {
            value: b,
            configurable: !0
        }), b.displayName = s(w, a, "GeneratorFunction"), i.isGeneratorFunction = function(e) {
            var i = "function" == typeof e && e.constructor;
            return !!i && (i === b || "GeneratorFunction" === (i.displayName || i.name))
        }, i.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, w) : (e.__proto__ = w, s(e, a, "GeneratorFunction")), e.prototype = Object.create(I), e
        }, i.awrap = function(e) {
            return {
                __await: e
            }
        }, T(D.prototype), s(D.prototype, o, (function() {
            return this
        })), i.AsyncIterator = D, i.async = function(e, t, n, r, l) {
            void 0 === l && (l = Promise);
            var d = new D(y(e, t, n, r), l);
            return i.isGeneratorFunction(t) ? d : d.next().then((function(e) {
                return e.done ? e.value : d.next()
            }))
        }, T(I), s(I, a, "Generator"), s(I, d, (function() {
            return this
        })), s(I, "toString", (function() {
            return "[object Generator]"
        })), i.keys = function(e) {
            var i = Object(e),
                t = [];
            for (var n in i) t.push(n);
            return t.reverse(),
                function e() {
                    for (; t.length;) {
                        var n = t.pop();
                        if (n in i) return e.value = n, e.done = !1, e
                    }
                    return e.done = !0, e
                }
        }, i.values = A, C.prototype = {
            constructor: C,
            reset: function(i) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = e, this.done = !1, this.delegate = null, this.method = "next", this.arg = e, this.tryEntries.forEach(j), !i)
                    for (var t in this) "t" === t.charAt(0) && n.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = e)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(i) {
                if (this.done) throw i;
                var t = this;

                function r(n, r) {
                    return o.type = "throw", o.arg = i, t.next = n, r && (t.method = "next", t.arg = e), !!r
                }
                for (var l = this.tryEntries.length - 1; l >= 0; --l) {
                    var d = this.tryEntries[l],
                        o = d.completion;
                    if ("root" === d.tryLoc) return r("end");
                    if (d.tryLoc <= this.prev) {
                        var a = n.call(d, "catchLoc"),
                            s = n.call(d, "finallyLoc");
                        if (a && s) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0);
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        } else if (a) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0)
                        } else {
                            if (!s) throw Error("try statement without catch or finally");
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, i) {
                for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                    var r = this.tryEntries[t];
                    if (r.tryLoc <= this.prev && n.call(r, "finallyLoc") && this.prev < r.finallyLoc) {
                        var l = r;
                        break
                    }
                }
                l && ("break" === e || "continue" === e) && l.tryLoc <= i && i <= l.finallyLoc && (l = null);
                var d = l ? l.completion : {};
                return d.type = e, d.arg = i, l ? (this.method = "next", this.next = l.finallyLoc, g) : this.complete(d)
            },
            complete: function(e, i) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && i && (this.next = i), g
            },
            finish: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.finallyLoc === e) return this.complete(t.completion, t.afterLoc), j(t), g
                }
            },
            catch: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.tryLoc === e) {
                        var n = t.completion;
                        if ("throw" === n.type) {
                            var r = n.arg;
                            j(t)
                        }
                        return r
                    }
                }
                throw Error("illegal catch attempt")
            },
            delegateYield: function(i, t, n) {
                return this.delegate = {
                    iterator: A(i),
                    resultName: t,
                    nextLoc: n
                }, "next" === this.method && (this.arg = e), g
            }
        }, i
    }

    function m(e, i, t, n, r, l, d) {
        try {
            var o = e[l](d),
                a = o.value
        } catch (e) {
            return void t(e)
        }
        o.done ? i(a) : Promise.resolve(a).then(n, r)
    }

    function g(e) {
        return function() {
            var i = this,
                t = arguments;
            return new Promise((function(n, r) {
                var l = e.apply(i, t);

                function d(e) {
                    m(l, n, r, d, o, "next", e)
                }

                function o(e) {
                    m(l, n, r, d, o, "throw", e)
                }
                d(void 0)
            }))
        }
    }

    function v(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, w(n.key), n)
        }
    }

    function b(e, i, t) {
        return (i = w(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function w(e) {
        var i = function(e) {
            if ("object" != h(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != h(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == h(i) ? i : i + ""
    }
    var k = function() {
        return function(e, i, t) {
            return t && v(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "sendVerification",
            value: (i = g(x().mark((function e() {
                return x().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                        case "end":
                            return e.stop()
                    }
                }), e)
            }))), function() {
                return i.apply(this, arguments)
            })
        }, {
            key: "send",
            value: function(e) {}
        }, {
            key: "init",
            value: (e = g(x().mark((function e() {
                return x().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                        case "end":
                            return e.stop()
                    }
                }), e)
            }))), function() {
                return e.apply(this, arguments)
            })
        }]);
        var e, i
    }();

    function S(e) {
        return S = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, S(e)
    }

    function P(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, I(n.key), n)
        }
    }

    function I(e) {
        var i = function(e) {
            if ("object" != S(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != S(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == S(i) ? i : i + ""
    }
    b(k, "validated", !1), b(k, "lastPingSocket", 0), b(k, "users", []), b(k, "userLocations", []);
    var T = function() {
        return function(e, i) {
            return i && P(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e(i) {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e), this.sid = i
        }), [{
            key: "init",
            value: function(e, i, t, n, r, l, d) {
                l = l || {}, this.sentTo = {}, this.gridLocations = [], this.active = !0, this.doUpdate = l.doUpdate, this.x = e, this.y = i, this.dir = t, this.xWiggle = 0, this.yWiggle = 0, this.scale = n, this.type = r, this.colorType = Fr.randInt(0, 10), this.id = l.id, this.owner = d, this.name = l.name, this.isItem = null != this.id, this.group = l.group, this.health = l.health, this.currentHealth = this.health, this.layer = 2, null != this.group ? this.layer = this.group.layer : 0 == this.type ? this.layer = 3 : 2 == this.type ? this.layer = 0 : 4 == this.type && (this.layer = -1), this.colDiv = l.colDiv || 1, this.turretReload = 2200, this.blocker = l.blocker, this.ignoreCollision = l.ignoreCollision, this.dontGather = l.dontGather, this.hideFromEnemy = l.hideFromEnemy, this.friction = l.friction, this.projDmg = l.projDmg, this.dmg = l.dmg, this.pDmg = l.pDmg, this.pps = l.pps, this.zIndex = l.zIndex || 0, this.turnSpeed = l.turnSpeed, this.req = l.req, this.trap = l.trap, this.healCol = l.healCol, this.teleport = l.teleport, this.boostSpeed = l.boostSpeed, this.projectile = l.projectile, this.shootRange = l.shootRange, this.shootRate = l.shootRate, this.shootCount = this.shootRate, this.spawnPoint = l.spawnPoint, this.breakPotential = !1, 1 == this.type && this.y <= 12e3 ? this.pathScale = .6 * this.scale + 35 : 0 == this.type ? this.pathScale = .6 * this.scale + 18 : this.owner && this.dmg && !Fr.isFriendly(this.owner.sid) || this.teleport || this.boostSpeed ? this.pathScale = this.scale + 48 : 1 == this.type && this.y >= 12e3 ? this.pathScale = .55 * this.scale + 47 : this.owner && "pit trap" == this.name && !Fr.isFriendly(this.owner.sid) ? this.pathScale = this.scale + 48 : this.ignoreCollision ? this.pathScale = 0 : this.pathScale = this.scale + 18
            }
        }, {
            key: "getScale",
            value: function(e, i) {
                return e = e || 1, this.scale * (this.isItem || 2 == this.type || 3 == this.type || 4 == this.type ? 1 : .6 * e) * (i ? 1 : this.colDiv)
            }
        }, {
            key: "update",
            value: function(e) {
                this.active && (this.xWiggle && (this.xWiggle *= Math.pow(.99, e)), this.yWiggle && (this.yWiggle *= Math.pow(.99, e)), this.turnSpeed && (this.dir += this.turnSpeed * e))
            }
        }])
    }();

    function D(e) {
        return D = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, D(e)
    }

    function O(e) {
        return function(e) {
            if (Array.isArray(e)) return M(e)
        }(e) || function(e) {
            if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
        }(e) || E(e) || function() {
            throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }()
    }

    function E(e, i) {
        if (e) {
            if ("string" == typeof e) return M(e, i);
            var t = {}.toString.call(e).slice(8, -1);
            return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? M(e, i) : void 0
        }
    }

    function M(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function j(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, C(n.key), n)
        }
    }

    function C(e) {
        var i = function(e) {
            if ("object" != D(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != D(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == D(i) ? i : i + ""
    }
    var A = function() {
        return function(e, i, t) {
            return t && j(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "getKey",
            value: function(e) {
                var i = t.mapScale / t.colGrid;
                return "".concat(Math.floor(e.x / i), ",").concat(Math.floor(e.y / i))
            }
        }, {
            key: "addObject",
            value: function(e) {
                var i = this.getKey(e);
                this.grid.has(i) || this.grid.set(i, []), this.grid.get(i).push(e)
            }
        }, {
            key: "removeObject",
            value: function(e) {
                var i = this.getKey(e);
                if (this.grid.has(i)) {
                    var t = this.grid.get(i),
                        n = t.indexOf(e);
                    n >= 0 && t.splice(n, 1), 0 == t.length ? this.grid.delete(i) : this.grid.set(i, t)
                }
            }
        }, {
            key: "getObjects",
            value: function(e, i) {
                for (var t = function(e, i) {
                        return function(e) {
                            if (Array.isArray(e)) return e
                        }(e) || function(e, i) {
                            var t = null == e ? null : "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
                            if (null != t) {
                                var n, r, l, d, o = [],
                                    a = !0,
                                    s = !1;
                                try {
                                    if (l = (t = t.call(e)).next, 0 === i) {
                                        if (Object(t) !== t) return;
                                        a = !1
                                    } else
                                        for (; !(a = (n = l.call(t)).done) && (o.push(n.value), o.length !== i); a = !0);
                                } catch (e) {
                                    s = !0, r = e
                                } finally {
                                    try {
                                        if (!a && null != t.return && (d = t.return(), Object(d) !== d)) return
                                    } finally {
                                        if (s) throw r
                                    }
                                }
                                return o
                            }
                        }(e, i) || E(e, i) || function() {
                            throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                        }()
                    }(this.getKey({
                        x: e,
                        y: i
                    }).split(",").map(Number), 2), n = t[0], r = t[1], l = [], d = -1; d <= 1; d++)
                    for (var o = -1; o <= 1; o++) {
                        var a = "".concat(n + d, ",").concat(r + o);
                        this.grid.has(a) && l.push.apply(l, O(this.grid.get(a).filter((function(e) {
                            return e.active
                        }))))
                    }
                return l
            }
        }])
    }();

    function B(e) {
        return B = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, B(e)
    }

    function L(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function R(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, N(n.key), n)
        }
    }

    function H(e, i, t) {
        return (i = N(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function N(e) {
        var i = function(e) {
            if ("object" != B(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != B(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == B(i) ? i : i + ""
    }! function(e, i, t) {
        (i = C(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(A, "grid", new Map);
    var W = function() {
        return function(e, i, t) {
            return t && R(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "init",
            value: function() {
                this.menu = document.createElement("div"), this.menu.style = "position: absolute; opacity: 0; pointer-events: none; z-index: 1000; top: 50%; left: 50%; width: 700px; height: 475px; transform: translate(-50%, -50%); border-radius: 6px; background-color: rgba(0, 0, 0, .6); transition: all ease-in .5s; overflow: hidden;", this.tabHolder = document.createElement("div"), this.tabHolder.style = "position: absolute; top: 0px; left: 0px; width: 212.5px; height: calc(100% - 40px); background-color: rgba(0, 0, 0, .1);", this.menu.appendChild(this.tabHolder);
                var e = document.createElement("div");
                e.style = "z-index: 1000; justify-content: center; position: absolute; display: flex; align-items: center; bottom: 35px; left: 0px; width: 212.5px; height: 30px; font-size: 12px; color: white;", this.menu.appendChild(e);
                var i = document.createElement("img");
                i.style = "display: none; width: 25px; height: 25px; border-radius: 100%; cursor: pointer; pointer-events: auto;", i.onerror = function() {
                    this.src.includes(".gif") ? this.src = this.src.split(".gif")[0] + ".png" : (this.onerror = null, this.src = Fr.returnAvatarFormat())
                }, e.appendChild(i), this.socketPing = document.createElement("div"), this.socketPing.style = "justify-content: center; position: absolute; display: flex; align-items: center; bottom: 0px; left: 0px; width: 212.5px; height: 40px; background-color: rgba(0, 0, 0, 0.1); font-size: 12px; color: white;", this.socketPing.innerText = "", this.menu.appendChild(this.socketPing), this.itemHolder = document.createElement("div"), this.itemHolder.style = "position: absolute; top: 0px; left: 212.5px; width: calc(100% - 212.5px); height: 100%; overflow: hidden;", this.menu.appendChild(this.itemHolder), document.body.appendChild(this.menu);
                var t = this.initTabs([{
                    label: "Home",
                    icon: "https://i.imgur.com/Da9LKoE.png"
                }, {
                    label: "Combat",
                    icon: "https://i.imgur.com/sR5JnTE.png"
                }, {
                    label: "Defense",
                    icon: "https://i.imgur.com/0fz1qiE.png"
                }, {
                    label: "Visual",
                    icon: "https://i.imgur.com/cJOwD3n.png"
                }, {
                    label: "Bots",
                    icon: "https://i.imgur.com/g6p10wB.png"
                }, {
                    label: "Pet",
                    icon: "https://i.imgur.com/kbmMTNu.png"
                }, {
                    label: "Logs",
                    icon: "https://i.imgur.com/XWv7qI9.png"
                }, {
                    label: "Other",
                    icon: "https://i.imgur.com/9fbjRuw.png"
                }]);
                this.initItems([
                    [{
                        label: "Auto Upgrade",
                        id: "autoUpgrade",
                        type: "group toggle",
                        options: [{
                            label: "7th Slot",
                            id: "7thSlot",
                            type: "select",
                            options: [{
                                label: "Teleport",
                                selected: !0,
                                value: 38
                            }, {
                                label: "Turret",
                                value: 33
                            }, {
                                label: "Healing Pad",
                                value: 35
                            }, {
                                label: "Blocker",
                                value: 37
                            }, {
                                label: "Platform",
                                value: 34
                            }]
                        }],
                        checked: !0
                    }, {
                        label: "Auto Grind",
                        info: "Enables you to grind for weapon xp.",
                        id: "autoGrind",
                        type: "toggle"
                    }, {
                        label: "Mouseless",
                        info: "Unrestricts aimming which allows constant direction updating.",
                        id: "mouseless",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Collect User Stats",
                        info: "Grants the permission for the script to log kills,<br>deaths, and time spent playing.",
                        id: "collectStats",
                        type: "toggle",
                        checked: !1
                    }, {
                        label: "Kill Chat",
                        id: "killChat",
                        type: "toggle"
                    }],
                    [{
                        label: "Auto Place",
                        info: "Enables an advanced placement algorithm that<br>efficiently calculates the best placement angles for combat.",
                        id: "autoPlace",
                        type: "group toggle",
                        options: [{
                            label: "Range",
                            id: "autoPlaceRange",
                            type: "number",
                            value: 400,
                            max: 2e3,
                            size: 15,
                            min: 100
                        }]
                    }, {
                        label: "Auto Replace",
                        info: "Enables an advanced placement algorithm that<br>efficiently replaces broken objects.",
                        id: "autoReplace",
                        type: "group toggle",
                        options: [{
                            label: "Range",
                            id: "autoReplaceRange",
                            type: "number",
                            value: 400,
                            max: 2e3,
                            size: 15,
                            min: 100
                        }],
                        checked: !0
                    }, {
                        label: "Auto Push",
                        info: "Enables a pushing algorithm that<br>assists the user in pushing opponents into spikes.",
                        id: "autoPush",
                        type: "group toggle",
                        options: [{
                            label: "Range",
                            id: "autoPushRange",
                            type: "number",
                            value: 300,
                            max: 2e3,
                            size: 10,
                            min: 100
                        }, {
                            label: "Render Auto Push Line",
                            id: "renderAutoPushLine",
                            type: "toggle",
                            checked: !0
                        }],
                        checked: !0
                    }, {
                        label: "Map Ping Sync Type",
                        id: "mapPingSyncType",
                        type: "select",
                        options: [{
                            label: "None",
                            selected: !0,
                            value: 0
                        }, {
                            label: "Melee Hit",
                            value: 1
                        }]
                    }, {
                        label: "One Tick",
                        type: "group",
                        options: [{
                            label: "One Tick Key",
                            id: "oneTickKey",
                            type: "keybind",
                            key: "t",
                            logic: function() {}
                        }, {
                            label: "Auto One Tick",
                            info: "Automatically performs onetick without having to press any key!",
                            id: "autoOneTick",
                            type: "group toggle",
                            checked: !0,
                            disabled: !0,
                            options: [{
                                label: "Ignore Soldier",
                                id: "oneTickIgnoreSoldier",
                                type: "toggle"
                            }]
                        }]
                    }, {
                        label: "ATOS",
                        type: "group",
                        options: [{
                            label: "ATOS Key",
                            id: "atosKey",
                            type: "keybind",
                            key: "r",
                            logic: function() {}
                        }]
                    }, {
                        label: "Auto Hits",
                        type: "group",
                        options: [{
                            label: "Hit During Auto Push",
                            id: "autoHitSpike",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Spike KB Hit",
                            id: "autoKBHitSpike",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Spiek Tick",
                            id: "spiekTick",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Auto KB Insta",
                            id: "autoKBInsta",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Melee Turret Sync",
                            id: "meleeTurretSync",
                            type: "toggle",
                            checked: !0
                        }],
                        margin: !0
                    }],
                    [{
                        label: "Auto Buy",
                        id: "autoBuy",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Select Fastest Wpn",
                        id: "selectFastestWpn",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Auto Brake",
                        info: "Assists in stopping/braking the player's movement<br>so that it ensures the player won't make comtact with spikes/tps.",
                        id: "autoBrake",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Breaking",
                        type: "group",
                        options: [{
                            label: "Auto Break",
                            info: "Automatic building breaking once in a trap",
                            id: "autoBreak",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Out of Trap Breaking",
                            info: "Automatic building breaking during certain conditions when not trapped.",
                            id: "autoBreakObject",
                            type: "toggle",
                            checked: !0
                        }]
                    }, {
                        label: "Healing",
                        type: "group",
                        options: [{
                            label: "Use Soldier-EMP Anti",
                            info: "Performs soldier emp equipment abuse to survive instakills.",
                            id: "soldierEMP",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Sensitive Healing",
                            id: "sensitiveHealing",
                            type: "toggle",
                            checked: !0
                        }],
                        margin: !0
                    }],
                    [{
                        label: "Visual Presets",
                        id: "visualPresets",
                        type: "preset toggles",
                        options: [{
                            label: "No Visuals",
                            type: "toggle",
                            id: "setNoVisualsPreset",
                            presetOn: ["renderGrids", "renderNames"]
                        }, {
                            label: "Default Chicken",
                            type: "toggle",
                            id: "setDefaultVisualsPreset",
                            presetOn: ["renderTracers", "renderAutoPushLine", "renderPlacements", "renderRedOverlay", "renderPacketCounter", "renderSid", "renderRealDirection", "renderBuildingDamageText", "renderReloadingBars", "renderNames", "renderShamecount", "renderBuildingHealth"]
                        }, {
                            label: "Mimic x18k",
                            type: "toggle",
                            id: "setx18kVisualsPreset",
                            presetOn: ["renderGlobalPathfindingPath", "renderAutoPushLine", "renderPlacements", "renderBuildingSid", "renderDarkOverlay", "renderShadows", "renderPacketCounter", "renderSid", "renderBuildingDamageText", "renderRealDirection", "renderShamecount", "renderBuildingHealth"]
                        }]
                    }, {
                        label: "Hyper Optimizations",
                        id: "hyperOptim",
                        type: "toggle"
                    }, {
                        label: "Render Grids",
                        id: "renderGrids",
                        type: "group toggle",
                        options: [{
                            label: "Throttle",
                            id: "gridRenderingPower",
                            type: "number",
                            value: 18,
                            max: 32,
                            min: 2
                        }]
                    }, {
                        label: "Debugging",
                        type: "group",
                        options: [{
                            label: "Render Packet Counter",
                            id: "renderPacketCounter",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Real Direction",
                            id: "renderRealDirection",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Building Damage",
                            id: "renderBuildingDamageText",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Placements",
                            id: "renderPlacements",
                            type: "toggle",
                            checked: !0
                        }]
                    }, {
                        label: "Buildings",
                        type: "group",
                        options: [{
                            label: "Render Building Health",
                            id: "renderBuildingHealth",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Building Sid",
                            id: "renderBuildingSid",
                            type: "toggle"
                        }]
                    }, {
                        label: "Combat Oriented",
                        type: "group",
                        options: [{
                            label: "Render Reloading Bars",
                            id: "renderReloadingBars",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Shamecount",
                            id: "renderShamecount",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Red Overlay on Spikes/Traps",
                            id: "renderRedOverlay",
                            type: "toggle",
                            checked: !0
                        }]
                    }, {
                        label: "GoL / Misc",
                        type: "group",
                        options: [{
                            label: "Render Player/AI Names",
                            id: "renderNames",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Player Sids",
                            id: "renderSid",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Shadows",
                            id: "renderShadows",
                            type: "toggle"
                        }, {
                            label: "Dark Overlay",
                            id: "renderDarkOverlay",
                            type: "toggle"
                        }, {
                            label: "Player Tracers",
                            id: "renderTracers",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Render Global Path",
                            id: "renderGlobalPathfindingPath",
                            type: "toggle",
                            checked: !0
                        }],
                        margin: !0
                    }],
                    [],
                    [{
                        label: "Pet",
                        id: "moomooPet",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Toxic Chatting",
                        info: "Makes the ".concat(this.highlightText("Pet"), " agressive"),
                        id: "toxicMoomooPet",
                        type: "toggle",
                        checked: !0
                    }, {
                        label: "Idle",
                        type: "group",
                        options: [{
                            label: "Spinning",
                            id: "petSpinningIdle",
                            type: "toggle",
                            checked: !0
                        }, {
                            label: "Chatting",
                            id: "petChattingIdle",
                            type: "toggle",
                            checked: !0
                        }]
                    }],
                    [],
                    [{
                        label: "Credits",
                        type: "group",
                        options: [],
                        text: "\n                Credits goes to: ".concat(this.highlightText("Me"), ", ").concat(this.highlightText("Myself"), ", and ").concat(this.highlightText("I"), " for designing and coding the menu.<br>\n                Credits goes to: ").concat(this.highlightText("Luchador"), " and ").concat(this.highlightText("ele5570"), " for making the core logic that makes chicken mod, chicken mod!<br>\n                Credits goes to: ").concat(this.highlightText("Mega"), " for maintaining the script for years and keeping the script ").concat(this.highlightText('"up-to-date"'), '.<br>\n                <div style="font-size: 4px">self glaze op</div>\n                '),
                        margin: !0
                    }]
                ], t)
            }
        }, {
            key: "highlightText",
            value: function(e) {
                return '<span style="color: #f00;">'.concat(e, "</span>")
            }
        }, {
            key: "loggerFunction",
            value: function(e) {
                "clear" == e || "autoclear" == e ? (this.privateLogger.innerHTML = "", this.chatLog.innerHTML = '\n            <div style="font-size: 13px; margin-left: 5px; margin-top: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>\n            <span style="color: #ffff00">').concat("autoclear" == e ? "Auto cleared chat logger" : "Cleared chat logger", "</span>\n            </div>\n            ")) : (this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px; margin-top: 0px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>\n            <span style="color: #9e9e9e">').concat(e, "</span>\n            </div>\n            "), this.autoScroll(er.sid, er.name))
            }
        }, {
            key: "convertEmojis",
            value: function(e) {
                return e
            }
        }, {
            key: "changeTab",
            value: function(e, i) {
                this.oldTab.style.backgroundColor = null, this.oldTab.style.pointerEvents = null, e.style.backgroundColor = "rgba(255, 255, 255, .25)", e.style.pointerEvents = "none", this.oldTab = e;
                for (var t = 0; t < this.items.length; t++) this.items[t].style.top = "".concat(475 * (t - i), "px")
            }
        }, {
            key: "initTabs",
            value: function(e) {
                var i = this;
                this.tabHolder.innerHTML = '\n            <div style="position: absolute; font-size: 25px; left: 50%; top: 20px; color: #fff; transform: translateX(-50%);">Chicken</div>\n            <div style="position: absolute; font-size: 15px; right: 47.5px; top: 12.5px; color: #fff; text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #00f, 0 0 70px #00f, 0 0 80px #00f, 0 0 100px #00f, 0 0 150px #00f;">V4</div>\n        ';
                for (var t = function(t) {
                        var n = e[t],
                            r = document.createElement("div");
                        r.id = "tab:".concat(t), r.style = "cursor: pointer; transition: all linear .35s; display: flex; align-items: center; width: calc(100% - 20px); height: 30px; position: absolute; left: 10px; border-radius: 6px;", r.style.top = "".concat(35 * t + 65, "px"), r.innerHTML = '\n            <img src="'.concat(n.icon, '" width="20" height="20" style="margin-left: 2px;">\n            <div style="color: white; margin-left: 5px;">').concat(n.label, "</div>\n            "), r.onmouseout = function() {
                            r.id !== i.oldTab.id && (r.style.backgroundColor = null)
                        }, r.onmouseover = function() {
                            this.style.backgroundColor = "rgba(255, 255, 255, .25)"
                        }, r.onclick = function() {
                            i.changeTab(r, t)
                        }, 0 == t && (r.style.backgroundColor = "rgba(255, 255, 255, .25)", r.style.pointerEvents = "none", i.oldTab = r), i.tabHolder.appendChild(r)
                    }, n = 0; n < e.length; n++) t(n);
                return e
            }
        }, {
            key: "getCurrentTime",
            value: function() {
                var e = new Date,
                    i = e.getHours(),
                    t = e.getMinutes(),
                    n = i >= 12 ? "PM" : "AM",
                    r = i % 12 == 0 ? 12 : i % 12,
                    l = t < 10 ? "0".concat(t) : t;
                return "".concat(r, ":").concat(l, " ").concat(n)
            }
        }, {
            key: "createTag",
            value: function(e, i, t) {
                var n = this,
                    r = i.value,
                    l = document.createElement("div");
                l.style = "cursor: pointer; display: inline-block; font-size: 12px; background-color: rgba(255, 255, 255, 0.25); padding: 1px 6px 1px 6px; border-radius: 6px; margin: 3px;", l.innerHTML = r, l.onclick = function() {
                    var e = n.toggles[t].findIndex((function(e) {
                        return e == r
                    }));
                    e >= 0 && n.toggles[t].splice(e, 1), l.remove()
                }, e.insertBefore(l, i)
            }
        }, {
            key: "generateDefaultNames",
            value: function() {
                for (var e = ["Tamer", "Damper", "Vajra", "Punisher", "Spark", "Razdor", "Molot", "Ecu", "Gust", "Magnum", "Halo", "Jaw", "Claw", "Talon", "Atomizer", "Thunder", "Brisant", "Reaper", "Evora", "Veyron", "Glory", "Subduer", "Talon", "Lance", "Fengbao", "Leiming", "Screamer", "Inferno"], i = ["Luchador", "Ochokochi", "Fenrir", "Fafnir", "Curie", "Indra", "Rook", "Ravana", "Hover", "Bulwark", "Lynx", "Ares", "Ao Jun", "Ophion", "Revenant", "Aether", "Nether", "Shenlou", "Pathfinder", "Dux", "Mender", "Condor"], t = [], n = 0; n < 20; n++) {
                    var r = e[Math.floor(Math.random() * e.length)],
                        l = i[Math.floor(Math.random() * i.length)],
                        d = "".concat(r).concat(l);
                    t.push(d.slice(0, 15))
                }
                return function(e) {
                    return function(e) {
                        if (Array.isArray(e)) return L(e)
                    }(e) || function(e) {
                        if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
                    }(e) || function(e, i) {
                        if (e) {
                            if ("string" == typeof e) return L(e, i);
                            var t = {}.toString.call(e).slice(8, -1);
                            return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? L(e, i) : void 0
                        }
                    }(e) || function() {
                        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                    }()
                }(new Set(t))
            }
        }, {
            key: "Builder",
            value: function(e, i, t, n, r) {
                var l = this;
                if ("toggle" == e.type) {
                    if (!e.id) throw Error("No ID found for ON/OFF TOGGLE");
                    var d = document.createElement("div");
                    if (d.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;", n && (d.style.position = "absolute", d.style.top = "".concat(45 * t + 45, "px")), t > 0 && (d.style.marginTop = "5px"), e.margin && (d.style.marginBottom = "10px"), d.innerHTML = '\n            <div style="margin-left: 5px;">'.concat(e.label, "</div>\n            "), e.info) {
                        var o = document.createElement("div");
                        o.style = "\n                    margin-left: 3px; \n                    font-size: 10px; \n                    display: flex; \n                    align-items: center; \n                    justify-content: center; \n                    width: 13px; \n                    height: 13px; \n                    border-radius: 50%; \n                    background-color: rgba(255, 255, 255, .6); \n                    cursor: pointer; \n                    position: relative;\n                ", o.innerHTML = "i", o.onmouseout = function() {
                            this.style.backgroundColor = "rgba(255, 255, 255, .6)";
                            var e = this.querySelector(".tooltip");
                            e && (e.style.display = "none")
                        }, o.onmouseover = function() {
                            this.style.backgroundColor = "rgba(255, 255, 255, .4)";
                            var e = this.querySelector(".tooltip");
                            e && (e.style.display = "block")
                        };
                        var a = document.createElement("div");
                        a.className = "tooltip", a.style = "\n                    display: none; \n                    position: absolute; \n                    top: 20px; \n                    left: 50%; \n                    transform: translateX(-10px); \n                    background-color: #333; \n                    color: #fff; \n                    padding: 5px; \n                    border-radius: 4px; \n                    font-size: 10px; \n                    white-space: nowrap; \n                    z-index: 999999;\n                ", a.innerHTML = e.info, o.appendChild(a), d.appendChild(o)
                    }
                    var s = document.createElement("div");
                    s.id = "toggle:id:".concat(e.id), s.style = "position: absolute; cursor: pointer; display: flex; align-items: center; top: 5px; right: 10px; width: 55px; height: 30px; background-color: #ccc; border-radius: 16px; transition: 0.2s ease-out;";
                    var y = document.createElement("div");
                    return y.style = "background-color: white; width: 22px; height: 22px; border-radius: 100%; position: absolute; transform: translateX(5px); transition: 0.2s ease-out;", s.appendChild(y), s.onclick = function() {
                        if (l.toggles[e.id] = !l.toggles[e.id]) {
                            if (r)
                                for (var i in l.toggles[r + ":preferedPreset"] = s.id, l.toggles) i.includes("render") && (l.toggles[i] ? e.presetOn.includes(i) || document.getElementById("toggle:id:".concat(i)).click() : e.presetOn.includes(i) && document.getElementById("toggle:id:".concat(i)).click());
                            s.style.backgroundColor = "#2196f3", y.style.transform = "translateX(28px)"
                        } else r && l.toggles[r + ":preferedPreset"] == s.id && (l.toggles[r + ":preferedPreset"] = !1), s.style.backgroundColor = "#ccc", y.style.transform = "translateX(5px)"
                    }, d.appendChild(s), e.checked ? s.click() : this.toggles[e.id] = !1, i.appendChild(d), s
                }
                if ("group" == e.type) {
                    var u = e.options,
                        p = document.createElement("div");
                    p.style = "position: relative; margin-left: 10px; width: calc(100% - 20px); background-color: rgba(0, 0, 0, .25); padding-top: 25px; padding-bottom: 7px; border-radius: 6px;", e.margin && (p.style.marginBottom = "10px");
                    var c = document.createElement("div");
                    c.style = "position: absolute; left: 0px; top: 4px; color: white; width: 100%; text-align: center;", c.innerText = e.label, p.appendChild(c);
                    var f = document.createElement("div");
                    e.text && (f.style = "margin-left: 6px; color: white; max-width: calc(100% - 12px);", f.innerHTML = e.text, p.appendChild(f)), t > 0 && (p.style.marginTop = "7px");
                    for (var h = 0; h < u.length; h++) {
                        var x = u[h];
                        this.Builder(x, p, h)
                    }
                    i.appendChild(p)
                } else if ("number" == e.type || "text" == e.type) {
                    var m = document.createElement("div");
                    m.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;", t > 0 && (m.style.marginTop = "5px"), e.margin && (m.style.marginBottom = "10px"), n && (m.style.position = "absolute", m.style.top = "".concat(45 * t + 45, "px")), m.innerHTML = '\n            <div style="margin-left: 5px;">'.concat(e.label, "</div>\n            ");
                    var g = document.createElement("input");
                    g.type = "text", g.id = "input:id:".concat(e.id), g.style = "padding-left: 4px; box-shadow: none; outline: none; border: none; width: ".concat(40 + (e.size || 0), "px; height: 30px; font-size: 16; border-radius: 4px; color: white; background-color: rgba(255, 255, 255, .25); position: absolute; right: 10px;"), g.value = this.toggles[e.id] = e.value, m.appendChild(g), g.onchange = function() {
                        if ("number" == e.type) {
                            var i = parseInt(g.value, 10);
                            if (isNaN(i) || i < e.min ? g.value = e.min : i > e.max && (g.value = e.max), "songVolume" == e.id)
                                for (var t = 0; t < singerManager.songAudios.length; t++) singerManager.songAudios[t].volume = parseInt(g.value) / 100;
                            l.toggles[e.id] = parseInt(g.value)
                        } else l.toggles[e.id] = g.value
                    }, i.appendChild(m)
                } else if ("group toggle" == e.type) {
                    var v = document.createElement("div");
                    if (v.style = "position: relative; transition: .3s ease-in; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px; overflow: hidden;", t > 0 && (v.style.marginTop = "5px"), e.margin && (v.style.marginBottom = "10px"), v.innerHTML = '\n            <div style="display: flex; align-items: center; top: 0px; left: 5px; height: 40px; position: absolute;">'.concat(e.label, "</div>\n            "), e.info) {
                        v.innerHTML = "";
                        var b = document.createElement("div");
                        b.style = "display: flex; align-items: center; top: 0px; left: 5px; height: 40px; position: absolute;", b.innerHTML = e.label, v.appendChild(b);
                        var w = document.createElement("div");
                        w.style = "\n                    margin-left: 3px; \n                    font-size: 10px; \n                    display: flex; \n                    align-items: center; \n                    justify-content: center; \n                    width: 13px; \n                    height: 13px; \n                    border-radius: 50%; \n                    background-color: rgba(255, 255, 255, .6); \n                    cursor: pointer; \n                    position: relative;\n                ", w.innerHTML = "i", w.onmouseout = function() {
                            this.style.backgroundColor = "rgba(255, 255, 255, .6)";
                            var e = this.querySelector(".tooltip");
                            e && (e.style.display = "none")
                        }, w.onmouseover = function() {
                            this.style.backgroundColor = "rgba(255, 255, 255, .4)";
                            var e = this.querySelector(".tooltip");
                            e && (e.style.display = "block")
                        };
                        var k = document.createElement("div");
                        k.className = "tooltip", k.style = "\n                    display: none; \n                    position: absolute; \n                    top: 20px; \n                    left: 50%; \n                    transform: translateX(-10px); \n                    background-color: #333; \n                    color: #fff; \n                    padding: 5px; \n                    border-radius: 4px; \n                    font-size: 10px; \n                    white-space: nowrap; \n                    z-index: 999999;\n                ", k.innerHTML = e.info, w.appendChild(k), b.appendChild(w)
                    }
                    var S = document.createElement("div");
                    S.id = "toggle:id:".concat(e.id), S.style = "position: absolute; cursor: pointer; display: flex; align-items: center; top: 5px; right: 10px; width: 55px; height: 30px; background-color: #ccc; border-radius: 16px; transition: 0.2s ease-out;";
                    var P = document.createElement("div");
                    P.style = "background-color: white; width: 22px; height: 22px; border-radius: 100%; position: absolute; transform: translateX(5px); transition: 0.2s ease-out;", S.appendChild(P), S.onclick = function() {
                        var i = e.options.length;
                        (l.toggles[e.id] = !l.toggles[e.id]) ? (S.style.backgroundColor = "#2196f3", P.style.transform = "translateX(28px)", v.style.height = "".concat(45 * i + 55, "px"), setTimeout((function() {
                            v.style.overflow = "visible"
                        }), 300)) : (S.style.backgroundColor = "#ccc", P.style.transform = "translateX(5px)", v.style.height = "40px", v.style.overflow = "hidden")
                    };
                    for (var I = 0; I < e.options.length; I++) {
                        var T = e.options[I];
                        this.Builder(T, v, I, !0)
                    }
                    v.appendChild(S), e.checked ? S.click() : this.toggles[e.id] = !1, i.appendChild(v)
                } else if ("select" == e.type) {
                    var D = document.createElement("div");
                    D.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;", t > 0 && (D.style.marginTop = "5px"), e.margin && (D.style.marginBottom = "10px"), n && (D.style.position = "absolute", D.style.top = "".concat(45 * t + 45, "px")), D.innerHTML = '\n            <div style="margin-left: 5px;">'.concat(e.label, "</div>\n            ");
                    var O = document.createElement("select");
                    O.id = "select:id:".concat(e.id), O.style = "padding-left: 4px; cursor: pointer; box-shadow: none; outline: none; border: none; height: 30px; font-size: 16; border-radius: 4px; color: white; background-color: rgba(255, 255, 255, .25); position: absolute; right: 10px;", D.appendChild(O);
                    for (var E = 0; E < e.options.length; E++) {
                        var M = e.options[E];
                        O.innerHTML += '<option value="'.concat(M.value, '" ').concat(M.selected ? "selected" : "", ">").concat(M.label, "</option>"), M.selected && (this.toggles[e.id] = M.value)
                    }
                    O.onchange = function() {
                        l.toggles[e.id] = O.value
                    }, i.appendChild(D)
                } else if ("list" == e.type) {
                    var j = document.createElement("div");
                    j.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 200px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;", e.margin && (j.style.marginBottom = "10px");
                    var C = document.createElement("div");
                    C.style = "position: absolute; top: 3px; width: 100%; text-align: center;", C.innerText = e.label, j.appendChild(C);
                    var A = document.createElement("div");
                    A.style = "position: absolute; bottom: 10px; left: 10px; width: calc(100% - 20px); height: 160px; background-color: rgba(255, 255, 255, 0.25); border-radius: 6px; overflow: hidden; overflow-y: scroll;", j.appendChild(A), A.onclick = function() {
                        B.focus()
                    }, this.toggles[e.id] = this.generateDefaultNames();
                    var B = document.createElement("input");
                    B.maxLength = "15", B.type = "text", B.placeholder = "Enter here", B.style = "color: white; background: none; height: 26px; border-radius: 6px; outline: none; box-shadow: none; border: none;", A.appendChild(B), document.addEventListener("keydown", (function(i) {
                        document.activeElement === B && "," == i.key && (B.value && !l.toggles[e.id].find((function(e) {
                            return e == B.value
                        })) && (l.createTag(A, B, e.id), l.toggles[e.id].push(B.value)), B.blur(), B.value = "")
                    }));
                    for (var L = 0; L < this.toggles[e.id].length; L++) B.value = this.toggles[e.id][L], this.createTag(A, B, e.id);
                    B.value = "";
                    var R = document.createElement("div");
                    R.style = "font-size: 8px; position: absolute; top: 20px; left: 13px;", R.innerText = "Enter a comma after each name", j.appendChild(R), i.appendChild(j)
                } else if ("keybind" == e.type) {
                    var H = document.createElement("div");
                    H.style = "position: relative; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px;", t > 0 && (H.style.marginTop = "5px"), e.margin && (H.style.marginBottom = "10px"), H.innerHTML = '\n            <div style="margin-left: 5px;">'.concat(e.label, "</div>\n            ");
                    var N = document.createElement("button");
                    N.style = "color: white; top: 5px; cursor: pointer; outline: none; width: 50px; position: absolute; right: 10px; height: 30px; border: none; border-radius: 6px; background-color: rgba(255, 255, 255, .4);", N.innerText = e.key, this.keyBinds[e.id] = e.key, this.keyBindsAction[e.id] = e.logic;
                    var W = !1;
                    N.onclick = function() {
                        if (!W) {
                            N.innerText = "-";
                            var i = function(t) {
                                "Escape" == t.key ? (l.keyBinds[e.id] = "N/A", N.innerText = "N/A", document.removeEventListener("keydown", i)) : "Shift" != t.key && "Alt" != t.key && "Meta" != t.key && "-" != t.key && (l.keyBinds[e.id] = t.key, N.innerText = t.key, document.removeEventListener("keydown", i)), t.preventDefault()
                            };
                            W = !0, document.addEventListener("keydown", i)
                        }
                    }, H.appendChild(N), i.appendChild(H)
                } else if ("preset toggles" == e.type) {
                    var G = document.createElement("div");
                    G.style = "position: relative; transition: .3s ease-in; color: white; display: flex; align-items: center; margin-left: 10px; width: calc(100% - 20px); height: 40px; background-color: rgba(0, 0, 0, .25); border-radius: 6px; overflow: hidden;", t > 0 && (G.style.marginTop = "5px"), e.margin && (G.style.marginBottom = "10px"), G.innerHTML = '\n            <div style="display: flex; align-items: center; top: 0px; left: 5px; height: 40px; position: absolute;">'.concat(e.label, "</div>\n            ");
                    var _ = document.createElement("div");
                    _.id = "toggle:id:".concat(e.id), _.style = "position: absolute; cursor: pointer; display: flex; align-items: center; top: 5px; right: 10px; width: 55px; height: 30px; background-color: #ccc; border-radius: 16px; transition: 0.2s ease-out;";
                    var F = document.createElement("div");
                    F.style = "background-color: white; width: 22px; height: 22px; border-radius: 100%; position: absolute; transform: translateX(5px); transition: 0.2s ease-out;", _.appendChild(F), _.onclick = function() {
                        var i = e.options.length;
                        if (l.toggles[e.id] = !l.toggles[e.id]) _.style.backgroundColor = "#2196f3", F.style.transform = "translateX(28px)", G.style.height = "".concat(45 * i + 55, "px");
                        else {
                            var t = l.toggles[e.id + ":preferedPreset"];
                            t && document.getElementById(t).click(), _.style.backgroundColor = "#ccc", F.style.transform = "translateX(5px)", G.style.height = "40px"
                        }
                    };
                    for (var z = [], U = 0; U < e.options.length; U++) {
                        var V = e.options[U],
                            q = this.Builder(V, G, U, !0, e.id);
                        z.push(q), q.addEventListener("click", (function(i) {
                            for (var t = 0; t < z.length; t++) {
                                var n = z[t];
                                if (l.toggles[e.id + ":preferedPreset"] != n.id) {
                                    var r = n.id.split(":")[2];
                                    l.toggles[r] && n.click()
                                }
                            }
                        }))
                    }
                    G.appendChild(_), e.checked && _.click(), i.appendChild(G)
                }
            }
        }, {
            key: "insertToggles",
            value: function(e, i) {
                for (var t = 0; t < e.length; t++) {
                    var n = e[t];
                    this.Builder(n, i, t)
                }
            }
        }, {
            key: "initItems",
            value: function(e, i) {
                for (var t = this, n = 0; n < i.length; n++) {
                    var r = document.createElement("div");
                    if (r.id = "item:".concat(n), r.style = "position: absolute; top: ".concat(475 * n, "px; left: 0px; width: 100%; height: 100%; transition: all ease-in .3s;"), r.innerHTML = '<div style="margin-top: 7px; margin-left: 10px; font-size: 24px; color: white;">'.concat(i[n].label, "</div>"), 6 == n && (r.innerHTML += '\n                <div id="chatLog" style="position: absolute; top: 45px; left: 10px; width: calc(100% - 20px); height: calc(100% - 90px); border-radius: 6px; background-color: rgba(255, 255, 255, .1); overflow: hidden; overflow-y: scroll;"></div>\n                <input id="privChatBox" placeholder="To chat: click here or press \'Enter\' key" style="color: white; box-shadow: none; outline: none; left: 10px; bottom: 10px; height: 30px; position: absolute; border-radius: 5px; width: calc(100% - 20px); background: rgb(255, 255, 255, .15); border: none;">\n                '), 6 != n) {
                        var l = document.createElement("div");
                        l.style = "position: relative; width: 100%; height: calc(100% - 37px); overflow: hidden; overflow-y: scroll;", r.appendChild(l);
                        var d = e[n];
                        d && this.insertToggles(d, l)
                    }
                    this.items.push(r), this.itemHolder.appendChild(r)
                }
                this.chatLog = document.getElementById("chatLog"), this.privChatBox = document.getElementById("privChatBox"), this.addLog("init"), this.privateLogger = document.createElement("div"), this.privateLogger.style = "pointer-events: all; position: absolute; width: 275px; max-height: 200px; bottom: 20px; left: 160px; overflow-y: scroll;", gameUI.appendChild(this.privateLogger), this.privateLogger.onmouseover = function() {
                    t.privateLogger.isHovered = !0
                }, this.privateLogger.onmouseout = function() {
                    t.privateLogger.isHovered = !1
                }
            }
        }, {
            key: "autoScroll",
            value: function(e, i) {
                (0 == this.menu.style.opacity || "tab:5" != this.oldTab.id || e == er.sid && i == er.name) && (this.chatLog.scrollTop = this.chatLog.scrollHeight), this.privateLogger && !this.privateLogger.isHovered && (this.privateLogger.scrollTop = this.privateLogger.scrollHeight)
            }
        }, {
            key: "addLog",
            value: function(e, i, t, n, r, l) {
                if (i) {
                    if (i.length > 100) return;
                    i = i.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    for (var d = 0, o = 0; o < i.length; o++)
                        if ("@" == i[o] && ++d > 4) return;
                    if (i && i.includes("WHY DIE XDDD '")) return "Ignored bot msg"
                }
                this.chatLog.scrollHeight >= 3500 && this.loggerFunction("autoclear"), "init" == e ? this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px; margin-top: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>\n            <span style="color: #0f0">Successfully imported chicken mod</span>\n            </div>\n            ') : "chat" == e ? this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>\n            <span style="color: #fff">').concat(t, " {").concat(n, "}").concat(r ? '<span style="color: #f00"> (translated)</span>' : "", ':</span>\n            <span style="color: ').concat(l || "#fff", '">').concat(i, "</span>\n            </div>\n            ") : "private" == e ? (this.privateLogger.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>   \n            <span style="color: #fff">').concat(t, " {").concat(n, '}:</span>\n            <span style="color: ').concat(l || "#fff", '">').concat(i, "</span>\n            </div>\n            "), this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>   \n            <span style="color: #fff">').concat(t, " {").concat(n, '}</span>\n            <span style="color: #f00">(private message):</span>\n            <span style="color: ').concat(l || "#fff", '">').concat(i, "</span>\n            </div>\n            ")) : "encountered" == e ? this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>   \n            <span style="color: #ffff00">encountered: ').concat(t, " {").concat(n, "}</span>\n            </div>\n            ") : "death" == e ? this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>   \n            <span style="color: #f00">').concat(t, " {").concat(n, "} has died ").concat(n == Lr.playerSID ? i : "", "</span>\n            </div>\n            ") : "left" == e && (this.chatLog.innerHTML += '\n            <div style="font-size: 13px; margin-left: 5px;">\n            <span style="color: #fff">'.concat(this.getCurrentTime(), ' - </span>   \n            <span style="color: #f00">').concat(t, " {").concat(n, "} has left the game</span>\n            </div>\n            ")), this.autoScroll(n, t)
            }
        }, {
            key: "toggleMenu",
            value: function() {
                1 == (this.menu.style.opacity || 1) ? (this.menu.style.opacity = 0, this.menu.style.pointerEvents = "none") : (this.menu.style.opacity = 1, this.menu.style.pointerEvents = "auto")
            }
        }, {
            key: "doKeyBindActions",
            value: function(e) {
                for (var i in this.keyBindsAction) {
                    var t = this.keyBindsAction[i];
                    for (var n in this.keyBinds)
                        if (n == i) {
                            this.keyBinds[n] == e.key && t();
                            break
                        }
                }
            }
        }])
    }();
    H(W, "items", []), H(W, "toggles", {}), H(W, "keyBinds", {}), H(W, "keyBindsAction", {});
    const G = {
        hats: [{
            id: 45,
            name: "Shame!",
            price: 0,
            scale: 120,
            desc: "hacks are for losers"
        }, {
            id: 51,
            name: "Moo Cap",
            price: 0,
            scale: 120,
            desc: "coolest mooer around"
        }, {
            id: 50,
            name: "Apple Cap",
            price: 0,
            scale: 120,
            desc: "apple farms remembers"
        }, {
            id: 28,
            name: "Moo Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 29,
            name: "Pig Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 30,
            name: "Fluff Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 36,
            name: "Pandou Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 37,
            name: "Bear Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 38,
            name: "Monkey Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 44,
            name: "Polar Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 35,
            name: "Fez Hat",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 42,
            name: "Enigma Hat",
            price: 0,
            scale: 120,
            desc: "join the enigma army"
        }, {
            id: 43,
            name: "Blitz Hat",
            price: 0,
            scale: 120,
            desc: "hey everybody i'm blitz"
        }, {
            id: 49,
            name: "Bob XIII Hat",
            price: 0,
            scale: 120,
            desc: "like and subscribe"
        }, {
            id: 57,
            name: "Pumpkin",
            price: 50,
            scale: 120,
            desc: "Spooooky"
        }, {
            id: 8,
            name: "Bummle Hat",
            price: 100,
            scale: 120,
            desc: "no effect"
        }, {
            id: 2,
            name: "Straw Hat",
            price: 500,
            scale: 120,
            desc: "no effect"
        }, {
            id: 15,
            name: "Winter Cap",
            price: 600,
            scale: 120,
            desc: "allows you to move at normal speed in snow",
            coldM: 1
        }, {
            id: 5,
            name: "Cowboy Hat",
            price: 1e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 4,
            name: "Ranger Hat",
            price: 2e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 18,
            name: "Explorer Hat",
            price: 2e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 31,
            name: "Flipper Hat",
            price: 2500,
            scale: 120,
            desc: "have more control while in water",
            watrImm: !0
        }, {
            id: 1,
            name: "Marksman Cap",
            price: 3e3,
            scale: 120,
            desc: "increases arrow speed and range",
            aMlt: 1.3
        }, {
            id: 10,
            name: "Bush Gear",
            price: 3e3,
            scale: 160,
            desc: "allows you to disguise yourself as a bush"
        }, {
            id: 48,
            name: "Halo",
            price: 3e3,
            scale: 120,
            desc: "no effect"
        }, {
            id: 6,
            name: "Soldier Helmet",
            price: 4e3,
            scale: 120,
            desc: "reduces damage taken but slows movement",
            spdMult: .94,
            dmgMult: .75
        }, {
            id: 23,
            name: "Anti Venom Gear",
            price: 4e3,
            scale: 120,
            desc: "makes you immune to poison",
            poisonRes: 1
        }, {
            id: 13,
            name: "Medic Gear",
            price: 5e3,
            scale: 110,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 9,
            name: "Miners Helmet",
            price: 5e3,
            scale: 120,
            desc: "earn 1 extra gold per resource",
            extraGold: 1
        }, {
            id: 32,
            name: "Musketeer Hat",
            price: 5e3,
            scale: 120,
            desc: "reduces cost of projectiles",
            projCost: .5
        }, {
            id: 7,
            name: "Bull Helmet",
            price: 6e3,
            scale: 120,
            desc: "increases damage done but drains health",
            healthRegen: -5,
            dmgMultO: 1.5,
            spdMult: .96
        }, {
            id: 22,
            name: "Emp Helmet",
            price: 6e3,
            scale: 120,
            desc: "turrets won't attack but you move slower",
            antiTurret: 1,
            spdMult: .7
        }, {
            id: 12,
            name: "Booster Hat",
            price: 6e3,
            scale: 120,
            desc: "increases your movement speed",
            spdMult: 1.16
        }, {
            id: 26,
            name: "Barbarian Armor",
            price: 8e3,
            scale: 120,
            desc: "knocks back enemies that attack you",
            dmgK: .6
        }, {
            id: 21,
            name: "Plague Mask",
            price: 1e4,
            scale: 120,
            desc: "melee attacks deal poison damage",
            poisonDmg: 5,
            poisonTime: 6
        }, {
            id: 46,
            name: "Bull Mask",
            price: 1e4,
            scale: 120,
            desc: "bulls won't target you unless you attack them",
            bullRepel: 1
        }, {
            id: 14,
            name: "Windmill Hat",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "generates points while worn",
            pps: 1.5
        }, {
            id: 11,
            name: "Spike Gear",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "deal damage to players that damage you",
            dmg: .45
        }, {
            id: 53,
            name: "Turret Gear",
            topSprite: !0,
            price: 1e4,
            scale: 120,
            desc: "you become a walking turret",
            turret: {
                proj: 1,
                range: 700,
                rate: 2500
            },
            spdMult: .7
        }, {
            id: 20,
            name: "Samurai Armor",
            price: 12e3,
            scale: 120,
            desc: "increased attack speed and fire rate",
            atkSpd: .78
        }, {
            id: 58,
            name: "Dark Knight",
            price: 12e3,
            scale: 120,
            desc: "restores health when you deal damage",
            healD: .4
        }, {
            id: 27,
            name: "Scavenger Gear",
            price: 15e3,
            scale: 120,
            desc: "earn double points for each kill",
            kScrM: 2
        }, {
            id: 40,
            name: "Tank Gear",
            price: 15e3,
            scale: 120,
            desc: "increased damage to buildings but slower movement",
            spdMult: .3,
            bDmg: 3.3
        }, {
            id: 52,
            name: "Thief Gear",
            price: 15e3,
            scale: 120,
            desc: "steal half of a players gold when you kill them",
            goldSteal: .5
        }, {
            id: 55,
            name: "Bloodthirster",
            price: 2e4,
            scale: 120,
            desc: "Restore Health when dealing damage. And increased damage",
            healD: .25,
            dmgMultO: 1.2
        }, {
            id: 56,
            name: "Assassin Gear",
            price: 2e4,
            scale: 120,
            desc: "Go invisible when not moving. Can't eat. Increased speed",
            noEat: !0,
            spdMult: 1.1,
            invisTimer: 1e3
        }],
        accessories: [{
            id: 12,
            name: "Snowball",
            price: 1e3,
            scale: 105,
            xOff: 18,
            desc: "no effect"
        }, {
            id: 9,
            name: "Tree Cape",
            price: 1e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 10,
            name: "Stone Cape",
            price: 1e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 3,
            name: "Cookie Cape",
            price: 1500,
            scale: 90,
            desc: "no effect"
        }, {
            id: 8,
            name: "Cow Cape",
            price: 2e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 11,
            name: "Monkey Tail",
            price: 2e3,
            scale: 97,
            xOff: 25,
            desc: "Super speed but reduced damage",
            spdMult: 1.35,
            dmgMultO: .2
        }, {
            id: 17,
            name: "Apple Basket",
            price: 3e3,
            scale: 80,
            xOff: 12,
            desc: "slowly regenerates health over time",
            healthRegen: 1
        }, {
            id: 6,
            name: "Winter Cape",
            price: 3e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 4,
            name: "Skull Cape",
            price: 4e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 5,
            name: "Dash Cape",
            price: 5e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 2,
            name: "Dragon Cape",
            price: 6e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 1,
            name: "Super Cape",
            price: 8e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 7,
            name: "Troll Cape",
            price: 8e3,
            scale: 90,
            desc: "no effect"
        }, {
            id: 14,
            name: "Thorns",
            price: 1e4,
            scale: 115,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 15,
            name: "Blockades",
            price: 1e4,
            scale: 95,
            xOff: 15,
            desc: "no effect"
        }, {
            id: 20,
            name: "Devils Tail",
            price: 1e4,
            scale: 95,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 16,
            name: "Sawblade",
            price: 12e3,
            scale: 90,
            spin: !0,
            xOff: 0,
            desc: "deal damage to players that damage you",
            dmg: .15
        }, {
            id: 13,
            name: "Angel Wings",
            price: 15e3,
            scale: 138,
            xOff: 22,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 19,
            name: "Shadow Wings",
            price: 15e3,
            scale: 138,
            xOff: 22,
            desc: "increased movement speed",
            spdMult: 1.1
        }, {
            id: 18,
            name: "Blood Wings",
            price: 2e4,
            scale: 178,
            xOff: 26,
            desc: "restores health when you deal damage",
            healD: .2
        }, {
            id: 21,
            name: "Corrupt X Wings",
            price: 2e4,
            scale: 178,
            xOff: 26,
            desc: "deal damage to players that damage you",
            dmg: .25
        }]
    };

    function _(e) {
        return _ = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, _(e)
    }

    function F(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, z(n.key), n)
        }
    }

    function z(e) {
        var i = function(e) {
            if ("object" != _(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != _(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == _(i) ? i : i + ""
    }
    var U = function() {
        return function(e, i) {
            return i && F(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e(i, t, n) {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e), this.isPlayer = !0, n || (Fr.playerSidMap.set(t, this), Fr.playerIdMap.set(i, this)), this.id = i, this.sid = t, this.team = null, this.skinIndex = 0, this.tailIndex = 0, this.itemCounts = {}, this.tmpRatio = 0, this.animIndex = 0, this.lastChat = 0, this.lastTrapData = !1, this.visible = !1, this.vel = {
                x: 0,
                y: 0
            }, this.last = {
                x: 0,
                y: 0
            }, this.lastX = 0, this.lastY = 0, this.skins = {
                0: 1
            }, this.tails = {
                0: 1
            };
            for (var r = 0; r < G.hats.length; r++) {
                var l = G.hats[r];
                l.price <= 0 && (this.skins[l.id] = 1)
            }
            for (var d = 0; d < G.accessories.length; d++) {
                var o = G.accessories[d];
                o.price <= 0 && (this.tails[o.id] = 1)
            }
            this.trapData = void 0
        }), [{
            key: "spawn",
            value: function() {
                this.isAlive = !0, this.chatMessages = [], this.active = !0, this.minimapCounter = 0, this.chatCountdown = 0, this.shameCount = 0, this.shameTimer = 0, this.gathering = 0, this.autoGather = 0, this.animTime = 0, this.animSpeed = 0, this.buildIndex = -1, this.weaponIndex = 0, this.maxXP = 300, this.XP = 0, this.age = 1, this.kills = 0, this.upgrAge = 2, this.upgradePoints = 0, this.x = 0, this.y = 0, this.zIndex = 0, this.xVel = 0, this.yVel = 0, this.slowMult = 1, this.dir = 0, this.dirPlus = 0, this.targetDir = 0, this.targetAngle = 0, this.maxHealth = 100, this.health = this.maxHealth, this.scale = t.playerScale, this.speed = t.playerSpeed, this.killed = null, this.resetResources(), this.items = [0, 3, 6, 10], this.weapons = [0], this.shootCount = 0, this.weaponXP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], this.reloads = {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    6: 0,
                    7: 0,
                    8: 0,
                    9: 0,
                    10: 0,
                    11: 0,
                    12: 0,
                    13: 0,
                    14: 0,
                    15: 0,
                    53: 0
                }, this.primaryWeapon = 0, this.secondaryWeapon = 15, this.primaryVariant = 0, this.secondaryVariant = 0, this.primaryHit = 0, this.secondaryHit = 0, this.bullTick = 0, this.spikeData = {
                    id: 9,
                    sid: 0
                }
            }
        }, {
            key: "resetReloads",
            value: function() {
                this.reloads = {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    6: 0,
                    7: 0,
                    8: 0,
                    9: 0,
                    10: 0,
                    11: 0,
                    12: 0,
                    13: 0,
                    14: 0,
                    15: 0,
                    53: 0
                }
            }
        }, {
            key: "resetResources",
            value: function() {
                for (var e = 0; e < t.resourceTypes.length; e++) this[t.resourceTypes[e]] = 100
            }
        }, {
            key: "startAnim",
            value: function(e, i) {
                this.animTime = this.animSpeed = f.weapons[i].speed, this.targetAngle = e ? -t.hitAngle : -Math.PI, this.tmpRatio = 0, this.animIndex = 0
            }
        }, {
            key: "animate",
            value: function(e) {
                this.animTime > 0 && (this.animTime -= e, this.animTime <= 0 ? (this.animTime = 0, this.dirPlus = 0, this.tmpRatio = 0, this.animIndex = 0) : 0 == this.animIndex ? (this.tmpRatio += e / (this.animSpeed * t.hitReturnRatio), this.dirPlus = Fr.lerp(0, this.targetAngle, Math.min(1, this.tmpRatio)), this.tmpRatio >= 1 && (this.tmpRatio = 1, this.animIndex = 1)) : (this.tmpRatio -= e / (this.animSpeed * (1 - t.hitReturnRatio)), this.dirPlus = Fr.lerp(0, this.targetAngle, Math.max(0, this.tmpRatio))))
            }
        }, {
            key: "setData",
            value: function(e) {
                this.id = e[0], this.sid = e[1], this.name = e[2], this.x = e[3], this.y = e[4], this.dir = e[5], this.health = e[6], this.maxHealth = e[7], this.scale = e[8], this.skinColor = e[9]
            }
        }, {
            key: "manageReloads",
            value: function(e) {
                for (var i = [this.weaponIndex, 53], t = 0; t < i.length; t++) {
                    var n = i[t];
                    this.reloads[n] > 0 && (this.reloads[n] -= e, this.reloads[n] <= 0 && (this.reloads[n] = 0))
                }
            }
        }])
    }();

    function V(e) {
        return V = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, V(e)
    }

    function q(e, i, t) {
        return (i = K(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function X(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, K(n.key), n)
        }
    }

    function Y(e, i, t) {
        return i && X(e.prototype, i), t && X(e, t), Object.defineProperty(e, "prototype", {
            writable: !1
        }), e
    }

    function K(e) {
        var i = function(e) {
            if ("object" != V(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != V(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == V(i) ? i : i + ""
    }

    function Z(e, i) {
        if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
    }
    var Q = Y((function e(i, t, n) {
            Z(this, e), this.x = i, this.y = t, this.walked = !1, this.wall = !n, this.fScore = 1 / 0, this.gScore = 1 / 0, this.hScore = 1 / 0
        })),
        J = function() {
            return Y((function e() {
                Z(this, e)
            }), null, [{
                key: "getWorkerCode",
                value: function() {
                    return '\n        var openSet = [];\n        var pathMap = new Map();\n        var grid = [];\n\n        const Sqrt2 = Math.sqrt(3200); // a^2 + b^2 = c^2\n        var startNode;\n        var endNode;\n\n        function distance(a, b) {\n            return Math.hypot(a.x - b.x, a.y - b.y);\n        }\n\n        function getNeighbors(bestNode) {\n            let neighbors = grid.filter(e => !e.wall && !e.walked && distance(e, bestNode) <= Sqrt2);\n    \n            return neighbors;\n        }\n\n        function tracePath(node) {\n            let path = [];\n            let current = node;\n                \n            while (current) {\n                if (!path.includes(current)) {\n                    path.push(current);\n                } else {\n                    console.log("Wtf same cell (pf)");\n                }\n\n                current = current.previous;\n            }\n            \n            path.reverse();\n            postMessage(path);\n        }\n\n        function find() {\n            let calTime = 0;\n\n            startNode.gScore = 0;\n            startNode.hScore = distance(endNode, startNode);\n            startNode.fScore = startNode.gScore + startNode.hScore;\n    \n            openSet.push(startNode);\n\n            while (openSet.length > 0) {\n                let bestNode = openSet.sort((a, b) => a.fScore - b.fScore)[0];\n\n                bestNode.walked = true;\n\n                let neighbors = getNeighbors(bestNode);\n\n                for (let i = 0; i < neighbors.length; i++) {\n                    let neighbor = neighbors[i];\n\n                    neighbor.gScore = distance(bestNode, neighbor) + bestNode.gScore;\n                    neighbor.hScore = distance(endNode, neighbor);\n                    neighbor.fScore = neighbor.gScore + neighbor.hScore;\n\n                    if (neighbor.gScore < (pathMap.get(neighbor) || Infinity)) {\n                        neighbor.previous = bestNode;\n                        pathMap.set(neighbor, neighbor.gScore);\n                        \n                        if (neighbor == endNode) {\n                            tracePath(neighbor);\n                            openSet = [];\n                            return;\n                        }\n\n                        if (!openSet.includes(neighbor)) {\n                            openSet.push(neighbor);\n                        }\n                    }\n                }\n\n                let indx = openSet.findIndex(e => e == bestNode);\n\n                openSet.splice(indx, 1);\n\n                calTime++;\n\n                if (calTime >= 300) break;\n            }\n\n            postMessage("No path pls");\n        }\n\n        self.onmessage = function(event) {\n            grid = event.data.grid;\n\n            let { start, end } = event.data;\n\n            startNode = grid.sort((a, b) => distance(a, start) - distance(b, start))[0];\n            endNode = grid.sort((a, b) => distance(a, end) - distance(b, end))[0];\n\n            if (startNode == endNode) {\n                postMessage("No path");\n            } else {\n                find();\n            }\n        };\n        '
                }
            }, {
                key: "withinPath",
                value: function(e, i) {
                    return !!(ne.data && ne.pathData && ne.pathData.find((function(t) {
                        return Fr.getDistance({
                            x: e,
                            y: i
                        }, t) <= 35
                    })))
                }
            }, {
                key: "search",
                value: function(e, i, t) {
                    for (var n = 20, r = [], l = Math.floor(Math.min(e.x2, i.x) / n * n) - 600, d = Math.floor(Math.min(e.y2, i.y) / n * n) - 600, o = Math.floor(Math.max(e.x2, i.x) / n * n) + 600, a = Math.floor(Math.max(e.y2, i.y) / n * n) + 600, s = o - l, y = a - d, u = Math.ceil(s / n) / 2, p = Math.ceil(y / n) / 2, c = rr.filter((function(e) {
                            return e.visible && e.sid != Lr.playerSID
                        })), f = 0; f < u; f++)
                        for (var h = function() {
                                var e = {
                                    x: l + 40 * f,
                                    y: d + 40 * x
                                };
                                if (e.x <= 35 || e.x >= 14365 || e.y <= 35 || e.y >= 14365) return 1;
                                Fr.getDistance(e, er) <= 20 || Fr.getDistance(e, i) <= 20 ? r.push(new Q(e.x, e.y, !0)) : Jt.closeObjects.find((function(i) {
                                    return i && (!i.ignoreCollision || i.teleport || i.trap && !Fr.isFriendly(i.owner.sid)) && Fr.getDistance(i, e) <= 25 + i.getScale()
                                })) || c.find((function(i) {
                                    return Fr.getDistance(i, e) <= 50
                                })) ? r.push(new Q(e.x, e.y)) : r.push(new Q(e.x, e.y, !0))
                            }, x = 0; x < p; x++) h();
                    if (t) return r;
                    var m = this.id++,
                        g = new Blob([this.getWorkerCode()], {
                            type: "application/javascript"
                        }),
                        v = new Worker(URL.createObjectURL(g));
                    return v.postMessage({
                        grid: r,
                        start: e,
                        end: i
                    }), v.onmessage = function(e) {
                        "object" == V(e.data) ? ne.pathId == m && (ne.pathData = e.data) : (console.log("No path found."), ne.pathId == m && (ne.pathMark = {
                            x: er.x2,
                            y: er.y2
                        }, ne.pathId = -1)), v.terminate()
                    }, m
                }
            }])
        }();

    function $(e) {
        return $ = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, $(e)
    }

    function ee(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, te(n.key), n)
        }
    }

    function ie(e, i, t) {
        return (i = te(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function te(e) {
        var i = function(e) {
            if ("object" != $(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != $(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == $(i) ? i : i + ""
    }
    q(J, "id", 0), q(J, "workers", []);
    var ne = function() {
        return function(e, i, t) {
            return t && ee(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "main",
            value: function() {
                if (this.data = void 0, !W.toggles.autoPush || !Jt.enemies.nearest || _l[16]) return this.pathId = -1, void(this.pathData = null);
                var e = Jt.enemies.nearest;
                if (!e.trapData) return this.pathId = -1, void(this.pathData = null);
                var i = e.trapData;
                if (Fr.getDistance(e, er) > W.toggles.autoPushRange) return this.pathId = -1, void(this.pathData = null);
                var t = Jt.closeObjects.filter((function(e) {
                        return e && e.dmg
                    })),
                    n = t.filter((function(e) {
                        return e && e.dmg && Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, i) <= 75 + e.scale
                    })),
                    r = (n = n.sort((function(i, t) {
                        return Fr.getDistance(i, e) - Fr.getDistance(t, e)
                    })))[0];
                if (r) {
                    if (r.dmg && n.length > 1) {
                        var l = n.filter((function(e, i) {
                                return i > 0
                            })).sort((function(e, i) {
                                return Fr.getDistance(e, er) - Fr.getDistance(i, er)
                            }))[0],
                            d = Fr.findMiddlePoint(r, l);
                        Fr.getDistance(r, d) <= 20 + r.scale && Fr.getDistance(l, d) <= 20 + l.scale && (r = {
                            x: d.x,
                            y: d.y,
                            scale: (r.scale + l.scale) / 2 - 10,
                            dmg: (r.dmg + l.dmg) / 2
                        })
                    }
                    var o = Fr.getDirection(e, r),
                        a = Fr.getDistance(e, r) + 65,
                        s = {
                            x: r.x + Math.cos(o) * a,
                            y: r.y + Math.sin(o) * a
                        };
                    if (Fr.getDistance(s, er) <= 30 && (s = {
                            x: r.x + Math.cos(o) * ((r.trap ? 50 : a >= 100 ? 90 : 110) + r.scale),
                            y: r.y + Math.sin(o) * ((r.trap ? 50 : a >= 100 ? 90 : 110) + r.scale)
                        }), t.find((function(e) {
                            return !Fr.isFriendly(e.owner.sid) && Fr.getDistance(s, e) <= e.scale + 40
                        }))) return this.pathId = -1, void(this.pathData = null);
                    if (nn.checkCollision(e, r)) return this.pathIndx = -1, this.pathData = null, void(this.data = {
                        stop: !0,
                        dir: Fr.getDirection(s, er),
                        scale: r.scale,
                        dmg: r.dmg,
                        victim: e,
                        first: s,
                        last: r
                    });
                    if ((this.pathData && this.pathIndx >= this.pathData.length || Fr.getDistance(s, er) <= 100) && (this.pathIndx = -1, this.pathData = null), this.pathData && this.pathIndx < this.pathData.length) {
                        if (this.pathIndx < this.pathData.length) {
                            var y = 1 / 0;
                            this.pathIndx = 1 / 0;
                            for (var u = 0; u < this.pathData.length; u++) {
                                var p = this.pathData[u],
                                    c = Fr.getDistance(p, er);
                                c <= y && (this.pathIndx = u, y = c)
                            }
                            this.pathIndx++;
                            var f = this.pathData[this.pathIndx];
                            f || (this.pathIndx < 0 ? this.pathIndx = 0 : this.pathIndx > this.pathData.length && (this.pathIndx = this.pathData.length - 1), f = this.pathData[this.pathIndx]), this.data = {
                                dir: Fr.getDirection(f, er),
                                scale: r.scale,
                                dmg: r.dmg,
                                victim: e,
                                first: f,
                                last: r
                            }
                        }
                    } else if (Fr.getDistance(s, er) > 100) {
                        if (-1 == this.pathId && Fr.getDistance(this.pathMark, er) >= 70) {
                            this.pathMark = {
                                x: 1 / 0,
                                y: 1 / 0
                            };
                            var h = J.search(er, s);
                            this.pathId = h, this.pathIndx = -1
                        }
                    } else this.pathIndx = -1, this.pathData = null, this.data = {
                        dir: Fr.getDirection(s, er),
                        scale: r.scale,
                        dmg: r.dmg,
                        victim: e,
                        first: s,
                        last: r
                    }
                }
            }
        }])
    }();

    function re(e) {
        return re = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, re(e)
    }

    function le(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, de(n.key), n)
        }
    }

    function de(e) {
        var i = function(e) {
            if ("object" != re(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != re(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == re(i) ? i : i + ""
    }
    ie(ne, "pathId", void 0), ie(ne, "pathData", void 0), ie(ne, "data", void 0), ie(ne, "pathIndx", void 0), ie(ne, "pathMark", {
        x: 1 / 0,
        y: 1 / 0
    });
    var oe = function() {
        return function(e, i, t) {
            return t && le(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "getReload",
            value: function(e, i) {
                if (53 == i) return 1 - e.reloads[53] / 2500;
                var t = f.weapons[i];
                return t ? 1 - e.reloads[i] / t.speed : 1
            }
        }, {
            key: "hasHit",
            value: function(e, i) {
                if (53 == i) {
                    if (Jt.tick - e.turretHit <= 2) return !0
                } else if (i < 9) {
                    if (Jt.tick - e.primaryHit <= 2) return !0
                } else if (Jt.tick - e.secondaryHit <= 2) return !0;
                return !1
            }
        }, {
            key: "getDamage",
            value: function(e, i) {
                if (this.weaponDamages.has("".concat(e, ":").concat(i))) return this.weaponDamages.get("".concat(e, ":").concat(i));
                var n, r, l, d = ((null === (n = f.weapons[e]) || void 0 === n ? void 0 : n.dmg) || 0) * ((null === (r = t.weaponVariants[i]) || void 0 === r ? void 0 : r.val) || 0);
                return f.weapons[e].projectile && (d = (null === (l = f.weapons[e]) || void 0 === l ? void 0 : l.dmg) || 0), this.weaponDamages.set("".concat(e, ":").concat(i), d), d
            }
        }, {
            key: "getObjDamage",
            value: function(e, i, n) {
                var r, l = f.weapons[i];
                return (null == l.projectile ? l.dmg : 0) * ((null === (r = t.weaponVariants[n || e.weaponVariant]) || void 0 === r ? void 0 : r.val) || 1) * (l.sDmg || 1) * ("number" == typeof n || 40 == e.skinIndex ? 3.3 : 1)
            }
        }])
    }();

    function ae(e) {
        return ae = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ae(e)
    }

    function se(e, i) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var n = Object.getOwnPropertySymbols(e);
            i && (n = n.filter((function(i) {
                return Object.getOwnPropertyDescriptor(e, i).enumerable
            }))), t.push.apply(t, n)
        }
        return t
    }

    function ye(e) {
        for (var i = 1; i < arguments.length; i++) {
            var t = null != arguments[i] ? arguments[i] : {};
            i % 2 ? se(Object(t), !0).forEach((function(i) {
                ue(e, i, t[i])
            })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : se(Object(t)).forEach((function(i) {
                Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(t, i))
            }))
        }
        return e
    }

    function ue(e, i, t) {
        return (i = fe(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function pe(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, fe(n.key), n)
        }
    }

    function ce(e, i, t) {
        return i && pe(e.prototype, i), t && pe(e, t), Object.defineProperty(e, "prototype", {
            writable: !1
        }), e
    }

    function fe(e) {
        var i = function(e) {
            if ("object" != ae(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ae(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ae(i) ? i : i + ""
    }

    function he(e, i) {
        if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
    }! function(e, i, t) {
        (i = de(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(oe, "weaponDamages", new Map);
    var xe = ce((function e(i) {
            he(this, e), this.x = i.x, this.y = i.y, this.scale = i.scale, this.angle = i.angle, this.id = i.id, this.isPreplace = i.isPreplace
        })),
        me = function() {
            return ce((function e() {
                he(this, e)
            }), null, [{
                key: "checkMarkers",
                value: function(e, i, t) {
                    for (var n = 0; n < this.markers.length; n++) {
                        var r = this.markers[n];
                        if (r && Fr.getDistance(r, {
                                x: e,
                                y: i
                            }) <= r.scale + t) return !1
                    }
                    return !0
                }
            }, {
                key: "addMarker",
                value: function(e) {
                    var i = this;
                    this.markers.push(new xe(e)), Jt.nextTick((function() {
                        i.markers.shift()
                    }))
                }
            }, {
                key: "calculatePosition",
                value: function(e, i, t, n) {
                    var r = 0,
                        l = 0;
                    if (n)
                        if (this.distPositionMap.has("".concat(i, ":").concat(t))) {
                            var d = this.distPositionMap.get("".concat(i, ":").concat(t));
                            r = d[0], l = d[1]
                        } else r = Math.cos(t) * i, l = Math.sin(t) * i, this.distPositionMap.set("".concat(i, ":").concat(t), [r, l]);
                    else r = Math.cos(t) * i, l = Math.sin(t) * i;
                    return {
                        x: (e.x2 || e.x) + Math.cos(t) * i,
                        y: (e.y2 || e.y) + Math.sin(t) * i
                    }
                }
            }, {
                key: "addUsedAngle",
                value: function(e) {
                    this.usedAngles.push(ye(ye({}, e), {}, {
                        tick: Jt.tick
                    }))
                }
            }])
        }();

    function ge(e) {
        return ge = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ge(e)
    }

    function ve(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, be(n.key), n)
        }
    }

    function be(e) {
        var i = function(e) {
            if ("object" != ge(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ge(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ge(i) ? i : i + ""
    }
    ue(me, "markers", []), ue(me, "usedAngles", []), ue(me, "anglesArray", Array.from({
        length: 30
    }, (function(e, i) {
        return Math.PI / 15 * i
    }))), ue(me, "markers", []), ue(me, "distPositionMap", new Map);
    var we = function() {
        return function(e, i, t) {
            return t && ve(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "msg",
            value: function(e) {
                var i = document.createElement("div");
                i.classList.add("error-message"), i.innerHTML = '\n        <div style="display: flex; align-items: center; justify-content: center; position: absolute; color: #fff; text-align: center; font-size: 35px; top: 0px; left: 0px; width: 100%; height: 50px; background: linear-gradient(to right, transparent 0%, transparent 20%, rgb(255, 255, 255, .4) 50%, transparent 80%, transparent 100%);">\n        ATTENTION\n        </div>\n        <div style="color: white; font-size: 16px; position: absolute; width: 80%; left: 50%; top: 50%; transform: translate(-50%, -50%);">'.concat(e, "</div>\n        ");
                var t = document.createElement("div");
                t.style = "display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; border-radius: 4px; width: 200px; height: 50px; background-color: rgb(255, 255, 255, .75); cursor: pointer; position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);", t.innerHTML = "OK", t.onclick = function() {
                    i.remove()
                }, i.appendChild(t), document.body.appendChild(i)
            }
        }])
    }();

    function ke(e) {
        return ke = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ke(e)
    }

    function Se(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ie(n.key), n)
        }
    }

    function Pe(e, i, t) {
        return (i = Ie(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Ie(e) {
        var i = function(e) {
            if ("object" != ke(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ke(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ke(i) ? i : i + ""
    }
    var Te = function() {
        return function(e, i, t) {
            return t && Se(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "itemLoaded",
            value: function() {
                this.current++, this.update()
            }
        }, {
            key: "fakeLoader",
            value: function() {
                var e = this,
                    i = Date.now() - this.lastUpdateTime;
                this.lastUpdateTime = Date.now(), this.currentTime += i * (Br ? 4 : 1), this.currentTime >= this.MIN_LOAD_TIME && (this.currentTime = this.MIN_LOAD_TIME), this.update(), this.currentTime < this.MIN_LOAD_TIME && !this.ERROR && window.requestAnimationFrame((function() {
                    e.fakeLoader()
                }))
            }
        }, {
            key: "init",
            value: function() {
                var e = this;
                window.requestAnimationFrame((function() {
                    e.fakeLoader()
                }))
            }
        }, {
            key: "update",
            value: function() {
                var e = 100 * (this.currentTime / this.MIN_LOAD_TIME * .333 + this.current / this.max * .667);
                Rl.innerHTML = "".concat(Math.round(100 * e) / 100, "% Loaded"), Ll.style.width = "".concat(e, "%"), e >= 100 && !this.LOADED && (this.LOADED = !0, setTimeout((function() {
                    jl.style.display = "block", setTimeout((function() {
                        jl.style.opacity = 0, setTimeout((function() {
                            il.style.display = "none", Zr.style.display = "block", tl.style.display = "block", nl.innerText = "megaofwegas"
                        }), 50), setTimeout((function() {
                            jl.style.display = "none", jl.style.opacity = 1
                        }), 200)
                    }), 50)
                }), 750))
            }
        }])
    }();

    function De(e) {
        return De = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, De(e)
    }

    function Oe(e, i) {
        if (e) {
            if ("string" == typeof e) return Ee(e, i);
            var t = {}.toString.call(e).slice(8, -1);
            return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? Ee(e, i) : void 0
        }
    }

    function Ee(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function Me(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ce(n.key), n)
        }
    }

    function je(e, i, t) {
        return (i = Ce(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Ce(e) {
        var i = function(e) {
            if ("object" != De(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != De(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == De(i) ? i : i + ""
    }
    Pe(Te, "current", 0), Pe(Te, "max", 7), Pe(Te, "MIN_LOAD_TIME", 4e3), Pe(Te, "currentTime", 0), Pe(Te, "lastUpdateTime", Date.now()), Pe(Te, "LOADED", !1), Pe(Te, "ERROR", !1), Te.init();
    var Ae = function() {
        return function(e, i, t) {
            return t && Me(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "connect",
            value: function(e) {
                var i = this;
                (!this.socket || this.socket && this.socket.readyState == WebSocket.CLOSED) && (this.socket = new WebSocket(e), this.socket.binaryType = "arraybuffer", this.socket.onopen = function() {
                    return i.onOpen()
                }, this.socket.onmessage = function(e) {
                    return i.onMessage(e)
                }, this.socket.onerror = function(e) {
                    return i.onError(e)
                }, this.socket.onclose = function(e) {
                    var t = e.code;
                    return i.onClose(t)
                })
            }
        }, {
            key: "onError",
            value: function(e) {
                Te.ERROR = !0, this.connected ? we.msg(JSON.stringify(e)) : we.msg("WebSocket connection to '".concat(this.socket.url, "' failed"))
            }
        }, {
            key: "onOpen",
            value: function() {
                console.log("Connected to ".concat(Br ? "ws://localhost" : "moomoo.io", "!")), this.connected = !0, Te.itemLoaded(), Lr.updateSkinPicker(), Lr.drawServerBrowser(), ll.selectedIndex = 1 * Xl();
                for (var e = 19; e <= 38; e++) {
                    var i = document.createElement("div");
                    i.id = "itemCounts" + e, i.classList.add("itemCounts"), i.innerHTML = "0", document.getElementById("actionBarItem" + e).appendChild(i)
                }
                Te.itemLoaded();
                for (var t = 0; t <= 16; t++) {
                    var n = document.createElement("div");
                    n.id = "weaponXPActionBar:".concat(t), n.classList.add("weaponXPActionBar"), document.getElementById("actionBarItem" + t).style.position = "relative", document.getElementById("actionBarItem" + t).appendChild(n)
                }
                Te.itemLoaded(), Lr.lastPingSocket = Date.now(), or.pingSocket(), setInterval((function() {
                    Lr.lastPingSocket = Date.now(), or.pingSocket()
                }), 3e3)
            }
        }, {
            key: "onMessage",
            value: function(e) {
                var i = function(e, i) {
                        return function(e) {
                            if (Array.isArray(e)) return e
                        }(e) || function(e, i) {
                            var t = null == e ? null : "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
                            if (null != t) {
                                var n, r, l, d, o = [],
                                    a = !0,
                                    s = !1;
                                try {
                                    if (l = (t = t.call(e)).next, 0 === i) {
                                        if (Object(t) !== t) return;
                                        a = !1
                                    } else
                                        for (; !(a = (n = l.call(t)).done) && (o.push(n.value), o.length !== i); a = !0);
                                } catch (e) {
                                    s = !0, r = e
                                } finally {
                                    try {
                                        if (!a && null != t.return && (d = t.return(), Object(d) !== d)) return
                                    } finally {
                                        if (s) throw r
                                    }
                                }
                                return o
                            }
                        }(e, i) || Oe(e, i) || function() {
                            throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                        }()
                    }(Fr.decodeSocketMessages(e), 2),
                    t = i[0],
                    n = i[1],
                    r = or.serverToClient.get(t);
                r && r.apply(void 0, function(e) {
                    return function(e) {
                        if (Array.isArray(e)) return Ee(e)
                    }(e) || function(e) {
                        if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
                    }(e) || Oe(e) || function() {
                        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                    }()
                }(n))
            }
        }, {
            key: "onClose",
            value: function(e) {
                !Te.ERROR && this.connected && (4001 == e ? Lr.disconnect("Invalid Connection") : Lr.disconnect("Disconnected")), this.connected = !1
            }
        }, {
            key: "send",
            value: function(e) {
                if (this.socket && 1 == this.socket.readyState) {
                    for (var i = !1, t = arguments.length, n = new Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) n[r - 1] = arguments[r];
                    if (e == or.clientToServer.SEND_CHAT) n[0] = Fr.uncensorChat(n[0]);
                    else if (e == or.clientToServer.MOVE) this.dataSent.move != n[0] ? this.dataSent.move = n[0] : i = !0;
                    else if (e == or.clientToServer.SEND_HIT || e == or.clientToServer.SEND_AIM) {
                        var l = e == or.clientToServer.SEND_HIT;
                        this.dataSent.dir != n[1 * l] ? this.dataSent.dir = n[1 * l] : e == or.clientToServer.SEND_AIM && (i = !0)
                    }
                    if (i) return;
                    e != or.clientToServer.PING_SOCKET && e != or.clientToServer.SEND_CHAT && (or.packets++, or.minPackets++, setTimeout((function() {
                        or.packets--, setTimeout((function() {
                            or.minPackets--
                        }), 59e3)
                    }), 1e3));
                    var o = d.encode([e, n]);
                    this.socket.send(o)
                }
            }
        }])
    }();

    function Be(e) {
        return Be = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Be(e)
    }

    function Le(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, He(n.key), n)
        }
    }

    function Re(e, i, t) {
        return i && Le(e.prototype, i), t && Le(e, t), Object.defineProperty(e, "prototype", {
            writable: !1
        }), e
    }

    function He(e) {
        var i = function(e) {
            if ("object" != Be(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Be(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Be(i) ? i : i + ""
    }

    function Ne(e, i) {
        if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
    }
    je(Ae, "openTime", Date.now()), je(Ae, "socket", null), je(Ae, "connected", !1), je(Ae, "dataSent", {
        move: void 0,
        dir: 0
    });
    var We = Re((function e(i) {
            Ne(this, e), this.onPlayer = [], this.possible = [], this.overlap = new Set, this.placementDistance = i
        })),
        Ge = Re((function e(i, t, n, r) {
            Ne(this, e), this.x = i, this.y = t, this.scale = n, this.angle = r
        })),
        _e = function() {
            return Re((function e() {
                Ne(this, e)
            }), null, [{
                key: "fetch",
                value: function(e) {
                    return this.data.has(e) ? this.data.get(e) : new We(1 / 0)
                }
            }, {
                key: "main",
                value: function() {
                    for (var e = 0; e < Jt.enemies.all.length; e++) {
                        var i = Jt.enemies.all[e];
                        if (i && Fr.getDistance(i, er) <= 300) {
                            for (var t = f.list[i.spikeData.id], n = t.scale + 30, r = new We(n), l = 0; l < me.anglesArray.length; l++) {
                                var d = me.anglesArray[l],
                                    o = me.calculatePosition(i, n, d, !0),
                                    a = nn.checkItemPlacement(o.x, o.y, i.spikeData.id, t.scale, !0);
                                if (a.length)
                                    for (var s = 0; s < a.length; s++) r.overlap.add(a[s]);
                                else {
                                    var y = new Ge(o.x, o.y, t.scale, d);
                                    Fr.getDistance(o, er) <= 35 + t.scale && r.onPlayer.push(y), r.possible.push(y)
                                }
                            }
                            this.data.set(i.sid, r)
                        }
                    }
                }
            }])
        }();

    function Fe(e) {
        return Fe = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Fe(e)
    }

    function ze(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ue(n.key), n)
        }
    }

    function Ue(e) {
        var i = function(e) {
            if ("object" != Fe(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Fe(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Fe(i) ? i : i + ""
    }! function(e, i, t) {
        (i = He(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(_e, "data", new Map);
    var Ve = function() {
        return function(e, i, t) {
            return t && ze(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "isBlockMovement",
            value: function(e, i) {
                if (e.trapData && Fr.getDistance(i, e.trapData) <= i.item.scale + 75) return !1;
                if ("number" != typeof Ae.dataSent.move) return !1;
                var t = Fr.getDirection(i, er);
                return Fr.getAngleDist(t, Ae.dataSent.move) <= Math.PI / 3
            }
        }, {
            key: "grade",
            value: function(e, i, t) {
                for (var n = this, r = {}, l = f.list[er.items[2]].scale - 50, d = function() {
                        for (var t = Jt.enemies.all[o], d = _e.fetch(t.sid), a = function() {
                                var i = !0,
                                    n = e[s];
                                if (n.isUsed) return n.grade = -1, 1;
                                for (var l = 0; l < d.possible.length; l++) {
                                    var o = d.possible[l];
                                    if (r[n.angle + t.name + t.sid + o.angle] = Fr.getDistance(n, o), r[n.angle + t.name + t.sid + o.angle] <= n.item.scale + o.scale) {
                                        n.priority = !0, i = !1;
                                        break
                                    }
                                }
                                var a = Fr.getDistance(n, t);
                                a <= 235 && !t.trapData && n.grade++, a <= 50 && (n.reTrap = !0, n.grade++, a <= 20 && n.grade++);
                                var y = Jt.closeObjects.filter((function(e) {
                                    return e && e.dmg && Fr.isFriendly(e.owner.sid) && Fr.getDistance(n, e) <= 75 + e.scale
                                }));
                                y.length && (n.canPush = !0, n.grade += y.length), a <= d.placementDistance && (i ? n.grade++ : n.grade += .5)
                            }, s = e.length - 1; s >= 0; s--) a();
                        for (var y = i.length - 1; y >= 0; y--) {
                            var u = i[y],
                                p = !0;
                            if (!J.withinPath(u.x, u.y))
                                if (u.isUsed) u.grade = -1;
                                else {
                                    for (var c = 0; c < d.possible.length; c++) {
                                        var h = d.possible[c];
                                        if (r[u.angle + t.name + t.sid + h.angle] + l <= u.item.scale + h.scale) {
                                            u.priority = !0, p = !1;
                                            break
                                        }
                                    }
                                    var x = Fr.getDistance(u, t),
                                        m = t.trapData ? Fr.getDistance(u, t.trapData) : 1 / 0;
                                    if (x <= 35 + u.item.scale) {
                                        if (u.hitEnemy = t, !t.trapData) {
                                            var g = ti.spike(u, t);
                                            g.building && (u.into = g, g.building.trap ? u.grade += 2.5 : g.bounce ? u.grade += 5 : g.building.trap ? u.into = !1 : u.grade += 3), W.toggles.spiekTick && t.lastTrapData && 1 == oe.getReload(er, er.weapons[0]) && Fr.getDistance(t, er) - 63 <= f.weapons[er.weapons[0]].range && (u.spiketick = !0, u.points++)
                                        }
                                        t.trapData && (u.points += 2, u.spikeTrap = !0, u.canPush = !0)
                                    }
                                    if (u.into || !n.isBlockMovement(t, u)) {
                                        var v = !t.trapData || Jt.closeObjects.some((function(e) {
                                            return e && e.dmg && Fr.isFriendly(e.owner.sid) && Fr.getDistance(t.trapData, e) <= 75 + e.scale
                                        }));
                                        !v && t.trapData && m <= 75 + u.item.scale && (u.grade++, u.canPush = !0), t.trapData && x <= 250 && Fr.dAng(u.angle, Fr.getDirection(er, t)) >= 1.5 && (u.points += 2), p && x <= d.placementDistance && u.grade++
                                    } else u.grade = -1
                                }
                        }
                    }, o = 0; o < Jt.enemies.all.length; o++) d();
                return e = e.filter((function(e) {
                    return e.grade >= 0
                })).sort((function(e, i) {
                    return i.grade - e.grade
                })), i = i.filter((function(e) {
                    return e.grade >= 0
                })).sort((function(e, i) {
                    return i.grade - e.grade
                })), {
                    traps: e,
                    spikes: i,
                    bestTrap: e[0] || {
                        item: {}
                    },
                    bestSpike: i[0] || {
                        item: {}
                    }
                }
            }
        }])
    }();

    function qe(e) {
        return qe = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, qe(e)
    }

    function Xe(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ke(n.key), n)
        }
    }

    function Ye(e, i, t) {
        return i && Xe(e.prototype, i), t && Xe(e, t), Object.defineProperty(e, "prototype", {
            writable: !1
        }), e
    }

    function Ke(e) {
        var i = function(e) {
            if ("object" != qe(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != qe(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == qe(i) ? i : i + ""
    }

    function Ze(e, i) {
        if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
    }
    var Qe = Ye((function e(i, t, n, r, l, d) {
            var o = i.x,
                a = i.y;
            Ze(this, e), this.x = o, this.y = a, this.angle = t, this.type = n, this.grade = 0, this.id = r, this.item = f.list[r], "trap" == n && (this.trap = !0), this.into = !1, this.bouncy = !1, this.spikeTrap = !1, this.canPush = !1, this.reTrap = !1, this.isUsed = l, this.priority = !1, this.preplacer = d, this.preplace = !1, this.spiketick = !1, this.placed = !1, this.hitEnemy = null
        })),
        Je = function() {
            return Ye((function e() {
                Ze(this, e)
            }), null, [{
                key: "find",
                value: function(e) {
                    for (var i = [], t = [], n = er.items[2], r = f.list[n], l = r.scale + 30, d = function() {
                            var e = me.anglesArray[o],
                                d = me.usedAngles.some((function(i) {
                                    return Fr.dAng(i.angle, e) <= .35
                                })),
                                a = me.calculatePosition(er, 80, e, !0),
                                s = me.calculatePosition(er, l, e, !0),
                                y = nn.checkItemPlacement(a.x, a.y, 15, 50);
                            y && y.includes(!0) && i.push(new Qe(a, e, "trap", 15, d, y)), (y = nn.checkItemPlacement(s.x, s.y, n, r.scale)) && y.includes(!0) && t.push(new Qe(s, e, "spike", n, d, y))
                        }, o = 0; o < me.anglesArray.length; o++) d();
                    return Ve.grade(i, t, e)
                }
            }])
        }();

    function $e(e) {
        return $e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, $e(e)
    }

    function ei(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, ii(n.key), n)
        }
    }

    function ii(e) {
        var i = function(e) {
            if ("object" != $e(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != $e(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == $e(i) ? i : i + ""
    }
    var ti = function() {
        return function(e, i, t) {
            return t && ei(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "spike",
            value: function(e, i) {
                for (var t = {
                        closestDistance: 1 / 0,
                        building: null,
                        bounce: !1
                    }, n = Fr.getDirection(i, e), r = 0; r < Jt.closeObjects.length; r++) {
                    var l = Jt.closeObjects[r];
                    if (l && (l.trap || l.dmg) && Fr.isFriendly(l.owner.sid)) {
                        var d = Fr.getDistance(i, l),
                            o = me.calculatePosition(i, Math.min(170, d), n);
                        Fr.getDistance(o, l) <= (l.trap ? 50 : l.scale + 35) && d < t.closestDistance && (t.closestDistance = d, t.building = l, d <= 150 && d >= 50 && l.dmg && Fr.dAng(n, Fr.getDirection(l, e)) <= .17 ? t.bounce = !0 : t.bounce = !1)
                    }
                }
                return t
            }
        }, {
            key: "melee",
            value: function(e, i, n, r) {
                var l = Fr.getDirection(n, i),
                    d = r || (f.weapons[e].knock || 0) + .3;
                return {
                    x: (n.x2 || n.x) + Math.cos(l) * d * t.serverUpdateSpeed,
                    y: (n.y2 || n.y) + Math.sin(l) * d * t.serverUpdateSpeed
                }
            }
        }])
    }();

    function ni(e) {
        return ni = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ni(e)
    }

    function ri(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function li(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, oi(n.key), n)
        }
    }

    function di(e, i, t) {
        return (i = oi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function oi(e) {
        var i = function(e) {
            if ("object" != ni(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ni(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ni(i) ? i : i + ""
    }
    var ai = function() {
        function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }
        return function(e, i, t) {
            return t && li(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }(e, 0, [{
            key: "start",
            value: function(e) {
                var i = this;
                this.autoaim = e, "reverse" == e && (or.storeEquip(53), Jt.weaponIndex = er.weapons[1], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAim(Jt.enemies.angle), or.sendAutoGather(), this.addQueue((function() {
                    or.storeEquip(7), Jt.weaponIndex = er.weapons[0], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAim(Jt.enemies.angle)
                })), this.addQueue((function() {
                    or.sendAutoGather(), i.autoaim = !1
                })))
            }
        }, {
            key: "addQueue",
            value: function(e) {
                this.queue.push(e)
            }
        }, {
            key: "bullHit",
            value: function(e) {
                if (Jt.weaponIndex = er.weapons[0], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), 1 == oe.getReload(er, Jt.weaponIndex)) ne.data || 7 != Jt.weaponIndex ? or.storeEquip(7) : or.storeEquip(mi.check(19, !0), 1), Jt.attackOnce();
                else {
                    (7 == Jt.weaponIndex && 11 != er.tailIndex || 7 != Jt.weaponIndex) && (e && 1 == oe.getReload(er, 53) ? or.storeEquip(53) : mi.default(!0))
                }(ne.data || 7 != Jt.weaponIndex) && or.storeEquip(mi.check(19, !0), 1)
            }
        }, {
            key: "canAutoPushHit",
            value: function() {
                if (!Jt.enemies.nearest) return !1;
                if (!this.autoaim && !this.ATOS) {
                    var e = Jt.enemies.nearest,
                        i = f.weapons[er.weapons[0]];
                    if (Fr.getDistance(e, er) - 63 > i.range) return !1;
                    if (!ne.data) return !1;
                    if (!ne.data.dmg) return !1;
                    if (1.5 * i.dmg >= 60) {
                        if (11 == er.tailIndex) return !1;
                        if (oe.getReload(er, er.weapons[0]) < 1) return !1;
                        if (Fr.getDistance(ne.data.victim.vel, ne.data.last) <= 35 + ne.data.scale) return this.autoHitActive = !0, !0
                    } else if (Fr.getDistance(ne.data.victim, er) <= 100 && Fr.getDistance(ne.data.victim.vel, ne.data.last) <= 45 + ne.data.scale) return this.autoHitActive = !0, !0;
                    return !1
                }
            }
        }, {
            key: "autoKBInsta",
            value: function() {
                var e = this;
                if (W.toggles.autoKBInsta && Jt.enemies.nearest && 11 != er.tailIndex && !ne.data && !this.autoaim && !this.ATOS) {
                    var i = Jt.enemies.nearest,
                        t = Jt.enemies.angle,
                        n = function(e, i) {
                            return function(e) {
                                if (Array.isArray(e)) return e
                            }(e) || function(e, i) {
                                var t = null == e ? null : "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
                                if (null != t) {
                                    var n, r, l, d, o = [],
                                        a = !0,
                                        s = !1;
                                    try {
                                        if (l = (t = t.call(e)).next, 0 === i) {
                                            if (Object(t) !== t) return;
                                            a = !1
                                        } else
                                            for (; !(a = (n = l.call(t)).done) && (o.push(n.value), o.length !== i); a = !0);
                                    } catch (e) {
                                        s = !0, r = e
                                    } finally {
                                        try {
                                            if (!a && null != t.return && (d = t.return(), Object(d) !== d)) return
                                        } finally {
                                            if (s) throw r
                                        }
                                    }
                                    return o
                                }
                            }(e, i) || function(e, i) {
                                if (e) {
                                    if ("string" == typeof e) return ri(e, i);
                                    var t = {}.toString.call(e).slice(8, -1);
                                    return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? ri(e, i) : void 0
                                }
                            }(e, i) || function() {
                                throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                            }()
                        }(er.weapons, 2),
                        r = n[0],
                        l = n[1];
                    if (!i.trapData && 8 != r && [4, 5].includes(r) && 10 == l) {
                        var d = f.weapons[l];
                        if (!(Fr.getDistance(i, er) - 63 > d.range)) {
                            var o = oe.getReload(er, r),
                                a = oe.getReload(er, l),
                                s = oe.getReload(er, 53);
                            if (1 == o && 1 == a && 1 == s) {
                                var y, u;
                                u = 4 == r ? [.6, .3] : [.6, .5];
                                for (var p = 0; p < u.length; p++) y = ti.melee(0, er, y || i, u[p]);
                                for (var c = Fr.getDistance(y, er) / 9, h = function() {
                                        var n = {
                                            x: i.x2 + Math.cos(t) * (c * (x + 1)),
                                            y: i.y2 + Math.sin(t) * (c * (x + 1))
                                        };
                                        Jt.closeObjects.find((function(e) {
                                            return e && e.dmg && Fr.isFriendly(e.owner.sid) && Fr.getDistance(n, e) <= 35 + e.scale
                                        })) && (e.data = {
                                            insta: "reverse"
                                        })
                                    }, x = 0; x < 9; x++) h()
                            }
                        }
                    }
                }
            }
        }, {
            key: "autoKBHitSpike",
            value: function() {
                if (W.toggles.autoKBHitSpike && Jt.enemies.nearest && 11 != er.tailIndex && !this.autoaim && !this.ATOS) {
                    var e = Jt.enemies.nearest,
                        i = f.weapons[er.weapons[0]];
                    if (6 != e.skinIndex && !(1.5 * i.dmg < 60)) {
                        if (Fr.getDistance(e, er) - 63 > i.range) return !1;
                        if (!e.trapData) {
                            var t = ti.melee(er.weapons[0], er, e);
                            6 != e.skinIndex && Jt.closeObjects.find((function(e) {
                                return e && e.dmg && Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, t) <= 35 + e.scale
                            })) && (this.data = {
                                status: !0
                            }, this.autoHitActive = !0)
                        }
                    }
                }
            }
        }, {
            key: "autoTriggerOneShot",
            value: function() {
                if (this.ATOS && Jt.enemies.nearest && !this.autoaim && 11 != er.tailIndex && !(oe.getReload(er, er.weapons[0]) < 1 || oe.getReload(er, er.weapons[1]) < 1 || oe.getReload(er, 53) < 1)) {
                    var i = Jt.enemies.nearest,
                        t = 10 == er.weapons[1] ? 75 : f.weapons[er.weapons[0]].range;
                    Fr.getDistance(i, er) - 63 >= t || (10 != er.weapons[1] || 22 != i.skinIndex && 6 != i.skinIndex) && (this.autoaim = !0, this.ATOS = !1, 10 == er.weapons[1] ? (or.storeEquip(53), Jt.weaponIndex = er.weapons[1], Jt.weaponIndex != er.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAutoGather(), e.addQueue((function() {
                        or.storeEquip(7), Jt.weaponIndex = er.weapons[0], Jt.weaponIndex != er.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAim(Jt.enemies.angle)
                    })), e.addQueue((function() {
                        e.autoaim = !1, or.sendAutoGather()
                    }))) : (or.storeEquip(7), Jt.weaponIndex = er.weapons[0], Jt.weaponIndex != er.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAutoGather(), e.addQueue((function() {
                        or.storeEquip(53), Jt.weaponIndex = er.weapons[1], Jt.weaponIndex != er.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAim(Jt.enemies.angle)
                    })), e.addQueue((function() {
                        e.autoaim = !1, or.sendAutoGather()
                    }))))
                }
            }
        }, {
            key: "main",
            value: function() {
                this.data = void 0, this.autoHitActive = !1, "function" == typeof this.queue[0] && (this.queue[0](), this.queue.shift()), er.trapData || (this.autoKBHitSpike(), this.autoKBInsta()), this.autoTriggerOneShot()
            }
        }])
    }();

    function si(e) {
        return si = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, si(e)
    }

    function yi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, ui(n.key), n)
        }
    }

    function ui(e) {
        var i = function(e) {
            if ("object" != si(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != si(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == si(i) ? i : i + ""
    }
    di(ai, "autoaim", !1), di(ai, "queue", []), di(ai, "autoHitActive", !1), di(ai, "ATOS", !1), di(ai, "data", void 0);
    var pi = function() {
        return function(e, i, t) {
            return t && yi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "canBeSpiked",
            value: function() {
                /*
                for (var e, i = EntityAngle.fetch(Jt.enemies.nearest.sid), t = 0; t < i.length; t++) {
                    var n = i[t];
                    if (n.spike && Fr.getDistance(n.spikePos, er) <= 35 + n.spikeScale) return !0
                }
                for (var r = Jt.enemies.nearest, l = f.list[(null === (e = r.spikeData) || void 0 === e ? void 0 : e.id) || 9], d = 35 + l.scale + (l.placeOffset || 0), o = 0; o < me.anglesArray.length; o++) {
                    var a, s = me.anglesArray[o],
                        y = me.calculatePosition(r, d, s);
                    if (Fr.getDistance(y, er) <= l.scale + 35 && nn.checkItem(y.x, y.y, (null === (a = r.spikeData) || void 0 === a ? void 0 : a.id) || 9, l.scale)) return !0
                }
                */
                return !1
            }
        }])
    }();

    function ci(e) {
        return ci = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ci(e)
    }

    function fi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, xi(n.key), n)
        }
    }

    function hi(e, i, t) {
        return (i = xi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function xi(e) {
        var i = function(e) {
            if ("object" != ci(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ci(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ci(i) ? i : i + ""
    }
    var mi = function() {
        return function(e, i, t) {
            return t && fi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "resetAllForcedAddOns",
            value: function() {
                for (var e = 0; e < this.forcedAddOns.length; e++) this.forcedAddOns[e] = 0
            }
        }, {
            key: "addForcedAddOnValue",
            value: function(e, i, t) {
                e >= 4 || (this.forcedAddOns[e] += i, console.log(1 == e ? 22 : 6), or.storeEquip(1 == e ? 22 : 6), "function" == typeof t && (1 == i ? Jt.nextTick((function() {
                    t()
                })) : Jt.tickOut((function() {
                    t()
                }), i)))
            }
        }, {
            key: "resetForcedAddOn",
            value: function(e) {
                e >= 4 || (this.forcedAddOns[e] = 0)
            }
        }, {
            key: "tick",
            value: function() {
                if (er.health - 5 <= 0) return !1;
                if (!er.skins[7]) return !1;
                if (er.shameCount > 0 && !er.bullTick) return !0;
                if (this.needTick >= 2) return !0;
                var e = ((Jt.tick - er.bullTick + this.needTick) % 9 + 9) % 9;
                return er.shameCount > 0 && er.bullTick > 0 && 0 == e && (this.needTick++, !0)
            }
        }, {
            key: "check",
            value: function(e, i) {
                return i ? er.tails[e] ? e : 0 : er.skins[e] ? e : 0
            }
        }, {
            key: "onlySoldier",
            value: function() {
                var e = this;
                return [0, 2, 3].some((function(i) {
                    return e.forcedAddOns[i] > 0
                })) || this.velSoldier || this.spikeSoldier
            }
        }, {
            key: "biome",
            value: function(e) {
                er.y2 < 2400 ? or.storeEquip(15) : er.skins[12] ? or.storeEquip(12) : or.storeEquip(6), e || or.storeEquip(ai.ATOS ? this.check(19, !0) : 11, !0)
            }
        }, {
            key: "main",
            value: function() {
                for (var e = this, i = 0; i < this.forcedAddOns.length; i++) this.forcedAddOns[i] > 0 && (this.forcedAddOns[i]--, this.forcedAddOns[i] <= 0 && (this.forcedAddOns[i] = 0));
                if (this.spikeSoldier = !1, !er.trapData) {
                    for (var t = 0, n = [], r = 0; r < Jt.closeObjects.length; r++) {
                        var l = Jt.closeObjects[r];
                        l && l.dmg && !Fr.isFriendly(l.owner.sid) && (n.push(l), Fr.getDistance(l, er.vel) <= 35 + l.scale && (t += l.dmg))
                    }
                    for (var d = function() {
                            var i = Jt.enemies.near[o],
                                r = i.primaryWeapon,
                                l = oe.getReload(i, r),
                                d = 1.5 * oe.getDamage(r, i.primaryVariant);
                            if (1 == l) {
                                if (t > 0 && t + d >= 100) return e.spikeSoldier = !0, 0;
                                var a = ti.melee(r, er, i),
                                    s = n.filter((function(e) {
                                        return Fr.getDistance(a, e) <= 35 + e.scale
                                    })).reduce((function(e, i) {
                                        return e + i.dmg
                                    }), 0);
                                if (s + d >= 100) return e.spikeSoldier = !0, 0
                            }
                        }, o = 0; o < Jt.enemies.near.length && 0 !== d(); o++);
                }
            }
        }, {
            key: "default",
            value: function(e) {
                if (this.tick()) or.storeEquip(7);
                else if (er.y2 > 6850 && er.y2 < 7550) or.storeEquip(31), e || or.storeEquip(ai.ATOS ? this.check(19, !0) : 11, !0);
                else if (Fr.getDistance(Jt.enemies.nearest, er) <= 300) {
                    var i = Jt.enemies.nearest;
                    Fr.getDistance(Jt.enemies.nearest, er) <= 100 ? or.storeEquip(6) : ![0, 6, 7, 8].includes(er.weapons[0]) && Jt.enemies.near.length <= 1 && (0 == i.primaryWeapon || f.weapons[i.secondaryWeapon].dmg <= 10) && !pi.canBeSpiked() ? i.primaryVariant > 1 && 5 == i.primaryWeapon || Jt.closeObjects.find((function(e) {
                        return e && e.dmg && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) <= 175
                    })) ? or.storeEquip(6) : this.biome(!0) : or.storeEquip(6), e || (f.weapons[er.weapons[0]].dmg <= 20 ? or.storeEquip(11, !0) : or.storeEquip(this.check(19, !0), !0))
                } else "number" != typeof Gi.lastMoveDir && "number" != typeof Gi.globalPathAngle ? (or.storeEquip(6), e || or.storeEquip(11, !0)) : this.biome(e)
            }
        }])
    }();

    function gi(e) {
        return gi = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, gi(e)
    }

    function vi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, wi(n.key), n)
        }
    }

    function bi(e, i, t) {
        return (i = wi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function wi(e) {
        var i = function(e) {
            if ("object" != gi(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != gi(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == gi(i) ? i : i + ""
    }
    hi(mi, "velSoldier", !1), hi(mi, "spikeSoldier", !1), hi(mi, "needTick", 0), hi(mi, "forceAddIndexs", {
        onlySoldier: 0,
        onlyEMP: 1,
        trapSoldier: 2,
        otSoldier: 3
    }), hi(mi, "forcedAddOns", [0, 0, 0, 0]);
    var ki = function() {
        return function(e, i, t) {
            return t && vi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "start",
            value: function() {
                ai.autoaim = "OneTick", or.storeEquip(53), Jt.weaponIndex = er.weapons[0], Jt.weaponIndex != er.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), ai.addQueue((function() {
                    or.storeEquip(7), or.sendAim(Jt.enemies.angle), or.sendAutoGather()
                })), ai.addQueue((function() {
                    or.sendAutoGather()
                })), ai.addQueue((function() {
                    ai.autoaim = !1
                }))
            }
        }, {
            key: "main",
            value: function(e) {
                var i = Jt.enemies.nearest;
                if (!i || ai.autoaim || oe.getReload(er, 53) < 1) this.status = !1;
                else {
                    var t = Jt.enemies.angle,
                        n = Fr.getDistance(i, er) - 225,
                        r = Math.abs(n);
                    if (10 == er.weapons[1] && (10 != er.weaponIndex && or.selectToBuild(10, !0), Jt.weaponIndex = 10), r <= 5) {
                        if (!(e && W.toggles.oneTickIgnoreSoldier || 6 != i.skinIndex && 22 != i.skinIndex) || 11 == er.tailIndex || 1 != oe.getReload(er, 53) || 1 != oe.getReload(er, er.weapons[0])) return or.storeEquip(mi.check(19, !0), !0), or.storeEquip(6), void(this.movementDir = "stop movement");
                        this.start(), this.movementDir = t, this.last = Date.now()
                    }
                    r <= 20 ? (r <= 10 ? or.storeEquip(mi.check(19, !0), !0) : or.storeEquip(0, !0), or.storeEquip(40)) : (or.storeEquip(r <= 35 ? mi.check(19, !0) : 11, !0), or.storeEquip(6)), this.movementDir = t + (n > 0 ? 0 : Math.PI)
                }
            }
        }])
    }();

    function Si(e) {
        return Si = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Si(e)
    }

    function Pi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ii(n.key), n)
        }
    }

    function Ii(e) {
        var i = function(e) {
            if ("object" != Si(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Si(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Si(i) ? i : i + ""
    }
    bi(ki, "status", !1), bi(ki, "movementDir", void 0), bi(ki, "last", 0);
    var Ti = function() {
        return function(e, i) {
            return i && Pi(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e(i, t, n, r, l, d, o, a) {
            var s = a.BuildingDmg;
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e), this.x = i, this.y = t, this.speed = l, this.totalDuration = .85 * n, this.duration = n, this.scale = r, this.color = d, this.value = o, this.oldScale = r, this.maxScale = 1.3 * this.scale, this.minScale = .15 * this.scale, this.animationState = 0, this.BuildingDmg = s, this.easingDuration = .3 * n, this.elapsedTime = 0
        }), [{
            key: "easeInOutQuad",
            value: function(e) {
                return e < .5 ? 2 * e * e : (4 - 2 * e) * e - 1
            }
        }, {
            key: "update",
            value: function(e) {
                var i;
                this.duration -= e, this.y -= this.speed * e, (isNaN(parseInt(this.value)) || this.BuildingDmg) && (this.elapsedTime += e, 0 === this.animationState ? (i = Math.min(this.elapsedTime / this.easingDuration, 1), this.scale = this.oldScale + (this.maxScale - this.oldScale) * this.easeInOutQuad(i), i >= 1 && (this.animationState++, this.elapsedTime = 0)) : (i = Math.min(this.elapsedTime / (this.totalDuration - this.easingDuration), 1), this.scale = this.maxScale - (this.maxScale - this.minScale) * this.easeInOutQuad(i)), this.scale <= 0 && (this.scale = 0))
            }
        }, {
            key: "render",
            value: function(e, i, t) {
                e.save(), e.textBaseline = "middle", e.textAlign = "center", (isNaN(parseInt(this.value)) || this.BuildingDmg) && (e.lineWidth = 7, e.strokeStyle = "black"), e.fillStyle = this.color, e.font = this.scale + "px Hammersmith One", (isNaN(parseInt(this.value)) || this.BuildingDmg) && e.strokeText(this.value, this.x - i, this.y - t), e.fillText(this.value, this.x - i, this.y - t), e.restore()
            }
        }])
    }();

    function Di(e) {
        return Di = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Di(e)
    }

    function Oi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ei(n.key), n)
        }
    }

    function Ei(e) {
        var i = function(e) {
            if ("object" != Di(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Di(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Di(i) ? i : i + ""
    }
    var Mi = function() {
        return function(e, i, t) {
            return t && Oi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "update",
            value: function(e, i, t, n) {
                for (var r = 0; r < this.texts.length; r++) {
                    var l = this.texts[r];
                    l && (l.duration > 0 ? (l.update(e), l.render(i, t, n)) : this.texts.splice(r, 1))
                }
            }
        }, {
            key: "showText",
            value: function(e, i, t, n, r, l) {
                var d = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : {};
                this.texts.push(new Ti(e.x, e.y, i, t, n, r, l, d))
            }
        }])
    }();

    function ji(e) {
        return ji = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ji(e)
    }

    function Ci(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Bi(n.key), n)
        }
    }

    function Ai(e, i, t) {
        return (i = Bi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Bi(e) {
        var i = function(e) {
            if ("object" != ji(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ji(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ji(i) ? i : i + ""
    }! function(e, i, t) {
        (i = Ei(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(Mi, "texts", []);
    var Li = function() {
        return function(e, i, t) {
            return t && Ci(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "init",
            value: function() {
                this.holderElement = document.createElement("div"), this.holderElement.style = "position: absolute; left: 20px; bottom: 215px;", ml.appendChild(this.holderElement)
            }
        }, {
            key: "addEffect",
            value: function(e, i, t) {
                this.effects.push({
                    name: e,
                    icon: t,
                    duration: i,
                    maxDuration: i
                })
            }
        }, {
            key: "getElement",
            value: function(e, i) {
                var t = document.getElementById("war_robots_effect:".concat(e.name));
                return t || ((t = document.createElement("div")).id = "war_robots_effect:".concat(e.name), t.classList.add("war-robots-effect"), t.style.buttom = "".concat(50 * i, "px"), this.elements.push(t), this.holderElement.appendChild(t), setTimeout((function() {
                    t.style.left = "0px"
                }), 10)), t
            }
        }, {
            key: "animate",
            value: function(e) {
                for (var i = this, t = function() {
                        var t = i.effects[n],
                            r = i.getElement(t, n),
                            l = t.duration <= 0 ? 0 : t.duration / t.maxDuration * 100,
                            d = Math.round(t.duration / 100) / 10,
                            o = 1,
                            a = 16;
                        if (t.duration <= 3e3) {
                            var s = UTILS.removeWholeNumber(t.duration / 1e3);
                            o = s, a += 16 * (1 - s)
                        }
                        if (r.innerHTML = '\n            <div style="position: absolute; top: 0px; left: 0px; width: 100%; height: calc(100% - 3.75px);">\n                <img src="'.concat(t.icon, '" style="width: 36.25px; height: 36.25px;">\n                <div style="position: absolute; color: white; top: 0px; right: 5px; display: flex; height: 100%; text-align: right; align-items: center;">\n                    <div style="font-size: ').concat(a, "px; opacity: ").concat(o, ';">').concat(t.duration <= 0 ? "" : d.toString().includes(".") ? d : d + ".0", '</div>\n                </div>\n            </div>\n\n            <div style="position: absolute; bottom: 0px; left: 0px; height: 3.75px; width: 100%; background-color: rgb(0, 0, 0, .25);">\n                <div style="width: ').concat(l, '%; height: 100%; background-color: #f00;"></div>\n            </div>\n            '), t.duration -= e, t.duration <= 0 && null == t.isKilling) t.isKilling = 350;
                        else if (t.isKilling > 0) {
                            t.isKilling -= e, r.style.left = "-250px";
                            for (var y = 0; y < i.effects.length; y++) {
                                var u = i.effects[y],
                                    p = i.getElement(u, y);
                                p.id != r.id && (p.style.bottom = "".concat(50 * (y - 1), "px"))
                            }
                        } else if (t.isKilling <= 0) {
                            var c = i.elements.find((function(e) {
                                    return e.id == r.id
                                })),
                                f = i.elements.findIndex((function(e) {
                                    return e.id == r.id
                                }));
                            i.effects.splice(n, 1), i.elements.splice(f, 1), c.remove()
                        }
                    }, n = 0; n < this.effects.length; n++) t()
            }
        }])
    }();

    function Ri(e) {
        return Ri = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Ri(e)
    }

    function Hi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Wi(n.key), n)
        }
    }

    function Ni(e, i, t) {
        return (i = Wi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Wi(e) {
        var i = function(e) {
            if ("object" != Ri(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Ri(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Ri(i) ? i : i + ""
    }
    Ai(Li, "effects", []), Ai(Li, "elements", []), Ai(Li, "holderElement", void 0);
    var Gi = function() {
        return function(e, i, t) {
            return t && Hi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "getMoveDir",
            value: function() {
                var e = 0,
                    i = 0;
                for (var t in Fl) {
                    var n = Fl[t];
                    e += !!_l[t] * n[0], i += !!_l[t] * n[1]
                }
                return 0 == e && 0 == i ? void 0 : Fr.fixTo(Math.atan2(i, e), 2)
            }
        }, {
            key: "updateMovementDir",
            value: function() {
                var e = this.getMoveDir();
                (null == this.lastMoveDir || null == e || Math.abs(e - this.lastMoveDir) > .3) && (this.lastMoveDir = e)
            }
        }, {
            key: "main",
            value: function() {
                Li.effects.find((function(e) {
                    return "freeze" == e.name
                })) ? (this.type = 4, or.moveDir(void 0)) : "stop" == this.stopData ? (3 == this.type || er.trapData || Mi.showText(er, 250, 30, 0, "#fff", "stop"), this.type = 3, or.moveDir(void 0)) : ne.data ? (this.type = 2, or.moveDir(ne.data.dir)) : _l[16] || "number" != typeof this.globalPathAngle && "stop" != this.globalPathAngle ? "OneTick" == ai.autoaim ? (this.type = 2, or.moveDir(Jt.enemies.angle)) : "number" == typeof ki.movementDir || "string" == typeof ki.movementDir ? "string" == typeof ki.movementDir ? "stop movement" == ki.movementDir && (this.type = 1, or.moveDir(void 0)) : (this.type = 1, or.moveDir(ki.movementDir)) : (this.type = 0, or.moveDir(this.lastMoveDir)) : (this.type = 5, or.moveDir("stop" == this.globalPathAngle ? void 0 : this.globalPathAngle))
            }
        }])
    }();

    function _i(e) {
        return _i = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, _i(e)
    }

    function Fi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ui(n.key), n)
        }
    }

    function zi(e, i, t) {
        return (i = Ui(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Ui(e) {
        var i = function(e) {
            if ("object" != _i(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != _i(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == _i(i) ? i : i + ""
    }
    Ni(Gi, "lastMoveDir", void 0), Ni(Gi, "type", 0), Ni(Gi, "stopData", void 0), Ni(Gi, "globalPathAngle", void 0);
    var Vi = function() {
        return function(e, i, t) {
            return t && Fi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "renderCircle",
            value: function(e, i, t, n, r, l) {
                (n = n || Jr).beginPath(), n.arc(e, i, t, 0, 2 * Math.PI), l || n.fill(), r || n.stroke()
            }
        }, {
            key: "renderLeaf",
            value: function(e, i, t, n, r) {
                var l = e + t * Math.cos(n),
                    d = i + t * Math.sin(n),
                    o = .4 * t;
                r.moveTo(e, i), r.beginPath(), r.quadraticCurveTo((e + l) / 2 + o * Math.cos(n + Math.PI / 2), (i + d) / 2 + o * Math.sin(n + Math.PI / 2), l, d), r.quadraticCurveTo((e + l) / 2 - o * Math.cos(n + Math.PI / 2), (i + d) / 2 - o * Math.sin(n + Math.PI / 2), e, i), r.closePath(), r.fill(), r.stroke()
            }
        }, {
            key: "renderStar",
            value: function(e, i, t, n) {
                var r, l, d = Math.PI / 2 * 3,
                    o = Math.PI / i;
                e.beginPath(), navigator.platform.includes("Mac") || e.moveTo(0, -t);
                for (var a = 0; a < i; a++) r = Math.cos(d) * t, l = Math.sin(d) * t, e.lineTo(r, l), d += o, r = Math.cos(d) * n, l = Math.sin(d) * n, e.lineTo(r, l), d += o;
                navigator.platform.includes("Mac") || e.lineTo(0, -t), e.closePath()
            }
        }, {
            key: "renderRectCircle",
            value: function(e, i, t, n, r, l, d) {
                l.save(), l.translate(e, i), r = Math.ceil(r / 2);
                for (var o = 0; o < r; o++) this.renderRect(0, 0, 2 * t, n, l, d), l.rotate(Math.PI / r);
                l.restore()
            }
        }, {
            key: "renderRect",
            value: function(e, i, t, n, r, l) {
                r.fillRect(e - t / 2, i - n / 2, t, n), l || r.strokeRect(e - t / 2, i - n / 2, t, n)
            }
        }, {
            key: "renderTriangle",
            value: function(e, i) {
                var t = e * (Math.sqrt(3) / 2);
                i.beginPath(), i.moveTo(0, -t / 2), i.lineTo(-e / 2, t / 2), i.lineTo(e / 2, t / 2), i.lineTo(0, -t / 2), i.fill(), i.closePath()
            }
        }, {
            key: "getItemSprite",
            value: function(e, i) {
                var t = e.id + "_" + W.toggles.renderShadows + "_" + W.toggles.hyperOptim,
                    n = !1;
                (e.dmg || e.trap) && W.toggles.renderRedOverlay && e.owner && !Fr.isFriendly(e.owner.sid) && (n = !0, t += "_true");
                var r = this.itemSprites[t];
                if (!r || i) {
                    var l = document.createElement("canvas");
                    l.width = l.height = 2.5 * e.scale + this.outlineWidth + (f.list[e.id].spritePadding || 0);
                    var d = l.getContext("2d");
                    if (d.translate(l.width / 2, l.height / 2), d.rotate(i ? 0 : Math.PI / 2), d.strokeStyle = this.outlineColor, d.lineWidth = this.outlineWidth * (i ? l.width / 81 : 1), W.toggles.renderShadows && (d.shadowBlur = 10, d.shadowColor = "rgb(0, 0, 0, .6)"), "apple" == e.name) {
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#c15555", this.renderCircle(0, 0, e.scale, d);
                        var o = -Math.PI / 2;
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#89a54c", this.renderLeaf(e.scale * Math.cos(o), e.scale * Math.sin(o), 25, o + Math.PI / 2, d)
                    } else if ("cookie" == e.name || "cheese" == e.name) {
                        var a = "cheese" == e.name;
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : a ? "#f4f3ac" : "#cca861", this.renderCircle(0, 0, e.scale, d), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : a ? "#c3c28b" : "#937c4b";
                        for (var s = this.mathPI2 / 4, y = 0; y < 4; y++) {
                            var u = Fr.randInt(e.scale / 2.5, e.scale / 1.7);
                            this.renderCircle(u * Math.cos(s * y), u * Math.sin(s * y), Fr.randInt(4, 5), d, !0)
                        }
                    } else if ("wood wall" == e.name || "stone wall" == e.name || "castle wall" == e.name) {
                        var p = "castle wall" == e.name,
                            c = "wood wall" == e.name;
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : p ? "#83898e" : c ? "#a5974c" : "#939393";
                        var h = p ? 4 : 3;
                        this.renderStar(d, h, 1.1 * e.scale, 1.1 * e.scale), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : p ? "#9da4aa" : c ? "#c9b758" : "#bcbcbc", this.renderStar(d, h, .65 * e.scale, .65 * e.scale), d.fill()
                    } else if ("spikes" == e.name || "greater spikes" == e.name || "poison spikes" == e.name || "spinning spikes" == e.name) {
                        var x = .6 * e.scale;
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "poison spikes" == e.name ? "#7b935d" : "#939393", this.renderStar(d, "spikes" == e.name ? 5 : 6, e.scale, x), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#a5974c", this.renderCircle(0, 0, x, d), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#c9b758", this.renderCircle(0, 0, x / 2, d, !0)
                    } else if ("windmill" == e.name || "faster windmill" == e.name || "power mill" == e.name) d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#a5974c", this.renderCircle(0, 0, e.scale, d), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#c9b758", this.renderRectCircle(0, 0, 1.5 * e.scale, 29, 4, d), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#a5974c", this.renderCircle(0, 0, .5 * e.scale, d);
                    else if ("mine" == e.name) d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#939393", this.renderStar(d, 3, e.scale, e.scale), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#bcbcbc", this.renderStar(d, 3, .55 * e.scale, .65 * e.scale), d.fill();
                    else if ("sapling" == e.name)
                        for (var m = 0; m < 2; m++) {
                            var g = e.scale * (m ? .5 : 1);
                            this.renderStar(d, 7, g, .7 * g), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : m ? "#b4db62" : "#9ebf57", d.fill(), m || d.stroke()
                        } else if ("pit trap" == e.name) d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#a5974c", this.renderStar(d, 3, 1.1 * e.scale, 1.1 * e.scale), d.fill(), d.stroke(), d.fillStyle = this.outlineColor, this.renderStar(d, 3, .65 * e.scale, .65 * e.scale), d.fill();
                        else if ("boost pad" == e.name) d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#7e7f82", this.renderRect(0, 0, 2 * e.scale, 2 * e.scale, d), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#dbd97d", this.renderTriangle(e.scale, d);
                    else if ("turret" == e.name) d.fillStyle = "#a5974c", this.renderCircle(0, 0, e.scale, d), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#939393", this.renderRect(0, -25, .9 * e.scale, 50, d), this.renderCircle(0, 0, .6 * e.scale, d), d.fill(), d.stroke();
                    else if ("platform" == e.name) {
                        d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#cebd5f";
                        for (var v = 2 * e.scale, b = v / 4, w = -e.scale / 2, k = 0; k < 4; k++) this.renderRect(w - b / 2, 0, b, 2 * e.scale, d), d.fill(), d.stroke(), w += v / 4
                    } else "healing pad" == e.name ? (d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#7e7f82", this.renderRect(0, 0, 2 * e.scale, 2 * e.scale, d), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#db6e6e", this.renderRectCircle(0, 0, .65 * e.scale, 20, 4, d, !0)) : "spawn pad" == e.name ? (d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#7e7f82", this.renderRect(0, 0, 2 * e.scale, 2 * e.scale, d), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#71aad6", this.renderCircle(0, 0, .6 * e.scale, d)) : "blocker" == e.name ? (d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#7e7f82", this.renderCircle(0, 0, e.scale, d), d.fill(), d.stroke(), d.rotate(Math.PI / 4), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#db6e6e", this.renderRectCircle(0, 0, .65 * e.scale, 20, 4, d, !0)) : "teleporter" == e.name && (d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#7e7f82", this.renderCircle(0, 0, e.scale, d), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#d76edb", this.renderCircle(0, 0, .5 * e.scale, d, !0));
                    n && (d.globalAlpha = .6, d.fillStyle = "#780c0c", d.fill()), r = l, i || d.getImageData(0, 0, l.width, l.height).data.some((function(e) {
                        return 0 !== e
                    })) && (this.itemSprites[t] = r)
                }
                return r
            }
        }, {
            key: "renderBlob",
            value: function(e, i, t, n) {
                var r = Math.PI / 2 * 3,
                    l = Math.PI / i;
                e.beginPath(), e.moveTo(0, -n);
                for (var d = 0; d < i; d++) {
                    var o = Fr.randInt(t + .9, 1.2 * t);
                    e.quadraticCurveTo(Math.cos(r + l) * o, Math.sin(r + l) * o, Math.cos(r + 2 * l) * n, Math.sin(r + 2 * l) * n), r += 2 * l
                }
                e.lineTo(0, -n), e.closePath()
            }
        }, {
            key: "getResSprite",
            value: function(e) {
                var i = e.y >= t.mapScale - t.snowBiomeTop ? 2 : e.y <= t.snowBiomeTop ? 1 : 0,
                    n = e.type + "_" + e.scale + "_" + i + "_" + (0 == e.type ? e.colorType : 0) + "_" + W.toggles.renderShadows + "_" + W.toggles.hyperOptim,
                    r = this.gameObjectSprites[n];
                if (!r) {
                    var l = document.createElement("canvas");
                    l.width = l.height = 2.1 * e.scale + this.outlineWidth;
                    var d = l.getContext("2d");
                    if (d.translate(l.width / 2, l.height / 2), d.rotate(Fr.randFloat(0, Math.PI)), d.strokeStyle = this.outlineColor, d.lineWidth = this.outlineWidth, W.toggles.renderShadows && (d.shadowBlur = 10, d.shadowColor = "rgb(0, 0, 0, .6)"), 0 == e.type)
                        for (var o = 0; o < 2; o++) {
                            var a = e.scale * (o ? .5 : 1);
                            this.renderStar(d, Math.random() < .25 ? 5 : 7, a, .7 * a);
                            var s = W.toggles.hyperOptim ? "#0000ff" : i ? "hsl(191, 20%, ".concat(85 + Math.floor(10 * Math.random()), "%)") : "hsl(80, 45%, ".concat(38 + Math.floor(10 * Math.random()), "%)");
                            d.fillStyle = i ? o ? "#fff" : Math.random() > .5 ? s : "#e3f1f4" : o ? "#b4db62" : Math.random() > .5 ? s : "#9ebf57", d.fill(), o || d.stroke()
                        } else if (1 == e.type)
                            if (2 == i) d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#606060", this.renderStar(d, 6, .3 * e.scale, .71 * e.scale), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#89a54c", this.renderCircle(0, 0, .55 * e.scale, d), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "#a5c65b", this.renderCircle(0, 0, .3 * e.scale, d, !0);
                            else {
                                this.renderBlob(d, 6, e.scale, .7 * e.scale), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : i ? "#e3f1f4" : "#89a54c", d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : i ? "#6a64af" : "#c15555";
                                for (var y = 2 * Math.PI / 4, u = 0; u < 4; u++) {
                                    var p = Fr.randInt(e.scale / 3.5, e.scale / 2.3);
                                    this.renderCircle(p * Math.cos(y * u), p * Math.sin(y * u), Fr.randInt(10, 12), d)
                                }
                            }
                    else 2 != e.type && 3 != e.type || (d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : 2 == e.type ? 2 == i ? "#938d77" : "#939393" : "#e0c655", this.renderStar(d, 3, e.scale, e.scale), d.fill(), d.stroke(), d.fillStyle = W.toggles.hyperOptim ? "#0000ff" : 2 == e.type ? 2 == i ? "#b2ab90" : "#bcbcbc" : "#ebdca3", this.renderStar(d, 3, .55 * e.scale, .65 * e.scale), d.fill());
                    r = l, this.gameObjectSprites[n] = r
                }
                return r
            }
        }])
    }();

    function qi(e) {
        return qi = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, qi(e)
    }

    function Xi(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function Yi(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Zi(n.key), n)
        }
    }

    function Ki(e, i, t) {
        return (i = Zi(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Zi(e) {
        var i = function(e) {
            if ("object" != qi(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != qi(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == qi(i) ? i : i + ""
    }
    zi(Vi, "outlineWidth", 5.5), zi(Vi, "outlineColor", "#525252"), zi(Vi, "darkOutlineColor", "#3d3f42"), zi(Vi, "itemSprites", {}), zi(Vi, "mathPI2", 2 * Math.PI), zi(Vi, "gameObjectSprites", {});
    var Qi = function() {
        return function(e, i, t) {
            return t && Yi(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "getBestWeapon",
            value: function(e, i) {
                var t = er.weapons[0];
                return 10 == er.weapons[1] ? e && 5 != t && 1 == oe.getReload(er, t) && (null == i ? void 0 : i.currentHealth) - f.weapons[t].dmg <= 0 ? t : 10 : t
            }
        }, {
            key: "getObjectWeight",
            value: function(e) {
                return e.dmg ? 0 : e.trap || e.boostSpeed ? 1 : e.teleport ? 2 : 3
            }
        }, {
            key: "objBreaking",
            value: function() {
                var e = this;
                if (!W.toggles.autoBreakObject) return this.targetQueue.length = 0, !1;
                var i = this.getBestWeapon(),
                    n = f.weapons[i];
                this.targetQueue.length && (this.targetQueue = this.targetQueue.sort((function(i, t) {
                    return e.getObjectWeight(i) - e.getObjectWeight(t)
                })), this.targetQueue = this.targetQueue.filter((function(e) {
                    return Fr.getDistance(e, er) - e.scale <= n.range
                })));
                var r = Jt.closeObjects.filter((function(e) {
                    return e && e.dmg && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) - e.scale <= n.range
                }));
                r.sort((function(e, i) {
                    return Fr.getDistance(e, er) - Fr.getDistance(i, er)
                })), r.unshift.apply(r, function(e) {
                    return function(e) {
                        if (Array.isArray(e)) return Xi(e)
                    }(e) || function(e) {
                        if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
                    }(e) || function(e, i) {
                        if (e) {
                            if ("string" == typeof e) return Xi(e, i);
                            var t = {}.toString.call(e).slice(8, -1);
                            return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? Xi(e, i) : void 0
                        }
                    }(e) || function() {
                        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                    }()
                }(this.targetQueue));
                var l = r[0];
                if (l) {
                    if (r.length > 1)
                        for (var d = Fr.getDirection(l, er), o = 1; o < r.length; o++) {
                            var a = r[o],
                                s = Fr.getDirection(a, er),
                                y = Fr.findMiddlePoint(a, l),
                                u = Fr.getDirection(y, er);
                            if (Fr.getAngleDist(u, d) <= t.gatherAngle && Fr.getAngleDist(u, s) <= t.gatherAngle) return this.target = {
                                sid: [l.sid, a.sid],
                                x: y.x,
                                y: y.y
                            }, this.targetQueue.length = 0, !0
                        }
                    return this.targetQueue.length = 0, this.target = {
                        sid: [l.sid],
                        x: l.x,
                        y: l.y
                    }, !0
                }
                return this.targetQueue.length = 0, !1
            }
        }, {
            key: "healthToHits",
            value: function(e, i) {
                var n, r = f.weapons[i],
                    l = (null == r.projectile ? r.dmg : 0) * ((null === (n = t.weaponVariants[er.weaponVariant]) || void 0 === n ? void 0 : n.val) || 1) * (r.sDmg || 1) * (er.skins[40] ? 3.3 : 1);
                return Math.ceil(e / l)
            }
        }, {
            key: "replaceable",
            value: function(e) {
                for (var i = Math.PI, t = Math.PI / 12, n = f.list[15].scale + 30, r = 0; r < Jt.enemies.near.length; r++) {
                    var l = Jt.enemies.near[r];
                    if (l && Fr.getDistance(l, er) <= 160)
                        for (var d = 0; d <= i; d += t) {
                            var o = me.calculatePosition(l, n, d);
                            if (nn.checkItem(o.x, o.y, 15, 50, e)) return !0;
                            if (o = me.calculatePosition(l, n, d + i), nn.checkItem(o.x, o.y, 15, 50, e)) return !0
                        }
                }
                return !1
            }
        }, {
            key: "main",
            value: function() {
                var e = er.trapData,
                    i = this.getBestWeapon(!0, e),
                    n = f.weapons[i],
                    r = Jt.closeObjects.filter((function(e) {
                        return e && e.dmg && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) - e.scale <= n.range
                    })),
                    l = (r = r.sort((function(e, i) {
                        return Fr.getDistance(e, er) - Fr.getDistance(i, er)
                    })))[0];
                if (l) {
                    for (var d = Fr.getDirection(l, er), o = 1; o < r.length; o++) {
                        var a = r[o],
                            s = Fr.getDirection(a, er),
                            y = Fr.findMiddlePoint(a, l),
                            u = Fr.getDirection(y, er);
                        if (Fr.getAngleDist(u, d) <= t.gatherAngle && Fr.getAngleDist(u, s) <= t.gatherAngle) {
                            l = {
                                x: y.x,
                                y: y.y,
                                currentHealth: (a.currentHealth + l.currentHealth) / 2
                            };
                            break
                        }
                    }
                    _l[16] && (l = void 0), l && this.healthToHits(e.currentHealth, i) < this.healthToHits(l.currentHealth, i) && !this.replaceable(e) && (l = void 0)
                }
                i = this.getBestWeapon(!0, l || e), Jt.weaponIndex = i, er.weaponIndex != i && or.selectToBuild(i, !0), this.aim = Fr.getDirection(l || e, er), 1 == oe.getReload(er, i) ? (or.storeEquip(40), Jt.attackOnce()) : mi.default(!0)
            }
        }])
    }();

    function Ji(e) {
        return Ji = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Ji(e)
    }

    function $i(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function et(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, it(n.key), n)
        }
    }

    function it(e) {
        var i = function(e) {
            if ("object" != Ji(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Ji(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Ji(i) ? i : i + ""
    }
    Ki(Qi, "aim", void 0), Ki(Qi, "tankSpam", !1), Ki(Qi, "target", void 0), Ki(Qi, "targetQueue", []);
    var tt = "JG",
        nt = "U",
        rt = function() {
            return function(e, i) {
                return i && et(e.prototype, i), Object.defineProperty(e, "prototype", {
                    writable: !1
                }), e
            }((function e(i, t) {
                var n = this;
                ! function(e, i) {
                    if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
                }(this, e), this.socket = new WebSocket(i.url), this.botSids = [], this.socket.binaryType = "arraybuffer", this.project = i, this.amount = t, this.socket.onopen = function() {
                    return n.onOpen()
                }, this.socket.onmessage = function(e) {
                    return n.onMessage(e)
                }, this.socket.onclose = function(e) {
                    var i = e.code,
                        t = e.reason;
                    return n.onClose(i, t)
                }
            }), [{
                key: "send",
                value: function(e) {
                    if (this.socket && 1 == this.socket.readyState) {
                        for (var i = arguments.length, t = new Array(i > 1 ? i - 1 : 0), n = 1; n < i; n++) t[n - 1] = arguments[n];
                        this.socket.send(d.encode([e, t]))
                    }
                }
            }, {
                key: "onOpen",
                value: function() {
                    console.log("Connected"), this.send(tt, Lr.wsAddress, this.amount)
                }
            }, {
                key: "onMessage",
                value: function(e) {
                    var i = function(e, i) {
                            return function(e) {
                                if (Array.isArray(e)) return e
                            }(e) || function(e, i) {
                                var t = null == e ? null : "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
                                if (null != t) {
                                    var n, r, l, d, o = [],
                                        a = !0,
                                        s = !1;
                                    try {
                                        if (l = (t = t.call(e)).next, 0 === i) {
                                            if (Object(t) !== t) return;
                                            a = !1
                                        } else
                                            for (; !(a = (n = l.call(t)).done) && (o.push(n.value), o.length !== i); a = !0);
                                    } catch (e) {
                                        s = !0, r = e
                                    } finally {
                                        try {
                                            if (!a && null != t.return && (d = t.return(), Object(d) !== d)) return
                                        } finally {
                                            if (s) throw r
                                        }
                                    }
                                    return o
                                }
                            }(e, i) || function(e, i) {
                                if (e) {
                                    if ("string" == typeof e) return $i(e, i);
                                    var t = {}.toString.call(e).slice(8, -1);
                                    return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? $i(e, i) : void 0
                                }
                            }(e, i) || function() {
                                throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                            }()
                        }(Fr.decodeSocketMessages(e), 2),
                        t = i[0],
                        n = i[1];
                    if ("update" == t) {
                        var r = n[0],
                            l = r.x,
                            d = r.y,
                            o = r.sid;
                        this.botSids.includes(o) || this.botSids.push(o), st.botSids.set(o, {
                            x: l,
                            y: d
                        })
                    } else "disconnected" == t && st.botSids.has(n[0]) && st.botSids.delete(n[0])
                }
            }, {
                key: "onClose",
                value: function(e, i) {
                    console.log("Bot server: ", e, i);
                    for (var t = 0; t < this.botSids.length; t++) {
                        var n = this.botSids[t];
                        st.botSids.has(n) && (st.botSids.delete(n), this.project.amount -= this.amount, this.amount = 0)
                    }
                    var r = st.bots.indexOf(this);
                    st.bots.splice(r, 1)
                }
            }])
        }();

    function lt(e) {
        return lt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, lt(e)
    }

    function dt(e, i, t) {
        return (i = at(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function ot(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, at(n.key), n)
        }
    }

    function at(e) {
        var i = function(e) {
            if ("object" != lt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != lt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == lt(i) ? i : i + ""
    }
    var st = function() {
        return function(e, i, t) {
            return i && ot(e.prototype, i), t && ot(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), null, [{
            key: "add",
            value: function(e) {
                for (; e > 0;) {
                    var i = this.projects.find((function(e) {
                        return e.amount < 4
                    }));
                    if (!i) break;
                    i.amount = Math.min(e, 4), this.bots.push(new rt(i, Math.min(e, 4))), e -= 4
                }
            }
        }, {
            key: "remove",
            value: function(e) {
                var i = this;
                if (this.bots.length)
                    for (var t = function() {
                            var t = i.bots[i.bots.length - 1],
                                n = i.projects.find((function(e) {
                                    return e.url == t.project.url
                                }));
                            if (!n) return 1;
                            e -= n.amount, t.send("dc", Math.min(n.amount, e)), n.amount -= Math.min(n.amount, e), n.amount <= 0 && (i.bots.pop(), n.amount = 0)
                        }; e > 0 && !t(););
            }
        }, {
            key: "encode",
            value: function(e) {
                for (var i = arguments.length, t = new Array(i > 1 ? i - 1 : 0), n = 1; n < i; n++) t[n - 1] = arguments[n];
                return d.encode([e].concat(t))
            }
        }, {
            key: "update",
            value: function() {
                for (var e = 0; e < this.bots.length; e++) {
                    var i = this.bots[e];
                    i && i.send(nt, {
                        botNames: W.toggles.botNames,
                        owner: er,
                        enemy: Jt.enemies.nearest ? {
                            x: Jt.enemies.nearest.x2,
                            y: Jt.enemies.nearest.y2
                        } : void 0,
                        cursor: Jt.cursorLocation,
                        botModule: W.toggles.botModule,
                        movementModule: W.toggles.botMovementModule,
                        targetModule: W.toggles.autoaimBotModule,
                        playerDistance: W.toggles.playerDistance,
                        primaryWeaponSelector: W.toggles.botPrimaryWeapon,
                        breakingRadius: W.toggles.botBreakingRadius,
                        ownerObjects: nr.filter((function(e) {
                            return e && (e.trap || e.dmg) && Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) <= W.toggles.botBreakingRadius
                        }))
                    })
                }
            }
        }])
    }();

    function yt(e) {
        return yt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, yt(e)
    }

    function ut(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, ct(n.key), n)
        }
    }

    function pt(e, i, t) {
        return (i = ct(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function ct(e) {
        var i = function(e) {
            if ("object" != yt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != yt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == yt(i) ? i : i + ""
    }
    dt(st, "botSids", new Map), dt(st, "bots", []), dt(st, "projects", []);
    var ft = function() {
        return function(e, i, t) {
            return t && ut(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "sendChat",
            value: function(e) {
                this.chatMessage = e.slice(0, 45), this.chatCooldown = 5e3
            }
        }, {
            key: "render",
            value: function(e, i, n) {
                if (W.toggles.moomooPet && er) {
                    0 == n && (this.deltaTime -= i, this.delta += i, this.smoothAnimations(this.delta), this.deltaTime <= 0 && (this.deltaTime = t.serverUpdateSpeed, this.update(i)));
                    var r = wt.maxScreenWidth,
                        l = wt.maxScreenHeight,
                        d = wt.camX - r / 2,
                        o = wt.camY - l / 2;
                    if (0 == n) e.save(), e.translate(this.x - d, this.y - o), e.scale(.6, .6), e.rotate(this.dir), wt.renderPlayer(this, e), e.restore();
                    else if (this.chatCooldown -= i, this.chatCooldown > 0) {
                        e.save(), e.scale(.6, .6), e.font = "28px Hammersmith One";
                        var a = e.measureText(this.chatMessage);
                        e.textBaseline = "middle", e.textAlign = "center";
                        var s = (this.x - d) / .6,
                            y = (this.y - this.scale - o - 22) / .6,
                            u = a.width + 17;
                        e.fillStyle = "rgba(0, 0, 0, 0.2)", e.roundRect(s - u / 2, y - 18.5 + 10, u, 37, 6), e.fill(), e.fillStyle = "#fff", e.fillText(this.chatMessage, s, y + 10), e.restore()
                    }
                }
            }
        }, {
            key: "smoothAnimations",
            value: function() {
                var e = this.delta / 170;
                this.x = this.x1 + (this.x2 - this.x1) * e, this.y = this.y1 + (this.y2 - this.y1) * e, this.dir = Math.lerpAngle(this.d2, this.d1, Math.min(1.2, this.delta / 111))
            }
        }, {
            key: "update",
            value: function() {
                if (er && (this.delta = 0, this.x1 = this.x, this.y1 = this.y, this.d1 = this.d2, this.d2 = parseFloat(Fr.getDirection(er, this).toFixed(3)), Fr.getDistance(er, this) >= 100)) {
                    var e = Fr.getDirection(this, er);
                    this.x2 = er.x + 100 * Math.cos(e), this.y2 = er.y + 100 * Math.sin(e)
                }
            }
        }])
    }();

    function ht(e) {
        return ht = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ht(e)
    }

    function xt(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, gt(n.key), n)
        }
    }

    function mt(e, i, t) {
        return (i = gt(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function gt(e) {
        var i = function(e) {
            if ("object" != ht(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ht(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ht(i) ? i : i + ""
    }
    pt(ft, "x", 0), pt(ft, "y", 0), pt(ft, "x1", 0), pt(ft, "y1", 0), pt(ft, "x2", 0), pt(ft, "y2", 0), pt(ft, "weaponIndex", 8), pt(ft, "weaponVariant", 2), pt(ft, "deltaTime", 0), pt(ft, "skinIndex", 0), pt(ft, "tailIndex", 0), pt(ft, "dir", 0), pt(ft, "dirPlus", 0), pt(ft, "scale", 35), pt(ft, "skinColor", 0), pt(ft, "buildIndex", -1), pt(ft, "delta", 0), pt(ft, "t2", 0), pt(ft, "t1", 0), pt(ft, "d2", 0), pt(ft, "d1", 0), pt(ft, "chatMessage", "You suck"), pt(ft, "chatCooldown", 1e4);
    var vt = 0;

    function bt(e, i, t) {
        return e + t >= 0 && e - t <= wt.maxScreenWidth && i + t >= 0 && i - t <= wt.maxScreenHeight
    }
    var wt = function() {
        function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }
        return function(e, i, t) {
            return t && xt(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }(e, 0, [{
            key: "drawRegularPolygon",
            value: function(e, i, t) {
                var n = e.lineWidth || 0,
                    r = t / 2;
                e.beginPath();
                for (var l = 2 * Math.PI / i, d = 0; d < i; d++) {
                    var o = r + (r - n / 2) * Math.cos(l * d),
                        a = r + (r - n / 2) * Math.sin(l * d);
                    e.lineTo(o, a)
                }
                e.closePath()
            }
        }, {
            key: "drawVolancoImage",
            value: function() {
                var e = 2 * t.volanoScale,
                    i = document.createElement("canvas");
                i.width = e, i.height = e;
                var n = i.getContext("2d");
                n.strokeStyle = "#3e3e3e", n.lineWidth = 2 * Vi.outlineWidth, n.fillStyle = "#7f7f7f", this.drawRegularPolygon(n, 10, e), n.fill(), n.stroke(), this.volcanoSprite.land = i;
                var r = 2 * t.innerVolcanoScale,
                    l = document.createElement("canvas");
                l.width = r, l.height = r;
                var d = l.getContext("2d");
                d.strokeStyle = Vi.outlineColor, d.lineWidth = 1.6 * Vi.outlineWidth, d.fillStyle = "#f54e16", d.strokeStyle = "#f56f16", this.drawRegularPolygon(d, 10, r), d.fill(), d.stroke(), this.volcanoSprite.lava = l
            }
        }, {
            key: "renderWaterBodies",
            value: function(e, i, n) {
                var r = t.riverWidth + n,
                    l = t.mapScale / 2 - e - r / 2;
                l < this.maxScreenHeight && l + r > 0 && i.fillRect(0, l, this.maxScreenWidth, r)
            }
        }, {
            key: "renderProjectile",
            value: function(e, i, t, n) {
                if (t.src) {
                    var r = f.projectiles[t.indx].src,
                        l = this.projectileSprites[r];
                    l || ((l = new Image).onload = function() {
                        this.isLoaded = !0
                    }, l.src = "https://dev.moomoo.io/img/weapons/".concat(r, ".png"), this.projectileSprites[r] = l), l.isLoaded && n.drawImage(l, e - t.scale / 2, i - t.scale / 2, t.scale, t.scale)
                } else 1 == t.indx && (n.fillStyle = "#939393", Vi.renderCircle(e, i, t.scale, n));
                if (t.src) {
                    var d = f.projectiles[t.indx].src,
                        o = this.projectileSprites[d];
                    o || ((o = new Image).onload = function() {
                        this.isLoaded = !0
                    }, o.src = location.hostname.includes("moomoo") ? "../../img/weapons/".concat(d, ".png") : "https://dev.moomoo.io/img/weapons/".concat(d, ".png"), this.projectileSprites[d] = o), o.isLoaded && n.drawImage(o, e - t.scale / 2, i - t.scale / 2, t.scale, t.scale)
                } else 1 == t.indx && (n.fillStyle = "#939393", Vi.renderCircle(e, i, t.scale, n))
            }
        }, {
            key: "renderProjectiles",
            value: function(e, i, t) {
                for (var n = 0; n < tr.length; n++) {
                    var r = tr[n];
                    r.active && r.layer == e && (r.update(vt), r.active && bt(r.x - i, r.y - t, r.scale) && (Jr.save(), Jr.translate(r.x - i, r.y - t), Jr.rotate(r.dir), this.renderProjectile(0, 0, r, Jr, 1), Jr.restore()))
                }
            }
        }, {
            key: "renderGameObjects",
            value: function(e, i, n) {
                for (var r = 0; r < nr.length; r++) {
                    var l = nr[r];
                    if (l.active) {
                        var d = l.x + l.xWiggle - i,
                            o = l.y + l.yWiggle - n;
                        if (0 == e && l.update(vt), l.layer == e && bt(d, o, l.scale + (l.blocker || 0)))
                            if (Jr.globalAlpha = l.hideFromEnemy ? .6 : 1, l.isItem) {
                                var a = Vi.getItemSprite(l);
                                if (Jr.save(), Jr.translate(d, o), Jr.rotate(l.dir), Jr.drawImage(a, -a.width / 2, -a.height / 2), l.blocker && (Jr.strokeStyle = "#db6e6e", Jr.globalAlpha = .3, Jr.lineWidth = 6, Vi.renderCircle(0, 0, l.blocker, Jr, !1, !0)), Qi.target && Qi.target.sid.includes(l.sid)) {
                                    var s = Qi.getBestWeapon();
                                    1 == oe.getReload(er, s) && (Jr.globalAlpha = .35, Jr.fillStyle = "#91b2db", Vi.renderCircle(0, 0, l.scale, Jr, !0, !1))
                                }
                                Jr.restore()
                            } else if (4 == l.type) {
                            Jr.globalAlpha = 1, this.volcanoSprite.animationTime += vt, this.volcanoSprite.animationTime %= t.volcanoAnimationDuration;
                            var y = t.volcanoAnimationDuration / 2,
                                u = 1.7 + Math.abs(y - this.volcanoSprite.animationTime) / y * .3,
                                p = t.innerVolcanoScale * u;
                            Jr.drawImage(this.volcanoSprite.land, d - t.volanoScale, o - t.volanoScale, 2 * t.volanoScale, 2 * t.volanoScale), Jr.drawImage(this.volcanoSprite.lava, d - p, o - p, 2 * p, 2 * p)
                        } else {
                            var c = Vi.getResSprite(l);
                            Jr.globalAlpha = 1, Jr.drawImage(c, d - c.width / 2, o - c.height / 2)
                        }
                    }
                }
            }
        }, {
            key: "renderAI",
            value: function(e, i) {
                var t = e.index,
                    n = this.aiSprites[t];
                if (!n) {
                    var r = new Image;
                    r.onload = function() {
                        this.isLoaded = !0, this.onload = null
                    }, r.src = location.hostname.includes("moomoo") ? "../../img/animals/".concat(e.src, ".png") : "https://dev.moomoo.io/img/animals/".concat(e.src, ".png"), n = r, this.aiSprites[t] = n
                }
                if (n.isLoaded) {
                    var l = 1.2 * e.scale * (e.spriteMlt || 1);
                    i.drawImage(n, -l, -l, 2 * l, 2 * l)
                }
            }
        }, {
            key: "renderTool",
            value: function(e, i, t, n, r) {
                var l = e.src + (i || ""),
                    d = this.toolSprites[l];
                d || ((d = new Image).onload = function() {
                    this.isLoaded = !0
                }, d.src = location.hostname.includes("moomoo") ? "../../img/weapons/".concat(l, ".png") : "https://dev.moomoo.io/img/weapons/".concat(l, ".png"), this.toolSprites[l] = d), d.isLoaded && r.drawImage(d, t + e.xOff - e.length / 2, n + e.yOff - e.width / 2, e.length, e.width)
            }
        }, {
            key: "renderTail",
            value: function(e, i, t) {
                var n = this.accessSprites[e];
                if (!n) {
                    var r = new Image;
                    r.onload = function() {
                        this.isLoaded = !0, this.onload = null
                    }, r.src = location.hostname.includes("moomoo") ? "../../img/accessories/access_".concat(e, ".png") : "https://dev.moomoo.io/img/accessories/access_".concat(e, ".png"), this.accessSprites[e] = r, n = r
                }
                var l = this.accessPointers[e];
                if (!l) {
                    for (var d = 0; d < G.accessories.length; d++)
                        if (G.accessories[d].id == e) {
                            l = G.accessories[d];
                            break
                        } this.accessPointers[e] = l
                }
                n.isLoaded && (i.save(), i.translate(-20 - (l.xOff || 0), 0), l.spin && i.rotate(t.skinRot), i.drawImage(n, -l.scale / 2, -l.scale / 2, l.scale, l.scale), i.restore())
            }
        }, {
            key: "renderSkin",
            value: function(e, i, t, n) {
                var r = this.skinSprites[e];
                if (!r) {
                    var l = new Image;
                    l.onload = function() {
                        this.isLoaded = !0, this.onload = null
                    }, l.src = location.hostname.includes("moomoo") ? "../../img/hats/hat_".concat(e, ".png") : "https://dev.moomoo.io/img/hats/hat_".concat(e, ".png"), this.skinSprites[e] = l, r = l
                }
                var d = t || this.skinPointers[e];
                if (!d) {
                    for (var o = 0; o < G.hats.length; o++)
                        if (G.hats[o].id == e) {
                            d = G.hats[o];
                            break
                        } this.skinPointers[e] = d
                }
                r.isLoaded && i.drawImage(r, -d.scale / 2, -d.scale / 2, d.scale, d.scale), !t && d.topSprite && (i.save(), i.rotate(n.skinRot), this.renderSkin(e + "_top", i, d, n), i.restore())
            }
        }, {
            key: "renderPlayer",
            value: function(e, i) {
                i.lineWidth = Vi.outlineWidth, i.lineJoin = "miter";
                var n = Math.PI / 4 * (f.weapons[e.weaponIndex].armS || 1),
                    r = e.buildIndex < 0 && f.weapons[e.weaponIndex].hndS || 1,
                    l = e.buildIndex < 0 && f.weapons[e.weaponIndex].hndD || 1;
                if (e.tailIndex > 0 && this.renderTail(e.tailIndex, i, e), e.buildIndex < 0 && !f.weapons[e.weaponIndex].aboveHand && (this.renderTool(f.weapons[e.weaponIndex], t.weaponVariants[e.weaponVariant].src, e.scale, 0, i), null == f.weapons[e.weaponIndex].projectile || f.weapons[e.weaponIndex].hideProjectile || this.renderProjectile(e.scale, 0, f.projectiles[f.weapons[e.weaponIndex].projectile], Jr)), i.fillStyle = t.skinColors[e.skinColor], Vi.renderCircle(e.scale * Math.cos(n), e.scale * Math.sin(n), 14), Vi.renderCircle(e.scale * l * Math.cos(-n * r), e.scale * l * Math.sin(-n * r), 14), e.buildIndex < 0 && f.weapons[e.weaponIndex].aboveHand && (this.renderTool(f.weapons[e.weaponIndex], t.weaponVariants[e.weaponVariant].src, e.scale, 0, i), null == f.weapons[e.weaponIndex].projectile || f.weapons[e.weaponIndex].hideProjectile || this.renderProjectile(e.scale, 0, f.projectiles[f.weapons[e.weaponIndex].projectile], Jr)), e.buildIndex >= 0) {
                    var d = Vi.getItemSprite(f.list[e.buildIndex]);
                    i.drawImage(d, e.scale - f.list[e.buildIndex].holdOffset, -d.width / 2)
                }
                Vi.renderCircle(0, 0, e.scale, i), e.skinIndex > 0 && (i.rotate(Math.PI / 2), this.renderSkin(e.skinIndex, i, null, e))
            }
        }, {
            key: "renderPlayers",
            value: function(e, i, t) {
                for (var n = 0; n < rr.length; n++) {
                    var r = rr[n];
                    if (r.zIndex == t && (r.animate(vt), r.visible)) {
                        var l = (Lr.playerSID != r.sid || W.toggles.renderRealDirection ? r.dir : Lr.getAttackDir(!0, !0, !0)) + r.dirPlus;
                        r.skinRot += .002 * vt, Jr.save(), Jr.globalAlpha = st.botSids.has(r.sid) ? .8 : 1, Jr.translate(r.x - e, r.y - i), Jr.rotate(l), W.toggles.renderShadows && (Jr.shadowBlur = 10, Jr.shadowColor = "rgb(0, 0, 0, .6)"), this.renderPlayer(r, Jr), Jr.restore(), r.sid != Lr.playerSID || W.toggles.renderRealDirection || (Jr.save(), Jr.rotate(r.dir - Math.PI / 18 / 2), Jr.beginPath(), Jr.strokeStyle = "white", Jr.arc(0, 0, r.scale, 0, Math.PI / 18), Jr.stroke(), Jr.restore())
                    }
                }
            }
        }, {
            key: "updateGame",
            value: function() {
                var e = this,
                    i = Date.now();
                if (W.toggles.mouseless || (!this.lastSent || i - this.lastSent >= 1e3 / t.clientSendRate) && (this.lastSent = i, or.sendAim(Lr.getAttackDir(!0))), this.deathTextScale < 120 && (this.deathTextScale += .1 * vt, diedText.style.fontSize = Math.min(Math.round(this.deathTextScale), 120) + "px"), er) {
                    var n = Fr.getDistance({
                            x: this.camX,
                            y: this.camY
                        }, {
                            x: er.x,
                            y: er.y
                        }),
                        r = Fr.getDirection({
                            x: er.x,
                            y: er.y
                        }, {
                            x: this.camX,
                            y: this.camY
                        }),
                        l = Math.min(.01 * n * vt, n);
                    n > .05 ? (this.camX += l * Math.cos(r), this.camY += l * Math.sin(r)) : (this.camX = er.x, this.camY = er.y)
                } else fr.cam.x += .67 * Math.cos(fr.cam.dir) * vt, fr.cam.y += .67 * Math.sin(fr.cam.dir) * vt, (fr.cam.x <= 0 || fr.cam.x >= t.mapScale) && (fr.cam.x = Math.random() * t.mapScale, fr.cam.dir = Math.random() * Math.PI * 2), (fr.cam.y <= 0 || fr.cam.y >= t.mapScale) && (fr.cam.y = Math.random() * t.mapScale, fr.cam.dir = Math.random() * Math.PI * 2), this.camX = fr.cam.x, this.camY = fr.cam.y;
                for (var d = i - 1e3 / t.serverUpdateRate, o = 0; o < rr.length + ir.length; o++) {
                    var a = rr[o] || ir[o - rr.length];
                    if (a && a.visible)
                        if (a.forcePos) a.x = a.x2, a.y = a.y2, a.dir = a.d2;
                        else {
                            var s = a.t2 - a.t1,
                                y = (d - a.t1) / s;
                            a.dt += vt;
                            var u = Math.min(1.7, a.dt / 170),
                                p = a.x2 - a.x1;
                            a.x = a.x1 + p * u, p = a.y2 - a.y1, a.y = a.y1 + p * u, a.dir = Math.lerpAngle(a.d2, a.d1, Math.min(1.2, y))
                        }
                }
                var c = this.maxScreenWidth,
                    h = this.maxScreenHeight,
                    x = this.camX - c / 2,
                    m = this.camY - h / 2,
                    g = W.toggles.setMMNHack1VisualsPreset;
                if (W.toggles.hyperOptim ? (Jr.fillStyle = "#ffff00", Jr.fillRect(0, 0, c, h)) : t.snowBiomeTop - m <= 0 && t.mapScale - t.snowBiomeTop - m >= h ? (Jr.fillStyle = g ? "#fff" : "#b6db66", Jr.fillRect(0, 0, c, h)) : t.mapScale - t.snowBiomeTop - m <= 0 ? (Jr.fillStyle = g ? "#fff" : "#dbc666", Jr.fillRect(0, 0, c, h)) : t.snowBiomeTop - m >= h ? (Jr.fillStyle = g ? "#00f" : "#fff", Jr.fillRect(0, 0, c, h)) : t.snowBiomeTop - m >= 0 ? (Jr.fillStyle = g ? "#00f" : "#fff", Jr.fillRect(0, 0, c, t.snowBiomeTop - m), Jr.fillStyle = g ? "#fff" : "#b6db66", Jr.fillRect(0, t.snowBiomeTop - m, c, h - (t.snowBiomeTop - m))) : (Jr.fillStyle = g ? "#fff" : "#b6db66", Jr.fillRect(0, 0, c, t.mapScale - t.snowBiomeTop - m), Jr.fillStyle = g ? "#fff" : "#dbc666", Jr.fillRect(0, t.mapScale - t.snowBiomeTop - m, c, h - (t.mapScale - t.snowBiomeTop - m))), this.waterMult += this.waterPlus * t.waveSpeed * vt, this.waterMult >= t.waveMax ? (this.waterMult = t.waveMax, this.waterPlus = -1) : this.waterMult <= 1 && (this.waterMult = this.waterPlus = 1), Jr.globalAlpha = 1, Jr.fillStyle = "#dbc666", this.renderWaterBodies(m, Jr, t.riverPadding), Jr.fillStyle = g ? "#ffff00" : "#91b2db", this.renderWaterBodies(m, Jr, 250 * (this.waterMult - 1)), W.toggles.renderGrids) {
                    var v, b, w = W.toggles.gridRenderingPower;
                    for (Jr.lineWidth = 4, Jr.strokeStyle = "#000", Jr.globalAlpha = .06, Jr.beginPath(), v = -this.camX; v < c; v += h / w) v > 0 && (Jr.moveTo(v, 0), Jr.lineTo(v, h));
                    for (b = -this.camY; b < h; b += h / w) v > 0 && (Jr.moveTo(0, b), Jr.lineTo(c, b));
                    Jr.stroke()
                }
                Jr.globalAlpha = 1, Jr.strokeStyle = Vi.outlineColor, this.renderGameObjects(-1, x, m), Jr.globalAlpha = 1, Jr.lineWidth = Vi.outlineWidth, this.renderProjectiles(0, x, m), this.renderPlayers(x, m, 0), Jr.globalAlpha = 1;
                for (var S = 0; S < ir.length; S++) {
                    var P = ir[S];
                    P.active && P.visible && (P.animate(vt), Jr.save(), Jr.translate(P.x - x, P.y - m), Jr.rotate(P.dir + P.dirPlus - Math.PI / 2), W.toggles.renderShadows && (Jr.shadowBlur = 10, Jr.shadowColor = "rgb(0, 0, 0, .6)"), this.renderAI(P, Jr), Jr.restore())
                }
                if (this.renderGameObjects(0, x, m), this.renderProjectiles(1, x, m), this.renderGameObjects(1, x, m), this.renderPlayers(x, m, 1), ft.render(Jr, vt, 0), this.renderGameObjects(2, x, m), this.renderGameObjects(3, x, m), W.toggles.renderBuildingHealth) {
                    Jr.globalAlpha = 1;
                    for (var I = 0; I < nr.length; I++) {
                        var T = nr[I];
                        T.active && T.currentHealth && T.health != T.currentHealth && Fr.getDistance(T, er) <= 400 && (Jr.fillStyle = Vi.darkOutlineColor, Jr.roundRect(T.x + T.xWiggle - x - t.healthBarWidth / 2 - t.healthBarPad, T.y + T.yWiggle - m - t.healthBarPad, t.healthBarWidth + 2 * t.healthBarPad, 17, 8), Jr.fill(), Jr.fillStyle = Lr.playerSID == T.owner.sid ? "#8ecc51" : Fr.isAlly(T.owner.sid) ? "#ffff00" : "#cc5151", Jr.roundRect(T.x + T.xWiggle - x - t.healthBarWidth / 2, T.y + T.yWiggle - m, t.healthBarWidth * (Math.max(0, T.currentHealth) / T.health), 17 - 2 * t.healthBarPad, 7), Jr.fill())
                    }
                }
                if (W.toggles.renderPlacements) {
                    Jr.globalAlpha = 1;
                    for (var D = 0; D < me.markers.length; D++) {
                        var O = me.markers[D];
                        if (O) {
                            if (Jr.save(), O.isPreplace ? Jr.globalAlpha = 1 : Jr.globalAlpha = 15 == O.id ? .45 : .75, Jr.translate(O.x - x, O.y - m), Jr.rotate(O.angle), O.isPreplace) Jr.fillStyle = 15 == O.id ? "rgba(0, 255, 255, .45)" : "rgba(255, 0, 0, .45)", Vi.renderCircle(0, 0, O.scale, Jr, !0);
                            else {
                                var E = Vi.getItemSprite(O);
                                Jr.drawImage(E, -E.width / 2, -E.height / 2)
                            }
                            Jr.restore()
                        }
                    }
                }
                if (Jr.fillStyle = "#000", Jr.globalAlpha = .09, x <= 0 && Jr.fillRect(0, 0, -x, h), t.mapScale - x <= c) {
                    var M = Math.max(0, -m);
                    Jr.fillRect(t.mapScale - x, M, c - (t.mapScale - x), h - M)
                }
                if (m <= 0 && Jr.fillRect(-x, 0, c + x, -m), t.mapScale - m <= h) {
                    var j = Math.max(0, -x),
                        C = 0;
                    t.mapScale - x <= c && (C = c - (t.mapScale - x)), Jr.fillRect(j, t.mapScale - m, c - j - C, h - (t.mapScale - m))
                }
                if (Jr.globalAlpha = 1, W.toggles.hyperOptim || (Jr.fillStyle = "rgba(0, 0, 70, ".concat(W.toggles.renderDarkOverlay ? .65 : .35, ")"), Jr.fillRect(0, 0, c, h)), Jr.strokeStyle = Vi.darkOutlineColor, W.toggles.renderAutoPushLine && ne.data && !ne.data.stop) {
                    var A = ne.data;
                    if (Jr.save(), Jr.globalAlpha = 1, Jr.lineWidth = 6, ne.pathData) {
                        Jr.strokeStyle = "#00ffff", Jr.beginPath();
                        for (var B = 0; B < ne.pathData.length - 1; B++) {
                            var L = ne.pathData[B],
                                R = ne.pathData[B + 1];
                            Jr.moveTo(L.x - x, L.y - m), Jr.lineTo(R.x - x, R.y - m)
                        }
                        Jr.stroke()
                    } else Jr.strokeStyle = "#fff", Jr.beginPath(), Jr.moveTo(er.x - x, er.y - m), Jr.lineTo(A.first.x - x, A.first.y - m), Jr.lineTo(A.last.x - x, A.last.y - m), Jr.stroke();
                    Jr.restore()
                }
                if (W.toggles.renderBuildingSid) {
                    Jr.globalAlpha = 1;
                    for (var H = 0; H < nr.length; H++) {
                        var N, G = nr[H],
                            _ = G.x + G.xWiggle - x,
                            F = G.y + G.yWiggle - m;
                        G.active && "number" == typeof(null === (N = G.owner) || void 0 === N ? void 0 : N.sid) && bt(_, F, G.scale + (G.blocker || 0)) && (Jr.textAlign = "center", Jr.fillStyle = Lr.playerSID == G.owner.sid ? "#8ecc51" : Fr.isAlly(G.owner.sid) ? "#ffff00" : "#cc5151", Jr.lineJoin = "round", Jr.font = "15px Hammersmith One", Jr.strokeStyle = Vi.darkOutlineColor, Jr.lineWidth = 6, Jr.strokeText(G.owner.sid, _, F + (G.scale - 10)), Jr.fillText(G.owner.sid, _, F + (G.scale - 10)))
                    }
                }
                if (Jt.grid) {
                    Jr.globalAlpha = 1;
                    for (var z = 0; z < Jt.grid.length; z++) {
                        var U = Jt.grid[z];
                        Jr.save(), Jr.translate(U.x - x, U.y - m), Jr.fillStyle = U.path ? "rgb(0, 255, 0, .4)" : U.wall ? "rgb(255, 255, 255, .2)" : "rgb(0, 0, 0, .2)", Vi.renderRect(0, 0, 20, 20, Jr, !0), Jr.restore()
                    }
                }
                Jt.spikeKB && (Jr.save(), Jr.translate(Jt.spikeKB.x - x, Jt.spikeKB.y - m), Jr.fillStyle = "rgb(0, 0, 0, .4)", Vi.renderCircle(0, 0, 35, Jr, !0, !1), Jr.restore()), Mi.update(vt, Jr, x, m);
                for (var V = function() {
                        var i = rr[q] || ir[q - rr.length];
                        if (i && i.visible) {
                            var n = (i.team ? "[" + i.team + "] " : "") + (i.name || "");
                            if (!i.isPlayer || !st.botSids.has(i.sid)) {
                                if (W.toggles.renderNames && "" != n && (Jr.font = (i.nameScale || 30) + "px Hammersmith One", Jr.fillStyle = W.toggles.hyperOptim ? "#f00" : "#fff", Jr.textBaseline = "middle", Jr.textAlign = "center", Jr.lineWidth = i.nameScale ? 11 : 8, Jr.lineJoin = "round", Jr.strokeText(n, i.x - x, i.y - m - i.scale - t.nameY), Jr.fillText(n, i.x - x, i.y - m - i.scale - t.nameY)), W.toggles.renderNames && i.isLeader && e.iconSprites.crown.isLoaded) {
                                    var r = t.crownIconScale,
                                        l = i.x - x - r / 2 - Jr.measureText(n).width / 2 - t.crownPad;
                                    Jr.drawImage(e.iconSprites.crown, l, i.y - m - i.scale - t.nameY - r / 2 - 5, r, r)
                                }
                                if (W.toggles.renderNames && 1 == i.iconIndex && e.iconSprites.skull.isLoaded) {
                                    var d = t.crownIconScale,
                                        o = i.x - x - d / 2 + Jr.measureText(n).width / 2 + t.crownPad;
                                    Jr.drawImage(e.iconSprites.skull, o, i.y - m - i.scale - t.nameY - d / 2 - 5, d, d)
                                }
                                if (i.isPlayer && Jt.enemies.nearest && i.sid == Jt.enemies.nearest.sid)
                                    if (("OneTick" == ai.autoaim || ki.status) && e.iconSprites.crosshair.isLoaded) {
                                        var a = 2 * t.playerScale - 10;
                                        Jr.drawImage(e.iconSprites.crosshair, i.x - x - a / 2, i.y - m - a / 2, a, a)
                                    } else if (ai.ATOS && e.iconSprites.atos.isLoaded) {
                                    var s = 2 * t.playerScale - 10;
                                    Jr.drawImage(e.iconSprites.atos, i.x - x - s / 2, i.y - m - s / 2, s, s)
                                }
                            }
                            if (i.health > 0) {
                                if (i.isPlayer) {
                                    if (Qt && i.manageReloads(vt), !st.botSids.has(i.sid) && W.toggles.renderReloadingBars) {
                                        if (i.reloads[i.secondaryWeapon] > 0) {
                                            var y = 1 - i.reloads[i.secondaryWeapon] / f.weapons[i.secondaryWeapon].speed;
                                            Jr.fillStyle = Vi.darkOutlineColor, Jr.roundRect(i.x - x + 2 - t.healthBarPad, i.y - m + i.scale + t.nameY - 13, 47 + 2 * t.healthBarPad, 17, 10), Jr.fill(), Jr.fillStyle = "#a5974c", Jr.roundRect(i.x - x + 2, i.y - m + i.scale + t.nameY - 13 + t.healthBarPad, 47 * y, 16 - 2 * t.healthBarPad, 10), Jr.fill()
                                        }
                                        if (i.reloads[i.primaryWeapon] > 0) {
                                            var u = 1 - i.reloads[i.primaryWeapon] / f.weapons[i.primaryWeapon].speed;
                                            Jr.fillStyle = Vi.darkOutlineColor, Jr.roundRect(i.x - x - 50 - t.healthBarPad, i.y - m + i.scale + t.nameY - 13, 47 + 2 * t.healthBarPad, 17, 10), Jr.fill(), Jr.fillStyle = "#a5974c", Jr.roundRect(i.x - x - 50, i.y - m + i.scale + t.nameY - 13 + t.healthBarPad, 47 * u, 16 - 2 * t.healthBarPad, 10), Jr.fill()
                                        }
                                    }
                                    var p = k.users.find((function(e) {
                                        return e.sid == i.sid
                                    }));
                                    if (p && p.sid != Lr.playerSID) {
                                        var c = p.name.slice(0, 15) + (p.name.length > 15 ? "..." : "");
                                        Jr.textAlign = "center", Jr.fillStyle = "#f00", Jr.lineJoin = "round", Jr.font = "15px Hammersmith One", Jr.strokeStyle = Vi.darkOutlineColor, Jr.lineWidth = 6, Jr.strokeText(c, i.x - x, i.y - m - i.scale - t.nameY + 20), Jr.fillText(c, i.x - x, i.y - m - i.scale - t.nameY + 20)
                                    }
                                    i.isPlayer && (!st.botSids.has(i.sid) && W.toggles.renderShamecount && (Jr.textAlign = "center", Jr.fillStyle = W.toggles.hyperOptim ? "#f00" : "#fff", Jr.lineJoin = "round", Jr.font = "18px Hammersmith One", Jr.strokeStyle = Vi.darkOutlineColor, Jr.lineWidth = 7, Jr.strokeText(Boolean(_l[16] && i.sid == Lr.playerSID) || i.shameCount, i.x - x, i.y - m + i.scale + t.nameY + 30), Jr.fillText(Boolean(_l[16] && i.sid == Lr.playerSID) || i.shameCount, i.x - x, i.y - m + i.scale + t.nameY + 30)), (W.toggles.renderSid || st.botSids.has(i.sid)) && (Jr.textAlign = "center", Jr.fillStyle = W.toggles.hyperOptim ? "#f00" : "#fff", Jr.lineJoin = "round", Jr.font = "18px Hammersmith One", Jr.strokeStyle = Vi.darkOutlineColor, Jr.lineWidth = 7, Jr.strokeText(i.sid, i.x - x, i.y - m), Jr.fillText(i.sid, i.x - x, i.y - m)), !st.botSids.has(i.sid) && W.toggles.renderPacketCounter && i.sid == Lr.playerSID && (Jr.textAlign = "center", Jr.fillStyle = W.toggles.hyperOptim ? "#f00" : "#fff", Jr.lineJoin = "round", Jr.font = "16px Hammersmith One", Jr.strokeStyle = Vi.darkOutlineColor, Jr.lineWidth = 7, Jr.strokeText(or.packets, i.x - x, i.y - m - i.scale - t.nameY - 22.5), Jr.fillText(or.packets, i.x - x, i.y - m - i.scale - t.nameY - 22.5)))
                                }
                                i.isPlayer && st.botSids.has(i.sid) || (Jr.fillStyle = Vi.darkOutlineColor, Jr.roundRect(i.x - x - t.healthBarWidth - t.healthBarPad, i.y - m + i.scale + t.nameY, 2 * t.healthBarWidth + 2 * t.healthBarPad, 17, 7), Jr.fill(), Jr.fillStyle = i == er || i.team && i.team == er.team ? "#8ecc51" : "#cc5151", Jr.roundRect(i.x - x - t.healthBarWidth, i.y - m + i.scale + t.nameY + t.healthBarPad, 2 * t.healthBarWidth * (i.health / i.maxHealth), 17 - 2 * t.healthBarPad, 6), Jr.fill())
                            }
                        }
                    }, q = 0; q < rr.length + ir.length; q++) V();
                for (var X = 0; X < rr.length; X++) {
                    var Y = rr[X];
                    if (Y.visible)
                        for (var K = 0; K < Y.chatMessages.length; K++) {
                            var Z = Y.chatMessages[K];
                            Z && (this.renderChat(Y, Z, x, m, K), Z.duration <= 0 && Y.chatMessages.splice(K, 1))
                        }
                }
                ft.render(Jr, vt, 1), this.renderMinimap(vt), Li.animate(vt), this.LOADING_BAR_BACKGROUND_DELAY -= vt, !Te.LOADED && !Te.ERROR && Qt && this.LOADING_BAR_BACKGROUND_DELAY <= 0 && (this.LOADING_BAR_BACKGROUND_DELAY = 1e3 / 9, Cl.style.backgroundImage = 'url("'.concat(Qr.toDataURL(), '")'))
            }
        }, {
            key: "renderChat",
            value: function(e, i, t, n, r) {
                i.duration -= vt, Jr.font = "28px Hammersmith One";
                var l = Jr.measureText(i.msg);
                Jr.textBaseline = "middle", Jr.textAlign = "center";
                var d = e.x - t;
                null == i.add && (i.add = 0);
                var o = 44 * r;
                i.add < o ? i.add += o / 100 * vt : i.add = o;
                var a = e.y - e.scale - n - 90 - i.add,
                    s = l.width + 17,
                    y = e.sid == Lr.playerSID && W.toggles.renderPacketCounter ? -2 : 0;
                Jr.fillStyle = W.toggles.hyperOptim ? "#0000ff" : "rgba(0, 0, 0, 0.2)", Jr.roundRect(d - s / 2, a - 18.5 + (y || 10), s, 37, 6), Jr.fill(), Jr.fillStyle = i.color, Jr.fillText(i.msg, d, a + (y || 10))
            }
        }, {
            key: "renderMinimap",
            value: function(e) {
                if (er) {
                    el.clearRect(0, 0, $r.width, $r.height), el.strokeStyle = "#fff", el.lineWidth = 4;
                    for (var i = 0; i < lr.length; i++) lr[i].update(el, e);
                    if (el.globalAlpha = 1, el.fillStyle = "#fff", Vi.renderCircle(er.x / t.mapScale * $r.width, er.y / t.mapScale * $r.height, 7, el, !0), (er.team || Br) && this.minimapData)
                        for (var n = 0; n < this.minimapData.length;) el.fillStyle = "rgba(255, 255, 255, 0.35)", Vi.renderCircle(this.minimapData[n] / t.mapScale * $r.width, this.minimapData[n + 1] / t.mapScale * $r.height, 7, el, !0), n += 2;
                    if (k.userLocations.length)
                        for (var r = 0; r < k.userLocations.length; r++) {
                            var l = k.userLocations[r];
                            l && l.sid != er.sid && (el.globalAlpha = 1, el.fillStyle = "#ffff00", Vi.renderCircle(l.x / t.mapScale * $r.width, l.y / t.mapScale * $r.height, 7, el, !0))
                        }
                    st.botSids.size && st.botSids.entries().forEach((function(e) {
                        el.globalAlpha = 1, el.strokeStyle = "#ff0000", Vi.renderCircle(e[1].x / t.mapScale * $r.width, e[1].y / t.mapScale * $r.height, 7, el, !1, !0)
                    })), Lr.lastDeath && (el.fillStyle = "#fc5553", el.font = "34px Hammersmith One", el.textBaseline = "middle", el.textAlign = "center", el.fillText("x", Lr.lastDeath.x / t.mapScale * $r.width, Lr.lastDeath.y / t.mapScale * $r.height))
                }
            }
        }, {
            key: "doUpdate",
            value: function() {
                vt = Date.now() - this.lastUpdate, this.lastUpdate = Date.now(), this.fpsCount++, this.lastFpsUpdate -= vt, this.lastFpsUpdate <= 0 && (this.lastFpsUpdate = 1e3, this.fps = this.fpsCount, this.fpsCount = 0), pingDisplay.innerText = "Ping: ".concat(Lr.pingTimeDisplay, " ms | FPS: ").concat(this.fps), this.updateGame(vt), window.requestAnimationFrame((function() {
                    e.doUpdate()
                }))
            }
        }, {
            key: "loadIcons",
            value: function() {
                for (var e = ["crown", "skull", "atos", "crosshair"], i = 0; i < e.length; i++) {
                    var t = new Image;
                    t.onload = function() {
                        this.isLoaded = !0
                    }, t.src = "atos" == e[i] ? "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/1200px-Crosshairs_Red.svg.png" : "crosshair" == e[i] ? "https://i.imgur.com/0bpFKDO.png" : location.hostname.includes("moomoo") ? "../../img/icons/".concat(e[i], ".png") : "https://dev.moomoo.io/img/icons/".concat(e[i], ".png"), this.iconSprites[e[i]] = t
                }
            }
        }])
    }();

    function kt(e) {
        return kt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, kt(e)
    }

    function St(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Pt(n.key), n)
        }
    }

    function Pt(e) {
        var i = function(e) {
            if ("object" != kt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != kt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == kt(i) ? i : i + ""
    }
    mt(wt, "volcanoSprite", {
        lava: null,
        land: null,
        animationTime: 0,
        x: 13960,
        y: 13960
    }), mt(wt, "iconSprites", {}), mt(wt, "camX", 0), mt(wt, "camY", 0), mt(wt, "fps", 0), mt(wt, "fpsCount", 0), mt(wt, "lastFpsUpdate", 1e3), mt(wt, "waterMult", 1), mt(wt, "waterPlus", 0), mt(wt, "lastUpdate", 0), mt(wt, "deathTextScale", 99999), mt(wt, "maxScreenWidth", t.maxScreenWidth), mt(wt, "maxScreenHeight", t.maxScreenHeight), mt(wt, "minimapData", []), mt(wt, "projectileSprites", {}), mt(wt, "aiSprites", {}), mt(wt, "toolSprites", {}), mt(wt, "accessSprites", {}), mt(wt, "accessPointers", {}), mt(wt, "skinSprites", {}), mt(wt, "skinPointers", {}), mt(wt, "lastSent", 0), mt(wt, "LOADING_BAR_BACKGROUND_DELAY", 1e3 / 9);
    var It = function() {
        return function(e, i, t) {
            return t && St(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "do",
            value: function(e) {
                if (W.toggles.spiekTick && [5, 4].includes(er.weapons[0]) && !(oe.getReload(er, er.weapons[0]) < 1 || "reverse" == e && oe.getReload(er, er.weapons[1]) < 1)) {
                    var i = Jt.enemies.nearest;
                    if (i && !i.trapData) {
                        var t = f.weapons[er.weapons[0]];
                        Fr.getDistance(i, er) - 63 > t.range || ai.autoaim || (ai.autoaim = !0, "reverse" == e || (console.log("ERM"), or.storeEquip(7), Jt.weaponIndex = er.weapons[0], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAutoGather(), or.sendAim(Jt.enemies.angle), ai.addQueue((function() {
                            ai.addQueue((function() {
                                ai.autoaim = !1, or.sendAutoGather()
                            }))
                        }))))
                    }
                }
            }
        }, {
            key: "locateAngle",
            value: function(e) {
                var i = f.list[er.items[2]],
                    t = [],
                    n = [e, e + Fr.toRad(15), e + Fr.toRad(30), e - Fr.toRad(15), e - Fr.toRad(30)];
                t.push(me.calculatePosition(er, i + 30, n[0])), t.push(me.calculatePosition(er, i + 30, n[1])), t.push(me.calculatePosition(er, i + 30, n[2])), t.push(me.calculatePosition(er, i + 30, n[3])), t.push(me.calculatePosition(er, i + 30, n[4]));
                for (var r = 0; r < t.length; r++) {
                    var l = t[r];
                    if (nn.checkItem(l.x, l.y, er.items[2], i + 30)) return n[r]
                }
                return !1
            }
        }, {
            key: "main",
            value: function() {
                if (Jt.enemies.nearest && W.toggles.spiekTick && !ne.data) {
                    var e = Jt.enemies.nearest;
                    if (e.trapData && 5 == er.weapons[0] && 10 == er.weapons[1] && !(er.primaryVariant <= 1 || oe.getReload(er, er.weapons[0]) < 1 || oe.getReload(er, er.weapons[1]) < 1 || Fr.getDistance(e.trapData, er) - 50 > f.weapons[10].range || e.trapData.currentHealth - oe.getObjDamage(er, 10, er.secondaryVariant) > 0)) {
                        var i = this.locateAngle(Jt.enemies.angle);
                        "number" == typeof i && (ai.autoaim = "reverse spiekticking", or.storeEquip(40), Jt.weaponIndex = er.weapons[1], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAutoGather(), or.sendAim(Jt.enemies.angle), ai.addQueue((function() {
                            ai.addQueue((function() {
                                or.storeEquip(7), Jt.weaponIndex = er.weapons[0], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.sendAim(Jt.enemies.angle), jt.place(er.items[2], i), me.addUsedAngle(new Qe(me.calculatePosition(er, 35 + f.list[er.items[2]].scale - 5, i), i, "spike", er.items[2])), ai.addQueue((function() {
                                    ai.autoaim = !1, or.sendAutoGather()
                                }))
                            }))
                        })))
                    }
                }
            }
        }])
    }();

    function Tt(e) {
        return Tt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Tt(e)
    }

    function Dt(e) {
        return function(e) {
            if (Array.isArray(e)) return Ot(e)
        }(e) || function(e) {
            if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
        }(e) || function(e, i) {
            if (e) {
                if ("string" == typeof e) return Ot(e, i);
                var t = {}.toString.call(e).slice(8, -1);
                return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? Ot(e, i) : void 0
            }
        }(e) || function() {
            throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }()
    }

    function Ot(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function Et(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Mt(n.key), n)
        }
    }

    function Mt(e) {
        var i = function(e) {
            if ("object" != Tt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Tt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Tt(i) ? i : i + ""
    }
    var jt = function() {
        return function(e, i, t) {
            return t && Et(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "place",
            value: function(e) {
                var i = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Lr.getAttackDir(!1, !0),
                    t = arguments.length > 2 ? arguments[2] : void 0,
                    n = f.list[e];
                if (n && (Br || er.itemCounts[n.group.id] + 1 < (Xl() ? n.group.sandboxLimit + 1 || 100 : n.group.limit) || !er.itemCounts[n.group.id]) && (or.selectToBuild(e), or.sendHit(1, i), or.selectToBuild(Jt.weaponIndex, !0), e > 2)) {
                    var r = 35 + n.scale + (n.placeOffset || 0),
                        l = er.x2 + Math.cos(i) * r,
                        d = er.y2 + Math.sin(i) * r;
                    me.addMarker({
                        x: l,
                        y: d,
                        scale: n.scale,
                        name: n.name,
                        angle: i,
                        id: n.id,
                        isPreplace: t
                    })
                }
            }
        }, {
            key: "checkPlace",
            value: function(e) {
                var i = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Lr.getAttackDir(!1, !0),
                    t = f.list[e];
                if (t) {
                    var n = t.scale,
                        r = 35 + n + (t.placeOffset || 0),
                        l = er.x2 + Math.cos(i) * r,
                        d = er.y2 + Math.sin(i) * r;
                    nn.checkItem(l, d, e, n) && this.place(e, i)
                }
            }
        }, {
            key: "markCheckPlace",
            value: function(e) {
                var i = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Lr.getAttackDir(!1, !0),
                    t = arguments.length > 2 && void 0 !== arguments[2] && arguments[2],
                    n = f.list[e];
                if (n) {
                    var r = n.scale,
                        l = 35 + r + (n.placeOffset || 0),
                        d = er.x2 + Math.cos(i) * l,
                        o = er.y2 + Math.sin(i) * l;
                    me.checkMarkers(d, o, r) && this.place(e, i, t)
                }
            }
        }, {
            key: "markAndObjCheckPlace",
            value: function(e) {
                var i = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Lr.getAttackDir(!1, !0),
                    t = f.list[e];
                if (t) {
                    var n = t.scale,
                        r = 35 + n + (t.placeOffset || 0),
                        l = er.x2 + Math.cos(i) * r,
                        d = er.y2 + Math.sin(i) * r;
                    me.checkMarkers(l, d, n) && nn.checkItem(l, d, e, n) && this.place(e, i)
                }
            }
        }, {
            key: "autoMills",
            value: function() {
                if (Fr.getDistance(this.mills, er) > 99) {
                    var e = "number" == typeof Gi.globalPathAngle ? Gi.globalPathAngle : Gi.lastMoveDir;
                    this.mills.status && "number" == typeof e && (er.itemCounts[3] < (Xl() ? 299 : 99) || !er.itemCounts[3] ? (this.checkPlace(er.items[3], e + Math.PI), this.checkPlace(er.items[3], e - 4.345869833589793), this.checkPlace(er.items[3], e + 4.345869833589793)) : this.mills.status = !1), this.mills.x = er.x2 || 0, this.mills.y = er.y2 || 0
                }
            }
        }, {
            key: "hotkeys",
            value: function() {
                "chatbox" != document.activeElement.id.toLowerCase() && (_l[70] && er.items[4] && this.markAndObjCheckPlace(er.items[4]), _l[72] && er.items[5] && this.markAndObjCheckPlace(er.items[5]), _l[86] && this.markAndObjCheckPlace(er.items[2]), _l[78] && this.markAndObjCheckPlace(er.items[3]))
            }
        }, {
            key: "autoplace",
            value: function() {
                if (me.usedAngles = me.usedAngles.filter((function(e) {
                        return Jt.tick - e.tick < 6 && Fr.getDistance(er, e) <= e.item.scale + 20
                    })), !W.toggles.autoGrind && W.toggles.autoPlace && Jt.enemies.nearest && !this.mills.status && 15 == er.items[4] && "reverse spiekticking" != ai.autoaim) {
                    var e = Jt.enemies.nearest;
                    if (!(Fr.getDistance(e, er) > W.toggles.autoPlaceRange)) {
                        var i = Je.find("autoplace"),
                            t = i.traps,
                            n = i.spikes,
                            r = i.bestSpike,
                            l = i.bestTrap;
                        if (t.length || n.length) {
                            !(r && r.grade > 0) || l.canPush && l.reTrap && r.into || (r.priority ? (this.markCheckPlace(er.items[2], r.angle), r.placed = !0, me.addUsedAngle(r)) : (r.placed = !0, this.markCheckPlace(er.items[2], r.angle), me.addUsedAngle(r))), (l && l.grade > 0 && !(r && r.grade > 0 && Fr.getDistance(r, l) <= 50 + r.item.scale && J.withinPath(r)) || l.canPush || l.reTrap && !r.into) && (l.priority ? (this.markCheckPlace(l.id, l.angle), l.placed = !0, me.addUsedAngle(l)) : (l.placed = !0, this.markCheckPlace(l.id, l.angle), me.addUsedAngle(l)));
                            var d = [].concat(Dt(t), Dt(n));
                            d = d.sort((function(e, i) {
                                return i.grade == e.grade && e.trap != i.trap ? e.trap ? -1 : 1 : i.grade - e.grade
                            }));
                            for (var o = [], a = 0, s = function() {
                                    var e = d[y];
                                    if (o.some((function(i) {
                                            return Fr.getDistance(i, e) <= e.item.scale + i.item.scale
                                        })) || (o.push(e), a++), a >= 4) return 1
                                }, y = 0; y < d.length && !s(); y++);
                            for (var u = 0; u < o.length; u++) {
                                var p = o[u];
                                if (f.list[p.id]) {
                                    if (or.packets > 90) break;
                                    this.markCheckPlace(p.id, p.angle), me.addUsedAngle(p)
                                } else alert("Error with placement id (autoplacer)")
                            }
                        }
                    }
                }
            }
        }, {
            key: "autoreplace",
            value: function() {
                var e = Jt.enemies.nearest;
                if (15 == er.items[4] && e && !(W.toggles.autoGrind || Fr.getDistance(e, er) > W.toggles.autoReplaceRange || "reverse spiekticking" == ai.autoaim)) {
                    var i = Je.find("autoreplace"),
                        t = i.traps,
                        n = i.spikes,
                        r = i.bestSpike,
                        l = i.bestTrap;
                    if (t.length || n.length) {
                        var d = !1;
                        !(r && r.grade > 0 && me.checkMarkers(r.x, r.y, r.item.scale)) || l.canPush && l.reTrap && r.into || (er.trapData || !r.spiketick || d || (d = !0, It.do()), r.placePriority, r.placed = !0, this.place(er.items[2], r.angle), me.addUsedAngle(r)), (l && l.grade > 0 && me.checkMarkers(l.x, l.y, 50) && !(r && r.grade > 0 && Fr.getDistance(r, l) <= 50 + r.item.scale && J.withinPath(r)) || l.canPush || l.reTrap && !r.into) && (l.placePriority, l.placed = !0, this.place(er.items[4], l.angle), me.addUsedAngle(l));
                        var o = [].concat(Dt(t), Dt(n)),
                            a = [],
                            s = 0;
                        o = o.sort((function(e, i) {
                            return i.grade == e.grade && e.trap != i.trap ? e.trap ? -1 : 1 : i.grade - e.grade
                        }));
                        for (var y = function() {
                                var e = o[u];
                                if (me.checkMarkers(e.x, e.y, e.item.scale) && !a.some((function(i) {
                                        return Fr.getDistance(i, e) <= e.item.scale + i.item.scale
                                    })) && (a.push(e), s++), s >= 4) return 1
                            }, u = 0; u < o.length && !y(); u++);
                        for (var p = 0; p < a.length; p++) {
                            var c = a[p];
                            if (f.list[c.id]) {
                                if (!er.trapData && c.spiketick && !d) {
                                    It.do();
                                    break
                                }
                            } else alert("Error with placement id")
                        }
                        for (var h = 0; h < a.length; h++) {
                            var x = a[h];
                            f.list[x.id] ? (this.place(x.id, x.angle), me.addUsedAngle(x)) : alert("Error with placement id")
                        }
                    }
                }
            }
        }, {
            key: "main",
            value: function() {
                this.hotkeys(), this.autoMills(), this.autoplace()
            }
        }])
    }();

    function Ct(e) {
        return Ct = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Ct(e)
    }

    function At(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Bt(n.key), n)
        }
    }

    function Bt(e) {
        var i = function(e) {
            if ("object" != Ct(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Ct(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Ct(i) ? i : i + ""
    }! function(e, i, t) {
        (i = Mt(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(jt, "mills", {
        status: !1,
        x: 0,
        y: 0
    });
    var Lt = function() {
        return function(e, i, t) {
            return t && At(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "main",
            value: function() {
                if (W.toggles.selectFastestWpn) {
                    var e = er.weapons[0],
                        i = er.weapons[1],
                        t = oe.getReload(er, er.weapons[0]);
                    oe.getReload(er, er.weapons[1]) < 1 ? (this.reloaded = !0, Jt.weaponIndex = i, er.weaponIndex != i && or.selectToBuild(i, 1)) : t < 1 ? (this.reloaded = !0, Jt.weaponIndex = e, er.weaponIndex != e && or.selectToBuild(e, 1)) : this.reloaded && (this.reloaded = !1, 10 == i && [4, 5].includes(e) ? (Jt.weaponIndex = i, er.weaponIndex != i && or.selectToBuild(i, 1)) : (Jt.weaponIndex = e, er.weaponIndex != e && or.selectToBuild(e, 1)))
                }
            }
        }])
    }();

    function Rt(e) {
        return Rt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Rt(e)
    }

    function Ht(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Nt(n.key), n)
        }
    }

    function Nt(e) {
        var i = function(e) {
            if ("object" != Rt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Rt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Rt(i) ? i : i + ""
    }! function(e, i, t) {
        (i = Bt(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(Lt, "reloaded", !1);
    var Wt = function() {
        return function(e, i, t) {
            return t && Ht(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "adjustedDistance",
            value: function(e, i, t) {
                var n = "player" == t ? -63 : "object" == t ? null == i ? void 0 : i.scale : 0;
                return Fr.getDistance(e, i) + n
            }
        }, {
            key: "deceleration",
            value: function(e) {
                if (isNaN(e) || e == 1 / 0) return null;
                for (var i = e; i >= .5;) e += i *= Math.pow(.993, t.serverUpdateSpeed);
                return e
            }
        }, {
            key: "getPredictedDistance",
            value: function(e, i) {
                var n = t.serverUpdateSpeed - Lr.pingTime,
                    r = f.weapons[er.weaponIndex],
                    l = G.hats.find((function(e) {
                        return e.id == er.skinIndex
                    })),
                    d = G.accessories.find((function(e) {
                        return e.id == er.tailIndex
                    })),
                    o = (er.buildIndex >= 0 ? .5 : 1) * (r.spdMult || 1) * (l && l.spdMult || 1) * (d && d.spdMult || 1) * (er.y2 <= t.snowBiomeTop ? l && l.coldM ? 1 : t.snowSpeed : 1),
                    a = {
                        x: i ? 0 : er.x2,
                        y: i ? 0 : er.y2
                    },
                    s = Math.cos(e),
                    y = Math.sin(e),
                    u = Math.sqrt(s * s + y * y);
                0 != u && (s /= u, y /= u);
                var p = Fr.getDistance({
                        x: 0,
                        y: 0
                    }, {
                        x: 0 * n,
                        y: 0 * n
                    }),
                    c = Math.min(3, Math.max(1, Math.round(p / 40))),
                    h = 1 / c;
                return a.x += s * er.speed * o * (!!i * n) * n * h * c, a.y += y * er.speed * o * (!!i * n) * n * h * c, i ? Fr.getDistance(a, {
                    x: 0,
                    y: 0
                }) : a
            }
        }, {
            key: "calculatePosition",
            value: function(e, i, t) {
                return null == i ? {
                    x: e.x2 || e.x,
                    y: e.y2 || e.y
                } : {
                    x: (e.x2 || e.x) + Math.cos(i) * t,
                    y: (e.y2 || e.y) + Math.sin(i) * t
                }
            }
        }, {
            key: "main",
            value: function(e) {
                if (W.toggles.autoBrake && null != e && "number" == typeof e && !_l[16])
                    for (var i = Jt.closeObjects.filter((function(e) {
                            return e && (e.dmg && !Fr.isFriendly(e.owner.sid) || e.teleport || e.boostSpeed)
                        })).sort((function(e, i) {
                            return Fr.getDistance(e, er) - Fr.getDistance(i, er)
                        })), t = 0; t < i.length; t++) {
                        var n = i[t],
                            r = 1 == n.type ? .6 * n.scale + 40 : n.teleport ? n.scale * (Fr.getDistance(er.vel, er) <= 4 ? 1 : .75) + 40 : n.scale + 40,
                            l = this.getPredictedDistance(e),
                            d = [this.calculatePosition(er, e, this.deceleration(Fr.getDistance(er.vel, er))), this.calculatePosition(er, e, this.deceleration(Fr.getDistance(l, er)))],
                            o = 10 == er.weapons[1] ? 75 : f.weapons[er.weapons[0]].range;
                        if (this.adjustedDistance(d[0], n) < r || this.adjustedDistance(d[1], n) < r || (this.adjustedDistance(er, n, "object") < o || this.adjustedDistance(er.vel, n, "object") < o) && withinScale && 1 != n.type) return (n.trap || n.boostSpeed || n.teleport || n.dmg) && Qi.targetQueue.push(n), "stop"
                    }
            }
        }])
    }();

    function Gt(e) {
        return Gt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Gt(e)
    }

    function _t(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function Ft(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ut(n.key), n)
        }
    }

    function zt(e, i, t) {
        return (i = Ut(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Ut(e) {
        var i = function(e) {
            if ("object" != Gt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Gt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Gt(i) ? i : i + ""
    }
    var Vt = [20, 35, 45, 30],
        qt = function() {
            return function(e, i, t) {
                return t && Ft(e, t), Object.defineProperty(e, "prototype", {
                    writable: !1
                }), e
            }((function e() {
                ! function(e, i) {
                    if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
                }(this, e)
            }), 0, [{
                key: "doTurretTargetLineMath",
                value: function(e) {
                    var i = ir.filter((function(i) {
                            return i.visible && i.hostile && Fr.getDistance(i, e) <= 600
                        })).sort((function(i, t) {
                            return Fr.getDistance(i, e) - Fr.getDistance(t, e)
                        }))[0],
                        t = rr.filter((function(i) {
                            return i.visible && e.sid != i.sid && i.sid != Lr.playerSID && !(i.team && i.team == e.team) && Fr.getDistance(i, e) <= 600
                        })).sort((function(i, t) {
                            return Fr.getDistance(i, e) - Fr.getDistance(t, e)
                        }))[0],
                        n = i;
                    if (i ? t && Fr.getDistance(t, e) <= Fr.getDistance(i, e) && (n = t) : n = t, n) {
                        var r = Fr.getDirection(n, e);
                        if (Fr.getDistance(er, e) <= Fr.getDistance(n, e)) {
                            var l = Fr.getDistance(er, e),
                                d = {
                                    x: e.x2 + Math.cos(r) * l,
                                    y: e.y2 + Math.sin(r) * l
                                };
                            if (Fr.getDistance(er, d) <= 60) return !0
                        }
                    }
                    return !1
                }
            }, {
                key: "heal",
                value: function(e) {
                    for (var i = 0 == er.items[0] ? 20 : 1 == er.items[0] ? 40 : 30, t = Math.ceil(e / i), n = 0; n < t; n++) or.selectToBuild(er.items[0]), or.sendHit(1, Lr.getAttackDir()), or.selectToBuild(Jt.weaponIndex, !0)
                }
            }, {
                key: "start0ShameHeal",
                value: function(e, i) {
                    var t = this;
                    if (2 == e) {
                        var n = Jt.closeObjects.find((function(e) {
                            return e && e.dmg > 20 && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) <= e.scale + 50
                        }));
                        n ? Jt.nextTick((function() {
                            t.heal(i)
                        })) : this.healingDelay = 2
                    } else {
                        var r = Jt.closeObjects.find((function(e) {
                            return e && e.dmg > 20 && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(e, er) <= e.scale + 50
                        }));
                        r && 1 == e && er.health - r.dmg > 0 ? this.healingDelay = 2 : Jt.nextTick((function() {
                            t.heal(i)
                        }))
                    }
                }
            }, {
                key: "autoHealing",
                value: function() {
                    this.healingDelay > 0 && (this.healingDelay--, this.healingDelay <= 0 && (this.healingDelay = 0, this.heal(100 - er.health))), this.damages = []
                }
            }, {
                key: "doPreciseValues",
                value: function(e, i) {
                    return e - i < .01 && e - i > 0 ? i : e
                }
            }, {
                key: "soldierRound",
                value: function(e, i) {
                    return 6 == er.skinIndex ? this.doPreciseValues(.75 * e, i) : this.doPreciseValues(e)
                }
            }, {
                key: "findCachedDamage",
                value: function(e, i, t) {
                    var n = this.cachedDamages.get("".concat(e, ":").concat(i));
                    if (!n) {
                        n = [];
                        for (var r = [1, 1.5, 1.2], l = [1, .2], d = 0; d < r.length; d++)
                            for (var o = 0; o < l.length; o++) n.push(t * r[d] * l[o]);
                        this.cachedDamages.set("".concat(e, ":").concat(i), function(e) {
                            return function(e) {
                                if (Array.isArray(e)) return _t(e)
                            }(e) || function(e) {
                                if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
                            }(e) || function(e, i) {
                                if (e) {
                                    if ("string" == typeof e) return _t(e, i);
                                    var t = {}.toString.call(e).slice(8, -1);
                                    return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _t(e, i) : void 0
                                }
                            }(e) || function() {
                                throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                            }()
                        }(n))
                    }
                    return n
                }
            }, {
                key: "checkIfUserCanOnetick",
                value: function(e) {
                    var i = e.primaryWeapon,
                        t = e.primaryVariant;
                    return 1.5 * oe.getDamage(i, t) + 25 + (3 == t ? 5 : 0) >= 100
                }
            }, {
                key: "fitsPalette",
                value: function(e, i) {
                    for (var t = i.primaryWeapon, n = i.primaryVariant, r = oe.getDamage(t, n), l = this.findCachedDamage(t, n, r), d = 0; d < l.length; d++)
                        if (this.soldierRound(l[d], e) == e) return "primary";
                    var o = i.secondaryWeapon;
                    if (f.weapons[i.secondaryWeapon].projectile) {
                        var a = oe.getDamage(o, 0);
                        if (this.soldierRound(a, e) == e) return "secondary"
                    } else
                        for (var s = i.secondaryVariant, y = oe.getDamage(o, s), u = this.findCachedDamage(o, s, y), p = 0; p < u.length; p++)
                            if (this.soldierRound(u[p], e) == e) return "secondary";
                    return this.soldierRound(25, e) == e && "turret"
                }
            }, {
                key: "checkForSpikePlacements",
                value: function() {
                    for (var e = Jt.enemies.near, i = e.length, t = [], n = Math.PI / 16, r = 2 * Math.PI, l = 0; l < i; l++)
                        for (var d, o = e[l], a = (null === (d = o.spikeType) || void 0 === d ? void 0 : d.id) || 9, s = f.list[a], y = 35 + s.scale + (s.placeOffset || 0), u = 35 + s.scale, p = 0; p <= r; p += n) {
                            var c = me.calculatePosition(o, y, p);
                            if (nn.checkItem(c.x, c.y, a, s.scale) && (Fr.getDistance(c, er) <= u || Fr.getDistance(er.vel, c) <= u)) {
                                t.push({
                                    enemy: o,
                                    dmg: s.dmg
                                });
                                break
                            }
                        }
                    return t.sort((function(e, i) {
                        return i.dmg - e.dmg
                    }))[0] || !1
                }
            }, {
                key: "spiekKB",
                value: function(e, i) {
                    if (er.trapData) return 0;
                    var t = ti.melee(e, er, i),
                        n = Jt.closeObjects.filter((function(e) {
                            return e && e.dmg && !Fr.isFriendly(e.owner.sid) && Fr.getDistance(t, e) <= 35 + e.scale
                        })).reduce((function(e, i) {
                            return e + i.dmg
                        }), 0);
                    return n
                }
            }, {
                key: "checkCanOneTick",
                value: function(e) {
                    var i = e.primaryWeapon,
                        t = e.primaryVariant;
                    return 1.5 * oe.getDamage(i, t) + 25 + (3 == t ? 5 : 0) >= 100
                }
            }, {
                key: "interpretDamage",
                value: function() {
                    for (var e = this, i = Jt.enemies.near, t = i.length, n = [], r = new Map, l = new Map, d = function() {
                            for (var d = e.damages[o], a = !1, s = 0; s < t; s++) {
                                var y = {
                                        canEMP: !0,
                                        potDamage: 0,
                                        done: !1
                                    },
                                    u = i[s];
                                if (!r.has(u.sid)) {
                                    var p = e.fitsPalette(d, u);
                                    if (p) {
                                        var c = u.primaryWeapon,
                                            h = u.secondaryWeapon,
                                            x = oe.getDamage(c, u.primaryVariant),
                                            m = oe.getDamage(h, u.secondaryVariant),
                                            g = oe.getReload(u, c),
                                            v = oe.getReload(u, h),
                                            b = oe.getReload(u, 53);
                                        if ("primary" == p) {
                                            if (oe.hasHit(u, c)) {
                                                if (v > .7) {
                                                    y.potDamage += m;
                                                    var w = e.spiekKB(h, u);
                                                    w && (y.potDamage += w, y.spike = !0)
                                                }
                                                b > .7 && (y.potDamage += 25), !e.doTurretTargetLineMath(u) && f.weapons[h].projectile || (y.canEMP = !1), y.done = !0
                                            }
                                        } else if ("secondary" == p) {
                                            if (y.canEMP = !1, oe.hasHit(u, h)) {
                                                if (g > .7) {
                                                    y.potDamage += 1.5 * x, 11 == u.tailIndex && (x *= .2);
                                                    var k = e.spiekKB(c, u);
                                                    k && (y.potDamage += k, y.spike = !0)
                                                }
                                                10 == u.secondaryWeapon && (y.potDamage += 25), y.done = !0
                                            }
                                        } else if (oe.hasHit(u, 53) && !f.weapons[h].projectile && oe.hasHit(u, h)) {
                                            if (g > .7) {
                                                y.potDamage += 1.5 * x;
                                                var S = e.spiekKB(c, u);
                                                S && (y.potDamage += S, y.spike = !0)
                                            }
                                            e.checkCanOneTick(u) && mi.resetForcedAddOn(mi.forceAddIndexs.otSoldier), y.done = !0
                                        }
                                        if (y.done) {
                                            n.push(y), r.set(u.sid, 1), a = !0;
                                            break
                                        }
                                    }
                                }
                            }
                            if (a) return 1;
                            var P = Vt.find((function(e) {
                                return e == d || e == d / .75
                            }));
                            if (P && er.trapData) {
                                for (var I = 0, T = Jt.closeObjects.filter((function(e) {
                                        return e && e.dmg == P && !Fr.isFriendly(e.owner.sid) && !l.has(e.sid)
                                    })).map((function(e) {
                                        return {
                                            obj: e,
                                            distance: Fr.getDistance(e, er)
                                        }
                                    })).sort((function(e, i) {
                                        return e.distance - i.distance
                                    })).map((function(e) {
                                        return e.obj
                                    })), D = function() {
                                        var e = i[O],
                                            t = T.find((function(i) {
                                                return i.owner.sid == e.sid
                                            })),
                                            r = n.find((function(i) {
                                                return i.sid == e.sid
                                            }));
                                        if (t) {
                                            var d = e.primaryWeapon,
                                                o = oe.getReload(e, d),
                                                a = 1.5 * oe.getDamage(d, e.primaryVariant);
                                            if (11 == e.tailIndex && (a *= .2), o + 111 / f.weapons[d].speed >= 1) {
                                                if (!r) return l.set(t.sid, !0), I += a, 0;
                                                if (r.potDamage < a) return l.set(t.sid, !0), r.potDamage = a, 0
                                            }
                                        }
                                    }, O = 0; O < t && 0 !== D(); O++);
                                n.push({
                                    canEMP: !1,
                                    spike: !0,
                                    potDamage: P + I
                                })
                            }
                        }, o = 0; o < this.damages.length; o++) d();
                    if (W.toggles.sensitiveHealing) {
                        if (!er.trapData) {
                            var a = Jt.closeObjects.filter((function(e) {
                                return e.active && e.dmg && Fr.getDistance(er.vel, e) <= 35 + e.scale && !Fr.isFriendly(e.owner.sid) && !l.has(e.sid)
                            })).reduce((function(e, i) {
                                return e + i.dmg
                            }), 0);
                            n.push({
                                canEMP: !1,
                                spike: !0,
                                potDamage: a
                            })
                        }
                        var s = this.checkForSpikePlacements();
                        if (s) {
                            var y = n.find((function(e) {
                                    return e.sid == s.enemy.sid
                                })),
                                u = s.enemy,
                                p = u.primaryWeapon,
                                c = u.primaryVariant,
                                h = 1.5 * oe.getDamage(p, c),
                                x = oe.getReload(u, p);
                            y ? (y.spike = !0, y.canEMP = !1, 1 == x && h + s.dmg > y.potDamage && (y.potDamage = h + s.dmg)) : n.push({
                                canEMP: !1,
                                spike: !0,
                                potDamage: s.dmg + (1 == x ? h : 0)
                            })
                        }
                    }
                    return n
                }
            }, {
                key: "validate",
                value: function(e, i, t) {
                    if ("emp" != e || Br) {
                        if (er.health - i <= 1) return !1;
                        if (!er.skins[6]) return !1;
                        if (er.trapData && t) {
                            var n = Qi.getBestWeapon(!0),
                                r = oe.getReload(er, n);
                            if (10 == n && 1 == r) return !1
                        }
                    } else {
                        if (!er.skins[22]) return !1;
                        if (6 != er.skinIndex) return !1;
                        if (er.health - (i - 25) <= 1) return !1;
                        if (mi.onlySoldier()) return !1
                    }
                    return !0
                }
            }, {
                key: "main",
                value: function() {
                    var e = this;
                    if (this.damages.length) {
                        var i = 100 - er.health;
                        if (Jt.enemies.near.length) {
                            var t = this.interpretDamage(),
                                n = t.reduce((function(e, i) {
                                    return e + i.potDamage
                                }), 0) + (7 == er.skinIndex ? 5 : 0),
                                r = t.every((function(e) {
                                    return e.canEMP
                                })),
                                l = t.some((function(e) {
                                    return e.spike
                                }));
                            er.health - n <= 0 ? W.toggles.soldierEMP && r && this.validate("emp", n) ? mi.addForcedAddOnValue(mi.forceAddIndexs.onlyEMP, 1, (function() {
                                e.heal(i)
                            })) : this.validate("soldier", .75 * n, l) ? mi.addForcedAddOnValue(mi.forceAddIndexs.onlySoldier, 1, (function() {
                                e.heal(i)
                            })) : er.shameCount < 7 ? this.heal(i) : this.start0ShameHeal(!0, i) : this.start0ShameHeal(2, i)
                        } else this.start0ShameHeal(!0, i)
                    }
                    this.autoHealing()
                }
            }, {
                key: "antiSpikeTick",
                value: function(e) {
                    "object" == Gt(this.checkForSpikePlacements()) && er.trapData && er.trapData.sid == e.sid && mi.addForcedAddOnValue(mi.forceAddIndexs.trapSoldier, 2)
                }
            }])
        }();

    function Xt(e) {
        return Xt = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Xt(e)
    }

    function Yt(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Zt(n.key), n)
        }
    }

    function Kt(e, i, t) {
        return (i = Zt(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Zt(e) {
        var i = function(e) {
            if ("object" != Xt(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Xt(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Xt(i) ? i : i + ""
    }
    zt(qt, "damages", []), zt(qt, "healingDelay", 0), zt(qt, "cachedDamages", new Map);
    var Qt = !0;
    window.onblur = function() {
        Qt = !1
    }, window.onfocus = function() {
        if (Qt = !0, er)
            for (var e = 0; e < rr.length; e++) Lr.playerSID != rr[e].sid && rr[e].resetReloads()
    };
    var Jt = function() {
        function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }
        return function(e, i, t) {
            return t && Yt(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }(e, 0, [{
            key: "updateCursor",
            value: function() {
                var e = Hl / window.innerWidth,
                    i = Nl / window.innerHeight,
                    t = e * wt.maxScreenWidth,
                    n = i * wt.maxScreenHeight,
                    r = wt.maxScreenWidth / 2,
                    l = wt.maxScreenHeight / 2,
                    d = Math.atan2(n - l, t - r),
                    o = Math.hypot(n - l, t - r);
                this.cursorLocation.x = (er ? er.x2 : 0) + Math.cos(d) * o, this.cursorLocation.y = (er ? er.y2 : 0) + Math.sin(d) * o
            }
        }, {
            key: "nextTick",
            value: function(e) {
                "function" == typeof e && this.nextQueue.push(e)
            }
        }, {
            key: "tickOut",
            value: function(e, i) {
                "function" == typeof e && ("object" == Xt(this.tickQueue[this.tick + i]) ? this.tickQueue[this.tick + i].push(e) : this.tickQueue[this.tick + i] = [e])
            }
        }, {
            key: "checkTraps",
            value: function() {
                for (var e = this, i = function() {
                        var i, n = e.enemies.all[t] || er;
                        n && (i = n.sid == Lr.playerSID ? e.closeObjects.find((function(e) {
                            return e && e.active && e.trap && Fr.getDistance(n, e) <= 50 && !Fr.isFriendly(e.owner.sid)
                        })) : e.closeObjects.find((function(e) {
                            return e && e.active && e.trap && Fr.getDistance(n, e) <= 50 && Fr.isFriendly(e.owner.sid)
                        })), n.lastTrapData = !!n.trapData, n.trapData = i || void 0)
                    }, t = 0; t < this.enemies.all.length + 1; t++) i()
            }
        }, {
            key: "attackOnce",
            value: function() {
                or.sendAutoGather(), this.nextTick((function() {
                    or.sendAutoGather()
                }))
            }
        }, {
            key: "main",
            value: function() {
                var i = this;
                if (this.tickSpeed = Date.now() - this.lastTickUpdate, this.lastTickUpdate = Date.now(), ne.data && ne.pathData)
                    for (var t = function() {
                            var e = i.closeObjects[n];
                            if (e && e.active && !e.ignoreCollision && ne.pathData.find((function(i) {
                                    return Fr.getDistance(e, i) <= e.getScale()
                                }))) return ne.pathData = null, ne.pathIndx = -1, ne.pathId = -1, 1
                        }, n = 0; n < this.closeObjects.length && !t(); n++);
                if (this.enemies.all.length && (this.enemies.all = this.enemies.all.sort((function(e, i) {
                        return Fr.getDistance(e, er) - Fr.getDistance(i, er)
                    })), this.enemies.nearest = this.enemies.all[0], this.enemies.angle = Fr.getDirection(this.enemies.nearest, er)), this.tickQueue[this.tick] && this.tickQueue[this.tick].forEach((function(e) {
                        return e()
                    })), this.nextQueue.forEach((function(e) {
                        return e()
                    })), this.nextQueue = [], Qi.target = null, ki.movementDir = void 0, _e.main(), qt.main(), mi.main(), this.checkTraps(), It.main(), jt.main(), ai.main(), ne.main(), Gi.stopData = Wt.main(ne.data ? ne.data.stop ? null : ne.data.dir : "number" == typeof Gi.globalPathAngle ? Gi.globalPathAngle : Gi.lastMoveDir), ai.autoaim);
                else if (W.toggles.autoBreak && er.trapData) Qi.main();
                else {
                    var r = 1 == oe.getReload(er, er.weapons[0]) && 1 == oe.getReload(er, 53);
                    if (ai.data) "reverse" == ai.data.insta ? ai.start("reverse") : ai.bullHit();
                    else if (ki.status && !ne.data && r) ki.main();
                    else if (Date.now() - ki.last >= 2500 && r && this.enemies.nearest && W.toggles.autoOneTick && !ne.data && 5 == er.weapons[0] && er.primaryVariant >= 2 && Math.abs(Fr.getDistance(this.enemies.nearest, er) - 225) < 20 && (W.toggles.oneTickIgnoreSoldier || 6 != this.enemies.nearest.skinIndex && 22 != this.enemies.nearest.skinIndex)) ki.main(!0);
                    else if (W.toggles.autoHitSpike && ai.canAutoPushHit()) ai.bullHit(!0);
                    else if (Qi.tankSpam) {
                        var l = Qi.getBestWeapon();
                        this.weaponIndex = l, er.weaponIndex != l && or.selectToBuild(l, !0), 1 == oe.getReload(er, l) ? (or.storeEquip(40), this.attackOnce()) : mi.default()
                    } else if (W.toggles.autoGrind) {
                        var d = Math.PI / 4;
                        er.items[5] && (jt.checkPlace(er.items[5], Lr.getAttackDir(!0, !0) + d), jt.checkPlace(er.items[5], Lr.getAttackDir(!0, !0) - d)), 1 == oe.getReload(er, e.weaponIndex) ? (or.storeEquip(40), this.attackOnce()) : mi.default()
                    } else if (Wl) ai.bullHit();
                    else if (Qi.objBreaking()) {
                        var o = Qi.getBestWeapon();
                        this.weaponIndex = o, er.weaponIndex != o && or.selectToBuild(o, !0), 1 == oe.getReload(er, o) ? (or.storeEquip(40), this.attackOnce()) : mi.default()
                    } else Lt.main(), mi.default()
                }
                Gi.main();
                var a = Lr.getAttackDir();
                "number" == typeof a && or.sendAim(a), this.ownerBuildings = nr.filter((function(e) {
                    return e && (e.trap || e.dmg) && e.owner.sid == Lr.playerSID && Fr.getDistance(e, er) >= W.toggles.botBreakingRadius
                })), this.updateCursor(), this.buildingsHit = []
            }
        }])
    }();

    function $t(e) {
        return $t = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, $t(e)
    }

    function en(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, tn(n.key), n)
        }
    }

    function tn(e) {
        var i = function(e) {
            if ("object" != $t(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != $t(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == $t(i) ? i : i + ""
    }
    Kt(Jt, "weaponIndex", 0), Kt(Jt, "tick", 0), Kt(Jt, "tickQueue", []), Kt(Jt, "nextQueue", []), Kt(Jt, "closeObjects", []), Kt(Jt, "buildingsHit", []), Kt(Jt, "enemies", {
        all: [],
        nearest: null,
        near: [],
        angle: 0
    }), Kt(Jt, "cursorLocation", {
        x: 0,
        y: 0
    }), Kt(Jt, "tickSpeed", t.serverUpdateSpeed), Kt(Jt, "lastTickUpdate", 0);
    var nn = function() {
        return function(e, i, t) {
            return t && en(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "add",
            value: function(e, i, t, n, r, l, d, o, a) {
                for (var s, y = 0; y < nr.length; y++) {
                    var u = nr[y];
                    if (u.sid == e) {
                        s = u;
                        break
                    }
                }
                if (!s)
                    for (var p = 0; p < nr.length; p++)
                        if (!nr[p].active) {
                            s = nr[p];
                            break
                        } s || (s = new T(e), nr.push(s)), o && Fr.objectsMaps.sidToObject.set(e, s), o && (s.sid = e), s.init(i, t, n, r, l, d, a), A.addObject(s)
            }
        }, {
            key: "checkItem",
            value: function(e, i, n, r, l) {
                if (18 != n && i >= t.mapScale / 2 - t.riverWidth / 2 && i <= t.mapScale / 2 + t.riverWidth / 2) return !1;
                for (var d = 0; d < Jt.closeObjects.length; d++) {
                    var o = Jt.closeObjects[d];
                    if (o && o.active && l != o) {
                        var a = o.blocker ? o.blocker : o.getScale(.6, o.isItem);
                        if (Fr.getDistance({
                                x: e,
                                y: i
                            }, o) < a + r) return !1
                    }
                }
                return !0
            }
        }, {
            key: "checkItemPlacement",
            value: function(e, i, n, r) {
                var l = arguments.length > 4 && void 0 !== arguments[4] && arguments[4],
                    d = [],
                    o = [];
                if (18 != n && i >= t.mapScale / 2 - t.riverWidth / 2 && i <= t.mapScale / 2 + t.riverWidth / 2) return !1;
                for (var a = 0; a < Jt.closeObjects.length; a++) {
                    var s = Jt.closeObjects[a];
                    if (s && s.active) {
                        var y = s.blocker ? s.blocker : s.getScale(.6, s.isItem);
                        Fr.getDistance({
                            x: e,
                            y: i
                        }, s) < y + r && (d.push(s.breakPotential), o.push(s))
                    }
                }
                return l ? o : 0 == d.length ? [!0] : !d.includes(!1) && d
            }
        }, {
            key: "disableBySid",
            value: function(e) {
                var i = Fr.findObjectBySID(e);
                if (i) {
                    var t = nr.findIndex((function(e) {
                        return e && i.sid == e.sid
                    }));
                    Fr.objectsMaps.sidToObject.delete(e), A.removeObject(i), nr.splice(t, 1)
                }
            }
        }, {
            key: "removeAllItems",
            value: function(e) {
                for (var i = 0; i < nr.length; i++) {
                    var t = nr[i];
                    t && t.active && t.owner && t.owner.sid == e && (Fr.objectsMaps.sidToObject.delete(t.sid), A.removeObject(t), nr.splice(i, 1), i--)
                }
            }
        }, {
            key: "checkCollision",
            value: function(e, i) {
                var t = (e.x2 || e.x) - i.x,
                    n = (e.y2 || e.y) - i.y,
                    r = 35 + i.scale;
                return (Math.abs(t) <= r || Math.abs(n) <= r) && (r = 35 + (i.getScale ? i.getScale() : i.scale), Math.sqrt(t * t + n * n) - r <= 0)
            }
        }])
    }();

    function rn(e) {
        return rn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, rn(e)
    }

    function ln(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, dn(n.key), n)
        }
    }

    function dn(e) {
        var i = function(e) {
            if ("object" != rn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != rn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == rn(i) ? i : i + ""
    }
    var on = function() {
        return function(e, i, t) {
            return t && ln(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "buildingDamageText",
            value: function(e, i, t, n) {
                if (W.toggles.renderBuildingDamageText) {
                    var r = e,
                        l = e;
                    if ("player" == i)
                        for (var d = oe.getDamage(t.primaryWeapon, t.primaryVariant), o = oe.getDamage(t.secondaryWeapon, t.secondaryVariant), a = [1, 3.3], s = [d, o], y = function(e) {
                                var i = s[e];
                                if (1 == e && !n.projDmg && t.secondaryWeapon >= 9 && 14 != t.secondaryWeapon && 11 != t.secondaryWeapon && 10 != t.secondaryWeapon) return 1;
                                a.forEach((function(n) {
                                    var d = i * n;
                                    1 == e && 10 == t.secondaryWeapon && (d *= 7.5), d < r && (r = d), d > l && (l = d)
                                }))
                            }, u = 0; u < s.length; u++) y(u);
                    else r = 0;
                    var p, c = (e - r) / (l - r) * 100;
                    if ((c = Math.min(Math.max(c, 0), 100)) >= 50) {
                        var f = Math.round(255 * (1 - (c - 50) / 50));
                        p = "rgb(".concat(255, ", ").concat(f, ", 0)")
                    } else {
                        var h = Math.round(c / 50 * 255);
                        p = "rgb(".concat(h, ", ").concat(255, ", 0)")
                    }
                    Mi.showText({
                        x: n.x,
                        y: n.y - 15
                    }, 500, 20, 0, p, Math.abs(e.toString().includes(".") ? Fr.fixTo(e, 3) : e), {
                        BuildingDmg: !0
                    })
                }
            }
        }])
    }();

    function an(e) {
        return an = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, an(e)
    }

    function sn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, yn(n.key), n)
        }
    }

    function yn(e) {
        var i = function(e) {
            if ("object" != an(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != an(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == an(i) ? i : i + ""
    }
    var un = function() {
        return function(e, i) {
            return i && sn(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e(i) {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e), this.sid = i, this.isAI = !0, this.nameIndex = Fr.randInt(0, t.cowNames.length - 1)
        }), [{
            key: "init",
            value: function(e, i, t, n, r) {
                this.x = e, this.y = i, this.startX = r.fixedSpawn ? e : null, this.startY = r.fixedSpawn ? i : null, this.xVel = 0, this.yVel = 0, this.zIndex = 0, this.dir = t, this.dirPlus = 0, this.index = n, this.src = r.src, this.visible = !1, r.name && (this.name = r.name), this.weightM = r.weightM, this.speed = r.speed, this.killScore = r.killScore, this.turnSpeed = r.turnSpeed, this.scale = r.scale, this.maxHealth = r.health, this.leapForce = r.leapForce, this.health = this.maxHealth, this.chargePlayer = r.chargePlayer, this.viewRange = r.viewRange, this.drop = r.drop, this.dmg = r.dmg, this.hostile = r.hostile, this.dontRun = r.dontRun, this.hitRange = r.hitRange, this.hitDelay = r.hitDelay, this.hitScare = r.hitScare, this.spriteMlt = r.spriteMlt, this.nameScale = r.nameScale, this.colDmg = r.colDmg, this.noTrap = r.noTrap, this.spawnDelay = r.spawnDelay, this.hitWait = 0, this.waitCount = 1e3, this.moveCount = 0, this.targetDir = 0, this.active = !0, this.alive = !0, this.runFrom = null, this.chargeTarget = null, this.dmgOverTime = {}
            }
        }, {
            key: "animate",
            value: function(e) {
                this.animTime > 0 && (this.animTime -= e, this.animTime <= 0 ? (this.animTime = 0, this.dirPlus = 0, this.tmpRatio = 0, this.animIndex = 0) : 0 == this.animIndex ? (this.tmpRatio += e / (this.animSpeed * t.hitReturnRatio), this.dirPlus = Fr.lerp(0, this.targetAngle, Math.min(1, this.tmpRatio)), this.tmpRatio >= 1 && (this.tmpRatio = 1, this.animIndex = 1)) : (this.tmpRatio -= e / (this.animSpeed * (1 - t.hitReturnRatio)), this.dirPlus = Fr.lerp(0, this.targetAngle, Math.max(0, this.tmpRatio))))
            }
        }, {
            key: "startAnim",
            value: function() {
                this.animTime = this.animSpeed = 600, this.targetAngle = .8 * Math.PI, this.tmpRatio = 0, this.animIndex = 0
            }
        }])
    }();

    function pn(e) {
        return pn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, pn(e)
    }

    function cn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, fn(n.key), n)
        }
    }

    function fn(e) {
        var i = function(e) {
            if ("object" != pn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != pn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == pn(i) ? i : i + ""
    }
    var hn = function() {
        return function(e, i, t) {
            return t && cn(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "spawn",
            value: function(e, i, t, n, r) {
                for (var l, d = 0; d < ir.length; d++)
                    if (!ir[d].active) {
                        l = ir[d];
                        break
                    } return l || (l = new un(ir.length), ir.push(l)), Fr.aiSidMap.set(r, l), l.init(e, i, t, n, this.aiTypes[n]), l
            }
        }])
    }();

    function xn(e) {
        return xn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, xn(e)
    }

    function mn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, gn(n.key), n)
        }
    }

    function gn(e) {
        var i = function(e) {
            if ("object" != xn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != xn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == xn(i) ? i : i + ""
    }! function(e, i, t) {
        (i = fn(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(hn, "aiTypes", [{
        id: 0,
        src: "cow_1",
        killScore: 150,
        health: 500,
        weightM: .8,
        speed: 95e-5,
        turnSpeed: .001,
        scale: 72,
        drop: ["food", 50]
    }, {
        id: 1,
        name: "Technoblade",
        src: "pig_1",
        killScore: 200,
        health: 800,
        weightM: .6,
        speed: 85e-5,
        turnSpeed: .001,
        scale: 72,
        drop: ["food", 80]
    }, {
        id: 2,
        name: "Bull",
        src: "bull_2",
        hostile: !0,
        dmg: 20,
        killScore: 1e3,
        health: 1800,
        weightM: .5,
        speed: 94e-5,
        turnSpeed: 74e-5,
        scale: 78,
        viewRange: 800,
        chargePlayer: !0,
        drop: ["food", 100]
    }, {
        id: 3,
        name: "Bully",
        src: "bull_1",
        hostile: !0,
        dmg: 20,
        killScore: 2e3,
        health: 2800,
        weightM: .45,
        speed: .001,
        turnSpeed: 8e-4,
        scale: 90,
        viewRange: 900,
        chargePlayer: !0,
        drop: ["food", 400]
    }, {
        id: 4,
        name: "Wolf",
        src: "wolf_1",
        hostile: !0,
        dmg: 8,
        killScore: 500,
        health: 300,
        weightM: .45,
        speed: .001,
        turnSpeed: .002,
        scale: 84,
        viewRange: 800,
        chargePlayer: !0,
        drop: ["food", 200]
    }, {
        id: 5,
        name: "nerfed duck man",
        src: "chicken_1",
        dmg: 8,
        killScore: 2e3,
        noTrap: !0,
        health: 300,
        weightM: .2,
        speed: .0018,
        turnSpeed: .006,
        scale: 70,
        drop: ["food", 100]
    }, {
        id: 6,
        name: "MOOSTAFA",
        nameScale: 50,
        src: "enemy",
        hostile: !0,
        dontRun: !0,
        fixedSpawn: !0,
        spawnDelay: 6e4,
        noTrap: !0,
        colDmg: 100,
        dmg: 40,
        killScore: 8e3,
        health: 18e3,
        weightM: .4,
        speed: 7e-4,
        turnSpeed: .01,
        scale: 80,
        spriteMlt: 1.8,
        leapForce: .9,
        viewRange: 1e3,
        hitRange: 210,
        hitDelay: 1e3,
        chargePlayer: !0,
        drop: ["food", 100]
    }, {
        id: 7,
        name: "Treasure",
        hostile: !0,
        nameScale: 35,
        src: "crate_1",
        fixedSpawn: !0,
        spawnDelay: 12e4,
        colDmg: 200,
        killScore: 5e3,
        health: 2e4,
        weightM: .1,
        speed: 0,
        turnSpeed: 0,
        scale: 70,
        spriteMlt: 1
    }, {
        id: 8,
        name: "MOOFIE",
        src: "wolf_2",
        hostile: !0,
        fixedSpawn: !0,
        dontRun: !0,
        hitScare: 4,
        spawnDelay: 3e4,
        noTrap: !0,
        nameScale: 35,
        dmg: 10,
        colDmg: 100,
        killScore: 3e3,
        health: 7e3,
        weightM: .45,
        speed: .0015,
        turnSpeed: .002,
        scale: 90,
        viewRange: 800,
        chargePlayer: !0,
        drop: ["food", 1e3]
    }, {
        id: 9,
        name: "Ã°Å¸â€™â‚¬MOOFIE",
        src: "wolf_2",
        hostile: !0,
        fixedSpawn: !0,
        dontRun: !0,
        hitScare: 50,
        spawnDelay: 6e4,
        noTrap: !0,
        nameScale: 35,
        dmg: 12,
        colDmg: 100,
        killScore: 3e3,
        health: 9e3,
        weightM: .45,
        speed: .0015,
        turnSpeed: .0025,
        scale: 94,
        viewRange: 1440,
        chargePlayer: !0,
        drop: ["food", 3e3],
        minSpawnRange: .85,
        maxSpawnRange: .9
    }, {
        id: 10,
        name: "Ã°Å¸â€™â‚¬Wolf",
        src: "wolf_1",
        hostile: !0,
        fixedSpawn: !0,
        dontRun: !0,
        hitScare: 50,
        spawnDelay: 3e4,
        dmg: 10,
        killScore: 700,
        health: 500,
        weightM: .45,
        speed: .00115,
        turnSpeed: .0025,
        scale: 88,
        viewRange: 1440,
        chargePlayer: !0,
        drop: ["food", 400],
        minSpawnRange: .85,
        maxSpawnRange: .9
    }, {
        id: 11,
        name: "Ã°Å¸â€™â‚¬Bully",
        src: "bull_1",
        hostile: !0,
        fixedSpawn: !0,
        dontRun: !0,
        hitScare: 50,
        dmg: 20,
        killScore: 5e3,
        health: 5e3,
        spawnDelay: 1e5,
        weightM: .45,
        speed: .00115,
        turnSpeed: .0025,
        scale: 94,
        viewRange: 1440,
        chargePlayer: !0,
        drop: ["food", 800],
        minSpawnRange: .85,
        maxSpawnRange: .9
    }]);
    var vn = function() {
        return function(e, i) {
            return i && mn(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), [{
            key: "init",
            value: function(e, i, t, n, r, l, d, o, a) {
                this.active = !0, this.indx = e, this.x = i, this.y = t, this.oldX = i, this.oldY = t, this.dir = n, this.skipMov = !0, this.speed = r, this.dmg = l, this.scale = o, this.range = d, this.owner = a
            }
        }, {
            key: "update",
            value: function(e) {
                if (this.active) {
                    var i = this.speed * e;
                    this.skipMov ? this.skipMov = !1 : (this.x += i * Math.cos(this.dir), this.y += i * Math.sin(this.dir), this.range -= i, this.range <= 0 && (this.x += this.range * Math.cos(this.dir), this.y += this.range * Math.sin(this.dir), i = 1, this.range = 0, this.active = !1))
                }
            }
        }])
    }();

    function bn(e) {
        return bn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, bn(e)
    }

    function wn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, kn(n.key), n)
        }
    }

    function kn(e) {
        var i = function(e) {
            if ("object" != bn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != bn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == bn(i) ? i : i + ""
    }
    var Sn = function() {
        return function(e, i, t) {
            return t && wn(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "addProjectile",
            value: function(e, i, t, n, r, l, d, o, a) {
                for (var s, y = f.projectiles[l], u = 0; u < tr.length; ++u)
                    if (!tr[u].active) {
                        s = tr[u];
                        break
                    } return s || ((s = new vn).sid = tr.length, tr.push(s)), s.init(l, e, i, t, r, y.dmg, n, y.scale, d), s.ignoreObj = o, s.layer = a || y.layer, s.src = y.src, s
            }
        }])
    }();

    function Pn(e) {
        return Pn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Pn(e)
    }

    function In(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Tn(n.key), n)
        }
    }

    function Tn(e) {
        var i = function(e) {
            if ("object" != Pn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Pn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Pn(i) ? i : i + ""
    }
    var Dn = function() {
        return function(e, i, t) {
            return t && In(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "main",
            value: function(e) {
                if (W.toggles.autoBuy) {
                    var i = this.shopList[0];
                    if (i) {
                        var t = (i.index ? G.accessories : G.hats).find((function(e) {
                            return e.id == i.id
                        }));
                        if (i.index) {
                            if (er.tails[i.id]) return this.shopList.shift(), void this.main(e);
                            e >= t.price && Ae.send("c", 1, i.id, 1)
                        } else {
                            if (er.skins[i.id]) return this.shopList.shift(), void this.main(e);
                            e >= t.price && Ae.send("c", 1, i.id, 0)
                        }
                    }
                }
            }
        }])
    }();

    function On(e) {
        return On = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, On(e)
    }

    function En(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Mn(n.key), n)
        }
    }

    function Mn(e) {
        var i = function(e) {
            if ("object" != On(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != On(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == On(i) ? i : i + ""
    }! function(e, i, t) {
        (i = Tn(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(Dn, "shopList", [{
        id: 11,
        index: !0
    }, {
        id: 15
    }, {
        id: 6
    }, {
        id: 7
    }, {
        id: 40
    }, {
        id: 53
    }, {
        id: 31
    }, {
        id: 12
    }, {
        id: 22
    }, {
        id: 19,
        index: !0
    }, {
        id: 20
    }]);
    var jn = function() {
        return function(e, i) {
            return i && En(e.prototype, i), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), [{
            key: "init",
            value: function(e, i) {
                this.scale = 0, this.x = e, this.y = i, this.active = !0
            }
        }, {
            key: "update",
            value: function(e, i) {
                this.active && (this.scale += .05 * i, this.scale >= t.mapPingScale ? this.active = !1 : (e.globalAlpha = 1 - Math.max(0, this.scale / t.mapPingScale), e.beginPath(), e.arc(this.x / t.mapScale * mapDisplay.width, this.y / t.mapScale * mapDisplay.width, this.scale, 0, 2 * Math.PI), e.stroke()))
            }
        }])
    }();

    function Cn(e) {
        return Cn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Cn(e)
    }

    function An(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Bn(n.key), n)
        }
    }

    function Bn(e) {
        var i = function(e) {
            if ("object" != Cn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Cn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Cn(i) ? i : i + ""
    }
    var Ln = function() {
        return function(e, i, t) {
            return t && An(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "manage",
            value: function(e) {
                er.weaponXP[er.weaponIndex] || (er.weaponXP[er.weaponIndex] = 0), er.weaponXP[er.weaponIndex] += e, this.update()
            }
        }, {
            key: "clear",
            value: function() {
                for (var e = 0; e <= 16; e++) {
                    var i = document.getElementById("weaponXPActionBar:".concat(e));
                    i && (er.weaponXP[e] = 0, i.style.width = "0%")
                }
            }
        }, {
            key: "update",
            value: function() {
                var e = er.weaponXP[er.weaponIndex],
                    i = document.getElementById("weaponXPActionBar:".concat(er.weaponIndex));
                if (i) {
                    var t = 0,
                        n = 0;
                    e >= 12e3 ? t = 0 : e >= 7e3 ? (t = (e - 7e3) / 5e3 * 100, n = 2) : e >= 3e3 ? (t = (e - 3e3) / 4e3 * 100, n = 1) : e >= 0 && (t = e / 3e3 * 100), i.style.backgroundColor = this.colors[n], i.style.width = "".concat(t, "%")
                }
            }
        }])
    }();

    function Rn(e) {
        return Rn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Rn(e)
    }

    function Hn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Wn(n.key), n)
        }
    }

    function Nn(e, i, t) {
        return (i = Wn(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Wn(e) {
        var i = function(e) {
            if ("object" != Rn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Rn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Rn(i) ? i : i + ""
    }! function(e, i, t) {
        (i = Bn(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t
    }(Ln, "colors", ["#f7cf45", "#86b5ff", "#ff716f", "#b1cc7a"]);
    var Gn = function() {
        return function(e, i, t) {
            return t && Hn(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "init",
            value: function() {
                var e = this;
                setInterval((function() {
                    e.time += 3, k.validated && W.toggles.collectStats && (k.send("addTime", e.time), e.time = 0)
                }), 3e3)
            }
        }, {
            key: "addKills",
            value: function() {
                var e = er.kills - this.kills;
                this.kills = er.kills, W.toggles.collectStats && k.validated && k.send("addKills", e)
            }
        }, {
            key: "addDeath",
            value: function() {
                W.toggles.collectStats && k.validated && k.send("addDeath")
            }
        }])
    }();

    function _n(e) {
        return _n = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, _n(e)
    }

    function Fn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, zn(n.key), n)
        }
    }

    function zn(e) {
        var i = function(e) {
            if ("object" != _n(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != _n(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == _n(i) ? i : i + ""
    }
    Nn(Gn, "kills", 0), Nn(Gn, "time", 0), Nn(Gn, "deaths", 0), Gn.init();
    var Un = function() {
        return function(e, i, t) {
            return t && Fn(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "getE",
            value: function(e) {
                return document.getElementById(e)
            }
        }, {
            key: "reset",
            value: function(e) {
                this.getE("enemyRadar".concat(e)) && (this.getE("enemyRadar".concat(e)).style.display = "none")
            }
        }, {
            key: "main",
            value: function(e) {
                if (W.toggles.renderTracers) {
                    if (!this.getE("enemyRadar".concat(e.sid))) {
                        var i = document.createElement("div");
                        i.id = "enemyRadar".concat(e.sid), i.style = "\n            position: absolute;\n            display: none;\n            left: 0px;\n            top: 0px;\n            color: #fff;\n            width: 0px;\n            height: 0px;\n            border: solid;\n            border-width: 10px 0px 10px 20px;\n            pointer-events: none;\n            border-color: transparent transparent transparent #ffffff;\n            ", document.body.appendChild(i)
                    }
                    var t = this.getE("enemyRadar".concat(e.sid)),
                        n = window.innerWidth / 2,
                        r = window.innerHeight / 2,
                        l = Fr.getDirection(e, er),
                        d = 100 * Math.sqrt(Math.pow(0 - (er.x2 - e.x2), 2) + Math.pow(0 - (er.y2 - e.y2) * (16 / 9), 2)) / (wt.maxScreenHeight / 2) / r,
                        o = n + r * d * Math.cos(l) - 10,
                        a = r + r * d * Math.sin(l) - 10;
                    t.style.borderWidth = "10px 0px 10px 20px", t.style.left = "".concat(o, "px"), t.style.top = "".concat(a, "px"), t.style.opacity = d, t.style.transform = "rotate(".concat(180 * l / Math.PI, "deg)"), t.style.display = "block"
                }
            }
        }])
    }();

    function Vn(e) {
        return Vn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Vn(e)
    }

    function qn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Xn(n.key), n)
        }
    }

    function Xn(e) {
        var i = function(e) {
            if ("object" != Vn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Vn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Vn(i) ? i : i + ""
    }
    var Yn, Kn = function() {
        return function(e, i, t) {
            return t && qn(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "start",
            value: function() {
                if (0 != W.toggles.mapPingSyncType && 1 == W.toggles.mapPingSyncType) {
                    if (11 == er.tailIndex) return;
                    if (!er.skins[7]) return;
                    if (mi.onlySoldier()) return;
                    if (oe.getReload(er, er.weapons[0]) < 1) return;
                    if (ai.autoaim) return;
                    ai.autoaim = !0, ai.addQueue((function() {
                        Jt.weaponIndex = er.weapons[0], er.weaponIndex != Jt.weaponIndex && or.selectToBuild(Jt.weaponIndex, !0), or.storeEquip(7), or.sendAutoGather()
                    })), ai.addQueue((function() {
                        ai.autoaim = !1, or.sendAutoGather()
                    }))
                }
            }
        }])
    }();

    function Zn(e) {
        return Zn = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Zn(e)
    }

    function Qn(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, $n(n.key), n)
        }
    }

    function Jn(e, i, t) {
        return (i = $n(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function $n(e) {
        var i = function(e) {
            if ("object" != Zn(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Zn(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Zn(i) ? i : i + ""
    }
    var er, ir = [],
        tr = [],
        nr = [],
        rr = [],
        lr = [],
        dr = !0,
        or = function() {
            function e() {
                ! function(e, i) {
                    if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
                }(this, e)
            }
            return function(e, i, t) {
                return t && Qn(e, t), Object.defineProperty(e, "prototype", {
                    writable: !1
                }), e
            }(e, 0, [{
                key: "storeEquip",
                value: function(e, i) {
                    if (i) {
                        if (ai.ATOS && 11 == e) return;
                        er.tails[e] && er.tailIndex != e && Ae.send(this.clientToServer.STORE, 0, e, 1)
                    } else mi.onlySoldier() ? 6 != er.skinIndex && Ae.send(this.clientToServer.STORE, 0, 6, 0) : mi.forcedAddOns[mi.forceAddIndexs.onlyEMP] > 0 ? 22 != er.skinIndex && Ae.send(this.clientToServer.STORE, 0, 22, 0) : er.skins[e] && er.skinIndex != e && Ae.send(this.clientToServer.STORE, 0, e, 0)
                }
            }, {
                key: "storeBuy",
                value: function(e, i) {
                    i ? er.tails[e] || Ae.send(this.clientToServer.STORE, 1, e, 1) : er.skins[e] || Ae.send(this.clientToServer.STORE, 1, e, 0)
                }
            }, {
                key: "createAlliance",
                value: function(e) {
                    Ae.send(this.clientToServer.CREATE_CLAN, e || document.getElementById("allianceInput").value)
                }
            }, {
                key: "sendJoin",
                value: function(e) {
                    Ae.send(this.clientToServer.JOIN_CLAN, Lr.alliances[e].sid)
                }
            }, {
                key: "sendUpgrade",
                value: function(e) {
                    e < f.weapons.length && f.weapons[e] && f.weapons[e].type == f.weapons[Jt.weaponIndex].type && (Jt.weaponIndex = e), Ae.send(this.clientToServer.SEND_UPGRADE, e)
                }
            }, {
                key: "sendHit",
                value: function(e, i) {
                    Ae.send(this.clientToServer.SEND_HIT, e, i)
                }
            }, {
                key: "sendAim",
                value: function(e) {
                    Ae.send(this.clientToServer.SEND_AIM, e)
                }
            }, {
                key: "sendAutoGather",
                value: function() {
                    Ae.send(this.clientToServer.AUTO_GATHER, 1)
                }
            }, {
                key: "sendChat",
                value: function(i) {
                    if ("!t" == i) ki.start();
                    else {
                        if ("!fping" == i) return void(this.fakePing = !this.fakePing);
                        if (i.startsWith(".bots ")) {
                            var t = i.split(" ");
                            3 == t.length && ("add" == t[1] ? st.add(parseInt(t[2])) : st.remove(parseInt(t[2])))
                        } else if ("!clear" == i) W.loggerFunction("clear");
                        else if (i.startsWith(".target ")) {
                            var n = message.split(".target ")[1],
                                r = document.getElementById("input:id:botTargetSids");
                            "" == r.value ? r.value = n : r.value.includes(n) || (r.value += ",".concat(n));
                            var l = new Event("change", {
                                bubbles: !0
                            });
                            r.dispatchEvent(l)
                        } else if (i.startsWith(".untarget ")) {
                            var d = message.split(".untarget ")[1],
                                o = document.getElementById("input:id:botTargetSids");
                            o.value = o.value.split(",").filter((function(e) {
                                return e != d
                            })).join(",");
                            var a = new Event("change", {
                                bubbles: !0
                            });
                            o.dispatchEvent(a)
                        } else {
                            if ("!clan" == i && !er.team) {
                                for (var s = "", y = 0, u = 0; u < Fr.randInt(2, 7); u++) s += String.fromCharCode(0);
                                for (; Lr.alliances.find((function(e) {
                                        return e.sid == s
                                    }));) {
                                    s = "";
                                    for (var p = 0; p < Fr.randInt(2, 7); p++) s += String.fromCharCode(0);
                                    if (++y > 10) {
                                        s = Fr.randomString(Math.random(2, 7));
                                        break
                                    }
                                }
                                return void e.createAlliance(s)
                            }
                            if (i.includes("!cfreeze ")) {
                                var c = i.split(" ")[1],
                                    f = i.split(" ")[2];
                                k.send("freeze", c, f || 10)
                            } else if (i.includes("!ckick ")) {
                                var h = i.split(" ")[1];
                                k.send("kick", h)
                            }
                        }
                    }
                    Ae.send(this.clientToServer.SEND_CHAT, i.slice(0, 30))
                }
            }, {
                key: "resetMoveDir",
                value: function() {
                    Object.keys(_l).forEach((function(e) {
                        delete _l[e]
                    })), Ae.send(this.clientToServer.RESET_MOVEMENT_DIR)
                }
            }, {
                key: "moveDir",
                value: function(e) {
                    Ae.send(this.clientToServer.MOVE, e)
                }
            }, {
                key: "killObject",
                value: function(e) {
                    var i = Fr.findObjectBySID(e);
                    if (i && (i.active = !1), i) {
                        var t = Fr.getDistance(er, i);
                        t <= 250 && (Jt.checkTraps(), qt.antiSpikeTick(i)), ne.data && ne.pathData && Fr.getDistance(ne.data.last, i) <= Fr.getDistance(ne.pathData[0], ne.data.last) && (ne.pathData = null, ne.pathIndx = -1, ne.pathId = -1), W.toggles.autoReplace && t <= W.toggles.autoReplaceRange && jt.autoreplace(i), er.trapData == i && (er.trapData = void 0)
                    }
                    nn.disableBySid(e)
                }
            }, {
                key: "killObjects",
                value: function(e) {
                    er && nn.removeAllItems(e)
                }
            }, {
                key: "setAlliancePlayers",
                value: function(e) {
                    Lr.alliancePlayers = e;
                    var i = Lr.allianceNotifications.findIndex((function(e) {
                        return Lr.alliancePlayers.includes(e.sid)
                    }));
                    i >= 0 && (Lr.allianceNotifications.splice(i, 1), Lr.updateNotifications()), "block" == Tl.style.display && Lr.showAllianceMenu()
                }
            }, {
                key: "allianceNotification",
                value: function(e, i) {
                    Lr.allianceNotifications.push({
                        sid: e,
                        name: i
                    }), Lr.updateNotifications()
                }
            }, {
                key: "leaveAlliance",
                value: function() {
                    Lr.allianceNotifications = [], Ae.send(this.clientToServer.LEAVE_CLAN), Lr.updateNotifications()
                }
            }, {
                key: "addAlliance",
                value: function(e) {
                    Lr.alliances.push(e), "block" == Tl.style.display && Lr.showAllianceMenu()
                }
            }, {
                key: "deleteAlliance",
                value: function(e) {
                    for (var i = Lr.alliances.length - 1; i >= 0; i--) Lr.alliances[i].sid == e && Lr.alliances.splice(i, 1);
                    "block" == Tl.style.display && Lr.showAllianceMenu()
                }
            }, {
                key: "remProjectile",
                value: function(e, i) {
                    for (var t = function() {
                            if (tr[n].sid == e) {
                                tr[n].range = i;
                                var t = tr[n].dmg,
                                    r = Jt.buildingsHit;
                                return Jt.buildingsHit = [], Jt.nextTick((function() {
                                    for (var e = 0; e < r.length; e++) {
                                        var i = r[e];
                                        i && i.projDmg && (i.currentHealth -= t)
                                    }
                                })), 1
                            }
                        }, n = 0; n < tr.length && !t(); n++);
                }
            }, {
                key: "addProjectile",
                value: function(e, i, t, n, r, l, d, o) {
                    for (var a, s = {
                            x: e - 70 * Math.cos(t),
                            y: i - 70 * Math.sin(t)
                        }, y = {
                            x: e,
                            y: i
                        }, u = !1, p = 0; p < rr.length; p++) {
                        var c = rr[p];
                        if (c.visible) {
                            var h = f.weapons[c.secondaryWeapon];
                            if (1.5 == r && (Fr.getDistance(c, y) <= 35 || Fr.getDistance({
                                    x: c.x,
                                    y: c.y
                                }, y) <= 35)) {
                                a = c, u = !0;
                                break
                            }
                            if (h && null !== h.projectile && Fr.getDistance(c, s) <= 35) {
                                a = c;
                                break
                            }
                        }
                    }
                    if (a) {
                        var x = Fr.getDirection(er, y);
                        if (u) {
                            a.reloads[53] = 2500, a.turretHit = Jt.tick;
                            var m = f.weapons[a.primaryWeapon];
                            !Fr.isFriendly(a.sid) && qt.checkIfUserCanOnetick(a) && Fr.getAngleDist(t, x) <= .2 && Fr.getDistance(a, er) - 95 <= m.range && mi.addForcedAddOnValue(mi.forceAddIndexs.otSoldier, 3)
                        } else {
                            var g = 1.6 == r ? 9 : 2.5 == r ? 12 : 2 == r ? 13 : 15,
                                v = f.weapons[g];
                            a.reloads[g] = v.speed, a.secondaryWeapon = g, a.secondaryHit = Jt.tick
                        }
                    }
                    Sn.addProjectile(e, i, t, n, r, l, null, null, d).sid = o
                }
            }, {
                key: "updateHealth",
                value: function(e, i) {
                    var n = Fr.findPlayerBySID(e);
                    if (n) {
                        var r = i - n.health;
                        if (r >= 0) {
                            if (n.hitTime) {
                                var l = Date.now() - n.hitTime;
                                n.hitTime = 0, l <= t.serverUpdateSpeed ? n.shameCount++ : n.shameCount = Math.max(0, n.shameCount - 2)
                            }
                        } else n.hitTime = Date.now(), Jt.nextTick((function() {
                            7 == n.skinIndex && (13 == n.tailIndex ? -2 == r && (n.bullTick = Jt.tick - 1) : -5 == r && (n.bullTick = Jt.tick - 1, n.sid == Lr.playerSID && (mi.needTick = 0)))
                        })), -5 == r && (n.bullTick = Jt.tick - 1, mi.needTick = 0), e == Lr.playerSID && qt.damages.push(Math.abs(r));
                        if (n.health = i, i <= 0 && !Fr.isFriendly(e)) {
                            if (W.toggles.toxicMoomooPet) ft.sendChat("XDDDD WHY DIE '".concat(n.name, "'"));
                            else {
                                var d = ["Yay! '".concat(n.name, "' die! :D"), "+1 kill :D"];
                                ft.sendChat(d[Math.floor(Math.random() * d.length)])
                            }
                            W.addLog("death", "", n.name, e)
                        } else if (e == Lr.playerSID && i <= 0)
                            if (W.toggles.toxicMoomooPet) {
                                var o = ["ASS", "DOGSHIT"];
                                ft.sendChat("LMAOOOO YOU ".concat(o[Math.floor(Math.random() * o.length)], " XDDDD"))
                            } else {
                                var a = ["No worry was lag 100%", ":(", "Noooo"];
                                ft.sendChat(a[Math.floor(Math.random() * a.length)])
                            }
                    }
                }
            }, {
                key: "updatePlayerValue",
                value: function(e, i, t) {
                    er && (er[e] = i, Dn.shopList.length && "points" == e && Dn.main(i), t && Lr.updateStatusDisplay())
                }
            }, {
                key: "shootTurret",
                value: function(e, i) {
                    var n = Fr.findObjectBySID(e);
                    n && (n.dir = i, n.xWiggle += t.gatherWiggle * Math.cos(i + Math.PI), n.yWiggle += t.gatherWiggle * Math.sin(i + Math.PI), n.turretReload = 2200)
                }
            }, {
                key: "wiggleGameObject",
                value: function(e, i) {
                    var n = Fr.findObjectBySID(i);
                    n && (n.xWiggle += t.gatherWiggle * Math.cos(e), n.yWiggle += t.gatherWiggle * Math.sin(e), n.currentHealth && Jt.buildingsHit.push(n))
                }
            }, {
                key: "animateAI",
                value: function(e) {
                    var i = Fr.findAIBySID(e);
                    if (i && (i.startAnim(), "MOOSTAFA" == i.name)) {
                        var t = Jt.buildingsHit;
                        Jt.buildingsHit = [], Jt.nextTick((function() {
                            for (var e = 0; e < t.length; e++) {
                                var n = t[e];
                                n && (n.currentHealth -= 232, on.buildingDamageText(232, "AI", i, n))
                            }
                        }))
                    }
                }
            }, {
                key: "loadAI",
                value: function(e) {
                    for (var i = 0; i < ir.length; i++) ir[i].forcePos = !ir[i].visible, ir[i].visible = !1;
                    if (e)
                        for (var n = Date.now(), r = 0; r < e.length;) {
                            var l = Fr.findAIBySID(e[r]);
                            l ? (l.index = e[r + 1], l.t1 = void 0 === l.t2 ? n : l.t2, l.t2 = n, l.x1 = l.x, l.y1 = l.y, l.x2 = e[r + 2], l.y2 = e[r + 3], l.d1 = void 0 === l.d2 ? e[r + 4] : l.d2, l.d2 = e[r + 4], l.health = e[r + 5], l.dt = 0, l.visible = !0) : ((l = hn.spawn(e[r + 2], e[r + 3], e[r + 4], e[r + 1], e[r])).x2 = l.x, l.y2 = l.y, l.d2 = l.dir, l.health = e[r + 5], hn.aiTypes[e[r + 1]].name || (l.name = t.cowNames[e[r + 6]]), l.forcePos = !0, l.sid = e[r], l.visible = !0), r += 7
                        }
                }
            }, {
                key: "loadGameObject",
                value: function(e) {
                    for (var i = 0; i < e.length;) {
                        var t = f.list[e[i + 6]];
                        if (nn.add(e[i], e[i + 1], e[i + 2], e[i + 3], e[i + 4], e[i + 5], t, !0, e[i + 7] >= 0 ? {
                                sid: e[i + 7]
                            } : null), t && t.dmg) {
                            var n = Fr.findPlayerBySID(e[i + 7]);
                            n && e[i] > n.spikeData.sid && (n.spikeData.sid = e[i], n.spikeData.id = e[i + 6])
                        }
                        i += 8
                    }
                    Jt.closeObjects = A.getObjects(er.x2, er.y2), Gi.stopData = Wt.main(ne.data ? ne.data.dir : Gi.lastMoveDir), Gi.main()
                }
            }, {
                key: "updateMinimap",
                value: function(e) {
                    wt.minimapData = e
                }
            }, {
                key: "pingMap",
                value: function(e, i) {
                    for (var t, n = 0; n < lr.length; n++)
                        if (!lr[n].active) {
                            t = lr[n];
                            break
                        } t || (t = new jn, lr.push(t)), t.init(e, i), Fr.getDistance({
                        x: e,
                        y: i
                    }, er) <= 350 && Kn.start()
                }
            }, {
                key: "gatherAnimation",
                value: function(e, i, t) {
                    var n = Fr.findPlayerBySID(e);
                    if (n && (n.startAnim(i, t), n.reloads[t] = f.weapons[t].speed, t < 9 ? n.primaryHit = Jt.tick : n.secondaryHit = Jt.tick, i)) {
                        var r = Jt.buildingsHit;
                        Jt.buildingsHit = [], Jt.nextTick((function() {
                            for (var e = oe.getObjDamage(n, t), i = 0; i < r.length; i++) {
                                var l = r[i];
                                l && (l.currentHealth -= e, on.buildingDamageText(e, "player", n, l))
                            }
                        }))
                    }
                }
            }, {
                key: "updateStoreItems",
                value: function(e, i, t) {
                    t ? e ? er.tailIndex = i : er.tails[i] = 1 : e ? er.skinIndex = i : er.skins[i] = 1, Dn.shopList.length && Dn.main(er.points), "block" == Il.style.display && Lr.generateStoreList()
                }
            }, {
                key: "updateItemCounts",
                value: function(e, i) {
                    if (er) {
                        er.itemCounts[e] = i;
                        var t = {
                            1: [19, 20, 21],
                            2: [22, 23, 24, 25],
                            3: [26, 27, 28],
                            4: [29],
                            5: [31],
                            6: [32],
                            7: [33],
                            8: [34],
                            9: [35],
                            10: [36],
                            11: [30],
                            12: [37],
                            13: [38]
                        } [e];
                        t && t.forEach((function(e) {
                            document.getElementById("itemCounts" + e.toString()).innerHTML = i
                        }))
                    }
                }
            }, {
                key: "updatePlayers",
                value: function(e) {
                    var i = Date.now();
                    Jt.tick++, Jt.enemies.all.length = 0, Jt.enemies.near.length = 0, Jt.enemies.nearest = null;
                    for (var t = 0; t < rr.length; t++) rr[t].forcePos = !rr[t].visible, rr[t].visible = !1, Un.reset(rr[t].sid);
                    for (var n = 0; n < e.length;) {
                        var r = Fr.findPlayerBySID(e[n]);
                        r && (r.t1 = void 0 === r.t2 ? i : r.t2, r.t2 = i, r.x1 = r.x, r.y1 = r.y, r.last = {
                            x: r.x2 || 0,
                            y: r.y2 || 0
                        }, r.x2 = e[n + 1], r.y2 = e[n + 2], r.vel = {
                            x: 2 * r.x2 - r.last.x,
                            y: 2 * r.y2 - r.last.y
                        }, r.d1 = void 0 === r.d2 ? e[n + 3] : r.d2, r.d2 = e[n + 3], Qt || r.manageReloads(r.dt), r.dt = 0, r.buildIndex = e[n + 4], r.weaponIndex = e[n + 5] || 0, r.weaponVariant = e[n + 6], r.team = e[n + 7], r.isLeader = e[n + 8], r.skinIndex = e[n + 9], r.tailIndex = e[n + 10], r.iconIndex = e[n + 11], r.zIndex = e[n + 12], r.visible = !0, r.weaponIndex < 9 ? (r.primaryWeapon = r.weaponIndex, r.primaryVariant = r.weaponVariant) : (r.secondaryWeapon = r.weaponIndex, r.secondaryVariant = r.weaponVariant), Fr.isFriendly(r.sid) || (Un.main(r), Jt.enemies.all.push(r), r.weaponIndex < 9 && 4 != r.primaryWeapon && 13 != r.secondaryWeapon && 10 != r.secondaryWeapon && 14 != r.secondaryWeapon && 15 != r.secondaryWeapon && 9 != r.spikeData.id && (r.secondaryWeapon = 15, r.reloads[15] = 0, r.secondaryVariant = 0), Fr.getDistance(r, er) - 100 <= f.weapons[r.primaryWeapon].range && Jt.enemies.near.push(r))), n += 13
                    }
                    Jt.closeObjects = A.getObjects(er.x2, er.y2), Jt.closeObjects.filter((function(e) {
                        return e && (e.trap || e.dmg) && Fr.getDistance(e, er) <= 400
                    }));
                    for (var l = 0; l < rr.length; l++) {
                        var d = rr[l];
                        d && !d.visible && d.resetReloads()
                    }!er.team && Lr.alliancePlayers.length && (Lr.alliancePlayers.length = 0), Jt.main(), st.update()
                }
            }, {
                key: "removePlayer",
                value: function(e) {
                    for (var i = 0; i < rr.length; i++) {
                        var t = rr[i];
                        if (t.id == e) {
                            document.getElementById("enemyRadar".concat(t.sid)) && document.getElementById("enemyRadar".concat(t.sid)).remove(), W.addLog("left", "", t.name, t.sid), Fr.playerSidMap.delete(t.sid), Fr.playerIdMap.delete(e), rr.splice(i, 1);
                            break
                        }
                    }
                }
            }, {
                key: "showText",
                value: function(e, i, t, n) {
                    if (-1 == n) Mi.showText({
                        x: e,
                        y: i
                    }, 500, 50, .18, "#ee5551", -1);
                    else {
                        var r = t >= 0 ? "#fff" : "#8ecc51";
                        Mi.showText({
                            x: e,
                            y: i
                        }, 500, 50, .18, r, Math.abs(t))
                    }
                }
            }, {
                key: "setInitData",
                value: function(e) {
                    var i = e.teams;
                    Lr.alliances = i
                }
            }, {
                key: "setupGame",
                value: function(e) {
                    Lr.playerSID = e, xl.style.display = "block", Zr.style.display = "none", Gl(), dr && (ft.sendChat("Why moo addict??? Go get life buddy"), k.sendVerification(), setInterval((function() {
                        k.lastPingSocket = Date.now(), k.validated && k.send("pingSocket")
                    }), 1e3), setInterval((function() {
                        er && k.validated && k.send("update", er.x, er.y)
                    }), 3e3), dr = !1)
                }
            }, {
                key: "killPlayer",
                value: function() {
                    ml.style.display = "none", Lr.hideAllWindows(), Lr.lastDeath = {
                        x: er.x,
                        y: er.y
                    }, er.isAlive = !1, El.style.display = "block", El.style.fontSize = "0px", wt.deathTextScale = 0, Lr.drawServerBrowser(), Ln.clear(), Gn.addDeath();
                    for (var e = 0; e < Li.effects.length; e++) {
                        var i = Li.effects[e];
                        i && (i.duration = 0)
                    }
                    setTimeout((function() {
                        Zr.style.display = "block", El.style.display = "none"
                    }), t.deathFadeout)
                }
            }, {
                key: "updateUpgrades",
                value: function(i, t) {
                    var n = [];
                    if (er.upgradePoints = i, er.upgrAge = t, i > 0) {
                        Dl.innerHTML = "";
                        for (var r = 0; r < f.weapons.length; r++) {
                            var l = f.weapons[r];
                            if (l.age == t && (null == l.pre || er.weapons.indexOf(l.pre) >= 0)) {
                                var d = Fr.generateElement({
                                    id: "upgradeItem" + r,
                                    className: "actionBarItem",
                                    parent: Dl
                                });
                                d.onmouseout = function() {
                                    fr.showItemInfo()
                                }, d.style.backgroundImage = document.getElementById("actionBarItem" + r).style.backgroundImage, n.push(r)
                            }
                        }
                        for (var o = 0; o < f.list.length; o++)
                            if (f.list[o].age == t) {
                                var a = f.weapons.length + o,
                                    s = Fr.generateElement({
                                        id: "upgradeItem" + a,
                                        className: "actionBarItem",
                                        parent: Dl
                                    });
                                s.onmouseout = function() {
                                    fr.showItemInfo()
                                }, s.style.backgroundImage = document.getElementById("actionBarItem" + a).style.backgroundImage, n.push(a)
                            } for (var y = function() {
                                var i = n[u],
                                    t = document.getElementById("upgradeItem" + i);
                                if (t.onmouseover = function() {
                                        f.weapons[i] ? fr.showItemInfo(f.weapons[i], !0) : fr.showItemInfo(f.list[i - f.weapons.length])
                                    }, t.onclick = function() {
                                        e.sendUpgrade(i)
                                    }, W.toggles.autoUpgrade) {
                                    var r = parseInt(W.toggles["7thSlot"]);
                                    (1 == n.length || ["17", "31", "23", r].find((function(e) {
                                        return t.id.includes(e)
                                    }))) && e.sendUpgrade(i)
                                }
                            }, u = 0; u < n.length && !y(); u++);
                        n.length ? (Dl.style.display = "block", Ol.style.display = "block", Ol.innerHTML = "SELECT ITEMS (".concat(Math.min(i, 8), ")")) : (Dl.style.display = "none", Ol.style.display = "none", fr.showItemInfo())
                    } else Dl.style.display = "none", Ol.style.display = "none", fr.showItemInfo()
                }
            }, {
                key: "addPlayer",
                value: function(i, t, n) {
                    var r = Fr.findPlayerByID(i[0]);
                    r ? n || (r.spawn(), r.visible = !1, r.x2 = void 0, r.y2 = void 0, r.setData(i)) : (r = new U(i[0], i[1]), rr.push(r), t || W.addLog("encountered", "", i[2], i[1]), r.spawn(), r.visible = !1, r.x2 = void 0, r.y2 = void 0, r.setData(i)), t && (er = r, wt.camX = er.x, wt.camY = er.y, e.updateItems(), Lr.updateStatusDisplay(), e.updateAge(), e.updateUpgrades(0), ml.style.display = "block")
                }
            }, {
                key: "updateItems",
                value: function(e, i) {
                    e && (i ? er.weapons = e : er.items = e);
                    for (var t = 0; t < f.list.length; t++) {
                        var n = f.weapons.length + t;
                        document.getElementById("actionBarItem" + n).style.display = er.items.indexOf(f.list[t].id) >= 0 ? "inline-block" : "none"
                    }
                    for (var r = 0; r < f.weapons.length; r++) document.getElementById("actionBarItem" + r).style.display = er.weapons[f.weapons[r].type] == f.weapons[r].id ? "inline-block" : "none"
                }
            }, {
                key: "updateAge",
                value: function(e, i, n) {
                    null != e && (er.XP = e), null != i && (er.maxXP = i), null != n && (er.age = n), n == t.maxAge ? (Sl.innerHTML = "MAX AGE", Pl.style.width = "100%") : (Sl.innerHTML = "AGE " + er.age, Pl.style.width = er.XP / er.maxXP * 100 + "%")
                }
            }, {
                key: "updateLeaderboard",
                value: function(e) {
                    gl.innerHTML = "";
                    for (var i = 1, t = function(t) {
                            var n = Fr.generateElement({
                                className: "leaderHolder",
                                parent: gl
                            });
                            Fr.generateElement({
                                className: "leaderboardItem",
                                style: "max-width: 220px; color: ".concat(e[t] == Lr.playerSID ? "white" : k.users.find((function(i) {
                                    return i.sid == e[t]
                                })) ? "#f00" : "rgba(255, 255, 255, .6)"),
                                text: "".concat(i, ". ").concat(e[t + 1] || "unknown", " {").concat(e[t], "}"),
                                parent: n
                            }), Fr.generateElement({
                                className: "leaderScore",
                                text: Fr.kFormat(e[t + 2]) || "0",
                                parent: n
                            }), i++
                        }, n = 0; n < e.length; n += 3) t(n)
                }
            }, {
                key: "setPlayerTeam",
                value: function(e, i) {
                    er && (er.team = e, er.isOwner = i, "block" == Tl.style.display && Lr.showAllianceMenu())
                }
            }, {
                key: "receiveChat",
                value: function(e, i, n) {
                    var r = Fr.findPlayerBySID(e),
                        l = Date.now();
                    if (r && l - r.lastChat >= 500) {
                        var d = "white";
                        r.lastChat = l, i.includes("@") && i.split("@").join("").length + 5 <= i.length ? (i = "Spammed '@'", d = "#ffc0cb") : n && (d = "#ffb400"), i = (i = W.convertEmojis(i)).replace(/\/shrug|\/shrg|\/shurg|\/shrgu/g, "Ã‚Â¯\\_(Ã£Æ’â€ž)_/Ã‚Â¯"), r.chatMessages.unshift({
                            msg: i,
                            color: d,
                            duration: t.chatCountdown
                        }), r.chatMessages.length > 3 && (r.chatMessages.length = 3), n || W.addLog("chat", i, r.name, r.sid)
                    }
                }
            }, {
                key: "pingSocketResponse",
                value: function() {
                    Lr.pingTime = Lr.pingTimeDisplay = Date.now() - Lr.lastPingSocket, e.fakePing && (Lr.pingTimeDisplay += Fr.randInt(15, Fr.randInt(25, 35)))
                }
            }, {
                key: "kickFromClan",
                value: function(e) {
                    Ae.send(this.clientToServer.KICK_FROM_CLAN, e)
                }
            }, {
                key: "selectToBuild",
                value: function(e) {
                    var i = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
                    Ae.send(this.clientToServer.SELECT_TO_BUILD, e, i)
                }
            }, {
                key: "joinGame",
                value: function(e, i, t) {
                    Ae.send(this.clientToServer.JOIN_GAME, {
                        name: e,
                        moofoll: i,
                        skin: t
                    })
                }
            }, {
                key: "pingSocket",
                value: function() {
                    Ae.send(this.clientToServer.PING_SOCKET)
                }
            }, {
                key: "aJoinReq",
                value: function(e) {
                    var i = Lr.allianceNotifications;
                    Ae.send(this.clientToServer.JOIN_REQUEST, i[0].sid, e), e || (i.shift(), Jt.nextTick((function() {
                        Lr.updateNotifications()
                    })))
                }
            }])
        }();

    function ar(e) {
        return ar = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, ar(e)
    }

    function sr() {
        sr = function() {
            return i
        };
        var e, i = {},
            t = Object.prototype,
            n = t.hasOwnProperty,
            r = Object.defineProperty || function(e, i, t) {
                e[i] = t.value
            },
            l = "function" == typeof Symbol ? Symbol : {},
            d = l.iterator || "@@iterator",
            o = l.asyncIterator || "@@asyncIterator",
            a = l.toStringTag || "@@toStringTag";

        function s(e, i, t) {
            return Object.defineProperty(e, i, {
                value: t,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[i]
        }
        try {
            s({}, "")
        } catch (e) {
            s = function(e, i, t) {
                return e[i] = t
            }
        }

        function y(e, i, t, n) {
            var l = i && i.prototype instanceof m ? i : m,
                d = Object.create(l.prototype),
                o = new M(n || []);
            return r(d, "_invoke", {
                value: T(e, t, o)
            }), d
        }

        function u(e, i, t) {
            try {
                return {
                    type: "normal",
                    arg: e.call(i, t)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        i.wrap = y;
        var p = "suspendedStart",
            c = "suspendedYield",
            f = "executing",
            h = "completed",
            x = {};

        function m() {}

        function g() {}

        function v() {}
        var b = {};
        s(b, d, (function() {
            return this
        }));
        var w = Object.getPrototypeOf,
            k = w && w(w(j([])));
        k && k !== t && n.call(k, d) && (b = k);
        var S = v.prototype = m.prototype = Object.create(b);

        function P(e) {
            ["next", "throw", "return"].forEach((function(i) {
                s(e, i, (function(e) {
                    return this._invoke(i, e)
                }))
            }))
        }

        function I(e, i) {
            function t(r, l, d, o) {
                var a = u(e[r], e, l);
                if ("throw" !== a.type) {
                    var s = a.arg,
                        y = s.value;
                    return y && "object" == ar(y) && n.call(y, "__await") ? i.resolve(y.__await).then((function(e) {
                        t("next", e, d, o)
                    }), (function(e) {
                        t("throw", e, d, o)
                    })) : i.resolve(y).then((function(e) {
                        s.value = e, d(s)
                    }), (function(e) {
                        return t("throw", e, d, o)
                    }))
                }
                o(a.arg)
            }
            var l;
            r(this, "_invoke", {
                value: function(e, n) {
                    function r() {
                        return new i((function(i, r) {
                            t(e, n, i, r)
                        }))
                    }
                    return l = l ? l.then(r, r) : r()
                }
            })
        }

        function T(i, t, n) {
            var r = p;
            return function(l, d) {
                if (r === f) throw Error("Generator is already running");
                if (r === h) {
                    if ("throw" === l) throw d;
                    return {
                        value: e,
                        done: !0
                    }
                }
                for (n.method = l, n.arg = d;;) {
                    var o = n.delegate;
                    if (o) {
                        var a = D(o, n);
                        if (a) {
                            if (a === x) continue;
                            return a
                        }
                    }
                    if ("next" === n.method) n.sent = n._sent = n.arg;
                    else if ("throw" === n.method) {
                        if (r === p) throw r = h, n.arg;
                        n.dispatchException(n.arg)
                    } else "return" === n.method && n.abrupt("return", n.arg);
                    r = f;
                    var s = u(i, t, n);
                    if ("normal" === s.type) {
                        if (r = n.done ? h : c, s.arg === x) continue;
                        return {
                            value: s.arg,
                            done: n.done
                        }
                    }
                    "throw" === s.type && (r = h, n.method = "throw", n.arg = s.arg)
                }
            }
        }

        function D(i, t) {
            var n = t.method,
                r = i.iterator[n];
            if (r === e) return t.delegate = null, "throw" === n && i.iterator.return && (t.method = "return", t.arg = e, D(i, t), "throw" === t.method) || "return" !== n && (t.method = "throw", t.arg = new TypeError("The iterator does not provide a '" + n + "' method")), x;
            var l = u(r, i.iterator, t.arg);
            if ("throw" === l.type) return t.method = "throw", t.arg = l.arg, t.delegate = null, x;
            var d = l.arg;
            return d ? d.done ? (t[i.resultName] = d.value, t.next = i.nextLoc, "return" !== t.method && (t.method = "next", t.arg = e), t.delegate = null, x) : d : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, x)
        }

        function O(e) {
            var i = {
                tryLoc: e[0]
            };
            1 in e && (i.catchLoc = e[1]), 2 in e && (i.finallyLoc = e[2], i.afterLoc = e[3]), this.tryEntries.push(i)
        }

        function E(e) {
            var i = e.completion || {};
            i.type = "normal", delete i.arg, e.completion = i
        }

        function M(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(O, this), this.reset(!0)
        }

        function j(i) {
            if (i || "" === i) {
                var t = i[d];
                if (t) return t.call(i);
                if ("function" == typeof i.next) return i;
                if (!isNaN(i.length)) {
                    var r = -1,
                        l = function t() {
                            for (; ++r < i.length;)
                                if (n.call(i, r)) return t.value = i[r], t.done = !1, t;
                            return t.value = e, t.done = !0, t
                        };
                    return l.next = l
                }
            }
            throw new TypeError(ar(i) + " is not iterable")
        }
        return g.prototype = v, r(S, "constructor", {
            value: v,
            configurable: !0
        }), r(v, "constructor", {
            value: g,
            configurable: !0
        }), g.displayName = s(v, a, "GeneratorFunction"), i.isGeneratorFunction = function(e) {
            var i = "function" == typeof e && e.constructor;
            return !!i && (i === g || "GeneratorFunction" === (i.displayName || i.name))
        }, i.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, v) : (e.__proto__ = v, s(e, a, "GeneratorFunction")), e.prototype = Object.create(S), e
        }, i.awrap = function(e) {
            return {
                __await: e
            }
        }, P(I.prototype), s(I.prototype, o, (function() {
            return this
        })), i.AsyncIterator = I, i.async = function(e, t, n, r, l) {
            void 0 === l && (l = Promise);
            var d = new I(y(e, t, n, r), l);
            return i.isGeneratorFunction(t) ? d : d.next().then((function(e) {
                return e.done ? e.value : d.next()
            }))
        }, P(S), s(S, a, "Generator"), s(S, d, (function() {
            return this
        })), s(S, "toString", (function() {
            return "[object Generator]"
        })), i.keys = function(e) {
            var i = Object(e),
                t = [];
            for (var n in i) t.push(n);
            return t.reverse(),
                function e() {
                    for (; t.length;) {
                        var n = t.pop();
                        if (n in i) return e.value = n, e.done = !1, e
                    }
                    return e.done = !0, e
                }
        }, i.values = j, M.prototype = {
            constructor: M,
            reset: function(i) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = e, this.done = !1, this.delegate = null, this.method = "next", this.arg = e, this.tryEntries.forEach(E), !i)
                    for (var t in this) "t" === t.charAt(0) && n.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = e)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(i) {
                if (this.done) throw i;
                var t = this;

                function r(n, r) {
                    return o.type = "throw", o.arg = i, t.next = n, r && (t.method = "next", t.arg = e), !!r
                }
                for (var l = this.tryEntries.length - 1; l >= 0; --l) {
                    var d = this.tryEntries[l],
                        o = d.completion;
                    if ("root" === d.tryLoc) return r("end");
                    if (d.tryLoc <= this.prev) {
                        var a = n.call(d, "catchLoc"),
                            s = n.call(d, "finallyLoc");
                        if (a && s) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0);
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        } else if (a) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0)
                        } else {
                            if (!s) throw Error("try statement without catch or finally");
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, i) {
                for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                    var r = this.tryEntries[t];
                    if (r.tryLoc <= this.prev && n.call(r, "finallyLoc") && this.prev < r.finallyLoc) {
                        var l = r;
                        break
                    }
                }
                l && ("break" === e || "continue" === e) && l.tryLoc <= i && i <= l.finallyLoc && (l = null);
                var d = l ? l.completion : {};
                return d.type = e, d.arg = i, l ? (this.method = "next", this.next = l.finallyLoc, x) : this.complete(d)
            },
            complete: function(e, i) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && i && (this.next = i), x
            },
            finish: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.finallyLoc === e) return this.complete(t.completion, t.afterLoc), E(t), x
                }
            },
            catch: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.tryLoc === e) {
                        var n = t.completion;
                        if ("throw" === n.type) {
                            var r = n.arg;
                            E(t)
                        }
                        return r
                    }
                }
                throw Error("illegal catch attempt")
            },
            delegateYield: function(i, t, n) {
                return this.delegate = {
                    iterator: j(i),
                    resultName: t,
                    nextLoc: n
                }, "next" === this.method && (this.arg = e), x
            }
        }, i
    }

    function yr(e, i, t, n, r, l, d) {
        try {
            var o = e[l](d),
                a = o.value
        } catch (e) {
            return void t(e)
        }
        o.done ? i(a) : Promise.resolve(a).then(n, r)
    }

    function ur(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, cr(n.key), n)
        }
    }

    function pr(e, i, t) {
        return (i = cr(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function cr(e) {
        var i = function(e) {
            if ("object" != ar(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != ar(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == ar(i) ? i : i + ""
    }
    Yn = or, Jn(or, "packets", 0), Jn(or, "minPackets", 0), Jn(or, "clientToServer", {
        SELECT_TO_BUILD: "z",
        AUTO_GATHER: "K",
        MOVE: "9",
        RESET_MOVEMENT_DIR: "e",
        JOIN_CLAN: "b",
        CREATE_CLAN: "L",
        LEAVE_CLAN: "N",
        JOIN_GAME: "M",
        PING_SOCKET: "0",
        JOIN_REQUEST: "P",
        KICK_FROM_CLAN: "Q",
        SEND_CHAT: "6",
        SEND_HIT: "F",
        SEND_AIM: "D",
        SEND_UPGRADE: "H",
        STORE: "c"
    }), Jn(or, "serverToClient", new Map([
        ["C", Yn.setupGame],
        ["D", Yn.addPlayer],
        ["E", Yn.removePlayer],
        ["a", Yn.updatePlayers],
        ["G", Yn.updateLeaderboard],
        ["V", Yn.updateItems],
        ["0", Yn.pingSocketResponse],
        ["T", Yn.updateAge],
        ["P", Yn.killPlayer],
        ["U", Yn.updateUpgrades],
        ["6", Yn.receiveChat],
        ["3", Yn.setPlayerTeam],
        ["A", Yn.setInitData],
        ["H", Yn.loadGameObject],
        ["I", Yn.loadAI],
        ["J", Yn.animateAI],
        ["K", Yn.gatherAnimation],
        ["L", Yn.wiggleGameObject],
        ["M", Yn.shootTurret],
        ["N", Yn.updatePlayerValue],
        ["O", Yn.updateHealth],
        ["Q", Yn.killObject],
        ["R", Yn.killObjects],
        ["S", Yn.updateItemCounts],
        ["X", Yn.addProjectile],
        ["Y", Yn.remProjectile],
        ["g", Yn.addAlliance],
        ["1", Yn.deleteAlliance],
        ["2", Yn.allianceNotification],
        ["4", Yn.setAlliancePlayers],
        ["5", Yn.updateStoreItems],
        ["7", Yn.updateMinimap],
        ["8", Yn.showText],
        ["9", Yn.pingMap]
    ])), Jn(or, "fakePing", !1);
    var fr = function() {
        return function(e, i, t) {
            return t && ur(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "loadChangeLog",
            value: (e = sr().mark((function e() {
                return sr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            dl.innerHTML = "", closeChangelogs.onclick = function() {
                                yl.style.display = "block", ol.style.display = "block", sl.style.display = "block", al.style.right = "-450px"
                            }, ol.onclick = function() {
                                yl.style.display = "none", ol.style.display = "none", sl.style.display = "none", al.style.right = "0px"
                            }, yl.onclick = function() {
                                ol.style.display = "none", yl.style.display = "none", sl.style.display = "none", ul.style.right = "0px"
                            }, pl.onclick = function() {
                                yl.style.display = "block", ol.style.display = "block", sl.style.display = "block", ul.style.right = "-450px"
                            };
                        case 5:
                        case "end":
                            return e.stop()
                    }
                }), e)
            })), i = function() {
                var i = this,
                    t = arguments;
                return new Promise((function(n, r) {
                    var l = e.apply(i, t);

                    function d(e) {
                        yr(l, n, r, d, o, "next", e)
                    }

                    function o(e) {
                        yr(l, n, r, d, o, "throw", e)
                    }
                    d(void 0)
                }))
            }, function() {
                return i.apply(this, arguments)
            })
        }, {
            key: "showItemInfo",
            value: function(e, i, t) {
                if (er && e) {
                    if (cl.innerHTML = "", cl.classList.add("visible"), Fr.generateElement({
                            id: "itemInfoName",
                            text: Fr.capitalizeFirst(e.name),
                            parent: cl
                        }), Fr.generateElement({
                            id: "itemInfoDesc",
                            text: e.desc,
                            parent: cl
                        }), i) Fr.generateElement({
                        className: "itemInfoReq",
                        text: e.type ? "secondary" : "primary",
                        parent: cl
                    });
                    else if (!t) {
                        for (var n = 0; n < e.req.length; n += 2) Fr.generateElement({
                            className: "itemInfoReq",
                            html: "".concat(e.req[n], ' <span class="itemInfoReqVal">x').concat(e.req[n + 1], "</span>"),
                            parent: cl
                        });
                        var r = er.itemCounts[e.group.id] || 0,
                            l = Xl() && e.group.sandboxLimit || e.group.limit;
                        e.group.limit && Fr.generateElement({
                            className: "itemInfoLmt",
                            text: "".concat(r, "/").concat(l),
                            parent: cl
                        })
                    }
                } else cl.classList.remove("visible")
            }
        }, {
            key: "prepareUI",
            value: function() {
                var e = this;
                hl.value = Yr("moo_name");
                for (var i = 0; i < f.weapons.length + f.list.length; i++) Fr.generateElement({
                    id: "actionBarItem" + i,
                    style: "display: none;",
                    className: "actionBarItem",
                    parent: actionBar
                });
                for (var n = function(i) {
                        var n = f.weapons[i] || f.list[i - f.weapons.length],
                            r = document.createElement("canvas");
                        r.width = r.height = 66;
                        var l = r.getContext("2d");
                        if (l.translate(r.width / 2, r.height / 2), l.imageSmoothingEnabled = !1, l.webkitImageSmoothingEnabled = !1, l.mozImageSmoothingEnabled = !1, f.weapons[i]) {
                            var d = document.getElementById("actionBarItem" + i);
                            l.rotate(Math.PI / 4 + Math.PI);
                            var o = new Image;
                            e.toolSprites[n.src] = o, o.onload = function() {
                                this.isLoaded = !0;
                                var e = 1 / (this.height / this.width),
                                    i = n.iPad || 1;
                                l.drawImage(this, -r.width * i * t.iconPad * e / 2, -r.height * i * t.iconPad / 2, r.width * i * e * t.iconPad, r.height * i * t.iconPad), l.fillStyle = "rgba(0, 0, 70, 0.1)", l.globalCompositeOperation = "source-atop", l.fillRect(-r.width / 2, -r.height / 2, r.width, r.height), d.style.backgroundImage = "url('".concat(r.toDataURL(), "')")
                            }, o.src = location.hostname.includes("moomoo") ? "../../img/weapons/".concat(n.src, ".png") : "https://dev.moomoo.io/img/weapons/".concat(n.src, ".png"), d.onmouseover = function() {
                                e.showItemInfo(n, !0)
                            }, d.onmouseout = function() {
                                e.showItemInfo()
                            }, d.onclick = function() {
                                or.selectToBuild(i, !0)
                            }
                        } else {
                            var a = document.getElementById("actionBarItem" + i),
                                s = Vi.getItemSprite(n, !0),
                                y = r.width - t.iconPadding;
                            l.globalAlpha = 1, l.drawImage(s, -y / 2, -y / 2, y, y), l.fillStyle = "rgba(0, 0, 70, 0.1)", l.globalCompositeOperation = "source-atop", l.fillRect(-y / 2, -y / 2, y, y), a.style.backgroundImage = 'url("'.concat(r.toDataURL(), '")'), a.onmouseover = function() {
                                e.showItemInfo(n)
                            }, a.onmouseout = function() {
                                e.showItemInfo()
                            }, a.onclick = function() {
                                or.selectToBuild(i - f.weapons.length)
                            }
                        }
                    }, r = 0; r < f.weapons.length + f.list.length; r++) n(r)
            }
        }, {
            key: "enterGame",
            value: function() {
                this.firstJoin && (nr.length = 0, A.grid = new Map, this.firstJoin = !1, Vi.itemSprites = {}, Vi.gameObjectSprites = {}), Kr("moo_name", hl.value), Ae.connected && or.joinGame(hl.value, 1, Lr.skinColor)
            }
        }, {
            key: "start",
            value: function() {
                var e = this;
                if (Te.itemLoaded(), window.tmpBuildings)
                    for (var i = 0; i < window.tmpBuildings.length; i++) {
                        var n = window.tmpBuildings[i],
                            r = 0;
                        f.list[n.id] ? r = f.list[n.id].scale : 0 == n.type ? r = t.treeScales[Math.floor(t.treeScales.length * Math.random())] : 1 == n.type ? r = t.rockScales[Math.floor(t.rockScales.length * Math.random())] : 2 == n.type && (r = t.bushScales[Math.floor(t.bushScales.length * Math.random())]), nn.add(n.sid, n.x, n.y, n.dir, r, n.type, f.list[n.id])
                    }
                Te.itemLoaded(), this.loadChangeLog(), Te.itemLoaded(), this.prepareUI(), Te.itemLoaded(), fl.onclick = function() {
                    return e.enterGame()
                }, Lr.connect()
            }
        }]);
        var e, i
    }();

    function hr(e) {
        return hr = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, hr(e)
    }

    function xr() {
        xr = function() {
            return i
        };
        var e, i = {},
            t = Object.prototype,
            n = t.hasOwnProperty,
            r = Object.defineProperty || function(e, i, t) {
                e[i] = t.value
            },
            l = "function" == typeof Symbol ? Symbol : {},
            d = l.iterator || "@@iterator",
            o = l.asyncIterator || "@@asyncIterator",
            a = l.toStringTag || "@@toStringTag";

        function s(e, i, t) {
            return Object.defineProperty(e, i, {
                value: t,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[i]
        }
        try {
            s({}, "")
        } catch (e) {
            s = function(e, i, t) {
                return e[i] = t
            }
        }

        function y(e, i, t, n) {
            var l = i && i.prototype instanceof m ? i : m,
                d = Object.create(l.prototype),
                o = new M(n || []);
            return r(d, "_invoke", {
                value: T(e, t, o)
            }), d
        }

        function u(e, i, t) {
            try {
                return {
                    type: "normal",
                    arg: e.call(i, t)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        i.wrap = y;
        var p = "suspendedStart",
            c = "suspendedYield",
            f = "executing",
            h = "completed",
            x = {};

        function m() {}

        function g() {}

        function v() {}
        var b = {};
        s(b, d, (function() {
            return this
        }));
        var w = Object.getPrototypeOf,
            k = w && w(w(j([])));
        k && k !== t && n.call(k, d) && (b = k);
        var S = v.prototype = m.prototype = Object.create(b);

        function P(e) {
            ["next", "throw", "return"].forEach((function(i) {
                s(e, i, (function(e) {
                    return this._invoke(i, e)
                }))
            }))
        }

        function I(e, i) {
            function t(r, l, d, o) {
                var a = u(e[r], e, l);
                if ("throw" !== a.type) {
                    var s = a.arg,
                        y = s.value;
                    return y && "object" == hr(y) && n.call(y, "__await") ? i.resolve(y.__await).then((function(e) {
                        t("next", e, d, o)
                    }), (function(e) {
                        t("throw", e, d, o)
                    })) : i.resolve(y).then((function(e) {
                        s.value = e, d(s)
                    }), (function(e) {
                        return t("throw", e, d, o)
                    }))
                }
                o(a.arg)
            }
            var l;
            r(this, "_invoke", {
                value: function(e, n) {
                    function r() {
                        return new i((function(i, r) {
                            t(e, n, i, r)
                        }))
                    }
                    return l = l ? l.then(r, r) : r()
                }
            })
        }

        function T(i, t, n) {
            var r = p;
            return function(l, d) {
                if (r === f) throw Error("Generator is already running");
                if (r === h) {
                    if ("throw" === l) throw d;
                    return {
                        value: e,
                        done: !0
                    }
                }
                for (n.method = l, n.arg = d;;) {
                    var o = n.delegate;
                    if (o) {
                        var a = D(o, n);
                        if (a) {
                            if (a === x) continue;
                            return a
                        }
                    }
                    if ("next" === n.method) n.sent = n._sent = n.arg;
                    else if ("throw" === n.method) {
                        if (r === p) throw r = h, n.arg;
                        n.dispatchException(n.arg)
                    } else "return" === n.method && n.abrupt("return", n.arg);
                    r = f;
                    var s = u(i, t, n);
                    if ("normal" === s.type) {
                        if (r = n.done ? h : c, s.arg === x) continue;
                        return {
                            value: s.arg,
                            done: n.done
                        }
                    }
                    "throw" === s.type && (r = h, n.method = "throw", n.arg = s.arg)
                }
            }
        }

        function D(i, t) {
            var n = t.method,
                r = i.iterator[n];
            if (r === e) return t.delegate = null, "throw" === n && i.iterator.return && (t.method = "return", t.arg = e, D(i, t), "throw" === t.method) || "return" !== n && (t.method = "throw", t.arg = new TypeError("The iterator does not provide a '" + n + "' method")), x;
            var l = u(r, i.iterator, t.arg);
            if ("throw" === l.type) return t.method = "throw", t.arg = l.arg, t.delegate = null, x;
            var d = l.arg;
            return d ? d.done ? (t[i.resultName] = d.value, t.next = i.nextLoc, "return" !== t.method && (t.method = "next", t.arg = e), t.delegate = null, x) : d : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, x)
        }

        function O(e) {
            var i = {
                tryLoc: e[0]
            };
            1 in e && (i.catchLoc = e[1]), 2 in e && (i.finallyLoc = e[2], i.afterLoc = e[3]), this.tryEntries.push(i)
        }

        function E(e) {
            var i = e.completion || {};
            i.type = "normal", delete i.arg, e.completion = i
        }

        function M(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(O, this), this.reset(!0)
        }

        function j(i) {
            if (i || "" === i) {
                var t = i[d];
                if (t) return t.call(i);
                if ("function" == typeof i.next) return i;
                if (!isNaN(i.length)) {
                    var r = -1,
                        l = function t() {
                            for (; ++r < i.length;)
                                if (n.call(i, r)) return t.value = i[r], t.done = !1, t;
                            return t.value = e, t.done = !0, t
                        };
                    return l.next = l
                }
            }
            throw new TypeError(hr(i) + " is not iterable")
        }
        return g.prototype = v, r(S, "constructor", {
            value: v,
            configurable: !0
        }), r(v, "constructor", {
            value: g,
            configurable: !0
        }), g.displayName = s(v, a, "GeneratorFunction"), i.isGeneratorFunction = function(e) {
            var i = "function" == typeof e && e.constructor;
            return !!i && (i === g || "GeneratorFunction" === (i.displayName || i.name))
        }, i.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, v) : (e.__proto__ = v, s(e, a, "GeneratorFunction")), e.prototype = Object.create(S), e
        }, i.awrap = function(e) {
            return {
                __await: e
            }
        }, P(I.prototype), s(I.prototype, o, (function() {
            return this
        })), i.AsyncIterator = I, i.async = function(e, t, n, r, l) {
            void 0 === l && (l = Promise);
            var d = new I(y(e, t, n, r), l);
            return i.isGeneratorFunction(t) ? d : d.next().then((function(e) {
                return e.done ? e.value : d.next()
            }))
        }, P(S), s(S, a, "Generator"), s(S, d, (function() {
            return this
        })), s(S, "toString", (function() {
            return "[object Generator]"
        })), i.keys = function(e) {
            var i = Object(e),
                t = [];
            for (var n in i) t.push(n);
            return t.reverse(),
                function e() {
                    for (; t.length;) {
                        var n = t.pop();
                        if (n in i) return e.value = n, e.done = !1, e
                    }
                    return e.done = !0, e
                }
        }, i.values = j, M.prototype = {
            constructor: M,
            reset: function(i) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = e, this.done = !1, this.delegate = null, this.method = "next", this.arg = e, this.tryEntries.forEach(E), !i)
                    for (var t in this) "t" === t.charAt(0) && n.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = e)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(i) {
                if (this.done) throw i;
                var t = this;

                function r(n, r) {
                    return o.type = "throw", o.arg = i, t.next = n, r && (t.method = "next", t.arg = e), !!r
                }
                for (var l = this.tryEntries.length - 1; l >= 0; --l) {
                    var d = this.tryEntries[l],
                        o = d.completion;
                    if ("root" === d.tryLoc) return r("end");
                    if (d.tryLoc <= this.prev) {
                        var a = n.call(d, "catchLoc"),
                            s = n.call(d, "finallyLoc");
                        if (a && s) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0);
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        } else if (a) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0)
                        } else {
                            if (!s) throw Error("try statement without catch or finally");
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, i) {
                for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                    var r = this.tryEntries[t];
                    if (r.tryLoc <= this.prev && n.call(r, "finallyLoc") && this.prev < r.finallyLoc) {
                        var l = r;
                        break
                    }
                }
                l && ("break" === e || "continue" === e) && l.tryLoc <= i && i <= l.finallyLoc && (l = null);
                var d = l ? l.completion : {};
                return d.type = e, d.arg = i, l ? (this.method = "next", this.next = l.finallyLoc, x) : this.complete(d)
            },
            complete: function(e, i) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && i && (this.next = i), x
            },
            finish: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.finallyLoc === e) return this.complete(t.completion, t.afterLoc), E(t), x
                }
            },
            catch: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.tryLoc === e) {
                        var n = t.completion;
                        if ("throw" === n.type) {
                            var r = n.arg;
                            E(t)
                        }
                        return r
                    }
                }
                throw Error("illegal catch attempt")
            },
            delegateYield: function(i, t, n) {
                return this.delegate = {
                    iterator: j(i),
                    resultName: t,
                    nextLoc: n
                }, "next" === this.method && (this.arg = e), x
            }
        }, i
    }

    function mr(e, i, t, n, r, l, d) {
        try {
            var o = e[l](d),
                a = o.value
        } catch (e) {
            return void t(e)
        }
        o.done ? i(a) : Promise.resolve(a).then(n, r)
    }

    function gr(e) {
        return function() {
            var i = this,
                t = arguments;
            return new Promise((function(n, r) {
                var l = e.apply(i, t);

                function d(e) {
                    mr(l, n, r, d, o, "next", e)
                }

                function o(e) {
                    mr(l, n, r, d, o, "throw", e)
                }
                d(void 0)
            }))
        }
    }

    function vr(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, wr(n.key), n)
        }
    }

    function br(e, i, t) {
        return (i = wr(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function wr(e) {
        var i = function(e) {
            if ("object" != hr(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != hr(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == hr(i) ? i : i + ""
    }
    pr(fr, "toolSprites", {}), pr(fr, "cam", {
        x: 0,
        y: 0,
        dir: 0
    }), pr(fr, "firstJoin", !0);
    var kr = function() {
        return function(e, i, t) {
            return t && vr(e, t), Object.defineProperty(e, "prototype", {
                writable: !1
            }), e
        }((function e() {
            ! function(e, i) {
                if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
            }(this, e)
        }), 0, [{
            key: "init",
            value: function() {
                this.selfFunc = self.URL || self.webkitURL, this.workerBlob = this.baseEncoded = "IWZ1bmN0aW9uKCl7InVzZSBzdHJpY3QiO2xldCBlPW5ldyBUZXh0RW5jb2Rlcjthc3luYyBmdW5jdGlvbiB0KHQsbixyKXt2YXIgbDtyZXR1cm4gbD1hd2FpdCBjcnlwdG8uc3VidGxlLmRpZ2VzdChyLnRvVXBwZXJDYXNlKCksZS5lbmNvZGUodCtuKSksWy4uLm5ldyBVaW50OEFycmF5KGwpXS5tYXAoZT0+ZS50b1N0cmluZygxNikucGFkU3RhcnQoMiwiMCIpKS5qb2luKCIiKX1mdW5jdGlvbiBuKGUsdD0xMil7bGV0IG49bmV3IFVpbnQ4QXJyYXkodCk7Zm9yKGxldCByPTA7cjx0O3IrKyluW3JdPWUlMjU2LGU9TWF0aC5mbG9vcihlLzI1Nik7cmV0dXJuIG59YXN5bmMgZnVuY3Rpb24gcih0LHI9IiIsbD0xZTYsbz0wKXtsZXQgYT0iQUVTLUdDTSIsYz1uZXcgQWJvcnRDb250cm9sbGVyLGk9RGF0ZS5ub3coKSx1PShhc3luYygpPT57Zm9yKGxldCBlPW87ZTw9bCYmIWMuc2lnbmFsLmFib3J0ZWQmJnMmJnc7ZSsrKXRyeXtsZXQgdD1hd2FpdCBjcnlwdG8uc3VidGxlLmRlY3J5cHQoe25hbWU6YSxpdjpuKGUpfSxzLHcpO2lmKHQpcmV0dXJue2NsZWFyVGV4dDpuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUodCksdG9vazpEYXRlLm5vdygpLWl9fWNhdGNoe31yZXR1cm4gbnVsbH0pKCkscz1udWxsLHc9bnVsbDt0cnl7dz1mdW5jdGlvbiBlKHQpe2xldCBuPWF0b2IodCkscj1uZXcgVWludDhBcnJheShuLmxlbmd0aCk7Zm9yKGxldCBsPTA7bDxuLmxlbmd0aDtsKyspcltsXT1uLmNoYXJDb2RlQXQobCk7cmV0dXJuIHJ9KHQpO2xldCBmPWF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KCJTSEEtMjU2IixlLmVuY29kZShyKSk7cz1hd2FpdCBjcnlwdG8uc3VidGxlLmltcG9ydEtleSgicmF3IixmLGEsITEsWyJkZWNyeXB0Il0pfWNhdGNoe3JldHVybntwcm9taXNlOlByb21pc2UucmVqZWN0KCksY29udHJvbGxlcjpjfX1yZXR1cm57cHJvbWlzZTp1LGNvbnRyb2xsZXI6Y319bGV0IGw7b25tZXNzYWdlPWFzeW5jIGU9PntsZXR7dHlwZTpuLHBheWxvYWQ6byxzdGFydDphLG1heDpjfT1lLmRhdGEsaT1udWxsO2lmKCJhYm9ydCI9PT1uKWwmJmwuYWJvcnQoKSxsPXZvaWQgMDtlbHNlIGlmKCJ3b3JrIj09PW4pe2lmKCJvYmZ1c2NhdGVkImluIG8pe2xldHtrZXk6dSxvYmZ1c2NhdGVkOnN9PW98fHt9O2k9YXdhaXQgcihzLHUsYyxhKX1lbHNle2xldHthbGdvcml0aG06dyxjaGFsbGVuZ2U6ZixzYWx0OmR9PW98fHt9O2k9ZnVuY3Rpb24gZShuLHIsbD0iU0hBLTI1NiIsbz0xZTYsYT0wKXtsZXQgYz1uZXcgQWJvcnRDb250cm9sbGVyLGk9RGF0ZS5ub3coKSx1PShhc3luYygpPT57Zm9yKGxldCBlPWE7ZTw9byYmIWMuc2lnbmFsLmFib3J0ZWQ7ZSsrKXtsZXQgdT1hd2FpdCB0KHIsZSxsKTtpZih1PT09bilyZXR1cm57bnVtYmVyOmUsdG9vazpEYXRlLm5vdygpLWl9fXJldHVybiBudWxsfSkoKTtyZXR1cm57cHJvbWlzZTp1LGNvbnRyb2xsZXI6Y319KGYsZCx3LGMsYSl9bD1pLmNvbnRyb2xsZXIsaS5wcm9taXNlLnRoZW4oZT0+e3NlbGYucG9zdE1lc3NhZ2UoZSYmey4uLmUsd29ya2VyOiEwfSl9KX19fSgpOw==", this.workerBlob = Uint8Array.from(atob(this.workerBlob), (function(e) {
                    return e.charCodeAt(0)
                })), this.workJSBlob = new Blob([this.workerBlob], {
                    type: "text/javascript;charset=utf-8"
                })
            }
        }, {
            key: "createWorker",
            value: function(e) {
                var i = this,
                    t = this.workJSBlob && this.selfFunc.createObjectURL(this.workJSBlob),
                    n = new Worker(t, {
                        name: null == e ? void 0 : e.name
                    });
                return n.addEventListener("error", (function() {
                    i.selfFunc.revokeObjectURL(t)
                })), n
            }
        }, {
            key: "getChallenge",
            value: (r = gr(xr().mark((function e() {
                var i, t;
                return xr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            return e.next = 2, fetch("https://api.moomoo.io/verify", {
                                headers: {}
                            });
                        case 2:
                            return i = e.sent, e.next = 5, i.json();
                        case 5:
                            return t = e.sent, e.abrupt("return", t);
                        case 7:
                        case "end":
                            return e.stop()
                    }
                }), e)
            }))), function() {
                return r.apply(this, arguments)
            })
        }, {
            key: "getWorkerSolution",
            value: (n = gr(xr().mark((function e(i, t) {
                var n, r, l, d, o, a, s, y = arguments;
                return xr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            for (n = y.length > 2 && void 0 !== y[2] ? y[2] : 8, r = [], l = 0; l < n; l++) r.push(this.createWorker(void 0));
                            return d = Math.ceil(t / n), e.next = 6, Promise.all(r.map((function(e, t) {
                                var n = t * d;
                                return new Promise((function(t) {
                                    e.addEventListener("message", (function(i) {
                                        if (i.data)
                                            for (var n = 0, l = r; n < l.length; n++) {
                                                var d = l[n];
                                                d !== e && d.postMessage({
                                                    type: "abort"
                                                })
                                            }
                                        t(i.data)
                                    })), e.postMessage({
                                        payload: i,
                                        max: n + d,
                                        start: n,
                                        type: "work"
                                    })
                                }))
                            })));
                        case 6:
                            for (o = e.sent, a = 0, s = r; a < s.length; a++) s[a].terminate();
                            return e.abrupt("return", o.find((function(e) {
                                return !!e
                            })) || null);
                        case 9:
                        case "end":
                            return e.stop()
                    }
                }), e, this)
            }))), function(e, i) {
                return n.apply(this, arguments)
            })
        }, {
            key: "validateChallenge",
            value: (t = gr(xr().mark((function e(i) {
                var t;
                return xr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            return e.next = 2, this.getWorkerSolution(i, i.maxnumber);
                        case 2:
                            if (void 0 === (null == (t = e.sent) ? void 0 : t.number) && !("obfuscated" in i)) {
                                e.next = 5;
                                break
                            }
                            return e.abrupt("return", {
                                challengeData: i,
                                solution: t
                            });
                        case 5:
                        case "end":
                            return e.stop()
                    }
                }), e, this)
            }))), function(e) {
                return t.apply(this, arguments)
            })
        }, {
            key: "createPayload",
            value: function(e, i) {
                return btoa(JSON.stringify({
                    algorithm: e.algorithm,
                    challenge: e.challenge,
                    number: i.number,
                    salt: e.salt,
                    signature: e.signature,
                    test: !!e || void 0,
                    took: i.took
                }))
            }
        }, {
            key: "executeRecaptcha",
            value: (i = gr(xr().mark((function e() {
                var i, t, n, r;
                return xr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            return e.prev = 0, e.next = 3, this.getChallenge();
                        case 3:
                            return i = e.sent, e.next = 6, this.validateChallenge(i);
                        case 6:
                            return t = e.sent, n = t.solution, r = this.createPayload(i, n), e.abrupt("return", r);
                        case 12:
                            e.prev = 12, e.t0 = e.catch(0), we.msg("ALTCHA Token Generation");
                        case 15:
                        case "end":
                            return e.stop()
                    }
                }), e, this, [
                    [0, 12]
                ])
            }))), function() {
                return i.apply(this, arguments)
            })
        }, {
            key: "default",
            value: (e = gr(xr().mark((function e() {
                return xr().wrap((function(e) {
                    for (;;) switch (e.prev = e.next) {
                        case 0:
                            if (e.prev = 0, this.token) {
                                e.next = 8;
                                break
                            }
                            return e.next = 4, this.executeRecaptcha();
                        case 4:
                            this.token = e.sent, console.log("Generated simple ALTCHA Token"), e.next = 9;
                            break;
                        case 8:
                            console.log("Fetched simple ALTCHA Token");
                        case 9:
                            return e.abrupt("return", "alt:".concat(this.token));
                        case 12:
                            e.prev = 12, e.t0 = e.catch(0), console.log(e.t0), we.msg("ALTCHA Token Generation");
                        case 16:
                        case "end":
                            return e.stop()
                    }
                }), e, this, [
                    [0, 12]
                ])
            }))), function() {
                return e.apply(this, arguments)
            })
        }]);
        var e, i, t, n, r
    }();

    function Sr(e) {
        return Sr = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Sr(e)
    }

    function Pr(e, i) {
        return function(e) {
            if (Array.isArray(e)) return e
        }(e) || function(e, i) {
            var t = null == e ? null : "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
            if (null != t) {
                var n, r, l, d, o = [],
                    a = !0,
                    s = !1;
                try {
                    if (l = (t = t.call(e)).next, 0 === i) {
                        if (Object(t) !== t) return;
                        a = !1
                    } else
                        for (; !(a = (n = l.call(t)).done) && (o.push(n.value), o.length !== i); a = !0);
                } catch (e) {
                    s = !0, r = e
                } finally {
                    try {
                        if (!a && null != t.return && (d = t.return(), Object(d) !== d)) return
                    } finally {
                        if (s) throw r
                    }
                }
                return o
            }
        }(e, i) || Tr(e, i) || function() {
            throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }()
    }

    function Ir(e, i) {
        var t = "undefined" != typeof Symbol && e[Symbol.iterator] || e["@@iterator"];
        if (!t) {
            if (Array.isArray(e) || (t = Tr(e)) || i && e && "number" == typeof e.length) {
                t && (e = t);
                var n = 0,
                    r = function() {};
                return {
                    s: r,
                    n: function() {
                        return n >= e.length ? {
                            done: !0
                        } : {
                            done: !1,
                            value: e[n++]
                        }
                    },
                    e: function(e) {
                        throw e
                    },
                    f: r
                }
            }
            throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }
        var l, d = !0,
            o = !1;
        return {
            s: function() {
                t = t.call(e)
            },
            n: function() {
                var e = t.next();
                return d = e.done, e
            },
            e: function(e) {
                o = !0, l = e
            },
            f: function() {
                try {
                    d || null == t.return || t.return()
                } finally {
                    if (o) throw l
                }
            }
        }
    }

    function Tr(e, i) {
        if (e) {
            if ("string" == typeof e) return Dr(e, i);
            var t = {}.toString.call(e).slice(8, -1);
            return "Object" === t && e.constructor && (t = e.constructor.name), "Map" === t || "Set" === t ? Array.from(e) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? Dr(e, i) : void 0
        }
    }

    function Dr(e, i) {
        (null == i || i > e.length) && (i = e.length);
        for (var t = 0, n = Array(i); t < i; t++) n[t] = e[t];
        return n
    }

    function Or() {
        Or = function() {
            return i
        };
        var e, i = {},
            t = Object.prototype,
            n = t.hasOwnProperty,
            r = Object.defineProperty || function(e, i, t) {
                e[i] = t.value
            },
            l = "function" == typeof Symbol ? Symbol : {},
            d = l.iterator || "@@iterator",
            o = l.asyncIterator || "@@asyncIterator",
            a = l.toStringTag || "@@toStringTag";

        function s(e, i, t) {
            return Object.defineProperty(e, i, {
                value: t,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[i]
        }
        try {
            s({}, "")
        } catch (e) {
            s = function(e, i, t) {
                return e[i] = t
            }
        }

        function y(e, i, t, n) {
            var l = i && i.prototype instanceof m ? i : m,
                d = Object.create(l.prototype),
                o = new M(n || []);
            return r(d, "_invoke", {
                value: T(e, t, o)
            }), d
        }

        function u(e, i, t) {
            try {
                return {
                    type: "normal",
                    arg: e.call(i, t)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        i.wrap = y;
        var p = "suspendedStart",
            c = "suspendedYield",
            f = "executing",
            h = "completed",
            x = {};

        function m() {}

        function g() {}

        function v() {}
        var b = {};
        s(b, d, (function() {
            return this
        }));
        var w = Object.getPrototypeOf,
            k = w && w(w(j([])));
        k && k !== t && n.call(k, d) && (b = k);
        var S = v.prototype = m.prototype = Object.create(b);

        function P(e) {
            ["next", "throw", "return"].forEach((function(i) {
                s(e, i, (function(e) {
                    return this._invoke(i, e)
                }))
            }))
        }

        function I(e, i) {
            function t(r, l, d, o) {
                var a = u(e[r], e, l);
                if ("throw" !== a.type) {
                    var s = a.arg,
                        y = s.value;
                    return y && "object" == Sr(y) && n.call(y, "__await") ? i.resolve(y.__await).then((function(e) {
                        t("next", e, d, o)
                    }), (function(e) {
                        t("throw", e, d, o)
                    })) : i.resolve(y).then((function(e) {
                        s.value = e, d(s)
                    }), (function(e) {
                        return t("throw", e, d, o)
                    }))
                }
                o(a.arg)
            }
            var l;
            r(this, "_invoke", {
                value: function(e, n) {
                    function r() {
                        return new i((function(i, r) {
                            t(e, n, i, r)
                        }))
                    }
                    return l = l ? l.then(r, r) : r()
                }
            })
        }

        function T(i, t, n) {
            var r = p;
            return function(l, d) {
                if (r === f) throw Error("Generator is already running");
                if (r === h) {
                    if ("throw" === l) throw d;
                    return {
                        value: e,
                        done: !0
                    }
                }
                for (n.method = l, n.arg = d;;) {
                    var o = n.delegate;
                    if (o) {
                        var a = D(o, n);
                        if (a) {
                            if (a === x) continue;
                            return a
                        }
                    }
                    if ("next" === n.method) n.sent = n._sent = n.arg;
                    else if ("throw" === n.method) {
                        if (r === p) throw r = h, n.arg;
                        n.dispatchException(n.arg)
                    } else "return" === n.method && n.abrupt("return", n.arg);
                    r = f;
                    var s = u(i, t, n);
                    if ("normal" === s.type) {
                        if (r = n.done ? h : c, s.arg === x) continue;
                        return {
                            value: s.arg,
                            done: n.done
                        }
                    }
                    "throw" === s.type && (r = h, n.method = "throw", n.arg = s.arg)
                }
            }
        }

        function D(i, t) {
            var n = t.method,
                r = i.iterator[n];
            if (r === e) return t.delegate = null, "throw" === n && i.iterator.return && (t.method = "return", t.arg = e, D(i, t), "throw" === t.method) || "return" !== n && (t.method = "throw", t.arg = new TypeError("The iterator does not provide a '" + n + "' method")), x;
            var l = u(r, i.iterator, t.arg);
            if ("throw" === l.type) return t.method = "throw", t.arg = l.arg, t.delegate = null, x;
            var d = l.arg;
            return d ? d.done ? (t[i.resultName] = d.value, t.next = i.nextLoc, "return" !== t.method && (t.method = "next", t.arg = e), t.delegate = null, x) : d : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, x)
        }

        function O(e) {
            var i = {
                tryLoc: e[0]
            };
            1 in e && (i.catchLoc = e[1]), 2 in e && (i.finallyLoc = e[2], i.afterLoc = e[3]), this.tryEntries.push(i)
        }

        function E(e) {
            var i = e.completion || {};
            i.type = "normal", delete i.arg, e.completion = i
        }

        function M(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(O, this), this.reset(!0)
        }

        function j(i) {
            if (i || "" === i) {
                var t = i[d];
                if (t) return t.call(i);
                if ("function" == typeof i.next) return i;
                if (!isNaN(i.length)) {
                    var r = -1,
                        l = function t() {
                            for (; ++r < i.length;)
                                if (n.call(i, r)) return t.value = i[r], t.done = !1, t;
                            return t.value = e, t.done = !0, t
                        };
                    return l.next = l
                }
            }
            throw new TypeError(Sr(i) + " is not iterable")
        }
        return g.prototype = v, r(S, "constructor", {
            value: v,
            configurable: !0
        }), r(v, "constructor", {
            value: g,
            configurable: !0
        }), g.displayName = s(v, a, "GeneratorFunction"), i.isGeneratorFunction = function(e) {
            var i = "function" == typeof e && e.constructor;
            return !!i && (i === g || "GeneratorFunction" === (i.displayName || i.name))
        }, i.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, v) : (e.__proto__ = v, s(e, a, "GeneratorFunction")), e.prototype = Object.create(S), e
        }, i.awrap = function(e) {
            return {
                __await: e
            }
        }, P(I.prototype), s(I.prototype, o, (function() {
            return this
        })), i.AsyncIterator = I, i.async = function(e, t, n, r, l) {
            void 0 === l && (l = Promise);
            var d = new I(y(e, t, n, r), l);
            return i.isGeneratorFunction(t) ? d : d.next().then((function(e) {
                return e.done ? e.value : d.next()
            }))
        }, P(S), s(S, a, "Generator"), s(S, d, (function() {
            return this
        })), s(S, "toString", (function() {
            return "[object Generator]"
        })), i.keys = function(e) {
            var i = Object(e),
                t = [];
            for (var n in i) t.push(n);
            return t.reverse(),
                function e() {
                    for (; t.length;) {
                        var n = t.pop();
                        if (n in i) return e.value = n, e.done = !1, e
                    }
                    return e.done = !0, e
                }
        }, i.values = j, M.prototype = {
            constructor: M,
            reset: function(i) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = e, this.done = !1, this.delegate = null, this.method = "next", this.arg = e, this.tryEntries.forEach(E), !i)
                    for (var t in this) "t" === t.charAt(0) && n.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = e)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(i) {
                if (this.done) throw i;
                var t = this;

                function r(n, r) {
                    return o.type = "throw", o.arg = i, t.next = n, r && (t.method = "next", t.arg = e), !!r
                }
                for (var l = this.tryEntries.length - 1; l >= 0; --l) {
                    var d = this.tryEntries[l],
                        o = d.completion;
                    if ("root" === d.tryLoc) return r("end");
                    if (d.tryLoc <= this.prev) {
                        var a = n.call(d, "catchLoc"),
                            s = n.call(d, "finallyLoc");
                        if (a && s) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0);
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        } else if (a) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0)
                        } else {
                            if (!s) throw Error("try statement without catch or finally");
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, i) {
                for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                    var r = this.tryEntries[t];
                    if (r.tryLoc <= this.prev && n.call(r, "finallyLoc") && this.prev < r.finallyLoc) {
                        var l = r;
                        break
                    }
                }
                l && ("break" === e || "continue" === e) && l.tryLoc <= i && i <= l.finallyLoc && (l = null);
                var d = l ? l.completion : {};
                return d.type = e, d.arg = i, l ? (this.method = "next", this.next = l.finallyLoc, x) : this.complete(d)
            },
            complete: function(e, i) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && i && (this.next = i), x
            },
            finish: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.finallyLoc === e) return this.complete(t.completion, t.afterLoc), E(t), x
                }
            },
            catch: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.tryLoc === e) {
                        var n = t.completion;
                        if ("throw" === n.type) {
                            var r = n.arg;
                            E(t)
                        }
                        return r
                    }
                }
                throw Error("illegal catch attempt")
            },
            delegateYield: function(i, t, n) {
                return this.delegate = {
                    iterator: j(i),
                    resultName: t,
                    nextLoc: n
                }, "next" === this.method && (this.arg = e), x
            }
        }, i
    }

    function Er(e, i, t, n, r, l, d) {
        try {
            var o = e[l](d),
                a = o.value
        } catch (e) {
            return void t(e)
        }
        o.done ? i(a) : Promise.resolve(a).then(n, r)
    }

    function Mr(e) {
        return function() {
            var i = this,
                t = arguments;
            return new Promise((function(n, r) {
                var l = e.apply(i, t);

                function d(e) {
                    Er(l, n, r, d, o, "next", e)
                }

                function o(e) {
                    Er(l, n, r, d, o, "throw", e)
                }
                d(void 0)
            }))
        }
    }

    function jr(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Ar(n.key), n)
        }
    }

    function Cr(e, i, t) {
        return (i = Ar(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Ar(e) {
        var i = function(e) {
            if ("object" != Sr(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Sr(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Sr(i) ? i : i + ""
    }
    br(kr, "token", void 0), br(kr, "workerBlob", void 0), br(kr, "workJSBlob", void 0), kr.init();
    var Br = 0,
        Lr = function() {
            function e() {
                ! function(e, i) {
                    if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
                }(this, e)
            }
            return function(e, i, t) {
                return t && jr(e, t), Object.defineProperty(e, "prototype", {
                    writable: !1
                }), e
            }(e, 0, [{
                key: "generateStoreList",
                value: function() {
                    if (er) {
                        Il.style.display = "block", storeHolder.innerHTML = "";
                        for (var e = this.currentStoreIndex, i = e ? G.accessories : G.hats, t = function() {
                                var t = i[n];
                                if (!t.dontSell) {
                                    var r = Fr.generateElement({
                                        id: "storeDisplay".concat(n),
                                        className: "storeItem",
                                        parent: storeHolder
                                    });
                                    r.onmouseout = function() {
                                        return fr.showItemInfo()
                                    }, r.onmouseover = function() {
                                        return fr.showItemInfo(t, !1, !0)
                                    }, Fr.generateElement({
                                        tag: "img",
                                        className: "hatPreview",
                                        src: "https://dev.moomoo.io/img/".concat(e ? "accessories/access_" : "hats/hat_").concat(t.id).concat(t.topSprite ? "_p" : "", ".png"),
                                        parent: r
                                    }), Fr.generateElement({
                                        tag: "span",
                                        text: t.name,
                                        parent: r
                                    }), (e ? er.tails[t.id] : er.skins[t.id]) ? (e ? t.id == er.tailIndex : t.id == er.skinIndex) ? Fr.generateElement({
                                        className: "joinAlBtn",
                                        style: "margin-top: 5px",
                                        text: "Unequip",
                                        hookTouch: !0,
                                        parent: r
                                    }).onclick = function() {
                                        return or.storeEquip(0, e)
                                    } : Fr.generateElement({
                                        className: "joinAlBtn",
                                        style: "margin-top: 5px",
                                        text: "Equip",
                                        hookTouch: !0,
                                        parent: r
                                    }).onclick = function() {
                                        return or.storeEquip(t.id, e)
                                    } : (Fr.generateElement({
                                        className: "joinAlBtn",
                                        style: "margin-top: 5px",
                                        text: "Buy",
                                        hookTouch: !0,
                                        parent: r
                                    }).onclick = function() {
                                        return or.storeBuy(t.id, e)
                                    }, Fr.generateElement({
                                        tag: "span",
                                        className: "itemPrice",
                                        text: Fr.kFormat(t.price),
                                        parent: r
                                    }))
                                }
                            }, n = 0; n < i.length; n++) t()
                    }
                }
            }, {
                key: "getAttackDir",
                value: function(e, i, t) {
                    return i ? t && er.trapData ? Qi.aim : Math.atan2(Nl - window.innerHeight / 2, Hl - window.innerWidth / 2) : er ? ai.autoaim ? Jt.enemies.nearest ? Jt.enemies.angle : Math.atan2(Nl - window.innerHeight / 2, Hl - window.innerWidth / 2) : er.trapData ? Qi.aim : Wl || ai.autoHitActive ? Jt.enemies.nearest ? Jt.enemies.angle : Math.atan2(Nl - window.innerHeight / 2, Hl - window.innerWidth / 2) : W.toggles.autoGrind ? Math.atan2(Nl - window.innerHeight / 2, Hl - window.innerWidth / 2) : Qi.target ? Fr.getDirection(Qi.target, er) : e || Qi.tankSpam ? Math.atan2(Nl - window.innerHeight / 2, Hl - window.innerWidth / 2) : void 0 : 0
                }
            }, {
                key: "toggleChat",
                value: function() {
                    if (document.activeElement == Bl || 1 == W.menu.style.opacity && "0px" == W.items[5].style.top) {
                        var i = "privChatBox" == document.activeElement.id ? W.privChatBox : Bl;
                        if (e.closeChat(), "privChatBox" == document.activeElement.id || document.activeElement == Bl) {
                            k.send("chat", hl.value || "unknown", i.value, er.sid);
                            var t = i.value;
                            if (t.includes("!cinvis ")) {
                                var n = t.split("!cinvis ")[1];
                                k.send("invis", n)
                            }
                            document.activeElement == Bl && or.receiveChat(er.sid, i.value, !0), W.addLog("private", t, hl.value || "unknown", er.sid, !1), i.value = "", i.blur()
                        } else i.value = "", Il.style.display = "none", allianceMenu.style.display = "none", 1 == W.menu.style.opacity && "0px" == W.items[5].style.top ? W.privChatBox.focus() : i.focus(), or.resetMoveDir()
                    } else "flex" == chatHolder.style.display ? (chatBox.value && or.sendChat(chatBox.value), e.closeChat()) : (Il.style.display = "none", allianceMenu.style.display = "none", chatHolder.style.display = "flex", _l[18] ? Bl.focus() : chatBox.focus(), or.resetMoveDir()), chatBox.value = ""
                }
            }, {
                key: "updateNotifications",
                value: function() {
                    if (this.allianceNotifications[0]) {
                        var e = this.allianceNotifications[0];
                        noticationDisplay.innerHTML = "", noticationDisplay.style.display = "block";
                        var i = k.users.find((function(i) {
                            return i.sid == e.sid
                        }));
                        Fr.generateElement({
                            className: "notificationText",
                            html: "".concat(e.name).concat(i ? ' <span style="color: #f00;">('.concat(i.name, ")</span>") : "", " {").concat(e.sid, "}"),
                            parent: noticationDisplay
                        });
                        var t = Fr.generateElement({
                                className: "notifButton",
                                html: "<i class='material-icons' style='font-size: 28px; color: #cc5151;'>&#xe14c;</i>",
                                parent: noticationDisplay
                            }),
                            n = Fr.generateElement({
                                className: "notifButton",
                                html: "<i class='material-icons' style='font-size: 28px; color: #8ecc51;'>&#xe876;</i>",
                                parent: noticationDisplay
                            });
                        t.onclick = function() {
                            or.aJoinReq(0)
                        }, n.onclick = function() {
                            or.aJoinReq(1)
                        }
                    } else noticationDisplay.style.display = "none"
                }
            }, {
                key: "closeChat",
                value: function() {
                    chatBox.value = "", chatHolder.style.display = "none"
                }
            }, {
                key: "hideAllWindows",
                value: function() {
                    Il.style.display = "none", allianceMenu.style.display = "none", this.closeChat()
                }
            }, {
                key: "showAllianceMenu",
                value: function() {
                    var e = this;
                    if (er) {
                        if (this.closeChat(), Il.style.display = "none", allianceMenu.style.display = "block", allianceHolder.innerHTML = "", er.team)
                            for (var i = function() {
                                    var i = e.alliancePlayers[t],
                                        n = e.alliancePlayers[t + 1],
                                        r = Fr.generateElement({
                                            className: "allianceItem",
                                            style: "color: ".concat(i == e.playerSID ? "white" : "rgba(255, 255, 255, .6)"),
                                            text: n,
                                            parent: allianceHolder
                                        });
                                    er.isOwner && i != er.sid && (Fr.generateElement({
                                        className: "joinAlBtn",
                                        text: "Kick",
                                        hookTouch: !0,
                                        parent: r
                                    }).onclick = function() {
                                        or.kickFromClan(i)
                                    })
                                }, t = 0; t < this.alliancePlayers.length; t += 2) i();
                        else if (this.alliances.length)
                            for (var n = function(i) {
                                    var t = e.alliances[i],
                                        n = Fr.generateElement({
                                            className: "allianceItem",
                                            style: "color: ".concat(t.sid == er.team ? "#fff" : "rgba(255, 255, 255, 0.6)"),
                                            text: t.sid,
                                            parent: allianceHolder
                                        });
                                    Fr.generateElement({
                                        className: "joinAlBtn",
                                        text: "Join",
                                        parent: n
                                    }).onclick = function() {
                                        or.sendJoin(i)
                                    }
                                }, r = 0; r < this.alliances.length; r++) n(r);
                        else Fr.generateElement({
                            className: "allianceItem",
                            text: "No Tribes Yet",
                            parent: allianceHolder
                        });
                        allianceManager.innerHTML = "", er.team ? Fr.generateElement({
                            className: "allianceButtonM",
                            style: "width: 360px",
                            text: er.isOwner ? "Delete Tribe" : "Leave Tribe",
                            parent: allianceManager
                        }).onclick = function() {
                            or.leaveAlliance()
                        } : (Fr.generateElement({
                            tag: "input",
                            type: "text",
                            id: "allianceInput",
                            maxLength: 7,
                            placeholder: "unique name",
                            parent: allianceManager
                        }), Fr.generateElement({
                            tag: "div",
                            className: "allianceButtonM",
                            style: "width: 140px;",
                            text: "Create",
                            parent: allianceManager
                        }).onclick = function() {
                            or.createAlliance()
                        })
                    }
                }
            }, {
                key: "updateSkinPicker",
                value: function() {
                    var e = this;
                    playerSkinHolder.innerHTML = "";
                    for (var i = function(i) {
                            var n = document.createElement("div");
                            n.classList.add("skinColorItem"), n.style.backgroundColor = t.skinColors[i], (i == e.skinColor || 10 == i && "constructor" == e.skinColor) && n.classList.add("activeSkin"), n.onclick = function() {
                                e.skinColor = 10 == i ? "constructor" : i, e.updateSkinPicker()
                            }, playerSkinHolder.appendChild(n)
                        }, n = 0; n < t.skinColors.length; n++) i(n)
                }
            }, {
                key: "findServer",
                value: (r = Mr(Or().mark((function e() {
                    var i, t;
                    return Or().wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                            case 0:
                                return e.next = 2, fetch("https://".concat(Xl() ? "api-sandbox" : "api", ".moomoo.io/servers?v=1.26")).then((function(e) {
                                    return e.json()
                                }));
                            case 2:
                                return i = e.sent, e.prev = 3, t = new URLSearchParams(location.search).get("server").split(":"), e.abrupt("return", i.find((function(e) {
                                    return e.region == t[0] && e.name == t[1]
                                })) || i[0]);
                            case 8:
                                return e.prev = 8, e.t0 = e.catch(3), e.abrupt("return", i[0]);
                            case 11:
                            case "end":
                                return e.stop()
                        }
                    }), e, null, [
                        [3, 8]
                    ])
                }))), function() {
                    return r.apply(this, arguments)
                })
            }, {
                key: "connect",
                value: (n = Mr(Or().mark((function e() {
                    var i, t;
                    return Or().wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                            case 0:
                                if (!Br) {
                                    e.next = 4;
                                    break
                                }
                                this.wsAddress = "ws://localhost:1234", e.next = 14;
                                break;
                            case 4:
                                return e.next = 6, this.findServer();
                            case 6:
                                return i = e.sent, Te.itemLoaded(), e.next = 10, kr.default();
                            case 10:
                                t = e.sent, Te.itemLoaded(), this.wsAddress = "wss://".concat(i.key, ".").concat(i.region, ".moomoo.io/?token=").concat(t), console.log(this.wsAddress);
                            case 14:
                                Ae.connect(this.wsAddress);
                            case 15:
                            case "end":
                                return e.stop()
                        }
                    }), e, this)
                }))), function() {
                    return n.apply(this, arguments)
                })
            }, {
                key: "drawServerBrowser",
                value: (i = Mr(Or().mark((function e() {
                    var i, t, n, r, l, d, o, a, s, y, u, p, c, f, h, x, m, g;
                    return Or().wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                            case 0:
                                return e.next = 2, fetch("https://".concat(Xl() ? "api-sandbox" : "api", ".moomoo.io/servers?v=1.26")).then((function(e) {
                                    return e.json()
                                }));
                            case 2:
                                for (i = e.sent, t = {}, n = 0; n < i.length; n++) r = i[n], t[r.region] ? t[r.region].push(r) : t[r.region] = [r];
                                for (o in l = new URLSearchParams(location.search).get("server").split(":"), d = "", t) {
                                    a = new Map, s = t[o].sort((function(e, i) {
                                        return i.playerCount - e.playerCount
                                    })), y = Ir(s);
                                    try {
                                        for (y.s(); !(u = y.n()).done;) p = u.value, c = "".concat(p.region, ":").concat(p.name), a.has(c) || a.set(c, p)
                                    } catch (e) {
                                        y.e(e)
                                    } finally {
                                        y.f()
                                    }
                                    f = Ir(a);
                                    try {
                                        for (f.s(); !(h = f.n()).done;) x = Pr(h.value, 2), m = x[0], g = x[1], d += '<option value="'.concat(m, '" ').concat(g.region == l[0] && g.name == l[1] ? "selected" : "", ">").concat(m, " [").concat(g.playerCount, "/40]</option>")
                                    } catch (e) {
                                        f.e(e)
                                    } finally {
                                        f.f()
                                    }
                                    "sydney" != o && (d += "<option disabled></option>")
                                }
                                serverBrowser.innerHTML = d;
                            case 9:
                            case "end":
                                return e.stop()
                        }
                    }), e)
                }))), function() {
                    return i.apply(this, arguments)
                })
            }, {
                key: "updateStatusDisplay",
                value: function() {
                    var e = 0;
                    er.food - foodDisplay.innerText > 0 && (e += er.food - foodDisplay.innerText), er.stone - stoneDisplay.innerText > 0 && (e += er.stone - stoneDisplay.innerText), er.wood - woodDisplay.innerText > 0 && (e += er.wood - woodDisplay.innerText), Jt.nextTick((function() {
                        Ln.manage(e)
                    })), scoreDisplay.innerText = er.points, foodDisplay.innerText = er.food, woodDisplay.innerText = er.wood, stoneDisplay.innerText = er.stone, er.kills > killCounter.innerText && (Gn.addKills(), W.toggles.killChat && (or.sendChat("Dumbasses Down: ".concat(er.kills)), setTimeout((function() {
                        or.sendChat("I'm Super Pro")
                    }), 750))), killCounter.innerText = er.kills
                }
            }, {
                key: "disconnect",
                value: function(e) {
                    Ae.socket.close(), mainMenu.style.display = "block", gameUI.style.display = "none", diedText.style.display = "none", pingDisplay.style.display = "none", gameName.style.top = "0px", loadingText.style.display = "block", mainMenuItemHolder.style.display = "none", loadingText.innerText = e
                }
            }]);
            var i, n, r
        }();
    Cr(Lr, "lastPingSocket", 0), Cr(Lr, "pingTime", 0), Cr(Lr, "playerSID", void 0), Cr(Lr, "skinColor", 0), Cr(Lr, "lastDeath", {}), Cr(Lr, "alliancePlayers", []), Cr(Lr, "alliances", []), Cr(Lr, "currentStoreIndex", 0), Cr(Lr, "allianceNotifications", []);
    const Rr = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];

    function Hr(e) {
        return Hr = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Hr(e)
    }

    function Nr(e, i) {
        for (var t = 0; t < i.length; t++) {
            var n = i[t];
            n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Gr(n.key), n)
        }
    }

    function Wr(e, i, t) {
        return (i = Gr(i)) in e ? Object.defineProperty(e, i, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[i] = t, e
    }

    function Gr(e) {
        var i = function(e) {
            if ("object" != Hr(e) || !e) return e;
            var i = e[Symbol.toPrimitive];
            if (void 0 !== i) {
                var t = i.call(e, "string");
                if ("object" != Hr(t)) return t;
                throw new TypeError("@@toPrimitive must return a primitive value.")
            }
            return String(e)
        }(e);
        return "symbol" == Hr(i) ? i : i + ""
    }
    var _r = 2 * Math.PI,
        Fr = function() {
            return function(e, i, t) {
                return t && Nr(e, t), Object.defineProperty(e, "prototype", {
                    writable: !1
                }), e
            }((function e() {
                ! function(e, i) {
                    if (!(e instanceof i)) throw new TypeError("Cannot call a class as a function")
                }(this, e)
            }), 0, [{
                key: "lerp",
                value: function(e, i, t) {
                    return e + (i - e) * t
                }
            }, {
                key: "getAngleDist",
                value: function(e, i) {
                    var t = Math.abs(i - e) % (4 * Math.PI);
                    return t > Math.PI ? 4 * Math.PI - t : t
                }
            }, {
                key: "dAng",
                value: function(e, i) {
                    var t = Math.abs(e - i);
                    return (t %= _r) > Math.PI && (t = _r - t), t
                }
            }, {
                key: "findMiddlePoint",
                value: function(e, i) {
                    return {
                        x: ((e.x2 || e.x) + (i.x2 || i.x)) / 2,
                        y: ((e.y2 || e.y) + (i.y2 || i.y)) / 2
                    }
                }
            }, {
                key: "returnAvatarFormat",
                value: function(e, i) {
                    return i && e ? "https://cdn.discordapp.com/avatars/".concat(e, "/").concat(i, ".gif") : this.chickenServerIcon
                }
            }, {
                key: "uncensorChat",
                value: function(e) {
                    var i = e;
                    return Rr.forEach((function(e) {
                        if (i.indexOf(e) > -1) {
                            for (var t = "", n = 0; n < e.length; n++) 1 == n && (t += String.fromCharCode(0)), t += e[n];
                            var r = new RegExp(e, "g");
                            i = i.replace(r, t)
                        }
                    })), i
                }
            }, {
                key: "fixTo",
                value: function(e, i) {
                    return parseFloat(e.toFixed(i))
                }
            }, {
                key: "findObjectBySID",
                value: function(e) {
                    return this.objectsMaps.sidToObject.get(e)
                }
            }, {
                key: "toRad",
                value: function(e) {
                    return e * (Math.PI / 180)
                }
            }, {
                key: "toDeg",
                value: function(e) {
                    return 180 * e / Math.PI
                }
            }, {
                key: "decodeSocketMessages",
                value: function(e) {
                    var i = d.decode(new Uint8Array(e.data));
                    return [i[0], i[1]]
                }
            }, {
                key: "isAlly",
                value: function(e) {
                    return Lr.alliancePlayers.includes(e)
                }
            }, {
                key: "isFriendly",
                value: function(e) {
                    return e == Lr.playerSID || Lr.alliancePlayers.includes(e)
                }
            }, {
                key: "generateElement",
                value: function(e) {
                    var i = e.id,
                        t = e.className,
                        n = e.type,
                        r = e.maxLength,
                        l = e.placeholder,
                        d = e.tag,
                        o = e.src,
                        a = e.text,
                        s = e.html,
                        y = e.style,
                        u = e.parent,
                        p = document.createElement(d || "div");
                    return i && (p.id = i), y && (p.style = y), a && (p.innerText = a), s && (p.innerHTML = s), n && (p.type = n), r && (p.maxLength = 7), l && (p.placeholder = l), o && (p.src = o), t && p.classList.add(t), u.appendChild(p), p
                }
            }, {
                key: "lineInRect",
                value: function(e, i, t, n, r, l, d, o) {
                    var a = r,
                        s = d;
                    if (r > d && (a = d, s = r), s > t && (s = t), a < e && (a = e), a > s) return !1;
                    var y = l,
                        u = o,
                        p = d - r;
                    if (Math.abs(p) > 1e-7) {
                        var c = (o - l) / p,
                            f = l - c * r;
                        y = c * a + f, u = c * s + f
                    }
                    if (y > u) {
                        var h = u;
                        u = y, y = h
                    }
                    return u > n && (u = n), y < i && (y = i), !(y > u)
                }
            }, {
                key: "intersectsLineCircle",
                value: function(e, i, t) {
                    var n = i.x - e.x,
                        r = i.y - e.y,
                        l = e.x - t.x,
                        d = e.y - t.y,
                        o = (t.getScale() || t.scale) + 20,
                        a = n * n + r * r,
                        s = 2 * (l * n + d * r),
                        y = s * s - 4 * a * (l * l + d * d - o * o);
                    if (y < 0) return !1;
                    var u = (-s - (y = Math.sqrt(y))) / (2 * a),
                        p = (-s + y) / (2 * a);
                    return u >= 0 && u <= 1 || p >= 0 && p <= 1
                }
            }, {
                key: "randInt",
                value: function(e, i) {
                    return Math.floor(Math.random() * (i - e + 1)) + e
                }
            }, {
                key: "capitalizeFirst",
                value: function(e) {
                    return e[0].toUpperCase() + e.slice(1)
                }
            }, {
                key: "findPlayerByID",
                value: function(e) {
                    return this.playerIdMap.get(e)
                }
            }, {
                key: "findPlayerBySID",
                value: function(e) {
                    return this.playerSidMap.get(e)
                }
            }, {
                key: "findAIBySID",
                value: function(e) {
                    return this.aiSidMap.get(e)
                }
            }, {
                key: "randFloat",
                value: function(e, i) {
                    return Math.random() * (e - i + 1) + i
                }
            }, {
                key: "getDistance",
                value: function(e, i) {
                    try {
                        var t = e.x2 || e.x,
                            n = e.y2 || e.y,
                            r = i.x2 || i.x,
                            l = i.y2 || i.y;
                        return Math.hypot(n - l, t - r)
                    } catch (e) {}
                }
            }, {
                key: "getDirection",
                value: function(e, i) {
                    var t = e.x2 || e.x,
                        n = e.y2 || e.y,
                        r = i.x2 || i.x,
                        l = i.y2 || i.y;
                    return Math.atan2(n - l, t - r)
                }
            }, {
                key: "kFormat",
                value: function(e) {
                    return e >= 1e6 ? (e / 1e6).toFixed(1) + "kk" : e >= 1e3 ? (e / 1e3).toFixed(1) + "k" : e
                }
            }, {
                key: "makeElementDraggable",
                value: function(e, i) {
                    var t = 0,
                        n = 0,
                        r = !1,
                        l = !1;
                    i.addEventListener("mousedown", (function(l) {
                        var d = i.getBoundingClientRect();
                        l.clientY - d.top > 100 || (r = !0, t = l.clientX - e.offsetLeft, n = l.clientY - e.offsetTop, document.body.style.userSelect = "none")
                    })), document.addEventListener("mousemove", (function(i) {
                        r && (e.style.transition && (l = e.style.transition, e.style.transition = null), e.style.left = "".concat(i.clientX - t, "px"), e.style.top = "".concat(i.clientY - n, "px"))
                    })), document.addEventListener("mouseup", (function() {
                        r = !1, document.body.style.userSelect = "", l && (e.style.transition = l, l = !1)
                    }))
                }
            }])
        }();
    Wr(Fr, "objectsMaps", {
        sidToObject: new Map
    }), Wr(Fr, "playerSidMap", new Map), Wr(Fr, "playerIdMap", new Map), Wr(Fr, "aiSidMap", new Map), Wr(Fr, "chickenServerIcon", "https://cdn.discordapp.com/icons/747885288004648971/e1ebfb6b658acf67955c72e9aebb16ac.png"), Wr(Fr, "devauleURL", (function(e) {
        var i = new URLSearchParams(e),
            t = {};
        return i.forEach((function(e, i) {
            t[i] = e
        })), t
    })), window.tmpBuildings = [];
    var zr = '<title>Moo Moo</title>\n    <link rel="icon" type="image/x-icon" href="favicon.ico">\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link\n        href="https://fonts.googleapis.com/css2?family=Hammersmith+One&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"\n        rel="stylesheet">\n    <style>'.concat('html, body { position: relative; background-color: #000; overflow: hidden; width: 100%; height: 100%; margin: 0px; padding: 0px; } ::-webkit-input-placeholder { color: #cecece; } :-moz-placeholder { color: #cecece; opacity: 1; } ::-moz-placeholder { color: #cecece; opacity: 1; } :-ms-input-placeholder { color: #cecece; } input[type=text] { -webkit-touch-callout: text; -webkit-user-select: text; -khtml-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; } .menuLink { font-size: 20px; } a { color: #a56dc8; text-decoration: none; } a:active { color: #795094; } a:visited { color: #a56dc8; } a:hover { color: #795094; } html, body, div, input, select { font-family: "Hammersmith One"; font-size: 12px; user-select: none; } span { font-size: inherit; } #errorNotification { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); max-width: 500px; z-index: 99999; } #errorNotification .errorClose { position: absolute; top: 5px; left: 5px; } #mainMenu { background-color: rgba(0, 0, 0, 0.5); position: absolute; width: 100%; height: 100%; z-index: 10; } #menuContainer { width: 100%; white-space: nowrap; text-align: center; position: absolute; top: 45%; transform: translateY(-50%); } #pingDisplay { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: white; } #loadingText { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; font-size: 18px; color: white; pointer-events: none; text-align: center; } #closeChangelogs { position: absolute; cursor: pointer; top: 7px; right: 7px; font-size: 24px; color: white; } #changeLogElement { position: absolute; top: 0px; right: -450px; width: 450px; height: 100%; transition: all .5s ease; background-color: rgb(0, 0, 0, .3); z-index: 1000; } #changeLogTextElement { position: absolute; bottom: 0px; left: 0px; width: 100%; height: calc(100% - 40px); overflow-y: scroll; margin-left: 7px; color: white; } #mainMenuItemHolder { display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; } .menuCard, .adMenuCard { vertical-align: top; text-align: left; white-space: normal; word-wrap: break-word; margin: 5px; display: inline-block; width: 300px; padding: 18px; background-color: #fff; box-shadow: 0px 7px #c4c4c4; border-radius: 4px; overflow: hidden; } .adMenuCard { min-width: 0; min-height: 0; height: initial; width: initial; padding: 0; box-shadow: none; } .menuHeader { font-size: 24px; color: #292929; margin-bottom: 5px; } #enterGame { color: white; margin-left: 10px; background-color: #7ee559; padding: 7.25px; padding-left: 10px; padding-right: 10px; font-size: 18px; text-align: center; border: none; cursor: pointer; border-radius: 2.5px; } .menuText { font-size: 18px; color: #a8a8a8; margin-bottom: 10px; } #gameModeSelector { cursor: pointer; color: black; font-size: 16px; width: 136px; height: 37px; border: none; border-radius: 2.5px; } #altServer { width: 100%; text-align: center; margin-top: 10px; } #playerSkinHolder { margin-top: -20px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px; } .activeSkin { border-radius: 8px !important; } .skinColorItem { cursor: pointer; display: inline-block; margin-right: 10px; width: 30px; height: 30px; border-radius: 20px; border: 3px solid #525252; } .skinColorItem:hover { -webkit-border-radius: 8px; -moz-border-radius: 8px; border-radius: 8px; } .settingRadio { font-size: 18px; color: #a8a8a8; margin-bottom: 10px; } #discordButton { position: absolute; top: 35px; right: 20px; cursor: pointer; } #changelogButton { position: absolute; top: 10px; right: 20px; cursor: pointer; } #createdByElement { position: absolute; bottom: 5px; left: 5px; color: white; } .controlElementText { position: absolute; bottom: 0px; left: 0px; width: 100%; height: calc(100% - 40px); overflow-y: scroll; margin-left: 7px; color: white; } #closeControlsElement { position: absolute; cursor: pointer; top: 7px; right: 7px; font-size: 24px; color: white; } #controlsButton { position: absolute; top: 70px; right: 20px; cursor: pointer; } #controlsElement { position: absolute; top: 0px; right: -450px; width: 450px; height: 100%; transition: all .5s ease; background-color: rgb(0, 0, 0, .3); z-index: 1000; } #gameName { position: absolute; color: white; top: 70px; left: 0px; font-size: 72px; text-align: center; width: 100%; margin-bottom: -25px; text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4; } #guideCard { max-height: 250px; overflow-y: scroll; } #guideCard #smallLinks { display: none; } #guideCard #desktopInstructions { display: block; } #guideCard #mobileInstructions { display: none; } #guideCard.touch #desktopInstructions { display: none; } #guideCard.touch #mobileInstructions { display: block; } #promoImgHolder { text-align: center; } #promoImg:hover { opacity: 0.9; } #rightCardHolder { display: inline-block; vertical-align: top; } #downloadButtonContainer { display: block; text-align: center; padding-bottom: 12px; margin-top: 14px; } #downloadButtonContainer.cordova { display: none; } #mobileDownloadButtonContainer { display: none; } #mobileDownloadButtonContainer.cordova { display: none; } .downloadBadge { margin: 0 6px 0 6px; } .downloadBadge img { height: 40px; } #adCard { text-align: center; width: 300px; height: auto; } #serverBrowser { cursor: pointer; color: black; font-size: 16px; width: 136px; height: 37px; border: none; border-radius: 2.5px; } #playerNameInput { font-size: 18px; width: 213px; border: none; padding: 6px; border-radius: 2.5px; } .menuButton { text-align: center; font-size: 23px; padding: 6px; box-sizing: border-box; color: #fff; background-color: #7ee559; width: 100%; border-radius: 4px; cursor: pointer; } .menuButton:hover { background-color: #6fc94e; } .menuButton.disabled { color: #CCC; background-color: #666; } #gameUI { pointer-events: none; position: absolute; width: 100%; height: 100%; z-index: 2; } .chicken-chat-box { color: white; } .chicken-chat-box::placeholder { color: #ffc0cb; } #chickenChatBox { box-shadow: none; outline: none; padding: 6px; font-size: 20px; color: #fff; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; pointer-events: all; border: 0; margin-bottom: 10px; } #chatHolder { position: absolute; align-items: center; justify-content: center; flex-direction: column; bottom: 200px; width: 100%; text-align: center; } #chatBox { padding: 6px; font-size: 20px; color: #fff; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; pointer-events: all; border: 0; } #chatBox:focus { outline: none; } #topInfoHolder { position: absolute; top: 20px; left: 20px; } #leaderboard { color: #fff; font-size: 26px; text-align: left; padding: 10px; padding-top: 7px; padding-bottom: 5px; width: 220px; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; } .leaderHolder { display: flex; align-items: center; overflow: hidden; white-space: nowrap; } #killCounter { bottom: 185px; color: #fff; font-size: 28px; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; background-image: url("https://dev.moomoo.io/img/icons/skull.png"); } .leaderScore { text-align: right; margin-left: auto; display: inline-block; font-size: 14px; } .leaderboardItem { display: inline-block; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -o-text-overflow: ellipsis; font-size: 14px; } .uiElement, .resourceDisplay { background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; color: #fff; padding: 10px; padding-top: 5px; padding-bottom: 5px; font-size: 28px; } .resourceDisplay { position: absolute; right: 20px; height: 35px; text-align: right; line-height: 39px; padding-left: 10px; padding-right: 40px; background-size: 28px; background-repeat: no-repeat; background-position: right 6px center; } #foodDisplay { background-image: url("https://dev.moomoo.io/img/resources/food_ico.png"); } #woodDisplay { background-image: url("https://dev.moomoo.io/img/resources/wood_ico.png"); } #stoneDisplay { background-image: url("https://dev.moomoo.io/img/resources/stone_ico.png"); } #scoreDisplay { right: inherit; left: 20px; bottom: 160px; text-align: left; padding-left: 40px; padding-right: 10px; background-position: left 6px center; background-image: url("https://dev.moomoo.io/img/resources/gold_ico.png"); } #stoneDisplay { bottom: 20px; } #woodDisplay { bottom: 75px; } #foodDisplay { bottom: 130px; } #actionBar { position: absolute; bottom: 17px; width: 100%; text-align: center; } .actionBarItem { width: 66px; height: 66px; margin-left: 5px; margin-right: 5px; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; display: inline-block; cursor: pointer; pointer-events: all; background-size: cover; } .actionBarItem:hover { background-color: rgba(50, 50, 50, 0.25); } .itemIcon { width: 66px; height: 66px; } #mapDisplay { position: absolute; bottom: 20px; left: 20px; display: inline-block; width: 130px; height: 130px; pointer-events: all; background-size: 100% 100%; background-image: url("https://i.imgur.com/fgFsQJp.png"); background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; } .gameButton { position: absolute; top: 20px; padding: 5px; cursor: pointer; pointer-events: all; } .gameButton:hover { background-color: rgba(50, 50, 50, 0.25); } #allianceButton { left: 330px; } #storeButton { left: 270px; } #storeMenu { display: none; width: 100%; position: absolute; text-align: center; top: 50%; transform: translateY(-50%); } #storeHolder { pointer-events: all; width: 400px; display: inline-block; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; color: #fff; padding: 10px; height: 200px; max-height: calc(100vh - 200px); overflow-y: scroll; } .storeTab { width: 183px; font-size: 26px; display: inline-block; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; color: #fff; padding: 10px; pointer-events: all; cursor: pointer; } .storeTab:hover { background-color: rgba(50, 50, 50, 0.25); } .storeItem { color: #fff; padding: 5px; font-size: 24px; text-align: left; cursor: pointer; } .itemCounts { position: absolute; top: 0; padding-left: 5px; font-size: 2em; color: #fff; } .weaponXPActionBar { position: absolute; bottom: 0px; left: 0px; height: 3px; } .itemPrice { float: right; margin-top: 5px; color: rgba(255, 255, 255, 0.5); font-size: 24px; padding-right: 5px; } .hatPreview { margin-top: -5px; width: 45px; height: 45px; display: inline-block; vertical-align: middle; padding-right: 10px; } #allianceMenu { display: none; width: 100%; position: absolute; text-align: center; top: 50%; transform: translateY(-50%); } #allianceHolder { pointer-events: all; height: 200px; max-height: calc(100vh - 260px); overflow-y: scroll; width: 350px; display: inline-block; text-align: left; padding: 10px; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; } .allianceItem { font-size: 24px; color: #fff; padding: 5px; } .joinAlBtn { float: right; font-size: 24px; text-align: right; cursor: pointer; color: #80eefc; } .joinAlBtn:hover { color: #72d3e0; } .notificationText { vertical-align: top; font-size: 25px; color: #fff; display: inline-block; } .notifButton { padding: 5px; margin-left: 10px; display: inline-block; cursor: pointer; pointer-events: all; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; } .error-message { z-index: 1001; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 550px; height: 300px; background-color: rgb(0, 0, 0, .85); border-radius: 6px; } .notifButton:hover { background-color: rgba(50, 50, 50, 0.25); } #noticationDisplay { vertical-align: top; position: absolute; right: 20px; top: 20px; text-align: right; } .allianceButtonM { pointer-events: all; cursor: pointer; margin-top: 10px; font-size: 24px; color: #fff; padding: 5px; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; padding: 5px; text-align: center; display: inline-block; } .allianceButtonM:hover { background-color: rgba(50, 50, 50, 0.25); } #allianceInput { pointer-events: all; font-size: 24px; color: #fff; background-color: rgba(0, 0, 0, 0.25); border-radius: 4px; padding: 5px; display: inline-block; outline: none; border: none; box-shadow: none; width: 210px; margin-right: 10px; } #itemInfoHolder { max-width: 250px; display: none; position: absolute; top: 80px; left: 270px; } #itemInfoHolder.visible { display: block; } #itemInfoName { font-size: 30px; } #itemInfoDesc { font-size: 22px; color: rgba(255, 255, 255, 0.6); } .itemInfoReq { font-size: 22px; } .itemInfoReqVal { font-size: 22px; color: rgba(255, 255, 255, 0.6); } .itemInfoLmt { font-size: 22px; position: absolute; right: 10px; bottom: 6px; } #ageBarContainer { position: absolute; width: 100%; bottom: 93px; text-align: center; } #ageText { position: absolute; width: 100%; bottom: 118px; text-align: center; color: #fff; font-size: 24px; } #ageBar { background-color: rgba(0, 0, 0, 0.25); border-radius: 5px; padding: 5px; width: 314px; height: 10px; display: inline-block; } #ageBarBody { background-color: rgba(255, 255, 255, 1); border-radius: 3px; width: 0px; height: 100%; } #upgradeHolder { width: 100%; position: absolute; text-align: center; top: 50px; } #upgradeCounter { width: 100%; position: absolute; top: 125px; text-align: center; font-size: 24px; color: #fff; } #gameCanvas { width: 100%; height: 100%; background-color: #b6db66; z-index: 1; } .war-robots-effect { position: absolute; left: -250px; transition: bottom 0.7s ease, left 0.7s ease; width: 125px; height: 40px; border-radius: 4px; overflow: hidden; background-color: rgb(0, 0, 0, .3); } #diedText { display: none; font-size: 150px; color: #fff; background-color: rgba(0, 0, 0, 0.25); width: 100%; padding: 0px; position: absolute; text-align: center; top: 50%; transform: translateY(-50%); pointer-events: none; } #pre-content-container { position: absolute; left: 0; right: 0; top: 0; bottom: 0; width: 100%; background: rgba(0, 0, 0, 0.8); z-index: 1000; } #pre-content-player { position: absolute; width: 640px; left: 50%; top: 50%; transform: translate(-50%, -50%); } #post-ad-join { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100px; height: 100px; background: red; } #force-skip-ad { position: absolute; top: 8px; left: 8px; } .grecaptcha-badge { visibility: collapse !important; opacity: 0 !important; } #touch-controls-left, #touch-controls-right, #touch-controls-fullscreen { position: absolute; width: 50%; height: 100%; top: 0px; bottom: 0px; display: none; } #touch-controls-fullscreen { width: 100%; } #touch-controls-right { left: 50%; } #bottomContainer { position: absolute; bottom: 0px; left: 0px; right: 0px; } #loadingMenu { position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; } #loadingBarLoadingTextBackground { margin-top: -17px; margin-left: 5px; } #loadingBarGameName { position: absolute; top: 10px; left: 10px; font-size: 64px; color: white; } #loadingBarHolder { position: absolute; bottom: 0px; left: 0px; height: 17px; width: 100%; background-color: rgba(0, 0, 0, .65); } #loadingBar { position: absolute; bottom: 0px; left: 0px; height: 100%; width: 75%; background-color: #80eefc; } #loadingBarText { position: absolute; display: flex; align-items: center; right: 7px; height: 100%; font-size: 8px; top: 0px; color: white; } #darkModeLoadingTransition { display: none; pointer-events: none; position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; background-color: rgba(0, 0, 0, .9); transition: all .2s; } #menuElement { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 650px; height: 450px; } .new-menu { position: absolute; left: 50%; top: 50%; width: 600px; height: 675px; background-color: rgba(255, 255, 255, 0.65); border-radius: 20px; backdrop-filter: blur(20px); box-shadow: rgba(0, 0, 0, .2) 0px 0px 8px; z-index: 9999999; overflow: hidden; font-family: "Roboto"; } .menuTabDisplay { position: absolute; top: 0px; left: 0px; width: 200px; height: 100%; background-color: rgba(0, 0, 0, .125); } .menuContentDisplay { position: absolute; top: 50px; left: 200px; height: calc(100% - 50px); width: calc(100% - 200px); } .upperActionBar { position: absolute; display: flex; align-items: center; top: 0px; left: 200px; height: 50px; width: calc(100% - 200px); } .upperActionBarItem { cursor: pointer; margin-left: 20px; color: rgb(128, 128, 128); } .upperActionBarItem:hover { color: rgb(85, 85, 85); } .menuSearchBarHolder { position: absolute; display: flex; align-items: center; top: 30px; left: 50%; width: calc(100% - 30px); transform: translateX(-50%); background-color: rgba(255, 255, 255, .4); overflow: hidden; border-radius: 8px; color: rgb(128, 128, 128); } .menuTabButton { position: absolute; display: flex; align-items: center; left: 50%; transform: translateX(-50%); width: calc(100% - 30px); height: 27.5px; border-radius: 8px; cursor: pointer; } .menuTabButton:hover { background-color: rgb(0 137 255); } .menuSearchBarInput { font-family: "Roboto"; font-weight: 450; color: black; border: none; height: 27.5px; outline: none; background: none; margin-left: 2px; width: 135px; } .menuSearchBarInput::-webkit-search-cancel-button { cursor: pointer; margin-left: 2px; } .menuItem { position: absolute; left: 50%; transform: translateX(-50%); width: calc(100% - 30px); height: 30px; border-radius: 6px; font-weight: 450; font-family: "Roboto"; background-color: rgba(0, 0, 0, .125); } ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.3); border-radius: 10px; } ::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.5); } * { scrollbar-width: thin; scrollbar-color: rgba(0, 0, 0, 0.3) transparent; }', '</style>\n    <link href="https://dev.moomoo.io/css/material-icons.css" rel="stylesheet">\n\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link\n        href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"\n        rel="stylesheet">');

    function Ur(e) {
        return Ur = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
            return typeof e
        } : function(e) {
            return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        }, Ur(e)
    }

    function Vr() {
        Vr = function() {
            return i
        };
        var e, i = {},
            t = Object.prototype,
            n = t.hasOwnProperty,
            r = Object.defineProperty || function(e, i, t) {
                e[i] = t.value
            },
            l = "function" == typeof Symbol ? Symbol : {},
            d = l.iterator || "@@iterator",
            o = l.asyncIterator || "@@asyncIterator",
            a = l.toStringTag || "@@toStringTag";

        function s(e, i, t) {
            return Object.defineProperty(e, i, {
                value: t,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }), e[i]
        }
        try {
            s({}, "")
        } catch (e) {
            s = function(e, i, t) {
                return e[i] = t
            }
        }

        function y(e, i, t, n) {
            var l = i && i.prototype instanceof m ? i : m,
                d = Object.create(l.prototype),
                o = new M(n || []);
            return r(d, "_invoke", {
                value: T(e, t, o)
            }), d
        }

        function u(e, i, t) {
            try {
                return {
                    type: "normal",
                    arg: e.call(i, t)
                }
            } catch (e) {
                return {
                    type: "throw",
                    arg: e
                }
            }
        }
        i.wrap = y;
        var p = "suspendedStart",
            c = "suspendedYield",
            f = "executing",
            h = "completed",
            x = {};

        function m() {}

        function g() {}

        function v() {}
        var b = {};
        s(b, d, (function() {
            return this
        }));
        var w = Object.getPrototypeOf,
            k = w && w(w(j([])));
        k && k !== t && n.call(k, d) && (b = k);
        var S = v.prototype = m.prototype = Object.create(b);

        function P(e) {
            ["next", "throw", "return"].forEach((function(i) {
                s(e, i, (function(e) {
                    return this._invoke(i, e)
                }))
            }))
        }

        function I(e, i) {
            function t(r, l, d, o) {
                var a = u(e[r], e, l);
                if ("throw" !== a.type) {
                    var s = a.arg,
                        y = s.value;
                    return y && "object" == Ur(y) && n.call(y, "__await") ? i.resolve(y.__await).then((function(e) {
                        t("next", e, d, o)
                    }), (function(e) {
                        t("throw", e, d, o)
                    })) : i.resolve(y).then((function(e) {
                        s.value = e, d(s)
                    }), (function(e) {
                        return t("throw", e, d, o)
                    }))
                }
                o(a.arg)
            }
            var l;
            r(this, "_invoke", {
                value: function(e, n) {
                    function r() {
                        return new i((function(i, r) {
                            t(e, n, i, r)
                        }))
                    }
                    return l = l ? l.then(r, r) : r()
                }
            })
        }

        function T(i, t, n) {
            var r = p;
            return function(l, d) {
                if (r === f) throw Error("Generator is already running");
                if (r === h) {
                    if ("throw" === l) throw d;
                    return {
                        value: e,
                        done: !0
                    }
                }
                for (n.method = l, n.arg = d;;) {
                    var o = n.delegate;
                    if (o) {
                        var a = D(o, n);
                        if (a) {
                            if (a === x) continue;
                            return a
                        }
                    }
                    if ("next" === n.method) n.sent = n._sent = n.arg;
                    else if ("throw" === n.method) {
                        if (r === p) throw r = h, n.arg;
                        n.dispatchException(n.arg)
                    } else "return" === n.method && n.abrupt("return", n.arg);
                    r = f;
                    var s = u(i, t, n);
                    if ("normal" === s.type) {
                        if (r = n.done ? h : c, s.arg === x) continue;
                        return {
                            value: s.arg,
                            done: n.done
                        }
                    }
                    "throw" === s.type && (r = h, n.method = "throw", n.arg = s.arg)
                }
            }
        }

        function D(i, t) {
            var n = t.method,
                r = i.iterator[n];
            if (r === e) return t.delegate = null, "throw" === n && i.iterator.return && (t.method = "return", t.arg = e, D(i, t), "throw" === t.method) || "return" !== n && (t.method = "throw", t.arg = new TypeError("The iterator does not provide a '" + n + "' method")), x;
            var l = u(r, i.iterator, t.arg);
            if ("throw" === l.type) return t.method = "throw", t.arg = l.arg, t.delegate = null, x;
            var d = l.arg;
            return d ? d.done ? (t[i.resultName] = d.value, t.next = i.nextLoc, "return" !== t.method && (t.method = "next", t.arg = e), t.delegate = null, x) : d : (t.method = "throw", t.arg = new TypeError("iterator result is not an object"), t.delegate = null, x)
        }

        function O(e) {
            var i = {
                tryLoc: e[0]
            };
            1 in e && (i.catchLoc = e[1]), 2 in e && (i.finallyLoc = e[2], i.afterLoc = e[3]), this.tryEntries.push(i)
        }

        function E(e) {
            var i = e.completion || {};
            i.type = "normal", delete i.arg, e.completion = i
        }

        function M(e) {
            this.tryEntries = [{
                tryLoc: "root"
            }], e.forEach(O, this), this.reset(!0)
        }

        function j(i) {
            if (i || "" === i) {
                var t = i[d];
                if (t) return t.call(i);
                if ("function" == typeof i.next) return i;
                if (!isNaN(i.length)) {
                    var r = -1,
                        l = function t() {
                            for (; ++r < i.length;)
                                if (n.call(i, r)) return t.value = i[r], t.done = !1, t;
                            return t.value = e, t.done = !0, t
                        };
                    return l.next = l
                }
            }
            throw new TypeError(Ur(i) + " is not iterable")
        }
        return g.prototype = v, r(S, "constructor", {
            value: v,
            configurable: !0
        }), r(v, "constructor", {
            value: g,
            configurable: !0
        }), g.displayName = s(v, a, "GeneratorFunction"), i.isGeneratorFunction = function(e) {
            var i = "function" == typeof e && e.constructor;
            return !!i && (i === g || "GeneratorFunction" === (i.displayName || i.name))
        }, i.mark = function(e) {
            return Object.setPrototypeOf ? Object.setPrototypeOf(e, v) : (e.__proto__ = v, s(e, a, "GeneratorFunction")), e.prototype = Object.create(S), e
        }, i.awrap = function(e) {
            return {
                __await: e
            }
        }, P(I.prototype), s(I.prototype, o, (function() {
            return this
        })), i.AsyncIterator = I, i.async = function(e, t, n, r, l) {
            void 0 === l && (l = Promise);
            var d = new I(y(e, t, n, r), l);
            return i.isGeneratorFunction(t) ? d : d.next().then((function(e) {
                return e.done ? e.value : d.next()
            }))
        }, P(S), s(S, a, "Generator"), s(S, d, (function() {
            return this
        })), s(S, "toString", (function() {
            return "[object Generator]"
        })), i.keys = function(e) {
            var i = Object(e),
                t = [];
            for (var n in i) t.push(n);
            return t.reverse(),
                function e() {
                    for (; t.length;) {
                        var n = t.pop();
                        if (n in i) return e.value = n, e.done = !1, e
                    }
                    return e.done = !0, e
                }
        }, i.values = j, M.prototype = {
            constructor: M,
            reset: function(i) {
                if (this.prev = 0, this.next = 0, this.sent = this._sent = e, this.done = !1, this.delegate = null, this.method = "next", this.arg = e, this.tryEntries.forEach(E), !i)
                    for (var t in this) "t" === t.charAt(0) && n.call(this, t) && !isNaN(+t.slice(1)) && (this[t] = e)
            },
            stop: function() {
                this.done = !0;
                var e = this.tryEntries[0].completion;
                if ("throw" === e.type) throw e.arg;
                return this.rval
            },
            dispatchException: function(i) {
                if (this.done) throw i;
                var t = this;

                function r(n, r) {
                    return o.type = "throw", o.arg = i, t.next = n, r && (t.method = "next", t.arg = e), !!r
                }
                for (var l = this.tryEntries.length - 1; l >= 0; --l) {
                    var d = this.tryEntries[l],
                        o = d.completion;
                    if ("root" === d.tryLoc) return r("end");
                    if (d.tryLoc <= this.prev) {
                        var a = n.call(d, "catchLoc"),
                            s = n.call(d, "finallyLoc");
                        if (a && s) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0);
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        } else if (a) {
                            if (this.prev < d.catchLoc) return r(d.catchLoc, !0)
                        } else {
                            if (!s) throw Error("try statement without catch or finally");
                            if (this.prev < d.finallyLoc) return r(d.finallyLoc)
                        }
                    }
                }
            },
            abrupt: function(e, i) {
                for (var t = this.tryEntries.length - 1; t >= 0; --t) {
                    var r = this.tryEntries[t];
                    if (r.tryLoc <= this.prev && n.call(r, "finallyLoc") && this.prev < r.finallyLoc) {
                        var l = r;
                        break
                    }
                }
                l && ("break" === e || "continue" === e) && l.tryLoc <= i && i <= l.finallyLoc && (l = null);
                var d = l ? l.completion : {};
                return d.type = e, d.arg = i, l ? (this.method = "next", this.next = l.finallyLoc, x) : this.complete(d)
            },
            complete: function(e, i) {
                if ("throw" === e.type) throw e.arg;
                return "break" === e.type || "continue" === e.type ? this.next = e.arg : "return" === e.type ? (this.rval = this.arg = e.arg, this.method = "return", this.next = "end") : "normal" === e.type && i && (this.next = i), x
            },
            finish: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.finallyLoc === e) return this.complete(t.completion, t.afterLoc), E(t), x
                }
            },
            catch: function(e) {
                for (var i = this.tryEntries.length - 1; i >= 0; --i) {
                    var t = this.tryEntries[i];
                    if (t.tryLoc === e) {
                        var n = t.completion;
                        if ("throw" === n.type) {
                            var r = n.arg;
                            E(t)
                        }
                        return r
                    }
                }
                throw Error("illegal catch attempt")
            },
            delegateYield: function(i, t, n) {
                return this.delegate = {
                    iterator: j(i),
                    resultName: t,
                    nextLoc: n
                }, "next" === this.method && (this.arg = e), x
            }
        }, i
    }

    function qr(e, i, t, n, r, l, d) {
        try {
            var o = e[l](d),
                a = o.value
        } catch (e) {
            return void t(e)
        }
        o.done ? i(a) : Promise.resolve(a).then(n, r)
    }

    function Xr(e) {
        return function() {
            var i = this,
                t = arguments;
            return new Promise((function(n, r) {
                var l = e.apply(i, t);

                function d(e) {
                    qr(l, n, r, d, o, "next", e)
                }

                function o(e) {
                    qr(l, n, r, d, o, "throw", e)
                }
                d(void 0)
            }))
        }
    }

    function Yr(e) {
        return localStorage.getItem(e)
    }

    function Kr(e, i) {
        localStorage.setItem(e, i)
    }
    document.head.innerHTML = zr, document.body.innerHTML = ' <div id="pre-content-container" style="display: none;"></div> <div id="errorNotification" class="menuCard" style="display: none;"> <div style="text-align: center;"> <a onclick="errorNtification.style.display = \'none\';" style="cursor: pointer;">Hide</a> </div> </div> <div id="loadingMenu"> <div id="loadingBarGameName"> <div style="font-size: inherit;">MOOMOO.io</div> <div id="loadingBarLoadingTextBackground"> <div style="font-size: 16px; font-weight: 900; width: 100%; text-align: center; background-color: white; color: black; mix-blend-mode: screen;"> LOADING CHICKEN MOD... </div> </div> </div> <div id="loadingBarHolder"> <div id="loadingBar"></div> <div id="loadingBarText">0% Loaded</div> </div> <div id="darkModeLoadingTransition"></div> </div> <div id="mainMenu" style="display: none;"> <div id="menuElement"> <div id="gameName"> Chicken <span style="color: #fff; text-shadow: 0 0 5px #000, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #fff, 0 0 25px #fff, 0 0 30px #fff, 0 0 35px #fff;"> V4 </span> </div> <div id="loadingText"></div> <div id="mainMenuItemHolder"> <div style="margin-bottom: -12.5px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;"> <div> <div style="color: white;">Game Mode</div> <select id="gameModeSelector"> <option value="normal">Normal</option> <option value="sandbox">Experimental</option> </select> </div> <div style="margin-left: 10px;"> <div style="color: white;">Region</div> <select id="serverBrowser"> <option>Loading...</option> </select> </div> </div> <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;"> <input type="text" maxlength="15" id="playerNameInput" placeholder="Enter username"> <button id="enterGame"> Play! </button> </div> <div id="playerSkinHolder"></div> <div style="margin-top: -10px; width: 100%; color: white; text-align: center;"> Welcome back, <span id="mainMenuUsernameDisplay">unknown user</span>! </div> </div> </div> <div id="changelogButton"> <div style="display: flex; align-items: center; color: white;"> <i class="material-icons" style="font-size: 30px; vertical-align: middle;">history</i> <span style="margin-left: 5px; font-size: 18px;">Changelogs / Dev Logs</span> </div> </div> <div id="changeLogElement"> <div style="position: absolute; top: 7px; left: 7px; font-size: 24px; color: white;">Changelog</div> <div id="closeChangelogs"> <i class="material-icons" style="font-size: 30px; vertical-align: middle;">close</i> </div> <div id="changeLogTextElement"> Loading Changelogs / Dev logs </div> </div> <div id="discordButton" onclick="location.href = \'https://discord.gg/AFYkkKTZq4\';"> <div style="display: flex; align-items: center; color: white;"> <div style="width: 40px; height: 40px; background-size: 40px 40px; background-image: url(\'https://i.imgur.com/hop81pW.png\');"> </div> <span style="font-size: 18px;">Discord</span> </div> </div> <div id="controlsButton"> <div style="display: flex; align-items: center; color: white;"> <i class="material-icons" style="font-size: 30px; vertical-align: middle;">help</i> <span style="margin-left: 5px; font-size: 18px;">Help</span> </div> </div> <div id="controlsElement"> <div style="position: absolute; top: 7px; left: 7px; font-size: 24px; color: white;">Controls / Help</div> <div id="closeControlsElement"> <i class="material-icons" style="font-size: 30px; vertical-align: middle;">close</i> </div> <div class="controlElementText"> Desktop Controls: <div style="margin-left: 7px;"> Movement: W, A, S, D<br> Aim: Mouse<br> Auto Tank Hits: Left Click<br> Auto Bullspam: Space Hold<br> Auto Mills: Z<br> Trap / Boost Pad: F<br> Turret / Teleporter: H<br> Spike: V<br> Toggle ATOS (Auto-Trigger OneShot): R<br> Auto Song: Shift + C<br> Debug: Shift + Z<br> </div> <br> Other info: <div style="margin-left: 7px;"> Reading the Notes section of the script\'s menu can be very helpful! </div> </div> </div> <div id="createdByElement"> Game created by <a href="https://frvr.com/" style="cursor: pointer;" target="_blank">FRVR</a><br> Script created by <a href="https://www.youtube.com/@memeganoob" style="cursor: pointer;" target="_blank">mega</a> </div> </div> <div id="pingDisplay" hidden>Not connected</div> <div id="diedText">YOU DIED</div> <div id="gameUI" style="display: none;"> <div id="chatHolder" style="display: none;"> <input id="chickenChatBox" class="chicken-chat-box" placeholder="Enter Message" maxlength="100"> <input id="chatBox" placeholder="Enter Message" maxlength="30"> </div> <div id="upgradeHolder"></div> <div id="upgradeCounter"></div> <div id="topInfoHolder"> <div id="leaderboard"> Leaderboard <div id="leaderboardData"></div> </div> </div> <div id="itemInfoHolder" class="uiElement"></div> <div id="resDisplay"> <div id="killCounter" class="resourceDisplay"></div> <div id="foodDisplay" class="resourceDisplay"></div> <div id="woodDisplay" class="resourceDisplay"></div> <div id="stoneDisplay" class="resourceDisplay"></div> <div id="scoreDisplay" class="resourceDisplay"></div> </div> <div id="bottomContainer"> <div id="ageText"></div> <div id="ageBarContainer"> <div id="ageBar"> <div id="ageBarBody"></div> </div> </div> <div id="actionBar"></div> </div> <div id="noticationDisplay" style="display: none;"></div> <div id="allianceButton" class="uiElement gameButton"> <i class="material-icons" style="font-size: 40px; vertical-align: middle;">&#xE8D3;</i> </div> <div id="storeButton" class="uiElement gameButton"> <i class="material-icons" style="font-size: 40px; vertical-align: middle;">&#xE8D1;</i> </div> <canvas id="mapDisplay" width="300" height="300"></canvas> <div id="storeMenu"> <div style="padding-bottom: 15px;"> <div class="storeTab" style="margin-right:10px" onclick="changeStoreIndex(0)">Hats</div> <div class="storeTab" onclick="changeStoreIndex(1)">Accessories</div> </div> <div id="storeHolder"></div> </div> <div id="allianceMenu"> <div id="allianceHolder"></div> <div id="allianceManager"></div> </div> </div> <canvas id="gameCanvas"></canvas>';
    var Zr = document.getElementById("mainMenu"),
        Qr = document.getElementById("gameCanvas"),
        Jr = Qr.getContext("2d"),
        $r = document.getElementById("mapDisplay"),
        el = $r.getContext("2d"),
        il = document.getElementById("loadingMenu"),
        tl = (document.getElementById("loadingText"), document.getElementById("gameName"), document.getElementById("mainMenuItemHolder")),
        nl = document.getElementById("mainMenuUsernameDisplay"),
        rl = (document.getElementById("playerSkinHolder"), document.getElementById("serverBrowser")),
        ll = document.getElementById("gameModeSelector"),
        dl = document.getElementById("changeLogTextElement"),
        ol = (document.getElementById("closeChangelogs"), document.getElementById("changelogButton")),
        al = document.getElementById("changeLogElement"),
        sl = document.getElementById("discordButton"),
        yl = document.getElementById("controlsButton"),
        ul = document.getElementById("controlsElement"),
        pl = document.getElementById("closeControlsElement"),
        cl = (document.getElementById("actionBar"), document.getElementById("itemInfoHolder")),
        fl = document.getElementById("enterGame"),
        hl = document.getElementById("playerNameInput"),
        xl = document.getElementById("pingDisplay"),
        ml = document.getElementById("gameUI"),
        gl = document.getElementById("leaderboardData"),
        vl = (document.getElementById("scoreDisplay"), document.getElementById("killCounter")),
        bl = document.getElementById("foodDisplay"),
        wl = document.getElementById("woodDisplay"),
        kl = document.getElementById("stoneDisplay"),
        Sl = document.getElementById("ageText"),
        Pl = document.getElementById("ageBarBody"),
        Il = document.getElementById("storeMenu"),
        Tl = document.getElementById("allianceMenu"),
        Dl = document.getElementById("upgradeHolder"),
        Ol = document.getElementById("upgradeCounter"),
        El = document.getElementById("diedText"),
        Ml = (document.getElementById("allianceHolder"), document.getElementById("allianceManager"), document.getElementById("allianceButton")),
        jl = (document.getElementById("noticationDisplay"), document.getElementById("chatBox"), document.getElementById("darkModeLoadingTransition")),
        Cl = document.getElementById("loadingBarLoadingTextBackground"),
        Al = (document.getElementById("chatHolder"), document.getElementById("storeButton")),
        Bl = (document.getElementById("storeHolder"), document.getElementById("chickenChatBox")),
        Ll = document.getElementById("loadingBar"),
        Rl = document.getElementById("loadingBarText"),
        Hl = 0,
        Nl = 0,
        Wl = 0;

    function Gl() {
        Wl = 0
    }
    W.init(), rl.onchange = Xr(Vr().mark((function e() {
        return Vr().wrap((function(e) {
            for (;;) switch (e.prev = e.next) {
                case 0:
                    location.href = "/?server=".concat(rl.value);
                case 1:
                case "end":
                    return e.stop()
            }
        }), e)
    })));
    var _l = {},
        Fl = {
            87: [0, -1],
            38: [0, -1],
            83: [0, 1],
            40: [0, 1],
            65: [-1, 0],
            37: [-1, 0],
            68: [1, 0],
            39: [1, 0]
        };

    function zl() {
        return ("INPUT" != document.activeElement.tagName || "number" != document.activeElement.type && "text" != document.activeElement.type) && "chickenChatBox" != document.activeElement.id && "chatBox" != document.activeElement.id && "allianceInput" != document.activeElement.id
    }

    function Ul() {
        var e = wt.maxScreenWidth,
            i = wt.maxScreenHeight,
            t = window.innerWidth,
            n = window.innerHeight,
            r = Math.max(t / e, n / i);
        Qr.width = t, Qr.height = n, Qr.style.width = t + "px", Qr.style.height = n + "px", Jr.setTransform(r, 0, 0, r, (t - e * r) / 2, (n - i * r) / 2)
    }
    document.addEventListener("keydown", function() {
        var e = Xr(Vr().mark((function e(i) {
            var n, r, l, d;
            return Vr().wrap((function(e) {
                for (;;) switch (e.prev = e.next) {
                    case 0:
                        if (n = i.which || i.keyCode || 0, r = i.key, 27 == n) Lr.hideAllWindows(), W.toggleMenu();
                        else if (er && zl())
                            if (_l[n] = 1, "z" == r) jt.mills.status = !jt.mills.status;
                            else if (69 == n) or.sendAutoGather();
                        else if ("P" == r);
                        else if ("=" == r) wt.maxScreenWidth = t.maxScreenWidth, wt.maxScreenHeight = t.maxScreenHeight, Ul(), Jt.updateCursor();
                        else if ("Z" == r) Jt.tickQueue = [], Jt.nextQueue = [], Jt.tick = -1, Jt.grid = void 0, Vi.itemSprites = {}, Vi.gameObjectSprites = {};
                        else if (r == W.keyBinds.oneTickKey) ki.status = !0;
                        else if (r == W.keyBinds.atosKey) ai.ATOS = !ai.ATOS;
                        else if (Fl[n]) Gi.updateMovementDir();
                        else if (null != er.weapons[n - 49]) Jt.weaponIndex = er.weapons[n - 49], or.selectToBuild(er.weapons[n - 49], !0);
                        else if (null != er.items[n - 49 - er.weapons.length]) or.selectToBuild(er.items[n - 49 - er.weapons.length]);
                        else if (81 == n) or.selectToBuild(er.items[0]);
                        else if (190 == n) {
                            if (er.team) {
                                for (l = 0; l < st.bots.length; l++)(d = st.bots[l]).disconnected || (d.rangedSync = !0);
                                Ae.send("S", 1)
                            }
                        } else 32 == n ? Wl = 1 : W.doKeyBindActions(i);
                    case 3:
                    case "end":
                        return e.stop()
                }
            }), e)
        })));
        return function(i) {
            return e.apply(this, arguments)
        }
    }()), document.addEventListener("keyup", (function(e) {
        var i = e.which || e.keyCode || 0,
            t = e.key;
        _l[i] = 0, 13 == i ? Lr.toggleChat() : er && zl() && (Fl[i] ? Gi.updateMovementDir() : 32 == i ? Wl = 0 : t == W.keyBinds.oneTickKey && (ki.status = !1))
    })), window.addEventListener("resize", Ul), Ul(), window.oncontextmenu = function(e) {
        return e.preventDefault()
    }, CanvasRenderingContext2D.prototype.roundRect = function(e, i, t, n, r) {
        return t < 2 * r && (r = t / 2), n < 2 * r && (r = n / 2), r < 0 && (r = 0), this.beginPath(), this.moveTo(e + r, i), this.arcTo(e + t, i, e + t, i + n, r), this.arcTo(e + t, i + n, e, i + n, r), this.arcTo(e, i + n, e, i, r), this.arcTo(e, i, e + t, i, r), this.closePath(), this
    }, Ml.onclick = function() {
        or.resetMoveDir(), "block" != Tl.style.display ? (Il.style.display = "none", Lr.closeChat(), Lr.showAllianceMenu()) : Tl.style.display = "none"
    }, Al.onclick = function() {
        or.resetMoveDir(), "block" != Il.style.display ? (Tl.style.display = "none", Lr.closeChat(), Lr.generateStoreList()) : Il.style.display = "none"
    }, window.changeStoreIndex = function(e) {
        Lr.currentStoreIndex != e && (Lr.currentStoreIndex = e, Lr.generateStoreList())
    }, Qr.addEventListener("click", (function(e) {
        0 == e.button && (Qi.tankSpam = !Qi.tankSpam)
    })), Qr.addEventListener("wheel", (function(e) {
        e.deltaY > 0 ? (wt.maxScreenWidth *= .95, wt.maxScreenHeight *= .95) : (wt.maxScreenWidth /= .95, wt.maxScreenHeight /= .95), Ul(), Jt.updateCursor()
    }), {
        passive: !0
    }), window.addEventListener("mousemove", (function(e) {
        Hl = e.clientX, Nl = e.clientY, Jt.updateCursor()
    })), window.requestAnimationFrame((function() {
        wt.loadIcons(), wt.drawVolancoImage(), wt.doUpdate()
    })), Math.lerpAngle = function(e, i, t) {
        Math.abs(i - e) > Math.PI && (e > i ? i += 2 * Math.PI : e += 2 * Math.PI);
        var n = i + (e - i) * t;
        return n >= 0 && n <= 2 * Math.PI ? n : n % (2 * Math.PI)
    };
    var Vl, ql = setTimeout((function() {
        fr.start()
    }), 500);

    function Xl() {
        return Yl.apply(this, arguments)
    }

    function Yl() {
        return (Yl = Xr(Vr().mark((function e() {
            return Vr().wrap((function(e) {
                for (;;) switch (e.prev = e.next) {
                    case 0:
                        if ("boolean" != typeof Vl) {
                            e.next = 2;
                            break
                        }
                        return e.abrupt("return", Vl);
                    case 2:
                        return (Vl = location.hostname.includes("sandbox")) && (vl.style.bottom = "20px", bl.style.display = "none", wl.style.display = "none", kl.style.display = "none"), e.abrupt("return", Vl);
                    case 5:
                    case "end":
                        return e.stop()
                }
            }), e)
        })))).apply(this, arguments)
    }
    window.onload = Xr(Vr().mark((function e() {
        return Vr().wrap((function(e) {
            for (;;) switch (e.prev = e.next) {
                case 0:
                    return e.next = 2, Xl();
                case 2:
                    fr.start(), clearTimeout(ql);
                case 4:
                case "end":
                    return e.stop()
            }
        }), e)
    })))
})();
