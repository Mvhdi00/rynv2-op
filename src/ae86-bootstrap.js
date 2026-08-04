(function() {
    "use strict";

    var W = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (W.__AE86_BOOT__) {
        return;
    }
    W.__AE86_BOOT__ = true;

    var SIGNATURE_BYTES = 6;
    var ENCRYPTED_MODE = 1;
    var TABLE_SALT = 1;

    var C2S_ALPHABET = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
    var S2C_ALPHABET = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

    var C2S_FROM_LEGACY = {
        "sp": "M",
        "2": "D",
        "33": "9",
        "rmd": "e",
        "c": "F",
        "5": "z",
        "6": "H",
        "7": "K",
        "8": "L",
        "9": "N",
        "10": "b",
        "11": "P",
        "12": "Q",
        "13c": "c",
        "ch": "6",
        "14": "S",
        "pp": "0"
    };

    var S2C_TO_LEGACY = {
        "A": "id",
        "B": "d",
        "C": "1",
        "D": "2",
        "E": "4",
        "a": "33",
        "G": "5",
        "H": "6",
        "I": "a",
        "J": "aa",
        "K": "7",
        "L": "8",
        "M": "sp",
        "N": "9",
        "O": "h",
        "P": "11",
        "Q": "12",
        "R": "13",
        "S": "14",
        "T": "15",
        "U": "16",
        "V": "17",
        "X": "18",
        "Y": "19",
        "Z": "20",
        "g": "ac",
        "1": "ad",
        "2": "an",
        "3": "st",
        "4": "sa",
        "5": "us",
        "6": "ch",
        "7": "mm",
        "8": "t",
        "9": "p",
        "0": "pp"
    };

    var API_BASE = "https://api.moomoo.io";
    var SERVER_LIST_URL = API_BASE + "/servers?v=1.27";
    var BASE_URL = "moomoo.io";

    function toBytes(value) {
        if (value instanceof Uint8Array) {
            return value;
        }
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }
        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        }
        return new Uint8Array(value);
    }

    var K256 = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

    function rotr(value, bits) {
        return value >>> bits | value << 32 - bits;
    }

    function sha256(input) {
        var state = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
        var length = input.length;
        var bitLength = length * 8;
        var padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
        padded.set(input);
        padded[length] = 128;
        var view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bitLength >>> 0, false);
        view.setUint32(padded.length - 8, Math.floor(bitLength / 4294967296), false);
        var w = new Uint32Array(64);
        for (var offset = 0; offset < padded.length; offset += 64) {
            for (var i = 0; i < 16; i++) {
                w[i] = view.getUint32(offset + i * 4, false);
            }
            for (var j = 16; j < 64; j++) {
                var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ w[j - 15] >>> 3;
                var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ w[j - 2] >>> 10;
                w[j] = w[j - 16] + s0 + w[j - 7] + s1 | 0;
            }
            var a = state[0];
            var b = state[1];
            var c = state[2];
            var d = state[3];
            var e = state[4];
            var f = state[5];
            var g = state[6];
            var h = state[7];
            for (var k = 0; k < 64; k++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = e & f ^ ~e & g;
                var temp1 = h + S1 + ch + K256[k] + w[k] | 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = a & b ^ a & c ^ b & c;
                var temp2 = S0 + maj | 0;
                h = g;
                g = f;
                f = e;
                e = d + temp1 | 0;
                d = c;
                c = b;
                b = a;
                a = temp1 + temp2 | 0;
            }
            state[0] = state[0] + a | 0;
            state[1] = state[1] + b | 0;
            state[2] = state[2] + c | 0;
            state[3] = state[3] + d | 0;
            state[4] = state[4] + e | 0;
            state[5] = state[5] + f | 0;
            state[6] = state[6] + g | 0;
            state[7] = state[7] + h | 0;
        }
        var digest = new Uint8Array(32);
        var digestView = new DataView(digest.buffer);
        for (var n = 0; n < 8; n++) {
            digestView.setUint32(n * 4, state[n], false);
        }
        return digest;
    }

    var BLOCK_SIZE = 64;

    function hmacSha256(key, message) {
        var normalized = key;
        if (normalized.length > BLOCK_SIZE) {
            normalized = sha256(normalized);
        }
        var padKey = new Uint8Array(BLOCK_SIZE);
        padKey.set(normalized);
        var inner = new Uint8Array(BLOCK_SIZE + message.length);
        var outer = new Uint8Array(BLOCK_SIZE + 32);
        for (var i = 0; i < BLOCK_SIZE; i++) {
            inner[i] = padKey[i] ^ 54;
            outer[i] = padKey[i] ^ 92;
        }
        inner.set(message, BLOCK_SIZE);
        outer.set(sha256(inner), BLOCK_SIZE);
        return sha256(outer);
    }

    function frameSignature(key, message) {
        return hmacSha256(key, message).subarray(0, SIGNATURE_BYTES);
    }

    function hexToBytes(hex) {
        var out = new Uint8Array(hex.length / 2);
        for (var i = 0; i < out.length; i++) {
            out[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return out;
    }

    function seededRandom(seed) {
        var state = seed;
        return function() {
            state |= 0;
            state = state + 1831565813 | 0;
            var t = Math.imul(state ^ state >>> 15, 1 | state);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function permute(alphabet, seed) {
        var size = alphabet.length;
        var order = alphabet.map(function(unused, index) {
            return index;
        });
        var random = seededRandom(seed >>> 0);
        for (var i = size - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var swap = order[i];
            order[i] = order[j];
            order[j] = swap;
        }
        var enc = {};
        var dec = {};
        for (var k = 0; k < size; k++) {
            enc[alphabet[k]] = order[k];
            dec[order[k]] = alphabet[k];
        }
        return {
            enc: enc,
            dec: dec
        };
    }

    function buildTables(seed) {
        var salted = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
        return {
            c2s: permute(C2S_ALPHABET, salted),
            s2c: permute(S2C_ALPHABET, (salted ^ 2246822507) >>> 0)
        };
    }

    function Writer() {
        this.bytes = new Uint8Array(2048);
        this.view = new DataView(this.bytes.buffer);
        this.pos = 0;
    }

    Writer.prototype.reserve = function(extra) {
        var needed = this.pos + extra;
        if (needed <= this.bytes.length) {
            return;
        }
        var size = this.bytes.length;
        while (size < needed) {
            size *= 2;
        }
        var grown = new Uint8Array(size);
        grown.set(this.bytes);
        this.bytes = grown;
        this.view = new DataView(grown.buffer);
    };

    Writer.prototype.u8 = function(value) {
        this.reserve(1);
        this.view.setUint8(this.pos, value);
        this.pos += 1;
    };

    Writer.prototype.i8 = function(value) {
        this.reserve(1);
        this.view.setInt8(this.pos, value);
        this.pos += 1;
    };

    Writer.prototype.u16 = function(value) {
        this.reserve(2);
        this.view.setUint16(this.pos, value);
        this.pos += 2;
    };

    Writer.prototype.i16 = function(value) {
        this.reserve(2);
        this.view.setInt16(this.pos, value);
        this.pos += 2;
    };

    Writer.prototype.u32 = function(value) {
        this.reserve(4);
        this.view.setUint32(this.pos, value);
        this.pos += 4;
    };

    Writer.prototype.i32 = function(value) {
        this.reserve(4);
        this.view.setInt32(this.pos, value);
        this.pos += 4;
    };

    Writer.prototype.i64 = function(value) {
        this.reserve(8);
        this.view.setInt32(this.pos, Math.floor(value / 4294967296));
        this.view.setUint32(this.pos + 4, value >>> 0);
        this.pos += 8;
    };

    Writer.prototype.u64 = function(value) {
        this.reserve(8);
        this.view.setUint32(this.pos, value / 4294967296);
        this.view.setUint32(this.pos + 4, value >>> 0);
        this.pos += 8;
    };

    Writer.prototype.f64 = function(value) {
        this.reserve(8);
        this.view.setFloat64(this.pos, value);
        this.pos += 8;
    };

    Writer.prototype.raw = function(chunk) {
        this.reserve(chunk.length);
        this.bytes.set(chunk, this.pos);
        this.pos += chunk.length;
    };

    var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

    function utf8Encode(text) {
        if (textEncoder) {
            return textEncoder.encode(text);
        }
        var out = [];
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i);
            if (code >= 55296 && code <= 56319 && i + 1 < text.length) {
                var low = text.charCodeAt(i + 1);
                if ((low & 64512) === 56320) {
                    i++;
                    code = ((code & 1023) << 10) + (low & 1023) + 65536;
                }
            }
            if (code < 128) {
                out.push(code);
            } else if (code < 2048) {
                out.push(code >> 6 & 31 | 192, code & 63 | 128);
            } else if (code < 65536) {
                out.push(code >> 12 & 15 | 224, code >> 6 & 63 | 128, code & 63 | 128);
            } else {
                out.push(code >> 18 & 7 | 240, code >> 12 & 63 | 128, code >> 6 & 63 | 128, code & 63 | 128);
            }
        }
        return new Uint8Array(out);
    }

    var textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

    function utf8Decode(bytes, start, length) {
        var slice = bytes.subarray(start, start + length);
        if (textDecoder) {
            return textDecoder.decode(slice);
        }
        var out = "";
        var i = 0;
        while (i < slice.length) {
            var byte = slice[i++];
            var code;
            if (byte < 128) {
                code = byte;
            } else if ((byte & 224) === 192) {
                code = (byte & 31) << 6 | slice[i++] & 63;
            } else if ((byte & 240) === 224) {
                code = (byte & 15) << 12 | (slice[i++] & 63) << 6 | slice[i++] & 63;
            } else {
                code = (byte & 7) << 18 | (slice[i++] & 63) << 12 | (slice[i++] & 63) << 6 | slice[i++] & 63;
            }
            if (code > 65535) {
                code -= 65536;
                out += String.fromCharCode(code >>> 10 & 1023 | 55296);
                code = 56320 | code & 1023;
            }
            out += String.fromCharCode(code);
        }
        return out;
    }

    function writeValue(writer, value) {
        if (value === null || value === undefined) {
            writer.u8(192);
            return;
        }
        var type = typeof value;
        if (type === "boolean") {
            writer.u8(value ? 195 : 194);
            return;
        }
        if (type === "number") {
            writeNumber(writer, value);
            return;
        }
        if (type === "string") {
            writeString(writer, value);
            return;
        }
        if (Array.isArray(value)) {
            writeArray(writer, value);
            return;
        }
        if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            writeBinary(writer, toBytes(value));
            return;
        }
        writeMap(writer, value);
    }

    function writeNumber(writer, value) {
        if (!Number.isSafeInteger(value)) {
            writer.u8(203);
            writer.f64(value);
            return;
        }
        if (value >= 0) {
            if (value < 128) {
                writer.u8(value);
            } else if (value < 256) {
                writer.u8(204);
                writer.u8(value);
            } else if (value < 65536) {
                writer.u8(205);
                writer.u16(value);
            } else if (value < 4294967296) {
                writer.u8(206);
                writer.u32(value);
            } else {
                writer.u8(207);
                writer.u64(value);
            }
            return;
        }
        if (value >= -32) {
            writer.u8(224 | value + 32);
        } else if (value >= -128) {
            writer.u8(208);
            writer.i8(value);
        } else if (value >= -32768) {
            writer.u8(209);
            writer.i16(value);
        } else if (value >= -2147483648) {
            writer.u8(210);
            writer.i32(value);
        } else {
            writer.u8(211);
            writer.i64(value);
        }
    }

    function writeString(writer, value) {
        var encoded = utf8Encode(value);
        var length = encoded.length;
        if (length < 32) {
            writer.u8(160 + length);
        } else if (length < 256) {
            writer.u8(217);
            writer.u8(length);
        } else if (length < 65536) {
            writer.u8(218);
            writer.u16(length);
        } else {
            writer.u8(219);
            writer.u32(length);
        }
        writer.raw(encoded);
    }

    function writeBinary(writer, bytes) {
        var length = bytes.length;
        if (length < 256) {
            writer.u8(196);
            writer.u8(length);
        } else if (length < 65536) {
            writer.u8(197);
            writer.u16(length);
        } else {
            writer.u8(198);
            writer.u32(length);
        }
        writer.raw(bytes);
    }

    function writeArray(writer, items) {
        var length = items.length;
        if (length < 16) {
            writer.u8(144 + length);
        } else if (length < 65536) {
            writer.u8(220);
            writer.u16(length);
        } else {
            writer.u8(221);
            writer.u32(length);
        }
        for (var i = 0; i < length; i++) {
            writeValue(writer, items[i]);
        }
    }

    function writeMap(writer, object) {
        var keys = Object.keys(object);
        var length = keys.length;
        if (length < 16) {
            writer.u8(128 + length);
        } else if (length < 65536) {
            writer.u8(222);
            writer.u16(length);
        } else {
            writer.u8(223);
            writer.u32(length);
        }
        for (var i = 0; i < length; i++) {
            writeString(writer, keys[i]);
            writeValue(writer, object[keys[i]]);
        }
    }

    function encode(value) {
        var writer = new Writer();
        writeValue(writer, value);
        return writer.bytes.slice(0, writer.pos);
    }

    function Reader(bytes) {
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this.pos = 0;
    }

    Reader.prototype.value = function() {
        var head = this.view.getUint8(this.pos);
        this.pos += 1;
        if (head < 128) {
            return head;
        }
        if (head >= 224) {
            return head - 256;
        }
        if (head < 144) {
            return this.map(head - 128);
        }
        if (head < 160) {
            return this.array(head - 144);
        }
        if (head < 192) {
            return this.string(head - 160);
        }
        switch (head) {
        case 192:
            return null;
        case 194:
            return false;
        case 195:
            return true;
        case 196:
            return this.binary(this.uint(1));
        case 197:
            return this.binary(this.uint(2));
        case 198:
            return this.binary(this.uint(4));
        case 202:
            return this.float(4);
        case 203:
            return this.float(8);
        case 204:
            return this.uint(1);
        case 205:
            return this.uint(2);
        case 206:
            return this.uint(4);
        case 207:
            return this.uint(8);
        case 208:
            return this.int(1);
        case 209:
            return this.int(2);
        case 210:
            return this.int(4);
        case 211:
            return this.int(8);
        case 212:
            return this.ext(1);
        case 213:
            return this.ext(2);
        case 214:
            return this.ext(4);
        case 215:
            return this.ext(8);
        case 216:
            return this.ext(16);
        case 199:
            return this.ext(this.uint(1));
        case 200:
            return this.ext(this.uint(2));
        case 201:
            return this.ext(this.uint(4));
        case 217:
            return this.string(this.uint(1));
        case 218:
            return this.string(this.uint(2));
        case 219:
            return this.string(this.uint(4));
        case 220:
            return this.array(this.uint(2));
        case 221:
            return this.array(this.uint(4));
        case 222:
            return this.map(this.uint(2));
        case 223:
            return this.map(this.uint(4));
        default:
            throw new Error("ae86: unrecognized msgpack type byte 0x" + head.toString(16));
        }
    };

    Reader.prototype.uint = function(width) {
        var value;
        if (width === 1) {
            value = this.view.getUint8(this.pos);
        } else if (width === 2) {
            value = this.view.getUint16(this.pos);
        } else if (width === 4) {
            value = this.view.getUint32(this.pos);
        } else {
            value = this.view.getUint32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4);
        }
        this.pos += width;
        return value;
    };

    Reader.prototype.int = function(width) {
        var value;
        if (width === 1) {
            value = this.view.getInt8(this.pos);
        } else if (width === 2) {
            value = this.view.getInt16(this.pos);
        } else if (width === 4) {
            value = this.view.getInt32(this.pos);
        } else {
            value = this.view.getInt32(this.pos) * 4294967296 + this.view.getUint32(this.pos + 4);
        }
        this.pos += width;
        return value;
    };

    Reader.prototype.float = function(width) {
        var value = width === 4 ? this.view.getFloat32(this.pos) : this.view.getFloat64(this.pos);
        this.pos += width;
        return value;
    };

    Reader.prototype.string = function(length) {
        var text = utf8Decode(this.bytes, this.pos, length);
        this.pos += length;
        return text;
    };

    Reader.prototype.binary = function(length) {
        var slice = this.bytes.subarray(this.pos, this.pos + length);
        this.pos += length;
        return slice;
    };

    Reader.prototype.ext = function(length) {
        this.pos += 1;
        return this.binary(length);
    };

    Reader.prototype.array = function(length) {
        var items = new Array(length);
        for (var i = 0; i < length; i++) {
            items[i] = this.value();
        }
        return items;
    };

    Reader.prototype.map = function(length) {
        var object = {};
        for (var i = 0; i < length; i++) {
            var key = this.value();
            var value = this.value();
            if (key !== "__proto__") {
                object[key] = value;
            }
        }
        return object;
    };

    function decode(bytes) {
        return new Reader(toBytes(bytes)).value();
    }

    var REGION_ALIASES = {
        "us-east": "vultr:1",
        "miami": "vultr:1",
        "chicago": "vultr:2",
        "dallas": "vultr:3",
        "us-west": "vultr:4",
        "seattle": "vultr:4",
        "losangeles": "vultr:5",
        "atlanta": "vultr:6",
        "amsterdam": "vultr:7",
        "gb": "vultr:8",
        "london": "vultr:8",
        "eu-west": "vultr:9",
        "frankfurt": "vultr:9",
        "siliconvalley": "vultr:12",
        "au": "vultr:19",
        "sydney": "vultr:19",
        "paris": "vultr:24",
        "tokyo": "vultr:25",
        "saopaulo": "vultr:39",
        "sg": "vultr:40",
        "singapore": "vultr:40"
    };
    var FALLBACK_REGION = "vultr:1";

    var serverList = null;
    var serverListPromise = null;

    function adaptServers(list) {
        return list.map(function(server) {
            var region = stripRegion(server.region);
            var adapted = Object.assign({}, server);
            adapted.ae86Region = region;
            adapted.ae86Address = server.region === 0 || server.region === "0" ? W.location.hostname : server.key + "." + region + "." + BASE_URL;
            adapted.ip = adapted.ae86Address;
            adapted.region = Object.prototype.hasOwnProperty.call(REGION_ALIASES, region) ? REGION_ALIASES[region] : FALLBACK_REGION;
            return adapted;
        });
    }

    function loadServers() {
        if (serverListPromise) {
            return serverListPromise;
        }
        serverListPromise = fetch(SERVER_LIST_URL).then(function(response) {
            return response.json();
        }).then(function(list) {
            var raw = Array.isArray(list) ? list : list && list.servers || [];
            serverList = adaptServers(raw);
            return serverList;
        }).catch(function(error) {
            console.error("[Ae86] failed to load server list:", error);
            serverList = [];
            return serverList;
        });
        return serverListPromise;
    }

    function stripRegion(region) {
        var text = String(region);
        if (text.startsWith("vultr:")) {
            return text.slice(6);
        }
        if (text.startsWith("do:")) {
            return text.slice(3);
        }
        return text;
    }

    function serverAddress(server) {
        return server.ae86Address;
    }

    function queryServer() {
        var params = new URLSearchParams(W.location.search);
        var value = params.get("server");
        if (typeof value !== "string") {
            return null;
        }
        var parts = value.split(":");
        return {
            region: parts[0],
            name: parts[1]
        };
    }

    function pickServer() {
        if (!serverList || serverList.length === 0) {
            return null;
        }
        var wanted = queryServer();
        if (wanted) {
            for (var i = 0; i < serverList.length; i++) {
                if (serverList[i].ae86Region === stripRegion(wanted.region) && serverList[i].name === wanted.name) {
                    return serverList[i];
                }
            }
        }
        var open = serverList.filter(function(server) {
            return server.playerCount !== server.playerCapacity;
        });
        var candidates = open.length > 0 ? open : serverList;
        return candidates.reduce(function(best, server) {
            if (!best) {
                return server;
            }
            return server.playerCount < best.playerCount ? server : best;
        }, null);
    }

    function rewriteSocketUrl(url) {
        var parsed;
        try {
            parsed = new URL(String(url), W.location.href);
        } catch (error) {
            return url;
        }
        var host = null;
        if (serverList) {
            for (var i = 0; i < serverList.length; i++) {
                var address = serverAddress(serverList[i]);
                if (address && parsed.hostname.indexOf(address) !== -1) {
                    host = address;
                    break;
                }
            }
        }
        if (host === null) {
            var server = pickServer();
            host = server ? serverAddress(server) : parsed.hostname;
        }
        var secure = W.location.protocol !== "http:";
        var candidate = (secure ? "wss://" : "ws://") + host;
        try {
            new URL(candidate);
        } catch (error) {
            return (secure ? "wss://" : "ws://") + parsed.hostname;
        }
        return candidate;
    }

    var NativeWebSocket = W.WebSocket;
    var nativeSend = NativeWebSocket.prototype.send;
    var nativeAddEventListener = NativeWebSocket.prototype.addEventListener;
    var IO_INIT_TIMEOUT = 8000;

    function TransportState() {
        this.tables = null;
        this.key = null;
        this.seq = 0;
        this.ready = false;
        this.openHandler = null;
        this.messageHandler = null;
        this.pending = [];
        this.timer = null;
    }

    function deliver(socket, state, payload) {
        if (typeof state.messageHandler !== "function") {
            return;
        }
        var bytes = encode(payload);
        var buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        try {
            state.messageHandler.call(socket, {
                data: buffer,
                target: socket,
                currentTarget: socket,
                type: "message"
            });
        } catch (error) {
            console.error("[Ae86] message handler failed:", error);
        }
    }

    function openTransport(socket, state) {
        if (state.ready) {
            return;
        }
        state.ready = true;
        if (state.timer !== null) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        if (typeof state.openHandler === "function") {
            try {
                state.openHandler.call(socket, {
                    target: socket,
                    currentTarget: socket,
                    type: "open"
                });
            } catch (error) {
                console.error("[Ae86] open handler failed:", error);
            }
        }
        flush(socket, state);
    }

    function flush(socket, state) {
        var queued = state.pending;
        state.pending = [];
        for (var i = 0; i < queued.length; i++) {
            transmit(socket, state, queued[i][0], queued[i][1]);
        }
    }

    function handleFrame(socket, state, event) {
        var parsed;
        try {
            parsed = decode(new Uint8Array(event.data));
        } catch (error) {
            return;
        }
        if (!Array.isArray(parsed)) {
            return;
        }
        var type = parsed[0];
        var args = parsed[1] || [];
        if (type === "io-init") {
            if (args[3] === ENCRYPTED_MODE) {
                state.tables = buildTables(args[1] >>> 0);
                state.key = hexToBytes(args[2]);
                state.seq = 0;
            } else {
                state.tables = null;
                state.key = null;
            }
            openTransport(socket, state);
            deliver(socket, state, ["io-init", args]);
            return;
        }
        if (typeof type === "number") {
            if (!state.tables) {
                return;
            }
            type = state.tables.s2c.dec[type];
            if (type === undefined) {
                return;
            }
        }
        var legacy = S2C_TO_LEGACY[type];
        if (legacy === undefined) {
            return;
        }
        deliver(socket, state, [legacy, args]);
    }

    function transmit(socket, state, legacyType, args) {
        var letter = C2S_FROM_LEGACY[legacyType];
        if (letter === undefined) {
            return;
        }
        if (state.tables && state.key) {
            var opcode = state.tables.c2s.enc[letter];
            if (opcode === undefined) {
                return;
            }
            var body = encode([opcode, args, ++state.seq]);
            var signature = frameSignature(state.key, body);
            var frame = new Uint8Array(SIGNATURE_BYTES + body.length);
            frame.set(signature, 0);
            frame.set(body, SIGNATURE_BYTES);
            nativeSend.call(socket, frame);
            return;
        }
        nativeSend.call(socket, encode([letter, args]));
    }

    function PatchedWebSocket(url, protocols) {
        var socket = protocols === undefined ? new NativeWebSocket(rewriteSocketUrl(url)) : new NativeWebSocket(rewriteSocketUrl(url),protocols);
        var state = new TransportState();
        Object.defineProperty(socket, "onopen", {
            configurable: true,
            get: function() {
                return state.openHandler;
            },
            set: function(handler) {
                state.openHandler = handler;
            }
        });
        Object.defineProperty(socket, "onmessage", {
            configurable: true,
            get: function() {
                return state.messageHandler;
            },
            set: function(handler) {
                state.messageHandler = handler;
            }
        });
        socket.send = function(data) {
            var parsed;
            try {
                parsed = decode(toBytes(data));
            } catch (error) {
                return;
            }
            if (!Array.isArray(parsed)) {
                return;
            }
            var legacyType = parsed[0];
            var args = parsed[1] || [];
            if (!state.ready || socket.readyState !== NativeWebSocket.OPEN) {
                state.pending.push([legacyType, args]);
                return;
            }
            transmit(socket, state, legacyType, args);
        };
        nativeAddEventListener.call(socket, "message", function(event) {
            handleFrame(socket, state, event);
        });
        nativeAddEventListener.call(socket, "open", function() {
            state.timer = setTimeout(function() {
                state.timer = null;
                openTransport(socket, state);
            }, IO_INIT_TIMEOUT);
        });
        nativeAddEventListener.call(socket, "close", function() {
            if (state.timer !== null) {
                clearTimeout(state.timer);
                state.timer = null;
            }
        });
        return socket;
    }

    PatchedWebSocket.prototype = NativeWebSocket.prototype;
    PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

    var NativeXHR = W.XMLHttpRequest;
    var SERVER_DATA_PATTERN = /\/serverData(\?|$)/;
    var PING_PATTERN = /\/ping(\?|$)/;

    function PatchedXHR() {
        var real = new NativeXHR();
        var self = this;
        var mode = null;
        var stubStatus = 0;
        var stubState = 0;
        var stubText = "";

        function stateEvent() {
            return {
                target: self,
                currentTarget: self,
                type: "readystatechange"
            };
        }

        real.onreadystatechange = function() {
            if (mode === null && typeof self.onreadystatechange === "function") {
                self.onreadystatechange.call(self, stateEvent());
            }
        };

        function finish(status, text) {
            stubState = 4;
            stubStatus = status;
            stubText = text;
            if (typeof self.onreadystatechange === "function") {
                self.onreadystatechange.call(self, stateEvent());
            }
        }

        Object.defineProperty(self, "readyState", {
            get: function() {
                return mode === null ? real.readyState : stubState;
            }
        });
        Object.defineProperty(self, "status", {
            get: function() {
                return mode === null ? real.status : stubStatus;
            }
        });
        Object.defineProperty(self, "statusText", {
            get: function() {
                return mode === null ? real.statusText : stubStatus === 200 ? "OK" : "";
            }
        });
        Object.defineProperty(self, "responseText", {
            get: function() {
                return mode === null ? real.responseText : stubText;
            }
        });
        Object.defineProperty(self, "response", {
            get: function() {
                return mode === null ? real.response : stubText;
            }
        });
        Object.defineProperty(self, "responseURL", {
            get: function() {
                return mode === null ? real.responseURL : "";
            }
        });
        Object.defineProperty(self, "upload", {
            get: function() {
                return real.upload;
            }
        });
        ["withCredentials", "timeout", "responseType"].forEach(function(name) {
            Object.defineProperty(self, name, {
                get: function() {
                    return real[name];
                },
                set: function(value) {
                    real[name] = value;
                }
            });
        });
        ["onload", "onerror", "onabort", "ontimeout", "onprogress", "onloadstart", "onloadend"].forEach(function(name) {
            Object.defineProperty(self, name, {
                get: function() {
                    return real[name];
                },
                set: function(value) {
                    real[name] = value;
                }
            });
        });

        self.open = function(method, url) {
            var target = String(url);
            if (SERVER_DATA_PATTERN.test(target)) {
                mode = "servers";
                return;
            }
            if (PING_PATTERN.test(target)) {
                mode = "ping";
                self.__ae86PingUrl = target;
                return;
            }
            mode = null;
            return real.open.apply(real, arguments);
        };

        self.send = function() {
            if (mode === null) {
                return real.send.apply(real, arguments);
            }
            if (mode === "servers") {
                loadServers().then(function(list) {
                    finish(200, JSON.stringify({
                        servers: list
                    }));
                });
                return;
            }
            var started = Date.now();
            var probe = rewriteSocketUrl(self.__ae86PingUrl).replace(/^ws/, "http") + "/ping";
            fetch(probe, {
                mode: "no-cors",
                cache: "no-store"
            }).then(function() {
                finish(200, String(Date.now() - started));
            }).catch(function() {
                finish(200, String(Date.now() - started));
            });
        };

        self.abort = function() {
            if (mode === null) {
                real.abort();
            }
        };
        self.setRequestHeader = function() {
            if (mode === null) {
                real.setRequestHeader.apply(real, arguments);
            }
        };
        self.getAllResponseHeaders = function() {
            return mode === null ? real.getAllResponseHeaders() : "";
        };
        self.getResponseHeader = function(name) {
            return mode === null ? real.getResponseHeader(name) : null;
        };
        self.overrideMimeType = function() {
            if (mode === null) {
                real.overrideMimeType.apply(real, arguments);
            }
        };
        self.addEventListener = function() {
            return real.addEventListener.apply(real, arguments);
        };
        self.removeEventListener = function() {
            return real.removeEventListener.apply(real, arguments);
        };
        self.onreadystatechange = null;
    }

    PatchedXHR.UNSENT = 0;
    PatchedXHR.OPENED = 1;
    PatchedXHR.HEADERS_RECEIVED = 2;
    PatchedXHR.LOADING = 3;
    PatchedXHR.DONE = 4;

    function neutralizeStockBundle() {
        var block = function(node) {
            if (!node || node.tagName !== "SCRIPT") {
                return;
            }
            var src = node.getAttribute("src") || "";
            var type = node.getAttribute("type") || "";
            if (!/\/assets\/index-[\w-]+\.js/.test(src) && !(type === "module" && /\/assets\//.test(src))) {
                return;
            }
            node.type = "text/ae86-blocked";
            node.removeAttribute("src");
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        };
        var observer = new MutationObserver(function(records) {
            for (var i = 0; i < records.length; i++) {
                var added = records[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    block(added[j]);
                }
            }
        });
        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });
        document.addEventListener("DOMContentLoaded", function() {
            observer.disconnect();
        });
        W.loadedScript = true;
    }

    function stubFrvr() {
        if (!W.FRVR) {
            W.FRVR = {
                ads: {
                    show: function(kind, callback) {
                        if (typeof callback === "function") {
                            callback();
                        }
                    }
                },
                bootstrapper: {
                    complete: function() {}
                },
                channelCharacteristics: {
                    allowNavigation: true
                }
            };
        }
        if (!W.frvrSdkInitPromise) {
            W.frvrSdkInitPromise = Promise.resolve();
        }
    }

    function stubChallenges() {
        if (!W.grecaptcha) {
            W.grecaptcha = {
                ready: function(callback) {
                    if (typeof callback === "function") {
                        callback();
                    }
                },
                execute: function() {
                    return Promise.resolve("");
                },
                render: function() {
                    return 0;
                },
                reset: function() {},
                getResponse: function() {
                    return "";
                }
            };
        }
        if (!W.turnstile) {
            W.turnstile = {
                ready: function(callback) {
                    if (typeof callback === "function") {
                        callback();
                    }
                },
                render: function() {
                    return "0";
                },
                reset: function() {},
                remove: function() {},
                getResponse: function() {
                    return "";
                }
            };
        }
    }

    function releaseChallengeGate() {
        if (typeof W.captchaCallback === "function") {
            try {
                W.captchaCallback("");
            } catch (error) {
                console.error("[Ae86] captcha gate failed:", error);
            }
        }
    }

    function domReady() {
        if (document.readyState !== "loading") {
            return Promise.resolve();
        }
        return new Promise(function(resolve) {
            document.addEventListener("DOMContentLoaded", function() {
                resolve();
            });
        });
    }

    neutralizeStockBundle();
    stubFrvr();
    stubChallenges();
    W.WebSocket = PatchedWebSocket;
    W.XMLHttpRequest = PatchedXHR;

    W.__ae86Boot = function(bundle) {
        Promise.all([loadServers(), domReady()]).then(function(results) {
            W.vultr = {
                servers: results[0]
            };
            try {
                bundle();
            } catch (error) {
                console.error("[Ae86] bundle failed to start:", error);
                return;
            }
            if (document.readyState === "complete") {
                if (typeof W.onload === "function") {
                    W.onload();
                }
                setTimeout(releaseChallengeGate, 0);
                return;
            }
            W.addEventListener("load", function() {
                setTimeout(releaseChallengeGate, 0);
            });
        });
    };

    W.Ae86Net = {
        signatureBytes: SIGNATURE_BYTES,
        encryptedMode: ENCRYPTED_MODE,
        tableSalt: TABLE_SALT,
        c2sAlphabet: C2S_ALPHABET,
        s2cAlphabet: S2C_ALPHABET,
        c2sFromLegacy: C2S_FROM_LEGACY,
        s2cToLegacy: S2C_TO_LEGACY,
        encode: encode,
        decode: decode,
        sha256: sha256,
        hmacSha256: hmacSha256,
        frameSignature: frameSignature,
        buildTables: buildTables,
        serverListUrl: SERVER_LIST_URL
    };
}
)();
