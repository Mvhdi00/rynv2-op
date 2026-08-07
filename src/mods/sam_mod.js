// ==UserScript==
// @name         Sam Mod
// @namespace    http://tampermonkey.net/
// @version      v698
// @author       e
// @description  Ñ ÑÐ´ÐµÐ»Ð°Ð» Ð¼ÐµÑ‚Ð¾Ð´ 14 Ð½Ð° Ð°Ð»Ð»Ð°Ñ…Ðµ
// @match        *://*.onrender.com/*
// @match        http://127.0.0.1:*/*
// @match        http://193.233.171.27:*/*
// @match        *://*.moomoo.io/*
// @require      https://energyaproton2.onrender.com/core/msgPack.js
// @grant        none
// ==/UserScript==

// pass 123
// streamer mode to false all visuals
const {sin: e, cos: t, min: i, max: s, random: n, floor: a, trunc: o, ceil: l, round: r, tan: h, PI: c, sqrt: d, abs: f, pow: u, log: p, LN2: m, atan2: g, SQRT2: b, acos: w, sign: M, hypot: y} = Math;

const {PI2: v = 2 * c} = {};

function k(e) {
    return document.getElementById(e);
}

window.oncontextmenu = e => e.preventDefault();

let x = window.config;

x.clientSendRate = 0, x.serverUpdateRate = 9, x.deathFadeout = 0, x.isPrivateServer = "127.0.0.1" == window.location.hostname || "localhost" == window.location.hostname || window.location.hostname.includes("mohmoh-js.onrender.com"),
x.isSandbox = "sandbox-dev.moomoo.io" === window.location.hostname || "sandbox.moomoo.io" === window.location.hostname || x.isPrivateServer,
x.skinColors = [ "#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373", "#91b2db" ],
x.weaponVariants = [ {
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
}, {
    id: 4,
    src: "_e",
    poison: !0,
    heal: !0,
    xp: 24e3,
    val: 1.18
} ];

const O = "undefined" != typeof localStorage;

const S = {
    save(e, t) {
        O && localStorage.setItem(e, t);
    },
    delete(e) {
        O && localStorage.removeItem(e);
    },
    get: e => O ? localStorage.getItem(e) : null
};

const I = {
    doBuildingHealth: !1,
    doStabilizing360Hit: !0,
    doAutoResyncBTick: !0,
    doAutoDodge: !0,
    doDamageAssociation: !0,
    doAutoPushOnBullspam: !1,
    doMillSpins: !1,
    doTurretReloadBars: !1,
    doRenderWeaponRanges: !1,
    doRenderExpectedPos: !1,
    doEnemyArrows: !0,
    doRegularGrid: !1,
    doShowEnemyMessages: !0,
    doAntiDHtoKMInsta: !0,
    doAntiTurretSpam: !0,
    doFactorTurretDamage: !0,
    doAntiTurretSpamTeleport: !1,
    doFast2v1Heals: !0,
    doPingCompensationHeals: !0,
    doAutoQOnHighPing: !0,
    doAutoQOnSync: !0,
    doFactorExternalSpikeReboundDamage: !0,
    doAutoSoldier: !0,
    doAutoSoldierInRiver: !1,
    doAutoKnockbackAnti: !0,
    doAnti1Tick: !0,
    doAutoShieldAnti: !0,
    doFlagThornsDamage: !0,
    doAntiRangedInstas: !0,
    doEnemyWeaponAssumptions: !0,
    doSoldierEmpAntiInsta: !0,
    doPreemptiveSoldierEMP: !0,
    doSoldierAntiInsta: !0,
    doSensitiveAntiRanged: !0,
    doAnyBullspamPlacements: !0,
    doTrapBreakOutplaces: !0,
    doTripleTelePlacements: !1,
    doIgnoreBuildInstaChecks: !1,
    doPredictBuildHealthForPrePlace: !1,
    doAntiTrap: !0,
    doInfiniteRangeTracers: !0,
    doQuadTrapsForHotkey: !1,
    doPlacementsOnBreakerHit: !0,
    doPlaceInvisBuilds: !0,
    doGlobalAutoSpikeInsta: !1,
    doAutoBullspamToInsta: !1,
    doHitProcessToInsta: !0,
    doPlacementsOnIdleBullspamTicks: !0,
    doBullspamRetrapOnHits: !0,
    doAutoSpikeInstaOnBullspam: !0,
    doBullspamHitsOnBullTick: !0,
    doTickBasedInstas: !0,
    doBackup6050InstaOnTurretFailure: !0,
    doPredictiveAntibull: !0,
    doAutoAntibull: !0,
    doAntiAntibull: !0,
    doStopInstaOnShield: !0,
    doReverseInstaForShameLeak: !0,
    doTwoTickKatanaShot: !1,
    doDHKHInsta: !0,
    doAgeInsta: !0,
    doKatanaHammerInsta: !0,
    doAntiMultiboxInsta: !0,
    doSkidTick: !0,
    doTribeInstakill: !1,
    doWSSync: !0,
    doAutoGG: !0,
    doChatMirror: !1,
    doAntiChatMirror: !1,
    doAutoTrapAnimals: !0,
    doAutoBuy: !!x.isSandbox,
    doAutoSpawn: !0,
    doBullEquipOnEnableBullOverrides: !0,
    doMapPingsOnR: !1,
    doMapPingsOnMapClick: !1
};

const D = S.get("configs") ? {
    ...I,
    ...JSON.parse(S.get("configs"))
} : {
    ...I
};

const T = () => {
    S.save("configs", JSON.stringify(D));
};

window.updateShowingConfig = () => {
    const e = k("config");
    k("configCheck").checked = D[e.value];
}, window.updateConfig = () => {
    const e = k("config").value;
    D[e] = !D[e], T();
};

const A = (e = 1) => "<br>".repeat(e), P = (e, t, i, s) => `<input type="text" id="${e}" size="${i}" value="${t}" maxlength="${s}">`, H = (e, t, i, s = !1) => `${s ? `${t} ` : ""}<input type="checkbox" ${i ? "checked" : ""} class="checkB" id="${e}">${s ? "" : ` ${t}`}`, C = (e, t, i = "", s = "") => `<button class="${s}" id="${e}" onclick="${i}">${t}</button>`, B = (e, t, i = "min-width: 172px;") => `<select id="${e}" style="${i}">${t.map(e => `<option value="${e.value}" ${e.selected ? "selected" : ""}>${e.name}</option>`).join("")}</select>`, R = (e, t, i, s) => `<input type="text" id="${e}" size="${i}" value="${t}" maxlength="${s}"><input type="checkbox" checked class="checkB" id="${e}k">`, _ = (e = "", t = "", i = {}, s = "", n = "!function(){}()", a = "!function(){}()") => `<select class="select" id="${e}" style="min-width: 172px;" oninput="${n}">${Object.keys(i).map(e => `<option ${e === s ? "selected" : ""} value="${e}">${e}</option>`).join("")}</select><label class="switch"><input type="checkbox" class="checkB" id="${t}" ${i[s] ? "checked" : ""} onclick="${a}"><span class="slider round"></span></label>`;

T();

const N = e => {
    var t;
    [ "homeTab", "miscTab", "configTab", "combatTab" ].forEach(e => k(e).style.display = "none"),
    [ "tHome", "t1", "t2", "t3" ].forEach(e => Object.assign(k(e).style, {
        border: "2px solid transparent",
        color: "#fff",
        backgroundColor: "#000"
    })), Object.assign(k(e.id).style, {
        color: "#000",
        backgroundColor: "#fff",
        border: "2px solid #000"
    }), k((t = e.id, {
        tHome: "homeTab",
        t1: "miscTab",
        t2: "configTab",
        t3: "combatTab"
    }[t] || "homeTab")).style.display = "block";
};

const E = Object.assign(document.createElement("div"), {
    id: "modMenus",
    style: "\n        display: none;\n        padding: 10px;\n        background: rgba(0, 0, 0, 0.25);\n        border-radius: 4px;\n        position: absolute;\n        left: 20px;\n        top: 20px;\n        min-width: 300px;\n        max-width: 410px;\n        min-height: 400;\n        max-height 400px;\n        transition: 1s;\n    "
});

document.body.append(E);

const z = [ {
    name: "Walls",
    value: "1"
}, {
    name: "Spikes",
    value: "2"
}, {
    name: "Windmills",
    value: "3",
    selected: !0
}, {
    name: "Trap / Boosts",
    value: "4"
}, {
    name: "Teleport / Turrets",
    value: "5"
} ];

const q = [ {
    name: "Increment NB Count",
    value: "incr"
}, {
    name: "Reset NB Count",
    value: "reset"
} ];

const F = [ {
    name: "0",
    value: 0
}, {
    name: "+1",
    value: 1
}, {
    name: "+2",
    value: 2
} ];

E.innerHTML = `\n        <style>\n            * { outline: none }\n            .tabchange {\n                color: #fff;\n                background: #000;\n                border: 2px solid transparent;\n                border-radius: 4px;\n                text-align: center;\n                height: 25px;\n            }\n            .menuTabs { padding: 5px; }\n            .holder { padding-left: 1em; }\n            .sizing, .mod { font-size: 15px; }\n            .mod { display: inline-block; }\n\n            .checkB {\n            position: relative;\n            top: 2px;\n            accent-color: #4285F4;\n            cursor: pointer;\n            }\n            .fixSelect {\n\n            }\n            .augh {\n                display: inline-block;\n                width: 25px;\n                height: 25px;\n                background-size: cover;\n                background-color: #fff;\n                margin-right: -2.5px;\n                opacity: 0.4;\n            }\n        </style>\n        <div id="headline" style="font-size: 30px; color: #fff;">\n            <div class="menuTabs">\n                ${C("tHome", "Home", "changeDisp(this)", "tabchange")}\n                ${C("t1", "1", "changeDisp(this)", "tabchange")}\n                ${C("t2", "2", "changeDisp(this)", "tabchange")}\n                ${C("t3", "3", "changeDisp(this)", "tabchange")}\n            </div>\n            <div style="font-size: 12px; overflow-y: scroll; max-height: 150px;">\n                <div id="homeTab" style="display: block">\n                    <div id="priXP">0 / not found</div>\n                    <div id="secXP">0 / not found</div>\n                    <div id="healer">Healer: High Ping</div>\n                </div>\n                <div id="miscTab" style="display: none">\n                    Synt to ${P("syncChat", "Sync", "20", "30")}<br>\n                    Create clan: ${P("ccv", "clan", "20", "7")}<br>\n                    ${C("ccf", "Create clan", "window.CreateClan()", "nothing")}<br>\n\n                    ${C("PlaceEveryTickTogl", "Toggle PlaceEveryTick", "", "nothing")} | <span id = "placestatus">true</span><br>\n\n                    ${B("autoupgrade", [ {
    name: "Autoupgrade to DH",
    value: "dh"
}, {
    name: "Autoupgrade to PH",
    value: "ph"
}, {
    name: "Autoupgrade to KH",
    value: "kh"
}, {
    name: "Autoupgrade to SM",
    value: "sm"
} ])} ${H("aeaeaeaeUpgrade", "", !!x.isPrivateServer)}<br>\n\n                    Disable autoupgrade cycling? ${H("autoUpgradeStopper", "", !1)}<br>\n\n                    7-Slot: ${B("7slot", [ {
    name: "Teleporter",
    value: "38"
}, {
    name: "Blocker",
    value: "37"
}, {
    name: "Healing pad",
    value: "35"
}, {
    name: "Platform",
    value: "34"
}, {
    name: "Turret",
    value: "33"
} ])}<br>\n                </div>\n                <div id="configTab" style="display: none">\n                    ${_("config", "configCheck", D, Object.keys(D)[0], "window.updateShowingConfig()", "window.updateConfig()")}<br>\n\n                    <div id="freeCam">Freecam: none</div>\n\n                    Freecam hotkey: ${R("freecamKey", "/", "2", "1")}<br>\n                    Debug hotkey: ${R("debugkey", "Z", "2", "1")}<br>\n                    Bot connector hotkey: ${R("botkey", "G", "2", "1")}<br>\n\n                    One-tick hotkey: ${R("OTkey", "g", "2", "1")}<br>\n\n                    No-bull management hotkey: ${R("nbHotkeyValue", "T", "2", "1")}<br>\n                    ^ No Bull MGMT action: ${B("nbACT", q, "min-width: max-content;")}<br>\n                    ^ No Bull MGMT increment amount: ${B("addedNBcount", F, "min-width: max-content;")}<br>\n\n                    Advanced placer hotkey: ${R("millkey", "z", "2", "1")}<br>\n                    Zoom hotkey: ${R("zoomkey", "-", "2", "1")}<br>\n                    Zoom reset hotkey: ${R("zoomresetkey", "=", "2", "1")}<br>\n                    Song hotkey: ${R("songkey", "C", "2", "1")}<br>\n\n                    Song: ${B("songs", [ {
    name: "CRVN - Nobody",
    value: "1"
}, {
    name: "Dave Rodgers - Ae86",
    value: "2"
}, {
    name: "Dr Love - Don't Stand So Close",
    value: "3"
}, {
    name: "Domastic - Heartless",
    value: "4"
}, {
    name: "PVRIS - Burn It All Down",
    value: "5"
}, {
    name: "Crypt x Joey Nato - Invincible",
    value: "6",
    selected: !0
} ])}<br>\n                    ${H("showch", "sendChatPacket", !0, !0)}<br>\n                    Ratio hotkey: ${R("nerdSpam", "o", "2", "1")}<br>\n                </div>\n                <div id="combatTab" style="display: none">\n                    Object for the placer: ${B("placeType", z, "min-width: max-content;")}${A(2)}\n\n                    One-way: ${C("streamer", "Streamer Mode", "window.streamerMode()", "nothing")}${A(2)}\n                    farm\n                    <div class="holder">\n                        ${H("grind", "autoRuby", !1)}<br>\n                        ${H("grindsec", "autoRubySec", !0)}<br>\n                    </div>\n                    anti\n                    <div class="holder">\n                        ${[ "soldieranti", "soldierempanti", "antitick", "antirange" ].map(e => H(e, e.replace(/^soldieremp/, "soldierEmp").replace(/^anti/, "anti").replace(/anti$/, "AntiInsta"), !0)).join("<br>")}\n                    </div>\n                    autoBreak\n                    <div class="holder">\n                        ${H("earlyab", "early", !0)}<br>\n                        earlyWaitTime<br>\n                        ${P("earlytime", "10", "6", "5")}<br>\n                        ${H("abactive", "activate", !0)}<br>\n                        ${H("ab360hit", "breakitems360", !1)}<br>\n                    </div>\n                    autoTrigger\n                    <div class="holder">\n                        ${H("sync", "syncShots", !1)}<br>\n                        syncThrottle<br>\n                        ${P("synccount", "1", "6", "2")}<br>\n                    </div>\n                    autoQ\n                    <div class="holder">\n                        ${H("evautoq", "alwaysOn", !1)}<br>\n                    </div>\n                    placement\n                    <div class="holder">\n                        ${H("prepl", "autoPrelace", !0)}<br>\n                        ${H("replc", "autoReplace", !0)}<br>\n                        ${H("autoplc", "autoPlace", !0)}<br>\n                    </div>\n                </div>\n            </div>\n        </div>\n    `,
N(k("tHome")), [ "tHome", "t1", "t2", "t3" ].forEach(e => k(e).onclick = () => N(k(e)));

let j = !1;

window.CreateClan = function() {
    j = !j, !0 === j ? Y("L", k("ccv").value) : Y("N", "");
};

let G = !0;

k("PlaceEveryTickTogl").onclick = function() {
    G = !G;
};

let L = !1;

let W;

window.streamerMode = () => {
    L = !L;
};

let K = new class {
    constructor() {
        this.count = 0, this.maxCount = 0, this.time = 1e3, this.firstSend = !1;
    }
    secUpdate() {
        this.firstSend || (this.firstSend = !0, setTimeout(() => {
            this.firstSend = !1, this.count = 0;
        }, this.time)), this.count++, this.count > this.maxCount && (this.maxCount = this.count);
    }
};

let V = {
    tick: 0,
    tickQueue: [],
    tickBase: function(e, t) {
        this.tickQueue[this.tick + t] ? this.tickQueue[this.tick + t].push(e) : this.tickQueue[this.tick + t] = [ e ];
    },
    tickRate: 1e3 / x.serverUpdateRate,
    tickSpeed: 0,
    lastTick: performance.now()
};

const X = [ "cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard" ];

let U;

let Q;

class J {
    static translateEvents=new Map([ [ "P", "11" ], [ "Q", "12" ], [ "b", "10" ], [ "L", "8" ], [ "N", "9" ], [ "c", "13c" ], [ "6", "ch" ], [ "e", "rmd" ], [ "F", "c" ], [ "9", "33" ], [ "K", "7" ], [ "S", "14" ], [ "z", "5" ], [ "M", "sp" ], [ "H", "6" ], [ "D", "2" ], [ "0", "pp" ] ]);
    static privServerEvents={
        id: es,
        1: ts,
        2: is,
        4: os,
        33: Cs,
        5: _s,
        6: zs,
        a: qs,
        aa: Fs,
        7: js,
        8: Gs,
        sp: Ls,
        9: Ws,
        h: rs,
        11: hs,
        12: bs,
        13: ws,
        14: cs,
        15: ds,
        16: fs,
        17: Ks,
        18: Vs,
        19: Xs,
        an: Us,
        st: Qs,
        sa: Js,
        us: Zs,
        ch: tn,
        mm: sn,
        t: nn,
        p: Cn,
        pp: Ot
    };
    static serverEvents={
        A: es,
        C: ts,
        D: is,
        E: os,
        a: Cs,
        G: _s,
        H: zs,
        I: qs,
        J: Fs,
        K: js,
        L: Gs,
        M: Ls,
        N: Ws,
        O: rs,
        P: hs,
        Q: bs,
        R: ws,
        S: cs,
        T: ds,
        U: fs,
        V: Ks,
        X: Vs,
        Y: Xs,
        2: Us,
        3: Qs,
        4: Js,
        5: Zs,
        6: tn,
        7: sn,
        8: nn,
        9: Cn,
        0: Ot
    };
    static events=x.isPrivateServer ? this.privServerEvents : this.serverEvents;
    static getMessage(e) {
        let t = new Uint8Array(e.data);
        let i = window.msgpack.decode(t);
        let s = i[0];
        t = i[1];
        let n = this.events;
        "io-init" == s || n[s] && n[s].apply(void 0, t);
    }
    static translateMessageType(e) {
        for (let [t, i] of this.translateEvents) if (i === e) return t;
        return e;
    }
    static lastDir=0;
    static lastSend=0;
    static dontSend=!1;
    static sendMessage(e, t) {
        this.dontSend = !1;
        let i = new Uint8Array(t);
        let s = window.msgpack.decode(i);
        let n = s[0];
        i = s[1];
        let a = x.isPrivateServer ? this.translateMessageType(n) : n;
        if (!x.isPrivateServer && K.count > 120 || ("6" == a ? i[0] && (i[0] = X.reduce((e, t) => {
            if (e.includes(t)) {
                const i = t[0] + '\0' + t.slice(1);
                return e.replaceAll(t, i);
            }
            return e;
        }, i[0]), i[0] = i[0].slice(0, 30)) : "L" == a ? (i[0] = i[0] + String.fromCharCode(0).repeat(7),
        i[0] = i[0].slice(0, 7)) : "M" == a ? (i[0].name = "" == i[0].name ? "unknown" : i[0].name,
        i[0].moofoll = !0, i[0].skin = "__proto__", Q = [ i[0].name, i[0].moofoll, i[0].skin ]) : "D" == a ? this.lastDir == i[0] || [ null, void 0 ].includes(i[0]) ? this.dontSend = !0 : this.lastDir = i[0] : "F" == a ? i[2] ? [ null, void 0 ].includes(i[1]) || (this.lastDir = i[1]) : this.dontSend = !0 : "K" == a ? i[1] || (this.dontSend = !0) : "S" == a ? this.dontSend = !0 : "9" == a && (i[1] ? (oe.moveDir == i[0] && (this.dontSend = !0),
        oe.moveDir = i[0], oe.lastMoveTime = Date.now()) : this.dontSend = !0)), !this.dontSend && a) {
            let t = window.msgpack.encode([ n, i ]);
            this.lastSend = n, e.nsend(t), K.secUpdate();
        }
    }
}

function Y(e) {
    if (!e[0]) return;
    let t = [].slice.call(arguments, 1);
    const i = x.isPrivateServer && J.translateEvents.get(e) || e;
    let s = window.msgpack.encode([ i, t ]);
    W.send(s);
}

WebSocket.prototype.nsend = WebSocket.prototype.send, WebSocket.prototype.send = function(e) {
    W || (W = this, W.addEventListener("message", function(e) {
        J.getMessage(e);
    }), W.addEventListener("close", e => {
        4001 == e.code && window.location.reload();
    })), W == this ? J.sendMessage(W, e) : this.nsend(e);
};

let Z = [];

let ee = [];

let te = [];

let ie = [];

let se = [];

let ne = [];

let ae = [];

let oe;

let le;

let re;

let he = [];

let ce;

let de = [];

let fe = [];

let ue = [];

let pe = [];

let me = [];

document.querySelector("#gameCanvas").remove();

let ge = document.createElement("canvas");

let be = ge.getContext("2d");

ge.id = "canvas", ge.style = "background-color: #b6db66; z-index: 1;", document.body.appendChild(ge);

const we = (e, t) => e.find(e => e.id == t);

const Me = (e, t) => e.find(e => e.sid == t);

const ye = e => we(ee, e);

const ve = e => Me(ee, e);

const ke = e => Me(Z, e);

const xe = e => Me(ne, e);

[ "#adCard", "#promoImgHolder", ".fc-ccpa-root", "#wideAdCard", "#pre-content-container", "#videoad", "#ot-sdk-btn-floating" ].forEach(e => {
    document.querySelectorAll(e).forEach(e => e.remove());
});

k("gameName");

const Oe = k("diedText");

k("desktopInstructions").innerHTML = "\n    Movement: W,  A, S, D<br>\n    Toggle Menu: ESC<br>\n    InstaKill: R<br>\n    <br>\n    Mouse:<br>\n    Left: Bull<br>\n    Middle: Range<br>\n    Right: Tank<br>\n";

const Se = k("guideCard");

Se.style.height = "415px", Se.style.maxHeight = "700px";

const Ie = k("setupCard");

const De = document.createElement("div");

De.id = "newPassword", Ie.appendChild(De), De.style.display = x.isPrivateServer ? "block" : "none",
De.innerHTML = "<br><input type = \"password\" id = \"password\" placeholder = \"Enter Pass\" maxlength = \"30\">";

const Te = k("password");

Te.style = "\n    text-align: center;\n    font-size: 26px;\n    padding: 6px;\n    border: none;\n    outline: none;\n    box-sizing: border-box;\n    color: #4A4A4A;\n    background-color: #e5e3e3;\n    width: 100%;\n    -webkit-border-radius: 4px;\n    -moz-border-radius: 4px;\n    border-radius: 4px;\n";

const Ae = document.getElementById("altcha");

const $e = document.getElementById("altcha_checkbox");

const Pe = document.getElementById("enterGame");

Pe.classList.add("disabled"), Pe.style.color = "#CCC", Pe.style.backgroundColor = "#666",
Pe.style.pointerEvents = "none", Te.addEventListener("input", function() {
    "123" === Te.value ? (Pe.classList.remove("disabled"), Pe.style.color = "", Pe.style.backgroundColor = "",
    Pe.style.pointerEvents = "auto") : (Pe.classList.add("disabled"), Pe.style.color = "#CCC",
    Pe.style.backgroundColor = "#666", Pe.style.pointerEvents = "none");
});

const He = k("mapDisplay");

const Ce = He.getContext("2d");

He.width = 300, He.height = 300;

const Be = k("storeMenu");

k("storeHolder");

const Re = k("allianceMenu");

const _e = k("upgradeHolder");

const Ne = k("upgradeCounter");

const Ee = k("chatHolder");

k("chatBox");

const ze = k("allianceButton");

const qe = k("storeButton");

k("chatButton").remove();

const Fe = k("leaderboard");

const je = k("leaderboardData");

const Ge = k("itemInfoHolder");

const Le = k("resDisplay");

const We = k("scoreDisplay");

const Ke = k("foodDisplay");

const Ve = k("woodDisplay");

const Xe = k("stoneDisplay");

const Ue = k("killCounter");

k("actionBar");

let Qe;

let Je;

let Ye = x.maxScreenWidth;

let Ze = x.maxScreenHeight;

let et;

let tt;

let it = performance.now();

let st;

let nt;

let at;

let ot = 0;

let lt = 0;

let rt = 1;

let ht = 0;

const ct = "#525252";

const dt = "#3d3f42";

const ft = 5.5;

const ut = {
    animationTime: 0,
    land: null,
    lava: null,
    x: x.volcanoLocationX,
    y: x.volcanoLocationY
};

let pt = !1;

let mt = !0;

let gt = {};

let bt = {
    87: [ 0, -1 ],
    38: [ 0, -1 ],
    83: [ 0, 1 ],
    40: [ 0, 1 ],
    65: [ -1, 0 ],
    37: [ -1, 0 ],
    68: [ 1, 0 ],
    39: [ 1, 0 ]
};

let wt = 0;

let Mt = !1;

let yt = !0;

window.onblur = function() {
    yt = !1;
}, window.onfocus = function() {
    yt = !0;
};

let vt = !1;

let kt = null;

window.addEventListener("load", () => {
    if (x.isPrivateServer) return;
    Pe.textContent = "Generate...";
    Ae.addEventListener("statechange", t => {
        "verified" === t?.detail?.state && (kt = t.detail.payload, Pe.textContent = "Enter Game",
        De.style.display = "block", clearInterval(e));
    });
    const e = setInterval(() => {
        kt || (Pe.classList.contains("disabled") && !vt ? (vt = !0, Ae.style.display = "none",
        $e.click(), setTimeout(() => {
            vt = !1;
        }, 1e3)) : Pe.classList.contains("disabled") || (Pe.textContent = "Enter Game"));
    }, 1e3);
}), Array.prototype.filter2 = function(e) {
    const t = [];
    for (let i = 0; i < this.length; i++) {
        const s = this[i];
        e(s) && t.push(s);
    }
    return t;
}, Array.prototype.find2 = function(e) {
    for (let t = 0; t < this.length; t++) {
        const i = this[t];
        if (e(i)) return i;
    }
};

let xt = {
    avg: 0,
    max: 0,
    min: 0,
    last: 0
};

function Ot() {
    let e = window.pingTime;
    if (null !== xt.last) {
        let t = Math.abs(e - xt.last);
        e > 120 && t > 40 && oe && At.showText(oe.x, oe.y, 35, .3, 800, "ping spike", "#f00");
    }
    xt.last = e, xt.max = isNaN(xt.max) ? e : Math.max(xt.max, e), xt.min = isNaN(xt.min) ? e : Math.min(xt.min, e),
    xt.avg = Math.floor([ (window.pingTime + xt.max + xt.min) / 3 ]);
}

