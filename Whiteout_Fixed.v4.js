// ==UserScript==
// @name         whiteout abdo
// @match        *://*.moomoo.io/*
// @grant        none
// @version      v4
// @description
// @icon         https://img.freepik.com/free-photo/abstract-surface-textures-white-concrete-stone-wall_74190-8189.jpg
// @author       hanabira (combat and some UI) and nexoos (menu)
// @run-at       document-start
// ==/UserScript==

const WhiteoutNet = (function () {

var se = 4294967295;
function Ur(t, e, r) {
    var i = r / 4294967296
      , n = r;
    t.setUint32(e, i),
    t.setUint32(e + 4, n)
}
function Wt(t, e, r) {
    var i = Math.floor(r / 4294967296)
      , n = r;
    t.setUint32(e, i),
    t.setUint32(e + 4, n)
}
function Yt(t, e) {
    var r = t.getInt32(e)
      , i = t.getUint32(e + 4);
    return r * 4294967296 + i
}
function Sr(t, e) {
    var r = t.getUint32(e)
      , i = t.getUint32(e + 4);
    return r * 4294967296 + i
}
var $e, Be, Le, _e = (typeof process > "u" || (($e = process == null ? void 0 : process.env) === null || $e === void 0 ? void 0 : $e.TEXT_ENCODING) !== "never") && typeof TextEncoder < "u" && typeof TextDecoder < "u";
function _t(t) {
    for (var e = t.length, r = 0, i = 0; i < e; ) {
        var n = t.charCodeAt(i++);
        if (n & 4294967168)
            if (!(n & 4294965248))
                r += 2;
            else {
                if (n >= 55296 && n <= 56319 && i < e) {
                    var s = t.charCodeAt(i);
                    (s & 64512) === 56320 && (++i,
                    n = ((n & 1023) << 10) + (s & 1023) + 65536)
                }
                n & 4294901760 ? r += 4 : r += 3
            }
        else {
            r++;
            continue
        }
    }
    return r
}
function Or(t, e, r) {
    for (var i = t.length, n = r, s = 0; s < i; ) {
        var c = t.charCodeAt(s++);
        if (c & 4294967168)
            if (!(c & 4294965248))
                e[n++] = c >> 6 & 31 | 192;
            else {
                if (c >= 55296 && c <= 56319 && s < i) {
                    var f = t.charCodeAt(s);
                    (f & 64512) === 56320 && (++s,
                    c = ((c & 1023) << 10) + (f & 1023) + 65536)
                }
                c & 4294901760 ? (e[n++] = c >> 18 & 7 | 240,
                e[n++] = c >> 12 & 63 | 128,
                e[n++] = c >> 6 & 63 | 128) : (e[n++] = c >> 12 & 15 | 224,
                e[n++] = c >> 6 & 63 | 128)
            }
        else {
            e[n++] = c;
            continue
        }
        e[n++] = c & 63 | 128
    }
}
var ge = _e ? new TextEncoder : void 0
  , Ir = _e ? typeof process < "u" && ((Be = process == null ? void 0 : process.env) === null || Be === void 0 ? void 0 : Be.TEXT_ENCODING) !== "force" ? 200 : 0 : se;
function Ar(t, e, r) {
    e.set(ge.encode(t), r)
}
function Cr(t, e, r) {
    ge.encodeInto(t, e.subarray(r))
}
var Mr = ge?.encodeInto ? Cr : Ar
  , Pr = 4096;
function Kt(t, e, r) {
    for (var i = e, n = i + r, s = [], c = ""; i < n; ) {
        var f = t[i++];
        if (!(f & 128))
            s.push(f);
        else if ((f & 224) === 192) {
            var y = t[i++] & 63;
            s.push((f & 31) << 6 | y)
        } else if ((f & 240) === 224) {
            var y = t[i++] & 63
              , u = t[i++] & 63;
            s.push((f & 31) << 12 | y << 6 | u)
        } else if ((f & 248) === 240) {
            var y = t[i++] & 63
              , u = t[i++] & 63
              , h = t[i++] & 63
              , p = (f & 7) << 18 | y << 12 | u << 6 | h;
            p > 65535 && (p -= 65536,
            s.push(p >>> 10 & 1023 | 55296),
            p = 56320 | p & 1023),
            s.push(p)
        } else
            s.push(f);
        s.length >= Pr && (c += String.fromCharCode.apply(String, s),
        s.length = 0)
    }
    return s.length > 0 && (c += String.fromCharCode.apply(String, s)),
    c
}
var Dr = _e ? new TextDecoder : null
  , Fr = _e ? typeof process < "u" && ((Le = process == null ? void 0 : process.env) === null || Le === void 0 ? void 0 : Le.TEXT_DECODER) !== "force" ? 200 : 0 : se;
function Rr(t, e, r) {
    var i = t.subarray(e, e + r);
    return Dr.decode(i)
}
var ve = function() {
    function t(e, r) {
        this.type = e,
        this.data = r
    }
    return t
}()
  , Nr = globalThis && globalThis.__extends || function() {
    var t = function(e, r) {
        return t = Object.setPrototypeOf || {
            __proto__: []
        }instanceof Array && function(i, n) {
            i.__proto__ = n
        }
        || function(i, n) {
            for (var s in n)
                Object.prototype.hasOwnProperty.call(n, s) && (i[s] = n[s])
        }
        ,
        t(e, r)
    };
    return function(e, r) {
        if (typeof r != "function" && r !== null)
            throw new TypeError("Class extends value " + String(r) + " is not a constructor or null");
        t(e, r);
        function i() {
            this.constructor = e
        }
        e.prototype = r === null ? Object.create(r) : (i.prototype = r.prototype,
        new i)
    }
}()
  , G = function(t) {
    Nr(e, t);
    function e(r) {
        var i = t.call(this, r) || this
          , n = Object.create(e.prototype);
        return Object.setPrototypeOf(i, n),
        Object.defineProperty(i, "name", {
            configurable: !0,
            enumerable: !1,
            value: e.name
        }),
        i
    }
    return e
}(Error)
  , $r = -1
  , Br = 4294967296 - 1
  , Lr = 17179869184 - 1;
function qr(t) {
    var e = t.sec
      , r = t.nsec;
    if (e >= 0 && r >= 0 && e <= Lr)
        if (r === 0 && e <= Br) {
            var i = new Uint8Array(4)
              , n = new DataView(i.buffer);
            return n.setUint32(0, e),
            i
        } else {
            var s = e / 4294967296
              , c = e & 4294967295
              , i = new Uint8Array(8)
              , n = new DataView(i.buffer);
            return n.setUint32(0, r << 2 | s & 3),
            n.setUint32(4, c),
            i
        }
    else {
        var i = new Uint8Array(12)
          , n = new DataView(i.buffer);
        return n.setUint32(0, r),
        Wt(n, 4, e),
        i
    }
}
function Hr(t) {
    var e = t.getTime()
      , r = Math.floor(e / 1e3)
      , i = (e - r * 1e3) * 1e6
      , n = Math.floor(i / 1e9);
    return {
        sec: r + n,
        nsec: i - n * 1e9
    }
}
function Vr(t) {
    if (t instanceof Date) {
        var e = Hr(t);
        return qr(e)
    } else
        return null
}
function jr(t) {
    var e = new DataView(t.buffer,t.byteOffset,t.byteLength);
    switch (t.byteLength) {
    case 4:
        {
            var r = e.getUint32(0)
              , i = 0;
            return {
                sec: r,
                nsec: i
            }
        }
    case 8:
        {
            var n = e.getUint32(0)
              , s = e.getUint32(4)
              , r = (n & 3) * 4294967296 + s
              , i = n >>> 2;
            return {
                sec: r,
                nsec: i
            }
        }
    case 12:
        {
            var r = Yt(e, 4)
              , i = e.getUint32(0);
            return {
                sec: r,
                nsec: i
            }
        }
    default:
        throw new G("Unrecognized data size for timestamp (expected 4, 8, or 12): ".concat(t.length))
    }
}
function Xr(t) {
    var e = jr(t);
    return new Date(e.sec * 1e3 + e.nsec / 1e6)
}
var Wr = {
    type: $r,
    encode: Vr,
    decode: Xr
}
  , Gt = function() {
    function t() {
        this.builtInEncoders = [],
        this.builtInDecoders = [],
        this.encoders = [],
        this.decoders = [],
        this.register(Wr)
    }
    return t.prototype.register = function(e) {
        var r = e.type
          , i = e.encode
          , n = e.decode;
        if (r >= 0)
            this.encoders[r] = i,
            this.decoders[r] = n;
        else {
            var s = 1 + r;
            this.builtInEncoders[s] = i,
            this.builtInDecoders[s] = n
        }
    }
    ,
    t.prototype.tryToEncode = function(e, r) {
        for (var i = 0; i < this.builtInEncoders.length; i++) {
            var n = this.builtInEncoders[i];
            if (n != null) {
                var s = n(e, r);
                if (s != null) {
                    var c = -1 - i;
                    return new ve(c,s)
                }
            }
        }
        for (var i = 0; i < this.encoders.length; i++) {
            var n = this.encoders[i];
            if (n != null) {
                var s = n(e, r);
                if (s != null) {
                    var c = i;
                    return new ve(c,s)
                }
            }
        }
        return e instanceof ve ? e : null
    }
    ,
    t.prototype.decode = function(e, r, i) {
        var n = r < 0 ? this.builtInDecoders[-1 - r] : this.decoders[r];
        return n ? n(e, r, i) : new ve(r,e)
    }
    ,
    t.defaultCodec = new t,
    t
}();
function Te(t) {
    return t instanceof Uint8Array ? t : ArrayBuffer.isView(t) ? new Uint8Array(t.buffer,t.byteOffset,t.byteLength) : t instanceof ArrayBuffer ? new Uint8Array(t) : Uint8Array.from(t)
}
function Yr(t) {
    if (t instanceof ArrayBuffer)
        return new DataView(t);
    var e = Te(t);
    return new DataView(e.buffer,e.byteOffset,e.byteLength)
}
var Kr = 100
  , Gr = 2048
  , yn = function() {
    function t(e, r, i, n, s, c, f, y) {
        e === void 0 && (e = Gt.defaultCodec),
        r === void 0 && (r = void 0),
        i === void 0 && (i = Kr),
        n === void 0 && (n = Gr),
        s === void 0 && (s = !1),
        c === void 0 && (c = !1),
        f === void 0 && (f = !1),
        y === void 0 && (y = !1),
        this.extensionCodec = e,
        this.context = r,
        this.maxDepth = i,
        this.initialBufferSize = n,
        this.sortKeys = s,
        this.forceFloat32 = c,
        this.ignoreUndefined = f,
        this.forceIntegerToFloat = y,
        this.pos = 0,
        this.view = new DataView(new ArrayBuffer(this.initialBufferSize)),
        this.bytes = new Uint8Array(this.view.buffer)
    }
    return t.prototype.reinitializeState = function() {
        this.pos = 0
    }
    ,
    t.prototype.encodeSharedRef = function(e) {
        return this.reinitializeState(),
        this.doEncode(e, 1),
        this.bytes.subarray(0, this.pos)
    }
    ,
    t.prototype.encode = function(e) {
        return this.reinitializeState(),
        this.doEncode(e, 1),
        this.bytes.slice(0, this.pos)
    }
    ,
    t.prototype.doEncode = function(e, r) {
        if (r > this.maxDepth)
            throw new Error("Too deep objects in depth ".concat(r));
        e == null ? this.encodeNil() : typeof e == "boolean" ? this.encodeBoolean(e) : typeof e == "number" ? this.encodeNumber(e) : typeof e == "string" ? this.encodeString(e) : this.encodeObject(e, r)
    }
    ,
    t.prototype.ensureBufferSizeToWrite = function(e) {
        var r = this.pos + e;
        this.view.byteLength < r && this.resizeBuffer(r * 2)
    }
    ,
    t.prototype.resizeBuffer = function(e) {
        var r = new ArrayBuffer(e)
          , i = new Uint8Array(r)
          , n = new DataView(r);
        i.set(this.bytes),
        this.view = n,
        this.bytes = i
    }
    ,
    t.prototype.encodeNil = function() {
        this.writeU8(192)
    }
    ,
    t.prototype.encodeBoolean = function(e) {
        e === !1 ? this.writeU8(194) : this.writeU8(195)
    }
    ,
    t.prototype.encodeNumber = function(e) {
        Number.isSafeInteger(e) && !this.forceIntegerToFloat ? e >= 0 ? e < 128 ? this.writeU8(e) : e < 256 ? (this.writeU8(204),
        this.writeU8(e)) : e < 65536 ? (this.writeU8(205),
        this.writeU16(e)) : e < 4294967296 ? (this.writeU8(206),
        this.writeU32(e)) : (this.writeU8(207),
        this.writeU64(e)) : e >= -32 ? this.writeU8(224 | e + 32) : e >= -128 ? (this.writeU8(208),
        this.writeI8(e)) : e >= -32768 ? (this.writeU8(209),
        this.writeI16(e)) : e >= -2147483648 ? (this.writeU8(210),
        this.writeI32(e)) : (this.writeU8(211),
        this.writeI64(e)) : this.forceFloat32 ? (this.writeU8(202),
        this.writeF32(e)) : (this.writeU8(203),
        this.writeF64(e))
    }
    ,
    t.prototype.writeStringHeader = function(e) {
        if (e < 32)
            this.writeU8(160 + e);
        else if (e < 256)
            this.writeU8(217),
            this.writeU8(e);
        else if (e < 65536)
            this.writeU8(218),
            this.writeU16(e);
        else if (e < 4294967296)
            this.writeU8(219),
            this.writeU32(e);
        else
            throw new Error("Too long string: ".concat(e, " bytes in UTF-8"))
    }
    ,
    t.prototype.encodeString = function(e) {
        var r = 5
          , i = e.length;
        if (i > Ir) {
            var n = _t(e);
            this.ensureBufferSizeToWrite(r + n),
            this.writeStringHeader(n),
            Mr(e, this.bytes, this.pos),
            this.pos += n
        } else {
            var n = _t(e);
            this.ensureBufferSizeToWrite(r + n),
            this.writeStringHeader(n),
            Or(e, this.bytes, this.pos),
            this.pos += n
        }
    }
    ,
    t.prototype.encodeObject = function(e, r) {
        var i = this.extensionCodec.tryToEncode(e, this.context);
        if (i != null)
            this.encodeExtension(i);
        else if (Array.isArray(e))
            this.encodeArray(e, r);
        else if (ArrayBuffer.isView(e))
            this.encodeBinary(e);
        else if (typeof e == "object")
            this.encodeMap(e, r);
        else
            throw new Error("Unrecognized object: ".concat(Object.prototype.toString.apply(e)))
    }
    ,
    t.prototype.encodeBinary = function(e) {
        var r = e.byteLength;
        if (r < 256)
            this.writeU8(196),
            this.writeU8(r);
        else if (r < 65536)
            this.writeU8(197),
            this.writeU16(r);
        else if (r < 4294967296)
            this.writeU8(198),
            this.writeU32(r);
        else
            throw new Error("Too large binary: ".concat(r));
        var i = Te(e);
        this.writeU8a(i)
    }
    ,
    t.prototype.encodeArray = function(e, r) {
        var i = e.length;
        if (i < 16)
            this.writeU8(144 + i);
        else if (i < 65536)
            this.writeU8(220),
            this.writeU16(i);
        else if (i < 4294967296)
            this.writeU8(221),
            this.writeU32(i);
        else
            throw new Error("Too large array: ".concat(i));
        for (var n = 0, s = e; n < s.length; n++) {
            var c = s[n];
            this.doEncode(c, r + 1)
        }
    }
    ,
    t.prototype.countWithoutUndefined = function(e, r) {
        for (var i = 0, n = 0, s = r; n < s.length; n++) {
            var c = s[n];
            e[c] !== void 0 && i++
        }
        return i
    }
    ,
    t.prototype.encodeMap = function(e, r) {
        var i = Object.keys(e);
        this.sortKeys && i.sort();
        var n = this.ignoreUndefined ? this.countWithoutUndefined(e, i) : i.length;
        if (n < 16)
            this.writeU8(128 + n);
        else if (n < 65536)
            this.writeU8(222),
            this.writeU16(n);
        else if (n < 4294967296)
            this.writeU8(223),
            this.writeU32(n);
        else
            throw new Error("Too large map object: ".concat(n));
        for (var s = 0, c = i; s < c.length; s++) {
            var f = c[s]
              , y = e[f];
            this.ignoreUndefined && y === void 0 || (this.encodeString(f),
            this.doEncode(y, r + 1))
        }
    }
    ,
    t.prototype.encodeExtension = function(e) {
        var r = e.data.length;
        if (r === 1)
            this.writeU8(212);
        else if (r === 2)
            this.writeU8(213);
        else if (r === 4)
            this.writeU8(214);
        else if (r === 8)
            this.writeU8(215);
        else if (r === 16)
            this.writeU8(216);
        else if (r < 256)
            this.writeU8(199),
            this.writeU8(r);
        else if (r < 65536)
            this.writeU8(200),
            this.writeU16(r);
        else if (r < 4294967296)
            this.writeU8(201),
            this.writeU32(r);
        else
            throw new Error("Too large extension object: ".concat(r));
        this.writeI8(e.type),
        this.writeU8a(e.data)
    }
    ,
    t.prototype.writeU8 = function(e) {
        this.ensureBufferSizeToWrite(1),
        this.view.setUint8(this.pos, e),
        this.pos++
    }
    ,
    t.prototype.writeU8a = function(e) {
        var r = e.length;
        this.ensureBufferSizeToWrite(r),
        this.bytes.set(e, this.pos),
        this.pos += r
    }
    ,
    t.prototype.writeI8 = function(e) {
        this.ensureBufferSizeToWrite(1),
        this.view.setInt8(this.pos, e),
        this.pos++
    }
    ,
    t.prototype.writeU16 = function(e) {
        this.ensureBufferSizeToWrite(2),
        this.view.setUint16(this.pos, e),
        this.pos += 2
    }
    ,
    t.prototype.writeI16 = function(e) {
        this.ensureBufferSizeToWrite(2),
        this.view.setInt16(this.pos, e),
        this.pos += 2
    }
    ,
    t.prototype.writeU32 = function(e) {
        this.ensureBufferSizeToWrite(4),
        this.view.setUint32(this.pos, e),
        this.pos += 4
    }
    ,
    t.prototype.writeI32 = function(e) {
        this.ensureBufferSizeToWrite(4),
        this.view.setInt32(this.pos, e),
        this.pos += 4
    }
    ,
    t.prototype.writeF32 = function(e) {
        this.ensureBufferSizeToWrite(4),
        this.view.setFloat32(this.pos, e),
        this.pos += 4
    }
    ,
    t.prototype.writeF64 = function(e) {
        this.ensureBufferSizeToWrite(8),
        this.view.setFloat64(this.pos, e),
        this.pos += 8
    }
    ,
    t.prototype.writeU64 = function(e) {
        this.ensureBufferSizeToWrite(8),
        Ur(this.view, this.pos, e),
        this.pos += 8
    }
    ,
    t.prototype.writeI64 = function(e) {
        this.ensureBufferSizeToWrite(8),
        Wt(this.view, this.pos, e),
        this.pos += 8
    }
    ,
    t
}();
function qe(t) {
    return "".concat(t < 0 ? "-" : "", "0x").concat(Math.abs(t).toString(16).padStart(2, "0"))
}
var Jr = 16
  , Qr = 16
  , Zr = function() {
    function t(e, r) {
        e === void 0 && (e = Jr),
        r === void 0 && (r = Qr),
        this.maxKeyLength = e,
        this.maxLengthPerKey = r,
        this.hit = 0,
        this.miss = 0,
        this.caches = [];
        for (var i = 0; i < this.maxKeyLength; i++)
            this.caches.push([])
    }
    return t.prototype.canBeCached = function(e) {
        return e > 0 && e <= this.maxKeyLength
    }
    ,
    t.prototype.find = function(e, r, i) {
        var n = this.caches[i - 1];
        e: for (var s = 0, c = n; s < c.length; s++) {
            for (var f = c[s], y = f.bytes, u = 0; u < i; u++)
                if (y[u] !== e[r + u])
                    continue e;
            return f.str
        }
        return null
    }
    ,
    t.prototype.store = function(e, r) {
        var i = this.caches[e.length - 1]
          , n = {
            bytes: e,
            str: r
        };
        i.length >= this.maxLengthPerKey ? i[Math.random() * i.length | 0] = n : i.push(n)
    }
    ,
    t.prototype.decode = function(e, r, i) {
        var n = this.find(e, r, i);
        if (n != null)
            return this.hit++,
            n;
        this.miss++;
        var s = Kt(e, r, i)
          , c = Uint8Array.prototype.slice.call(e, r, r + i);
        return this.store(c, s),
        s
    }
    ,
    t
}()
  , ei = globalThis && globalThis.__awaiter || function(t, e, r, i) {
    function n(s) {
        return s instanceof r ? s : new r(function(c) {
            c(s)
        }
        )
    }
    return new (r || (r = Promise))(function(s, c) {
        function f(h) {
            try {
                u(i.next(h))
            } catch (p) {
                c(p)
            }
        }
        function y(h) {
            try {
                u(i.throw(h))
            } catch (p) {
                c(p)
            }
        }
        function u(h) {
            h.done ? s(h.value) : n(h.value).then(f, y)
        }
        u((i = i.apply(t, e || [])).next())
    }
    )
}
  , He = globalThis && globalThis.__generator || function(t, e) {
    var r = {
        label: 0,
        sent: function() {
            if (s[0] & 1)
                throw s[1];
            return s[1]
        },
        trys: [],
        ops: []
    }, i, n, s, c;
    return c = {
        next: f(0),
        throw: f(1),
        return: f(2)
    },
    typeof Symbol == "function" && (c[Symbol.iterator] = function() {
        return this
    }
    ),
    c;
    function f(u) {
        return function(h) {
            return y([u, h])
        }
    }
    function y(u) {
        if (i)
            throw new TypeError("Generator is already executing.");
        for (; r; )
            try {
                if (i = 1,
                n && (s = u[0] & 2 ? n.return : u[0] ? n.throw || ((s = n.return) && s.call(n),
                0) : n.next) && !(s = s.call(n, u[1])).done)
                    return s;
                switch (n = 0,
                s && (u = [u[0] & 2, s.value]),
                u[0]) {
                case 0:
                case 1:
                    s = u;
                    break;
                case 4:
                    return r.label++,
                    {
                        value: u[1],
                        done: !1
                    };
                case 5:
                    r.label++,
                    n = u[1],
                    u = [0];
                    continue;
                case 7:
                    u = r.ops.pop(),
                    r.trys.pop();
                    continue;
                default:
                    if (s = r.trys,
                    !(s = s.length > 0 && s[s.length - 1]) && (u[0] === 6 || u[0] === 2)) {
                        r = 0;
                        continue
                    }
                    if (u[0] === 3 && (!s || u[1] > s[0] && u[1] < s[3])) {
                        r.label = u[1];
                        break
                    }
                    if (u[0] === 6 && r.label < s[1]) {
                        r.label = s[1],
                        s = u;
                        break
                    }
                    if (s && r.label < s[2]) {
                        r.label = s[2],
                        r.ops.push(u);
                        break
                    }
                    s[2] && r.ops.pop(),
                    r.trys.pop();
                    continue
                }
                u = e.call(t, r)
            } catch (h) {
                u = [6, h],
                n = 0
            } finally {
                i = s = 0
            }
        if (u[0] & 5)
            throw u[1];
        return {
            value: u[0] ? u[1] : void 0,
            done: !0
        }
    }
}
  , zt = globalThis && globalThis.__asyncValues || function(t) {
    if (!Symbol.asyncIterator)
        throw new TypeError("Symbol.asyncIterator is not defined.");
    var e = t[Symbol.asyncIterator], r;
    return e ? e.call(t) : (t = typeof __values == "function" ? __values(t) : t[Symbol.iterator](),
    r = {},
    i("next"),
    i("throw"),
    i("return"),
    r[Symbol.asyncIterator] = function() {
        return this
    }
    ,
    r);
    function i(s) {
        r[s] = t[s] && function(c) {
            return new Promise(function(f, y) {
                c = t[s](c),
                n(f, y, c.done, c.value)
            }
            )
        }
    }
    function n(s, c, f, y) {
        Promise.resolve(y).then(function(u) {
            s({
                value: u,
                done: f
            })
        }, c)
    }
}
  , fe = globalThis && globalThis.__await || function(t) {
    return this instanceof fe ? (this.v = t,
    this) : new fe(t)
}
  , ti = globalThis && globalThis.__asyncGenerator || function(t, e, r) {
    if (!Symbol.asyncIterator)
        throw new TypeError("Symbol.asyncIterator is not defined.");
    var i = r.apply(t, e || []), n, s = [];
    return n = {},
    c("next"),
    c("throw"),
    c("return"),
    n[Symbol.asyncIterator] = function() {
        return this
    }
    ,
    n;
    function c(d) {
        i[d] && (n[d] = function(m) {
            return new Promise(function(v, x) {
                s.push([d, m, v, x]) > 1 || f(d, m)
            }
            )
        }
        )
    }
    function f(d, m) {
        try {
            y(i[d](m))
        } catch (v) {
            p(s[0][3], v)
        }
    }
    function y(d) {
        d.value instanceof fe ? Promise.resolve(d.value.v).then(u, h) : p(s[0][2], d)
    }
    function u(d) {
        f("next", d)
    }
    function h(d) {
        f("throw", d)
    }
    function p(d, m) {
        d(m),
        s.shift(),
        s.length && f(s[0][0], s[0][1])
    }
}
  , ri = function(t) {
    var e = typeof t;
    return e === "string" || e === "number"
}
  , de = -1
  , ft = new DataView(new ArrayBuffer(0))
  , ii = new Uint8Array(ft.buffer)
  , rt = function() {
    try {
        ft.getInt8(0)
    } catch (t) {
        return t.constructor
    }
    throw new Error("never reached")
}()
  , Ut = new rt("Insufficient data")
  , ni = new Zr
  , kn = function() {
    function t(e, r, i, n, s, c, f, y) {
        e === void 0 && (e = Gt.defaultCodec),
        r === void 0 && (r = void 0),
        i === void 0 && (i = se),
        n === void 0 && (n = se),
        s === void 0 && (s = se),
        c === void 0 && (c = se),
        f === void 0 && (f = se),
        y === void 0 && (y = ni),
        this.extensionCodec = e,
        this.context = r,
        this.maxStrLength = i,
        this.maxBinLength = n,
        this.maxArrayLength = s,
        this.maxMapLength = c,
        this.maxExtLength = f,
        this.keyDecoder = y,
        this.totalPos = 0,
        this.pos = 0,
        this.view = ft,
        this.bytes = ii,
        this.headByte = de,
        this.stack = []
    }
    return t.prototype.reinitializeState = function() {
        this.totalPos = 0,
        this.headByte = de,
        this.stack.length = 0
    }
    ,
    t.prototype.setBuffer = function(e) {
        this.bytes = Te(e),
        this.view = Yr(this.bytes),
        this.pos = 0
    }
    ,
    t.prototype.appendBuffer = function(e) {
        if (this.headByte === de && !this.hasRemaining(1))
            this.setBuffer(e);
        else {
            var r = this.bytes.subarray(this.pos)
              , i = Te(e)
              , n = new Uint8Array(r.length + i.length);
            n.set(r),
            n.set(i, r.length),
            this.setBuffer(n)
        }
    }
    ,
    t.prototype.hasRemaining = function(e) {
        return this.view.byteLength - this.pos >= e
    }
    ,
    t.prototype.createExtraByteError = function(e) {
        var r = this
          , i = r.view
          , n = r.pos;
        return new RangeError("Extra ".concat(i.byteLength - n, " of ").concat(i.byteLength, " byte(s) found at buffer[").concat(e, "]"))
    }
    ,
    t.prototype.decode = function(e) {
        this.reinitializeState(),
        this.setBuffer(e);
        var r = this.doDecodeSync();
        if (this.hasRemaining(1))
            throw this.createExtraByteError(this.pos);
        return r
    }
    ,
    t.prototype.decodeMulti = function(e) {
        return He(this, function(r) {
            switch (r.label) {
            case 0:
                this.reinitializeState(),
                this.setBuffer(e),
                r.label = 1;
            case 1:
                return this.hasRemaining(1) ? [4, this.doDecodeSync()] : [3, 3];
            case 2:
                return r.sent(),
                [3, 1];
            case 3:
                return [2]
            }
        })
    }
    ,
    t.prototype.decodeAsync = function(e) {
        var r, i, n, s;
        return ei(this, void 0, void 0, function() {
            var c, f, y, u, h, p, d, m;
            return He(this, function(v) {
                switch (v.label) {
                case 0:
                    c = !1,
                    v.label = 1;
                case 1:
                    v.trys.push([1, 6, 7, 12]),
                    r = zt(e),
                    v.label = 2;
                case 2:
                    return [4, r.next()];
                case 3:
                    if (i = v.sent(),
                    !!i.done)
                        return [3, 5];
                    if (y = i.value,
                    c)
                        throw this.createExtraByteError(this.totalPos);
                    this.appendBuffer(y);
                    try {
                        f = this.doDecodeSync(),
                        c = !0
                    } catch (x) {
                        if (!(x instanceof rt))
                            throw x
                    }
                    this.totalPos += this.pos,
                    v.label = 4;
                case 4:
                    return [3, 2];
                case 5:
                    return [3, 12];
                case 6:
                    return u = v.sent(),
                    n = {
                        error: u
                    },
                    [3, 12];
                case 7:
                    return v.trys.push([7, , 10, 11]),
                    i && !i.done && (s = r.return) ? [4, s.call(r)] : [3, 9];
                case 8:
                    v.sent(),
                    v.label = 9;
                case 9:
                    return [3, 11];
                case 10:
                    if (n)
                        throw n.error;
                    return [7];
                case 11:
                    return [7];
                case 12:
                    if (c) {
                        if (this.hasRemaining(1))
                            throw this.createExtraByteError(this.totalPos);
                        return [2, f]
                    }
                    throw h = this,
                    p = h.headByte,
                    d = h.pos,
                    m = h.totalPos,
                    new RangeError("Insufficient data in parsing ".concat(qe(p), " at ").concat(m, " (").concat(d, " in the current buffer)"))
                }
            })
        })
    }
    ,
    t.prototype.decodeArrayStream = function(e) {
        return this.decodeMultiAsync(e, !0)
    }
    ,
    t.prototype.decodeStream = function(e) {
        return this.decodeMultiAsync(e, !1)
    }
    ,
    t.prototype.decodeMultiAsync = function(e, r) {
        return ti(this, arguments, function() {
            var n, s, c, f, y, u, h, p, d;
            return He(this, function(m) {
                switch (m.label) {
                case 0:
                    n = r,
                    s = -1,
                    m.label = 1;
                case 1:
                    m.trys.push([1, 13, 14, 19]),
                    c = zt(e),
                    m.label = 2;
                case 2:
                    return [4, fe(c.next())];
                case 3:
                    if (f = m.sent(),
                    !!f.done)
                        return [3, 12];
                    if (y = f.value,
                    r && s === 0)
                        throw this.createExtraByteError(this.totalPos);
                    this.appendBuffer(y),
                    n && (s = this.readArraySize(),
                    n = !1,
                    this.complete()),
                    m.label = 4;
                case 4:
                    m.trys.push([4, 9, , 10]),
                    m.label = 5;
                case 5:
                    return [4, fe(this.doDecodeSync())];
                case 6:
                    return [4, m.sent()];
                case 7:
                    return m.sent(),
                    --s === 0 ? [3, 8] : [3, 5];
                case 8:
                    return [3, 10];
                case 9:
                    if (u = m.sent(),
                    !(u instanceof rt))
                        throw u;
                    return [3, 10];
                case 10:
                    this.totalPos += this.pos,
                    m.label = 11;
                case 11:
                    return [3, 2];
                case 12:
                    return [3, 19];
                case 13:
                    return h = m.sent(),
                    p = {
                        error: h
                    },
                    [3, 19];
                case 14:
                    return m.trys.push([14, , 17, 18]),
                    f && !f.done && (d = c.return) ? [4, fe(d.call(c))] : [3, 16];
                case 15:
                    m.sent(),
                    m.label = 16;
                case 16:
                    return [3, 18];
                case 17:
                    if (p)
                        throw p.error;
                    return [7];
                case 18:
                    return [7];
                case 19:
                    return [2]
                }
            })
        })
    }
    ,
    t.prototype.doDecodeSync = function() {
        e: for (; ; ) {
            var e = this.readHeadByte()
              , r = void 0;
            if (e >= 224)
                r = e - 256;
            else if (e < 192)
                if (e < 128)
                    r = e;
                else if (e < 144) {
                    var i = e - 128;
                    if (i !== 0) {
                        this.pushMapState(i),
                        this.complete();
                        continue e
                    } else
                        r = {}
                } else if (e < 160) {
                    var i = e - 144;
                    if (i !== 0) {
                        this.pushArrayState(i),
                        this.complete();
                        continue e
                    } else
                        r = []
                } else {
                    var n = e - 160;
                    r = this.decodeUtf8String(n, 0)
                }
            else if (e === 192)
                r = null;
            else if (e === 194)
                r = !1;
            else if (e === 195)
                r = !0;
            else if (e === 202)
                r = this.readF32();
            else if (e === 203)
                r = this.readF64();
            else if (e === 204)
                r = this.readU8();
            else if (e === 205)
                r = this.readU16();
            else if (e === 206)
                r = this.readU32();
            else if (e === 207)
                r = this.readU64();
            else if (e === 208)
                r = this.readI8();
            else if (e === 209)
                r = this.readI16();
            else if (e === 210)
                r = this.readI32();
            else if (e === 211)
                r = this.readI64();
            else if (e === 217) {
                var n = this.lookU8();
                r = this.decodeUtf8String(n, 1)
            } else if (e === 218) {
                var n = this.lookU16();
                r = this.decodeUtf8String(n, 2)
            } else if (e === 219) {
                var n = this.lookU32();
                r = this.decodeUtf8String(n, 4)
            } else if (e === 220) {
                var i = this.readU16();
                if (i !== 0) {
                    this.pushArrayState(i),
                    this.complete();
                    continue e
                } else
                    r = []
            } else if (e === 221) {
                var i = this.readU32();
                if (i !== 0) {
                    this.pushArrayState(i),
                    this.complete();
                    continue e
                } else
                    r = []
            } else if (e === 222) {
                var i = this.readU16();
                if (i !== 0) {
                    this.pushMapState(i),
                    this.complete();
                    continue e
                } else
                    r = {}
            } else if (e === 223) {
                var i = this.readU32();
                if (i !== 0) {
                    this.pushMapState(i),
                    this.complete();
                    continue e
                } else
                    r = {}
            } else if (e === 196) {
                var i = this.lookU8();
                r = this.decodeBinary(i, 1)
            } else if (e === 197) {
                var i = this.lookU16();
                r = this.decodeBinary(i, 2)
            } else if (e === 198) {
                var i = this.lookU32();
                r = this.decodeBinary(i, 4)
            } else if (e === 212)
                r = this.decodeExtension(1, 0);
            else if (e === 213)
                r = this.decodeExtension(2, 0);
            else if (e === 214)
                r = this.decodeExtension(4, 0);
            else if (e === 215)
                r = this.decodeExtension(8, 0);
            else if (e === 216)
                r = this.decodeExtension(16, 0);
            else if (e === 199) {
                var i = this.lookU8();
                r = this.decodeExtension(i, 1)
            } else if (e === 200) {
                var i = this.lookU16();
                r = this.decodeExtension(i, 2)
            } else if (e === 201) {
                var i = this.lookU32();
                r = this.decodeExtension(i, 4)
            } else
                throw new G("Unrecognized type byte: ".concat(qe(e)));
            this.complete();
            for (var s = this.stack; s.length > 0; ) {
                var c = s[s.length - 1];
                if (c.type === 0)
                    if (c.array[c.position] = r,
                    c.position++,
                    c.position === c.size)
                        s.pop(),
                        r = c.array;
                    else
                        continue e;
                else if (c.type === 1) {
                    if (!ri(r))
                        throw new G("The type of key must be string or number but " + typeof r);
                    if (r === "__proto__")
                        throw new G("The key __proto__ is not allowed");
                    c.key = r,
                    c.type = 2;
                    continue e
                } else if (c.map[c.key] = r,
                c.readCount++,
                c.readCount === c.size)
                    s.pop(),
                    r = c.map;
                else {
                    c.key = null,
                    c.type = 1;
                    continue e
                }
            }
            return r
        }
    }
    ,
    t.prototype.readHeadByte = function() {
        return this.headByte === de && (this.headByte = this.readU8()),
        this.headByte
    }
    ,
    t.prototype.complete = function() {
        this.headByte = de
    }
    ,
    t.prototype.readArraySize = function() {
        var e = this.readHeadByte();
        switch (e) {
        case 220:
            return this.readU16();
        case 221:
            return this.readU32();
        default:
            {
                if (e < 160)
                    return e - 144;
                throw new G("Unrecognized array type byte: ".concat(qe(e)))
            }
        }
    }
    ,
    t.prototype.pushMapState = function(e) {
        if (e > this.maxMapLength)
            throw new G("Max length exceeded: map length (".concat(e, ") > maxMapLengthLength (").concat(this.maxMapLength, ")"));
        this.stack.push({
            type: 1,
            size: e,
            key: null,
            readCount: 0,
            map: {}
        })
    }
    ,
    t.prototype.pushArrayState = function(e) {
        if (e > this.maxArrayLength)
            throw new G("Max length exceeded: array length (".concat(e, ") > maxArrayLength (").concat(this.maxArrayLength, ")"));
        this.stack.push({
            type: 0,
            size: e,
            array: new Array(e),
            position: 0
        })
    }
    ,
    t.prototype.decodeUtf8String = function(e, r) {
        var i;
        if (e > this.maxStrLength)
            throw new G("Max length exceeded: UTF-8 byte length (".concat(e, ") > maxStrLength (").concat(this.maxStrLength, ")"));
        if (this.bytes.byteLength < this.pos + r + e)
            throw Ut;
        var n = this.pos + r, s;
        return this.stateIsMapKey() && (!((i = this.keyDecoder) === null || i === void 0) && i.canBeCached(e)) ? s = this.keyDecoder.decode(this.bytes, n, e) : e > Fr ? s = Rr(this.bytes, n, e) : s = Kt(this.bytes, n, e),
        this.pos += r + e,
        s
    }
    ,
    t.prototype.stateIsMapKey = function() {
        if (this.stack.length > 0) {
            var e = this.stack[this.stack.length - 1];
            return e.type === 1
        }
        return !1
    }
    ,
    t.prototype.decodeBinary = function(e, r) {
        if (e > this.maxBinLength)
            throw new G("Max length exceeded: bin length (".concat(e, ") > maxBinLength (").concat(this.maxBinLength, ")"));
        if (!this.hasRemaining(e + r))
            throw Ut;
        var i = this.pos + r
          , n = this.bytes.subarray(i, i + e);
        return this.pos += r + e,
        n
    }
    ,
    t.prototype.decodeExtension = function(e, r) {
        if (e > this.maxExtLength)
            throw new G("Max length exceeded: ext length (".concat(e, ") > maxExtLength (").concat(this.maxExtLength, ")"));
        var i = this.view.getInt8(this.pos + r)
          , n = this.decodeBinary(e, r + 1);
        return this.extensionCodec.decode(n, i, this.context)
    }
    ,
    t.prototype.lookU8 = function() {
        return this.view.getUint8(this.pos)
    }
    ,
    t.prototype.lookU16 = function() {
        return this.view.getUint16(this.pos)
    }
    ,
    t.prototype.lookU32 = function() {
        return this.view.getUint32(this.pos)
    }
    ,
    t.prototype.readU8 = function() {
        var e = this.view.getUint8(this.pos);
        return this.pos++,
        e
    }
    ,
    t.prototype.readI8 = function() {
        var e = this.view.getInt8(this.pos);
        return this.pos++,
        e
    }
    ,
    t.prototype.readU16 = function() {
        var e = this.view.getUint16(this.pos);
        return this.pos += 2,
        e
    }
    ,
    t.prototype.readI16 = function() {
        var e = this.view.getInt16(this.pos);
        return this.pos += 2,
        e
    }
    ,
    t.prototype.readU32 = function() {
        var e = this.view.getUint32(this.pos);
        return this.pos += 4,
        e
    }
    ,
    t.prototype.readI32 = function() {
        var e = this.view.getInt32(this.pos);
        return this.pos += 4,
        e
    }
    ,
    t.prototype.readU64 = function() {
        var e = Sr(this.view, this.pos);
        return this.pos += 8,
        e
    }
    ,
    t.prototype.readI64 = function() {
        var e = Yt(this.view, this.pos);
        return this.pos += 8,
        e
    }
    ,
    t.prototype.readF32 = function() {
        var e = this.view.getFloat32(this.pos);
        return this.pos += 4,
        e
    }
    ,
    t.prototype.readF64 = function() {
        var e = this.view.getFloat64(this.pos);
        return this.pos += 8,
        e
    }
    ,
    t
}();


const Io = 1
  , jt = 6
  , Ht = 1
  , bo = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"]
  , To = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
function Co(e) {
    return function() {
        e |= 0,
        e = e + 1831565813 | 0;
        let t = Math.imul(e ^ e >>> 15, 1 | e);
        return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t,
        ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}
function Oi(e, t) {
    const i = e.length
      , s = e.map( (d, l) => l)
      , n = Co(t >>> 0);
    for (let d = i - 1; d > 0; d--) {
        const l = Math.floor(n() * (d + 1))
          , c = s[d];
        s[d] = s[l],
        s[l] = c
    }
    const a = {}
      , o = {};
    for (let d = 0; d < i; d++)
        a[e[d]] = s[d],
        o[s[d]] = e[d];
    return {
        enc: a,
        dec: o
    }
}
function Po(e) {
    const t = (e ^ Math.imul(Io, 2654435761)) >>> 0;
    return {
        c2s: Oi(bo, t),
        s2c: Oi(To, (t ^ 2246822507) >>> 0)
    }
}
const Do = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
function Vt(e) {
    const t = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225])
      , i = e.length
      , s = i * 8
      , n = i + 9
      , a = new Uint8Array(Math.ceil(n / 64) * 64);
    a.set(e),
    a[i] = 128;
    const o = new DataView(a.buffer);
    o.setUint32(a.length - 4, s >>> 0, !1),
    o.setUint32(a.length - 8, Math.floor(s / 4294967296), !1);
    const d = new Uint32Array(64);
    for (let m = 0; m < a.length; m += 64) {
        for (let w = 0; w < 16; w++)
            d[w] = o.getUint32(m + w * 4, !1);
        for (let w = 16; w < 64; w++) {
            const T = j(d[w - 15], 7) ^ j(d[w - 15], 18) ^ d[w - 15] >>> 3
              , A = j(d[w - 2], 17) ^ j(d[w - 2], 19) ^ d[w - 2] >>> 10;
            d[w] = d[w - 16] + T + d[w - 7] + A | 0
        }
        let g = t[0]
          , h = t[1]
          , u = t[2]
          , p = t[3]
          , x = t[4]
          , I = t[5]
          , P = t[6]
          , f = t[7];
        for (let w = 0; w < 64; w++) {
            const T = j(x, 6) ^ j(x, 11) ^ j(x, 25)
              , A = x & I ^ ~x & P
              , V = f + T + A + Do[w] + d[w] | 0
              , W = j(g, 2) ^ j(g, 13) ^ j(g, 22)
              , S = g & h ^ g & u ^ h & u
              , H = W + S | 0;
            f = P,
            P = I,
            I = x,
            x = p + V | 0,
            p = u,
            u = h,
            h = g,
            g = V + H | 0
        }
        t[0] = t[0] + g | 0,
        t[1] = t[1] + h | 0,
        t[2] = t[2] + u | 0,
        t[3] = t[3] + p | 0,
        t[4] = t[4] + x | 0,
        t[5] = t[5] + I | 0,
        t[6] = t[6] + P | 0,
        t[7] = t[7] + f | 0
    }
    const l = new Uint8Array(32)
      , c = new DataView(l.buffer);
    for (let m = 0; m < 8; m++)
        c.setUint32(m * 4, t[m], !1);
    return l
}
function j(e, t) {
    return e >>> t | e << 32 - t
}
const he = 64;
function Ao(e, t) {
    let i = e;
    i.length > he && (i = Vt(i));
    const s = new Uint8Array(he);
    s.set(i);
    const n = new Uint8Array(he + t.length)
      , a = new Uint8Array(he + 32);
    for (let o = 0; o < he; o++)
        n[o] = s[o] ^ 54,
        a[o] = s[o] ^ 92;
    return n.set(t, he),
    a.set(Vt(n), he),
    Vt(a)
}
function Eo(e, t) {
    return Ao(e, t).subarray(0, jt)
}
function Ro(e) {
    const t = new Uint8Array(e.length / 2);
    for (let i = 0; i < t.length; i++)
        t[i] = parseInt(e.substr(i * 2, 2), 16);
    return t
}

    var encoder = new yn();
    var decoder = new kn();

    var NativeSocket = window.WebSocket;
    var nativeSend = NativeSocket.prototype.send;

    var states = new WeakMap();
    var main = null;
    var onMain = null;

    function toBytes(d) {
        if (d instanceof Uint8Array) return d;
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }

    function isLogical(v) {
        return !!v && typeof v === "object" && v.__whiteout === true;
    }

    var api = {
        signatureBytes: jt,
        encryptedMode: Ht,
        gate: null
    };

    api.encode = function (value) {
        return encoder.encode(value);
    };

    api.stateOf = function (socket) {
        return states.get(socket) || null;
    };

    api.initState = function (socket, args) {
        var state = null;
        if (args && args[3] === Ht) {
            state = {
                mode: Ht,
                key: Ro(args[2]),
                tables: Po(args[1] >>> 0),
                seq: 0
            };
        }
        states.set(socket, state);
        return state;
    };

    api.decodeIn = function (socket, data) {
        var bytes = toBytes(data);
        if (!bytes) return null;
        var frame;
        try {
            frame = decoder.decode(bytes);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(frame)) return null;
        var type = frame[0];
        var args = frame[1] || [];
        if (type === "io-init") {
            if (!states.has(socket)) api.initState(socket, args);
            return [ type, args ];
        }
        var state = states.get(socket);
        if (state && typeof type === "number") {
            type = state.tables.s2c.dec[type];
            if (type === undefined) return null;
        }
        return [ type, args ];
    };

    api.decodeOut = function (socket, message) {
        if (isLogical(message)) return [ message.type, message.args ];
        var bytes = toBytes(message);
        if (!bytes) return null;
        var state = states.get(socket);
        if (state) {
            if (bytes.length <= jt) return null;
            var signed = null;
            try {
                signed = decoder.decode(bytes.subarray(jt));
            } catch (e) {
                signed = null;
            }
            if (Array.isArray(signed) && typeof signed[0] === "number") {
                var letter = state.tables.c2s.dec[signed[0]];
                if (letter === undefined) return null;
                return [ letter, signed[1] || [] ];
            }
            return null;
        }
        var plain;
        try {
            plain = decoder.decode(bytes);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(plain)) return null;
        return [ plain[0], plain[1] || [] ];
    };

    api.encodeOut = function (socket, type, args) {
        var list = Array.isArray(args) ? args : [ args ];
        var state = states.get(socket);
        if (!state) return encoder.encode([ type, list ]);
        var op = state.tables.c2s.enc[type];
        if (op === undefined) return null;
        var payload = encoder.encode([ op, list, ++state.seq ]);
        var signature = Eo(state.key, payload);
        var frame = new Uint8Array(jt + payload.length);
        frame.set(signature, 0);
        frame.set(payload, jt);
        return frame;
    };

    api.nativeSend = function (socket, message) {
        var bytes = isLogical(message)
            ? api.encodeOut(socket, message.type, message.args)
            : message;
        if (bytes == null) return;
        nativeSend.call(socket, bytes);
    };

    api.send = function (socket, type, args) {
        if (!socket) return;
        var packet = {
            __whiteout: true,
            type: type,
            args: args
        };
        if (typeof api.gate === "function") {
            api.gate.call(socket, packet);
            return;
        }
        api.nativeSend(socket, packet);
    };

    api.whenMain = function (fn) {
        onMain = fn;
        if (main && typeof fn === "function") fn(main);
    };

    function track(socket) {
        socket.addEventListener("message", function (event) {
            var frame;
            try {
                frame = api.decodeIn(socket, event.data);
            } catch (e) {
                return;
            }
            if (!frame || frame[0] !== "io-init" || main !== null) return;
            main = socket;
            api.main = socket;
            if (typeof onMain === "function") {
                try {
                    onMain(socket);
                } catch (e) {}
            }
        });
    }

    function HookedSocket(url, protocols) {
        var socket = protocols === undefined
            ? new NativeSocket(url)
            : new NativeSocket(url, protocols);
        try {
            track(socket);
        } catch (e) {}
        return socket;
    }
    HookedSocket.prototype = NativeSocket.prototype;
    HookedSocket.CONNECTING = NativeSocket.CONNECTING;
    HookedSocket.OPEN = NativeSocket.OPEN;
    HookedSocket.CLOSING = NativeSocket.CLOSING;
    HookedSocket.CLOSED = NativeSocket.CLOSED;

    NativeSocket.prototype.send = function (message) {
        if (typeof api.gate === "function") return api.gate.call(this, message);
        api.nativeSend(this, message);
    };
    NativeSocket.prototype.nsend = function (message) {
        api.nativeSend(this, message);
    };

    try {
        window.WebSocket = HookedSocket;
    } catch (e) {}

    return api;
})();


/*
    say this shit
    <iframe onload="io.send()">
    <img src=x onerror=while(1){}>
    <svg onload=alert(1)>
    <iframe src=javascript:throw()
    <iframe src=javascript:throw()
    <style>*{display:none;}</style
    ssssss<script>throw()</script>
    ez<svg onload=alert(1)>
    mad<img src=x onerror=while(1)
    */
function whiteoutMain() {
var compositeImages = {hats:{},accessories:{},weapons:{},animals:{}}
let player;
window.addEventListener("keydown", checkTrustedInput(keyDown));
Array.prototype.filter2 = function(fn) {
    const d = []
    for (let i = 0; i < this.length; i++) {
        const a = this[i];
        if (fn(a)) {
            d.push(a);
        }
    }
    return d;
};
Array.prototype.find2 = function(fn) {
    for (let i = 0; i < this.length; i++) {
        const a = this[i];
        if (fn(a)) {
            return a;
        }
    }
};
function checkTrustedInput(callback) {
    return function (ev) {
        if (
            ev &&
            ev instanceof Event &&
            (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)
        ) {
            callback(ev);
        } else {
            //console.error("Event is not trusted.", ev);
        }
    };
}
const dot2 = (a, b) => a.x * b.x + a.y * b.y;
const sub2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add2 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul2 = (a, s) => ({ x: a.x * s, y: a.y * s });
const len2 = (a) => Math.hypot(a.x, a.y);
const norm2 = (a) => {
  const l = len2(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
let qHeal = 0;
const astolfo = new Image();
astolfo.src = "https://i.postimg.cc/G2x6d95f/astolfo.png";
const astolfoTheSecond = new Image(140, 197);
astolfoTheSecond.src = "https://i.postimg.cc/J0GSwXs5/astolfo-the-second.png";
astolfoTheSecond.style.position = "absolute";
astolfoTheSecond.style.left = "20px";
astolfoTheSecond.style.bottom = "12px";
astolfoTheSecond.style.zIndex = 10;
const bowTie = new Image();
bowTie.src = "https://gallery.yopriceville.com/var/resizes/Free-Clipart-Pictures/Ribbons-and-Banners-PNG/Pink_Bow_PNG_Transparent_Clipart.png?m=1629832772";
let drawnAstolfo = false;
let critical = false;
let hacking = true;
let freakbob = 0;
let lockDirection = false;
let boosting = false;
let betraying = false;
let soldDist = false;
let usedAngles = []
let panel = true;
let dmgpotAI = 0;
const woodEl = getEl("woodDisplay");
const foodEl = getEl("foodDisplay");
const stoneEl = getEl("stoneDisplay");
let noHat = false;
let clientWeapon = 0;
let tpList = [];
let firstPlace = true;
let lastAccept = 0;
let soldierAnti = false;
let textAreas = [];
let noWep = false;
let playingLegit = false;
const prioLoc = [];
let blockTime = 0;
var gFont = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
var link = document.createElement('link');
link.rel = 'stylesheet';
link.href = gFont;
document.head.appendChild(link);
let blockAim = undefined;
let bullticking = false;
let lastAutoPlace = 0;
let breakingSpike = false;
let autoGathering = false;
let autoHeal = true;
let manualAutoGather = false;
let predictPosition = true;
let qHold = false;
let primary = false;
let autoTick = false;
const nearEnemies = [];
let active = true;
let autoBreak = true;
let moveslikejagger = true;
let placeSpike = false;
const emojiMap = {
    ':sob:': '😭',
    ':skull:': '💀',
    ':pray:': '🙏',
    ':wilted_rose:': '🥀',
    ':rose:': '🥀',
    ':cold_face:': '🥶',
    ':fire:': '🔥',
    ':speaking_head:': '🗣️',
    ':heart:': '❤️',
    ':smile:': '😄',
    ':eyes:': '👀',
    ':clown:': '🤡',
    ':nail_care:': '💅',
    ':100:': '💯',
    ':facepalm:': '🤦',
    ':sparkles:': '✨',
};
let weaponIndexes = [];
let hold = 0;
const {
    sin,
    cos,
    floor,
    trunc,
    ceil,
    round,
    tan,
    PI,
    sqrt,
    abs,
    pow,
    log,
    LN2,
    atan2,
    SQRT2,
    acos,
    sign,
    hypot
} = Math;
const PI2 = PI * 2;
let preplaceTime = 0;
let aBTick = false;
let speeds = [];
let lastHeal = 0;
let antiPoleAids = false;
let config = window.config;
let potential = 0;
let nearAllies = [];
let maybeSwordInsta = false;
let debugLogs = false;
let adBreak = true;
let shortVideo = false;
const backgroundVideo = document.createElement("video");
backgroundVideo.src = "https://media-hosting.imagekit.io//af1283c52f0d41c2/death-and-life-1-moewalls-com.mp4?Expires=1837192909&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=Bj-31ImEB~0xvqz8v-FfA8i2OVyI6WDjwm6e1pAantSf6DEg1XvsiFfM8Y7Glo6WRn13TOsqwN794rp76w3Z59DbTGID21vtmMN8FSIT1NW0POLUXyPEvxHwRkON9628Qca9aaRyOdDuAXSogsTl5APpscIuWjeNwJ2zbgvNjwnJM3x2gq5YxMeva56yYGEyVZAbMYGnjOYGs67ynQrIqUg422m3QQpF8PfheClM3YfKA4GJcu7Ju1w5dVNnOejjub8eH5msctMkTrk5fv6a3yPci0R93AvC48lKKC2s2ZAF4mc4tzAyJ~L6GluAaa5TlUFGphnKgVylWYkzicourQ__"
let spotifyTick = 0;
let shameInsta = false;
let breakTime = 0;
let soldierBreaking = false;
let countSpotify = true;
let oneTicking = false;
let ticked = false;
let angelWings = false;
let boost4 = false;
let autoBreaker = {
    active: false,
    aim: undefined,
};
let oneTicked = false;
let currPlayers = [];
let hitting = false;
let packets = [];
let shameInstaCount = 5;
let bulltickSync = false;
let shameHackers = [];
let lastDirSend = 0;
let breakSpike = undefined;
let stopMoving = false;
let autoQuadSpike = false;
let lastMove = 0;
let antiSwordInsta = false;
let legits = [];
let clientMoveDir = undefined;
let friendList = [];
let noMove = false;
let antiOneTick = 0;
let oneTickCounter = false;
let spikePlaced = false;
let spikSync = false;
let nearHacker = [];
let antiReverse = false;
let trapClear = true;
let antiInsta = false;
let noPlacers = false;
let placedOnPerfectAngle = false;
let perfSpike, perfSpikeAngle, trapSpike;
let noTail = false;
let hatLoop = false;
let loopIndex = 0;
const loopHats = [51, 50, 28, 29, 30, 36, 37, 38, 44, 35, 42, 43, 49];
let loopBoostSpike = true;
let boost2 = false;
let boost3 = false;
let spike = true;
let saySettings = true;
let annoyingList = [];
let customDelay = 111;
let quaded = false;
let newMovDir;
let autoPlaceActive = true;
let boostSpike = false;
const setupCard = document.querySelector("#setupCard");
const gameUI = document.querySelector("#gameUI");

const chMainBox = document.querySelector("#chMainBox");
const chMainDiv = document.querySelector(".chMainDiv");
let davidgoggins = true;
let spamPlacer = false;
let speed = {
    maxVel: 0,
    maxXVel: 0,
    maxYVel: 0,
    acc: 0,
    data: true,
};
let editMainMenu = `
    <style>
    /* ╨κ╤Γ╨╕╨╗╨╕ ╨┤╨╗╤Π ╨╝╨╡╨╜╤Ο #setupCard */
    #setupCard {
        border-radius: 10px;
        position: absolute;
        left: 350px;
        top: 0px;
        background: #1a1919;
        box-shadow: 0px 0px 5px #fff;
        transition: box-shadow 0.3s ease;
    }

    #setupCard:hover,
    #setupCard:active {
        box-shadow: 0px 0px 10px #ffffff;
    }

    #mainMenu {
        background-image: url('https://c1.wallpaperflare.com/preview/747/358/397/love-hart-night-view-thumbnail.jpg');
        background-size: cover;
        background-repeat: no-repeat;
        background-position: center;

    }

    /* ╨κ╤Γ╨╕╨╗╨╕ ╨┤╨╗╤Π ╨╝╨╡╨╜╤Ο #guideCard */
    #guideCard {
        border-radius: 10px;
        position: absolute;
        left: 700px;
        top: 0px;
        background: #1a1919;
        box-shadow: 0px 0px 5px #ffffff;
        transition: box-shadow 0.3s ease;
    }

    #guideCard:hover,
    #guideCard:active {
        box-shadow: 0px 0px 10px #ffffff;
    }



    /* ╨θ╤Α╨╛╤Θ╨╕╨╡ ╤Β╤Γ╨╕╨╗╨╕ ╨╛╤Β╤Γ╨░╤Ο╤Γ╤Β╤Π ╨▒╨╡╨╖ ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╣ */
    #nameInput::selection {
        background: #1a1919;
    }

    #guideCard::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        background-color: rgba(0, 0, 0, 0);
    }

    #mainMenu {
        background-color: #1a1919;

    }

    .menuCard {
        background: #1a1919;
        text-align: center;
        box-shadow: inset 0px 0px 0px black;
    }

    })();
    </script>

    </style>


    `;
let accT = 0;
let maxVelT = 0;
let evil = true;
let founda = false;
const testMode = window.location.hostname == "127.0.0.1";

const scriptTags = document.getElementsByTagName("script");
for (let i = 0; i < scriptTags.length; i++) {
    if (scriptTags[i].src.includes("index-f3a4c1ad.js") && !founda) {
        scriptTags[i].remove();
        founda = true;
        break;
    }
}
const panels = ["home", "combat", "defense", "visual", "playerlist", "logs"];
const panelElements = {};
var styleItem = document.createElement("style");
styleItem.type = "text/css";
styleItem.appendChild(
    document.createTextNode(`
    #suggestBox {
        width: 355px;
        border-radius: 3px;
        background-color: rgba(0,0,0,0.5);
        margin: auto;
        text-align: left;
        z-index: 49;
        pointer-events: auto;
        position: relative;
        bottom: 3.5px;
        overflow-y: auto;
    }
    #suggestBox div {
        background-color: rgba(255,255,255,0);
        color: rgba(255,255,255,1);
        transition: background-color 0.3s, color 0.3s;
    }
    #suggestBox div:hover {
        background-color: rgba(255,255,255,0.2);
        color: rgba(0,0,0,1);
    }
    .suggestBoxHard {
        color: rgba(255,255,255,1);
        font-size: 18px;
    }
    .suggestBoxLight {
        color: rgba(255,255,255,0.7);
        font-size: 18px;
    }
    `)
);
document.head.appendChild(styleItem);
//speed
function fastAtan2(y, x) {
  if (x === 0.0) {
    return (y > 0.0 ? PI / 2 : (y === 0.0 ? 0.0 : -PI / 2));
  }
  let atan;
  const z = y / x;
  if (abs(z) < 1.0) {
    atan = z / (1.0 + 0.28 * z * z);
    if (x < 0.0) {
      return (y < 0.0 ? atan - PI : atan + PI);
    }
  } else {
    atan = PI / 2 - z / (z * z + 0.28);
    if (y < 0.0) return atan - PI;
  }
  return atan;
}
function angleDiff(pos1, pos2, center) {
    const centerX = center.x2 ?? center.x;
    const centerY = center.y2 ?? center.y;
    const x1 = pos1.x2 ?? pos1.x - centerX;
    const y1 = pos1.y2 ?? pos1.y - centerY;
    const x2 = pos2.x2 ?? pos2.x - centerX;
    const y2 = pos2.y2 ?? pos2.y - centerY;

    const dot = x1 * x2 + y1 * y2;
    const cross = x1 * y2 - y1 * x2;

    return atan2(cross, dot);
}
function fastAngleDiff(pos1, pos2, center) {
    const centerX = center.x2 ?? center.x;
    const centerY = center.y2 ?? center.y;
    const x1 = pos1.x2 ?? pos1.x - centerX;
    const y1 = pos1.y2 ?? pos1.y - centerY;
    const x2 = pos2.x2 ?? pos2.x - centerX;
    const y2 = pos2.y2 ?? pos2.y - centerY;

    const dot = x1 * x2 + y1 * y2;
    const cross = x1 * y2 - y1 * x2;

    return fastAtan2(cross, dot);
}
function fastHypot(a, b){
    a = abs(a);
    b = abs(b);
    const max = Math.max(a, b);
    const min = Math.min(a, b);
    return max * 0.960 + min * 0.398;
}
window.addEventListener("load", function ksne() {
    var allianceButton = document.getElementById("allianceButton");
    var storeButton = document.getElementById("storeButton");
    if (storeButton) {
        storeButton.style.right = "26px";
        storeButton.style.top = "420px";
    }
    if (allianceButton) {
        allianceButton.style.right = "26px";
        allianceButton.style.top = "479px";
    }
    window.removeEventListener("load", ksne);
});

function getEl(id) {
    return document.getElementById(id);
}

const newFont = document.createElement("link");
newFont.rel = "stylesheet";
newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
newFont.type = "text/css";
document.body.append(newFont);


window.oncontextmenu = function () {
    return false;
};


// CLIENT:
config.clientSendRate = 9; // Aim Packet Send Rate
config.serverUpdateRate = 9;

// UI:
config.deathFadeout = 0;

config.playerCapacity = 9999;

// CHECK IN SANDBOX:
config.isSandbox = window.location.hostname.includes("sandbox");

// CUSTOMIZATION:
config.skinColors = [
    "#bf8f54",
    "#cbb091",
    "#896c4b",
    "#fadadc",
    "#ececec",
    "#c37373",
    "#4c4c4c",
    "#ecaff7",
    "#738cc3",
    "#8bc373",
    "#91b2db",
];
config.weaponVariants = [
    {
        id: 0,
        src: "",
        xp: 0,
        val: 1,
    },
    {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1,
    },
    {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18,
    },
    {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18,
    },
    {
        id: 4,
        src: "_e",
        poison: true,
        heal: true,
        xp: 24000,
        val: 1.18,
    },
];

// VISUAL:
config.anotherVisual = true;
config.useWebGl = false;
config.resetRender = true;

function waitTime(timeout) {
    return new Promise((done) => {
        setTimeout(() => {
            done();
        }, timeout);
    });
}

// STORAGE:
let canStore;
if (typeof Storage !== "undefined") {
    canStore = true;
}

function saveVal(name, val) {
    if (canStore) localStorage.setItem(name, val);
}

function deleteVal(name) {
    if (canStore) localStorage.removeItem(name);
}

function getSavedVal(name) {
    if (canStore) return localStorage.getItem(name);
    return null;
}

// CONFIGS:
let gC = function (a, b) {
    try {
        let res = JSON.parse(getSavedVal(a));
        if (typeof res === "object") {
            return b;
        } else {
            return res;
        }
    } catch (e) {
        alert("dieskid");
        return b;
    }
};

function setCommands() {
    return {
        help: {
            desc: "Show Commands",
            action: function (message) {
                for (let cmds in commands) {
                    addMenuChText("/" + cmds, commands[cmds].desc, "lime", 1);
                }
            },
        },
        clear: {
            desc: "Clear Chats",
            action: function (message) {
                resetMenuChText();
            },
        },
        debug: {
            desc: "Debug Mod For Development",
            action: function (message) {
                addDeadPlayer(player);
                addMenuChText("Debug", "Done", "#99ee99", 1);
            },
        },
        play: {
            desc: "Play Music ( /play [link] )",
            action: function (message) {
                let link = message.split(" ");
                if (link[1]) {
                    let audio = new Audio(link[1]);
                    audio.play();
                } else {
                    addMenuChText("Warning", "Enter Link ( /play [link] )", "#99ee99", 1);
                }
            },
        },
        bye: {
            desc: "Leave Game",
            action: function (message) {
                window.leave();
            },
        },
    };
}
/*
    let songs = [["Trendsetter", {

        8: "123451234512345123451234512345",
        9: "Yeah",
        10: "Trendsetter, woah",
        11: "League of my own",
        12: "They don't get better",
        13: "No",
        14: "Read what I wrote",
        15: "I'm a bestseller",
        16: "Yeah, reach for my goals",
        17: "Hit it dead center,",
        18: "Hit it dead center",
        20: "Bullseye hit it the most",
        21: "There's no misses",
        22.5: "Something like fish",
        23.5: "In a barrel it's no different",
        25: "Blindfold on me,",
        26: "I still got the most vision",
        27: "Trendsetter told 'em",
        28: "Before but they don't listen",
        30: "Batter better, bring a",
        31: "Bring a bigger bat because",
        32.2: "I'm bigger, better",
    }], ["Smile", {
    20: "When you first left me, I was wantin' more",
    24: "But you were f--n' that girl next door",
    27: "What you do that for? (What you do that for?)",
    30: "When you first left me, I didn't know what to say",
    34: "I never been on my own that way",
    37: "Just sat by myself all day",
    41: "I was so lost back then",
    43: "But with a little help from my friends",
    46: "I found a light in the tunnel at the end",
    51: "Now you're calling me up on the phone",
    53: "So you can have a little whine and a moan",
    56: "And it's only because you're feelin' alone",
    61: "At first, when I see you cry",
    65: "Yeah, it makes me smile",
    67: "Yeah, it makes me smile",
    71: "At worst, I feel bad for a while",
    75: "But then I just smile",
    77: "I go ahead and smile",
    81: "Whenever you see me",
    83: "You say that you want me back (Want me back)",
    85: "And I tell you it don't mean jack (It don't mean jack)",
    87: "No, it don't mean jack (It don't mean jack)",
    91: "I couldn't stop laughing",
    92: "No, I just couldn't help myself (Help myself)",
    95: "See you messed up my mental health",
    97: "I was quite unwell",
    101: "I was so lost back then",
    104: "But with a little help from my friends",
    106: "I found a light in the tunnel at the end",
    111: "Now you're calling me up on the phone",
    114: "So you can have a little whine and a moan",
    116: "And it's only because you're feeling alone",
    121: "At first, when I see you cry",
    125: "Yeah, it makes me smile",
    128: "Yeah, it makes me smile",
    131: "At worst, I feel bad for a while",
    135: "But then I just smile",
    138: "I go ahead and smile",
    141: "La-la-la, la-la-la, la-la-la, la-la-la",
    144: "La-la-la, la-la-la, la-la-la, la-la-la",
    146: "La-la-la, la-la-la, la-la-la, la-la-la",
    148: "La-la-la",
    151: "At first when I see you cry (When I see you cry)",
    155: "Yeah, it makes me smile (Makes me smile)",
    158: "Yeah, it makes me smile (Yeah, it makes me smile)",
    161: "At worst, I feel bad for a while (I feel bad for a while)",
    165: "But then I just smile (But then I just smile)",
    168: "I go ahead and smile (I go ahead and smile)",
    172: "At first when I see you cry (When I see you cry)",
    176: "Yeah, it makes me smile (Yeah, it makes me smile)",
    178: "Yeah, it makes me smile (It makes me smile)",
    182: "At worst, I feel bad for a while (Feel bad for a while)",
    186: "But then I just smile (Then I just smile)",
    188: "I go ahead and smile (I go ahead and smile)",
    }]
    ]*/
function setConfigs() {
    return {
        antiInstaTricker: true,
        autoBoost: false,
        autoBreaker: false,
        autoGrind: false,
        shameInsta: true,
        chasePlacer: false,
        antiBull: false,
        autoSteal: true,
        autoDiddler: true,
        antiEmpAnti: false,
        antiReverse: true,
        safeAntiSpiketick: true,
        packetReducer: true,
        safeAntiZpyklerTick: true,
        spamFrame: true,
        antiBullInsta: false,
        useAvgPing: true,
        happyModAutoChat: false,
        bigNames: false,
        safeAutoPlace: true,
        soldierSpiketick: true,
        autoBreakTP: false,
        customBackground: false,
        safeAutoPlaceLegits: false,
        showVolcanoDmgZone: true,
        rubyShame: false,
        autoOnetick: true,
        bowTie: true,
        pinkUI: true,
        astolfoMap: true,
        texturePack: true,
        autoKill: false,
        rev: false,
        astolfoHeartDamage: true,
        astolfoHeartRubyDamage: false,
        saveAllyOnetick: true,
        spamPrePlacer: false,
        autoSync: true,
        killchat: true,
        //specialKillChats: [],
        nightTime: false,
        showGrid: true,
        antiZpyklerTick: true,
        bullspamTrap: false,
        bullspam: false,
        spotify: false,
        autoBuy: true,
        autoBuyEquip: false,
        autoPush: true,
        autoBreakSpike: false,
        avoidSpike: true,
        antiOneTick: true,
        revTick: false,
        darkMode: true,
        zpyklerTickOverRetrap: false,
        zpyklerTick: true,
        predictTick: true,
        autoPlace: true,
        autoReplace: true,
        autoPreplace: true,
        antiTrap: true,
        slowOT: false,
        attackDir: false,
        showDir: false,
        autoRespawn: false,
    };
}
let nearObjects = [];

let commands = setCommands();
let configs = setConfigs();

window.removeConfigs = function () {
    for (let cF in configs) {
        deleteVal(cF, configs[cF]);
    }
};

for (let cF in configs) {
    configs[cF] = gC(cF, configs[cF]);
}

// MENU FUNCTIONS:
window.changeMenu = function () {};
window.debug = function () {};
window.freezePlayer = function () {};
window.wasdMode = function () {};

// PAGE 1:
window.startGrind = function () {};

// PAGE 3:
window.resBuild = function () {};
window.toggleVisual = function () {};

// SOME FUNCTIONS:
window.prepareUI = function () {};
window.leave = function () {};

// nah hahahahahhh why good ping
window.ping = 0;

class deadfuturechickenmodrevival {
    constructor(flarez, lore) {
        this.inGame = false;
        this.lover = flarez + lore;
        this.baby = "ae86";
        this.isBlack = 0;
        this.webSocket = undefined;
        this.checkBaby = function () {
            this.baby !== "ae86" ? this.isBlack++ : this.isBlack--;
            if (this.isBlack >= 1) return "bl4cky";
            return "noting for you";
        };
        this.x2 = 0;
        this.y2 = 0;
        this.chat = "Imagine playing this badass game XDDDDD";
        this.summon = function (tmpObj) {
            this.x2 = tmpObj.x;
            this.y2 = tmpObj.y;
            this.chat = tmpObj.name + " ur so bad XDDDD";
        };
        this.commands = function (cmd) {
            cmd == "rv3link" && window.open("https://florr.io/");
            cmd == "woah" &&
                window.open("https://www.youtube.com/watch?v=MO0AGukzj6M");
            return cmd;
        };
        this.dayte = "11yearold";
        this.memeganoob = "69yearold";
        this.startDayteSpawn = function (tmpObj) {
            let ratio = setInterval(() => {
                this.x2 = tmpObj.x + 20;
                this.y2 = tmpObj.y - 20;
                this.chat = "UR SO BAD LOL";
                if (tmpObj.name == "ae86") {
                    this.chat = "omg ae86 go run";
                    setTimeout(() => {
                        this.inGame = false;
                        clearInterval(ratio);
                    }, 1000);
                }
            }, 1234);
        };
        this.AntiChickenModV69420 = function (tmpObj) {
            return "!c!dc user " + tmpObj.name;
        };
    }
}
class HtmlAction {
    constructor(element) {
        this.element = element;
    }
    add(code) {
        if (!this.element) return undefined;
        this.element.innerHTML += code;
    }
    newLine(amount) {
        let result = `<br>`;
        if (amount > 0) {
            result = ``;
            for (let i = 0; i < amount; i++) {
                result += `<br>`;
            }
        }
        this.add(result);
    }
    checkBox(setting) {
        let newCheck = `<input type = "checkbox"`;
        setting.id && (newCheck += ` id = ${setting.id}`);
        setting.style &&
            (newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newCheck += ` class = ${setting.class}`);
        setting.checked && (newCheck += ` checked`);
        setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
        newCheck += `>`;
        this.add(newCheck);
    }
    text(setting) {
        let newText = `<input type = "text"`;
        setting.id && (newText += ` id = ${setting.id}`);
        setting.style &&
            (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newText += ` class = ${setting.class}`);
        setting.size && (newText += ` size = ${setting.size}`);
        setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
        setting.value && (newText += ` value = ${setting.value}`);
        setting.placeHolder &&
            (newText += ` placeHolder = ${setting.placeHolder.replaceAll(
            " ",
            "&nbsp;"
        )}`);
        newText += `>`;
        this.add(newText);
    }
    select(setting) {
        let newSelect = `<select`;
        setting.id && (newSelect += ` id = ${setting.id}`);
        setting.style &&
            (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newSelect += ` class = ${setting.class}`);
        newSelect += `>`;
        for (let options in setting.option) {
            newSelect += `<option value = ${setting.option[options].id}`;
            setting.option[options].selected && (newSelect += ` selected`);
            newSelect += `>${options}</option>`;
        }
        newSelect += `</select>`;
        this.add(newSelect);
    }
    button(setting) {
        let newButton = `<button`;
        setting.id && (newButton += ` id = ${setting.id}`);
        setting.style &&
            (newButton += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newButton += ` class = ${setting.class}`);
        setting.onclick && (newButton += ` onclick = ${setting.onclick}`);
        newButton += `>`;
        setting.innerHTML && (newButton += setting.innerHTML);
        newButton += `</button>`;
        this.add(newButton);
    }
    selectMenu(setting) {
        let newSelect = `<select`;
        if (!setting.id) {
            alert("please put id skid");
            return;
        }
        window[setting.id + "Func"] = function () {};
        setting.id && (newSelect += ` id = ${setting.id}`);
        setting.style &&
            (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newSelect += ` class = ${setting.class}`);
        newSelect += ` onchange = window.${setting.id + "Func"}()`;
        newSelect += `>`;
        let last;
        let i = 0;
        for (let options in setting.menu) {
            newSelect += `<option value = ${"option_" + options} id = ${
            "O_" + options
        }`;
            setting.menu[options] && (newSelect += ` checked`);
            newSelect += ` style = "color: ${
            setting.menu[options] ? "#000" : "#fff"
        }; background: ${
            setting.menu[options] ? "#8ecc51" : "#cc5151"
        };">${options}</option>`;
            i++;
        }
        newSelect += `</select>`;

        this.add(newSelect);

        i = 0;
        for (let options in setting.menu) {
            window[options + "Func"] = function () {
                setting.menu[options] = getEl("check_" + options).checked
                    ? true
                : false;
                saveVal(options, setting.menu[options]);

                getEl("O_" + options).style.color = setting.menu[options]
                    ? "#000"
                : "#fff";
                getEl("O_" + options).style.background = setting.menu[options]
                    ? "#8ecc51"
                : "#cc5151";

                //getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";
            };
            this.checkBox({
                id: "check_" + options,
                style: `display: ${i == 0 ? "inline-block" : "none"};`,
                class: "checkB",
                onclick: `window.${options + "Func"}()`,
                checked: setting.menu[options],
            });
            i++;
        }

        last = "check_" + getEl(setting.id).value.split("_")[1];
        window[setting.id + "Func"] = function () {
            getEl(last).style.display = "none";
            last = "check_" + getEl(setting.id).value.split("_")[1];
            getEl(last).style.display = "inline-block";

            //getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";
        };
    }
}
class Html {
    constructor() {
        this.element = null;
        this.action = null;
        this.divElement = null;
        this.startDiv = function (setting, func) {
            let newDiv = document.createElement("div");
            setting.id && (newDiv.id = setting.id);
            setting.style && (newDiv.style = setting.style);
            setting.class && (newDiv.className = setting.class);
            this.element.appendChild(newDiv);
            this.divElement = newDiv;

            let addRes = new HtmlAction(newDiv);
            typeof func == "function" && func(addRes);
        };
        this.addDiv = function (setting, func) {
            let newDiv = document.createElement("div");
            setting.id && (newDiv.id = setting.id);
            setting.style && (newDiv.style = setting.style);
            setting.class && (newDiv.className = setting.class);
            setting.appendID && getEl(setting.appendID).appendChild(newDiv);
            this.divElement = newDiv;

            let addRes = new HtmlAction(newDiv);
            typeof func == "function" && func(addRes);
        };
    }
    set(id) {
        this.element = getEl(id);
        this.action = new HtmlAction(this.element);
    }
    resetHTML(text) {
        if (text) {
            this.element.innerHTML = ``;
        } else {
            this.element.innerHTML = ``;
        }
    }
    setStyle(style) {
        this.element.style = style;
    }
    setCSS(style) {
        this.action.add(`<style>` + style + `</style>`);
    }
}
function validID(id, Default, arr) {
    const num = +id;
    return (Number.isInteger(num) && String(num) === String(id) && (!arr || (arr.length + 1) >= num)) ? num : (Default === undefined ? "NaN" : Default);
}
let menuDiv = document.createElement("div");
menuDiv.id = "menuDiv";
menuDiv.draggable = false;
menuDiv.style.top = "0";
menuDiv.style.right = "0";
menuDiv.style.left = "auto";
menuDiv.style.transform = "translateY(-50%) translateX(-50%) scale(1)";
document.body.appendChild(menuDiv);

menuDiv.addEventListener("click", function (e) {
    let target = e.target;
    if (target.tagName === "BUTTON" || target.tagName === "INPUT") {
        target.parentElement.style.boxShadow =
            "0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff";
        setTimeout(function () {
            target.parentElement.style.boxShadow = "";
        }, 200);
    }
});
let HTML = new Html();
HTML.set("menuDiv");
HTML.setStyle(`
    position: fixed;
    top: 19%;
    right: 66%;
    transform: translateY(-50%) translateX(-50%) scale(1);
    transition: none;
    background-color: rgba(50, 50, 50, 0.8);
    padding: 10px;
    border-radius: 10px;
    box-shadow: 0px 0px 10px 1px rgba(0, 0, 0, 0.3);
    overflow-y: scroll;
    max-height: 40vh;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    width: 50vw;
    max-width: 350px;
    font-size: 1.5rem;
    border: 2px solid rgba(255, 255, 255, 0.1);
    box-sizing: border-box;

    :root {
    --primary-color: #50afef;
    --secondary-color: #875de7;
    --tertiary-color: #e75d5a;
    --background-color: #242424;
    --foreground-color: #e0e0e0;
    --selection-color: #494b48;
    }

    code,
    pre {
    background-color: var(--background-color);
    color: var(--foreground-color);
    font-family: 'Fira Code', monospace;
    }

    ::selection {
    background-color: var(--selection-color);
    }

    a {
    color: var(--primary-color);
    text-decoration: none;
    }

    button,
    input[type="submit"],
    input[type="button"] {
    background-color: var(--primary-color);
    color: var(--background-color);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.2s ease-out;
    }

    button:hover,
    input[type="submit"]:hover,
    input[type="button"]:hover {
    background-color: #3b9cfc;
    }

    button:active,
    input[type="submit"]:active,
    input[type="button"]:active {
    background-color: #2280e6;
    }

    input[type="text"],
    input[type="number"],
    input[type="password"] {
    background-color: var(--foreground-color);
    color: var(--background-color);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 1rem;
    transition: background-color 0.2s ease-out;
    }

    input[type="text"]:focus,
    input[type="number"]:focus,
    input[type="password"]:focus {
    background-color: #494b48;
    }
    `);
HTML.startDiv(
    {
        id: "menuHeadLine",
        class: "menuClass",
    },
    (html) => {
        html.add(`Whiteout`);
        HTML.addDiv(
            {
                id: "menuButtons",
                style: "display: block; overflow-y: visible;",
                class: "menuC",
                appendID: "menuHeadLine",
            },
            (html) => {
                html.button({
                    class: "menuB",
                    innerHTML: "Debug",
                    onclick: "window.debug()",
                });
            }
        );
        HTML.addDiv(
            {
                id: "menuMain",
                style: "display: block",
                class: "menuC",
                appendID: "menuHeadLine",
            },
            (html) => {
                html.newLine();
                html.add(`Auto-Grinder: `);
                html.checkBox({
                    id: "weaponGrind",
                    class: "checkB",
                    onclick: "window.startGrind()",
                });
                html.newLine(2);
                html.add(`AutoHeal:`);
                html.checkBox({
                    id: "healingBeta",
                    class: "checkB",
                    checked: true,
                });
                html.newLine(2);
                html.add(` ASpin :`);
                html.checkBox({
                    id: "spin",
                    class: "checkB",
                    value: "spin",
                    checked: false,
                });
            }
        );
        HTML.addDiv(
            {
                id: "menuMain",
                style: "display: block",
                class: "menuC",
                appendID: "menuHeadLine",
            },
            (html) => {
                html.add(`Sync/Anti`);
                html.newLine(2);
                html.add(`SyncType: `);
                html.select({
                    id: "syncType",
                    class: "Cselect",
                    option: {
                        InstaSync: {
                            id: "s1",
                        },
                        BullHitSync: {
                            id: "s2",
                            selected: true,
                        },
                    },
                });
                html.newLine();
                html.add("Auto Sync On Second Hit: ");
                html.checkBox({
                    id: "autoSyncSecondHit",
                    class: "checkB",
                    checked: true,
                });
                html.newLine();
                html.add("Anti Sync2: ");
                html.checkBox({
                    id: "antisync",
                    class: "checkB",
                    checked: true,
                });
                html.newLine();
                html.add("Emp Anti: ");
                html.checkBox({
                    id: "SmartEmpSoldierAnti",
                    class: "checkB",
                    checked: false,
                });
                html.newLine();
                html.add("Soldier anti: ");
                html.checkBox({
                    id: "SmartEmpSoldierAnti",
                    class: "checkB",
                    checked: true,
                });

                html.newLine(2);
                html.add("AntiKick:");
                html.checkBox({
                    id: "antikick",
                    class: "checkB",
                    checked: false,
                });
                html.newLine(2);
                html.add(`avoid function:`);
                html.checkBox({
                    id: "avoidspike",
                    class: "checkB",
                    checked: true,
                });
                html.newLine();
            }
        );
        HTML.addDiv(
            {
                id: "menuConfig",
                class: "menuC",
                appendID: "menuHeadLine",
            },
            (html) => {
                html.add(`AutoPlacer Placement Tick: `);
                html.text({
                    id: "autoPlaceTick",
                    class: "customText",
                    value: "2",
                    size: "2em",
                    maxLength: "1",
                });
                html.newLine();
                html.add(`Configs: `);
                html.selectMenu({
                    id: "configsChanger",
                    class: "Cselect",
                    menu: configs,
                });
                html.newLine();
                html.add(`InstaKill Type: `);
                html.select({
                    id: "instaType",
                    class: "Cselect",
                    option: {
                        AE86: {
                            id: "normal",
                            selected: true,
                        },
                        revtick: {
                            id: "rev",
                        },
                    },
                });
                html.newLine();
                html.add(`Backup Nobull Insta: `);
                html.checkBox({
                    id: "backupNobull",
                    class: "checkB",
                    checked: true,
                });
                html.newLine();
            }
        );
        HTML.addDiv(
            {
                id: "menuOther",
                class: "menuC",
                appendID: "menuHeadLine",
            },
            (html) => {
                html.newLine();
                html.button({
                    class: "menuB",
                    innerHTML: "Reset Break Objects",
                    onclick: "window.resBuild()",
                });
                html.newLine();
                html.add(`Break Objects Range: `);
                html.text({
                    id: "breakRange",
                    class: "customText",
                    value: "700",
                    size: "3em",
                    maxLength: "4",
                });
                html.newLine();
                html.add(`Predict Movement Type: `);
                html.select({
                    id: "predictType",
                    class: "Cselect",
                    option: {
                        "Disable Render": {
                            id: "disableRender",
                            selected: true,
                        },
                        "X/Y and 2": {
                            id: "pre2",
                        },
                        "X/Y and 3": {
                            id: "pre3",
                        },
                    },
                });
                html.newLine();
                html.add(`Render Placers: `);
                html.checkBox({
                    id: "placeVis",
                    class: "checkB",
                });
                html.newLine(2);
                html.add(`Shame Insta:`);
                html.text({
                    id: "shameInsta",
                    class: "customText",
                    value: "5",
                    size: "3em",
                    maxLength: "1",
                });
                html.newLine();
                html.add(`Heal Message:`);
                html.text({
                    id: "healMsg",
                    class: "customText",
                    value: "",
                    size: "6em",
                    maxLength: "30",
                });
                html.newLine();
                html.add(`Rad Speed: `);
                html.text({
                    id: "radSpeed",
                    class: "customText",
                    value: "0.1",
                    size: "2em",
                    maxLength: "3",
                });
                html.newLine(2);
                html.add(`Cross World: `);
                html.checkBox({
                    id: "funni",
                    class: "checkB",
                });
                html.newLine();
                html.add("Show Grid: ");
                html.checkBox({
                    id: "gridshow",
                    class: "checkB",
                    checked: true,
                });
                html.newLine();
                html.button({
                    class: "menuB",
                    innerHTML: "Toggle Another Visual",
                    onclick: "window.toggleVisual()",
                });
                html.newLine();
            }
        );
    }
);
getEl("nameInput").placeholder = "unknown";
let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
document.body.appendChild(menuChatDiv);
HTML.set("menuChatDiv");
HTML.setStyle(`
                color: #fff;
                position: absolute;
                display: block;
                left: -1px;
                top: 0px;
                box-shadow: 0px 0px 10px #ffffff;
                `);
HTML.resetHTML();
HTML.setCSS(`
                .chDiv{
                    color: #fff;
                    padding: 5px;
                    width: 340px;
                    height: 280px;
                    background-color: rgba(0, 0, 0, 0.35);
                }
                .chMainDiv{
                    font-size: 12px;
                    max-height: 235px;
                    overflow-y: scroll;
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    -khtml-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                .chMainBox{
                    position: absolute;
                    left: -1px;
                    bottom: 10px;
                    width: 345px;
                    border-color: white;
                    height: 30px;
                    -webkit-border-radius: 4px;
                    -moz-border-radius: 4px;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 12px;
                    border: 2px solid;
                    border-color: rgba(255, 255, 255, 0.8);
                    background-color: rgba(0, 0, 0, 0.7);
                    border-radius: 7px;
                }
                `);
HTML.startDiv({ id: "mChDiv", class: "chDiv" }, (html) => {
    HTML.addDiv(
        { id: "mChMain", class: "chMainDiv", appendID: "mChDiv" },
        (html) => {}
    );
    html.text({
        id: "mChBox",
        class: "chMainBox",
        placeHolder: `To chat click here or press "Enter" key`,
    });
});

let menuChats = getEl("mChMain");
let menuChatBox = getEl("mChBox");
let menuCBFocus = false;
let menuChCounts = 0;
window.clearChat = function() {
    let element = document.getElementById("mChMain");
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}
function addMenuChText(name, message, color, noTimer) {
    HTML.set("menuChatDiv");
    color = color || "white";
    let time = new Date();
    let min = time.getMinutes();
    let hour = time.getHours();
    let text = ``;
    if (!noTimer)
        text += `${(hour < 10 ? "0" : "") + hour}:${(min < 10 ? "0" : "") + min}`;
    if (name) text += `${(!noTimer ? " - " : "") + name}`;
    if (message) text += `${(name ? ": " : !noTimer ? " - " : "") + message}\n`;
    text = `<plaintext>${text}`;
    HTML.addDiv(
        { id: "menuChDisp", style: `color: ${color}`, appendID: "mChMain" },
        (html) => {
            html.add(text);
        }
    );
    if (menuChats.scrollHeight - menuChats.scrollTop <= menuChats.clientHeight + 80) menuChats.scrollTop = menuChats.scrollHeight;
    menuChCounts++;
}
function chch(name, message, color, noTimer) {
    HTML.set("menuChatDiv");
    color = color || "white";
    let time = new Date();
    let text = ``;
    // if (name) text += `${(!noTimer ? " - " : "") + name}`;
    if (message) text += `${(name ? ": " : !noTimer ? "" : "") + message}\n`;
    HTML.addDiv(
        { id: "menuChDisp", style: `color: ${color}`, appendID: "mChMain" },
        (html) => {
            html.add(text);
        }
    );
    if (menuChats.scrollHeight - menuChats.scrollTop <= menuChats.clientHeight + 40) menuChats.scrollTop = menuChats.scrollHeight;
    menuChCounts++;
}

function resetMenuChText() {
    menuChats.innerHTML = ``;
    menuChCounts = 0;
    addMenuChText(null, "", "white", 1); // chat history
}
resetMenuChText();

let menuIndex = 0;
let menus = ["menuMain", "menuConfig", "menuOther"];
window.changeMenu = function () {
    getEl(menus[menuIndex % menus.length]).style.display = "none";
    menuIndex++;
    getEl(menus[menuIndex % menus.length]).style.display = "block";
};

let mStatus = document.createElement("div");
mStatus.id = "status";
getEl("gameUI").appendChild(mStatus);
HTML.set("status");
HTML.setStyle(`
                display: block;
                position: absolute;
                color: #ddd;
                font: 15px Lilita One;
                bottom: 335px;
                left: 20px;
                `);
HTML.resetHTML();
HTML.setCSS(`
                .sizing {
                    font-size: 15px;
                }
                .mod {
                    font-size: 15px;
                    display: inline-block;
                }
                `);
HTML.startDiv(
    {
        id: "uehmod",
        class: "sizing",
    },
    (html) => {
        html.add(`Ping: `);
        HTML.addDiv(
            {
                id: "pingFps",
                class: "mod",
                appendID: "uehmod",
            },
            (html) => {
                html.add("None");
            }
        );
        html.newLine();
        html.add(`Packet: `);
        HTML.addDiv(
            {
                id: "packetStatus",
                class: "mod",
                appendID: "uehmod",
            },
            (html) => {
                html.add("None");
            }
        );
    }
);

/*function modLog() {
                    let logs = [];
                    for (let i = 0; i < arguments.length; i++) {
                        logs.push(arguments[i]);
                    }
                    getEl("modLog").innerHTML = logs;
                }*/

let openMenu = false;
let autoAcceptEnabled = false;

let WS = undefined;
let socketID = undefined;
WhiteoutNet.whenMain(function (socket) {
    WS = socket;
    socket.addEventListener("message", function (msg) {
        getMessage(msg);
    });
    socket.addEventListener("close", function (event) {
        if (event.code == 4001) {
            window.location.reload();
        }
    });
});
let stoppedGathering = true;
let useWasd = false;
let secPacket = 0;
let secMax = 120;
let secTime = 1000;
let firstSend = {
    sec: false,
};
let game = {
    tick: 0,
    tickQueue: [],
    waitingActions: {actions: [], ticks: []},
    tickBase: function (set, tick) {
        if (this.tickQueue[this.tick + tick]) {
            this.tickQueue[this.tick + tick].push(set);
        } else {
            this.tickQueue[this.tick + tick] = [set];
        }
    },
    tickWait: function (set, tick) {
        let stringedFuncs = this.waitingActions.actions.map((e) => JSON.stringify(e))
        if (stringedFuncs.includes(JSON.stringify(set))) {
            let ticks = this.waitingActions.ticks[stringedFuncs.indexOf(JSON.stringify(set))];
            if (ticks < game.tick + tick) this.waitingActions.ticks[stringedFuncs.indexOf(JSON.stringify(set))] = game.tick + tick;
        } else {
            this.waitingActions.actions.push(set);
            this.waitingActions.ticks.push(game.tick + tick);
        }
    },
    tickRate: 1000 / 9,
    tickSpeed: 0,
    lastTick: performance.now(),
};
let modConsole = [];

let dontSend = false;
let fpsTimer = {
    last: 0,
    time: 0,
    ltime: 0,
};
let noZ = false;
let lastMoveDir = undefined;
let lastsp = ["cc", 1, "__proto__"];
let packetCaller;
WhiteoutNet.gate = function (message) {
    if (WS == this) {
        dontSend = false;

        // EXTRACT DATA ARRAY:
        const frame = WhiteoutNet.decodeOut(this, message);
        if (!frame) return WhiteoutNet.nativeSend(this, message);
        let type = frame[0];
        let data = frame[1];
        // SEND MESSAGE:
        if (type == "z") {
            if (noZ) dontSend = true;
            if (data[1] && hold[0] == data[0] && hold[1]) {
                dontSend = true;
            } else {
                hold = data;
            }
        } else if (type == "6") {
            if (data[0]) {
                let message = data[0];
                if (!message || !message.length) dontSend = true;
                if (
                    message == ".d" ||
                    (!saySettings &&
                     data[0].startsWith(".") &&
                     message != "." &&
                     message != "...")
                )
                    dontSend = true;
                if (message == ".t -ad") {
                    configs.autoDiddler = !configs.autoDiddler;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                ("Auto Diddler " + (configs.autoDiddler ? "Enabled." : "Disabled.")),
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".t -heal" || message == ".t -ah") {
                    autoHeal = !autoHeal;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                ("Auto Heal " + (autoHeal ? "Enabled." : "Disabled.")),
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".c -t -aa" && player.isOwner) {
                    autoAcceptEnabled = !autoAcceptEnabled;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Auto Accept ${autoAcceptEnabled ? "Enabled." : "Disabled."}`,
                                "settings"
                            );
                        }, 6);
                    }

                    if (notifications.length > 0 && autoAcceptEnabled) {
                        for (let i = 0; i < notifications.length; i++) {
                            let sid = notifications[i].sid;
                            let name = notifications[i].name;
                            setTimeout(() => {
                                lastAccept = performance.now();
                                window.aJoinReq(sid, 1);
                                game.tickBase(() => {
                                    console.log(`Accepting ${name}`);
                                }, 6);
                                notifications.splice(i, 1);
                            }, i * 1500);
                        }
                    }
                } else if (player.isOwner && message == ".c -d") {
                    let teamName = player.team;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                ("Deleted " + teamName + (teamName.endsWith(".") ? "" : ".")),
                                "settings"
                            );
                        }, 6);
                    }

                    packet("N", "leave");
                } else if (message.startsWith(".c -j -")) {
                    let clan = undefined;
                    for (let i = 0; i < alliances.length; i++) {
                        if (alliances[i].sid.replaceAll(String.fromCharCode(0), "") == (message.replace(".c -j -", "").trim())) {
                            clan = alliances[i].sid;
                            packet("b", clan, "join");
                        }
                    }
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                ("Joining " +
                                 (clan +
                                  (clan.endsWith(".")
                                   ? ""
                                   : "."))),
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message.startsWith(".c -c -")) {
                    let clan = message.replace(".c -c -", "");
                    packet("L", clan);
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",

                                ("Created " + (clan + (clan.endsWith(".") ? "" : "."))),
                                "settings"
                            );
                        }, 6);
                    }


                } else if (message.startsWith(".c -a -")) {
                    let sid = Number(message.replace(".c -a -", ""));
                    if (player.isOwner) {
                        window.aJoinReq(sid, 1);
                        let notification = notifications.find2(n => n.sid === sid);
                        if (notification) {
                            let name = notification.name;
                            if (saySettings) {
                                game.tickBase(() => {
                                    packet("6", name + " has been accepted.", "settings");
                                }, 6);
                            }
                        }
                    }

                } else if (message.startsWith(".c -k -")) {
                    let sid = Number(message.replace(".c -k -", ""));
                    if (player.isOwner) {
                        packet("Q", sid, "kick");
                        let name = alliancePlayers[(alliancePlayers.indexOf(sid) + 1)];
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", name + " has been kicked.", "settings");
                            }, 6);
                        }
                    }
                } else if (message.startsWith(".c -l")) {
                    if (!player.isOwner) {
                        let teamName = player.team;
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    ("Left " + teamName + (teamName.endsWith(".") ? "" : ".")),
                                    "settings"
                                );
                            }, 6);
                        }
                        packet("N", "leave");
                    }

                } else if (message == ".t -ab") {
                    configs.autoBreaker = !configs.autoBreaker;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Autobreaker ${configs.autoBreaker ? "Enabled." : "Disabled."}`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".el") {
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", annoyingList.join(), "settings");
                        }, 6);
                    }
                } else if (message.startsWith(".el -r -")) {
                    let a = validID(message.replace(".el -r -", ""), null);
                    if (typeof a === "number" && annoyingList.includes(a)) {
                        annoyingList.splice(annoyingList.indexOf(a));
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", a + " removed from Enemylist.", "settings");
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    typeof a !== "number" ? ('"' + message.replace(".el -r -", "") + '" is not a number.') : (message.replace(".el -r -", "") + " is not in your Enemylist."),
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message.startsWith(".tpl -r -")) {
                    let a = validID(message.replace(".tpl -r -", ""), null);
                    if (typeof a === "number" && tpList.includes(a)) {
                        tpList.splice(tpList.indexOf(a));
                        if (saySettings) {
                            let as = findPlayerBySID(a);
                            game.tickBase(() => {
                                packet("6", (as?.name?.length <= 11 ? as.name : a) + " removed from TP-List.", "settings");
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    '"' + message.replace(".tpl -r -", "") + '"' + " is not a number.",
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message.startsWith(".tpl -a -")) {
                    let a = Number(message.replace(".tpl -a -", ""));
                    if (!Number.isNaN(a)) {
                        let as = findPlayerBySID(a);
                        tpList.push(a);
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    (as.name.length <= 12 ? as.name : a) + " added to TP List.",
                                    "settings"
                                );
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    '"' + message.replace(".tpl -a -", "") + '"' + " is not a number.",
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message.startsWith(".el -a -")) {
                    let a = Number(message.replace(".el -a -", ""));
                    if (!Number.isNaN(a)) {
                        let as = findPlayerBySID(a);
                        if (friendList.includes(a)) friendList.splice(friendList.indexOf(a), 1);
                        annoyingList.push(a);
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    (as.name.length <= 10 ? as.name : a) + " added to Enemy List.",
                                    "settings"
                                );
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    '"' + message.replace(".el -a -", "") + '"' + " is not a number.",
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message == ".tpl") {
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", tpList.join(), "settings");
                        }, 6);
                    }
                } else if (message == ".fl") {
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", friendList.join(), "settings");
                        }, 6);
                    }
                } else if (message.startsWith(".fl -r -")) {
                    let a = validID(message.replace(".fl -r -", ""), null);
                    if (typeof a === "number" && friendList.includes(a)) {
                        friendList.splice(friendList.indexOf(a));
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", a + " removed from Friendlist.", "settings");
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    typeof a !== "number" ? ('"' + message.replace(".fl -r -", "") + '" is not a number.') : (message.replace(".fl -r -", "") + " is not in your Friendlist."),
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message.startsWith(".fl -a -")) {
                    let a = Number(message.replace(".fl -a -", ""));
                    if (!Number.isNaN(a) && Number.isInteger(a) && a > 0 && a <= 50) {
                        let as = findPlayerBySID(a);
                        friendList.push(a);
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    (as?.name?.length <= 9 ? as.name : a) + " Added To Friendlist.",
                                    "settings"
                                );
                            }, 6);
                        }
                    } else {
                        if (saySettings) {
                            game.tickBase(() => {
                                packet(
                                    "6",
                                    '"' + message.replace(".fl -a -", "") + '" is not a valid number.',
                                    "settings"
                                );
                            }, 6);
                        }
                    }
                } else if (message == ".d") {
                    saySettings = !saySettings;
                } else if (message == ".r -dh") {
                    my.defaultHat = "auto";
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", "DefaultHat reset.");
                        }, 6);
                    }
                } else if (message == ".r -ch") {
                    my.combatHat = 6;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", "CombatHat reset.");
                        }, 6);
                    }
                } else if (message == ".r -da") {
                    my.defaultAccessory = 11;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", "DefaultAccessory reset.");
                        }, 6);
                    }
                } else if (message == ".r -ca") {
                    my.combatTail = 19;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", "CombatAccessory reset.");
                        }, 6);
                    }
                } else if (message.startsWith(".s -dh -")) {
                    let a = message.replace(".s -dh -", "");
                    let isName = hats.find2((e) => e.name.toLowerCase().replaceAll(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: cap| armor| hat| gear| helmet| head)/g, "") == a.toLowerCase())?.id;
                    let hatExists = validID(isName ?? a, null, hats);
                    if (typeof hatExists == "number") {
                        my.defaultHat = isName ?? hatExists;
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", "DefaultHat set to " + my.defaultHat + ".", "settings");
                            }, 6);
                        }
                    } else if (saySettings) {
                        game.tickBase(() => {
                            packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.');
                        }, 6);
                    }
                } else if (message.startsWith(".s -ch -")) {
                    let a = message.replace(".s -ch -", "");
                    let isName = hats.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: cap| armor| hat| gear| helmet| head)/g, "") == a.toLowerCase())?.id;
                    let hatExists = validID(isName ?? a, null, hats);
                    if (typeof hatExists == "number") {
                        my.combatHat = isName ?? hatExists;
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", "CombatHat set to " + my.combatHat + ".", "settings");
                            }, 6);
                        }
                    } else if (saySettings) {
                        game.tickBase(() => {
                            packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.');
                        }, 6);
                    }
                } else if (message.startsWith(".s -da -")) {
                    let a = message.replace(".s -da -", "");
                    let isName = accessories.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: tail| wings| cape)/g, "") == a.toLowerCase())?.id;
                    let accExists = validID(isName ?? a, null, accessories);
                    console.log(accExists, typeof accExists, isName, a)
                    if (typeof accExists == "number" || a == "21") {
                        my.defaultTail = a == "21" ? 21 : isName ?? accExists;
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", "DefaultAccessory set to " + my.defaultTail + ".", "settings");
                            }, 6);
                        }
                    } else if (saySettings) {
                        game.tickBase(() => {
                            packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.', "settings");
                        }, 6);
                    }
                } else if (message.startsWith(".s -ca -")) {
                    let a = message.replace(".s -ca -", "");
                    let isName = accessories.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: tail| wings| cape)/g, "") == a.toLowerCase())?.id;
                    let accExists = validID(isName ?? a, null, accessories);
                    if (typeof accExists == "number" || a == "21") {
                        my.combatTail = a == "21" ? 21 : isName ?? accExists;
                        if (saySettings) {
                            game.tickBase(() => {
                                packet("6", "CombatAccessory Set To " + my.combatTail + ".", "settings");
                            }, 6);
                        }
                    } else if (saySettings) {
                        game.tickBase(() => {
                            packet("6", '"' + a.slice(0, 8) + '" is not a valid id.');
                        }, 6);
                    }
                } else if (
                    message == ".t -ast" ||
                    message == ".t -antispiketick"
                ) {
                    configs.antiZpyklerTick = !configs.antiZpyklerTick;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `AntiSpikeTick ${
                                configs.antiZpyklerTick ? "Enabled." : "Disabled."
                                }`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (
                    message == ".t -bs" ||
                    message == ".t -abs" ||
                    message == ".t -bullspam" ||
                    message == ".t -autobullspam"
                ) {
                    configs.bullspam = !configs.bullspam;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `AutoBullSpam ${configs.bullspam ? "Enabled." : "Disabled."}`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message.startsWith(".s -ppd -")) {
                    let a = message.replace(".s -ppd -", "");
                    getEl("customDelay-text").value = a;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", `PreplaceDelay Set To ${a}`, "settings");
                        }, 6);
                    }
                } else if (message == ".e -p" || message == ".e -placers" || message == ".a -p" || message == ".a -placers") {
                    configs.autoReplace = true;
                    configs.autoPreplace = true;
                    configs.autoPlace = true;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", `All Placers Enabled.`, "settings");
                        }, 6);
                    }
                } else if (message == ".d -p" || message == ".d -placers") {
                    configs.autoReplace = false;
                    configs.autoPreplace = false;
                    configs.autoPlace = false;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet("6", `All Placers Disabled.`, "settings");
                        }, 6);
                    }
                } else if (
                    message == ".t -evil" ||
                    message == ".t -1v1" ||
                    message == ".t -wall"
                ) {
                    evil = !evil;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Walls ${evil ? "Disabled." : "Enabled."}`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".t -hl" || message == ".t -hatloop" || message == ".t -hat") {
                    hatLoop = !hatLoop;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Hatloop ${hatLoop ? "Enabled." : "Disabled."}`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".t -ait") {
                    configs.antiInstaTricker = !configs.antiInstaTricker;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Anti Insta Tricker ${configs.antiInstaTricker ? "Enabled." : "Disabled."}dddddddd`,
                                "settings"
                            );
                        }, 6);
                    }
                } else if (message == ".t -ap" || message == ".t autoplace") {
                    let a;
                    configs.autoPlace = !configs.autoPlace;
                    if (saySettings) {
                        game.tickBase(() => {
                            packet(
                                "6",
                                `Autoplace ${configs.autoPlace ? "Enabled." : "Disabled."}`,
                                "settings"
                            );
                        }, 6);
                    }
                }
                // ANTI PROFANITY:
                let profanity = [
                    "cunt",
                    "whore",
                    "fuck",
                    "shit",
                    "faggot",
                    "nigger",
                    "nigga",
                    "dick",
                    "vagina",
                    "minge",
                    "cock",
                    "rape",
                    "cum",
                    "sex",
                    "tits",
                    "penis",
                    "clit",
                    "pussy",
                    "meatcurtain" ,
                    "jizz" ,
                    "prune",
                    "douche",
                    "wanker",
                    "damn",
                    "bitch",
                    "dick",
                    "fag",
                    "bastard",
                ];
                let tmpString;
                for (let i = 0; i < profanity.length; i++) {
                    let profany = profanity[i];
                    if (data[0].indexOf(profany) > -1) {
                        tmpString = "";
                        for (let i = 0; i < profany.length; ++i) {
                            if (i == 1) {
                                tmpString += String.fromCharCode(0);
                            }
                            tmpString += profany[i];
                        }
                        let re = new RegExp(profany, "g");
                        data[0] = data[0].replace(re, tmpString);
                    }
                }

                // FIX CHAT:
                data[0] = data[0].slice(0, 30);
            }
        } else if (type == "L") {
            // MAKE SAME CLAN:
            data[0] = data[0] + String.fromCharCode(0).repeat(1);
            data[0] = data[0].slice(0, 7);
        } else if (type == "M") {
            // APPLY CYAN COLOR:
            console.log(data)
            data[0].moofoll = true;
            data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
            lastsp = [data[0].name, data[0].moofoll, data[0].skin];
        } else if (type == "D") {
            if (data[1] != 1 || my.noAim) dontSend = true;
            if (my.lastDir == data[0] || [null, undefined].includes(data[0])) {
                dontSend = true;
            } else {
                my.lastDir = data[0];
            }
        } else if (type == "F") {
            if (!data[2]) {
                dontSend = true;
            } else {
                if (data[0] == 1) {
                    hitting = true;
                } else if (data[0] == 0) {
                    hitting = false;
                }
                if (![null, undefined].includes(data[1])) {
                    my.lastDir = data[1];
                }
            }
        } else if (type == "K") {
            if (!data[1]) {
                dontSend = true;
            }
        } else if (type == "9") {
            if (clientMoveDir == data[0] || !data[2] && (stopMoving || !data[1] ||
                                                         (clientMoveDir == data[0] ||
                                                          (oneTicking &&
                                                           data[0] != nearHacker.aim2 &&
                                                           data[0] != nearHacker.aim2 + Math.PI))
                                                        )) {
                dontSend = true;
            } else clientMoveDir = data[0];
        }
        if (!dontSend) {
            packets.push([
                performance.now(),
                type,
                data,
                WhiteoutNet.encode([type, data]),
                packetCaller,
            ]);
            for (let i = 0; i < packets.length; i++) {
                if (performance.now() - packets[i][0] > 10000) {
                    packets.splice(i, 1);
                }
            }
            const binary = WhiteoutNet.encodeOut(this, type, type == "D" ? [data[0]] : data);
            if (!binary) return;
            WhiteoutNet.nativeSend(this, binary);

            // START COUNT:
            if (!firstSend.sec) {
                firstSend.sec = true;
                setTimeout(() => {
                    firstSend.sec = false;
                    secPacket = 0;
                }, secTime);
            }

            if (secPacket == 100) {
                addMenuChText("Warning", "Sending Too Many Packets", "#cc5151", 1);
            }

            secPacket++;
        }
    } else {
        this.nsend(message);
    }
};

function packet(type) {
    if (!hacking) return;
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);
    packetCaller = data[data.length - 1];
    if (type != "9" || !noMove || packetCaller == "antionetick" || packetCaller == "onetick") {

        // SEND MESSAGE:
        WhiteoutNet.send(WS, type, data);
    }
}

function packet2(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);
    packetCaller = data[data.length - 1];
    packets.push([
        performance.now(),
        [type, data],
        WhiteoutNet.encode([type, data]),
        packetCaller,
    ]);
    if (type != "9" || !noMove || packetCaller == "antionetick" || packetCaller == "onetick") {

        // SEND MESSAGE:
        WhiteoutNet.nativeSend(WS, WhiteoutNet.encodeOut(WS, type, data));
    }
}

function origPacket(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // SEND MESSAGE:
    WhiteoutNet.nativeSend(WS, WhiteoutNet.encodeOut(WS, type, data));
}

window.leave = function () {
    if (WS) WS.close();
};

//...lol
let io = {
    send: packet,
};

function getMessage(message) {
    const frame = WhiteoutNet.decodeIn(WS, message.data);
    if (!frame) return;
    let type = frame[0];
    let data = frame[1];
    let events = {
        A: setInitData, // id: setInitData,
        //B: disconnect,
        C: setupGame, // 1: setupGame,
        D: addPlayer, // 2: addPlayer,
        E: removePlayer, // 4: removePlayer,
        a: updatePlayers, // 33: updatePlayers,
        G: updateLeaderboard, // 5: updateLeaderboard,here
        H: loadGameObject, // 6: loadGameObject,
        I: loadAI, // a: loadAI,
        J: animateAI, // aa: animateAI,
        K: gatherAnimation, // 7: gatherAnimation,
        L: wiggleGameObject, // 8: wiggleGameObject,
        M: shootTurret, // sp: shootTurret,
        N: updatePlayerValue, // 9: updatePlayerValue,
        O: updateHealth, // h: updateHealth,//here
        P: killPlayer, // 11: killPlayer,
        Q: killObject, // 12: killObject,
        R: killObjects, // 13: killObjects,
        S: updateItemCounts, // 14: updateItemCounts,
        T: updateAge, // 15: updateAge,
        U: updateUpgrades, // 16: updateUpgrades,
        V: updateItems, // 17: updateItems,
        X: addProjectile, // 18: addProjectile,
        Y: remProjectile, // 19: remProjectile,
        //Z: serverShutdownNotice,
        g: addAlliance,
        1: deleteAlliance,
        2: allianceNotification, // an: allianceNotification,
        3: setPlayerTeam, // st: setPlayerTeam,
        4: setAlliancePlayers, // sa: setAlliancePlayers,
        5: updateStoreItems, // us: updateStoreItems,
        6: receiveChat, // ch: receiveChat,
        7: updateMinimap, // mm: updateMinimap,
        8: showText, // t: showText,
        9: pingMap, // p: pingMap,
        0: pingSocketResponse,
    };
    if (type == "io-init") {
        socketID = data[0];
    } else {
        if (events[type]) {
            events[type].apply(undefined, data);
        }
    }
}
let notifications = [];

function allianceNotification(sid, name) {
    notifications.push({ sid: sid, name: name });
    if (autoAcceptEnabled && player.isOwner) {
        setTimeout(() => {
            lastAccept = performance.now();
            window.aJoinReq(sid, 1);
            game.tickBase(() => {
                console.log(`Accepting ${name}`);
            }, 6);
        }, Math.max(0, 1000 - (performance.now() - lastAccept)));
    }
}

function deleteAlliance(sid) {
    for (let t = alliances.length - 1; t >= 0; t--)
        alliances[t].sid == sid && alliances.splice(t, 1);
}
function addAlliance(alliance) {
    alliances.push(alliance);
}
// MATHS:
Math.lerpAngle = function (value1, value2, amount) {
    let difference = Math.abs(value2 - value1);
    if (difference > Math.PI) {
        if (value1 > value2) {
            value2 += Math.PI * 2;
        } else {
            value1 += Math.PI * 2;
        }
    }
    let value = value2 + (value1 - value2) * amount;
    if (value >= 0 && value <= Math.PI * 2) return value;
    return value % (Math.PI * 2);
};

// REOUNDED RECTANGLE:
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};

// GLOBAL VALUES:
function resetMoveDir() {
    keys = {};
    packet("e", "resetMoveDir");
}

let ticks = {
    tick: 0,
    delay: 0,
    time: [],
    manage: [],
};
let ais = [];
let players = [];
let alliances = [];
let alliancePlayers = [];
let allianceNotifications = [];
let gameObjects = [];
let liztobj = [];
let projectiles = [];
let deadPlayers = [];

let breakObjects = [];

let playerSID;

let enemy = [];
let nears = [];
let near = [];
let nearPlayers = [];
let waitInsta = false;
let my = {
    noAim: false,
    reloaded: false,
    waitDoubleZpyklerTick: false,
    waitHit: 0,
    autoAim: 0,
    revAim: false,
    defaultHat: "auto",
    combatHat: 6,
    defaultTail: 11,
    combatTail: 19,
    ageInsta: true,
    reSync: false,
    bullTick: 0,
    anti0tick: 0,
    antiSync: false,
    safePrimary: function (tmpObj) {
        return [0, 8].includes(tmpObj.primaryIndex);
    },
    safeSecondary: function (tmpObj) {
        return [10, 11, 14].includes(tmpObj.secondaryIndex);
    },
    lastDir: 0,
    autoPush: false,
    pushData: {},
};

// FIND OBJECTS BY ID/SID:
function findID(tmpObj, tmp) {
    return tmpObj.find2((THIS) => THIS.id == tmp);
}

function findSID(tmpObj, tmp) {
    return tmpObj.find2((THIS) => THIS.sid == tmp);
}

function findPlayerByID(id) {
    return findID(players, id);
}

function findPlayerBySID(sid) {
    return findSID(players, sid);
}

function findPlayerByName(name) {
    return players.sort((a, b) => a.dist2 - b.dist2).find2((e) => e.name == name);
}

function findAIBySID(sid) {
    return findSID(ais, sid);
}

function findObjectBySid(sid) {
    return findSID(gameObjects, sid);
}

function findProjectileBySid(sid) {
    return findSID(gameObjects, sid);
}
let renderObj = [];
let adCard = getEl("adCard");
adCard.remove();
let promoImageHolder = getEl("promoImgHolder");
promoImageHolder.remove();

let chatButton = getEl("chatButton");
chatButton.remove();
let gameCanvas = getEl("gameCanvas");
let mainContext = gameCanvas.getContext("2d");
let mapDisplay = getEl("mapDisplay");
let mapContext = mapDisplay.getContext("2d");
getEl("mapDisplay").style.width = "250px";
getEl("mapDisplay").style.height = "250px";
let storeMenu = getEl("storeMenu");
let storeHolder = getEl("storeHolder");
let upgradeHolder = getEl("upgradeHolder");
let upgradeCounter = getEl("upgradeCounter");
let chatBox = getEl("chatBox");
chatBox.autocomplete = "off";
chatBox.style.textAlign = "center";
chatBox.style.width = "18em";
let chatHolder = getEl("chatHolder");
let actionBar = getEl("actionBar");
let leaderboardData = getEl("leaderboardData");
let itemInfoHolder = getEl("itemInfoHolder");
let menuCardHolder = getEl("menuCardHolder");
let mainMenu = getEl("mainMenu");
const displayValue = window.getComputedStyle(mainMenu).display;
let diedText = getEl("diedText");
let screenWidth;
let screenHeight;
let maxScreenWidth = config.maxScreenWidth;
let maxScreenHeight = config.maxScreenHeight;
let pixelDensity = 1;
let delta;
let now;
let lastUpdate = performance.now();
let camX;
let camY;
let tmpDir;
let mouseX = 0;
let mouseY = 0;
let allianceMenu = getEl("allianceMenu");
let waterMult = 1;
let waterPlus = 0;

let outlineColor = "#525252";
let darkOutlineColor = "#3d3f42";
let outlineWidth = 5.5;

let firstSetup = true;
let keys = {};
let moveKeys = {
    87: [0, -1],
    38: [0, -1],
    83: [0, 1],
    40: [0, 1],
    65: [-1, 0],
    37: [-1, 0],
    68: [1, 0],
    39: [1, 0],
};
let attackState = 0;
let inGame = false;

let macro = {};
let mills = {
    place: 0,
    placeSpawnPads: 0,
};
let lastDir;

let lastLeaderboardData = [];

// ON LOAD:
let inWindow = true;
window.onblur = function () {
    inWindow = false;
};
window.onfocus = function () {
    inWindow = true;
    if (player && player.alive) {
        // resetMoveDir();
    }
};
let ms = {
    avg: 0,
    max: 0,
    min: 0,
    delay: 0,
};
function pingSocketResponse() {
    let pingTime = window.pingTime;
    const pingDisplay = document.getElementById("pingDisplay");
    pingDisplay.innerText = "";
    if (pingTime > ms.max || isNaN(ms.max)) {
        ms.max = pingTime;
    }
    if (pingTime < ms.min || isNaN(ms.min)) {
        ms.min = pingTime;
    }

    // if (pingTime >= 90) {
    //     doAutoQ = true;
    // } else {
    //     doAutoQ = false;
    // }
}

let placeVisible = [];

/** CLASS CODES */

class uwutils {
    constructor() {
        // MATH UWUTILS:
        let mathABS = Math.abs,
            mathCOS = Math.cos,
            mathSIN = Math.sin,
            mathPOW = Math.pow,
            mathSQRT = Math.sqrt,
            mathATAN2 = Math.atan2,
            mathPI = Math.PI;

        let _this = this;

        // GLOBAL UWUTILS:
        this.averageAngle = function (angles) {
            let sin = 0, cos = 0;
            for (let i = 0; i < angles.length; i++) {
                sin += Math.sin(angles[i]);
                cos += Math.cos(angles[i]);
            }
            return Math.atan2(sin / angles.length, cos / angles.length);
        }
        this.getMidAngle = function (a, b) {
            return Math.atan2((Math.sin(a) + Math.sin(b)) / 2, (Math.cos(a) + Math.cos(b)) / 2);
        };
        this.round = function (n, v) {
            return Math.round(n * v) / v;
        };
        this.toRad = function (angle) {
            return angle / 180 * mathPI;
        };
        this.toAng = function (radian) {
            return radian / mathPI * 180;
        };
        this.randInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        this.randFloat = function (min, max) {
            return Math.random() * (max - min + 1) + min;
        };
        this.lerp = function (value1, value2, amount) {
            return value1 + (value2 - value1) * amount;
        };
        this.decel = function (val, cel) {
            if (val > 0) val = Math.max(0, val - cel);
            else if (val < 0) val = Math.min(0, val + cel);
            return val;
        };
        this.getDistance = function (x1, y1, x2, y2) {
            return fastHypot(x2 - x1, y2 - y1);
        };
        this.getRealDistance = function (x1, y1, x2, y2) {
            return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
        };
        this.getDist = function (tmp1, tmp2, type1, type2) {
            const tmpXY1 = {
                x:
                type1 == 0
                ? tmp1.x
                : type1 == 1
                ? tmp1.x1
                : type1 == 2
                ? tmp1.x2
                : type1 == 3 ? tmp1.x3
                : type1 == 4 ? tmp1.x4
                : type1 == 5 ? tmp1.x5
                : 0,
                y:
                type1 == 0
                ? tmp1.y
                : type1 == 1
                ? tmp1.y1
                : type1 == 2
                ? tmp1.y2
                : type1 == 3 ? tmp1.y3
                : type1 == 4 ? tmp1.y4
                : type1 == 5 ? tmp1.y5
                : 0,
            };
            const tmpXY2 = {
                x:
                type2 == 0
                ? tmp2.x
                : type2 == 1
                ? tmp2.x1
                : type2 == 2
                ? tmp2.x2
                : type2 == 3 ? tmp2.x3
                : type2 == 4 ? tmp2.x4
                : type2 == 5 ? tmp2.x5
                : 0,
                y:
                type2 == 0
                ? tmp2.y
                : type2 == 1
                ? tmp2.y1
                : type2 == 2
                ? tmp2.y2
                : type2 == 3 ? tmp2.y3
                : type2 == 4 ? tmp2.y4
                : type2 == 5 ? tmp2.y5
                : 0,
            };
            return mathSQRT(
                (tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y
            );
        };
        this.getDirection = function (x1, y1, x2, y2) {
            return mathATAN2(y1 - y2, x1 - x2);
        };
        this.getDirect = function (tmp1, tmp2, type1, type2) {
            const tmpXY1 = {
                x:
                type1 == 0
                ? tmp1.x
                : type1 == 1
                ? tmp1.x1
                : type1 == 2
                ? tmp1.x2
                : type1 == 3 ? tmp1.x3
                : type1 == 4 ? tmp1.x4
                : type1 == 5 ? tmp1.x5
                : 0,
                y:
                type1 == 0
                ? tmp1.y
                : type1 == 1
                ? tmp1.y1
                : type1 == 2
                ? tmp1.y2
                : type1 == 3 ? tmp1.y3
                : type1 == 4 ? tmp1.y4
                : type1 == 5 ? tmp1.y5
                : 0,
            };
            const tmpXY2 = {
                x:
                type2 == 0
                ? tmp2.x
                : type2 == 1
                ? tmp2.x1
                : type2 == 2
                ? tmp2.x2
                : type2 == 3 ? tmp2.x3
                : type2 == 4 ? tmp2.x4
                : type2 == 5 ? tmp2.x5
                : 0,
                y:
                type2 == 0
                ? tmp2.y
                : type2 == 1
                ? tmp2.y1
                : type2 == 2
                ? tmp2.y2
                : type2 == 3 ? tmp2.y3
                : type2 == 4 ? tmp2.y4
                : type2 == 5 ? tmp2.y5
                : 0,
            };
            return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
        };
        this.getAngleDist = function (a, b) {
            let p = mathABS(b - a) % (mathPI * 2);
            return p > mathPI ? mathPI * 2 - p : p;
        };
        this.isNumber = function (n) {
            return typeof n == "number" && !isNaN(n) && isFinite(n);
        };
        this.isString = function (s) {
            return s && typeof s == "string";
        };
        this.kFormat = function (num) {
            return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
        };
        this.sFormat = function (num) {
            let fixs = [
                {
                    num: 1e3,
                    string: "k",
                },
                {
                    num: 1e6,
                    string: "m",
                },
                {
                    num: 1e9,
                    string: "b",
                },
                {
                    num: 1e12,
                    string: "q",
                },
            ].reverse();
            let sp = fixs.find2((v) => num >= v.num);
            if (!sp) return num;
            return (num / sp.num).toFixed(1) + sp.string;
        };
        this.capitalizeFirst = function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };
        this.fixTo = function (n, v) {
            return parseFloat(n.toFixed(v));
        };
        this.sortByPoints = function (a, b) {
            return parseFloat(b.points) - parseFloat(a.points);
        };
        this.angleWidth = function(x1, y1, x2, y2, rad) {
            const dist = Math.hypot(x1 - x2, y1 - y2);
            return dist <= rad ? PI2 : Math.atan(rad / dist);
        }
        this.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
            let minX = x1;
            let maxX = x2;
            if (x1 > x2) {
                minX = x2;
                maxX = x1;
            }
            if (maxX > recX2) maxX = recX2;
            if (minX < recX) minX = recX;
            if (minX > maxX) return false;
            let minY = y1;
            let maxY = y2;
            let dx = x2 - x1;
            if (Math.abs(dx) > 0.0000001) {
                let a = (y2 - y1) / dx;
                let b = y1 - a * x1;
                minY = a * minX + b;
                maxY = a * maxX + b;
            }
            if (minY > maxY) {
                let tmp = maxY;
                maxY = minY;
                minY = tmp;
            }
            if (maxY > recY2) maxY = recY2;
            if (minY < recY) minY = recY;
            if (minY > maxY) return false;
            return true;
        };
        this.checkLineCollision = function(th, plyr, objs, r, pre, dist) {
            const newPos = {
                x: pre ? plyr.x3 : plyr.x2,
                y: pre ? plyr.y3 : plyr.y2
            }
            for (let i = 0;i < objs.length;i++) {
                const obj = objs[i];
                if (Math.hypot(obj.x - newPos.x, obj.y - newPos.y) > dist || obj.ignoreCollision && (!obj.trap || obj.isTeamObject(plyr))) continue;
                const thCos = Math.cos(th);
                const thSin = Math.sin(th);
                const len = (obj.x - newPos.x) * thCos + (obj.y - newPos.y) * thSin;
                const closeX = newPos.x + thCos * len;
                const closeY = newPos.y + thSin * len;
                const dx = closeX - obj.x;
                const dy = closeY - obj.y;
                const rad = obj.scale + r;
                if ((dx * dx + dy * dy) < (rad * rad)) {
                    return obj;
                }
            }
            return false;
        }
        this.containsPoint = function (element, x, y) {
            let bounds = element.getBoundingClientRect();
            let left = bounds.left + window.scrollX;
            let top = bounds.top + window.scrollY;
            let width = bounds.width;
            let height = bounds.height;

            let insideHorizontal = x > left && x < left + width;
            let insideVertical = y > top && y < top + height;
            return insideHorizontal && insideVertical;
        };
        this.mousifyTouchEvent = function (event) {
            let touch = event.changedTouches[0];
            event.screenX = touch.screenX;
            event.screenY = touch.screenY;
            event.clientX = touch.clientX;
            event.clientY = touch.clientY;
            event.pageX = touch.pageX;
            event.pageY = touch.pageY;
        };

        this.removeAllChildren = function (element) {
            while (element.hasChildNodes()) {
                element.removeChild(element.lastChild);
            }
        };
        this.generateElement = function (config) {
            let element = document.createElement(config.tag || "div");

            function bind(configValue, elementValue) {
                if (config[configValue]) element[elementValue] = config[configValue];
            }
            bind("text", "textContent");
            bind("html", "innerHTML");
            bind("class", "className");
            for (let key in config) {
                switch (key) {
                    case "tag":
                    case "text":
                    case "html":
                    case "class":
                    case "style":
                    case "parent":
                    case "children":
                        continue;
                    default:
                        break;
                }
                element[key] = config[key];
            }
            if (element.onclick) element.onclick = this.checkTrusted(element.onclick);
            if (element.onmouseover)
                element.onmouseover = this.checkTrusted(element.onmouseover);
            if (element.onmouseout)
                element.onmouseout = this.checkTrusted(element.onmouseout);
            if (config.style) {
                element.style.cssText = config.style;
            }
            if (config.parent) {
                config.parent.appendChild(element);
            }
            if (config.children) {
                for (let i = 0; i < config.children.length; i++) {
                    element.appendChild(config.children[i]);
                }
            }
            return element;
        };
        this.checkTrusted = function (callback) {
            return function (ev) {
                if (
                    ev &&
                    ev instanceof Event &&
                    (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)
                ) {
                    callback(ev);
                } else {
                    //console.error("Event is not trusted.", ev);
                }
            };
        };
        this.randomString = function (length) {
            let text = "";
            let possible =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (let i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };
        this.countInArray = function (array, val) {
            let count = 0;
            for (let i = 0; i < array.length; i++) {
                if (array[i] === val) count++;
            }
            return count;
        };
        this.hexToRgb = function (hex) {
            return hex
                .slice(1)
                .match(/.{1,2}/g)
                .map((g) => parseInt(g, 16));
        };
        this.getRgb = function (r, g, b) {
            return [r / 255, g / 255, b / 255].join(", ");
        };
    }
}
class Animtext {
    // ANIMATED TEXT:
    constructor(image) {
        this.image = image;
        // INIT:
        this.init = function (x, y, scale, speed, life, text, crit, color) {
            (this.x = x),
                (this.y = y),
                (this.crit = Number(text) > 80 || crit),
                (this.color = color),
                (this.scale = scale * 1.5),
                (this.weight = 50);
            (this.startScale = this.scale),
                (this.maxScale = 1.5 * scale),
                (this.minScale = 0.5 * scale),
                (this.scaleSpeed = 0.7),
                (this.speed = speed),
                (this.speedMax = speed),
                (this.life = life),
                (this.maxLife = life),
                (this.text = text),
                (this.movSpeed = speed);
        };

        // UPDATE:
        this.update = function (dlta) {
            if (this.life) {
                this.life -= dlta;
                if (this.scaleSpeed != -0.35) {
                    this.y -= this.speed * dlta;
                    // (this.x += this.speed * dlta);
                } else {
                    this.y -= this.speed * dlta;
                }
                this.scale -= (this.crit ? 0.44 : 0.8);
                // this.scale > 0.35 && (this.scale = Math.max(this.scale, this.startScale));
                // this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
                if (this.scale >= this.maxScale) {
                    this.scale = this.maxScale;
                    this.scaleSpeed *= -0.5;
                    this.speed = this.speed * 0.75;
                }
                this.life <= 0 && (this.life = 0);
            }
        };

        // RENDER:
        this.render = function (ctxt, xOff, yOff, img) {
            if (img) {
                ctxt.globalAlpha = 1;
                ctxt.drawImage(img, this.x - xOff - img.width * (this.scale / 300) / 2, this.y - yOff - img.height * (this.scale / 300), img.width * (this.scale / 300), img.height * (this.scale / 300))
                let tmpScale = this.scale / 2
                ctxt.lineWidth = tmpScale / 6;
                ctxt.strokeStyle = darkOutlineColor; //"black";
                ctxt.fillStyle = this.color;
                ctxt.globalAlpha = 1;
                ctxt.font = (tmpScale || 1) + "px Lilita One";
                ctxt.strokeText(this.text, this.x - 2 - xOff, this.y - yOff - img.height * (this.scale / 400));
                ctxt.fillText(this.text, this.x - 2 - xOff, this.y - yOff - img.height * (this.scale / 400));
                ctxt.globalAlpha = 1;
            } else {
                ctxt.lineWidth = 5.5;
                ctxt.strokeStyle = darkOutlineColor; //"black";
                ctxt.fillStyle = this.color;
                ctxt.globalAlpha = 1;
                ctxt.font = this.scale + "px Lilita One";
                ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
                ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
                ctxt.globalAlpha = 1;
            }
        };
    }
}
class Textmanager {
    // TEXT MANAGER:
    constructor() {
        this.texts = [];
        this.stack = [];

        // UPDATE:
        this.update = function (dlta, ctxt, xOff, yOff) {
            ctxt.textBaseline = "middle";
            ctxt.textAlign = "center";
            for (let i = 0; i < this.texts.length; ++i) {
                if (this.texts[i].life) {
                    this.texts[i].update(dlta);
                    this.texts[i].render(ctxt, xOff, yOff, this.texts[i].image);
                }
            }
        };

        // SHOW TEXT:
        this.showText = function (x, y, scale, speed, life, text, crit, color, image) {
            let tmpText
            if (!image) {
                const arr = this.texts;
                for (let i = arr.length - 1; i >= 0; i--) {
                    if (!arr[i].life) {
                        this.texts.splice(i, 1)
                        break;
                    }
                }
            }
            if (!tmpText) {
                tmpText = new Animtext(image);
                this.texts.push(tmpText);
            }
            tmpText.init(x, y, scale, speed, life, text, crit, color);
        };
    }
}

class GameObject {
    constructor(sid) {
        this.sid = sid;

        // INIT:
        this.init = function (x, y, dir, scale, type, data, owner) {
            data = data ?? {};
            this.prePlaced = false;
            this.preplaced = 0;
            this.active = true;
            this.render = true;
            this.doUpdate = data.doUpdate;
            this.syncHit = false;
            this.x = x;
            this.y = y;
            this.dir = dir;
            this.alpha = (!owner && type == 0 && UWUTILS.getDistance(x, y, player.x2, player.y2) <= 400) ? 0.5 : 1;
            this.preplaceTimeout = undefined;
            this.aboutToBreak = false;
            this.lastDir = dir;
            this.xWiggle = 0;
            this.yWiggle = 0;
            this.visScale = scale;
            this.scale = scale;
            this.type = type;
            this.id = data.id;
            this.owner = owner;
            this.name = data.name;
            this.isItem = this.id != undefined;
            this.group = data.group;
            this.maxHealth = data.health;
            this.health = this.maxHealth;
            this.layer = 2;
            if (this.group != undefined) {
                this.layer = this.group.layer;
            } else if (this.type == 0) {
                this.layer = 3;
            } else if (this.type == 2) {
                this.layer = 0;
            } else if (this.type == 4) {
                this.layer = -1;
            }
            this.colDiv = data.colDiv || 1;
            this.blocker = data.blocker;
            this.ignoreCollision = data.ignoreCollision;
            this.dontGather = data.dontGather;
            this.hideFromEnemy = data.hideFromEnemy;
            this.friction = data.friction;
            this.projDmg = data.projDmg;
            this.dmg = data.dmg;
            this.pDmg = data.pDmg;
            this.pps = data.pps;
            this.zIndex = data.zIndex || 0;
            this.turnSpeed = data.turnSpeed;
            this.req = data.req;
            this.trap = data.trap;
            this.healCol = data.healCol;
            this.teleport = data.teleport;
            this.boostSpeed = data.boostSpeed;
            this.projectile = data.projectile;
            this.shootRange = data.shootRange;
            this.shootRate = data.shootRate;
            this.shootCount = this.shootRate;
            this.spawnPoint = data.spawnPoint;
            this.breakObj = false;
            this.alpha = data.alpha || 1;
            this.maxAlpha = data.alpha || 1;
            this.damaged = 0;
            this.realScale = this.type <= 1 && this.type !== null ? this.scale * .6 : this.scale;
            this.pathScale = this.type===1&&this.y<=12000 ?this.scale*.6+15
            : this.type===0 ? this.scale*.7+10
            : this.dmg && !checkIsTeam(this?.owner?.sid)||this.teleport || this.boostSpeed ? this.scale+47
            : this.type===1&&this.y>=12000 ? this.scale*.55+47
            : this.name == 'pit trap' && !checkIsTeam(this?.owner?.sid) ? 57
            : this.ignoreCollision ? 0
            : this.scale+12
        };

        // GET HIT:
        this.changeHealth = function (amount, doer) {
            this.health += amount;
            return this.health <= 100;
        };

        // GET SCALE:
        this.getScale = function(sM, ig) {
            sM = sM || 1;
            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
        };

        // VISIBLE TO PLAYER:
        this.visibleToPlayer = function (player) {
            return (
                !this.hideFromEnemy ||
                (this.owner &&
                 (this.owner == player ||
                  (this.owner.team && player.team == this.owner.team)))
            );
        };

        // UPDATE:
        this.update = function (dlta) {
            if (this.active) {
                if (this.xWiggle) {
                    this.xWiggle *= Math.pow(0.99, dlta);
                }
                if (this.yWiggle) {
                    this.yWiggle *= Math.pow(0.99, dlta);
                }
                /*
                if (this.turnSpeed) {
                    this.dir += this.turnSpeed * delta / 2;
                } else {
                    let d2 = UWUTILS.getAngleDist(this.lastDir, this.dir);
                    if (d2 > 0.01) {
                        this.dir += d2 / 5;
                    } else {
                        this.dir = this.lastDir;
                    }
                }*/
            } else {
                if (this.alive) {
                    this.alpha -= dlta / (200 / this.maxAlpha);
                    this.visScale += dlta / (this.scale / 2.5);
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.alive = false;
                    }
                }
            }
        };

        // CHECK TEAM:
        this.isTeamObject = function (tmpObj) {
            return !this.owner
                ? true
            : tmpObj.sid && ((this.owner && tmpObj.sid == this.owner.sid) ||
                             tmpObj.isTeam(findPlayerBySID(this.owner.sid)));
        };
    }
}
let allies = [];
class Items {
    constructor() {
        // ITEM GROUPS:
        this.groups = [
            {
                id: 0,
                name: "food",
                layer: 0,
            },
            {
                id: 1,
                name: "walls",
                place: true,
                limit: 30,
                layer: 0,
            },
            {
                id: 2,
                name: "spikes",
                place: true,
                limit: 15,
                layer: 0,
            },
            {
                id: 3,
                name: "mill",
                place: true,
                limit: 7,
                layer: 1,
            },
            {
                id: 4,
                name: "mine",
                place: true,
                limit: 1,
                layer: 0,
            },
            {
                id: 5,
                name: "trap",
                place: true,
                limit: 6,
                layer: -1,
            },
            {
                id: 6,
                name: "booster",
                place: true,
                limit: 12,
                layer: -1,
            },
            {
                id: 7,
                name: "turret",
                place: true,
                limit: 2,
                layer: 1,
            },
            {
                id: 8,
                name: "watchtower",
                place: true,
                limit: 12,
                layer: 1,
            },
            {
                id: 9,
                name: "buff",
                place: true,
                limit: 4,
                layer: -1,
            },
            {
                id: 10,
                name: "spawn",
                place: true,
                limit: 1,
                layer: -1,
            },
            {
                id: 11,
                name: "sapling",
                place: true,
                limit: 2,
                layer: 0,
            },
            {
                id: 12,
                name: "blocker",
                place: true,
                limit: 3,
                layer: -1,
            },
            {
                id: 13,
                name: "teleporter",
                place: true,
                limit: 2,
                layer: -1,
            },
        ];

        // PROJECTILES:
        this.projectiles = [
            {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 25,
                speed: 1.6,
                scale: 103,
                range: 1000,
            },
            {
                indx: 1,
                layer: 1,
                dmg: 25,
                scale: 20,
            },
            {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 35,
                speed: 2.5,
                scale: 103,
                range: 1200,
            },
            {
                indx: 0,
                layer: 0,
                src: "arrow_1",
                dmg: 30,
                speed: 2,
                scale: 103,
                range: 1200,
            },
            {
                indx: 1,
                layer: 1,
                dmg: 16,
                scale: 20,
            },
            {
                indx: 0,
                layer: 0,
                src: "bullet_1",
                dmg: 50,
                speed: 3.6,
                scale: 160,
                range: 1400,
            },
        ];

        // WEAPONS:
        this.weapons = [
            {
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
                speed: 300,
            },
            {
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
                speed: 400,
            },
            {
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
                speed: 400,
            },
            {
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
                spdMult: 0.85,
                range: 110,
                gather: 1,
                speed: 300,
            },
            {
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
                spdMult: 0.8,
                range: 118,
                gather: 1,
                speed: 300,
            },
            {
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
                knock: 0.2,
                spdMult: 0.82,
                range: 142,
                gather: 1,
                speed: 700,
            },
            {
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
                knock: 0.7,
                range: 110,
                gather: 1,
                speed: 300,
            },
            {
                id: 7,
                type: 0,
                age: 2,
                name: "daggers",
                desc: "really fast short range weapon",
                src: "dagger_1",
                iPad: 0.8,
                length: 110,
                width: 110,
                xOff: 18,
                yOff: 0,
                dmg: 20,
                knock: 0.1,
                range: 65,
                gather: 1,
                hitSlow: 0.1,
                spdMult: 1.13,
                speed: 100,
            },
            {
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
                speed: 400,
            },
            {
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
                Pdmg: 25,
                projectile: 0,
                spdMult: 0.75,
                speed: 600,
            },
            {
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
                Pdmg: 10,
                spdMult: 0.88,
                range: 75,
                sDmg: 7.5,
                gather: 1,
                speed: 400,
            },
            {
                id: 11,
                type: 1,
                age: 6,
                name: "wooden shield",
                desc: "blocks projectiles and reduces melee damage",
                src: "shield_1",
                length: 120,
                width: 120,
                shield: 0.2,
                xOff: 6,
                yOff: 0,
                Pdmg: 0,
                spdMult: 0.7,
            },
            {
                id: 12,
                type: 1,
                age: 8,
                pre: 9,
                name: "crossbow",
                desc: "deals more damage and has greater range",
                src: "crossbow_1",
                req: ["wood", 5],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                Pdmg: 35,
                projectile: 2,
                spdMult: 0.7,
                speed: 700,
            },
            {
                id: 13,
                type: 1,
                age: 9,
                pre: 12,
                name: "repeater crossbow",
                desc: "high firerate crossbow with reduced damage",
                src: "crossbow_2",
                req: ["wood", 10],
                aboveHand: true,
                armS: 0.75,
                length: 120,
                width: 120,
                xOff: -4,
                yOff: 0,
                Pdmg: 30,
                projectile: 3,
                spdMult: 0.7,
                speed: 230,
            },
            {
                id: 14,
                type: 1,
                age: 6,
                name: "diddler",
                desc: "steals resources from enemies",
                src: "grab_1",
                length: 130,
                width: 210,
                xOff: -8,
                yOff: 53,
                dmg: 0,
                Pdmg: 0,
                steal: 250,
                knock: 0.2,
                spdMult: 1.05,
                range: 125,
                gather: 0,
                speed: 700,
            },
            {
                id: 15,
                type: 1,
                age: 9,
                pre: 12,
                name: "musket",
                desc: "slow firerate but high damage and range",
                src: "musket_1",
                req: ["stone", 10],
                aboveHand: true,
                rec: 0.35,
                armS: 0.6,
                hndS: 0.3,
                hndD: 1.6,
                length: 205,
                width: 205,
                xOff: 25,
                yOff: 0,
                Pdmg: 50,
                projectile: 5,
                hideProjectile: true,
                spdMult: 0.6,
                speed: 1500,
            },
        ];

        // ITEMS:
        this.list = [
            {
                group: this.groups[0],
                name: "apple",
                desc: "restores 20 health when consumed",
                req: ["food", 10],
                consume: function (doer) {
                    return doer.changeHealth(20, doer);
                },
                scale: 22,
                holdOffset: 15,
                healing: 20,
                itemID: 0,
                itemAID: 16,
            },
            {
                age: 3,
                group: this.groups[0],
                name: "cookie",
                desc: "restores 40 health when consumed",
                req: ["food", 15],
                consume: function (doer) {
                    return doer.changeHealth(40, doer);
                },
                scale: 27,
                holdOffset: 15,
                healing: 40,
                itemID: 1,
                itemAID: 17,
            },
            {
                age: 7,
                group: this.groups[0],
                name: "cheese",
                desc: "restores 30 health and another 50 over 5 seconds",
                req: ["food", 25],
                consume: function (doer) {
                    if (doer.changeHealth(30, doer) || doer.health < 100) {
                        doer.dmgOverTime.dmg = -10;
                        doer.dmgOverTime.doer = doer;
                        doer.dmgOverTime.time = 5;
                        return true;
                    }
                    return false;
                },
                scale: 27,
                holdOffset: 15,
                healing: 30,
                itemID: 2,
                itemAID: 18,
            },
            {
                group: this.groups[1],
                name: "wood wall",
                desc: "provides protection for your village",
                req: ["wood", 10],
                projDmg: true,
                health: 380,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 3,
                itemAID: 19,
            },
            {
                age: 3,
                group: this.groups[1],
                name: "stone wall",
                desc: "provides improved protection for your village",
                req: ["stone", 25],
                health: 900,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 4,
                itemAID: 20,
            },
            {
                age: 7,
                group: this.groups[1],
                name: "castle wall",
                desc: "provides powerful protection for your village",
                req: ["stone", 35],
                health: 1500,
                scale: 52,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 5,
                itemAID: 21,
            },
            {
                group: this.groups[2],
                name: "spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 20, "stone", 5],
                health: 400,
                dmg: 20,
                scale: 49,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 6,
                itemAID: 22,
                shadow: {
                    offsetX: 5, // Adjust the shadow's X offset as needed
                    offsetY: 5, // Adjust the shadow's Y offset as needed
                    blur: 20, // Adjust the shadow's blur as needed
                    color: "rgba(0, 0, 0, 0.5)", // Adjust the shadow's color and transparency as needed
                },
            },
            {
                age: 5,
                group: this.groups[2],
                name: "greater spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 10],
                health: 500,
                dmg: 35,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 7,
                itemAID: 23,
            },
            {
                age: 9,
                group: this.groups[2],
                name: "poison spikes",
                desc: "poisons enemies when they touch them",
                req: ["wood", 35, "stone", 15],
                health: 600,
                dmg: 30,
                pDmg: 5,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 8,
                itemAID: 24,
            },
            {
                age: 9,
                group: this.groups[2],
                name: "spinning spikes",
                desc: "damages enemies when they touch them",
                req: ["wood", 30, "stone", 20],
                health: 500,
                dmg: 45,
                turnSpeed: 0.003,
                scale: 52,
                spritePadding: -23,
                holdOffset: 8,
                placeOffset: -5,
                itemID: 9,
                itemAID: 25,
            },
            {
                group: this.groups[3],
                name: "windmill",
                desc: "generates gold over time",
                req: ["wood", 50, "stone", 10],
                health: 400,
                pps: 1,
                turnSpeed: 0.0016,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 45,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 10,
                itemAID: 26,
            },
            {
                age: 5,
                group: this.groups[3],
                name: "faster windmill",
                desc: "generates more gold over time",
                req: ["wood", 60, "stone", 20],
                health: 500,
                pps: 1.5,
                turnSpeed: 0.0025,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 11,
                itemAID: 27,
            },
            {
                age: 8,
                group: this.groups[3],
                name: "power mill",
                desc: "generates more gold over time",
                req: ["wood", 100, "stone", 50],
                health: 800,
                pps: 2,
                turnSpeed: 0.005,
                spritePadding: 25,
                iconLineMult: 12,
                scale: 47,
                holdOffset: 20,
                placeOffset: 5,
                itemID: 12,
                itemAID: 28,
            },
            {
                age: 5,
                group: this.groups[4],
                type: 2,
                name: "mine",
                desc: "allows you to mine stone",
                req: ["wood", 20, "stone", 100],
                iconLineMult: 12,
                scale: 65,
                holdOffset: 20,
                placeOffset: 0,
                itemID: 13,
                itemAID: 29,
            },
            {
                age: 5,
                group: this.groups[11],
                type: 0,
                name: "sapling",
                desc: "allows you to farm wood",
                req: ["wood", 150],
                iconLineMult: 12,
                colDiv: 0.5,
                scale: 110,
                holdOffset: 50,
                placeOffset: -15,
                itemID: 14,
                itemAID: 30,
            },
            {
                age: 4,
                group: this.groups[5],
                name: "pit trap",
                desc: "pit that traps enemies if they walk over it",
                req: ["wood", 30, "stone", 30],
                trap: true,
                ignoreCollision: true,
                hideFromEnemy: true,
                health: 500,
                colDiv: 0.2,
                scale: 50,
                holdOffset: 20,
                placeOffset: -5,
                alpha: 0.6,
                itemID: 15,
                itemAID: 31,
            },
            {
                age: 4,
                group: this.groups[6],
                name: "boost pad",
                desc: "provides boost when stepped on",
                req: ["stone", 20, "wood", 5],
                ignoreCollision: true,
                boostSpeed: 1.5,
                health: 150,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 16,
                itemAID: 32,
            },
            {
                age: 7,
                group: this.groups[7],
                doUpdate: true,
                name: "turret",
                desc: "defensive structure that shoots at enemies",
                req: ["wood", 200, "stone", 150],
                health: 800,
                projectile: 1,
                shootRange: 700,
                shootRate: 2200,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 17,
                itemAID: 33,
            },
            {
                age: 7,
                group: this.groups[8],
                name: "platform",
                desc: "platform to shoot over walls and cross over water",
                req: ["wood", 20],
                ignoreCollision: true,
                zIndex: 1,
                health: 300,
                scale: 43,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 18,
                itemAID: 34,
            },
            {
                age: 7,
                group: this.groups[9],
                name: "healing pad",
                desc: "standing on it will slowly heal you",
                req: ["wood", 30, "food", 10],
                ignoreCollision: true,
                healCol: 15,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 19,
                itemAID: 35,
            },
            {
                age: 9,
                group: this.groups[10],
                name: "spawn pad",
                desc: "you will spawn here when you die but it will dissapear",
                req: ["wood", 100, "stone", 100],
                health: 400,
                ignoreCollision: true,
                spawnPoint: true,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 20,
                itemAID: 36,
            },
            {
                age: 7,
                group: this.groups[12],
                name: "blocker",
                desc: "blocks building in radius",
                req: ["wood", 30, "stone", 25],
                ignoreCollision: true,
                blocker: 300,
                health: 400,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 21,
                itemAID: 37,
            },
            {
                age: 7,
                group: this.groups[13],
                name: "teleporter",
                desc: "teleports you to a random point on the map",
                req: ["wood", 60, "stone", 60],
                ignoreCollision: true,
                teleport: true,
                health: 200,
                colDiv: 0.7,
                scale: 45,
                holdOffset: 20,
                placeOffset: -5,
                itemID: 22,
                itemAID: 38,
            },
        ];

        // CHECK ITEM ID:
        this.checkItem = {
            index: function (id, myItems) {
                return [0, 1, 2].includes(id)
                    ? 0
                : [3, 4, 5].includes(id)
                    ? 1
                : [6, 7, 8, 9].includes(id)
                    ? 2
                : [10, 11, 12].includes(id)
                    ? 3
                : [13, 14].includes(id)
                    ? 5
                : [15, 16].includes(id)
                    ? 4
                : [17, 18, 19, 21, 22].includes(id)
                    ? [13, 14].includes(myItems)
                    ? 6
                : 5
                : id == 20
                    ? [13, 14].includes(myItems)
                    ? 7
                : 6
                : undefined;
            },
        };

        // ASSIGN IDS:
        for (let i = 0; i < this.list.length; ++i) {
            this.list[i].id = i;
            if (this.list[i].pre) this.list[i].pre = i - this.list[i].pre;
        }

        // TROLOLOLOL:
        if (typeof window !== "undefined") {
            function shuffle(a) {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }
            //shuffle(this.list);
        }
    }
}
class Objectmanager {
    constructor(GameObject, objects, UWUTILS, cfg, players, server) {
        let mathFloor = Math.floor,
            mathABS = Math.abs,
            mathCOS = Math.cos,
            mathSIN = Math.sin,
            mathPOW = Math.pow,
            mathSQRT = Math.sqrt;

        this.disableObj = function (obj) {
            obj.active = false;
        };
        this.hitObj = [];

        let tmpObj;
        this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
            tmpObj = findObjectBySid(sid);
            if (!tmpObj) {
                tmpObj = new GameObject(sid);
                gameObjects.push(tmpObj);
                tmpObj.placedTick = game.tick;
            }
            if (setSID) {
                tmpObj.sid = sid;
            }
            tmpObj.init(x, y, dir, s, type, data, owner);
        };

        // DISABLE BY SID:
        this.disableBySid = function (sid) {
            let find = findObjectBySid(sid);
            if (find) {
                this.disableObj(find);
            }
        };

        // REMOVE ALL FROM PLAYER:
        this.removeAllItems = function (sid, server) {
            let asdks = gameObjects.filter2(
                (tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid
            );
            for (let i = 0; i < asdks.length; i++) {
                this.disableObj(asdks[i]);
            }
        };

        // CHECK IF PLACABLE:
        this.checkItemLocation = function(x, y, s, sM, indx, ignoreWater, placer) {
            let cantPlace = liztobj.find2((tmp) => tmp.active && hypot(x - tmp.x, y - tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return true;
        };
        this.checkItemLocation3 = function(e, n, I, r, S, a, outplace, obj) {
            for (var h = 0; h < liztobj.length; ++h) {
                const asd = liztobj[h];
                var u = asd.blocker ? asd.blocker : asd.getScale(r, asd.isItem);
                let distance = hypot(e - asd.x, n - asd.y) < I + u
                if(distance){
                    obj.overlap.push(asd)
                    obj.preplacer.push(asd.assumeBreak)
                    obj.sids.push(asd.sid)
                }
                //  if (nearObjects[h].active && distance && !(nearObjects[h].assumeBreak&&outplace)) return !1
            }
            if(obj.preplacer.includes(false)) return !1;
            return !(!a && 18 != S && n >= config.mapScale / 2 - config.riverWidth / 2 && n <= config.mapScale / 2 + config.riverWidth /2)
        }
        this.checkCanManualPlace = function (x, y, s, sM, indx, ignoreWater, placer) {
            let cantPlace = liztobj.find2((tmp) => !tmp.aboutToBreak && tmp.active && UWUTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) {
                return false;
            }
            if (
                !ignoreWater &&
                indx != 18 &&
                y >= cfg.mapScale / 2 - cfg.riverWidth / 2 &&
                y <= cfg.mapScale / 2 + cfg.riverWidth / 2
            )
                return false;
            return true;
        };
        this.checkBlockingItem = function (x, y, s, sM, indx, ignoreWater, placer) {
            return liztobj.find2((tmp) => tmp.active && UWUTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem))
                               );
        };
        this.checkItemLocationPrePlace = function (x, y, s, sM, indx, ignoreWater, placer, objToIgnore) {
            let cantPlace = liztobj.find2((tmp) => tmp.sid != objToIgnore.sid && tmp.active && UWUTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= cfg.mapScale / 2 - cfg.riverWidth / 2 && y <= cfg.mapScale / 2 + cfg.riverWidth / 2) return false;
            return true;
        };
        this.checkCollision2 = function(e, t, n) {
            n = n || 1;
            var l = e.x2 - t.x,
                h = e.y2 - t.y,
                u = 35 + (t.realScale ?t.realScale:t.scale);
            if (Math.abs(l) <= u || Math.abs(h) <= u) {
                u = 35 + (t.getScale ? t.getScale() : t.scale);
                var f = Math.sqrt(l * l + h * h) - u;
                if (f <= 0) {
                    return t.zIndex > t.zIndex && (t.zIndex = t.zIndex),!0
                }
            }
            return !1
        }
    }
}
class Projectile {
    constructor(players, ais, objectManager, items, config, UWUTILS, server) {
        // INIT:
        this.init = function (indx, x, y, dir, spd, dmg, rng, scl, owner) {
            this.active = true;
            this.tickActive = true;
            this.indx = indx;
            this.x = x;
            this.y = y;
            this.x2 = x;
            this.y2 = y;
            this.dir = dir;
            this.skipMov = true;
            this.speed = spd;
            this.dmg = dmg;
            this.scale = scl;
            this.range = rng;
            this.r2 = rng;
            this.owner = owner;
        };

        // UPDATE:
        this.update = function (dlta) {
            if (this.active) {
                const tmpSpeed = this.speed * dlta;
                if (!this.skipMov) {
                    this.x += tmpSpeed * Math.cos(this.dir);
                    this.y += tmpSpeed * Math.sin(this.dir);
                    this.range -= tmpSpeed;
                    if (this.range <= 0) {
                        this.x += this.range * Math.cos(this.dir);
                        this.y += this.range * Math.sin(this.dir);
                        this.range = 0;
                        this.active = false;
                    }
                } else {
                    this.skipMov = false;
                }
            }
        };
        this.tickUpdate = function (dlta) {
            if (this.tickActive) {
                let tmpSpeed = this.speed * dlta;
                if (!this.skipMov) {
                    this.x2 += tmpSpeed * Math.cos(this.dir);
                    this.y2 += tmpSpeed * Math.sin(this.dir);
                    this.r2 -= tmpSpeed;
                    if (this.r2 <= 0) {
                        this.x2 += this.r2 * Math.cos(this.dir);
                        this.y2 += this.r2 * Math.sin(this.dir);
                        tmpSpeed = 1;
                        this.r2 = 0;
                        this.tickActive = false;
                    }
                } else {
                    this.skipMov = false;
                }
            }
        };
    }
}
class Store {
    constructor() {
        // STORE HATS:
        this.hats = [
            {
                id: 45,
                name: "Shame!",
                dontSell: true,
                price: 0,
                scale: 120,
                desc: "hacks are for winners",
            },
            {
                id: 51,
                name: "Moo Cap",
                price: 0,
                scale: 120,
                desc: "coolest mooer around",
            },
            {
                id: 50,
                name: "Apple Cap",
                price: 0,
                scale: 120,
                desc: "apple farms remembers",
            },
            {
                id: 28,
                name: "Moo Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 29,
                name: "Pig Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 30,
                name: "Fluff Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 36,
                name: "Pandou Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 37,
                name: "Bear Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 38,
                name: "Monkey Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 44,
                name: "Polar Head",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 35,
                name: "Fez Hat",
                price: 0,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 42,
                name: "Enigma Hat",
                price: 0,
                scale: 120,
                desc: "join the enigma army",
            },
            {
                id: 43,
                name: "Blitz Hat",
                price: 0,
                scale: 120,
                desc: "hey everybody i'm blitz",
            },
            {
                id: 49,
                name: "Bob XIII Hat",
                price: 0,
                scale: 120,
                desc: "like and subscribe",
            },
            {
                id: 57,
                name: "Pumpkin",
                price: 50,
                scale: 120,
                desc: "Spooooky",
            },
            {
                id: 8,
                name: "Bummle Hat",
                price: 100,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 2,
                name: "Straw Hat",
                price: 500,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 15,
                name: "Winter Cap",
                price: 600,
                scale: 120,
                desc: "allows you to move at normal speed in snow",
                coldM: 1,
            },
            {
                id: 5,
                name: "Cowboy Hat",
                price: 1000,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 4,
                name: "Ranger Hat",
                price: 2000,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 18,
                name: "Explorer Hat",
                price: 2000,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 31,
                name: "Flipper Hat",
                price: 2500,
                scale: 120,
                desc: "have more control while in water",
                watrImm: true,
            },
            {
                id: 1,
                name: "Marksman Cap",
                price: 3000,
                scale: 120,
                desc: "increases arrow speed and range",
                aMlt: 1.3,
            },
            {
                id: 10,
                name: "Bush Gear",
                price: 3000,
                scale: 160,
                desc: "allows you to disguise yourself as a bush",
            },
            {
                id: 48,
                name: "Halo",
                price: 3000,
                scale: 120,
                desc: "no effect",
            },
            {
                id: 6,
                name: "Soldier Helmet",
                price: 4000,
                scale: 120,
                desc: "reduces damage taken but slows movement",
                spdMult: 0.94,
                dmgMult: 0.75,
            },
            {
                id: 23,
                name: "Anti Venom Gear",
                price: 4000,
                scale: 120,
                desc: "makes you immune to poison",
                poisonRes: 1,
            },
            {
                id: 13,
                name: "Medic Gear",
                price: 5000,
                scale: 110,
                desc: "slowly regenerates health over time",
                healthRegen: 3,
            },
            {
                id: 9,
                name: "Miners Helmet",
                price: 5000,
                scale: 120,
                desc: "earn 1 extra gold per resource",
                extraGold: 1,
            },
            {
                id: 32,
                name: "Musketeer Hat",
                price: 5000,
                scale: 120,
                desc: "reduces cost of projectiles",
                projCost: 0.5,
            },
            {
                id: 7,
                name: "Bull Helmet",
                price: 6000,
                scale: 120,
                desc: "increases damage done but drains health",
                healthRegen: -5,
                dmgMultO: 1.5,
                spdMult: 0.96,
            },
            {
                id: 22,
                name: "Emp Helmet",
                price: 6000,
                scale: 120,
                desc: "turrets won't attack but you move slower",
                antiTurret: 1,
                spdMult: 0.7,
            },
            {
                id: 12,
                name: "Booster Hat",
                price: 6000,
                scale: 120,
                desc: "increases your movement speed",
                spdMult: 1.16,
            },
            {
                id: 26,
                name: "Barbarian Armor",
                price: 8000,
                scale: 120,
                desc: "knocks back enemies that attack you",
                dmgK: 0.6,
            },
            {
                id: 21,
                name: "Plague Mask",
                price: 10000,
                scale: 120,
                desc: "melee attacks deal poison damage",
                poisonDmg: 5,
                poisonTime: 6,
            },
            {
                id: 46,
                name: "Bull Mask",
                price: 10000,
                scale: 120,
                desc: "bulls won't target you unless you attack them",
                bullRepel: 1,
            },
            {
                id: 14,
                name: "Windmill Hat",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "generates points while worn",
                pps: 1.5,
            },
            {
                id: 11,
                name: "Spike Gear",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "deal damage to players that damage you",
                dmg: 0.45,
            },
            {
                id: 53,
                name: "Turret Gear",
                topSprite: true,
                price: 10000,
                scale: 120,
                desc: "you become a walking turret",
                turret: {
                    proj: 1,
                    range: 700,
                    rate: 2500,
                },
                spdMult: 0.7,
            },
            {
                id: 20,
                name: "Samurai Armor",
                price: 12000,
                scale: 120,
                desc: "increased attack speed and fire rate",
                atkSpd: 0.78,
            },
            {
                id: 58,
                name: "Dark Knight",
                price: 12000,
                scale: 120,
                desc: "restores health when you deal damage",
                healD: 0.4,
            },
            {
                id: 27,
                name: "Scavenger Gear",
                price: 15000,
                scale: 120,
                desc: "earn double points for each kill",
                kScrM: 2,
            },
            {
                id: 40,
                name: "Tank Gear",
                price: 15000,
                scale: 120,
                desc: "increased damage to buildings but slower movement",
                spdMult: 0.3,
                bDmg: 3.3,
            },
            {
                id: 52,
                name: "Thief Gear",
                price: 15000,
                scale: 120,
                desc: "steal half of a players gold when you kill them",
                goldSteal: 0.5,
            },
            {
                id: 55,
                name: "Bloodthirster",
                price: 20000,
                scale: 120,
                desc: "Restore Health when dealing damage. And increased damage",
                healD: 0.25,
                dmgMultO: 1.2,
            },
            {
                id: 56,
                name: "Assassin Gear",
                price: 20000,
                scale: 120,
                desc: "Go invisible when not moving. Can't eat. Increased speed",
                noEat: true,
                spdMult: 1.1,
                invisTimer: 1000,
            },
        ];

        // STORE ACCESSORIES:
        this.accessories = [
            {
                id: 12,
                name: "Snowball",
                price: 1000,
                scale: 105,
                xOff: 18,
                desc: "no effect",
            },
            {
                id: 9,
                name: "Tree Cape",
                price: 1000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 10,
                name: "Stone Cape",
                price: 1000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 3,
                name: "Cookie Cape",
                price: 1500,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 8,
                name: "Cow Cape",
                price: 2000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 11,
                name: "Monkey Tail",
                price: 2000,
                scale: 97,
                xOff: 25,
                desc: "Super speed but reduced damage",
                spdMult: 1.35,
                dmgMultO: 0.2,
            },
            {
                id: 17,
                name: "Apple Basket",
                price: 3000,
                scale: 80,
                xOff: 12,
                desc: "slowly regenerates health over time",
                healthRegen: 1,
            },
            {
                id: 6,
                name: "Winter Cape",
                price: 3000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 4,
                name: "Skull Cape",
                price: 4000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 5,
                name: "Dash Cape",
                price: 5000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 2,
                name: "Dragon Cape",
                price: 6000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 1,
                name: "Super Cape",
                price: 8000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 7,
                name: "Troll Cape",
                price: 8000,
                scale: 90,
                desc: "no effect",
            },
            {
                id: 14,
                name: "Thorns",
                price: 10000,
                scale: 115,
                xOff: 20,
                desc: "no effect",
            },
            {
                id: 15,
                name: "Blockades",
                price: 10000,
                scale: 95,
                xOff: 15,
                desc: "no effect",
            },
            {
                id: 20,
                name: "Devils Tail",
                price: 10000,
                scale: 95,
                xOff: 20,
                desc: "no effect",
            },
            {
                id: 16,
                name: "Sawblade",
                price: 12000,
                scale: 90,
                spin: true,
                xOff: 0,
                desc: "deal damage to players that damage you",
                dmg: 0.15,
            },
            {
                id: 13,
                name: "Angel Wings",
                price: 15000,
                scale: 138,
                xOff: 22,
                desc: "slowly regenerates health over time",
                healthRegen: 3,
            },
            {
                id: 19,
                name: "Shadow Wings",
                price: 15000,
                scale: 138,
                xOff: 22,
                desc: "increased movement speed",
                spdMult: 1.1,
            },
            {
                id: 18,
                name: "Blood Wings",
                price: 20000,
                scale: 178,
                xOff: 26,
                desc: "restores health when you deal damage",
                healD: 0.2,
            },
            {
                id: 21,
                name: "Corrupt X Wings",
                price: 20000,
                scale: 178,
                xOff: 26,
                desc: "deal damage to players that damage you",
                dmg: 0.25,
            },
        ];
    }
}
function notif(title, description) {
    let mouseCoord = player;
    let m = textManager;
    if (typeof title !== "undefined") {
        m.showText(mouseCoord.x, mouseCoord.y, 40, .18, 500, title, "pink");
    }
    if (typeof description !== "undefined") {
        m.showText(mouseCoord.x, mouseCoord.y + 40, 30, .18, 500, description, "pink");
    }
}
class ProjectileManager {
    constructor(
    Projectile,
     projectiles,
     players,
     ais,
     objectManager,
     items,
     config,
     UWUTILS,
     server
    ) {
        this.projectiles = projectiles;
        this.addProjectile = function (
        x,
         y,
         dir,
         range,
         speed,
         indx,
         owner,
         ignoreObj,
         layer,
         inWindow
        ) {
            let tmpData = items.projectiles[indx];
            let tmpProj;
            for (let i = 0; i < projectiles.length; ++i) {
                if (!projectiles[i].active) {
                    tmpProj = projectiles[i];
                    break;
                }
            }
            if (!tmpProj) {
                tmpProj = new Projectile(
                    players,
                    ais,
                    objectManager,
                    items,
                    config,
                    UWUTILS,
                    server
                );
                tmpProj.sid = projectiles.length;
                this.projectiles.push(tmpProj);
            }
            tmpProj.init(
                indx,
                x,
                y,
                dir,
                speed,
                tmpData.dmg,
                range,
                tmpData.scale,
                owner
            );
            tmpProj.ignoreObj = ignoreObj;
            tmpProj.layer = layer || tmpData.layer;
            tmpProj.inWindow = inWindow;
            tmpProj.src = tmpData.src;
            return tmpProj;
        };
    }
}
class AiManager {
    // AI MANAGER:
    constructor(
    ais,
     AI,
     players,
     items,
     objectManager,
     config,
     UWUTILS,
     scoreCallback,
     server
    ) {
        // AI TYPES:
        this.aiTypes = [
            {
                id: 0,
                src: "cow_1",
                killScore: 150,
                health: 500,
                weightM: 0.8,
                speed: 0.00095,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 50],
            },
            {
                id: 1,
                src: "pig_1",
                killScore: 200,
                health: 800,
                weightM: 0.6,
                speed: 0.00085,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 80],
            },
            {
                id: 2,
                name: "Bull",
                src: "bull_2",
                hostile: true,
                dmg: 20,
                killScore: 1000,
                health: 1800,
                weightM: 0.5,
                speed: 0.00094,
                turnSpeed: 0.00074,
                scale: 78,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 100],
            },
            {
                id: 3,
                name: "Bully",
                src: "bull_1",
                hostile: true,
                dmg: 20,
                killScore: 2000,
                health: 2800,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.0008,
                scale: 90,
                viewRange: 900,
                chargePlayer: true,
                drop: ["food", 400],
            },
            {
                id: 4,
                name: "Wolf",
                src: "wolf_1",
                hostile: true,
                dmg: 8,
                killScore: 500,
                health: 300,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.002,
                scale: 84,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 200],
            },
            {
                id: 5,
                name: "Quack",
                src: "chicken_1",
                dmg: 8,
                killScore: 2000,
                noTrap: true,
                health: 300,
                weightM: 0.2,
                speed: 0.0018,
                turnSpeed: 0.006,
                scale: 70,
                drop: ["food", 100],
            },
            {
                id: 6,
                name: "MOOSTAFA",
                nameScale: 50,
                src: "enemy",
                hostile: true,
                dontRun: true,
                fixedSpawn: true,
                spawnDelay: 60000,
                noTrap: true,
                colDmg: 100,
                dmg: 40,
                killScore: 8000,
                health: 18000,
                weightM: 0.4,
                speed: 0.0007,
                turnSpeed: 0.01,
                scale: 80,
                spriteMlt: 1.8,
                leapForce: 0.9,
                viewRange: 1000,
                hitRange: 210,
                hitDelay: 1000,
                chargePlayer: true,
                drop: ["food", 100],
            },
            {
                id: 7,
                name: "Treasure",
                hostile: true,
                nameScale: 35,
                src: "crate_1",
                fixedSpawn: true,
                spawnDelay: 120000,
                colDmg: 200,
                killScore: 5000,
                health: 20000,
                weightM: 0.1,
                speed: 0.0,
                turnSpeed: 0.0,
                scale: 70,
                spriteMlt: 1.0,
            },
            {
                id: 8,
                name: "MOOFIE",
                src: "wolf_2",
                hostile: true,
                fixedSpawn: true,
                dontRun: true,
                hitScare: 4,
                spawnDelay: 30000,
                noTrap: true,
                nameScale: 35,
                dmg: 10,
                colDmg: 100,
                killScore: 3000,
                health: 7000,
                weightM: 0.45,
                speed: 0.0015,
                turnSpeed: 0.002,
                scale: 90,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 1000],
            },
            {
                id: 9,
                name: "ℵ MOOFIE",
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
                weightM: 0.45,
                speed: 0.0015,
                turnSpeed: 0.0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 3e3],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
            {
                id: 10,
                name: "ℵ Wolf",
                src: "wolf_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 3e4,
                dmg: 10,
                killScore: 700,
                health: 500,
                weightM: 0.45,
                speed: 0.00115,
                turnSpeed: 0.0025,
                scale: 88,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 400],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
            {
                id: 11,
                name: "ℵ Bully",
                src: "bull_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                dmg: 20,
                killScore: 5e3,
                health: 5e3,
                spawnDelay: 1e5,
                weightM: 0.45,
                speed: 0.00115,
                turnSpeed: 0.0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 800],
                minSpawnRange: 0.85,
                maxSpawnRange: 0.9,
            },
        ];

        // SPAWN AI:
        this.spawn = function (x, y, dir, index) {
            let tmpObj = ais.find2((tmp) => !tmp.active);
            if (!tmpObj) {
                tmpObj = new AI(
                    ais.length,
                    objectManager,
                    players,
                    items,
                    UWUTILS,
                    config,
                    scoreCallback,
                    server
                );
                ais.push(tmpObj);
            }
            tmpObj.init(x, y, dir, index, this.aiTypes[index]);
            return tmpObj;
        };
    }
}
class AI {
    constructor(
    sid,
     objectManager,
     players,
     items,
     UWUTILS,
     config,
     scoreCallback,
     server
    ) {
        this.lowHealth = false;
        this.sid = sid;
        this.isAI = true;
        this.nameIndex = UWUTILS.randInt(0, config.cowNames.length - 1);

        // INIT:
        this.init = function (x, y, dir, index, data) {
            this.x = x;
            this.y = y;
            this.displayText = data.name;
            this.startX = data.fixedSpawn ? x : null;
            this.startY = data.fixedSpawn ? y : null;
            this.xVel = 0;
            this.yVel = 0;
            this.lowHealth = false;
            this.zIndex = 0;
            this.dir = dir;
            this.dirPlus = 0;
            this.index = index;
            this.src = data.src;
            if (data.name) this.name = data.name;
            this.weightM = data.weightM;
            this.speed = data.speed;
            this.killScore = data.killScore;
            this.turnSpeed = data.turnSpeed;
            this.scale = data.scale;
            this.maxHealth = data.health;
            this.leapForce = data.leapForce;
            this.health = this.maxHealth;
            this.chargePlayer = data.chargePlayer;
            this.viewRange = data.viewRange;
            this.drop = data.drop;
            this.dmg = data.dmg;
            this.hostile = data.hostile;
            this.dontRun = data.dontRun;
            this.hitRange = data.hitRange;
            this.hitDelay = data.hitDelay;
            this.hitScare = data.hitScare;
            this.spriteMlt = data.spriteMlt;
            this.nameScale = data.nameScale;
            this.colDmg = data.colDmg;
            this.noTrap = data.noTrap;
            this.spawnDelay = data.spawnDelay;
            this.hitWait = 0;
            this.waitCount = 1000;
            this.moveCount = 0;
            this.targetDir = 0;
            this.active = true;
            this.alive = true;
            this.runFrom = null;
            this.chargeTarget = null;
            this.dmgOverTime = {};
        };

        let tmpRatio = 0;
        let animIndex = 0;
        this.animate = function (dlta) {
            if (this.animTime > 0) {
                this.animTime -= dlta;
                if (this.animTime <= 0) {
                    this.animTime = 0;
                    this.dirPlus = 0;
                    tmpRatio = 0;
                    animIndex = 0;
                } else {
                    if (animIndex == 0) {
                        tmpRatio += dlta / (this.animSpeed * config.hitReturnRatio);
                        this.dirPlus = UWUTILS.lerp(
                            0,
                            this.targetAngle,
                            Math.min(1, tmpRatio)
                        );
                        if (tmpRatio >= 1) {
                            tmpRatio = 1;
                            animIndex = 1;
                        }
                    } else {
                        tmpRatio -= dlta / (this.animSpeed * (1 - config.hitReturnRatio));
                        this.dirPlus = UWUTILS.lerp(
                            0,
                            this.targetAngle,
                            Math.max(0, tmpRatio)
                        );
                    }
                }
            }
        };

        // ANIMATION:
        this.startAnim = function () {
            this.animTime = this.animSpeed = 600;
            this.targetAngle = Math.PI * 0.8;
            tmpRatio = 0;
            animIndex = 0;
        };
    }
}
class addCh {
    constructor(x, y, chat, tmpObj) {
        this.x = x;
        this.y = y;
        this.alpha = 0;
        this.active = true;
        this.alive = false;
        this.chat = chat;
        this.owner = tmpObj;
    }
}
class DeadPlayer {
    constructor(
    x,
     y,
     dir,
     buildIndex,
     weaponIndex,
     weaponVariant,
     skinColor,
     scale,
     name
    ) {
        this.x = x;
        this.y = y;
        this.lastDir = dir;
        this.dir = dir + Math.PI;
        this.buildIndex = buildIndex;
        this.weaponIndex = weaponIndex;
        this.weaponVariant = weaponVariant;
        this.skinColor = skinColor;
        this.scale = scale;
        this.visScale = 0;
        this.name = name;
        this.alpha = 1;
        this.active = true;
        this.animate = function (dlta) {
            let d2 = UWUTILS.getAngleDist(this.lastDir, this.dir);
            if (d2 > 0.01) {
                this.dir += d2 / 20;
            } else {
                this.dir = this.lastDir;
            }
            if (this.visScale < this.scale) {
                this.visScale += dlta / (this.scale / 2);
                if (this.visScale >= this.scale) {
                    this.visScale = this.scale;
                }
            }
            this.alpha -= dlta / 30000;
            if (this.alpha <= 0) {
                this.alpha = 0;
                this.active = false;
            }
        };
    }
}
class Player {
    constructor(
    id,
     sid,
     config,
     UWUTILS,
     projectileManager,
     objectManager,
     players,
     ais,
     items,
     hats,
     accessories,
     server,
     scoreCallback,
     iconCallback
    ) {
        this.faultyBullTick = undefined;
        this.id = id;
        this.hacking = false;
        this.lastReloadedTick = 0;
        this.antiInsta = false;
        this.hackerPoints = {
            autoheal: -1,
            hatChanger: -1,
            sold: false,
            tank: false,
            normalHats: false,
            autoAim: -1,
        };
        this.guessTime = null;
        this.macroPoints = {
            qHold: -1,
            hatMacro: -1,
            tank: false,
        };
        this.hps = 0;
        this.boosted = false;
        this.shotAnti = false;
        this.happymod = false;
        this.turretGear = false;
        this.oneTick = 0;
        this.lastSkinIndexes = [];
        this.sid = sid;
        this.tmpScore = 0;
        this.team = null;
        this.latestSkin = 0;
        this.touchSpike = false;
        this.trapClear = false;
        this.oldSkinIndex = 0;
        this.skinIndex = 0;
        this.latestTail = 0;
        this.oldTailIndex = 0;
        this.lastAttackers = [];
        this.tailIndex = 0;
        this.cheesed = false;
        this.hitTime = 0;
        this.cheeze = false;
        this.lastHit = 0;
        this.tails = {};
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].price <= 0) this.tails[accessories[i].id] = 1;
        }
        this.skins = {};
        this.ownedSkins = {};
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].price <= 0) this.skins[hats[i].id] = 1;
        }
        this.timeSpentNearVolcano = 0;
        this.points = 0;
        this.dt = 0;
        this.hidden = false;
        this.itemCounts = {};
        this.isPlayer = true;
        this.pps = 0;
        this.moveDir = undefined;
        this.skinRot = 0;
        this.lastPing = 0;
        this.iconIndex = 0;
        this.skinColor = 0;
        this.dist2 = 0;
        this.placed = 0;
        this.avgPinge = [];
        this.cheese = false;
        this.aim2 = 0;
        this.usingWhiteout = false;
        this.maxSpeed = 1;
        this.chat = {
            message: null,
            count: 0,
        };
        this.backupNobull = true;
        this.circle = false;
        this.cAngle = 0;
        this.healCol = 0;
        // SPAWN:
        this.spawn = function (moofoll) {
            if (moofoll) {
                this.hammerIndex = 0;
                this.hammerReload = 0;
                this.hammer = items.weapons[0];
            }
            this.lastSkinIndexes = [];
            this.dot = 0;
            this.hasBoost = false;
            this.num = 0;
            this.attacked = false;
            this.cheesed = false;
            this.timeDamaged = 0;
            this.checkSpike = 0;
            this.timeHealed = 0;
            this.pinge = 0;
            this.cheese = false;
            this.lastShameCount = 0;
            this.moveTime = 0;
            this.death = false;
            this.spinDir = 0;
            this.cheeze = false;
            this.sync = false;
            this.antiBull = 0;
            this.bullTimer = 0;
            this.poisonTimer = 0;
            this.active = true;
            this.alive = true;
            this.instaPlaced = 0;
            this.lockMove = false;
            this.lastDamages = [0, 0];
            this.lockDir = false;
            this.minimapCounter = 0;
            this.chatCountdown = 0;
            this.movDir = undefined
            this.shameCount = 0;
            this.shameTimer = 0;
            this.sentTo = {};
            this.gathering = 0;
            this.gatherIndex = 0;
            this.shooting = {};
            this.opacity = 1;
            this.shootIndex = 9;
            this.autoGather = false;
            this.animTime = 0;
            this.animSpeed = 0;
            this.circleRad = 200;
            this.circleRadSpd = 0.1;
            this.sD = performance.now();
            this.dmgOverTime = {};
            this.noMovTimer = 0;
            this.maxXP = 300;
            this.XP = 0;
            this.shot = false;
            this.x = 0;
            this.y = 0;
            this.oldXY = {
                x: 0,
                y: 0,
            };
            this.zIndex = 0;
            this.xVel = 0;
            this.yVel = 0;
            this.slowMult = 1;
            this.dir = 0;
            this.dirPlus = 0;
            this.targetDir = 0;
            this.targetAngle = 0;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.oldHealth = this.maxHealth;
            this.damaged = 0;
            this.scale = config.playerScale;
            this.speed = config.playerSpeed;
            this.resetMoveDir();
            this.resetResources(moofoll);
            this.items = [0, 3, 6, 10];
            this.shootCount = 0;
            this.weaponXP = [];
            this.turretReload = 0;
            this.primaryReload = 0;
            this.secondaryReload = 0;
            this.bowThreat = {9: 0, 12: 0, 15: 0};
            this.damageThreat = 0;
            this.inTrap = false;
            this.canEmpAnti = false;
            this.empAnti = false;
            this.poisonTick = 0;
            this.qHeld = false;
            this.bullTick = 0;
            this.antiTimer = 2;
        };
        this.reset = function () {
            this.lastSkinIndexes = [];
            this.dot = 0;
            this.hasBoost = false;
            this.num = 0;
            this.attacked = false;
            this.cheesed = false;
            this.timeDamaged = 0;
            this.checkSpike = 0;
            this.timeHealed = 0;
            this.pinge = 0;
            this.cheese = false;
            this.lastShameCount = 0;
            this.moveTime = 0;
            this.death = false;
            this.spinDir = 0;
            this.cheeze = false;
            this.sync = false;
            this.antiBull = 0;
            this.bullTimer = 0;
            this.poisonTimer = 0;
            this.visible = false;
            this.active = false;
            this.alive = false;
            this.instaPlaced = 0;
            this.lockMove = false;
            this.lastDamages = [];
            this.lockDir = false;
            this.minimapCounter = 0;
            this.chatCountdown = 0;
            this.movDir = undefined
            this.shameCount = 0;
            this.shameTimer = 0;
            this.sentTo = {};
            this.gathering = 0;
            this.gatherIndex = 0;
            this.shooting = {};
            this.opacity = 1;
            this.shootIndex = 9;
            this.autoGather = false;
            this.animTime = 0;
            this.animSpeed = 0;
            this.circleRad = 200;
            this.circleRadSpd = 0.1;
            this.mouseState = 0;
            this.buildIndex = -1;
            this.weaponIndex = 0;
            this.weaponCode = 0;
            this.weaponVariant = 0;
            this.primaryIndex = 0;
            this.secondaryIndex = undefined;
            this.dmgOverTime = {};
            this.noMovTimer = 0;
            this.maxXP = 300;
            this.XP = 0;
            this.shot = false;
            this.age = 1;
            this.kills = 0;
            this.upgrAge = 2;
            this.upgradePoints = 0;
            this.x = 0;
            this.y = 0;
            this.oldXY = {
                x: 0,
                y: 0,
            };
            this.zIndex = 0;
            this.xVel = 0;
            this.yVel = 0;
            this.slowMult = 1;
            this.dir = 0;
            this.dirPlus = 0;
            this.targetDir = 0;
            this.targetAngle = 0;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.oldHealth = this.maxHealth;
            this.damaged = 0;
            this.scale = 35;
            this.speed = .0016;
            this.resetMoveDir();
            this.items = [0, 3, 6, 10];
            this.shootCount = 0;
            this.weaponXP = [];
            this.turretReload = 0;
            this.primaryReload = 0;
            this.secondaryReload = 0;
            this.bowThreat = {9: 0, 12: 0, 15: 0};
            this.damageThreat = 0;
            this.inTrap = false;
            this.canEmpAnti = false;
            this.empAnti = false;
            this.poisonTick = 0;
            this.qHeld = false;
            this.bullTick = 0;
            this.antiTimer = 2;
        };
        this.updateListTime = function() {
            this.listTime = toTime(Math.floor((game.tick - this.guessTime) / 9));
            if (!this.listTime) return;
            this.listElement.textContent = this.logDetails + (this.listTime == "0s" ? "now" : (this.listTime + " ago"));
        }
        // RESET MOVE DIR:
        this.resetMoveDir = function () {
            this.moveDir = undefined;
        };

        // RESET RESOURCES:
        this.resetResources = function (moofoll) {
            for (let i = 0; i < config.resourceTypes.length; ++i) {
                this[config.resourceTypes[i]] = moofoll ? 100 : 0;
            }
        };

        // ADD ITEM:
        this.getItemType = function (id) {
            let findindx = this.items.findIndex((ids) => ids == id);
            if (findindx != -1) {
                return findindx;
            } else {
                return items.checkItem.index(id, this.items);
            }
        };

        // SET DATA:
        this.setData = function (data) {
            if(player && data[1] != player.sid && data[2]!=this.name&&this.name!=undefined){addMenuChText(null, `${this.name}[${this.sid}] has changed name to ${data[2]}`,'#f5b889ff')}
            this.id = data[0];
            this.sid = data[1];
            this.name = data[2];
            this.x = data[3];
            this.y = data[4];
            this.dir = data[5];
            this.health = data[6];
            this.maxHealth = data[7];
            this.scale = data[8];
            this.skinColor = data[9];
            this.displayText = `${this.name} [${this.sid}]`
        };

        // UPDATE POISON TICK:
        this.updateTimer = function () {
            this.poisonTimer -= 1;
            if (this.poisonTimer <= 0) {
                this.poisonTick = game.tick;
                this.dot = Math.max(0, this.dot - 1);
                this.poisonTimer = config.serverUpdateRate;
            }
        };

        this.changeHealth = function (amount, doer) {
            this.health += amount;
            return this.health <= 100;
        };

        this.update = function (updateSpeed) {
            if (this.sid == playerSID && !updateSpeed) {
                this.cAngle += 0.1;
            }
            if (this.active) {
                // MOVE:
                let gear = {
                    skin: findID(hats, this.skinIndex),
                    tail: findID(accessories, this.tailIndex),
                };
                let spdMult =
                    (this.buildIndex >= 0 ? 0.5 : 1) *
                    (items.weapons[this.weaponIndex].spdMult || 1) *
                    (gear.skin ? gear.skin.spdMult || 1 : 1) *
                    (gear.tail ? gear.tail.spdMult || 1 : 1) *
                    (this.y <= config.snowBiomeTop
                     ? gear.skin && gear.skin.coldM
                     ? 1
                     : config.snowSpeed
                     : 1) *
                    this.slowMult;
                this.maxSpeed = spdMult;
            }
        };

        let tmpRatio = 0;
        let animIndex = 0;
        this.animate = function (dlta) {
            if (this.animTime > 0) {
                this.animTime -= dlta;
                if (this.animTime <= 0) {
                    this.animTime = 0;
                    this.dirPlus = 0;
                    tmpRatio = 0;
                    animIndex = 0;
                } else {
                    if (animIndex == 0) {
                        tmpRatio += dlta / (this.animSpeed * config.hitReturnRatio);
                        this.dirPlus = UWUTILS.lerp(
                            0,
                            this.targetAngle,
                            Math.min(1, tmpRatio)
                        );
                        if (tmpRatio >= 1) {
                            tmpRatio = 1;
                            animIndex = 1;
                        }
                    } else {
                        tmpRatio -= dlta / (this.animSpeed * (1 - config.hitReturnRatio));
                        this.dirPlus = UWUTILS.lerp(
                            0,
                            this.targetAngle,
                            Math.max(0, tmpRatio)
                        );
                    }
                }
            }
        };

        // GATHER ANIMATION:
        this.startAnim = function (didHit, index) {
            this.animTime = this.animSpeed = items.weapons[index].speed;
            this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
            tmpRatio = 0;
            animIndex = 0;
        };

        // CAN SEE:
        this.canSee = function (other) {
            if (!other) return false;
            let dx = Math.abs(other.x - this.x) - other.scale;
            let dy = Math.abs(other.y - this.y) - other.scale;
            return (
                dx <= (config.maxScreenWidth / 2) * 1.3 &&
                dy <= (config.maxScreenHeight / 2) * 1.3
            );
        };

        // SHAME SYSTEM:
        this.judgeShame = function () {
            this.lastShameCount = this.shameCount;
            if (this.oldHealth < this.health && !this.cheesed) {
                if (this.hitTime) {
                    this.healTime = game.tick - this.hitTime;
                    let oldHit = this.lastHit;
                    this.lastHit = game.tick;
                    this.hitTime = 0;
                    if (this.healTime < 2) {
                        this.shameCount++;
                        if (game.tick - this.oldHitTime < 2 && (this.guessDangerShame < this.shameCount || this.guessDangerShame >= 7 || game.tick - this.lastGuess > 2700)) {
                            this.guessDangerShame = this.shameCount;
                            this.lastGuess = game.tick;
                        }
                        if (this.healTime == 1) {
                            this.hackerPoints.autoheal += 2;
                        }
                        if (this.buildIndex != 0) {
                            if (this.qHeld) {
                                this.macroPoints.qHold += 4;
                            } else {
                                this.qHeld = true;
                                game.tickBase(() => {
                                    this.qHeld = false;
                                }, 10)
                                this.macroPoints.qHold++;
                            }
                        }
                    } else {
                        if (this.guessDangerShame == this.shameCount && this.oldHealth <= 35) {
                            this.dangerShame = this.shameCount;
                        } else {
                            this.guessDangerShame = this.shameCount;
                        }
                        this.shameCount = Math.max(0, this.shameCount - 2);
                        this.macroPoints.qHold -= 0.3;
                        this.qHeld = false;
                        if (this.healTime == 2) {
                            this.hackerPoints.autoheal += 3;
                        } else if (this.healTime > 3) {
                            this.hackerPoints.autoheal -=
                                this.primaryIndex && this.primary.id == 0
                                ? 10
                            : 30;
                        }
                    }
                }
            } else if (this.oldHealth > this.health) {
                this.oldHitTime = this.hitTime;
                this.hitTime = game.tick;
            }
            if (this.cheesed) this.cheesed = false;
        };
        this.addShameTimer = function () {
            this.shameCount = 0;
            this.shameTimer = 30;
        };
        this.updateShameTimer = function () {
            this.shameTimer = Math.max(0, this.shameTimer - ((performance.now() - this.sD) / 1000));
            this.sD = performance.now();
        };

        // CHECK TEAM:
        this.isTeam = function(tmpObj) {
            if (typeof tmpObj == "number") {
                return tmpObj == this.sid || alliancePlayers.includes(tmpObj);
            } else if (this.sid == tmpObj?.sid) {
                return true
            } else if (typeof tmpObj != "object" && this.sid != player.sid) {
                let tmp = findPlayerBySID(tmpObj);
                return tmp && (this == tmp || (this.team && tmp.team && this.team === tmp.team));
            } else {
                return tmpObj && (this == tmpObj || (this.team && tmpObj.team && this.team === tmpObj.team));
            }
        };

        // FOR THE PLAYER:
        this.findAllianceBySid = function (sid) {
            let plyrAllies = players.filter2((e) => e.team === this.team);
            return this.team ? plyrAllies.find2((THIS) => THIS === sid) : null;
        };
        this.checkCanInsta = function (nobull) {
            let totally = 0;
            if (inGame && nearHacker.sid) {
                let primary = {
                    weapon: this.primaryIndex,
                    variant: this.primaryVariant,
                    dmg: this.primaryIndex == undefined ? 0 : this.primary.dmg,
                };
                let secondary = {
                    weapon: this.secondaryIndex,
                    variant: this.secondaryVariant,
                    dmg: this.secondaryIndex == undefined ? 0 : this.secondary.Pdmg,
                };
                let bull = this.skins[7] ? 1.5 : 1;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1;
                if (primary.weapon != undefined && this.primaryReload == 0) {
                    totally += primary.dmg * pV * bull * (configs.rev || nearHacker.skinIndex == 6 ? 0.75 : 1);
                }
                if (secondary.weapon != undefined && this.secondaryReload == 0) {
                    totally += secondary.dmg * (secondary.weapon == 10 ? config.weaponVariants[secondary.variant].val : 1) * (!configs.rev || nearHacker.skinIndex == 6 ? 0.75 : 1);
                }
                if (this.skins[53] && this.turretReload <= (player.secondaryIndex == 10 ? 0 : game.tickRate) && nearHacker.skinIndex != 22) {
                    totally += (!configs.rev || nearHacker.skinIndex == 6 ? 18.75 : 25);
                }
                return totally;
            }
            return 0;
        };

        // UPDATE WEAPON RELOAD:
        this.manageReload = function () {
            if (
                this.weaponReload <= game.tickRate &&
                this.weaponReload > 0
            ) {
                this.antiBull = 1;
            }
            if (this.shooting[53]) {
                this.shooting[53] = 0;
                this.turretReload = 2500 - game.tickRate;
            } else {
                if (this.turretReload > 0) {
                    this.turretReload = Math.max(0, this.turretReload - game.tickRate);
                }
            }

            if (this.gathering || this.shooting[1]) {
                if (this.gathering) {
                    this.gathering = 0;
                    this.weaponReload = items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
                    if (this.gatherIndex < 9) {
                        this.primaryReload = this.weaponReload;
                    } else {
                        this.secondaryReload = this.weaponReload;
                    }
                    if (this.hammerIndex == this.weaponIndex && this.sid == playerSID) {
                         this.hammerReload = this.weaponReload;
                    }
                    this.attacked = true;
                }
                if (this.shooting[1]) {
                    this.shooting[1] = 0;
                    this.weaponReload = items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
                    this.secondaryReload = this.weaponReload;
                    this.attacked = true;
                }
            } else {
                this.attacked = false;
                if (this.buildIndex < 0) {
                    if (this.weaponReload > 0) {
                        // Math.max(0, this.weaponReload - game.tickRate)
                        this.weaponReload = Math.max(0, this.weaponReload - 110);
                        if (this.weaponIndex < 9) {
                            this.primaryReload = Math.max(0, this.primaryReload - 110);
                        } else {
                            this.secondaryReload = Math.max(0, this.secondaryReload - 110);
                        }
                        if (this.hammerIndex == this.weaponIndex && this.sid == playerSID) {
                            this.hammerReload = this.weaponReload;
                        }
                        if (this == player) {
                            if (configs.autoGrind) {
                                checkPlace(player.getItemType(22), (getSafeDir() + Math.PI / 4));
                                checkPlace(player.getItemType(22), (getSafeDir() - Math.PI / 4));
                            }
                        }
                    }
                }
            }
        }; /*
            // PREPLACER
            let closestBuild = [];

            function findTargetBuildToSpike(checkSpike, trapDistance, targetDistance, targetAngle) {
                if (!document.getElementById('sp').checked) return;
                if (!enemy.length) return;

                closestBuild = liztobj.filter2(obj => obj.active && obj.buildHealth)
                    .sort((a, b) => UWUTILS.getDist(a, player, 0, 2) - UWUTILS.getDist(b, player, 0, 2))[0];

                if (!closestBuild) return;

                checkSpike = 250;
                trapDistance = 250;
                targetDistance = UWUTILS.getDist(closestBuild, player, 0, 2);
                targetAngle = UWUTILS.getDirect(closestBuild, player, 0, 2);

                if (player.alive && targetDistance < checkSpike && near.dist2 < trapDistance &&
                    !traps.in && !instaC.isTrue && !instaC.canZpykeTick && !clicks.middle && !clicks.left) {

                    if (closestBuild.buildHealth < items.weapons[player.secondaryIndex == 10 ? 10 : player.primaryIndex].dmg * 2) {

                        if (document.getElementById('stype').value == "D") {
                            for (let i = 0; i < 6; i++) {
                                let angle = i + 45 * (i % 2 ? -1 : 1) / 180 * Math.PI + near.aim2;
                                checkPlace(2, i);
                            }
                        } else {
                            for (let i = 0; i < 4; i++) {
                                let angle = i + 45 * (i % 2 ? -1 : 1) / 180 * Math.PI + near.aim2;
                                checkPlace(2, i);
                            }
                        }
                    }
                }
            }*/

        /***OLD PREPLACER***\
             this.oldPre = function () {
            if (traps.in) return;
            if (!configs.autoPrePlace) return;

            const weaponRange = player.weapon.range + 70;
            const rangeSquared = weaponRange ** 2;
            const { x2: playerX, y2: playerY } = player;

            const lowHealthGameObjects = liztobj.filter2(gameObject => {
            const { x2, y2, buildHealth } = gameObject;
            const distSquared = (x2 - playerX) ** 2 + (y2 - playerY) ** 2;
            if (near && buildHealth <= 272.58 && distSquared <= rangeSquared) {
            return near && buildHealth <= 272.58 && distSquared <= rangeSquared;
            }
            });

            if (lowHealthGameObjects.length > 0) {
            const { x2, y2 } = lowHealthGameObjects[0];
            const objAim = UWUTILS.getDirect({ x2, y2 }, player, 0, 2);
            const trapPlacementRadius = 70;

            let enemyVelocity = Math.sqrt(near.xVel * near.xVel + near.yVel * near.yVel);
            let enemyDirection = Math.atan2(near.yVel, near.xVel);

            let bestAngle = null;
            let bestDistance = Infinity;

            for (let i = 0; i < 360; i += 30) {
            let simulatedAngle = UWUTILS.deg2rad(i);
            let distance =
            UWUTILS.getDist(near, player, 0, 2) +
            enemyVelocity * Math.sin(enemyDirection) +
            trapPlacementRadius;

            if (distance < bestDistance) {
            bestDistance = distance;
            bestAngle = simulatedAngle;
            }
            }

            const trapPlacementTime = 5;
            const timeToBreak = (lowHealthGameObjects[0].buildHealth - player.damage) / (player.damagePerShot - lowHealthGameObjects[0].absorb);
            const enemyTimeToMoveOut = bestDistance / enemyVelocity;

            if (timeToBreak + trapPlacementTime <= enemyTimeToMoveOut) {
            this.testCanPlace(4, bestAngle, bestAngle + Math.PI * 2, Math.PI / 24, objAim, trapPlacementRadius);
            }
            }
            };
            /******/
    }
}

// SOME CODES:
function sendUpgrade(index) {
    if (index < 9) {
        player.primaryReload = 0;
    } else {
        player.secondaryReload = 0;
    }
    packet("H", index, "sendUpgrade");
}

function storeEquip(id, index) {
    packet("c", 0, id, index, "storeEquip");
}

function storeBuy(id, index) {
    packet("c", 1, id, index, "storeBuy");
}

function buyEquip(id, index, force) {
    if (id != 6 && my.anti0tick > 0 && !force) return;
    if (player.alive && inGame) {
        if (player.health <= 5 && id == 7 && index == 0) {
            return;
        }
        if (index == 0) {
            if (player.skins[id]) {
                if (player.latestSkin != id || force) {
                    packet("c", 0, id, 0, "buyEquip");
                }
            } else {
                if (hatLoop && !loopHats.includes(id)) {
                    packet("c", 0, loopHats[loopIndex++], 0, "buyËquip");
                } else if (player.latestSkin != 0) {
                    packet("c", 0, validID(soldDist ? my.combatHat : my.defaultHat, 0, hats), 0, "buyËquip");
                }
            }
        } else if (index == 1) {
            if (player.tails[id]) {
                if (player.latestTail != id) {
                    packet("c", 0, id, 1, "buyËquip");
                }
            } else {
                if (configs.autoBuyEquip) {
                    let find = findID(accessories, id);
                    if (find) {
                        if (player.points >= find.price) {
                            packet("c", 1, id, 1, "buyËquip");
                            packet("c", 0, id, 1, "buyËquip");
                        } else {
                            if (player.latestTail != 0) {
                                packet("c", 0, 0, 1, "buyËquip");
                            }
                        }
                    } else {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1, "buyËquip");
                        }
                    }
                } else {
                    if (player.latestTail != 0) {
                        packet("c", 0, player.tails[my.combatTail] ? my.combatTail : 0, 1, "buyËquip");
                    }
                }
            }
        }
    }
}

function selectToBuild(index, wpn) {
    packet("z", index, wpn, "selectToBuild");
}

function selectWeapon(index, isPlace, force) {
    if (!noWep || force) {
        if (!isPlace) {
            player.weaponCode = index;
        }
        packet("z", index, 1, "selectWeapon");
    }
}

function sendAutoGather(ticks) {
    if (ticks === "e") {
        autoGathering = !autoGathering
        packet("K", 1, 1, "sendAutoGather");
    } else {
        if (my.waitHit < ticks) my.waitHit = ticks;
        if (!autoGathering) {
            autoGathering = true;
            packet("K", 1, 1, "sendAutoGather");
        }
    }
}

function sendAtck2(id, angle, sender) {
    packet("F", id, angle, 1, "sendAtck2");
}

// PLACER:
function place(id, rad, rmd, returnBool) {
    if (my.noAim) rad = blockAim ?? player.d2;
    if (player?.items[id]) {
        try {
            if (!config.isSandbox) {
                if (
                    id == 0 &&
                    Number(document.getElementById("foodDisplay").textContent) <
                    items.list[player.items[id]].req[1]
                )
                    return false;
                if (
                    id != 0 &&
                    Number(document.getElementById("stoneDisplay").textContent) <
                    items.list[player.items[id]].req[
                        items.list[player.items[id]].req.indexOf("stone") + 1
                    ]
                )
                    return false;
                if (
                    id != 0 &&
                    Number(document.getElementById("woodDisplay").textContent) <
                    items.list[player.items[id]].req[
                        items.list[player.items[id]].req.indexOf("wood") + 1
                    ]
                )
                    return false;
            }
            let wall = id == 2 && !evil ? 1 : id;
            if (wall == undefined) return false;
            let item = items.list[player.items[wall]];
            if (
                player.alive &&
                inGame &&
                (wall == 0 ||
                 (player.items[wall] &&
                  (player.itemCounts[item.group.id] == undefined
                   ? true
                   : player.itemCounts[item.group.id]) <
                  (config.isSandbox
                   ? 299
                   : item.group.limit
                   ? item.group.limit
                   : 99)))
            ) {
                if (returnBool) {
                    return true;
                } else {
                    selectToBuild(player.items[wall]);
                    sendAtck2(1, rad);
                    selectWeapon(player.weaponCode, 1);
                    if (id != 0) {
                        const item = items.list[player.items[wall]];
                        const tmpS = 35 + item.scale + (item.placeOffset || 0);
                        const tmpX = player.x2 + tmpS * Math.cos(rad);
                        const tmpY = player.y2 + tmpS * Math.sin(rad);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: item.name,
                            scale: item.scale,
                            dir: rad + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
    if (returnBool) {
        return false;
    }
}
function chainPlace(id, rad, count, interval, obj, random, spiketick, rad2) {
    interval = (interval < 15 ? 15 : interval)
    count = (interval > 5 ? 5 : count)
    const item = items.list[player.items[id]];
    const tmpS = 35 + item.scale + (item.placeOffset || 0);
    const tmpX = player.x2 + tmpS * Math.cos(rad);
    const tmpY = player.y2 + tmpS * Math.sin(rad);
    let len = placeVisible.length;
    placeVisible.push({
        id: len,
        x: tmpX,
        y: tmpY,
        name: item.name,
        scale: item.scale,
        dir: rad + Math.PI / 2,
        owner: {sid: player.sid}
    });
    game.tickBase(() => {
        placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
    }, 1)
    if (!my.noAim || id == 0) {
        try {
            if (
                id == 0 &&
                Number(document.getElementById("foodDisplay").textContent) <
                items.list[player.items[id]].req[1]
            )
                return;
            if (
                id != 0 &&
                Number(document.getElementById("stoneDisplay").textContent) <
                items.list[player.items[id]].req[
                    items.list[player.items[id]].req.indexOf("stone") + 1
                ]
            )
                return;
            if (
                id != 0 &&
                Number(document.getElementById("woodDisplay").textContent) <
                items.list[player.items[id]].req[
                    items.list[player.items[id]].req.indexOf("wood") + 1
                ]
            )
                return;
            let wall = id == 2 && !evil ? 1 : id;
            if (wall == undefined) return;
            let item = items.list[player.items[wall]];
            if (
                player.alive &&
                inGame &&
                (wall == 0 ||
                 (player.items[wall] &&
                  (player.itemCounts[item.group.id] == undefined
                   ? true
                   : player.itemCounts[item.group.id]) <
                  (config.isSandbox
                   ? 299
                   : item.group.limit
                   ? item.group.limit
                   : 99)))
            ) {
                if (typeof rad2 == "number") {
                    selectToBuild(player.items[wall]);
                    let i = 0;
                    let rdm = [];
                    let placeLoop = setInterval(() => {
                        if (random) {
                            rdm.push(Math.random() * random - random / 2);
                            packet("F", 1, rad + rdm[i], 1, "chainplace");
                        } else {
                            sendAtck2(1, rad);
                        }
                        i++;
                        if (i >= count) {
                            clearInterval(placeLoop);
                            selectWeapon(player.weaponCode, 1);
                            selectToBuild(player.items[wall]);
                            i = 0;
                            let placeLoop2 = setInterval(() => {
                                if (random) {
                                    sendAtck2(1, rad + rdm[i]);
                                } else {
                                    sendAtck2(1, rad);
                                }
                                i++;
                                if (i >= count) {
                                    clearInterval(placeLoop2);
                                    selectWeapon(player.weaponCode, 1);
                                }
                            }, interval);
                        }
                    }, interval);
                } else {
                    selectToBuild(player.items[wall]);
                    let i = 0;
                    let placeLoop = setInterval(() => {
                        i++;
                        if (i >= count) {
                            player.prePlaced = true;
                            sendAtck2(1, (typeof random == "number" ? rad + Math.random() * random - random / 2 : rad));
                            sendAtck2(0, getAttackDir());
                            selectWeapon(spiketick ? player.primaryIndex : player.weaponCode, 1);
                            console.log(secPacket);
                            clearInterval(placeLoop);
                        } else {
                            if (i == 0 && spiketick) {
                                player.chat.message = "Preplace Spiketick";
                                player.chat.count = 1000;
                                buyEquip(7, 0)
                                instaC.isTrue = true;
                                game.tickBase(() => {
                                    instaC.isTrue = false;
                                }, 2)
                            }
                            sendAtck2(1, (typeof random == "number" ? rad + Math.random() * random - random / 2 : rad));
                        }
                    }, interval);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}
function placerCheck(id, rad) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (
            objectManager[spamPlacer ? "checkItemLocation" : "checkCanManualPlace"](
                tmpX,
                tmpY,
                item.scale,
                0.6,
                item.id,
                false,
                player
            )
        ) {
            place(wall, rad);
        } else {
            let len = placeVisible.length;
            placeVisible.push({
                id: len,
                x: tmpX,
                y: tmpY,
                name: item.name,
                scale: item.scale,
                dir: rad + Math.PI / 2,
                owner: {sid: player.sid}
            });
            game.tickBase(() => {
                placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
            }, 1)
        }
    } catch (e) {}
}
function wallPlacer(rad) {
    try {
        if (wall == undefined) return;
        let item = items.list[player.items[1]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (
            objectManager[spamPlacer ? "checkItemLocation" : "checkCanManualPlace"](
                tmpX,
                tmpY,
                item.scale,
                0.6,
                item.id,
                false,
                player
            )
        ) {
            if (firstPlace) {
                sendAtck2(1, rad);
                selectWeapon(player.weaponCode);
                firstPlace = false;
            } else {
                place(1, rad);
            }
        } /* else {
                let tmpLen = placeVisible.length;
                placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad,
                    owner: {sid: player.sid}
                });
                setTimeout(() => {
                    placeVisible.splice(tmpLen, 1);
                }, game.tickRate)
            }*/
    } catch (e) {}
}
function preplace(id, rad, obj, random, spiketick, rad2) {
    try {
        if (!evil) spiketick = false;
        if (placeSpike) return
        const item = items.list[player.items[wall]];
        const tmpS = 35 + item.scale + (item.placeOffset || 0);
        const tmpX = player.x2 + tmpS * Math.cos(rad);
        const tmpY = player.y2 + tmpS * Math.sin(rad);
        let len = placeVisible.length;
        placeVisible.push({
            id: len,
            x: tmpX,
            y: tmpY,
            name: item.name,
            scale: item.scale,
            dir: rad + Math.PI / 2,
            owner: {sid: player.sid}
        });
        game.tickBase(() => {
            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
        }, 1)
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return;
        let timeout = obj.preplaceTimeout - performance.now();
        if ((macro.v || macro.f) && typeof rad2 != "number" && nearHacker.dist2 <= 200 && (!trapClear || !nearHacker.trapClear)) {
            setTimeout(() => {
                console.log("MACRO.V", secPacket)
                chainPlace(macro.v ? 2 : (macro.f ? 4 : id), rad, 8, 5, obj, random, (id == 2 || macro.v) && evil);
            }, timeout - 10);
        } else if (typeof rad2 != "number") {
            setTimeout(() => {
                console.log("ONE OBJ", secPacket)
                chainPlace(id, rad, secPacket <= 20 ? 6 : 4, secPacket <= 20 ? 4 : 5, obj, random, spiketick);
            }, timeout - secPacket <= 20 ? 5 : 10);
        } else {
            setTimeout(() => {
                console.log("TWO OBJ", secPacket)
                chainPlace(id, rad, 5, 6, obj, random, spiketick, rad2);
            }, timeout - 5);
        }
        /* else {
                let tmpLen = placeVisible.length;
                placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad,
                    owner: {sid: player.sid}
                });
                setTimeout(() => {
                    placeVisible.splice(tmpLen, 1);
                }, game.tickRate)
            }*/
    } catch (e) {}
}
function checkPreplace(id, rad, obj, pre) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return;
        let item = items.list[player.items[wall]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player[pre ? "x3" : "x2"] + tmpS * Math.cos(rad);
        let tmpY = player[pre ? "y3" : "y2"] + tmpS * Math.sin(rad);
        if (
            objectManager.checkItemLocationPrePlace(
                tmpX,
                tmpY,
                item.scale,
                0.6,
                item.id,
                false,
                player,
                obj
            )
        ) {
            place(wall, rad, 1);
            return true;
        } else {
            let len = placeVisible.length;
            placeVisible.push({
                id: len,
                x: tmpX,
                y: tmpY,
                name: item.name,
                scale: item.scale,
                dir: rad + Math.PI / 2,
                owner: {sid: player.sid}
            });
            game.tickBase(() => {
                placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
            }, 1)
        }
        return false;
    } catch (e) {}
    return false;
}
function checkPlace(id, rad) {
    try {
        console.log(id)
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
            place(id, rad, true);
            return true;
        } else {
            let len = placeVisible.length;
            placeVisible.push({
                id: len,
                x: tmpX,
                y: tmpY,
                name: item.name,
                scale: item.scale,
                dir: rad + Math.PI / 2,
                owner: {sid: player.sid}
            });
            game.tickBase(() => {
                placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
            }, 1)
            return false;
        }
    } catch (e) {
        console.error(e)
    }
    return false;
}
function checkCanPlace(id, rad) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        let tmpS = player.scale + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        let len = placeVisible.length;
        placeVisible.push({
            id: len,
            x: tmpX,
            y: tmpY,
            name: item.name,
            scale: item.scale,
            dir: rad + Math.PI / 2,
            owner: {sid: player.sid}
        });
        game.tickBase(() => {
            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
        }, 1)
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
            return true;
        } else {
            /*
                let tmpLen = placeVisible.length;
                placeVisible.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad,
                    owner: {sid: player.sid}
                });
                setTimeout(() => {
                    placeVisible.splice(tmpLen, 1);
                }, game.tickRate)*/
            return false;
        }
    } catch (e) {}
}
function checkBlockingItem(id, rad) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return false;
        let item = items.list[player.items[wall]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player.x2 + tmpS * Math.cos(rad);
        let tmpY = player.y2 + tmpS * Math.sin(rad);
        return objectManager.checkBlockingItem(
            tmpX,
            tmpY,
            item.scale,
            0.6,
            item.id,
            false,
            player
        );
    } catch (e) {}
}
function checkCanPrePlace(id, rad, obj, loose, pre = true) {
    try {
        let wall = id == 2 && !evil ? 1 : id;
        if (wall == undefined) return false;
        let item = items.list[player.items[wall]];
        let tmpS = 35 + item.scale + (item.placeOffset || 0);
        let tmpX = player[pre ? "x3" : "x2"] + tmpS * Math.cos(rad);
        let tmpY = player[pre ? "y3" : "y2"] + tmpS * Math.sin(rad);
        if (
            objectManager.checkItemLocationPrePlace(
                tmpX,
                tmpY,
                item.scale,
                loose ? 0.5 : 0.6,
                item.id,
                false,
                player,
                obj
            )
        ) {
            return true;
        }
    } catch (e) {}
}
function toTime(number) {
    if (number >= 3600) {
        const hours = number % 3600;
        const minutes = (number % 3600) % 60;
        return `${hours}h ${minutes}m ${number % 60}s`;
    } else if (number >= 60) {
        const minutes = Math.floor(number / 60);
        return `${minutes}m ${number % 60}s`;
    } else {
        return `${number}s`;
    }
}
function menuLog(msg) {
    let log = document.createElement("span");
    log.textContent = `${msg}`;
    log.color = "white";
    log.fontSize = "20px";
    log.marginRight = "10px";
    panelElements.logs.appendChild(log);
    let newLine = document.createElement("br");
    newLine.innerHTML = "<br>";
    panelElements.logs.appendChild(newLine);
    if (panelElements.logs.style.display == "block")
        getEl("feature").scrollTop = getEl("feature").scrollHeight;
}
function newLineMenuLog() {
    let newLine = document.createElement("br");
    newLine.innerHTML = "<br>";
    panelElements.logs.appendChild(newLine);
}
function drawPlayer(plyr, parent) {
    const canvas = document.createElement("canvas");
    canvas.height = 130;
    canvas.width = 90;
    parent.appendChild(canvas);
    const ctx = canvas.getContext("2d")
    ctx.strokeStyle = outlineColor;
    ctx.translate(40, 40)
    ctx.save()
    renderPlayer(plyr, ctx, 1);
    ctx.restore()
    ctx.font = "15px Hammersmith One";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = outlineColor;
    console.log(ctx.measureText(plyr.name))
    ctx.strokeText(plyr.name, 0, -30)
    ctx.fillText(plyr.name, 0, -30)
}
function addPlayerToList(plyr) {
    const parent = document.createElement("div");
    parent.id = "player-" + plyr.sid;
    panelElements.playerlist.appendChild(parent);
    parent.style.display = "flex";
    drawPlayer(plyr, parent);
    const log = document.createElement("span");
    plyr.listElement = log;
    log.textContent = `Team: ${player.team ? `"${plyr.team}"` : "none"}, SID: ${plyr.sid}, Estimated Location: ${plyr.guessLocation ?? "unknown"}, Move Direction: ${tmpObj.movDir}, Estimated now`;
    plyr.logDetails = `Team: ${player.team ? `"${plyr.team}"` : "none"}, SID: ${plyr.sid}, Estimated Location: ${plyr.guessLocation ?? "unknown"}, Move Direction: ${tmpObj.movDir}, Estimated `;
    log.style.color = "white";
    log.style.fontSize = "20px";
    log.style.display = "flex";
    log.style.left = "20%";
    parent.appendChild(log);
}
// HEALING:
function soldierMult() {
    return player.predictHat == 6 ? 0.75 : 1;
}
//checkKB(player,getDir(_.np.real,E.np.real),dist(E,_.kbpot.fpriTKB),true,0)
function checkKB(target, angle, distance, vel,insta, z, x, y) {
    z = nearObjects.filter2(e => e.dmg && ((target.sid != player.sid) ? (player.isTeam(e?.owner?.sid)||!target.team&&e?.owner?.sid!=target.sid):!player.isTeam(e?.owner?.sid))||(e?.type == 1 && e.y >= 12000))
    if(!z || !z.length) return false
    if(vel){
        x = target.x3
        y = target.y3
    } else{
        x = target.x2
        y = target.y2;
    }
    console.log(distance)
    for (let i = 0;i < z.length;i++) {
        const obj = z[i];
        const scale = obj.type === 1 ? obj.scale * .55 + 35 : obj.scale +35
        const dist1 = cdf(target,obj)//getDistance(nEnemy.x2, nEnemy.y2, obj.x, obj.y);
        const point1 = calcPoint(x, y, angle, dist1);
        const dist2 = cdf(point1,obj)//getDistance(point1.x, point1.y, obj.x, obj.y);
        if(dist2 < scale && dist1 - scale < distance) {
            let p00 = calcPoint(x, y, angle, dist1 - scale);
            return {x:p00.x, y: p00.y, obj: obj};
        }
    }
    return false;
}
function healthBased() {
    if (player.health == 100) {
        return 0;
    }
    if (player.skinIndex != 45) {
        return Math.ceil(
            (100 - player.health) / items.list[player.items[0]].healing
        );
    }
    return 0;
}
function getAttacker(damaged, tmpObj) {
    if (damaged <= 0) return;
    let enemies = nearPlayers.filter2((e) => tmpObj.team == undefined ? tmpObj.sid != e.sid : tmpObj.team != e.team);
    let attackers = enemies.filter2((tmp) => {
        const wpn = tmp.weapon;
        let inRange = false;
        let tmpDist = UWUTILS.getDist(tmpObj, tmp, 2, 2);
        let rangedWeapon = [9, 12, 13, 15].includes(tmp.weaponIndex);
        if (rangedWeapon || tmpDist <= wpn.range + 120 || UWUTILS.getDist(tmpObj, tmp, 3, 3) <= wpn.range + 120)
            inRange = true;
        let damagePossible = false;
        let dmg2 = rangedWeapon ? wpn.Pdmg : (wpn.dmg * sortWeaponVariant(tmp.weaponVariant));
        let damage = dmg2;
        if (tmpObj.skinIndex == 6) {
            damage *= 0.75;
        }
        if (!rangedWeapon) {
            if (tmp.skinIndex == 7) {
                damage *= 1.5;
            } else if (tmp.skinIndex == 55) {
                damage *= 1.2;
            }
            if (tmp.tailIndex == 11) damage *= 0.2;
        }
        if (Math.abs(damage - damaged) < 0.001) damagePossible = true;
        let RuLe = {
            one: inRange,
            two: damagePossible || tmpObj.skinIndex == 45,
            three:
            Math.abs(tmp.d2 - UWUTILS.getDirect(tmpObj, tmp, 2, 2)) <=
            (rangedWeapon
             ? Math.PI / 1.5 / ((UWUTILS.getDist(tmpObj, tmp, 2, 2) + 50) / 100)
             : (config.gatherAngle * 2)),
            four: tmp.attackingWeapon != null
        };
        if (
            (tmp.weaponIndex != 0 || tmp.dist2 > 140) &&
            (damaged == 18.75 || damaged == 25)
        ) {
            return tmp.turretGear && tmp.dist2 <= 300;
        }
        return RuLe.one && RuLe.two && RuLe.three && RuLe.four;
    });
    if (attackers.length == 0 && nears.length && tmpObj == player) {
        attackers = enemies.filter2((tmp) => {
            let inRange = false;
            let tmpDist = UWUTILS.getDist(tmpObj, tmp, 2, 2);
            let rangedWeapon =
                tmp.weaponIndex > 8 && tmp.weapon.Pdmg > 20;
            if (
                rangedWeapon ||
                tmpDist <= tmp.weapon.range + 120 ||
                UWUTILS.getDist(tmpObj, tmp, 3, 3) <=
                tmp.weapon.range + 120
            )
                inRange = true;
            let damagePossible = false;
            let dmg2;
            if (rangedWeapon) {
                dmg2 = tmp.weapon.Pdmg;
            } else {
                dmg2 =
                    tmp.weapon.dmg *
                    sortWeaponVariant(tmp.weaponVariant);
            }
            let damage = dmg2;
            if (tmpObj.skinIndex == 6) {
                damage *= 0.75;
            }
            if (tmp.skinIndex == 7) {
                damage *= 1.5;
            } else if (tmp.skinIndex == 55) {
                damage *= 1.2;
            }
            if (tmp.tailIndex == 11) damage *= 0.2;
            if (Math.abs(damage - damaged) < 0.001) damagePossible = true;
            let RuLe = {
                one: inRange,
                two: damagePossible,
                three:
                Math.abs(tmp.d2 - UWUTILS.getDirect(tmpObj, tmp, 2, 2)) <=
                (rangedWeapon
                 ? Math.PI / 1.5 / ((UWUTILS.getDist(tmpObj, tmp, 2, 2) + 50) / 100)
                 : (config.gatherAngle * 2)),
                four: tmp.attacked,
            };
            if (
                (tmp.weaponIndex != 0 || tmp.dist2 > 140) &&
                (damaged == 18.75 || damaged == 25)
            ) {
                return tmp.lastSkinIndexes.slice(-3).includes(53) && tmp.dist2 <= 300;
            }
            return RuLe.one && RuLe.two && RuLe.four;
        });
        return attackers.length > 0 ? attackers : undefined;
    } else {
        return attackers.length > 0 ? attackers : undefined;
    }
}
function healer(force) {
    if (player.food < items.list[player.items[0]].req[1] || !autoHeal && !force) return;
    if (player.skinIndex == 56 && player.health < 100) {
        buyEquip(6, 0);
    }
    for (let i = 0; i < healthBased(); i++) {
        selectToBuild(player.items[0]);
        sendAtck2(1, getAttackDir());
    }
}

function antiSyncHealing(timearg) {
    my.antiSync = true;
    let healAnti = setInterval(() => {
        if (player.shameCount < 5) {
            place(0, getAttackDir());
        }
    }, 25);
    setTimeout(() => {
        clearInterval(healAnti);
        setTimeout(() => {
            my.antiSync = false;
        }, game.tickRate);
    }, game.tickRate);
}
function antiSyncHealing1(timearg) {
    my.antiSync = true;
    let healAnti = setInterval(() => {
        if (player.shameCount < 0) {
            place(0, getAttackDir());
        }
    }, 75);
    setTimeout(() => {
        clearInterval(healAnti);
        setTimeout(() => {
            my.antiSync = false;
        }, game.tickRate);
    }, game.tickRate);
}
function findAllianceBySid(sid) {
    return player.team ? alliancePlayers.find2((THIS) => THIS === sid) : null;
}
function checkIsTeam(sid) {
    return alliancePlayers.find2((THIS) => THIS === sid) != undefined;
}
function applCxC(value) {
    if (player.health == 100) {
        return 0;
    }
    if (player.skinIndex != 45 && player.skinIndex != 56) {
        return Math.ceil(value / items.list[player.items[0]].healing);
    }
    return 0;
}
function calcDmg(value) {
    return value * player.skinIndex == 6 ? 0.75 : 1;
}
function partitionzion(arr, predicate) {
    const matched = [];
    const rest = [];

    for (let i = 0;i < arr.length;i++) {
        const item = arr[i];
        (predicate(item) ? matched : rest).push(item);
    }

    return [matched, rest]; // or { matched, rest }
}
function biomeGear(ignoreStandStill) {
    let asda = getMoveDir();
    let antiBullTrue = configs.antiBull;
    if (
        player.tailIndex !=
        (!ignoreStandStill && near && near.dist3 <= 280
         ? player.tails[antiBullTrue ? 21 : 19]
         ? antiBullTrue
         ? 21
         : 19
         : 0
         : (ignoreStandStill || near.dist3 >= 320) && player.tails[11]
         ? 11
         : 0)
    ) {
        buyEquip(
            ignoreStandStill && (near.dist3 <= 280 || noTail)
            ? antiBullTrue
            ? 21
            : 19
            : ignoreStandStill || near.dist3 >= 320
            ? 11
            : antiBullTrue
            ? 21
            : 19,
            1
        );
    } else if (asda == undefined && !ignoreStandStill) {
        buyEquip(hatLoop ? loopHats[loopIndex++] : my.combatHat, 0);
    } else {
        if (
            player.y2 >= config.mapScale / 2 - config.riverWidth / 2 &&
            player.y2 <= config.mapScale / 2 + config.riverWidth / 2
        ) {
            buyEquip(
                player.skins[31] ? 31 : hatLoop ? loopHats[loopIndex++] : my.combatHat,
                0
            );
        } else {
            if (player.y2 <= config.snowBiomeTop) {
                buyEquip(hatLoop ? loopHats[loopIndex++] : 15, 0);
            } else {
                buyEquip(
                    player.skins[6] && enemy && !ignoreStandStill && soldDist
                    ? 6
                    : hatLoop
                    ? loopHats[loopIndex++]
                    : player.skins[12]
                    ? 12
                    : my.combatHat,
                    0
                );
            }
        }
    }
}
function biomeGearHat(ignoreStandStill) {
    let asda = getMoveDir();
    if (asda == undefined) {
        return hatLoop ? loopHats[loopIndex++] : player.skins[22] ? 22 : 6;
    } else {
        if (
            player.y2 >= config.mapScale / 2 - config.riverWidth / 2 &&
            player.y2 <= config.mapScale / 2 + config.riverWidth / 2
        ) {
            return player.skins[31]
                ? 31
            : hatLoop
                ? loopHats[loopIndex++]
            : 0;
        } else {
            if (player.y2 <= config.snowBiomeTop) {
                return player.skins[15]
                    ? 15
                : hatLoop
                    ? loopHats[loopIndex++]
                : 0;
            } else {
                return hatLoop
                    ? loopHats[loopIndex++]
                : player.skins[12]
                    ? 12
                : 0;
            }
        }
    }
}
function hatSwitcher(returnHat) {
    if (!player.primary || !player.primary.range) return
    let has6 = player.skins[6];
    let has22 = player.skins[22];
    if (angelWings && player.tailIndex != 13 && player.skinIndex == 6 && player.tails[13]) {
        my.predictTail = 13;
        buyEquip(13, 1);
        return;
    } else if (my.anti0tick > 0 || antiOneTick > 0) {
        let hat = has6
        ? 6
        : hatLoop && loopHats.includes(player.skinIndex)
        ? loopHats[loopIndex++]
        : 0;
        my.predictHat = hat;
        buyEquip(hat, 0);
        return;
    } else if (player.empAnti) {
        let hat = has22
        ? 22
        : has6
        ? 6
        : hatLoop && loopHats.includes(player.skinIndex)
        ? loopHats[loopIndex++]
        : 0;
        my.predictHat = hat;
        buyEquip(hat, 0);
        return;
    } else if (soldierAnti) {
        let hat = has6
        ? 6
        : hatLoop && loopHats.includes(player.skinIndex)
        ? loopHats[loopIndex++]
        : 0;
        my.predictHat = hat;
        buyEquip(hat, 0);
        return;
    } else if (!instaC.isTrue && player.shameCount >= 4 && (game.tick - player.bullTick) % 9 === 0) {
        my.predictHat = 7;
        buyEquip(7, 0);
    } else if (!instaC.isTrue) {
        let hatChanger = function () {
            if (!player.primary) return;
            // variable jumpscare (makes code run faster)
            const breakerReload = player.hammerReload == 0;
            if (traps.in && breakerReload && !clicks.left && traps.tick == game.tick) return 40;
            const canShameSpam = !instaC.isTrue && !clicks.right && (!traps.in || nearHacker.shameCount >= 4) && configs.rubyShame && [3, 5].includes(player.primaryIndex) && player.primaryVariant == 3 && nearHacker.dist2 <= player.primary.range + 65 && (game.tick - player.bullTick) % 9 < (9 - Math.ceil(player.primary.speed / 111))
            const tmpRange = (player?.primary?.range ?? 65) + 68;
            const has40 = player.skins[40];
            const has7 = player.skins[7];
            const noClown = player.skinIndex != 45;
            const nD2 = near.dist2 ?? 9999;
            const nHD3 = nearHacker.dist3 ?? 9999;
            const nHD2 = nearHacker.dist2 ?? 9999;
            const range2 = (nearHacker.primary?.range ?? 142) + 60 + 20 * nearHacker.maxSpeed;
            const antiBullVar =
                  (nHD2 <= range2 || nHD3 <= range2) && nearHacker.antiBull ? !nearHacker.trapped && player.skins[26] && (traps.in || configs.barbarian || nearHacker.weaponIndex == 3 && [9, 12, 13, 15].includes(nearHacker.secondaryIndex) || nearHacker.weaponIndex == 14) ? nearHacker.antiBull ? 26 : 6 :
            /*((configs.antiBullInsta &&
                    player.checkCanInsta(false) >=
                    100) ||
                    antiReverse)*/ 6 : undefined;
            const biomeHat = my.defaultHat == "auto" ? biomeGearHat() : my.defaultHat;
            const combatHat = my.combatHat;
            const combatTail = player.tails[my.combatTail] ? my.combatTail : 0;
            const speedTail = my.defaultTail;
            soldDist = false;
            for (let i = 0; i < nearPlayers.length; i++) {
                let tmp = nearPlayers[i];
                if (!tmp || tmp.dist2 > 400) continue;
                let tmpDist = tmp.boosted
                ? 105
                : player.skinIndex == 6
                ? 80
                : 73;
                const dist =
                      UWUTILS.getDist(tmp, player, 2, 3) <=
                      items.weapons[tmp.primaryIndex ?? 5].range + tmpDist ||
                      tmp.dist2 <= items.weapons[tmp.primaryIndex ?? 5].range + tmpDist ||
                      UWUTILS.getDist(player, tmp, 2, 3) <=
                      items.weapons[tmp.primaryIndex ?? 5].range + tmpDist ||
                      tmp.dist3 <= items.weapons[tmp.primaryIndex ?? 5].range + tmpDist;
                if (dist) {
                    soldDist = true;
                    break;
                }
            }
            const bulltick = has7 && noClown && player.dot <= 0 &&
                  ((player.shameCount > 0 && getVolcanoDist() > 1440 && ((game.tick - player.bullTick) % 9 === 0 || nD2 >= 215) || my.reSync)) ? 7 : undefined;
            if (player.shameCount >= 5 && bulltick) return 7;
            if (nears.length > 1 && nears.find2((e) => e.weaponIndex < 9 && e.antiBull)) return nearHacker.antiBull ? 26 : 6;
            if ((nHD3 <= 110 || !nearHacker.trapped || [3, 4, 5].includes(player.primaryIndex)) && !angelWings &&
                (player.primaryIndex != 8 && (noTail || betraying || (nD2 && nHD2 && nHD3 <= (player.primaryIndex == 5 && player.items[4] == 16 ? 395 : player.primaryIndex == 7 ? 190 : 340)) || clicks.left && !clicks.right || canShameSpam) &&
                 player.tailIndex != combatTail
                )) {
                return [combatTail, 1];
            } else if (
                !canShameSpam &&
                !angelWings &&
                !noTail &&
                !betraying &&
                ((player.tailIndex != speedTail &&
                  player.tails[speedTail] &&
                  !clicks.left &&
                  (nHD3 > 110 && nearHacker.trapped && ![3, 4, 5].includes(player.primaryIndex) || nHD2 >= (player.primaryIndex == 5 && player.items[4] == 16 ? 410 : player.primaryIndex == 7 ? 200 : 370))))
            ) {
                return [speedTail, 1];
            } else if (clicks.right || breakSpike || autoBreaker.active) {
                let hat = (player.weaponReload == 0 && has40) ? 40 : bulltick ?? (antiBullVar ?? (nHD3 <= range2 ? combatHat : biomeHat));
                return hat;
            } else if (
                canShameSpam ||
                clicks.left ||
                clicks.right ||
                breakSpike ||
                autoBreaker.active ||
                (configs.bullspam && (nHD3 <= tmpRange || nHD2 <= tmpRange))
            ) {
                if (!clicks.right && (!configs.autoGrind || configs.autoGrind && has40 || configs.bullspam && (nHD3 <= tmpRange || nHD2 <= tmpRange) || player.tailIndex == 11 && (canShameSpam || clicks.left || configs.bullspam && (nHD3 <= tmpRange || nHD2 <= tmpRange)))) {
                    const hat = player.tailIndex == 11 && !configs.autoGrind
                    ? [combatTail, 1]
                    : player.primaryReload == 0
                    ? configs.autoGrind ? 40 : has7 ? 7 : combatHat
                    : bulltick ?? (antiBullVar ?? (nHD3 <= range2 ? combatHat : biomeHat))
                    return hat;
                } else if (clicks.right || autoBreaker.active) {
                    return breakerReload && has40 ? 40 : bulltick ?? (antiBullVar ?? (nHD3 <= range2 ? my.combatHat : biomeHat))
                }
            } else if (traps.in) {
                if (player.hammerReload == 0) {
                    const hat = has40 ? 40 : bulltick ?? (antiBullVar ?? (nHD3 <= range2 ? my.combatHat : biomeHat));
                    return hat;
                } else {
                    return bulltick ?? (antiBullVar ?? liztobj.find2((e) => e.dmg && !e.isTeamObject(player) && e.distance3 <= 40) ? 6 : nearHacker.antiBull ? 26 : 6);
                }
            } else {
                if (player.empAnti || soldierAnti) {
                    return player.empAnti ? 22 : 6;
                } else {
                    if (bulltick) {
                        return 7;
                    } else {
                        return (nHD3 <= range2 ? combatHat : biomeHat);
                    }
                }
            }
        };
        if (boostSpike) {
            if (debugLogs) console.log("boostspike")
            if (returnHat) {
                if (debugLogs) console.log("biomegear")
                return biomeGearHat();
            } else biomeGear(1);
        } else if (
            storeMenu.style.display != "block" &&
            !instaC.isTrue &&
            !instaC.ticking
        ) {
            if (!noHat) {
                let hat = hatChanger();
                if (!my.reSync && player.shameCount > 0 && (game.tick - player.bullTick) % 9 === 0 && hat == 7) {
                    bulltickSync = false;
                    bullticking = true;
                    game.tickBase(() => {
                        bullticking = false;
                    }, 3)
                }
                if (debugLogs) console.log(hat)
                if (debugLogs) console.log(hat)
                if (typeof hat == "object") {
                    my.predictTail = hat[0];
                    buyEquip(hat[0], 1);
                } else {
                    my.predictHat = hat ?? my.combatHat;
                    buyEquip(hat ?? my.combatHat, 0);
                }
            } else {
                console.log("nohat")
            }
        }
    }
}
let advHeal = [];

function woah(mover) {
    let antiBullTrue = configs.antiBull;
    buyEquip(
        (mover && player.moveDir == undefined) || noTail
        ? antiBullTrue
        ? 21
        : 19
        : 11,
        1
    );
}

let info = {};

let spikeKT = function () {
    return (
        player.secondaryIndex == 10 &&
        (info.health > player.primary.dmg ||
         player.primaryIndex == 5)
    );
};
let onetick123modprov3asd = false;
function oneTick(insta, dontMove) {
    let moveAim = UWUTILS.getDirect(nearHacker, player, 3, 2);
    if (traps.in) return;
    player.chat.message = "Onetick";
    player.chat.count = 500;
    if (insta) {
        selectWeapon(5, 0, 1);
        onetick123modprov3asd = true;
        noMove = true;
        noZ = true;
        if (!dontMove) packet("9", moveAim, 1, "onetick");
        buyEquip(53, 0);
        my.autoAim = 2;
        instaC.isTrue = true;
        game.tickBase(() => {
            noZ = false;
            selectWeapon(5);
            noZ = true;
            noWep = true;
            buyEquip(7, 0);
            sendAutoGather(1);
            if (!dontMove) packet("9", moveAim, 1, "onetick");
            game.tickBase(() => {
                noZ = false;
                noWep = false;
                onetick123modprov3asd = false;
                instaC.isTrue = false;
            }, 1)
            game.tickBase(() => {
                game.tickBase(() => {
                    noWep = false;
                    if (!dontMove) packet("9", undefined, 1, "onetick");
                }, 1)
                noMove = false;
            }, 1);
        }, 1);
    } else {
        noMove = true;
        packet("9", moveAim, 1, "onetick");
        instaC.isTrue = true;
        game.tickBase(() => {
            packet("9", moveAim, 1, "onetick");
            buyEquip(53, 0);
            my.autoAim = 2;
            game.tickBase(() => {
                selectWeapon(5);
                buyEquip(7, 0);
                sendAutoGather(1);
                packet("9", moveAim, 1, "onetick");
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1)
                game.tickBase(() => {
                    game.tickBase(() => {
                        packet("9", undefined, 1, "onetick");
                    }, 1)
                    noMove = false;
                }, 1);
            }, 1);
        }, 1);
    }
}
let aimSpike = 0;
let savedAngle;
let nearspiker = false;
function guessBoostTime() {
    let target = { x: near.x, y: near.y };
    let noBoostTarget = { x: near.x, y: near.y };
    let tmpPlayer = { x: player.x, y: player.y };
    let boostPadPlacements = near.dist2 > 600 ? 3 : near.dist2 > 400 ? 2 : 1;
    let timeWithoutBoostPads;
    let timeWithBoostPads = timeWithoutBoostPads - boostPadPlacements * 30;
    let al = 0;
    if (near.moveTime < 20) {
        for (al = near.moveTime; al < 20; al++) {
            target.x += al * 2 * Math.cos(Number(near.moveDir));
            target.y += al * 2 * Math.sin(Number(near.moveDir));
        }
    }
    target.x +=
        (timeWithBoostPads - al) *
        5.1 *
        Number(near.maxSpeed) *
        Number(Math.cos(near.moveDir));
    target.y +=
        (timeWithBoostPads - al) *
        5.1 *
        Number(near.maxSpeed) *
        Number(Math.sin(near.moveDir));
    return target;
    while (UWUTILS.getDist(target, player) <= 20) {}
}
let savedAim = undefined;
function autoBoostSpike(move) {
    menuLog("boostSpike")
    let dist = nearHacker.dist3;
    let moveDir = nearHacker.movDir;
    let pos = String(Math.max(2, Math.ceil(nearHacker.dist2 / 160)))
    let aim = move ? Math.atan2(
        nearHacker["y" + pos] - player.y2,
        nearHacker["x" + pos]  - player.x2
    ) : nearHacker.aim3;
    move = nearHacker.movDir !== null;
    if (quaded) {
        if (
            savedAim != undefined &&
            checkCanPlace(2, savedAim + Math.PI / 2) &&
            checkCanPlace(2, savedAim - Math.PI / 2)
        ) {
            checkPlace(2, savedAim - Math.PI / 2.25);
            checkPlace(2, savedAim + Math.PI / 2.25);
            checkPlace(2, savedAim);
            boostspike = false;
            if (player.primaryIndex >= 3 && player.primaryIndex <= 5) {
                player.chat.message = "Boost Spiketick";
                player.chat.count = 2000;
                hitBull(nearHacker.aim2, 0);
            }
        } else if (nearHacker.dist2 <= 100 && UWUTILS.getAngleDist(nearHacker.aim2, savedAim) > 1.2) {
            checkPlace(2, aim + Math.PI * 0.25);
            checkPlace(2, aim + Math.PI * 0.25);
            boostspike = false;
            if (player.primaryIndex >= 3 && player.primaryIndex <= 5) {
                player.chat.message = "Boost Spiketick";
                player.chat.count = 2000;
                hitBull(nearHacker.aim2, 0);
            }
        }
    } else if (dist <= 250 && !quaded) {
        if (checkCanPlace(2, aim + Math.PI)) {
            savedAim = aim;
            quaded = true;
            checkPlace(2, aim + Math.PI * 0.75);
            checkPlace(2, aim + Math.PI * 0.75);
        }
    } else if (dist > 200) {
        if (dist <= 400) buyEquip(my.combatTail, 1);
        place(4, aim);
    }
    packet("9", aim, 1, "autoBoostSpike");
}
class Traps {
    constructor(UWUTILS, items) {
        this.dist = 0;
        this.aim = 0;
        this.inTrap = false;
        this.replaced = false;
        this.antiTrapped = false;
        this.info = {};
        this.checkZpyklerTick = function (anti = false, ignoreObj, pre) {
            try {
                if (![3, 4, 5].includes(nearHacker.primaryIndex) && ![3, 4, 5].includes(near.primaryIndex)) return false;
                if (!my.autoPush || !near.primaryIndex || near.primaryReload > game.tickRate) return false;
                if (near[pre ? "dist3" : "dist2"] <= items.weapons[near.primaryIndex ?? 5].range + 63) {
                    let item = items.list[9];
                    let tmpS = 35 + item.scale + (item.placeOffset ?? 0);
                    let danger = 0;
                    let counts = {
                        attempts: 0,
                        block: `unblocked`,
                    };
                    for (let i = -1; i <= 1; i += 1 / 10) {
                        counts.attempts++;
                        let relAim = UWUTILS.getDirect(player, near, pre ? 3 : 2, pre ? 3 : 2) + i;
                        let tmpX = near[pre ? "x3" : "x2"] + tmpS * Math.cos(relAim);
                        let tmpY = near[pre ? "y3" : "y2"] + tmpS * Math.sin(relAim);
                        let spikeContact =
                            UWUTILS.getDistance(tmpX, tmpY, player[pre ? "x3" : "x2"], player[pre ? "y3" : "y2"]) <=
                            item.scale + 35;
                        if (!spikeContact) continue;
                        let cantPlace = liztobj.find2(
                            (tmp) =>
                            tmp.active &&
                            (!ignoreObj || tmp.sid != ignoreObj.sid) &&
                            UWUTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) <
                            item.scale +
                            (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem))
                        );
                        if (cantPlace) continue;
                        if (
                            tmpY >= config.mapScale / 2 - config.riverWidth / 2 &&
                            tmpY <= config.mapScale / 2 + config.riverWidth / 2
                        )
                            continue;
                        danger++;
                        counts.block = `blocked`;
                        break;
                    }
                    if (danger && [4, 5].includes(near.primaryIndex)) {
                        if (anti) console.log("ANTI");
                        if (anti && !traps.in) {
                            player.chat.message = "Anti NoTrap Spiketick";
                            player.chat.count = 1000;
                            buyEquip(6, 0);
                            my.anti0tick = 1;
                        }
                        return true;
                    }
                }
            } catch (err) {
                return null;
            }
            return false;
        };
        this.protect = function(aim) {
            console.log("PROTECT")
            if (player.items[4]) {
                checkPlace(4, aim + (Math.PI * 0.25))
                checkPlace(4, aim - (Math.PI * 0.25))
            }
            traps.testCanPlace(2, -Math.PI / 2, Math.PI / 2, Math.PI / 8)
        };

        this.autoPlace = function () {
            if (!boostSpike && (configs.autoPlace || configs.chasePlacer) && nearHacker && nearHacker.dist2 && !noPlacers) {
                /*if (true) {*/
                const itemZpyke = items.list[player.items[evil ? 2 : 1]];
                const itemTarp = items.list[player.items[4]];
                if (nearHacker.inTrap) {
                    placedOnPerfectAngle = this.checkPerfAngle();
                    if (!placedOnPerfectAngle) {
                        if (nearHacker.dist2 <= 270) {
                            const direct = UWUTILS.getDirect(player, nearHacker.inTrap, 2, 0);
                            if (!checkPlace(2, direct)) {
                                checkPlace(2, direct - Math.random() * 0.5 - 0.25);
                                checkPlace(2, direct + Math.random() * 0.5 - 0.25);
                            }
                        }
                    }
                } else {
                    let placed = false;
                    let tmpSZpyke = 30 + itemZpyke.scale;
                    let possiblePlaceAngles = [];
                    if (nearHacker.dist3 <= tmpSZpyke + 40) {
                        const dx = nearHacker.x2 - player.x;
                        const dy = nearHacker.y2 - player.y;
                        const dist = Math.hypot(dx, dy); // or Math.sqrt(dx*dx + dy*dy)
                        const radius = 35 + itemZpyke.scale;
                        const angleDiffEdge = Math.asin(radius / dist);
                        const ouchies = liztobj.filter2((e) => (e.dmg && !e.isTeamObject(nearHacker) && e.active || e.type == 1 && e.y >= 12000))
                        const step = 0.25;
                        const maxOffset = Math.min(angleDiffEdge, 3);
                        let indx = 0;
                        while (indx * step / 2 <= maxOffset) {
                            const jump = indx === 0 ? 0 : ((indx % 2 === 1 ? -1 : 1) * Math.ceil(indx / 2) * step);
                            const randomAngle = nearHacker.aim3 + jump;
                            indx++;
                            const placePos = {x: player.x2 + tmpSZpyke * Math.cos(randomAngle), y: player.y2 + tmpSZpyke * Math.sin(randomAngle)}
                            const bounceDirection = UWUTILS.getDirect(nearHacker, placePos, 2, 0);
                            const bouncePos = {x: nearHacker.x3 + 45 * Math.cos(bounceDirection), y: nearHacker.y3 + 45 * Math.sin(bounceDirection)};
                            const hitSpike = ouchies.filter2((e) => UWUTILS.getDist(e, bouncePos, 0, 0) <= e.realScale + 35);
                            for (let i = 0;i < hitSpike.length;i++) {
                                let a = hitSpike[i];
                                if (UWUTILS.getDist(placePos, nearHacker, 0, 2) <= radius) {
                                    const newBouncePos = {x: nearHacker.x3 + Math.cos(bounceDirection + Math.PI) * 40, y: nearHacker.y3 + Math.sin(bounceDirection + Math.PI) * 40};
                                    if (ouchies.find2((b) => !hitSpike.some(h => h.sid === b.sid) && UWUTILS.getDist(bouncePos, b) <= b.scale + 45)) {
                                        selectToBuild(2);
                                        sendAtck2(1, randomAngle + Math.random() * 0.3 - 0.15);
                                        sendAtck2(1, randomAngle + Math.random() * 0.3 - 0.15);
                                        sendAtck2(1, randomAngle + Math.random() * 0.3 - 0.15);
                                        instaC.wantZpyklerTick = "turr";
                                        placed = true;
                                        return;
                                    }
                                }
                            }
                            if (hitSpike.length) {
                                possiblePlaceAngles.push({diff: UWUTILS.getAngleDist(placePos, nearHacker.aim3), angle: randomAngle, obj: hitSpike[0]});
                            }
                        }
                        if (possiblePlaceAngles.length) {
                            if (possiblePlaceAngles.length > 1) {
                                let bestPos = possiblePlaceAngles.sort((a, b) => b.diff - a.diff)[0];
                                selectToBuild(2);
                                sendAtck2(1, bestPos.aim + Math.random() * 0.3 - 0.15);
                                sendAtck2(1, bestPos.aim + Math.random() * 0.3 - 0.15);
                                sendAtck2(1, bestPos.aim + Math.random() * 0.3 - 0.15);
                                instaC.wantZpyklerTick = "turr";
                                placed = true;
                                return;
                            } else {
                                selectToBuild(2);
                                const aim = possiblePlaceAngles[0].aim;
                                sendAtck2(1, aim + Math.random() * 0.3 - 0.15);
                                sendAtck2(1, aim + Math.random() * 0.3 - 0.15);
                                sendAtck2(1, aim + Math.random() * 0.3 - 0.15);
                                instaC.wantZpyklerTick = "turr";
                                placed = true;
                                return;
                            }
                        }
                    }
                    let placedTrap = false;
                    if (!placed) {
                        perfSpikeAngle = undefined;
                        if (player.items[4] == 15 && nearHacker.dist3 <= 125) {
                            let item = items.list[15];
                            let tmp = { x: undefined, y: undefined };
                            tmp.x = player.x3 + 80 * Math.cos(nearHacker.aim3);
                            tmp.y = player.y3 + 80 * Math.sin(nearHacker.aim3);
                            let trapScale = 10;
                            if (UWUTILS.getDist(tmp, nearHacker, 0, 3) <= 45) {
                                if (!checkPlace(4, nearHacker.aim2)) {
                                    for (let i = 0; i < 5; i++) {
                                        const magnitude = ((i + 1) >> 1) * 10; // same as Math.ceil(i / 2) * 6
                                        const ayochilltfoutyo = i === 0 ? 0 : (i % 2 === 1 ? -magnitude : magnitude);
                                        const randomAngle = nearHacker.aim3 + UWUTILS.toRad(ayochilltfoutyo);
                                        if (checkCanPlace(4, randomAngle) && Math.hypot(nearHacker.x2 - (player.x3 + 80 * Math.cos(randomAngle)), nearHacker.y2 - (player.y3 + 80 * Math.sin(randomAngle))) <= 45) {
                                            placedTrap = true;
                                            checkPlace(4, randomAngle);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        if (!placedTrap) {
                            if (nearHacker.dist2 <= ((player.items[4] && player.items[4] == 16) ? 130 : 100) || nearHacker.dist3 <= ((player.items[4] && player.items[4] == 16) ? 115 : 95)) {
                                checkPlace(2, nearHacker.aim2 + Math.PI + Math.random() * 0.4 - 0.2);
                                checkPlace(2, nearHacker.aim2 - Math.PI / 3 + Math.random() * 0.4 - 0.2);
                                checkPlace(2, nearHacker.aim2 + Math.PI / 3 + Math.random() * 0.4 - 0.2);
                            } else if (nearHacker.dist2 <= 150 || nearHacker.dist3 <= 130) {
                                checkPlace(2, nearHacker.aim2 - Math.PI / 0.75 + Math.random() * 0.4 - 0.2);
                                checkPlace(2, nearHacker.aim2 + Math.PI / 0.75 + Math.random() * 0.4 - 0.2);
                                !macro.f && (configs.autoBoost || player.items[4] == 15) && checkPlace(4, nearHacker.aim2 + Math.random() * 0.5 - 0.25);
                            } else if (!macro.f && nearHacker.dist3 <= (config.isSandbox ? 400 : configs.chasePlacer ? 140 : 190) && player.items[4] && player.items[4] == 15) {
                                checkPlace(4, nearHacker.aim2 + Math.random() * 2 - 1);
                            } else if (!configs.chasePlacer && nearHacker.dist2 <= (config.isSandbox ? 600 : 250) && player.items[4] && player.items[4] == 15) {
                                !macro.f && checkPlace(4, nearHacker.aim2 - Math.PI / 3 + Math.random() * 0.5 - 0.25);
                                !macro.f && checkPlace(4, nearHacker.aim2 + Math.PI / 3 + Math.random() * 0.5 - 0.25)
                            }
                        }
                    }
                }
            } else if (configs.safeAutoPlace && !boostSpike) {
                if (
                    (configs.safeAutoPlaceLegits ? near.sid : nearHacker.sid) &&
                    player.items[4] == 15
                ) {
                    let tmpPlayer = configs.safeAutoPlaceLegits ? near : nearHacker;
                    let item = items.list[15];
                    let tmp = { x: undefined, y: undefined };
                    tmp.x = player.x3 + 80 * Math.cos(tmpPlayer.aim3);
                    tmp.y = player.y3 + 80 * Math.sin(tmpPlayer.aim3);
                    if (UWUTILS.getDist(tmp, tmpPlayer, 0, 3) <= 45) {
                        if (checkCanPlace(4, tmpPlayer.aim2)) {
                            checkPlace(4, tmpPlayer.aim2);
                        } else {
                            for (let i = 0; i < 5; i++) {
                                const magnitude = ((i + 1) >> 1) * 6; // same as Math.ceil(i / 2) * 6
                                const ayochilltfoutyo = i === 0 ? 0 : (i % 2 === 1 ? -magnitude : magnitude);
                                const randomAngle = nearHacker.aim3 + UWUTILS.toRad(ayochilltfoutyo);
                                if (
                                    checkCanPlace(4, randomAngle) &&
                                    Math.hypot(
                                        tmpPlayer.x2 - (player.x2 + 80 * Math.cos(randomAngle)),
                                        tmpPlayer.y2 - (player.y2 + 80 * Math.sin(randomAngle))
                                    ) <= 45
                                ) {
                                    checkPlace(4, randomAngle);
                                    break;
                                }
                            }
                        }
                    }
                } else if (nearHacker.dist2 && nearHacker.dist2 <= 90) {
                    if (
                        checkCanPlace(2, nearHacker.aim2 + Math.PI) &&
                        checkCanPlace(2, nearHacker.aim2 + Math.PI + Math.PI / 1.5) &&
                        checkCanPlace(2, nearHacker.aim2 + Math.PI + Math.PI / 1.5)
                    ) {
                        checkPlace(2, nearHacker.aim2 + Math.PI);
                        checkPlace(2, nearHacker.aim2 + Math.PI + Math.PI / 1.5);
                        checkPlace(2, nearHacker.aim2 + Math.PI - Math.PI / 1.5);
                    } else {
                        checkPlace(2, nearHacker.aim2);
                        checkPlace(2, nearHacker.aim2 + Math.PI / 1.5);
                        checkPlace(2, nearHacker.aim2 - Math.PI / 1.5);
                    }
                }
            }
        };

        function calculatePerfectAngle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        this.testCanPlace = function(id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, replacer, ignoreObj = [], yaboi) {
            try {
                let item = items.list[player.items[id]];
                let tmpS = 35 + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0
                };
                let tmpObjects = [];
                for (let i = 0;i < liztobj.length;i++) {
                    let p = liztobj[i];
                    tmpObjects.push({
                        x: p.x,
                        y: p.y,
                        active: p.active,
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function(sM, ig) {
                            sM = sM || 1;
                            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                                 ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                        },
                    });
                };
                for (let i = first; i < repeat; i += plus) {
                    counts.attempts++;
                    let relAim = radian + i;
                    let tmpX = player[replacer ? "x3" : "x2"] + tmpS * Math.cos(relAim);
                    let tmpY = player[replacer ? "y3" : "y2"] + tmpS * Math.sin(relAim);
                    let cantPlace = tmpObjects.find2((tmp) => tmp.sid != ignoreObj.sid && tmp.active && UWUTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                    if (cantPlace) {
                        console.log("cant place")
                        continue;
                    }
                    if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                    if ((!replacer && yaboi)) {
                        if (yaboi.inTrap) {
                            if (UWUTILS.getAngleDist(nearHacker.aim3 + Math.PI, relAim + Math.PI) <= Math.PI*1.3) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        } else {
                            if (UWUTILS.getAngleDist(nearHacker.aim3, relAim) <= Math.PI / 2.6) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        }
                    } else {
                        console.log("place")
                        place(id, relAim, 1);
                    }
                    tmpObjects.push({
                        x: tmpX,
                        y: tmpY,
                        active: true,
                        blocker: item.blocker,
                        scale: item.scale,
                        isItem: true,
                        type: null,
                        colDiv: item.colDiv,
                        getScale: function() {
                            return this.scale;
                        },
                    });
                    if (UWUTILS.getDist(nearHacker, {x: tmpX, y: tmpY}, 3, 0) <= 87) {
                        counts.placed++;
                    }
                }
                if (counts.placed > 0 && replacer && item.dmg && evil) {
                    if (nearHacker.dist2 <= player.primary.range + 63 && configs.zpyklerTick) {
                        instaC.wantZpyklerTick = true;
                    }
                }
            } catch (err) {
                console.log(err)
            }
        };
        this.checkPerfAngle = function (findObj = [], returnDir, pre) {
            const item = items.list[player.items[evil ? 2 : 1]];
            const angle = UWUTILS.getDirect(nearHacker, nearHacker.inTrap, 2, 0);
            const perfectPlace = {
                x: nearHacker.inTrap.x + Math.cos(angle) * (35 + item.scale),
                y: nearHacker.inTrap.y + Math.sin(angle) * (35 + item.scale),
            };
            const bestSpikeAngle = UWUTILS.getDirect(perfectPlace, player, 0, 2);
            const tmpS = 35 + item.scale + (item.placeOffset ?? 0);
            const playerX = player[pre ? "x3" : "x2"]
            const playerY = player[pre ? "y3" : "y2"]
            const tmpX = playerX + tmpS * Math.cos(bestSpikeAngle);
            const tmpY = playerY + tmpS * Math.sin(bestSpikeAngle);
            const dist = UWUTILS.getDistance(tmpX, tmpY, nearHacker.x3, nearHacker.y3);
            if (
                checkCanPrePlace(2, bestSpikeAngle, findObj) &&
                dist <
                item.scale + 35
            ) {
                if (!returnDir) {
                    if (player.primaryIndex != 8) revHit(nearHacker.aim3);
                    place(2, bestSpikeAngle);
                    return true;
                } else {
                    return bestSpikeAngle;
                }
            } else {
                for (let i = 0; i < 15; i++) {
                    const magnitude = ((i + 1) >> 1) * 7; // same as Math.ceil(i / 2) * 6
                    const ayochilltfoutyo = i === 0 ? 0 : (i % 2 === 1 ? -magnitude : magnitude);
                    const randomAngle = nearHacker.aim3 + UWUTILS.toRad(ayochilltfoutyo);
                    const tmpX2 = playerX + tmpS * Math.cos(randomAngle);
                    const tmpY2 = playerY + tmpS * Math.sin(randomAngle);
                    const dist2 = UWUTILS.getDistance(tmpX2, tmpY2, nearHacker.x2, nearHacker.y2);
                    if (
                        checkCanPrePlace(2, randomAngle, findObj) &&
                        dist2 < item.scale + 35
                    ) {
                        if (!returnDir) {
                            if (player.primaryIndex != 8) revHit(nearHacker.aim2);
                            place(2, randomAngle);
                            return true;
                        } else {
                            return randomAngle;
                        }
                    }
                }
            }
            return false;
        };
        this.replacer = function (findObj) {
            console.log(placeSpike, findObj, noPlacers, inGame, configs.autoReplace)
            if (!findObj || noPlacers || placeSpike || !inGame || game.tick - findObj.preplaced <= 1) return;
            if (nearHacker.dist2 <= 350) {
                console.log("close")
                const danger = this.checkZpyklerTick(0, findObj, 1);
                const objAim = UWUTILS.getDirect(findObj, player, 0, 2);
                const objDst = UWUTILS.getDist(findObj, player, 0, 2);
                if (configs.autoGrind) return;
                if (objDst <= 300 && nearHacker.dist2 <= 300) {
                    if (nearHacker.trapped && this.checkPerfAngle(findObj, false, true)) return;
                    const itemZpyke = items.list[player.items[evil ? 2 : 1]];
                    const tmpSZpyke = itemZpyke.scale + 30;
                    const isTrap = nearHacker.trapInfo2 && findObj.sid == nearHacker.trapInfo2.sid;
                    if (nearHacker.dist3 <= tmpSZpyke + 40) {
                        if (isTrap) {
                            console.log("trapped")
                            const dx = nearHacker.x2 - player.x;
                            const dy = nearHacker.y2 - player.y;
                            const dist = Math.hypot(dx, dy); // or Math.sqrt(dx*dx + dy*dy)
                            const radius = 35 + itemZpyke.scale;
                            const angleDiffEdge = Math.asin(radius / dist);
                            const breakup = partitionzion(liztobj, e => (e.dmg || e.trap) && !e.isTeamObject(nearHacker) && e.active || e.type == 1 && e.y >= 12000);
                            const ouchies = breakup[0];
                            const step = .375;
                            const maxOffset = Math.min(angleDiffEdge + .25, 3);
                            let indx = 0;
                            while (indx * step / 2 <= maxOffset) {
                                const jump = indx === 0 ? 0 : ((indx % 2 === 1 ? -1 : 1) * Math.ceil(indx / 2) * step);
                                const randomAngle = nearHacker.aim3 + jump;
                                indx++;
                                if (!checkCanPrePlace(2, randomAngle, findObj, 1, 1)) continue;
                                const placePos = {x: player.x3 + tmpSZpyke * Math.cos(randomAngle), y: player.y3 + tmpSZpyke * Math.sin(randomAngle)}
                                if (UWUTILS.getDist(placePos, nearHacker, 0, 3) > radius + 5) continue;
                                const bounceDirection = UWUTILS.getDirect(nearHacker, placePos, 2, 0);
                                if (UWUTILS.checkLineCollision(bounceDirection, nearHacker, breakup[1], 30, 1, 40)) continue;
                                const bouncePos = {x: nearHacker.x4 + 45 * Math.cos(bounceDirection), y: nearHacker.y4 + 45 * Math.sin(bounceDirection)};
                                if (ouchies.find2((e) => UWUTILS.getDist(e, bouncePos, 0, 0) <= e.realScale + 35)) {
                                    /*const newBouncePos = {x: nearHacker.x4 + Math.cos(bounceDirection + Math.PI) * 40, y: nearHacker.y4 + Math.sin(bounceDirection + Math.PI) * 40};
                                            if (ouchies.find2((b) => !hitSpike.some(h => h.sid === b.sid) && UWUTILS.getDist(newBouncePos, b) <= b.scale + 45)) {*/
                                    selectToBuild(2);
                                    sendAtck2(1, randomAngle + Math.random() * 0.125 - .0625);
                                    sendAtck2(1, randomAngle + Math.random() * 0.25 - 0.125);
                                    sendAtck2(1, randomAngle + Math.random() * 0.375 - 0.1875);
                                    const item = items.list[player.items[2]];
                                    const tmpS = 35 + item.scale + (item.placeOffset || 0);
                                    const tmpX = player.x2 + tmpS * Math.cos(randomAngle);
                                    const tmpY = player.y2 + tmpS * Math.sin(randomAngle);
                                    let len = placeVisible.length;
                                    placeVisible.push({
                                        id: len,
                                        x: tmpX,
                                        y: tmpY,
                                        name: item.name,
                                        scale: item.scale,
                                        dir: randomAngle + Math.PI / 2,
                                        owner: {sid: player.sid}
                                    });
                                    game.tickBase(() => {
                                        placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                                    }, 1)
                                    if (!danger) hitBull(nearHacker.aim3, 1)
                                    return;
                                    //}
                                }
                            }
                            if (findObj.sid == nearHacker?.trapInfo2?.sid && !danger) {
                                console.log("spiketick")
                                const aim = nearHacker.aim3;
                                if (checkCanPrePlace(2, aim, 1, 1) && [4, 5].includes(player.primaryIndex)) {
                                    instaC.isTrue = true;
                                    selectWeapon(player.weapon[0])
                                    selectToBuild(2);
                                    buyEquip(7, 0)
                                    sendAtck2(1, objAim + Math.random() * 0.125 - .0625);
                                    sendAtck2(1, objAim + Math.random() * 0.25 - 0.125);
                                    sendAtck2(1, objAim + Math.random() * 0.375 - 0.1875);
                                    const item = items.list[player.items[2]];
                                    const tmpS = 35 + item.scale + (item.placeOffset || 0);
                                    const tmpX = player.x2 + tmpS * Math.cos(objAim);
                                    const tmpY = player.y2 + tmpS * Math.sin(objAim);
                                    let len = placeVisible.length;
                                    placeVisible.push({
                                        id: len,
                                        x: tmpX,
                                        y: tmpY,
                                        name: item.name,
                                        scale: item.scale,
                                        dir: objAim + Math.PI / 2,
                                        owner: {sid: player.sid}
                                    });
                                    game.tickBase(() => {
                                        placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                                    }, 1)
                                    game.tickBase(() => {
                                        instaC.isTrue = false;
                                    }, 2);
                                    return;
                                }
                            }
                            if (player.items[4] == 15 && nearHacker.dist3 <= 125) {
                                console.log("retrap")
                                if (!danger && UWUTILS.getAngleDist(nearHacker.aim3 + Math.PI, nearHacker.trapAim) <= config.gatherAngle && nearHacker.dist3 > 95) {
                                    packet("9", nearHacker.aim3, "retrap")
                                    noMove = true;
                                    game.tickBase(() => {
                                        noMove = false;
                                    }, 2);
                                }
                                let tmp = { x: undefined, y: undefined };
                                tmp.x = player.x3 + 80 * Math.cos(nearHacker.aim3);
                                tmp.y = player.y3 + 80 * Math.sin(nearHacker.aim3);
                                if (UWUTILS.getDist(tmp, nearHacker, 0, 3) <= 45) {
                                    if (!checkPreplace(4, nearHacker.aim3, findObj, 1)) {
                                        for (let i = 0; i < 11; i++) {
                                            const magnitude = ((i + 1) >> 1) * 6; // same as Math.ceil(i / 2) * 6
                                            const ayochilltfoutyo = i === 0 ? 0 : (i % 2 === 1 ? -magnitude : magnitude);
                                            const randomAngle = nearHacker.aim3 + UWUTILS.toRad(ayochilltfoutyo);
                                            if (checkCanPrePlace(4, randomAngle, findObj, 0, 1)) {
                                                placedTrap = true;
                                                checkPreplace(4, nearHacker.aim3, findObj, 1)
                                                player.chat.message = "Retrap";
                                                player.chat.count = 600;
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        } else console.log(nearHacker.trapInfo2, nearHacker.trapClear, findObj)
                    }
                    if (!macro.v && macro.f) {
                        this.testCanPlace(4, -(Math.PI / 3), Math.PI / 3, Math.PI / 12, objAim, 1, findObj);
                        const tmpX = player.x2 + 80 * Math.cos(objAim);
                        const tmpY = player.y2 + 80 * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: "pit trap",
                            scale: 50,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    } else if (nearHacker.dist2 <= 200 && (player.items[4] === 16 || UWUTILS.getAngleDist(objAim, nearHacker.aim2) > Math.PI / 1.75)) {
                        console.log("spike")
                        this.testCanPlace(
                            2,
                            -(Math.PI / 3),
                            Math.PI / 3,
                            Math.PI / 12,
                            objAim,
                            1,
                            findObj
                        );
                        const item = items.list[player.items[2]];
                        const tmpS = 35 + item.scale + (item.placeOffset || 0);
                        const tmpX = player.x2 + tmpS * Math.cos(objAim);
                        const tmpY = player.y2 + tmpS * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: item.name,
                            scale: item.scale,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    } else if (macro.v && !macro.f) {
                        this.testCanPlace(2, -(Math.PI / 3), Math.PI / 3, Math.PI / 12, objAim, 1, findObj);
                        const item = items.list[player.items[2]];
                        const tmpS = 35 + item.scale + (item.placeOffset || 0);
                        const tmpX = player.x2 + tmpS * Math.cos(objAim);
                        const tmpY = player.y2 + tmpS * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: item.name,
                            scale: item.scale,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    } else if (player.items[4] == 15) {
                        console.log("trap", objAim)
                        this.testCanPlace(
                            4,
                            -(Math.PI / 3),
                            Math.PI / 3,
                            Math.PI / 12,
                            objAim,
                            1,
                            findObj
                        );
                        const tmpX = player.x2 + 80 * Math.cos(objAim);
                        const tmpY = player.y2 + 80 * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: "pit trap",
                            scale: 50,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    }
                }
            }
        };
        this.preplacer = function(findObj) {
            console.log(placeSpike, findObj, noPlacers, inGame, configs.autoReplace)
            if (!findObj || noPlacers || placeSpike || !inGame) return;
            if (nearHacker.dist2 <= 350) {
                console.log("close")
                const danger = this.checkZpyklerTick(0, findObj, 1);
                const objAim = UWUTILS.getDirect(findObj, player, 0, 2);
                const objDst = UWUTILS.getDist(findObj, player, 0, 2);
                if (configs.autoGrind) return;
                if (objDst <= 300 && nearHacker.dist2 <= 300) {
                    if (nearHacker.trapped && this.checkPerfAngle(findObj, false, true)) return;
                    const itemZpyke = items.list[player.items[evil ? 2 : 1]];
                    const tmpSZpyke = itemZpyke.scale + 30;
                    const isTrap = nearHacker.trapInfo2 && findObj.sid == nearHacker.trapInfo2.sid;
                    if (nearHacker.dist3 <= tmpSZpyke + 40) {
                        if (isTrap) {
                            console.log("trapped")
                            const dx = nearHacker.x2 - player.x;
                            const dy = nearHacker.y2 - player.y;
                            const dist = Math.hypot(dx, dy); // or Math.sqrt(dx*dx + dy*dy)
                            const radius = 35 + itemZpyke.scale;
                            const angleDiffEdge = Math.asin(radius / dist);
                            const breakup = partitionzion(liztobj, e => (e.dmg || e.trap) && !e.isTeamObject(nearHacker) && e.active || e.type == 1 && e.y >= 12000);
                            const ouchies = breakup[0];
                            const step = .375;
                            const maxOffset = Math.min(angleDiffEdge + .25, 3);
                            let indx = 0;
                            while (indx * step / 2 <= maxOffset) {
                                const jump = indx === 0 ? 0 : ((indx % 2 === 1 ? -1 : 1) * Math.ceil(indx / 2) * step);
                                const randomAngle = nearHacker.aim3 + jump;
                                indx++;
                                if (!checkCanPrePlace(2, randomAngle, findObj, 1, 1)) continue;
                                const placePos = {x: player.x3 + tmpSZpyke * Math.cos(randomAngle), y: player.y3 + tmpSZpyke * Math.sin(randomAngle)}
                                if (UWUTILS.getDist(placePos, nearHacker, 0, 3) > radius + 5) continue;
                                const bounceDirection = UWUTILS.getDirect(nearHacker, placePos, 2, 0);
                                if (UWUTILS.checkLineCollision(bounceDirection, nearHacker, breakup[1], 30, 1, 40)) continue;
                                const bouncePos = {x: nearHacker.x4 + 45 * Math.cos(bounceDirection), y: nearHacker.y4 + 45 * Math.sin(bounceDirection)};
                                if (ouchies.find2((e) => UWUTILS.getDist(e, bouncePos, 0, 0) <= e.realScale + 35)) {
                                    /*const newBouncePos = {x: nearHacker.x4 + Math.cos(bounceDirection + Math.PI) * 40, y: nearHacker.y4 + Math.sin(bounceDirection + Math.PI) * 40};
                                            if (ouchies.find2((b) => !hitSpike.some(h => h.sid === b.sid) && UWUTILS.getDist(newBouncePos, b) <= b.scale + 45)) {*/
                                    findObj.preplaced = game.tick;
                                    setTimeout(()  => {
                                        selectWeapon(player.weapon[0])
                                        chainPlace(2, nearHacker.aim3, secPacket < 25 ? 8 : secPacket < 35 ? 6 : 3, 9, 2, 0.3, !danger);
                                    }, customDelay - window.pingTime - 7)
                                    const item = items.list[player.items[2]];
                                    const tmpS = 35 + item.scale + (item.placeOffset || 0);
                                    const tmpX = player.x2 + tmpS * Math.cos(randomAngle);
                                    const tmpY = player.y2 + tmpS * Math.sin(randomAngle);
                                    let len = placeVisible.length;
                                    placeVisible.push({
                                        id: len,
                                        x: tmpX,
                                        y: tmpY,
                                        name: item.name,
                                        scale: item.scale,
                                        dir: randomAngle + Math.PI / 2,
                                        owner: {sid: player.sid}
                                    });
                                    game.tickBase(() => {
                                        placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                                    }, 1)
                                    if (!danger) hitBull(nearHacker.aim3, 1)
                                    return;
                                    //}
                                }
                            }
                            if (findObj.sid == nearHacker?.trapInfo2?.sid && !danger) {
                                console.log("spiketick")
                                const aim = nearHacker.aim3;
                                if (checkCanPrePlace(2, aim, 1, 1) && [4, 5].includes(player.primaryIndex)) {
                                    instaC.isTrue = true;
                                    findObj.preplaced = game.tick;
                                    setTimeout(() => {
                                        selectWeapon(player.weapon[0])
                                        chainPlace(2, nearHacker.aim3, secPacket < 25 ? 7 : secPacket < 35 ? 5 : 2, 10, obj, 0.3, !danger);
                                    }, customDelay - window.pingTime - 7)
                                    const item = items.list[player.items[2]];
                                    const tmpS = 35 + item.scale + (item.placeOffset || 0);
                                    const tmpX = player.x2 + tmpS * Math.cos(objAim);
                                    const tmpY = player.y2 + tmpS * Math.sin(objAim);
                                    let len = placeVisible.length;
                                    placeVisible.push({
                                        id: len,
                                        x: tmpX,
                                        y: tmpY,
                                        name: item.name,
                                        scale: item.scale,
                                        dir: objAim + Math.PI / 2,
                                        owner: {sid: player.sid}
                                    });
                                    game.tickBase(() => {
                                        placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                                    }, 1)
                                    game.tickBase(() => {
                                        instaC.isTrue = false;
                                    }, 2);
                                    return;
                                }
                            }
                            if (player.items[4] == 15 && nearHacker.dist3 <= 125) {
                                console.log("retrap")
                                if (!danger && UWUTILS.getAngleDist(nearHacker.aim3 + Math.PI, nearHacker.trapAim) <= config.gatherAngle && nearHacker.dist3 > 95) {
                                    packet("9", nearHacker.aim3, "retrap")
                                    noMove = true;
                                    game.tickBase(() => {
                                        noMove = false;
                                    }, 2);
                                }
                                let tmp = { x: undefined, y: undefined };
                                tmp.x = player.x3 + 80 * Math.cos(nearHacker.aim3);
                                tmp.y = player.y3 + 80 * Math.sin(nearHacker.aim3);
                                if (UWUTILS.getDist(tmp, nearHacker, 0, 3) <= 45) {
                                    if (!checkCanPrePlace(4, nearHacker.aim3, findObj, 1)) {
                                        for (let i = 0; i < 11; i++) {
                                            const magnitude = ((i + 1) >> 1) * 6; // same as Math.ceil(i / 2) * 6
                                            const ayochilltfoutyo = i === 0 ? 0 : (i % 2 === 1 ? -magnitude : magnitude);
                                            const randomAngle = nearHacker.aim3 + UWUTILS.toRad(ayochilltfoutyo);
                                            if (checkCanPrePlace(4, randomAngle, findObj, 0, 1)) {
                                                placedTrap = true;
                                                findObj.preplaced = game.tick;
                                                setTimeout(() => {
                                                    chainPlace(4, nearHacker.aim3, secPacket < 25 ? 7 : secPacket < 35 ? 6 : 4, 10, obj, 0.3);
                                                }, customDelay - window.pingTime - 7)
                                                player.chat.message = "Retrap";
                                                player.chat.count = 600;
                                                return;
                                            }
                                        }
                                    } else {
                                        findObj.preplaced = game.tick;
                                        setTimeout(() => {
                                            chainPlace(4, nearHacker.aim3, secPacket < 25 ? 7 : secPacket < 35 ? 6 : 4, 10, obj, 0.3);
                                        }, customDelay - window.pingTime - 7)
                                    }
                                }
                            }
                        } else console.log(nearHacker.trapInfo2, nearHacker.trapClear, findObj)
                    }
                    if (!macro.v && macro.f) {
                        findObj.preplaced = game.tick;
                        setTimeout(() => {
                            chainPlace(4, nearHacker.aim3, secPacket < 25 ? 6 : secPacket < 35 ? 5 : 3, 10, obj, 0.3);
                        }, customDelay - window.pingTime - 7)
                        const tmpX = player.x2 + 80 * Math.cos(objAim);
                        const tmpY = player.y2 + 80 * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: "pit trap",
                            scale: 50,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    } else if (macro.v && !macro.f) {
                        findObj.preplaced = game.tick;
                        setTimeout(() => {
                            chainPlace(2, nearHacker.aim3, secPacket < 25 ? 6 : secPacket < 35 ? 5 : 3, 10, obj, 0.3, !danger);
                        }, customDelay - window.pingTime - 7)
                        const item = items.list[player.items[2]];
                        const tmpS = 35 + item.scale + (item.placeOffset || 0);
                        const tmpX = player.x2 + tmpS * Math.cos(objAim);
                        const tmpY = player.y2 + tmpS * Math.sin(objAim);
                        let len = placeVisible.length;
                        placeVisible.push({
                            id: len,
                            x: tmpX,
                            y: tmpY,
                            name: item.name,
                            scale: item.scale,
                            dir: objAim + Math.PI / 2,
                            owner: {sid: player.sid}
                        });
                        game.tickBase(() => {
                            placeVisible.splice(placeVisible.findIndex((e) => e.id == len));
                        }, 1)
                    }
                }
            }
        };
    }
}
class Instakill {
    constructor() {
        if (secPacket > 60) return;
        this.shameHacker = false;
        this.can = false;
        this.isTrue = false;
        this.nobull = false;
        this.wantZpyklerTick = false;
        this.ticking = false;
        this.canZpykeTick = false;
        this.startTick = false;
        this.readyTick = false;
        this.canCounter = false;
        this.syncHit = false;
        this.changeType = function (type) {
            waitInsta = false;
            this.isTrue = true;
            if (type === "antiHack") {
                buyEquip(53, 0);
                game.tickBase(() => {
                    my.autoAim = 2;
                    selectWeapon(5);
                    buyEquip(7, 0);
                    sendAutoGather(2);
                    game.tickBase(() => {
                        selectWeapon(15);
                        game.tickBase(() => {
                            this.isTrue = false;
                        }, 1);
                    }, 1);
                }, 1);
            } else if (type === "rev") {
                let antiBullTrue = configs.antiBull;
                my.autoAim = 2;
                selectWeapon(player.secondaryIndex);
                buyEquip(53, 0);
                buyEquip(antiBullTrue ? 21 : 19, 1);
                sendAutoGather(2);
                game.tickBase(() => {
                    if (nearHacker.dist2 <= 140 && configs.doSpikeOnReverse)
                        checkPlace(2, getAttackDir());
                    selectWeapon(player.primaryIndex);
                    buyEquip(7, 0);
                    game.tickBase(() => {
                        this.isTrue = false;
                    }, 1);
                }, 1);
            } else {
                this.isTrue = true;
                selectWeapon(player.primaryIndex);
                noWep = true;
                my.autoAim = 2;
                buyEquip(7, 0);
                sendAutoGather(2);
                game.tickBase(() => {
                    selectWeapon(player.secondaryIndex, 0, 1);
                    if (player.turretReload === 0) buyEquip(53, 0);
                    buyEquip(19, 1);
                    game.tickBase(() => {
                        noWep = false;
                        this.isTrue = false;
                    }, 1);
                }, 1);
            }
        };
        this.zpyklerTickType = function (turr) {
            if (trapClear && evil) {
                if (!turr) {
                    player.chat.message = "Spiketick";
                    player.chat.count = 500;
                    let antiBullTrue = configs.antiBull;
                    this.isTrue = true;
                    my.autoAim = 2;
                    selectWeapon(player.primaryIndex);
                    buyEquip(traps.checkZpyklerTick() ? 6 : 7, 0);
                    sendAutoGather(1);
                    game.tickBase(() => {
                        this.isTrue = false;
                    }, 1);
                } else {
                    player.chat.message = "Spiketick (Turret)";
                    player.chat.count = 500;
                    let antiBullTrue = configs.antiBull;
                    this.isTrue = true;
                    my.autoAim = 2;
                    selectWeapon(player.primaryIndex);
                    buyEquip(traps.checkZpyklerTick() ? 6 : 7, 0);
                    sendAutoGather(1);
                    game.tickBase(() => {
                        buyEquip(53, 0);
                        game.tickBase(() => {
                            this.isTrue = false;
                        }, 1);
                    }, 1);
                }
            } else {
                return;
            }
        };
        this.counterType = function () {
            player.chat.message = "Counter";
            player.chat.count = 500;
            this.isTrue = true;
            my.autoAim = 2;
            selectWeapon(player.primaryIndex);
            buyEquip(7, 0);
            sendAutoGather(1);
            game.tickBase(() => {
                selectWeapon(player.primaryIndex);
                buyEquip(53, 0);
                game.tickBase(() => {
                    this.isTrue = false;
                }, 1);
            }, 1);
        };
        function Hg(hat, acc) {
            buyEquip(hat, 0);
            buyEquip(acc, 1);
        }
        this.syncTry = function (syncType = "sec", time = 2) {
            setTimeout(() => {
                if (syncType == "sec") {
                    if (player.secondaryIndex == 15) {
                        packet("D", near.aim2, 1, "syncTry");
                        this.isTrue = true;
                        my.autoAim = 2;
                        selectWeapon(player.secondaryIndex);
                        if (
                            player.turretReload == 0 &&
                            near.dist2 <= 700 &&
                            near.skinIndex != 22
                        ) {
                            Hg(53, 19);
                        } else {
                            Hg(20, 19);
                        }
                        2;
                        sendAutoGather(1);
                        game.tickBase(() => {
                            this.isTrue = false;
                        }, 2);
                    }
                }
            }, time);
        };
        this.rangeType = function (type) {
            let antiBullTrue = configs.antiBull;
            this.isTrue = true;
            if (type == "ageInsta") {
                my.ageInsta = false;
                my.autoAim = 5;
                checkPlace(player.getItemType(22), nearHacker.aim2);
                checkPlace(player.getItemType(22), nearHacker.aim2 + Math.PI);
                packet("9", undefined, 1, "rangeType");
                game.tickBase(() => {
                    selectWeapon(player.secondaryIndex);
                    buyEquip(53, 0);
                    buyEquip(antiBullTrue ? 21 : 19, 1);
                    sendAutoGather(5);
                    game.tickBase(() => {
                        sendUpgrade(12);
                        selectWeapon(player.secondaryIndex);
                        buyEquip(53, 0);
                        buyEquip(antiBullTrue ? 21 : 19, 1);
                        game.tickBase(() => {
                            sendUpgrade(15);
                            selectWeapon(player.secondaryIndex);
                            buyEquip(53, 0);
                            buyEquip(antiBullTrue ? 21 : 19, 1);
                            game.tickBase(() => {
                                this.isTrue = false;
                            }, 1);
                        }, 1);
                    }, 1);
                }, 1);
            } else {
                my.autoAim = 2;
                selectWeapon(player.secondaryIndex);
                if (
                    player.turretReload == 0 &&
                    nearHacker.dist2 <= 700 &&
                    nearHacker.skinIndex != 22
                ) {
                    buyEquip(53, 0);
                } else {
                    buyEquip(20, 0);
                }
                buyEquip(11, 1);
                sendAutoGather(1);
                game.tickBase(() => {
                    this.isTrue = false;
                }, 1);
            }
        };
        this.boostTickType = function (type) {
            if (instaC.isTrue || traps.in || player.items[4] != 16 || player.turretReload > 0 || player.secondaryReload > 0 || player.primaryReload > 0) return;
            this.isTrue = true;
            const savedPos = {x: player.x2, y: player.y2};
            let nextDist = UWUTILS.getDist(nearHacker, player, 3, 2);
            let dir = nearHacker.aim4;
            let shot = false;
            let tG = false;
            if (type == "boost1") {
                packet("9", dir, 1, "boosttick");
                buyEquip(12, 0);
                console.log(my.noAim, noMove, player.weaponIndex)
                console.log(nearHacker.x2, nearHacker.x3, nearHacker.x4)
                my.noAim = true;
                noMove = true;
                console.log(game.tick)
                game.tickBase(() => {
                    my.noAim = false;
                    selectToBuild(16);
                    sendAtck2(1, dir);
                    console.log(my.anti0tick)
                    buyEquip(53, 0);
                    selectWeapon(player.secondaryIndex);
                    sendAutoGather(4);
                    my.noAim = true;
                    console.log(game.tick)
                    game.tickBase(() => {
                        packet("9", dir, 1, "boosttick");
                        console.log(game.tick, "Dist:", UWUTILS.getDist(savedPos, player, 0, 2), tG, shot)
                        selectWeapon(player.primaryIndex);
                        buyEquip(7, 0);
                        game.tickBase(() => {
                            this.isTrue = false;
                            noMove = false;
                            my.noAim = false;
                        }, 1);
                    }, 1);
                }, 1);
            } else if (type == "boost2") {
                packet("9", dir, 1, "boosttick");
                buyEquip(53, 0);
                console.log(my.noAim, noMove, player.weaponIndex)
                console.log(nearHacker.x2, nearHacker.x3, nearHacker.x4)
                selectToBuild(16);
                sendAtck2(1, dir);
                my.noAim = true;
                noMove = true;
                console.log(game.tick)
                game.tickBase(() => {
                    my.noAim = false;
                    console.log(my.anti0tick)
                    buyEquip(12, 0);
                    selectWeapon(player.secondaryIndex);
                    sendAutoGather(4);
                    my.noAim = true;
                    console.log(game.tick)
                    game.tickBase(() => {
                        packet("9", dir, 1, "boosttick");
                        console.log(game.tick, "Dist:", UWUTILS.getDist(savedPos, player, 0, 2), tG, shot)
                        selectWeapon(player.primaryIndex);
                        buyEquip(7, 0);
                        game.tickBase(() => {
                            this.isTrue = false;
                            noMove = false;
                            my.noAim = false;
                        }, 1);
                    }, 1);
                }, 1);
            } else if (type == "instant") {
                packet("9", dir, 1, "boosttick");
                buyEquip(53, 0);
                console.log(my.noAim, noMove, player.weaponIndex)
                console.log(nearHacker.x2, nearHacker.x3, nearHacker.x4)
                selectToBuild(16);
                sendAtck2(1, dir);
                selectWeapon(player.secondaryIndex);
                sendAutoGather(4);
                my.noAim = true;
                noMove = true;
                console.log(game.tick)
                game.tickBase(() => {
                    console.log(my.anti0tick)
                    buyEquip(7, 0);
                    selectWeapon(player.primaryIndex);
                    console.log(game.tick, "Dist:", UWUTILS.getDist(savedPos, player, 0, 2), tG, shot)
                    game.tickBase(() => {
                        this.isTrue = false;
                        noMove = false;
                        my.noAim = false;
                    }, 1);
                }, 1);
            }
        };
        /** wait 1 tick for better quality */
        (this.bowMovement = function () {
            console.log("bowmovement")
            let moveMent = this.gotoGoal(685, 3);
            if (moveMent.action) {
                if (player.turretReload == 0 && !this.isTrue) {
                    this.rangeType("ageInsta");
                } else {
                    packet("9", moveMent.dir, 1, "bowMovement");
                }
            } else {
                packet("9", moveMent.dir, 1, "bowMovement");
            }
        }),
            (this.tickMovement = function () {
            let dist = player.secondaryIndex == 9 ? 240 : 240;
            let actionDist =
                player.secondaryIndex == 9
            ? 2
            : player.secondaryIndex == 12
            ? 1.5
            : player.secondaryIndex == 13
            ? 1
            : player.secondaryIndex == 15
            ? 2
            : 3;
            let moveMent = this.gotoGoal(238, 3);
            if (moveMent.action) {
                if (player.turretReload == 0 && !this.isTrue) {
                } else {
                    packet("9", moveMent.dir, 1, "tickMovement");
                }
            } else {
                packet("9", moveMent.dir, 1, "tickMovement");
            }
        }),
            (this.boostTickMovement = function () {
            let dist =
                player.secondaryIndex == 9
            ? 367
            : player.secondaryIndex == 12
            ? 380
            : player.secondaryIndex == 13
            ? 367
            : player.secondaryIndex == 15
            ? 365
            : 370;
            if (!ticked && player.primaryIndex == 5) {
                const nHD5 = nearHacker.dist5;
                instaC.ticking = true;
                let aim = undefined;
                if (nearHacker.dist2 < 377.75) {
                    aim = UWUTILS.getDirect(nearHacker, player, 3, 2) + Math.PI;
                } else {
                    aim = UWUTILS.getDirect(nearHacker, player, 3, 2);
                }
                if (nHD5 > 370 && nHD5 < 385.5) {
                    this.boostTickType("boost1");
                    ticked = true;
                    game.tickBase(() => {
                        ticked = false;
                    }, 5);
                } else if (nearHacker.dist2 > 367 && nearHacker.dist2 < 388) {
                    buyEquip(40, 0);
                    packet("9", aim, 1, "oneTicking");
                } else if (nearHacker.dist2 > 362 && nearHacker.dist2 < 393) {
                    if (player.buildIndex < 0) selectToBuild(player.items[1]);
                    packet("9", aim, 1, "oneTicking");
                } else {
                    buyEquip(22, 0);
                    packet("9", aim, 1, "oneTicking");
                }
            }
        });
        /** wait 1 tick for better quality */
        this.perfCheck = function (type) {
            const playerX = type >= 3 ? player.x3 : player.x2;
            const playerY = type >= 3 ? player.y3 : player.y2
            const nrX = type == 2 ? nearHacker.x2 : type == 3 ? nearHacker.x3 : nearHacker.x4;
            const nrY = type == 2 ? nearHacker.y2 : type == 3 ? nearHacker.y3 : nearHacker.y4;
            const dist = type == 3 ? nearHacker.dist3 : type == 2 ? nearHacker.dist2 : hypot(playerX - nrX, playerY - nrY)
            const angleWidth = UWUTILS.angleWidth(dist, 45);
            const nearAim = type == 3 ? nearHacker.aim3 : type == 2 ? nearHacker.aim2 : fastAtan2(playerY - nrY, playerX - nrX)
            const aim1 = nearAim + angleWidth;
            const aim2 = nearAim - angleWidth;
            const blockingObjects = [];
            const fullyBlockingObject = liztobj.filter2((e) => {
                if (!e.ignoreCollision) {
                    const w = UWUTILS.angleWidth(e.dist2, e.scale) * 1.2 + 0.5;
                    if (dAng(e.aim2, nearHacker.aim2) <= w) {
                        e.dist3 = hypot(e.x - playerX, e.y - playerY);
                        e.aim3 = fastAtan2(playerY - e.y, playerX - e.x);
                        blockingObjects.push(e);
                        e.w2 = UWUTILS.angleWidth(e.dist3, e.scale);
                        return dAng(e.aim2, aim1) - w2 <= 0 && dAng(e.aim2, aim2) - w2 <= 0
                    }
                }
                return false;
            });
            if (fullyBlockingObject.length) return null;
            let minAim = 4;
            let maxAim = -4;
            for (let i = 0;i < blockingObjects.length;i++) {
                const obj = blockingObjects[i];
                const direct = dAng2(nearAim, obj.aim3);
                const tmpWidth = e.w2;
                minAim = Math.min(direct - tmpWidth, minAim)
                maxAim = Math.max(direct + tmpWidth, maxAim)
            }
            if (maxAim != -4 && minAim != 4) {
                if (minAim >= maxAim) return null;
                return UWUTILS.getMidAngle(minAim, maxAim);
            } else {
                return "no objects";
            }
        };
    }
}
function renderRubyDmg(dlta, ctxt, xOff, yOff) {
    for (let i = 0; i < this.texts.length; ++i) {
        if (this.texts[i].life) {
            this.texts[i].update(dlta);
            this.texts[i].render(ctxt, xOff, yOff);
        }
    }
};
function hitBull(angle, turret) {
    if (!evil) return;
    if (evil) {
        let antiBullTrue = configs.antiBull;
        instaC.isTrue = true;
        if (angle == nearHacker.aim2) {
            my.autoAim = 2;
        } else {
            packet("D", angle, 1, "hitBull");
        }
        selectWeapon(player.primaryIndex);
        if (player.tailIndex == 11) {
            buyEquip(19, 1);
        } else {
            buyEquip(7, 0);
        }
        sendAutoGather(2);
        if (!turret) {
            game.tickBase(() => {
                instaC.isTrue = false;
            }, 1)
        } else {
            game.tickBase(() => {
                packet("D", angle, 1, "hitBull");
                buyEquip(53, 0);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1);
            }, 1);
        }
    }
}
function revHit(angle) {
    if (!evil) return;
    if (angle == undefined) my.autoAim = 2;
    instaC.isTrue = true;
    noHat = true;
    buyEquip(53, 0);
    game.tickBase(() => {
        if (UWUTILS.getAngleDist(angle - nearHacker.aim2) <= 0.5) {
            my.autoAim = 1;
        } else {
            packet("D", angle, 1, "hitBull");
        }
        selectWeapon(player.primaryIndex);
        buyEquip(7, 0);
        sendAutoGather(1);
        game.tickBase(() => {
            instaC.isTrue = false;
            noHat = false;
        }, 1)
    }, 1)
}
function hitTank(angle, weapon) {
    breakShit(angle, weapon, (weapon > 8) ? player.secondaryVariant : player.primaryVariant, 40)
    instaC.isTrue = true;
    packet("D", angle, 1, "hitBull");
    my.noAim = true;
    selectWeapon(weapon);
    buyEquip(40, 0);
    sendAutoGather(2);
    game.tickBase(() => {
        instaC.isTrue = false;
    }, 1)
    game.tickBase(() => {
        my.noAim = false;
    }, 1);
}
class Autobuy {
    constructor(buyHat, buyAcc) {
        this.accId = 0;
        this.hatId = 0;
        this.hat = function () {
            if (this.hatId >= buyHat.length) return;
            const id = buyHat[this.hatId];
            if (player.skins[id]) {
                this.hatId++;
            } else if (player.points >= findID(store.hats, id).price) {
                packet("c", 1, id, 0, "autoBuy");
                this.hatId++;
            }
        };
        this.acc = function () {
            if (this.accId >= buyAcc.length) return;
            const id = buyAcc[this.accId];
            if (player.tails[id]) {
                this.accId++;
            } else if (player.points >= findID(store.accessories, id).price) {
                packet("c", 1, id, 1, "autoBuy");
                this.accId++;
            }
        };
    }
}

class Autoupgrade {
    constructor() {
        this.sb = function (upg) {
            upg(3);
            upg(17);
            upg(31);
            upg(23);
            upg(9);
            upg(38);
        };
        this.kh = function (upg) {
            upg(3);
            upg(17);
            upg(31);
            upg(23);
            upg(10);
            upg(38);
            upg(4);
            upg(25);
        };
        this.pb = function (upg) {
            upg(5);
            upg(17);
            upg(32);
            upg(23);
            upg(9);
            upg(38);
        };
        this.ph = function (upg) {
            upg(5);
            upg(17);
            upg(32);
            upg(23);
            upg(10);
            upg(38);
            upg(28);
            upg(25);
        };
        this.db = function (upg) {
            upg(7);
            upg(17);
            upg(31);
            upg(23);
            upg(9);
            upg(34);
        };
        /* old functions */
        this.km = function (upg) {
            upg(7);
            upg(17);
            upg(31);
            upg(23);
            upg(10);
            upg(38);
            upg(4);
            upg(15);
        };
    }
}

class Damages {
    constructor(items) {
        // 0.75 1 1.125 1.5
        this.calcDmg = function (dmg, val) {
            return dmg * val;
        };
        this.getAllDamage = function (dmg) {
            return [
                this.calcDmg(dmg, 0.75),
                dmg,
                this.calcDmg(dmg, 1.125),
                this.calcDmg(dmg, 1.5),
            ];
        };
        this.getAllPDamage = function (dmg) {
            return [this.calcDmg(dmg, 0.75), dmg];
        };
        this.weapons = [];
        for (let i = 0; i < 16; i++) {
            let wp = items.weapons[i];
            let name =
                wp.name.split(" ").length <= 1
            ? wp.name
            : wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1];
            this.weapons.push(
                i > 8
                ? wp.Pdmg
                ? this.getAllPDamage(wp.Pdmg)
                : this.getAllDamage(wp.dmg)
                : this.getAllDamage(wp.dmg)
            );
            this[name] = this.weapons[i];
        }
    }
}

let greetings = false;

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) {
        return "Good Morning!";
    } else if (hour < 18) {
        return "Good Afternoon!";
    } else {
        return "Good Evening!";
    }
}

function greeting() {
    if (!greetings) {
        greetings = true;
        const frameMsg = Object.assign(document.createElement("div"), {
            innerHTML: `${getGreeting()}`,
            style: `
                    position: fixed;
                    top: -100px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 2rem;
                    color: white;
                    z-index: 9999;
                    opacity: 3;
                    transition: top 0.5s ease-in-out, opacity 0.5s ease-in-out;
                    padding: 10px;
                    background-color: rgba(0, 0, 0, 0.2);
                    border: 2px solid #0000;
                    border-radius: 5px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                `,
        });
        document.body.appendChild(frameMsg);
        setTimeout(function () {
            frameMsg.style.top = "7%";
            frameMsg.style.opacity = "1";
        }, 100);
        setTimeout(function () {
            frameMsg.style.top = "-100px";
            frameMsg.style.opacity = "0";
            setTimeout(function () {
                frameMsg.remove();
                greetings = false;
            }, 500);
        }, 3000);
    }
}
greeting();

/** CLASS CODES */
// jumpscare code warn
let tmpList = [];

// LOADING:
let UWUTILS = new uwutils();
let items = new Items();
let objectManager = new Objectmanager(GameObject, gameObjects, UWUTILS, config);
let store = new Store();
let hats = store.hats;
let accessories = store.accessories;
let projectileManager = new ProjectileManager(
    Projectile,
    projectiles,
    players,
    ais,
    objectManager,
    items,
    config,
    UWUTILS
);
let aiManager = new AiManager(ais, AI, players, items, null, config, UWUTILS);
let textManager = new Textmanager();

let traps = new Traps(UWUTILS, items);
let instaC = new Instakill();
let autoBuy = new Autobuy([6, 15, 7, 40, 53, 22, 26, 31], [11, 19]);
let autoUpgrade = new Autoupgrade();
let lastDeath;
let minimapData;
let mapMarker = {};
let mapPings = [];
let tmpPing;

let breakTrackers = [];

function sendChat(message) {
    if (
        !saySettings &&
        message.startsWith(".") &&
        message != "..." &&
        message != "."
    )
        return;
    packet("6", message.slice(0, 30), "sendChat");
}

let runAtNextTick = [];

function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projXY = {
        x: indx == 1 ? x : x - 70 * Math.cos(dir),
        y: indx == 1 ? y : y - 70 * Math.sin(dir),
    };
    let nearPlayer = players.filter2((e) => e.visible && UWUTILS.getDist(projXY, e, 0, 2) <= 35)[0];
    if (nearPlayer) {
        if (indx == 1) {
            nearPlayer.shooting[53] = 3;
        } else {
            nearPlayer.shootIndex = weaponIndx;
            nearPlayer.shooting[1] = 3;
            antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
        }
    }
}
let antiZpyklerTicked = false;
let projectileCount = 0;
function antiZpyklerTick(obj) {
    console.log("Anti Spiketick")
    if (player.turretReload == 0) {
        antiZpyklerTicked = true;
        sendAutoGather(3);
        selectWeapon(player.primaryIndex, 0, 1);
        noWep = true;
        instaC.isTrue = true;
        buyEquip(53, 0);
        my.autoAim = 1;
        game.tickBase(() => {
            if (player.skins[40]) buyEquip(40, 0)
            selectWeapon(player.secondaryIndex, 0, 1);
            game.tickBase(() => {
                antiZpyklerTicked = false;
                noWep = false;
                instaC.isTrue = false;
            }, 1)
        }, 1)
    }
}
const Ye = {
    animationTime: 0,
    land: null,
    lava: null,
    x: 13960,
    y: 13960,
};
function Do(e, t, i) {
    const n = e.lineWidth || 0;
    (i /= 2), e.beginPath();
    let s = (Math.PI * 2) / t;
    for (let r = 0; r < t; r++)
        e.lineTo(
            i + (i - n / 2) * Math.cos(s * r),
            i + (i - n / 2) * Math.sin(s * r)
        );
    e.closePath();
}
function drawVolcanoSprite() {
    const t = 320 * 2,
          i = document.createElement("canvas");
    (i.width = t), (i.height = t);
    const n = i.getContext("2d");
    (n.strokeStyle = "#3e3e3e"),
        (n.lineWidth = 11),
        (n.fillStyle = "#7f7f7f"),
        Do(n, 10, t),
        n.fill(),
        n.stroke(),
        (Ye.land = i);
    const s = document.createElement("canvas"),
          r = 200;
    (s.width = r), (s.height = r);
    const o = s.getContext("2d");
    (o.strokeStyle = "#525252"),
        (o.lineWidth = 5.5 * 1.6),
        (o.fillStyle = "#f54e16"),
        (o.strokeStyle = "#f56f16"),
        Do(o, 10, r),
        o.fill(),
        o.stroke(),
        (Ye.lava = s);
}
drawVolcanoSprite();
function drawVolcano(context, x, y) {
    const e = player.x - maxScreenWidth / 2,
          t = player.y - maxScreenHeight / 2;
    (Ye.animationTime += delta), (Ye.animationTime %= 3200);
    const i = 1600,
          n = 1.7 + 0.3 * (Math.abs(i - Ye.animationTime) / i),
          s = 100 * n;
    context.drawImage(Ye.land, x - 320, y - 320, 320 * 2, 320 * 2),
        context.drawImage(Ye.lava, x - s, y - s, s * 2, s * 2);
}
function getVolcanoDist() {
    return UWUTILS.getDist(player, {x: 13960, y: 13960}, 2, 0);
}
let projectileDamagePot = 0;
function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
    if (!tmpObj.isTeam(player)) {
        tmpDir = UWUTILS.getDirect(player, tmpObj, 2, 2);
        if (UWUTILS.getAngleDist(tmpDir, dir) <= 0.5) {
            projectileDamagePot += items.projectiles[index].dmg;
            tmpObj.bowThreat[weaponIndex]++;
            projectileCount++;weaponIndex
            game.tickBase(() => {
                tmpObj.bowThreat[weaponIndex]--;
                projectileCount--;
            }, 2);
            if (tmpObj.bowThreat[9] >= 1 && (tmpObj.bowThreat[12] >= 1 || tmpObj.bowThreat[15] >= 1)) {
                place(3, tmpObj.aim2);
                if (tmpObj.dist2 >= 200) {
                    game.tickBase(() => {
                        my.anti0tick = 3;
                        qHold = true;
                        game.tickBase(() => {
                            qHold = false;
                        }, 3)
                    }, 2)
                } else {
                    my.anti0tick = 4;
                    qHold = true;
                    game.tickBase(() => {
                        qHold = false;
                    }, 2)
                }
            } else {
                if (projectileCount >= (index == 15 ? 2 : 3) && (player.items[1] =! 11 || blockTime <= game.tick)) {
                    if (player.secondaryIndex == 11) {
                        blockAim = tmpObj.aim3;
                        blockTime = game.tick + 4;
                        my.anti0tick = 4;
                        menuLog("blocking");
                        console.log("blocking");
                        selectWeapon(11);
                        noWep = true;
                        packet("D", blockAim, 1, "shield");
                        my.noAim = true;
                    } else {
                        if (projectileCount >= (index == 15 ? 2 : index == 12 ? 3 : 4)) place(3, tmpObj.aim2);
                        my.anti0tick = 4;
                        qHold = true;
                        game.tickBase(() => {
                            qHold = false;
                        }, 5)
                    }
                }
            }
        }
        /*if (
                UWUTILS.getAngleDist(tmpDir, dir) <=
                Math.PI / 2
            ) {
                if ([13, 12].includes(weaponIndex) || (weaponIndex == 9 && tmpObj.primaryIndex == 5 && tmpObj.primaryVariant == 3)) {
                    console.log("crossbow and shooting towards player");
                    tmpObj.attacked = true;
                    if (tmpObj.boostTickDist) {
                        console.log("close");
                        tmpObj.shotAnti = true;
                        if (tmpObj.turretGear) {
                            if (!configs.antiOneTick) {
                                qHold = true;
                                game.tickBase(() => {
                                    qHold = false;
                                }, 4);
                            } else {
                                if (player.secondaryIndex == 11) {
                                    menuLog("blocking");
                                    console.log("blocking");
                                    selectWeapon(11);
                                    noWep = true;
                                    packet("D", tmpObj.aim2, "shield");
                                    my.noAim = true;
                                    game.tickBase(() => {
                                        noWep = false;
                                        selectWeapon(player.primaryIndex);
                                        my.noAim = false;
                                    }, 4);
                                } else {
                                    antiOneTick = 3;
                                    if (!traps.in) {
                                        if (checkCanPlace(3, tmpObj.aim2)) {
                                            place(3, tmpObj.aim2);
                                        } else {
                                            let item = items.list[player.items[3]];
                                            let tmpS = 35 + item.scale + (item.placeOffset || 0);
                                            for (
                                                let ayochilltfoutyo = -45;
                                                ayochilltfoutyo < 45;
                                                ayochilltfoutyo += Math.abs(ayochilltfoutyo) >= 35 ? 2 : 1
                                            ) {
                                                let randomAngle = tmpObj.aim2 + UWUTILS.toRad(ayochilltfoutyo);
                                                if (checkCanPlace(3, randomAngle)) {
                                                    place(3, randomAngle);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        game.tickBase(() => {
                            tmpObj.shotAnti = false;
                        }, 3);
                    }
                }
            }/* else if (
                configs.saveAllyOnetick &&
                tmpObj.boosted
            ) {
                noHat = true;
                buyEquip(53, 0);
                game.tickBase(() => {
                    noHat = false;
                }, 2);
            }*/
    }
}

// SHOW ITEM INFO:
function showItemInfo(item, isWeapon, isStoreItem) {
    if (player && item) {
        UWUTILS.removeAllChildren(itemInfoHolder);
        itemInfoHolder.classList.add("visible");
        UWUTILS.generateElement({
            id: "itemInfoName",
            text: UWUTILS.capitalizeFirst(item.name),
            parent: itemInfoHolder,
        });
        UWUTILS.generateElement({
            id: "itemInfoDesc",
            text: item.desc,
            parent: itemInfoHolder,
        });
        if (isStoreItem) {
        } else if (isWeapon) {
            UWUTILS.generateElement({
                class: "itemInfoReq",
                text: !item.type ? "primary" : "secondary",
                parent: itemInfoHolder,
            });
        } else {
            let con = item.req.length;
            for (let i = 0; i < con; i += 2) {
                UWUTILS.generateElement({
                    class: "itemInfoReq",
                    html:
                    item.req[i] +
                    "<span class='itemInfoReqVal'> x" +
                    item.req[i + 1] +
                    "</span>",
                    parent: itemInfoHolder,
                });
            }
            if (item.group.limit) {
                UWUTILS.generateElement({
                    class: "itemInfoLmt",
                    text:
                    (player.itemCounts[item.group.id] || 0) +
                    "/" +
                    (config.isSandbox ? 99 : item.group.limit),
                    parent: itemInfoHolder,
                });
            }
        }
    } else {
        itemInfoHolder.classList.remove("visible");
    }
}

// RESIZE:
window.addEventListener("resize", UWUTILS.checkTrusted(resize));

function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    let scaleFillNative =
        Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) *
        pixelDensity;
    gameCanvas.width = screenWidth * pixelDensity;
    gameCanvas.height = screenHeight * pixelDensity;
    gameCanvas.style.width = screenWidth + "px";
    gameCanvas.style.height = screenHeight + "px";
    mainContext.setTransform(
        scaleFillNative,
        0,
        0,
        scaleFillNative,
        (screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2,
        (screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2
    );
}
resize();

// MOUSE INPUT:
var usingTouch;
const mals = document.getElementById("touch-controls-fullscreen");
mals.style.display = "block";
mals.addEventListener("mousemove", gameInput, false);

function gameInput(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}
let clicks = {
    left: false,
    middle: false,
    right: false,
};
mals.addEventListener("mousedown", mouseDown, false);

function mouseDown(e) {
    if (!hacking) packet2("F", 1, getSafeDir(), 1)
    if (e.button == 0) {
        clicks.left = true;
    } else if (e.button == 1 || e.key === "b") {
        clicks.middle = true;
    } else if (e.button == 2) {
        clicks.right = true;
    }
}
mals.addEventListener("mouseup", UWUTILS.checkTrusted(mouseUp));

function mouseUp(e) {
    if (!hacking) packet2("F", 0, getSafeDir(), 1)
    if (e.button == 0) {
        clicks.left = false;
    } else if (e.button == 1 || e.key === "b") {
        clicks.middle = false;
    } else if (e.button == 2) {
        clicks.right = false;
    }
}
mals.addEventListener("wheel", wheel, false);

let wbe = 1;
function wheel(e) {
    if (e.deltaY < 0) {
        wbe /= 1.1;
        maxScreenWidth = config.maxScreenWidth * wbe;
        maxScreenHeight = config.maxScreenHeight * wbe;
        resize();
    } else {
        wbe *= 1.1;
        maxScreenWidth = config.maxScreenWidth * wbe;
        maxScreenHeight = config.maxScreenHeight * wbe;
        resize();
    }
}
function slideCircle(playerPos, vel, foundObj, moverRadius = 35) {
  const c = { x: foundObj.x, y: foundObj.y }; // obstacle center
  const R = moverRadius + foundObj.getScale(); // combined radius
  const p0 = playerPos;
  const v = vel;

  const w = sub2(p0, c);
  const A = dot2(v, v);
  const B = 2 * dot2(v, w);
  const C = dot2(w, w) - R * R;

  let tHit = 1;
  if (A > 1e-8) {
    const D = B * B - 4 * A * C;
    if (D >= 0) {
      const sqrtD = Math.sqrt(D);
      const t1 = (-B - sqrtD) / (2 * A);
      const t2 = (-B + sqrtD) / (2 * A);
      if (t1 >= 0 && t1 <= 1) {
        tHit = Math.min(tHit, t1);
      } else if (t2 >= 0 && t2 <= 1) {
        tHit = Math.min(tHit, t2);
      }
    }
  }

  const pHit = add2(p0, mul2(v, tHit));
  if (tHit >= 1) {
    // no collision
    return pHit;
  }

  const dRem = mul2(v, 1 - tHit);   // leftover displacement
  const n = norm2(sub2(pHit, c));    // contact normal
  const proj = dot2(dRem, n);
  const dSlide = sub2(dRem, mul2(n, proj)); // tangent component

  return add2(pHit, dSlide);
}
// INPUT UWUTILS:
function getMoveDir(returnArr = false) {
    let send = false;
    let dx = 0;
    let dy = 0;
    for (let key in moveKeys) {
        if (keys[key]) {
            send = true;
            let tmpDir = moveKeys[key];
            dx += tmpDir[0];
            dy += tmpDir[1];
        }
    }
    if (!send) player.moveDir = undefined;
    return returnArr ? [dx, dy] : !send ? undefined : Math.atan2(dy, dx);
}

function getSafeDir() {
    if (!player) return 0;
    lastDir = Math.atan2(mouseY - screenHeight / 2, mouseX - screenWidth / 2);
    return lastDir || 0;
}
let plusDir = 0;
let lastSpin = Date.now();
let spinDir = 0;
function getAttackDir(debug) {
    let hammer = false;
    /*
        let noSafeDir = false;
        let noSafe180 = false;
        if (my.noAim) return player.d2;
        for (let i = 0; i < legits.length; i++) {
            let tmpPlayer = findPlayerBySID(legits[i]);
            if (tmpPlayer.dist2 > player.primary.range + 70) continue;
            if (tmpPlayer.health <= player.weapon * 1.5) {
                if (
                    UWUTILS.getAngleDist(
                        tmpPlayer.aim2,
                        (!nearHacker ? getSafeDir() : nearHacker.aim2) + Math.PI
                    ) <= (config.gatherAngle * 2)
                ) {
                    noSafe180 = true;
                }
                if (
                    UWUTILS.getAngleDist(
                        tmpPlayer.aim2,
                        !nearHacker ? getSafeDir() : nearHacker.aim2
                    ) <= (config.gatherAngle * 2)
                ) {
                    noNearAim = true;
                }
                if (
                    UWUTILS.getAngleDist(tmpPlayer.aim2, getSafeDir()) <= (config.gatherAngle * 2)
                ) {
                    noSafeDir = true;
                }
            }
        }*/
    if (debug) {
        if (!player) return "0";
        if (
            (my.autoAim &&
             (!clicks.left ||
              (clicks.left &&
               nearHacker.dist2 <=
               player.primary.range + 75))) ||
            ((clicks.left || configs.bullspam) &&
             nearHacker.dist2 <= player.primary.range + 75 &&
             player.primaryReload == 0)
        )
            lastDir =
                configs.autoGrind
                ? getSafeDir()
            : nearHacker.dist2 <= player.primary.range + 98
                ? my.revAim
                ? nearHacker.aim2 + Math.PI
            : nearHacker.aim2
            : getSafeDir();
        else if (
            (breakSpike || clicks.right || autoBreaker.active) &&
            player.hammerReload == 0
        )
            lastDir = breakSpike ?? autoBreaker.active ? autoBreaker.aim : getSafeDir();
        else if (
            traps.in &&
            ((player.secondaryIndex == 10 && traps.info.health > player.primary.dmg) ? player.secondaryReload : player.primaryReload) ==
            0
        )
            lastDir = traps.aim;
        else {
            lastDir = getSafeDir();
        }
        return lastDir;
    } else {
        if (!player) return 0;
        let canShameSpam = !instaC.isTrue && !clicks.right && (!traps.in || nearHacker.shameCount >= 4) && configs.rubyShame && [3, 5].includes(player.primaryIndex) && player.primaryVariant == 3 && nearHacker.dist2 <= player.primary.range + 65 && player.primaryReload == 0 && (game.tick - player.bullTick) % 9 < (9 - Math.ceil(player.primary.speed / 111))
        if (
            my.autoAim ||
            (((clicks.left && !clicks.right) || (canShameSpam && player.secondaryReload == 0) || (configs.bullspam && !traps.in)) &&
             nearHacker.dist2 <= player.primary.range + 75 &&
             player.primaryReload == 0)
        )
            lastDir = nearHacker
                ? instaC.shameHacker == true
                ? shameHackers[0].aim2
            : nearHacker.aim2
            : getVisualDir();
        else if (
            (breakSpike || clicks.right || autoBreaker.active) &&
            player.hammerReload == 0
        )
            hammer = true,
                lastDir = breakSpike != undefined ? breakSpike : autoBreaker.active ? autoBreaker.aim : getVisualDir();
        else if (
            traps.in &&
            player.weaponReload <=
            game.tickRate
        )
            hammer = true,
                lastDir = traps.aim;
        else if (spinner == true) {
            spinDir += Math.PI / 1.5;
            return spinDir + ((Math.random() * Math.PI) / 3 - Math.PI / 6);
            lastDir = getVisualDir();
        }
        if (traps.in) console.log(lastDir)
        return clicks.right ? lastDir : bestAim(lastDir, (hammer && player.secondaryIndex == 10) ? 75 : player.primary.range);//bestAim(lastDir, (hammer && player.secondaryIndex == 10) ? 75 : player.primary.range);
    }
}

function getVisualDir() {
    if (!player) return 0;
    let dx = mouseX - screenWidth / 2;
    let dy = mouseY - screenHeight / 2;
    let direction = Math.atan2(dy, dx);
    return direction;
}
let randomDirectionsIndex = 0;
let randomDirections = [Math.PI / 4, Math.PI / 4 + Math.PI / 1.5, Math.PI / 4 - Math.PI / 1.5, -(Math.PI / 4), -(Math.PI / 4 + Math.PI / 1.5), -(Math.PI / 4 - Math.PI / 1.5)];
// Random Spin:
function spin() {
    // PPL code
    let dir = randomDirections[randomDirectionsIndex]
    randomDirectionsIndex++;
    randomDirectionsIndex %= 5;
    packet("D", dir, "spin");
}

// KEYS:
function keysActive() {
    return (
        allianceMenu.style.display != "block" &&
        getEl("chatHolder").style.display != "block" &&
        !menuCBFocus &&
        !textAreas.includes(document.activeElement.id)
    );
}

function toggleMenuChat() {
    if (menuChatDiv.style.display != "none") {
        //   chatHolder.style.display = "none";
        // if (menuChatBox.value != "") {
        //commands[command.slice(1)]

        sendChat(menuChatBox.value);
        menuChatBox.value = "";
        menuChatBox.blur();
    } else {
        if (menuCBFocus) {
            menuChatBox.blur();
        } else {
            menuChatBox.focus();
        }
    }
}
function keyDown(event) {
    let keyNum = event.which || event.keyCode || 0;
    if (
        player &&
        player.alive &&
        keysActive() &&
        getEl("chatHolder").style.display === "none"
    ) {
        if (
            getEl("chatHolder").style.display == "block" ||
            textAreas.includes(document.activeElement.id)
        )
            return;
        if (!keys[keyNum]) {
            keys[keyNum] = 1;
            macro[event.key] = 1;
            if (keyNum == 16) {
                console.log("SHIFT")
                if ([13, 12, 9].includes(player.secondaryIndex)) {
                    console.log(game.tick)
                    console.log(game.tick)
                    console.log(game.tick)
                    console.log("BOOST TICK")
                    game.tickBase(() => {
                        console.log(game.tick)
                        instaC.boostTickType("boost1");
                    }, 1);
                } else {
                    console.log("NORMAL")
                    game.tickBase(() => {
                        oneTick(1, 1);
                    }, 1)
                }
            } else if (event.key == "t") {
                oneTick()
            } else if (event.key == "F5") {
                event.preventDefault();
                hacking = !hacking;
                if (!hacking) {
                    WhiteoutNet.gate = function (message) {
                        if (WS == this) {
                            dontSend = false;

                            // EXTRACT DATA ARRAY:
                            const frame = WhiteoutNet.decodeOut(this, message);
                            if (!frame) return WhiteoutNet.nativeSend(this, message);
                            let type = frame[0];
                            let data = frame[1];

                            // SEND MESSAGE:
                            if (type == "6") {
                                if (data[0]) {
                                    let message = data[0];
                                    if (!message || !message.length) dontSend = true;
                                    // ANTI PROFANITY:
                                    let profanity = [
                                        "cunt",
                                        "whore",
                                        "fuck",
                                        "shit",
                                        "faggot",
                                        "nigger",
                                        "nigga",
                                        "dick",
                                        "vagina",
                                        "minge",
                                        "cock",
                                        "rape",
                                        "cum",
                                        "sex",
                                        "tits",
                                        "penis",
                                        "clit",
                                        "pussy",
                                        "meatcurtain" ,
                                        "jizz" ,
                                        "prune",
                                        "douche",
                                        "wanker",
                                        "damn",
                                        "bitch",
                                        "dick",
                                        "fag",
                                        "bastard",
                                    ];
                                    let tmpString;
                                    for (let i = 0; i < profanity.length; i++) {
                                        let profany = profanity[i];
                                        if (data[0].indexOf(profany) > -1) {
                                            tmpString = "";
                                            for (let i = 0; i < profany.length; ++i) {
                                                if (i == 1) {
                                                    tmpString += String.fromCharCode(0);
                                                }
                                                tmpString += profany[i];
                                            }
                                            let re = new RegExp(profany, "g");
                                            data[0] = data[0].replace(re, tmpString);
                                        }
                                    }

                                    // FIX CHAT:
                                    data[0] = data[0].slice(0, 30);
                                }
                            } else if (type == "L") {
                                // MAKE SAME CLAN:
                                data[0] = data[0] + String.fromCharCode(0).repeat(1);
                                data[0] = data[0].slice(0, 7);
                            } else if (type == "M") {
                                // APPLY CYAN COLOR:
                                data[0].moofoll = true;
                                data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                                lastsp = [data[0].name, data[0].moofoll, data[0].skin];
                            } else if (type == "D") {
                                if (data[1] != 1 || my.lastDir == data[0] || [null, undefined].includes(data[0])) {
                                    dontSend = true;
                                } else {
                                    my.lastDir = data[0];
                                }
                            } else if (type == "F") {
                                if (!data[2]) {
                                    dontSend = true;
                                }
                            }
                            if (!dontSend) {
                                packets.push([
                                    performance.now(),
                                    [type, data],
                                    WhiteoutNet.encode([type, data]),
                                    packetCaller,
                                ]);
                                for (let i = 0; i < packets.length; i++) {
                                    if (performance.now() - packets[i][0] > 10000) {
                                        packets.splice(i, 1);
                                    }
                                }
                                const binary = WhiteoutNet.encodeOut(this, type, data);
                                if (!binary) return;
                                WhiteoutNet.nativeSend(this, binary);

                                // START COUNT:
                                if (!firstSend.sec) {
                                    firstSend.sec = true;
                                    setTimeout(() => {
                                        firstSend.sec = false;
                                        secPacket = 0;
                                    }, secTime);
                                }

                                if (secPacket == 100) {
                                    addMenuChText("Warning", "Sending Too Many Packets", "#cc5151", 1);
                                }

                                secPacket++;
                            }
                        } else {
                            this.nsend(message);
                        }
                    };
                } else {
                    WhiteoutNet.gate = function (message) {
                        if (WS == this) {
                            dontSend = false;

                            // EXTRACT DATA ARRAY:
                            const frame = WhiteoutNet.decodeOut(this, message);
                            if (!frame) return WhiteoutNet.nativeSend(this, message);
                            let type = frame[0];
                            let data = frame[1];
                            // SEND MESSAGE:
                            if (type == "z") {
                                if (data[1] && hold[0] == data[0] && hold[1]) {
                                    dontSend = true;
                                } else {
                                    hold = data;
                                }
                            } else if (type == "6") {
                                if (data[0]) {
                                    let message = data[0];
                                    if (!message || !message.length) dontSend = true;
                                    if (
                                        message == ".d" ||
                                        (!saySettings &&
                                         data[0].startsWith(".") &&
                                         message != "." &&
                                         message != "...")
                                    )
                                        dontSend = true;
                                    if (message == ".t -ad") {
                                        configs.autoDiddler = !configs.autoDiddler;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    ("Auto Diddler " + (configs.autoDiddler ? "Enabled." : "Disabled.")),
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".t -heal" || message == ".t -ah") {
                                        autoHeal = !autoHeal;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    ("Auto Heal " + (autoHeal ? "Enabled." : "Disabled.")),
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".c -t -aa" && player.isOwner) {
                                        autoAcceptEnabled = !autoAcceptEnabled;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Auto Accept ${autoAcceptEnabled ? "Enabled." : "Disabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }

                                        if (notifications.length > 0 && autoAcceptEnabled) {
                                            for (let i = 0; i < notifications.length; i++) {
                                                let sid = notifications[i].sid;
                                                let name = notifications[i].name;
                                                setTimeout(() => {
                                                    lastAccept = performance.now();
                                                    window.aJoinReq(sid, 1);
                                                    game.tickBase(() => {
                                                        console.log(`Accepting ${name}`);
                                                    }, 6);
                                                    notifications.splice(i, 1);
                                                }, i * 1500);
                                            }
                                        }
                                    } else if (player.isOwner && message == ".c -d") {
                                        let teamName = player.team;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    ("Deleted " + teamName + (teamName.endsWith(".") ? "" : ".")),
                                                    "settings"
                                                );
                                            }, 6);
                                        }

                                        packet("N", "leave");
                                    } else if (message.startsWith(".c -j -")) {
                                        let clan = undefined;
                                        for (let i = 0; i < alliances.length; i++) {
                                            if (alliances[i].sid.replaceAll(String.fromCharCode(0), "") == (message.replace(".c -j -", "").trim())) {
                                                clan = alliances[i].sid;
                                                packet("b", clan, "join");
                                            }
                                        }
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    ("Joining " +
                                                     (clan +
                                                      (clan.endsWith(".")
                                                       ? ""
                                                       : "."))),
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".c -c -")) {
                                        let clan = message.replace(".c -c -", "");
                                        packet("L", clan);
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",

                                                    ("Created " + (clan + (clan.endsWith(".") ? "" : "."))),
                                                    "settings"
                                                );
                                            }, 6);
                                        }


                                    } else if (message.startsWith(".c -a -")) {
                                        let sid = Number(message.replace(".c -a -", ""));
                                        if (player.isOwner) {
                                            window.aJoinReq(sid, 1);
                                            let notification = notifications.find2(n => n.sid === sid);
                                            if (notification) {
                                                let name = notification.name;
                                                if (saySettings) {
                                                    game.tickBase(() => {
                                                        packet("6", name + " has been accepted.", "settings");
                                                    }, 6);
                                                }
                                            }
                                        }

                                    } else if (message.startsWith(".c -k -")) {
                                        let sid = Number(message.replace(".c -k -", ""));
                                        if (player.isOwner) {
                                            packet("Q", sid, "kick");
                                            let name = alliancePlayers[(alliancePlayers.indexOf(sid) + 1)];
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", name + " has been kicked.", "settings");
                                                }, 6);
                                            }
                                        }
                                    } else if (message.startsWith(".c -l")) {
                                        if (!player.isOwner) {
                                            let teamName = player.team;
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        ("Left " + teamName + (teamName.endsWith(".") ? "" : ".")),
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                            packet("N", "leave");
                                        }

                                    } else if (message == ".t -ab") {
                                        configs.autoBreaker = !configs.autoBreaker;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Autobreaker ${configs.autoBreaker ? "Enabled." : "Disabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".el") {
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", annoyingList.join(), "settings");
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".el -r -")) {
                                        let a = validID(message.replace(".el -r -", ""), null);
                                        if (typeof a === "number" && annoyingList.includes(a)) {
                                            annoyingList.splice(annoyingList.indexOf(a));
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", a + " removed from Enemylist.", "settings");
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        typeof a !== "number" ? ('"' + message.replace(".el -r -", "") + '"' + " is not a number.") : (message.replace(".el -r -", "") + "is not in your Enemylist."),
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message.startsWith(".tpl -r -")) {
                                        let a = validID(message.replace(".tpl -r -", ""), null);
                                        if (typeof a === "number" && tpList.includes(a)) {
                                            tpList.splice(tpList.indexOf(a));
                                            if (saySettings) {
                                                let as = findPlayerBySID(a);
                                                game.tickBase(() => {
                                                    packet("6", (as?.name?.length <= 11 ? as.name : a) + " removed from TP-List.", "settings");
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        '"' + message.replace(".tpl -r -", "") + '"' + " is not a number.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message.startsWith(".tpl -a -")) {
                                        let a = Number(message.replace(".tpl -a -", ""));
                                        if (!Number.isNaN(a)) {
                                            let as = findPlayerBySID(a);
                                            tpList.push(a);
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        (as.name.length <= 12 ? as.name : a) + " added to TP List.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        '"' + message.replace(".tpl -a -", "") + '"' + " is not a number.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message.startsWith(".el -a -")) {
                                        let a = Number(message.replace(".el -a -", ""));
                                        if (!Number.isNaN(a) ) {
                                            let as = findPlayerBySID(a);
                                            if (friendList.includes(a)) friendList.splice(friendList.indexOf(a));
                                            annoyingList.push(a);
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        (as.name.length <= 10 ? as.name : a) + " Added To Enemy List.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        '"' + message.replace(".el -a -", "") + '"' + " is not a number.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message == ".tpl") {
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", tpList.join(), "settings");
                                            }, 6);
                                        }
                                    } else if (message == ".fl") {
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", friendList.join(), "settings");
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".fl -r -")) {
                                        let a = validID(message.replace(".fl -r -", ""), null);
                                        if (typeof a === "number" && friendList.includes(a)) {
                                            friendList.splice(friendList.indexOf(a));
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", a + " Removed From Friendlist.", "settings");
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        '"' + message.replace(".fl -r -", "") + '"' + " is not a number.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message.startsWith(".fl -a -")) {
                                        let a = Number(message.replace(".fl -a -", ""));
                                        if (!Number.isNaN(a) && Number.isInteger(a) && a > 0 && a <= 50) {
                                            let as = findPlayerBySID(a);
                                            friendList.push(a);
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        (as?.name?.length <= 9 ? as.name : a) + " Added To Friendlist.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        } else {
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet(
                                                        "6",
                                                        '"' + message.replace(".fl -a -", "") + '"' + " is not a number.",
                                                        "settings"
                                                    );
                                                }, 6);
                                            }
                                        }
                                    } else if (message == ".d") {
                                        saySettings = !saySettings;
                                    } else if (message == ".r -dh") {
                                        my.defaultHat = "auto";
                                        game.tickBase(() => {
                                            packet("6", "DefaultHat reset.");
                                        }, 6);
                                    } else if (message == ".r -ch") {
                                        my.combatHat = 6;
                                        game.tickBase(() => {
                                            packet("6", "CombatHat reset.");
                                        }, 6);
                                    } else if (message == ".r -da") {
                                        my.defaultAccessory = 11;
                                        game.tickBase(() => {
                                            packet("6", "DefaultAccessory reset.");
                                        }, 6);
                                    } else if (message == ".r -ca") {
                                        my.combatTail = 19;
                                        game.tickBase(() => {
                                            packet("6", "CombatAccessory reset.");
                                        }, 6);
                                    } else if (message.startsWith(".s -dh -")) {
                                        let a = message.replace(".s -dh -", "");
                                        let isName = hats.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: cap| armor| hat| gear| helmet| head)/g, "") == a.toLowerCase())?.id;
                                        let hatExists = validID(isName ?? a, null, hats);
                                        if (typeof hatExists == "number" || a == "58") {
                                            my.defaultHat = a == "58" ? 58 : isName ?? hatExists;
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", "DefaultHat set to " + my.defaultHat + ".", "settings");
                                                }, 6);
                                            }
                                        } else if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.');
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".s -ch -")) {
                                        let a = message.replace(".s -ch -", "");
                                        let isName = hats.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: cap| armor| hat| gear| helmet| head)/g, "") == a.toLowerCase())?.id;
                                        let hatExists = validID(isName ?? a, null, hats);
                                        if (typeof hatExists == "number" || a == "58") {
                                            my.combatHat = a == "58" ? 58 : isName ?? hatExists;
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", "CombatHat set to " + my.combatHat + ".", "settings");
                                                }, 6);
                                            }
                                        } else if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.');
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".s -da -")) {
                                        let a = message.replace(".s -da -", "");
                                        let isName = accessories.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: tail| wings| cape)/g, "") == a.toLowerCase())?.id;
                                        let accExists = validID(isName ?? a, null, accessories);
                                        console.log(accExists, typeof accExists, isName, a)
                                        if (typeof accExists == "number" || a == "21") {
                                            my.defaultTail = a == "21" ? 21 : isName ?? accExists;
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", "DefaultAccessory set to " + my.defaultTail + ".", "settings");
                                                }, 6);
                                            }
                                        } else if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", '"' + String(a).slice(0, 8) + '" is not a valid id.', "settings");
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".s -ca -")) {
                                        let a = message.replace(".s -ca -", "");
                                        let isName = accessories.find2((e) => e.name.toLowerCase().replace(" ", "") == a.toLowerCase() || e.name.toLowerCase().replace(/(?: tail| wings| cape)/g, "") == a.toLowerCase())?.id;
                                        let accExists = validID(isName ?? a, null, accessories);
                                        if (typeof accExists == "number" || a == "21") {
                                            my.combatTail = a == "21" ? 21 : isName ?? accExists;
                                            if (saySettings) {
                                                game.tickBase(() => {
                                                    packet("6", "CombatAccessory Set To " + my.combatTail + ".", "settings");
                                                }, 6);
                                            }
                                        } else if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", '"' + a.slice(0, 8) + '" is not a valid id.');
                                            }, 6);
                                        }
                                    } else if (
                                        message == ".t -ast" ||
                                        message == ".t -antispiketick"
                                    ) {
                                        configs.antiZpyklerTick = !configs.antiZpyklerTick;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `AntiSpikeTick ${
                                                    configs.antiZpyklerTick ? "Enabled." : "Disabled."
                                                    }`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (
                                        message == ".t -bs" ||
                                        message == ".t -abs" ||
                                        message == ".t -bullspam" ||
                                        message == ".t -autobullspam"
                                    ) {
                                        configs.bullspam = !configs.bullspam;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `AutoBullSpam ${configs.bullspam ? "Enabled." : "Disabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message.startsWith(".s -ppd -")) {
                                        let a = message.replace(".s -ppd -", "");
                                        getEl("customDelay-text").value = a;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", `PreplaceDelay Set To ${a}`, "settings");
                                            }, 6);
                                        }
                                    } else if (message == ".e -p" || message == ".e -placers" || message == ".a -p" || message == ".a -placers") {
                                        configs.autoReplace = true;
                                        configs.autoPreplace = true;
                                        configs.autoPlace = true;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", `All Placers Enabled.`, "settings");
                                            }, 6);
                                        }
                                    } else if (message == ".d -p" || message == ".d -placers") {
                                        configs.autoReplace = false;
                                        configs.autoPreplace = false;
                                        configs.autoPlace = false;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet("6", `All Placers Disabled.`, "settings");
                                            }, 6);
                                        }
                                    } else if (
                                        message == ".t -evil" ||
                                        message == ".t -1v1" ||
                                        message == ".t -wall"
                                    ) {
                                        evil = !evil;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Walls ${evil ? "Disabled." : "Enabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".t -hl" || message == ".t -hatloop" || message == ".t -hat") {
                                        hatLoop = !hatLoop;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Hatloop ${hatLoop ? "Enabled." : "Disabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".t -ait") {
                                        configs.antiInstaTricker = !configs.antiInstaTricker;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Anti Insta Tricker ${configs.antiInstaTricker ? "Enabled." : "Disabled."}dddddddd`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    } else if (message == ".t -ap" || message == ".t autoplace") {
                                        let a;
                                        configs.autoPlace = !configs.autoPlace;
                                        if (saySettings) {
                                            game.tickBase(() => {
                                                packet(
                                                    "6",
                                                    `Autoplace ${configs.autoPlace ? "Enabled." : "Disabled."}`,
                                                    "settings"
                                                );
                                            }, 6);
                                        }
                                    }
                                    // ANTI PROFANITY:
                                    let profanity = [
                                        "cunt",
                                        "whore",
                                        "fuck",
                                        "shit",
                                        "faggot",
                                        "nigger",
                                        "nigga",
                                        "dick",
                                        "vagina",
                                        "minge",
                                        "cock",
                                        "rape",
                                        "cum",
                                        "sex",
                                        "tits",
                                        "penis",
                                        "clit",
                                        "pussy",
                                        "meatcurtain" ,
                                        "jizz" ,
                                        "prune",
                                        "douche",
                                        "wanker",
                                        "damn",
                                        "bitch",
                                        "dick",
                                        "fag",
                                        "bastard",
                                    ];
                                    let tmpString;
                                    for (let i = 0; i < profanity.length; i++) {
                                        let profany = profanity[i];
                                        if (data[0].indexOf(profany) > -1) {
                                            tmpString = "";
                                            for (let i = 0; i < profany.length; ++i) {
                                                if (i == 1) {
                                                    tmpString += String.fromCharCode(0);
                                                }
                                                tmpString += profany[i];
                                            }
                                            let re = new RegExp(profany, "g");
                                            data[0] = data[0].replace(re, tmpString);
                                        }
                                    }

                                    // FIX CHAT:
                                    data[0] = data[0].slice(0, 30);
                                }
                            } else if (type == "L") {
                                // MAKE SAME CLAN:
                                data[0] = data[0] + String.fromCharCode(0).repeat(1);
                                data[0] = data[0].slice(0, 7);
                            } else if (type == "M") {
                                // APPLY CYAN COLOR:
                                console.log(data)
                                data[0].moofoll = true;
                                data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                                lastsp = [data[0].name, data[0].moofoll, data[0].skin];
                            } else if (type == "D") {
                                if (my.noAim || data[1] != 1) dontSend = true;
                                if (my.lastDir == data[0] || [null, undefined].includes(data[0])) {
                                    dontSend = true;
                                } else {
                                    my.lastDir = data[0];
                                }
                            } else if (type == "F") {
                                if (!data[2]) {
                                    dontSend = true;
                                } else {
                                    if (data[0] == 1) {
                                        hitting = true;
                                    } else if (data[0] == 0) {
                                        hitting = false;
                                    }
                                    if (![null, undefined].includes(data[1])) {
                                        my.lastDir = data[1];
                                    }
                                }
                            } else if (type == "K") {
                                if (!data[1]) {
                                    dontSend = true;
                                }
                            } else if (type == "9") {
                                if (clientMoveDir == data[0] || !data[2] && (stopMoving || !data[1] ||
                                                                             (clientMoveDir == data[0] ||
                                                                              (oneTicking &&
                                                                               data[0] != nearHacker.aim2 &&
                                                                               data[0] != nearHacker.aim2 + Math.PI))
                                                                            )) {
                                    dontSend = true;
                                } else clientMoveDir = data[0];
                            }
                            if (!dontSend) {
                                packets.push([
                                    performance.now(),
                                    [type, data],
                                    WhiteoutNet.encode([type, data]),
                                    packetCaller,
                                ]);
                                for (let i = 0; i < packets.length; i++) {
                                    if (performance.now() - packets[i][0] > 10000) {
                                        packets.splice(i, 1);
                                    }
                                }
                                if (!["F","9","K","z","H","D","c"].includes(type)) console.log(type)
                                const binary = WhiteoutNet.encodeOut(this, type, data);
                                if (!binary) return;
                                WhiteoutNet.nativeSend(this, binary);

                                // START COUNT:
                                if (!firstSend.sec) {
                                    firstSend.sec = true;
                                    setTimeout(() => {
                                        firstSend.sec = false;
                                        secPacket = 0;
                                    }, secTime);
                                }

                                if (secPacket == 100) {
                                    addMenuChText("Warning", "Sending Too Many Packets", "#cc5151", 1);
                                }

                                secPacket++;
                            }
                        } else {
                            this.nsend(message);
                        }
                    };
                }
            } else if (event.key == "j") {
                autoQuadSpike = !autoQuadSpike;
            } else if (event.key === "q") {
                selectToBuild(player.items[0]);
            } else if (event.key == "F8") {
                event.preventDefault();
                console.log(performance.now());
                console.log(packets);
                console.log(packets.length);
            } else if (event.key == "Enter") {
                const savedDir = getMoveDir();
                game.tickBase(() => {
                    packet2("9", savedDir, 1, "walkchat")
                }, 2);
            } else if (keyNum == 226 && player.primaryIndex == 5) {
                oneTicking = true;
            } else if (event.key == "r") {
                console.log("a")
                waitInsta = !waitInsta;
            } else if (keyNum == 69) {
                manualAutoGather = !manualAutoGather;
                sendAutoGather("e");
            } else if (keyNum == 67) {
                updateMapMarker();
            } else if (keyNum == 49) {
                player.weaponCode = player.primaryIndex;
            } else if (keyNum == 50 && player.secondaryIndex) {
                player.weaponCode = player.secondaryIndex
            } else if (event.key == "m") {
                mills.placeSpawnPads = !mills.placeSpawnPads;
                notif("AutoSpawnPads", mills.placeSpawnPads ? "Enabled" : "Disabled")
            } else if (event.key == "g") {
                packet("6", "meowmewomweomwowo", "meow :3")
            } else if (event.key == "y") {
                packet("6", "mewomeowmeowmeowmo", "meow :3")
            } else if (event.key == "x") {
                my.reSync = true;
            } else if (event.key == "z") {
                mills.place = !mills.place;
                notif("AutoMills", mills.place ? "Enabled" : "Disabled")
            } else if (event.key == "Z") {
                typeof window.debug == "function" && window.debug();
            } else if (keyNum == 32) {
                if (!hacking) {
                    packet2("F", 1, getSafeDir(), 1)
                } else {
                    if (player.turretReload == 0 && player.skins[53]) buyEquip(53, 0);
                }
            } else if (event.key == ".") {
                console.log("do boostspike");
                spike = false;
                moveslikejagger = true;
                active = true;
                boostSpike = true;
                quaded = false;
                boost2 = false;
                boost3 = false;
                boost4 = false;
                loopBoostSpike = true;
                savedAim = undefined;
            } else if (event.key == "l") {
                packet("F", 1, getSafeDir(), 1, "l");
                packet("F", 0, getSafeDir(), 1, "l");
            }
        }
    }
}
// let yy = canvaz.height/2;

// let mouze = {
//     x: xx - mouzeX,
//     y: yy - mouzeY
// }

// let ingamecoorformodabow = {
//     x: player.x + mouze.x,
//     y: player.x + mouze.x
// }

function keyUp(event) {
    let keyNum = event.which || event.keyCode || 0;
    if (keyNum == 226) {
        oneTicking = false;
    } else if (keyNum == 32) {
        if (!hacking) {
            packet2("F", 0, getSafeDir(), 1)
        }
    }
    if (
        player &&
        player.alive &&
        getEl("chatHolder").style.display === "none"
    ) {
        if (
            getEl("chatHolder").style.display == "block" ||
            textAreas.includes(document.activeElement.id)
        )
            return;
        if (keysActive()) {
            if (keys[keyNum]) {
                keys[keyNum] = 0;
                macro[event.key] = 0;
                if (event.key == ".") {
                    boostSpike = false;
                }
            }
        }
    }
}

window.addEventListener("keyup", UWUTILS.checkTrusted(keyUp));
let lastMoveDirTime = performance.now();
function sendMoveDir() {
    if (noMove || game.tick == lastMove) return;
    let p2 = {...player}
    p2.buildIndex = -1;
    p2.tailIndex = my.predictTail;
    p2.skinIndex = my.predictHat;
    p2.weaponIndex = player.weaponIndex;
    let newMoveDir = getMoveDir();
    const vel = calcVel(p2,newMoveDir, p2, 1);
    if (hypot(vel.accel.x - nearHacker.x3, vel.accel.y - nearHacker.y3) <= 75 && nearHacker.hitSpike) {
        packet("9", nearHacker.aim2 + PI, 1, "sendMoveDir");
        game.tickBase(() => {
            packet("9", undefined, 1, "sendMoveDir");
        }, 1)
    }
    const hitSpike = runInto(player,newMoveDir,vel);
    if (hitSpike) newMoveDir = undefined;
    if (!boostSpike && !oneTicking) {
        if (!my.autoPush) {
            lastMove = game.tick;
            packet("9", newMoveDir, 1, "sendMoveDir");
        }
        lastMoveDir = newMoveDir;
    }
}

function findAvailableAngles(item, thisAng, vel, xd = PI / 75){ // originally 60
    if(!item) return [];
    //   const givenAngle = gAng;
    const interval = xd;
    const potentialAngles = []// {onPlayer:[],norm:[]};
    const x = vel ? player.x3 : player.x2
    const y = vel ? player.y3 : player.y2
    for (let offset = thisAng; offset <= thisAng + PI2; offset += interval) {
        const angle = offset;
        let used = usedAngles.findIndex(x => dAng(angle, x.angle) <= 0.45);
        let i = items.list[item];
        let tmpS = (35 + i.scale + (i.placeOffset || 0));
        let tmpX = x + (tmpS * cos(angle));
        let tmpY = y + (tmpS * sin(angle));
        let obj = {x: tmpX, y: tmpY, id: i.id, scale: i.scale, angle: angle, offset: tmpS, item: i, collide: [], points: 0, origin: [], name: i.name, overlap: [], preplacer:[],sids:[],intercepts:[],knockback:[], used: used}
        let canPlace = secPacket <= 90 ? objectManager.checkItemLocation3(tmpX, tmpY, i.scale, 0.6, i.id, false, true, obj) : objectManager.checkItemLocation(tmpX, tmpY, i.scale, 0.6, i.id, false, true)
        if(used !== -1){
            if(!canPlace) usedAngles.splice(used, 1);
            //   continue;
        }

        if(canPlace)potentialAngles.push(obj);
    }
    //showAngles = potentialAngles;
    return potentialAngles;
}
window.placeRange = 200;
window.placeRangeSingleTrap = 160;
window.battleRange = 250
window.battleStartRange = 120
let battling = false;
function isInPath(e){
    if(paths.length &&(pusher == false && pushing) && e.name != "pit trap"){
        for(let i = 0; i< paths.length; i+=2){
            if(cdf({x:paths[i],y:paths[i+1]},e)<=e.scale-7.5){
                return true;
            }
        }

    }
    return false;
}
function knockInto(spike,objs,enemy){
    const obj = {building: null, closest: Infinity, bounce: false, dmg: 0, spikeCount: 0, trapCount: 0, total: 0, newPos: {...enemy}}
    const dir = caf(spike,enemy)
    objs = objs.filter2(x => (player.isTeam(x.owner?.sid) || !enemy.team && x?.owner?.sid != enemy.sid)|| x.y >= 12000 && x.type === 1)
    for(let i = 0; i < objs.length; i++){

        let distance = fastHypot(enemy.x3-objs[i].x, enemy.y3 - objs[i].y)//dist2(enemy,objs[i])
        let closestPoint = calcPoint(enemy.x3, enemy.y3, dir, Math.min(distance, 170));
        obj.newPos.affected = enemy.sid;
        obj.newPos.NEWX = closestPoint.x;
        obj.newPos.NEWY = closestPoint.y;
        obj.originDir = dir;
        obj.newPos.dstSpd = distance;
        obj.newPos.static = true;
        obj.newPos.expire = 3;
        //  fastHypot(player.x2-a.x,player.y2-a.y)
        if(fastHypot(closestPoint.x-objs[i].x, closestPoint.y-objs[i].y) <= (objs[i].name == "pit trap" ? 47.5 : objs[i].realScale + 35) && distance < obj.closest){
            obj.closest = distance
            obj.building = objs[i]
            if(distance <= 150 && distance >= 50 && (objs[i].group?.name == "spikes" || objs[i].type === 1) && dAng(dir,caf(spike,objs[i])) <= .17){
                obj.bounce = true;
            } else {
                obj.bounce = false
            }
        }
    }
    return obj;
    // dAng() <= .19 + 45 distance too
}
function gradeAngles(spike, trap, newEnemies, time) {
    const start = performance.now()
    let bestSpike, bestTrap;
    const overlapDists = {};
    const teamObjects = partitionzion(nearObjects.filter2(x => (x.y >= 12000 && x.type === 1 || (x.name == "pit trap" || x.group?.name == "spikes")) && x.dist2 <= 450), (x => x.type == 1 || player.isTeam(x?.owner?.sid)));
    const spikeOffset = items.list[player.items[2]].scale - 50;
    for(let i = 0; i < newEnemies.length; i++) {
        const enemy = newEnemies[i];
        const sid = enemy.sid;
        const enemyInTrap = enemy.inTrap;
        if (enemyInTrap) enemyInTrap.angToMe = caf(enemy.inTrap, player);
        const spikeNtrap = teamObjects[0].concat(teamObjects[1].filter2(x => !enemy.team && x?.owner?.sid != sid))
        const breakup = partitionzion(spikeNtrap, (x => x.name != "pit trap"));
        const ouchies = breakup[0];
        const tarp = breakup[1];
        const trapMax = trap.length;
        const trap2 = trap;
        const placePotential = enemy.placePot.possible;
        let splicedTraps = 0;
        if (player.items[4] == 15) {
            for(let t = 0; t < trapMax; t++) { //for(let t = trap.length; t--;) {
                const trarp = trap2[t];
                if (!trarp) continue;
                const subkey = trarp.angle+String(sid);
                let angleAbuse = true;
                for(let len = 0; len < placePotential.length; len++){
                    let obj = placePotential[len];
                    const key = subkey+obj;
                    overlapDists[key] = cdf(trarp, obj);
                    if(overlapDists[key] <= trarp.scale + obj.scale) {
                        trarp.placePriority = true;
                        angleAbuse = false;
                        break;
                    }
                }
                if(trarp.preplacer.includes(true) && trarp.placePriority){
                    trarp.preplace = true;
                    trarp.points += 1;
                } else if(trarp.used !== -1){
                    trap.splice(t - splicedTraps, 1);
                    splicedTraps++;
                    continue;
                };
                const plyrDist = UWUTILS.getDist(trarp, enemy, 0, 3);
                if (dAng(caf(player, tarp), enemy.aim2) > 1.3 && trarp.find2((e) => e.dist2 < enemy.dist2 && fastHypot(e.x - x.x2, e.y - x.x2) <= plyrDist)) tarp.points -= 4;
                if(plyrDist <= 100) {
                    trarp.points += 1;
                }
                if(plyrDist <= 20.4) { // stops from placing
                    trarp.points += 1;
                }
                let foundSpike = false;
                let spikePoints = 0;
                for (let indx = 0;indx < ouchies.length;indx++) {
                    let e = ouchies[indx];
                    if (!trarp.sids.includes(e.sid)) {
                        const dist = fastHypot(e.x - trarp.x, e.y - trarp.y) - (e.type == 1 ? e.scale * .55 : e.scale);
                        if (dist <= 43) {
                            spikePoints += 1.5;
                            trarp.canPush = true
                            foundSpike = true;
                        } else if (dist <= 74) {
                            spikePoints++;
                            foundSpike = true;
                        }
                    };
                }
                if(plyrDist <= 47){ // maybe use 50
                    trarp.retrap = true;
                    trarp.collide.push(sid);
                    trarp.points += 2.5;
                    if(!foundSpike) {
                        if(trarp.preplace && enemyInTrap) {
                            trarp.points += 1;
                            // maybe uncomment this again, lets find out later
                            //trarp.points += 1; // 1.5
                            if(UWUTILS.getAngleDist(enemy.aim2, atan2(enemyInTrap.y - enemy.y2, enemyInTrap.x - enemy.x2)) >= 2) {
                                trarp.points += 1;
                            }
                        } else {
                            if(UWUTILS.getAngleDist(enemy.aim2, atan2(trarp.y - enemy.y2, trarp.x - enemy.x2)) >= 2) {
                                trarp.points += 1;
                            }
                        }
                    } else {
                        spikePoints *= 2;
                    }
                }
                trarp.points += spikePoints;
                /* if(!angleAbuse){ // too performance inefficient to use may revisit later
                    let points = tarp.intercepts.length * .25
                    tarp.points += points
                    tarp.origin.push({amount:points,from:'blocks angle',player:x})
                }*/
                if(plyrDist <= enemy.placePot.placeRange) {
                    if(angleAbuse) { // angle abuse
                        trarp.points += 1;
                    } else { // blocks angle
                        trarp.points += .5;
                    }
                }
                if(!bestTrap || bestTrap.points < trarp.points) bestTrap = trarp;
            }
        }
        const spikeMax = spike.length;
        const spike2 = spike;
        let splicedSpikes = 0;
        for(let s = 0; s < spikeMax; s++) { //for(let s = spike.length; s--;){
            const ouchie = spike2[s];
            if (!ouchie) continue;
            ouchie.bounce = false;
            if(isInPath(ouchie)) continue;
            const plyrDist = UWUTILS.getDist(ouchie, enemy, 0, 2);
            if (plyrDist > 300) continue;
            const aim1 = dAng(caf(ouchie, nearHacker), nearHacker.aim2);
            let angleAbuse = true;
            const subkey = spike.angle+String(sid);
            for(let len = 0; len < placePotential.length; len++){
                const obj = placePotential[len];
                const key = subkey+obj;
                if(overlapDists[key] + spikeOffset <= ouchie.scale + obj.scale){
                    ouchie.placePriority = true;
                    angleAbuse = false;
                    break;
                }
            }
            if (ouchie.preplacer.includes(true) && ouchie.placePriority) {
                ouchie.preplace = true;
                ouchie.points += 1;
            } else if (ouchie.used !== -1) {
                spike.splice(s - splicedSpikes, 1);
                splicedSpikes++;
                continue;
            };
            const ouchieAim = caf(player, ouchie);
            if (aim1 > 1.8) ouchie.points += ((aim1 - 1.8) * 4 + 1);
            if ((nearHacker.trapped || tarp.find2((e) => fastHypot(e.x - ouchie.x, e.y - ouchie.y) <= 50 + ouchie.scale)) && dAng(ouchieAim, nearHacker.aim2) >= 1.6) ouchie.points += 1;
            if(plyrDist <= (player.items[4] == 16 ? 50 : 35) + ouchie.scale) {
                if (placeSpike) ouchie.points += 3;
                //if(spike[i].collide.length >=1) spike[i].origin.push({amount:1,from:`collides with ${x.name}[${x.sid}]`,player:x})
                ouchie.collide.push(sid)
                if(!enemyInTrap || ouchie.preplace) {
                    const bouncer = knockInto(ouchie, spikeNtrap, enemy);
                    if(bouncer.building) {
                        ouchie.into = bouncer;
                        if(bouncer.building.name == "pit trap" && !(ouchie.preplace && enemyInTrap && ouchie.sids.includes(enemyInTrap.sid))){
                            ouchie.points += 3.5;
                            //spike[i].origin.push({amount:1.5,from:'spike knocks into trap',player:x})
                        } else if(bouncer.bounce){
                            ouchie.bounce = true;
                            ouchie.points += 8;
                            instaC.canZpykeTick = true;
                            //spike[i].origin.push({amount:2,from:'knocks between spike infinitely test',player:x})
                        } else if(bouncer.building.name !== "pit trap"){
                            ouchie.points += 4;
                            instaC.wantZpyklerTick = true;
                            //spike[i].origin.push({amount:2,from:'knocks into spike',player:x})
                        } else {
                            ouchie.into = false
                        }
                    }
                }
                if(enemy.inTrap && !ouchie.sids.includes(enemyInTrap.sid)) { // spike collides with player while in trap
                    ouchie.points += 4.5;
                    ouchie.spikeTrap = true;
                    ouchie.canPush = true;
                }
            }
            if (enemyInTrap) {
                if(!ouchie.sids.includes(enemyInTrap.sid) && UWUTILS.getDist(ouchie, enemyInTrap, 0, 0) <= 50 + ouchie.scale + 21) { // possible autopush spike
                    ouchie.canPush = true;
                    ouchie.points += 1;
                }
                if(plyrDist <= 250 && (dAng(ouchieAim, enemyInTrap.angToMe) >= 2 || clientMoveDir === null || clientMoveDir === undefined)) { // spike surrounds trapped player
                    ouchie.points += 2;
                }
            }
            if(angleAbuse && plyrDist <= enemy.placePot.placeRange) { // angle abuse
                ouchie.points += 1;
            }
             // spike surrounds trapped player
            if(dAng(ouchieAim, nearHacker.aim2) < 1.3 && aim1 < 1.3) { // blocks path
                ouchie.points -= 2;
            }
            if(!bestSpike || bestSpike.points <= ouchie.points) bestSpike = ouchie;
        }
    }
    console.log(performance.now() - start)
    return {
        spikes: spike,
        traps: trap,
        bestSpike: bestSpike,
        bestTrap: bestTrap
    }
}
function enemyPlacement(enemy, item, gAng, xd = PI / 25) {
    const interval = xd;
    const potentialAngles = { onPlayer: [], possible: [], placeRange: null };
    const i = items.list[item];
    const baseScale = 35 + i.scale + (i.placeOffset || 0);

    for (let offset = gAng; offset <= gAng + PI2; offset += interval) {
        const angle = offset;
        const tmpS = baseScale;
        const cosAngle = cos(angle);
        const sinAngle = sin(angle);
        const tmpX = enemy.x2 + tmpS * cosAngle;
        const tmpY = enemy.y2 + tmpS * sinAngle;
        const obj = { x: tmpX, y: tmpY, scale: i.scale, angle: angle, placeRange: tmpS, overlap: [], preplacer: [], sids: [] };
        const canPlace = objectManager.checkItemLocation3(tmpX, tmpY, i.scale, 0.6, i.id, false, true, obj);
        if (cdf({ x: tmpX, y: tmpY }, player) <= i.scale + 35) {
            if (canPlace) {
                potentialAngles.onPlayer.unshift(obj);
            }
        }
        if (canPlace) {
            potentialAngles.possible.unshift(obj);
        }
    }
    return potentialAngles;
}
function checkPlacement(obj, priority, ppAmt, timer, canPlace){
    //console.log(obj, priority, ppAmt, timer, canPlace);
    if(obj.preplace && obj.placePriority && ppAmt < 2 && secPacket <= 60){
        console.log("prio")
        setTimeout(() => {
            placers(obj.item.id,obj.angle);
            prioLoc.push(obj);
        }, game.tickRate - window.pingTime)
        return true;
    } else if(obj.placePriority && ppAmt < 3 && secPacket <= 60){
        console.log("prio")
        placers(obj.item.id,obj.angle)
        prioLoc.push(obj);
        return true;
    }
    canPlace = objectManager.checkItemLocation(obj.x, obj.y, obj.scale, .6, obj.item.id, false)
    if(canPlace){
        placers(obj.item.id,obj.angle)
        return true;
    }
    return false;
}
function check3(id, rad) {
    const foodType = player.items[0];
    if(id==null||id==undefined||!inGame) return;
    const item = items.list[player.items[id]];
    const tmpS = 35 + item.scale + (item.placeOffset || 0);
    const tmpX = player.x2 + cos(rad) * tmpS,
          tmpY = player.y2 + sin(rad) * tmpS
    if (objectManager.checkItemLocation3(tmpX, tmpY, item.scale, .6, id, false, false, {preplacer: [], sids: [], overlap: []})) {
        place(placeSpike ? 2 : id, rad);
        return true;
    }
    return false;
}
function placers(id, ang){
    const foodType = player.items[0];
    let id2 = 2;
    if (id != player.items[2]) {
        id2 = 4;
    }
    if(id==null||id==undefined||!inGame||id==foodType && (player.skinIndex==45 || player.food<items.list[foodType].req[1])) return;
    console.log("place", id, ang)
    console.log("TIME: ", performance.now() - calculationStartTime)
    check3(id2, ang)
}
let calculationStartTime = 0;
function autoplacers(trap, spike) {
    if (battling && (!nearHacker.sid || nearHacker.dist2 > 450)) {
        battling = false;
    }
    if(!configs.autoPlace||!nearHacker.sid||!inGame||!config.isSandbox && nearHacker.dist3 > (battling ? window.battleRange : window.placeRange)) return;
    calculationStartTime = performance.now();
    const spikeType = player.items[2];
    const boostType = player.items[4];
    let timer = Date.now();
    let preplaceAmt = 0;
    const possibleSpikes = findAvailableAngles(spikeType, 0, 0, PI / 100)
    const possibleTraps = findAvailableAngles(boostType, 0, 0, PI / 100)
    const placer = gradeAngles(possibleSpikes, possibleTraps, enemy, timer);
    usedAngles = usedAngles.filter2(x => game.tick-x.tick <= 6 && cdf(player,x) <= x.offset + 20);
    trap = placer.bestTrap;
    spike = placer.bestSpike;
    placer.spikes.sort((a, b) => b.points - a.points);
    placer.traps.sort((a, b) => b.points - a.points);
    // sort spikes and traps by highest points
    if(!placer.spikes.length && !placer.traps.length) return;
    function fullplace(e, all = placer.spikes.concat(placer.traps)){
        //  all = all.sort((a, b) => b.points - a.points);
        all = all.filter2(x => x.points > 0);
        if (all.length > 0) battling = true;
        if(secPacket >= 85) return;
        if(!spike&&!trap&&!keys.c) return;
        all = all.sort((a, b) => {
            if (b.points === a.points && a.name !== b.name) {
                // If points are the same and names are different, prioritize spike
                return a.name !== 'pit trap' ? -1 : 1;
            }
            return b.points - a.points;
        });
        for(let i = 0; i < all.length; i++) { // check for any intersections lol
            const objekt = all[i];

            if(!e.some(item => cdf(item, objekt) <= item.scale + objekt.scale)){
                e.push(objekt)
            };
            if(e.length === 4) break;
        }
        for(let i = 0; i < e.length; i++) {
            const objekt = e[i];
            if(!objekt.did) { // !.did only for the bestSpike and bestTrap placements
                if(objekt.preplace && objekt.placePriority && secPacket <= 60) preplaceAmt++;
                checkPlacement(objekt, secPacket <= 60 ? objekt.placePriority : 0, preplaceAmt, timer)
                usedAngles.push({...objekt, tick: game.tick});
            }
        }
        //ee.send("z", hold ? hold : E.weaponIndex, true)
    }
    let placing = [];
    if(spike && spike.points>0 && (!trap?.canPush || (!trap?.retrap || !spike.into))) {
        if(spike.placePriority) {
            if(spike.preplace){
                preplaceAmt++
                setTimeout(() => {
                    console.log("place")
                    placers(spikeType, spike.angle)
                    usedAngles.push({...spike, tick: game.tick});
                    prioLoc.push(spike);
                }, game.tickRate - window.pingTime);
            } else {
                console.log("place")
                placers(spikeType, spike.angle)
                usedAngles.push({...spike, tick: game.tick});
                prioLoc.push(spike);
            };
            spike.did = true;
            placing.push(spike);
        } else {
            console.log("place")
            checkPlacement(spike, 0)
            usedAngles.push({...spike, tick: game.tick});
            spike.did = true;
            placing.push(spike);
        }
    }
    if(trap && trap.points > 0 && !(spike && spike.points>0 && cdf(trap,spike) <= trap.scale+spike.scale && !isInPath(spike))|| (trap?.canPush || trap?.retrap && !spike.into)) {
        if(trap.placePriority) {
            if(trap.preplace) {
                preplaceAmt++
                setTimeout(() => {
                    console.log("place")
                    placers(boostType, trap.angle)
                    usedAngles.push({...trap, tick: game.tick});
                    prioLoc.push(trap);
                }, game.tickRate - window.pingTime);
            } else {
                console.log("place")
                placers(boostType, trap.angle)
                usedAngles.push({...trap, tick: game.tick});
                prioLoc.push(trap);
            };
            trap.did = true;
            placing.push(trap);
        } else {
            console.log("place")
            checkPlacement(trap, 0)
            usedAngles.push({...trap, tick: game.tick});
            trap.did = true;
            placing.push(trap);
        }
    }
    fullplace(placing);
}
// ITEM COUNT DISPLAY:
let isItemSetted = [];

function updateItemCountDisplay(index = undefined) {
    for (let i = 3; i < 23; ++i) {
        let id = items.list[i].group.id;
        let tmpI = 16 + i;
        if (!isItemSetted[tmpI]) {
            isItemSetted[tmpI] = document.createElement("div");
            isItemSetted[tmpI].id = "itemCount" + tmpI;
            getEl("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);
            isItemSetted[tmpI].style = `
                            display: block;
                            position: absolute;
                            padding-left: 5px;
                            font-size: 2em;
                            color: #fff;
                            `;
            isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
        } else {
            if (index == id)
                isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
        }
    }
}
let nearestTeammate;
const workerScript = "(" + (() => {
    const { sqrt, abs, floor } = Math;
    const { MAX_VALUE } = Number;
    const sqrt2 = sqrt(2);
    const dist = function(a, b) {
        return Math.hypot((a.y2 || a.y) - (b.y2 || b.y), (a.x2 || a.x) - (b.x2 || b.x));
    }

    const mapSize = 900;
    const intervalSize = 12;
    const interval = intervalSize / 2;

    const cleanMap = JSON.stringify(new Array(Math.round(mapSize / intervalSize)).fill([]));
    const length = JSON.parse(cleanMap).length;

    const points = [0, -1, 0, 1, -1, 0, 1, 0, 1, 1, 1, -1, -1, 1, -1, -1];
    const pointsLength = points.length;

    const colArray = ["boost pad", "teleporter"];

    function calculateDistance(x1, y1, x2, y2) {
        return sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }

    function calculateCost(x1, y1, x2, y2) {
        const dx = abs(x1 - x2);
        const dy = abs(y1 - y2);
        return ((dx === 0) + (dy === 0)) * intervalSize + (dx !== 0 && dy !== 0) * intervalSize * sqrt2;
    }

    function generateMap(x, y, buildings, tx, ty) {
        let map = JSON.parse(cleanMap),
            targetNode = 0,
            startNode = 0;
        for (let i = 0; i < length; i++) {
            let row = map[i];
            for (let i2 = 0; i2 < length; i2++) {
                let obj = (row[i2] = {
                    x: i * intervalSize - mapSize / 2 + x,
                    y: i2 * intervalSize - mapSize / 2 + y,
                    obstacle: false,
                    available: 1,
                    n: i * length + i2,
                });
                if (obj.x < 0 || obj.x > 14400 || obj.y < 0 || obj.y > 14400) {
                    obj.obstacle = 1;
                    continue;
                }
                for (let e = 0;e < buildings.length;e++) {
                    let tmp = buildings[e];
                    if ((obj.obstacle = abs(tmp.x - obj.x) <= tmp.pathScale + 20 && abs(tmp.y - obj.y) <= tmp.pathScale + 20 &&
                         dist(tmp, obj) - tmp.pathScale - 20 <= 0)) break;
                }
                obj.target = abs(obj.x - tx) <= interval && abs(obj.y - ty) <= interval;
                targetNode = obj.target * obj.n + !obj.target * targetNode;
                obj.start = abs(obj.x - x) <= interval && abs(obj.y - y) <= interval;
                startNode = obj.start * obj.n + !obj.start * startNode;
                obj.fCost = obj.start * -MAX_VALUE;
                obj.gCost = !obj.start * MAX_VALUE;
                //   obj.hCost = calculateDistance(obj.x, obj.y, tx, ty);
                if (obj.target + obj.start > 0) continue;
            }
        }
        return { map: map, targetNode: targetNode, startNode: startNode };
    }

    onmessage = function (message) {
        let { player, target, buildings, clan, } = message.data;
        if (calculateDistance(player.x2, player.y2, target.x, target.y) <= 0) {
            console.log("reached")
            return postMessage("reached target");
        }
        let { map, startNode, targetNode } = generateMap(
            player.x2,
            player.y2,
            buildings.filter2((building) => calculateDistance(building.x, building.y, player.x2, player.y2) < mapSize),
            target.x,
            target.y
        );

        let openNodes = [],
            closedNodes = [],
            currentNode,
            maxIterations = 100000;
        openNodes.push(startNode);
        while (openNodes.length * maxIterations--) {
            let lowest = Infinity, index;
            for (let i = openNodes.length, tmp; i--; ) {
                tmp = map[floor(openNodes[i] / length)][openNodes[i] % length];
                if (tmp.fCost < lowest) {
                    currentNode = tmp;
                    lowest = tmp.fCost;
                    index = i;
                }
            }

            openNodes.splice(index, 1);
            closedNodes.push(currentNode.n);

            if (currentNode.target) break;

            for (let i = 0, module; i < pointsLength; i++) {
                module = map[floor(currentNode.n / length) + points[i]]?.[currentNode.n % length + points[i + 1]];
                if (!module || closedNodes.includes(module.n)) continue;
                let gCost = currentNode.gCost + calculateCost(points[i], points[i + 1], 0, 0);
                if (!module.obstacle && module.available === 1) {
                    if (!openNodes.includes(module.n)) {
                        module.parent = currentNode.n;
                        module.gCost = gCost;
                        module.hCost = calculateDistance(module.x, module.y, target.x, target.y);
                        module.fCost = gCost + module.hCost;
                        openNodes.push(module.n);
                    } else if (gCost < module.gCost) {
                        module.parent = currentNode.n;
                        module.gCost = gCost;
                        module.fCost = gCost + module.hCost;
                    }
                }
            }
        }

        if (maxIterations === 0) {
            console.log("max")
            return postMessage("reached max iterations");
        }
        if (!openNodes.length) {
            console.log("no path")
            return postMessage("couldn't reach target");
        }

        openNodes = [];

        while (!currentNode.start) {
            openNodes.push(currentNode.y, currentNode.x);
            currentNode = map[floor(currentNode.parent / length)][currentNode.parent % length];
        }

        postMessage(openNodes.reverse());
    };
}).toString() + ")();";
var paths = [];
var workers = [];
var available = [];

function pathfind(info) {
    return new Promise((resolve, reject) => {
        try {
            let workerIndex = -1;
            for (let i = 0; i < available.length; i++) {
                if (available[i]) {
                    workerIndex = i;
                    available[i] = false;
                    workers[i].postMessage(info);
                    break;
                }
            }
            if (workerIndex === -1) {
                createWorker();
                workerIndex = workers.length - 1;
                available.push(false);
                workers[workerIndex].postMessage(info);
            }

            function onMessage(message) {
                let pathFound = false;
                if (typeof message.data === "string") {
                    paths = []
                    pathFound = false;
                } else {
                    paths = message.data
                    pathFound = message.data.length > 0;
                }
                setAvailable(workers[workerIndex]);
                resolve(pathFound);
            }

            function onError(error) {
                reject(error);
            }

            workers[workerIndex].onmessage = onMessage;
            workers[workerIndex].onerror = onError;
        } catch (e) {
            console.error(e)
        }
    });
}



function createWorker() {
    let worker = new Blob([workerScript]);
    let url = URL.createObjectURL(worker);
    worker = new Worker(url);
    workers.push(worker);
    available.push(true);
}

function setAvailable(worker) {
    for (let i = workers.length; i--; ) {
        if (workers[i] === worker) {
            available[i] = true;
            return;
        }
    }
}
function dot(a, x, y){
    return (a.x*x+a.y*y)/(a.x*y-a.y*x);
}
function calcNewVel(_,ang,set,docalc,time) {
    let tmpPlyr = _;
    let xVel = tmpPlyr.x3 - tmpPlyr.x2;
    let yVel = tmpPlyr.y3 - tmpPlyr.y2;
    let x2 = _.x3;
    let y2 = _.y3;
    if (typeof time !== "number") {
        time = game.tickRate;
    }
    let { sin, cos, pow, sqrt, max, round, min} = Math;
    //  if(!time) time =111;
    //if(!isNaN(ang)){
    if(!docalc){
        if(_.sid == player.sid && ang !== 0 && !ang) {
            ang = getMoveDir();
        } else if (_.trapped) {
            ang = undefined
        } else if (!ang&&ang!==0) {
            ang = _.movDir
        }
    }
    //  }
    let cosX = cos(ang)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
    let sinY = sin(ang)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
    let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
    sqrtDis!=0 && (cosX /= sqrtDis,sinY /= sqrtDis)
    if(!set) set = _;
    let mult = set.maxSpeed;
    _.speedXD = 0;
    _.speedYD = 0;
    _.predY = 0;
    _.predX = 0;
    cosX && (_.speedXD += cosX * .0016 * mult * time)
    sinY && (_.speedYD += sinY * .0016 * mult * time)
    var y0 = UWUTILS.getDistance(0, 0, _.speedXD * time, _.speedYD * time), k0 = min(4, max(1, round(y0 / 40))), v0 = 1 / k0
    //  U = Math.min(4, Math.max(1, Math.round(O / 40)))
    // console.log(v0)
    // console.log(_.speedXD,_.speedYD)
    _.speedXD && (_.predX += _.speedXD * time)
    _.speedYD && (_.predY += _.speedYD * time)
    //  console.log(v0)
    let velXD = xVel*pow(.993,time),
        velYD = yVel*pow(.993,time),
        velX = velXD+_.predX,
        velY = velYD+_.predY,
        accel = {x:x2+velX,y:y2+velY,type:'accel'},
        decel = {x:x2+velXD,y:y2+velYD,type:'decel'},
        current = {x:x2,y:y2,type:"current"},
        nextVel = {x:velX,y:velY,type:'nextVel'},
        real = accel,
        vel = sqrt(velX * velX + velY * velY),
        spd = mult,
        //  realxVel = Math.abs(Math.round(Math.sqrt(velX * velX))),
        // realyVel = Math.abs(Math.round(Math.sqrt(velY * velY)))
        boostxVel, boostyVel;
    //console.log(velX,velY)
    //  console.log(E.xVel,E.yVel,velX,velY)
    boostxVel = time * 1.5 * cos(ang);
    boostyVel = time * 1.5 * sin(ang);
    let boostCoords = { x: x2 + boostxVel, y: y2 + boostyVel };
    if(_?.velocity!=undefined&&_.sid!=player.sid)real = cdf(_, _.oldPos) == 0 || (cdf(_,_.velocity?.accel)>cdf(_,_.velocity?.decel)&&dAng(_.movDir,_.pmovDir)<=.3)||_.trapped?decel:accel;
    if(_.sid==player.sid){
        if(getMoveDir() == undefined||clientMoveDir == null){
            real = decel;
        } else {
            real = accel;
        }
    }
    function fulldecel(e,t,coords,e2,t2){
        if(isNaN(e)||isNaN(t))return;
        try{
            e2 = e*decayRate;
            t2 = t*decayRate;
            if(e!=e2){ e = e2
                      coords.x+=e
                     }
            if(t!=t2){ t = t2
                      coords.y+=t

                     }
            if(e==e2&& t==t2){
                return {x:coords.x,y:coords.y,type:'full decel'}
            } else{
                //  console.log(e,t,coords)
                return fulldecel(e,t,coords)
            }
        } catch(e){}
    }
    let fullDecel = fulldecel(velX,velY,{x:x2+velX,y:y2+velY});
    let result = {accel:accel,decel:decel,boostCoords:boostCoords,boostVel:{x:boostxVel,y:boostyVel},nextVel:nextVel,real:real,current:current,fullDecel:fullDecel,xVel:velX, spd: mult, yVel:velY,vel:vel}
    return result
}
function calcFVel(_,ang,set,docalc,time) {
    let tmpPlyr = _;
    let xVel = tmpPlyr.x4 - tmpPlyr.x3;
    let yVel = tmpPlyr.y4 - tmpPlyr.y3;
    let x2 = _.x4;
    let y2 = _.y4;
    if (typeof time !== "number") {
        time = game.tickRate;
    }
    let { sin, cos, pow, sqrt, max, round, min} = Math;
    //  if(!time) time =111;
    //if(!isNaN(ang)){
    if(!docalc){
        if(_.sid == player.sid && ang !== 0 && !ang) {
            ang = getMoveDir();
        } else if (_.trapped) {
            ang = undefined
        } else if (!ang&&ang!==0) {
            ang = _.movDir
        }
    }
    //  }
    let cosX = cos(ang)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
    let sinY = sin(ang)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
    let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
    sqrtDis!=0 && (cosX /= sqrtDis,sinY /= sqrtDis)
    if(!set) set = _;
    let mult = set.maxSpeed;
    _.speedXD = 0;
    _.speedYD = 0;
    _.predY = 0;
    _.predX = 0;
    cosX && (_.speedXD += cosX * .0016 * mult * time)
    sinY && (_.speedYD += sinY * .0016 * mult * time)
    var y0 = UWUTILS.getDistance(0, 0, _.speedXD * time, _.speedYD * time), k0 = min(4, max(1, round(y0 / 40))), v0 = 1 / k0
    //  U = Math.min(4, Math.max(1, Math.round(O / 40)))
    // console.log(v0)
    // console.log(_.speedXD,_.speedYD)
    _.speedXD && (_.predX += _.speedXD * time)
    _.speedYD && (_.predY += _.speedYD * time)
    //  console.log(v0)
    let velXD = xVel*pow(.993,time),
        velYD = yVel*pow(.993,time),
        velX = velXD+_.predX,
        velY = velYD+_.predY,
        accel = {x:x2+velX,y:y2+velY,type:'accel'},
        decel = {x:x2+velXD,y:y2+velYD,type:'decel'},
        current = {x:x2,y:y2,type:"current"},
        nextVel = {x:velX,y:velY,type:'nextVel'},
        real = accel,
        vel = sqrt(velX * velX + velY * velY),
        spd = mult,
        //  realxVel = Math.abs(Math.round(Math.sqrt(velX * velX))),
        // realyVel = Math.abs(Math.round(Math.sqrt(velY * velY)))
        boostxVel, boostyVel;
    //console.log(velX,velY)
    //  console.log(E.xVel,E.yVel,velX,velY)
    boostxVel = time * 1.5 * cos(ang);
    boostyVel = time * 1.5 * sin(ang);
    let boostCoords = { x: x2 + boostxVel, y: y2 + boostyVel };
    if(_?.velocity!=undefined&&_.sid!=player.sid)real = cdf(_, _.oldPos) == 0 || (cdf(_,_.velocity?.accel)>cdf(_,_.velocity?.decel)&&dAng(_.movDir,_.pmovDir)<=.3)?decel:accel;
    if(_.sid==player.sid){
        if(getMoveDir() == undefined||clientMoveDir == null){
            real = decel;
        } else {
            real = accel;
        }
    }
    function fulldecel(e,t,coords,e2,t2){
        if(isNaN(e)||isNaN(t))return;
        try{
            e2 = e*decayRate;
            t2 = t*decayRate;
            if(e!=e2){ e = e2
                      coords.x+=e
                     }
            if(t!=t2){ t = t2
                      coords.y+=t

                     }
            if(e==e2&& t==t2){
                return {x:coords.x,y:coords.y,type:'full decel'}
            } else{
                //  console.log(e,t,coords)
                return fulldecel(e,t,coords)
            }
        } catch(e){}
    }
    let fullDecel = fulldecel(velX,velY,{x:x2+velX,y:y2+velY});
    let result = {accel:accel,decel:decel,boostCoords:boostCoords,boostVel:{x:boostxVel,y:boostyVel},nextVel:nextVel,real:real,current:current,fullDecel:fullDecel,xVel:velX, spd: mult, yVel:velY,vel:vel}
    return result
}
function calcMVel(_,ang,set,docalc,time) {
    let tmpPlyr = _;
    let xVel = tmpPlyr.x5 - tmpPlyr.x4;
    let yVel = tmpPlyr.y5 - tmpPlyr.y4;
    let x2 = _.x5;
    let y2 = _.y5;
    if (typeof time !== "number") {
        time = game.tickRate;
    }
    let { sin, cos, pow, sqrt, max, round, min} = Math;
    //  if(!time) time =111;
    //if(!isNaN(ang)){
    if(!docalc){
        if(_.sid == player.sid && ang !== 0 && !ang) {
            ang = getMoveDir();
        } else if (_.trapped) {
            ang = undefined
        } else if (!ang&&ang!==0) {
            ang = _.movDir
        }
    }
    //  }
    let cosX = cos(ang)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
    let sinY = sin(ang)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
    let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
    sqrtDis!=0 && (cosX /= sqrtDis,sinY /= sqrtDis)
    if(!set) set = _;
    let mult = set.maxSpeed;
    _.speedXD = 0;
    _.speedYD = 0;
    _.predY = 0;
    _.predX = 0;
    cosX && (_.speedXD += cosX * .0016 * mult * time)
    sinY && (_.speedYD += sinY * .0016 * mult * time)
    var y0 = UWUTILS.getDistance(0, 0, _.speedXD * time, _.speedYD * time), k0 = min(4, max(1, round(y0 / 40))), v0 = 1 / k0
    //  U = Math.min(4, Math.max(1, Math.round(O / 40)))
    // console.log(v0)
    // console.log(_.speedXD,_.speedYD)
    _.speedXD && (_.predX += _.speedXD * time)
    _.speedYD && (_.predY += _.speedYD * time)
    //  console.log(v0)
    let velXD = xVel*pow(.993,time),
        velYD = yVel*pow(.993,time),
        velX = velXD+_.predX,
        velY = velYD+_.predY,
        accel = {x:x2+velX,y:y2+velY,type:'accel'},
        decel = {x:x2+velXD,y:y2+velYD,type:'decel'},
        current = {x:x2,y:y2,type:"current"},
        nextVel = {x:velX,y:velY,type:'nextVel'},
        real = accel,
        vel = sqrt(velX * velX + velY * velY),
        spd = mult,
        //  realxVel = Math.abs(Math.round(Math.sqrt(velX * velX))),
        // realyVel = Math.abs(Math.round(Math.sqrt(velY * velY)))
        boostxVel, boostyVel;
    //console.log(velX,velY)
    //  console.log(E.xVel,E.yVel,velX,velY)
    boostxVel = time * 1.5 * cos(ang);
    boostyVel = time * 1.5 * sin(ang);
    let boostCoords = { x: x2 + boostxVel, y: y2 + boostyVel };
    if(_?.velocity!=undefined&&_.sid!=player.sid)real = cdf(_, _.oldPos) == 0 || (cdf(_,_.velocity?.accel)>cdf(_,_.velocity?.decel)&&dAng(_.movDir,_.pmovDir)<=.3)?decel:accel;
    if(_.sid==player.sid){
        if(getMoveDir() == undefined||clientMoveDir == null){
            real = decel;
        } else {
            real = accel;
        }
    }
    function fulldecel(e,t,coords,e2,t2){
        if(isNaN(e)||isNaN(t))return;
        try{
            e2 = e*decayRate;
            t2 = t*decayRate;
            if(e!=e2){ e = e2
                      coords.x+=e
                     }
            if(t!=t2){ t = t2
                      coords.y+=t

                     }
            if(e==e2&& t==t2){
                return {x:coords.x,y:coords.y,type:'full decel'}
            } else{
                //  console.log(e,t,coords)
                return fulldecel(e,t,coords)
            }
        } catch(e){}
    }
    let fullDecel = fulldecel(velX,velY,{x:x2+velX,y:y2+velY});
    let result = {accel:accel,decel:decel,boostCoords:boostCoords,boostVel:{x:boostxVel,y:boostyVel},nextVel:nextVel,real:real,current:current,fullDecel:fullDecel,xVel:velX, spd: mult, yVel:velY,vel:vel}
    return result
}
let pushing = false;
let moveAuto = undefined;
let pusher = false;
let sTE, pTE, tTE, dPAP, apS, sos3;
let pushPosition = "not";
var mySpeed,DefaultSpeed = 65,pushVector = {x:null,y:null,objs:[],dev:null,dir:null},pushCoords = {x:null,y:null}
function wyndAP(Z,t,b,GG,_,enemyV,useVel){
    console.log("wyndAP")
    const objekts = liztobj.filter2((e) => e.active && (e.dmg && (e?.owner?.sid == player.sid || player.isTeam(e?.owner?.sid) || !nearHacker.team && e?.owner?.sid != nearHacker.sid) || (e.type === 1 && e.y >= 12000)) && cdf(nearHacker.inTrap, e) <= 76 + (e.type === 1 ? e.scale*0.6 : e.scale))
    if (!nearHacker.trapped || objekts.length == 0) {
        pushing = false;
        pusher = false;
        pushPosition = 'not';
        pushVector = 'not'
        pushCoords = 'not'//{x:null,y:null}
        sendMoveDir()
        return false;
    }
    // addChatLog(`${dist(nearHacker,nearHacker.np.decel)} ${tick}`,'', '#5c0620',false,true);
    let overrideDir;
    pushing = false;
    pusher = false;
    // useVel = true;
    //  enemyV = useVel ? nearHacker.np.decel : nearHacker
    Z = nearHacker.aim2
    pushVector = {x:Math.cos(Z), y:Math.sin(Z),objs:[],dev:null,dir:null};

    for(let i = 0;i < liztobj.length;i++){
        _ = liztobj[i];
        if(nearHacker.trapInfo2.sid === _.sid || !_.dmg && (_.type != 1 || _.y < 12000)) continue;
        // id 6-9 are all spikes
        if(cdf(nearHacker.trapInfo2, _) <= 85 + (_.dmg ? _.scale : _.scale * 0.6) && (_.dmg && (_?.owner?.sid == player.sid || !nearHacker.team && _?.owner?.sid != nearHacker.sid) || (_.type === 1 && _.y >= 12000))
           || pushVector.objs.length === 1 && cdf(_, nearHacker.inTrap) <= 77 + _.realScale && cdf(_,pushVector.objs[0]) <= pushVector.objs[0].scale + _.scale + 42.5 && !_.ignoreCollision){
            let a = Math.atan2(_.y - nearHacker.y2, _.x - nearHacker.x2);
            let d = 170 - cdf(_, nearHacker);
            if(pushVector.objs.length > 0 && dAng(caf(_,nearHacker.inTrap),caf(pushVector.objs[0],nearHacker.inTrap)) <= 1.9 && cdf(_,pushVector.objs[0])<=_.scale+pushVector.objs[0].scale+67.5|| !pushVector.objs.length){
                pushVector.x += d * Math.cos(a);
                pushVector.y += d * Math.sin(a);

                if(pushVector.objs[0])console.log(dAng(caf(_,nearHacker.inTrap),caf(pushVector.objs[0],nearHacker.inTrap)),Math.round(cdf(_,pushVector.objs[0]))-(pushVector.objs[0].scale + _.scale));
                // console.log(pushVector.objs.length, dist(_, nearHacker.inTrap) <= 50 + _.scale + 15 , pushVector.objs.length && dist(_,pushVector.objs[0]) <= pushVector.objs[0].scale + _.scale + 21, !_.ignoreCollision)
                pushVector.objs.push(_)
            }

            if(dot(pushVector, nearHacker.inTrap.x - nearHacker.x2, nearHacker.inTrap.y - nearHacker.y2) > 0){
                pushVector.x += (nearHacker.inTrap.x - nearHacker.x2)*2;
                pushVector.y += (nearHacker.inTrap.y - nearHacker.y2)*2;
            }
        }
    }// 36 lowest so far
    console.log(nearHacker.trapInfo2, pushVector)
    if(Math.hypot(pushVector.x, pushVector.y) > 5){
        console.log("wyndAP")
        const spike = pushVector.objs[0];
        if (dAng(nearHacker.aim2, spike.aim2) > Math.PI / 5) {
            pushing = false;
            pusher = false;
            pushPosition = 'not';
            pushVector = 'not'
            pushCoords = 'not'//{x:null,y:null}
            sendMoveDir()
            return false;
        }
        const distToEnemy = cdf(nearHacker,player)
        const tau = dAng(Z, Math.atan2(pushVector.y, pushVector.x));
        const decide = cdf(nearHacker,spike)<=spike.scale+38.75
        const opposite = 3600 + Math.pow(distToEnemy, 2) - (28.5+(decide ? 71.5 : 0)) * distToEnemy * Math.cos(tau);
        const deviance = Math.acos((Math.pow(distToEnemy, 2) + opposite - 3600)/(2 * distToEnemy * Math.sqrt(opposite)));
        const sign = Math.sign((nearHacker.x2 - player.x2) * (pushVector.y) - (nearHacker.y2 - player.y2) * (pushVector.x))
        if(deviance){
            overrideDir = Z - sign * deviance;
            let distanceToTarget = UWUTILS.getDist(spike, player, 0, 2) - spike.scale - 105;
            pushCoords = {x: player.x2 + distanceToTarget * Math.cos(overrideDir),
                          y: player.y2 + distanceToTarget * Math.sin(overrideDir)};
            let p2 = {...player}
            p2.buildIndex = -1;
            p2.tailIndex = my.predictTail;
            p2.skinIndex = my.predictHat;
            p2.weaponIndex = player.weaponIndex;
            let newPos = calcVel(player, overrideDir, p2, 1).accel;
            let foundObj = null;
            for (let i = 0; i < liztobj.length; i++) {
                const e = liztobj[i];
                if (e.ignoreCollision) continue;
                if (e.type === 1 && e.y <= 12000) continue;
                if ((e.dmg || e.trap) && e.owner.sid != player.sid) continue;
                const r = e.getScale() + 35;
                const dx = newPos.x - e.x, dy = newPos.y - e.y;
                if (dx * dx + dy * dy <= r * r) {
                    foundObj = e;
                    break;
                }
            }
            if (foundObj) {
                newPos = {x:player.x2,y:player.y2}
                console.log("foundobj")
                let velocity2 = player.velocity.vel * .1;
                for (let i = 0;i < 2;i++) {
                    const positionnnn = calcPoint(newPos.x, newPos.y, getMoveDir(), velocity2);
                    newPos = calcPoint(positionnnn.x, positionnnn.y, caf(foundObj, positionnnn), (foundObj.scale + 37) - Math.floor(cdf(positionnnn, foundObj)))
                    velocity2 *= 0.75;
                }
            }
            const pushThreat = runInto(player, overrideDir, calcVel(player, overrideDir, p2, 1));
            console.log("wyndAP")
            if(!nearHacker.hitSpike && nearObjects.filter2((e) => e.trap && e?.owner?.sid == player.sid && cdf(e, newPos) <= 50)?.length >= 2){
                if (pushThreat || UWUTILS.checkLineCollision(overrideDir, player, liztobj.filter((e) => e.dmg && e?.owner?.sid && e?.owner?.sid != player.sid), 35, 0, nearHacker.dist2 - 70)) {
                    sendMoveDir()
                    return;
                }
                if (foundObj) {
                    console.log("found obj")
                    const newDist = cdf(newPos, nearHacker);
                    if (newDist <= 35) {
                        let currentx = nearHacker.x2;
                        let currenty = nearHacker.y2;
                        const direct = caf(newPos, nearHacker)
                        currentx += Math.cos(direct) * (35 - (Math.abs(newPos.x - nearHacker.x)))
                        currenty += Math.sin(direct) * (35 - (Math.abs(newPos.y - nearHacker.y)))
                        const distance = hypot(currentx - nearHacker.trapinfo2.x, currenty - nearHacker.trapinfo2.y);
                        console.log(distance)
                        if (distance > 40) {
                            player.chat.message = "Avoid push out";
                            player.chat.count = 1000;
                            hitTank(findObj.aim2, 10);
                            packet("9", undefined, 1, "autopush")
                            return;
                        } else {
                            packet('9',overrideDir,1,'autopush')
                            pushVector.dev = deviance
                            pushVector.dir = overrideDir;
                            return;
                        }
                    } else {
                        packet('9',overrideDir,1,'autopush')
                        pushVector.dev = deviance
                        pushVector.dir = overrideDir;
                        return;
                    }
                } else {
                    packet('9',overrideDir,1,'autopush')
                    pushVector.dev = deviance
                    pushVector.dir = overrideDir;
                    return;
                }
                packet('9',overrideDir,1,'autopush')
                pushVector.dev = deviance
                pushVector.dir = overrideDir;
            }else{
                sendMoveDir()
            }
            pushing = true;
            pusher = true;
        }else{
            sendMoveDir()
        }
    }else{
        sendMoveDir()
    }
}
function moveToPath(time,distance, x){
    console.log("moveToPath")
    if (paths && paths.length && (keys.z || pusher==false&&pushing)) {
        let spliceIndex = 0,startIndex=0;;
        while (startIndex < paths.length) {
            const pointX = paths[startIndex];
            const pointY = paths[startIndex + 1];
            const distanceToPlayer = Math.sqrt((player.x2 - pointX) ** 2 + (player.y2 - pointY) ** 2);
            let threshold = x ? 10 : 35
            if (distanceToPlayer <= threshold) {
                spliceIndex += 2;
            } else{
                if(!pushing) break;
            }
            if(pushing&&distanceToPlayer>distance){
                return false
            }
            startIndex += 2;
        }

        if (spliceIndex + 2 <= paths.length) {
            console.log("moving")
            const nextPoint = {x: paths[spliceIndex], y: paths[spliceIndex + 1]};
            packet("9", UWUTILS.getDirect(nextPoint, player, 0, 2),1,'pathfinder');
            paths.splice(0, spliceIndex);
        }
    }
    //console.log(Date.now()-time,"generate time")
    return true;
}
function autopush(ez, e, t) {
    if (!nearHacker.trapped) {
        my.autoPush = false;
        pushing = false;
        pusher = false;
        pushPosition = 'not';
        pushCoords = 'not'
        pushVector = 'not';
        sendMoveDir()
        return false;
    }

    if (!ez) ez = [];
    let s = liztobj
    .filter2(e => !ez.includes(e.sid) && cdf(nearHacker.trapInfo2, e) <= 50 + (e.type == 1 ? e.scale * 0.55 : e.scale) + 26 && ((!e.isTeamObject(nearHacker) && e?.group?.name == 'spikes') || (e?.type == 1 && e.y >= 12000)))
    .sort((a, b) => cdf(a, nearHacker) - cdf(b, nearHacker));

    if (!s.length) {
        pusher = false;
        pushing = false;
        pushPosition = 'not';
        pushVector = 'not';
        pushCoords = 'not'
        sendMoveDir()
        return false;
    }
    const sx = nearHacker.x2 - s[0].x;
    const sy = nearHacker.y2 - s[0].y;
    const px = nearHacker.x2 - player.x2;
    const py = nearHacker.y2 - player.y2;
    const tx = nearHacker.x2 - nearHacker.inTrap.x;
    const ty = nearHacker.y2 - nearHacker.inTrap.y;
    const tsx = s[0].x - nearHacker.inTrap.x;
    const tsy = s[0].y - nearHacker.inTrap.y;

    const sm = Math.sqrt(sx * sx + sy * sy);
    sTE = {
        x: sx / sm,
        y: sy / sm
    };

    const pm = Math.sqrt(px * px + py * py);
    pTE = {
        x: px / pm,
        y: py / pm
    };

    const tm = Math.sqrt(tx * tx + ty * ty);
    tTE = {
        x: tx / tm,
        y: ty / tm
    };

    const tsm = Math.sqrt(tsx * tsx + tsy * tsy);
    let tTS = {
        x: tsx / tsm,
        y: tsy / tsm
    };

    const a = [Math.atan2(sTE.y, sTE.x), Math.atan2(tTE.y, tTE.x), Math.atan2(pTE.y, pTE.x)];
    const aa = [(a[0] + a[1]) / 2, (a[0] + a[2]) / 2];

    const av = [
        { x: Math.cos(aa[0]), y: Math.sin(aa[0]) },
        { x: Math.cos(aa[1]), y: Math.sin(aa[2]) }
    ];

    dPAP = (sTE.x * pTE.x) + (sTE.y * pTE.y)// (av[0].x * pTE.x) + (av[0].y * pTE.y);

    sos3 = s[0]?.type == 1 ? (s[0].scale * 0.55, s[0].realScale = s[0].scale * 0.55) : s[0].scale;
    apS = s[0];

    pushPosition = {
        x: nearHacker.x2 + sTE.x * (dPAP + sos3),
        y: nearHacker.y2 + sTE.y * (dPAP + sos3)
    };

    const ang = caf(player, pushPosition);
    const distToPos= cdf(player, pushPosition);
    const angDiff = dAng(ang, caf(player, nearHacker));
    t = distToPos<= 100 && angDiff <= 2; // 2 or 2.3

    let ar = { x: nearHacker.x2, y: nearHacker.y2, pathScale: 35, do: true };
    // let o = nearObjects;
    let obstacles = t ? liztobj : liztobj.concat(ar);
    let tX = Date.now();
    paths = [];
    if(t){
        wyndAP()
    } else {
        // changed + 30 to + 35, let's see if better
        pathfind({
            player: {x2: player.x2, y2: player.y2, sid: player.sid},
            target: { x: nearHacker.x2 + sTE.x * (dPAP + sos3 + 35), y: nearHacker.y2 + sTE.y * (dPAP + sos3 + 35) },
            buildings: obstacles.map(({x, y, pathScale}) => ({x, y, pathScale})),
            clan: alliancePlayers
        }).then(foundPath => {
            console.log("found path, " + foundPath)
            let p = foundPath;
            pusher = false;
            pushing = true;

            if (!p) {
                pusher = false;
                pushing = false;
                pushPosition = 'not';
                pushVector = 'not';
                pushCoords = 'not'
                // ez.push(s[0].sid);
                // autopush(ez);
                sendMoveDir();
                return false;
            }
            e = moveToPath(tX, 360,true);

            if (!e) {
                pusher = false;
                pushing = false;
                pushPosition = 'not';
                pushVector = 'not';
                pushCoords = 'not'
                //  ez.push(s[0].sid);
                paths = [];
                // autopush(ez);
                sendMoveDir();
                return;
            }


        }).catch(error => {
            pushing = false;
            pusher = false;
            pushPosition = 'not';
            return false;
        });
    }
}

// ADD DEAD PLAYER:
function addDeadPlayer(tmpObj) {
    deadPlayers.push(
        new DeadPlayer(
            tmpObj.x,
            tmpObj.y,
            tmpObj.dir,
            tmpObj.buildIndex,
            tmpObj.weaponIndex,
            tmpObj.weaponVariant,
            tmpObj.skinColor,
            tmpObj.scale,
            tmpObj.name
        )
    );
}

/** APPLY SOCKET CODES */
// projectile calculation
function turretGearHit(plyr, theta, t0, vt, R = 50) {
    const ux = Math.cos(theta), uy = Math.sin(theta);
    const r0x = t0.x2 - plyr.x2, r0y = t0.y2 - plyr.y2;
    const vrelx = vt.x - 1.5 * ux, vrely = vt.y - 1.5 * uy;

    const a = vrelx*vrelx + vrely*vrely;
    const b = 2 * (r0x*vrelx + r0y*vrely);
    const c = r0x*r0x + r0y*r0y - R*R;

  // relative speed ≈ 0: treat distance as constant
    if (Math.abs(a) < 1e-12) {
        return c <= 0;
    }

    const disc = b*b - 4*a*c;
    if (disc < 0) return false;
    const sqrtD = Math.sqrt(disc);
    const t1 = (-b - sqrtD) / (2*a);
    const t2 = (-b + sqrtD) / (2*a);

  // earliest non-negative root
    const candidates = [t1, t2].filter(t => t >= 0).sort((A,B)=>A-B);
    if (candidates.length === 0) return false;
    return true;
}
function checkProjectileHit(plyr, velocity, ang, obj, R = 50) {
    const ux = Math.cos(theta), uy = Math.sin(theta);
    let target = obj;
    let proj = {x: plyr.x2, y: plyr.y2};
    let tick = null;
    const movDir = obj.movDir ?? target.aim2 + PI / 2
    for (let i = 0;i < 6;i++) {
        proj.x += velocity * ux;
        proj.x += velocity * uy;
        target = calcAccel(target, movDir, target, game.tickRate);
        const dx = proj.x - target.x2;
        const dy = proj.y - target.y2;
        if ((dx*dx + dy*dy) <= R*R) {
            tick = i;
            return tick;
        } else if (i >= 2) {
            const dx2 = player.x2 - target.x2;
            const dy2 = player.y2 - target.y2;
            const dx3 = player.x2 - proj.x;
            const dy3 = player.y2 - proj.y;
            if ((dx2*dx2+dy2*dy2) < (dx3*dx3+dy3*dy3) + 7000) return false;
        }
    }
    return false;
}
// SET INIT DATA:
function setInitData(data) {
    alliances = data.teams;
}

// SETUP GAME:
function setupGame(yourSID) {
    keys = {};
    macro = {};
    playerSID = yourSID;
    attackState = 0;
    inGame = true;
    packet("F", 0, getAttackDir(), 1, "setupGame");
    autoGathering = false;
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        console.log("reset liztobj")
        gameObjects = [];
        liztobj = [];
    }
}

// ADD NEW PLAYER:
function addPlayer(data, isYou) {
    let tmpPlayer = findPlayerByID(data[0]);
    if (!tmpPlayer) {
        tmpPlayer = new Player(
            data[0],
            data[1],
            config,
            UWUTILS,
            projectileManager,
            objectManager,
            players,
            ais,
            items,
            hats,
            accessories
        );
        tmpPlayer.displayText = `${data[2]} [${data[1]}]`;
        players.push(tmpPlayer);
        if (data[1] != playerSID) {
            addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
        }
    } else {
        if (data[1] != playerSID) {
            addMenuChText(null, `Found ${data[2]} {${data[1]}}`, "lime");
        }
    }
    if (!tmpPlayer || !tmpPlayer.alive) tmpPlayer.spawn(isYou ? true : null);
    tmpPlayer.visible = false;
    tmpPlayer.oldPos = {
        x2: undefined,
        y2: undefined,
    };
    tmpPlayer.x2 = undefined;
    tmpPlayer.y2 = undefined;
    tmpPlayer.x3 = undefined;
    tmpPlayer.y3 = undefined;
    tmpPlayer.setData(data);
    if (isYou) {
        if (!player) {
            window.prepareUI(tmpPlayer);
        }
        getEl("woodDisplay").textContent = "100";
        getEl("foodDisplay").textContent = "100";
        getEl("stoneDisplay").textContent = "100";
        player = tmpPlayer;
        player.primary = [];
        camX = player.x;
        camY = player.y;
        my.lastDir = 0;
        updateItems();
        updateAge();
        updateItemCountDisplay();
        if (player.skins[7]) {
            my.reSync = true;
        }
    }
}

// REMOVE PLAYER:
function removePlayer(id) {
    let tmpPlayer = findPlayerByID(id);
    if (tmpPlayer?.sid) {
        if (annoyingList.includes(tmpPlayer.sid)) annoyingList.splice(annoyingList.indexOf(tmpPlayer.sid), 1)
        if (friendList.includes(tmpPlayer.sid)) friendList.splice(friendList.indexOf(tmpPlayer.sid), 1)
    }
    addMenuChText(
        "Game",
        (tmpPlayer ? (tmpPlayer.name + " [" + tmpPlayer.sid + "]") : id) + " left the game",
        "red"
    );
    if (tmpPlayer) {
        players.splice(players.indexOf(tmpPlayer), 1);
    }
}
// dune mod dmgpot
function sortWeaponVariant(id) {
    switch (id) {
        case 0:
            return 1;
            break;
        case 1:
            return 1.1;
            break;
        case 2:
            return 1.18;
            break;
        case 3:
            return 1.18;
            break;
        default:
            return 1;
            break;
    }
}
function sortSecondaryAmmoDamage(weapon) {
    switch (weapon) {
        case 10:
            return 10;
            break;
        case 15:
            return 50;
            break;
        case 9:
            return 25;
            break;
        case 12:
            return 35;
            break;
        case 13:
            return 30;
            break;
        default:
            return 0;
    }
}
function dmgpotwowwowow(dmg) {
    let dmgpot = DmgPotWorkfrfrfr();
    player.dmgpot = dmgpot.dmg;
    let attacker = getAttacker(dmg, player);
    let potBuildDamage = 0;
    for (let i = 0;i < nears.length;i++) {
        let nearEnemy = nears[i];
        if (UWUTILS.getDist(nearEnemy, traps.info, 2, 0) <= 50 + nearEnemy.weapon.range && nearEnemy.weaponReload == 0) potBuildDamage += ((nearHacker.sid && nearEnemy.sid == nearHacker.sid) ? 3.3 : 1) * nearEnemy.weapon.dmg * sortWeaponVariant(nearEnemy.weaponVariant);
    }
    if (traps.info.health <= potBuildDamage + (player.secondaryReload == 0 && player.secondaryIndex == 10 ? (3.3 * 75 * sortWeaponVariant(player.secondaryVariant)) : player.primaryReload == 0 ? ((player.secondaryIndex == 10 && !soldierBreaking ? 1 : 3.3) * player.primary * sortWeaponVariant(player.primaryVariant)) : 0)) dmgpot.dmg += 45;
    if (!attacker || !attacker.length || !attacker[0]) attacker = undefined;
    if (attacker && attacker[0].weaponVariant == 3 && !(attacker[0].weapon.Pdmg > 20)) player.dot = 4;
    console.log("_____HEAL_LOGS_____")
    //  notif(`Dmg potential: ${potential}`)
    console.log("attacker: ", attacker);
    console.log("dmgpot: ", dmgpot);
    console.log("trapspike: " + trapSpike + ", dmg: " + dmg + ", health: " + player.health);
    if (qHeal > 0 || dmgpot.spikeBounce || dmgpot.dmg >= player.health && dmg > 5 || (dmg > 59 || dmg == 18.75 && near.dist2 <= 320)) {
        console.log("Insta")
        if (dmgpot.soldAnti < player.health) {
            soldierAnti = true;
        }
        if ((player.shameCount < 6 || player.skins[7]) && dmg > 12 || dmg > 5 && qHeal > 0) {
            antiInsta = true;
            game.tickBase(() => {
                antiInsta = false;
            }, 2)
            /*
            if (getEl("healMsg").value && getEl("healMsg").value.length > 0) {
            packet("6", getEl("healMsg").value, "healMsg");
            }*/
            console.log("fastHeal");
            healer();
        }
    }
    console.log("___________________")
}
function heal() {
    for (let k = 0;k < Math.ceil((100 - player.health) / items.list[player.items[0]].healing);k++) {
        place(0, getAttackDir());
    }
}
function DmgPotWorkfrfrfr() {
    let predictedDamage = 0;
    let predictedDmgNextTick = dmgpotAI;
    let weapon1Dmg, weapon2Dmg;
    let weapon1Reload, weapon2Reload;
    let ruby = false;
    let wepRangeEnemies = nears.filter2((e) => e.hasBoost && (e.boosted || e.turretGear || e.dist2 <= 250) || e.dist2 <= 63 + (e?.primary?.range ?? 142) || e.dist3 <= 63 + (e?.primary?.range ?? 142) || UWUTILS.getDist(e, player, 2, 3) <= 63 + (e?.primary?.range ?? 142) || UWUTILS.getDist(e, player, 3, 2) <= 63 + (e?.primary?.range ?? 142));
    for (let i = 0; i < wepRangeEnemies.length; i++) {
        let singleIndividual = wepRangeEnemies[i];
        let pI = singleIndividual.primaryIndex ?? 5;
        let sI = singleIndividual.secondaryIndex ?? 15;
        if (
            wepRangeEnemies.length == 1 &&
            pI &&
            sI &&
            pI == 3 &&
            sI == 15 &&
            player.skinIndex == 6 &&
            player.skins[22]
        ) {
            if (
                singleIndividual.primaryReload == 0 &&
                singleIndividual.secondaryReload == 0
            ) {
                if ((game.tick - player.bullTick + 1) % 9 <= 1 && (player.dot && singleIndividual.primaryVariant == 2 || singleIndividual.primaryVariant == 3)) {
                    maybeSwordInsta = true;
                } else {
                    antiSwordInsta = false;
                    maybeSwordInsta = false;
                }
            } else {
                antiSwordInsta = false;
                maybeSwordInsta = false;
            }
        } else {
            antiSwordInsta = false;
            maybeSwordInsta = false;
        }
            weapon1Reload = (pI == undefined || singleIndividual.primaryReload == 0 && singleIndividual.attackingWeapon != pI);
            weapon1Dmg = (pI == undefined ? 53.1 : items.weapons[pI].dmg * sortWeaponVariant(singleIndividual.primaryVariant));
            if (weapon1Reload) {
                // account for turret gear if it deals more damage
                if (weapon1Dmg <= 50 && singleIndividual.turretReload == 0) {
                    weapon1Dmg += 25;
                } else {
                    weapon1Dmg *= 1.5;
                }
                predictedDamage += weapon1Dmg;
            }
        if (game.tick - player.bullTick > 5 && (game.tick - player.bullTick + 1) % 9 <= 2 && (player.dot || singleIndividual.primaryVariant === 3 || singleIndividual.skinIndex == 21)) predictedDamage += 5;
        weapon2Reload = sI ? singleIndividual.secondaryReload == 0 && singleIndividual.attackingWeapon != sI : true;
        weapon2Dmg = sI == undefined ? 50 : singleIndividual.secondaryIndex == 10 ? (10 * sortWeaponVariant(singleIndividual.secondaryVariant)) : items.weapons[sI].Pdmg;
        if (weapon2Reload) {
                    // account for turret gear
            if (singleIndividual.turretReload == 0) weapon2Dmg += 25;
            predictedDamage += weapon2Dmg;
        }
        if (weapon1Reload && weapon2Reload) {
            if (weapon1Dmg < weapon2Dmg) {
                predictedDamage -= weapon1Dmg;
            } else {
                predictedDamage -= weapon2Dmg;
            }
        }

    }
    if (player.kbSpike) {
        predictedDamage += player.kbSpike.dmg ?? 35;
    }
    const spikes = nearObjects.filter2((e) => e.active && e.sid && e.sid != player.kbSpike?.sid && ((e.dmg && !e.isTeamObject(player) && UWUTILS.getDist(e, player, 0, 3) <= e.scale + 50) || (e.type == 1 && e.y >= 12000 && UWUTILS.getDist(e, player, 0, 3) <= e.scale*0.6 + 50)));
    let bounceSpike = false;
    for (let i = 0;i < spikes.length;i++) {
        const spike = spikes[i];
        bounceSpike = spikes.find2((e) => UWUTILS.getDist(e, calcPoint(spike.x, spike.y, UWUTILS.getDirect(spike, player, 0, 3), 50)) <= e.scale + 35) ?? false;
    }
    for (let i = 0;i < spikes.length;i++) {
        predictedDamage += spikes[i].dmg ?? 35;
    }
    if (bounceSpike && !spikes.find2((e) => e.sid == bounceSpike.sid)) predictedDamage += bounceSpike.dmg ?? 35;
    predictedDamage += projectileDamagePot;
    if (player.skinIndex == 6) predictedDamage *= .75;
    return {
        spikeBounce: bounceSpike,
        dmg: predictedDamage,
        nextTick: predictedDmgNextTick
    };
}
// UPDATE HEALTH:
function updateHealth(sid, value) {
    if (sid == player.sid) {
        if (value <= 0) {
            console.log("DEATH");
            console.log("DEATH");
            console.log("DEATH");
        } else if (player.skinIndex == 56) buyEquip(6, 0);
    }
    let tmpObj = findPlayerBySID(sid);
    if (!tmpObj) return;
    let oldHealth = tmpObj.health;
    if (oldHealth < value) {
        tmpObj.timeHealed = performance.now();
        game.tickBase(() => {
            tmpObj.timeHealed = 0;
            tmpObj.timeDamaged = 0;
        }, 2);
    } else if (oldHealth > value && !tmpObj.timeDamaged) {
        tmpObj.timeDamaged = performance.now();
    }
    tmpObj.oldHealth = oldHealth;
    tmpObj.health = value;
    let dmg = tmpObj.oldHealth - value;
    if (dmg == tmpObj.checkSpike || Math.abs(dmg - tmpObj.checkSpike) < 0.1) tmpObj.hitSpike = true;
    if (dmg == ((tmpObj.cheeze ? -10 : 0) - tmpObj.hps)) console.log("HEALING OVER TIME TICK: ", (game.tick - player.bullTick) % 9)
    if ((tmpObj.hps || tmpObj.cheese) && (dmg < 0 && (dmg >= ((tmpObj.cheeze ? -10 : 0) - tmpObj.hps) && value == 100 || value < 100 && dmg == ((tmpObj.cheeze ? -10 : 0) - tmpObj.hps))) && (game.tick - player.bullTick) % 9 === 0) {
        tmpObj.cheesed = true;
    }
    if (tmpObj.cheese && ((game.tick - player.bullTick) % 9 <= 1 || value < 100) && dmg == ((tmpObj.cheeze ? -10 : 0) - tmpObj.hps)) {
        tmpObj.cheeze = game.tick;
        game.tickBase(() => {
            if (tmpObj.cheeze <= game.tick - 45) tmpObj.cheeze = false;
        }, 46)
    }
    //console.log(tmpObj.cheesed, tmpObj.cheeze, tmpObj.cheese)
    if (dmg < 0) {
        if (tmpObj.lastHeal < game.tick) {
            tmpObj.lastHeal = game.tick;
        } else {
            tmpObj.macroPoints.qHold += 5;
            tmpObj.hackerPoints.autoheal += 5;
        }
    }
    if (value <= 0) {
        if (tmpObj.alive) tmpObj.reset();
        addMenuChText(null, `${tmpObj.name} [${sid}] has died. ${tmpObj.lastDamages}`, "red");
        //critical = true;
        console.log("crit")
    }
    game.tickBase(() => {
        let attacker = getAttacker(dmg, tmpObj);
        if (attacker) {
            if (attacker[0].weaponVariant == 3 && !(attacker[0].weapon.Pdmg > 20)) tmpObj.dot = 4;
            if (!(tmpObj.lastAttackers.find2((e) => e[0].sid == attacker[0].sid))) tmpObj.lastAttackers.push([attacker[0], performance.now()]);
        }
    }, 1)
    tmpObj.judgeShame();
    if (bullticking && (dmg == 5 || dmg == 2 || dmg == 3.75)) {
        bulltickSync = true;
    }
    if (dmg == 2 || (dmg == 5 && (tmpObj.skinIndex == 7 || tmpObj.dot > 0)) || dmg == 3.75) {
        player.bullTick = game.tick;
        player.bullTickEquip = game.tick - 1;
        if (my.reSync) {
            my.reSync = false;
        }
    }
    if (sid == player.sid) {
        if (antiPoleAids && [10, 11, 11.8, 7.5, 8.25, 11.8*0.75].includes(dmg) || Math.abs(dmg - 11.8*0.75) < 0.01 || Math.abs(dmg - 11.8) < 0.01) {
            healer();
        } else {
            if (qHold && dmg >= 18.75 && player.shameCount < 6) {
                console.log("qhold", qHold)
                console.log(value);
                healer();
                antiInsta = true;
                game.tickBase(() => {
                    antiInsta = false;
                }, 3);
            } else {
                game.tickBase(() => {
                    dmgpotwowwowow(dmg);
                }, 1);
            }
        }
    } else /*if (sid != player.sid && value > 0 && configs.autoKill) {
            if (tmpObj != player && evil && tmpObj.hacking && tmpObj.dist2 <= player.primary.range + 63) {
                if (value <= player.primary.dmg * sortWeaponVariant(player.primaryVariant) * ((player.tailIndex != 11 && player.skins[7]) ? 1.5 : 1)) {
                    hitBull(tmpObj.aim2, 0);
                }
            }
        } else */if (value <= 0) {
            tmpObj.alive = false;
            game.tickBase(() => {
                addDeadPlayer(tmpObj);
                let attacker = getAttacker(dmg, tmpObj)
                console.log(attacker);
                let len = tmpObj.lastAttackers.length;
                let arr = tmpObj.lastAttackers;
                for (let i = 0; i < len; i++) {
                    let dta = arr[i];
                    if (dta && performance.now() - dta[1] > 2500) {
                        tmpObj.lastAttackers.splice(i, 1);
                    }
                }
                let lastAttackers = tmpObj.lastAttackers.map((e) => e[0]);
                if (sid == player.sid) {
                    let secondAttacker = false;
                    let nearSpike = liztobj.find2((e) => e.owner && e.active && e.dmg && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + 40 &&
                                                 (Math.abs(dmg - e.dmg) <= 0.01 || Math.abs(dmg - e.dmg * 0.75) <= 0.01));
                    if (attacker) {
                        if (attacker.length > 1 || (lastAttackers && lastAttackers.length > 1) ||
                            (nearSpike && lastAttackers.find2((e) => e.sid != nearSpike.owner.sid))) {
                            let attacker2 = attacker.length == 1 ? lastAttackers && lastAttackers.find2((e) => e.sid != attacker[0].sid) ?
                                lastAttackers.find2((e) => e.sid != attacker[0].sid) : nearSpike ? nearSpike?.owner?.sid == attacker[0].sid ?
                                findPlayerBySID(nearSpike.owner.sid) : undefined : undefined : attacker[1];
                            if (attacker2) {
                                secondAttacker = true;
                                addMenuChText(null, `Killed by ${attacker[0].name} [${attacker[0].sid}] and ${attacker2.name} [${attacker2.sid}]`, "red");
                            }
                        }
                    }
                    if (!secondAttacker) {
                        if (nearSpike) {
                            let spikeOwner = findPlayerBySID(nearSpike.owner.sid);
                            addMenuChText(null, `Killed by ${spikeOwner.name + " [" + spikeOwner.sid + "]"}.`, "red");
                        } else if (attacker) {
                            console.log(attacker);
                            addMenuChText(null, `Killed by ${attacker[0].name + (attacker[0].name.endsWith("s") ? "'" : "'s")} ${attacker[0].weapon.name}`, "red");
                        }
                    }
                }/* else if (tmpObj && configs.specialKillChats.map((e) => e[0]).includes(tmpObj.sid) && configs.killchat) {
                    packet("6", configs.specialKillChats[configs.specialKillChats.map((e) => e[0]).indexOf(tmpObj.sid)][1], "pwrex");
                }*/ else if (!configs.spotify && configs.killchat && tmpObj.sid != player.sid) {
                    if (!getEl("killMsg-text").value.length) {
                        let secondAttacker = false;
                        console.log(lastAttackers, attacker)
                        let nearSpike = liztobj.find2(
                            (e) =>
                            e.active &&
                            e.dmg &&
                            UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + 40 &&
                            (Math.abs(dmg - e.dmg) <= 0.01 ||
                             Math.abs(dmg - e.dmg * 0.75) <= 0.01)
                        );
                        let nearCactus = liztobj.find2((e) => e.type === 1 && e.y >= 12000 && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale * 0.6 + 40 && [35, 26.25].includes(dmg));
                        let nearAnimal = ais.find2((e) => e.active && e.visible && e.dmg && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + tmpObj.scale);
                        if (attacker) {
                            if (attacker.length > 1 || (lastAttackers && lastAttackers.length > 1) ||
                                (nearSpike && lastAttackers.find2((e) => e.sid != nearSpike.owner.sid))) {
                                let attacker2 = attacker.length == 1 ? lastAttackers && lastAttackers.find2((e) => e.sid != attacker[0].sid) ?
                                    lastAttackers.find2((e) => e.sid != attacker[0].sid) : nearSpike ? nearSpike?.owner?.sid == attacker[0].sid ?
                                    findPlayerBySID(nearSpike.owner.sid) : undefined : undefined : attacker[1];
                                console.log(attacker2)
                                if (attacker2 != undefined) {
                                    secondAttacker = true;
                                    let killType = lastAttackers.length && tmpObj.lastAttackers.find2((e) => performance.now() - e[1] <= 250) ? "synced" : "killed";
                                    let wantedMsg = `${attacker[0].name} and ${attacker2.name} ${killType} ${tmpObj.name}`;
                                    let wantedMsg2 = `${attacker[0].name} & ${attacker2.name} ${killType} ${tmpObj.name}`
                                    let backupMessage = `${attacker[0].name} & ${attacker2.name} ${killType} ${tmpObj.sid}`;
                                    packet("6",
                                           wantedMsg.length > 30
                                           ? wantedMsg2.length > 30
                                           ? backupMessage.length > 30 ?
                                           `${attacker[0].name} & ${attacker2.sid} killed ${tmpObj.sid}`
                                           : backupMessage
                                           : wantedMsg2
                                           : wantedMsg
                                           , "killChat");
                                } else {
                                    console.log(attacker);
                                    let wpnName = attacker[0].weapon.name;
                                    let wantedMsg = `${tmpObj.name} died to ${wpnName == "daggers" ? "daggers" : "a " + wpnName}`;
                                    packet(
                                        "6",
                                        wantedMsg.length < 29
                                        ? wantedMsg + "."
                                        : wantedMsg.length > 30
                                        ? `${tmpObj.name} died to a ${attacker[0].weaponIndex}`
                                        : wantedMsg,
                                        "killChat"
                                    );
                                }
                            } else if (nearSpike) {
                                console.log("6", `${tmpObj.name} died to a spike.`, "killChat");
                            } else if (nearCactus) {
                                console.log("6", `${tmpObj.name} died to a cactus.`, "killChat");
                            } else {
                                console.log(attacker);
                                let wpnName = attacker[0].weapon.name;
                                let wantedMsg = `${tmpObj.name} died to ${wpnName == "daggers" ? "daggers" : "a " + wpnName}`;
                                packet(
                                    "6",
                                    wantedMsg.length < 29
                                    ? wantedMsg + "."
                                    : wantedMsg.length > 30
                                    ? `[${tmpObj.name}] died to a ${attacker[0].weaponIndex}`
                                    : wantedMsg,
                                    "killChat"
                                );
                            }
                        } else if (nearSpike) {
                            console.log("6", `${tmpObj.name} died to a spike.`, "killChat");
                        }
                    }
                }
            }, 1);
        }
    if (oldHealth > value) {
        let damage = oldHealth - value;
        let shame = tmpObj.shameCount;
        tmpObj.damaged = oldHealth - value;
    } else if (tmpObj !== player) {
        tmpObj.maxShameCount = Math.max(tmpObj.maxShameCount, tmpObj.shameCount);
    } else if (value <= 0) {
        container.style.visibility = "hidden";
        container.style.opacity = "hidden";
    }
}
// KILL PLAYER:
function killPlayer() {
    inGame = false;
    lastDeath = {
        x: player.x,
        y: player.y,
    };
}

// UPDATE PLAYER ITEM VALUES:
function updateItemCounts(index, value) {
    if (player) {
        player.itemCounts[index] = value;
        updateItemCountDisplay(index);
    }
}

// UPDATE AGE:
function updateAge(xp, mxp, age) {
    if (xp != undefined) player.XP = xp;
    if (mxp != undefined) player.maxXP = mxp;
    if (age != undefined) player.age = age;
}

// UPDATE UPGRADES:
function updateUpgrades(points, age) {
    player.upgradePoints = points;
    player.upgrAge = age;
    if (points > 0) {
        tmpList.length = 0;
        UWUTILS.removeAllChildren(upgradeHolder);
        for (let i = 0; i < 16; ++i) {
            if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || (player.primaryIndex == items.weapons[i].pre || player.secondaryIndex == items.weapons[i].pre))) {
                let e = UWUTILS.generateElement({
                    id: "upgradeItem" + i,
                    class: "actionBarItem",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: upgradeHolder,
                });
                e.style.backgroundImage = getEl(
                    "actionBarItem" + i
                ).style.backgroundImage;
                tmpList.push(i);
            }
        }
        for (let i = 0; i < 23; ++i) {
            if (
                items.list[i].age == age &&
                (items.list[i].pre == undefined ||
                 player.items.indexOf(items.list[i].pre) >= 0)
            ) {
                let tmpI = 16 + i;
                let e = UWUTILS.generateElement({
                    id: "upgradeItem" + tmpI,
                    class: "actionBarItem",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: upgradeHolder,
                });
                e.style.backgroundImage = getEl(
                    "actionBarItem" + tmpI
                ).style.backgroundImage;
                tmpList.push(tmpI);
            }
        }
        for (let i = 0; i < tmpList.length; i++) {
            (function (i) {
                let tmpItem = getEl("upgradeItem" + i);
                // tmpItem.onmouseover = function() {
                //     if (items.weapons[i]) {
                //         showItemInfo(items.weapons[i], true);
                //     } else {
                //         showItemInfo(items.list[i - 16]);
                //     }
                // };
                tmpItem.onclick = UWUTILS.checkTrusted(function () {
                    packet2("H", i, "upgrade");
                });
            })(tmpList[i]);
        }
        if (tmpList.length) {
            upgradeHolder.style.display = "block";
            upgradeCounter.style.display = "block";
            upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
            showItemInfo();
        }
    } else {
        upgradeHolder.style.display = "none";
        upgradeCounter.style.display = "none";
        showItemInfo();
    }
}
function toR(e) {
    var n = ((e * Math.PI) / 180) % (2 * Math.PI);
    return n > Math.PI ? Math.PI - n : n;
}
function toD(e) {
    var n = ((e / Math.PI) * 360) % 360;
    return n >= 360 ? n - 360 : n;
}
function findAvailableAnglesR(item, thisAng, vel, xd = PI / 60){ // originally 60
    if(!item) return [];
    //   const givenAngle = gAng;
    const interval = xd;
    const potentialAngles = []// {onPlayer:[],norm:[]};
    let x = vel ? player.x3 : player.x2
    let y = vel ? player.y3 : player.y2
    for (let offset = thisAng; offset <= thisAng + PI2; offset += interval) {
        const angle = offset;
        let used = usedAngles.findIndex(x => dAng(angle, x.angle) <= 0.45);
        let i = items.list[item];
        let tmpS = (35 + i.scale + (i.placeOffset || 0));
        let tmpX = x + (tmpS * cos(angle));
        let tmpY = y + (tmpS * sin(angle));
        let obj = {x: tmpX, y: tmpY, id: i.id, scale: i.scale, angle: angle, offset: tmpS, item: i, collide: [], points: 0, origin: [], name: i.name, overlap: [], preplacer:[],sids:[],intercepts:[],knockback:[], used: used}
        let canPlace = objectManager.checkItemLocation3(tmpX, tmpY, i.scale, 0.6, i.id, false, true, obj);
        if(canPlace) potentialAngles.push(obj);
    }
    //showAngles = potentialAngles;
    return potentialAngles;
}
window.replaceAccuracy = 50;
function gradeReplace(spike, trap, newEnemies, breakObj, time){
    const start = performance.now()
    //let newEnemies = enemies.filter2(e => dist2(E,e)<=275);
    let bestSpike, bestTrap;
    const teamObjects = partitionzion(nearObjects.filter2(x => (x.y >= 12000 && x.type === 1 || (x.name == "pit trap" || x.group?.name == "spikes")) && x.dist2 <= 450), (x => x.type == 1 || player.isTeam(x?.owner?.sid)));
    let spikeOffset = items.list[player.items[2]].scale - 50;
    const overlapDists = {};
    for(let i = 0; i < newEnemies.length; i++) {
        const x = newEnemies[i];
        const sid = x.sid;
        const enemyInTrap = x.inTrap;
        if (enemyInTrap) enemyInTrap.angToMe = caf(x.inTrap, player);
        const placepot = x.placePot;
        const placePotential = placepot.possible;
        const spikeNtrap = teamObjects[0].concat(teamObjects[1].filter2(e => !x.team && e?.owner?.sid != sid))
        const breakup = partitionzion(spikeNtrap, (e => e.name != "pit trap"));
        const ouchies = breakup[0];
        const trarp = breakup[1];
        let retrap = false;
        if (player.items[4] == 15) {
            for(let i = 0; i < trap.length; i++){
                if (placeSpike) break;
                const tarp = trap[i];
                let angleAbuse = true;
                const subkey = tarp.angle+String(sid);
                for(let t = 0; t < placePotential.length; t++){
                    const obj = placePotential[t];
                    const key = subkey+obj.angle;
                    overlapDists[key] = fastHypot(tarp.x - obj.x,tarp.y - obj.x);
                    if(overlapDists[key] <= tarp.scale + obj.scale){
                        tarp.placePriority = true;
                        angleAbuse = false;
                        break;
                        //    tarp.intercepts.push(obj);
                    }
                }
                const plyrDist = fastHypot(tarp.x - x.x3,tarp.y - x.y3);
                // dont place traps behind player
                if (dAng(caf(player, tarp), x.aim2) > 1.3 && trarp.find2((e) => e.dist2 < x.dist2 && fastHypot(e.x - x.x2, e.y - x.x2) <= plyrDist)) tarp.points -= 4;
                if (enemyInTrap && cdf(calcPoint(enemyInTrap.x, enemyInTrap.y, caf(enemyInTrap, x), 35), tarp) <= 20) tarp.points += 2; // blocks enemy replacing behind them while trapped, enables push
                if(plyrDist <= 150) tarp.points += 1;
                if(plyrDist<=20.4){
                    tarp.points += 3;
                    //  tarp.origin.push({amount:1,from:`stops ${x.name}[${x.sid}] from placing`,player:x})
                }
                if(plyrDist <= 50){
                    tarp.collide.push(sid)
                    retrap = true;
                    tarp.points += traps.in ? 5 : 3;
                    //  tarp.origin.push({amount:1,from:`collide with ${x.name}[${x.sid}]`,player:x})
                }
                let spikePoints = 0;
                for (let indx = 0;indx < ouchies.length;indx++) {
                    const e = ouchies[indx];
                    const dist = fastHypot(e.x - tarp.x, e.y - tarp.y)
                    if (dist <= 47 + (e.type == 1 ? e.scale * 0.55 : e.scale) + 24 && !tarp.sids.includes(e.sid)) {
                        const dist2 = dist - (e.type == 1 ? e.scale * .55 : e.scale);
                        if (dist2 <= 43) {
                            spikePoints += 1.5;
                            tarp.canPush = true
                        } else if (dist2 <= 74) {
                            spikePoints++;
                        }
                    }
                }
                if(spikePoints !== 0) {
                    tarp.points += (spikePoints + 1);
                }

                /* if(!angleAbuse){ // too performance inefficient to use may revisit later
                    let points = tarp.intercepts.length * .25
                    tarp.points += points
                    tarp.origin.push({amount:points,from:'blocks angle',player:x})
                }*/
                if(plyrDist<=placepot.placeRange){
                    if(angleAbuse){
                        tarp.points += 1
                        //  tarp.origin.push({amount:2,from:'angle abuse',player:x})
                    } else {
                        tarp.points += .5
                        //  tarp.origin.push({amount:.5,from:'blocks angle',player:x})
                    }
                }
                if (macro.f) {
                    tarp.points *= 1.1;
                }
                if(!bestTrap ||bestTrap.points<=tarp.points) bestTrap = tarp;
            }
        }
        for(let i = 0; i < spike.length; i++){
            const ouchie = spike[i];
            ouchie.bounce = false;
            ouchie.collision = false;
            if(isInPath(ouchie)) continue;
            const plyrDist = hypot(ouchie.x - x.x3,ouchie.y - x.y3)
            if (plyrDist > 300) continue;
            const aim1 = dAng(caf(ouchie, x), x.aim2);
            const aim2 = caf(player, ouchie);
            let angleAbuse = true
            for(let t = 0; t < placePotential.length; t++){
                const obj = placePotential[t]
                if(overlapDists[ouchie.angle+x.name+sid+obj.angle] + spikeOffset <= ouchie.scale + obj.scale){
                    ouchie.placePriority = true;
                    angleAbuse = false;
                    break;
                    // ouchie.intercepts.push(obj)
                    //   break;
                }
            }
            if (aim1 > 1.8) ouchie.points += ((aim1 - 1.8) * 4 + 1);
            const trapDist = enemyInTrap ? fastHypot(ouchie.x - enemyInTrap.x,ouchie.y - enemyInTrap.y) : Infinity
            //let buildIsPerpendicularToEnemy = 1.6 - dAng(1.57, angleDistToEnemy);
            //let buildBlocksPlayerEscape = angleDistToEnemy > 2;
            //logAndStack(`trapDist: ${trapDist}, angleDistToEnemy: ${angleDistToEnemy}, buildIsPerpendicularToEnemy: ${buildIsPerpendicularToEnemy}, buildBlocksPlayerEscape: ${buildBlocksPlayerEscape}, preventsBounceBack: ${preventsBounceBack}`);
            if(plyrDist <= 35 + ouchie.scale){
                if (placeSpike) ouchie.points += 3;
                if(ouchie.collide.length >=1)ouchie.origin.push({amount:1,from:`collides with ${x.name}[${sid}]`,player:x})
                ouchie.collide.push(sid)
                ouchie.collision = true;
                //if(!enemyInTrap){ uncomment this maybe lets find out
                const bouncer = knockInto(ouchie,spikeNtrap,x)
                if ((!macro.f && configs.zpyklerTickOverRetrap || bouncer.building && (bouncer.bounce || bouncer.building.name != "pit trap"))) {
                    ouchie.points += bouncer.bounce ? 5 : bouncer.building ? 4 : 2;
                    instaC.canZpykeTick = true;
                }
                if(bouncer.building){
                    ouchie.into = bouncer
                    if(bouncer.building.name == "pit trap" && !(ouchie.preplace && enemyInTrap && ouchie.sids.includes(enemyInTrap.sid))){
                        ouchie.points += 2.5;
                        //ouchie.origin.push({amount:1.5,from:'spike knocks into trap',player:x})
                    } else if(bouncer.bounce){
                        ouchie.bounce = true;
                        ouchie.points += 7;
                        //ouchie.origin.push({amount:2,from:'knocks between spike infinitely test',player:x})
                    } else if(bouncer.building.name !== "pit trap"){
                        ouchie.points += 3;
                        //ouchie.origin.push({amount:2,from:'knocks into spike',player:x})
                    } else {
                        ouchie.into = false
                    }
                }
                //}
                if(enemyInTrap && placeSpike){
                    ouchie.points += 1;
                }
                if(enemyInTrap && !ouchie.sids.includes(enemyInTrap.sid)){
                    ouchie.points+=4
                    ouchie.spikeTrap = true;
                    ouchie.canPush = true;
                    //ouchie.origin.push({amount:2,from:'spike collides with player while in trap',player:x})
                }
            }
            const diff = dAng(aim2, x.aim2)
            if (dAng(getMoveDir() ?? x.aim2, aim2) > 1.5) {
                ouchie.points += 1.5;
            }
            if(enemyInTrap && !ouchie.sids.includes(enemyInTrap.sid) && trapDist <= 50 + ouchie.scale + 21){
                if (diff > 1) {
                    ouchie.canPush = true;
                    ouchie.points += enemyInTrap.health < 290 ? 2 : 1.5;
                } else if (diff > 0.7 && enemyInTrap.health < 290) {
                    ouchie.canPush = true;
                    ouchie.points += 1;
                }
                //  ouchie.origin.push({amount:1,from:'possible autopush spike',player:x})
            }
            if(enemyInTrap && plyrDist <= 250 && (dAng(ouchie.angle,enemyInTrap.angToMe) >= 1.5 || clientMoveDir === null || clientMoveDir === undefined)){
                ouchie.points+=2
                //   ouchie.origin.push({amount:1,from:'spike surrounds trapped player',player:x})
            }
            //if(pushing) console.log(dAng(pushVector.dir, atan2(x.y2 - E.y2, x.x2 - E.x2)));
            if(angleAbuse&&plyrDist<=placepot.placeRange){
                ouchie.points+=1
                // ouchie.origin.push({amount:1,from:'angle abuse',player:x})
            }
            if (macro.v) ouchie.points *= 1.1;
            if(!bestSpike ||bestSpike.points<=ouchie.points) bestSpike = ouchie;
        }
    }
    console.log("REPLACE CALC TIME: " + (performance.now() - start))
    return {spikes:spike,traps:trap,bestSpike:bestSpike,bestTrap:bestTrap}
}
// KILL OBJECT:
function killObject(sid) {
    breakTime = performance.now();
    const findObj = findObjectBySid(sid);
    if (sid == traps.info.sid) my.anti0tick = 2;
    if (findObj) {
        if (traps.in && sid != traps.info.sid) {
            place(4, findObj.aim2);
            objectManager.disableBySid(sid);
            return;
        }
        configs.safeAntiZpyklerTick && nearHacker.dist2 <= 200 && (!nearHacker.trapped || sid != nearHacker.trapInfo2?.sid) && traps.checkZpyklerTick(true, findObj);
        objectManager.hitObj.push(findObj);
        if (player) {
            if (!player.canSee(findObj)) {
                breakTrackers.push({
                    x: findObj.x,
                    y: findObj.y,
                });
            }
            if (breakTrackers.length > 8) {
                breakTrackers.shift();
            }
        }
        const spikeType = player.items[2];
        if(nearHacker?.trapInfo2?.sid === sid && findObj.dist2 <= 126){
            //console.log(x);
            //spikeSync.push(x);
            if(placeSpike) {
                placers(spikeType, caf(player, findObj));
                placers(spikeType, nearHacker.aim2);
            }
            /*if(spikeSync.length && spikeTicker.checked && (primary == 3 || primary == 4 || primary == 5) && polePlacer(R.list[spikeType], getDir(E, x), x)) {
                    prioSync = true;
                } else prioSync = false;*/
        }
        if (nearHacker.dist2 <= 235&& cdf(player,findObj) <= 190&& configs.autoReplace && items.list[player.items[4]]?.name == "pit trap") {
            // TO DO: check if it doesn't collide with our preplace locations, and also create replaceLocations, so auto place doesn't collide with auto place, whilst still both being able to run at the same time
            // im restricting preplace location, so auto replace doesn't mess up with it
            const possibleSpikes = findAvailableAnglesR(spikeType, 0, 0, PI / window.replaceAccuracy);
            const possibleTraps = findAvailableAnglesR(player.items[4], 0, 0, PI / window.replaceAccuracy);
            const placer = gradeReplace(possibleSpikes, possibleTraps, enemy);
            const { bestTrap, bestSpike } = placer;
            placer.spikes.sort((a, b) => b.points - a.points);
            placer.traps.sort((a, b) => b.points - a.points);
            if(placer.spikes.length && placer.traps.length) {
                function fullplace(placedItems, allItems = placer.spikes.concat(placer.traps)) {
                    allItems = allItems.filter2(item => item.points > 0);
                    if (secPacket >= 85 || (!bestSpike && !bestTrap && !keys.c)) return;
                    allItems.sort((a, b) => {
                        if (b.points === a.points && a.name !== b.name) {
                            return a.name !== 'pit trap' ? -1 : 1;
                        }
                        return b.points - a.points;
                    });
                    // remove intersections, once it reaches 4 stop.
                    //dist(trap,spike) <= trap.scale+spike.scale
                    for (let item of allItems) {
                        const intersectsWithPlaced = placedItems.some(placed => cdf(placed, item) <= placed.scale + item.scale);
                        const intersectsWithPrioLoc = prioLoc.some(prio => cdf(prio, item) <= prio.scale + item.scale);
                        if (!intersectsWithPlaced && !intersectsWithPrioLoc) {
                            placedItems.push(item);
                        }
                        if (placedItems.length === 4) break;
                    }
                    // actually do the placing
                    for (let item of placedItems) {
                        if (!item.did) {
                            placers(item.id, item.angle)
                            usedAngles.push({ ...item, tick: game.tick });
                        }
                    }
                }
                // add place priority back, but not preplace (nvm, don't add either)
                let placing = [];
                // !prioLoc.some(item => dist2(item, bestSpike) <= item.scale + bestSpike.scale) maybe comment this out
                // !prioLoc.some(item => dist2(item, bestTrap) <= item.scale + bestTrap.scale) maybe comment this out
                // check if preplace doesn't block where we are replacing lol
                //logAndStack(`Auto place activty check ${amPlacing}`);
                if (bestSpike && bestSpike.points > 0 && !prioLoc.some(item => cdf(item, bestSpike) <= item.scale + bestSpike.scale) && (!bestTrap || !bestTrap.canPush || bestSpike.into) && (pushing && bestTrap && bestTrap.points > 0 || bestSpike.bounce)) {
                    if(bestSpike.placePriority) {
                        placers(traps.in && !macro.v ? 15 : spikeType, bestSpike.angle)
                        usedAngles.push({ ...bestSpike, tick: game.tick });
                    } else {
                        placers(traps.in && !macro.v ? 15 : spikeType/*.id*/, bestSpike.angle)
                        usedAngles.push({ ...bestSpike, tick: game.tick });
                    }
                    bestSpike.did = true;
                    placing.push(bestSpike);
                }
                if(bestTrap && (bestTrap.points > 0 && !prioLoc.some(item => cdf(item, bestTrap) <= item.scale + bestTrap.scale) && !(bestSpike &&bestSpike.points>0 && (!pushing && bestSpike.bounce) && cdf(bestTrap, bestSpike) <= bestTrap.scale + bestSpike.scale)|| bestTrap?.canPush || pushing)){
                    if(!placeSpike && bestTrap.placePriority) {
                        placers(player.items[4], bestTrap.angle);
                        usedAngles.push({ ...bestTrap, tick: game.tick });
                    } else {
                        placers(player.items[4], bestTrap.angle);
                        usedAngles.push({ ...bestTrap, tick: game.tick });
                    }
                    bestTrap.did = true;
                    placing.push(bestTrap);
                }
                fullplace(placing);

                /*d = getDir(E,x)
                if(pushing){
                    Hq(boostType,d,true)
                }
                for (let i = -1; i <= 1; i++) {
                    Hq(boostType, d+i,true);
                }*/
            }
        }
    }
    console.log("TIME: ", performance.now() - breakTime)
    objectManager.disableBySid(sid);
}

// KILL ALL OBJECTS BY A PLAYER:
function killObjects(sid) {
    if (player) objectManager.removeAllItems(sid);
}
function fgdo(a, b) {
    return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
}
function setTickout(doo, timeout) {
    if (!ticks.manage[ticks.tick + timeout]) {
        ticks.manage[ticks.tick + timeout] = [doo];
    } else {
        ticks.manage[ticks.tick + timeout].push(doo);
    }
}

function caf(e, t) {
    try {
        return fastAtan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x)
                         );
    } catch (e) {
        return 0;
    }
}
function generateCompositeImage(type,image, height,width,blurval) {
    if(!width)width = height;
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    c.width = height;
    c.height = width;
    // blurval = type==='animal'?18:type==='weapon'? :.8;
    // ctx.shadowColor = `rgba(0, 0, 0, 1)`
    ctx.shadowColor = "rgba(0, 0, 0, 1)"//"rgba(255,255,255, 1)"//"white"//"pink"
    ctx.shadowBlur = type==='animal'?18:type==='weapon'?12: type == "accessory" ? 9: 20;
    ctx.drawImage(image, 0, 0, height, width);

    var cI = new Image();
    cI.src = c.toDataURL();

    return cI;
}
function drawCompositeImage(e, t, n, i, r, scale, type) {
    let imageCache = e[t];

    if (!imageCache) {
        const image = new Image();
        image.onload = function() {
            this.isLoaded = true;
            this.onload = null;

            e[t] = generateCompositeImage(type, this, scale);
        };
        image.src = i + t + r;
        imageCache = image;
    }

    const imageToDraw = gE('shadows')?.checked ? e[t] : imageCache;

    if (imageToDraw) {
        n.drawImage(imageToDraw, -r.scale / 2, -r.scale / 2, r.scale, r.scale);
    }

    if (!i && r.topSprite) {
        n.save();
        n.rotate(scale.skinRot);
        drawCompositeImage(e, t + "_top", n, i, r, scale, type);
        n.restore();
    }
}
let found = false;
let autoQ = false;

let autos = {
    insta: {
        todo: false,
        wait: false,
        count: 4,
        shame: 5,
    },
    bull: false,
    antibull: 0,
    reloaded: false,
    stopspin: true,
};

// UPDATE PLAYER DATA:
let autoZoom = true;
let FT = 0;
let AutoOneTicked = false;
let lppc = 0,
    ntpp = false,
    lppc2 = 0,
    ntpp2 = false;
let boostspike = false;
let doAutoQ = false;
let spinner = false;

let nEy;
let placeableSpikes = [];
let placeableTraps = [];
let placeableSpikesPREDICTS = [];
let DmgPotStuff = {
    predictedDamage: 0,
};
function calcPoint(x, y, angle, dist) {
    return {x: x + dist * Math.cos(angle), y: y + dist * Math.sin(angle)};
}
let breakObjs = [];
function bestAim(main, range, objs = nearObjects) {
    const possibleTargets = objs.filter2(obj => obj.active && obj.type === null && obj?.owner?.sid && obj.dist2 <= (range + obj.scale));
    const startAim = main;
    let bestAim = startAim; // Default to the current aim
    let concatObj = []
    let maxHitCount = -999;
    let defaultHitCount = 0;
    for (let i = -3; i < 3; i += 1) {
        const aimer = startAim + UWUTILS.toRad(i*10);
        const hitObjs = [];
        let hitCount = 0;
        for (let j = 0;j < possibleTargets.length;j++) {
            const target = possibleTargets[j];
            if (UWUTILS.getAngleDist(caf(player, target), aimer) <= config.gatherAngle) {
                hitObjs.push(target)
                hitCount += ((target?.owner?.sid === player.sid) ? -0.5 : 1);
            }
        }
        if (i == 0) {
            defaultHitCount = hitCount;
        }
        if (hitCount > maxHitCount) {
            maxHitCount = hitCount;
            bestAim = aimer;
            concatObj = hitObjs
        }
    }
    breakObjs.push(concatObj);
    breakObjs = breakObjs.flat();
    return defaultHitCount == maxHitCount ? main : bestAim;
}
const decayRate = Math.pow(0.993, 111.11112);
function getDecelDist(x,t){
    if(isNaN(x)||x==Infinity) return null;
    let value = x;

    while (value >= .001) {
        value *= decayRate;
        x += value;
    }
    return x
}
function checkStoppedMoving(tmp) {
    let fullDecelPos = {x: tmp.oldPos.x2 + tmp.oldXVel * decayRate, y: tmp.oldPos.y2 + tmp.oldYVel * decayRate};
    let decelPos = {x: tmp.oldPos.x2 + tmp.oldXVel * decayRate, y: tmp.oldPos.y2 + tmp.oldYVel * decayRate};
    if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2 && Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
        return [true, "fullDecel", {x: tmp.x2 + tmp.xVel * decayRate, y: tmp.y2 + tmp.yVel * decayRate}];
    } else if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2) {
        return [true, "xDecel", {x: tmp.x2 + tmp.xVel * decayRate, y: tmp.y2 + (tmp.y2 - tmp.oldPos.y2)}];
    } else if (Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
        return [true, "yDecel", {x: tmp.x2 + (tmp.x2 - tmp.oldPos.x2), y: tmp.y2 + tmp.yVel * decayRate}];
    }
}
function getMoveSpeed(ticks, tmp, dir) {
    tmp.newXVel = tmp.xVel;
    tmp.newYVel = tmp.yVel;
    let totalXVel = 0;
    let totalYVel = 0;
    let decel = false;
    if(tmp?.velocity!=undefined&&tmp.sid!=player.sid) decel = cdf(tmp,tmp.velocity?.accel)>cdf(tmp,tmp.velocity?.decel)&&dAng(tmp.movDir,tmp.pmovDir)<=.3;
    if(tmp.sid==player.sid){
        if (clientMoveDir == undefined){
            decel = true;
        }
    }
    for (let i = 0;i < ticks;i++) {
        tmp.newXVel = tmp.newXVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.cos(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
        tmp.newYVel = tmp.newYVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.sin(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
        totalXVel += tmp.newXVel;
        totalYVel += tmp.newYVel;
    }
    return {x: tmp.newXVel, y: tmp.newYVel};
}
function getMovePos(ticksToMove, tmp, angle) {
    if (typeof angle != "number" || typeof ticksToMove != "number") console.error("what are you doing faggot")
    tmp.update(1);
    return {
        x: tmp.x2 + getMoveSpeed(ticksToMove, tmp, angle).x,
        y: tmp.y2 + getMoveSpeed(ticksToMove, tmp, angle).y
    }
}
let moveTicks = 0;
let didStop = {time:Date.now(),type:null}//Date.now();;
var stopHit = 0;
function objDmgPot(){
    for (let i = 0; i < liztobj.length; i++){
        liztobj[i].dmgpot = 0;
    }
    for(let x = 0; x < nearPlayers.length; x++){
        const _ = nearPlayers[x];
        if (_.sid == player.sid) continue;
        _.bDmg = _?.secondaryIndex === 10 && (_.secondaryReload === 0) ?
            {dmg:(sortWeaponVariant(_.secondaryVariant) * 75 * 3.3), wep: 10} :
        _?.primary && (_.primaryReloads === 0) ?
            {dmg:_?.primary?.dmg * 3.3 * sortWeaponVariant(_.primaryVariant), wep: _.primaryIndex} : 0
        if(_.bDmg === 0) continue;
        for(let i = 0; i < nearObjects.length; i++){
            const object = nearObjects[i];
            object.assumeBreak = false;
            if(object.type !== null || !object?.owner?.sid) continue;
            const d_o = UWUTILS.getDist(_,object,2,0) <= (items.weapons[_.bDmg.wep].range + object.scale);
            if (!d_o) continue;
            object.dmgpot = _.bDmg.dmg;
            if (_.antiBull) object.likelyDmg = _.bDmg.dmg;
            //     d_o && (nearObjects[i].maxDmg += _.bDmg.dmg)
            if (object.likelyDmg >= object.health) breakObjs.push(object);
            if (object.dmgpot >= object.health/* && C.getAngleDist(getDir(_,nearObjects[i]), _.d2) <= Math.PI / 2.6*/){
                object.assumeBreak = true
                //  console.log(nearObjects[i].dmgpot,nearObjects[i].maxDmg, _.bDmg);
                continue;
            }
        }
    }
}
function breakShit(angle, wep, variant, hat, force, type, o, t, dmg){
    for(let i = 0; i < nearObjects.length; i++){
        const greg = nearObjects[i]
        if (greg.type !== null || !greg?.owner?.sid || greg.dist2 > (items.weapons[wep]?.range + greg.scale)) continue;
        t = caf(player,nearObjects[i])
        if (UWUTILS.getAngleDist(t, angle) <= config.gatherAngle && greg.type === null){
            dmg = items.weapons[wep].dmg * (wep === 10 ? 7.5 : 1) * (hat === 40 ? 3.3 : 1) * sortWeaponVariant(variant);
            const conditions = (wep < 9 ? player.primaryReload : player.secondaryReload) === 0 && dmg >= greg.health;
            if(conditions){
                greg.assumeBreak = true;
                greg.manualBreak = true;
                breakObjs.push(greg);
            } else if (force) {
                breakObjs.push(greg);
            }
        }
    }
}
let breakin = false;
let breaker = undefined;
function runInto(player, angle, vel,MAX, z, scale) {
    if(!inGame) return;
    angle = UWUTILS.getDirect(vel.accel, player, 0, 2)
    z = liztobj.filter2(e => UWUTILS.getDist(e, player, 0, 2) <= 200 && e.active && (e.boostSpeed || e.dmg || configs.autoBreakTP && e.teleport) && !e.isTeamObject(player));
    if (!z.length) return false;
    for (let i = 0, obj; i < z.length; i++) {
        const obj = z[i];
        scale = (obj.type === 1 ? obj.scale * 0.6 + 35 : obj.teleport ? obj.scale * .75 + 35 : obj.scale + 35) + (breakin ? 5 : 0);
        const decelVels = [getDecelDist(vel.vel), getDecelDist(breakin ? 10 + player.movSpd : player.movSpd)];
        const closestPoints = [calcPoint(player.x2, player.y2, angle, decelVels[0]), calcPoint(player.x2, player.y2, angle, decelVels[1]), calcNewVel(player, vel.accel, player, 1).decel];
        const isIntersecting = (cdf(closestPoints[0], obj) <= scale + 1 || cdf(closestPoints[1], obj) <= scale);
        isNaN(MAX) === true && (MAX = 0);
        const ranger = player.secondaryIndex === 10 ? 75 : player.primary.range;
        const dists = [cdf(player,obj)<=ranger + obj.scale, cdf(closestPoints[0], obj)<=ranger + obj.scale, cdf(closestPoints[1], obj)<=ranger + obj.scale]
        const canBreak = dists[0] && obj.type !== 1;
        const conditions = (isIntersecting || ((dists[0] || dists[1] || dists[2]) && obj.type !== 1));
        const aimer = bestAim(UWUTILS.getDirect(obj, player, 0, 2), 75)
        if(((player.secondaryIndex===10&&player.secondaryReload===0) || player.secondaryIndex != 10 && player.primaryReload===0&&player.primaryIndex!=8)){
            if (canBreak && (!configs.rubyShame || nearHacker.shameCount < 4)) {
                breakin = true;
                hitTank(aimer, player.hammerIndex);
            }
        }
        console.log(conditions, isIntersecting, scale)
        if (conditions && isIntersecting) {
            console.log("asd")
            return obj;
        }
    }
    breakin = false;
    return false;
}
function dAng(ang1, ang2){
    let d = Math.abs(ang1 - ang2);
    d = d % (Math.PI * 2);
    if(d > (Math.PI * 2)){
        d = (Math.PI * 2) - d;
    }
    // console.log(d);
    return d;
}
function dAng2(ang1, ang2){
    let d = ang1 - ang2;
    d = d % (Math.PI * 2);
    if(d > (Math.PI * 2)){
        d = (Math.PI * 2) - d;
    }
    // console.log(d);
    return d;
}
const defaultSpeed = game.tickRate / 2;
function calcOTVel() {
        const _ = player;
        let time = game.tickRate;
        const newVel = calcVel(_, nearHacker.aim3,{maxSpeed: 0.77},1,time)
        let xVel = newVel.accel.x - player.x2;
        let yVel = newVel.accel.y - player.y2;
        let x2 = newVel.accel.x;
        let y2 = newVel.accel.y;
        let { sin, cos, pow} = Math;

        let cosX = cos(nearHacker.aim3)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
        let sinY = sin(nearHacker.aim3)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
        let mult = 1.056;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        cosX && (_.speedXD += cosX * .0016 * mult * time)
        sinY && (_.speedYD += sinY * .0016 * mult * time)
        //  U = Math.min(4, Math.max(1, Math.round(O / 40)))
        // console.log(v0)
        // console.log(_.speedXD,_.speedYD)
        _.speedXD && (_.predX += _.speedXD * time)
        _.speedYD && (_.predY += _.speedYD * time)
        //  console.log(v0)
        let velXD = xVel*pow(.993,time),
            velYD = yVel*pow(.993,time),
            velX = velXD+_.predX,
            velY = velYD+_.predY;
        return {x:x2+velX,y:y2+velY}
    }

function calcVel(_,ang,set,docalc,time){
        if (!time || typeof time !== "number") {
            time = game.tickSpeed;
        }
        let { sin, cos, pow, sqrt} = Math;
        if(!docalc){
            if(_.sid == player.sid && ang !== 0 && !ang) {
                ang = getMoveDir();
            } else if (traps.in && _.sid == player.sid) {
                ang = undefined
            } else if (!ang&&ang!==0) {
                ang = _.movDir
            }
        }
        let cosX = cos(ang)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
        let sinY = sin(ang)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        sqrtDis!=0 && (cosX /= sqrtDis,sinY /= sqrtDis)
        if(!set) set = _;
        let mult = set.maxSpeed;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        cosX && (_.speedXD += cosX * .0016 * mult * time)
        sinY && (_.speedYD += sinY * .0016 * mult * time)
        //  U = Math.min(4, Math.max(1, Math.round(O / 40)))
        // console.log(v0)
        // console.log(_.speedXD,_.speedYD)
        _.speedXD && (_.predX += _.speedXD * time)
        _.speedYD && (_.predY += _.speedYD * time)
        //  console.log(v0)
        let velXD = _.xVel*pow(.993,time),
            velYD = _.yVel*pow(.993,time),
            velX = velXD+_.predX,
            velY = velYD+_.predY,
            accel = {x:_.x2+velX,y:_.y2+velY,type:'accel'},
            decel = {x:_.x2+velXD,y:_.y2+velYD,type:'decel'},
            nextVel = {x:velX,y:velY,type:'nextVel'},
            real = accel,
            vel = sqrt(velX * velX + velY * velY),
            spd = mult,
            //  realxVel = Math.abs(Math.round(Math.sqrt(velX * velX))),
            // realyVel = Math.abs(Math.round(Math.sqrt(velY * velY)))
            boostxVel, boostyVel;
        //console.log(velX,velY)
        //  console.log(E.xVel,E.yVel,velX,velY)
        if(_?.velocity!=undefined&&_.sid!=player.sid)real = cdf(_, _.oldPos) == 0 || (cdf(_,_.velocity?.accel)>cdf(_,_.velocity?.decel)&&dAng(_.movDir,_.pmovDir)<=.3)||_.trapped?decel:accel;
        if(_.sid==player.sid){
            if(getMoveDir() == undefined||clientMoveDir == null){
                real = decel;
            } else {
                real = accel;
            }
        }
        function fulldecel(e,t,coords,e2,t2){
            if(isNaN(e)||isNaN(t))return;
            try{
                e2 = e*decayRate;
                t2 = t*decayRate;
                if(e!=e2){ e = e2
                        coords.x+=e
                        }
                if(t!=t2){ t = t2
                        coords.y+=t

                        }
                if(e==e2&& t==t2){
                    return {x:coords.x,y:coords.y,type:'full decel'}
                } else{
                    //  console.log(e,t,coords)
                    return fulldecel(e,t,coords)
                }
            } catch(e){}
        }
        let fullDecel = fulldecel(velX,velY,{x:_.x2+velX,y:_.y2+velY});
        let result = {accel:accel,decel:decel,nextVel:nextVel,real:real,xVel:velX, spd: mult, yVel:velY,vel:vel}
        return result
}
function calcAccel(_,ang,set,time){
        if (!time || typeof time !== "number") {
            time = game.tickSpeed;
        }
        let { sin, cos, pow, sqrt} = Math;
        let cosX = cos(ang)//_.sid == R.sid ?Math.cos(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.cos(_.movDir);
        let sinY = sin(ang)//_.sid == R.sid?Math.sin(ang!=undefined&&ang!==undefined?ang:!inTrap?moveDirection:undefined) :Math.sin(_.movDir);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        sqrtDis!=0 && (cosX /= sqrtDis,sinY /= sqrtDis)
        if(!set) set = _;
        const decel = pow(.993,time);
        const move = .0016*set.maxSpeed*time*time;
        const xVel = _.xVel*decel+cosX*move;
        const yVel = _.yVel*decel+sinY*move;
    return {xVel: xVel, yVel: yVel, x2:(_.x2??_.x)+xVel, y2:(_.y2??_.y)+yVel}
}


const getDistance = (x1, y1, x2, y2) => {
    let dx = x2 - x1;
    let dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}; /*
    const getPotentialDamage = (build, user) => {
        const weapIndex = user.secondaryIndex === 10 && !player.reloads[user.secondaryIndex] ? 1 : 0;
        const weap = user.weapons[weapIndex];
        if (player.reloads[weap]) return 0;
        const weapon = items.weapons[weap];
        const inDist = getDistance(build.x, build.y, user.x2, user.y2) <= build.getScale() + weapon.range;
        return (user.visible && inDist) ? weapon.dmg * (weapon.sDmg || 1) * 3.3 : 0;
    };

    const findPlacementAngle = (player, itemId, build) => {
        if (!build) return null;
        const MAX_ANGLE = 2 * Math.PI;
        const ANGLE_STEP = Math.PI / 360;
        const item = items.list[player.items[itemId]];
        let buildingAngle = Math.atan2(build.y - player.y, build.x - player.x);
        let tmpS = 35 + (item.scale || 1) + (item.placeOffset || 0);

        for (let offset = 0; offset < MAX_ANGLE; offset += ANGLE_STEP) {
            let angles = [(buildingAngle + offset) % MAX_ANGLE, (buildingAngle - offset + MAX_ANGLE) % MAX_ANGLE];
            for (let angle of angles) {
                let tmpX = player.x + tmpS * Math.cos(angle);
                let tmpY = player.y + tmpS * Math.sin(angle);
                if (objectManager.customCheckItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player, build, gameObjects, UWUTILS, config)) {
                    return angle;
                }
            }
        }
        return null;
    };*/
// let movementPrediction = {
//     x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
//     y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
// }

//     let potentialzpiketick = liztobj.filter2((e) => e.active && e.dmg)

//     potentialzpiketick.forEach((obj) => {
//         if(cdf(obj, player) <= 200) {
//             packet('a', undefined);
//         }
//     })

// let newPos = {
//     x: player.x2 + (tracker.lastPos.x - player.x2) * -1,
//     y: player.y2 + (tracker.lastPos.y - player.y2) * -1,
// }
function getAngleDifference(angle1, angle2) {
    // Normalize the angles to be between 0 and 2╧Α
    angle1 = angle1 % (2 * Math.PI);
    angle2 = angle2 % (2 * Math.PI);

    // Calculate the absolute difference between the angles
    let diff = Math.abs(angle1 - angle2);

    // Adjust the difference to be between 0 and ╧Α
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }

    return diff;
}

//     function smartMove(oneTickMove) {
//         let dir = player.moveDir;

//         let found = false
//         let buildings = liztobj.sort((a, b) => Math.hypot(player.y2 - a.y, player.x2 - a.x) - Math.hypot(player.y2 - b.y, player.x2 - b.x))
//         let spikes = buildings.filter2(obj => obj.dmg && cdf(player, obj) < 250 && !obj.isTeamObject(player) && obj.active)

//         let newPos = {
//             x: player.x2 + (player.x2 - player.oldPos.x2) * 1.2 + (Math.cos(dir) * 50),
//             y: player.y2 + (player.y2 - player.oldPos.y2) * 1.2 + (Math.sin(dir) * 50),
//         }

//         for (let i = 0; i < spikes.length; i++) {
//             if (cdf(spikes[i], newPos) < spikes[i].scale + 35 + 3) {
//                 found = Math.atan2(player.y2 - spikes[i].y, player.x2 - spikes[i].x)
//             }
//         }

//         if (found != false && !traps.in) {
//             packet("9", undefined);
//         } else {
//             packet("9", dir);
//         }
//         player.oldPos.x2 = player.x2;
//         player.oldPos.y2 = player.y2;
//     }
//     function detectEnemySpikeCollisions(tmpObj) {
//         let buildings = liztobj.sort((a, b) => Math.hypot(tmpObj.y - a.y, tmpObj.x - a.x) - Math.hypot(tmpObj.y - b.y, tmpObj.x - b.x));
//         let spikes = buildings.filter2(obj => obj.dmg && cdf(player, obj) < 200 && !obj.isTeamObject(player) && obj.active);
//         //here you calculate last vel / delta, add that to current pos, if touch spike do the heh
//         let enemy = {
//             // x: tmpObj.x + (player.oldPos.x2 - tmpObj.x) * -2,
//             // y: tmpObj.y + (player.oldPos.y2 - tmpObj.y) * -2,
//             x: player.x2 + (player.oldPos.x2 - player.x2) * -1,
//             y: player.y2 + (player.oldPos.y2 - player.y2) * -1,
//         }
//         let found = false;
//         for (let i = 0; i < spikes.length; i++) {
//             if (cdf(enemy, spikes[i]) < 35 + spikes[i].scale) {
//                 found = true;
//             }
//         }

//         // player.oldPos.x2 = tmpObj.x2;
//         // player.oldPos.y2 = tmpObj.y2;
//     }
function isInTrap(plyr) {
    const traps = liztobj.filter2((e) => e.trap && e.active && UWUTILS.getDist(e, plyr, 0, 2) <= 50 && !e.isTeamObject(plyr));
    if (traps.length <= 1) {
        return (traps.length == 0) ? false : traps[0];
    } else {
        return traps.sort(function (a, b) {
            return UWUTILS.getDist(a, plyr, 0, 2) - UWUTILS.getDist(b, plyr, 0, 2);
        })[0];
    }
}
let lastPlayerCount = 1;
const circle1 = [];
const circle2 = [];
function updatePlayers(data) {
    if (qHeal > 0) qHeal--;
    projectileDamagePot = 0;
    game.tick++;
    if (!player) return;
    if (loopIndex >= loopHats.length) {
        loopIndex = 0;
    }
    if (!hacking) packet2("D", getSafeDir(), 1, "look around")
    nearObjects.length = 0;
    legits.length = 0;
    enemy.length = 0;
    nears.length = 0;
    circle1.length = 0;
    circle2.length = 0;
    near = [];
    nearHacker = [];
    player.wood = Number(woodEl.textContent);
    player.food = Number(foodEl.textContent);
    player.stone = Number(stoneEl.textContent);
    if (my.autoAim > 0) {
        my.autoAim--;
    }
    if (my.waitHit > 0) {
        my.waitHit--;
    }
    game.oldTickSpeed = game.tickSpeed;
    game.tickSpeed = performance.now() - game.lastTick;
    if (game.tickSpeed >= 190) {
        if (player.skinIndex != 56) my.reSync = true;
        player.chat.message = "Tick skipped";
        player.chat.count = 500;
    }
    game.lastTick = performance.now();
    for (let i = 0; i < nearPlayers.length; i++) {
        const tmp = nearPlayers[i];
        tmp.visible = false;
        /*
            if (tmp.timeHealed && tmp.timeDamaged) {
                let time = (tmp.timeHealed - tmp.timeDamaged) - ((tmp.shameCount > tmp.lastShameCount) ? 0 : game.tickRate);
                tmp.pinge = time;
                tmp.avgPinge.push(time);
            }*/
    }
    nearPlayers.length = 0;
    nearEnemies.length = 0;
    lastPlayerCount = data.length / 13;
    /*
        const sids = [];
        for (let i = 0; i < data.length; i += 13) {
            sids.push(data[i]);
        }
        /*if (sids.find2((e) => tpList.includes(e))) {
            let dir = getSafeDir() + Math.PI;
            place(player.getItemType(22), dir);
            packet("9", dir, 1);
        }*/
    for (let i = 0; i < data.length;) {
        let tmpObj = findPlayerBySID(data[i]);
        if (tmpObj) {
            currPlayers[tmpObj.sid] = tmpObj;
            tmpObj.t1 = tmpObj.t2 === undefined ? game.lastTick : tmpObj.t2;
            tmpObj.t2 = game.lastTick;
            tmpObj.oldPos.x2 = tmpObj.x2;
            tmpObj.oldPos.y2 = tmpObj.y2;
            tmpObj.x1 = tmpObj.x;
            tmpObj.y1 = tmpObj.y;
            tmpObj.x2 = data[i + 1];
            tmpObj.y2 = data[i + 2];
            tmpObj.guessLocation = `[x: ${100 * tmpObj.x2 / config.mapScale}%, y: ${100 * tmpObj.x2 / config.mapScale}%]`;
            tmpObj.guessTime = game.tick;
            tmpObj.oldXVel = tmpObj.xVel;
            tmpObj.oldYVel = tmpObj.yVel;
            tmpObj.xVel = tmpObj.x2 - tmpObj.oldPos.x2;
            tmpObj.yVel = tmpObj.y2 - tmpObj.oldPos.y2;
            tmpObj.newXVel = tmpObj.xVel;
            tmpObj.newYVel = tmpObj.yVel;
            tmpObj.pmovDir = tmpObj.movDir;
            tmpObj.movDir = (tmpObj.xVel + tmpObj.yVel) <= 7 ? null : UWUTILS.getDirect(tmpObj, tmpObj.oldPos, 2, 2);
            tmpObj.movSpd = UWUTILS.getDist(tmpObj.oldPos, tmpObj, 2, 2);
            tmpObj.d4 = tmpObj.d3;
            tmpObj.d3 = tmpObj.d2;
            tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 3] : tmpObj.d2;
            tmpObj.d2 = data[i + 3];
            tmpObj.dt = 0;
            tmpObj.buildIndex = data[i + 4];
            tmpObj.oldWeaponIndex = tmpObj.weaponIndex;
            tmpObj.weaponIndex = data[i + 5];
            if (tmpObj.weaponIndex < 9) {
                tmpObj.weaponReload = tmpObj.primaryReload;
            } else {
                tmpObj.weaponReload = tmpObj.secondaryReload;
            }
            tmpObj.weaponVariant = data[i + 6];
            tmpObj.weapon = items.weapons[data[i + 5]];
            if (tmpObj.team !== data[i + 7] && tmpObj.team != undefined && tmpObj.listElement) {
                tmpObj.logDetails = `Team: ${tmpObj.team ? `"${tmpObj.team}"` : "none"}, SID: [${tmpObj.sid}, Estimated Location: [x: ${Math.round(1000 * tmpObj.x2 / config.mapScale) / 10}%, y: ${100 * tmpObj.x2 / config.mapScale}%], Move Direction: ${tmpObj.movDir}`;
                tmpObj.listElement.textContent = tmpObj.logDetails + tmpObj.listTime;
            }
            tmpObj.team = data[i + 7];
            tmpObj.isLeader = data[i + 8];
            tmpObj.skinIndex2 == tmpObj.oldSkinIndex;
            tmpObj.tailIndex2 = tmpObj.oldTailIndex;
            tmpObj.oldSkinIndex = tmpObj.skinIndex;
            tmpObj.oldTailIndex = tmpObj.tailIndex;
            tmpObj.skinIndex = data[i + 9];
            tmpObj.tailIndex = data[i + 10];
            tmpObj.iconIndex = data[i + 11];
            tmpObj.lastSkinIndexes.push(data[i + 9]);
            if (tmpObj.instaPlaced) tmpObj.instaPlaced--;
            if (tmpObj.buildIndex == 2) {
                tmpObj.cheese = true;
            } else if (tmpObj.buildIndex == 1 || tmpObj.buildIndex == 0) {
                tmpObj.cheese = false;
            } else if (tmpObj.buildIndex == 16) {
                tmpObj.hasBoost = true;
            } else if (tmpObj.buildIndex == 15) {
                tmpObj.hasBoost = false;
            }
            tmpObj.hps = (tmpObj.skinIndex == 13 ? 3 : tmpObj.skinIndex == 7 ? -5 : 0) + (tmpObj.tailIndex == 13 ? 3 : tmpObj.tailIndex == 17 ? 1 : 0)
            if (tmpObj.lastSkinIndexes.length > 10) {
                tmpObj.lastSkinIndexes.shift();
            }
            if (!tmpObj.ownedSkins[data[i + 9]]) {
                tmpObj.ownedSkins[data[i + 9]] = 1;
            }
            tmpObj.zIndex = data[i + 12];
            tmpObj.visible = true;
            tmpObj.opacity = 1;
            tmpObj.update(game.tickSpeed);
            tmpObj.velocity = calcVel(tmpObj);
            /*
                if (tmpObj.oldPredictPos) {
                    const moveDirVec = {
                        x: Math.cos(tmpObj.pmovDir),
                        y: Math.sin(tmpObj.pmovDir)
                    };
                    const delta1 = {
                        x: tmpObj.x2 - tmpObj.x3,
                        y: tmpObj.y2 - tmpObj.y3,
                    };
                    const delta2 = {
                        x: tmpObj.velocity.real.x - tmpObj.x4,
                        y: tmpObj.velocity.real.y - tmpObj.y4,
                    };
                    const delta3 = {
                        x: tmpObj.x2 - tmpObj.oldPredictPos.x2,
                        y: tmpObj.y2 - tmpObj.oldPredictPos.y2,
                    };
                    let dot1 = delta1.x * moveDirVec.x + delta1.y * moveDirVec.y;
                    let dot2 = delta2.x * moveDirVec.x + delta2.y * moveDirVec.y;
                    let dot3 = delta3.x * moveDirVec.x + delta3.y * moveDirVec.y;
                    moveData.push([dot1 < 0 ? Math.hypot(delta1.x, delta1.y) : -(Math.hypot(delta1.x, delta1.y)), dot2 < 0 ? Math.hypot(delta2.x, delta2.y) : -(Math.hypot(delta2.x, delta2.y)), dot3 < 0 ? Math.hypot(delta3.x, delta3.y) : -(Math.hypot(delta3.x, delta3.y))])

                }
                if (moveData.length == 100) {
                    let data1 = 0;
                    let data2 = 0;
                    let data3 = 0;
                    let data1Total = 0;
                    let data2Total = 0;
                    let data3Total = 0;
                    for (let j = 0;j < moveData.length;j++) {
                        data1 += moveData[j][0];
                        data2 += moveData[j][1];
                        data3 += moveData[j][2];
                        data1Total += Math.abs(moveData[j][0]);
                        data2Total += Math.abs(moveData[j][1]);
                        data3Total += Math.abs(moveData[j][2]);
                    }
                    console.log(data1, data2, data3, data1Total / 100, data2Total / 100, data3Total / 100)
                    moveData = [];
                }*/
            tmpObj.oldPredictPos = {x2: tmpObj.x4, y2: tmpObj.y4};
            tmpObj.x3 = tmpObj.velocity.real.x;
            tmpObj.y3 = tmpObj.velocity.real.y;
            tmpObj.moveDirection = UWUTILS.getDirect(tmpObj, tmpObj, 3, 2);
            tmpObj.nextVelocity = calcNewVel(tmpObj);
            tmpObj.x4 = tmpObj.nextVelocity.real.x;//tmpObj.velocity.real.x + (tmpObj.x2 - tmpObj.velocity.real.x);
            tmpObj.y4 = tmpObj.nextVelocity.real.y;//tmpObj.velocity.real.y + (tmpObj.y2 - tmpObj.velocity.real.y);
            tmpObj.fVel = calcFVel(tmpObj);
            tmpObj.x5 = tmpObj.fVel.real.x;//tmpObj.velocity.real.x + (tmpObj.x2 - tmpObj.velocity.real.x);
            tmpObj.y5 = tmpObj.fVel.real.y;
            tmpObj.mVel = calcMVel(tmpObj);
            tmpObj.x6 = tmpObj.mVel.real.x;
            tmpObj.y6 = tmpObj.fVel.real.y;
            tmpObj.damageThreat = 0;
            if (
                tmpObj.primaryIndex != tmpObj.weaponIndex &&
                tmpObj.weaponIndex != undefined &&
                tmpObj.weaponIndex < 9
            ) {
                tmpObj.primaryIndex = tmpObj.weaponIndex;
            } else if (
                tmpObj.secondaryIndex != tmpObj.weaponIndex &&
                tmpObj.weaponIndex != undefined &&
                tmpObj.weaponIndex > 8
            ) {
                tmpObj.secondaryIndex = tmpObj.weaponIndex;
            }
            if (
                tmpObj.primaryVariant != tmpObj.weaponVariant &&
                tmpObj.weaponVariant != undefined &&
                tmpObj.weaponIndex < 9
            ) {
                tmpObj.primaryVariant = tmpObj.weaponVariant;
            } else if (
                tmpObj.secondaryVariant != tmpObj.weaponVariant &&
                tmpObj.weaponVariant != undefined &&
                tmpObj.weaponIndex > 8
            ) {
                tmpObj.secondaryVariant = tmpObj.weaponVariant;
            }
            tmpObj.primary = items.weapons[tmpObj.primaryIndex ?? 5];
            tmpObj.secondary = items.weapons[tmpObj.secondaryIndex ?? 15];
            if (
                Math.hypot(tmpObj.x2 - tmpObj.x1, tmpObj.y2 - tmpObj.y1) < 2
            ) {
                tmpObj.oldMoveDir = tmpObj.moveDir;
                tmpObj.moveDir = undefined;
                tmpObj.moveTime = 0;
            } else {
                tmpObj.moveTime++;
                tmpObj.oldMoveDir = tmpObj.moveDir;
                tmpObj.moveDir = UWUTILS.getDirect(tmpObj, tmpObj, 2, 1);
            }
            if (loopHats.includes(tmpObj.skinIndex)) {
                let indx = loopHats.indexOf(tmpObj.skinIndex) - 1
                if (tmpObj.oldSkinIndex == loopHats[((indx < 0) ? 12 : indx)]) {
                    if (friendList.includes(tmpObj.sid)) loopIndex = indx + 2;
                    tmpObj.usingWhiteout = true;
                }
            }
            tmpObj.guessHack = tmpObj.happymod ? "Happy" : tmpObj.xwareRemake ? "x-ware" : tmpObj.onetickMod ? "Onetick" : tmpObj.annaRemake ? "Anna" : tmpObj.dangerShame == 1 ? "Star" : undefined
            if (tmpObj.sid != player.sid) {
                tmpObj.dist2 = UWUTILS.getDist(tmpObj, player, 2, 2);
                tmpObj.aim2 = UWUTILS.getDirect(tmpObj, player, 2, 2);
                tmpObj.dist3 = UWUTILS.getDist(tmpObj, player, 3, 3);
                tmpObj.aim3 = Math.atan2(tmpObj.y3 - player.y3, tmpObj.x3 - player.x3);
                tmpObj.dist4 = UWUTILS.getDist(tmpObj, player, 4, 4);
                tmpObj.aim4 = Math.atan2(tmpObj.y3 - player.y2, tmpObj.x3 - player.x2);
                tmpObj.aim5 = Math.atan2(tmpObj.y5 - player.y2, tmpObj.x5 - player.x2);
                tmpObj.dist5 = UWUTILS.getDist(tmpObj, player, 2, 5);
                tmpObj.dist6 = UWUTILS.getDist(tmpObj, player, 2, 6);
                tmpObj.boostTickDist = Math.abs(tmpObj.dist2 - (tmpObj.secondaryIndex == 12 ? 362 : 352)) <= 45;
                if (tmpObj.skinIndex == 53 && tmpObj.turretReload <= 1000 / 9) {
                    if (Math.abs(tmpObj.dist2 - (tmpObj.secondaryIndex == 12 ? 367 : 357)) <= 50) {
                        qHeal = 3;
                    }
                    console.log("turret gear");

                    if (!player.isTeam(tmpObj) && tmpObj.boostTickDist && tmpObj.hasBoost && tmpObj.primaryIndex == 5 && [12, 13].includes(tmpObj.secondaryIndex)) {
                        if (player.secondaryIndex == 11) {
                            console.log("blocking")
                            blockAim = tmpObj.aim2;
                            blockTime = game.tick + 2;
                            my.anti0tick = 4;
                            my.noAim = false;
                            if (player.weaponIndex != 11) selectWeapon(11, 0, 1);
                            noWep = true;
                            packet("D", blockAim, 1, "shield");
                            my.noAim = true;
                            qHold = true;
                        } else {
                            player.chat.message = "Boost tick distance";
                            player.chat.count = 500;
                            place(3, tmpObj.aim2);
                            my.anti0tick = 5;
                            qHold = true;
                            game.tickBase(() => {
                                qHold = true;
                            }, 3)
                        }
                    }
                    tmpObj.turretGear = true;
                    game.tickBase(() => {
                        tmpObj.turretGear = false;
                    }, 3);
                }
                if (tmpObj.oldSkinIndex != tmpObj.skinIndex && UWUTILS.getAngleDist(tmpObj.d2, tmpObj.d3) > 0.5) {
                    tmpObj.macroPoints.hatMacro += 5;
                } else if (tmpObj.oldSkinIndex != tmpObj.skinIndex) {
                    tmpObj.macroPoints.hatMacro -= 4;
                }
                /*
                    if (
                        ((tmpObj.oldSkinIndex == 12 && tmpObj.skinIndex == 22) ||
                        (tmpObj.oldSkinIndex == 22 && tmpObj.skinIndex2 == 12)) &&
                        tmpObj.moveDir == undefined &&
                        tmpObj.oldMoveDir
                    ) {
                        tmpObj.hackerPoints.hatChanger += 5;
                    } else if (
                        tmpObj.oldSkinIndex == 11 &&
                        tmpObj.skinIndex != 11 &&
                        tmpObj.skinIndex2 &&
                        player.primaryReload <= 111.12 &&
                        player.primaryReload > 0
                    ) {
                        tmpObj.hackerPoints.hatChanger += 3;
                    } else if (
                        [7, 0].includes(tmpObj.oldSkinIndex) &&
                        tmpObj.skinIndex == 6 &&
                        tmpObj.skinIndex2 == 6
                    ) {
                        tmpObj.hackerPoints.hatChanger += 2;
                    } else if (
                        [40, 0].includes(tmpObj.oldSkinIndex) &&
                        tmpObj.skinIndex == 6 &&
                        tmpObj.skinIndex2 == 6
                    ) {
                        tmpObj.hackerPoints.hatChanger += 2;
                    } else if (
                        !tmpObj.hackerPoints.tank &&
                        tmpObj.oldSkinIndex == 40 &&
                        tmpObj.skinIndex == 40 &&
                        tmpObj.skinIndex2 == 40
                    ) {
                        tmpObj.hackerPoints.tank = true;
                        setTimeout(() => {
                            tmpObj.hackerPoints.tank = false;
                        }, 20000);
                        tmpObj.hackerPoints.hatChanger--;
                    } else if (
                        !tmpObj.hackerPoints.normalHats &&
                        ![0, 6, 7, 11, 12, 53, 40, 22, 15, 26, 45].includes(tmpObj.skinIndex)
                    ) {
                        tmpObj.hackerPoints.hatChanger--;
                        tmpObj.hackerPoints.normalHats = true;
                        setTimeout(() => {
                            tmpObj.hackerPoints.normalHats = false;
                        }, 20000);
                    }
                }
                */
            }
            if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                tmpObj.addShameTimer();
            }
            if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                tmpObj.shameTimer = 0;
                tmpObj.shameCount = 0;
                if (tmpObj == player) {
                    healer();
                }
            }
            if (tmpObj.sid != player.sid) {
                const nearTrap = isInTrap(tmpObj);
                if (nearTrap) {
                    tmpObj.trapped = true;
                    tmpObj.inTrap = nearTrap;
                    tmpObj.trapInfo2 = nearTrap;
                    tmpObj.trapAim = UWUTILS.getDirect(nearTrap, tmpObj, 0, 2);
                    tmpObj.trapClear = false;
                } else {
                    if (tmpObj.trapped) {
                        tmpObj.trapped = false;
                        tmpObj.inTrap = undefined;
                        tmpObj.trapAim = undefined;
                        if (!tmpObj.trapClear) {
                            game.tickBase(() => {
                                tmpObj.trapInfo2 = undefined;
                                tmpObj.trapClear = true;
                            }, 2);
                        }
                    }
                }
                if(!player.isTeam(tmpObj)&&tmpObj.trapped){
                    const tmpspk = liztobj.find2(e => (e.dmg && cdf(tmpObj, e)<=(e.scale+40)&&player.isTeam(e.owner.sid))||(e?.type==1 && e.y>=12000 && cdf(tmpObj, e)<=(e.scale*0.6+36)));
                    if (tmpspk) {
                        tmpObj.checkSpike = tmpspk.dmg ?? 35;
                        tmpObj.touchSpike = true;
                    } else {
                        tmpObj.checkSpike = 0;
                        tmpObj.hitSpike = false;
                        tmpObj.touchSpike = false;
                    }
                } else {
                    tmpObj.checkSpike = 0;
                    tmpObj.hitSpike = false;
                    tmpObj.touchSpike = false
                }
            } else {
                trapSpike = false;
                if (gameObjects.length) {
                    for (let i = 0; i < gameObjects.length; i++) {
                        const tmp = gameObjects[i];
                        tmp.aim2 = UWUTILS.getDirect(tmp, player, 0, 2);
                        tmp.dist2 = UWUTILS.getDist(tmp, player, 0, 2);
                    }
                    const nearTrap = isInTrap(tmpObj);
                    if (nearTrap) {
                        traps.in = true;
                        traps.tick = game.tick;
                        trapClear = false;
                        traps.info = nearTrap;
                        const trapAim = caf(player, nearTrap);
                        const spike = liztobj.filter2(
                            (obj) =>
                            obj.dmg &&
                            UWUTILS.getDist(obj, player, 0, 2) <= obj.scale + (player.hammer.range) &&
                            !obj.isTeamObject(tmpObj) &&
                            obj.active
                        ).sort(function (tmp1, tmp2) {
                            return tmp1.dist2 - tmp2.dist2;
                        })[0];
                        if (!spike || !spike.length) {
                            traps.dist = UWUTILS.getDist(nearTrap, tmpObj, 0, 2);
                            console.log(trapAim)
                            traps.aim = trapAim;
                            breakingSpike = false
                        } else {
                            console.log(spike)
                        const spikeAngles = spike.map((e) => UWUTILS.getDirect(e, player, 0, 2));
                        const doubleHitSpike = [];
                        spikeAngles.find2((e) => {
                            if (spikeAngles.find2((x) => {
                                const angleDist = UWUTILS.getAngleDist(e, x);
                                if (angleDist > 0.01 && angleDist <= (config.gatherAngle * 2)) {
                                    asdgjdh.push(x);
                                    return true;
                                };
                            })) {
                                asdgjdh.push(e)
                                return true;
                            }
                        });
                        const hitTrapAndSpike = spikeAngles.find2((e) => UWUTILS.getAngleDist(e, trapAim) <= (config.gatherAngle * 2));
                        if (!traps.antiTrapped) {
                            traps.antiTrapped = true;
                            console.log("PROTECT")
                            traps.protect(traps.aim + PI);
                        }
                        if (doubleHitSpike) console.log(doubleHitSpike)
                            if (hitTrapAndSpike) console.log(hitTrapAndSpike)
                        traps.dist = UWUTILS.getDist(nearTrap, tmpObj, 0, 2);
                        traps.aim = spike ? doubleHitSpike ? UWUTILS.getMidAngle(doubleHitSpike[0], doubleHitSpike[1]) : hitTrapAndSpike ? UWUTILS.getMidAngle(hitTrapAndSpike, trapAim) : UWUTILS.getDirect(spike, player, 0, 2) : trapAim;
                        if (spike && !hitTrapAndSpike || doubleHitSpike.length) {
                            breakingSpike = true;
                        } else breakingSpike = false;
                    }
                    } else {
                        if (traps.in) {
                            traps.antiTrapped = false;
                            if (!trapClear) {
                                game.tickBase(() => {
                                    trapClear = true;
                                }, 1);
                            }
                            traps.in = false;
                            traps.info = {};
                        }
                    }
                } else {
                    if (traps.in) {
                        traps.antiTrapped = false;
                        game.tickBase(() => {
                            trapClear = true;
                        }, 1);
                        traps.in = false;
                        traps.info = {};
                    }
                }
            }
            if (!player.isTeam(tmpObj.sid)) {
                nearEnemies.push(tmpObj);
            }
            nearPlayers.push(tmpObj);
        }
        i += 13;
    }
    for (let i = 0;i < players.length;i++) {
        const tmpObj = players[i];
        if (!tmpObj.visible) {
            if (tmpObj.primaryReload !== 0 || tmpObj.secondaryReload !== 0 || tmpObj.turretReload !== 0) {
                tmpObj.primaryReload = 0;
                tmpObj.secondaryReload = 0;
                tmpObj.turretReload = 0;
            }
            if (tmpObj.listElement && (game.tick - tmpObj.guessTime) % 9 === 0) {
                tmpObj.updateListTime();
            }
        }
    }
    if (gameObjects.length && inGame) {
        renderObj = gameObjects.filter2((e) => e.active && Math.abs(e.x - player.x2) + e.scale <= maxScreenWidth && Math.abs(e.y - player.y2) + e.scale <= maxScreenHeight && (e.render = true || true));
        liztobj = renderObj.filter2((e) => e.dist2 <= 800)
    }
    for (let i = 0;i < liztobj.length;i++) {
        const obj = liztobj[i];
        if (obj.dmg || obj.type === 1 && obj.y >= 12000) obj.distance3 = UWUTILS.getDist(obj, player, 0, 3);
    }
    const asdd = liztobj.filter2((e) => e.active);
    liztobj = asdd;
    nearObjects = asdd.filter2((e) => e.dist2 <= 500);
    let ai = ais.find2((e) => e.active && e.health > 0 && e.visible && e.lowHealth &&
                      UWUTILS.getDist(player, e, 2, 2) <= player.primary.range + e.scale + 50);
    if (ai) {
        noTail = true;
    } else {
        noTail = false;
    }
    if (player.skinIndex == 40 && player.oldSkinIndex == 40 && player.skinIndex2 == 40) {
        noHat = false;
    }
    let clicking;
    for (let i = 0; i < data.length; i += 13) {
        let tmp = findPlayerBySID(data[i]);
        let POWEREX = tmp.weaponReload == 0;
        if (!tmp) continue;

        if (!tmp.isTeam(player) && !friendList.includes(data[i])) {
            enemy.push(tmp);
        }

        let tmpVar =
            tmp.primary.range + (tmp.hasBoost ? 140 : 100);
        if (
            (tmp.dist2 <= tmpVar ||
             tmp.dist3 <= tmpVar) &&
            tmp != player &&
            (player.team == undefined || tmp.team == undefined || player.team != tmp.team)
        ) {
            nears.push(tmp);
        }
        tmp.antiBull = 0;
        tmp.manageReload();
        if (tmp.primaryReload == 0) tmp.lastReloadedTick = game.tick
        /*
            if (tmp.sid !== player.sid) {
                clicking = false;

                clicking = tmp.lastSkinIndexes.some(
                    (_, j, arr) =>
                    arr[j] === 6 &&
                    (arr[j + 1] === 0 || arr[j + 1] === 40 || arr[j + 1] === 7) &&
                    arr[j + 2] === 6
                );

                tmp.hackerPoints.hatChanger;

                let tmpDir = tmp.d2;
                let tmpPoints = tmp.hackerPoints.autoAim;
                if (
                    tmp.trapped &&
                    Math.abs(tmp.d3 - tmp.d2) > 0.1 &&
                    Math.abs(tmp.trapAim - tmp.d2) <= 0.05
                ) {
                    tmp.hackerPoints.autoAim += 2;
                }
                let ax = Math.abs(UWUTILS.getDirect(tmp.near, tmp, 2, 2) - tmp.d2);
                if (
                    (UWUTILS.getDist(tmp, tmp.near, 2, 2) <= 400 &&
                    Math.abs(tmp.d2 - tmp.d3) > 1 &&
                    ax <= 0.05) ||
                    (ax == 0 && Math.abs(tmp.d2 - tmp.d3) > 0.2)
                ) {
                    tmp.hackerPoints.autoAim += 4;
                }
                if (
                    tmpPoints !== tmp.hackerPoints.autoAim &&
                    tmp.trapped &&
                    tmp.weaponReload === 0
                ) {
                    tmp.hackerPoints.autoAim--;
                }
            }*/
    }
    shameHackers.length = 0;
    let enemyHackers = [];
    const reloadedMusk = [];
    for (let i = 0; i < nearPlayers.length; i++) {
        let tmp = nearPlayers[i];
        if (!tmp.listElement) addPlayerToList(tmp);
        if (tmp.secondaryIndex == 15 && tmp.secondaryReload <= game.tickRate) {
            reloadedMusk.push(tmp);
        }
        if (friendList.includes(tmp.sid)) {
            legits.push(tmp.sid);
        }
        if (tmp.sid == player.sid) continue;
        tmp.notHacking = (tmp.hackerPoints.autoheal < -4 && tmp.macroPoints.hatMacro <= 0);
        tmp.hacking = annoyingList.includes(tmp.sid) || tmp.hackerPoints.autoheal > 8/*((tmp.hackerPoints.autoheal > 2 && tmp.hackerPoints.hatChanger > 1) ||
                tmp.hackerPoints.autoheal > 8 ||
                tmp.hackerPoints.hatChanger > 5 ||
                tmp.hackerPoints.autoAim > 7 ||
                (tmp.hackerPoints.autoAim > 3 && tmp.hackerPoints.autoheal > 2));*/
        tmp.macroing = tmp.macroPoints.hatMacro > 4;
        if (tmp.notHacking && !annoyingList.includes(tmp.sid)) tmp.hacking = false;
        if (tmp.hacking) {
            tmp.hacker = true;
        } else {
            tmp.hacker = false;
        }
        if (
            (tmp.hacking || !evil || annoyingList.includes(tmp.sid)) &&
            !friendList.includes(tmp.sid) &&
            !player.isTeam(tmp)
        ) {
            tmp.hacker = true;
            tmp.macroing = false;
            enemyHackers.push(nearPlayers[i]);
            if (inGame && player && player.primaryIndex == 5) {
                if (player.items[4] == 16 && [9, 12, 13].includes(player.secondaryIndex) && Math.abs(tmp.dist2 - player.frameDist) <= 90) {
                    circle1.push(tmp)
                } else if (player.primaryVariant >= 2 && Math.abs(tmp.dist2 - 238) <= 90) {
                    circle2.push(tmp)
                }
            }
            if (
                nearPlayers[i].shameCount >=
                (getEl("shameInstaCount-text").value === "auto" ? nearPlayers[i].dangerShame :
                 parseInt(getEl("shameInstaCount-text").value))
            ) {
                shameHackers.push(nearPlayers[i]);
            }
        } else if (
            tmp.macroing &&
            !friendList.includes(tmp.sid) &&
            !checkIsTeam(tmp.sid)
        ) {
            tmp.hacking = true;
            enemyHackers.push(tmp);
            if (
                nearPlayers[i].shameCount >=
                (getEl("shameInstaCount-text").value === "auto" ? nearPlayers[i].dangerShame :
                 parseInt(getEl("shameInstaCount-text").value))
            ) {
                shameHackers.push(nearPlayers[i]);
            }
        } else if (tmp.notHacking) {
            tmp.hacker = false;
            tmp.macroing = false;
            legits.push(tmp.sid);
        }
    }
    breakObjs = [];
    objDmgPot()
    if (reloadedMusk.length >= 2 && player.secondaryIndex == 11) {
        blockAim = UWUTILS.averageAngle(reloadedMusk.map((e) => e.aim3));
        blockTime = game.tick + 1;
        my.anti0tick = 2;
        my.noAim = false;
        if (player.weaponIndex != 11) selectWeapon(11, 0, 1);
        noWep = true;
        packet("D", blockAim, 1, "shield");
        my.noAim = true;
        qHold = true;
    } else if (blockTime == game.tick) {
        noWep = false;
        qHold = false;
        blockAim = undefined;
        selectWeapon(player.primaryIndex);
        my.noAim = false;
    }
    if (textManager.stack.length) {
        let stacks = [];
        let notstacks = [];
        let renderTexts = [];
        let num = 0;
        let num2 = 0;
        let pos = {
            x: null,
            y: null,
        };
        let pos2 = {
            x: null,
            y: null,
        };
        for (let i = 0;i < textManager.stack.length;i++) {
            let text = textManager.stack[i];
            text.target.info.num += text.value;
        }
        let value;
        let x;
        let y;
        for (let i = 0;i < textManager.stack.length;i++) {
            let text = textManager.stack[i];
            if (!(renderTexts.map((e) => e.sid).includes(text.target.info.sid))) {
                renderTexts.push({crit: text.crit, x: text.x, y: text.y, sid: text.target.info.sid, value: text.target.info.num})
                text.target.info.num = 0;
            }
        }
        for (let i = 0;i < renderTexts.length;i++) {
            let renderText = renderTexts[i];
            /*if (false && renderText.value > 0 && (configs.astolfoHeartDamage || (renderText.isPoison && configs.astolfoHeartDamageRuby))) {
                    let randomX = renderText.x - (Math.round(Math.random() * 30) - 15);
                    let randomY = renderText.y - (Math.round(Math.random() * 30) - 15) - 10;
                    textManager.showText(
                        randomX,
                        randomY,
                        50,
                        0.18,
                        800,
                        renderText.value,
                        "pink",
                        astolfo
                    );
                } else {*/
            if (renderText.value < 0) {
                textManager.showText(
                    renderText.x,
                    renderText.y,
                    Math.max(10, 10 + renderText.value),
                    0.18,
                    Math.max(500, 125 + renderText.value * 12.5),
                    Math.abs(renderText.value),
                    false,
                    "#8ecc51"
                );
            }
            if (renderText.value > 80) renderText.crit = true;
            if (renderText.value > 0) {
                textManager.showText(
                    renderText.x,
                    renderText.y,
                    Math.max(10, ((renderText.value >= 100 || renderText.crit) ? 110 : 10 + renderText.value)),
                    renderText.crit ? 0.001 : 0.18,
                    renderText.value >= 82 || renderText.crit ? 2600 : (Math.max(500, renderText.value * 13)),
                    Math.abs(renderText.value),
                    renderText.crit,
                    (renderText.value > 80 || renderText.crit ? "red" : configs.pinkUI ? "pink" : "#fff")
                );
            }
            /* }*/
        }
        textManager.stack.length = 0;
        /*for (let i = 0;i < texts.length;i++) {
                let text = texts[i];
                if (text.num2 > 0) {
                    textManager.showText(
                        pos2.x,
                        pos2.y,
                        Math.max(45, Math.min(50, num2)),
                        0.18,
                        500,
                        num2,
                        "#8ecc51"
                    );
                }
                if (text.num > 0) {
                    textManager.showText(
                        pos.x,
                        pos.y,
                        Math.max(45, Math.min(50, num)),
                        0.18,
                        500,
                        num,
                        "#fff"
                    );
                }
            }
        }*/
    }
    if (enemyHackers.length) {
        nearHacker = enemyHackers.sort(function (tmp1, tmp2) {
            return tmp1.dist2 - tmp2.dist2;
        })[0];
    }
    if (enemy.length) {
        near = enemy.sort(function (tmp1, tmp2) {
            return tmp1.dist2 - tmp2.dist2;
        })[0];
    }
    for (let i = 0, len = friendList.length; i < len; i++) {
        const tmpPlayer = findPlayerBySID(friendList[i]);
        if (!tmpPlayer) continue;
        const skinIdx = tmpPlayer.skinIndex;
        const indx = loopHats.indexOf(skinIdx);
        if (indx !== -1 && tmpPlayer.oldSkinIndex === loopHats[(indx + 11) % 12]) {
            loopIndex = (indx + 2) % 12;
            break;
        }
    }
    /*if (macro.k && player.turretReload == 0) {
            let savedPos = {x2: nearHacker.x2, y2: nearHacker.y2};
            let estimatedPos = {
                x: nearHacker.x3 + 4.25 * game.tickRate * Math.cos(nearHacker.aim3),
                y: nearHacker.y3 + 60 * Math.sin(nearHacker.aim3),
                x2: nearHacker.x3 + 60 * Math.cos(nearHacker.aim3) + 30 * Math.cos(nearHacker.aim4),
                y2: nearHacker.y3 + 60 * Math.sin(nearHacker.aim3) + 30 * Math.sin(nearHacker.aim4)

            };

            instaC.isTrue = true;
            my.autoAim = 2;
            game.tickBase(() => {
                buyEquip(53, 0);
                sendAutoGather(3);
                data1.push(UWUTILS.getDist(nearHacker, savedPos, 2, 2));
                //selectWeapon(player.weapons[player.weaponIndex < 9 ? 1 : 0]);
                game.tickBase(() => {
                    data2.push(UWUTILS.getDist(nearHacker, savedPos, 2, 2));
                    game.tickBase(() => {
                        data3.push(UWUTILS.getDist(nearHacker, nearHacker.oldPos, 2, 2));
                        instaC.isTrue = false;
                    }, 1)
                }, 1);
            }, 1);
        } else if (macro.u && !noHat) {
            let savedPos = {x: player.x2, y: player.y2};
            noHat = true;
            packet("9", getSafeDir(), 1, "move");
            noMove = true;
            buyEquip(53, 0);
            game.tickBase(() => {
                selectWeapon(13);
            data0.push(UWUTILS.getDist(savedPos, player, 0, 2));
            buyEquip(12, 0);
            place(4, getSafeDir());
            game.tickBase(() => {
                selectWeapon(5);
                buyEquip(7, 0);
                let a = UWUTILS.getDist(savedPos, player, 0, 2);
                let b = UWUTILS.getDist(player.oldPos, player, 2, 2)
                    console.log(a, b);
                    data1.push([a, b])
                    game.tickBase(() => {
                    a = UWUTILS.getDist(savedPos, player, 0, 2);
                    b = UWUTILS.getDist(player.oldPos, player, 2, 2)
                    console.log(a, b);
                    data2.push([a, b])
                    game.tickBase(() => {
                        a = UWUTILS.getDist(savedPos, player, 0, 2);
                        b = UWUTILS.getDist(player.oldPos, player, 2, 2)
                        console.log(a, b);
                        noHat = false;
                        noMove = false;
                        }, 1)
                    }, 1)
                }, 1)
            }, 1)
        }*/
    if (player.weaponIndex < 9 && player.primaryR == player.primary.speed) {
        if (nearHacker.skinIndex == 11) {
            nearHacker.antiBulling = true;
        } else if (nearHacker.dist2 <= player.primary.range + 68) {
            nearHacker.antiBulling = false;
        }
    }
    if (nearHacker.oldSkinIndex == 7 && nearHacker.skinIndex != 7 && nearHacker.skinIndex2 != 7 && nearHacker.shameCount > 0 && nearHacker.weaponReload != nearHacker.weapon.speed) {
        nearHacker.faultyBullTick = game.tick - 2;
    }
    if (game.tick - nearHacker.faultyBullTick > 10) nearHacker.faultyBullTick = undefined;
    customDelay = Number(getEl("customDelay-text").value)
    //femboy code
    let oneticked = false;
    let preVelocity = UWUTILS.getDist(player.oldPos, player, 2, 2) > 10 && UWUTILS.getAngleDist(UWUTILS.getDirect(player, player.oldPos, 2, 2), nearHacker.aim3) <= Math.PI / 3;
    if ([9, 12, 13, 15].includes(player.secondaryIndex) &&
        (macro.Control || UWUTILS.getAngleDist(nearHacker.movDir, nearHacker.aim2 + Math.PI) <= 0.7 || nearHacker.trapped) &&
        player.turretReload == 0 && checkCanPlace(4, nearHacker.aim4) &&
        nearHacker == near &&
        !UWUTILS.checkLineCollision(nearHacker.aim4, player, nearObjects, (macro.Control ? 20 : 35), 375) &&
        player.items[4] == 16 && player.primaryReload == 0 &&
        player.secondaryReload == 0) {
        const nHD2 = nearHacker.dist2;
        const nHD4 = UWUTILS.getDist(player, nearHacker, 2, 4);
        const nHD5 = UWUTILS.getDist(player, nearHacker, 2, 5);
        const nHD6 = nearHacker.dist6;
        if (player.primaryIndex == 5 && player.secondaryIndex == 13) {
            if (nearHacker.trapped && nHD2 > 373 && nHD5 < preVelocity ? 380 : 382.5 || (macro.Control || (nHD5 > 370 && nHD5 < 385.5 && !nearHacker.trapped && (nHD6 - nHD5 > 10 ||
                    nearObjects.find2((e) => (!e.ignoreCollision && Math.hypot(nearHacker.x5 + 25 * Math.cos(nearHacker.aim5) - e.x, nearHacker.y5 + 25 * Math.sin(nearHacker.aim5) - e.y) <= e.realScale + 30 || e.boostSpeed && Math.hypot(nearHacker.x5 + 25 * Math.cos(nearHacker.aim5) - e.x, nearHacker.y5 + 25 * Math.sin(nearHacker.aim5) - e.y) <= e.realScale + 30 && UWUTILS.getAngleDist(e.dir, nearHacker.aim4 + Math.PI) <= 0.6)))))) {
                console.log("in range")
                instaC.boostTickType((macro.Control || nHD5 > 370 && nHD5 < 385.5) ? "boost1" : nHD4 <= 365 && nHD4 > 345 ? "instant" : (nHD5 > 375 && nHD5 < 390.5) ? "boost2" : null);
            } else {
                console.log(nHD2)
            }
        }
    }
    if (nearHacker == near && !traps.in && evil && nearHacker.sid && !instaC.isTrue) {
        const uwu = Math.floor((nearHacker.weapon.speed - nearHacker.weaponReload) / 111)
        const cwickingHackew = nearHacker.trapped || nearHacker.lastSkinIndexes.slice(-(uwu + 1), -(uwu - 1)).find2((e) => [40, 7].includes(e));
        const purr = nearHacker.weaponReload;
        const meow = (game.tick - player.bullTick) % 9 === 8 && nearHacker.shameCount > 0 || (game.tick - nearHacker.faultyBullTick) % 9 === 0 || !nearHacker.ownedSkins[6] || cwickingHackew && purr > 0 && purr <= game.tickRate;
        const dist = 202;
        const speed = calcOTVel();
        console.log(hypot(speed.x - nearHacker.x3, speed.y - nearHacker.y3))
        const close = hypot(speed.x - nearHacker.x3, speed.y - nearHacker.y3) <= dist;
        console.log(cwickingHackew, close, meow, purr, dist)
        //console.log(uwu, cwickingHackew, nearHacker.skinIndex, purr, meow, cwose, nearHacker.lastSkinIndexes, [...nearHacker.lastSkinIndexes], nearHacker.lastSkinIndexes[0], (nearHacker.lastSkinIndexes.slice(-(uwu + 2), ((uwu == 2) ? 10 : -(uwu - 2)))))
        if (
            player.primaryVariant >= 2 &&
            configs.autoOnetick &&
            player.turretReload == 0 &&
            player.primaryReload <= 111 &&
            player.primaryIndex == 5 &&
            close &&
            hypot(player.x2 - nearHacker.x3, player.y2 - nearHacker.y3) >= 210 && (configs.spamFrame && (!cwickingHackew && (nearHacker.weaponReload - 222) > 0)|| meow)) {
            console.log("oneticking")
            if (nearHacker.skinIndex == 22) {
                game.tickBase(() => {
                    if (nearHacker.trapped) {
                        oneTick(1);
                        oneTicked = true;
                        game.tickBase(() => {
                            oneTicked = false;
                        }, 2)
                    } else {
                        oneTick(1);
                        oneTicked = true;
                        game.tickBase(() => {
                            oneTicked = false;
                        }, 2)
                    }
                }, 1)
            } else {
                if (nearHacker.trapped) {
                    oneTick(1);
                    oneTicked = true;
                    game.tickBase(() => {
                        oneTicked = false;
                    }, 2)
                } else if (nearHacker.skinIndex != 22) {
                    oneTick(1);
                    oneTicked = true;
                    game.tickBase(() => {
                        oneTicked = false;
                    }, 2)
                }
            }
            /*
            if (!uwu) {
                oneTick();
                oneTicked = true;
                game.tickBase(() => {
                    oneTicked = false;
                }, 3)
            } else {
                oneTick(1);
                oneTicked = true;
                game.tickBase(() => {
                    oneTicked = false;
                }, 3)
            }*/
        }
    }
    player.dmgpot = DmgPotWorkfrfrfr().dmg;
    if (player.health < 88 && player.dmgpot >= 88) healer();
    for (let i = 0;i < enemy.length;i++) {
        const tmpPlayer = enemy[i]
        tmpPlayer.placePot = (tmpPlayer.dist2 <= 300 ? enemyPlacement(tmpPlayer,9, caf(tmpPlayer,player)) : {onPlayer:[],possible:[],placeRange:null})
    }
    let antiOneticked = false;
    if (!oneTicked && player.skinIndex != 56) {
        for (let i = 0;i < enemy.length;i++) {
            const tmpPlayer = enemy[i]
            if (tmpPlayer.primaryVariant >= 2 && (Math.abs(tmpPlayer.dist2 - 238) <= 20 || (tmpPlayer.dist2 >= 220 && tmpPlayer.boosted)) && tmpPlayer.primaryIndex == 5
                && tmpPlayer.primaryReload <= game.tickRate && tmpPlayer.turretReload == 0) {
                console.log("MAYBE ONETICK, SKININDEX: " + tmpPlayer.skinIndex.toString())
            }
            if (tmpPlayer.skinIndex == 53) {
                if ((tmpPlayer.primaryIndex == undefined || tmpPlayer.primaryVariant >= 2 && tmpPlayer.primaryIndex == 5 && tmpPlayer.primaryReload <= game.tickRate) && (Math.abs(tmpPlayer.dist2 - 245) <= 40 || (tmpPlayer.dist3 <= 300 && tmpPlayer.boosted))) {
                    console.log("ANTIONETICK, SKININDEX: " + tmpPlayer.skinIndex.toString());
                    antiOneticked = true;
                    buyEquip(6, 0);
                    my.anti0tick = 2;
                    player.chat.message = "Anti Onetick " + tmpPlayer.sid;
                    player.chat.count = 2000;
                }
            }
        }
    }
    if (configs.spotify && spotifyTick % 80 == 79) {
        if (adBreak) {
            adBreak = false;
            shortVideo = true;
            packet("6", "want a break from the ads", "autoChat");
        } else if (shortVideo) {
            shortVideo = false;
            adBreak = true;
            countSpotify = false;
            packet("6", "tap to watch a short video", "autoChat");
            setTimeout(() => {
                packet("6", "to get 30 minutes of", "autoChat");
                setTimeout(() => {
                    packet("6", "ad free music", "autoChat");
                    countSpotify = true;
                }, 800);
            }, 1600);
        }
    }
    if (countSpotify) spotifyTick++;
    if (runAtNextTick.length) {
        for (let i = 0; i < runAtNextTick.length; i++) {
            const tmp = runAtNextTick[i];
            checkProjectileHolder(...tmp);
        }
        runAtNextTick.length = 0;
    }
    if (!traps.in && enemy.length && !antiOneticked && [4, 5].includes(nearHacker.primaryIndex)) {
        let possiblePreHitSync = nearObjects.find2(
            (tmp) =>
            tmp.dmg &&
            tmp.active &&
            tmp.owner && tmp.owner.sid != player.sid && (!player.team || !findPlayerBySID(tmp.owner.sid) || !findPlayerBySID(tmp.owner.sid).team || findPlayerBySID(tmp.owner.sid).team != player.team) &&
            UWUTILS.getDist(tmp, player, 0, 3) <= tmp.scale + 33
        );
        if (possiblePreHitSync && near.weaponReload <= game.tickRate && near.dist2 <= (near.weapon.range + 100) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 0))) {
            my.anti0tick = 1;
            player.chat.message = "Anti Prehit";
            player.chat.count = 1500;
        }
    }
    if (player.food >= items.list[player.items[0]].req[1] && (player.health <= 20 || game.tick - player.hitTime >= 2 && (config.isSandbox || player.shameCount > 0 || player.food > 1000 || player.health <= 80 || (player.health <= 90 && near.dist2 <= 300) || potential > player.health))) {
        healer();
    }
    if (game.tickQueue[game.tick]) {
        for (let i = 0; i < game.tickQueue[game.tick].length; i++) {
            const action = game.tickQueue[game.tick][i];
            action();
        }
        game.tickQueue[game.tick] = null;
    }
    for (let i = 0;i < game.waitingActions.ticks.length;i++) {
        console.log(game.waitingActions)
        if (game.waitingActions.ticks[i] >= game.tick) {
            game.waitingActions.actions[i]();
            game.waitingActions.actions.splice(i, 1);
            game.waitingActions.ticks.splice(i, 1);
        }
    }
    if (enemy.length && (player.secondaryIndex == 10 || instaC.perfCheck(3))) {
        if (configs.shameInsta && shameHackers.length && shameHackers.find2((e) => UWUTILS.getDist(e, player, 2, 2) <= 63 + player.primary.range)) {
            shameInsta = true;
        } else {
            shameInsta = false;
        }
        let revInsta = false;
        let revPossibility = player.secondaryIndex != 15 || nearHacker.dist2 <= player.primary.range - 0.35 * game.tickRate;
        if (configs.antiInstaTricker && player.primaryIndex == 5 && player.secondaryIndex == 15 && player.primaryVariant == 3) {
            if (nearHacker.dist2 && (((game.tick - player.bullTick) % 9 === 8 || (game.tick - player.bullTick) % 9 === 7) && (shameInsta || waitInsta) && nearHacker.dist2 <=
                                     205 &&
                                     !instaC.isTrue &&
                                     player.secondaryReload == 0 &&
                                     player.primaryReload == 0 &&
                                     player.turretReload == 0
                                    )) {
                instaC.changeType("antiHack")
            }
        } else if (player.primaryIndex == 5 && player.secondaryIndex == 10 && player.primaryVariant >= 2 && player.secondaryVariant == 3) {
            if (nearHacker.dist2 && (((game.tick - player.bullTick) % 9 === 8 || (game.tick - player.bullTick) % 9 === 0) && nearHacker.skinIndex != 6 && (shameInsta || waitInsta) && nearHacker.dist2 <=
                                     138 &&
                                     !instaC.isTrue &&
                                     player.secondaryReload == 0 &&
                                     player.primaryReload == 0 &&
                                     player.turretReload == 0
                                    )) {
                instaC.changeType("rev")
            }
        } else if (nearHacker.dist2 && ((shameInsta && (player.primaryIndex != 3 || player.primaryVariant != 3 || !configs.antiEmpAnti || ((game.tick - player.bullTick + 1) % 9 <= 1 || (game.tick - player.bullTick) % 9 !== 8 && revPossibility && (revInsta = true || true)))) || (waitInsta && player.checkCanInsta(false))) && nearHacker.dist2 <= (player.hammer.range + 63) && player.primaryReload == 0 && player.secondaryReload == 0
                   && player.turretReload <= (player.secondaryIndex == 10 || configs.rev ? 0 : game.tickRate)) {
            console.log("ISTRUE: ", instaC.isTrue);
            instaC.changeType(revInsta || configs.rev || player.secondaryIndex == 10 ? "rev" : "normal");
        } else {
            instaC.shameHacker = false;
        }
    }
    if (nears.filter2((e) => e.antiBull).length) {
        for (let i = 0; i < nears.length;i++) {
            let GreetingsfromItaly = nears[i];
            let item = GreetingsfromItaly.weapon;
            if (GreetingsfromItaly.weaponReload == 0) {
                player.zyncDmg += item.pDmg ?? (item.dmg * sortWeaponVariant(GreetingsfromItaly.primaryVariant) * 1.5)
            }
        }
    } else {
        player.zyncDmg = 0;
    }
    allies = player.team ? players.filter2((e) => e.team == player.team) : [];
    nearAllies = player.team ? nearPlayers.filter2((e) => e.team == player.team) ?? [] : [];
    if (boostSpike) {
        autoBoostSpike(nearHacker.movDir == null);
    }
    let canSyncHit = false;
    if (
        player.primaryReload != 0 ||
        !nearHacker ||
        player.primary &&
        nearHacker.dist2 > player.primary.range + 63
    ) {
        canSyncHit = false;
    } else if (player.primary) {
        let _ = nearHacker;
        let dmg = 0;
        for (let j = 0; j < nearPlayers.length; j++) {
            let tmp = nearPlayers[j];
            // console.log(tmp);
            if (tmp.sid == player.sid || tmp.sid == nearHacker.sid || (nearHacker.team && tmp.team && tmp.team === nearHacker.team)) continue;
            if (
                tmp.primaryIndex &&
                tmp.antiBull &&
                (UWUTILS.getDist(tmp, nearHacker, 3, 3) <=
                 tmp.primary.range + 63 ||
                 UWUTILS.getDist(tmp, nearHacker, 2, 2) <=
                 tmp.primary.range + 63)
            ) {
                dmg +=
                    tmp.primary.dmg *
                    sortWeaponVariant(tmp.primaryVariant) *
                    1.5;
            }
        }
        dmg +=
            player.primary.dmg *
            1.5 *
            sortWeaponVariant(player.primaryVariant);
        if (player.team && player.team.includes("zync")) {
            menuLog(dmg);
            menuLog(_.skinIndex);
        }
        if (dmg * ((_.skinIndex == 6) ? 0.75 : 1) >= 100) {
            canSyncHit = true;
        } else {
            canSyncHit = false;
        }
    }
    autoplacers();
    // autoHit:
    let autosynced = false;
    if (
        !instaC.isTrue &&
        my.anti0tick == 0 &&
        configs.autoSync &&
        canSyncHit &&
        (UWUTILS.getDist(player, nearHacker, 3, 3) <=
         player.primary.range + 63 ||
         UWUTILS.getDist(player, nearHacker, 2, 2) <=
         player.primary.range + 63)
    ) {
        autosynced = true;
        player.chat.message = "Autosync";
        player.chat.count = 2000;
        hitBull(nearHacker.aim2, 0);
    } else if (
        !instaC.isTrue &&
        nearHacker.shameCount == 7 &&
        nearHacker.dist2 <= player.primary.range + 63
    ) {
        autosynced = true;
        player.chat.message = "Auto Clown";
        player.chat.count = 2000;
        hitBull(nearHacker.aim2, 0);
    }
    nearestTeammate = undefined;
    for (let i = 0; i < nearPlayers.length; i++) {
        let tmp = nearPlayers[i];
        if (tmp.sid != player.sid && player.isTeam(tmp)) {
            if (!nearestTeammate || tmp && !friendList.includes(nearPlayers[i].sid) && tmp.dist2 < nearestTeammate.dist2) {
                nearestTeammate = tmp;
            }
        }
    }
    /*
    if (!antiOneticked && !autosynced && nearestTeammate) {
        const dst = hypot(nearestTeammate.x2 - nearHacker.x2, nearestTeammate.y2 - nearHacker.y2);
        if (nearHacker.dist2 <= player.primary?.range && dst <= nearestTeammate.primary?.range) {
            hitBull(nearHacker.aim2);
            autosynced = true;
            player.chat.message = "One Hit Sync";
            player.chat.count = 2000;
        } else if (player.secondaryIndex == 15 && nearestTeammate.secondaryIndex == 15 && nearHacker.dist2 <= 625 && dst <= 625) {
            let perf1 = "undefined";
            if (nearHacker.dist2 <= 505 && dst <= 505 && nearHacker.skinIndex != 6 && ((perf1 == "undefined" && (perf1 = instaC.perfCheck(2)) && false) || perf1)) {
                instaC.isTrue = true;
                buyEquip(6, 0);
                my.autoAim = 1;
                sendAutoGather(1);
                selectWeapon(15);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1)
                autosynced = true;
                player.chat.message = "Ranged Sync";
                player.chat.count = 2000;
            } else if (nearHacker.skinIndex != 6 && player.skins[1] && nearestTeammate.ownedSkins[1]) {
                instaC.isTrue = true;
                buyEquip(1, 0);
                my.autoAim = 1;
                sendAutoGather(1);
                selectWeapon(15);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1)
                autosynced = true;
                player.chat.message = "Ranged Sync";
                player.chat.count = 2000;
            } else if (nearHacker.dist2 <= 238 && dst <= 238 && player.skins[53] && nearestTeammate.ownedSkins[53]) {
                instaC.isTrue = true;
                buyEquip(53, 0);
                my.autoAim = 1;
                sendAutoGather(1);
                selectWeapon(15);
                game.tickBase(() => {
                    instaC.isTrue = false;
                }, 1)
                autosynced = true;
                player.chat.message = "Ranged Sync";
                player.chat.count = 2000;
            } else {
                const turretGearWillHit = checkProjectileHit(player, 1.5, nearHacker.aim2, nearHacker, 50);
                if (turretGearWillHit && checkProjectileHit(nearestTeammate, 1.5, nearHacker.aim2, nearHacker, 50)) {
                    const turretGearTimeout = turretGearWillHit
                }
            }
        }
    }
    /*
        if (aBTick && !ticked && player.primaryIndex == 5) {
            instaC.ticking = true;
            let aim = undefined;
            if (nearHacker.dist2 < 228) {
                aim = (nearHacker.aim2 + Math.PI);
            } else {
                aim = nearHacker.aim2;
            }
            let reload = nearHacker.weaponReload];
            if (nearHacker.dist2 >= 221 && nearHacker.dist2 < 228 && reload > 0 && reload <= game.tickRate) {
                oneTick(true);
                ticked = true;
                game.tickBase(() => {
                    ticked = false;
                }, 5)
            } else if (nearHacker.dist2 >= 218 && nearHacker.dist2 < 231) {
                buyEquip(40, 0);
                packet("9", aim, 1, "aBTick")
            } else if (nearHacker.dist2 > 214 && nearHacker.dist2 < 235) {
                if (player.buildIndex < 0) selectToBuild(player.items[1]);
                packet("9", aim, 1, "aBTick")
            } else if (nearHacker.dist2 >= 235 && nearHacker.dist2 <= 242) {
                if (player.skinIndex != 22) buyEquip(22, 0)
                packet("9", aim, 1, "aBTick")
            } else {
                packet("9", aim, 1, "aBTick")
            }
            console.log(aim)
        } else */
    if (!traps.in && my.anti0tick == 0 && !instaC.isTrue && !autosynced && !oneticked && !ticked && player.primaryIndex == 5) {
        if (oneTicking && keys[226]) {
            instaC.ticking = true;
            let aim = undefined;
            if (nearHacker.dist2 < 238) {
                aim = nearHacker.aim2 + Math.PI;
            } else {
                aim = nearHacker.aim2;
            }
            let reload = nearHacker.weaponReload
            if (UWUTILS.getDist(player, nearHacker, 2, 3) > (nearHacker.inTrap && reload > 0 && reload <= game.tickRate ? 227 : 229) && UWUTILS.getDist(player, nearHacker, 2, 3) < (nearHacker.inTrap && reload > 0 && reload <= game.tickRate ? 240 : 238)) {
                if (!nearHacker.trapped) {
                    oneTick();
                    ticked = true;
                    game.tickBase(() => {
                        ticked = false;
                    }, 5);
                }
            } else if (nearHacker.dist2 > 233 && nearHacker.dist2 < 243) {
                buyEquip(40, 0);
                packet("9", aim, 1, "oneTicking");
            } else if (nearHacker.dist2 > 228 && nearHacker.dist2 < 248) {
                if (player.buildIndex < 0) selectToBuild(player.items[1]);
                packet("9", aim, 1, "oneTicking");
            } else if (nearHacker.dist2 > 218 && nearHacker.dist2 < 258) {
                if (player.skinIndex != 22) buyEquip(22, 0);
                packet("9", aim, 1, "oneTicking");
            } else {
                packet("9", aim, 1, "oneTicking");
            }
        } else if (macro[","]) {
            if (!instaC.isTrue && [9, 12, 13, 15].includes(player.secondaryIndex) && player.secondaryReload == 0) {
                instaC.boostTickMovement();
            }
        } else {
            oneTicking = false;
            instaC.ticking = false;
        }
    } else {
        oneTicking = false;
        instaC.ticking = false;
    }
    preplaceTime = 0;
    let breakerReload = player.hammerReload;
    if (!traps.in && (primary || soldierBreaking)) {
        noHat = false;
        primary = false;
        soldierBreaking = false;
    }
    //let asdfasd = calcVel(nearHacker, nearHacker.aim3 + Math.PI, nearHacker, 1);
    if ([4, 5].includes(nearHacker.primaryIndex) && !breakingSpike && (nearHacker.sid && traps.checkZpyklerTick(0, (traps.in ? traps.info : [])) && (nearHacker.primaryIndex == undefined || [4, 5].includes(nearHacker.primaryIndex) && nearHacker.primaryReload <= game.tickRate) &&
        (nearHacker.secondaryReload == 0 || nearHacker.secondaryReload == 400 || player.primaryReload == 0) && (nearHacker.dist2 <= 120 || nearHacker.dist3 <= 120 || UWUTILS.getDist(player, asdfasd.accel, 2, 0) <= 117))) {
            my.anti0tick = 1;
            buyEquip(6, 0)
            player.chat.message = "Anti Trap Spiketick"
            player.chat.count = 700;
            console.log("Anti spiketick");
        }
        if (!clicks.right && traps.in) {
            console.log("Spiketick threat")
            if (player.secondaryReload > 0) console.log("Not reloaded")
            let bestOption = player.secondaryReload == 0 && player.secondaryIndex == 10 ? 10 : player.primaryReload == 0 ? player.primaryIndex : undefined;
            if (traps.info.health <= 75*3.3 && player.secondaryReload == 0) console.log("Checking options...")
            if (bestOption == undefined) console.log("bestOption is undefined");
            if (instaC.isTrue) console.log("instaC.isTrue is " + (instaC.isTrue ? "true" : "false"));
            if (near.dist2 > 200) console.log("near.dist2 " + (near.dist2 > 200 ? ">" : "<=") + " 200");
            if (bestOption != undefined && traps.info.health > (bestOption == 10 ? (75 * sortWeaponVariant(player.secondaryVariant)) : (items.weapons[bestOption].dmg * sortWeaponVariant(player.primaryVariant)))) console.log("Trap has too much health", traps.info.health <= (bestOption == 10 ? (75 * sortWeaponVariant(player.secondaryVariant)) : (items.weapons[bestOption].dmg * sortWeaponVariant(player.primaryVariant))), traps.info.health, bestOption, (bestOption == 10 ? (75 * sortWeaponVariant(player.secondaryVariant)) : (items.weapons[bestOption].dmg * sortWeaponVariant(player.primaryVariant))));
            if (bestOption != undefined && ((!instaC.isTrue || near.dist2 <= 200) && traps.info.health <= (bestOption == 10 ? (75 * sortWeaponVariant(player.secondaryVariant)) : (items.weapons[bestOption].dmg * sortWeaponVariant(player.primaryVariant))))) {
                console.log("Fast break on " + items.weapons[bestOption].name)
                instaC.isTrue = true;
                buyEquip(6, 0)
                selectWeapon(bestOption, 0, 1);
                soldierBreaking = true;
                noHat = true;
                sendAutoGather(1);
                primary = false;
                game.tickBase(() => {
                    instaC.isTrue = false;
                    noHat = false;
                    soldierBreaking = false;
                }, 1)
            }
        } else {
            if (primary) {
                soldierBreaking = false;
                primary = false;
            }
            if (traps.in) console.log(!soldierBreaking, primary, !antiZpyklerTicked, nearHacker.dist3 <= 170)
        }
    let prehitted = false;
    if (nearHacker.sid && !traps.in && nearHacker.dist2 <= nearHacker.primary.range + 80) {
        const distanceNumber0 = 0.3 * game.tickRate;
        const kbHit = {
            x: player.x3 + distanceNumber0 * Math.cos(nearHacker.aim2 + Math.PI),
            y: player.y3 + distanceNumber0 * Math.sin(nearHacker.aim2 + Math.PI),
        }
        const distanceNumber1 = (0.425 + ((0.3 + nearHacker.primary.knock) || 0) * 0.085) * game.tickRate;
        const nearKbInsta = {
            x: player.x3 + distanceNumber1 * Math.cos(nearHacker.aim2 + Math.PI),
            y: player.y3 + distanceNumber1 * Math.sin(nearHacker.aim2 + Math.PI),
        }
        player.kbHit= checkKB(player,nearHacker.aim2 + PI,distanceNumber0,true,1)?.obj;
        player.kbInsta = (checkKB(player,nearHacker.aim2 + PI,distanceNumber0,true)?.obj ?? checkKB(player,nearHacker.aim2 + PI,distanceNumber1,true,1)?.obj) ?? null;
        if (player.kbHit && !traps.in) {
            player.chat.message = "Anti KB Insta";
            player.chat.count = 1000;
            my.anti0tick = 1;
        }
    } else {
        player.kbHit = null;
        player.kbInsta = null;
    }
    for (let i = 0; i < enemyHackers.length; i++) {
        const tmp = enemyHackers[i];
        let foundPlayer = false;
        if (!oneticked && !autosynced && !soldierBreaking && !instaC.isTrue && my.anti0tick == 0) {
            if (tmp.dist2 && (tmp.alive || tmp.health > 0) && !tmp.trapped) {
                if (
                    tmp.dist2 <= player.primary.range + 63
                ) {
                    const distanceNumber2 = 0.28 * game.tickRate;
                    const kbHit = {
                        x: tmp.x3 + distanceNumber2 * Math.cos(tmp.aim2),
                        y: tmp.y3 + distanceNumber2 * Math.sin(tmp.aim2),
                    }
                    const distanceNumber3 = (0.125 + ((0.3 + player.primary.knock) || 0) * 0.085) * game.tickRate;
                    const revHit = {
                        x: tmp.x3 + distanceNumber3 * Math.cos(tmp.aim2),
                        y: tmp.y3 + distanceNumber3 * Math.sin(tmp.aim2),
                    }
                    const distanceNumber4 = (0.425 + ((0.3 + player.primary.knock) || 0) * 0.085) * game.tickRate;
                    const kbInsta = {
                        x: tmp.x3 + distanceNumber4 * Math.cos(tmp.aim2),
                        y: tmp.y3 + distanceNumber4 * Math.sin(tmp.aim2),
                    }
                    const can = [checkKB(nearHacker,UWUTILS.getDirect(nearHacker, player, 3, 3),cdf(nearHacker,kbHit),true,1),checkKB(nearHacker,UWUTILS.getDirect(nearHacker, player, 3, 3),cdf(nearHacker,revHit),true,1),checkKB(nearHacker,UWUTILS.getDirect(nearHacker, player, 3, 3),cdf(nearHacker,kbInsta),true,1)]
                    if (tmp.sid == nearHacker.sid) {
                        if ((can[2] || can[1] || can[0]) && (player.primaryReload == 0 && (player.secondaryIndex != 10 && player.turretReload <= 111 || player.turretReload == 0))) {
                            foundPlayer = true;
                            prehitted = true;
                            player.chat.message = `Knockback Insta On ${tmp.name}`;
                            player.chat.count = 2000;
                            if (can[0] && nearHacker.skinIndex != 6) {
                                hitBull(nearHacker.aim2)
                            } else if (!can[0]) {
                                can[1] ? revHit(nearHacker.aim3) : instaC.changeType(configs.rev || player.secondaryIndex == 10 ? "rev" : "normal");
                            }
                        }
                        if (!foundPlayer) {
                            let traps = nearObjects.filter2((obj) => obj.trap && !obj.isTeamObject(tmp) && obj.active);
                            if (traps.find2((e) => fgdo(e, kbHit) <= 45)) {
                                foundPlayer = true;
                                console.log("hitbull");
                                console.log(
                                    tmp.health,
                                    player.primary.range,
                                    35,
                                    tmp.dist2
                                );
                                prehitted = true;
                                player.chat.message = "Trap Knockback Hit";
                                player.chat.count = 1000;
                                const wantedWeapon = player.hammerIndex;
                                if (player.weaponCode != wantedWeapon) selectWeapon(wantedWeapon);
                                my.autoAim = 2;
                                sendAutoGather(1);
                                break;
                            }
                        }
                    }
                }
            }
        }
        /*
        if (
            (nearHacker.trapped || macro.v || macro.f) &&
            tmp.dist2 <= 400
        ) {
            // place(2, getAttackDir());
            /*
                const index = tmp.weaponIndex;
                for (let FANEYSTOPVAPING = 0; FANEYSTOPVAPING < nearObjects.length; FANEYSTOPVAPING++) {
                    let FANEYEATASALAD = nearObjects[FANEYSTOPVAPING];
                    if (
                        (FANEYEATASALAD.active || FANEYEATASALAD.alive) &&
                        FANEYEATASALAD.group !== undefined &&
                        UWUTILS.getDist(FANEYEATASALAD, tmp, 0, 2) <=
                        tmp.weapon.range + FANEYEATASALAD.scale
                    ) {
                        let val =
                            items.weapons[index].dmg *
                            sortWeaponVariant(
                                index < 9 ? tmp.primaryVariant : tmp.secondaryVariant
                            ) *
                            (items.weapons[index].sDmg || 1) *
                            (tmp.sid == player.sid
                            ? player.skins[40]
                            ? 3.3
                            : 1
                            : tmp.ownedSkins[40]
                            ? 3.3
                            : 1);
                        if (FANEYEATASALAD.health - val <= 0) {
                            if (nearHacker.dist2 <= 300 && UWUTILS.getDist(FANEYEATASALAD, player, 0, 2) <= 200) {
                                preplaceTime = performance.now();
                                FANEYEATASALAD.aboutToBreak = true;
                                FANEYEATASALAD.preplaceTimeout = performance.now() + (customDelay - window.pingTime);
                                console.log("PING: " + tmp.pinge + ", IS PLAYER: " + (tmp.sid == player.sid));
                                traps.preplacer(FANEYEATASALAD);
                                /*
                                FANEYEATASALAD.preplaceTimeout = performance.now() + (customDelay - window.pingTime);
                                //traps.preplacer(FANEYEATASALAD) rip old preplacer
                                let memwoemwoemwoemw = UWUTILS.getDirect(nearHacker.trapInfo2, player, 0, 2);
                                let item = items.list[player.items[2]];
                                let trap = items.list[15];
                                let tmpS = 35 + item.scale + (item.placeOffset || 0);
                                let trapS = 35 + trap.scale + (trap.placeOffset || 0);
                                let uwuwu = setInterval(() => {
                                    let placed = false;
                                    let nearSpikes = nearObjects.filter2((e) => e.dmg && !e.isTeamObject(nearHacker) && e.active && UWUTILS.getDist(e, nearHacker, 0, 2) <= 130);
                                    let retrap = true;
                                    if (nearSpikes.length >= 2) {
                                        retrap = nearSpikes.map((e) => UWUTILS.getDirect(e, nearHacker, 0, 2)).sort((a, b) => a - b).find2((e, indx, arr) => UWUTILS.getAngleDist(e, (arr[(indx + 1) % arr.length])) <= Math.PI / 3);
                                    }
                                    if (macro.f || (!macro.v && retrap && player.items[4] == 15 && nearHacker.dist2 <= 110)) {
                                        for (
                                            let ayochilltfoutyo = -35;
                                            ayochilltfoutyo < 35;
                                            ayochilltfoutyo += Math.abs(ayochilltfoutyo) >= 25 ? 1 : 0.5
                                        ) {
                                            let randomAngle = memwoemwoemwoemw + UWUTILS.toRad(ayochilltfoutyo);
                                            let placePos = {x: player.x2 + trapS * Math.cos(randomAngle), y: player.y2 + trapS * Math.sin(randomAngle)}
                                            if (
                                                UWUTILS.getDist(
                                                    placePos,
                                                    nearHacker,
                                                    0,
                                                    2
                                                ) <= 45) {
                                                if (checkCanPrePlace(4, randomAngle, nearHacker.trapInfo2)) {
                                                    placed = true;
                                                    place(4, randomAngle);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    if (!placed) {
                                        for (
                                            let ayochilltfoutyo = -35;
                                            ayochilltfoutyo < 35;
                                            ayochilltfoutyo += Math.abs(ayochilltfoutyo) >= 25 ? 1 : 0.5
                                        ) {
                                            let randomAngle = memwoemwoemwoemw + UWUTILS.toRad(ayochilltfoutyo);
                                            let placePos = {x: player.x2 + tmpS * Math.cos(randomAngle), y: player.y2 + tmpS * Math.sin(randomAngle)}
                                            let bounceDirection = UWUTILS.getDirect(nearHacker, placePos, 2, 0);
                                            let hitSpike = nearSpikes.find2((e) => UWUTILS.getAngleDist(bounceDirection, UWUTILS.getDirect(e, nearHacker, 0, 2)) <= 1)
                                            if (
                                                hitSpike &&
                                                UWUTILS.getDist(
                                                    placePos,
                                                    nearHacker,
                                                    0,
                                                    2
                                                ) <=
                                                item.scale + nearHacker.scale) {
                                                checkPlace(2, randomAngle);
                                                instaC.wantZpyklerTick = true;
                                            }
                                        }
                                    }
                                }, (111 / 8));
                                setTimeout(() => {
                                    clearInterval(uwuwu);
                                    selectWeapon(player.weaponCode);
                                }, Math.max(20, window.pingTime) + 10);
                                break;
                            }
                        } else FANEYEATASALAD.aboutToBreak = false;
                    }
                }
        }*/
    }
    if (!instaC.isTrue && configs.autoBreaker) {
        const breaker2 = player.hammerIndex;
        if (player.hammerReload == 0) {
            autoBreaker.active = false;
            autoBreaker.aim = undefined;
            let autoBreakAim = [];
            let buildings = nearObjects.filter2(
                (e) =>
                UWUTILS.getDist(e, player, 0, 2) <=
                items.weapons[breaker2].range + e.scale &&
                e.active &&
                e.isItem
            );
            for (let i = 0; i < buildings.length; i++) {
                let building = buildings[i];
                autoBreaker.active = true;
                autoBreakAim.push(UWUTILS.getDirect(building, player, 0, 2));
            }
            for (let i = 0; i < autoBreakAim.length - 1; i++) {
                let order = autoBreakAim.sort((a, b) => a - b);
                if (UWUTILS.getAngleDist(order[i], order[i + 1]) <= (config.gatherAngle * 2)) {
                    autoBreaker.aim = UWUTILS.getMidAngle(order[i], order[i + 1]);
                    break;
                }
            }
            console.log(autoBreakAim);
            if (autoBreaker.aim == undefined && buildings.length) {
                autoBreaker.aim = UWUTILS.getDirect(buildings[0], player, 0, 2);
            }
        } else {
            autoBreaker.active = false;
            autoBreaker.aim = undefined;
        }
    } else {
        autoBreaker.active = false;
        autoBreaker.aim = undefined;
    }
    if (bullticking && !bulltickSync) {
        my.reSync = true;
        player.chat.message = "Reset Bull"
        player.chat.count = 1000;
    }
    for (let i = 0;i < projectiles.length;i++) {
        projectiles.forEach((proj) => {
            tmpObj = proj;
            if (tmpObj.active) {
                tmpObj.tickUpdate(game.tickSpeed);
            }
        });
    }
    if (player && player.alive) {
        // Spin for international.terrorist
        /*if (
                getEl("spin").checked &&
                !(clicks.middle || clicks.left || clicks.right || breakSpike || autoBreaker.active) &&
                !traps.in
            ) {
                spinner = true;
            } else {
                spinner = false;
            }*/
        if (inGame) {
            macro.f && placerCheck(4, getSafeDir());
            macro.v && placerCheck(2, getSafeDir());
            macro["4"] && wallPlacer(getSafeDir());
            macro.h && placerCheck(player.getItemType(22), getSafeDir());
            macro.n && placerCheck(3, getSafeDir());
            if (firstPlace && !macro["4"]) firstPlace = false;
            if (enemy.length) {
                // Anti Sync:
                if (player.zyncDmg >= 100) {
                    if (saySettings) packet("6", "sync detect test", "zync detect")
                    if (player.secondaryIndex == 11) {
                        menuLog("blocking");
                        selectWeapon(11);
                        noWep = true;
                        packet("D", near.aim2, 1, "shield");
                        my.noAim = true;
                        game.tickBase(() => {
                            selectWeapon(player.primaryIndex);
                        }, 3);
                        game.tickBase(() => {
                            noWep = false;
                            my.noAim = false;
                        }, 3);
                    } else {
                        qHold = true;
                        game.tickBase(() => {
                            qHold = false;
                        }, 3);
                    }
                }
                let foundKBSpike = false;
                if (nearHacker.dist2 && !instaC.isTrue) {
                    if (nearHacker.trapped && player.secondaryIndex == 10 && player.secondaryReload === 0 && player.primaryReload === 0 && nearHacker.trapInfo2 && nearHacker.trapInfo2.health < (player.skins[40] ? 1 : 3.3)*75*sortWeaponVariant(player.secondaryVariant)) {
                        const spike = nearObjects.filter2((e) => (e.type === 1 && e.y >= 12000 || e.dmg && (player.isTeam(e?.owner?.sid) || !nearHacker.team && e?.owner?.sid != nearHacker.sid)) && fastHypot(e.x - nearHacker.x2, e.y - nearHacker.y2) <= (e.type === 1 ? e.scale * 0.6 : e.scale) + 100);
                        const firstSpikeDir = caf(spike[0], nearHacker);
                        const dir = caf(player, calcPoint(nearHacker.x2, nearHacker.y2, firstSpikeDir, 50))
                        for (let i = -PI/3; i < PI/3; i += PI/20) {
                            const randomAngle = dir + i;
                            const tmpX = player.x2 + 82 * Math.cos(randomAngle);
                            const tmpY = player.y2 + 82 * Math.sin(randomAngle);
                            if (checkCanPrePlace(2, randomAngle, nearHacker.trapInfo2) && hypot(nearHacker.x3 - tmpX, nearHacker.y3 - tmpY) <= 87) {
                                for (let i = 0;i < spike.length;i++) {
                                    const particularSpike = spike[i];
                                    if (fastHypot(particularSpike, calcPoint(nearHacker.x3, nearHacker.y3, caf({x2: tmpX, y2: tmpY}, nearHacker), 80)) <= 35 + (particularSpike.type === 1 ? particularSpike.scale * 0.6 : particularSpike.scale)) {
                                        foundKBSpike = true;
                                        break;
                                    }
                                }
                                if (foundKBSpike) {
                                    if (nearHacker.trapInfo2.health <= 75 * sortWeaponVariant(player.secondaryVariant)) {
                                        instaC.isTrue = true;
                                        buyEquip(6, 0);
                                        my.autoAim = 1;
                                        selectWeapon(10);
                                        sendAutoGather(3);
                                        setTimeout(() => {
                                            selectToBuild(player.items[2]);
                                            packet("F", 1, randomAngle + Math.random() * 0.2 - 0.1, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.2 - 0.1, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.3 - 0.15, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.4 - 0.2, 1, "spikebounce");
                                            selectWeapon(player.primaryIndex);
                                        }, 111 - window.pingTime);
                                        game.tickBase(() => {
                                            player.chat.message = "Spike bounce";
                                            player.chat.count = 1500;
                                            buyEquip(7, 0);
                                            selectWeapon(player.primaryIndex);
                                            game.tickBase(() => {
                                                instaC.isTrue = false;
                                            }, 1);
                                        }, 1);
                                    } else {
                                        instaC.isTrue = true;
                                        buyEquip(40, 0);
                                        my.autoAim = 1;
                                        selectWeapon(10);
                                        sendAutoGather(3);
                                        setTimeout(() => {
                                            selectToBuild(player.items[2]);
                                            packet("F", 1, randomAngle + Math.random() * 0.2 - 0.1, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.2 - 0.1, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.2 - 0.1, 1, "spikebounce");
                                            packet("F", 1, randomAngle + Math.random() * 0.4 - 0.2, 1, "spikebounce");
                                            selectWeapon(player.primaryIndex);
                                        }, 100 - window.pingTime);
                                        game.tickBase(() => {
                                            player.chat.message = "Spike bounce";
                                            player.chat.count = 1000;
                                            buyEquip(7, 0);
                                            selectWeapon(player.primaryIndex);
                                            game.tickBase(() => {
                                                instaC.isTrue = false;
                                            }, 1)
                                        }, 1)
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    if (!foundKBSpike && (configs.soldierSpiketick || nearHacker.shameCount >= 6) && nearHacker.trapped &&
                    (player.primaryIndex == 4 && player.primaryVariant > 0 && player.skins[53] || player.primaryIndex == 5 && (player.skins[53] || player.primaryVariant >= 2)) &&
                    player.secondaryIndex == 10 &&
                    (nearHacker.dist2 <= 90 || (nearHacker.dist2 <= 125 && nearHacker.weaponReload > game.tickRate)) && player.secondaryReload == 0 && player.primaryReload == 0 &&
                        nearHacker.trapInfo2 &&
                        nearHacker.trapInfo2.health <= 75 * ((player.skins[40] && player.primaryIndex == 5 && player.primaryVariant >= 2) ? 3.3 : 1) *
                        sortWeaponVariant(player.secondaryVariant)) {
                        const kbPos = {
                            x: nearHacker.x3 + 0.4 * game.tickRate * Math.cos(nearHacker.aim2),
                            y: nearHacker.y3 + 0.4 * game.tickRate * Math.sin(nearHacker.aim2),
                        }
                        const spike = nearObjects.filter2((e) => !e.isTeamObject(nearHacker) && (e.dmg || e.type == 1 && e.y >= 12000) && fastHypot(e.x - nearHacker.x2, e.y - nearHacker.y2) <= e.realScale + 60)
                        const hitSpikes = nearObjects.find2((e) => !e.isTeamObject(nearHacker) && e.dmg == 45 && UWUTILS.getDist(e, kbPos, 0, 0) <= e.realScale + 35);
                        if (!spike && !trapped && checkCanPrePlace(2, UWUTILS.getDirect(nearHacker.trapInfo2, player, 0, 3), nearHacker.trapInfo2, true, 1) || spike) {
                            if (nearHacker.trapInfo2.health <= 75 * sortWeaponVariant(player.secondaryVariant)) {
                                instaC.isTrue = true;
                                buyEquip((player.primaryIndex == 5 && player.primaryVariant >= 2) ? 6 : 53, 0);
                                my.autoAim = 2;
                                selectWeapon(10);
                                sendAutoGather(3);
                                if (!hitSpikes) {
                                    placeSpike = true;
                                    game.tickBase(() => {
                                        placeSpike = false;;
                                    }, 2)
                                }
                                game.tickBase(() => {
                                    player.chat.message = hitSpikes ? "Trapspike KB Hit" : (player.primaryIndex == 5 ? "Pole" : "Katana") + " Aids";
                                    player.chat.count = 1000;
                                    buyEquip(7, 0);
                                    selectWeapon(player.primaryIndex);
                                    game.tickBase(() => {
                                        instaC.isTrue = false;
                                    }, 1)
                                }, 1)
                            } else if (player.primaryIndex == 5 && player.primaryVariant >= 2 && player.skins[40]) {
                                instaC.isTrue = true;
                                buyEquip(40, 0);
                                my.autoAim = 2;
                                selectWeapon(10);
                                sendAutoGather(3);
                                if (!hitSpikes) {
                                    placeSpike = true;
                                    game.tickBase(() => {
                                        placeSpike = false;;
                                    }, 2)
                                }
                                game.tickBase(() => {
                                    player.chat.message = hitSpikes ? "Trapspike KB Hit" : (player.primaryIndex == 5 ? "Pole" : "Katana") + " Aids";
                                    player.chat.count = 1000;
                                    buyEquip(7, 0);
                                    selectWeapon(player.primaryIndex);
                                    game.tickBase(() => {
                                        instaC.isTrue = false;
                                    }, 1)
                                }, 1)
                            }
                        }
                    } else if (!foundKBSpike) {
                        if (!nearHacker.trapped) {
                            const prehit = nearObjects.find2(tmp => tmp.dmg && tmp.active && tmp?.owner?.sid == player.sid && UWUTILS.getDist(tmp, nearHacker, 0, 3) <= (tmp.scale + 35))
                            if (prehit) {
                                if (nearHacker.dist3 <= player.primary.range + 63 && player.primaryReload == 0) {
                                    instaC.canZpykeTick = true;
                                    player.chat.message = "Aids Spike Sync";
                                    player.chat.count = 1500;
                                }
                            }
                        } else if (nearHacker.skinIndex != 6 && (nearHacker.hitSpike || liztobj.find2((e) => e.dmg && e?.owner?.sid == player.sid && UWUTILS.getDist(e, nearHacker, 0, 3) <= 35 + e.scale)) && player.primaryReload === 0 && nearHacker.dist2 <= player.primary.range + 63) {
                            hitBull(nearHacker.aim2);
                            player.chat.message = "Trapspike Sync";
                            player.chat.count = 1500;
                        }
                    }
                }
            }
            if (macro.q) {
                if (!qHold) {
                    qHold = true;
                    if (player.health < 100) healer(1);
                }
            } else {
                qHold = false;
            }
            if (mills.place) {
                let plcAng = 7.7;
                for (let i = -plcAng; i <= plcAng; i += plcAng) {
                    let block = checkBlockingItem(
                        3,
                        UWUTILS.getDirect(player.oldPos, player, 2, 2) + i
                    );
                    if (
                        block != undefined &&
                        block.owner &&
                        block.owner.sid == player.sid &&
                        block.pps
                    )
                        break;
                    if (i == 7.7) {
                        checkPlace(3, UWUTILS.getDirect(player.oldPos, player, 2, 2) - i);
                        checkPlace(3, UWUTILS.getDirect(player.oldPos, player, 2, 2));
                        checkPlace(3, UWUTILS.getDirect(player.oldPos, player, 2, 2) + i);
                    }
                }
            } else {
                if (mills.placeSpawnPads) {
                    for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                        checkPlace(
                            player.getItemType(20),
                            UWUTILS.getDirect(player.oldPos, player, 2, 2) + i
                        );
                    }
                }
            }
            if (!instaC.isTrue && instaC.canCounter && player.skinIndex == 11) {
                instaC.canCounter = false;
                if (
                    configs.antiBullInsta &&
                    (game.tick % 9 == 1 || player.primaryIndex != 3) &&
                    player.checkCanInsta(false) >= 100 &&
                    nearHacker.dist2 <= items.weapons[wpn].range + 63 &&
                    !instaC.isTrue &&
                    player.primaryReload <= game.tickRate &&
                    player.secondaryReload == 0 &&
                    player.turretReload <= (player.secondaryIndex == 10 ? 0 : game.tickRate)
                ) {
                    instaC.changeType("normal");
                } else if (player.primaryReload == 0 && !instaC.isTrue) {
                    instaC.counterType();
                }
            }
            if (instaC.wantZpyklerTick && evil && player.primaryIndex != 8 && player.primaryReload == 0 && !instaC.isTrue) {
                instaC.canZpykeTick = true;
            }
            instaC.wantZpyklerTick = false;
            if (instaC.canZpykeTick != false && evil) {
                console.log("zpyklertick");
                instaC.canZpykeTick = false;
                if (
                    player.primaryReload == 0 &&
                    !instaC.isTrue
                ) {
                    instaC.zpyklerTickType(instaC.canZpykeTick == "turr");
                    if (instaC.syncHit) {
                        chch(null, "[SyncHit]", "yellow");
                    }
                }
            }
            let canShameSpam = !instaC.isTrue && !clicks.right && (!traps.in || nearHacker.shameCount >= 4) && configs.rubyShame && [3, 5].includes(player.primaryIndex) && player.primaryVariant == 3 && nearHacker.dist2 <= player.primary.range + 65
            let clickWeapon = canShameSpam || primary || clicks.left ? player.primaryIndex : (breakSpike || clicks.right || autoBreaker.active) ? player.hammerIndex : player.primaryIndex;
            if (player.primary && !clicks.middle && ((canShameSpam && player.secondaryReload == 0) || clicks.left || breakSpike || clicks.right || autoBreaker.active || (((configs.bullspam && !traps.in) || configs.bullspamTrap) && nearHacker.dist2 <= player.primary.range + 75)) && !instaC.isTrue) {
                selectWeapon(clickWeapon);
            }
            /*
                if (configs.avoidSpike && !traps.in && !clicks.right && !clicks.left && !instaC.isTrue) {
                    //found = false;
                    player.update(1);
                    let oldMoveDir = lastMoveDir;
                    let currMoveDir = getMoveDir();
                    let moving = UWUTILS.getDist(player, player, 1, 2) > 10;
                    let newPos = {
                        x: (moving ? player.x3 : currMoveDir == undefined ? player.x2 : player.x3 + (Math.cos(currMoveDir) * 33)) + 38 * player.maxSpeed,
                        y: (moving ? player.y3 : currMoveDir == undefined ? player.x2 : player.y3 + (Math.sin(currMoveDir) * 33)) + 38 * player.maxSpeed,
                    };
                    let midPoint = {
                        x: (moving ? player.x3 : currMoveDir == undefined ? player.x2 : player.x3 + (Math.cos(currMoveDir) * 33)) + 10 * player.maxSpeed,
                        y: (moving ? player.y3 : currMoveDir == undefined ? player.x2 : player.y3 + (Math.sin(currMoveDir) * 33)) + 10 * player.maxSpeed,
                    };
                    let hitSpikes = liztobj.filter2((obj) => obj.dmg && UWUTILS.getDist(obj, player, 0, 2) <= ((player.secondaryIndex == 10 ? 75 : player.primary.range) + obj.scale) && !obj.isTeamObject(player) && obj.active);
                    let collidingSpikes = liztobj.filter2((obj) => obj.active && obj.dmg && (UWUTILS.getDist(newPos, obj, 0, 0) <= obj.scale + 35 || UWUTILS.getDist(midPoint, obj, 0, 0) <= obj.scale + 35) && !obj.isTeamObject(player));
                    /*for (let i = 0; i < spikes.length; i++) {
                        /***literally stops you from moving in any direction towards it lmao**
                        found = true;
                        tracker.draw3.active = true;
                        tracker.draw3.x = spikes[i].x;
                        tracker.draw3.y = spikes[i].y;
                        tracker.draw3.scale = spikes[i].scale;
                        // Prevent movement towards the spike
                        /***make player go around the spike***/
            //variables to make code run faster, prevents reaching into a bunch of objects
            /*
                        if (moveDirection[0] == 0 || moveDirection[1] == 0) {
                            if (moveDirection[1] == 0) {
                                newMovDir = {x: spikeX, y: (spikeY + (spikes[i].scale + 35 + 50)) * ((spikeY - player.y2) < 0 ? 1 : -1)};
                                console.log(spikeY + newMovDir.y, UWUTILS.getDirection(0, spikeY, 0, newMovDir.y), [spikeX, spikeY], newMovDir)
                                packet("9", UWUTILS.getDirect(newMovDir, player, 0, 2))
                            } else if (moveDirection[0] == 0) {
                                newMovDir = {x: (spikeX + (spikes[i].scale + 35 + 50)) * ((spikeX - player.x2) < 0 ? 1 : -1), y: spikeY};
                                console.log(spikeX + newMovDir.x, UWUTILS.getDirection(0, spikeX, 0, newMovDir.x))
                                packet("9", UWUTILS.getDirect(newMovDir, player, 0, 2));
                            }
                        }
                    }
                    //tracker.draw3.active = false;
                    if ((hitSpikes.length || collidingSpikes.length) && !traps.in && !boostSpike) {
                        if (collidingSpikes.length && !stopMoving) {
                            console.log(currMoveDir)
                            let closeSpike = collidingSpikes.find2((e) => UWUTILS.getDist(e, player, 0, 2) <= e.scale + 65);
                            packet("9", (closeSpike ? UWUTILS.getDirect(player, closeSpike, 2, 0) : undefined), 1, 1, "avoidspike");
                            game.tickBase(() => {
                                packet("9", undefined, 1, 1, "avoidspike");
                            }, 1);
                            stopMoving = true;
                        }
                        if (hitSpikes.length) {
                            if (!breakingSpike) {
                                breakingSpike = true;
                                let spikeAngle = UWUTILS.averageAngle(hitSpikes.map((e) => UWUTILS.getDirect(e, player, 0, 2)));
                                breakSpike = spikeAngle || 0.0001;
                            } else {
                                breakSpike = UWUTILS.averageAngle(hitSpikes.map((e) => UWUTILS.getDirect(e, player, 0, 2))) || 0.001;
                                if (collidingSpikes.length < 1) stopMoving = false;
                            }
                        }
                    } else {
                        breakingSpike = false;
                        breakSpike = undefined;
                        stopMoving = false;
                    }
                } else {
                    breakingSpike = false;
                    breakSpike = undefined;
                    stopMoving = false;
                }*/
            tracker.lastPos.x = player.x2;
            tracker.lastPos.y = player.y2;
            if (traps.in && nearHacker.secondaryIndex == 10 && traps.info.health <= 75 * sortWeaponVariant(nearHacker.secondaryVariant) * 3.3 && nearHacker.primaryIndex == 5) {
                antiPoleAids = true;
            } else {
                antiPoleAids = false;
            }
            //if (nearHacker.trapped && Math.abs(nearHacker.dist3 - 685) <= 2) this.rangeType("ageInsta");
            if (clicks.middle && !traps.in) {
                if (!instaC.isTrue && player.secondaryReload == 0) {
                    if (
                        player.primaryIndex != 4 &&
                        player.secondaryIndex == 9 &&
                        player.age >= 9 &&
                        enemy.length
                    ) {
                        instaC.bowMovement();
                    }
                }
            }
            if (!manualAutoGather &&
                player.secondaryIndex &&
                (!configs.bullspam ||
                 nearHacker.dist2 <= player.primary.range + 75) &&
                !clicks.left &&
                !clicks.right &&
                !breakSpike &&
                !autoBreaker.active &&
                !traps.in &&
                !instaC.isTrue &&
                !(useWasd && near.dist2 <= player.primary.range + 63)
               ) {
                if (player.primaryReload == 0 && player.secondaryReload == 0) {
                    if (!my.reloaded || player.buildIndex >= 0) {
                        my.reloaded = true;
                        const fastSpeed = player.primary.spdMult <= player.secondary.spdMult ? player.secondaryIndex : player.primaryIndex;
                        if (player.weaponReload == 0 && (player.weaponIndex != fastSpeed || player.buildIndex > -1)) {
                            if (!macro.b) selectWeapon(fastSpeed);
                        }
                    }
                    // if(useWasd) {
                    //     if (!autos.stopspin) {
                    //         setTimeout(()=>{
                    //             autos.stopspin = true;
                    //         }, 375);
                    //     }
                    // }
                } else {
                    my.reloaded = false;
                    if (player.primaryReload > 0) {
                        if (
                            player.weaponIndex != player.primaryIndex ||
                            player.buildIndex > -1
                        ) {
                            selectWeapon(player.primaryIndex);
                        }
                    } else if (
                        player.primaryReload == 0 &&
                        player.secondaryReload > 0
                    ) {
                        if (
                            player.weaponIndex != player.secondaryIndex ||
                            player.buildIndex > -1
                        ) {
                            selectWeapon(player.secondaryIndex);
                        }
                        if (useWasd) {
                            if (!autos.stopspin) {
                                setTimeout(() => {
                                    autos.stopspin = true;
                                }, 750);
                            }
                        }
                    }
                }
            }

            if (!traps.in) {
                if (configs.autoBreakSpike) {
                    const breakIndex = player.hammerIndex;
                    const nearObj = nearObjects.filter2((e) => (e.trap || e.dmg) && UWUTILS.getDist(e, player, 0, 2) <= items.weapons[breakIndex].range + e.scale && e.active && e?.owner?.sid && e.owner.sid != player.sid && !player.isTeam(e.owner.sid))
                    .map((e) => UWUTILS.getDirect(e, player, 0, 2))
                    .sort((a, b) => a - b);
                    if (nearObj.length && (breakIndex == 10 ? player.secondaryReload : player.primaryReload) == 0) {
                        let hitTwoObj = nearObj.findIndex((e, indx, arr) => UWUTILS.getAngleDist(e, arr[indx + 1]) <= config.gatherAngle * 2)
                        if (hitTwoObj >= 0) {
                            hitTank(UWUTILS.getMidAngle(nearObj[hitTwoObj], nearObj[hitTwoObj + 1]), breakIndex);
                        } else {
                            hitTank(nearObj[0], breakIndex);
                        }
                    }
                }
            }
            /*console.log(!my.noAim &&
                    (my.autoAim || (player.weaponReload == 0 && (clicks.right || clicks.left || traps.in))) &&
                    (!configs.packetReducer || (game.tick - lastDirSend) >= 2), player.weaponReload, clicks, my.autoAim, my.noAim, lastDirSend, game.tick, traps.in)*/
            if (macro.b && !boosting && player.weaponReload <= 111) {
                boosting = true;
                const Dir = UWUTILS.getDirect(player, player, 3, 2)
                selectToBuild(16);
                packet2("F", 1, Dir, 1);
                console.log("a")
                noHat = true;
                game.tickBase(() => {
                    packet2("F", 1, (Dir + Math.PI), 1);
                    my.noAim = true;
                    noHat = false;
                    buyEquip(40, 0);
                    game.tickBase(() => {
                        packet2("F", 1, (Dir + Math.PI), 1);
                        boosting = false;
                        my.noAim = false;
                        packet2("F", 0, (Dir + Math.PI), 1);
                    }, 1);
                }, 1)
            }
            if (player.weaponReload > 111) {
                boosting = false;
            }
            if (!soldierBreaking && !noHat) {
                hatSwitcher();
            } else {
                if (debugLogs) console.log("Soldier Break")
            }
            if (!instaC.ticking) {
                if (!nearHacker.hitSpike && configs.autoPush && nearHacker.dist2 <= 160 && !traps.in && !noMove && nearHacker.trapped) {
                    wyndAP();
                } else {
                    sendMoveDir()
                    my.autoPush = false;
                }
            }
            if (!traps.in && configs.autoDiddler && player.secondaryIndex == 14 && near.dist2 <= (([4, 5, 14].includes(near.weaponIndex) && near.weaponReload == 0) ? 195 : 190)) {
                if (UWUTILS.getAngleDist(player.d2, near.aim2) > config.gatherAngle) packet("D", near.aim2, 1, "autoDiddler");
                selectWeapon(14);
                sendAutoGather(1);
            } else if (
                traps.in && player.weaponReload == 0 ||
                (!my.noAim &&
                 (my.autoAim || (player.weaponReload == 0 && (player.antiBull || traps.in || instaC.isTrue || clicks.left || clicks.right || configs.rubyShame && [3, 5].includes(player.primaryIndex) && (!traps.in && nearHacker.shameCount >= 4) && player.primaryVariant == 3 && nearHacker.dist2 <= player.primary.range + 63 && player.primaryReload == 0 && (game.tick - player.bullTick) % 9 < (9 - Math.ceil(player.primary.speed / 111)) || breakSpike)))
                 || (configs.packetReducer && (game.tick - lastDirSend) >= 9 || !configs.packetReducer && (game.tick - lastDirSend) >= 2)
                )) {
                lastDirSend = game.tick;
                packet("D", getAttackDir(), 1, "look around");
            }
            if (antiOneTick > 0) {
                antiOneTick--;
            }
            if (antiReverse) {
                antiReverse = false;
            }
            if (instaC.ticking) {
                instaC.ticking = false;
            }
            if (instaC.syncHit) {
                instaC.syncHit = false;
            }
            if (player.empAnti) {
                player.empAnti = false;
            }
            if (soldierAnti) {
                soldierAnti = false;
            }
            if (my.anti0tick > 0) {
                my.anti0tick--;
            }
            if (traps.replaced) {
                traps.replaced = false;
            }
            canShameSpam = configs.rubyShame && !instaC.isTrue && !clicks.right && (!traps.in || nearHacker.shameCount >= 4) && player.primaryVariant == 3 && nearHacker.dist2 <= player.primary.range + 64;
            if (
                (!clicks.middle &&
                 traps.in ||
                 canShameSpam ||
                 clicks.left ||
                 clicks.right ||
                 autoBreaker.active ||
                 breakSpike ||
                 (((configs.bullspam && !traps.in) || configs.bullspamTrap) &&
                  (nearHacker.dist2 <= player.primary.range + 65 || nearHacker.dist3 <= player.primary.range + 65))) &&
                !instaC.isTrue
            ) {
                console.log("a")
                const wep = (canShameSpam && player.secondaryReload == 0) || clicks.left || primary ? player.primaryIndex : (traps.in || breakSpike || clicks.right || autoBreaker.active) ? player.hammerIndex : player.primaryIndex;
                selectWeapon(wep);
                if ((traps.in && autoBreak ||
                     clicks.left ||
                     clicks.right ||
                     autoBreaker.active ||
                     breakSpike ||
                     ((configs.bullspam && !traps.in || configs.bullspamTrap) &&
                      (nearHacker.dist2 <= player.primary.range + 63 || nearHacker.dist3 <= player.primary.range + 63)) ||
                     (canShameSpam && (game.tick - player.bullTick) % 9 < (9 - Math.ceil(player.primary.speed / 111)))) && (wep < 9 ? player.primaryReload : player.secondaryReload) == 0) {
                    if (!autoGathering) {
                        console.log("autogather")
                        sendAutoGather(1)
                    }
                    breakShit(bestAim(getSafeDir(), (wep < 9) ? player.primary.range : player.secondary.range), wep, (wep < 9) ? player.primaryVariant : player.secondaryVariant, (!player.skins[40] || !clicks.right && !traps.in && !autoBreaker.active && !breakSpike) ? 0 : 40)
                }
            }
            if (autoQuadSpike) {
                betraying = false;
                const possiblePlayers = nearPlayers.filter2((e) => e.hacking || e.macroing).map((e) => e.sid);
                for (let i = 0; i < possiblePlayers.length; i++) {
                    if (typeof possiblePlayers[i] == "number") {
                        let tmp = findPlayerBySID(possiblePlayers[i]);
                        if (
                            tmp &&
                            possiblePlayers[i] != player.sid &&
                            !friendList.includes(possiblePlayers[i])
                        ) {
                            let aim = tmp.aim2;
                            let dist = UWUTILS.getDist(tmp, player, 3, 2);
                            if (false && player.tailIndex == 11 && dist <= 120 && player.primaryIndex <= 5 && player.primaryIndex >= 3) {
                                buyEquip(19, 1);
                                betraying = true;
                            } else if (false &&
                                       dist <= 85 &&
                                       player.primaryIndex <= 5 &&
                                       player.primaryIndex >= 3
                                      ) {
                                if (
                                    checkCanPlace(2, aim + Math.PI / 4) &&
                                    checkCanPlace(2, aim - Math.PI / 4) &&
                                    player.tailIndex != 11
                                ) {
                                    if (player.isOwner) {
                                        packet("Q", tmp.sid, "betrayal");
                                    } else packet("N", "betrayal");
                                    player.chat.message = "Betrayal Spiketick";
                                    player.chat.count = 2000;
                                    place(2, aim + Math.PI / 4);
                                    place(2, aim - Math.PI / 4);
                                    hitBull(aim, 0);
                                    autoQuadSpike = false;
                                }
                            } else if (
                                dist <= 78.67 &&
                                checkCanPlace(2, aim) &&
                                checkCanPlace(2, aim + Math.PI) &&
                                checkCanPlace(2, aim + Math.PI / 2) &&
                                checkCanPlace(2, aim - Math.PI / 2)
                            ) {
                                place(2, aim + Math.PI / 2);
                                place(2, aim - Math.PI / 2);
                                place(2, aim + Math.PI);
                                place(2, aim);
                                if (tmp.movDir === null || tmp.movDir === undefined) {
                                    game.tickBase(() => {
                                        if (player.isOwner) {
                                            packet("Q", tmp.sid);
                                            hitBull(tmp.aim2);
                                        } else packet("N");
                                    }, 9);
                                } else {
                                    if (player.isOwner) {
                                        packet("Q", tmp.sid);
                                        hitBull(tmp.aim2);
                                    } else packet("N");
                                }
                                autoQuadSpike = false;
                            }
                        }
                    }
                }
            }
            if (my.waitHit == 0 && autoGathering && !manualAutoGather && !clicks.left && !clicks.right && !traps.in && (!canShameSpam || (game.tick - player.bullTick) % 9 >= (9 - Math.ceil(player.primary.speed / 111)))) {
                autoGathering = false;
                packet("K", 1, 1, "sendAutoGather");
            }
        }
    }
    for (let i = 0;i < nearPlayers.length;i++) {
        const tmp = nearPlayers[i];
        if (tmp.dot > 0 && (game.tick - player.bullTick) % 9 === 0) {
            tmp.dot--;
        }
    }
    if (onetick123modprov3asd) {
        selectWeapon(5);
    }
}
// UPDATE LEADERBOARD:
/* function updateLeaderboard(data) {
                    UWUTILS.removeAllChildren(leaderboardData);
                    var tmpC = 1;
                    for (var i = 0; i < data.length; i += 3) {
                        // console.log(data);
                        (function(i) {
                            UWUTILS.generateElement({
                                class: "leaderHolder",
                                parent: leaderboardData,
                                children: [
                                    UWUTILS.generateElement({
                                        class: "leaderboardItem",
                                        style: data[i] == player.sid ? "color: rgba(); font-size: 18px;" : "color: rgba(); font-size: 18px; padding: 1px;", //"font-size: 18px;",
                                        text: (data[i + 1] != "" ? data[i + 1] : "unknown") + "  |"
                                    }),
                                    UWUTILS.generateElement({
                                        class: "a", //class: "leaderScore",
                                        style: data[i] == player.sid ? "color: rgba(255,255,255,1); font-size: 18px;" : "color: rgba(255,255,255,0.6); font-size: 18px; padding: 1px;",
                                        text: ("έΑΟ " + UWUTILS.kFormat(data[i + 2]) || "έΑΟ 0")
                                    })
                                ]
                            });
                        })(i);
                        tmpC++;
                    }
                }*/
// UPDATE LEADERBOARD:
function updateLeaderboard(data) {
    lastLeaderboardData = data;
    UWUTILS.removeAllChildren(leaderboardData);
    let tmpC = 1;
    for (let i = 0; i < data.length; i += 3) {
        const tmpObj = findPlayerBySID(data[i]);
        if (tmpObj && tmpObj.listElement?.textContent && Number(data[i + 2]) != tmpObj.score) {
            tmpObj.scoreChange = Number(data[i + 2]) - tmpObj.score;
            if (!tmpObj.visible) {
                if (tmpObj.scoreChange == 700) {
                    tmpObj.guessTime = game.tick;
                    tmpObj.guessLocation = "Volcano or Top left";
                } else if ([5000, 3000].includes(tmpObj.scoreChange)) {
                    tmpObj.guessTime = game.tick;
                    tmpObj.guessLocation = (tmpObj.scoreChange == 5000 ? "Volcano, Top left or Boss Arena" : "Volcano or Boss Arena");
                } else if (tmpObj.scoreChange == 8000) {
                    tmpObj.guessTime = game.tick;
                    tmpObj.guessLocation = "Boss Arena";
                }

            }
            const split = tmpObj.listElement.textContent.split(", Estimated ");
            tmpObj.listElement.textContent = `Team: ${tmpObj.team || "none"}, SID: ${tmpObj.sid}, Estimated Location: ${tmpObj.guessLocation}, Move Direction: ${tmpObj.movDir}, Last gold increase: ${tmpObj.scoreChange}, Estimated ` + split[2];
            tmpObj.logDetails = `Team: ${tmpObj.team || "none"}, SID: ${tmpObj.sid}, Estimated Location: ${tmpObj.guessLocation}, Move Direction: ${tmpObj.movDir}, Last gold increase: ${tmpObj.scoreChange}, Estimated `;
            tmpObj.score = Number(data[i + 2]);
        }
        (function (i) {
            UWUTILS.generateElement({
                class: "leaderHolder",
                parent: leaderboardData,
                children: [
                    UWUTILS.generateElement({
                        class: "leaderboardItem",
                        style:
                        "color:" +
                        (data[i] == playerSID ? "#fff" : "rgba(255,255,255,0.6)"),
                        text: "[" + data[i] + "] " + (data[i + 1] != "" ? data[i + 1] : "unknown"),
                    }),
                    UWUTILS.generateElement({
                        class: "leaderScore",
                        text: UWUTILS.sFormat(data[i + 2]) || "0",
                    }),
                ],
            });
        })(i);
        tmpC++;
    }
}

// LOAD GAME OBJECT:
function loadGameObject(data) {
    if (!player) return;
    for (let i = 0; i < data.length; ) {
        let tmpObj = findPlayerBySID(data[i + 7]);
        if (!liztobj.some((e) => e.sid == data[i]) && tmpObj) {
            /*
                if (game.tick == tmpObj.placed) {
                    tmpObj.hackerPoints.placer += 10;
                    tmpObj.macroPoints.placeMacro += 10;
                }
                if (tmpObj.buildIndex < 0) {
                    tmpObj.hackerPoints.placer += 0.5;
                    tmpObj.macroPoints.placeMacro += 0.5;
                    if (tmpObj.instaPlaced) tmpObj.macroPoints.placeMacro += 3;
                    tmpObj.instaPlaced = 3;
                } else {
                    tmpObj.macroPoints.placeMacro -= 0.04;
                    tmpObj.hackerPoints.placer--;
                }
                tmpObj.placed = game.tick;
                */
            if (tmpObj && data[i + 6] == 16) {
                tmpObj.hasBoost = true;
                if (
                    !tmpObj.isTeam(player) &&
                    Math.hypot(data[i + 1] - player.x2, data[i + 2] - player.y2) <= 500 &&
                    data[i + 7] > 0
                ) {
                    tmpObj.boosted = true;
                    game.tickBase(() => {
                        tmpObj.boosted = false;
                    }, 3)
                }
            } else if (tmpObj && data[i + 6] == 15) tmpObj.hasBoost = false;
            // sid, x, y, dir, s, type, data, setSID, owner
            /*let dist = UWUTILS.getDist({
                            x: data[i + 1],
                            y: data[i + 2]
                        }, player, 0, 2);
                        let aim = UWUTILS.getDirect({
                            x: data[i + 1],
                            y: data[i + 2]
                        }, player, 0, 2);
                        find = findObjectBySid(data[i]);
                        if (data[i + 6] == 15) {
                            if (find && !find.isTeamObject(player)) {
                                if (dist <= 100) {
                                    traps.dist = dist;
                                    traps.aim = aim;
                                    traps.protect(aim);
                                }
                            }
                        }*/
        }
        objectManager.add(
            data[i],
            data[i + 1],
            data[i + 2],
            data[i + 3],
            data[i + 4],
            data[i + 5],
            items.list[data[i + 6]],
            true,
            data[i + 7] >= 0
            ? {
                sid: data[i + 7],
            }
            : null
        );
        i += 8;
    }
}

// ADD AI:
function loadAI(data) {
    if (!player) return;
    for (let i = 0; i < ais.length; ++i) {
        ais[i].forcePos = !ais[i].visible;
        ais[i].visible = false;
    }
    dmgpotAI = 0;
    if (data) {
        let tmpTime = performance.now();
        for (let i = 0; i < data.length; ) {
            let tmpObj = findAIBySID(data[i]);
            if (tmpObj) {
                tmpObj.index = data[i + 1];
                tmpObj.t1 = tmpObj.t2 === undefined ? tmpTime : tmpObj.t2;
                tmpObj.t2 = tmpTime;
                tmpObj.x1 = tmpObj.x;
                tmpObj.y1 = tmpObj.y;
                tmpObj.x2 = data[i + 2];
                tmpObj.y2 = data[i + 3];
                tmpObj.d1 = tmpObj.d2 === undefined ? data[i + 4] : tmpObj.d2;
                tmpObj.d2 = data[i + 4];
                tmpObj.oldHealth = tmpObj.health;
                tmpObj.health = data[i + 5];
                tmpObj.dt = 0;
                tmpObj.visible = true;
            } else {
                tmpObj = aiManager.spawn(
                    data[i + 2],
                    data[i + 3],
                    data[i + 4],
                    data[i + 1]
                );
                tmpObj.x2 = tmpObj.x;
                tmpObj.y2 = tmpObj.y;
                tmpObj.d2 = tmpObj.dir;
                tmpObj.health = data[i + 5];
                if (!aiManager.aiTypes[data[i + 1]].name) {
                    tmpObj.name = config.cowNames[data[i + 6]];
                    tmpObj.displayText = tmpObj.name;
                }
                tmpObj.forcePos = true;
                tmpObj.sid = data[i];
                tmpObj.visible = true;
            }
            let tmpDist = UWUTILS.getDist(tmpObj, player, 2, 2);
            if (UWUTILS.getDist(tmpObj, player, 3, 2) <= 45 + tmpObj.scale) dmgpotAI += tmpObj.dmg;
            if (configs.autoSteal) {
                let tmpHealth = tmpObj.health;
                let tmpRange = player.primary.range + 70 + tmpObj.scale;
                if (
                    tmpObj.active &&
                    tmpObj.visible &&
                    tmpHealth <= 250 + (tmpObj.oldHealth - tmpHealth) &&
                    tmpDist <= tmpRange + 20
                ) {
                    tmpObj.lowHealth = true;
                }
                if (
                    player.primaryReload <= game.tickRate &&
                    tmpObj.active &&
                    tmpObj.visible &&
                    tmpObj.health <=
                    player.primary.dmg *
                    (player.tailIndex == 11 ? 1 : player.skins[7] ? 1.5 : 1) &&
                    tmpDist <= player.primary.range + 70 + tmpObj.scale
                ) {
                    hitBull(UWUTILS.getDirect(tmpObj, player, 2, 2), 0);
                    player.chat.message = "Autosteal";
                    player.chat.count = 1000;
                }
            }
            i += 7;
        }
    }
}

// ANIMATE AI:
function animateAI(sid) {
    let tmpObj;
    tmpObj = findAIBySID(sid);
    if (tmpObj) tmpObj.startAnim();
}

// GATHER ANIMATION:
function gatherAnimation(sid, didHit, index) {
    let tmpObj;
    if (sid == player.sid && !autoGathering && hitting && !manualAutoGather) {
        sendAtck2(0, getAttackDir());
    }
    console.log("ping: " + (performance.now() - game.lastTick));
    tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        tmpObj.attacked = true;
        tmpObj.attackingWeapon = index;
        tmpObj.startAnim(didHit, index);
        tmpObj.gatherIndex = index;
        tmpObj.gathering = 1;
        if (didHit) {
            let tmpObjects = [...objectManager.hitObj];
            objectManager.hitObj.length = 0;
            game.tickBase(() => {
                setTimeout(() => {
                    tmpObj.attackingWeapon = null;
                }, 40);
                // refind
                tmpObj = findPlayerBySID(sid);
                let skinIndex = tmpObj.skinIndex;
                if (!tmpObjects.length) {
                    if (!liztobj.filter2((e) => game.tick - e.placedTick <= 1 && e.active && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + tmpObj.weapon.range && UWUTILS.getAngleDist(tmpObj.dir, UWUTILS.getDirect(e, tmpObj, 0, 2)) <= config.gatherAngle).length) {
                        game.tickBase(() => {
                            tmpObjects = liztobj.filter2((e) => game.tick - e.placedTick <= 2 && e.active && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + tmpObj.weapon.range && UWUTILS.getAngleDist(tmpObj.d2, UWUTILS.getDirect(e, tmpObj, 0, 2)) <= config.gatherAngle);
                            let con = tmpObjects.length;
                            if (!con) return;
                            let val = index > 8 && index != 10 ? 0 :
                            items.weapons[index].dmg *
                                sortWeaponVariant(
                                    index < 9 ? tmpObj.primaryVariant : tmpObj.secondaryVariant
                                ) *
                                (items.weapons[index].sDmg || 1) *
                                (skinIndex == 40 ? 3.3 : 1);
                            for (let i = 0; i < con; i++) {
                                const healthy = tmpObjects[i];
                                healthy.health -= val;
                            }
                        }, 1)
                    } else {
                        tmpObjects = liztobj.filter2((e) => game.tick - e.placedTick <= 1 && e.active && UWUTILS.getDist(e, tmpObj, 0, 2) <= e.scale + tmpObj.weapon.range && UWUTILS.getAngleDist(tmpObj.dir, UWUTILS.getDirect(e, tmpObj, 0, 2)) <= config.gatherAngle);
                        let con = tmpObjects.length;
                        let val = index > 8 && index != 10 ? 0 :
                        items.weapons[index].dmg *
                            sortWeaponVariant(
                                index < 9 ? tmpObj.primaryVariant : tmpObj.secondaryVariant
                            ) *
                            (items.weapons[index].sDmg || 1) *
                            (skinIndex == 40 ? 3.3 : 1);
                        for (let i = 0; i < con; i++) {
                            const healthy = tmpObjects[i];
                            healthy.health -= val;
                        }
                    }
                } else {
                    console.log(tmpObjects);
                    let con = tmpObjects.length;
                    let val = index > 8 && index != 10 ? 0 :
                    items.weapons[index].dmg *
                        sortWeaponVariant(
                            index < 9 ? tmpObj.primaryVariant : tmpObj.secondaryVariant
                        ) *
                        (items.weapons[index].sDmg || 1) *
                        (tmpObj.skinIndex == 40 ? 3.3 : 1);
                    for (let i = 0; i < con; i++) {
                        const healthy = tmpObjects[i];
                        healthy.health -= val;
                    }
                }
            }, 1);
        }
    }
}
// WIGGLE GAME OBJECT:
function wiggleGameObject(dir, sid) {
    let tmpObj;
    tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
        if (tmpObj.isItem) {
            objectManager.hitObj.push(tmpObj);
        }
    }
}

// SHOOT TURRET:
function shootTurret(sid, dir) {
    let tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        if (config.anotherVisual) {
            tmpObj.lastDir = dir;
        } else {
            tmpObj.dir = dir;
        }
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
    }
}

// UPDATE PLAYER VALUE:
function updatePlayerValue(index, value, updateView) {
    if (player) {
        player[index] = value;
        if (index == "points") {
            if (configs.autoBuy) {
                autoBuy.hat();
                autoBuy.acc();
            }
        } else if (index == "kills") {
            critical = true;
        }
    }
}

function clearConsole() {
    if (configs.fpsBoost) {
        console.clear();
    }
}

// ACTION BAR:
function updateItems(data, wpn) {
    if (data) {
        if (wpn) {
            if (data[1] == 10) {
                player.hammerIndex = 10;
                player.hammerReload = (player.secondaryIndex == 10 ? player.secondaryReload : 0);
                player.hammer = items.weapons[10];
            } else {
                player.hammerIndex = data[0];
                player.hammerReload = 0;
                player.hammer = items.weapons[data[0]];
            }
            player.primaryIndex = data[0];
            player.secondaryIndex = data[1];
            if (!instaC.isTrue) {
                selectWeapon(player.primaryIndex);
            }
            player.frameDist = player.secondaryIndex == 9 ? 365 : player.secondaryIndex == 12 ? 380 : player.secondaryIndex == 13 ? 365 : 370;
        } else {
            player.items = data;
        }
    }

    for (let i = 0; i < 23; i++) {
        let tmpI = 16 + i;
        let actionBarItem = getEl("actionBarItem" + tmpI);
        actionBarItem.style.display =
            player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
        // Add shadow to the element
        // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
        if (
            document.getElementsByTagName("button") &&
            document.getElementsByTagName("button").style
        ) {
            document.getElementsByTagName("button").style.boxShadow =
                "2px 2px 5px rgba(0, 0, 0, 0.5)";
        } else if (document.getElementsByTagName("button")) {
            document.getElementsByTagName("button").style = {
                boxshadow: "2px 2px 5px rgba(0, 0, 0, 0.5)",
            };
        }
    }

    for (let i = 0; i < 16; i++) {
        let actionBarItem = getEl("actionBarItem" + i);
        actionBarItem.style.display = (player.primaryIndex == i || player.secondaryIndex == i) ? "inline-block" : "none";
        // Add shadow to the element
        // actionBarItem.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.5)";
        document.getElementsByTagName("button").style.boxShadow =
            "2px 2px 5px rgba(0, 0, 0, 0.5)";
    }

    let kms = player.primaryIndex == 3 && player.secondaryIndex == 15;
    if (kms) {
        getEl("actionBarItem3").style.display = "none";
        getEl("actionBarItem4").style.display = "inline-block";
    }
}

// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
    if (indx == 1) console.log("TURRET SPEED: ", speed)
    projectileManager.addProjectile(
        x,
        y,
        dir,
        range,
        speed,
        indx,
        null,
        null,
        layer,
        inWindow
    ).sid = sid;
    runAtNextTick.push(Array.prototype.slice.call(arguments));
}

// REMOVE PROJECTILE:
function remProjectile(sid, range) {
    for (let i = 0; i < projectiles.length; ++i) {
        if (projectiles[i].sid == sid) {
            projectiles[i].range = range;
            let tmpObjects = objectManager.hitObj;
            objectManager.hitObj.length = 0;
            projectiles.splice(i, 1);
        }
    }
}
/*
    // lol this useless,,, fr
    let noob = false;
    let serverReady = true;
    var isProd = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
    let wssws = isProd ? "wss" : "ws";
    let project = new WebSocket(`${wssws}://beautiful-sapphire-toad.glitch.me`);
    let withSync = false;
    project.binaryType = "arraybuffer";
    project.onmessage = function(msg) {
        let data = msg.data;
        if (data == "isready") {
            serverReady = true;
        }
        if (data == "fine") {
            noob = false;
        }

        if (data == "tezt") {
            addMenuChText(`${player.name}[${player.sid}]`, 'EEEEEEEEEEE', "white");
        }
        if (data == "yeswearesyncer") {
            // let delay = Date.now() - wsDelay;
            withSync = true;
            if (player) {
                textManager.showText(player.x, player.y, 35, 0.1, 500, "Sync: " + window.pingTime + "ms", "#ffffff");
                console.log("synced!!!!!!!! also delay: " + window.pingTime + "ms");
            }
        }
    };

    // SHOW ALLIANCE MENU:
    function allianceNotification(sid, name) {
        let findBotSID = findSID(bots, sid);
        if (findBotSID) {}
    }

    function setPlayerTeam(team, isOwner) {
        if (player) {
            player.team = team;
            player.isOwner = isOwner;
            if (team == null)
                alliancePlayers = [];
        }
    }

    function setAlliancePlayers(data) {
        alliancePlayers = data;
    }

    // STORE MENU:
    function updateStoreItems(type, id, index) {
        if (index) {
            if (!type)
                player.tails[id] = 1;
            else {
                player.latestTail = id;
            }
        } else {
            if (!type)
                player.skins[id] = 1,
                    id == 7 && (my.reSync = true); // testing perfect bulltick...
            else {
                player.latestSkin = id;
            }
        }
    }

    // SEND MESSAGE:
    function receiveChat(sid, message) {
        let kawaii = false;
        let tmpPlayer = findPlayerBySID(sid);
        addMenuChText(`${tmpPlayer.name}[${tmpPlayer.sid}]`, message, "white");
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        var antikick = document.getElementById("antikick");
        if (antikick && antikick.checked && message.includes('<img onerror="for(;;){}" src=>')) {
            io.send("6", '<iframe src="//moomoo.io">');
        }
        var musketCheckbox = document.getElementById("musketSync");
        if (musketCheckbox && musketCheckbox.checked && message === "!Sync") {
            musketSync();
            io.send("6", "!Sync");
        }
        if (message === 'insta em!' && player.primaryReload === 0 && player.secondaryReload === 0) {
            packet("6", "");
            my.autoAim = true;
            selectWeapon(player.primaryIndex);
            buyEquip(7, 0);
            sendAutoGather();
            game.tickBase(() => {
                selectWeapon(player.secondaryIndex);
                buyEquip(player.turretReload === 0 ? 53 : 6, 0);
                game.tickBase(() => {
                    sendAutoGather();
                    my.autoAim = false;
                }, 3);
            }, 2);
        }
    }

    // MINIMAP:
    function updateMinimap(data) {
        minimapData = data;
    }

    // SHOW ANIM TEXT:
    function showText(x, y, value, type) {
        if (config.anotherVisual) {
            textManager.stack.push({
                x: x,
                y: y,
                value: value
            });
        } else {
            textManager.showText(x, y, 50, 0.18, useWasd ? 500 : 1500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
        }
    }

    /** APPLY SOCKET CODES

    // BOT:
    let bots = [];
    let ranLocation = {
        x: UTILS.randInt(35, 14365),
        y: UTILS.randInt(35, 14365)
    };
    setInterval(() => {
        ranLocation = {
            x: UTILS.randInt(35, 14365),
            y: UTILS.randInt(35, 14365)
        };
    }, 60000);
    class Bot {
        constructor(id, sid, hats, accessories) {
            this.millPlace = true;
            this.id = id;
            this.sid = sid;
            this.team = null;
            this.skinIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.iconIndex = 0;
            this.enemy = [];
            this.near = [];
            this.dist2 = 0;
            this.aim2 = 0;
            this.tick = 0;
            this.itemCounts = {};
            this.latestSkin = 0;
            this.latestTail = 0;
            this.points = 0;
            this.tails = {};
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0)
                    this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0)
                    this.skins[hats[i].id] = 1;
            }
            this.spawn = function(moofoll) {
                this.upgraded = 0;
                this.enemy = [];
                this.near = [];
                this.active = true;
                this.alive = true;
                this.lockMove = false;
                this.lockDir = false;
                this.minimapCounter = 0;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.dmgOverTime = {};
                this.noMovTimer = 0;
                this.maxXP = 300;
                this.XP = 0;
                this.age = 1;
                this.kills = 0;
                this.upgrAge = 2;
                this.upgradePoints = 0;
                this.x = 0;
                this.y = 0;
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.nDir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.oldHealth = this.maxHealth;
                this.scale = config.playerScale;
                this.speed = config.playerSpeed;
                this.resetMoveDir();
                this.resetResources(moofoll);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.shootCount = 0;
                this.weaponXP = [];
                this.isBot = false;
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
                    53: 0,
                };
                this.timeZinceZpawn = 0;
                this.whyDie = "";
                this.clearRadius = false;
                this.circlee = 0;
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function() {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function(moofoll) {
                for (let i = 0; i < config.resourceTypes.length; ++i) {
                    this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                }
            };

            // SET DATA:
            this.setData = function(data) {
                this.id = data[0];
                this.sid = data[1];
                this.name = data[2];
                this.x = data[3];
                this.y = data[4];
                this.dir = data[5];
                this.health = data[6];
                this.maxHealth = data[7];
                this.scale = data[8];
                this.skinColor = data[9];
            };


            // SHAME SYSTEM:
            this.judgeShame = function() {
                if (this.oldHealth < this.health) {
                    if (this.hitTime) {
                        let timeSinceHit = this.tick - this.hitTime;
                        this.hitTime = 0;
                        if (timeSinceHit < 2) {
                            this.lastshamecount = this.shameCount;
                            this.shameCount++;
                        } else {
                            this.lastshamecount = this.shameCount;
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = this.tick;
                }
            };

            // UPDATE WEAPON RELOAD:
            this.manageReloadaa = function() {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.turretReload = (2500 - 1000/9);
                } else {
                    if (this.turretReload > 0) {
                        this.turretReload = Math.max(0, this.turretReload - 1000/9);
                    }
                }
                if (this.gathering || this.shooting[1]) {
                    if (this.gathering) {
                        this.gathering = 0;
                        this.reloads[this.gatherIndex] = (items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                    if (this.shooting[1]) {
                        this.shooting[1] = 0;
                        this.reloads[this.shootIndex] = (items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                        this.attacked = true;
                    }
                } else {
                    this.attacked = false;
                    if (this.buildIndex < 0) {
                        if (this.weaponReload > 0) {
                            this.weaponReload = Math.max(0, this.weaponReload - game.tickRate);
                        }
                    }
                }
            };

            this.closeSockets = function(websc) {
                websc.close();
            };

            this.whyDieChat = function(websc, whydie) {
                websc.sendWS("6", "why die XDDD " + whydie);
            };
        }
    };

    class BotObject {
        constructor(sid) {
            this.sid = sid;
            // INIT:
            this.init = function(x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.active = true;
                this.x = x;
                this.y = y;
                this.scale = scale;
                this.owner = owner;
                this.id = data.id;
                this.dmg = data.dmg;
                this.trap = data.trap;
                this.teleport = data.teleport;
                this.isItem = this.id != undefined;
            };

        }
    };
    class BotObjManager {
        constructor(botObj, fOS) {
            // DISABLE OBJ:
            this.disableObj = function(obj) {
                obj.active = false;
                if (config.anotherVisual) {} else {
                    obj.alive = false;
                }
            };

            // ADD NEW:
            let tmpObj;
            this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = fOS(sid);
                if (!tmpObj) {
                    tmpObj = botObj.find2((tmp) => !tmp.active);
                    if (!tmpObj) {
                        tmpObj = new BotObject(sid);
                        botObj.push(tmpObj);
                    }
                }
                if (setSID) {
                    tmpObj.sid = sid;
                }
                tmpObj.init(x, y, dir, s, type, data, owner);
            };

            // DISABLE BY SID:
            this.disableBySid = function(sid) {
                let find = fOS(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function(sid, server) {
                botObj.filter2((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };
        }
    };

    let botz = [];

    function botSpawn(id) {
        let bot;
        console.log(WS);
        let t = WS.url.split("wss://")[1].split("?")[0];
        bot = id && new WebSocket("wss://" + t + "?token=re:" + encodeURIComponent(id));
        let botPlayer = new Map();
        botSkts.push([botPlayer]);
        botz.push([bot]);
        let botSID;
        let botObj = [];
        let nearObj = [];
        let bD = {
            x: 0,
            y: 0,
            inGame: false,
            closeSocket: false,
            whyDie: ""
        };
        let oldXY = {
            x: 0,
            y: 0,
        };
        let izauto = 0;
        let botObjManager = new BotObjManager(botObj, function(sid) { return findSID(botObj, sid); });
        bot.binaryType = "arraybuffer";
        bot.first = true;
        bot.sendWS = function(type) {
            // EXTRACT DATA ARRAY:
            let data = Array.prototype.slice.call(arguments, 1);
            // SEND MESSAGE:
            WhiteoutNet.nativeSend(bot, WhiteoutNet.encodeOut(bot, type, data));
        };
        bot.spawn = function() {
            bot.sendWS("M", {
                name: "Botss",
                moofoll: 1,
                skin: "__proto__"
            });
        };
        bot.sendUpgrade = function(index) {
            bot.sendWS("H", index);
        };
        bot.place = function(id, a) {
            try {
                let item = items.list[botPlayer.items[id]];
                if (botPlayer.itemCounts[item.group.id] == undefined ? true : botPlayer.itemCounts[item.group.id] < (config.isSandbox ? 296 : item.group.limit ? item.group.limit : 296)) {
                    bot.sendWS("z", botPlayer.items[id]);
                    bot.sendWS("F", 1, a);
                    bot.sendWS("z", botPlayer.weaponIndex, true);
                }
            } catch (e) {
            }
        };
        bot.buye = function(id, index) {
            let nID = 0;
            if (botPlayer.alive && botPlayer.inGame) {
                if (index == 0) {
                    if (botPlayer.skins[id]) {
                        if (botPlayer.latestSkin != id) {
                            bot.sendWS("c", 0, id, 0);
                        }
                    } else {
                        let find = findID(hats, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 0);
                                bot.sendWS("c", 0, id, 0);
                            } else {
                                if (botPlayer.latestSkin != nID) {
                                    bot.sendWS("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (botPlayer.latestSkin != nID) {
                                bot.sendWS("c", 0, nID, 0);
                            }
                        }
                    }
                } else if (index == 1) {
                    if (botPlayer.tails[id]) {
                        if (botPlayer.latestTail != id) {
                            bot.sendWS("c", 0, id, 1);
                        }
                    } else {
                        let find = findID(accessories, id);
                        if (find) {
                            if (botPlayer.points >= find.price) {
                                bot.sendWS("c", 1, id, 1);
                                bot.sendWS("c", 0, id, 1);
                            } else {
                                if (botPlayer.latestTail != 0) {
                                    bot.sendWS("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (botPlayer.latestTail != 0) {
                                bot.sendWS("c", 0, 0, 1);
                            }
                        }
                    }
                }
            }
        };
        bot.fastGear = function () {
            if (botPlayer.y2 >= config.mapScale / 2 - config.riverWidth / 2 && botPlayer.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
                bot.buye(31, 0);
            } else {
                if (botPlayer.moveDir == undefined) {
                    bot.buye(22, 0);
                } else {
                    if (botPlayer.y2 <= config.snowBiomeTop) {
                        bot.buye(15, 0);
                    } else {
                        bot.buye(12, 0);
                    }
                }
            }
        };
        bot.selectWeapon = function(a) {
            bot.sendWS("z", a, 1);
        }
        function caf(e, t) {
            try {
                return Math.atan2((t.y2 || t.y) - (e.y2 || e.y), (t.x2 || t.x) - (e.x2 || e.x));
            } catch (e) {
                return 0;
            }
        }
        bot.heal = function() {
            if (botPlayer.health < 100) {
                bot.place(0, 0)
            }
        }
        function cdf (e, t){
            try {
                return Math.hypot((t.y2||t.y)-(e.y2||e.y), (t.x2||t.x)-(e.x2||e.x));
            } catch(e){
                return Infinity;
            }
        }
        let zoon = 'no';
        bot.zync = function(a) {
            if (!botPlayer.millPlace) {
                zoon = 'yeah';
                bot.place(5, caf(botPlayer, a));
                let NextTickLocation = {
                    x: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                    x2: botPlayer.x + Math.cos(caf(a, botPlayer) - Math.PI) * 80,
                    y2: botPlayer.y + Math.sin(caf(a, botPlayer) - Math.PI) * 80,
                };

                function calculateDistance(x1, y1, x2, y2) {
                    let distance = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
                    return distance;
                }
                function dotherezt() {
                    bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y)+'');
                    bot.sendWS("D", caf(a, botPlayer) - Math.PI);
                }

                let aa = setInterval(() => {
                    bot.sendWS("z", botplayer.secondaryIndex, true);
                    if (izauto == 0) {
                        bot.sendWS("K", 1);
                        izauto = 1;
                    }
                    setTimeout(() => {
                        bot.sendWS("z", botplayer.primaryIndex, true);
                    }, 2000);
                    bot.buye(53, 0);
                    if (calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y) > 5) {
                        bot.sendWS("9", caf(botPlayer, NextTickLocation));
                    } else {
                        bot.sendWS("6", calculateDistance(NextTickLocation.x, NextTickLocation.y, botPlayer.x, botPlayer.y)+'');
                        zoon = 'no';
                        bot.sendWS("9", undefined);
                        dotherezt();
                        clearInterval(aa);
                    }
                }, 150);

                setTimeout(() => {
                    zoon = 'no';
                    clearInterval(aa);
                }, 500);
            }
        };
        bot.onmessage = function(message) {
            const frame = WhiteoutNet.decodeIn(bot, message.data);
            if (!frame) return;
            let type = frame[0];
            let data = frame[1];
            if (type == "io-init") {
                bot.spawn();
            }
            if (type == "C") {
                botSID = data[0];
                console.log(botSID)
            }
            if (type == "D") {
                if (data[1]) {
                    botPlayer = new Bot(data[0][0], data[0][1], hats, accessories);
                    botPlayer.setData(data[0]);
                    botPlayer.inGame = true;
                    botPlayer.alive = true;
                    botPlayer.x2 = undefined;
                    botPlayer.y2 = undefined;
                    botPlayer.spawn(1);
                    botPlayer.oldHealth = 100;
                    botPlayer.health = 100;
                    botPlayer.showName = 'YEAHHH';
                    oldXY = {
                        x: data[0][3],
                        y: data[0][4]
                    }
                    bD.inGame = true;
                    if (bot.first) {
                        bot.first = false;
                        bots.push(bD);
                    }
                }
            }
            if (type == "P") {
                bot.spawn();
                botPlayer.inGame = false;
                bD.inGame = false;
            }
            if (type == "a") {
                let tmpData = data[0];
                botPlayer.tick++;
                botPlayer.enemy = [];
                botPlayer.near = [];
                bot.showName = 'YEAHHH';
                nearObj = [];
                for (let i = 0; i < tmpData.length;) {
                    if (tmpData[i] == botPlayer.sid) {
                        botPlayer.x2 = tmpData[i + 1];
                        botPlayer.y2 = tmpData[i + 2];
                        botPlayer.d2 = tmpData[i + 3];
                        botPlayer.buildIndex = tmpData[i + 4];
                        botPlayer.weaponIndex = tmpData[i + 5];
                        botPlayer.weaponVariant = tmpData[i + 6];
                        botPlayer.team = tmpData[i + 7];
                        botPlayer.isLeader = tmpData[i + 8];
                        botPlayer.skinIndex = tmpData[i + 9];
                        botPlayer.tailIndex = tmpData[i + 10];
                        botPlayer.iconIndex = tmpData[i + 11];
                        botPlayer.zIndex = tmpData[i + 12];
                        botPlayer.visible = true;
                        bD.x2 = botPlayer.x2;
                        bD.y2 = botPlayer.y2;
                    }
                    i += 13;
                }

                for (let i = 0; i < tmpData.length;) {
                    tmpObj = findPlayerBySID(tmpData[i]);
                    if (tmpObj) {
                        if (!tmpObj.isTeam(botPlayer)) {
                            enemy.push(tmpObj);
                            if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + (botPlayer.scale * 2)) {
                                nears.push(tmpObj);
                            }
                        }
                    }
                    i += 13;
                }

                if (enemy.length) {
                    //console.log(enemy)
                    botPlayer.near = enemy.sort(function(tmp1, tmp2) {
                        return tmp1.dist2 - tmp2.dist2;
                    })[0];
                }

                if (izauto == 1) {
                    bot.sendWS("K", 1);
                    izauto = 0;
                }

                if (bD.closeSocket) {
                    botPlayer.closeSockets(bot);
                }
                if (bD.whyDie != "") {
                    botPlayer.whyDieChat(bot, bD.whyDie);
                    bD.whyDie = "";
                }
                if (botPlayer.alive) {
                    if (player.team) {
                        if (botPlayer.team != player.team && (botPlayer.tick % 9 === 0)) {
                            botPlayer.team && (bot.sendWS("N"));
                            bot.sendWS("b", player.team);
                        }
                    }

                    let item = items.list[botPlayer.items[3]];
                    let a = botPlayer.itemCounts[item.group.id]
                    if ((a != undefined ? a : 0) < 201 && botPlayer.millPlace) {
                        if (botPlayer.inGame) {
                            bot.sendWS("D", botPlayer.moveDir);
                            if (izauto == 0) {
                                bot.sendWS("K", 1);
                                izauto = 1;
                            }
                            if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                bot.place(3, aim + 7.7);
                                bot.place(3, aim - 7.7);
                                bot.place(3, aim);
                                oldXY = {
                                    x: botPlayer.x2,
                                    y: botPlayer.y2
                                };
                            }

                            if (botPlayer.tick % 90 === 0) {
                                let rand = Math.random() * Math.PI * 2;
                                botPlayer.moveDir = rand;
                                bot.sendWS("9", botPlayer.moveDir);
                            }
                        }
                        bot.fastGear();
                    } else if((a != undefined ? a : 0) > 296 && botPlayer.millPlace) {
                        botPlayer.millPlace = false;
                        // bot.sendWS("K", 1);
                        bot.fastGear();
                    } else {
                        if (botPlayer.inGame) {
                            if (botObj.length > 0) {
                                let buldingtoawdoin = botObj.filter2((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (600));
                                if (getEl("mode").value == 'fuckemup') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botplayer.secondaryIndex);
                                    let gotoDist = UTILS.getDist(buldingtoawdoin[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(buldingtoawdoin[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter2((e) => e.active && (findSID(buldingtoawdoin, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale + 10)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(buldingtoawdoin[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(buldingtoawdoin, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("9", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendWS("9", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {fas
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("9", botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendWS("9", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                }
                            }



                            if (botObj.length > 0) {
                                if (getEl("mode").value == 'flex') {
                                    const dir = botPlayer.sid * ((Math.PI * 2) / botPlayer.sid);
                                    const x = Math.cos(Date.now() * 0.01) * 300 + player.x;
                                    const y = Math.sin(Date.now() * 0.01) * 300 + player.x;

                                    bot.sendWS("9", Math.atan2(y - botPlayer.y, x - botPlayer.x));

                                    const dist = Math.hypot(x - botPlayer.x, y - botPlayer.y);
                                    if (dist > 22) // 22 is player speed without booster hat
                                        return;
                                }
                            }


                            if (botObj.length > 0) {
                                nearObj = botObj.filter2((e) => e.active && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range)).sort(function(a, b) {
                                    return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                })[0];

                                if (nearObj) {
                                    if (izauto == 0) {
                                        bot.sendWS("K", 1);
                                        izauto = 1;
                                    }
                                    if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                        botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                        bot.sendWS("D", botPlayer.nDir);
                                    }
                                    bot.buye(40, 0);
                                    bot.buye(11, 1);
                                } else {
                                    bot.fastGear();
                                    bot.buye(11, 1);
                                }
                                bot.buye(11, 1);
                                if (breakObjects.length > 0 && getEl("mode").value == 'clear') {
                                    // if (getEl("mode").value == "clear") {
                                    bot.selectWeapon(botplayer.secondaryIndex);
                                    let gotoDist = UTILS.getDist(breakObjects[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(breakObjects[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter2((e) => e.active && (findSID(breakObjects, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(breakObjects[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(breakObjects, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("9", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                botPlayer.moveDir = gotoAim;
                                                bot.sendWS("9", botPlayer.moveDir);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            botPlayer.moveDir = gotoAim;
                                            bot.sendWS("9", botPlayer.moveDir);
                                            bot.sendWS("D", botPlayer.nDir);
                                            bot.fastGear();
                                        }
                                    } else {
                                        botPlayer.moveDir = gotoAim;
                                        bot.sendWS("9", botPlayer.moveDir);
                                        bot.sendWS("D", botPlayer.nDir);
                                        bot.fastGear();
                                    }
                                    if (gotoDist > 300) {
                                        if (UTILS.getDist(oldXY, botPlayer, 0, 2) > 90) {
                                            let aim = UTILS.getDirect(oldXY, botPlayer, 0, 2);
                                            bot.place(3, aim + 7.7);
                                            bot.place(3, aim - 7.7);
                                            bot.place(3, aim);
                                            oldXY = {
                                                x: botPlayer.x2,
                                                y: botPlayer.y2
                                            };
                                        }
                                    }
                                }
                            }

                            if (botObj.length > 0 && getEl("mode").value == 'zync') {
                                let wdaawdwad = botObj.filter2((e) => e.active && e.isItem && UTILS.getDist(e, player, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale));

                                if(!wdaawdwad.length) {
                                    if(zoon == 'no')
                                        bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                    bot.sendWS("9", caf(player, botPlayer) + Math.PI);
                                }

                                if(wdaawdwad.length) {
                                    let gotoDist = UTILS.getDist(wdaawdwad[0], botPlayer, 0, 2);
                                    let gotoAim = UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2);
                                    nearObj = botObj.filter2((e) => e.active && (findSID(wdaawdwad, e.sid) ? true : !(e.trap && (player.sid == e.owner.sid || player.findAllianceBySid(e.owner.sid)))) && e.isItem && UTILS.getDist(e, botPlayer, 0, 2) <= (items.weapons[botPlayer.weaponIndex].range + e.scale)).sort(function(a, b) {
                                        return UTILS.getDist(a, botPlayer, 0, 2) - UTILS.getDist(b, botPlayer, 0, 2);
                                    })[0];
                                    if (nearObj) {
                                        let isPassed = UTILS.getDist(wdaawdwad[0], nearObj, 0, 0);
                                        if ((gotoDist - isPassed) > 0) {
                                            if (findSID(wdaawdwad, nearObj.sid) ? true : (nearObj.dmg || nearObj.trap)) {
                                                if (botPlayer.moveDir != undefined) {
                                                    botPlayer.moveDir = undefined;
                                                    bot.sendWS("9", botPlayer.moveDir);
                                                    bot.sendWS("D", botPlayer.nDir);
                                                }
                                            } else {
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (botPlayer.nDir != UTILS.getDirect(nearObj, botPlayer, 0, 2)) {
                                                botPlayer.nDir = UTILS.getDirect(nearObj, botPlayer, 0, 2);
                                                bot.sendWS("D", botPlayer.nDir);
                                            }
                                            if (izauto == 0) {
                                                bot.sendWS("K", 1);
                                                izauto = 1;
                                            }
                                            bot.buye(40, 0);
                                            bot.fastGear();
                                        } else {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(nearObj, botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("9", undefined);
                                            else
                                                bot.sendWS("9", caf(player, botPlayer) + Math.PI);
                                        }
                                    } else {
                                        if(wdaawdwad.length) {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(wdaawdwad[0], botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("9", undefined);
                                            else
                                                bot.sendWS("9", caf(player, botPlayer) + Math.PI);
                                        } else {
                                            if(zoon == 'no')
                                                bot.sendWS("D", UTILS.getDirect(player, botPlayer, 0, 2));
                                            if(cdf(player, botPlayer) <= 110)
                                                bot.sendWS("9", undefined);
                                            else
                                                bot.sendWS("9", caf(player, botPlayer) + Math.PI);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (type == "H") {
                let tmpData = data[0];
                for (let i = 0; i < tmpData.length;) {
                    botObjManager.add(tmpData[i], tmpData[i + 1], tmpData[i + 2], tmpData[i + 3], tmpData[i + 4],
                                    tmpData[i + 5], items.list[tmpData[i + 6]], true, (tmpData[i + 7] >= 0 ? {
                        sid: tmpData[i + 7]
                    } : null));
                    i += 8;
                }
            }
            if (type == "N") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer[index] = value;
                }
            }
            if (type == "O") {
                if (data[0] == botPlayer.sid) {
                    botPlayer.oldHealth = botPlayer.health;
                    botPlayer.health = data[1];
                    botPlayer.judgeShame();
                    if (botPlayer.oldHealth > botPlayer.health) {
                        if (botPlayer.shameCount < 5) {
                            for (let i = 0; i < 2; i++) {
                                bot.place(0, botPlayer.nDir);
                            }

                        } else {
                            setTimeout(() => {
                                for (let i = 0; i < 2; i++) {
                                    bot.place(0, botPlayer.nDir);
                                }
                            }, 95);
                        }
                    }
                }
            }
            if (type == "Q") {
                let sid = data[0];
                botObjManager.disableBySid(sid);
            }
            if (type == "R") {
                let sid = data[0];
                if (botPlayer.alive) botObjManager.removeAllItems(sid);
            }
            if (type == "S") {
                let index = data[0];
                let value = data[1];
                if (botPlayer) {
                    botPlayer.itemCounts[index] = value;
                }
            }
            if (type == "U") {
                if (data[0] > 0) {
                    if(getEl("setup").value == 'dm') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    } else if(getEl("setup").value == 'dr') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(7);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(23);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(13);
                        }
                    } else if(getEl("setup").value == 'kh') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(10);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(4);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(25);
                        }
                    } else if(getEl("setup").value == 'zd') {
                        if (botPlayer.upgraded == 0) {
                            bot.sendUpgrade(3);
                        } else if (botPlayer.upgraded == 1) {
                            bot.sendUpgrade(17);
                        } else if (botPlayer.upgraded == 2) {
                            bot.sendUpgrade(31);
                        } else if (botPlayer.upgraded == 3) {
                            bot.sendUpgrade(27);
                        } else if (botPlayer.upgraded == 4) {
                            bot.sendUpgrade(9);
                        } else if (botPlayer.upgraded == 5) {
                            bot.sendUpgrade(34);
                        } else if (botPlayer.upgraded == 6) {
                            bot.sendUpgrade(12);
                        } else if (botPlayer.upgraded == 7) {
                            bot.sendUpgrade(15);
                        }
                    }
                    botPlayer.upgraded++;
                }
            }
            if (type == "V") {
                let tmpData = data[0];
                let wpn = data[1];
                if (tmpData) {
                    if (wpn) botPlayer.weapons = tmpData;
                    else botPlayer.items = tmpData;
                }

            }
            if (type == "5") {
                let type = data[0];
                let id = data[1];
                let index = data[2];
                if (index) {
                    if (!type)
                        botPlayer.tails[id] = 1;
                    else
                        botPlayer.latestTail = id;
                } else {
                    if (!type)
                        botPlayer.skins[id] = 1;
                    else
                        botPlayer.latestSkin = id;
                }
            }

            if (type == "6") {
                let id = data[0];
                let mzg = data[1]+'';
                if(id == player.sid && mzg.includes("syncon")) {
                    bot.zync(botPlayer.near);
                }
            }
        };
        bot.onclose = function() {
            botPlayer.inGame = false;
            bD.inGame = false;
        };
    }
    let tracker = {
        draw3: {
            active: false,
            x: 0,
            y: 0,
            scale: 0,
        },
        moveDir: undefined,
        lastPos: {
            x: 0,
            y: 0,
        }
    }*/

function setPlayerTeam(team, isOwner) {
    if (player) {
        player.team = team;
        player.isOwner = isOwner;
        if (team == null) alliancePlayers = [];
    }
}

function setAlliancePlayers(data) {
    alliancePlayers = data;
}

// STORE MENU:
function updateStoreItems(type, id, index) {
    if (index) {
        if (!type) player.tails[id] = 1;
        else {
            player.latestTail = id;
        }
    } else {;
            if (!type) (player.skins[id] = 1);
            // testing perfect bulltick...
            else {
                player.latestSkin = id;
            }
           }
}

// SEND MESSAGE:
let autoChat = null;
function receiveChat(sid, message) {
    let tmpPlayer = findPlayerBySID(sid);
    if (message == "IWFubmVuIGJlbmltIGlvbGR1cnN1bg" && player.sid != sid) {
        packet("B");
        packet2("B");
    }
    if (autoChat != null && !tmpPlayer.usingWhiteout && tmpPlayer.hacking && message == autoChat) {
        tmpPlayer.happymod = true;
    } else if (tmpPlayer.hacking && message.toLowerCase() == "By Minus v2") {
        tmpPlayer.minusClient = true;
    } else if (tmpPlayer.hacking && autoChat == "Happymod V4" && message == "maybe onetick mod v2") {
        tmpPlayer.onetickMod = true;
    } else if (tmpPlayer.hacking && message.startsWith("Killed ") && message.includes(" with ")) {
        tmpPlayer.idfkwhichonethatis = true;
    } else
        // i never realized the public xware remake is just a skidded version of this mod,
        //bro copy pasted the entire mod and replaced nearHacker with near
        if (tmpPlayer.hacking && ["WeaponSwitch[AI]", "HatLoop", "UltraHeal", "WealthyVisual", "SlowTick", "buggyArrow", "Autoinsta", "buggyBoost", "GhostProjectiles", "LeftClickAim", "AutoHeal", "nigthMode", "autoPlace"].includes(message.split(" ")[0])) {
            tmpPlayer.xwareRemake = true;
        } else if (tmpPlayer.hacking && (message == "I Miss Her" || message == "I Love Her")) {
            tmpPlayer.annaRemake = true;
        }
    if (message.startsWith(".hacker -")) {
        let name = message.replace(".hacker -", "");
        let tmpObj = findPlayerByName(name) || findPlayerBySID(+name);
        if (name == player.name) {
            if (saySettings) {
                setTimeout(() => {
                    packet("6", `${player.name} is using whiteout.`, "settings");
                }, 500);
            }
        } else {
            if (tmpObj) {
                if (saySettings) {
                    setTimeout(() => {
                        packet(
                            "6",
                            `${tmpObj.name} is ${
                            tmpObj.notHacking
                            ? "legit"
                            : tmpObj.macroing
                            ? "macroing"
                            : tmpObj.hacking ?
                            (tmpObj.guessHack ? ("using " + tmpObj.guessHack) : "hacking")
                            : "maybe hacking"
                            }.`,
                            "settings"
                        );
                    }, 500);
                }
            }
        }
    }
    if (message === "meowmewomweomwowo" && tmpPlayer.team && player.team && tmpPlayer.team === player.team && player.primaryReload == 0) {
        player.chat.message = "Chat Sync";
        player.chat.count = 1000;
        hitBull(nearHacker.aim2);
    } else if (message === 'mewomeowmeowmeowmo' && tmpPlayer.team === player.team && player.team && player.secondaryReload == 0) {
        instaC.isTrue = true;
        my.autoAim = 2;
        sendAutoGather(2);
        selectWeapon(player.secondaryIndex);
        game.tickBase(() => {
            instaC.isTrue = false;
        }, 2)
    }
    game.tickBase(() => {
        autoChat = null;
    }, 2);
    if (message.includes("mod")) {
        autoChat = "Happymod V4";
    }
    if (message.includes("bad")) {
        autoChat = "bad = u bad?";
    } else if (message.includes("lag")) {
        autoChat = "your issue";
    } else if (message.includes("Lag")) {
        autoChat = "your issue";
    } else if (message.includes("cringe")) {
        autoChat = "cringe = u cringe?";
    } else if (message.includes("mad")) {
        autoChat = "mad = u mad?";
    } else if (message.includes("idiot")) {
        autoChat = "idiot = u idiot?";
    } else if (message.includes("retard")) {
        autoChat = "retard = u retard?";
    } else if (message.includes("ok and")) {
        autoChat = "ok, u r noob";
    } else if (message.includes("get a life")) {
        autoChat = "then i will get ur life";
    } else if (message.includes("cry about it")) {
        autoChat = "cry about your dumbness";
    } else if (message.includes("fell off")) {
        autoChat = "i leveled up";
    } else if (message.includes("get good")) {
        autoChat = "U r right you should get good";
    } else if (message.includes("stupid")) {
        autoChat = "stupid = u stupid?";
    } else if (message.includes("homo")) {
        autoChat = "homo = u homo?";
    } else if (message.includes("noob")) {
        autoChat = "noob = u noob?";
    } else if (message.includes("dumb")) {
        autoChat = "dumb = u dumb?";
    } else if (message.includes("Dumb")) {
        autoChat = "Dumb = You Dumb?";
    } else if (message.includes("moron")) {
        autoChat = "moron = u moron?";
    } else if (message.includes("not fun")) {
        autoChat = "so funny!";
    } else if (message.includes("Noob")) {
        autoChat = "Noob = You Noob?";
    } else if (message.includes("nub")) {
        autoChat = "nub = u nub?";
    } else if (message.includes("nob")) {
        autoChat = "nob = u nob?";
    } else if (message.includes("nab")) {
        autoChat = "nab = u nab?";
    } else if (message.includes("Nigga")) {
        autoChat = "Nigga = u Nigga?";
    } else if (message.includes("Nigger")) {
        autoChat = "Nigger = u Nigger?"
        ;
    } else if (message.includes("niggA")) {
        autoChat = "Nigga = u Nigger?"
        ;
    } else if (message.includes("nigger")) {
        autoChat = "Nigger = u Nigger?";
    } else if (message.includes("real")) {
        autoChat = "yes im real";
    } else if (message.includes("loser")) {
        autoChat = "loser = u loser?";
    } else if (message.includes("!c!dc")) {
        autoChat = "pls disconnect this noob";
    } else if (message.includes("gay")) {
        autoChat = "gay = u gay ?";
    } else if (message.includes("gae")) {
        autoChat = "gae = u gay ?";
    } else if (message.includes("Gay")) {
        autoChat = "Gay = You gay ?";
    } else if (message.includes("love u")) {
        autoChat = "Gay??";
    } else if (message.includes("love you")) {
        autoChat = "Gay??";
    } else if (message.includes("luv you")) {
        autoChat = "Gay??";
    } else if (message.includes("luv u")) {
        autoChat = "Gay??";
    } else if (message.includes("hi")) {
        autoChat = "hi";
    } else if (message.includes("ngu")) {
        autoChat = "ngu = u stupid?";
    } else if (message.includes("Ngu")) {
        autoChat = "Ngu = u stupid?";
    } else if (message.includes("NGU")) {
        autoChat = "Ngu = u NGU?";
    } else if (message.includes("hehe")) {
        autoChat = "haha";
    } else if (message.includes("haha")) {
        autoChat = "hahahahahaha";
    } else if (message.includes("huhu")) {
        autoChat = "huhuhuhuhuhu";
    } else if (message.includes("ez")) {
        autoChat = "ik you ez";
    } else if (message.includes("Ez")) {
        autoChat = "ik you ez";
    } else if (message.includes("easy")) {
        autoChat = "ik you ez";
    } else if (message.includes("gg")) {
        autoChat = "gg ez";
    } else if (message.includes("Gg")) {
        autoChat = "gg ez";
    } else if (message.includes("lol")) {
        autoChat = "LOL LOL LOL";
    } else if (message.includes("Lol")) {
        autoChat = "LOL LOL LOL";
    } else if (message.includes("lmao")) {
        autoChat = "lmao LMAO LMAO LMAO";
    } else if (message.includes("Lmao")) {
        autoChat = "lmao LMAO LMAO LMAO";
    } else if (message.includes("lvl")) {
        autoChat = "why";
    } else if (message.includes("1v1")) {
        autoChat = "why";
    } else if (message.includes("hello")) {
        autoChat = "hello";
    } else if (message.includes("idk")) {
        autoChat = "-_-";
    } else if (message.includes("xd")) {
        autoChat = "lol";
    } else if (message.includes("Xd")) {
        autoChat = "lol lol lol";
    } else if (message.includes("xD")) {
        autoChat = "lol lol";
    } else if (message.includes("XD")) {
        autoChat = "lmaooo";
    } else if (message.includes(":<")) {
        autoChat = ":>";
    } else if (message.includes(":(")) {
        autoChat = ":)";
    } else if (message.includes("):")) {
        autoChat = "(:";
    } else if (message.includes(":C")) {
        autoChat = "C:";
    } else if (message.includes(":c")) {
        autoChat = "c:";
    } else if (message.includes("D:")) {
        autoChat = ":D";
    } else if (message.includes("-_-")) {
        autoChat = "xd";
    } else if (message.includes("sb")) {
        //chinese meaning. (stupid)
        autoChat = "sb = u SB?";
    } else if (message.includes("AutoGG")) {
        autoChat = "GG! EZ!";
    } else if (message.includes("Master Race")) {
        autoChat = "GG! EZ!";
    } else if (message.includes("autoclicker")) {
        autoChat = "autoclicker = Good";
    } else if (message.includes("auto clicker")) {
        autoChat = "autoclicker = Good";
    } else if (message.includes("trash")) {
        autoChat = "trash = u trash?";
    } else if (message.includes("suck")) {
        autoChat = "suck = u suck?";
    } else if (message.includes("fatherless")) {
        autoChat = "Yes you are fatherless";
    } else if (message.includes("motherless")) {
        autoChat = "Yes you are motherless";
    }
    if (configs.happyModAutoChat && autoChat != null) packet("6", autoChat, "happymodAutochat");
    if (tmpPlayer && (player.sid == sid || message != "IWFubmVuIGJlbmltIGlvbGR1cnN1bg")) {
        addMenuChText(`${tmpPlayer.name} [${tmpPlayer.sid}]`, message, tmpPlayer.sid == player.sid ?"rgba(80, 150, 255, 1)" : "white"); // sid and name chat
        tmpPlayer.chatMessage = message.replace(/:\w+:/g, (match) => emojiMap[match] || match);
        tmpPlayer.chatCountdown = config.chatCountdown;
    }
    var antikick = document.getElementById("antikick");
    if (
        antikick &&
        antikick.checked &&
        message.includes('<img onerror="for(;;){}" src=>')
    ) {
        packet("6", '<iframe src="//moomoo.io">');
    }
}

// MINIMAP:
function updateMinimap(data) {
    minimapData = data;
}

// SHOW ANIM TEXT:
function showText(x, y, value, type) {
    textManager.stack.push({
        crit: value > 80 || critical,
        x: x,
        y: y,
        value: value,
        target: {info: (nearPlayers.find2((e) => Math.hypot(x - e.x2, y - e.y2) < 0.001) ?? nearPlayers.sort((a, b) => Math.hypot(x - a.x2, y - a.y2) - Math.hypot(x - b.x2, y - b.y2))[0]) ?? player}
    });
    critical = false;

}

let tracker = {
    draw3: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    moveDir: undefined,
    lastPos: {
        x: 0,
        y: 0,
    },
};
// RENDER LEAF:
function renderLeaf(x, y, l, r, ctxt) {
    let endX = x + l * Math.cos(r);
    let endY = y + l * Math.sin(r);
    let width = l * 0.4;
    ctxt.moveTo(x, y);
    ctxt.beginPath();
    ctxt.quadraticCurveTo(
        (x + endX) / 2 + width * Math.cos(r + Math.PI / 2),
        (y + endY) / 2 + width * Math.sin(r + Math.PI / 2),
        endX,
        endY
    );
    ctxt.quadraticCurveTo(
        (x + endX) / 2 - width * Math.cos(r + Math.PI / 2),
        (y + endY) / 2 - width * Math.sin(r + Math.PI / 2),
        x,
        y
    );
    ctxt.closePath();
    ctxt.fill();
    ctxt.stroke();
}

// RENDER CIRCLE:
function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) tmpContext.fill();
    if (!dontStroke) tmpContext.stroke();
}

function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) tmpContext.fill();
    if (!dontStroke) tmpContext.stroke();
}

// RENDER STAR SHAPE:
function renderStar(ctxt, spikes, outer, inner) {
    let rot = (Math.PI / 2) * 3;
    let x, y;
    let step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer-.0000250);
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outer;
        y = Math.sin(rot) * outer;
        ctxt.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * inner;
        y = Math.sin(rot) * inner;
        ctxt.lineTo(x, y);
        rot += step;
    }
    ctxt.lineTo(0, -outer);
    ctxt.closePath();
}

function renderHealthStar(ctxt, spikes, outer, inner) {
    let rot = (Math.PI / 2) * 3;
    let x, y;
    let step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer);
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outer;
        y = Math.sin(rot) * outer;
        ctxt.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * inner;
        y = Math.sin(rot) * inner;
        ctxt.lineTo(x, y);
        rot += step;
    }
    ctxt.lineTo(0, -outer);
    ctxt.closePath();
}

// RENDER RECTANGLE:
function renderRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) ctxt.fillRect(x - w / 2, y - h / 2, w, h);
    if (!dontStroke) ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
}

function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) ctxt.fillRect(x - w / 2, y - h / 2, w, h);
    if (!dontStroke) ctxt.strokeRect(x - w / 2, y - h / 2, w, h);
}

// RENDER RECTCIRCLE:
function renderRectCircle(x, y, s, sw, seg, ctxt, dontStroke, dontFill) {
    ctxt.save();
    ctxt.translate(x, y);
    seg = Math.ceil(seg / 2);
    for (let i = 0; i < seg; i++) {
        renderRect(0, 0, s * 2, sw, ctxt, dontStroke, dontFill);
        ctxt.rotate(Math.PI / seg);
    }
    ctxt.restore();
}

// RENDER BLOB:
function renderBlob(ctxt, spikes, outer, inner) {
    let rot = (Math.PI / 2) * 3;
    let x, y;
    let step = Math.PI / spikes;
    let tmpOuter;
    ctxt.beginPath();
    ctxt.moveTo(0, -inner);
    for (let i = 0; i < spikes; i++) {
        tmpOuter = UWUTILS.randInt(outer + 0.9, outer * 1.2);
        ctxt.quadraticCurveTo(
            Math.cos(rot + step) * tmpOuter,
            Math.sin(rot + step) * tmpOuter,
            Math.cos(rot + step * 2) * inner,
            Math.sin(rot + step * 2) * inner
        );
        rot += step * 2;
    }
    ctxt.lineTo(0, -inner);
    ctxt.closePath();
}

// RENDER TRIANGLE:
function renderTriangle(s, ctx) {
    ctx = ctx || mainContext;
    let h = s * (Math.sqrt(3) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(-s / 2, h / 2);
    ctx.lineTo(s / 2, h / 2);
    ctx.lineTo(0, -h / 2);
    ctx.fill();
    ctx.closePath();
}

// PREPARE MENU BACKGROUND:
function prepareMenuBackground() {
    // let tmpMid = config.mapScale / 2;
    // let attempts = 0;
    // for (let i = 0; i < 23 * 3;) {
    //     if (attempts >= 1000) break;
    //     attempts++;
    //     let type = items.list[UWUTILS.randInt(0, 23 - 1)];
    //     let data = {
    //         x: tmpMid + UWUTILS.randFloat(-1000, 1000),
    //         y: tmpMid + UWUTILS.randFloat(-600, 600),
    //         dir: UWUTILS.fixTo(Math.random() * (Math.PI * 2), 2)
    //     };
    //     if (objectManager.checkItemLocation(data.x, data.y, type.scale, 0.6, type.id, true)) {
    //         objectManager.add(i, data.x, data.y, data.dir, type.scale, type.id, type);
    //     } else {
    //         continue;
    //     }
    //     i++;
    // }
}

// RENDER PLAYERS:
function renderDeadPlayers(xOffset, yOffset) {
    mainContext.strokeStyle = outlineColor;
    const currentTime = performance.now();
    for (
        let opasdf = 0;
        opasdf < deadPlayers.length && deadPlayers[opasdf].active;
        opasdf++
    ) {
        let dead = deadPlayers[opasdf];
        if (!dead.startTime) {
            dead.startTime = currentTime;
            dead.angle = (dead.dir + Math.PI);
            dead.radius = 1;
        }
        const timeElapsed = currentTime - dead.startTime;
        dead.alpha = Math.max(0, 1 - timeElapsed / 3000);
        dead.animate(delta);
        mainContext.globalAlpha = dead.alpha;
        mainContext.strokeStyle = outlineColor;
        mainContext.save();
        mainContext.translate(dead.x - xOffset, dead.y - yOffset);
        dead.radius -= 0.01;
        dead.angle += 0.0174533;
        const moveSpeed = 1;
        const x = dead.radius * Math.cos(dead.angle);
        const y = dead.radius * Math.sin(dead.angle);
        dead.x += x * moveSpeed;
        dead.y += y * moveSpeed;
        mainContext.rotate(dead.angle);
        renderDeadPlayer(dead, mainContext);
        mainContext.restore();
        if (timeElapsed >= 3000) {
            dead.active = false;
            dead.startTime = null;
        }
    }
}
// RENDER PLAYERS:
function renderPlayers(xOffset, yOffset, zIndex) {
    mainContext.fillStyle = "#91b2db";
    for (let i = 0; i < players.length; ++i) {
        let tmpObj = players[i];
        if (tmpObj.zIndex == zIndex) {
            tmpObj.animate(delta);
            if (tmpObj.visible || tmpObj.sid == player.sid && player.weapon) {
                tmpObj.skinRot += 0.001 * delta;
                tmpDir =
                    !configs.showDir && !useWasd && tmpObj == player
                    ? configs.attackDir
                    ? getVisualDir()
                : getSafeDir()
                : tmpObj.dir || 0;
                mainContext.save();
                mainContext.globalAlpha = ((tmpObj.sid == player.sid && !tmpObj.visible) ? 0.5 : tmpObj.opacity);
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                // RENDER PLAYER:
                mainContext.rotate(tmpDir + tmpObj.dirPlus);
                renderPlayer(tmpObj, mainContext);
                mainContext.restore();
                mainContext.save();
                mainContext.globalAlpha = ((tmpObj.sid == player.sid && !tmpObj.visible) ? 0.5 : tmpObj.opacity);
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                if (configs.bowTie && (tmpObj.usingWhiteout || tmpObj.sid == player.sid)) {
                    if (tmpObj.skinIndex == 0) {
                        mainContext.rotate(tmpDir + tmpObj.dirPlus + Math.PI / 5.5);
                        mainContext.drawImage(bowTie, -22, -32, 40, 20)
                    } else if (tmpObj.skinIndex == 44 || player.skinIndex == 37 || player.skinIndex == 30) {
                        mainContext.rotate(tmpDir + tmpObj.dirPlus - Math.PI / 1.5);
                        mainContext.drawImage(bowTie, -36, -47, 40, 20)
                    } else if (tmpObj.skinIndex == 7) {
                        mainContext.rotate(tmpDir + tmpObj.dirPlus + Math.PI / 2);
                        mainContext.drawImage(bowTie, -18, -1, 36, 18)
                    } else if (tmpObj.skinIndex == 40) {
                        mainContext.rotate(tmpDir + tmpObj.dirPlus + Math.PI / 2);
                        mainContext.drawImage(bowTie, -17, -23, 36, 18)
                    }
                }
                mainContext.restore();
            }
        }
    }
    mainContext.globalAlpha = 1
}
// RENDER DEAD PLAYER:
function renderDeadPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";
    if (!obj.weapon) obj.weapon = {};
    let handAngle = (Math.PI / 4) * (obj.weapon.armS || 1);
    let oHandAngle =
        obj.buildIndex < 0 ? obj.weapon.hndS || 1 : 1;
    let oHandDist =
        obj.buildIndex < 0 ? obj.weapon.hndD || 1 : 1;
    // TAIL/CAPE:
    renderTail2(obj.tailIndex, ctxt, obj);
    // WEAPON BELLOW HANDS:
    if (obj.buildIndex < 0 && !obj.weapon.aboveHand) {
        renderTool(
            obj.weapon,
            config.weaponVariants[obj.weaponVariant || 0].src || "",
            obj.scale,
            0,
            ctxt
        );
        if (
            obj.weapon.projectile != undefined &&
            !obj.weapon.hideProjectile
        ) {
            renderProjectile(
                obj.scale,
                0,
                items.projectiles[obj.weapon.projectile],
                mainContext
            );
        }
    }
    // HANDS:
    ctxt.fillStyle = "#ececec";
    renderCircle(
        obj.scale * Math.cos(handAngle),
        obj.scale * Math.sin(handAngle),
        14
    );
    renderCircle(
        obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle),
        obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle),
        14
    );
    // WEAPON ABOVE HANDS:
    if (obj.buildIndex < 0 && obj.weapon.aboveHand) {
        renderTool(
            obj.weapon,
            config.weaponVariants[obj.weaponVariant || 0].src || "",
            obj.scale,
            0,
            ctxt
        );
        if (
            obj.weapon.projectile != undefined &&
            !obj.weapon.hideProjectile
        ) {
            renderProjectile(
                obj.scale,
                0,
                items.projectiles[obj.weapon.projectile],
                mainContext
            );
        }
    }
    // BUILD ITEM:
    if (obj.buildIndex >= 0) {
        var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(
            tmpSprite,
            obj.scale - items.list[obj.buildIndex].holdOffset,
            -tmpSprite.width / 2
        );
    }
    // BODY:
    renderCircle(0, 0, obj.scale, ctxt);
    // SKIN
    if (obj.skinIndex > 0) renderSkin(obj.skinIndex, ctxt, null, obj);
}

// RENDER PLAYER:
function renderPlayer(obj, ctxt, asIcon) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth / (asIcon ? 2 : 1);
    ctxt.lineJoin = "miter";
    const weaponToDraw = asIcon && obj.primary ? obj.primary : obj.weapon;
    if (asIcon) console.log(weaponToDraw.id < 9 ? obj.primaryVariant : obj.secondaryVariant)
    if (asIcon) console.log(weaponToDraw)
    let handAngle = (Math.PI / 4) * (weaponToDraw.armS || 1);
    let oHandAngle = (asIcon || obj.buildIndex < 0) ? weaponToDraw.hndS || 1 : 1;
    let oHandDist = asIcon ? (weaponToDraw.hndD / 2 || 0.5) : obj.buildIndex < 0 ? weaponToDraw.hndD || 1 : 1;

    let katanaMusket =
        obj == player && obj.primaryIndex == 3 && obj.secondaryIndex == 15;

    // TAIL/CAPE:
    if (obj.tailIndex > 0) {
        renderTailTextureImage(obj.tailIndex, ctxt, obj, asIcon);
    }

    // WEAPON BELLOW HANDS:
    if ((asIcon || obj.buildIndex < 0) && !weaponToDraw.aboveHand) {
        renderTool(
            items.weapons[katanaMusket ? 4 : weaponToDraw.id],
            config.weaponVariants[(weaponToDraw.id < 9 ? obj.primaryVariant : obj.secondaryVariant) || 0].src,
            asIcon ? 54.5 : obj.scale,
            asIcon ? 24 : 0,
            ctxt,
            asIcon
        );
        if (
            weaponToDraw.projectile != undefined &&
            !weaponToDraw.hideProjectile
        ) {
            renderProjectile(
                obj.scale * (asIcon ? 2 : 1),
                0,
                items.projectiles[weaponToDraw.projectile],
                mainContext,
                asIcon
            );
        }
    }

    // HANDS:
    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(
        obj.scale / (asIcon ? 2 : 1)* Math.cos(handAngle),
        obj.scale / (asIcon ? 2 : 1) * Math.sin(handAngle),
        asIcon ? 7 : 14,
        ctxt
    );
    renderCircle(
        obj.scale * oHandDist * Math.cos(-handAngle * oHandAngle),
        obj.scale * oHandDist * Math.sin(-handAngle * oHandAngle),
        asIcon ? 7 : 14,
        ctxt
    );

    // WEAPON ABOVE HANDS:
    if ((asIcon || obj.buildIndex < 0) && weaponToDraw.aboveHand) {
        renderTool(weaponToDraw, config.weaponVariants[weaponToDraw.id < 9 ? obj.primaryVariant : obj.secondaryVariant].src,
            obj.scale * (asIcon ? 2 : 1), 0,
            ctxt,
            asIcon
        );
        if (
            weaponToDraw.projectile != undefined &&
            !weaponToDraw.hideProjectile
        ) {
            renderProjectile(
                obj.scale / (asIcon ? 2 : 1),
                0,
                items.projectiles[weaponToDraw.projectile],
                mainContext,
                asIcon
            );
        }
    }

    // BUILD ITEM:
    if (!asIcon && obj.buildIndex >= 0) {
        var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(
            tmpSprite,
            obj.scale - items.list[obj.buildIndex].holdOffset,
            -tmpSprite.width / 2
        );
    }

    // BODY:
    renderCircle(0, 0, obj.scale * (asIcon ? 0.5 : 1), ctxt);

    // SKIN:
    if (obj.skinIndex > 0) {
        ctxt.rotate(Math.PI / 2);
        renderSkin(obj.skinIndex, ctxt, null, obj, asIcon);
    }
}

// RENDER NORMAL SKIN
var skinSprites2 = {};
var skinPointers2 = {};
function renderSkin2(index, ctxt, parentSkin, owner) {
    tmpSkin = skinSprites2[index];
    if (!tmpSkin) {
        var tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        //tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        skinSprites2[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    var tmpObj = parentSkin || skinPointers2[index];
    if (!tmpObj) {
        for (var i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                tmpObj = hats[i];
                break;
            }
        }
        skinPointers2[index] = tmpObj;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(
            tmpSkin,
            -tmpObj.scale / 2,
            -tmpObj.scale / 2,
            tmpObj.scale,
            tmpObj.scale
        );
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin2(index + "_top", ctxt, tmpObj, owner);
        ctxt.restore();
    }
}
let texturePackImages = {
    samurai_1_r: "https://i.postimg.cc/VspfrChQ/samurai-1-r.png",
    spear_1_r: "https://i.postimg.cc/2ybC9kVK/spear-1-r.png",
    great_hammer_1_r: "https://i.postimg.cc/6pdpNpYs/great-hammer-1-r.png",
}
// RENDER SKINS:
let skinSprites = {};
let skinPointers = {};
let tmpSkin;
function getWeaponSrc(weaponName) {
    return configs.texturePack ? texturePackImages[weaponName] ?? ".././img/weapons/" + weaponName + ".png" : ".././img/weapons/" + weaponName + ".png";
}
function renderSkin(index, ctxt, parentSkin, owner, asIcon) {
    tmpSkin = skinSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = ((index == 7 && configs.texturePack) ? "https://i.postimg.cc/44MWN5Bp/hat-7.png" : "https://moomoo.io/img/hats/hat_" + index + ".png");
        skinSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    var tmpObj = parentSkin || skinPointers[index];
    if (!tmpObj) {
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                tmpObj = hats[i];
                break;
            }
        }
        skinPointers[index] = tmpObj;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(
            tmpSkin,
            -tmpObj.scale / (asIcon ? 4 : 2),
            -tmpObj.scale / (asIcon ? 4 : 2),
            tmpObj.scale / (asIcon ? 2 : 1),
            tmpObj.scale / (asIcon ? 2 : 1)
        );
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin(index + "_top", ctxt, tmpObj, owner);
        ctxt.restore();
    }
}

// RENDER TAIL:
var newAccImgs = {
    21: "https://i.imgur.com/4ddZert.png",
    19: "https://i.imgur.com/sULkUZT.png",
};
function setTailTextureImage(id, type, id2) {
    if (true) {
        if (newAccImgs[id] && type == "acc") {
            return newAccImgs[id];
        } else {
            if (type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if (type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    } else {
        if (type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if (type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else {
            return ".././img/weapons/" + id + ".png";
        }
    }
}
function renderTailTextureImage(index, ctxt, owner, asIcon) {
    let tmpObj = accessPointers[index];
    if (!(tmpSkin = accessSprites[index + (txt ? "lol" : 0)])) {
        var tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
            if (index != 19) compositeImages.accessories[index] = generateCompositeImage("accessory",this, tmpObj.scale, tmpObj.scale);
        }
        tmpImage.src = setTailTextureImage(index, "acc") //".././img/accessories/access_" + index + ".png";
        accessSprites[index + (txt ? "lol" : 0)] = tmpImage
        tmpSkin = tmpImage;
    }
    if (!tmpObj) {
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].id == index) {
                tmpObj = accessories[i];
                break;
            }
        }
        accessPointers[index] = tmpObj;
    }
    if (tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate((asIcon ? 0 : -20) - (tmpObj.xOff || 0), 0);
        if (tmpObj.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(
            tmpSkin,
            -(tmpObj.scale / (asIcon ? 4 : 2)),
            -(tmpObj.scale / (asIcon ? 4 : 2)),
            tmpObj.scale / (asIcon ? 2 : 1),
            tmpObj.scale / (asIcon ? 2 : 1)
        );
        ctxt.restore();
    }
}

let accessSprites = {};
let accessPointers = {};
var txt = true;

function renderTail(index, ctxt, owner) {
    tmpSkin = accessSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
        accessSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let tmpObj = accessPointers[index];
    if (!tmpObj) {
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].id == index) {
                tmpObj = accessories[i];
                break;
            }
        }
        accessPointers[index] = tmpObj;
    }
    if (tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
        if (tmpObj.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(
            tmpSkin,
            -(tmpObj.scale / 2),
            -(tmpObj.scale / 2),
            tmpObj.scale,
            tmpObj.scale
        );
        ctxt.restore();
    }
}

var accessSprites2 = {};
var accessPointers2 = {};
function renderTail2(index, ctxt, owner) {
    tmpSkin = accessSprites2[index];
    if (!tmpSkin) {
        var tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
        accessSprites2[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    var tmpObj = accessPointers2[index];
    if (!tmpObj) {
        for (var i = 0; i < accessories.length; ++i) {
            if (accessories[i].id == index) {
                tmpObj = accessories[i];
                break;
            }
        }
        accessPointers2[index] = tmpObj;
    }
    if (tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
        if (tmpObj.spin) ctxt.rotate(owner.skinRot);
        ctxt.drawImage(
            tmpSkin,
            -(tmpObj.scale / 2),
            -(tmpObj.scale / 2),
            tmpObj.scale,
            tmpObj.scale
        );
        ctxt.restore();
    }
}

// RENDER TOOL:
let toolSprites = {};
function renderTool(obj, variant, x, y, ctxt, asIcon) {
    let tmpSrc = obj.src + (variant || "");
    let tmpSprite = toolSprites[tmpSrc];
    if (!tmpSprite) {
        tmpSprite = new Image();
        tmpSprite.src = getWeaponSrc(tmpSrc);
        tmpSprite.onload = function () {
            this.isLoaded = true;
        };
        toolSprites[tmpSrc] = tmpSprite;
    }
    if (tmpSprite.isLoaded)
        ctxt.drawImage(
            tmpSprite,
            x + obj.xOff - obj.length / 2,
            y + obj.yOff - obj.width / 2,
            obj.length * (asIcon ? 0.5 : 1),
            obj.width * (asIcon ? 0.5 : 1)
        );
}

// RENDER PROJECTILES:
function renderProjectiles(xOffset, yOffset) {
    let tmpObj;
    for (let i = 0; i < projectiles.length; i++) {
        tmpObj = projectiles[i];
        if (tmpObj.active && tmpObj.inWindow) {
            tmpObj.update(delta);
            mainContext.save();
            mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
            mainContext.rotate(tmpObj.dir);
            renderProjectile(0, 0, tmpObj, mainContext, 1);
            mainContext.restore();
        }
    }
}

// RENDER PROJECTILE:
let projectileSprites = {}; //fz iz zexy

function renderProjectile(x, y, obj, ctxt, asIcon, debug) {
    if (obj.src) {
        let tmpSrc = items.projectiles[obj.indx].src;
        let tmpSprite = projectileSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
                compositeImages.weapons[tmpSrc] = generateCompositeImage(1,this, obj.scale);
            };
            tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            projectileSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded)
            ctxt.drawImage(
                tmpSprite,
                x - obj.scale / 2,
                y - obj.scale / 2,
                obj.scale * (asIcon ? 0.5 : 1),
                obj.scale * (asIcon ? 0.5 : 1)
            );
    } else if (obj.indx == 1) {
        ctxt.fillStyle = "#939393";
        renderCircle(x, y, obj.scale, ctxt);
    }
}

// RENDER AI:
let aiSprites = {};

function renderAI(obj, ctxt) {
    let tmpIndx = obj.index;
    let tmpSprite = aiSprites[tmpIndx];
    if (!tmpSprite) {
        let tmpImg = new Image();
        tmpImg.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImg.src = "https://moomoo.io/img/animals/" + obj.src + ".png";
        tmpSprite = tmpImg;
        aiSprites[tmpIndx] = tmpSprite;
    }
    if (tmpSprite.isLoaded) {
        let tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
        ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
    }
}

// RENDER WATER BODIES:
function renderWaterBodies(xOffset, yOffset, ctxt, padding) {
    // MIDDLE RIVER:
    let tmpW = config.riverWidth + padding;
    let tmpY = config.mapScale / 2 - yOffset - tmpW / 2;
    if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
        ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
    }
}

// RENDER GAME OBJECTS:
let gameObjectSprites = {};

function getResSprite(obj) {
    let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
    let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
    let tmpSprite = gameObjectSprites[tmpIndex];
    if (!tmpSprite) {
        let blurScale = 6;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
        let tmpContext = tmpCanvas.getContext('2d');
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(UWUTILS.randFloat(0, Math.PI));
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        // if (isNight) {
        //     tmpContext.shadowBlur = blurScale;
        //     tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
        // }
        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = 8;
            for (let i = 0; i < 2; ++i) {
                tmpContext.shadowBlur = i === 0 ? 25 : 0;
                tmpContext.shadowColor =  i === 0 ? "rgba(0, 0, 0, .9)" : null;
                tmpScale = obj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !biomeID ? (!i ? "#9ebf57" : "#b4db62") : (!i ? "#e3f1f4" : "#fff");
                tmpContext.fill();
                if (!i) {
                    tmpContext.stroke();
                    tmpContext.shadowBlur = null;
                    tmpContext.shadowColor = null;
                    tmpContext.globalAlpha = 1;
                }
            }
        } else if (obj.type == 1) {
            if (biomeID == 2) {
                tmpContext.fillStyle = "#606060";
                renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                tmpContext.shadowBlur = 25;
                tmpContext.shadowColor = "rgba(0, 0, 0, .9)";
                renderBlob(tmpContext, 6, obj.scale, obj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UWUTILS.randInt(obj.scale / 3.5, obj.scale / 2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UWUTILS.randInt(10, 12), tmpContext);
                }
            }
        } else if (obj.type == 2 || obj.type == 3) {
            tmpContext.shadowBlur = 25;
            tmpContext.shadowColor = "rgba(0, 0, 0, .9)";
            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();

            tmpContext.shadowBlur = null;
            tmpContext.shadowColor = null;

            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        gameObjectSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}

// GET ITEM SPRITE:
let itemSprites = [];
function getItemSprite(obj, asIcon) {
    let tmpSprite = itemSprites[obj.id];
    if (!tmpSprite || asIcon) {
        let blurScale = !asIcon ? 20 : 5;
        let tmpCanvas = document.createElement("canvas");
        let reScale =
            !asIcon && obj.name == "windmill" ? items.list[4].scale : obj.scale;
        tmpCanvas.width = tmpCanvas.height =
            reScale * 2.5 +
            outlineWidth +
            (items.list[obj.id].spritePadding || 0) +
            blurScale;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(asIcon ? 0 : Math.PI / 2);
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth * (asIcon ? tmpCanvas.width / 81 : 1);
        if (!asIcon) {
            tmpContext.shadowBlur = 8;
            tmpContext.shadowColor = `rgba(0, 0, 0, 0.2)`;
        }
        tmpContext.shadowBlur = 15;
        tmpContext.shadowColor = `rgba(0, 0, 0, 0.35)`
        if (obj.name == "apple") {
            tmpContext.fillStyle = "#c15555";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#89a54c";
            let leafDir = -(Math.PI / 2);
            renderLeaf(
                obj.scale * Math.cos(leafDir),
                obj.scale * Math.sin(leafDir),
                25,
                leafDir + Math.PI / 2,
                tmpContext
            );
        } else if (obj.name == "cookie") {
            tmpContext.fillStyle = "#cca861";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#937c4b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = UWUTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                renderCircle(
                    tmpRange * Math.cos(rotVal * i),
                    tmpRange * Math.sin(rotVal * i),
                    UWUTILS.randInt(4, 5),
                    tmpContext,
                    true
                );
            }
        } else if (obj.name == "cheese") {
            tmpContext.fillStyle = "#f4f3ac";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fillStyle = "#c3c28b";
            let chips = 4;
            let rotVal = (Math.PI * 2) / chips;
            let tmpRange;
            for (let i = 0; i < chips; ++i) {
                tmpRange = UWUTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                renderCircle(
                    tmpRange * Math.cos(rotVal * i),
                    tmpRange * Math.sin(rotVal * i),
                    UWUTILS.randInt(4, 5),
                    tmpContext,
                    true
                );
            }
        } else if (
            obj.name == "wood wall" ||
            obj.name == "stone wall" ||
            obj.name == "castle wall"
        ) {
            tmpContext.fillStyle =
                obj.name == "castle wall"
                ? "#83898e"
            : obj.name == "wood wall"
                ? "#a5974c"
            : "#939393";
            let sides = obj.name == "castle wall" ? 4 : 3;
            renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle =
                obj.name == "castle wall"
                ? "#9da4aa"
            : obj.name == "wood wall"
                ? "#c9b758"
            : "#bcbcbc";
            renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (
            obj.name == "spikes" ||
            obj.name == "greater spikes" ||
            obj.name == "poison spikes" ||
            obj.name == "spinning spikes"
        ) {
            tmpContext.fillStyle =
                obj.name == "poison spikes" ? "#7b935d" : "#939393";
            let tmpScale = obj.scale * 0.6;
            renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (
            obj.name == "windmill" ||
            obj.name == "faster windmill" ||
            obj.name == "power mill"
        ) {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, reScale, tmpContext);
            tmpContext.fillStyle = "#c9b758";
            renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, reScale * 0.5, tmpContext);
        } else if (obj.name == "mine") {
            tmpContext.fillStyle = "#939393";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#bcbcbc";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "sapling") {
            for (let i = 0; i < 2; ++i) {
                let tmpScale = obj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
                tmpContext.fill();
                if (!i) tmpContext.stroke();
            }
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = outlineColor;
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        } else if (obj.name == "boost pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#dbd97d";
            renderTriangle(obj.scale * 1, tmpContext);
        } else if (obj.name == "turret") {
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#939393";
            let tmpLen = 50;
            renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
        } else if (obj.name == "platform") {
            tmpContext.fillStyle = "#cebd5f";
            let tmpCount = 4;
            let tmpS = obj.scale * 2;
            let tmpW = tmpS / tmpCount;
            let tmpX = -(obj.scale / 2);
            for (let i = 0; i < tmpCount; ++i) {
                renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpX += tmpS / tmpCount;
            }
        } else if (obj.name == "healing pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "spawn pad") {
            tmpContext.fillStyle = "#7e7f82";
            renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#71aad6";
            renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        } else if (obj.name == "blocker") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#db6e6e";
            renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
        } else if (obj.name == "teleporter") {
            tmpContext.fillStyle = "#7e7f82";
            renderCircle(0, 0, obj.scale, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.rotate(Math.PI / 4);
            tmpContext.fillStyle = "#d76edb";
            renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
        }
        tmpSprite = tmpCanvas;
        if (!asIcon) itemSprites[obj.id] = tmpSprite;
    }
    return tmpSprite;
}

function getItemSprite2(obj, tmpX, tmpY) {
    let tmpContext = mainContext;
    let reScale = obj.name == "windmill" ? items.list[4].scale : obj.scale;
    tmpContext.save();
    tmpContext.translate(tmpX, tmpY);
    tmpContext.rotate(obj.dir);
    tmpContext.strokeStyle = outlineColor;
    tmpContext.lineWidth = outlineWidth;
    tmpContext.shadowBlur = 15;
    tmpContext.shadowColor = `rgba(0, 0, 0, 0.35)`
    if (obj.name == "apple") {
        tmpContext.fillStyle = "#c15555";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#89a54c";
        let leafDir = -(Math.PI / 2);
        renderLeaf(
            obj.scale * Math.cos(leafDir),
            obj.scale * Math.sin(leafDir),
            25,
            leafDir + Math.PI / 2,
            tmpContext
        );
    } else if (obj.name == "cookie") {
        tmpContext.fillStyle = "#cca861";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#937c4b";
        let chips = 4;
        let rotVal = (Math.PI * 2) / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UWUTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(
                tmpRange * Math.cos(rotVal * i),
                tmpRange * Math.sin(rotVal * i),
                UWUTILS.randInt(4, 5),
                tmpContext,
                true
            );
        }
    } else if (obj.name == "cheese") {
        tmpContext.fillStyle = "#f4f3ac";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#c3c28b";
        let chips = 4;
        let rotVal = (Math.PI * 2) / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UWUTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(
                tmpRange * Math.cos(rotVal * i),
                tmpRange * Math.sin(rotVal * i),
                UWUTILS.randInt(4, 5),
                tmpContext,
                true
            );
        }
    } else if (
        obj.name == "wood wall" ||
        obj.name == "stone wall" ||
        obj.name == "castle wall"
    ) {
        tmpContext.fillStyle =
            obj.name == "castle wall"
            ? "#83898e"
        : obj.name == "wood wall"
            ? "#a5974c"
        : "#939393";
        let sides = obj.name == "castle wall" ? 4 : 3;
        renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle =
            obj.name == "castle wall"
            ? "#9da4aa"
        : obj.name == "wood wall"
            ? "#c9b758"
        : "#bcbcbc";
        renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    } else if (
        obj.name == "spikes" ||
        obj.name == "greater spikes" ||
        obj.name == "poison spikes" ||
        obj.name == "spinning spikes"
    ) {
        tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
        let tmpScale = obj.scale * 0.6;
        renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, tmpScale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderCircle(0, 0, tmpScale / 2, tmpContext, true);
    } else if (
        obj.name == "windmill" ||
        obj.name == "faster windmill" ||
        obj.name == "power mill"
    ) {
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, reScale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, reScale * 0.5, tmpContext);
    } else if (obj.name == "mine") {
        tmpContext.fillStyle = "#939393";
        renderStar(tmpContext, 3, obj.scale, obj.scale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#bcbcbc";
        renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
        tmpContext.fill();
    } else if (obj.name == "sapling") {
        for (let i = 0; i < 2; ++i) {
            let tmpScale = obj.scale * (!i ? 1 : 0.5);
            renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
            tmpContext.fillStyle = !i ? "#9ebf57" : "#b4db62";
            tmpContext.fill();
            if (!i) tmpContext.stroke();
        }
    } else if (obj.name == "pit trap") {
        tmpContext.fillStyle = "#a5974c";
        renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = outlineColor;
        renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    } else if (obj.name == "boost pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#dbd97d";
        renderTriangle(obj.scale * 1, tmpContext);
    } else if (obj.name == "turret") {
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#939393";
        let tmpLen = 50;
        renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
    } else if (obj.name == "platform") {
        tmpContext.fillStyle = "#cebd5f";
        let tmpCount = 4;
        let tmpS = obj.scale * 2;
        let tmpW = tmpS / tmpCount;
        let tmpX = -(obj.scale / 2);
        for (let i = 0; i < tmpCount; ++i) {
            renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpX += tmpS / tmpCount;
        }
    } else if (obj.name == "healing pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (obj.name == "spawn pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#71aad6";
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
    } else if (obj.name == "blocker") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (obj.name == "teleporter") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#d76edb";
        renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
    }
    tmpContext.restore();
}

let objSprites = [];

function getObjSprite(obj) {
    let tmpSprite = objSprites[obj.id];
    if (!tmpSprite) {
        // let blurScale = isNight ? 20 : 0;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height =
            obj.scale * 2.5 +
            outlineWidth +
            (items.list[obj.id].spritePadding || 0) +
            0;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(Math.PI / 2);
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        tmpContext.shadowBlur = 15;
        tmpContext.shadowColor = `rgba(0, 0, 0, 0.35)`
        // if (isNight) {
        //     tmpContext.shadowBlur = 20;
        //     tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
        // }
        if (
            obj.name == "spikes" ||
            obj.name == "greater spikes" ||
            obj.name == "poison spikes" ||
            obj.name == "spinning spikes"
        ) {
            tmpContext.fillStyle =
                obj.name == "poison spikes" ? "#7b935d" : "#939393";
            let tmpScale = obj.scale * 0.6;
            renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#cc5151";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#cc5151";
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        objSprites[obj.id] = tmpSprite;
    }
    return tmpSprite;
}

// GET MARK SPRITE:
function getMarkSprite(obj, tmpContext, tmpX, tmpY) {
    tmpContext.save();
    tmpContext.lineWidth = outlineWidth;
    mainContext.globalAlpha = 0.2;
    tmpContext.strokeStyle = outlineColor;
    tmpContext.translate(tmpX, tmpY);
    tmpContext.rotate(obj.dir);
    if (
        obj.name == "spikes" ||
        obj.name == "greater spikes" ||
        obj.name == "poison spikes" ||
        obj.name == "spinning spikes"
    ) {
        tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
        let tmpScale = obj.scale * 0.6;
        renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, tmpScale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderCircle(0, 0, tmpScale / 2, tmpContext, true);
    } else if (obj.name == "turret") {
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#939393";
        let tmpLen = 50;
        renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
    } else if (obj.name == "teleporter") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#d76edb";
        renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
    } else if (obj.name == "platform") {
        tmpContext.fillStyle = "#cebd5f";
        let tmpCount = 4;
        let tmpS = obj.scale * 2;
        let tmpW = tmpS / tmpCount;
        let tmpX = -(obj.scale / 2);
        for (let i = 0; i < tmpCount; ++i) {
            renderRect(tmpX - tmpW / 2, 0, tmpW, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpX += tmpS / tmpCount;
        }
    } else if (obj.name == "healing pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (obj.name == "spawn pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#71aad6";
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
    } else if (obj.name == "blocker") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (
        obj.name == "windmill" ||
        obj.name == "faster windmill" ||
        obj.name == "power mill"
    ) {
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, obj.scale * 0.5, tmpContext);
    } else if (obj.name == "pit trap") {
        tmpContext.fillStyle = "#a5974c";
        renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = outlineColor;
        renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    }
    tmpContext.restore();
}

// RENDER GAME OBJECTS:
function renderGameObjects(xOffset, yOffset) {
    let tmpSprite;
    let tmpX;
    let tmpY;
    let render = renderObj
    for (let i = 0; i < render.length; i++) {
        let tmpObj = render[i];
        tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
        tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
        tmpObj.update(delta);
        mainContext.globalAlpha = tmpObj.alpha;
            if (tmpObj.isItem) {
                if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
                    tmpSprite = getObjSprite(tmpObj);
                } else {
                    tmpSprite = getItemSprite(tmpObj);
                }

                mainContext.save();
                mainContext.translate(tmpX, tmpY);
                mainContext.rotate(tmpObj.dir);
                mainContext.drawImage(
                    tmpSprite,
                    -(tmpSprite.width / 2),
                    -(tmpSprite.height / 2)
                );

                if (tmpObj.blocker) {
                    mainContext.strokeStyle = "#db6e6e";
                    mainContext.globalAlpha = 0.3;
                    mainContext.lineWidth = 6;
                    renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                }
                mainContext.restore();
            } else {
                if (tmpObj.type == 0) {
                    if (UWUTILS.getDist(tmpObj, player, 0, 0) <= 400 && tmpObj.alpha > 0.5) {
                        tmpObj.alpha -= 0.02
                    } else if (tmpObj.alpha < 1) {
                        tmpObj.alpha += 0.02
                    }
                }
                mainContext.globalAlpha = tmpObj.alpha;
                tmpSprite = getResSprite(tmpObj);
                if (tmpObj.type === 4) {
                    drawVolcano(mainContext, tmpX, tmpY);
                } else {
                    mainContext.drawImage(
                        tmpSprite,
                        tmpX - tmpSprite.width / 2,
                        tmpY - tmpSprite.height / 2
                    );
                }
            }
        if (tmpObj.type === null) {
            // HEALTH HOLDER:
            if (hacking && tmpObj.dist2 <= 500) {
                mainContext.fillStyle = darkOutlineColor;
                mainContext.roundRect(
                    tmpX - config.healthBarWidth / 2 - config.healthBarPad,
                    tmpY - config.healthBarPad,
                    config.healthBarWidth + config.healthBarPad * 2,
                    17,
                    8
                );
                mainContext.fill();

                // HEALTH BAR:
                mainContext.fillStyle =
                    tmpObj.owner && tmpObj.owner.sid == player.sid
                    ? "#489c7c"
                : tmpObj.isTeamObject(player)
                    ? "#fceb65"
                : "#cc5151";
                mainContext.roundRect(
                    tmpX - config.healthBarWidth / 2,
                    tmpY,
                    config.healthBarWidth * (tmpObj.health / tmpObj.maxHealth),
                    17 - config.healthBarPad * 2,
                    7
                );
                mainContext.fill();
            }
            let owner = findPlayerBySID(tmpObj.owner.sid);
            if (owner && tmpObj.dist2 <= 500) {
                let tmpText = owner.name //+ (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
                mainContext.font = "20px Hammersmith One";
                mainContext.fillStyle = "#fff";
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = 5.5;
                mainContext.lineJoin = "round";
                mainContext.strokeText(
                    tmpText,
                    tmpX,
                    tmpY - 7
                );
                mainContext.fillText(
                    tmpText,
                    tmpX,
                    tmpY - 7
                );
            }
        }
    }

    // PLACE VISIBLE:
    for (let i = 0; i < placeVisible.length; i++) {
        let places = placeVisible[i];
        tmpX = places.x - xOffset;
        tmpY = places.y - yOffset;
        markObject(places, tmpX, tmpY);
    }
}

function markObject(tmpObj, tmpX, tmpY) {
    getMarkSprite(tmpObj, mainContext, tmpX, tmpY);
}

// RENDER MINIMAP:
class MapPing {
    constructor(color, scale) {
        this.init = function (x, y) {
            this.scale = 0;
            this.x = x;
            this.y = y;
            this.active = true;
        };
        this.update = function (ctxt, dlta) {
            if (this.active) {
                this.scale += 0.05 * dlta;
                if (this.scale >= scale) {
                    this.active = false;
                } else {
                    ctxt.globalAlpha = 1 - Math.max(0, this.scale / scale);
                    ctxt.beginPath();
                    ctxt.arc(
                        (this.x / config.mapScale) * mapDisplay.width,
                        (this.y / config.mapScale) * mapDisplay.width,
                        this.scale,
                        0,
                        2 * Math.PI
                    );
                    ctxt.stroke();
                }
            }
        };
        this.color = "#ff82c1";
    }
}
function getBorderColor() {
    if (configs.pinkUI) {
        return "#ff9cfb";
    } else return "rgba(255, 255, 255, 0.8)";
}
function getBackgroundColor() {
    if (configs.pinkUI) {
        return "rgb(93 0 131 / 40%)";
    } else return "rgba(0, 0, 0, 0.7)";
}
function pingMap(x, y) {
    tmpPing = mapPings.find2((pings) => !pings.active);
    if (!tmpPing) {
        tmpPing = new MapPing("#fff", config.mapPingScale);
        mapPings.push(tmpPing);
    }
    tmpPing.init(x, y);
}

function updateMapMarker() {
    mapMarker.x = player.x;
    mapMarker.y = player.y;
}

function renderMinimap(dlta) {
    if (player && player.alive) {
        mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

        // RENDER PINGS:
        mapContext.lineWidth = 4;
        for (let i = 0; i < mapPings.length; ++i) {
            tmpPing = mapPings[i];
            mapContext.strokeStyle = tmpPing.color;
            tmpPing.update(mapContext, dlta);
        }

        // RENDER BREAK TRACKS:
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#ff0000";
        if (breakTrackers.length) {
            mapContext.fillStyle = "#abcdef";
            mapContext.font = "34px Lilita One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            for (let i = 0; i < breakTrackers.length; ) {
                mapContext.fillText(
                    "!",
                    (breakTrackers[i].x / config.mapScale) * mapDisplay.width,
                    (breakTrackers[i].y / config.mapScale) * mapDisplay.height
                );
                i += 2;
            }
        }

        // RENDER PLAYERS:
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = configs.pinkUI ? "#ff82c1" : "rgb(200, 200, 200";
        renderCircle(
            (player.x / config.mapScale) * mapDisplay.width,
            (player.y / config.mapScale) * mapDisplay.height,
            7,
            mapContext,
            true
        );
        mapContext.fillStyle = configs.pinkUI ? "rgba(255, 130, 193, 0.35)" : "rgb(100, 100, 100";
        if (player.team && minimapData) {
            for (let i = 0; i < minimapData.length; ) {
                renderCircle(
                    (minimapData[i] / config.mapScale) * mapDisplay.width,
                    (minimapData[i + 1] / config.mapScale) * mapDisplay.height,
                    7,
                    mapContext,
                    true
                );
                i += 2;
            }
        }
        // DEATH LOCATION:
        if (lastDeath) {
            mapContext.fillStyle = "#bd0d5f";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText(
                "x",
                (lastDeath.x / config.mapScale) * mapDisplay.width,
                (lastDeath.y / config.mapScale) * mapDisplay.height
            );
        }

        // MAP MARKER:
        if (mapMarker) {
            mapContext.fillStyle = configs.pinkUI ? "#ffadd3" : "rgb(200, 200, 200";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText(
                "x",
                (mapMarker.x / config.mapScale) * mapDisplay.width,
                (mapMarker.y / config.mapScale) * mapDisplay.height
            );
        }
    }
}

// ICONS:
let crossHair =
    "https://i.postimg.cc/Hn5QKCDZ/wmremove-transformed-removebg-preview-1.png";
let crossHairSprite = {};
let iconSprites = {};
let icons = ["crown", "skull"];

function loadIcons() {
    for (let i = 0; i < icons.length; ++i) {
        let tmpSprite = new Image();
        tmpSprite.onload = function () {
            this.isLoaded = true;
        };
        tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
        iconSprites[icons[i]] = tmpSprite;
    }
    let tmpSprite = new Image();
    tmpSprite.onload = function () {
        crossHairSprite.isLoaded = true;
    };
    tmpSprite.src = crossHair;
    crossHairSprite = tmpSprite;
}
loadIcons();

function cdf(e, t) {
    try {
        return hypot(
            (t.y2 || t.y) - (e.y2 || e.y),
            (t.x2 || t.x) - (e.x2 || e.x)
        );
    } catch (e) {
        return Infinity;
    }
}
function moveCamera() {
    if (player) {
        const tmpDist = UWUTILS.getDistance(camX, camY, player.x, player.y);
        const tmpDir = UWUTILS.getDirection(player.x, player.y, camX, camY);
        const camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
        if (tmpDist > 0.05) {
            camX += camSpd * Math.cos(tmpDir);
            camY += camSpd * Math.sin(tmpDir);
        } else {
            camX = player.x;
            camY = player.y;
        }
    } else {
        camX = config.mapScale / 2 + config.riverWidth;
        camY = config.mapScale / 2;
    }
}
function interPolate(xOffset, yOffset) {
    let lastTime = now - game.tickSpeed;
    let tmpDiff;
    for (let i = 0; i < players.length + ais.length; ++i) {
        let tmpObj = players[i] || ais[i - players.length];
        if (tmpObj && tmpObj.visible) {
            if (tmpObj.forcePos) {
                tmpObj.x = tmpObj.x2;
                tmpObj.y = tmpObj.y2;
                tmpObj.dir = tmpObj.d2;
            } else {
                let total = tmpObj.t2 - tmpObj.t1;
                let fraction = lastTime - tmpObj.t1;
                let ratio = fraction / total;
                tmpObj.dt += delta;
                let tmpRate = Math.min(1.7, tmpObj.dt / 170);
                tmpDiff = tmpObj.x2 - tmpObj.x1;
                tmpObj.x = tmpObj.x1 + tmpDiff * tmpRate;
                let tmpDiff2 = tmpObj.y2 - tmpObj.y1;
                tmpObj.y = tmpObj.y1 + tmpDiff2 * tmpRate;
                tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
            }
            tmpObj.relativeX = tmpObj.x - xOffset;
            tmpObj.relativeY = tmpObj.y - yOffset;
        }
    }
}
function drawBackground(xOffset, yOffset) {
    if (configs.customBackground) {
        mainContext.drawImage(backgroundVideo, 0, 0, maxScreenWidth, maxScreenHeight);
        backgroundVideo.play();
    } else {
        if (
            config.snowBiomeTop - yOffset <= 0 &&
            config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight
        ) {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= 0) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(
                0,
                config.snowBiomeTop - yOffset,
                maxScreenWidth,
                maxScreenHeight - (config.snowBiomeTop - yOffset)
            );
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(
                0,
                0,
                maxScreenWidth,
                config.mapScale - config.snowBiomeTop - yOffset
            );
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(
                0,
                config.mapScale - config.snowBiomeTop - yOffset,
                maxScreenWidth,
                maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset)
            );
        }

        // RENDER WATER AREAS:
        if (!firstSetup) {
            waterMult += waterPlus * config.waveSpeed * delta;
            if (waterMult >= config.waveMax) {
                waterMult = config.waveMax;
                waterPlus = -1;
            } else if (waterMult <= 1) {
                waterMult = waterPlus = 1;
            }
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#dbc666";
            renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
            mainContext.fillStyle = "#91b2db";
            renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
        }
    }
}
function renderVolcanoDamageZone(xOffset, yOffset) {
    mainContext.globalAlpha = 1;
    mainContext.beginPath();
    mainContext.lineWidth = 4;
    mainContext.strokeStyle = "rgba(255, 0, 0, 0.5)";
    mainContext.arc(13960 - xOffset, 13960 - yOffset, 1440, Math.PI * 0.901, Math.PI * 1.599);
    mainContext.stroke();
    mainContext.strokeStyle = "rgba(255, 0, 0, 0.3)";
    mainContext.moveTo(12520, 14400)
    mainContext.lineTo(12520, 12520)
    mainContext.lineTo(14400, 12520)
    mainContext.stroke();
}
function renderAIs(xOffset, yOffset) {
    for (let i = 0; i < ais.length; ++i) {
        let tmpObj = ais[i];
        if (tmpObj.active && tmpObj.visible) {
            tmpObj.animate(delta);
            mainContext.save();
            mainContext.translate(tmpObj.relativeX, tmpObj.relativeY);
            mainContext.rotate(tmpObj.dir - Math.PI / 2);
            renderAI(tmpObj, mainContext);
            mainContext.restore();
        }
    }
}
function drawGrid(xOffset, yOffset) {
    if (!configs.showGrid) return;
        mainContext.lineWidth = 3;
        mainContext.strokeStyle = "#000";
        mainContext.globalAlpha = 0.05;
        mainContext.beginPath();
        let ratfrr = 60;
        for (var x = -xOffset % ratfrr; x < maxScreenWidth; x += ratfrr) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, maxScreenHeight);
            }
        }
        for (var y = -yOffset % ratfrr; y < maxScreenHeight; y += ratfrr) {
            if (y > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(maxScreenWidth, y);
            }
        }
        mainContext.stroke();
}
function renderMapBoundaries(xOffset, yOffset) {
    mainContext.fillStyle = "#000";
    mainContext.globalAlpha = 0.09;
    if (xOffset <= 0) {
        mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
    }
    if (config.mapScale - xOffset <= maxScreenWidth) {
        let tmpY = Math.max(0, -yOffset);
        mainContext.fillRect(
            config.mapScale - xOffset,
            tmpY,
            maxScreenWidth - (config.mapScale - xOffset),
            maxScreenHeight - tmpY
        );
    }
    if (yOffset <= 0) {
        mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
    }
    if (config.mapScale - yOffset <= maxScreenHeight) {
        let tmpX = Math.max(0, -xOffset);
        let tmpMin = 0;
        if (config.mapScale - xOffset <= maxScreenWidth)
            tmpMin = maxScreenWidth - (config.mapScale - xOffset);
        mainContext.fillRect(
            tmpX,
            config.mapScale - yOffset,
            maxScreenWidth - tmpX - tmpMin,
            maxScreenHeight - (config.mapScale - yOffset)
        );
    }
}
function renderShaders() {
    mainContext.globalAlpha = 1;
    if (configs.nightMode) {
        mainContext.fillStyle = "rgba(10, 0, 70, 0.6)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (configs.darkMode) {
        mainContext.fillStyle = "rgba(15, 0, 50, 0.5)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else {
        mainContext.fillStyle = "rgba(15, 0, 70, 0.39)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    }
}
function renderEntityExtras() {
    mainContext.strokeStyle = darkOutlineColor;
    mainContext.globalAlpha = 1;
    if (player && autoQuadSpike) {
        if (nearestTeammate) {
            mainContext.save();
            mainContext.strokeStyle ="rgb(92, 0, 0)";
            renderCircle(
                nearestTeammate.relativeX,
                nearestTeammate.relativeY,
                40,
                mainContext,
                false,
                true
            );
        }
    }
    for (let i = 0; i < players.length + ais.length; ++i) {
        const tmpObj = players[i] || ais[i - players.length];
        const middleX = tmpObj.relativeX;
        const middleY = tmpObj.relativeY;
        if (tmpObj.visible) {
            mainContext.globalAlpha = ((tmpObj.sid == player.sid && !tmpObj.visible) ? 0.5 : tmpObj.opacity);
            mainContext.strokeStyle = darkOutlineColor;

            // NAME AND HEALTH:
            let tmpText = tmpObj.displayText;
            let nameX = tmpObj.team + " " || "";
            if (tmpText != "") {
                mainContext.font = (tmpObj.nameScale || (configs.bigNames ? 50 : 25)) + "px Lilita One";
                mainContext.fillStyle = `rgba(255, 255, 255, 0.8)`;
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = 5.5;
                mainContext.lineJoin = "round";
                let tmpW = tmpObj.team ? mainContext.measureText(nameX).width : 0;
                mainContext.font = (tmpObj.nameScale || (configs.bigNames ? 55 : 30)) + "px Lilita One";
                let tmpW2 = mainContext.measureText(tmpText).width;
                const xPos = (tmpObj.team ? middleX + tmpW: middleX);
                const yPos = middleY - tmpObj.scale - config.nameY - 10;
                mainContext.strokeText(
                    tmpText,
                    xPos,
                    yPos
                );
                mainContext.fillText(
                    tmpText,
                    xPos,
                    yPos
                );
                mainContext.font = (tmpObj.nameScale || (configs.bigNames ? 50 : 25)) + "px Lilita One";
                if (tmpObj.team) {
                    const xPos2 = middleX - (tmpW2 + tmpW) / 2
                    mainContext.strokeText(
                        nameX,
                        xPos2,
                        yPos
                    );
                    mainContext.fillText(
                        nameX,
                        xPos2,
                        yPos
                    );
                }
                const iconStart = middleX - tmpS / 2
                if (tmpObj.isLeader && iconSprites.crown.isLoaded) {
                    const tmpS = config.crownIconScale;
                    const tmpX = iconStart - mainContext.measureText(tmpText).width / 2;
                    mainContext.drawImage(
                        iconSprites.crown,
                        tmpX,
                        middleY - tmpObj.scale - config.nameY - tmpS / 2 - 45,
                        tmpS,
                        tmpS
                    );
                }
                if (tmpObj.iconIndex == 1 && iconSprites.skull.isLoaded) {
                    const tmpS = config.crownIconScale;
                    let tmpX = iconStart + mainContext.measureText(tmpText).width / 2 + config.crownPad;
                    mainContext.drawImage(
                        iconSprites.skull,
                        tmpX,
                        middleY - tmpObj.scale - config.nameY - tmpS / 2 - 10,
                        tmpS,
                        tmpS
                    );
                }
                if (
                    tmpObj.isPlayer &&
                    (shameInsta || waitInsta) &&
                    nearHacker == tmpObj &&
                    crossHairSprite.isLoaded &&
                    enemy.length
                ) {
                    mainContext.drawImage(
                        crossHairSprite,
                        middleX - 60,
                        middleY - 58,
                        120,
                        120
                    );
                }
            }
            if (tmpObj.health > 0) {
                let barWidth = (tmpObj.width * tmpObj.health) / 100;
                mainContext.fillRect(
                    middleX,
                    middleY -
                    tmpObj.scale -
                    config.nameY -
                    tmpObj.scale -
                    10,
                    barWidth,
                    10
                );
                // HEALTH HOLDER:
                mainContext.fillStyle = darkOutlineColor;
                mainContext.roundRect(
                    middleX - config.healthBarWidth - config.healthBarPad,
                    middleY + tmpObj.scale + config.nameY,
                    config.healthBarWidth * 2 + config.healthBarPad * 2,
                    17,
                    8
                );
                mainContext.fill();

                // HEALTH BAR:
                mainContext.fillStyle =
                    tmpObj == player || (tmpObj.team && tmpObj.team == player.team)
                    ? "#8ecc51"
                : "#cc5151";
                mainContext.roundRect(
                    middleX - config.healthBarWidth,
                    middleY +
                    tmpObj.scale +
                    config.nameY +
                    config.healthBarPad,
                    config.healthBarWidth * 2 * (tmpObj.health / tmpObj.maxHealth),
                    17 - config.healthBarPad * 2,
                    7
                );
                mainContext.fill();
            }

            if (tmpObj.isPlayer) {
                mainContext.globalAlpha = 1;
                // SHAME COUNT:
                tmpObj.updateShameTimer()
                mainContext.globalAlpha = ((tmpObj.sid == player.sid && !tmpObj.visible) ? 0.5 : tmpObj.opacity);
                mainContext.font = "35px Starjedi One";
                mainContext.fillStyle = configs.pinkUI ? "pink" : "white";
                let gegagedigedagedago = tmpObj.shameCount;
                if (tmpObj.shameTimer === 0) {
                    mainContext.fillStyle = `rgb(${gegagedigedagedago > 5 ? "100" : "255"}, ${gegagedigedagedago > 4 ? "0, 0" : "255, 255"})`;
                } else {
                    gegagedigedagedago = (Math.round(tmpObj.shameTimer * 10)) / 10;
                }
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = 5.5;
                mainContext.lineJoin = "round";
                var tmpS = config.crownIconScale;
                mainContext.strokeText(
                    gegagedigedagedago,
                    middleX,
                    middleY - 45
                );
                mainContext.fillText(
                    gegagedigedagedago,
                    middleX,
                    middleY - 45
                );
                if (tmpObj.sid == player.sid) {
                    mainContext.font = "25px Lilita One";
                    let tmpY = middleY + tmpObj.scale + config.nameY - 15;
                    mainContext.fillStyle = "white";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = 5.5;
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(potential, middleX, tmpY);
                    mainContext.fillText(potential, middleX, tmpY);
                } else {
                    if (tmpObj.hacker) {
                        mainContext.font = "25px Lilita One";
                        let tmpY = middleY + tmpObj.scale + config.nameY + 15;
                        mainContext.strokeText(Math.round(tmpObj.pinge), middleX, tmpY);
                        mainContext.fillText(Math.round(tmpObj.pinge), middleX, tmpY);
                        mainContext.font = "35px Lilita One";
                        mainContext.fillStyle = configs.pinkUI ? "pink" : "rgb(200, 200, 200)";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = 5.5;
                        mainContext.lineJoin = "round";
                        mainContext.strokeText(
                            tmpObj.guessHack ?? "Hacker",
                            middleX,
                            middleY + tmpObj.scale + config.nameY + 35
                        );
                        mainContext.fillText(
                            tmpObj.guessHack ?? "Hacker",
                            middleX,
                            middleY + tmpObj.scale + config.nameY + 35
                        );
                    } else if (tmpObj.macroing) {
                        mainContext.font = "35px Lilita One";
                        mainContext.fillStyle = configs.pinkUI ? "pink" : "rgb(200, 200, 200)";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = 5.5;
                        mainContext.lineJoin = "round";
                        mainContext.strokeText(
                            "Macroer",
                            middleX,
                            middleY + tmpObj.scale + config.nameY + 35
                        );
                        mainContext.fillText(
                            "Macroer",
                            middleX,
                            middleY + tmpObj.scale + config.nameY + 35
                        );
                    }
                }
            }
        }
    }
    mainContext.globalAlpha = 1
}
function renderChats() {
    for (let i = 0; i < players.length; ++i) {
        let tmpObj = players[i];
        if (tmpObj.visible) {
            if (tmpObj.chatCountdown > 0) {
                tmpObj.chatCountdown -= delta;
                if (tmpObj.chatCountdown <= 0) tmpObj.chatCountdown = 0;
                mainContext.font = "32px Lilita One";
                let tmpSize = mainContext.measureText(tmpObj.chatMessage);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                let tmpX = tmpObj.relativeX;
                let tmpY = tmpObj.relativeY - 125;
                let tmpH = 47;
                let tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#fff";
                mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
            }
            if (tmpObj.chat.count > 0) {
                tmpObj.chat.count -= delta;
                if (tmpObj.chat.count <= 0) tmpObj.chat.count = 0;
                mainContext.font = "32px Lilita One";
                let tmpSize = mainContext.measureText(tmpObj.chat.message);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                let tmpX = tmpObj.relativeX;
                let tmpY = tmpObj.relativeY + 55 * 2;
                let tmpH = 47;
                let tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#ffffff99";
                mainContext.fillText(tmpObj.chat.message, tmpX, tmpY);
            } else {
                tmpObj.chat.count = 0;
            }
        }
    }
}
function renderFrameCircle() {
    if (circle1.length) {
        for (let i = 0;i < circle1.length;i++) {
            const tmpPlayer = circle1[i];
            mainContext.globalAlpha = 1;
            mainContext.beginPath();
            mainContext.lineWidth = 5;
            const gradient = mainContext.createRadialGradient(tmpPlayer.relativeX, tmpPlayer.relativeY, 25, tmpPlayer.relativeX, tmpPlayer.relativeY, 80);
            gradient.addColorStop(0, "red");
            gradient.addColorStop(0.4, "rgba(0, 0, 0, 1)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            mainContext.strokeStyle = gradient;
            mainContext.arc(player.relativeX, player.relativeY, player.frameDist, 0, Math.PI * 2);
            mainContext.stroke();
        }
    }
    if (circle2.length) {
        for (let i = 0;i < circle2.length;i++) {
            let tmpPlayer = circle2[i];
            mainContext.globalAlpha = 1;
            mainContext.beginPath();
            mainContext.lineWidth = 6;
            const gradient = mainContext.createRadialGradient(tmpPlayer.relativeX, tmpPlayer.relativeY, 25, tmpPlayer.relativeX, tmpPlayer.relativeY, 80);
            gradient.addColorStop(0, configs.pinkUI ? "pink" : "rgb(200, 200, 200");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
            mainContext.strokeStyle = gradient;
            mainContext.arc(player.relativeX, player.relativeY, 238, 0, Math.PI * 2);
            mainContext.stroke();
        }
    }
}
// UPDATE GAME:
function updateGame() {
    mainContext.globalAlpha = 1;

    // MOVE CAMERA:
    moveCamera()
    const xOffset = camX - maxScreenWidth / 2;
    const yOffset = camY - maxScreenHeight / 2;
    // INTERPOLATE PLAYERS AND AI:
    interPolate(xOffset, yOffset)
    // RENDER CORDS:

    // RENDER BACKGROUND
    drawBackground(xOffset, yOffset)

    // VOLCANO DAMAGE ZONE:
    renderVolcanoDamageZone(xOffset, yOffset);

    // RENDER DEAD PLAYERS:
    renderDeadPlayers(xOffset, yOffset);

    // RENDER PROJECTILES:
    mainContext.globalAlpha = 1;
    mainContext.lineWidth = outlineWidth;
    // RENDER PLAYERS:
    renderPlayers(xOffset, yOffset, 0);
    // RENDER AI:
    mainContext.globalAlpha = 1;
    renderAIs(xOffset, yOffset);
    // RENDER GRID:
    drawGrid(xOffset, yOffset)
    renderGameObjects(xOffset, yOffset);
    renderProjectiles(1, xOffset, yOffset);
    renderPlayers(xOffset, yOffset, 1);

    // MAP BOUNDARIES:
    renderMapBoundaries(xOffset, yOffset);

    // RENDER DAY/NIGHT TIME:
    renderShaders();

    // RENDER PLAYER AND AI UI:
    renderEntityExtras(xOffset, yOffset)

    mainContext.globalAlpha = 1;

    // RENDER ANIM TEXTS:
    textManager.update(delta, mainContext, xOffset, yOffset);

    // RENDER CHAT MESSAGES:
    renderChats(xOffset, yOffset);

    mainContext.globalAlpha = 1;

    // RENDER MINIMAP:
    renderMinimap(delta);
    // FRAME CIRCLE:
    renderFrameCircle(xOffset, yOffset);
}

// UPDATE & ANIMATE:
window.requestAnimFrame = function () {
    return null;
};
window.rAF = (function () {
    return (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        }
    );
})();
let chActive = true;
const fpsEl = getEl("pingFps");
const packetEl = getEl("packetStatus");
function doUpdate() {
    //rape modulus
    now = performance.now();
    delta = now - lastUpdate;
    lastUpdate = now;
    requestAnimationFrame(doUpdate);
    const diff = now - fpsTimer.last;
    if (diff >= 1000) {
        fpsTimer.ltime = fpsTimer.time * (1000 / diff);
        fpsTimer.last = now;
        fpsTimer.time = 0;
    }
    fpsTimer.time++;
    if (!document.hidden) {
        fpsEl.textContent = `${window.pingTime}ms | Fps: ${Math.round(fpsTimer.ltime)}`;
        packetEl.textContent = secPacket;
    }
    if (configs.astolfoMap) {
        if (inGame && configs.astolfoMap) {
            if (astolfoTheSecond.style.display !== "block") {
                astolfoTheSecond.style.display = "block";
            }
        } else if (astolfoTheSecond.style.display !== "none") {
            astolfoTheSecond.style.display = "none";
        }
    } else if (astolfoTheSecond.style.display !== "none") {
            astolfoTheSecond.style.display = "none";
        }
    if (inGame) {
        if (!chActive && chMainDiv) {
            chActive = true;
            menuChatDiv.style.color = "#fff";
            menuChatDiv.style.position = "absolute";
            menuChatDiv.style.display = "block";
            menuChatDiv.style.left = "-1px";
            menuChatDiv.style.top = "0px";
            menuChatDiv.style.boxShadow = "0px 0px 10px #ffffff";
        }
    } else {
        if (chActive && chMainDiv) {
            chActive = false;
            setupCard.style.position = "relative";
            menuChatDiv.style.boxShadow = "none";
            menuChatDiv.style.display = "block";
            menuChatDiv.style.position = "absolute";
            menuChatDiv.style.marginBottom = "10px";
            menuChatDiv.style.left = "50%";
            menuChatDiv.style.transform = "translateX(-50%)";
            menuChatDiv.style.width = "500px";
            menuChatDiv.style.height = "515px";
            menuChatDiv.style.top = "200px";

            chMainDiv.style.width = "495px";
            chMainDiv.style.height = "500px";

            setupCard.appendChild(menuChatDiv);
            $("#menuChatDiv").show();
        }
    }

    updateGame();
    ms.avg = Math.round((ms.min + ms.max) / 2);
}

prepareMenuBackground();
doUpdate();

function toggleUseless(boolean) {
    getEl("instaType").disabled = boolean;
    getEl("predictType").disabled = boolean;
}
toggleUseless(useWasd);

let changeDays = {};

window.debug = function () {
    autoGathering = false;
    manualAutoGather = false;
    my.waitHit = 0;
    noWep = false;
    my.noAim = 0;
    my.anti0tick = 0;
    soldierBreaking = false;
    noPlacers = false;
    my.autoAim = 0;
    noHat = false;
    oneTicking = false;
    noMove = false;
    instaC.isTrue = false;
    packet("F", 0, getAttackDir(), 1, "resetHit");
    traps.in = false;
    itemSprites = [];
    objSprites = [];
    gameObjectSprites = [];
    autoBreaker = { active: false, aim: undefined };
    gameObjects = gameObjects.filter2((e) => e.active);
    liztobj = liztobj.filter2((e) => e.active);
    debugLogs = true;
    setTimeout(() => {
        debugLogs = false;
    }, 5000)
};
window.wasdMode = function () {
    useWasd = !useWasd;
    toggleUseless(useWasd);
};
window.resBuild = function () {
};
window.toggleVisual = function () {
    config.anotherVisual = !config.anotherVisual;
    for (let i = 0; i < liztobj.length; i++) {
        let tmp = liztobj[i];
        if (tmp.active) {
            tmp.dir = tmp.lastDir;
        }
    }
};
window.closeChat = undefined;
window.toggleChat = undefined;
function closeChat() {
    chatBox.value = "";
    chatHolder.style.display = "none";
}
function toggleChat() {
    if (chatHolder.style.display == "block") {
        if (chatBox.value) {
            sendChat(chatBox.value);
        }
        closeChat();
    } else {
        storeMenu.style.display = "none";
        allianceMenu.style.display = "none";
        chatHolder.style.display = "block";
        chatBox.focus();
    }
    chatBox.value = "";
}
window.prepareUI = function (tmpObj) {
    resize();
    // CHAT STUFF:
    var chatBox = document.getElementById("chatBox");
    var chatHolder = document.getElementById("chatHolder");
    var suggestBox = document.createElement("div");
    suggestBox.id = "suggestBox";

    var prevChats = [];
    var prevChatsIndex = 0;

    // ACTION BAR:
    UWUTILS.removeAllChildren(actionBar);

    for (let i = 0; i < 39; ++i) {
        (function (i) {
            UWUTILS.generateElement({
                id: "actionBarItem" + i,
                class: "actionBarItem",
                style: "display:none; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5)",
                onmouseout: function () {
                    showItemInfo();
                },
                parent: actionBar,
            });
        })(i);
    }

    for (let j = 0; j < 39; ++j) {
        (function (i) {
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = 66;
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.imageSmoothingEnabled = false;
            tmpContext.webkitImageSmoothingEnabled = false;
            tmpContext.mozImageSmoothingEnabled = false;

            if (items.weapons[i]) {
                tmpContext.rotate(Math.PI * 1.25);
                let tmpSprite = new Image();
                toolSprites[items.weapons[i].src] = tmpSprite;
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                    let tmpPad = 1 / (this.height / this.width);
                    let tmpMlt = items.weapons[i].iPad || 1;
                    tmpContext.drawImage(
                        this,
                        -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2,
                        -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                        tmpCanvas.width * tmpMlt * tmpPad * config.iconPad,
                        tmpCanvas.height * tmpMlt * config.iconPad
                    );
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.2)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(
                        -tmpCanvas.width / 2,
                        -tmpCanvas.height / 2,
                        tmpCanvas.width,
                        tmpCanvas.height
                    );
                    getEl("actionBarItem" + i).style.backgroundImage =
                        "url(" + tmpCanvas.toDataURL() + ")";
                };
                tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                let tmpUnit = getEl("actionBarItem" + i);
                // tmpUnit.onmouseover = UWUTILS.checkTrusted(function () {
                //     showItemInfo(items.weapons[i], true);
                // });
                tmpUnit.onclick = UWUTILS.checkTrusted(function () {
                    selectWeapon(tmpObj.weapons[items.weapons[i].type]);
                });
            } else {
                let tmpSprite = getItemSprite(items.list[i - 16], true);
                let tmpScale = Math.min(
                    tmpCanvas.width - config.iconPadding,
                    tmpSprite.width
                );
                tmpContext.globalAlpha = 1;
                tmpContext.drawImage(
                    tmpSprite,
                    -tmpScale / 2,
                    -tmpScale / 2,
                    tmpScale,
                    tmpScale
                );
                tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                tmpContext.globalCompositeOperation = "source-atop";
                tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                getEl("actionBarItem" + i).style.backgroundImage =
                    "url(" + tmpCanvas.toDataURL() + ")";
                let tmpUnit = getEl("actionBarItem" + i);
                // tmpUnit.onmouseover = UWUTILS.checkTrusted(function () {
                //     showItemInfo(items.list[i - 16]);
                // });
                tmpUnit.onclick = UWUTILS.checkTrusted(function () {
                    selectToBuild(tmpObj.items[tmpObj.getItemType(i - 16)]);
                });
            }
        })(j);
    }
};

let isAnimating = false;
let menuVisible = false;

function toggleMenu(homeScreenVisible) {
    if (isAnimating) return;
    isAnimating = true;

    if (homeScreenVisible || menuVisible) {
        container.style.opacity = "0";
        setTimeout(() => {
            container.style.visibility = "hidden";
            menuVisible = false;
            isAnimating = false;
        }, 300);
    } else {
        Object.assign(container.style, { visibility: "visible", opacity: "1" });
        menuVisible = true;
        isAnimating = false;
    }
}

document.addEventListener("keydown", ({ key, target }) => {
    if (
        key === "Escape" &&
        !isAnimating &&
        !["allianceMenu", "storeMenu", "mainMenu"].some(
            (id) => document.querySelector(`#${id}`).style.display !== "none"
        ) &&
        target.id.toLowerCase() !== "chatbox"
    ) {
        toggleMenu(false);
    }
});

let container;
function createMenu() {
    injectStyles();
    injectScrollbarStyles();
    document.body.appendChild(astolfoTheSecond);

    container = document.createElement("div");
    container.id = "menu-container";
    container.style.visibility = "hidden";
    container.style.opacity = "0";
    document.body.appendChild(container);

    const leftPanel = document.createElement("div");
    leftPanel.className = "left-panel";
    container.appendChild(leftPanel);

    const featurePanel = document.createElement("div");
    featurePanel.className = "feature-panel";
    featurePanel.id = "feature";
    container.appendChild(featurePanel);

    panels.forEach((panel) => {
        const panelElement = document.createElement("div");
        panelElement.className = `${panel}-panel panel`;
        panelElement.style.display = "none";
        featurePanel.appendChild(panelElement);
        panelElements[panel] = panelElement;
    });

    function createSwitch(
    labelText,
     configKey,
     parentPanel,
     defaultChecked = false,
     changeHandler = null
    ) {
        const switchContainer = document.createElement("div");
        switchContainer.className = "switch-container";

        const labelSpan = document.createElement("span");
        labelSpan.className = "switch-label-text";
        labelSpan.textContent = ` ${labelText} `;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "switch-checkbox";
        checkbox.id = `${configKey}-checkbox`;
        checkbox.checked = defaultChecked;

        const label = document.createElement("label");
        label.className = "switch-label";
        label.setAttribute("for", `${configKey}-checkbox`);

        switchContainer.appendChild(labelSpan);
        switchContainer.appendChild(checkbox);
        switchContainer.appendChild(label);
        panelElements[parentPanel].appendChild(switchContainer);

        if (changeHandler) {
            checkbox.addEventListener("change", changeHandler);
        }
    }
    function customText(labelText, configKey, parentPanel, defaultText) {
        textAreas.push(configKey + "-text");
        const switchContainer = document.createElement("div");
        switchContainer.className = "switch-container";

        const labelSpan = document.createElement("span");
        labelSpan.className = "switch-label-text";
        labelSpan.textContent = ` ${labelText} `;

        const text = document.createElement("input");
        text.type = "text";
        text.id = `${configKey}-text`;
        text.value = defaultText;

        switchContainer.appendChild(labelSpan);
        switchContainer.appendChild(text);
        panelElements[parentPanel].appendChild(switchContainer);
    }
    createSwitch("Packet Reducer", "packetReducer", "home", true, () => {
        configs.packetReducer = getEl("packetReducer-checkbox").checked;
    });
    createSwitch("Auto Grind", "autoGrind", "home", false, () => {
        configs.autoGrind = getEl("autoGrind-checkbox").checked;
        if (configs.autoGrind) {
            window.startGrind()
        }
    });


    createSwitch("HappyMod AutoChat", "happyModAutoChat", "home", false, () => {
        configs.happyModAutoChat = getEl("happyModAutoChat-checkbox").checked;
    });
    createSwitch("Spotify Ad", "spotify", "home", false, () => {
        configs.spotify = getEl("spotify-checkbox").checked;
    });
    createSwitch("Auto Breaker", "autoBreaker", "home", false, () => {
        configs.autoBreaker = getEl("autoBreaker-checkbox").checked;
    });
    createSwitch("Auto Break Teleporters", "aBTP", "home", false, () => {
        configs.autoBreakTP = getEl("aBTP-checkbox").checked;
    });
    createSwitch("Hat Loop", "hatLoop", "home", false, () => {
        hatLoop = getEl("hatLoop-checkbox").checked;
    });
    createSwitch("Auto Buy", "autoBuy", "home", true, () => {
        configs.autoBuy = getEl("autoBuy-checkbox").checked;
    });
    createSwitch("Kill Chat", "killChat", "home", true, () => {
        configs.killchat = getEl("killChat-checkbox").checked;
    });
    customText("Custom Kill Chat", "killMsg", "home", "");
    createSwitch("Auto Buy Equip", "autoBuyEquip", "home", false, () => {
        configs.autoBuyEquip = getEl("autoBuyEquip-checkbox").checked;
    });
    createSwitch("Auto Steal", "autoSteal", "home", true, () => {
        configs.autoSteal = getEl("autoSteal-checkbox").checked;
    });

    // Combat Panel
    createSwitch("Auto Push", "autoPush", "combat", true, () => {
        configs.autoPush = getEl("autoPush-checkbox").checked;
    })
    createSwitch("Spiketick instead of Retrap", "zpyklerTickOverRetrap", "combat", false, () => {
        configs.zpyklerTickOverRetrap = getEl("zpyklerTickOverRetrap-checkbox").checked;
    })
    createSwitch("Auto Insta On High Shame", "shameInsta", "combat", true, () => {
        configs.shameInsta = getEl("shameInsta-checkbox").checked;
    });
    customText("Shames For Autoinsta", "shameInstaCount", "combat", "5");
    createSwitch("Ruby Shame Increaser", "rubyShame", "combat", false, () => {
        configs.rubyShame = getEl("rubyShame-checkbox").checked;
    });
    createSwitch("Sword Poison Tick Insta", "antiEmpAnti", "combat", false, () => {
        configs.antiEmpAnti = getEl("antiEmpAnti-checkbox").checked;
    });
    createSwitch("Reverse Insta", "rev", "combat", false, () => {
        configs.rev = getEl("rev-checkbox").checked;
    });
    createSwitch("Auto Onetick", "autoOnetick", "combat", true, () => {
        configs.autoOnetick = getEl("autoOnetick-checkbox").checked;
    });
    createSwitch("Spam Frame", "spamFrame", "combat", true, () => {
        configs.spamFrame = getEl("spamFrame-checkbox").checked;
    });
    createSwitch("Auto Bull Spam", "bullspam", "combat", false, () => {
        configs.bullspam = getEl("bullspam-checkbox").checked;
    });
    createSwitch("Auto Sync", "autoSync", "combat", true, () => {
        configs.autoSync = getEl("autoSync-checkbox").checked;
    });
    createSwitch("Soldier Spiketick", "soldierSpiketick", "combat", true, () => {
        configs.soldierSpiketick = getEl("soldierSpiketick-checkbox").checked;
    });
    createSwitch("Auto Kill", "autoKill", "combat", true, () => {
        configs.autoKill = getEl("autoKill-checkbox").checked;
    });
    createSwitch("Auto Break Spike/Trap", "autoBreakSpike", "combat", true, () => {
        configs.autoBreakSpike = getEl("autoBreakSpike-checkbox").checked;
    })
    createSwitch("Avoid Spike", "avoidSpike", "combat", true, () => {
        configs.avoidSpike = getEl("avoidSpike-checkbox").checked;
    })
    /*
        createSwitch("Antibull on Reverse", "antiReverse", "combat", true, () => {
            configs.antiReverse = getEl("antiReverse-checkbox").checked;
        });
        createSwitch("Antibull Insta", "antiBullInsta", "combat", false, () => {
            configs.antiBullInsta = getEl("antiBullInsta-checkbox").checked;
        });
        */
    createSwitch("Predict Tick", "predictTick", "combat", true, () => {
        configs.predictTick = getEl("predictTick-checkbox").checked;
    });

    // Defense Panel
    createSwitch("Safe anti spiketick", "safeAntiZpyklertick", "defense", true, () => {
        configs.safeAntiZpyklerTick = getEl("safeAntiZpyklertick-checkbox").checked;
    });
    createSwitch("Anti Spike Tick Knockback Hit", "antiZpyklerTick", "defense", true, () => {
        configs.antiZpyklerTick = getEl("antiZpyklerTick-checkbox").checked;
    });
    createSwitch("Safe Auto Place", "safeAutoPlace", "defense", true, () => {
        configs.safeAutoPlace = getEl("safeAutoPlace-checkbox").checked;
    });
    createSwitch(
        "Safe Auto Place On Legits",
        "safeAutoPlaceLegits",
        "defense",
        true,
        () => {
            configs.safeAutoPlaceLegits = getEl(
                "safeAutoPlaceLegits-checkbox"
            ).checked;
        }
    );
    createSwitch("Anti OneTick", "antiOneTick", "defense", true, () => {
        configs.antiOneTick = getEl("antiOneTick-checkbox").checked;
    });
    createSwitch("Chase Placer", "chasePlacer", "defense", true, () => {
        configs.chasePlacer = getEl("chasePlacer-checkbox").checked;
    });
    createSwitch(
        "Save Teammates From OneTick",
        "saveAllyOnetick",
        "defense",
        true,
        () => {
            configs.saveAllyOnetick = getEl("saveAllyOnetick-checkbox").checked;
        }
    );
    createSwitch("Auto Place", "autoPlace", "defense", false, () => {
        configs.autoPlace = getEl("autoPlace-checkbox").checked;
    });
    createSwitch("Auto Replace", "autoReplace", "defense", false, () => {
        configs.autoReplace = getEl("autoReplace-checkbox").checked;
    });
    createSwitch("Auto Pre Placer", "autoPreplacer", "defense", false, () => {
        configs.autoPreplace = getEl("autoPreplacer-checkbox").checked;
    });
    customText("Preplacer Delay", "customDelay", "defense", "111");
    createSwitch("Anti Trap", "antiTrap", "defense", true, () => {
        configs.antiTrap = getEl("antiTrap-checkbox").checked;
    });
    createSwitch("Antibull", "antiBull", "defense", false, () => {
        configs.antiBull = getEl("antiBull-checkbox").checked;
    });
    // Visual Panel
    createSwitch("Astolfo Map", "astolfoMap", "visual", true, () => {
        configs.astolfoMap = getEl("astolfoMap-checkbox").checked;
    });
    createSwitch("Texture Pack", "texturePack", "visual", true, () => {
        configs.texturePack = getEl("texturePack-checkbox").checked;
    });
    createSwitch("Astolfo Damage", "astolfoHeartDamage", "visual", true, () => {
        configs.astolfoHeartDamage = getEl("astolfoHeartDamage-checkbox").checked;
    });
    createSwitch("Astolfo Damage On Ruby Only", "astolfoHeartDamageRuby", "visual", true, () => {
        configs.astolfoHeartDamageRuby = getEl("astolfoHeartDamageRuby-checkbox").checked;
    });
    createSwitch("Player Bow Tie", "bowTie", "visual", true, () => {
        configs.bowTie = getEl("bowTie-checkbox").checked;
    });
    createSwitch("Pink UI", "pinkUI", "visual", true, () => {
        configs.pinkUI = getEl("pinkUI-checkbox").checked;
        injectStyles();
    });
    createSwitch("Dark Mode", "darkMode", "visual", true, () => {
        configs.darkMode = getEl("darkMode-checkbox").checked;
    });
    createSwitch("Night Mode", "nightMode", "visual", true, () => {
        configs.nightMode = getEl("nightMode-checkbox").checked;
    });
    createSwitch("Custom Background", "customBackground", "visual", false, () => {
        configs.customBackground = getEl("customBackground-checkbox").checked;
    });
    createSwitch("Show Grid", "showGrid", "visual", true, () => {
        configs.showGrid = getEl("showGrid-checkbox").checked;
    });
    createSwitch("Auto Boost", "autoBoost", "combat", false, () => {
        configs.autoBoost = getEl("autoBoost-checkbox").checked;
    });
    createSwitch("Use Custom Map", "customMap", "visual", false, () => {
        const mapDisplay = document.getElementById("mapDisplay");

        if (document.getElementById("customMap-checkbox").checked) {
            mapDisplay.style.backgroundImage =
                'url("https://i.imgur.com/fgFsQJp.png")';
        } else {
            mapDisplay.style.backgroundImage = "";
        }
    });
    createSwitch("Large Names", "bigNames", "visual", false, () => {
        configs.bigNames = getEl("bigNames-checkbox").checked;
    });

    const mapDisplay = document.getElementById("mapDisplay");
    mapDisplay.style.backgroundImage = "";

    const leftTitle = document.createElement("div");
    leftTitle.className = "left-title";

    const leftTitleContent = document.createElement("div");
    leftTitleContent.className = "left-title-content";

    const titleText = document.createElement("span");
    titleText.textContent = "Whiteout";

    const versionText = document.createElement("span");
    versionText.textContent = "V3";
    versionText.className = "version";

    leftTitleContent.appendChild(titleText);
    leftTitleContent.appendChild(versionText);
    leftTitle.appendChild(leftTitleContent);
    leftPanel.appendChild(leftTitle);

    const sections = [
        "Home",
        "Combat",
        "Defense",
        "Visual",
        "Player List",
        "Logs",
    ];
    const sectionIcons = [
        "https://i.imgur.com/Da9LKoE.png",
        "https://i.imgur.com/sR5JnTE.png",
        "https://i.imgur.com/0fz1qiE.png",
        "https://i.imgur.com/cJOwD3n.png",
        "https://i.imgur.com/g6p10wB.png",
        "https://i.imgur.com/XWv7qI9.png",
        "https://i.imgur.com/9fbjRuw.png",
    ];

    sections.forEach((section, index) => {
        const sectionButton = document.createElement("button");
        sectionButton.textContent = section;
        sectionButton.className = "menu-button";

        const icon = document.createElement("img");
        icon.src = sectionIcons[index];
        icon.alt = `${section} Icon`;
        icon.style.width = "20px";
        icon.style.height = "20px";
        icon.style.marginRight = "10px";

        sectionButton.prepend(icon);
        leftPanel.appendChild(sectionButton);

        sectionButton.addEventListener("click", () => {
            Object.keys(panelElements).forEach(p => {
                panelElements[p].style.display = 'none';
                panelElements[p].classList.remove('active-panel');
            });
            if (panel.style) panel.style.background = "rgba(0, 0, 0, 0.1)";
            sectionButton.style.background = "rgba(255, 255, 255, 0.2)";
            if (section == "Logs" || section == "Player List") getEl("feature").scrollTop = getEl("feature").scrollHeight;
            panel = sectionButton
            console.log(section.toLowerCase(), panelElements)
            panelElements[section.replace(" ", "").toLowerCase()].style.display = "block";
            panelElements[section.replace(" ", "").toLowerCase()].classList.add("active-panel");
        });
    });

    panelElements["home"].style.display = "block";
    panelElements["home"].classList.add("active-panel");
    featurePanel.style.overflow = "auto";
    featurePanel.style.scrollbarWidth = "none";
}

createMenu();

function injectScrollbarStyles() {
    const style = document.createElement("style");
    style.textContent = `
                #menu-container {
                    max-height: 100vh;
                }

                #menu-container::-webkit-scrollbar {
                    width: 8px;
                }

                #menu-container::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }

                #menu-container::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 10px;
                    transition: background 0.3s;
                }

                #menu-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.5);
                }
            `;
    document.head.appendChild(style);
}
const selectors = [
    "#pre-content-container",
    "#chatButton",
    "#partyButton",
    "#promoImgHolder",
    "#linksContainer2",
    "#partyJoinButton",
    "#joinPartyButton",
    "span",
];

document.querySelectorAll(selectors.join(",")).forEach((element) => {
    if (
        element.tagName === "SPAN" &&
        element.textContent.trim() === "Join Party"
    ) {
        element.remove();
    } else if (element.tagName !== "SPAN") {
        element.remove();
    }
});
function injectStyles() {
    const styleElement = document.createElement("style");

    styleElement.innerHTML = `

    #menuChatDiv {
        scrollbar-width: none;
        box-shadow: none;
    }

    #killCounter {
    margin-top: 10px;
    }


    #ageBarBody {
    border-radius: 8px;
    }

    .actionBarItem, #ageBar, #chatBox, #mChBox {
    border: 3px solid ${getBorderColor()};
    box-shadow: rgba(0, 0, 0, 0.24) 0px 6px 12px 0px;
    background-color: ${getBackgroundColor()};
    border-radius: 8px;
    }


    #killCounter, #scoreDisplay, #foodDisplay, #woodDisplay, #stoneDisplay {
        background-image: none;
        padding: 0px 8px;
        margin: 0px;
        text-align: center;
    }

    #menuCardHolder {
        display: block;
    position: absolute;
    top: 50%;
    left: 50%;
    translate: transition(-50%, -50%);
    transform: translate(-50%, -30%);
    }

    #loadingText {


    position: absolute;
    left: 50%;
    transform: translate(-50%, -230%);

    }

    #gameName {
    font-size: 120px;
    text-shadow: none;
    font-weight: black;
    positon: absolute;
    position: absolute;
    transform: translate(-50%, -230%);
    top: 50%;
    left: 50%;
    }
    #scoreDisplay {
        bottom: 280px;
    }
    #setupCard, #guideCard, #enterGame, #storeButton, #allianceButton, #foodDisplay,
    #woodDisplay, #killCounter, #stoneDisplay, #scoreDisplay, #mapDisplay, #leaderboard, #menuChatDiv {
        border: 3px solid ${getBorderColor()};
        border-image-slice: 1;
        box-shadow: rgba(0, 0, 0, 0.24) 0px 6px 12px 0px;
        background: ${getBackgroundColor()};
        border-radius: 6px;
    }

    #menuChatDiv {
        scrollbar-width: none;
        box-shadow: none;
    }

    #mChDiv {
        background-color: rgba(0, 0, 0, 0);
    }

    .menuHeader {
        color: white;
        text-align: center;
    }

    #menu-container {
        width: 700px;
        height: 500px;
        background: ${getBackgroundColor()};
        color: ${getBorderColor()};
        font-family: Arial, sans-serif;
        padding: 10px;
        box-shadow: rgba(0, 0, 0, 0.24) 0px 6px 12px 0px;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: row;
        visibility: visible;
        opacity: 1;
        transition: opacity 0.3s ease;
        border: 3px solid;
        border-image-slice: 1;
        border-radius: 6px;
    }

    #menu-container .feature-panel, #menu-container .left-panel {
        height: 100%;
        background: rgb(93 0 131 / 7%);;
        padding: 10px;
        box-sizing: border-box;
        border-radius: 6px;
    }

    #menu-container .feature-panel {
        width: 70%;
        margin-left: 10px;
    }

    #menu-container .left-panel {
        width: 30%;
    }

    #menu-container .left-panel .left-title {
        display: flex;
        justify-content: center;
    }

    #menu-container .left-panel .left-title span {
        font-size: 16px;
        color: #fff;
        margin-bottom: 2px;
    }

    #menu-container .left-panel .left-title .version {
        font-size: 15px;
        margin-left: 10px;
        text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff,
                    0 0 40px #00f, 0 0 70px #00f, 0 0 80px #00f,
                    0 0 100px #00f, 0 0 150px #00f;
    }

    #menu-container .left-panel button {
        padding: 8px;
        margin: 5px 0;
        width: 100%;
        background: rgba(0, 0, 0, 0.1);
        color: #fff;
        border: none;
        cursor: pointer;
        text-align: left;
        outline: none;
        display: flex;
        align-items: center;
        transition: opacity 0.3s ease;
        opacity: 0.8;
        border-radius: 6px;
    }

    #menu-container .left-panel button:hover, #menu-container .left-panel button:focus {
        background: rgba(255, 255, 255, 0.2);
        opacity: 1;
    }

    #menu-container .left-panel button.active {
        background: rgba(0, 0, 0, 0.25);
        opacity: 1;
    }

    #menu-container .active-panel {
        display: block;
    }

    .checkbox-label {
        font-size: 14px;
        color: #fff;
        margin-left: 5px;
    }

    .switch-container {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        justify-content: space-between;
    }

    .switch-label-text {
        color: white;
        font-size: 14px;
        margin-right: 10px;
    }

    .switch-checkbox {
        display: none;
    }

    .switch-label {
        display: inline-block;
        width: 60px;
        height: 30px;
        background-color: #ccc;
        position: relative;
        transition: background-color 0.3s ease;
        border-radius: 32px;
    }

    .switch-label::before {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 24px;
        height: 24px;
        background-color: white;
        transition: left 0.3s ease;
        border-radius: 32px;
    }

    /* When checkbox is checked (toggle ON) */
    .switch-checkbox:checked + .switch-label {
        background-color: #4CAF50; /* Green when on */
    }

    .switch-checkbox:checked + .switch-label::before {
        left: 33px; /* Move the knob to the right */
    }
    #altcha {
                                color: white;
                            }
    #killCounter {
    margin-top: 10px;
    }

    #menuChatDiv {
        scrollbar-width: none;
        box-shadow: none;
    }

    #enterGame {
    background: rgb(6, 135, 63);
    padding: 8px;
    border: none;
    }


    .altcha svelte-ddsc3z {
        background: #eb90ff;
        border-radius: 8px;
        width: 283.25px;
        border: none;
        padding: 0.8rem
    }

    .skinColorItem {
        border: 0px;
    }


    #skinColorHolder {
    display: grid;
    justify-content: center;
    align-items: center;
    grid-auto-flow: column;

    }

    #guideCard {
        max-height: 700px;
        lil bro you aint safe;
        width: 500px;
        overflow-y: hidden;
    }

    #setupCard {
        width: 500px;
        height: 700px;
    }

    #nameInput {
    border-radius: 8px;
    }

                    `;
    document.head.appendChild(styleElement);
}

$(".altcha.svelte-ddsc3z").css({
    background: "#eb90ff",
    "border-radius": "6px",
    width: "283.25px",
    border: "none",
});

$(".altcha-label.svelte-ddsc3z").css({
    "text-align": "center",
    "font-size": "23px",
});

$(".altcha-checkbox.svelte-ddsc3z input.svelte-ddsc3z").css({
    "accent-color": "white",
});

menuDiv.style.display = "none";
menuDiv.style.visibility = "hidden";



window.sendPacket = packet;

const WhiteoutBuild = {
    "builtAt": "2026-08-04T09:07:00.628Z",
    "liftedFrom": {
        "codec": "src/game_vendor.js",
        "transport": "src/game_index.js"
    },
    "signatureBytes": 6,
    "encryptedMode": 1,
    "c2sAlphabet": [
        "M",
        "D",
        "9",
        "e",
        "F",
        "z",
        "H",
        "K",
        "L",
        "N",
        "b",
        "P",
        "Q",
        "c",
        "6",
        "S",
        "0"
    ],
    "s2cAlphabet": [
        "A",
        "B",
        "C",
        "D",
        "E",
        "a",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "X",
        "Y",
        "Z",
        "g",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "0"
    ]
};
WhiteoutBuild.check = function () {
    const problems = [];
    try {
        if (WhiteoutNet.signatureBytes !== WhiteoutBuild.signatureBytes) {
            problems.push(
                "frame signature is " + WhiteoutNet.signatureBytes +
                " bytes, expected " + WhiteoutBuild.signatureBytes
            );
        }
        const state = WS && WhiteoutNet.stateOf(WS);
        if (state) {
            if (state.mode !== WhiteoutBuild.encryptedMode) {
                problems.push("transport mode is " + state.mode + ", expected " + WhiteoutBuild.encryptedMode);
            }
            const live = Object.keys(state.tables.c2s.enc).length;
            if (live !== WhiteoutBuild.c2sAlphabet.length) {
                problems.push(
                    "c2s opcode table has " + live + " entries, expected " + WhiteoutBuild.c2sAlphabet.length
                );
            }
        } else if (WS) {
            problems.push("connected without negotiating the signed transport");
        }
    } catch (e) {}
    for (const problem of problems) {
        console.warn("[whiteout] protocol drift: " + problem);
    }
    return problems;
};
setTimeout(function () {
    try {
        WhiteoutBuild.check();
    } catch (e) {}
}, 15000);
window.WhiteoutBuild = WhiteoutBuild;

window.startGrind = function () {
    checkPlace(player.getItemType(22), (getSafeDir() + Math.PI / 4));
    checkPlace(player.getItemType(22), (getSafeDir() - Math.PI / 4));
};
setInterval(() => {
    clearChat();console.clear();
}, config.isSandbox ? 500000 : 1000000)
setInterval(() => {
    my.reSync = true;
}, 300000)
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whiteoutMain, { once: true });
} else {
    whiteoutMain();
}
