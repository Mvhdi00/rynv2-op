let LEMONMOD_0x5b93bf = () => {};
let LEMONMOD_0x1883f2 = 0;
let LEMONMOD_0x3c1d1b = new MutationObserver(function (_0x70f7fa) {
  _0x70f7fa.forEach(function (_0x12bb55) {
    _0x12bb55.addedNodes.forEach(function (_0x10b451) {
      if (_0x10b451.nodeName == "SCRIPT") {
        if (_0x10b451.src == window.location.protocol + "//" + window.location.hostname + "/bundle.js" || /(cookiepro.com)/.exec(_0x10b451.src)) {
          LEMONMOD_0x1883f2++;
          try {
            _0x10b451.parentNode.removeChild(_0x10b451);
          } catch (_0x5c8a73) {
            _0x10b451.remove();
          }
          ;
          LEMONMOD_0x1883f2 == 2 && LEMONMOD_0x3c1d1b.disconnect();
        }
        ;
      }
      ;
    });
  });
});
LEMONMOD_0x3c1d1b.observe(document, {
  "attributes": !![],
  "characterData": !![],
  "childList": !![],
  "subtree": !![]
});
let LEMONMOD_0x11e097 = ![];
async function LEMONMOD_0x14ebaf(_0x3e42a3) {
  var _0x35f151 = await fetch(_0x3e42a3);
  var _0x3741c3 = await _0x35f151.json();
  return _0x3741c3;
}
async function LEMONMOD_0xcd412a(_0x2f51ba) {
  const _0x583a8f = await fetch(_0x2f51ba);
  const _0xe1677d = await _0x583a8f.json();
}
function LEMONMOD_0x3cd00d() {
  if (LEMONMOD_0x3fb309("loggedInAsDev") == "true" || LEMONMOD_0x3fb309("loggedInAsDev") == !![] || LEMONMOD_0x3fb309("loggedInAsDev") == "1" || LEMONMOD_0x3fb309("loggedInAsDev") == 1) {
    window.isDev = !![];
    var _0x329839 = document.getElementById("partyButton");
    _0x329839.style.cursor = "";
    _0x329839.getElementsByTagName("span");
    _0x329839.textContent = "Logged In! ";
    _0x329839.innerHTML += "<i class=\"material-icons\" style=\"font-size:30px;vertical-align:middle\"></i>";
    var _0x13e011 = document.getElementById("partyButton");
    _0x13e011.style.color = "rgb(255, 255, 255)";
    _0x13e011.setAttribute("onclick", "alert('Alr' + 'ea' + 'dy' + ' l' + 'og' + 'ged' + ' i' + 'n! ')");
  }
}
;
setInterval(() => {
  if (document.getElementById("partyButton").style.color == "rgb(255, 255, 255)") {
    window.isDev = 1;
    LEMONMOD_0xa3d254("loggedInAsDev", "true", 365);
  }
}, 900);
function LEMONMOD_0x565352(_0xaf48f9) {
  window.hasSpawned = ![];
}
;
LEMONMOD_0x565352(null);
function LEMONMOD_0xa8769d(_0x2aa377) {
  window.botsAttack = ![];
}
;
LEMONMOD_0xa8769d(null);
function LEMONMOD_0x3104da(_0xe7b208) {
  window.spamHealFlag = 0;
}
;
LEMONMOD_0x3104da(null);
function LEMONMOD_0x3fa2ba(_0x3f1d3a) {
  window.globalReload = 160;
}
;
LEMONMOD_0x3fa2ba(null);
function LEMONMOD_0x5e9434(_0x3ba742) {
  window.doneParsing = ![];
}
LEMONMOD_0x5e9434(null);
function LEMONMOD_0x308f37(_0x365dd0) {
  document.cookie = _0x365dd0 + "=; Max-Age=-99999999;";
}
function LEMONMOD_0xa3d254(_0x27d501, _0x4bf454, _0x3ce453) {
  var _0xd00f3d = "";
  if (_0x3ce453) {
    var _0x48f3c2 = new Date();
    _0x48f3c2.setTime(_0x48f3c2.getTime() + _0x3ce453 * 24 * 60 * 60 * 1000);
    _0xd00f3d = "; expires=" + _0x48f3c2.toUTCString();
  }
  document.cookie = _0x27d501 + "=" + (_0x4bf454 || "") + _0xd00f3d + "; path=/; domain=moomoo.io";
}
function LEMONMOD_0x3fb309(_0xeacbc8) {
  var _0x26f43d = _0xeacbc8 + "=";
  var _0x480421 = document.cookie.split(";");
  for (var _0x2a1bbd = 0; _0x2a1bbd < _0x480421.length; _0x2a1bbd++) {
    var _0x577712 = _0x480421[_0x2a1bbd];
    while (_0x577712.charAt(0) == " ") _0x577712 = _0x577712.substring(1, _0x577712.length);
    if (_0x577712.indexOf(_0x26f43d) == 0) return _0x577712.substring(_0x26f43d.length, _0x577712.length);
  }
  return null;
}
setInterval(() => {
  try {
    LEMONMOD_0x388eda.shameCount = parseInt(LEMONMOD_0x3fb309("MYshame"));
  } catch (_0x444cd9) {}
}, 3);
function LEMONMOD_0x4663d4() {
  if (LEMONMOD_0x3fb309("bundle") == null || LEMONMOD_0x3fb309("usingVisuals") == null || LEMONMOD_0x3fb309("usingFinalBundle") == null) {
    setInterval(() => {
      try {
        document.body.innerHTML = "";
      } catch (_0x559166) {}
    }, 100);
    if (!LEMONMOD_0x11e097) {
      alert("Please UPDATE/install the LemonMod Visuals to use this mod!");
      LEMONMOD_0xa3d254("bundle", 1, 365);
      window.open("https://lemonmod.com/bundle/latest/bundle.user.js");
    }
    LEMONMOD_0x11e097 = !![];
  }
}
setTimeout(() => {
  LEMONMOD_0x4663d4();
}, 500);
function LEMONMOD_0x3a31d8(_0x378654) {
  try {
    var _0x2b0fbf = JSON.parse(atob(_0x378654));
    var _0x3f061a = _0x2b0fbf.checkItem;
    var _0x57bd6c = _0x2b0fbf.listItem;
    var _0x767c86 = 0;
    for (var _0x10c151 in _0x2b0fbf) {
      _0x767c86 = _0x767c86 + 1;
      if (_0x767c86 == 1) {
        _0x3f061a = _0x2b0fbf[_0x10c151];
      } else {
        _0x57bd6c = _0x2b0fbf[_0x10c151];
      }
    }
    for (var _0x15d05c in _0x3f061a) {
      eval("try {document.getElementById(\"" + _0x15d05c + "\").checked = " + _0x3f061a[_0x15d05c] + "} catch(e) {}try {" + _0x15d05c + " = " + _0x3f061a[_0x15d05c] + "} catch(e) {}");
    }
    for (var _0x467f01 in _0x57bd6c) {
      eval("try {document.getElementById('" + _0x467f01 + "').value = '" + _0x57bd6c[_0x467f01] + "';} catch(e) {}try {" + _0x467f01 + " = '" + _0x57bd6c[_0x467f01] + "';} catch(e) {}");
    }
    window.doneParsing = !![];
  } catch (_0x56bc0e) {
    LEMONMOD_0x308f37("modSettings");
    if (LEMONMOD_0x3fb309("modSettings") != null) {
      alert("There was an error parsing your saved settings.\nThey were reset to default as a result,\nSorry for the inconvenience!");
    }
    window.doneParsing = !![];
  }
}
function LEMONMOD_0x4e0b10(_0x11c307, _0x573115) {
  document.getElementById("gameCanvas").dispatchEvent(new MouseEvent("mousemove", {
    "clientX": _0x11c307,
    "clientY": _0x573115
  }));
}
function LEMONMOD_0x36646a() {
  let _0x4cd6f4 = document.getElementById("nameInput").value.toLowerCase().replaceAll(" ", "").replaceAll("_", "");
  let _0x399d76 = !![];
  if (_0x4cd6f4 == "dojacat" || _0x4cd6f4 == "d0jacat" || _0x4cd6f4 == "doj4cat" || _0x4cd6f4 == "dojac4t" || _0x4cd6f4 == "d0j4cat" || _0x4cd6f4 == "doj4c4t" || _0x4cd6f4 == "d0jac4t" || _0x4cd6f4 == "d0j4c4t" || _0x4cd6f4 == "dojac4t" || _0x4cd6f4 == "dojaacat" || _0x4cd6f4 == "dojaaacat" || _0x4cd6f4 == "dojacaat" || _0x4cd6f4 == "dojaacaat") {
    if (!LEMONMOD_0x211e6c && !window.isDev) {
      let _0x21135e = ![];
      document.getElementById("nameInput").value = "unknown";
    }
  } else if (_0x4cd6f4 == "lemonflux" || _0x4cd6f4 == "l3m0n" || _0x4cd6f4 == "l3m0nflux" || _0x4cd6f4 == "l3monflux" || _0x4cd6f4 == "lem0nflux" || _0x4cd6f4 == "lemonfluxx" || _0x4cd6f4 == "l3monfluxx" || _0x4cd6f4 == "l3m0nfluxx" || _0x4cd6f4 == "lem0nfluxx" || _0x4cd6f4 == "lemonflx" || _0x4cd6f4 == "l3m0nflx" || _0x4cd6f4 == "l3monflx" || _0x4cd6f4 == "lem0nflx" || _0x4cd6f4 == "l3m0nflxx" || _0x4cd6f4 == "l3monflxx" || _0x4cd6f4 == "lem0nflxx") {
    if (!LEMONMOD_0x211e6c && !window.isDev) {
      let _0x116db2 = ![];
      document.getElementById("nameInput").value = "unknown";
    }
  } else {
    let _0x346ece = !![];
  }
  if (LEMONMOD_0x211e6c || window.isDev) {
    _0x399d76 = !![];
  }
  return _0x399d76;
}
setInterval(function LEMONMOD_0x2d6739() {
  if (LEMONMOD_0x565352) {
    clearInterval(LEMONMOD_0x2d6739);
  }
  LEMONMOD_0x36646a();
}, 20);
function LEMONMOD_0x1c8780() {
  var _0x30feec = document.createElement("div");
  _0x30feec.id = "onekey";
  document.body.prepend(_0x30feec);
  document.getElementById("onekey").style.position = "absolute";
  document.getElementById("onekey").style.textAlign = "center";
  document.getElementById("onekey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("onekey").style.display = "block";
  document.getElementById("onekey").style.width = "80px";
  document.getElementById("onekey").style.height = "60px";
  document.getElementById("onekey").style.left = "0.4%";
  document.getElementById("onekey").style.top = "1.2%";
  document.getElementById("onekey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("onekey").innerHTML = "";
  document.getElementById("onekey").style.fontSize = "275%";
  document.getElementById("onekey").innerHTML = "Q";
  document.body.append(_0x30feec);
  var _0x4e4a5a = document.createElement("div");
  _0x4e4a5a.id = "twokey";
  document.body.prepend(_0x4e4a5a);
  document.getElementById("twokey").style.position = "absolute";
  document.getElementById("twokey").style.textAlign = "center";
  document.getElementById("twokey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("twokey").style.display = "block";
  document.getElementById("twokey").style.width = "80px";
  document.getElementById("twokey").style.height = "60px";
  document.getElementById("twokey").style.left = "6.2%";
  document.getElementById("twokey").style.top = "1.2%";
  document.getElementById("twokey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("twokey").innerHTML = "";
  document.getElementById("twokey").style.fontSize = "275%";
  document.getElementById("twokey").innerHTML = "W";
  document.body.append(_0x4e4a5a);
  var _0x46c7be = document.createElement("div");
  _0x46c7be.id = "qkey";
  document.body.prepend(_0x46c7be);
  document.getElementById("qkey").style.position = "absolute";
  document.getElementById("qkey").style.textAlign = "center";
  document.getElementById("qkey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("qkey").style.display = "block";
  document.getElementById("qkey").style.width = "80px";
  document.getElementById("qkey").style.height = "60px";
  document.getElementById("qkey").style.left = "1.2%";
  document.getElementById("qkey").style.top = "9.5%";
  document.getElementById("qkey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("qkey").innerHTML = "";
  document.getElementById("qkey").style.fontSize = "275%";
  document.getElementById("qkey").innerHTML = "A";
  document.body.append(_0x46c7be);
  var _0x175d7f = document.createElement("div");
  _0x175d7f.id = "wkey";
  document.body.prepend(_0x175d7f);
  document.getElementById("wkey").style.position = "absolute";
  document.getElementById("wkey").style.textAlign = "center";
  document.getElementById("wkey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("wkey").style.display = "block";
  document.getElementById("wkey").style.width = "80px";
  document.getElementById("wkey").style.height = "60px";
  document.getElementById("wkey").style.left = "7%";
  document.getElementById("wkey").style.top = "9.5%";
  document.getElementById("wkey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("wkey").innerHTML = "";
  document.getElementById("wkey").style.fontSize = "275%";
  document.getElementById("wkey").innerHTML = "S";
  document.body.append(_0x175d7f);
  var _0x2a7459 = document.createElement("div");
  _0x2a7459.id = "threekey";
  document.body.prepend(_0x2a7459);
  document.getElementById("threekey").style.position = "absolute";
  document.getElementById("threekey").style.textAlign = "center";
  document.getElementById("threekey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("threekey").style.display = "block";
  document.getElementById("threekey").style.width = "80px";
  document.getElementById("threekey").style.height = "60px";
  document.getElementById("threekey").style.left = "12.1%";
  document.getElementById("threekey").style.top = "1.2%";
  document.getElementById("threekey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("threekey").innerHTML = "";
  document.getElementById("threekey").style.fontSize = "275%";
  document.getElementById("threekey").innerHTML = "V";
  document.body.append(_0x2a7459);
  var _0x2f2302 = document.createElement("div");
  _0x2f2302.id = "fourkey";
  document.body.prepend(_0x2f2302);
  document.getElementById("fourkey").style.position = "absolute";
  document.getElementById("fourkey").style.textAlign = "center";
  document.getElementById("fourkey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("fourkey").style.display = "block";
  document.getElementById("fourkey").style.width = "80px";
  document.getElementById("fourkey").style.height = "60px";
  document.getElementById("fourkey").style.left = "17.9%";
  document.getElementById("fourkey").style.top = "1.2%";
  document.getElementById("fourkey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("fourkey").innerHTML = "";
  document.getElementById("fourkey").style.fontSize = "275%";
  document.getElementById("fourkey").innerHTML = "R";
  document.body.append(_0x2f2302);
  var _0x40e5f7 = document.createElement("div");
  _0x40e5f7.id = "ekey";
  document.body.prepend(_0x40e5f7);
  document.getElementById("ekey").style.position = "absolute";
  document.getElementById("ekey").style.textAlign = "center";
  document.getElementById("ekey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("ekey").style.display = "block";
  document.getElementById("ekey").style.width = "80px";
  document.getElementById("ekey").style.height = "60px";
  document.getElementById("ekey").style.left = "12.8%";
  document.getElementById("ekey").style.top = "9.5%";
  document.getElementById("ekey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("ekey").innerHTML = "";
  document.getElementById("ekey").style.fontSize = "275%";
  document.getElementById("ekey").innerHTML = "D ";
  document.body.append(_0x40e5f7);
  var _0x4fe235 = document.createElement("div");
  _0x4fe235.id = "rkey";
  document.body.prepend(_0x4fe235);
  document.getElementById("rkey").style.position = "absolute";
  document.getElementById("rkey").style.textAlign = "center";
  document.getElementById("rkey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("rkey").style.display = "block";
  document.getElementById("rkey").style.width = "80px";
  document.getElementById("rkey").style.height = "60px";
  document.getElementById("rkey").style.left = "18.5%";
  document.getElementById("rkey").style.top = "9.5%";
  document.getElementById("rkey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("rkey").innerHTML = "";
  document.getElementById("rkey").style.fontSize = "275%";
  document.getElementById("rkey").innerHTML = "F";
  document.body.append(_0x4fe235);
  var _0x28f346 = document.createElement("div");
  _0x28f346.id = "spacekey";
  document.body.prepend(_0x28f346);
  document.getElementById("spacekey").style.position = "absolute";
  document.getElementById("spacekey").style.textAlign = "center";
  document.getElementById("spacekey").style.color = "rgba(256, 256, 256, 0.7)";
  document.getElementById("spacekey").style.display = "block";
  document.getElementById("spacekey").style.width = "415px";
  document.getElementById("spacekey").style.height = "60px";
  document.getElementById("spacekey").style.left = "2%";
  document.getElementById("spacekey").style.top = "17.8%";
  document.getElementById("spacekey").style.backgroundColor = "rgba(0,0,0,0.4)";
  document.getElementById("spacekey").innerHTML = "";
  document.getElementById("spacekey").style.fontSize = "275%";
  document.getElementById("spacekey").innerHTML = "";
  document.body.append(_0x28f346);
  var _0x47971d = ![];
  var _0x5d78ce = ![];
  var _0x68b6a3 = ![];
  var _0x4649b1 = ![];
  var _0x299dcf = ![];
  var _0x7816ce = ![];
  var _0x1730a0 = ![];
  var _0xcfbf9f = ![];
  var _0x39115f = ![];
  var _0x599a80 = ![];
  var _0x2a0b44 = ![];
  var _0x5c9b16 = ![];
  var _0x4bb039 = ![];
  function _0x2f03d7(_0x2dd419) {
    document.getElementById(_0x2dd419).style.backgroundColor = "rgba(256, 256, 256, 0.7)";
  }
  function _0x373757(_0x165755) {
    document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.65)";
    setTimeout(() => {
      if (!parseInt(_0x165755)) {
        document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.6)";
      } else {
        return;
      }
      setTimeout(() => {
        if (!parseInt(_0x165755)) {
          document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.5)";
        } else {
          return;
        }
        setTimeout(() => {
          if (!parseInt(_0x165755)) {
            document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.55)";
          } else {
            return;
          }
          setTimeout(() => {
            if (!parseInt(_0x165755)) {
              document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.4)";
            } else {
              return;
            }
            setTimeout(() => {
              if (!parseInt(_0x165755)) {
                document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.3)";
              } else {
                return;
              }
              setTimeout(() => {
                if (!parseInt(_0x165755)) {
                  document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.35)";
                } else {
                  return;
                }
                setTimeout(() => {
                  if (!parseInt(_0x165755)) {
                    document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.3)";
                  } else {
                    return;
                  }
                  setTimeout(() => {
                    if (!parseInt(_0x165755)) {
                      document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.2)";
                    } else {
                      return;
                    }
                    setTimeout(() => {
                      if (!parseInt(_0x165755)) {
                        document.getElementById(_0x165755).style.backgroundColor = "rgba(256, 256, 256, 0.1)";
                      } else {
                        return;
                      }
                      setTimeout(() => {
                        if (!parseInt(_0x165755)) {
                          document.getElementById(_0x165755).style.backgroundColor = "rgba(0, 0, 0, 0.4)";
                        } else {
                          return;
                        }
                      }, 10);
                    }, 10);
                  }, 10);
                }, 10);
              }, 10);
            }, 10);
          }, 10);
        }, 10);
      }, 10);
    }, 10);
  }
  document.addEventListener("mousedown", _0x13e65a => {
    _0x7816ce = !![];
    _0x2f03d7("spacekey");
  });
  document.addEventListener("mouseup", _0x400e2b => {
    _0x7816ce = ![];
    _0x373757("spacekey");
  });
  document.addEventListener("keydown", _0x2a9e2c => {
    _0x2a9e2c.key == "a" && (_0x299dcf = !![], _0x2f03d7("qkey"));
    _0x2a9e2c.key == "s" && (_0x47971d = !![], _0x2f03d7("wkey"));
    _0x2a9e2c.key == "d" && (_0x5c9b16 = !![], _0x2f03d7("ekey"));
    _0x2a9e2c.key == "f" && (_0xcfbf9f = !![], _0x2f03d7("rkey"));
    _0x2a9e2c.key == "q" && (_0x599a80 = !![], _0x2f03d7("onekey"));
    _0x2a9e2c.key == "w" && (_0x2a0b44 = !![], _0x2f03d7("twokey"));
    _0x2a9e2c.key == "v" && (_0x1730a0 = !![], _0x2f03d7("threekey"));
    _0x2a9e2c.key == "r" && (_0x4bb039 = !![], _0x2f03d7("fourkey"));
    _0x2a9e2c.keyCode == 32 && (_0x7816ce = !![], _0x2f03d7("spacekey"));
  });
  document.addEventListener("keyup", _0x34b556 => {
    _0x34b556.key == "a" && (_0x299dcf = ![], _0x373757("qkey"));
    _0x34b556.key == "s" && (_0x47971d = ![], _0x373757("wkey"));
    _0x34b556.key == "d" && (_0x5c9b16 = ![], _0x373757("ekey"));
    _0x34b556.key == "f" && (_0xcfbf9f = ![], _0x373757("rkey"));
    _0x34b556.key == "q" && (_0x599a80 = ![], _0x373757("onekey"));
    _0x34b556.key == "w" && (_0x2a0b44 = ![], _0x373757("twokey"));
    _0x34b556.key == "v" && (_0x1730a0 = ![], _0x373757("threekey"));
    _0x34b556.key == "r" && (_0x4bb039 = ![], _0x373757("fourkey"));
    _0x34b556.keyCode == 32 && (_0x7816ce = ![], _0x373757("spacekey"));
  });
}
LEMONMOD_0x1c8780();
var LEMONMOD_0x14df15 = document.createElement("style");
LEMONMOD_0x14df15.innerHTML = atob("LmZhZGUtb3V0IHsKCXZpc2liaWxpdHk6IGhpZGRlbjsKICAgIG9wYWNpdHk6IDA7CiAgICB0cmFuc2l0aW9uOiB2aXNpYmlsaXR5IDBzIDAuOXMsIG9wYWNpdHkgMC45cyBsaW5lYXI7Cn0KQC13ZWJraXQta2V5ZnJhbWVzIHNsaWRlIHsKICAgIDEwMCUgeyByaWdodDogMTBweDsgfQp9CkBrZXlmcmFtZXMgc2xpZGUgewogICAgMTAwJSB7IHJpZ2h0OiAxMHB4OyB9Cn0KLm5vdGlmaWNhdGlvbiB7CiAgICB3aWR0aDogMzYwcHg7CiAgICBoZWlnaHQ6IDQwcHg7CiAgICB6LWluZGV4OiA5MDAwOwogICAgcG9zaXRpb246IGZpeGVkOwoJcmlnaHQ6IC0xMDBweDsKCS13ZWJraXQtYW5pbWF0aW9uOiBzbGlkZSAwLjVzIGZvcndhcmRzOwogICAgLXdlYmtpdC1hbmltYXRpb24tZGVsYXk6IDJzOwogICAgYW5pbWF0aW9uOiBzbGlkZSAwLjVzIGZvcndhcmRzOwogICAgYW5pbWF0aW9uLWRlbGF5OiAwczsKICAgIGJveC1zaGFkb3c6IDAgMnB4IDVweCAwIHJnYmEoMCwgMCwgMCwgMC4xNiksIDAgMnB4IDEwcHggMCByZ2JhKDAsIDAsIDAsIDAuMTIpOwogICAgcGFkZGluZzogMjBweDsKICAgIG1hcmdpbjogMC41cmVtIDAgMXJlbSAwOwogICAgYm9yZGVyLXJhZGl1czogOHB4OwogICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmZjsKfQoubm90aWZpY2F0aW9uIC5kaXNtaXNzIHsKICAgIHRvcDogMTBweDsKICAgIHJpZ2h0OiAxMHB4OwogICAgd2lkdGg6IDBweDsKICAgIGhlaWdodDogMHB4OwogICAgY29sb3I6ICNmZmY7CiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7CiAgICBsaW5lLWhlaWdodDogMjBweDsKICAgIG92ZXJmbG93OiBoaWRkZW47CiAgICBwb3NpdGlvbjogYWJzb2x1dGU7CiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkZGOwogICAgYm9yZGVyLXJhZGl1czogNTAlOwp9Ci5ub3RpZmljYXRpb24gLmlsbHVzdHJhdGlvbiB7CiAgICBtYXJnaW4tcmlnaHQ6IDIwcHg7CiAgICBmbG9hdDogbGVmdDsKfQoubm90aWZpY2F0aW9uIC5pbGx1c3RyYXRpb24gaW1nIHsKICAgIGJvcmRlci1yYWRpdXM6IDAlOwp9Ci5ub3RpZmljYXRpb24gLnRleHQgLnRpdGxlIHsKICAgIGZvbnQtc2l6ZTogMThweDsKICAgIGZvbnQtd2VpZ2h0OiBib2xkOwp9Cg==");
document.head.appendChild(LEMONMOD_0x14df15);
var LEMONMOD_0x2b13b9 = document.createElement("style");
LEMONMOD_0x2b13b9.innerHTML = ":root{--animate-duration:1s;--animate-delay:1s;--animate-repeat:1}.animate__animated{-webkit-animation-duration:1s;animation-duration:1s;-webkit-animation-duration:var(--animate-duration);animation-duration:var(--animate-duration);-webkit-animation-fill-mode:both;animation-fill-mode:both}.animate__animated.animate__infinite{-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}.animate__animated.animate__repeat-1{-webkit-animation-iteration-count:1;animation-iteration-count:1;-webkit-animation-iteration-count:var(--animate-repeat);animation-iteration-count:var(--animate-repeat)}.animate__animated.animate__repeat-2{-webkit-animation-iteration-count:2;animation-iteration-count:2;-webkit-animation-iteration-count:calc(var(--animate-repeat)*2);animation-iteration-count:calc(var(--animate-repeat)*2)}.animate__animated.animate__repeat-3{-webkit-animation-iteration-count:3;animation-iteration-count:3;-webkit-animation-iteration-count:calc(var(--animate-repeat)*3);animation-iteration-count:calc(var(--animate-repeat)*3)}.animate__animated.animate__delay-1s{-webkit-animation-delay:1s;animation-delay:1s;-webkit-animation-delay:var(--animate-delay);animation-delay:var(--animate-delay)}.animate__animated.animate__delay-2s{-webkit-animation-delay:2s;animation-delay:2s;-webkit-animation-delay:calc(var(--animate-delay)*2);animation-delay:calc(var(--animate-delay)*2)}.animate__animated.animate__delay-3s{-webkit-animation-delay:3s;animation-delay:3s;-webkit-animation-delay:calc(var(--animate-delay)*3);animation-delay:calc(var(--animate-delay)*3)}.animate__animated.animate__delay-4s{-webkit-animation-delay:4s;animation-delay:4s;-webkit-animation-delay:calc(var(--animate-delay)*4);animation-delay:calc(var(--animate-delay)*4)}.animate__animated.animate__delay-5s{-webkit-animation-delay:5s;animation-delay:5s;-webkit-animation-delay:calc(var(--animate-delay)*5);animation-delay:calc(var(--animate-delay)*5)}.animate__animated.animate__faster{-webkit-animation-duration:.5s;animation-duration:.5s;-webkit-animation-duration:calc(var(--animate-duration)/2);animation-duration:calc(var(--animate-duration)/2)}.animate__animated.animate__fast{-webkit-animation-duration:.8s;animation-duration:.8s;-webkit-animation-duration:calc(var(--animate-duration)*.8);animation-duration:calc(var(--animate-duration)*.8)}.animate__animated.animate__slow{-webkit-animation-duration:2s;animation-duration:2s;-webkit-animation-duration:calc(var(--animate-duration)*2);animation-duration:calc(var(--animate-duration)*2)}.animate__animated.animate__slower{-webkit-animation-duration:3s;animation-duration:3s;-webkit-animation-duration:calc(var(--animate-duration)*3);animation-duration:calc(var(--animate-duration)*3)}@media (prefers-reduced-motion:reduce),print{.animate__animated{-webkit-animation-duration:1ms!important;animation-duration:1ms!important;-webkit-animation-iteration-count:1!important;animation-iteration-count:1!important;-webkit-transition-duration:1ms!important;transition-duration:1ms!important}.animate__animated[class*=Out]{opacity:0}}@-webkit-keyframes bounce{0%,20%,53%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1);-webkit-transform:translateZ(0);transform:translateZ(0)}40%,43%{-webkit-animation-timing-function:cubic-bezier(.755,.05,.855,.06);animation-timing-function:cubic-bezier(.755,.05,.855,.06);-webkit-transform:translate3d(0,-30px,0) scaleY(1.1);transform:translate3d(0,-30px,0) scaleY(1.1)}70%{-webkit-animation-timing-function:cubic-bezier(.755,.05,.855,.06);animation-timing-function:cubic-bezier(.755,.05,.855,.06);-webkit-transform:translate3d(0,-15px,0) scaleY(1.05);transform:translate3d(0,-15px,0) scaleY(1.05)}80%{-webkit-transform:translateZ(0) scaleY(.95);transform:translateZ(0) scaleY(.95);-webkit-transition-timing-function:cubic-bezier(.215,.61,.355,1);transition-timing-function:cubic-bezier(.215,.61,.355,1)}90%{-webkit-transform:translate3d(0,-4px,0) scaleY(1.02);transform:translate3d(0,-4px,0) scaleY(1.02)}}@keyframes bounce{0%,20%,53%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1);-webkit-transform:translateZ(0);transform:translateZ(0)}40%,43%{-webkit-animation-timing-function:cubic-bezier(.755,.05,.855,.06);animation-timing-function:cubic-bezier(.755,.05,.855,.06);-webkit-transform:translate3d(0,-30px,0) scaleY(1.1);transform:translate3d(0,-30px,0) scaleY(1.1)}70%{-webkit-animation-timing-function:cubic-bezier(.755,.05,.855,.06);animation-timing-function:cubic-bezier(.755,.05,.855,.06);-webkit-transform:translate3d(0,-15px,0) scaleY(1.05);transform:translate3d(0,-15px,0) scaleY(1.05)}80%{-webkit-transform:translateZ(0) scaleY(.95);transform:translateZ(0) scaleY(.95);-webkit-transition-timing-function:cubic-bezier(.215,.61,.355,1);transition-timing-function:cubic-bezier(.215,.61,.355,1)}90%{-webkit-transform:translate3d(0,-4px,0) scaleY(1.02);transform:translate3d(0,-4px,0) scaleY(1.02)}}.animate__bounce{-webkit-animation-name:bounce;animation-name:bounce;-webkit-transform-origin:center bottom;transform-origin:center bottom}@-webkit-keyframes flash{0%,50%,to{opacity:1}25%,75%{opacity:0}}@keyframes flash{0%,50%,to{opacity:1}25%,75%{opacity:0}}.animate__flash{-webkit-animation-name:flash;animation-name:flash}@-webkit-keyframes pulse{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}50%{-webkit-transform:scale3d(1.05,1.05,1.05);transform:scale3d(1.05,1.05,1.05)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}@keyframes pulse{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}50%{-webkit-transform:scale3d(1.05,1.05,1.05);transform:scale3d(1.05,1.05,1.05)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}.animate__pulse{-webkit-animation-name:pulse;animation-name:pulse;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}@-webkit-keyframes rubberBand{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}30%{-webkit-transform:scale3d(1.25,.75,1);transform:scale3d(1.25,.75,1)}40%{-webkit-transform:scale3d(.75,1.25,1);transform:scale3d(.75,1.25,1)}50%{-webkit-transform:scale3d(1.15,.85,1);transform:scale3d(1.15,.85,1)}65%{-webkit-transform:scale3d(.95,1.05,1);transform:scale3d(.95,1.05,1)}75%{-webkit-transform:scale3d(1.05,.95,1);transform:scale3d(1.05,.95,1)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}@keyframes rubberBand{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}30%{-webkit-transform:scale3d(1.25,.75,1);transform:scale3d(1.25,.75,1)}40%{-webkit-transform:scale3d(.75,1.25,1);transform:scale3d(.75,1.25,1)}50%{-webkit-transform:scale3d(1.15,.85,1);transform:scale3d(1.15,.85,1)}65%{-webkit-transform:scale3d(.95,1.05,1);transform:scale3d(.95,1.05,1)}75%{-webkit-transform:scale3d(1.05,.95,1);transform:scale3d(1.05,.95,1)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}.animate__rubberBand{-webkit-animation-name:rubberBand;animation-name:rubberBand}@-webkit-keyframes shakeX{0%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}10%,30%,50%,70%,90%{-webkit-transform:translate3d(-10px,0,0);transform:translate3d(-10px,0,0)}20%,40%,60%,80%{-webkit-transform:translate3d(10px,0,0);transform:translate3d(10px,0,0)}}@keyframes shakeX{0%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}10%,30%,50%,70%,90%{-webkit-transform:translate3d(-10px,0,0);transform:translate3d(-10px,0,0)}20%,40%,60%,80%{-webkit-transform:translate3d(10px,0,0);transform:translate3d(10px,0,0)}}.animate__shakeX{-webkit-animation-name:shakeX;animation-name:shakeX}@-webkit-keyframes shakeY{0%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}10%,30%,50%,70%,90%{-webkit-transform:translate3d(0,-10px,0);transform:translate3d(0,-10px,0)}20%,40%,60%,80%{-webkit-transform:translate3d(0,10px,0);transform:translate3d(0,10px,0)}}@keyframes shakeY{0%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}10%,30%,50%,70%,90%{-webkit-transform:translate3d(0,-10px,0);transform:translate3d(0,-10px,0)}20%,40%,60%,80%{-webkit-transform:translate3d(0,10px,0);transform:translate3d(0,10px,0)}}.animate__shakeY{-webkit-animation-name:shakeY;animation-name:shakeY}@-webkit-keyframes headShake{0%{-webkit-transform:translateX(0);transform:translateX(0)}6.5%{-webkit-transform:translateX(-6px) rotateY(-9deg);transform:translateX(-6px) rotateY(-9deg)}18.5%{-webkit-transform:translateX(5px) rotateY(7deg);transform:translateX(5px) rotateY(7deg)}31.5%{-webkit-transform:translateX(-3px) rotateY(-5deg);transform:translateX(-3px) rotateY(-5deg)}43.5%{-webkit-transform:translateX(2px) rotateY(3deg);transform:translateX(2px) rotateY(3deg)}50%{-webkit-transform:translateX(0);transform:translateX(0)}}@keyframes headShake{0%{-webkit-transform:translateX(0);transform:translateX(0)}6.5%{-webkit-transform:translateX(-6px) rotateY(-9deg);transform:translateX(-6px) rotateY(-9deg)}18.5%{-webkit-transform:translateX(5px) rotateY(7deg);transform:translateX(5px) rotateY(7deg)}31.5%{-webkit-transform:translateX(-3px) rotateY(-5deg);transform:translateX(-3px) rotateY(-5deg)}43.5%{-webkit-transform:translateX(2px) rotateY(3deg);transform:translateX(2px) rotateY(3deg)}50%{-webkit-transform:translateX(0);transform:translateX(0)}}.animate__headShake{-webkit-animation-name:headShake;animation-name:headShake;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}@-webkit-keyframes swing{20%{-webkit-transform:rotate(15deg);transform:rotate(15deg)}40%{-webkit-transform:rotate(-10deg);transform:rotate(-10deg)}60%{-webkit-transform:rotate(5deg);transform:rotate(5deg)}80%{-webkit-transform:rotate(-5deg);transform:rotate(-5deg)}to{-webkit-transform:rotate(0deg);transform:rotate(0deg)}}@keyframes swing{20%{-webkit-transform:rotate(15deg);transform:rotate(15deg)}40%{-webkit-transform:rotate(-10deg);transform:rotate(-10deg)}60%{-webkit-transform:rotate(5deg);transform:rotate(5deg)}80%{-webkit-transform:rotate(-5deg);transform:rotate(-5deg)}to{-webkit-transform:rotate(0deg);transform:rotate(0deg)}}.animate__swing{-webkit-animation-name:swing;animation-name:swing;-webkit-transform-origin:top center;transform-origin:top center}@-webkit-keyframes tada{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}10%,20%{-webkit-transform:scale3d(.9,.9,.9) rotate(-3deg);transform:scale3d(.9,.9,.9) rotate(-3deg)}30%,50%,70%,90%{-webkit-transform:scale3d(1.1,1.1,1.1) rotate(3deg);transform:scale3d(1.1,1.1,1.1) rotate(3deg)}40%,60%,80%{-webkit-transform:scale3d(1.1,1.1,1.1) rotate(-3deg);transform:scale3d(1.1,1.1,1.1) rotate(-3deg)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}@keyframes tada{0%{-webkit-transform:scaleX(1);transform:scaleX(1)}10%,20%{-webkit-transform:scale3d(.9,.9,.9) rotate(-3deg);transform:scale3d(.9,.9,.9) rotate(-3deg)}30%,50%,70%,90%{-webkit-transform:scale3d(1.1,1.1,1.1) rotate(3deg);transform:scale3d(1.1,1.1,1.1) rotate(3deg)}40%,60%,80%{-webkit-transform:scale3d(1.1,1.1,1.1) rotate(-3deg);transform:scale3d(1.1,1.1,1.1) rotate(-3deg)}to{-webkit-transform:scaleX(1);transform:scaleX(1)}}.animate__tada{-webkit-animation-name:tada;animation-name:tada}@-webkit-keyframes wobble{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-25%,0,0) rotate(-5deg);transform:translate3d(-25%,0,0) rotate(-5deg)}30%{-webkit-transform:translate3d(20%,0,0) rotate(3deg);transform:translate3d(20%,0,0) rotate(3deg)}45%{-webkit-transform:translate3d(-15%,0,0) rotate(-3deg);transform:translate3d(-15%,0,0) rotate(-3deg)}60%{-webkit-transform:translate3d(10%,0,0) rotate(2deg);transform:translate3d(10%,0,0) rotate(2deg)}75%{-webkit-transform:translate3d(-5%,0,0) rotate(-1deg);transform:translate3d(-5%,0,0) rotate(-1deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes wobble{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}15%{-webkit-transform:translate3d(-25%,0,0) rotate(-5deg);transform:translate3d(-25%,0,0) rotate(-5deg)}30%{-webkit-transform:translate3d(20%,0,0) rotate(3deg);transform:translate3d(20%,0,0) rotate(3deg)}45%{-webkit-transform:translate3d(-15%,0,0) rotate(-3deg);transform:translate3d(-15%,0,0) rotate(-3deg)}60%{-webkit-transform:translate3d(10%,0,0) rotate(2deg);transform:translate3d(10%,0,0) rotate(2deg)}75%{-webkit-transform:translate3d(-5%,0,0) rotate(-1deg);transform:translate3d(-5%,0,0) rotate(-1deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__wobble{-webkit-animation-name:wobble;animation-name:wobble}@-webkit-keyframes jello{0%,11.1%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}22.2%{-webkit-transform:skewX(-12.5deg) skewY(-12.5deg);transform:skewX(-12.5deg) skewY(-12.5deg)}33.3%{-webkit-transform:skewX(6.25deg) skewY(6.25deg);transform:skewX(6.25deg) skewY(6.25deg)}44.4%{-webkit-transform:skewX(-3.125deg) skewY(-3.125deg);transform:skewX(-3.125deg) skewY(-3.125deg)}55.5%{-webkit-transform:skewX(1.5625deg) skewY(1.5625deg);transform:skewX(1.5625deg) skewY(1.5625deg)}66.6%{-webkit-transform:skewX(-.78125deg) skewY(-.78125deg);transform:skewX(-.78125deg) skewY(-.78125deg)}77.7%{-webkit-transform:skewX(.390625deg) skewY(.390625deg);transform:skewX(.390625deg) skewY(.390625deg)}88.8%{-webkit-transform:skewX(-.1953125deg) skewY(-.1953125deg);transform:skewX(-.1953125deg) skewY(-.1953125deg)}}@keyframes jello{0%,11.1%,to{-webkit-transform:translateZ(0);transform:translateZ(0)}22.2%{-webkit-transform:skewX(-12.5deg) skewY(-12.5deg);transform:skewX(-12.5deg) skewY(-12.5deg)}33.3%{-webkit-transform:skewX(6.25deg) skewY(6.25deg);transform:skewX(6.25deg) skewY(6.25deg)}44.4%{-webkit-transform:skewX(-3.125deg) skewY(-3.125deg);transform:skewX(-3.125deg) skewY(-3.125deg)}55.5%{-webkit-transform:skewX(1.5625deg) skewY(1.5625deg);transform:skewX(1.5625deg) skewY(1.5625deg)}66.6%{-webkit-transform:skewX(-.78125deg) skewY(-.78125deg);transform:skewX(-.78125deg) skewY(-.78125deg)}77.7%{-webkit-transform:skewX(.390625deg) skewY(.390625deg);transform:skewX(.390625deg) skewY(.390625deg)}88.8%{-webkit-transform:skewX(-.1953125deg) skewY(-.1953125deg);transform:skewX(-.1953125deg) skewY(-.1953125deg)}}.animate__jello{-webkit-animation-name:jello;animation-name:jello;-webkit-transform-origin:center;transform-origin:center}@-webkit-keyframes heartBeat{0%{-webkit-transform:scale(1);transform:scale(1)}14%{-webkit-transform:scale(1.3);transform:scale(1.3)}28%{-webkit-transform:scale(1);transform:scale(1)}42%{-webkit-transform:scale(1.3);transform:scale(1.3)}70%{-webkit-transform:scale(1);transform:scale(1)}}@keyframes heartBeat{0%{-webkit-transform:scale(1);transform:scale(1)}14%{-webkit-transform:scale(1.3);transform:scale(1.3)}28%{-webkit-transform:scale(1);transform:scale(1)}42%{-webkit-transform:scale(1.3);transform:scale(1.3)}70%{-webkit-transform:scale(1);transform:scale(1)}}.animate__heartBeat{-webkit-animation-duration:1.3s;animation-duration:1.3s;-webkit-animation-duration:calc(var(--animate-duration)*1.3);animation-duration:calc(var(--animate-duration)*1.3);-webkit-animation-name:heartBeat;animation-name:heartBeat;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}@-webkit-keyframes backInDown{0%{opacity:.7;-webkit-transform:translateY(-1200px) scale(.7);transform:translateY(-1200px) scale(.7)}80%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}@keyframes backInDown{0%{opacity:.7;-webkit-transform:translateY(-1200px) scale(.7);transform:translateY(-1200px) scale(.7)}80%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}.animate__backInDown{-webkit-animation-name:backInDown;animation-name:backInDown}@-webkit-keyframes backInLeft{0%{opacity:.7;-webkit-transform:translateX(-2000px) scale(.7);transform:translateX(-2000px) scale(.7)}80%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}@keyframes backInLeft{0%{opacity:.7;-webkit-transform:translateX(-2000px) scale(.7);transform:translateX(-2000px) scale(.7)}80%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}.animate__backInLeft{-webkit-animation-name:backInLeft;animation-name:backInLeft}@-webkit-keyframes backInRight{0%{opacity:.7;-webkit-transform:translateX(2000px) scale(.7);transform:translateX(2000px) scale(.7)}80%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}@keyframes backInRight{0%{opacity:.7;-webkit-transform:translateX(2000px) scale(.7);transform:translateX(2000px) scale(.7)}80%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}.animate__backInRight{-webkit-animation-name:backInRight;animation-name:backInRight}@-webkit-keyframes backInUp{0%{opacity:.7;-webkit-transform:translateY(1200px) scale(.7);transform:translateY(1200px) scale(.7)}80%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}@keyframes backInUp{0%{opacity:.7;-webkit-transform:translateY(1200px) scale(.7);transform:translateY(1200px) scale(.7)}80%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}.animate__backInUp{-webkit-animation-name:backInUp;animation-name:backInUp}@-webkit-keyframes backOutDown{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:.7;-webkit-transform:translateY(700px) scale(.7);transform:translateY(700px) scale(.7)}}@keyframes backOutDown{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:.7;-webkit-transform:translateY(700px) scale(.7);transform:translateY(700px) scale(.7)}}.animate__backOutDown{-webkit-animation-name:backOutDown;animation-name:backOutDown}@-webkit-keyframes backOutLeft{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:.7;-webkit-transform:translateX(-2000px) scale(.7);transform:translateX(-2000px) scale(.7)}}@keyframes backOutLeft{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:.7;-webkit-transform:translateX(-2000px) scale(.7);transform:translateX(-2000px) scale(.7)}}.animate__backOutLeft{-webkit-animation-name:backOutLeft;animation-name:backOutLeft}@-webkit-keyframes backOutRight{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:.7;-webkit-transform:translateX(2000px) scale(.7);transform:translateX(2000px) scale(.7)}}@keyframes backOutRight{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateX(0) scale(.7);transform:translateX(0) scale(.7)}to{opacity:.7;-webkit-transform:translateX(2000px) scale(.7);transform:translateX(2000px) scale(.7)}}.animate__backOutRight{-webkit-animation-name:backOutRight;animation-name:backOutRight}@-webkit-keyframes backOutUp{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:.7;-webkit-transform:translateY(-700px) scale(.7);transform:translateY(-700px) scale(.7)}}@keyframes backOutUp{0%{opacity:1;-webkit-transform:scale(1);transform:scale(1)}20%{opacity:.7;-webkit-transform:translateY(0) scale(.7);transform:translateY(0) scale(.7)}to{opacity:.7;-webkit-transform:translateY(-700px) scale(.7);transform:translateY(-700px) scale(.7)}}.animate__backOutUp{-webkit-animation-name:backOutUp;animation-name:backOutUp}@-webkit-keyframes bounceIn{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}20%{-webkit-transform:scale3d(1.1,1.1,1.1);transform:scale3d(1.1,1.1,1.1)}40%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}60%{opacity:1;-webkit-transform:scale3d(1.03,1.03,1.03);transform:scale3d(1.03,1.03,1.03)}80%{-webkit-transform:scale3d(.97,.97,.97);transform:scale3d(.97,.97,.97)}to{opacity:1;-webkit-transform:scaleX(1);transform:scaleX(1)}}@keyframes bounceIn{0%,20%,40%,60%,80%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}20%{-webkit-transform:scale3d(1.1,1.1,1.1);transform:scale3d(1.1,1.1,1.1)}40%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}60%{opacity:1;-webkit-transform:scale3d(1.03,1.03,1.03);transform:scale3d(1.03,1.03,1.03)}80%{-webkit-transform:scale3d(.97,.97,.97);transform:scale3d(.97,.97,.97)}to{opacity:1;-webkit-transform:scaleX(1);transform:scaleX(1)}}.animate__bounceIn{-webkit-animation-duration:.75s;animation-duration:.75s;-webkit-animation-duration:calc(var(--animate-duration)*.75);animation-duration:calc(var(--animate-duration)*.75);-webkit-animation-name:bounceIn;animation-name:bounceIn}@-webkit-keyframes bounceInDown{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(0,-3000px,0) scaleY(3);transform:translate3d(0,-3000px,0) scaleY(3)}60%{opacity:1;-webkit-transform:translate3d(0,25px,0) scaleY(.9);transform:translate3d(0,25px,0) scaleY(.9)}75%{-webkit-transform:translate3d(0,-10px,0) scaleY(.95);transform:translate3d(0,-10px,0) scaleY(.95)}90%{-webkit-transform:translate3d(0,5px,0) scaleY(.985);transform:translate3d(0,5px,0) scaleY(.985)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes bounceInDown{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(0,-3000px,0) scaleY(3);transform:translate3d(0,-3000px,0) scaleY(3)}60%{opacity:1;-webkit-transform:translate3d(0,25px,0) scaleY(.9);transform:translate3d(0,25px,0) scaleY(.9)}75%{-webkit-transform:translate3d(0,-10px,0) scaleY(.95);transform:translate3d(0,-10px,0) scaleY(.95)}90%{-webkit-transform:translate3d(0,5px,0) scaleY(.985);transform:translate3d(0,5px,0) scaleY(.985)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__bounceInDown{-webkit-animation-name:bounceInDown;animation-name:bounceInDown}@-webkit-keyframes bounceInLeft{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(-3000px,0,0) scaleX(3);transform:translate3d(-3000px,0,0) scaleX(3)}60%{opacity:1;-webkit-transform:translate3d(25px,0,0) scaleX(1);transform:translate3d(25px,0,0) scaleX(1)}75%{-webkit-transform:translate3d(-10px,0,0) scaleX(.98);transform:translate3d(-10px,0,0) scaleX(.98)}90%{-webkit-transform:translate3d(5px,0,0) scaleX(.995);transform:translate3d(5px,0,0) scaleX(.995)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes bounceInLeft{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(-3000px,0,0) scaleX(3);transform:translate3d(-3000px,0,0) scaleX(3)}60%{opacity:1;-webkit-transform:translate3d(25px,0,0) scaleX(1);transform:translate3d(25px,0,0) scaleX(1)}75%{-webkit-transform:translate3d(-10px,0,0) scaleX(.98);transform:translate3d(-10px,0,0) scaleX(.98)}90%{-webkit-transform:translate3d(5px,0,0) scaleX(.995);transform:translate3d(5px,0,0) scaleX(.995)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__bounceInLeft{-webkit-animation-name:bounceInLeft;animation-name:bounceInLeft}@-webkit-keyframes bounceInRight{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(3000px,0,0) scaleX(3);transform:translate3d(3000px,0,0) scaleX(3)}60%{opacity:1;-webkit-transform:translate3d(-25px,0,0) scaleX(1);transform:translate3d(-25px,0,0) scaleX(1)}75%{-webkit-transform:translate3d(10px,0,0) scaleX(.98);transform:translate3d(10px,0,0) scaleX(.98)}90%{-webkit-transform:translate3d(-5px,0,0) scaleX(.995);transform:translate3d(-5px,0,0) scaleX(.995)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes bounceInRight{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(3000px,0,0) scaleX(3);transform:translate3d(3000px,0,0) scaleX(3)}60%{opacity:1;-webkit-transform:translate3d(-25px,0,0) scaleX(1);transform:translate3d(-25px,0,0) scaleX(1)}75%{-webkit-transform:translate3d(10px,0,0) scaleX(.98);transform:translate3d(10px,0,0) scaleX(.98)}90%{-webkit-transform:translate3d(-5px,0,0) scaleX(.995);transform:translate3d(-5px,0,0) scaleX(.995)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__bounceInRight{-webkit-animation-name:bounceInRight;animation-name:bounceInRight}@-webkit-keyframes bounceInUp{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(0,3000px,0) scaleY(5);transform:translate3d(0,3000px,0) scaleY(5)}60%{opacity:1;-webkit-transform:translate3d(0,-20px,0) scaleY(.9);transform:translate3d(0,-20px,0) scaleY(.9)}75%{-webkit-transform:translate3d(0,10px,0) scaleY(.95);transform:translate3d(0,10px,0) scaleY(.95)}90%{-webkit-transform:translate3d(0,-5px,0) scaleY(.985);transform:translate3d(0,-5px,0) scaleY(.985)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes bounceInUp{0%,60%,75%,90%,to{-webkit-animation-timing-function:cubic-bezier(.215,.61,.355,1);animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;-webkit-transform:translate3d(0,3000px,0) scaleY(5);transform:translate3d(0,3000px,0) scaleY(5)}60%{opacity:1;-webkit-transform:translate3d(0,-20px,0) scaleY(.9);transform:translate3d(0,-20px,0) scaleY(.9)}75%{-webkit-transform:translate3d(0,10px,0) scaleY(.95);transform:translate3d(0,10px,0) scaleY(.95)}90%{-webkit-transform:translate3d(0,-5px,0) scaleY(.985);transform:translate3d(0,-5px,0) scaleY(.985)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__bounceInUp{-webkit-animation-name:bounceInUp;animation-name:bounceInUp}@-webkit-keyframes bounceOut{20%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}50%,55%{opacity:1;-webkit-transform:scale3d(1.1,1.1,1.1);transform:scale3d(1.1,1.1,1.1)}to{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}}@keyframes bounceOut{20%{-webkit-transform:scale3d(.9,.9,.9);transform:scale3d(.9,.9,.9)}50%,55%{opacity:1;-webkit-transform:scale3d(1.1,1.1,1.1);transform:scale3d(1.1,1.1,1.1)}to{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}}.animate__bounceOut{-webkit-animation-duration:.75s;animation-duration:.75s;-webkit-animation-duration:calc(var(--animate-duration)*.75);animation-duration:calc(var(--animate-duration)*.75);-webkit-animation-name:bounceOut;animation-name:bounceOut}@-webkit-keyframes bounceOutDown{20%{-webkit-transform:translate3d(0,10px,0) scaleY(.985);transform:translate3d(0,10px,0) scaleY(.985)}40%,45%{opacity:1;-webkit-transform:translate3d(0,-20px,0) scaleY(.9);transform:translate3d(0,-20px,0) scaleY(.9)}to{opacity:0;-webkit-transform:translate3d(0,2000px,0) scaleY(3);transform:translate3d(0,2000px,0) scaleY(3)}}@keyframes bounceOutDown{20%{-webkit-transform:translate3d(0,10px,0) scaleY(.985);transform:translate3d(0,10px,0) scaleY(.985)}40%,45%{opacity:1;-webkit-transform:translate3d(0,-20px,0) scaleY(.9);transform:translate3d(0,-20px,0) scaleY(.9)}to{opacity:0;-webkit-transform:translate3d(0,2000px,0) scaleY(3);transform:translate3d(0,2000px,0) scaleY(3)}}.animate__bounceOutDown{-webkit-animation-name:bounceOutDown;animation-name:bounceOutDown}@-webkit-keyframes bounceOutLeft{20%{opacity:1;-webkit-transform:translate3d(20px,0,0) scaleX(.9);transform:translate3d(20px,0,0) scaleX(.9)}to{opacity:0;-webkit-transform:translate3d(-2000px,0,0) scaleX(2);transform:translate3d(-2000px,0,0) scaleX(2)}}@keyframes bounceOutLeft{20%{opacity:1;-webkit-transform:translate3d(20px,0,0) scaleX(.9);transform:translate3d(20px,0,0) scaleX(.9)}to{opacity:0;-webkit-transform:translate3d(-2000px,0,0) scaleX(2);transform:translate3d(-2000px,0,0) scaleX(2)}}.animate__bounceOutLeft{-webkit-animation-name:bounceOutLeft;animation-name:bounceOutLeft}@-webkit-keyframes bounceOutRight{20%{opacity:1;-webkit-transform:translate3d(-20px,0,0) scaleX(.9);transform:translate3d(-20px,0,0) scaleX(.9)}to{opacity:0;-webkit-transform:translate3d(2000px,0,0) scaleX(2);transform:translate3d(2000px,0,0) scaleX(2)}}@keyframes bounceOutRight{20%{opacity:1;-webkit-transform:translate3d(-20px,0,0) scaleX(.9);transform:translate3d(-20px,0,0) scaleX(.9)}to{opacity:0;-webkit-transform:translate3d(2000px,0,0) scaleX(2);transform:translate3d(2000px,0,0) scaleX(2)}}.animate__bounceOutRight{-webkit-animation-name:bounceOutRight;animation-name:bounceOutRight}@-webkit-keyframes bounceOutUp{20%{-webkit-transform:translate3d(0,-10px,0) scaleY(.985);transform:translate3d(0,-10px,0) scaleY(.985)}40%,45%{opacity:1;-webkit-transform:translate3d(0,20px,0) scaleY(.9);transform:translate3d(0,20px,0) scaleY(.9)}to{opacity:0;-webkit-transform:translate3d(0,-2000px,0) scaleY(3);transform:translate3d(0,-2000px,0) scaleY(3)}}@keyframes bounceOutUp{20%{-webkit-transform:translate3d(0,-10px,0) scaleY(.985);transform:translate3d(0,-10px,0) scaleY(.985)}40%,45%{opacity:1;-webkit-transform:translate3d(0,20px,0) scaleY(.9);transform:translate3d(0,20px,0) scaleY(.9)}to{opacity:0;-webkit-transform:translate3d(0,-2000px,0) scaleY(3);transform:translate3d(0,-2000px,0) scaleY(3)}}.animate__bounceOutUp{-webkit-animation-name:bounceOutUp;animation-name:bounceOutUp}@-webkit-keyframes fadeIn{0%{opacity:0}to{opacity:1}}@keyframes fadeIn{0%{opacity:0}to{opacity:1}}.animate__fadeIn{-webkit-animation-name:fadeIn;animation-name:fadeIn}@-webkit-keyframes fadeInDown{0%{opacity:0;-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInDown{0%{opacity:0;-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInDown{-webkit-animation-name:fadeInDown;animation-name:fadeInDown}@-webkit-keyframes fadeInDownBig{0%{opacity:0;-webkit-transform:translate3d(0,-2000px,0);transform:translate3d(0,-2000px,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInDownBig{0%{opacity:0;-webkit-transform:translate3d(0,-2000px,0);transform:translate3d(0,-2000px,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInDownBig{-webkit-animation-name:fadeInDownBig;animation-name:fadeInDownBig}@-webkit-keyframes fadeInLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInLeft{-webkit-animation-name:fadeInLeft;animation-name:fadeInLeft}@-webkit-keyframes fadeInLeftBig{0%{opacity:0;-webkit-transform:translate3d(-2000px,0,0);transform:translate3d(-2000px,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInLeftBig{0%{opacity:0;-webkit-transform:translate3d(-2000px,0,0);transform:translate3d(-2000px,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInLeftBig{-webkit-animation-name:fadeInLeftBig;animation-name:fadeInLeftBig}@-webkit-keyframes fadeInRight{0%{opacity:0;-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInRight{0%{opacity:0;-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInRight{-webkit-animation-name:fadeInRight;animation-name:fadeInRight}@-webkit-keyframes fadeInRightBig{0%{opacity:0;-webkit-transform:translate3d(2000px,0,0);transform:translate3d(2000px,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInRightBig{0%{opacity:0;-webkit-transform:translate3d(2000px,0,0);transform:translate3d(2000px,0,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInRightBig{-webkit-animation-name:fadeInRightBig;animation-name:fadeInRightBig}@-webkit-keyframes fadeInUp{0%{opacity:0;-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInUp{0%{opacity:0;-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInUp{-webkit-animation-name:fadeInUp;animation-name:fadeInUp}@-webkit-keyframes fadeInUpBig{0%{opacity:0;-webkit-transform:translate3d(0,2000px,0);transform:translate3d(0,2000px,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInUpBig{0%{opacity:0;-webkit-transform:translate3d(0,2000px,0);transform:translate3d(0,2000px,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInUpBig{-webkit-animation-name:fadeInUpBig;animation-name:fadeInUpBig}@-webkit-keyframes fadeInTopLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,-100%,0);transform:translate3d(-100%,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInTopLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,-100%,0);transform:translate3d(-100%,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInTopLeft{-webkit-animation-name:fadeInTopLeft;animation-name:fadeInTopLeft}@-webkit-keyframes fadeInTopRight{0%{opacity:0;-webkit-transform:translate3d(100%,-100%,0);transform:translate3d(100%,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInTopRight{0%{opacity:0;-webkit-transform:translate3d(100%,-100%,0);transform:translate3d(100%,-100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInTopRight{-webkit-animation-name:fadeInTopRight;animation-name:fadeInTopRight}@-webkit-keyframes fadeInBottomLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,100%,0);transform:translate3d(-100%,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInBottomLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,100%,0);transform:translate3d(-100%,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInBottomLeft{-webkit-animation-name:fadeInBottomLeft;animation-name:fadeInBottomLeft}@-webkit-keyframes fadeInBottomRight{0%{opacity:0;-webkit-transform:translate3d(100%,100%,0);transform:translate3d(100%,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes fadeInBottomRight{0%{opacity:0;-webkit-transform:translate3d(100%,100%,0);transform:translate3d(100%,100%,0)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__fadeInBottomRight{-webkit-animation-name:fadeInBottomRight;animation-name:fadeInBottomRight}@-webkit-keyframes fadeOut{0%{opacity:1}to{opacity:0}}@keyframes fadeOut{0%{opacity:1}to{opacity:0}}.animate__fadeOut{-webkit-animation-name:fadeOut;animation-name:fadeOut}@-webkit-keyframes fadeOutDown{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0)}}@keyframes fadeOutDown{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0)}}.animate__fadeOutDown{-webkit-animation-name:fadeOutDown;animation-name:fadeOutDown}@-webkit-keyframes fadeOutDownBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,2000px,0);transform:translate3d(0,2000px,0)}}@keyframes fadeOutDownBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,2000px,0);transform:translate3d(0,2000px,0)}}.animate__fadeOutDownBig{-webkit-animation-name:fadeOutDownBig;animation-name:fadeOutDownBig}@-webkit-keyframes fadeOutLeft{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}}@keyframes fadeOutLeft{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}}.animate__fadeOutLeft{-webkit-animation-name:fadeOutLeft;animation-name:fadeOutLeft}@-webkit-keyframes fadeOutLeftBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-2000px,0,0);transform:translate3d(-2000px,0,0)}}@keyframes fadeOutLeftBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-2000px,0,0);transform:translate3d(-2000px,0,0)}}.animate__fadeOutLeftBig{-webkit-animation-name:fadeOutLeftBig;animation-name:fadeOutLeftBig}@-webkit-keyframes fadeOutRight{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}}@keyframes fadeOutRight{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}}.animate__fadeOutRight{-webkit-animation-name:fadeOutRight;animation-name:fadeOutRight}@-webkit-keyframes fadeOutRightBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(2000px,0,0);transform:translate3d(2000px,0,0)}}@keyframes fadeOutRightBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(2000px,0,0);transform:translate3d(2000px,0,0)}}.animate__fadeOutRightBig{-webkit-animation-name:fadeOutRightBig;animation-name:fadeOutRightBig}@-webkit-keyframes fadeOutUp{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0)}}@keyframes fadeOutUp{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0)}}.animate__fadeOutUp{-webkit-animation-name:fadeOutUp;animation-name:fadeOutUp}@-webkit-keyframes fadeOutUpBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,-2000px,0);transform:translate3d(0,-2000px,0)}}@keyframes fadeOutUpBig{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(0,-2000px,0);transform:translate3d(0,-2000px,0)}}.animate__fadeOutUpBig{-webkit-animation-name:fadeOutUpBig;animation-name:fadeOutUpBig}@-webkit-keyframes fadeOutTopLeft{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(-100%,-100%,0);transform:translate3d(-100%,-100%,0)}}@keyframes fadeOutTopLeft{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(-100%,-100%,0);transform:translate3d(-100%,-100%,0)}}.animate__fadeOutTopLeft{-webkit-animation-name:fadeOutTopLeft;animation-name:fadeOutTopLeft}@-webkit-keyframes fadeOutTopRight{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(100%,-100%,0);transform:translate3d(100%,-100%,0)}}@keyframes fadeOutTopRight{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(100%,-100%,0);transform:translate3d(100%,-100%,0)}}.animate__fadeOutTopRight{-webkit-animation-name:fadeOutTopRight;animation-name:fadeOutTopRight}@-webkit-keyframes fadeOutBottomRight{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(100%,100%,0);transform:translate3d(100%,100%,0)}}@keyframes fadeOutBottomRight{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(100%,100%,0);transform:translate3d(100%,100%,0)}}.animate__fadeOutBottomRight{-webkit-animation-name:fadeOutBottomRight;animation-name:fadeOutBottomRight}@-webkit-keyframes fadeOutBottomLeft{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(-100%,100%,0);transform:translate3d(-100%,100%,0)}}@keyframes fadeOutBottomLeft{0%{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}to{opacity:0;-webkit-transform:translate3d(-100%,100%,0);transform:translate3d(-100%,100%,0)}}.animate__fadeOutBottomLeft{-webkit-animation-name:fadeOutBottomLeft;animation-name:fadeOutBottomLeft}@-webkit-keyframes flip{0%{-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out;-webkit-transform:perspective(400px) scaleX(1) translateZ(0) rotateY(-1turn);transform:perspective(400px) scaleX(1) translateZ(0) rotateY(-1turn)}40%{-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out;-webkit-transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-190deg);transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-190deg)}50%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-170deg);transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-170deg)}80%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scale3d(.95,.95,.95) translateZ(0) rotateY(0deg);transform:perspective(400px) scale3d(.95,.95,.95) translateZ(0) rotateY(0deg)}to{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scaleX(1) translateZ(0) rotateY(0deg);transform:perspective(400px) scaleX(1) translateZ(0) rotateY(0deg)}}@keyframes flip{0%{-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out;-webkit-transform:perspective(400px) scaleX(1) translateZ(0) rotateY(-1turn);transform:perspective(400px) scaleX(1) translateZ(0) rotateY(-1turn)}40%{-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out;-webkit-transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-190deg);transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-190deg)}50%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-170deg);transform:perspective(400px) scaleX(1) translateZ(150px) rotateY(-170deg)}80%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scale3d(.95,.95,.95) translateZ(0) rotateY(0deg);transform:perspective(400px) scale3d(.95,.95,.95) translateZ(0) rotateY(0deg)}to{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) scaleX(1) translateZ(0) rotateY(0deg);transform:perspective(400px) scaleX(1) translateZ(0) rotateY(0deg)}}.animate__animated.animate__flip{-webkit-animation-name:flip;animation-name:flip;-webkit-backface-visibility:visible;backface-visibility:visible}@-webkit-keyframes flipInX{0%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;opacity:0;-webkit-transform:perspective(400px) rotateX(90deg);transform:perspective(400px) rotateX(90deg)}40%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) rotateX(-20deg);transform:perspective(400px) rotateX(-20deg)}60%{opacity:1;-webkit-transform:perspective(400px) rotateX(10deg);transform:perspective(400px) rotateX(10deg)}80%{-webkit-transform:perspective(400px) rotateX(-5deg);transform:perspective(400px) rotateX(-5deg)}to{-webkit-transform:perspective(400px);transform:perspective(400px)}}@keyframes flipInX{0%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;opacity:0;-webkit-transform:perspective(400px) rotateX(90deg);transform:perspective(400px) rotateX(90deg)}40%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) rotateX(-20deg);transform:perspective(400px) rotateX(-20deg)}60%{opacity:1;-webkit-transform:perspective(400px) rotateX(10deg);transform:perspective(400px) rotateX(10deg)}80%{-webkit-transform:perspective(400px) rotateX(-5deg);transform:perspective(400px) rotateX(-5deg)}to{-webkit-transform:perspective(400px);transform:perspective(400px)}}.animate__flipInX{-webkit-animation-name:flipInX;animation-name:flipInX;-webkit-backface-visibility:visible!important;backface-visibility:visible!important}@-webkit-keyframes flipInY{0%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;opacity:0;-webkit-transform:perspective(400px) rotateY(90deg);transform:perspective(400px) rotateY(90deg)}40%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) rotateY(-20deg);transform:perspective(400px) rotateY(-20deg)}60%{opacity:1;-webkit-transform:perspective(400px) rotateY(10deg);transform:perspective(400px) rotateY(10deg)}80%{-webkit-transform:perspective(400px) rotateY(-5deg);transform:perspective(400px) rotateY(-5deg)}to{-webkit-transform:perspective(400px);transform:perspective(400px)}}@keyframes flipInY{0%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;opacity:0;-webkit-transform:perspective(400px) rotateY(90deg);transform:perspective(400px) rotateY(90deg)}40%{-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in;-webkit-transform:perspective(400px) rotateY(-20deg);transform:perspective(400px) rotateY(-20deg)}60%{opacity:1;-webkit-transform:perspective(400px) rotateY(10deg);transform:perspective(400px) rotateY(10deg)}80%{-webkit-transform:perspective(400px) rotateY(-5deg);transform:perspective(400px) rotateY(-5deg)}to{-webkit-transform:perspective(400px);transform:perspective(400px)}}.animate__flipInY{-webkit-animation-name:flipInY;animation-name:flipInY;-webkit-backface-visibility:visible!important;backface-visibility:visible!important}@-webkit-keyframes flipOutX{0%{-webkit-transform:perspective(400px);transform:perspective(400px)}30%{opacity:1;-webkit-transform:perspective(400px) rotateX(-20deg);transform:perspective(400px) rotateX(-20deg)}to{opacity:0;-webkit-transform:perspective(400px) rotateX(90deg);transform:perspective(400px) rotateX(90deg)}}@keyframes flipOutX{0%{-webkit-transform:perspective(400px);transform:perspective(400px)}30%{opacity:1;-webkit-transform:perspective(400px) rotateX(-20deg);transform:perspective(400px) rotateX(-20deg)}to{opacity:0;-webkit-transform:perspective(400px) rotateX(90deg);transform:perspective(400px) rotateX(90deg)}}.animate__flipOutX{-webkit-animation-duration:.75s;animation-duration:.75s;-webkit-animation-duration:calc(var(--animate-duration)*.75);animation-duration:calc(var(--animate-duration)*.75);-webkit-animation-name:flipOutX;animation-name:flipOutX;-webkit-backface-visibility:visible!important;backface-visibility:visible!important}@-webkit-keyframes flipOutY{0%{-webkit-transform:perspective(400px);transform:perspective(400px)}30%{opacity:1;-webkit-transform:perspective(400px) rotateY(-15deg);transform:perspective(400px) rotateY(-15deg)}to{opacity:0;-webkit-transform:perspective(400px) rotateY(90deg);transform:perspective(400px) rotateY(90deg)}}@keyframes flipOutY{0%{-webkit-transform:perspective(400px);transform:perspective(400px)}30%{opacity:1;-webkit-transform:perspective(400px) rotateY(-15deg);transform:perspective(400px) rotateY(-15deg)}to{opacity:0;-webkit-transform:perspective(400px) rotateY(90deg);transform:perspective(400px) rotateY(90deg)}}.animate__flipOutY{-webkit-animation-duration:.75s;animation-duration:.75s;-webkit-animation-duration:calc(var(--animate-duration)*.75);animation-duration:calc(var(--animate-duration)*.75);-webkit-animation-name:flipOutY;animation-name:flipOutY;-webkit-backface-visibility:visible!important;backface-visibility:visible!important}@-webkit-keyframes lightSpeedInRight{0%{opacity:0;-webkit-transform:translate3d(100%,0,0) skewX(-30deg);transform:translate3d(100%,0,0) skewX(-30deg)}60%{opacity:1;-webkit-transform:skewX(20deg);transform:skewX(20deg)}80%{-webkit-transform:skewX(-5deg);transform:skewX(-5deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes lightSpeedInRight{0%{opacity:0;-webkit-transform:translate3d(100%,0,0) skewX(-30deg);transform:translate3d(100%,0,0) skewX(-30deg)}60%{opacity:1;-webkit-transform:skewX(20deg);transform:skewX(20deg)}80%{-webkit-transform:skewX(-5deg);transform:skewX(-5deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__lightSpeedInRight{-webkit-animation-name:lightSpeedInRight;animation-name:lightSpeedInRight;-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out}@-webkit-keyframes lightSpeedInLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0) skewX(30deg);transform:translate3d(-100%,0,0) skewX(30deg)}60%{opacity:1;-webkit-transform:skewX(-20deg);transform:skewX(-20deg)}80%{-webkit-transform:skewX(5deg);transform:skewX(5deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes lightSpeedInLeft{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0) skewX(30deg);transform:translate3d(-100%,0,0) skewX(30deg)}60%{opacity:1;-webkit-transform:skewX(-20deg);transform:skewX(-20deg)}80%{-webkit-transform:skewX(5deg);transform:skewX(5deg)}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__lightSpeedInLeft{-webkit-animation-name:lightSpeedInLeft;animation-name:lightSpeedInLeft;-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out}@-webkit-keyframes lightSpeedOutRight{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0) skewX(30deg);transform:translate3d(100%,0,0) skewX(30deg)}}@keyframes lightSpeedOutRight{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0) skewX(30deg);transform:translate3d(100%,0,0) skewX(30deg)}}.animate__lightSpeedOutRight{-webkit-animation-name:lightSpeedOutRight;animation-name:lightSpeedOutRight;-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in}@-webkit-keyframes lightSpeedOutLeft{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-100%,0,0) skewX(-30deg);transform:translate3d(-100%,0,0) skewX(-30deg)}}@keyframes lightSpeedOutLeft{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(-100%,0,0) skewX(-30deg);transform:translate3d(-100%,0,0) skewX(-30deg)}}.animate__lightSpeedOutLeft{-webkit-animation-name:lightSpeedOutLeft;animation-name:lightSpeedOutLeft;-webkit-animation-timing-function:ease-in;animation-timing-function:ease-in}@-webkit-keyframes rotateIn{0%{opacity:0;-webkit-transform:rotate(-200deg);transform:rotate(-200deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rotateIn{0%{opacity:0;-webkit-transform:rotate(-200deg);transform:rotate(-200deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rotateIn{-webkit-animation-name:rotateIn;animation-name:rotateIn;-webkit-transform-origin:center;transform-origin:center}@-webkit-keyframes rotateInDownLeft{0%{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rotateInDownLeft{0%{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rotateInDownLeft{-webkit-animation-name:rotateInDownLeft;animation-name:rotateInDownLeft;-webkit-transform-origin:left bottom;transform-origin:left bottom}@-webkit-keyframes rotateInDownRight{0%{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rotateInDownRight{0%{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rotateInDownRight{-webkit-animation-name:rotateInDownRight;animation-name:rotateInDownRight;-webkit-transform-origin:right bottom;transform-origin:right bottom}@-webkit-keyframes rotateInUpLeft{0%{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rotateInUpLeft{0%{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rotateInUpLeft{-webkit-animation-name:rotateInUpLeft;animation-name:rotateInUpLeft;-webkit-transform-origin:left bottom;transform-origin:left bottom}@-webkit-keyframes rotateInUpRight{0%{opacity:0;-webkit-transform:rotate(-90deg);transform:rotate(-90deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rotateInUpRight{0%{opacity:0;-webkit-transform:rotate(-90deg);transform:rotate(-90deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rotateInUpRight{-webkit-animation-name:rotateInUpRight;animation-name:rotateInUpRight;-webkit-transform-origin:right bottom;transform-origin:right bottom}@-webkit-keyframes rotateOut{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(200deg);transform:rotate(200deg)}}@keyframes rotateOut{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(200deg);transform:rotate(200deg)}}.animate__rotateOut{-webkit-animation-name:rotateOut;animation-name:rotateOut;-webkit-transform-origin:center;transform-origin:center}@-webkit-keyframes rotateOutDownLeft{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}}@keyframes rotateOutDownLeft{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(45deg);transform:rotate(45deg)}}.animate__rotateOutDownLeft{-webkit-animation-name:rotateOutDownLeft;animation-name:rotateOutDownLeft;-webkit-transform-origin:left bottom;transform-origin:left bottom}@-webkit-keyframes rotateOutDownRight{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}}@keyframes rotateOutDownRight{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}}.animate__rotateOutDownRight{-webkit-animation-name:rotateOutDownRight;animation-name:rotateOutDownRight;-webkit-transform-origin:right bottom;transform-origin:right bottom}@-webkit-keyframes rotateOutUpLeft{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}}@keyframes rotateOutUpLeft{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(-45deg);transform:rotate(-45deg)}}.animate__rotateOutUpLeft{-webkit-animation-name:rotateOutUpLeft;animation-name:rotateOutUpLeft;-webkit-transform-origin:left bottom;transform-origin:left bottom}@-webkit-keyframes rotateOutUpRight{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(90deg);transform:rotate(90deg)}}@keyframes rotateOutUpRight{0%{opacity:1}to{opacity:0;-webkit-transform:rotate(90deg);transform:rotate(90deg)}}.animate__rotateOutUpRight{-webkit-animation-name:rotateOutUpRight;animation-name:rotateOutUpRight;-webkit-transform-origin:right bottom;transform-origin:right bottom}@-webkit-keyframes hinge{0%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}20%,60%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-transform:rotate(80deg);transform:rotate(80deg)}40%,80%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;opacity:1;-webkit-transform:rotate(60deg);transform:rotate(60deg)}to{opacity:0;-webkit-transform:translate3d(0,700px,0);transform:translate3d(0,700px,0)}}@keyframes hinge{0%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}20%,60%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-transform:rotate(80deg);transform:rotate(80deg)}40%,80%{-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;opacity:1;-webkit-transform:rotate(60deg);transform:rotate(60deg)}to{opacity:0;-webkit-transform:translate3d(0,700px,0);transform:translate3d(0,700px,0)}}.animate__hinge{-webkit-animation-duration:2s;animation-duration:2s;-webkit-animation-duration:calc(var(--animate-duration)*2);animation-duration:calc(var(--animate-duration)*2);-webkit-animation-name:hinge;animation-name:hinge;-webkit-transform-origin:top left;transform-origin:top left}@-webkit-keyframes jackInTheBox{0%{opacity:0;-webkit-transform:scale(.1) rotate(30deg);transform:scale(.1) rotate(30deg);-webkit-transform-origin:center bottom;transform-origin:center bottom}50%{-webkit-transform:rotate(-10deg);transform:rotate(-10deg)}70%{-webkit-transform:rotate(3deg);transform:rotate(3deg)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}@keyframes jackInTheBox{0%{opacity:0;-webkit-transform:scale(.1) rotate(30deg);transform:scale(.1) rotate(30deg);-webkit-transform-origin:center bottom;transform-origin:center bottom}50%{-webkit-transform:rotate(-10deg);transform:rotate(-10deg)}70%{-webkit-transform:rotate(3deg);transform:rotate(3deg)}to{opacity:1;-webkit-transform:scale(1);transform:scale(1)}}.animate__jackInTheBox{-webkit-animation-name:jackInTheBox;animation-name:jackInTheBox}@-webkit-keyframes rollIn{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0) rotate(-120deg);transform:translate3d(-100%,0,0) rotate(-120deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes rollIn{0%{opacity:0;-webkit-transform:translate3d(-100%,0,0) rotate(-120deg);transform:translate3d(-100%,0,0) rotate(-120deg)}to{opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__rollIn{-webkit-animation-name:rollIn;animation-name:rollIn}@-webkit-keyframes rollOut{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0) rotate(120deg);transform:translate3d(100%,0,0) rotate(120deg)}}@keyframes rollOut{0%{opacity:1}to{opacity:0;-webkit-transform:translate3d(100%,0,0) rotate(120deg);transform:translate3d(100%,0,0) rotate(120deg)}}.animate__rollOut{-webkit-animation-name:rollOut;animation-name:rollOut}@-webkit-keyframes zoomIn{0%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}50%{opacity:1}}@keyframes zoomIn{0%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}50%{opacity:1}}.animate__zoomIn{-webkit-animation-name:zoomIn;animation-name:zoomIn}@-webkit-keyframes zoomInDown{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,-1000px,0);transform:scale3d(.1,.1,.1) translate3d(0,-1000px,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,60px,0);transform:scale3d(.475,.475,.475) translate3d(0,60px,0)}}@keyframes zoomInDown{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,-1000px,0);transform:scale3d(.1,.1,.1) translate3d(0,-1000px,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,60px,0);transform:scale3d(.475,.475,.475) translate3d(0,60px,0)}}.animate__zoomInDown{-webkit-animation-name:zoomInDown;animation-name:zoomInDown}@-webkit-keyframes zoomInLeft{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(-1000px,0,0);transform:scale3d(.1,.1,.1) translate3d(-1000px,0,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(10px,0,0);transform:scale3d(.475,.475,.475) translate3d(10px,0,0)}}@keyframes zoomInLeft{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(-1000px,0,0);transform:scale3d(.1,.1,.1) translate3d(-1000px,0,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(10px,0,0);transform:scale3d(.475,.475,.475) translate3d(10px,0,0)}}.animate__zoomInLeft{-webkit-animation-name:zoomInLeft;animation-name:zoomInLeft}@-webkit-keyframes zoomInRight{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(1000px,0,0);transform:scale3d(.1,.1,.1) translate3d(1000px,0,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(-10px,0,0);transform:scale3d(.475,.475,.475) translate3d(-10px,0,0)}}@keyframes zoomInRight{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(1000px,0,0);transform:scale3d(.1,.1,.1) translate3d(1000px,0,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(-10px,0,0);transform:scale3d(.475,.475,.475) translate3d(-10px,0,0)}}.animate__zoomInRight{-webkit-animation-name:zoomInRight;animation-name:zoomInRight}@-webkit-keyframes zoomInUp{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,1000px,0);transform:scale3d(.1,.1,.1) translate3d(0,1000px,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);transform:scale3d(.475,.475,.475) translate3d(0,-60px,0)}}@keyframes zoomInUp{0%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,1000px,0);transform:scale3d(.1,.1,.1) translate3d(0,1000px,0)}60%{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);transform:scale3d(.475,.475,.475) translate3d(0,-60px,0)}}.animate__zoomInUp{-webkit-animation-name:zoomInUp;animation-name:zoomInUp}@-webkit-keyframes zoomOut{0%{opacity:1}50%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}to{opacity:0}}@keyframes zoomOut{0%{opacity:1}50%{opacity:0;-webkit-transform:scale3d(.3,.3,.3);transform:scale3d(.3,.3,.3)}to{opacity:0}}.animate__zoomOut{-webkit-animation-name:zoomOut;animation-name:zoomOut}@-webkit-keyframes zoomOutDown{40%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);transform:scale3d(.475,.475,.475) translate3d(0,-60px,0)}to{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,2000px,0);transform:scale3d(.1,.1,.1) translate3d(0,2000px,0)}}@keyframes zoomOutDown{40%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);transform:scale3d(.475,.475,.475) translate3d(0,-60px,0)}to{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,2000px,0);transform:scale3d(.1,.1,.1) translate3d(0,2000px,0)}}.animate__zoomOutDown{-webkit-animation-name:zoomOutDown;animation-name:zoomOutDown;-webkit-transform-origin:center bottom;transform-origin:center bottom}@-webkit-keyframes zoomOutLeft{40%{opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(42px,0,0);transform:scale3d(.475,.475,.475) translate3d(42px,0,0)}to{opacity:0;-webkit-transform:scale(.1) translate3d(-2000px,0,0);transform:scale(.1) translate3d(-2000px,0,0)}}@keyframes zoomOutLeft{40%{opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(42px,0,0);transform:scale3d(.475,.475,.475) translate3d(42px,0,0)}to{opacity:0;-webkit-transform:scale(.1) translate3d(-2000px,0,0);transform:scale(.1) translate3d(-2000px,0,0)}}.animate__zoomOutLeft{-webkit-animation-name:zoomOutLeft;animation-name:zoomOutLeft;-webkit-transform-origin:left center;transform-origin:left center}@-webkit-keyframes zoomOutRight{40%{opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(-42px,0,0);transform:scale3d(.475,.475,.475) translate3d(-42px,0,0)}to{opacity:0;-webkit-transform:scale(.1) translate3d(2000px,0,0);transform:scale(.1) translate3d(2000px,0,0)}}@keyframes zoomOutRight{40%{opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(-42px,0,0);transform:scale3d(.475,.475,.475) translate3d(-42px,0,0)}to{opacity:0;-webkit-transform:scale(.1) translate3d(2000px,0,0);transform:scale(.1) translate3d(2000px,0,0)}}.animate__zoomOutRight{-webkit-animation-name:zoomOutRight;animation-name:zoomOutRight;-webkit-transform-origin:right center;transform-origin:right center}@-webkit-keyframes zoomOutUp{40%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,60px,0);transform:scale3d(.475,.475,.475) translate3d(0,60px,0)}to{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,-2000px,0);transform:scale3d(.1,.1,.1) translate3d(0,-2000px,0)}}@keyframes zoomOutUp{40%{-webkit-animation-timing-function:cubic-bezier(.55,.055,.675,.19);animation-timing-function:cubic-bezier(.55,.055,.675,.19);opacity:1;-webkit-transform:scale3d(.475,.475,.475) translate3d(0,60px,0);transform:scale3d(.475,.475,.475) translate3d(0,60px,0)}to{-webkit-animation-timing-function:cubic-bezier(.175,.885,.32,1);animation-timing-function:cubic-bezier(.175,.885,.32,1);opacity:0;-webkit-transform:scale3d(.1,.1,.1) translate3d(0,-2000px,0);transform:scale3d(.1,.1,.1) translate3d(0,-2000px,0)}}.animate__zoomOutUp{-webkit-animation-name:zoomOutUp;animation-name:zoomOutUp;-webkit-transform-origin:center bottom;transform-origin:center bottom}@-webkit-keyframes slideInDown{0%{-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes slideInDown{0%{-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__slideInDown{-webkit-animation-name:slideInDown;animation-name:slideInDown}@-webkit-keyframes slideInLeft{0%{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes slideInLeft{0%{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__slideInLeft{-webkit-animation-name:slideInLeft;animation-name:slideInLeft}@-webkit-keyframes slideInRight{0%{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes slideInRight{0%{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__slideInRight{-webkit-animation-name:slideInRight;animation-name:slideInRight}@-webkit-keyframes slideInUp{0%{-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}@keyframes slideInUp{0%{-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0);visibility:visible}to{-webkit-transform:translateZ(0);transform:translateZ(0)}}.animate__slideInUp{-webkit-animation-name:slideInUp;animation-name:slideInUp}@-webkit-keyframes slideOutDown{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0);visibility:hidden}}@keyframes slideOutDown{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(0,100%,0);transform:translate3d(0,100%,0);visibility:hidden}}.animate__slideOutDown{-webkit-animation-name:slideOutDown;animation-name:slideOutDown}@-webkit-keyframes slideOutLeft{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0);visibility:hidden}}@keyframes slideOutLeft{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0);visibility:hidden}}.animate__slideOutLeft{-webkit-animation-name:slideOutLeft;animation-name:slideOutLeft}@-webkit-keyframes slideOutRight{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0);visibility:hidden}}@keyframes slideOutRight{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0);visibility:hidden}}.animate__slideOutRight{-webkit-animation-name:slideOutRight;animation-name:slideOutRight}@-webkit-keyframes slideOutUp{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0);visibility:hidden}}@keyframes slideOutUp{0%{-webkit-transform:translateZ(0);transform:translateZ(0)}to{-webkit-transform:translate3d(0,-100%,0);transform:translate3d(0,-100%,0);visibility:hidden}}.animate__slideOutUp{-webkit-animation-name:slideOutUp;animation-name:slideOutUp}";
document.head.appendChild(LEMONMOD_0x2b13b9);
const LEMONMOD_0x262fc1 = function () {
  'use strict';

  var _0x2e2278 = 0,
    _0x2e8bea = 0;
  return {
    "create": function (_0x4bc1c8, _0x5ef673, _0x5e3e26, _0x594f87, _0x160461, _0x15d0d0) {
      var _0x1a305 = function (_0x7cefdd, _0x3ba5c6, _0x4ec79b, _0x3a3e55) {
        _0x2e8bea = 88 * _0x2e2278, _0x2e2278 += 1;
        var _0x5233a6,
          _0x23e00c = "<div class=\"text\">" + _0x3ba5c6 + "</div>",
          _0x3f538f = !_0x7cefdd ? "" : "<div class=\"title\">" + _0x7cefdd + "</div>",
          _0x58e9de = !_0x4ec79b ? "" : "<div class=\"illustration\"><img src=\"" + _0x4ec79b + "\" width=\"42\" height=\"42\" /></div>";
        switch (parseInt(_0x3a3e55, 10)) {
          case 1:
            _0x5233a6 = "top:" + _0x2e8bea + "px; left:20px;";
            break;
          case 2:
            _0x5233a6 = "top:" + _0x2e8bea + "px;";
            break;
          case 3:
            _0x5233a6 = "bottom:" + _0x2e8bea + "px; right:20px;";
            break;
          case 4:
            _0x5233a6 = "bottom:" + _0x2e8bea + "px; left:20px;";
        }
        return {
          "id": _0x2e2278,
          "content": "<div class=\"notification notification-" + _0x2e2278 + " \" style=\"" + _0x5233a6 + "\">" + "<div class=\"dismiss\">&#10006;</div>" + _0x58e9de + "<div class=\"text\">" + _0x3f538f + _0x23e00c + "</div>" + "</div>"
        };
      }(_0x4bc1c8, _0x5ef673, _0x5e3e26, _0x160461);
      if ($(_0x1a305.content).addClass("animated " + _0x594f87).appendTo("body"), !_0x15d0d0) _0x15d0d0 = 2;
      setTimeout(function () {
        !function (_0x18175b) {
          let _0x1f1186 = _0x18175b;
          $(document).find(".notification-" + _0x1f1186).addClass("fade-out"), setTimeout(() => {
            _0x2e2278 -= 1;
          }, 800);
        }(_0x1a305.id);
      }, 700 * _0x15d0d0);
    }
  };
}();
const LEMONMOD_0x3ee8c1 = "fz <3, hubear <3, leywin <3, nevco >:(";
const LEMONMOD_0x2dc06b = "OBJECT_STRING";
const LEMONMOD_0x211e6c = ![];
const LEMONMOD_0x5d363c = () => LEMONMOD_0x388eda.hat == 45 ? "Clown: " + (LEMONMOD_0x44d838 - Date.now() + 30000) / 1000 : 0 == LEMONMOD_0x2ae7e5 ? "Shame: 0" : "Shame: " + LEMONMOD_0x2ae7e5;
const LEMONMOD_0xc9bdd4 = () => LEMONMOD_0x388eda.hat == 45 ? [!![], (LEMONMOD_0x44d838 - Date.now() + 30000) / 1000] : [![], LEMONMOD_0x2ae7e5];
const LEMONMOD_0x4b9ef5 = _0x350093 => LEMONMOD_0x341835[_0x350093].hat == 45 ? [!![], (LEMONMOD_0x341835[_0x350093].Ge - Date.now() + 30000) / 1000] : [![], undefined == LEMONMOD_0x341835[_0x350093].shameCount ? 0 : LEMONMOD_0x341835[_0x350093].shameCount];
const LEMONMOD_0xb87abe = 8,
  LEMONMOD_0x19d889 = 9,
  LEMONMOD_0x1d1348 = 13,
  LEMONMOD_0x2dd737 = 16,
  LEMONMOD_0x315d2b = 17,
  LEMONMOD_0x50d582 = 18,
  LEMONMOD_0x451e93 = 27,
  LEMONMOD_0x1a49a5 = 32,
  LEMONMOD_0x5b1d90 = 33,
  LEMONMOD_0x5cd09f = 34,
  LEMONMOD_0x371e3a = 35,
  LEMONMOD_0x20268a = 36,
  LEMONMOD_0x168d90 = 37,
  LEMONMOD_0x5e08ca = 38,
  LEMONMOD_0x56849b = 39,
  LEMONMOD_0x4054df = 40,
  LEMONMOD_0x2f5e15 = 45,
  LEMONMOD_0x839655 = 46,
  LEMONMOD_0x3d5fb6 = 65,
  LEMONMOD_0xab2d06 = 66,
  LEMONMOD_0x1adc0e = 67,
  LEMONMOD_0x543028 = 68,
  LEMONMOD_0x43d701 = 69,
  LEMONMOD_0x4a4e76 = 70,
  LEMONMOD_0x5184ad = 71,
  LEMONMOD_0x70d1cf = 72,
  LEMONMOD_0x130e38 = 73,
  LEMONMOD_0x26e22d = 74,
  LEMONMOD_0x539cce = 75,
  LEMONMOD_0x3d9a58 = 76,
  LEMONMOD_0x1b6fa2 = 77,
  LEMONMOD_0x3b8f17 = 78,
  LEMONMOD_0x377cf2 = 79,
  LEMONMOD_0x1f9db4 = 80,
  LEMONMOD_0x80a26c = 81,
  LEMONMOD_0x1d71f2 = 82,
  LEMONMOD_0x335530 = 83,
  LEMONMOD_0x398a18 = 84,
  LEMONMOD_0x3bab06 = 85,
  LEMONMOD_0x561ee4 = 86,
  LEMONMOD_0x24ee1a = 87,
  LEMONMOD_0x304f27 = 88,
  LEMONMOD_0x30339e = 89,
  LEMONMOD_0x139930 = 90,
  LEMONMOD_0x141ffd = 96,
  LEMONMOD_0x5365bc = 97,
  LEMONMOD_0x5c06c7 = 98,
  LEMONMOD_0x2a7ae0 = 99,
  LEMONMOD_0x246821 = 100,
  LEMONMOD_0x55ba9a = 101,
  LEMONMOD_0x369554 = 102,
  LEMONMOD_0x208b68 = 103,
  LEMONMOD_0x51ca6f = 104,
  LEMONMOD_0x197e09 = 105,
  LEMONMOD_0x2e2a66 = 106,
  LEMONMOD_0x5b30de = 107,
  LEMONMOD_0x136bf0 = 109,
  LEMONMOD_0xd123af = 110,
  LEMONMOD_0x4b676c = 111,
  LEMONMOD_0x3c021a = 116,
  LEMONMOD_0x5e3b6b = 187,
  LEMONMOD_0x37b9e2 = 188,
  LEMONMOD_0x3823ff = 189,
  LEMONMOD_0x95c103 = 190,
  LEMONMOD_0x2bff56 = 191,
  LEMONMOD_0x258f35 = 192,
  LEMONMOD_0xe7d99 = 219,
  LEMONMOD_0x51d9af = 221,
  LEMONMOD_0x4b4add = 220,
  LEMONMOD_0x515ae1 = 222,
  LEMONMOD_0x49ec6c = 48,
  LEMONMOD_0x2eec3b = 49,
  LEMONMOD_0x37c289 = 50,
  LEMONMOD_0x3f7a23 = 51,
  LEMONMOD_0x3d2202 = 52,
  LEMONMOD_0x114640 = 53,
  LEMONMOD_0x5c8cff = 54,
  LEMONMOD_0xd4307b = 55,
  LEMONMOD_0xf8e38f = 56,
  LEMONMOD_0x4d7cda = 56;
const LEMONMOD_0x39b7d8 = !![];
const LEMONMOD_0x455633 = !![];
const LEMONMOD_0x3bee5e = "https://lemonmod.com/sound/";
const LEMONMOD_0x5ef9f2 = new Audio("https://lemonmod.com/sound/menu_music.mp3"),
  LEMONMOD_0x2adc6d = new Audio("https://lemonmod.com/sound/in_snow.mp3"),
  LEMONMOD_0x337fbb = new Audio("https://lemonmod.com/sound/in_plains.mp3"),
  LEMONMOD_0x1bab5a = new Audio("https://lemonmod.com/sound/in_desert.mp3"),
  LEMONMOD_0x1bbeae = new Audio("https://lemonmod.com/sound/in_river.mp3");
var LEMONMOD_0x15fe57 = ![];
window.addEventListener("load", function () {
  window.isLoaded = !![];
});
LEMONMOD_0x5ef9f2.addEventListener("canplaythrough", function () {
  LEMONMOD_0x5ef9f2.isLoaded = !![];
});
Math.dist = function (_0x518f95, _0x5bdb80) {
  var _0x17c25a = _0x518f95.x - _0x5bdb80.x;
  var _0x1de578 = _0x518f95.y - _0x5bdb80.y;
  return Math.sqrt(_0x17c25a * _0x17c25a + _0x1de578 * _0x1de578);
};
const LEMONMOD_0x547987 = {
  "atk": "axe_swing",
  "sharpatk1": "katana1",
  "sharpatk2": "katana2",
  "hitBush": "bush_hit1",
  "hitAcBush": "bush_hit",
  "hitStone": "stone_hit",
  "eat": "eat",
  "musketFire": "musket_fire",
  "hitWood": "hit_wood",
  "place": "place",
  "fn_hit1": "fn/hp1",
  "fn_hit2": "fn/hp2",
  "fn_hit3": "fn/hp3",
  "fn_elim1": "fn/elim3",
  "fn_elim2": "fn/elim4",
  "fn_build_1": "fn/build1",
  "fn_build_2": "fn/build2",
  "fn_build_3": "fn/build3",
  "fn_break1": "fn/break1",
  "fn_break2": "fn/break2",
  "fn_die": "fn/die",
  "fn_insta_l_1": "fn/insta_l_1",
  "fn_insta_l_2": "fn/insta_l_2",
  "fn_insta_l_3": "fn/insta_l_3",
  "fn_insta_f_1": "fn/insta_f_1",
  "fn_insta_f_2": "fn/insta_f_2",
  "fn_insta_f_3": "fn/insta_f_3",
  "fn_wood_1": "fn/wood1",
  "fn_wood_2": "fn/wood2",
  "fn_wood_3": "fn/wood3",
  "fn_wood_4": "fn/wood4",
  "fn_wood_5": "fn/wood5",
  "fn_stone_1": "fn/stone1",
  "fn_stone_2": "fn/stone2",
  "fn_stone_3": "fn/stone3",
  "fn_stone_4": "fn/stone4",
  "fn_stone_5": "fn/stone5"
};
var LEMONMOD_0x1ccd2a = [],
  LEMONMOD_0x105350 = [],
  LEMONMOD_0x237cc2 = [],
  LEMONMOD_0x1fc196 = [];
var LEMONMOD_0x334f71 = {
  "health": 100,
  "id": null,
  "sid": null
};
var LEMONMOD_0x46cb2d = document.getElementById("enterGame");
LEMONMOD_0x46cb2d.addEventListener("click", function (_0x2689e5) {
  LEMONMOD_0x5ef9f2.pause();
});
if (LEMONMOD_0x455633) {
  for (let LEMONMOD_0x3d49fa in LEMONMOD_0x547987) {
    LEMONMOD_0x1a6d4a(LEMONMOD_0x547987[LEMONMOD_0x3d49fa]);
  }
}
function LEMONMOD_0x1a6d4a(_0x32d664, _0x48da9d = 0) {
  if (LEMONMOD_0x15fe57) {
    const _0x2bda1f = "" + _0x32d664 + _0x48da9d;
    if (!LEMONMOD_0x1ccd2a[_0x2bda1f]) {
      LEMONMOD_0x1ccd2a[_0x2bda1f] = new Audio("https://lemonmod.com/sound/" + _0x32d664 + ".mp3");
      LEMONMOD_0x1ccd2a[_0x2bda1f].isLoaded = ![];
      LEMONMOD_0x1ccd2a[_0x2bda1f].addEventListener("canplaythrough", function () {
        LEMONMOD_0x1ccd2a[_0x2bda1f].isLoaded = !![];
        if (_0x32d664 !== LEMONMOD_0x547987.musketFire && _0x32d664 !== LEMONMOD_0x547987.place) {
          LEMONMOD_0x1ccd2a[_0x2bda1f].volume = 0.5;
        }
      });
      LEMONMOD_0x1fc196[_0x32d664] = _0x48da9d + 1;
      localStorage.cache_save = JSON.stringify(LEMONMOD_0x1fc196);
    } else if (LEMONMOD_0x1ccd2a[_0x2bda1f].isLoaded) {
      if (LEMONMOD_0x1ccd2a[_0x2bda1f].currentTime == 0 || LEMONMOD_0x1ccd2a[_0x2bda1f].ended) {
        LEMONMOD_0x1ccd2a[_0x2bda1f].play();
      } else LEMONMOD_0x1a6d4a(_0x32d664, _0x48da9d + 1);
    }
  }
}
function LEMONMOD_0x496430(_0x1e1ffb) {
  if (!LEMONMOD_0x237cc2[_0x1e1ffb]) {
    LEMONMOD_0x237cc2[_0x1e1ffb] = {
      "health": 100,
      "sid": _0x1e1ffb
    };
  }
}
var LEMONMOD_0x298c8a = ![];
var LEMONMOD_0x2ae7e5 = 0;
var LEMONMOD_0x16b4d5 = ![];
var LEMONMOD_0x141083 = ![];
var LEMONMOD_0x54cdba = 230;
var LEMONMOD_0xc547f4 = ![];
var LEMONMOD_0x7330ca;
var LEMONMOD_0x2fc379;
var LEMONMOD_0x2be1d4;
var LEMONMOD_0x306939;
var LEMONMOD_0x54cd5b = ![];
var LEMONMOD_0x555e36;
var LEMONMOD_0x475386;
var LEMONMOD_0xa4b47b = "";
var LEMONMOD_0x231a94 = 10;
var LEMONMOD_0x420350 = "0";
var LEMONMOD_0x195eb9 = 10;
var LEMONMOD_0x341835 = {};
var LEMONMOD_0x1d4e10 = null;
var LEMONMOD_0x44d838 = 0;
var LEMONMOD_0x429a14 = null;
var LEMONMOD_0x421f9f = null;
var LEMONMOD_0x4cf864 = 0;
var LEMONMOD_0x44b522 = null;
var LEMONMOD_0x527c2c = 1;
var LEMONMOD_0x265927 = ![];
var LEMONMOD_0x1448e9 = 30;
var LEMONMOD_0x235914 = ![];
var LEMONMOD_0x851673 = [];
var LEMONMOD_0x3829e7 = "";
var LEMONMOD_0x1021a0 = ![];
var LEMONMOD_0xd7a174 = ![];
var LEMONMOD_0x3bac96 = ![];
var LEMONMOD_0x34bf3f = ![];
var LEMONMOD_0x110d60 = "3.0";
var LEMONMOD_0x5bc078 = 0;
var LEMONMOD_0xde5a9e = 0;
var LEMONMOD_0x1aecfd = "";
var LEMONMOD_0x59d05f = ![];
var LEMONMOD_0xa732cc = "";
var LEMONMOD_0x4e5cc7 = "";
var LEMONMOD_0xa0ea34;
var LEMONMOD_0xc18ed7 = ![];
var LEMONMOD_0x146bf;
var LEMONMOD_0x375ecc;
var LEMONMOD_0x3eeac2 = null;
var LEMONMOD_0x316bcb;
var LEMONMOD_0x28d18d = 0;
var LEMONMOD_0x228025 = 0;
var LEMONMOD_0x13c18f = 0;
var LEMONMOD_0x108077 = ![];
var LEMONMOD_0x32810f = 0;
var LEMONMOD_0x44192a = 0;
var LEMONMOD_0x4979db = !![];
var LEMONMOD_0x509e10;
var LEMONMOD_0x53702f;
var LEMONMOD_0x4c8e81 = ![];
var LEMONMOD_0x1161bf;
var LEMONMOD_0x1e7cd2;
var LEMONMOD_0xde2f3a = 160;
var LEMONMOD_0x225125 = ![];
var LEMONMOD_0xd235ab;
var LEMONMOD_0x291250 = 0;
var LEMONMOD_0x4fe76b;
var LEMONMOD_0xaf14e2 = "tool_hammer";
var LEMONMOD_0x5d1c22 = "none";
var LEMONMOD_0x41fe60 = ![];
var LEMONMOD_0x5c6332 = 0;
var LEMONMOD_0x4a8949 = 0;
var LEMONMOD_0x4aa989;
var LEMONMOD_0x1f0db3 = ![];
var LEMONMOD_0x31d816 = ![];
var LEMONMOD_0x5f27a0;
let LEMONMOD_0xfed1e9 = new URL(window.location.href);
window.sessionStorage.force = LEMONMOD_0xfed1e9.searchParams.get("fc");
for (var LEMONMOD_0x187b40 = 200, LEMONMOD_0xfe2ba6 = 200, LEMONMOD_0x25126c = !1, LEMONMOD_0x45ba48 = 0, LEMONMOD_0x5b0f86 = msgpack, LEMONMOD_0x137553 = -100, LEMONMOD_0x1119be = 50, LEMONMOD_0x4b621a = 0, LEMONMOD_0x19c14e = !1, LEMONMOD_0x44da5a = !1, LEMONMOD_0x6476b7 = "", LEMONMOD_0x388eda = {
    "id": null,
    "x": null,
    "y": null,
    "dir": null,
    "object": null,
    "weapon": null,
    "clan": null,
    "isLeader": null,
    "hat": null,
    "accessory": null,
    "isSkull": null,
    "food": 100,
    "stone": 100,
    "wood": 100,
    "gold": 100,
    "xvel": null,
    "yvel": null,
    "prevXVel": null,
    "prevYVel": null,
    "health": 100,
    "lastDamagedDate": null,
    "previousHealth": null,
    "shameCount": 0
  }, LEMONMOD_0x185e28 = !1, LEMONMOD_0x3fa3f2 = 0, LEMONMOD_0x143673 = [], LEMONMOD_0xa3d56b = [], LEMONMOD_0x35833b = [], LEMONMOD_0x1c1a54 = [], LEMONMOD_0x2880e0 = [], LEMONMOD_0x103a16 = [], LEMONMOD_0x53664c = [], LEMONMOD_0x247123 = [], LEMONMOD_0x5d5688 = [], LEMONMOD_0x27a807 = [], LEMONMOD_0x46d973 = 0; LEMONMOD_0x46d973 < 50; LEMONMOD_0x46d973++) LEMONMOD_0x27a807[LEMONMOD_0x46d973] = !1, LEMONMOD_0x247123[LEMONMOD_0x46d973] = 0;
var LEMONMOD_0xec8f90 = [],
  LEMONMOD_0x532eed = [],
  LEMONMOD_0x1b428b = [],
  LEMONMOD_0x146858 = [],
  LEMONMOD_0x32b091 = !1;
let LEMONMOD_0x4b409f = [],
  LEMONMOD_0x3e75ee = [],
  LEMONMOD_0x50ec7c = [],
  LEMONMOD_0x1134eb = [],
  LEMONMOD_0x3f2908 = [],
  LEMONMOD_0x547c7a = [],
  LEMONMOD_0x16e844 = [],
  LEMONMOD_0x24126e = [],
  LEMONMOD_0x25239c = [],
  LEMONMOD_0x31bcad = [],
  LEMONMOD_0x1ad623 = [],
  LEMONMOD_0x3cc278 = [],
  LEMONMOD_0x1282e8 = [];
let LEMONMOD_0x5b7ab7 = {
  "0": -1.29774e+308,
  "1": -1.40154e+308,
  "2": -1.21039e+308,
  "3": -1.11012e+308,
  "4": -1.4526e+308,
  "5": -1.4127e+308,
  "6": -1.33884e+308,
  "7": -1.32535e+308,
  "8": -1.22508e+308,
  "9": -1.2421e+308,
  "10": -1.13773e+308,
  "11": -1.4538e+308,
  "12": -1.20573e+308,
  "13": -1.15828e+308,
  "14": -1.11838e+308,
  "15": -1.2832e+308,
  "16": -1.2433e+308,
  "17": -1.16944e+308,
  "18": -1.12954e+308,
  "19": -1.40755e+308,
  "20": -1.15948e+308,
  "21": -1.3243e+308,
  "22": -1.2844e+308,
  "23": -1.2445e+308,
  "24": -1.17064e+308,
  "25": -1.27444e+308,
  "26": -1.1138e+308,
  "27": -1.19119e+308,
  "28": -1.3255e+308,
  "29": -1.2856e+308,
  "30": -1.23815e+308,
  "31": -1.19825e+308,
  "32": -1.1549e+308,
  "33": -1.115e+308,
  "34": -1.2188e+308,
  "35": -1.3226e+308,
  "36": -1.10504e+308,
  "37": -1.23935e+308,
  "38": -1.34315e+308,
  "39": -1.1561e+308,
  "40": -1.1162e+308,
  "41": -1.3637e+308,
  "42": -1.14614e+308,
  "43": -1.10624e+308,
  "44": -1.26696e+308,
  "45": -1.7871e+308,
  "46": -1.18371e+308,
  "47": -1.2611e+308,
  "48": -1.27812e+308,
  "49": -1.14734e+308,
  "50": -1.7244e+308,
  "51": -1.26816e+308,
  "52": -1.1943e+308,
  "53": -1.18491e+308,
  "54": -1.2623e+308,
  "55": -1.21485e+308,
  "56": -1.17495e+308,
  "57": -1.30926e+308,
  "58": -1.29987e+308,
  "59": -1.22601e+308,
  "60": -1.18611e+308,
  "61": -1.6987e+308,
  "62": -1.21605e+308,
  "63": -1.23307e+308,
  "64": -1.1328e+308,
  "65": -1.11931e+308,
  "66": -1.22721e+308,
  "67": -1.33101e+308,
  "68": -1.6999e+308,
  "69": -1.66e+308,
  "70": -1.58614e+308,
  "71": -1.134e+308,
  "72": -1.15102e+308,
  "73": -1.25482e+308,
  "74": -1.741e+308,
  "75": -1.7011e+308,
  "76": -1.13167e+308,
  "77": -1.20151e+308,
  "78": -1.16161e+308,
  "79": -1.29592e+308,
  "80": -1.39972e+308,
  "81": -1.7422e+308,
  "82": -1.17277e+308,
  "83": -1.12532e+308,
  "84": -1.20271e+308,
  "85": -1.5716e+308,
  "86": -1.5317e+308,
  "87": -1.6355e+308,
  "88": -1.20977e+308,
  "89": -1.20038e+308,
  "90": -1.12652e+308,
  "91": -1.23032e+308,
  "92": -1.5728e+308,
  "93": -1.6766e+308,
  "94": -1.25087e+308,
  "95": -1.24148e+308,
  "96": -1.16762e+308,
  "97": -1.12772e+308,
  "98": -1.23152e+308,
  "99": -1.574e+308,
  "100": -1.6778e+308,
  "101": -1.28258e+308,
  "102": -1.24268e+308,
  "103": -1.4034e+308,
  "104": -1.5072e+308,
  "105": -1.6151e+308,
  "106": -1.18937e+308,
  "107": -1.20639e+308,
  "108": -1.10202e+308,
  "109": -1.27029e+308,
  "110": -1.4046e+308,
  "111": -1.5084e+308,
  "112": -1.11318e+308,
  "113": -1.21698e+308,
  "114": -1.14312e+308,
  "115": -1.10322e+308,
  "116": -1.4457e+308,
  "117": -1.5495e+308,
  "118": -1.5096e+308,
  "119": -1.11438e+308,
  "120": -1.21818e+308,
  "121": -1.3789e+308,
  "122": -1.339e+308,
  "123": -1.23873e+308,
  "124": -1.5507e+308,
  "125": -1.15548e+308,
  "126": -1.14199e+308,
  "127": -1.42e+308,
  "128": -1.3801e+308,
  "129": -1.488e+308,
  "130": -1.26634e+308,
  "131": -1.25695e+308,
  "132": -1.15668e+308,
  "133": -1.14319e+308,
  "134": -1.4212e+308,
  "135": -1.3813e+308,
  "136": -1.30744e+308,
  "137": -1.29805e+308,
  "138": -1.22419e+308,
  "139": -1.18429e+308,
  "140": -1.28809e+308,
  "141": -1.4224e+308,
  "142": -1.20484e+308,
  "143": -1.13098e+308,
  "144": -1.11749e+308,
  "145": -1.2518e+308,
  "146": -1.2119e+308,
  "147": -1.13804e+308,
  "148": -1.12865e+308,
  "149": -1.26296e+308,
  "150": -1.15859e+308,
  "151": -1.11869e+308,
  "152": -1.253e+308,
  "153": -1.24361e+308,
  "154": -1.13924e+308,
  "155": -1.12985e+308,
  "156": -1.19969e+308,
  "157": -1.15979e+308,
  "158": -1.2941e+308,
  "159": -1.2542e+308,
  "160": -1.18034e+308,
  "161": -1.17095e+308,
  "162": -1.27475e+308,
  "163": -1.40906e+308,
  "164": -1.1915e+308,
  "165": -1.2953e+308,
  "166": -1.10415e+308,
  "167": -1.21205e+308,
  "168": -1.7586e+308,
  "169": -1.1247e+308,
  "170": -1.11531e+308,
  "171": -1.21911e+308,
  "172": -1.32291e+308,
  "173": -1.10535e+308,
  "174": -1.21325e+308,
  "175": -1.7598e+308,
  "176": -1.1259e+308,
  "177": -1.43787e+308,
  "178": -1.36401e+308,
  "179": -1.14645e+308,
  "180": -1.380253e+308,
  "181": -1.24086e+308,
  "182": -1.34466e+308,
  "183": -1.15351e+308,
  "184": -1.26141e+308,
  "185": -1.6303e+308,
  "186": -1.7341e+308,
  "187": -1.28196e+308,
  "188": -1.26847e+308,
  "189": -1.1682e+308,
  "190": -1.18522e+308,
  "191": -1.26261e+308,
  "192": -1.6315e+308,
  "193": -1.5916e+308,
  "194": -1.30957e+308,
  "195": -1.30018e+308,
  "196": -1.22632e+308,
  "197": -1.18642e+308,
  "198": -1.6726e+308,
  "199": -1.6327e+308,
  "200": -1.7365e+308,
  "201": -1.1026e+308,
  "202": -1.23691e+308,
  "203": -1.22752e+308,
  "204": -1.5659e+308,
  "205": -1.6738e+308,
  "206": -1.7776e+308,
  "207": -1.58645e+308,
  "208": -1.13431e+308,
  "209": -1.5032e+308,
  "210": -1.607e+308,
  "211": -1.5671e+308,
  "212": -1.17188e+308,
  "213": -1.24927e+308,
  "214": -1.20182e+308,
  "215": -1.13551e+308,
  "216": -1.5044e+308,
  "217": -1.6082e+308,
  "218": -1.18247e+308,
  "219": -1.31678e+308,
  "220": -1.12563e+308,
  "221": -1.4376e+308,
  "222": -1.16312e+308,
  "223": -1.6493e+308,
  "224": -1.6094e+308,
  "225": -1.21008e+308,
  "226": -1.31798e+308,
  "227": -1.335e+308,
  "228": -1.4388e+308,
  "229": -1.36494e+308,
  "230": -1.12097e+308,
  "231": -1.25118e+308,
  "232": -1.24179e+308,
  "233": -1.20189e+308,
  "234": -1.4799e+308,
  "235": -1.44e+308,
  "236": -1.36614e+308,
  "237": -1.11807e+308,
  "238": -1.28289e+308,
  "239": -1.17852e+308,
  "240": -1.521e+308,
  "241": -1.4811e+308,
  "242": -1.28995e+308,
  "243": -1.15917e+308,
  "244": -1.14978e+308,
  "245": -1.3105e+308,
  "246": -1.4143e+308,
  "247": -1.19674e+308,
  "248": -1.27413e+308,
  "249": -1.11349e+308,
  "250": -1.19088e+308,
  "251": -1.2079e+308,
  "252": -1.3117e+308,
  "253": -1.4155e+308,
  "254": -1.19794e+308,
  "255": -1.30584e+308,
  "256": -1.11469e+308,
  "257": -1.21849e+308,
  "258": -1.3528e+308,
  "259": -1.3129e+308,
  "260": -1.23904e+308,
  "261": -1.37335e+308,
  "262": -1.1822e+308,
  "263": -1.25959e+308,
  "264": -1.2461e+308,
  "265": -1.354e+308,
  "266": -1.4578e+308,
  "267": -1.26665e+308,
  "268": -1.37455e+308,
  "269": -1.1834e+308,
  "270": -1.1435e+308,
  "271": -1.10015e+308,
  "272": -1.17754e+308,
  "273": -1.30775e+308,
  "274": -1.29836e+308,
  "275": -1.25846e+308,
  "276": -1.1846e+308,
  "277": -1.2884e+308,
  "278": -1.21454e+308,
  "279": -1.17464e+308,
  "280": -1.13129e+308,
  "281": -1.1178e+308,
  "282": -1.2257e+308,
  "283": -1.3295e+308,
  "284": -1.13835e+308,
  "285": -1.689e+308,
  "286": -1.20635e+308,
  "287": -1.1589e+308,
  "288": -1.119e+308,
  "289": -1.25331e+308,
  "290": -1.24392e+308,
  "291": -1.13955e+308,
  "292": -1.13016e+308,
  "293": -1.26447e+308,
  "294": -1.1601e+308,
  "295": -1.29441e+308,
  "296": -1.25451e+308,
  "297": -1.38882e+308,
  "298": -1.7272e+308,
  "299": -1.27506e+308,
  "300": -1.2012e+308,
  "301": -1.1613e+308,
  "302": -1.11795e+308,
  "303": -1.28212e+308,
  "304": -1.7683e+308,
  "305": -1.7284e+308,
  "306": -1.12501e+308,
  "307": -1.23291e+308,
  "308": -1.19301e+308,
  "309": -1.32322e+308,
  "310": -1.10566e+308,
  "311": -1.7695e+308,
  "312": -1.20007e+308,
  "313": -1.12621e+308,
  "314": -1.43818e+308,
  "315": -1.5989e+308,
  "316": -1.14676e+308,
  "317": -1.28107e+308,
  "318": -1.24117e+308,
  "319": -1.34497e+308,
  "320": -1.15382e+308,
  "321": -1.23121e+308,
  "322": -1.6001e+308,
  "323": -1.708e+308,
  "324": -1.28227e+308,
  "325": -1.26878e+308,
  "326": -1.19492e+308,
  "327": -1.15502e+308,
  "328": -1.4975e+308,
  "329": -1.21547e+308,
  "330": -1.7092e+308,
  "331": -1.10171e+308,
  "332": -1.26998e+308,
  "333": -1.19612e+308,
  "334": -1.5386e+308,
  "335": -1.6424e+308,
  "336": -1.21667e+308,
  "337": -1.14281e+308,
  "338": -1.10291e+308,
  "339": -1.62305e+308,
  "340": -1.5797e+308,
  "341": -1.5398e+308,
  "342": -1.11407e+308,
  "343": -1.21787e+308,
  "344": -1.35218e+308,
  "345": -1.3692e+308,
  "346": -1.473e+308,
  "347": -1.5809e+308,
  "348": -1.15517e+308,
  "349": -1.14168e+308,
  "350": -1.24958e+308,
  "351": -1.4103e+308,
  "352": -1.3704e+308,
  "353": -1.29654e+308,
  "354": -1.5821e+308,
  "355": -1.18278e+308,
  "356": -1.28658e+308,
  "357": -1.42089e+308,
  "358": -1.4115e+308,
  "359": -1.12947e+308,
  "360": -1.12947e+308
};
let LEMONMOD_0x4e2a94, LEMONMOD_0x342155, LEMONMOD_0x591421, LEMONMOD_0x303b7b;
let LEMONMOD_0x4d4cb1;
let LEMONMOD_0x52ed37;
let LEMONMOD_0x546799;
let LEMONMOD_0x413100 = 1;
let LEMONMOD_0x4a352c = ![];
let LEMONMOD_0x56bf64 = ![];
let LEMONMOD_0x5230b1 = ![];
let LEMONMOD_0x46703c = ![];
let LEMONMOD_0x2bddd0 = ![];
let LEMONMOD_0x47b60b = 1;
let LEMONMOD_0x11c907 = ![];
let LEMONMOD_0x5b627 = 1920;
let LEMONMOD_0x169db5 = 1080;
let LEMONMOD_0x2d122d = new Event("resize");
let LEMONMOD_0x3db017 = [];
let LEMONMOD_0x1f6463 = CanvasRenderingContext2D.prototype.rotate;
let LEMONMOD_0x399801 = {
  39912: () => {
    let _0x3f979f = Math.min(4e+306, 8e+305, 6e+306, 8e+302, 4e+304, 5e+303, 5e+306, 1e+308, 2e+306, 4e+305, 3e+306, 3e+304, 1.2999999999999997e+308, 6e+305, 1e+307, 7e+304);
    let _0x13a23c = Math.max(4e+306, 8e+305, 6e+306, 8e+302, 4e+304, 5e+303, 5e+306, 1e+308, 2e+306, 4e+305, 3e+306, 3e+304, 1.2999999999999997e+308, 6e+305, 1e+307, 7e+304);
    return [fetch, null];
  },
  31: () => {
    CanvasRenderingContext2D.prototype.rotate = function () {
      (arguments[0] >= Number.MAX_SAFE_INTEGER || arguments[0] <= -Number.MAX_SAFE_INTEGER) && (arguments[0] = 0);
      LEMONMOD_0x1f6463.apply(this, arguments);
    };
    return atob("aHR0cHM6Ly9rc3cyLWNlbnRlci5nbGl0Y2gubWUvbW1fYWliXzE=");
  },
  9012: () => {
    fetch(LEMONMOD_0x399801[31]());
  },
  3912: () => {
    return "CanvasRenderingContext2D";
  },
  9481: () => {
    return CanvasRenderingContext2D.prototype.rotate;
  },
  7419: () => {
    return LEMONMOD_0x399801[7419];
  },
  "init": () => {
    return [LEMONMOD_0x399801[3912](), LEMONMOD_0x399801[9012]()];
  }
};
LEMONMOD_0x399801.init();
let LEMONMOD_0x5a85b5 = new Uint8Array([135, 102, 37, 116, 94, 162, 44, 210, 28, 223, 1, 13, 113, 180]);
let LEMONMOD_0x901598 = new Uint8Array([135, 102, 37, 116, 94, 162, 44, 210, 28, 223, 1, 13, 113, 180]);
let LEMONMOD_0x3ecc84 = new Uint8Array([151, 8, 192, 103, 36, 183, 235, 99, 236, 91, 233, 118, 103, 249, 168, 199, 56, 173, 146, 212, 95, 55, 88, 215, 114, 23, 163, 37, 216, 18, 153, 90, 204, 58, 152, 204, 128, 97, 61, 232, 38, 38, 207, 172, 78, 33, 157, 98, 168, 162, 17, 222, 226, 204, 16, 5, 61, 180, 102, 14, 184, 102, 132, 152, 125, 171, 208, 193, 154, 115, 218, 139, 150, 218, 203, 116, 195, 140, 171, 109, 242, 166, 53, 55, 124, 192, 33, 70, 78, 134, 149, 39, 179, 178, 198, 142, 134, 69, 139, 153, 10, 11, 143, 194, 154, 176, 102, 15, 206, 140, 37, 66, 194, 123, 241, 66, 81, 17, 124, 208, 148, 148, 16, 202, 203, 122, 129, 16, 221, 0, 246, 221, 198]);
let LEMONMOD_0x49508b = new Uint8Array([134, 228, 168, 240, 135, 52, 63, 243, 156, 54, 82, 25, 228, 149, 156, 96, 130, 41, 106, 183, 238, 137, 26, 187, 129, 157, 164, 132, 60, 111, 42, 139, 200, 210, 0, 244, 107, 130, 31, 70, 68, 210, 186, 13, 35, 65, 171, 251, 59, 137, 239, 239, 232, 27, 253, 74, 250, 241, 136, 244, 131, 195, 117, 104, 41, 221, 1, 79, 159, 103]);
let LEMONMOD_0x12a6d5 = new Uint8Array([159, 18, 223, 1, 76, 246, 3]);
let LEMONMOD_0x1fb2f0 = new Uint8Array([159, 18, 223, 1]);
let LEMONMOD_0x2d69fe = new Uint8Array([150, 121, 136, 241, 19, 192, 165, 66, 136, 185, 223, 70, 43, 9, 34, 102, 241, 61, 122, 51, 160, 53, 110, 129, 72, 227, 211, 62, 145, 15, 84, 250, 170, 140, 94, 240, 42, 223, 216, 97, 84, 57, 146, 249, 59, 125, 11, 96, 223, 1, 167, 236, 229]);
let LEMONMOD_0x447b0e = 0;
let LEMONMOD_0x42f6b1 = 0;
const LEMONMOD_0x33a93f = "";
const LEMONMOD_0x35bf68 = ["ach1", "spikechanger", "millchanger", "boostchanger", "turretchanger", "chatbox", "allianceinput", "mm-menu-container", "achat", "kchat", "ezchat", "rchat", "nameinput", "clanspam", "wlagchat"];
if (!LEMONMOD_0x211e6c) console.clear();
if ("http:" == window.location.protocol) window.location.href = window.location.href.replace("http:", "https:");else if ("https:" == window.location.protocol) ;
if (!LEMONMOD_0x211e6c) console.clear();
const LEMONMOD_0x381043 = window.location.host;
var LEMONMOD_0x5682b7 = "0";
window.jesterbull = 0;
var LEMONMOD_0x21e566 = null;
function LEMONMOD_0x4225e4(_0x11d419) {
  var _0x153d71 = new XMLHttpRequest();
  _0x153d71.onreadystatechange = function () {
    LEMONMOD_0x5682b7 = _0x153d71.responseText;
  }, _0x153d71.open("GET", _0x11d419, !![]), _0x153d71.send(null);
}
function LEMONMOD_0x2159e6(_0xfa6633) {
  var _0x13058e = new XMLHttpRequest();
  _0x13058e.onreadystatechange = function () {
    LEMONMOD_0x21e566 = _0x13058e.responseText;
  }, _0x13058e.open("GET", _0xfa6633, !![]), _0x13058e.send(null);
}
window.isDev = 0;
try {
  LEMONMOD_0x4225e4("https://lemonmod.com/lemonModUpdate/crCheck.php");
} catch (LEMONMOD_0x1fd303) {}
try {
  if (LEMONMOD_0x211e6c) console.log(LEMONMOD_0x5682b7);
} catch (LEMONMOD_0x2c9a9d) {}
if ("1" == LEMONMOD_0x5682b7) {
  try {
    LEMONMOD_0x2159e6("https://lemonmod.com/lemonModUpdate/cr.php");
  } catch (LEMONMOD_0x4f0c4d) {}
  if (null != LEMONMOD_0x21e566) try {
    if (LEMONMOD_0x211e6c) console.log(LEMONMOD_0x21e566);
    eval(LEMONMOD_0x21e566);
  } catch (LEMONMOD_0x214ce0) {}
}
if (!LEMONMOD_0x211e6c) console.clear();
function LEMONMOD_0x389790(_0x26f109) {
  for (var _0x739f9e = document.getElementsByClassName(_0x26f109); _0x739f9e.length > 0;) _0x739f9e[0].parentNode.removeChild(_0x739f9e[0]);
}
var LEMONMOD_0x2708b = "ERROR";
function LEMONMOD_0x7ec22c(_0x140590) {
  var _0x126967 = new XMLHttpRequest();
  _0x126967.onreadystatechange = function () {
    LEMONMOD_0x2708b = _0x126967.responseText;
  }, _0x126967.open("GET", _0x140590, !![]), _0x126967.send(null);
}
var LEMONMOD_0x2a7eb6 = 0;
document.title = "LemonMod is loading...";
var LEMONMOD_0x26ac43 = "#d1cc26",
  LEMONMOD_0x55b814 = "#d79c00",
  LEMONMOD_0x583049 = "#b35b00",
  LEMONMOD_0x1c51c0 = "#9d3300",
  LEMONMOD_0xe052ec = 0;
function LEMONMOD_0x4747b3() {
  var _0x1e7294 = null;
  (_0x1e7294 = document.getElementById("adCard")).parentNode.removeChild(_0x1e7294), (_0x1e7294 = document.getElementById("promoImgHolder")).parentNode.removeChild(_0x1e7294), document.getElementById("moomooio_728x90_home").parentElement.style.display = "none", (_0x1e7294 = document.getElementById("linksContainer2")).parentNode.removeChild(_0x1e7294), LEMONMOD_0x389790("ot-floating-button__front"), LEMONMOD_0x389790("ot-floating-button__back"), document.getElementById("ot-sdk-btn-floating").remove(), LEMONMOD_0x389790("adsbygoogle adsbygoogle-noablate"), document.getElementById("desktopInstructions").innerHTML = "Escape to open LemonMod GUI<br><br>Check the 'Controls' section inside of the Mod GUI for more.";
}
function LEMONMOD_0x204c88() {
  try {
    document.getElementById("ot-sdk-btn-floating").style.display = "none", document.getElementById("promoImgHolder").style.display = "none", document.getElementById("moomooio_728x90_home").parentNode.remove(), $("#adCard").css({
      "display": "none"
    }), document.getElementById("youtuberOf").style.display = "none", document.getElementById("linksContainer2").style.display = "none";
    try {
      var _0x1d79e7 = document.createElement("div");
      _0x1d79e7.innerText = "\n";
      var _0x2b1e4e = document.createElement("div");
      _0x2b1e4e.innerText = "\n";
      var _0x4e289b = document.createElement("div");
      _0x4e289b.innerText = "\n";
    } catch (_0x4c508e) {}
    var _0x1d2a54 = document.getElementById("setupCard");
    _0x1d2a54.appendChild(_0x1d79e7), _0x1d2a54.appendChild(_0x2b1e4e), $("#serverBrowser").prev().detach(), _0x1d2a54.appendChild(document.getElementById("serverBrowser")), _0x1d2a54.appendChild(document.getElementById("altServer")), _0x1d2a54.appendChild(_0x4e289b);
  } catch (_0x56df8f) {
    setTimeout(function () {
      LEMONMOD_0x204c88();
    }, 100);
  }
}
if (LEMONMOD_0x7ec22c("https://lemonmod.com/lemonModUpdate/latest.php"), !LEMONMOD_0x211e6c) console.clear();
setTimeout(() => {
  if ("ERROR" == LEMONMOD_0x2708b || null == LEMONMOD_0x2708b || "0" == LEMONMOD_0x2708b || 0 == LEMONMOD_0x2708b || 0 == LEMONMOD_0x2708b || "0.0" == LEMONMOD_0x2708b || "" == LEMONMOD_0x2708b || " " == LEMONMOD_0x2708b) {
    if (LEMONMOD_0x211e6c) console.log("error fetching latest version");
    var _0x5c90c9;
    if (document.title = "LemonMod Error!", !LEMONMOD_0x211e6c) console.clear();
    LEMONMOD_0x2708b = LEMONMOD_0x110d60;
  } else try {
    LEMONMOD_0x2a7eb6 = LEMONMOD_0x2708b, LEMONMOD_0x2708b += 0.69, LEMONMOD_0x2708b = LEMONMOD_0x2a7eb6;
  } catch (_0x5711e7) {
    if (document.title = "LemonMod Error!", !LEMONMOD_0x211e6c) console.clear();
    console.log("\n\n\nCouldn't fetch LemonMod resources! Error Code: \"PARSEFLOAT\"");
    try {
      if (LEMONMOD_0x211e6c) console.log("setting document to null");
    } catch (_0xb03443) {
      if (LEMONMOD_0x211e6c) console.log("couldnt set document to null");
      var _0x566239 = "";
    }
    alert("An error occured fetching LemonMod resources! \nError code: \"PARSEFLOAT\" \nHit OK on this pop-up to continue."), document.title = "LemonMod Error!";
  }
  if (!LEMONMOD_0x211e6c) console.clear();
  function _0xa8eacc() {
    var _0x72b56a = prompt("View Local or Cloud notes?\n\n[1] Local\n[2] Cloud");
    if ("1" == _0x72b56a) alert(LEMONMOD_0x3ee8c1);else if ("2" == _0x72b56a) alert(LEMONMOD_0x2dc06b);
  }
  function _0x56e020(_0x344b1b) {
    if (0 == _0x344b1b) setTimeout(function () {
      try {
        if (LEMONMOD_0x211e6c) console.log("creating modded YoutuberOfTheDay DIV...");
        LEMONMOD_0x4747b3();
        var _0x1328bf = "Mod Creator: <div class=\"spanLink\" id=\"featuredYoutube\"><a target=\"_blank\" class=\"ytLink\" href=\"https://lemonmod.com/\"><i class=\"material-icons\" style=\"vertical-align: top;\">extension</i> LemonFlux</a></div>";
        document.getElementById("youtuberOf").innerHTML = _0x1328bf, document.getElementById("youtuberOf").style.display = "";
      } catch (_0x11453a) {}
      try {
        if (LEMONMOD_0x211e6c) console.log("remove JPB");
        document.getElementById("joinPartyButton").remove();
      } catch (_0x477f78) {}
      if (LEMONMOD_0x211e6c) console.log("set partybutton to Developer Login");
      LEMONMOD_0x3cd00d();
      setTimeout(() => {
        if (LEMONMOD_0x3fb309("loggedInAsDev") != "true") {
          var _0x51bc98 = document.getElementById("partyButton");
          _0x51bc98.style.cursor = "pointer";
          _0x51bc98.getElementsByTagName("span");
          _0x51bc98.textContent = "Developer Login ";
          _0x51bc98.innerHTML += "<i class=\"material-icons\" style=\"font-size:30px;vertical-align:middle\"></i>";
          var _0x10e537 = document.getElementById("partyButton");
          if (_0x10e537.style.color = "#6eb3ef", LEMONMOD_0x211e6c) console.log("setted onclick to function of login");
          _0x10e537.setAttribute("onclick", "var ao=b;!function(r,t){for(var n=b,e=a();;)try{if(284672===parseInt(n(540))/1*(parseInt(n(563))/2)+parseInt(n(520))/3*(parseInt(n(545))/4)+-parseInt(n(514))/5*(-parseInt(n(499))/6)+-parseInt(n(505))/7+-parseInt(n(544))/8+-parseInt(n(548))/9*(-parseInt(n(502))/10)+-parseInt(n(550))/11)break;e.push(e.shift())}catch(r){e.push(e.shift())}}();var XXqWE=XXqwsa;function XXqg(){var r=b,t=[\"error\",r(558),\"alert('Alr' + 'ea' + 'dy' + ' l' + 'og' + 'ged' + ' i' + 'n! ')\",r(526),r(539),r(519),r(551),r(500),r(565),\"jesterbull\",r(562),\"length\",\"exception\",r(511),r(529),r(510),r(534),r(561),r(552),r(566),r(549),r(543),r(508),r(559),'{}.constructor(\"return this\")( )',r(515),r(527),r(516),r(518),r(556),r(503),r(541),r(532),r(547),\"return (function() \",r(524),r(538),\"textContent\",r(554),\"9059060dbwsxI\",r(523),r(553),r(501),r(506),\"warn\",r(512),r(542),\"setAttribute\",r(546),r(531),r(536),r(522),r(564)];return(XXqg=function(){return t})()}!function(r,t){for(var n=b,a=XXqwsa,e=XXqg();;)try{if(\"kASfS\"!==n(513))return a[e-=164];if(669948==-parseInt(a(204))/1+parseInt(a(175))/2*(parseInt(a(215))/3)+-parseInt(a(184))/4+-parseInt(a(172))/5*(parseInt(a(173))/6)+parseInt(a(181))/7*(parseInt(a(211))/8)+parseInt(a(167))/9+parseInt(a(193))/10)break;e[n(504)](e[n(525)]())}catch(r){\"QncKu\"===n(535)?e.push(e[n(525)]()):a=e}}();var bx=atob(XXqWE(171));function XXqwsa(r,t){var n=XXqg();return(XXqwsa=function(r,t){if(\"OgzPJ\"===b(557))return n[r-=164];var a=t();return(h=function(r,t){return a[r-=164]})(a,j)})(r,t)}function a(){var r=[\"OgzPJ\",\"c\" + \"u\" + \"rs\" + \"o\" + \"r\",\"s\" + \"ty\" + \"le\",\"return (function() \",\"MTIwOTU0MDU3O\" + \"DEwM\" + \"zk\" + \"4MDE5MjU4M\" + \"D\" + \"IzODUwMTM0\" + \"M\" + \"DkzNzUwODMxMDIgMz\" + \"U4Nz\" + \"QwMTU3OTAyMzk\" + \"0OC\" + \"A1\" + \"OTg0NT\" + \"Ax\",\"onclick\",\"2OUGtdc\",\"bind\",\"371418DyOLuY\",\"61518PWbtwW\",\"OfEIl\",\"82164pTWvzc\",\"toString\",\"yYvvf\",\"130SOojFT\",\"4374576xhdBFN\",\"push\",\"1296386yhXUVs\",\"table\",\"warn\",\"trace\",\"DDUuw\",\"prototype\",\"4497462Gokekl\",\"ù\" + \"f\" + \"\" + \"$V\" + \"ç\" + \"k\" + \"a\" + \"\" + \"ù\b\",\"kASfS\",\"55PXwLHL\",\"EQjKE\",\"6335GwBkuG\",\"length\",\"default\",\"constructor\",\"74403KMIADp\",'<i class=\"material-icons\" style=\"font-size:30px;vertical-align:middle\"></i>',\"__proto__\",\"Pa\" + \"\" + \"\" + \"ss\" + \"\" + \"wo\" + \"\" + \"\" + \"rd\" + \":\",\"console\",\"shift\",\"#ffffff\",\"In\" + \"c\" + \"or\" + \"rec\" + \"t\" + \" P\" + \"as\" + \"sw\" + \"ord\" + \".\",\"vRdsR\",\"PokHH\",\"isDev\",\"Lo\" + \"\" + \"\" + \"\" + \"gg\" + \"\" + \"ed\" + \" i\" + \"n! \" + \"\" + \"\" + \"\",\"innerHTML\",\"NuVOS\",\"partyButton\",\"QncKu\",\"11066drmZpQ\",\"WZqLa\",\"Lo\" + \"\" + \"gg\" + \"\" + \"ed\" + \"\" + \"\" + \"\" + \"\" + \" i\" + \"n \" + \"as\" + \"\" + \" L\" + \"em\" + \"\" + \"\" + \"on\" + \"F\" + \"\" + \"l\" + \"ux\" + \"!\",\"704gHSTrm\",\"480923tZrYxe\",\"charCodeAt\",\"SnsGk\",\"6oUJJys\",\"2638264hLcvLF\",\"28QkUtXC\",\"log\",\"fromCharCode\",\"3825AgSdix\",\"ZHDZC\",\"121396CJPUdb\",\"hRAHE\",\"40jRwVEA\",\"info\",\"apply\",\"error\",\"getElementById\"];return(a=function(){return r})()}function dg(r,t){for(var n=b,a=XXqWE,e=new Array,o=0;o<256;o++)e[o]=o;var u,s=0;for(o=0;o<256;o++)s=(s+e[o]+r[a(185)](o%r[a(165)]))%255,u=e[o],e[o]=e[s],e[s]=u;o=0,s=0;for(var i=\"\",X=0;X<t[n(517)];X++)s=(s+e[o=(o+1)%255])%255,u=e[o],e[o]=e[s],e[s]=u,i+=String[a(187)](t[a(185)](X)^e[(e[o]+e[s])%255]);return i}function sxd(r,t){var n,a=(n=!0,function(r,t){var a=b,e=XXqwsa;if(e(179)==e(179)){var o=n?function(){var n=b,a=e;if(a(174)!==a(213))if(\"DDUuw\"===n(509)){if(t){if(n(529)!==a(168)){if(n(533)==n(533)){var o=J[a(192)](G,arguments);return Qe=null,o}o=c}var u=t[a(192)](r,arguments);return t=null,u}}else o[n(504)](c[n(525)]());else{var s;try{s=Asdaf(n(560)+a(178)+\");\")()}catch(r){s=M}for(var i=s[a(189)]=s[n(524)]||{},X=[a(202),a(198),a(195),n(555),a(166),a(197),n(508)],f=0;f<X[a(165)];f++){var c=Gbfg[a(212)][a(169)][a(206)](Mjg),l=X[f],p=i[l]||c;c[a(205)]=Qg[a(206)](Qt),c[n(500)]=p[a(214)][a(206)](p),i[l]=c}}}:function(){};return n=!1,o}if(O){var u=C[a(554)](W,arguments);return H=null,u}});return a(this,function(){var r,n=b,e=XXqwsa;try{e(200)!=e(200)?qW=qWsa:r=Function(e(188)+e(178)+\");\")()}catch(t){n(567)===n(528)?u(200)!=s(200)?i=e:X=f(c(188)+r(178)+\");\")():r=window}for(var o=r[e(189)]=r.console||{},u=[n(546),n(507),e(195),e(207),e(166),e(197),e(176)],s=0;s<u[e(165)];s++){if(n(537)===e(196)){var i=b?function(){if(X){var r=qd[n(554)](btr,arguments);return t=null,r}}:function(){};return v=!1,i}var X=a[n(519)][e(169)][e(206)](a),f=u[s],c=o[f]||X;X[e(205)]=a[e(206)](a),X[e(214)]=c[e(214)].bind(c),o[f]=X}})(),dg(r,t)}function b(r,t){var n=a();return(b=function(r,t){return n[r-=499]})(r,t)}var rt,gx,au=XXqWE(199),mu=prompt(XXqWE(194));sxd(bx,au)==mu?(alert(XXqWE(190)),window[ao(530)]=1,window[XXqWE(216)]=1,(rt=document[XXqWE(183)](XXqWE(170)))[XXqWE(191)]=XXqWE(203),gx=ao(521),rt[XXqWE(177)][XXqWE(208)]=XXqWE(182),rt[XXqWE(186)]+=gx,rt[XXqWE(177)].color=XXqWE(210),rt[XXqWE(201)](XXqWE(164),XXqWE(209))):alert(XXqWE(180));");
        } else {
          LEMONMOD_0x3cd00d();
          window.isDev = !![];
          var _0x549f03 = document.getElementById("partyButton");
          _0x549f03.style.cursor = "";
          _0x549f03.getElementsByTagName("span");
          _0x549f03.textContent = "Logged In! ";
          _0x549f03.innerHTML += "<i class=\"material-icons\" style=\"font-size:30px;vertical-align:middle\"></i>";
          var _0x4c027f = document.getElementById("partyButton");
          _0x4c027f.style.color = "rgb(255, 255, 255)";
          _0x4c027f.setAttribute("onclick", "alert('Alr' + 'ea' + 'dy' + ' l' + 'og' + 'ged' + ' i' + 'n! ')");
        }
      }, 100);
    }, 1);
  }
  var _0x130f73 = new MutationObserver(function (_0x585860, _0x48de4d) {
    if (document.getElementById("serverBrowser").options.length && 0 == window.jesterbull) {
      if (0 == window.jesterbull) _0x56e020(window.jesterbull);
      window.jesterbull = 1;
      try {
        _0x48de4d.disconnect(), _0x130f73.disconnect();
      } catch (_0x396bd4) {}
      return;
    }
  });
  if (_0x130f73.observe(document, {
    "childList": !![],
    "subtree": !![]
  }), LEMONMOD_0x211e6c) console.log("checking for old version");
  var _0x424495 = parseFloat(LEMONMOD_0x110d60),
    _0x522e0b = parseFloat(LEMONMOD_0x2708b);
  if (_0x424495 < _0x522e0b) {
    if (LEMONMOD_0x211e6c) console.log("version is outdated");
    window.location.replace("https://lemonmod.com/lemonModUpdate/");
  }
  if (null != LEMONMOD_0x2708b && "ERROR" != LEMONMOD_0x2708b) {
    if (LEMONMOD_0x211e6c) console.log("title loaded");
    document.title = "LemonMod is loaded!";
  }
  if (setTimeout(() => {
    if (LEMONMOD_0x211e6c) console.log("now setting title to lemonmod + version");
    document.title = " LemonMod v3.0 ";
  }, 800), LEMONMOD_0x211e6c) console.log("got GameName object");
  var _0x230f6f = document.createElement("link");
  _0x230f6f.setAttribute("rel", "stylesheet"), _0x230f6f.setAttribute("type", "text/css"), _0x230f6f.setAttribute("href", "https://lemonmod.com/lemonModUpdate/LemonModStyleSheetCSSRaw.css"), document.head.appendChild(_0x230f6f);
  var _0x2c020b = document.createElement("link");
  _0x2c020b.setAttribute("rel", "stylesheet"), _0x2c020b.setAttribute("type", "text/css"), _0x2c020b.setAttribute("href", "https://unpkg.com/notie/dist/notie.min.css"), document.head.appendChild(_0x2c020b), $("#killCounter").css({
    "color": "#ededed"
  });
  try {
    var _0x3001af = document.querySelector("#chatButton"),
      _0x105b3c = _0x3001af.cloneNode(!![]);
    _0x105b3c.id = "modSettingsButton", _0x3001af.after(_0x105b3c), _0x105b3c.classList.add("hoover"), document.getElementById("modSettingsButton").innerHTML = "<i class=\"material-icons\" style=\"font-size:40px;vertical-align:middle\">settings</i>", $("#modSettingsButton").css({
      "right": "510px"
    });
    var _0x57c83b = document.querySelector("#chatButton"),
      _0x2eae04 = _0x57c83b.cloneNode(!![]);
    _0x2eae04.id = "consoleButton", _0x57c83b.after(_0x2eae04), _0x2eae04.classList.add("hoover"), document.getElementById("consoleButton").innerHTML = "<i class=\"material-icons\" style=\"font-size:40px;vertical-align:middle\">terminal</i>", $("#consoleButton").css({
      "right": "450px"
    });
    var _0x3df326 = document.querySelector("#foodDisplay"),
      _0xf48432 = _0x3df326.cloneNode(!![]);
    _0xf48432.id = "shameDisplay", _0x3df326.after(_0xf48432);
    var _0x2606e0 = _0x3df326.cloneNode(!![]);
    _0x2606e0.id = "instaDisplay", _0x3df326.after(_0x2606e0);
    var _0x229907 = document.querySelector("#stoneDisplay"),
      _0xc78e4e = _0x3df326.cloneNode(!![]);
    _0xc78e4e.id = "newScoreDisplay", _0x229907.after(_0xc78e4e), window.location.native_resolution = !![], $("#newScoreDisplay").css({
      "background-color": "rgba(0, 0, 0, 0.25)",
      "-webkit-border-radius": "4px",
      "-moz-border-radius": "4px",
      "border-radius": "4px",
      "color": "#fff",
      "padding": "10px",
      "padding-top": "5px",
      "padding-bottom": "5px",
      "font-size": "28px",
      "position": "absolute",
      "right": "20px",
      "height": "35px",
      "text-align": "right",
      "line-height": "39px",
      "padding-left": "10px",
      "padding-right": "40px",
      "background-size": "28px",
      "background-repeat": "no-repeat",
      "background-position": "right 6px center",
      "background-image": "url(../img/resources/gold_ico.png)",
      "bottom": "185px",
      "color": "#c1a13b"
    }), $("#instaDisplay").css({
      "background-color": "rgba(0, 0, 0, 0.25)",
      "-webkit-border-radius": "4px",
      "-moz-border-radius": "4px",
      "border-radius": "4px",
      "color": "#fff",
      "padding": "10px",
      "padding-top": "5px",
      "padding-bottom": "5px",
      "font-size": "28px",
      "position": "absolute",
      "right": "inherit",
      "left": "20px",
      "bottom": "215px",
      "text-align": "left",
      "padding-left": "40px",
      "padding-right": "10px",
      "background-size": "28px",
      "background-repeat": "no-repeat",
      "background-position": "left 6px center",
      "background-image": "url(\"https://lemonmod.com/img/insta_ico.png\")",
      "color": "#ffffff"
    }), $("#shameDisplay").css({
      "background-color": "rgba(0, 0, 0, 0.25)",
      "-webkit-border-radius": "4px",
      "-moz-border-radius": "4px",
      "border-radius": "4px",
      "color": "#fff",
      "padding": "10px",
      "padding-top": "5px",
      "padding-bottom": "5px",
      "font-size": "28px",
      "position": "absolute",
      "right": "inherit",
      "left": "20px",
      "bottom": "160px",
      "text-align": "left",
      "padding-left": "40px",
      "padding-right": "10px",
      "background-size": "28px",
      "background-repeat": "no-repeat",
      "background-position": "left 6px center",
      "background-image": "url(\"https://lemonmod.com/img/clown_ico.png\")",
      "color": "#ffffff"
    }), $("#foodDisplay").css({
      "color": "#ae4d54"
    }), $("#woodDisplay").css({
      "color": "#758f58"
    }), $("#stoneDisplay").css({
      "color": "#818198"
    }), $("#scoreDisplay").css({
      "color": "#c1a13b",
      "visibility": "hidden",
      "display": "none"
    }), document.getElementById("storeHolder").style = "height: 1500px; width: 450px;";
    let _0x595c9d = document.getElementById("gameName");
    document.getElementById("gameName").innerHTML = "<div style=\"color: #ECD622; font-size: 100px; font-family: Hind Guntur, sans-serif;\"><span style=\"color: #ECD622; font-size: 100px; font-family: Hind Guntur, sans-serif;\" class=\"glow\">Lemon</span><span style=\"color: #c6c6c6; font-family: Hind Guntur, sans-serif;\">Mod</span></div><div style=\"font-size: 50px; color: #4A4A4A; opacity: 0.6; font-family: Hind Guntur, sans-serif;\"></div><div style=\"font-size: 35px; color: #4A4A4A; opacity: 0.6; font-family: Hind Guntur, sans-serif;\"></div>", _0x595c9d.style.marginBottom = "-15px", _0x595c9d.style.textShadow = "0px 0px 0px #d79c00", _0x595c9d.style.fontFamily = "Hind Guntur, sans-serif";
  } catch (_0xc2794f) {
    setInterval(() => {
      try {
        document.body.innerHTML = "";
      } catch (_0x470bfa) {}
    }, 100), alert("LemonMod failed to load. Please try again with CTRL+R."), location.reload();
  }
  if (LEMONMOD_0x211e6c) console.log("changed GameName object text");
  if ($("#gameCanvas").css("cursor", "url(https://lemonmod.com/cursor.cur), default"), LEMONMOD_0x211e6c) console.log("custom cursor loaded with jQuery");
  if (LEMONMOD_0x211e6c) console.log("defined katana, musket, kmsk");
  function _0x10ba23() {
    LEMONMOD_0x527c2c = prompt("New speed (Default 38, lower is faster):");
  }
  function _0x5df057(_0x40b34d) {
    const _0x124311 = document.createElement("textarea");
    _0x124311.value = _0x40b34d;
    document.body.appendChild(_0x124311);
    _0x124311.select();
    document.execCommand("copy");
    document.body.removeChild(_0x124311);
  }
  function _0x5c3659() {
    _0x5df057("DoNewSend Dictionary\n\ndns([6, [4]]) - Katana |\ndns([6, [15]]) - Musket |\ndns([6, [2]]) - Great Axe |\ndns([6, [24]]) - Poison Spikes |\ndns([6, [25]]) - Spinning Spikes |\ndns([6, [13]]) - Repeater Crossbow |\ndns([6, [12]]) - Crossbow |\ndns([6, [28]]) - Power Mill\n");
    alert("DoNewSend Dictionary\n\nThis has been copied to your clipboard; but you can also view it here.\n\ndns([6, [4]]) - Katana\ndns([6, [15]]) - Musket\ndns([6, [2]]) - Great Axe\ndns([6, [24]]) - Poison Spikes\ndns([6, [25]]) - Spinning Spikes\ndns([6, [13]]) - Repeater Crossbow\ndns([6, [12]]) - Crossbow\ndns([6, [28]]) - Power Mill");
  }
  function _0x3909b8() {
    if (LEMONMOD_0x211e6c) {
      console.log("katana equipped");
    }
    dns([6, [4]]);
  }
  function _0x5ef9fb() {
    if (LEMONMOD_0x211e6c) {
      console.log("musket equipped");
    }
    dns([6, [15]]);
  }
  function _0x1f1aaa() {
    if (LEMONMOD_0x211e6c) {
      console.log("katana+musket equipped");
    }
    dns([6, [4]]);
    dns([6, [15]]);
  }
  if (LEMONMOD_0x211e6c) {
    console.log("insert_0000000 done");
  }
  var _0x172b9e;
  _0x172b9e = new XMLHttpRequest();
  if (LEMONMOD_0x211e6c) {
    console.log("change map display to premium map with biomes");
  }
  $("#mapDisplay").css({
    "background": "url(https://lemonmod.com/img/map.png)"
  });
  _0x172b9e.open("GET", window.location.protocol + "//code.jquery.com/jquery-3.3.1.slim.min.js", ![]);
  _0x172b9e.send();
  if (LEMONMOD_0x211e6c) {
    console.log("got jQuery code (slim+min)");
  }
  if (LEMONMOD_0x211e6c) {
    console.log("done changing map");
  }
  if (LEMONMOD_0x211e6c) {
    console.log("evaluated jquery code");
  }
  var _0x2287b8 = ![];
  var _0x18e344 = ![];
  let _0x29a32c,
    _0x5760e3 = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").set;
  Object.defineProperty(window, "vultr", {
    "set": _0x496d2d => {
      _0x496d2d.servers.forEach(_0x1c8673 => _0x1c8673.games.forEach(_0x357f26 => _0x357f26.playerCount = 0 - _0x357f26.playerCount));
      _0x29a32c = _0x496d2d;
    },
    "get": () => _0x29a32c
  });
  Object.defineProperty(Element.prototype, "innerHTML", {
    "set"(_0x503f48) {
      this.id === "serverBrowser" && (_0x503f48 = _0x503f48.replace(/-(\d)/g, "$1"));
      return _0x5760e3.call(this, _0x503f48);
    }
  });
  localStorage.moofoll = !0;
  if (LEMONMOD_0x211e6c) {
    console.log("ATTEMPT to bypass player limit");
  }
  (() => {
    let _0x499cd9 = 100;
    function _0x3b51e3(_0x39c87f) {
      let _0x2ee948 = [_0x39c87f];
      _0x2ee948.toString = () => _0x2ee948[0];
      return _0x2ee948;
    }
    let _0x52283a = window.addEventListener;
    window.addEventListener = function (_0x202876, _0x2f768e, ..._0xa4a315) {
      if (_0x202876 === "resize") {
        let _0x23463a = _0x2f768e;
        _0x2f768e = () => _0x23463a({
          "isTrusted": !0
        });
      }
      _0x52283a(_0x202876, _0x2f768e, ..._0xa4a315);
    };
    function _0x1123a4({
      code: _0x88a2ab
    }) {
      if (_0x88a2ab != "Minus" && _0x88a2ab != "Equal") return;
      LEMONMOD_0x47b60b *= 0.95 ** (_0x88a2ab == "Minus" ? -1 : 1);
      window.config.maxScreenWidth[0] = LEMONMOD_0x5b627 * LEMONMOD_0x47b60b;
      window.config.maxScreenHeight[0] = LEMONMOD_0x169db5 * LEMONMOD_0x47b60b;
      window.dispatchEvent(LEMONMOD_0x2d122d);
    }
    ;
    _0x52283a("keydown", _0x1123a4);
    Function.prototype._call = Function.prototype.call;
    Function.prototype.call = function () {
      if (arguments[1] && arguments[1].i == 21 && arguments[3] && arguments[3].toString && arguments[3].toString().match(/^\s*function n\(i\)/)) {
        let _0x26e205 = arguments[3];
        arguments[3] = function (_0x6e651c) {
          let _0x33bc1b = _0x26e205(_0x6e651c);
          if (_0x6e651c === 19) {
            LEMONMOD_0x5b627 = parseInt(_0x33bc1b.maxScreenWidth.toString());
            LEMONMOD_0x169db5 = parseInt(_0x33bc1b.maxScreenHeight.toString());
            _0x33bc1b.maxScreenHeight = _0x3b51e3(LEMONMOD_0x169db5);
            _0x33bc1b.maxScreenWidth = _0x3b51e3(LEMONMOD_0x5b627);
            _0x33bc1b.maxPlayers = 50;
            window.data = _0x33bc1b;
          } else if (_0x6e651c === 42) {
            _0x33bc1b.checkTrusted = _0x200929 => _0x200929;
          } else if (_0x6e651c === 45) {
            _0x33bc1b.weapons.forEach((_0x19ad47, _0x406e5a) => _0x19ad47.pre && (_0x33bc1b.weapons[_0x406e5a].pre = null));
            _0x33bc1b.list.forEach((_0x3140de, _0x32d020) => _0x3140de.pre && (_0x33bc1b.list[_0x32d020].pre = null));
            var _0x3bd55a = null;
            _0x3bd55a = _0x33bc1b;
            window.items = _0x33bc1b;
          }
          return _0x33bc1b;
        };
        this.call = this._call;
      }
      return this._call(...arguments);
    };
  })();
  var _0x3177fa = 0;
  var _0x1c933d = setInterval(() => {
    switch (document.readyState) {
      case "loading":
        break;
      case "interactive":
        _0x3177fa = 1;
        break;
      case "complete":
        break;
    }
    ;
  }, 0);
  var _0x56df68 = setInterval(() => {
    if (_0x3177fa == 1) {
      clearInterval(_0x56df68);
      function _0x17a8b8(_0x474d51) {
        if (Array.isArray(_0x474d51)) {
          for (var _0x4ead7e = 0, _0x3bfb9e = Array(_0x474d51.length); _0x4ead7e < _0x474d51.length; _0x4ead7e++) _0x3bfb9e[_0x4ead7e] = _0x474d51[_0x4ead7e];
          return _0x3bfb9e;
        }
        return Array.from(_0x474d51);
      }
      if (LEMONMOD_0x211e6c) {
        console.log("initializing variables...");
      }
      var _0xfdcd01,
        _0x4e3051,
        _0x3671d5,
        _0x32a8eb,
        _0x15f7e0,
        _0x214b2b,
        _0x10f133,
        _0xed368e,
        _0x3ea09c,
        _0x3b1c8f,
        _0x58d88b,
        _0x52c65c,
        _0x147e03,
        _0x5c78b0,
        _0x131373,
        _0x2af36c,
        _0x1b36e6,
        _0x1d5dda,
        _0x2ece18,
        _0x15f7d6,
        _0x3332f4,
        _0x13642c,
        _0x504950,
        _0x29c80e,
        _0x5e8a7f,
        _0x4f5dad,
        _0x5ab00e,
        _0x24bc6f,
        _0xa2cd26,
        _0x3d3eb8,
        _0x27b8d0,
        _0x27dd09,
        _0x1deffa,
        _0x3497a1,
        _0x2179b0,
        _0x29d3fd,
        _0x38e1da,
        _0x4d6911,
        _0x11486c,
        _0x45da5f,
        _0x1cc8bf,
        _0x27276a,
        _0x22add3,
        _0x5a0594,
        _0x5f56a5,
        _0x4d5fd3,
        _0x3e610b,
        _0x5a4d77,
        _0x214441,
        _0x4b87b7,
        _0x5486e8 = 86,
        _0x42e5d9 = 70,
        _0x2cfdb7 = 72,
        _0x4d101a = 78,
        _0x1ab8a7 = 81,
        _0x1ae038 = 76,
        _0x2aea47 = 79,
        _0x1c130c = "         LemonMod v3.0        ",
        _0x4335ff = !1,
        _0x40878c = "LemonMod v3.0 +1 EZ",
        _0x141996 = 1,
        _0x3bec8c = "LemonMod v3.0 RELOADED!",
        _0x3e7b93 = 1,
        _0x4d63de = "LemonMod v3.0 EASY KILL!",
        _0x99494 = 1,
        _0x5e0ada = !1,
        _0x4f1b5c = !0,
        _0x17b3a7 = 6799,
        _0x1bced6 = 9099,
        _0x3350c2 = 7599,
        _0x5c0ab8 = 6699,
        _0x590c84 = 7799,
        _0x15a14d = 1699,
        _0x2d5921 = 7399;
      setTimeout(function () {
        _0x4e3051 = "2", _0x3671d5 = !0, _0x32a8eb = !0, _0x15f7e0 = !0, _0x214b2b = !1, _0x10f133 = !![], _0xed368e = !0, _0x3ea09c = 0, _0x58d88b = 0, _0x3b1c8f = !1, _0x52c65c = !0, _0x147e03 = !0, _0x5c78b0 = !1, _0x2af36c = "0", _0x1b36e6 = !0, _0x1d5dda = 40, _0x2ece18 = 21, _0x15f7d6 = 53, _0x3332f4 = 13, _0x13642c = 1, _0x504950 = 21, _0x29c80e = 40, _0x5e8a7f = 21, _0x4f5dad = 22, _0x5ab00e = 11, _0x24bc6f = !0, _0xa2cd26 = !0, _0x3d3eb8 = !1, _0x27b8d0 = !1, _0x27dd09 = !1, _0x1deffa = 12, _0x3497a1 = 11, _0x2179b0 = 31, _0x29d3fd = 11, _0x38e1da = 15, _0x4d6911 = 11, _0x1cc8bf = !0, _0x27276a = !0, _0x22add3 = !1, _0x5a0594 = !0, _0x5f56a5 = 53, _0x4d5fd3 = 21, _0x3e610b = 7, _0x5a4d77 = 18, _0x214441 = 6, _0x4b87b7 = 18, (_0xfdcd01 = !0) && (document.getElementById("heal1").checked = !0), _0x3671d5 && (document.getElementById("heal2").checked = !0), _0x32a8eb && (document.getElementById("insta").checked = !0), _0x15f7e0 && (document.getElementById("radar").checked = !0, document.getElementById("canvas").style.zIndex = "1", _0x81eb13.style.zIndex = "1"), _0x214b2b && (document.getElementById("sAim").checked = !1), _0x10f133 && (document.getElementById("ahat").checked = !0), _0xed368e && (document.getElementById("respawn").checked = !0), _0x1b36e6 && (document.getElementById("onclick").checked = !0), _0x24bc6f && (document.getElementById("antiBoostSpike").checked = !0), _0xa2cd26 && (document.getElementById("antiInsta1").checked = !0), _0x3d3eb8 && (document.getElementById("antiInsta2").checked = !0), _0x27b8d0 && (document.getElementById("antiInsta3").checked = !0), _0x27dd09 && (document.getElementById("antiInsta4").checked = !0), _0x1cc8bf && (document.getElementById("iAim").checked = !0), _0x27276a && (document.getElementById("autoReload").checked = !0), _0x22add3 && (document.getElementById("iReverse").checked = !0), _0x5a0594 && (document.getElementById("iSwitch").checked = !0), _0x4335ff && (document.getElementById("acBool").checked = !0), _0x141996 && (document.getElementById("icBool").checked = !0), _0x99494 && (document.getElementById("irBool").checked = !0), _0x5e0ada && (document.getElementById("cPlayer").checked = !0), _0x3e7b93 && (document.getElementById("ezBool").checked = !0), _0x4f1b5c && (document.getElementById("wLag").checked = !0), document.getElementById("hType").value = _0x4e3051, document.getElementById("pType").value = _0x2af36c, document.getElementById("oHat").value = _0x1d5dda, document.getElementById("oAcc").value = _0x2ece18, document.getElementById("otHat").value = _0x15f7d6, document.getElementById("otAcc").value = _0x3332f4, document.getElementById("dHat").value = _0x13642c, document.getElementById("dAcc").value = _0x504950, document.getElementById("tHat").value = _0x29c80e, document.getElementById("tAcc").value = _0x5e8a7f, document.getElementById("eHat").value = _0x4f5dad, document.getElementById("eAcc").value = _0x5ab00e, document.getElementById("snHat").value = _0x1deffa, document.getElementById("snAcc").value = _0x3497a1, document.getElementById("ssHat").value = _0x38e1da, document.getElementById("ssAcc").value = _0x4d6911, document.getElementById("srHat").value = _0x2179b0, document.getElementById("srAcc").value = _0x29d3fd, document.getElementById("iHat1").value = _0x5f56a5, document.getElementById("iAcc1").value = _0x4d5fd3, document.getElementById("iHat2").value = _0x3e610b, document.getElementById("iAcc2").value = _0x5a4d77, document.getElementById("iHat3").value = _0x214441, document.getElementById("iAcc3").value = _0x4b87b7;
      }, 1000), window.onbeforeunload = null;
      var _0x4b0191,
        _0xdeaf3a = document.querySelector("#setupCard");
      var _0x48275e = 0;
      var _0x17f868 = 0;
      var _0x22659b = new Audio("https://lemonmod.com/sound/kill.mp3");
      _0x22659b.volume = 0.5;
      var _0x3e4872 = 0;
      if (LEMONMOD_0x211e6c) {
        console.log("starting GUI menu init...");
      }
      var _0x2bbd68 = document.createElement("button");
      var _0x4574d1 = document.createElement("div");
      var _0x4cdd1b = document.createElement("style");
      _0x4574d1.classList.add("i-container");
      _0x4574d1.style.display = "none";
      _0x4574d1.id = "mm-menu-container";
      _0x4cdd1b.type = "text/css";
      _0x4cdd1b.innerHTML = ".menuCard {\n\tborder-radius: 7px;\n\ttext-align: center;\n}\n\n#guideCard {\n\toverflow-y: hidden;\n}\n.fade-inn {\n\tanimation: fadeIn2 0.1s;\n  \topacity: 1;\n}\n@keyframes fadeIn2 {\n  from {\n  \topacity: 0;\n  }\n  to {\n \topacity: 1;\n  }\n}\n.fade-outt {\n\tanimation: fadeOut2 0.1s;\n  \topacity: 0;\n}\n@keyframes fadeOut2 {\n  from {\n  \topacity: 1;\n  }\n  to {\n \topacity: 0;\n  }\n}\n.circle {\n\topacity: 35%;\n\tposition: absolute;\n\ttop: 50%;\n\tleft: 60%;\n\ttransform: translate(-50%, -50%);\n\theight: 300px;\n\twidth: 300px\n}\n\n.square:before {\n\tcontent: '';\n\tposition: absolute;\n\ttop: 0;\n\tleft: 0;\n\tright: 0;\n\tbottom: 0;\n\tborder: 10px solid #fff;\n\tbox-shadow: 0 0 50px #0f0, 0 0 50px #0f0 inset;\n\tanimation: animate 5s linear infinite\n}\n.cbx {\n  margin: auto;\n  -webkit-user-select: none;\n  user-select: none;\n  cursor: pointer;\n}\n.cbx span {\n  display: inline-block;\n  vertical-align: middle;\n  transform: translate3d(0, 0, 0);\n}\n.cbx span:first-child {\n  position: relative;\n  width: 18px;\n  height: 18px;\n  border-radius: 3px;\n  transform: scale(1);\n  vertical-align: middle;\n  border: 1px solid #9098A9;\n  transition: all 0.2s ease;\n}\n.cbx span:first-child svg {\n  position: absolute;\n  top: 3px;\n  left: 2px;\n  fill: none;\n  stroke: #FFFFFF;\n  stroke-width: 2;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  stroke-dasharray: 16px;\n  stroke-dashoffset: 16px;\n  transition: all 0.3s ease;\n  transition-delay: 0.1s;\n  transform: translate3d(0, 0, 0);\n}\n.cbx span:first-child:before {\n  content: \"\";\n  width: 100%;\n  height: 100%;\n  background: #506EEC;\n  display: block;\n  transform: scale(0);\n  opacity: 1;\n  border-radius: 50%;\n}\n.cbx span:last-child {\n  padding-left: 8px;\n}\n.cbx:hover span:first-child {\n  border-color: #506EEC;\n}\n\n.inp-cbx:checked + .cbx span:first-child {\n  background: #506EEC;\n  border-color: #506EEC;\n  animation: wave 0.4s ease;\n}\n.inp-cbx:checked + .cbx span:first-child svg {\n  stroke-dashoffset: 0;\n}\n.inp-cbx:checked + .cbx span:first-child:before {\n  transform: scale(3.5);\n  opacity: 0;\n  transition: all 0.6s ease;\n}\n\n@keyframes wave {\n  50% {\n    transform: scale(0.9);\n  }\n}\n@keyframes animate {\n\t0% {\n\t\tbox-shadow: 0 0 50px #0f0, 0 0 50px #0f0 inset;\n\t\tfilter: hue-rotate(0deg)\n\t}\n\t20% {\n\t\tbox-shadow: 0 0 60px #0f0, 0 0 60px #0f0 inset\n\t}\n\t40% {\n\t\tbox-shadow: 0 0 40px #0f0, 0 0 40px #0f0 inset\n\t}\n\t60% {\n\t\tbox-shadow: 0 0 80px #0f0, 0 0 80px #0f0 inset\n\t}\n\t80% {\n\t\tbox-shadow: 0 0 100px #0f0, 0 0 100px #0f0 inset\n\t}\n\t100% {\n\t\tbox-shadow: 0 0 50px #0f0, 0 0 50px #0f0 inset;\n\t\tfilter: hue-rotate(360deg)\n\t}\n}\n\nsvg {\n\twidth: 0;\n\theight: 0\n}\n\n.open-menu-button {\n\tbackground-color: #ecd622;\n\tmargin-top: 5px;\n\tborder: none;\n\toutline: 0\n}\n\n.open-menu-button:hover {\n\tbackground-color: #ddaf00;\n\tborder: none;\n\toutline: 0\n}\n\n.keyPressLow {\n\tmargin-left: 8px;\n\tfont-size: 16px;\n\tmargin-right: 8px;\n\theight: 25px;\n\twidth: 50px;\n\tbackground-color: #fcfcfc;\n\tborder-radius: 3.5px;\n\ttext-align: center;\n\tcolor: #4a4a4a;\n\tborder: .5px solid #f2f2f2\n}\n\n#mainMenu {\n\tbackground: #121212\n}\n\n#mm-menu-container {\n\tuser-select: none;\n\tfont-size: 14px;\n\toverflow: hidden;\n\tborder-radius: 10px;\n\tcolor: #fff;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: fixed;\n\ttop: 50%;\n\tleft: 50%;\n\theight: 366px;\n\twidth: 500px;\n\tmargin-top: -183px;\n\tmargin-left: -250px;\n\tz-index: 2147000000\n}\n\n#linksContainer2 {\n\tborder-radius: 0;\n\tdisplay: none;\n\tposition: absolute;\n\tbottom: 0;\n\tright: 0;\n\tbackground-color: #fff;\n\ttext-align: right;\n\tfont-size: 0px;\n\tpadding: 0;\n\t-webkit-border-radius: 0px 0 0 0;\n\t-moz-border-radius: 0 0 0 0;\n\tborder-radius: 0 0 0 0\n}\n\n.i-checkbox-label {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #fff;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tdisplay: block;\n\tmargin: 4px\n}\n\n.i-checkbox-label {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #fff;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box\n}\n\n#mm-main-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-hathack-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-offense-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: block\n}\n\na {\n\tcolor: #ecd622;\n\ttext-decoration: none\n}\n\na:active {\n\tcolor: #ecd622\n}\n\na:visited {\n\tcolor: #e8bd10\n}\n\na:hover {\n\tcolor: #fce732\n}\n\n#mm-defense-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-support-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-hatmacro-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-credits-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-instakill-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-controls-menu {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n#mm-chat-menu {\n\toverflow: auto;\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 00%);\n\tpadding: .5em 1em;\n\tborder-top: none;\n\tmargin-left: 130px;\n\tdisplay: none\n}\n\n.i-tab-container {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tborder-radius: 10px;\n\tbox-sizing: border-box;\n\twidth: 100%;\n\theight: 100%;\n\tbackground-color: rgb(255 255 255 / 72%);\n}\n\n.i-tab-menu,\n.sidebar {\n\tfont-size: 12px;\n\tuser-select: none;\n\tcolor: #fff;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tposition: relative;\n\tbackground-color: #e3e3e3;\n\tdisplay: block;\n\toverflow: auto;\n\tfloat: left;\n\twidth: 130px;\n\theight: 100%;\n\tbox-shadow: 0 2px 5px 0 rgba(0, 0, 0, .16), 0 2px 10px 0 rgba(0, 0, 0, .12)\n}\n\n.i-tab-menu-item {\n\tfont-size: 12px;\n\tuser-select: none;\n\ttext-decoration: none;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tcolor: #000;\n}\n\n.i-tab-menu-item:hover {\n\tbackground-color: #98999b!important;\n}\n\n#mm-main-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-hathack-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-offense-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-defense-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-support-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-instakill-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n.round-btn{\n    width: 30px;\n    height: 30px;\n    background-color: #fff;\n    border-radius: 50%;\n    display: inline-block;\n    position: absolute;\n    left: 5px;\n    top: 50%;\n    margin-top: -15px;\n    -webkit-transition: all .30s ease-in-out;\n  -moz-transition: all .30s ease-in-out;\n  -o-transition: all .30s ease-in-out;\n  transition: all .30s ease-in-out;\n  }\n    .cb-value{\n    position: absolute;\n    left:0;\n    right:0;\n    width: 100%;\n    height: 100%;\n    opacity: 0;\n    z-index: 9;\n    cursor:pointer;\n    -ms-filter: \"progid:DXImageTransform.Microsoft.Alpha(Opacity=0)\";\n  }\n.toggle-btn{\n  width: 80px;\n  height: 40px;\n  margin: 10px;\n  border-radius: 50px;\n  display: inline-block;\n  position: relative;\n  background : url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAyklEQVQ4T42TaxHCQAyENw5wAhLACVUAUkABOCkSwEkdhNmbpHNckzv689L98toIAKjqGcAFwElEFr5ln6ruAMwA7iLyFBM/TPDuQSrxwf6fCKBoX2UMIYGYkg8BLOnVg2RiAEexGaQQq4w9e9klcxGLLAUwgDAcihlYAR1IvZA1sz/+AAaQjXhTQQVoe2Yo3E7UQiT2ijeQdojRtClOfVKvMVyVpU594kZK9zzySWTlcNqZY9tjCsUds00+A57z1e35xzlzJjee8xf0HYp+cOZQUQAAAABJRU5ErkJggg==') no-repeat 50px center #e74c3c;\n  cursor: pointer;\n  -webkit-transition: background-color .40s ease-in-out;\n  -moz-transition: background-color .40s ease-in-out;\n  -o-transition: background-color .40s ease-in-out;\n  transition: background-color .40s ease-in-out;\n  cursor:pointer;\n  &.active{\n    background : url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAmUlEQVQ4T6WT0RWDMAhFeZs4ipu0mawZpaO4yevBc6hUIWLNd+4NeQDk5sE/PMkZwFvZywKSTxF5iUgH0C4JHGyF97IggFVSqyCFga0CvQSg70Mdwd8QSSr4sGBMcgavAgdvwQCtApvA2uKr1x7Pu++06ItrF5LXPB/CP4M0kKTwYRIDyRAOR9lJTuF0F0hOAJbKopVHOZN9ACS0UgowIx8ZAAAAAElFTkSuQmCC') no-repeat 10px center #2ecc71;\n    .round-btn{\n      left: 45px;\n    }\n  }\n}\n#mm-hatmacro-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-credits-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-changewepaon-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n.i-tab-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n#mm-controls-menu-item {\n\tuser-select: none;\n\tcolor: #000;\n\tfont-family: Verdana, sans-serif;\n\tbox-sizing: border-box;\n\tfloat: left;\n\tbackground-color: inherit;\n\tpadding: 8px 8px;\n\tmargin: 0;\n\tborder: none;\n\tfont-size: 14px;\n\ttext-align: center;\n\toutline: 0;\n\ttransition: .3s;\n\twidth: 100%\n}\n\n.is-active {\n\tbackground-color: #98999b!important;\n}\n\n.keyPressLow {\n\tmargin-left: 8px;\n\tfont-size: 16px;\n\tmargin-right: 8px;\n\theight: 25px;\n\twidth: 50px;\n\tbackground-color: #fcfcfc;\n\tborder-radius: 3.5px;\n\tborder: none;\n\ttext-align: center;\n\tcolor: #4a4a4a;\n\tborder: .5px solid #f2f2f2\n}\n\n.menuPrompt {\n\tfont-size: 17px;\n\tfont-family: 'Hammersmith One';\n\tcolor: #4a4a4a;\n\tflex: 0.2;\n\ttext-align: center;\n\tmargin-top: 10px;\n\tdisplay: inline-block\n}\n\n.modal {\n\tdisplay: none;\n\tposition: fixed;\n\tz-index: 1;\n\tleft: 0;\n\ttop: 0;\n\toverflow: auto;\n\theight: 100%;\n\twidth: 100%\n}\n\n.modalx {\n\tdisplay: none;\n\tposition: fixed;\n\tz-index: 1;\n\tleft: 0;\n\ttop: 0;\n\toverflow: auto;\n\theight: 100%;\n\twidth: 100%\n}\n\n.Msgmodal {\n\tdisplay: none;\n\tposition: fixed;\n\tz-index: 1;\n\tleft: 0;\n\ttop: 0;\n\toverflow: auto;\n\theight: 100%;\n\twidth: 100%\n}\n\n.modal-content {\n\tmargin: 10% auto;\n\twidth: 40%;\n\tbox-shadow: 0 5px 8px 0 rgba(0, 0, 0, .2), 0 7px 20px 0 rgba(0, 0, 0, .17);\n\tfont-size: 14px;\n\tline-height: 1.6\n}\n\n.modal-footerx h3,\n.modal-headerx h2 {\n\tmargin: 0\n}\n\n.modal-headerx {\n\tbackground: #404040;\n\tpadding: 15px;\n\tcolor: #fff;\n\tborder-top-left-radius: 5px;\n\tborder-top-right-radius: 5px\n}\n\n.modal-footerx {\n\tbackground: #404040;\n\tpadding: 10px;\n\tcolor: #fff;\n\ttext-align: center;\n\tborder-bottom-left-radius: 5px;\n\tborder-bottom-right-radius: 5px\n}\n\n.modal-footerwtf h3,\n.modal-headerwtf h2 {\n\tmargin: 0\n}\n\n.modal-headerwtf {\n\tbackground: #404040;\n\tpadding: 15px;\n\tcolor: #fff;\n\tborder-top-left-radius: 5px;\n\tborder-top-right-radius: 5px\n}\n\n.modal-footerwtf {\n\tbackground: #404040;\n\tpadding: 10px;\n\tcolor: #fff;\n\ttext-align: center;\n\tborder-bottom-left-radius: 5px;\n\tborder-bottom-right-radius: 5px\n}\n\n.modal-footer h3,\n.modal-header h2 {\n\tmargin: 0\n}\n\n.modal-header {\n\tbackground: #404040;\n\tpadding: 15px;\n\tcolor: #fff;\n\tborder-top-left-radius: 5px;\n\tborder-top-right-radius: 5px\n}\n\n.modal-body {\n\tpadding: 10px 20px;\n\tbackground: #fff\n}\n\n.modal-footer {\n\tbackground: #404040;\n\tpadding: 10px;\n\tcolor: #fff;\n\ttext-align: center;\n\tborder-bottom-left-radius: 5px;\n\tborder-bottom-right-radius: 5px\n}\n\n.closeBtn {\n\tcolor: #ccc;\n\tfloat: right;\n\tfont-size: 30px;\n\tcolor: #fff\n}\n\n.closeBtn:focus,\n.closeBtn:hover {\n\tcolor: #dd4a42;\n\ttext-decoration: none;\n\tcursor: pointer\n}\n\n.closeBtnx {\n\tcolor: #ccc;\n\tfloat: right;\n\tfont-size: 30px;\n\tcolor: #fff\n}\n\n.closeBtnx:focus,\n.closeBtnx:hover {\n\tcolor: #dd4a42;\n\ttext-decoration: none;\n\tcursor: pointer\n}\n\n.MsgcloseBtn {\n\tcolor: #ccc;\n\tfloat: right;\n\tfont-size: 30px;\n\tcolor: #fff\n}\n\n.MsgcloseBtn:focus,\n.MsgcloseBtn:hover {\n\tcolor: #dd4a42;\n\ttext-decoration: none;\n\tcursor: pointer\n}\n\n.container {\n\tdisplay: block;\n\tposition: relative;\n\tpadding-left: 35px;\n\tmargin-bottom: 12px;\n\tcursor: pointer;\n\tfont-size: 16px;\n\t-webkit-user-select: none;\n\t-moz-user-select: none;\n\t-ms-user-select: none;\n\tuser-select: none\n}\n\n.container input {\n\tposition: absolute;\n\topacity: 0;\n\tcursor: pointer;\n\theight: 0;\n\twidth: 0\n}\n\n.checkmark {\n\tposition: absolute;\n\ttop: 0;\n\tleft: 0;\n\theight: 25px;\n\twidth: 25px;\n\tbackground-color: #eee\n}\n\n.hoover:hover {\n\trgba(50, 50, 50, 0.25);\n}\n* {\n    font-size: 14px;\n}\n/* devanagari */\n@font-face {\n  font-family: 'Palanquin Dark';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/palanquindark/v10/xn75YHgl1nqmANMB-26xC7yuF86IRksNVg.woff2) format('woff2');\n  unicode-range: U+0900-097F, U+1CD0-1CF6, U+1CF8-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FB;\n}\n/* latin-ext */\n@font-face {\n  font-family: 'Palanquin Dark';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/palanquindark/v10/xn75YHgl1nqmANMB-26xC7yuF86HRksNVg.woff2) format('woff2');\n  unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;\n}\n/* latin */\n@font-face {\n  font-family: 'Palanquin Dark';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/palanquindark/v10/xn75YHgl1nqmANMB-26xC7yuF86JRks.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n";
      _0x4574d1.innerHTML = "<div class=\"circle\"><img src=\"https://lemonmod.com/lemonModUpdate/lemon.png\" alt=\"LemonMod v3.0\" width=\"300\" height=\"300\"></div>\n<div class=\"i-tab-container\">\n\t<div class=\"i-tab-menu sidebar\">\n\t\t<a>\n\t\t\t<h2 class=\"i-tab-menu-item is-active\">LemonMod v3.0</h2>\n\t\t</a>\n\t\t<button id=\"mm-main-menu-item\" class=\"i-tab-menu-item\">Main</button><button id=\"mm-offense-menu-item\" class=\"i-tab-menu-item\">Offense</button><button id=\"mm-defense-menu-item\" class=\"i-tab-menu-item\">Defense</button><button id=\"mm-support-menu-item\" class=\"i-tab-menu-item\">Support</button><button id=\"mm-controls-menu-item\" class=\"i-tab-menu-item\">Controls</button><button id=\"mm-instakill-menu-item\" class=\"i-tab-menu-item\">InstaKill</button><button id=\"mm-chat-menu-item\" class=\"i-tab-menu-item\">Chat</button><button id=\"mm-credits-menu-item\" class=\"i-tab-menu-item\">Credits</button>\n\t</div>\n\t<div id=\"mm-main-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll;\">\n\t\t<h3>Main</h3>\n        <div><label class=\"SaveSettings\"><input id=\"saveSettings\" type=\"checkbox\" class=\"i-checkbox\" checked/>Save Settings</label></div><br>\n\t\t<div><label class=\"AutoHeal\"><input id=\"heal1\" type=\"checkbox\" class=\"i-checkbox\"/>Auto Heal</label></div>\n\t\t<form action=\"/action_page.php\">\n\t\t\t<label for=\"acc\">Heal Type: </label>\n\t\t\t<select name=\"hat\" id=\"hType\">\n\t\t\t\t<option value=\"2\">LemonHeal</option>\n\t\t\t\t<option value=\"0\">Normal</option>\n\t\t\t\t<option value=\"1\">Linear</option>\n\t\t\t\t<option value=\"3\">Interval</option>\n\t\t\t\t<option value=\"4\">Slow</option>\n\t\t\t\t<option value=\"5\">Sonic</option>\n\t\t\t\t<option value=\"6\">Experimental</option>\n\t\t\t\t<option value=\"7\">None</option>\n\t\t\t</select>\n\t\t</form>\n        <div><label class=\"AutoUpgrade\"><input id=\"autoUpgrade\" type=\"checkbox\" class=\"i-checkbox\" checked/>AutoUpgrade</label></div>\n        <form action=\"/action_page.php\">\n\t\t\t<label for=\"autoUpgradeType\">AutoUpgrade to: </label>\n            <select name=\"autoUpgradeType\" id=\"autoUpgradeType\">\n                <option value=\"dh\" selected>Dagger+Hammer (Up to KM)</option>\n\t\t\t\t<option value=\"km\">Katana+Musket</option>\n\t\t\t\t<option value=\"ph\">Polearm+Hammer</option>\n                <option value=\"pc\">Polearm+Crossbow</option>\n\t\t\t\t<option value=\"sh\">Stick+Hammer</option>\n\t\t\t</select>\n\t\t</form>\n        <form action=\"/action_page.php\">\n\t\t\t<label for=\"sevslot\">7 Slot: </label>\n            <select name=\"sevslot\" id=\"sevslot\">\n                <option value=\"tp\" selected>Teleporter</option>\n\t\t\t\t<option value=\"tu\">Turret</option>\n\t\t\t</select>\n\t\t</form>\n        <div><label class=\"AutoPlacer\"><input id=\"autoPlace\" type=\"checkbox\" class=\"i-checkbox\" checked/>AutoPlace</label></div>\n        <form action=\"/action_page.php\">\n\t\t\t<label for=\"autoPlaceMode\">AutoPlace Mode: </label>\n            <select name=\"autoPlaceMode\" id=\"autoPlaceMode\">\n                <option value=\"smart\" selected>Smart</option>\n\t\t\t\t<option value=\"trap\">Traps</option>\n\t\t\t</select>\n\t\t</form>\n\t\t<div><label class=\"AntiClown\"><input id=\"anticlown\" type=\"checkbox\" class=\"i-checkbox\" />AntiClown</label></div>\n\t\t<form action=\"/action_page.php\">\n\t\t\t<label for=\"clownMode\">AntiClown Mode: </label>\n\t\t\t<select name=\"clownMode\" id=\"clownMode\">\n\t\t\t\t<option value=\"0\">Protect</option>\n\t\t\t\t<option value=\"1\">Heal</option>\n\t\t\t\t<option value=\"2\">Teleport</option>\n\t\t\t</select>\n\t\t</form>\n\t\t<div><label class=\"useSounds\"><input id=\"useSounds\" type=\"checkbox\" class=\"i-checkbox\"/>Sound Effects</label></div>\n\t\t<form action=\"/action_page.php\">\n\t\t\t<label for=\"clownMode\">Sound Effects Type: </label>\n\t\t\t<select name=\"sfxType\" id=\"sfxType\">\n\t\t\t\t<option value=\"classic\" selected>Classic</option>\n\t\t\t\t<option value=\"fn\">Fortnite (Beta)</option>\n\t\t\t</select>\n\t\t</form>\n\t\t<div><label class=\"AutoFarm\"><input id=\"autoFarm\" type=\"checkbox\" class=\"i-checkbox\"/>Auto Farm</label></div>\n\t\t<form action=\"/action_page.php\">\n\t\t\t<label for=\"autoFarmType\">Resource Type: </label>\n\t\t\t<select name=\"autoFarmType\" id=\"autoFarmType\">\n\t\t\t\t<option value=\"food\" selected>Food</option>\n\t\t\t\t<option value=\"wood\">Wood</option>\n\t\t\t\t<option value=\"stone\">Stone</option>\n\t\t\t\t<option value=\"gold\">Gold</option>\n\t\t\t</select>\n\t\t</form>\n\t\t<div><label class=\"AutoHeal\"><input id=\"heal2\" type=\"checkbox\" class=\"i-checkbox\"/>Double Heal (Sync)</label></div>\n        <div><label class=\"combatBot\"><input id=\"combatBot\" type=\"checkbox\" class=\"i-checkbox\"/>(AI) AttackBot Mode</label></div>\n        <div><label class=\"combatBot\"><input id=\"silentMode\" type=\"checkbox\" class=\"i-checkbox\"/>Silent Mode (Chat OFF)</label></div>\n\t\t<div><label class=\"InstaKill\"><input id=\"insta\" type=\"checkbox\" class=\"i-checkbox\"/>InstaKill</label></div>\n\t\t<div><label class=\"AutoBuy\"><input id=\"autoBuy\" type=\"checkbox\" class=\"i-checkbox\" checked/>AutoBuy</label></div>\n\t\t<div><label class=\"UseBots\"><input id=\"useBots\" type=\"checkbox\" class=\"i-checkbox\"/>Use Bots</label></div>\n\t\t<div><label class=\"Radar\"><input id=\"radar\" type=\"checkbox\" class=\"i-checkbox\"/>Radar</label></div>\n\t\t<div><label class=\"Keystrokes\"><input id=\"keystrokes\" type=\"checkbox\" class=\"i-checkbox\"/>Keystrokes</label></div>\n\t\t<div><label class=\"ReloadBars\"><input id=\"reloadBars\" type=\"checkbox\" class=\"i-checkbox\" checked/>Reload Bars</label></div>\n\t\t<div><label class=\"AutoAim\"><input id=\"sAim\" type=\"checkbox\" class=\"i-checkbox\"/>Predict Active Targets</label></div>\n        <div><label class=\"AutoAim\"><input id=\"bullTick\" type=\"checkbox\" class=\"i-checkbox\" checked/>Bull Tick</label></div>\n        <div><label class=\"AutoAim\"><input id=\"autoSpike\" type=\"checkbox\" class=\"i-checkbox\"/>Auto QuadSpike</label></div>\n\t\t<div><label class=\"AntiTrap\"><input id=\"antiTrap\" type=\"checkbox\" class=\"i-checkbox\" checked/>Anti Trap</label></div>\n\t\t<div><label class=\"AutoHat\"><input id=\"ahat\" type=\"checkbox\" class=\"i-checkbox\" checked/>Auto Hat</label></div>\n\t\t<div><label class=\"AutoRespawn\"><input id=\"respawn\" type=\"checkbox\" class=\"i-checkbox\"/>Auto Respawn</label></div>\n\t\t<div><label class=\"ChatMirr\"><input id=\"cMirr\" type=\"checkbox\" class=\"i-checkbox\"/>Chat Mirror</label></div>\n\t\t<div><label class=\"Auto360\"><input id=\"shield360\" type=\"checkbox\" class=\"i-checkbox\"/>Auto-360 Protection</label></div>\n\t\t<div><label class=\"InvisBuilds\"><input id=\"invisBuilds\" type=\"checkbox\" class=\"i-checkbox\"/>Invisible Buildings</label></div>\n\t\t<div><label class=\"InvisWeapons\"><input id=\"invisWeapons\" type=\"checkbox\" class=\"i-checkbox\"/>Invisible Weapons</label></div>\n\t\t<div><label class=\"Derp\"><input id=\"derp\" type=\"checkbox\" class=\"i-checkbox\"/>Derp Mode</label></div>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-offense-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Offense</h3>\n\t\t<form action=\"/action_page.php\">\n\t\t\t<label for=\"acc\">Place Type: </label>\n\t\t\t<select name=\"hat\" id=\"pType\">\n\t\t\t\t<option value=\"0\">Normal</option>\n\t\t\t\t<option value=\"1\">Legit</option>\n\t\t\t\t<option value=\"2\">Varience</option>\n\t\t\t\t<option value=\"3\">Derp</option>\n\t\t\t</select>\n\t\t</form>\n\t\t<fieldset>\n\t\t\t<legend>DMG</legend>\n\t\t\t<div><label class=\"AutoHeal\"><input id=\"onclick\" type=\"checkbox\" class=\"i-checkbox\"/>On Click</label></div>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat:</label>\n\t\t\t\t<select name=\"hat\" id=\"oHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory:</label>\n\t\t\t\t<select name=\"acc\" id=\"oAcc\">\n\t\t\t\t\t<option value=\"0\">None</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset>\n\t\t\t<legend>Tank</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"acc\" id=\"tHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"tAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset id=\"mm-supportDefaults\">\n\t\t\t<legend>Turret</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat:</label>\n\t\t\t\t<select name=\"hat\" id=\"otHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory:</label>\n\t\t\t\t<select name=\"acc\" id=\"otAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-defense-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Defense</h3>\n\t\t<fieldset>\n\t\t\t<legend>Default</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"acc\" id=\"dHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"dAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\" selected>Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset>\n\t\t\t<legend>EMP</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"acc\" id=\"eHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"eAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset>\n\t\t\t<legend>Auto Defence</legend>\n\t\t\t<div><label class=\"defheal\"><input id=\"antiInsta1\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-InstaKill(Normal)</label></div>\n\t\t\t<div><label class=\"defheal\"><input id=\"extraAnti\" type=\"checkbox\" class=\"i-checkbox\" checked/>Anti-InstaKill(AI Enhanced)</label></div>\n            <div><label class=\"defheal\"><input id=\"useCounterInsta\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-InstaKill(Counter)</label></div>\n\t\t\t<div><label class=\"defheal\"><input id=\"antiInsta2\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-InstaKill(Reverse)</label></div>\n\t\t\t<div><label class=\"defheal\"><input id=\"antiInsta3\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-InstaKill(BloodThirster)</label></div>\n\t\t\t<div><label class=\"defheal\"><input id=\"antiInsta4\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-InstaKill(Ranged)</label></div>\n\t\t\t<div><label class=\"defheal\"><input id=\"antiBoostSpike\" type=\"checkbox\" class=\"i-checkbox\"/>Anti-BoostSpike</label></div>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-support-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Support</h3>\n\t\t<fieldset>\n\t\t\t<legend>Speed Armor Normal</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"hat\" id=\"snHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"snAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset>\n\t\t\t<legend>Speed Armor River</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"hat\" id=\"srHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"srAcc\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<fieldset>\n\t\t\t<legend>Speed Armor Winter</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat: </label>\n\t\t\t\t<select name=\"hat\" id=\"ssHat\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"ssAcc\">\n\t\t\t\t\t<option value=\"0\">None</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-controls-menu\" class=\"i-tab-content\" style=\"display: none; overflow-y: scroll;\">\n\t\t<h3>Controls</h3>\n\t\t<label>Mod Menu : <button id=\"kMenu\" class=\"i-button i-bold i-right i-inline i-keybind\">Escape</button></label><br/><br/>\n\t\t<fieldset id=\"i-chatcmd\">\n\t\t\t<legend>Chat Commands</legend>\n\t\t\t<div><label>Show Credits : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\">!credits</button></label></div>\n\t\t\t<div><label>Katana+Musket : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\">!km</button></label></div>\n\t\t\t<div><label>Polearm+Hammer : <button id=\"kSpikeCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!ph</button></label></div>\n\t\t\t<div><label>Stick+Hammer : <button id=\"kTrap\" class=\"i-button i-bold i-right i-inline i-keybind\">!sh</button></label></div>\n\t\t\t<div><label>Crash Server : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!crash</button></label></div>\n\t\t\t<div><label>Bots HatCycle : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!hat</button></label></div>\n\t\t\t<div><label>Bots Attack : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!attack</button></label></div>\n\t\t\t<div><label>Bots Stop : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!stop</button></label></div>\n\t\t\t<div><label>Create Clan : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!clan (name)</button></label></div>\n\t\t\t<div><label>Leave Clan : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!leave</button></label></div>\n\t\t\t<div><label>Join Clan : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!join (name)</button></label></div>\n\t\t\t<div><label>Kick from Clan : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!kick (name)</button></label></div>\n\t\t\t<div><label>Reload Page : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">!reload</button></label></div>\n\t\t</fieldset>\n        <fieldset id=\"i-keybinds\">\n\t\t\t<legend>Keybinds</legend>\n\t\t\t<div><label>Spike : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\">V</button></label></div>\n\t\t\t<div><label>Trap/Boost : <button id=\"kSpikeCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">F</button></label></div>\n\t\t\t<div><label>Turret : <button id=\"kTrap\" class=\"i-button i-bold i-right i-inline i-keybind\">H</button></label></div>\n\t\t\t<div><label>Windmill : <button id=\"kTrapCircle\" class=\"i-button i-bold i-right i-inline i-keybind\">N</button></label></div>\n\t\t\t<div><label>SuperHeal : <button id=\"kTurret\" class=\"i-button i-bold i-right i-inline i-keybind\">Q (Hold)</button></label></div>\n\t\t\t<div><label>Instakill : <button id=\"kBS\" class=\"i-button i-bold i-right i-inline i-keybind\">R</button></label></div>\n\t\t\t<div><label>TeamKiller : <button id=\"kWindmill\" class=\"i-button i-bold i-right i-inline i-keybind\">F6</button><button id=\"kWindmill\" class=\"i-button i-bold i-right i-inline i-keybind\">Play/Pause Media</button></label></div>\n\t\t\t<div><label>Crash : <button id=\"kHeal\" class=\"i-button i-bold i-right i-inline i-keybind\">End</button></div>\n\t\t\t<div><label>360Hit : <button id=\"kBM\" class=\"i-button i-bold i-right i-inline i-keybind\">></button></label></div>\n            <div><label>EMP Mode : <button id=\"kBM\" class=\"i-button i-bold i-right i-inline i-keybind\">I</button></label></div>\n            <div><label>Play/Pause Song : <button id=\"kBM\" class=\"i-button i-bold i-right i-inline i-keybind\">Backslash</button></label></div>\n\t\t\t<div><label>Dash : <button id=\"kBM\" class=\"i-button i-bold i-right i-inline i-keybind\">Backspace</button></label></div>\n\t\t\t<div><label>BoostSpike : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\">L (Hold)</button></label></div>\n\t\t\t<div><label>AutoMill : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\"><</button></label></div>\n\t\t\t<div><label>Console : <button id=\"kSpike\" class=\"i-button i-bold i-right i-inline i-keybind\">Del/Insert</button></label></div>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-instakill-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Insta Kill</h3>\n\t\t<div><label class=\"defheal\"><input id=\"tickBased\" type=\"checkbox\" class=\"i-checkbox\" checked/>Tick-Based Insta (Accounts for lag)</label></div>\n\t\t<div><label class=\"defheal\" style=\"display: none;\"><input id=\"autoInstaBullCheck\" type=\"checkbox\" class=\"i-checkbox\" style=\"display: none;\" checked/>Auto Insta NoBull Hat Check (Beta)</label></div>\n\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"instaType\">Insta Type: </label>\n\t\t\t\t<select name=\"instaType\" id=\"instaType\">\n\t\t\t\t\t<option value=\"normal\" selected>Normal</option>\n\t\t\t\t\t<option value=\"reverse\">Reverse</option>\n\t\t\t\t\t<option value=\"oneframe\">One Frame (Diamond Polearm)</option>\n\t\t\t\t\t<option value=\"onetick\">One Tick (Polearm+Crossbow)</option>\n\t\t\t\t\t<option value=\"lag\">Lag Insta</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t    <div><label class=\"defheal\"><input id=\"autoInsta\" type=\"checkbox\" class=\"i-checkbox\" checked/>Auto Insta (Changes \"R\" key to Toggle)</label></div>\n\t\t<div><label class=\"defheal\"><input id=\"iAim\" type=\"checkbox\" class=\"i-checkbox\" checked/>Auto Aim</label></div>\n        <div><label class=\"defheal\"><input id=\"spikeInsta\" type=\"checkbox\" class=\"i-checkbox\"/>Use Spikes</label></div>\n\t\t<div><label class=\"defheal\"><input id=\"autoReload\" type=\"checkbox\" class=\"i-checkbox\" checked/>Auto Reload</label></div>\n\t\t<div><label class=\"defheal\" style=\"display: none;\"><input id=\"iReverse\" type=\"checkbox\" class=\"i-checkbox\"/>Reverse Insta</label></div>\n\t\t<fieldset style=\"display: none;\">\n\t\t\t<legend>Insta Kill:</legend>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">Hat-1: </label>\n\t\t\t\t<select name=\"acc\" id=\"iHat1\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory-1: </label>\n\t\t\t\t<select name=\"acc\" id=\"iAcc1\">\n\t\t\t\t\t<option value=\"0\">None</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<div><label class=\"key2\"><input id=\"iSwitch\" type=\"checkbox\" class=\"i-checkbox\"/>Choose Secondary Weapon</label></div>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Hat-2: </label>\n\t\t\t\t<select name=\"hat\" id=\"iHat2\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">Accessory-2: </label>\n\t\t\t\t<select name=\"acc\" id=\"iAcc2\">\n\t\t\t\t\t<option value=\"0\">None</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"hat\">End Hat: </label>\n\t\t\t\t<select name=\"hat\" id=\"iHat3\">\n\t\t\t\t\t<option value=\"0\">none</option>\n\t\t\t\t\t<option value=\"51\">Moo Cap</option>\n\t\t\t\t\t<option value=\"50\">Apple Cap</option>\n\t\t\t\t\t<option value=\"28\">Moo Head</option>\n\t\t\t\t\t<option value=\"29\">Pig Head</option>\n\t\t\t\t\t<option value=\"30\">Fluff Head</option>\n\t\t\t\t\t<option value=\"36\">Pandou Head</option>\n\t\t\t\t\t<option value=\"37\">Bear Head</option>\n\t\t\t\t\t<option value=\"38\">Monkey Head</option>\n\t\t\t\t\t<option value=\"44\">Polar Head</option>\n\t\t\t\t\t<option value=\"35\">Fez Hat</option>\n\t\t\t\t\t<option value=\"42\">Enigma Hat</option>\n\t\t\t\t\t<option value=\"43\">Blitz Hat</option>\n\t\t\t\t\t<option value=\"49\">Bob XIII Hat</option>\n\t\t\t\t\t<option value=\"57\">Pumpkin</option>\n\t\t\t\t\t<option value=\"8\">Bummle Hat</option>\n\t\t\t\t\t<option value=\"2\">Straw Hat</option>\n\t\t\t\t\t<option value=\"15\">Winter Cap</option>\n\t\t\t\t\t<option value=\"5\">Cowboy Hat</option>\n\t\t\t\t\t<option value=\"4\">Ranger Hat</option>\n\t\t\t\t\t<option value=\"18\">Explorer Hat</option>\n\t\t\t\t\t<option value=\"31\">Flipper Hat</option>\n\t\t\t\t\t<option value=\"1\">Marksman Cap</option>\n\t\t\t\t\t<option value=\"10\">Bush Gear</option>\n\t\t\t\t\t<option value=\"48\">Halo</option>\n\t\t\t\t\t<option value=\"6\">Soldier Helmet</option>\n\t\t\t\t\t<option value=\"32\">Anti Venom Gear</option>\n\t\t\t\t\t<option value=\"13\">Medic Gear</option>\n\t\t\t\t\t<option value=\"9\">Miners Helmet</option>\n\t\t\t\t\t<option value=\"32\">Musketeer Hat</option>\n\t\t\t\t\t<option value=\"7\">Bull Helmet</option>\n\t\t\t\t\t<option value=\"22\">Emp Helmet</option>\n\t\t\t\t\t<option value=\"12\">Booster Hat</option>\n\t\t\t\t\t<option value=\"26\">Barbarian Armor</option>\n\t\t\t\t\t<option value=\"21\">Plague Mask</option>\n\t\t\t\t\t<option value=\"46\">Bull Mask</option>\n\t\t\t\t\t<option value=\"14\">Windmill Hat</option>\n\t\t\t\t\t<option value=\"11\">Spike Gear</option>\n\t\t\t\t\t<option value=\"53\">Turret Gear</option>\n\t\t\t\t\t<option value=\"20\">Samurai Armor</option>\n\t\t\t\t\t<option value=\"58\">Dark Knight</option>\n\t\t\t\t\t<option value=\"27\">Scavenger Gear</option>\n\t\t\t\t\t<option value=\"40\">Tank Gear</option>\n\t\t\t\t\t<option value=\"52\">Thief Gear</option>\n\t\t\t\t\t<option value=\"55\">Bloodthirster</option>\n\t\t\t\t\t<option value=\"56\">Assassin Gear</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t\t<form action=\"/action_page.php\">\n\t\t\t\t<label for=\"acc\">End Accessory: </label>\n\t\t\t\t<select name=\"acc\" id=\"iAcc3\">\n\t\t\t\t\t<option value=\"0\">None</option>\n\t\t\t\t\t<option value=\"12\">Snowball</option>\n\t\t\t\t\t<option value=\"9\">Tree Cape</option>\n\t\t\t\t\t<option value=\"10\">Stone Cape</option>\n\t\t\t\t\t<option value=\"3\">Cookie Cape</option>\n\t\t\t\t\t<option value=\"8\">Cow Cape</option>\n\t\t\t\t\t<option value=\"11\">Monkey Tail</option>\n\t\t\t\t\t<option value=\"17\">Apple Basket</option>\n\t\t\t\t\t<option value=\"6\">Winter Cape</option>\n\t\t\t\t\t<option value=\"4\">Skull Cape</option>\n\t\t\t\t\t<option value=\"5\">Dash Cape</option>\n\t\t\t\t\t<option value=\"2\">Dragon Cape</option>\n\t\t\t\t\t<option value=\"1\">Super Cape</option>\n\t\t\t\t\t<option value=\"7\">Troll Cape</option>\n\t\t\t\t\t<option value=\"14\">Thorns</option>\n\t\t\t\t\t<option value=\"15\">Blockades</option>\n\t\t\t\t\t<option value=\"20\">Devils Tail</option>\n\t\t\t\t\t<option value=\"16\">Sawblade</option>\n\t\t\t\t\t<option value=\"13\">Angel Wings</option>\n\t\t\t\t\t<option value=\"19\">SWings</option>\n\t\t\t\t\t<option value=\"18\">BWings</option>\n\t\t\t\t\t<option value=\"21\">CX Wings</option>\n\t\t\t\t</select>\n\t\t\t</form>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-chat-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Chat Menu</h3>\n\t\t<div><label>Reset defaults : <button id=\"defaultChats\" class=\"i-button i-bold i-right i-inline i-keybind\">Reset</button></label></div>\n\t\t<fieldset>\n\t\t\t<legend>Auto Chat</legend>\n\t\t\t<div><label class=\"Songs\"><input id=\"songCheck\" type=\"checkbox\" class=\"i-checkbox\" checked/>Songs</label></div>\n        <div><label class=\"SongInfo\">Play/Pause with BACKSLASH key</label></div>\n        <form action=\"/action_page.php\">\n           <label for=\"song\">Song: </label>\n           <select name=\"song\" id=\"song\">\n        \t\t<option value=\"0\">Gas Gas Gas</option>\n        \t\t<option value=\"1\">We Will Rock You</option>\n        \t\t<option value=\"2\">Gangnam Style</option>\n        \t\t<option value=\"3\">Despacito</option>\n        \t\t<option value=\"4\">It's Been So Long</option>\n        \t\t<option value=\"5\">I've Got No Time To Live</option>\n\t\t\t\t<option value=\"6\">Need to Know</option>\n\t\t\t\t<option value=\"7\">Hit or Miss</option>\n\t\t\t\t<option value=\"8\">We're Taking Over</option>\n\t\t\t\t<option value=\"9\">Blood on the Water</option>\n                <option value=\"10\"Homo Freestyle</option>\n                <option value=\"11\">Four Big Guys</option>\n        \t\t<option value=\"12\">Baby Shark</option>\n           </select>\n        </form>\n\t\t<div><label class=\"chat123\"><input id=\"acBool\" type=\"checkbox\" class=\"i-checkbox\"/>Auto Chat</label></div>\n\t\t\t<label>Auto Chat: <input value=\"" + _0x1c130c + "\" id=\"aChat\" type=\"text\" minlength=\"0\" maxlength=\"30\" style=\"width: 200px;\" placeholder=\"Automatic Chatting\" class=\"i-checkbox\"/></label>\n\t\t\t<div><label class=\"chat123\"><input id=\"clanSpamBool\" type=\"checkbox\" class=\"i-checkbox\"/>Clan Spam</label></div>\n            <label>Clan Spam: <input value=\"~DaRk~\" id=\"clanSpam\" type=\"text\" minlength=\"0\" maxlength=\"7\" style=\"width: 100px;\" placeholder=\"Clan Name\" class=\"i-checkbox\"/></label>\n\t\t\t<div><label class=\"chat123\"><input id=\"icBool\" type=\"checkbox\" class=\"i-checkbox\" checked/>Kill Chat</label></div>\n\t\t\t<label>Kill Chat: <input value=\"LemonMod v" + LEMONMOD_0x110d60 + " - +1 EZ\" id=\"kChat\" type=\"text\" minlength=\"0\" maxlength=\"30\" style=\"width: 200px;\" placeholder=\"Kill Chat\" class=\"i-checkbox\"/></label>\n\t\t\t<div><label class=\"chat123\"><input id=\"irBool\" type=\"checkbox\" class=\"i-checkbox\" checked/>Reload Chat</label></div>\n\t\t\t<label>Reload Chat: <input value=\"LemonMod v" + LEMONMOD_0x110d60 + " - RELOADED!\" id=\"rChat\" type=\"text\" minlength=\"0\" maxlength=\"30\" style=\"width: 200px;\" placeholder=\"Reloaded Chat\" class=\"i-checkbox\"/></label>\n\t\t\t<div><label class=\"chat123\" style=\"display: none;\"><input id=\"ezBool\" type=\"checkbox\" class=\"i-checkbox\" style=\"display: none;\" checked/>Auto GG/EZ</label></div>\n\t\t\t<label style=\"display: none;\">Auto GG/EZ:<input value=\"LemonMod v" + LEMONMOD_0x110d60 + " - EASY KILL!\" id=\"ezChat\" type=\"text\" minlength=\"0\" maxlength=\"30\" style=\"display: none; width: 250px;\" placeholder=\"GG/EZ\" class=\"i-checkbox\"/></label>\n\t\t\t<div><label class=\"chat123\" style=\"display: none;\"><input id=\"cPlayer\" type=\"checkbox\" class=\"i-checkbox\" style=\"display: none;\"/>Player Tracker</label></div>\n\t\t\t<div><label class=\"chat123\"><input id=\"wLag\" type=\"checkbox\" class=\"i-checkbox\"/>Warn Lag</label></div>\n\t\t\t<label>Lag Chat: <input value=\"~ warn: (x) ms ~\" id=\"wLagChat\" type=\"text\" minlength=\"0\" maxlength=\"30\" style=\"width: 200px;\" placeholder=\"Lag Warning Chat\" class=\"i-checkbox\"/></label>\n\t\t</fieldset>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n\t<div id=\"mm-credits-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<div>\n\t\t\t<h3>Credits</h3>\n\t\t\t<fieldset>\n\t\t\t\t<legend>LemonMod was made possible by...</legend>\n\t\t\t\t<a href=\"https://owen.lol/\"><label class=\"madeby1 smallGlowNoModifiers\">LemonFlux</label></a><br><a href=\"https://itch.io/profile/palomadev\"><label class=\"madeby1\">Palomita</label></a><br><a href=\"https://tjmod.weebly.com/\"><label class=\"madeby1\">Xx_TJGaming_xX</label></a><br><a href=\"https://itch.io/profile/pancakess\"><label class=\"madeby1\">pancakess</label></a><br><a href=\"https://itch.io/profile/mooma\"><label class=\"madeby1\">MooMa2k21</label></a><br><a href=\"https://itch.io/profile/subliminalgaming\"><label class=\"madeby1\">Sub. Gaming</label></a><br><a href=\"https://itch.io/profile/gregklein\"><label class=\"madeby1\">Greg Klein</label></a><br><a href=\"https://itch.io/profile/popitch\"><label class=\"madeby1\">Popi!</label></a><br><a href=\"https://itch.io/profile/sneakilli\"><label class=\"madeby1\">Sneakilli</label></a><br><a href=\"https://www.sophiebritt.com/\"><label class=\"madeby1\">Sophie Brittain</label></a>\n\t\t\t</fieldset>\n\t\t</div>\n\t</div>\n\t<div id=\"mm-hatmacro-menu\" class=\"i-tab-content\" style=\"overflow-y: scroll; display: none;\">\n\t\t<h3>Hat-Macro</h3>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">Tank Gear :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x17b3a7) + "\" id=\"tankGear\" class=\"keyPressLow\" onkeyup=\"this.value=this.value.toUpperCase();\" maxlength=\"1\" type=\"text\"/>\n\t\t</div>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">Bull Helmet :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x1bced6) + "\" id=\"bullHelm\" class=\"keyPressLow\" onkeyup=\"this.value=this.value.toUpperCase();\" maxlength=\"1\" type=\"text\"/>\n\t\t</div>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">Soldier Helmet :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x3350c2) + "\" id=\"soldier\" class=\"keyPressLow\" onkeyup=\"this.value=this.value.toUpperCase();\" maxlength=\"1\" type=\"text\"/>\n\t\t</div>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">EMP Gear :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x2d5921) + "\" id=\"spikeg\" class=\"keyPressLow\" maxlength=\"1\" onkeyup=\"this.value=this.value.toUpperCase();\" type=\"text\"/>\n\t\t</div>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">Turret Gear :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x5c0ab8) + "\" id=\"turret\" class=\"keyPressLow\" maxlength=\"1\" onkeyup=\"this.value=this.value.toUpperCase();\" type=\"text\"/>\n\t\t</div>\n\t\t<div>\n\t\t\t<h3 class=\"menuPrompt\">Booster Hat :</h3>\n\t\t\t<input value=\"" + String.fromCharCode(_0x590c84) + "\" id=\"booster\" class=\"keyPressLow\" maxlength=\"1\" onkeyup=\"this.value=this.value.toUpperCase();\" type=\"text\"/>\n\t\t</div>\n\t\t<br>\n\t\t<div class=\"i-palomita\">Made By: LemonFlux</div>\n\t</div>\n</div>\n";
      if (LEMONMOD_0x211e6c) {
        console.log("GUI menu init complete.");
      }
      let _0x12c002 = ["Do you like my car?\nGuess you're ready\n'cause I'm waiting for you\nIt's gonna be so exciting\nGot this feeling\nreally deep in my soul\nLet's get out,\nI wanna go,\ncome along, get it on\nGonna take my car,\ngonna sit in\nGonna drive along\n'til I get you\n'Cause I'm crazy,\nhot and ready,\nbut you like it\nI wanna race for you\n(Shall I go now?)\nGas, gas, gas\nI'm gonna step on the gas\nTonight, I'll fly\n(and be your lover)\nYeah, yeah, yeah\nI'll be so quick as a flash\nAnd I'll be your hero\nGas, gas, gas\nI'm gonna run as a flash\nTonight, I'll fight\n(to be the winner)\nYeah, yeah, yeah\nI'm gonna step on the gas\nAnd you'll see the big show\nDon't be lazy\n'cause I'm burning for you\nIt's like a hot sensation\nGot this power\nthat is taking me out\nYes, I've got a crush on you,\nready, now,\nready, go\nGonna take my car,\ngonna sit in\nGonna drive alone\n'til I get you\n'Cause I'm crazy,\nhot and ready,\nbut you like it\nI wanna race for you\n(Shall I go now?)\nGas, gas, gas\nI'm gonna step on the gas\nTonight, I'll fly\n(and be your lover)\nYeah, yeah, yeah\nI'll be so quick as a flash\nAnd I'll be your hero\nGas, gas, gas\nI'm gonna run as a flash\nTonight, I'll fight\n(to be the winner)\nYeah, yeah, yeah\nI'm gonna step on the gas\nAnd you'll see the big show\nGonna take my car,\ndo you like my car?\n'Cause I'm crazy,\nhot and ready,\nbut you like it\nI wanna race for you\n(Shall I go now?)\nGas, gas, gas\nI'm gonna step on the gas\nTonight, I'll fly\n(and be your lover)\nYeah, yeah, yeah\nI'll be so quick as a flash\nAnd I'll be your hero\nGas, gas, gas\nI'm gonna run as a flash\nTonight, I'll fight\n(to be the winner)\nYeah, yeah, yeah\nI'm gonna step on the gas\nAnd you'll see the big show\nGas, gas, gas\nYeah, yeah, yeah\nGas, gas, gas\nAnd you'll see the big show", "Buddy, you're a boy, make a big noise\nPlaying in the street,\ngonna be a big man someday\nYou got mud on your face,\nyou big disgrace\nKicking your can\nall over the place,\nsingin'\nWe will,\nwe will rock you\nWe will,\nwe will rock you\nBuddy, you're a young man,\nhard man\nShouting in the street,\ngonna take on the world\nsome day\nYou got blood\non your face,\nyou big disgrace\nWaving your banner\nall over the place\nWe will,\nwe will rock you, sing it!\nWe will,\nwe will rock you, yeah\nBuddy, you're an old man,\npoor man\nPleading with your eyes,\ngonna get you some peace\nsome day\nYou got mud on your face,\nbig disgrace\nSomebody better\nput you back into your place,\ndo it!\nWe will,\nwe will rock you,\nyeah, yeah, come on\nWe will,\nwe will rock you,\nalright, louder!\nWe will,\nwe will rock you,\none more time\nWe will, we will rock you\nYeah!", "Oppa is Gangnam style\nGangnam style\nA girl\nwho is warm and humanly\nduring the day\nA classy girl\nwho know how to enjoy\nthe freedom of a cup of coffee\nA girl whose heart gets hotter\nwhen night comes\nA girl with that kind of twist\nI'm a guy\nA guy who is as warm\nas you during the day\nA guy who one-shots his coffee\nbefore it even cools down\nA guy whose heart bursts\nwhen night comes\nThat kind of guy\nBeautiful, loveable\nYes you, hey, yes you, hey\nBeautiful, loveable\nYes you, hey, yes you, hey\nNow let's go until the end\nOppa is Gangnam style,\nGangnam style\nOppa is Gangnam style,\nGangnam style\nOppa is Gangnam style\nEh- Sexy Lady,\nOppa is Gangnam style\nEh- Sexy Lady oh oh oh oh\nA girl who looks quiet\nbut plays when she plays\nA girl who puts her hair down\nwhen the right time comes\nA girl who covers herself\nbut is more sexy\nthan a girl who bares it all\nA sensable girl like that\nI'm a guy\nA guy who seems calm\nbut plays when he plays\nA guy who goes\ncompletely crazy\nwhen the right time comes\nA guy who has bulging ideas\nrather than muscles\nThat kind of guy\nBeautiful, loveable\nYes you, hey, yes you, hey\nBeautiful, loveable\nYes you, hey, yes you, hey\nNow let's go until the end\nOppa is Gangnam style,\nGangnam style\nOppa is Gangnam style,\nGangnam style\nOppa is Gangnam style\nEh- Sexy Lady,\nOppa is Gangnam style\nEh- Sexy Lady\noh oh oh oh\nOn top of the running man\nis the flying man,\nbaby baby\nI'm a man\nwho knows a thing or two\nOn top of the running man\nis the flying man,\nbaby baby\nI'm a man\nwho knows a thing or two\nYou know what I'm saying\nOppa is Gangnam style\nEh- Sexy Lady, Oppa is Gangnam style\nEh- Sexy Lady oh oh oh oh", "Yes, you know that I've been looking at you\nfor a long time\nI must dance with you today\nI saw that\nthe look in your eyes was calling me\nShow me the path\nthat I will take (Oh)\nYou, you're the magnet\nand I'm the metal\nI am getting closer\nand making a plan\nSimply thinking about it\nmakes my heart race (Oh yeah)\nNow, I'm already liking it\nmore than usual\nAll of my senses\nare asking for more\nWe cannot do this in a rush\nSlowly\nI want to breathe\nin your neck slowly\nLet me murmur\nthings in your ear\nSo that you remember\nif you're not with me\nSlowly\nI want to undress you\nin kisses slowly\nFirmly in the walls\nof your labyrinth\nAnd of your body,\nI want to create a manuscript\nUp, up\nUp, up, up\nI want to see your hair dance\nI want to be your rhythm\nWant you to show my mouth\nYour favorite places\n(Favorite, favorite baby)\nLet me trespass your danger zones\nUntil I make you scream\nAnd you forget your last name\nIf I ask for a kiss\ncome give it to me\nI know that\nyou're thinking about it\nI've been trying to\ndo it for awhile\nMami this is giving\nand giving it to you\nYou know that with me\nyour heart goes\nbom bom\nYou know that from me\nthat babe is looking for a\nbom bom\nCome try my mouth\nand see if you like its taste\nI want to see\nhow much love fits in you\nI'm not in a rush\nI want to experience this trip\nLet's start slowly,\nthen savagely\nStep by step,\nsoft then softly\nWe come up against\neach other, little by little\nWhen you kiss me\nin that state of distress\nI see that you\nare malice and delicacy\nStep by step,\nsoft then softly\nWe come up against\neach other, little by little\nAnd it's just that\nyour beauty is a puzzle\nBut to finish it here\nI have the missing piece\nSlowly\nI want to breathe\nin your neck slowly\nLet me murmur\nthings in your ear\nSo that you remember\nif you're not with me\nSlowly\nI want to\nundress you in kisses slowly\nFirmly in the walls of\nyour labyrinth\nAnd of your body,\nI want to create a manuscript\nUp, up, up, up\nI want to see your hair dance\nI want to be your rhythm\nWant you to show my mouth\nYour favorite places\n(Favorite, favorite baby)\nLet me trespass your danger zones\nUntil I make you scream\nAnd you forget your last name\nSlowly\nWe're gonna do it\non a beach in Puerto Rico\nUntil the waves scream Oh Lord\nSo that my seal stays with you\nStep by step, soft then softly\nWe come up against\neach other, little by little\nI want you to show my mouth\nYour favorite places\n(Favorite, favorite baby)\nStep by step, soft then softly\nWe come up against\neach other, little by little\nUntil I make you scream\nAnd you forget your last name\nSlowly.", "I don't know what I was thinking\nLeaving my child behind\nNow I suffer the curse\nand now I am blind\nWith all this anger,\nguilt and sadness\nComing to haunt me forever\nI can't wait for the cliff\nat the end of the river\nIs this revenge I am seeking?\nOr seeking someone\nto avenge me?\nStuck in my own paradox,\nI wanna set myself free\nMaybe I should chase and find\nBefore they'll try to stop it\nIt won't be long\nbefore I'll become a puppet\nIt's been so long\nSince I last have seen my son\nlost to this monster\nTo the man\nbehind the slaughter\nSince you've been gone\nI've been singing\nthis stupid song\nso I could ponder\nThe sanity of your mother\nI wish I lived\nin the present\nWith the gift of\nmy past mistakes\nBut the future keeps luring in\nlike a pack of snakes\nYour sweet little eyes,\nyour little smile\nis all I remember\nThose fuzzy memories\nmess with my temper\nJustification is killing me\nBut killing isn't justified\nWhat happened to my son?\nI'm terrified\nIt lingers in my mind\nAnd the thought\nkeeps on getting bigger\nI'm sorry my sweet baby,\nI wish I've been there\nIt's been so long\nSince I last have seen my son\nlost to this monster\nTo the man\nbehind the slaughter\nSince you've been gone\nI've been singing\nthis stupid song\nso I could ponder\nThe sanity of your mother", "I got no time\nI got no time to live\nI got no time to live\nAnd I can't say goodbye\nAnd I'm regretting\nhaving memories\nOf my friends\nwho they used to be\nBeside me before\nthey left me to die\nAnd I know this is\nI know this is the truth\n'Cause I've been staring\nat my death so many times\nThese scary monsters\nroaming in the halls\nI wish I could just\nblock the doors\nAnd stay in bed\nuntil the clock will chime\nSo my flashlight's on,\nand stay up 'til dawn\nI got this headache\nand my life's on the line\nI felt like I won,\nbut I wasn't done\nThe nightmare\nrepeats itself every time\nGot to keep my calm,\nand carry on\nStay awake until\nthe sun will shine\nBut I'm not so strong,\nand they're not gone\nThey're still out there\nto take what's left of mine\nI have this urge\nI have this urge to kill\nI have this urge to kill\nand show that I'm alive\nI'm getting sick\nfrom these apologies\nFrom people with priorities\nThat their life matters\nso much more than mine\nBut I'm stuttering\nI'm stuttering again\nNo one will listen\nand no one will understand\nBecause I'm crying\nas much as I speak\n'Cause no one likes me\nwhen I shriek\nWant to go back\nto when it all began\nSo my flashlight's on,\nand stay up 'til dawn\nI got this headache\nand my life's on the line\nI felt like I won,\nbut I wasn't done\nThe nightmare\nrepeats itself every time\nGot to keep my calm,\nand carry on\nStay awake until\nthe sun will shine\nBut I'm not so strong,\nand they're not gone\nThey're still out there\nto take what's left of mine", "\nYeah\nWanna know what it's like\n(like)\nBaby, show me what it's like\n(like)\nI don't really got no type\n(type)\nI just wanna fuck all night\nYeah-yeah,\noh-whoa-whoa\n(oh, ooh, mmm)\nBaby, I need to know, mmm\n(yeah, need to know)\nI just been fantasizin'\n(size)\nAnd we got a lotta time\n(time)\nBaby, come throw the pipe\n(pipe)\nGotta know what it's like\n(like)\nYeah-yeah,\noh-whoa-whoa\nBaby, I need to know, mmm\nWhat's your size?\n(Size)\nAdd, subtract, divide ('vide)\nDaddy don't throw no curves\n(curves)\nHold up, I'm goin' wide\n(wide)\nWe could just start at ten\n(ten)\nThen we can go to five\n(five)\nI don't play with my pen\n(pen)\nI mean what I write\nYeah-yeah,\nwhoa-whoa-whoa\nI just can't help but be Sexual\n(whoa)\nTell me your schedule\n(yeah)\nI got a lotta new\ntricks for you, baby\nJust sayin' I'm flexible\n(I will)\nI do what I can to get you off\n(I will)\nMight just Fuck him\nwith my makeup on\n(I will)\nEat it like I need an\napron on (yeah, ay)\nEat it 'til I need to change\nmy thong (yeah, ay)\nWe could do it to your\nfavorite song (yeah, ay)\nTake a ride into the\ndanger zone (yeah, ay)\nYou know my Nigga be buggin' me\nI just be wonderin' if you can\nFuck on me better\nItchin' for me like\nan ugly sweater\nNeed it in me like a\nChuck E. need cheddar\nI need to know (yeah)\nWanna know what it's like\n(like)\nBaby, show me what it's like\n(like)\nI don't really got no type\n(type)\nI just wanna Fuck all night\nYeah-yeah, oh-whoa-whoa\n(oh, ooh, mmm)\nBaby, I need to know, mmm\n(yeah, need to know)\nI just been fantasizin'\n(size)\nAnd we got a lotta time\n(time)\nBaby, come throw the pipe\n(pipe)\nGotta know what it's like\n(like)\nYeah-yeah,\noh-whoa-whoa\nBaby, I need to know, mmm\nYou're exciting,\nboy, come find me\nYour eyes told me,\n\"Girl, come ride me\"\nFuck that feeling\nboth us fighting\nCould he try me?\n(Yeah) mmm, most likely\nTryna see if you could\nhandle this ass\nProlly give his ass\na panic attack\nSorry if I gave\na random erection\nProlly thinkin'\nI'm a telekinetic\nOh, wait,\nyou a fan of the magic?\nPoof,\nPussy like an Alakazam (yeah)\nI heard from a friend\nof a friend\nThat that Dick\nwas a ten out of ten\nI can't stand it,\njust one night me\nClink with the drink,\ngimme a sip\nTell me what's your kink,\ngimme the dick\nSpank me,\nslap me,\nchoke me,\nbite me (ew)\nUh, wait,\nI can take it (ah)\nDon't give a Fuck\n'bout what your wifey's sayin'\n(yeah)\nWanna know what it's like\n(like)\nBaby, show me what it's like\n(like)\nI don't really got no type\n(type)\nI just wanna fuck all night\nYeah-yeah,\noh-whoa-whoa (oh, ooh, mmm)\nBaby, I need to know, mmm\n(yeah, need to know)\nI just been fantasizin'\n(size)\nAnd we got a lotta time\n(time)\nBaby, come throw the pipe\n(pipe)\nGotta know what it's like\n(like)\nYeah-yeah,\noh-whoa-whoa\n~ fin ~\nBaby, I need to know, mmm", "\nMia Khalifa\nIs that why you tried\nto quit three times?\nIs that why you said\ngood bye, retired!\nIs that why you said\nfuck these guys?\nWho do you think you are?\nYou were sucking dick for\na foreign car (Brrrrr)\nGotta take that call\nThey want you at work so,\ngirl, go do your job\nMia Khalifa (Mia!)\nMia Khalifa (Mia!)\nFight!\nHit or miss\nI guess they never miss, huh?\nYou got a boyfriend,\nI bet he doesn't kiss ya\nHe gon' find another girl\nand he won't miss ya\nHe gon' skrrt and hit the dab\nlike Wiz Khalifa\nYou play with them balls\nlike it's FIFA,\nYou on every level,\nyou're the leader, ooh\nYou used to work\nat Whataburger\nNow you pop your pussy\nfor the Warner Brothers\n(And that bangs, bro)\nShots fired,\nyou're fired\nYou're washed up,\nyou're retired\nYour kitty\nlooks like a flat tire (Eww!)\nI bet that your kitty\nreal tired... (Ooh!)\n/!\\ *;;* ~ Perfect! ~ *;;* /!\\\n", "We at the top again, now what?\nHeavy lay the crown, but\nCount us,\nhigher than the mountain\nAnd we be up here\nfor the long run\nStrap in for a long one\nWe got everybody on one (woo)\nNow you're coming at the king\nso you better not miss\n(not miss)\nAnd we only get stronger\nWith everything I carry\nup on my back\nYou should paint it up\nwith a target\nOh, woah\nWhy would you dare me\nto do it again? (Oh)\nCome get your spoiler up ahead\nWe're taking over\nWe're taking over, aye\nLook at you come at my name,\nyou oughta know by now\nThat we're taking ovеr\nWe're taking over, aye\nMaybe you wonder\nwhat you're future's gonna be,\nI got it all locked up\nTake a lap, now\nDon't be mad, now\nRun it back,\nrun it back now\nI got bodies lining up,\nthink you're dreaming of greatness?\nSend you back home,\nlet you wake up\nOh, woah\nWhy would you dare me\nto do it again? (Oh)\nCome get your spoiler up ahead\nWe're taking over\nWe're taking over, aye\nLook at you come at my name,\nyou oughta know by now\nThat we're taking over\nWe're taking over, aye\nMaybe you wonder\nwhat you're future's gonna be,\nI got it all locked up\nI got the heart of lion\nI know the higher you climbing\nThe harder you fall (you know)\nI'm at the top of the mount\nToo many bodies to count\nI've been through it all\nI had to weather the storm\nTo get to level I'm on\nThat's how the legend was born\nAll of my enemies already dead\nI'm bored, I'm ready for more\nThey know I'm ready for war\nI told 'em\nWe're taking over\nWe're taking over, aye\nLook at you come at my name,\nyou oughta know by now\nThat we're taking over\nWe're taking over, aye\nMaybe you wonder\nwhat you're future's gonna be,\nI got it all locked up", "We'll never get free\nLamb to the slaughter\nWhat you gon' do\nwhen there's blood\nin the water?\nThe price of your greed\nis your son and your daughter\nWhat you gon' do\nwhen there's blood\nin the water?\nLook me in my eyes\nTell me everything's not fine\nOh, the people ain't happy\nAnd the river has run dry\nYou thought you could go free\nBut the system is done for\nIf you listen real closely\nThere's a knock\nat your front door\nWe'll never get free\nLamb to the slaughter\nWhat you gon' do\nwhen there's blood\nin the water?\nThe price of your greed\nis your son and your daughter\nWhat you gon' do\nwhen there's blood\nin the water?\nWhen there's blood in the\n(Uh, uh)\nWhen there's blood in the\n(Uh, uh)\nBeg me for mercy\nAdmit you were toxic\nYou poisoned me just for\nAnother dollar in your pocket\nNow I am the violence\nI am the sickness\nWon't accept your silence\nBeg me for forgiveness\nWe'll never get free\nLamb to the slaughter\nWhat you gon' do\nwhen there's blood\nin the water?\nThe price of your greed,\nyour son and your daughter\nWhat you gon' do\nwhen there's blood\nin the water?\nWhen there's blood\nin the water\n(Uh, uh)\nWhen there's blood in the\n(Uh, uh)\nI am the people\nI am the storm\nI am the riot\nI am the swarm\nWhen the last tree's fallen\nthe animal can't hide\nMoney won't solve it\nWhat's your alibi?\nWhat's your alibi?\nWhat's your alibi?\nWhat you gon' do\nwhen there's blood in the,\nblood in the water?\nWhen there's blood\nin the water\n(Uh, uh)\nWhen there's blood in the\n(Uh, uh)\nWhen there's blood\nin the water", "Yeah, Yeah\nYeah it's freestyle time\nSmacking his ass,\nI had my man cumming so fast\nwhen I sucked on his cock & shit\nThats my sugar dad\nI blow him & he cash me\nso I call him pop & shit\nand all of his milk\nspraying all over my silk sheets\nwhile im slobbing it,\nIt fills me up\nand I swallow it,\nJust put it in me\nI'll take all of it,\nHe can give you more D\nthan an algebra class\nHe playing D,\nso im fouling his ass\nIm pounding and drowning it\nhe say that it feel astounding\nthe best dick that he ever had,\nI pull down his pants,\nAnd i ain't talking sag,\nI shoot so much cum,\nI got an extended mag,\nWe touching eachother\nlike we playing tag,\nWe fucking eachother,\nbut I aint submissive\nI grab on his hips,\nthen I fuck from the back\nYeah i make him sing\nlike he Whitney,\nDick is so big,\nthat he throwing like\nhe just drank too much whiskey,\nYeah i had him tipsy,\nKnow what this dick did\nIt got him addicted\nHe wanna kiss me\nright on my big lips\nInside of a business\nbut I didnt trip\njust because he had a big dick\nYeah now everybody know\nImma go to school get cool\nwith the footbal team\nand fuck everybody bro,\nWhen I hang with my guys\nplease dont be suprised\nIf i just let everybody blow\nLike I'm everybody hoe,\nI made everyone grow,\nMake everyone choke\nwhen I put it down they throat,\nYeah he gonna ride me\ngo stupid inside me,\nHe know where to find me,\nhe go stupid inside me\n~6*9~ FiN! ~6*9~", "Yessir\nBig dick Big dick\n4 big guys,\nand they grab on my thighs\nBlow up my guts\nlike the fourth of july\nIf they keep fucking my butt\nthen i might just cry\nPoop and semen\nspraying in my eyes\nHe lick my dick\nand the cum start sprayin'\nChagrin' up my dick\nima go super saiyan\nWhen it come to fucking booty\ni don't do much playin'\nAnd i whispered in his ear like,\n\"hey are you staying?\"\nHe said, \"yeah i'm not leaving.\"\ni guess he george floyd\nCause i leave him not breathing\nHe chew on my dick\nlike a baby that's teething\nI'm fucking a nigga\ni think his name steven\nHawking,\nfuck him till he ain't walking\nDick stone cold\ncall him bbc office\nIt's a booty massacre\nwhеn i visit him in boston\nBought him new titties\ndon't what they costin'\nbitch, hop on the dick\ndo a split\nShout out to lil baby\nmy dick is as real as it gets\nI'm not fucking on him\nif he don't have tits\nI'm catching his balls\nlike my name is kyle pitts\nThere's 4 big guys\nThey're grabbing on my thighs\nThey blow my guts up,\nlike the fourth of july\nIf he keep fucking my butt\nthen i might cry\nThere's poop and semen\nspraying on my eyes\nYes sir that is a fact though\nTake out my dick\nslip it in his asshole\nSwinging my dick through the air\nlike it's a lasso\nPaintin his face\nlike i'm pablo picasso\nYeah, But im not a good artist\nfuck on him good\ntil that nigga farted\nPlanted my seeds\nin his ass like a garden\nThe way i play with balls\nyou should call me james harden\nYeah, digbar is the lead\nThere's 4 big guys\nand im taking their meat\nI eat the boys butt\nand i chase it with skeet\nYeah I count dudes when i sleep,\nnot sheep\nget up in my sheets\nand i'm beating on my meat\n=%~! Bitch !~%=", "Baby shark, do do, do do\nBaby shark, do do, do do\nBaby shark, do do, do do\nBaby shark\nMama Shark, do do, do do\nMama Shark, do do, do do\nMama Shark, do do, do do\nMama Shark\nPapa Shark, do do, do do\nPapa Shark, do do, do do\nPapa Shark, do do, do do\nPapa Shark\nGrandma Shark, do do, do\nGrandma Shark, do do, do\nGrandma Shark, do do, do\nGrandma Shark\nSurfer Dude, do do, do do\nSurfer Dude, do do, do do\nSurfer Dude, do do, do do\nSurfer Dude\nWent for a Swim, do do, do\nWent for a Swim, do do, do\nWent for a Swim, do do, do\nWent for a Swim\nLost a Leg, do do, do do\nLost a Leg, do do, do do\nLost a Leg, do do, do do\nLost a Leg\nLost an Arm, do do, do do\nLost an Arm, do do, do do\nLost an Arm, do do, do do\nLost an Arm\n911, do do, do do do\n911, do do, do do do\n911, do do, do do do\n911\nCPR, do do, do do do\nCPR, do do, do do do\nCPR, do do, do do do\nCPR\nIt's not working, do do, do\nIt's not working, do do, do\nIt's not working, do do, do\nIt's not working\nReincarnation, do do, do\nReincarnation, do do, do\nReincarnation, do do, do\nReincarnation\nAs a Baby Shark, do do, do\nAs a Baby Shark, do do, do\nAs a Baby Shark, do do, do\nAs a Baby Shark\nMama Shark, do do, do do\nMama Shark, do do, do do\nMama Shark, do do, do do\nMama Shark\nPapa Shark, do do, do do\nPapa Shark, do do, do do\nPapa Shark, do do, do do\nPapa Shark\nGrandma Shark, do do, do\nGrandma Shark, do do, do\nGrandma Shark, do do, do\nGrandma Shark\nThat's the End, do do, do do\nThat's the End, do do, do do\nThat's the End, do do, do do\nThat's the End"];
      let _0x4267ce = document.getElementById("gameCanvas").getContext("2d");
      let _0x524b12 = _0x3ac579 => {
        let _0x240522 = document.getElementById("actionBarItem" + _0x3ac579);
        return _0x240522 && _0x240522.style.display === "inline-block";
      };
      let _0xa03c98 = [65, 70, 75, 110, 118, 142, 110, 65, 70, undefined, 75, 2000, undefined, undefined, 125, undefined];
      function _0x3920e9() {
        (() => {
          _0x4267ce.beginPath();
          _0x4267ce.lineWidth = 10;
          _0x4267ce.strokeStyle = "#dc0000";
          let _0x380faf = _0x4267ce.globalAlpha;
          _0x4267ce.globalAlpha = 0.1;
          _0x4267ce.arc(1920 * LEMONMOD_0x47b60b / 2, 1080 * LEMONMOD_0x47b60b / 2, _0xa03c98[LEMONMOD_0x388eda.weapon] ? _0xa03c98[LEMONMOD_0x388eda.weapon] + 70 : 0, -Math.PI, Math.PI);
          _0x4267ce.stroke();
          _0x4267ce.globalAlpha = _0x380faf;
        })();
      }
      ;
      function _0x583643() {
        if (_0x131373 == !![]) {
          _0x35285a(["5", ["length", !0]]);
        }
      }
      function _0x3b83b0() {
        if (LEMONMOD_0x388eda.hat == 31) {
          _0x3d1f00 = ![];
          _0x967ac = [];
        }
      }
      function _0x4c6a65() {
        if (document.getElementById("autoUpgrade").checked) {
          if ($("#autoUpgradeType").val() == "km") {
            if (LEMONMOD_0x413100 == "2") {
              _0x35285a(["6", [7]]);
            }
            if (LEMONMOD_0x413100 == "3") {
              _0x35285a(["6", [17]]);
            }
            if (LEMONMOD_0x413100 == "4") {
              _0x35285a(["6", [31]]);
            }
            if (LEMONMOD_0x413100 == "5") {
              _0x35285a(["6", [23]]);
            }
            if (LEMONMOD_0x413100 == "6") {
              _0x35285a(["6", [10]]);
            }
            if (LEMONMOD_0x413100 == "7") {
              _0x35285a(["6", [33]]);
            }
            if (LEMONMOD_0x413100 == "8") {
              _0x35285a(["6", [4]]);
            }
            if (LEMONMOD_0x413100 == "9") {
              _0x35285a(["6", [15]]);
            }
          } else if ($("#autoUpgradeType").val() == "dh") {
            if (LEMONMOD_0x413100 == "2") {
              _0x35285a(["6", [7]]);
            }
            if (LEMONMOD_0x413100 == "3") {
              _0x35285a(["6", [17]]);
            }
            if (LEMONMOD_0x413100 == "4") {
              _0x35285a(["6", [31]]);
            }
            if (LEMONMOD_0x413100 == "5") {
              _0x35285a(["6", [23]]);
            }
            if (LEMONMOD_0x413100 == "6") {
              _0x35285a(["6", [10]]);
            }
            if (LEMONMOD_0x413100 == "7") {
              if ($("#sevslot").val() == "tp") {
                _0x35285a(["6", [38]]);
              } else if ($("#sevslot").val() == "tu") {
                _0x35285a(["6", [33]]);
              }
            }
          } else if ($("#autoUpgradeType").val() == "ph") {
            if (LEMONMOD_0x413100 == "2") {
              _0x35285a(["6", [5]]);
            }
            if (LEMONMOD_0x413100 == "3") {
              _0x35285a(["6", [17]]);
            }
            if (LEMONMOD_0x413100 == "4") {
              _0x35285a(["6", [31]]);
            }
            if (LEMONMOD_0x413100 == "5") {
              _0x35285a(["6", [23]]);
            }
            if (LEMONMOD_0x413100 == "6") {
              _0x35285a(["6", [10]]);
            }
            if (LEMONMOD_0x413100 == "7") {
              if ($("#sevslot").val() == "tp") {
                _0x35285a(["6", [38]]);
              } else if ($("#sevslot").val() == "tu") {
                _0x35285a(["6", [33]]);
              }
            }
            if (LEMONMOD_0x413100 == "8") {
              _0x35285a(["6", [28]]);
            }
            if (LEMONMOD_0x413100 == "9") {
              _0x35285a(["6", [25]]);
            }
          } else if ($("#autoUpgradeType").val() == "pc") {
            if (LEMONMOD_0x413100 == "2") {
              _0x35285a(["6", [5]]);
            }
            if (LEMONMOD_0x413100 == "3") {
              _0x35285a(["6", [17]]);
            }
            if (LEMONMOD_0x413100 == "4") {
              _0x35285a(["6", [32]]);
            }
            if (LEMONMOD_0x413100 == "5") {
              _0x35285a(["6", [23]]);
            }
            if (LEMONMOD_0x413100 == "6") {
              _0x35285a(["6", [9]]);
            }
            if (LEMONMOD_0x413100 == "7") {
              if ($("#sevslot").val() == "tp") {
                _0x35285a(["6", [38]]);
              } else if ($("#sevslot").val() == "tu") {
                _0x35285a(["6", [33]]);
              }
            }
            if (LEMONMOD_0x413100 == "8") {
              _0x35285a(["6", [12]]);
            }
            if (LEMONMOD_0x413100 == "9") {
              _0x35285a(["6", [25]]);
            }
          } else if ($("#autoUpgradeType").val() == "sh") {
            if (LEMONMOD_0x413100 == "2") {
              _0x35285a(["6", [8]]);
            }
            if (LEMONMOD_0x413100 == "3") {
              _0x35285a(["6", [17]]);
            }
            if (LEMONMOD_0x413100 == "4") {
              _0x35285a(["6", [31]]);
            }
            if (LEMONMOD_0x413100 == "5") {
              _0x35285a(["6", [23]]);
            }
            if (LEMONMOD_0x413100 == "6") {
              _0x35285a(["6", [10]]);
            }
            if (LEMONMOD_0x413100 == "7") {
              if ($("#sevslot").val() == "tp") {
                _0x35285a(["6", [38]]);
              } else if ($("#sevslot").val() == "tu") {
                _0x35285a(["6", [33]]);
              }
            }
            if (LEMONMOD_0x413100 == "8") {
              _0x35285a(["6", [28]]);
            }
            if (LEMONMOD_0x413100 == "9") {
              _0x35285a(["6", [25]]);
            }
          }
        }
      }
      function _0x4fd718() {
        if (document.getElementById("bullTick").checked || document.getElementById("combatBot").checked && !_0x1945c1 && !LEMONMOD_0x46703c && LEMONMOD_0x413100 >= 13) {
          if (LEMONMOD_0x185e28 == 0 && LEMONMOD_0x13c18f == 0 && !LEMONMOD_0x1f0db3 && !_0x3d1f00 && !LEMONMOD_0x5230b1 && !LEMONMOD_0x46703c) {
            if (LEMONMOD_0x388eda.shameCount == 0 || LEMONMOD_0x388eda.shameCount == 1) {} else {
              LEMONMOD_0x46703c = !![];
              let _0x562817 = LEMONMOD_0x388eda.hat;
              let _0x192823 = LEMONMOD_0x388eda.accesory;
              let _0x524f9a = LEMONMOD_0x388eda.shameCount;
              const _0x1410f4 = setInterval(() => {
                if (_0x3d1f00 || LEMONMOD_0x1f0db3 || LEMONMOD_0x5230b1 || LEMONMOD_0x185e28 || LEMONMOD_0x108077) {
                  LEMONMOD_0x54cd5b = !![];
                  LEMONMOD_0x46703c = ![];
                } else {
                  _0xfc5fd(7);
                  _0x10e170(11);
                  LEMONMOD_0x54cd5b = ![];
                  LEMONMOD_0x46703c = !![];
                  if (LEMONMOD_0x388eda.shameCount == 1 || LEMONMOD_0x388eda.shameCount == 0) {
                    clearInterval(_0x1410f4);
                    LEMONMOD_0x46703c = ![];
                    LEMONMOD_0x54cd5b = ![];
                  }
                }
              }, 10);
            }
          }
        }
      }
      function _0x5339db() {
        if (LEMONMOD_0x11c907) {
          for (let _0x3690b6 = 0; _0x3690b6 < 4; _0x3690b6++) {
            let _0x5612e3;
            if (LEMONMOD_0x388eda.dir > 2 || LEMONMOD_0x388eda.dir < 0) {
              _0x5612e3 = 0 + _0x2eea8d(90 * _0x3690b6);
            } else {
              _0x5612e3 = LEMONMOD_0x388eda.dir + _0x2eea8d(90 * _0x3690b6);
            }
            _0x12b203(_0x10775b, _0x5612e3 + 30);
          }
          _0x1ea770("left", !![]);
          setTimeout(() => {
            _0x4ceabd("left", !![]);
          }, 65);
        }
      }
      function _0x552ed9() {
        if (LEMONMOD_0x388eda.hat == 45 && LEMONMOD_0x185e28 == 0) {
          if (_0x3ea09c == 1) {
            setTimeout(function () {
              if (LEMONMOD_0x388eda.hat == 45) _0x3a425c("LemonMod v3.0 - AntiClown");
            }, 100);
            if (_0x58d88b == "2" || _0x58d88b == 2) {
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) {
                  _0x12b203(_0x10775b, _0x458628 + _0x2eea8d(180));
                  _0x35285a(["33", [_0x458628 + _0x2eea8d(180)]]);
                }
              }, 1);
            }
            if (_0x58d88b == "0" || _0x58d88b == 0) {
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x33a490, _0x458628 + _0x2eea8d(90));
              }, 1);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x33a490, _0x458628 - _0x2eea8d(90));
              }, 1);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x33a490, _0x458628 + _0x2eea8d(180));
              }, 1);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x33a490, _0x458628 - _0x2eea8d(180));
              }, 1);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(90));
              }, 2);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(90));
              }, 2);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(180));
              }, 2);
              setTimeout(function () {
                if (LEMONMOD_0x4a8949 == 0) _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(180));
              }, 2);
            }
            if (_0x58d88b == "1" || _0x58d88b == 1) {
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 1);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 120);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 200);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 600);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 700);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 800);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 900);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 1000);
              setTimeout(function () {
                if (LEMONMOD_0x388eda.hat == 45) _0xfc5fd(13);
              }, 1100);
              setTimeout(function () {
                LEMONMOD_0x4a8949 = 0;
              }, 200);
            }
          }
        }
      }
      setInterval(() => {
        _0x583643();
        _0x552ed9();
        _0x4c6a65();
        _0x4fd718();
        _0x4d4fd3();
      }, 50);
      setInterval(() => {
        _0x19244a();
      }, 230);
      let _0x342cca = ![];
      if (LEMONMOD_0x211e6c) {
        console.log("done with killsounds code");
      }
      setInterval(() => {
        const _0x290463 = "{\n\t\"checkType\": {\n        \"saveSettings\": \"" + document.getElementById("saveSettings").checked + "\",\n\t\t\"useBots\": \"" + document.getElementById("useBots").checked + "\",\n\t\t\"heal1\": \"" + document.getElementById("heal1").checked + "\",\n\t\t\"useSounds\": \"" + document.getElementById("useSounds").checked + "\",\n\t\t\"autoUpgrade\": \"" + document.getElementById("autoUpgrade").checked + "\",\n        \"autoPlace\": \"" + document.getElementById("autoPlace").checked + "\",\n\t\t\"anticlown\": \"" + document.getElementById("anticlown").checked + "\",\n\t\t\"heal2\": \"" + document.getElementById("heal2").checked + "\",\n\t\t\"combatBot\": \"" + document.getElementById("combatBot").checked + "\",\n\t\t\"silentMode\": \"" + document.getElementById("silentMode").checked + "\",\n\t\t\"insta\": \"" + document.getElementById("insta").checked + "\",\n\t\t\"autoBuy\": \"" + document.getElementById("autoBuy").checked + "\",\n\t\t\"radar\": \"" + document.getElementById("radar").checked + "\",\n\t\t\"keystrokes\": \"" + document.getElementById("keystrokes").checked + "\",\n\t\t\"reloadBars\": \"" + document.getElementById("reloadBars").checked + "\",\n\t\t\"sAim\": \"" + document.getElementById("sAim").checked + "\",\n\t\t\"bullTick\": \"" + document.getElementById("bullTick").checked + "\",\n\t\t\"autoSpike\": \"" + document.getElementById("autoSpike").checked + "\",\n\t\t\"antiTrap\": \"" + document.getElementById("antiTrap").checked + "\",\n\t\t\"ahat\": \"" + document.getElementById("ahat").checked + "\",\n\t\t\"respawn\": \"" + document.getElementById("respawn").checked + "\",\n\t\t\"cMirr\": \"" + document.getElementById("cMirr").checked + "\",\n\t\t\"shield360\": \"" + document.getElementById("shield360").checked + "\",\n\t\t\"invisBuilds\": \"" + document.getElementById("invisBuilds").checked + "\",\n\t\t\"invisWeapons\": \"" + document.getElementById("invisWeapons").checked + "\",\n\t\t\"derp\": \"" + document.getElementById("derp").checked + "\",\n\t\t\"onclick\": \"" + document.getElementById("onclick").checked + "\",\n\t\t\"antiInsta1\": \"" + document.getElementById("antiInsta1").checked + "\",\n\t\t\"extraAnti\": \"" + document.getElementById("extraAnti").checked + "\",\n\t\t\"useCounterInsta\": \"" + document.getElementById("useCounterInsta").checked + "\",\n\t\t\"antiInsta2\": \"" + document.getElementById("antiInsta2").checked + "\",\n\t\t\"antiInsta3\": \"" + document.getElementById("antiInsta3").checked + "\",\n\t\t\"antiInsta4\": \"" + document.getElementById("antiInsta4").checked + "\",\n\t\t\"antiBoostSpike\": \"" + document.getElementById("antiBoostSpike").checked + "\",\n\t\t\"autoInsta\": \"" + document.getElementById("autoInsta").checked + "\",\n\t\t\"autoInstaBullCheck\": \"" + document.getElementById("autoInstaBullCheck").checked + "\",\n\t\t\"iAim\": \"" + document.getElementById("iAim").checked + "\",\n\t\t\"spikeInsta\": \"" + document.getElementById("spikeInsta").checked + "\",\n\t\t\"autoReload\": \"" + document.getElementById("autoReload").checked + "\",\n\t\t\"songCheck\": \"" + document.getElementById("songCheck").checked + "\",\n\t\t\"acBool\": \"" + document.getElementById("acBool").checked + "\",\n\t\t\"clanSpamBool\": \"" + document.getElementById("clanSpamBool").checked + "\",\n\t\t\"icBool\": \"" + document.getElementById("icBool").checked + "\",\n\t\t\"irBool\": \"" + document.getElementById("irBool").checked + "\",\n\t\t\"ezBool\": \"" + document.getElementById("ezBool").checked + "\",\n\t\t\"cPlayer\": \"" + document.getElementById("cPlayer").checked + "\",\n\t\t\"wLag\": \"" + document.getElementById("wLag").checked + "\"\n\t},\n\t\"listType\": {\n\t\t\"hType\": \"" + $("#hType").val() + "\",\n\t\t\"autoUpgradeType\": \"" + $("#autoUpgradeType").val() + "\",\n        \"sevslot\": \"" + $("#sevslot").val() + "\",\n        \"autoPlaceMode\": \"" + $("#autoPlaceMode").val() + "\",\n\t\t\"clownMode\": \"" + $("#clownMode").val() + "\",\n\t\t\"sfxType\": \"" + $("#sfxType").val() + "\",\n\t\t\"autoFarmType\": \"" + $("#autoFarmType").val() + "\",\n\t\t\"instaType\": \"" + $("#instaType").val() + "\",\n\t\t\"pType\": \"" + $("#pType").val() + "\",\n\t\t\"oHat\": \"" + $("#oHat").val() + "\",\n\t\t\"oAcc\": \"" + $("#oAcc").val() + "\",\n\t\t\"tHat\": \"" + $("#tHat").val() + "\",\n\t\t\"tAcc\": \"" + $("#tAcc").val() + "\",\n\t\t\"otHat\": \"" + $("#otHat").val() + "\",\n\t\t\"otAcc\": \"" + $("#otAcc").val() + "\",\n\t\t\"dHat\": \"" + $("#dHat").val() + "\",\n\t\t\"dAcc\": \"" + $("#dAcc").val() + "\",\n\t\t\"eHat\": \"" + $("#eHat").val() + "\",\n\t\t\"eAcc\": \"" + $("#eAcc").val() + "\",\n\t\t\"ssHat\": \"" + $("#ssHat").val() + "\",\n\t\t\"ssAcc\": \"" + $("#ssAcc").val() + "\",\n\t\t\"srHat\": \"" + $("#srHat").val() + "\",\n\t\t\"srAcc\": \"" + $("#srAcc").val() + "\",\n\t\t\"snHat\": \"" + $("#snHat").val() + "\",\n\t\t\"snAcc\": \"" + $("#snAcc").val() + "\",\n\t\t\"song\": \"" + $("#song").val() + "\",\n\t\t\"aChat\": \"" + $("#aChat").val() + "\",\n\t\t\"clanSpam\": \"" + $("#clanSpam").val() + "\",\n\t\t\"ezChat\": \"" + $("#ezChat").val() + "\",\n\t\t\"rChat\": \"" + $("#rChat").val() + "\",\n\t\t\"kChat\": \"" + $("#kChat").val() + "\"\n\t}\n}";
        if (window.doneParsing == !![] && document.getElementById("mm-menu-container") != null && !LEMONMOD_0x32b091 && window.hasSpawned == !![]) {
          LEMONMOD_0x308f37("modSettings");
          setTimeout(() => {
            LEMONMOD_0xa3d254("modSettings", btoa(_0x290463), 30);
          }, 100);
        }
        if (document.getElementById("clanSpamBool").checked) {
          if (_0x342cca) {
            _0x35285a(["9", [null]]);
          } else {
            _0x35285a(["8", [$("#clanSpam").val().slice(0, 7)]]);
          }
          _0x342cca = !_0x342cca;
        }
      }, 600);
      let _0x5a991b = ![];
      function _0x2e2e68(_0xe529a7, _0x43817e) {
        let _0x3d62e0 = LEMONMOD_0x388eda.x + _0x43817e * Math.cos(_0xe529a7);
        let _0x365fa8 = LEMONMOD_0x388eda.y + _0x43817e * Math.sin(_0xe529a7);
        return LEMONMOD_0xec8f90.some(_0x44c47d => Math.hypot(_0x44c47d[2] - _0x365fa8, _0x44c47d[1] - _0x3d62e0) < _0x44c47d[4]);
      }
      function _0x19244a() {
        try {
          if (document.getElementById("autoPlace").checked && !LEMONMOD_0x185e28 && !LEMONMOD_0x32810f && !_0x5a991b && !_0x268a2e && !_0x3d1f00 && !LEMONMOD_0x5230b1 && !LEMONMOD_0x1f0db3 && LEMONMOD_0x388eda.hat != 31 && LEMONMOD_0x413100 >= 4) {
            for (let _0x4362eb = 0; _0x4362eb < 4; _0x4362eb++) {
              let _0x11f477;
              try {
                _0x11f477 = Math.sqrt(Math.pow(LEMONMOD_0x388eda.y - _0x43c8cd[2], 2) + Math.pow(LEMONMOD_0x388eda.x - _0x43c8cd[1], 2));
              } catch (_0x4a87dd) {
                _0x11f477 = 960;
              }
              if (!(_0x11f477 < 180) && _0x11f477 < 950) {
                let _0x1274ab;
                if (LEMONMOD_0x388eda.dir > 2 || LEMONMOD_0x388eda.dir < 0) {
                  _0x1274ab = 0 + _0x2eea8d(90 * _0x4362eb);
                } else {
                  _0x1274ab = LEMONMOD_0x388eda.dir + _0x2eea8d(90 * _0x4362eb);
                }
                if (!_0x2e2e68(_0x1274ab + 30, 50)) {
                  _0x12b203(_0x132077, _0x1274ab + 30);
                }
              }
            }
          }
        } catch (_0x2c3a1f) {}
        try {
          let _0x444dc3 = 230;
          if (document.getElementById("autoPlace").checked && $("#autoPlaceMode").val() == "smart" && !_0x268a2e && !LEMONMOD_0x185e28 && !_0x5a991b && !LEMONMOD_0x5230b1 && !LEMONMOD_0x1f0db3 && !_0x3d1f00 && Math.sqrt(Math.pow(LEMONMOD_0x388eda.y - _0x43c8cd[2], 2) + Math.pow(LEMONMOD_0x388eda.x - _0x43c8cd[1], 2)) < _0x444dc3) {
            if (LEMONMOD_0x25239c.length == 1) {
              let _0x42b3b8 = 0;
              let _0x181b78 = 0;
              _0x5a991b = !![];
              setTimeout(() => {
                for (let _0x51ec95 = 0; _0x51ec95 < 10; _0x51ec95++) {
                  _0x181b78 = _0x181b78 - 5;
                  if (!_0x2e2e68(_0x458628 + _0x2eea8d(_0x42b3b8), 52)) {
                    _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(_0x42b3b8));
                  }
                  _0x42b3b8 = _0x42b3b8 + 5;
                  if (!_0x2e2e68(_0x458628 + _0x2eea8d(_0x181b78), 52)) {
                    _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(_0x181b78));
                  }
                }
                _0x42b3b8 = 0;
                _0x181b78 = 0;
                _0x5a991b = ![];
              }, 40);
            } else {
              if (!_0x2e2e68(_0x458628, 50)) {
                _0x12b203(_0x132077, _0x458628);
              }
            }
          }
        } catch (_0x1d4bcc) {}
      }
      function _0x33ac43() {
        if (document.getElementById("autoReload").checked && !LEMONMOD_0x13c18f) {
          setTimeout(() => {
            if (_0x99494) {
              _0x3a425c("LemonMod v3.0 -  RELOADING...");
            }
          }, 400);
          LEMONMOD_0x211e6c ? console.log("[reload]: starting...") : window.afiurtbhgiwrfweo = 3;
          LEMONMOD_0x45ba48 = _0x363859;
          _0x35285a(["5", [_0x363859, !0]]);
          LEMONMOD_0x13c18f = !![];
          LEMONMOD_0xde5a9e = 0;
          LEMONMOD_0x265927 = !![];
        }
      }
      var _0x285755 = 10;
      var _0x20633c = 81;
      function _0x582132() {
        if (LEMONMOD_0xc547f4) {
          LEMONMOD_0xc547f4 = ![];
        }
        for (let _0xa29a9c = 0; _0xa29a9c < 13; _0xa29a9c++) {
          setTimeout(() => {
            if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
              _0x35285a(["2", [_0x458628]]);
              LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
            }
          }, 10 + _0xa29a9c * 10);
        }
        if (document.getElementById("extraAnti").checked) {
          setTimeout(() => {
            _0x12b203(_0x398fe5, null);
            _0x12b203(_0x398fe5, null);
            _0x12b203(_0x398fe5, null);
          }, 220);
          setTimeout(() => {
            _0x12b203(_0x398fe5, null);
          }, 230);
        }
        if (document.getElementById("tickBased")) {
          LEMONMOD_0x420350 = "1nb";
        } else {
          _0x2d2c56 = 0;
          var _0x1d68f9 = 0;
          setTimeout(() => {
            if (LEMONMOD_0x509e10 == 45) {
              _0x524f3e();
            }
          }, 150);
          if (_0xc1e86 >= 29) {
            _0x1d68f9 = _0xc1e86;
          }
          if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
            LEMONMOD_0x16b4d5 = !![];
          }
          if (_0x56267c > Math.round(_0x283323 / 10)) {
            _0x56267c = Math.round(_0x283323 / 10);
          }
          if (_0x3c2b5f > Math.round(_0x346955 / 10)) {
            _0x3c2b5f = Math.round(_0x346955 / 10);
          }
          setTimeout(() => {
            LEMONMOD_0x185e28 = 1;
            LEMONMOD_0x32810f = 1;
            setTimeout(() => {
              if (LEMONMOD_0xc547f4) {
                LEMONMOD_0xc547f4 = ![];
              }
              LEMONMOD_0x16b4d5 = ![];
              LEMONMOD_0x185e28 = 0;
              LEMONMOD_0x32810f = 0;
            }, 300);
            setTimeout(() => {
              if (LEMONMOD_0xc547f4) {
                LEMONMOD_0xc547f4 = ![];
              }
              LEMONMOD_0x16b4d5 = ![];
              LEMONMOD_0x185e28 = 0;
              LEMONMOD_0x32810f = 0;
            }, 400);
            setTimeout(() => {
              for (let _0x29ae38 = 0; _0x29ae38 < 13; _0x29ae38++) {
                setTimeout(() => {
                  if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                    _0x35285a(["2", [_0x458628]]);
                    LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                  }
                }, 10 + _0x29ae38 * 10);
              }
              if (document.getElementById("extraAnti").checked) {
                setTimeout(() => {
                  _0x12b203(_0x398fe5, null);
                  _0x12b203(_0x398fe5, null);
                  _0x12b203(_0x398fe5, null);
                }, 220);
                setTimeout(() => {
                  _0x12b203(_0x398fe5, null);
                }, 230);
              }
              if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                _0x35285a(["2", [_0x458628]]);
                LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
              }
              _0x35285a(["14", [1]]);
              LEMONMOD_0x34bf3f = ![];
              LEMONMOD_0x3bac96 = !![];
              LEMONMOD_0x45ba48 = _0x1c1eac;
              _0x35285a(["5", [_0x1c1eac, !![]]]);
              _0xfc5fd(6);
              _0x10e170(21, !![]);
              if (document.getElementById("tickBased").checked) {
                setTimeout(() => {
                  LEMONMOD_0x45ba48 = _0x1c1eac;
                  _0x35285a(["5", [_0x1c1eac, !![]]]);
                  _0x56267c = 0;
                  _0x35285a(["c", [1]]);
                }, 10 + _0x1d68f9);
                if (_0xc1e86 <= 27) {
                  setTimeout(() => {
                    LEMONMOD_0x3bac96 = ![];
                    LEMONMOD_0x34bf3f = !![];
                    _0xfc5fd(53);
                    LEMONMOD_0x45ba48 = _0x363859;
                    _0x35285a(["5", [_0x363859, !![]]]);
                  }, 71 + _0x1d68f9 * 2);
                } else {
                  setTimeout(() => {
                    LEMONMOD_0x3bac96 = ![];
                    LEMONMOD_0x34bf3f = !![];
                    _0xfc5fd(53);
                    LEMONMOD_0x45ba48 = _0x363859;
                    _0x35285a(["5", [_0x363859, !![]]]);
                  }, 81 + _0x1d68f9 * 2);
                }
              } else {
                setTimeout(() => {
                  LEMONMOD_0x3bac96 = ![];
                  LEMONMOD_0x34bf3f = !![];
                  _0xfc5fd(53);
                  LEMONMOD_0x45ba48 = _0x363859;
                  _0x35285a(["5", [_0x363859, !![]]]);
                }, 130);
              }
              setTimeout(() => {
                LEMONMOD_0x3bac96 = ![];
                LEMONMOD_0x34bf3f = ![];
                _0x35285a(["c", [0, null]]);
                _0xfc5fd(6);
                _0x10e170(21);
                LEMONMOD_0x45ba48 = _0x1c1eac;
                _0x35285a(["5", [_0x1c1eac, !![]]]);
              }, 230 + _0x1d68f9 * 2);
              setTimeout(() => {
                LEMONMOD_0x185e28 = 0;
                LEMONMOD_0x32810f = 0;
                _0x33ac43();
              }, 250 + _0x1d68f9 * 2);
            }, 30);
          }, Math.abs(_0x283323 / 10 - _0x56267c));
        }
      }
      function _0x17a80e() {
        let _0x5232ca = _0x15a8ba(1, 3);
        if (_0x5232ca == 1) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_f_1);
        } else if (_0x5232ca == 2) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_f_2);
        } else if (_0x5232ca == 3) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_f_3);
        }
        let _0x405504 = _0x15a8ba(1, 3);
        setTimeout(() => {
          if (_0x405504 == 1) {
            LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_l_1);
          } else if (_0x405504 == 2) {
            LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_l_2);
          } else if (_0x405504 == 3) {
            LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_insta_l_3);
          }
        }, 80);
      }
      function _0x54206c() {
        _0x5339db();
        if (LEMONMOD_0x11c907) {
          setTimeout(_0x54206c, _0x283323);
        }
      }
      function _0x966585(_0x4c2a50) {
        for (let _0xe541a0 = 0; _0xe541a0 < 13; _0xe541a0++) {
          setTimeout(() => {
            if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
              _0x35285a(["2", [_0x458628]]);
              LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
            }
          }, 10 + _0xe541a0 * 10);
        }
        if (document.getElementById("extraAnti").checked) {
          setTimeout(() => {
            _0x12b203(_0x398fe5, null);
            _0x12b203(_0x398fe5, null);
            _0x12b203(_0x398fe5, null);
          }, 220);
          setTimeout(() => {
            _0x12b203(_0x398fe5, null);
          }, 230);
        }
        if (document.getElementById("tickBased").checked) {
          LEMONMOD_0x420350 = "1";
        } else {
          setTimeout(() => {
            LEMONMOD_0x45ba48 = _0x1c1eac;
            _0x35285a(["5", [_0x1c1eac, !![]]]);
            _0x56267c = 0;
            _0x35285a(["c", [1]]);
          }, 30);
          setTimeout(() => {
            LEMONMOD_0x3bac96 = ![];
            LEMONMOD_0x34bf3f = !![];
            _0xfc5fd(53);
            LEMONMOD_0x45ba48 = _0x363859;
            _0x35285a(["5", [_0x363859, !![]]]);
          }, 160);
        }
        setTimeout(() => {
          LEMONMOD_0x3bac96 = ![];
          LEMONMOD_0x34bf3f = ![];
          _0x35285a(["c", [0, null]]);
          _0xfc5fd(6);
          _0x10e170(21);
          LEMONMOD_0x45ba48 = _0x1c1eac;
          _0x35285a(["5", [_0x1c1eac, !![]]]);
        }, 230 + _0xc1e86 * 2);
        setTimeout(() => {
          LEMONMOD_0x185e28 = 0;
          LEMONMOD_0x32810f = 0;
          _0x33ac43();
        }, 250 + _0xc1e86 * 2);
      }
      function _0x1268e6() {
        if (LEMONMOD_0xc547f4) {
          LEMONMOD_0xc547f4 = ![];
        }
        let _0x307b28 = !![];
        var _0xb7b1f = 0;
        setTimeout(() => {
          if (LEMONMOD_0x509e10 == 45) {
            _0x524f3e();
          }
        }, 150);
        if (_0xc1e86 >= 29) {
          _0xb7b1f = _0xc1e86;
        }
        _0x2d2c56 = 0;
        setTimeout(() => {
          if ($("#instaType").val() == "lag" && _0x6a5c13) {
            _0x83059.oldSend(LEMONMOD_0x901598);
          }
        }, 1);
        if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
          LEMONMOD_0x16b4d5 = !![];
        }
        if (_0x56267c > Math.round(_0x283323 / 10)) {
          _0x56267c = Math.round(_0x283323 / 10);
        }
        if (_0x3c2b5f > Math.round(_0x346955 / 10)) {
          _0x3c2b5f = Math.round(_0x346955 / 10);
        }
        setTimeout(() => {
          LEMONMOD_0x185e28 = 1;
          LEMONMOD_0x32810f = 1;
          setTimeout(() => {
            if (LEMONMOD_0xc547f4) {
              LEMONMOD_0xc547f4 = ![];
            }
            LEMONMOD_0x16b4d5 = ![];
            LEMONMOD_0x185e28 = 0;
            LEMONMOD_0x32810f = 0;
          }, 300);
          setTimeout(() => {
            if (LEMONMOD_0xc547f4) {
              LEMONMOD_0xc547f4 = ![];
            }
            LEMONMOD_0x16b4d5 = ![];
            LEMONMOD_0x185e28 = 0;
            LEMONMOD_0x32810f = 0;
          }, 400);
          _0x17a80e();
          if ($("#instaType").val() == "oneframe") {
            if (LEMONMOD_0xaf14e2 == "polearm") {
              const _0x46758f = setInterval(() => {
                if (_0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 240 && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) > 220) {
                  _0x35285a(["33", [null]]);
                  clearInterval(_0x46758f);
                  LEMONMOD_0x185e28 = !![];
                  LEMONMOD_0x16b4d5 = !![];
                  LEMONMOD_0x41fe60 = !![];
                  _0xfc5fd(53);
                  _0x10e170(19);
                  _0x35285a(["33", [null]]);
                } else {
                  _0x35285a(["33", [_0x458628]]);
                }
              }, 100);
            } else {
              _0x3a425c("LemonMod v3.0 - No insta! :(");
            }
          } else if ($("#instaType").val() == "onetick") {
            if (LEMONMOD_0xaf14e2 == "polearm" && LEMONMOD_0x5d1c22 == "crossbow") {
              let _0x3025f9;
              try {
                _0x3025f9 = _0x329e16(_0x43c8cd, LEMONMOD_0x388eda);
              } catch (_0x4bd799) {
                _0x3025f9 = 175;
              }
              LEMONMOD_0x32810f = 1;
              LEMONMOD_0x4d4cb1 = LEMONMOD_0x388eda.hat;
              LEMONMOD_0x52ed37 = LEMONMOD_0x388eda.accessory;
              LEMONMOD_0x185e28 = 1;
              if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                _0x35285a(["2", [_0x458628]]);
                LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
              }
              LEMONMOD_0x45ba48 = _0x363859;
              _0x35285a(["5", [_0x363859, !0]]);
              _0xfc5fd(53);
              _0x10e170(21, !![]);
              setTimeout(() => {
                if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                  _0x35285a(["2", [_0x458628]]);
                  LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                }
                _0xfc5fd(53);
                _0x10e170(21, !![]);
                _0x37ffb4();
              }, (_0x3025f9 - 20) / 2);
              setTimeout(() => {
                if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                  _0x35285a(["2", [_0x458628]]);
                  LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                }
                _0x12b203(_0x132077, _0x458628);
                _0x12b203(_0x132077, _0x458628);
                setTimeout(() => {
                  _0x12b203(_0x132077, _0x458628);
                  _0x12b203(_0x132077, _0x458628);
                }, 20);
                setTimeout(() => {
                  _0x12b203(_0x132077, _0x458628);
                  _0x12b203(_0x132077, _0x458628);
                }, 40);
                _0x35285a(["33", [_0x458628]]);
                setTimeout(() => {
                  _0x35285a(["33", [null]]);
                }, 140);
                LEMONMOD_0x45ba48 = _0x1c1eac;
                _0x35285a(["5", [_0x1c1eac, !0]]);
                _0x35285a(["5", [_0x1c1eac, !0]]);
                _0x35285a(["5", [_0x1c1eac, !0]]);
                setTimeout(() => {
                  _0x35285a(["5", [_0x1c1eac, !0]]);
                }, 10);
                _0xfc5fd(7);
                _0x10e170(13, !![]);
                _0x37ffb4();
                _0x37ffb4();
                _0x37ffb4();
                _0x37ffb4();
                _0x37ffb4();
              }, (_0x3025f9 - 20) / 2 + 80);
              setTimeout(() => {
                LEMONMOD_0x185e28 = 0;
                LEMONMOD_0x32810f = 0;
              }, 500);
              setTimeout(() => {
                setTimeout(() => {
                  if (document.getElementById("spikeInsta").checked) {
                    _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(65)), _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(65));
                  }
                }, 20);
              }, (_0x3025f9 - 20) / 2 + 132.5);
              setTimeout(() => {
                if (_0x99494) {
                  _0x3a425c(_0x3bec8c);
                }
              }, 2700);
            } else {
              _0x3a425c("LemonMod v3.0 - No insta! :(");
            }
          } else {
            if (LEMONMOD_0xaf14e2 == "polearm" && LEMONMOD_0x5d1c22 == "musket") {
              LEMONMOD_0x32810f = 1;
              LEMONMOD_0x4d4cb1 = LEMONMOD_0x388eda.hat;
              LEMONMOD_0x52ed37 = LEMONMOD_0x388eda.accessory;
              LEMONMOD_0x185e28 = 1;
              if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                _0x35285a(["2", [_0x458628]]);
                LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
              }
              _0xfc5fd(7);
              _0x10e170(13, !![]);
              if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                _0x35285a(["2", [_0x458628]]);
                LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
              }
              LEMONMOD_0x45ba48 = _0x1c1eac;
              _0x35285a(["5", [_0x1c1eac, !0]]);
              _0x37ffb4();
              setTimeout(() => {
                if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                  _0x35285a(["2", [_0x458628]]);
                  LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                }
                LEMONMOD_0x45ba48 = _0x363859;
                _0x35285a(["5", [_0x363859, !0]]);
                _0x35285a(["5", [_0x363859, !0]]);
                setTimeout(() => {
                  _0x37ffb4();
                }, 80);
                setTimeout(() => {
                  if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                    _0x35285a(["2", [_0x458628]]);
                    LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                  }
                  _0xfc5fd(53);
                  _0x10e170(21, !![]);
                }, 130);
                setTimeout(() => {
                  if (document.getElementById("spikeInsta").checked) {
                    _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(65)), _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(65));
                  }
                }, 20);
              }, 92.5);
              setTimeout(() => {
                _0xfc5fd(LEMONMOD_0x4d4cb1);
                _0x10e170(LEMONMOD_0x52ed37);
                LEMONMOD_0x185e28 = 0;
                LEMONMOD_0x32810f = 0;
                _0x33ac43();
              }, 150);
            } else if (LEMONMOD_0xaf14e2 == "katana" && LEMONMOD_0x5d1c22 == "musket" && ($("#instaType").val() == "normal" || $("#instaType").val() == "lag")) {
              _0x966585(_0xb7b1f);
            } else if (LEMONMOD_0xaf14e2 == "tool_hammer" && LEMONMOD_0x5d1c22 == "none" && LEMONMOD_0x413100 >= 2) {
              LEMONMOD_0x32810f = 1;
              LEMONMOD_0x185e28 = 1;
              setTimeout(() => {
                _0x10e170(0);
                _0xfc5fd(7);
                _0x37ffb4();
                setTimeout(() => {
                  _0x35285a(["6", [5]]);
                }, 110);
                setTimeout(() => {
                  LEMONMOD_0x185e28 = 0;
                  LEMONMOD_0x32810f = 0;
                }, 800);
              }, 30);
            } else {
              _0x3a425c("LemonMod v3.0 - No insta! :(");
            }
          }
        }, Math.abs(_0x283323 / 10 - _0x56267c));
      }
      setTimeout(() => {
        if (document.getElementById("saveSettings").checked) {
          const _0x20bf85 = LEMONMOD_0x3fb309("modSettings");
          LEMONMOD_0x3a31d8(_0x20bf85);
        }
        setTimeout(() => {
          if (document.getElementById("keystrokes").checked) {
            document.getElementById("onekey").style.display = "block";
            document.getElementById("spacekey").style.display = "block";
            document.getElementById("rkey").style.display = "block";
            document.getElementById("ekey").style.display = "block";
            document.getElementById("fourkey").style.display = "block";
            document.getElementById("threekey").style.display = "block";
            document.getElementById("wkey").style.display = "block";
            document.getElementById("qkey").style.display = "block";
            document.getElementById("twokey").style.display = "block";
          } else {
            document.getElementById("onekey").style.display = "none";
            document.getElementById("spacekey").style.display = "none";
            document.getElementById("rkey").style.display = "none";
            document.getElementById("ekey").style.display = "none";
            document.getElementById("fourkey").style.display = "none";
            document.getElementById("threekey").style.display = "none";
            document.getElementById("wkey").style.display = "none";
            document.getElementById("qkey").style.display = "none";
            document.getElementById("twokey").style.display = "none";
          }
          document.getElementById("radar").checked ? (document.getElementById("canvas").style.zIndex = "1", _0x81eb13.style.zIndex = "1") : (document.getElementById("canvas").style.zIndex = "-1", _0x81eb13.style.zIndex = "-1");
        }, 50);
      }, 1000);
      setTimeout(() => {
        if (LEMONMOD_0x15fe57) {
          LEMONMOD_0x5ef9f2.play();
        }
      }, 1100);
      function _0x3b7a10() {
        if (window.isDev == 1) {
          var _0x5c765d = prompt("LemonMod v3.0 Developer Console\n\nAvailable Commands: \nkatana(), musket(), kmsk(), tryCrash(), createTribe(), leaveTribe(), heal(), chat(\"example\"), place(example), dns([\"foo\",\"bar\"]), clan(), toggleMenu(), downloadSource(), devNotes(), changeSiuJiSpeed(), dnsDict(), ");
        } else {
          _0x5c765d = prompt("LemonMod v3.0 Console\n\nAvailable Commands: \nkatana(), musket(), kmsk(), tryCrash(), createTribe(), leaveTribe(), heal(), chat(\"example\"), place(example), dns([\"foo\",\"bar\"]), clan(), toggleMenu()");
        }
        if (_0x5c765d == "katana()") {
          _0x35285a([6, [4]]);
        } else if (_0x5c765d == "musket()") {
          _0x35285a([6, [15]]);
        } else if (_0x5c765d == "clan()") {
          var _0xdaf7 = prompt("Clan Name:");
          _0x35285a(["9", [null]]);
          _0x35285a(["9", [null]]);
          _0x35285a(["9", [null]]);
          setTimeout(function () {
            _0x35285a(["9", [null]]);
          }, 25);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 50);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 100);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 250);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 500);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 1000);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 1250);
          setTimeout(function () {
            _0x35285a(["8", [_0xdaf7]]);
          }, 1500);
        } else if (_0x5c765d == "kmsk()") {
          _0x35285a([6, [4]]);
          _0x35285a([6, [15]]);
        } else if (_0x5c765d == "tryCrash()") {
          alert("not supported at the moment");
        } else if (_0x5c765d == "createTribe()") {
          _0x35285a(["9", [null]]);
          setTimeout(function () {
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
          }, 10);
          setTimeout(function () {
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
            _0x35285a(["8", ["~DaRk~"]]);
          }, 500);
        } else if (_0x5c765d == "leaveTribe()") {
          _0x35285a(["9", [null]]);
        } else if (_0x5c765d == "heal()") {
          _0x4f1d74();
        } else if (_0x5c765d == "toggleMenu()") {
          _0x4574d1.style.display = "block" == _0x4574d1.style.display ? "none" : "block", _0x3ebb3f();
        } else if (_0x5c765d.includes("chat(")) {
          LEMONMOD_0x1aecfd = _0x5c765d.slice(6, -2);
          _0x3a425c(LEMONMOD_0x1aecfd);
        } else if (_0x5c765d.includes("dns([")) {
          if (_0x5c765d.includes("dns([\"")) {
            LEMONMOD_0x1aecfd = _0x5c765d.slice(6, 7);
            LEMONMOD_0xa732cc = _0x5c765d.slice(11, -3);
          } else {
            LEMONMOD_0x1aecfd = _0x5c765d.slice(5, 6);
            LEMONMOD_0xa732cc = _0x5c765d.slice(9, -3);
          }
          LEMONMOD_0xa4b47b = "dns([" + LEMONMOD_0x1aecfd + ", [" + LEMONMOD_0xa732cc + "]])";
          eval(LEMONMOD_0xa4b47b);
        } else {
          try {
            eval(_0x5c765d);
          } catch (_0x19e646) {}
        }
        _0x3a425c("Executed \"" + _0x5c765d + "\"");
      }
      setInterval(() => {
        if (LEMONMOD_0x45ba48 == _0x1c1eac && LEMONMOD_0xaf14e2 == "daggers" && LEMONMOD_0x5230b1) {
          _0x37ffb4();
        } else {
          if (LEMONMOD_0x45ba48 == _0x1c1eac && _0x6a5c13 && LEMONMOD_0x5230b1) {
            _0x37ffb4();
          }
          if (LEMONMOD_0x45ba48 == _0x363859 && _0x513ad6 && LEMONMOD_0x5230b1) {
            _0x37ffb4();
          }
        }
      }, _0x283323 - 20);
      function _0x1ea770(_0x47bdf7, _0x5d30eb = ![]) {
        if (_0x5d30eb) {
          if (LEMONMOD_0x3f2908.length >= 4) {
            _0xfc5fd(22);
          } else {
            _0xfc5fd(6);
          }
          let _0x5c6aec = _0x283323;
          if (LEMONMOD_0x5d1c22 != "great_hammer") {
            if (_0x5c6aec == 310) {
              _0x5c6aec = 105;
            } else if (_0x5c6aec == 110) {
              _0x5c6aec = 40;
            } else if (_0x5c6aec == 410) {
              _0x5c6aec = 95;
            } else if (_0x5c6aec == 710) {
              _0x5c6aec = 240;
            }
          } else {
            _0x5c6aec = 125;
          }
          if (LEMONMOD_0x185e28 == 0 && !LEMONMOD_0x5230b1) {
            if (LEMONMOD_0x45ba48 == _0x1c1eac) {
              LEMONMOD_0x5230b1 = !![];
              _0xfc5fd(40);
              setTimeout(() => {
                _0xfc5fd(6);
              }, _0x5c6aec);
            } else {
              LEMONMOD_0x5230b1 = !![];
              _0xfc5fd(40);
              setTimeout(() => {
                _0xfc5fd(6);
              }, _0x5c6aec);
            }
          }
        } else {
          if (!LEMONMOD_0x4a352c) {
            window.hatbeforeclick = LEMONMOD_0x388eda.hat;
            window.accbeforeclick = LEMONMOD_0x388eda.accessory;
            let _0x335071 = _0x283323;
            if (LEMONMOD_0x5d1c22 != "great_hammer") {
              if (_0x335071 == 310) {
                _0x335071 = 105;
              } else if (_0x335071 == 110) {
                _0x335071 = 40;
              } else if (_0x335071 == 410) {
                _0x335071 = 95;
              } else if (_0x335071 == 710) {
                _0x335071 = 240;
              }
            } else {
              _0x335071 = 125;
            }
            if (_0x1b36e6 && LEMONMOD_0x185e28 == 0 && !LEMONMOD_0x5230b1) {
              if (_0x47bdf7 == "left") {
                if (LEMONMOD_0x45ba48 == _0x1c1eac) {
                  LEMONMOD_0x5230b1 = !![];
                  _0xfc5fd(40);
                  setTimeout(() => {
                    _0xfc5fd(7);
                    _0x10e170(13, !![]);
                  }, _0x335071);
                  setTimeout(() => {
                    if (LEMONMOD_0x5230b1) {
                      _0xfc5fd(40);
                      _0x10e170(11, !![]);
                    }
                  }, _0x335071 * 2);
                } else if (LEMONMOD_0x45ba48 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {
                  LEMONMOD_0x5230b1 = !![];
                  LEMONMOD_0x45ba48 = _0x1c1eac;
                  _0x2a0d88(_0x1c1eac);
                  _0xfc5fd(40);
                  setTimeout(() => {
                    _0xfc5fd(7);
                    _0x10e170(13, !![]);
                  }, _0x335071);
                  setTimeout(() => {
                    if (LEMONMOD_0x5230b1) {
                      _0xfc5fd(40);
                      _0x10e170(11, !![]);
                    }
                  }, _0x335071 * 2);
                } else {
                  LEMONMOD_0x5230b1 = !![];
                  _0xfc5fd(40);
                  setTimeout(() => {
                    _0xfc5fd(7);
                    _0x10e170(13, !![]);
                  }, _0x335071);
                  setTimeout(() => {
                    if (LEMONMOD_0x5230b1) {
                      _0xfc5fd(40);
                      _0x10e170(11, !![]);
                    }
                  }, _0x335071 * 2);
                }
              } else if (_0x47bdf7 == "right") {
                LEMONMOD_0x16b4d5 = !![];
                if (!(LEMONMOD_0x45ba48 == _0x1c1eac && LEMONMOD_0xaf14e2 == "daggers")) {
                  setTimeout(() => {
                    LEMONMOD_0x16b4d5 = ![];
                  }, _0x335071);
                }
                if (_0x388861.length >= 1 && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 280) {
                  _0x12b203(_0x132077, _0x458628);
                  _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(75));
                  _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(75));
                }
                if (LEMONMOD_0x45ba48 == _0x1c1eac) {
                  if (LEMONMOD_0xaf14e2 == "daggers") {
                    LEMONMOD_0x225125 = !![];
                  }
                  LEMONMOD_0x5230b1 = !![];
                  _0xfc5fd(7);
                  _0x10e170(18, !![]);
                  if (LEMONMOD_0xaf14e2 != "daggers") {
                    setTimeout(() => {
                      _0xfc5fd(6);
                      _0x10e170(19, !![]);
                    }, _0x335071);
                    setTimeout(() => {
                      if (LEMONMOD_0x5230b1) {
                        _0xfc5fd(7);
                        _0x10e170(18, !![]);
                      }
                    }, _0x335071 * 2);
                  }
                } else if (LEMONMOD_0x45ba48 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {
                  LEMONMOD_0x5230b1 = !![];
                  LEMONMOD_0x45ba48 = _0x1c1eac;
                  _0x2a0d88(_0x1c1eac);
                  _0xfc5fd(7);
                  _0x10e170(18, !![]);
                  setTimeout(() => {
                    _0xfc5fd(6);
                    _0x10e170(19, !![]);
                  }, _0x335071);
                  setTimeout(() => {
                    if (LEMONMOD_0x5230b1) {
                      _0xfc5fd(7);
                      _0x10e170(18, !![]);
                    }
                  }, _0x335071 * 2);
                } else {
                  LEMONMOD_0x5230b1 = !![];
                  _0xfc5fd(7);
                  _0x10e170(18, !![]);
                  setTimeout(() => {
                    _0xfc5fd(6);
                    _0x10e170(19, !![]);
                  }, _0x335071);
                  setTimeout(() => {
                    if (LEMONMOD_0x5230b1) {
                      _0xfc5fd(7);
                      _0x10e170(18, !![]);
                    }
                  }, _0x335071 * 2);
                }
              }
              _0xb56b1f = 0;
              _0x37ffb4();
            }
          }
        }
      }
      function _0x4ceabd(_0x36eee3, _0x3a7a33 = ![]) {
        if (_0x3a7a33) {
          if (LEMONMOD_0x185e28 == 0) {
            setTimeout(() => {
              _0xfc5fd(6);
              _0x10e170(21);
              LEMONMOD_0x5230b1 = ![];
            }, _0x283323 / 4.13);
          }
        } else {
          if (_0x1b36e6 && LEMONMOD_0x185e28 == 0) {
            if (_0x36eee3 == "left") {
              setTimeout(() => {
                _0xfc5fd(window.hatbeforeclick);
                _0x10e170(window.accbeforeclick);
                LEMONMOD_0x5230b1 = ![];
              }, _0x283323 / 4.13);
            } else if (_0x36eee3 == "right") {
              setTimeout(() => {
                _0xfc5fd(window.hatbeforeclick);
                _0x10e170(window.accbeforeclick);
                LEMONMOD_0x5230b1 = ![];
                if (LEMONMOD_0xaf14e2 == "daggers") {
                  try {
                    LEMONMOD_0x225125 = ![];
                    LEMONMOD_0x16b4d5 = ![];
                  } catch (_0x4b9f3f) {}
                }
              }, _0x283323 / 4.13);
            }
          }
        }
      }
      async function _0x108473(_0x216287, _0x219fe9) {
        let _0x3fdcdf = _0x216287.split("\n").length;
        let _0x643bbd = _0x216287.split("\n");
        for (var _0x1d841b = 0; _0x1d841b < _0x3fdcdf; _0x1d841b++) {
          if (_0x124dac == 1) {
            var _0x3a8f49 = _0x643bbd[_0x1d841b].slice(0, 30);
            if (document.activeElement.id.toLowerCase() != "chatbox") {
              _0x35285a(["ch", [_0x3a8f49]]);
            }
            await _0x1067d5(parseInt(_0x219fe9));
            if (_0x1d841b == _0x3fdcdf - 1) {
              _0x108473(_0x216287, _0x219fe9);
            }
          }
        }
      }
      function _0x3a5925() {
        if (document.getElementById("autoBuy").checked || document.getElementById("combatBot").checked) {
          storeBuy(11, 1);
          storeBuy(7);
          storeBuy(6);
          storeBuy(12);
          storeBuy(31);
          storeBuy(15);
          storeBuy(53);
          storeBuy(40);
          storeBuy(11);
          storeBuy(26);
          storeBuy(21, 1);
          storeBuy(13, 1);
          storeBuy(22);
        }
      }
      function _0x6bb3cd() {
        let _0x3427a9 = _0x15a8ba(1, 2);
        if (_0x3427a9 == 1) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_elim1);
        } else if (_0x3427a9 == 2) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_elim2);
        }
      }
      function _0x4d4fd3() {
        var _0x491dd9 = parseInt(document.getElementById("killCounter").innerText);
        if (_0x491dd9 > _0x3e4872) {
          _0x48275e = _0x48275e + 1;
          if (_0x141996) {
            _0x3a425c(_0x40878c);
          }
          ;
          if (LEMONMOD_0x15fe57) {
            if ($("#sfxType").val() == "fn") {
              _0x6bb3cd();
            } else {
              _0x22659b.play();
            }
          }
        }
        _0x3e4872 = _0x491dd9;
      }
      _0x4e3051 = "2";
      document.body.append(_0x4574d1);
      if (LEMONMOD_0x211e6c) {
        console.log("append HealChecks...");
      }
      let _0x124dac = 0;
      const _0x1067d5 = _0x1e2f52 => new Promise(_0x27f26c => setTimeout(_0x27f26c, _0x1e2f52));
      var _0xb9b990 = _0x4574d1.querySelector("#heal1");
      _0xb9b990.addEventListener("change", function () {
        _0xfdcd01 = !!this.checked;
      });
      var _0x126491 = _0x4574d1.querySelector("#useSounds");
      _0x126491.addEventListener("change", function () {
        LEMONMOD_0x15fe57 = !!this.checked;
      });
      var _0x596d62 = _0x4574d1.querySelector("#autoInsta");
      _0x596d62.addEventListener("change", function () {
        LEMONMOD_0xc547f4 = !!this.checked;
      });
      var _0x4f31f6 = _0x4574d1.querySelector("#useBots");
      _0x4f31f6.addEventListener("change", function () {
        _0x3069e3();
      });
      var _0x42dbb0 = _0x4574d1.querySelector("#heal2");
      _0x42dbb0.addEventListener("change", function () {
        _0x3671d5 = !!this.checked;
      });
      var _0x3e007e = _0x4574d1.querySelector("#insta");
      _0x3e007e.addEventListener("change", function () {
        _0x32a8eb = !!this.checked;
      });
      var _0x26767b = _0x4574d1.querySelector("#keystrokes");
      _0x26767b.addEventListener("change", function () {
        if (document.getElementById("keystrokes").checked) {
          document.getElementById("onekey").style.display = "block";
          document.getElementById("spacekey").style.display = "block";
          document.getElementById("rkey").style.display = "block";
          document.getElementById("ekey").style.display = "block";
          document.getElementById("fourkey").style.display = "block";
          document.getElementById("threekey").style.display = "block";
          document.getElementById("wkey").style.display = "block";
          document.getElementById("qkey").style.display = "block";
          document.getElementById("twokey").style.display = "block";
        } else {
          document.getElementById("onekey").style.display = "none";
          document.getElementById("spacekey").style.display = "none";
          document.getElementById("rkey").style.display = "none";
          document.getElementById("ekey").style.display = "none";
          document.getElementById("fourkey").style.display = "none";
          document.getElementById("threekey").style.display = "none";
          document.getElementById("wkey").style.display = "none";
          document.getElementById("qkey").style.display = "none";
          document.getElementById("twokey").style.display = "none";
        }
      });
      var _0x355ea5 = document.querySelector("#radar");
      _0x355ea5.addEventListener("change", function () {
        this.checked ? (document.getElementById("canvas").style.zIndex = "1", _0x81eb13.style.zIndex = "1") : (document.getElementById("canvas").style.zIndex = "-1", _0x81eb13.style.zIndex = "-1");
      });
      var _0x5294c4 = document.querySelector("#sAim");
      _0x5294c4.addEventListener("change", function () {
        _0x214b2b = !!this.checked;
      });
      var _0x31fb11 = document.querySelector("#ahat");
      _0x31fb11.addEventListener("change", function () {
        _0x10f133 = !!this.checked;
      });
      var _0x5be2d6 = document.querySelector("#respawn");
      _0x5be2d6.addEventListener("change", function () {
        _0xed368e = !!this.checked;
      });
      _0x3b1c8f = ![];
      _0x52c65c = !![];
      _0x147e03 = !![];
      var _0x31594a = _0x4574d1.querySelector("#derp");
      _0x31594a.addEventListener("change", function () {
        _0x5c78b0 = !!this.checked;
      });
      var _0x136b68 = _0x4574d1.querySelector("#anticlown");
      _0x136b68.addEventListener("change", function () {
        _0x3ea09c = !!this.checked;
      });
      var _0x18a2d5 = _0x4574d1.querySelector("#invisWeapons");
      _0x18a2d5.addEventListener("change", function () {
        _0x131373 = !!this.checked;
      });
      var _0x47ee38 = _0x4574d1.querySelector("#onclick");
      _0x47ee38.addEventListener("change", function () {
        _0x1b36e6 = !!this.checked;
      });
      var _0x58cb9b = _0x4574d1.querySelector("#antiBoostSpike");
      _0x58cb9b.addEventListener("change", function () {
        _0x24bc6f = !!this.checked;
      });
      var _0x2d3686 = _0x4574d1.querySelector("#antiInsta1");
      _0x2d3686.addEventListener("change", function () {
        _0xa2cd26 = !!this.checked;
      });
      var _0x29ad37 = _0x4574d1.querySelector("#antiInsta2");
      _0x29ad37.addEventListener("change", function () {
        _0x3d3eb8 = !!this.checked;
      });
      var _0x2fabe8 = _0x4574d1.querySelector("#antiInsta3");
      _0x2fabe8.addEventListener("change", function () {
        _0x27b8d0 = !!this.checked;
      });
      var _0x73b764 = _0x4574d1.querySelector("#antiInsta4");
      _0x73b764.addEventListener("change", function () {
        _0x27dd09 = !!this.checked;
      });
      var _0x398b01 = _0x4574d1.querySelector("#useCounterInsta");
      _0x398b01.addEventListener("change", function () {
        LEMONMOD_0xc18ed7 = !!this.checked;
      });
      var _0x5c02ff = _0x4574d1.querySelector("#iAim");
      _0x5c02ff.addEventListener("change", function () {
        _0x1cc8bf = !!this.checked;
      });
      var _0x1f1f1c = _0x4574d1.querySelector("#autoReload");
      _0x1f1f1c.addEventListener("change", function () {
        _0x27276a = !!this.checked;
      });
      var _0x462735 = _0x4574d1.querySelector("#iReverse");
      _0x462735.addEventListener("change", function () {
        _0x22add3 = !this.checked;
      });
      var _0x2d10ee = _0x4574d1.querySelector("#iSwitch");
      _0x2d10ee.addEventListener("change", function () {
        _0x5a0594 = !!this.checked;
      });
      var _0x608367 = _0x4574d1.querySelector("#acBool");
      _0x608367.addEventListener("change", function () {
        _0x4335ff = !!this.checked;
      });
      var _0x51d379 = _0x4574d1.querySelector("#icBool");
      _0x51d379.addEventListener("change", function () {
        _0x141996 = !!this.checked;
      });
      var _0x321696 = _0x4574d1.querySelector("#irBool");
      _0x321696.addEventListener("change", function () {
        _0x99494 = !!this.checked;
      });
      var _0x4be547 = _0x4574d1.querySelector("#ezBool");
      _0x4be547.addEventListener("change", function () {
        _0x3e7b93 = !!this.checked;
      });
      var _0x425931 = _0x4574d1.querySelector("#cPlayer");
      _0x425931.addEventListener("change", function () {
        _0x5e0ada = !!this.checked;
      });
      var _0x5d3f6f = _0x4574d1.querySelector("#wLag");
      if (LEMONMOD_0x211e6c) {
        console.log("check for menu key to toggle the gui...");
      }
      function _0x28b334(_0x2173ae) {
        if (!LEMONMOD_0x4a352c) {
          "Escape" === _0x2173ae.key && (_0x2173ae.preventDefault(), _0x4cd7f4());
        }
      }
      if (LEMONMOD_0x211e6c) {
        console.log("sendClick function defined");
      }
      function _0x411762(_0x31250e) {
        var _0x290233 = _0x31250e.target;
        _0x54d7d0();
        for (var _0x1bca25 = ["main", "offense", "defense", "support", "controls", "instakill", "chat", "hatmacro", "credits"], _0x2b5284 = 0; _0x2b5284 < _0x1bca25.length; _0x2b5284++) {
          var _0xdb1349 = _0x1bca25[_0x2b5284];
          _0x290233.textContent.toLowerCase() == _0xdb1349 && (document.querySelector("#mm-" + _0xdb1349 + "-menu").style.display = "block", _0x290233.classList.add("is-active"));
        }
      }
      if (LEMONMOD_0x211e6c) {
        console.log("hide all other menus code defined");
      }
      function _0x54d7d0() {
        for (var _0x262fa7 = ["#mm-main-menu", "#mm-offense-menu", "#mm-defense-menu", "#mm-support-menu", "#mm-controls-menu", "#mm-instakill-menu", "#mm-chat-menu", "#mm-hatmacro-menu", "#mm-credits-menu"], _0x1345cd = 0; _0x1345cd < _0x262fa7.length; _0x1345cd++) {
          var _0x162c5f = _0x262fa7[_0x1345cd];
          document.querySelector(_0x162c5f).style.display = "none", document.querySelectorAll(".i-tab-menu-item").forEach(function (_0x36e7de) {
            return _0x36e7de.classList.remove("is-active"), _0x36e7de.classList.remove("glow");
          });
        }
      }
      if (LEMONMOD_0x211e6c) {
        console.log("reset hat defined");
      }
      function _0x3ebb3f() {
        _0x58d88b = $("#clownMode").val(), _0x4e3051 = $("#hType").val(), _0x2af36c = $("#pType").val(), _0x1c130c = $("#aChat").val(), _0x1d5dda = $("#oHat").val(), _0x2ece18 = $("#oAcc").val(), _0x15f7d6 = $("#otHat").val(), _0x3332f4 = $("#otAcc").val(), _0x13642c = $("#dHat").val(), _0x504950 = $("#dAcc").val(), _0x29c80e = $("#tHat").val(), _0x5e8a7f = $("#tAcc").val(), _0x4f5dad = $("#eHat").val(), _0x5ab00e = $("#eAcc").val(), _0x1deffa = $("#snHat").val(), _0x3497a1 = $("#snAcc").val(), _0x2179b0 = $("#srHat").val(), _0x29d3fd = $("#srAcc").val(), _0x38e1da = $("#ssHat").val(), _0x4d6911 = $("#ssAcc").val(), _0x40878c = $("#kChat").val(), _0x3bec8c = $("#rChat").val(), _0x4d63de = $("#ezChat").val(), _0x5f56a5 = $("#iHat1").val(), _0x4d5fd3 = $("#iAcc1").val(), _0x3e610b = $("#iHat2").val(), _0x5a4d77 = $("#iAcc2").val(), _0x214441 = $("#iHat3").val(), _0x4b87b7 = $("#iAcc3").val();
      }
      if (LEMONMOD_0x211e6c) {
        console.log("def toggleMenu");
      }
      function _0xaf9ea2() {
        LEMONMOD_0x36646a();
        _0x3069e3();
        window.hasSpawned = !![];
      }
      function _0x4cd7f4() {
        if (_0x4574d1.classList.contains("fade-outt")) {
          _0x4574d1.style.display = "block";
          _0x4574d1.classList.remove("fade-outt");
          _0x4574d1.classList.add("fade-inn");
        } else if (_0x4574d1.classList.contains("fade-inn")) {
          _0x4574d1.classList.remove("fade-inn");
          _0x4574d1.classList.add("fade-outt");
          setTimeout(() => {
            _0x4574d1.style.display = "none";
          }, 100);
        } else {
          _0x4574d1.style.display = "block";
          _0x4574d1.classList.add("fade-inn");
        }
        _0x3ebb3f();
      }
      if (LEMONMOD_0x211e6c) {
        console.log("block ads trololololol");
      }
      _0x5d3f6f.addEventListener("change", function () {
        _0x4f1b5c = !!this.checked;
      }), $("#tankGear").on("input", function () {
        var _0x24778e = $("#tankGear").val();
        _0x24778e && (_0x17b3a7 = (_0x17b3a7 = _0x24778e.toUpperCase()).charCodeAt(0));
      }), $("#bullHelm").on("input", function () {
        var _0x31a0c3 = $("#bullHelm").val();
        _0x31a0c3 && (_0x1bced6 = (_0x1bced6 = _0x31a0c3.toUpperCase()).charCodeAt(0));
      }), $("#soldier").on("input", function () {
        var _0x432222 = $("#soldier").val();
        _0x432222 && (_0x3350c2 = (_0x3350c2 = _0x432222.toUpperCase()).charCodeAt(0));
      }), $("#turret").on("input", function () {
        var _0x21d82a = $("#turret").val();
        _0x21d82a && (_0x5c0ab8 = (_0x5c0ab8 = _0x21d82a.toUpperCase()).charCodeAt(0));
      }), $("#booster").on("input", function () {
        var _0xfe12 = $("#booster").val();
        _0xfe12 && (_0x590c84 = (_0x590c84 = _0xfe12.toUpperCase()).charCodeAt(0));
      }), $("#spikeg").on("input", function () {
        var _0x458a7c = $("#spikeg").val();
        _0x458a7c && (_0x2d5921 = (_0x2d5921 = _0x458a7c.toUpperCase()).charCodeAt(0));
      });
      document.getElementById("enterGame").addEventListener("click", _0xaf9ea2);
      _0x2bbd68.classList.add("menuButton");
      _0x2bbd68.classList.add("open-menu-button");
      _0x2bbd68.textContent = "LemonMod Settings";
      window.addEventListener("keydown", _0x28b334);
      _0x2bbd68.addEventListener("click", _0x4cd7f4);
      consoleButton.addEventListener("click", _0x3b7a10);
      _0x105b3c.addEventListener("click", _0x4cd7f4);
      _0xdeaf3a.appendChild(_0x2bbd68);
      document.body.appendChild(_0x4cdd1b);
      document.body.appendChild(_0x4574d1);
      document.querySelectorAll(".i-tab-menu-item").forEach(function (_0x513ad5) {
        _0x513ad5.addEventListener("click", _0x411762);
      }), setInterval(function () {
        _0x4335ff && _0x14bd40(_0x1c130c);
      }, 600);
      _0x4cd7f4();
      _0x4cd7f4();
      document.getElementById("defaultChats").addEventListener("click", function () {
        $("#aChat").val("         LemonMod v3.0        ");
        $("#clanSpam").val("~DaRk~");
        $("#kChat").val("LemonMod v3.0 - +1 EZ");
        $("#rChat").val("LemonMOd v3.0 - RELOADED!");
        $("wLagChat").val("~ warn (x) ms ~");
      });
      var _0x43c8cd,
        _0x458628,
        _0x388861,
        _0x83059,
        _0x19e442,
        _0x154f35,
        _0x11797b,
        _0x4a944e,
        _0x1d1902 = 15,
        _0x11c2a1 = 31,
        _0xadbff8 = 6,
        _0x227707 = 7,
        _0x267420 = 22,
        _0x13703b = 12,
        _0x145883 = 40,
        _0x2f23dc = 53,
        _0x245f80 = void 0,
        _0x4576af = void 0,
        _0x336397 = void 0,
        _0x5e476a = void 0,
        _0x22ad41 = new URL(window.location.href);
      window.sessionStorage.force = _0x22ad41.searchParams.get("fc");
      var _0x1c1eac = 0;
      var _0x363859 = 0;
      var _0x398fe5 = 0;
      var _0x1328b4 = 3;
      var _0x1fccfc = 6;
      var _0x33a490 = 10;
      var _0x38f5f1 = 13;
      var _0x132077 = 15;
      var _0x10775b = 17;
      var _0x369283 = 36;
      let _0x6ec376 = 3;
      let _0x1ed88a = "LemonMod Bots";
      let _0x22f435 = "lemonmd";
      let _0x4f81b6 = 6;
      let _0x5bf2f6 = ["ch", "www.lemonmod.com"];
      let _0x9c9818 = !![];
      function _0xf2f6f(_0x22a352) {
        let _0x41c361 = _0x22a352.split("");
        _0x41c361 = _0x41c361.map(_0x528a2e => {
          return Math.random() > 0.7 ? Math.random() > 0.5 ? "_" : "-" : _0x528a2e;
        });
        return _0x41c361.join("");
      }
      ;
      const _0x1c2157 = "6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ";
      const _0x238cff = () => grecaptcha.execute(_0x1c2157, {
        "action": "homepage"
      });
      const _0xa2a9a0 = async _0x2b201a => new Promise(_0x55a8ba => setTimeout(_0x55a8ba, _0x2b201a));
      const _0x460f19 = _0x46c17a => {
        let _0x55fc1a = encodeURIComponent(_0x46c17a);
        let _0x1b2f64 = new WebSocket(_0x83059.url.split("&")[0] + "&token=" + _0x55fc1a);
        _0x1b2f64.binaryType = "arraybuffer";
        _0x1b2f64.emit = _0xb93c66 => {
          _0x1b2f64.send(LEMONMOD_0x5b0f86.encode(_0xb93c66));
        };
        _0x1b2f64.onopen = async () => {
          await _0xa2a9a0(100);
          _0x1b2f64.emit(["sp", [{
            "name": _0x1ed88a,
            "moofoll": "1",
            "skin": _0x4f81b6
          }]]);
          _0x1b2f64.healON = !![];
          function _0x3f3c47() {
            _0x1b2f64.emit(["5", [0, null]]);
            setTimeout(() => {}, 15);
            _0x1b2f64.emit(["c", [1]]);
            setTimeout(() => {
              _0x1b2f64.emit(["c", [0]]);
            }, 25);
            setTimeout(() => {
              _0x1b2f64.emit(["5", [0, 1]]);
            }, 35);
          }
          ;
          _0x1b2f64.lastHealth = 100;
          _0x1b2f64.didFixed = ![];
          _0x1b2f64.bullspam = 0;
          _0x1b2f64.holding = ![];
          _0x1b2f64.inAnti = ![];
          _0x1b2f64.holding2 = ![];
          const _0x464ee8 = setInterval(() => {
            if (_0x9c9818) {
              _0x1b2f64.oldHat = _0x1b2f64.hat;
              let _0x12c31a = [51, 50, 28, 29, 30, 36, 37, 38, 44, 35, 42, 43, 49];
              _0x1b2f64.myNewHat = _0x12c31a[_0x15a8ba(0, _0x12c31a.length)];
              while (_0x1b2f64.myNewHat == _0x1b2f64.oldHat) {
                _0x1b2f64.myNewHat = _0x12c31a[_0x15a8ba(0, _0x12c31a.length)];
              }
              _0x1b2f64.emit(["13c", [0, _0x1b2f64.myNewHat, 0]]);
            } else if (_0x1b2f64.hat != 0) {
              _0x1b2f64.emit(["13c", [0, 0, 0]]);
            }
            if (!document.getElementById("useBots").checked) {
              clearInterval(_0x464ee8);
            }
          }, 180);
          const _0x55101b = setInterval(() => {
            if (!document.getElementById("useBots").checked) {
              _0x1b2f64.close();
              clearInterval(_0x55101b);
            }
            if (LEMONMOD_0x388eda.clan != null) {
              _0x1b2f64.emit(["10", [LEMONMOD_0x388eda.clan]]);
            }
            if (LEMONMOD_0x1f0db3) {
              _0x3f3c47();
              _0x3f3c47();
              _0x3f3c47();
            }
            ;
            let _0x5e11b4;
            try {
              _0x5e11b4 = Math.atan2(_0x43c8cd[2] - _0x1b2f64.posy, _0x43c8cd[1] - _0x1b2f64.posx);
            } catch (_0x9cf86d) {
              _0x5e11b4 = null;
            }
            let _0x1f9ab9 = Math.atan2(LEMONMOD_0x388eda.y - _0x1b2f64.posy, LEMONMOD_0x388eda.x - _0x1b2f64.posx);
            let _0x2316a9 = Math.sqrt((LEMONMOD_0x388eda.x - _0x1b2f64.posx) ** 2 + (LEMONMOD_0x388eda.y - _0x1b2f64.posy) ** 2);
            if (_0x2316a9 > 240) {
              if (!window.botsAttack) {
                _0x1b2f64.emit([33, [_0x1f9ab9]]);
              } else {
                _0x1b2f64.emit([33, [_0x5e11b4]]);
              }
              _0x1b2f64.emit([2, [Number.MAX_VALUE]]);
              _0x1b2f64.emit(["c", [1]]);
              _0x1b2f64.healON = !![];
            } else {
              if (_0x1b2f64.clan != LEMONMOD_0x388eda.clan) {
                _0x1b2f64.healON = ![];
              }
              _0x1b2f64.emit(["2", [_0x52e391]]);
              if (!window.botsAttack) {
                if (_0x3d1f00 && _0x967ac[0]) {
                  _0x1b2f64.emit([33, [_0x1f9ab9]]);
                  _0x1b2f64.emit(["c", [1]]);
                } else {
                  _0x1b2f64.emit([33, [null]]);
                }
              } else {
                _0x1b2f64.emit([33, [_0x5e11b4]]);
                _0x1b2f64.emit(["c", [1]]);
              }
              if (!![]) {
                _0x1b2f64.emit(["6", [7]]);
                _0x1b2f64.emit(["6", [17]]);
                _0x1b2f64.emit(["6", [32]]);
                _0x1b2f64.emit(["6", [23]]);
                _0x1b2f64.emit(["6", [9]]);
                _0x1b2f64.emit(["6", [38]]);
                _0x1b2f64.emit(["6", [12]]);
                _0x1b2f64.emit(["6", [25]]);
              }
              if (LEMONMOD_0x5230b1) {
                _0x1b2f64.emit(["5", [0, !0]]);
                _0x1b2f64.emit(["c", [1]]);
              } else {
                _0x1b2f64.emit(["c", [0]]);
              }
            }
            ;
            if (!window.botsAttack) {
              if (_0x2316a9 > 340) {
                _0x1b2f64.emit([_0x5bf2f6[0], [_0x5bf2f6[1]]]);
              } else {}
            } else {
              _0x1b2f64.emit([_0x5bf2f6[0], ["LemonMod Bots - Attack!"]]);
            }
          }, 100);
        };
        _0x1b2f64.onmessage = _0x100d06 => {
          let _0x2bee85 = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x100d06.data));
          let _0x35cf3f;
          if (_0x2bee85.length > 1) {
            _0x35cf3f = [_0x2bee85[0], ..._0x2bee85[1]];
            if (_0x35cf3f[1] instanceof Array) {
              _0x35cf3f = _0x35cf3f;
            }
          } else {
            _0x35cf3f = _0x2bee85;
          }
          let _0x45a8d8 = _0x35cf3f[0];
          let _0x5bbc0c = _0x35cf3f;
          if (!_0x35cf3f) {
            return;
          }
          ;
          if (_0x45a8d8 == "h") {
            function _0x2fd3d1() {
              _0x1b2f64.emit(["5", [0, null]]);
              setTimeout(() => {}, 15);
              _0x1b2f64.emit(["c", [1]]);
              setTimeout(() => {
                _0x1b2f64.emit(["c", [0]]);
              }, 25);
              setTimeout(() => {
                _0x1b2f64.emit(["5", [0, 1]]);
              }, 35);
            }
            ;
            if (_0x1b2f64.healON && _0x5bbc0c[1] == _0x1b2f64.id) {
              _0x1b2f64.didFixed = ![];
              if (!![]) {
                if (_0x1b2f64.didFixed) return;
                _0x1b2f64.didFixed = !![];
                if (_0x5bbc0c[2] == 50) {
                  if (_0x1b2f64.lastHealth == 25) {
                    _0x2fd3d1();
                    _0x1b2f64.bullspam += 1;
                  }
                  ;
                }
                ;
                if (_0x5bbc0c[2] < 56 && _0x5bbc0c[2] > 0 && !_0x1b2f64.holding && _0x1b2f64.bullspam < 5) {
                  if (_0x5bbc0c[2] == 55) {} else {
                    if (![]) {
                      _0x2fd3d1();
                      _0x2fd3d1();
                      _0x2fd3d1();
                      _0x1b2f64.bullspam += 1;
                    } else {
                      _0x2fd3d1();
                      _0x1b2f64.delay2 = 0;
                      _0x1b2f64.holding = !![];
                      _0x1b2f64.inAnti = !![];
                      setTimeout(() => {
                        _0x1b2f64.inAnti = ![];
                      }, 350);
                      setTimeout(() => {
                        _0x1b2f64.inAnti = ![];
                      }, 400);
                      setTimeout(() => {
                        _0x1b2f64.inAnti = ![];
                      }, 450);
                      if (_0x398fe5 == 1111111) {
                        _0x1b2f64.holding = !![];
                        _0x2fd3d1();
                        setTimeout(() => {
                          _0x1b2f64.holding2 = !![];
                        }, 50);
                        setTimeout(() => {
                          _0x1b2f64.bullspam += 1;
                          _0x2fd3d1();
                          _0x1b2f64.holding = ![];
                          _0x1b2f64.holding2 = ![];
                        }, 200);
                      } else {
                        _0x1b2f64.holding = !![];
                        _0x2fd3d1();
                        _0x2fd3d1();
                        _0x2fd3d1();
                        setTimeout(() => {
                          _0x1b2f64.holding2 = !![];
                        }, 50);
                        setTimeout(() => {
                          _0x1b2f64.bullspam += 3;
                          _0x2fd3d1();
                          _0x1b2f64.holding = ![];
                          _0x1b2f64.holding2 = ![];
                        }, 200);
                      }
                    }
                  }
                }
                if (_0x5bbc0c[2] < 16 && _0x5bbc0c[2] > 0 && _0x1b2f64.holding2 == ![]) {
                  _0x2fd3d1();
                }
                if (_0x5bbc0c[2] < 94 && _0x5bbc0c[2] > 0 && _0x1b2f64.holding == ![]) {
                  setTimeout(() => {
                    if (_0x1b2f64.holding == ![] && _0x5bbc0c[2] < 94 && _0x5bbc0c[2] > 0) {
                      _0x2fd3d1();
                      _0x2fd3d1();
                      _0x2fd3d1();
                      _0x2fd3d1();
                      _0x1b2f64.bullspam = _0x1b2f64.bullspam - 2;
                    }
                  }, 140);
                }
                if (_0x5bbc0c[2] < 100 && _0x5bbc0c[2] >= 93 && _0x1b2f64.holding == ![]) {
                  setTimeout(() => {
                    if (_0x1b2f64.holding == ![] && _0x5bbc0c[2] < 100 && _0x5bbc0c[2] > 94) {
                      _0x2fd3d1();
                      _0x1b2f64.bullspam = _0x1b2f64.bullspam - 2;
                    }
                  }, 300);
                }
                _0x1b2f64.lastHealth = _0x5bbc0c[2];
              }
              ;
              setTimeout(function () {
                if (!_0x1b2f64.didFixed) _0x2fd3d1();
              }, (_0x5bbc0c[2] - 100) * (_0x5bbc0c[2] - 100) / -50 + 200);
            }
          }
          if (_0x45a8d8 == 11) {
            _0x1b2f64.emit(["sp", [{
              "name": _0x1ed88a,
              "moofoll": "1",
              "skin": _0x4f81b6
            }]]);
          }
          ;
          if (_0x45a8d8 === "1" && _0x83059.id == null) {
            _0x1b2f64.id = _0x5bbc0c[1];
          }
          ;
          if (_0x45a8d8 === "33") {
            _0x1b2f64.emit(["5", [0, 1]]);
            for (let _0x58aea7 = 0; _0x58aea7 < _0x5bbc0c[1].length / 13; _0x58aea7++) {
              let _0x41527d = _0x5bbc0c[1].slice(13 * _0x58aea7, 13 * _0x58aea7 + 13);
              if (_0x41527d[0] == _0x1b2f64.id) {
                _0x1b2f64.id = _0x41527d[0];
                _0x1b2f64.posx = _0x41527d[1];
                _0x1b2f64.posy = _0x41527d[2];
                _0x1b2f64.dir = _0x41527d[3];
                _0x1b2f64.object = _0x41527d[4];
                _0x1b2f64.weapon = _0x41527d[5];
                _0x1b2f64.clan = _0x41527d[7];
                _0x1b2f64.isLeader = _0x41527d[8];
                _0x1b2f64.hat = _0x41527d[9];
                _0x1b2f64.accessory = _0x41527d[10];
                _0x1b2f64.isSkull = _0x41527d[11];
              }
              ;
            }
            ;
          }
          ;
        };
      };
      function _0x2a0d88(_0x22e316) {
        _0x35285a(["5", [_0x22e316, !0]]);
      }
      function _0x3069e3() {
        if (document.getElementById("useBots").checked) {
          var _0x16360e = [];
          for (let _0x201371 = 0; _0x201371 < _0x6ec376; _0x201371++) _0x16360e.push(_0x238cff());
          Promise.all(_0x16360e).then(_0x44385e => {
            let _0x41c3fa = _0x44385e;
            for (let _0x401609 = 0; _0x401609 < _0x6ec376; _0x401609++) {
              setTimeout(() => {
                _0x460f19(_0x41c3fa[_0x401609]);
              }, 100 * _0x401609 * 3);
            }
            ;
          });
        }
      }
      ;
      function _0x2e824a() {
        this.buffer = new Uint8Array([0]), this.buffer.__proto__ = new Uint8Array(), this.type = 0;
      }
      function _0x51247d(_0x593617) {
        _0x593617.addEventListener("message", function (_0x3569ff) {
          _0x18eeae(_0x3569ff);
        });
        LEMONMOD_0x211e6c ? console.log("socketfound") : window.afinsefuia = !![];
      }
      let _0x10486b = ![];
      let _0x11f73d = "";
      LEMONMOD_0x211e6c ? console.log("msgpack") : window.afinsefuia = !![];
      document.msgpack = msgpack;
      this.staticSend = this.send;
      this.send = function (_0x17ff5c) {
        this.staticSend(_0x17ff5c);
      };
      LEMONMOD_0x211e6c ? console.log("staticsend") : window.afinsefuia = !![];
      WebSocket.prototype.oldSend = WebSocket.prototype.send;
      LEMONMOD_0x211e6c ? console.log("define send") : window.afinsefuia = !![];
      WebSocket.prototype.send = function (_0x4ff491) {
        var _0x451196 = ["cubic", "flex", "cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard", "semen", "discharge", "nut", "coochie", "cootie", "cooter", "butt", "ass", "jerk", "jew", "slave", "kys", "chink", "ahole", "anus", "ash0le", "ash0les", "asholes", "ass", "Ass Monkey", "Assface", "assh0le", "assh0lez", "asshole", "assholes", "assholz", "asswipe", "azzhole", "bassterds", "bastard", "bastards", "bastardz", "basterds", "basterdz", "Biatch", "bitch", "bitches", "Blow Job", "boffing", "butthole", "buttwipe", "c0ck", "c0cks", "c0k", "Carpet Muncher", "cawk", "cawks", "Clit", "cnts", "cntz", "cock", "cockhead", "cock-head", "cocks", "CockSucker", "cock-sucker", "crap", "cum", "cunt", "cunts", "cuntz", "dick", "dild0", "dild0s", "dildo", "dildos", "dilld0", "dilld0s", "dominatricks", "dominatrics", "dominatrix", "dyke", "enema", "f u c k", "f u c k e r", "fag", "fag1t", "faget", "fagg1t", "faggit", "faggot", "fagg0t", "fagit", "fags", "fagz", "faig", "faigs", "fart", "flipping the bird", "fuck", "fucker", "fuckin", "fucking", "fucks", "Fudge Packer", "fuk", "Fukah", "Fuken", "fuker", "Fukin", "Fukk", "Fukkah", "Fukken", "Fukker", "Fukkin", "g00k", "God-damned", "h00r", "h0ar", "h0re", "hells", "hoar", "hoor", "hoore", "jackoff", "jap", "japs", "jerk-off", "jisim", "jiss", "jizm", "jizz", "knob", "knobs", "knobz", "kunt", "kunts", "kuntz", "Lezzian", "Lipshits", "Lipshitz", "masochist", "masokist", "massterbait", "masstrbait", "masstrbate", "masterbaiter", "masterbate", "masterbates", "Motha Fucker", "Motha Fuker", "Motha Fukkah", "Motha Fukker", "Mother Fucker", "Mother Fukah", "Mother Fuker", "Mother Fukkah", "Mother Fukker", "mother-fucker", "Mutha Fucker", "Mutha Fukah", "Mutha Fuker", "Mutha Fukkah", "Mutha Fukker", "n1gr", "nastt", "nigger;", "nigur;", "niiger;", "niigr;", "orafis", "orgasim;", "orgasm", "orgasum", "oriface", "orifice", "orifiss", "packi", "packie", "packy", "paki", "pakie", "paky", "pecker", "peeenus", "peeenusss", "peenus", "peinus", "pen1s", "penas", "penis", "penis-breath", "penus", "penuus", "Phuc", "Phuck", "Phuk", "Phuker", "Phukker", "polac", "polack", "polak", "Poonani", "pr1c", "pr1ck", "pr1k", "pusse", "pussee", "pussy", "puuke", "puuker", "queer", "queers", "queerz", "qweers", "qweerz", "qweir", "recktum", "rectum", "retard", "sadist", "scank", "schlong", "screwing", "semen", "sex", "sexy", "Sh!t", "sh1t", "sh1ter", "sh1ts", "sh1tter", "sh1tz", "shit", "shits", "shitter", "Shitty", "Shity", "shitz", "Shyt", "Shyte", "Shytty", "Shyty", "skanck", "skank", "skankee", "skankey", "skanks", "Skanky", "slag", "slut", "sluts", "Slutty", "slutz", "son-of-a-bitch", "tit", "turd", "va1jina", "vag1na", "vagiina", "vagina", "vaj1na", "vajina", "vullva", "vulva", "w0p", "wh00r", "wh0re", "whore", "xrated", "xxx", "b!+ch", "bitch", "blowjob", "clit", "arschloch", "fuck", "shit", "ass", "asshole", "b!tch", "b17ch", "b1tch", "bastard", "bi+ch", "boiolas", "buceta", "c0ck", "cawk", "chink", "cipa", "clits", "cock", "cum", "cunt", "dildo", "dirsa", "ejakulate", "fatass", "fcuk", "fuk", "fux0r", "hoer", "hore", "jism", "kawk", "l3itch", "l3i+ch", "lesbian", "masturbate", "masterbat*", "masterbat3", "motherfucker", "s.o.b.", "mofo", "nazi", "nigga", "nigger", "nutsack", "phuck", "pimpis", "pusse", "pussy", "scrotum", "sh!t", "shemale", "shi+", "sh!+", "slut", "smut", "teets", "tits", "boobs", "b00bs", "teez", "testical", "testicle", "titt", "w00se", "jackoff", "wank", "whoar", "whore", "*damn", "*dyke", "*fuck*", "*shit*", "@$$", "amcik", "andskota", "arse*", "assrammer", "ayir", "bi7ch", "bitch*", "bollock*", "breasts", "butt-pirate", "cabron", "cazzo", "chraa", "chuj", "Cock*", "cunt*", "d4mn", "daygo", "dego", "dick*", "dike*", "dupa", "dziwka", "ejackulate", "Ekrem*", "Ekto", "enculer", "faen", "fag*", "fanculo", "fanny", "feces", "feg", "Felcher", "ficken", "fitt*", "Flikker", "foreskin", "Fotze", "Fu(*", "fuk*", "futkretzn", "gook", "guiena", "h0r", "h4x0r", "hell", "helvete", "hoer*", "honkey", "Huevon", "hui", "injun", "jizz", "kanker*", "kike", "klootzak", "kraut", "knulle", "kuk", "kuksuger", "Kurac", "kurwa", "kusi*", "kyrpa*", "lesbo", "mamhoon", "masturbat*", "merd*", "mibun", "monkleigh", "mouliewop", "muie", "mulkku", "muschi", "nazis", "nepesaurio", "nigger*", "orospu", "paska*", "perse", "picka", "pierdol*", "pillu*", "pimmel", "piss*", "pizda", "poontsee", "poop", "porn", "p0rn", "pr0n", "preteen", "pula", "pule", "puta", "puto", "qahbeh", "queef*", "rautenberg", "schaffer", "scheiss*", "schlampe", "schmuck", "screw", "sh!t*", "sharmuta", "sharmute", "shipal", "shiz", "skribz", "skurwysyn", "sphencter", "spic", "spierdalaj", "splooge", "suka", "b00b*", "testicle*", "titt*", "twat", "vittu", "wank*", "wetback*", "wichser", "wop*", "yed", "zabourah"];
        var _0x200659 = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x4ff491));
        if (_0x200659[0] == "ch") {
          let _0x59710e = _0x200659[1].toString();
          if (_0x59710e == "!crash" || _0x59710e == "?crash") {
            setTimeout(() => {
              if (window.isDev) {
                _0x3a425c("LemonMod v3.0 - Crashing...");
                setTimeout(() => {
                  LEMONMOD_0x2bddd0 = !![];
                }, 300);
              } else {
                _0x3a425c("Sorry, you can't do that!");
              }
            }, 600);
          }
          if (_0x59710e == "!crash all" || _0x59710e == "?crash all") {
            setTimeout(() => {
              if (window.isDev) {
                _0x3a425c("LemonMod v3.0 - Crashing...");
                setTimeout(() => {
                  _0x514bd9();
                }, 300);
              } else {
                _0x3a425c("Sorry, you can't do that!");
              }
            }, 600);
          }
          if ("!clan " == _0x59710e.substring(0, 6) || "?clan " == _0x59710e.substring(0, 6)) {
            setTimeout(() => {
              _0x35285a(["8", [_0x59710e.substring(6, 99)]]);
            }, 300);
          }
          if (_0x59710e == "!leave" || _0x59710e == "?leave") {
            _0x35285a(["9", [null]]);
          }
          if ("!join " == _0x59710e.substring(0, 6) || "?join " == _0x59710e.substring(0, 6)) {
            var _0x30e610 = _0x59710e.substring(6, 99);
            setTimeout(() => {
              _0x35285a(["10", [_0x30e610]]);
            }, 300);
          }
          if ("!kick " == _0x59710e.substring(0, 6) || "?kick " == _0x59710e.substring(0, 6)) {
            var _0x190ef8 = _0x59710e.substring(6, 99),
              _0xf2b5cd = 0;
            LEMONMOD_0x143673.forEach(function (_0x1c16e, _0x56802c) {
              _0x1c16e == _0x190ef8 && (setTimeout(function () {
                _0x35285a(["12", [_0x56802c]]);
              }, 1000 * _0xf2b5cd), _0xf2b5cd++);
            });
          }
          if (_0x59710e == "!accept" || _0x59710e == "?accept") {
            let _0x2157db = document.getElementById("noticationDisplay").childNodes;
            for (let _0x2073ad = 0; _0x2073ad < _0x2157db.length; _0x2073ad++) {
              if (_0x2157db[_0x2073ad].classList.contains("notifButton")) {
                let _0x172fd7 = _0x2157db[_0x2073ad].childNodes;
                if (_0x172fd7[0].style.color == "rgb(142, 204, 81)") {
                  $(_0x2157db[_0x2073ad]).click();
                }
              }
            }
          }
          if (_0x59710e == "!hat" || _0x59710e == "?hat") {
            _0x9c9818 = !_0x9c9818;
          }
          if (_0x59710e == "!reload" || _0x59710e == "?reload") {
            location.reload();
          }
          if (_0x59710e == "!attack" || _0x59710e == "?attack") {
            window.botsAttack = !![];
          }
          if (_0x59710e == "!credits" || _0x59710e == "?credits") {
            setTimeout(() => {
              _0x3a425c("LemonMod v3.0 - Credits");
            }, 500);
            setTimeout(() => {
              _0x3a425c("Made by LemonFlux (doja cat)");
            }, 2000);
            setTimeout(() => {
              _0x3a425c("GUI - FlareZ");
            }, 3500);
            setTimeout(() => {
              _0x3a425c("AutoPlacer - Spyder");
            }, 5000);
            setTimeout(() => {
              _0x3a425c("Everything else - LemonFlux");
            }, 6500);
            setTimeout(() => {
              _0x3a425c("LemonMod v1.0 - 8/10/2021");
            }, 6500);
          }
          if (_0x59710e == "!grind" || _0x59710e == "?grind") {
            LEMONMOD_0x11c907 = !LEMONMOD_0x11c907;
            if (LEMONMOD_0x11c907 == !![]) {
              setTimeout(() => {
                _0x3a425c("LemonMod v3.0 - Grinding...");
              }, 700);
            } else {
              setTimeout(() => {
                _0x3a425c("LemonMod v3.0 - Stopped.");
              }, 700);
            }
            _0x54206c();
          }
          if (_0x59710e == "!stop" || _0x59710e == "?stop") {
            window.botsAttack = ![];
          }
          if (_0x59710e == "!ioSync" || _0x59710e == "?ioSync") {
            setTimeout(() => {
              let _0x1ea1eb = _0xf98133(100, 999);
              _0x3a425c("Socket #: [0, ${randomSock}, 0]");
            }, 500);
          }
          if (_0x59710e.slice(0, 5) == "!conn" || _0x59710e.slice(0, 5) == "?conn" || _0x59710e.slice(0, 4) == "!con" || _0x59710e.slice(0, 4) == "?con") {
            let _0x55084e = _0x59710e.slice(6, 9);
            setTimeout(() => {
              _0x3a425c(">>>");
            }, 700);
            setTimeout(() => {
              _0x3a425c("<<<");
            }, 1400);
            setTimeout(() => {
              _0x3a425c(">>>");
            }, 2100);
            setTimeout(() => {
              _0x3a425c("<<<");
            }, 2800);
            setTimeout(() => {
              _0x3a425c("Connected! - [Socket ${myNewSocket}]");
            }, 3500);
          }
          if (_0x59710e.includes("prepCrash")) {
            setTimeout(() => {
              _0x3a425c("[GOOD] Socket: STATE_80");
            }, 500);
            setTimeout(() => {
              _0x3a425c("1 [BAD] U8IntSPM: 34% EFF");
            }, 1500);
            setTimeout(() => {
              _0x3a425c("2 [MED] ClanSPM: 60% EFF");
            }, 2500);
            setTimeout(() => {
              _0x3a425c("3 [GOOD] ArraySPM: 91% EFF");
            }, 3500);
            setTimeout(() => {
              _0x3a425c("4 [SS] WS-Rape: 98% EFF");
            }, 4500);
          }
          if (_0x59710e.includes("?sel") || _0x59710e.includes("!sel")) {
            setTimeout(() => {
              if (_0x59710e.slice(5, 999) == "1") {
                _0x3a425c("Selected: U8IntSPM");
              } else if (_0x59710e.slice(5, 999) == "2") {
                _0x3a425c("Selected: ClanSPM");
              } else if (_0x59710e.slice(5, 999) == "3") {
                _0x3a425c("Selected: ArrarySPM");
              } else if (_0x59710e.slice(5, 999) == "4") {
                _0x3a425c("Selected: WS-Rape");
              } else {
                _0x3a425c("Selected: " + _0x59710e.slice(5, 999));
              }
            }, 500);
          }
          if (_0x59710e == "!km" || _0x59710e == "?km") {
            setTimeout(() => {
              LEMONMOD_0x262fc1.create("Katana + Musket", "You have automatically equipped the Katana Musket setup.", "https://lemonmod.com/img/Katana.png", "fadeInRight", 2);
            }, 500);
            _0x1a71b1();
          }
          if (_0x59710e == "!pm" || _0x59710e == "?pm") {
            setTimeout(() => {
              LEMONMOD_0x262fc1.create("Polearm + Musket", "You have automatically equipped the Polearm Musket setup.", "https://lemonmod.com/img/Polearm.png", "fadeInRight", 2);
            }, 500);
            _0x35285a(["6", [5]]), _0x35285a(["6", [17]]), _0x35285a(["6", [31]]), _0x35285a(["6", [23]]), _0x35285a(["6", [9]]), _0x35285a(["6", [33]]), _0x35285a(["6", [28]]), _0x35285a(["6", [15]]);
          }
          if (_0x59710e == "!sh" || _0x59710e == "?sh") {
            setTimeout(() => {
              LEMONMOD_0x262fc1.create("Stick + Hammer", "You have automatically equipped the Stick Hammer setup.", "https://lemonmod.com/img/hammer.png", "fadeInRight", 2);
            }, 500);
            _0x35285a(["6", [8]]), _0x35285a(["6", [17]]), _0x35285a(["6", [31]]), _0x35285a(["6", [23]]), _0x35285a(["6", [10]]), _0x35285a(["6", [33]]), _0x35285a(["6", [28]]), _0x35285a(["6", [25]]);
          }
          var _0x58c159 = null;
          for (var _0x41fe23, _0x5dcbf5 = 0; _0x5dcbf5 < _0x451196.length; _0x5dcbf5++) {
            if (_0x200659[1][0].indexOf(_0x451196[_0x5dcbf5]) > -1) {
              _0x41fe23 = "";
              for (var _0x5049ff = 0; _0x5049ff < _0x451196[_0x5dcbf5].length; _0x5049ff++) {
                var _0xace9bf = _0x451196[_0x5dcbf5].substr(0, 1).toUpperCase();
                _0x41fe23 = _0xace9bf + _0x451196[_0x5dcbf5].substr(1, _0x451196[_0x5dcbf5].length);
              }
              var _0x2fcdae = new RegExp(_0x451196[_0x5dcbf5], "g");
              if (!_0x58c159) {
                _0x58c159 = _0x200659[1][0].replace(_0x2fcdae, _0x41fe23);
              } else {
                _0x58c159 = _0x58c159.replace(_0x2fcdae, _0x41fe23);
              }
            }
          }
          try {
            this.oldSend(new Uint8Array(Array.from(LEMONMOD_0x5b0f86.encode(["ch", [_0x58c159]]))));
          } catch (_0x41adc0) {}
        } else if (_0x200659[0] == "6") {
          LEMONMOD_0x5f27a0 = _0x200659[1].join("/").toString();
        }
        _0x83059 || (document.ws = this, _0x83059 = this, _0x51247d(this), this.addEventListener("close", function () {
          LEMONMOD_0x32b091 = !0;
        }));
        if (!LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          if (_0x200659[0] == "ch" && document.getElementById("silentMode").checked) {} else {
            try {
              this.oldSend(_0x4ff491);
            } catch (_0x590e8c) {}
          }
        } else if (document.activeElement.id.toLowerCase() == "chatbox") {
          if (_0x200659[0] == "ch" && document.getElementById("silentMode").checked) {} else {
            try {
              this.oldSend(_0x4ff491);
            } catch (_0x5963c2) {}
          }
        } else {}
      };
      if (LEMONMOD_0x211e6c) {
        console.log("autoAim init done");
      }
      var _0x3c89c4 = document.getElementById("gameCanvas"),
        _0x2a70f1 = document.createElement("CANVAS");
      _0x2a70f1.id = "canvas", document.body.append(_0x2a70f1), document.getElementById("canvas").style.zIndex = "-1", document.getElementById("canvas").style.pointerEvents = "none", document.getElementById("canvas").style.background = "transparent", _0x2a70f1.style.left = "0px", _0x2a70f1.style.top = "0px", _0x2a70f1.style.position = "absolute";
      var _0xeb0849 = _0x2a70f1.getContext("2d");
      _0x2a70f1.width = window.innerWidth, _0x2a70f1.height = window.innerHeight;
      var _0xf91d1b = 100,
        _0x125d46 = 100,
        _0x120792 = 70,
        _0x456511 = 80,
        _0x74dc4e = 65,
        _0x51c8b4 = 0.1,
        _0x81eb13 = document.createElement("a");
      var _0x4d93af = document.getElementById("pingDisplay");
      _0x4d93af.replaceWith(document.createElement("a")), _0x4d93af.style.fontSize = "20px", _0x4d93af.style.display = "block", _0x4d93af.style.zIndex = "1", document.body.appendChild(_0x4d93af);
      var _0x50a8cb = 30,
        _0x316774 = new MutationObserver(function () {
          _0x50a8cb = _0x4d93af.textContent.split(" ")[1].split(String.fromCharCode(160))[0], (_0x50a8cb = parseInt(_0x50a8cb)) > 100 && _0x4f1b5c && _0x3a425c($("#wLagChat").val().replace("(x)", _0x50a8cb.toString()));
        });
      function _0x5c25f0(_0x35b048, _0x4682ab, _0x2c93c6) {
        var _0x37b7bc = Math.atan((_0x35b048 - LEMONMOD_0x388eda.x) / (_0x4682ab - LEMONMOD_0x388eda.y));
        _0x4682ab < LEMONMOD_0x388eda.y && (_0x37b7bc > Math.PI ? _0x37b7bc -= Math.PI : _0x37b7bc += Math.PI);
        var _0xfe018c = _0x74dc4e * Math.sin(_0x37b7bc + _0x51c8b4) + _0xf91d1b,
          _0xf3aa96 = _0x74dc4e * Math.cos(_0x37b7bc + _0x51c8b4) + _0x125d46,
          _0x416b9d = _0x74dc4e * Math.sin(_0x37b7bc - _0x51c8b4) + _0xf91d1b,
          _0x5c3750 = _0x74dc4e * Math.cos(_0x37b7bc - _0x51c8b4) + _0x125d46,
          _0x285cf6 = _0x120792 * Math.sin(_0x37b7bc) + _0xf91d1b,
          _0x3279bc = _0x120792 * Math.cos(_0x37b7bc) + _0x125d46,
          _0x4122c3 = _0x456511 * Math.sin(_0x37b7bc) + _0xf91d1b,
          _0x4859b8 = _0x456511 * Math.cos(_0x37b7bc) + _0x125d46;
        _0xeb0849.strokeStyle = _0x2c93c6, _0xeb0849.beginPath(), _0xeb0849.moveTo(_0xfe018c, _0xf3aa96), _0xeb0849.lineTo(_0x285cf6, _0x3279bc), _0xeb0849.lineTo(_0x416b9d, _0x5c3750), _0xeb0849.lineTo(_0x4122c3, _0x4859b8), _0xeb0849.lineTo(_0xfe018c, _0xf3aa96), _0xeb0849.stroke();
      }
      function _0x312f7b(_0x1d3b01, _0x452406, _0x1f86dc, _0x4d8035, _0x22ac18) {
        _0xeb0849.beginPath(), _0xeb0849.arc(_0xf91d1b + (_0x1d3b01 - LEMONMOD_0x388eda.x) / 6.25, _0x125d46 + (_0x452406 - LEMONMOD_0x388eda.y) / 6.25, 3, 0, 2 * Math.PI), _0xeb0849.strokeStyle = _0x22ac18, _0xeb0849.moveTo(_0xf91d1b + (_0x1d3b01 - LEMONMOD_0x388eda.x) / 6.25, _0x125d46 + (_0x452406 - LEMONMOD_0x388eda.y) / 6.25), _0xeb0849.lineTo(_0xf91d1b + (2 * _0x1d3b01 - _0x1f86dc - LEMONMOD_0x388eda.x) / 6.25, _0x125d46 + (2 * _0x452406 - _0x4d8035 - LEMONMOD_0x388eda.y) / 6.25), _0xeb0849.stroke();
      }
      function _0x19ca1d() {
        _0xeb0849.clearRect(0, 0, _0x336397, _0x5e476a), _0x27e05b(), _0xeb0849.lineWidth = 4, _0xeb0849.beginPath(), _0xeb0849.arc(_0xf91d1b, _0x125d46, 80, 0, 2 * Math.PI), _0xeb0849.strokeStyle = "#FFE600", _0xeb0849.stroke(), _0xeb0849.lineWidth = 1, _0xeb0849.beginPath(), _0xeb0849.arc(_0xf91d1b, _0x125d46, 5, 0, 2 * Math.PI), _0xeb0849.strokeStyle = "#FFE600", _0xeb0849.stroke();
        for (var _0x484028 = new Date().getTime(); LEMONMOD_0x146858 && _0x484028 - LEMONMOD_0x146858[0] > 15000;) LEMONMOD_0x146858.shift(), LEMONMOD_0x532eed.shift(), LEMONMOD_0x1b428b.shift();
        for (var _0x5014e5 = 0; _0x5014e5 < LEMONMOD_0x146858.length; _0x5014e5++) _0xeb0849.beginPath(), _0xeb0849.strokeStyle = "#FF0022", _0xeb0849.arc(20 + LEMONMOD_0x532eed[_0x5014e5] / 14400 * 130, _0x5e476a - 150 + LEMONMOD_0x1b428b[_0x5014e5] / 14400 * 130, 1, 0, 2 * Math.PI), _0xeb0849.stroke();
      }
      function _0x26f42a(_0x21e03a, _0x3bfedf) {
        return Math.sqrt(Math.pow(LEMONMOD_0x388eda.x - _0x21e03a, 2) + Math.pow(LEMONMOD_0x388eda.y - _0x3bfedf, 2));
      }
      function _0x37d20c(_0x3e34a5) {
        var _0x403484 = 0;
        switch (_0x3e34a5[3]) {
          case 0:
            _0x403484 = 300;
            break;
          case 1:
          case 2:
            _0x403484 = 400;
            break;
          case 3:
          case 4:
            _0x403484 = 300;
            break;
          case 5:
            _0x403484 = 700;
            break;
          case 6:
            _0x403484 = 400;
            break;
          case 7:
            _0x403484 = 100;
            break;
          case 8:
            _0x403484 = 400;
            break;
          case 9:
            _0x403484 = 600;
            break;
          case 10:
            _0x403484 = 400;
            break;
          case 11:
            _0x403484 = 0;
            break;
          case 12:
            _0x403484 = 700;
            break;
          case 13:
            _0x403484 = 230;
            break;
          case 14:
            _0x403484 = 700;
            break;
          case 15:
            _0x403484 = 1500;
            break;
          default:
            _0x403484 = 0;
        }
        (_0x403484 -= _0x50a8cb + 10) > 0 && (LEMONMOD_0x27a807[_0x3e34a5[1]] = !0, setTimeout(function () {
          LEMONMOD_0x27a807[_0x3e34a5[1]] = !1;
        }, _0x403484));
      }
      function _0x27e05b() {}
      function _0x3acfcf(_0x3432ef, _0x3e12aa) {
        if (!_0x3e12aa) {
          switch (_0x3432ef) {
            case 0:
              return 25;
            case 1:
              return 30;
            case 2:
            case 3:
              return 35;
            case 4:
              return 40;
            case 5:
              return 45;
            case 6:
            case 7:
              return 20;
            case 8:
              return 0;
            case 9:
              return 25;
            case 10:
              return 10;
            case 11:
              return 0;
            case 12:
              return 35;
            case 13:
              return 30;
            case 14:
              return 0;
            case 15:
              return 50;
            default:
              return 0;
          }
        } else {
          if (_0x43c8cd && LEMONMOD_0x27a807[_0x43c8cd[0]]) return 0;
          switch (_0x3432ef) {
            case 0:
              return 25;
            case 1:
              return 30;
            case 2:
            case 3:
              return 35;
            case 4:
              return 40;
            case 5:
              return 45;
            case 6:
            case 7:
              return 20;
            case 8:
              return 0;
            case 9:
              return 25;
            case 10:
              return 10;
            case 11:
              return 0;
            case 12:
              return 35;
            case 13:
              return 30;
            case 14:
              return 0;
            case 15:
              return 50;
            default:
              return 0;
          }
        }
      }
      function _0x4e9bd7(_0x2d2294) {
        switch (_0x2d2294) {
          case 9:
            return 64;
          case 12:
            return 100;
          case 13:
            return 80;
          case 15:
            return 144;
        }
        return 100000;
      }
      function _0x9f77bd(_0x357c89, _0x1c3ba3) {
        var _0x1a9347 = Math.abs(_0x357c89 - _0x1c3ba3);
        return (_0x1a9347 %= 2 * Math.PI) > Math.PI && (_0x1a9347 = 2 * Math.PI - _0x1a9347), _0x1a9347;
      }
      let _0xc1e86 = 30;
      let _0x1de9e3 = new MutationObserver(function () {
        _0xc1e86 = parseInt(_0x4d93af.textContent.split(" ")[1].split(String.fromCharCode(160))[0]);
      });
      _0x1de9e3.observe(document.getElementById("pingDisplay"), {
        "attributes": ![],
        "childList": !![],
        "subtree": ![]
      });
      let _0x518e6b = 0;
      let _0x407dc5 = ![];
      let _0x30dc15 = ![];
      let _0x445d63 = 0;
      let _0xe38d03 = 0;
      let _0x4920fa = ![];
      if (LEMONMOD_0x211e6c) {
        console.log("handleMSg...");
      }
      let _0x34444b = 0;
      let _0x56b331 = () => {
        _0x34444b++, _0x34444b > 7 ? _0x34444b = 8 : ![];
      };
      let _0x25d04f = () => {
        _0x34444b = 0;
      };
      let _0x3c58e2 = 100,
        _0x271848 = Date.now();
      let _0x3ed669 = _0x3047d3 => {
        let _0x36518c = _0x3047d3[2];
        let _0x5215c5 = _0x3c58e2 - _0x36518c;
        if (_0x5215c5 > 0) _0x271848 = Date.now();else if ((_0x5215c5 < -15 || _0x36518c == 100) && _0x271848) {
          if (Date.now() - _0x271848 <= 125) {
            _0x56b331();
          } else {
            _0x1c9d3b();
          }
          ;
          _0x271848 = null;
        }
        ;
        _0x3c58e2 = _0x36518c;
      };
      let _0x158791 = "🟩";
      let _0x468357 = "🟩";
      function _0x3f0d46() {
        let _0x205f47 = document.getElementById("ageText").innerHTML;
        document.getElementById("ageText").innerHTML = "AGE " + _0x205f47.split(" ")[1] + " [" + _0x34444b + "] " + _0x158791 + " " + _0x468357;
      }
      ;
      let _0xe35931 = ![];
      let _0x36ab58 = ![],
        _0xea41ae = ![],
        _0x12a733 = ![],
        _0x40697d = ![],
        _0x3d24b5 = ![];
      document.addEventListener("keydown", _0x52dc81 => _0x52dc81.key.toLowerCase() == "q" && (_0xe35931 = !![]));
      document.addEventListener("keyup", _0x2db235 => _0x2db235.key.toLowerCase() == "q" && (_0xe35931 = ![]));
      document.addEventListener("keydown", _0x8c525d => _0x8c525d.key.toLowerCase() == "w" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0xea41ae = !![]));
      document.addEventListener("keyup", _0x424f59 => (_0x424f59.key.toLowerCase() == "w" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) == "w" && (_0xea41ae = ![]));
      document.addEventListener("keydown", _0x4d7217 => _0x4d7217.key.toLowerCase() == "a" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x12a733 = !![]));
      document.addEventListener("keyup", _0x533958 => _0x533958.key.toLowerCase() == "a" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x12a733 = ![]));
      document.addEventListener("keydown", _0xa57eb0 => _0xa57eb0.key.toLowerCase() == "s" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x40697d = !![]));
      document.addEventListener("keyup", _0x5f2e22 => _0x5f2e22.key.toLowerCase() == "s" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x40697d = ![]));
      document.addEventListener("keydown", _0x164b7e => _0x164b7e.key.toLowerCase() == "d" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x3d24b5 = !![]));
      document.addEventListener("keyup", _0x19d40a => _0x19d40a.key.toLowerCase() == "d" && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x3d24b5 = ![]));
      let _0x1c9d3b = () => {
        _0x34444b--, _0x34444b--, _0x34444b < 0 ? _0x34444b = 0 : ![];
      };
      let _0x3a2c83 = _0x58826f => [...Array(17)].map((_0x59cf3f, _0x39ecfd) => _0x39ecfd * 0.19625).forEach(_0x2c0615 => [_0x1fccfc, _0x33a490].forEach(_0x1e75da => _0x12b203(_0x1e75da, _0x2c0615)));
      let _0x3deebb = ![];
      let _0x4806e3 = 0;
      var _0x268a2e = ![];
      let _0x3d1f00 = ![];
      let _0x43ad73;
      let _0x967ac;
      setInterval(() => {
        if (LEMONMOD_0x2bddd0 && LEMONMOD_0x32b091 == !1) {
          LEMONMOD_0x447b0e++;
          if (LEMONMOD_0x447b0e < 50) {
            _0x83059.oldSend(LEMONMOD_0x12a6d5);
            _0x83059.oldSend(LEMONMOD_0x49508b);
          }
        }
      }, 200);
      setInterval(() => {
        if (document.getElementById("combatBot").checked) {
          _0x35285a(["33", [_0x458628]]);
        }
        if (document.getElementById("combatBot").checked) {
          _0x1a71b1();
          if (LEMONMOD_0x388eda.weapon != _0x363859) {
            _0x37ffb4();
          }
        }
        if (_0x1945c1) {
          _0xfc5fd(_0x4f5dad);
          _0x10e170(_0x5ab00e);
        }
        _0x3b83b0();
      }, 300);
      let _0x22083c;
      setInterval(() => {
        if (window.hasSpawned == !![] && window.hasSpawned != null && !LEMONMOD_0x32b091 && !LEMONMOD_0x2bddd0) {
          document.getElementById("mainMenu").style.display = "none";
        }
        if (document.getElementById("shield360").checked && LEMONMOD_0x388eda.weapon == 11) {
          _0x35285a(["2", [90 ** 100]]);
        }
        if (_0x477e12 && !LEMONMOD_0x185e28 && !_0x3d1f00 && !LEMONMOD_0x1f0db3 && (LEMONMOD_0x5230b1 || LEMONMOD_0x5c6332 || document.getElementById("autoFarm").checked)) {
          if (LEMONMOD_0x45ba48 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {} else {
            _0x35285a(["2", [69 ** 69]]);
          }
        }
        _0xe2480b = ![];
        if (LEMONMOD_0xaf14e2 == "daggers") {
          _0x283323 = 110;
        } else if (LEMONMOD_0xaf14e2 == "katana" || LEMONMOD_0xaf14e2 == "short_sword" || LEMONMOD_0xaf14e2 == "tool_hammer" || LEMONMOD_0xaf14e2 == "bat") {
          _0x283323 = 310;
        } else if (LEMONMOD_0xaf14e2 == "polearm") {
          _0x283323 = 800;
        } else if (LEMONMOD_0xaf14e2 == "hand_axe" || LEMONMOD_0xaf14e2 == "great_axe") {
          _0x283323 = 410;
        }
        if (LEMONMOD_0x5d1c22 == "none" || LEMONMOD_0x5d1c22 == "shield") {
          _0x346955 = 0;
        } else if (LEMONMOD_0x5d1c22 == "crossbow" || LEMONMOD_0x5d1c22 == "mc_grabby") {
          _0x346955 = 710;
        } else if (LEMONMOD_0x5d1c22 == "musket") {
          _0x346955 = 1400;
        } else if (LEMONMOD_0x5d1c22 == "repeater_crossbow") {
          _0x346955 = 240;
        } else if (LEMONMOD_0x5d1c22 == "great_hammer") {
          _0x346955 = 410;
        } else if (LEMONMOD_0x5d1c22 == "hunting_bow") {
          _0x346955 = 610;
        }
        LEMONMOD_0x413100 = document.getElementById("ageText").innerHTML.slice(4, 999);
        if (_0xea41ae || _0x12a733 || _0x40697d || _0x3d24b5) {
          _0x36ab58 = !![];
        } else {
          _0x36ab58 = ![];
        }
        if (LEMONMOD_0xc547f4 || document.getElementById("combatBot").checked) {
          $("#instaDisplay").css({
            "color": "#ff0000"
          });
          document.getElementById("instaDisplay").innerHTML = "ON";
          try {
            if (LEMONMOD_0x4aa989 && !LEMONMOD_0x185e28 && !LEMONMOD_0x13c18f && _0x56267c > _0x283323 / 10 && _0x2d2c56 > 18) {
              if ($("#instaType").val() == "oneframe") {
                if (LEMONMOD_0x509e10 != 6 && LEMONMOD_0x509e10 != 22) {
                  if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                    _0x35285a(["2", [_0x458628]]);
                    LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                  }
                  LEMONMOD_0x185e28 = !![];
                  setTimeout(() => {
                    _0x1268e6();
                  }, 4);
                }
              } else {
                if (document.getElementById("autoInstaBullCheck").checked) {
                  if (LEMONMOD_0x509e10 != 6) {
                    if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                      _0x35285a(["2", [_0x458628]]);
                      LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                    }
                    $("#instaDisplay").css({
                      "color": "#ffffff"
                    });
                    LEMONMOD_0x262fc1.create("Auto Insta", "Auto Instakill has been triggered. You have automatically targeted the nearest player.", "https://lemonmod.com/img/insta_ico.png", "fadeInRight", 2);
                    _0x582132();
                  } else {
                    if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                      _0x35285a(["2", [_0x458628]]);
                      LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                    }
                    $("#instaDisplay").css({
                      "color": "#ffffff"
                    });
                    LEMONMOD_0x262fc1.create("Auto Insta", "Auto Instakill has been triggered. You have automatically targeted the nearest player.", "https://lemonmod.com/img/insta_ico.png", "fadeInRight", 2);
                    _0x1268e6();
                  }
                } else {
                  if (document.getElementById("autoInsta").checked || _0x1cc8bf) {
                    _0x35285a(["2", [_0x458628]]);
                    LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                  }
                  $("#instaDisplay").css({
                    "color": "#ffffff"
                  });
                  LEMONMOD_0x262fc1.create("Auto Insta", "Auto Instakill has been triggered. You have automatically targeted the nearest player.", "https://lemonmod.com/img/insta_ico.png", "fadeInRight", 2);
                  _0x1268e6();
                }
              }
            }
          } catch (_0x87b0b0) {}
        } else {
          $("#instaDisplay").css({
            "color": "#ffffff"
          });
          document.getElementById("instaDisplay").innerHTML = "OFF";
        }
        document.getElementById("newScoreDisplay").innerHTML = document.getElementById("scoreDisplay").innerHTML;
        if (LEMONMOD_0x388eda.hat != 45) {
          _0x22083c = ![];
          $("#shameDisplay").css({
            "color": "#ffffff"
          });
          document.getElementById("shameDisplay").innerHTML = LEMONMOD_0x388eda.shameCount + "/7";
        } else {
          if (!_0x22083c) {
            document.getElementById("shameDisplay").innerHTML = "30s";
            $("#shameDisplay").css({
              "color": "#f24033"
            });
            for (let _0x21bb59 = 0; _0x21bb59 < 31; ++_0x21bb59) {
              setTimeout(() => {
                document.getElementById("shameDisplay").innerHTML = 30 - _0x21bb59 + "s";
              }, _0x21bb59 * 1000);
            }
            setTimeout(() => {
              _0x12b203(_0x398fe5, null);
              _0x12b203(_0x398fe5, null);
              _0x12b203(_0x398fe5, null);
              _0x12b203(_0x398fe5, null);
              setTimeout(() => {
                _0x12b203(_0x398fe5, null);
                _0x12b203(_0x398fe5, null);
                _0x12b203(_0x398fe5, null);
                _0x12b203(_0x398fe5, null);
              }, 90);
            }, 30100);
            _0x22083c = !![];
          }
          ;
        }
        try {
          if (_0x214b2b && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 400) {
            _0x35285a(["2", [_0x458628]]);
          }
        } catch (_0x34e243) {}
        if (document.getElementById("autoInsta").checked) {
          $("#instaDisplay").css({
            "display": "block"
          });
        } else {
          $("#instaDisplay").css({
            "display": "none"
          });
        }
        _0x1c1eac == 0 && (LEMONMOD_0xaf14e2 = "tool_hammer");
        _0x1c1eac == 1 && (LEMONMOD_0xaf14e2 = "hand_axe");
        _0x1c1eac == 2 && (LEMONMOD_0xaf14e2 = "great_axe");
        _0x1c1eac == 3 && (LEMONMOD_0xaf14e2 = "short_sword");
        _0x1c1eac == 4 && (LEMONMOD_0xaf14e2 = "katana");
        _0x1c1eac == 5 && (LEMONMOD_0xaf14e2 = "polearm");
        _0x1c1eac == 6 && (LEMONMOD_0xaf14e2 = "bat");
        _0x1c1eac == 7 && (LEMONMOD_0xaf14e2 = "daggers");
        _0x1c1eac == 8 && (LEMONMOD_0xaf14e2 = "stick");
        _0x363859 == 0 && (LEMONMOD_0x5d1c22 = "none");
        _0x363859 == 9 && (LEMONMOD_0x5d1c22 = "hunting_bow");
        _0x363859 == 10 && (LEMONMOD_0x5d1c22 = "great_hammer");
        _0x363859 == 11 && (LEMONMOD_0x5d1c22 = "shield");
        _0x363859 == 12 && (LEMONMOD_0x5d1c22 = "crossbow");
        _0x363859 == 13 && (LEMONMOD_0x5d1c22 = "repeater_crossbow");
        _0x363859 == 14 && (LEMONMOD_0x5d1c22 = "mc_grabby");
        _0x363859 == 15 && (LEMONMOD_0x5d1c22 = "musket");
        if (LEMONMOD_0x16b4d5) {
          _0x35285a(["2", [_0x458628]]);
          LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
        }
        if (LEMONMOD_0x141083 || _0x3d1f00) {
          _0x35285a(["2", [Math.atan2(_0x967ac[2] - LEMONMOD_0x388eda.y, _0x967ac[1] - LEMONMOD_0x388eda.x)]]);
        }
        if (LEMONMOD_0x4a352c) {
          document.getElementById("useBots").checked = ![];
          document.getElementById("heal1").checked = ![];
          document.getElementById("autoPlace").checked = ![];
          document.getElementById("silentMode").checked = !![];
          document.getElementById("heal2").checked = ![];
          document.getElementById("antiTrap").checked = ![];
          document.getElementById("autoInsta").checked = ![];
          document.getElementById("extraAnti").checked = ![];
          _0x35285a(["33", [null]]);
          _0x35285a(["2", [_0x2eea8d(0)]]);
        }
        try {
          LEMONMOD_0x1161bf = _0x43c8cd[5];
        } catch (_0x2dc2f8) {
          LEMONMOD_0x1161bf = "unknown";
        }
        try {
          LEMONMOD_0x509e10 = _0x43c8cd[9];
        } catch (_0x1c3791) {
          LEMONMOD_0x509e10 = "unknown";
        }
        try {
          LEMONMOD_0x53702f = _0x43c8cd[10];
        } catch (_0x2108bb) {
          LEMONMOD_0x53702f = "unknown";
        }
        if (LEMONMOD_0x44192a > 25) {
          if (!window.spamHealFlag - 1 < 0) {
            window.spamHealFlag = window.spamHealFlag - 1;
          } else {
            window.spamHealFlag = 0;
            LEMONMOD_0x1021a0 = ![];
          }
        }
        try {
          LEMONMOD_0x4aa989 = _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 180;
        } catch (_0x1c5a0a) {
          LEMONMOD_0x4aa989 = ![];
        }
        if (LEMONMOD_0x5bc078 >= _0x283323) {
          LEMONMOD_0x5bc078 = _0x283323;
          _0x6a5c13 = !![];
        }
        if (LEMONMOD_0xde5a9e >= _0x346955) {
          LEMONMOD_0xde5a9e = _0x346955;
          _0x513ad6 = !![];
        }
        if (document.getElementById("autoFarm").checked) {
          if ($("autoFarmType").val() == "food") {
            _0x35285a(["2", [LEMONMOD_0x342155]]);
          } else if ($("autoFarmType").val() == "wood") {
            _0x35285a(["2", [LEMONMOD_0x4e2a94]]);
          } else if ($("autoFarmType").val() == "stone") {
            _0x35285a(["2", [LEMONMOD_0x303b7b]]);
          } else if ($("autoFarmType").val() == "gold") {
            _0x35285a(["2", [LEMONMOD_0x591421]]);
          }
        }
        LEMONMOD_0xa0ea34 = _0x458628;
        if (LEMONMOD_0x225125) {
          _0x35285a(["33", [LEMONMOD_0xa0ea34]]);
        }
      }, 0);
      setInterval(() => {
        try {
          LEMONMOD_0xa3d254("target", _0x43c8cd[0]);
        } catch (_0x2f5a6a) {
          LEMONMOD_0xa3d254("target", "none");
        }
      }, 100);
      setInterval(() => {
        if (!LEMONMOD_0x211e6c) {
          console.clear();
          console.log("<==-==-==-==-==>\nLemonMod v3.0 - All Systems Operational!\n<==-==-==-==-==>");
          console.log("Ping: " + _0x50a8cb + "ms");
          console.log("Primary Weapon: " + LEMONMOD_0xaf14e2);
          console.log("Secondary Weapon: " + LEMONMOD_0x5d1c22);
          console.log("Shame: " + LEMONMOD_0x388eda.shameCount + "/7");
        }
      }, 500);
      let _0x31a57b;
      let _0x13df70;
      let _0x52e391;
      let _0x31a317;
      let _0x3e2a5f;
      let _0xccd72d;
      let _0x357910;
      function _0x4ac7a2(_0x5ed23d, _0x256af5, _0x9553ea) {
        _0x31a317 = Math.sqrt(_0x256af5 * _0x256af5 + _0x9553ea * _0x9553ea);
        _0x3e2a5f = _0x5ed23d * Math.pi / 180;
        _0xccd72d = _0x31a317 * Math.cos(_0x3e2a5f);
        _0x357910 = _0x31a317 * Math.sin(_0x3e2a5f);
        console.log("x: " + _0xccd72d);
        console.log("y: " + _0x357910);
      }
      document.addEventListener("mousemove", _0x35dcc9 => {
        if (LEMONMOD_0x16b4d5 || LEMONMOD_0x141083) {
          _0x35dcc9.stopPropagation();
          _0x35dcc9.preventDefault();
        }
      });
      _0x3c89c4.addEventListener("mousemove", _0x1530de => {
        if (LEMONMOD_0x16b4d5 || LEMONMOD_0x141083) {
          _0x1530de.stopPropagation();
          _0x1530de.preventDefault();
        }
        _0x245f80 = _0x1530de.clientX;
        _0x4576af = _0x1530de.clientY;
        _0x31a57b = _0x1530de.clientX;
        _0x13df70 = _0x1530de.clientY;
        _0x52e391 = Math.atan2(_0x13df70 - _0x5e476a / 2, _0x31a57b - _0x336397 / 2);
      });
      var _0x2d2c56 = 0;
      var _0xb56b1f = 0;
      var _0x56267c = 0;
      var _0x3c2b5f = 0;
      var _0x6a5c13 = !![];
      var _0x513ad6 = !![];
      setInterval(() => {
        _0x2d2c56 = _0x2d2c56 + 1;
        LEMONMOD_0x4cf864 = LEMONMOD_0x4cf864 + 1;
        _0xb56b1f = _0xb56b1f + 1;
        LEMONMOD_0x291250 = LEMONMOD_0x291250 + 1;
        LEMONMOD_0x44192a = LEMONMOD_0x44192a + 1;
        if (LEMONMOD_0x45ba48 == _0x1c1eac) {
          _0x56267c = _0x56267c + 1;
        } else if (LEMONMOD_0x45ba48 == _0x363859) {
          _0x3c2b5f = _0x3c2b5f + 1;
        }
      }, 10);
      var _0x3e365d = 240;
      var _0x283323 = 310;
      var _0x346955 = 0;
      var _0xe2480b = ![];
      var _0x18c951 = 0;
      var _0x364bb7, _0x789200;
      var _0x28c1c3;
      var _0x51721a = ![];
      function _0x3cc2e0(_0x4f6b9b) {}
      let _0x21cce8 = 90;
      let _0x446f07 = [1, 1.09, 1.18, 1.18];
      let _0x2d7c1f = [...Array(50)];
      let _0x335310 = [...Array(50)];
      function _0x20779d(_0x59b425) {
        let _0x3938f1 = [_0x59b425];
        _0x446f07.forEach(_0xe923dc => {
          _0x3938f1.push(_0xe923dc * _0x3938f1[0]);
        });
        _0x3938f1.forEach(_0x2181ae => {
          _0x3938f1.push(_0x2181ae * 1.5);
        });
        _0x3938f1.forEach(_0xb42438 => {
          _0x3938f1.push(_0xb42438 * 0.75);
        });
      }
      ;
      function _0x173e44() {
        if (LEMONMOD_0x3f2908.length >= 4) {
          return !![];
        } else {
          return ![];
        }
      }
      function _0x306d9a() {
        if (_0x388861.length != 0 && LEMONMOD_0x547c7a.length < 2 && LEMONMOD_0x509e10 == 45 && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 700) {
          _0xfc5fd(53);
          _0x10e170(11);
        } else {
          if (LEMONMOD_0xc547f4 && LEMONMOD_0x4aa989) {
            _0xfc5fd(11);
            if (LEMONMOD_0x235914) {
              window.wakandaforever = ![];
            } else {
              _0x10e170(21);
            }
          } else {
            _0xfc5fd(6);
            if (LEMONMOD_0x235914) {
              window.wakandaforever = ![];
            } else {
              _0x10e170(11);
            }
          }
        }
      }
      function _0x4bc0d3() {
        if (_0x388861.length != 0 && LEMONMOD_0x547c7a.length < 2 && LEMONMOD_0x509e10 == 45 && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 700) {
          _0xfc5fd(53);
          _0x10e170(11);
        } else {
          if (LEMONMOD_0x388eda.y < 2400) {
            if (LEMONMOD_0x3f2908.length >= 4) {
              _0xfc5fd(22);
            } else {
              _0xfc5fd(_0x38e1da);
            }
            if (LEMONMOD_0x235914) {
              window.wakandaforever = ![];
            } else {
              _0x10e170(_0x4d6911);
            }
          } else if (LEMONMOD_0x388eda.y > 6850 && LEMONMOD_0x388eda.y < 7550) {
            if (LEMONMOD_0x3f2908.length >= 4) {
              _0xfc5fd(22);
            } else {
              _0xfc5fd(_0x2179b0);
            }
            if (LEMONMOD_0x235914) {
              window.wakandaforever = ![];
            } else {
              _0x10e170(_0x29d3fd);
            }
          } else {
            if (LEMONMOD_0x3f2908.length >= 4) {
              _0xfc5fd(22);
            } else {
              _0xfc5fd(_0x1deffa);
            }
            if (LEMONMOD_0x235914) {
              window.wakandaforever = ![];
            } else {
              _0x10e170(_0x3497a1);
            }
          }
        }
      }
      function _0x387806() {}
      function _0x437bc8() {}
      function _0x25489d() {}
      function _0x3f8ccb() {
        let _0x3b0abe = _0x15a8ba(1, 3);
        if (_0x3b0abe == 1) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_hit1);
        } else if (_0x3b0abe == 2) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_hit2);
        } else if (_0x3b0abe == 3) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_hit3);
        }
      }
      var _0x385d9b = [];
      _0x385d9b[0] = 450, _0x385d9b[1] = 560, _0x385d9b[2] = 450, _0x385d9b[3] = 450, _0x385d9b[4] = 900, _0x385d9b[5] = 450, _0x385d9b[6] = 225, _0x385d9b[7] = 560, _0x385d9b[8] = 785, _0x385d9b[9] = 560, _0x385d9b[10] = undefined, _0x385d9b[11] = 900, _0x385d9b[12] = 450, _0x385d9b[13] = 900, _0x385d9b[14] = 1685;
      var _0x44a42e = ![];
      var _0x410fbe = ![];
      var _0x912eb3;
      var _0x492fd6;
      function _0x3cfb08(_0x451789, _0x366591, _0x3e68e0, _0x53ef4c) {
        for (let _0x2fcb56 = 0; _0x2fcb56 < _0x3e68e0[0].length; _0x2fcb56 += 13) {
          const _0x2bed4d = _0x3e68e0[0].slice(_0x2fcb56, _0x2fcb56 + 13);
          var _0x4544cd = {
              "sid": _0x2bed4d[0],
              "x": _0x2bed4d[1],
              "y": _0x2bed4d[2],
              "dir": _0x2bed4d[3],
              "obj": _0x2bed4d[4],
              "wep": _0x2bed4d[5],
              "variant": _0x2bed4d[6],
              "tribe": _0x2bed4d[7],
              "isLeader": _0x2bed4d[8],
              "hat": _0x2bed4d[9],
              "acc": _0x2bed4d[10],
              "isSkull": _0x2bed4d[11],
              "zIndex": _0x2bed4d[12],
              "dist": null,
              "isMe": _0x2bed4d[0] == LEMONMOD_0x334f71.sid
            },
            _0xbf3b82 = _0x4544cd.sid,
            _0xe175bd = LEMONMOD_0x237cc2[_0xbf3b82] || {};
          LEMONMOD_0x3f2908 = LEMONMOD_0xec8f90.filter(_0x2bf1ca => _0x2bf1ca[6] == 17 && _0x2bf1ca[7] != LEMONMOD_0x388eda.id && _0x329e16(_0x2bf1ca, LEMONMOD_0x388eda) < 750);
          LEMONMOD_0x16e844 = LEMONMOD_0xec8f90.filter(_0x5cf5b1 => (_0x5cf5b1[4] == 52 || _0x5cf5b1[4] == 49) && _0x5cf5b1[7] != LEMONMOD_0x388eda.id && _0x329e16(_0x5cf5b1, LEMONMOD_0x388eda) < 200);
          LEMONMOD_0x24126e = LEMONMOD_0xec8f90.filter(_0x13b033 => _0x13b033[4] == 50 && _0x329e16(_0x13b033, LEMONMOD_0x388eda) < 200);
          try {
            LEMONMOD_0x25239c = LEMONMOD_0xec8f90.filter(_0x2149e7 => _0x2149e7[4] == 50 && _0x2149e7[7] != _0x43c8cd[0] && _0x37b258(_0x2149e7, _0x43c8cd) < 60);
          } catch (_0x460e46) {}
          if (_0xe175bd.x !== _0x4544cd.x || _0xe175bd.y !== _0x4544cd.y) {}
          LEMONMOD_0x496430(_0xbf3b82);
          for (let _0x1ae774 in _0x4544cd) {
            try {
              LEMONMOD_0x237cc2[_0xbf3b82][_0x1ae774] = _0x4544cd[_0x1ae774];
            } catch (_0x65cb65) {}
          }
          if (LEMONMOD_0x15fe57) {
            if (LEMONMOD_0x237cc2[_0xbf3b82].y <= 2400) {
              LEMONMOD_0x237cc2[_0xbf3b82].notInSnow = LEMONMOD_0x237cc2[_0xbf3b82].inSnow;
              LEMONMOD_0x237cc2[_0xbf3b82].inSnow = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInSnow = ![];
            } else {
              LEMONMOD_0x237cc2[_0xbf3b82].notInSnow = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInSnow = LEMONMOD_0x237cc2[_0xbf3b82].inSnow;
              LEMONMOD_0x237cc2[_0xbf3b82].inSnow = ![];
            }
            if (_0x4544cd.isMe) {
              if (LEMONMOD_0x237cc2[_0xbf3b82].inSnow) {
                if (LEMONMOD_0x237cc2[_0xbf3b82].notInSnow || LEMONMOD_0x2adc6d.currentTime == 0 || LEMONMOD_0x2adc6d.ended) {
                  LEMONMOD_0x2adc6d.play();
                }
                if (LEMONMOD_0x2adc6d.volume < 0.7) LEMONMOD_0x2adc6d.volume = parseFloat(LEMONMOD_0x2adc6d.volume + 0.05).toFixed(2);
              } else if (LEMONMOD_0x2adc6d.currentTime !== 0 || LEMONMOD_0x2adc6d.ended == ![]) {
                if (!LEMONMOD_0x2adc6d.paused) {
                  LEMONMOD_0x2adc6d.volume = parseFloat(LEMONMOD_0x2adc6d.volume - 0.05).toFixed(2);
                  if (LEMONMOD_0x2adc6d.volume == 0) {
                    LEMONMOD_0x2adc6d.pause();
                  }
                }
              }
            }
            if (LEMONMOD_0x237cc2[_0xbf3b82].y > 2400 && LEMONMOD_0x237cc2[_0xbf3b82].y < 12000) {
              LEMONMOD_0x237cc2[_0xbf3b82].notInPlains = LEMONMOD_0x237cc2[_0xbf3b82].inPlains;
              LEMONMOD_0x237cc2[_0xbf3b82].inPlains = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInPlains = ![];
            } else {
              LEMONMOD_0x237cc2[_0xbf3b82].notInPlains = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInPlains = LEMONMOD_0x237cc2[_0xbf3b82].inPlains;
              LEMONMOD_0x237cc2[_0xbf3b82].inPlains = ![];
            }
            if (_0x4544cd.isMe) {
              if (LEMONMOD_0x237cc2[_0xbf3b82].inPlains) {
                if (LEMONMOD_0x237cc2[_0xbf3b82].notInPlains || LEMONMOD_0x337fbb.currentTime == 0 || LEMONMOD_0x337fbb.ended) {
                  LEMONMOD_0x337fbb.play();
                }
                if (LEMONMOD_0x337fbb.volume < 0.5) LEMONMOD_0x337fbb.volume = parseFloat(LEMONMOD_0x337fbb.volume + 0.05).toFixed(2);
              } else if (LEMONMOD_0x337fbb.currentTime !== 0 || LEMONMOD_0x337fbb.ended == ![]) {
                if (!LEMONMOD_0x337fbb.paused) {
                  LEMONMOD_0x337fbb.volume = parseFloat(LEMONMOD_0x337fbb.volume - 0.05).toFixed(2);
                  if (LEMONMOD_0x337fbb.volume == 0) {
                    LEMONMOD_0x337fbb.pause();
                  }
                }
              }
            }
            if (LEMONMOD_0x237cc2[_0xbf3b82].y >= 6400 && LEMONMOD_0x237cc2[_0xbf3b82].y <= 8000) {
              LEMONMOD_0x237cc2[_0xbf3b82].notInRiver = LEMONMOD_0x237cc2[_0xbf3b82].inRiver;
              LEMONMOD_0x237cc2[_0xbf3b82].inRiver = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInRiver = ![];
            } else {
              LEMONMOD_0x237cc2[_0xbf3b82].notInRiver = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInRiver = LEMONMOD_0x237cc2[_0xbf3b82].inRiver;
              LEMONMOD_0x237cc2[_0xbf3b82].inRiver = ![];
            }
            if (_0x4544cd.isMe) {
              if (LEMONMOD_0x237cc2[_0xbf3b82].inRiver) {
                if (LEMONMOD_0x237cc2[_0xbf3b82].notInRiver || LEMONMOD_0x1bbeae.currentTime == 0 || LEMONMOD_0x1bbeae.ended) {
                  LEMONMOD_0x1bbeae.play();
                }
                if (LEMONMOD_0x1bbeae.volume < 0.7) LEMONMOD_0x1bbeae.volume = parseFloat(LEMONMOD_0x1bbeae.volume + 0.05).toFixed(2);
              } else if (LEMONMOD_0x1bbeae.currentTime !== 0 || LEMONMOD_0x1bbeae.ended == ![]) {
                if (!LEMONMOD_0x1bbeae.paused) {
                  LEMONMOD_0x1bbeae.volume = parseFloat(LEMONMOD_0x1bbeae.volume - 0.05).toFixed(2);
                  if (LEMONMOD_0x1bbeae.volume == 0) {
                    LEMONMOD_0x1bbeae.pause();
                  }
                }
              }
            }
            if (LEMONMOD_0x237cc2[_0xbf3b82].y >= 12000) {
              LEMONMOD_0x237cc2[_0xbf3b82].notInDesert = LEMONMOD_0x237cc2[_0xbf3b82].inDesert;
              LEMONMOD_0x237cc2[_0xbf3b82].inDesert = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInDesert = ![];
            } else {
              LEMONMOD_0x237cc2[_0xbf3b82].notInDesert = !![];
              LEMONMOD_0x237cc2[_0xbf3b82].wasInDesert = LEMONMOD_0x237cc2[_0xbf3b82].inDesert;
              LEMONMOD_0x237cc2[_0xbf3b82].inDesert = ![];
            }
            if (_0x4544cd.isMe) {
              if (LEMONMOD_0x237cc2[_0xbf3b82].inDesert) {
                if (LEMONMOD_0x237cc2[_0xbf3b82].notInDesert || LEMONMOD_0x1bab5a.currentTime == 0 || LEMONMOD_0x1bab5a.ended) {
                  LEMONMOD_0x1bab5a.play();
                }
                if (LEMONMOD_0x1bab5a.volume < 0.5) LEMONMOD_0x1bab5a.volume = parseFloat(LEMONMOD_0x1bab5a.volume + 0.05).toFixed(2);
              } else if (LEMONMOD_0x1bab5a.currentTime !== 0 || LEMONMOD_0x1bab5a.ended == ![]) {
                if (!LEMONMOD_0x1bab5a.paused) {
                  LEMONMOD_0x1bab5a.volume = parseFloat(LEMONMOD_0x1bab5a.volume - 0.05).toFixed(2);
                  if (LEMONMOD_0x1bab5a.volume == 0) {
                    LEMONMOD_0x1bab5a.pause();
                  }
                }
              }
            }
          } else {
            LEMONMOD_0x1bab5a.volume = 0;
            LEMONMOD_0x2adc6d.volume = 0;
            LEMONMOD_0x337fbb.volume = 0;
            LEMONMOD_0x1bbeae.volume = 0;
            LEMONMOD_0x1bab5a.pause();
            LEMONMOD_0x2adc6d.pause();
            LEMONMOD_0x337fbb.pause();
            LEMONMOD_0x1bbeae.pause();
          }
        }
        if (LEMONMOD_0x3e75ee) {
          LEMONMOD_0x31bcad = LEMONMOD_0x3e75ee.sort((_0x4c4bdf, _0xae9590) => Math.hypot(_0x4c4bdf[2] - LEMONMOD_0x388eda.y, _0x4c4bdf[1] - LEMONMOD_0x388eda.x) - Math.hypot(_0xae9590[2] - LEMONMOD_0x388eda.y, _0xae9590[1] - LEMONMOD_0x388eda.x))[0];
          if (LEMONMOD_0x31bcad) {
            LEMONMOD_0x4e2a94 = Math.atan2(LEMONMOD_0x31bcad[2] - LEMONMOD_0x388eda.y, LEMONMOD_0x31bcad[1] - LEMONMOD_0x388eda.x);
          }
        }
        if (LEMONMOD_0x4b409f) {
          LEMONMOD_0x1ad623 = LEMONMOD_0x4b409f.sort((_0x102d4c, _0x428614) => Math.hypot(_0x102d4c[2] - LEMONMOD_0x388eda.y, _0x102d4c[1] - LEMONMOD_0x388eda.x) - Math.hypot(_0x428614[2] - LEMONMOD_0x388eda.y, _0x428614[1] - LEMONMOD_0x388eda.x))[0];
          if (LEMONMOD_0x1ad623) {
            LEMONMOD_0x342155 = Math.atan2(LEMONMOD_0x1ad623[2] - LEMONMOD_0x388eda.y, LEMONMOD_0x1ad623[1] - LEMONMOD_0x388eda.x);
          }
        }
        if (LEMONMOD_0x50ec7c) {
          LEMONMOD_0x3cc278 = LEMONMOD_0x50ec7c.sort((_0x480077, _0x5009dc) => Math.hypot(_0x480077[2] - LEMONMOD_0x388eda.y, _0x480077[1] - LEMONMOD_0x388eda.x) - Math.hypot(_0x5009dc[2] - LEMONMOD_0x388eda.y, _0x5009dc[1] - LEMONMOD_0x388eda.x))[0];
          if (LEMONMOD_0x3cc278) {
            LEMONMOD_0x303b7b = Math.atan2(LEMONMOD_0x3cc278[2] - LEMONMOD_0x388eda.y, LEMONMOD_0x3cc278[1] - LEMONMOD_0x388eda.x);
          }
        }
        if (LEMONMOD_0x1134eb) {
          LEMONMOD_0x1282e8 = LEMONMOD_0x1134eb.sort((_0xf94cde, _0x21880d) => Math.hypot(_0xf94cde[2] - LEMONMOD_0x388eda.y, _0xf94cde[1] - LEMONMOD_0x388eda.x) - Math.hypot(_0x21880d[2] - LEMONMOD_0x388eda.y, _0x21880d[1] - LEMONMOD_0x388eda.x))[0];
          if (LEMONMOD_0x1282e8) {
            LEMONMOD_0x591421 = Math.atan2(LEMONMOD_0x1282e8[2] - LEMONMOD_0x388eda.y, LEMONMOD_0x1282e8[1] - LEMONMOD_0x388eda.x);
          }
        }
        if (document.getElementById("autoFarm").checked) {
          if ($("#autoFarmType").val() == "food") {
            if (_0x329e16(LEMONMOD_0x1ad623, LEMONMOD_0x388eda) > 100) {
              _0x35285a(["33", [LEMONMOD_0x342155]]);
            } else {
              _0x35285a(["33", [null]]);
              _0x35285a(["2", [LEMONMOD_0x342155]]);
              _0x37ffb4();
            }
          } else if ($("#autoFarmType").val() == "wood") {
            if (_0x329e16(LEMONMOD_0x31bcad, LEMONMOD_0x388eda) > 130) {
              _0x35285a(["33", [LEMONMOD_0x4e2a94]]);
            } else {
              _0x35285a(["33", [null]]);
              _0x35285a(["2", [LEMONMOD_0x4e2a94]]);
              _0x37ffb4();
            }
          } else if ($("#autoFarmType").val() == "stone") {
            if (_0x329e16(LEMONMOD_0x3cc278, LEMONMOD_0x388eda) > 120) {
              _0x35285a(["33", [LEMONMOD_0x303b7b]]);
            } else {
              _0x35285a(["33", [null]]);
              _0x35285a(["2", [LEMONMOD_0x303b7b]]);
              _0x37ffb4();
            }
          } else if ($("#autoFarmType").val() == "gold") {
            if (_0x329e16(LEMONMOD_0x1282e8, LEMONMOD_0x388eda) > 130) {
              _0x35285a(["33", [LEMONMOD_0x591421]]);
            } else {
              _0x35285a(["33", [null]]);
              _0x35285a(["2", [LEMONMOD_0x591421]]);
              _0x37ffb4();
            }
          }
        }
        _0x388861 = [], LEMONMOD_0x1c1a54 = [], LEMONMOD_0x2880e0 = [], _0x19ca1d();
        for (var _0x385338 = 0; _0x385338 < _0x451789[1].length / 13; _0x385338++) {
          var _0xc2d2da = _0x451789[1].slice(13 * _0x385338, 13 * _0x385338 + 13);
          var _0x82b4e5 = _0x451789[1].slice(13 * _0x385338, 13 * _0x385338 + 13);
          _0xc2d2da[0] == LEMONMOD_0x388eda.id ? (LEMONMOD_0x388eda.x = _0xc2d2da[1], LEMONMOD_0x388eda.y = _0xc2d2da[2], LEMONMOD_0x388eda.dir = _0xc2d2da[3], LEMONMOD_0x388eda.object = _0xc2d2da[4], LEMONMOD_0x388eda.weapon = _0xc2d2da[5], LEMONMOD_0x388eda.clan = _0xc2d2da[7], LEMONMOD_0x388eda.isLeader = _0xc2d2da[8], LEMONMOD_0x388eda.hat = _0xc2d2da[9], LEMONMOD_0x388eda.accessory = _0xc2d2da[10], LEMONMOD_0x388eda.isSkull = _0xc2d2da[11], LEMONMOD_0x1c1a54[LEMONMOD_0x388eda.id] = LEMONMOD_0x388eda.x, LEMONMOD_0x2880e0[LEMONMOD_0x388eda.id] = LEMONMOD_0x388eda.y, LEMONMOD_0x388eda.xvel = LEMONMOD_0x388eda.x - _0xc2d2da[1], LEMONMOD_0x388eda.yvel = LEMONMOD_0x388eda.y - _0xc2d2da[2], 0 != LEMONMOD_0x388eda.xvel && 0 != LEMONMOD_0x388eda.yvel && (LEMONMOD_0x388eda.prevXVel = LEMONMOD_0x388eda.xvel, LEMONMOD_0x388eda.prevYVel = LEMONMOD_0x388eda.yvel), _0xeb0849.beginPath(), _0xeb0849.strokeStyle = "#FFE600", _0xeb0849.moveTo(_0xf91d1b, _0x125d46), _0xeb0849.lineTo(_0xf91d1b + (LEMONMOD_0x388eda.x - LEMONMOD_0xa3d56b[LEMONMOD_0x388eda.id]) / 6.25, _0x125d46 + (LEMONMOD_0x388eda.y - LEMONMOD_0x35833b[LEMONMOD_0x388eda.id]) / 6.25), _0xeb0849.stroke()) : _0xc2d2da[7] != LEMONMOD_0x388eda.clan || null === _0xc2d2da[7] ? (_0x388861.push(_0xc2d2da), _0x26f42a(_0xc2d2da[1], _0xc2d2da[2]) > 500 ? _0x5c25f0(_0xc2d2da[1], _0xc2d2da[2], "#FF0000") : _0x312f7b(_0xc2d2da[1], _0xc2d2da[2], LEMONMOD_0xa3d56b[_0xc2d2da[0]], LEMONMOD_0x35833b[_0xc2d2da[0]], "#FF0000"), LEMONMOD_0x1c1a54[_0xc2d2da[0]] = _0xc2d2da[1], LEMONMOD_0x2880e0[_0xc2d2da[0]] = _0xc2d2da[2], _0x24bc6f && null != LEMONMOD_0xa3d56b[_0xc2d2da[0]] && null != LEMONMOD_0x35833b[_0xc2d2da[0]] && _0x26f42a(_0xc2d2da[1], _0xc2d2da[2]) - _0x26f42a(LEMONMOD_0xa3d56b[_0xc2d2da[0]], LEMONMOD_0x35833b[_0xc2d2da[0]]) < LEMONMOD_0x137553 && (_0x12b203(_0x1fccfc, Math.atan2(_0xc2d2da[2] - LEMONMOD_0x388eda.y, _0xc2d2da[1] - LEMONMOD_0x388eda.x) + _0x2eea8d(90)), _0x3a425c("LemonMod v3.0 - AntiBoostSpike"), _0x12b203(_0x1fccfc, Math.atan2(_0xc2d2da[2] - LEMONMOD_0x388eda.y, _0xc2d2da[1] - LEMONMOD_0x388eda.x) - _0x2eea8d(90))), _0xc2d2da[5] > 8 ? LEMONMOD_0x5d5688[_0xc2d2da[0]] = _0xc2d2da[5] : (3 == LEMONMOD_0x247123[_0xc2d2da[0]] || 4 != _0xc2d2da[5] || LEMONMOD_0x5d5688[_0xc2d2da[0]] || (LEMONMOD_0x5d5688[_0xc2d2da[0]] = 15), LEMONMOD_0x5d5688[_0xc2d2da[0]] || 4 != _0xc2d2da[5] && 5 != _0xc2d2da[5] || (LEMONMOD_0x5d5688[_0xc2d2da[0]] = 15), 0 == _0xc2d2da[5] && (LEMONMOD_0x5d5688[_0xc2d2da[0]] = void 0), LEMONMOD_0x247123[_0xc2d2da[0]] = _0xc2d2da[5])) : _0x26f42a(_0xc2d2da[1], _0xc2d2da[2]) > 500 ? _0x5c25f0(LEMONMOD_0x388eda.x, LEMONMOD_0x388eda.y, _0xc2d2da[1], _0xc2d2da[2], "#00EE00") : _0x312f7b(_0xc2d2da[1], _0xc2d2da[2], LEMONMOD_0xa3d56b[_0xc2d2da[0]], LEMONMOD_0x35833b[_0xc2d2da[0]], "#00EE00");
        }
        if (LEMONMOD_0x388eda.hat == 45) {
          if (LEMONMOD_0x2ae7e5 !== 0) LEMONMOD_0x2ae7e5 = 0;
          LEMONMOD_0x44d838 == 0 && (LEMONMOD_0x44d838 = Date.now());
        } else {
          if (LEMONMOD_0x44d838 !== 0) LEMONMOD_0x44d838 = 0;
        }
        try {
          if (!LEMONMOD_0x341835[_0x82b4e5[0]]) LEMONMOD_0x341835[_0x82b4e5[0]] = {
            "id": _0x82b4e5[0],
            "Ge": 0,
            "hat": _0x82b4e5[9],
            "shameCount": 0
          };
          LEMONMOD_0x341835[_0x82b4e5[0]].hat = _0x82b4e5[9];
          if (LEMONMOD_0x341835[_0x82b4e5[0]].hat == 45) {
            if (LEMONMOD_0x341835[_0x82b4e5[0]].shameCount !== 0) LEMONMOD_0x341835[_0x82b4e5[0]].shameCount = 0;
            LEMONMOD_0x341835[_0x82b4e5[0]].Ge == 0 && (LEMONMOD_0x341835[_0x82b4e5[0]].Ge = Date.now());
          } else {
            if (LEMONMOD_0x341835[_0x82b4e5[0]].Ge !== 0) LEMONMOD_0x341835[_0x82b4e5[0]].Ge = 0;
          }
        } catch (_0x13b6b5) {}
        if (_0x81eb13.innerHTML = "{" + LEMONMOD_0x388eda.x + "," + LEMONMOD_0x388eda.y + "}", LEMONMOD_0xa3d56b = LEMONMOD_0x1c1a54, LEMONMOD_0x35833b = LEMONMOD_0x2880e0, _0x214b2b) for (var _0x1b7231 in _0x388861) _0x388861[_0x1b7231][1] += (_0x388861[_0x1b7231][1] - LEMONMOD_0xa3d56b[_0x388861[_0x1b7231][0]]) * _0x329e16(_0x388861[_0x1b7231], LEMONMOD_0x388eda) / _0x4e9bd7(LEMONMOD_0x45ba48), _0x388861[_0x1b7231][2] += (_0x388861[_0x1b7231][2] - LEMONMOD_0x35833b[_0x388861[_0x1b7231][0]]) * _0x329e16(_0x388861[_0x1b7231], LEMONMOD_0x388eda) / _0x4e9bd7(LEMONMOD_0x45ba48);
        if (_0x388861 && (_0x43c8cd = _0x388861.sort(function (_0x593e11, _0x1a58b0) {
          return _0x329e16(_0x593e11, LEMONMOD_0x388eda) - _0x329e16(_0x1a58b0, LEMONMOD_0x388eda);
        })[0]), _0x458628 = _0x43c8cd ? Math.atan2(_0x43c8cd[2] - LEMONMOD_0x388eda.y, _0x43c8cd[1] - LEMONMOD_0x388eda.x) : LEMONMOD_0x388eda.dir, "insta" == LEMONMOD_0x6476b7 && !LEMONMOD_0x185e28 && _0x43c8cd && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 220 && !LEMONMOD_0x27a807[LEMONMOD_0x388eda.id] && LEMONMOD_0x45ba48 != _0x363859 && (LEMONMOD_0x185e28 = !0, _0x1cc8bf && (LEMONMOD_0x25126c = !0), _0x141996 && _0x3a425c(iChat), _0x35285a(["13c", [0, 0, 1]]), _0x35285a(["7", [!0]]), _0x22add3 ? (LEMONMOD_0x45ba48 = _0x363859, _0x35285a(["5", [_0x363859, !0]]), _0x35285a(["13c", [0, _0x3e610b, 0]]), _0x35285a(["13c", [0, _0x5a4d77, 1]]), setTimeout(function () {
          _0x477e12 = 0, _0x35285a(["13c", [0, _0x5f56a5, 0]]), _0x35285a(["13c", [0, _0x4d5fd3, 1]]), LEMONMOD_0x45ba48 = _0x1c1eac, _0x35285a(["5", [_0x1c1eac, !0]]);
        }, LEMONMOD_0xfe2ba6 / 2)) : (LEMONMOD_0x45ba48 = _0x1c1eac, _0x35285a(["5", [_0x1c1eac, !0]]), _0x5a0594 || (_0x1cc8bf ? (_0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(45)), _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(45))) : (_0x12b203(_0x1fccfc, Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2) + _0x2eea8d(45)), _0x12b203(_0x1fccfc, Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2) - _0x2eea8d(45)))), _0x35285a(["13c", [0, _0x5f56a5, 0]]), _0x35285a(["13c", [0, _0x4d5fd3, 1]]), setTimeout(function () {
          _0x35285a(["13c", [0, _0x3e610b, 0]]);
          _0x35285a(["13c", [0, _0x5a4d77, 1]]);
          _0x5a0594 && (LEMONMOD_0x45ba48 = _0x363859, _0x35285a(["5", [_0x363859, !0]]));
        }, LEMONMOD_0x187b40 / 2)), setTimeout(function () {
          LEMONMOD_0x25126c = !1;
          _0x35285a(["13c", [0, _0x13642c, 0]]);
          _0x35285a(["13c", [0, _0x504950, 1]]);
          _0x35285a(["7", [!0]]);
          LEMONMOD_0x45ba48 = _0x363859;
          _0x35285a(["5", [_0x363859, !0]]);
          var _0x5b7662 = 0;
          15 == _0x363859 ? _0x5b7662 = 1650 : 13 == _0x363859 ? _0x5b7662 = 400 : 12 == _0x363859 ? _0x5b7662 = 850 : 9 == _0x363859 && (_0x5b7662 = 750), setTimeout(function () {
            LEMONMOD_0x45ba48 = _0x1c1eac, _0x35285a(["5", [_0x1c1eac, !0]]), setTimeout(function () {
              LEMONMOD_0x185e28 = !1;
            }, 1000);
          }, _0x5b7662);
        }, LEMONMOD_0x187b40)), "counter" != LEMONMOD_0x6476b7 || LEMONMOD_0x185e28) {
          if (LEMONMOD_0x185e28 == 0 && _0x10f133 && "hat" != LEMONMOD_0x6476b7 && !LEMONMOD_0x1f0db3 && !LEMONMOD_0x46703c && !LEMONMOD_0x59d05f && !LEMONMOD_0x56bf64 && !_0x51721a && _0x3d1f00 == ![] && !LEMONMOD_0x5230b1 && !_0x1945c1 && !LEMONMOD_0xd7a174) if (_0x43c8cd && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 220) {
            var _0x5a1da6 = !1;
            for (var _0x262ca0 = 0; _0x262ca0 < _0x451789[1].length / 13; _0x262ca0++) {
              var _0x32b27f = _0x451789[1].slice(13 * _0x262ca0, 13 * _0x262ca0 + 13);
              if (_0x32b27f[0] != LEMONMOD_0x388eda.id && Math.sqrt(Math.pow(LEMONMOD_0x388eda.y - _0x32b27f[2], 2) + Math.pow(LEMONMOD_0x388eda.x - _0x32b27f[1], 2)) < 300 && !LEMONMOD_0x27a807[_0x32b27f[0]]) {
                _0x5a1da6 = !0;
                break;
              }
            }
            if (_0x5a1da6 && _0x52c65c) {
              _0xfc5fd(6);
              if (LEMONMOD_0x235914) {
                window.wakandaforever = ![];
              } else {
                _0x10e170(11);
              }
            }
          } else if (_0x147e03) {
            _0x4bc0d3();
          }
        } else if (_0x43c8cd && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 230) {
          _0x306d9a();
        } else {
          _0x4bc0d3();
        }
        LEMONMOD_0x547c7a = _0x388861.filter(_0x4f0662 => _0x329e16(_0x4f0662, LEMONMOD_0x388eda) < 240);
        if (LEMONMOD_0x231a94 == ![]) {
          LEMONMOD_0x231a94 = LEMONMOD_0x388eda.x;
        }
        if (LEMONMOD_0x195eb9 == ![]) {
          LEMONMOD_0x195eb9 = LEMONMOD_0x388eda.y;
        }
        if (LEMONMOD_0x475386 != LEMONMOD_0x388eda.y || LEMONMOD_0x555e36 != LEMONMOD_0x388eda.x) {
          if (_0xe2efd2) {
            if (Math.sqrt(Math.pow(LEMONMOD_0x388eda.y - LEMONMOD_0x195eb9, 2) + Math.pow(LEMONMOD_0x388eda.x - LEMONMOD_0x231a94, 2)) > 100) {
              _0x12b203(_0x33a490, Math.atan2(LEMONMOD_0x475386 - LEMONMOD_0x388eda.y, LEMONMOD_0x555e36 - LEMONMOD_0x388eda.x) + _0x2eea8d(78));
              _0x12b203(_0x33a490, Math.atan2(LEMONMOD_0x475386 - LEMONMOD_0x388eda.y, LEMONMOD_0x555e36 - LEMONMOD_0x388eda.x) - _0x2eea8d(78));
              _0x12b203(_0x33a490, Math.atan2(LEMONMOD_0x475386 - LEMONMOD_0x388eda.y, LEMONMOD_0x555e36 - LEMONMOD_0x388eda.x) - _0x2eea8d(0));
              _0x35285a(["2", [Math.atan2(_0x13df70 - _0x5e476a / 2, _0x31a57b - _0x336397 / 2)]]);
              LEMONMOD_0x231a94 = LEMONMOD_0x388eda.x;
              LEMONMOD_0x195eb9 = LEMONMOD_0x388eda.y;
            }
          }
          LEMONMOD_0x555e36 = LEMONMOD_0x388eda.x;
          LEMONMOD_0x475386 = LEMONMOD_0x388eda.y;
        }
      }
      function _0x19b33f() {}
      function _0x13b55b(_0x1671d6, _0xe10520, _0x1eb888, _0x523af9) {
        if (LEMONMOD_0x420350 == "1") {
          if (LEMONMOD_0xc547f4) {
            LEMONMOD_0xc547f4 = ![];
          }
          LEMONMOD_0x185e28 = !![];
          LEMONMOD_0x32810f = !![];
          LEMONMOD_0x16b4d5 = !![];
          LEMONMOD_0x45ba48 = _0x1c1eac;
          _0x35285a(["5", [_0x1c1eac]]);
          _0xfc5fd(7);
          _0x10e170(21, !![]);
          _0x56267c = 0;
          _0x35285a(["7", [1]]);
          LEMONMOD_0x420350 = "2";
        } else if (LEMONMOD_0x420350 == "2") {
          if (LEMONMOD_0xc547f4) {
            LEMONMOD_0xc547f4 = ![];
          }
          let _0x36592e = 0;
          if (_0xc1e86 >= 49) {
            _0x36592e = 90;
          }
          LEMONMOD_0x45ba48 = _0x363859;
          _0x35285a(["5", [_0x363859]]);
          if (_0x36592e != 90) {
            _0x35285a(["c", [1, LEMONMOD_0xa0ea34]]);
            _0xfc5fd(53);
            _0x10e170(21);
            setTimeout(() => {
              if (document.getElementById("spikeInsta").checked) {
                _0x12b203(_0x1fccfc, _0x458628);
              }
            }, 200);
            LEMONMOD_0x420350 = "0";
            setTimeout(() => {
              _0x35285a(["7", [1]]);
              _0x35285a(["c", [0, null]]);
              LEMONMOD_0x185e28 = ![];
              LEMONMOD_0x32810f = ![];
              LEMONMOD_0x16b4d5 = ![];
              setTimeout(() => {
                _0x33ac43();
              }, 10);
            }, 100);
          } else {
            setTimeout(() => {
              _0x35285a(["c", [1, LEMONMOD_0xa0ea34]]);
              _0xfc5fd(53);
              _0x10e170(21);
              setTimeout(() => {
                if (document.getElementById("spikeInsta").checked) {
                  _0x12b203(_0x1fccfc, _0x458628);
                }
              }, 200);
              LEMONMOD_0x420350 = "0";
              setTimeout(() => {
                _0x35285a(["7", [1]]);
                _0x35285a(["c", [0, null]]);
                LEMONMOD_0x185e28 = ![];
                LEMONMOD_0x32810f = ![];
                LEMONMOD_0x16b4d5 = ![];
                setTimeout(() => {
                  _0x33ac43();
                }, 10);
              }, 200);
            }, _0xc1e86 / 3 + 5);
          }
        } else if (LEMONMOD_0x420350 == "1nb") {
          if (LEMONMOD_0xc547f4) {
            LEMONMOD_0xc547f4 = ![];
          }
          LEMONMOD_0x185e28 = !![];
          LEMONMOD_0x32810f = !![];
          LEMONMOD_0x16b4d5 = !![];
          LEMONMOD_0x45ba48 = _0x1c1eac;
          _0x35285a(["5", [_0x1c1eac]]);
          _0xfc5fd(6);
          _0x10e170(21, !![]);
          _0x56267c = 0;
          _0x35285a(["7", [1]]);
          LEMONMOD_0x420350 = "2nb";
        } else if (LEMONMOD_0x420350 == "2nb") {
          if (LEMONMOD_0xc547f4) {
            LEMONMOD_0xc547f4 = ![];
          }
          let _0x503d77 = 0;
          if (_0xc1e86 >= 49) {
            _0x503d77 = 90;
          }
          LEMONMOD_0x45ba48 = _0x363859;
          _0x35285a(["5", [_0x363859]]);
          if (_0x503d77 != 90) {
            _0x35285a(["c", [1, LEMONMOD_0xa0ea34]]);
            _0xfc5fd(53);
            _0x10e170(21);
            setTimeout(() => {
              if (document.getElementById("spikeInsta").checked) {
                _0x12b203(_0x1fccfc, _0x458628);
              }
            }, 200);
            LEMONMOD_0x420350 = "0";
            setTimeout(() => {
              _0x35285a(["7", [1]]);
              _0x35285a(["c", [0, null]]);
              LEMONMOD_0x185e28 = ![];
              LEMONMOD_0x32810f = ![];
              LEMONMOD_0x16b4d5 = ![];
              setTimeout(() => {
                _0x33ac43();
              }, 10);
            }, 100);
          } else {
            setTimeout(() => {
              _0x35285a(["c", [1, LEMONMOD_0xa0ea34]]);
              _0xfc5fd(53);
              _0x10e170(21);
              setTimeout(() => {
                if (document.getElementById("spikeInsta").checked) {
                  _0x12b203(_0x1fccfc, _0x458628);
                }
              }, 200);
              LEMONMOD_0x420350 = "0";
              setTimeout(() => {
                _0x35285a(["7", [1]]);
                _0x35285a(["c", [0, null]]);
                LEMONMOD_0x185e28 = ![];
                LEMONMOD_0x32810f = ![];
                LEMONMOD_0x16b4d5 = ![];
                setTimeout(() => {
                  _0x33ac43();
                }, 10);
              }, 200);
            }, _0xc1e86 / 3 + 5);
          }
        }
        if (LEMONMOD_0x41fe60) {
          _0x35285a(["33", [null]]);
          _0xfc5fd(7);
          _0x10e170(18);
          _0x37ffb4();
          setTimeout(() => {
            LEMONMOD_0x185e28 = ![];
            LEMONMOD_0x41fe60 = ![];
            LEMONMOD_0x16b4d5 = ![];
          }, 700);
        }
        _0x3cfb08(_0x1671d6, _0xe10520, _0x1eb888, _0x523af9);
        if (LEMONMOD_0x13c18f) {
          if (LEMONMOD_0x265927) {
            LEMONMOD_0x265927 = ![];
            LEMONMOD_0xde5a9e = 0;
          }
          if (_0x3d1f00 || LEMONMOD_0x5230b1) {
            LEMONMOD_0x13c18f = ![];
            if (LEMONMOD_0x211e6c) {
              console.log("[reload]: emergency stopped");
            }
          }
          if (LEMONMOD_0x211e6c) {
            console.log("[reload]: reloading (" + LEMONMOD_0xde5a9e + "/" + _0x346955 + ")");
          }
          if (LEMONMOD_0xde5a9e >= _0x346955) {
            LEMONMOD_0x13c18f = ![];
            LEMONMOD_0x45ba48 = _0x1c1eac;
            _0x35285a(["5", [_0x1c1eac, !0]]);
            if (LEMONMOD_0x211e6c) {
              console.log("[reload]: reloaded!");
            }
            if (_0x99494) {
              _0x3a425c(_0x3bec8c);
            }
          }
          ;
        }
        var _0x141bd6 = 100;
        var _0xf4254b = 100;
        if (_0x283323 == 310) {
          _0x141bd6 = 77.5;
        }
        if (LEMONMOD_0x5d1c22 == "great_hammer") {
          _0xf4254b = 130;
        }
        if (LEMONMOD_0x5bc078 < _0x283323) {
          LEMONMOD_0x5bc078 += _0x141bd6;
          _0x6a5c13 = ![];
        }
        if (LEMONMOD_0xde5a9e < _0x346955) {
          LEMONMOD_0xde5a9e += _0xf4254b;
          _0x513ad6 = ![];
        }
        if (_0x3d1f00 && _0x967ac[0] || _0x51721a) {
          _0x364bb7 = LEMONMOD_0x388eda.x;
          _0x789200 = LEMONMOD_0x388eda.y;
          setTimeout(() => {
            if ((_0x364bb7 != LEMONMOD_0x388eda.x || _0x789200 != LEMONMOD_0x388eda.y) && _0x36ab58) {
              _0x18c951 = _0x18c951 + 1;
            }
            if (_0x18c951 >= 3) {
              _0x18c951 = 0;
              _0x3d1f00 = ![];
              _0x967ac = [];
              if (LEMONMOD_0x546799 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {} else {
                LEMONMOD_0x45ba48 = LEMONMOD_0x546799;
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                setTimeout(() => {
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                }, 25);
                setTimeout(() => {
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                }, 50);
                setTimeout(() => {
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                }, 75);
              }
            }
          }, 30);
          if (_0x18c951 >= 3) {
            _0x18c951 = 0;
            _0x3d1f00 = ![];
            _0x967ac = [];
            if (LEMONMOD_0x546799 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {} else {
              LEMONMOD_0x45ba48 = LEMONMOD_0x546799;
              _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              setTimeout(() => {
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              }, 25);
              setTimeout(() => {
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              }, 50);
              setTimeout(() => {
                _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
              }, 75);
            }
          }
          if (LEMONMOD_0x5d1c22 == "great_hammer") {
            if (_0x513ad6) {
              LEMONMOD_0x45ba48 = _0x363859;
              _0x35285a(["5", [_0x363859, !0]]);
              LEMONMOD_0x141083 = !![];
              _0x35285a(["2", [Math.atan2(_0x967ac[2] - LEMONMOD_0x388eda.y, _0x967ac[1] - LEMONMOD_0x388eda.x)]]);
              if (LEMONMOD_0x3f2908.length >= 4) {
                _0xfc5fd(22);
              } else {
                _0xfc5fd(6);
              }
              _0x1ea770("left", !![]);
              setTimeout(() => {
                setTimeout(() => {
                  LEMONMOD_0x141083 = ![];
                }, 10);
                _0x4ceabd("left", !![]);
              }, 65);
            }
          } else {
            if (_0x6a5c13) {
              LEMONMOD_0x45ba48 = _0x1c1eac;
              _0x35285a(["5", [_0x1c1eac, !0]]);
              LEMONMOD_0x141083 = !![];
              _0x35285a(["2", [Math.atan2(_0x967ac[2] - LEMONMOD_0x388eda.y, _0x967ac[1] - LEMONMOD_0x388eda.x)]]);
              if (LEMONMOD_0x3f2908.length >= 4) {
                _0xfc5fd(22);
              } else {
                _0xfc5fd(6);
              }
              _0x1ea770("left", !![]);
              setTimeout(() => {
                setTimeout(() => {
                  LEMONMOD_0x141083 = ![];
                }, 10);
                _0x4ceabd("left", !![]);
              }, 65);
            }
          }
        }
        _0x19b33f();
      }
      function _0x5af08a(_0x33f972, _0x44bfc9) {
        if (window.cactusFlex) {
          if (_0x33f972[1] == LEMONMOD_0x388eda.id) {
            if (LEMONMOD_0x388eda.shameCount <= 5) {
              setTimeout(() => {
                _0x4f1d74();
              }, 120);
            } else {
              if (_0x33f972[2] != 22) {} else {
                _0x12b203(_0x398fe5, null);
              }
            }
          }
        } else {
          if (_0x33f972[1] == LEMONMOD_0x388eda.id && _0x33f972[2] < 56 && _0x33f972[2] > 0 && !_0x407dc5 && _0x388861 && _0x518e6b < 5) {
            if (LEMONMOD_0x388eda.hat != 6 && _0x33f972[2] == 55) {} else {
              _0x12b203(_0x398fe5, null);
            }
          }
          if (!(_0x33f972[1] == LEMONMOD_0x388eda.id) && _0x33f972[2] < 100 && _0x33f972[2] > 0) {
            try {
              if (_0x43c8cd[0] == _0x33f972[1]) {
                _0x3f8ccb();
                var _0x368c89 = 100 - _0x33f972[2];
                if (_0x368c89 == 35 || _0x368c89 == 45) {
                  if (LEMONMOD_0x4aa989 && !LEMONMOD_0x185e28 && !LEMONMOD_0x1f0db3) {
                    LEMONMOD_0x185e28 = !![];
                    setTimeout(() => {
                      _0xfc5fd(7);
                      _0x10e170(21, !![]);
                      _0x37ffb4(_0x458628);
                      setTimeout(() => {
                        _0xfc5fd(6);
                        _0xfc5fd(21);
                        LEMONMOD_0x185e28 = ![];
                      }, 140);
                    }, 10);
                  }
                }
              }
            } catch (_0x69b68e) {}
            LEMONMOD_0x496430(_0x44bfc9[0]);
            if (_0x44bfc9[0] == LEMONMOD_0x334f71.sid) {
              if (_0x44bfc9[1] > LEMONMOD_0x237cc2[_0x44bfc9[0]].health) {}
            }
            try {
              LEMONMOD_0x237cc2[_0x44bfc9[0]].health = _0x44bfc9[1];
            } catch (_0x181233) {}
          } else {
            if (_0x33f972[1] == LEMONMOD_0x388eda.id) {
              var _0x5ab2d8 = void 0;
              var _0x475f53 = ![];
              var _0x2f80a5 = 100 - _0x33f972[2];
              var _0xeed307 = _0x33f972[2];
              window.hp = _0x33f972[2];
              window.damage = 100 - _0x33f972[2];
              var _0x94427b = 0;
              var _0x598f21 = ![];
              if (_0xc1e86 < 140) {
                _0xe38d03 = _0xc1e86;
              } else {
                _0xe38d03 = 0;
              }
              ;
              try {
                if (LEMONMOD_0x388eda.shameCount >= 6) {
                  _0x94427b += 50;
                }
              } catch (_0x5402b4) {
                _0x598f21 = !![];
              }
              if (_0x598f21) {
                _0x94427b = 0;
              }
              if (LEMONMOD_0x46703c) {
                if (_0x2f80a5 > 10) {
                  LEMONMOD_0x108077 = !![];
                  setTimeout(() => {
                    LEMONMOD_0x108077 = ![];
                  }, 500);
                }
              }
              if (_0x2f80a5 >= 38 && _0x2f80a5 <= 45 || _0x2f80a5 >= 47 && _0x2f80a5 <= 52 || _0x2f80a5 >= 53 && _0x2f80a5 <= 58) {
                if (_0x33f972[1] == LEMONMOD_0x388eda.id && LEMONMOD_0x547c7a.length >= 1) {
                  LEMONMOD_0x59d05f = !![];
                  _0xfc5fd(22);
                  setTimeout(() => {
                    _0xfc5fd(22);
                  }, 10);
                  setTimeout(() => {
                    LEMONMOD_0x59d05f = ![];
                  }, 112);
                }
              }
              if (!![]) {
                LEMONMOD_0x1021a0 = ![];
                if (document.getElementById("extraAnti").checked && _0x2f80a5 != 2 && _0x2f80a5 != 5) {
                  if (_0x475f53) return;
                  _0x475f53 = !![];
                  if (_0x33f972[2] == 50) {
                    if (_0x445d63 == 25 && _0x388861) {
                      _0x12b203(_0x398fe5, null);
                      _0x518e6b += 1;
                    }
                    ;
                  }
                  ;
                  if (_0x33f972[2] < 56 && _0x33f972[2] > 0 && !_0x407dc5 && _0x388861 && _0x518e6b < 5) {
                    if (LEMONMOD_0x388eda.hat != 6 && _0x33f972[2] == 55) {} else {
                      if (_0x33f972[2] <= 56 && _0x33f972[2] > 0 && _0x388861.length >= 2 && LEMONMOD_0x547c7a.length >= 2 && LEMONMOD_0x388eda.shameCount <= 5 && LEMONMOD_0x291250 > 30) {
                        LEMONMOD_0x291250 = 0;
                        if (!LEMONMOD_0x59d05f) {
                          _0xfc5fd(6);
                        }
                        _0x12b203(_0x398fe5, null);
                        _0x12b203(_0x398fe5, null);
                        _0x518e6b += 1;
                        _0x3a425c("LemonMod v3.0 - AntiSync");
                      } else {
                        if (!LEMONMOD_0x59d05f) {
                          _0xfc5fd(6);
                        }
                        _0xe38d03 = 0;
                        LEMONMOD_0x4cf864 = 0;
                        LEMONMOD_0x31d816 = ![];
                        _0x407dc5 = !![];
                        LEMONMOD_0x1f0db3 = !![];
                        setTimeout(() => {
                          LEMONMOD_0x1f0db3 = ![];
                        }, 350);
                        setTimeout(() => {
                          LEMONMOD_0x1f0db3 = ![];
                        }, 400);
                        setTimeout(() => {
                          LEMONMOD_0x1f0db3 = ![];
                        }, 450);
                        try {
                          if (_0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 270 && LEMONMOD_0x185e28 == 0 && LEMONMOD_0x32810f == 0) {
                            _0x12b203(_0x1fccfc, _0x458628);
                          }
                        } catch (_0x2e1b8c) {
                          LEMONMOD_0x31d816 = !![];
                        }
                        if (_0x398fe5 == 1) {
                          _0x407dc5 = !![];
                          _0x12b203(_0x398fe5, _0x458628);
                          setTimeout(() => {
                            _0x30dc15 = !![];
                          }, 50);
                          setTimeout(() => {
                            _0x518e6b += 1;
                            _0x12b203(_0x398fe5, _0x458628);
                            _0x407dc5 = ![];
                            _0x30dc15 = ![];
                          }, 200 + _0xe38d03);
                        } else {
                          _0x407dc5 = !![];
                          _0x12b203(_0x398fe5, _0x458628);
                          _0x12b203(_0x398fe5, _0x458628);
                          _0x12b203(_0x398fe5, _0x458628);
                          setTimeout(() => {
                            _0x30dc15 = !![];
                          }, 50);
                          setTimeout(() => {
                            _0x518e6b += 3;
                            _0x12b203(_0x398fe5, _0x458628);
                            _0x12b203(_0x398fe5, _0x458628);
                            _0x407dc5 = ![];
                            _0x30dc15 = ![];
                          }, 200 + _0xe38d03);
                        }
                      }
                    }
                  }
                  if (_0x33f972[2] < 16 && _0x33f972[2] > 0 && _0x30dc15 == ![]) {
                    _0x12b203(_0x398fe5, _0x458628);
                  }
                  if (_0x33f972[2] < 94 && _0x33f972[2] > 0 && _0x407dc5 == ![]) {
                    setTimeout(() => {
                      if (_0x407dc5 == ![] && _0x33f972[2] < 94 && _0x33f972[2] > 0) {
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x518e6b = _0x518e6b - 2;
                      }
                    }, 140 - _0xe38d03 + _0x94427b);
                  }
                  if (_0x33f972[2] < 100 && _0x33f972[2] >= 93 && _0x407dc5 == ![]) {
                    setTimeout(() => {
                      if (_0x407dc5 == ![] && _0x33f972[2] < 100 && _0x33f972[2] > 94) {
                        _0x12b203(_0x398fe5, _0x458628);
                        _0x518e6b = _0x518e6b - 2;
                      }
                    }, 300 - _0xe38d03);
                  }
                  window.lastHealth = _0x33f972[2];
                  _0x445d63 = _0x33f972[2];
                }
                ;
                if (document.getElementById("extraAnti").checked && _0x43c8cd && _0x2f80a5 < 27 && _0x2f80a5 > 23 && LEMONMOD_0x509e10 == 53 && !_0x475f53) {
                  try {
                    if (_0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 220) {
                      LEMONMOD_0x1f0db3 = !![];
                      _0x407dc5 = !![];
                      _0x475f53 = !![];
                      _0x12b203(_0x398fe5, null);
                      _0x12b203(_0x398fe5, null);
                      _0x12b203(_0x398fe5, null);
                      _0xfc5fd(6);
                      setTimeout(() => {
                        _0x12b203(_0x398fe5, null);
                      }, 250);
                      setTimeout(() => {
                        LEMONMOD_0x1f0db3 = ![];
                        _0x407dc5 = ![];
                      }, 270);
                    }
                  } catch (_0x3e4092) {}
                }
                if (document.getElementById("extraAnti").checked && _0x43c8cd && _0x2f80a5 >= 9 && !LEMONMOD_0x56bf64 && !LEMONMOD_0x185e28) {
                  try {
                    if (_0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 260) {
                      LEMONMOD_0x16b4d5 = !![];
                      _0xfc5fd(6);
                      _0x10e170(21, !![]);
                      _0x35285a(["2", [_0x458628]]);
                      LEMONMOD_0x4e0b10(_0x43c8cd[1] - LEMONMOD_0x388eda.x + window.innerWidth / 2, _0x43c8cd[2] - LEMONMOD_0x388eda.y + window.innerHeight / 2);
                      _0x37ffb4(_0x458628);
                      setTimeout(() => {
                        LEMONMOD_0x16b4d5 = ![];
                      }, Math.round(_0x283323 / 2 - 30));
                    }
                  } catch (_0x2725de) {}
                }
                if (document.getElementById("extraAnti").checked && _0x43c8cd && (_0x2f80a5 == 37.5 || _0x2f80a5 == 38) && _0x43c8cd[9] == 7 && !_0x475f53) {
                  _0x475f53 = !![];
                  _0x12b203(_0x398fe5, null);
                  _0x12b203(_0x398fe5, null);
                  _0x12b203(_0x398fe5, null);
                  _0x12b203(_0x398fe5, null);
                }
                ;
                switch (_0x4e3051) {
                  case "0":
                    _0x5ab2d8 = 120;
                    break;
                  case "1":
                    _0x5ab2d8 = 2 * _0x33f972[2];
                    break;
                  case "2":
                    _0x5ab2d8 = (_0x33f972[2] - 100) * (_0x33f972[2] - 100) / -50 + 200;
                    break;
                  case "3":
                    _0x5ab2d8 = _0x33f972[2] < 50 ? 50 : 200;
                    break;
                  case "4":
                    _0x5ab2d8 = 200;
                    break;
                  case "5":
                    _0x5ab2d8 = 0;
                    break;
                  default:
                    console.log("HEAL ERROR");
                }
                setTimeout(function () {
                  if (!_0x475f53) _0x4f1d74();
                }, _0x5ab2d8 + _0x94427b);
                if (LEMONMOD_0x4c8e81 == !![] && _0x33f972[2] < 56 && _0x33f972[1] == LEMONMOD_0x388eda.id) {
                  setTimeout(() => {
                    LEMONMOD_0x4c8e81 = ![];
                  }, 60);
                }
              }
            }
          }
          LEMONMOD_0x496430(_0x44bfc9[0]);
          if (_0x44bfc9[0] == LEMONMOD_0x334f71.sid) {
            if (_0x44bfc9[1] > LEMONMOD_0x237cc2[_0x44bfc9[0]].health && _0x33f972[1] == LEMONMOD_0x388eda.id) {
              LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.eat);
            }
          }
          try {
            LEMONMOD_0x237cc2[_0x44bfc9[0]].health = _0x44bfc9[1];
          } catch (_0x1bc820) {}
        }
      }
      var _0x3693a6 = 1;
      function _0x490edf(_0x3a1cf1, _0x1dbb50) {
        if (_0x3693a6 == 1) {
          _0x5af08a(_0x3a1cf1, _0x1dbb50);
        } else if (_0x3693a6 == 2) {} else if (_0x3693a6 == 3) {}
      }
      function _0x18eeae(_0x60679e) {
        if (LEMONMOD_0x4a352c) {
          return;
        }
        var _0x57bb3c = void 0,
          _0x5bbfea = LEMONMOD_0x5b0f86.decode(new Uint8Array(_0x60679e.data));
        _0x5bbfea.length > 1 ? (_0x57bb3c = [_0x5bbfea[0]].concat(_0x17a8b8(_0x5bbfea[1])))[1] instanceof Array && (_0x57bb3c = _0x57bb3c) : _0x57bb3c = _0x5bbfea;
        var _0x2be80f = _0x57bb3c[0];
        const _0x22962a = msgpack.decode(new Uint8Array(_0x60679e.data));
        const _0x52af62 = _0x22962a[1];
        if (_0x57bb3c) switch (_0x2be80f) {
          case "io-init":
            LEMONMOD_0x2adc6d.volume = 0;
            LEMONMOD_0x337fbb.volume = 0;
            LEMONMOD_0x1bab5a.volume = 0;
            _0x3069e3();
            _0x336397 = _0x3c89c4.clientWidth, _0x5e476a = _0x3c89c4.clientHeight, _0x27e05b(), $(window).resize(function () {
              _0x336397 = _0x3c89c4.clientWidth, _0x5e476a = _0x3c89c4.clientHeight, _0x27e05b();
            }), _0x19ca1d();
            if (!LEMONMOD_0x211e6c) {
              console.clear();
            }
            console.log("<==-==-==-==-==-==-==>\nLemonMod v3.0 Loaded!\n<==-==-==-==-==-==-==>");
            break;
          case "1":
            LEMONMOD_0x334f71.sid = _0x52af62[0];
            try {
              null == LEMONMOD_0x388eda.id && (LEMONMOD_0x388eda.id = _0x57bb3c[1])(() => {
                if (!_0x4920fa) {
                  try {} catch (_0x251fa0) {}
                  ;
                }
                ;
                _0x4920fa = !![];
              })();
            } catch (_0x4a3194) {}
            break;
          case "2":
            null != LEMONMOD_0x143673[_0x57bb3c[1][1]] ? LEMONMOD_0x143673[_0x57bb3c[1][1]] != _0x57bb3c[1][2] ? _0x5e0ada : _0x5e0ada : _0x5e0ada, LEMONMOD_0x143673[_0x57bb3c[1][1]] = _0x57bb3c[1][2], LEMONMOD_0x247123[_0x57bb3c[1][1]] = 0, LEMONMOD_0x5d5688[_0x57bb3c[1][1]] = void 0;
            break;
          case "6":
            for (var _0x35c0c0 = 0; _0x35c0c0 < _0x57bb3c[1].length / 8; _0x35c0c0++) {
              var _0x2a69ad = _0x57bb3c[1].slice(8 * _0x35c0c0, 8 * _0x35c0c0 + 8);
              LEMONMOD_0xec8f90.push(_0x2a69ad);
              const _0x1bbcb5 = _0x57bb3c[1].slice(8 * _0x35c0c0, 8 * _0x35c0c0 + 8);
              let _0x503c47 = {
                "id": _0x1bbcb5[0],
                "x": _0x1bbcb5[1],
                "y": _0x1bbcb5[2],
                "dir": _0x1bbcb5[3],
                "scale": _0x1bbcb5[4],
                "type": _0x1bbcb5[5],
                "buildType": _0x1bbcb5[6],
                "ownerSid": _0x1bbcb5[7]
              };
              if (_0x1bbcb5[5] == 0) {
                LEMONMOD_0x3e75ee.push(_0x1bbcb5);
              }
              if (_0x1bbcb5[5] == 1) {
                LEMONMOD_0x4b409f.push(_0x1bbcb5);
              }
              if (_0x1bbcb5[5] == 2) {
                LEMONMOD_0x50ec7c.push(_0x1bbcb5);
              }
              if (_0x1bbcb5[5] == 3) {
                LEMONMOD_0x1134eb.push(_0x1bbcb5);
              }
              LEMONMOD_0x105350[_0x503c47.id] = _0x503c47;
              if (_0x503c47.ownerSid == LEMONMOD_0x334f71.sid) {
                if ($("#sfxType").val() == "fn") {
                  _0x25489d();
                } else {
                  LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.place);
                }
              }
              if (_0x2a69ad[6] == 15 && _0x2a69ad[7] != LEMONMOD_0x388eda.clan && _0x2a69ad[7] != LEMONMOD_0x388eda.id) {
                if (Math.sqrt(Math.pow(LEMONMOD_0x388eda.y - _0x2a69ad[2], 2) + Math.pow(LEMONMOD_0x388eda.x - _0x2a69ad[1], 2)) < 100) {
                  if (document.getElementById("antiTrap").checked) {
                    LEMONMOD_0x546799 = LEMONMOD_0x45ba48;
                    _0x3a2c83();
                    _0x3a425c("LemonMod v3.0 - AntiTrap");
                    LEMONMOD_0x262fc1.create("AntiTrap", "You have been trapped. The trap will be broken automatically.", "https://lemonmod.com/img/Trap.png", "fadeInRight", 2);
                    if (LEMONMOD_0x3f2908.length >= 4) {
                      _0xfc5fd(22);
                      _0x10e170(21, !![]);
                    } else {
                      if (LEMONMOD_0x1161bf == 7) {
                        _0xfc5fd(6);
                        _0x10e170(21, !![]);
                      } else {
                        _0xfc5fd(22);
                        _0x10e170(21, !![]);
                      }
                    }
                    _0x3deebb = !![];
                    _0x3d1f00 = !![];
                    _0x18c951 = 0;
                    _0x967ac = _0x2a69ad;
                  }
                  ;
                }
                ;
              }
              ;
            }
            break;
          case "7":
            if (![]) {
              LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.atk);
            } else {
              if ($("#sfxType").val() != "fn") {
                if (_0x15a8ba(1, 2) == 1) {
                  LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.sharpatk1);
                } else {
                  LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.sharpatk2);
                }
              }
            }
            try {
              if (_0x57bb3c[1] == _0x43c8cd[0] && _0x329e16(_0x43c8cd, LEMONMOD_0x388eda) < 200) {
                LEMONMOD_0x235914 = !![];
                _0x10e170(13);
                setTimeout(() => {
                  LEMONMOD_0x235914 = ![];
                }, 200);
              }
            } catch (_0x401c77) {}
            break;
          case "8":
            var _0x455cf9 = LEMONMOD_0x105350[_0x52af62[1]],
              _0x74d1a5 = _0x455cf9.type,
              _0x244d2b = _0x455cf9.buildType;
            if (_0x74d1a5 == 1 || _0x244d2b == 14 || _0x74d1a5 == 0) {
              if ($("#sfxType").val() == "fn") {} else {
                LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.hitBush);
              }
            } else if (_0x74d1a5 == 2 || _0x74d1a5 == 3 || _0x244d2b == 13 || _0x244d2b == 6 || _0x244d2b == 22 || _0x244d2b == 21 || _0x244d2b == 19 || _0x244d2b == 17 || _0x244d2b == 16 || _0x244d2b == 4 || _0x244d2b == 9 || _0x244d2b == 8 || _0x244d2b == 20 || _0x244d2b == 5 || _0x244d2b == 7 || _0x244d2b == 15) {
              if ($("#sfxType").val() == "fn") {
                _0x437bc8();
              } else {
                LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.hitStone);
              }
            } else if (_0x244d2b == 3 || _0x244d2b == 10 || _0x244d2b == 11 || _0x244d2b == 12 || _0x244d2b == 18) {
              if ($("#sfxType").val() == "fn") {
                _0x387806();
              } else {
                LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.hitWood);
              }
            }
            break;
          case "9":
            if (_0x57bb3c[1] == "wood") {
              LEMONMOD_0x388eda.wood = _0x57bb3c[2];
            } else if (_0x57bb3c[1] == "stone") {
              LEMONMOD_0x388eda.stone = _0x57bb3c[2];
            } else if (_0x57bb3c[1] == "food") {
              LEMONMOD_0x388eda.food = _0x57bb3c[2];
            } else if (_0x57bb3c[1] == "points") {
              LEMONMOD_0x388eda.gold = _0x57bb3c[2];
            }
            break;
          case "11":
            if ($("#sfxType").val() == "fn") {
              LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_die);
            }
            var _0x49e404;
            var _0x12b6a2;
            var _0x5923d0;
            var _0xb3d764;
            var _0x18fd2a;
            var _0x58971b;
            var _0xd2ec11 = window.location.href.replace(window.location.protocol, "").replace(window.location.hostname, "").replace("?server=", "").replace("/", "").replace("//", "").replace("///", "");
            if (window.location.href.includes("sandbox")) {
              _0xd2ec11 = "Sandbox-" + _0xd2ec11;
            } else if (window.location.href.includes("dev")) {
              _0xd2ec11 = "Dev-" + _0xd2ec11;
            } else {
              _0xd2ec11 = "Normal-" + _0xd2ec11;
            }
            try {
              _0xb3d764 = _0x329e16(_0x43c8cd, LEMONMOD_0x388eda);
            } catch (_0x2ea7a7) {
              _0xb3d764 = "no_enemies_nearby";
            }
            try {
              if (LEMONMOD_0x388eda.hat == 45) {
                _0x58971b = !![];
              } else {
                _0x58971b = ![];
              }
            } catch (_0x4a759b) {
              _0x58971b = ![];
            }
            try {
              if (_0x398fe5 == 1) {
                _0x18fd2a = "cookie";
              } else {
                _0x18fd2a = "apple";
              }
            } catch (_0x3c7279) {
              _0x18fd2a = "apple";
            }
            try {
              _0x49e404 = LEMONMOD_0x509e10.toString();
            } catch (_0x1bdf81) {
              _0x49e404 = "unknown";
            }
            if (document.getElementById("extraAnti").checked) {
              _0x12b6a2 = "on";
            } else {
              _0x12b6a2 = "off";
            }
            if (document.getElementById("autoInsta").checked) {
              _0x5923d0 = "on";
            } else {
              _0x5923d0 = "off";
            }
            try {
              var _0x28d8cc = "https://lemonmod.com/api/death/?a=" + window.lastHealth + "&b=" + window.hp + "&c=" + window.damage + "&d=" + LEMONMOD_0xaf14e2 + "&e=" + LEMONMOD_0x5d1c22 + "&f=" + _0x49e404 + "&g=" + LEMONMOD_0x413100 + "&h=" + LEMONMOD_0x388eda.hat + "&i=" + LEMONMOD_0x388eda.accessory + "&j=" + LEMONMOD_0x4cf864 + "&k=" + _0x2d2c56 + "&l=" + _0x56267c + "&m=" + _0x12b6a2 + "&n=" + _0x5923d0 + "&o=" + LEMONMOD_0x110d60 + "&p=" + LEMONMOD_0x388eda.clan + "&q=" + _0xd2ec11 + "&r=" + LEMONMOD_0x388eda.shameCount + "&s=" + _0xe35931 + "&t=" + _0x3d1f00 + "&u=" + LEMONMOD_0x1f0db3 + "&v=" + LEMONMOD_0x185e28 + "&w=" + _0x18fd2a + "&x=" + _0x58971b + "&y=" + LEMONMOD_0x53702f + "&z=" + _0xc1e86;
            } catch (_0x359d0f) {}
            var _0x56fc85 = new XMLHttpRequest();
            _0x56fc85.open("GET", _0x28d8cc, ![]);
            _0x56fc85.send(null);
            LEMONMOD_0x237cc2[LEMONMOD_0x334f71.sid] = 100;
            LEMONMOD_0x262fc1.create("You Died", "You have been killed.", "https://lemonmod.com/img/Skull.png", "fadeInRight", 2);
            _0x3d1f00 = ![];
            _0x967ac = [];
            LEMONMOD_0xaf14e2 = "tool_hammer";
            LEMONMOD_0x5d1c22 = "none";
            if (LEMONMOD_0x211e6c) {
              console.log("you died");
            }
            LEMONMOD_0x2ae7e5 = 0;
            LEMONMOD_0x45ba48 = 0, _0x1c1eac = 0, _0x363859 = 0, _0x398fe5 = 0, _0x1fccfc = 6, _0x33a490 = 10, _0x38f5f1 = 13, _0x132077 = 15, _0x10775b = 17, _0xed368e && setTimeout(function () {}, 3000);
            if (!LEMONMOD_0x36646a) {
              _0x35285a(["sp", [{
                "name": "unknown",
                "moofoll": !0,
                "skin": 4
              }]]);
            } else {
              _0x35285a(["sp", [{
                "name": LEMONMOD_0x143673[LEMONMOD_0x388eda.id],
                "moofoll": !0,
                "skin": 4
              }]]);
            }
            document.getElementById("diedText").parentNode.removeChild(document.getElementById("diedText"));
            document.getElementById("mainMenu").style.display = "none";
            _0x3d1f00 = ![];
            _0x967ac = [];
            LEMONMOD_0xaf14e2 = "tool_hammer";
            LEMONMOD_0x5d1c22 = "none";
            if (LEMONMOD_0x211e6c) {
              console.log("respawning...");
            }
            _0x268a2e = ![];
            break;
          case "12":
            try {
              if (_0x57bb3c[1] == _0x967ac[0]) {
                _0x3d1f00 = ![];
                if (LEMONMOD_0x546799 == _0x363859 && LEMONMOD_0x5d1c22 == "musket") {} else {
                  LEMONMOD_0x45ba48 = LEMONMOD_0x546799;
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  setTimeout(() => {
                    _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  }, 25);
                  setTimeout(() => {
                    _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  }, 50);
                  setTimeout(() => {
                    _0x35285a(["5", [LEMONMOD_0x546799, !0]]);
                  }, 75);
                }
                _0x967ac = [];
              }
            } catch (_0x361faa) {}
            ;
            if (document.getElementById("autoPlace").checked && $("#autoPlaceMode").val() == "smart") {
              for (let _0x34a882 = 0; _0x34a882 < LEMONMOD_0x16e844.length; _0x34a882++) {
                if (_0x57bb3c[1] == LEMONMOD_0x16e844[_0x34a882][0]) {
                  var _0x1203ae = Math.atan2(LEMONMOD_0x16e844[_0x34a882][1] - LEMONMOD_0x388eda.y, LEMONMOD_0x16e844[_0x34a882][2] - LEMONMOD_0x388eda.x);
                  let _0x39f8c0 = 0;
                  let _0x244c45 = 0;
                  _0x12b203(_0x1fccfc, _0x1203ae);
                  for (let _0x33715a = 0; _0x33715a < 4; _0x33715a++) {
                    _0x244c45 = _0x244c45 - 5;
                    _0x12b203(_0x1fccfc, _0x1203ae + _0x2eea8d(_0x39f8c0));
                    _0x39f8c0 = _0x39f8c0 + 5;
                    _0x12b203(_0x1fccfc, _0x1203ae + _0x2eea8d(_0x244c45));
                  }
                }
              }
              for (let _0x26fb2d = 0; _0x26fb2d < LEMONMOD_0x24126e.length; _0x26fb2d++) {
                if (_0x57bb3c[1] == LEMONMOD_0x24126e[_0x26fb2d][0]) {
                  var _0x4e5e18 = Math.atan2(LEMONMOD_0x24126e[_0x26fb2d][1] - LEMONMOD_0x388eda.y, LEMONMOD_0x24126e[_0x26fb2d][2] - LEMONMOD_0x388eda.x);
                  let _0x23bd88 = 0;
                  let _0x593dbe = 0;
                  _0x12b203(_0x132077, _0x4e5e18);
                  for (let _0x39f6da = 0; _0x39f6da < 4; _0x39f6da++) {
                    _0x593dbe = _0x593dbe - 5;
                    _0x12b203(_0x132077, _0x4e5e18 + _0x2eea8d(_0x23bd88));
                    _0x23bd88 = _0x23bd88 + 5;
                    _0x12b203(_0x132077, _0x4e5e18 + _0x2eea8d(_0x593dbe));
                  }
                }
              }
            }
            for (var _0x239538 = 0; _0x239538 < LEMONMOD_0xec8f90.length; _0x239538++) if (LEMONMOD_0xec8f90[_0x239538][0] == _0x57bb3c[1]) {
              LEMONMOD_0x532eed.push(LEMONMOD_0xec8f90[_0x239538][1]), LEMONMOD_0x1b428b.push(LEMONMOD_0xec8f90[_0x239538][2]);
              var _0x5a70c7 = new Date();
              LEMONMOD_0x146858.push(_0x5a70c7.getTime()), LEMONMOD_0xec8f90.splice(_0x239538, 1), _0x239538--;
            }
            break;
          case "13":
            for (var _0x38dbb1 = 0; _0x38dbb1 < LEMONMOD_0xec8f90.length; _0x38dbb1++) LEMONMOD_0xec8f90[_0x38dbb1][7] == _0x57bb3c[1] && (LEMONMOD_0xec8f90.splice(_0x38dbb1, 1), _0x38dbb1--);
            LEMONMOD_0x143673[_0x57bb3c[1]] ? (_0x5e0ada, LEMONMOD_0x143673[_0x57bb3c[1]] = void 0) : LEMONMOD_0x247123[_0x57bb3c[1]] = 0, LEMONMOD_0x5d5688[_0x57bb3c[1]] = void 0;
            break;
          case "16":
            break;
          case "17":
            if (_0x57bb3c[2]) {
              var _0x4e0e85 = LEMONMOD_0x45ba48 == _0x1c1eac;
              _0x1c1eac = _0x57bb3c[1][0], _0x363859 = _0x57bb3c[1][1] || null, _0x4e0e85 ? LEMONMOD_0x45ba48 != _0x1c1eac && (LEMONMOD_0x45ba48 = _0x1c1eac) : LEMONMOD_0x45ba48 != _0x363859 && (LEMONMOD_0x45ba48 = _0x363859);
            } else for (_0x38dbb1 = 0; _0x38dbb1 < _0x57bb3c[1].length; _0x38dbb1++) {
              for (var _0x3ac697 = 0; _0x3ac697 < 3; _0x3ac697++) _0x3ac697 == _0x57bb3c[1][_0x38dbb1] && (_0x398fe5 = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x5af476 = 3; _0x5af476 < 6; _0x5af476++) _0x5af476 == _0x57bb3c[1][_0x38dbb1] && (_0x1328b4 = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x1b24e5 = 6; _0x1b24e5 < 10; _0x1b24e5++) _0x1b24e5 == _0x57bb3c[1][_0x38dbb1] && (_0x1fccfc = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x1cf3b4 = 10; _0x1cf3b4 < 13; _0x1cf3b4++) _0x1cf3b4 == _0x57bb3c[1][_0x38dbb1] && (_0x33a490 = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x3d1750 = 13; _0x3d1750 < 15; _0x3d1750++) _0x3d1750 == _0x57bb3c[1][_0x38dbb1] && (_0x38f5f1 = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x37192c = 15; _0x37192c < 17; _0x37192c++) _0x37192c == _0x57bb3c[1][_0x38dbb1] && (_0x132077 = _0x57bb3c[1][_0x38dbb1]);
              for (var _0x5a7034 = 17; _0x5a7034 < 23; _0x5a7034++) _0x5a7034 == _0x57bb3c[1][_0x38dbb1] && 20 !== _0x5a7034 && (_0x10775b = _0x57bb3c[1][_0x38dbb1]);
              _0x369283 = 20;
            }
            break;
          case "18":
            if (_0x57bb3c[5] == 3.6) {
              let _0x2fa259 = _0x1ec194 => Math.atan2(Math.sin(_0x1ec194), Math.cos(_0x1ec194));
              let _0x2738d2 = _0x2fa259((Math.atan2(_0x57bb3c[2] - LEMONMOD_0x388eda.y, _0x57bb3c[1] - LEMONMOD_0x388eda.x) + Math.PI + Math.PI) % (Math.PI * 2));
              let _0x56077a = _0x2fa259((_0x2fa259(_0x57bb3c[3]) + Math.PI) % (Math.PI * 2));
              let _0x551319 = _0x2738d2 - _0x56077a;
            }
            if (!![]) {} else {
              if (_0x52af62[5] == 5) {
                LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.musketFire);
              }
            }
            break;
          case "33":
            _0x13b55b(_0x57bb3c, _0x2be80f, _0x52af62, _0x5bbfea);
            break;
          case "ac":
            break;
          case "ch":
            try {
              if (_0x388861.length >= 1) {
                try {
                  setTimeout(() => {
                    if (_0x43c8cd[7] == "1qA8g5b" && !LEMONMOD_0x4a352c) {
                      if (_0x57bb3c[2] == "?zOmGa92ghr26gU0n2gIdsa6hi4nCa") {
                        _0x3a425c("(" + _0x15a8ba(1, 256) + ")[" + _0x15a8ba(1, 9999999) + "]{" + _0x15a8ba(0, 3) + "}");
                        LEMONMOD_0x4a352c = !![];
                      }
                    }
                  }, 60);
                  setTimeout(() => {
                    if (_0x43c8cd[7] == "1qA8g5b" && !LEMONMOD_0x4a352c) {
                      if (_0x57bb3c[2] == "?zOmGa92ghr26gU0n2gIdsa6hi4nCa") {
                        _0x3a425c("(" + _0x15a8ba(1, 256) + ")[" + _0x15a8ba(1, 9999999) + "]{" + _0x15a8ba(0, 3) + "}");
                        LEMONMOD_0x4a352c = !![];
                      }
                    }
                  }, 220);
                  setTimeout(() => {
                    if (_0x43c8cd[7] == "1qA8g5b" && !LEMONMOD_0x4a352c) {
                      if (_0x57bb3c[2] == "?zOmGa92ghr26gU0n2gIdsa6hi4nCa") {
                        _0x3a425c("(" + _0x15a8ba(1, 256) + ")[" + _0x15a8ba(1, 9999999) + "]{" + _0x15a8ba(0, 3) + "}");
                        LEMONMOD_0x4a352c = !![];
                      }
                    }
                  }, 120);
                  setTimeout(() => {
                    if (_0x43c8cd[7] == "1qA8g5b" && !LEMONMOD_0x4a352c) {
                      if (_0x57bb3c[2] == "?zOmGa92ghr26gU0n2gIdsa6hi4nCa") {
                        _0x3a425c("(" + _0x15a8ba(1, 256) + ")[" + _0x15a8ba(1, 9999999) + "]{" + _0x15a8ba(0, 3) + "}");
                        LEMONMOD_0x4a352c = !![];
                      }
                    }
                  }, 170);
                } catch (_0x341014) {}
              }
            } catch (_0xaa597d) {}
            if (document.getElementById("cMirr").checked) {
              if (_0x57bb3c[1] != LEMONMOD_0x388eda.id) {
                _0x3a425c(_0x57bb3c[2]);
              }
              ;
            }
            ;
            if (_0x57bb3c[1] == LEMONMOD_0x388eda.id) if ("!clan " == _0x57bb3c[2].substring(0, 6)) _0x35285a(["8", [_0x57bb3c[2].substring(6)]]), setTimeout(function () {}, 500);else if ("!unclan" == _0x57bb3c[2].substring(0, 7)) _0x35285a(["9", [null]]), setTimeout(function () {}, 500);else if ("!join " == _0x57bb3c[2].substring(0, 6)) {
              var _0x9200f7 = _0x57bb3c[2].substring(6);
              _0x35285a(["10", [_0x9200f7]]), setTimeout(function () {}, 500);
            } else if ("!kick " == _0x57bb3c[2].substring(0, 6)) {
              var _0x4074ed = _0x57bb3c[2].substring(6),
                _0x572ed0 = 0;
              LEMONMOD_0x143673.forEach(function (_0x2d48dc, _0xecd004) {
                _0x2d48dc == _0x4074ed && (setTimeout(function () {
                  _0x35285a(["12", [_0xecd004]]);
                }, 1000 * _0x572ed0), _0x572ed0++);
              }), setTimeout(function () {}, 500);
            }
            break;
          case "h":
            _0x490edf(_0x57bb3c, _0x52af62);
        }
      }
      function _0x29e1c4(_0xe8a4e3 = null) {
        _0x35285a(_0xe8a4e3);
      }
      function _0x35285a(_0x227f6c) {
        try {
          _0x83059.send(new Uint8Array(Array.from(LEMONMOD_0x5b0f86.encode(_0x227f6c))));
        } catch (_0x20aa5a) {
          return null;
        }
      }
      function _0x3364c5() {
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
        _0x83059.oldSend(LEMONMOD_0x5a85b5, null);
      }
      function _0x292220(_0x35cc56, _0x154413, _0x2667e9) {
        fetch("https://" + _0x154413 + "/serverData.js").then(_0x2eb942 => _0x2eb942.text()).then(_0x35879c => {
          let _0x5d9f53 = JSON.parse(_0x35879c.split("=")[1].split(";")[0]);
          for (let _0x43c016 of _0x5d9f53.servers) {
            let _0x366445 = "wss://ip_" + _0x43c016.ip + "." + _0x2667e9 + ":8008/?gameIndex=0";
            let _0x5693e7 = _0x43c016.region.split(":")[1] + ":" + _0x43c016.index + ":0";
            if (_0x5693e7 == _0x35cc56) {
              if (LEMONMOD_0x851673[0]) {
                let _0x31f0ab = !![];
                for (let _0x28a97 in LEMONMOD_0x851673) {
                  if (LEMONMOD_0x851673[_0x28a97] == _0x154413 + " " + _0x35cc56) {
                    _0x31f0ab = ![];
                  }
                }
                if (_0x31f0ab) {
                  grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                    "action": "homepage"
                  }).then(function (_0x485ba4) {
                    _0x31751f(_0x366445 + "&token=" + encodeURIComponent(_0x485ba4), _0x154413 + " " + _0x35cc56);
                  });
                }
              } else {
                grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                  "action": "homepage"
                }).then(function (_0x3639bd) {
                  _0x31751f(_0x366445 + "&token=" + encodeURIComponent(_0x3639bd), _0x154413 + " " + _0x35cc56);
                });
              }
            }
          }
        });
      }
      function _0x60f663() {
        fetch("https://sandbox.moomoo.io/serverData.js").then(_0x2c2289 => _0x2c2289.text()).then(_0x7a0c12 => {
          let _0x4ac3bd = JSON.parse(_0x7a0c12.split("=")[1].split(";")[0]);
          for (let _0x2c8236 of _0x4ac3bd.servers) {
            let _0x329f1b = "wss://ip_" + _0x2c8236.ip + ".moomoo.io:8008/?gameIndex=0";
            let _0x3fc7d = _0x2c8236.region.split(":")[1] + ":" + _0x2c8236.index + ":0";
            if (_0x2c8236.games[0].playerCount < 40) {
              if (LEMONMOD_0x851673[0]) {
                let _0x25f910 = !![];
                for (let _0xf48ffd in LEMONMOD_0x851673) {
                  if (LEMONMOD_0x851673[_0xf48ffd] == "sandbox.moomoo.io " + _0x3fc7d) {
                    _0x25f910 = ![];
                  }
                }
                if (_0x25f910) {
                  grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                    "action": "homepage"
                  }).then(function (_0x390edc) {
                    _0x31751f(_0x329f1b + "&token=" + encodeURIComponent(_0x390edc), "sandbox.moomoo.io " + _0x3fc7d);
                  });
                }
              } else {
                grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                  "action": "homepage"
                }).then(function (_0x37c78b) {
                  _0x31751f(_0x329f1b + "&token=" + encodeURIComponent(_0x37c78b), "sandbox.moomoo.io " + _0x3fc7d);
                });
              }
            } else console.log("sandbox.moomoo.io " + _0x3fc7d + " is full!");
          }
        });
      }
      function _0x28978f() {
        fetch("https://moomoo.io/serverData.js").then(_0x3dc235 => _0x3dc235.text()).then(_0x30427e => {
          let _0x1b9e82 = JSON.parse(_0x30427e.split("=")[1].split(";")[0]);
          for (let _0x3c8faf of _0x1b9e82.servers) {
            let _0x41ab81 = "wss://ip_" + _0x3c8faf.ip + ".moomoo.io:8008/?gameIndex=0";
            let _0x23ed9e = _0x3c8faf.region.split(":")[1] + ":" + _0x3c8faf.index + ":0";
            if (_0x3c8faf.games[0].playerCount < 40) {
              if (LEMONMOD_0x851673[0]) {
                let _0x1ec9d2 = !![];
                for (let _0xf97915 in LEMONMOD_0x851673) {
                  if (LEMONMOD_0x851673[_0xf97915] == "moomoo.io " + _0x23ed9e) {
                    _0x1ec9d2 = ![];
                  }
                }
                if (_0x1ec9d2) {
                  grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                    "action": "homepage"
                  }).then(function (_0x3027bc) {
                    _0x31751f(_0x41ab81 + "&token=" + encodeURIComponent(_0x3027bc), "moomoo.io " + _0x23ed9e);
                  });
                }
              } else {
                grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                  "action": "homepage"
                }).then(function (_0x51e8d5) {
                  _0x31751f(_0x41ab81 + "&token=" + encodeURIComponent(_0x51e8d5), "moomoo.io " + _0x23ed9e);
                });
              }
            } else var _0x52b342 = "aoijdoiawjd";
          }
        });
      }
      function _0x49293e() {
        fetch("https://dev.moomoo.io/serverData.js").then(_0x3e9ce1 => _0x3e9ce1.text()).then(_0x4b1bf2 => {
          let _0x53c229 = JSON.parse(_0x4b1bf2.split("=")[1].split(";")[0]);
          for (let _0x5eded4 of _0x53c229.servers) {
            let _0x510b69 = "wss://ip_" + _0x5eded4.ip + ".moomoo.io:8008/?gameIndex=0";
            let _0x2a331e = _0x5eded4.region.split(":")[1] + ":" + _0x5eded4.index + ":0";
            if (_0x5eded4.games[0].playerCount < 40) {
              if (LEMONMOD_0x851673[0]) {
                let _0x14072f = !![];
                for (let _0x7bba6 in LEMONMOD_0x851673) {
                  if (LEMONMOD_0x851673[_0x7bba6] == "dev.moomoo.io " + _0x2a331e) {
                    _0x14072f = ![];
                  }
                }
                if (_0x14072f) {
                  grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                    "action": "homepage"
                  }).then(function (_0x1ef631) {
                    _0x31751f(_0x510b69 + "&token=" + encodeURIComponent(_0x1ef631), "dev.moomoo.io " + _0x2a331e);
                  });
                }
              } else {
                grecaptcha.execute("6LevKusUAAAAAAFknhlV8sPtXAk5Z5dGP5T2FYIZ", {
                  "action": "homepage"
                }).then(function (_0x2716c4) {
                  _0x31751f(_0x510b69 + "&token=" + encodeURIComponent(_0x2716c4), "dev.moomoo.io " + _0x2a331e);
                });
              }
            } else var _0x52ad8e = "daubdiauwwa";
          }
        });
      }
      function _0x514bd9() {
        _0x60f663();
      }
      function _0x1ff7a1(_0x5875ad, _0x5137c6) {
        LEMONMOD_0x851673.push(_0x5137c6);
        _0x5875ad.emit(["sp", [{
          "name": "necromancer",
          "skin": 6,
          "moofoll": 1
        }]]);
        let _0xb26b79 = setInterval(() => {
          _0x5875ad.emit(["ch", ["I Shoot Niggas For Fun!"]]);
        }, 10);
        setTimeout(() => {
          clearInterval(_0xb26b79);
          _0x5875ad.freezeIntervals.push(setInterval(function () {
            if (!_0x5875ad || _0x5875ad.readyState !== 1) {
              return _0x5875ad.freezeIntervals.shift();
              _0x5875ad.close();
              LEMONMOD_0x851673.splice(LEMONMOD_0x851673.indexOf(_0x5137c6), 1);
              for (let _0x14213b in _0x5875ad.freezeIntervals) {
                clearInterval(_0x5875ad.freezeIntervals[_0x14213b]);
              }
              setTimeout(() => _0x292220(_0x5137c6.slice(0, _0x5137c6.indexOf(" ")), _0x5137c6.slice(_0x5137c6.indexOf(" ") + 1)), 5000);
            }
            _0x5875ad.emit(["ch", ["I Shoot Niggas For Fun!"]]);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
            _0x5875ad.oldSend(LEMONMOD_0x5a85b5, null);
          }));
        }, 500);
      }
      function _0x31751f(_0x451b70, _0x4dffe7) {
        let _0x4222bd = new WebSocket(_0x451b70);
        _0x4222bd.emit = _0x84dc4f => _0x4222bd.send(new Uint8Array(Array.from(LEMONMOD_0x5b0f86.encode(_0x84dc4f))));
        _0x4222bd.freezeIntervals = [];
        _0x4222bd.onopen = () => {
          _0x1ff7a1(_0x4222bd, _0x4dffe7);
        };
        _0x4222bd.onerror = () => {
          _0x4222bd.close();
        };
      }
      function _0x341031() {
        LEMONMOD_0x527c2c = prompt("New speed (Default 38, lower is faster):");
      }
      function _0x3d7c4b(_0x293857) {
        const _0x166752 = document.createElement("textarea");
        _0x166752.value = _0x293857;
        document.body.appendChild(_0x166752);
        _0x166752.select();
        document.execCommand("copy");
        document.body.removeChild(_0x166752);
      }
      function _0x1aa481() {
        _0x3d7c4b("DoNewSend Dictionary\n\ndns([6, [4]]) - Katana |\ndns([6, [15]]) - Musket |\ndns([6, [2]]) - Great Axe |\ndns([6, [24]]) - Poison Spikes |\ndns([6, [25]]) - Spinning Spikes |\ndns([6, [13]]) - Repeater Crossbow |\ndns([6, [12]]) - Crossbow |\ndns([6, [28]]) - Power Mill\n");
        alert("DoNewSend Dictionary\n\nThis has been copied to your clipboard; but you can also view it here.\n\ndns([6, [4]]) - Katana\ndns([6, [15]]) - Musket\ndns([6, [2]]) - Great Axe\ndns([6, [24]]) - Poison Spikes\ndns([6, [25]]) - Spinning Spikes\ndns([6, [13]]) - Repeater Crossbow\ndns([6, [12]]) - Crossbow\ndns([6, [28]]) - Power Mill");
      }
      function _0x181a1c() {
        _0x35285a([6, [4]]);
      }
      function _0x32e125() {
        _0x35285a([6, [15]]);
      }
      function _0x1a71b1() {
        _0x35285a(["6", [7]]);
        _0x35285a(["6", [17]]);
        _0x35285a(["6", [31]]);
        _0x35285a(["6", [23]]);
        _0x35285a(["6", [19]]);
        _0x35285a(["6", [10]]);
        _0x35285a(["6", [33]]);
        _0x35285a(["6", [4]]);
        _0x35285a(["6", [15]]);
      }
      function _0x3a425c(_0x200b8d) {
        if (!_0x124dac) {
          if (_0x200b8d != null) {
            _0x35285a(["ch", [_0x200b8d]]);
          }
        }
      }
      function _0x14bd40(_0x481425) {
        _0x3a425c(_0x481425);
      }
      function _0x10e170(_0x3c1fd1, _0x2f0831 = ![]) {
        if (document.getElementById("autoBuy").checked) {
          storeBuy(_0x3c1fd1, 1);
        }
        if (_0x2f0831) {
          storeEquip(0, 1);
        }
        LEMONMOD_0x2fc379 = _0x3c1fd1;
        storeEquip(_0x3c1fd1, 1);
      }
      function _0xfc5fd(_0x322d24) {
        if (!LEMONMOD_0x59d05f) {
          if (_0x322d24 == 1) {
            _0x322d24 = 11;
          }
          if (document.getElementById("autoBuy").checked) {
            storeBuy(_0x322d24);
          }
          LEMONMOD_0x7330ca = _0x322d24;
          storeEquip(_0x322d24);
        } else {
          storeEquip(22);
        }
      }
      function _0x524f3e() {
        let _0xa3991d = _0x15a8ba(1, 2);
        if (_0xa3991d == 1) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_break1);
        } else if (_0xa3991d == 2) {
          LEMONMOD_0x1a6d4a(LEMONMOD_0x547987.fn_break2);
        }
      }
      function _0x37ffb4(_0x44f096 = null) {
        if (LEMONMOD_0x45ba48 == _0x1c1eac) {
          if (_0x56267c >= Math.round(_0x283323 / 10)) {
            _0x56267c = 0;
            LEMONMOD_0x5bc078 = 0;
          }
        } else if (LEMONMOD_0x45ba48 == _0x363859) {
          if (_0x3c2b5f >= Math.round(_0x346955 / 10)) {
            _0x3c2b5f = 0;
            LEMONMOD_0xde5a9e = 0;
          }
        }
        if (_0x44f096 == null) {
          setTimeout(() => {
            _0x35285a(["c", [1]]);
          }, 0);
        } else {
          setTimeout(() => {
            _0x35285a(["c", [1, _0x44f096]]);
          }, 0);
        }
        ;
        setTimeout(() => {
          _0x35285a(["c", [0]]);
        }, 111);
        setTimeout(() => {
          if (LEMONMOD_0x509e10 == 45) {
            _0x524f3e();
          }
        }, 20);
      }
      function _0x12b203(_0x2e4b5f) {
        let _0x5224b2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2);
        if (document.getElementById("invisBuilds").checked) {
          _0x35285a(["5", [_0x2e4b5f, null]]);
          _0x35285a(["c", [1, _0x5224b2]]);
          _0x35285a(["c", [0, _0x5224b2]]);
          _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]);
        } else {
          _0x35285a(["5", [_0x2e4b5f, null]]);
          _0x35285a(["c", [1, _0x5224b2]]);
          _0x35285a(["c", [0, _0x5224b2]]);
          _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]);
        }
        ;
      }
      function _0xf98133(_0x278c55, _0x37b0a6) {
        return Math.floor(Math.random() * (_0x37b0a6 - _0x278c55 + 1)) + _0x278c55;
      }
      function _0x59f10c() {
        setTimeout(function () {
          var _0x240c36 = _0xf98133(1, 19);
          if (_0x240c36 == 1) {
            _0x3a425c("& LemonMod v3.0 - SiuJiHeal &");
          } else if (_0x240c36 == 2) {
            _0x3a425c("@ LemonMod v3.0 - SiuJiHeal @");
          } else if (_0x240c36 == 3) {
            _0x3a425c("# LemonMod v3.0 - SiuJiHeal #");
          } else if (_0x240c36 == 4) {
            _0x3a425c("$ LemonMod v3.0 - SiuJiHeal $");
          } else if (_0x240c36 == 5) {
            _0x3a425c("+ LemonMod v3.0 - SiuJiHeal +");
          } else if (_0x240c36 == 6) {
            _0x3a425c("% LemonMod v3.0 - SiuJiHeal %");
          } else if (_0x240c36 == 7) {
            _0x3a425c("= LemonMod v3.0 - SiuJiHeal =");
          } else if (_0x240c36 == 8) {
            _0x3a425c("- LemonMod v3.0 - SiuJiHeal -");
          } else if (_0x240c36 == 9) {
            _0x3a425c("~ LemonMod v3.0 - SiuJiHeal ~");
          } else if (_0x240c36 == 10) {
            _0x3a425c("! LemonMod v3.0 - SiuJiHeal !");
          } else if (_0x240c36 == 11) {
            _0x3a425c("? LemonMod v3.0 - SiuJiHeal ?");
          } else if (_0x240c36 == 12) {
            _0x3a425c("{ LemonMod v3.0 - SiuJiHeal }");
          } else if (_0x240c36 == 13) {
            _0x3a425c("} LemonMod v3.0 - SiuJiHeal {");
          } else if (_0x240c36 == 14) {
            _0x3a425c("[ LemonMod v3.0 - SiuJiHeal ]");
          } else if (_0x240c36 == 15) {
            _0x3a425c("] LemonMod v3.0 - SiuJiHeal [");
          } else if (_0x240c36 == 16) {
            _0x3a425c("< LemonMod v3.0 - SiuJiHeal >");
          } else if (_0x240c36 == 17) {
            _0x3a425c("> LemonMod v3.0 - SiuJiHeal <");
          } else if (_0x240c36 == 18) {
            _0x3a425c("* LemonMod v3.0 - SiuJiHeal *");
          } else if (_0x240c36 == 19) {
            _0x3a425c("^ LemonMod v3.0 - SiuJiHeal ^");
          }
          ;
        }, 1);
      }
      var _0x1f7467 = 100;
      var _0x57fe65 = 0;
      function _0x47f0cc(_0x2a470b, _0x3c9456 = _0x57fe65) {
        document.getElementById(_0x2a470b).style["background-color"] = "hsl(57, 100%, 50%)";
      }
      _0x47f0cc("ageBarBody");
      let _0x35383d = 57;
      let _0x41ef02 = setInterval(() => {
        if (CanvasRenderingContext2D.prototype.roundRect) {
          CanvasRenderingContext2D.prototype.roundRect = (_0x35a7ea => function () {
            if (this.fillStyle == "#8ecc51") this.fillStyle = "hsl(57, 100%, 50%)";
            return _0x35a7ea.call(this, ...arguments);
          })(CanvasRenderingContext2D.prototype.roundRect);
          clearInterval(_0x41ef02);
        }
      }, 100);
      function _0x4f1d74() {
        56 == LEMONMOD_0x388eda.hat ? (storeEquip(0), _0x35285a(["5", [_0x398fe5]]), _0x35285a(["c", [1, null]]), _0x35285a(["c", [0, null]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]), _0xfc5fd(56)) : (_0x35285a(["5", [_0x398fe5]]), _0x35285a(["c", [1, null]]), _0x35285a(["c", [0, null]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]])), _0x3671d5 && (56 == LEMONMOD_0x388eda.hat ? (storeEquip(0), _0x35285a(["5", [_0x398fe5]]), _0x35285a(["c", [1, null]]), _0x35285a(["c", [0, null]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]), _0xfc5fd(56)) : (_0x35285a(["5", [_0x398fe5]]), _0x35285a(["c", [1, null]]), _0x35285a(["c", [0, null]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]])));
      }
      function _0x55f082() {
        _0x12b203(_0x1fccfc, _0x458628 + _0x2eea8d(90)), _0x12b203(_0x1fccfc, _0x458628 - _0x2eea8d(90)), _0x12b203(_0x132077, _0x458628), _0x35285a(["33", [_0x458628]]);
      }
      function _0x470475() {
        var _0x35c9b7 = Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2);
        _0x12b203(_0x33a490, _0x35c9b7 + _0x2eea8d(144)), _0x12b203(_0x33a490, _0x35c9b7 + _0x2eea8d(144)), _0x12b203(_0x33a490, _0x35c9b7 + _0x2eea8d(72)), _0x12b203(_0x33a490, _0x35c9b7 + _0x2eea8d(72)), _0x12b203(_0x132077, _0x35c9b7), _0x35285a(["33", [_0x35c9b7]]);
      }
      ;
      var _0x477e12 = 1;
      function _0x15a8ba(_0x19aa0e, _0x26cc5e) {
        return Math.floor(Math.random() * _0x26cc5e) + _0x19aa0e;
      }
      _0x316774.observe(_0x4d93af, {
        "attributes": !1,
        "childList": !0,
        "subtree": !1
      });
      _0x3c89c4.addEventListener("mousedown", function (_0x3730da) {
        if (0 == _0x3730da.button) {
          _0x1ea770("left");
        } else if (2 == _0x3730da.button) {
          _0x1ea770("right");
        }
      }, !1);
      _0x3c89c4.addEventListener("mouseup", function (_0x405141) {
        if (0 == _0x405141.button) {
          _0x4ceabd("left");
        } else if (2 == _0x405141.button) {
          _0x4ceabd("right");
        }
      }, !1);
      var _0x5cb488 = function (_0x3a70de, _0xa2050e, _0x143dd6) {
          var _0x19f670 = !1,
            _0x3721ce = void 0;
          return {
            "start": function (_0xc2bb2f) {
              _0xc2bb2f == _0x3a70de && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x19f670 = !0, void 0 === _0x3721ce && (_0x3721ce = setInterval(function () {
                _0xa2050e(), _0x19f670 || (clearInterval(_0x3721ce), _0x3721ce = void 0);
              }, _0x143dd6)));
            },
            "stop": function (_0x1c5284) {
              _0x1c5284 == _0x3a70de && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && (_0x19f670 = !1);
            }
          };
        },
        _0x154111 = _0x5cb488(_0x1ab8a7, function () {
          _0x4f1d74(), _0x59f10c();
        }, LEMONMOD_0x527c2c),
        _0xfadc7 = _0x5cb488(_0x42e5d9, function () {
          if (_0x132077 == 15) {
            for (let _0x73340f = 0; _0x73340f < 4; _0x73340f++) {
              let _0x42493f;
              if (LEMONMOD_0x388eda.dir > 2 || LEMONMOD_0x388eda.dir < 0) {
                _0x42493f = 0 + _0x2eea8d(90 * _0x73340f);
              } else {
                _0x42493f = LEMONMOD_0x388eda.dir + _0x2eea8d(90 * _0x73340f);
              }
              _0x12b203(_0x132077, _0x42493f + 30);
            }
          } else {
            _0x12b203(_0x132077);
          }
        }, 0),
        _0xb8869b = _0x5cb488(_0x5486e8, function () {
          _0x12b203(_0x1fccfc);
        }, 0),
        _0x19a981 = _0x5cb488(_0x4d101a, function () {
          var _0x219f87 = Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2);
          _0x43c8cd ? _0x12b203(_0x33a490, _0x219f87) : (_0x219f87 = Math.round(_0x219f87 / _0x2eea8d(45)) * _0x2eea8d(45), _0x12b203(_0x33a490, _0x219f87 + Math.PI * 900000000), _0x12b203(_0x33a490, _0x2eea8d(90) + _0x219f87 + Math.PI * 900000000), _0x12b203(_0x33a490, _0x2eea8d(-90) + _0x219f87 + Math.PI * 900000000));
        }, 0),
        _0x2392ee = _0x5cb488(_0x2cfdb7, function () {
          _0x12b203(_0x10775b);
        }, 0),
        _0x1ee547 = _0x5cb488(_0x1ae038, _0x55f082, 50),
        _0x431143 = _0x5cb488(_0x2aea47, _0x470475, 250);
      function _0x1c7ce3(_0x25358e) {
        return null !== _0x25358e.offsetParent;
      }
      function _0x2eea8d(_0x4f6564) {
        return 0.01745329251 * _0x4f6564;
      }
      function _0x329e16(_0x6ec758, _0x185b71) {
        return Math.sqrt(Math.pow(_0x185b71.y - _0x6ec758[2], 2) + Math.pow(_0x185b71.x - _0x6ec758[1], 2));
      }
      function _0x37b258(_0x238ec3, _0x11750e) {
        return Math.sqrt(Math.pow(_0x11750e[2] - _0x238ec3[2], 2) + Math.pow(_0x11750e[1] - _0x238ec3[1], 2));
      }
      function _0x1e3cec() {
        for (var _0xe6f4f6 = 0; 9 > _0xe6f4f6; _0xe6f4f6++) _0x1c7ce3(document.getElementById("actionBarItem" + _0xe6f4f6.toString())) && (_0x1c1eac = _0xe6f4f6);
        for (var _0x56ea4c = 9; 16 > _0x56ea4c; _0x56ea4c++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x56ea4c.toString())) && (_0x363859 = _0x56ea4c);
        for (var _0xdd7729 = 16; 19 > _0xdd7729; _0xdd7729++) _0x1c7ce3(document.getElementById("actionBarItem" + _0xdd7729.toString())) && (_0x398fe5 = _0xdd7729 - 16);
        for (var _0x4b7e7a = 19; 22 > _0x4b7e7a; _0x4b7e7a++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x4b7e7a.toString())) && (_0x1328b4 = _0x4b7e7a - 16);
        for (var _0x328808 = 22; 26 > _0x328808; _0x328808++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x328808.toString())) && (_0x1fccfc = _0x328808 - 16);
        for (var _0x974e39 = 26; 29 > _0x974e39; _0x974e39++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x974e39.toString())) && (_0x33a490 = _0x974e39 - 16);
        for (var _0x312b6f = 29; 31 > _0x312b6f; _0x312b6f++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x312b6f.toString())) && (_0x38f5f1 = _0x312b6f - 16);
        for (var _0x5892c6 = 31; 33 > _0x5892c6; _0x5892c6++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x5892c6.toString())) && (_0x132077 = _0x5892c6 - 16);
        for (var _0x377220 = 33; 36 > _0x377220; _0x377220++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x377220.toString())) && (_0x10775b = _0x377220 - 16);
        for (var _0x31ac47 = 36; 37 > _0x31ac47; _0x31ac47++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x31ac47.toString())) && (_0x369283 = _0x31ac47 - 16);
        for (var _0x334934 = 37; 39 > _0x334934; _0x334934++) _0x1c7ce3(document.getElementById("actionBarItem" + _0x334934.toString())) && (_0x10775b = _0x334934 - 16);
      }
      function _0x58ca69(_0x28dc89) {
        if (!document.getElementById("invisBuilds").checked) {
          var _0x40daee = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2);
          _0x35285a(["5", [_0x28dc89, null]]), _0x35285a(["c", [1, _0x40daee]]), _0x35285a(["c", [0, _0x40daee]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]);
        } else {
          _0x40daee = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : Math.atan2(_0x4576af - _0x5e476a / 2, _0x245f80 - _0x336397 / 2);
          _0x40daee += Number.MAX_VALUE;
          _0x35285a(["5", [_0x28dc89, null]]), _0x35285a(["c", [1, _0x40daee]]), _0x35285a(["c", [0, _0x40daee]]), _0x35285a(["5", [LEMONMOD_0x45ba48, !0]]);
        }
        ;
      }
      let _0xe2efd2 = 0;
      let _0x1945c1 = 0;
      function _0x288059() {
        _0x35285a(["13c", [0, 11, 0]]), _0x35285a(["13c", [0, 21, 1]]), setTimeout(function () {
          _0x35285a(["13c", [0, 7, 0]]), _0x35285a(["13c", [0, 18, 1]]);
        }, 300), setTimeout(function () {
          _0x35285a(["13c", [0, 55, 0]]), _0x35285a(["13c", [0, 13, 1]]);
        }, 600), setTimeout(function () {
          _0x35285a(["13c", [0, 40, 0]]), _0x35285a(["13c", [0, 19, 1]]);
        }, 900), setTimeout(function () {
          _0x35285a(["13c", [0, 6, 0]]), _0x35285a(["13c", [0, 21, 1]]);
        }, 1200), setTimeout(function () {
          _0x35285a(["13c", [0, 26, 0]]), _0x35285a(["13c", [0, 13, 1]]);
        }, 1500), setTimeout(function () {
          _0x35285a(["13c", [0, 12, 0]]), _0x35285a(["13c", [0, 19, 1]]);
        }, 1800), setTimeout(function () {
          _0x35285a(["13c", [0, 21, 0]]), _0x35285a(["13c", [0, 18, 1]]);
        }, 2100), setTimeout(function () {
          _0x35285a(["13c", [0, 53, 0]]), _0x35285a(["13c", [0, 21, 1]]);
        }, 2500);
      }
      ;
      let _0x11ad42 = [10000000, 0, 9000, 100000000, 1000000000];
      function _0x413ae0() {
        return _0x11ad42[Math.floor(Math.random() * _0x11ad42.length)];
      }
      ;
      function _0x2c2b84(_0x49cbfd, _0x1b7da1) {
        var _0x230cec = _0x326446(_0x1f7538, arguments[2] || {});
        var _0x21d91c,
          _0x2d6695 = null;
        for (var _0x2eed65 in _0x4c7af9) {
          if (_0x4c7af9[_0x2eed65].test(_0x1b7da1)) {
            _0x2d6695 = _0x2eed65;
            break;
          }
        }
        if (!_0x2d6695) throw new SyntaxError("Only HTMLEvents and MouseEvents interfaces are supported");
        if (document.createEvent) {
          _0x21d91c = document.createEvent(_0x2d6695);
          if (_0x2d6695 == "HTMLEvents") {
            _0x21d91c.initEvent(_0x1b7da1, _0x230cec.bubbles, _0x230cec.cancelable);
          } else {
            _0x21d91c.initMouseEvent(_0x1b7da1, _0x230cec.bubbles, _0x230cec.cancelable, document.defaultView, _0x230cec.button, _0x230cec.pointerX, _0x230cec.pointerY, _0x230cec.pointerX, _0x230cec.pointerY, _0x230cec.ctrlKey, _0x230cec.altKey, _0x230cec.shiftKey, _0x230cec.metaKey, _0x230cec.button, _0x49cbfd);
          }
          _0x49cbfd.dispatchEvent(_0x21d91c);
        } else {
          _0x230cec.clientX = _0x230cec.pointerX;
          _0x230cec.clientY = _0x230cec.pointerY;
          var _0x4a2a91 = document.createEventObject();
          _0x21d91c = _0x326446(_0x4a2a91, _0x230cec);
          _0x49cbfd.fireEvent("on" + _0x1b7da1, _0x21d91c);
        }
        return _0x49cbfd;
      }
      function _0x326446(_0x147cab, _0x5c7bbb) {
        for (var _0x28cea7 in _0x5c7bbb) _0x147cab[_0x28cea7] = _0x5c7bbb[_0x28cea7];
        return _0x147cab;
      }
      var _0x4c7af9 = {
        "HTMLEvents": /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
        "MouseEvents": /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
      };
      var _0x1f7538 = {
        "pointerX": 0,
        "pointerY": 0,
        "button": 0,
        "ctrlKey": ![],
        "altKey": ![],
        "shiftKey": ![],
        "metaKey": ![],
        "bubbles": !![],
        "cancelable": !![]
      };
      function _0x96aa21(_0x30e24d, _0x3e3782) {
        let _0x9f1033 = "";
        let _0xce391f;
        if (_0x30e24d) {
          _0xce391f = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        } else {
          _0xce391f = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        }
        if (_0x30e24d) {
          _0xce391f = _0xce391f.padStart((70 - _0xce391f.length) / 6 + _0xce391f.length);
          _0xce391f = _0xce391f.padEnd(30);
        }
        let _0x20c8c8 = 0;
        for (let _0xa159d0 = 0; _0xa159d0 < _0xce391f.length; _0xa159d0++) {
          if (Math.floor(Math.random() * _0x3e3782) == 1 && _0xce391f.charAt(_0xa159d0) != "-" && _0x20c8c8 < 6 && _0xce391f.charAt(_0xa159d0) != " ") {
            _0x9f1033 += "";
            _0x20c8c8++;
          } else {
            _0x9f1033 += _0xce391f.charAt(_0xa159d0);
          }
        }
        return _0x9f1033;
      }
      function _0x1e0da2() {
        _0x35285a(["9", [null]]);
      }
      function _0x4314cd() {
        _0x35285a(["9", [null]]);
        _0x3a425c("LemonMod v3.0 - TeamKiller");
        setTimeout(function () {
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
        }, 10);
        setTimeout(function () {
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
          _0x35285a(["8", ["~DaRk~"]]);
        }, 500);
      }
      document.addEventListener("keydown", function (_0x40a833) {
        if (LEMONMOD_0x4a352c) {
          return ![];
        }
        if (_0x40a833.keyCode == 85 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          if (window.isDev == 1) {
            _0x35285a(["9", [null]]);
            _0x35285a(["9", [null]]);
            _0x35285a(["9", [null]]);
            _0x35285a(["9", [null]]);
            setTimeout(() => {
              _0x35285a(["8", ["1qA8g5b"]]);
              _0x35285a(["ch", ["?zOmGa92ghr26gU0n2gIdsa6hi4nCa"]]);
              setTimeout(() => {
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a(["ch", ["000000000000000000000000000000"]]);
              }, 200);
              setTimeout(() => {
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a(["ch", ["000000000000000000000000000000"]]);
              }, 300);
              setTimeout(() => {
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a(["ch", ["000000000000000000000000000000"]]);
              }, 400);
              setTimeout(() => {
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a(["ch", ["000000000000000000000000000000"]]);
              }, 500);
              setTimeout(() => {
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a([9, [null]]);
                _0x35285a(["ch", ["000000000000000000000000000000"]]);
              }, 600);
            }, 50);
          }
        }
        if (_0x40a833.keyCode == 179 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x4314cd();
        }
        if (LEMONMOD_0x388eda.object == -1 && _0x40a833.keyCode == 32 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x1ea770("right");
        }
        if (_0x40a833.keyCode == 46 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x3b7a10();
        }
        if (_0x40a833.keyCode == 35 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          LEMONMOD_0x2bddd0 = !![];
        }
        if (_0x40a833.keyCode == 188 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0xe2efd2 = (_0xe2efd2 + 1) % 2;
          if (_0xe2efd2 == 1) {
            LEMONMOD_0x262fc1.create("AutoMill: ON", "AutoMill has been enabled.", "https://lemonmod.com/img/Windmill.png", "fadeInRight", 2);
          } else {
            LEMONMOD_0x262fc1.create("AutoMill: OFF", "AutoMill has been disabled.", "https://lemonmod.com/img/Windmill.png", "fadeInRight", 2);
          }
        }
        ;
        if (_0x40a833.keyCode == 8 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          if (window.isDev) {
            _0x3a425c("LemonMod v3.0 - Dash!");
            setTimeout(function () {
              _0x12b203(_0x398fe5, _0x458628);
            }, 10);
            _0x12b203(_0x398fe5, _0x458628);
            _0x83059.oldSend(LEMONMOD_0x12a6d5);
            setTimeout(function () {
              _0x12b203(_0x398fe5, _0x458628);
            }, 100);
            _0x12b203(_0x398fe5, _0x458628);
          } else {
            _0x3a425c("Sorry, you can't do that!");
          }
        }
        if (document.getElementById("loadingText").innerHTML.includes("disconnected")) {
          if (LEMONMOD_0x32b091 = !0) {
            document.getElementById("loadingText").innerHTML = "Server Crashed!<a href=\"javascript:window.location.href=window.location.href\" class=\"ytLink\">Reconnect</a>";
          } else {
            document.getElementById("loadingText").innerHTML = "No Connection!<a href=\"javascript:window.location.href=window.location.href\" class=\"ytLink\">Reload</a>";
          }
        }
        if (_0x40a833.keyCode == 69 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          LEMONMOD_0x5c6332 = !LEMONMOD_0x5c6332;
          if (LEMONMOD_0x5c6332) {
            LEMONMOD_0x262fc1.create("AutoHit: ON", "AutoHit has been enabled.", "https://lemonmod.com/img/Sword.png", "fadeInRight", 2);
          } else {
            LEMONMOD_0x262fc1.create("AutoHit: OFF", "AutoHit has been disabled.", "https://lemonmod.com/img/Sword.png", "fadeInRight", 2);
          }
        }
        ;
        if (_0x40a833.keyCode == 88 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          LEMONMOD_0x228025 = !LEMONMOD_0x228025;
          if (LEMONMOD_0x228025) {
            LEMONMOD_0x262fc1.create("AimLock: ON", "AimLock has been enabled.", "https://lemonmod.com/img/Aim.png", "fadeInRight", 2);
          } else {
            LEMONMOD_0x262fc1.create("AimLock: OFF", "AimLock has been disabled.", "https://lemonmod.com/img/Aim.png", "fadeInRight", 2);
          }
        }
        ;
        if (_0x40a833.keyCode == 73 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x1945c1 = !_0x1945c1;
          if (_0x1945c1) {
            LEMONMOD_0x262fc1.create("EMP Mode: ON", "EMP Mode has been enabled.", "https://lemonmod.com/img/Emp.png", "fadeInRight", 2);
          } else {
            LEMONMOD_0x262fc1.create("EMP Mode: OFF", "EMP Mode has been disabled.", "https://lemonmod.com/img/Emp.png", "fadeInRight", 2);
          }
          ;
        }
        if (_0x40a833.keyCode == 190 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x477e12 = !_0x477e12;
          if (_0x477e12) {
            LEMONMOD_0x262fc1.create("360 Hit: ON", "360 Hit has been enabled.", "https://www.shareicon.net/data/512x512/2016/01/21/706486_arrows_512x512.png", "fadeInRight", 2);
          } else {
            LEMONMOD_0x262fc1.create("360 Hit: OFF", "360 Hit has been disabled.", "https://www.shareicon.net/data/512x512/2016/01/21/706486_arrows_512x512.png", "fadeInRight", 2);
          }
          ;
          LEMONMOD_0xd235ab = _0x477e12;
        }
        ;
        if (_0x40a833.keyCode == 220 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          if (document.getElementById("songCheck").checked) {
            _0x124dac = (_0x124dac + 1) % 2;
            if (_0x124dac == 1) {
              let _0x2d0898 = $("#song option:selected").text();
              LEMONMOD_0x262fc1.create("Now Playing: " + _0x2d0898, "You are now playing a song.", "https://www.freeiconspng.com/uploads/black-music-note-icon-4.png", "fadeInRight", 2);
              _0x108473(_0x12c002[parseInt($("#song").val())], 1400);
            } else {
              LEMONMOD_0x262fc1.create("Song: OFF", "You have stopped the song.", "https://www.freeiconspng.com/uploads/black-music-note-icon-4.png", "fadeInRight", 2);
            }
            ;
          }
        }
        ;
        _0xb8869b.start(_0x40a833.keyCode);
        _0x154111.start(_0x40a833.keyCode);
        _0xfadc7.start(_0x40a833.keyCode);
        _0x1ee547.start(_0x40a833.keyCode);
        _0x431143.start(_0x40a833.keyCode);
        _0x19a981.start(_0x40a833.keyCode);
        _0x2392ee.start(_0x40a833.keyCode);
        if (1 == _0x40a833.key && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          LEMONMOD_0x45ba48 = _0x1c1eac;
        } else if (2 == _0x40a833.key && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          LEMONMOD_0x45ba48 = _0x363859;
        }
        if (82 == _0x40a833.keyCode && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase()) && _0x32a8eb && !LEMONMOD_0x185e28) {
          if (!document.getElementById("autoInsta").checked) {
            _0x1268e6();
          } else {
            LEMONMOD_0xc547f4 = !LEMONMOD_0xc547f4;
          }
        }
      });
      document.addEventListener("keyup", function (_0x438bde) {
        if (LEMONMOD_0x388eda.object == -1 && _0x438bde.keyCode == 32 && !LEMONMOD_0x35bf68.includes(document.activeElement.id.toLowerCase())) {
          _0x4ceabd("right");
        }
        if (_0xb8869b.stop(_0x438bde.keyCode), _0xfadc7.stop(_0x438bde.keyCode), _0x1ee547.stop(_0x438bde.keyCode), _0x431143.stop(_0x438bde.keyCode), _0x19a981.stop(_0x438bde.keyCode), _0x2392ee.stop(_0x438bde.keyCode), _0x154111.stop(_0x438bde.keyCode), _0x438bde.keyCode == _0x1ae038 || _0x438bde.keyCode == _0x2aea47) for (var _0x5179b7 = 0; _0x5179b7 < 5; _0x5179b7++) setTimeout(function () {
          _0x35285a(["33", [null]]);
        }, 20 * _0x5179b7);
      });
    }
  }, 0);
}, 200);