let St = new class {
    constructor() {
        let e = Math.abs, t = (Math.cos, Math.sin, Math.pow, Math.sqrt), i = Math.atan2, s = Math.hypot, n = Math.PI;
        let a = this;
        this.getBiome = function(e) {
            const {mapScale: t, riverWidth: i, snowBiomeTop: s} = x;
            const n = t / 2;
            return e >= n - i / 2 && e <= n + i / 2 ? 4 : e >= n + i / 2 && e <= t - s ? 3 : e >= t - s ? 2 : e <= s ? 1 : 0;
        }, this.round = function(e, t) {
            return Math.round(e * t) / t;
        }, this.toRad = function(e) {
            return e * (n / 180);
        }, this.toAng = function(e) {
            return e / (n / 180);
        }, this.randInt = function(e, t) {
            return Math.floor(Math.random() * (t - e + 1)) + e;
        }, this.randFloat = function(e, t) {
            return Math.random() * (t - e + 1) + e;
        }, this.lerp = function(e, t, i) {
            return e + (t - e) * i;
        }, this.decel = function(e, t) {
            return e > 0 ? e = Math.max(0, e - t) : e < 0 && (e = Math.min(0, e + t)), e;
        }, this.dot = function(e, t, i) {
            return (e.x * t + e.y * i) / (e.x * i - e.y * t);
        }, this.calcPoint = function(e, t, i, s) {
            return {
                x: e += s * Math.cos(i),
                y: t += s * Math.sin(i)
            };
        }, this.getDist2 = function(e, t) {
            const i = e.x - t.x;
            const s = e.y - t.y;
            return i * i + s * s;
        }, this.collisionDetection = function(e, i, s) {
            return t((e.x - i.x) ** 2 + (e.y - i.y) ** 2) < s;
        }, this.getdist = function(e, t, i = "", n = "") {
            return s(e[`x${i || ""}`] - t[`x${n || ""}`], e[`y${i || ""}`] - t[`y${n || ""}`]);
        }, this.getDistance = function(e, i, s, n) {
            return t((s -= e) * s + (n -= i) * n);
        }, this.getDirection = function(e, t, s, n) {
            return i(t - n, e - s);
        }, this.getDist = function(e, t, i = 0, s = 0) {
            return y(e[`x${i || ""}`] - t[`x${s || ""}`], e[`y${i || ""}`] - t[`y${s || ""}`]);
        }, this.getDirect = function(e, t, i = 0, s = 0) {
            return g(e[`y${i || ""}`] - t[`y${s || ""}`], e[`x${i || ""}`] - t[`x${s || ""}`]);
        }, this.findMiddlePoint = function(e, t) {
            return {
                x: ((e.x2 || e.x) + (t.x2 || t.x)) / 2,
                y: ((e.y2 || e.y) + (t.y2 || t.y)) / 2
            };
        }, this.calculatePosition = function(e, t, i) {
            return {
                x: (e.x2 || e.x) + Math.cos(i) * t,
                y: (e.y2 || e.y) + Math.sin(i) * t
            };
        }, this.createObject = function(e, t, i) {
            const s = $t.list[e];
            const n = 35 + s.scale + (s.placeOffset || 0);
            return {
                x: (i ? oe.xVel : oe.x2) + n * Math.cos(t),
                y: (i ? oe.yVel : oe.y2) + n * Math.sin(t),
                scale: s.scale
            };
        }, this.getAngleDist = function(t, i) {
            let s = e(i - t) % (2 * n);
            return s > n ? 2 * n - s : s;
        }, this.isNumber = function(e) {
            return "number" == typeof e && !isNaN(e) && isFinite(e);
        }, this.isString = function(e) {
            return e && "string" == typeof e;
        }, this.kFormat = function(e) {
            return e > 999 ? (e / 1e3).toFixed(1) + "k" : e;
        }, this.sFormat = function(e) {
            const t = [ {
                threshold: 1e12,
                suffix: "q"
            }, {
                threshold: 1e9,
                suffix: "b"
            }, {
                threshold: 1e6,
                suffix: "m"
            }, {
                threshold: 1e3,
                suffix: "k"
            } ].find(t => e >= t.threshold);
            return t ? (e / t.threshold).toFixed(1) + t.suffix : e.toString();
        }, this.capitalizeFirst = function(e) {
            return e.charAt(0).toUpperCase() + e.slice(1);
        }, this.fixTo = function(e, t) {
            return parseFloat(e.toFixed(t));
        }, this.sortByPoints = function(e, t) {
            return parseFloat(t.points) - parseFloat(e.points);
        }, this.lineInCircle = function(e, t, i, s, n, a, o) {
            let l = i - e, r = s - t;
            let h = ((n - e) * l + (a - t) * r) / (l * l + r * r);
            let c = {
                x: e + h * l,
                y: t + h * r
            };
            if (c.x >= Math.min(e, i) && c.x <= Math.max(e, i) && c.y >= Math.min(t, s) && c.y <= Math.max(t, s)) return St.getDistance(c.x, c.y, n, a) < o;
        }, this.intersectsLineCircle = function(e, t, i) {
            let s = t.x - e.x;
            let n = t.y - e.y;
            let a = e.x - i.x;
            let o = e.y - i.y;
            let l = i.scale + 20;
            let r = s * s + n * n;
            let h = 2 * (a * s + o * n);
            let c = h * h - 4 * r * (a * a + o * o - l * l);
            if (c < 0) return !1;
            c = Math.sqrt(c);
            let d = (-h - c) / (2 * r);
            let f = (-h + c) / (2 * r);
            return d >= 0 && d <= 1 || f >= 0 && f <= 1;
        }, this.lineInRect = function(e, t, i, s, n, a, o, l) {
            let r = n;
            let h = o;
            if (n > o && (r = o, h = n), h > i && (h = i), r < e && (r = e), r > h) return !1;
            let c = a;
            let d = l;
            let f = o - n;
            if (Math.abs(f) > 1e-7) {
                let e = (l - a) / f;
                let t = a - e * n;
                c = e * r + t, d = e * h + t;
            }
            if (c > d) {
                let e = d;
                d = c, c = e;
            }
            return d > s && (d = s), c < t && (c = t), !(c > d);
        }, this.replaceInvalid = function(e, t = "0") {
            return null == e || Number.isNaN(Number(e)) ? t || 0 : e;
        }, this.containsPoint = function(e, t, i) {
            let s = e.getBoundingClientRect();
            let n = s.left + window.scrollX;
            let a = s.top + window.scrollY;
            let o = s.width;
            let l = s.height;
            return t > n && t < n + o && (i > a && i < a + l);
        }, this.mousifyTouchEvent = function(e) {
            let t = e.changedTouches[0];
            e.screenX = t.screenX, e.screenY = t.screenY, e.clientX = t.clientX, e.clientY = t.clientY,
            e.pageX = t.pageX, e.pageY = t.pageY;
        }, this.hookTouchEvents = function(e, t) {
            let i = !t;
            let s = !1;
            let n = !1;
            function o(t) {
                a.mousifyTouchEvent(t), window.setUsingTouch(!0), i && (oe.preventDefault(), oe.stopPropagation()),
                s && (e.onclick && e.onclick(t), e.onmouseout && e.onmouseout(t), s = !1);
            }
            e.addEventListener("touchstart", this.checkTrusted(function(t) {
                a.mousifyTouchEvent(t), window.setUsingTouch(!0), i && (oe.preventDefault(), oe.stopPropagation());
                e.onmouseover && e.onmouseover(t);
                s = !0;
            }), n), e.addEventListener("touchmove", this.checkTrusted(function(t) {
                a.mousifyTouchEvent(t), window.setUsingTouch(!0), i && (oe.preventDefault(), oe.stopPropagation());
                a.containsPoint(e, oe.pageX, oe.pageY) ? s || (e.onmouseover && e.onmouseover(t),
                s = !0) : s && (e.onmouseout && e.onmouseout(t), s = !1);
            }), n), e.addEventListener("touchend", this.checkTrusted(o), n), e.addEventListener("touchcancel", this.checkTrusted(o), n),
            e.addEventListener("touchleave", this.checkTrusted(o), n);
        }, this.removeAllChildren = function(e) {
            for (;e.hasChildNodes(); ) e.removeChild(e.lastChild);
        }, this.generateElement = function(e) {
            let t = document.createElement(e.tag || "div");
            function i(i, s) {
                e[i] && (t[s] = e[i]);
            }
            i("text", "textContent"), i("html", "innerHTML"), i("class", "className");
            for (let i in e) {
                switch (i) {
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
                t[i] = e[i];
            }
            if (t.onclick && (t.onclick = this.checkTrusted(t.onclick)), t.onmouseover && (t.onmouseover = this.checkTrusted(t.onmouseover)),
            t.onmouseout && (t.onmouseout = this.checkTrusted(t.onmouseout)), e.style && (t.style.cssText = e.style),
            e.hookTouch && this.hookTouchEvents(t), e.parent && e.parent.appendChild(t), e.children) for (let i = 0; i < e.children.length; i++) t.appendChild(e.children[i]);
            return t;
        }, this.checkTrusted = function(e) {
            return function(t) {
                t && t instanceof Event && (!t || "boolean" != typeof t.isTrusted || t.isTrusted) && e(t);
            };
        }, this.randomString = function(e) {
            let t = "";
            let i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (let s = 0; s < e; s++) t += i.charAt(Math.floor(62 * Math.random()));
            return t;
        }, this.countInArray = function(e, t) {
            let i = 0;
            for (let s = 0; s < e.length; s++) e[s] === t && i++;
            return i;
        }, this.hexToRgb = function(e) {
            return e.slice(1).match(/.{1,2}/g).map(e => parseInt(e, 16));
        }, this.getRgb = function(e, t, i) {
            return [ e / 255, t / 255, i / 255 ].join(", ");
        };
    }
};

function It(e, t, i) {
    const s = "player" === i ? -63 : "object" === i ? -t?.scale : 0;
    return n = (e.x2 || e.x) - (t.x2 || t.x), a = (e.y2 || e.y) - (t.y2 || t.y), Math.sqrt(n * n + a * a) + s;
    var n, a;
}

let Dt = new class {
    constructor() {
        this.rangeAddOnCache = {};
    }
    canShoot(e, t, i = 1e6) {
        return !ae.some(s => s.sid !== i && (1e6 === i || s.layer >= 1) && !s.ignoreCollision && St.intersectsLineCircle(e, t, s));
    }
    reloadPercent(e, t) {
        if (53 == t) return 1 - e.reloads[53] / 2500;
        if (!$t.weapons[t]) return 1;
        let i = $t.weapons[t].speed;
        return 1 - e.reloads[t] / i;
    }
    weaponDmg(e, t, i = 1, s = 1) {
        const {primaryVariant: n, weapons: [a]} = e;
        const o = n ? x.weaponVariants[n].val : 1;
        const l = 6 === t?.skinIndex && i ? .75 : 1;
        const r = s ? Rt.get(oe.skinIndex)?.dmgMultO ?? e.skin?.dmgMultO ?? 1 : 1;
        const h = s ? _t.get(oe.tailIndex)?.dmgMultO ?? e.tail?.dmgMultO ?? 1 : 1;
        return $t.weapons[a].dmg * r * h * o * l;
    }
    weaponBuildDmg(e, t, i) {
        const s = $t.weapons[t];
        const n = t < 9 ? "primaryVariant" : "secondaryVariant";
        const a = x.weaponVariants[e[n]];
        const o = i && e.skins[40] || 40 === e.skinIndex ? 3.3 : 1;
        return s.dmg * (a.val || 1) * (s.sDmg || 1) * o;
    }
    spikeTickDamage(e) {
        let t = $t.list[oe.items[2]];
        const i = this.weaponDmg(oe, e, 0, 1);
        const s = oe.skins[53] && 0 === oe.reloads[53] ? 25 : 0;
        return (t.dmg + i + s) * (6 === e.skinIndex ? .75 : 1);
    }
    canHit(e = 0, t = oe, i) {
        const s = t.weapons[e];
        const n = $t.weapons[s].range + 63;
        return St.getDist(i, t, 0, 2) <= n && t.reloads[s] <= V.tickRate;
    }
    calculateWeaponDamage(e, t) {
        const i = $t.weapons[e];
        return i ? i.projectile ? i.dmg : i.dmg * x.weaponVariants[t].val : 0;
    }
    getNextTickRangeAddOn(e, t) {
        let i = this.rangeAddOnCache[e + ":" + t];
        if (!i) {
            let s = Ct.find(t => t.id == e);
            let n = Ht.find(e => e.id == t);
            let a = oe.weaponIndex;
            let o = ($t.weapons[a].spdMult || 1) * (s && s.spdMult || 1) * (n && n.spdMult || 1);
            i = this.rangeAddOnCache[e + ":" + t] = x.serverUpdateSpeed / 2 * o;
        }
        return i || 0;
    }
    replaceable(e) {
        let t = c;
        let i = c / 12;
        let s = $t.list[15].scale + 30;
        for (let n = 0; n < fe.length; n++) {
            let a = fe[n];
            if (a && St.getDist(a, oe, 0, 2) <= 160) for (let n = 0; n <= t; n += i) {
                let i = St.calculatePosition(a, s, n);
                if (Et.checkItemLocation(i.x, i.y, 52, .6, !1, !1, e) || (i = St.calculatePosition(a, s, n + t),
                Et.checkItemLocation(i.x, i.y, 52, .6, !1, !1, e))) return !0;
            }
        }
        return !1;
    }
    healthToHits(e, t) {
        const i = $t.weapons[t];
        const s = i.projectile ? 0 : i.dmg;
        const n = (x.weaponVariants[oe.weaponVariant]?.val || 1) * (i.sDmg || 1) * (oe.skins[40] ? 3.3 : 1);
        return Math.ceil(e / (s * n));
    }
    inRange(e, t, i, s) {
        return It(e, t, "player") <= i || s && It(e?.vel?.real, t?.vel?.real, "player") <= i;
    }
    inHitRange(e, t) {
        return St.getAngleDist(e, t) <= x.gatherAngle;
    }
    getNear(e) {
        de.sort((t, i) => St.getDist(e, t, 0, 2) - St.getDist(e, i, 0, 2))[0];
    }
};

class Tt {
    constructor() {
        this.init = function(e, t, i, s, n, a, o) {
            this.x = e, this.y = t, this.color = o, this.scale = i, this.startScale = this.scale,
            this.maxScale = 1.5 * i, this.scaleSpeed = .7, this.speed = s, this.life = n, this.text = a,
            this.acc = 1, this.maxLife = n;
        }, this.update = function(e) {
            this.life && (this.life -= e, this.y -= this.speed * e, this.scale += this.scaleSpeed * e,
            this.scale >= this.maxScale ? (this.scale = this.maxScale, this.scaleSpeed *= -1) : this.scale <= this.startScale && (this.scale = this.startScale,
            this.scaleSpeed = 0), this.life <= 0 && (this.life = 0));
        }, this.render = function(e, t, i) {
            e.lineWidth = 10, e.fillStyle = this.color, e.font = this.scale + "px Hammersmith One",
            e.fillText(this.text, this.x - t, this.y - i), e.globalAlpha = 1;
        };
    }
}

let At = new class {
    constructor() {
        this.texts = [], this.update = function(e, t, i, s) {
            t.textBaseline = "middle", t.textAlign = "center";
            for (let n = 0; n < this.texts.length; ++n) this.texts[n].life && (this.texts[n].update(e),
            this.texts[n].render(t, i, s));
        }, this.showText = function(e, t, i, s, n, a, o) {
            let l;
            for (let e = 0; e < this.texts.length; ++e) if (!this.texts[e].life) {
                l = this.texts[e];
                break;
            }
            l || (l = new Tt, this.texts.push(l)), l.init(e, t, i, s, n, a, o);
        };
    }
};

let $t = new class {
    constructor() {
        this.groups = [ {
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
            place: !0,
            limit: 7,
            sandboxLimit: 299,
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
            limit: 12,
            sandboxLimit: 299,
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
            limit: 2,
            sandboxLimit: 299,
            layer: -1
        } ], this.projectiles = [ {
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
        } ], this.weapons = [ {
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
            req: [ "wood", 4 ],
            length: 120,
            width: 120,
            xOff: -6,
            yOff: 0,
            Pdmg: 25,
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
            Pdmg: 10,
            spdMult: .88,
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
            shield: .2,
            xOff: 6,
            yOff: 0,
            Pdmg: 0,
            spdMult: .7
        }, {
            id: 12,
            type: 1,
            age: 8,
            pre: 9,
            name: "crossbow",
            desc: "deals more damage and has greater range",
            src: "crossbow_1",
            req: [ "wood", 5 ],
            aboveHand: !0,
            armS: .75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            Pdmg: 35,
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
            req: [ "wood", 10 ],
            aboveHand: !0,
            armS: .75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            Pdmg: 30,
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
            Pdmg: 0,
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
            req: [ "stone", 10 ],
            aboveHand: !0,
            rec: .35,
            armS: .6,
            hndS: .3,
            hndD: 1.6,
            length: 205,
            width: 205,
            xOff: 25,
            yOff: 0,
            Pdmg: 50,
            projectile: 5,
            hideProjectile: !0,
            spdMult: .6,
            speed: 1500
        } ], this.list = [ {
            group: this.groups[0],
            name: "apple",
            desc: "restores 20 health when consumed",
            req: [ "food", 10 ],
            consume: function(e) {
                return e.changeHealth(20, e);
            },
            scale: 22,
            holdOffset: 15,
            healing: 20,
            itemID: 0,
            itemAID: 16
        }, {
            age: 3,
            group: this.groups[0],
            name: "cookie",
            desc: "restores 40 health when consumed",
            req: [ "food", 15 ],
            consume: function(e) {
                return e.changeHealth(40, e);
            },
            scale: 27,
            holdOffset: 15,
            healing: 40,
            itemID: 1,
            itemAID: 17
        }, {
            age: 7,
            group: this.groups[0],
            name: "cheese",
            desc: "restores 30 health and another 50 over 5 seconds",
            req: [ "food", 25 ],
            consume: function(e) {
                return !!(e.changeHealth(30, e) || e.health < 100) && (e.dmgOverTime.dmg = -10,
                e.dmgOverTime.doer = e, e.dmgOverTime.time = 5, !0);
            },
            scale: 27,
            holdOffset: 15,
            healing: 30,
            itemID: 2,
            itemAID: 18
        }, {
            group: this.groups[1],
            name: "wood wall",
            desc: "provides protection for your village",
            req: [ "wood", 10 ],
            projDmg: !0,
            health: 380,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 3,
            itemAID: 19
        }, {
            age: 3,
            group: this.groups[1],
            name: "stone wall",
            desc: "provides improved protection for your village",
            req: [ "stone", 25 ],
            health: 900,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 4,
            itemAID: 20
        }, {
            age: 7,
            group: this.groups[1],
            name: "castle wall",
            desc: "provides powerful protection for your village",
            req: [ "stone", 35 ],
            health: 1500,
            scale: 52,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 5,
            itemAID: 21
        }, {
            group: this.groups[2],
            name: "spikes",
            desc: "damages enemies when they touch them",
            req: [ "wood", 20, "stone", 5 ],
            health: 400,
            dmg: 20,
            scale: 49,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 6,
            itemAID: 22
        }, {
            age: 5,
            group: this.groups[2],
            name: "greater spikes",
            desc: "damages enemies when they touch them",
            req: [ "wood", 30, "stone", 10 ],
            health: 500,
            dmg: 35,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 7,
            itemAID: 23
        }, {
            age: 9,
            group: this.groups[2],
            name: "poison spikes",
            desc: "poisons enemies when they touch them",
            req: [ "wood", 35, "stone", 15 ],
            health: 600,
            dmg: 30,
            pDmg: 5,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 8,
            itemAID: 24
        }, {
            age: 9,
            group: this.groups[2],
            name: "spinning spikes",
            desc: "damages enemies when they touch them",
            req: [ "wood", 30, "stone", 20 ],
            health: 500,
            dmg: 45,
            turnSpeed: .003,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 9,
            itemAID: 25
        }, {
            group: this.groups[3],
            name: "windmill",
            desc: "generates gold over time",
            req: [ "wood", 50, "stone", 10 ],
            health: 400,
            pps: 1,
            turnSpeed: .0016,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 45,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 10,
            itemAID: 26
        }, {
            age: 5,
            group: this.groups[3],
            name: "faster windmill",
            desc: "generates more gold over time",
            req: [ "wood", 60, "stone", 20 ],
            health: 500,
            pps: 1.5,
            turnSpeed: .0025,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 11,
            itemAID: 27
        }, {
            age: 8,
            group: this.groups[3],
            name: "power mill",
            desc: "generates more gold over time",
            req: [ "wood", 100, "stone", 50 ],
            health: 800,
            pps: 2,
            turnSpeed: .005,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 12,
            itemAID: 28
        }, {
            age: 5,
            group: this.groups[4],
            type: 2,
            name: "mine",
            desc: "allows you to mine stone",
            req: [ "wood", 20, "stone", 100 ],
            iconLineMult: 12,
            scale: 65,
            holdOffset: 20,
            placeOffset: 0,
            itemID: 13,
            itemAID: 29
        }, {
            age: 5,
            group: this.groups[11],
            type: 0,
            name: "sapling",
            desc: "allows you to farm wood",
            req: [ "wood", 150 ],
            iconLineMult: 12,
            colDiv: .5,
            scale: 110,
            holdOffset: 50,
            placeOffset: -15,
            itemID: 14,
            itemAID: 30
        }, {
            age: 4,
            group: this.groups[5],
            name: "pit trap",
            desc: "pit that traps enemies if they walk over it",
            req: [ "wood", 30, "stone", 30 ],
            trap: !0,
            ignoreCollision: !0,
            hideFromEnemy: !0,
            health: 500,
            colDiv: .2,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            alpha: .6,
            itemID: 15,
            itemAID: 31
        }, {
            age: 4,
            group: this.groups[6],
            name: "boost pad",
            desc: "provides boost when stepped on",
            req: [ "stone", 20, "wood", 5 ],
            ignoreCollision: !0,
            boostSpeed: 1.5,
            health: 150,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 16,
            itemAID: 32
        }, {
            age: 7,
            group: this.groups[7],
            doUpdate: !0,
            name: "turret",
            desc: "defensive structure that shoots at enemies",
            req: [ "wood", 200, "stone", 150 ],
            health: 800,
            projectile: 1,
            shootRange: 700,
            shootRate: 2200,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 17,
            itemAID: 33
        }, {
            age: 7,
            group: this.groups[8],
            name: "platform",
            desc: "platform to shoot over walls and cross over water",
            req: [ "wood", 20 ],
            ignoreCollision: !0,
            zIndex: 1,
            canPathMove: !0,
            health: 300,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 18,
            itemAID: 34
        }, {
            age: 7,
            group: this.groups[9],
            name: "healing pad",
            desc: "standing on it will slowly heal you",
            req: [ "wood", 30, "food", 10 ],
            ignoreCollision: !0,
            canPathMove: !0,
            healCol: 15,
            health: 400,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 19,
            itemAID: 35
        }, {
            age: 9,
            group: this.groups[10],
            name: "spawn pad",
            desc: "you will spawn here when you die but it will dissapear",
            req: [ "wood", 100, "stone", 100 ],
            health: 400,
            ignoreCollision: !0,
            canPathMove: !0,
            spawnPoint: !0,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 20,
            itemAID: 36
        }, {
            age: 7,
            group: this.groups[12],
            name: "blocker",
            desc: "blocks building in radius",
            req: [ "wood", 30, "stone", 25 ],
            ignoreCollision: !0,
            canPathMove: !0,
            blocker: 300,
            health: 400,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 21,
            itemAID: 37
        }, {
            age: 7,
            group: this.groups[13],
            name: "teleporter",
            desc: "teleports you to a random point on the map",
            req: [ "wood", 60, "stone", 60 ],
            ignoreCollision: !0,
            teleport: !0,
            health: 200,
            colDiv: .7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 22,
            itemAID: 38
        } ], this.checkItem = {
            index: function(e, t) {
                return [ 0, 1, 2 ].includes(e) ? 0 : [ 3, 4, 5 ].includes(e) ? 1 : [ 6, 7, 8, 9 ].includes(e) ? 2 : [ 10, 11, 12 ].includes(e) ? 3 : [ 13, 14 ].includes(e) ? 5 : [ 15, 16 ].includes(e) ? 4 : [ 17, 18, 19, 21, 22 ].includes(e) ? [ 13, 14 ].includes(t) ? 6 : 5 : 20 == e ? [ 13, 14 ].includes(t) ? 7 : 6 : void 0;
            }
        };
        for (let e = 0; e < this.list.length; ++e) this.list[e].id = e, this.list[e].pre && (this.list[e].pre = e - this.list[e].pre);
    }
};

let Pt = new class {
    constructor() {
        this.hats = [ {
            id: 45,
            name: "Shame!",
            dontSell: !0,
            price: 0,
            scale: 120,
            desc: "hacks are for winners"
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
        } ], this.accessories = [ {
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
        } ];
    }
};

let Ht = Pt.accessories;

let Ct = Pt.hats;

let Bt = Ct.filter(e => e.price < 100).map(e => e.id);

const Rt = new Map(Ct.map(e => [ e.id, e ]));

const _t = new Map(Ht.map(e => [ e.id, e ]));

class Nt {
    constructor(e) {
        this.sid = e, this.init = function(e, t, i, s, n, a, o) {
            a = a || {}, this.sentTo = {}, this.gridLocations = [], this.active = !0, this.alive = !0,
            this.doUpdate = a.doUpdate, this.x = e, this.y = t, this.dir = i, this.lastDir = i,
            this.xWiggle = 0, this.yWiggle = 0, this.scale = s, this.realScale = this.type <= 1 && null !== this.type ? .6 * this.scale : this.scale,
            this.type = n, this.id = a.id, this.owner = o, this.name = a.name, this.isItem = null != this.id,
            this.group = a.group, this.maxHealth = a.health, this.health = this.maxHealth, this.buildHealth = a.health,
            this.layer = 2, null != this.group ? this.layer = this.group.layer : 0 == this.type ? this.layer = 3 : 2 == this.type ? this.layer = 0 : 4 == this.type && (this.layer = -1),
            this.colDiv = a.colDiv || 1, this.blocker = a.blocker, this.ignoreCollision = a.ignoreCollision,
            this.dontGather = a.dontGather, this.hideFromEnemy = a.hideFromEnemy, this.friction = a.friction,
            this.projDmg = a.projDmg, this.dmg = a.dmg, this.pDmg = a.pDmg, this.pps = a.pps,
            this.zIndex = a.zIndex || 0, this.turnSpeed = a.turnSpeed, this.req = a.req, this.trap = a.trap,
            this.healCol = a.healCol, this.teleport = a.teleport, this.boostSpeed = a.boostSpeed,
            this.projectile = a.projectile, this.shootRange = a.shootRange, this.shootRate = a.shootRate,
            this.shootCount = this.shootRate, this.spawnPoint = a.spawnPoint, this.onNear = 0,
            this.breakObj = !1, this.alpha = a.alpha || 1, this.maxAlpha = a.alpha || 1, this.damaged = 0;
        }, this.changeHealth = function(e, t) {
            return this.health += e, this.health <= 0;
        }, this.getScale = function(e, t) {
            return e = e || 1, this.scale * (this.isItem || 2 == this.type || 3 == this.type || 4 == this.type ? 1 : .6 * e) * (t ? 1 : this.colDiv);
        }, this.visibleToPlayer = function(e) {
            return !this.hideFromEnemy || this.owner && (this.owner == e || this.owner.team && e.team == this.owner.team);
        }, this.update = function(e) {
            if (this.active && (this.xWiggle && (this.xWiggle *= Math.pow(.99, e)), this.yWiggle && (this.yWiggle *= Math.pow(.99, e)),
            D.doMillSpins && this.turnSpeed && (this.dir += this.turnSpeed * e), this.hideFromEnemy && this.isTeamObject(oe))) for (let e of de) {
                St.getDist({
                    x: this.x,
                    y: this.y
                }, e, 0, 2) < this.scale + e.scale - 37 && (this.hideFromEnemy = !1);
            }
        }, this.isTeamObject = function(e) {
            return null == this.owner || (this.owner && e.sid == this.owner.sid || e.findAllianceBySid(this.owner.sid));
        }, this.dmgObject = function(e, t) {
            if (1 === this.type && this.y >= 12e3) return !0;
            const i = t ? !this.isTeamObject(t) : !this.isTeamObject(oe);
            return this.dmg && i;
        };
    }
}

let Et = new class {
    constructor() {
        Math.floor, Math.abs, Math.cos, Math.sin, Math.pow, Math.sqrt;
        let e;
        this.ignoreAdd = !1, this.hitObj = [], this.disableObj = function(e) {
            e.active = !1;
        }, this.add = function(t, i, s, n, a, o, l, r, h) {
            e = xe(t), e || (e = ne.find(e => !e.active), e || (e = new Nt(t), ne.push(e))),
            r && (e.sid = t), e.init(i, s, n, a, o, l, h);
        }, this.closeObjects = function() {
            const e = 1200;
            const t = 144e4;
            if (ae = [], Array.isArray(ne) && oe) for (const i of ne) {
                if (!i?.active || "function" != typeof i?.update) continue;
                if (5 === i.type) {
                    ae.push(i);
                    continue;
                }
                let s = (i.x || i.x2) - oe.x2;
                let n = (i.y || i.y2) - oe.y2;
                Math.abs(s) <= e && Math.abs(n) <= e && s * s + n * n <= t ? ae.push(i) : Vi.active && (s = (i.x || i.x2) - st,
                n = (i.y || i.y2) - nt, Math.abs(s) <= e && Math.abs(n) <= e && s * s + n * n <= t && ae.push(i));
            }
        }, this.disableBySid = function(e) {
            let t = xe(e);
            t && this.disableObj(t);
        }, this.removeAllItems = function(e, t) {
            ne.filter(t => t.active && t.owner && t.owner.sid == e).forEach(e => this.disableObj(e));
        }, this.checkItemLocation = function(e, t, i, s, n, a, o, l) {
            if (!a && 18 != n && t >= x.mapScale / 2 - x.riverWidth / 2 && t <= x.mapScale / 2 + x.riverWidth / 2) return !1;
            for (let n = 0; n < ae.length; n++) {
                let a = ae[n];
                if (a.active) if (5 === a.type) {
                    let s = i + a.scale;
                    if (Math.abs(e - a.x) < s && Math.abs(t - a.y) < s && (!o || (o.length ? !o.find(e => e.sid == a.sid) : o.sid != a.sid))) return !!l && a;
                } else {
                    let n = a.blocker ? a.blocker : a.getScale(s, a.isItem);
                    if (St.getDistance(e, t, a.x, a.y) < i + n && (!o || (o.length ? !o.find(e => e.sid == a.sid) : o.sid != a.sid))) return !!l && a;
                }
            }
            return !0;
        }, this.checkCollisionToObject = function(e, t) {
            let i = e.x2 - t.x;
            let s = e.y2 - t.y;
            let n = 35 + (t.realScale ? t.realScale : t.scale);
            if (Math.abs(i) <= n || Math.abs(s) <= n) {
                if (n = 35 + (t.getScale ? t.getScale() : t.scale), Math.sqrt(i * i + s * s) - n <= 0) return t.zIndex > e.zIndex && (t.zIndex = e.zIndex),
                !0;
            }
            return !1;
        }, this.canHit = function(e, t, i, s = 0) {
            return St.getDist(e, t, 2, 0) <= $t.weapons[i].range + t.scale + s;
        };
    }
};

class zt {
    constructor(e, t, i, s, n, a) {
        this.init = function(e, t, i, s, n, a, o, l, r) {
            this.active = !0, this.tickActive = !0, this.indx = e, this.x = t, this.y = i, this.x2 = t,
            this.y2 = i, this.dir = s, this.skipMov = !0, this.speed = n, this.dmg = a, this.scale = l,
            this.range = o, this.r2 = o, this.owner = r;
        }, this.update = function(e) {
            if (this.active) {
                let t = this.speed * e;
                this.skipMov ? this.skipMov = !1 : (this.x += t * Math.cos(this.dir), this.y += t * Math.sin(this.dir),
                this.range -= t, this.range <= 0 && (this.x += this.range * Math.cos(this.dir),
                this.y += this.range * Math.sin(this.dir), t = 1, this.range = 0, this.active = !1));
            }
        }, this.tickUpdate = function(e) {
            if (this.tickActive) {
                let t = this.speed * e;
                this.skipMov ? this.skipMov = !1 : (this.x2 += t * Math.cos(this.dir), this.y2 += t * Math.sin(this.dir),
                this.r2 -= t, this.r2 <= 0 && (this.x2 += this.r2 * Math.cos(this.dir), this.y2 += this.r2 * Math.sin(this.dir),
                t = 1, this.r2 = 0, this.tickActive = !1));
            }
        };
    }
}

let qt = new class {
    constructor() {
        this.addProjectile = function(e, t, i, s, n, a, o, l, r, h) {
            let c = $t.projectiles[a];
            let d;
            for (let e = 0; e < se.length; ++e) if (!se[e].active) {
                d = se[e];
                break;
            }
            return d || (d = new zt(ee, Z, Et, $t, x, St), d.sid = se.length, se.push(d)), d.init(a, e, t, i, n, c.dmg, s, c.scale, o),
            d.ignoreObj = l, d.layer = r || c.layer, d.inWindow = h, d.src = c.src, d;
        };
    }
};

let Ft = new class {
    constructor(e, t) {
        this.aiTypes = [ {
            id: 0,
            src: "cow_1",
            killScore: 150,
            health: 500,
            weightM: .8,
            speed: 95e-5,
            turnSpeed: .001,
            scale: 72,
            drop: [ "food", 50 ]
        }, {
            id: 1,
            src: "pig_1",
            killScore: 200,
            health: 800,
            weightM: .6,
            speed: 85e-5,
            turnSpeed: .001,
            scale: 72,
            drop: [ "food", 80 ]
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
            drop: [ "food", 100 ]
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
            drop: [ "food", 400 ]
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
            drop: [ "food", 200 ]
        }, {
            id: 5,
            name: "Quack",
            src: "chicken_1",
            dmg: 8,
            killScore: 2e3,
            noTrap: !0,
            health: 300,
            weightM: .2,
            speed: .0018,
            turnSpeed: .006,
            scale: 70,
            drop: [ "food", 100 ]
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
            drop: [ "food", 100 ]
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
            drop: [ "food", 1e3 ]
        }, {
            id: 9,
            name: "\ud83d\udc80MOOFIE",
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
            drop: [ "food", 3e3 ],
            minSpawnRange: .85,
            maxSpawnRange: .9
        }, {
            id: 10,
            name: "\ud83d\udc80Wolf",
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
            drop: [ "food", 400 ],
            minSpawnRange: .85,
            maxSpawnRange: .9
        }, {
            id: 11,
            name: "\ud83d\udc80Bully",
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
            drop: [ "food", 800 ],
            minSpawnRange: .85,
            maxSpawnRange: .9
        } ], this.spawn = function(i, s, n, a) {
            let o = e.find(e => !e.active);
            return o || (o = new t(e.length, St, x), e.push(o)), o.init(i, s, n, a, this.aiTypes[a]),
            o;
        };
    }
}(Z, class {
    constructor(e, t, n) {
        this.sid = e, this.isAI = !0, this.nameIndex = t.randInt(0, n.cowNames.length - 1),
        this.init = function(e, t, i, s, n) {
            this.x = e, this.y = t, this.startX = n.fixedSpawn ? e : null, this.startY = n.fixedSpawn ? t : null,
            this.xVel = 0, this.yVel = 0, this.zIndex = 0, this.dir = i, this.dirPlus = 0, this.index = s,
            this.src = n.src, n.name && (this.name = n.name), this.weightM = n.weightM, this.speed = n.speed,
            this.killScore = n.killScore, this.turnSpeed = n.turnSpeed, this.scale = n.scale,
            this.scaleFace = 1, this.maxHealth = n.health, this.leapForce = n.leapForce, this.health = this.maxHealth,
            this.healthFace = this.health, this.chargePlayer = n.chargePlayer, this.viewRange = n.viewRange,
            this.drop = n.drop, this.dmg = n.dmg, this.hostile = n.hostile, this.dontRun = n.dontRun,
            this.hitRange = n.hitRange, this.hitDelay = n.hitDelay, this.hitScare = n.hitScare,
            this.spriteMlt = n.spriteMlt, this.nameScale = n.nameScale, this.colDmg = n.colDmg,
            this.noTrap = n.noTrap, this.spawnDelay = n.spawnDelay, this.hitWait = 0, this.waitCount = 1e3,
            this.moveCount = 0, this.targetDir = 0, this.active = !0, this.alive = !0, this.runFrom = null,
            this.chargeTarget = null, this.dmgOverTime = {}, this.alpha = 1, this.damaged = 0;
        };
        let a = 0;
        let o = 0;
        this.animate = function(e) {
            this.animTime > 0 && (this.animTime -= e, this.animTime <= 0 ? (this.animTime = 0,
            this.dirPlus = 0, a = 0, o = 0) : 0 == o ? (a += e / (this.animSpeed * n.hitReturnRatio),
            this.dirPlus = t.lerp(0, this.targetAngle, i(1, a)), a >= 1 && (a = 1, o = 1)) : (a -= e / (this.animSpeed * (1 - n.hitReturnRatio)),
            this.dirPlus = t.lerp(0, this.targetAngle, s(0, a))));
        }, this.startAnim = function() {
            this.animTime = this.animSpeed = 600, this.targetAngle = .8 * c, a = 0, o = 0;
        };
    }
});

class jt {
    constructor(e, t, i, s, n, a, o, l, r, h, c, d, f, u) {
        this.id = e, this.sid = t, this.tmpScore = 0, this.team = null, this.latestSkin = 0,
        this.oldSkinIndex = 0, this.skinIndex = 0, this.latestTail = 0, this.oldTailIndex = 0,
        this.tailIndex = 0, this.hitTime = 0, this.lastHit = 0, this.tails = {};
        for (let e = 0; e < c.length; ++e) c[e].price <= 0 && (this.tails[c[e].id] = 1);
        this.skins = {};
        for (let e = 0; e < h.length; ++e) h[e].price <= 0 && (this.skins[h[e].id] = 1);
        this.points = 0, this.dt = 0, this.hidden = !1, this.itemCounts = {}, this.isPlayer = !0,
        this.pps = 0, this.moveDir = void 0, this.lastMoveTime = 0, this.skinRot = 0, this.lastPing = 0,
        this.iconIndex = 0, this.skinColor = 0, this.dist2 = 0, this.aim2 = 0, this.maxSpeed = 1,
        this.backupNobull = !0, this.lastBleed = {
            amount: 0,
            time: 0,
            healed: !0
        }, this.lastRegen = {
            amount: 0,
            time: 0
        }, this.spawn = function(e) {
            this.attacked = !1, this.death = !1, this.spinDir = 0, this.sync = !1, this.antiBull = 0,
            this.bullTimer = 0, this.poisonTimer = 0, this.active = !0, this.alive = !0, this.lockMove = !1,
            this.lockDir = !1, this.minimapCounter = 0, this.chatCountdown = 0, this.shameCount = 0,
            this.shameTimer = 0, this.dmgOverTime = {
                amount: 0,
                time: -1,
                startTime: 0
            }, this.sentTo = {}, this.gathering = 0, this.gatherIndex = 0, this.shooting = {},
            this.shootIndex = 9, this.autoGather = 0, this.animTime = 0, this.animSpeed = 0,
            this.mouseState = 0, this.buildIndex = -1, this.weaponIndex = 0, this.weaponCode = 0,
            this.weaponVariant = 0, this.primaryIndex = void 0, this.secondaryIndex = void 0,
            this.noMovTimer = 0, this.maxXP = 300, this.XP = 0, this.age = 1, this.kills = 0,
            this.upgrAge = 2, this.upgradePoints = 0, this.x = 0, this.y = 0, this.oldXY = {
                x: 0,
                y: 0
            }, this.zIndex = 0, this.xVel = 0, this.yVel = 0, this.slowMult = 1, this.dir = 0,
            this.dirPlus = 0, this.targetDir = 0, this.targetAngle = 0, this.maxHealth = 100,
            this.health = this.maxHealth, this.oldHealth = this.maxHealth, this.damaged = 0,
            this.scale = i.playerScale, this.speed = i.playerSpeed, this.resetMoveDir(), this.resetResources(e),
            this.items = [ 0, 3, 6, 10 ], this.weapons = [ 0 ], this.shootCount = 0, this.weaponXP = [],
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
            }, this.bowThreat = {
                9: 0,
                12: 0,
                13: 0,
                15: 0
            }, this.damageThreat = 0, this.inTrap = !1, this.canEmpAnti = !1, this.empAnti = !1,
            this.soldierAnti = !1, this.poisonTick = 0, this.bullTick = 0, this.setBullTick = !1,
            this.antiTimer = 2, this.touchSpike = !1;
        }, this.resetMoveDir = function() {
            this.moveDir = void 0;
        }, this.resetResources = function(e) {
            for (let t = 0; t < i.resourceTypes.length; ++t) this[i.resourceTypes[t]] = e ? 100 : 0;
        }, this.resetReloads = function() {
            for (const e in this.reloads) this.reloads[e] = 0;
        }, this.getItemType = function(e) {
            let t = this.items.findIndex(t => t == e);
            return -1 != t ? t : r.checkItem.index(e, this.items);
        }, this.setData = function(e) {
            this.id = e[0], this.sid = e[1], this.name = e[2], this.x = e[3], this.y = e[4],
            this.dir = e[5], this.health = e[6], this.maxHealth = e[7], this.scale = e[8], this.skinColor = e[9];
        }, this.updateTimer = function() {
            this.bullTimer -= 1, this.bullTimer <= 0 && (this.setBullTick = !1, this.bullTick = V.tick - 1,
            this.bullTimer = i.serverUpdateRate), this.poisonTimer -= 1, this.poisonTimer <= 0 && (this.setPoisonTick = !1,
            this.poisonTick = V.tick - 1, this.poisonTimer = i.serverUpdateRate);
        }, this.update = function(e) {
            if (!this.active) return;
            let t = {
                skin: we(h, this.skinIndex),
                tail: we(c, this.tailIndex)
            };
            const s = r.weapons[this.weaponIndex].spdMult || 1;
            const n = t.skin && t.skin.spdMult || 1;
            const a = t.tail && t.tail.spdMult || 1;
            let o = (this.buildIndex >= 0 ? .5 : 1) * s * n * a * (this.y <= i.snowBiomeTop ? t.skin && t.skin.coldM ? 1 : i.snowSpeed : 1) * this.slowMult;
            this.maxSpeed = o, this.playerSpeed = Math.hypot(this.oldPos.x2 - this.x2, this.oldPos.y2 - this.y2),
            this.playerMaxSpeed = 37 * this.maxSpeed, this.velWeaponRange = r.weapons[this.weaponIndex].range + 35 + (NaN != this.playerSpeed ? this.playerSpeed > this.playerMaxSpeed ? this.playerMaxSpeed : this.playerSpeed : 0);
        };
        let p = 0;
        let m = 0;
        this.animate = function(e) {
            this.animTime > 0 && (this.animTime -= e, this.animTime <= 0 ? (this.animTime = 0,
            this.dirPlus = 0, p = 0, m = 0) : 0 == m ? (p += e / (this.animSpeed * i.hitReturnRatio),
            this.dirPlus = s.lerp(0, this.targetAngle, Math.min(1, p)), p >= 1 && (p = 1, m = 1)) : (p -= e / (this.animSpeed * (1 - i.hitReturnRatio)),
            this.dirPlus = s.lerp(0, this.targetAngle, Math.max(0, p))));
        }, this.startAnim = function(e, t) {
            this.animTime = this.animSpeed = r.weapons[t].speed, this.targetAngle = e ? -i.hitAngle : -Math.PI,
            p = 0, m = 0;
        }, this.canSee = function(e) {
            if (!e) return !1;
            let t = Math.abs(e.x - this.x) - e.scale;
            let s = Math.abs(e.y - this.y) - e.scale;
            return t <= i.maxScreenWidth / 2 * 1.3 && s <= i.maxScreenHeight / 2 * 1.3;
        }, this.addShameTimer = function() {
            this.shameCount = 0, this.shameTimer = 30;
            let e = setInterval(() => {
                this.shameTimer--, this.shameTimer <= 0 && clearInterval(e);
            }, 1e3);
        }, this.isTeam = function(e) {
            return this == e || this.team && this.team == e.team;
        }, this.findAllianceBySid = function(e) {
            return this.team ? ie.find(t => t === e) : null;
        }, this.manageWeapons = function() {
            this.weaponIndex < 9 ? (this.primaryIndex = this.weaponIndex, this.primaryVariant = this.weaponVariant,
            this.primaryDmg = Math.round(1.5 * r.weapons[this.primaryIndex].dmg * (i.weaponVariants[this.primaryVariant].val || 1))) : this.weaponIndex > 8 && (this.secondaryIndex = this.weaponIndex,
            this.secondaryVariant = this.weaponVariant), void 0 !== this.secondaryIndex && (this.shootIndex = this.secondaryIndex),
            this.primary = r.weapons[this.primaryIndex ?? 5], this.secondary = r.weapons[this.secondaryIndex ?? 15];
        }, this.manageReload = function() {
            this.shooting[53] ? (this.shooting[53] = 0, this.reloads[53] = 2500 - V.tickRate) : this.reloads[53] > 0 && (this.reloads[53] = Math.max(0, this.reloads[53] - V.tickRate)),
            this.gathering || this.shooting[1] ? (this.gathering && (this.gathering = 0, this.reloads[this.gatherIndex] = r.weapons[this.gatherIndex].speed * (20 == this.skinIndex ? .78 : 1),
            this.attacked = !0), this.shooting[1] && (this.shooting[1] = 0, this.reloads[this.shootIndex] = r.weapons[this.shootIndex].speed * (20 == this.skinIndex ? .78 : 1),
            this.attacked = !0)) : (this.attacked = !1, this.buildIndex < 0 && this.reloads[this.weaponIndex] > 0 && (this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - V.tickRate)));
        }, this.checkCanInsta = function(e) {
            let t = 0;
            if (this.alive && Mt) {
                let s = {
                    weapon: this.weapons[0],
                    variant: this.primaryVariant,
                    dmg: null == this.weapons[0] ? 0 : r.weapons[this.weapons[0]].dmg
                };
                let n = {
                    weapon: this.weapons[1],
                    variant: this.secondaryVariant,
                    dmg: null == this.weapons[1] ? 0 : r.weapons[this.weapons[1]].Pdmg
                };
                let a = this.skins[7] && !e ? 1.5 : 1;
                let o = null != s.variant ? i.weaponVariants[s.variant].val : 1;
                return null != s.weapon && 0 == this.reloads[s.weapon] && (t += s.dmg * o * a),
                null != n.weapon && 0 == this.reloads[n.weapon] && (t += n.dmg), this.skins[53] && this.reloads[53] <= (10 == oe.weapons[1] ? 0 : V.tickRate) && 22 != ue.skinIndex && (t += 25),
                t *= 6 == ue.skinIndex ? .75 : 1, t;
            }
            return 0;
        }, this.addDamageThreat = function(e) {
            let t = {
                weapon: this.primaryIndex,
                variant: this.primaryVariant
            };
            t.dmg = null == t.weapon ? 45 : r.weapons[t.weapon].dmg;
            let s = {
                weapon: this.secondaryIndex,
                variant: this.secondaryVariant
            };
            s.dmg = null == s.weapon ? 50 : r.weapons[s.weapon].dmg;
            let n = null != t.variant ? i.weaponVariants[t.variant].val : 1.18;
            let a = null != s.variant ? [ 9, 12, 13, 15 ].includes(s.weapon) ? 1 : i.weaponVariants[s.variant].val : 1.18;
            null != t.weapon && 0 != this.reloads[t.weapon] || (this.damageThreat += t.dmg * n * 1.5),
            null != s.weapon && 0 != this.reloads[s.weapon] || (this.damageThreat += s.dmg * a),
            this.reloads[53] <= V.tickRate && (this.damageThreat += 25), this.damageThreat *= 6 == e.skinIndex ? .75 : 1,
            this.isTeam(e) || this.dist2 <= 300 && (e.damageThreat += this.damageThreat);
        };
    }
}

