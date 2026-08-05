// ==UserScript==
// @name         Lolfly v4 — MihailSurviv build (fixed)
// @author       ryan8402, MihailSurviv.
// @description  checked for a logger, but it doesn't exist
// @version      001
// @match        *://moomoo.io/*
// @match        *://*.moomoo.io/*
// @icon         https://pa1.narvii.com/6564/396626249978b4faee638d4b3b05549fe1443b3f_hq.gif
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* ---------------------------------------------------------------------------
 * Lolfly v4 (MihailSurviv build) — document-start prologue
 *
 * Claims window.WebSocket before the game bundle can lock it, and hands the
 * captured native constructor to the mod under window.OriginalWebSocket.
 * The rest of the script still runs at DOM-ready, because the bundle reads
 * game DOM elements at module scope.
 * ------------------------------------------------------------------------- */
(function () {
    if (window.__reupSocketHook) return;

    var Native = window.WebSocket;
    window.OriginalWebSocket = Native;

    var forward = null;
    var pending = [];

    function HookedWebSocket(address) {
        /* The game's server lookup is a fetch, so it can reach this point
         * before the mod body has run — the mod body waits for the DOM. Hold
         * the address rather than opening a native socket, or that race
         * quietly hands the connection back to the vanilla client and the mod
         * looks like it did nothing. */
        if (forward) {
            forward(address);
            return;
        }
        pending.push(address);
    }

    HookedWebSocket.prototype.send = function () {};
    HookedWebSocket.prototype.close = function () {};
    HookedWebSocket.prototype.addEventListener = function () {};
    HookedWebSocket.prototype.removeEventListener = function () {};
    HookedWebSocket.prototype.dispatchEvent = function () { return false; };
    HookedWebSocket.prototype.binaryType = "arraybuffer";
    HookedWebSocket.prototype.readyState = 3;
    HookedWebSocket.CONNECTING = 0;
    HookedWebSocket.OPEN = 1;
    HookedWebSocket.CLOSING = 2;
    HookedWebSocket.CLOSED = 3;

    window.__reupSocketHook = function (fn) {
        forward = fn;
        while (pending.length) fn(pending.shift());
    };

    window.setTimeout(function () {
        if (!forward && pending.length) {
            console.error("Lolfly v4 (MihailSurviv build): the game opened a socket but the mod never registered its hook.");
        }
    }, 10000);

    try {
        Object.defineProperty(window, "WebSocket", {
            value: HookedWebSocket,
            writable: false,
            configurable: false
        });
    } catch (e) {
        window.WebSocket = HookedWebSocket;
    }
})();

(function () {
function __modMain() {
/* removed: the "FreeUnpatcher" send proxy. It renamed four opcodes by
   guesswork and msgpack-decoded every outbound frame; the current transport
   negotiates its opcode table per connection and signs each frame, so the
   proxy could neither read nor safely rewrite one. */
document.getElementById("loadingText").style = "#001878";
document.getElementById("loadingText").innerHTML = "original";
document.getElementById("pingDisplay").style.color = "#FF000";
document.getElementById("killCounter").style.color = "#FF000";
document.getElementById("killCounter").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("scoreDisplay").style.color = "#496bf2";
document.getElementById("scoreDisplay").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("foodDisplay").style.color = "#496bf2";
document.getElementById("foodDisplay").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("woodDisplay").style.color = "#496bf2";
document.getElementById("woodDisplay").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("stoneDisplay").style.color = "#496bf2";
document.getElementById("stoneDisplay").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("leaderboard").style.color = "#FF000";
document.getElementById("leaderboard").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("chatBox").style.color = "#FF000";
document.getElementById("chatBox").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("ageText").style.color = "#FF000";
document.getElementById("chatButton").style.color = "#FF000";
document.getElementById("chatButton").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("ageBar").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("ageBarBody").style.backgroundColor = "#FF000";
document.getElementById("mapDisplay").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("allianceButton").style.color = "#FF000";
document.getElementById("allianceButton").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("storeButton").style.color = "#FF000";
document.getElementById("storeButton").style.backgroundColor = "rgba(0, 0, 0, 0.75)";
document.getElementById("setupCard").style.backgroundColor = "#0a0f0f";
document.getElementById("guideCard").style.backgroundColor = "#0a0f0f";
document.getElementById("guideCard").children[0].style.color = "#FF000";
document.getElementById("guideCard").children[0].style.backgroundColor = "black";
document.getElementById("guideCard").children[0].style.borderWidth = "0";
document.getElementById("guideCard").children[2].style.color = "#FF000";
document.getElementById("guideCard").children[3].style.color = "#FF000";
document.getElementById("guideCard").children[4].style.color = "#FF000";
document.getElementById("linksContainer2").style.color = "#FF000";
document.getElementById("linksContainer2").style.backgroundColor = "black";
document.getElementById("loadingText").style.color = "#FF000";
document.getElementById("nameInput").style.backgroundColor = "#4f4f4f";
document.getElementById("nameInput").style.color = "#ffffff";
document.getElementById("enterGame").style.backgroundColor = "#c4210c";
document.getElementById("enterGame").style.color = "#FF000";
document.getElementById("mainMenu").style.backgroundImage = "url('https://www.escuelapedia.com/wp-content/uploads/Artemisa-la-diosa-rebelde.jpg')";
document.getElementById("enterGame").innerHTML = "Dumbasses Down!";
document.getElementById("enterGame").style.color = "text-shadow: red 1px 1px 40px;";
document.getElementById("nameInput").placeholder = "Enter Art";
document.getElementById("diedText").innerHTML = "bruuh why u die?";
document.getElementById("gameName").innerHTML = "LolflyV4";
setInterval(() => {
  setTimeout(() => {
    document.getElementById("gameName").innerHTML = "Vamos";
    setTimeout(() => {
      document.getElementById("gameName").innerHTML = "DESTRUA!";
      setTimeout(() => {
        document.getElementById("gameName").innerHTML = "Quebre eles";
        setTimeout(() => {
          document.getElementById("gameName").innerHTML = "Shadow";
          setTimeout(() => {
            document.getElementById("gameName").innerHTML = "Sangue";
            setTimeout(() => {
              document.getElementById("gameName").innerHTML = "MATE!";
              setTimeout(() => {
                document.getElementById("gameName").innerHTML = "TUDO!";
                setTimeout(() => {
                  document.getElementById("gameName").innerHTML = "deus";
                  setTimeout(() => {
                    document.getElementById("gameName").innerHTML = "julgamentos";
                    setTimeout(() => {
                      document.getElementById("gameName").innerHTML = "Divinos";
                      setTimeout(() => {
                        document.getElementById("gameName").innerHTML = "Vamos.";
                        setTimeout(() => {
                          document.getElementById("gameName").innerHTML = "Começar..";
                        }, 1000);
                      }, 1000);
                    }, 1000);
                  }, 1000);
                }, 1000);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
}, 1000);
document.getElementById("gameName").style.color = "#0000FF";
document.getElementById("leaderboard").append("DivineMod");
document.getElementById("leaderboard").style.color = "#0000FF";
{}
(function (p2) {
  if (typeof exports == "object" && typeof module != "undefined") {
    module.exports = p2();
  } else if (typeof define == "function" && define.amd) {
    define([], p2);
  } else {
    var v2;
    v2 = typeof window != "undefined" ? window : typeof global != "undefined" ? global : typeof self != "undefined" ? self : this;
    v2.msgpack = p2();
  }
})(function () {
  return function f2(p3, p4, p5) {
    function f3(p6, p7) {
      if (!p4[p6]) {
        if (!p3[p6]) {
          var v3 = typeof require == "function" && require;
          if (!p7 && v3) {
            return v3(p6, true);
          }
          if (v7) {
            return v7(p6, true);
          }
          var v4 = new Error("Cannot find module '" + p6 + "'");
          v4.code = "MODULE_NOT_FOUND";
          throw v4;
        }
        var v5 = p4[p6] = {
          exports: {}
        };
        p3[p6][0].call(v5.exports, function (p8) {
          var v6 = p3[p6][1][p8];
          return f3(v6 ? v6 : p8);
        }, v5, v5.exports, f2, p3, p4, p5);
      }
      return p4[p6].exports;
    }
    var v7 = typeof require == "function" && require;
    for (var vLN0 = 0; vLN0 < p5.length; vLN0++) {
      f3(p5[vLN0]);
    }
    return f3;
  }({
    1: [function (p9, p10, p11) {
      p11.encode = p9("./encode").encode;
      p11.decode = p9("./decode").decode;
      p11.Encoder = p9("./encoder").Encoder;
      p11.Decoder = p9("./decoder").Decoder;
      p11.createCodec = p9("./ext").createCodec;
      p11.codec = p9("./codec").codec;
    }, {
      "./codec": 10,
      "./decode": 12,
      "./decoder": 13,
      "./encode": 15,
      "./encoder": 16,
      "./ext": 20
    }],
    2: [function (p12, p13, p14) {
      (function (p15) {
        function t(p16) {
          return p16 && p16.isBuffer && p16;
        }
        p13.exports = t(typeof p15 != "undefined" && p15) || t(this.Buffer) || t(typeof window != "undefined" && window.Buffer) || this.Buffer;
      }).call(this, p12("buffer").Buffer);
    }, {
      buffer: 29
    }],
    3: [function (p17, p18, p19) {
      function n(p20, p21) {
        var vThis = this;
        var v8 = p21 || (p21 |= 0);
        for (var v9 = p20.length, vLN02 = 0, vLN03 = 0; vLN03 < v9;) {
          vLN02 = p20.charCodeAt(vLN03++);
          if (vLN02 < 128) {
            vThis[v8++] = vLN02;
          } else if (vLN02 < 2048) {
            vThis[v8++] = vLN02 >>> 6 | 192;
            vThis[v8++] = vLN02 & 63 | 128;
          } else if (vLN02 < 55296 || vLN02 > 57343) {
            vThis[v8++] = vLN02 >>> 12 | 224;
            vThis[v8++] = vLN02 >>> 6 & 63 | 128;
            vThis[v8++] = vLN02 & 63 | 128;
          } else {
            vLN02 = (vLN02 - 55296 << 10 | p20.charCodeAt(vLN03++) - 56320) + 65536;
            vThis[v8++] = vLN02 >>> 18 | 240;
            vThis[v8++] = vLN02 >>> 12 & 63 | 128;
            vThis[v8++] = vLN02 >>> 6 & 63 | 128;
            vThis[v8++] = vLN02 & 63 | 128;
          }
        }
        return v8 - p21;
      }
      function i(p22, p23, p24) {
        var vThis2 = this;
        var v10 = p23 | 0;
        p24 ||= vThis2.length;
        for (var vLS = "", vLN04 = 0; v10 < p24;) {
          vLN04 = vThis2[v10++];
          if (vLN04 < 128) {
            vLS += String.fromCharCode(vLN04);
          } else {
            if ((vLN04 & 224) === 192) {
              vLN04 = (vLN04 & 31) << 6 | vThis2[v10++] & 63;
            } else if ((vLN04 & 240) === 224) {
              vLN04 = (vLN04 & 15) << 12 | (vThis2[v10++] & 63) << 6 | vThis2[v10++] & 63;
            } else if ((vLN04 & 248) === 240) {
              vLN04 = (vLN04 & 7) << 18 | (vThis2[v10++] & 63) << 12 | (vThis2[v10++] & 63) << 6 | vThis2[v10++] & 63;
            }
            if (vLN04 >= 65536) {
              vLN04 -= 65536;
              vLS += String.fromCharCode((vLN04 >>> 10) + 55296, (vLN04 & 1023) + 56320);
            } else {
              vLS += String.fromCharCode(vLN04);
            }
          }
        }
        return vLS;
      }
      function o(p25, p26, p27, p28) {
        var v11;
        p27 ||= 0;
        if (!p28 && p28 !== 0) {
          p28 = this.length;
        }
        p26 ||= 0;
        var v12 = p28 - p27;
        if (p25 === this && p27 < p26 && p26 < p28) {
          for (v11 = v12 - 1; v11 >= 0; v11--) {
            p25[v11 + p26] = this[v11 + p27];
          }
        } else {
          for (v11 = 0; v11 < v12; v11++) {
            p25[v11 + p26] = this[v11 + p27];
          }
        }
        return v12;
      }
      p19.copy = o;
      p19.toString = i;
      p19.write = n;
    }, {}],
    4: [function (p29, p30, v13) {
      function f8(p32) {
        return new Array(p32);
      }
      function f9(p33) {
        if (!vP29.isBuffer(p33) && vP29.isView(p33)) {
          p33 = vP29.Uint8Array.from(p33);
        } else if (vP29.isArrayBuffer(p33)) {
          p33 = new Uint8Array(p33);
        } else {
          if (typeof p33 == "string") {
            return vP29.from.call(v13, p33);
          }
          if (typeof p33 == "number") {
            throw new TypeError("\"value\" argument must not be a number");
          }
        }
        return Array.prototype.slice.call(p33);
      }
      var vP29 = p29("./bufferish");
      var v13 = p30.exports = f8(0);
      v13.alloc = f8;
      v13.concat = vP29.concat;
      v13.from = f9;
    }, {
      "./bufferish": 8
    }],
    5: [function (p34, p35, v15) {
      function f10(p37) {
        return new v14(p37);
      }
      function f11(p38) {
        if (!vP34.isBuffer(p38) && vP34.isView(p38)) {
          p38 = vP34.Uint8Array.from(p38);
        } else if (vP34.isArrayBuffer(p38)) {
          p38 = new Uint8Array(p38);
        } else {
          if (typeof p38 == "string") {
            return vP34.from.call(v15, p38);
          }
          if (typeof p38 == "number") {
            throw new TypeError("\"value\" argument must not be a number");
          }
        }
        if (v14.from && v14.from.length !== 1) {
          return v14.from(p38);
        } else {
          return new v14(p38);
        }
      }
      var vP34 = p34("./bufferish");
      var v14 = vP34.global;
      var v15 = p35.exports = vP34.hasBuffer ? f10(0) : [];
      v15.alloc = vP34.hasBuffer && v14.alloc || f10;
      v15.concat = vP34.concat;
      v15.from = f11;
    }, {
      "./bufferish": 8
    }],
    6: [function (p39, p40, p41) {
      function n(p42, p43, p44, p45) {
        var v16 = vP392.isBuffer(this);
        var v17 = vP392.isBuffer(p42);
        if (v16 && v17) {
          return this.copy(p42, p43, p44, p45);
        }
        if (v25 || v16 || v17 || !vP392.isView(this) || !vP392.isView(p42)) {
          return vP39.copy.call(this, p42, p43, p44, p45);
        }
        var v18 = p44 || p45 != null ? i.call(this, p44, p45) : this;
        p42.set(v18, p43);
        return v18.length;
      }
      function i(p46, p47) {
        var v19 = this.slice || !v25 && this.subarray;
        if (v19) {
          return v19.call(this, p46, p47);
        }
        var v20 = vP392.alloc.call(this, p47 - p46);
        n.call(this, v20, 0, p46, p47);
        return v20;
      }
      function f14(p48, p49, p50) {
        var v21 = !v24 && vP392.isBuffer(this) ? this.toString : vP39.toString;
        return v21.apply(this, arguments);
      }
      function f15(p51) {
        function r() {
          var v22 = this[p51] || vP39[p51];
          return v22.apply(this, arguments);
        }
        return r;
      }
      var vP39 = p39("./buffer-lite");
      p41.copy = n;
      p41.slice = i;
      p41.toString = f14;
      p41.write = f15("write");
      var vP392 = p39("./bufferish");
      var v23 = vP392.global;
      var v24 = vP392.hasBuffer && "TYPED_ARRAY_SUPPORT" in v23;
      var v25 = v24 && !v23.TYPED_ARRAY_SUPPORT;
    }, {
      "./buffer-lite": 3,
      "./bufferish": 8
    }],
    7: [function (p52, p53, v28) {
      function f17(p55) {
        return new Uint8Array(p55);
      }
      function f18(p56) {
        if (vP52.isView(p56)) {
          var v26 = p56.byteOffset;
          var v27 = p56.byteLength;
          p56 = p56.buffer;
          if (p56.byteLength !== v27) {
            if (p56.slice) {
              p56 = p56.slice(v26, v26 + v27);
            } else {
              p56 = new Uint8Array(p56);
              if (p56.byteLength !== v27) {
                p56 = Array.prototype.slice.call(p56, v26, v26 + v27);
              }
            }
          }
        } else {
          if (typeof p56 == "string") {
            return vP52.from.call(v28, p56);
          }
          if (typeof p56 == "number") {
            throw new TypeError("\"value\" argument must not be a number");
          }
        }
        return new Uint8Array(p56);
      }
      var vP52 = p52("./bufferish");
      var v28 = p53.exports = vP52.hasArrayBuffer ? f17(0) : [];
      v28.alloc = f17;
      v28.concat = vP52.concat;
      v28.from = f18;
    }, {
      "./bufferish": 8
    }],
    8: [function (p57, p58, p59) {
      function f19(p60) {
        if (typeof p60 == "string") {
          return f25.call(this, p60);
        } else {
          return f26(this).from(p60);
        }
      }
      function f20(p61) {
        return f26(this).alloc(p61);
      }
      function o(p62, p63) {
        function f22(p64) {
          p63 += p64.length;
        }
        function f23(p65) {
          vLN05 += v43.copy.call(p65, v30, vLN05);
        }
        if (!p63) {
          p63 = 0;
          Array.prototype.forEach.call(p62, f22);
        }
        var v29 = this !== p59 && this || p62[0];
        var v30 = f20.call(v29, p63);
        var vLN05 = 0;
        Array.prototype.forEach.call(p62, f23);
        return v30;
      }
      function f24(p66) {
        return p66 instanceof ArrayBuffer || vF28(p66);
      }
      function f25(p67) {
        var v31 = p67.length * 3;
        var v32 = f20.call(this, v31);
        var v33 = v43.write.call(v32, p67);
        if (v31 !== v33) {
          v32 = v43.slice.call(v32, 0, v33);
        }
        return v32;
      }
      function f26(p68) {
        if (v38(p68)) {
          return v41;
        } else if (v39(p68)) {
          return v42;
        } else if (v37(p68)) {
          return v40;
        } else if (v35) {
          return v41;
        } else if (v36) {
          return v42;
        } else {
          return v40;
        }
      }
      function f27() {
        return false;
      }
      function f28(p69, p70) {
        p69 = "[object " + p69 + "]";
        return function (p71) {
          return p71 != null && {}.toString.call(p70 ? p71[p70] : p71) === p69;
        };
      }
      var v34 = p59.global = p57("./buffer-global");
      var v35 = p59.hasBuffer = v34 && !!v34.isBuffer;
      var v36 = p59.hasArrayBuffer = typeof ArrayBuffer != "undefined";
      var v37 = p59.isArray = p57("isarray");
      p59.isArrayBuffer = v36 ? f24 : f27;
      var v38 = p59.isBuffer = v35 ? v34.isBuffer : f27;
      var v39 = p59.isView = v36 ? ArrayBuffer.isView || f28("ArrayBuffer", "buffer") : f27;
      p59.alloc = f20;
      p59.concat = o;
      p59.from = f19;
      var v40 = p59.Array = p57("./bufferish-array");
      var v41 = p59.Buffer = p57("./bufferish-buffer");
      var v42 = p59.Uint8Array = p57("./bufferish-uint8array");
      var v43 = p59.prototype = p57("./bufferish-proto");
      var vF28 = f28("ArrayBuffer");
    }, {
      "./buffer-global": 2,
      "./bufferish-array": 4,
      "./bufferish-buffer": 5,
      "./bufferish-proto": 6,
      "./bufferish-uint8array": 7,
      isarray: 34
    }],
    9: [function (p72, p73, p74) {
      function f29(p75) {
        if (this instanceof f29) {
          this.options = p75;
          this.init();
          return;
        } else {
          return new f29(p75);
        }
      }
      function f30(p76) {
        for (var v44 in p76) {
          f29.prototype[v44] = f31(f29.prototype[v44], p76[v44]);
        }
      }
      function f31(p77, p78) {
        function f32() {
          p77.apply(this, arguments);
          return p78.apply(this, arguments);
        }
        if (p77 && p78) {
          return f32;
        } else {
          return p77 || p78;
        }
      }
      function f33(p79) {
        function r(p80, p81) {
          return p81(p80);
        }
        p79 = p79.slice();
        return function (p82) {
          return p79.reduce(r, p82);
        };
      }
      function f35(p83) {
        if (vP72(p83)) {
          return f33(p83);
        } else {
          return p83;
        }
      }
      function f36(p84) {
        return new f29(p84);
      }
      var vP72 = p72("isarray");
      p74.createCodec = f36;
      p74.install = f30;
      p74.filter = f35;
      var vP722 = p72("./bufferish");
      f29.prototype.init = function () {
        var v45 = this.options;
        if (v45 && v45.uint8array) {
          this.bufferish = vP722.Uint8Array;
        }
        return this;
      };
      p74.preset = f36({
        preset: true
      });
    }, {
      "./bufferish": 8,
      isarray: 34
    }],
    10: [function (p85, p86, p87) {
      p85("./read-core");
      p85("./write-core");
      p87.codec = {
        preset: p85("./codec-base").preset
      };
    }, {
      "./codec-base": 9,
      "./read-core": 22,
      "./write-core": 25
    }],
    11: [function (p88, p89, p90) {
      function f37(p91) {
        if (!(this instanceof f37)) {
          return new f37(p91);
        }
        if (p91 && (this.options = p91, p91.codec)) {
          var v46 = this.codec = p91.codec;
          if (v46.bufferish) {
            this.bufferish = v46.bufferish;
          }
        }
      }
      p90.DecodeBuffer = f37;
      var v47 = p88("./read-core").preset;
      var v48 = p88("./flex-buffer").FlexDecoder;
      v48.mixin(f37.prototype);
      f37.prototype.codec = v47;
      f37.prototype.fetch = function () {
        return this.codec.decode(this);
      };
    }, {
      "./flex-buffer": 21,
      "./read-core": 22
    }],
    12: [function (p92, p93, p94) {
      function f38(p95, p96) {
        var v49 = new v50(p96);
        v49.write(p95);
        return v49.read();
      }
      p94.decode = f38;
      var v50 = p92("./decode-buffer").DecodeBuffer;
    }, {
      "./decode-buffer": 11
    }],
    13: [function (p97, p98, p99) {
      function f39(p100) {
        if (this instanceof f39) {
          v51.call(this, p100);
          return;
        } else {
          return new f39(p100);
        }
      }
      p99.Decoder = f39;
      var vP97 = p97("event-lite");
      var v51 = p97("./decode-buffer").DecodeBuffer;
      f39.prototype = new v51();
      vP97.mixin(f39.prototype);
      f39.prototype.decode = function (p101) {
        if (arguments.length) {
          this.write(p101);
        }
        this.flush();
      };
      f39.prototype.push = function (p102) {
        this.emit("data", p102);
      };
      f39.prototype.end = function (p103) {
        this.decode(p103);
        this.emit("end");
      };
    }, {
      "./decode-buffer": 11,
      "event-lite": 31
    }],
    14: [function (p104, p105, p106) {
      function f40(p107) {
        if (!(this instanceof f40)) {
          return new f40(p107);
        }
        if (p107 && (this.options = p107, p107.codec)) {
          var v52 = this.codec = p107.codec;
          if (v52.bufferish) {
            this.bufferish = v52.bufferish;
          }
        }
      }
      p106.EncodeBuffer = f40;
      var v53 = p104("./write-core").preset;
      var v54 = p104("./flex-buffer").FlexEncoder;
      v54.mixin(f40.prototype);
      f40.prototype.codec = v53;
      f40.prototype.write = function (p108) {
        this.codec.encode(this, p108);
      };
    }, {
      "./flex-buffer": 21,
      "./write-core": 25
    }],
    15: [function (p109, p110, p111) {
      function f41(p112, p113) {
        var v55 = new v56(p113);
        v55.write(p112);
        return v55.read();
      }
      p111.encode = f41;
      var v56 = p109("./encode-buffer").EncodeBuffer;
    }, {
      "./encode-buffer": 14
    }],
    16: [function (p114, p115, p116) {
      function f42(p117) {
        if (this instanceof f42) {
          v57.call(this, p117);
          return;
        } else {
          return new f42(p117);
        }
      }
      p116.Encoder = f42;
      var vP114 = p114("event-lite");
      var v57 = p114("./encode-buffer").EncodeBuffer;
      f42.prototype = new v57();
      vP114.mixin(f42.prototype);
      f42.prototype.encode = function (p118) {
        this.write(p118);
        this.emit("data", this.read());
      };
      f42.prototype.end = function (p119) {
        if (arguments.length) {
          this.encode(p119);
        }
        this.flush();
        this.emit("end");
      };
    }, {
      "./encode-buffer": 14,
      "event-lite": 31
    }],
    17: [function (p120, p121, p122) {
      function f43(p123, p124) {
        if (this instanceof f43) {
          this.buffer = vP120.from(p123);
          this.type = p124;
          return;
        } else {
          return new f43(p123, p124);
        }
      }
      p122.ExtBuffer = f43;
      var vP120 = p120("./bufferish");
    }, {
      "./bufferish": 8
    }],
    18: [function (p125, p126, p127) {
      function f44(p128) {
        p128.addExtPacker(14, Error, [f48, f45]);
        p128.addExtPacker(1, EvalError, [f48, f45]);
        p128.addExtPacker(2, RangeError, [f48, f45]);
        p128.addExtPacker(3, ReferenceError, [f48, f45]);
        p128.addExtPacker(4, SyntaxError, [f48, f45]);
        p128.addExtPacker(5, TypeError, [f48, f45]);
        p128.addExtPacker(6, URIError, [f48, f45]);
        p128.addExtPacker(10, RegExp, [f47, f45]);
        p128.addExtPacker(11, Boolean, [f46, f45]);
        p128.addExtPacker(12, String, [f46, f45]);
        p128.addExtPacker(13, Date, [Number, f45]);
        p128.addExtPacker(15, Number, [f46, f45]);
        if (typeof Uint8Array != "undefined") {
          p128.addExtPacker(17, Int8Array, v61);
          p128.addExtPacker(18, Uint8Array, v61);
          p128.addExtPacker(19, Int16Array, v61);
          p128.addExtPacker(20, Uint16Array, v61);
          p128.addExtPacker(21, Int32Array, v61);
          p128.addExtPacker(22, Uint32Array, v61);
          p128.addExtPacker(23, Float32Array, v61);
          if (typeof Float64Array != "undefined") {
            p128.addExtPacker(24, Float64Array, v61);
          }
          if (typeof Uint8ClampedArray != "undefined") {
            p128.addExtPacker(25, Uint8ClampedArray, v61);
          }
          p128.addExtPacker(26, ArrayBuffer, v61);
          p128.addExtPacker(29, DataView, v61);
        }
        if (vP125.hasBuffer) {
          p128.addExtPacker(27, v60, vP125.from);
        }
      }
      function f45(p129) {
        v59 ||= p125("./encode").encode;
        return v59(p129);
      }
      function f46(p130) {
        return p130.valueOf();
      }
      function f47(p131) {
        p131 = RegExp.prototype.toString.call(p131).split("/");
        p131.shift();
        var vA = [p131.pop()];
        vA.unshift(p131.join("/"));
        return vA;
      }
      function f48(p132) {
        var vO = {};
        for (var v58 in vO2) {
          vO[v58] = p132[v58];
        }
        return vO;
      }
      p127.setExtPackers = f44;
      var v59;
      var vP125 = p125("./bufferish");
      var v60 = vP125.global;
      var v61 = vP125.Uint8Array.from;
      var vO2 = {
        name: 1,
        message: 1,
        stack: 1,
        columnNumber: 1,
        fileName: 1,
        lineNumber: 1
      };
    }, {
      "./bufferish": 8,
      "./encode": 15
    }],
    19: [function (p133, p134, p135) {
      function f49(p136) {
        p136.addExtUnpacker(14, [f50, f52(Error)]);
        p136.addExtUnpacker(1, [f50, f52(EvalError)]);
        p136.addExtUnpacker(2, [f50, f52(RangeError)]);
        p136.addExtUnpacker(3, [f50, f52(ReferenceError)]);
        p136.addExtUnpacker(4, [f50, f52(SyntaxError)]);
        p136.addExtUnpacker(5, [f50, f52(TypeError)]);
        p136.addExtUnpacker(6, [f50, f52(URIError)]);
        p136.addExtUnpacker(10, [f50, f51]);
        p136.addExtUnpacker(11, [f50, f53(Boolean)]);
        p136.addExtUnpacker(12, [f50, f53(String)]);
        p136.addExtUnpacker(13, [f50, f53(Date)]);
        p136.addExtUnpacker(15, [f50, f53(Number)]);
        if (typeof Uint8Array != "undefined") {
          p136.addExtUnpacker(17, f53(Int8Array));
          p136.addExtUnpacker(18, f53(Uint8Array));
          p136.addExtUnpacker(19, [f54, f53(Int16Array)]);
          p136.addExtUnpacker(20, [f54, f53(Uint16Array)]);
          p136.addExtUnpacker(21, [f54, f53(Int32Array)]);
          p136.addExtUnpacker(22, [f54, f53(Uint32Array)]);
          p136.addExtUnpacker(23, [f54, f53(Float32Array)]);
          if (typeof Float64Array != "undefined") {
            p136.addExtUnpacker(24, [f54, f53(Float64Array)]);
          }
          if (typeof Uint8ClampedArray != "undefined") {
            p136.addExtUnpacker(25, f53(Uint8ClampedArray));
          }
          p136.addExtUnpacker(26, f54);
          p136.addExtUnpacker(29, [f54, f53(DataView)]);
        }
        if (vP133.hasBuffer) {
          p136.addExtUnpacker(27, f53(v65));
        }
      }
      function f50(p137) {
        v64 ||= p133("./decode").decode;
        return v64(p137);
      }
      function f51(p138) {
        return RegExp.apply(null, p138);
      }
      function f52(p139) {
        return function (p140) {
          var v62 = new p139();
          for (var v63 in vO3) {
            v62[v63] = p140[v63];
          }
          return v62;
        };
      }
      function f53(p141) {
        return function (p142) {
          return new p141(p142);
        };
      }
      function f54(p143) {
        return new Uint8Array(p143).buffer;
      }
      p135.setExtUnpackers = f49;
      var v64;
      var vP133 = p133("./bufferish");
      var v65 = vP133.global;
      var vO3 = {
        name: 1,
        message: 1,
        stack: 1,
        columnNumber: 1,
        fileName: 1,
        lineNumber: 1
      };
    }, {
      "./bufferish": 8,
      "./decode": 12
    }],
    20: [function (p144, p145, p146) {
      p144("./read-core");
      p144("./write-core");
      p146.createCodec = p144("./codec-base").createCodec;
    }, {
      "./codec-base": 9,
      "./read-core": 22,
      "./write-core": 25
    }],
    21: [function (p147, p148, p149) {
      function f55() {
        if (!(this instanceof f55)) {
          return new f55();
        }
      }
      function f56() {
        if (!(this instanceof f56)) {
          return new f56();
        }
      }
      function f57() {
        function t(p150) {
          var v66 = this.offset ? vP147.prototype.slice.call(this.buffer, this.offset) : this.buffer;
          this.buffer = v66 ? p150 ? this.bufferish.concat([v66, p150]) : v66 : p150;
          this.offset = 0;
        }
        function r() {
          while (this.offset < this.buffer.length) {
            var v67;
            var v68 = this.offset;
            try {
              v67 = this.fetch();
            } catch (e2) {
              if (e2 && e2.message != vLSBUFFER_SHORTAGE) {
                throw e2;
              }
              this.offset = v68;
              break;
            }
            this.push(v67);
          }
        }
        function e(p151) {
          var v69 = this.offset;
          var v70 = v69 + p151;
          if (v70 > this.buffer.length) {
            throw new Error(vLSBUFFER_SHORTAGE);
          }
          this.offset = v70;
          return v69;
        }
        return {
          bufferish: vP147,
          write: t,
          fetch: f68,
          flush: r,
          push: f70,
          pull: f71,
          read: f69,
          reserve: e,
          offset: 0
        };
      }
      function f61() {
        function t() {
          var v71 = this.start;
          if (v71 < this.offset) {
            var v72 = this.start = this.offset;
            return vP147.prototype.slice.call(this.buffer, v71, v72);
          }
        }
        function f63() {
          while (this.start < this.offset) {
            var v73 = this.fetch();
            if (v73) {
              this.push(v73);
            }
          }
        }
        function f64() {
          var v74 = this.buffers ||= [];
          var v75 = v74.length > 1 ? this.bufferish.concat(v74) : v74[0];
          v74.length = 0;
          return v75;
        }
        function n(p152) {
          var v76 = p152 | 0;
          if (this.buffer) {
            var v77 = this.buffer.length;
            var v78 = this.offset | 0;
            var v79 = v78 + v76;
            if (v79 < v77) {
              this.offset = v79;
              return v78;
            }
            this.flush();
            p152 = Math.max(p152, Math.min(v77 * 2, this.maxBufferSize));
          }
          p152 = Math.max(p152, this.minBufferSize);
          this.buffer = this.bufferish.alloc(p152);
          this.start = 0;
          this.offset = v76;
          return 0;
        }
        function f66(p153) {
          var v80 = p153.length;
          if (v80 > this.minBufferSize) {
            this.flush();
            this.push(p153);
          } else {
            var v81 = this.reserve(v80);
            vP147.prototype.copy.call(p153, this.buffer, v81);
          }
        }
        return {
          bufferish: vP147,
          write: f67,
          fetch: t,
          flush: f63,
          push: f70,
          pull: f64,
          read: f69,
          reserve: n,
          send: f66,
          maxBufferSize: vLN65536,
          minBufferSize: vLN2048,
          offset: 0,
          start: 0
        };
      }
      function f67() {
        throw new Error("method not implemented: write()");
      }
      function f68() {
        throw new Error("method not implemented: fetch()");
      }
      function f69() {
        var v82 = this.buffers && this.buffers.length;
        if (v82) {
          this.flush();
          return this.pull();
        } else {
          return this.fetch();
        }
      }
      function f70(p154) {
        var v83 = this.buffers ||= [];
        v83.push(p154);
      }
      function f71() {
        var v84 = this.buffers ||= [];
        return v84.shift();
      }
      function f72(p155) {
        function r(p156) {
          for (var v85 in p155) {
            p156[v85] = p155[v85];
          }
          return p156;
        }
        return r;
      }
      p149.FlexDecoder = f55;
      p149.FlexEncoder = f56;
      var vP147 = p147("./bufferish");
      var vLN2048 = 2048;
      var vLN65536 = 65536;
      var vLSBUFFER_SHORTAGE = "BUFFER_SHORTAGE";
      f55.mixin = f72(f57());
      f55.mixin(f55.prototype);
      f56.mixin = f72(f61());
      f56.mixin(f56.prototype);
    }, {
      "./bufferish": 8
    }],
    22: [function (p157, p158, p159) {
      function f74(p160) {
        function r(p161) {
          var vS = v92(p161);
          var v86 = v87[vS];
          if (!v86) {
            throw new Error("Invalid type: " + (vS ? "0x" + vS.toString(16) : vS));
          }
          return v86(p161);
        }
        var v87 = vP1572.getReadToken(p160);
        return r;
      }
      function f76() {
        var v88 = this.options;
        this.decode = f74(v88);
        if (v88 && v88.preset) {
          vP157.setExtUnpackers(this);
        }
        return this;
      }
      function f77(p162, p163) {
        var v89 = this.extUnpackers ||= [];
        v89[p162] = vP1573.filter(p163);
      }
      function f78(p164) {
        function r(p165) {
          return new v91(p165, p164);
        }
        var v90 = this.extUnpackers ||= [];
        return v90[p164] || r;
      }
      var v91 = p157("./ext-buffer").ExtBuffer;
      var vP157 = p157("./ext-unpacker");
      var v92 = p157("./read-format").readUint8;
      var vP1572 = p157("./read-token");
      var vP1573 = p157("./codec-base");
      vP1573.install({
        addExtUnpacker: f77,
        getExtUnpacker: f78,
        init: f76
      });
      p159.preset = f76.call(vP1573.preset);
    }, {
      "./codec-base": 9,
      "./ext-buffer": 17,
      "./ext-unpacker": 19,
      "./read-format": 23,
      "./read-token": 24
    }],
    23: [function (p166, p167, p168) {
      function n(p169) {
        var v93 = vP1663.hasArrayBuffer && p169 && p169.binarraybuffer;
        var v94 = p169 && p169.int64;
        var v95 = v135 && p169 && p169.usemap;
        var vO4 = {
          map: v95 ? o : i,
          array: f83,
          str: f84,
          bin: v93 ? f86 : f85,
          ext: f87,
          uint8: f88,
          uint16: f90,
          uint32: f92,
          uint64: f94(8, v94 ? f97 : f95),
          int8: f89,
          int16: f91,
          int32: f93,
          int64: f94(8, v94 ? f98 : f96),
          float32: f94(4, f99),
          float64: f94(8, f100)
        };
        return vO4;
      }
      function i(p170, p171) {
        var v96;
        var vO5 = {};
        var v97 = new Array(p171);
        var v98 = new Array(p171);
        var v99 = p170.codec.decode;
        for (v96 = 0; v96 < p171; v96++) {
          v97[v96] = v99(p170);
          v98[v96] = v99(p170);
        }
        for (v96 = 0; v96 < p171; v96++) {
          vO5[v97[v96]] = v98[v96];
        }
        return vO5;
      }
      function o(p172, p173) {
        var v100;
        var v101 = new Map();
        var v102 = new Array(p173);
        var v103 = new Array(p173);
        var v104 = p172.codec.decode;
        for (v100 = 0; v100 < p173; v100++) {
          v102[v100] = v104(p172);
          v103[v100] = v104(p172);
        }
        for (v100 = 0; v100 < p173; v100++) {
          v101.set(v102[v100], v103[v100]);
        }
        return v101;
      }
      function f83(p174, p175) {
        var v105 = new Array(p175);
        var v106 = p174.codec.decode;
        for (var vLN06 = 0; vLN06 < p175; vLN06++) {
          v105[vLN06] = v106(p174);
        }
        return v105;
      }
      function f84(p176, p177) {
        var v107 = p176.reserve(p177);
        var v108 = v107 + p177;
        return vP1664.toString.call(p176.buffer, "utf-8", v107, v108);
      }
      function f85(p178, p179) {
        var v109 = p178.reserve(p179);
        var v110 = v109 + p179;
        var v111 = vP1664.slice.call(p178.buffer, v109, v110);
        return vP1663.from(v111);
      }
      function f86(p180, p181) {
        var v112 = p180.reserve(p181);
        var v113 = v112 + p181;
        var v114 = vP1664.slice.call(p180.buffer, v112, v113);
        return vP1663.Uint8Array.from(v114).buffer;
      }
      function f87(p182, p183) {
        var v115 = p182.reserve(p183 + 1);
        var v116 = p182.buffer[v115++];
        var v117 = v115 + p183;
        var v118 = p182.codec.getExtUnpacker(v116);
        if (!v118) {
          throw new Error("Invalid ext type: " + (v116 ? "0x" + v116.toString(16) : v116));
        }
        var v119 = vP1664.slice.call(p182.buffer, v115, v117);
        return v118(v119);
      }
      function f88(p184) {
        var v120 = p184.reserve(1);
        return p184.buffer[v120];
      }
      function f89(p185) {
        var v121 = p185.reserve(1);
        var v122 = p185.buffer[v121];
        if (v122 & 128) {
          return v122 - 256;
        } else {
          return v122;
        }
      }
      function f90(p186) {
        var v123 = p186.reserve(2);
        var v124 = p186.buffer;
        return v124[v123++] << 8 | v124[v123];
      }
      function f91(p187) {
        var v125 = p187.reserve(2);
        var v126 = p187.buffer;
        var v127 = v126[v125++] << 8 | v126[v125];
        if (v127 & 32768) {
          return v127 - 65536;
        } else {
          return v127;
        }
      }
      function f92(p188) {
        var v128 = p188.reserve(4);
        var v129 = p188.buffer;
        return v129[v128++] * 16777216 + (v129[v128++] << 16) + (v129[v128++] << 8) + v129[v128];
      }
      function f93(p189) {
        var v130 = p189.reserve(4);
        var v131 = p189.buffer;
        return v131[v130++] << 24 | v131[v130++] << 16 | v131[v130++] << 8 | v131[v130];
      }
      function f94(p190, p191) {
        return function (p192) {
          var v132 = p192.reserve(p190);
          return p191.call(p192.buffer, v132, v136);
        };
      }
      function f95(p193) {
        return new v133(this, p193).toNumber();
      }
      function f96(p194) {
        return new v134(this, p194).toNumber();
      }
      function f97(p195) {
        return new v133(this, p195);
      }
      function f98(p196) {
        return new v134(this, p196);
      }
      function f99(p197) {
        return vP166.read(this, p197, false, 23, 4);
      }
      function f100(p198) {
        return vP166.read(this, p198, false, 52, 8);
      }
      var vP166 = p166("ieee754");
      var vP1662 = p166("int64-buffer");
      var v133 = vP1662.Uint64BE;
      var v134 = vP1662.Int64BE;
      p168.getReadFormat = n;
      p168.readUint8 = f88;
      var vP1663 = p166("./bufferish");
      var vP1664 = p166("./bufferish-proto");
      var v135 = typeof Map != "undefined";
      var v136 = true;
    }, {
      "./bufferish": 8,
      "./bufferish-proto": 6,
      ieee754: 32,
      "int64-buffer": 33
    }],
    24: [function (p199, p200, p201) {
      function f101(p202) {
        var v137 = vP199.getReadFormat(p202);
        if (p202 && p202.useraw) {
          return f103(v137);
        } else {
          return f102(v137);
        }
      }
      function f102(p203) {
        var v138;
        var v139 = new Array(256);
        for (v138 = 0; v138 <= 127; v138++) {
          v139[v138] = f104(v138);
        }
        for (v138 = 128; v138 <= 143; v138++) {
          v139[v138] = f106(v138 - 128, p203.map);
        }
        for (v138 = 144; v138 <= 159; v138++) {
          v139[v138] = f106(v138 - 144, p203.array);
        }
        for (v138 = 160; v138 <= 191; v138++) {
          v139[v138] = f106(v138 - 160, p203.str);
        }
        v139[192] = f104(null);
        v139[193] = null;
        v139[194] = f104(false);
        v139[195] = f104(true);
        v139[196] = f105(p203.uint8, p203.bin);
        v139[197] = f105(p203.uint16, p203.bin);
        v139[198] = f105(p203.uint32, p203.bin);
        v139[199] = f105(p203.uint8, p203.ext);
        v139[200] = f105(p203.uint16, p203.ext);
        v139[201] = f105(p203.uint32, p203.ext);
        v139[202] = p203.float32;
        v139[203] = p203.float64;
        v139[204] = p203.uint8;
        v139[205] = p203.uint16;
        v139[206] = p203.uint32;
        v139[207] = p203.uint64;
        v139[208] = p203.int8;
        v139[209] = p203.int16;
        v139[210] = p203.int32;
        v139[211] = p203.int64;
        v139[212] = f106(1, p203.ext);
        v139[213] = f106(2, p203.ext);
        v139[214] = f106(4, p203.ext);
        v139[215] = f106(8, p203.ext);
        v139[216] = f106(16, p203.ext);
        v139[217] = f105(p203.uint8, p203.str);
        v139[218] = f105(p203.uint16, p203.str);
        v139[219] = f105(p203.uint32, p203.str);
        v139[220] = f105(p203.uint16, p203.array);
        v139[221] = f105(p203.uint32, p203.array);
        v139[222] = f105(p203.uint16, p203.map);
        v139[223] = f105(p203.uint32, p203.map);
        v138 = 224;
        for (; v138 <= 255; v138++) {
          v139[v138] = f104(v138 - 256);
        }
        return v139;
      }
      function f103(p204) {
        var v140;
        var v141 = f102(p204).slice();
        v141[217] = v141[196];
        v141[218] = v141[197];
        v141[219] = v141[198];
        v140 = 160;
        for (; v140 <= 191; v140++) {
          v141[v140] = f106(v140 - 160, p204.bin);
        }
        return v141;
      }
      function f104(p205) {
        return function () {
          return p205;
        };
      }
      function f105(p206, p207) {
        return function (p208) {
          var vP206 = p206(p208);
          return p207(p208, vP206);
        };
      }
      function f106(p209, p210) {
        return function (p211) {
          return p210(p211, p209);
        };
      }
      var vP199 = p199("./read-format");
      p201.getReadToken = f101;
    }, {
      "./read-format": 23
    }],
    25: [function (p212, p213, p214) {
      function f107(p215) {
        function r(p216, p217) {
          var v142 = v143[typeof p217];
          if (!v142) {
            throw new Error("Unsupported type \"" + typeof p217 + "\": " + p217);
          }
          v142(p216, p217);
        }
        var v143 = vP2122.getWriteType(p215);
        return r;
      }
      function f109() {
        var v144 = this.options;
        this.encode = f107(v144);
        if (v144 && v144.preset) {
          vP212.setExtPackers(this);
        }
        return this;
      }
      function o(p218, p219, p220) {
        function f111(p221) {
          if (p220) {
            p221 = p220(p221);
          }
          return new v154(p221, p218);
        }
        p220 = vP2123.filter(p220);
        var v145 = p219.name;
        if (v145 && v145 !== "Object") {
          var v146 = this.extPackers ||= {};
          v146[v145] = f111;
        } else {
          var v147 = this.extEncoderList ||= [];
          v147.unshift([p219, f111]);
        }
      }
      function f(p222) {
        var v148 = this.extPackers ||= {};
        var v149 = p222.constructor;
        var v150 = v149 && v149.name && v148[v149.name];
        if (v150) {
          return v150;
        }
        var v151 = this.extEncoderList ||= [];
        for (var v152 = v151.length, vLN07 = 0; vLN07 < v152; vLN07++) {
          var v153 = v151[vLN07];
          if (v149 === v153[0]) {
            return v153[1];
          }
        }
      }
      var v154 = p212("./ext-buffer").ExtBuffer;
      var vP212 = p212("./ext-packer");
      var vP2122 = p212("./write-type");
      var vP2123 = p212("./codec-base");
      vP2123.install({
        addExtPacker: o,
        getExtPacker: f,
        init: f109
      });
      p214.preset = f109.call(vP2123.preset);
    }, {
      "./codec-base": 9,
      "./ext-buffer": 17,
      "./ext-packer": 18,
      "./write-type": 27
    }],
    26: [function (p223, p224, p225) {
      function f113(p226) {
        if (p226 && p226.uint8array) {
          return f114();
        } else if (v169 || vP2233.hasBuffer && p226 && p226.safe) {
          return f116();
        } else {
          return f115();
        }
      }
      function f114() {
        var vO6 = f115();
        vO6[202] = f120(202, 4, f123);
        vO6[203] = f120(203, 8, f124);
        return vO6;
      }
      function f115() {
        var v155 = v166.slice();
        v155[196] = f117(196);
        v155[197] = f118(197);
        v155[198] = f119(198);
        v155[199] = f117(199);
        v155[200] = f118(200);
        v155[201] = f119(201);
        v155[202] = f120(202, 4, v170.writeFloatBE || f123, true);
        v155[203] = f120(203, 8, v170.writeDoubleBE || f124, true);
        v155[204] = f117(204);
        v155[205] = f118(205);
        v155[206] = f119(206);
        v155[207] = f120(207, 8, f121);
        v155[208] = f117(208);
        v155[209] = f118(209);
        v155[210] = f119(210);
        v155[211] = f120(211, 8, f122);
        v155[217] = f117(217);
        v155[218] = f118(218);
        v155[219] = f119(219);
        v155[220] = f118(220);
        v155[221] = f119(221);
        v155[222] = f118(222);
        v155[223] = f119(223);
        return v155;
      }
      function f116() {
        var v156 = v166.slice();
        v156[196] = f120(196, 1, v167.prototype.writeUInt8);
        v156[197] = f120(197, 2, v167.prototype.writeUInt16BE);
        v156[198] = f120(198, 4, v167.prototype.writeUInt32BE);
        v156[199] = f120(199, 1, v167.prototype.writeUInt8);
        v156[200] = f120(200, 2, v167.prototype.writeUInt16BE);
        v156[201] = f120(201, 4, v167.prototype.writeUInt32BE);
        v156[202] = f120(202, 4, v167.prototype.writeFloatBE);
        v156[203] = f120(203, 8, v167.prototype.writeDoubleBE);
        v156[204] = f120(204, 1, v167.prototype.writeUInt8);
        v156[205] = f120(205, 2, v167.prototype.writeUInt16BE);
        v156[206] = f120(206, 4, v167.prototype.writeUInt32BE);
        v156[207] = f120(207, 8, f121);
        v156[208] = f120(208, 1, v167.prototype.writeInt8);
        v156[209] = f120(209, 2, v167.prototype.writeInt16BE);
        v156[210] = f120(210, 4, v167.prototype.writeInt32BE);
        v156[211] = f120(211, 8, f122);
        v156[217] = f120(217, 1, v167.prototype.writeUInt8);
        v156[218] = f120(218, 2, v167.prototype.writeUInt16BE);
        v156[219] = f120(219, 4, v167.prototype.writeUInt32BE);
        v156[220] = f120(220, 2, v167.prototype.writeUInt16BE);
        v156[221] = f120(221, 4, v167.prototype.writeUInt32BE);
        v156[222] = f120(222, 2, v167.prototype.writeUInt16BE);
        v156[223] = f120(223, 4, v167.prototype.writeUInt32BE);
        return v156;
      }
      function f117(p227) {
        return function (p228, p229) {
          var v157 = p228.reserve(2);
          var v158 = p228.buffer;
          v158[v157++] = p227;
          v158[v157] = p229;
        };
      }
      function f118(p230) {
        return function (p231, p232) {
          var v159 = p231.reserve(3);
          var v160 = p231.buffer;
          v160[v159++] = p230;
          v160[v159++] = p232 >>> 8;
          v160[v159] = p232;
        };
      }
      function f119(p233) {
        return function (p234, p235) {
          var v161 = p234.reserve(5);
          var v162 = p234.buffer;
          v162[v161++] = p233;
          v162[v161++] = p235 >>> 24;
          v162[v161++] = p235 >>> 16;
          v162[v161++] = p235 >>> 8;
          v162[v161] = p235;
        };
      }
      function f120(p236, p237, p238, p239) {
        return function (p240, p241) {
          var v163 = p240.reserve(p237 + 1);
          p240.buffer[v163++] = p236;
          p238.call(p240.buffer, p241, v163, p239);
        };
      }
      function f121(p242, p243) {
        new v164(this, p243, p242);
      }
      function f122(p244, p245) {
        new v165(this, p245, p244);
      }
      function f123(p246, p247) {
        vP223.write(this, p246, p247, false, 23, 4);
      }
      function f124(p248, p249) {
        vP223.write(this, p248, p249, false, 52, 8);
      }
      var vP223 = p223("ieee754");
      var vP2232 = p223("int64-buffer");
      var v164 = vP2232.Uint64BE;
      var v165 = vP2232.Int64BE;
      var v166 = p223("./write-uint8").uint8;
      var vP2233 = p223("./bufferish");
      var v167 = vP2233.global;
      var v168 = vP2233.hasBuffer && "TYPED_ARRAY_SUPPORT" in v167;
      var v169 = v168 && !v167.TYPED_ARRAY_SUPPORT;
      var v170 = vP2233.hasBuffer && v167.prototype || {};
      p225.getWriteToken = f113;
    }, {
      "./bufferish": 8,
      "./write-uint8": 28,
      ieee754: 32,
      "int64-buffer": 33
    }],
    27: [function (p250, p251, p252) {
      function n(p253) {
        function r(p254, p255) {
          var v171 = p255 ? 195 : 194;
          v199[v171](p254, p255);
        }
        function e(p256, p257) {
          var v172;
          var v173 = p257 | 0;
          if (p257 !== v173) {
            v172 = 203;
            v199[v172](p256, p257);
            return;
          } else {
            v172 = v173 >= -32 && v173 <= 127 ? v173 & 255 : v173 >= 0 ? v173 <= 255 ? 204 : v173 <= 65535 ? 205 : 206 : v173 >= -128 ? 208 : v173 >= -32768 ? 209 : 210;
            v199[v172](p256, v173);
            return;
          }
        }
        function f128(p258, p259) {
          var vLN207 = 207;
          v199[vLN207](p258, p259.toArray());
        }
        function f129(p260, p261) {
          var vLN211 = 211;
          v199[vLN211](p260, p261.toArray());
        }
        function f130(p262) {
          if (p262 < 32) {
            return 1;
          } else if (p262 <= 255) {
            return 2;
          } else if (p262 <= 65535) {
            return 3;
          } else {
            return 5;
          }
        }
        function f131(p263) {
          if (p263 < 32) {
            return 1;
          } else if (p263 <= 65535) {
            return 3;
          } else {
            return 5;
          }
        }
        function f132(p264) {
          function r(p265, p266) {
            var v174 = p266.length;
            var v175 = 5 + v174 * 3;
            p265.offset = p265.reserve(v175);
            var v176 = p265.buffer;
            var vP264 = p264(v174);
            var v177 = p265.offset + vP264;
            v174 = vP2504.write.call(v176, p266, v177);
            var vP2642 = p264(v174);
            if (vP264 !== vP2642) {
              var v178 = v177 + vP2642 - vP264;
              var v179 = v177 + v174;
              vP2504.copy.call(v176, v176, v178, v177, v179);
            }
            var v180 = vP2642 === 1 ? 160 + v174 : vP2642 <= 3 ? 215 + vP2642 : 219;
            v199[v180](p265, v174);
            p265.offset += v174;
          }
          return r;
        }
        function f134(p267, p268) {
          if (p268 === null) {
            return f136(p267, p268);
          }
          if (v202(p268)) {
            return v203(p267, p268);
          }
          if (vP250(p268)) {
            return f137(p267, p268);
          }
          if (v206.isUint64BE(p268)) {
            return f128(p267, p268);
          }
          if (v207.isInt64BE(p268)) {
            return f129(p267, p268);
          }
          var v181 = p267.codec.getExtPacker(p268);
          if (v181) {
            p268 = v181(p268);
          }
          if (p268 instanceof v209) {
            return f140(p267, p268);
          } else {
            v205(p267, p268);
            return;
          }
        }
        function f135(p269, p270) {
          if (v202(p270)) {
            return f143(p269, p270);
          } else {
            f134(p269, p270);
            return;
          }
        }
        function f136(p271, p272) {
          var vLN192 = 192;
          v199[vLN192](p271, p272);
        }
        function f137(p273, p274) {
          var v182 = p274.length;
          var v183 = v182 < 16 ? 144 + v182 : v182 <= 65535 ? 220 : 221;
          v199[v183](p273, v182);
          var v184 = p273.codec.encode;
          for (var vLN08 = 0; vLN08 < v182; vLN08++) {
            v184(p273, p274[vLN08]);
          }
        }
        function f138(p275, p276) {
          var v185 = p276.length;
          var v186 = v185 < 255 ? 196 : v185 <= 65535 ? 197 : 198;
          v199[v186](p275, v185);
          p275.send(p276);
        }
        function f139(p277, p278) {
          f138(p277, new Uint8Array(p278));
        }
        function f140(p279, p280) {
          var v187 = p280.buffer;
          var v188 = v187.length;
          var v189 = vA2[v188] || (v188 < 255 ? 199 : v188 <= 65535 ? 200 : 201);
          v199[v189](p279, v188);
          v208[p280.type](p279);
          p279.send(v187);
        }
        function f141(p281, p282) {
          var v190 = Object.keys(p282);
          var v191 = v190.length;
          var v192 = v191 < 16 ? 128 + v191 : v191 <= 65535 ? 222 : 223;
          v199[v192](p281, v191);
          var v193 = p281.codec.encode;
          v190.forEach(function (p283) {
            v193(p281, p283);
            v193(p281, p282[p283]);
          });
        }
        function f142(p284, p285) {
          if (!(p285 instanceof Map)) {
            return f141(p284, p285);
          }
          var v194 = p285.size;
          var v195 = v194 < 16 ? 128 + v194 : v194 <= 65535 ? 222 : 223;
          v199[v195](p284, v194);
          var v196 = p284.codec.encode;
          p285.forEach(function (p286, p287, p288) {
            v196(p284, p287);
            v196(p284, p286);
          });
        }
        function f143(p289, p290) {
          var v197 = p290.length;
          var v198 = v197 < 32 ? 160 + v197 : v197 <= 65535 ? 218 : 219;
          v199[v198](p289, v197);
          p289.send(p290);
        }
        var v199 = vP2505.getWriteToken(p253);
        var v200 = p253 && p253.useraw;
        var v201 = v210 && p253 && p253.binarraybuffer;
        var v202 = v201 ? vP2503.isArrayBuffer : vP2503.isBuffer;
        var v203 = v201 ? f139 : f138;
        var v204 = v211 && p253 && p253.usemap;
        var v205 = v204 ? f142 : f141;
        var vO7 = {
          boolean: r,
          function: f136,
          number: e,
          object: v200 ? f135 : f134,
          string: f132(v200 ? f131 : f130),
          symbol: f136,
          undefined: f136
        };
        return vO7;
      }
      var vP250 = p250("isarray");
      var vP2502 = p250("int64-buffer");
      var v206 = vP2502.Uint64BE;
      var v207 = vP2502.Int64BE;
      var vP2503 = p250("./bufferish");
      var vP2504 = p250("./bufferish-proto");
      var vP2505 = p250("./write-token");
      var v208 = p250("./write-uint8").uint8;
      var v209 = p250("./ext-buffer").ExtBuffer;
      var v210 = typeof Uint8Array != "undefined";
      var v211 = typeof Map != "undefined";
      var vA2 = [];
      vA2[1] = 212;
      vA2[2] = 213;
      vA2[4] = 214;
      vA2[8] = 215;
      vA2[16] = 216;
      p252.getWriteType = n;
    }, {
      "./bufferish": 8,
      "./bufferish-proto": 6,
      "./ext-buffer": 17,
      "./write-token": 26,
      "./write-uint8": 28,
      "int64-buffer": 33,
      isarray: 34
    }],
    28: [function (p291, p292, p293) {
      function f144(p294) {
        return function (p295) {
          var v212 = p295.reserve(1);
          p295.buffer[v212] = p294;
        };
      }
      var v213 = p293.uint8 = new Array(256);
      for (var vLN09 = 0; vLN09 <= 255; vLN09++) {
        v213[vLN09] = f144(vLN09);
      }
    }, {}],
    29: [function (p296, p297, p298) {
      (function (p299) {
        "use strict";

        function f145() {
          try {
            var v214 = new Uint8Array(1);
            v214.__proto__ = {
              __proto__: Uint8Array.prototype,
              foo: function () {
                return 42;
              }
            };
            return v214.foo() === 42 && typeof v214.subarray == "function" && v214.subarray(1, 1).byteLength === 0;
          } catch (e3) {
            return false;
          }
        }
        function f146() {
          if (f148.TYPED_ARRAY_SUPPORT) {
            return 2147483647;
          } else {
            return 1073741823;
          }
        }
        function f147(p300, p301) {
          if (f146() < p301) {
            throw new RangeError("Invalid typed array length");
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            p300 = new Uint8Array(p301);
            p300.__proto__ = f148.prototype;
          } else {
            if (p300 === null) {
              p300 = new f148(p301);
            }
            p300.length = p301;
          }
          return p300;
        }
        function f148(p302, p303, p304) {
          if (!f148.TYPED_ARRAY_SUPPORT && !(this instanceof f148)) {
            return new f148(p302, p303, p304);
          }
          if (typeof p302 == "number") {
            if (typeof p303 == "string") {
              throw new Error("If encoding is specified then the first argument must be a string");
            }
            return f152(this, p302);
          }
          return f149(this, p302, p303, p304);
        }
        function f149(p305, p306, p307, p308) {
          if (typeof p306 == "number") {
            throw new TypeError("\"value\" argument must not be a number");
          }
          if (typeof ArrayBuffer != "undefined" && p306 instanceof ArrayBuffer) {
            return f155(p305, p306, p307, p308);
          } else if (typeof p306 == "string") {
            return f153(p305, p306, p307);
          } else {
            return f156(p305, p306);
          }
        }
        function f150(p309) {
          if (typeof p309 != "number") {
            throw new TypeError("\"size\" argument must be a number");
          }
          if (p309 < 0) {
            throw new RangeError("\"size\" argument must not be negative");
          }
        }
        function f151(p310, p311, p312, p313) {
          f150(p311);
          if (p311 <= 0) {
            return f147(p310, p311);
          } else if (p312 !== undefined) {
            if (typeof p313 == "string") {
              return f147(p310, p311).fill(p312, p313);
            } else {
              return f147(p310, p311).fill(p312);
            }
          } else {
            return f147(p310, p311);
          }
        }
        function f152(p314, p315) {
          f150(p315);
          p314 = f147(p314, p315 < 0 ? 0 : f157(p315) | 0);
          if (!f148.TYPED_ARRAY_SUPPORT) {
            for (var vLN010 = 0; vLN010 < p315; ++vLN010) {
              p314[vLN010] = 0;
            }
          }
          return p314;
        }
        function f153(p316, p317, p318) {
          if (typeof p318 != "string" || p318 === "") {
            p318 = "utf8";
          }
          if (!f148.isEncoding(p318)) {
            throw new TypeError("\"encoding\" must be a valid string encoding");
          }
          var v215 = f159(p317, p318) | 0;
          p316 = f147(p316, v215);
          var v216 = p316.write(p317, p318);
          if (v216 !== v215) {
            p316 = p316.slice(0, v216);
          }
          return p316;
        }
        function f154(p319, p320) {
          var v217 = p320.length < 0 ? 0 : f157(p320.length) | 0;
          p319 = f147(p319, v217);
          for (var vLN011 = 0; vLN011 < v217; vLN011 += 1) {
            p319[vLN011] = p320[vLN011] & 255;
          }
          return p319;
        }
        function f155(p321, p322, p323, p324) {
          p322.byteLength;
          if (p323 < 0 || p322.byteLength < p323) {
            throw new RangeError("'offset' is out of bounds");
          }
          if (p322.byteLength < p323 + (p324 || 0)) {
            throw new RangeError("'length' is out of bounds");
          }
          p322 = p323 === undefined && p324 === undefined ? new Uint8Array(p322) : p324 === undefined ? new Uint8Array(p322, p323) : new Uint8Array(p322, p323, p324);
          if (f148.TYPED_ARRAY_SUPPORT) {
            p321 = p322;
            p321.__proto__ = f148.prototype;
          } else {
            p321 = f154(p321, p322);
          }
          return p321;
        }
        function f156(p325, p326) {
          if (f148.isBuffer(p326)) {
            var v218 = f157(p326.length) | 0;
            p325 = f147(p325, v218);
            if (p325.length === 0) {
              return p325;
            } else {
              p326.copy(p325, 0, 0, v218);
              return p325;
            }
          }
          if (p326) {
            if (typeof ArrayBuffer != "undefined" && p326.buffer instanceof ArrayBuffer || "length" in p326) {
              if (typeof p326.length != "number" || f193(p326.length)) {
                return f147(p325, 0);
              } else {
                return f154(p325, p326);
              }
            }
            if (p326.type === "Buffer" && vP2963(p326.data)) {
              return f154(p325, p326.data);
            }
          }
          throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
        }
        function f157(p327) {
          if (p327 >= f146()) {
            throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + f146().toString(16) + " bytes");
          }
          return p327 | 0;
        }
        function f158(p328) {
          if (+p328 != p328) {
            p328 = 0;
          }
          return f148.alloc(+p328);
        }
        function f159(p329, p330) {
          if (f148.isBuffer(p329)) {
            return p329.length;
          }
          if (typeof ArrayBuffer != "undefined" && typeof ArrayBuffer.isView == "function" && (ArrayBuffer.isView(p329) || p329 instanceof ArrayBuffer)) {
            return p329.byteLength;
          }
          if (typeof p329 != "string") {
            p329 = "" + p329;
          }
          var v219 = p329.length;
          if (v219 === 0) {
            return 0;
          }
          var v220 = false;
          while (true) {
            switch (p330) {
              case "ascii":
              case "latin1":
              case "binary":
                return v219;
              case "utf8":
              case "utf-8":
              case undefined:
                return f188(p329).length;
              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
                return v219 * 2;
              case "hex":
                return v219 >>> 1;
              case "base64":
                return f191(p329).length;
              default:
                if (v220) {
                  return f188(p329).length;
                }
                p330 = ("" + p330).toLowerCase();
                v220 = true;
            }
          }
        }
        function f160(p331, p332, p333) {
          var v221 = false;
          if (p332 === undefined || p332 < 0) {
            p332 = 0;
          }
          if (p332 > this.length) {
            return "";
          }
          if (p333 === undefined || p333 > this.length) {
            p333 = this.length;
          }
          if (p333 <= 0) {
            return "";
          }
          p333 >>>= 0;
          p332 >>>= 0;
          if (p333 <= p332) {
            return "";
          }
          for (p331 ||= "utf8";;) {
            switch (p331) {
              case "hex":
                return f176(this, p332, p333);
              case "utf8":
              case "utf-8":
                return f172(this, p332, p333);
              case "ascii":
                return f174(this, p332, p333);
              case "latin1":
              case "binary":
                return f175(this, p332, p333);
              case "base64":
                return f171(this, p332, p333);
              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
                return f177(this, p332, p333);
              default:
                if (v221) {
                  throw new TypeError("Unknown encoding: " + p331);
                }
                p331 = (p331 + "").toLowerCase();
                v221 = true;
            }
          }
        }
        function f161(p334, p335, p336) {
          var v222 = p334[p335];
          p334[p335] = p334[p336];
          p334[p336] = v222;
        }
        function f162(p337, p338, p339, p340, p341) {
          if (p337.length === 0) {
            return -1;
          }
          if (typeof p339 == "string") {
            p340 = p339;
            p339 = 0;
          } else if (p339 > 2147483647) {
            p339 = 2147483647;
          } else if (p339 < -2147483648) {
            p339 = -2147483648;
          }
          p339 = +p339;
          if (isNaN(p339)) {
            p339 = p341 ? 0 : p337.length - 1;
          }
          if (p339 < 0) {
            p339 = p337.length + p339;
          }
          if (p339 >= p337.length) {
            if (p341) {
              return -1;
            }
            p339 = p337.length - 1;
          } else if (p339 < 0) {
            if (!p341) {
              return -1;
            }
            p339 = 0;
          }
          if (typeof p338 == "string") {
            p338 = f148.from(p338, p340);
          }
          if (f148.isBuffer(p338)) {
            if (p338.length === 0) {
              return -1;
            } else {
              return f163(p337, p338, p339, p340, p341);
            }
          }
          if (typeof p338 == "number") {
            p338 = p338 & 255;
            if (f148.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf == "function") {
              if (p341) {
                return Uint8Array.prototype.indexOf.call(p337, p338, p339);
              } else {
                return Uint8Array.prototype.lastIndexOf.call(p337, p338, p339);
              }
            } else {
              return f163(p337, [p338], p339, p340, p341);
            }
          }
          throw new TypeError("val must be string, number or Buffer");
        }
        function f163(p342, p343, p344, p345, p346) {
          function f164(p347, p348) {
            if (vLN1 === 1) {
              return p347[p348];
            } else {
              return p347.readUInt16BE(p348 * vLN1);
            }
          }
          var vLN1 = 1;
          var v223 = p342.length;
          var v224 = p343.length;
          if (p345 !== undefined && (p345 = String(p345).toLowerCase(), p345 === "ucs2" || p345 === "ucs-2" || p345 === "utf16le" || p345 === "utf-16le")) {
            if (p342.length < 2 || p343.length < 2) {
              return -1;
            }
            vLN1 = 2;
            v223 /= 2;
            v224 /= 2;
            p344 /= 2;
          }
          var v225;
          if (p346) {
            var v226 = -1;
            for (v225 = p344; v225 < v223; v225++) {
              if (f164(p342, v225) === f164(p343, v226 === -1 ? 0 : v225 - v226)) {
                if (v226 === -1) {
                  v226 = v225;
                }
                if (v225 - v226 + 1 === v224) {
                  return v226 * vLN1;
                }
              } else {
                if (v226 !== -1) {
                  v225 -= v225 - v226;
                }
                v226 = -1;
              }
            }
          } else {
            if (p344 + v224 > v223) {
              p344 = v223 - v224;
            }
            v225 = p344;
            for (; v225 >= 0; v225--) {
              var v227 = true;
              for (var vLN012 = 0; vLN012 < v224; vLN012++) {
                if (f164(p342, v225 + vLN012) !== f164(p343, vLN012)) {
                  v227 = false;
                  break;
                }
              }
              if (v227) {
                return v225;
              }
            }
          }
          return -1;
        }
        function f165(p349, p350, p351, p352) {
          p351 = Number(p351) || 0;
          var v228 = p349.length - p351;
          if (p352) {
            p352 = Number(p352);
            if (p352 > v228) {
              p352 = v228;
            }
          } else {
            p352 = v228;
          }
          var v229 = p350.length;
          if (v229 % 2 !== 0) {
            throw new TypeError("Invalid hex string");
          }
          if (p352 > v229 / 2) {
            p352 = v229 / 2;
          }
          for (var vLN013 = 0; vLN013 < p352; ++vLN013) {
            var vParseInt = parseInt(p350.substr(vLN013 * 2, 2), 16);
            if (isNaN(vParseInt)) {
              return vLN013;
            }
            p349[p351 + vLN013] = vParseInt;
          }
          return vLN013;
        }
        function f166(p353, p354, p355, p356) {
          return f192(f188(p354, p353.length - p355), p353, p355, p356);
        }
        function f167(p357, p358, p359, p360) {
          return f192(f189(p358), p357, p359, p360);
        }
        function f168(p361, p362, p363, p364) {
          return f167(p361, p362, p363, p364);
        }
        function f169(p365, p366, p367, p368) {
          return f192(f191(p366), p365, p367, p368);
        }
        function f170(p369, p370, p371, p372) {
          return f192(f190(p370, p369.length - p371), p369, p371, p372);
        }
        function f171(p373, p374, p375) {
          if (p374 === 0 && p375 === p373.length) {
            return vP296.fromByteArray(p373);
          } else {
            return vP296.fromByteArray(p373.slice(p374, p375));
          }
        }
        function f172(p376, p377, p378) {
          p378 = Math.min(p376.length, p378);
          var vA3 = [];
          for (var vP377 = p377; vP377 < p378;) {
            var v230 = p376[vP377];
            var v231 = null;
            var v232 = v230 > 239 ? 4 : v230 > 223 ? 3 : v230 > 191 ? 2 : 1;
            if (vP377 + v232 <= p378) {
              var v233;
              var v234;
              var v235;
              var v236;
              switch (v232) {
                case 1:
                  if (v230 < 128) {
                    v231 = v230;
                  }
                  break;
                case 2:
                  v233 = p376[vP377 + 1];
                  if ((v233 & 192) === 128) {
                    v236 = (v230 & 31) << 6 | v233 & 63;
                    if (v236 > 127) {
                      v231 = v236;
                    }
                  }
                  break;
                case 3:
                  v233 = p376[vP377 + 1];
                  v234 = p376[vP377 + 2];
                  if ((v233 & 192) === 128 && (v234 & 192) === 128) {
                    v236 = (v230 & 15) << 12 | (v233 & 63) << 6 | v234 & 63;
                    if (v236 > 2047 && (v236 < 55296 || v236 > 57343)) {
                      v231 = v236;
                    }
                  }
                  break;
                case 4:
                  v233 = p376[vP377 + 1];
                  v234 = p376[vP377 + 2];
                  v235 = p376[vP377 + 3];
                  if ((v233 & 192) === 128 && (v234 & 192) === 128 && (v235 & 192) === 128) {
                    v236 = (v230 & 15) << 18 | (v233 & 63) << 12 | (v234 & 63) << 6 | v235 & 63;
                    if (v236 > 65535 && v236 < 1114112) {
                      v231 = v236;
                    }
                  }
              }
            }
            if (v231 === null) {
              v231 = 65533;
              v232 = 1;
            } else if (v231 > 65535) {
              v231 -= 65536;
              vA3.push(v231 >>> 10 & 1023 | 55296);
              v231 = v231 & 1023 | 56320;
            }
            vA3.push(v231);
            vP377 += v232;
          }
          return f173(vA3);
        }
        function f173(p379) {
          var v237 = p379.length;
          if (v237 <= vLN4096) {
            return String.fromCharCode.apply(String, p379);
          }
          var vLS2 = "";
          for (var vLN014 = 0; vLN014 < v237;) {
            vLS2 += String.fromCharCode.apply(String, p379.slice(vLN014, vLN014 += vLN4096));
          }
          return vLS2;
        }
        function f174(p380, p381, p382) {
          var vLS3 = "";
          p382 = Math.min(p380.length, p382);
          for (var vP381 = p381; vP381 < p382; ++vP381) {
            vLS3 += String.fromCharCode(p380[vP381] & 127);
          }
          return vLS3;
        }
        function f175(p383, p384, p385) {
          var vLS4 = "";
          p385 = Math.min(p383.length, p385);
          for (var vP384 = p384; vP384 < p385; ++vP384) {
            vLS4 += String.fromCharCode(p383[vP384]);
          }
          return vLS4;
        }
        function f176(p386, p387, p388) {
          var v238 = p386.length;
          if (!p387 || p387 < 0) {
            p387 = 0;
          }
          if (!p388 || p388 < 0 || p388 > v238) {
            p388 = v238;
          }
          var vLS5 = "";
          for (var vP387 = p387; vP387 < p388; ++vP387) {
            vLS5 += f187(p386[vP387]);
          }
          return vLS5;
        }
        function f177(p389, p390, p391) {
          for (var v239 = p389.slice(p390, p391), vLS6 = "", vLN015 = 0; vLN015 < v239.length; vLN015 += 2) {
            vLS6 += String.fromCharCode(v239[vLN015] + v239[vLN015 + 1] * 256);
          }
          return vLS6;
        }
        function f178(p392, p393, p394) {
          if (p392 % 1 !== 0 || p392 < 0) {
            throw new RangeError("offset is not uint");
          }
          if (p392 + p393 > p394) {
            throw new RangeError("Trying to access beyond buffer length");
          }
        }
        function f179(p395, p396, p397, p398, p399, p400) {
          if (!f148.isBuffer(p395)) {
            throw new TypeError("\"buffer\" argument must be a Buffer instance");
          }
          if (p396 > p399 || p396 < p400) {
            throw new RangeError("\"value\" argument is out of bounds");
          }
          if (p397 + p398 > p395.length) {
            throw new RangeError("Index out of range");
          }
        }
        function f180(p401, p402, p403, p404) {
          if (p402 < 0) {
            p402 = 65535 + p402 + 1;
          }
          for (var vLN016 = 0, v240 = Math.min(p401.length - p403, 2); vLN016 < v240; ++vLN016) {
            p401[p403 + vLN016] = (p402 & 255 << (p404 ? vLN016 : 1 - vLN016) * 8) >>> (p404 ? vLN016 : 1 - vLN016) * 8;
          }
        }
        function f181(p405, p406, p407, p408) {
          if (p406 < 0) {
            p406 = 4294967295 + p406 + 1;
          }
          for (var vLN017 = 0, v241 = Math.min(p405.length - p407, 4); vLN017 < v241; ++vLN017) {
            p405[p407 + vLN017] = p406 >>> (p408 ? vLN017 : 3 - vLN017) * 8 & 255;
          }
        }
        function f182(p409, p410, p411, p412, p413, p414) {
          if (p411 + p412 > p409.length) {
            throw new RangeError("Index out of range");
          }
          if (p411 < 0) {
            throw new RangeError("Index out of range");
          }
        }
        function f183(p415, p416, p417, p418, p419) {
          if (!p419) {
            f182(p415, p416, p417, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
          }
          vP2962.write(p415, p416, p417, p418, 23, 4);
          return p417 + 4;
        }
        function f184(p420, p421, p422, p423, p424) {
          if (!p424) {
            f182(p420, p421, p422, 8, 1.7976931348623157e+308, -1.7976931348623157e+308);
          }
          vP2962.write(p420, p421, p422, p423, 52, 8);
          return p422 + 8;
        }
        function f185(p425) {
          p425 = f186(p425).replace(v287, "");
          if (p425.length < 2) {
            return "";
          }
          while (p425.length % 4 !== 0) {
            p425 += "=";
          }
          return p425;
        }
        function f186(p426) {
          if (p426.trim) {
            return p426.trim();
          } else {
            return p426.replace(/^\s+|\s+$/g, "");
          }
        }
        function f187(p427) {
          if (p427 < 16) {
            return "0" + p427.toString(16);
          } else {
            return p427.toString(16);
          }
        }
        function f188(p428, p429) {
          p429 = p429 || Infinity;
          var v242;
          for (var v243 = p428.length, v244 = null, vA4 = [], vLN018 = 0; vLN018 < v243; ++vLN018) {
            v242 = p428.charCodeAt(vLN018);
            if (v242 > 55295 && v242 < 57344) {
              if (!v244) {
                if (v242 > 56319) {
                  if ((p429 -= 3) > -1) {
                    vA4.push(239, 191, 189);
                  }
                  continue;
                }
                if (vLN018 + 1 === v243) {
                  if ((p429 -= 3) > -1) {
                    vA4.push(239, 191, 189);
                  }
                  continue;
                }
                v244 = v242;
                continue;
              }
              if (v242 < 56320) {
                if ((p429 -= 3) > -1) {
                  vA4.push(239, 191, 189);
                }
                v244 = v242;
                continue;
              }
              v242 = (v244 - 55296 << 10 | v242 - 56320) + 65536;
            } else if (v244 && (p429 -= 3) > -1) {
              vA4.push(239, 191, 189);
            }
            v244 = null;
            if (v242 < 128) {
              if ((p429 -= 1) < 0) {
                break;
              }
              vA4.push(v242);
            } else if (v242 < 2048) {
              if ((p429 -= 2) < 0) {
                break;
              }
              vA4.push(v242 >> 6 | 192, v242 & 63 | 128);
            } else if (v242 < 65536) {
              if ((p429 -= 3) < 0) {
                break;
              }
              vA4.push(v242 >> 12 | 224, v242 >> 6 & 63 | 128, v242 & 63 | 128);
            } else {
              if (!(v242 < 1114112)) {
                throw new Error("Invalid code point");
              }
              if ((p429 -= 4) < 0) {
                break;
              }
              vA4.push(v242 >> 18 | 240, v242 >> 12 & 63 | 128, v242 >> 6 & 63 | 128, v242 & 63 | 128);
            }
          }
          return vA4;
        }
        function f189(p430) {
          var vA5 = [];
          for (var vLN019 = 0; vLN019 < p430.length; ++vLN019) {
            vA5.push(p430.charCodeAt(vLN019) & 255);
          }
          return vA5;
        }
        function f190(p431, p432) {
          var v245;
          var v246;
          var v247;
          var vA6 = [];
          for (var vLN020 = 0; vLN020 < p431.length && !((p432 -= 2) < 0); ++vLN020) {
            v245 = p431.charCodeAt(vLN020);
            v246 = v245 >> 8;
            v247 = v245 % 256;
            vA6.push(v247);
            vA6.push(v246);
          }
          return vA6;
        }
        function f191(p433) {
          return vP296.toByteArray(f185(p433));
        }
        function f192(p434, p435, p436, p437) {
          for (var vLN021 = 0; vLN021 < p437 && !(vLN021 + p436 >= p435.length) && !(vLN021 >= p434.length); ++vLN021) {
            p435[vLN021 + p436] = p434[vLN021];
          }
          return vLN021;
        }
        function f193(p438) {
          return p438 !== p438;
        }
        var vP296 = p296("base64-js");
        var vP2962 = p296("ieee754");
        var vP2963 = p296("isarray");
        p298.Buffer = f148;
        p298.SlowBuffer = f158;
        p298.INSPECT_MAX_BYTES = 50;
        f148.TYPED_ARRAY_SUPPORT = p299.TYPED_ARRAY_SUPPORT !== undefined ? p299.TYPED_ARRAY_SUPPORT : f145();
        p298.kMaxLength = f146();
        f148.poolSize = 8192;
        f148._augment = function (p439) {
          p439.__proto__ = f148.prototype;
          return p439;
        };
        f148.from = function (p440, p441, p442) {
          return f149(null, p440, p441, p442);
        };
        if (f148.TYPED_ARRAY_SUPPORT) {
          f148.prototype.__proto__ = Uint8Array.prototype;
          f148.__proto__ = Uint8Array;
          if (typeof Symbol != "undefined" && Symbol.species && f148[Symbol.species] === f148) {
            Object.defineProperty(f148, Symbol.species, {
              value: null,
              configurable: true
            });
          }
        }
        f148.alloc = function (p443, p444, p445) {
          return f151(null, p443, p444, p445);
        };
        f148.allocUnsafe = function (p446) {
          return f152(null, p446);
        };
        f148.allocUnsafeSlow = function (p447) {
          return f152(null, p447);
        };
        f148.isBuffer = function (p448) {
          return p448 != null && !!p448._isBuffer;
        };
        f148.compare = function (p449, p450) {
          if (!f148.isBuffer(p449) || !f148.isBuffer(p450)) {
            throw new TypeError("Arguments must be Buffers");
          }
          if (p449 === p450) {
            return 0;
          }
          var v248 = p449.length;
          var v249 = p450.length;
          for (var vLN022 = 0, v250 = Math.min(v248, v249); vLN022 < v250; ++vLN022) {
            if (p449[vLN022] !== p450[vLN022]) {
              v248 = p449[vLN022];
              v249 = p450[vLN022];
              break;
            }
          }
          if (v248 < v249) {
            return -1;
          } else if (v249 < v248) {
            return 1;
          } else {
            return 0;
          }
        };
        f148.isEncoding = function (p451) {
          switch (String(p451).toLowerCase()) {
            case "hex":
            case "utf8":
            case "utf-8":
            case "ascii":
            case "latin1":
            case "binary":
            case "base64":
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return true;
            default:
              return false;
          }
        };
        f148.concat = function (p452, p453) {
          if (!vP2963(p452)) {
            throw new TypeError("\"list\" argument must be an Array of Buffers");
          }
          if (p452.length === 0) {
            return f148.alloc(0);
          }
          var v251;
          if (p453 === undefined) {
            p453 = 0;
            v251 = 0;
            for (; v251 < p452.length; ++v251) {
              p453 += p452[v251].length;
            }
          }
          var v252 = f148.allocUnsafe(p453);
          var vLN023 = 0;
          for (v251 = 0; v251 < p452.length; ++v251) {
            var v253 = p452[v251];
            if (!f148.isBuffer(v253)) {
              throw new TypeError("\"list\" argument must be an Array of Buffers");
            }
            v253.copy(v252, vLN023);
            vLN023 += v253.length;
          }
          return v252;
        };
        f148.byteLength = f159;
        f148.prototype._isBuffer = true;
        f148.prototype.swap16 = function () {
          var v254 = this.length;
          if (v254 % 2 !== 0) {
            throw new RangeError("Buffer size must be a multiple of 16-bits");
          }
          for (var vLN024 = 0; vLN024 < v254; vLN024 += 2) {
            f161(this, vLN024, vLN024 + 1);
          }
          return this;
        };
        f148.prototype.swap32 = function () {
          var v255 = this.length;
          if (v255 % 4 !== 0) {
            throw new RangeError("Buffer size must be a multiple of 32-bits");
          }
          for (var vLN025 = 0; vLN025 < v255; vLN025 += 4) {
            f161(this, vLN025, vLN025 + 3);
            f161(this, vLN025 + 1, vLN025 + 2);
          }
          return this;
        };
        f148.prototype.swap64 = function () {
          var v256 = this.length;
          if (v256 % 8 !== 0) {
            throw new RangeError("Buffer size must be a multiple of 64-bits");
          }
          for (var vLN026 = 0; vLN026 < v256; vLN026 += 8) {
            f161(this, vLN026, vLN026 + 7);
            f161(this, vLN026 + 1, vLN026 + 6);
            f161(this, vLN026 + 2, vLN026 + 5);
            f161(this, vLN026 + 3, vLN026 + 4);
          }
          return this;
        };
        f148.prototype.toString = function () {
          var v257 = this.length | 0;
          if (v257 === 0) {
            return "";
          } else if (arguments.length === 0) {
            return f172(this, 0, v257);
          } else {
            return f160.apply(this, arguments);
          }
        };
        f148.prototype.equals = function (p454) {
          if (!f148.isBuffer(p454)) {
            throw new TypeError("Argument must be a Buffer");
          }
          return this === p454 || f148.compare(this, p454) === 0;
        };
        f148.prototype.inspect = function () {
          var vLS7 = "";
          var v258 = p298.INSPECT_MAX_BYTES;
          if (this.length > 0) {
            vLS7 = this.toString("hex", 0, v258).match(/.{2}/g).join(" ");
            if (this.length > v258) {
              vLS7 += " ... ";
            }
          }
          return "<Buffer " + vLS7 + ">";
        };
        f148.prototype.compare = function (p455, p456, p457, p458, p459) {
          if (!f148.isBuffer(p455)) {
            throw new TypeError("Argument must be a Buffer");
          }
          if (p456 === undefined) {
            p456 = 0;
          }
          if (p457 === undefined) {
            p457 = p455 ? p455.length : 0;
          }
          if (p458 === undefined) {
            p458 = 0;
          }
          if (p459 === undefined) {
            p459 = this.length;
          }
          if (p456 < 0 || p457 > p455.length || p458 < 0 || p459 > this.length) {
            throw new RangeError("out of range index");
          }
          if (p458 >= p459 && p456 >= p457) {
            return 0;
          }
          if (p458 >= p459) {
            return -1;
          }
          if (p456 >= p457) {
            return 1;
          }
          p456 >>>= 0;
          p457 >>>= 0;
          p458 >>>= 0;
          p459 >>>= 0;
          if (this === p455) {
            return 0;
          }
          var v259 = p459 - p458;
          var v260 = p457 - p456;
          for (var v261 = Math.min(v259, v260), v262 = this.slice(p458, p459), v263 = p455.slice(p456, p457), vLN027 = 0; vLN027 < v261; ++vLN027) {
            if (v262[vLN027] !== v263[vLN027]) {
              v259 = v262[vLN027];
              v260 = v263[vLN027];
              break;
            }
          }
          if (v259 < v260) {
            return -1;
          } else if (v260 < v259) {
            return 1;
          } else {
            return 0;
          }
        };
        f148.prototype.includes = function (p460, p461, p462) {
          return this.indexOf(p460, p461, p462) !== -1;
        };
        f148.prototype.indexOf = function (p463, p464, p465) {
          return f162(this, p463, p464, p465, true);
        };
        f148.prototype.lastIndexOf = function (p466, p467, p468) {
          return f162(this, p466, p467, p468, false);
        };
        f148.prototype.write = function (p469, p470, p471, p472) {
          if (p470 === undefined) {
            p472 = "utf8";
            p471 = this.length;
            p470 = 0;
          } else if (p471 === undefined && typeof p470 == "string") {
            p472 = p470;
            p471 = this.length;
            p470 = 0;
          } else {
            if (!isFinite(p470)) {
              throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
            }
            p470 = p470 | 0;
            if (isFinite(p471)) {
              p471 = p471 | 0;
              if (p472 === undefined) {
                p472 = "utf8";
              }
            } else {
              p472 = p471;
              p471 = undefined;
            }
          }
          var v264 = this.length - p470;
          if (p471 === undefined || p471 > v264) {
            p471 = v264;
          }
          if (p469.length > 0 && (p471 < 0 || p470 < 0) || p470 > this.length) {
            throw new RangeError("Attempt to write outside buffer bounds");
          }
          p472 ||= "utf8";
          var v265 = false;
          while (true) {
            switch (p472) {
              case "hex":
                return f165(this, p469, p470, p471);
              case "utf8":
              case "utf-8":
                return f166(this, p469, p470, p471);
              case "ascii":
                return f167(this, p469, p470, p471);
              case "latin1":
              case "binary":
                return f168(this, p469, p470, p471);
              case "base64":
                return f169(this, p469, p470, p471);
              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
                return f170(this, p469, p470, p471);
              default:
                if (v265) {
                  throw new TypeError("Unknown encoding: " + p472);
                }
                p472 = ("" + p472).toLowerCase();
                v265 = true;
            }
          }
        };
        f148.prototype.toJSON = function () {
          return {
            type: "Buffer",
            data: Array.prototype.slice.call(this._arr || this, 0)
          };
        };
        var vLN4096 = 4096;
        f148.prototype.slice = function (p473, p474) {
          var v266 = this.length;
          p473 = ~~p473;
          p474 = p474 === undefined ? v266 : ~~p474;
          if (p473 < 0) {
            p473 += v266;
            if (p473 < 0) {
              p473 = 0;
            }
          } else if (p473 > v266) {
            p473 = v266;
          }
          if (p474 < 0) {
            p474 += v266;
            if (p474 < 0) {
              p474 = 0;
            }
          } else if (p474 > v266) {
            p474 = v266;
          }
          if (p474 < p473) {
            p474 = p473;
          }
          var v267;
          if (f148.TYPED_ARRAY_SUPPORT) {
            v267 = this.subarray(p473, p474);
            v267.__proto__ = f148.prototype;
          } else {
            var v268 = p474 - p473;
            v267 = new f148(v268, undefined);
            for (var vLN028 = 0; vLN028 < v268; ++vLN028) {
              v267[vLN028] = this[vLN028 + p473];
            }
          }
          return v267;
        };
        f148.prototype.readUIntLE = function (p475, p476, p477) {
          p475 = p475 | 0;
          p476 = p476 | 0;
          if (!p477) {
            f178(p475, p476, this.length);
          }
          var v269 = this[p475];
          for (var vLN12 = 1, vLN029 = 0; ++vLN029 < p476 && (vLN12 *= 256);) {
            v269 += this[p475 + vLN029] * vLN12;
          }
          return v269;
        };
        f148.prototype.readUIntBE = function (p478, p479, p480) {
          p478 = p478 | 0;
          p479 = p479 | 0;
          if (!p480) {
            f178(p478, p479, this.length);
          }
          var v270 = this[p478 + --p479];
          for (var vLN13 = 1; p479 > 0 && (vLN13 *= 256);) {
            v270 += this[p478 + --p479] * vLN13;
          }
          return v270;
        };
        f148.prototype.readUInt8 = function (p481, p482) {
          if (!p482) {
            f178(p481, 1, this.length);
          }
          return this[p481];
        };
        f148.prototype.readUInt16LE = function (p483, p484) {
          if (!p484) {
            f178(p483, 2, this.length);
          }
          return this[p483] | this[p483 + 1] << 8;
        };
        f148.prototype.readUInt16BE = function (p485, p486) {
          if (!p486) {
            f178(p485, 2, this.length);
          }
          return this[p485] << 8 | this[p485 + 1];
        };
        f148.prototype.readUInt32LE = function (p487, p488) {
          if (!p488) {
            f178(p487, 4, this.length);
          }
          return (this[p487] | this[p487 + 1] << 8 | this[p487 + 2] << 16) + this[p487 + 3] * 16777216;
        };
        f148.prototype.readUInt32BE = function (p489, p490) {
          if (!p490) {
            f178(p489, 4, this.length);
          }
          return this[p489] * 16777216 + (this[p489 + 1] << 16 | this[p489 + 2] << 8 | this[p489 + 3]);
        };
        f148.prototype.readIntLE = function (p491, p492, p493) {
          p491 = p491 | 0;
          p492 = p492 | 0;
          if (!p493) {
            f178(p491, p492, this.length);
          }
          var v271 = this[p491];
          for (var vLN14 = 1, vLN030 = 0; ++vLN030 < p492 && (vLN14 *= 256);) {
            v271 += this[p491 + vLN030] * vLN14;
          }
          vLN14 *= 128;
          if (v271 >= vLN14) {
            v271 -= Math.pow(2, p492 * 8);
          }
          return v271;
        };
        f148.prototype.readIntBE = function (p494, p495, p496) {
          p494 = p494 | 0;
          p495 = p495 | 0;
          if (!p496) {
            f178(p494, p495, this.length);
          }
          for (var vP495 = p495, vLN15 = 1, v272 = this[p494 + --vP495]; vP495 > 0 && (vLN15 *= 256);) {
            v272 += this[p494 + --vP495] * vLN15;
          }
          vLN15 *= 128;
          if (v272 >= vLN15) {
            v272 -= Math.pow(2, p495 * 8);
          }
          return v272;
        };
        f148.prototype.readInt8 = function (p497, p498) {
          if (!p498) {
            f178(p497, 1, this.length);
          }
          if (this[p497] & 128) {
            return (255 - this[p497] + 1) * -1;
          } else {
            return this[p497];
          }
        };
        f148.prototype.readInt16LE = function (p499, p500) {
          if (!p500) {
            f178(p499, 2, this.length);
          }
          var v273 = this[p499] | this[p499 + 1] << 8;
          if (v273 & 32768) {
            return v273 | -65536;
          } else {
            return v273;
          }
        };
        f148.prototype.readInt16BE = function (p501, p502) {
          if (!p502) {
            f178(p501, 2, this.length);
          }
          var v274 = this[p501 + 1] | this[p501] << 8;
          if (v274 & 32768) {
            return v274 | -65536;
          } else {
            return v274;
          }
        };
        f148.prototype.readInt32LE = function (p503, p504) {
          if (!p504) {
            f178(p503, 4, this.length);
          }
          return this[p503] | this[p503 + 1] << 8 | this[p503 + 2] << 16 | this[p503 + 3] << 24;
        };
        f148.prototype.readInt32BE = function (p505, p506) {
          if (!p506) {
            f178(p505, 4, this.length);
          }
          return this[p505] << 24 | this[p505 + 1] << 16 | this[p505 + 2] << 8 | this[p505 + 3];
        };
        f148.prototype.readFloatLE = function (p507, p508) {
          if (!p508) {
            f178(p507, 4, this.length);
          }
          return vP2962.read(this, p507, true, 23, 4);
        };
        f148.prototype.readFloatBE = function (p509, p510) {
          if (!p510) {
            f178(p509, 4, this.length);
          }
          return vP2962.read(this, p509, false, 23, 4);
        };
        f148.prototype.readDoubleLE = function (p511, p512) {
          if (!p512) {
            f178(p511, 8, this.length);
          }
          return vP2962.read(this, p511, true, 52, 8);
        };
        f148.prototype.readDoubleBE = function (p513, p514) {
          if (!p514) {
            f178(p513, 8, this.length);
          }
          return vP2962.read(this, p513, false, 52, 8);
        };
        f148.prototype.writeUIntLE = function (p515, p516, p517, p518) {
          p515 = +p515;
          p516 = p516 | 0;
          p517 = p517 | 0;
          if (!p518) {
            var v275 = Math.pow(2, p517 * 8) - 1;
            f179(this, p515, p516, p517, v275, 0);
          }
          var vLN16 = 1;
          var vLN031 = 0;
          for (this[p516] = p515 & 255; ++vLN031 < p517 && (vLN16 *= 256);) {
            this[p516 + vLN031] = p515 / vLN16 & 255;
          }
          return p516 + p517;
        };
        f148.prototype.writeUIntBE = function (p519, p520, p521, p522) {
          p519 = +p519;
          p520 = p520 | 0;
          p521 = p521 | 0;
          if (!p522) {
            var v276 = Math.pow(2, p521 * 8) - 1;
            f179(this, p519, p520, p521, v276, 0);
          }
          var v277 = p521 - 1;
          var vLN17 = 1;
          for (this[p520 + v277] = p519 & 255; --v277 >= 0 && (vLN17 *= 256);) {
            this[p520 + v277] = p519 / vLN17 & 255;
          }
          return p520 + p521;
        };
        f148.prototype.writeUInt8 = function (p523, p524, p525) {
          p523 = +p523;
          p524 = p524 | 0;
          if (!p525) {
            f179(this, p523, p524, 1, 255, 0);
          }
          if (!f148.TYPED_ARRAY_SUPPORT) {
            p523 = Math.floor(p523);
          }
          this[p524] = p523 & 255;
          return p524 + 1;
        };
        f148.prototype.writeUInt16LE = function (p526, p527, p528) {
          p526 = +p526;
          p527 = p527 | 0;
          if (!p528) {
            f179(this, p526, p527, 2, 65535, 0);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p527] = p526 & 255;
            this[p527 + 1] = p526 >>> 8;
          } else {
            f180(this, p526, p527, true);
          }
          return p527 + 2;
        };
        f148.prototype.writeUInt16BE = function (p529, p530, p531) {
          p529 = +p529;
          p530 = p530 | 0;
          if (!p531) {
            f179(this, p529, p530, 2, 65535, 0);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p530] = p529 >>> 8;
            this[p530 + 1] = p529 & 255;
          } else {
            f180(this, p529, p530, false);
          }
          return p530 + 2;
        };
        f148.prototype.writeUInt32LE = function (p532, p533, p534) {
          p532 = +p532;
          p533 = p533 | 0;
          if (!p534) {
            f179(this, p532, p533, 4, 4294967295, 0);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p533 + 3] = p532 >>> 24;
            this[p533 + 2] = p532 >>> 16;
            this[p533 + 1] = p532 >>> 8;
            this[p533] = p532 & 255;
          } else {
            f181(this, p532, p533, true);
          }
          return p533 + 4;
        };
        f148.prototype.writeUInt32BE = function (p535, p536, p537) {
          p535 = +p535;
          p536 = p536 | 0;
          if (!p537) {
            f179(this, p535, p536, 4, 4294967295, 0);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p536] = p535 >>> 24;
            this[p536 + 1] = p535 >>> 16;
            this[p536 + 2] = p535 >>> 8;
            this[p536 + 3] = p535 & 255;
          } else {
            f181(this, p535, p536, false);
          }
          return p536 + 4;
        };
        f148.prototype.writeIntLE = function (p538, p539, p540, p541) {
          p538 = +p538;
          p539 = p539 | 0;
          if (!p541) {
            var v278 = Math.pow(2, p540 * 8 - 1);
            f179(this, p538, p539, p540, v278 - 1, -v278);
          }
          var vLN032 = 0;
          var vLN18 = 1;
          var vLN033 = 0;
          for (this[p539] = p538 & 255; ++vLN032 < p540 && (vLN18 *= 256);) {
            if (p538 < 0 && vLN033 === 0 && this[p539 + vLN032 - 1] !== 0) {
              vLN033 = 1;
            }
            this[p539 + vLN032] = (p538 / vLN18 >> 0) - vLN033 & 255;
          }
          return p539 + p540;
        };
        f148.prototype.writeIntBE = function (p542, p543, p544, p545) {
          p542 = +p542;
          p543 = p543 | 0;
          if (!p545) {
            var v279 = Math.pow(2, p544 * 8 - 1);
            f179(this, p542, p543, p544, v279 - 1, -v279);
          }
          var v280 = p544 - 1;
          var vLN19 = 1;
          var vLN034 = 0;
          for (this[p543 + v280] = p542 & 255; --v280 >= 0 && (vLN19 *= 256);) {
            if (p542 < 0 && vLN034 === 0 && this[p543 + v280 + 1] !== 0) {
              vLN034 = 1;
            }
            this[p543 + v280] = (p542 / vLN19 >> 0) - vLN034 & 255;
          }
          return p543 + p544;
        };
        f148.prototype.writeInt8 = function (p546, p547, p548) {
          p546 = +p546;
          p547 = p547 | 0;
          if (!p548) {
            f179(this, p546, p547, 1, 127, -128);
          }
          if (!f148.TYPED_ARRAY_SUPPORT) {
            p546 = Math.floor(p546);
          }
          if (p546 < 0) {
            p546 = 255 + p546 + 1;
          }
          this[p547] = p546 & 255;
          return p547 + 1;
        };
        f148.prototype.writeInt16LE = function (p549, p550, p551) {
          p549 = +p549;
          p550 = p550 | 0;
          if (!p551) {
            f179(this, p549, p550, 2, 32767, -32768);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p550] = p549 & 255;
            this[p550 + 1] = p549 >>> 8;
          } else {
            f180(this, p549, p550, true);
          }
          return p550 + 2;
        };
        f148.prototype.writeInt16BE = function (p552, p553, p554) {
          p552 = +p552;
          p553 = p553 | 0;
          if (!p554) {
            f179(this, p552, p553, 2, 32767, -32768);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p553] = p552 >>> 8;
            this[p553 + 1] = p552 & 255;
          } else {
            f180(this, p552, p553, false);
          }
          return p553 + 2;
        };
        f148.prototype.writeInt32LE = function (p555, p556, p557) {
          p555 = +p555;
          p556 = p556 | 0;
          if (!p557) {
            f179(this, p555, p556, 4, 2147483647, -2147483648);
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p556] = p555 & 255;
            this[p556 + 1] = p555 >>> 8;
            this[p556 + 2] = p555 >>> 16;
            this[p556 + 3] = p555 >>> 24;
          } else {
            f181(this, p555, p556, true);
          }
          return p556 + 4;
        };
        f148.prototype.writeInt32BE = function (p558, p559, p560) {
          p558 = +p558;
          p559 = p559 | 0;
          if (!p560) {
            f179(this, p558, p559, 4, 2147483647, -2147483648);
          }
          if (p558 < 0) {
            p558 = 4294967295 + p558 + 1;
          }
          if (f148.TYPED_ARRAY_SUPPORT) {
            this[p559] = p558 >>> 24;
            this[p559 + 1] = p558 >>> 16;
            this[p559 + 2] = p558 >>> 8;
            this[p559 + 3] = p558 & 255;
          } else {
            f181(this, p558, p559, false);
          }
          return p559 + 4;
        };
        f148.prototype.writeFloatLE = function (p561, p562, p563) {
          return f183(this, p561, p562, true, p563);
        };
        f148.prototype.writeFloatBE = function (p564, p565, p566) {
          return f183(this, p564, p565, false, p566);
        };
        f148.prototype.writeDoubleLE = function (p567, p568, p569) {
          return f184(this, p567, p568, true, p569);
        };
        f148.prototype.writeDoubleBE = function (p570, p571, p572) {
          return f184(this, p570, p571, false, p572);
        };
        f148.prototype.copy = function (p573, p574, p575, p576) {
          p575 ||= 0;
          if (!p576 && p576 !== 0) {
            p576 = this.length;
          }
          if (p574 >= p573.length) {
            p574 = p573.length;
          }
          p574 ||= 0;
          if (p576 > 0 && p576 < p575) {
            p576 = p575;
          }
          if (p576 === p575) {
            return 0;
          }
          if (p573.length === 0 || this.length === 0) {
            return 0;
          }
          if (p574 < 0) {
            throw new RangeError("targetStart out of bounds");
          }
          if (p575 < 0 || p575 >= this.length) {
            throw new RangeError("sourceStart out of bounds");
          }
          if (p576 < 0) {
            throw new RangeError("sourceEnd out of bounds");
          }
          if (p576 > this.length) {
            p576 = this.length;
          }
          if (p573.length - p574 < p576 - p575) {
            p576 = p573.length - p574 + p575;
          }
          var v281;
          var v282 = p576 - p575;
          if (this === p573 && p575 < p574 && p574 < p576) {
            for (v281 = v282 - 1; v281 >= 0; --v281) {
              p573[v281 + p574] = this[v281 + p575];
            }
          } else if (v282 < 1000 || !f148.TYPED_ARRAY_SUPPORT) {
            for (v281 = 0; v281 < v282; ++v281) {
              p573[v281 + p574] = this[v281 + p575];
            }
          } else {
            Uint8Array.prototype.set.call(p573, this.subarray(p575, p575 + v282), p574);
          }
          return v282;
        };
        f148.prototype.fill = function (p577, p578, p579, p580) {
          if (typeof p577 == "string") {
            if (typeof p578 == "string") {
              p580 = p578;
              p578 = 0;
              p579 = this.length;
            } else if (typeof p579 == "string") {
              p580 = p579;
              p579 = this.length;
            }
            if (p577.length === 1) {
              var v283 = p577.charCodeAt(0);
              if (v283 < 256) {
                p577 = v283;
              }
            }
            if (p580 !== undefined && typeof p580 != "string") {
              throw new TypeError("encoding must be a string");
            }
            if (typeof p580 == "string" && !f148.isEncoding(p580)) {
              throw new TypeError("Unknown encoding: " + p580);
            }
          } else if (typeof p577 == "number") {
            p577 = p577 & 255;
          }
          if (p578 < 0 || this.length < p578 || this.length < p579) {
            throw new RangeError("Out of range index");
          }
          if (p579 <= p578) {
            return this;
          }
          p578 >>>= 0;
          p579 = p579 === undefined ? this.length : p579 >>> 0;
          p577 ||= 0;
          var v284;
          if (typeof p577 == "number") {
            for (v284 = p578; v284 < p579; ++v284) {
              this[v284] = p577;
            }
          } else {
            var v285 = f148.isBuffer(p577) ? p577 : f188(new f148(p577, p580).toString());
            var v286 = v285.length;
            for (v284 = 0; v284 < p579 - p578; ++v284) {
              this[v284 + p578] = v285[v284 % v286];
            }
          }
          return this;
        };
        var v287 = /[^+\/0-9A-Za-z-_]/g;
      }).call(this, typeof global != "undefined" ? global : typeof self != "undefined" ? self : typeof window != "undefined" ? window : {});
    }, {
      "base64-js": 30,
      ieee754: 32,
      isarray: 34
    }],
    30: [function (p581, p582, p583) {
      "use strict";

      function f194(p584) {
        var v288 = p584.length;
        if (v288 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        if (p584[v288 - 2] === "=") {
          return 2;
        } else if (p584[v288 - 1] === "=") {
          return 1;
        } else {
          return 0;
        }
      }
      function f195(p585) {
        return p585.length * 3 / 4 - f194(p585);
      }
      function o(p586) {
        var v289;
        var v290;
        var v291;
        var v292;
        var v293;
        var v294;
        var v295 = p586.length;
        v293 = f194(p586);
        v294 = new v301(v295 * 3 / 4 - v293);
        v291 = v293 > 0 ? v295 - 4 : v295;
        var vLN035 = 0;
        v289 = 0;
        v290 = 0;
        for (; v289 < v291; v289 += 4, v290 += 3) {
          v292 = vA10[p586.charCodeAt(v289)] << 18 | vA10[p586.charCodeAt(v289 + 1)] << 12 | vA10[p586.charCodeAt(v289 + 2)] << 6 | vA10[p586.charCodeAt(v289 + 3)];
          v294[vLN035++] = v292 >> 16 & 255;
          v294[vLN035++] = v292 >> 8 & 255;
          v294[vLN035++] = v292 & 255;
        }
        if (v293 === 2) {
          v292 = vA10[p586.charCodeAt(v289)] << 2 | vA10[p586.charCodeAt(v289 + 1)] >> 4;
          v294[vLN035++] = v292 & 255;
        } else if (v293 === 1) {
          v292 = vA10[p586.charCodeAt(v289)] << 10 | vA10[p586.charCodeAt(v289 + 1)] << 4 | vA10[p586.charCodeAt(v289 + 2)] >> 2;
          v294[vLN035++] = v292 >> 8 & 255;
          v294[vLN035++] = v292 & 255;
        }
        return v294;
      }
      function f197(p587) {
        return vA9[p587 >> 18 & 63] + vA9[p587 >> 12 & 63] + vA9[p587 >> 6 & 63] + vA9[p587 & 63];
      }
      function f198(p588, p589, p590) {
        var v296;
        var vA7 = [];
        for (var vP589 = p589; vP589 < p590; vP589 += 3) {
          v296 = (p588[vP589] << 16) + (p588[vP589 + 1] << 8) + p588[vP589 + 2];
          vA7.push(f197(v296));
        }
        return vA7.join("");
      }
      function a(p591) {
        var v297;
        var v298 = p591.length;
        var v299 = v298 % 3;
        var vLS8 = "";
        var vA8 = [];
        for (var vLN16383 = 16383, vLN036 = 0, v300 = v298 - v299; vLN036 < v300; vLN036 += vLN16383) {
          vA8.push(f198(p591, vLN036, vLN036 + vLN16383 > v300 ? v300 : vLN036 + vLN16383));
        }
        if (v299 === 1) {
          v297 = p591[v298 - 1];
          vLS8 += vA9[v297 >> 2];
          vLS8 += vA9[v297 << 4 & 63];
          vLS8 += "==";
        } else if (v299 === 2) {
          v297 = (p591[v298 - 2] << 8) + p591[v298 - 1];
          vLS8 += vA9[v297 >> 10];
          vLS8 += vA9[v297 >> 4 & 63];
          vLS8 += vA9[v297 << 2 & 63];
          vLS8 += "=";
        }
        vA8.push(vLS8);
        return vA8.join("");
      }
      p583.byteLength = f195;
      p583.toByteArray = o;
      p583.fromByteArray = a;
      var vA9 = [];
      var vA10 = [];
      var v301 = typeof Uint8Array != "undefined" ? Uint8Array : Array;
      var vLSABCDEFGHIJKLMNOPQRST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (var vLN037 = 0, v302 = vLSABCDEFGHIJKLMNOPQRST.length; vLN037 < v302; ++vLN037) {
        vA9[vLN037] = vLSABCDEFGHIJKLMNOPQRST[vLN037];
        vA10[vLSABCDEFGHIJKLMNOPQRST.charCodeAt(vLN037)] = vLN037;
      }
      vA10["-".charCodeAt(0)] = 62;
      vA10["_".charCodeAt(0)] = 63;
    }, {}],
    31: [function (p592, p593, p594) {
      function f200() {
        if (!(this instanceof f200)) {
          return new f200();
        }
      }
      (function (p595) {
        function f201(p596) {
          for (var v303 in vO8) {
            p596[v303] = vO8[v303];
          }
          return p596;
        }
        function f202(p597, p598) {
          f211(this, p597).push(p598);
          return this;
        }
        function f203(p599, p600) {
          function f204() {
            f205.call(vThis3, p599, f204);
            p600.apply(this, arguments);
          }
          var vThis3 = this;
          f204.originalListener = p600;
          f211(vThis3, p599).push(f204);
          return vThis3;
        }
        function f205(p601, p602) {
          function f206(p603) {
            return p603 !== p602 && p603.originalListener !== p602;
          }
          var v304;
          var vThis4 = this;
          if (arguments.length) {
            if (p602) {
              if (v304 = f211(vThis4, p601, true)) {
                v304 = v304.filter(f206);
                if (!v304.length) {
                  return f205.call(vThis4, p601);
                }
                vThis4[vLSListeners][p601] = v304;
              }
            } else {
              v304 = vThis4[vLSListeners];
              if (v304 && (delete v304[p601], !Object.keys(v304).length)) {
                return f205.call(vThis4);
              }
            }
          } else {
            delete vThis4[vLSListeners];
          }
          return vThis4;
        }
        function f(p604, p605) {
          function f208(p606) {
            p606.call(vThis5);
          }
          function f209(p607) {
            p607.call(vThis5, p605);
          }
          function f210(p608) {
            p608.apply(vThis5, v306);
          }
          var vThis5 = this;
          var vU = f211(vThis5, p604, true);
          if (!vU) {
            return false;
          }
          var v305 = arguments.length;
          if (v305 === 1) {
            vU.forEach(f208);
          } else if (v305 === 2) {
            vU.forEach(f209);
          } else {
            var v306 = Array.prototype.slice.call(arguments, 1);
            vU.forEach(f210);
          }
          return !!vU.length;
        }
        function f211(p609, p610, p611) {
          if (!p611 || p609[vLSListeners]) {
            var v307 = p609[vLSListeners] ||= {};
            return v307[p610] ||= [];
          }
        }
        if (typeof p593 != "undefined") {
          p593.exports = p595;
        }
        var vLSListeners = "listeners";
        var vO8 = {
          on: f202,
          once: f203,
          off: f205,
          emit: f
        };
        f201(p595.prototype);
        p595.mixin = f201;
      })(f200);
    }, {}],
    32: [function (p612, p613, p614) {
      p614.read = function (p615, p616, p617, p618, p619) {
        var v308;
        var v309;
        var v310 = p619 * 8 - p618 - 1;
        var v311 = (1 << v310) - 1;
        var v312 = v311 >> 1;
        var v313 = -7;
        var v314 = p617 ? p619 - 1 : 0;
        var v315 = p617 ? -1 : 1;
        var v316 = p615[p616 + v314];
        v314 += v315;
        v308 = v316 & (1 << -v313) - 1;
        v316 >>= -v313;
        v313 += v310;
        for (; v313 > 0; v313 -= 8) {
          v308 = v308 * 256 + p615[p616 + v314];
          v314 += v315;
        }
        v309 = v308 & (1 << -v313) - 1;
        v308 >>= -v313;
        v313 += p618;
        for (; v313 > 0; v313 -= 8) {
          v309 = v309 * 256 + p615[p616 + v314];
          v314 += v315;
        }
        if (v308 === 0) {
          v308 = 1 - v312;
        } else {
          if (v308 === v311) {
            if (v309) {
              return NaN;
            } else {
              return (v316 ? -1 : 1) * Infinity;
            }
          }
          v309 += Math.pow(2, p618);
          v308 -= v312;
        }
        return (v316 ? -1 : 1) * v309 * Math.pow(2, v308 - p618);
      };
      p614.write = function (p620, p621, p622, p623, p624, p625) {
        var v317;
        var v318;
        var v319;
        var v320 = p625 * 8 - p624 - 1;
        var v321 = (1 << v320) - 1;
        var v322 = v321 >> 1;
        var v323 = p624 === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var v324 = p623 ? 0 : p625 - 1;
        var v325 = p623 ? 1 : -1;
        var v326 = p621 < 0 || p621 === 0 && 1 / p621 < 0 ? 1 : 0;
        p621 = Math.abs(p621);
        if (isNaN(p621) || p621 === Infinity) {
          v318 = isNaN(p621) ? 1 : 0;
          v317 = v321;
        } else {
          v317 = Math.floor(Math.log(p621) / Math.LN2);
          if (p621 * (v319 = Math.pow(2, -v317)) < 1) {
            v317--;
            v319 *= 2;
          }
          p621 += v317 + v322 >= 1 ? v323 / v319 : v323 * Math.pow(2, 1 - v322);
          if (p621 * v319 >= 2) {
            v317++;
            v319 /= 2;
          }
          if (v317 + v322 >= v321) {
            v318 = 0;
            v317 = v321;
          } else if (v317 + v322 >= 1) {
            v318 = (p621 * v319 - 1) * Math.pow(2, p624);
            v317 += v322;
          } else {
            v318 = p621 * Math.pow(2, v322 - 1) * Math.pow(2, p624);
            v317 = 0;
          }
        }
        for (; p624 >= 8; p624 -= 8) {
          p620[p622 + v324] = v318 & 255;
          v324 += v325;
          v318 /= 256;
        }
        v317 = v317 << p624 | v318;
        v320 += p624;
        for (; v320 > 0; v320 -= 8) {
          p620[p622 + v324] = v317 & 255;
          v324 += v325;
          v317 /= 256;
        }
        p620[p622 + v324 - v325] |= v326 * 128;
      };
    }, {}],
    33: [function (p626, p627, p628) {
      (function (p629) {
        var v327;
        var v328;
        var v329;
        var v330;
        (function (p630) {
          function o(p631, p632, p633) {
            function f213(p634, p635, p636, p637) {
              if (this instanceof f213) {
                return f215(this, p634, p635, p636, p637);
              } else {
                return new f213(p634, p635, p636, p637);
              }
            }
            function f214(p638) {
              return !!p638 && !!p638[v349];
            }
            function f215(p639, p640, p641, p642, p643) {
              if (v366 && v367) {
                if (p640 instanceof v367) {
                  p640 = new v366(p640);
                }
                if (p642 instanceof v367) {
                  p642 = new v366(p642);
                }
              }
              if (!p640 && !p641 && !p642 && !v364) {
                p639.buffer = f226(vA11, 0);
                return;
              }
              if (!f224(p640, p641)) {
                var v331 = v364 || Array;
                p643 = p641;
                p642 = p640;
                p641 = 0;
                p640 = new v331(8);
              }
              p639.buffer = p640;
              p639.offset = p641 |= 0;
              if (vLSUndefined !== typeof p642) {
                if (typeof p642 == "string") {
                  f216(p640, p641, p642, p643 || 10);
                } else if (f224(p642, p643)) {
                  f225(p640, p641, p642, p643);
                } else if (typeof p643 == "number") {
                  f219(p640, p641 + v339, p642);
                  f219(p640, p641 + v340, p643);
                } else if (p642 > 0) {
                  v345(p640, p641, p642);
                } else if (p642 < 0) {
                  v346(p640, p641, p642);
                } else {
                  f225(p640, p641, vA11, 0);
                }
              }
            }
            function f216(p644, p645, p646, p647) {
              var vLN038 = 0;
              var v332 = p646.length;
              var vLN039 = 0;
              var vLN040 = 0;
              if (p646[0] === "-") {
                vLN038++;
              }
              var vVLN038 = vLN038;
              while (vLN038 < v332) {
                var vParseInt2 = parseInt(p646[vLN038++], p647);
                if (!(vParseInt2 >= 0)) {
                  break;
                }
                vLN040 = vLN040 * p647 + vParseInt2;
                vLN039 = vLN039 * p647 + Math.floor(vLN040 / vLN4294967296);
                vLN040 %= vLN4294967296;
              }
              if (vVLN038) {
                vLN039 = ~vLN039;
                if (vLN040) {
                  vLN040 = vLN4294967296 - vLN040;
                } else {
                  vLN039++;
                }
              }
              f219(p644, p645 + v339, vLN039);
              f219(p644, p645 + v340, vLN040);
            }
            function f217() {
              var v333 = this.buffer;
              var v334 = this.offset;
              var v_ = f220(v333, v334 + v339);
              var v_2 = f220(v333, v334 + v340);
              if (!p633) {
                v_ |= 0;
              }
              if (v_) {
                return v_ * vLN4294967296 + v_2;
              } else {
                return v_2;
              }
            }
            function f218(p648) {
              var v335 = this.buffer;
              var v336 = this.offset;
              var v_3 = f220(v335, v336 + v339);
              var v_4 = f220(v335, v336 + v340);
              var vLS9 = "";
              var v337 = !p633 && v_3 & -2147483648;
              if (v337) {
                v_3 = ~v_3;
                v_4 = vLN4294967296 - v_4;
              }
              p648 = p648 || 10;
              while (true) {
                var v338 = v_3 % p648 * vLN4294967296 + v_4;
                v_3 = Math.floor(v_3 / p648);
                v_4 = Math.floor(v338 / p648);
                vLS9 = (v338 % p648).toString(p648) + vLS9;
                if (!v_3 && !v_4) {
                  break;
                }
              }
              if (v337) {
                vLS9 = "-" + vLS9;
              }
              return vLS9;
            }
            function f219(p649, p650, p651) {
              p649[p650 + v344] = p651 & 255;
              p651 >>= 8;
              p649[p650 + v343] = p651 & 255;
              p651 >>= 8;
              p649[p650 + v342] = p651 & 255;
              p651 >>= 8;
              p649[p650 + v341] = p651 & 255;
            }
            function f220(p652, p653) {
              return p652[p653 + v341] * vLN16777216 + (p652[p653 + v342] << 16) + (p652[p653 + v343] << 8) + p652[p653 + v344];
            }
            var v339 = p632 ? 0 : 4;
            var v340 = p632 ? 4 : 0;
            var v341 = p632 ? 0 : 3;
            var v342 = p632 ? 1 : 2;
            var v343 = p632 ? 2 : 1;
            var v344 = p632 ? 3 : 0;
            var v345 = p632 ? f227 : f229;
            var v346 = p632 ? f228 : f230;
            var v347 = f213.prototype;
            var v348 = "is" + p631;
            var v349 = "_" + v348;
            v347.buffer = undefined;
            v347.offset = 0;
            v347[v349] = true;
            v347.toNumber = f217;
            v347.toString = f218;
            v347.toJSON = f217;
            v347.toArray = f221;
            if (v365) {
              v347.toBuffer = f222;
            }
            if (v366) {
              v347.toArrayBuffer = f223;
            }
            f213[v348] = f214;
            p630[p631] = f213;
            return f213;
          }
          function f221(p654) {
            var v350 = this.buffer;
            var v351 = this.offset;
            v364 = null;
            if (p654 !== false && v351 === 0 && v350.length === 8 && v368(v350)) {
              return v350;
            } else {
              return f226(v350, v351);
            }
          }
          function f222(p655) {
            var v352 = this.buffer;
            var v353 = this.offset;
            v364 = v365;
            if (p655 !== false && v353 === 0 && v352.length === 8 && p629.isBuffer(v352)) {
              return v352;
            }
            var v354 = new v365(8);
            f225(v354, 0, v352, v353);
            return v354;
          }
          function f223(p656) {
            var v355 = this.buffer;
            var v356 = this.offset;
            var v357 = v355.buffer;
            v364 = v366;
            if (p656 !== false && v356 === 0 && v357 instanceof v367 && v357.byteLength === 8) {
              return v357;
            }
            var v358 = new v366(8);
            f225(v358, 0, v355, v356);
            return v358.buffer;
          }
          function f224(p657, p658) {
            var v359 = p657 && p657.length;
            p658 |= 0;
            return v359 && p658 + 8 <= v359 && typeof p657[p658] != "string";
          }
          function f225(p659, p660, p661, p662) {
            p660 |= 0;
            p662 |= 0;
            for (var vLN041 = 0; vLN041 < 8; vLN041++) {
              p659[p660++] = p661[p662++] & 255;
            }
          }
          function f226(p663, p664) {
            return Array.prototype.slice.call(p663, p664, p664 + 8);
          }
          function f227(p665, p666, p667) {
            for (var v360 = p666 + 8; v360 > p666;) {
              p665[--v360] = p667 & 255;
              p667 /= 256;
            }
          }
          function f228(p668, p669, p670) {
            var v361 = p669 + 8;
            for (p670++; v361 > p669;) {
              p668[--v361] = -p670 & 255 ^ 255;
              p670 /= 256;
            }
          }
          function f229(p671, p672, p673) {
            for (var v362 = p672 + 8; p672 < v362;) {
              p671[p672++] = p673 & 255;
              p673 /= 256;
            }
          }
          function f230(p674, p675, p676) {
            var v363 = p675 + 8;
            for (p676++; p675 < v363;) {
              p674[p675++] = -p676 & 255 ^ 255;
              p676 /= 256;
            }
          }
          function f231(p677) {
            return !!p677 && Object.prototype.toString.call(p677) == "[object Array]";
          }
          var v364;
          var vLSUndefined = "undefined";
          var v365 = vLSUndefined !== typeof p629 && p629;
          var v366 = vLSUndefined !== typeof Uint8Array && Uint8Array;
          var v367 = vLSUndefined !== typeof ArrayBuffer && ArrayBuffer;
          var vA11 = [0, 0, 0, 0, 0, 0, 0, 0];
          var v368 = Array.isArray || f231;
          var vLN4294967296 = 4294967296;
          var vLN16777216 = 16777216;
          v327 = o("Uint64BE", true, true);
          v328 = o("Int64BE", true, false);
          v329 = o("Uint64LE", false, true);
          v330 = o("Int64LE", false, false);
        })(typeof p628 == "object" && typeof p628.nodeName != "string" ? p628 : this || {});
      }).call(this, p626("buffer").Buffer);
    }, {
      buffer: 29
    }],
    34: [function (p678, p679, p680) {
      var v369 = {}.toString;
      p679.exports = Array.isArray || function (p681) {
        return v369.call(p681) == "[object Array]";
      };
    }, {}]
  }, {}, [1])(1);
});
let v370 = +new Date();
let vA12 = [];
/* removed: the Peadox anti-kick send proxy — same problem, it decoded every
   outbound frame as bare msgpack. The rate limit it enforced now lives in the
   io-client's send path, where the packet name is available before the frame
   is built and signed. */

// URL mappings for new hat images
var vO9 = {
  7: "https://i.imgur.com/vAOzlyY.png",
  15: "https://i.imgur.com/YRQ8Ybq.png",
  11: "https://i.imgur.com/yfqME8H.png",
  12: "https://i.imgur.com/VSUId2s.png",
  40: "https://i.imgur.com/Xzmg27N.png",
  26: "https://i.imgur.com/I0xGtyZ.png",
  6: "https://i.imgur.com/vM9Ri8g.png"
};

// URL mappings for new accessory images
var vO10 = {
  18: "https://i.imgur.com/0rmN7L9.png",
  21: "https://i.imgur.com/4ddZert.png"
};

// URL mappings for new weapon images
var vO11 = {
  samurai_1: "https://i.imgur.com/mbDE77n.png",
  samurai_1_g: "https://cdn.discordapp.com/attachments/967213871267971072/1030852038948552724/image.png",
  great_hammer_1: "https://cdn.discordapp.com/attachments/748171769155944448/1048806049924259860/image.png",
  great_hammer_1_g: "https://cdn.discordapp.com/attachments/748171769155944448/1048806467995713607/image_1.png",
  great_hammer_1_d: "https://cdn.discordapp.com/attachments/748171769155944448/1048806745910292571/image_2.png",
  dagger_1: "https://cdn.discordapp.com/attachments/748171769155944448/1048808212129927288/image.png",
  dagger_1_g: "https://cdn.discordapp.com/attachments/748171769155944448/1048808419932504074/image_1.png",
  hammer_1: "https://cdn.discordapp.com/attachments/748171769155944448/1048809420806692894/image.png",
  hammer_1_g: "https://cdn.discordapp.com/attachments/748171769155944448/1048809420437602394/image_1.png",
  spear_1: "https://cdn.discordapp.com/attachments/748171769155944448/1048810908564066324/image_2.png",
  spear_1_g: "https://cdn.discordapp.com/attachments/748171769155944448/1048810908207558787/image_3.png"
};

// Main function to retrieve the texture pack image URL
function f232(p682, p683) {
  // Check if the image URL exists in the newHatImgs object for hat type
  if (vO9[p682] && p683 === "hat") {
    return vO9[p682];
  }
  // Check if the image URL exists in the newAccImgs object for accessory type
  else if (vO10[p682] && p683 === "acc") {
    return vO10[p682];
  }
  // Check if the image URL exists in the newWeaponImgs object for weapon type
  else if (vO11[p682] && p683 === "weapons") {
    return vO11[p682];
  }
  // Return default image URLs based on the type
  else if (p683 === "acc") {
    return ".././img/accessories/access_" + p682 + ".png";
  } else if (p683 === "hat") {
    return ".././img/hats/hat_" + p682 + ".png";
  } else {
    return ".././img/weapons/" + p682 + ".png";
  }
}
(function () {
  'use strict';

  // Clear cache and cookies
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie.split(";").forEach(function (p684) {
    document.cookie = p684.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });

  // Enable performance mode
  var v372 = true; // Set to true to enable performance mode
  if (v372) {
    // Disable unnecessary features
    f233();
    f234();
    f235();
    // Adjust graphics settings
    f236("low");
    f237("800x600");
    f238(100);
    // Limit FPS
    f239(60);
  }

  // Disable shadows
  function f233() {
    // Your code to disable shadows goes here
  }

  // Disable reflections
  function f234() {
    // Your code to disable reflections goes here
  }

  // Disable vsync
  function f235() {
    // Your code to disable vsync goes here
  }

  // Set graphics quality
  function f236(p685) {
    // Your code to set graphics quality goes here
  }

  // Set resolution
  function f237(p686) {
    // Your code to set resolution goes here
  }

  // Set draw distance
  function f238(p687) {
    // Your code to set draw distance goes here
  }

  // Limit FPS
  function f239(p688) {
    // Your code to limit FPS goes here
  }
})();
document.getElementById("mainMenu").style.backgroundImage = "url('https://cdn.discordapp.com/attachments/1115299834614792355/1119498240111415296/yae-miko-genshin.gif')";
document.getElementById("enterGame").innerHTML = "Eu voltei";
document.getElementById("enterGame").style.color = "text-shadow: red 1px 1px 40px;";
document.getElementById("nameInput").placeholder = "Nome?";
document.getElementById("diedText").innerHTML = "Vai desistir?";
document.getElementById("gameName").innerHTML = "Unknown";
let v373 = false; /* Connect Useless Server */

let v374 = false;
let v375 = true;

// love florr.io
Math.florr = Math.floor;
function f240(p689, p690) {
  for (let vLN042 = 0; vLN042 < p690; vLN042++) {
    p689();
  }
}

// im joking
// song links
const v376 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1055142773948428348/Zack_Merci_X_CRVN_-_Nobody_NCS_Release.mp3");
const v377 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1055516288249757797/ae86.mp3");
const v378 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1069192210932826182/dontstandsoclose.mp3");
const v379 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1083793134162546799/Jonth_Tom_Wilson_Facading_MAGNUS_Jagsy_Vosai_RudeLies__Domastic_-_Heartless_NCS10_Release_-_from_YouTube.mp3");
const v380 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1086876186887594076/boobmoo.mp3");
const v381 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1110020974180573264/ooooaadhahaha.mp3");
const v382 = new Audio("https://cdn.discordapp.com/attachments/1115629924393427015/1117798919531942029/Hoa-Co-Lau-Phong-Max-2.mp3");
const v383 = new Audio("https://cdn.discordapp.com/attachments/1103324033283522751/1117806301855100958/qua-khu-anh-khong-the-quen-remix-tiktok-mp3-RIN-Music-Remix.mp3");
const v384 = new Audio("https://cdn.discordapp.com/attachments/1103324033283522751/1121719451713286144/Quan-Son-Tuu-Remix-Tiktok.mp3");
// sound links
const v385 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1101430764530323547/Plants_Vs_Zombies_Victory_Jingle_-_from_YouTube.mp3");
const v386 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1053978907717685288/ahh.mp3");
const v387 = new Audio("https://cdn.discordapp.com/attachments/1053956635032289280/1101435244311216169/penis_music_-_from_YouTube.mp3");
v387.volume = "0.2";
function f241(p691) {
  return document.getElementById(p691);
}
let vA13 = [];
let v388 = false;
const vO12 = {
  newLine: function (p692) {
    let v389 = ``;
    for (let vLN043 = 0; vLN043 < p692; vLN043++) {
      v389 += `<br>`;
    }
    return v389;
  },
  line: function () {
    return `<hr>`;
  },
  text: function (p693, p694, p695, p696) {
    return `<input type = "text" id = ${p693} size = ${p695} value = ${p694} maxlength = ${p696}>`;
  },
  checkBox: function (p697, p698, p699, p700) {
    return `${p700 ? `${p698} ` : ``}<input type = "checkbox" ${p699 ? `checked` : ``} id = ${p697}>${p700 ? `` : ` ${p698}`}`;
  },
  button: function (p701, p702, p703, p704) {
    return `<button class = ${p704} id = ${p701} onclick = ${p703}>${p702}</button>`;
  },
  select: function (p705, p706) {
    let v390 = `<select id = ${p705}>`;
    p706.forEach((p707, p708) => {
      v390 += `<option value = ${p707.value} ${p707.selected ? ` selected` : ``}>${p707.name}</option>`;
      if (p708 == p706.length - 1) {
        v390 += `</select>`;
      }
    });
    return v390;
  },
  modChange: function (p709, p710) {
    console.log("test");
  },
  mod: function (p711, p712) {
    let v391 = `<select id = ${p711}>`;
    p712.forEach((p713, p714) => {
      v391 += `<option value = ${p713.value + "C"}>${p713.name}</option>`;
      if (p714 == p712.length - 1) {
        v391 += `</select> `;
      }
      if (p714 == 0) {
        vA13.push(p713.value + "C");
      }
    });
    p712.forEach((p715, p716) => {
      v391 += `<input type = "checkbox"  ${p715.checked ? `checked` : ``} id = ${p715.value} style = "${p716 == 0 ? "display: inline-block;" : "display: none;"}">`;
    });
    return v391;
  },
  hotkey: function (p717, p718, p719, p720) {
    return `<input type = "text" id = ${p717} size = ${p719} value = ${p718} maxlength = ${p720}><input type = "checkbox" checked id = ${p717 + "k"}>`;
  }
};
function f242(p721) {
  if (p721.id == "tHome") {
    return "homeTab";
  } else if (p721.id == "t1") {
    return "miscTab";
  } else if (p721.id == "t2") {
    return "configTab";
  } else if (p721.id == "t3") {
    return "combatTab";
  } else {
    return "homeTab";
  }
}
function f243() {
  f241("homeTab").style.display = "none";
  f241("miscTab").style.display = "none";
  f241("configTab").style.display = "none";
  f241("combatTab").style.display = "none";
  f241("tHome").style.border = "2px solid transparent";
  f241("tHome").style.color = "#fff";
  f241("tHome").style.backgroundColor = "#000";
  for (let vLN110 = 1; vLN110 <= 3; vLN110++) {
    f241("t" + vLN110).style.border = "2px solid transparent";
    f241("t" + vLN110).style.color = "#fff";
    f241("t" + vLN110).style.backgroundColor = "#000";
  }
}
function f244(p722) {
  f243();
  f241(p722.id).style.color = "#000";
  f241(p722.id).style.backgroundColor = "#fff";
  f241(p722.id).style.border = "2px solid #000";
  f241(f242(p722)).style.display = "block";
}
let v392 = `
BoxTic:${vO12.newLine(1)}
${vO12.checkBox("ranName", "Random Name", false)}${vO12.newLine(1)}
${vO12.checkBox("ohio", "Pass Mode", false)}${vO12.newLine(2)}
Updates:
${vO12.line()}
v0.2 : Website New Versions <button onclick = "document.gototouchgrass()">Click Here!</button> ${vO12.newLine(1)}
`;
/*
 */
let vLSSelect = "Select";
// menu html
//made better by zlx/kite
let v393 = document.createElement("div");
v393.id = "modMenus";
document.body.append(v393);
v393.style = `
display: absolute;
padding: 10px;
background-color: rgba(0, 0, 0, 0.25);
border-radius: 4px;
position: absolute;
left: 20px;
top: 20px;
minWidth = "300px";
maxWidth = "290px";
minHeight = "400";
maxHeight = "700";
`;
let v394 = true;
let vLN044 = 0;
const vF = () => {
  const v395 = v393.style.opacity === "1";
  if (v395) {
    v393.style.opacity = "0";
    v393.style.pointerEvents = "none";
    vF2(vLN044, 0, 300);
    setTimeout(() => {
      v393.style.display = "none";
    }, 300);
  } else {
    v393.style.display = "block";
    setTimeout(() => {
      v393.style.opacity = "1";
    }, 0);
    v393.style.pointerEvents = "auto";
    vF2(vLN044, 5, 300);
  }
};
const vF2 = (p723, p724, p725) => {
  const v396 = p724 - p723;
  const v397 = performance.now();
  const vF3 = p726 => {
    const v398 = p726 - v397;
    if (v398 >= p725) {
      vLN044 = p724;
      vF4();
      return;
    }
    const v399 = v398 / p725;
    vLN044 = p723 + v396 * v399;
    vF4();
    requestAnimationFrame(vF3);
  };
  requestAnimationFrame(vF3);
};
const vF4 = () => {
  const v400 = document.querySelectorAll("body > *:not(#modMenus)");
  v400.forEach(p727 => {
    p727.style.filter = `blur(${vLN044}px)`;
  });
};
let v401 = false;
let vO13 = {
  x: 0,
  y: 0
};
v393.addEventListener("mousedown", p728 => {
  v401 = true;
  vO13.x = p728.clientX - v393.offsetLeft;
  vO13.y = p728.clientY - v393.offsetTop;

  // Disable smooth transitions during dragging
  v393.style.transition = "none";
});
document.addEventListener("mousemove", p729 => {
  if (v401) {
    const v402 = p729.clientX - vO13.x;
    const v403 = p729.clientY - vO13.y;
    v393.style.left = `${v402}px`;
    v393.style.top = `${v403}px`;
  }
});
document.addEventListener("mouseup", () => {
  v401 = false;

  // Enable smooth transitions after dragging
  v393.style.transition = "";
});
function f245() {
  v393.innerHTML = `
    <style>
    .tabchange {
    color: #fff;
    background-color: #808080;
    border: 2px solid transparent;
    border-radius: 20px;
    text-align: center;
    height: 25px;
    }
    .menuTabs {
    padding-left: 5px;
    padding-top: 5px;
    padding-bottom: 20px;
    }
    .holder {
    padding-left: 1em;
    }
    .nothing {
    }
    </style>
    <script>
    function toggleUI() {
    $("#gameUI").toggle();
};
</script>
<br>
<button id = "uifr?" onclick = "toggleUI()">
-Nigger v3-
</button>
<br>
<br>
<label for="ggezCh">AutoGG </label>
        <input value= "RMd" input="text" minlength="0" maxlength="33" id="ggezCh"><br>
},0);
setTimeout(() => {
<label for="ggezCh">AutoGG </label>
<input value= "I'm Super Racist" 1" input="text" minlength="0" maxlength="33" id="ggezCh"><br>
},2000);
<hr>
<div style = "
font-size: 12px;
overflow-y: scroll;
max-height: 150px;
">
    <div id = "headline" style = "font-size: 30px; color: rgb(255, 255, 255);">
    <div class = "menuEdit">
    ${vO12.button("tHome", "[ Home ]", "", "tabchange")}
    ${vO12.button("t1", "[  Misc  ]", "", "tabchange")}
    ${vO12.button("t2", "[  Settings  ]", "", "tabchange")}
    ${vO12.button("t3", "[  Combats  ]", "", "tabchange")}
    </div>
    <div style = "font-size: 12px; overflow-y: scroll; max-height: 150px;" max-width: 150px;>
    <div id = "homeTab" style = "display: block">
    <div id = "healer">Healer: High Ping</div>
    </div>
    <div id = "miscTab" style = "display: none">
    Create clan: ${vO12.text("ccv", "Ry", "20", "7")}${vO12.newLine(1)}
    ${vO12.button("ccf", "Create clan", `document.createAlliance(document.getElementById("ccv").value)`, "nothing")}${vO12.newLine(1)}
    ${vO12.select("autoupgrade", [{
    name: "Autoupgrade to DH",
    value: "dh"
  }, {
    name: "Autoupgrade to KH",
    value: "kh"
  }, {
    name: "Autoupgrade to SM",
    value: "sm"
  }])}${vO12.newLine(1)}
    7-Slot: ${vO12.select("7slot", [{
    name: "Teleporter",
    value: "38"
  }, {
    name: "Turret",
    value: "33"
  }])}${vO12.newLine(1)}
    </div>
    <div id = "configTab" style = "display: none">
    ${vO12.mod("configs", [{
    name: "AddAdditionalRangeOnLag",
    value: "addictdist"
  }, {
    name: "doAntiKickAtPacketLimit",
    value: "ak",
    checked: true
  }, {
    name: "doRenderKMTexture",
    value: "kmtexture",
    checked: true
  }, {
    name: "doAutoBullTick",
    value: "bulltick",
    checked: true
  }, {
    name: "doAutoQOnSync",
    value: "antisync",
    checked: true
  }, {
    name: "doAutoQOnHighPing",
    value: "autoq"
  }, {
    name: "doSimpleAntiInsta",
    value: "simpleheal"
  }, {
    name: "doTickBasedHealing",
    value: "tickheal",
    checked: true
  }, {
    name: "doTeamSyncWithChat",
    value: "teamsync",
    checked: true
  }, {
    name: "doAutoSpikeTickOnReplaced",
    value: "spiketick",
    checked: true
  }, {
    name: "doUseTurretOnCounter",
    value: "countertur",
    checked: true
  }, {
    name: "doUseSecondaryOnCounter",
    value: "countersec"
  }, {
    name: "doClickCombat",
    value: "clicktype"
  }, {
    name: "doAutoSpinning",
    value: "spin"
  }, {
    name: "doBuildingHealth",
    value: "bh",
    checked: true
  }, {
    name: "doRenderDark",
    value: "darkmode"
  }, {
    name: "doShowStackedAnimtext",
    value: "stacktext"
  }, {
    name: "doDisableAnimtext",
    value: "hidetext"
  }, {
    name: "doUpperCaseChatting",
    value: "chatc",
    checked: true
  }, {
    name: "doTryHardMode",
    value: "tryhard",
    checked: true
  }, {
    name: "doGitInsta",
    value: "alwaysrev",
    checked: true
  }, {
    name: "doBotMovementToNear",
    value: "botmove"
  }])}${vO12.newLine(1)}
    <div id = "freeCam">Freecam: none</div>
    Freecam hotkey: ${vO12.hotkey("freecumLOL", "/", "2", "1")}${vO12.newLine(1)}
    InstaBow hotkey: ${vO12.hotkey("bowinstakey", "g", "2", "1")}${vO12.newLine(1)}
    Boost Tick hotkey: ${vO12.hotkey("zeroframe", "t", "2", "1")}${vO12.newLine(1)}
    Team Sync hotkey: ${vO12.hotkey("synckey", "b", "2", "1")}${vO12.newLine(1)}
    Debug hotkey: ${vO12.hotkey("debugkey", "Z", "2", "1")}${vO12.newLine(1)}
    Spike hotkey: ${vO12.hotkey("spikekey", "v", "2", "1")}${vO12.newLine(1)}
    Trap/Boost hotkey: ${vO12.hotkey("trapkey", "f", "2", "1")}${vO12.newLine(1)}
    Turret/Teleport hotkey: ${vO12.hotkey("turretkey", "h", "2", "1")}${vO12.newLine(1)}
    Automill hotkey: ${vO12.hotkey("millkey", "z", "2", "1")}${vO12.newLine(1)}
    Connectbot hotkey: ${vO12.hotkey("botkey", "G", "2", "1")}${vO12.newLine(1)}
    Zoom hotkey: ${vO12.hotkey("zoomkey", "-", "2", "1")}${vO12.newLine(1)}
    Zoom reset key: ${vO12.hotkey("zoomresetkey", "=", "2", "1")}${vO12.newLine(1)}
    Song hotkey: ${vO12.hotkey("songkey", "C", "2", "1")}${vO12.newLine(1)}
    Song: ${vO12.select("songs", [{
    name: "CRVN",
    value: "1"
  }, {
    name: "Ae86 Chill",
    value: "2"
  }, {
    name: "Dr Love",
    value: "3"
  }, {
    name: "Domastic",
    value: "4"
  }, {
    name: "PVRIS",
    value: "5"
  }, {
    name: "x Invincible",
    value: "6"
  }, {
    name: "Hoa Co Lau - Phong Max",
    value: "7"
  }, {
    name: "Qua Khu Cua Anh",
    value: "8",
    selected: true
  }, {
    name: "Quan tuu son Remix",
    value: "9"
  }])}${vO12.newLine(1)}
      ${vO12.checkBox("showch", "sendChatPacket", true, true)}${vO12.newLine(1)}
    Ratio hotkey: ${vO12.hotkey("ezkey", "p", "2", "1")}${vO12.newLine(1)}
    Vision: ${vO12.select("vision", [{
    name: "1",
    value: "1",
    selected: true
  }, {
    name: "1.1",
    value: "1.1"
  }, {
    name: "1.2",
    value: "1.2"
  }, {
    name: "1.3",
    value: "1.3"
  }, {
    name: "1.4",
    value: "1.4"
  }, {
    name: "1.5",
    value: "1.5"
  }])}${vO12.newLine(1)}
    ProjectVisua: ${vO12.select("combat", [{
    name: "ae86 2021",
    value: "ae"
  }, {
    name: "LIVE AE86",
    value: "zyenith",
    selected: true
  }, {
    name: "HansMode",
    value: "hans"
  }, {
    name: "FZ Bloadcats",
    value: "fz"
  }, {
    name: "Ueheua",
    value: "me"
  }])} - <div id = "crp" style = "display: inline-block;">Nigga MOD</div>${vO12.newLine(1)}
    RandomVisual: ${vO12.select("visual", [{
    name: "Testure",
    value: "fz",
    selected: true
  }])} - <div id = "vrp" style = "display: inline-block;">GetRacist</div>${vO12.newLine(1)}
    </div>
    <div id = "combatTab" style = "display: none">
    (region locked) ${vO12.button("serverwarper", "Warp to Active Server", `document.warpServer()`, "nothing")}${vO12.newLine(2)}
    Object for the placer: ${vO12.select("placeconfig", [{
    name: "Walls",
    value: "1"
  }, {
    name: "Spikes",
    value: "2"
  }, {
    name: "Windmills",
    value: "3",
    selected: true
  }, {
    name: "Trap/Boosts",
    value: "4"
  }, {
    name: "Teleport/Turrets",
    value: "5"
  }])}${vO12.newLine(2)}
    One-way: ${vO12.button("streamer", "Streamer Mode", "", "nothing")}${vO12.newLine(2)}
    farm
    <div class = "holder">
    ${vO12.checkBox("grind", "autoRuby", false)}${vO12.newLine(1)}
    ${vO12.checkBox("grindsec", "autoRubySec", true)}${vO12.newLine(1)}
    </div>
    anti
    <div class = "holder">
    ${vO12.checkBox("soldieranti", "soldierAntiInsta", true)}${vO12.newLine(1)}
    ${vO12.checkBox("soldierempanti", "soldierEmpAntiInsta", true)}${vO12.newLine(1)}
    ${vO12.checkBox("antitick", "anti0Tick", true)}${vO12.newLine(1)}
    ${vO12.checkBox("antirange", "antiRangedInsta", true)}${vO12.newLine(1)}
    </div>
    autoBreak
    <div class = "holder">
    ${vO12.checkBox("earlyab", "early", true)}${vO12.newLine(1)}
    earlyWaitTime ${vO12.newLine(1)}
    ${vO12.text("earlytime", "10", "6", "5")}${vO12.newLine(1)}
    ${vO12.checkBox("abactive", "activate", true)}${vO12.newLine(1)}
    ${vO12.checkBox("ab360hit", "breakitems(Patched)", false)}${vO12.newLine(1)}
    ${vO12.checkBox("abplace", "tryPlacementEveryTick", false)}${vO12.newLine(1)}
    </div>
    music
    <div class = "holder">
    ${vO12.checkBox("msync", "sync", true)}${vO12.newLine(1)}
    </div>
    autoTrigger
    <div class = "holder">
    ${vO12.checkBox("sync", "syncShots", false)}${vO12.newLine(1)}
    syncThrottle ${vO12.newLine(1)}
    ${vO12.text("synccount", "1", "6", "2")}${vO12.newLine(1)}
    </div>
    mouse
    <div class = "holder">
    ${vO12.checkBox("clicksync", "mclickSync", false)}${vO12.newLine(1)}
    </div>
    autoQ
    <div class = "holder">
    ${vO12.checkBox("evautoq", "alwaysOn", false)}${vO12.newLine(1)}
    </div>
    placement
    <div class = "holder">
    ${vO12.checkBox("replc", "autoreplace", true)}${vO12.newLine(1)}
    ${vO12.checkBox("autoplc", "placeEveryTick", true)}${vO12.newLine(1)}
    </div>
    autoUpgrade
    <div class = "holder">
    ${vO12.checkBox("aaauaua", "activate", false)}${vO12.newLine(1)}
    </div>
    </div>
    </div>
    `;
}
f245();
f244(f241("tHome"));
f241("tHome").onclick = function () {
  f244(this);
};
f241("t1").onclick = function () {
  f244(this);
};
f241("t2").onclick = function () {
  f244(this);
};
f241("t3").onclick = function () {
  f244(this);
};
f241("streamer").onclick = function () {
  v388 = !v388;
};
f241("ccv").onfocus = function () {
  v394 = false;
};
f241("ccv").onblur = function () {
  v394 = true;
};
let v404 = vA13[0];
let v405 = vA13[0];
f241("configs").onchange = function () {
  let v406 = f241("configs").value;
  let vF5 = function (p730) {
    return p730.slice(0, p730.length - 1);
  };
  v404 = v405;
  v405 = v406;
  f241(vF5(v404)).style.display = "none";
  f241(vF5(v405)).style.display = "inline-block";
};
function f246(p731) {
  let v407 = p731 == "0" ? "Legit" : p731 == "spyder" ? "Quasar Beta v0.83" : p731 == "lore" ? "L._.re FZ Lover" : p731 == "zeph" ? "J Mod" : p731 == "cele" ? "Nigga Mod" : p731 == "ae" ? "Tryhardmode" : p731 == "fz" ? "Nigga v3" : p731 == "zyenith" ? "RV3" : p731 == "me" ? "Pre Client V69420" : p731 == "hans" ? "Sofia Client" : "U r bad";
  return v407;
}
f241("crp").innerHTML = f246(f241("combat").value);
f241("vrp").innerHTML = f246(f241("visual").value);
document.gototouchgrass = function () {
  window.onbeforeunload = undefined;
  window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
};
let vLS10 = "";
let vA14 = [];
let v408 = true;
let vUndefined = undefined;
let vLN100 = 100;
var vLN045 = 0;
var vLN046 = 0;
var vLN1102 = 110;
var vLN5100 = 5100;
var vLN1000 = 1000;
var vLN60000 = 60000;
var vO14 = {
  sec: false,
  min: false
};
let v409;
let vLN047 = 0;
let v410 = false;
let vO15 = {
  x: 0,
  y: 0,
  sync: true
};
let vUndefined2 = undefined;
let v411 = true;

// BOT SEVEN:
function f247(p732, p733, p734) {
  // isProd
  let v412 = p732 && new WebSocket(v409 + "&token=" + encodeURIComponent(p732));
  let vP734 = p734;
  v412.binaryType = "arraybuffer";
  v412.weapons = [0];
  v412.fixItems = [0, 3, 6, 10];
  v412.testTickCount = 0;
  v412.mill = {
    x: 0,
    y: 0
  };
  v412.old = {
    x: 0,
    y: 0
  };
  v412.millCount = 0;
  v412.score = 0;
  v412.aliveee = false;
  v412.waitHit = false;
  v412.pR = 0;
  v412.sR = 0;
  v412.skins = [0];
  v412.tails = [0];
  v412.finded = [];
  v412.nears = [];
  v412.nearAim = 0;
  v412.id = undefined;
  v412.goTo = undefined;
  v412.goDst = undefined;
  v412.tickLow = [];
  v412.sTime = 0;
  v412.sCount = 0;
  v412.health = 100;
  v412.waita = 0;
  v412.gameObjects = [];
  v412.trapAim = 0;
  v412.inTrap = false;
  let vLN2400 = 2400;
  let vLN724 = 724;
  let vLN14400 = 14400;
  v412.alliances = [];
  v412.alliancePlayers = [];
  function f248(p735) {
    v412.send(new Uint8Array(Array.from(window.msgpack.encode(p735))));
  }
  function f249() {
    v412.weapons = [0];
    v412.items = [0, 3, 6, 10];
    v412.score = 100;
    v412.upgraded = 0;
    let vA15 = [4, 6];
    let v413 = vA15[Math.floor(Math.random() * vA15.length)];
    let v414 = v413 === 4 ? "GG" : "GG";
    f248(["sp", [{
      name: "seven" + v414,
      moofoll: 1,
      skin: v413
    }]]);
    //"propertyIsEnumerable"
    f248(["7", [true]]);
    setTimeout(() => {
      f250();
    }, 1000);
  }
  function f250() {
    f248(["5", [v412.items[0]]]);
    f248(["c", [1]]);
    f248(["5", [v412.weapon, true]]);
  }
  function f251(p736) {
    f248(["5", [v412.items[4]]]);
    f248(["c", [1, p736]]);
    f248(["5", [v412.weapon, true]]);
  }
  function f252(p737) {
    f248(["5", [v412.items[3]]]);
    f248(["c", [1, p737]]);
    f248(["5", [v412.weapon, true]]);
  }
  function f253(p738, p739) {
    f248(["5", [v412.items[p738]]]);
    f248(["c", [1, p739]]);
    f248(["5", [v412.weapon, true]]);
  }
  function f254(p740, p741) {
    f248(["13c", [0, p740, p741]]);
  }
  function f255(p742, p743) {
    f248(["13c", [1, p742, p743]]);
  }
  function f256(p744, p745) {
    if (p745 == 0) {
      if (v412.skins[p744]) {
        if (v412.hat != p744) {
          f254(p744, 0);
        }
      } else if (p744 == 6 && v412.score >= 4000) {
        f255(p744, 0);
      } else if (p744 == 12 && v412.score >= 6000) {
        f255(p744, 0);
      } else if (p744 == 53 && v412.score >= 10000) {
        f255(p744, 0);
      }
    } else if (p745 == 1) {
      if (v412.tails[p744]) {
        if (v412.accessory != p744) {
          f254(p744, 1);
        }
      } else if (p744 == 21 && v412.score >= 15000) {
        f255(p744, 1);
      } else if (p744 == 11 && v412.score >= 2000) {
        f255(p744, 1);
      }
    }
  }
  function f257() {}
  function f258() {}
  function f259(p746) {
    return p746 * (Math.PI / 180);
  }
  function f260(p747) {
    f248(["H", [p747]]);
  }
  v412.mill = {
    x: 0,
    y: 0
  };
  v412.old = {
    x: 0,
    y: 0
  };
  v412.sync = false;
  v412.movedir = undefined;
  v412.onmessage = function (p748) {
    let v415 = window.msgpack.decode(new Uint8Array(p748.data));
    let v416;
    if (v415.length > 1) {
      v416 = [v415[0], ...v415[1]];
      if (v416[1] instanceof Array) {
        v416 = v416;
      }
    } else {
      v416 = v415;
    }
    let v417 = v416[0];
    if (!v416) {
      return;
    }
    if (v416[0] == "1" && v412.id == null) {
      v412.id = v416[1];
    }
    if (v416[0] == "11") {
      f249();
    }
    if (v416[0] == "33") {
      v412.enemy = [];
      v412.near = [];
      if (v412.firstMan) {
        v412.tickC += 1;
      }
      for (let vLN048 = 0; vLN048 < v416[1].length / 13; vLN048++) {
        let v418 = v416[1].slice(vLN048 * 13, vLN048 * 13 + 13);
        if (v418[0] == v412.id) {
          v412.id = v418[0];
          v412.x = v418[1];
          v412.y = v418[2];
          v412.weapon = v418[5];
          v412.clan = v418[7];
          v412.hat = v418[9];
          v412.accessory = v418[10];
          if (v412.firstMan) {
            vUndefined = v412.clan;
          }
        }
        if (v418[0] != v412.id && (!v418[7] || v418[7] != v412.clan)) {
          v412.enemy.push(v418);
        }
      }
      if (v412.enemy.length) {
        v412.near = v412.enemy.sort(function (p749, p750) {
          return Math.hypot(p749[2] - v412.y, p749[1] - v412.x) - Math.hypot(p750[2] - v412.y, p750[1] - v412.x);
        })[0];
      }
      if (f241("botmove").checked || v412.enemy.length) {
        if (f241("botmove").checked) {
          v412.movedir = vUndefined2(v412);
          f248(["33", [vUndefined2(v412)]]);
          if (Math.hypot(v412.near[2] - v412.y, v412.near[1] - v412.x) <= 300) {
            f251(Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x));
          } else {
            f248(["2", [Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x)]]);
          }
        } else {
          v412.movedir = Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x);
          f248(["33", [Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x)]]);
          if (Math.hypot(v412.near[2] - v412.y, v412.near[1] - v412.x) <= 300) {
            f251(Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x));
          } else {
            f248(["2", [Math.atan2(v412.near[2] - v412.y, v412.near[1] - v412.x)]]);
          }
        }
      } else if (v412.movedir != undefined) {
        v412.movedir = undefined;
        f248(["33", [undefined]]);
      }
      if (Math.hypot(v412.near[2] - v412.y, v412.near[1] - v412.x) <= 300) {
        if (v412.weapon != (v412.weapons[1] ? v412.weapons[1] : v412.weapons[0])) {
          f248(["5", [v412.weapons[1] ? v412.weapons[1] : v412.weapons[0], true]]);
        }
      } else if (v412.weapon != v412.weapons[0]) {
        f248(["5", [v412.weapons[0], true]]);
      }
      if (vO15.sync) {
        f256(53, 0);
      } else {
        f256(6, 0);
      }
      f256(21, 1);
      if (v412.firstMan) {
        if (!v412.clan) {
          let vLSClan = "clan";
          let vLSABCDEFGHIJKLMNOPQRST2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          for (let vLN049 = 0; vLN049 < 3; vLN049++) {
            vLSClan += vLSABCDEFGHIJKLMNOPQRST2.charAt(Math.floor(Math.random() * vLSABCDEFGHIJKLMNOPQRST2.length));
          }
          f248(["8", [vLSClan]]);
        } else if (v412.tickC % 9 === 0) {
          if (v412.allianceNotifications.length) {
            f248(["11", [v412.allianceNotifications[0].sid, true]]);
            v412.allianceNotifications.splice(0, 1);
          }
        }
      } else if (v412.clan && v412.clan != vUndefined) {
        f248(["9", [undefined]]);
      } else if (v412.clan != vUndefined) {
        f248(["10", [vUndefined]]);
      }
      if (v412.millCount <= 96 && (!(v412.y >= vLN14400 / 2 - vLN724 / 2) || !(v412.y <= vLN14400 / 2 + vLN724 / 2)) && window.location.hostname == "sandbox.moomoo.io") {
        if (v412.oldy != v412.y || v412.oldx != v412.x) {
          if (Math.hypot(v412.mill.y - v412.y, v412.mill.x - v412.x) > 94) {
            let v419 = Math.atan2(v412.old.y - v412.y, v412.old.x - v412.x);
            f252(v419 + f259(94 / 1.25));
            f252(v419 - f259(94 / 1.25));
            f252(v419);
            v412.mill.x = v412.x;
            v412.mill.y = v412.y;
          }
          v412.old.x = v412.x;
          v412.old.y = v412.y;
        }
      }
    }
    if (v416[0] == "14") {
      if (v416[1] == 3) {
        v412.millCount = v416[2];
      }
    }
    if (v416[0] == "16") {
      if (v416[1] > 0) {
        if (v412.upgraded == 0) {
          f260(3);
        } else if (v412.upgraded == 1) {
          f260(17);
        } else if (v412.upgraded == 2) {
          f260(31);
        } else if (v412.upgraded == 3) {
          f260(27);
        } else if (v412.upgraded == 4) {
          f260(11);
        } else if (v412.upgraded == 5) {
          f260(38);
        } else if (v412.upgraded == 6) {
          f260(4);
        } else if (v412.upgraded == 7) {
          f260(25);
        }
        v412.upgraded++;
      }
    }
    if (v416[0] == "17") {
      if (v416[1]) {
        if (v416[2]) {
          v412.weapons = v416[1];
        } else {
          v412.items = v416[1];
        }
      }
    }
    if (v416[0] == "h" && v416[1] == v412.id) {
      let v420 = v412.health - v416[2];
      if (v412.health - v416[2] < 0) {
        if (v412.sTime) {
          let v421 = Date.now() - v412.sTime;
          v412.sTime = 0;
          if (v421 <= 120) {
            v412.sCount++;
          } else {
            v412.sCount = Math.max(0, v412.sCount - 2);
          }
        }
      } else {
        v412.sTime = Date.now();
      }
      if (v420 >= 10 && v412.sCount < 4) {
        f250();
      } else {
        setTimeout(() => {
          f250();
        }, 75);
      }
      v412.health = v416[2];
    }
    if (v412.firstMan) {
      if (v416[0] == "an") {
        v412.allianceNotifications.push({
          sid: v416[1],
          name: v416[2]
        });
      }
    }
    if (v416[0] == "us") {
      if (v416[3]) {
        if (!v416[1]) {
          v412.tails[v416[2]] = 1;
        } else {
          v412.accessory = v416[2];
        }
      } else if (!v416[1]) {
        v412.skins[v416[2]] = 1;
      } else {
        v412.hat = v416[2];
      }
    }
    if (v416[0] == "9") {
      if (v416[1] == "points") {
        v412.score = v416[2];
      } else if (v416[1] == "kills") {
        f248(["6", ["Mod by sevenGG#2373"]]);
      }
    }
  };
  v412.onopen = function () {
    vLN047++;
    f249();
    vA14.push(v412);
  };
  v412.onclose = function () {
    if (v412.firstMan) {
      v408 = true;
      vUndefined = undefined;
    }
  };
}
/******/
(function (p751) {
  // webpackBootstrap
  /******/
  // The module cache
  /******/
  var vO16 = {};
  /******/
  /******/
  // The require function
  /******/
  function f261(p752) {
    /******/
    /******/
    // Check if module is in cache
    /******/
    if (vO16[p752]) {
      /******/
      return vO16[p752].exports;
      /******/
    }
    /******/
    // Create a new module (and put it into the cache)
    /******/
    var v422 = vO16[p752] = {
      /******/
      i: p752,
      /******/
      l: false,
      /******/
      exports: {}
      /******/
    };
    /******/
    /******/
    // Execute the module function
    /******/
    p751[p752].call(v422.exports, v422, v422.exports, f261);
    /******/
    /******/
    // Flag the module as loaded
    /******/
    v422.l = true;
    /******/
    /******/
    // Return the exports of the module
    /******/
    return v422.exports;
    /******/
  }
  /******/
  /******/
  /******/
  // expose the modules object (__webpack_modules__)
  /******/
  f261.m = p751;
  /******/
  /******/
  // expose the module cache
  /******/
  f261.c = vO16;
  /******/
  /******/
  // define getter function for harmony exports
  /******/
  f261.d = function (p753, p754, p755) {
    /******/
    if (!f261.o(p753, p754)) {
      /******/
      Object.defineProperty(p753, p754, {
        enumerable: true,
        get: p755
      });
      /******/
    }
    /******/
  };
  /******/
  /******/
  // define __esModule on exports
  /******/
  f261.r = function (p756) {
    /******/
    if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
      /******/
      Object.defineProperty(p756, Symbol.toStringTag, {
        value: "Module"
      });
      /******/
    }
    /******/
    Object.defineProperty(p756, "__esModule", {
      value: true
    });
    /******/
  };
  /******/
  /******/
  // create a fake namespace object
  /******/
  // mode & 1: value is a module id, require it
  /******/
  // mode & 2: merge all properties of value into the ns
  /******/
  // mode & 4: return value when already ns object
  /******/
  // mode & 8|1: behave like require
  /******/
  f261.t = function (p757, p758) {
    /******/
    if (p758 & 1) {
      p757 = f261(p757);
    }
    /******/
    if (p758 & 8) {
      return p757;
    }
    /******/
    if (p758 & 4 && typeof p757 === "object" && p757 && p757.__esModule) {
      return p757;
    }
    /******/
    var v423 = Object.create(null);
    /******/
    f261.r(v423);
    /******/
    Object.defineProperty(v423, "default", {
      enumerable: true,
      value: p757
    });
    /******/
    if (p758 & 2 && typeof p757 != "string") {
      for (var v424 in p757) {
        f261.d(v423, v424, function (p759) {
          return p757[p759];
        }.bind(null, v424));
      }
    }
    /******/
    return v423;
    /******/
  };
  /******/
  /******/
  // getDefaultExport function for compatibility with non-harmony modules
  /******/
  f261.n = function (p760) {
    /******/
    var v425 = p760 && p760.__esModule ? /******/
    function f262() {
      return p760.default;
    } : /******/
    function f263() {
      return p760;
    };
    /******/
    f261.d(v425, "a", v425);
    /******/
    return v425;
    /******/
  };
  /******/
  /******/
  // Object.prototype.hasOwnProperty.call
  /******/
  f261.o = function (p761, p762) {
    return Object.prototype.hasOwnProperty.call(p761, p762);
  };
  /******/
  /******/
  // __webpack_public_path__
  /******/
  f261.p = "";
  /******/
  /******/
  /******/
  // Load entry module and return exports
  /******/
  return f261(f261.s = "./src/js/app.js");
  /******/
})(/************************************************************************/
/******/
{
  /***/
  "./node_modules/bad-words/lib/badwords.js":
  /*!************************************************!*\
  !*** ./node_modules/bad-words/lib/badwords.js ***!
  \************************************************/
  /*! no static exports found */
  /***/
  function (p763, p764, p765) {
    const v426 = p765(/*! ./lang.json */
    "./node_modules/bad-words/lib/lang.json").words;
    const v427 = p765(/*! badwords-list */
    "./node_modules/badwords-list/lib/index.js").array;
    class C2 {
      /**
           * Filter constructor.
           * @constructor
           * @param {object} options - Filter instance options
           * @param {boolean} options.emptyList - Instantiate filter with no blacklist
           * @param {array} options.list - Instantiate filter with custom list
           * @param {string} options.placeHolder - Character used to replace profane words.
           * @param {string} options.regex - Regular expression used to sanitize words before comparing them to blacklist.
           * @param {string} options.replaceRegex - Regular expression used to replace profane words with placeHolder.
           */
      constructor(p766 = {}) {
        Object.assign(this, {
          list: p766.emptyList && [] || Array.prototype.concat.apply(v426, [v427, p766.list || []]),
          exclude: p766.exclude || [],
          placeHolder: p766.placeHolder || "*",
          regex: p766.regex || /[^a-zA-Z0-9|\$|\@]|\^/g,
          replaceRegex: p766.replaceRegex || /\w/g
        });
      }
      /**
           * Determine if a string contains profane language.
           * @param {string} string - String to evaluate for profanity.
           */
      isProfane(p767) {
        return this.list.filter(p768 => {
          const v428 = new RegExp(`\\b ${p768.replace(/(\W)/g, "\\$1")}\\b`, "gi");
          return !this.exclude.includes(p768.toLowerCase()) && v428.test(p767);
        }).length > 0 || false;
      }
      /**
           * Replace a word with placeHolder characters;
           * @param {string} string - String to replace.
           */
      replaceWord(p769) {
        return p769.replace(this.regex, "").replace(this.replaceRegex, this.placeHolder);
      }
      /**
           * Evaluate a string for profanity and return an edited version.
           * @param {string} string - Sentence to filter.
           */
      clean(p770) {
        return p770.split(/\b/).map(p771 => {
          if (this.isProfane(p771)) {
            return this.replaceWord(p771);
          } else {
            return p771;
          }
        }).join("");
      }
      /**
           * Add word(s) to blacklist filter / remove words from whitelist filter
           * @param {...string} word - Word(s) to add to blacklist
           */
      addWords() {
        let v429 = Array.from(arguments);
        this.list.push(...v429);
        v429.map(p772 => p772.toLowerCase()).forEach(p773 => {
          if (this.exclude.includes(p773)) {
            this.exclude.splice(this.exclude.indexOf(p773), 1);
          }
        });
      }
      /**
           * Add words to whitelist filter
           * @param {...string} word - Word(s) to add to whitelist.
           */
      removeWords() {
        this.exclude.push(...Array.from(arguments).map(p774 => p774.toLowerCase()));
      }
    }
    p763.exports = C2;
    /***/
  },
  /***/
  "./node_modules/bad-words/lib/lang.json":
  /*!**********************************************!*\
  !*** ./node_modules/bad-words/lib/lang.json ***!
  \**********************************************/
  /*! exports provided: words, default */
  /***/
  function (p775) {
    p775.exports = {
      words: ["ahole", "anus", "ash0le", "ash0les", "asholes", "ass", "Ass Monkey", "Assface", "assh0le", "assh0lez", "asshole", "assholes", "assholz", "asswipe", "azzhole", "bassterds", "bastard", "bastards", "bastardz", "basterds", "basterdz", "Biatch", "bitch", "bitches", "Blow Job", "boffing", "butthole", "buttwipe", "c0ck", "c0cks", "c0k", "Carpet Muncher", "cawk", "cawks", "Clit", "cnts", "cntz", "cock", "cockhead", "cock-head", "cocks", "CockSucker", "cock-sucker", "crap", "cum", "cunt", "cunts", "cuntz", "dick", "dild0", "dild0s", "dildo", "dildos", "dilld0", "dilld0s", "dominatricks", "dominatrics", "dominatrix", "dyke", "enema", "f u c k", "f u c k e r", "fag", "fag1t", "faget", "fagg1t", "faggit", "faggot", "fagg0t", "fagit", "fags", "fagz", "faig", "faigs", "fart", "flipping the bird", "fuck", "fucker", "fuckin", "fucking", "fucks", "Fudge Packer", "fuk", "Fukah", "Fuken", "fuker", "Fukin", "Fukk", "Fukkah", "Fukken", "Fukker", "Fukkin", "g00k", "God-damned", "h00r", "h0ar", "h0re", "hells", "hoar", "hoor", "hoore", "jackoff", "jap", "japs", "jerk-off", "jisim", "jiss", "jizm", "jizz", "knob", "knobs", "knobz", "kunt", "kunts", "kuntz", "Lezzian", "Lipshits", "Lipshitz", "masochist", "masokist", "massterbait", "masstrbait", "masstrbate", "masterbaiter", "masterbate", "masterbates", "Motha Fucker", "Motha Fuker", "Motha Fukkah", "Motha Fukker", "Mother Fucker", "Mother Fukah", "Mother Fuker", "Mother Fukkah", "Mother Fukker", "mother-fucker", "Mutha Fucker", "Mutha Fukah", "Mutha Fuker", "Mutha Fukkah", "Mutha Fukker", "n1gr", "nastt", "nigger;", "nigur;", "niiger;", "niigr;", "orafis", "orgasim;", "orgasm", "orgasum", "oriface", "orifice", "orifiss", "packi", "packie", "packy", "paki", "pakie", "paky", "pecker", "peeenus", "peeenusss", "peenus", "peinus", "pen1s", "penas", "penis", "penis-breath", "penus", "penuus", "Phuc", "Phuck", "Phuk", "Phuker", "Phukker", "polac", "polack", "polak", "Poonani", "pr1c", "pr1ck", "pr1k", "pusse", "pussee", "pussy", "puuke", "puuker", "queer", "queers", "queerz", "qweers", "qweerz", "qweir", "recktum", "rectum", "retard", "sadist", "scank", "schlong", "screwing", "semen", "sex", "sexy", "Sh!t", "sh1t", "sh1ter", "sh1ts", "sh1tter", "sh1tz", "shit", "shits", "shitter", "Shitty", "Shity", "shitz", "Shyt", "Shyte", "Shytty", "Shyty", "skanck", "skank", "skankee", "skankey", "skanks", "Skanky", "slag", "slut", "sluts", "Slutty", "slutz", "son-of-a-bitch", "tit", "turd", "va1jina", "vag1na", "vagiina", "vagina", "vaj1na", "vajina", "vullva", "vulva", "w0p", "wh00r", "wh0re", "whore", "xrated", "xxx", "b!+ch", "bitch", "blowjob", "clit", "arschloch", "fuck", "shit", "ass", "asshole", "b!tch", "b17ch", "b1tch", "bastard", "bi+ch", "boiolas", "buceta", "c0ck", "cawk", "chink", "cipa", "clits", "cock", "cum", "cunt", "dildo", "dirsa", "ejakulate", "fatass", "fcuk", "fuk", "fux0r", "hoer", "hore", "jism", "kawk", "l3itch", "l3i+ch", "lesbian", "masturbate", "masterbat*", "masterbat3", "motherfucker", "s.o.b.", "mofo", "nazi", "nigga", "nigger", "nutsack", "phuck", "pimpis", "pusse", "pussy", "scrotum", "sh!t", "shemale", "shi+", "sh!+", "slut", "smut", "teets", "tits", "boobs", "b00bs", "teez", "testical", "testicle", "titt", "w00se", "jackoff", "wank", "whoar", "whore", "*damn", "*dyke", "*fuck*", "*shit*", "@$$", "amcik", "andskota", "arse*", "assrammer", "ayir", "bi7ch", "bitch*", "bollock*", "breasts", "butt-pirate", "cabron", "cazzo", "chraa", "chuj", "Cock*", "cunt*", "d4mn", "daygo", "dego", "dick*", "dike*", "dupa", "dziwka", "ejackulate", "Ekrem*", "Ekto", "enculer", "faen", "fag*", "fanculo", "fanny", "feces", "feg", "Felcher", "ficken", "fitt*", "Flikker", "foreskin", "Fotze", "Fu(*", "fuk*", "futkretzn", "gook", "guiena", "h0r", "h4x0r", "hell", "helvete", "hoer*", "honkey", "Huevon", "hui", "injun", "jizz", "kanker*", "kike", "klootzak", "kraut", "knulle", "kuk", "kuksuger", "Kurac", "kurwa", "kusi*", "kyrpa*", "lesbo", "mamhoon", "masturbat*", "merd*", "mibun", "monkleigh", "mouliewop", "muie", "mulkku", "muschi", "nazis", "nepesaurio", "nigger*", "orospu", "paska*", "perse", "picka", "pierdol*", "pillu*", "pimmel", "piss*", "pizda", "poontsee", "poop", "porn", "p0rn", "pr0n", "preteen", "pula", "pule", "puta", "puto", "qahbeh", "queef*", "rautenberg", "schaffer", "scheiss*", "schlampe", "schmuck", "screw", "sh!t*", "sharmuta", "sharmute", "shipal", "shiz", "skribz", "skurwysyn", "sphencter", "spic", "spierdalaj", "splooge", "suka", "b00b*", "testicle*", "titt*", "twat", "vittu", "wank*", "wetback*", "wichser", "wop*", "yed", "zabourah"]
    };
    /***/
  },
  /***/
  "./node_modules/badwords-list/lib/array.js":
  /*!*************************************************!*\
  !*** ./node_modules/badwords-list/lib/array.js ***!
  \*************************************************/
  /*! no static exports found */
  /***/
  function (p776, p777) {
    p776.exports = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"];
    /***/
  },
  /***/
  "./node_modules/badwords-list/lib/index.js":
  /*!*************************************************!*\
  !*** ./node_modules/badwords-list/lib/index.js ***!
  \*************************************************/
  /*! no static exports found */
  /***/
  function (p778, p779, p780) {
    p778.exports = {
      object: p780(/*! ./object */
      "./node_modules/badwords-list/lib/object.js"),
      array: p780(/*! ./array */
      "./node_modules/badwords-list/lib/array.js"),
      regex: p780(/*! ./regexp */
      "./node_modules/badwords-list/lib/regexp.js")
    };
    /***/
  },
  /***/
  "./node_modules/badwords-list/lib/object.js":
  /*!**************************************************!*\
  !*** ./node_modules/badwords-list/lib/object.js ***!
  \**************************************************/
  /*! no static exports found */
  /***/
  function (p781, p782) {
    p781.exports = {
      "4r5e": 1,
      "5h1t": 1,
      "5hit": 1,
      a55: 1,
      anal: 1,
      anus: 1,
      ar5e: 1,
      arrse: 1,
      arse: 1,
      ass: 1,
      "ass-fucker": 1,
      asses: 1,
      assfucker: 1,
      assfukka: 1,
      asshole: 1,
      assholes: 1,
      asswhole: 1,
      a_s_s: 1,
      "b!tch": 1,
      b00bs: 1,
      b17ch: 1,
      b1tch: 1,
      ballbag: 1,
      balls: 1,
      ballsack: 1,
      bastard: 1,
      beastial: 1,
      beastiality: 1,
      bellend: 1,
      bestial: 1,
      bestiality: 1,
      "bi+ch": 1,
      biatch: 1,
      bitch: 1,
      bitcher: 1,
      bitchers: 1,
      bitches: 1,
      bitchin: 1,
      bitching: 1,
      bloody: 1,
      "blow job": 1,
      blowjob: 1,
      blowjobs: 1,
      boiolas: 1,
      bollock: 1,
      bollok: 1,
      boner: 1,
      boob: 1,
      boobs: 1,
      booobs: 1,
      boooobs: 1,
      booooobs: 1,
      booooooobs: 1,
      breasts: 1,
      buceta: 1,
      bugger: 1,
      bum: 1,
      "bunny fucker": 1,
      butt: 1,
      butthole: 1,
      buttmuch: 1,
      buttplug: 1,
      c0ck: 1,
      c0cksucker: 1,
      "carpet muncher": 1,
      cawk: 1,
      chink: 1,
      cipa: 1,
      cl1t: 1,
      clit: 1,
      clitoris: 1,
      clits: 1,
      cnut: 1,
      cock: 1,
      "cock-sucker": 1,
      cockface: 1,
      cockhead: 1,
      cockmunch: 1,
      cockmuncher: 1,
      cocks: 1,
      cocksuck: 1,
      cocksucked: 1,
      cocksucker: 1,
      cocksucking: 1,
      cocksucks: 1,
      cocksuka: 1,
      cocksukka: 1,
      cok: 1,
      cokmuncher: 1,
      coksucka: 1,
      coon: 1,
      cox: 1,
      crap: 1,
      cum: 1,
      cummer: 1,
      cumming: 1,
      cums: 1,
      cumshot: 1,
      cunilingus: 1,
      cunillingus: 1,
      cunnilingus: 1,
      cunt: 1,
      cuntlick: 1,
      cuntlicker: 1,
      cuntlicking: 1,
      cunts: 1,
      cyalis: 1,
      cyberfuc: 1,
      cyberfuck: 1,
      cyberfucked: 1,
      cyberfucker: 1,
      cyberfuckers: 1,
      cyberfucking: 1,
      d1ck: 1,
      damn: 1,
      dick: 1,
      dickhead: 1,
      dildo: 1,
      dildos: 1,
      dink: 1,
      dinks: 1,
      dirsa: 1,
      dlck: 1,
      "dog-fucker": 1,
      doggin: 1,
      dogging: 1,
      donkeyribber: 1,
      doosh: 1,
      duche: 1,
      dyke: 1,
      ejaculate: 1,
      ejaculated: 1,
      ejaculates: 1,
      ejaculating: 1,
      ejaculatings: 1,
      ejaculation: 1,
      ejakulate: 1,
      "f u c k": 1,
      "f u c k e r": 1,
      f4nny: 1,
      fag: 1,
      fagging: 1,
      faggitt: 1,
      faggot: 1,
      faggs: 1,
      fagot: 1,
      fagots: 1,
      fags: 1,
      fanny: 1,
      fannyflaps: 1,
      fannyfucker: 1,
      fanyy: 1,
      fatass: 1,
      fcuk: 1,
      fcuker: 1,
      fcuking: 1,
      feck: 1,
      fecker: 1,
      felching: 1,
      fellate: 1,
      fellatio: 1,
      fingerfuck: 1,
      fingerfucked: 1,
      fingerfucker: 1,
      fingerfuckers: 1,
      fingerfucking: 1,
      fingerfucks: 1,
      fistfuck: 1,
      fistfucked: 1,
      fistfucker: 1,
      fistfuckers: 1,
      fistfucking: 1,
      fistfuckings: 1,
      fistfucks: 1,
      flange: 1,
      fook: 1,
      fooker: 1,
      fuck: 1,
      fucka: 1,
      fucked: 1,
      fucker: 1,
      fuckers: 1,
      fuckhead: 1,
      fuckheads: 1,
      fuckin: 1,
      fucking: 1,
      fuckings: 1,
      fuckingshitmotherfucker: 1,
      fuckme: 1,
      fucks: 1,
      fuckwhit: 1,
      fuckwit: 1,
      "fudge packer": 1,
      fudgepacker: 1,
      fuk: 1,
      fuker: 1,
      fukker: 1,
      fukkin: 1,
      fuks: 1,
      fukwhit: 1,
      fukwit: 1,
      fux: 1,
      fux0r: 1,
      f_u_c_k: 1,
      gangbang: 1,
      gangbanged: 1,
      gangbangs: 1,
      gaylord: 1,
      gaysex: 1,
      goatse: 1,
      God: 1,
      "god-dam": 1,
      "god-damned": 1,
      goddamn: 1,
      goddamned: 1,
      hardcoresex: 1,
      hell: 1,
      heshe: 1,
      hoar: 1,
      hoare: 1,
      hoer: 1,
      homo: 1,
      hore: 1,
      horniest: 1,
      horny: 1,
      hotsex: 1,
      "jack-off": 1,
      jackoff: 1,
      jap: 1,
      "jerk-off": 1,
      jism: 1,
      jiz: 1,
      jizm: 1,
      jizz: 1,
      kawk: 1,
      knob: 1,
      knobead: 1,
      knobed: 1,
      knobend: 1,
      knobhead: 1,
      knobjocky: 1,
      knobjokey: 1,
      kock: 1,
      kondum: 1,
      kondums: 1,
      kum: 1,
      kummer: 1,
      kumming: 1,
      kums: 1,
      kunilingus: 1,
      "l3i+ch": 1,
      l3itch: 1,
      labia: 1,
      lust: 1,
      lusting: 1,
      m0f0: 1,
      m0fo: 1,
      m45terbate: 1,
      ma5terb8: 1,
      ma5terbate: 1,
      masochist: 1,
      "master-bate": 1,
      masterb8: 1,
      "masterbat*": 1,
      masterbat3: 1,
      masterbate: 1,
      masterbation: 1,
      masterbations: 1,
      masturbate: 1,
      "mo-fo": 1,
      mof0: 1,
      mofo: 1,
      mothafuck: 1,
      mothafucka: 1,
      mothafuckas: 1,
      mothafuckaz: 1,
      mothafucked: 1,
      mothafucker: 1,
      mothafuckers: 1,
      mothafuckin: 1,
      mothafucking: 1,
      mothafuckings: 1,
      mothafucks: 1,
      "mother fucker": 1,
      motherfuck: 1,
      motherfucked: 1,
      motherfucker: 1,
      motherfuckers: 1,
      motherfuckin: 1,
      motherfucking: 1,
      motherfuckings: 1,
      motherfuckka: 1,
      motherfucks: 1,
      muff: 1,
      mutha: 1,
      muthafecker: 1,
      muthafuckker: 1,
      muther: 1,
      mutherfucker: 1,
      n1gga: 1,
      n1gger: 1,
      nazi: 1,
      nigg3r: 1,
      nigg4h: 1,
      nigga: 1,
      niggah: 1,
      niggas: 1,
      niggaz: 1,
      nigger: 1,
      niggers: 1,
      nob: 1,
      "nob jokey": 1,
      nobhead: 1,
      nobjocky: 1,
      nobjokey: 1,
      numbnuts: 1,
      nutsack: 1,
      orgasim: 1,
      orgasims: 1,
      orgasm: 1,
      orgasms: 1,
      p0rn: 1,
      pawn: 1,
      pecker: 1,
      penis: 1,
      penisfucker: 1,
      phonesex: 1,
      phuck: 1,
      phuk: 1,
      phuked: 1,
      phuking: 1,
      phukked: 1,
      phukking: 1,
      phuks: 1,
      phuq: 1,
      pigfucker: 1,
      pimpis: 1,
      piss: 1,
      pissed: 1,
      pisser: 1,
      pissers: 1,
      pisses: 1,
      pissflaps: 1,
      pissin: 1,
      pissing: 1,
      pissoff: 1,
      poop: 1,
      porn: 1,
      porno: 1,
      pornography: 1,
      pornos: 1,
      prick: 1,
      pricks: 1,
      pron: 1,
      pube: 1,
      pusse: 1,
      pussi: 1,
      pussies: 1,
      pussy: 1,
      pussys: 1,
      rectum: 1,
      retard: 1,
      rimjaw: 1,
      rimming: 1,
      "s hit": 1,
      "s.o.b.": 1,
      sadist: 1,
      schlong: 1,
      screwing: 1,
      scroat: 1,
      scrote: 1,
      scrotum: 1,
      semen: 1,
      sex: 1,
      "sh!+": 1,
      "sh!t": 1,
      sh1t: 1,
      shag: 1,
      shagger: 1,
      shaggin: 1,
      shagging: 1,
      shemale: 1,
      "shi+": 1,
      shit: 1,
      shitdick: 1,
      shite: 1,
      shited: 1,
      shitey: 1,
      shitfuck: 1,
      shitfull: 1,
      shithead: 1,
      shiting: 1,
      shitings: 1,
      shits: 1,
      shitted: 1,
      shitter: 1,
      shitters: 1,
      shitting: 1,
      shittings: 1,
      shitty: 1,
      skank: 1,
      slut: 1,
      sluts: 1,
      smegma: 1,
      smut: 1,
      snatch: 1,
      "son-of-a-bitch": 1,
      spac: 1,
      spunk: 1,
      s_h_i_t: 1,
      t1tt1e5: 1,
      t1tties: 1,
      teets: 1,
      teez: 1,
      testical: 1,
      testicle: 1,
      tit: 1,
      titfuck: 1,
      tits: 1,
      titt: 1,
      tittie5: 1,
      tittiefucker: 1,
      titties: 1,
      tittyfuck: 1,
      tittywank: 1,
      titwank: 1,
      tosser: 1,
      turd: 1,
      tw4t: 1,
      twat: 1,
      twathead: 1,
      twatty: 1,
      twunt: 1,
      twunter: 1,
      v14gra: 1,
      v1gra: 1,
      vagina: 1,
      viagra: 1,
      vulva: 1,
      w00se: 1,
      wang: 1,
      wank: 1,
      wanker: 1,
      wanky: 1,
      whoar: 1,
      whore: 1,
      willies: 1,
      willy: 1,
      xrated: 1,
      xxx: 1
    };
    /***/
  },
  /***/
  "./node_modules/badwords-list/lib/regexp.js":
  /*!**************************************************!*\
  !*** ./node_modules/badwords-list/lib/regexp.js ***!
  \**************************************************/
  /*! no static exports found */
  /***/
  function (p783, p784) {
    p783.exports = /\b(4r5e|5h1t|5hit|a55|anal|anus|ar5e|arrse|arse|ass|ass-fucker|asses|assfucker|assfukka|asshole|assholes|asswhole|a_s_s|b!tch|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bastard|beastial|beastiality|bellend|bestial|bestiality|bi\+ch|biatch|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttplug|c0ck|c0cksucker|carpet muncher|cawk|chink|cipa|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|damn|dick|dickhead|dildo|dildos|dink|dinks|dirsa|dlck|dog-fucker|doggin|dogging|donkeyribber|doosh|duche|dyke|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|f u c k|f u c k e r|f4nny|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fanny|fannyflaps|fannyfucker|fanyy|fatass|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|flange|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|God|god-dam|god-damned|goddamn|goddamned|hardcoresex|hell|heshe|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jap|jerk-off|jism|jiz|jizm|jizz|kawk|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3i\+ch|l3itch|labia|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|masochist|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|mo-fo|mof0|mofo|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muff|mutha|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pawn|pecker|penis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|poop|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|rectum|retard|rimjaw|rimming|s hit|s.o.b.|sadist|schlong|screwing|scroat|scrote|scrotum|semen|sex|sh!\+|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shi\+|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|smegma|smut|snatch|son-of-a-bitch|spac|spunk|s_h_i_t|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|vagina|viagra|vulva|w00se|wang|wank|wanker|wanky|whoar|whore|willies|willy|xrated|xxx)\b/gi;
    /***/
  },
  /***/
  "./node_modules/base64-js/index.js":
  /*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
  /*! no static exports found */
  /***/
  function (p785, p786, p787) {
    "use strict";

    p786.byteLength = f265;
    p786.toByteArray = f267;
    p786.fromByteArray = f270;
    var vA16 = [];
    var vA17 = [];
    var v430 = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var vLSABCDEFGHIJKLMNOPQRST3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (var vLN050 = 0, v431 = vLSABCDEFGHIJKLMNOPQRST3.length; vLN050 < v431; ++vLN050) {
      vA16[vLN050] = vLSABCDEFGHIJKLMNOPQRST3[vLN050];
      vA17[vLSABCDEFGHIJKLMNOPQRST3.charCodeAt(vLN050)] = vLN050;
    }
    // Support decoding URL-safe base64 strings, as Node.js does.
    // See: https://en.wikipedia.org/wiki/Base64#URL_applications
    vA17["-".charCodeAt(0)] = 62;
    vA17["_".charCodeAt(0)] = 63;
    function f264(p788) {
      var v432 = p788.length;
      if (v432 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      // Trim off extra bytes after placeholder bytes are found
      // See: https://github.com/beatgammit/base64-js/issues/42
      var v433 = p788.indexOf("=");
      if (v433 === -1) {
        v433 = v432;
      }
      var v434 = v433 === v432 ? 0 : 4 - v433 % 4;
      return [v433, v434];
    }
    // base64 is 4/3 + up to two characters of the original data
    function f265(p789) {
      var vF264 = f264(p789);
      var v435 = vF264[0];
      var v436 = vF264[1];
      return (v435 + v436) * 3 / 4 - v436;
    }
    function f266(p790, p791, p792) {
      return (p791 + p792) * 3 / 4 - p792;
    }
    function f267(p793) {
      var v437;
      var vF2642 = f264(p793);
      var v438 = vF2642[0];
      var v439 = vF2642[1];
      var v440 = new v430(f266(p793, v438, v439));
      var vLN051 = 0;
      // if there are placeholders, only get up to the last complete 4 chars
      var v441 = v439 > 0 ? v438 - 4 : v438;
      var v442;
      for (v442 = 0; v442 < v441; v442 += 4) {
        v437 = vA17[p793.charCodeAt(v442)] << 18 | vA17[p793.charCodeAt(v442 + 1)] << 12 | vA17[p793.charCodeAt(v442 + 2)] << 6 | vA17[p793.charCodeAt(v442 + 3)];
        v440[vLN051++] = v437 >> 16 & 255;
        v440[vLN051++] = v437 >> 8 & 255;
        v440[vLN051++] = v437 & 255;
      }
      if (v439 === 2) {
        v437 = vA17[p793.charCodeAt(v442)] << 2 | vA17[p793.charCodeAt(v442 + 1)] >> 4;
        v440[vLN051++] = v437 & 255;
      }
      if (v439 === 1) {
        v437 = vA17[p793.charCodeAt(v442)] << 10 | vA17[p793.charCodeAt(v442 + 1)] << 4 | vA17[p793.charCodeAt(v442 + 2)] >> 2;
        v440[vLN051++] = v437 >> 8 & 255;
        v440[vLN051++] = v437 & 255;
      }
      return v440;
    }
    function f268(p794) {
      return vA16[p794 >> 18 & 63] + vA16[p794 >> 12 & 63] + vA16[p794 >> 6 & 63] + vA16[p794 & 63];
    }
    function f269(p795, p796, p797) {
      var v443;
      var vA18 = [];
      for (var vP796 = p796; vP796 < p797; vP796 += 3) {
        v443 = (p795[vP796] << 16 & 16711680) + (p795[vP796 + 1] << 8 & 65280) + (p795[vP796 + 2] & 255);
        vA18.push(f268(v443));
      }
      return vA18.join("");
    }
    function f270(p798) {
      var v444;
      var v445 = p798.length;
      var v446 = v445 % 3;
      // if we have 1 byte left, pad 2 bytes
      var vA19 = [];
      var vLN163832 = 16383;
      // must be multiple of 3
      // go through the array every three bytes, we'll deal with trailing stuff later
      for (var vLN052 = 0, v447 = v445 - v446; vLN052 < v447; vLN052 += vLN163832) {
        vA19.push(f269(p798, vLN052, vLN052 + vLN163832 > v447 ? v447 : vLN052 + vLN163832));
      }
      // pad the end with zeros, but make sure to not forget the extra bytes
      if (v446 === 1) {
        v444 = p798[v445 - 1];
        vA19.push(vA16[v444 >> 2] + vA16[v444 << 4 & 63] + "==");
      } else if (v446 === 2) {
        v444 = (p798[v445 - 2] << 8) + p798[v445 - 1];
        vA19.push(vA16[v444 >> 10] + vA16[v444 >> 4 & 63] + vA16[v444 << 2 & 63] + "=");
      }
      return vA19.join("");
    }
    /***/
  },
  /***/
  "./node_modules/buffer/index.js":
  /*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
  /*! no static exports found */
  /***/
  function (p799, p800, p801) {
    "use strict";

    /* WEBPACK VAR INJECTION */
    (function (p802) {
      /*!
           * The buffer module from node.js, for the browser.
           *
           * @author   Feross Aboukhadijeh <http://feross.org>
           * @license  MIT
           */
      /* eslint-disable no-proto */
      var vP801 = p801(/*! base64-js */
      "./node_modules/base64-js/index.js");
      var vP8012 = p801(/*! ieee754 */
      "./node_modules/ieee754/index.js");
      var vP8013 = p801(/*! isarray */
      "./node_modules/buffer/node_modules/isarray/index.js");
      p800.Buffer = f274;
      p800.SlowBuffer = f284;
      p800.INSPECT_MAX_BYTES = 50;
      /**
      * If `Buffer.TYPED_ARRAY_SUPPORT`:
      *   === true    Use Uint8Array implementation (fastest)
      *   === false   Use Object implementation (most compatible, even IE6)
      *
      * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
      * Opera 11.6+, iOS 4.2+.
      *
      * Due to various browser bugs, sometimes the Object implementation will be used even
      * when the browser supports typed arrays.
      *
      * Note:
      *
      *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
      *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
      *
      *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
      *
      *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
      *     incorrect length in some situations.
      * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
      * get the Object implementation, which is slower but behaves correctly.
      */
      f274.TYPED_ARRAY_SUPPORT = p802.TYPED_ARRAY_SUPPORT !== undefined ? p802.TYPED_ARRAY_SUPPORT : f271();
      /*
           * Export kMaxLength after typed array support is determined.
           */
      p800.kMaxLength = f272();
      function f271() {
        try {
          var v448 = new Uint8Array(1);
          v448.__proto__ = {
            __proto__: Uint8Array.prototype,
            foo: function () {
              return 42;
            }
          };
          return v448.foo() === 42 &&
          // typed array instances can be augmented
          typeof v448.subarray === "function" &&
          // chrome 9-10 lack `subarray`
          v448.subarray(1, 1).byteLength === 0;
          // ie10 has broken `subarray`
        } catch (e4) {
          return false;
        }
      }
      function f272() {
        if (f274.TYPED_ARRAY_SUPPORT) {
          return 2147483647;
        } else {
          return 1073741823;
        }
      }
      function f273(p803, p804) {
        if (f272() < p804) {
          throw new RangeError("Invalid typed array length");
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          // Return an augmented `Uint8Array` instance, for best performance
          p803 = new Uint8Array(p804);
          p803.__proto__ = f274.prototype;
        } else {
          // Fallback: Return an object instance of the Buffer class
          if (p803 === null) {
            p803 = new f274(p804);
          }
          p803.length = p804;
        }
        return p803;
      }
      /**
           * The Buffer constructor returns instances of `Uint8Array` that have their
           * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
           * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
           * and the `Uint8Array` methods. Square bracket notation works as expected -- it
           * returns a single octet.
           *
           * The `Uint8Array` prototype remains unmodified.
           */
      function f274(p805, p806, p807) {
        if (!f274.TYPED_ARRAY_SUPPORT && !(this instanceof f274)) {
          return new f274(p805, p806, p807);
        }
        // Common case.
        if (typeof p805 === "number") {
          if (typeof p806 === "string") {
            throw new Error("If encoding is specified then the first argument must be a string");
          }
          return f278(this, p805);
        }
        return f275(this, p805, p806, p807);
      }
      f274.poolSize = 8192;
      // not used by this implementation
      // TODO: Legacy, not needed anymore. Remove in next major version.
      f274._augment = function (p808) {
        p808.__proto__ = f274.prototype;
        return p808;
      };
      function f275(p809, p810, p811, p812) {
        if (typeof p810 === "number") {
          throw new TypeError("\"value\" argument must not be a number");
        }
        if (typeof ArrayBuffer !== "undefined" && p810 instanceof ArrayBuffer) {
          return f281(p809, p810, p811, p812);
        }
        if (typeof p810 === "string") {
          return f279(p809, p810, p811);
        }
        return f282(p809, p810);
      }
      /**
           * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
           * if value is a number.
           * Buffer.from(str[, encoding])
           * Buffer.from(array)
           * Buffer.from(buffer)
           * Buffer.from(arrayBuffer[, byteOffset[, length]])
           **/
      f274.from = function (p813, p814, p815) {
        return f275(null, p813, p814, p815);
      };
      if (f274.TYPED_ARRAY_SUPPORT) {
        f274.prototype.__proto__ = Uint8Array.prototype;
        f274.__proto__ = Uint8Array;
        if (typeof Symbol !== "undefined" && Symbol.species && f274[Symbol.species] === f274) {
          // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
          Object.defineProperty(f274, Symbol.species, {
            value: null,
            configurable: true
          });
        }
      }
      function f276(p816) {
        if (typeof p816 !== "number") {
          throw new TypeError("\"size\" argument must be a number");
        } else if (p816 < 0) {
          throw new RangeError("\"size\" argument must not be negative");
        }
      }
      function f277(p817, p818, p819, p820) {
        f276(p818);
        if (p818 <= 0) {
          return f273(p817, p818);
        }
        if (p819 !== undefined) {
          // Only pay attention to encoding if it's a string. This
          // prevents accidentally sending in a number that would
          // be interpretted as a start offset.
          if (typeof p820 === "string") {
            return f273(p817, p818).fill(p819, p820);
          } else {
            return f273(p817, p818).fill(p819);
          }
        }
        return f273(p817, p818);
      }
      /**
           * Creates a new filled Buffer instance.
           * alloc(size[, fill[, encoding]])
           **/
      f274.alloc = function (p821, p822, p823) {
        return f277(null, p821, p822, p823);
      };
      function f278(p824, p825) {
        f276(p825);
        p824 = f273(p824, p825 < 0 ? 0 : f283(p825) | 0);
        if (!f274.TYPED_ARRAY_SUPPORT) {
          for (var vLN053 = 0; vLN053 < p825; ++vLN053) {
            p824[vLN053] = 0;
          }
        }
        return p824;
      }
      /**
           * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
           * */
      f274.allocUnsafe = function (p826) {
        return f278(null, p826);
      };
      /**
           * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
           */
      f274.allocUnsafeSlow = function (p827) {
        return f278(null, p827);
      };
      function f279(p828, p829, p830) {
        if (typeof p830 !== "string" || p830 === "") {
          p830 = "utf8";
        }
        if (!f274.isEncoding(p830)) {
          throw new TypeError("\"encoding\" must be a valid string encoding");
        }
        var v449 = f289(p829, p830) | 0;
        p828 = f273(p828, v449);
        var v450 = p828.write(p829, p830);
        if (v450 !== v449) {
          // Writing a hex string, for example, that contains invalid characters will
          // cause everything after the first invalid character to be ignored. (e.g.
          // 'abxxcd' will be treated as 'ab')
          p828 = p828.slice(0, v450);
        }
        return p828;
      }
      function f280(p831, p832) {
        var v451 = p832.length < 0 ? 0 : f283(p832.length) | 0;
        p831 = f273(p831, v451);
        for (var vLN054 = 0; vLN054 < v451; vLN054 += 1) {
          p831[vLN054] = p832[vLN054] & 255;
        }
        return p831;
      }
      function f281(p833, p834, p835, p836) {
        p834.byteLength;
        // this throws if `array` is not a valid ArrayBuffer
        if (p835 < 0 || p834.byteLength < p835) {
          throw new RangeError("'offset' is out of bounds");
        }
        if (p834.byteLength < p835 + (p836 || 0)) {
          throw new RangeError("'length' is out of bounds");
        }
        if (p835 === undefined && p836 === undefined) {
          p834 = new Uint8Array(p834);
        } else if (p836 === undefined) {
          p834 = new Uint8Array(p834, p835);
        } else {
          p834 = new Uint8Array(p834, p835, p836);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          // Return an augmented `Uint8Array` instance, for best performance
          p833 = p834;
          p833.__proto__ = f274.prototype;
        } else {
          // Fallback: Return an object instance of the Buffer class
          p833 = f280(p833, p834);
        }
        return p833;
      }
      function f282(p837, p838) {
        if (f274.isBuffer(p838)) {
          var v452 = f283(p838.length) | 0;
          p837 = f273(p837, v452);
          if (p837.length === 0) {
            return p837;
          }
          p838.copy(p837, 0, 0, v452);
          return p837;
        }
        if (p838) {
          if (typeof ArrayBuffer !== "undefined" && p838.buffer instanceof ArrayBuffer || "length" in p838) {
            if (typeof p838.length !== "number" || f374(p838.length)) {
              return f273(p837, 0);
            }
            return f280(p837, p838);
          }
          if (p838.type === "Buffer" && vP8013(p838.data)) {
            return f280(p837, p838.data);
          }
        }
        throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
      }
      function f283(p839) {
        // Note: cannot use `length < kMaxLength()` here because that fails when
        // length is NaN (which is otherwise coerced to zero.)
        if (p839 >= f272()) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + f272().toString(16) + " bytes");
        }
        return p839 | 0;
      }
      function f284(p840) {
        if (+p840 != p840) {
          // eslint-disable-line eqeqeq
          p840 = 0;
        }
        return f274.alloc(+p840);
      }
      f274.isBuffer = function f285(p841) {
        return p841 != null && !!p841._isBuffer;
      };
      f274.compare = function f286(p842, p843) {
        if (!f274.isBuffer(p842) || !f274.isBuffer(p843)) {
          throw new TypeError("Arguments must be Buffers");
        }
        if (p842 === p843) {
          return 0;
        }
        var v453 = p842.length;
        var v454 = p843.length;
        for (var vLN055 = 0, v455 = Math.min(v453, v454); vLN055 < v455; ++vLN055) {
          if (p842[vLN055] !== p843[vLN055]) {
            v453 = p842[vLN055];
            v454 = p843[vLN055];
            break;
          }
        }
        if (v453 < v454) {
          return -1;
        }
        if (v454 < v453) {
          return 1;
        }
        return 0;
      };
      f274.isEncoding = function f287(p844) {
        switch (String(p844).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      f274.concat = function f288(p845, p846) {
        if (!vP8013(p845)) {
          throw new TypeError("\"list\" argument must be an Array of Buffers");
        }
        if (p845.length === 0) {
          return f274.alloc(0);
        }
        var v456;
        if (p846 === undefined) {
          p846 = 0;
          for (v456 = 0; v456 < p845.length; ++v456) {
            p846 += p845[v456].length;
          }
        }
        var v457 = f274.allocUnsafe(p846);
        var vLN056 = 0;
        for (v456 = 0; v456 < p845.length; ++v456) {
          var v458 = p845[v456];
          if (!f274.isBuffer(v458)) {
            throw new TypeError("\"list\" argument must be an Array of Buffers");
          }
          v458.copy(v457, vLN056);
          vLN056 += v458.length;
        }
        return v457;
      };
      function f289(p847, p848) {
        if (f274.isBuffer(p847)) {
          return p847.length;
        }
        if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && (ArrayBuffer.isView(p847) || p847 instanceof ArrayBuffer)) {
          return p847.byteLength;
        }
        if (typeof p847 !== "string") {
          p847 = "" + p847;
        }
        var v459 = p847.length;
        if (v459 === 0) {
          return 0;
        }
        // Use a for loop to avoid recursion
        var v460 = false;
        while (true) {
          switch (p848) {
            case "ascii":
            case "latin1":
            case "binary":
              return v459;
            case "utf8":
            case "utf-8":
            case undefined:
              return f369(p847).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return v459 * 2;
            case "hex":
              return v459 >>> 1;
            case "base64":
              return f372(p847).length;
            default:
              if (v460) {
                return f369(p847).length;
              }
              // assume utf8
              p848 = ("" + p848).toLowerCase();
              v460 = true;
          }
        }
      }
      f274.byteLength = f289;
      function f290(p849, p850, p851) {
        var v461 = false;
        // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
        // property of a typed array.
        // This behaves neither like String nor Uint8Array in that we set start/end
        // to their upper/lower bounds if the value passed is out of range.
        // undefined is handled specially as per ECMA-262 6th Edition,
        // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
        if (p850 === undefined || p850 < 0) {
          p850 = 0;
        }
        // Return early if start > this.length. Done here to prevent potential uint32
        // coercion fail below.
        if (p850 > this.length) {
          return "";
        }
        if (p851 === undefined || p851 > this.length) {
          p851 = this.length;
        }
        if (p851 <= 0) {
          return "";
        }
        // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
        p851 >>>= 0;
        p850 >>>= 0;
        if (p851 <= p850) {
          return "";
        }
        if (!p849) {
          p849 = "utf8";
        }
        while (true) {
          switch (p849) {
            case "hex":
              return f318(this, p850, p851);
            case "utf8":
            case "utf-8":
              return f314(this, p850, p851);
            case "ascii":
              return f316(this, p850, p851);
            case "latin1":
            case "binary":
              return f317(this, p850, p851);
            case "base64":
              return f313(this, p850, p851);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return f319(this, p850, p851);
            default:
              if (v461) {
                throw new TypeError("Unknown encoding: " + p849);
              }
              p849 = (p849 + "").toLowerCase();
              v461 = true;
          }
        }
      }
      // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
      // Buffer instances.
      f274.prototype._isBuffer = true;
      function f291(p852, p853, p854) {
        var v462 = p852[p853];
        p852[p853] = p852[p854];
        p852[p854] = v462;
      }
      f274.prototype.swap16 = function f292() {
        var v463 = this.length;
        if (v463 % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (var vLN057 = 0; vLN057 < v463; vLN057 += 2) {
          f291(this, vLN057, vLN057 + 1);
        }
        return this;
      };
      f274.prototype.swap32 = function f293() {
        var v464 = this.length;
        if (v464 % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (var vLN058 = 0; vLN058 < v464; vLN058 += 4) {
          f291(this, vLN058, vLN058 + 3);
          f291(this, vLN058 + 1, vLN058 + 2);
        }
        return this;
      };
      f274.prototype.swap64 = function f294() {
        var v465 = this.length;
        if (v465 % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (var vLN059 = 0; vLN059 < v465; vLN059 += 8) {
          f291(this, vLN059, vLN059 + 7);
          f291(this, vLN059 + 1, vLN059 + 6);
          f291(this, vLN059 + 2, vLN059 + 5);
          f291(this, vLN059 + 3, vLN059 + 4);
        }
        return this;
      };
      f274.prototype.toString = function f295() {
        var v466 = this.length | 0;
        if (v466 === 0) {
          return "";
        }
        if (arguments.length === 0) {
          return f314(this, 0, v466);
        }
        return f290.apply(this, arguments);
      };
      f274.prototype.equals = function f296(p855) {
        if (!f274.isBuffer(p855)) {
          throw new TypeError("Argument must be a Buffer");
        }
        if (this === p855) {
          return true;
        }
        return f274.compare(this, p855) === 0;
      };
      f274.prototype.inspect = function f297() {
        var vLS11 = "";
        var v467 = p800.INSPECT_MAX_BYTES;
        if (this.length > 0) {
          vLS11 = this.toString("hex", 0, v467).match(/.{2}/g).join(" ");
          if (this.length > v467) {
            vLS11 += " ... ";
          }
        }
        return "<Buffer " + vLS11 + ">";
      };
      f274.prototype.compare = function f298(p856, p857, p858, p859, p860) {
        if (!f274.isBuffer(p856)) {
          throw new TypeError("Argument must be a Buffer");
        }
        if (p857 === undefined) {
          p857 = 0;
        }
        if (p858 === undefined) {
          p858 = p856 ? p856.length : 0;
        }
        if (p859 === undefined) {
          p859 = 0;
        }
        if (p860 === undefined) {
          p860 = this.length;
        }
        if (p857 < 0 || p858 > p856.length || p859 < 0 || p860 > this.length) {
          throw new RangeError("out of range index");
        }
        if (p859 >= p860 && p857 >= p858) {
          return 0;
        }
        if (p859 >= p860) {
          return -1;
        }
        if (p857 >= p858) {
          return 1;
        }
        p857 >>>= 0;
        p858 >>>= 0;
        p859 >>>= 0;
        p860 >>>= 0;
        if (this === p856) {
          return 0;
        }
        var v468 = p860 - p859;
        var v469 = p858 - p857;
        var v470 = Math.min(v468, v469);
        var v471 = this.slice(p859, p860);
        var v472 = p856.slice(p857, p858);
        for (var vLN060 = 0; vLN060 < v470; ++vLN060) {
          if (v471[vLN060] !== v472[vLN060]) {
            v468 = v471[vLN060];
            v469 = v472[vLN060];
            break;
          }
        }
        if (v468 < v469) {
          return -1;
        }
        if (v469 < v468) {
          return 1;
        }
        return 0;
      };
      // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
      // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
      //
      // Arguments:
      // - buffer - a Buffer to search
      // - val - a string, Buffer, or number
      // - byteOffset - an index into `buffer`; will be clamped to an int32
      // - encoding - an optional encoding, relevant is val is a string
      // - dir - true for indexOf, false for lastIndexOf
      function f299(p861, p862, p863, p864, p865) {
        // Empty buffer means no match
        if (p861.length === 0) {
          return -1;
        }
        // Normalize byteOffset
        if (typeof p863 === "string") {
          p864 = p863;
          p863 = 0;
        } else if (p863 > 2147483647) {
          p863 = 2147483647;
        } else if (p863 < -2147483648) {
          p863 = -2147483648;
        }
        p863 = +p863;
        // Coerce to Number.
        if (isNaN(p863)) {
          // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
          p863 = p865 ? 0 : p861.length - 1;
        }
        // Normalize byteOffset: negative offsets start from the end of the buffer
        if (p863 < 0) {
          p863 = p861.length + p863;
        }
        if (p863 >= p861.length) {
          if (p865) {
            return -1;
          } else {
            p863 = p861.length - 1;
          }
        } else if (p863 < 0) {
          if (p865) {
            p863 = 0;
          } else {
            return -1;
          }
        }
        // Normalize val
        if (typeof p862 === "string") {
          p862 = f274.from(p862, p864);
        }
        // Finally, search either indexOf (if dir is true) or lastIndexOf
        if (f274.isBuffer(p862)) {
          // Special case: looking for empty string/buffer always fails
          if (p862.length === 0) {
            return -1;
          }
          return f300(p861, p862, p863, p864, p865);
        } else if (typeof p862 === "number") {
          p862 = p862 & 255;
          // Search for a byte value [0-255]
          if (f274.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === "function") {
            if (p865) {
              return Uint8Array.prototype.indexOf.call(p861, p862, p863);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(p861, p862, p863);
            }
          }
          return f300(p861, [p862], p863, p864, p865);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function f300(p866, p867, p868, p869, p870) {
        var vLN111 = 1;
        var v473 = p866.length;
        var v474 = p867.length;
        if (p869 !== undefined) {
          p869 = String(p869).toLowerCase();
          if (p869 === "ucs2" || p869 === "ucs-2" || p869 === "utf16le" || p869 === "utf-16le") {
            if (p866.length < 2 || p867.length < 2) {
              return -1;
            }
            vLN111 = 2;
            v473 /= 2;
            v474 /= 2;
            p868 /= 2;
          }
        }
        function f301(p871, p872) {
          if (vLN111 === 1) {
            return p871[p872];
          } else {
            return p871.readUInt16BE(p872 * vLN111);
          }
        }
        var v475;
        if (p870) {
          var v476 = -1;
          for (v475 = p868; v475 < v473; v475++) {
            if (f301(p866, v475) === f301(p867, v476 === -1 ? 0 : v475 - v476)) {
              if (v476 === -1) {
                v476 = v475;
              }
              if (v475 - v476 + 1 === v474) {
                return v476 * vLN111;
              }
            } else {
              if (v476 !== -1) {
                v475 -= v475 - v476;
              }
              v476 = -1;
            }
          }
        } else {
          if (p868 + v474 > v473) {
            p868 = v473 - v474;
          }
          for (v475 = p868; v475 >= 0; v475--) {
            var v477 = true;
            for (var vLN061 = 0; vLN061 < v474; vLN061++) {
              if (f301(p866, v475 + vLN061) !== f301(p867, vLN061)) {
                v477 = false;
                break;
              }
            }
            if (v477) {
              return v475;
            }
          }
        }
        return -1;
      }
      f274.prototype.includes = function f302(p873, p874, p875) {
        return this.indexOf(p873, p874, p875) !== -1;
      };
      f274.prototype.indexOf = function f303(p876, p877, p878) {
        return f299(this, p876, p877, p878, true);
      };
      f274.prototype.lastIndexOf = function f304(p879, p880, p881) {
        return f299(this, p879, p880, p881, false);
      };
      function f305(p882, p883, p884, p885) {
        p884 = Number(p884) || 0;
        var v478 = p882.length - p884;
        if (!p885) {
          p885 = v478;
        } else {
          p885 = Number(p885);
          if (p885 > v478) {
            p885 = v478;
          }
        }
        // must be an even number of digits
        var v479 = p883.length;
        if (v479 % 2 !== 0) {
          throw new TypeError("Invalid hex string");
        }
        if (p885 > v479 / 2) {
          p885 = v479 / 2;
        }
        for (var vLN062 = 0; vLN062 < p885; ++vLN062) {
          var vParseInt3 = parseInt(p883.substr(vLN062 * 2, 2), 16);
          if (isNaN(vParseInt3)) {
            return vLN062;
          }
          p882[p884 + vLN062] = vParseInt3;
        }
        return vLN062;
      }
      function f306(p886, p887, p888, p889) {
        return f373(f369(p887, p886.length - p888), p886, p888, p889);
      }
      function f307(p890, p891, p892, p893) {
        return f373(f370(p891), p890, p892, p893);
      }
      function f308(p894, p895, p896, p897) {
        return f307(p894, p895, p896, p897);
      }
      function f309(p898, p899, p900, p901) {
        return f373(f372(p899), p898, p900, p901);
      }
      function f310(p902, p903, p904, p905) {
        return f373(f371(p903, p902.length - p904), p902, p904, p905);
      }
      f274.prototype.write = function f311(p906, p907, p908, p909) {
        // Buffer#write(string)
        if (p907 === undefined) {
          p909 = "utf8";
          p908 = this.length;
          p907 = 0;
          // Buffer#write(string, encoding)
        } else if (p908 === undefined && typeof p907 === "string") {
          p909 = p907;
          p908 = this.length;
          p907 = 0;
          // Buffer#write(string, offset[, length][, encoding])
        } else if (isFinite(p907)) {
          p907 = p907 | 0;
          if (isFinite(p908)) {
            p908 = p908 | 0;
            if (p909 === undefined) {
              p909 = "utf8";
            }
          } else {
            p909 = p908;
            p908 = undefined;
          }
          // legacy write(string, encoding, offset, length) - remove in v0.13
        } else {
          throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
        }
        var v480 = this.length - p907;
        if (p908 === undefined || p908 > v480) {
          p908 = v480;
        }
        if (p906.length > 0 && (p908 < 0 || p907 < 0) || p907 > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!p909) {
          p909 = "utf8";
        }
        var v481 = false;
        while (true) {
          switch (p909) {
            case "hex":
              return f305(this, p906, p907, p908);
            case "utf8":
            case "utf-8":
              return f306(this, p906, p907, p908);
            case "ascii":
              return f307(this, p906, p907, p908);
            case "latin1":
            case "binary":
              return f308(this, p906, p907, p908);
            case "base64":
              // Warning: maxLength not taken into account in base64Write
              return f309(this, p906, p907, p908);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return f310(this, p906, p907, p908);
            default:
              if (v481) {
                throw new TypeError("Unknown encoding: " + p909);
              }
              p909 = ("" + p909).toLowerCase();
              v481 = true;
          }
        }
      };
      f274.prototype.toJSON = function f312() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function f313(p910, p911, p912) {
        if (p911 === 0 && p912 === p910.length) {
          return vP801.fromByteArray(p910);
        } else {
          return vP801.fromByteArray(p910.slice(p911, p912));
        }
      }
      function f314(p913, p914, p915) {
        p915 = Math.min(p913.length, p915);
        var vA20 = [];
        var vP914 = p914;
        while (vP914 < p915) {
          var v482 = p913[vP914];
          var v483 = null;
          var v484 = v482 > 239 ? 4 : v482 > 223 ? 3 : v482 > 191 ? 2 : 1;
          if (vP914 + v484 <= p915) {
            var v485;
            var v486;
            var v487;
            var v488;
            switch (v484) {
              case 1:
                if (v482 < 128) {
                  v483 = v482;
                }
                break;
              case 2:
                v485 = p913[vP914 + 1];
                if ((v485 & 192) === 128) {
                  v488 = (v482 & 31) << 6 | v485 & 63;
                  if (v488 > 127) {
                    v483 = v488;
                  }
                }
                break;
              case 3:
                v485 = p913[vP914 + 1];
                v486 = p913[vP914 + 2];
                if ((v485 & 192) === 128 && (v486 & 192) === 128) {
                  v488 = (v482 & 15) << 12 | (v485 & 63) << 6 | v486 & 63;
                  if (v488 > 2047 && (v488 < 55296 || v488 > 57343)) {
                    v483 = v488;
                  }
                }
                break;
              case 4:
                v485 = p913[vP914 + 1];
                v486 = p913[vP914 + 2];
                v487 = p913[vP914 + 3];
                if ((v485 & 192) === 128 && (v486 & 192) === 128 && (v487 & 192) === 128) {
                  v488 = (v482 & 15) << 18 | (v485 & 63) << 12 | (v486 & 63) << 6 | v487 & 63;
                  if (v488 > 65535 && v488 < 1114112) {
                    v483 = v488;
                  }
                }
            }
          }
          if (v483 === null) {
            // we did not generate a valid codePoint so insert a
            // replacement char (U+FFFD) and advance only 1 byte
            v483 = 65533;
            v484 = 1;
          } else if (v483 > 65535) {
            // encode to utf16 (surrogate pair dance)
            v483 -= 65536;
            vA20.push(v483 >>> 10 & 1023 | 55296);
            v483 = v483 & 1023 | 56320;
          }
          vA20.push(v483);
          vP914 += v484;
        }
        return f315(vA20);
      }
      // Based on http://stackoverflow.com/a/22747272/680742, the browser with
      // the lowest limit is Chrome, with 0x10000 args.
      // We go 1 magnitude less, for safety
      var vLN40962 = 4096;
      function f315(p916) {
        var v489 = p916.length;
        if (v489 <= vLN40962) {
          return String.fromCharCode.apply(String, p916);
          // avoid extra slice()
        }
        // Decode in chunks to avoid "call stack size exceeded".
        var vLS12 = "";
        var vLN063 = 0;
        while (vLN063 < v489) {
          vLS12 += String.fromCharCode.apply(String, p916.slice(vLN063, vLN063 += vLN40962));
        }
        return vLS12;
      }
      function f316(p917, p918, p919) {
        var vLS13 = "";
        p919 = Math.min(p917.length, p919);
        for (var vP918 = p918; vP918 < p919; ++vP918) {
          vLS13 += String.fromCharCode(p917[vP918] & 127);
        }
        return vLS13;
      }
      function f317(p920, p921, p922) {
        var vLS14 = "";
        p922 = Math.min(p920.length, p922);
        for (var vP921 = p921; vP921 < p922; ++vP921) {
          vLS14 += String.fromCharCode(p920[vP921]);
        }
        return vLS14;
      }
      function f318(p923, p924, p925) {
        var v490 = p923.length;
        if (!p924 || p924 < 0) {
          p924 = 0;
        }
        if (!p925 || p925 < 0 || p925 > v490) {
          p925 = v490;
        }
        var vLS15 = "";
        for (var vP924 = p924; vP924 < p925; ++vP924) {
          vLS15 += f368(p923[vP924]);
        }
        return vLS15;
      }
      function f319(p926, p927, p928) {
        var v491 = p926.slice(p927, p928);
        var vLS16 = "";
        for (var vLN064 = 0; vLN064 < v491.length; vLN064 += 2) {
          vLS16 += String.fromCharCode(v491[vLN064] + v491[vLN064 + 1] * 256);
        }
        return vLS16;
      }
      f274.prototype.slice = function f320(p929, p930) {
        var v492 = this.length;
        p929 = ~~p929;
        p930 = p930 === undefined ? v492 : ~~p930;
        if (p929 < 0) {
          p929 += v492;
          if (p929 < 0) {
            p929 = 0;
          }
        } else if (p929 > v492) {
          p929 = v492;
        }
        if (p930 < 0) {
          p930 += v492;
          if (p930 < 0) {
            p930 = 0;
          }
        } else if (p930 > v492) {
          p930 = v492;
        }
        if (p930 < p929) {
          p930 = p929;
        }
        var v493;
        if (f274.TYPED_ARRAY_SUPPORT) {
          v493 = this.subarray(p929, p930);
          v493.__proto__ = f274.prototype;
        } else {
          var v494 = p930 - p929;
          v493 = new f274(v494, undefined);
          for (var vLN065 = 0; vLN065 < v494; ++vLN065) {
            v493[vLN065] = this[vLN065 + p929];
          }
        }
        return v493;
      };
      /*
           * Need to make sure that buffer isn't trying to write out of bounds.
           */
      function f321(p931, p932, p933) {
        if (p931 % 1 !== 0 || p931 < 0) {
          throw new RangeError("offset is not uint");
        }
        if (p931 + p932 > p933) {
          throw new RangeError("Trying to access beyond buffer length");
        }
      }
      f274.prototype.readUIntLE = function f322(p934, p935, p936) {
        p934 = p934 | 0;
        p935 = p935 | 0;
        if (!p936) {
          f321(p934, p935, this.length);
        }
        var v495 = this[p934];
        var vLN112 = 1;
        var vLN066 = 0;
        while (++vLN066 < p935 && (vLN112 *= 256)) {
          v495 += this[p934 + vLN066] * vLN112;
        }
        return v495;
      };
      f274.prototype.readUIntBE = function f323(p937, p938, p939) {
        p937 = p937 | 0;
        p938 = p938 | 0;
        if (!p939) {
          f321(p937, p938, this.length);
        }
        var v496 = this[p937 + --p938];
        var vLN113 = 1;
        while (p938 > 0 && (vLN113 *= 256)) {
          v496 += this[p937 + --p938] * vLN113;
        }
        return v496;
      };
      f274.prototype.readUInt8 = function f324(p940, p941) {
        if (!p941) {
          f321(p940, 1, this.length);
        }
        return this[p940];
      };
      f274.prototype.readUInt16LE = function f325(p942, p943) {
        if (!p943) {
          f321(p942, 2, this.length);
        }
        return this[p942] | this[p942 + 1] << 8;
      };
      f274.prototype.readUInt16BE = function f326(p944, p945) {
        if (!p945) {
          f321(p944, 2, this.length);
        }
        return this[p944] << 8 | this[p944 + 1];
      };
      f274.prototype.readUInt32LE = function f327(p946, p947) {
        if (!p947) {
          f321(p946, 4, this.length);
        }
        return (this[p946] | this[p946 + 1] << 8 | this[p946 + 2] << 16) + this[p946 + 3] * 16777216;
      };
      f274.prototype.readUInt32BE = function f328(p948, p949) {
        if (!p949) {
          f321(p948, 4, this.length);
        }
        return this[p948] * 16777216 + (this[p948 + 1] << 16 | this[p948 + 2] << 8 | this[p948 + 3]);
      };
      f274.prototype.readIntLE = function f329(p950, p951, p952) {
        p950 = p950 | 0;
        p951 = p951 | 0;
        if (!p952) {
          f321(p950, p951, this.length);
        }
        var v497 = this[p950];
        var vLN114 = 1;
        var vLN067 = 0;
        while (++vLN067 < p951 && (vLN114 *= 256)) {
          v497 += this[p950 + vLN067] * vLN114;
        }
        vLN114 *= 128;
        if (v497 >= vLN114) {
          v497 -= Math.pow(2, p951 * 8);
        }
        return v497;
      };
      f274.prototype.readIntBE = function f330(p953, p954, p955) {
        p953 = p953 | 0;
        p954 = p954 | 0;
        if (!p955) {
          f321(p953, p954, this.length);
        }
        var vP954 = p954;
        var vLN115 = 1;
        var v498 = this[p953 + --vP954];
        while (vP954 > 0 && (vLN115 *= 256)) {
          v498 += this[p953 + --vP954] * vLN115;
        }
        vLN115 *= 128;
        if (v498 >= vLN115) {
          v498 -= Math.pow(2, p954 * 8);
        }
        return v498;
      };
      f274.prototype.readInt8 = function f331(p956, p957) {
        if (!p957) {
          f321(p956, 1, this.length);
        }
        if (!(this[p956] & 128)) {
          return this[p956];
        }
        return (255 - this[p956] + 1) * -1;
      };
      f274.prototype.readInt16LE = function f332(p958, p959) {
        if (!p959) {
          f321(p958, 2, this.length);
        }
        var v499 = this[p958] | this[p958 + 1] << 8;
        if (v499 & 32768) {
          return v499 | -65536;
        } else {
          return v499;
        }
      };
      f274.prototype.readInt16BE = function f333(p960, p961) {
        if (!p961) {
          f321(p960, 2, this.length);
        }
        var v500 = this[p960 + 1] | this[p960] << 8;
        if (v500 & 32768) {
          return v500 | -65536;
        } else {
          return v500;
        }
      };
      f274.prototype.readInt32LE = function f334(p962, p963) {
        if (!p963) {
          f321(p962, 4, this.length);
        }
        return this[p962] | this[p962 + 1] << 8 | this[p962 + 2] << 16 | this[p962 + 3] << 24;
      };
      f274.prototype.readInt32BE = function f335(p964, p965) {
        if (!p965) {
          f321(p964, 4, this.length);
        }
        return this[p964] << 24 | this[p964 + 1] << 16 | this[p964 + 2] << 8 | this[p964 + 3];
      };
      f274.prototype.readFloatLE = function f336(p966, p967) {
        if (!p967) {
          f321(p966, 4, this.length);
        }
        return vP8012.read(this, p966, true, 23, 4);
      };
      f274.prototype.readFloatBE = function f337(p968, p969) {
        if (!p969) {
          f321(p968, 4, this.length);
        }
        return vP8012.read(this, p968, false, 23, 4);
      };
      f274.prototype.readDoubleLE = function f338(p970, p971) {
        if (!p971) {
          f321(p970, 8, this.length);
        }
        return vP8012.read(this, p970, true, 52, 8);
      };
      f274.prototype.readDoubleBE = function f339(p972, p973) {
        if (!p973) {
          f321(p972, 8, this.length);
        }
        return vP8012.read(this, p972, false, 52, 8);
      };
      function f340(p974, p975, p976, p977, p978, p979) {
        if (!f274.isBuffer(p974)) {
          throw new TypeError("\"buffer\" argument must be a Buffer instance");
        }
        if (p975 > p978 || p975 < p979) {
          throw new RangeError("\"value\" argument is out of bounds");
        }
        if (p976 + p977 > p974.length) {
          throw new RangeError("Index out of range");
        }
      }
      f274.prototype.writeUIntLE = function f341(p980, p981, p982, p983) {
        p980 = +p980;
        p981 = p981 | 0;
        p982 = p982 | 0;
        if (!p983) {
          var v501 = Math.pow(2, p982 * 8) - 1;
          f340(this, p980, p981, p982, v501, 0);
        }
        var vLN116 = 1;
        var vLN068 = 0;
        this[p981] = p980 & 255;
        while (++vLN068 < p982 && (vLN116 *= 256)) {
          this[p981 + vLN068] = p980 / vLN116 & 255;
        }
        return p981 + p982;
      };
      f274.prototype.writeUIntBE = function f342(p984, p985, p986, p987) {
        p984 = +p984;
        p985 = p985 | 0;
        p986 = p986 | 0;
        if (!p987) {
          var v502 = Math.pow(2, p986 * 8) - 1;
          f340(this, p984, p985, p986, v502, 0);
        }
        var v503 = p986 - 1;
        var vLN117 = 1;
        this[p985 + v503] = p984 & 255;
        while (--v503 >= 0 && (vLN117 *= 256)) {
          this[p985 + v503] = p984 / vLN117 & 255;
        }
        return p985 + p986;
      };
      f274.prototype.writeUInt8 = function f343(p988, p989, p990) {
        p988 = +p988;
        p989 = p989 | 0;
        if (!p990) {
          f340(this, p988, p989, 1, 255, 0);
        }
        if (!f274.TYPED_ARRAY_SUPPORT) {
          p988 = Math.floor(p988);
        }
        this[p989] = p988 & 255;
        return p989 + 1;
      };
      function f344(p991, p992, p993, p994) {
        if (p992 < 0) {
          p992 = 65535 + p992 + 1;
        }
        for (var vLN069 = 0, v504 = Math.min(p991.length - p993, 2); vLN069 < v504; ++vLN069) {
          p991[p993 + vLN069] = (p992 & 255 << (p994 ? vLN069 : 1 - vLN069) * 8) >>> (p994 ? vLN069 : 1 - vLN069) * 8;
        }
      }
      f274.prototype.writeUInt16LE = function f345(p995, p996, p997) {
        p995 = +p995;
        p996 = p996 | 0;
        if (!p997) {
          f340(this, p995, p996, 2, 65535, 0);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p996] = p995 & 255;
          this[p996 + 1] = p995 >>> 8;
        } else {
          f344(this, p995, p996, true);
        }
        return p996 + 2;
      };
      f274.prototype.writeUInt16BE = function f346(p998, p999, p1000) {
        p998 = +p998;
        p999 = p999 | 0;
        if (!p1000) {
          f340(this, p998, p999, 2, 65535, 0);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p999] = p998 >>> 8;
          this[p999 + 1] = p998 & 255;
        } else {
          f344(this, p998, p999, false);
        }
        return p999 + 2;
      };
      function f347(p1001, p1002, p1003, p1004) {
        if (p1002 < 0) {
          p1002 = 4294967295 + p1002 + 1;
        }
        for (var vLN070 = 0, v505 = Math.min(p1001.length - p1003, 4); vLN070 < v505; ++vLN070) {
          p1001[p1003 + vLN070] = p1002 >>> (p1004 ? vLN070 : 3 - vLN070) * 8 & 255;
        }
      }
      f274.prototype.writeUInt32LE = function f348(p1005, p1006, p1007) {
        p1005 = +p1005;
        p1006 = p1006 | 0;
        if (!p1007) {
          f340(this, p1005, p1006, 4, 4294967295, 0);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1006 + 3] = p1005 >>> 24;
          this[p1006 + 2] = p1005 >>> 16;
          this[p1006 + 1] = p1005 >>> 8;
          this[p1006] = p1005 & 255;
        } else {
          f347(this, p1005, p1006, true);
        }
        return p1006 + 4;
      };
      f274.prototype.writeUInt32BE = function f349(p1008, p1009, p1010) {
        p1008 = +p1008;
        p1009 = p1009 | 0;
        if (!p1010) {
          f340(this, p1008, p1009, 4, 4294967295, 0);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1009] = p1008 >>> 24;
          this[p1009 + 1] = p1008 >>> 16;
          this[p1009 + 2] = p1008 >>> 8;
          this[p1009 + 3] = p1008 & 255;
        } else {
          f347(this, p1008, p1009, false);
        }
        return p1009 + 4;
      };
      f274.prototype.writeIntLE = function f350(p1011, p1012, p1013, p1014) {
        p1011 = +p1011;
        p1012 = p1012 | 0;
        if (!p1014) {
          var v506 = Math.pow(2, p1013 * 8 - 1);
          f340(this, p1011, p1012, p1013, v506 - 1, -v506);
        }
        var vLN071 = 0;
        var vLN118 = 1;
        var vLN072 = 0;
        this[p1012] = p1011 & 255;
        while (++vLN071 < p1013 && (vLN118 *= 256)) {
          if (p1011 < 0 && vLN072 === 0 && this[p1012 + vLN071 - 1] !== 0) {
            vLN072 = 1;
          }
          this[p1012 + vLN071] = (p1011 / vLN118 >> 0) - vLN072 & 255;
        }
        return p1012 + p1013;
      };
      f274.prototype.writeIntBE = function f351(p1015, p1016, p1017, p1018) {
        p1015 = +p1015;
        p1016 = p1016 | 0;
        if (!p1018) {
          var v507 = Math.pow(2, p1017 * 8 - 1);
          f340(this, p1015, p1016, p1017, v507 - 1, -v507);
        }
        var v508 = p1017 - 1;
        var vLN119 = 1;
        var vLN073 = 0;
        this[p1016 + v508] = p1015 & 255;
        while (--v508 >= 0 && (vLN119 *= 256)) {
          if (p1015 < 0 && vLN073 === 0 && this[p1016 + v508 + 1] !== 0) {
            vLN073 = 1;
          }
          this[p1016 + v508] = (p1015 / vLN119 >> 0) - vLN073 & 255;
        }
        return p1016 + p1017;
      };
      f274.prototype.writeInt8 = function f352(p1019, p1020, p1021) {
        p1019 = +p1019;
        p1020 = p1020 | 0;
        if (!p1021) {
          f340(this, p1019, p1020, 1, 127, -128);
        }
        if (!f274.TYPED_ARRAY_SUPPORT) {
          p1019 = Math.floor(p1019);
        }
        if (p1019 < 0) {
          p1019 = 255 + p1019 + 1;
        }
        this[p1020] = p1019 & 255;
        return p1020 + 1;
      };
      f274.prototype.writeInt16LE = function f353(p1022, p1023, p1024) {
        p1022 = +p1022;
        p1023 = p1023 | 0;
        if (!p1024) {
          f340(this, p1022, p1023, 2, 32767, -32768);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1023] = p1022 & 255;
          this[p1023 + 1] = p1022 >>> 8;
        } else {
          f344(this, p1022, p1023, true);
        }
        return p1023 + 2;
      };
      f274.prototype.writeInt16BE = function f354(p1025, p1026, p1027) {
        p1025 = +p1025;
        p1026 = p1026 | 0;
        if (!p1027) {
          f340(this, p1025, p1026, 2, 32767, -32768);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1026] = p1025 >>> 8;
          this[p1026 + 1] = p1025 & 255;
        } else {
          f344(this, p1025, p1026, false);
        }
        return p1026 + 2;
      };
      f274.prototype.writeInt32LE = function f355(p1028, p1029, p1030) {
        p1028 = +p1028;
        p1029 = p1029 | 0;
        if (!p1030) {
          f340(this, p1028, p1029, 4, 2147483647, -2147483648);
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1029] = p1028 & 255;
          this[p1029 + 1] = p1028 >>> 8;
          this[p1029 + 2] = p1028 >>> 16;
          this[p1029 + 3] = p1028 >>> 24;
        } else {
          f347(this, p1028, p1029, true);
        }
        return p1029 + 4;
      };
      f274.prototype.writeInt32BE = function f356(p1031, p1032, p1033) {
        p1031 = +p1031;
        p1032 = p1032 | 0;
        if (!p1033) {
          f340(this, p1031, p1032, 4, 2147483647, -2147483648);
        }
        if (p1031 < 0) {
          p1031 = 4294967295 + p1031 + 1;
        }
        if (f274.TYPED_ARRAY_SUPPORT) {
          this[p1032] = p1031 >>> 24;
          this[p1032 + 1] = p1031 >>> 16;
          this[p1032 + 2] = p1031 >>> 8;
          this[p1032 + 3] = p1031 & 255;
        } else {
          f347(this, p1031, p1032, false);
        }
        return p1032 + 4;
      };
      function f357(p1034, p1035, p1036, p1037, p1038, p1039) {
        if (p1036 + p1037 > p1034.length) {
          throw new RangeError("Index out of range");
        }
        if (p1036 < 0) {
          throw new RangeError("Index out of range");
        }
      }
      function f358(p1040, p1041, p1042, p1043, p1044) {
        if (!p1044) {
          f357(p1040, p1041, p1042, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
        }
        vP8012.write(p1040, p1041, p1042, p1043, 23, 4);
        return p1042 + 4;
      }
      f274.prototype.writeFloatLE = function f359(p1045, p1046, p1047) {
        return f358(this, p1045, p1046, true, p1047);
      };
      f274.prototype.writeFloatBE = function f360(p1048, p1049, p1050) {
        return f358(this, p1048, p1049, false, p1050);
      };
      function f361(p1051, p1052, p1053, p1054, p1055) {
        if (!p1055) {
          f357(p1051, p1052, p1053, 8, 1.7976931348623157e+308, -1.7976931348623157e+308);
        }
        vP8012.write(p1051, p1052, p1053, p1054, 52, 8);
        return p1053 + 8;
      }
      f274.prototype.writeDoubleLE = function f362(p1056, p1057, p1058) {
        return f361(this, p1056, p1057, true, p1058);
      };
      f274.prototype.writeDoubleBE = function f363(p1059, p1060, p1061) {
        return f361(this, p1059, p1060, false, p1061);
      };
      // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
      f274.prototype.copy = function f364(p1062, p1063, p1064, p1065) {
        if (!p1064) {
          p1064 = 0;
        }
        if (!p1065 && p1065 !== 0) {
          p1065 = this.length;
        }
        if (p1063 >= p1062.length) {
          p1063 = p1062.length;
        }
        if (!p1063) {
          p1063 = 0;
        }
        if (p1065 > 0 && p1065 < p1064) {
          p1065 = p1064;
        }
        // Copy 0 bytes; we're done
        if (p1065 === p1064) {
          return 0;
        }
        if (p1062.length === 0 || this.length === 0) {
          return 0;
        }
        // Fatal error conditions
        if (p1063 < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (p1064 < 0 || p1064 >= this.length) {
          throw new RangeError("sourceStart out of bounds");
        }
        if (p1065 < 0) {
          throw new RangeError("sourceEnd out of bounds");
        }
        // Are we oob?
        if (p1065 > this.length) {
          p1065 = this.length;
        }
        if (p1062.length - p1063 < p1065 - p1064) {
          p1065 = p1062.length - p1063 + p1064;
        }
        var v509 = p1065 - p1064;
        var v510;
        if (this === p1062 && p1064 < p1063 && p1063 < p1065) {
          // descending copy from end
          for (v510 = v509 - 1; v510 >= 0; --v510) {
            p1062[v510 + p1063] = this[v510 + p1064];
          }
        } else if (v509 < 1000 || !f274.TYPED_ARRAY_SUPPORT) {
          // ascending copy from start
          for (v510 = 0; v510 < v509; ++v510) {
            p1062[v510 + p1063] = this[v510 + p1064];
          }
        } else {
          Uint8Array.prototype.set.call(p1062, this.subarray(p1064, p1064 + v509), p1063);
        }
        return v509;
      };
      // Usage:
      //    buffer.fill(number[, offset[, end]])
      //    buffer.fill(buffer[, offset[, end]])
      //    buffer.fill(string[, offset[, end]][, encoding])
      f274.prototype.fill = function f365(p1066, p1067, p1068, p1069) {
        // Handle string cases:
        if (typeof p1066 === "string") {
          if (typeof p1067 === "string") {
            p1069 = p1067;
            p1067 = 0;
            p1068 = this.length;
          } else if (typeof p1068 === "string") {
            p1069 = p1068;
            p1068 = this.length;
          }
          if (p1066.length === 1) {
            var v511 = p1066.charCodeAt(0);
            if (v511 < 256) {
              p1066 = v511;
            }
          }
          if (p1069 !== undefined && typeof p1069 !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof p1069 === "string" && !f274.isEncoding(p1069)) {
            throw new TypeError("Unknown encoding: " + p1069);
          }
        } else if (typeof p1066 === "number") {
          p1066 = p1066 & 255;
        }
        // Invalid ranges are not set to a default, so can range check early.
        if (p1067 < 0 || this.length < p1067 || this.length < p1068) {
          throw new RangeError("Out of range index");
        }
        if (p1068 <= p1067) {
          return this;
        }
        p1067 = p1067 >>> 0;
        p1068 = p1068 === undefined ? this.length : p1068 >>> 0;
        if (!p1066) {
          p1066 = 0;
        }
        var v512;
        if (typeof p1066 === "number") {
          for (v512 = p1067; v512 < p1068; ++v512) {
            this[v512] = p1066;
          }
        } else {
          var v513 = f274.isBuffer(p1066) ? p1066 : f369(new f274(p1066, p1069).toString());
          var v514 = v513.length;
          for (v512 = 0; v512 < p1068 - p1067; ++v512) {
            this[v512 + p1067] = v513[v512 % v514];
          }
        }
        return this;
      };
      // HELPER FUNCTIONS
      // ================
      var v515 = /[^+\/0-9A-Za-z-_]/g;
      function f366(p1070) {
        // Node strips out invalid characters like \n and \t from the string, base64-js does not
        p1070 = f367(p1070).replace(v515, "");
        // Node converts strings with length < 2 to ''
        if (p1070.length < 2) {
          return "";
        }
        // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
        while (p1070.length % 4 !== 0) {
          p1070 = p1070 + "=";
        }
        return p1070;
      }
      function f367(p1071) {
        if (p1071.trim) {
          return p1071.trim();
        }
        return p1071.replace(/^\s+|\s+$/g, "");
      }
      function f368(p1072) {
        if (p1072 < 16) {
          return "0" + p1072.toString(16);
        }
        return p1072.toString(16);
      }
      function f369(p1073, p1074) {
        p1074 = p1074 || Infinity;
        var v516;
        var v517 = p1073.length;
        var v518 = null;
        var vA21 = [];
        for (var vLN074 = 0; vLN074 < v517; ++vLN074) {
          v516 = p1073.charCodeAt(vLN074);
          // is surrogate component
          if (v516 > 55295 && v516 < 57344) {
            // last char was a lead
            if (!v518) {
              // no lead yet
              if (v516 > 56319) {
                // unexpected trail
                if ((p1074 -= 3) > -1) {
                  vA21.push(239, 191, 189);
                }
                continue;
              } else if (vLN074 + 1 === v517) {
                // unpaired lead
                if ((p1074 -= 3) > -1) {
                  vA21.push(239, 191, 189);
                }
                continue;
              }
              // valid lead
              v518 = v516;
              continue;
            }
            // 2 leads in a row
            if (v516 < 56320) {
              if ((p1074 -= 3) > -1) {
                vA21.push(239, 191, 189);
              }
              v518 = v516;
              continue;
            }
            // valid surrogate pair
            v516 = (v518 - 55296 << 10 | v516 - 56320) + 65536;
          } else if (v518) {
            // valid bmp char, but last char was a lead
            if ((p1074 -= 3) > -1) {
              vA21.push(239, 191, 189);
            }
          }
          v518 = null;
          // encode utf8
          if (v516 < 128) {
            if ((p1074 -= 1) < 0) {
              break;
            }
            vA21.push(v516);
          } else if (v516 < 2048) {
            if ((p1074 -= 2) < 0) {
              break;
            }
            vA21.push(v516 >> 6 | 192, v516 & 63 | 128);
          } else if (v516 < 65536) {
            if ((p1074 -= 3) < 0) {
              break;
            }
            vA21.push(v516 >> 12 | 224, v516 >> 6 & 63 | 128, v516 & 63 | 128);
          } else if (v516 < 1114112) {
            if ((p1074 -= 4) < 0) {
              break;
            }
            vA21.push(v516 >> 18 | 240, v516 >> 12 & 63 | 128, v516 >> 6 & 63 | 128, v516 & 63 | 128);
          } else {
            throw new Error("Invalid code point");
          }
        }
        return vA21;
      }
      function f370(p1075) {
        var vA22 = [];
        for (var vLN075 = 0; vLN075 < p1075.length; ++vLN075) {
          // Node's code seems to be doing this and not & 0x7F..
          vA22.push(p1075.charCodeAt(vLN075) & 255);
        }
        return vA22;
      }
      function f371(p1076, p1077) {
        var v519;
        var v520;
        var v521;
        var vA23 = [];
        for (var vLN076 = 0; vLN076 < p1076.length; ++vLN076) {
          if ((p1077 -= 2) < 0) {
            break;
          }
          v519 = p1076.charCodeAt(vLN076);
          v520 = v519 >> 8;
          v521 = v519 % 256;
          vA23.push(v521);
          vA23.push(v520);
        }
        return vA23;
      }
      function f372(p1078) {
        return vP801.toByteArray(f366(p1078));
      }
      function f373(p1079, p1080, p1081, p1082) {
        for (var vLN077 = 0; vLN077 < p1082; ++vLN077) {
          if (vLN077 + p1081 >= p1080.length || vLN077 >= p1079.length) {
            break;
          }
          p1080[vLN077 + p1081] = p1079[vLN077];
        }
        return vLN077;
      }
      function f374(p1083) {
        return p1083 !== p1083;
        // eslint-disable-line no-self-compare
      }
      /* WEBPACK VAR INJECTION */
    }).call(this, p801(/*! ./../webpack/buildin/global.js */
    "./node_modules/webpack/buildin/global.js"));
    /***/
  },
  /***/
  "./node_modules/buffer/node_modules/isarray/index.js":
  /*!***********************************************************!*\
  !*** ./node_modules/buffer/node_modules/isarray/index.js ***!
  \***********************************************************/
  /*! no static exports found */
  /***/
  function (p1084, p1085) {
    var v522 = {}.toString;
    p1084.exports = Array.isArray || function (p1086) {
      return v522.call(p1086) == "[object Array]";
    };
    /***/
  },
  /***/
  "./node_modules/charenc/charenc.js":
  /*!*****************************************!*\
  !*** ./node_modules/charenc/charenc.js ***!
  \*****************************************/
  /*! no static exports found */
  /***/
  function (p1087, p1088) {
    var vO17 = {
      // UTF-8 encoding
      utf8: {
        // Convert a string to a byte array
        stringToBytes: function (p1089) {
          return vO17.bin.stringToBytes(unescape(encodeURIComponent(p1089)));
        },
        // Convert a byte array to a string
        bytesToString: function (p1090) {
          return decodeURIComponent(escape(vO17.bin.bytesToString(p1090)));
        }
      },
      // Binary encoding
      bin: {
        // Convert a string to a byte array
        stringToBytes: function (p1091) {
          var vA24 = [];
          for (var vLN078 = 0; vLN078 < p1091.length; vLN078++) {
            vA24.push(p1091.charCodeAt(vLN078) & 255);
          }
          return vA24;
        },
        // Convert a byte array to a string
        bytesToString: function (p1092) {
          var vA25 = [];
          for (var vLN079 = 0; vLN079 < p1092.length; vLN079++) {
            vA25.push(String.fromCharCode(p1092[vLN079]));
          }
          return vA25.join("");
        }
      }
    };
    p1087.exports = vO17;
    /***/
  },
  /***/
  "./node_modules/crypt/crypt.js":
  /*!*************************************!*\
  !*** ./node_modules/crypt/crypt.js ***!
  \*************************************/
  /*! no static exports found */
  /***/
  function (p1093, p1094) {
    (function () {
      var vLSABCDEFGHIJKLMNOPQRST4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var vO18 = {
        // Bit-wise rotation left
        rotl: function (p1095, p1096) {
          return p1095 << p1096 | p1095 >>> 32 - p1096;
        },
        // Bit-wise rotation right
        rotr: function (p1097, p1098) {
          return p1097 << 32 - p1098 | p1097 >>> p1098;
        },
        // Swap big-endian to little-endian and vice versa
        endian: function (p1099) {
          // If number given, swap endian
          if (p1099.constructor == Number) {
            return vO18.rotl(p1099, 8) & 16711935 | vO18.rotl(p1099, 24) & -16711936;
          }
          // Else, assume array and swap all items
          for (var vLN080 = 0; vLN080 < p1099.length; vLN080++) {
            p1099[vLN080] = vO18.endian(p1099[vLN080]);
          }
          return p1099;
        },
        // Generate an array of any length of random bytes
        randomBytes: function (p1100) {
          var vA26 = [];
          for (; p1100 > 0; p1100--) {
            vA26.push(Math.floor(Math.random() * 256));
          }
          return vA26;
        },
        // Convert a byte array to big-endian 32-bit words
        bytesToWords: function (p1101) {
          var vA27 = [];
          for (var vLN081 = 0, vLN082 = 0; vLN081 < p1101.length; vLN081++, vLN082 += 8) {
            vA27[vLN082 >>> 5] |= p1101[vLN081] << 24 - vLN082 % 32;
          }
          return vA27;
        },
        // Convert big-endian 32-bit words to a byte array
        wordsToBytes: function (p1102) {
          var vA28 = [];
          for (var vLN083 = 0; vLN083 < p1102.length * 32; vLN083 += 8) {
            vA28.push(p1102[vLN083 >>> 5] >>> 24 - vLN083 % 32 & 255);
          }
          return vA28;
        },
        // Convert a byte array to a hex string
        bytesToHex: function (p1103) {
          var vA29 = [];
          for (var vLN084 = 0; vLN084 < p1103.length; vLN084++) {
            vA29.push((p1103[vLN084] >>> 4).toString(16));
            vA29.push((p1103[vLN084] & 15).toString(16));
          }
          return vA29.join("");
        },
        // Convert a hex string to a byte array
        hexToBytes: function (p1104) {
          var vA30 = [];
          for (var vLN085 = 0; vLN085 < p1104.length; vLN085 += 2) {
            vA30.push(parseInt(p1104.substr(vLN085, 2), 16));
          }
          return vA30;
        },
        // Convert a byte array to a base-64 string
        bytesToBase64: function (p1105) {
          var vA31 = [];
          for (var vLN086 = 0; vLN086 < p1105.length; vLN086 += 3) {
            var v523 = p1105[vLN086] << 16 | p1105[vLN086 + 1] << 8 | p1105[vLN086 + 2];
            for (var vLN087 = 0; vLN087 < 4; vLN087++) {
              if (vLN086 * 8 + vLN087 * 6 <= p1105.length * 8) {
                vA31.push(vLSABCDEFGHIJKLMNOPQRST4.charAt(v523 >>> (3 - vLN087) * 6 & 63));
              } else {
                vA31.push("=");
              }
            }
          }
          return vA31.join("");
        },
        // Convert a base-64 string to a byte array
        base64ToBytes: function (p1106) {
          // Remove non-base-64 characters
          p1106 = p1106.replace(/[^A-Z0-9+\/]/gi, "");
          var vA32 = [];
          for (var vLN088 = 0, vLN089 = 0; vLN088 < p1106.length; vLN089 = ++vLN088 % 4) {
            if (vLN089 == 0) {
              continue;
            }
            vA32.push((vLSABCDEFGHIJKLMNOPQRST4.indexOf(p1106.charAt(vLN088 - 1)) & Math.pow(2, vLN089 * -2 + 8) - 1) << vLN089 * 2 | vLSABCDEFGHIJKLMNOPQRST4.indexOf(p1106.charAt(vLN088)) >>> 6 - vLN089 * 2);
          }
          return vA32;
        }
      };
      p1093.exports = vO18;
    })();
    /***/
  },
  /***/
  "./node_modules/event-lite/event-lite.js":
  /*!***********************************************!*\
  !*** ./node_modules/event-lite/event-lite.js ***!
  \***********************************************/
  /*! no static exports found */
  /***/
  function (p1107, p1108, p1109) {
    /**
         * event-lite.js - Light-weight EventEmitter (less than 1KB when gzipped)
         *
         * @copyright Yusuke Kawasaki
         * @license MIT
         * @constructor
         * @see https://github.com/kawanet/event-lite
         * @see http://kawanet.github.io/event-lite/EventLite.html
         * @example
         * var EventLite = require("event-lite");
         *
         * function MyClass() {...}             // your class
         *
         * EventLite.mixin(MyClass.prototype);  // import event methods
         *
         * var obj = new MyClass();
         * obj.on("foo", function() {...});     // add event listener
         * obj.once("bar", function() {...});   // add one-time event listener
         * obj.emit("foo");                     // dispatch event
         * obj.emit("bar");                     // dispatch another event
         * obj.off("foo");                      // remove event listener
         */
    function f375() {
      if (!(this instanceof f375)) {
        return new f375();
      }
    }
    (function (p1110) {
      // export the class for node.js
      if (true) {
        p1107.exports = p1110;
      }
      // property name to hold listeners
      var vLSListeners2 = "listeners";
      // methods to export
      var vO19 = {
        on: f377,
        once: f378,
        off: f380,
        emit: f382
      };
      // mixin to self
      f376(p1110.prototype);
      // export mixin function
      p1110.mixin = f376;
      /**
           * Import on(), once(), off() and emit() methods into target object.
           *
           * @function EventLite.mixin
           * @param target {Prototype}
           */
      function f376(p1111) {
        for (var v524 in vO19) {
          p1111[v524] = vO19[v524];
        }
        return p1111;
      }
      /**
           * Add an event listener.
           *
           * @function EventLite.prototype.on
           * @param type {string}
           * @param func {Function}
           * @returns {EventLite} Self for method chaining
           */
      function f377(p1112, p1113) {
        f386(this, p1112).push(p1113);
        return this;
      }
      /**
           * Add one-time event listener.
           *
           * @function EventLite.prototype.once
           * @param type {string}
           * @param func {Function}
           * @returns {EventLite} Self for method chaining
           */
      function f378(p1114, p1115) {
        var vThis6 = this;
        f379.originalListener = p1115;
        f386(vThis6, p1114).push(f379);
        return vThis6;
        function f379() {
          f380.call(vThis6, p1114, f379);
          p1115.apply(this, arguments);
        }
      }
      /**
           * Remove an event listener.
           *
           * @function EventLite.prototype.off
           * @param [type] {string}
           * @param [func] {Function}
           * @returns {EventLite} Self for method chaining
           */
      function f380(p1116, p1117) {
        var vThis7 = this;
        var v525;
        if (!arguments.length) {
          delete vThis7[vLSListeners2];
        } else if (!p1117) {
          v525 = vThis7[vLSListeners2];
          if (v525) {
            delete v525[p1116];
            if (!Object.keys(v525).length) {
              return f380.call(vThis7);
            }
          }
        } else {
          v525 = f386(vThis7, p1116, true);
          if (v525) {
            v525 = v525.filter(f381);
            if (!v525.length) {
              return f380.call(vThis7, p1116);
            }
            vThis7[vLSListeners2][p1116] = v525;
          }
        }
        return vThis7;
        function f381(p1118) {
          return p1118 !== p1117 && p1118.originalListener !== p1117;
        }
      }
      /**
           * Dispatch (trigger) an event.
           *
           * @function EventLite.prototype.emit
           * @param type {string}
           * @param [value] {*}
           * @returns {boolean} True when a listener received the event
           */
      function f382(p1119, p1120) {
        var vThis8 = this;
        var vGetListeners = f386(vThis8, p1119, true);
        if (!vGetListeners) {
          return false;
        }
        var v526 = arguments.length;
        if (v526 === 1) {
          vGetListeners.forEach(f383);
        } else if (v526 === 2) {
          vGetListeners.forEach(f384);
        } else {
          var v527 = Array.prototype.slice.call(arguments, 1);
          vGetListeners.forEach(f385);
        }
        return !!vGetListeners.length;
        function f383(p1121) {
          p1121.call(vThis8);
        }
        function f384(p1122) {
          p1122.call(vThis8, p1120);
        }
        function f385(p1123) {
          p1123.apply(vThis8, v527);
        }
      }
      /**
           * @ignore
           */
      function f386(p1124, p1125, p1126) {
        if (p1126 && !p1124[vLSListeners2]) {
          return;
        }
        var v528 = p1124[vLSListeners2] ||= {};
        return v528[p1125] ||= [];
      }
    })(f375);
    /***/
  },
  /***/
  "./node_modules/ieee754/index.js":
  /*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
  /*! no static exports found */
  /***/
  function (p1127, p1128) {
    p1128.read = function (p1129, p1130, p1131, p1132, p1133) {
      var v529;
      var v530;
      var v531 = p1133 * 8 - p1132 - 1;
      var v532 = (1 << v531) - 1;
      var v533 = v532 >> 1;
      var v534 = -7;
      var v535 = p1131 ? p1133 - 1 : 0;
      var v536 = p1131 ? -1 : 1;
      var v537 = p1129[p1130 + v535];
      v535 += v536;
      v529 = v537 & (1 << -v534) - 1;
      v537 >>= -v534;
      v534 += v531;
      for (; v534 > 0; v529 = v529 * 256 + p1129[p1130 + v535], v535 += v536, v534 -= 8) {}
      v530 = v529 & (1 << -v534) - 1;
      v529 >>= -v534;
      v534 += p1132;
      for (; v534 > 0; v530 = v530 * 256 + p1129[p1130 + v535], v535 += v536, v534 -= 8) {}
      if (v529 === 0) {
        v529 = 1 - v533;
      } else if (v529 === v532) {
        if (v530) {
          return NaN;
        } else {
          return (v537 ? -1 : 1) * Infinity;
        }
      } else {
        v530 = v530 + Math.pow(2, p1132);
        v529 = v529 - v533;
      }
      return (v537 ? -1 : 1) * v530 * Math.pow(2, v529 - p1132);
    };
    p1128.write = function (p1134, p1135, p1136, p1137, p1138, p1139) {
      var v538;
      var v539;
      var v540;
      var v541 = p1139 * 8 - p1138 - 1;
      var v542 = (1 << v541) - 1;
      var v543 = v542 >> 1;
      var v544 = p1138 === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var v545 = p1137 ? 0 : p1139 - 1;
      var v546 = p1137 ? 1 : -1;
      var v547 = p1135 < 0 || p1135 === 0 && 1 / p1135 < 0 ? 1 : 0;
      p1135 = Math.abs(p1135);
      if (isNaN(p1135) || p1135 === Infinity) {
        v539 = isNaN(p1135) ? 1 : 0;
        v538 = v542;
      } else {
        v538 = Math.floor(Math.log(p1135) / Math.LN2);
        if (p1135 * (v540 = Math.pow(2, -v538)) < 1) {
          v538--;
          v540 *= 2;
        }
        if (v538 + v543 >= 1) {
          p1135 += v544 / v540;
        } else {
          p1135 += v544 * Math.pow(2, 1 - v543);
        }
        if (p1135 * v540 >= 2) {
          v538++;
          v540 /= 2;
        }
        if (v538 + v543 >= v542) {
          v539 = 0;
          v538 = v542;
        } else if (v538 + v543 >= 1) {
          v539 = (p1135 * v540 - 1) * Math.pow(2, p1138);
          v538 = v538 + v543;
        } else {
          v539 = p1135 * Math.pow(2, v543 - 1) * Math.pow(2, p1138);
          v538 = 0;
        }
      }
      for (; p1138 >= 8; p1134[p1136 + v545] = v539 & 255, v545 += v546, v539 /= 256, p1138 -= 8) {}
      v538 = v538 << p1138 | v539;
      v541 += p1138;
      for (; v541 > 0; p1134[p1136 + v545] = v538 & 255, v545 += v546, v538 /= 256, v541 -= 8) {}
      p1134[p1136 + v545 - v546] |= v547 * 128;
    };
    /***/
  },
  /***/
  "./node_modules/int64-buffer/int64-buffer.js":
  /*!***************************************************!*\
  !*** ./node_modules/int64-buffer/int64-buffer.js ***!
  \***************************************************/
  /*! no static exports found */
  /***/
  function (p1140, p1141, p1142) {
    /* WEBPACK VAR INJECTION */
    (function (p1143) {
      // int64-buffer.js
      /*jshint -W018 */
      // Confusing use of '!'.
      /*jshint -W030 */
      // Expected an assignment or function call and instead saw an expression.
      /*jshint -W093 */
      // Did you mean to return a conditional instead of an assignment?
      var v548;
      var v549;
      var v550;
      var v551;
      (function (p1144) {
        // constants
        var vLSUndefined2 = "undefined";
        var v552 = vLSUndefined2 !== typeof p1143 && p1143;
        var v553 = vLSUndefined2 !== typeof Uint8Array && Uint8Array;
        var v554 = vLSUndefined2 !== typeof ArrayBuffer && ArrayBuffer;
        var vA33 = [0, 0, 0, 0, 0, 0, 0, 0];
        var v555 = Array.isArray || f406;
        var vLN42949672962 = 4294967296;
        var vLN167772162 = 16777216;
        // storage class
        var v556;
        // Array;
        // generate classes
        v548 = f387("Uint64BE", true, true);
        v549 = f387("Int64BE", true, false);
        v550 = f387("Uint64LE", false, true);
        v551 = f387("Int64LE", false, false);
        // class factory
        function f387(p1145, p1146, p1147) {
          var v557 = p1146 ? 0 : 4;
          var v558 = p1146 ? 4 : 0;
          var v559 = p1146 ? 0 : 3;
          var v560 = p1146 ? 1 : 2;
          var v561 = p1146 ? 2 : 1;
          var v562 = p1146 ? 3 : 0;
          var v563 = p1146 ? f402 : f404;
          var v564 = p1146 ? f403 : f405;
          var v565 = f388.prototype;
          var v566 = "is" + p1145;
          var v567 = "_" + v566;
          // properties
          v565.buffer = undefined;
          v565.offset = 0;
          v565[v567] = true;
          // methods
          v565.toNumber = f392;
          v565.toString = f393;
          v565.toJSON = f392;
          v565.toArray = f396;
          // add .toBuffer() method only when Buffer available
          if (v552) {
            v565.toBuffer = f397;
          }
          // add .toArrayBuffer() method only when Uint8Array available
          if (v553) {
            v565.toArrayBuffer = f398;
          }
          // isUint64BE, isInt64BE
          f388[v566] = f389;
          // CommonJS
          p1144[p1145] = f388;
          return f388;
          // constructor
          function f388(p1148, p1149, p1150, p1151) {
            if (!(this instanceof f388)) {
              return new f388(p1148, p1149, p1150, p1151);
            }
            return f390(this, p1148, p1149, p1150, p1151);
          }
          // isUint64BE, isInt64BE
          function f389(p1152) {
            return !!p1152 && !!p1152[v567];
          }
          // initializer
          function f390(p1153, p1154, p1155, p1156, p1157) {
            if (v553 && v554) {
              if (p1154 instanceof v554) {
                p1154 = new v553(p1154);
              }
              if (p1156 instanceof v554) {
                p1156 = new v553(p1156);
              }
            }
            // Int64BE() style
            if (!p1154 && !p1155 && !p1156 && !v556) {
              // shortcut to initialize with zero
              p1153.buffer = f401(vA33, 0);
              return;
            }
            // Int64BE(value, raddix) style
            if (!f399(p1154, p1155)) {
              var v568 = v556 || Array;
              p1157 = p1155;
              p1156 = p1154;
              p1155 = 0;
              p1154 = new v568(8);
            }
            p1153.buffer = p1154;
            p1153.offset = p1155 |= 0;
            // Int64BE(buffer, offset) style
            if (vLSUndefined2 === typeof p1156) {
              return;
            }
            // Int64BE(buffer, offset, value, raddix) style
            if (typeof p1156 === "string") {
              f391(p1154, p1155, p1156, p1157 || 10);
            } else if (f399(p1156, p1157)) {
              f400(p1154, p1155, p1156, p1157);
            } else if (typeof p1157 === "number") {
              f394(p1154, p1155 + v557, p1156);
              // high
              f394(p1154, p1155 + v558, p1157);
              // low
            } else if (p1156 > 0) {
              v563(p1154, p1155, p1156);
              // positive
            } else if (p1156 < 0) {
              v564(p1154, p1155, p1156);
              // negative
            } else {
              f400(p1154, p1155, vA33, 0);
              // zero, NaN and others
            }
          }
          function f391(p1158, p1159, p1160, p1161) {
            var vLN090 = 0;
            var v569 = p1160.length;
            var vLN091 = 0;
            var vLN092 = 0;
            if (p1160[0] === "-") {
              vLN090++;
            }
            var vVLN090 = vLN090;
            while (vLN090 < v569) {
              var vParseInt4 = parseInt(p1160[vLN090++], p1161);
              if (!(vParseInt4 >= 0)) {
                break;
              }
              // NaN
              vLN092 = vLN092 * p1161 + vParseInt4;
              vLN091 = vLN091 * p1161 + Math.floor(vLN092 / vLN42949672962);
              vLN092 %= vLN42949672962;
            }
            if (vVLN090) {
              vLN091 = ~vLN091;
              if (vLN092) {
                vLN092 = vLN42949672962 - vLN092;
              } else {
                vLN091++;
              }
            }
            f394(p1158, p1159 + v557, vLN091);
            f394(p1158, p1159 + v558, vLN092);
          }
          function f392() {
            var v570 = this.buffer;
            var v571 = this.offset;
            var vReadInt32 = f395(v570, v571 + v557);
            var vReadInt322 = f395(v570, v571 + v558);
            if (!p1147) {
              vReadInt32 |= 0;
            }
            // a trick to get signed
            if (vReadInt32) {
              return vReadInt32 * vLN42949672962 + vReadInt322;
            } else {
              return vReadInt322;
            }
          }
          function f393(p1162) {
            var v572 = this.buffer;
            var v573 = this.offset;
            var vReadInt323 = f395(v572, v573 + v557);
            var vReadInt324 = f395(v572, v573 + v558);
            var vLS17 = "";
            var v574 = !p1147 && vReadInt323 & -2147483648;
            if (v574) {
              vReadInt323 = ~vReadInt323;
              vReadInt324 = vLN42949672962 - vReadInt324;
            }
            p1162 = p1162 || 10;
            while (1) {
              var v575 = vReadInt323 % p1162 * vLN42949672962 + vReadInt324;
              vReadInt323 = Math.floor(vReadInt323 / p1162);
              vReadInt324 = Math.floor(v575 / p1162);
              vLS17 = (v575 % p1162).toString(p1162) + vLS17;
              if (!vReadInt323 && !vReadInt324) {
                break;
              }
            }
            if (v574) {
              vLS17 = "-" + vLS17;
            }
            return vLS17;
          }
          function f394(p1163, p1164, p1165) {
            p1163[p1164 + v562] = p1165 & 255;
            p1165 = p1165 >> 8;
            p1163[p1164 + v561] = p1165 & 255;
            p1165 = p1165 >> 8;
            p1163[p1164 + v560] = p1165 & 255;
            p1165 = p1165 >> 8;
            p1163[p1164 + v559] = p1165 & 255;
          }
          function f395(p1166, p1167) {
            return p1166[p1167 + v559] * vLN167772162 + (p1166[p1167 + v560] << 16) + (p1166[p1167 + v561] << 8) + p1166[p1167 + v562];
          }
        }
        function f396(p1168) {
          var v576 = this.buffer;
          var v577 = this.offset;
          v556 = null;
          // Array
          if (p1168 !== false && v577 === 0 && v576.length === 8 && v555(v576)) {
            return v576;
          }
          return f401(v576, v577);
        }
        function f397(p1169) {
          var v578 = this.buffer;
          var v579 = this.offset;
          v556 = v552;
          if (p1169 !== false && v579 === 0 && v578.length === 8 && p1143.isBuffer(v578)) {
            return v578;
          }
          var v580 = new v552(8);
          f400(v580, 0, v578, v579);
          return v580;
        }
        function f398(p1170) {
          var v581 = this.buffer;
          var v582 = this.offset;
          var v583 = v581.buffer;
          v556 = v553;
          if (p1170 !== false && v582 === 0 && v583 instanceof v554 && v583.byteLength === 8) {
            return v583;
          }
          var v584 = new v553(8);
          f400(v584, 0, v581, v582);
          return v584.buffer;
        }
        function f399(p1171, p1172) {
          var v585 = p1171 && p1171.length;
          p1172 |= 0;
          return v585 && p1172 + 8 <= v585 && typeof p1171[p1172] !== "string";
        }
        function f400(p1173, p1174, p1175, p1176) {
          p1174 |= 0;
          p1176 |= 0;
          for (var vLN093 = 0; vLN093 < 8; vLN093++) {
            p1173[p1174++] = p1175[p1176++] & 255;
          }
        }
        function f401(p1177, p1178) {
          return Array.prototype.slice.call(p1177, p1178, p1178 + 8);
        }
        function f402(p1179, p1180, p1181) {
          var v586 = p1180 + 8;
          while (v586 > p1180) {
            p1179[--v586] = p1181 & 255;
            p1181 /= 256;
          }
        }
        function f403(p1182, p1183, p1184) {
          var v587 = p1183 + 8;
          p1184++;
          while (v587 > p1183) {
            p1182[--v587] = -p1184 & 255 ^ 255;
            p1184 /= 256;
          }
        }
        function f404(p1185, p1186, p1187) {
          var v588 = p1186 + 8;
          while (p1186 < v588) {
            p1185[p1186++] = p1187 & 255;
            p1187 /= 256;
          }
        }
        function f405(p1188, p1189, p1190) {
          var v589 = p1189 + 8;
          p1190++;
          while (p1189 < v589) {
            p1188[p1189++] = -p1190 & 255 ^ 255;
            p1190 /= 256;
          }
        }
        // https://github.com/retrofox/is-array
        function f406(p1191) {
          return !!p1191 && Object.prototype.toString.call(p1191) == "[object Array]";
        }
      })(true && typeof p1141.nodeName !== "string" ? p1141 : this || {});
      /* WEBPACK VAR INJECTION */
    }).call(this, p1142(/*! ./../buffer/index.js */
    "./node_modules/buffer/index.js").Buffer);
    /***/
  },
  /***/
  "./node_modules/is-buffer/index.js":
  /*!*****************************************!*\
  !*** ./node_modules/is-buffer/index.js ***!
  \*****************************************/
  /*! no static exports found */
  /***/
  function (p1192, p1193) {
    /*!
         * Determine if an object is a Buffer
         *
         * @author   Feross Aboukhadijeh <https://feross.org>
         * @license  MIT
         */
    // The _isBuffer check is for Safari 5-7 support, because it's missing
    // Object.prototype.constructor. Remove this eventually
    p1192.exports = function (p1194) {
      return p1194 != null && (f407(p1194) || f408(p1194) || !!p1194._isBuffer);
    };
    function f407(p1195) {
      return !!p1195.constructor && typeof p1195.constructor.isBuffer === "function" && p1195.constructor.isBuffer(p1195);
    }
    // For Node v0.10 support. Remove this eventually.
    function f408(p1196) {
      return typeof p1196.readFloatLE === "function" && typeof p1196.slice === "function" && f407(p1196.slice(0, 0));
    }
    /***/
  },
  /***/
  "./node_modules/md5/md5.js":
  /*!*********************************!*\
  !*** ./node_modules/md5/md5.js ***!
  \*********************************/
  /*! no static exports found */
  /***/
  function (p1197, p1198, p1199) {
    (function () {
      var vP1199 = p1199(/*! crypt */
      "./node_modules/crypt/crypt.js");
      var v590 = p1199(/*! charenc */
      "./node_modules/charenc/charenc.js").utf8;
      var vP11992 = p1199(/*! is-buffer */
      "./node_modules/is-buffer/index.js");
      var v591 = p1199(/*! charenc */
      "./node_modules/charenc/charenc.js").bin;
      function f409(p1200, p1201) {
        // Convert to byte array
        if (p1200.constructor == String) {
          if (p1201 && p1201.encoding === "binary") {
            p1200 = v591.stringToBytes(p1200);
          } else {
            p1200 = v590.stringToBytes(p1200);
          }
        } else if (vP11992(p1200)) {
          p1200 = Array.prototype.slice.call(p1200, 0);
        } else if (!Array.isArray(p1200)) {
          p1200 = p1200.toString();
        }
        // else, assume byte array already
        var v592 = vP1199.bytesToWords(p1200);
        var v593 = p1200.length * 8;
        var vLN1732584193 = 1732584193;
        var v594 = -271733879;
        var v595 = -1732584194;
        var vLN271733878 = 271733878; // Swap endian
        for (var vLN095 = 0; vLN095 < v592.length; vLN095++) {
          v592[vLN095] = (v592[vLN095] << 8 | v592[vLN095] >>> 24) & 16711935 | (v592[vLN095] << 24 | v592[vLN095] >>> 8) & -16711936;
        }
        // Padding
        v592[v593 >>> 5] |= 128 << v593 % 32;
        v592[(v593 + 64 >>> 9 << 4) + 14] = v593;
        // Method shortcuts
        var v596 = f409._ff;
        var v597 = f409._gg;
        var v598 = f409._hh;
        var v599 = f409._ii;
        for (var vLN095 = 0; vLN095 < v592.length; vLN095 += 16) {
          var vVLN1732584193 = vLN1732584193;
          var vV594 = v594;
          var vV595 = v595;
          var vVLN271733878 = vLN271733878;
          vLN1732584193 = v596(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 0], 7, -680876936);
          vLN271733878 = v596(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 1], 12, -389564586);
          v595 = v596(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 2], 17, 606105819);
          v594 = v596(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 3], 22, -1044525330);
          vLN1732584193 = v596(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 4], 7, -176418897);
          vLN271733878 = v596(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 5], 12, 1200080426);
          v595 = v596(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 6], 17, -1473231341);
          v594 = v596(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 7], 22, -45705983);
          vLN1732584193 = v596(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 8], 7, 1770035416);
          vLN271733878 = v596(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 9], 12, -1958414417);
          v595 = v596(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 10], 17, -42063);
          v594 = v596(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 11], 22, -1990404162);
          vLN1732584193 = v596(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 12], 7, 1804603682);
          vLN271733878 = v596(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 13], 12, -40341101);
          v595 = v596(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 14], 17, -1502002290);
          v594 = v596(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 15], 22, 1236535329);
          vLN1732584193 = v597(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 1], 5, -165796510);
          vLN271733878 = v597(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 6], 9, -1069501632);
          v595 = v597(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 11], 14, 643717713);
          v594 = v597(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 0], 20, -373897302);
          vLN1732584193 = v597(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 5], 5, -701558691);
          vLN271733878 = v597(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 10], 9, 38016083);
          v595 = v597(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 15], 14, -660478335);
          v594 = v597(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 4], 20, -405537848);
          vLN1732584193 = v597(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 9], 5, 568446438);
          vLN271733878 = v597(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 14], 9, -1019803690);
          v595 = v597(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 3], 14, -187363961);
          v594 = v597(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 8], 20, 1163531501);
          vLN1732584193 = v597(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 13], 5, -1444681467);
          vLN271733878 = v597(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 2], 9, -51403784);
          v595 = v597(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 7], 14, 1735328473);
          v594 = v597(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 12], 20, -1926607734);
          vLN1732584193 = v598(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 5], 4, -378558);
          vLN271733878 = v598(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 8], 11, -2022574463);
          v595 = v598(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 11], 16, 1839030562);
          v594 = v598(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 14], 23, -35309556);
          vLN1732584193 = v598(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 1], 4, -1530992060);
          vLN271733878 = v598(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 4], 11, 1272893353);
          v595 = v598(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 7], 16, -155497632);
          v594 = v598(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 10], 23, -1094730640);
          vLN1732584193 = v598(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 13], 4, 681279174);
          vLN271733878 = v598(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 0], 11, -358537222);
          v595 = v598(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 3], 16, -722521979);
          v594 = v598(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 6], 23, 76029189);
          vLN1732584193 = v598(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 9], 4, -640364487);
          vLN271733878 = v598(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 12], 11, -421815835);
          v595 = v598(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 15], 16, 530742520);
          v594 = v598(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 2], 23, -995338651);
          vLN1732584193 = v599(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 0], 6, -198630844);
          vLN271733878 = v599(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 7], 10, 1126891415);
          v595 = v599(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 14], 15, -1416354905);
          v594 = v599(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 5], 21, -57434055);
          vLN1732584193 = v599(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 12], 6, 1700485571);
          vLN271733878 = v599(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 3], 10, -1894986606);
          v595 = v599(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 10], 15, -1051523);
          v594 = v599(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 1], 21, -2054922799);
          vLN1732584193 = v599(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 8], 6, 1873313359);
          vLN271733878 = v599(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 15], 10, -30611744);
          v595 = v599(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 6], 15, -1560198380);
          v594 = v599(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 13], 21, 1309151649);
          vLN1732584193 = v599(vLN1732584193, v594, v595, vLN271733878, v592[vLN095 + 4], 6, -145523070);
          vLN271733878 = v599(vLN271733878, vLN1732584193, v594, v595, v592[vLN095 + 11], 10, -1120210379);
          v595 = v599(v595, vLN271733878, vLN1732584193, v594, v592[vLN095 + 2], 15, 718787259);
          v594 = v599(v594, v595, vLN271733878, vLN1732584193, v592[vLN095 + 9], 21, -343485551);
          vLN1732584193 = vLN1732584193 + vVLN1732584193 >>> 0;
          v594 = v594 + vV594 >>> 0;
          v595 = v595 + vV595 >>> 0;
          vLN271733878 = vLN271733878 + vVLN271733878 >>> 0;
        }
        return vP1199.endian([vLN1732584193, v594, v595, vLN271733878]);
      } // Auxiliary functions
      f409._ff = function (p1202, p1203, p1204, p1205, p1206, p1207, p1208) {
        var v600 = p1202 + (p1203 & p1204 | ~p1203 & p1205) + (p1206 >>> 0) + p1208;
        return (v600 << p1207 | v600 >>> 32 - p1207) + p1203;
      };
      f409._gg = function (p1209, p1210, p1211, p1212, p1213, p1214, p1215) {
        var v601 = p1209 + (p1210 & p1212 | p1211 & ~p1212) + (p1213 >>> 0) + p1215;
        return (v601 << p1214 | v601 >>> 32 - p1214) + p1210;
      };
      f409._hh = function (p1216, p1217, p1218, p1219, p1220, p1221, p1222) {
        var v602 = p1216 + (p1217 ^ p1218 ^ p1219) + (p1220 >>> 0) + p1222;
        return (v602 << p1221 | v602 >>> 32 - p1221) + p1217;
      };
      f409._ii = function (p1223, p1224, p1225, p1226, p1227, p1228, p1229) {
        var v603 = p1223 + (p1225 ^ (p1224 | ~p1226)) + (p1227 >>> 0) + p1229;
        return (v603 << p1228 | v603 >>> 32 - p1228) + p1224;
      };
      // Package private blocksize
      f409._blocksize = 16;
      f409._digestsize = 16;
      p1197.exports = function (p1230, p1231) {
        if (p1230 === undefined || p1230 === null) {
          throw new Error("Illegal argument " + p1230);
        }
        var v604 = vP1199.wordsToBytes(f409(p1230, p1231));
        if (p1231 && p1231.asBytes) {
          return v604;
        } else if (p1231 && p1231.asString) {
          return v591.bytesToString(v604);
        } else {
          return vP1199.bytesToHex(v604);
        }
      };
    })();
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/browser.js":
  /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/browser.js ***!
  \**************************************************/
  /*! no static exports found */
  /***/
  function (p1232, p1233, p1234) {
    // browser.js
    p1233.encode = p1234(/*! ./encode */
    "./node_modules/msgpack-lite/lib/encode.js").encode;
    p1233.decode = p1234(/*! ./decode */
    "./node_modules/msgpack-lite/lib/decode.js").decode;
    p1233.Encoder = p1234(/*! ./encoder */
    "./node_modules/msgpack-lite/lib/encoder.js").Encoder;
    p1233.Decoder = p1234(/*! ./decoder */
    "./node_modules/msgpack-lite/lib/decoder.js").Decoder;
    p1233.createCodec = p1234(/*! ./ext */
    "./node_modules/msgpack-lite/lib/ext.js").createCodec;
    p1233.codec = p1234(/*! ./codec */
    "./node_modules/msgpack-lite/lib/codec.js").codec;
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/buffer-global.js":
  /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/buffer-global.js ***!
  \********************************************************/
  /*! no static exports found */
  /***/
  function (p1235, p1236, p1237) {
    /* WEBPACK VAR INJECTION */
    (function (p1238) {
      /* globals Buffer */
      p1235.exports = f410(typeof p1238 !== "undefined" && p1238) || f410(this.Buffer) || f410(typeof window !== "undefined" && window.Buffer) || this.Buffer;
      function f410(p1239) {
        return p1239 && p1239.isBuffer && p1239;
      }
      /* WEBPACK VAR INJECTION */
    }).call(this, p1237(/*! ./../../buffer/index.js */
    "./node_modules/buffer/index.js").Buffer);
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/buffer-lite.js":
  /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/buffer-lite.js ***!
  \******************************************************/
  /*! no static exports found */
  /***/
  function (p1240, p1241) {
    // buffer-lite.js
    var vLN8192 = 8192;
    p1241.copy = f413;
    p1241.toString = f412;
    p1241.write = f411;
    /**
         * Buffer.prototype.write()
         *
         * @param string {String}
         * @param [offset] {Number}
         * @returns {Number}
         */
    function f411(p1242, p1243) {
      var vThis9 = this;
      var v605 = p1243 || (p1243 |= 0);
      var v606 = p1242.length;
      var vLN096 = 0;
      var vLN097 = 0;
      while (vLN097 < v606) {
        vLN096 = p1242.charCodeAt(vLN097++);
        if (vLN096 < 128) {
          vThis9[v605++] = vLN096;
        } else if (vLN096 < 2048) {
          // 2 bytes
          vThis9[v605++] = vLN096 >>> 6 | 192;
          vThis9[v605++] = vLN096 & 63 | 128;
        } else if (vLN096 < 55296 || vLN096 > 57343) {
          // 3 bytes
          vThis9[v605++] = vLN096 >>> 12 | 224;
          vThis9[v605++] = vLN096 >>> 6 & 63 | 128;
          vThis9[v605++] = vLN096 & 63 | 128;
        } else {
          // 4 bytes - surrogate pair
          vLN096 = (vLN096 - 55296 << 10 | p1242.charCodeAt(vLN097++) - 56320) + 65536;
          vThis9[v605++] = vLN096 >>> 18 | 240;
          vThis9[v605++] = vLN096 >>> 12 & 63 | 128;
          vThis9[v605++] = vLN096 >>> 6 & 63 | 128;
          vThis9[v605++] = vLN096 & 63 | 128;
        }
      }
      return v605 - p1243;
    }
    /**
         * Buffer.prototype.toString()
         *
         * @param [encoding] {String} ignored
         * @param [start] {Number}
         * @param [end] {Number}
         * @returns {String}
         */
    function f412(p1244, p1245, p1246) {
      var vThis10 = this;
      var v607 = p1245 | 0;
      if (!p1246) {
        p1246 = vThis10.length;
      }
      var vLS18 = "";
      var vLN098 = 0;
      while (v607 < p1246) {
        vLN098 = vThis10[v607++];
        if (vLN098 < 128) {
          vLS18 += String.fromCharCode(vLN098);
          continue;
        }
        if ((vLN098 & 224) === 192) {
          // 2 bytes
          vLN098 = (vLN098 & 31) << 6 | vThis10[v607++] & 63;
        } else if ((vLN098 & 240) === 224) {
          // 3 bytes
          vLN098 = (vLN098 & 15) << 12 | (vThis10[v607++] & 63) << 6 | vThis10[v607++] & 63;
        } else if ((vLN098 & 248) === 240) {
          // 4 bytes
          vLN098 = (vLN098 & 7) << 18 | (vThis10[v607++] & 63) << 12 | (vThis10[v607++] & 63) << 6 | vThis10[v607++] & 63;
        }
        if (vLN098 >= 65536) {
          // A surrogate pair
          vLN098 -= 65536;
          vLS18 += String.fromCharCode((vLN098 >>> 10) + 55296, (vLN098 & 1023) + 56320);
        } else {
          vLS18 += String.fromCharCode(vLN098);
        }
      }
      return vLS18;
    }
    /**
         * Buffer.prototype.copy()
         *
         * @param target {Buffer}
         * @param [targetStart] {Number}
         * @param [start] {Number}
         * @param [end] {Number}
         * @returns {number}
         */
    function f413(p1247, p1248, p1249, p1250) {
      var v608;
      if (!p1249) {
        p1249 = 0;
      }
      if (!p1250 && p1250 !== 0) {
        p1250 = this.length;
      }
      if (!p1248) {
        p1248 = 0;
      }
      var v609 = p1250 - p1249;
      if (p1247 === this && p1249 < p1248 && p1248 < p1250) {
        // descending
        for (v608 = v609 - 1; v608 >= 0; v608--) {
          p1247[v608 + p1248] = this[v608 + p1249];
        }
      } else {
        // ascending
        for (v608 = 0; v608 < v609; v608++) {
          p1247[v608 + p1248] = this[v608 + p1249];
        }
      }
      return v609;
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/bufferish-array.js":
  /*!**********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-array.js ***!
  \**********************************************************/
  /*! no static exports found */
  /***/
  function (p1251, v610, p1253) {
    // bufferish-array.js
    var vP1253 = p1253(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v610 = p1251.exports = f414(0);
    v610.alloc = f414;
    v610.concat = vP1253.concat;
    v610.from = f415;
    /**
         * @param size {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f414(p1254) {
      return new Array(p1254);
    }
    /**
         * @param value {Array|ArrayBuffer|Buffer|String}
         * @returns {Array}
         */
    function f415(p1255) {
      if (!vP1253.isBuffer(p1255) && vP1253.isView(p1255)) {
        // TypedArray to Uint8Array
        p1255 = vP1253.Uint8Array.from(p1255);
      } else if (vP1253.isArrayBuffer(p1255)) {
        // ArrayBuffer to Uint8Array
        p1255 = new Uint8Array(p1255);
      } else if (typeof p1255 === "string") {
        // String to Array
        return vP1253.from.call(v610, p1255);
      } else if (typeof p1255 === "number") {
        throw new TypeError("\"value\" argument must not be a number");
      }
      // Array-like to Array
      return Array.prototype.slice.call(p1255);
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/bufferish-buffer.js":
  /*!***********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-buffer.js ***!
  \***********************************************************/
  /*! no static exports found */
  /***/
  function (p1256, v612, p1258) {
    // bufferish-buffer.js
    var vP1258 = p1258(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v611 = vP1258.global;
    var v612 = p1256.exports = vP1258.hasBuffer ? f416(0) : [];
    v612.alloc = vP1258.hasBuffer && v611.alloc || f416;
    v612.concat = vP1258.concat;
    v612.from = f417;
    /**
         * @param size {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f416(p1259) {
      return new v611(p1259);
    }
    /**
         * @param value {Array|ArrayBuffer|Buffer|String}
         * @returns {Buffer}
         */
    function f417(p1260) {
      if (!vP1258.isBuffer(p1260) && vP1258.isView(p1260)) {
        // TypedArray to Uint8Array
        p1260 = vP1258.Uint8Array.from(p1260);
      } else if (vP1258.isArrayBuffer(p1260)) {
        // ArrayBuffer to Uint8Array
        p1260 = new Uint8Array(p1260);
      } else if (typeof p1260 === "string") {
        // String to Buffer
        return vP1258.from.call(v612, p1260);
      } else if (typeof p1260 === "number") {
        throw new TypeError("\"value\" argument must not be a number");
      }
      // Array-like to Buffer
      if (v611.from && v611.from.length !== 1) {
        return v611.from(p1260);
        // node v6+
      } else {
        return new v611(p1260);
        // node v4
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/bufferish-proto.js":
  /*!**********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-proto.js ***!
  \**********************************************************/
  /*! no static exports found */
  /***/
  function (p1261, p1262, p1263) {
    // bufferish-proto.js
    /* jshint eqnull:true */
    var vP1263 = p1263(/*! ./buffer-lite */
    "./node_modules/msgpack-lite/lib/buffer-lite.js");
    p1262.copy = f418;
    p1262.slice = f419;
    p1262.toString = f420;
    p1262.write = f421("write");
    var vP12632 = p1263(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v613 = vP12632.global;
    var v614 = vP12632.hasBuffer && "TYPED_ARRAY_SUPPORT" in v613;
    var v615 = v614 && !v613.TYPED_ARRAY_SUPPORT;
    /**
         * @param target {Buffer|Uint8Array|Array}
         * @param [targetStart] {Number}
         * @param [start] {Number}
         * @param [end] {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f418(p1264, p1265, p1266, p1267) {
      var v616 = vP12632.isBuffer(this);
      var v617 = vP12632.isBuffer(p1264);
      if (v616 && v617) {
        // Buffer to Buffer
        return this.copy(p1264, p1265, p1266, p1267);
      } else if (!v615 && !v616 && !v617 && vP12632.isView(this) && vP12632.isView(p1264)) {
        // Uint8Array to Uint8Array (except for minor some browsers)
        var v618 = p1266 || p1267 != null ? f419.call(this, p1266, p1267) : this;
        p1264.set(v618, p1265);
        return v618.length;
      } else {
        // other cases
        return vP1263.copy.call(this, p1264, p1265, p1266, p1267);
      }
    }
    /**
         * @param [start] {Number}
         * @param [end] {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f419(p1268, p1269) {
      // for Buffer, Uint8Array (except for minor some browsers) and Array
      var v619 = this.slice || !v615 && this.subarray;
      if (v619) {
        return v619.call(this, p1268, p1269);
      }
      // Uint8Array (for minor some browsers)
      var v620 = vP12632.alloc.call(this, p1269 - p1268);
      f418.call(this, v620, 0, p1268, p1269);
      return v620;
    }
    /**
         * Buffer.prototype.toString()
         *
         * @param [encoding] {String} ignored
         * @param [start] {Number}
         * @param [end] {Number}
         * @returns {String}
         */
    function f420(p1270, p1271, p1272) {
      var v621 = !v614 && vP12632.isBuffer(this) ? this.toString : vP1263.toString;
      return v621.apply(this, arguments);
    }
    /**
         * @private
         */
    function f421(p1273) {
      return f422;
      function f422() {
        var v622 = this[p1273] || vP1263[p1273];
        return v622.apply(this, arguments);
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/bufferish-uint8array.js":
  /*!***************************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-uint8array.js ***!
  \***************************************************************/
  /*! no static exports found */
  /***/
  function (p1274, v623, p1276) {
    // bufferish-uint8array.js
    var vP1276 = p1276(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v623 = p1274.exports = vP1276.hasArrayBuffer ? f423(0) : [];
    v623.alloc = f423;
    v623.concat = vP1276.concat;
    v623.from = f424;
    /**
         * @param size {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f423(p1277) {
      return new Uint8Array(p1277);
    }
    /**
         * @param value {Array|ArrayBuffer|Buffer|String}
         * @returns {Uint8Array}
         */
    function f424(p1278) {
      if (vP1276.isView(p1278)) {
        // TypedArray to ArrayBuffer
        var v624 = p1278.byteOffset;
        var v625 = p1278.byteLength;
        p1278 = p1278.buffer;
        if (p1278.byteLength !== v625) {
          if (p1278.slice) {
            p1278 = p1278.slice(v624, v624 + v625);
          } else {
            // Android 4.1 does not have ArrayBuffer.prototype.slice
            p1278 = new Uint8Array(p1278);
            if (p1278.byteLength !== v625) {
              // TypedArray to ArrayBuffer to Uint8Array to Array
              p1278 = Array.prototype.slice.call(p1278, v624, v624 + v625);
            }
          }
        }
      } else if (typeof p1278 === "string") {
        // String to Uint8Array
        return vP1276.from.call(v623, p1278);
      } else if (typeof p1278 === "number") {
        throw new TypeError("\"value\" argument must not be a number");
      }
      return new Uint8Array(p1278);
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/bufferish.js":
  /*!****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish.js ***!
  \****************************************************/
  /*! no static exports found */
  /***/
  function (p1279, p1280, p1281) {
    // bufferish.js
    var v626 = p1280.global = p1281(/*! ./buffer-global */
    "./node_modules/msgpack-lite/lib/buffer-global.js");
    var v627 = p1280.hasBuffer = v626 && !!v626.isBuffer;
    var v628 = p1280.hasArrayBuffer = typeof ArrayBuffer !== "undefined";
    var v629 = p1280.isArray = p1281(/*! isarray */
    "./node_modules/msgpack-lite/node_modules/isarray/index.js");
    p1280.isArrayBuffer = v628 ? f430 : f433;
    var v630 = p1280.isBuffer = v627 ? v626.isBuffer : f433;
    var v631 = p1280.isView = v628 ? ArrayBuffer.isView || f434("ArrayBuffer", "buffer") : f433;
    p1280.alloc = f426;
    p1280.concat = f427;
    p1280.from = f425;
    var v632 = p1280.Array = p1281(/*! ./bufferish-array */
    "./node_modules/msgpack-lite/lib/bufferish-array.js");
    var v633 = p1280.Buffer = p1281(/*! ./bufferish-buffer */
    "./node_modules/msgpack-lite/lib/bufferish-buffer.js");
    var v634 = p1280.Uint8Array = p1281(/*! ./bufferish-uint8array */
    "./node_modules/msgpack-lite/lib/bufferish-uint8array.js");
    var v635 = p1280.prototype = p1281(/*! ./bufferish-proto */
    "./node_modules/msgpack-lite/lib/bufferish-proto.js");
    /**
         * @param value {Array|ArrayBuffer|Buffer|String}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f425(p1282) {
      if (typeof p1282 === "string") {
        return f431.call(this, p1282);
      } else {
        return f432(this).from(p1282);
      }
    }
    /**
         * @param size {Number}
         * @returns {Buffer|Uint8Array|Array}
         */
    function f426(p1283) {
      return f432(this).alloc(p1283);
    }
    /**
         * @param list {Array} array of (Buffer|Uint8Array|Array)s
         * @param [length]
         * @returns {Buffer|Uint8Array|Array}
         */
    function f427(p1284, p1285) {
      if (!p1285) {
        p1285 = 0;
        Array.prototype.forEach.call(p1284, f428);
      }
      var v636 = this !== p1280 && this || p1284[0];
      var v637 = f426.call(v636, p1285);
      var vLN099 = 0;
      Array.prototype.forEach.call(p1284, f429);
      return v637;
      function f428(p1286) {
        p1285 += p1286.length;
      }
      function f429(p1287) {
        vLN099 += v635.copy.call(p1287, v637, vLN099);
      }
    }
    var v_is = f434("ArrayBuffer");
    function f430(p1288) {
      return p1288 instanceof ArrayBuffer || v_is(p1288);
    }
    /**
         * @private
         */
    function f431(p1289) {
      var v638 = p1289.length * 3;
      var v639 = f426.call(this, v638);
      var v640 = v635.write.call(v639, p1289);
      if (v638 !== v640) {
        v639 = v635.slice.call(v639, 0, v640);
      }
      return v639;
    }
    function f432(p1290) {
      if (v630(p1290)) {
        return v633;
      } else if (v631(p1290)) {
        return v634;
      } else if (v629(p1290)) {
        return v632;
      } else if (v627) {
        return v633;
      } else if (v628) {
        return v634;
      } else {
        return v632;
      }
    }
    function f433() {
      return false;
    }
    function f434(p1291, p1292) {
      /* jshint eqnull:true */
      p1291 = "[object " + p1291 + "]";
      return function (p1293) {
        return p1293 != null && {}.toString.call(p1292 ? p1293[p1292] : p1293) === p1291;
      };
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/codec-base.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/codec-base.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1294, p1295, p1296) {
    // codec-base.js
    var vP1296 = p1296(/*! isarray */
    "./node_modules/msgpack-lite/node_modules/isarray/index.js");
    p1295.createCodec = f442;
    p1295.install = f436;
    p1295.filter = filter;
    var vP12962 = p1296(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    function f435(p1297) {
      if (!(this instanceof f435)) {
        return new f435(p1297);
      }
      this.options = p1297;
      this.init();
    }
    f435.prototype.init = function () {
      var v641 = this.options;
      if (v641 && v641.uint8array) {
        this.bufferish = vP12962.Uint8Array;
      }
      return this;
    };
    function f436(p1298) {
      for (var v642 in p1298) {
        f435.prototype[v642] = f437(f435.prototype[v642], p1298[v642]);
      }
    }
    function f437(p1299, p1300) {
      if (p1299 && p1300) {
        return f438;
      } else {
        return p1299 || p1300;
      }
      function f438() {
        p1299.apply(this, arguments);
        return p1300.apply(this, arguments);
      }
    }
    function f439(p1301) {
      p1301 = p1301.slice();
      return function (p1302) {
        return p1301.reduce(f440, p1302);
      };
      function f440(p1303, p1304) {
        return p1304(p1303);
      }
    }
    function filter(p1305) {
      if (vP1296(p1305)) {
        return f439(p1305);
      } else {
        return p1305;
      }
    }
    // @public
    // msgpack.createCodec()
    function f442(p1306) {
      return new f435(p1306);
    }
    // default shared codec
    p1295.preset = f442({
      preset: true
    });
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/codec.js":
  /*!************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/codec.js ***!
  \************************************************/
  /*! no static exports found */
  /***/
  function (p1307, p1308, p1309) {
    // codec.js
    // load both interfaces
    p1309(/*! ./read-core */
    "./node_modules/msgpack-lite/lib/read-core.js");
    p1309(/*! ./write-core */
    "./node_modules/msgpack-lite/lib/write-core.js");
    // @public
    // msgpack.codec.preset
    p1308.codec = {
      preset: p1309(/*! ./codec-base */
      "./node_modules/msgpack-lite/lib/codec-base.js").preset
    };
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/decode-buffer.js":
  /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decode-buffer.js ***!
  \********************************************************/
  /*! no static exports found */
  /***/
  function (p1310, p1311, p1312) {
    // decode-buffer.js
    p1311.DecodeBuffer = f443;
    var v643 = p1312(/*! ./read-core */
    "./node_modules/msgpack-lite/lib/read-core.js").preset;
    var v644 = p1312(/*! ./flex-buffer */
    "./node_modules/msgpack-lite/lib/flex-buffer.js").FlexDecoder;
    v644.mixin(f443.prototype);
    function f443(p1313) {
      if (!(this instanceof f443)) {
        return new f443(p1313);
      }
      if (p1313) {
        this.options = p1313;
        if (p1313.codec) {
          var v645 = this.codec = p1313.codec;
          if (v645.bufferish) {
            this.bufferish = v645.bufferish;
          }
        }
      }
    }
    f443.prototype.codec = v643;
    f443.prototype.fetch = function () {
      return this.codec.decode(this);
    };
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/decode.js":
  /*!*************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decode.js ***!
  \*************************************************/
  /*! no static exports found */
  /***/
  function (p1314, p1315, p1316) {
    // decode.js
    p1315.decode = f444;
    var v646 = p1316(/*! ./decode-buffer */
    "./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;
    function f444(p1317, p1318) {
      var v647 = new v646(p1318);
      v647.write(p1317);
      return v647.read();
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/decoder.js":
  /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decoder.js ***!
  \**************************************************/
  /*! no static exports found */
  /***/
  function (p1319, p1320, p1321) {
    // decoder.js
    p1320.Decoder = f445;
    var vP1321 = p1321(/*! event-lite */
    "./node_modules/event-lite/event-lite.js");
    var v648 = p1321(/*! ./decode-buffer */
    "./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;
    function f445(p1322) {
      if (!(this instanceof f445)) {
        return new f445(p1322);
      }
      v648.call(this, p1322);
    }
    f445.prototype = new v648();
    vP1321.mixin(f445.prototype);
    f445.prototype.decode = function (p1323) {
      if (arguments.length) {
        this.write(p1323);
      }
      this.flush();
    };
    f445.prototype.push = function (p1324) {
      this.emit("data", p1324);
    };
    f445.prototype.end = function (p1325) {
      this.decode(p1325);
      this.emit("end");
    };
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/encode-buffer.js":
  /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encode-buffer.js ***!
  \********************************************************/
  /*! no static exports found */
  /***/
  function (p1326, p1327, p1328) {
    // encode-buffer.js
    p1327.EncodeBuffer = f446;
    var v649 = p1328(/*! ./write-core */
    "./node_modules/msgpack-lite/lib/write-core.js").preset;
    var v650 = p1328(/*! ./flex-buffer */
    "./node_modules/msgpack-lite/lib/flex-buffer.js").FlexEncoder;
    v650.mixin(f446.prototype);
    function f446(p1329) {
      if (!(this instanceof f446)) {
        return new f446(p1329);
      }
      if (p1329) {
        this.options = p1329;
        if (p1329.codec) {
          var v651 = this.codec = p1329.codec;
          if (v651.bufferish) {
            this.bufferish = v651.bufferish;
          }
        }
      }
    }
    f446.prototype.codec = v649;
    f446.prototype.write = function (p1330) {
      this.codec.encode(this, p1330);
    };
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/encode.js":
  /*!*************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encode.js ***!
  \*************************************************/
  /*! no static exports found */
  /***/
  function (p1331, p1332, p1333) {
    // encode.js
    p1332.encode = f447;
    var v652 = p1333(/*! ./encode-buffer */
    "./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;
    function f447(p1334, p1335) {
      var v653 = new v652(p1335);
      v653.write(p1334);
      return v653.read();
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/encoder.js":
  /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encoder.js ***!
  \**************************************************/
  /*! no static exports found */
  /***/
  function (p1336, p1337, p1338) {
    // encoder.js
    p1337.Encoder = f448;
    var vP1338 = p1338(/*! event-lite */
    "./node_modules/event-lite/event-lite.js");
    var v654 = p1338(/*! ./encode-buffer */
    "./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;
    function f448(p1339) {
      if (!(this instanceof f448)) {
        return new f448(p1339);
      }
      v654.call(this, p1339);
    }
    f448.prototype = new v654();
    vP1338.mixin(f448.prototype);
    f448.prototype.encode = function (p1340) {
      this.write(p1340);
      this.emit("data", this.read());
    };
    f448.prototype.end = function (p1341) {
      if (arguments.length) {
        this.encode(p1341);
      }
      this.flush();
      this.emit("end");
    };
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/ext-buffer.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-buffer.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1342, p1343, p1344) {
    // ext-buffer.js
    p1343.ExtBuffer = f449;
    var vP1344 = p1344(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    function f449(p1345, p1346) {
      if (!(this instanceof f449)) {
        return new f449(p1345, p1346);
      }
      this.buffer = vP1344.from(p1345);
      this.type = p1346;
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/ext-packer.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-packer.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1347, p1348, p1349) {
    // ext-packer.js
    p1348.setExtPackers = f450;
    var vP1349 = p1349(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v655 = vP1349.global;
    var v656 = vP1349.Uint8Array.from;
    var v657;
    var vO20 = {
      name: 1,
      message: 1,
      stack: 1,
      columnNumber: 1,
      fileName: 1,
      lineNumber: 1
    };
    function f450(p1350) {
      p1350.addExtPacker(14, Error, [f454, f451]);
      p1350.addExtPacker(1, EvalError, [f454, f451]);
      p1350.addExtPacker(2, RangeError, [f454, f451]);
      p1350.addExtPacker(3, ReferenceError, [f454, f451]);
      p1350.addExtPacker(4, SyntaxError, [f454, f451]);
      p1350.addExtPacker(5, TypeError, [f454, f451]);
      p1350.addExtPacker(6, URIError, [f454, f451]);
      p1350.addExtPacker(10, RegExp, [f453, f451]);
      p1350.addExtPacker(11, Boolean, [f452, f451]);
      p1350.addExtPacker(12, String, [f452, f451]);
      p1350.addExtPacker(13, Date, [Number, f451]);
      p1350.addExtPacker(15, Number, [f452, f451]);
      if (typeof Uint8Array !== "undefined") {
        p1350.addExtPacker(17, Int8Array, v656);
        p1350.addExtPacker(18, Uint8Array, v656);
        p1350.addExtPacker(19, Int16Array, v656);
        p1350.addExtPacker(20, Uint16Array, v656);
        p1350.addExtPacker(21, Int32Array, v656);
        p1350.addExtPacker(22, Uint32Array, v656);
        p1350.addExtPacker(23, Float32Array, v656);
        // PhantomJS/1.9.7 doesn't have Float64Array
        if (typeof Float64Array !== "undefined") {
          p1350.addExtPacker(24, Float64Array, v656);
        }
        // IE10 doesn't have Uint8ClampedArray
        if (typeof Uint8ClampedArray !== "undefined") {
          p1350.addExtPacker(25, Uint8ClampedArray, v656);
        }
        p1350.addExtPacker(26, ArrayBuffer, v656);
        p1350.addExtPacker(29, DataView, v656);
      }
      if (vP1349.hasBuffer) {
        p1350.addExtPacker(27, v655, vP1349.from);
      }
    }
    function f451(p1351) {
      if (!v657) {
        v657 = p1349(/*! ./encode */
        "./node_modules/msgpack-lite/lib/encode.js").encode;
      }
      // lazy load
      return v657(p1351);
    }
    function f452(p1352) {
      return p1352.valueOf();
    }
    function f453(p1353) {
      p1353 = RegExp.prototype.toString.call(p1353).split("/");
      p1353.shift();
      var vA34 = [p1353.pop()];
      vA34.unshift(p1353.join("/"));
      return vA34;
    }
    function f454(p1354) {
      var vO21 = {};
      for (var v658 in vO20) {
        vO21[v658] = p1354[v658];
      }
      return vO21;
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/ext-unpacker.js":
  /*!*******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-unpacker.js ***!
  \*******************************************************/
  /*! no static exports found */
  /***/
  function (p1355, p1356, p1357) {
    // ext-unpacker.js
    p1356.setExtUnpackers = f455;
    var vP1357 = p1357(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v659 = vP1357.global;
    var v660;
    var vO22 = {
      name: 1,
      message: 1,
      stack: 1,
      columnNumber: 1,
      fileName: 1,
      lineNumber: 1
    };
    function f455(p1358) {
      p1358.addExtUnpacker(14, [f456, f458(Error)]);
      p1358.addExtUnpacker(1, [f456, f458(EvalError)]);
      p1358.addExtUnpacker(2, [f456, f458(RangeError)]);
      p1358.addExtUnpacker(3, [f456, f458(ReferenceError)]);
      p1358.addExtUnpacker(4, [f456, f458(SyntaxError)]);
      p1358.addExtUnpacker(5, [f456, f458(TypeError)]);
      p1358.addExtUnpacker(6, [f456, f458(URIError)]);
      p1358.addExtUnpacker(10, [f456, f457]);
      p1358.addExtUnpacker(11, [f456, f459(Boolean)]);
      p1358.addExtUnpacker(12, [f456, f459(String)]);
      p1358.addExtUnpacker(13, [f456, f459(Date)]);
      p1358.addExtUnpacker(15, [f456, f459(Number)]);
      if (typeof Uint8Array !== "undefined") {
        p1358.addExtUnpacker(17, f459(Int8Array));
        p1358.addExtUnpacker(18, f459(Uint8Array));
        p1358.addExtUnpacker(19, [f460, f459(Int16Array)]);
        p1358.addExtUnpacker(20, [f460, f459(Uint16Array)]);
        p1358.addExtUnpacker(21, [f460, f459(Int32Array)]);
        p1358.addExtUnpacker(22, [f460, f459(Uint32Array)]);
        p1358.addExtUnpacker(23, [f460, f459(Float32Array)]);
        // PhantomJS/1.9.7 doesn't have Float64Array
        if (typeof Float64Array !== "undefined") {
          p1358.addExtUnpacker(24, [f460, f459(Float64Array)]);
        }
        // IE10 doesn't have Uint8ClampedArray
        if (typeof Uint8ClampedArray !== "undefined") {
          p1358.addExtUnpacker(25, f459(Uint8ClampedArray));
        }
        p1358.addExtUnpacker(26, f460);
        p1358.addExtUnpacker(29, [f460, f459(DataView)]);
      }
      if (vP1357.hasBuffer) {
        p1358.addExtUnpacker(27, f459(v659));
      }
    }
    function f456(p1359) {
      if (!v660) {
        v660 = p1357(/*! ./decode */
        "./node_modules/msgpack-lite/lib/decode.js").decode;
      }
      // lazy load
      return v660(p1359);
    }
    function f457(p1360) {
      return RegExp.apply(null, p1360);
    }
    function f458(p1361) {
      return function (p1362) {
        var v661 = new p1361();
        for (var v662 in vO22) {
          v661[v662] = p1362[v662];
        }
        return v661;
      };
    }
    function f459(p1363) {
      return function (p1364) {
        return new p1363(p1364);
      };
    }
    function f460(p1365) {
      return new Uint8Array(p1365).buffer;
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/ext.js":
  /*!**********************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext.js ***!
  \**********************************************/
  /*! no static exports found */
  /***/
  function (p1366, p1367, p1368) {
    // ext.js
    // load both interfaces
    p1368(/*! ./read-core */
    "./node_modules/msgpack-lite/lib/read-core.js");
    p1368(/*! ./write-core */
    "./node_modules/msgpack-lite/lib/write-core.js");
    p1367.createCodec = p1368(/*! ./codec-base */
    "./node_modules/msgpack-lite/lib/codec-base.js").createCodec;
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/flex-buffer.js":
  /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/flex-buffer.js ***!
  \******************************************************/
  /*! no static exports found */
  /***/
  function (p1369, p1370, p1371) {
    // flex-buffer.js
    p1370.FlexDecoder = f461;
    p1370.FlexEncoder = f462;
    var vP1371 = p1371(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var vLN20482 = 2048;
    var vLN655362 = 65536;
    var vLSBUFFER_SHORTAGE2 = "BUFFER_SHORTAGE";
    function f461() {
      if (!(this instanceof f461)) {
        return new f461();
      }
    }
    function f462() {
      if (!(this instanceof f462)) {
        return new f462();
      }
    }
    f461.mixin = f478(f463());
    f461.mixin(f461.prototype);
    f462.mixin = f478(f467());
    f462.mixin(f462.prototype);
    function f463() {
      return {
        bufferish: vP1371,
        write: f464,
        fetch: f474,
        flush: f465,
        push: f476,
        pull: f477,
        read: f475,
        reserve: f466,
        offset: 0
      };
      function f464(p1372) {
        var v663 = this.offset ? vP1371.prototype.slice.call(this.buffer, this.offset) : this.buffer;
        this.buffer = v663 ? p1372 ? this.bufferish.concat([v663, p1372]) : v663 : p1372;
        this.offset = 0;
      }
      function f465() {
        while (this.offset < this.buffer.length) {
          var v664 = this.offset;
          var v665;
          try {
            v665 = this.fetch();
          } catch (e5) {
            if (e5 && e5.message != vLSBUFFER_SHORTAGE2) {
              throw e5;
            }
            // rollback
            this.offset = v664;
            break;
          }
          this.push(v665);
        }
      }
      function f466(p1373) {
        var v666 = this.offset;
        var v667 = v666 + p1373;
        if (v667 > this.buffer.length) {
          throw new Error(vLSBUFFER_SHORTAGE2);
        }
        this.offset = v667;
        return v666;
      }
    }
    function f467() {
      return {
        bufferish: vP1371,
        write: f473,
        fetch: f468,
        flush: f469,
        push: f476,
        pull: f470,
        read: f475,
        reserve: f471,
        send: f472,
        maxBufferSize: vLN655362,
        minBufferSize: vLN20482,
        offset: 0,
        start: 0
      };
      function f468() {
        var v668 = this.start;
        if (v668 < this.offset) {
          var v669 = this.start = this.offset;
          return vP1371.prototype.slice.call(this.buffer, v668, v669);
        }
      }
      function f469() {
        while (this.start < this.offset) {
          var v670 = this.fetch();
          if (v670) {
            this.push(v670);
          }
        }
      }
      function f470() {
        var v671 = this.buffers ||= [];
        var v672 = v671.length > 1 ? this.bufferish.concat(v671) : v671[0];
        v671.length = 0;
        // buffer exhausted
        return v672;
      }
      function f471(p1374) {
        var v673 = p1374 | 0;
        if (this.buffer) {
          var v674 = this.buffer.length;
          var v675 = this.offset | 0;
          var v676 = v675 + v673;
          // is it long enough?
          if (v676 < v674) {
            this.offset = v676;
            return v675;
          }
          // flush current buffer
          this.flush();
          // resize it to 2x current length
          p1374 = Math.max(p1374, Math.min(v674 * 2, this.maxBufferSize));
        }
        // minimum buffer size
        p1374 = Math.max(p1374, this.minBufferSize);
        // allocate new buffer
        this.buffer = this.bufferish.alloc(p1374);
        this.start = 0;
        this.offset = v673;
        return 0;
      }
      function f472(p1375) {
        var v677 = p1375.length;
        if (v677 > this.minBufferSize) {
          this.flush();
          this.push(p1375);
        } else {
          var v678 = this.reserve(v677);
          vP1371.prototype.copy.call(p1375, this.buffer, v678);
        }
      }
    }
    // common methods
    function f473() {
      throw new Error("method not implemented: write()");
    }
    function f474() {
      throw new Error("method not implemented: fetch()");
    }
    function f475() {
      var v679 = this.buffers && this.buffers.length;
      // fetch the first result
      if (!v679) {
        return this.fetch();
      }
      // flush current buffer
      this.flush();
      // read from the results
      return this.pull();
    }
    function f476(p1376) {
      var v680 = this.buffers ||= [];
      v680.push(p1376);
    }
    function f477() {
      var v681 = this.buffers ||= [];
      return v681.shift();
    }
    function f478(p1377) {
      return f479;
      function f479(p1378) {
        for (var v682 in p1377) {
          p1378[v682] = p1377[v682];
        }
        return p1378;
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/read-core.js":
  /*!****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-core.js ***!
  \****************************************************/
  /*! no static exports found */
  /***/
  function (p1379, p1380, p1381) {
    // read-core.js
    var v683 = p1381(/*! ./ext-buffer */
    "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var vP1381 = p1381(/*! ./ext-unpacker */
    "./node_modules/msgpack-lite/lib/ext-unpacker.js");
    var v684 = p1381(/*! ./read-format */
    "./node_modules/msgpack-lite/lib/read-format.js").readUint8;
    var vP13812 = p1381(/*! ./read-token */
    "./node_modules/msgpack-lite/lib/read-token.js");
    var vP13813 = p1381(/*! ./codec-base */
    "./node_modules/msgpack-lite/lib/codec-base.js");
    vP13813.install({
      addExtUnpacker: f483,
      getExtUnpacker: f484,
      init: f482
    });
    p1380.preset = f482.call(vP13813.preset);
    function f480(p1382) {
      var v685 = vP13812.getReadToken(p1382);
      return f481;
      function f481(p1383) {
        var vV684 = v684(p1383);
        var v686 = v685[vV684];
        if (!v686) {
          throw new Error("Invalid type: " + (vV684 ? "0x" + vV684.toString(16) : vV684));
        }
        return v686(p1383);
      }
    }
    function f482() {
      var v687 = this.options;
      this.decode = f480(v687);
      if (v687 && v687.preset) {
        vP1381.setExtUnpackers(this);
      }
      return this;
    }
    function f483(p1384, p1385) {
      var v688 = this.extUnpackers ||= [];
      v688[p1384] = vP13813.filter(p1385);
    }
    function f484(p1386) {
      var v689 = this.extUnpackers ||= [];
      return v689[p1386] || f485;
      function f485(p1387) {
        return new v683(p1387, p1386);
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/read-format.js":
  /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-format.js ***!
  \******************************************************/
  /*! no static exports found */
  /***/
  function (p1388, p1389, p1390) {
    // read-format.js
    var vP1390 = p1390(/*! ieee754 */
    "./node_modules/ieee754/index.js");
    var vP13902 = p1390(/*! int64-buffer */
    "./node_modules/int64-buffer/int64-buffer.js");
    var v690 = vP13902.Uint64BE;
    var v691 = vP13902.Int64BE;
    p1389.getReadFormat = f486;
    p1389.readUint8 = f494;
    var vP13903 = p1390(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var vP13904 = p1390(/*! ./bufferish-proto */
    "./node_modules/msgpack-lite/lib/bufferish-proto.js");
    var v692 = typeof Map !== "undefined";
    var v693 = true;
    function f486(p1391) {
      var v694 = vP13903.hasArrayBuffer && p1391 && p1391.binarraybuffer;
      var v695 = p1391 && p1391.int64;
      var v696 = v692 && p1391 && p1391.usemap;
      var vO23 = {
        map: v696 ? f488 : f487,
        array: f489,
        str: f490,
        bin: v694 ? f492 : f491,
        ext: f493,
        uint8: f494,
        uint16: f496,
        uint32: f498,
        uint64: f500(8, v695 ? f503 : f501),
        int8: f495,
        int16: f497,
        int32: f499,
        int64: f500(8, v695 ? f504 : f502),
        float32: f500(4, f505),
        float64: f500(8, f506)
      };
      return vO23;
    }
    function f487(p1392, p1393) {
      var vO24 = {};
      var v697;
      var v698 = new Array(p1393);
      var v699 = new Array(p1393);
      var v700 = p1392.codec.decode;
      for (v697 = 0; v697 < p1393; v697++) {
        v698[v697] = v700(p1392);
        v699[v697] = v700(p1392);
      }
      for (v697 = 0; v697 < p1393; v697++) {
        vO24[v698[v697]] = v699[v697];
      }
      return vO24;
    }
    function f488(p1394, p1395) {
      var v701 = new Map();
      var v702;
      var v703 = new Array(p1395);
      var v704 = new Array(p1395);
      var v705 = p1394.codec.decode;
      for (v702 = 0; v702 < p1395; v702++) {
        v703[v702] = v705(p1394);
        v704[v702] = v705(p1394);
      }
      for (v702 = 0; v702 < p1395; v702++) {
        v701.set(v703[v702], v704[v702]);
      }
      return v701;
    }
    function f489(p1396, p1397) {
      var v706 = new Array(p1397);
      var v707 = p1396.codec.decode;
      for (var vLN0100 = 0; vLN0100 < p1397; vLN0100++) {
        v706[vLN0100] = v707(p1396);
      }
      return v706;
    }
    function f490(p1398, p1399) {
      var v708 = p1398.reserve(p1399);
      var v709 = v708 + p1399;
      return vP13904.toString.call(p1398.buffer, "utf-8", v708, v709);
    }
    function f491(p1400, p1401) {
      var v710 = p1400.reserve(p1401);
      var v711 = v710 + p1401;
      var v712 = vP13904.slice.call(p1400.buffer, v710, v711);
      return vP13903.from(v712);
    }
    function f492(p1402, p1403) {
      var v713 = p1402.reserve(p1403);
      var v714 = v713 + p1403;
      var v715 = vP13904.slice.call(p1402.buffer, v713, v714);
      return vP13903.Uint8Array.from(v715).buffer;
    }
    function f493(p1404, p1405) {
      var v716 = p1404.reserve(p1405 + 1);
      var v717 = p1404.buffer[v716++];
      var v718 = v716 + p1405;
      var v719 = p1404.codec.getExtUnpacker(v717);
      if (!v719) {
        throw new Error("Invalid ext type: " + (v717 ? "0x" + v717.toString(16) : v717));
      }
      var v720 = vP13904.slice.call(p1404.buffer, v716, v718);
      return v719(v720);
    }
    function f494(p1406) {
      var v721 = p1406.reserve(1);
      return p1406.buffer[v721];
    }
    function f495(p1407) {
      var v722 = p1407.reserve(1);
      var v723 = p1407.buffer[v722];
      if (v723 & 128) {
        return v723 - 256;
      } else {
        return v723;
      }
    }
    function f496(p1408) {
      var v724 = p1408.reserve(2);
      var v725 = p1408.buffer;
      return v725[v724++] << 8 | v725[v724];
    }
    function f497(p1409) {
      var v726 = p1409.reserve(2);
      var v727 = p1409.buffer;
      var v728 = v727[v726++] << 8 | v727[v726];
      if (v728 & 32768) {
        return v728 - 65536;
      } else {
        return v728;
      }
    }
    function f498(p1410) {
      var v729 = p1410.reserve(4);
      var v730 = p1410.buffer;
      return v730[v729++] * 16777216 + (v730[v729++] << 16) + (v730[v729++] << 8) + v730[v729];
    }
    function f499(p1411) {
      var v731 = p1411.reserve(4);
      var v732 = p1411.buffer;
      return v732[v731++] << 24 | v732[v731++] << 16 | v732[v731++] << 8 | v732[v731];
    }
    function f500(p1412, p1413) {
      return function (p1414) {
        var v733 = p1414.reserve(p1412);
        return p1413.call(p1414.buffer, v733, v693);
      };
    }
    function f501(p1415) {
      return new v690(this, p1415).toNumber();
    }
    function f502(p1416) {
      return new v691(this, p1416).toNumber();
    }
    function f503(p1417) {
      return new v690(this, p1417);
    }
    function f504(p1418) {
      return new v691(this, p1418);
    }
    function f505(p1419) {
      return vP1390.read(this, p1419, false, 23, 4);
    }
    function f506(p1420) {
      return vP1390.read(this, p1420, false, 52, 8);
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/read-token.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-token.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1421, p1422, p1423) {
    // read-token.js
    var vP1423 = p1423(/*! ./read-format */
    "./node_modules/msgpack-lite/lib/read-format.js");
    p1422.getReadToken = f507;
    function f507(p1424) {
      var v734 = vP1423.getReadFormat(p1424);
      if (p1424 && p1424.useraw) {
        return f509(v734);
      } else {
        return f508(v734);
      }
    }
    function f508(p1425) {
      var v735;
      var v736 = new Array(256);
      // positive fixint -- 0x00 - 0x7f
      for (v735 = 0; v735 <= 127; v735++) {
        v736[v735] = f510(v735);
      }
      // fixmap -- 0x80 - 0x8f
      for (v735 = 128; v735 <= 143; v735++) {
        v736[v735] = f512(v735 - 128, p1425.map);
      }
      // fixarray -- 0x90 - 0x9f
      for (v735 = 144; v735 <= 159; v735++) {
        v736[v735] = f512(v735 - 144, p1425.array);
      }
      // fixstr -- 0xa0 - 0xbf
      for (v735 = 160; v735 <= 191; v735++) {
        v736[v735] = f512(v735 - 160, p1425.str);
      }
      // nil -- 0xc0
      v736[192] = f510(null);
      // (never used) -- 0xc1
      v736[193] = null;
      // false -- 0xc2
      // true -- 0xc3
      v736[194] = f510(false);
      v736[195] = f510(true);
      // bin 8 -- 0xc4
      // bin 16 -- 0xc5
      // bin 32 -- 0xc6
      v736[196] = f511(p1425.uint8, p1425.bin);
      v736[197] = f511(p1425.uint16, p1425.bin);
      v736[198] = f511(p1425.uint32, p1425.bin);
      // ext 8 -- 0xc7
      // ext 16 -- 0xc8
      // ext 32 -- 0xc9
      v736[199] = f511(p1425.uint8, p1425.ext);
      v736[200] = f511(p1425.uint16, p1425.ext);
      v736[201] = f511(p1425.uint32, p1425.ext);
      // float 32 -- 0xca
      // float 64 -- 0xcb
      v736[202] = p1425.float32;
      v736[203] = p1425.float64;
      // uint 8 -- 0xcc
      // uint 16 -- 0xcd
      // uint 32 -- 0xce
      // uint 64 -- 0xcf
      v736[204] = p1425.uint8;
      v736[205] = p1425.uint16;
      v736[206] = p1425.uint32;
      v736[207] = p1425.uint64;
      // int 8 -- 0xd0
      // int 16 -- 0xd1
      // int 32 -- 0xd2
      // int 64 -- 0xd3
      v736[208] = p1425.int8;
      v736[209] = p1425.int16;
      v736[210] = p1425.int32;
      v736[211] = p1425.int64;
      // fixext 1 -- 0xd4
      // fixext 2 -- 0xd5
      // fixext 4 -- 0xd6
      // fixext 8 -- 0xd7
      // fixext 16 -- 0xd8
      v736[212] = f512(1, p1425.ext);
      v736[213] = f512(2, p1425.ext);
      v736[214] = f512(4, p1425.ext);
      v736[215] = f512(8, p1425.ext);
      v736[216] = f512(16, p1425.ext);
      // str 8 -- 0xd9
      // str 16 -- 0xda
      // str 32 -- 0xdb
      v736[217] = f511(p1425.uint8, p1425.str);
      v736[218] = f511(p1425.uint16, p1425.str);
      v736[219] = f511(p1425.uint32, p1425.str);
      // array 16 -- 0xdc
      // array 32 -- 0xdd
      v736[220] = f511(p1425.uint16, p1425.array);
      v736[221] = f511(p1425.uint32, p1425.array);
      // map 16 -- 0xde
      // map 32 -- 0xdf
      v736[222] = f511(p1425.uint16, p1425.map);
      v736[223] = f511(p1425.uint32, p1425.map);
      // negative fixint -- 0xe0 - 0xff
      for (v735 = 224; v735 <= 255; v735++) {
        v736[v735] = f510(v735 - 256);
      }
      return v736;
    }
    function f509(p1426) {
      var v737;
      var v738 = f508(p1426).slice();
      // raw 8 -- 0xd9
      // raw 16 -- 0xda
      // raw 32 -- 0xdb
      v738[217] = v738[196];
      v738[218] = v738[197];
      v738[219] = v738[198];
      // fixraw -- 0xa0 - 0xbf
      for (v737 = 160; v737 <= 191; v737++) {
        v738[v737] = f512(v737 - 160, p1426.bin);
      }
      return v738;
    }
    function f510(p1427) {
      return function () {
        return p1427;
      };
    }
    function f511(p1428, p1429) {
      return function (p1430) {
        var vP1428 = p1428(p1430);
        return p1429(p1430, vP1428);
      };
    }
    function f512(p1431, p1432) {
      return function (p1433) {
        return p1432(p1433, p1431);
      };
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/write-core.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-core.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1434, p1435, p1436) {
    // write-core.js
    var v739 = p1436(/*! ./ext-buffer */
    "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var vP1436 = p1436(/*! ./ext-packer */
    "./node_modules/msgpack-lite/lib/ext-packer.js");
    var vP14362 = p1436(/*! ./write-type */
    "./node_modules/msgpack-lite/lib/write-type.js");
    var vP14363 = p1436(/*! ./codec-base */
    "./node_modules/msgpack-lite/lib/codec-base.js");
    vP14363.install({
      addExtPacker: f516,
      getExtPacker: f518,
      init: f515
    });
    p1435.preset = f515.call(vP14363.preset);
    function f513(p1437) {
      var v740 = vP14362.getWriteType(p1437);
      return f514;
      function f514(p1438, p1439) {
        var v741 = v740[typeof p1439];
        if (!v741) {
          throw new Error("Unsupported type \"" + typeof p1439 + "\": " + p1439);
        }
        v741(p1438, p1439);
      }
    }
    function f515() {
      var v742 = this.options;
      this.encode = f513(v742);
      if (v742 && v742.preset) {
        vP1436.setExtPackers(this);
      }
      return this;
    }
    function f516(p1440, p1441, p1442) {
      p1442 = vP14363.filter(p1442);
      var v743 = p1441.name;
      if (v743 && v743 !== "Object") {
        var v744 = this.extPackers ||= {};
        v744[v743] = f517;
      } else {
        // fallback for IE
        var v745 = this.extEncoderList ||= [];
        v745.unshift([p1441, f517]);
      }
      function f517(p1443) {
        if (p1442) {
          p1443 = p1442(p1443);
        }
        return new v739(p1443, p1440);
      }
    }
    function f518(p1444) {
      var v746 = this.extPackers ||= {};
      var v747 = p1444.constructor;
      var v748 = v747 && v747.name && v746[v747.name];
      if (v748) {
        return v748;
      }
      // fallback for IE
      var v749 = this.extEncoderList ||= [];
      var v750 = v749.length;
      for (var vLN0101 = 0; vLN0101 < v750; vLN0101++) {
        var v751 = v749[vLN0101];
        if (v747 === v751[0]) {
          return v751[1];
        }
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/write-token.js":
  /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-token.js ***!
  \******************************************************/
  /*! no static exports found */
  /***/
  function (p1445, p1446, p1447) {
    // write-token.js
    var vP1447 = p1447(/*! ieee754 */
    "./node_modules/ieee754/index.js");
    var vP14472 = p1447(/*! int64-buffer */
    "./node_modules/int64-buffer/int64-buffer.js");
    var v752 = vP14472.Uint64BE;
    var v753 = vP14472.Int64BE;
    var v754 = p1447(/*! ./write-uint8 */
    "./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
    var vP14473 = p1447(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var v755 = vP14473.global;
    var v756 = vP14473.hasBuffer && "TYPED_ARRAY_SUPPORT" in v755;
    var v757 = v756 && !v755.TYPED_ARRAY_SUPPORT;
    var v758 = vP14473.hasBuffer && v755.prototype || {};
    p1446.getWriteToken = f519;
    function f519(p1448) {
      if (p1448 && p1448.uint8array) {
        return f520();
      } else if (v757 || vP14473.hasBuffer && p1448 && p1448.safe) {
        return f522();
      } else {
        return f521();
      }
    }
    function f520() {
      var vInit_token = f521();
      // float 32 -- 0xca
      // float 64 -- 0xcb
      vInit_token[202] = f526(202, 4, f529);
      vInit_token[203] = f526(203, 8, f530);
      return vInit_token;
    }
    // Node.js and browsers with TypedArray
    function f521() {
      // (immediate values)
      // positive fixint -- 0x00 - 0x7f
      // nil -- 0xc0
      // false -- 0xc2
      // true -- 0xc3
      // negative fixint -- 0xe0 - 0xff
      var v759 = v754.slice();
      // bin 8 -- 0xc4
      // bin 16 -- 0xc5
      // bin 32 -- 0xc6
      v759[196] = f523(196);
      v759[197] = f524(197);
      v759[198] = f525(198);
      // ext 8 -- 0xc7
      // ext 16 -- 0xc8
      // ext 32 -- 0xc9
      v759[199] = f523(199);
      v759[200] = f524(200);
      v759[201] = f525(201);
      // float 32 -- 0xca
      // float 64 -- 0xcb
      v759[202] = f526(202, 4, v758.writeFloatBE || f529, true);
      v759[203] = f526(203, 8, v758.writeDoubleBE || f530, true);
      // uint 8 -- 0xcc
      // uint 16 -- 0xcd
      // uint 32 -- 0xce
      // uint 64 -- 0xcf
      v759[204] = f523(204);
      v759[205] = f524(205);
      v759[206] = f525(206);
      v759[207] = f526(207, 8, f527);
      // int 8 -- 0xd0
      // int 16 -- 0xd1
      // int 32 -- 0xd2
      // int 64 -- 0xd3
      v759[208] = f523(208);
      v759[209] = f524(209);
      v759[210] = f525(210);
      v759[211] = f526(211, 8, f528);
      // str 8 -- 0xd9
      // str 16 -- 0xda
      // str 32 -- 0xdb
      v759[217] = f523(217);
      v759[218] = f524(218);
      v759[219] = f525(219);
      // array 16 -- 0xdc
      // array 32 -- 0xdd
      v759[220] = f524(220);
      v759[221] = f525(221);
      // map 16 -- 0xde
      // map 32 -- 0xdf
      v759[222] = f524(222);
      v759[223] = f525(223);
      return v759;
    }
    // safe mode: for old browsers and who needs asserts
    function f522() {
      // (immediate values)
      // positive fixint -- 0x00 - 0x7f
      // nil -- 0xc0
      // false -- 0xc2
      // true -- 0xc3
      // negative fixint -- 0xe0 - 0xff
      var v760 = v754.slice();
      // bin 8 -- 0xc4
      // bin 16 -- 0xc5
      // bin 32 -- 0xc6
      v760[196] = f526(196, 1, v755.prototype.writeUInt8);
      v760[197] = f526(197, 2, v755.prototype.writeUInt16BE);
      v760[198] = f526(198, 4, v755.prototype.writeUInt32BE);
      // ext 8 -- 0xc7
      // ext 16 -- 0xc8
      // ext 32 -- 0xc9
      v760[199] = f526(199, 1, v755.prototype.writeUInt8);
      v760[200] = f526(200, 2, v755.prototype.writeUInt16BE);
      v760[201] = f526(201, 4, v755.prototype.writeUInt32BE);
      // float 32 -- 0xca
      // float 64 -- 0xcb
      v760[202] = f526(202, 4, v755.prototype.writeFloatBE);
      v760[203] = f526(203, 8, v755.prototype.writeDoubleBE);
      // uint 8 -- 0xcc
      // uint 16 -- 0xcd
      // uint 32 -- 0xce
      // uint 64 -- 0xcf
      v760[204] = f526(204, 1, v755.prototype.writeUInt8);
      v760[205] = f526(205, 2, v755.prototype.writeUInt16BE);
      v760[206] = f526(206, 4, v755.prototype.writeUInt32BE);
      v760[207] = f526(207, 8, f527);
      // int 8 -- 0xd0
      // int 16 -- 0xd1
      // int 32 -- 0xd2
      // int 64 -- 0xd3
      v760[208] = f526(208, 1, v755.prototype.writeInt8);
      v760[209] = f526(209, 2, v755.prototype.writeInt16BE);
      v760[210] = f526(210, 4, v755.prototype.writeInt32BE);
      v760[211] = f526(211, 8, f528);
      // str 8 -- 0xd9
      // str 16 -- 0xda
      // str 32 -- 0xdb
      v760[217] = f526(217, 1, v755.prototype.writeUInt8);
      v760[218] = f526(218, 2, v755.prototype.writeUInt16BE);
      v760[219] = f526(219, 4, v755.prototype.writeUInt32BE);
      // array 16 -- 0xdc
      // array 32 -- 0xdd
      v760[220] = f526(220, 2, v755.prototype.writeUInt16BE);
      v760[221] = f526(221, 4, v755.prototype.writeUInt32BE);
      // map 16 -- 0xde
      // map 32 -- 0xdf
      v760[222] = f526(222, 2, v755.prototype.writeUInt16BE);
      v760[223] = f526(223, 4, v755.prototype.writeUInt32BE);
      return v760;
    }
    function f523(p1449) {
      return function (p1450, p1451) {
        var v761 = p1450.reserve(2);
        var v762 = p1450.buffer;
        v762[v761++] = p1449;
        v762[v761] = p1451;
      };
    }
    function f524(p1452) {
      return function (p1453, p1454) {
        var v763 = p1453.reserve(3);
        var v764 = p1453.buffer;
        v764[v763++] = p1452;
        v764[v763++] = p1454 >>> 8;
        v764[v763] = p1454;
      };
    }
    function f525(p1455) {
      return function (p1456, p1457) {
        var v765 = p1456.reserve(5);
        var v766 = p1456.buffer;
        v766[v765++] = p1455;
        v766[v765++] = p1457 >>> 24;
        v766[v765++] = p1457 >>> 16;
        v766[v765++] = p1457 >>> 8;
        v766[v765] = p1457;
      };
    }
    function f526(p1458, p1459, p1460, p1461) {
      return function (p1462, p1463) {
        var v767 = p1462.reserve(p1459 + 1);
        p1462.buffer[v767++] = p1458;
        p1460.call(p1462.buffer, p1463, v767, p1461);
      };
    }
    function f527(p1464, p1465) {
      new v752(this, p1465, p1464);
    }
    function f528(p1466, p1467) {
      new v753(this, p1467, p1466);
    }
    function f529(p1468, p1469) {
      vP1447.write(this, p1468, p1469, false, 23, 4);
    }
    function f530(p1470, p1471) {
      vP1447.write(this, p1470, p1471, false, 52, 8);
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/write-type.js":
  /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-type.js ***!
  \*****************************************************/
  /*! no static exports found */
  /***/
  function (p1472, p1473, p1474) {
    // write-type.js
    var vP1474 = p1474(/*! isarray */
    "./node_modules/msgpack-lite/node_modules/isarray/index.js");
    var vP14742 = p1474(/*! int64-buffer */
    "./node_modules/int64-buffer/int64-buffer.js");
    var v768 = vP14742.Uint64BE;
    var v769 = vP14742.Int64BE;
    var vP14743 = p1474(/*! ./bufferish */
    "./node_modules/msgpack-lite/lib/bufferish.js");
    var vP14744 = p1474(/*! ./bufferish-proto */
    "./node_modules/msgpack-lite/lib/bufferish-proto.js");
    var vP14745 = p1474(/*! ./write-token */
    "./node_modules/msgpack-lite/lib/write-token.js");
    var v770 = p1474(/*! ./write-uint8 */
    "./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
    var v771 = p1474(/*! ./ext-buffer */
    "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
    var v772 = typeof Uint8Array !== "undefined";
    var v773 = typeof Map !== "undefined";
    var vA35 = [];
    vA35[1] = 212;
    vA35[2] = 213;
    vA35[4] = 214;
    vA35[8] = 215;
    vA35[16] = 216;
    p1473.getWriteType = f531;
    function f531(p1475) {
      var v774 = vP14745.getWriteToken(p1475);
      var v775 = p1475 && p1475.useraw;
      var v776 = v772 && p1475 && p1475.binarraybuffer;
      var v777 = v776 ? vP14743.isArrayBuffer : vP14743.isBuffer;
      var v778 = v776 ? f545 : f544;
      var v779 = v773 && p1475 && p1475.usemap;
      var v780 = v779 ? f548 : f547;
      var vO25 = {
        boolean: f532,
        function: f542,
        number: f533,
        object: v775 ? f541 : f540,
        string: f538(v775 ? f537 : f536),
        symbol: f542,
        undefined: f542
      };
      return vO25;
      // false -- 0xc2
      // true -- 0xc3
      function f532(p1476, p1477) {
        var v781 = p1477 ? 195 : 194;
        v774[v781](p1476, p1477);
      }
      function f533(p1478, p1479) {
        var v782 = p1479 | 0;
        var v783;
        if (p1479 !== v782) {
          // float 64 -- 0xcb
          v783 = 203;
          v774[v783](p1478, p1479);
          return;
        } else if (v782 >= -32 && v782 <= 127) {
          // positive fixint -- 0x00 - 0x7f
          // negative fixint -- 0xe0 - 0xff
          v783 = v782 & 255;
        } else if (v782 >= 0) {
          // uint 8 -- 0xcc
          // uint 16 -- 0xcd
          // uint 32 -- 0xce
          v783 = v782 <= 255 ? 204 : v782 <= 65535 ? 205 : 206;
        } else {
          // int 8 -- 0xd0
          // int 16 -- 0xd1
          // int 32 -- 0xd2
          v783 = v782 >= -128 ? 208 : v782 >= -32768 ? 209 : 210;
        }
        v774[v783](p1478, v782);
      }
      // uint 64 -- 0xcf
      function f534(p1480, p1481) {
        var vLN2072 = 207;
        v774[vLN2072](p1480, p1481.toArray());
      }
      // int 64 -- 0xd3
      function f535(p1482, p1483) {
        var vLN2112 = 211;
        v774[vLN2112](p1482, p1483.toArray());
      }
      // str 8 -- 0xd9
      // str 16 -- 0xda
      // str 32 -- 0xdb
      // fixstr -- 0xa0 - 0xbf
      function f536(p1484) {
        if (p1484 < 32) {
          return 1;
        } else if (p1484 <= 255) {
          return 2;
        } else if (p1484 <= 65535) {
          return 3;
        } else {
          return 5;
        }
      }
      // raw 16 -- 0xda
      // raw 32 -- 0xdb
      // fixraw -- 0xa0 - 0xbf
      function f537(p1485) {
        if (p1485 < 32) {
          return 1;
        } else if (p1485 <= 65535) {
          return 3;
        } else {
          return 5;
        }
      }
      function f538(p1486) {
        return f539;
        function f539(p1487, p1488) {
          // prepare buffer
          var v784 = p1488.length;
          var v785 = 5 + v784 * 3;
          p1487.offset = p1487.reserve(v785);
          var v786 = p1487.buffer;
          // expected header size
          var vP1486 = p1486(v784);
          // expected start point
          var v787 = p1487.offset + vP1486;
          // write string
          v784 = vP14744.write.call(v786, p1488, v787);
          // actual header size
          var vP14862 = p1486(v784);
          // move content when needed
          if (vP1486 !== vP14862) {
            var v788 = v787 + vP14862 - vP1486;
            var v789 = v787 + v784;
            vP14744.copy.call(v786, v786, v788, v787, v789);
          }
          // write header
          var v790 = vP14862 === 1 ? 160 + v784 : vP14862 <= 3 ? 215 + vP14862 : 219;
          v774[v790](p1487, v784);
          // move cursor
          p1487.offset += v784;
        }
      }
      function f540(p1489, p1490) {
        // null
        if (p1490 === null) {
          return f542(p1489, p1490);
        }
        // Buffer
        if (v777(p1490)) {
          return v778(p1489, p1490);
        }
        // Array
        if (vP1474(p1490)) {
          return f543(p1489, p1490);
        }
        // int64-buffer objects
        if (v768.isUint64BE(p1490)) {
          return f534(p1489, p1490);
        }
        if (v769.isInt64BE(p1490)) {
          return f535(p1489, p1490);
        }
        // ext formats
        var v791 = p1489.codec.getExtPacker(p1490);
        if (v791) {
          p1490 = v791(p1490);
        }
        if (p1490 instanceof v771) {
          return f546(p1489, p1490);
        }
        // plain old Objects or Map
        v780(p1489, p1490);
      }
      function f541(p1491, p1492) {
        // Buffer
        if (v777(p1492)) {
          return f549(p1491, p1492);
        }
        // others
        f540(p1491, p1492);
      }
      // nil -- 0xc0
      function f542(p1493, p1494) {
        var vLN1922 = 192;
        v774[vLN1922](p1493, p1494);
      }
      // fixarray -- 0x90 - 0x9f
      // array 16 -- 0xdc
      // array 32 -- 0xdd
      function f543(p1495, p1496) {
        var v792 = p1496.length;
        var v793 = v792 < 16 ? 144 + v792 : v792 <= 65535 ? 220 : 221;
        v774[v793](p1495, v792);
        var v794 = p1495.codec.encode;
        for (var vLN0102 = 0; vLN0102 < v792; vLN0102++) {
          v794(p1495, p1496[vLN0102]);
        }
      }
      // bin 8 -- 0xc4
      // bin 16 -- 0xc5
      // bin 32 -- 0xc6
      function f544(p1497, p1498) {
        var v795 = p1498.length;
        var v796 = v795 < 255 ? 196 : v795 <= 65535 ? 197 : 198;
        v774[v796](p1497, v795);
        p1497.send(p1498);
      }
      function f545(p1499, p1500) {
        f544(p1499, new Uint8Array(p1500));
      }
      // fixext 1 -- 0xd4
      // fixext 2 -- 0xd5
      // fixext 4 -- 0xd6
      // fixext 8 -- 0xd7
      // fixext 16 -- 0xd8
      // ext 8 -- 0xc7
      // ext 16 -- 0xc8
      // ext 32 -- 0xc9
      function f546(p1501, p1502) {
        var v797 = p1502.buffer;
        var v798 = v797.length;
        var v799 = vA35[v798] || (v798 < 255 ? 199 : v798 <= 65535 ? 200 : 201);
        v774[v799](p1501, v798);
        v770[p1502.type](p1501);
        p1501.send(v797);
      }
      // fixmap -- 0x80 - 0x8f
      // map 16 -- 0xde
      // map 32 -- 0xdf
      function f547(p1503, p1504) {
        var v800 = Object.keys(p1504);
        var v801 = v800.length;
        var v802 = v801 < 16 ? 128 + v801 : v801 <= 65535 ? 222 : 223;
        v774[v802](p1503, v801);
        var v803 = p1503.codec.encode;
        v800.forEach(function (p1505) {
          v803(p1503, p1505);
          v803(p1503, p1504[p1505]);
        });
      }
      // fixmap -- 0x80 - 0x8f
      // map 16 -- 0xde
      // map 32 -- 0xdf
      function f548(p1506, p1507) {
        if (!(p1507 instanceof Map)) {
          return f547(p1506, p1507);
        }
        var v804 = p1507.size;
        var v805 = v804 < 16 ? 128 + v804 : v804 <= 65535 ? 222 : 223;
        v774[v805](p1506, v804);
        var v806 = p1506.codec.encode;
        p1507.forEach(function (p1508, p1509, p1510) {
          v806(p1506, p1509);
          v806(p1506, p1508);
        });
      }
      // raw 16 -- 0xda
      // raw 32 -- 0xdb
      // fixraw -- 0xa0 - 0xbf
      function f549(p1511, p1512) {
        var v807 = p1512.length;
        var v808 = v807 < 32 ? 160 + v807 : v807 <= 65535 ? 218 : 219;
        v774[v808](p1511, v807);
        p1511.send(p1512);
      }
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/lib/write-uint8.js":
  /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-uint8.js ***!
  \******************************************************/
  /*! no static exports found */
  /***/
  function (p1513, p1514) {
    // write-unit8.js
    var v809 = p1514.uint8 = new Array(256);
    for (var vLN0103 = 0; vLN0103 <= 255; vLN0103++) {
      v809[vLN0103] = f550(vLN0103);
    }
    function f550(p1515) {
      return function (p1516) {
        var v810 = p1516.reserve(1);
        p1516.buffer[v810] = p1515;
      };
    }
    /***/
  },
  /***/
  "./node_modules/msgpack-lite/node_modules/isarray/index.js":
  /*!*****************************************************************!*\
  !*** ./node_modules/msgpack-lite/node_modules/isarray/index.js ***!
  \*****************************************************************/
  /*! no static exports found */
  /***/
  function (p1517, p1518) {
    var v811 = {}.toString;
    p1517.exports = Array.isArray || function (p1519) {
      return v811.call(p1519) == "[object Array]";
    };
    /***/
  },
  /***/
  "./node_modules/process/browser.js":
  /*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
  /*! no static exports found */
  /***/
  function (p1520, p1521) {
    // shim for using process in browser
    var v812 = p1520.exports = {};
    // cached from whatever global is present so that test runners that stub it
    // don't break things.  But we need to wrap it in a try catch in case it is
    // wrapped in strict mode code which doesn't define any globals.  It's inside a
    // function because try/catches deoptimize in certain engines.
    var v813;
    var v814;
    function f551() {
      throw new Error("setTimeout has not been defined");
    }
    function f552() {
      throw new Error("clearTimeout has not been defined");
    }
    (function () {
      try {
        if (typeof setTimeout === "function") {
          v813 = setTimeout;
        } else {
          v813 = f551;
        }
      } catch (e6) {
        v813 = f551;
      }
      try {
        if (typeof clearTimeout === "function") {
          v814 = clearTimeout;
        } else {
          v814 = f552;
        }
      } catch (e7) {
        v814 = f552;
      }
    })();
    function f553(p1522) {
      if (v813 === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(p1522, 0);
      }
      // if setTimeout wasn't available but was latter defined
      if ((v813 === f551 || !v813) && setTimeout) {
        v813 = setTimeout;
        return setTimeout(p1522, 0);
      }
      try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return v813(p1522, 0);
      } catch (e8) {
        try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
          return v813.call(null, p1522, 0);
        } catch (e9) {
          // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
          return v813.call(this, p1522, 0);
        }
      }
    }
    function f554(p1523) {
      if (v814 === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(p1523);
      }
      // if clearTimeout wasn't available but was latter defined
      if ((v814 === f552 || !v814) && clearTimeout) {
        v814 = clearTimeout;
        return clearTimeout(p1523);
      }
      try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return v814(p1523);
      } catch (e10) {
        try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
          return v814.call(null, p1523);
        } catch (e11) {
          // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
          // Some versions of I.E. have different rules for clearTimeout vs setTimeout
          return v814.call(this, p1523);
        }
      }
    }
    var vA36 = [];
    var v815 = false;
    var v816;
    var v817 = -1;
    function f555() {
      if (!v815 || !v816) {
        return;
      }
      v815 = false;
      if (v816.length) {
        vA36 = v816.concat(vA36);
      } else {
        v817 = -1;
      }
      if (vA36.length) {
        f556();
      }
    }
    function f556() {
      if (v815) {
        return;
      }
      var vF553 = f553(f555);
      v815 = true;
      var v818 = vA36.length;
      while (v818) {
        v816 = vA36;
        vA36 = [];
        while (++v817 < v818) {
          if (v816) {
            v816[v817].run();
          }
        }
        v817 = -1;
        v818 = vA36.length;
      }
      v816 = null;
      v815 = false;
      f554(vF553);
    }
    v812.nextTick = function (p1524) {
      var v819 = new Array(arguments.length - 1);
      if (arguments.length > 1) {
        for (var vLN120 = 1; vLN120 < arguments.length; vLN120++) {
          v819[vLN120 - 1] = arguments[vLN120];
        }
      }
      vA36.push(new f557(p1524, v819));
      if (vA36.length === 1 && !v815) {
        f553(f556);
      }
    };
    // v8 likes predictible objects
    function f557(p1525, p1526) {
      this.fun = p1525;
      this.array = p1526;
    }
    f557.prototype.run = function () {
      this.fun.apply(null, this.array);
    };
    v812.title = "browser";
    v812.browser = true;
    v812.env = {};
    v812.argv = [];
    v812.version = "";
    // empty string to avoid regexp issues
    v812.versions = {};
    function f558() {}
    v812.on = f558;
    v812.addListener = f558;
    v812.once = f558;
    v812.off = f558;
    v812.removeListener = f558;
    v812.removeAllListeners = f558;
    v812.emit = f558;
    v812.prependListener = f558;
    v812.prependOnceListener = f558;
    v812.listeners = function (p1527) {
      return [];
    };
    v812.binding = function (p1528) {
      throw new Error("process.binding is not supported");
    };
    v812.cwd = function () {
      return "/";
    };
    v812.chdir = function (p1529) {
      throw new Error("process.chdir is not supported");
    };
    v812.umask = function () {
      return 0;
    };
    /***/
  },
  /***/
  "./node_modules/punycode/punycode.js":
  /*!*******************************************!*\
  !*** ./node_modules/punycode/punycode.js ***!
  \*******************************************/
  /*! no static exports found */
  /***/
  function (p1530, p1531, p1532) {
    /* WEBPACK VAR INJECTION */
    (function (p1533, p1534) {
      var v820;
      /*! https://mths.be/punycode v1.4.1 by @mathias */
      (function (p1535) {
        /** Detect free variables */
        var v821 = true && p1531 && !p1531.nodeType && p1531;
        var v822 = true && p1533 && !p1533.nodeType && p1533;
        var v823 = typeof p1534 == "object" && p1534;
        if (v823.global === v823 || v823.window === v823 || v823.self === v823) {
          p1535 = v823;
        }
        /**
             * The `punycode` object.
             * @name punycode
             * @type Object
             */
        var v824;
        var /** Highest positive signed 32-bit float value */
        vLN2147483647 = 2147483647;
        var
        // aka. 0x7FFFFFFF or 2^31-1
        /** Bootstring parameters */
        vLN36 = 36;
        var vLN121 = 1;
        var vLN26 = 26;
        var vLN38 = 38;
        var vLN700 = 700;
        var vLN72 = 72;
        var vLN128 = 128;
        var
        // 0x80
        vLS19 = "-";
        var
        // '\x2D'
        /** Regular expressions */
        v825 = /^xn--/;
        var v826 = /[^\x20-\x7E]/;
        var
        // unprintable ASCII chars + non-ASCII chars
        v827 = /[\x2E\u3002\uFF0E\uFF61]/g;
        var
        // RFC 3490 separators
        /** Error messages */
        vO26 = {
          overflow: "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        };
        var /** Convenience shortcuts */
        v828 = vLN36 - vLN121;
        var v829 = Math.floor;
        var v830 = String.fromCharCode;
        var /** Temporary variable */
        v831;
        /*--------------------------------------------------------------------------*/
        /**
             * A generic error utility function.
             * @private
             * @param {String} type The error type.
             * @returns {Error} Throws a `RangeError` with the applicable error message.
             */
        function f559(p1536) {
          throw new RangeError(vO26[p1536]);
        }
        /**
             * A generic `Array#map` utility function.
             * @private
             * @param {Array} array The array to iterate over.
             * @param {Function} callback The function that gets called for every array
             * item.
             * @returns {Array} A new array of values returned by the callback function.
             */
        function f560(p1537, p1538) {
          var v832 = p1537.length;
          var vA37 = [];
          while (v832--) {
            vA37[v832] = p1538(p1537[v832]);
          }
          return vA37;
        }
        /**
             * A simple `Array#map`-like wrapper to work with domain name strings or email
             * addresses.
             * @private
             * @param {String} domain The domain name or email address.
             * @param {Function} callback The function that gets called for every
             * character.
             * @returns {Array} A new string of characters returned by the callback
             * function.
             */
        function f561(p1539, p1540) {
          var v833 = p1539.split("@");
          var vLS20 = "";
          if (v833.length > 1) {
            // In email addresses, only the domain name should be punycoded. Leave
            // the local part (i.e. everything up to `@`) intact.
            vLS20 = v833[0] + "@";
            p1539 = v833[1];
          }
          // Avoid `split(regex)` for IE8 compatibility. See #17.
          p1539 = p1539.replace(v827, ".");
          var v834 = p1539.split(".");
          var v835 = f560(v834, p1540).join(".");
          return vLS20 + v835;
        }
        /**
             * Creates an array containing the numeric code points of each Unicode
             * character in the string. While JavaScript uses UCS-2 internally,
             * this function will convert a pair of surrogate halves (each of which
             * UCS-2 exposes as separate characters) into a single code point,
             * matching UTF-16.
             * @see `punycode.ucs2.encode`
             * @see <https://mathiasbynens.be/notes/javascript-encoding>
             * @memberOf punycode.ucs2
             * @name decode
             * @param {String} string The Unicode input string (UCS-2).
             * @returns {Array} The new array of code points.
             */
        function f562(p1541) {
          var vA38 = [];
          var vLN0104 = 0;
          var v836 = p1541.length;
          var v837;
          var v838;
          while (vLN0104 < v836) {
            v837 = p1541.charCodeAt(vLN0104++);
            if (v837 >= 55296 && v837 <= 56319 && vLN0104 < v836) {
              // high surrogate, and there is a next character
              v838 = p1541.charCodeAt(vLN0104++);
              if ((v838 & 64512) == 56320) {
                // low surrogate
                vA38.push(((v837 & 1023) << 10) + (v838 & 1023) + 65536);
              } else {
                // unmatched surrogate; only append this code unit, in case the next
                // code unit is the high surrogate of a surrogate pair
                vA38.push(v837);
                vLN0104--;
              }
            } else {
              vA38.push(v837);
            }
          }
          return vA38;
        }
        /**
             * Creates a string based on an array of numeric code points.
             * @see `punycode.ucs2.decode`
             * @memberOf punycode.ucs2
             * @name encode
             * @param {Array} codePoints The array of numeric code points.
             * @returns {String} The new Unicode string (UCS-2).
             */
        function f563(p1542) {
          return f560(p1542, function (p1543) {
            var vLS21 = "";
            if (p1543 > 65535) {
              p1543 -= 65536;
              vLS21 += v830(p1543 >>> 10 & 1023 | 55296);
              p1543 = p1543 & 1023 | 56320;
            }
            vLS21 += v830(p1543);
            return vLS21;
          }).join("");
        }
        /**
             * Converts a basic code point into a digit/integer.
             * @see `digitToBasic()`
             * @private
             * @param {Number} codePoint The basic numeric code point value.
             * @returns {Number} The numeric value of a basic code point (for use in
             * representing integers) in the range `0` to `base - 1`, or `base` if
             * the code point does not represent a value.
             */
        function f564(p1544) {
          if (p1544 - 48 < 10) {
            return p1544 - 22;
          }
          if (p1544 - 65 < 26) {
            return p1544 - 65;
          }
          if (p1544 - 97 < 26) {
            return p1544 - 97;
          }
          return vLN36;
        }
        /**
             * Converts a digit/integer into a basic code point.
             * @see `basicToDigit()`
             * @private
             * @param {Number} digit The numeric value of a basic code point.
             * @returns {Number} The basic code point whose value (when used for
             * representing integers) is `digit`, which needs to be in the range
             * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
             * used; else, the lowercase form is used. The behavior is undefined
             * if `flag` is non-zero and `digit` has no uppercase form.
             */
        function f565(p1545, p1546) {
          //  0..25 map to ASCII a..z or A..Z
          // 26..35 map to ASCII 0..9
          return p1545 + 22 + (p1545 < 26) * 75 - ((p1546 != 0) << 5);
        }
        /**
             * Bias adaptation function as per section 3.4 of RFC 3492.
             * https://tools.ietf.org/html/rfc3492#section-3.4
             * @private
             */
        function f566(p1547, p1548, p1549) {
          var vLN0105 = 0;
          p1547 = p1549 ? v829(p1547 / vLN700) : p1547 >> 1;
          p1547 += v829(p1547 / p1548);
          for (; /* no initialization */
          p1547 > v828 * vLN26 >> 1; vLN0105 += vLN36) {
            p1547 = v829(p1547 / v828);
          }
          return v829(vLN0105 + (v828 + 1) * p1547 / (p1547 + vLN38));
        }
        /**
             * Converts a Punycode string of ASCII-only symbols to a string of Unicode
             * symbols.
             * @memberOf punycode
             * @param {String} input The Punycode string of ASCII-only symbols.
             * @returns {String} The resulting string of Unicode symbols.
             */
        function f567(p1550) {
          // Don't use UCS-2
          var vA39 = [];
          var v839 = p1550.length;
          var v840;
          var vLN0106 = 0;
          var vVLN128 = vLN128;
          var vVLN72 = vLN72;
          var v841;
          var v842;
          var v843;
          var v844;
          var v845;
          var v846;
          var v847;
          var v848;
          var /** Cached calculation results */
          v849; // Handle the basic code points: let `basic` be the number of input code
          // points before the last delimiter, or `0` if there is none, then copy
          // the first basic code points to the output.
          v841 = p1550.lastIndexOf(vLS19);
          if (v841 < 0) {
            v841 = 0;
          }
          for (v842 = 0; v842 < v841; ++v842) {
            // if it's not a basic code point
            if (p1550.charCodeAt(v842) >= 128) {
              f559("not-basic");
            }
            vA39.push(p1550.charCodeAt(v842));
          }
          // Main decoding loop: start just after the last delimiter if any basic code
          // points were copied; start at the beginning otherwise.
          for (v843 = v841 > 0 ? v841 + 1 : 0; v843 < v839 /* no final expression */;) {
            v844 = vLN0106;
            v845 = 1;
            v846 = vLN36;
            // `index` is the index of the next character to be consumed.
            // Decode a generalized variable-length integer into `delta`,
            // which gets added to `i`. The overflow checking is easier
            // if we increase `i` as we go, then subtract off its starting
            // value at the end to obtain `delta`.
            for (;; v846 += vLN36) {
              if (v843 >= v839) {
                f559("invalid-input");
              }
              v847 = f564(p1550.charCodeAt(v843++));
              if (v847 >= vLN36 || v847 > v829((vLN2147483647 - vLN0106) / v845)) {
                f559("overflow");
              }
              vLN0106 += v847 * v845;
              v848 = v846 <= vVLN72 ? vLN121 : v846 >= vVLN72 + vLN26 ? vLN26 : v846 - vVLN72;
              if (v847 < v848) {
                break;
              }
              v849 = vLN36 - v848;
              if (v845 > v829(vLN2147483647 / v849)) {
                f559("overflow");
              }
              v845 *= v849;
            }
            v840 = vA39.length + 1;
            vVLN72 = f566(vLN0106 - v844, v840, v844 == 0);
            // `i` was supposed to wrap around from `out` to `0`,
            // incrementing `n` each time, so we'll fix that now:
            if (v829(vLN0106 / v840) > vLN2147483647 - vVLN128) {
              f559("overflow");
            }
            vVLN128 += v829(vLN0106 / v840);
            vLN0106 %= v840;
            // Insert `n` at position `i` of the output
            vA39.splice(vLN0106++, 0, vVLN128);
          }
          return f563(vA39);
        }
        /**
             * Converts a string of Unicode symbols (e.g. a domain name label) to a
             * Punycode string of ASCII-only symbols.
             * @memberOf punycode
             * @param {String} input The string of Unicode symbols.
             * @returns {String} The resulting Punycode string of ASCII-only symbols.
             */
        function f568(p1551) {
          var v850;
          var v851;
          var v852;
          var v853;
          var v854;
          var v855;
          var v856;
          var v857;
          var v858;
          var v859;
          var v860;
          var vA40 = [];
          var /** `inputLength` will hold the number of code points in `input`. */
          v861;
          var /** Cached calculation results */
          v862;
          var v863;
          var v864; // Convert the input in UCS-2 to Unicode
          p1551 = f562(p1551);
          // Cache the length
          v861 = p1551.length;
          // Initialize the state
          v850 = vLN128;
          v851 = 0;
          v854 = vLN72;
          // Handle the basic code points
          for (v855 = 0; v855 < v861; ++v855) {
            v860 = p1551[v855];
            if (v860 < 128) {
              vA40.push(v830(v860));
            }
          }
          v852 = v853 = vA40.length;
          // `handledCPCount` is the number of code points that have been handled;
          // `basicLength` is the number of basic code points.
          // Finish the basic string - if it is not empty - with a delimiter
          if (v853) {
            vA40.push(vLS19);
          }
          // Main encoding loop:
          while (v852 < v861) {
            v856 = vLN2147483647;
            v855 = 0;
            // All non-basic code points < n have been handled already. Find the next
            // larger one:
            for (; v855 < v861; ++v855) {
              v860 = p1551[v855];
              if (v860 >= v850 && v860 < v856) {
                v856 = v860;
              }
            }
            // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
            // but guard against overflow
            v862 = v852 + 1;
            if (v856 - v850 > v829((vLN2147483647 - v851) / v862)) {
              f559("overflow");
            }
            v851 += (v856 - v850) * v862;
            v850 = v856;
            for (v855 = 0; v855 < v861; ++v855) {
              v860 = p1551[v855];
              if (v860 < v850 && ++v851 > vLN2147483647) {
                f559("overflow");
              }
              if (v860 == v850) {
                v857 = v851;
                v858 = vLN36;
                // Represent delta as a generalized variable-length integer
                for (;; v858 += vLN36) {
                  v859 = v858 <= v854 ? vLN121 : v858 >= v854 + vLN26 ? vLN26 : v858 - v854;
                  if (v857 < v859) {
                    break;
                  }
                  v864 = v857 - v859;
                  v863 = vLN36 - v859;
                  vA40.push(v830(f565(v859 + v864 % v863, 0)));
                  v857 = v829(v864 / v863);
                }
                vA40.push(v830(f565(v857, 0)));
                v854 = f566(v851, v862, v852 == v853);
                v851 = 0;
                ++v852;
              }
            }
            ++v851;
            ++v850;
          }
          return vA40.join("");
        }
        /**
             * Converts a Punycode string representing a domain name or an email address
             * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
             * it doesn't matter if you call it on a string that has already been
             * converted to Unicode.
             * @memberOf punycode
             * @param {String} input The Punycoded domain name or email address to
             * convert to Unicode.
             * @returns {String} The Unicode representation of the given Punycode
             * string.
             */
        function f569(p1552) {
          return f561(p1552, function (p1553) {
            if (v825.test(p1553)) {
              return f567(p1553.slice(4).toLowerCase());
            } else {
              return p1553;
            }
          });
        }
        /**
             * Converts a Unicode string representing a domain name or an email address to
             * Punycode. Only the non-ASCII parts of the domain name will be converted,
             * i.e. it doesn't matter if you call it with a domain that's already in
             * ASCII.
             * @memberOf punycode
             * @param {String} input The domain name or email address to convert, as a
             * Unicode string.
             * @returns {String} The Punycode representation of the given domain name or
             * email address.
             */
        function f570(p1554) {
          return f561(p1554, function (p1555) {
            if (v826.test(p1555)) {
              return "xn--" + f568(p1555);
            } else {
              return p1555;
            }
          });
        }
        /*--------------------------------------------------------------------------*/
        /** Define the public API */
        v824 = {
          /**
               * A string representing the current Punycode.js version number.
               * @memberOf punycode
               * @type String
               */
          version: "1.4.1",
          /**
               * An object of methods to convert from JavaScript's internal character
               * representation (UCS-2) to Unicode code points, and back.
               * @see <https://mathiasbynens.be/notes/javascript-encoding>
               * @memberOf punycode
               * @type Object
               */
          ucs2: {
            decode: f562,
            encode: f563
          },
          decode: f567,
          encode: f568,
          toASCII: f570,
          toUnicode: f569
        };
        /** Expose `punycode` */
        // Some AMD build optimizers, like r.js, check for specific condition patterns
        // like the following:
        if (true) {
          v820 = function () {
            return v824;
          }.call(p1531, p1532, p1531, p1533);
          if (v820 !== undefined) {
            p1533.exports = v820;
          }
        } else {}
      })(this);
      /* WEBPACK VAR INJECTION */
    }).call(this, p1532(/*! ./../webpack/buildin/module.js */
    "./node_modules/webpack/buildin/module.js")(p1530), p1532(/*! ./../webpack/buildin/global.js */
    "./node_modules/webpack/buildin/global.js"));
    /***/
  },
  /***/
  "./node_modules/querystring-es3/decode.js":
  /*!************************************************!*\
  !*** ./node_modules/querystring-es3/decode.js ***!
  \************************************************/
  /*! no static exports found */
  /***/
  function (p1556, p1557, p1558) {
    "use strict";

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    // If obj.hasOwnProperty has been overridden, then calling
    // obj.hasOwnProperty(prop) will break.
    // See: https://github.com/joyent/node/issues/1707
    function f571(p1559, p1560) {
      return Object.prototype.hasOwnProperty.call(p1559, p1560);
    }
    p1556.exports = function (p1561, p1562, p1563, p1564) {
      p1562 = p1562 || "&";
      p1563 = p1563 || "=";
      var vO27 = {};
      if (typeof p1561 !== "string" || p1561.length === 0) {
        return vO27;
      }
      var v865 = /\+/g;
      p1561 = p1561.split(p1562);
      var vLN10002 = 1000;
      if (p1564 && typeof p1564.maxKeys === "number") {
        vLN10002 = p1564.maxKeys;
      }
      var v866 = p1561.length;
      // maxKeys <= 0 means that we should not limit keys count
      if (vLN10002 > 0 && v866 > vLN10002) {
        v866 = vLN10002;
      }
      for (var vLN0107 = 0; vLN0107 < v866; ++vLN0107) {
        var v867 = p1561[vLN0107].replace(v865, "%20");
        var v868 = v867.indexOf(p1563);
        var v869;
        var v870;
        var v871;
        var v872;
        if (v868 >= 0) {
          v869 = v867.substr(0, v868);
          v870 = v867.substr(v868 + 1);
        } else {
          v869 = v867;
          v870 = "";
        }
        v871 = decodeURIComponent(v869);
        v872 = decodeURIComponent(v870);
        if (!f571(vO27, v871)) {
          vO27[v871] = v872;
        } else if (v873(vO27[v871])) {
          vO27[v871].push(v872);
        } else {
          vO27[v871] = [vO27[v871], v872];
        }
      }
      return vO27;
    };
    var v873 = Array.isArray || function (p1565) {
      return Object.prototype.toString.call(p1565) === "[object Array]";
    };
    /***/
  },
  /***/
  "./node_modules/querystring-es3/encode.js":
  /*!************************************************!*\
  !*** ./node_modules/querystring-es3/encode.js ***!
  \************************************************/
  /*! no static exports found */
  /***/
  function (p1566, p1567, p1568) {
    "use strict";

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    function f572(p1569) {
      switch (typeof p1569) {
        case "string":
          return p1569;
        case "boolean":
          if (p1569) {
            return "true";
          } else {
            return "false";
          }
        case "number":
          if (isFinite(p1569)) {
            return p1569;
          } else {
            return "";
          }
        default:
          return "";
      }
    }
    p1566.exports = function (p1570, p1571, p1572, p1573) {
      p1571 = p1571 || "&";
      p1572 = p1572 || "=";
      if (p1570 === null) {
        p1570 = undefined;
      }
      if (typeof p1570 === "object") {
        return f573(v876(p1570), function (p1574) {
          var v874 = encodeURIComponent(f572(p1574)) + p1572;
          if (v875(p1570[p1574])) {
            return f573(p1570[p1574], function (p1575) {
              return v874 + encodeURIComponent(f572(p1575));
            }).join(p1571);
          } else {
            return v874 + encodeURIComponent(f572(p1570[p1574]));
          }
        }).join(p1571);
      }
      if (!p1573) {
        return "";
      }
      return encodeURIComponent(f572(p1573)) + p1572 + encodeURIComponent(f572(p1570));
    };
    var v875 = Array.isArray || function (p1576) {
      return Object.prototype.toString.call(p1576) === "[object Array]";
    };
    function f573(p1577, p1578) {
      if (p1577.map) {
        return p1577.map(p1578);
      }
      var vA41 = [];
      for (var vLN0108 = 0; vLN0108 < p1577.length; vLN0108++) {
        vA41.push(p1578(p1577[vLN0108], vLN0108));
      }
      return vA41;
    }
    var v876 = Object.keys || function (p1579) {
      var vA42 = [];
      for (var v877 in p1579) {
        if (Object.prototype.hasOwnProperty.call(p1579, v877)) {
          vA42.push(v877);
        }
      }
      return vA42;
    };
    /***/
  },
  /***/
  "./node_modules/querystring-es3/index.js":
  /*!***********************************************!*\
  !*** ./node_modules/querystring-es3/index.js ***!
  \***********************************************/
  /*! no static exports found */
  /***/
  function (p1580, p1581, p1582) {
    "use strict";

    p1581.decode = p1581.parse = p1582(/*! ./decode */
    "./node_modules/querystring-es3/decode.js");
    p1581.encode = p1581.stringify = p1582(/*! ./encode */
    "./node_modules/querystring-es3/encode.js");
    /***/
  },
  /***/
  "./node_modules/url/url.js":
  /*!*********************************!*\
  !*** ./node_modules/url/url.js ***!
  \*********************************/
  /*! no static exports found */
  /***/
  function (p1583, p1584, p1585) {
    "use strict";

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    var vP1585 = p1585(/*! punycode */
    "./node_modules/punycode/punycode.js");
    var vP15852 = p1585(/*! ./util */
    "./node_modules/url/util.js");
    p1584.parse = f575;
    p1584.resolve = f577;
    p1584.resolveObject = f578;
    p1584.format = f576;
    p1584.Url = f574;
    function f574() {
      this.protocol = null;
      this.slashes = null;
      this.auth = null;
      this.host = null;
      this.port = null;
      this.hostname = null;
      this.hash = null;
      this.search = null;
      this.query = null;
      this.pathname = null;
      this.path = null;
      this.href = null;
    }
    // Reference: RFC 3986, RFC 1808, RFC 2396
    // define these here so at least they only have to be
    // compiled once on the first module load.
    var v878 = /^([a-z0-9.+-]+:)/i;
    var v879 = /:[0-9]*$/;
    var
    // Special case for a simple path URL
    v880 = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
    var
    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    vA43 = ["<", ">", "\"", "`", " ", "\r", "\n", "\t"];
    var
    // RFC 2396: characters not allowed for various reasons.
    v881 = ["{", "}", "|", "\\", "^", "`"].concat(vA43);
    var
    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    v882 = ["'"].concat(v881);
    var
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    v883 = ["%", "/", "?", ";", "#"].concat(v882);
    var vA44 = ["/", "?", "#"];
    var vLN255 = 255;
    var v884 = /^[+a-z0-9A-Z_-]{0,63}$/;
    var v885 = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
    var
    // protocols that can allow "unsafe" and "unwise" chars.
    vO28 = {
      javascript: true,
      "javascript:": true
    };
    var
    // protocols that never have a hostname.
    vO29 = {
      javascript: true,
      "javascript:": true
    };
    var
    // protocols that always contain a // bit.
    vO30 = {
      http: true,
      https: true,
      ftp: true,
      gopher: true,
      file: true,
      "http:": true,
      "https:": true,
      "ftp:": true,
      "gopher:": true,
      "file:": true
    };
    var vP15853 = p1585(/*! querystring */
    "./node_modules/querystring-es3/index.js");
    function f575(p1586, p1587, p1588) {
      if (p1586 && vP15852.isObject(p1586) && p1586 instanceof f574) {
        return p1586;
      }
      var v886 = new f574();
      v886.parse(p1586, p1587, p1588);
      return v886;
    }
    f574.prototype.parse = function (p1589, p1590, p1591) {
      if (!vP15852.isString(p1589)) {
        throw new TypeError("Parameter 'url' must be a string, not " + typeof p1589);
      }
      // Copy chrome, IE, opera backslash-handling behavior.
      // Back slashes before the query string get converted to forward slashes
      // See: https://code.google.com/p/chromium/issues/detail?id=25916
      var v887 = p1589.indexOf("?");
      var v888 = v887 !== -1 && v887 < p1589.indexOf("#") ? "?" : "#";
      var v889 = p1589.split(v888);
      var v890 = /\\/g;
      v889[0] = v889[0].replace(v890, "/");
      p1589 = v889.join(v888);
      var vP1589 = p1589;
      // trim before proceeding.
      // This is to support parse stuff like "  http://foo.com  \n"
      vP1589 = vP1589.trim();
      if (!p1591 && p1589.split("#").length === 1) {
        // Try fast path regexp
        var v891 = v880.exec(vP1589);
        if (v891) {
          this.path = vP1589;
          this.href = vP1589;
          this.pathname = v891[1];
          if (v891[2]) {
            this.search = v891[2];
            if (p1590) {
              this.query = vP15853.parse(this.search.substr(1));
            } else {
              this.query = this.search.substr(1);
            }
          } else if (p1590) {
            this.search = "";
            this.query = {};
          }
          return this;
        }
      }
      var v892 = v878.exec(vP1589);
      if (v892) {
        v892 = v892[0];
        var v893 = v892.toLowerCase();
        this.protocol = v893;
        vP1589 = vP1589.substr(v892.length);
      }
      // figure out if it's got a host
      // user@server is *always* interpreted as a hostname, and url
      // resolution will treat //foo/bar as host=foo,path=bar because that's
      // how the browser resolves relative URLs.
      if (p1591 || v892 || vP1589.match(/^\/\/[^@\/]+@[^@\/]+/)) {
        var v894 = vP1589.substr(0, 2) === "//";
        if (v894 && (!v892 || !vO29[v892])) {
          vP1589 = vP1589.substr(2);
          this.slashes = true;
        }
      }
      if (!vO29[v892] && (v894 || v892 && !vO30[v892])) {
        // there's a hostname.
        // the first instance of /, ?, ;, or # ends the host.
        //
        // If there is an @ in the hostname, then non-host chars *are* allowed
        // to the left of the last @ sign, unless some host-ending character
        // comes *before* the @-sign.
        // URLs are obnoxious.
        //
        // ex:
        // http://a@b@c/ => user:a@b host:c
        // http://a@b?@c => user:a host:c path:/?@c
        // v0.12 TODO(isaacs): This is not quite how Chrome does things.
        // Review our test case against browsers more comprehensively.
        // find the first instance of any hostEndingChars
        var v895 = -1;
        for (var vLN0113 = 0; vLN0113 < vA44.length; vLN0113++) {
          var v899 = vP1589.indexOf(vA44[vLN0113]);
          if (v899 !== -1 && (v895 === -1 || v899 < v895)) {
            v895 = v899;
          }
        }
        // at this point, either we have an explicit point where the
        // auth portion cannot go past, or the last @ char is the decider.
        var v897;
        var v898;
        if (v895 === -1) {
          // atSign can be anywhere.
          v898 = vP1589.lastIndexOf("@");
        } else {
          // atSign must be in auth portion.
          // http://a@b/c@d => host:b auth:a path:/c@d
          v898 = vP1589.lastIndexOf("@", v895);
        }
        // Now we have a portion which is definitely the auth.
        // Pull that off.
        if (v898 !== -1) {
          v897 = vP1589.slice(0, v898);
          vP1589 = vP1589.slice(v898 + 1);
          this.auth = decodeURIComponent(v897);
        }
        // the host is the remaining to the left of the first non-host char
        v895 = -1;
        for (var vLN0113 = 0; vLN0113 < v883.length; vLN0113++) {
          var v899 = vP1589.indexOf(v883[vLN0113]);
          if (v899 !== -1 && (v895 === -1 || v899 < v895)) {
            v895 = v899;
          }
        }
        // if we still have not hit it, then the entire thing is a host.
        if (v895 === -1) {
          v895 = vP1589.length;
        }
        this.host = vP1589.slice(0, v895);
        vP1589 = vP1589.slice(v895);
        // pull out port.
        this.parseHost();
        // we've indicated that there is a hostname,
        // so even if it's empty, it has to be present.
        this.hostname = this.hostname || "";
        // if hostname begins with [ and ends with ]
        // assume that it's an IPv6 address.
        var v900 = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
        // validate a little.
        if (!v900) {
          var v901 = this.hostname.split(/\./);
          for (var vLN0113 = 0, v910 = v901.length; vLN0113 < v910; vLN0113++) {
            var v903 = v901[vLN0113];
            if (!v903) {
              continue;
            }
            if (!v903.match(v884)) {
              var vLS22 = "";
              for (var vLN0112 = 0, v904 = v903.length; vLN0112 < v904; vLN0112++) {
                if (v903.charCodeAt(vLN0112) > 127) {
                  // we replace non-ASCII char with a temporary placeholder
                  // we need this to make sure size of hostname is not
                  // broken by replacing non-ASCII by nothing
                  vLS22 += "x";
                } else {
                  vLS22 += v903[vLN0112];
                }
              }
              // we test again with ASCII char only
              if (!vLS22.match(v884)) {
                var v905 = v901.slice(0, vLN0113);
                var v906 = v901.slice(vLN0113 + 1);
                var v907 = v903.match(v885);
                if (v907) {
                  v905.push(v907[1]);
                  v906.unshift(v907[2]);
                }
                if (v906.length) {
                  vP1589 = "/" + v906.join(".") + vP1589;
                }
                this.hostname = v905.join(".");
                break;
              }
            }
          }
        }
        if (this.hostname.length > vLN255) {
          this.hostname = "";
        } else {
          // hostnames are always lower case.
          this.hostname = this.hostname.toLowerCase();
        }
        if (!v900) {
          // IDNA Support: Returns a punycoded representation of "domain".
          // It only converts parts of the domain name that
          // have non-ASCII characters, i.e. it doesn't matter if
          // you call it with a domain that already is ASCII-only.
          this.hostname = vP1585.toASCII(this.hostname);
        }
        var v914 = this.port ? ":" + this.port : "";
        var v909 = this.hostname || "";
        this.host = v909 + v914;
        this.href += this.host;
        // strip [ and ] from the hostname
        // the host field still retains them, though
        if (v900) {
          this.hostname = this.hostname.substr(1, this.hostname.length - 2);
          if (vP1589[0] !== "/") {
            vP1589 = "/" + vP1589;
          }
        }
      }
      // now rest is set to the post-host stuff.
      // chop off any delim chars.
      if (!vO28[v893]) {
        // First, make 100% sure that any "autoEscape" chars get
        // escaped, even if encodeURIComponent doesn't think they
        // need to be.
        for (var vLN0113 = 0, v910 = v882.length; vLN0113 < v910; vLN0113++) {
          var v911 = v882[vLN0113];
          if (vP1589.indexOf(v911) === -1) {
            continue;
          }
          var vEncodeURIComponent = encodeURIComponent(v911);
          if (vEncodeURIComponent === v911) {
            vEncodeURIComponent = escape(v911);
          }
          vP1589 = vP1589.split(v911).join(vEncodeURIComponent);
        }
      }
      // chop off from the tail first.
      var v912 = vP1589.indexOf("#");
      if (v912 !== -1) {
        // got a fragment string.
        this.hash = vP1589.substr(v912);
        vP1589 = vP1589.slice(0, v912);
      }
      var v913 = vP1589.indexOf("?");
      if (v913 !== -1) {
        this.search = vP1589.substr(v913);
        this.query = vP1589.substr(v913 + 1);
        if (p1590) {
          this.query = vP15853.parse(this.query);
        }
        vP1589 = vP1589.slice(0, v913);
      } else if (p1590) {
        // no query string, but parseQueryString still requested
        this.search = "";
        this.query = {};
      }
      if (vP1589) {
        this.pathname = vP1589;
      }
      if (vO30[v893] && this.hostname && !this.pathname) {
        this.pathname = "/";
      }
      //to support http.request
      if (this.pathname || this.search) {
        var v914 = this.pathname || "";
        var v915 = this.search || "";
        this.path = v914 + v915;
      }
      // finally, reconstruct the href based on what has been validated.
      this.href = this.format();
      return this;
    };
    // format a parsed object into a url string
    function f576(p1592) {
      // ensure it's an object, and not a string url.
      // If it's an obj, this is a no-op.
      // this way, you can call url_format() on strings
      // to clean up potentially wonky urls.
      if (vP15852.isString(p1592)) {
        p1592 = f575(p1592);
      }
      if (!(p1592 instanceof f574)) {
        return f574.prototype.format.call(p1592);
      }
      return p1592.format();
    }
    f574.prototype.format = function () {
      var v916 = this.auth || "";
      if (v916) {
        v916 = encodeURIComponent(v916);
        v916 = v916.replace(/%3A/i, ":");
        v916 += "@";
      }
      var v917 = this.protocol || "";
      var v918 = this.pathname || "";
      var v919 = this.hash || "";
      var v920 = false;
      var vLS23 = "";
      if (this.host) {
        v920 = v916 + this.host;
      } else if (this.hostname) {
        v920 = v916 + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]");
        if (this.port) {
          v920 += ":" + this.port;
        }
      }
      if (this.query && vP15852.isObject(this.query) && Object.keys(this.query).length) {
        vLS23 = vP15853.stringify(this.query);
      }
      var v921 = this.search || vLS23 && "?" + vLS23 || "";
      if (v917 && v917.substr(-1) !== ":") {
        v917 += ":";
      }
      // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
      // unless they had them to begin with.
      if (this.slashes || (!v917 || vO30[v917]) && v920 !== false) {
        v920 = "//" + (v920 || "");
        if (v918 && v918.charAt(0) !== "/") {
          v918 = "/" + v918;
        }
      } else if (!v920) {
        v920 = "";
      }
      if (v919 && v919.charAt(0) !== "#") {
        v919 = "#" + v919;
      }
      if (v921 && v921.charAt(0) !== "?") {
        v921 = "?" + v921;
      }
      v918 = v918.replace(/[?#]/g, function (p1593) {
        return encodeURIComponent(p1593);
      });
      v921 = v921.replace("#", "%23");
      return v917 + v920 + v918 + v921 + v919;
    };
    function f577(p1594, p1595) {
      return f575(p1594, false, true).resolve(p1595);
    }
    f574.prototype.resolve = function (p1596) {
      return this.resolveObject(f575(p1596, false, true)).format();
    };
    function f578(p1597, p1598) {
      if (!p1597) {
        return p1598;
      }
      return f575(p1597, false, true).resolveObject(p1598);
    }
    f574.prototype.resolveObject = function (p1599) {
      if (vP15852.isString(p1599)) {
        var v922 = new f574();
        v922.parse(p1599, false, true);
        p1599 = v922;
      }
      var v923 = new f574();
      var v924 = Object.keys(this);
      for (var vLN0114 = 0; vLN0114 < v924.length; vLN0114++) {
        var v925 = v924[vLN0114];
        v923[v925] = this[v925];
      }
      // hash is always overridden, no matter what.
      // even href="" will remove it.
      v923.hash = p1599.hash;
      // if the relative url is empty, then there's nothing left to do here.
      if (p1599.href === "") {
        v923.href = v923.format();
        return v923;
      }
      // hrefs like //foo/bar always cut to the protocol.
      if (p1599.slashes && !p1599.protocol) {
        // take everything except the protocol from relative
        var v926 = Object.keys(p1599);
        for (var vLN0115 = 0; vLN0115 < v926.length; vLN0115++) {
          var v927 = v926[vLN0115];
          if (v927 !== "protocol") {
            v923[v927] = p1599[v927];
          }
        }
        //urlParse appends trailing / to urls like http://www.example.com
        if (vO30[v923.protocol] && v923.hostname && !v923.pathname) {
          v923.path = v923.pathname = "/";
        }
        v923.href = v923.format();
        return v923;
      }
      if (p1599.protocol && p1599.protocol !== v923.protocol) {
        // if it's a known url protocol, then changing
        // the protocol does weird things
        // first, if it's not file:, then we MUST have a host,
        // and if there was a path
        // to begin with, then we MUST have a path.
        // if it is file:, then the host is dropped,
        // because that's known to be hostless.
        // anything else is assumed to be absolute.
        if (!vO30[p1599.protocol]) {
          var v928 = Object.keys(p1599);
          for (var vLN0116 = 0; vLN0116 < v928.length; vLN0116++) {
            var v929 = v928[vLN0116];
            v923[v929] = p1599[v929];
          }
          v923.href = v923.format();
          return v923;
        }
        v923.protocol = p1599.protocol;
        if (!p1599.host && !vO29[p1599.protocol]) {
          var v937 = (p1599.pathname || "").split("/");
          while (v937.length && !(p1599.host = v937.shift()));
          if (!p1599.host) {
            p1599.host = "";
          }
          if (!p1599.hostname) {
            p1599.hostname = "";
          }
          if (v937[0] !== "") {
            v937.unshift("");
          }
          if (v937.length < 2) {
            v937.unshift("");
          }
          v923.pathname = v937.join("/");
        } else {
          v923.pathname = p1599.pathname;
        }
        v923.search = p1599.search;
        v923.query = p1599.query;
        v923.host = p1599.host || "";
        v923.auth = p1599.auth;
        v923.hostname = p1599.hostname || p1599.host;
        v923.port = p1599.port;
        // to support http.request
        if (v923.pathname || v923.search) {
          var v931 = v923.pathname || "";
          var v932 = v923.search || "";
          v923.path = v931 + v932;
        }
        v923.slashes = v923.slashes || p1599.slashes;
        v923.href = v923.format();
        return v923;
      }
      var v933 = v923.pathname && v923.pathname.charAt(0) === "/";
      var v934 = p1599.host || p1599.pathname && p1599.pathname.charAt(0) === "/";
      var v935 = v934 || v933 || v923.host && p1599.pathname;
      var vV935 = v935;
      var v936 = v923.pathname && v923.pathname.split("/") || [];
      var v937 = p1599.pathname && p1599.pathname.split("/") || [];
      var v938 = v923.protocol && !vO30[v923.protocol]; // if the url is a non-slashed url, then relative
      // links like ../.. should be able
      // to crawl up to the hostname, as well.  This is strange.
      // result.protocol has already been set by now.
      // Later on, put the first path part into the host field.
      if (v938) {
        v923.hostname = "";
        v923.port = null;
        if (v923.host) {
          if (v936[0] === "") {
            v936[0] = v923.host;
          } else {
            v936.unshift(v923.host);
          }
        }
        v923.host = "";
        if (p1599.protocol) {
          p1599.hostname = null;
          p1599.port = null;
          if (p1599.host) {
            if (v937[0] === "") {
              v937[0] = p1599.host;
            } else {
              v937.unshift(p1599.host);
            }
          }
          p1599.host = null;
        }
        v935 = v935 && (v937[0] === "" || v936[0] === "");
      }
      if (v934) {
        // it's absolute.
        v923.host = p1599.host || p1599.host === "" ? p1599.host : v923.host;
        v923.hostname = p1599.hostname || p1599.hostname === "" ? p1599.hostname : v923.hostname;
        v923.search = p1599.search;
        v923.query = p1599.query;
        v936 = v937;
        // fall through to the dot-handling below.
      } else if (v937.length) {
        // it's relative
        // throw away the existing file, and take the new path instead.
        if (!v936) {
          v936 = [];
        }
        v936.pop();
        v936 = v936.concat(v937);
        v923.search = p1599.search;
        v923.query = p1599.query;
      } else if (!vP15852.isNullOrUndefined(p1599.search)) {
        // just pull out the search.
        // like href='?foo'.
        // Put this after the other two cases because it simplifies the booleans
        if (v938) {
          v923.hostname = v923.host = v936.shift();
          //occationaly the auth can get stuck only in host
          //this especially happens in cases like
          //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
          var v944 = v923.host && v923.host.indexOf("@") > 0 ? v923.host.split("@") : false;
          if (v944) {
            v923.auth = v944.shift();
            v923.host = v923.hostname = v944.shift();
          }
        }
        v923.search = p1599.search;
        v923.query = p1599.query;
        //to support http.request
        if (!vP15852.isNull(v923.pathname) || !vP15852.isNull(v923.search)) {
          v923.path = (v923.pathname ? v923.pathname : "") + (v923.search ? v923.search : "");
        }
        v923.href = v923.format();
        return v923;
      }
      if (!v936.length) {
        // no path at all.  easy.
        // we've already handled the other stuff above.
        v923.pathname = null;
        //to support http.request
        if (v923.search) {
          v923.path = "/" + v923.search;
        } else {
          v923.path = null;
        }
        v923.href = v923.format();
        return v923;
      }
      // if a url ENDs in . or .., then it must get a trailing slash.
      // however, if it ends in anything else non-slashy,
      // then it must NOT get a trailing slash.
      var v940 = v936.slice(-1)[0];
      var v941 = (v923.host || p1599.host || v936.length > 1) && (v940 === "." || v940 === "..") || v940 === "";
      // strip single dots, resolve double dots to parent dir
      // if the path tries to go above the root, `up` ends up > 0
      var vLN0117 = 0;
      for (var v942 = v936.length; v942 >= 0; v942--) {
        v940 = v936[v942];
        if (v940 === ".") {
          v936.splice(v942, 1);
        } else if (v940 === "..") {
          v936.splice(v942, 1);
          vLN0117++;
        } else if (vLN0117) {
          v936.splice(v942, 1);
          vLN0117--;
        }
      }
      // if the path is allowed to go above the root, restore leading ..s
      if (!v935 && !vV935) {
        for (; vLN0117--; vLN0117) {
          v936.unshift("..");
        }
      }
      if (v935 && v936[0] !== "" && (!v936[0] || v936[0].charAt(0) !== "/")) {
        v936.unshift("");
      }
      if (v941 && v936.join("/").substr(-1) !== "/") {
        v936.push("");
      }
      var v943 = v936[0] === "" || v936[0] && v936[0].charAt(0) === "/";
      // put the host back
      if (v938) {
        v923.hostname = v923.host = v943 ? "" : v936.length ? v936.shift() : "";
        //occationaly the auth can get stuck only in host
        //this especially happens in cases like
        //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
        var v944 = v923.host && v923.host.indexOf("@") > 0 ? v923.host.split("@") : false;
        if (v944) {
          v923.auth = v944.shift();
          v923.host = v923.hostname = v944.shift();
        }
      }
      v935 = v935 || v923.host && v936.length;
      if (v935 && !v943) {
        v936.unshift("");
      }
      if (!v936.length) {
        v923.pathname = null;
        v923.path = null;
      } else {
        v923.pathname = v936.join("/");
      }
      //to support request.http
      if (!vP15852.isNull(v923.pathname) || !vP15852.isNull(v923.search)) {
        v923.path = (v923.pathname ? v923.pathname : "") + (v923.search ? v923.search : "");
      }
      v923.auth = p1599.auth || v923.auth;
      v923.slashes = v923.slashes || p1599.slashes;
      v923.href = v923.format();
      return v923;
    };
    f574.prototype.parseHost = function () {
      var v945 = this.host;
      var v946 = v879.exec(v945);
      if (v946) {
        v946 = v946[0];
        if (v946 !== ":") {
          this.port = v946.substr(1);
        }
        v945 = v945.substr(0, v945.length - v946.length);
      }
      if (v945) {
        this.hostname = v945;
      }
    };
    /***/
  },
  /***/
  "./node_modules/url/util.js":
  /*!**********************************!*\
  !*** ./node_modules/url/util.js ***!
  \**********************************/
  /*! no static exports found */
  /***/
  function (p1600, p1601, p1602) {
    "use strict";

    p1600.exports = {
      isString: function (p1603) {
        return typeof p1603 === "string";
      },
      isObject: function (p1604) {
        return typeof p1604 === "object" && p1604 !== null;
      },
      isNull: function (p1605) {
        return p1605 === null;
      },
      isNullOrUndefined: function (p1606) {
        return p1606 == null;
      }
    };
    /***/
  },
  /***/
  "./node_modules/webpack/buildin/global.js":
  /*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
  /*! no static exports found */
  /***/
  function (p1607, p1608) {
    var v947;
    // This works in non-strict mode
    v947 = function () {
      return this;
    }();
    try {
      // This works if eval is allowed (see CSP)
      v947 = v947 || new Function("return this")();
    } catch (e12) {
      // This works if the window reference is available
      if (typeof window === "object") {
        v947 = window;
      }
    }
    // g can still be undefined, but nothing to do about it...
    // We return undefined, instead of nothing here, so it's
    // easier to handle this case. if(!global) { ...}
    p1607.exports = v947;
    /***/
  },
  /***/
  "./node_modules/webpack/buildin/module.js":
  /*!***********************************!*\
  !*** (webpack)/buildin/module.js ***!
  \***********************************/
  /*! no static exports found */
  /***/
  function (p1609, p1610) {
    p1609.exports = function (p1611) {
      if (!p1611.webpackPolyfill) {
        p1611.deprecate = function () {};
        p1611.paths = [];
        // module.parent = undefined by default
        if (!p1611.children) {
          p1611.children = [];
        }
        Object.defineProperty(p1611, "loaded", {
          enumerable: true,
          get: function () {
            return p1611.l;
          }
        });
        Object.defineProperty(p1611, "id", {
          enumerable: true,
          get: function () {
            return p1611.i;
          }
        });
        p1611.webpackPolyfill = 1;
      }
      return p1611;
    };
    /***/
  },
  /***/
  "./src/js/app.js":
  /*!***********************!*\
  !*** ./src/js/app.js ***!
  \***********************/
  /*! no static exports found */
  /***/
  function (p1612, p1613, p1614) {
    "use strict";

    window.loadedScript = true;
    // ENV:
    var v948 = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");
    // IMPORTS:
    p1614(/*! ./libs/modernizr.js */
    "./src/js/libs/modernizr.js");
    var vP1614 = p1614(/*! ./libs/io-client.js */
    "./src/js/libs/io-client.js");
    var vP16142 = p1614(/*! ./libs/utils.js */
    "./src/js/libs/utils.js");
    var vP16143 = p1614(/*! ./libs/animText.js */
    "./src/js/libs/animText.js");
    var vP16144 = p1614(/*! ./config.js */
    "./src/js/config.js");
    var vP16145 = p1614(/*! ./data/gameObject.js */
    "./src/js/data/gameObject.js");
    var vP16146 = p1614(/*! ./data/items.js */
    "./src/js/data/items.js");
    var vP16147 = p1614(/*! ./data/mapManager.js */
    "./src/js/data/mapManager.js");
    var vP16148 = p1614(/*! ./data/objectManager.js */
    "./src/js/data/objectManager.js");
    var vP16149 = p1614(/*! ./data/player.js */
    "./src/js/data/player.js");
    var vP161410 = p1614(/*! ./data/store.js */
    "./src/js/data/store.js");
    var vP161411 = p1614(/*! ./data/projectile.js */
    "./src/js/data/projectile.js");
    var vP161412 = p1614(/*! ./data/projectileManager.js */
    "./src/js/data/projectileManager.js");
    var v949 = p1614(/*! ./libs/soundManager.js */
    "./src/js/libs/soundManager.js").obj;
    var v950 = new vP16143.TextManager();
    // VULTR:
    //var VultrClient = __webpack_require__(/*! ../../vultr/VultrClient.js */
    //    "./vultr/VultrClient.js");
    //var vultrClient = new VultrClient("moomoo.io",3000,config.maxPlayers,5);
    //vultrClient.debugLog = false;
    // URL PARAMS:
    function f579(p1615, p1616) {
      if (!p1616) {
        p1616 = window.location.href;
      }
      p1615 = p1615.replace(/[\[\]]/g, "\\$&");
      var v951 = new RegExp("[?&]" + p1615 + "(=([^&#]*)|&|#|$)");
      var v952 = v951.exec(p1616);
      if (!v952) {
        return null;
      }
      if (!v952[2]) {
        return "";
      }
      return decodeURIComponent(v952[2].replace(/\+/g, " "));
    }
    function f580() {
      if (!v374) {
        return;
      }
      for (let vLN0118 = 0; vLN0118 < (vLN047 < 3 ? 3 : 4); vLN0118++) {
        if (v948 && v409) {
          window.grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
            action: "homepage"
          }).then(function (p1617) {
            // CONNECT SOCKET:
            f247(p1617, vLN0118);
          });
        } else {
          // CONNECT SOCKET:
          f247(null, vLN0118);
        }
      }
    }
    // SOCKET & CONNECTION:
    var v953 = false;
    var v954 = false;
    /* The document-start prologue already owns window.WebSocket — the game
             * bundle locks the property before this point, so assigning to it
             * here is a no-op. Register the connect function with the prologue
             * instead, and it replays any address the game already asked for. */
            window.__reupSocketHook(f581);
    function f581(p1619) {
      // CONNECT:
      vP1614.connect(p1619, function (p1620) {
        f761();
        setInterval(() => f761(), 2500);
        if (p1620) {
          f592(p1620);
        } else {
          v953 = true;
          f764();
          f665();

          // DEFINE ENTER GAME BUTTON ON CLICK:
          vF2414.onclick = vP16142.checkTrusted(function () {
            // START GAME:
            if (vP1614.connected) {
              f665();
            }
          });
          vP16142.hookTouchEvents(vF2414);
        }
      }, {
        A: f591,
        B: f592,
        C: f666,
        D: f722,
        E: f723,
        a: f744,
        G: f678,
        H: f708,
        I: f717,
        J: f716,
        K: f686,
        L: f710,
        M: f711,
        N: f726,
        O: f731,
        P: f668,
        Q: f671,
        R: f669,
        S: f725,
        T: f677,
        U: f674,
        V: f625,
        X: f712,
        Y: f715,
        Z: f762,
        g: f600,
        "1": f603,
        "2": f598,
        "3": f601,
        "4": f602,
        "5": f618,
        "6": f639,
        "7": f614,
        "8": f667,
        "9": f612,
        "0": f760
      });
    }
    function f582() {
      return vP1614.connected;
    }
    function f583() {
      var v955 = vF24115.value;
      var vPrompt = prompt("party key", v955);
      if (vPrompt) {
        window.onbeforeunload = undefined;
        // Don't ask to leave
        window.location.href = "/?server=" + vPrompt;
      }
    }
    /**/
    // SOUND:
    var v956 = new v949(vP16144, vP16142);
    function f584(p1621) {
      if (p1621 == undefined) {
        p1621 = !v956.active;
      }
      v956.active = p1621;
      //Sound.toggleMute("menu", !active);
      f585("moo_moosic", p1621 ? 1 : 0);
    }
    // MATHS:
    var v957 = Math.PI;
    var v958 = v957 * 2;
    var v959 = v957 * 3;
    Math.lerpAngle = function (p1622, p1623, p1624) {
      var v960 = Math.abs(p1623 - p1622);
      if (v960 > v957) {
        if (p1622 > p1623) {
          p1623 += v958;
        } else {
          p1622 += v958;
        }
      }
      var v961 = p1623 + (p1622 - p1623) * p1624;
      if (v961 >= 0 && v961 <= v958) {
        return v961;
      }
      return v961 % v958;
    };
    // REOUNDED RECTANGLE:
    CanvasRenderingContext2D.prototype.roundRect = function (p1625, p1626, p1627, p1628, p1629) {
      if (p1627 < p1629 * 2) {
        p1629 = p1627 / 2;
      }
      if (p1628 < p1629 * 2) {
        p1629 = p1628 / 2;
      }
      if (p1629 < 0) {
        p1629 = 0;
      }
      this.beginPath();
      this.moveTo(p1625 + p1629, p1626);
      this.arcTo(p1625 + p1627, p1626, p1625 + p1627, p1626 + p1628, p1629);
      this.arcTo(p1625 + p1627, p1626 + p1628, p1625, p1626 + p1628, p1629);
      this.arcTo(p1625, p1626 + p1628, p1625, p1626, p1629);
      this.arcTo(p1625, p1626, p1625 + p1627, p1626, p1629);
      this.closePath();
      return this;
    };
    // STORAGE:
    var v962;
    if (typeof Storage !== "undefined") {
      v962 = true;
    }
    function f585(p1630, p1631) {
      if (v962) {
        localStorage.setItem(p1630, p1631);
      }
    }
    function f586(p1632) {
      if (v962) {
        localStorage.removeItem(p1632);
      }
    }
    function f587(p1633) {
      if (v962) {
        return localStorage.getItem(p1633);
      }
      return null;
    }
    // GLOBAL VALUES:
    var vF587 = f587("moofoll");
    function f588() {
      if (!vF587) {
        vF587 = true;
        f585("moofoll", 1);
      }
    }
    var v963;
    var v964;
    var v965;
    var vLN122 = 1;
    var v966;
    var v967;
    var v968;
    var v969 = Date.now();
    var v970;
    var v971;
    var vA45 = [];
    var vA46 = [];
    var vA47 = [];
    var vA48 = [];
    var vA49 = [];
    var v972 = new vP161412(vP161411, vA49, vA46, vA45, v991, vP16146, vP16144, vP16142);
    var vP161413 = p1614(/*! ./data/aiManager.js */
    "./src/js/data/aiManager.js");
    var vP161414 = p1614(/*! ./data/ai.js */
    "./src/js/data/ai.js");
    var v973 = new vP161413(vA45, vP161414, vA46, vP16146, null, vP16144, vP16142);
    var v974;
    var v975;
    var v976;
    var vLN123 = 1;
    var vLN0119 = 0;
    var vLN0120 = 0;
    var vLN0121 = 0;
    var vO31 = {
      id: -1,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };
    var vO32 = {
      id: -1,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };
    var v977;
    var v978;
    var v979;
    var vLN0122 = 0;
    var vLN0123 = 0;
    var v980 = vP16144.maxScreenWidth * parseFloat(f241("vision").value);
    var v981 = vP16144.maxScreenHeight * parseFloat(f241("vision").value);
    function f589() {
      if (v980 != vP16144.maxScreenWidth * 1.5 || v981 != vP16144.maxScreenHeight * 1.5) {
        v980 = vP16144.maxScreenWidth * 1.5;
        v981 = vP16144.maxScreenHeight * 1.5;
        f640();
      }
    }
    function f590() {
      if (v980 != vP16144.maxScreenWidth * parseFloat(f241("vision").value) || v981 != vP16144.maxScreenHeight * parseFloat(f241("vision").value)) {
        v980 = vP16144.maxScreenWidth * parseFloat(f241("vision").value);
        v981 = vP16144.maxScreenHeight * parseFloat(f241("vision").value);
        f640();
      }
    }
    f241("vision").onchange = function () {
      f590();
    };
    var v982;
    var v983;
    var v984 = false;
    var vF241 = f241("ad-container");
    var vF2412 = f241("mainMenu");
    $("#mainMenu").css({
      "background-color": "rgba(0, 0, 0, 0.35)",
      position: "absolute",
      width: "100%",
      height: "100%",
      "z-index": "10"
    });
    var vF2413 = f241("gameName");
    vF2413.innerText = "Lolfly....";
    var vF2414 = f241("enterGame");
    var vF2415 = f241("promoImg");
    vF2415.remove();
    var vF2416 = f241("promoImgHolder");
    $("#promoImgHolder").css({
      "text-align": "left",
      "font-size": "12px",
      "overflow-y": "scroll",
      //            "overflow-x": "scroll",
      "max-height": "100px"
      //            "max-width": "300px"
    });
    vF2416.innerHTML = v392;
    var vF2417 = f241("desktopInstructions");
    vF2417.innerHTML = `
        Toggle Menu: ESC<br>
        Keys: Q, F, V, H - Macro,<br>
              R - InstaKill<br>
              <br>
        Left/Middle/Right: Bull/Range/Tank<br>
		`;
    var vF2418 = f241("partyButton");
    var vF2419 = f241("joinPartyButton");
    var vF24110 = f241("settingsButton");
    var v985 = vF24110.getElementsByTagName("span")[0];
    var vF24111 = f241("allianceButton");
    var vF24112 = f241("storeButton");
    var vF24113 = f241("chatButton");
    var vF24114 = f241("gameCanvas");
    var v986 = vF24114.getContext("2d");
    var vF24115 = f241("serverBrowser");
    var vF24116 = f241("nativeResolution");
    var vF24117 = f241("showPing");
    var vF24118 = f241("playMusic");
    var vF24119 = f241("pingDisplay");
    var vF24120 = f241("shutdownDisplay");
    var vF24121 = f241("setupCard");
    let vF24122 = f241("menuContainer");
    var vF24123 = f241("menuCardHolder");
    var vF24124 = f241("guideCard");
    var vF24125 = f241("loadingText");
    var vF24126 = f241("gameUI");
    var vF24127 = f241("actionBar");
    var v987 = document.getElementById("resDisplay");
    var vF24128 = f241("scoreDisplay");
    var vF24129 = f241("foodDisplay");
    var vF24130 = f241("woodDisplay");
    var vF24131 = f241("stoneDisplay");
    var vF24132 = f241("killCounter");
    var vF24133 = f241("topInfoHolder");
    var vF24134 = f241("leaderboard");
    var vF24135 = f241("adCard");
    vF24135.remove();
    var vF24136 = f241("leaderboardData");
    var vF24137 = f241("nameInput");
    var vF24138 = f241("itemInfoHolder");
    var vF24139 = f241("ageText");
    var vF24140 = f241("ageBarBody");
    var vF24141 = f241("upgradeHolder");
    var vF24142 = f241("upgradeCounter");
    var vF24143 = f241("allianceMenu");
    var vF24144 = f241("allianceHolder");
    var vF24145 = f241("allianceManager");
    var vF24146 = f241("mapDisplay");
    var vF24147 = f241("diedText");
    var vF24148 = f241("skinColorHolder");
    var v988 = vF24146.getContext("2d");
    vF24146.width = 300;
    vF24146.height = 300;
    var vF24149 = f241("storeMenu");
    var vF24150 = f241("storeHolder");
    var vF24151 = f241("noticationDisplay");
    var v989 = vP161410.hats;
    var v990 = vP161410.accessories;
    var v991 = new vP16148(vP16145, vA48, vP16142, vP16144);
    var vLS525252 = "#525252";
    var vLS3d3f42 = "#3d3f42";
    var vLN55 = 5.5;
    // SET INIT DATA:
    function f591(p1634) {
      vA47 = p1634.teams;
    }
    // ON LOAD:
    var v992 = true;
    var v993 = false;
    var v994 = false;
    v994 = true;
    window.onblur = function () {
      v992 = false;
    };
    window.onfocus = function () {
      v992 = true;
      if (v974 && v974.alive) {
        f652();
      }
    };
    window.onload = function () {
      v993 = true;
    };
    /*window.recaptchaCallback = function() {
            console.log("a")
            captchaReady = true;
            connectSocketIfReady();
        };*/
    vF24114.oncontextmenu = function () {
      return false;
    };
    function f592(p1635) {
      v953 = false;
      vP1614.close();
      f593(v995 ? "Wrong Password" : p1635);
    }
    function f593(p1636) {
      vF2412.style.display = "block";
      vF24126.style.display = "none";
      vF24123.style.display = "none";
      vF24147.style.display = "none";
      vF24125.style.display = "block";
      vF24125.innerHTML = p1636 + "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
    }

    // BUTTON EVENTS:
    function f594() {
      vF2414.onclick = vP16142.checkTrusted(function () {
        // START GAME:
        f595();
      });
      vP16142.hookTouchEvents(vF2414);
      vF2419.onclick = vP16142.checkTrusted(function () {
        setTimeout(function () {
          f583();
        }, 10);
      });
      vP16142.hookTouchEvents(vF2419);
      vF24110.onclick = vP16142.checkTrusted(function () {
        f628();
      });
      vP16142.hookTouchEvents(vF24110);
      vF24111.onclick = vP16142.checkTrusted(function () {
        f604();
      });
      vP16142.hookTouchEvents(vF24111);
      vF24112.onclick = vP16142.checkTrusted(function () {
        f617();
      });
      vP16142.hookTouchEvents(vF24112);
      vF24113.onclick = vP16142.checkTrusted(function () {
        f632();
      });
      vP16142.hookTouchEvents(vF24113);
      vF24146.onclick = vP16142.checkTrusted(function () {
        f660();
      });
      vP16142.hookTouchEvents(vF24146);
    }
    // lol this useless,,, fr
    let v995 = false;
    let v996 = true;
    let v997 = v948 ? "wss" : "ws";
    let vA50 = [];
    let v998 = false;
    vA50.binaryType = "arraybuffer";
    vA50.onmessage = function (p1637) {
      let v999 = p1637.data;
      if (v999 == "isready") {
        v996 = true;
      }
      if (v999 == "fine") {
        v995 = false;
      }
      if (v999 == "oooooohiloveyouOHIOLMFAO") {
        // me have bad ms
        vUndefined7 = "badwifigamer";
        f241("healer").innerHTML = "Healer: High Ping";
      }
      if (v999 == "yourpublicusrrrrrrrrrrrrrNOOOOOOOOOOOOOOOOO") {
        // you have good ms
        vUndefined7 = "user";
        f241("healer").innerHTML = "Healer: Low Ping";
      }
      if (v999 == "urbadhahacoperatioLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL") {
        v995 = true;
        vF7(vP1614);
      }
      if (v999 == "yeswearesyncer") {
        let v1000 = Date.now() - vLN0149;
        v998 = true;
        if (v974) {
          v950.showText(v974.x, v974.y, 35, 0.1, 500, "Sync: " + v1000 + "ms", "#fff");
          console.log("synced!!!!!!!! also delay: " + v1000 + "ms");
        }
      }
    };
    vA50.onopen = function () {
      vF2413.innerText = "Random Nigger...";
    };
    function f595() {
      vLSAe86modnocapezez = "sixnineloool";
      f665();
    }
    // GENERATE NEW THINGS:
    let v1001 = document.createElement("div");
    v1001.id = "chatLogs";
    document.body.appendChild(v1001);
    function f596() {
      v1001.style = `
            display: none;
            padding: 10px;
            background-color: rgba(0, 0, 0, 0.25);
            border-radius: 4px;
            position: absolute;
            font-size: 10px;
            color: #fff;
            left: 20px;
            top: 250px;
            `;
      v1001.innerText = `Chat Logs`;
    }
    f596();
    // SHOW ITEM INFO:
    function f597(p1638, p1639, p1640) {
      if (v974 && p1638) {
        vP16142.removeAllChildren(vF24138);
        vF24138.classList.add("visible");
        // chatButton.classList.add("hide");
        vP16142.generateElement({
          id: "itemInfoName",
          text: vP16142.capitalizeFirst(p1638.name),
          parent: vF24138
        });
        vP16142.generateElement({
          id: "itemInfoDesc",
          text: p1638.desc,
          parent: vF24138
        });
        if (p1640) {} else if (p1639) {
          vP16142.generateElement({
            class: "itemInfoReq",
            text: !p1638.type ? "primary" : "secondary",
            parent: vF24138
          });
        } else {
          for (var vLN0124 = 0; vLN0124 < p1638.req.length; vLN0124 += 2) {
            vP16142.generateElement({
              class: "itemInfoReq",
              html: p1638.req[vLN0124] + "<span class='itemInfoReqVal'> x" + p1638.req[vLN0124 + 1] + "</span>",
              parent: vF24138
            });
          }
          if (p1638.group.limit) {
            vP16142.generateElement({
              class: "itemInfoLmt",
              text: (v974.itemCounts[p1638.group.id] || 0) + "/" + (vP16144.isSandbox ? 99 : p1638.group.limit),
              parent: vF24138
            });
          }
        }
      } else {
        vF24138.classList.remove("visible");
        // chatButton.classList.remove("hide");
      }
    }
    // SHOW ALLIANCE MENU:
    var vA51 = [];
    var vA52 = [];
    function f598(p1641, p1642) {
      vA51.push({
        sid: p1641,
        name: p1642
      });
      f599();
    }
    function f599() {
      if (vA51[0]) {
        var v1002 = vA51[0];
        vP16142.removeAllChildren(vF24151);
        vF24151.style.display = "block";
        vP16142.generateElement({
          class: "notificationText",
          text: v1002.name,
          parent: vF24151
        });
        vP16142.generateElement({
          class: "notifButton",
          html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
          parent: vF24151,
          onclick: function () {
            f606(0);
          },
          hookTouch: true
        });
        vP16142.generateElement({
          class: "notifButton",
          html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
          parent: vF24151,
          onclick: function () {
            f606(1);
          },
          hookTouch: true
        });
      } else {
        vF24151.style.display = "none";
      }
    }
    function f600(p1643) {
      vA47.push(p1643);
      if (vF24143.style.display == "block") {
        f605();
      }
    }
    function f601(p1644, p1645) {
      if (v974) {
        v974.team = p1644;
        v974.isOwner = p1645;
        if (p1644 == null) {
          vA52 = [];
        }
        if (vF24143.style.display == "block") {
          f605();
        }
      }
    }
    function f602(p1646) {
      vA52 = p1646;
      if (vF24143.style.display == "block") {
        f605();
      }
    }
    function f603(p1647) {
      for (var v1003 = vA47.length - 1; v1003 >= 0; v1003--) {
        if (vA47[v1003].sid == p1647) {
          vA47.splice(v1003, 1);
        }
      }
      if (vF24143.style.display == "block") {
        f605();
      }
      //            allianceNotifications = [];
      //            updateNotifications();
    }
    function f604() {
      f652();
      if (vF24143.style.display != "block") {
        f605();
      } else {
        vF24143.style.display = "none";
      }
    }
    function f605() {
      if (v974 && v974.alive) {
        f637();
        vF24149.style.display = "none";
        vF24143.style.display = "block";
        vP16142.removeAllChildren(vF24144);
        if (v974.team) {
          for (var vLN0126 = 0; vLN0126 < vA52.length; vLN0126 += 2) {
            (function (p1648) {
              var v1004 = vP16142.generateElement({
                class: "allianceItem",
                style: "color:" + (vA52[p1648] == v974.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                text: vA52[p1648 + 1],
                parent: vF24144
              });
              if (v974.isOwner && vA52[p1648] != v974.sid) {
                vP16142.generateElement({
                  class: "joinAlBtn",
                  text: "Kick",
                  onclick: function () {
                    f607(vA52[p1648]);
                  },
                  hookTouch: true,
                  parent: v1004
                });
              }
            })(vLN0126);
          }
        } else if (vA47.length) {
          for (var vLN0126 = 0; vLN0126 < vA47.length; ++vLN0126) {
            (function (p1649) {
              var v1005 = vP16142.generateElement({
                class: "allianceItem",
                style: "color:" + (vA47[p1649].sid == v974.team ? "#fff" : "rgba(255,255,255,0.6)"),
                text: vA47[p1649].sid,
                parent: vF24144
              });
              vP16142.generateElement({
                class: "joinAlBtn",
                text: "Join",
                onclick: function () {
                  f608(p1649);
                },
                hookTouch: true,
                parent: v1005
              });
            })(vLN0126);
          }
        } else {
          vP16142.generateElement({
            class: "allianceItem",
            text: "No Tribes Yet",
            parent: vF24144
          });
        }
        vP16142.removeAllChildren(vF24145);
        if (v974.team) {
          vP16142.generateElement({
            class: "allianceButtonM",
            style: "width: 360px",
            text: v974.isOwner ? "Delete Tribe" : "Leave Tribe",
            onclick: function () {
              f610();
            },
            hookTouch: true,
            parent: vF24145
          });
        } else {
          vP16142.generateElement({
            tag: "input",
            type: "text",
            id: "allianceInput",
            maxLength: 7,
            placeholder: "unique name",
            ontouchstart: function (p1650) {
              p1650.preventDefault();
              var vPrompt2 = prompt("unique name", p1650.currentTarget.value);
              p1650.currentTarget.value = vPrompt2.slice(0, 7);
            },
            parent: vF24145
          });
          vP16142.generateElement({
            tag: "div",
            class: "allianceButtonM",
            style: "width: 140px;",
            text: "Create",
            onclick: function () {
              f609();
            },
            hookTouch: true,
            parent: vF24145
          });
        }
      }
    }
    function f606(p1651) {
      vP1614.send("P", vA51[0].sid, p1651);
      vA51.splice(0, 1);
      f599();
    }
    function f607(p1652) {
      vP1614.send("Q", p1652);
    }
    function f608(p1653) {
      vP1614.send("b", vA47[p1653].sid);
    }
    function f609() {
      vP1614.send("L", f241("allianceInput").value);
    }
    function f610() {
      vA51 = [];
      f599();
      vP1614.send("N");
    }
    // window.testRateLimiting = function() {
    //     setInterval(() => {
    //         if (Math.random() > 0.5) {
    //             io.send("8", "test");
    //         } else {
    //             io.send("9");
    //         }
    //     }, 50);
    // }
    // MINIMAP:
    var v1006;
    var v1007;
    var v1008;
    var vA53 = [];
    var v1009;
    function f611() {
      this.init = function (p1654, p1655) {
        this.scale = 0;
        this.x = p1654;
        this.y = p1655;
        this.active = true;
      };
      this.update = function (p1656, p1657) {
        if (this.active) {
          this.scale += p1657 * 0.05;
          if (this.scale >= vP16144.mapPingScale) {
            this.active = false;
          } else {
            p1656.globalAlpha = 1 - Math.max(0, this.scale / vP16144.mapPingScale);
            p1656.beginPath();
            p1656.arc(this.x / vP16144.mapScale * vF24146.width, this.y / vP16144.mapScale * vF24146.width, this.scale, 0, Math.PI * 2);
            p1656.stroke();
          }
        }
      };
    }
    function f612(p1658, p1659) {
      for (var vLN0127 = 0; vLN0127 < vA53.length; ++vLN0127) {
        if (!vA53[vLN0127].active) {
          v1009 = vA53[vLN0127];
          break;
        }
      }
      if (!v1009) {
        v1009 = new f611();
        vA53.push(v1009);
      }
      v1009.init(p1658, p1659);
    }
    function f613() {
      if (!v1008) {
        v1008 = {};
      }
      v1008.x = v974.x;
      v1008.y = v974.y;
    }
    function f614(p1660) {
      v1007 = p1660;
    }
    function f615(p1661) {
      if (v974 && v974.alive) {
        v988.clearRect(0, 0, vF24146.width, vF24146.height);
        // RENDER PINGS:
        v988.strokeStyle = "#fff";
        v988.lineWidth = 4;
        for (var vLN0128 = 0; vLN0128 < vA53.length; ++vLN0128) {
          v1009 = vA53[vLN0128];
          v1009.update(v988, p1661);
        }
        // RENDER PLAYERS:
        v988.globalAlpha = 1;
        v988.fillStyle = "#fff";
        f696(v974.x / vP16144.mapScale * vF24146.width, v974.y / vP16144.mapScale * vF24146.height, 7, v988, true);
        v988.fillStyle = "rgba(255,255,255,0.35)";
        if (v974.team && v1007) {
          for (let vLN0129 = 0; vLN0129 < v1007.length;) {
            f696(v1007[vLN0129] / vP16144.mapScale * vF24146.width, v1007[vLN0129 + 1] / vP16144.mapScale * vF24146.height, 7, v988, true);
            vLN0129 += 2;
          }
        }
        // DEATH LOCATION:
        if (v1006) {
          v988.fillStyle = "#fc5553";
          v988.font = "34px Hammersmith One";
          v988.textBaseline = "middle";
          v988.textAlign = "center";
          v988.fillText("x", v1006.x / vP16144.mapScale * vF24146.width, v1006.y / vP16144.mapScale * vF24146.height);
        }
        // MAP MARKER:
        if (v1008) {
          v988.fillStyle = "#fff";
          v988.font = "34px Hammersmith One";
          v988.textBaseline = "middle";
          v988.textAlign = "center";
          v988.fillText("x", v1008.x / vP16144.mapScale * vF24146.width, v1008.y / vP16144.mapScale * vF24146.height);
        }
        // BREAK TRACKER:
        if (vA74.length && (f241("visual").value == "me" || f241("visual").value == "cele" || f241("visual").value == "fz" || f241("visual").value == "zyenith")) {
          for (let vLN0130 = 0; vLN0130 < vA74.length; vLN0130++) {
            v976 = vA74[vLN0130];
            v988.fillStyle = "#fff";
            v988.font = "34px Hammersmith One";
            v988.textBaseline = "middle";
            v988.textAlign = "center";
            v988.fillText("L", v976.x / vP16144.mapScale * vF24146.width, v976.y / vP16144.mapScale * vF24146.height);
          }
        }
        // TELEPORTS:
        if (vA84.length && (f241("visual").value == "me" || f241("visual").value == "cele" || f241("visual").value == "zyenith")) {
          for (let vLN0131 = 0; vLN0131 < vA84.length; vLN0131++) {
            v976 = vA84[vLN0131];
            v988.fillStyle = "#d76edb";
            v988.font = "34px Hammersmith One";
            v988.textBaseline = "middle";
            v988.textAlign = "center";
            v988.fillText("T", v976.x / vP16144.mapScale * vF24146.width, v976.y / vP16144.mapScale * vF24146.height);
          }
        }
        // CAM COORDS:
        if (vO40.active) {
          v988.globalAlpha = 1;
          v988.fillStyle = "#ff0000";
          f696(v977 / vP16144.mapScale * vF24146.width, v978 / vP16144.mapScale * vF24146.height, 7, v988, true);
        }
      }
    }
    // STORE MENU:
    var vLN0132 = 0;
    var vO33 = {};
    function f616(p1662) {
      if (vLN0132 != p1662) {
        vLN0132 = p1662;
        f619();
      }
    }
    function f617() {
      if (vF24149.style.display != "block") {
        vF24149.style.display = "block";
        vF24143.style.display = "none";
        f637();
        f619();
      } else {
        vF24149.style.display = "none";
      }
    }
    let v1010 = false;
    function f618(p1663, p1664, p1665) {
      if (p1665) {
        if (!p1663) {
          v974.tails[p1664] = 1;
        } else {
          v974.tailIndex = p1664;
        }
      } else if (!p1663) {
        v974.skins[p1664] = 1;
        if (vO72[p1664]) {
          f241("hatdisp" + p1664).style.backgroundColor = "#90ee90";
          f241("hatdisp" + p1664).style.opacity = "1";
          if (v974.skins[6] == 1 && v974.skins[7] == 1 && v974.skins[40] == 1 && v974.skins[22] == 1 && v974.skins[15] == 1) {
            f241("hatdispdiv").style.display = "none";
          }
        }
      } else {
        v974.skinIndex = p1664;
      }
      if (vF24149.style.display == "block") {
        f619();
      }
    }
    function f619() {
      if (v974) {
        vP16142.removeAllChildren(vF24150);
        var vVLN0132 = vLN0132;
        var v1011 = vVLN0132 ? v990 : v989;
        for (var vLN0133 = 0; vLN0133 < v1011.length; ++vLN0133) {
          if (!v1011[vLN0133].dontSell) {
            (function (p1666) {
              var v1012 = vP16142.generateElement({
                id: "storeDisplay" + p1666,
                class: "storeItem",
                onmouseout: function () {
                  f597();
                },
                onmouseover: function () {
                  f597(v1011[p1666], false, true);
                },
                parent: vF24150
              });
              vP16142.hookTouchEvents(v1012, true);
              vP16142.generateElement({
                tag: "img",
                class: "hatPreview",
                src: "../img/" + (vVLN0132 ? "accessories/access_" : "hats/hat_") + v1011[p1666].id + (v1011[p1666].topSprite ? "_p" : "") + ".png",
                parent: v1012
              });
              vP16142.generateElement({
                tag: "span",
                text: v1011[p1666].name,
                parent: v1012
              });
              if (vVLN0132 ? !v974.tails[v1011[p1666].id] : !v974.skins[v1011[p1666].id]) {
                vP16142.generateElement({
                  class: "joinAlBtn",
                  style: "margin-top: 5px",
                  text: "Buy",
                  onclick: function () {
                    f621(v1011[p1666].id, vVLN0132);
                  },
                  hookTouch: true,
                  parent: v1012
                });
                vP16142.generateElement({
                  tag: "span",
                  class: "itemPrice",
                  text: v1011[p1666].price,
                  parent: v1012
                });
              } else if ((vVLN0132 ? v974.tailIndex : v974.skinIndex) == v1011[p1666].id) {
                vP16142.generateElement({
                  class: "joinAlBtn",
                  style: "margin-top: 5px",
                  text: "Unequip",
                  onclick: function () {
                    f620(0, vVLN0132);
                  },
                  hookTouch: true,
                  parent: v1012
                });
              } else {
                vP16142.generateElement({
                  class: "joinAlBtn",
                  style: "margin-top: 5px",
                  text: "Equip",
                  onclick: function () {
                    f620(v1011[p1666].id, vVLN0132);
                  },
                  hookTouch: true,
                  parent: v1012
                });
              }
            })(vLN0133);
          }
        }
      }
    }
    function f620(p1667, p1668) {
      vP1614.send("c", 0, p1667, p1668);
    }
    function f621(p1669, p1670) {
      vP1614.send("c", 1, p1669, p1670);
    }
    function f622(p1671, p1672) {
      // BUY AND EQUIP:
      if (v974.alive) {
        if (p1672 == 0) {
          if (v974.skins[p1671]) {
            if (v974.skinIndex != p1671) {
              vP1614.send("c", 0, p1671, 0);
            }
          } else if (vP16144.isSandbox) {
            let vFindID = f753(v989, p1671);
            if (vFindID) {
              if (v974.points >= vFindID.price) {
                vP1614.send("c", 1, p1671, 0);
                vP1614.send("c", 0, p1671, 0);
              } else if (v974.skinIndex != 0) {
                vP1614.send("c", 0, 0, 0);
              }
            } else if (v974.skinIndex != 0) {
              vP1614.send("c", 0, 0, 0);
            }
          } else if (v974.skinIndex != 0) {
            vP1614.send("c", 0, 0, 0);
          }
        } else if (p1672 == 1) {
          if (v974.tails[p1671]) {
            if (v974.tailIndex != p1671) {
              vP1614.send("c", 0, p1671, 1);
            }
          } else if (vP16144.isSandbox) {
            let vFindID2 = f753(v990, p1671);
            if (vFindID2) {
              if (v974.points >= vFindID2.price) {
                vP1614.send("c", 1, p1671, 1);
                vP1614.send("c", 0, p1671, 1);
              } else if (v974.tailIndex != 0) {
                vP1614.send("c", 0, 0, 1);
              }
            } else if (v974.tailIndex != 0) {
              vP1614.send("c", 0, 0, 1);
            }
          } else if (v974.tailIndex != 0) {
            vP1614.send("c", 0, 0, 1);
          }
        }
      }
    }
    // HIDE WINDOWS:
    function f623() {
      vF24149.style.display = "none";
      vF24143.style.display = "none";
      f637();
    }
    // PREPARE UI:
    function f624() {
      // NATIVE RESOLUTION:
      var vF5872 = f587("native_resolution");
      if (!vF5872) {
        f626(typeof cordova !== "undefined");
        // Only default to native if on mobile
      } else {
        f626(vF5872 == "true");
      }
      // SHOW PING:
      v964 = f587("show_ping") == "true";
      vF24119.hidden = !v964;
      // LOAD SOUND SETTING:
      v965 = f587("moo_moosic") || 0;
      // MOBILE DOWNLOADS:
      setInterval(function () {
        if (window.cordova) {
          f241("downloadButtonContainer").classList.add("cordova");
          f241("mobileDownloadButtonContainer").classList.add("cordova");
        }
      }, 1000);
      // SKIN COLOR PICKER:
      f629();
      // ACTION BAR:
      vP16142.removeAllChildren(vF24127);
      for (var vLN0135 = 0; vLN0135 < vP16146.weapons.length + vP16146.list.length; ++vLN0135) {
        (function (p1673) {
          vP16142.generateElement({
            id: "actionBarItem" + p1673,
            class: "actionBarItem",
            style: "display:none",
            onmouseout: function () {
              f597();
            },
            parent: vF24127
          });
        })(vLN0135);
      }
      for (var vLN0135 = 0; vLN0135 < vP16146.list.length + vP16146.weapons.length; ++vLN0135) {
        (function (p1674) {
          var v1013 = document.createElement("canvas");
          v1013.width = v1013.height = 66;
          v1013.tmpW = v1013.tmpH = 66;
          var v1014 = v1013.getContext("2d");
          v1014.translate(v1013.width / 2, v1013.height / 2);
          v1014.imageSmoothingEnabled = false;
          v1014.webkitImageSmoothingEnabled = false;
          v1014.mozImageSmoothingEnabled = false;
          if (vP16146.weapons[p1674]) {
            v1014.rotate(Math.PI / 4 + Math.PI);
            var vGetItemSprite = new Image();
            vO49[vP16146.weapons[p1674].src] = vGetItemSprite;
            vGetItemSprite.onload = function () {
              this.isLoaded = true;
              var v1016 = 1 / (this.height / this.width);
              var v1017 = vP16146.weapons[p1674].iPad || 1;
              v1014.drawImage(this, -(v1013.width * v1017 * vP16144.iconPad * v1016) / 2, -(v1013.height * v1017 * vP16144.iconPad) / 2, v1013.width * v1017 * v1016 * vP16144.iconPad, v1013.height * v1017 * vP16144.iconPad);
              v1014.fillStyle = "rgba(0, 0, 70, 0.1)";
              v1014.globalCompositeOperation = "source-atop";
              v1014.fillRect(-44, -44, 88, 88);
              f241("actionBarItem" + p1674).style.backgroundImage = "url(" + v1013.toDataURL() + ")";
            };
            vGetItemSprite.src = ".././img/weapons/" + vP16146.weapons[p1674].src + ".png";
            var vF24153 = f241("actionBarItem" + p1674);
            vF24153.onmouseover = vP16142.checkTrusted(function () {
              f597(vP16146.weapons[p1674], true);
            });
            vF24153.onclick = vP16142.checkTrusted(function () {
              f663(v974 ? v974.weapons[vP16146.weapons[p1674].type] : p1674);
            });
            vP16142.hookTouchEvents(vF24153);
          } else {
            var vGetItemSprite = f693(vP16146.list[p1674 - vP16146.weapons.length], true);
            var v1018 = Math.min(v1013.width - vP16144.iconPadding, vGetItemSprite.width);
            v1014.globalAlpha = 1;
            v1014.drawImage(vGetItemSprite, -v1018 / 2, -v1018 / 2, v1018, v1018);
            v1014.fillStyle = "rgba(0, 0, 70, 0.1)";
            v1014.globalCompositeOperation = "source-atop";
            v1014.fillRect(-v1018 / 2, -v1018 / 2, v1018, v1018);
            f241("actionBarItem" + p1674).style.backgroundImage = "url(" + v1013.toDataURL() + ")";
            var vF24153 = f241("actionBarItem" + p1674);
            vF24153.onmouseover = vP16142.checkTrusted(function () {
              f597(vP16146.list[p1674 - vP16146.weapons.length]);
            });
            vF24153.onclick = vP16142.checkTrusted(function () {
              f662(p1674 - vP16146.weapons.length);
            });
            vP16142.hookTouchEvents(vF24153);
          }
        })(vLN0135);
      }
      // MOBILE NAME INPUT:
      vF24137.ontouchstart = vP16142.checkTrusted(function (p1675) {
        p1675.preventDefault();
        var vPrompt3 = prompt("enter name", p1675.currentTarget.value);
        p1675.currentTarget.value = vPrompt3.slice(0, 15);
      });
      // MOBILE PASS INPUT:
      //passWordInput.ontouchstart = UTILS.checkTrusted(function(e) {
      //    e.preventDefault();
      //    var newValue = prompt("enter pass", e.currentTarget.value);
      //    e.currentTarget.value = newValue.slice(0, 30);
      //});
      // SETTINGS:
      vF24116.checked = v963;
      vF24116.onchange = vP16142.checkTrusted(function (p1676) {
        f626(p1676.target.checked);
      });
      vF24117.checked = v964;
      vF24117.onchange = vP16142.checkTrusted(function (p1677) {
        v964 = vF24117.checked;
        vF24119.hidden = !v964;
        f585("show_ping", v964 ? "true" : "false");
      });
    }
    function f625(p1678, p1679) {
      if (p1678) {
        if (p1679) {
          v974.weapons = p1678;
        } else {
          v974.items = p1678;
        }
      }
      for (let vLN0136 = 0; vLN0136 < vP16146.list.length; vLN0136++) {
        let v1019 = vP16146.weapons.length + vLN0136;
        f241("actionBarItem" + v1019).style.display = (f241("visual").value == "cele" || f241("visual").value == "ae" || f241("visual").value == "hans" ? v974.firstItems : v974.items).indexOf(vP16146.list[vLN0136].id) >= 0 ? "inline-block" : "none";
      }
      for (let vLN0137 = 0; vLN0137 < vP16146.weapons.length; vLN0137++) {
        f241("actionBarItem" + vLN0137).style.display = v974.weapons[vP16146.weapons[vLN0137].type] == vP16146.weapons[vLN0137].id ? "inline-block" : "none";
      }
      let v1020 = f241("kmtexture").checked && v974.weapons[0] == 3 && v974.weapons[1] == 15;
      if (v1020) {
        f241("actionBarItem3").style.display = "none";
        f241("actionBarItem4").style.display = "inline-block";
      }
    }
    f241("kmtexture").onchange = function () {
      let v1021 = v974.weapons[0] == 3 && v974.weapons[1] == 15;
      if (v1021) {
        f241("actionBarItem3").style.display = f241("kmtexture").checked ? "none" : "inline-block";
        f241("actionBarItem4").style.display = f241("kmtexture").checked ? "inline-block" : "none";
      }
    };
    function f626(p1680) {
      v963 = p1680;
      vLN122 = p1680 ? window.devicePixelRatio || 1 : 1;
      vF24116.checked = p1680;
      f585("native_resolution", p1680.toString());
      f640();
    }
    function f627() {
      if (v1031) {
        vF24124.classList.add("touch");
      } else {
        vF24124.classList.remove("touch");
      }
    }
    // SETTINGS STUFF:
    function f628() {
      if (vF24124.classList.contains("showing")) {
        vF24124.classList.remove("showing");
        v985.innerText = "Settings";
      } else {
        vF24124.classList.add("showing");
        v985.innerText = "Close";
      }
    }
    // SELECT SKIN COLOR:
    function f629() {
      var vLS24 = "";
      for (var vLN0138 = 0; vLN0138 < vP16144.skinColors.length; ++vLN0138) {
        if (vLN0138 == vLN0123) {
          vLS24 += "<div class='skinColorItem activeSkin' style='background-color:" + vP16144.skinColors[vLN0138] + "' onclick='selectSkinColor(" + vLN0138 + ")'></div>";
        } else {
          vLS24 += "<div class='skinColorItem' style='background-color:" + vP16144.skinColors[vLN0138] + "' onclick='selectSkinColor(" + vLN0138 + ")'></div>";
        }
      }
      vF24148.innerHTML = vLS24;
    }
    function f630(p1681) {
      vLN0123 = p1681;
      vLN0122 = p1681 == 10 ? "propertyIsEnumerable" : p1681;
      f629();
    }
    let vLN10 = 10;
    setInterval(f631, 250);
    function f631() {
      var vParseInt5 = parseInt(document.getElementById("killCounter").innerText);
      if (vParseInt5 > vLN10) {
        setTimeout(() => {
          vP1614.send("6", "haha gg - get good");
        }, 0);
        setTimeout(() => {
          vP1614.send("6", "Ez!");
        }, 2000);
      }
      vLN10 = vParseInt5;
    }

    // CHAT STUFF:
    var vF24154 = f241("chatBox");
    var vF24155 = f241("chatHolder");
    function f632() {
      if (!v1031) {
        if (vF24155.style.display == "block") {
          if (vF24154.value) {
            f633(vF24154.value);
          }
          f637();
        } else {
          vF24149.style.display = "none";
          vF24143.style.display = "none";
          vF24155.style.display = "block";
          vF24154.autocomplete = "off";
          if (f241("visual").value == "ae" || f241("visual").value == "hans") {
            vF24155.style.opacity = "0";
          } else {
            vF24155.style.opacity = "1";
          }
          vF24154.focus();
          f652();
        }
      } else {
        setTimeout(function () {
          // Timeout lets the `hookTouchEvents` function exit
          var vPrompt4 = prompt("chat message");
          if (vPrompt4) {
            f633(vPrompt4);
          }
        }, 1);
      }
      vF24154.value = "";
    }
    function f633(p1682) {
      let vF6 = function (p1683) {
        return p1682 === "<" + p1683;
      };
      if (vF6("dcc")) {
        let vA54 = [];
        let vLN0139 = 0;
        for (let vLN0140 = 0; vLN0140 < vA46.length; vLN0140++) {
          v976 = vA46[vLN0140];
          if (v976 != v974 && v976.visible) {
            vA54.push({
              name: v976.name,
              timeout: vLN0139
            });
            vLN0139 += 600;
          }
        }
        vA54.forEach(p1684 => {
          setTimeout(() => {
            vP1614.send("6", "!c!dc user " + p1684.name);
          }, p1684.timeout);
        });
      } else if (vF6("dcm")) {
        let vA55 = [];
        let vLN0141 = 0;
        for (let vLN0142 = 0; vLN0142 < vA46.length; vLN0142++) {
          v976 = vA46[vLN0142];
          if (v976 != v974 && v976.visible) {
            vA55.push({
              id: v976.id,
              timeout: vLN0141
            });
            vLN0141 += 600;
          }
        }
        vA55.forEach(p1685 => {
          setTimeout(() => {
            vP1614.send("6", "fuck: " + p1685.id);
          }, p1685.timeout);
        });
      } else if (vF6("left")) {
        vP1614.send("6", "Disconnencting...");
        setTimeout(() => {
          vP1614.close();
        }, 500);
      } else if (vF6("test")) {} else if (vF6("near")) {} else if (vF6("bdc")) {
        vA14.forEach(p1686 => {
          p1686.close();
        });
        vA14 = [];
      } else if (f241("chatc").checked) {
        vP1614.send("6", (p1682[0].toUpperCase() + p1682.slice(1).toLowerCase()).slice(0, 30) + ".");
      } else {
        vP1614.send("6", p1682.slice(0, 30));
      }
    }
    let vA56 = [{
      say: "Children used to run and play",
      time: 15725
    }, {
      say: "Look at all this mess we made",
      time: 18600
    }, {
      say: "Guess i never know",
      time: 21500
    }, {
      say: "It went wrong",
      time: 23000
    }, {
      say: "Sometimes i feel like all",
      time: 27500
    }, {
      say: "That's said",
      time: 28500
    }, {
      say: "Goes viral then people forget",
      time: 30500
    }, {
      say: "In this crazy world",
      time: 33500
    }, {
      say: "I don't belong",
      time: 34800
    }, {
      say: "I see fire burning",
      time: 39000
    }, {
      say: "But i close my eyes",
      time: 41000
    }, {
      say: "(I'd rather deny that)",
      time: 43300
    }, {
      say: "Everything is falling",
      time: 45000
    }, {
      say: "Out of place",
      time: 46700
    }, {
      say: "I see trees ripped",
      time: 50000
    }, {
      say: "From the ground but",
      time: 52200
    }, {
      say: "Nobody makes a sound",
      time: 54050
    }, {
      say: "I see fire burning",
      time: 57000
    }, {
      say: "But i'm fine",
      time: 59000
    }, {
      say: "Now i am nobody",
      time: 61000
    }, {
      say: "Now i am nobody",
      time: 73000
    }, {
      say: "The future feels so unsure",
      time: 99500
    }, {
      say: "Didin't we deserve more",
      time: 102600
    }, {
      say: "The burden that you left",
      time: 105500
    }, {
      say: "Is too heavy for me",
      time: 106900
    }, {
      say: "Do you ever feel like",
      time: 111300
    }, {
      say: "The world will die out",
      time: 113000
    }, {
      say: "My anxiety's off",
      time: 114400
    }, {
      say: "The roof i cry out",
      time: 115800
    }, {
      say: "We have gone too far",
      time: 117400
    }, {
      say: "Take me back right now",
      time: 118800
    }, {
      say: "I see fire burning",
      time: 123000
    }, {
      say: "But i close my eyes",
      time: 125000
    }, {
      say: "(I'd rather deny that)",
      time: 127300
    }, {
      say: "Everything is falling",
      time: 129000
    }, {
      say: "Out of place",
      time: 131000
    }, {
      say: "I see trees ripped",
      time: 134000
    }, {
      say: "From the ground but",
      time: 135500
    }, {
      say: "Nobody makes a sound",
      time: 138000
    }, {
      say: "I see fire burning",
      time: 141000
    }, {
      say: "But i'm fine",
      time: 143000
    }, {
      say: "Now i am nobody",
      time: 145000
    }, {
      say: "Now i am nobody",
      time: 169000,
      end: true
    }];
    let vA57 = [{
      say: "I'm burning",
      time: 39800
    }, {
      say: "Wanna fell your power",
      time: 41300
    }, {
      say: "Right into my veins",
      time: 43000
    }, {
      say: "Come, racer",
      time: 46300
    }, {
      say: "Cross the fire",
      time: 47800
    }, {
      say: "Pushing on the gas",
      time: 49000
    }, {
      say: "So come on",
      time: 52600
    }, {
      say: "So come on,",
      time: 53900
    }, {
      say: "The drift is on my mind!",
      time: 55700
    }, {
      say: "AE eighity Speedy 86",
      time: 58600
    }, {
      say: "Every road is on fire!",
      time: 62000
    }, {
      say: "'Cause i can't stop driving",
      time: 64000
    }, {
      say: "With my 86",
      time: 66700
    }, {
      say: "Anybody will be around me",
      time: 68200
    }, {
      say: "AE eighity Speedy 86",
      time: 71200
    }, {
      say: "See my speed is getting higher",
      time: 74900
    }, {
      say: "'Cause i can't stop driving",
      time: 77000
    }, {
      say: "Go go 86",
      time: 79400
    }, {
      say: "Anybody will be around me",
      time: 81000
    }, {
      say: "Your body",
      time: 97300
    }, {
      say: "Burning like a flame",
      time: 98800
    }, {
      say: "Engine will be fly",
      time: 100300
    }, {
      say: "My racer",
      time: 103750
    }, {
      say: "Can you hear me?",
      time: 105300
    }, {
      say: "Listen to me now!",
      time: 106750
    }, {
      say: "So come on",
      time: 110000
    }, {
      say: "So come on,",
      time: 111700
    }, {
      say: "The drift is on my mind!",
      time: 113000
    }, {
      say: "AE eighity Speedy 86",
      time: 116000
    }, {
      say: "Every road is fire!",
      time: 119750
    }, {
      say: "'Cause i can't stop driving",
      time: 121750
    }, {
      say: "With my 86",
      time: 124150
    }, {
      say: "Anybody will be around me",
      time: 126000
    }, {
      say: "AE eighity Speedy 86",
      time: 129000
    }, {
      say: "See my speed is getting higher",
      time: 132250
    }, {
      say: "'Cause i can't stop driving",
      time: 134750
    }, {
      say: "Go go 86",
      time: 137000
    }, {
      say: "Anybody will be around me",
      time: 138750
    }, {
      say: "So come on",
      time: 219000
    }, {
      say: "So come on,",
      time: 220500
    }, {
      say: "The drift is on my mind!",
      time: 222000
    }, {
      say: "AE eighity go go 86",
      time: 225000
    }, {
      say: "Every road is fire!",
      time: 228500
    }, {
      say: "'Cause i can't stop driving",
      time: 230750
    }, {
      say: "With my 86",
      time: 233000
    }, {
      say: "Anybody will be around me",
      time: 234750
    }, {
      say: "AE eighity Speedy 86",
      time: 237750
    }, {
      say: "See my speed is getting higher",
      time: 241200
    }, {
      say: "'Cause i can't stop driving",
      time: 243500
    }, {
      say: "Go go 86",
      time: 245900
    }, {
      say: "Anybody will be around me",
      time: 247500,
      end: true
    }];
    let vA58 = [{
      say: "Oh oh ooooh",
      time: 2500
    }, {
      say: "Oh we begin",
      time: 4750
    }, {
      say: "We'll be together",
      time: 15500
    }, {
      say: "till the morning light",
      time: 16750
    }, {
      say: "Don't stand so",
      time: 18750
    }, {
      say: "don't stand so",
      time: 20500
    }, {
      say: "Don't stand so close to me",
      time: 22000
    }, {
      say: "Baby you belong to me",
      time: 37000
    }, {
      say: "Yes you do, yes you do",
      time: 40000
    }, {
      say: "You're my affection",
      time: 41750
    }, {
      say: "I can make a woman cry",
      time: 43000
    }, {
      say: "Yes I do, yes I do",
      time: 46250
    }, {
      say: "I well be good",
      time: 47750
    }, {
      say: "You're like a cruel device",
      time: 49750
    }, {
      say: "Your blood is cold like ice",
      time: 51000
    }, {
      say: "Poison for my veins,",
      time: 52500
    }, {
      say: "I'm breaking my chains",
      time: 54000
    }, {
      say: "One look and you can kill",
      time: 55750
    }, {
      say: "my pain now is your thrill",
      time: 57250
    }, {
      say: "Your love is for me",
      time: 58750
    }, {
      say: "I say",
      time: 61000
    }, {
      say: "Try me",
      time: 61750
    }, {
      say: "take a chance on emotions",
      time: 62750
    }, {
      say: "For now and ever",
      time: 64750
    }, {
      say: "close to your heart",
      time: 66000
    }, {
      say: "I say",
      time: 67000
    }, {
      say: "Try me",
      time: 67750
    }, {
      say: "take a chance on my passion",
      time: 68750
    }, {
      say: "We'll be together all the time",
      time: 71000
    }, {
      say: "I say",
      time: 73250
    }, {
      say: "Try me",
      time: 74000
    }, {
      say: "take a chance on emotions",
      time: 75000
    }, {
      say: "For now and ever",
      time: 77000
    }, {
      say: "into my heart",
      time: 78500
    }, {
      say: "I say",
      time: 79250
    }, {
      say: "Try me",
      time: 80000
    }, {
      say: "take a chance on my passion",
      time: 81000
    }, {
      say: "We'll be together",
      time: 83250
    }, {
      say: "till the morning light",
      time: 84500
    }, {
      say: "Don't stand so",
      time: 86750
    }, {
      say: "don't stand so",
      time: 88000
    }, {
      say: "Don't stand so close to me",
      time: 89500
    }, {
      say: "Baby let me take control",
      time: 104750
    }, {
      say: "Yes I do, yes I do",
      time: 107750
    }, {
      say: "You are my target",
      time: 109250
    }, {
      say: "No one ever made me cry",
      time: 111000
    }, {
      say: "What you do, what you do",
      time: 114000
    }, {
      say: "Baby's so bad",
      time: 115500
    }, {
      say: "You're like a cruel device",
      time: 117250
    }, {
      say: "Your blood is cold like ice",
      time: 118500
    }, {
      say: "Poison for my veins,",
      time: 120250
    }, {
      say: "I'm breaking my chains",
      time: 121750
    }, {
      say: "One look and you can kill",
      time: 123000
    }, {
      say: "my pain now is your thrill",
      time: 124750
    }, {
      say: "Your love is for me",
      time: 126500
    }, {
      say: "I say",
      time: 128500
    }, {
      say: "Try me",
      time: 129250
    }, {
      say: "take a chance on emotions",
      time: 130250
    }, {
      say: "For now and ever",
      time: 132750
    }, {
      say: "close to your heart",
      time: 133750
    }, {
      say: "I say",
      time: 134750
    }, {
      say: "Try me",
      time: 135500
    }, {
      say: "take a chance on my passion",
      time: 136500
    }, {
      say: "We'll be together all the time",
      time: 138750
    }, {
      say: "I say",
      time: 141000
    }, {
      say: "Try me",
      time: 141750
    }, {
      say: "take a chance on emotions",
      time: 142750
    }, {
      say: "For now and ever",
      time: 145000
    }, {
      say: "into my heart",
      time: 146000
    }, {
      say: "I say",
      time: 147000
    }, {
      say: "Try me",
      time: 147750
    }, {
      say: "take a chance on my passion",
      time: 148750
    }, {
      say: "We'll be together",
      time: 151000
    }, {
      say: "till the morning light",
      time: 152250
    }, {
      say: "Don't stand so",
      time: 154250
    }, {
      say: "don't stand so",
      time: 155750
    }, {
      say: "Don't stand so close to me",
      time: 157000
    }, {
      say: "I say",
      time: 184000
    }, {
      say: "Try me",
      time: 184750
    }, {
      say: "take a chance on emotions",
      time: 185500
    }, {
      say: "For now and ever",
      time: 188000
    }, {
      say: "close to your heart",
      time: 189000
    }, {
      say: "I say",
      time: 190000
    }, {
      say: "Try me",
      time: 190750
    }, {
      say: "take a chance on my passion",
      time: 192750
    }, {
      say: "We'll be together all the time",
      time: 194000
    }, {
      say: "I say",
      time: 196250
    }, {
      say: "Try me",
      time: 197000
    }, {
      say: "take a chance on emotions",
      time: 198000
    }, {
      say: "For now and ever",
      time: 200250
    }, {
      say: "into my heart",
      time: 201250
    }, {
      say: "I say",
      time: 202500
    }, {
      say: "Try me",
      time: 203250
    }, {
      say: "take a chance on my passion",
      time: 204000
    }, {
      say: "We'll be together",
      time: 206500
    }, {
      say: "till the morning light",
      time: 207500
    }, {
      say: "Don't stand so",
      time: 209750
    }, {
      say: "don't stand so",
      time: 211250
    }, {
      say: "Don't stand so close to me",
      time: 212750,
      end: true
    }];
    let vA59 = [{
      say: "Left me alone in the darkness",
      time: 14500
    }, {
      say: "Leave me okay",
      time: 17000
    }, {
      say: "Holding you show now",
      time: 20000
    }, {
      say: "You're heartless",
      time: 21000
    }, {
      say: "Left me alone in the darkness",
      time: 36500
    }, {
      say: "Leave me okay",
      time: 39250
    }, {
      say: "Left me alone in the darkness",
      time: 42250
    }, {
      say: "Leave me okay",
      time: 45000
    }, {
      say: "Holding you show now",
      time: 64500
    }, {
      say: "You're heartless",
      time: 65250
    }, {
      say: "Left me alone in the darkness",
      time: 67250
    }, {
      say: "Leave me okay",
      time: 84000
    }, {
      say: "Leave me okay",
      time: 89500
    }, {
      say: "Left me alone in the darkness",
      time: 103250
    }, {
      say: "Leave me okay",
      time: 106250
    }, {
      say: "Holding you show now",
      time: 109000
    }, {
      say: "You're heartless",
      time: 110000
    }, {
      say: "BASSLINE GONNA MAKE MY SHOTS",
      time: 113000
    }, {
      say: "Holding you show now",
      time: 131500
    }, {
      say: "You're heartless",
      time: 132500
    }, {
      say: "Left me alone in the darkness",
      time: 137000
    }, {
      say: "Leave me okay",
      time: 144000
    }, {
      say: "Left me alone in the darkness",
      time: 148000
    }, {
      say: "Leave me okay",
      time: 155000,
      end: true
    }];
    let vA60 = [{
      say: "This ain't where the",
      time: 9000
    }, {
      say: "Legends come from",
      time: 9750
    }, {
      say: "You're not what a",
      time: 12250
    }, {
      say: "Hero looks like",
      time: 13000
    }, {
      say: "Pretty little flower won't you",
      time: 15500
    }, {
      say: "Sit back down and go play nice",
      time: 18000
    }, {
      say: "Keep talking, keep laughing",
      time: 21500
    }, {
      say: "One day you'll wish you hadn't",
      time: 25000
    }, {
      say: "All the people want Fire, Fire",
      time: 28500
    }, {
      say: "Maybe it's time they",
      time: 31250
    }, {
      say: "Meet their dragon",
      time: 33000
    }, {
      say: "If you're gonna hold me down",
      time: 35500
    }, {
      say: "And you're not gonna let me in",
      time: 38750
    }, {
      say: "Into your castle walls",
      time: 41500
    }, {
      say: "None of you can keep them",
      time: 44300
    }, {
      say: "Cause if I gotta",
      time: 46850
    }, {
      say: "Bu bu burn it all down",
      time: 48000
    }, {
      say: "Then we'll burn it all down",
      time: 52000
    }, {
      say: "My oh my,",
      time: 55250
    }, {
      say: "Look at who ends up",
      time: 57000
    }, {
      say: "Bigger this time",
      time: 58500
    }, {
      say: "And if I gotta",
      time: 60000
    }, {
      say: "Bu bu break it all down",
      time: 61250
    }, {
      say: "Then let's break it all down",
      time: 65000
    }, {
      say: "Bye bye bye-",
      time: 68500
    }, {
      say: "Playing with fire",
      time: 70000
    }, {
      say: "And we burn it all down",
      time: 71850
    }, {
      say: "This is where the",
      time: 78500
    }, {
      say: "Bruises come from",
      time: 79250
    }, {
      say: "This is when the",
      time: 81800
    }, {
      say: "Game gets ugly",
      time: 82500
    }, {
      say: "These blood, sweat,",
      time: 84500
    }, {
      say: "Tears keep running",
      time: 86000
    }, {
      say: "Licking my plate'",
      time: 87750
    }, {
      say: "Cause I'm so hungry",
      time: 88750
    }, {
      say: "Keep talking, keep laughing",
      time: 91111
    }, {
      say: "One day you'll see what happen",
      time: 94500
    }, {
      say: "All the people want Fire, Fire",
      time: 98000
    }, {
      say: "It's about time they",
      time: 100900
    }, {
      say: "Meet their dragon",
      time: 102100
    }, {
      say: "If you're gonna hold me down",
      time: 105000
    }, {
      say: "And you're not gonna let me in",
      time: 108000
    }, {
      say: "Into your castle walls",
      time: 111000
    }, {
      say: "None of you can keep them",
      time: 114000
    }, {
      say: "Cause if I gotta",
      time: 116250
    }, {
      say: "Bu bu burn it all down",
      time: 117750
    }, {
      say: "Then we'll burn it all down",
      time: 121500
    }, {
      say: "My oh my,",
      time: 125000
    }, {
      say: "Look at who ends up",
      time: 126500
    }, {
      say: "Bigger this time",
      time: 128000
    }, {
      say: "And if I gotta",
      time: 129500
    }, {
      say: "Bu bu break it all down",
      time: 131000
    }, {
      say: "Then let's break it all down",
      time: 134850
    }, {
      say: "Bye bye bye-",
      time: 138000
    }, {
      say: "Playing with fire",
      time: 139750
    }, {
      say: "And we burn it all down",
      time: 141500
    }, {
      say: "It starts right now",
      time: 144750
    }, {
      say: "Baby you're surrounded",
      time: 148800
    }, {
      say: "Put your money where",
      time: 151800
    }, {
      say: "Your mouth is",
      time: 153000
    }, {
      say: "Bury your doubts",
      time: 155500
    }, {
      say: "Under the ground",
      time: 158000
    }, {
      say: "And they gonna watch you",
      time: 162000
    }, {
      say: "Step over the ashes",
      time: 164000
    }, {
      say: "Right now i'm taking my turn",
      time: 166500
    }, {
      say: "With the matches",
      time: 169000
    }, {
      say: "Cause if I gotta",
      time: 172750
    }, {
      say: "Bu bu burn it all down",
      time: 174000
    }, {
      say: "Then we'll burn it all down",
      time: 177750
    }, {
      say: "My oh my,",
      time: 181000
    }, {
      say: "Look at who ends up",
      time: 182800
    }, {
      say: "Bigger this time",
      time: 184500
    }, {
      say: "And if I gotta",
      time: 186000
    }, {
      say: "Bu bu break it all down",
      time: 187000
    }, {
      say: "Then let's break it all down",
      time: 191000
    }, {
      say: "Bye bye bye-",
      time: 194500
    }, {
      say: "Playing with fire",
      time: 196000
    }, {
      say: "And we burn it all down",
      time: 197750,
      end: true
    }];
    let vA61 = [{
      say: "Get myself into the game",
      time: 11300
    }, {
      say: "I'm a run it up anyway",
      time: 13700
    }, {
      say: "I get with the violence",
      time: 17000
    }, {
      say: "I don't think you wanna try it",
      time: 19500
    }, {
      say: "I'm too up",
      time: 22200
    }, {
      say: "I feel invincible",
      time: 23000
    }, {
      say: "I don't know if",
      time: 25900
    }, {
      say: "They get it though",
      time: 26500
    }, {
      say: "I'm too up",
      time: 28000
    }, {
      say: "I feel invincible",
      time: 28800
    }, {
      say: "Fuck what you said",
      time: 31250
    }, {
      say: "I'm invincible",
      time: 32000
    }, {
      say: "Lookin for a break",
      time: 34000
    }, {
      say: "And now I think",
      time: 35000
    }, {
      say: "I finally caught one",
      time: 35700
    }, {
      say: "We're talkin legendary status",
      time: 37100
    }, {
      say: "When it's all done",
      time: 38500
    }, {
      say: "I'm a star bitch",
      time: 40000
    }, {
      say: "If you ever saw one",
      time: 41300
    }, {
      say: "Law and order over here",
      time: 43000
    }, {
      say: "And it's a tall one meet",
      time: 44000
    }, {
      say: "Me at the top",
      time: 44900
    }, {
      say: "Its goin down",
      time: 46500
    }, {
      say: "They tryna fit in my circle",
      time: 47500
    }, {
      say: "I'm not around",
      time: 49200
    }, {
      say: "I was down before",
      time: 50400
    }, {
      say: "But not for the count",
      time: 52000
    }, {
      say: "Shit was real heavy",
      time: 53200
    }, {
      say: "Now it's dollars not the pounds",
      time: 54100
    }, {
      say: "Tell me what you smokin",
      time: 56150
    }, {
      say: "If you think that I'm a joke",
      time: 57000
    }, {
      say: "Only time I'm trippin is when",
      time: 59000
    }, {
      say: "I'm out on the road",
      time: 60250
    }, {
      say: "Only droppin joints if",
      time: 62000
    }, {
      say: "That shit is fuckin dope",
      time: 63000
    }, {
      say: "Scary when you see me",
      time: 64800
    }, {
      say: "Got them meming me like nope",
      time: 65650
    }, {
      say: "Nope, Nope, Nope...",
      time: 67250
    }, {
      say: "Hate to say it but",
      time: 68750
    }, {
      say: "We're running out of time",
      time: 70000
    }, {
      say: "I don't know bout you",
      time: 71650
    }, {
      say: "But I'ma make the most of mine",
      time: 72650
    }, {
      say: "Looking clean until a",
      time: 74400
    }, {
      say: "Young'n in the dirt",
      time: 75300
    }, {
      say: "Value through the roof",
      time: 77000
    }, {
      say: "Yeah yeah I know my worth",
      time: 78000
    }, {
      say: "Nato",
      time: 79250
    }, {
      say: "Get myself into the game",
      time: 79900
    }, {
      say: "I'm a run it up anyway",
      time: 82250
    }, {
      say: "I get with the violence",
      time: 85500
    }, {
      say: "I don't think you wanna try it",
      time: 88000
    }, {
      say: "I'm too up I feel invincible",
      time: 90900
    }, {
      say: "I don't know if",
      time: 94350
    }, {
      say: "They get it though",
      time: 95100
    }, {
      say: "I'm too up I feel invincible",
      time: 96750
    }, {
      say: "Fuck what you said",
      time: 99850
    }, {
      say: "I'm invincible",
      time: 100800
    }, {
      say: "If you wanna try to bring me",
      time: 102500
    }, {
      say: "Down you gotta reach me",
      time: 104000
    }, {
      say: "I'm high up in the clouds",
      time: 105500
    }, {
      say: "While you're just down there",
      time: 106500
    }, {
      say: "In the seaweeds",
      time: 107500
    }, {
      say: "I see these",
      time: 108125
    }, {
      say: "Little rappers they all wanna",
      time: 109000
    }, {
      say: "Be me",
      time: 109800
    }, {
      say: "But nobody wanna put the",
      time: 110500
    }, {
      say: "Work in",
      time: 111200
    }, {
      say: "Cause they think that",
      time: 111800
    }, {
      say: "I got it easy but thats sleezy",
      time: 112750
    }, {
      say: "My path to the top was hard",
      time: 113850
    }, {
      say: "But nothing out there could",
      time: 114900
    }, {
      say: "Make me stop every time",
      time: 115600
    }, {
      say: "I thought it went one way it",
      time: 117000
    }, {
      say: "Turned out that it did not",
      time: 118000
    }, {
      say: "Got so many obstacles",
      time: 119300
    }, {
      say: "From my opps",
      time: 120100
    }, {
      say: "So many praying",
      time: 120850
    }, {
      say: "That i would drop",
      time: 121750
    }, {
      say: "I had to go around the world",
      time: 122500
    }, {
      say: "Just to get to the",
      time: 123350
    }, {
      say: "End of my block",
      time: 124000
    }, {
      say: "I built my skin so tough",
      time: 125000
    }, {
      say: "Achieving all my desire",
      time: 126600
    }, {
      say: "I could walk through hell",
      time: 128000
    }, {
      say: "Without getting burned",
      time: 128850
    }, {
      say: "By the fire",
      time: 130250
    }, {
      say: "Oh I admire",
      time: 131000
    }, {
      say: "Those that are deniers",
      time: 132500
    }, {
      say: "Cause you messed around and",
      time: 133800
    }, {
      say: "Turned me to a cold",
      time: 134750
    }, {
      say: "Blooded fighter",
      time: 135500
    }, {
      say: "I'm so up I feel Invincible",
      time: 136700
    }, {
      say: "I hope my words",
      time: 139800
    }, {
      say: "Feel like insults",
      time: 140950
    }, {
      say: "I'm up right now",
      time: 142250
    }, {
      say: "You stuck right now",
      time: 143750
    }, {
      say: "Stay down there on the ground",
      time: 145150
    }, {
      say: "Get myself into the game",
      time: 148300
    }, {
      say: "I'm a run it up anyway",
      time: 150850
    }, {
      say: "I get with the violence",
      time: 154100
    }, {
      say: "I don't think you wanna try it",
      time: 156800
    }, {
      say: "I'm too up I feel invincible",
      time: 159500
    }, {
      say: "I don't know if",
      time: 163000
    }, {
      say: "They get it though",
      time: 163750
    }, {
      say: "I'm too up I feel invincible",
      time: 165150
    }, {
      say: "Fuck what you said",
      time: 168250
    }, {
      say: "I'm invincible",
      time: 169250
    }, {
      say: "Talk like I'm at the top now",
      time: 171300
    }, {
      say: "If you hit me I cant fall down",
      time: 173750
    }, {
      say: "Run up I'm not 2nd place and",
      time: 177000
    }, {
      say: "I tell 'em that I'm running",
      time: 179500
    }, {
      say: "All my bases",
      time: 180600
    }, {
      say: "I'm too up I feel invincible",
      time: 182500
    }, {
      say: "I don't know if",
      time: 185850
    }, {
      say: "They get it though",
      time: 186650
    }, {
      say: "I'm too up I feel invincible",
      time: 188000
    }, {
      say: "Fuck what you said",
      time: 191150
    }, {
      say: "I'm invincible",
      time: 192250,
      end: true
    }];
    let vA62 = [{}, {
      say: "giua menh mang doi hoa co lau",
      time: 11000
    }, {
      say: "chi tiec anh luon la nguoi den sau",
      time: 13000
    }, {
      say: "mot cuoc tinh anh van co giau",
      time: 15000
    }, {
      say: "giu rieng anh noi sau",
      time: 17000
    }, {
      say: "va gio dem may tu dau den day",
      time: 19500
    }, {
      say: "ma khien con tim nay dau den vay",
      time: 21500
    }, {
      say: "vi mot nguoi da den chiem lay",
      time: 23000
    }, {
      say: "nhung rung dong ve em",
      time: 26000
    }, {
      say: "nhin bong lau nghien giong",
      time: 28000
    }, {
      say: "nhu long minh con nhieu cho vo",
      time: 30000
    }, {
      say: "chieu mua roi khong ben doi",
      time: 32000
    }, {
      say: "nhung anh van cho e toi",
      time: 34000
    }, {
      say: "ngan yeu thuong sau cuoi",
      time: 36000
    }, {
      say: "xin duoc lam bau troi e oi",
      time: 38000
    }, {
      say: "yeu em khong nghi ngoi",
      time: 40000
    }, {
      say: "ga si tinh chi can the thoi",
      time: 44000
    }, {
      say: "nhin ngon den mo vut tat",
      time: 46000
    }, {
      say: "mua dang roi trong mat anh tim",
      time: 48000
    }, {
      say: "hinh bong cua em",
      time: 50500
    }, {
      say: "ma giong doi nhieu mong uoc",
      time: 53000
    }, {
      say: "mong ben em se mai yen binh",
      time: 55000
    }, {
      say: "tuoi xuan dep nhu anh trang",
      time: 57000
    }, {
      say: "giua menh mang doi hoa co lau",
      time: 59000
    }, {
      say: "chi tiec anh luon la nguoi den sau",
      time: 61000
    }, {
      say: "mot cuoc tinh anh van co giau",
      time: 63000
    }, {
      say: "giu rieng anh noi sau",
      time: 65000
    }, {
      say: "va gio dem may tu dau den day",
      time: 67000
    }, {
      say: "ma khien con tim nay dau den vay",
      time: 69000
    }, {
      say: "vi mot nguoi da den chiem lay",
      time: 71000
    }, {
      say: "nhung rung dong ve em",
      time: 73000
    }, {
      say: "nhin bong lau nghien giong",
      time: 75000
    }, {
      say: "nhu long minh con nhieu cho vo",
      time: 77000
    }, {
      say: "chieu mua roi khong ben doi",
      time: 79000
    }, {
      say: "nhung anh van cho e toi",
      time: 81000
    }, {
      say: "ngan yeu thuong sau cuoi",
      time: 83000
    }, {
      say: "xin duoc lam bau troi e oi",
      time: 85000
    }, {
      say: "yeu em khong nghi ngoi",
      time: 87000
    }, {
      say: "ga si tinh chi can the thoi",
      time: 89000
    }, {
      say: "nhin ngon den mo vut tat",
      time: 91000
    }, {
      say: "mua dang roi trong mat anh tim",
      time: 93000
    }, {
      say: "hinh bong cua em",
      time: 95000
    }, {
      say: "ma giong doi nhieu mong uoc",
      time: 97000
    }, {
      say: "mong ben em se mai yen binh",
      time: 99000
    }, {
      say: "tuoi xuan dep nhu anh trang",
      time: 101000
    }, {
      say: "cre Music by sevenGG#2373",
      time: 103000,
      end: true
    }];
    let vA63 = [{
      end: true
    }];
    let vA64 = [{
      end: true
    }];
    function f634() {
      return ``;
    }
    var v1022 = false;
    var vA65 = [];
    var v1023;
    var vLN0143 = 0;
    let vA66 = [v376, v377, v378, v379, v380, v381, v382, v383, v384];
    let vA67 = [vA56, vA57, vA58, vA59, vA60, vA61, vA62, vA63, vA64];
    function f635() {
      vA66.forEach(p1687 => {
        p1687.pause();
        p1687.currentTime = 0;
        p1687.oncanplaythrough = null;
      });
      vA65.forEach(p1688 => {
        clearTimeout(p1688);
      });
    }
    function f636(p1689) {
      let v1024 = vA66[parseInt(p1689) - 1];
      let v1025 = vA67[parseInt(p1689) - 1];
      v1023 = p1689;
      new Promise((p1690, p1691) => {
        try {
          f635();
          v1024.oncanplaythrough = p1692 => {
            if (f241("msync").checked) {
              v1024.play();
            }
            p1690("Reset Song");
          };
        } catch (e13) {
          p1691("Error: " + e13);
        }
      }).then(p1693 => {
        vA65 = [];
        v1025.forEach(p1694 => {
          vA65.push(setTimeout(() => {
            if (f241("showch").checked) {
              vP1614.send("6", p1694.say);
            } else {
              setTimeout(() => {
                v974.chatMessage = p1694.say;
                v974.chatCountdown = vP16144.chatCountdown;
              }, vNaN2);
            }
            if (p1694.end) {
              v1022 = false;
            }
          }, p1694.time));
        });
        v1022 = true;
        console.log(p1693);
      });
    }
    function f637() {
      vF24154.value = "";
      vF24155.style.display = "none";
    }
    let vF7 = function (p1695) {
      p1695.close();
    };
    var vA68 = ["motherfucking"];
    function f638(p1696) {
      var v1026;
      for (var vLN0144 = 0; vLN0144 < vA68.length; ++vLN0144) {
        if (p1696.indexOf(vA68[vLN0144]) > -1) {
          /*var renderText = function(text, newText) {
              tmpString = "";
              for (var y = 0; y < profanityList[i].length; ++y) {
                  if (profanityList[i] == text) {
                      tmpString += tmpString.length ? "" : newText;
                  }
              };
          }*/
          v1026 = "";
          for (var vLN0145 = 0; vLN0145 < vA68[vLN0144].length; ++vLN0145) {
            if (vA68[vLN0144] == p1696) {
              v1026 += v1026.length ? "o" : "M";
            }
          }
          ;
          var v1027 = new RegExp(vA68[vLN0144], "g");
          p1696 = p1696.replace(v1027, v1026);
        }
      }
      return p1696;
    }
    let vA69 = [];
    function f639(p1697, p1698) {
      var vFindPlayerBySID = f756(p1697);
      if (vFindPlayerBySID) {
        vFindPlayerBySID.chatMessage = f638(p1698);
        vFindPlayerBySID.chatCountdown = vP16144.chatCountdown;
        vA69.push({
          name: btoa(vFindPlayerBySID.name),
          text: btoa(p1698)
        });
        if (vA69.length > 20) {
          vA69.shift();
        }
        let v1028 = ``;
        vA69.forEach(p1699 => {
          v1028 += `${atob(p1699.name) + ": " + atob(p1699.text)}\n`;
          v1001.innerText = v1028;
        });
      }
    }
    // RESIZE:
    window.addEventListener("resize", vP16142.checkTrusted(f640));
    let v1029 = false;
    function f640() {
      v982 = window.innerWidth;
      v983 = window.innerHeight;
      var v1030 = Math.max(v982 / v980, v983 / v981) * vLN122;
      vF24114.width = v982;
      vF24114.height = v983;
      vF24114.style.width = v982 + "px";
      vF24114.style.height = v983 + "px";
      vF24114.style;
      v986.setTransform(v1030, 0, 0, v1030, (v982 * vLN122 - v980 * v1030) / 2, (v983 * vLN122 - v981 * v1030) / 2);
    }
    f640();
    // TOUCH INPUT:
    var v1031;
    f641(false);
    function f641(p1700) {
      v1031 = p1700;
      f627();
      // if (using) {
      //     chatButton.classList.add("mobile");
      // } else {
      //     chatButton.classList.remove("mobile");
      // }
    }
    window.setUsingTouch = f641;
    vF24114.addEventListener("touchmove", vP16142.checkTrusted(f642), false);
    function f642(p1701) {
      p1701.preventDefault();
      p1701.stopPropagation();
      f641(true);
      for (var vLN0146 = 0; vLN0146 < p1701.changedTouches.length; vLN0146++) {
        var v1032 = p1701.changedTouches[vLN0146];
        if (v1032.identifier == vO31.id) {
          vO31.currentX = v1032.pageX;
          vO31.currentY = v1032.pageY;
          f658();
        } else if (v1032.identifier == vO32.id) {
          vO32.currentX = v1032.pageX;
          vO32.currentY = v1032.pageY;
          v971 = 1;
        }
      }
    }
    vF24114.addEventListener("touchstart", vP16142.checkTrusted(f643), false);
    function f643(p1702) {
      p1702.preventDefault();
      p1702.stopPropagation();
      f641(true);
      for (var vLN0147 = 0; vLN0147 < p1702.changedTouches.length; vLN0147++) {
        var v1033 = p1702.changedTouches[vLN0147];
        if (v1033.pageX < document.body.scrollWidth / 2 && vO31.id == -1) {
          vO31.id = v1033.identifier;
          vO31.startX = vO31.currentX = v1033.pageX;
          vO31.startY = vO31.currentY = v1033.pageY;
          f658();
        } else if (v1033.pageX > document.body.scrollWidth / 2 && vO32.id == -1) {
          vO32.id = v1033.identifier;
          vO32.startX = vO32.currentX = v1033.pageX;
          vO32.startY = vO32.currentY = v1033.pageY;
          if (v974.buildIndex < 0) {
            v971 = 1;
            f657();
          }
        }
      }
    }
    vF24114.addEventListener("touchend", vP16142.checkTrusted(f644), false);
    vF24114.addEventListener("touchcancel", vP16142.checkTrusted(f644), false);
    vF24114.addEventListener("touchleave", vP16142.checkTrusted(f644), false);
    function f644(p1703) {
      p1703.preventDefault();
      p1703.stopPropagation();
      f641(true);
      for (var vLN0148 = 0; vLN0148 < p1703.changedTouches.length; vLN0148++) {
        var v1034 = p1703.changedTouches[vLN0148];
        if (v1034.identifier == vO31.id) {
          vO31.id = -1;
          f658();
        } else if (v1034.identifier == vO32.id) {
          vO32.id = -1;
          if (v974.buildIndex >= 0) {
            v971 = 1;
            f657();
          }
          v971 = 0;
          f657();
        }
      }
    }
    // MOUSE INPUT:
    const v1035 = document.getElementById("touch-controls-fullscreen");
    v1035.style.display = "block";
    v1035.addEventListener("mousemove", f645, false);
    function f645(p1704) {
      p1704.preventDefault();
      p1704.stopPropagation();
      f641(false);
      vLN0120 = p1704.clientX;
      vLN0121 = p1704.clientY;
    }
    let vO34 = {
      left: false,
      middle: false,
      right: false
    };
    v1035.addEventListener("mousedown", f646, false);
    let vLN0149 = 0;
    function f646(p1705) {
      f641(false);
      if (v971 != 1) {
        v971 = 1;
        if (p1705.button == 0) {
          if (f241("clicktype").checked) {
            vO34.left = !vO34.left;
          } else {
            vO34.left = true;
          }
        } else if (p1705.button == 1) {
          if (f241("clicksync").checked) {
            vA50.send(JSON.stringify(["dosync", "ratio"]));
            vLN0149 = Date.now();
          } else if (f241("clicktype").checked) {
            vO34.middle = !vO34.middle;
          } else {
            vO34.middle = true;
          }
        } else if (p1705.button == 2) {
          if (f241("clicktype").checked) {
            vO34.right = !vO34.right;
          } else {
            vO34.right = true;
          }
        }
      }
    }
    v1035.addEventListener("mouseup", f647, false);
    function f647(p1706) {
      f641(false);
      if (v971 != 0) {
        v971 = 0;
        if (!f241("clicktype").checked) {
          if (p1706.button == 0) {
            f657();
            vO34.left = false;
          } else if (p1706.button == 1) {
            vO34.middle = false;
          } else if (p1706.button == 2) {
            f657();
            vO34.right = false;
          }
        }
      }
    }
    v1035.addEventListener("wheel", f648, false);
    let v1036 = false;
    function f648(p1707) {
      if (p1707.deltaY < 0) {
        v1036 = true;
      } else {
        v1036 = false;
      }
    }
    // INPUT UTILS:
    function f649() {
      var vLN0150 = 0;
      var vLN0151 = 0;
      if (vO31.id != -1) {
        vLN0150 += vO31.currentX - vO31.startX;
        vLN0151 += vO31.currentY - vO31.startY;
      } else {
        for (var v1037 in vO35) {
          var v1038 = vO35[v1037];
          vLN0150 += !!v970[v1037] * v1038[0];
          vLN0151 += !!v970[v1037] * v1038[1];
        }
      }
      if (vLN0150 == 0 && vLN0151 == 0) {
        return undefined;
      } else {
        return vP16142.fixTo(Math.atan2(vLN0151, vLN0150), 2);
      }
    }
    function f650() {
      if (!v974) {
        return 0;
      }
      if (vO32.id != -1) {
        v1039 = Math.atan2(vO32.currentY - vO32.startY, vO32.currentX - vO32.startX);
      } else if (!v974.lockDir && !v1031) {
        v1039 = Math.atan2(vLN0121 - v983 / 2, vLN0120 - v982 / 2);
      }
      return vP16142.fixTo(v1039 || 0, 2);
    }
    var v1039;
    let vUndefined3 = undefined;
    let vLN0152 = 0;
    let vLN0153 = 0;
    function f651() {
      if (!v974) {
        return 0;
      }
      if (v1232 || vO34.left && v974.reloads[v974.weapons[0]] == 0 && !f241("grind").checked) {
        if (vA92.length) {
          if (vO34.middle) {
            return vA94.aim2;
          } else {
            return vA94.aim2;
          }
        } else {
          return f650();
        }
      } else if (vO34.right && v974.reloads[f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
        return f650();
      } else if (vO65.in && (f241("combat").value == "ae" ? true : v974.reloads[vO65.healths > vP16146.weapons[v974.weapons[0]].dmg && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0)) {
        return vO65.aim;
      } else if (v1237 == true) {
        vLN0152 += Math.PI * 2 / (9 / 4);
        return vLN0152;
      } else {
        if (vO32.id != -1) {
          v1039 = Math.atan2(vO32.currentY - vO32.startY, vO32.currentX - vO32.startX);
        } else if (!v974.lockDir && !v1031) {
          v1039 = Math.atan2(vLN0121 - v983 / 2, vLN0120 - v982 / 2);
        }
        if (vO66.tick % 2 === 0) {
          vLN0153 = vP16142.fixTo(v1039 || 0, 2);
        }
        if (f241("combat").value == "ae") {
          return vLN0153;
        } else {
          return vP16142.fixTo(v1039 || 0, 2);
        }
      }
    }
    var vO35 = {
      87: [0, -1],
      38: [0, -1],
      83: [0, 1],
      40: [0, 1],
      65: [-1, 0],
      37: [-1, 0],
      68: [1, 0],
      39: [1, 0]
    };
    function f652() {
      v970 = {};
      vP1614.send("e");
    }
    function f653() {
      return vF24143.style.display != "block" && vF24155.style.display != "block" && v394;
    }
    let vO36 = {
      slot0: false,
      slot2: false,
      slot4: false,
      slot5: false
    };
    let v1040 = false;
    let v1041 = false;
    let v1042 = false;
    let v1043 = false;
    function f654(p1708, p1709) {
      if (f241(p1709 + "k").checked) {
        if (p1708 == f241(p1709).value) {
          return true;
        }
      }
      return false;
    }
    let vUndefined4 = undefined;
    function f655(p1710) {
      var v1044 = p1710.which || p1710.keyCode || 0;
      if (v1044 == 27) {
        f623();
        if (!v970[v1044]) {
          v970[v1044] = 1;
          v1040 = !v1040;
          $("#modMenus").toggle();
          if (v1040) {
            v1252.style.display = "block";
            vF24134.style.display = "block";
            if (f241("visual").value == "me" || f241("visual").value == "zyenith") {
              vF24111.style.left = "330px";
              vF24111.style.width = "40px";
              vF24112.style.left = "270px";
              vF24112.style.width = "40px";
            } else {
              vF24111.style.right = "270px";
              vF24111.style.width = "40px";
              vF24112.style.right = "330px";
              vF24112.style.width = "40px";
            }
          } else {
            v1252.style.display = f241("visual").value == "me" || f241("visual").value == "zyenith" ? "block" : "none";
            vF24134.style.display = f241("visual").value == "me" || f241("visual").value == "zyenith" ? "none" : "block";
            if (f241("visual").value == "me" || f241("visual").value == "zyenith") {
              vF24111.style.left = "410px";
              vF24111.style.width = "40px";
              vF24112.style.left = "350px";
              vF24112.style.width = "40px";
            } else {
              vF24111.style.right = "270px";
              vF24111.style.width = "40px";
              vF24112.style.right = "330px";
              vF24112.style.width = "40px";
            }
          }
        }
      } else if (v974 && v974.alive && f653()) {
        if (!v970[v1044]) {
          v970[v1044] = 1;
          if (v1044 == 69) {
            f661();
          } else if (p1710.key == "c") {
            f613();
          } else if (f654(p1710.key, "songkey")) {
            f636(f241("songs").value);
          } else if (v1044 == 88) {
            f659();
          } else if (v974.weapons[v1044 - 49] != undefined) {
            f663(v974.weapons[v1044 - 49]);
          } else if (v974.items[v1044 - 49 - v974.weapons.length] != undefined) {
            f662(v974.items[v1044 - 49 - v974.weapons.length]);
          } else if (v1044 == 82) {
            vO63.wait = !vO63.wait;
            for (let vLN0154 = 0; vLN0154 < vA46.length; vLN0154++) {
              v976 = vA46[vLN0154];
              if (v976.visible) {
                if (v976.skinIndex == 6 || v976.skinIndex == 22) {
                  v976.anti = true;
                } else {
                  v976.anti = false;
                }
              }
            }
            if (f241("visual").value == "ae" || f241("visual").value == "0") {
              f660();
            }
          } else if (f654(p1710.key, "bowinstakey")) {
            vO63.rangeType();
          } else if (f654(p1710.key, "zeroframe")) {
            vO63.zeroFrame();
          } else if (f654(p1710.key, "synckey")) {
            vP1614.send("6", "pengu");
          } else if (vO35[v1044]) {
            f658();
          } else if (v1044 == 32) {
            v971 = 1;
            f657();
          } else if (p1710.key == "q") {
            f720(0, f651());
            vO36.slot0 = true;
          } else if (f654(p1710.key, "spikekey")) {
            vO36.slot2 = true;
          } else if (f654(p1710.key, "trapkey")) {
            vO36.slot4 = true;
          } else if (f654(p1710.key, "turretkey")) {
            vO36.slot5 = true;
          } else if (f654(p1710.key, "millkey")) {
            vO62.active = !vO62.active;
          } else if (f654(p1710.key, "botkey")) {
            f580();
          } else if (f654(p1710.key, "debugkey")) {
            new Promise((p1711, p1712) => {
              vO56.waitHit = false;
              vO63.isTrue = false;
              v1232 = false;
              vNaN2 = window.pingTime;
              vNaN = window.pingTime;
              vO56.antiBull = 0;
              vO56.antiBull2 = 0;
              f761();
              setTimeout(() => {
                if (!vO56.waitHit || !vO63.isTrue || !v1232 || !!vO56.antiBull || !!vO56.antiBull2) {
                  p1711("done");
                } else {
                  p1712("error");
                }
              }, 1000);
            }).then(p1713 => {
              console.log(p1713);
            });
          } else if (f654(p1710.key, "freecumLOL")) {
            vO40.active = !vO40.active;
            f241("freeCam").innerHTML = "Freecam: " + (vO40.active ? "true" : "none");
            f590();
          } else if (f654(p1710.key, "ezkey")) {
            v1236 = !v1236;
            if (v1236) {
              vUndefined4 = setInterval(() => {
                vP1614.send("6", vA97[Math.florr(Math.random() * vA97.length)]);
              }, 2700);
            } else {
              clearTimeout(vUndefined4);
            }
          } else if (f654(p1710.key, "zoomkey")) {
            v1043 = !v1043;
          } else if (f654(p1710.key, "zoomresetkey")) {
            v1043 = false;
            f590();
          }
        }
      }
    }
    window.addEventListener("keydown", vP16142.checkTrusted(f655));
    function f656(p1714) {
      if (v974 && v974.alive) {
        var v1045 = p1714.which || p1714.keyCode || 0;
        if (v1045 == 13) {
          f632();
        } else if (f653()) {
          if (v970[v1045]) {
            v970[v1045] = 0;
            if (vO35[v1045]) {
              f658();
            } else if (v1045 == 32) {
              v971 = 0;
              f657();
            } else if (p1714.key == "q") {
              f720(0, f651());
              vO36.slot0 = false;
            } else if (f654(p1714.key, "spikekey")) {
              vO36.slot2 = false;
            } else if (f654(p1714.key, "trapkey")) {
              vO36.slot4 = false;
            } else if (f654(p1714.key, "turretkey")) {
              vO36.slot5 = false;
            }
          }
        }
      }
    }
    window.addEventListener("keyup", vP16142.checkTrusted(f656));
    function f657() {
      if (v974 && v974.alive) {
        vP1614.send("F", v971, v974.buildIndex >= 0 ? f651() : null);
      }
    }
    var vUndefined5 = undefined;
    let vUndefined6 = undefined;
    let vLN0155 = 0;
    let vLN6 = 6;
    let vA70 = [6, 22];
    let vA71 = [51, 50, 28, 29, 30, 36, 37, 38, 44, 35, 42, 43, 49];
    function f658() {
      var vF649 = f649();
      if (vUndefined5 == undefined || vF649 == undefined || Math.abs(vF649 - vUndefined5) > 0.3) {
        if (!vO40.active) {
          vP1614.send("9", vF649);
        }
        vUndefined5 = vF649;
        vUndefined6 = vF649;
        if (vF649 != undefined) {
          vLN0155 = vF649 + Math.PI;
          vO62.count = 4;
        }
      }
      vO40.dir = vF649;
    }
    function f659() {
      v974.lockDir = v974.lockDir ? 0 : 1;
      vP1614.send("K", 0);
    }
    function f660() {
      vP1614.send("S", 1);
    }
    function f661() {
      vP1614.send("K", 1);
    }
    function f662(p1715, p1716) {
      vP1614.send("z", p1715, p1716);
    }
    function f663(p1717, p1718) {
      if (!p1718) {
        vO56.weaponCode = p1717;
      }
      vP1614.send("z", p1717, 1);
    }
    function f664(p1719, p1720) {
      vP1614.send("F", p1719, p1720 /* + (Math.PI*20000)*/);
    }
    function f665() {
      f585("moo_name", vF24137.value);
      if (!v984 && f582()) {
        let vA72 = ["The", "Rat", "Scout", "Math", "2022", "Absoult", "Mel", "July", "Rust", "Rest", "Improve", "Radio", "Radian", "Cel", "Goofy"];
        let vA73 = ["Man", "Girl", "Next", "Gen", "Mike", "Soul", "Sin", "Cos", "Name", "Unknown", "Real", "Here", "Pop", "Rad", "Fiz", "Ahh"];
        let v1046 = [vA72[Math.florr(Math.random() * vA72.length)], vA73[Math.florr(Math.random() * vA73.length)]].join(" ");
        v984 = true;
        v956.stop("menu");
        f593("Loading...");
        f588();
        vP1614.send("M", {
          name: f241("ranName").checked ? v1046 : vF24137.value,
          moofoll: vF587,
          skin: vLN0122
        });
        let vF24156 = f241("ot-sdk-btn-floating");
        if (vF24156) {
          vF24156.style.display = "none";
        }
      }
      //}
    }
    // SETUP GAME:
    var v1047 = true;
    function f666(p1721) {
      vF24125.style.display = "none";
      vF24123.style.display = "block";
      vF2412.style.display = "none";
      v970 = {};
      v975 = p1721;
      v971 = 0;
      v984 = true;
      if (v1047) {
        v1047 = false;
        vA48.length = 0;
        // old ae thing
        f706();
      }
    }
    // SHOW ANIM TEXT:
    let vO37 = {
      dmg: 0,
      heal: 0
    };
    let vO38 = {
      dmg: 0,
      heal: 0
    };
    function f667(p1722, p1723, p1724, p1725) {
      if (f241("hidetext").checked) {
        return;
      }
      let v1048 = Math.abs(p1724);
      new Promise((p1726, p1727) => {
        p1726({
          text: v1048,
          index: p1724 >= 0 ? "dmg" : "heal"
        });
      }).then(p1728 => {
        vO37[p1728.index] += p1728.text;
        if (p1728.index == "dmg") {
          if (!f241("stacktext").checked) {
            v950.showText(p1722, p1723, f241("visual").value == "hans" ? 60 : 50, 0.18, f241("visual").value == "fz" || f241("visual").value == "zyenith" || f241("visual").value == "spyder" ? f241("visual").value == "fz" || f241("visual").value == "zyenith" ? 1500 : 2000 : 500, p1728.text, "#fff");
          }
        } else if (p1728.index == "heal") {
          if (!f241("stacktext").checked) {
            v950.showText(p1722, p1723, f241("visual").value == "hans" ? 60 : 50, 0.18, f241("visual").value == "fz" || f241("visual").value == "zyenith" || f241("visual").value == "spyder" ? f241("visual").value == "fz" || f241("visual").value == "zyenith" ? 1500 : 2000 : 500, p1728.text, "#8ecc51");
          }
        }
        setTimeout(() => {
          if (vO37.dmg > 0) {
            vO38.dmg = vO37.dmg;
            if (f241("stacktext").checked) {
              v950.showText(p1722, p1723, f241("visual").value == "hans" ? 60 : 50, 0.18, f241("visual").value == "fz" || f241("visual").value == "zyenith" || f241("visual").value == "spyder" ? f241("visual").value == "fz" || f241("visual").value == "zyenith" ? 1500 : 2000 : 500, vO37.dmg, "#fff");
            }
            vO37.dmg = 0;
          }
          if (vO37.heal > 0) {
            vO38.heal = vO37.heal;
            if (f241("stacktext").checked) {
              v950.showText(p1722, p1723, f241("visual").value == "hans" ? 60 : 50, 0.18, f241("visual").value == "fz" || f241("visual").value == "zyenith" || f241("visual").value == "spyder" ? f241("visual").value == "fz" || f241("visual").value == "zyenith" ? 1500 : 2000 : 500, vO37.heal, "#8ecc51");
            }
            vO37.heal = 0;
          }
        }, 1);
      });
    }
    // KILL PLAYER:
    var vLN99999 = 99999;
    let vLN0156 = 0;
    function f668() {
      vLN0156++;
      v984 = false;
      try {
        factorem.refreshAds([2], true);
      } catch (e14) {}
      vF24126.style.display = "none";
      f623();
      v1006 = {
        x: v974.x,
        y: v974.y
      };
      vF24125.style.display = "none";
      vF24147.style.display = f241("visual").value == "hans" || f241("visual").value == "me" ? "none" : "block";
      vF24147.style.fontSize = "0px";
      vLN99999 = 0;
      setTimeout(function () {
        vF24123.style.display = "block";
        vF2412.style.display = "block";
        vF24147.style.display = "none";
        if (f241("tryhard").checked) {
          f595();
        }
      }, f241("tryhard").checked || f241("visual").value == "cele" || f241("visual").value == "ae" || f241("visual").value == "fz" || f241("visual").value == "zyenith" ? 0 : vP16144.deathFadeout);
    }
    // KILL ALL OBJECTS BY A PLAYER:
    function f669(p1729) {
      if (v974) {
        v991.removeAllItems(p1729);
      }
    }
    // KILL OBJECT:
    let vA74 = [];
    let v1049 = false;
    function f670() {
      let vLN0157 = 0;
      for (let vLN0158 = 0;; vLN0158 += Math.PI / 2.4) {
        vLN0157++;
        if (vLN0157 > 4) {
          break;
        }
        f721(5, vLN0158);
      }
    }
    f241("grind").onclick = function () {
      if (f241("grind").checked) {
        f670();
      }
    };
    function f671(p1730) {
      try {
        var vFindObjectBySid = f758(p1730);
        var v1050 = vP16142.getDirect(vFindObjectBySid, v974, 0, 2);
        var v1051 = vP16142.getDist(vFindObjectBySid, v974, 0, 2);
      } catch (e15) {} finally {
        v991.disableBySid(p1730);
      }
      try {
        if (v974.alive) {
          if (f241("grind").checked) {
            if (v1051 <= 150 && v974.items[5]) {
              f745(() => {
                f670();
              }, 1);
            }
          } else if (f241("replc").checked && vA92.length) {
            let v1052 = vP16146.weapons[v974.weapons[0]].range + 70;
            if (f241("spiketick").checked && v1051 <= v1052 && vA94.dist2 <= v1052) {
              v1049 = true;
              f739();
            }
            if (v1051 <= 400) {
              if (vA94.dist2 <= 250) {
                for (let v1053 = -1; v1053 <= 1; v1053++) {
                  f721(2, v1050 + v1053);
                }
                f739();
              } else if (vA94.dist2 > 250 && vA94.dist2 < 500) {
                for (let vLN0159 = 0; vLN0159 < Math.PI * 2; vLN0159 += Math.PI / 2) {
                  if (v974.items[4] == 15) {
                    f721(4, v1050 + vLN0159);
                  }
                }
                f739();
              }
            }
          }
        }
        if (v1051 > 1200) {
          if (vA74.length >= 7) {
            vA74 = [];
          }
          vA74.push({
            x: vFindObjectBySid.x,
            y: vFindObjectBySid.y
          });
        }
      } catch (e16) {}
    }
    // UPDATE SCORE DISPLAY:
    function f672() {
      vF24128.innerText = v974.points;
      vF24129.innerText = v974.food;
      vF24130.innerText = v974.wood;
      vF24131.innerText = v974.stone;
      if (v974.kills > vF24132.innerText) {
        vP1614.send("6", f241("ggezCh").value);
      }
      vF24132.innerText = v974.kills;
    }
    +vP16149.kills;
    // ICONS:
    var vO39 = {};
    var vA75 = ["crown", "skull", "cross1", "cross2"];
    function f673() {
      for (var vLN0160 = 0; vLN0160 < vA75.length; ++vLN0160) {
        var v1054 = new Image();
        v1054.onload = function () {
          this.isLoaded = true;
        };
        if (vA75[vLN0160] == "cross1") {
          v1054.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/100px-Crosshairs_Red.svg.png";
        } else if (vA75[vLN0160] == "cross2") {
          v1054.src = "https://cdn.discordapp.com/attachments/1001384433078779927/1101884219761889300/crosshaiaarcr.png";
        } else {
          v1054.src = ".././img/icons/" + vA75[vLN0160] + ".png";
        }
        vO39[vA75[vLN0160]] = v1054;
      }
    }
    // UPDATE UPGRADES:
    var vA76 = [];
    let v1055 = false;
    let vLN0161 = 0;
    function f674(p1731, p1732) {
      v974.upgradePoints = p1731;
      v974.upgrAge = p1732;
      vLN0161 = p1731;
      if (p1731 > 0) {
        vA76.length = 0;
        vP16142.removeAllChildren(vF24141);
        for (var vLN0164 = 0; vLN0164 < vP16146.weapons.length; ++vLN0164) {
          if (vP16146.weapons[vLN0164].age == p1732 && (vP16146.weapons[vLN0164].pre == undefined || v974.weapons.indexOf(vP16146.weapons[vLN0164].pre) >= 0)) {
            var v1058 = vP16142.generateElement({
              id: "upgradeItem" + vLN0164,
              class: "actionBarItem",
              onmouseout: function () {
                f597();
              },
              parent: vF24141
            });
            v1058.style.backgroundImage = f241("actionBarItem" + vLN0164).style.backgroundImage;
            vA76.push(vLN0164);
          }
        }
        for (var vLN0164 = 0; vLN0164 < vP16146.list.length; ++vLN0164) {
          if (vP16146.list[vLN0164].age == p1732 && (vP16146.list[vLN0164].pre == undefined || v974.items.indexOf(vP16146.list[vLN0164].pre) >= 0)) {
            var v1057 = vP16146.weapons.length + vLN0164;
            var v1058 = vP16142.generateElement({
              id: "upgradeItem" + v1057,
              class: "actionBarItem",
              onmouseout: function () {
                f597();
              },
              parent: vF24141
            });
            v1058.style.backgroundImage = f241("actionBarItem" + v1057).style.backgroundImage;
            vA76.push(v1057);
          }
        }
        for (var vLN0164 = 0; vLN0164 < vA76.length; vLN0164++) {
          (function (p1733) {
            var vF24157 = f241("upgradeItem" + p1733);
            vF24157.onmouseover = function () {
              if (vP16146.weapons[p1733]) {
                f597(vP16146.weapons[p1733], true);
              } else {
                f597(vP16146.list[p1733 - vP16146.weapons.length]);
              }
            };
            vF24157.onclick = vP16142.checkTrusted(function () {
              if (!v1055) {
                v1055 = true;
                f675(p1733);
                if (p1733 >= 0 && p1733 <= 15) {
                  if (p1733 < 9) {
                    f663(p1733);
                  } else if (p1733 > 8) {
                    f663(v974.weapons[0]);
                  }
                }
                setTimeout(() => {
                  v1055 = false;
                }, window.pingTime * 1.2);
              }
            });
            vP16142.hookTouchEvents(vF24157);
          })(vA76[vLN0164]);
        }
        if (vA76.length) {
          vF24141.style.display = "block";
          vF24142.style.display = "block";
          vF24142.innerHTML = "SELECT ITEMS (" + p1731 + ")";
          if (f241("aaauaua").checked) {
            f676(f241("autoupgrade").value);
          }
        } else {
          vF24141.style.display = "none";
          vF24142.style.display = "none";
          f597();
        }
      } else {
        vF24141.style.display = "none";
        vF24142.style.display = "none";
        f597();
      }
    }
    function f675(p1734) {
      v974.reloads[p1734] = 0;
      vP1614.send("H", p1734);
    }
    let v1059 = false;
    let vLSAe86modnocapezez = "ae86modnocapezez";
    function f676(p1735) {
      let vF8 = function (p1736) {
        if (!v1059) {
          if (f241("upgradeItem" + p1736) && f241("upgradeItem" + p1736).style.display != "none") {
            v1059 = true;
            f675(p1736);
            if (p1736 >= 0 && p1736 <= 15) {
              if (p1736 < 9) {
                f663(p1736);
              } else if (p1736 > 8) {
                f663(v974.weapons[0]);
              }
            }
            setTimeout(() => {
              v1059 = false;
            }, window.pingTime);
          }
        }
      };
      if (p1735 == "dh") {
        if (vLSAe86modnocapezez != "kh" && vLSAe86modnocapezez != "sm") {
          f745(() => {
            vLSAe86modnocapezez = "dh";
            vF8(7);
            vF8(17);
            vF8(31);
            vF8(27);
            vF8(10);
            vF8(f241("7slot").value);
            vF8(28);
            vF8(25);
          }, 1);
        }
      } else if (p1735 == "kh") {
        if (vLSAe86modnocapezez != "dh" && vLSAe86modnocapezez != "sm") {
          f745(() => {
            vLSAe86modnocapezez = "kh";
            vF8(3);
            vF8(17);
            vF8(31);
            vF8(27);
            vF8(10);
            vF8(f241("7slot").value);
            vF8(4);
            vF8(25);
          }, 1);
        }
      } else if (p1735 == "sm") {
        if (vLSAe86modnocapezez != "dh" && vLSAe86modnocapezez != "kh") {
          f745(() => {
            vLSAe86modnocapezez = "sm";
            vF8(3);
            vF8(17);
            vF8(31);
            vF8(23);
            vF8(9);
            vF8(f241("7slot").value);
          }, 1);
        }
      }
    }
    f241("aaauaua").onclick = function () {
      if (f241("aaauaua").checked) {
        f676(f241("autoupgrade").value);
      }
    };
    // UPDATE AGE:
    function f677(p1737, p1738, p1739) {
      if (p1737 != undefined) {
        v974.XP = p1737;
      }
      if (p1738 != undefined) {
        v974.maxXP = p1738;
      }
      if (p1739 != undefined) {
        v974.age = p1739;
      }
      if (p1739 == vP16144.maxAge) {
        vF24139.innerHTML = "MAX AGE";
        vF24140.style.width = f241("visual").value == "cele" || f241("visual").value == "zeph" ? "0%" : "100%";
      } else {
        vF24139.innerHTML = "AGE " + v974.age;
        if (f241("visual").value == "hans") {
          vF24140.style.transition = "1s";
        } else {
          vF24140.style.transition = null;
        }
        vF24140.style.width = (f241("visual").value == "cele" || f241("visual").value == "zeph" ? "0" : v974.XP / v974.maxXP * 100) + "%";
      }
    }
    // UPDATE LEADERBOARD:
    function f678(p1740) {
      vP16142.removeAllChildren(vF24136);
      var vLN124 = 1;
      for (var vLN0165 = 0; vLN0165 < p1740.length; vLN0165 += 3) {
        (function (p1741) {
          vP16142.generateElement({
            class: "leaderHolder",
            parent: vF24136,
            children: [vP16142.generateElement({
              class: "leaderboardItem",
              style: "color:" + (p1740[p1741] == v975 ? f241("visual").value == "fz" ? v388 ? "rgba(204,81,81,0.6)" : "#8ecc51" : v388 ? "rgba(255,255,255,0.6)" : "#fff" : f241("visual").value == "zeph" ? "rgba(204,81,81,0.6)" : "rgba(255,255,255,0.6)"),
              text: (f241("visual").value == "zeph" ? "{" + p1740[p1741] + "} " : "") + vLN124 + ". " + (v388 ? "unknown" : p1740[p1741 + 1] != "" ? p1740[p1741 + 1] : "unknown")
            }), vP16142.generateElement({
              class: "leaderScore",
              text: vP16142.kFormat(p1740[p1741 + 2]) || "0"
            })]
          });
        })(vLN0165);
        vLN124++;
      }
    }
    // UPDATE GAME:
    let vO40 = {
      active: false,
      dir: undefined
    };
    function f679() {
      if (true) {
        // UPDATE DIRECTION:
        if (v974) {
          if (!v968 || v967 - v968 >= 1000 / vP16144.clientSendRate) {
            v968 = v967;
            /*let atckDir = getAttackDir();
                        if (lessDir !== atckDir) {
                            lessDir = atckDir;
                            io.send("D", atckDir);
                        }*/
          }
        }
        // DEATH TEXT:
        if (vLN99999 < 120) {
          vLN99999 += v966 * 0.1;
          vF24147.style.fontSize = Math.min(Math.round(vLN99999), 120) + "px";
        }
        // MOVE CAMERA:
        if (v974) {
          if (vO40.active) {
            if (vO40.dir !== undefined) {
              v977 += Math.cos(vO40.dir) * 20;
              v978 += Math.sin(vO40.dir) * 20;
            }
          } else {
            var v1060 = vP16142.getDistance(v977, v978, v974.x, v974.y);
            var v1061 = vP16142.getDirection(v974.x, v974.y, v977, v978);
            var v1062 = Math.min(v1060 * 0.01 * v966, v1060);
            if (v1060 > 0.05) {
              v977 += v1062 * Math.cos(v1061);
              v978 += v1062 * Math.sin(v1061);
            } else {
              v977 = v974.x;
              v978 = v974.y;
            }
          }
        } else {
          v977 = vP16144.mapScale / 2;
          v978 = vP16144.mapScale / 2;
        }
        // INTERPOLATE PLAYERS AND AI:
        var v1063 = v967 - 1000 / vP16144.serverUpdateRate;
        var v1070;
        for (var vLN0167 = 0; vLN0167 < vA46.length + vA45.length; ++vLN0167) {
          v976 = vA46[vLN0167] || vA45[vLN0167 - vA46.length];
          if (v976 && v976.visible) {
            if (v976.forcePos) {
              v976.x = v976.x2;
              v976.y = v976.y2;
              v976.dir = v976.d2;
            } else {
              var v1065 = v976.t2 - v976.t1;
              var v1066 = v1063 - v976.t1;
              var v1067 = v1066 / v1065;
              var vLN170 = 170;
              var v1068 = vP16144.tickRate;
              v976.dt += v966;
              v976.rt = Math.min(1, v976.dt / vP16144.tickRate);
              var v1069 = Math.min(1.7, v976.dt / vLN170);
              var v1070 = v976.x2 - v976.x1;
              v976.x = v976.x1 + v1070 * v1069;
              v1070 = v976.y2 - v976.y1;
              v976.y = v976.y1 + v1070 * v1069;
              v976.dir = Math.lerpAngle(v976.d2, v976.d1, Math.min(1.2, v1067));
            }
          }
        }
        // RENDER CORDS:
        var v1071 = v977 - v980 / 2;
        var v1072 = v978 - v981 / 2;
        // RENDER BACKGROUND:
        let v1073 = f241("visual").value == "me" || f241("visual").value == "spyder" ? v1251 ? vO71 : vO70 : vO70;
        if (vP16144.snowBiomeTop - v1072 <= 0 && vP16144.mapScale - vP16144.snowBiomeTop - v1072 >= v981) {
          v986.fillStyle = v1073.grass;
          v986.fillRect(0, 0, v980, v981);
        } else if (vP16144.mapScale - vP16144.snowBiomeTop - v1072 <= 0) {
          v986.fillStyle = v1073.desert;
          v986.fillRect(0, 0, v980, v981);
        } else if (vP16144.snowBiomeTop - v1072 >= v981) {
          v986.fillStyle = v1073.snow;
          v986.fillRect(0, 0, v980, v981);
        } else if (vP16144.snowBiomeTop - v1072 >= 0) {
          v986.fillStyle = v1073.snow;
          v986.fillRect(0, 0, v980, vP16144.snowBiomeTop - v1072);
          v986.fillStyle = v1073.grass;
          v986.fillRect(0, vP16144.snowBiomeTop - v1072, v980, v981 - (vP16144.snowBiomeTop - v1072));
        } else {
          v986.fillStyle = v1073.grass;
          v986.fillRect(0, 0, v980, vP16144.mapScale - vP16144.snowBiomeTop - v1072);
          v986.fillStyle = v1073.desert;
          v986.fillRect(0, vP16144.mapScale - vP16144.snowBiomeTop - v1072, v980, v981 - (vP16144.mapScale - vP16144.snowBiomeTop - v1072));
        }
        // RENDER WATER AREAS:
        if (!v1047) {
          vLN123 += vLN0119 * vP16144.waveSpeed * v966;
          if (vLN123 >= vP16144.waveMax) {
            vLN123 = vP16144.waveMax;
            vLN0119 = -1;
          } else if (vLN123 <= 1) {
            vLN123 = vLN0119 = 1;
          }
          v986.globalAlpha = 1;
          v986.fillStyle = v1073.desert;
          f683(v1071, v1072, v986, f241("visual").value == "me" ? 1440 : vP16144.riverPadding);
          v986.fillStyle = v1073.river;
          f683(v1071, v1072, v986, (vLN123 - 1) * 250);
        }
        // RENDER GRID:
        if (f241("visual").value != "cele" && f241("visual").value != "zeph") {
          v986.lineWidth = f241("visual").value == "me" ? 3 : 4;
          v986.strokeStyle = "#000";
          v986.globalAlpha = f241("visual").value == "me" ? 0.05 : 0.06;
          v986.beginPath();
          let v1074 = f241("visual").value == "me" ? 120 : f241("visual").value == "ae" ? 500 : 60 || f241("visual").value == "fz" ? 700 : 60;
          for (var v1075 = -v1071 % v1074; v1075 < v980; v1075 += v1074) {
            if (v1075 > 0) {
              v986.moveTo(v1075, 0);
              v986.lineTo(v1075, v981);
            }
          }
          for (var v1076 = -v1072 % v1074; v1076 < v981; v1076 += v1074) {
            if (v1076 > 0) {
              v986.moveTo(0, v1076);
              v986.lineTo(v980, v1076);
            }
          }
          v986.stroke();
        }
        // RENDER BOTTOM LAYER:
        v986.globalAlpha = 1;
        v986.strokeStyle = vLS525252;
        f684(-1, v1071, v1072);
        // RENDER PROJECTILES:
        v986.globalAlpha = 1;
        v986.lineWidth = vLN55;
        f681(0, v1071, v1072);
        // RENDER PLAYERS:
        f687(v1071, v1072, 0);
        // RENDER AI:
        v986.globalAlpha = 1;
        for (var vLN0167 = 0; vLN0167 < vA45.length; ++vLN0167) {
          v976 = vA45[vLN0167];
          if (v976.active && v976.visible) {
            v976.animate(v966);
            v986.save();
            v986.translate(v976.x - v1071, v976.y - v1072);
            v986.rotate(v976.dir + v976.dirPlus - Math.PI / 2);
            f718(v976, v986);
            v986.restore();
          }
        }
        // RENDER GAME OBJECTS (LAYERED):
        f684(0, v1071, v1072);
        f681(1, v1071, v1072);
        f684(1, v1071, v1072);
        f687(v1071, v1072, 1);
        f684(2, v1071, v1072);
        f684(3, v1071, v1072);
        // MAP BOUNDARIES:
        v986.fillStyle = "#000";
        v986.globalAlpha = 0.09;
        if (v1071 <= 0) {
          v986.fillRect(0, 0, -v1071, v981);
        }
        if (vP16144.mapScale - v1071 <= v980) {
          var v1077 = Math.max(0, -v1072);
          v986.fillRect(vP16144.mapScale - v1071, v1077, v980 - (vP16144.mapScale - v1071), v981 - v1077);
        }
        if (v1072 <= 0) {
          v986.fillRect(-v1071, 0, v980 + v1071, -v1072);
        }
        if (vP16144.mapScale - v1072 <= v981) {
          var v1078 = Math.max(0, -v1071);
          var vLN0168 = 0;
          if (vP16144.mapScale - v1071 <= v980) {
            vLN0168 = v980 - (vP16144.mapScale - v1071);
          }
          v986.fillRect(v1078, vP16144.mapScale - v1072, v980 - v1078 - vLN0168, v981 - (vP16144.mapScale - v1072));
        }
        // RENDER DAY/NIGHT TIME:
        v986.globalAlpha = 1;
        v986.fillStyle = "rgba(0, 0, 70, 0.35)";
        v986.fillRect(0, 0, v980, v981);
        // RENDER PLAYER AND AI UI / PLAYERINFOS:
        v986.strokeStyle = vLS3d3f42;
        vA46.forEach(p1742 => {
          v976 = p1742;
          if (v976.visible) {
            // NAME AND HEALTH:
            if (v976.skinIndex != 10 || v976 == v974 || v976.team && v976.team == v974.team) {
              v986.strokeStyle = vLS3d3f42;
              v986.globalAlpha = 1;
              let v1079 = v388 ? v976 == v974 ? "unknown" : v976.name : v976.name;
              var v1080 = f241("visual").value == "me" ? (v976.team ? "[" + v976.team + "] " : "") + ("[" + v976.sid + "] ") + (v1079 || "") : f241("visual").value == "spyder" ? (v976.team ? "[" + v976.team + "] " : "") + (" [" + Math.floor(v976.health) + "/100] {" + v976.sid + "} ") + (v1079 || "") + (" <" + v976.shameCount + ">") : f241("visual").value == "lore" ? (v976.team ? "[" + v976.team + "] " : "") + ("{" + v976.sid + "} ") + (v1079 || "") : f241("visual").value == "cele" ? (v976.team ? "[" + v976.team + "] " : "") + (v1079 || "") + (" {" + v976.shameCount + "}") : f241("visual").value == "fz" || f241("visual").value == "zyenith" ? (v976.team ? "[" + v976.team + "] " : "") + (v976 != v974 ? "[" + v976.primaryIndex + "/" + v976.secondaryIndex + "/" + v976.healSid + "] " : "") + (v1079 || "") : (v976.team ? "[" + v976.team + "] " : "") + (v1079 || "");
              if (v1080 != "") {
                v986.font = (v976.nameScale || 30) + "px Hammersmith One";
                v986.fillStyle = "#fff";
                v986.textBaseline = "middle";
                v986.textAlign = "center";
                v986.lineWidth = v976.nameScale ? 11 : 8;
                v986.lineJoin = "round";
                v986.strokeText(v1080, v976.x - v1071, v976.y - v1072 - v976.scale - vP16144.nameY);
                v986.fillText(v1080, v976.x - v1071, v976.y - v1072 - v976.scale - vP16144.nameY);
                if (v976.isLeader && vO39.crown.isLoaded) {
                  var v1088 = vP16144.crownIconScale;
                  var v1089 = v976.x - v1071 - v1088 / 2 - v986.measureText(v1080).width / 2 - vP16144.crownPad;
                  v986.drawImage(vO39.crown, v1089, v976.y - v1072 - v976.scale - vP16144.nameY - v1088 / 2 - 5, v1088, v1088);
                }
                if (v976.iconIndex == 1 && vO39.skull.isLoaded) {
                  var v1088 = vP16144.crownIconScale;
                  var v1089 = v976.x - v1071 - v1088 / 2 + v986.measureText(v1080).width / 2 + vP16144.crownPad;
                  v986.drawImage(vO39.skull, v1089, v976.y - v1072 - v976.scale - vP16144.nameY - v1088 / 2 - 5, v1088, v1088);
                }
                if (vO63.wait && vA94.sid == v976.sid && vO39["cross" + (v976.anti ? "1" : "2")].isLoaded && f241("visual").value != "0" && f241("visual").value != "zyenith" && vA92.length) {
                  var v1088 = vA94.scale * 2.2;
                  v986.drawImage(vO39["cross" + (v976.anti ? "1" : "2")], vA94.x - v1071 - v1088 / 2, vA94.y - v1072 - v1088 / 2, v1088, v1088);
                }
              }
              if ((f241("visual").value == "ae" ? v976 == v974 ? true : v976.hitted : true) && v976.health > 0) {
                // HEALTH HOLDER:
                var v1095 = vP16144.healthBarWidth;
                v986.fillStyle = vLS3d3f42;
                v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad, v976.y - v1072 + v976.scale + vP16144.nameY, vP16144.healthBarWidth * 2 + vP16144.healthBarPad * 2, 17, 8);
                v986.fill();
                // HEALTH BAR:
                v986.fillStyle = f741(v976) ? "#8ecc51" : "#cc5151";
                v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth, v976.y - v1072 + v976.scale + vP16144.nameY + vP16144.healthBarPad, vP16144.healthBarWidth * 2 * (v976.health / v976.maxHealth), 17 - vP16144.healthBarPad * 2, 7);
                v986.fill();
              }
              //wasd
              if (f241("visual").value != "0" && f241("visual").value != "ae") {
                if (f241("visual").value != "zeph" && !f241("visual").value != "hans") {
                  v986.font = "20px Hammersmith One";
                  v986.fillStyle = "#fff";
                  v986.textBaseline = "middle";
                  v986.textAlign = "center";
                  v986.lineWidth = f241("visual").value == "fz" || f241("visual").value == "zyenith" ? v976.scale / 10 : v976.nameScale ? 11 : 8;
                  v986.lineJoin = "round";
                  if (v976 == v974) {
                    if (f241("visual").value == "me") {
                      v986.strokeText("[" + [v976.projDist, v976.turretReloaded].join("/") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                      v986.fillText("[" + [v976.projDist, v976.turretReloaded].join("/") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                    } else if (f241("visual").value == "zyenith") {
                      let v1087 = !isNaN(vNaN) ? [vNaN, window.pingTime, vNaN2] : ["n", "a"];
                      v986.strokeText("[" + v976.turretReloaded + "," + v1087.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                      v986.fillText("[" + v976.turretReloaded + "," + v1087.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                    } else if (f241("visual").value == "fz") {
                      let vA77 = [window.pingTime, `${v1187 ? "True" : "False"}`, vNaN2];
                      v986.strokeText("[" + vA77.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                      v986.fillText("[" + vA77.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                    }
                  } else if (f241("visual").value == "me") {
                    v986.strokeText("[" + [v976.healSid, v976.instaThreat].join("/") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                    v986.fillText("[" + [v976.healSid, v976.instaThreat].join("/") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                  } else if (f241("visual").value == "zyenith") {
                    // @zyenith !send method 40 Wealthy 69
                    let vA78 = [v976.maxShame, 0, 0];
                    v986.strokeText("[" + vA78.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                    v986.fillText("[" + vA78.join(",") + "]", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 27);
                  }
                }
                if (f241("visual").value == "spyder") {
                  v986.strokeText(v976.reloads[53] == 0 ? "true" : "false", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 30);
                  v986.fillText(v976.reloads[53] == 0 ? "true" : "false", v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 30);
                } else if (f241("visual").value == "lore") {
                  v986.strokeText(v976.shameCount, v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 30);
                  v986.fillText(v976.shameCount, v976.x - v1071, v976.y - v1072 + v976.scale + vP16144.nameY + 30);
                }
                if (f241("visual").value != "0" && f241("visual").value != "zeph") {
                  if (f241("visual").value == "me" || f241("visual").value == "fz" || f241("visual").value == "zyenith") {
                    v986.font = (v976.nameScale || 30) + "px Hammersmith One";
                    v986.fillStyle = f241("visual").value == "fz" || f241("visual").value == "zyenith" ? "#3cbd89" : v976.shameCount < v976.dangerShame ? "#e6e6fa" : "#cc5151";
                    v986.textBaseline = "middle";
                    v986.textAlign = "center";
                    v986.lineWidth = v976.nameScale ? 11 : 8;
                    v986.lineJoin = "round";
                    var v1088 = vP16144.crownIconScale;
                    var v1089 = v976.x - v1071 - v1088 / 2 + v986.measureText(v1080).width / 2 + vP16144.crownPad + (v976.iconIndex == 1 ? (v976.nameScale || 30) * 2.75 : v976.nameScale || 30);
                    v986.strokeText(v976.shameCount, v1089, v976.y - v1072 - v976.scale - vP16144.nameY);
                    v986.fillText(v976.shameCount, v1089, v976.y - v1072 - v976.scale - vP16144.nameY);
                  }
                  if (f241("visual").value == "fz" ? v976 == v974 : true) {
                    let v1090 = f241("visual").value == "fz" ? 5.2 : 0;
                    let v1091 = f241("visual").value == "fz" ? -1.5 : -1.5;
                    let v1092 = vP16144.healthBarWidth - v1090;
                    let vO41 = {
                      primary: f241("visual").value == "spyder" || f241("visual").value == "hans" ? v976.oldReloads[v976.primaryIndex] - (v976.oldReloads[v976.primaryIndex] - v976.reloads[v976.primaryIndex]) * v976.rt : v976.reloads[v976.primaryIndex],
                      secondary: f241("visual").value == "spyder" || f241("visual").value == "hans" ? v976.oldReloads[v976.secondaryIndex] - (v976.oldReloads[v976.secondaryIndex] - v976.reloads[v976.secondaryIndex]) * v976.rt : v976.reloads[v976.secondaryIndex]
                    };
                    // SECONDARY RELOAD HOLDER:
                    var v1095 = vP16144.healthBarWidth;
                    v986.fillStyle = vLS3d3f42;
                    v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad + 50 + v1090, v976.y - v1072 + v976.scale + vP16144.nameY - 13 + v1091, v1092 + vP16144.healthBarPad * 2, 17, 8);
                    v986.fill();
                    // SECONDARY RELOAD BAR:
                    if (f241("visual").value == "fz") {
                      v986.fillStyle = v976.secondaryIndex == undefined || v976.reloads[v976.secondaryIndex] == 0 ? "#728d8f" : "#728d8f";
                    } else if (f241("visual").value == "lore") {
                      v986.fillStyle = "#fff066";
                    } else if (f241("visual").value == "me") {
                      v986.fillStyle = f741(v976) ? v976.secondaryIndex == undefined || v976.reloads[v976.secondaryIndex] == 0 ? "#8ecc51" : `hsl(${Math.ceil(v976.reloads[v976.secondaryIndex] / 100) * 50}, 50%, 60%)` : "#cc5151";
                    } else if (f241("visual").value == "cele") {
                      v986.fillStyle = "#b0c4de";
                    } else if (f241("visual").value == "spyder" || f241("visual").value == "zyenith") {
                      v986.fillStyle = v976.secondaryIndex == undefined || v976.reloads[v976.secondaryIndex] == 0 ? "#ffff00" : `hsl(${Math.ceil(v976.reloads[v976.secondaryIndex] / 100) * 50}, 50%, 60%)`;
                    } else if (f241("visual").value == "hans") {
                      v986.fillStyle = v976.secondaryIndex == undefined || v976.reloads[v976.secondaryIndex] == 0 ? "#8f8366" : `hsl(90, 55%, 56%)`;
                    }
                    v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth + 50 + v1090, v976.y - v1072 + v976.scale + vP16144.nameY - 13 + vP16144.healthBarPad + v1091, v1092 * (v976.reloads[v976.secondaryIndex] == undefined ? 1 : (vP16146.weapons[v976.secondaryIndex].speed - vO41.secondary) / vP16146.weapons[v976.secondaryIndex].speed), (f241("visual").value == "spyder" ? 16 : 17) - vP16144.healthBarPad * 2, 7);
                    v986.fill();
                    // PRIMARY RELOAD HOLDER:
                    var v1095 = vP16144.healthBarWidth;
                    v986.fillStyle = vLS3d3f42;
                    v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad, v976.y - v1072 + v976.scale + vP16144.nameY - 13 + v1091, v1092 + vP16144.healthBarPad * 2, 17, 8);
                    v986.fill();
                    // PRIMARY RELOAD BAR:
                    if (f241("visual").value == "fz") {
                      v986.fillStyle = v976.primaryIndex == undefined || v976.reloads[v976.primaryIndex] == 0 ? "#728d8f" : "#728d8f";
                    } else if (f241("visual").value == "lore") {
                      v986.fillStyle = "#fff066";
                    } else if (f241("visual").value == "me") {
                      v986.fillStyle = f741(v976) ? v976.primaryIndex == undefined || v976.reloads[v976.primaryIndex] == 0 ? "#8ecc51" : `hsl(${Math.ceil(v976.reloads[v976.primaryIndex] / 100) * 50}, 50%, 60%)` : "#cc5151";
                    } else if (f241("visual").value == "cele") {
                      v986.fillStyle = "#b0c4de";
                    } else if (f241("visual").value == "spyder" || f241("visual").value == "zyenith") {
                      v986.fillStyle = v976.primaryIndex == undefined || v976.reloads[v976.primaryIndex] == 0 ? "#ffff00" : `hsl(${Math.ceil(v976.reloads[v976.primaryIndex] / 100) * 50}, 50%, 60%)`;
                    } else if (f241("visual").value == "hans") {
                      v986.fillStyle = v976.primaryIndex == undefined || v976.reloads[v976.primaryIndex] == 0 ? "#8f8366" : `hsl(90, 55%, 56%)`;
                    }
                    v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth, v976.y - v1072 + v976.scale + vP16144.nameY - 13 + vP16144.healthBarPad + v1091, v1092 * (v976.reloads[v976.primaryIndex] == undefined ? 1 : (vP16146.weapons[v976.primaryIndex].speed - vO41.primary) / vP16146.weapons[v976.primaryIndex].speed), (f241("visual").value == "spyder" ? 16 : 17) - vP16144.healthBarPad * 2, 7);
                    v986.fill();
                    if (v976 == v974 && f241("visual").value == "zyenith") {
                      // TURRET RELOAD HOLDER:
                      var v1095 = vP16144.healthBarWidth;
                      v986.fillStyle = vLS3d3f42;
                      v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad, v976.y - v1072 + v976.scale + vP16144.nameY + 13, vP16144.healthBarWidth * 2 + vP16144.healthBarPad * 2, 17, 8);
                      v986.fill();
                      // TURRET RELOAD BAR:
                      v986.fillStyle = "#96963c";
                      v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth, v976.y - v1072 + v976.scale + vP16144.nameY + 13 + vP16144.healthBarPad, vP16144.healthBarWidth * 2 * (v976.reloads[53] == undefined ? 1 : (2500 - v976.reloads[53]) / 2500), 17 - vP16144.healthBarPad * 2, 7);
                      v986.fill();
                    }
                  }
                }
              }
            }
          } else {}
          if (v974) {
            if (f241("visual").value == "me" && !f741(v976)) {
              let v1096 = vP16142.getDist(v976, v974, 0, 0);
              if (v1096 > 600) {
                if (!v976.notHere) {
                  let v1097 = v976.scale * 2;
                  let vF9 = function (p1743, p1744) {
                    return Math.max(-(p1743 - v1097), Math.min(p1743 - v1097, p1744));
                  };
                  let vO42 = {
                    x: v974.x - v1071 + vF9(v980 / 2, v976.x - v1071 - (v974.x - v1071)),
                    y: v974.y - v1072 + vF9(v981 / 2, v976.y - v1072 - (v974.y - v1072))
                  };
                  let v1098 = vP16142.getDirect(v976, v974, 0, 0);
                  v986.save();
                  v986.translate(vO42.x, vO42.y);
                  v986.rotate(v1098 + Math.PI / 2);
                  v986.fillStyle = vLS3d3f42;
                  v986.globalAlpha = 0.6;
                  f703(v1097, v986);
                  v986.restore();
                }
              } else if (!v976.visible) {
                v976.notHere = true;
              } else {
                v976.notHere = false;
              }
            }
          }
        });
        vA45.forEach(p1745 => {
          v976 = p1745;
          if (v976.visible) {
            // NAME AND HEALTH:
            if (v976.skinIndex != 10 || v976 == v974 || v976.team && v976.team == v974.team) {
              v986.strokeStyle = vLS3d3f42;
              v986.globalAlpha = 1;
              var v1099 = f241("visual").value == "me" ? "[TeamAnimal] " + (v976.name || "") : f241("visual").value == "spyder" ? v976.name || "" : f241("visual").value == "lore" ? "{" + v976.sid + "} " + (v976.name || "") : f241("visual").value == "cele" ? v976.name || "" : v976.name || "";
              if (v1099 != "") {
                v986.font = (v976.nameScale || 30) + "px Hammersmith One";
                v986.fillStyle = "#fff";
                v986.textBaseline = "middle";
                v986.textAlign = "center";
                v986.lineWidth = v976.nameScale ? 11 : 8;
                v986.lineJoin = "round";
                v986.strokeText(v1099, v976.x - v1071, v976.y - v1072 - v976.scale - vP16144.nameY);
                v986.fillText(v1099, v976.x - v1071, v976.y - v1072 - v976.scale - vP16144.nameY);
                if (f241("visual").value == "me" && (v976.name == "MOOSTAFA" || v976.name == "MOOFIE") && vO39[v976.name == "MOOFIE" ? "skull" : "crown"].isLoaded) {
                  var v1100 = vP16144.crownIconScale;
                  var v1101 = v976.x - v1071 - v1100 / 2 - v986.measureText(v1099).width / 2 - vP16144.crownPad;
                  v986.drawImage(vO39[v976.name == "MOOFIE" ? "skull" : "crown"], v1101, v976.y - v1072 - v976.scale - vP16144.nameY - v1100 / 2 - 5, v1100, v1100);
                }
              }
              if (v976.health > 0) {
                // HEALTH HOLDER:
                var v1103 = vP16144.healthBarWidth;
                v986.fillStyle = vLS3d3f42;
                v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad, v976.y - v1072 + v976.scale + vP16144.nameY, vP16144.healthBarWidth * 2 + vP16144.healthBarPad * 2, 17, 8);
                v986.fill();
                // HEALTH BAR:
                v986.fillStyle = "#cc5151";
                v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth, v976.y - v1072 + v976.scale + vP16144.nameY + vP16144.healthBarPad, vP16144.healthBarWidth * 2 * (v976.health / v976.maxHealth), 17 - vP16144.healthBarPad * 2, 7);
                v986.fill();
                if (v976.name == "MOOSTAFA") {
                  // MOOSTAFA RELOAD HOLDER:
                  var v1103 = vP16144.healthBarWidth;
                  v986.fillStyle = vLS3d3f42;
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth - vP16144.healthBarPad, v976.y - v1072 + v976.scale + vP16144.nameY - 13, vP16144.healthBarWidth + vP16144.healthBarPad * 2, 17, 8);
                  v986.fill();
                  // MOOSTAFA RELOAD BAR:
                  v986.fillStyle = vLS525252;
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth, v976.y - v1072 + v976.scale + vP16144.nameY - 13 + vP16144.healthBarPad, vP16144.healthBarWidth * ((600 - v976.weaponReload) / 600), 17 - vP16144.healthBarPad * 2, 7);
                  v986.fill();
                }
              }
            }
          }
        });
        // RENDER OBJECT HEALTH:
        if (f241("bh").checked) {
          vA48.forEach(p1746 => {
            v976 = p1746;
            if (v976.active && v976.buildHealth) {
              if (v974) {
                if (vP16142.getDist(v976, v974, 0, 0) <= 360) {
                  // HEALTH HOLDER:
                  var v1105 = vP16144.healthBarWidth;
                  v986.fillStyle = vLS3d3f42;
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth / 2 - vP16144.healthBarPad, v976.y - v1072 - vP16144.healthBarPad, vP16144.healthBarWidth + vP16144.healthBarPad * 2, 17, 8);
                  v986.fill();
                  // HEALTH BAR:
                  v986.fillStyle = v974.sid != v976.owner.sid && !f759(v976.owner.sid) ? "#cc5151" : "#5f9ea0";
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth / 2, v976.y - v1072, vP16144.healthBarWidth * (v976.buildHealth / v976.health), 17 - vP16144.healthBarPad * 2, 7);
                  v986.fill();
                }
                if (vP16142.getDist(v976, v974, 0, 0) <= 720 && v976.doUpdate) {
                  // RELOAD HOLDER:
                  var v1105 = vP16144.healthBarWidth;
                  v986.fillStyle = vLS3d3f42;
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth / 2 - vP16144.healthBarPad, v976.y - v1072 - vP16144.healthBarPad + 13, vP16144.healthBarWidth + vP16144.healthBarPad * 2, 17, 8);
                  v986.fill();
                  // RELOAD BAR:
                  v986.fillStyle = "#a5974c";
                  v986.roundRect(v976.x - v1071 - vP16144.healthBarWidth / 2, v976.y - v1072 + 13, vP16144.healthBarWidth * ((2200 - v976.shootReload) / 2200), 17 - vP16144.healthBarPad * 2, 7);
                  v986.fill();
                }
              }
            }
          });
        }
        // RENDER ANIM TEXTS:
        v950.update(v966, v986, v1071, v1072);
        // RENDER CHAT MESSAGES:
        vA46.forEach(p1747 => {
          v976 = p1747;
          if (v976.visible && v976.chatCountdown > 0) {
            v976.chatCountdown = Math.max(0, v976.chatCountdown -= v966);
            v986.font = "32px Hammersmith One";
            var v1106 = v986.measureText(v976.chatMessage);
            v986.textBaseline = "middle";
            v986.textAlign = "center";
            var v1107 = v976.x - v1071;
            var v1108 = v976.y - v976.scale - v1072 - 90;
            var vLN47 = 47;
            var v1109 = v1106.width + 17;
            v986.fillStyle = "rgba(0,0,0,0.2)";
            v986.roundRect(v1107 - v1109 / 2, v1108 - vLN47 / 2, v1109, vLN47, 6);
            v986.fill();
            v986.fillStyle = "#fff";
            v986.fillText(v976.chatMessage, v1107, v1108);
          }
        });
      }
      // RENDER MINIMAP:
      f615(v966);
      // RENDER CONTROLS:
      if (vO31.id !== -1) {
        f680(vO31.startX, vO31.startY, vO31.currentX, vO31.currentY);
      }
      if (vO32.id !== -1) {
        f680(vO32.startX, vO32.startY, vO32.currentX, vO32.currentY);
      }
      if (v986 && (f241("darkmode").checked || f241("visual").value == "fz")) {
        v986.beginPath();
        let v1110 = v980 / 2;
        let v1111 = v981 / 2;
        let v1112 = v986.createRadialGradient(v1110, v1111, 0, v1110, v1111, f241("visual").value == "fz" ? v980 : v981);
        for (let vLN0169 = 0; vLN0169 <= 1; vLN0169++) {
          v1112.addColorStop(vLN0169, "rgba(0, 0, 0, " + vLN0169 + ")");
        }
        v986.fillStyle = v1112;
        v986.rect(0, 0, v980, v981);
        v986.fill();
      }
    }
    // RENDER CONTROL:
    function f680(p1748, p1749, p1750, p1751) {
      v986.save();
      v986.setTransform(1, 0, 0, 1, 0, 0);
      // mainContext.resetTransform();
      v986.scale(vLN122, vLN122);
      var vLN502 = 50;
      v986.beginPath();
      v986.arc(p1748, p1749, vLN502, 0, Math.PI * 2, false);
      v986.closePath();
      v986.fillStyle = "rgba(255, 255, 255, 0.3)";
      v986.fill();
      var vLN502 = 50;
      var v1113 = p1750 - p1748;
      var v1114 = p1751 - p1749;
      var v1115 = Math.sqrt(Math.pow(v1113, 2) + Math.pow(v1114, 2));
      var v1116 = v1115 > vLN502 ? v1115 / vLN502 : 1;
      v1113 /= v1116;
      v1114 /= v1116;
      v986.beginPath();
      v986.arc(p1748 + v1113, p1749 + v1114, vLN502 * 0.5, 0, Math.PI * 2, false);
      v986.closePath();
      v986.fillStyle = "white";
      v986.fill();
      v986.restore();
    }
    // RENDER PROJECTILES:
    function f681(p1752, p1753, p1754) {
      for (var vLN0170 = 0; vLN0170 < vA49.length; ++vLN0170) {
        v976 = vA49[vLN0170];
        if (v976.active && v976.layer == p1752) {
          v976.update(v966);
          if (v976.active && f719(v976.x - p1753, v976.y - p1754, v976.scale)) {
            v986.save();
            v986.translate(v976.x - p1753, v976.y - p1754);
            v986.rotate(v976.dir);
            f682(0, 0, v976, v986, 1);
            v986.restore();
          }
        }
      }
    }
    // RENDER PROJECTILE:
    var vO43 = {};
    function f682(p1755, p1756, p1757, p1758, p1759) {
      if (p1757.src) {
        var v1117 = vP16146.projectiles[p1757.indx].src;
        var v1118 = vO43[v1117];
        if (!v1118) {
          v1118 = new Image();
          v1118.onload = function () {
            this.isLoaded = true;
          };
          v1118.src = ".././img/weapons/" + v1117 + ".png";
          vO43[v1117] = v1118;
        }
        if (v1118.isLoaded) {
          p1758.drawImage(v1118, p1755 - p1757.scale / 2, p1756 - p1757.scale / 2, p1757.scale, p1757.scale);
        }
      } else if (p1757.indx == 1) {
        p1758.fillStyle = "#939393";
        f696(p1755, p1756, p1757.scale, p1758);
      }
    }
    // RENDER WATER BODIES:
    function f683(p1760, p1761, p1762, p1763) {
      // MIDDLE RIVER:
      var v1119 = vP16144.riverWidth + p1763;
      var v1120 = vP16144.mapScale / 2 - p1761 - v1119 / 2;
      if (v1120 < v981 && v1120 + v1119 > 0) {
        p1762.fillRect(0, v1120, v980, v1119);
      }
    }
    // RENDER GAME OBJECTS:
    function f684(p1764, p1765, p1766) {
      var v1121;
      var v1122;
      var v1123;
      vA48.forEach(p1767 => {
        v976 = p1767;
        if (v976.active) {
          v1122 = v976.x + v976.xWiggle - p1765;
          v1123 = v976.y + v976.yWiggle - p1766;
          if (p1764 == 0) {
            v976.update(v966);
          }
          if (v976.layer == p1764 && f719(v1122, v1123, v976.scale + (v976.blocker || 0))) {
            if (f241("darkmode").checked) {
              let vO44 = {
                x: v977,
                y: v978
              };
              v986.globalAlpha = v976.hideFromEnemy ? 0.6 : Math.max(0, Math.min(1, (720 - vP16142.getDist(v976, vO44, 0, 0)) / 240));
            } else {
              v986.globalAlpha = v976.hideFromEnemy ? 0.6 : 1;
            }
            if (v976.isItem) {
              if ((v976.dmg || v976.trap) && f241("visual").value != "0" && f241("visual").value != "ae" && v974 && v974.sid != v976.owner.sid && !f759(v976.owner.sid)) {
                v1121 = f694(v976);
              } else {
                v1121 = f693(v976);
              }
              v986.save();
              v986.translate(v1122, v1123);
              if (f241("visual").value != "cele" && f241("visual").value != "ae" || v976.doUpdate) {
                v986.rotate(v976.dir);
              }
              v986.drawImage(v1121, -(v1121.width / 2), -(v1121.height / 2));
              if (v976.blocker) {
                v986.strokeStyle = "#db6e6e";
                v986.globalAlpha = 0.3;
                v986.lineWidth = 6;
                f696(0, 0, v976.blocker, v986, false, true);
              }
              v986.restore();
            } else {
              v1121 = f692(v976);
              v986.drawImage(v1121, v1122 - v1121.width / 2, v1123 - v1121.height / 2);
            }
          }
        }
      });
    }
    // GATHER ANIMATION:
    let vA79 = [];
    let vA80 = [];
    function f685(p1768, p1769) {
      return new Promise((p1770, p1771) => {
        p1770({
          dmg: p1768,
          index: p1769
        });
      });
    }
    function f686(p1772, p1773, p1774) {
      v976 = f756(p1772);
      if (v976) {
        v976.startAnim(p1773, p1774);
        v976.gatherIndex = p1774;
        v976.gathering = 1;
        if (p1773) {
          v976.doTickUpdate = true;
          let vV976 = v976;
          let vVA79 = vA79;
          vA79 = [];
          f746(() => {
            let v1124 = vP16146.weapons[p1774];
            let v1125 = vP16144.weaponVariants[vV976.primaryVariant == undefined ? 0 : vV976.primaryVariant].val;
            let v1126 = v1124.sDmg || 1;
            let v1127 = v1124.dmg * v1125 * v1126 * (vV976.skinIndex == 40 ? 3.3 : 1);
            vVA79.forEach(p1775 => {
              p1775.buildHealth -= v1127;
            });
          });
        }
      }
    }
    // RENDER PLAYERS:
    function f687(p1776, p1777, p1778) {
      v986.globalAlpha = 1;
      for (var vLN0171 = 0; vLN0171 < vA46.length; ++vLN0171) {
        v976 = vA46[vLN0171];
        if (v976.zIndex == p1778) {
          v976.animate(v966);
          if (v976.visible) {
            v976.skinRot += v966 * 0.002;
            v979 = (v976 == v974 && f241("visual").value != "me" && f241("visual").value != "spyder" && f241("visual").value != "zyenith" ? f241("visual").value == "lore" || f241("visual").value == "zeph" || f241("visual").value == "fz" ? f651() : f650() : v976.dir) + v976.dirPlus;
            v986.save();
            v986.translate(v976.x - p1776, v976.y - p1777);
            // RENDER PLAYER:
            v986.rotate(v979);
            f688(v976, v986);
            v986.restore();
            /*if (tmpObj) {
                              mainContext.rotate(0);
                            let X = {
                                one: tmpObj.x - 12,
                                two: tmpObj.x + 12
                            }
                            let Y = tmpObj.y - 3.5;
                              // EYE:
                            mainContext.save();
                            mainContext.fillStyle = "#000";
                            renderCircle2(X.one - xOffset, Y - yOffset, 8, mainContext, true, false);
                            renderCircle2(X.two - xOffset, Y - yOffset, 8, mainContext, true, false);
                              mainContext.fillStyle = "#fff";
                            let maxmin = function(fr, XorY) {
                                return Math.max(-(fr - 4), Math.min((fr - 4), XorY));
                            }
                            renderCircle2(X.one - xOffset, Y - yOffset, 4, mainContext, true, false);
                            renderCircle2(X.two - xOffset, Y - yOffset, 4, mainContext, true, false);
                            mainContext.restore();
                          }*/
          }
        }
      }
    }
    // RENDER PLAYER:
    function f688(p1779, p1780) {
      p1780 = p1780 || v986;
      p1780.lineWidth = vLN55;
      p1780.lineJoin = "miter";
      var v1128 = Math.PI / 4 * (vP16146.weapons[p1779.weaponIndex].armS || 1);
      var v1129 = p1779.buildIndex < 0 ? vP16146.weapons[p1779.weaponIndex].hndS || 1 : 1;
      var v1130 = p1779.buildIndex < 0 ? vP16146.weapons[p1779.weaponIndex].hndD || 1 : 1;
      // TAIL/CAPE:
      if (p1779.tailIndex > 0) {
        f690(p1779.tailIndex, p1780, p1779);
      }
      /*if (getEl("darkmode").checked) {
                mainContext.shadowColor = "rgba(0, 0, 0, 0.35)";
                mainContext.shadowOffsetX = 10;
                mainContext.shadowOffsetY = 10;
                mainContext.shadowBlur = 7.5;
            }*/
      // WEAPON BELLOW HANDS:
      if (p1779.buildIndex < 0 && !vP16146.weapons[p1779.weaponIndex].aboveHand) {
        f691(vP16146.weapons[f241("kmtexture").checked && p1779.weaponIndex == 3 && p1779.secondaryIndex == 15 ? 4 : p1779.weaponIndex], vP16144.weaponVariants[p1779.weaponVariant].src, p1779.scale, 0, p1780);
        if (vP16146.weapons[p1779.weaponIndex].projectile != undefined && !vP16146.weapons[p1779.weaponIndex].hideProjectile) {
          f682(p1779.scale, 0, vP16146.projectiles[vP16146.weapons[p1779.weaponIndex].projectile], v986);
        }
      }
      // HANDS:
      p1780.fillStyle = vP16144.skinColors[p1779.skinColor];
      f696(p1779.scale * Math.cos(v1128), p1779.scale * Math.sin(v1128), 14);
      f696(p1779.scale * v1130 * Math.cos(-v1128 * v1129), p1779.scale * v1130 * Math.sin(-v1128 * v1129), 14);
      // WEAPON ABOVE HANDS:
      if (p1779.buildIndex < 0 && vP16146.weapons[p1779.weaponIndex].aboveHand) {
        f691(vP16146.weapons[p1779.weaponIndex], vP16144.weaponVariants[p1779.weaponVariant].src, p1779.scale, 0, p1780);
        if (vP16146.weapons[p1779.weaponIndex].projectile != undefined && !vP16146.weapons[p1779.weaponIndex].hideProjectile) {
          f682(p1779.scale, 0, vP16146.projectiles[vP16146.weapons[p1779.weaponIndex].projectile], v986);
        }
      }
      // BUILD ITEM:
      if (p1779.buildIndex >= 0) {
        var vGetItemSprite2 = f693(vP16146.list[p1779.buildIndex]);
        p1780.drawImage(vGetItemSprite2, p1779.scale - vP16146.list[p1779.buildIndex].holdOffset, -vGetItemSprite2.width / 2);
      }
      /*if (getEl("darkmode").checked) {
                mainContext.shadowColor = 0;
                mainContext.shadowOffsetX = 0;
                mainContext.shadowOffsetY = 0;
                mainContext.shadowBlur = 0;
            }*/
      // BODY:
      f696(0, 0, p1779.scale, p1780);
      // SKIN:
      if (p1779.skinIndex > 0) {
        p1780.rotate(Math.PI / 2);
        f689(p1779.skinIndex, p1780, null, p1779);
      }
    }
    // RENDER SKINS:
    var vO45 = {};
    var vO46 = {};
    var v1131;
    function f689(p1781, p1782, p1783, p1784) {
      v1131 = vO45[p1781];
      if (!v1131) {
        var v1132 = new Image();
        v1132.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        v1132.src = ".././img/hats/hat_" + p1781 + ".png";
        vO45[p1781] = v1132;
        v1131 = v1132;
      }
      var v1133 = p1783 || vO46[p1781];
      if (!v1133) {
        for (var vLN0172 = 0; vLN0172 < v989.length; ++vLN0172) {
          if (v989[vLN0172].id == p1781) {
            v1133 = v989[vLN0172];
            break;
          }
        }
        vO46[p1781] = v1133;
      }
      if (v1131.isLoaded) {
        p1782.drawImage(v1131, -v1133.scale / 2, -v1133.scale / 2, v1133.scale, v1133.scale);
      }
      if (!p1783 && v1133.topSprite) {
        p1782.save();
        p1782.rotate(p1784.skinRot);
        f689(p1781 + "_top", p1782, v1133, p1784);
        p1782.restore();
      }
    }
    // RENDER TAIL:
    var vO47 = {};
    var vO48 = {};
    function f690(p1785, p1786, p1787) {
      v1131 = vO47[p1785];
      if (!v1131) {
        var v1134 = new Image();
        v1134.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        v1134.src = ".././img/accessories/access_" + p1785 + ".png";
        vO47[p1785] = v1134;
        v1131 = v1134;
      }
      var v1135 = vO48[p1785];
      if (!v1135) {
        for (var vLN0173 = 0; vLN0173 < v990.length; ++vLN0173) {
          if (v990[vLN0173].id == p1785) {
            v1135 = v990[vLN0173];
            break;
          }
        }
        vO48[p1785] = v1135;
      }
      if (v1131.isLoaded) {
        p1786.save();
        p1786.translate(-20 - (v1135.xOff || 0), 0);
        if (v1135.spin) {
          p1786.rotate(p1787.skinRot);
        }
        p1786.drawImage(v1131, -(v1135.scale / 2), -(v1135.scale / 2), v1135.scale, v1135.scale);
        p1786.restore();
      }
    }
    // RENDER TOOL:
    var vO49 = {};
    function f691(p1788, p1789, p1790, p1791, p1792) {
      var v1136 = p1788.src + (p1789 || "");
      var v1137 = vO49[v1136];
      if (!v1137) {
        v1137 = new Image();
        v1137.onload = function () {
          this.isLoaded = true;
        };
        v1137.src = ".././img/weapons/" + v1136 + ".png";
        vO49[v1136] = v1137;
      }
      if (v1137.isLoaded) {
        p1792.drawImage(v1137, p1790 + p1788.xOff - p1788.length / 2, p1791 + p1788.yOff - p1788.width / 2, p1788.length, p1788.width);
      }
    }
    // RENDER GAME OBJECTS:
    var vO50 = {};
    function f692(p1793) {
      var v1138 = p1793.y >= vP16144.mapScale - vP16144.snowBiomeTop ? 2 : p1793.y <= vP16144.snowBiomeTop ? 1 : 0;
      var v1139 = p1793.type + "_" + p1793.scale + "_" + v1138;
      var v1140 = vO50[v1139];
      if (!v1140) {
        var v1141 = document.createElement("canvas");
        v1141.width = v1141.height = p1793.scale * 2.1 + vLN55;
        var v1142 = v1141.getContext("2d");
        v1142.translate(v1141.width / 2, v1141.height / 2);
        v1142.rotate(vP16142.randFloat(0, Math.PI));
        v1142.strokeStyle = vLS525252;
        v1142.lineWidth = vLN55;
        let vA81 = [["#b1d959", "#95b946"], ["#bade6e", "#aac76b"], ["#a7d544", "#86a63f"], ["#b4db62", "#9ebf57"]];
        let v1143 = vA81[Math.floor(Math.random() * vA81.length)];
        if (p1793.type == 0) {
          var v1144;
          for (var vLN0175 = 0; vLN0175 < 2; ++vLN0175) {
            v1144 = v976.scale * (!vLN0175 ? 1 : 0.5);
            f698(v1142, 7, v1144, v1144 * 0.7);
            v1142.fillStyle = !v1138 ? !vLN0175 ? v1143[1] : v1143[0] : !vLN0175 ? "#e3f1f4" : "#fff";
            v1142.fill();
            if (!vLN0175) {
              v1142.stroke();
            }
          }
        } else if (p1793.type == 1) {
          if (v1138 == 2) {
            v1142.fillStyle = "#606060";
            f698(v1142, 6, p1793.scale * 0.3, p1793.scale * 0.71);
            v1142.fill();
            v1142.stroke();
            v1142.fillStyle = "#89a54c";
            f696(0, 0, p1793.scale * 0.55, v1142);
            v1142.fillStyle = "#a5c65b";
            f696(0, 0, p1793.scale * 0.3, v1142, true);
          } else {
            f701(v1142, 6, v976.scale, v976.scale * 0.7);
            v1142.fillStyle = v1138 ? "#e3f1f4" : "#89a54c";
            v1142.fill();
            v1142.stroke();
            v1142.fillStyle = v1138 ? "#6a64af" : "#c15555";
            var v1145;
            var vLN4 = 4;
            var v1146 = v958 / vLN4;
            for (var vLN0175 = 0; vLN0175 < vLN4; ++vLN0175) {
              v1145 = vP16142.randInt(v976.scale / 3.5, v976.scale / 2.3);
              f696(v1145 * Math.cos(v1146 * vLN0175), v1145 * Math.sin(v1146 * vLN0175), vP16142.randInt(10, 12), v1142);
            }
          }
        } else if (p1793.type == 2 || p1793.type == 3) {
          v1142.fillStyle = p1793.type == 2 ? v1138 == 2 ? "#938d77" : "#939393" : "#e0c655";
          f698(v1142, 3, p1793.scale, p1793.scale);
          v1142.fill();
          v1142.stroke();
          v1142.fillStyle = p1793.type == 2 ? v1138 == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
          f698(v1142, 3, p1793.scale * 0.55, p1793.scale * 0.65);
          v1142.fill();
        }
        v1140 = v1141;
        vO50[v1139] = v1140;
      }
      return v1140;
    }
    // GET ITEM SPRITE:
    var vA82 = [];
    function f693(p1794, p1795) {
      var v1147 = vA82[p1794.id];
      if (!v1147 || p1795) {
        var v1148 = document.createElement("canvas");
        v1148.width = v1148.height = p1794.scale * 2.5 + vLN55 + (vP16146.list[p1794.id].spritePadding || 0);
        var v1149 = v1148.getContext("2d");
        v1149.translate(v1148.width / 2, v1148.height / 2);
        v1149.rotate(p1795 ? 0 : Math.PI / 2);
        v1149.strokeStyle = vLS525252;
        v1149.lineWidth = vLN55 * (p1795 ? v1148.width / 81 : 1);
        if (p1794.name == "apple") {
          v1149.fillStyle = "#c15555";
          f696(0, 0, p1794.scale, v1149);
          v1149.fillStyle = "#89a54c";
          var v1150 = -(Math.PI / 2);
          f695(p1794.scale * Math.cos(v1150), p1794.scale * Math.sin(v1150), 25, v1150 + Math.PI / 2, v1149);
        } else if (p1794.name == "cookie") {
          v1149.fillStyle = "#cca861";
          f696(0, 0, p1794.scale, v1149);
          v1149.fillStyle = "#937c4b";
          var vLN43 = 4;
          var v1153 = v958 / vLN43;
          var v1154;
          for (var vLN0179 = 0; vLN0179 < vLN43; ++vLN0179) {
            v1154 = vP16142.randInt(p1794.scale / 2.5, p1794.scale / 1.7);
            f696(v1154 * Math.cos(v1153 * vLN0179), v1154 * Math.sin(v1153 * vLN0179), vP16142.randInt(4, 5), v1149, true);
          }
        } else if (p1794.name == "cheese") {
          v1149.fillStyle = "#f4f3ac";
          f696(0, 0, p1794.scale, v1149);
          v1149.fillStyle = "#c3c28b";
          var vLN43 = 4;
          var v1153 = v958 / vLN43;
          var v1154;
          for (var vLN0179 = 0; vLN0179 < vLN43; ++vLN0179) {
            v1154 = vP16142.randInt(p1794.scale / 2.5, p1794.scale / 1.7);
            f696(v1154 * Math.cos(v1153 * vLN0179), v1154 * Math.sin(v1153 * vLN0179), vP16142.randInt(4, 5), v1149, true);
          }
        } else if (p1794.name == "wood wall" || p1794.name == "stone wall" || p1794.name == "castle wall") {
          v1149.fillStyle = p1794.name == "castle wall" ? "#83898e" : p1794.name == "wood wall" ? "#a5974c" : "#939393";
          var v1155 = p1794.name == "castle wall" ? 4 : 3;
          f698(v1149, v1155, p1794.scale * 1.1, p1794.scale * 1.1);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = p1794.name == "castle wall" ? "#9da4aa" : p1794.name == "wood wall" ? "#c9b758" : "#bcbcbc";
          f698(v1149, v1155, p1794.scale * 0.65, p1794.scale * 0.65);
          v1149.fill();
        } else if (p1794.name == "spikes" || p1794.name == "greater spikes" || p1794.name == "poison spikes" || p1794.name == "spinning spikes") {
          v1149.fillStyle = p1794.name == "poison spikes" ? "#7b935d" : "#939393";
          var v1157 = p1794.scale * 0.6;
          f698(v1149, p1794.name == "spikes" ? 5 : 6, p1794.scale, v1157);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#a5974c";
          f696(0, 0, v1157, v1149);
          v1149.fillStyle = "#c9b758";
          f696(0, 0, v1157 / 2, v1149, true);
        } else if (p1794.name == "windmill" || p1794.name == "faster windmill" || p1794.name == "power mill") {
          v1149.fillStyle = "#a5974c";
          f696(0, 0, p1794.scale, v1149);
          v1149.fillStyle = "#c9b758";
          f700(0, 0, p1794.scale * 1.5, 29, 4, v1149);
          v1149.fillStyle = "#a5974c";
          f696(0, 0, p1794.scale * 0.5, v1149);
        } else if (p1794.name == "mine") {
          v1149.fillStyle = "#939393";
          f698(v1149, 3, p1794.scale, p1794.scale);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#bcbcbc";
          f698(v1149, 3, p1794.scale * 0.55, p1794.scale * 0.65);
          v1149.fill();
        } else if (p1794.name == "sapling") {
          for (var vLN0179 = 0; vLN0179 < 2; ++vLN0179) {
            var v1157 = p1794.scale * (!vLN0179 ? 1 : 0.5);
            f698(v1149, 7, v1157, v1157 * 0.7);
            v1149.fillStyle = !vLN0179 ? "#9ebf57" : "#b4db62";
            v1149.fill();
            if (!vLN0179) {
              v1149.stroke();
            }
          }
        } else if (p1794.name == "pit trap") {
          v1149.fillStyle = "#a5974c";
          f698(v1149, 3, p1794.scale * 1.1, p1794.scale * 1.1);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = vLS525252;
          f698(v1149, 3, p1794.scale * 0.65, p1794.scale * 0.65);
          v1149.fill();
        } else if (p1794.name == "boost pad") {
          v1149.fillStyle = "#7e7f82";
          f699(0, 0, p1794.scale * 2, p1794.scale * 2, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#dbd97d";
          f702(p1794.scale * 1, v1149);
        } else if (p1794.name == "turret") {
          v1149.fillStyle = "#a5974c";
          f696(0, 0, p1794.scale, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#939393";
          var vLN503 = 50;
          f699(0, -vLN503 / 2, p1794.scale * 0.9, vLN503, v1149);
          f696(0, 0, p1794.scale * 0.6, v1149);
          v1149.fill();
          v1149.stroke();
        } else if (p1794.name == "platform") {
          v1149.fillStyle = "#cebd5f";
          var vLN44 = 4;
          var v1158 = p1794.scale * 2;
          var v1159 = v1158 / vLN44;
          var v1160 = -(p1794.scale / 2);
          for (var vLN0179 = 0; vLN0179 < vLN44; ++vLN0179) {
            f699(v1160 - v1159 / 2, 0, v1159, p1794.scale * 2, v1149);
            v1149.fill();
            v1149.stroke();
            v1160 += v1158 / vLN44;
          }
        } else if (p1794.name == "healing pad") {
          v1149.fillStyle = "#7e7f82";
          f699(0, 0, p1794.scale * 2, p1794.scale * 2, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#db6e6e";
          f700(0, 0, p1794.scale * 0.65, 20, 4, v1149, true);
        } else if (p1794.name == "spawn pad") {
          v1149.fillStyle = "#7e7f82";
          f699(0, 0, p1794.scale * 2, p1794.scale * 2, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.fillStyle = "#71aad6";
          f696(0, 0, p1794.scale * 0.6, v1149);
        } else if (p1794.name == "blocker") {
          v1149.fillStyle = "#7e7f82";
          f696(0, 0, p1794.scale, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.rotate(Math.PI / 4);
          v1149.fillStyle = "#db6e6e";
          f700(0, 0, p1794.scale * 0.65, 20, 4, v1149, true);
        } else if (p1794.name == "teleporter") {
          v1149.fillStyle = "#7e7f82";
          f696(0, 0, p1794.scale, v1149);
          v1149.fill();
          v1149.stroke();
          v1149.rotate(Math.PI / 4);
          v1149.fillStyle = "#d76edb";
          f696(0, 0, p1794.scale * 0.5, v1149, true);
        }
        v1147 = v1148;
        if (!p1795) {
          vA82[p1794.id] = v1147;
        }
      }
      return v1147;
    }
    var vA83 = [];
    function f694(p1796) {
      var v1161 = vA83[p1796.id];
      if (!v1161) {
        var v1162 = document.createElement("canvas");
        v1162.width = v1162.height = p1796.scale * 2.5 + vLN55 + (vP16146.list[p1796.id].spritePadding || 0);
        var v1163 = v1162.getContext("2d");
        v1163.translate(v1162.width / 2, v1162.height / 2);
        v1163.rotate(Math.PI / 2);
        v1163.strokeStyle = vLS525252;
        v1163.lineWidth = vLN55;
        if (p1796.name == "spikes" || p1796.name == "greater spikes" || p1796.name == "poison spikes" || p1796.name == "spinning spikes") {
          v1163.fillStyle = p1796.name == "poison spikes" ? "#7b935d" : "#939393";
          var v1164 = p1796.scale * 0.6;
          f698(v1163, p1796.name == "spikes" ? 5 : 6, p1796.scale, v1164);
          v1163.fill();
          v1163.stroke();
          v1163.fillStyle = "#a5974c";
          f696(0, 0, v1164, v1163);
          v1163.fillStyle = "#cc5151";
          f696(0, 0, v1164 / 2, v1163, true);
        } else if (p1796.name == "pit trap") {
          v1163.fillStyle = "#a5974c";
          f698(v1163, 3, p1796.scale * 1.1, p1796.scale * 1.1);
          v1163.fill();
          v1163.stroke();
          v1163.fillStyle = "#cc5151";
          f698(v1163, 3, p1796.scale * 0.65, p1796.scale * 0.65);
          v1163.fill();
        }
        v1161 = v1162;
        vA83[p1796.id] = v1161;
      }
      return v1161;
    }
    // RENDER LEAF:
    function f695(p1797, p1798, p1799, p1800, p1801) {
      var v1165 = p1797 + p1799 * Math.cos(p1800);
      var v1166 = p1798 + p1799 * Math.sin(p1800);
      var v1167 = p1799 * 0.4;
      p1801.moveTo(p1797, p1798);
      p1801.beginPath();
      p1801.quadraticCurveTo((p1797 + v1165) / 2 + v1167 * Math.cos(p1800 + Math.PI / 2), (p1798 + v1166) / 2 + v1167 * Math.sin(p1800 + Math.PI / 2), v1165, v1166);
      p1801.quadraticCurveTo((p1797 + v1165) / 2 - v1167 * Math.cos(p1800 + Math.PI / 2), (p1798 + v1166) / 2 - v1167 * Math.sin(p1800 + Math.PI / 2), p1797, p1798);
      p1801.closePath();
      p1801.fill();
      p1801.stroke();
    }
    // RENDER CIRCLE:
    function f696(p1802, p1803, p1804, p1805, p1806, p1807) {
      p1805 = p1805 || v986;
      p1805.beginPath();
      p1805.arc(p1802, p1803, p1804, 0, Math.PI * 2);
      if (!p1807) {
        p1805.fill();
      }
      if (!p1806) {
        p1805.stroke();
      }
    }
    function f697(p1808, p1809, p1810, p1811, p1812, p1813) {
      p1811 = p1811 || v986;
      p1811.beginPath();
      p1811.ellipse(p1808, p1809, p1810 * 1.5, p1810, Math.PI / 2, 0, Math.PI * 2);
      if (!p1813) {
        p1811.fill();
      }
      if (!p1812) {
        p1811.lineWidth = 3.5;
        p1811.stroke();
      }
    }
    // RENDER STAR SHAPE:
    function f698(p1814, p1815, p1816, p1817) {
      var v1168 = Math.PI / 2 * 3;
      var v1169;
      var v1170;
      var v1171 = Math.PI / p1815;
      p1814.beginPath();
      p1814.moveTo(0, -p1816);
      for (var vLN0180 = 0; vLN0180 < p1815; vLN0180++) {
        v1169 = Math.cos(v1168) * p1816;
        v1170 = Math.sin(v1168) * p1816;
        p1814.lineTo(v1169, v1170);
        v1168 += v1171;
        v1169 = Math.cos(v1168) * p1817;
        v1170 = Math.sin(v1168) * p1817;
        p1814.lineTo(v1169, v1170);
        v1168 += v1171;
      }
      p1814.lineTo(0, -p1816);
      p1814.closePath();
    }
    // RENDER RECTANGLE:
    function f699(p1818, p1819, p1820, p1821, p1822, p1823) {
      p1822.fillRect(p1818 - p1820 / 2, p1819 - p1821 / 2, p1820, p1821);
      if (!p1823) {
        p1822.strokeRect(p1818 - p1820 / 2, p1819 - p1821 / 2, p1820, p1821);
      }
    }
    // RENDER RECTCIRCLE:
    function f700(p1824, p1825, p1826, p1827, p1828, p1829, p1830) {
      p1829.save();
      p1829.translate(p1824, p1825);
      p1828 = Math.ceil(p1828 / 2);
      for (var vLN0181 = 0; vLN0181 < p1828; vLN0181++) {
        f699(0, 0, p1826 * 2, p1827, p1829, p1830);
        p1829.rotate(Math.PI / p1828);
      }
      p1829.restore();
    }
    // RENDER BLOB:
    function f701(p1831, p1832, p1833, p1834) {
      var v1172 = Math.PI / 2 * 3;
      var v1173;
      var v1174;
      var v1175 = Math.PI / p1832;
      var v1176;
      p1831.beginPath();
      p1831.moveTo(0, -p1834);
      for (var vLN0182 = 0; vLN0182 < p1832; vLN0182++) {
        v1176 = vP16142.randInt(p1833 + 0.9, p1833 * 1.2);
        p1831.quadraticCurveTo(Math.cos(v1172 + v1175) * v1176, Math.sin(v1172 + v1175) * v1176, Math.cos(v1172 + v1175 * 2) * p1834, Math.sin(v1172 + v1175 * 2) * p1834);
        v1172 += v1175 * 2;
      }
      p1831.lineTo(0, -p1834);
      p1831.closePath();
    }
    // RENDER TRIANGLE:
    function f702(p1835, p1836) {
      p1836 = p1836 || v986;
      var v1177 = p1835 * (Math.sqrt(3) / 2);
      p1836.beginPath();
      p1836.moveTo(0, -v1177 / 2);
      p1836.lineTo(-p1835 / 2, v1177 / 2);
      p1836.lineTo(p1835 / 2, v1177 / 2);
      p1836.lineTo(0, -v1177 / 2);
      p1836.fill();
      p1836.closePath();
    }
    function f703(p1837, p1838) {
      p1838 = p1838 || v986;
      var v1178 = p1837 * (Math.sqrt(3) / 2);
      p1838.beginPath();
      p1838.moveTo(0, -v1178 / 3.5);
      p1838.lineTo(-p1837 / 2, v1178 / 2);
      p1838.lineTo(p1837 / 2, v1178 / 2);
      p1838.lineTo(0, -v1178 / 3.5);
      p1838.fill();
      p1838.closePath();
      p1838.stroke();
    }
    function f704(p1839, p1840) {
      p1840 = p1840 || v986;
      var v1179 = p1839 * (Math.sqrt(3) / 2);
      p1840.beginPath();
      p1840.moveTo(0, -v1179 / 2);
      p1840.lineTo(-p1839 / 1.5, v1179 / 1.5);
      p1840.lineTo(p1839 / 1.5, v1179 / 1.5);
      p1840.lineTo(0, -v1179 / 2);
      p1840.fill();
      p1840.closePath();
    }

    // PREPARE MENU BACKGROUND:
    function f705() {
      var v1180 = vP16144.mapScale / 2;
      v991.add(0, v1180, v1180 + 200, 0, vP16144.treeScales[3], 0);
      v991.add(1, v1180, v1180 - 480, 0, vP16144.treeScales[3], 0);
      v991.add(2, v1180 + 300, v1180 + 450, 0, vP16144.treeScales[3], 0);
      v991.add(3, v1180 - 950, v1180 - 130, 0, vP16144.treeScales[2], 0);
      v991.add(4, v1180 - 750, v1180 - 400, 0, vP16144.treeScales[3], 0);
      v991.add(5, v1180 - 700, v1180 + 400, 0, vP16144.treeScales[2], 0);
      v991.add(6, v1180 + 800, v1180 - 200, 0, vP16144.treeScales[3], 0);
      v991.add(7, v1180 - 260, v1180 + 340, 0, vP16144.bushScales[3], 1);
      v991.add(8, v1180 + 760, v1180 + 310, 0, vP16144.bushScales[3], 1);
      v991.add(9, v1180 - 800, v1180 + 100, 0, vP16144.bushScales[3], 1);
      v991.add(10, v1180 - 800, v1180 + 300, 0, vP16146.list[4].scale, vP16146.list[4].id, vP16146.list[10]);
      v991.add(11, v1180 + 650, v1180 - 390, 0, vP16146.list[4].scale, vP16146.list[4].id, vP16146.list[10]);
      v991.add(12, v1180 - 400, v1180 - 450, 0, vP16144.rockScales[2], 2);
    }
    // CREATE FAKE OBJECTS:
    function f706() {
      return;
      for (let vLN0183 = 0; vLN0183 < 500; vLN0183++) {
        let vO51 = {
          x: Math.floor(Math.random() * 14400),
          y: Math.floor(Math.random() * 14400)
        };
        let v1181 = Math.floor(Math.random() * 4);
        v991.add(vLN0183, vO51.x, vO51.y, 0, (v1181 == 0 ? vP16144.treeScales : v1181 == 1 ? vP16144.bushScales : v1181 >= 2 && vP16144.rockScales)[Math.florr(Math.random() * (v1181 == 0 ? 4 : 3))], v1181);
      }
    }
    // ANTI TRAP:
    let vO52 = {
      start: false
    };
    function f707(p1841) {
      if (vA94.dist2 <= 250) {
        for (let v1182 = -45; v1182 <= 45; v1182 += 90) {
          f721(2, p1841 + vP16142.toRad(v1182) + Math.PI);
        }
      } else if (vA94.dist2 <= 600) {
        for (let v1183 = -45; v1183 <= 45; v1183 += 90) {
          if (vA92.length) {
            f721(4, p1841 + vP16142.toRad(v1183) + Math.PI);
          }
        }
      }
    }
    // LOAD GAME OBJECT:
    let vA84 = [];
    function f708(p1842) {
      for (var vLN0184 = 0; vLN0184 < p1842.length;) {
        v991.add(p1842[vLN0184], p1842[vLN0184 + 1], p1842[vLN0184 + 2], p1842[vLN0184 + 3], p1842[vLN0184 + 4], p1842[vLN0184 + 5], vP16146.list[p1842[vLN0184 + 6]], true, p1842[vLN0184 + 7] >= 0 ? {
          sid: p1842[vLN0184 + 7]
        } : null);
        let vO53 = {
          x: p1842[vLN0184 + 1],
          y: p1842[vLN0184 + 2]
        };
        let v1184 = vP16142.getDist(vO53, v974, 0, 2);
        let v1185 = vP16142.getDirect(vO53, v974, 0, 2);
        if (p1842[vLN0184 + 6] == 22 && v974.sid == p1842[vLN0184 + 7]) {
          vA84.push({
            x: p1842[vLN0184 + 1],
            y: p1842[vLN0184 + 2]
          });
          setTimeout(() => {
            vA84.shift();
          }, 30000);
        }
        if (f241("earlyab").checked) {
          if (p1842[vLN0184 + 6] == 15 && v1184 <= 100 && v974.sid != p1842[vLN0184 + 7] && !f759(p1842[vLN0184 + 7])) {
            setTimeout(() => {
              v1184 = vP16142.getDist(vO53, v974, 0, 2);
              v1185 = vP16142.getDirect(vO53, v974, 0, 2);
              vO65.in = true;
              vO65.aim = v1185;
              if (!vO52.start) {
                vO52.start = true;
                vO52.hit = 0;
                vO52.miss = 0;
              }
              if (v1184 <= 75) {
                vO52.hit++;
              } else {
                vO52.miss++;
              }
            }, parseInt(f241("earlytime").value));
          }
        }
        f745(() => {
          v1184 = vP16142.getDist(vO53, v974, 0, 2);
          v1185 = vP16142.getDirect(vO53, v974, 0, 2);
          if (p1842[vLN0184 + 6] == 15 && v1184 <= 100 && v974.sid != p1842[vLN0184 + 7] && !f759(p1842[vLN0184 + 7])) {
            f707(v1185);
          }
        }, 1);
        vLN0184 += 8;
      }
    }
    // WIGGLE GAME OBJECT:
    let vA85 = [];
    function f709(p1843) {
      v1187 = true;
      let vSetInterval = setInterval(() => {
        if (v974.shameCount < 5) {
          f720(0, f651());
        }
      }, 75);
      setTimeout(() => {
        clearInterval(vSetInterval);
        setTimeout(() => {
          v1187 = false;
        }, vP16144.tickRate);
      }, vP16144.tickRate * p1843);
    }
    function f710(p1844, p1845) {
      v976 = f758(p1845);
      if (v976) {
        v976.xWiggle += vP16144.gatherWiggle * Math.cos(p1844);
        v976.yWiggle += vP16144.gatherWiggle * Math.sin(p1844);
        if (v976.buildHealth) {
          vA79.push(v976);
          //                    hittedObj2.push(tmpObj);
        }
      }
    }
    // SHOOT TURRET:
    function f711(p1846, p1847) {
      v976 = f758(p1846);
      if (v976) {
        v976.dir = p1847;
        v976.xWiggle += vP16144.gatherWiggle * Math.cos(p1847 + Math.PI);
        v976.yWiggle += vP16144.gatherWiggle * Math.sin(p1847 + Math.PI);
        v976.shootted = 1;
      }
    }
    // ADD PROJECTILE:
    let v1186 = false;
    let v1187 = false;
    let vA86 = [];
    let vA87 = [];
    function f712(p1848, p1849, p1850, p1851, p1852, p1853, p1854, p1855) {
      if (v992) {
        v972.addProjectile(p1848, p1849, p1850, p1851, p1852, p1853, null, null, p1854).sid = p1855;
      }
      vA86.push(Array.prototype.slice.call(arguments));
    }
    function f713(p1856, p1857, p1858, p1859, p1860, p1861, p1862, p1863) {
      let v1188 = p1861 == 0 ? 9 : p1861 == 2 ? 12 : p1861 == 3 ? 13 : p1861 == 5 && 15;
      let v1189 = vP16144.playerScale * 2;
      let vO54 = {
        x: p1861 == 1 ? p1856 : p1856 - v1189 * Math.cos(p1858),
        y: p1861 == 1 ? p1857 : p1857 - v1189 * Math.sin(p1858)
      };
      let vF10 = function (p1864) {
        return {
          x2: vP16142.fixTo(p1864.x2, 2),
          y2: vP16142.fixTo(p1864.y2, 2)
        };
      };
      let v1190 = vA46.filter(p1865 => p1865.visible && vP16142.getDist(vO54, p1865, 0, 2) <= p1865.scale).sort(function (p1866, p1867) {
        return vP16142.getDist(vO54, p1866, 0, 2) - vP16142.getDist(vO54, p1867, 0, 2);
      })[0];
      if (v1190) {
        v1190.projDist = vP16142.getDist(vO54, v1190, 0, 2);
        if (p1861 == 1) {
          v1190.shooting[53] = 1;
        } else {
          v1190.shootIndex = v1188;
          v1190.shooting[1] = 1;
          f714(v1190, p1858, p1859, p1860, p1861, v1188);
        }
      }
    }
    let vLN0185 = 0;
    function f714(p1868, p1869, p1870, p1871, p1872, p1873) {
      if (!f741(p1868)) {
        v979 = vP16142.getDirect(v974, p1868, 2, 2);
        if (vP16142.getAngleDist(v979, p1869) <= 0.2) {
          p1868.bowThreat[p1873]++;
          if (p1872 == 5) {
            vLN0185++;
          }
          setTimeout(() => {
            p1868.bowThreat[p1873]--;
            if (p1872 == 5) {
              vLN0185--;
            }
          }, p1870 / p1871);
          if (p1868.bowThreat[9] >= 1 && (p1868.bowThreat[12] >= 1 || p1868.bowThreat[15] >= 1)) {
            f720(1, p1868.aim2);
            if (f241("antirange").checked && !v1187) {
              vLN0208 = 4;
              if (f241("combat").value == "zyenith") {
                vP1614.send("6", "Anti 7");
                setTimeout(() => {
                  vP1614.send("6", "Anti 6");
                }, 2000);
              } else {
                vP1614.send("6", "Anti 5");
              }
              f709(4);
            }
          } else if (vLN0185 >= 2) {
            f720(1, p1868.aim2);
            vLN0208 = 4;
            if (f241("antisync").checked && !v1187) {
              if (f241("combat").value != "zyenith") {
                vP1614.send("6", f241("combat").value == "hans" ? "Anti 4" : "Anti 3");
              }
              f709(4);
            }
          }
        }
      }
    }
    // REMOVE PROJECTILE:
    function f715(p1874, p1875) {
      for (var vLN0186 = 0; vLN0186 < vA49.length; ++vLN0186) {
        if (vA49[vLN0186].sid == p1874) {
          vA49[vLN0186].range = p1875;
          let vVA792 = vA79;
          let v1191 = vA49[vLN0186].dmg;
          vA79 = [];
          f746(() => {
            vVA792.forEach(p1876 => {
              if (p1876.projDmg) {
                p1876.buildHealth -= v1191;
              }
            });
          });
        }
      }
    }
    // ANIMATE AI:
    function f716(p1877) {
      v976 = f757(p1877);
      if (v976) {
        v976.startAnim();
        v976.weaponHitted = 1;
        v976.doTickUpdate = true;
        let vVA793 = vA79;
        vA79 = [];
        f746(() => {
          vVA793.forEach(p1878 => {
            p1878.buildHealth -= 232;
          });
        });
      }
    }
    // ADD AI:
    function f717(p1879) {
      for (var vLN0188 = 0; vLN0188 < vA45.length; ++vLN0188) {
        vA45[vLN0188].forcePos = !vA45[vLN0188].visible;
        vA45[vLN0188].visible = false;
      }
      if (p1879) {
        var v1192 = Date.now();
        for (var vLN0188 = 0; vLN0188 < p1879.length;) {
          v976 = f757(p1879[vLN0188]);
          if (v976) {
            v976.index = p1879[vLN0188 + 1];
            v976.t1 = v976.t2 === undefined ? v1192 : v976.t2;
            v976.t2 = v1192;
            v976.x1 = v976.x;
            v976.y1 = v976.y;
            v976.x2 = p1879[vLN0188 + 2];
            v976.y2 = p1879[vLN0188 + 3];
            v976.d1 = v976.d2 === undefined ? p1879[vLN0188 + 4] : v976.d2;
            v976.d2 = p1879[vLN0188 + 4];
            v976.health = p1879[vLN0188 + 5];
            v976.dt = 0;
            v976.visible = true;
            if (v976.name == "MOOSTAFA") {
              if (v976.doTickUpdate) {
                v976.doTickUpdate = false;
              }
              if (v976.weaponHitted) {
                v976.weaponHitted = false;
                v976.weaponReload = 600;
              } else {
                v976.weaponReload = Math.max(0, v976.weaponReload - vP16144.tickRate);
              }
            }
          } else {
            v976 = v973.spawn(p1879[vLN0188 + 2], p1879[vLN0188 + 3], p1879[vLN0188 + 4], p1879[vLN0188 + 1]);
            v976.x2 = v976.x;
            v976.y2 = v976.y;
            v976.d2 = v976.dir;
            v976.health = p1879[vLN0188 + 5];
            if (!v973.aiTypes[p1879[vLN0188 + 1]].name) {
              v976.name = vP16144.cowNames[p1879[vLN0188 + 6]];
            }
            v976.forcePos = true;
            v976.sid = p1879[vLN0188];
            v976.visible = true;
          }
          vLN0188 += 7;
        }
      }
    }
    // RENDER AI:
    var vO55 = {};
    function f718(p1880, p1881) {
      var v1193 = p1880.index;
      var v1194 = vO55[v1193];
      if (!v1194) {
        var v1195 = new Image();
        v1195.onload = function () {
          this.isLoaded = true;
          this.onload = null;
        };
        v1195.src = ".././img/animals/" + p1880.src + ".png";
        v1194 = v1195;
        vO55[v1193] = v1194;
      }
      if (v1194.isLoaded) {
        var v1196 = p1880.scale * 1.2 * (p1880.spriteMlt || 1);
        p1881.drawImage(v1194, -v1196, -v1196, v1196 * 2, v1196 * 2);
      }
    }
    // OBJECT ON SCREEN:
    function f719(p1882, p1883, p1884) {
      return p1882 + p1884 >= 0 && p1882 - p1884 <= v980 && p1883 + p1884 >= 0 && (p1883, p1884, v981);
    }
    // FUNCTIONS:
    let vO56 = {
      weaponCode: 0,
      antiBull: 0,
      antiBull2: 0,
      waitHit: false
    };
    function f720(p1885, p1886) {
      try {
        var v1197 = vP16146.list[v974.items[p1885]];
        if (v974.itemCounts[v1197.group.id] == undefined ? true : v974.itemCounts[v1197.group.id] < (vP16144.isSandbox ? 299 : v1197.group.limit ? v1197.group.limit : 99)) {
          f662(v974.items[p1885]);
          f664(1, p1886);
          f663(vO56.weaponCode, true);
        }
      } catch (e17) {}
    }
    function f721(p1887, p1888) {
      try {
        var v1198 = vP16146.list[v974.items[p1887]];
        var v1199 = v974.scale + v1198.scale + (v1198.placeOffset || 0);
        var v1200 = v974.x2 + v1199 * Math.cos(p1888);
        var v1201 = v974.y2 + v1199 * Math.sin(p1888);
        if (v991.checkItemLocation(v1200, v1201, v1198.scale, 0.6, v1198.id, false, v974)) {
          if (v974.itemCounts[v1198.group.id] == undefined ? true : v974.itemCounts[v1198.group.id] < (vP16144.isSandbox ? 299 : v1198.group.limit ? v1198.group.limit : 99)) {
            f662(v974.items[p1887]);
            f664(1, p1888);
            f663(vO56.weaponCode, true);
          }
        }
      } catch (e18) {}
    }
    // ADD NEW PLAYER:
    function f722(p1889, p1890) {
      var vFindPlayerByID = f755(p1889[0]);
      if (!vFindPlayerByID) {
        vFindPlayerByID = new vP16149(p1889[0], p1889[1], vP16144, vP16142, v972, v991, vA46, vA45, vP16146, v989, v990);
        vA46.push(vFindPlayerByID);
      }
      vFindPlayerByID.spawn(p1890 ? vF587 : null);
      vFindPlayerByID.visible = false;
      vFindPlayerByID.x2 = undefined;
      vFindPlayerByID.y2 = undefined;
      vFindPlayerByID.x3 = undefined;
      vFindPlayerByID.y3 = undefined;
      vFindPlayerByID.setData(p1889);
      if (p1890) {
        v974 = vFindPlayerByID;
        v977 = v974.x;
        v978 = v974.y;
        f625();
        f672();
        f677();
        f674(0);
        vF24126.style.display = "block";
        f724();
        if (f241("tryhard").checked) {
          v950.showText(v974.x, v974.y, 50, 0.5, 500, "Ping: " + window.pingTime, "#fff");
        }
        f241("priXP").innerHTML = "Primary XP: 0 / not found";
        f241("secXP").innerHTML = "Secondary XP: 0 / not found";
        setTimeout(() => {
          for (let vLN0189 = 0; vLN0189 < f729(); vLN0189++) {
            f720(0, f651());
          }
        }, 200);
      }
    }
    // REMOVE PLAYER:
    function f723(p1891) {
      for (var vLN0190 = 0; vLN0190 < vA46.length; vLN0190++) {
        if (vA46[vLN0190].id == p1891) {
          if (f241("enemyradar" + vA46[vLN0190].sid)) {
            f241("enemyradar" + vA46[vLN0190].sid).remove();
          }
          vA46.splice(vLN0190, 1);
          break;
        }
      }
    }
    // UPDATE PLAYER ITEM VALUES:
    let vA88 = [];
    function f724(p1892 = undefined) {
      for (let vLN0191 = 0; vLN0191 < vP16146.list.length; ++vLN0191) {
        let v1202 = vP16146.list[vLN0191].group.id;
        let v1203 = vP16146.weapons.length + vLN0191;
        if (!vA88[v1203]) {
          vA88[v1203] = document.createElement("div");
          vA88[v1203].id = "itemCount" + v1203;
          f241("actionBarItem" + v1203).appendChild(vA88[v1203]);
          vA88[v1203].style = `
                    display: block;
                    position: absolute;
                    padding-left: 5px;
                    font-size: 2em;
                    color: #fff;
                    `;
          if (vLN0191 < 3) {
            vA88[v1203].innerHTML = Math.floor(v974.food / vP16146.list[vLN0191].req[1]);
          } else {
            vA88[v1203].innerHTML = v974.itemCounts[v1202] || 0;
          }
        } else {
          if (p1892 == v1202) {
            vA88[v1203].innerHTML = v974.itemCounts[p1892] || 0;
          }
          if (p1892 == undefined) {
            if (vLN0191 < 3) {
              vA88[v1203].innerHTML = Math.floor(v974.food / vP16146.list[vLN0191].req[1]);
            }
          }
        }
        if (f241("visual").value == "0" || f241("visual").value == "ae") {
          if (vA88[v1203].style.display == "block") {
            vA88[v1203].style.display = "none";
          }
        } else if (vA88[v1203].style.display == "none") {
          vA88[v1203].style.display = "block";
        }
      }
    }
    function f725(p1893, p1894) {
      if (v974) {
        v974.itemCounts[p1893] = p1894;
        f724(p1893);
      }
    }
    // UPDATE PLAYER VALUE:
    function f726(p1895, p1896, p1897) {
      if (v974) {
        v974[p1895] = p1896;
        if (p1895 == "food") {
          for (let vLN0192 = 0; vLN0192 < 3; vLN0192++) {
            let v1204 = vP16146.weapons.length + vLN0192;
            f241("itemCount" + v1204).innerHTML = Math.floor(v974.food / vP16146.list[vLN0192].req[1]);
          }
        }
        if (p1895 == "food" || p1895 == "wood" || p1895 == "stone") {
          let v1205 = p1896 - parseFloat(f241(p1895 + "Display").innerText);
          if (v1205 > 0) {
            f746(() => {
              v974.addWeaponXP(v1205);
            });
          }
        }
        if (p1897) {
          f672();
        }
      }
    }
    // ADVANCED:
    function f727(p1898) {
      if (v974.health == 100) {
        return 0;
      }
      if (v974.skinIndex != 45 && v974.skinIndex != 56) {
        return Math.ceil(p1898 / vP16146.list[v974.items[0]].healing);
      }
      return 0;
    }
    function f728(p1899) {
      if (p1899 * v974.skinIndex == 6) {
        return 0.75;
      } else {
        return 1;
      }
    }
    function f729() {
      if (v974.health == 100) {
        return 0;
      }
      if (v974.skinIndex != 45 && v974.skinIndex != 56) {
        return Math.ceil((100 - v974.health) / vP16146.list[v974.items[0]].healing);
      }
      return 0;
    }

    // LATER:
    function f730() {}
    // UPDATE HEALTH:
    let vUndefined7 = undefined;
    let v1206 = false;
    let v1207 = false;
    let v1208 = false;
    let vA89 = [];
    function f731(p1900, p1901) {
      v976 = f756(p1900);
      if (v976) {
        let v1209 = v976.health;
        v976.health = p1901;
        if (v1209 < v976.health) {
          if (v976.hitTime) {
            let v1210 = Date.now() - v976.hitTime;
            let v1211 = v976.shameCount;
            let v1212 = vO66.time.filter(p1902 => p1902 == "lag");
            let v1213 = Math.max(120, window.pingTime);
            v976.hitTime = 0;
            if (v1210 <= (v1212.length >= 2 ? 120 : 120)) {
              v976.shameCount += 1;
              if (vO63.isTrue) {
                v976.healSid = Math.min(3, v976.healSid + 1);
              }
              if (v976.shameCount > v976.maxShame) {
                v976.maxShame = v976.shameCount;
              }
            } else {
              v976.shameCount = Math.max(0, v976.shameCount - 2);
              if (vO63.isTrue) {
                v976.healSid = Math.max(-1, v976.healSid - 1);
              }
            }
            if (v976 != v974) {
              if (v1211 < v976.shameCount) {//                                tmpObj.dangerShame = tmpObj.shameCount;
              }
            } else {
              vLN100 = v1210 - window.pingTime;
            }
          }
        } else if (v1209 > v976.health) {
          v976.hitTime = Date.now();
          v976.hitted = true;
          v976.damaged = true;
          let v1214 = v1209 - v976.health;
          if (v976.skinIndex == 7 && (v1214 == 5 || v976.tailIndex == 13 && v1214 == 2)) {
            v976.bTick = vO66.tick;
            if (v976 == v974) {
              v1036 = false;
            }
          }
          //                               console.log(damage);
          if (v976 == v974) {
            if (f241("simpleheal").checked) {
              f734(v976, v1214);
            } else {
              f733(v976, v1214);
            }
          }
        }
      }
    }
    let v1215 = false;
    function f732(p1903, p1904) {
      let vF11 = function () {
        return Math.max(0, 180 - window.pingTime);
      };
      let vLN70 = 70;
      let vLN125 = 125;
      if (true) {
        /*if (!stopHealing) {
        stopHealing = true;
        setTimeout(()=> {
            stopHealing = false;
        }, config.tickRate * 1.5);
        for (let i = 0; i < healthBased(); i++) {
            place(0, getAttackDir());
        }
        }*/
        (f241("tickheal").checked ? f745 : setTimeout)(() => {
          for (let vLN0193 = 0; vLN0193 < f727(p1904); vLN0193++) {
            f720(0, f651());
          }
        }, f241("tickheal").checked ? 2 : vF11());
      } else {
        (f241("tickheal").checked ? f745 : setTimeout)(() => {
          for (let vLN0194 = 0; vLN0194 < f727(p1904); vLN0194++) {
            f720(0, f651());
          }
        }, f241("tickheal").checked ? 2 : vF11());
      }
    }
    let vA90 = [];
    let v1216 = Date.now();
    function f733(p1905, p1906) {
      let vF12 = function () {
        return Math.max(0, 180 - window.pingTime);
      };
      let vLN702 = 70;
      let vLN1252 = 125;
      let v1217 = false;
      let vUndefined8 = undefined;
      if (true) {
        if (vA94.dist2 <= 300) {
          if (p1906 >= 20 && (Date.now() - v1216 >= 180 || Date.now() - v1216 <= 60)) {
            if (p1905.shameCount < p1905.dangerShame) {
              for (let vLN0195 = 0; vLN0195 < f727(p1906); vLN0195++) {
                f720(0, f651());
              }
            } else {
              (f241("tickheal").checked ? f745 : setTimeout)(() => {
                for (let vLN0196 = 0; vLN0196 < f727(p1906); vLN0196++) {
                  f720(0, f651());
                }
              }, f241("tickheal").checked ? 2 : vF12());
            }
          } else if (vO65.in) {
            f732(p1905, p1906);
          } else {
            (f241("tickheal").checked ? f745 : setTimeout)(() => {
              for (let vLN0197 = 0; vLN0197 < f727(p1906); vLN0197++) {
                f720(0, f651());
              }
            }, f241("tickheal").checked ? 2 : vF12());
          }
          if (v974.skinIndex == 11) {
            if (p1906 >= 30) {
              vO63.isCounter = true;
            }
          }
          if (p1906 >= 20) {
            v1216 = Date.now();
            v1208 = true;
          }
        } else if (vO65.in) {
          f732(p1905, p1906);
        } else {
          (f241("tickheal").checked ? f745 : setTimeout)(() => {
            for (let vLN0198 = 0; vLN0198 < f727(p1906); vLN0198++) {
              f720(0, f651());
            }
          }, f241("tickheal").checked ? 2 : vF12());
        }
      }
    }
    function f734(p1907, p1908) {
      let vF13 = function () {
        return Math.max(0, 170 - window.pingTime);
      };
      let vLN703 = 70;
      let vLN1253 = 125;
      let v1218 = false;
      if (true) {
        if (vA93.length) {
          if (p1908 >= 20) {
            v1208 = true;
          }
          for (let vLN0199 = 0; vLN0199 < vA93.length; vLN0199++) {
            let v1219 = vA93[vLN0199];
            let vA91 = [];
            let v1220 = p1908 >= (p1907.skinIndex == 6 ? 25 : 10) && (v1219.secondaryIndex == undefined || v1219.primaryIndex == undefined ? true : v1219.reloads[v1219.primaryIndex] == 0);
            if (v1220) {
              v1218 = true;
            }
          }
          if (v1218) {
            if (p1907.shameCount < p1907.dangerShame) {
              for (let vLN0200 = 0; vLN0200 < f727(p1908); vLN0200++) {
                f720(0, f651());
              }
            } else {
              (f241("tickheal").checked ? f745 : setTimeout)(() => {
                for (let vLN0201 = 0; vLN0201 < f727(p1908); vLN0201++) {
                  f720(0, f651());
                }
              }, f241("tickheal").checked ? 2 : vF13());
            }
          } else {
            (f241("tickheal").checked ? f745 : setTimeout)(() => {
              for (let vLN0202 = 0; vLN0202 < f727(p1908); vLN0202++) {
                f720(0, f651());
              }
            }, f241("tickheal").checked ? 2 : vF13());
          }
          if (v974.skinIndex == 11) {
            if (p1908 >= 30) {
              vO63.isCounter = true;
            }
          }
        } else {
          (f241("tickheal").checked ? f745 : setTimeout)(() => {
            for (let vLN0203 = 0; vLN0203 < f727(p1908); vLN0203++) {
              f720(0, f651());
            }
          }, f241("tickheal").checked ? 2 : vF13());
        }
      }
    }
    // CALC DAMAGE:
    function f735(p1909) {
      let vLN0204 = 0;
      if (v974.alive) {
        let vO57 = {
          weapon: v974.weapons[0],
          variant: v974.primaryVariant,
          dmg: v974.weapons[0] == undefined ? 0 : vP16146.weapons[v974.weapons[0]].dmg
        };
        let vO58 = {
          weapon: v974.weapons[1],
          variant: v974.secondaryVariant,
          dmg: v974.weapons[1] == undefined ? 0 : vP16146.weapons[v974.weapons[1]].Pdmg
        };
        let v1221 = v974.skins[7] && !p1909 ? 1.5 : 1;
        let v1222 = vO57.variant != undefined ? vP16144.weaponVariants[vO57.variant].val : 1;
        if (vO57.weapon != undefined && v974.reloads[vO57.weapon] == 0) {
          vLN0204 += vO57.dmg * v1222 * v1221;
        }
        if (vO58.weapon != undefined && v974.reloads[vO58.weapon] == 0) {
          vLN0204 += vO58.dmg;
        }
        if (v974.skins[53] && v974.reloads[53] == 0 && vA94.skinIndex != 22) {
          vLN0204 += 25;
        }
        vLN0204 *= vA94.skinIndex == 6 ? 0.75 : 1;
        return vLN0204;
      }
      return 0;
    }
    function f736(p1910) {
      p1910.instaThreat = 0;
      if (f741(p1910)) {
        let vO59 = {
          weapon: p1910.primaryIndex,
          variant: p1910.primaryVariant,
          dmg: p1910.primaryIndex == undefined ? 45 : vP16146.weapons[p1910.primaryIndex].dmg
        };
        let vO60 = {
          weapon: p1910.secondaryIndex,
          variant: p1910.secondaryVariant,
          dmg: p1910.secondaryIndex == undefined ? 50 : vP16146.weapons[p1910.secondaryIndex].Pdmg
        };
        let v1223 = p1910.skinIndex == 7 ? 1.5 : 1;
        let v1224 = vO59.variant != undefined ? vP16144.weaponVariants[vO59.variant].val : 1.18;
        if (vO59.weapon != undefined && p1910.reloads[vO59.weapon] == 0) {
          p1910.instaThreat += vO59.dmg * v1224 * v1223;
        }
        if (vO60.weapon != undefined && p1910.reloads[vO60.weapon] == 0) {
          p1910.instaThreat += vO60.dmg;
        }
        if (p1910.reloads[53] === 0) {
          p1910.instaThreat += 25;
        }
        p1910.instaThreat *= v974.skinIndex == 6 ? 0.75 : 1;
      }
    }
    let vLN0205 = 0;
    function f737() {
      vLN0205 = 0;
      if (vA92.length) {
        if (vA94.dist2 <= 300) {
          if (vO56.antiBull2 > 0 && vA94.skinIndex == 11) {
            vLN0205 += vP16146.weapons[v974.weapons[0]].dmg * 0.45;
          }
          if (vO56.antiBull2 > 0 && vA94.tailIndex == 21) {
            vLN0205 += vP16146.weapons[v974.weapons[0]].dmg * 0.25;
          }
          vLN0205 *= v974.skinIndex == 6 ? 0.75 : 1;
          if ((vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0 && v974.shameCount > 0) {
            vLN0205 += 5;
            if (v974.tailIndex == 13) {
              vLN0205 -= 3;
            }
          }
        }
      }
    }
    // RENDER TRACER / CREDIT TO NEKOSAN:
    function f738(p1911) {
      let vO61 = {
        x: v982 / 2,
        y: v983 / 2
      };
      let v1225 = vP16142.getDirect(p1911, v974, 2, 2);
      let v1226 = Math.min(1, vP16142.getDistance(0, 0, v974.x2 - p1911.x2, (v974.y2 - p1911.y2) * (16 / 9)) * 100 / (vP16144.maxScreenHeight / 2) / vO61.y);
      let v1227 = vO61.y * v1226;
      let v1228 = vO61.x + v1227 * Math.cos(v1225) - 10;
      let v1229 = vO61.y + v1227 * Math.sin(v1225) - 10;
      if (!f241("enemyradar" + p1911.sid)) {
        let v1230 = document.createElement("div");
        v1230.id = "enemyradar" + p1911.sid;
        document.body.append(v1230);
        v1230.style = `
                display: none;
                position: absolute;
                left: 0;
                top: 0;
                color: #fff;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 10px 0 10px 20px;
                border-color: transparent transparent transparent #fff;
                `;
      }
      if (f241("enemyradar" + p1911.sid)) {
        f241("enemyradar" + p1911.sid).style.left = v1228 + "px";
        f241("enemyradar" + p1911.sid).style.top = v1229 + "px";
        f241("enemyradar" + p1911.sid).style.display = !f741(p1911) ? "block" : "none";
        f241("enemyradar" + p1911.sid).style.opacity = v1226;
        f241("enemyradar" + p1911.sid).style.transform = "rotate(" + vP16142.toAng(v1225) + "deg)";
      }
    }
    let vA92 = [];
    let vA93 = [];
    let vA94 = [];
    let vO62 = {
      x: undefined,
      y: undefined,
      size: function (p1912) {
        return p1912 * 1.45;
      },
      dist: function (p1913) {
        return p1913 * 1.8;
      },
      active: vP16144.isSandbox ? true : false,
      count: 0
    };
    function f739() {
      let vA95 = [2, 3, 4, 5];
      f745(() => {
        v1237 = true;
        f745(() => {
          v1237 = false;
        }, vA95[Math.floor(Math.random() * (vA95.length + 1))]);
      }, 1);
    }
    let vLN0206 = 0;
    let v1231 = false;
    let vO63 = {
      wait: false,
      can: false,
      isTrue: false,
      nobull: false,
      isCounter: false,
      abCount: 0,
      changeType: function (p1914) {
        vO63.wait = false;
        vO63.isTrue = true;
        v1232 = true;
        if (p1914 == "rev") {
          f663(v974.weapons[1]);
          f622(53, 0);
          f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 0 : 21, 1);
          f661();
          f745(() => {
            f663(v974.weapons[0]);
            f622(26, 0);
            f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 0 : 18, 1);
            f745(() => {
              f661();
              vO63.isTrue = false;
              v1232 = false;
              f739();
            }, 1);
          }, 1);
        } else if (p1914 == "nobull") {
          f663(v974.weapons[0]);
          f622(f241("combat").value == "fz" ? 11 : 6, 0);
          f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 0 : 18, 1);
          f661();
          f745(() => {
            f663(v974.weapons[1]);
            f622(53, 0);
            f622(f241("combat").value == "ae" ? 11 : f241("combat").value == "hans" ? 0 : 21, 1);
            f745(() => {
              f661();
              vO63.isTrue = false;
              v1232 = false;
            }, 1);
          }, 1);
        } else if (p1914 == "normal") {
          f663(v974.weapons[0]);
          f622(26, 0);
          f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 0 : 18, 1);
          f661();
          f745(() => {
            f663(v974.weapons[1]);
            f622(53, 0);
            f622(f241("combat").value == "ae" ? 11 : f241("combat").value == "hans" ? 0 : 21, 1);
            f745(() => {
              f661();
              vO63.isTrue = false;
              v1232 = false;
              f739();
            }, 1);
          }, 1);
        } else {
          setTimeout(() => {
            vO63.isTrue = false;
            v1232 = false;
          }, 50);
        }
      },
      syncTry: function () {
        if (v974.weapons[1] == 15) {
          vO63.isTrue = true;
          vP1614.send("D", vA94.aim2);
          v1232 = true;
          vA87.push(vA94.dist2);
          f663(v974.weapons[1]);
          f622(53, 0);
          f622(0, 1);
          f661();
          f745(() => {
            v1232 = false;
            vO63.isTrue = false;
            f661();
          }, 2);
        }
      },
      zeroFrame: function () {
        if ([4, 5].includes(v974.weapons[0]) && [9, 12, 13].includes(v974.weapons[1])) {
          vO63.isTrue = true;
          v1232 = true;
          f720(4, vA94.aim2);
          f745(() => {
            f663(v974.weapons[1]);
            f661();
            f622(53, 0);
            f622(0, 1);
            vP1614.send("9", vA94.aim2);
            f745(() => {
              f622(7, 0);
              f622(21 || 0, 1);
              f663(v974.weapons[0]);
              vP1614.send("9", vA94.aim2);
              f745(() => {
                vO63.isTrue = false;
                v1232 = false;
                vP1614.send("9", null);
                vP1614.send("9", vUndefined6);
                f661();
                f739();
              }, 1);
            }, 1);
          }, 1);
        }
      },
      counterType: function () {
        vO63.isTrue = true;
        v1232 = true;
        f663(v974.weapons[0]);
        f622(7, 0);
        f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 0 : 21, 1);
        f661();
        f745(() => {
          if (f241("countertur").checked && v974.reloads[53] == 0 && v974.skins[53] || f241("countersec").checked && v974.reloads[v974.weapons[1]] == 0 && v974.weapons[1]) {
            if (f241("countersec").checked && v974.reloads[v974.weapons[1]] == 0 && v974.weapons[1]) {
              f663(v974.weapons[1]);
            }
            if (f241("countertur").checked && v974.reloads[53] == 0 && v974.skins[53]) {
              f622(53, 0);
            } else {
              f622(6, 0);
            }
            f622(f241("combat").value == "ae" ? 11 : f241("combat").value == "hans" ? 0 : 21, 1);
            f745(() => {
              f661();
              vO63.isTrue = false;
              v1232 = false;
              f739();
            }, 1);
          } else {
            f661();
            vO63.isTrue = false;
            v1232 = false;
          }
        }, 1);
      },
      spikeTickType: function () {
        vO63.isTrue = true;
        v1232 = true;
        f663(v974.weapons[0]);
        f622(7, 0);
        f622(f241("combat").value == "ae" ? 0 : f241("combat").value == "hans" ? 21 : 18, 1);
        f661();
        f745(() => {
          f661();
          vO63.isTrue = false;
          v1232 = false;
        }, 1);
      },
      rangeType: function () {
        vP1614.send("6", "Chating..");
        vO63.isTrue = true;
        vP1614.send("D", vA94.aim2);
        v1232 = true;
        if (v974.weapons[1] == 9) {
          vA87.push(vA94.dist2);
          v1231 = true;
          f663(v974.weapons[1]);
          f622(53, 0);
          f661();
          f745(() => {
            f675(12);
            f663(v974.weapons[1]);
            f745(() => {
              f675(15);
              f663(v974.weapons[1]);
              f745(() => {
                v1231 = false;
                f661();
                vO63.isTrue = false;
                v1232 = false;
              }, 1);
            }, 1);
          }, 1);
        } else {
          f663(v974.weapons[1]);
          if (v974.reloads[53] == 0 && vA94.dist2 <= 700 && vA94.skinIndex != 22) {
            f622(53, 0);
          } else {
            f622(20, 0);
          }
          f622(11, 1);
          f661();
          f745(() => {
            f661();
            vO63.isTrue = false;
            v1232 = false;
          }, 2);
        }
      }
    };
    let v1232 = false;
    let vO64 = {
      reloaded: false
    };
    let vO65 = {
      in: false,
      aim: Number.MAX_VALUE,
      healths: 69
    };
    let vO66 = {
      tick: 0,
      delay: 0,
      time: [],
      manage: []
    };
    function f740(p1915) {
      let v1233 = p1915.x2 - p1915.x1;
      let v1234 = p1915.y2 - p1915.y1;
      p1915.x3 = p1915.x2 + v1233;
      p1915.y3 = p1915.y2 + v1234;
    }
    let vO67 = {
      x: undefined,
      y: undefined
    };
    let v1235 = false;
    function f741(p1916) {
      return p1916 == v974 || p1916.team && p1916.team == v974.team;
    }
    let vLN0207 = 0;
    let vA96 = [];
    let vLN0208 = 0;
    let vLN0209 = 0;
    let vA97 = ["Don't care", "didin't ask", "cry about it", "stay mad", "get real", "L", "mad seethe cope harder", "hoes mad", "basic", "skill issue", "ratio", "you fell off", "the audacity", "triggered", "any askers", "replled", "get a life", "ok and?", "cringe", "touch grass", "donowalled", "not based", "not funny didn’t laugh", "*you're", "grammar issues", "go outside", "get good", "reported", "ad hominem", "GG!", "ask deez", "ez clap", "straight cash", "ratio again", "final ratio", "problematic", "furry lover", "retard", "bad", "cry", "ez", "easy", "basic", "need hard", "so bad", "cringe", "get teacher"];
    let v1236 = false;
    let vLN0210 = 0;
    let v1237 = false;
    function f742(p1917) {
      return f241("combat").value == p1917;
    }
    function f743(p1918, p1919) {
      return Math.hypot(p1918.y2 - p1919.y2, p1918.x2 - p1919.x2);
    }
    function f744(p1920) {
      vA92 = [];
      vA93 = [];
      vA94 = [];
      vO66.tick++;
      vO66.time.push(Date.now() - vO66.delay <= 50 || Date.now() - vO66.delay >= 175 ? "lag" : 1);
      if (vO66.tick % 10 === 0) {
        vO66.time = [];
      }
      if (vO66.tick % 300 === 0) {
        if (f241("visual").value == "fz") {
          vNaN = window.pingTime;
          vNaN2 = window.pingTime;
        }
      }
      vO66.delay = Date.now();
      var v1238 = Date.now();
      for (let vLN0211 = 0; vLN0211 < vA46.length; ++vLN0211) {
        vA46[vLN0211].forcePos = !vA46[vLN0211].visible;
        vA46[vLN0211].visible = false;
        if (f241("enemyradar" + vA46[vLN0211].sid)) {
          f241("enemyradar" + vA46[vLN0211].sid).style.display = "none";
        }
      }
      for (let vLN0212 = 0; vLN0212 < p1920.length;) {
        v976 = f756(p1920[vLN0212]);
        if (v976) {
          v976.t1 = v976.t2 === undefined ? v1238 : v976.t2;
          v976.t2 = v1238;
          v976.x1 = v976.x;
          v976.y1 = v976.y;
          v976.x2 = p1920[vLN0212 + 1];
          v976.y2 = p1920[vLN0212 + 2];
          f740(v976);
          v976.aim2 = vP16142.getDirect(v976, v974, 2, 2);
          v976.dist2 = vP16142.getDist(v976, v974, 2, 2);
          v976.aim3 = vP16142.getDirect(v976, v974, 3, 3);
          v976.dist3 = vP16142.getDist(v976, v974, 3, 3);
          v976.d1 = v976.d2 === undefined ? p1920[vLN0212 + 3] : v976.d2;
          v976.d2 = p1920[vLN0212 + 3];
          v976.dt = 0;
          v976.rt = 0;
          v976.buildIndex = p1920[vLN0212 + 4];
          v976.weaponIndex = p1920[vLN0212 + 5];
          v976.weaponVariant = p1920[vLN0212 + 6];
          v976.team = p1920[vLN0212 + 7];
          v976.isLeader = p1920[vLN0212 + 8];
          v976.skinIndex = p1920[vLN0212 + 9];
          v976.tailIndex = p1920[vLN0212 + 10];
          v976.iconIndex = p1920[vLN0212 + 11];
          v976.zIndex = p1920[vLN0212 + 12];
          v976.visible = true;
          if (v976 == v974) {
            v976.syncThreats = 0;
            v976.primaryIndex = v976.weapons[0];
            v976.secondaryIndex = v976.weapons[1];
            if (!vO62.x || !vO67.x) {
              vO62.x = vO67.x = v976.x2;
            }
            if (!vO62.y || !vO67.y) {
              vO62.y = vO67.y = v976.y2;
            }
          }
          if (v976.weaponIndex < 9) {
            if (v976 != v974) {
              v976.primaryIndex = v976.weaponIndex;
            }
            v976.primaryVariant = v976.weaponVariant;
          } else if (v976.weaponIndex > 8) {
            if (v976 != v974) {
              v976.secondaryIndex = v976.weaponIndex;
            }
            v976.secondaryVariant = v976.weaponVariant;
          }
        }
        vLN0212 += 13;
      }
      if (vA96.length) {
        vA96.forEach(p1921 => {
          p1921();
        });
        vA96 = [];
      }
      if (vA86.length) {
        vA86.forEach(p1922 => {
          f713(...p1922);
        });
        vA86 = [];
      }
      vLN0209 = 0;
      for (let vLN0213 = 0; vLN0213 < p1920.length;) {
        v976 = f756(p1920[vLN0213]);
        if (v976) {
          if (v976.doTickUpdate) {
            v976.doTickUpdate = false;
          }
          if (!f741(v976)) {
            vA92.push(v976);
            if (v976.dist2 <= vP16146.weapons[v976.primaryIndex == undefined ? 5 : v976.primaryIndex].range + v974.scale * 3 + (f241("addictdist").checked && window.pingTime >= 90 ? window.pingTime / 3 : 0)) {
              vA93.push(v976);
            }
            if (f241("visual").value == "ae" || f241("visual").value == "fz" || f241("visual").value == "ae") {
              f738(v976);
            }
          }
          if (v976.pCount > -1) {
            if ((vO66.tick - v976.bTick) % vP16144.serverUpdateRate === 0) {
              v976.pCount--;
            }
          }
          v976.oldReloads[53] = v976.reloads[53];
          if (v976.shooting[53]) {
            v976.shooting[53] = 0;
            v976.reloads[53] = 2500 - vP16144.tickRate;
            v976.oldReloads[53] = v976.reloads[53];
            if (f241("antitick").checked && !f741(v976)) {
              if (v976.primaryIndex == 5 && v976.primaryVariant >= 2 && v976.dist2 >= 175 && v976.dist2 <= 275) {
                vLN0208 = 2;
              }
            }
          } else if (v976.reloads[53] > 0) {
            v976.reloads[53] = Math.max(0, v976.reloads[53] - vP16144.tickRate);
            if (v976.reloads[53] <= 0) {
              let vV9762 = v976;
              vV9762.turretReloaded = true;
              f745(() => {
                vV9762.turretReloaded = false;
              }, 1);
            }
          }
          v976.oldReloads[v976.primaryIndex == undefined ? v976.weaponIndex : v976.primaryIndex] = v976.reloads[v976.primaryIndex == undefined ? v976.weaponIndex : v976.primaryIndex];
          v976.oldReloads[v976.secondaryIndex == undefined ? v976.weaponIndex : v976.secondaryIndex] = v976.reloads[v976.secondaryIndex == undefined ? v976.weaponIndex : v976.secondaryIndex];
          if (v976.gathering || v976.shooting[1]) {
            if (v976.gathering) {
              v976.gathering = 0;
              v976.reloads[v976.gatherIndex] = vP16146.weapons[v976.gatherIndex].speed * (v976.skinIndex == 20 ? 0.78 : 1);
              v976.oldReloads[v976.gatherIndex] = v976.reloads[v976.gatherIndex];
            }
            if (v976.shooting[1]) {
              v976.shooting[1] = 0;
              v976.reloads[v976.shootIndex] = vP16146.weapons[v976.shootIndex].speed * (v976.skinIndex == 20 ? 0.78 : 1);
              v976.oldReloads[v976.shootIndex] = v976.reloads[v976.shootIndex];
              if (v976 != v974 && v974.team && v976.team == v974.team && v974.weapons[1] == 15 && v976.shootIndex == 15) {
                vLN0209++;
              }
            }
          } else if (v976.buildIndex < 0) {
            if (v976.reloads[v976.weaponIndex] > 0) {
              v976.reloads[v976.weaponIndex] = Math.max(0, v976.reloads[v976.weaponIndex] - vP16144.tickRate);
              if (v976.weaponIndex == v976.primaryIndex) {
                if (v976.reloads[v976.primaryIndex] <= 0) {
                  if (v976 == v974) {
                    vO56.antiBull2++;
                    f745(() => {
                      vO56.antiBull2--;
                    }, 1);
                  } else if (!f741(v976) && v976.dist2 <= vP16146.weapons[v976.primaryIndex ? v976.primaryIndex : 5].range + v974.scale * 1.8 + window.pingTime / 2) {
                    vO56.antiBull++;
                    f745(() => {
                      vO56.antiBull--;
                    }, 1);
                  }
                }
              }
            }
          }
          f736(v976);
        }
        vLN0213 += 13;
      }
      vO15.x = v974.x2;
      vO15.y = v974.y2;
      if (vO66.tick % 24 === 0) {
        vO15.sync = true;
      } else {
        vO15.sync = false;
      }
      if (vA92.length) {
        vA94 = vA92.sort(function (p1923, p1924) {
          return vP16142.getDist(p1923, v974, 2, 2) - vP16142.getDist(p1924, v974, 2, 2);
        })[0];
        vUndefined2 = function (p1925) {
          return vP16142.getDirect(vA94, p1925, 2, 0);
        };
      } else {
        vUndefined2 = function (p1926) {
          return undefined;
        };
      }
      try {
        if (f241("spin").checked) {
          v1237 = true;
        } else {
          v1237 = false;
        }
        vA93.forEach(p1927 => {
          if (p1927.primaryIndex != undefined && p1927.reloads[p1927.primaryIndex] == 0 && p1927.primaryIndex != undefined && p1927.reloads[p1927.primaryIndex] == 0) {
            v974.syncThreats++;
          }
        });
        vLN0207 = 0;
        vA48.filter(p1928 => p1928.active && p1928.doUpdate).forEach(p1929 => {
          if (p1929.shootted) {
            p1929.shootted = 0;
            p1929.shootReload = 2200 - vP16144.tickRate;
          } else if (p1929.shootReload > 0) {
            p1929.shootReload = Math.max(0, p1929.shootReload - vP16144.tickRate);
            if (p1929.shootReload <= 0) {
              p1929.shootReload = 2200;
              if (v974.sid != p1929.owner.sid && !f759(p1929.owner.sid) && vP16142.getDist(p1929, v974, 0, 2) <= 735) {
                vLN0207++;
              }
            }
          }
        });
        if ((f735(true) >= 100 ? f735(true) : f735(false)) >= (v974.weapons[1] == 10 ? 95 : 100) && vA94.dist2 <= vP16146.weapons[v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]].range + vA94.scale * 1.8 && vO63.wait && !vO63.isTrue && !vO56.waitHit && v974.reloads[v974.weapons[0]] == 0 && v974.reloads[v974.weapons[1]] == 0 && v974.reloads[53] == 0) {
          if (f735(true) >= 100) {
            vO63.nobull = true;
          } else {
            vO63.nobull = false;
          }
          vO63.can = true;
        } else {
          vO63.can = false;
        }
        f737();
        if (vO66.manage[vO66.tick]) {
          vO66.manage[vO66.tick].forEach(p1930 => {
            p1930();
          });
        }
        if (v974.alive) {
          if (v974.syncThreats >= 2 && f241("antisync").checked && !v1187) {
            if (f241("combat").value == "me" || f241("combat").value == "fz" || f241("combat").value == "zyenith") {
              vP1614.send("6", f241("combat").value == "me" ? "Anti 1" : "Anti 2");
            }
            f709(3);
          }
          if (v1208) {
            v1208 = false;
            if (f241("soldierempanti").checked && vA92.length && vA94.reloads[53] <= vP16144.tickRate && vA94.secondaryIndex != 10 && vA94.secondaryIndex != 11 && vA94.secondaryIndex != 14) {
              v1207 = true;
            }
          }
          if (f241("autoq").checked && (v1247 || f241("evautoq").checked)) {
            f241("healer").innerHTML = "Healer: autoQ";
            if (v974.shameCount < 4 && vA94.dist2 <= 300 && vA94.reloads[vA94.primaryIndex] <= vP16144.tickRate * (window.pingTime >= 200 ? 2 : 1)) {
              v1235 = true;
              f720(0, f651());
            } else {
              if (v1235) {
                f720(0, f651());
              }
              v1235 = false;
            }
          } else {
            v1235 = false;
            if (vA93.length >= 2) {
              f241("healer").innerHTML = "Healer: " + vA93.length + "v1";
            } else {
              f241("healer").innerHTML = "Healer: " + (window.pingTime <= 80 ? "Low Ping" : "High Ping");
            }
          }
          if (vLN0209 >= parseInt(f241("synccount").value)) {
            if (f241("sync").checked) {
              v1186 = true;
            }
          }
          if (vO34.middle || v1186 || v998) {
            if (v1186) {
              v1186 = false;
            }
            if (v998) {
              v998 = false;
            }
          }
          if (vO63.can) {
            vO63.changeType(f241("alwaysrev").checked ? "rev" : v974.weapons[1] == 10 ? "rev" : vO63.nobull ? "nobull" : "normal");
          }
          if (vO63.isCounter) {
            vO63.isCounter = false;
            if (v974.reloads[v974.weapons[0]] == 0 && !vO63.isTrue) {
              vO63.counterType();
            }
          }
          if (v1049) {
            v1049 = false;
            if (!vO63.isTrue && v974.reloads[v974.weapons[0]] == 0) {
              vO63.spikeTickType();
            }
          }
          // MOUSE EVENT:
          if (!vO34.middle && (vO34.left || vO34.right) && !vO63.isTrue && !vO63.can) {
            if (v974.weaponIndex != (vO34.right && f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0])) {
              f663(vO34.right && f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]);
            }
            if (v974.reloads[vO34.right && f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
              vP1614.send("K", 1);
              f745(() => {
                vP1614.send("K", 1);
              }, 1);
            }
          }
          if (vA48.length) {
            vA89 = [];
            vA89 = vA48.filter(p1931 => p1931.dmg && v974.sid != p1931.owner.sid && !f759(p1931.owner.sid) && p1931.active && vP16142.getDist(p1931, v974, 0, 2) < p1931.scale + v974.scale).sort(function (p1932, p1933) {
              return vP16142.getDist(p1932, v974, 0, 2) - vP16142.getDist(p1933, v974, 0, 2);
            })[0];
            let v1239 = vA48.filter(p1934 => p1934.trap && p1934.active).sort(function (p1935, p1936) {
              return vP16142.getDist(p1935, v974, 0, 2) - vP16142.getDist(p1936, v974, 0, 2);
            })[0];
            if (v1239) {
              vO65.aim = vP16142.getDirect(v1239, v974, 0, 2);
              if (v974.sid != v1239.owner.sid && !f759(v1239.owner.sid) && Math.hypot(v1239.y - v974.y2, v1239.x - v974.x2) <= 50 && f241("abactive").checked) {
                vO65.in = true;
                vO65.healths = v1239.buildHealth;
                if (!vO63.isTrue && !vO34.middle && !vO34.left && !vO34.right) {
                  if (v974.weaponIndex != v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]) {
                    f663(v1239.buildHealth > vP16146.weapons[v974.weapons[0]].dmg && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]);
                  }
                  if (v974.reloads[v1239.buildHealth > vP16146.weapons[v974.weapons[0]].dmg && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0 && (v1239.buildHealth > vP16146.weapons[v974.weapons[0]].dmg && v974.weapons[1] == 10 ? true : !vO56.waitHit)) {
                    vO56.waitHit = true;
                    vP1614.send("K", 1);
                    f745(() => {
                      vP1614.send("K", 1);
                      vO56.waitHit = false;
                    }, 1);
                  }
                }
              } else {
                vO65.in = false;
              }
            } else {
              vO65.in = false;
            }
          } else {
            vO65.in = false;
          }
          // RELOADS:
          if (!vO63.isTrue && v974.weapons[1] && !vO34.left && !vO34.right && !vO65.in) {
            if ((v974.weapons[0] == 3 || v974.weapons[0] == 4 || v974.weapons[0] == 5) && (v974.weapons[1] == 10 || v974.weapons[1] == 14)) {
              if (v974.reloads[v974.weapons[0]] == 0 && v974.reloads[v974.weapons[1]] == 0) {
                if (!vO64.reloaded) {
                  vO64.reloaded = true;
                  if (v974.weaponIndex != v974.weapons[1]) {
                    f663(v974.weapons[1]);
                  }
                }
              } else {
                vO64.reloaded = false;
                if (v974.reloads[v974.weapons[0]] > 0) {
                  if (v974.weaponIndex != v974.weapons[0]) {
                    f663(v974.weapons[0]);
                  }
                } else if (v974.reloads[v974.weapons[0]] == 0 && v974.reloads[v974.weapons[1]] > 0) {
                  if (v974.weaponIndex != v974.weapons[1]) {
                    f663(v974.weapons[1]);
                  }
                }
              }
            } else if (v974.reloads[v974.weapons[0]] == 0 && v974.reloads[v974.weapons[1]] == 0) {
              if (!vO64.reloaded) {
                vO64.reloaded = true;
                if (v974.weaponIndex != v974.weapons[0]) {
                  f663(v974.weapons[0]);
                }
              }
            } else {
              vO64.reloaded = false;
              if (v974.reloads[v974.weapons[1]] > 0) {
                if (v974.weaponIndex != v974.weapons[1]) {
                  f663(v974.weapons[1]);
                }
              } else if (v974.reloads[v974.weapons[1]] == 0 && v974.reloads[v974.weapons[0]] > 0) {
                if (v974.weaponIndex != v974.weapons[0]) {
                  f663(v974.weapons[0]);
                }
              }
            }
          }
          // PLACES:
          if (vO36.slot0 && !v1235) {
            f720(0, f651());
          } else if (vO36.slot2) {
            f720(2, f651());
          } else if (vO36.slot4) {
            f720(4, f651());
          } else if (vO36.slot5) {
            f720(5, f651());
          }
          if (!vO63.isTrue && (f241("abplace").checked ? true : !vO65.in)) {
            f747();
          }
          try {
            let vParseFloat = parseFloat(f241("placeconfig").value);
            let v1240 = vO62.size(vP16146.list[v974.items[vParseFloat]].scale);
            let v1241 = vO62.dist(vP16146.list[v974.items[vParseFloat]].scale);
            if (vP16142.getDist(vO62, v974, 0, 2) > v1241 + vP16146.list[v974.items[vParseFloat]].placeOffset) {
              if (vO62.active) {
                let v1242 = vP16142.getDirect(vO62, v974, 0, 2);
                let vO68 = {
                  x: vO62.x,
                  y: vO62.y
                };
                let v1243 = vP16142.getDirect(vO68, v974, 0, 2);
                f721(vParseFloat, v1243 + vP16142.toRad(v1240));
                f721(vParseFloat, v1243 - vP16142.toRad(v1240));
                f721(vParseFloat, v1243);
                vO62.count = Math.max(0, vO62.count - 1);
              }
              vO62.x = v974.x2;
              vO62.y = v974.y2;
            }
          } catch (e19) {}
          // EXTRA:
          if (vF24149.style.display != "block" && !vO63.isTrue) {
            // Wow This Is Real Left Right:
            if (vO34.left || vO34.right) {
              f751("click");
              f752("click");
            } else if (vO65.in) {
              f751("trap");
              f752("trap");
            } else {
              f751("normal");
              f752("normal");
            }
          }
          // SEND DIR:
          if (!vO36.slot0 && !vO36.slot2 && !vO36.slot4 && !vO36.slot5 && !v1235) {
            let vF651 = f651();
            if (v974.dir !== vF651) {
              vUndefined3 = vF651;
              vP1614.send("D", vF651);
            }
          }
          if (v1207) {
            v1207 = false;
          }
          if (vLN0208 > 0) {
            vLN0208--;
          }
        }
      } catch (e20) {
        console.error(e20);
      }
      if (v1043) {
        if (vA94.dist2 <= 1000) {
          f590();
        } else {
          f589();
        }
      } else {
        f590();
      }
    }
    function f745(p1937, p1938) {
      if (!vO66.manage[vO66.tick + p1938]) {
        vO66.manage[vO66.tick + p1938] = [p1937];
      } else {
        vO66.manage[vO66.tick + p1938].push(p1937);
      }
    }
    function f746(p1939) {
      vA96.push(p1939);
    }
    // AUTO PLACE:
    function f747() {
      let vA98 = [];
      let v1244 = Math.random() * Math.PI * 2;
      if (vA48.length && vA92.length && f241("autoplc").checked) {
        let vO69 = {
          inTrap: false
        };
        vA98 = vA48.filter(p1940 => p1940.trap).sort(function (p1941, p1942) {
          return vP16142.getDist(p1941, vA94, 0, 2) - vP16142.getDist(p1942, vA94, 0, 2);
        })[0];
        if (vA98) {
          if ((v974.sid == vA98.owner.sid || !!f759(vA98.owner.sid)) && vP16142.getDist(vA98, vA94, 0, 2) <= 70 && vA98.active) {
            vO69.inTrap = true;
          } else {
            vO69.inTrap = false;
          }
          if (vA94.dist2 <= 300) {
            if (vO69.inTrap || vA94.dist2 <= vP16146.weapons[v974.weapons[0]].range + vA94.scale * 1.8) {
              if (vA94.dist2 <= 225) {
                for (let vLN0214 = 0; vLN0214 < Math.PI * 2; vLN0214 += Math.PI / 1.5) {
                  f721(2, vA94.aim2 + vLN0214);
                }
              } else {
                for (let v1245 = Math.PI / 1.5; v1245 < Math.PI * 2; v1245 += Math.PI / 1.5) {
                  f721(2, vA94.aim2 + v1245);
                }
              }
            } else if (v974.items[4] == 15) {
              if (vP16142.getDist(vO67, v974, 0, 2) >= 125) {
                for (let vLN0215 = 0; vLN0215 < Math.PI * 2; vLN0215 += Math.PI / 2) {
                  f721(4, v1244 + vLN0215);
                }
                vO67.x = v974.x2;
                vO67.y = v974.y2;
              }
            }
          }
        } else if (vA94.dist2 <= 400) {
          if (v974.items[4] == 15) {
            f721(4, vA94.aim2);
          }
        }
      }
    }
    // EQUIP HATS:
    function f748() {
      if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
        f622(31, 0);
      } else if (vUndefined6 == undefined && (f241("combat").value == "zyenith" || f241("combat").value == "hans" || f241("combat").value == "pre")) {
        f622(6, 0);
        f622(19, 1);
      } else if (v974.y2 <= vP16144.snowBiomeTop) {
        f622(15, 0);
        f622(11, 1);
      } else {
        f622(12, 0);
        if (v974.y2 <= vP16144.snowBiomeTop) {
          f622(11, 1);
        } else {
          f622(11, 1);
        }
      }
    }
    function f749() {
      return vA94.primaryIndex == 0 || vA94.primaryIndex == 6 || vA94.primaryIndex == 7 || vA94.primaryIndex == 8;
    }
    function f750() {
      return vA94.secondaryIndex == 9 || vA94.secondaryIndex == 10 || vA94.secondaryIndex == 11 || vA94.secondaryIndex == 14;
    }
    function f751(p1943) {
      if (p1943 == "normal") {
        if (vLN0208 > 0) {
          f622(6, 0);
        } else if (f241("bulltick").checked && v974.shameCount > 0 && (vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0 && v974.skinIndex != 45 || v1036) {
          f622(7, 0);
        } else if (f241("combat").value == "ae") {
          f622(6, 0);
        } else if (f241("combat").value == "fz") {
          if (vLN0207 > 0 || v1207) {
            f622(22, 0);
          } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
            f622(31, 0);
          } else if (vA92.length) {
            if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
              if (vA94.primaryIndex != undefined && vA94.reloads[vA94.primaryIndex] == 0 && vA94.secondaryIndex != undefined && vA94.reloads[vA94.secondaryIndex] == 0 && v974.reloads[v974.weapons[0]] <= vP16144.tickRate && v974.reloads[v974.weapons[1]] == 0 && v974.weapons[0] != 7 && v974.weapons[0] != 8 && vA94.primaryIndex != 7 && vA94.primaryIndex != 8) {
                f622(11, 0);
              } else if (f749() && f750()) {
                f622(53, 0);
                f622(7, 0);
              } else {
                f622(f241("soldieranti").checked ? 6 : 26, 0);
              }
            } else {
              f748();
            }
          } else {
            f748();
          }
        } else if (f241("combat").value == "me") {
          if (vLN0207 > 0 || v1207) {
            f622(22, 0);
          } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
            f622(31, 0);
          } else if (vA92.length) {
            if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
              if (vO56.antiBull > 0 && v974.weapons[0] != 7) {
                f622(11, 0);
              } else {
                f622(f241("soldieranti").checked ? 6 : 26, 0);
              }
            } else {
              f748();
            }
          } else {
            f748();
          }
        } else if (vLN0207 > 0 || v1207) {
          f622(22, 0);
        } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
          f622(31, 0);
        } else if (vA92.length) {
          if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
            if (vO56.antiBull > 0 && v974.weapons[0] != 7) {
              f622(11, 0);
            } else {
              f622(f241("soldieranti").checked ? 6 : 26, 0);
            }
          } else {
            f748();
          }
        } else {
          f748();
        }
      } else if (p1943 == "click") {
        if (vLN0208 > 0) {
          f622(6, 0);
        } else if (f241("bulltick").checked && v974.shameCount > 0 && (vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0 && v974.skinIndex != 45 || v1036) {
          f622(7, 0);
        } else if (vO34.left && v974.reloads[v974.weapons[0]] == 0) {
          f622(53, 0);
          f622(7, 0);
        } else if (vO34.right && v974.reloads[f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
          f622(40, 0);
        } else if (f241("combat").value == "ae") {
          f622(6, 0);
        } else if (f241("combat").value == "fz") {
          if (vLN0207 > 0 || v1207) {
            f622(22, 0);
          } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
            f622(31, 0);
          } else if (vA94.dist2 <= 500) {
            if (f749() && f750()) {
              f622(53, 0);
              f622(26, 0);
            } else {
              f622(f241("soldieranti").checked ? 6 : 26, 0);
            }
          } else {
            f748();
          }
        } else if (f241("combat").value == "me") {
          if (vLN0207 > 0 || v1207) {
            f622(22, 0);
          } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
            f622(31, 0);
          } else if (vO34.left && vO56.antiBull > 0 && v974.weapons[0] != 7) {
            f622(11, 0);
          } else {
            f622(f241("soldieranti").checked ? 6 : 26, 0);
          }
        } else if (vLN0207 > 0 || v1207) {
          f622(22, 0);
        } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
          f622(31, 0);
        } else if (vO34.left && vO56.antiBull > 0 && v974.weapons[0] != 7) {
          f622(11, 0);
        } else {
          f622(f241("soldieranti").checked ? 6 : 26, 0);
        }
      } else if (p1943 == "trap") {
        if (vLN0208 > 0) {
          f622(6, 0);
        } else if (f241("bulltick").checked && v974.shameCount > 0 && (vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0 && v974.skinIndex != 45 || v1036) {
          f622(7, 0);
        } else if (vO65.healths > vP16146.weapons[v974.weapons[0]].dmg && v974.reloads[v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
          f622(40, 0);
        } else if (f241("combat").value == "fz") {
          if (vLN0207 > 0 || v1207) {
            f622(22, 0);
          } else if (vA94.dist2 <= 300) {
            if (f749() && f750() || vA94.primaryIndex == 5 && vA94.dist2 >= 175) {
              f622(53, 0);
              f622(26, 0);
            } else {
              f622(f241("soldieranti").checked ? 6 : 26, 0);
            }
          } else {
            f748();
          }
        } else if (f241("combat").value == "hans") {
          if (vLN0207 > 0 || v1207 || vA94.secondaryIndex == 10) {
            f622(22, 0);
          } else {
            f622(f241("soldieranti").checked ? 6 : 26, 0);
          }
        } else if (vLN0207 > 0 || v1207 || vA94.dist2 > 300) {
          f622(22, 0);
        } else {
          f622(f241("soldieranti").checked ? 6 : 26, 0);
        }
      }
    }
    function f752(p1944) {
      if (p1944 == "normal") {
        if (f241("combat").value == "ae") {
          f622(11, 1);
        } else if (v974.y2 >= vP16144.mapScale / 2 - vP16144.riverWidth / 2 && v974.y2 <= vP16144.mapScale / 2 + vP16144.riverWidth / 2) {
          f622(11, 1);
        } else if (vA92.length) {
          if (f241("combat").value == "fz") {
            if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
              if (vA94.primaryIndex != undefined && vA94.reloads[vA94.primaryIndex] == 0 && vA94.secondaryIndex != undefined && vA94.reloads[vA94.secondaryIndex] == 0 && v974.reloads[v974.weapons[0]] <= vP16144.tickRate && v974.reloads[v974.weapons[1]] == 0 && v974.weapons[0] != 7 && v974.weapons[0] != 8 && vA94.primaryIndex != 7 && vA94.primaryIndex != 8) {
                f622(21, 1);
              } else if (vO56.antiBull > 0) {
                f622(21, 1);
              } else if ((vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0) {
                f622(13, 1);
              } else {
                f622(11, 1);
              }
            } else {
              f622(11, 1);
            }
          } else if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
            if (vO56.antiBull > 0) {
              f622(21, 1);
            } else {
              f622(11, 1);
            }
          } else {
            f622(11, 1);
          }
        } else {
          f622(11, 1);
        }
      } else if (p1944 == "click") {
        if (f241("combat").value == "ae") {
          if (vO34.left) {
            f622(0, 1);
          } else if (vO34.right) {
            f622(11, 1);
          }
        } else if (f241("combat").value == "fz") {
          if (vO56.antiBull > 0) {
            f622(21, 1);
          } else if (vO34.left && v974.reloads[v974.weapons[0]] == 0) {
            f622(vA94.dist2 <= 300 ? 18 : 0, 1);
          } else if (vO34.right && v974.reloads[f241("grindsec").checked && v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
            f622(vA94.dist2 <= 300 ? 18 : 11, 1);
          } else if ((vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0) {
            f622(vA94.dist2 <= 500 ? 13 : 11, 1);
          } else {
            f622(11, 1);
          }
        } else {
          f622(21, 1);
        }
      } else if (p1944 == "trap") {
        if (f241("combat").value == "ae") {
          f622(0, 1);
        } else if (f241("combat").value == "hans") {
          f622(0, 1);
        } else if (f241("combat").value == "fz") {
          if (vO56.antiBull > 0) {
            f622(21, 1);
          } else if (vO65.healths > vP16146.weapons[v974.weapons[0]].dmg && v974.reloads[v974.weapons[1] == 10 ? v974.weapons[1] : v974.weapons[0]] == 0) {
            f622(vA94.dist2 <= 275 ? 18 : 11, 1);
          } else if (vA94.dist2 <= 300) {
            if (vO63.wait) {
              f622(21, 1);
            } else if ((vO66.tick - v974.bTick) % vP16144.serverUpdateRate === 0) {
              f622(13, 1);
            } else {
              f622(11, 1);
            }
          } else {
            f622(11, 1);
          }
        } else if (vO56.antiBull > 0) {
          f622(21, 1);
        } else if (vA94.dist2 <= vP16146.weapons[vA94.primaryIndex ? vA94.primaryIndex : 5].range + v974.scale * 3) {
          f622(21, 1);
        } else {
          f622(11, 1);
        }
      }
    }
    // FIND OBJECTS BY ID/SID:
    function f753(p1945, p1946) {
      return p1945.find(p1947 => p1947.id === p1946);
    }
    function f754(p1948, p1949) {
      return p1948.find(p1950 => p1950.sid === p1949);
    }
    function f755(p1951) {
      return f753(vA46, p1951);
    }
    function f756(p1952) {
      return f754(vA46, p1952);
    }
    function f757(p1953) {
      return f754(vA45, p1953);
    }
    function f758(p1954) {
      return f754(vA48, p1954);
    }
    function f759(p1955) {
      if (v974.team) {
        return vA52.find(p1956 => p1956 === p1955);
      } else {
        return null;
      }
    }
    // PING:
    var v1246 = -1;
    var vNaN = NaN;
    var vNaN2 = NaN;
    var vLN0216 = 0;
    var v1247 = false;
    function f760() {
      var v1248 = Date.now() - v1246;
      window.pingTime = v1248;
      vLN0216++;
      if (v1248 > vNaN || isNaN(vNaN)) {
        vNaN = v1248;
      }
      if (v1248 < vNaN2 || isNaN(vNaN2)) {
        vNaN2 = v1248;
      }
      if (f241("visual").value == "zeph") {
        vF24119.innerText = "Ping: " + v1248 + " ms | FPS: " + vLN0217 + " frames";
      } else if (f241("visual").value == "hans") {
        vF24119.innerText = "Ping: " + v1248 + " ms / © King Hans";
      } else {
        vF24119.innerText = "Ping: " + v1248 + " ms";
      }
      if (v1248 >= 90) {
        v1247 = true;
      } else {
        v1247 = false;
      }
    }
    vF24119.style.display = "none";
    document.body.appendChild(vF24119);
    function f761() {
      v1246 = Date.now();
      vP1614.send("0");
    }
    // SERVER SHUTDOWN NOTICE:
    function f762(p1957) {
      if (p1957 < 0) {
        return;
      }
      var v1249 = Math.floor(p1957 / 60);
      var v1250 = p1957 % 60;
      v1250 = ("0" + v1250).slice(-2);
      vF24120.innerText = "Server restarting in " + v1249 + ":" + v1250;
      vF24120.hidden = false;
    }
    // UPDATE & ANIMATE:
    window.requestAnimFrame = function () {
      return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (p1958) {
        window.setTimeout(p1958, 1000 / 60);
      };
    }();
    // DAY CYCLE MANAGER:
    let v1251 = false;
    let vO70 = {
      snow: "#fff",
      river: "#91b2db",
      grass: "#b6db66",
      desert: "#dbc666"
    };
    let vO71 = {
      snow: "#e6e6e6",
      river: "#78a1d3",
      grass: "#8dba2c",
      desert: "#d3b945"
    };
    setInterval(() => {
      v1251 = !v1251;
    }, 78000);
    // LMFAO:
    var v1252 = document.createElement("div");
    v1252.id = "status";
    v1252.style.position = "absolute";
    v1252.style.color = "#e6e6fa";
    v1252.style.font = "15px Hammersmith One";
    v1252.style.top = "40px";
    v1252.style.left = "40px";
    v1252.style.display = "none";
    v1252.textAlign = "right";
    document.body.appendChild(v1252);
    let vLN0217 = 0;
    let vLN0218 = 0;
    let v1253 = true;
    let v1254 = false;
    let vO72 = {
      6: true,
      7: true,
      40: true,
      22: true,
      15: true
    };
    v1252.innerHTML = `
                <style>
                .sizing {
                    font-size: 15px;
                }
                .mod {
                    font-size: 15px;
                    display: inline-block;
                }
                .augh {
                    display: inline-block;
                    width: 25px;
                    height: 25px;
                    background-size: cover;
                    background-color: #fff;
                    margin-right: 6px;
                    opacity: 0.4;
                    x20text-shadow:\x200px\x200px\x2032px\x20#fff\x22>
                }
                </style>
                <div id = "fzmod" class = "sizing" style = "display: block;">
             𝐈𝐧𝐬𝐭𝐚𝐒𝐭𝐚𝐭𝐮𝐬: [<div id = "instaStatus" class = "mod">0</div>]</br>
             𝐄𝐀𝐁: [<div id = "eabStatus1" class = "mod">0</div>]</br>
             𝐀𝐝𝐯𝐏𝐥𝐚𝐜𝐞𝐫𝐬: [<div id = "millStatus1" class = "mod">0</div>]</br>
             𝐄𝐰𝐌𝐮𝐬𝐢𝐜: [<div id = "musicStatus1" class = "mod">0</div>]</br>
             𝐏𝐚𝐜𝐤𝐞𝐭𝐬/𝐦𝐬: [<div id = "packetStatus" class = "mod">0</div>]ms</br>
              <div id = "priXP">Primary: 0 / Max</div>
               <div id = "secXP">Seconadry XP: 0 / Max</div>
                𝐏𝐢𝐧𝐠|𝐅𝐩𝐬: [<div id = "pingFps" class = "mod">0</div>]</br>
                </div><div id = "uehmod" class = "sizing" style = "display: none;">
                Auto-Insta: <div id = "autoInsta1" class = "mod">0</div></br>

                Ticks | Lags: [<div id = "tickLag" class = "mod">0</div>]</br>
                <div id = "nearEnemys" class = "mod">0</div></br>

                </div><div id = "zyenithmod" class = "sizing" style = "display: none;">
                <div id = "hatdispdiv" style = "display: block">
                <div id = "hatdisp6" class = "augh" style = "background-image: url(https://moomoo.io/img/hats/hat_6.png);"></div>
                <div id = "hatdisp7" class = "augh" style = "background-image: url(https://moomoo.io/img/hats/hat_7.png);"></div>
                <div id = "hatdisp40" class = "augh" style = "background-image: url(https://moomoo.io/img/hats/hat_40.png);"></div>
                <div id = "hatdisp22" class = "augh" style = "background-image: url(https://moomoo.io/img/hats/hat_22.png);"></div>
                <div id = "hatdisp15" class = "augh" style = "background-image: url(https://moomoo.io/img/hats/hat_15.png);"></div>
                </div>
                Auto-Insta: <div id = "autoInsta2" class = "mod">0</div></br>
                EAB: {<div id = "eabStatus" class = "mod">0</div>}</br>
                Music: <div id = "musicStatus" class = "mod">0</div></br>
                AdvPlacer: <div id = "millStatus" class = "mod">0</div></br>
                Turrets that can hit you: |<div id = "turCanHit" class = "mod">0</div>|</br>
                Damage Prediction: |<div id = "dmgPredict" class = "mod">0</div>|</br>
                </div>
                `;
    function f763() {
      v967 = Date.now();
      v966 = v967 - v969;
      v969 = v967;
      vLN0218++;
      if (v1253) {
        v1253 = false;
        setInterval(() => {
          vLN0217 = vLN0218;
          vLN0218 = 0;
        }, 1000);
      }
      f679();
      requestAnimFrame(f763);
      if (v974) {
        if (f241("visual").value == "me") {
          f241("autoInsta1").innerHTML = (vO63.wait ? "on" : "off").toUpperCase();
          f241("tickLag").innerHTML = vO66.time;
          f241("nearEnemys").innerHTML = vA93.length ? "cEnemy: " + vA93.length : "";
        } else if (f241("visual").value == "fz") {
          f241("instaStatus").innerHTML = [vO63.wait, vO63.isTrue, vP16142.fixTo(f735(false), 2)].join(", ");
          f241("pingFps").innerHTML = `${window.pingTime}ms | Fps: ${vLN0217}`;
          f241("packetStatus").innerHTML = vLN045;
          f241("eabStatus1").innerHTML = vO52.start ? [`hit:${vO52.hit}`, `miss:${vO52.miss}`].join(",") : "";
          f241("musicStatus1").innerHTML = v1254 ? "true" : "false";
          f241("millStatus1").innerHTML = vO62.active ? "true" : "false";
        } else if (f241("visual").value == "zyenith") {
          f241("autoInsta2").innerHTML = (vO63.wait ? "on" : "off").toUpperCase();
          f241("eabStatus").innerHTML = vO52.start ? [`hit:${vO52.hit}`, `miss:${vO52.miss}`].join(",") : "";
          f241("musicStatus").innerHTML = (v1254 ? "on" : "off").toUpperCase();
          f241("dmgPredict").innerHTML = vLN0205;
          f241("turCanHit").innerHTML = vLN0207;
          f241("millStatus").innerHTML = (vO62.active ? "on" : "off").toUpperCase();
        }
      }
    }
    // START GAME:
    function f764() {
      f594();
      f673();
      vF24125.style.display = "none";
      vF24123.style.display = "block";
      vF24137.value = f587("moo_name") || "";
      f624();
    }
    f705();
    f763();
    // OPEN LINK:
    function f765(p1959) {
      window.open(p1959, "_blank");
    }
    // EXPORT VALUES:
    window.openLink = f765;
    window.aJoinReq = f606;
    window.follmoo = f588;
    window.kickFromClan = f607;
    window.sendJoin = f608;
    window.leaveAlliance = f610;
    window.createAlliance = f609;
    window.storeBuy = f621;
    window.storeEquip = f620;
    window.showItemInfo = f597;
    window.selectSkinColor = f630;
    window.changeStoreIndex = f616;
    window.config = vP16144;
    document.createAlliance = function (p1960) {
      if (v974.team) {
        vP1614.send("N", undefined);
        setTimeout(() => {//                    io.send("8", value == "" ? String.fromCharCode(0) + " ".repeat(6) : value);
        }, 1000);
      } else {
        vP1614.send("L", p1960 == "" ? String.fromCharCode(0) + " ".repeat(6) : p1960);
      }
    };
    // FUNCTIONS:
    let vF24158 = f241("mapDisplay");
    vF24158.style.backgroundImage = "";
    vF24158.style.backgroundSize = "130px";
    let vF24159 = f241("pingDisplay");
    function f766(p1961) {
      f241("uehmod").style.display = "none";
      f241("fzmod").style.display = "none";
      f241("zyenithmod").style.display = "none";
      let v1255 = p1961 == "me" ? "uehmod" : p1961 == "fz" ? "fzmod" : p1961 == "zyenith" ? "zyenithmod" : undefined;
      if (v1255 != undefined) {
        f241(v1255).style.display = "block";
      }
    }
    f241("combat").onchange = function () {
      f241("crp").innerHTML = f246(f241("combat").value);
      this.blur();
    };
    function f767(p1962) {
      //            console.log("call");
      f241("vrp").innerHTML = f246(f241("visual").value);
      f766(f241("visual").value);
      if (p1962) {
        f724();
      }
      vF24159.style.display = "none";
      vF24159.innerText = "Ping: " + window.pingTime + " ms";
      vF24159.style.left = null;
      vF24158.style.backgroundImage = "";
      vF24158.style.backgroundColor = "rgba(0, 0, 0, 0.25)";
      vF24129.style.display = "block";
      vF24130.style.display = "block";
      vF24131.style.display = "block";
      vF24128.style.bottom = "160px";
      vF24128.style.right = "inherit";
      vF24128.style.left = "20px";
      vF24128.style.backgroundPosition = "left 6px center";
      vF24128.style.paddingLeft = "40px";
      vF24128.style.paddingRight = "10px";
      if (f241("visual").value == "0") {} else if (f241("visual").value == "me") {
        v1252.style.color = "#e6e6fa";
        v1252.style.top = "40px";
        v1252.style.left = "40px";
        v1252.style.right = null;
      } else if (f241("visual").value == "spyder") {
        vF24158.style.backgroundImage = "url(https://i.imgur.com/S1ogeNC.gif)";
        vF24159.style.display = "block";
      } else if (f241("visual").value == "Combat") {
        vF24158.style.backgroundImage = "url(https://media.giphy.com/media/o9c3QvHJXjiI74BTmc/giphy.gif)";
        vF24159.style.display = "block";
        vF24119.style.color = "#000000";
        vF24159.style.left = "90px";
        vF24119.innerText = "Ping: " + window.pingTime + " ms / Â© Artemis'x Combat Rev'x5";
      } else if (f241("visual").value == "lore") {
        vF24158.style.backgroundImage = "url(https://ksw2-center.glitch.me/users/fzb/map.png)";
      } else if (f241("visual").value == "Art") {} else if (f241("visual").value == "zeph") {
        vF24159.style.display = "block";
        vF24119.innerText = "Ping: " + window.pingTime + " ms | FPS: " + vLN0217 + " frames";
      } else if (f241("visual").value == "zeph") {} else if (f241("visual").value == "fz" || f241("visual").value == "zyenith") {
        vF24158.style.backgroundImage = "url(https://ksw2-center.glitch.me/users/fzb/map.png)";
      } else if (f241("visual").value == "hans") {
        vF24159.style.display = "block";
        vF24159.style.left = "90px";
        vF24119.innerText = "Ping: " + window.pingTime + " ms / Â© King Hans";
        vF24158.style.backgroundColor = "rgba(0, 0, 0, 0)";
      } else {}
      if (f241("visual").value == "fz" || f241("visual").value == "zyenith") {
        v1252.style.color = "#fff";
        v1252.style.top = "40px";
        v1252.style.left = null;
        if (f241("visual").value == "zyenith") {
          v1252.style.right = "40px";
        } else {
          v1252.style.right = "20px";
        }
        v1252.style.display = "block";
        vF24134.style.position = "fixed";
        vF24134.style.left = "20px";
        vF24134.style.right = null;
        vF24134.style.display = "none";
        vF24111.style.left = "410px";
        vF24111.style.right = null;
        vF24111.style.width = "40px";
        vF24112.style.left = "350px";
        vF24112.style.right = null;
        vF24112.style.width = "40px";
        vF24113.style.display = "none";
        try {} catch (e21) {}
        v987.appendChild(vF24132);
        if (f241("visual").value == "fz") {
          vF24132.style.bottom = "185px";
          vF24132.style.right = "20px";
          vF24128.style.bottom = "240px";
          vF24128.style.right = "20px";
          vF24128.style.left = "inherit";
          vF24128.style.backgroundPosition = "right 6px center";
          vF24128.style.paddingLeft = "10px";
          vF24128.style.paddingRight = "40px";
        } else {
          vF24129.style.display = "none";
          vF24130.style.display = "none";
          vF24131.style.display = "none";
          vF24132.style.bottom = "20px";
          vF24132.style.right = "20px";
        }
      } else {
        vF24134.style.position = null;
        vF24134.style.left = null;
        vF24134.style.right = null;
        vF24134.style.display = "block";
        vF24111.style.left = null;
        vF24111.style.right = "270px";
        vF24111.style.width = "40px";
        vF24112.style.left = null;
        vF24112.style.right = "330px";
        vF24112.style.width = "40px";
        vF24113.style.display = "block";
        vF24133.appendChild(vF24132);
        vF24132.style.bottom = null;
        vF24132.style.right = null;
        v1252.style.display = "none";
      }
      if (v974) {
        vF24140.style.width = (f241("visual").value == "Art" || f241("visual").value == "ae" ? "0" : v974.XP / v974.maxXP * 100) + "%";
        for (var vLN0219 = 0; vLN0219 < vP16146.list.length; ++vLN0219) {
          var v1256 = vP16146.weapons.length + vLN0219;
          f241("actionBarItem" + v1256).style.display = (f241("visual").value == "Art" || f241("visual").value == "ae" || f241("visual").value == "hans" ? v974.firstItems : v974.items).indexOf(vP16146.list[vLN0219].id) >= 0 ? "inline-block" : "none";
        }
      }
      //            Wut = getEl("visual").description;
    }
    f767();
    f241("visual").onchange = function () {
      f767(true);
      this.blur();
    };
    /***/
  },
  /***/
  "./src/js/config.js":
  /*!**************************!*\
  !*** ./src/js/config.js ***!
  \**************************/
  /*! no static exports found */
  /***/
  function (p1963, p1964, p1965) {
    /* WEBPACK VAR INJECTION */
    (function (p1966) {
      // RENDER:
      p1963.exports.maxScreenWidth = 1920;
      p1963.exports.maxScreenHeight = 1080;
      // SERVER:
      p1963.exports.serverUpdateRate = 9;
      p1963.exports.tickRate = 1000 / p1963.exports.serverUpdateRate;
      p1963.exports.maxPlayers = p1966 && p1966.argv.indexOf("--largeserver") != -1 ? 80 : 40;
      p1963.exports.maxPlayersHard = p1963.exports.maxPlayers + 10;
      p1963.exports.collisionDepth = 6;
      p1963.exports.minimapRate = 3000;
      // COLLISIONS:
      p1963.exports.colGrid = 10;
      // CLIENT:
      p1963.exports.clientSendRate = 5;
      // UI:
      p1963.exports.healthBarWidth = 50;
      p1963.exports.healthBarPad = 4.5;
      p1963.exports.iconPadding = 15;
      p1963.exports.iconPad = 0.9;
      p1963.exports.deathFadeout = 3000;
      p1963.exports.crownIconScale = 60;
      p1963.exports.crownPad = 35;
      // CHAT:
      p1963.exports.chatCountdown = 3000;
      p1963.exports.chatCooldown = 500;
      // SANDBOX:
      p1963.exports.inSandbox = p1966 && p1966.env.VULTR_SCHEME === "mm_exp";
      p1963.exports.isSandbox = window.location.hostname == "sandbox.moomoo.io";
      // PLAYER:
      p1963.exports.maxAge = 100;
      p1963.exports.gatherAngle = Math.PI / 2.6;
      p1963.exports.gatherWiggle = 10;
      p1963.exports.hitReturnRatio = 0.25;
      p1963.exports.hitAngle = Math.PI / 2;
      p1963.exports.playerScale = 35;
      p1963.exports.playerSpeed = 0.0016;
      p1963.exports.playerDecel = 0.993;
      p1963.exports.nameY = 34;
      // CUSTOMIZATION:
      p1963.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373"];
      // ANIMALS:
      p1963.exports.animalCount = 7;
      p1963.exports.aiTurnRandom = 0.06;
      p1963.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"];
      // WEAPONS:
      p1963.exports.shieldAngle = Math.PI / 3;
      p1963.exports.weaponVariants = [{
        id: 0,
        src: "",
        xp: 0,
        val: 1
      }, {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1
      }, {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18
      }, {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18
      }];
      p1963.exports.weaponXPs = [{
        id: 0,
        xp: 3000
      }, {
        id: 1,
        xp: 7000
      }, {
        id: 2,
        xp: 12000
      }, {
        id: 3,
        xp: Infinity
      }];
      p1963.exports.fetchVariant = function (p1967) {
        var v1257 = p1967.weaponXP[p1967.weaponIndex] || 0;
        for (var v1258 = p1963.exports.weaponVariants.length - 1; v1258 >= 0; --v1258) {
          if (v1257 >= p1963.exports.weaponVariants[v1258].xp) {
            return p1963.exports.weaponVariants[v1258];
          }
        }
      };
      // NATURE:
      p1963.exports.resourceTypes = ["wood", "food", "stone", "points"];
      p1963.exports.areaCount = 7;
      p1963.exports.treesPerArea = 9;
      p1963.exports.bushesPerArea = 3;
      p1963.exports.totalRocks = 32;
      p1963.exports.goldOres = 7;
      p1963.exports.riverWidth = 724;
      p1963.exports.riverPadding = 114;
      p1963.exports.waterCurrent = 0.0011;
      p1963.exports.waveSpeed = 0.0001;
      p1963.exports.waveMax = 1.3;
      p1963.exports.treeScales = [150, 160, 165, 175];
      p1963.exports.bushScales = [80, 85, 95];
      p1963.exports.rockScales = [80, 85, 90];
      // BIOME DATA:
      p1963.exports.snowBiomeTop = 2400;
      p1963.exports.snowSpeed = 0.75;
      // DATA:
      p1963.exports.maxNameLength = 15;
      // MAP:
      p1963.exports.mapScale = 14400;
      p1963.exports.mapPingScale = 40;
      p1963.exports.mapPingTime = 2200;

      // EVENT MULTIPLIERS (added by the current bundle):
      p1963.exports.MAX_ATTACK = 0.6;
      p1963.exports.MAX_SPAWN_DELAY = 1;
      p1963.exports.MAX_SPEED = 0.3;
      p1963.exports.MAX_TURN_SPEED = 0.3;
      p1963.exports.DAY_INTERVAL = 1440000;
      /* WEBPACK VAR INJECTION */
    }).call(this, p1965(/*! ./../../node_modules/process/browser.js */
    "./node_modules/process/browser.js"));
    /***/
  },
  /***/
  "./src/js/data/ai.js":
  /*!***************************!*\
  !*** ./src/js/data/ai.js ***!
  \***************************/
  /*! no static exports found */
  /***/
  function (p1968, p1969) {
    var v1259 = Math.PI * 2;
    p1968.exports = function (p1970, p1971, p1972, p1973, p1974, p1975, p1976, p1977) {
      this.sid = p1970;
      this.isAI = true;
      this.nameIndex = p1974.randInt(0, p1975.cowNames.length - 1);
      // INIT:
      this.init = function (p1978, p1979, p1980, p1981, p1982) {
        this.x = p1978;
        this.y = p1979;
        this.startX = p1982.fixedSpawn ? p1978 : null;
        this.startY = p1982.fixedSpawn ? p1979 : null;
        this.xVel = 0;
        this.yVel = 0;
        this.zIndex = 0;
        this.dir = p1980;
        this.dirPlus = 0;
        this.index = p1981;
        this.src = p1982.src;
        if (p1982.name) {
          this.name = p1982.name;
        }
        this.weightM = p1982.weightM;
        this.speed = p1982.speed;
        this.killScore = p1982.killScore;
        this.turnSpeed = p1982.turnSpeed;
        this.scale = p1982.scale;
        this.maxHealth = p1982.health;
        this.leapForce = p1982.leapForce;
        this.health = this.maxHealth;
        this.chargePlayer = p1982.chargePlayer;
        this.viewRange = p1982.viewRange;
        this.drop = p1982.drop;
        this.dmg = p1982.dmg;
        this.hostile = p1982.hostile;
        this.dontRun = p1982.dontRun;
        this.hitRange = p1982.hitRange;
        this.hitDelay = p1982.hitDelay;
        this.hitScare = p1982.hitScare;
        this.spriteMlt = p1982.spriteMlt;
        this.nameScale = p1982.nameScale;
        this.colDmg = p1982.colDmg;
        this.noTrap = p1982.noTrap;
        this.spawnDelay = p1982.spawnDelay;
        this.hitWait = 0;
        this.waitCount = 1000;
        this.moveCount = 0;
        this.weaponReload = 0;
        this.weaponHitted = 0;
        this.targetDir = 0;
        this.active = true;
        this.alive = true;
        this.runFrom = null;
        this.chargeTarget = null;
        this.dmgOverTime = {};
        this.doTickUpdate = false;
      };
      // UPDATE:
      var vLN0220 = 0;
      this.update = function (p1983) {
        if (this.active) {
          // SPAWN DELAY:
          if (this.spawnCounter) {
            this.spawnCounter -= p1983;
            if (this.spawnCounter <= 0) {
              this.spawnCounter = 0;
              this.x = this.startX || p1974.randInt(0, p1975.mapScale);
              this.y = this.startY || p1974.randInt(0, p1975.mapScale);
            }
            return;
          }
          // REGENS AND AUTO:
          vLN0220 -= p1983;
          if (vLN0220 <= 0) {
            if (this.dmgOverTime.dmg) {
              this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
              this.dmgOverTime.time -= 1;
              if (this.dmgOverTime.time <= 0) {
                this.dmgOverTime.dmg = 0;
              }
            }
            vLN0220 = 1000;
          }
          // BEHAVIOUR:
          var v1260 = false;
          var vLN126 = 1;
          if (!this.zIndex && !this.lockMove && this.y >= p1975.mapScale / 2 - p1975.riverWidth / 2 && this.y <= p1975.mapScale / 2 + p1975.riverWidth / 2) {
            vLN126 = 0.33;
            this.xVel += p1975.waterCurrent * p1983;
          }
          if (this.lockMove) {
            this.xVel = 0;
            this.yVel = 0;
          } else if (this.waitCount > 0) {
            this.waitCount -= p1983;
            if (this.waitCount <= 0) {
              if (this.chargePlayer) {
                var v1261;
                var v1262;
                var v1263;
                for (var vLN0228 = 0; vLN0228 < p1972.length; ++vLN0228) {
                  if (p1972[vLN0228].alive && (!p1972[vLN0228].skin || !p1972[vLN0228].skin.bullRepel)) {
                    v1263 = p1974.getDistance(this.x, this.y, p1972[vLN0228].x, p1972[vLN0228].y);
                    if (v1263 <= this.viewRange && (!v1261 || v1263 < v1262)) {
                      v1262 = v1263;
                      v1261 = p1972[vLN0228];
                    }
                  }
                }
                if (v1261) {
                  this.chargeTarget = v1261;
                  this.moveCount = p1974.randInt(8000, 12000);
                } else {
                  this.moveCount = p1974.randInt(1000, 2000);
                  this.targetDir = p1974.randFloat(-Math.PI, Math.PI);
                }
              } else {
                this.moveCount = p1974.randInt(4000, 10000);
                this.targetDir = p1974.randFloat(-Math.PI, Math.PI);
              }
            }
          } else if (this.moveCount > 0) {
            var v1264 = this.speed * vLN126;
            if (this.runFrom && this.runFrom.active && (!this.runFrom.isPlayer || !!this.runFrom.alive)) {
              this.targetDir = p1974.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y);
              v1264 *= 1.42;
            } else if (this.chargeTarget && this.chargeTarget.alive) {
              this.targetDir = p1974.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y);
              v1264 *= 1.75;
              v1260 = true;
            }
            if (this.hitWait) {
              v1264 *= 0.3;
            }
            if (this.dir != this.targetDir) {
              this.dir %= v1259;
              var v1265 = (this.dir - this.targetDir + v1259) % v1259;
              var v1266 = Math.min(Math.abs(v1265 - v1259), v1265, this.turnSpeed * p1983);
              var v1267 = v1265 - Math.PI >= 0 ? 1 : -1;
              this.dir += v1267 * v1266 + v1259;
            }
            this.dir %= v1259;
            this.xVel += v1264 * p1983 * Math.cos(this.dir);
            this.yVel += v1264 * p1983 * Math.sin(this.dir);
            this.moveCount -= p1983;
            if (this.moveCount <= 0) {
              this.runFrom = null;
              this.chargeTarget = null;
              this.waitCount = this.hostile ? 1500 : p1974.randInt(1500, 6000);
            }
          }
          // OBJECT COLL:
          this.zIndex = 0;
          this.lockMove = false;
          var v1273;
          var v1269 = p1974.getDistance(0, 0, this.xVel * p1983, this.yVel * p1983);
          var v1270 = Math.min(4, Math.max(1, Math.round(v1269 / 40)));
          var v1271 = 1 / v1270;
          for (var vLN0228 = 0; vLN0228 < v1270; ++vLN0228) {
            if (this.xVel) {
              this.x += this.xVel * p1983 * v1271;
            }
            if (this.yVel) {
              this.y += this.yVel * p1983 * v1271;
            }
            v1273 = p1971.getGridArrays(this.x, this.y, this.scale);
            for (var vLN0227 = 0; vLN0227 < v1273.length; ++vLN0227) {
              for (var vLN0224 = 0; vLN0224 < v1273[vLN0227].length; ++vLN0224) {
                if (v1273[vLN0227][vLN0224].active) {
                  p1971.checkCollision(this, v1273[vLN0227][vLN0224], v1271);
                }
              }
            }
          }
          // HITTING:
          var v1272 = false;
          if (this.hitWait > 0) {
            this.hitWait -= p1983;
            if (this.hitWait <= 0) {
              v1272 = true;
              this.hitWait = 0;
              if (this.leapForce && !p1974.randInt(0, 2)) {
                this.xVel += this.leapForce * Math.cos(this.dir);
                this.yVel += this.leapForce * Math.sin(this.dir);
              }
              var v1273 = p1971.getGridArrays(this.x, this.y, this.hitRange);
              var v1276;
              var v1277;
              for (var vLN0225 = 0; vLN0225 < v1273.length; ++vLN0225) {
                for (var vLN0227 = 0; vLN0227 < v1273[vLN0225].length; ++vLN0227) {
                  v1276 = v1273[vLN0225][vLN0227];
                  if (v1276.health) {
                    v1277 = p1974.getDistance(this.x, this.y, v1276.x, v1276.y);
                    if (v1277 < v1276.scale + this.hitRange) {
                      if (v1276.changeHealth(-this.dmg * 5)) {
                        p1971.disableObj(v1276);
                      }
                      p1971.hitObj(v1276, p1974.getDirection(this.x, this.y, v1276.x, v1276.y));
                    }
                  }
                }
              }
              for (var vLN0227 = 0; vLN0227 < p1972.length; ++vLN0227) {
                if (p1972[vLN0227].canSee(this)) {
                  p1977.send(p1972[vLN0227].id, "aa", this.sid);
                }
              }
            }
          }
          // PLAYER COLLISIONS:
          if (v1260 || v1272) {
            var v1276;
            var v1277;
            var v1278;
            for (var vLN0228 = 0; vLN0228 < p1972.length; ++vLN0228) {
              v1276 = p1972[vLN0228];
              if (v1276 && v1276.alive) {
                v1277 = p1974.getDistance(this.x, this.y, v1276.x, v1276.y);
                if (this.hitRange) {
                  if (!this.hitWait && v1277 <= this.hitRange + v1276.scale) {
                    if (v1272) {
                      v1278 = p1974.getDirection(v1276.x, v1276.y, this.x, this.y);
                      v1276.changeHealth(-this.dmg);
                      v1276.xVel += Math.cos(v1278) * 0.6;
                      v1276.yVel += Math.sin(v1278) * 0.6;
                      this.runFrom = null;
                      this.chargeTarget = null;
                      this.waitCount = 3000;
                      this.hitWait = !p1974.randInt(0, 2) ? 600 : 0;
                    } else {
                      this.hitWait = this.hitDelay;
                    }
                  }
                } else if (v1277 <= this.scale + v1276.scale) {
                  v1278 = p1974.getDirection(v1276.x, v1276.y, this.x, this.y);
                  v1276.changeHealth(-this.dmg);
                  v1276.xVel += Math.cos(v1278) * 0.55;
                  v1276.yVel += Math.sin(v1278) * 0.55;
                }
              }
            }
          }
          // DECEL:
          if (this.xVel) {
            this.xVel *= Math.pow(p1975.playerDecel, p1983);
          }
          if (this.yVel) {
            this.yVel *= Math.pow(p1975.playerDecel, p1983);
          }
          // MAP BOUNDARIES:
          var v1279 = this.scale;
          if (this.x - v1279 < 0) {
            this.x = v1279;
            this.xVel = 0;
          } else if (this.x + v1279 > p1975.mapScale) {
            this.x = p1975.mapScale - v1279;
            this.xVel = 0;
          }
          if (this.y - v1279 < 0) {
            this.y = v1279;
            this.yVel = 0;
          } else if (this.y + v1279 > p1975.mapScale) {
            this.y = p1975.mapScale - v1279;
            this.yVel = 0;
          }
        }
      };
      // CAN SEE:
      this.canSee = function (p1984) {
        if (!p1984) {
          return false;
        }
        if (p1984.skin && p1984.skin.invisTimer && p1984.noMovTimer >= p1984.skin.invisTimer) {
          return false;
        }
        var v1280 = Math.abs(p1984.x - this.x) - p1984.scale;
        var v1281 = Math.abs(p1984.y - this.y) - p1984.scale;
        return v1280 <= p1975.maxScreenWidth / 2 * 1.3 && v1281 <= p1975.maxScreenHeight / 2 * 1.3;
      };
      var vLN0229 = 0;
      var vLN0230 = 0;
      this.animate = function (p1985) {
        if (this.animTime > 0) {
          this.animTime -= p1985;
          if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            vLN0229 = 0;
            vLN0230 = 0;
          } else if (vLN0230 == 0) {
            vLN0229 += p1985 / (this.animSpeed * p1975.hitReturnRatio);
            this.dirPlus = p1974.lerp(0, this.targetAngle, Math.min(1, vLN0229));
            if (vLN0229 >= 1) {
              vLN0229 = 1;
              vLN0230 = 1;
            }
          } else {
            vLN0229 -= p1985 / (this.animSpeed * (1 - p1975.hitReturnRatio));
            this.dirPlus = p1974.lerp(0, this.targetAngle, Math.max(0, vLN0229));
          }
        }
      };
      // ANIMATION:
      this.startAnim = function () {
        this.animTime = this.animSpeed = 600;
        this.targetAngle = Math.PI * 0.8;
        vLN0229 = 0;
        vLN0230 = 0;
      };
      // CHANGE HEALTH:
      this.changeHealth = function (p1986, p1987, p1988) {
        if (this.active) {
          this.health += p1986;
          if (p1988) {
            if (this.hitScare && !p1974.randInt(0, this.hitScare)) {
              this.runFrom = p1988;
              this.waitCount = 0;
              this.moveCount = 2000;
            } else if (this.hostile && this.chargePlayer && p1988.isPlayer) {
              this.chargeTarget = p1988;
              this.waitCount = 0;
              this.moveCount = 8000;
            } else if (!this.dontRun) {
              this.runFrom = p1988;
              this.waitCount = 0;
              this.moveCount = 2000;
            }
          }
          if (p1986 < 0 && this.hitRange && p1974.randInt(0, 1)) {
            this.hitWait = 500;
          }
          if (p1987 && p1987.canSee(this) && p1986 < 0) {
            p1977.send(p1987.id, "t", Math.round(this.x), Math.round(this.y), Math.round(-p1986), 1);
          }
          if (this.health <= 0) {
            if (this.spawnDelay) {
              this.spawnCounter = this.spawnDelay;
              this.x = -1000000;
              this.y = -1000000;
            } else {
              this.x = this.startX || p1974.randInt(0, p1975.mapScale);
              this.y = this.startY || p1974.randInt(0, p1975.mapScale);
            }
            this.health = this.maxHealth;
            this.runFrom = null;
            if (p1987) {
              p1976(p1987, this.killScore);
              if (this.drop) {
                for (var vLN0231 = 0; vLN0231 < this.drop.length;) {
                  p1987.addResource(p1975.resourceTypes.indexOf(this.drop[vLN0231]), this.drop[vLN0231 + 1]);
                  vLN0231 += 2;
                }
              }
            }
          }
        }
      };
    };
    /***/
  },
  /***/
  "./src/js/data/aiManager.js":
  /*!**********************************!*\
  !*** ./src/js/data/aiManager.js ***!
  \**********************************/
  /*! no static exports found */
  /***/
  function (p1989, p1990) {
    // AI MANAGER:
    p1989.exports = function (p1991, p1992, p1993, p1994, p1995, p1996, p1997, p1998, p1999) {
      // AI TYPES:
      this.aiTypes = [{
        id: 0,
        src: "cow_1",
        killScore: 150,
        health: 500,
        weightM: 0.8,
        speed: 0.00095,
        turnSpeed: 0.001,
        scale: 72,
        drop: ["food", 50]
      }, {
        id: 1,
        src: "pig_1",
        killScore: 200,
        health: 800,
        weightM: 0.6,
        speed: 0.00085,
        turnSpeed: 0.001,
        scale: 72,
        drop: ["food", 80]
      }, {
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
        drop: ["food", 100]
      }, {
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
        drop: ["food", 400]
      }, {
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
        drop: ["food", 200]
      }, {
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
        drop: ["food", 100]
      }, {
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
        drop: ["food", 100]
      }, {
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
        speed: 0,
        turnSpeed: 0,
        scale: 70,
        spriteMlt: 1
      }, {
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
        drop: ["food", 1000]
      }];
      // SPAWN AI:
      this.spawn = function (p2000, p2001, p2002, p2003) {
        var v1282;
        for (var vLN0232 = 0; vLN0232 < p1991.length; ++vLN0232) {
          if (!p1991[vLN0232].active) {
            v1282 = p1991[vLN0232];
            break;
          }
        }
        if (!v1282) {
          v1282 = new p1992(p1991.length, p1995, p1993, p1994, p1997, p1996, p1998, p1999);
          p1991.push(v1282);
        }
        v1282.init(p2000, p2001, p2002, p2003, this.aiTypes[p2003]);
        return v1282;
      };
    };
    /***/
  },
  /***/
  "./src/js/data/gameObject.js":
  /*!***********************************!*\
  !*** ./src/js/data/gameObject.js ***!
  \***********************************/
  /*! no static exports found */
  /***/
  function (p2004, p2005) {
    p2004.exports = function (p2006) {
      this.sid = p2006;
      // INIT:
      this.init = function (p2007, p2008, p2009, p2010, p2011, p2012, p2013) {
        p2012 = p2012 || {};
        this.sentTo = {};
        this.gridLocations = [];
        this.active = true;
        this.doUpdate = p2012.doUpdate;
        this.shootReload = 2200 - 1000 / 9 * 2;
        this.shootted = 0;
        this.x = p2007;
        this.y = p2008;
        this.dir = p2009;
        this.xWiggle = 0;
        this.yWiggle = 0;
        this.scale = p2010;
        this.type = p2011;
        this.id = p2012.id;
        this.owner = p2013;
        this.name = p2012.name;
        this.isItem = this.id != undefined;
        this.group = p2012.group;
        this.health = p2012.health;
        this.buildHealth = p2012.health;
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
        this.colDiv = p2012.colDiv || 1;
        this.blocker = p2012.blocker;
        this.ignoreCollision = p2012.ignoreCollision;
        this.dontGather = p2012.dontGather;
        this.hideFromEnemy = p2012.hideFromEnemy;
        this.friction = p2012.friction;
        this.projDmg = p2012.projDmg;
        this.dmg = p2012.dmg;
        this.pDmg = p2012.pDmg;
        this.pps = p2012.pps;
        this.zIndex = p2012.zIndex || 0;
        this.turnSpeed = p2012.turnSpeed;
        this.req = p2012.req;
        this.trap = p2012.trap;
        this.healCol = p2012.healCol;
        this.teleport = p2012.teleport;
        this.boostSpeed = p2012.boostSpeed;
        this.projectile = p2012.projectile;
        this.shootRange = p2012.shootRange;
        this.shootRate = p2012.shootRate;
        this.shootCount = this.shootRate;
        this.spawnPoint = p2012.spawnPoint;
      };
      // GET HIT:
      this.changeHealth = function (p2014, p2015) {
        this.health += p2014;
        return this.health <= 0;
      };
      // GET SCALE:
      this.getScale = function (p2016, p2017) {
        p2016 = p2016 || 1;
        return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : p2016 * 0.6) * (p2017 ? 1 : this.colDiv);
      };
      // VISIBLE TO PLAYER:
      this.visibleToPlayer = function (p2018) {
        return !this.hideFromEnemy || this.owner && (this.owner == p2018 || this.owner.team && p2018.team == this.owner.team);
      };
      // UPDATE:
      this.update = function (p2019) {
        if (this.active) {
          if (this.xWiggle) {
            this.xWiggle *= Math.pow(0.99, p2019);
          }
          if (this.yWiggle) {
            this.yWiggle *= Math.pow(0.99, p2019);
          }
          if (f241("visual").value != "zyenith" && this.turnSpeed && (f241("visual").value == "0" ? true : !this.pps)) {
            this.dir += this.turnSpeed * p2019;
          }
        }
      };
    };
    /***/
  },
  /***/
  "./src/js/data/items.js":
  /*!******************************!*\
  !*** ./src/js/data/items.js ***!
  \******************************/
  /*! no static exports found */
  /***/
  function (p2020, p2021) {
    // ITEM GROUPS:
    p2020.exports.groups = [{
      id: 0,
      name: "food",
      layer: 0
    }, {
      id: 1,
      name: "walls",
      place: true,
      limit: 30,
      layer: 0
    }, {
      id: 2,
      name: "spikes",
      place: true,
      limit: 15,
      layer: 0
    }, {
      id: 3,
      name: "mill",
      place: true,
      limit: 7,
      layer: 1
    }, {
      id: 4,
      name: "mine",
      place: true,
      limit: 1,
      layer: 0
    }, {
      id: 5,
      name: "trap",
      place: true,
      limit: 6,
      layer: -1
    }, {
      id: 6,
      name: "booster",
      place: true,
      limit: 12,
      layer: -1
    }, {
      id: 7,
      name: "turret",
      place: true,
      limit: 2,
      layer: 1
    }, {
      id: 8,
      name: "watchtower",
      place: true,
      limit: 12,
      layer: 1
    }, {
      id: 9,
      name: "buff",
      place: true,
      limit: 4,
      layer: -1
    }, {
      id: 10,
      name: "spawn",
      place: true,
      limit: 1,
      layer: -1
    }, {
      id: 11,
      name: "sapling",
      place: true,
      limit: 2,
      layer: 0
    }, {
      id: 12,
      name: "blocker",
      place: true,
      limit: 3,
      layer: -1
    }, {
      id: 13,
      name: "teleporter",
      place: true,
      limit: 2,
      layer: -1
    }];
    // PROJECTILES:
    p2021.projectiles = [{
      indx: 0,
      layer: 0,
      src: "arrow_1",
      dmg: 25,
      speed: 1.6,
      scale: 103,
      range: 1000
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
    }];
    // WEAPONS:
    p2021.weapons = [{
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
      dmg2: 25,
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
      dmg2: 30,
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
      dmg2: 35,
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
      dmg2: 35,
      spdMult: 0.85,
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
      dmg2: 40,
      spdMult: 0.8,
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
      dmg2: 45,
      knock: 0.2,
      spdMult: 0.82,
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
      dmg2: 20,
      knock: 0.7,
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
      iPad: 0.8,
      length: 110,
      width: 110,
      xOff: 18,
      yOff: 0,
      dmg: 20,
      dmg2: 20,
      knock: 0.1,
      range: 65,
      gather: 1,
      hitSlow: 0.1,
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
      dmg2: 1,
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
      Pdmg: 25,
      projectile: 0,
      spdMult: 0.75,
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
      Pdmg: 10,
      spdMult: 0.88,
      range: 75,
      sDmg: 7.5,
      gather: 1,
      speed: 400
    }, {
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
      spdMult: 0.7
    }, {
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
      aboveHand: true,
      armS: 0.75,
      length: 120,
      width: 120,
      xOff: -4,
      yOff: 0,
      Pdmg: 30,
      projectile: 3,
      spdMult: 0.7,
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
      Pdmg: 0,
      steal: 250,
      knock: 0.2,
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
      speed: 1500
    }];
    // ITEMS:
    p2020.exports.list = [{
      group: p2020.exports.groups[0],
      name: "apple",
      desc: "restores 20 health when consumed",
      req: ["food", 10],
      consume: function (p2022) {
        return p2022.changeHealth(20, p2022);
      },
      scale: 22,
      holdOffset: 15,
      healing: 20
    }, {
      age: 3,
      group: p2020.exports.groups[0],
      name: "cookie",
      desc: "restores 40 health when consumed",
      req: ["food", 15],
      consume: function (p2023) {
        return p2023.changeHealth(40, p2023);
      },
      scale: 27,
      holdOffset: 15,
      healing: 40
    }, {
      age: 7,
      group: p2020.exports.groups[0],
      name: "cheese",
      desc: "restores 30 health and another 50 over 5 seconds",
      req: ["food", 25],
      consume: function (p2024) {
        if (p2024.changeHealth(30, p2024) || p2024.health < 100) {
          p2024.dmgOverTime.dmg = -10;
          p2024.dmgOverTime.doer = p2024;
          p2024.dmgOverTime.time = 5;
          return true;
        }
        return false;
      },
      scale: 27,
      holdOffset: 15,
      healing: 30
    }, {
      group: p2020.exports.groups[1],
      name: "wood wall",
      desc: "provides protection for your village",
      req: ["wood", 10],
      projDmg: true,
      health: 380,
      scale: 50,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 3,
      group: p2020.exports.groups[1],
      name: "stone wall",
      desc: "provides improved protection for your village",
      req: ["stone", 25],
      health: 900,
      scale: 50,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[1],
      name: "castle wall",
      desc: "provides powerful protection for your village",
      req: ["stone", 35],
      health: 1500,
      scale: 52,
      holdOffset: 20,
      placeOffset: -5
    }, {
      group: p2020.exports.groups[2],
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
      group: p2020.exports.groups[2],
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
      group: p2020.exports.groups[2],
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
      group: p2020.exports.groups[2],
      name: "spinning spikes",
      desc: "damages enemies when they touch them",
      req: ["wood", 30, "stone", 20],
      health: 500,
      dmg: 45,
      turnSpeed: 0.003,
      scale: 52,
      spritePadding: -23,
      holdOffset: 8,
      placeOffset: -5
    }, {
      group: p2020.exports.groups[3],
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
      placeOffset: 5
    }, {
      age: 5,
      group: p2020.exports.groups[3],
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
      placeOffset: 5
    }, {
      age: 8,
      group: p2020.exports.groups[3],
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
      placeOffset: 5
    }, {
      age: 5,
      group: p2020.exports.groups[4],
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
      group: p2020.exports.groups[11],
      type: 0,
      name: "sapling",
      desc: "allows you to farm wood",
      req: ["wood", 150],
      iconLineMult: 12,
      colDiv: 0.5,
      scale: 110,
      holdOffset: 50,
      placeOffset: -15
    }, {
      age: 4,
      group: p2020.exports.groups[5],
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
      placeOffset: -5
    }, {
      age: 4,
      group: p2020.exports.groups[6],
      name: "boost pad",
      desc: "provides boost when stepped on",
      req: ["stone", 20, "wood", 5],
      ignoreCollision: true,
      boostSpeed: 1.5,
      health: 150,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[7],
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
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[8],
      name: "platform",
      desc: "platform to shoot over walls and cross over water",
      req: ["wood", 20],
      ignoreCollision: true,
      zIndex: 1,
      health: 300,
      scale: 43,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[9],
      name: "healing pad",
      desc: "standing on it will slowly heal you",
      req: ["wood", 30, "food", 10],
      ignoreCollision: true,
      healCol: 15,
      health: 400,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 9,
      group: p2020.exports.groups[10],
      name: "spawn pad",
      desc: "you will spawn here when you die but it will dissapear",
      req: ["wood", 100, "stone", 100],
      health: 400,
      ignoreCollision: true,
      spawnPoint: true,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[12],
      name: "blocker",
      desc: "blocks building in radius",
      req: ["wood", 30, "stone", 25],
      ignoreCollision: true,
      blocker: 300,
      health: 400,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5
    }, {
      age: 7,
      group: p2020.exports.groups[13],
      name: "teleporter",
      desc: "teleports you to a random point on the map",
      req: ["wood", 60, "stone", 60],
      ignoreCollision: true,
      teleport: true,
      health: 200,
      colDiv: 0.7,
      scale: 45,
      holdOffset: 20,
      placeOffset: -5
    }];
    // ASSIGN IDS:
    for (var vLN0233 = 0; vLN0233 < p2020.exports.list.length; ++vLN0233) {
      p2020.exports.list[vLN0233].id = vLN0233;
      if (p2020.exports.list[vLN0233].pre) {
        p2020.exports.list[vLN0233].pre = vLN0233 - p2020.exports.list[vLN0233].pre;
      }
    }
    // TROLOLOLOL:
    if (typeof window !== "undefined") {
      function f768(p2025) {
        for (let v1283 = p2025.length - 1; v1283 > 0; v1283--) {
          const v1284 = Math.floor(Math.random() * (v1283 + 1));
          [p2025[v1283], p2025[v1284]] = [p2025[v1284], p2025[v1283]];
        }
        return p2025;
      }
    }
    /***/
  },
  /***/
  "./src/js/data/mapManager.js":
  /*!***********************************!*\
  !*** ./src/js/data/mapManager.js ***!
  \***********************************/
  /*! no static exports found */
  /***/
  function (p2026, p2027) {
    // GLOBAL MAPMANAGER:
    p2026.exports = {};
    /***/
  },
  /***/
  "./src/js/data/objectManager.js":
  /*!**************************************!*\
  !*** ./src/js/data/objectManager.js ***!
  \**************************************/
  /*! no static exports found */
  /***/
  function (p2028, p2029) {
    var v1285 = Math.floor;
    var v1286 = Math.abs;
    var v1287 = Math.cos;
    var v1288 = Math.sin;
    var v1289 = Math.pow;
    var v1290 = Math.sqrt;
    p2028.exports = function (p2030, p2031, p2032, p2033, p2034, p2035) {
      this.objects = p2031;
      this.grids = {};
      this.updateObjects = [];
      // SET OBJECT GRIDS:
      var v1291;
      var v1292;
      var v1293 = p2033.mapScale / p2033.colGrid;
      this.setObjectGrids = function (p2036) {
        var v1294 = Math.min(p2033.mapScale, Math.max(0, p2036.x));
        var v1295 = Math.min(p2033.mapScale, Math.max(0, p2036.y));
        for (var vLN0234 = 0; vLN0234 < p2033.colGrid; ++vLN0234) {
          v1291 = vLN0234 * v1293;
          for (var vLN0235 = 0; vLN0235 < p2033.colGrid; ++vLN0235) {
            v1292 = vLN0235 * v1293;
            if (v1294 + p2036.scale >= v1291 && v1294 - p2036.scale <= v1291 + v1293 && v1295 + p2036.scale >= v1292 && v1295 - p2036.scale <= v1292 + v1293) {
              if (!this.grids[vLN0234 + "_" + vLN0235]) {
                this.grids[vLN0234 + "_" + vLN0235] = [];
              }
              this.grids[vLN0234 + "_" + vLN0235].push(p2036);
              p2036.gridLocations.push(vLN0234 + "_" + vLN0235);
            }
          }
        }
      };
      // REMOVE OBJECT FROM GRID:
      this.removeObjGrid = function (p2037) {
        var v1296;
        for (var vLN0236 = 0; vLN0236 < p2037.gridLocations.length; ++vLN0236) {
          v1296 = this.grids[p2037.gridLocations[vLN0236]].indexOf(p2037);
          if (v1296 >= 0) {
            this.grids[p2037.gridLocations[vLN0236]].splice(v1296, 1);
          }
        }
      };
      // DISABLE OBJ:
      this.disableObj = function (p2038) {
        p2038.active = false;
        if (p2035) {
          if (p2038.owner && p2038.pps) {
            p2038.owner.pps -= p2038.pps;
          }
          this.removeObjGrid(p2038);
          var v1297 = this.updateObjects.indexOf(p2038);
          if (v1297 >= 0) {
            this.updateObjects.splice(v1297, 1);
          }
        }
      };
      // HIT OBJECT:
      this.hitObj = function (p2039, p2040) {
        for (var vLN0237 = 0; vLN0237 < p2034.length; ++vLN0237) {
          if (p2034[vLN0237].active) {
            if (p2039.sentTo[p2034[vLN0237].id]) {
              if (!p2039.active) {
                p2035.send(p2034[vLN0237].id, "12", p2039.sid);
              } else if (p2034[vLN0237].canSee(p2039)) {
                p2035.send(p2034[vLN0237].id, "8", p2032.fixTo(p2040, 1), p2039.sid);
              }
            }
            if (!p2039.active && p2039.owner == p2034[vLN0237]) {
              p2034[vLN0237].changeItemCount(p2039.group.id, -1);
            }
          }
        }
      };
      // GET GRID ARRAY:
      var vA99 = [];
      var v1298;
      this.getGridArrays = function (p2041, p2042, p2043) {
        v1291 = v1285(p2041 / v1293);
        v1292 = v1285(p2042 / v1293);
        vA99.length = 0;
        try {
          if (this.grids[v1291 + "_" + v1292]) {
            vA99.push(this.grids[v1291 + "_" + v1292]);
          }
          if (p2041 + p2043 >= (v1291 + 1) * v1293) {
            // RIGHT
            v1298 = this.grids[v1291 + 1 + "_" + v1292];
            if (v1298) {
              vA99.push(v1298);
            }
            if (v1292 && p2042 - p2043 <= v1292 * v1293) {
              // TOP RIGHT
              v1298 = this.grids[v1291 + 1 + "_" + (v1292 - 1)];
              if (v1298) {
                vA99.push(v1298);
              }
            } else if (p2042 + p2043 >= (v1292 + 1) * v1293) {
              // BOTTOM RIGHT
              v1298 = this.grids[v1291 + 1 + "_" + (v1292 + 1)];
              if (v1298) {
                vA99.push(v1298);
              }
            }
          }
          if (v1291 && p2041 - p2043 <= v1291 * v1293) {
            // LEFT
            v1298 = this.grids[v1291 - 1 + "_" + v1292];
            if (v1298) {
              vA99.push(v1298);
            }
            if (v1292 && p2042 - p2043 <= v1292 * v1293) {
              // TOP LEFT
              v1298 = this.grids[v1291 - 1 + "_" + (v1292 - 1)];
              if (v1298) {
                vA99.push(v1298);
              }
            } else if (p2042 + p2043 >= (v1292 + 1) * v1293) {
              // BOTTOM LEFT
              v1298 = this.grids[v1291 - 1 + "_" + (v1292 + 1)];
              if (v1298) {
                vA99.push(v1298);
              }
            }
          }
          if (p2042 + p2043 >= (v1292 + 1) * v1293) {
            // BOTTOM
            v1298 = this.grids[v1291 + "_" + (v1292 + 1)];
            if (v1298) {
              vA99.push(v1298);
            }
          }
          if (v1292 && p2042 - p2043 <= v1292 * v1293) {
            // TOP
            v1298 = this.grids[v1291 + "_" + (v1292 - 1)];
            if (v1298) {
              vA99.push(v1298);
            }
          }
        } catch (e22) {}
        return vA99;
      };
      // ADD NEW:
      var v1299;
      this.add = function (p2044, p2045, p2046, p2047, p2048, p2049, p2050, p2051, p2052) {
        v1299 = p2031.find(p2053 => p2053.sid == p2044);
        if (!v1299) {
          v1299 = p2031.find(p2054 => !p2054.active);
          if (!v1299) {
            v1299 = new p2030(p2044);
            p2031.push(v1299);
          }
        }
        if (p2051) {
          v1299.sid = p2044;
        }
        v1299.init(p2045, p2046, p2047, p2048, p2049, p2050, p2052);
        if (p2035) {
          this.setObjectGrids(v1299);
          if (v1299.doUpdate) {
            this.updateObjects.push(v1299);
          }
        }
      };
      // DISABLE BY SID:
      this.disableBySid = function (p2055) {
        let v1300 = p2031.find(p2056 => p2056.sid == p2055);
        if (v1300) {
          this.disableObj(v1300);
        }
      };
      // REMOVE ALL FROM PLAYER:
      this.removeAllItems = function (p2057, p2058) {
        p2031.filter(p2059 => p2059.active && p2059.owner && p2059.owner.sid == p2057).forEach(p2060 => this.disableObj(p2060));
        if (p2058) {
          p2058.broadcast("13", p2057);
        }
      };
      // FETCH SPAWN OBJECT:
      this.fetchSpawnObj = function (p2061) {
        var v1301 = null;
        for (var vLN0238 = 0; vLN0238 < p2031.length; ++vLN0238) {
          v1299 = p2031[vLN0238];
          if (v1299.active && v1299.owner && v1299.owner.sid == p2061 && v1299.spawnPoint) {
            v1301 = [v1299.x, v1299.y];
            this.disableObj(v1299);
            p2035.broadcast("12", v1299.sid);
            if (v1299.owner) {
              v1299.owner.changeItemCount(v1299.group.id, -1);
            }
            break;
          }
        }
        return v1301;
      };
      // CHECK IF PLACABLE:
      this.checkItemLocation = function (p2062, p2063, p2064, p2065, p2066, p2067, p2068) {
        let v1302 = p2031.find(p2069 => p2069.active && p2032.getDistance(p2062, p2063, p2069.x, p2069.y) < p2064 + (p2069.blocker ? p2069.blocker : p2069.getScale(p2065, p2069.isItem)));
        if (v1302) {
          return false;
        }
        if (!p2067 && p2066 != 18 && p2063 >= p2033.mapScale / 2 - p2033.riverWidth / 2 && p2063 <= p2033.mapScale / 2 + p2033.riverWidth / 2) {
          return false;
        }
        return true;
      };
      // ADD PROJECTILE:
      this.addProjectile = function (p2070, p2071, p2072, p2073, p2074) {
        var v1303 = items.projectiles[p2074];
        var v1304 = projectiles.find(p2075 => !p2075.active);
        if (!v1304) {
          v1304 = new Projectile(p2034, p2032);
          projectiles.push(v1304);
        }
        v1304.init(p2074, p2070, p2071, p2072, v1303.speed, p2073, v1303.scale);
      };
      // CHECK PLAYER COLLISION:
      this.checkCollision = function (p2076, p2077, p2078) {
        p2078 = p2078 || 1;
        var v1305 = p2076.x - p2077.x;
        var v1306 = p2076.y - p2077.y;
        var v1307 = p2076.scale + p2077.scale;
        if (v1286(v1305) <= v1307 || v1286(v1306) <= v1307) {
          v1307 = p2076.scale + (p2077.getScale ? p2077.getScale() : p2077.scale);
          var v1308 = v1290(v1305 * v1305 + v1306 * v1306) - v1307;
          if (v1308 <= 0) {
            if (!p2077.ignoreCollision) {
              var v1309 = p2032.getDirection(p2076.x, p2076.y, p2077.x, p2077.y);
              var v1310 = p2032.getDistance(p2076.x, p2076.y, p2077.x, p2077.y);
              if (p2077.isPlayer) {
                v1308 = v1308 * -1 / 2;
                p2076.x += v1308 * v1287(v1309);
                p2076.y += v1308 * v1288(v1309);
                p2077.x -= v1308 * v1287(v1309);
                p2077.y -= v1308 * v1288(v1309);
              } else {
                p2076.x = p2077.x + v1307 * v1287(v1309);
                p2076.y = p2077.y + v1307 * v1288(v1309);
                p2076.xVel *= 0.75;
                p2076.yVel *= 0.75;
              }
              if (p2077.dmg && p2077.owner != p2076 && (!p2077.owner || !p2077.owner.team || p2077.owner.team != p2076.team)) {
                p2076.changeHealth(-p2077.dmg, p2077.owner, p2077);
                var v1311 = (p2077.weightM || 1) * 1.5;
                p2076.xVel += v1311 * v1287(v1309);
                p2076.yVel += v1311 * v1288(v1309);
                if (p2077.pDmg && (!p2076.skin || !p2076.skin.poisonRes)) {
                  p2076.dmgOverTime.dmg = p2077.pDmg;
                  p2076.dmgOverTime.time = 5;
                  p2076.dmgOverTime.doer = p2077.owner;
                }
                if (p2076.colDmg && p2077.health) {
                  if (p2077.changeHealth(-p2076.colDmg)) {
                    this.disableObj(p2077);
                  }
                  this.hitObj(p2077, p2032.getDirection(p2076.x, p2076.y, p2077.x, p2077.y));
                }
              }
            } else if (p2077.trap && !p2076.noTrap && p2077.owner != p2076 && (!p2077.owner || !p2077.owner.team || p2077.owner.team != p2076.team)) {
              p2076.lockMove = true;
              p2077.hideFromEnemy = false;
            } else if (p2077.boostSpeed) {
              p2076.xVel += p2078 * p2077.boostSpeed * (p2077.weightM || 1) * v1287(p2077.dir);
              p2076.yVel += p2078 * p2077.boostSpeed * (p2077.weightM || 1) * v1288(p2077.dir);
            } else if (p2077.healCol) {
              p2076.healCol = p2077.healCol;
            } else if (p2077.teleport) {
              p2076.x = p2032.randInt(0, p2033.mapScale);
              p2076.y = p2032.randInt(0, p2033.mapScale);
            }
            if (p2077.zIndex > p2076.zIndex) {
              p2076.zIndex = p2077.zIndex;
            }
            return true;
          }
        }
        return false;
      };
    };
    /***/
  },
  /***/
  "./src/js/data/player.js":
  /*!*******************************!*\
  !*** ./src/js/data/player.js ***!
  \*******************************/
  /*! no static exports found */
  /***/
  function (p2079, p2080, p2081) {
    var vP2081 = p2081(/*! bad-words */
    "./node_modules/bad-words/lib/badwords.js");
    var v1312 = new vP2081();
    var vA100 = ["jew", "black", "baby", "child", "white", "porn", "pedo", "trump", "clinton", "hitler", "nazi", "gay", "pride", "sex", "pleasure", "touch", "poo", "kids", "rape", "white power", "nigga", "nig nog", "doggy", "rapist", "boner", "nigger", "nigg", "finger", "nogger", "nagger", "nig", "fag", "gai", "pole", "stripper", "penis", "vagina", "pussy", "nazi", "hitler", "stalin", "burn", "chamber", "cock", "peen", "dick", "spick", "nieger", "die", "satan", "n|ig", "nlg", "cunt", "c0ck", "fag", "lick", "condom", "anal", "shit", "phile", "little", "kids", "free KR", "tiny", "sidney", "ass", "kill", ".io", "(dot)", "[dot]", "mini", "whiore", "whore", "faggot", "github", "1337", "666", "satan", "senpa", "discord", "d1scord", "mistik", ".io", "senpa.io", "sidney", "sid", "senpaio", "vries", "asa"];
    v1312.addWords(...vA100);
    var v1313 = Math.abs;
    var v1314 = Math.cos;
    var v1315 = Math.sin;
    var v1316 = Math.pow;
    var v1317 = Math.sqrt;
    p2079.exports = function (p2082, p2083, p2084, p2085, p2086, p2087, p2088, p2089, p2090, p2091, p2092, p2093, p2094, p2095) {
      this.id = p2082;
      this.sid = p2083;
      this.tmpScore = 0;
      this.team = null;
      this.skinIndex = 0;
      this.tailIndex = 0;
      this.hitTime = 0;
      this.tails = {};
      for (var vLN0240 = 0; vLN0240 < p2092.length; ++vLN0240) {
        if (p2092[vLN0240].price <= 0) {
          this.tails[p2092[vLN0240].id] = 1;
        }
      }
      this.skins = {};
      for (var vLN0240 = 0; vLN0240 < p2091.length; ++vLN0240) {
        if (p2091[vLN0240].price <= 0) {
          this.skins[p2091[vLN0240].id] = 1;
        }
      }
      this.points = 0;
      this.dt = 0;
      this.rt = 0;
      this.hidden = false;
      this.itemCounts = {};
      this.isPlayer = true;
      this.pps = 0;
      this.moveDir = undefined;
      this.skinRot = 0;
      this.lastPing = 0;
      this.iconIndex = 0;
      this.skinColor = 0;
      this.dangerShame = 5;
      this.projDist = 0;
      // SPAWN:
      this.spawn = function (p2096) {
        // ADDED MODULES:
        this.finded = 0;
        this.syncThreats = 0;
        this.primaryIndex = undefined;
        this.secondaryIndex = undefined;
        this.primaryVariant = undefined;
        this.secondaryVariant = undefined;
        this.gatherIndex = undefined;
        this.shootIndex = undefined;
        this.bowThreat = {
          9: 0,
          12: 0,
          13: 0,
          15: 0
        };
        this.aim2 = 0;
        this.dist2 = 0;
        this.aim3 = 0;
        this.dist3 = 0;
        this.notHere = false;
        this.bTick = 0;
        this.pCount = 0;
        this.hitted = false;
        this.anti = false;
        this.healSid = -1;
        this.damaged = false;
        this.active = true;
        this.alive = true;
        this.lockMove = false;
        this.lockDir = false;
        this.minimapCounter = 0;
        this.chatCountdown = 0;
        this.shameCount = 0;
        this.shameTimer = 0;
        this.antiClown = 4;
        this.maxShame = 7;
        this.sentTo = {};
        this.gathering = 0;
        this.shooting = {};
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
        this.dirPlus = 0;
        this.targetDir = 0;
        this.targetAngle = 0;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.scale = p2084.playerScale;
        this.speed = p2084.playerSpeed;
        this.resetMoveDir();
        this.resetResources(p2096);
        this.firstItems = [0, 3, 6, 10];
        this.items = [0, 3, 6, 10];
        this.weapons = [0];
        this.shootCount = 0;
        this.weaponXP = [];
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
        };
        this.oldReloads = {
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
        };
        this.turretReloaded = false;
        this.doTickUpdate = false;
        this.instaThreat = 0;
      };
      // RESET MOVE DIR:
      this.resetMoveDir = function () {
        this.moveDir = undefined;
      };
      // RESET RESOURCES:
      this.resetResources = function (p2097) {
        for (var vLN0241 = 0; vLN0241 < p2084.resourceTypes.length; ++vLN0241) {
          this[p2084.resourceTypes[vLN0241]] = p2097 ? 100 : 0;
        }
      };
      // ADD ITEM:
      this.addItem = function (p2098) {
        var v1318 = p2090.list[p2098];
        if (v1318) {
          for (var vLN0242 = 0; vLN0242 < this.items.length; ++vLN0242) {
            if (p2090.list[this.items[vLN0242]].group == v1318.group) {
              if (this.buildIndex == this.items[vLN0242]) {
                this.buildIndex = p2098;
              }
              this.items[vLN0242] = p2098;
              return true;
            }
          }
          this.items.push(p2098);
          return true;
        }
        return false;
      };
      // SET USER DATA:
      this.setUserData = function (p2099) {
        if (p2099) {
          // SET INITIAL NAME:
          this.name = "unknown";
          // VALIDATE NAME:
          var v1319 = p2099.name + "";
          v1319 = v1319.slice(0, p2084.maxNameLength);
          v1319 = v1319.replace(/[^\w:\(\)\/? -]+/gim, " ");
          // USE SPACE SO WE CAN CHECK PROFANITY
          v1319 = v1319.replace(/[^\x00-\x7F]/g, " ");
          v1319 = v1319.trim();
          // CHECK IF IS PROFANE:
          var v1320 = false;
          var v1321 = v1319.toLowerCase().replace(/\s/g, "").replace(/1/g, "i").replace(/0/g, "o").replace(/5/g, "s");
          for (var v1322 of v1312.list) {
            if (v1321.indexOf(v1322) != -1) {
              v1320 = true;
              break;
            }
          }
          if (v1319.length > 0 && !v1320) {
            this.name = v1319;
          }
          // SKIN:
          this.skinColor = 0;
          if (p2084.skinColors[p2099.skin]) {
            this.skinColor = p2099.skin;
          }
        }
      };
      // GET DATA TO SEND:
      this.getData = function () {
        return [this.id, this.sid, this.name, p2085.fixTo(this.x, 2), p2085.fixTo(this.y, 2), p2085.fixTo(this.dir, 3), this.health, this.maxHealth, this.scale, this.skinColor];
      };
      // SET DATA:
      this.setData = function (p2100) {
        this.id = p2100[0];
        this.sid = p2100[1];
        this.name = p2100[2];
        this.x = p2100[3];
        this.y = p2100[4];
        this.dir = p2100[5];
        this.health = p2100[6];
        this.maxHealth = p2100[7];
        this.scale = p2100[8];
        this.skinColor = p2100[9];
      };
      // UPDATE:
      var vLN0243 = 0;
      this.update = function (p2101) {
        if (!this.alive) {
          return;
        }
        // SHAME SHAME SHAME:
        if (this.shameTimer > 0) {
          this.shameTimer -= p2101;
          if (this.shameTimer <= 0) {
            this.shameTimer = 0;
            this.shameCount = 0;
          }
        }
        // REGENS AND AUTO:
        vLN0243 -= p2101;
        if (vLN0243 <= 0) {
          var v1323 = (this.skin && this.skin.healthRegen ? this.skin.healthRegen : 0) + (this.tail && this.tail.healthRegen ? this.tail.healthRegen : 0);
          if (v1323) {
            this.changeHealth(v1323, this);
          }
          if (this.dmgOverTime.dmg) {
            this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
            this.dmgOverTime.time -= 1;
            if (this.dmgOverTime.time <= 0) {
              this.dmgOverTime.dmg = 0;
            }
          }
          if (this.healCol) {
            this.changeHealth(this.healCol, this);
          }
          vLN0243 = 1000;
        }
        // CHECK KILL:
        if (!this.alive) {
          return;
        }
        // SLOWER:
        if (this.slowMult < 1) {
          this.slowMult += p2101 * 0.0008;
          if (this.slowMult > 1) {
            this.slowMult = 1;
          }
        }
        // MOVE:
        this.noMovTimer += p2101;
        if (this.xVel || this.yVel) {
          this.noMovTimer = 0;
        }
        if (this.lockMove) {
          this.xVel = 0;
          this.yVel = 0;
        } else {
          var v1324 = (this.buildIndex >= 0 ? 0.5 : 1) * (p2090.weapons[this.weaponIndex].spdMult || 1) * (this.skin ? this.skin.spdMult || 1 : 1) * (this.tail ? this.tail.spdMult || 1 : 1) * (this.y <= p2084.snowBiomeTop ? this.skin && this.skin.coldM ? 1 : p2084.snowSpeed : 1) * this.slowMult;
          if (!this.zIndex && this.y >= p2084.mapScale / 2 - p2084.riverWidth / 2 && this.y <= p2084.mapScale / 2 + p2084.riverWidth / 2) {
            if (this.skin && this.skin.watrImm) {
              v1324 *= 0.75;
              this.xVel += p2084.waterCurrent * 0.4 * p2101;
            } else {
              v1324 *= 0.33;
              this.xVel += p2084.waterCurrent * p2101;
            }
          }
          var v1325 = this.moveDir != undefined ? v1314(this.moveDir) : 0;
          var v1326 = this.moveDir != undefined ? v1315(this.moveDir) : 0;
          var vV1317 = v1317(v1325 * v1325 + v1326 * v1326);
          if (vV1317 != 0) {
            v1325 /= vV1317;
            v1326 /= vV1317;
          }
          if (v1325) {
            this.xVel += v1325 * this.speed * v1324 * p2101;
          }
          if (v1326) {
            this.yVel += v1326 * this.speed * v1324 * p2101;
          }
        }
        // OBJECT COLL:
        this.zIndex = 0;
        this.lockMove = false;
        this.healCol = 0;
        var v1327;
        var v1328 = p2085.getDistance(0, 0, this.xVel * p2101, this.yVel * p2101);
        var v1329 = Math.min(4, Math.max(1, Math.round(v1328 / 40)));
        var v1330 = 1 / v1329;
        for (var v1332 = 0; v1332 < v1329; ++v1332) {
          if (this.xVel) {
            this.x += this.xVel * p2101 * v1330;
          }
          if (this.yVel) {
            this.y += this.yVel * p2101 * v1330;
          }
          v1327 = p2087.getGridArrays(this.x, this.y, this.scale);
          for (var vLN0245 = 0; vLN0245 < v1327.length; ++vLN0245) {
            for (var vLN0246 = 0; vLN0246 < v1327[vLN0245].length; ++vLN0246) {
              if (v1327[vLN0245][vLN0246].active) {
                p2087.checkCollision(this, v1327[vLN0245][vLN0246], v1330);
              }
            }
          }
        }
        // PLAYER COLLISIONS:
        var v1334 = p2088.indexOf(this);
        for (var v1332 = v1334 + 1; v1332 < p2088.length; ++v1332) {
          if (p2088[v1332] != this && p2088[v1332].alive) {
            p2087.checkCollision(this, p2088[v1332]);
          }
        }
        // DECEL:
        if (this.xVel) {
          this.xVel *= v1316(p2084.playerDecel, p2101);
          if (this.xVel <= 0.01 && this.xVel >= -0.01) {
            this.xVel = 0;
          }
        }
        if (this.yVel) {
          this.yVel *= v1316(p2084.playerDecel, p2101);
          if (this.yVel <= 0.01 && this.yVel >= -0.01) {
            this.yVel = 0;
          }
        }
        // MAP BOUNDARIES:
        if (this.x - this.scale < 0) {
          this.x = this.scale;
        } else if (this.x + this.scale > p2084.mapScale) {
          this.x = p2084.mapScale - this.scale;
        }
        if (this.y - this.scale < 0) {
          this.y = this.scale;
        } else if (this.y + this.scale > p2084.mapScale) {
          this.y = p2084.mapScale - this.scale;
        }
        // USE WEAPON OR TOOL:
        if (this.buildIndex < 0) {
          if (this.reloads[this.weaponIndex] > 0) {
            this.reloads[this.weaponIndex] -= p2101;
            this.gathering = this.mouseState;
          } else if (this.gathering || this.autoGather) {
            var v1333 = true;
            if (p2090.weapons[this.weaponIndex].gather != undefined) {
              this.gather(p2088);
            } else if (p2090.weapons[this.weaponIndex].projectile != undefined && this.hasRes(p2090.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0)) {
              this.useRes(p2090.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0);
              this.noMovTimer = 0;
              var v1334 = p2090.weapons[this.weaponIndex].projectile;
              var v1335 = this.scale * 2;
              var v1336 = this.skin && this.skin.aMlt ? this.skin.aMlt : 1;
              if (p2090.weapons[this.weaponIndex].rec) {
                this.xVel -= p2090.weapons[this.weaponIndex].rec * v1314(this.dir);
                this.yVel -= p2090.weapons[this.weaponIndex].rec * v1315(this.dir);
              }
              p2086.addProjectile(this.x + v1335 * v1314(this.dir), this.y + v1335 * v1315(this.dir), this.dir, p2090.projectiles[v1334].range * v1336, p2090.projectiles[v1334].speed * v1336, v1334, this, null, this.zIndex);
            } else {
              v1333 = false;
            }
            this.gathering = this.mouseState;
            if (v1333) {
              this.reloads[this.weaponIndex] = p2090.weapons[this.weaponIndex].speed * (this.skin ? this.skin.atkSpd || 1 : 1);
            }
          }
        }
      };
      // ADD WEAPON XP:
      this.addWeaponXP = function (p2102) {
        if (!this.weaponXP[this.weaponIndex]) {
          this.weaponXP[this.weaponIndex] = 0;
        }
        this.weaponXP[this.weaponIndex] += p2102;
        if (this.weaponIndex == this.weapons[0]) {
          f241("priXP").innerHTML = "Primary XP: " + this.weaponXP[this.weapons[0]] + " / " + p2084.weaponXPs[this.weaponVariant].xp;
        } else if (this.weaponIndex == this.weapons[1]) {
          f241("secXP").innerHTML = "Secondary XP: " + this.weaponXP[this.weapons[1]] + " / " + p2084.weaponXPs[this.weaponVariant].xp;
        }
      };
      // EARN XP:
      this.earnXP = function (p2103) {
        if (this.age < p2084.maxAge) {
          this.XP += p2103;
          if (this.XP >= this.maxXP) {
            if (this.age < p2084.maxAge) {
              this.age++;
              this.XP = 0;
              this.maxXP *= 1.2;
            } else {
              this.XP = this.maxXP;
            }
            this.upgradePoints++;
            p2093.send(this.id, "16", this.upgradePoints, this.upgrAge);
            p2093.send(this.id, "15", this.XP, p2085.fixTo(this.maxXP, 1), this.age);
          } else {
            p2093.send(this.id, "15", this.XP);
          }
        }
      };
      // CHANGE HEALTH:
      this.changeHealth = function (p2104, p2105) {
        if (p2104 > 0 && this.health >= this.maxHealth) {
          return false;
        }
        if (p2104 < 0 && this.skin) {
          p2104 *= this.skin.dmgMult || 1;
        }
        if (p2104 < 0 && this.tail) {
          p2104 *= this.tail.dmgMult || 1;
        }
        if (p2104 < 0) {
          this.hitTime = Date.now();
        }
        this.health += p2104;
        if (this.health > this.maxHealth) {
          p2104 -= this.health - this.maxHealth;
          this.health = this.maxHealth;
        }
        if (this.health <= 0) {
          this.kill(p2105);
        }
        for (var vLN0247 = 0; vLN0247 < p2088.length; ++vLN0247) {
          if (this.sentTo[p2088[vLN0247].id]) {
            p2093.send(p2088[vLN0247].id, "h", this.sid, Math.round(this.health));
          }
        }
        if (p2105 && p2105.canSee(this) && (p2105 != this || !(p2104 < 0))) {
          p2093.send(p2105.id, "t", Math.round(this.x), Math.round(this.y), Math.round(-p2104), 1);
        }
        return true;
      };
      // KILL:
      this.kill = function (p2106) {
        if (p2106 && p2106.alive) {
          p2106.kills++;
          if (p2106.skin && p2106.skin.goldSteal) {
            p2094(p2106, Math.round(this.points / 2));
          } else {
            p2094(p2106, Math.round(this.age * 100 * (p2106.skin && p2106.skin.kScrM ? p2106.skin.kScrM : 1)));
          }
          p2093.send(p2106.id, "9", "kills", p2106.kills, 1);
        }
        this.alive = false;
        p2093.send(this.id, "11");
        p2095();
      };
      // ADD RESOURCE:
      this.addResource = function (p2107, p2108, p2109) {
        if (!p2109 && p2108 > 0) {
          this.addWeaponXP(p2108);
        }
        if (p2107 == 3) {
          p2094(this, p2108, true);
        } else {
          this[p2084.resourceTypes[p2107]] += p2108;
          p2093.send(this.id, "9", p2084.resourceTypes[p2107], this[p2084.resourceTypes[p2107]], 1);
        }
      };
      // CHANGE ITEM COUNT:
      this.changeItemCount = function (p2110, p2111) {
        this.itemCounts[p2110] = this.itemCounts[p2110] || 0;
        this.itemCounts[p2110] += p2111;
        p2093.send(this.id, "14", p2110, this.itemCounts[p2110]);
      };
      // BUILD:
      this.buildItem = function (p2112) {
        var v1337 = this.scale + p2112.scale + (p2112.placeOffset || 0);
        var v1338 = this.x + v1337 * v1314(this.dir);
        var v1339 = this.y + v1337 * v1315(this.dir);
        if (this.canBuild(p2112) && (!p2112.consume || !this.skin || !this.skin.noEat) && (p2112.consume || p2087.checkItemLocation(v1338, v1339, p2112.scale, 0.6, p2112.id, false, this))) {
          var v1340 = false;
          if (p2112.consume) {
            if (this.hitTime) {
              var v1341 = Date.now() - this.hitTime;
              this.hitTime = 0;
              if (v1341 <= 120) {
                this.shameCount++;
                if (this.shameCount >= 8) {
                  this.shameTimer = 30000;
                  this.shameCount = 0;
                }
              } else {
                this.shameCount -= 2;
                if (this.shameCount <= 0) {
                  this.shameCount = 0;
                }
              }
            }
            if (this.shameTimer <= 0) {
              v1340 = p2112.consume(this);
            }
          } else {
            v1340 = true;
            if (p2112.group.limit) {
              this.changeItemCount(p2112.group.id, 1);
            }
            if (p2112.pps) {
              this.pps += p2112.pps;
            }
            p2087.add(p2087.objects.length, v1338, v1339, this.dir, p2112.scale, p2112.type, p2112, false, this);
          }
          if (v1340) {
            this.useRes(p2112);
            this.buildIndex = -1;
          }
        }
      };
      // HAS RESOURCES:
      this.hasRes = function (p2113, p2114) {
        for (var vLN0248 = 0; vLN0248 < p2113.req.length;) {
          if (this[p2113.req[vLN0248]] < Math.round(p2113.req[vLN0248 + 1] * (p2114 || 1))) {
            return false;
          }
          vLN0248 += 2;
        }
        return true;
      };
      // USE RESOURCES:
      this.useRes = function (p2115, p2116) {
        if (p2084.inSandbox) {
          return;
        }
        for (var vLN0249 = 0; vLN0249 < p2115.req.length;) {
          this.addResource(p2084.resourceTypes.indexOf(p2115.req[vLN0249]), -Math.round(p2115.req[vLN0249 + 1] * (p2116 || 1)));
          vLN0249 += 2;
        }
      };
      // CAN BUILD:
      this.canBuild = function (p2117) {
        if (p2084.inSandbox) {
          return true;
        }
        if (p2117.group.limit && this.itemCounts[p2117.group.id] >= p2117.group.limit) {
          return false;
        }
        return this.hasRes(p2117);
      };
      // GATHER:
      this.gather = function () {
        // SHOW:
        this.noMovTimer = 0;
        // SLOW MOVEMENT:
        this.slowMult -= p2090.weapons[this.weaponIndex].hitSlow || 0.3;
        if (this.slowMult < 0) {
          this.slowMult = 0;
        }
        // VARIANT DMG:
        var v1342 = p2084.fetchVariant(this);
        var v1343 = v1342.poison;
        var v1344 = v1342.val;
        // CHECK IF HIT GAME OBJECT:
        var vO73 = {};
        var v1345;
        var v1346;
        var v1347;
        var v1348;
        var v1349 = p2087.getGridArrays(this.x, this.y, p2090.weapons[this.weaponIndex].range);
        for (var vLN0250 = 0; vLN0250 < v1349.length; ++vLN0250) {
          for (var vLN0253 = 0; vLN0253 < v1349[vLN0250].length; ++vLN0253) {
            v1347 = v1349[vLN0250][vLN0253];
            if (v1347.active && !v1347.dontGather && !vO73[v1347.sid] && v1347.visibleToPlayer(this)) {
              v1345 = p2085.getDistance(this.x, this.y, v1347.x, v1347.y) - v1347.scale;
              if (v1345 <= p2090.weapons[this.weaponIndex].range) {
                v1346 = p2085.getDirection(v1347.x, v1347.y, this.x, this.y);
                if (p2085.getAngleDist(v1346, this.dir) <= p2084.gatherAngle) {
                  vO73[v1347.sid] = 1;
                  if (v1347.health) {
                    if (v1347.changeHealth(-p2090.weapons[this.weaponIndex].dmg * v1344 * (p2090.weapons[this.weaponIndex].sDmg || 1) * (this.skin && this.skin.bDmg ? this.skin.bDmg : 1), this)) {
                      for (var vLN0252 = 0; vLN0252 < v1347.req.length;) {
                        this.addResource(p2084.resourceTypes.indexOf(v1347.req[vLN0252]), v1347.req[vLN0252 + 1]);
                        vLN0252 += 2;
                      }
                      p2087.disableObj(v1347);
                    }
                  } else {
                    this.earnXP(p2090.weapons[this.weaponIndex].gather * 4);
                    var v1350 = p2090.weapons[this.weaponIndex].gather + (v1347.type == 3 ? 4 : 0);
                    if (this.skin && this.skin.extraGold) {
                      this.addResource(3, 1);
                    }
                    this.addResource(v1347.type, v1350);
                  }
                  v1348 = true;
                  p2087.hitObj(v1347, v1346);
                }
              }
            }
          }
        }
        // CHECK IF HIT PLAYER:
        for (var vLN0253 = 0; vLN0253 < p2088.length + p2089.length; ++vLN0253) {
          v1347 = p2088[vLN0253] || p2089[vLN0253 - p2088.length];
          if (v1347 != this && v1347.alive && (!v1347.team || v1347.team != this.team)) {
            v1345 = p2085.getDistance(this.x, this.y, v1347.x, v1347.y) - v1347.scale * 1.8;
            if (v1345 <= p2090.weapons[this.weaponIndex].range) {
              v1346 = p2085.getDirection(v1347.x, v1347.y, this.x, this.y);
              if (p2085.getAngleDist(v1346, this.dir) <= p2084.gatherAngle) {
                // STEAL RESOURCES:
                var v1351 = p2090.weapons[this.weaponIndex].steal;
                if (v1351 && v1347.addResource) {
                  v1351 = Math.min(v1347.points || 0, v1351);
                  this.addResource(3, v1351);
                  v1347.addResource(3, -v1351);
                }
                // MELEE HIT PLAYER:
                var vV1344 = v1344;
                if (v1347.weaponIndex != undefined && p2090.weapons[v1347.weaponIndex].shield && p2085.getAngleDist(v1346 + Math.PI, v1347.dir) <= p2084.shieldAngle) {
                  vV1344 = p2090.weapons[v1347.weaponIndex].shield;
                }
                var v1352 = p2090.weapons[this.weaponIndex].dmg * (this.skin && this.skin.dmgMultO ? this.skin.dmgMultO : 1) * (this.tail && this.tail.dmgMultO ? this.tail.dmgMultO : 1);
                var v1353 = (v1347.weightM || 1) * 0.3 + (p2090.weapons[this.weaponIndex].knock || 0);
                v1347.xVel += v1353 * v1314(v1346);
                v1347.yVel += v1353 * v1315(v1346);
                if (this.skin && this.skin.healD) {
                  this.changeHealth(v1352 * vV1344 * this.skin.healD, this);
                }
                if (this.tail && this.tail.healD) {
                  this.changeHealth(v1352 * vV1344 * this.tail.healD, this);
                }
                if (v1347.skin && v1347.skin.dmg && vV1344 == 1) {
                  this.changeHealth(-v1352 * v1347.skin.dmg, v1347);
                }
                if (v1347.tail && v1347.tail.dmg && vV1344 == 1) {
                  this.changeHealth(-v1352 * v1347.tail.dmg, v1347);
                }
                if (v1347.dmgOverTime && this.skin && this.skin.poisonDmg && (!v1347.skin || !v1347.skin.poisonRes)) {
                  v1347.dmgOverTime.dmg = this.skin.poisonDmg;
                  v1347.dmgOverTime.time = this.skin.poisonTime || 1;
                  v1347.dmgOverTime.doer = this;
                }
                if (v1347.dmgOverTime && v1343 && (!v1347.skin || !v1347.skin.poisonRes)) {
                  v1347.dmgOverTime.dmg = 5;
                  v1347.dmgOverTime.time = 5;
                  v1347.dmgOverTime.doer = this;
                }
                if (v1347.skin && v1347.skin.dmgK) {
                  this.xVel -= v1347.skin.dmgK * v1314(v1346);
                  this.yVel -= v1347.skin.dmgK * v1315(v1346);
                }
                v1347.changeHealth(-v1352 * vV1344, this, this);
              }
            }
          }
        }
        // SEND FOR ANIMATION:
        this.sendAnimation(v1348 ? 1 : 0);
      };
      // SEND ANIMATION:
      this.sendAnimation = function (p2118) {
        for (var vLN0254 = 0; vLN0254 < p2088.length; ++vLN0254) {
          if (this.sentTo[p2088[vLN0254].id] && this.canSee(p2088[vLN0254])) {
            p2093.send(p2088[vLN0254].id, "7", this.sid, p2118 ? 1 : 0, this.weaponIndex);
          }
        }
      };
      // ANIMATE:
      var vLN0255 = 0;
      var vLN0256 = 0;
      this.animate = function (p2119) {
        if (this.animTime > 0) {
          this.animTime -= p2119;
          if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            vLN0255 = 0;
            vLN0256 = 0;
          } else if (vLN0256 == 0) {
            vLN0255 += p2119 / (this.animSpeed * p2084.hitReturnRatio);
            this.dirPlus = p2085.lerp(0, this.targetAngle, Math.min(1, vLN0255));
            if (vLN0255 >= 1) {
              vLN0255 = 1;
              vLN0256 = 1;
            }
          } else {
            vLN0255 -= p2119 / (this.animSpeed * (1 - p2084.hitReturnRatio));
            this.dirPlus = p2085.lerp(0, this.targetAngle, Math.max(0, vLN0255));
          }
        }
      };
      // GATHER ANIMATION:
      this.startAnim = function (p2120, p2121) {
        this.animTime = this.animSpeed = p2090.weapons[p2121].speed;
        this.targetAngle = p2120 ? -p2084.hitAngle : -Math.PI;
        vLN0255 = 0;
        vLN0256 = 0;
      };
      // CAN SEE:
      this.canSee = function (p2122) {
        if (!p2122) {
          return false;
        }
        if (p2122.skin && p2122.skin.invisTimer && p2122.noMovTimer >= p2122.skin.invisTimer) {
          return false;
        }
        var v1354 = v1313(p2122.x - this.x) - p2122.scale;
        var v1355 = v1313(p2122.y - this.y) - p2122.scale;
        return v1354 <= p2084.maxScreenWidth / 2 * 1.3 && v1355 <= p2084.maxScreenHeight / 2 * 1.3;
      };
    };
    /***/
  },
  /***/
  "./src/js/data/projectile.js":
  /*!***********************************!*\
  !*** ./src/js/data/projectile.js ***!
  \***********************************/
  /*! no static exports found */
  /***/
  function (p2123, p2124) {
    p2123.exports = function (p2125, p2126, p2127, p2128, p2129, p2130, p2131) {
      // INIT:
      this.init = function (p2132, p2133, p2134, p2135, p2136, p2137, p2138, p2139, p2140) {
        this.active = true;
        this.indx = p2132;
        this.x = p2133;
        this.y = p2134;
        this.dir = p2135;
        this.skipMov = true;
        this.speed = p2136;
        this.dmg = p2137;
        this.scale = p2139;
        this.range = p2138;
        this.owner = p2140;
        if (p2131) {
          this.sentTo = {};
        }
      };
      // UPDATE:
      var vA101 = [];
      var v1356;
      this.update = function (p2141) {
        if (this.active) {
          var v1357 = this.speed * p2141;
          var v1358;
          if (!this.skipMov) {
            this.x += v1357 * Math.cos(this.dir);
            this.y += v1357 * Math.sin(this.dir);
            this.range -= v1357;
            if (this.range <= 0) {
              this.x += this.range * Math.cos(this.dir);
              this.y += this.range * Math.sin(this.dir);
              v1357 = 1;
              this.range = 0;
              this.active = false;
            }
          } else {
            this.skipMov = false;
          }
          if (p2131) {
            for (var vLN0263 = 0; vLN0263 < p2125.length; ++vLN0263) {
              if (!this.sentTo[p2125[vLN0263].id] && p2125[vLN0263].canSee(this)) {
                this.sentTo[p2125[vLN0263].id] = 1;
                p2131.send(p2125[vLN0263].id, "18", p2130.fixTo(this.x, 1), p2130.fixTo(this.y, 1), p2130.fixTo(this.dir, 2), p2130.fixTo(this.range, 1), this.speed, this.indx, this.layer, this.sid);
              }
            }
            vA101.length = 0;
            for (var vLN0263 = 0; vLN0263 < p2125.length + p2126.length; ++vLN0263) {
              v1356 = p2125[vLN0263] || p2126[vLN0263 - p2125.length];
              if (v1356.alive && v1356 != this.owner && (!this.owner.team || v1356.team != this.owner.team)) {
                if (p2130.lineInRect(v1356.x - v1356.scale, v1356.y - v1356.scale, v1356.x + v1356.scale, v1356.y + v1356.scale, this.x, this.y, this.x + v1357 * Math.cos(this.dir), this.y + v1357 * Math.sin(this.dir))) {
                  vA101.push(v1356);
                }
              }
            }
            var v1359 = p2127.getGridArrays(this.x, this.y, this.scale);
            for (var vLN0259 = 0; vLN0259 < v1359.length; ++vLN0259) {
              for (var vLN0260 = 0; vLN0260 < v1359[vLN0259].length; ++vLN0260) {
                v1356 = v1359[vLN0259][vLN0260];
                v1358 = v1356.getScale();
                if (v1356.active && this.ignoreObj != v1356.sid && this.layer <= v1356.layer && vA101.indexOf(v1356) < 0 && !v1356.ignoreCollision && p2130.lineInRect(v1356.x - v1358, v1356.y - v1358, v1356.x + v1358, v1356.y + v1358, this.x, this.y, this.x + v1357 * Math.cos(this.dir), this.y + v1357 * Math.sin(this.dir))) {
                  vA101.push(v1356);
                }
              }
            }
            // HIT OBJECTS:
            if (vA101.length > 0) {
              var v1360 = null;
              var v1361 = null;
              var v1362 = null;
              for (var vLN0263 = 0; vLN0263 < vA101.length; ++vLN0263) {
                v1362 = p2130.getDistance(this.x, this.y, vA101[vLN0263].x, vA101[vLN0263].y);
                if (v1361 == null || v1362 < v1361) {
                  v1361 = v1362;
                  v1360 = vA101[vLN0263];
                }
              }
              if (v1360.isPlayer || v1360.isAI) {
                var v1363 = (v1360.weightM || 1) * 0.3;
                v1360.xVel += v1363 * Math.cos(this.dir);
                v1360.yVel += v1363 * Math.sin(this.dir);
                if (v1360.weaponIndex == undefined || !p2128.weapons[v1360.weaponIndex].shield || !(p2130.getAngleDist(this.dir + Math.PI, v1360.dir) <= p2129.shieldAngle)) {
                  v1360.changeHealth(-this.dmg, this.owner, this.owner);
                }
              } else {
                if (v1360.projDmg && v1360.health && v1360.changeHealth(-this.dmg)) {
                  p2127.disableObj(v1360);
                }
                for (var vLN0263 = 0; vLN0263 < p2125.length; ++vLN0263) {
                  if (p2125[vLN0263].active) {
                    if (v1360.sentTo[p2125[vLN0263].id]) {
                      if (v1360.active) {
                        if (p2125[vLN0263].canSee(v1360)) {
                          p2131.send(p2125[vLN0263].id, "8", p2130.fixTo(this.dir, 2), v1360.sid);
                        }
                      } else {
                        p2131.send(p2125[vLN0263].id, "12", v1360.sid);
                      }
                    }
                    if (!v1360.active && v1360.owner == p2125[vLN0263]) {
                      p2125[vLN0263].changeItemCount(v1360.group.id, -1);
                    }
                  }
                }
              }
              this.active = false;
              for (var vLN0263 = 0; vLN0263 < p2125.length; ++vLN0263) {
                if (this.sentTo[p2125[vLN0263].id]) {
                  p2131.send(p2125[vLN0263].id, "19", this.sid, p2130.fixTo(v1361, 1));
                }
              }
            }
          }
        }
      };
    };
    /***/
  },
  /***/
  "./src/js/data/projectileManager.js":
  /*!******************************************!*\
  !*** ./src/js/data/projectileManager.js ***!
  \******************************************/
  /*! no static exports found */
  /***/
  function (p2142, p2143) {
    p2142.exports = function (p2144, p2145, p2146, p2147, p2148, p2149, p2150, p2151, p2152) {
      this.addProjectile = function (p2153, p2154, p2155, p2156, p2157, p2158, p2159, p2160, p2161) {
        var v1364 = p2149.projectiles[p2158];
        var v1365 = p2145.find(p2162 => !p2162.active);
        if (!v1365) {
          v1365 = new p2144(p2146, p2147, p2148, p2149, p2150, p2151, p2152);
          v1365.sid = p2145.length;
          p2145.push(v1365);
        }
        v1365.init(p2158, p2153, p2154, p2155, p2157, v1364.dmg, p2156, v1364.scale, p2159);
        v1365.ignoreObj = p2160;
        v1365.layer = p2161 || v1364.layer;
        v1365.src = v1364.src;
        return v1365;
      };
    };
    /***/
  },
  /***/
  "./src/js/data/store.js":
  /*!******************************!*\
  !*** ./src/js/data/store.js ***!
  \******************************/
  /*! no static exports found */
  /***/
  function (p2163, p2164) {
    // STORE HATS:
    p2163.exports.hats = [{
      id: 45,
      name: "Shame!",
      dontSell: true,
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
      price: 1000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 4,
      name: "Ranger Hat",
      price: 2000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 18,
      name: "Explorer Hat",
      price: 2000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 31,
      name: "Flipper Hat",
      price: 2500,
      scale: 120,
      desc: "have more control while in water",
      watrImm: true
    }, {
      id: 1,
      name: "Marksman Cap",
      price: 3000,
      scale: 120,
      desc: "increases arrow speed and range",
      aMlt: 1.3
    }, {
      id: 10,
      name: "Bush Gear",
      price: 3000,
      scale: 160,
      desc: "allows you to disguise yourself as a bush"
    }, {
      id: 48,
      name: "Halo",
      price: 3000,
      scale: 120,
      desc: "no effect"
    }, {
      id: 6,
      name: "Soldier Helmet",
      price: 4000,
      scale: 120,
      desc: "reduces damage taken but slows movement",
      spdMult: 0.94,
      dmgMult: 0.75
    }, {
      id: 23,
      name: "Anti Venom Gear",
      price: 4000,
      scale: 120,
      desc: "makes you immune to poison",
      poisonRes: 1
    }, {
      id: 13,
      name: "Medic Gear",
      price: 5000,
      scale: 110,
      desc: "slowly regenerates health over time",
      healthRegen: 3
    }, {
      id: 9,
      name: "Miners Helmet",
      price: 5000,
      scale: 120,
      desc: "earn 1 extra gold per resource",
      extraGold: 1
    }, {
      id: 32,
      name: "Musketeer Hat",
      price: 5000,
      scale: 120,
      desc: "reduces cost of projectiles",
      projCost: 0.5
    }, {
      id: 7,
      name: "Bull Helmet",
      price: 6000,
      scale: 120,
      desc: "increases damage done but drains health",
      healthRegen: -5,
      dmgMultO: 1.5,
      spdMult: 0.96
    }, {
      id: 22,
      name: "Emp Helmet",
      price: 6000,
      scale: 120,
      desc: "turrets won't attack but you move slower",
      antiTurret: 1,
      spdMult: 0.7
    }, {
      id: 12,
      name: "Booster Hat",
      price: 6000,
      scale: 120,
      desc: "increases your movement speed",
      spdMult: 1.16
    }, {
      id: 26,
      name: "Barbarian Armor",
      price: 8000,
      scale: 120,
      desc: "knocks back enemies that attack you",
      dmgK: 0.6
    }, {
      id: 21,
      name: "Plague Mask",
      price: 10000,
      scale: 120,
      desc: "melee attacks deal poison damage",
      poisonDmg: 5,
      poisonTime: 6
    }, {
      id: 46,
      name: "Bull Mask",
      price: 10000,
      scale: 120,
      desc: "bulls won't target you unless you attack them",
      bullRepel: 1
    }, {
      id: 14,
      name: "Windmill Hat",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "generates points while worn",
      pps: 1.5
    }, {
      id: 11,
      name: "Spike Gear",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "deal damage to players that damage you",
      dmg: 0.45
    }, {
      id: 53,
      name: "Turret Gear",
      topSprite: true,
      price: 10000,
      scale: 120,
      desc: "you become a walking turret",
      turret: {
        proj: 1,
        range: 700,
        rate: 2500
      },
      spdMult: 0.7
    }, {
      id: 20,
      name: "Samurai Armor",
      price: 12000,
      scale: 120,
      desc: "increased attack speed and fire rate",
      atkSpd: 0.78
    }, {
      id: 58,
      name: "Dark Knight",
      price: 12000,
      scale: 120,
      desc: "restores health when you deal damage",
      healD: 0.4
    }, {
      id: 27,
      name: "Scavenger Gear",
      price: 15000,
      scale: 120,
      desc: "earn double points for each kill",
      kScrM: 2
    }, {
      id: 40,
      name: "Tank Gear",
      price: 15000,
      scale: 120,
      desc: "increased damage to buildings but slower movement",
      spdMult: 0.3,
      bDmg: 3.3
    }, {
      id: 52,
      name: "Thief Gear",
      price: 15000,
      scale: 120,
      desc: "steal half of a players gold when you kill them",
      goldSteal: 0.5
    }, {
      id: 55,
      name: "Bloodthirster",
      price: 20000,
      scale: 120,
      desc: "Restore Health when dealing damage. And increased damage",
      healD: 0.25,
      dmgMultO: 1.2
    }, {
      id: 56,
      name: "Assassin Gear",
      price: 20000,
      scale: 120,
      desc: "Go invisible when not moving. Can't eat. Increased speed",
      noEat: true,
      spdMult: 1.1,
      invisTimer: 1000
    }];
    // STORE ACCESSORIES:
    p2163.exports.accessories = [{
      id: 12,
      name: "Snowball",
      price: 1000,
      scale: 105,
      xOff: 18,
      desc: "no effect"
    }, {
      id: 9,
      name: "Tree Cape",
      price: 1000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 10,
      name: "Stone Cape",
      price: 1000,
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
      price: 2000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 11,
      name: "Monkey Tail",
      price: 2000,
      scale: 97,
      xOff: 25,
      desc: "Super speed but reduced damage",
      spdMult: 1.35,
      dmgMultO: 0.2
    }, {
      id: 17,
      name: "Apple Basket",
      price: 3000,
      scale: 80,
      xOff: 12,
      desc: "slowly regenerates health over time",
      healthRegen: 1
    }, {
      id: 6,
      name: "Winter Cape",
      price: 3000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 4,
      name: "Skull Cape",
      price: 4000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 5,
      name: "Dash Cape",
      price: 5000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 2,
      name: "Dragon Cape",
      price: 6000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 1,
      name: "Super Cape",
      price: 8000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 7,
      name: "Troll Cape",
      price: 8000,
      scale: 90,
      desc: "no effect"
    }, {
      id: 14,
      name: "Thorns",
      price: 10000,
      scale: 115,
      xOff: 20,
      desc: "no effect"
    }, {
      id: 15,
      name: "Blockades",
      price: 10000,
      scale: 95,
      xOff: 15,
      desc: "no effect"
    }, {
      id: 20,
      name: "Devils Tail",
      price: 10000,
      scale: 95,
      xOff: 20,
      desc: "no effect"
    }, {
      id: 16,
      name: "Sawblade",
      price: 12000,
      scale: 90,
      spin: true,
      xOff: 0,
      desc: "deal damage to players that damage you",
      dmg: 0.15
    }, {
      id: 13,
      name: "Angel Wings",
      price: 15000,
      scale: 138,
      xOff: 22,
      desc: "slowly regenerates health over time",
      healthRegen: 3
    }, {
      id: 19,
      name: "Shadow Wings",
      price: 15000,
      scale: 138,
      xOff: 22,
      desc: "increased movement speed",
      spdMult: 1.1
    }, {
      id: 18,
      name: "Blood Wings",
      price: 20000,
      scale: 178,
      xOff: 26,
      desc: "restores health when you deal damage",
      healD: 0.2
    }, {
      id: 21,
      name: "Corrupt X Wings",
      price: 20000,
      scale: 178,
      xOff: 26,
      desc: "deal damage to players that damage you",
      dmg: 0.25
    }];
    /***/
  },
  /***/
  "./src/js/libs/animText.js":
  /*!*********************************!*\
  !*** ./src/js/libs/animText.js ***!
  \*********************************/
  /*! no static exports found */
  /***/
  function (p2165, p2166) {
    // ANIMATED TEXT:
    p2165.exports.AnimText = function () {
      // INIT:
      this.init = function (p2167, p2168, p2169, p2170, p2171, p2172, p2173) {
        this.x = p2167;
        this.y = p2168;
        this.randomX = Math.floor(Math.random() * 2);
        this.randomSpeed = Math.floor(Math.random() * 5);
        this.moveSpeed = 10;
        this.color = p2173;
        this.scale = p2169;
        this.startScale = this.scale;
        this.maxScale = p2169 * 1.5;
        this.scaleSpeed = f241("visual").value == "hans" ? 0.35 : 0.7;
        this.speed = p2170;
        this.life = p2171;
        this.life2 = this.life;
        this.startLife = this.life;
        this.text = p2172;
        this.animation = 0;
        this.maxAnim = 100;
        this.acc = 1;
        this.acc2 = 1;
      };
      // UPDATE:
      this.update = function (p2174) {
        if (this.life) {
          this.life -= p2174;
          this.animation += 6;
          if (f241("visual").value == "me") {
            if (this.animation < this.maxAnim) {
              this.acc -= 0.1;
              this.y -= this.speed * this.acc * p2174;
            } else {
              this.life2 -= p2174 * 1.75;
              this.acc += 0.15;
              this.y += this.speed * this.acc * p2174;
            }
            this.scale += this.scaleSpeed * p2174;
            if (this.scale >= this.maxScale) {
              this.scale = this.maxScale;
              this.scaleSpeed *= -1;
            } else if (this.scale <= this.startScale) {
              this.scale = this.startScale;
              this.scaleSpeed = 0;
            }
          } else if (f241("visual").value == "fz") {
            if (this.animation < this.maxAnim) {
              this.acc -= 0;
              this.y -= this.speed * this.acc * p2174;
            } else {
              this.life2 -= p2174 * 0;
              this.acc += 0;
              this.y += this.speed * this.acc * p2174;
            }
            if (this.randomX == 1) {
              this.x += this.moveSpeed;
            } else if (this.randomX == 0) {
              this.x -= this.moveSpeed;
            }
            this.moveSpeed = Math.max(0, this.moveSpeed - 1);
            this.scale += this.scaleSpeed * p2174;
            if (this.scale >= this.maxScale) {
              this.scale = this.maxScale;
              this.scaleSpeed *= 1.75;
            } else if (this.scale <= this.startScale) {
              this.scaleSpeed = 1.75;
              this.scale -= 0;
            }
          } else {
            this.y -= this.speed * p2174;
            this.scale += this.scaleSpeed * p2174;
            if (this.scale >= this.maxScale) {
              this.scale = this.maxScale;
              this.scaleSpeed *= 1.75;
            } else if (this.scale <= this.startScale) {
              this.scale = this.startScale;
              this.scaleSpeed = 1.75;
            }
          }
          if (this.life <= 0) {
            this.life = 0;
          }
        }
      };
      // RENDER:
      this.render = function (p2175, p2176, p2177) {
        if (f241("visual").value == "me" || f241("visual").value == "hans") {
          p2175.globalAlpha = Math.min(1, this.life2 / this.startLife);
        }
        p2175.fillStyle = this.color;
        p2175.font = this.scale + "px Hammersmith One";
        if (f241("visual").value == "cele" || f241("visual").value == "zeph") {
          p2175.strokeText(this.text, this.x - p2176, this.y - p2177);
        }
        p2175.fillText(this.text, this.x - p2176, this.y - p2177);
        p2175.globalAlpha = 1;
      };
    };
    // TEXT MANAGER:
    p2165.exports.TextManager = function () {
      this.texts = [];
      // UPDATE:
      this.update = function (p2178, p2179, p2180, p2181) {
        p2179.textBaseline = "middle";
        p2179.textAlign = "center";
        for (var vLN0264 = 0; vLN0264 < this.texts.length; ++vLN0264) {
          if (this.texts[vLN0264].life) {
            this.texts[vLN0264].update(p2178);
            this.texts[vLN0264].render(p2179, p2180, p2181);
          }
        }
      };
      // SHOW TEXT:
      this.showText = function (p2182, p2183, p2184, p2185, p2186, p2187, p2188) {
        var v1366;
        for (var vLN0265 = 0; vLN0265 < this.texts.length; ++vLN0265) {
          if (!this.texts[vLN0265].life) {
            v1366 = this.texts[vLN0265];
            break;
          }
        }
        if (!v1366) {
          v1366 = new p2165.exports.AnimText();
          this.texts.push(v1366);
        }
        v1366.init(p2182, p2183, p2184, p2185, p2186, p2187, p2188);
      };
    };
    /***/
  },
  /***/
  "./src/js/libs/io-client.js":
  /*!**********************************!*\
  !*** ./src/js/libs/io-client.js ***!
  \**********************************/
  /*! no static exports found */
  /***/
  function (p2189, p2190, p2191) {/* @reup-io-client */
                /* ------------------------------------------------------------------
                 * io-client, rewritten against the shipped game bundle.
                 *
                 * The old bundle sent msgpack([name, args]) and read packet names
                 * straight off the wire. The current server negotiates a
                 * per-connection opcode permutation in io-init and expects every
                 * client frame to carry a 6-byte truncated
                 * HMAC-SHA256 prefix over the msgpack body. Frames that do not
                 * match are dropped, which is why the unpatched mod connects and
                 * then never spawns.
                 * ---------------------------------------------------------------- */

                var msgpack = __webpack_require__("./node_modules/msgpack-lite/lib/browser.js");
                var antiKickWindow = Date.now();
                var antiKickCount = 0;
                var SIG_BYTES = 6;
                var MODE_KEYED = 1;
                var TABLE_SALT = 1;
                var C2S_ALPHABET = ["M","D","9","e","F","z","H","K","L","N","b","P","Q","c","6","S","0"];
                var S2C_ALPHABET = ["A","B","C","D","E","a","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","X","Y","Z","g","1","2","3","4","5","6","7","8","9","0"];

                var SHA256_K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

                function rotr(value, bits) {
                    return (value >>> bits) | (value << (32 - bits));
                }

                function sha256(input) {
                    var h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
                    var len = input.length;
                    var bitLen = len * 8;
                    var padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
                    padded.set(input);
                    padded[len] = 128;
                    var view = new DataView(padded.buffer);
                    view.setUint32(padded.length - 4, bitLen >>> 0, false);
                    view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

                    var w = new Uint32Array(64);
                    for (var block = 0; block < padded.length; block += 64) {
                        for (var i = 0; i < 16; i++) {
                            w[i] = view.getUint32(block + i * 4, false);
                        }
                        for (var i = 16; i < 64; i++) {
                            var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                            var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
                        }
                        var a = h[0], b = h[1], c = h[2], d = h[3];
                        var e = h[4], f = h[5], g = h[6], hh = h[7];
                        for (var i = 0; i < 64; i++) {
                            var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                            var ch = (e & f) ^ (~e & g);
                            var t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
                            var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                            var maj = (a & b) ^ (a & c) ^ (b & c);
                            var t2 = (S0 + maj) | 0;
                            hh = g; g = f; f = e; e = (d + t1) | 0;
                            d = c; c = b; b = a; a = (t1 + t2) | 0;
                        }
                        h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
                        h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
                        h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
                        h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
                    }

                    var out = new Uint8Array(32);
                    var outView = new DataView(out.buffer);
                    for (var i = 0; i < 8; i++) {
                        outView.setUint32(i * 4, h[i], false);
                    }
                    return out;
                }

                var HMAC_BLOCK = 64;

                function hmacSha256(key, message) {
                    var k = key;
                    if (k.length > HMAC_BLOCK) k = sha256(k);
                    var padded = new Uint8Array(HMAC_BLOCK);
                    padded.set(k);
                    var inner = new Uint8Array(HMAC_BLOCK + message.length);
                    var outer = new Uint8Array(HMAC_BLOCK + 32);
                    for (var i = 0; i < HMAC_BLOCK; i++) {
                        inner[i] = padded[i] ^ 54;
                        outer[i] = padded[i] ^ 92;
                    }
                    inner.set(message, HMAC_BLOCK);
                    outer.set(sha256(inner), HMAC_BLOCK);
                    return sha256(outer);
                }

                function signFrame(key, message) {
                    return hmacSha256(key, message).subarray(0, SIG_BYTES);
                }

                function hexToBytes(hex) {
                    var out = new Uint8Array(hex.length / 2);
                    for (var i = 0; i < out.length; i++) {
                        out[i] = parseInt(hex.substr(i * 2, 2), 16);
                    }
                    return out;
                }

                /* The bundle's seeded PRNG — a mulberry/splitmix variant whose
                 * state is the seed itself, advanced on every call. */
                function seededRandom(seed) {
                    return function () {
                        seed |= 0;
                        seed = (seed + 1831565813) | 0;
                        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                    };
                }

                /* Fisher-Yates over the index list, walked top-down, exactly as
                 * the bundle does it — any other traversal order yields a
                 * different table for the same seed. */
                function permuteAlphabet(alphabet, seed) {
                    var n = alphabet.length;
                    var order = alphabet.map(function (_, i) { return i; });
                    var rand = seededRandom(seed >>> 0);
                    for (var i = n - 1; i > 0; i--) {
                        var j = Math.floor(rand() * (i + 1));
                        var tmp = order[i];
                        order[i] = order[j];
                        order[j] = tmp;
                    }
                    var enc = {};
                    var dec = {};
                    for (var i = 0; i < n; i++) {
                        enc[alphabet[i]] = order[i];
                        dec[order[i]] = alphabet[i];
                    }
                    return { enc: enc, dec: dec };
                }

                function buildTables(seed) {
                    var mixed = (seed ^ Math.imul(TABLE_SALT, 2654435761)) >>> 0;
                    return {
                        c2s: permuteAlphabet(C2S_ALPHABET, mixed),
                        s2c: permuteAlphabet(S2C_ALPHABET, (mixed ^ 2246822507) >>> 0)
                    };
                }

                /* Null until io-init lands, and null again on close, so a
                 * reconnect can never reuse a stale table or sequence number. */
                var session = null;

                module.exports = {
                    socket: null
                    , connected: false
                    , socketId: -1
                    , connect: function (address, callback, events) {
                        if (this.socket) return;

                        var _this = this;
                        try {
                            var socketError = false;
                            /* Captured before the game locks window.WebSocket. */
                            var Native = window.OriginalWebSocket || window.WebSocket;
                            this.socket = new Native(address);
                            this.socket.binaryType = "arraybuffer";

                            /* The old client called back from onopen, which fired
                             * before io-init had handed over the opcode table — so
                             * the spawn packet went out unsigned and was dropped,
                             * and the player never entered the world. The shipped
                             * bundle calls back from io-init instead; so do we. */
                            var entered = false;

                            this.socket.onmessage = function (message) {
                                var parsed = msgpack.decode(new Uint8Array(message.data));
                                var type = parsed[0];
                                var data = parsed[1];

                                if (type === "io-init") {
                                    _this.socketId = data[0];
                                    session = data[3] === MODE_KEYED ? {
                                        key: hexToBytes(data[2])
                                        , tables: buildTables(data[1] >>> 0)
                                        , seq: 0
                                    } : null;
                                    if (!entered) {
                                        entered = true;
                                        callback();
                                    }
                                    return;
                                }

                                if (session && typeof type === "number") {
                                    type = session.tables.s2c.dec[type];
                                    if (type === undefined) return;
                                }

                                var handler = events[type];
                                if (handler) handler.apply(undefined, data);
                            };
                            this.socket.onopen = function () {
                                _this.connected = true;
                            };
                            this.socket.onclose = function (event) {
                                _this.connected = false;
                                session = null;
                                if (event.code == 4001) {
                                    callback("Invalid Connection");
                                } else if (!socketError) {
                                    callback("disconnected");
                                }
                            };
                            this.socket.onerror = function (error) {
                                if (_this.socket && _this.socket.readyState != 1) {
                                    socketError = true;
                                    console.error("Socket error", arguments);
                                    callback("Socket error");
                                }
                            };
                        } catch (e) {
                            console.warn("Socket connection error:", e);
                            callback(e);
                        }
                    }
                    , send: function (type) {
                        if (!this.socket) return;
                        var data = Array.prototype.slice.call(arguments, 1);
                        if (Date.now() - antiKickWindow > 500) {
                            antiKickCount = 0;
                            antiKickWindow = Date.now();
                        }
                        if (antiKickCount > 45 && type !== "0") return;
                        if (type !== "0") antiKickCount++;
                        if (session) {
                            var opcode = session.tables.c2s.enc[type];
                            /* Unknown name means a packet the current server does
                             * not have. Dropping it here beats sending a frame the
                             * server will treat as malformed. */
                            if (opcode === undefined) return;
                            var body = msgpack.encode([opcode, data, ++session.seq]);
                            var frame = new Uint8Array(SIG_BYTES + body.length);
                            frame.set(signFrame(session.key, body), 0);
                            frame.set(body, SIG_BYTES);
                            this.socket.send(frame);
                            return;
                        }

                        this.socket.send(msgpack.encode([type, data]));
                    }
                    , socketReady: function () {
                        return (this.socket && this.connected);
                    }
                    , close: function () {
                        this.socket && this.socket.close();
                        this.socket = null;
                        this.connected = false;
                        session = null;
                    }
                };
},
  /***/
  "./src/js/libs/modernizr.js":
  /*!**********************************!*\
  !*** ./src/js/libs/modernizr.js ***!
  \**********************************/
  /*! no static exports found */
  /***/
  function (p2200, p2201) {
    (function (p2202, p2203, p2204) {
      function f769(p2205, p2206) {
        return typeof p2205 === p2206;
      }
      function a() {
        var v1376;
        var v1377;
        var v1378;
        var v1379;
        var v1380;
        var v1381;
        var v1382;
        for (var v1383 in vA104) {
          if (vA104.hasOwnProperty(v1383)) {
            v1376 = [];
            v1377 = vA104[v1383];
            if (v1377.name && (v1376.push(v1377.name.toLowerCase()), v1377.options && v1377.options.aliases && v1377.options.aliases.length)) {
              for (v1378 = 0; v1378 < v1377.options.aliases.length; v1378++) {
                v1376.push(v1377.options.aliases[v1378].toLowerCase());
              }
            }
            v1379 = f769(v1377.fn, "function") ? v1377.fn() : v1377.fn;
            v1380 = 0;
            for (; v1380 < v1376.length; v1380++) {
              v1381 = v1376[v1380];
              v1382 = v1381.split(".");
              if (v1382.length === 1) {
                f772[v1382[0]] = v1379;
              } else {
                if (!!f772[v1382[0]] && !(f772[v1382[0]] instanceof Boolean)) {
                  f772[v1382[0]] = new Boolean(f772[v1382[0]]);
                }
                f772[v1382[0]][v1382[1]] = v1379;
              }
              vA103.push((v1379 ? "" : "no-") + v1382.join("-"));
            }
          }
        }
      }
      function f771(p2207) {
        var v1384 = v1387.className;
        var v1385 = f772._config.classPrefix || "";
        if (v1388) {
          v1384 = v1384.baseVal;
        }
        if (f772._config.enableJSClass) {
          var v1386 = new RegExp("(^|\\s)" + v1385 + "no-js(\\s|$)");
          v1384 = v1384.replace(v1386, "$1" + v1385 + "js$2");
        }
        if (f772._config.enableClasses) {
          v1384 += " " + v1385 + p2207.join(" " + v1385);
          if (v1388) {
            v1387.className.baseVal = v1384;
          } else {
            v1387.className = v1384;
          }
        }
      }
      var vA103 = [];
      var vA104 = [];
      var vO74 = {
        _version: "3.5.0",
        _config: {
          classPrefix: "",
          enableClasses: true,
          enableJSClass: true,
          usePrefixes: true
        },
        _q: [],
        on: function (p2208, p2209) {
          var vThis12 = this;
          setTimeout(function () {
            p2209(vThis12[p2208]);
          }, 0);
        },
        addTest: function (p2210, p2211, p2212) {
          vA104.push({
            name: p2210,
            fn: p2211,
            options: p2212
          });
        },
        addAsyncTest: function (p2213) {
          vA104.push({
            name: null,
            fn: p2213
          });
        }
      };
      function f772() {}
      f772.prototype = vO74;
      f772 = new f772();
      var v1387 = p2203.documentElement;
      var v1388 = v1387.nodeName.toLowerCase() === "svg";
      f772.addTest("passiveeventlisteners", function () {
        var v1389 = false;
        try {
          var v1390 = Object.defineProperty({}, "passive", {
            get: function () {
              v1389 = true;
            }
          });
          p2202.addEventListener("test", null, v1390);
        } catch (e24) {}
        return v1389;
      });
      a();
      f771(vA103);
      delete vO74.addTest;
      delete vO74.addAsyncTest;
      for (var vLN0267 = 0; vLN0267 < f772._q.length; vLN0267++) {
        f772._q[vLN0267]();
      }
      p2202.Modernizr = f772;
    })(window, document);
    /***/
  },
  /***/
  "./src/js/libs/soundManager.js":
  /*!*************************************!*\
  !*** ./src/js/libs/soundManager.js ***!
  \*************************************/
  /*! no static exports found */
  /***/
  function (p2214, p2215) {
    // PLAYER MANAGER:
    p2214.exports.obj = function (p2216, p2217) {
      // INIT:
      var v1391;
      this.sounds = [];
      this.active = true;
      // PLAY SOUND:
      this.play = function (p2218, p2219, p2220) {
        if (!p2219 || !this.active) {
          return;
        }
        v1391 = this.sounds[p2218];
        if (!v1391) {
          v1391 = new Howl({
            src: ".././sound/" + p2218 + ".mp3"
          });
          this.sounds[p2218] = v1391;
        }
        if (!p2220 || !v1391.isPlaying) {
          v1391.isPlaying = true;
          v1391.play();
          v1391.volume((p2219 || 1) * p2216.volumeMult);
          v1391.loop(p2220);
        }
      };
      // TOGGLE MUTE:
      this.toggleMute = function (p2221, p2222) {
        v1391 = this.sounds[p2221];
        if (v1391) {
          v1391.mute(p2222);
        }
      };
      // STOP SOUND:
      this.stop = function (p2223) {
        v1391 = this.sounds[p2223];
        if (v1391) {
          v1391.stop();
          v1391.isPlaying = false;
        }
      };
    };
    /***/
  },
  /***/
  "./src/js/libs/utils.js":
  /*!******************************!*\
  !*** ./src/js/libs/utils.js ***!
  \******************************/
  /*! no static exports found */
  /***/
  function (p2224, p2225) {
    // MATH UTILS:
    var v1392 = Math.abs;
    var v1393 = Math.cos;
    var v1394 = Math.sin;
    var v1395 = Math.pow;
    var v1396 = Math.sqrt;
    var v1397 = Math.atan2;
    var v1398 = Math.PI;
    // GLOBAL UTILS:
    p2224.exports.loop = function (p2226, p2227) {
      for (let vLN0268 = 0; vLN0268 < p2227; vLN0268++) {
        p2226();
      }
    };
    p2224.exports.toRad = function (p2228) {
      return p2228 * (Math.PI / 180);
    };
    p2224.exports.toAng = function (p2229) {
      return p2229 / (Math.PI / 180);
    };
    p2224.exports.randInt = function (p2230, p2231) {
      return Math.floor(Math.random() * (p2231 - p2230 + 1)) + p2230;
    };
    p2224.exports.randFloat = function (p2232, p2233) {
      return Math.random() * (p2233 - p2232 + 1) + p2232;
    };
    p2224.exports.lerp = function (p2234, p2235, p2236) {
      return p2234 + (p2235 - p2234) * p2236;
    };
    p2224.exports.decel = function (p2237, p2238) {
      if (p2237 > 0) {
        p2237 = Math.max(0, p2237 - p2238);
      } else if (p2237 < 0) {
        p2237 = Math.min(0, p2237 + p2238);
      }
      return p2237;
    };
    p2224.exports.getDistance = function (p2239, p2240, p2241, p2242) {
      return v1396((p2241 -= p2239) * p2241 + (p2242 -= p2240) * p2242);
    };
    p2224.exports.getDist = function (p2243, p2244, p2245, p2246) {
      let vO75 = {
        x: p2245 == 0 ? p2243.x : p2245 == 1 ? p2243.x1 : p2245 == 2 ? p2243.x2 : p2245 == 3 && p2243.x3,
        y: p2245 == 0 ? p2243.y : p2245 == 1 ? p2243.y1 : p2245 == 2 ? p2243.y2 : p2245 == 3 && p2243.y3
      };
      let vO76 = {
        x: p2246 == 0 ? p2244.x : p2246 == 1 ? p2244.x1 : p2246 == 2 ? p2244.x2 : p2246 == 3 && p2244.x3,
        y: p2246 == 0 ? p2244.y : p2246 == 1 ? p2244.y1 : p2246 == 2 ? p2244.y2 : p2246 == 3 && p2244.y3
      };
      return v1396((vO76.x -= vO75.x) * vO76.x + (vO76.y -= vO75.y) * vO76.y);
    };
    p2224.exports.getDirection = function (p2247, p2248, p2249, p2250) {
      return v1397(p2248 - p2250, p2247 - p2249);
    };
    p2224.exports.getDirect = function (p2251, p2252, p2253, p2254) {
      let vO77 = {
        x: p2253 == 0 ? p2251.x : p2253 == 1 ? p2251.x1 : p2253 == 2 ? p2251.x2 : p2253 == 3 && p2251.x3,
        y: p2253 == 0 ? p2251.y : p2253 == 1 ? p2251.y1 : p2253 == 2 ? p2251.y2 : p2253 == 3 && p2251.y3
      };
      let vO78 = {
        x: p2254 == 0 ? p2252.x : p2254 == 1 ? p2252.x1 : p2254 == 2 ? p2252.x2 : p2254 == 3 && p2252.x3,
        y: p2254 == 0 ? p2252.y : p2254 == 1 ? p2252.y1 : p2254 == 2 ? p2252.y2 : p2254 == 3 && p2252.y3
      };
      return v1397(vO77.y - vO78.y, vO77.x - vO78.x);
    };
    p2224.exports.getAngleDist = function (p2255, p2256) {
      var v1399 = v1392(p2256 - p2255) % (v1398 * 2);
      if (v1399 > v1398) {
        return v1398 * 2 - v1399;
      } else {
        return v1399;
      }
    };
    p2224.exports.isNumber = function (p2257) {
      return typeof p2257 == "number" && !isNaN(p2257) && isFinite(p2257);
    };
    p2224.exports.isString = function (p2258) {
      return p2258 && typeof p2258 == "string";
    };
    p2224.exports.kFormat = function (p2259) {
      if (p2259 > 999) {
        return (p2259 / 1000).toFixed(1) + "k";
      } else {
        return p2259;
      }
    };
    p2224.exports.capitalizeFirst = function (p2260) {
      return p2260.charAt(0).toUpperCase() + p2260.slice(1);
    };
    p2224.exports.fixTo = function (p2261, p2262) {
      return parseFloat(p2261.toFixed(p2262));
    };
    p2224.exports.sortByPoints = function (p2263, p2264) {
      return parseFloat(p2264.points) - parseFloat(p2263.points);
    };
    p2224.exports.lineInRect = function (p2265, p2266, p2267, p2268, p2269, p2270, p2271, p2272) {
      var vP2269 = p2269;
      var vP2271 = p2271;
      if (p2269 > p2271) {
        vP2269 = p2271;
        vP2271 = p2269;
      }
      if (vP2271 > p2267) {
        vP2271 = p2267;
      }
      if (vP2269 < p2265) {
        vP2269 = p2265;
      }
      if (vP2269 > vP2271) {
        return false;
      }
      var vP2270 = p2270;
      var vP2272 = p2272;
      var v1400 = p2271 - p2269;
      if (Math.abs(v1400) > 1e-7) {
        var v1401 = (p2272 - p2270) / v1400;
        var v1402 = p2270 - v1401 * p2269;
        vP2270 = v1401 * vP2269 + v1402;
        vP2272 = v1401 * vP2271 + v1402;
      }
      if (vP2270 > vP2272) {
        var vVP2272 = vP2272;
        vP2272 = vP2270;
        vP2270 = vVP2272;
      }
      if (vP2272 > p2268) {
        vP2272 = p2268;
      }
      if (vP2270 < p2266) {
        vP2270 = p2266;
      }
      if (vP2270 > vP2272) {
        return false;
      }
      return true;
    };
    p2224.exports.containsPoint = function (p2273, p2274, p2275) {
      var v1403 = p2273.getBoundingClientRect();
      var v1404 = v1403.left + window.scrollX;
      var v1405 = v1403.top + window.scrollY;
      var v1406 = v1403.width;
      var v1407 = v1403.height;
      var v1408 = p2274 > v1404 && p2274 < v1404 + v1406;
      var v1409 = p2275 > v1405 && p2275 < v1405 + v1407;
      return v1408 && v1409;
    };
    p2224.exports.mousifyTouchEvent = function (p2276) {
      var v1410 = p2276.changedTouches[0];
      p2276.screenX = v1410.screenX;
      p2276.screenY = v1410.screenY;
      p2276.clientX = v1410.clientX;
      p2276.clientY = v1410.clientY;
      p2276.pageX = v1410.pageX;
      p2276.pageY = v1410.pageY;
    };
    p2224.exports.hookTouchEvents = function (p2277, p2278) {
      var v1411 = !p2278;
      var v1412 = false;
      // var passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
      var v1413 = false;
      p2277.addEventListener("touchstart", p2224.exports.checkTrusted(f773), v1413);
      p2277.addEventListener("touchmove", p2224.exports.checkTrusted(f774), v1413);
      p2277.addEventListener("touchend", p2224.exports.checkTrusted(f775), v1413);
      p2277.addEventListener("touchcancel", p2224.exports.checkTrusted(f775), v1413);
      p2277.addEventListener("touchleave", p2224.exports.checkTrusted(f775), v1413);
      function f773(p2279) {
        p2224.exports.mousifyTouchEvent(p2279);
        window.setUsingTouch(true);
        if (v1411) {
          p2279.preventDefault();
          p2279.stopPropagation();
        }
        if (p2277.onmouseover) {
          p2277.onmouseover(p2279);
        }
        v1412 = true;
      }
      function f774(p2280) {
        p2224.exports.mousifyTouchEvent(p2280);
        window.setUsingTouch(true);
        if (v1411) {
          p2280.preventDefault();
          p2280.stopPropagation();
        }
        if (p2224.exports.containsPoint(p2277, p2280.pageX, p2280.pageY)) {
          if (!v1412) {
            if (p2277.onmouseover) {
              p2277.onmouseover(p2280);
            }
            v1412 = true;
          }
        } else if (v1412) {
          if (p2277.onmouseout) {
            p2277.onmouseout(p2280);
          }
          v1412 = false;
        }
      }
      function f775(p2281) {
        p2224.exports.mousifyTouchEvent(p2281);
        window.setUsingTouch(true);
        if (v1411) {
          p2281.preventDefault();
          p2281.stopPropagation();
        }
        if (v1412) {
          if (p2277.onclick) {
            p2277.onclick(p2281);
          }
          if (p2277.onmouseout) {
            p2277.onmouseout(p2281);
          }
          v1412 = false;
        }
      }
    };
    p2224.exports.removeAllChildren = function (p2282) {
      while (p2282.hasChildNodes()) {
        p2282.removeChild(p2282.lastChild);
      }
    };
    p2224.exports.generateElement = function (p2283) {
      var v1414 = document.createElement(p2283.tag || "div");
      function f776(p2284, p2285) {
        if (p2283[p2284]) {
          v1414[p2285] = p2283[p2284];
        }
      }
      f776("text", "textContent");
      f776("html", "innerHTML");
      f776("class", "className");
      for (var v1415 in p2283) {
        switch (v1415) {
          case "tag":
          case "text":
          case "html":
          case "class":
          case "style":
          case "hookTouch":
          case "parent":
          case "children":
            continue;
          default:
            break;
        }
        v1414[v1415] = p2283[v1415];
      }
      if (v1414.onclick) {
        v1414.onclick = p2224.exports.checkTrusted(v1414.onclick);
      }
      if (v1414.onmouseover) {
        v1414.onmouseover = p2224.exports.checkTrusted(v1414.onmouseover);
      }
      if (v1414.onmouseout) {
        v1414.onmouseout = p2224.exports.checkTrusted(v1414.onmouseout);
      }
      if (p2283.style) {
        v1414.style.cssText = p2283.style;
      }
      if (p2283.hookTouch) {
        p2224.exports.hookTouchEvents(v1414);
      }
      if (p2283.parent) {
        p2283.parent.appendChild(v1414);
      }
      if (p2283.children) {
        for (var vLN0269 = 0; vLN0269 < p2283.children.length; vLN0269++) {
          v1414.appendChild(p2283.children[vLN0269]);
        }
      }
      return v1414;
    };
    p2224.exports.eventIsTrusted = function (p2286) {
      if (p2286 && typeof p2286.isTrusted == "boolean") {
        return p2286.isTrusted;
      } else {
        return true;
      }
    };
    p2224.exports.checkTrusted = function (p2287) {
      return function (p2288) {
        if (p2288 && p2288 instanceof Event && p2224.exports.eventIsTrusted(p2288)) {
          p2287(p2288);
        } else {//console.error("Event is not trusted.", ev);
        }
      };
    };
    p2224.exports.randomString = function (p2289) {
      var vLS25 = "";
      var vLSABCDEFGHIJKLMNOPQRST5 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      for (var vLN0270 = 0; vLN0270 < p2289; vLN0270++) {
        vLS25 += vLSABCDEFGHIJKLMNOPQRST5.charAt(Math.floor(Math.random() * vLSABCDEFGHIJKLMNOPQRST5.length));
      }
      return vLS25;
    };
    p2224.exports.countInArray = function (p2290, p2291) {
      var vLN0271 = 0;
      for (var vLN0272 = 0; vLN0272 < p2290.length; vLN0272++) {
        if (p2290[vLN0272] === p2291) {
          vLN0271++;
        }
      }
      return vLN0271;
    };
    /***/
  }
});
//# sourceMappingURL=bundle.js.map
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __modMain, { once: true });
} else {
    __modMain();
}
})();