function Gt(e) {
    Y("6", e.slice(0, 30));
}

function Lt(e) {
    oe.reloads[e] = 0, Y("H", e);
}

function Wt(e, t) {
    Y("c", 0, e, t);
}

function Kt(e, t) {
    Y("c", 1, e, t);
}

function Vt(e, t) {
    if (Ps.antiTick && 0 == t) return Wt(6, 0);
    if (oe.alive && Mt && "block" != Be.style.display) if (0 == t) {
        if (oe.skins[e]) oe.skinIndex != e && Wt(e, 0); else if (x.isSandbox) {
            let t = Ct.find(t => t.id == e);
            t && oe.points >= t.price && Kt(e, 0);
        }
    } else if (1 == t) if (oe.tails[e]) oe.tailIndex != e && Wt(e, 1); else if (x.isSandbox) {
        let t = Ht.find(t => t.id == e);
        t && oe.points >= t.price && Kt(e, 1);
    }
}

function Xt(e, t) {
    Vt(e, 0), Vt(t, 1);
}

function Ut(e, t) {
    Y("z", e, t);
}

function Qt(e, t) {
    t || (oe.weaponCode = e), Y("z", e, 1);
}

function Jt() {
    Y("K", 1, 1);
}

function Yt(e, t) {
    Y("F", e, t, 1);
}

function Zt(e) {
    Y("D", e);
}

function ei(e, t, i, s, n) {
    const a = e.sid !== oe.sid;
    const o = ae.filter2(t => {
        if (1 === t.type && t.y >= 12e3) return !0;
        if (!t.dmg) return !1;
        const i = t.owner?.sid;
        return a ? oe.isTeam(i) || !e.team && i !== e.sid : !oe.isTeam(i);
    });
    if (!o.length) return !1;
    const l = s ? e.x3 : e.x2;
    const r = s ? e.y3 : e.y2;
    for (let s = 0, n = o.length; s < n; s++) {
        const n = o[s];
        const a = (1 === n.type ? .55 * n.scale : n.scale) + 35;
        const h = St.getDist(e, n);
        const c = h - a;
        if (c >= i) continue;
        const d = St.calcPoint(l, r, t, h);
        if (St.getDist(d, n) < a) {
            const e = St.calcPoint(l, r, t, c);
            return {
                x: e.x,
                y: e.y,
                obj: n
            };
        }
    }
    return !1;
}

class ti {
    static markers=[];
    static addMarker({x: e, y: t, name: i, id: s, angle: n, scale: a, prePlace: o}) {
        (null == n || null == n || isNaN(n)) && (n = 0), this.markers.push({
            x: e,
            y: t,
            id: s,
            angle: n || 0,
            name: i,
            prePlace: o,
            owner: {
                sid: oe.sid
            },
            scale: a,
            ticks: V.tick
        }), V.tickBase(() => {
            this.markers.shift();
        }, 1);
    }
    static checkMarkers(e, t, i, s) {
        for (let n = 0; n < this.markers.length; n++) {
            let a = this.markers[n];
            if (a && St.getDist(a, {
                x: e,
                y: t
            }) <= a.scale + i && (!a.prePlace || s == a.ticks)) return !1;
        }
        return !0;
    }
}

function ii(e) {
    const t = e.group;
    const i = oe.itemCounts[t.id];
    let s = x.isSandbox ? t.sandboxLimit ?? 99 : t.limit;
    return !i || i < s;
}

function si(e, t) {
    try {
        let i = $t.list[oe.items[e]];
        let s = ii(i);
        if (x.isPrivateServer || oe.alive && Mt && s) {
            Ut(oe.items[e]), Yt(1, function(e) {
                if (x.isPrivateServer && D.doPlaceInvisBuilds) return {
                    0: -129774e303,
                    1: -140154e303,
                    2: -121039e303,
                    3: -111012e303,
                    4: -14526e304,
                    5: -14127e304,
                    6: -133884e303,
                    7: -132535e303,
                    8: -122508e303,
                    9: -12421e304,
                    10: -113773e303,
                    11: -14538e304,
                    12: -120573e303,
                    13: -115828e303,
                    14: -111838e303,
                    15: -12832e304,
                    16: -12433e304,
                    17: -116944e303,
                    18: -112954e303,
                    19: -140755e303,
                    20: -115948e303,
                    21: -13243e304,
                    22: -12844e304,
                    23: -12445e304,
                    24: -117064e303,
                    25: -127444e303,
                    26: -11138e304,
                    27: -119119e303,
                    28: -13255e304,
                    29: -12856e304,
                    30: -123815e303,
                    31: -119825e303,
                    32: -11549e304,
                    33: -1115e305,
                    34: -12188e304,
                    35: -13226e304,
                    36: -110504e303,
                    37: -123935e303,
                    38: -134315e303,
                    39: -11561e304,
                    40: -11162e304,
                    41: -13637e304,
                    42: -114614e303,
                    43: -110624e303,
                    44: -126696e303,
                    45: -17871e304,
                    46: -118371e303,
                    47: -12611e304,
                    48: -127812e303,
                    49: -114734e303,
                    50: -17244e304,
                    51: -126816e303,
                    52: -11943e304,
                    53: -118491e303,
                    54: -12623e304,
                    55: -121485e303,
                    56: -117495e303,
                    57: -130926e303,
                    58: -129987e303,
                    59: -122601e303,
                    60: -118611e303,
                    61: -16987e304,
                    62: -121605e303,
                    63: -123307e303,
                    64: -11328e304,
                    65: -111931e303,
                    66: -122721e303,
                    67: -133101e303,
                    68: -16999e304,
                    69: -166e306,
                    70: -158614e303,
                    71: -1134e305,
                    72: -115102e303,
                    73: -125482e303,
                    74: -1741e305,
                    75: -17011e304,
                    76: -113167e303,
                    77: -120151e303,
                    78: -116161e303,
                    79: -129592e303,
                    80: -139972e303,
                    81: -17422e304,
                    82: -117277e303,
                    83: -112532e303,
                    84: -120271e303,
                    85: -15716e304,
                    86: -15317e304,
                    87: -16355e304,
                    88: -120977e303,
                    89: -120038e303,
                    90: -112652e303,
                    91: -123032e303,
                    92: -15728e304,
                    93: -16766e304,
                    94: -125087e303,
                    95: -124148e303,
                    96: -116762e303,
                    97: -112772e303,
                    98: -123152e303,
                    99: -1574e305,
                    100: -16778e304,
                    101: -128258e303,
                    102: -124268e303,
                    103: -14034e304,
                    104: -15072e304,
                    105: -16151e304,
                    106: -118937e303,
                    107: -120639e303,
                    108: -110202e303,
                    109: -127029e303,
                    110: -14046e304,
                    111: -15084e304,
                    112: -111318e303,
                    113: -121698e303,
                    114: -114312e303,
                    115: -110322e303,
                    116: -14457e304,
                    117: -15495e304,
                    118: -15096e304,
                    119: -111438e303,
                    120: -121818e303,
                    121: -13789e304,
                    122: -1339e305,
                    123: -123873e303,
                    124: -15507e304,
                    125: -115548e303,
                    126: -114199e303,
                    127: -142e306,
                    128: -13801e304,
                    129: -1488e305,
                    130: -126634e303,
                    131: -125695e303,
                    132: -115668e303,
                    133: -114319e303,
                    134: -14212e304,
                    135: -13813e304,
                    136: -130744e303,
                    137: -129805e303,
                    138: -122419e303,
                    139: -118429e303,
                    140: -128809e303,
                    141: -14224e304,
                    142: -120484e303,
                    143: -113098e303,
                    144: -111749e303,
                    145: -12518e304,
                    146: -12119e304,
                    147: -113804e303,
                    148: -112865e303,
                    149: -126296e303,
                    150: -115859e303,
                    151: -111869e303,
                    152: -1253e305,
                    153: -124361e303,
                    154: -113924e303,
                    155: -112985e303,
                    156: -119969e303,
                    157: -115979e303,
                    158: -12941e304,
                    159: -12542e304,
                    160: -118034e303,
                    161: -117095e303,
                    162: -127475e303,
                    163: -140906e303,
                    164: -11915e304,
                    165: -12953e304,
                    166: -110415e303,
                    167: -121205e303,
                    168: -17586e304,
                    169: -11247e304,
                    170: -111531e303,
                    171: -121911e303,
                    172: -132291e303,
                    173: -110535e303,
                    174: -121325e303,
                    175: -17598e304,
                    176: -11259e304,
                    177: -143787e303,
                    178: -136401e303,
                    179: -114645e303,
                    180: -1380253e302,
                    181: -124086e303,
                    182: -134466e303,
                    183: -115351e303,
                    184: -126141e303,
                    185: -16303e304,
                    186: -17341e304,
                    187: -128196e303,
                    188: -126847e303,
                    189: -11682e304,
                    190: -118522e303,
                    191: -126261e303,
                    192: -16315e304,
                    193: -15916e304,
                    194: -130957e303,
                    195: -130018e303,
                    196: -122632e303,
                    197: -118642e303,
                    198: -16726e304,
                    199: -16327e304,
                    200: -17365e304,
                    201: -11026e304,
                    202: -123691e303,
                    203: -122752e303,
                    204: -15659e304,
                    205: -16738e304,
                    206: -17776e304,
                    207: -158645e303,
                    208: -113431e303,
                    209: -15032e304,
                    210: -1607e305,
                    211: -15671e304,
                    212: -117188e303,
                    213: -124927e303,
                    214: -120182e303,
                    215: -113551e303,
                    216: -15044e304,
                    217: -16082e304,
                    218: -118247e303,
                    219: -131678e303,
                    220: -112563e303,
                    221: -14376e304,
                    222: -116312e303,
                    223: -16493e304,
                    224: -16094e304,
                    225: -121008e303,
                    226: -131798e303,
                    227: -1335e305,
                    228: -14388e304,
                    229: -136494e303,
                    230: -112097e303,
                    231: -125118e303,
                    232: -124179e303,
                    233: -120189e303,
                    234: -14799e304,
                    235: -144e306,
                    236: -136614e303,
                    237: -111807e303,
                    238: -128289e303,
                    239: -117852e303,
                    240: -1521e305,
                    241: -14811e304,
                    242: -128995e303,
                    243: -115917e303,
                    244: -114978e303,
                    245: -13105e304,
                    246: -14143e304,
                    247: -119674e303,
                    248: -127413e303,
                    249: -111349e303,
                    250: -119088e303,
                    251: -12079e304,
                    252: -13117e304,
                    253: -14155e304,
                    254: -119794e303,
                    255: -130584e303,
                    256: -111469e303,
                    257: -121849e303,
                    258: -13528e304,
                    259: -13129e304,
                    260: -123904e303,
                    261: -137335e303,
                    262: -11822e304,
                    263: -125959e303,
                    264: -12461e304,
                    265: -1354e305,
                    266: -14578e304,
                    267: -126665e303,
                    268: -137455e303,
                    269: -11834e304,
                    270: -11435e304,
                    271: -110015e303,
                    272: -117754e303,
                    273: -130775e303,
                    274: -129836e303,
                    275: -125846e303,
                    276: -11846e304,
                    277: -12884e304,
                    278: -121454e303,
                    279: -117464e303,
                    280: -113129e303,
                    281: -11178e304,
                    282: -12257e304,
                    283: -13295e304,
                    284: -113835e303,
                    285: -1689e305,
                    286: -120635e303,
                    287: -11589e304,
                    288: -1119e305,
                    289: -125331e303,
                    290: -124392e303,
                    291: -113955e303,
                    292: -113016e303,
                    293: -126447e303,
                    294: -11601e304,
                    295: -129441e303,
                    296: -125451e303,
                    297: -138882e303,
                    298: -17272e304,
                    299: -127506e303,
                    300: -12012e304,
                    301: -11613e304,
                    302: -111795e303,
                    303: -128212e303,
                    304: -17683e304,
                    305: -17284e304,
                    306: -112501e303,
                    307: -123291e303,
                    308: -119301e303,
                    309: -132322e303,
                    310: -110566e303,
                    311: -17695e304,
                    312: -120007e303,
                    313: -112621e303,
                    314: -143818e303,
                    315: -15989e304,
                    316: -114676e303,
                    317: -128107e303,
                    318: -124117e303,
                    319: -134497e303,
                    320: -115382e303,
                    321: -123121e303,
                    322: -16001e304,
                    323: -1708e305,
                    324: -128227e303,
                    325: -126878e303,
                    326: -119492e303,
                    327: -115502e303,
                    328: -14975e304,
                    329: -121547e303,
                    330: -17092e304,
                    331: -110171e303,
                    332: -126998e303,
                    333: -119612e303,
                    334: -15386e304,
                    335: -16424e304,
                    336: -121667e303,
                    337: -114281e303,
                    338: -110291e303,
                    339: -162305e303,
                    340: -15797e304,
                    341: -15398e304,
                    342: -111407e303,
                    343: -121787e303,
                    344: -135218e303,
                    345: -13692e304,
                    346: -1473e305,
                    347: -15809e304,
                    348: -115517e303,
                    349: -114168e303,
                    350: -124958e303,
                    351: -14103e304,
                    352: -13704e304,
                    353: -129654e303,
                    354: -15821e304,
                    355: -118278e303,
                    356: -128658e303,
                    357: -142089e303,
                    358: -14115e304,
                    359: -112947e303
                }[(t = g(Math.sin(e), Math.cos(e)), 0 == t ? 0 : r((.54 + .18 * t / Math.PI - .18) % .36 * 1e3) % 360)];
                return e;
                var t;
            }(t)), Qt(oe.weaponCode, 1);
            let s = oe.scale + i.scale + (i.placeOffset || 0);
            let n = St.calculatePosition(oe, s, t);
            0 !== e && ti.addMarker({
                x: n.x,
                y: n.y,
                scale: i.scale,
                name: i.name,
                angle: t,
                id: i.id
            });
        }
    } catch (e) {}
}

function ni(e, t) {
    try {
        let i = $t.list[oe.items[e]];
        let s = oe.scale + i.scale + (i.placeOffset || 0);
        let n = St.calculatePosition(oe, s, t);
        return Et.checkItemLocation(n.x, n.y, i.scale, .6, i.id, !1, oe) ? (si(e, t), 1) : 0;
    } catch (e) {}
}

function ai() {
    return 100 === oe.health || 45 === oe.skinIndex || 56 === oe.skinIndex ? 0 : Math.ceil((100 - oe.health) / $t.list[oe.items[0]].healing);
}

function oi(e = 0) {
    for (let t = 0; t < ai() + e; t++) si(0, Fi());
}

let li = !1;

function ri(e) {
    li = !0;
    let t = setInterval(() => {
        oe.shameCount < 5 && si(0, Fi());
    }, 75);
    setTimeout(() => {
        clearInterval(t), setTimeout(() => {
            li = !1;
        }, V.tickRate);
    }, V.tickRate);
}

const hi = x.mapScale / 2;

const ci = x.riverWidth / 2;

function di(e) {
    return e >= hi - ci && e <= hi + ci;
}

function fi(e, t) {
    const i = oe.skins[22] ? 22 : 6;
    const s = di(oe.y2) ? 31 : e && null == oe.moveDir ? i : oe.y2 <= x.snowBiomeTop ? 15 : 12;
    return t ? s : (Vt(s, 0), 0);
}

class ui {
    static key={};
    static trap=!1;
    static spike=!1;
    static turret=!1;
}

class pi {
    static pos={};
    static active=!!x.isSandbox;
    static update() {
        if (!this.active) return;
        let e = parseFloat(k("placeType").value);
        if (St.getDist(this.pos, oe, 0, 2) > 99) {
            const t = St.getDirect(this.pos, oe, 0, 2);
            if (3 === e && ni(e, t), 3 !== e || Date.now() - oe.lastMoveTime > 400) {
                const i = St.toRad(66);
                ni(e, t + i), ni(e, t - i);
            }
            this.pos = {
                x: oe.x2,
                y: oe.y2
            };
        }
    }
}

class mi {
    static canSpikeTick() {
        let e = oe.weapons[0];
        let t = 1.5 * Dt.calculateWeaponDamage(e, oe.primaryVariant);
        return Dt.reloadPercent(oe, e) < 1 || t < 60 ? 0 : t;
    }
}

let gi = new class {
    constructor() {
        this.depthStep = 75, this.brokenObj = [];
    }
    checkPlace(e, t = 0, i) {
        try {
            let s = $t.list[oe.items[e]];
            if (s) {
                let n = s.scale;
                let a = 35 + n + (s.placeOffset || 0);
                let o = oe.x2 + Math.cos(t) * a;
                let l = oe.y2 + Math.sin(t) * a;
                ti.checkMarkers(o, l, n, V.tick) && (si(e, t), "function" == typeof i && i());
            }
        } catch (e) {}
    }
    findAngles(e = 0) {
        let t = Math.PI / parseInt(this.depthStep);
        let i = oe.items[2];
        let s = $t.list[15];
        let n = $t.list[i];
        let a = [ 0, Math.PI ];
        let o = [];
        for (let i = 0; i <= Math.PI; i += t) for (let t = 0; t < a.length; t++) {
            let s = i + a[t] + e;
            this.validateAngle(s, o);
        }
        let l = Math.max(n.scale, s.scale);
        let r = ae.filter(e => e.active && St.getDist(e, oe, 0, 2) <= 35 + l + e.scale);
        for (let e = 0; e < r.length; e++) {
            let t = r[e];
            let i = r[(e + 1) % r.length];
            if (t && i) {
                let e = St.getDirect(t, oe, 0, 2);
                let s = St.getDirect(i, oe, 0, 2);
                e < 0 && (e += 2 * Math.PI), s < 0 && (s += 2 * Math.PI);
                let n = (e + s) / 2;
                Math.abs(e - s) > Math.PI && (n += Math.PI) > 2 * Math.PI && (n -= 2 * Math.PI),
                this.validateAngle(n, o);
            }
        }
        return o.sort((e, t) => e.enemyDist - t.enemyDist).sort((e, t) => e.brokenDist - t.brokenDist).sort((e, t) => t.prioritization - e.prioritization);
    }
    validateAngle(e, t) {
        let i = oe.items[2];
        let s = $t.list[15];
        let n = $t.list[i];
        let a = 35 + n.scale + (n.placeOffset || 0);
        let o = 35 + s.scale + (s.placeOffset || 0);
        let l = {
            angle: e,
            trap: !1,
            pos: {},
            prioritization: 0
        };
        let r = St.calculatePosition(oe, o, e);
        Et.checkItemLocation(r.x, r.y, s.scale, .6, 15, !1) && (l.trap = !0, l.pos.trap = {
            ...r
        }, l.pos.trap.scale = s.scale);
        let h = St.calculatePosition(oe, a, e);
        if (Et.checkItemLocation(h.x, h.y, n.scale, .6, i, !1) && (l.spike = !0, l.prioritization++,
        l.pos.spike = {
            ...h
        }, l.pos.spike.dmg = n.dmg, l.pos.spike.scale = n.scale), l.spike || l.trap) {
            let e = l.pos.spike || l.pos.trap;
            let i = this.brokenObj.sort((t, i) => St.getDist(t, e) - St.getDist(i, e))[0];
            l.brokenDist = 1 / 0, l.enemyDist = St.getDist(ue, e, 2, 0), i && (l.brokenDist = St.getDist(i, e)),
            l.brokenDist <= l.enemyDist && l.prioritization++, t.push(l);
        }
    }
    autoReplace(e) {
        let t = St.getDirect(e, oe, 0, 2);
        if (ue.dist2 <= 400 && ue) {
            this.brokenObj.unshift({
                x: e.x,
                y: e.y,
                scale: e.scale
            }), V.tickBase(() => {
                this.brokenObj.pop();
            }, 4);
            let i = ue.trapData;
            let s = this.findAngles(t);
            let n = !1;
            let a = mi.canSpikeTick();
            for (let t = 0; t < s.length; t++) {
                let o = s[t];
                if (i && e.sid == i.sid && o.trap && St.getDist(o.pos.trap, ue, 0, 2) <= 50) if (o.spike) if (yi.reverseSpikeTick) this.checkPlace(2, o.angle, () => {
                    n = !0;
                }); else {
                    let t = ae.find(t => t.active && t.dmg && t.isTeamObject(oe) && St.getDist(t, e) <= t.scale + 70);
                    let i = oe.trapData;
                    if (t && i && Dt.replaceable(i)) this.checkPlace(2, o.angle, () => {
                        n = !0;
                    }); else {
                        let e = Ts.spikeKB({
                            x: ue.x2,
                            y: ue.y2,
                            scale: 35,
                            tmpObj: ue
                        }, o.pos.spike, !0);
                        if (e.data.find(e => "spiek" == e.id)) e.data.filter(e => "spiek" == e.id).reduce((e, t) => e + t.dmg, 0) + o.pos.spike.dmg + a >= 100 ? this.checkPlace(2, o.angle, () => {
                            n = !0, e.callback();
                        }) : this.checkPlace(4, o.angle); else if (!t && e.data.find(e => "trap" == e.id)) this.checkPlace(2, o.angle, () => {
                            n = !0, e.callback();
                        }); else if (a + o.pos.spike.dmg >= 100) {
                            let e = Ts.hit(oe, ue);
                            ae.find(t => t.active && (t.dmg || t.trap) && t.isTeamObject(oe) && St.getDist(e, t) <= 35 + t.scale) ? this.checkPlace(2, o.angle, () => {
                                n = !0;
                            }) : this.checkPlace(4, o.angle);
                        } else this.checkPlace(4, o.angle);
                    }
                } else this.checkPlace(4, o.angle); else if (i && o.spike) St.getDist(o.pos.spike, i) <= 130 ? this.checkPlace(2, o.angle) : o.trap && this.checkPlace(4, o.angle); else if (ue.dist2 <= 200) if (o.spike) if (St.getAngleDist(ue.aim2, o.angle) <= .75) this.checkPlace(2, o.angle); else if (St.getDist(o.pos.spike, ue, 0, 2) <= 100) {
                    let e = Ts.spikeKB({
                        x: ue.x2,
                        y: ue.y2,
                        scale: 35,
                        tmpObj: ue
                    }, o.pos.spike, !0);
                    e.data.find(e => "spiek" == e.id || "trap" == e.id) && this.checkPlace(2, o.angle, () => {
                        e.callback();
                    });
                } else o.trap && this.checkPlace(4, o.angle); else o.trap && this.checkPlace(4, o.angle); else o.trap && this.checkPlace(4, o.angle);
            }
            n && (yi.canSpikeTick = !0);
        }
    }
    autoPlace() {
        if (!k("autoplc").checked || !de.length) return;
        let e = !x.isPrivateServer && V.tick % 5 == 1;
        if (ue.dist2 > 400 || e) return;
        let t = ue.inTrap;
        let i = this.findAngles(ue.aim2);
        let s = ae.filter(e => e.active && e.trap && e.isTeamObject(oe) && St.getDist(e, oe, 0, 2) <= 300);
        for (let e = 0; e < i.length; e++) {
            let n = i[e];
            if (t && n.spike) St.getDist(n.pos.spike, t) <= 130 ? this.checkPlace(2, n.angle) : n.trap && this.checkPlace(4, n.angle); else if (ue.dist2 <= 200) if (n.spike) {
                let e = n.pos.spike;
                if (G && St.getAngleDist(ue.aim2, n.angle) <= x.gatherAngle / 1.5 && ue.dist2 <= 165) this.checkPlace(2, n.angle); else if (St.getDist(e, ue, 0, 2) <= 100) {
                    let e = Ts.spikeKB({
                        x: ue.x2,
                        y: ue.y2,
                        scale: 35,
                        tmpObj: ue
                    }, n.pos.spike, !0);
                    let t = () => {
                        this.checkPlace(2, n.angle, () => {
                            e.callback();
                        });
                    };
                    e.data.find(e => "trap" == e.id) || e.data.find(e => "spiek" == e.id) && e.data.filter(e => "spiek" == e.id).reduce((e, t) => e + t.dmg, 0) + n.pos.spike.dmg >= 100 ? t() : n.trap && this.checkPlace(4, n.angle);
                } else t && n.spike && St.getDist(e, t, 0, 0) < oe.scale + $t.list[oe.items[2]].scale + 8 || St.getAngleDist(ue.aim2, n.angle) <= .75 && s.find(t => St.getDist(e, t, 0, 2) <= 135) ? this.checkPlace(2, n.angle) : n.trap && this.checkPlace(4, n.angle);
            } else n.trap && this.checkPlace(4, n.angle); else n.trap && this.checkPlace(4, n.angle);
        }
    }
};

let bi = new class {
    constructor() {
        this.depthStep = 68, this.brokenObj = [], this.preplacements = 0;
    }
    checkPlace(e, t = 0, i) {
        let s = $t.list[oe.items[e]];
        let n = s.scale;
        let a = 35 + n + (s.placeOffset || 0);
        let o = oe.x2 + Math.cos(t) * a;
        let l = oe.y2 + Math.sin(t) * a;
        if (ti.checkMarkers(o, l, n, V.tick)) if (i) {
            let i = window.pingTime;
            this.preplacements++, setTimeout(() => {
                this.diffPlace(e, t, V.tick);
            }, x.serverUpdateSpeed + i - window.pingTime);
        } else si(e, t);
    }
    diffPlace(e, t, i) {
        let s = $t.list[oe.items[e]];
        let n = s.scale;
        let a = 35 + n + (s.placeOffset || 0);
        let o = oe.x2 + Math.cos(t) * a;
        let l = oe.y2 + Math.sin(t) * a;
        let r = ii(s);
        if (ti.checkMarkers(o, l, n, i) && (x.isPrivateServer || oe.alive && Mt && r)) {
            Ut(oe.items[e]), Yt(1, t), Qt(oe.weaponCode, 1);
            let i = qi();
            "number" == typeof i && St.getAngleDist(i, t) >= Math.PI / 8 && Zt(i), ti.addMarker({
                x: o,
                y: l,
                scale: n,
                name: s.name,
                angle: t,
                id: e,
                prePlace: !0
            });
        }
    }
    validateBuilding(e) {
        if (St.getDist(oe, e, 2, 0) > 100 + 2 * e.scale) return !1;
        if (!e.health) return;
        let t = 0;
        if (D.doPredictBuildHealthForPrePlace) for (let i = 0; i < ee.length; i++) {
            let s = ee[i];
            if (s.visible && St.getDist(s, e, 2, 0) <= 100 + 2 * e.scale) {
                let i = 10 == s.secondaryIndex ? s.secondaryIndex : s.primaryIndex;
                let n = null != i.variant ? x.weaponVariants[10 === i ? s.secondaryVariant : s.primaryVariant].val : 1.18;
                let a = $t.weapons[i];
                let o = a.dmg * (a.sDmg || 1) * (n || 1);
                le == s.sid ? s.skins[40] && (o *= 3.3) : o *= 3.3, St.getDist(s, e, 2, 0) - e.scale < a.range && 1 == Dt.reloadPercent(s, i) && (t += o);
            }
        } else t = 272.58;
        return e.health <= t && (!e.trap || !e.hideFromEnemy);
    }
    validateClashWithEnemy(e) {
        let t = [];
        for (let i = 0; i < e.length; i++) {
            let s = e[i];
            if (St.getDist(oe, s, 2, 0) <= 100 + 2 * s.scale) for (let e = 0; e < fe.length; e++) {
                let i = fe[e];
                if (St.getDist(i, s, 2, 0) <= 100 + 2 * s.scale) {
                    t.push({
                        x: s.x,
                        y: s.y,
                        enemy: i,
                        scale: s.scale,
                        sid: s.sid
                    });
                    break;
                }
            }
        }
        return t;
    }
    validateIfOverLap(e, t, i, s) {
        for (let n = 0; n < s.length; n++) {
            let a = s[n];
            if (a.active) {
                let s = a.blocker ? a.blocker : a.getScale(.6, a.isItem);
                if (St.getDist(e, a) < t + s && !i.find(e => e.sid == a.sid)) return !0;
            }
        }
        return !1;
    }
    validateOpenAngle(e, t, i, s) {
        let n = oe.items[2];
        let a = $t.list[15];
        let o = $t.list[n];
        let l = 35 + o.scale + (o.placeOffset || 0);
        let r = 35 + a.scale + (a.placeOffset || 0);
        let h = {
            angle: e,
            trap: !1,
            pos: {},
            prioritization: 0
        };
        let c = St.calculatePosition(oe, r, e);
        let d = Et.checkItemLocation(c.x, c.y, a.scale, .6, 15, !1, void 0, !0);
        let f = i.find(e => e.sid == d.sid);
        f && !this.validateIfOverLap(c, a.scale, i, s) && (h.trap = !0, h.pos.trap = {
            ...c
        }, h.pos.trap.scale = a.scale, h.preplacedTo = St.getDirect(f, oe, 0, 2), h.enemy = f.enemy);
        let u = St.calculatePosition(oe, l, e);
        let p = Et.checkItemLocation(u.x, u.y, o.scale, .6, n, !1, void 0, !0);
        if ((f = i.find(e => e.sid == p.sid)) && !this.validateIfOverLap(u, a.scale, i, s) && (h.spike = !0,
        h.prioritization++, h.pos.spike = {
            ...u
        }, h.pos.spike.dmg = o.dmg, h.preplacedTo = St.getDirect(f, oe, 0, 2), h.pos.spike.scale = o.scale,
        h.enemy = f.enemy), h.spike || h.trap) {
            let e = h.pos.spike || h.pos.trap;
            let i = gi.brokenObj.sort((t, i) => St.getDist(t, e) - St.getDist(i, e))[0];
            h.brokenDist = 1 / 0, h.enemyDist = St.getDist(ue, e, 2, 0), i && (h.brokenDist = St.getDist(i, e)),
            h.brokenDist <= h.enemyDist && h.prioritization++, t.push(h);
        }
    }
    findOpenAngles(e) {
        let t = Math.PI / parseInt(this.depthStep);
        let i = [ 0, Math.PI ];
        let s = oe.items[2];
        let n = $t.list[s];
        let a = $t.list[15];
        let o = [];
        let l = Math.max(n.scale, a.scale);
        let r = ae.filter(e => e.active && St.getDist(e, oe, 0, 2) <= 35 + l + e.scale);
        for (let s = 0; s <= Math.PI; s += t) for (let t = 0; t < i.length; t++) {
            let n = s + i[t];
            this.validateOpenAngle(n, o, e, r);
        }
        for (let t = 0; t < r.length; t++) {
            let i = r[t];
            let s = r[(t + 1) % r.length];
            if (i && s) {
                let t = St.getDirect(i, oe, 0, 2);
                let n = St.getDirect(s, oe, 0, 2);
                t < 0 && (t += 2 * Math.PI), n < 0 && (n += 2 * Math.PI);
                let a = (t + n) / 2;
                Math.abs(t - n) > Math.PI && (a += Math.PI) > 2 * Math.PI && (a -= 2 * Math.PI),
                this.validateOpenAngle(a, o, e, r);
            }
        }
        return o.sort((e, t) => e.enemyDist - t.enemyDist).sort((e, t) => e.brokenDist - t.brokenDist).sort((e, t) => t.prioritization - e.prioritization);
    }
    update() {
        let e = ae.filter(e => e.active && this.validateBuilding(e));
        if (!e.length) return;
        e = this.validateClashWithEnemy(e);
        let t = this.findOpenAngles(e);
        let i = ae.filter(e => e.active && e.trap && e.isTeamObject(oe) && St.getDist(e, oe, 0, 2) <= 300);
        for (let e = 0; e < t.length; e++) {
            let s = t[e];
            let n = s.enemy;
            if (!n) continue;
            let a = n.inTrap;
            let o = St.getDist(n, oe, 2, 2);
            if (a && s.spike) {
                if (St.getDist(s.pos.spike, a) <= 130) {
                    if (this.checkPlace(2, s.angle, n), this.preplacements > 2) break;
                } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
            } else if (o <= 200) {
                if (s.spike) {
                    let e = s.pos.spike;
                    if (St.getDist(e, n, 0, 2) <= 100) {
                        let e = Ts.spikeKB({
                            x: n.x2,
                            y: n.y2,
                            scale: 35,
                            tmpObj: n
                        }, s.pos.spike, !0);
                        let t = () => this.checkPlace(2, s.angle, n);
                        if (e.data.find(e => "trap" == e.id)) {
                            if (t(), this.preplacements > 2) break;
                        } else if (e.data.find(e => "spiek" == e.id)) {
                            if (e.data.filter(e => "spiek" == e.id).reduce((e, t) => e + t.dmg, 0) + s.pos.spike.dmg >= 100) {
                                if (t(), this.preplacements > 2) break;
                            } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
                        } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
                    } else if (St.getAngleDist(ue.aim2, s.angle) <= .75 && i.find(t => St.getDist(e, t) <= 135)) {
                        if (this.checkPlace(2, s.angle, n), this.preplacements > 2) break;
                    } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
                } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
            } else if (s.trap && (this.checkPlace(4, s.angle, n), this.preplacements > 2)) break;
        }
        this.preplacements = 0;
    }
};

let wi = [];

let Mi = new class {
    constructor() {
        this.active = !1, this.target = null, this.aim = 0, this.tick = 0, this.weaponIndex = 10;
    }
    reset() {
        this.active = !1, this.aim = 0, this.target = null, this.weaponIndex = 0;
    }
    bestWeapon(e = oe.inTrap) {
        const t = oe.weapons[0];
        const i = oe.weapons[1];
        const s = $t.weapons[t];
        const n = 4 === t || 3 === t;
        if (10 !== i) return t;
        {
            const a = St.getDist(e, oe, 0, 2);
            const o = e.scale;
            const l = o + s.range;
            const r = o + $t.weapons[i].range;
            const h = e.health <= s.dmg;
            const c = a > r && a <= l;
            return Et.canHit(oe, e, t) && (n && c || 5 !== t && h) ? t : i;
        }
        return 10 === i ? i : t;
    }
    updateObjects() {
        if (!k("abactive").checked) return void this.reset();
        let e = $t.weapons[oe.weapons[0]].speed < 400 && oe.inTrap ? 0 : 10 === oe.weapons[1] ? 1 : 0;
        let t = ae.filter(t => t.active && St.getDist(t, oe, 0, 2) <= t.scale + $t.weapons[oe.weapons[e]].range && (oe.inTrap ? !t.isTeamObject(oe) && (t.dmg || t.trap) : !t.isTeamObject(oe) && (t.dmg || t.trap || t.teleport || t.boostSpeed)));
        if (t.length) if (t.sort((e, t) => {
            if (e.isTeamObject(oe) !== t.isTeamObject(oe)) return e.isTeamObject(oe) ? 1 : -1;
            if (e.dmg !== t.dmg) return e.dmg ? -1 : 1;
            if (e.trap !== t.trap) return e.trap ? -1 : 1;
            if (e.blocker !== t.blocker) return e.blocker ? -1 : 1;
            const i = St.getDist(e, oe, 0, 2);
            const s = St.getDist(t, oe, 0, 2);
            return i !== s ? i - s : e.health - t.health;
        }), this.target = t[0], this.target && oe) {
            this.weaponIndex = this.bestWeapon(this.target), this.active = 1;
            const e = $t.weapons[this.weaponIndex];
            const i = function(e, t, i = ae) {
                let s = i.filter(e => It(oe, e, "object") <= t);
                let n = St.getDirect(e, oe);
                let a = n;
                let o = [ e ];
                let l = 0;
                for (let i = 0; i < 36; i++) {
                    let r = n + St.toRad(10 * i);
                    let h = [];
                    let c = s.reduce((e, i) => {
                        let s = St.getDirect(i, oe);
                        return It(oe, i, "object") <= t && St.getAngleDist(s, r) <= x.gatherAngle ? (h.push(i),
                        e + 1) : e;
                    }, 0);
                    let d = St.getDirect(e, oe);
                    It(oe, e, "object") <= t && St.getAngleDist(d, r) <= x.gatherAngle && c > l && (l = c,
                    a = r, o = h);
                }
                return a;
            }(this.target, e.range, t) || St.getDirect(oe, this.target, 0, 2);
            this.aim = i;
        } else this.reset(); else this.reset();
    }
};

let yi = new class {
    constructor() {
        this.isTrue = !1, this.wait = !1, this.can = !1, this.waitOT = !1, this.oneTickProcess = !1,
        this.weapon = null, this.canSpikeTick = !1, this.reverseSpikeTick = !1, this.canBullHit = !1,
        this.canReverseHit = !1;
    }
    reset() {
        this.isTrue = !1, this.wait = !1, this.can = !1, this.waitOT = !1, this.oneTickProcess = !1,
        this.weapon = null, this.canSpikeTick = !1, this.reverseSpikeTick = !1, this.canBullHit = !1,
        this.canReverseHit = !1;
    }
    changeType(e) {
        this.wait = !1, this.isTrue = !0, oe.autoAim = !0, this.lastType = "instaKill";
        let t = ue.backupNobull;
        ue.backupNobull = !1, V.tickBase(() => {
            V.tickBase(() => {
                22 == ue.skinIndex && (ue.backupNobull = !0);
            }, 1);
        }, 1), "rev" == e ? (Qt(oe.weapons[1]), Vt(53, 0), Vt(21, 1), Jt(), V.tickBase(() => {
            Qt(oe.weapons[0]), Vt(7, 0), Vt(21, 1), V.tickBase(() => {
                Jt(), this.isTrue = !1, oe.autoAim = !1;
            }, 1);
        }, 1)) : "nobull" == e ? (Qt(oe.weapons[0]), Vt(t ? 7 : 6, 0), Vt(21, 1), Jt(),
        V.tickBase(() => {
            22 == ue.skinIndex ? (ue.backupNobull = !0, Vt(6, 0)) : Vt(53, 0), Qt(oe.weapons[1]),
            Vt(21, 1), V.tickBase(() => {
                Jt(), this.isTrue = !1, oe.autoAim = !1;
            }, 1);
        }, 1)) : "normal" == e ? (Qt(oe.weapons[0]), Vt(7, 0), Vt(21, 1), Jt(), V.tickBase(() => {
            Qt(oe.weapons[1]), Vt(0 == oe.reloads[53] ? 53 : 6, 0), Vt(21, 1), V.tickBase(() => {
                Jt(), this.isTrue = !1, oe.autoAim = !1;
            }, 1);
        }, 1)) : setTimeout(() => {
            this.isTrue = !1, oe.autoAim = !1;
        }, 50);
    }
    bullHit() {
        this.lastType = "hit", this.isTrue = !0, oe.autoAim = !0, Qt(oe.weapons[0]), Vt(7, 0),
        Vt(18, 1), Jt(), V.tickBase(() => {
            Jt(), this.isTrue = !1, oe.autoAim = !1;
        }, 1);
    }
    reverseHit(e) {
        this.lastType = "hit", null == e && (oe.autoAim = !0), this.isTrue = !0, Vt(53, 0),
        Vt(21, 1), V.tickBase(() => {
            St.getAngleDist(e - ue.aim2) <= .5 ? oe.autoAim = !0 : Y("D", e, 1), Qt(oe.weapons[0]),
            Vt(7, 0), Vt(18, 1), Jt(), V.tickBase(() => {
                Jt(), oe.autoAim = !1, this.isTrue = !1;
            }, 1);
        }, 1);
    }
    spikeTick() {
        this.lastType = "spikeTick", this.isTrue = !0, oe.autoAim = !0, Qt(oe.weapons[0]),
        Vt(7, 0), Vt(18, 1), Jt(), V.tickBase(() => {
            Vt(53, 0), Vt(21, 1), V.tickBase(() => {
                Jt(), this.isTrue = !1, oe.autoAim = !1;
            }, 1);
        }, 1);
    }
    checReverseSpikeTick() {
        if (this.reverseSpiketick = !1, 5 != oe.weapons[0] && 4 != oe.weapons[0]) return;
        if (!ue || !ue.inTrap) return !1;
        let e = ue.inTrap;
        if (10 != oe.weapons[1] || St.getDist(oe, e) - 50 > 75 || Dt.reloadPercent(oe, 10) < 1 || Dt.reloadPercent(oe, oe.weapons[0]) < 1 || e.health - 75 * (oe.skins[40] ? 3.3 : 1) > 0) return !1;
        let t = $t.list[oe.items[2]];
        let i = St.calculatePosition(oe, 30 + t.scale, ue.aim2);
        return !!Et.checkItemLocation(i.x, i.y, t.scale, .6, oe.items[2], !1, e);
    }
    rangeType(e) {
        this.isTrue = !0, oe.autoAim = !0, "ageInsta" == e ? (this.lastType = "ageBowInsta",
        pt = !1, 18 == oe.items[5] && si(5, ue.aim2), Vt(22, 0), Vt(21, 1), V.tickBase(() => {
            Qt(oe.weapons[1]), Vt(53, 0), Vt(21, 1), Jt(), V.tickBase(() => {
                Lt(12), Qt(oe.weapons[1]), Vt(53, 0), Vt(21, 1), V.tickBase(() => {
                    Lt(15), Qt(oe.weapons[1]), Vt(53, 0), Vt(21, 1), V.tickBase(() => {
                        Jt(), this.isTrue = !1, oe.autoAim = !1;
                    }, 1);
                }, 1);
            }, 1);
        }, 1)) : (this.lastType = "bow", Qt(oe.weapons[1]), 0 == oe.reloads[53] && ue.dist2 <= 700 && 22 != ue.skinIndex ? Vt(53, 0) : Vt(20, 0),
        Vt(11, 1), Jt(), V.tickBase(() => {
            Jt(), this.isTrue = !1, oe.autoAim = !1;
        }, 1));
    }
    bowMovement() {
        ue.dist2 < 590 ? (Vt(6, 0), Xi(ue.aim2 + c)) : 22 != ue.skinIndex ? (Xi(void 0),
        V.tickBase(() => {
            this.rangeType("ageInsta");
        }, 1)) : ue.dist2 >= 630 ? Xi(ue.aim2) : Xi(void 0);
    }
    oneTick(e, t) {
        this.oneTickProcess = !0;
        let i = St.getDirect(ue, oe, 3, 2);
        Gt("Tick process"), t || Xi(i), Zt(ue.aim2), e ? (0 == oe.reloads[oe.weapons[0]] && Qt(oe.weapons[1]),
        Vt(53, 0), oe.autoAim = !0, this.isTrue = !0, V.tickBase(() => {
            Qt(oe.weapons[0]), Vt(7, 0), Jt(), t || Xi(i), V.tickBase(() => {
                Jt(), oe.autoAim = !1, this.isTrue = !1, this.oneTickProcess = !1, this.waitOT = !1,
                V.tickBase(() => {
                    Xi(void 0);
                }, 1);
            }, 1);
        }, 1)) : (this.isTrue = !0, V.tickBase(() => {
            t || Xi(i), Vt(53, 0), oe.autoAim = !0, V.tickBase(() => {
                Qt(oe.weapons[0]), Vt(7, 0), Jt(), t || Xi(i), V.tickBase(() => {
                    oe.autoAim = !1, Jt(), this.isTrue = !1, this.oneTickProcess = !1, this.waitOT = !1,
                    V.tickBase(() => {
                        Xi(void 0);
                    }, 1);
                }, 1);
            }, 1);
        }, 1));
    }
    perfCheck(e, t, i = 0) {
        if (!i || i && D.doStopInstaOnShield && 11 == t.weaponIndex && St.getAngleDist(t.aim2 + Math.PI, t.d2) <= x.shieldAngle) return !1;
        if (![ 9, 12, 13, 15 ].includes(oe.weapons[1])) return !0;
        let s = {
            x: t.x2 + 65 * Math.cos(t.aim2 + Math.PI),
            y: t.y2 + 65 * Math.sin(t.aim2 + Math.PI)
        };
        if (St.lineInRect(e.x2 - e.scale, e.y2 - e.scale, e.x2 + e.scale, e.y2 + e.scale, s.x, s.y, s.x, s.y)) return !0;
        let n = Z.filter(e => e.visible).find(e => {
            if (St.lineInRect(e.x2 - e.scale, e.y2 - e.scale, e.x2 + e.scale, e.y2 + e.scale, s.x, s.y, s.x, s.y)) return !0;
        });
        return !n && (n = ae.filter(e => e.active).find(e => {
            let t = e.getScale();
            if (!e.ignoreCollision && St.lineInRect(e.x - t, e.y - t, e.x + t, e.y + t, s.x, s.y, s.x, s.y)) return !0;
        }), !n);
    }
    getInstaType() {
        D.doAgeInsta || D.doKatanaHammerInsta && oe.skins[7] && oe.skins[53] && 6 != ue.skinIndex && 22 != ue.skinIndex && 4 == oe.weapons[0] && oe.weapons[1];
    }
    update() {}
};

class vi {
    static items=[ [ 11, 1 ], [ 40, 0 ], [ 6, 0 ], [ 7, 0 ], [ 31, 0 ], [ 15, 0 ], [ 22, 0 ], [ 53, 0 ], [ 12, 0 ], [ 20, 0 ], [ 10, 0 ], [ 56, 0 ], [ 21, 1 ], [ 11, 0 ], [ 26, 0 ], [ 18, 1 ], [ 13, 1 ], [ 19, 1 ] ];
    static buyNext() {
        for (const [e, t] of this.items) {
            const i = we(0 === t ? Ct : Ht, e);
            const s = 0 === t ? oe.skins[e] : oe.tails[e];
            if (i && !s) return oe.points >= i.price ? void Y("c", 1, e, t) : void 0;
        }
    }
}

let ki = [];

let xi;

let Oi;

let Si = {};

let Ii = [];

let Di;

const Ti = {
    0: 9,
    2: 12,
    3: 13,
    5: 15
};

let Ai = [];

function $i(e, t, i, s, n, a, o, l) {
    const r = Ti[a] || 0;
    const h = 2 * x.playerScale;
    const c = 1 === a;
    const d = {
        x: c ? e : e - h * Math.cos(i),
        y: c ? t : t - h * Math.sin(i)
    };
    let f = null;
    let u = oe.scale;
    for (let e = 0, t = ee.length; e < t && oe.visible; e++) {
        const t = ee[e];
        const i = St.getDist(d, t, 0, 2);
        i <= u && (u = i, f = t);
    }
    f && (c ? (f.shooting[53] = 1, function(e) {
        e.dist2 <= 300 && oe.alive && (e == oe || e.team && e.team == oe.team || e.primaryIndex && 5 != e.primaryIndex || oe.reloads[oe.primary] || !(null == e.primaryVariant || e.primaryVariant >= 2) || Bs());
    }(f)) : (f.shootIndex = r, f.shooting[1] = 1, function(e, t, i, s, n, a) {
        if (de.includes(e) && (at = St.getDirect(oe, e, 2, 2), St.getAngleDist(at, t) <= .2)) {
            e.bowThreat[a]++, 5 == n && Pi++, setTimeout(() => {
                e.bowThreat[a]--, 5 == n && Pi--;
            }, i / s);
            const t = x.isPrivateServer ? 3 : 1;
            D.doAntiRangedInstas && (e.bowThreat[9] >= 1 && (e.bowThreat[12] >= 1 || e.bowThreat[15] >= 1) ? (si(t, e.aim2),
            li || ri(), Gt("ranged insta homo")) : Pi >= 2 && (D.doAutoShieldAnti && 11 == oe.weapons[1] && (oe.shieldAnti = !0,
            Qt(11)), si(t, e.aim2), li || ri(), Gt("ranged sync homo")));
        }
    }(f, i, s, n, a, r)));
}

let Pi = 0;

function Hi(e, t, i) {
    if (oe && e) if (St.removeAllChildren(Ge), Ge.classList.add("visible"), St.generateElement({
        id: "itemInfoName",
        text: St.capitalizeFirst(e.name),
        parent: Ge
    }), St.generateElement({
        id: "itemInfoDesc",
        text: e.desc,
        parent: Ge
    }), i) ; else if (t) St.generateElement({
        class: "itemInfoReq",
        text: e.type ? "secondary" : "primary",
        parent: Ge
    }); else {
        for (let t = 0; t < e.req.length; t += 2) St.generateElement({
            class: "itemInfoReq",
            html: e.req[t] + "<span class='itemInfoReqVal'> x" + e.req[t + 1] + "</span>",
            parent: Ge
        });
        e.group.limit && St.generateElement({
            class: "itemInfoLmt",
            text: (oe.itemCounts[e.group.id] || 0) + "/" + (x.isSandbox ? 99 : e.group.limit),
            parent: Ge
        });
    } else Ge.classList.remove("visible");
}

function Ci() {
    Ye == x.maxScreenWidth && Ze == x.maxScreenHeight || (Ye = x.maxScreenWidth, Ze = x.maxScreenHeight,
    Ri());
}

let Bi = !1;

function Ri() {
    Qe = window.innerWidth, Je = window.innerHeight;
    let e = 1 * Math.max(Qe / Ye, Je / Ze);
    ge.width = 1 * Qe, ge.height = 1 * Je, ge.style.width = Qe + "px", ge.style.height = Je + "px",
    be.setTransform(e, 0, 0, e, (1 * Qe - Ye * e) / 2, (1 * Je - Ze * e) / 2);
}

window.addEventListener("resize", St.checkTrusted(Ri)), Ri();

let _i = x.isPrivateServer ? ge : k("touch-controls-fullscreen");

let Ni = x.isPrivateServer ? ge : _i.cloneNode(!0);

x.isPrivateServer || _i.replaceWith(Ni);

let Ei = {
    left: !1,
    middle: !1,
    right: !1
};

function zi() {
    let e = 0;
    let t = 0;
    for (let i in bt) {
        let s = bt[i];
        e += !!gt[i] * s[0], t += !!gt[i] * s[1];
    }
    return 0 == e && 0 == t ? void 0 : St.fixTo(Math.atan2(t, e), 2);
}

function qi() {
    return oe ? (oe.lockDir || (U = Math.atan2(lt - Je / 2, ot - Qe / 2)), St.fixTo(U || 0, 2)) : 0;
}

function Fi() {
    if (!oe) return 0;
    let e = V.tick % 2 ? 1e53 : Number.MAX_VALUE;
    return oe.shieldAnti ? U = ue.aim2 : oe.autoAim || yi.isTrue || Ei.left && 0 == oe.reloads[oe.weapons[0]] ? U = de.length ? ue.aim2 : x.isPrivateServer && k("grind").checked ? e : qi() : Ei.right && 0 == oe.reloads[oe.weapons[10 == oe.weapons[1] ? 1 : 0]] ? U = x.isPrivateServer ? e : qi() : Mi.active ? U = x.isPrivateServer && k("ab360hit").checked ? e : Mi.aim : oe.lockDir || (U = qi()),
    U || 0;
}

function ji() {
    return oe ? qi() : 0;
}

Ni.onmousemove = function(e) {
    ot = e.clientX, lt = e.clientY;
}, Ni.onmousedown = function(e) {
    1 != wt && (wt = 1, 0 == e.button ? Ei.left = !0 : 1 == e.button ? Ei.middle = !0 : 2 == e.button && (Ei.right = !0));
}, Ni.onmouseup = function(e) {
    0 != wt && (wt = 0, 0 == e.button ? Ei.left = !1 : 1 == e.button ? Ei.middle = !1 : 2 == e.button && (Ei.right = !1));
}, Ni.onwheel = function(e) {
    e.deltaY < 0 ? oe.reSync = !0 : oe.reSync = !1;
};

let Gi = !1;

class Li {
    static spam=void 0;
    static active=0;
    static chat=[ "Don't care", "didin't ask", "cry about it", "stay mad", "cancelled", "get real", "L", "mad seethe cope harder", "hoes mad", "basic", "skill issue", "ratio", "you fell off", "peedophile", "the audacity", "mald seethe cope harder", "your problem", "triggered", "glhf", "any askers", "irrelevant", "lol", "ok and?", "cringe", "touch grass", "donowalled", "who asked?", "not funny didn\u2019t laugh", "*you're", "freer than air", "GG!", "grammar issues", "no cap", "not funny right now", "go outside", "cope", "get good", "reported", "ad hominem", "GG!", "ask deez", "ez clap", "straight cash", "ratio again", "stay mad", "final ratio", "problematic", "furry lover", "stay pressed", "retard", "ratio again", "don't care even more", "sex offender", "cringe again", "rip bozo", "beta male", "soyboy", "basic", "ass", "get better", "bis niggr", "bozo", "replled", "not based", "get a life" ];
    static update() {
        this.active = !this.active, this.active ? this.spam = setInterval(() => {
            Y("6", this.chat[Math.floor(Math.random() * this.chat.length)]);
        }, 2e3) : clearInterval(this.spam);
    }
}

function Wi() {
    return ("INPUT" != document.activeElement.tagName || "number" != document.activeElement.type && "text" != document.activeElement.type) && "block" != Re.style.display && "flex" != Ee.style.display;
}

function Ki(e, t) {
    return !(!k(t + "k").checked || e != k(t).value);
}

addEventListener("keydown", St.checkTrusted(function(e) {
    if (!oe?.alive || !Wi()) return;
    let t = e.which || e.keyCode || 0;
    if (!gt[t]) if (gt[t] = 1, ui.key[e.key] = 1, 27 == t) $("#modMenus").toggle(),
    Gi = !Gi, Gi ? (Fe.style.display = "none", ze.style.left = "410px", ze.style.width = "40px",
    qe.style.left = "350px", qe.style.width = "40px") : (Fe.style.display = "block",
    ze.style.left = "330px", ze.style.width = "40px", qe.style.left = "270px", qe.style.width = "40px"); else if (69 == t) Jt(); else if (67 == t) Si.x = oe.x,
    Si.y = oe.y; else if (null != oe.weapons[t - 49]) oe.weaponCode = oe.weapons[t - 49]; else if (bt[t]) Xi(zi(), 1); else if (de.length && Ki(e.key, "OTkey")) yi.waitOT = !yi.waitOT; else if (82 == t) {
        yi.wait = !yi.wait;
        for (let e = 0; e < ee.length; e++) re = ee[e], re.visible && (6 == re.skinIndex || 22 == re.skinIndex ? re.anti = !0 : re.anti = !1);
    } else 86 == t ? ui.spike = !0 : 70 == t ? ui.trap = !0 : 72 == t ? ui.turret = !0 : Ki(e.key, "millkey") ? pi.active = !pi.active : Ki(e.key, "freecamKey") ? (Vi.active = !Vi.active,
    k("freeCam").innerHTML = "Freecam: " + (Vi.active ? "true" : "none"), Ci()) : Ki(e.key, "nerdSpam") ? Li.update() : Ki(e.key, "zoomkey") ? Bi = !Bi : Ki(e.key, "debugkey") ? (Bi = !1,
    Ci()) : Ki(e.key, "zoomresetkey") && "function" == typeof window.debug && window.debug();
})), window.addEventListener("keyup", St.checkTrusted(function(e) {
    if (!oe?.alive || !Wi()) return;
    let t = e.which || e.keyCode || 0;
    gt[t] && (gt[t] = 0, ui.key[e.key] = 0, bt[t] ? Xi(zi(), 1) : 86 == t ? ui.spike = !1 : 70 == t ? ui.trap = !1 : 72 == t && (ui.turret = !1));
}));

let Vi = {
    active: !1,
    dir: void 0
};

function Xi(e, t) {
    t && (Ui.active || Vi.active) || Y("9", e, 1);
}

let Ui = new class {
    constructor() {
        this.active = !1, this.pos = {}, this.spike = null, this.nearTrap = null;
    }
    reset() {
        this.active && (this.active = !1, Xi(void 0));
    }
    findObjects() {
        const e = ue.scale;
        if (this.nearTrap = ae.filter(t => t.trap && t.isTeamObject(oe) && St.getDist(t, ue, 0, 2) <= e + t.getScale() + 5).sort((e, t) => St.getDist(e, ue, 0, 2) - St.getDist(t, ue, 0, 2))[0],
        this.nearTrap) {
            if (this.spike = ae.filter(t => t.dmgObject(oe, ue) && St.getDist(t, this.nearTrap, 0, 0) <= e + this.nearTrap.scale + t.scale).sort((e, t) => St.getDist(e, ue, 0, 2) - St.getDist(t, ue, 0, 2))[0],
            this.spike) return this.spike = ae.filter(t => t.dmgObject(oe, ue) && St.getDist(t, this.nearTrap, 0, 0) <= e + this.nearTrap.scale + t.scale).sort((e, t) => St.getDist(e, ue, 0, 2) - St.getDist(t, ue, 0, 2)).slice(0, 2),
            this.spike && 0 !== this.spike.length ? void 0 : (this.spike = null, void this.reset());
            this.reset();
        } else this.reset();
    }
    canPush() {
        if (St.lineInCircle(oe.x2, oe.y2, this.pos.x, this.pos.y, ue.x2, ue.y2, 35)) return !1;
        for (let e of ae) if (15 != e.id || !e.isTeamObject(oe)) if (e.dmg && !e.isTeamObject(oe) || 16 == e.id || 22 == e.id) {
            if (St.lineInCircle(oe.x2, oe.y2, this.pos.x, this.pos.y, e.x, e.y, 35 + e.getScale(.6, e.isItem))) return !1;
        } else if (St.lineInCircle(oe.x2, oe.y2, this.pos.x, this.pos.y, e.x, e.y, .75 * e.getScale(.6, e.isItem))) return !1;
        return !0;
    }
    checkDangerousCollisions(e) {
        return ae.some(t => t.active && t.dmg && !t.isTeamObject(oe) && St.getDist(t, e, 0, 2) <= t.getScale() + 35);
    }
    calculateMidPoint() {
        if (2 !== this.spike.length) return this.spike[0];
        if (St.getDist(this.spike[0], this.spike[1], 0, 0) > 170) {
            const e = St.getDist(this.spike[0], this.nearTrap);
            const t = St.getDist(this.spike[1], this.nearTrap);
            if (Math.abs(e - t) < 10) {
                return St.getDist(this.spike[0], ue, 0, 2) < St.getDist(this.spike[1], ue, 0, 2) ? this.spike[0] : this.spike[1];
            }
            return e < t ? this.spike[0] : this.spike[1];
        }
        const e = St.findMiddlePoint(this.spike[0], this.spike[1]);
        const t = 1 === this.spike[0].type ? .55 * this.spike[0].scale : this.spike[0].scale;
        const i = 1 === this.spike[1].type ? .55 * this.spike[1].scale : this.spike[1].scale;
        if (St.getDist(e, this.spike[0]) <= 30 + t && St.getDist(e, this.spike[1]) <= 30 + i) return {
            x: e.x,
            y: e.y,
            scale: (t + i) / 2 * .9
        };
        const s = St.getDist(this.spike[0], this.nearTrap);
        const n = St.getDist(this.spike[1], this.nearTrap);
        if (Math.abs(s - n) < 10) {
            return St.getDist(this.spike[0], ue, 0, 2) < St.getDist(this.spike[1], ue, 0, 2) ? this.spike[0] : this.spike[1];
        }
        return s < n ? this.spike[0] : this.spike[1];
    }
    update() {
        if (this.findObjects(), !this.nearTrap || !this.spike || !this.spike.length) return void this.reset();
        let e = 2 === this.spike.length ? this.calculateMidPoint() : this.spike[0];
        const t = St.getDirect(ue, e, 2, 0);
        const i = St.getDist(ue, e, 2, 0);
        let s = e.x + e.scale * Math.cos(Math.atan2(this.nearTrap.y - e.y, this.nearTrap.x - e.x));
        let n = e.y + e.scale * Math.sin(Math.atan2(this.nearTrap.y - e.y, this.nearTrap.x - e.x));
        if (this.pos = {
            x: s + (St.getDistance(s, n, ue.x2, ue.y2) + 35) * Math.cos(Math.atan2(ue.y2 - n, ue.x2 - s)),
            y: n + (St.getDistance(s, n, ue.x2, ue.y2) + 35) * Math.sin(Math.atan2(ue.y2 - n, ue.x2 - s)),
            x2: e.x + (i + 1.5 * oe.scale) * Math.cos(t),
            y2: e.y + (i + 1.5 * oe.scale) * Math.sin(t)
        }, ae.filter(e => e.active).find(e => {
            let t = e.getScale();
            if (!e.ignoreCollision && St.lineInRect(e.x - t, e.y - t, e.x + t, e.y + t, oe.x2, oe.y2, this.pos.x2, this.pos.y2)) return !0;
        }) || !this.canPush() || this.checkDangerousCollisions(this.pos)) this.reset(); else {
            this.active = !0;
            let t = Et.checkCollisionToObject(ue, e);
            D.doAutoPushOnBullspam && t && (yi.canSpikeTick = !0);
            let i = oe.scale / 10;
            St.lineInRect(oe.x2 - i, oe.y2 - i, oe.x2 + i, oe.y2 + i, ue.x2, ue.y2, this.pos.x, this.pos.y) ? Xi(St.getDirect(this.pos, oe, 0, 2)) : Xi(St.getDirect(this.pos, oe, 2, 2));
        }
    }
};

class Qi {
    static spike={};
    static showText=0;
    static update() {
        if (oe.inTrap) return;
        let e = ae.find(e => e.dmg && e.active && !e.isTeamObject(oe) && St.getDist(e, oe, 0, 3) <= 2 * oe.scale + e.getScale());
        if (!e) return this.spike.active && (this.spike.active = !1), void (this.showText && (this.showText = 0));
        e ? (this.spike.active = !0, this.spike.x = e.x, this.spike.y = e.y, this.spike.scale = e.getScale() || e.scale) : this.spike.active = !1;
        let t = St.getDirect(e, oe, 0, 2);
        let i = zi();
        Math.abs(t - i) < Math.PI / 2 ? (this.showText || (this.showText = 1, At.showText(oe.x, oe.y, 35, .3, 800, "stop", "#fff")),
        Xi(null)) : this.showText = 0;
    }
}

let Ji = [];

function Yi(e = void 0) {
    for (let t = 3; t < $t.list.length; ++t) {
        let i = $t.list[t].group.id;
        let s = $t.weapons.length + t;
        Ji[s] ? e == i && (Ji[s].innerHTML = oe.itemCounts[e] || 0) : (Ji[s] = document.createElement("div"),
        Ji[s].id = "itemCount" + s, k("actionBarItem" + s).appendChild(Ji[s]), Ji[s].style = "\n            display: block;\n            position: absolute;\n            padding-left: 5px;\n            font-size: 2em;\n            color: #fff;\n            ",
        Ji[s].innerHTML = oe.itemCounts[i] || 0);
    }
}

let Zi = document.createElement("div");

function es(e) {
    te = e.teams;
}

function ts(e) {
    gt = {}, le = e, wt = 0, Mt = !0, Yt(0, Fi()), pt = !0, mt && (mt = !1, ne.length = 0);
}

function is(e, t) {
    let i = ye(e[0]);
    i || (i = new jt(e[0], e[1], x, St, qt, Et, ee, Z, $t, Ct, Ht), ee.push(i)), i.spawn(!!t || null),
    i.visible = !1, i.oldPos = {
        x2: void 0,
        y2: void 0
    }, i.x2 = void 0, i.y2 = void 0, i.x3 = void 0, i.y3 = void 0, i.setData(e), t && (oe = i,
    st = oe.x, nt = oe.y, J.lastDir = 0, oe.secondaryVariant = void 0, oe.primaryVariant = void 0,
    Ks(), ds(), Yi(), k("priXP").innerHTML = "Primary XP: 0 / not found", k("secXP").innerHTML = "Secondary XP: 0 / not found");
}

document.body.appendChild(Zi), Zi.id = "status", Zi.style = "\n    display: block;\n    position: absolute;\n    color: #fff;\n    font: 15px Hammersmith One;\n    top: 40px;\n    right: 20px;\n",
Zi.innerHTML = "\n    <div class = \"sizing\" style = \"display: block;\">\n        <div id = \"hatdispdiv\" style = \"display: block\">\n          <div id = \"hatdisp6\" class = \"augh\" style = \"background-image: url(https://moomoo.io/img/hats/hat_6.png);\"></div>\n          <div id = \"hatdisp7\" class = \"augh\" style = \"background-image: url(https://moomoo.io/img/hats/hat_7.png);\"></div>\n          <div id = \"hatdisp40\" class = \"augh\" style = \"background-image: url(https://moomoo.io/img/hats/hat_40.png);\"></div>\n          <div id = \"hatdisp22\" class = \"augh\" style = \"background-image: url(https://moomoo.io/img/hats/hat_22.png);\"></div>\n          <div id = \"hatdisp15\" class = \"augh\" style = \"background-image: url(https://moomoo.io/img/hats/hat_15.png);\"></div>\n        </div>\n        Auto-Insta: <div id = \"autoInsta\" class = \"mod\">0</div></br>\n        EAB: {<div id = \"eabStatus\" class = \"mod\"></div>}</br>\n        Music: <div id = \"musicStatus\" class = \"mod\">0</div></br>\n        AdvPlacer: <div id = \"millStatus\" class = \"mod\">0</div></br>\n    </div>\n",
Fe.style.position = "fixed", Fe.style.left = "20px", Fe.style.right = null, Fe.style.display = "block",
ze.style.right = null, qe.style.right = null, ze.style.left = "330px", ze.style.width = "40px",
qe.style.left = "270px", qe.style.width = "40px", Le.appendChild(Ue), x.isSandbox ? (Ke.style.display = "none",
Ve.style.display = "none", Xe.style.display = "none", We.style.display = "none",
Ue.style.bottom = "20px", Ue.style.right = "20px") : (Ue.style.bottom = "185px",
Ue.style.right = "20px", We.style.bottom = "240px", We.style.right = "20px", We.style.left = "inherit",
We.style.backgroundPosition = "right 6px center", We.style.paddingLeft = "10px",
We.style.paddingRight = "40px");

const ss = u(.993, 111);

function ns(i, s, n, a, o = 111) {
    i.vel || (i.vel = {
        accel: {},
        decel: {},
        boostCoords: {},
        boostVel: {},
        nextVel: {},
        real: {},
        current: {},
        fullDecel: {}
    }), a || (i.sid != oe.sid || 0 === s || s ? oe.inTrap && i.sid == oe.sid ? s = void 0 : s || 0 === s || (s = i.movDir) : s = oe.moveDir);
    let l = void 0 !== s ? t(s) : 0;
    let h = void 0 !== s ? e(s) : 0;
    let c = l * l + h * h;
    c > 0 && (c = d(c), l /= c, h /= c), n || (n = i);
    let f = function(e) {
        let t = ((e.buildIndex < 0) + 1) / 2 * ($t.weapons[e.weaponIndex]?.spdMult || 1) * (e.skinIndex && Ct.find(t => t.id == e.skinIndex)?.spdMult || 1) * (e.tailIndex && Ht.find(t => t.id == e.tailIndex)?.spdMult || 1) * (e.y2 <= x.snowBiomeTop ? e.skinIndex && Ct.find(t => t.id == e.skinIndex)?.coldM ? 1 : .75 : 1) * 1;
        return !e.zIndex && e.y2 >= x.mapScale / 2 - x.riverWidth / 2 && e.y2 <= x.mapScale / 2 + x.riverWidth / 2 && (e.skinIndex && Ct.find(t => t.id == e.skinIndex).watrImm ? t *= .75 : t *= .33),
        t;
    }(n);
    i.speedXD = .0016 * l * f * o, i.speedYD = .0016 * h * f * o, i.predX = i.speedXD * o,
    i.predY = i.speedYD * o;
    let p = i.xVel * u(.993, o);
    let m = i.yVel * u(.993, o);
    let g = p + i.predX;
    let b = m + i.predY;
    {
        let e = g, t = b;
        let s = i.x2, n = i.y2;
        for (let i = 0; i < 50; i++) {
            let i = e * ss;
            let a = t * ss;
            if (e === i && t === a) break;
            e = i, t = a, s += e, n += t;
        }
        i.vel.fullDecel.x = s, i.vel.fullDecel.y = n, i.vel.fullDecel.type = "full decel";
    }
    i.vel.accel.x = i.x2 + g, i.vel.accel.y = i.y2 + b, i.vel.accel.type = "accel",
    i.vel.decel.x = i.x2 + p, i.vel.decel.y = i.y2 + m, i.vel.decel.type = "decel",
    i.vel.current.x = i.x2, i.vel.current.y = i.y2, i.vel.current.type = "current",
    i.vel.nextVel.x = g, i.vel.nextVel.y = b, i.vel.nextVel.type = "nextVel", i.vel.vel = r(d(g * g + b * b));
    let w = 1.5 * o * l;
    let M = 1.5 * o * h;
    i.vel.boostCoords.x = i.x2 + w, i.vel.boostCoords.y = i.y2 + M, i.vel.boostVel.x = w,
    i.vel.boostVel.y = M;
    let y = i.vel.accel;
    if (void 0 !== he[i.sid]?.vel && i != oe) {
        St.getDist(i, he[i.sid].vel.accel) > St.getDist(i, he[i.sid].vel.decel) && St.getAngleDist(i.movDir, i.pmovDir) <= .3 && (y = i.vel.decel);
    }
    return i == oe && (y = null == oe.moveDir ? i.vel.decel : i.vel.accel), i.vel.real = y,
    i.vel.spd = f, i.vel;
}

function as(i = oe) {
    let s = V.tickRate;
    const n = function(i, s, n, a) {
        a && "number" == typeof a || (a = V.tickRate);
        let o = t(s);
        let l = e(s);
        let r = d(o * o + l * l);
        0 != r && (o /= r, l /= r), n || (n = i);
        const h = u(.993, a);
        const c = .0016 * n.maxSpeed * a * a;
        const f = i.xVel * h + o * c;
        const p = i.yVel * h + l * c;
        return {
            xVel: f,
            yVel: p,
            x2: (i.x2 ?? i.x) + f,
            y2: (i.y2 ?? i.y) + p
        };
    }(i, ue.aim3, {
        maxSpeed: .77
    }, s);
    let a = n.x2 - oe.x2;
    let o = n.y2 - oe.y2;
    let l = n.x2;
    let r = n.y2;
    let h = t(ue.aim3);
    let c = e(ue.aim3);
    i.speedXD = 0, i.speedYD = 0, i.predY = 0, i.predX = 0, h && (i.speedXD += .0016896 * h * s),
    c && (i.speedYD += .0016896 * c * s), i.speedXD && (i.predX += i.speedXD * s), i.speedYD && (i.predY += i.speedYD * s);
    let f = a * u(.993, s);
    let p = o * u(.993, s);
    return {
        x: l + (f + i.predX),
        y: r + (p + i.predY)
    };
}

function os(e) {
    const t = ee.findIndex(t => t.id === e);
    -1 !== t && ee.splice(t, 1);
}

let ls = [];

function rs(e, t) {
    if (re = ve(e), !re) return;
    let i = t - re.health;
    if (re.oldHealth = re.health, re.health = t, i < 0 ? (i == -5 * (re.skin?.dmgMult || 1) && re.dmgOverTime.time > -1 && re.dmgOverTime.time--,
    re.lastBleed.amount = i, re.lastBleed.time = Date.now() - window.pingTime, re.lastBleed.healed = !1) : i > 0 && (re.lastBleed.healed || (Date.now() - window.pingTime - re.lastBleed.time <= 120 ? re.shameCount++ : re.shameCount = Math.max(0, re.shameCount - 2),
    re.lastBleed.healed = !0)), re.oldHealth > re.health) if (re.damaged = re.oldHealth - re.health,
    re == oe) {
        ls.push([ e, t, re.damaged ]);
        let i = ae.filter(e => St.getDist(oe, e, 2, 0) <= e.scale + 35 && e.active && e.dmg && !e.isTeamObject(oe) || 1 == e.type && e.y >= 12e3);
        i.length && re.damaged == -(1 != i[0]?.type ? i[0]?.dmg : 35) * (6 == re.skinIndex ? .75 : 1) && (re.touchSpike = i[0]);
    } else if (ue && re === ue) {
        if (Dt.inRange(oe, ue, $t.weapons[oe.weapons[0]].range, !0) && 0 == oe.reloads[oe.weapons[0]]) {
            let e = Dt.weaponDmg(oe, re);
            re.health <= e && (yi.autoKillerHit = !0);
        }
        if (re?.inTrap) {
            let e = ae.filter(e => St.getDist(re.inTrap, e, 0, 0) <= 50 + e.scale + 35 && e.active && e.dmg && !e.isTeamObject(re) || 1 == e.type && e.y >= 12e3);
            e.length && re.damaged == -(1 != e[0]?.type ? e[0]?.dmg : 35) * (6 == re.skinIndex ? .75 : 1) && (re.hitSpike = !0);
        }
    }
}

function hs() {
    Mt = !1, xi = {
        x: oe.x,
        y: oe.y
    }, Oe.style.display = "none", setTimeout(function() {
        Y("M", {
            name: Q[0],
            moofoll: Q[1],
            skin: Q[2]
        });
    }, 0);
}

function cs(e, t) {
    oe && (oe.itemCounts[e] = t, Yi(e));
}

function ds(e, t, i) {
    null != e && (oe.XP = e), null != t && (oe.maxXP = t), null != i && (oe.age = i);
}

function fs(e, t) {
    if (oe.upgradePoints = e, oe.upgrAge = t, e > 0) {
        ki.length = 0, St.removeAllChildren(_e);
        for (let e = 0; e < $t.weapons.length; ++e) if ($t.weapons[e].age == t && (x.isPrivateServer || null == $t.weapons[e].pre || oe.weapons.indexOf($t.weapons[e].pre) >= 0)) {
            St.generateElement({
                id: "upgradeItem" + e,
                class: "actionBarItem",
                onmouseout: function() {
                    Hi();
                },
                parent: _e
            }).style.backgroundImage = k("actionBarItem" + e).style.backgroundImage, ki.push(e);
        }
        for (let e = 0; e < $t.list.length; ++e) if ($t.list[e].age == t && (x.isPrivateServer || null == $t.list[e].pre || oe.items.indexOf($t.list[e].pre) >= 0)) {
            let t = $t.weapons.length + e;
            St.generateElement({
                id: "upgradeItem" + t,
                class: "actionBarItem",
                onmouseout: function() {
                    Hi();
                },
                parent: _e
            }).style.backgroundImage = k("actionBarItem" + t).style.backgroundImage, ki.push(t);
        }
        for (let e = 0; e < ki.length; e++) (function(e) {
            let t = k('upgradeItem' + e);
            t.onmouseover = function() {
                $t.weapons[e] ? Hi($t.weapons[e], !0) : Hi($t.list[e - $t.weapons.length]);
            }, t.onclick = St.checkTrusted(function() {
                Y("H", e);
            }), St.hookTouchEvents(t);
        })(ki[e]);
        ki.length ? (_e.style.display = "block", Ne.style.display = "block", Ne.innerHTML = "SELECT ITEMS (" + e + ")",
        k("aeaeaeaeUpgrade").checked && function(e, t) {
            if (k("autoUpgradeStopper").checked) return;
            2 === t ? "dh" === e ? ps(7) : "ph" === e ? ps(5) : "kh" !== e && "sm" !== e || ps(3) : 3 == t ? Lt(17) : 4 == t ? Lt(31) : 5 == t ? "sm" === e ? Lt(23) : ps(27) : 6 === t ? "sm" === e ? Lt(9) : ps(10) : 7 === t ? ps(k("7slot").value) : 8 == t ? "kh" === e && Lt(4) : 9 == t && "kh" === e && Lt(25);
        }(k("autoupgrade").value, t)) : (_e.style.display = "none", Ne.style.display = "none",
        Hi());
    } else _e.style.display = "none", Ne.style.display = "none", Hi();
}

let us = !1;

let ps = function(e) {
    us || k("upgradeItem" + e) && "none" != k("upgradeItem" + e).style.display && (us = !0,
    Lt(e), e >= 0 && e <= 15 && (e < 9 ? Qt(e) : e > 8 && Qt(oe.weapons[0])), setTimeout(() => {
        us = !1;
    }, window.pingTime));
};

class ms {
    static objects=[];
    static tracers=[];
    static update(e) {
        if (!oe.canSee(e)) {
            this.objects.push({
                x: e.x,
                y: e.y,
                timestamp: Date.now()
            });
            let t = !0;
            let i = 0;
            for (let t of this.objects) {
                Math.sqrt(Math.pow(e.x - t.x, 2) + Math.pow(e.y - t.y, 2)) <= 2400 && i++;
            }
            i >= 2 && (t = !1);
            for (let i of this.tracers) {
                if (Math.sqrt(Math.pow(e.x - i.x, 2) + Math.pow(e.y - i.y, 2)) <= 2400) {
                    t = !1;
                    break;
                }
            }
            t && this.tracers.push({
                x: e.x,
                y: e.y,
                timestamp: Date.now()
            });
        }
        this.objects.length > 8 && this.objects.shift(), this.tracers.length > 8 && this.tracers.shift();
    }
    static renderTracer(e, t) {
        if (D.doInfiniteRangeTracers) return;
        const i = Date.now();
        ms.tracers = ms.tracers.filter(s => !(i - s.timestamp > 100) && (function(e, t, i, s) {
            let n = be.strokeStyle;
            be.beginPath(), be.lineWidth = 5, be.strokeStyle = "#BEBEBE", be.moveTo(oe.x - i, oe.y - s),
            be.lineTo(e - i, t - s), be.stroke(), be.strokeStyle = n;
        }(s.x, s.y, e, t), !0));
    }
}

function gs(e) {
    (function() {
        for (let e = 0; e < fe; e++) {
            let t = fe[e];
            if (t) {
                let e = t.primaryIndex;
                let i = t.primaryVariant;
                let s = Dt.reloadPercent(t, e);
                let n = 1.5 * Dt.calculateWeaponDamage(e, i);
                let a = $t.list[9];
                if (1 == s && n + a.dmg >= 100 && St.getDist(t, oe, 0, 2) <= 100 + 2 * a.scale) return !0;
            }
        }
        return !1;
    })() && oe.trapData && oe.trapData.sid === e.sid && Gt("megasnnaitirn");
}

function bs(e) {
    Et.disableBySid(e);
    let t = xe(e);
    t && (ms.update(t), St.getDist(oe, t, 2, 0) <= 300 && (gs(t), k("replc").checked && V.tickBase(() => {
        gi.autoReplace(t);
    }, 1)));
}

function ws(e) {
    oe && Et.removeAllItems(e);
}

let Ms = null;

let ys = null;

let vs = {
    wood: 0,
    stone: 0,
    food: 0,
    score: 0
};

let ks = 0;

let xs = 0;

let Os = 0;

let Ss = 0;

const Is = [ 3e3, 7e3, 12e3, 1 / 0 ];

function Ds(e) {
    oe.weaponIndex === oe.weapons[0] ? ks += e : xs += e;
}

class Ts {
    static animations=[];
    static spikeKB(e = {
        x: 0,
        y: 0,
        scale: 35
    }, t = {
        x: 0,
        y: 0,
        scale: 0
    }, i) {
        e.vel = {
            x: 0,
            y: 0
        };
        let s = e.vel;
        let n = !0;
        let a = V.tickSpeed;
        let o = !1;
        let l = [];
        let r = 0;
        for (;(0 != s.x || 0 != s.y) && !isNaN(s.x) && !isNaN(s.y) || !o; ) {
            let i = Math.min(4, Math.max(1, Math.round(St.getDistance({
                x: 0,
                y: 0
            }, {
                x: s.x * a,
                y: s.y * a
            }) / 40)));
            let h = 1 / i;
            for (let o = 0; o < i; o++) {
                if (s.x && (e.x += s.x * a * h), s.y && (e.y += s.y * a * h), ae.filter(t => t.active && (1 == t.type && t.y >= 12e3 || t.teleport || t.trap || !t.ignoreCollision) && St.getDist(e, t) <= 35 + (t.getScale ? t.getScale() : t.scale)).forEach(t => {
                    let i = (t.getScale ? t.getScale() : t.scale) + 35;
                    let n = St.getDirect(e, t);
                    if (e.x = t.x + i * Math.cos(n), e.y = t.y + i * Math.sin(n), s.x *= .75, s.y *= .75,
                    t.dmg || t.trap) {
                        let i = ee.find(e => e.sid == t.owner.sid);
                        i && i.team && i.team == e.tmpObj.team || (t.trap ? (s.x = 0, s.y = 0, l.push({
                            id: "trap",
                            x: t.x,
                            y: t.y,
                            owner: t.owner.sid
                        })) : (s.x += 1.5 * Math.cos(n), s.y += 1.5 * Math.sin(n), l.push({
                            id: "spiek",
                            dmg: t.dmg
                        })));
                    } else 1 == t.type && t.y >= 12e3 ? (s.x += 1.5 * Math.cos(n), s.y += 1.5 * Math.sin(n),
                    l.push({
                        id: "spiek",
                        dmg: 35
                    })) : t.teleport && (l.push({
                        id: "tp"
                    }), s.x = 0, s.y = 0);
                }), St.getDist(t, e) <= 35 + t.scale) {
                    let i = t.scale + 35;
                    let a = St.getDirect(e, t);
                    e.x = t.x + i * Math.cos(a), e.y = t.y + i * Math.sin(a), s.x *= .75, s.y *= .75,
                    s.x += 1.5 * Math.cos(a), s.y += 1.5 * Math.sin(a), n || l.push({
                        id: "spiek",
                        dmg: t.dmg
                    }), n = !1;
                }
                ee.filter(t => t.visible && St.getDist(t, e) <= 70).forEach(t => {
                    let i = St.getDist(t, e) - 70;
                    let s = St.getDirect(e, t);
                    i = -1 * i / 2, e.x += i * Math.cos(s), e.y += i * Math.sin(s);
                });
            }
            if (s.x && (s.x *= Math.pow(x.playerDecel, a), s.x <= .01 && s.x >= -.01 && (s.x = 0)),
            s.y && (s.y *= Math.pow(x.playerDecel, a), s.y <= .01 && s.y >= -.01 && (s.y = 0)),
            o = !0, ++r > 30) break;
        }
        return {
            vel: s,
            pos: e,
            data: l,
            callback: () => {}
        };
    }
    static hit(e, t) {
        const i = e.weapons[0];
        const s = $t.weapons[i].range + 63;
        const n = (.3 + ($t.weapons[i].knock || 0)) * s;
        let a = t.xVel || t.x2, o = t.yVel || t.y2;
        const l = St.getDirect(t, e, 0, 2);
        return {
            x: a + Math.cos(l) * n,
            y: o + Math.sin(l) * n
        };
    }
}

let As = new class {
    constructor() {
        this.bullTicking = 0;
    }
    tick(e) {
        if ("bull" === e) {
            if (45 === oe.skinIndex || oe.health < 25 || oe.canEmpAnti || 0 === oe.shameCount) return 0;
            let e = oe.shameCount > (oe.inTrap || 6 === oe.skinIndex ? 1 : 0);
            if (!de.length) return !0;
            if (e) {
                const e = ue.weapons[0];
                if (!(ue.dist2 <= $t.weapons[e].range + 63)) return !0;
                if (![ 7, 8 ].includes(e) && ue.reloads[ue.primaryIndex] > V.tickRate) return !0;
            }
            return !1;
        }
        if ("turret" === e) {
            if (!de.length) return 0;
            let e = ue.dist2 > 140 && ue.dist2 <= 700;
            let t = oe.skins[53] && 0 == oe.reloads[53];
            let i = 45 == ue.skinIndex || 56 == ue.skinIndex || ue.health <= 25;
            const s = Ts.hit(oe, ue);
            let n = ae.some(e => (e.dmgObject(oe, ue) || e.teleport) && St.getDist(e, s) <= ue.scale + e.scale);
            if (ue.dist2 < 500 && !ue.inTrap && n) {
                if (!(ue.dist2 < $t.weapons[oe.weapons[0]].range + 63)) return t;
            }
            return e && t && yi.perfCheck(oe, ue) && (V.tick - oe.bullTick) % 9 == 0 && i;
        }
    }
    antiBull() {
        return !(!D.doAutoAntibull || [ 6, 7, 8 ].includes(oe.weapons[0]) || [ 6, 7, 8 ].includes(ue.weapons[0])) && ((void 0 === ue.primaryIndex || 0 == ue.reloads[ue.primaryIndex]) && (void 0 === ue.secondaryIndex || 11 !== ue.secondaryIndex && 0 == ue.reloads[ue.secondaryIndex]) && oe.reloads[oe.weapons[0]] <= V.tickRate && 0 == oe.reloads[oe.weapons[1]] || void 0);
    }
    barbarianAnti() {
        return [ 0, 6, 7, 8 ].includes(ue.primaryIndex) && [ 9, 10, 11, 14 ].includes(ue.secondaryIndex);
    }
    hatType() {
        let e = this.tick("bull") || D.doAutoResyncBTick && oe.reSync;
        let t = this.tick("turret");
        if (Ps.antiTick > 0) Vt(6, 0); else {
            let i = oe.empAnti || oe.empTurretAnti;
            const s = k("soldieranti").checked ? 6 : 26;
            let n = e ? 7 : t ? 53 : this.barbarianAnti() ? 26 : s;
            let a = Bt[V.tick % Bt.length];
            if (Ei.left || Ei.right) {
                let e = i ? 22 : oe.soldierAnti ? 6 : this.barbarianAnti() ? 26 : k("grind").checked ? a : fi(1, 1);
                if (Ei.left) Vt(0 == oe.reloads[oe.weapons[0]] ? k("grind").checked ? 40 : 7 : e, 0); else if (Ei.right) {
                    let t = Ei.right && 10 == oe.weapons[1];
                    Vt(0 == oe.reloads[oe.weapons[t ? 1 : 0]] ? 40 : e, 0);
                }
            } else if (Mi.active) {
                let e = i ? 22 : oe.soldierAnti ? 6 : n;
                Mi.target.health <= $t.weapons[oe.weaponIndex].dmg || 0 != oe.reloads[Mi.weaponIndex] ? Vt(e, 0) : Vt(40, 0);
            } else if (i || oe.soldierAnti) Vt(i ? 22 : 6, 0); else if (e || t) Vt(e ? 7 : 53, 0); else if (k("grind").checked) Vt(a, 0); else if (ue.dist2 <= $t.weapons[ue.primaryIndex || 5].range + 105 && !di(oe.y2)) {
                Vt(this.antiBull() ? 11 : this.barbarianAnti() ? 26 : s, 0);
            } else Vt(D.doAutoSoldierInRiver ? 6 : fi(1, 1), 0);
        }
        if (ue.dist2 <= $t.weapons[ue.primaryIndex || 5].range + 105) {
            const e = de.length && (11 === ue.skinIdex || void 0 === ue.weapons[0] || 5 === ue.weapons[0] || 7 === ue.weapons[0] || 1.5 * ue.primaryDmg >= 45) ? 21 : 11;
            D.antiBull > 0 ? Vt(21, 1) : (Ei.left || Ei.right) && 0 == oe.reloads[oe.weapons[Ei.right && 10 == oe.weapons[1] ? 1 : 0]] ? Vt(ue.dist2 <= 300 ? 18 : e, 1) : Mi.active ? Mi.target.health <= $t.weapons[oe.weaponIndex].dmg || 0 != oe.reloads[Mi.weaponIndex] ? yi.wait ? Vt(21, 1) : (V.tick - oe.bullTick) % x.serverUpdateRate === 0 ? Vt(13, 1) : Vt(11, 1) : Vt(ue.dist2 <= 275 ? 18 : e, 1) : this.antiBull() || ![ 6, 7, 8 ].includes(oe.weapons[0]) && ue.dist2 <= $t.weapons[oe.primaryIndex].range + 63 ? Vt(21, 1) : (V.tick - oe.bullTick) % x.serverUpdateRate === 0 ? Vt(13, 1) : Vt(yi.wait ? 21 : yi.waitOT ? 0 : 11, 1);
        } else e && (V.tick - oe.bullTick) % x.serverUpdateRate === 0 ? Vt(13, 1) : Vt(yi.waitOT ? 0 : 11, 1);
    }
    update() {
        "block" == Be.style.display || yi.isTrue || yi.oneTickProcess || this.hatType();
    }
};

let $s = Date.now();

let Ps = new class {
    constructor() {
        this.lastType, this.waitHit = 0, this.reloaded = !1;
    }
    optimazedMohMoh() {
        x.isPrivateServer && 0 == V.tick && setInterval(() => {
            if (oe.shameCount < 5 && ue.dist2 <= 300) for (let e = 0; e < 2; e++) si(0, Fi());
        }, V.tickRate / 2);
    }
    autoReload(e, t) {
        if (t && (!x.isPrivateServer || 13 != t)) if (0 == oe.reloads[e] && 0 == oe.reloads[t]) {
            if (!this.reloaded) {
                this.reloaded = !0;
                let i = $t.weapons[e].spdMult < $t.weapons[t].spdMult ? 1 : 0;
                (oe.weaponIndex != oe.weapons[i] || oe.buildIndex > -1) && Qt(oe.weapons[i]);
            }
        } else this.reloaded = !1, oe.reloads[e] > 0 ? (oe.weaponIndex != e || oe.buildIndex > -1) && Qt(e) : 0 == oe.reloads[e] && oe.reloads[t] > 0 && (oe.weaponIndex != t || oe.buildIndex > -1) && Qt(t);
    }
    resetFlags() {
        this.antiTick && this.antiTick--;
    }
    clearConsole() {
        Date.now() - $s >= 1e4 && ($s = Date.now());
    }
};

let Hs = !1;

function Cs(e) {
    V.tick++, V.tickSpeed = performance.now() - V.lastTick, V.lastTick = performance.now(),
    de = [], fe = [], ue = [], pe = [], me = [], wi = [];
    for (let e = ee.length; e--; ) re = ee[e], re && (re.forcePos = !re.visible, re.visible = !1);
    const t = e.length;
    for (let i = 0; i < t; i += 13) {
        if (re = ve(e[i]), !re) continue;
        re !== oe && (he[re.sid] = re), re.t1 = void 0 === re.t2 ? V.lastTick : re.t2, re.t2 = V.lastTick,
        re.oldPos.x2 = re.x2, re.oldPos.y2 = re.y2, re.x1 = re.x, re.y1 = re.y, re.x2 = e[i + 1],
        re.y2 = e[i + 2], re.x3 = re.x2 + (re.x2 - re.oldPos.x2), re.y3 = re.y2 + (re.y2 - re.oldPos.y2),
        re.d1 = void 0 === re.d2 ? e[i + 3] : re.d2, re.d2 = e[i + 3], re.dt = 0, re.vel = ns(re),
        re.buildIndex = e[i + 4], re.weaponIndex = e[i + 5], re.weaponVariant = e[i + 6],
        re.team = e[i + 7], re.isLeader = e[i + 8], re.oldSkinIndex = re.skinIndex, re.oldTailIndex = re.tailIndex,
        re.skinIndex = e[i + 9], re.tailIndex = e[i + 10], re.iconIndex = e[i + 11], re.zIndex = e[i + 12],
        re.visible = !0, re.update(V.tickSpeed), re.dist2 = St.getDist(re, oe, 2, 2), re.aim2 = St.getDirect(re, oe, 2, 2),
        re.dist3 = St.getDist(re, oe, 3, 3), re.aim3 = St.getDirect(re, oe, 3, 3), Et.closeObjects(),
        Mi.updateObjects(), 45 == re.skinIndex && re.shameTimer <= 0 && re.addShameTimer(),
        45 == re.oldSkinIndex && 45 != re.skinIndex && (re.shameTimer = 0, re.shameCount = 0,
        re == oe && oi());
        let t = ae.find(e => e.trap && e.active && !e.isTeamObject(re) && St.getDist(e, re, 0, 2) <= re.scale + e.getScale() + 3);
        re.trapData = re.inTrap || !1, re.inTrap = t || !1, re.escaped = !re.inTrap && re.trapData,
        re.manageWeapons();
    }
    if (Ai.length) {
        for (let e = 0, t = Ai.length; e < t; e++) $i(...Ai[e]);
        Ai.length = 0;
    }
    for (let i = 0; i < t; i += 13) re = ve(e[i]), re && (re.manageReload(), re !== oe ? re.isTeam(oe) ? pe.push(re) : (de.push(re),
    re.dist2 <= $t.weapons[re.primaryIndex || 5].range + 2 * oe.scale && fe.push(re)) : (oe.autoAim = !1,
    oe.shieldAnti = !1));
    if (me = pe.length ? pe.reduce((e, t) => t.dist2 < e.dist2 ? t : e) : {}, de.length ? (ue = de.reduce((e, t) => t.dist2 < e.dist2 ? t : e),
    ue && ce !== ue && (ce = ue)) : ue = {}, k("placestatus").innerHTML = G ? "true" : "false",
    k("autoInsta").innerHTML = (yi.wait ? "on" : "off").toUpperCase(), k("eabStatus").innerHTML = Ns.start ? [ `hit:${Ns.hit}`, `miss:${Ns.miss}` ].join(",") : "",
    k("musicStatus").innerHTML = "off".toUpperCase(), k("millStatus").innerHTML = (pi.active ? "on" : "off").toUpperCase(),
    oe && oe.alive) {
        if (Ps.optimazedMohMoh(), V.tickQueue[V.tick]) {
            for (let e = 0; e < V.tickQueue[V.tick].length; e++) {
                (0, V.tickQueue[V.tick][e])();
            }
            V.tickQueue[V.tick] = null;
        }
        !pi.pos.x && (pi.pos.x = oe.x2), !pi.pos.y && (pi.pos.y = oe.y2), oe.syncThreats >= 2 && !li ? (Gt("sync detect test"),
        ri()) : oe.syncThreats >= 4 && !li && D.doAntiMultiboxInsta && (Gt("multibox stupid tactic"),
        ri());
        let e = 90;
        if (re == oe) {
            const t = window.pingTime <= 40 ? re.shameCount >= 5 ? 110 : 100 : re.shameCount >= 5 ? 84 : 70;
            const i = window.pingTime <= 40 ? re.shameCount >= 5 ? 105 : 90 : re.shameCount >= 5 ? 84 : 60;
            window.pingTime <= 40 ? re.shameCount : re.shameCount;
            const s = oe.soldierAnti;
            const n = oe.canEmpAnti;
            const a = 6 * fe.length;
            const o = D.doPingCompensationHeals ? window.pingTime * (n || s ? .2 : .5) : 0;
            n || s ? (e = (n ? t : i) - o, k("healer").innerHTML = "Healer: " + (window.pingTime <= 90 ? "Low Ping 2" : "High Ping 2")) : fe.length >= 2 ? (e = 90 - a - o,
            k("healer").innerHTML = "Healer: " + fe.length + "v1") : (e = 90 - o, k("healer").innerHTML = "Healer: " + (window.pingTime <= 90 ? "Low Ping" : "High Ping"));
        } else e = 90, k("healer").innerHTML = "Healer: " + (window.pingTime <= 90 ? "Low Ping" : "High Ping");
        if (ls.length) {
            for (let t = 0; t < ls.length; t++) {
                let i = ls[t];
                let s = i[0];
                i[1];
                let n = i[2];
                re = ve(s);
                let a = !1;
                if (re && re.health <= 0 && (re.death || (re.death = !0)), re == oe && (7 == re.skinIndex && (5 == n || 13 == re.latestTail && 2 == n) && (oe.reSync && (oe.reSync = !1,
                re.setBullTick = !0), a = !0), Mt)) {
                    let t = !1;
                    let i = !1;
                    de.length && Dt.inRange(ue, oe, ue.primary.range, !0) && ((!t || !oe.soldierAnti) && oe.health < 100 && (ue.reloads[53] && [ 9, 12, 13, 15 ].includes(oe.weapons[1]) || oe.empAnti) && (i = !0,
                    Xt(22, 21), oi(), V.tickBase(() => {
                        i = !1;
                    }, 1)), i && oe.empAnti || !(oe.health < 54) || ue.reloads[53] && !oe.soldierAnti || (t = !0,
                    Xt(6, 21), oi(), V.tickBase(() => {
                        t = !1;
                    }, 1)));
                    let s = [ .25, .45 ].map(e => e * $t.weapons[oe.weapons[0]].dmg * (6 == oe.latestSkin ? .75 : 1));
                    let o = !a && s.includes(n);
                    let l = function(e) {
                        setTimeout(() => {
                            oi();
                        }, e);
                    };
                    n >= (o ? 8 : 20) && re.damageThreat >= 20 && V.tick - re.antiTimer > 1 && (0 == re.reloads[53] && 0 == re.reloads[re.weapons[1]] ? re.canEmpAnti = !0 : oe.soldierAnti = !0,
                    re.antiTimer = V.tick);
                    let r = 100 - oe.health;
                    [ 0, 7, 8 ].includes(ue.primaryIndex) ? n < 75 ? l(e) : oi() : [ 1, 2, 6 ].includes(ue.primaryIndex) ? n >= 25 && oe.damageThreat + r >= 95 && re.shameCount < 5 ? oi() : l(e) : 3 === ue.primaryIndex ? 15 === ue.secondaryIndex ? ue.primaryVariant < 2 ? n >= 35 && oe.damageThreat + r >= 95 && re.shameCount < 5 && V.tick - oe.antiTimer > 1 ? (re.canEmpAnti = !0,
                    re.antiTimer = V.tick, oi()) : l(e) : n > 35 && oe.damageThreat + r >= 95 && re.shameCount < 5 && V.tick - oe.antiTimer > 1 ? (re.canEmpAnti = !0,
                    re.antiTimer = V.tick, oi()) : l(e) : n >= 25 && oe.damageThreat + r >= 95 && re.shameCount < 4 ? oi() : l(e) : 4 === ue.primaryIndex ? ue.primaryVariant >= 1 ? n >= 10 && oe.damageThreat + r >= 95 && re.shameCount < 4 ? oi() : l(e) : n >= 35 && oe.damageThreat + r >= 95 && re.shameCount < 3 ? oi() : l(e) : [ void 0, 5 ].includes(ue.primaryIndex) ? 10 === ue.secondaryIndex ? r >= (o ? 10 : 20) && oe.damageThreat + r >= 80 && re.shameCount < 6 ? oi() : l(e) : ue.primaryVariant >= 2 || void 0 === ue.primaryVariant ? r >= (o ? 15 : 20) && oe.damageThreat + r >= 50 && re.shameCount < 6 ? oi() : l(e) : [ void 0, 15 ].includes(ue.secondaryIndex) ? n > (o ? 8 : 20) && oe.damageThreat >= 25 && V.tick - oe.antiTimer > 1 && re.shameCount < 5 ? oi() : l(e) : [ 9, 12, 13 ].includes(ue.secondaryIndex) ? r >= 25 && oe.damageThreat + r >= 70 && re.shameCount < 6 ? oi() : l(e) : n > 25 && oe.damageThreat + r >= 95 ? oi() : l(e) : 6 === ue.primaryIndex && (15 === ue.secondaryIndex ? n >= 25 && oe.damageThreat + r >= 95 && re.shameCount < 4 ? oi() : l(e) : n >= 70 && re.shameCount < 4 ? oi() : l(e)),
                    11 == oe.skinIndex && 21 == oe.tailIndex && n >= 20 && D.doAutoAntibull ? yi.canCounter = !0 : re == oe && D.doAntiAntibull && n <= 30 && 11 == ue.skinIndex && 8 != ue.weapons[0] && 7 != ue.weapons[0] && 9 != ue.weapons[1] && 11 == ue.skinIndex && 0 != oe.reloads[oe.weapons[0]] && (yi.canAntiCounter = !0);
                }
            }
            ls = [];
        }
        for (const e of ee) e.visible || e === oe || e.resetReloads(), e.setBullTick && (e.bullTimer = 0),
        e.setPoisonTick && (e.poisonTimer = 0), e.updateTimer();
        if (Mt) {
            if (ui.key.q && !Hs) si(0, Fi()); else if (ui.key.n) si(3, qi()); else if (ui.spike) si(2, qi()); else if (ui.trap) if (D.doQuadTrapsForHotkey) for (let e = 0; 4 > e; e++) ni(4, qi() + 1.57 * e); else si(4, qi()); else ui.turret ? si(5, qi()) : Zt(Fi());
            if (oe.inTrap || pi.update(), oe.inTrap || gi.autoPlace(), k("prepl").checked && bi.update(),
            function() {
                try {
                    Ms === oe.weapons[0] && ys === oe.weapons[1] || (oe.weapons[0] !== Ms && (ks = 0),
                    oe.weapons[1] !== ys && (xs = 0), Ms = oe.weapons[0], ys = oe.weapons[1]);
                    const e = Number(Xe.innerHTML);
                    const t = Number(Ke.innerHTML);
                    const i = Number(Ve.innerHTML);
                    e > vs.stone && (Ds(e - vs.stone), vs.stone = e), t > vs.food && (Ds(t - vs.food),
                    vs.food = t), i > vs.wood && (Ds(i - vs.wood), vs.wood = i);
                    const s = Is[oe.weaponVariant] || 3e3;
                    oe.weaponIndex === oe.weapons[0] ? Os = s : Ss = s, k("priXP").innerHTML = "Primary XP: " + ks + " / " + Os,
                    k("secXP").innerHTML = "Secondary XP: " + xs + " / " + Ss;
                } catch (e) {}
            }(), k("grind").checked && (!de.length || ue.dist2 > 300)) for (let e = 0; e < 8; e++) ni(5, Math.PI / 4 * e);
            if (de.length) {
                if (!oe.inTrap && Dt.inRange(ue, oe, $t.weapons[ue.weapons[0]].range, !0)) {
                    const e = .3 * V.tickRate;
                    oe.x3, Math.cos(ue.aim2 + Math.PI), oe.y3, Math.sin(ue.aim2 + Math.PI);
                    const t = (.425 + .085 * (.3 + $t.weapons[ue.weapons[0]].knock || 0)) * V.tickRate;
                    oe.x3, Math.cos(ue.aim2 + Math.PI), oe.y3, Math.sin(ue.aim2 + Math.PI);
                    oe.kbHit = ei(oe, ue.aim2 + c, e, !0)?.obj, oe.kbInsta = ei(oe, ue.aim2 + c, e, !0)?.obj ?? ei(oe, ue.aim2 + c, t, !0)?.obj ?? null,
                    oe.kbHit && (Ps.antiTick = 1);
                } else oe.kbHit = null, oe.kbInsta = null;
                if (oe.canEmpAnti) {
                    oe.canEmpAnti = !1;
                    let e = ![ 0, 8 ].includes(ue.primaryIndex);
                    let t = ![ 10, 11, 14 ].includes(ue.secondaryIndex);
                    ue.dist2 <= 300 && e && t && (0 == ue.reloads[53] ? (oe.empAnti = !0, oe.soldierAnti = !1) : (oe.empAnti = !1,
                    oe.soldierAnti = !0));
                }
                if (D.doAnti1Tick && fe.forEach(e => {
                    5 == e.primaryIndex && e.primaryVariant >= 2 && e.dist2 > 169 && e.dist2 < 269 && 53 == e.skinIndex && (D.doAutoShieldAnti && 11 == oe.weapons[1] && (oe.shieldAnti = !0,
                    Qt(11)), Ps.antiTick = 3, oi(1));
                }), ue && !yi.isTrue && !Ps.waitHit) {
                    let e = 0;
                    let t = 0;
                    let i = 0;
                    0 == oe.reloads[oe.weapons[0]] && Dt.inRange(oe, ue, $t.weapons[oe.weapons[0]].range, !0) && (t += oe.primaryDmg);
                    for (let t of ee.filter(e => e !== oe && e.isTeam(oe))) {
                        const s = de.sort((e, i) => St.getDist(t, e, 0, 2) - St.getDist(t, i, 0, 2))[0];
                        s && ue.sid == s.sid && (Dt.inRange(t, ue, $t.weapons[t.weapons[0]].range, !0) && 0 == t.reloads[t.weapons[0]] && (i += t.primaryDmg),
                        k("sync").checked && t.shooting[1] && 15 == t.shootIndex && e++);
                    }
                    .75 * (t + i) > 100 ? yi.bullHit() : 15 == oe.weapons[1] && oe.reloads[oe.weapons[1]] <= V.tickRate && e >= parseInt(k("synccount").value) && yi.rangeType();
                }
                !function() {
                    if (!(!oe || !ue || ue.inTrap || yi.isTrue || Ps.waitHit || Ps.antiTick > (6 !== ue.skinIndex ? 1 : 0))) for (let e = 0; e < de.length; e++) {
                        const t = de[e];
                        if (Dt.inRange(oe, t, $t.weapons[oe.weapons[0]].range, 1)) {
                            const e = .28 * V.tickRate;
                            const i = {
                                x: t.x3 + e * Math.cos(t.aim2),
                                y: t.y3 + e * Math.sin(t.aim2)
                            };
                            const s = (.125 + .085 * (.3 + oe.primary.knock || 0)) * V.tickRate;
                            const n = {
                                x: t.x3 + s * Math.cos(t.aim2),
                                y: t.y3 + s * Math.sin(t.aim2)
                            };
                            const a = (.425 + .085 * (.3 + oe.primary.knock || 0)) * V.tickRate;
                            const o = {
                                x: t.x3 + a * Math.cos(t.aim2),
                                y: t.y3 + a * Math.sin(t.aim2)
                            };
                            const l = [ ei(ue, ue.aim3, St.getDist(ue, i), !0), ei(ue, ue.aim3, St.getDist(ue, n), !0), ei(ue, ue.aim3, St.getDist(ue, o), !0) ];
                            if (t.sid == ue.sid) {
                                const e = l[2] || l[1] || l[0];
                                const s = 10 === oe.weapons[1] && Dt.inRange(oe, ue, $t.weapons[oe.weapons[1]].range, 1);
                                if (e && 0 == oe.reloads[oe.weapons[0]] && (10 !== oe.weapons[1] ? oe.reloads[53] <= V.tickRate : 0 == oe.reloads[53])) {
                                    l[0] && 6 != ue.skinIndex ? yi.canBullHit = !0 : l[0] || (l[1] ? yi.canReverseHit = !0 : yi.changeType(s && 10 == oe.secondaryIndex ? "rev" : "normal"));
                                    break;
                                }
                                if (10 == oe.weapons[1] && 0 == oe.reloads[oe.weapons[1]]) {
                                    const e = ae.filter2(e => e.dmg && e.active && e.isTeamObject(oe));
                                    if (ae.find2(s => !(!s.trap || !s.active || s.isTeamObject(t)) && (St.getDist(i, s) < s.scale + ue.scale && e.some(e => St.getDist(e, s) < s.scale + e.scale + 5))) && s) {
                                        yi.isTrue = !0, oe.autoAim = !0, Qt(10), Vt(7, 0), Jt(), V.tickBase(() => {
                                            Jt(), oe.autoAim = !1, yi.isTrue = !1;
                                        }, 1);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }();
                let e = ae.filter(e => e.dmg && e.active && e.isTeamObject(oe) && St.getDist(e, ue, 0, 3) <= e.scale + ue.scale).sort(function(e, t) {
                    return St.getDist(e, ue, 0, 2) - St.getDist(t, ue, 0, 2);
                })[0];
                !yi.isTrue && Dt.inRange(oe, ue, $t.weapons[oe.weapons[0]].range, 1) && 0 == oe.reloads[oe.weapons[0]] && e && ((10 !== oe.weapons[1] ? oe.reloads[53] <= V.tickRate : 0 == oe.reloads[53]) ? yi.canSpikeTick = !0 : yi.bullHit());
                const t = oe.primaryVariant >= 2 && 5 === oe.weapons[0];
                if (yi.waitOT && t && !oe.inTrap && !yi.isTrue && !Ps.waitHit) {
                    let e = Math.ceil(($t.weapons[ue.weaponIndex].speed - ue.reloads[ue.weaponIndex]) / V.tickRate) + 1;
                    const t = ue.skinIndex;
                    const i = t.length;
                    let s = e;
                    let n;
                    if (s > i && (s = i), s < 0 && (s = 0), ue.inTrap || 0 === e || 0 === i) {
                        n = [];
                        let e = i - Math.max(1, Math.min(s + 1, i));
                        e < 0 && (e = 0);
                        for (let s = e; s < i; s++) n.push(t[s]);
                    } else {
                        let e = i - Math.min(s + 1, i);
                        let a = i - s;
                        e < 0 && (e = 0), a > i && (a = i);
                        for (let i = e; i < a; i++) if (40 === t[i] || 7 === t[i]) {
                            n = t[i];
                            break;
                        }
                    }
                    const a = ue.reloads[ue.weaponIndex];
                    const o = (V.tick - oe.bullTick) % 9 == 8 && ue.shameCount > 0 || !ue.skinIndex[6] || n && a > 0 && a <= V.tickRate;
                    const l = 201;
                    const r = as();
                    const h = y(r.x - ue.x3, r.y - ue.y3) <= l;
                    const d = y(oe.x2 - ue.x3, oe.y2 - ue.y3) >= 210;
                    let f = function(e, t) {
                        if (!ue?.x2 || !oe?.x2) return {
                            block: !1,
                            possible: !1
                        };
                        const i = St.getDistance(oe.x2, oe.y2, ue.x2, ue.y2);
                        let s = i;
                        oe.vel?.accel && ue.vel?.accel ? s = St.getDistance(oe.vel.accel.x, oe.vel.accel.y, ue.vel.accel.x, ue.vel.accel.y) : oe.x3 && ue.x3 && (s = St.getDistance(oe.x3, oe.y3, ue.x3, ue.y3));
                        const n = i >= e && i <= t;
                        const a = s >= e && s <= t;
                        return {
                            possible: n || a,
                            block: !n && a,
                            distCurrent: i,
                            distPredicted: s
                        };
                    }(l, 221);
                    const u = !zi() || null == oe.moveDir;
                    f.possible && (u || Math.abs(St.getAngleDist(oe.moveDir, ue.aim2)) <= c / 4) && 0 == oe.reloads[53] && oe.reloads[oe.weapons[0]] <= 111 && h && d && ue.dist2 >= 223 && (0 === ue.reloads[ue.weaponIndex] || !n && ue.reloads[ue.weaponIndex] - 222 > 0 || o) ? (f.block && oe.buildIndex != oe.items[2] && Ut(oe.items[2]),
                    22 == ue.skinIndex ? V.tickBase(function() {
                        ue.inTrap, yi.oneTick(1);
                    }, 1) : (ue.inTrap || 22 != ue.skinIndex) && yi.oneTick(1)) : u && (ue.dist2 < 210 ? Xi(ue.aim2 + c) : ue.dist2 > 221 && Xi(ue.aim2));
                }
                ae.filter(e => e.dmg && e.active && !e.isTeamObject(oe) && St.getDist(e, oe, 0, 3) < e.scale + oe.scale).sort(function(e, t) {
                    return St.getDist(e, oe, 0, 2) - St.getDist(t, oe, 0, 2);
                })[0] && !oe.inTrap && ue.dist2 <= $t.weapons[5].range + 1.8 * ue.scale && (Ps.antiTick = 1);
            }
            if (oe.checkCanInsta(oe.checkCanInsta(!0) >= 100) >= (10 == oe.weapons[1] ? 95 : 100) && ue.dist2 <= $t.weapons[10 == oe.weapons[1] ? oe.weapons[1] : oe.weapons[0]].range + 1.8 * ue.scale && yi.wait && !yi.isTrue && !Ps.waitHit && (i = 10 == oe.weapons[1] ? 0 : V.tickRate,
            0 == oe.reloads[oe.weapons[0]] && 0 == oe.reloads[oe.weapons[1]] && oe.reloads[53] <= i) && yi.perfCheck(oe, ue, 1) ? (oe.checkCanInsta(!0) >= 100 ? yi.nobull = !yi.canSpikeTick : yi.nobull = !1,
            yi.can = !0) : yi.can = !1, yi.canBullHit && (yi.canBullHit = !1, 0 != oe.reloads[oe.weapons[0]] || !Dt.inRange(oe, ue, oe.primary.range, 1) || yi.isTrue || Ps.waitHit || yi.bullHit()),
            yi.canSpikeTick && (yi.canSpikeTick = !1, 0 != oe.reloads[oe.weapons[0]] || !Dt.inRange(oe, ue, oe.primary.range, 1) || yi.isTrue || Ps.waitHit || yi.spikeTick()),
            yi.can) {
                const e = 10 == oe.weapons[1] && 4 == oe.weapons[0] && D.doKatanaHammerInsta;
                const t = $t.weapons;
                const i = e => oe.weapons.includes(e);
                const s = e => 0 === oe.reloads[e];
                const n = (e, t, i, s) => Math.sqrt(Math.pow(i - e, 2) + Math.pow(s - t, 2));
                const a = (e, i, s) => {
                    const a = t[e].range;
                    const o = oe.x2 || oe.x;
                    const l = oe.y2 || oe.y;
                    return n(o, l, i, s) <= a + 1.8 * ue.scale;
                };
                const o = () => !x.doOneShotReloadChange || !(!x.doOneShotReloadChange && !e) && oe.reloads[53] <= (i(10) ? 0 : V.tickRate);
                const l = () => oe.shameCount > 3;
                const r = () => (V.tick - oe.bullTick) % 9 == 8;
                const h = e => ue.skinIndex === e;
                const c = () => n(oe.x2 || oe.x, oe.y2 || oe.y, ue.x, ue.y) <= 130;
                i(5) && i(10);
                const d = s(oe.weapons[0]) && s(oe.weapons[1]) && o();
                if (de.length && d && i(1)) {
                    ue.dist2;
                    const t = ae.some(e => {
                        const t = oe.distanceTo(e);
                        const i = Math.abs(e.angleTo(oe) - ue.aim2);
                        return t < ue.distanceTo(oe) && i <= (e.scale + 10) / t && e.isActive() && !e.ignoresCollision();
                    });
                    a(10 === oe.weapons[1] ? oe.weapons[1] : oe.weapons[0], ue.x2 || ue.x, ue.y2 || ue.y) && 10 !== oe.weapons[1] && !t ? ue.isInBullseye() ? yi.changeType("rev") : l() && r() || h(11) ? yi.changeType("nobull") : yi.changeType(e ? "rev" : "normal") : c() && i(10) ? yi.changeType("rev") : yi.changeType("normal");
                } else yi.changeType(e ? "rev" : "normal");
            }
            if (!yi.isTrue) {
                const [e, t] = oe.weapons;
                if (oe.shieldAnti) V.tickBase(() => {
                    oe.shieldAnti = !1;
                }, 1); else if (Ei.middle || !Ei.left && !Ei.right) if (Ei.middle && !Ps.waitHit && 0 == oe.reloads[t]) pt && 4 != e && 9 == t && oe.age >= 9 && de.length ? yi.bowMovement() : yi.rangeType(); else if (Mi.active) {
                    let e = Mi.weaponIndex;
                    (oe.weaponIndex != e || oe.buildIndex > -1) && Qt(e), oe.reloads[e] <= V.tickRate && !Ps.waitHit && (Jt(),
                    Ps.waitHit = 1, V.tickBase(() => {
                        Jt(), Ps.waitHit = 0;
                    }, 1));
                } else Ps.autoReload(e, t); else {
                    let e = oe.weapons[Ei.right && 10 === t ? 1 : 0];
                    (oe.weaponIndex != e || oe.buildIndex > -1) && Qt(e), oe.reloads[e] <= V.tickRate && !Ps.waitHit && (Jt(),
                    Ps.waitHit = 1, V.tickBase(() => {
                        Jt(), Ps.waitHit = 0;
                    }, 1));
                }
            }
            Qi.update(), Ui[de.length && !oe.inTrap ? "update" : "reset"](), As.update(), Ps.resetFlags();
        }
    }
    var i;
}

function Bs() {
    Vt(6, 0), Ps.antiTick++;
}

let Rs = [];

function _s(e) {
    if (Array.isArray(e)) {
        Rs = e, St.removeAllChildren(je);
        for (let t = 0, i = 1; t < e.length && !(t + 2 >= e.length); t += 3) St.generateElement({
            class: "leaderHolder",
            parent: je,
            children: [ {
                class: "leaderboardItem",
                style: "color:" + (e[t] === le ? "#fff" : "rgba(255,255,255,0.6)"),
                text: `${i}. ${e[t + 1] || "unknown"}`
            }, {
                class: "leaderScore",
                text: St.sFormat(e[t + 2]) || "0"
            } ].map(St.generateElement)
        }), i++;
    }
}

class Ns {
    static start=!1;
    static hit=0;
    static miss=0;
    static update(e, t, i) {
        let s = St.getDist(i, oe, 0, 2);
        let n = St.getDirect(i, oe, 0, 2);
        k("earlyab").checked && 15 == e[t + 6] && s <= 100 && setTimeout(() => {
            s = St.getDist(i, oe, 0, 2), n = St.getDirect(i, oe, 0, 2), this.start || (this.start = !0,
            this.hit = 0, this.miss = 0), s <= 75 ? this.hit++ : this.miss++;
        }, parseInt(k("earlytime").value));
    }
}

let Es = [];

function zs(e) {
    for (let t = 0; t < e.length; ) {
        Et.add(e[t], e[t + 1], e[t + 2], e[t + 3], e[t + 4], e[t + 5], $t.list[e[t + 6]], !0, e[t + 7] >= 0 ? {
            sid: e[t + 7]
        } : null), 4 == e[t + 5] && Gt("vooooollcAnNOOOOOOOOOOOOOOooOoOOoooo");
        let i = {
            x: e[t + 1],
            y: e[t + 2]
        };
        let s = ve(e[t + 7]);
        if (s && !s.isTeam(oe) && de.length) {
            let s = St.getDist(i, oe, 0, 2);
            oe.escaped && St.getDist(oe.trapData, i, 0, 0) <= 120 && s < 100 && [ 6, 7, 8, 9 ].includes(e[t + 6]) && (si(0, Fi()),
            Ps.antiTick = 1), 16 == e[t + 6] && s < 490 && St.getDist(i, ue, 0, 2) < 90 && 5 == ue.primaryIndex && (53 == ue.skinIndex || 0 == ue.reloads[53] || 9 == ue.shootIndex || 12 == ue.shootIndex || 13 == ue.shootIndex) && (Ps.antiTick = 1,
            D.doAutoShieldAnti && 11 == oe.weapons[1] ? (oe.shieldAnti = !0, Qt(11)) : oe.inTrap || ni(3, ue.aim2));
        }
        oe.sid === e[t + 7] ? 22 == e[t + 6] && (Es.push(i), setTimeout(() => {
            Es.shift();
        }, 3e4)) : oe.sid === e[t + 7] || oe.findAllianceBySid(e[t + 7]) || Ns.update(e, t, i),
        t += 8;
    }
}

function qs(e) {
    for (let e = 0; e < Z.length; ++e) Z[e].forcePos = !Z[e].visible, Z[e].visible = !1;
    if (e) {
        let t = performance.now();
        for (let i = 0; i < e.length; ) re = ke(e[i]), re ? (re.index = e[i + 1], re.t1 = void 0 === re.t2 ? t : re.t2,
        re.t2 = t, re.x1 = re.x, re.y1 = re.y, re.x2 = e[i + 2], re.y2 = e[i + 3], re.d1 = void 0 === re.d2 ? e[i + 4] : re.d2,
        re.d2 = e[i + 4], re.health = e[i + 5], re.dt = 0, re.visible = !0) : (re = Ft.spawn(e[i + 2], e[i + 3], e[i + 4], e[i + 1]),
        re.x2 = re.x, re.y2 = re.y, re.d2 = re.dir, re.health = e[i + 5], Ft.aiTypes[e[i + 1]].name || (re.name = x.cowNames[e[i + 6]]),
        re.forcePos = !0, re.sid = e[i], re.visible = !0), i += 7;
    }
}

function Fs(e) {
    re = ke(e), re && re.startAnim();
}

function js(e, t, i) {
    if (re = ve(e), !re) return;
    re.startAnim(t, i), re.gatherIndex = i, re.gathering = 1;
    let s = $t.weapons[i];
    let n = Dt.weaponDmg(re, null, 0, 1);
    for (let e of ee) {
        let t = n * (e.skin?.dmgMult || 1);
        re != e && t == -e.lastBleed.amount && Date.now() - window.pingTime - e.lastBleed.time <= 55.5 && St.getDist(e, re) - 63 <= 2 * s.range && St.getAngleDist(re.d2, St.getDirect(re, e)) <= Math.PI / 2.6 && 21 == re.skinIndex && (e.dmgOverTime.amount = -5,
        e.dmgOverTime.time = 4, setTimeout(() => {
            e.dmgOverTime.time = -1;
        }, 5e3));
    }
    if (fe.length >= 2 && !li) for (let e of fe.filter(e => e.gathering && e.primaryDmg > 30)) Gt("sync detect test"),
    ri();
    if (function(e, t) {
        de.length && (t < 9 && e.sid != oe.sid && null != e.team && e.team == oe.team && 0 == oe.reloads[oe.weapons[0]] && ue.dist2 <= $t.weapons[oe.weapons[0]].range + 1.8 * ue.scale && !yi.isTrue && !Ei.right && !Ei.left && St.getDist(e, ue, 2, 2) <= $t.weapons[t].range + 1.8 * ue.scale && (this.lastType = "melleSync",
        yi.canSpikeTick = !0), e == ue && fe.length && (oe.reloads[oe.weapons[0]] + oe.reloads[53] != 0 || t != ue.primaryIndex || oe.inTrap || yi.isTrue || Ei.right || Ei.left || (this.lastType = "antibull",
        yi.canCounter = !0)));
    }(re, i), t) {
        let e = Et.hitObj;
        Et.hitObj = [], V.tickBase(() => {
            let t = x.weaponVariants[re[(i < 9 ? "prima" : "seconda") + "ryVariant"]]?.val || 1;
            let n = $t.weapons[i].dmg * t * (s.sDmg || 1) * (40 == re.skinIndex ? 3.3 : 1);
            for (let t = 0, i = e.length; t < i; t++) {
                e[t].health -= n;
            }
        }, 1);
    }
}

function Gs(e, t) {
    re = xe(t), re && (re.xWiggle += x.gatherWiggle * Math.cos(e), re.yWiggle += x.gatherWiggle * Math.sin(e),
    re.health && Et.hitObj.push(re));
}

function Ls(e, t) {
    re = xe(e), re && (re.dir = t, re.xWiggle += x.gatherWiggle * Math.cos(t + Math.PI),
    re.yWiggle += x.gatherWiggle * Math.sin(t + Math.PI));
}

function Ws(e, t, i) {
    oe && (oe[e] = t, "points" == e && D.doAutoBuy ? vi.buyNext() : "kills" == e && D.doAutoGG && Gt("gg - autoGG Master Race"));
}

function Ks(e, t) {
    e && (t ? (oe.weapons = e, oe.primaryIndex = oe.weapons[0], oe.secondaryIndex = oe.weapons[1],
    yi.isTrue || Qt(oe.weapons[0])) : oe.items = e);
    for (let e = 0; e < $t.list.length; e++) {
        k("actionBarItem" + ($t.weapons.length + e)).style.display = oe.items.indexOf($t.list[e].id) >= 0 ? "inline-block" : "none";
    }
    for (let e = 0; e < $t.weapons.length; e++) k("actionBarItem" + e).style.display = oe.weapons[$t.weapons[e].type] == $t.weapons[e].id ? "inline-block" : "none";
    3 == oe.weapons[0] && 15 == oe.weapons[1] && (k("actionBarItem3").style.display = "none",
    k("actionBarItem4").style.display = "inline-block");
}

function Vs(e, t, i, s, n, a, o, l) {
    qt.addProjectile(e, t, i, s, n, a, null, null, o, yt).sid = l, Ai.push([].slice.call(arguments));
}

function Xs(e, t) {
    for (let i = 0; i < se.length; ++i) if (se[i].sid == e) {
        se[i].range = t;
        let e = Et.hitObj;
        Et.hitObj = [], V.tickBase(() => {
            let t = se[i].dmg;
            e.forEach(e => {
                e.projDmg && (e.health -= t);
            });
        }, 1);
    }
}

function Us(e, t) {}

function Qs(e, t) {
    oe && (oe.team = e, oe.isOwner = t, null == e && (ie = []));
}

function Js(e) {
    ie = e;
}

let Ys = {
    6: !0,
    7: !0,
    40: !0,
    22: !0,
    15: !0
};

function Zs(e, t, i) {
    i ? e ? oe.latestTail = t : oe.tails[t] = 1 : e ? oe.latestSkin = t : (oe.skins[t] = 1,
    7 == t && (oe.reSync = !0), Ys[t] && (k("hatdisp" + t).style.backgroundColor = "#90ee90",
    k("hatdisp" + t).style.opacity = "1", 1 == oe.skins[6] && 1 == oe.skins[7] && 1 == oe.skins[40] && 1 == oe.skins[22] && 1 == oe.skins[15] && (k("hatdispdiv").style.display = "none")));
}

function en(e) {
    e = function(e) {
        return e = e.replace(/:([A-Z0-9_+-]+):/gi, (e, t) => ':' + t.toLowerCase() + ':'),
        window.emojione && window.emojione.shortnameToUnicode(e) || e;
    }(e = (e = (e = e.replace(/yaVAAHHUYYY/gi, "\u044f \u0432\u0430\u0430\u0425\u0423\u0423\u0415\u0415")).replace(/ebyat/gi, "\u0435\u0431\u0430\u0442\u044c")).replace(/\/shrug|\/shrg|\/shurg|\/shrgu/g, "\xaf\\_(\u30c4)_/\xaf"));
}

function tn(e, t) {
    let i = ve(e);
    i && (en(t), function(e, t, i) {
        if (yi.isTrue || Ps.waitHit) return;
        const s = k("syncChat").value;
        if (!e.startsWith(s) || !oe.isTeam(t) && i !== oe.sid) return;
        const n = t;
        const a = parseInt(e.split(s)[1]);
        const o = St.getDistance(ue.x, ue.y, n.x, n.y), l = St.getDistance(ue.x, ue.y, oe.x, oe.y);
        const r = l / 1.5, h = (l - 35) / 3.6, c = o / 1.5;
        const d = () => {
            Vt(53, 0), Qt(oe.secondaryIndex), oe.autoAim = !0, setTimeout(() => {
                Jt(), setTimeout(() => {
                    Jt(), oe.autoAim = !1;
                }, 250);
            }, r - h);
        };
        const f = a - Date.now();
        const u = c - r;
        f > 0 ? setTimeout(() => {
            setTimeout(d, u > 0 ? u : 0);
        }, f) : setTimeout(d, u > 0 ? u : 0);
    }(t, i, e), D.doChatMirror && i.sid !== oe.sid && Gt(t), (D.doShowEnemyMessages || oe.isTeam(i)) && (i.chatMessage = t,
    i.chatCountdown = x.chatCountdown), D.doAntiChatMirror && oe.chatMessage && i.chatMessage === oe.chatMessage && Gt(i.name + " is dumb"));
}

function sn(e) {
    Oi = e;
}

function nn(e, t, i, s) {
    At.showText(e, t, 50, .18, 1500, Math.abs(i), i >= 0 ? "#fff" : "#8ecc51");
}

function an(e, t, i, s, n, a) {
    (s = s || be).beginPath(), s.arc(e, t, i, 0, 2 * Math.PI), a || s.fill(), n || s.stroke();
}

function on(e, t, i, s) {
    let n = Math.PI / 2 * 3;
    let a, o;
    let l = Math.PI / t;
    e.beginPath(), e.moveTo(0, -i);
    for (let r = 0; r < t; r++) a = Math.cos(n) * i, o = Math.sin(n) * i, e.lineTo(a, o),
    n += l, a = Math.cos(n) * s, o = Math.sin(n) * s, e.lineTo(a, o), n += l;
    e.lineTo(0, -i), e.closePath();
}

function ln(e, t, i, s, n, a, o) {
    o || n.fillRect(e - i / 2, t - s / 2, i, s), a || n.strokeRect(e - i / 2, t - s / 2, i, s);
}

function rn(e, t, i, s, n, a, o, l) {
    a.save(), a.translate(e, t), n = Math.ceil(n / 2);
    for (let e = 0; e < n; e++) ln(0, 0, 2 * i, s, a, o, l), a.rotate(Math.PI / n);
    a.restore();
}

function hn(e, t, i) {
    be.globalAlpha = 1, be.fillStyle = "#91b2db";
    for (let s = 0; s < ee.length; ++s) re = ee[s], re.zIndex == e && (re.animate(et),
    re.visible && (re.skinRot += .002 * et, at = re == oe ? ji() : re.dir || 0, be.save(),
    be.translate(re.x - t, re.y - i), be.rotate(at + re.dirPlus), re.sid === oe.sid && (oe.inTrap && D.autoBreak360Hit || Ei.right) && 40 === oe.skinIndex || cn(re, be),
    be.restore()));
}

function cn(e, t) {
    (t = t || be).lineWidth = ft, t.lineJoin = "miter";
    const i = c / 4 * ($t.weapons[e.weaponIndex].armS || 1);
    const s = e.buildIndex < 0 && $t.weapons[e.weaponIndex].hndS || 1;
    const n = e.buildIndex < 0 && $t.weapons[e.weaponIndex].hndD || 1;
    if (e.tailIndex > 0 && function(e, t, i) {
        if (un = mn[e], !un) {
            let t = new Image;
            t.onload = function() {
                this.isLoaded = !0, this.onload = null;
            }, t.src = ".././img/accessories/access_" + e + ".png", mn[e] = t, un = t;
        }
        let s = gn[e];
        if (!s) {
            for (let t = 0; t < Ht.length; ++t) if (Ht[t].id == e) {
                s = Ht[t];
                break;
            }
            gn[e] = s;
        }
        un.isLoaded && (t.save(), t.translate(-20 - (s.xOff || 0), 0), s.spin && t.rotate(i.skinRot),
        t.drawImage(un, -s.scale / 2, -s.scale / 2, s.scale, s.scale), t.restore());
    }(e.tailIndex, t, e), e.buildIndex < 0 && !$t.weapons[e.weaponIndex].aboveHand) {
        const i = 3 == e.weaponIndex && 15 == e.secondaryIndex;
        wn($t.weapons[i ? 4 : e.weaponIndex], x.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
        null == $t.weapons[e.weaponIndex].projectile || $t.weapons[e.weaponIndex].hideProjectile || vn(e.scale, 0, $t.projectiles[$t.weapons[e.weaponIndex].projectile], be);
    }
    if (t.fillStyle = x.skinColors[e.skinColor], an(e.scale * Math.cos(i), e.scale * Math.sin(i), 14),
    an(e.scale * n * Math.cos(-i * s), e.scale * n * Math.sin(-i * s), 14), e.buildIndex < 0 && $t.weapons[e.weaponIndex].aboveHand && (wn($t.weapons[e.weaponIndex], x.weaponVariants[e.weaponVariant].src, e.scale, 0, t),
    null == $t.weapons[e.weaponIndex].projectile || $t.weapons[e.weaponIndex].hideProjectile || vn(e.scale, 0, $t.projectiles[$t.weapons[e.weaponIndex].projectile], be)),
    e.buildIndex >= 0) {
        const i = Dn($t.list[e.buildIndex]);
        t.drawImage(i, e.scale - $t.list[e.buildIndex].holdOffset, -i.width / 2);
    }
    an(0, 0, e.scale, t), e.skinIndex > 0 && (t.rotate(Math.PI / 2), pn(e.skinIndex, t, null, e));
}

let dn = {};

let fn = {};

let un;

function pn(e, t, i, s) {
    if (un = dn[e], !un) {
        let t = new Image;
        t.onload = function() {
            this.isLoaded = !0, this.onload = null;
        }, t.src = ".././img/hats/hat_" + e + ".png", dn[e] = t, un = t;
    }
    let n = i || fn[e];
    if (!n) {
        for (let t = 0; t < Ct.length; ++t) if (Ct[t].id == e) {
            n = Ct[t];
            break;
        }
        fn[e] = n;
    }
    un.isLoaded && t.drawImage(un, -n.scale / 2, -n.scale / 2, n.scale, n.scale), !i && n.topSprite && (t.save(),
    t.rotate(s.skinRot), pn(e + "_top", t, n, s), t.restore());
}

let mn = {};

let gn = {};

let bn = {};

function wn(e, t, i, s, n) {
    let a = e.src + (t || "");
    let o = bn[a];
    o || (o = new Image, o.onload = function() {
        this.isLoaded = !0;
    }, o.src = ".././img/weapons/" + a + ".png", bn[a] = o), o.isLoaded && n.drawImage(o, i + e.xOff - e.length / 2, s + e.yOff - e.width / 2, e.length, e.width);
}

function Mn(e, t, i) {
    for (let s = 0; s < se.length; s++) re = se[s], re.active && re.layer == e && re.inWindow && (re.update(et),
    re.active && $n(re.x - t, re.y - i, re.scale) && (be.save(), be.translate(re.x - t, re.y - i),
    be.rotate(re.dir), vn(0, 0, re, be, 1), be.restore()));
}

let yn = {};

function vn(e, t, i, s, n) {
    if (i.src) {
        let n = $t.projectiles[i.indx].src;
        let a = yn[n];
        a || (a = new Image, a.onload = function() {
            this.isLoaded = !0;
        }, a.src = ".././img/weapons/" + n + ".png", yn[n] = a), a.isLoaded && s.drawImage(a, e - i.scale / 2, t - i.scale / 2, i.scale, i.scale);
    } else 1 == i.indx && (s.fillStyle = "#939393", an(e, t, i.scale, s));
}

let kn = {};

function xn(e, t) {
    let i = e.index;
    let s = kn[i];
    if (!s) {
        let t = new Image;
        t.onload = function() {
            this.isLoaded = !0, this.onload = null;
        }, t.src = ".././img/animals/" + e.src + ".png", s = t, kn[i] = s;
    }
    if (s.isLoaded) {
        let i = 1.2 * e.scale * (e.spriteMlt || 1);
        t.drawImage(s, -i, -i, 2 * i, 2 * i);
    }
}

function On(e, t, i, s) {
    let n = x.riverWidth + s;
    let a = x.mapScale / 2 - t - n / 2;
    a < Ze && a + n > 0 && i.fillRect(0, a, Ye, n);
}

function Sn(i, s, n) {
    let a = i.lineWidth || 0;
    n /= 2, i.beginPath();
    let o = v / s;
    for (let l = 0; l < s; l++) i.lineTo(n + (n - a / 2) * t(o * l), n + (n - a / 2) * e(o * l));
    i.closePath();
}

!function() {
    let e = document.createElement("canvas");
    let t = 2 * x.volcanoScale;
    e.width = t, e.height = t;
    let i = e.getContext("2d");
    i.strokeStyle = "#3e3e3e", i.lineWidth = 11, i.fillStyle = "#7f7f7f", Sn(i, 10, t),
    i.fill(), i.stroke(), ut.land = e;
    let s = document.createElement("canvas");
    let n = 2 * x.innerVolcanoScale;
    s.width = n, s.height = n;
    let a = s.getContext("2d");
    a.lineWidth = 8.8, a.fillStyle = "#f54e16", a.strokeStyle = "#f56f16", Sn(a, 10, n),
    a.fill(), a.stroke(), ut.lava = s;
}();

class In {
    static cache={
        items: {},
        res: {}
    };
    static item(e, t, i, s) {
        if (s.strokeStyle = ct, s.lineWidth = ft, "apple" == e.name) {
            s.fillStyle = "#c15555", an(0, 0, e.scale, s), s.fillStyle = "#89a54c";
            let t = -c / 2;
            !function(e, t, i, s, n) {
                let a = e + i * Math.cos(s);
                let o = t + i * Math.sin(s);
                let l = .4 * i;
                n.moveTo(e, t), n.beginPath(), n.quadraticCurveTo((e + a) / 2 + l * Math.cos(s + Math.PI / 2), (t + o) / 2 + l * Math.sin(s + Math.PI / 2), a, o),
                n.quadraticCurveTo((e + a) / 2 - l * Math.cos(s + Math.PI / 2), (t + o) / 2 - l * Math.sin(s + Math.PI / 2), e, t),
                n.closePath(), n.fill(), n.stroke();
            }(e.scale * Math.cos(t), e.scale * Math.sin(t), 25, t + c / 2, s);
        } else if ("cookie" == e.name) {
            s.fillStyle = "#cca861", an(0, 0, e.scale, s), s.fillStyle = "#937c4b";
            let t = 4;
            let i = 2 * c / t;
            let n;
            for (let a = 0; a < t; a++) n = St.randInt(e.scale / 2.5, e.scale / 1.7), an(n * Math.cos(i * a), n * Math.sin(i * a), St.randInt(4, 5), s, !0);
        } else if ("cheese" == e.name) {
            s.fillStyle = "#f4f3ac", an(0, 0, e.scale, s), s.fillStyle = "#c3c28b";
            let t = 4;
            let i = 2 * c / t;
            let n;
            for (let a = 0; a < t; a++) n = St.randInt(e.scale / 2.5, e.scale / 1.7), an(n * Math.cos(i * a), n * Math.sin(i * a), St.randInt(4, 5), s, !0);
        } else if ("wood wall" == e.name || "stone wall" == e.name || "castle wall" == e.name) {
            s.fillStyle = "castle wall" == e.name ? "#83898e" : "wood wall" == e.name ? "#a5974c" : "#939393";
            let t = "castle wall" == e.name ? 4 : 3;
            on(s, t, 1.1 * e.scale, 1.1 * e.scale), s.fill(), s.stroke(), s.fillStyle = "castle wall" == e.name ? "#9da4aa" : "wood wall" == e.name ? "#c9b758" : "#bcbcbc",
            on(s, t, .65 * e.scale, .65 * e.scale), s.fill();
        } else if ("spikes" == e.name || "greater spikes" == e.name || "poison spikes" == e.name || "spinning spikes" == e.name) {
            s.fillStyle = "poison spikes" == e.name ? "#7b935d" : "#939393";
            let i = .6 * e.scale;
            on(s, "spikes" == e.name ? 5 : 6, e.scale, i), s.fill(), s.stroke(), s.fillStyle = "#a5974c",
            an(0, 0, i, s), s.fillStyle = t ? "#a64c4c" : "#c9b758", an(0, 0, i / 2, s, !0);
        } else if ("windmill" == e.name || "faster windmill" == e.name || "power mill" == e.name) s.fillStyle = "#a5974c",
        an(0, 0, i, s), s.fillStyle = "#c9b758", rn(0, 0, 1.5 * i, 29, 4, s), s.fillStyle = "#a5974c",
        an(0, 0, .5 * i, s); else if ("mine" == e.name) s.fillStyle = "#939393", on(s, 3, e.scale, e.scale),
        s.fill(), s.stroke(), s.fillStyle = "#bcbcbc", on(s, 3, .55 * e.scale, .65 * e.scale),
        s.fill(); else if ("sapling" == e.name) for (let t = 0; t < 2; t++) {
            let i = e.scale * (t ? .5 : 1);
            on(s, 7, i, .7 * i), s.fillStyle = t ? "#b4db62" : "#9ebf57", s.fill(), t || s.stroke();
        } else if ("pit trap" == e.name) s.fillStyle = "#a5974c", on(s, 3, 1.1 * e.scale, 1.1 * e.scale),
        s.fill(), s.stroke(), s.fillStyle = t ? "#a64c4c" : ct, on(s, 3, .65 * e.scale, .65 * e.scale),
        s.fill(); else if ("boost pad" == e.name) s.fillStyle = "#7e7f82", ln(0, 0, 2 * e.scale, 2 * e.scale, s),
        s.fillStyle = "#dbd97d", function(e, t) {
            t = t || be;
            let i = e * (Math.sqrt(3) / 2);
            t.beginPath(), t.moveTo(0, -i / 2), t.lineTo(-e / 2, i / 2), t.lineTo(e / 2, i / 2),
            t.lineTo(0, -i / 2), t.fill(), t.closePath();
        }(e.scale, s); else if ("turret" == e.name) {
            s.fillStyle = "#a5974c", an(0, 0, e.scale, s), s.fill(), s.stroke(), s.fillStyle = "#939393";
            let t = 50;
            ln(0, -t / 2, .9 * e.scale, t, s), an(0, 0, .6 * e.scale, s);
        } else if ("platform" == e.name) {
            s.fillStyle = "#cebd5f";
            let t = 4;
            let i = 2 * e.scale;
            let n = i / t;
            let a = -e.scale / 2;
            for (let o = 0; o < t; o++) ln(a - n / 2, 0, n, 2 * e.scale, s), a += i / t;
        } else "healing pad" == e.name ? (s.fillStyle = "#7e7f82", ln(0, 0, 2 * e.scale, 2 * e.scale, s),
        s.fillStyle = "#db6e6e", rn(0, 0, .65 * e.scale, 20, 4, s, !0)) : "spawn pad" == e.name ? (s.fillStyle = "#7e7f82",
        ln(0, 0, 2 * e.scale, 2 * e.scale, s), s.fillStyle = "#71aad6", an(0, 0, .6 * e.scale, s)) : "blocker" == e.name ? (s.fillStyle = "#7e7f82",
        an(0, 0, e.scale, s), s.rotate(c / 4), s.fillStyle = "#db6e6e", rn(0, 0, .65 * e.scale, 20, 4, s, !0)) : "teleporter" == e.name && (s.fillStyle = "#7e7f82",
        an(0, 0, e.scale, s), s.fillStyle = "#d76edb", an(0, 0, .5 * e.scale, s, !0));
    }
    static res(e, t, i) {
        const {type: s, scale: n, sid: a} = e;
        if (i.strokeStyle = ct, i.lineWidth = ft, 0 === s) {
            let e, s;
            e = 1 === t ? "#e3f1f4" : "#9ebf57", s = 1 === t ? "#fff" : "#b4db62", i.fillStyle = e,
            on(i, a % 2 == 0 ? 5 : 7, n, .7 * n), i.fill(), i.stroke(), i.fillStyle = s, on(i, a % 2 == 0 ? 5 : 7, .5 * n, .35 * n),
            i.fill();
        } else if (1 === s) if (2 === t) i.fillStyle = "#606060", on(i, 6, .3 * n, .71 * n),
        i.fill(), i.stroke(), i.fillStyle = "#89a54c", an(0, 0, .55 * n, i), i.fillStyle = "#a5c65b",
        an(0, 0, .3 * n, i, !0); else {
            !function(e, t, i, s) {
                let n = Math.PI / 2 * 3;
                let a = Math.PI / t;
                let o;
                e.beginPath(), e.moveTo(0, -s);
                for (let l = 0; l < t; l++) o = St.randInt(i + .9, 1.2 * i), e.quadraticCurveTo(Math.cos(n + a) * o, Math.sin(n + a) * o, Math.cos(n + 2 * a) * s, Math.sin(n + 2 * a) * s),
                n += 2 * a;
                e.lineTo(0, -s), e.closePath();
            }(i, 6, n, .7 * n), i.fillStyle = 4 === t ? "#89a5c8" : 1 === t ? "#e3f1f4" : "#89a54c",
            i.fill(), i.stroke(), i.fillStyle = 0 === t || 3 === t ? "#c15555" : "#6a64af";
            const e = 4;
            const s = 2 * c / e;
            for (let t = 0; t < e; t++) {
                const e = St.randInt(n / 3.5, n / 2.3);
                const a = St.randInt(10, 12);
                an(e * Math.cos(s * t), e * Math.sin(s * t), a, i);
            }
        } else 2 === s || 3 === s ? (i.fillStyle = 2 === s ? 2 === t ? "#938d77" : "#939393" : "#e0c655",
        on(i, 3, n, n), i.fill(), i.stroke(), i.fillStyle = 2 === s ? 2 === t ? "#b2ab90" : "#bcbcbc" : "#ebdca3",
        on(i, 3, .55 * n, .65 * n), i.fill()) : 5 === s && (i.fillStyle = "#888", ln(0, 0, 2 * n, 2 * n, i));
    }
    static volcano(e, t) {
        ut.animationTime += et, ut.animationTime %= x.volcanoAnimationDuration;
        let i = x.volcanoAnimationDuration / 2;
        let s = 1.7 + Math.abs(i - ut.animationTime) / i * .3;
        let n = x.innerVolcanoScale * s;
        be.drawImage(ut.land, ut.x - x.volcanoScale - e, ut.y - x.volcanoScale - t, 2 * x.volcanoScale, 2 * x.volcanoScale),
        be.drawImage(ut.lava, ut.x - n - e, ut.y - n - t, 2 * n, 2 * n);
    }
}

function Dn(e, t) {
    let i = t ? "?" + e.id : e.id;
    let s = In.cache.items[i];
    if (!s) {
        let s = document.createElement("canvas");
        let n = "windmill" == e.name ? $t.list[4].scale : e.scale;
        let a = $t.list[e.id].spritePadding || 0;
        s.width = s.height = 2.5 * n + ft + a;
        let o = s.getContext("2d");
        return o.translate(s.width / 2, s.height / 2), o.rotate(c / 2), In.item(e, t, n, o),
        o = s, In.cache.items[i] = new Image, In.cache.items[i].onload = function() {
            this.isLoaded = !0;
        }, In.cache.items[i].src = s.toDataURL(), In.cache.items[i];
    }
    return s;
}

function Tn(e, t, i, s) {
    let n = Dn(e, !!s && !e.isTeamObject(oe));
    n.isLoaded && (be.save(), be.translate(t, i), s && be.rotate(e.dir), be.drawImage(n, -n.width / 2, -n.height / 2),
    e.blocker && (be.strokeStyle = "#db6e6e", be.globalAlpha = .3, be.lineWidth = 6,
    an(0, 0, e.blocker, be, !1, !0)), be.restore());
}

function An(e, t, i) {
    const s = function(e) {
        const t = St.getBiome(e.y);
        const i = `${e.type}_${e.scale}_${t}`;
        if (!In.cache.res[i]) {
            const s = document.createElement("canvas");
            const n = 2.1 * e.scale + ft;
            s.width = s.height = n;
            const a = s.getContext("2d");
            a.translate(n / 2, n / 2), 5 !== e.type && a.rotate(St.randFloat(0, c)), In.res(e, t, a),
            In.cache.res[i] = s;
        }
        return In.cache.res[i];
    }(e);
    be.save(), be.globalAlpha = 1, be.drawImage(s, t - s.width / 2, i - s.height / 2),
    be.restore();
}

function $n(e, t, i) {
    return e + i >= 0 && e - i <= Ye && t + i >= 0;
}

function Pn(e, t, i) {
    let s, n;
    for (let a = 0; a < ae.length; a++) {
        let o = ae[a];
        o.alive && (s = o.x + o.xWiggle - t, n = o.y + o.yWiggle - i, 0 === e && o.update(et),
        o.layer === e && $n(s, n, o.scale + (o.blocker || 0)) && (o.isItem ? (be.globalAlpha = o.alpha,
        Tn(o, s, n, 1), D.doBuildingHealth && o.health < o.maxHealth && (be.fillStyle = dt,
        be.roundRect(Math.floor(s - x.healthBarWidth / 2 - x.healthBarPad), Math.floor(n - x.healthBarPad), x.healthBarWidth + 2 * x.healthBarPad, 17, 8),
        be.fill(), be.fillStyle = o.isTeamObject(oe) ? "#8ecc51" : "#cc5151", be.roundRect(Math.floor(s - x.healthBarWidth / 2), Math.floor(n), Math.floor(x.healthBarWidth * (o.health / o.maxHealth)), 17 - 2 * x.healthBarPad, 7),
        be.fill())) : 4 === o.type ? In.volcano() : An(o, s, n)));
    }
}

class Hn {
    constructor(e, t) {
        this.init = function(e, t) {
            this.scale = 0, this.x = e, this.y = t, this.active = !0;
        }, this.update = function(e, i) {
            this.active && (this.scale += .05 * i, this.scale >= t ? this.active = !1 : (e.globalAlpha = 1 - Math.max(0, this.scale / t),
            e.beginPath(), e.arc(this.x / x.mapScale * He.width, this.y / x.mapScale * He.width, this.scale, 0, 2 * Math.PI),
            e.stroke()));
        }, this.color = e;
    }
}

function Cn(e, t) {
    Di = Ii.find(e => !e.active), Di || (Di = new Hn("#fff", x.mapPingScale), Ii.push(Di)),
    Di.init(e, t);
}

let Bn = [ "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/100px-Crosshairs_Red.svg.png", "https://i.postimg.cc/bGYXgnJt/backupcrosshair.webp" ];

let Rn = {};

let _n = {};

let Nn = [ "crown", "skull" ];

function En() {
    if (oe) if (Vi.active) Vi.dir = zi(), void 0 !== Vi.dir && (st += 20 * Math.cos(Vi.dir),
    nt += 20 * Math.sin(Vi.dir)); else {
        const e = St.getDistance(st, nt, oe.x, oe.y);
        const t = St.getDirection(oe.x, oe.y, st, nt);
        let i = Math.min(.01 * e * et, e);
        e > .05 ? (st += i * Math.cos(t), nt += i * Math.sin(t)) : (st = oe.x, nt = oe.y);
    } else st = x.mapScale / 2, nt = x.mapScale / 2;
    let e = tt - 1e3 / x.serverUpdateRate;
    let t;
    for (let i = 0; i < ee.length + Z.length; ++i) if (re = ee[i] || Z[i - ee.length],
    re && re.visible) if (re.forcePos) re.x = re.x2, re.y = re.y2, re.dir = re.d2; else {
        let i = re.t2 - re.t1;
        let s = (e - re.t1) / i;
        const n = 170;
        re.dt += et;
        let a = Math.min(1.7, re.dt / n);
        t = re.x2 - re.x1, re.x = re.x1 + t * a, t = re.y2 - re.y1, re.y = re.y1 + t * a,
        re.dir = Math.lerpAngle(re.d2, re.d1, Math.min(1.2, s));
    }
    let i = st - Ye / 2;
    let s = nt - Ze / 2;
    x.snowBiomeTop - s <= 0 && x.mapScale - x.snowBiomeTop - s >= Ze ? (be.fillStyle = "#b6db66",
    be.fillRect(0, 0, Ye, Ze)) : x.mapScale - x.snowBiomeTop - s <= 0 ? (be.fillStyle = "#dbc666",
    be.fillRect(0, 0, Ye, Ze)) : x.snowBiomeTop - s >= Ze ? (be.fillStyle = "#fff",
    be.fillRect(0, 0, Ye, Ze)) : x.snowBiomeTop - s >= 0 ? (be.fillStyle = "#fff", be.fillRect(0, 0, Ye, x.snowBiomeTop - s),
    be.fillStyle = "#b6db66", be.fillRect(0, x.snowBiomeTop - s, Ye, Ze - (x.snowBiomeTop - s))) : (be.fillStyle = "#b6db66",
    be.fillRect(0, 0, Ye, x.mapScale - x.snowBiomeTop - s), be.fillStyle = "#dbc666",
    be.fillRect(0, x.mapScale - x.snowBiomeTop - s, Ye, Ze - (x.mapScale - x.snowBiomeTop - s))),
    mt || (rt += ht * x.waveSpeed * et, rt >= x.waveMax ? (rt = x.waveMax, ht = -1) : rt <= 1 && (rt = ht = 1),
    be.globalAlpha = 1, be.fillStyle = "#dbc666", On(0, s, be, x.riverPadding), be.fillStyle = "#91b2db",
    On(0, s, be, 250 * (rt - 1))), be.lineWidth = 4, be.strokeStyle = "#000", be.globalAlpha = .06,
    be.beginPath();
    const n = D.doRegularGrid || L ? 60 : 1440;
    for (let e = -st; e < Ye; e += n) e > 0 && (be.moveTo(e, 0), be.lineTo(e, Ze));
    for (let e = -nt; e < Ze; e += n) e > 0 && (be.moveTo(0, e), be.lineTo(Ye, e));
    be.stroke(), be.globalAlpha = 1, be.strokeStyle = ct, Pn(-1, i, s), Mn(0, i, s),
    hn(0, i, s), be.globalAlpha = 1;
    for (let e = 0; e < Z.length; ++e) re = Z[e], re.active && re.visible && (re.animate(et),
    be.save(), be.translate(re.x - i, re.y - s), be.rotate(re.dir + re.dirPlus - Math.PI / 2),
    xn(re, be), be.restore());
    if (Pn(0, i, s), Mn(1, i, s), Pn(1, i, s), hn(1, i, s), Pn(2, i, s), Pn(3, i, s),
    be.fillStyle = "#000", be.globalAlpha = .09, i <= 0 && be.fillRect(0, 0, -i, Ze),
    x.mapScale - i <= Ye) {
        let e = Math.max(0, -s);
        be.fillRect(x.mapScale - i, e, Ye - (x.mapScale - i), Ze - e);
    }
    if (s <= 0 && be.fillRect(-i, 0, Ye + i, -s), x.mapScale - s <= Ze) {
        let e = Math.max(0, -i);
        let t = 0;
        x.mapScale - i <= Ye && (t = Ye - (x.mapScale - i)), be.fillRect(e, x.mapScale - s, Ye - e - t, Ze - (x.mapScale - s));
    }
    if (1) for (let e = 0; e < ti.markers.length; e++) {
        let t = ti.markers[e];
        if (t && !isNaN(t.x) && !isNaN(t.y)) {
            be.save(), be.translate(t.x - i, t.y - s), be.globalAlpha = "pit trap" == t.name ? .18 : .3,
            be.rotate(t.angle);
            let e = Dn(t);
            be.drawImage(e, -e.width / 2, -e.height / 2), be.restore();
        }
    }
    be.globalAlpha = 1, be.fillStyle = "rgba(0, 0, 70, .35)", be.fillRect(0, 0, Ye, Ze),
    be.strokeStyle = dt, be.globalAlpha = 1;
    for (let e = 0; e < ee.length + Z.length; ++e) if (re = ee[e] || Z[e - ee.length],
    re.visible && (be.strokeStyle = dt, 10 != re.skinIndex || re == oe || re.team && re.team == oe.team)) {
        const e = re.isPlayer && re.sid != oe.sid ? `[${St.replaceInvalid(re.primaryIndex)}/${St.replaceInvalid(re.secondaryIndex)}/${St.replaceInvalid(re.dmgOverTime.time)}] ` : "";
        let t = (re.team ? "[" + re.team + "] " : "") + (L ? "" : e) + (re.name || "");
        if ("" != t) {
            be.font = (re.nameScale || 30) + "px Hammersmith One", be.fillStyle = "#fff", be.textBaseline = "middle",
            be.textAlign = "center", be.lineWidth = re.nameScale ? 11 : 8, be.lineJoin = "round",
            be.strokeText(t, re.x - i, re.y - s - re.scale - x.nameY), be.fillText(t, re.x - i, re.y - s - re.scale - x.nameY);
            const e = x.crownIconScale;
            if (re.isLeader && _n.crown.isLoaded) {
                let n = re.x - i - e / 2 - be.measureText(t).width / 2 - x.crownPad;
                be.drawImage(_n.crown, n, re.y - s - re.scale - x.nameY - e / 2 - 5, e, e);
            }
            if (1 == re.iconIndex && _n.skull.isLoaded) {
                let n = re.x - i - e / 2 + be.measureText(t).width / 2 + x.crownPad;
                be.drawImage(_n.skull, n, re.y - s - re.scale - x.nameY - e / 2 - 5, e, e);
            }
            if (re.isPlayer && !L) {
                const n = Rn[re.isLastAnti ? 1 : 0];
                if (yi.wait && re == ue && n.isLoaded && de.length) {
                    let e = 2.2 * ue.scale;
                    be.drawImage(n, ue.x - i - e / 2, ue.y - s - e / 2, e, e);
                }
                be.fillStyle = "#ff0000";
                let a = re.x - i - e / 2 + be.measureText(t).width / 2 + x.crownPad + (1 == re.iconIndex ? 2.75 * (re.nameScale || 30) : re.nameScale || 30);
                let o = 45 == re.skinIndex && re.shameTimer > 0 ? re.shameTimer : re.shameCount;
                be.strokeText(o, a, re.y - s - re.scale - x.nameY), be.fillText(o, a, re.y - s - re.scale - x.nameY);
            }
        }
        if (ms.renderTracer(i, s), re.health > 0 && (be.fillStyle = dt, be.roundRect(re.x - i - x.healthBarWidth - x.healthBarPad, re.y - s + re.scale + x.nameY, 2 * x.healthBarWidth + 2 * x.healthBarPad, 17, 8),
        be.fill(), be.fillStyle = re == oe || re.team && re.team == oe.team ? "#8ecc51" : "#cc5151",
        be.roundRect(re.x - i - x.healthBarWidth, re.y - s + re.scale + x.nameY + x.healthBarPad, 2 * x.healthBarWidth * (re.health / re.maxHealth), 17 - 2 * x.healthBarPad, 7),
        be.fill(), re.isPlayer && !L)) {
            const e = x;
            let t = e.healthBarWidth;
            let n = {
                primary: null == re.primaryIndex ? 1 : ($t.weapons[re.primaryIndex].speed - re.reloads[re.primaryIndex]) / $t.weapons[re.primaryIndex].speed,
                secondary: null == re.secondaryIndex ? 1 : ($t.weapons[re.secondaryIndex].speed - re.reloads[re.secondaryIndex]) / $t.weapons[re.secondaryIndex].speed,
                turret: (2500 - re.reloads[53]) / 2500
            };
            const a = e => {
                const t = re.reloads[e];
                return null == e || 0 == t ? "#FFF533" : `hsl(${50 * Math.ceil(t / 100)}, 50%, 60%)`;
            };
            if (be.fillStyle = dt, be.roundRect(re.x - i - e.healthBarWidth - e.healthBarPad + 50, re.y - s + re.scale + e.nameY - 13, t + 2 * e.healthBarPad, 17, 8),
            be.fill(), be.fillStyle = a(re.secondaryIndex), be.roundRect(re.x - i - e.healthBarWidth + 50, re.y - s + re.scale + e.nameY - 13 + e.healthBarPad, t * n.secondary, 17 - 2 * e.healthBarPad, 7),
            be.fill(), be.fillStyle = dt, be.roundRect(re.x - i - e.healthBarWidth - e.healthBarPad, re.y - s + re.scale + e.nameY - 13, t + 2 * e.healthBarPad, 17, 8),
            be.fill(), be.fillStyle = a(re.primaryIndex), be.roundRect(re.x - i - e.healthBarWidth, re.y - s + re.scale + e.nameY - 13 + e.healthBarPad, t * n.primary, 17 - 2 * e.healthBarPad, 7),
            be.fill(), re == oe && D.doTurretReloadBars && (be.fillStyle = dt, be.roundRect(re.x - i - e.healthBarWidth - e.healthBarPad, re.y - s + re.scale + e.nameY + 13, 2 * e.healthBarWidth + 2 * e.healthBarPad, 17, 8),
            be.fill(), be.fillStyle = "#8f8366", be.roundRect(re.x - i - e.healthBarWidth, re.y - s + re.scale + e.nameY + 13 + e.healthBarPad, 2 * e.healthBarWidth * (null == re.reloads[53] ? 1 : (2500 - re.reloads[53]) / 2500), 17 - 2 * e.healthBarPad, 7),
            be.fill()), re == oe) {
                be.strokeStyle = dt, be.textAlign = "center", be.textBaseline = "middle", be.fillStyle = "#fff",
                be.font = "20px Hammersmith One", be.lineJoin = "round", be.lineWidth = 5;
                let t = `[${(K.count || 0) + "/" + (oe.reSync ? "false" : "true")}/${(isNaN(xt.max) ? [ "n", "a" ] : [ xt.max, window.pingTime, xt.min ]).join(",")}]`;
                be.strokeText(t, re.x - i, re.y - s + re.scale + e.nameY + (D.doTurretReloadBars ? 42 : 28)),
                be.fillText(t, re.x - i, re.y - s + re.scale + e.nameY + (D.doTurretReloadBars ? 42 : 28));
            }
            if (D.doRenderWeaponRanges && (re.isPlayer && (re.weaponIndex < 9 || 10 == re.weaponIndex || 14 == re.weaponIndex) && (be.beginPath(),
            be.arc(re.x - i, re.y - s, re.scale + re.velWeaponRange, re.dir - Math.PI / 2, re.dir + Math.PI / 2),
            be.globalAlpha = .1, be.fillStyle = "red", be.fill()), be.globalAlpha = 1), D.doRenderExpectedPos) {
                be.lineWidth = 3, be.beginPath(), be.strokeStyle = "blue";
                let e = {
                    x: re.x2 - i,
                    y: re.y2 - s
                };
                be.moveTo(re.x - i, re.y - s), be.lineTo(e.x, e.y), be.stroke();
            }
            if (re.isPlayer && re != oe && (re.team != oe.team || !re.team) && D.doEnemyArrows) {
                const e = Ye / 2;
                const t = Ze / 2;
                const i = 16 / 9;
                const s = Math.atan2(re.y2 - oe.y2, re.x2 - oe.x2);
                const n = oe.x2 - re.x2;
                const a = oe.y2 - re.y2;
                const o = Math.min(1, 100 * Math.sqrt(n ** 2 + (i * a) ** 2) / 840 / t);
                const l = t * o;
                const r = e + l * Math.cos(s);
                const h = t + l * Math.sin(s);
                be.save(), be.translate(r, h), be.rotate(s + Math.PI / 2), be.fillStyle = '#ffffff',
                be.globalAlpha = o, be.beginPath();
                let c = Math.sqrt(3) / 2 * 25;
                be.moveTo(0, -c / 1.5), be.lineTo(-12.5, c / 2), be.lineTo(12.5, c / 2), be.lineTo(0, -c / 1.5),
                be.closePath(), be.fill(), be.restore();
            }
        }
    }
    be.globalAlpha = 1, At.update(et, be, i, s);
    for (let e = 0; e < ee.length; ++e) if (re = ee[e], re.visible && re.chatCountdown > 0) {
        re.chatCountdown -= et, re.chatCountdown <= 0 && (re.chatCountdown = 0), be.font = "32px Hammersmith One";
        let e = be.measureText(re.chatMessage);
        be.textBaseline = "middle", be.textAlign = "center";
        let t = re.x - i;
        let n = re.y - re.scale - s - 90;
        let a = 47;
        let o = e.width + 17;
        be.fillStyle = "rgba(0,0,0,0.2)", be.roundRect(t - o / 2, n - a / 2, o, a, 6), be.fill(),
        be.fillStyle = "#fff", be.fillText(re.chatMessage, t, n);
    }
    be.globalAlpha = 1, function(e) {
        if (oe && oe.alive) {
            Ce.clearRect(0, 0, He.width, He.height), Ce.lineWidth = 4;
            for (let t = 0; t < Ii.length; ++t) Di = Ii[t], Ce.strokeStyle = Di.color, Di.update(Ce, e);
            if (ms.objects.length) for (let e = 0; e < ms.objects.length; e++) re = ms.objects[e],
            Ce.fillStyle = "#fff", Ce.font = "34px Hammersmith One", Ce.textBaseline = "middle",
            Ce.textAlign = "center", Ce.fillText("L", re.x / x.mapScale * He.width, re.y / x.mapScale * He.height);
            if (Es.length) for (let e = 0; e < Es.length; e++) re = Es[e], Ce.fillStyle = "#d76edb",
            Ce.font = "34px Hammersmith One", Ce.textBaseline = "middle", Ce.textAlign = "center",
            Ce.fillText("T", re.x / x.mapScale * He.width, re.y / x.mapScale * He.height);
            if (Ce.globalAlpha = 1, Ce.fillStyle = "#fff", an(oe.x / x.mapScale * He.width, oe.y / x.mapScale * He.height, 7, Ce, !0),
            Ce.fillStyle = "rgba(255,255,255,0.35)", oe.team && Oi) for (let e = 0; e < Oi.length; ) an(Oi[e] / x.mapScale * He.width, Oi[e + 1] / x.mapScale * He.height, 7, Ce, !0),
            e += 2;
            xi && (Ce.fillStyle = "#fc5553", Ce.font = "34px HammerSmith One", Ce.textBaseline = "middle",
            Ce.textAlign = "center", Ce.fillText("x", xi.x / x.mapScale * He.width, xi.y / x.mapScale * He.height)),
            Si && (Ce.fillStyle = "#fff", Ce.font = "34px Hammersmith One", Ce.textBaseline = "middle",
            Ce.textAlign = "center", Ce.fillText("x", Si.x / x.mapScale * He.width, Si.y / x.mapScale * He.height));
        }
    }(et);
}

!function() {
    for (let e = 0; e < Nn.length; ++e) {
        let t = new Image;
        t.onload = function() {
            this.isLoaded = !0;
        }, t.src = "./../img/icons/" + Nn[e] + ".png", _n[Nn[e]] = t;
    }
    for (let e = 0; e < Bn.length; ++e) {
        let t = new Image;
        t.onload = function() {
            this.isLoaded = !0;
        }, t.src = Bn[e], Rn[e] = t;
    }
}(), window.requestAnimFrame = function() {
    return null;
}, window.rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(e) {
    window.setTimeout(e, 1e3 / 60);
}, function e() {
    tt = performance.now(), et = tt - it, it = tt, En(), rAF(e);
}(), window.debug = function() {
    yi.reset(), oe.autoAim = !1, Ps.waitHit = !1, In.cache.items = [], In.cache.res = [];
};














