// ==UserScript==
// @name         Nova Client (chicken OT)
// @namespace    nova-chicken-ot
// @author       Nova Client by lvwercia_, one tick from chicken v4.6.2 by Mega & kwyxl
// @description  Nova Client with its one tick replaced by chicken's
// @version      v1-ot1
// @match        *://*.moomoo.io/*
// @run-at       document_idle
// @grant        none
// @icon         https://i.pinimg.com/736x/94/99/c5/9499c5f5d00acd847d019fca234ff832.jpg
// ==/UserScript==
// Added missing ShowSettingText function
function ShowSettingText(time, text, color) {
    try {
        console.log(`[SettingText] ${text} (${time}ms)`);
    } catch (err) {
        console.warn("ShowSettingText error:", err);
    }
}
let saveVal = false;
let showRealDir = 0;
let tmpPrimaryVariant = false;
let noZ = false;
let tmpObj = false;
let eMM=` <style>

/* ==% MAIN MENU EDITS %== */

/* % MENUCARD STYLES % */
#setupCard {
    vertical-align: top;
    text-align: center;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

#guideCard {
    vertical-align: top;
    text-align: center;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

/* % GAME NAME CSS %*/
#gameName {
    font-size: 170px;
    margin-bottom: -25px;
    text-shadow: 0px 0px 31px #fff;
    color: #fff;
}

/* Promo Img */
#promoImgHolder {
    vertical-align: top;
    text-align: center;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

/* % OTHER VISUALS % */
.menuCard {
    vertical-align: top;
    text-align: center;
    word-wrap: break-word;
    margin: 5px;
    display: inline-block;
    padding: 18px;
    border-radius: 30px;
    background: #ffffff;
    box-shadow: 0px 0px 17px 5px rgb(255 255 255);
    transition: transform 0.5s ease 0s;
    overflow: scroll;
    position: relative;
}

#guideCard::-webkit-scrollbar {
    width: 0px;
    height: 0px;
}

.skinColorItem {
    height: 25px;
    width: 25px;
    border: 4px solid rgb(0 0 0 / 24%);
    transition: .5s;
}

.menuButton {
    border-radius: 20px;
}
</style>`

const sE = document.createElement('style');
sE.innerHTML = eMM;

mainMenu.appendChild(sE);
let tracker = {
    draw4: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw3: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw2: {
        active: false,
        x: 0,
        y: 0,
        scale: 0,
    },
    draw1: {
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
}
// CONFIGS:
let gC = function(a, b) {
    try {
        let res = JSON.parse(getSavedVal(a));
        if (typeof res === "object") {
            return b;
        } else {
            return res;
        }
    } catch(e) {
        return b;
    }
};
function setConfigs() {
    return {
        HKH: false,
        autoOneFrame: true,
        safeTick: true,
        bushGear: true,
        AutoTrapHammerTickEvent: true,
    };
}
let configs = setConfigs();
window.removeConfigs = function () {
    for (let cF in configs) {
        deleteVal(cF, configs[cF]);
    }
};

for (let cF in configs) {
    configs[cF] = gC(cF, configs[cF]);
}
const HTML = {
    constructor(element) {
        this.element = element;
    },
    add(code) {
        if (!this.element) return undefined;
        this.element.innerHTML += code;
    },

    newLine: function(amount) {
        let text = ``;
        for (let i = 0; i < amount; i++) {
            text += `<br>`;
        }
        return text;
    },
    line: function() {
        return `<hr>`;
    },
    text: function(id, value, size, length) {
        return `<input type = "text" id = ${id} size = ${size} value = ${value} maxlength = ${length}>`;
    },
    checkBox: function(id, name, checked) {
        return `<input type="checkbox" ${checked ? "checked" : ""} id="${id}">${name}`;
    },
    button: function(id, name, onclick, classs) {
        return `<button class = ${classs} id = ${id} onclick = ${onclick}>${name}</button>`;
    },

    menuSelector: function(setting) {
        let newButton = `<button`;
        setting.id && (newButton += ` id="${setting.id}"`);
        setting.style && (newButton += ` style="${setting.style.replaceAll(" ", "")}"`);
        setting.class && (newButton += ` class="${setting.class}"`);
        setting.onclick && (newButton += ` onclick="${setting.onclick}"`);
        newButton += `>${setting.innerHTML}</button>`;
        return newButton;
    },
    selectMenu: function(setting) {
        if (!setting.id) {
            alert("please put id skid");
            return;
        }
        let selectHTML = `<select id="${setting.id}" class="${setting.class || ""}" style="${setting.style || ""}">`;
        let firstKey = null;
        for (let key in setting.menu) {
            if (firstKey === null) firstKey = key;
            selectHTML += `
        <option
            id="O_${key}"
            value="${key}"
            ${setting.menu[key] ? "selected" : ""}
            style="
                color: ${setting.menu[key] ? "#000" : "#fff"};
                background: ${setting.menu[key] ? "#8ecc51" : "#cc5151"};
            ">
            ${key}
        </option>`;
        }
        selectHTML += `</select>`;
        this.add(selectHTML);
        let last = "check_" + firstKey;
        let i = 0;
        for (let key in setting.menu) {
            this.add(`
            <input
                type="checkbox"
                id="check_${key}"
                class="checkB"
                ${setting.menu[key] ? "checked" : ""}
                style="display:${i === 0 ? "inline-block" : "none"}; margin:2px 0;"
                onclick="window.${key}Func()"
            >
            <label for="check_${key}" style="color:#fff; margin-right:10px;">${key}</label>
        `);
            window[key + "Func"] = () => {
                const cb = getEl("check_" + key);
                setting.menu[key] = cb.checked;
                saveVal(key, cb.checked);
                const opt = getEl("O_" + key);
                opt.style.color = cb.checked ? "#000" : "#fff";
                opt.style.background = cb.checked ? "#8ecc51" : "#cc5151";
            };
            i++;
        }
        window[setting.id + "Func"] = () => {
            const sel = getEl(setting.id);
            if (!sel) return;
            getEl(last).style.display = "none";
            last = "check_" + sel.value;
            getEl(last).style.display = "inline-block";
        };
        const selEl = getEl(setting.id);
        if (selEl) selEl.addEventListener("change", window[setting.id + "Func"]);
    },
    select: function(id, selects) {
        let text = `<select id = ${id}>`;
        selects.forEach((e,i)=>{
            text += `<option value = ${e.value} ${e.selected ? ` selected` : ``}>${e.name}</option>`;
            if (i == selects.length - 1) {
                text += `</select>`;
            }
        });
        return text;
    },
    modChange: function(id, selects) {
        console.log("test");
    },
    hotkey: function(id, value, size, length) {
        return `<input type = "text" id = ${id} size = ${size} value = ${value} maxlength = ${length}><input type = "checkbox" checked id = ${id + "k"}>`;
    },
    addCheckBox: (id = "", isChecked = false, onclick = "! function(){}()") => `<label class="switch"><input type = "checkbox" id = "${id}" ${isChecked ? "checked" : ""} onclick = "${onclick}"><span class="slider round"></span></label>`,
    addOptions: function(id = "", selected = "", options = {}, oninput = "! function(){}()") {
        let optionsText = "";
        for (let i in options) {
            optionsText +=
                `<option ${i == selected ? "selected" : ""} value = "${i}">${i}</option>`;
        }
        return `<select class="select" id = "${id}" oninput = "${oninput}">${optionsText}</select>`;
    },
}
let safewalking = false;
let bultect = false;
let antispiketicked = true;
const $ = window.$;
const getEl = id => document.getElementById(id);
const createEl = El => document.createElement(El);
const JSONStringify = JSON.stringify;
const JSONParse = JSON.parse;

const {
    sin, cos, acos, min, max, random, floor, ceil, round, PI, sqrt, abs, pow, LN2, atan2, hypot
} = Math;

!function() {
    'use strict';

    let newFont = document.createElement("link");
    newFont.rel = "stylesheet";
    newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
    newFont.type = "text/css";
    document.body.append(newFont);

    let min = document.createElement("script");
    min.src = "https://rawgit.com/kawanet/msgpack-lite/master/dist/msgpack.min.js";
    document.body.append(min);

    let config = window.config;
    // CLIENT:
    config.clientSendRate = 0; // Aim Packet Send Rate
    config.serverUpdateRate = 9;
    // UI:
    config.deathFadeout = 0;
    // CHECK IN SANDBOX:
    config.isSandbox = window.location.hostname == "sandbox.moomoo.io";
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

    // CUSTOMIZATION:
    config.skinColors = ["#bf8f54", "#cbb091", "#896c4b",
                         "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
                         "#8bc373", "#91b2db"
                        ];
    config.weaponVariants = [{
        id: 0,
        src: "",
        xp: 0,
        val: 1,
    }, {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1,
    }, {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18,
    }, {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18,
    }, {
        id: 4,
        src: "_e",
        poison: true,
        heal: true,
        xp: 24000,
        val: 1.18,
    }];

    let changed = false;

    // STORAGE:
    let canStore;
    if (typeof (Storage) !== "undefined") {
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

    // SOME FUNCTIONS:
    window.debug = function() {};
    window.leave = function() {};

    window.ping = 90;

    let modMenus = document.createElement("div");
    modMenus.id = "modMenus";
    document.body.append(modMenus);
    modMenus.style = `
display: block;
padding: 10px;
background-color: rgba(0, 0, 0, 0.25);
border-radius: 3px;
position: absolute;
left: 20px;
top: 20px;
max-width: 350px;
min-width: 250px;
min-height: 400;
max-height 700;
transition: 1s;
`;
    function updateInnerHTML() {
        modMenus.innerHTML = `
        <div style="font-size: 30px; color: rgb(255, 255, 255);">
            Nova Client Menu:
            <div style = "font-size: 12px; overflow-y: scroll; max-height: 120px; line-height: 2; padding-bottom: 20px;">
                PvP Mode ${HTML.checkBox("pvpMod", "", false)}<br>

                Auto Ruby-Grind ${HTML.checkBox("weaponGrind", "", false)}<br>
                Extra Module ${HTML.select("visStyles", [
            {name: "Revival", value: "rv"},
            {name: "Wasd", value: "wasd"},
        ])}
                ${HTML.checkBox("visS", "", false)}<br>
                <br>
                Auto Place ${HTML.checkBox("autoplace", "", true)}<br>
                Auto Replace ${HTML.checkBox("autoreplace", "", true)}<br>
                Auto Preplacer ${HTML.checkBox("autopreplace", "", true)}<br>
                <br>
                Auto Bull-Spam ${HTML.checkBox("autoBullSpam", "", false)}<br>
                Insta After Bull-Spam ${HTML.checkBox("instaAfterBullSpam", "", true)}<br>
                <br>
                BackUp No Bull ${HTML.checkBox("backupNobull", "", false)}<br>
                One Shot Insta ${HTML.checkBox("oneShot", "", true)}<br>
                Auto Anti-bull ${HTML.checkBox("antiBullType", "", false)}<br>
                Auto Insta ${HTML.checkBox("autoinsta", "", false)}<br>
                <br>
                Legacy Auto-Push ${HTML.checkBox("oneShot", "", true)}<br>
                Safe Auto-Push ${HTML.checkBox("safeAntiSpikeTick", "", true)}<br>
                <br>
                Auto Sync ${HTML.checkBox("sync", "", true)}<br>
                Place Visual ${HTML.checkBox("placeVis", "", true)}<br>
                Predict Spike-Tick ${HTML.checkBox("predicTick", "", true)}<br>
                Insta Spike-Tick ${HTML.checkBox("revTick", "", true)}<br>
                <br>
                Anti Back Potencial Insta ${HTML.checkBox("antiBackInsta", "", true)}<br>
                Anti Spike-Tick ${HTML.checkBox("antispiketick", "", true)}<br>
                Anti Trap ${HTML.checkBox("antiTrap", "", true)}<br>
                Anti Push ${HTML.checkBox("antipush", "", true)}<br>
                <br>
                Status Menu ${HTML.checkBox("bSTmenus", "", true)}<br>
            </div>
        </div>
    `;
        HTML.element = modMenus;

        HTML.selectMenu({
            id: "configsChanger",
            class: "Cselect",
            menu: configs,
        });
    }
    updateInnerHTML();

    function chInButon(buttonId, checkboxId) {
        const $checkbox = $(`#${checkboxId}`);
        const $button = $(`#${buttonId}`);
        const isChecked = $checkbox.prop("checked");
        $checkbox.prop("checked", !isChecked);
        $button.text(isChecked ? "Disabled" : "Enabled");
    }

    $("#modMenus input[type='checkbox']").each(function() {
        const checkboxId = $(this).attr("id");
        if (checkboxId !== "configCheck") {
            $(this).hide();
            const buttonId = `${checkboxId}Button`;
            let isTrue = $(this).prop("checked");
            $(this).after(`<button id="${buttonId}">${isTrue ? "Enabled" : "Disabled"}</button>`);
            $(`#${buttonId}`).on("click", function() {
                chInButon(buttonId, checkboxId);
            });
        }
    });

    let WS = undefined;
    let socketID = undefined;
    let useWasd = false;
    let secPacket = 0;
    let secMax = 110;
    let secTime = 1000;
    let firstSend = {
        sec: false
    };
    let game = {
        tick: 0,
        tickQueue: [],
        tickBase: function(set, tick) {
            if (this.tickQueue[this.tick + tick]) {
                this.tickQueue[this.tick + tick].push(set);
            } else {
                this.tickQueue[this.tick + tick] = [set];
            }
        },
        // chicken v4.6.2: the distance the one tick is taken from
        perfectOTDistance: 225,
        tickRate: (1000 / config.serverUpdateRate),
        tickSpeed: 0,
        lastTick: performance.now()
    };
    let modConsole = [];
    let dontSend = false;
    let fpsTimer = {
        last: 0,
        time: 0,
        ltime: 0
    }
    let lastMoveDir = undefined;
    let lastsp = ["cc", 1, "__proto__"];
    WebSocket.prototype.nsend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(message) {
        if (!WS) {
            WS = this;
            WS.addEventListener("message", function(msg) {
                getMessage(msg);
            });
            WS.addEventListener("close", (event) => {
                if (event.code == 4001) {
                    window.location.reload();
                }
            });
        }
        if (WS == this) {
            dontSend = false;
            // EXTRACT DATA ARRAY:
            let data = new Uint8Array(message);
            let parsed = window.msgpack.decode(data);
            let type = parsed[0];
            data = parsed[1];
            // SEND MESSAGE:
            if (type == "6") {

                if (data[0]) {
                    // ANTI PROFANITY:
                    let profanity = [/*"cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard", */];
                    let tmpString;
                    profanity.forEach((profany) => {
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
                    });
                    // FIX CHAT:
                    data[0] = data[0].slice(0, 30);
                }
            } else if (type == "L") {
                // MAKE SAME CLAN:
                data[0] = data[0] + (String.fromCharCode(0).repeat(7));
                data[0] = data[0].slice(0, 7);
            } else if (type == "M") {
                // APPLY CYAN COLOR:
                data[0].name = data[0].name == "" ? "unknown" : data[0].name;
                data[0].moofoll = true;
                data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
                lastsp = [data[0].name, data[0].moofoll, data[0].skin];
            } else if (type == "D") {
                if ((my.lastDir == data[0]) || [null, undefined].includes(data[0])) {
                    dontSend = true;
                } else {
                    my.lastDir = data[0];
                }
            } else if (type == "F") {
                if (!data[2]) {
                    dontSend = true;
                } else {
                    if (![null, undefined].includes(data[1])) {
                        my.lastDir = data[1];
                    }
                }
            } else if (type == "K") {
                if (!data[1]) {
                    dontSend = true;
                }
            } else if (type == "S") {
                instaC.wait = !instaC.wait;
                dontSend = true;
            } else if (type == "9") {
                if (data[1]) {
                    if (player.moveDir == data[0]) {
                        dontSend = true;
                    }
                    player.moveDir = data[0];
                } else {
                    dontSend = true;
                }
            }
            if (!dontSend) {
                let binary = window.msgpack.encode([type, data]);
                this.nsend(binary);
                // START COUNT:
                if (!firstSend.sec) {
                    firstSend.sec = true;
                    setTimeout(() => {
                        firstSend.sec = false;
                        secPacket = 0;
                    }, secTime);
                }
                secPacket++;
            }
        } else {
            this.nsend(message);
        }
    }
    function packet(type) {
        // EXTRACT DATA ARRAY:
        let data = Array.prototype.slice.call(arguments, 1);
        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.send(binary);
    }
    function origPacket(type) {
        // EXTRACT DATA ARRAY:
        let data = Array.prototype.slice.call(arguments, 1);
        // SEND MESSAGE:
        let binary = window.msgpack.encode([type, data]);
        WS.nsend(binary);
    }
    window.leave = function() {
        origPacket("kys", {
            "frvr is so bad": true,
            "sidney is too good": true,
            "dev are too weak": true,
        });
    };
    //...lol
    let io = {
        send: packet
    };
    function getMessage(message) {
        let data = new Uint8Array(message.data);
        let parsed = window.msgpack.decode(data);
        let type = parsed[0];
        data = parsed[1];
        let events = {
            A: setInitData,
            //B: disconnect,
            C: setupGame,
            D: addPlayer,
            E: removePlayer,
            a: updatePlayers,
            G: updateLeaderboard,
            H: loadGameObject,
            I: loadAI,
            J: animateAI,
            K: gatherAnimation,
            L: wiggleGameObject,
            M: shootTurret,
            N: updatePlayerValue,
            O: updateHealth,
            P: killPlayer,
            Q: killObject,
            R: killObjects,
            S: updateItemCounts,
            T: updateAge,
            U: updateUpgrades,
            V: updateItems,
            X: addProjectile,
            Y: remProjectile,
            3: setPlayerTeam,
            4: setAlliancePlayers,
            5: updateStoreItems,
            6: receiveChat,
            7: updateMinimap,
            8: showText,
            9: pingMap,
            //0: pingSocketResponse,
        };
        if (type == "io-init") {
            socketID = data[0];
        } else {
            if (events[type]) {
                events[type].apply(undefined, data);
            }
        }
    }
    // MATHS:
    var mathPI = Math.PI;
    var mathPI2 = mathPI * 2;
    var mathPI3 = mathPI * 3;
    Math.lerpAngle = function(value1, value2, amount) {
        let difference = Math.abs(value2 - value1);
        if (difference > Math.PI) {
            if (value1 > value2) {
                value2 += Math.PI * 2;
            } else {
                value1 += Math.PI * 2;
            }
        }
        let value = value2 + ((value1 - value2) * amount);
        if (value >= 0 && value <= Math.PI * 2) return value;
        return value % (Math.PI * 2);
    };
    // REOUNDED RECTANGLE:
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
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
    var moofoll = getSavedVal("moofoll");
    function follmoo() {
        if (!moofoll) {
            moofoll = true;
            saveVal("moofoll", 1);
        }
    }

    let ais = [];
    let players = [];
    let alliances = [];
    let alliancePlayers = [];
    let allianceNotifications = [];

    let closeObjects = [];
    let gameObjects = [];
    let projectiles = [];

    let player;
    let playerSID;

    let _;
    let enemy = [];
    let nears = [];
    let near = [];

    let my = {
        reloaded: false,
        waitHit: 0,
        autoAim: false,
        revAim: false,
        ageInsta: true,
        reSync: false,
        bullTick: 0,
        anti0Tick: 0,
        antiSync: false,
        safePrimary: function(_) {
            return [0, 8].includes(_.primaryIndex);
        },
        safeSecondary: function(_) {
            return [10, 11, 14].includes(_.secondaryIndex);
        },
        lastDir: 0,
        autoPush: false,
        pushData: {}
    }

    // FIND OBJECTS BY ID/SID:
    function findID(_, tmp) {
        return _.find((THIS) => THIS.id == tmp);
    }
    function findSID(_, tmp) {
        return _.find((THIS) => THIS.sid == tmp);
    }
    function findPlayerByID(id) {
        return findID(players, id);
    }
    function findPlayerBySID(sid) {
        return findSID(players, sid);
    }
    function findAIBySID(sid) {
        return findSID(ais, sid);
    }
    function findObjectBySid(sid) {
        return findSID(gameObjects, sid);
    }

    let gameName = getEl("gameName");

    let adCard = getEl("adCard");
    adCard.remove();
    let promoImageHolder = getEl("promoImgHolder");
    promoImageHolder.remove();

    let chatButton = getEl("chatButton");
    chatButton.remove();

    let gameCanvas = getEl("gameCanvas");
    let mainContext = gameCanvas.getContext("2d");
    let be = gameCanvas.getContext("2d");
    let mapDisplay = getEl("mapDisplay");
    let mapContext = mapDisplay.getContext("2d");
    mapDisplay.width = 300;
    mapDisplay.height = 300;
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
    let scoreDisplay = document.getElementById("scoreDisplay");
    let foodDisplay = document.getElementById("foodDisplay");
    let woodDisplay = document.getElementById("woodDisplay");
    let stoneDisplay = document.getElementById("stoneDisplay");
    let killCounter = document.getElementById("killCounter");
    let resourceDisplay = document.getElementById("resDisplay");
    let partyButton = document.getElementById("partyButton");
    let joinPartyButton = document.getElementById("joinPartyButton");
    let settingsButton = document.getElementById("settingsButton");
    let settingsButtonTitle = settingsButton.getElementsByTagName("span")[0];
    let storeButton = document.getElementById("storeButton");
    let allianceButton = document.getElementById("allianceButton");
    let leaderboardData = getEl("leaderboardData");
    let itemInfoHolder = getEl("itemInfoHolder");
    let menuCardHolder = getEl("menuCardHolder");
    let mainMenu = getEl("mainMenu");
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
    let buildingAim = undefined;
    let tmpDir;
    let mouseX = 0;
    let mouseY = 0;
    let allianceMenu = getEl("allianceMenu");
    let waterMult = 1;
    let waterPlus = 0;
    let outlineColor = "#525252";
    let darkOutlineColor = "#3d3f42";
    let outlineWidth = 5.5;
    let isNight = false;
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
    function resetMoveDir() {
        keys = {};
        io.send("e");
    }
    let attackState = 0;
    let inGame = false;
    let macro = {};
    let mills = {
        place: 0,
        placeSpawnPads: 0
    };
    let lastDir;
    let lastLeaderboardData = [];
    // ON LOAD:
    let inWindow = true;
    window.onblur = function() {
        inWindow = false;
    };
    window.onfocus = function() {
        inWindow = true;
        if (player && player.alive) {
            resetMoveDir();
        }
    };

    let placeVisible = [];

    /** CLASS CODES */
    class Utils {
        constructor() {
            // MATH UTILS:
            let mathABS = Math.abs,
                mathCOS = Math.cos,
                mathSIN = Math.sin,
                mathPOW = Math.pow,
                mathSQRT = Math.sqrt,
                mathATAN2 = Math.atan2,
                mathPI = Math.PI;
            let _this = this;
            // GLOBAL UTILS:
            this.round = function(n, v) {
                return Math.round(n * v) / v;
            };
            this.toRad = function(angle) {
                return angle * (mathPI / 180);
            };
            this.toAng = function(radian) {
                return radian / (mathPI / 180);
            };
            this.randInt = function(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };
            this.randFloat = function(min, max) {
                return Math.random() * (max - min + 1) + min;
            };
            this.lerp = function(value1, value2, amount) {
                return value1 + (value2 - value1) * amount;
            };
            this.decel = function(val, cel) {
                if (val > 0) val = Math.max(0, val - cel);
                else if (val < 0) val = Math.min(0, val + cel);
                return val;
            };
            this.getDistance = function(x1, y1, x2, y2) {
                return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
            };
            this.getDist = function(tmp1, tmp2, type1, type2) {
                let tmpXY1 = {
                    x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                    y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                };
                let tmpXY2 = {
                    x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                    y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                };
                return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
            };
            this.getDirection = function(x1, y1, x2, y2) {
                return mathATAN2(y1 - y2, x1 - x2);
            };
            this.getDirect = function(tmp1, tmp2, type1, type2) {
                let tmpXY1 = {
                    x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                    y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
                };
                let tmpXY2 = {
                    x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                    y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
                };
                return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
            };

            this.getAngleDist = function(a, b) {
                let p = mathABS(b - a) % (mathPI * 2);
                return (p > mathPI ? (mathPI * 2) - p : p);
            };
            this.isNumber = function(n) {
                return (typeof n == "number" && !isNaN(n) && isFinite(n));
            };
            this.isString = function(s) {
                return (s && typeof s == "string");
            };
            this.kFormat = function(num) {
                return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
            };
            this.sFormat = function(num) {
                let fixs = [
                    { num: 1e3, string: "k" },
                    { num: 1e6, string: "m" },
                    { num: 1e9, string: "b" },
                    { num: 1e12, string: "q" }
                ].reverse();
                let sp = fixs.find(v => num >= v.num);
                if (!sp) return num;
                return (num / sp.num).toFixed(1) + sp.string;
            };
            this.capitalizeFirst = function(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            };
            this.fixTo = function(n, v) {
                return parseFloat(n.toFixed(v));
            };
            this.sortByPoints = function(a, b) {
                return parseFloat(b.points) - parseFloat(a.points);
            };
            this.lineInRect = function(recX, recY, recX2, recY2, x1, y1, x2, y2) {
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
            this.containsPoint = function(element, x, y) {
                let bounds = element.getBoundingClientRect();
                let left = bounds.left + window.scrollX;
                let top = bounds.top + window.scrollY;
                let width = bounds.width;
                let height = bounds.height;
                let insideHorizontal = x > left && x < left + width;
                let insideVertical = y > top && y < top + height;
                return insideHorizontal && insideVertical;
            };
            this.mousifyTouchEvent = function(event) {
                let touch = event.changedTouches[0];
                event.screenX = touch.screenX;
                event.screenY = touch.screenY;
                event.clientX = touch.clientX;
                event.clientY = touch.clientY;
                event.pageX = touch.pageX;
                event.pageY = touch.pageY;
            };
            this.hookTouchEvents = function(element, skipPrevent) {
                let preventDefault = !skipPrevent;
                let isHovering = false;
                // let passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
                let passive = false;
                element.addEventListener("touchstart", this.checkTrusted(touchStart), passive);
                element.addEventListener("touchmove", this.checkTrusted(touchMove), passive);
                element.addEventListener("touchend", this.checkTrusted(touchEnd), passive);
                element.addEventListener("touchcancel", this.checkTrusted(touchEnd), passive);
                element.addEventListener("touchleave", this.checkTrusted(touchEnd), passive);
                function touchStart(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (element.onmouseover) element.onmouseover(e);
                    isHovering = true;
                }
                function touchMove(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (_this.containsPoint(element, e.pageX, e.pageY)) {
                        if (!isHovering) {
                            if (element.onmouseover) element.onmouseover(e);
                            isHovering = true;
                        }
                    } else {
                        if (isHovering) {
                            if (element.onmouseout) element.onmouseout(e);
                            isHovering = false;
                        }
                    }
                }
                function touchEnd(e) {
                    _this.mousifyTouchEvent(e);
                    window.setUsingTouch(true);
                    if (preventDefault) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (isHovering) {
                        if (element.onclick) element.onclick(e);
                        if (element.onmouseout) element.onmouseout(e);
                        isHovering = false;
                    }
                }
            };
            this.removeAllChildren = function(element) {
                while (element.hasChildNodes()) {
                    element.removeChild(element.lastChild);
                }
            };
            this.generateElement = function(config) {
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
                        case "hookTouch":
                        case "parent":
                        case "children":
                            continue;
                        default:
                            break;
                    }
                    element[key] = config[key];
                }
                if (element.onclick) element.onclick = this.checkTrusted(element.onclick);
                if (element.onmouseover) element.onmouseover = this.checkTrusted(element.onmouseover);
                if (element.onmouseout) element.onmouseout = this.checkTrusted(element.onmouseout);
                if (config.style) {
                    element.style.cssText = config.style;
                }
                if (config.hookTouch) {
                    this.hookTouchEvents(element);
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
            this.checkTrusted = function(callback) {
                return function(ev) {
                    if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
                        callback(ev);
                    } else {
                        //console.error("Event is not trusted.", ev);
                    }
                };
            };
            this.randomString = function(length) {
                let text = "";
                let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for (let i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            };
            this.countInArray = function(array, val) {
                let count = 0;
                for (let i = 0; i < array.length; i++) {
                    if (array[i] === val) count++;
                }
                return count;
            };
            this.hexToRgb = function(hex) {
                return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
            };
            this.getRgb = function(r, g, b) {
                return [r / 255, g / 255, b / 255].join(", ");
            };
        }
    };
    class Animtext {
        // ANIMATED TEXT:
        constructor() {
            // INIT:
            this.init = function(x, y, scale, speed, life, text, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.scale = scale;
                this.startScale = this.scale;
                this.maxScale = scale * 1.5;
                this.scaleSpeed = 0.7;
                this.speed = speed;
                this.life = life;
                this.text = text;
                this.acc = 1;
                this.alpha = 0;
                this.maxLife = life;
                this.ranX = UTILS.randFloat(-1, 1);
            };
            // UPDATE:
            // UPDATE:
            this.update = function(delta) {
                if (this.life) {
                    this.life -= delta;
                    this.y -= this.speed * delta;
                    this.scale += this.scaleSpeed * delta;
                    if (this.scale >= this.maxScale) {
                        this.scale = this.maxScale;
                        this.scaleSpeed *= -1;
                    } else if (this.scale <= this.startScale) {
                        this.scale = this.startScale;
                        this.scaleSpeed = 0;
                    }
                    if (this.life <= 0) {
                        this.life = 0;
                    }
                }
            };

            // RENDER:
            this.render = function(ctxt, xOff, yOff) {
                ctxt.lineWidth = 10;
                ctxt.fillStyle = this.color;
                ctxt.font = this.scale + "px Hammersmith One";
                ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
                ctxt.globalAlpha = 1;
            };
        }
    };
    class Textmanager {
        // TEXT MANAGER:
        constructor() {
            this.texts = [];
            this.stack = [];
            // UPDATE:
            this.update = function(delta, ctxt, xOff, yOff) {
                ctxt.textBaseline = "middle";
                ctxt.strokeStyle = darkOutlineColor;
                ctxt.textAlign = "center";
                for (let i = 0; i < this.texts.length; ++i) {
                    if (this.texts[i].life) {
                        this.texts[i].update(delta);
                        this.texts[i].render(ctxt, xOff, yOff);
                    }
                }
            };
            // SHOW TEXT:
            this.showText = function(x, y, scale, speed, life, text, color) {
                let tmpText;
                for (let i = 0; i < this.texts.length; ++i) {
                    if (!this.texts[i].life) {
                        tmpText = this.texts[i];
                        break;
                    }
                }
                if (!tmpText) {
                    tmpText = new Animtext();
                    this.texts.push(tmpText);
                }
                tmpText.init(x, y, scale, speed, life, text, color);
            };
        }
    }
    class GameObject {
        constructor(sid) {
            this.sid = sid;
            // INIT:
            this.init = function(x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.sentTo = {};
                this.gridLocations = [];
                this.active = true;
                this.alive = true;
                this.doUpdate = data.doUpdate;
                this.x = x;
                this.y = y;
                this.dir = dir;
                this.lastDir = dir;
                this.xWiggle = 0;
                this.yWiggle = 0;
                this.visScale = scale;
                this.scale = scale;
                this.type = type;
                this.id = data.id;
                this.owner = owner;
                this.name = data.name;
                this.isItem = (this.id != undefined);
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
                this.onNear = 0;
                this.breakObj = false;
                this.alpha = data.alpha || 1;
                this.maxAlpha = data.alpha || 1;
                this.damaged = 0;
            };
            // GET HIT:
            this.changeHealth = function(amount, doer) {
                this.health += amount;
                return (this.health <= 0);
            };
            // GET SCALE:
            this.getScale = function(sM, ig) {
                sM = sM || 1;
                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ?
                                     1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
            };
            // VISIBLE TO PLAYER:
            this.visibleToPlayer = function(player) {
                return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                                                                (this.owner.team && player.team == this.owner.team)));
            };
            // UPDATE:
            this.update = function(delta) {
                if (this.active) {
                    if (this.xWiggle) {
                        this.xWiggle *= Math.pow(0.99, delta);
                    }
                    if (this.yWiggle) {
                        this.yWiggle *= Math.pow(0.99, delta);
                    }
                    if (this.turnSpeed && this.dmg) {
                        this.dir += this.turnSpeed * delta;
                    }
                } else {
                    if (this.alive) {
                        this.alpha -= delta / (200 / this.maxAlpha);
                        this.visScale += delta / (this.scale / 2.5);
                        if (this.alpha <= 0) {
                            this.alpha = 0;
                            this.alive = false;
                        }
                    }
                }
            };
            // CHECK TEAM:
            this.isTeamObject = function(_) {
                return this.owner == null ? true : (this.owner && _.sid == this.owner.sid || _.findAllianceBySid(this.owner.sid));
            };
        }
    }
    class Items {
        constructor() {
            // ITEM GROUPS:
            this.groups = [{
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
                sandboxLimit: 299,
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
                sandboxLimit: 299,
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
                sandboxLimit: 299,
                layer: -1
            }];
            // PROJECTILES:
            this.projectiles = [{
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
            this.weapons = [{
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
            this.list = [{
                group: this.groups[0],
                name: "apple",
                desc: "restores 20 health when consumed",
                req: ["food", 10],
                consume: function(doer) {
                    return doer.changeHealth(20, doer);
                },
                scale: 22,
                holdOffset: 15,
                healing: 20,
                itemID: 0,
                itemAID: 16,
            }, {
                age: 3,
                group: this.groups[0],
                name: "cookie",
                desc: "restores 40 health when consumed",
                req: ["food", 15],
                consume: function(doer) {
                    return doer.changeHealth(40, doer);
                },
                scale: 27,
                holdOffset: 15,
                healing: 40,
                itemID: 1,
                itemAID: 17,
            }, {
                age: 7,
                group: this.groups[0],
                name: "cheese",
                desc: "restores 30 health and another 50 over 5 seconds",
                req: ["food", 25],
                consume: function(doer) {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
            }, {
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
                itemAID: 38
            }];
            // CHECK ITEM ID:
            this.checkItem = {
                index: function(id, myItems) {
                    return [0, 1, 2].includes(id) ? 0 :
                    [3, 4, 5].includes(id) ? 1 :
                    [6, 7, 8, 9].includes(id) ? 2 :
                    [10, 11, 12].includes(id) ? 3 :
                    [13, 14].includes(id) ? 5 :
                    [15, 16].includes(id) ? 4 :
                    [17, 18, 19, 21, 22].includes(id) ?
                        [13, 14].includes(myItems) ? 6 :
                    5 :
                    id == 20 ?
                        [13, 14].includes(myItems) ? 7 :
                    6 :
                    undefined;
                }
            }
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
        constructor(GameObject, gameObjects, UTILS, config, players, server) {
            let mathFloor = Math.floor,
                mathABS = Math.abs,
                mathCOS = Math.cos,
                mathSIN = Math.sin,
                mathPOW = Math.pow,
                mathSQRT = Math.sqrt;
            this.ignoreAdd = false;
            this.hitObj = [];

            // DISABLE OBJ:
            this.disableObj = function(obj) {
                obj.active = false;
            };

            // ADD NEW:
            let _;
            this.add = function(sid, x, y, dir, s, type, data, setSID, owner) {
                _ = findObjectBySid(sid);
                if (!_) {
                    _ = gameObjects.find((tmp) => !tmp.active);
                    if (!_) {
                        _ = new GameObject(sid);
                        gameObjects.push(_);
                    }
                }
                if (setSID) {
                    _.sid = sid;
                }
                _.init(x, y, dir, s, type, data, owner);
            };

            // DISABLE BY SID:
            this.disableBySid = function(sid) {
                let find = findObjectBySid(sid);
                if (find) {
                    this.disableObj(find);
                }
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function(sid, server) {
                gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
            };

            // CHECK IF PLACABLE:
            this.checkItemLocation = function(x, y, s, sM, indx, ignoreWater, placer) {
                let cantPlace = gameObjects.find((tmp) => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) return false;
                if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
                return true;
            };
        }
    }
    class Projectile {
        constructor(players, ais, objectManager, items, config, UTILS, server) {
            // INIT:
            this.init = function(indx, x, y, dir, spd, dmg, rng, scl, owner) {
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
            this.update = function(delta) {
                if (this.active) {
                    let tmpSpeed = this.speed * delta;
                    if (!this.skipMov) {
                        this.x += tmpSpeed * Math.cos(this.dir);
                        this.y += tmpSpeed * Math.sin(this.dir);
                        this.range -= tmpSpeed;
                        if (this.range <= 0) {
                            this.x += this.range * Math.cos(this.dir);
                            this.y += this.range * Math.sin(this.dir);
                            tmpSpeed = 1;
                            this.range = 0;
                            this.active = false;
                        }
                    } else {
                        this.skipMov = false;
                    }
                }
            };
            this.tickUpdate = function(delta) {
                if (this.tickActive) {
                    let tmpSpeed = this.speed * delta;
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
    };
    class Store {
        constructor() {
            // STORE HATS:
            this.hats = [{
                id: 45,
                name: "Shame!",
                dontSell: true,
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
                dmgMultO: 1.2,
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
            this.accessories = [{
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
        }
    };
    class ProjectileManager {
        constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
            this.addProjectile = function(x, y, dir, range, speed, indx, owner, ignoreObj, layer, inWindow) {
                let tmpData = items.projectiles[indx];
                let tmpProj;
                for (let i = 0; i < projectiles.length; ++i) {
                    if (!projectiles[i].active) {
                        tmpProj = projectiles[i];
                        break;
                    }
                }
                if (!tmpProj) {
                    tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS, server);
                    tmpProj.sid = projectiles.length;
                    projectiles.push(tmpProj);
                }
                tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
                tmpProj.ignoreObj = ignoreObj;
                tmpProj.layer = layer || tmpData.layer;
                tmpProj.inWindow = inWindow;
                tmpProj.src = tmpData.src;
                return tmpProj;
            };
        }
    };
    class AiManager {
        // AI MANAGER:
        constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {
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
                speed: 0.0,
                turnSpeed: 0.0,
                scale: 70,
                spriteMlt: 1.0
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
            }, {
                id: 9,
                name: "MOOFIE",
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
                name: "Wolf",
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
                name: "Bully",
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
            }];
            // SPAWN AI:
            this.spawn = function(x, y, dir, index) {
                let _ = ais.find((tmp) => !tmp.active);
                if (!_) {
                    _ = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                    ais.push(_);
                }
                _.init(x, y, dir, index, this.aiTypes[index]);
                return _;
            };
        }
    };
    class AI {
        constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
            this.sid = sid;
            this.isAI = true;
            this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);
            // INIT:
            this.init = function(x, y, dir, index, data) {
                this.x = x;
                this.y = y;
                this.startX = data.fixedSpawn ? x : null;
                this.startY = data.fixedSpawn ? y : null;
                this.xVel = 0;
                this.yVel = 0;
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
            this.animate = function(delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };
            // ANIMATION:
            this.startAnim = function() {
                this.animTime = this.animSpeed = 600;
                this.targetAngle = Math.PI * 0.8;
                tmpRatio = 0;
                animIndex = 0;
            };
        };
    };
    class Player {
        constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
            this.id = id;
            this.sid = sid;
            this.tmpScore = 0;
            this.team = null;
            this.latestSkin = 0;
            this.oldSkinIndex = 0;
            this.skinIndex = 0;
            this.latestTail = 0;
            this.oldTailIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.lastHit = 0;
            this.tails = {};
            for (let i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0) this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0) this.skins[hats[i].id] = 1;
            }
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
            this.aim2 = 0;
            this.maxSpeed = 1;
            this.backupNobull = true;
            // SPAWN:
            this.spawn = function(moofoll) {
                this.attacked = false;
                this.death = false;
                this.spinDir = 0;
                this.sync = false;
                this.antiBull = 0;
                this.bullTimer = 0;
                this.poisonTimer = 0;
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
                this.gatherIndex = 0;
                this.shooting = {};
                this.shootIndex = 9;
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.weaponCode = 0;
                this.weaponVariant = 0;
                this.primaryIndex = undefined;
                this.secondaryIndex = undefined;
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
                this.oldXY = {
                    x: 0,
                    y: 0
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
                    53: 0,
                };
                this.bowThreat = {
                    9: 0,
                    12: 0,
                    13: 0,
                    15: 0,
                };
                this.damageThreat = 0;
                this.inTrap = false;
                this.canEmpAnti = false;
                this.empAnti = false;
                this.soldierAnti = false;
                this.poisonTick = 0;
                this.bullTick = 0;
                this.setPoisonTick = false;
                this.setBullTick = false;
                this.antiTimer = 2;
            };
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
            this.visualReloads = {
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
                53: 0,
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
            // ADD ITEM:
            this.getItemType = function(id) {
                let findindx = this.items.findIndex((ids) => ids == id);
                if (findindx != -1) {
                    return findindx;
                } else {
                    return items.checkItem.index(id, this.items);
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

            // UPDATE POISON TICK:
            this.updateTimer = function() {
                this.bullTimer -= 1;
                if (this.bullTimer <= 0) {
                    this.setBullTick = false;
                    this.bullTick = game.tick - 1;
                    this.bullTimer = config.serverUpdateRate;
                }

                this.poisonTimer -= 1;
                if (this.poisonTimer <= 0) {
                    this.setPoisonTick = false;
                    this.poisonTick = game.tick - 1;
                    this.poisonTimer = config.serverUpdateRate;
                    autoBull.plague = near.dist2 <= 230 ? true : false;
                } else {
                    autoBull.plague = false;
                }
            };

            this.update = function(delta) {
                if (this.active) {
                    // MOVE:
                    let gear = {
                        skin: findID(hats, this.skinIndex),
                        tail: findID(accessories, this.tailIndex)
                    }
                    let spdMult = ((this.buildIndex >= 0) ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) * (gear.skin ? (gear.skin.spdMult || 1) : 1) * (gear.tail ? (gear.tail.spdMult || 1) : 1) * (this.y <= config.snowBiomeTop ? ((gear.skin && gear.skin.coldM) ? 1 : config.snowSpeed) : 1) * this.slowMult;
                    this.maxSpeed = spdMult;
                }
            };
            let tmpRatio = 0;
            let animIndex = 0;
            this.animate = function(delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };
            // GATHER ANIMATION:
            this.startAnim = function(didHit, index) {
                this.animTime = this.animSpeed = items.weapons[index].speed;
                this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
                tmpRatio = 0;
                animIndex = 0;
            };
            // CAN SEE:
            this.canSee = function(other) {
                if (!other) return false;
                let dx = Math.abs(other.x - this.x) - other.scale;
                let dy = Math.abs(other.y - this.y) - other.scale;
                return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
            };
            // SHAME SYSTEM:
            this.judgeShame = function() {
                if (this.oldHealth < this.health) {
                    if (this.hitTime) {
                        let timeSinceHit = Date.now() - this.hitTime;
                        this.lastHit = game.tick;
                        this.hitTime = 0;
                        if (timeSinceHit < 120) {
                            this.shameCount++;
                        } else {
                            this.shameCount = Math.max(0, this.shameCount - 2);
                        }
                    }
                } else if (this.oldHealth > this.health) {
                    this.hitTime = Date.now();
                }
            };
            this.addShameTimer = function() {
                this.shameCount = 0;
                this.shameTimer = 30;
                let interval = setInterval(() => {
                    this.shameTimer--;
                    if (this.shameTimer <= 0) {
                        clearInterval(interval);
                    }
                }, 1000);
            };
            // CHECK TEAM:
            this.isTeam = function(_) {
                return (this == _ || (this.team && this.team == _.team));
            };
            // FOR THE PLAYER:
            this.findAllianceBySid = function(sid) {
                return this.team ? alliancePlayers.find((THIS) => THIS === sid) : null;
            };
            this.checkCanInsta = function(nobull) {
                let totally = 0;
                if (this.alive && inGame) {
                    let primary = {
                        weapon: this.weapons[0],
                        variant: this.primaryVariant,
                        dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg,
                    };
                    let secondary = {
                        weapon: this.weapons[1],
                        variant: this.secondaryVariant,
                        dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg,
                    };
                    let bull = this.skins[7] && !nobull ? 1.5 : 1;
                    let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1;
                    if (primary.weapon != undefined && this.reloads[primary.weapon] == 0) {
                        totally += primary.dmg * pV * bull;
                    }
                    if (secondary.weapon != undefined && this.reloads[secondary.weapon] == 0) {
                        totally += secondary.dmg;
                    }
                    if (this.skins[53] && this.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) && near.skinIndex != 22) {
                        totally += 25;
                    }
                    totally *= near.skinIndex == 6 ? 0.75 : 1;
                    return totally;
                }
                return 0;
            };
            // UPDATE WEAPON RELOAD:
            this.manageReload = function() {
                if (this.shooting[53]) {
                    this.shooting[53] = 0;
                    this.reloads[53] = (2500 - game.tickRate);
                } else {
                    if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
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
                        if (this.reloads[this.weaponIndex] > 0) {
                            this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);

                            if (this == player && getEl("weaponGrind").checked) {
                                for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                    checkPlace(player.getItemType(22), i);
                                }
                            }

                            if (this.reloads[this.primaryIndex] == 0 && this.reloads[this.weaponIndex] == 0) {
                                this.antiBull++;
                                game.tickBase(() => {
                                    this.antiBull = 0;
                                }, 1);
                            }
                        }
                    }
                }
            };
            // FOR ANTI INSTA:
            this.addDamageThreat = function(_) {
                let primary = {
                    weapon: this.primaryIndex,
                    variant: this.primaryVariant
                };
                primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                let secondary = {
                    weapon: this.secondaryIndex,
                    variant: this.secondaryVariant
                };
                secondary.dmg = secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
                let bull = 1.5;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1.18;
                if (primary.weapon == undefined ? true : this.reloads[primary.weapon] == 0) {
                    this.damageThreat += primary.dmg * pV * bull;
                }
                if (secondary.weapon == undefined ? true : this.reloads[secondary.weapon] == 0) {
                    this.damageThreat += secondary.dmg * sV;
                }
                if (this.reloads[53] <= game.tickRate) {
                    this.damageThreat += 25;
                }
                this.damageThreat *= _.skinIndex == 6 ? 0.75 : 1;
                if (!this.isTeam(_)) {
                    if (this.dist2 <= 300) {
                        _.damageThreat += this.damageThreat;
                    }
                }
            };
        }
    };
    // SOME CODES:
    function sendUpgrade(index) {
        player.reloads[index] = 0;
        packet("H", index);
    }
    function storeEquip(id, index) {
        packet("c", 0, id, index);
    }
    function storeBuy(id, index) {
        packet("c", 1, id, index);
    }
    function buyEquip(id, index) {
        let nID = player.skins[6] ? 6 : 0;
        if (player.alive && inGame) {
            if (index == 0) {
                if (player.skins[id]) {
                    if (player.latestSkin != id) {
                        packet("c", 0, id, 0);
                    }
                } else {
                    if (config.isSandbox) {
                        let find = findID(hats, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 0);
                                packet("c", 0, id, 0);
                            } else {
                                if (player.latestSkin != nID) {
                                    packet("c", 0, nID, 0);
                                }
                            }
                        } else {
                            if (player.latestSkin != nID) {
                                packet("c", 0, nID, 0);
                            }
                        }
                    } else {
                        if (player.latestSkin != nID) {
                            packet("c", 0, nID, 0);
                        }
                    }
                }
            } else if (index == 1) {
                if (getEl("visStyles").value == "wasd" && (id != 11 && id != 0)) {
                    if (player.latestTail != 0) {
                        packet("c", 0, 0, 1);
                    }
                    return;
                }

                if (player.tails[id]) {
                    if (player.latestTail != id) {
                        packet("c", 0, id, 1);
                    }
                } else {
                    if (config.isSandbox) {
                        let find = findID(accessories, id);
                        if (find) {
                            if (player.points >= find.price) {
                                packet("c", 1, id, 1);
                                packet("c", 0, id, 1);
                            } else {
                                if (player.latestTail != 0) {
                                    packet("c", 0, 0, 1);
                                }
                            }
                        } else {
                            if (player.latestTail != 0) {
                                packet("c", 0, 0, 1);
                            }
                        }
                    } else {
                        if (player.latestTail != 0) {
                            packet("c", 0, 0, 1);
                        }
                    }
                }
            }
        }
    }
    function selectToBuild(index, wpn) {
        packet("z", index, wpn);
    }
    function selectWeapon(index, isPlace) {
        if (!isPlace) {
            player.weaponCode = index;
        }
        packet("z", index, 1);
    }
    function sendAutoGather() {
        packet("K", 1, 1);
    }
    function sendAtck(id, angle) {
        packet("F", id, angle, 1);
    }

    // PLACE LIMIT:
    function getLimited(item) {
        let limit = config.isSandbox ? (item.group.sandboxLimit || Math.max(item.group.limit * 3, 99)) : item.group.limit;
        return player.alive && inGame && player.itemCounts[item.group.id] == undefined ? true : player.itemCounts[item.group.id] < limit;
    }

    // PLACER:
    function place(id, rad, rmd) {
        try {
            if (id == undefined) return;

            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);

            if (id === 0 || getLimited(item)) {
                selectToBuild(player.items[id]);
                sendAtck(1, rad);
                selectWeapon(player.weaponCode, 1);
                if (rmd && getEl("placeVis").checked) {
                    placeVisible.push({
                        x: tmpX,
                        y: tmpY,
                        name: item.name,
                        scale: item.scale,
                        dir: rad
                    });
                    game.tickBase(() => {
                        placeVisible.shift();
                    }, 1)
                }
            }
        } catch (e) { }
    }

    function checkPlace(id, rad) {
        try {
            if (secPacket.count >= 80) return;
            //if (id == undefined) return;
            let item = items.list[player.items[id]];
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            let tmpX = player.x2 + tmpS * Math.cos(rad);
            let tmpY = player.y2 + tmpS * Math.sin(rad);
            if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, player)) {
                place(id, rad, 1);
            }
        } catch (e) {}
    }

    // HEALING:
    function soldierMult() {
        return player.latestSkin == 6 ? 0.75 : 1;
    }
    function getAttacker(damaged) {
        let attackers = enemy.filter(tmp => {
            //let damages = new Damages(items);
            //let dmg = damages.weapons[tmp.weaponIndex];
            //let by = tmp.weaponIndex < 9 ? [dmg[0], dmg[1], dmg[2], dmg[3]] : [dmg[0], dmg[1]];
            let rule = {
                //one: tmp.dist2 <= 300,
                //two: by.includes(damaged),
                three: tmp.attacked
            }
            return /*rule.one && rule.two && */rule.three;
        });
        return attackers;
    }

    function healthBased() {
        if (player.health == 100) return 0;
        if (player.skinIndex != 45 && player.skinIndex != 56) {
            return Math.ceil((100 - player.health) / items.list[player.items[0]].healing);
        }
        return 0;
    }

    function antiSyncHealing(timearg) {
        my.antiSync = true;
        sendChat("Anti Bozo Feature.");
        let healAnti = setInterval(() => {
            if (player.shameCount < 5) {
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

    function healer() {
        for (let i = 0; i < healthBased(); i++) {
            place(0, getAttackDir());
        }
    }

    function biomeGear(mover, returns) {
        if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2) {
            if (returns) return 31;
            buyEquip(31, 0);
        } else {
            let hat = near.dist2 >= 680 && near.dist2 < 720 ? 22 : 6;
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            } else {
                if (returns) return mover && player.moveDir == undefined ? hat : 6;
                buyEquip(mover && player.moveDir == undefined ? hat : 6, 0);
            }
        }

        if (returns) return 0;
    }

    function isRiverArea(y) {
        return y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2;
    }

    function isCollision(x, y, obj) {
        return UTILS.getDistance(x, y, obj.x, obj.y) < obj.scale + (obj.blocker ? obj.blocker : obj.getScale(0.6, obj.isItem));
    }

    function getEnemyVelocity(near) {
        return Math.sqrt(near.xVel * near.xVel + near.yVel * near.yVel);
    }

    function getEnemyDirection(near) {
        return Math.atan2(near.yVel, near.xVel);
    }

    let advHeal = [];
    class Traps {
        constructor(UTILS, items) {
            this.dist = 0;
            this.aim = 0;
            this.inTrap = false;
            this.breakshit = false;
            this.replaced = false;
            this.antiTrapped = false;
            this.info = {};
        }

        notFast() {
            return player.weapons[1] == 10 && ((this.info.health > items.weapons[player.weapons[0]].dmg) || player.weapons[0] == 5);
        }

        testCanPlace(id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, replacer, yaboi) {
            // why many
            try {
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0
                };
                let _ects = [];
                gameObjects.forEach((p) => {
                    _ects.push({
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
                });
                for (let i = first; i < repeat; i += plus) {
                    counts.attempts++;
                    let relAim = radian + i;
                    let tmpX = player.x2 + tmpS * Math.cos(relAim);
                    let tmpY = player.y2 + tmpS * Math.sin(relAim);
                    let cantPlace = _ects.find((tmp) => tmp.active && UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                    if (cantPlace) continue;
                    if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                    if ((!replacer && yaboi)) {//bullspaming
                        if (yaboi.inTrap) {
                            if (UTILS.getAngleDist(near.aim2 + Math.PI, relAim + Math.PI) <= Math.PI) {
                                place(4, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        } else {
                            if (UTILS.getAngleDist(near.aim2, relAim) <= config.gatherAngle / 1.5) {
                                place(2, relAim, 1);
                            } else {
                                player.items[4] == 15 && place(4, relAim, 1);
                            }
                        }
                    } else {
                        place(id, relAim, 1);
                    }
                    _ects.push({
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
                    if (UTILS.getAngleDist(near.aim2, relAim) <= 1) {
                        counts.placed++;
                    }
                }
                if (counts.placed > 0 && replacer && item.dmg) {
                    if (near.dist2 <= items.weapons[player.weapons[0]].range + (player.scale * 1.8) && getEl("spiketick").checked) {
                        instaC.canSpikeTick = true;
                    }
                }
            } catch (err) {
            }
        }

        checkSpikeTick() {
            try {
                if (![3, 4, 5].includes(near.primaryIndex)) return false;

                const isSafeMode = getEl("safeAntiSpikeTick").checked || my.autoPush;
                if (isSafeMode || near.primaryIndex === undefined || near.reloads[near.primaryIndex] > game.tickRate) return false;

                if (near.dist2 > items.weapons[near.primaryIndex || 5].range + near.scale * 1.8) return false;

                const item = items.list[9];
                const tmpS = near.scale + item.scale + (item.placeOffset || 0);
                let danger = 0;
                const counts = {
                    attempts: 0,
                    block: "unblocked"
                };

                for (let i = -1; i <= 1; i += 0.1) {
                    counts.attempts++;
                    const relAim = UTILS.getDirect(player, near, 2, 2) + i;
                    const tmpX = near.x2 + tmpS * Math.cos(relAim);
                    const tmpY = near.y2 + tmpS * Math.sin(relAim);

                    if (isRiverArea(tmpY) || gameObjects.some((tmp) => tmp.active && isCollision(tmpX, tmpY, tmp))) continue;

                    danger++;
                    counts.block = "blocked";
                    break;
                }

                return danger ? (my.anti0Tick = 1, true) : false;
            } catch (err) {
                return null;
            }
        }

        protect(aim) {
            if (!player.items[4]) return;

            this.testCanPlace(4, -(Math.PI / 1.5), (Math.PI / 1.5), (Math.PI / (32 - 6)), aim + Math.PI);
            this.antiTrapped = true;
        }

        autoPlace() {
            const MIN_TRAP_DISTANCE = 270;
            let randomDir = Math.random() * Math.PI * 2;
            let nearObj = [];
            const SPIKE_RADIUS = 45;
            const SPIKE_ANGLE_INCREMENT = Math.PI / 24;
            if (
                enemy.length &&
                game.tick % (Math.max(1, parseInt(2)) || 1) !== 0
            ) return;

            let near2 = {
                inTrap: false,
            };

            let nearTrap = gameObjects.find(e => e.trap && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= (near.scale + e.getScale() + 5));
            near2.inTrap = !!nearTrap;
            if (nearObj) {
                if (near.dist2 <= 600) {
                    for (let i = 0; i < 2; i += 1) {
                        checkPlace(4, randomDir + i);
                    }
                    for (let i = 0; i < 2; i += Math.PI / 0.5) {
                        checkPlace(4, randomDir + i);
                    }
                }
            }
            if (!near2.inTrap) {
                let objAim = UTILS.getDirect(near, player, 0, 2);
                let trapPlacementRadius = 70;

                const enemyVelocity = getEnemyVelocity(near);
                const enemyDirection = getEnemyDirection(near);

                if (near.dist2 <= MIN_TRAP_DISTANCE) {
                    player.items[4] == 15 && this.testCanPlace(
                        4,
                        UTILS.toRad(-90),
                        UTILS.toRad(90),
                        Math.PI / 24,
                        objAim,
                        trapPlacementRadius,
                        { inTrap: false, enemyVelocity, enemyDirection }
                    );
                }
            } else if (near2.inTrap) {
                let objAim = UTILS.getDirect(nearTrap, player, 0, 2);
                let trapPlacementRadius = 70;

                const enemyVelocity = getEnemyVelocity(nearTrap);
                const enemyDirection = getEnemyDirection(nearTrap);

                if (near.dist2 <= MIN_TRAP_DISTANCE) {
                    let initialAngle = Math.random() * Math.PI * 2;

                    this.testCanPlace(
                        2,
                        initialAngle,
                        initialAngle + Math.PI * 2,
                        SPIKE_ANGLE_INCREMENT,
                        objAim,
                        SPIKE_RADIUS,
                        { inTrap: true, enemyVelocity, enemyDirection }
                    );
                }
            }
        }

        replacer(findObj) {
            if (!findObj || !inGame || this.antiTrapped) return;

            let objAim = UTILS.getDirect(findObj, player, 0, 2) || near.aim2;
            let objDst = UTILS.getDist(findObj, player, 0, 2);

            game.tickBase(() => {
                let ticked = !this.checkSpikeTick() && near.dist2 <= items.weapons[near.primaryIndex || 5].range + (near.scale * 1.8);

                let startAngle = Math.random() * Math.PI * 1.5;
                let step = Math.PI / (32 + Math.random() * 12);

                let selectNewId = ticked ? 2 : 4;

                this.testCanPlace(selectNewId, -startAngle, Math.PI * 1.5, step, objAim, 1);
                this.testCanPlace(selectNewId, 0, (Math.PI * 2), (Math.PI / 24), objAim , 1);

                this.replaced = true;
            }, 1);
        }
    }
    function dAng(ang1, ang2) {
        let d = Math.abs(ang1 - ang2);
        d = d % (Math.PI * 2);
        if (d > Math.PI * 2) {
            d = Math.PI * 2 - d;
        }

        return d;
    }
    function fulldecel(e, t, coords, e2, t2) {
        if (isNaN(e) || isNaN(t)) {
            return;
        }
        try {
            e2 = e * decayRate;
            t2 = t * decayRate;
            if (e != e2) {
                e = e2;
                coords.x += e;
            }
            if (t != t2) {
                t = t2;
                coords.y += t;
            }
            if (e == e2 && t == t2) {
                return {
                    x: coords.x,
                    y: coords.y,
                    type: "full decel"
                };
            } else {

                return fulldecel(e, t, coords);
            }
        } catch (e) {}
    }
    function calcAccel(_, ang, set, time) {
        if (!time || typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt
        } = Math;
        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        const decel = pow(0.993, time);
        const move = set.maxSpeed * 0.0016 * time * time;
        const xVel = _.xVel * decel + cosX * move;
        const yVel = _.yVel * decel + sinY * move;
        return {
            xVel: xVel,
            yVel: yVel,
            x2: (_.x2 ?? _.x) + xVel,
            y2: (_.y2 ?? _.y) + yVel
        };
    }
    function calcOTVel() {
        const _ = player;
        let time = game.tickRate;
        const newVel = calcAccel(_, near.aim3, {
            maxSpeed: 0.77
        }, time);
        let xVel = newVel.x2 - player.x2;
        let yVel = newVel.y2 - player.y2;
        let x2 = newVel.x2;
        let y2 = newVel.y2;
        let {
            sin,
            cos,
            pow
        } = Math;
        let cosX = cos(near.aim3);
        let sinY = sin(near.aim3);
        let mult = 1.056;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }
        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        return {
            x: x2 + velX,
            y: y2 + velY
        };
    }
    function getAngleDifference(angle1, angle2) {
        angle1 = angle1 % (Math.PI * 2);
        angle2 = angle2 % (Math.PI * 2);
        let diff = Math.abs(angle1 - angle2);
        if (diff > Math.PI) {
            diff = Math.PI * 2 - diff;
        }
        return diff;
    }
    /* ================================================================== *
     * ONE TICK -- ported from chicken v4.6.2 (`instaManager`)
     *
     * Structure for structure, this is chicken's:
     *
     *   - `onQueue` is drained one entry per server tick (`tickBase`), so the
     *     combo keeps its shape when a tick packet arrives late. Nova's old
     *     one tick nested `game.tickBase(..., 1)` callbacks, which fire on an
     *     absolute tick number and bunch up when the connection stutters.
     *   - `startInsta("ot" | "reverse")` is the combo itself: turret gear on
     *     tick 0, bull helmet + hit on tick 1, release on tick 2.
     *   - `oneTickMovement()` is a four-band controller that walks the player
     *     onto `game.perfectOTDistance` by picking the hat/accessory speed
     *     multiplier that lands inside the +/-5 window, and fires when it is:
     *
     *       |error|   hat                accessory            net speed
     *       > 35      soldier    x0.94   monkey tail  x1.35   x1.27  close in
     *       20..35    soldier    x0.94   shadow wings x1.10   x1.03
     *       10..20    tank gear  x0.30   none         x1.00   x0.30  crawl
     *       <= 10     tank gear  x0.30   shadow wings x1.10   x0.33
     *       <= 5      fire, or hold with soldier + shadow wings
     *
     * Two things changed on the way across, both on purpose:
     *
     *   - chicken's fire gate reads `e.skinindex != 6` (lowercase i), so the
     *     "don't one tick into a soldier helmet" half of it never ran. Ported
     *     as `skinIndex`, which is what the line is for.
     *   - the trigger is Nova's. Hold T or ; -- the keys that used to run
     *     `tickMovement` / `boostTickMovement` -- instead of chicken's
     *     `keyBinds.oneTickKey`, and `configs.autoOneFrame` (the P toggle)
     *     still auto-fires, but through chicken's gate rather than Nova's.
     * ================================================================== */
    const oneTickKeys = ["t", ";"];
    let instaManager = {
        onQueue: [],
        holdModeOT: false,
        // chicken carries the insta type on `chicken.autoaim`; Nova aims off
        // `my.autoAim`, so the type is kept here and `my.autoAim` set alongside.
        autoaim: false,
        steering: false,

        /* chicken: instaManager.tickBase() -- one queued step per tick. */
        tickBase: function() {
            if (!inGame || !player || !player.alive) {
                if (this.onQueue.length || this.autoaim) {
                    this.onQueue = [];
                    this.finish();
                }
                return;
            }
            if (typeof this.onQueue[0] == "function") {
                this.onQueue[0]();
                this.onQueue.shift();
            }
        },
        addToQueue: function(set) {
            if (typeof set == "function") {
                this.onQueue.push(set);
            }
        },
        finish: function() {
            this.autoaim = false;
            my.autoAim = false;
            instaC.isTrue = false;
        },

        /* Nova helpers the ported code leans on. */
        hasTarget: function() {
            return !!(enemy.length && near && typeof near.sid == "number");
        },
        aim: function() {
            return this.hasTarget() ? near.aim2 : getAttackDir();
        },
        equipWeapon: function(index) {
            if (player.weaponIndex != index || player.buildIndex > -1) {
                selectWeapon(index);
            }
        },
        /* chicken: chicken.tickMovement(e). Nova's packet() already drops a
         * move packet that repeats the current direction, so the
         * movementDirection cache chicken keeps is not needed here. */
        moveTo: function(dir) {
            if (dir === "stop movement") {
                packet("9", undefined, 1);
            } else if (typeof dir == "number") {
                packet("9", dir, 1);
            } else {
                packet("9", getMoveDir(), 1);
            }
        },
        /* chicken: hatSystem.storeEquip(hat, 0, true) + storeEquip(acc, 1, true).
         * hatSystem.checkOnlySoldier() overrides the hat while chicken is
         * holding soldier for a threat; Nova's equivalent is my.anti0Tick. */
        stage: function(hat, acc) {
            buyEquip(my.anti0Tick > 0 ? 6 : hat, 0);
            buyEquip(acc, 1);
        },

        /* chicken: the gate inside oneTickMovement()'s `n <= 5` branch. Turret
         * gear and bull helmet are checked for ownership here because Nova's
         * buyEquip falls back to another hat instead of doing nothing. */
        canOneTick: function() {
            return this.hasTarget() &&
                near.skinIndex != 6 &&
                near.skinIndex != 22 &&
                player.tailIndex != 11 &&
                player.skins[53] &&
                player.skins[7] &&
                player.reloads[53] == 0 &&
                player.reloads[player.weapons[0]] == 0;
        },

        /* chicken: instaManager.startInsta(e) */
        startInsta: function(type) {
            if (!this.hasTarget() || this.autoaim) {
                return false;
            }
            this.autoaim = type;
            my.autoAim = true;
            instaC.isTrue = true;
            if (type == "reverse") {
                buyEquip(53, 0);
                this.equipWeapon(player.weapons[1]);
                packet("D", this.aim());
                sendAutoGather();
                this.addToQueue(() => {
                    buyEquip(7, 0);
                    this.equipWeapon(player.weapons[0]);
                    packet("D", this.aim());
                    this.moveTo(this.aim());
                });
                this.addToQueue(() => {
                    sendAutoGather();
                    this.finish();
                });
            } else {
                buyEquip(53, 0);
                this.equipWeapon(player.weapons[0]);
                this.addToQueue(() => {
                    buyEquip(7, 0);
                    packet("D", this.aim());
                    sendAutoGather();
                    this.moveTo(this.aim());
                });
                this.addToQueue(() => {
                    sendAutoGather();
                    this.finish();
                });
            }
            return true;
        },

        /* chicken: instaManager.oneTickMovement(). `closing` is chicken's `s`:
         * where the next tick puts us, measured against the error we already
         * have -- below zero means we are still coming in. */
        oneTickMovement: function() {
            if (!this.hasTarget()) {
                this.holdModeOT = false;
                return;
            }
            let aim = near.aim2;
            let diff = near.dist2 - game.perfectOTDistance;
            let closing = UTILS.getDist(near, player, 2, 3) - diff;
            let error = Math.abs(diff);
            if (player.weapons[1] == 10) {
                this.equipWeapon(10);
            }
            // chicken's shortcut, verbatim. As written it cannot fire:
            // `closing` is the predicted distance minus the error we already
            // have, and a tick of movement is ~40px, so it never goes negative.
            // The band table below is what actually decides. Left in place --
            // tools/verify-nova-ot.js pins that it stays unreachable.
            if (error <= 25 && closing < 0) {
                error = 5;
            }
            if (error <= 5) {
                if (this.canOneTick()) {
                    this.startInsta("ot");
                    return aim;
                }
                this.stage(6, 19);
                return "stop movement";
            }
            if (error <= 20) {
                this.stage(40, error <= 10 ? 19 : 0);
            } else {
                this.stage(6, error <= 35 ? 19 : 11);
            }
            return aim + (diff > 0 ? 0 : Math.PI);
        },

        /* Hold mode, run once a tick. chicken skips the whole action chain
         * while an insta owns the tick (`if (this.autoaim);`) -- same here. */
        drive: function() {
            if (this.autoaim) {
                return;
            }
            if (!this.holdModeOT) {
                if (this.steering) {
                    this.steering = false;
                    this.moveTo();
                }
                return;
            }
            if (traps.inTrap || traps.breakshit) {
                return;
            }
            this.steering = true;
            // Nova gates hatChanger/accChanger and autoPush on instaC.ticking,
            // which is how its own OT movement kept them off its gear.
            instaC.ticking = true;
            this.moveTo(this.oneTickMovement());
        },

        /* Nova's auto one frame (configs.autoOneFrame, toggled with P) kept as
         * a trigger, but firing on chicken's window instead of Nova's hat
         * predictor. No steering and no gear staging: this one only takes the
         * tick that is already there. */
        autoOneTick: function() {
            if (!configs.autoOneFrame || this.autoaim || instaC.isTrue) {
                return false;
            }
            if (traps.inTrap || traps.breakshit || !this.hasTarget()) {
                return false;
            }
            if (![4, 5].includes(player.weapons[0])) {
                return false;
            }
            if (configs.safeTick && (near.skinIndex === 6 || near.skinIndex === 22)) {
                return false;
            }
            let diff = near.dist2 - game.perfectOTDistance;
            let closing = UTILS.getDist(near, player, 2, 3) - diff;
            let error = Math.abs(diff);
            if (error <= 25 && closing < 0) {
                error = 5;
            }
            if (error > 5 || !this.canOneTick()) {
                return false;
            }
            return this.startInsta("ot");
        }
    };
    // antionetick speed added ggez
    function antiOneTick(speed){
        antiTick = true;
        clearTimeout(antiTickTimeout);
        antiTickTimeout = setTimeout(function(){
            antiTick = false;
        }, speed);
    }
    const decayRate = Math.pow(0.993, 111.11112);
    function getDecelDist(x, t) {
        if (isNaN(x) || x == Infinity) {
            return null;
        }
        let value = x;
        while (value >= 0.001) {
            value *= decayRate;
            x += value;
        }
        return x;
    }
    function checkStoppedMoving(tmp) {
        let fullDecelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        let decelPos = {
            x: tmp.oldPos.x2 + tmp.oldXVel * decayRate,
            y: tmp.oldPos.y2 + tmp.oldYVel * decayRate
        };
        if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2 && Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "fullDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        } else if (Math.abs(tmp.x2 - fullDecelPos.x) <= 2) {
            return [true, "xDecel", {
                x: tmp.x2 + tmp.xVel * decayRate,
                y: tmp.y2 + (tmp.y2 - tmp.oldPos.y2)
            }];
        } else if (Math.abs(tmp.y2 - fullDecelPos.y) <= 2) {
            return [true, "yDecel", {
                x: tmp.x2 + (tmp.x2 - tmp.oldPos.x2),
                y: tmp.y2 + tmp.yVel * decayRate
            }];
        }
    }
    function getMoveSpeed(ticks, tmp, dir) {
        tmp.newXVel = tmp.xVel;
        tmp.newYVel = tmp.yVel;
        let totalXVel = 0;
        let totalYVel = 0;
        let decel = false;
        if (tmp?.velocity != undefined && tmp.sid != player.sid) {
            decel = cdf(tmp, tmp.velocity?.accel) > cdf(tmp, tmp.velocity?.decel) && dAng(tmp.movDir, tmp.pmovDir) <= 0.3;
        }
        if (tmp.sid == player.sid) {
            if (clientMoveDir == undefined) {
                decel = true;
            }
        }
        for (let i = 0; i < ticks; i++) {
            tmp.newXVel = tmp.newXVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.cos(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            tmp.newYVel = tmp.newYVel * Math.pow(0.993, game.tickSpeed) + (decel ? 0 : Math.sin(dir) * 0.0016 * tmp.maxSpeed * game.tickRate * game.tickSpeed);
            totalXVel += tmp.newXVel;
            totalYVel += tmp.newYVel;
        }
        return {
            x: tmp.newXVel,
            y: tmp.newYVel
        };
    }
    function getMovePos(ticksToMove, tmp, angle) {
        if (typeof angle != "number" || typeof ticksToMove != "number") {
            console.error("what are you doing faggot");
        }
        tmp.update(1);
        return {
            x: tmp.x2 + getMoveSpeed(ticksToMove, tmp, angle).x,
            y: tmp.y2 + getMoveSpeed(ticksToMove, tmp, angle).y
        };
    }
    function checkIsTeam(sid) {
        return alliancePlayers.find(THIS => THIS === sid) != undefined;
    }
    let moveTicks = 0;
    let didStop = {
        time: Date.now(),
        type: null
    };
    var stopHit = 0;
    function objDmgPot() {
        for (let i = 0; i < liztobj.length; i++) {
            liztobj[i].dmgpot = 0;
        }
        for (let x = 0; x < players.length; x++) {
            const _ = players[x];
            if (_.sid == player.sid) {
                continue;
            }
            _.bDmg = _?.secondaryIndex === 10 && _.reloads[_.secondaryIndex] === 0 ? {
                dmg: sortWeaponVariant(_.secondaryVariant) * 75 * 3.3,
                wep: 10
            } : _?.primary && _.reloads[_.primaryIndex] === 0 ? {
                dmg: _?.primary?.dmg * 3.3 * sortWeaponVariant(_.primaryVariant),
                wep: _.primaryIndex
            } : 0;
            if (_.bDmg === 0) {
                continue;
            }
            for (let i = 0; i < liztobj.length; i++) {
                const object = liztobj[i];
                object.assumeBreak = false;
                if (object.type !== null || !object?.owner?.sid) {
                    continue;
                }
                const d_o = UTILS.getDist(_, object, 2, 0) <= items.weapons[_.bDmg.wep].range + object.scale;
                if (!d_o) {
                    continue;
                }
                object.dmgpot = _.bDmg.dmg;
                if (_.antiBull) {
                    object.likelyDmg = _.bDmg.dmg;
                }

                if (object.likelyDmg >= object.health) {
                    breakObjs.push(object);
                }
                if (object.dmgpot >= object.health ) {
                    object.assumeBreak = true;

                    continue;
                }
            }
        }
    }
    function breakShit(angle, wep, variant, hat, force, type, o, t, dmg) {
        for (let i = 0; i < liztobj.length; i++) {
            const greg = liztobj[i];
            if (greg.type !== null || !greg?.owner?.sid || greg.dist2 > items.weapons[wep]?.range + greg.scale) {
                continue;
            }
            t = caf(player, liztobj[i]);
            if (UTILS.getAngleDist(t, angle) <= config.gatherAngle && greg.type === null) {
                dmg = items.weapons[wep].dmg * (wep === 10 ? 7.5 : 1) * (hat === 40 ? 3.3 : 1) * sortWeaponVariant(variant);
                const conditions = (wep < 9 ? player.reloads[player.weapons[0]] : player.reloads[player.weapons[1]]) === 0 && dmg >= greg.health;
                if (conditions) {
                    greg.assumeBreak = true;
                    greg.manualBreak = true;
                    breakObjs.push(greg);
                } else if (force) {
                    breakObjs.push(greg);
                }
            }
        }
    }
    function calcNewVel(_, ang, set, docalc, time) {
        let tmpPlyr = _;
        let xVel = tmpPlyr.x3 - tmpPlyr.x2;
        let yVel = tmpPlyr.y3 - tmpPlyr.y2;
        let x2 = _.x3;
        let y2 = _.y3;
        if (typeof time !== "number") {
            time = game.tickRate;
        }
        let {
            sin,
            cos,
            pow,
            sqrt,
            max,
            round,
            min
        } = Math;

        if (!docalc) {
            if (_.sid == player.sid && ang !== 0 && !ang) {
                ang = getMoveDir();
            } else if (_.trapped) {
                ang = undefined;
            } else if (!ang && ang !== 0) {
                ang = _.movDir;
            }
        }

        let cosX = cos(ang);
        let sinY = sin(ang);
        let sqrtDis = sqrt(cosX * cosX + sinY * sinY);
        if (sqrtDis != 0) {
            cosX /= sqrtDis;
            sinY /= sqrtDis;
        }
        if (!set) {
            set = _;
        }
        let mult = set.maxSpeed;
        _.speedXD = 0;
        _.speedYD = 0;
        _.predY = 0;
        _.predX = 0;
        if (cosX) {
            _.speedXD += cosX * 0.0016 * mult * time;
        }
        if (sinY) {
            _.speedYD += sinY * 0.0016 * mult * time;
        }

        if (_.speedXD) {
            _.predX += _.speedXD * time;
        }
        if (_.speedYD) {
            _.predY += _.speedYD * time;
        }
        let velXD = xVel * pow(0.993, time);
        let velYD = yVel * pow(0.993, time);
        let velX = velXD + _.predX;
        let velY = velYD + _.predY;
        let accel = {
            x: x2 + velX,
            y: y2 + velY,
            type: "accel"
        };
        let decel = {
            x: x2 + velXD,
            y: y2 + velYD,
            type: "decel"
        };
        let current = {
            x: x2,
            y: y2,
            type: "current"
        };
        let nextVel = {
            x: velX,
            y: velY,
            type: "nextVel"
        };
        let real = accel;
        let vel = sqrt(velX * velX + velY * velY);
        let spd = mult;
        let

        boostxVel;
        let boostyVel;

        boostxVel = time * 1.5 * cos(ang);
        boostyVel = time * 1.5 * sin(ang);
        let boostCoords = {
            x: x2 + boostxVel,
            y: y2 + boostyVel
        };
        if (_?.velocity != undefined && _.sid != player.sid) {
            real = cdf(_, _.oldPos) == 0 || cdf(_, _.velocity?.accel) > cdf(_, _.velocity?.decel) && dAng(_.movDir, _.pmovDir) <= 0.3 || _.trapped ? decel : accel;
        }
        if (_.sid == player.sid) {
            if (getMoveDir() == undefined || clientMoveDir == null) {
                real = decel;
            } else {
                real = accel;
            }
        }
        function fulldecel(e, t, coords, e2, t2) {
            if (isNaN(e) || isNaN(t)) {
                return;
            }
            try {
                e2 = e * decayRate;
                t2 = t * decayRate;
                if (e != e2) {
                    e = e2;
                    coords.x += e;
                }
                if (t != t2) {
                    t = t2;
                    coords.y += t;
                }
                if (e == e2 && t == t2) {
                    return {
                        x: coords.x,
                        y: coords.y,
                        type: "full decel"
                    };
                } else {

                    return fulldecel(e, t, coords);
                }
            } catch (e) {}
        }
        let fullDecel = fulldecel(velX, velY, {
            x: x2 + velX,
            y: y2 + velY
        });
        let result = {
            accel: accel,
            decel: decel,
            boostCoords: boostCoords,
            boostVel: {
                x: boostxVel,
                y: boostyVel
            },
            nextVel: nextVel,
            real: real,
            current: current,
            fullDecel: fullDecel,
            xVel: velX,
            spd: mult,
            yVel: velY,
            vel: vel
        };
        return result;
    }
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
    let hatPredictTrap = false;
    function predictHatSwitch(id, mainHat = nearestEnemy.skinIndex) { // simple predict hat of main
        if (near.inTrap) {
            if (mainHat == 6 || mainHat == 22) {
                if (predictReload() && (mainHat != 6 || mainHat != 22)) {
                    hatPredictTrap = true;
                } else {
                    hatPredictTrap = false;
                }
            } else {
                hatPredictTrap = false;
            }
        }
    }
    class Instakill {
        constructor() {
            this.wait = false;
            this.can = false;
            this.isTrue = false;
            this.nobull = false;
            this.ticking = false;
            this.canSpikeTick = false;
            this.startTick = false;
            this.readyTick = false;
            this.canCounter = false;
            this.revTick = false;
            this.syncHit = false;
            this.changeType = function(type) {
                this.wait = false;
                this.isTrue = true;
                my.autoAim = true;
                let backupNobull = near.backupNobull;
                near.backupNobull = false;
                game.tickBase(() => {
                    game.tickBase(() => {
                        if (near.skinIndex == 22 && getEl("backupNobull").checked) {
                            near.backupNobull = true;
                        }
                    }, 1);
                }, 1);

                if (getEl("antiBackInsta").checked && near.reloads[near.weapons[0]] == 0) {
                    healer();
                    buyEquip(near.reloads[53] == 0 ? 22 : 6, 0);
                    buyEquip(21, 1);
                }

                if (type == "rev") {
                    selectWeapon(player.weapons[1]);
                    buyEquip(53, 0);
                    buyEquip(21, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else if (type == "nobull") {
                    selectWeapon(player.weapons[0]);
                    if (getEl("backupNobull").checked && backupNobull) {
                        buyEquip(7, 0);
                    } else {
                        buyEquip(6, 0);
                    }
                    buyEquip(21, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        if (near.skinIndex == 22) {
                            if (getEl("backupNobull").checked) {
                                near.backupNobull = true;
                            }
                            buyEquip(6, 0);
                        } else {
                            buyEquip(53, 0);
                        }
                        selectWeapon(player.weapons[1]);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else if (type == "normal") {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    buyEquip(21, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(player.reloads[53] == 0 ? 53 : 6, 0);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    }, 1);
                } else {
                    setTimeout(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 50);
                }
            };
            this.spikeTickType = function () {
                ShowSettingText(300, "SpikeTick", "#f00");
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            // ff spike tick
            this.checkSoldier = function() {
                const canHit = traps.canHit();
                const nearReload = near.reloads[near.weaponIndex] !== 0;
                return (near.skinIndex !== 6 && canHit) || (!canHit && nearReload);
            };
            this.spikeSyncType = function() {
                this.isTrue = true;
                my.autoAim = true;
                shuffleTicks();
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(18, 1);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        buyEquip(6, 0);
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            this.pushTickType = function () {
                this.isTrue = true;
                my.autiAim = true;
                selectWeapon(player.weapons[1]);
                buyEquip(53, 0);
                sendAutoGather();
                game.addToQueue(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(7, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 2);
            }
            this.bianosSpTick = function () {
                my.autoAim = true;
                this.isTrue = true;
                buyEquip(7, 0);
                selectWeapon(player.weapons[0]);
                sendAutoGather();
                game.addToQueue(() => {
                    buyEquip(53, 0);
                    game.addToQueue(() => {
                        sendAutoGather();
                        bianosTick = false;
                        this.isTrue = false;
                        my.autoAim = false;
                        buyEquip(6, 0);
                    }, 1);
                }, 1);
            };
            this.AutoSync = function () {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                packet("D", getAttackDir());
                buyEquip(7, 0);
                sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            };
            this.syncTry = function () {
                packet("D", getAttackDir());
                buyEquip(53, 0);
                game.tickBase(() => {
                    this.isTrue = true;
                    my.autoAim = true;
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, 2);
            };
            this.MapSync = function () {
                let nearDistCheck;
                nearDistCheck = near.dist2 <= 300 ? 1 : 2;
                buyEquip(53, 0);
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    sendAutoGather();
                    this.isTrue = true;
                    my.autoAim = true;
                    game.tickBase(() => {
                        my.autoAim = false;
                        this.isTrue = false;
                        sendAutoGather();
                    }, 1);
                }, nearDistCheck);
            };
            this.counterType = function() {
                this.isTrue = true;
                my.autoAim = true;
                selectWeapon(player.weapons[0]);
                buyEquip(7, 0);
                buyEquip(21, 1);
                sendAutoGather();
                game.tickBase(() => {
                    if (player.reloads[53] == 0) {
                        selectWeapon(player.weapons[0]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        game.tickBase(() => {
                            sendAutoGather();
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    } else {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }
                }, 1);
            };

            this.rangeType = function (type) {
                this.isTrue = true;
                my.autoAim = true;
                if (type == "ageInsta") {
                    my.ageInsta = false;
                    if (player.items[5] == 18) {
                        place(5, near.aim2);
                        place(5, near.aim2 + Math.PI);
                    }
                    packet("9", undefined, 1);
                    buyEquip(22, 0);
                    buyEquip(21, 1);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[1]);
                        buyEquip(53, 0);
                        buyEquip(21, 1);
                        sendAutoGather();
                        game.tickBase(() => {
                            sendUpgrade(12);
                            selectWeapon(player.weapons[1]);
                            buyEquip(53, 0);
                            buyEquip(21, 1);
                            game.tickBase(() => {
                                sendUpgrade(15);
                                selectWeapon(player.weapons[1]);
                                buyEquip(53, 0);
                                buyEquip(21, 1);
                                game.tickBase(() => {
                                    sendAutoGather();
                                    this.isTrue = false;
                                    my.autoAim = false;
                                }, 1);
                            }, 1);
                        }, 1);
                    }, 1);
                } else {
                    selectWeapon(player.weapons[1]);
                    if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
                        buyEquip(53, 0);
                    } else {
                        buyEquip(20, 0);
                    }
                    buyEquip(11, 1);
                    sendAutoGather();
                    game.tickBase(() => {
                        sendAutoGather();
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }
            };
            this.bowInstaCheck = function () {
                let stop = setInterval(() => {
                    if (!enemy.length || traps.inTrap || player.reloads[53] != 0) {
                        clearInterval(stop);
                    }
                    stopUp = false;
                    if (near.dist2 < 590) {
                        buyEquip(12, 0);
                        packet("9", near.aim2 + Math.PI, 1);
                    } else {
                        if (near.skinIndex != 22) {
                            packet("9", undefined, 1);
                            clearInterval(stop);
                            game.tickBase(() => {
                                buyEquip(53, 0);
                                this.isTrue = true;
                                my.autoAim = true;
                                selectWeapon(player.weapons[1]);
                                sendAutoGather();
                                if (player.upgrAge === 7) {
                                    sendUpgrade(38);
                                }
                                buyEquip(53, 0);
                                game.tickBase(() => {
                                    if (player.upgrAge === 8) {
                                        sendUpgrade(12);
                                    }
                                    selectWeapon(player.weapons[1]);
                                    game.tickBase(() => {
                                        if (player.upgrAge === 9) {
                                            sendUpgrade(15);
                                        }
                                        selectWeapon(player.weapons[1]);
                                        buyEquip(53, 0);
                                        game.tickBase(() => {
                                            sendAutoGather();
                                            this.isTrue = false;
                                            my.autoAim = false;
                                            stopUp = true
                                        }, 1);
                                    }, 1);
                                }, 1);
                            }, 1);
                        } else {
                            if (near.dist2 >= 630) {
                                packet("9", near.aim2, 1);
                            } else {
                                packet("9", undefined, 1);
                            }
                        }
                    }
                }, 0);
            };
            this.gotoGoal = function (goto, OT) {
                let slowDists = (weeeee) => weeeee * config.playerScale;
                let goal = {
                    a: goto - OT,
                    b: goto + OT,
                    c: goto - slowDists(1),
                    d: goto + slowDists(1),
                    e: goto - slowDists(2),
                    f: goto + slowDists(2),
                    g: goto - slowDists(4),
                    h: goto + slowDists(4)
                };
                let bQ = function (wwww, awwww) {
                    if (player.y2 >= config.mapScale / 2 - config.riverWidth / 2 && player.y2 <= config.mapScale / 2 + config.riverWidth / 2 && awwww == 0) {
                        buyEquip(31, 0);
                    } else {
                        buyEquip(wwww, awwww);
                    }
                }
                if (enemy.length) {
                    let dst = near.dist2;
                    this.ticking = true;
                    if (dst >= goal.a && dst <= goal.b) {
                        bQ(22, 0);
                        bQ(10, 1);
                        if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                        }
                        return {
                            dir: undefined,
                            action: 1
                        };
                    } else {
                        if (dst < goal.a) {
                            if (dst >= goal.g) {
                                if (dst >= goal.e) {
                                    if (dst >= goal.c) {
                                        bQ(40, 0);
                                        bQ(10, 1);
                                        if (configs.slowOT) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(12, 0);
                                        bQ(0, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(0, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
                                bQ(10, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                            return {
                                dir: near.aim2 + Math.PI,
                                action: 0
                            };
                        } else if (dst > goal.b) {
                            if (dst <= goal.h) {
                                if (dst <= goal.f) {
                                    if (dst <= goal.d) {
                                        bQ(40, 0);
                                        bQ(0, 1);
                                        if (configs.slowOT) {
                                            player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                        } else {
                                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        bQ(12, 0);
                                        bQ(0, 1);
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(0, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                biomeGear();
                                bQ(10, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                            return {
                                dir: near.aim2,
                                action: 0
                            };
                        }
                        return {
                            dir: undefined,
                            action: 0
                        };
                    }
                } else {
                    this.ticking = false;
                    return {
                        dir: undefined,
                        action: 0
                    };
                }
            }
            /** wait 1 tick for better quality */
            this.bowMovement = function () {
                let moveMent = this.gotoGoal(685, 3);
                if (moveMent.action) {
                    if (player.reloads[53] == 0 && !this.isTrue) {
                        this.rangeType("ageInsta");
                    } else {
                        packet("9", moveMent.dir, 1);
                    }
                } else {
                    packet("9", moveMent.dir, 1);
                }
            }
            this.shameThing = function () {
                if (enemy.hat === 45) {
                    buyEquip(53, 0);
                    game.tickBase(() => {
                        selectWeapon(player.weapons[0]);
                        buyEquip(7, 0);
                        sendAutoGather();
                    }, 1);
                }
            }
            /** wait 1 tick for better quality */
            this.perfCheck = function(pl, nr) {
                if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) return false;
                if (![9, 12, 13, 15].includes(player.weapons[1])) return true;
                let pjs = {
                    x: nr.x2 + (65 * Math.cos(nr.aim2 + Math.PI)),
                    y: nr.y2 + (65 * Math.sin(nr.aim2 + Math.PI))
                };
                if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
                let finds = ais.filter(tmp => tmp.visible).find((tmp) => {
                    if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                        return true;
                    }
                });
                if (finds) return false;
                finds = liztobj.filter(tmp => tmp.active).find((tmp) => {
                    let tmpScale = tmp.getScale();
                    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                        return true;
                    }
                });
                if (finds) return false;
                return true;
            }
        }
    };
    class Autobuy {
        constructor(buyHat, buyAcc) {
            this.hat = function() {
                buyHat.forEach((id) => {
                    let find = findID(hats, id);
                    if (find && !player.skins[id] && player.points >= find.price) packet("c", 1, id, 0);
                });
            };
            this.acc = function() {
                buyAcc.forEach((id) => {
                    let find = findID(accessories, id);
                    if (find && !player.tails[id] && player.points >= find.price) packet("c", 1, id, 1);
                });
            };
        }
    };
    class Damages {
        constructor(items) {
            // 0.75 1 1.125 1.5
            this.calcDmg = function(dmg, val) {
                return dmg * val;
            };
            this.getAllDamage = function(dmg) {
                return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
            };
            this.weapons = [];
            for (let i = 0; i < items.weapons.length; i++) {
                let wp = items.weapons[i];
                let name = wp.name.split(" ").length <= 1 ? wp.name : (wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1]);
                this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
                this[name] = this.weapons[i];
            }
        }
    }
    let tmpList = [];
    var bianosTick = false;
    // LOADING:
    let UTILS = new Utils();
    let items = new Items();
    let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
    let store = new Store();
    let hats = store.hats;
    let accessories = store.accessories;
    let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
    let aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
    let textManager = new Textmanager();
    let traps = new Traps(UTILS, items);
    let instaC = new Instakill();
    let autoBuy = new Autobuy([15, 31, 6, 7, 22, 12, 53, 20, 40], [11, 13, 19, 18, 21]);
    let lastDeath;
    let minimapData;
    let mapMarker = {};
    let mapPings = [];
    let tmpPing;
    let breakTrackers = [];

    function sendChat(message) {
        packet("6", message.slice(0, 30));
    }

    let runAtNextTick = [];
    function checkProjectileHit(plyr, velocity, th, obj, R = 50) {
        const ux = Math.cos(th);
        const uy = Math.sin(th);
        let target = obj;
        let proj = {
            x: plyr.x2,
            y: plyr.y2
        };
        let tick = null;
        const movDir = obj.movDir;
        for (let i = 0; i < 6; i++) {
            proj.x += velocity / 4 * ux;
            proj.x += velocity / 4 * uy;
            target = calcAccel(target, movDir, target, game.tickRate);
            const dx = proj.x - target.x2;
            const dy = proj.y - target.y2;
            if (dx * dx + dy * dy <= R * R) {
                tick = i;
                return true;
            } else if (i >= 2) {
                const dx2 = player.x2 - target.x2;
                const dy2 = player.y2 - target.y2;
                const dx3 = player.x2 - proj.x;
                const dy3 = player.y2 - proj.y;
                if (dx2 * dx2 + dy2 * dy2 < dx3 * dx3 + dy3 * dy3 + 7000) {
                    return false;
                }
            }
        }
        return false;
    }
    function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
        let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
        let projOffset = config.playerScale * 2;
        let projXY = {
            x: indx == 1 ? x : x - projOffset * Math.cos(dir),
            y: indx == 1 ? y : y - projOffset * Math.sin(dir),
        };
        let nearPlayer = players.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function(a, b) {
            return UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2);
        })[0];
        if (nearPlayer) {
            if (indx == 1) {
                nearPlayer.shooting[53] = 1;
            } else {
                nearPlayer.shootIndex = weaponIndx;
                nearPlayer.shooting[1] = 1;
                antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
            }
        }
    }

    let projectileCount = 0;
    function antiProj(_, dir, range, speed, index, weaponIndex) {
        if (!_.isTeam(player)) {
            tmpDir = UTILS.getDirect(player, _, 2, 2);
            if (UTILS.getAngleDist(tmpDir, dir) <= 0.2) {
                _.bowThreat[weaponIndex]++;
                if (index == 5) {
                    projectileCount++;
                }
                setTimeout(() => {
                    _.bowThreat[weaponIndex]--;
                    if (index == 5) {
                        projectileCount--;
                    }
                }, range / speed);
                if (_.bowThreat[9] >= 1 && (_.bowThreat[12] >= 1 || _.bowThreat[15] >= 1)) {
                    place(1, _.aim2);
                    my.anti0Tick = 4;
                    if (!my.antiSync) {
                        antiSyncHealing(4);
                    }
                } else {
                    if (projectileCount >= 2) {
                        place(1, _.aim2);
                        my.anti0Tick = 4;
                        if (!my.antiSync) {
                            antiSyncHealing(4);
                        }
                    }
                }
            }
        }
    }

    // SHOW ITEM INFO:
    function showItemInfo(item, isWeapon, isStoreItem) {
        if (player && item) {
            UTILS.removeAllChildren(itemInfoHolder);
            itemInfoHolder.classList.add("visible");
            UTILS.generateElement({
                id: "itemInfoName",
                text: UTILS.capitalizeFirst(item.name),
                parent: itemInfoHolder
            });

            UTILS.generateElement({
                id: "itemInfoDesc",
                text: item.desc,
                parent: itemInfoHolder
            });
            if (isStoreItem) {
            } else if (isWeapon) {
                UTILS.generateElement({
                    class: "itemInfoReq",
                    text: !item.type ? "primary" : "secondary",
                    parent: itemInfoHolder
                });
            } else {
                for (let i = 0; i < item.req.length; i += 2) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                        parent: itemInfoHolder
                    });
                }
                if (item.group.limit) {
                    UTILS.generateElement({
                        class: "itemInfoLmt",
                        text: (player.itemCounts[item.group.id] || 0) + "/" + (config.isSandbox ? 99 : item.group.limit),
                        parent: itemInfoHolder
                    });
                }
            }
        } else {
            itemInfoHolder.classList.remove("visible");
        }
    }
    // RESIZE:
    window.addEventListener("resize", UTILS.checkTrusted(resize));
    function resize() {
        screenWidth = window.innerWidth;
        screenHeight = window.innerHeight;
        /*let scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
        gameCanvas.width = screenWidth * pixelDensity;
        gameCanvas.height = screenHeight * pixelDensity;
        gameCanvas.style.width = screenWidth + "px";
        gameCanvas.style.height = screenHeight + "px";
        be.setTransform(
            scaleFillNative, 0,
            0, scaleFillNative,
            (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
            (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
        );*/
    }
    resize();
    // MOUSE INPUT:
    var usingTouch;
    const mals = document.getElementById('touch-controls-fullscreen');
    mals.style.display = 'block';
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
        if (attackState != 1) {
            attackState = 1;
            if (e.button == 0) {
                clicks.left = true;
            } else if (e.button == 1) {
                clicks.middle = true;
            } else if (e.button == 2) {
                clicks.right = true;
            }
        }
    }
    mals.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));
    function mouseUp(e) {
        if (attackState != 0) {
            attackState = 0;
            if (e.button == 0) {
                clicks.left = false;
            } else if (e.button == 1) {
                clicks.middle = false;
            } else if (e.button == 2) {
                clicks.right = false;
            }
        }
    }
    mals.addEventListener("wheel", wheel, false);
    function wheel(e) {
        if (e.deltaY < 0) {
            my.reSync = true;
        } else {
            my.reSync = false;
        }
    }
    // INPUT UTILS:
    function getMoveDir() {
        let dx = 0;
        let dy = 0;
        for (let key in moveKeys) {
            let tmpDir = moveKeys[key];
            dx += !!keys[key] * tmpDir[0];
            dy += !!keys[key] * tmpDir[1];
        }
        return dx == 0 && dy == 0 ? undefined : Math.atan2(dy, dx);
    }
    function getSafeDir() {
        if (!player) return 0;
        if (!player.lockDir) {
            lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        }

        return lastDir || 0;
    }

    function getAttackDir() {
        if (!player) return 0;

        if (my.autoAim || ((clicks.left || (autoBull.active && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8 && !traps.inTrap)) && player.reloads[player.weapons[0]] == 0)) {
            lastDir = getEl("weaponGrind").checked ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
        } else if (clicks.right && player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
            lastDir = getSafeDir();
        } else if ((traps.breakshit || traps.inTrap) && player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0) {
            lastDir = traps.aim;
        } else {
            if (!player.lockDir) {
                lastDir = getSafeDir();
            }
        }

        return lastDir || 0;
    }
    function realDir(num) {
        game.tickBase(() => {
            num = 3;
            if (showRealDir < num) {
                showRealDir = num;
            }
        }, 1);
    }
    function getVisualDir() {
        if (!player) return 0;

        lastDir = getAttackDir();

        return lastDir || 0;
    }

    // KEYS:
    function keysActive() {
        return (allianceMenu.style.display != "block" && chatHolder.style.display != "block");
    }
    function keyDown(event) {
        let keyNum = event.which || event.keyCode || 0;
        if (player && player.alive && keysActive()) {
            if (!keys[keyNum]) {
                keys[keyNum] = 1;
                macro[event.key] = 1;
                if (keyNum == 27) {
                    $("#modMenus").toggle();
                } else if (keyNum == 69) {
                    sendAutoGather();
                } else if (keyNum == 67) {
                    updateMapMarker();
                } else if (player.weapons[keyNum - 49] != undefined) {
                    player.weaponCode = player.weapons[keyNum - 49];
                } else if (moveKeys[keyNum]) {
                    sendMoveDir();
                } else if (event.key == "m") {
                    mills.placeSpawnPads = !mills.placeSpawnPads;
                } else if (event.key == "p") {
                    configs.autoOneFrame = !configs.autoOneFrame;
                    player.chat.message = (configs.autoOneFrame ? "Active" : "Passive");
                    player.chat.count = 1000;
                } else if (event.key == "z") {
                    mills.place = !mills.place;
                } else if (event.key == "Z") {
                    typeof window.debug == "function" && window.debug();
                } else if (keyNum == 32) {
                    packet("F", 1, getSafeDir(), 1);
                    packet("F", 0, getSafeDir(), 1);
                } else if (event.key == ",") {
                    player.sync = true;
                }
            }
        }
    }
    addEventListener("keydown", UTILS.checkTrusted(keyDown));
    function keyUp(event) {
        if (player && player.alive) {
            let keyNum = event.which || event.keyCode || 0;
            if (keyNum == 13) {
            } else if (keysActive()) {
                if (keys[keyNum]) {
                    keys[keyNum] = 0;
                    macro[event.key] = 0;
                    if (moveKeys[keyNum]) {
                        sendMoveDir();
                    } else if (event.key == ",") {
                        player.sync = false;
                    }
                }
            }
        }
    }
    window.addEventListener("keyup", UTILS.checkTrusted(keyUp));
    function sendMoveDir() {
        let newMoveDir = getMoveDir();
        if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
            if (!my.autoPush) {
                packet("9", newMoveDir, 1);
            }
            lastMoveDir = newMoveDir;
        }
    }

    // AUTOPUSH:
    function autoPush() {
        let nearTrap = gameObjects.filter(tmp => tmp.trap && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 2) <= (near.scale + tmp.getScale() + 15)).sort(function (a, b) {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (nearTrap) {
            let spike = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, nearTrap, 0, 0) <= (near.scale + nearTrap.scale + tmp.scale + 5)).sort(function (a, b) {
                return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
            })[0];
            if (spike) {
                let pos = {
                    x: spike.x + (250 * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                    y: spike.y + (250 * Math.sin(UTILS.getDirect(near, spike, 2, 0))),
                    x2: spike.x + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.cos(UTILS.getDirect(near, spike, 2, 0))),
                    y2: spike.y + ((UTILS.getDist(near, spike, 2, 0) + player.scale) * Math.sin(UTILS.getDirect(near, spike, 2, 0)))
                };
                let finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                    let tmpScale = tmp.getScale();
                    if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, player.x2, player.y2, pos.x2, pos.y2)) {
                        return true;
                    }
                });

                if (finds) {
                    if (my.autoPush) {
                        my.autoPush = false;
                        //packet("9", lastMoveDir || undefined, 1);
                    }
                } else {
                    my.autoPush = true;
                    my.pushData = {
                        x: pos.x,
                        y: pos.y,
                        x2: pos.x2,
                        y2: pos.y2
                    };

                    if(near.dist2 <= 180 && near.health <= 66 && player.reloads[player.primaryIndex] == 0) {
                        instaC.spikeTickType();
                    }

                    let angle = Math.atan2(near.y2 - spike.y, near.x2 - spike.x);
                    let point = {
                        x: near.x2 + Math.cos(angle) * 53,
                        y: near.y2 + Math.sin(angle) * 53,
                    };
                    let scale = (player.scale / 10);
                    if (UTILS.getDist(near, spike, 2, 0) >= 105) {
                        if (UTILS.lineInRect(player.x2 - scale, player.y2 - scale, player.x2 + scale, player.y2 + scale, near.x2, near.y2, pos.x, pos.y)) {
                            packet("9", near.aim2, 1);
                        } else {
                            packet("9", UTILS.getDirect(pos, player, 2, 2), 1);
                        }
                    } else {
                        packet("9", Math.atan2(point.y - player.y2, point.x - player.x2), 1);
                    }
                }
            } else {
                if (my.autoPush) {
                    my.autoPush = false;
                    packet("9", lastMoveDir||undefined, 1);
                }
            }
        } else {
            if (my.autoPush) {
                my.autoPush = false;
                packet("9", lastMoveDir||undefined, 1);
            }
        }
    }
    // SET INIT DATA:
    function setInitData(data) {
        alliances = data.teams;
    }
    // SETUP GAME:
    var fisrtloadez = false;
    function setupGame(yourSID) {
        keys = {};
        macro = {};
        playerSID = yourSID;
        attackState = 0;
        inGame = true;
        fisrtloadez = true;
        packet("F", 0, getAttackDir(), 1);
        my.ageInsta = true;
        if (firstSetup) {
            firstSetup = false;
            gameObjects.length = 0;
        }
    }
    /*function knockBackPredict() {
                    //thank you OE2375
                    let KBIndc = {
                        x0: 0,
                        y0: 0,
                        x1: 0,
                        y1: 0,
                        instax: 0,
                        instay: 0,
                        turretx: 0,
                        turrety: 0
                    }
                    let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
                    let minDist = Infinity;
                    let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
                        for (let tmp of gameObjects) {
                            let scope = KBIndc;
                            if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                                let primaryScaling = (items.weapons[player.weapons[0]].knock||0) * items.weapons[player.weapons[0]].range + player.scale * 2
                                let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                                let instaStuff = primaryScaling + secondaryScaling
                                let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                                let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                                let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                                let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                                let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                                let instaX = near.x2 + instaStuff * Math.cos(nea)
                                let instaY = near.y2 + instaStuff * Math.sin(nea)
                                let turretX = near.x2 + turretStuff * Math.cos(nea)
                                let turretY = near.y2 + turretStuff * Math.sin(nea)
                                scope.x0 = primaryX, scope.y0 = primaryY
                                scope.x1 = secondaryX, scope.y1 = secondaryY
                                scope.instax = instaX, scope.instay = instaY
                                scope.turretx = turretX, scope.turrety = turretY
                                if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !traps.inTrap && !traps.breakshit) {
                                    tracker.draw2.active = true
                                    tracker.draw2.x = tmp.x
                                    tracker.draw2.y = tmp.y
                                    tracker.draw2.scale = tmp.scale
                                    return "insta them"
                                }
                                if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap && !traps.breakshit) {
                                    return "insta them"
                                    tracker.draw2.active = true
                                    tracker.draw2.x = tmp.x
                                    tracker.draw2.y = tmp.y
                                    tracker.draw2.scale = tmp.scale
                                }
                            }
                        }
                    } else {
                        tracker.draw2.active = false
                        KBIndc = {
                            x0: 0,
                            y0: 0,
                            x1: 0,
                            y1: 0,
                            instax: 0,
                            instay: 0,
                            turretx: 0,
                            turrety: 0
                        }
                    }
                    return false
                }*/
    let barbKbPredict = false;

    function knockBackPredict() {
        //thank you OE2375
        let KBIndc = {
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
            instax: 0,
            instay: 0,
            turretx: 0,
            turrety: 0
        }
        let nea = Math.atan2(near.y2 - player.y2, near.x2 - player.x2);
        let minDist = Infinity;
        let neIT = gameObjects.filter(e => e.name == "pit trap" && e.active && e.isTeamObject(player) && UTILS.getDist(e, near, 0, 2) <= e.getScale() + player.scale + 5).sort((a, b) => {
            return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
        })[0];
        if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
            for (let tmp of gameObjects) {
                let scope = KBIndc;
                if (tmp.dmg && tmp.active && tmp.isTeamObject(player)) {
                    let primaryScaling = (items.weapons[player.weapons[0]].knock||0) * items.weapons[player.weapons[0]].range + player.scale * 2
                    let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock||0) * items.weapons[player.weapons[1]].range + player.scale*2 - 10 : player.weapons[1] != undefined ? 60 : 0
                    let instaStuff = primaryScaling + secondaryScaling
                    let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                    let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                    let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                    let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                    let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                    let instaX = near.x2 + instaStuff * Math.cos(nea)
                    let instaY = near.y2 + instaStuff * Math.sin(nea)
                    let turretX = near.x2 + turretStuff * Math.cos(nea)
                    let turretY = near.y2 + turretStuff * Math.sin(nea)
                    let barbarianKnockback = 235;
                    scope.x0 = primaryX, scope.y0 = primaryY
                    scope.x1 = secondaryX, scope.y1 = secondaryY
                    scope.instax = instaX, scope.instay = instaY
                    scope.turretx = turretX, scope.turrety = turretY
                    if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && !traps.inTrap && !traps.breakshit) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale*
                            textManager.showText(player.x, player.y, 30, 0.15, 1850, 'KBSyncHit', '#7289DA', 2);
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap && !traps.breakshit) {
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                        textManager.showText(player.x, player.y, 30, 0.15, 1850, 'KBSyncHit', '#7289DA', 2);
                        return "insta them"
                    }
                    if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) > tmp.scale + player.scale && UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) <= tmp.scale + player.scale + barbarianKnockback) && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && !traps.inTrap && !traps.breakshit) {
                        buyEquip(0, 0);
                        barbKbPredict = true;
                        tracker.draw2.active = true
                        tracker.draw2.x = tmp.x
                        tracker.draw2.y = tmp.y
                        tracker.draw2.scale = tmp.scale
                    }
                }
            }
        } else {
            tracker.draw2.active = false
            barbKbPredict = false;
            KBIndc = {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0,
                instax: 0,
                instay: 0,
                turretx: 0,
                turrety: 0
            }
        }
        return false
    }
    // ADD NEW PLAYER:
    function addPlayer(data, isYou) {
        let tmpPlayer = findPlayerByID(data[0]);

        if (!tmpPlayer) {
            tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                                   objectManager, players, ais, items, hats, accessories);
            players.push(tmpPlayer);

        }
        tmpPlayer.spawn(isYou ? true : null);
        tmpPlayer.visible = false;
        tmpPlayer.oldPos = {
            x2: undefined,
            y2: undefined
        };
        tmpPlayer.x2 = undefined;
        tmpPlayer.y2 = undefined;
        tmpPlayer.x3 = undefined;
        tmpPlayer.y3 = undefined;
        tmpPlayer.setData(data);
        if (isYou) {
            player = tmpPlayer;
            camX = player.x;
            camY = player.y;
            my.lastDir = 0;
            updateItems();
            updateAge();
            if (player.skins[7]) {
                my.reSync = true;
            }
        }
    }
    // Death animation store and helpers
    let Ci = [];

    function P3(x, y, dir, dist) {
        if (dir == undefined) {
            return {
                x: (typeof player !== "undefined" && player) ? player.x : x,
                y: (typeof player !== "undefined" && player) ? player.y : y
            };
        } else {
            return {
                x: x + dist * Math.cos(dir),
                y: y + dist * Math.sin(dir)
            };
        }
    }
    // REMOVE PLAYER:
    function removePlayer(id) {
        for (let i = 0; i < players.length; i++) {
            if (players[i].id == id) {
                let tmpPlayer = players[i];
                players.splice(i, 1);
                break;
            }
        }
    }


    // UPDATE HEALTH:
    function updateHealth(sid, value) {
        _ = findPlayerBySID(sid);
        if (_) {
            _.oldHealth = _.health;
            _.health = value;
            _.judgeShame();
            if (_.oldHealth > _.health) {
                _.damaged = _.oldHealth - _.health;
                advHeal.push([sid, value, _.damaged]);
            } else {
            }
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
            UTILS.removeAllChildren(upgradeHolder);
            for (let i = 0; i < items.weapons.length; ++i) {
                if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + i,
                        class: "actionBarItem",
                        onmouseout: function() {
                            showItemInfo();

                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
                    tmpList.push(i);
                }
            }
            for (let i = 0; i < items.list.length; ++i) {
                if (items.list[i].age == age && (items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                    let tmpI = (items.weapons.length + i);
                    let e = UTILS.generateElement({
                        id: "upgradeItem" + tmpI,
                        class: "actionBarItem",
                        onmouseout: function() {
                            showItemInfo();

                        },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
                    tmpList.push(tmpI);
                }
            }
            for (let i = 0; i < tmpList.length; i++) {
                (function(i) {
                    let tmpItem = getEl('upgradeItem' + i);
                    tmpItem.onmouseover = function() {
                        if (items.weapons[i]) {
                            showItemInfo(items.weapons[i], true);
                        } else {
                            showItemInfo(items.list[i - items.weapons.length]);
                        }
                    };
                    tmpItem.onclick = UTILS.checkTrusted(function() {
                        packet("H", i);
                    });
                    UTILS.hookTouchEvents(tmpItem);
                })(tmpList[i]);
            }
            if (tmpList.length) {
                upgradeHolder.style.display = "block";
                upgradeCounter.style.display = "block";
                upgradeCounter.style.borderRadius = "4px";
                upgradeCounter.innerHTML = points;
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

    // KILL OBJECT:
    function killObject(sid) {
        let findObj = findObjectBySid(sid);
        objectManager.disableBySid(sid);

        if (findObj && getEl("autoreplace").checked) {
            if (near.dist2 <= 400) traps.replacer(findObj);
        }
    }
    // KILL ALL OBJECTS BY A PLAYER:
    function killObjects(sid) {
        if (player) objectManager.removeAllItems(sid);
    }

    function madeInfo(name, id, info) {
        return `<tr style="height: 21px;">
            <td style="height: 21px;color: rgba(255, 255, 255, 0.6);">${name}:</td>
            <td style="height: 21px;"><span id="${id}">${info}</span></td>
            </tr>
    `;
    }

    let loopInfos = document.createElement("div");
    loopInfos.id = "infos"
    document.body.prepend(loopInfos);
    document.getElementById('infos').style.display = 'block';
    document.getElementById('infos').style.opacity = '1';
    document.getElementById('infos').innerHTML =
        `
            <div>   <table id="StatTbl"
            class="hackDisp"
            style="
            opacity: 1;
            display: block;
            width: 205px;
            position: absolute;
            top: 240px;
            left: 20px;
            color: #fff;
            background-color: rgba(0, 0, 0, 0.25);
            border-radius: 4px;
            -moz-border-radius: 4px;
            -webkit-border-radius: 4px;
            pointer-events: none;
            "
            border="0">
            <tbody>

            <tr style="height: 21px;">
            <td style="height: 21px;color: rgba(255, 255, 255, 0.6);">
            <button id="settingsBoxOpen" style="pointer-events: auto;background-color: black;color: white;border-color: black;border-radius: 4px;-moz-border-radius: 4px;-webkit-border-radius: 4px;">Settings</button> </td>


            <td id="pingDisp" style="height: 21px;color: white;"> Ping: 999</td>
            </tr>
            ${madeInfo("Shame:", "playerShames", "0 / 8")}
            ${madeInfo("Dmg Pot:", "potDmg", "0")}
            ${madeInfo("Healer:", "healstatusing", "AutoQ")}
            </tbody>
            </table>
            </div>
            </div>
`;

    let AutoQ = false;
    let autoBull = {
        active: false,
        plague: false,
        shames: 5,
    };
    let trapTick = new class {
        weaponDmg(_, near, sold = 1, bull = 1) {
            const { primaryVariant: v, weapons: [weapon] } = _;
            const pV = v ? config.weaponVariants[v].val : 1;
            const soldMult = (near && sold && near.skinIndex === 6) ? 0.75 : 1;
            const bullMult = (bull && _.skins[7]) ? 1.5 : 1;

            return items.weapons[weapon].dmg * bullMult * pV * soldMult;
        }

        canLastHit(near, trap) {
            let health = this.weaponDmg(player, near, true, true);
            return trap.health <= health;
        }

        fullReloaded() {
            return player.reloads[player.primaryIndex] == 0 && player.reloads[player.secondaryIndex] == 0 && player.reloads[53] == 0;
        }

        run() {
            if (!enemy.length || !near) return;

            let trap = gameObjects.filter(cd => cd.trap && cd.active && UTILS.getDist(cd, player, 0, 2) <= player.scale + cd.getScale() + 5 && !cd.isTeamObject(player)).sort(function (cd, ck) {
                return UTILS.getDist(cd, player, 0, 2) - UTILS.getDist(ck, player, 0, 2);
            })[0];

            if (!trap) return;

            if (near.dist2 <= near.scale + 75 && player.weapons[1] == 10 && (player.primaryIndex == 4 || player.primaryIndex == 5)) {
                if (this.canLastHit(near, trap)) {
                    if (this.fullReloaded() && (this.player.skins[7] && this.player.skins[40])) {
                        sendAutoGather();
                        buyEquip(40, 0);
                        selectWeapon(player.weapons[1]);

                        game.tickBase(() => {
                            buyEquip(7, 0);
                            selectWeapon(player.weapons[0]);

                            game.tickBase(() => {
                                buyEquip(53, 0);
                                sendAutoGather();
                            }, 1);
                        }, 1);
                        sendChat("shitty on worked trapticked");
                    }
                }
            }
        }
    }();
    // UPDATE PLAYER DATA:
    let AutoOneTicked = false;
    function updatePlayers(data) {
        game.tick++;
        enemy = [];
        nears = [];
        near = [];

        game.tickSpeed = performance.now() - game.lastTick;
        game.lastTick = performance.now();

        players.forEach((tmp) => {
            tmp.forcePos = !tmp.visible;
            tmp.visible = false;
        });

        for (let i = 0; i < data.length;) {
            _ = findPlayerBySID(data[i]);
            if (_) {
                _.t1 = (_.t2 === undefined) ? game.lastTick : _.t2;
                _.t2 = game.lastTick;
                _.oldPos.x2 = _.x2;
                _.oldPos.y2 = _.y2;
                _.x1 = _.x;
                _.y1 = _.y;
                _.x2 = data[i + 1];
                _.y2 = data[i + 2];
                _.x3 = _.x2 + (_.x2 - _.oldPos.x2);
                _.y3 = _.y2 + (_.y2 - _.oldPos.y2);
                _.d1 = (_.d2 === undefined) ? data[i + 3] : _.d2;
                _.d2 = data[i + 3];
                _.dt = 0;
                _.buildIndex = data[i + 4];
                _.weaponIndex = data[i + 5];
                _.weaponVariant = data[i + 6];
                _.team = data[i + 7];
                _.isLeader = data[i + 8];
                _.oldSkinIndex = _.skinIndex;
                _.oldTailIndex = _.tailIndex;
                _.skinIndex = data[i + 9];
                _.tailIndex = data[i + 10];
                _.iconIndex = data[i + 11];
                _.zIndex = data[i + 12];
                _.visible = true;
                _.update(game.tickSpeed);
                _.dist2 = UTILS.getDist(_, player, 2, 2);
                _.aim2 = UTILS.getDirect(_, player, 2, 2);
                _.dist3 = UTILS.getDist(_, player, 3, 3);
                _.aim3 = UTILS.getDirect(_, player, 3, 3);
                _.damageThreat = 0;

                if (_.sid == player.sid) _.onRiver = _.y2 >= config.mapScale / 2 - config.riverWidth / 2 && _.y2 <= config.mapScale / 2 + config.riverWidth / 2;

                if (_.skinIndex == 45 && _.shameTimer <= 0) {
                    _.addShameTimer();
                }
                if (_.oldSkinIndex == 45 && _.skinIndex != 45) {
                    _.shameTimer = 0;
                    _.shameCount = 0;
                    if (_ == player) {
                        healer();
                    }
                }

                if (_ == player) {

                    if (gameObjects.length) {
                        let nearTrap = gameObjects.filter(e => e.trap && e.active && UTILS.getDist(e, _, 0, 2) <= (_.scale + e.getScale() + 5) && !e.isTeamObject(_)).sort(function (a, b) {
                            return UTILS.getDist(a, _, 0, 2) - UTILS.getDist(b, _, 0, 2);
                        })[0];
                        if (nearTrap) {
                            traps.dist = UTILS.getDist(nearTrap, _, 0, 2);

                            let spike = gameObjects.filter(
                                obj =>
                                (obj.dmg) &&
                                UTILS.getDist(obj, nearTrap, 0, 0) < nearTrap.scale + obj.scale + 5 &&
                                !obj.isTeamObject(_) &&
                                obj.active
                            )[0];

                            traps.aim = UTILS.getDirect(spike ? spike : nearTrap, _, 0, 2);

                            if (!traps.inTrap && getEl("antiTrap").checked) {
                                traps.protect(UTILS.getDirect(nearTrap, _, 0, 2));
                            }

                            traps.inTrap = true;
                            traps.info = nearTrap;
                        } else {
                            traps.inTrap = false;

                            let tpshit = gameObjects.filter(e => (e.teleport || e.dmg) && e.active &&
                                                            UTILS.getDist(e, _, 0, 2) <= items.weapons[player.weapons[1] === 10 ? traps.notFast() ? player.weapons[1] : player.weapons[0] : player.weapons[0]].range + (_.scale + 35)
                                                            && !e.isTeamObject(_)).sort(function (a, b) {
                                return UTILS.getDist(a, _, 0, 2) - UTILS.getDist(b, _, 0, 2);
                            })[0];
                            if (tpshit) {
                                traps.dist = UTILS.getDist(tpshit, _, 0, 2);
                                traps.aim = UTILS.getDirect(tpshit, _, 0, 2);
                                traps.breakshit = true;
                                traps.info = tpshit;
                            } else {
                                traps.breakshit = false;
                                traps.info = {};
                            }
                        }
                    } else {
                        traps.inTrap = false;
                    }
                }

                if (_.weaponIndex < 9) {
                    _.primaryIndex = _.weaponIndex;
                    _.primaryVariant = _.weaponVariant;
                } else if (_.weaponIndex > 8) {
                    _.secondaryIndex = _.weaponIndex;
                    _.secondaryVariant = _.weaponVariant;
                }
            }
            i += 13;
        }

        getEl("pingDisp").innerHTML = "Ping: " + window.pingTime;
        getEl("playerShames").innerHTML = player.shameCount + " / 8";
        getEl("healstatusing").innerHTML = (AutoQ && player.health <= 50) ? "AutoQ" : "Ping";

        if (runAtNextTick.length) {
            runAtNextTick.forEach((tmp) => {
                checkProjectileHolder(...tmp);
            });
            runAtNextTick = [];
        }
        for (let i = 0; i < data.length;) {
            _ = findPlayerBySID(data[i]);
            if (_) {
                if (!_.isTeam(player)) {
                    enemy.push(_);
                    if (_.dist2 <= items.weapons[_.primaryIndex == undefined ? 5 : _.primaryIndex].range + (player.scale * 2)) {
                        nears.push(_);
                    }
                }
                _.manageReload();
                if (_ != player) {
                    _.addDamageThreat(player);
                    getEl("potDmg").innerHTML = _.addDamageThreat(player);
                }
            }
            i += 13;
        }
        if (player && player.alive) {
            if (enemy.length) {
                near = enemy.sort(function(tmp1, tmp2) {
                    return tmp1.dist2 - tmp2.dist2;
                })[0];
            }

            instaManager.tickBase();

            if (game.tickQueue[game.tick]) {
                game.tickQueue[game.tick].forEach((action) => {
                    action();
                });
                game.tickQueue[game.tick] = null;
            }

            if (advHeal.length) {
                advHeal.forEach((updHealth) => {
                    let sid = updHealth[0];
                    let value = updHealth[1];
                    let damaged = updHealth[2];
                    _ = findPlayerBySID(sid);
                    let bullTicked = false;
                    if (_ && _.health <= 0) {
                        if (!_.death) {
                            _.death = true;
                        }
                    }
                    if (_ == player) {
                        if (_.skinIndex == 7 && (damaged == 5 || (_.latestTail == 13 && damaged == 2))) {
                            if (my.reSync) {
                                my.reSync = false;
                                _.setBullTick = true;
                            }
                            bullTicked = true;
                        }
                        if (inGame) {
                            let attackers = getAttacker(damaged);
                            let gearDmgs = [0.25, 0.45].map((val) => val * items.weapons[player.weapons[0]].dmg * soldierMult());
                            let includeSpikeDmgs = !bullTicked && gearDmgs.includes(damaged);
                            let healTimeout = 90;
                            let slowHeal = function(timer) {
                                setTimeout(() => {
                                    healer();
                                }, timer);
                            }
                            if (damaged >= (includeSpikeDmgs ? 8 : 20) && _.damageThreat >= 25 && (game.tick - _.antiTimer) > 1) {
                                _.canEmpAnti = true;
                                _.antiTimer = game.tick;
                                let shame = 5;
                                if (_.shameCount < shame) {
                                    healer();
                                } else {
                                    slowHeal(healTimeout);
                                }
                            } else {
                                slowHeal(healTimeout);
                            }
                            if (damaged >= 20 && player.skinIndex == 11) instaC.canCounter = true;
                        }
                    } else {
                        if (!_.setPoisonTick && (_.damaged == 5 || (_.latestTail == 13 && _.damaged == 2))) {
                            _.setPoisonTick = true;
                        }
                    }
                });
                advHeal = [];
            }
            players.forEach((tmp) => {
                if (!tmp.visible && player != tmp) {
                    tmp.reloads = {
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
                }
                if (tmp.setBullTick) {
                    tmp.bullTimer = 0;
                }
                if (tmp.setPoisonTick) {
                    tmp.poisonTimer = 0;
                }
                tmp.updateTimer();
            });
            if (inGame) {
                if (enemy.length) {
                    if (player.canEmpAnti) {
                        player.canEmpAnti = false;
                        if (near.dist2 <= 300 && !my.safePrimary(near) && !my.safeSecondary(near)) {
                            if (near.reloads[53] == 0) {
                                player.empAnti = true;
                                player.soldierAnti = false;
                                //modLog("EmpAnti");
                            } else {
                                player.empAnti = false;
                                player.soldierAnti = true;
                                //modLog("SoldierAnti");
                            }
                        }
                    }
                    if (!instaC.isTrue && getEl("predicTick").checked && my.anti0Tick <= 0) {
                        let spikeSync = knockBackPredict()
                        if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                            instaC.changeType(getEl("revTick").checked || player.weapons[1] == 10 ? "rev" : "normal");
                        }
                    }
                    let preHit = gameObjects.filter(tmp => tmp.dmg && tmp.active && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (preHit && getEl("predicTick").checked) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                            instaC.canSpikeTick = true;
                            instaC.syncHit = true;
                            if (getEl("revTick").checked && player.weapons[1] == 15 && player.reloads[53] == 0 && instaC.perfCheck(player, near)) {
                                instaC.revTick = true;
                            }
                        }
                    }

                    if (!my.anti0tick) {
                        let possiblePreHitSync = gameObjects.find(
                            (tmp) =>
                            tmp.dmg &&
                            tmp.active &&
                            !tmp.isTeamObject(player) &&
                            UTILS.getDist(tmp, player, 0, 3) <= tmp.scale + 45
                        );
                        let possibleHitSync = gameObjects.find(
                            (tmp) =>
                            tmp.dmg &&
                            tmp.active &&
                            !tmp.isTeamObject(player) &&
                            UTILS.getDist(tmp, player, 0, 2) <= tmp.scale + 35
                        );
                        if (possibleHitSync && near.sid && near.reloads[near.weaponIndex] == 0 && near.dist2 <= (items.weapons[near.weapons[0]].range + 70) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                            sendChat("Counter HitSync");
                        }
                        if (possiblePreHitSync && near.reloads[near.weaponIndex] <= game.tickRate && near.dist2 <= (items.weapons[near.weapons[0]].range + 100) && ([4, 5].includes(near.primaryIndex) || (near.weaponIndex == 3 && (game.tick - player.bullTick) % 9 === 8))) {
                            my.anti0tick = 1;
                            sendChat("Counter PrehitSync");
                        }
                    }
                    let antiSpikeTick = gameObjects.filter(tmp => tmp.dmg && tmp.active && !tmp.isTeamObject(player) && UTILS.getDist(tmp, player, 0, 3) < (tmp.scale + player.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2);
                    })[0];
                    if (antiSpikeTick && traps.inTrap) {
                        if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                            my.anti0Tick = 1;
                            sendChat("Restricted SG (7)");
                        }
                    }
                    if (antiSpikeTick && !traps.inTrap && !traps.breakshit) {
                        if (near.dist2 <= items.weapons[5].range + near.scale * 1.8) {
                            my.anti0Tick = 1;
                            sendChat("Restricted SG (1)");
                        }
                        else if (!traps.inTrap && !traps.breakshit && near.dist2 <= items.weapons[5].range + (antiSpikeTick.scale * 1.8)) {
                            my.anti0Tick = 1;
                        }
                    }
                }
                if (bianosTick && !traps.inTrap && !traps.breakshit) {
                    instaC.spikeTickType();
                }
                if((game.tick - near.bullTick) % 9 == 0 && near.skinIndex == 7) {
                    sendChat("");
                    bultect = true;
                    game.tickBase(() => {
                        bultect = false;
                    }, 1)
                }
                if ((getEl("autoinsta").checked ? true : ((player.checkCanInsta(true) >= 100 ? player.checkCanInsta(true) : player.checkCanInsta(false)) >= (player.weapons[1] == 10 ? 95 : 100))) && near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && (instaC.wait || (getEl("autoinsta").checked && Math.floor(Math.random() * 5) == 0)) && !instaC.isTrue && !my.waitHit && player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0 && (getEl("autoinsta").checked ? true : getEl("oneShot").checked ? (player.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate)) : true) && instaC.perfCheck(player, near)) {
                    instaC.can = true;
                } else {
                    instaC.can = false;
                }


                macro.q && place(0, getAttackDir());
                macro.f && place(4, getSafeDir());
                macro.v && place(2, getSafeDir());
                macro.y && place(5, getSafeDir());
                macro.h && place(player.getItemType(22), getSafeDir());
                macro.n && place(3, getSafeDir());
                if (game.tick % .5 == 0) {
                    if (mills.place) {
                        let plcAng = 1.25;
                        for (let i = -plcAng; i <= plcAng; i += plcAng) {
                            checkPlace(3, UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                        }
                    } else {
                        if (mills.placeSpawnPads) {
                            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                                checkPlace(player.getItemType(20), UTILS.getDirect(player.oldPos, player, 2, 2) + i);
                            }
                        }
                    }
                }
                if (instaC.can) {
                    instaC.changeType(player.weapons[1] == 10 ? "rev" : instaC.nobull ? "nobull" : "normal");
                }
                if (instaC.canCounter) {
                    instaC.canCounter = false;
                    if (player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                        instaC.counterType();
                    }
                }
                if (instaC.canSpikeTick) {
                    instaC.canSpikeTick = false;
                    if (instaC.revTick) {
                        instaC.revTick = false;
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[1]] == 0 && !instaC.isTrue) {
                            instaC.changeType("rev");
                            textManager.showText(player.x, player.y, 30, 0.15, 1850, 'RevSyncHit', '#7289DA', 2);
                        }
                    } else {
                        if ([1, 2, 3, 4, 5, 6].includes(player.weapons[0]) && player.reloads[player.weapons[0]] == 0 && !instaC.isTrue) {
                            instaC.spikeTickType();
                            if (instaC.syncHit) {
                                textManager.showText(player.x, player.y, 30, 0.15, 1850, 'VelSyncHit', '#7289DA', 2);
                            }
                        }
                    }
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                }

                if (getEl("autoBullSpam").checked && !clicks.left && !clicks.right && !instaC.isTrue && near.dist2 <= (items.weapons[player.weapons[0]].range + near.scale * 1.8) && !traps.inTrap) {
                    if ((player.weaponIndex != player.weapons[0]) || player.buildIndex > -1) {
                        selectWeapon(player.weapons[0]);
                    }
                    autoBull.active = 1;
                    if (player.reloads[player.weapons[0]] == 0 && !my.waitHit) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            autoBull.active = 0;
                            sendAutoGather();
                            my.waitHit = 0;
                        }, 1);
                    }
                } else {
                    autoBull.active = 0;
                }

                if (traps.inTrap || traps.breakshit) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        if (player.weaponIndex != (traps.notFast() ? player.weapons[1] : player.weapons[0]) || player.buildIndex > -1) {
                            selectWeapon(traps.notFast() ? player.weapons[1] : player.weapons[0]);
                        }
                        if (player.reloads[traps.notFast() ? player.weapons[1] : player.weapons[0]] == 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                            }, 1);
                        }
                    }
                }
                // ANTI BOOST TICK SHIELD:
                if (traps.inTrap) { // intrap autobreak
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        let targetWeapon = traps.notFast() ? player.weapons[1] : player.weapons[0];
                        if (player.weaponIndex !== targetWeapon || player.buildIndex > -1) {
                            selectWeapon(targetWeapon);
                        }
                        if (player.reloads[targetWeapon] === 0 && !my.waitHit) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                sendAutoGather();
                                my.waitHit = 0;
                            }, 1);
                        }

                        let weaponRange = items.weapons[targetWeapon].range;
                        let spike = gameObjects.find(obj => {
                            const dist = UTILS.getDist(obj, player, 0, 2);
                            return obj.dmg && obj.active && !obj.isTeamObject(player) && dist <= weaponRange + obj.scale;
                        });

                        if (keys["Shift"]) {
                            let trapObj = gameObjects.find(obj => obj.trap && obj.active && !obj.isTeamObject(player));
                            if (trapObj) spike = trapObj;
                        }

                        if (spike) {
                            traps.aim = UTILS.getDirect(spike, player, 0, 2);
                        }
                    }
                }
                if (!instaC.isTrue && !traps.inTrap) {
                    if (clicks.middle && !traps.inTrap) {
                        if (player.reloads[player.weapons[1]] == 0) {
                            if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                                instaC.bowMovement();
                            } else {
                                instaC.rangeType();
                            }
                        }
                    }
                }

                instaManager.holdModeOT = !instaC.isTrue && !traps.inTrap && oneTickKeys.some((key) => macro[key]);
                instaManager.drive();

                if (player.weapons[1] && !clicks.left && !clicks.right && !traps.inTrap && !traps.breakshit && !instaC.isTrue && !instaManager.steering &&
                    !(autoBull.active && near.dist2 <= items.weapons[player.weapons[0]].range + near.scale * 1.8)) {
                    if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] == 0) {
                        if (!my.reloaded) {
                            my.reloaded = true;
                            let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                            if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[fastSpeed]);
                            }
                        }
                    } else {
                        my.reloaded = false;
                        if (player.reloads[player.weapons[0]] > 0) {
                            if (player.weaponIndex != player.weapons[0] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[0]);
                            }
                        } else if (player.reloads[player.weapons[0]] == 0 && player.reloads[player.weapons[1]] > 0) {
                            if (player.weaponIndex != player.weapons[1] || player.buildIndex > -1) {
                                selectWeapon(player.weapons[1]);
                            }
                        }
                    }
                }
                function predictHat(isforshitpeoplehavelazybraintotimeatick) {
                    for (let i = 0; i < nears.length; i++) {
                        if (reloadPercent(nears[i], nears[i].primaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].primaryIndex) <= 0.95 || reloadPercent(nears[i], nears[i].secondaryIndex) >= 0.9 && reloadPercent(nears[i], nears[i].secondaryIndex) <= 0.95) {
                            nears.push([i]);
                        }
                    }
                }

                let oneticked = instaManager.autoOneTick();
                let antiOneticked = false;
                if (!oneticked && player.skinIndex != 53) {
                    for (let i = 0; i < enemy.length; i++) {
                        const tmpPlayer = enemy[i];
                        if (tmpPlayer.skinIndex == 53) {
                            if ((tmpPlayer.primaryIndex == undefined || tmpPlayer.primaryVariant >= 2 && tmpPlayer.primaryIndex == 5 && tmpPlayer.reloads[tmpPlayer.primaryIndex] < 111) && (Math.abs(tmpPlayer.dist2 - 245) <= 40 || tmpPlayer.dist3 <= 300 && tmpPlayer.boosted)) {
                                antiOneticked = true;
                                buyEquip(6, 0);
                                my.anti0Tick = 2;
                                sendChat("Counter Tick");
                            }
                        }
                    }
                }
                if (!instaC.isTrue && !traps.inTrap && !traps.replaced && getEl("autoplace").checked) {
                    traps.autoPlace();
                }
                if (!instaC.isTrue && !traps.inTrap && !traps.breakshit && !traps.replaced) {
                    if (configs.AutoTrapHammerTickEvent) {
                        trapTick.run(enemy, near);
                    }
                    traps.autoPlace();
                }
                if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
                    packet("D", getAttackDir());
                }

                let hatChanger = function () {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !traps.inTrap && !traps.breakshit && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (my.anti0Tick > 0) {
                        buyEquip(6, 0);
                    } else if (configs.bushGear && Date.now() - player.moveTime > 1234 && player.health == 100 && Date.now() - player.lastHit > 1234 && Date.now() - player.lastGather > 1234 && !my.waitHit) {
                        buyEquip(56, 0)
                    } else if (near.skinIndex === 53 && near.dist2 <= 435) {
                        sendChat("");
                    } else {
                        if (clicks.left || clicks.right) {
                            if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                buyEquip(7, 0);
                            } else {
                                if (clicks.left) {
                                    buyEquip(player.reloads[player.weapons[0]] == 0 ? getEl('weaponGrind').checked ? 40 : 7 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : 6, 0);
                                } else if (clicks.right) {
                                    buyEquip(player.reloads[clicks.right && player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0 ? 40 : player.empAnti ? 22 : player.soldierAnti ? 6 : configs.HKH && canSafeHitback ? 11 : near.dist2 <= 275 ? getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0 && (player.weapons[0] == 4 || player.weapons[0] == 3) && near.primaryIndex != 5 ? 6 : 6 : biomeGear(1, 1), 0);
                                }
                            }
                        } else if (traps.inTrap || traps.breakshit) {
                            if (traps.info.health <= items.weapons[player.weaponIndex].dmg ? false : player.reloads[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]] == 0) {
                                buyEquip(40, 0);
                            } else {
                                if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 7 || 0 && player.skinIndex != 45) || my.reSync) &&
                                    ((near && near.dist2 > 140) || !near)) {
                                    buyEquip(6, 0);
                                    setTimeout(() => {
                                        buyEquip(7, 0);
                                    }, 120);
                                } else {
                                    buyEquip((player.empAnti || near.dist2 > 300 || !enemy.length ? 22 : 6), 0);
                                }
                            }
                        } else {
                            if (player.empAnti || player.soldierAnti) {
                                buyEquip(player.empAnti ? 22 : 6, 0);
                            } else {
                                if (((player.shameCount > 0 && (game.tick - player.bullTick) % config.serverUpdateRate === 0 && player.skinIndex != 45) || my.reSync) && ((near && near.dist2 > 140) || !near)) {
                                    buyEquip(7, 0);
                                    setTimeout(() => {
                                        buyEquip(7, 0);
                                    }, 120);
                                } else {
                                    if (near.dist2 <= 275) {
                                        const shitassautism1 = configs.antidaggerrsrsrsr && (near.primaryIndex === 7 || near.primaryIndex === 8);
                                        const autismakh = configs.HKH && canSafeHitback ? 11 : getEl('antiBullType').value == 'abalway' && near.reloads[near.primaryIndex] == 0

                                        buyEquip(shitassautism1 ? 26 : 6, 0);
                                    } else {
                                        biomeGear(1);
                                    }
                                }
                            }
                        }
                    }
                };


                let accChanger = function() {
                    let NearHasOneFrame = near.primaryVariant >= 1 && near.weapons[0] == 5
                    let PolOrKat = player.weapons[0] === 4 || player.weapons[0] === 5
                    let canSafeHitback = PolOrKat && !traps.inTrap && !traps.breakshit && player.shameCount <= 4 && !NearHasOneFrame && !antispiketicked && !safewalking
                    if (instaC.can && player.checkCanInsta(true) >= 100) {
                        // buyEquip(19, 1);
                    } else if (clicks.left) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 100);
                    } else if (clicks.right) {
                        setTimeout(() => {
                            buyEquip(19, 1);
                        }, 50);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit && player.weapons[0] == 7) {
                        buyEquip(11, 1);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit) {
                        buyEquip(19, 1);
                    } else if (near.dist2 <= 350 && !traps.inTrap && !traps.breakshit && configs.HKH && player.skinIndex == 11) {
                        buyEquip(19, 1);
                    } else {
                        traps.inTrap ? buyEquip(19, 1) : buyEquip(11, 1);
                    }
                };
                if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                    hatChanger();
                    accChanger();
                }

                if (enemy.length && !traps.inTrap && !instaC.ticking) {
                    autoPush();
                } else {
                    if (my.autoPush) {
                        my.autoPush = false;
                        packet("9", lastMoveDir || undefined, 1);
                    }
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
                if (player.soldierAnti) {
                    player.soldierAnti = false;
                }
                if (my.anti0Tick > 0) {
                    my.anti0Tick--;
                }
                if (traps.replaced) {
                    traps.replaced = false;
                }
                if (traps.antiTrapped) {
                    traps.antiTrapped = false;
                }
            }
        }
    }

    // UPDATE LEADERBOARD:
    function updateLeaderboard(data) {
        lastLeaderboardData = data;
        UTILS.removeAllChildren(leaderboardData);

        let tmpC = 1;
        for (let i = 0; i < data.length; i += 3) {
            const SID = data[i];
            const playerName = data[i + 1] || "unknown";
            const playerScore = UTILS.sFormat(data[i + 2]) || "0";

            const displayName = playerName.length > 15 ? "long name man" : playerName;

            const fragment = document.createDocumentFragment();
            const leaderHolder = UTILS.generateElement({
                class: "leaderHolder",
                children: [
                    UTILS.generateElement({
                        class: "leaderboardItem",
                        style: `color: ${playerSID === SID ? "#fff" : "rgba(255,255,255,0.6)"}`,
                        text: `${tmpC}. ${displayName}`
                    }),
                    UTILS.generateElement({
                        class: "leaderScore",
                        text: playerScore
                    })
                ]
            });
            fragment.appendChild(leaderHolder);
            leaderboardData.appendChild(fragment);

            tmpC++;
        }
    }

    // LOAD GAME OBJECT:
    function loadGameObject(data) {
        for (let i = 0; i < data.length;) {
            objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
                              data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
                sid: data[i + 7]
            } : null));
            i += 8;
        }
    }

    // ADD AI:
    function loadAI(data) {
        for (let i = 0; i < ais.length; ++i) {
            ais[i].forcePos = !ais[i].visible;
            ais[i].visible = false;
        }
        if (data) {
            let tmpTime = performance.now();
            for (let i = 0; i < data.length;) {
                _ = findAIBySID(data[i]);
                if (_) {
                    _.index = data[i + 1];
                    _.t1 = (_.t2 === undefined) ? tmpTime : _.t2;
                    _.t2 = tmpTime;
                    _.x1 = _.x;
                    _.y1 = _.y;
                    _.x2 = data[i + 2];
                    _.y2 = data[i + 3];
                    _.d1 = (_.d2 === undefined) ? data[i + 4] : _.d2;
                    _.d2 = data[i + 4];
                    _.health = data[i + 5];
                    _.dt = 0;
                    _.visible = true;
                } else {
                    _ = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                    _.x2 = _.x;
                    _.y2 = _.y;
                    _.d2 = _.dir;
                    _.health = data[i + 5];
                    if (!aiManager.aiTypes[data[i + 1]].name) _.name = config.cowNames[data[i + 6]];
                    _.forcePos = true;
                    _.sid = data[i];
                    _.visible = true;
                }
                i += 7;
            }
        }
    }

    // ANIMATE AI:
    function animateAI(sid) {
        _ = findAIBySID(sid);
        if (_) _.startAnim();
    }

    function gatherAnimation(sid, didHit, index) {
        _ = findPlayerBySID(sid);
        if (_) {
            _.startAnim(didHit, index);
            _.gatherIndex = index;
            _.gathering = 1;
            if (didHit) {
                let _ects = objectManager.hitObj;
                objectManager.hitObj = [];

                game.tickBase(() => {
                    _ = findPlayerBySID(sid);
                    let val = items.weapons[index].dmg * (config.weaponVariants[_[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (_.skinIndex == 40 ? 3.3 : 1);
                    _ects.forEach((healthy) => {
                        healthy.health -= val;
                    });
                }, 1);
            }
        }

    }
    // WIGGLE GAME OBJECT:
    function wiggleGameObject(dir, sid) {
        _ = findObjectBySid(sid);
        if (_) {
            _.xWiggle += config.gatherWiggle * Math.cos(dir);
            _.yWiggle += config.gatherWiggle * Math.sin(dir);
            if (_.health) {
                //_.damaged = Math.min(255, _.damaged + 60);
                objectManager.hitObj.push(_);
            }
        }
    }
    // SHOOT TURRET:
    function shootTurret(sid, dir) {
        _ = findObjectBySid(sid);
        if (_) {
            _.dir = dir;
            _.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
            _.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
        }
    }
    // UPDATE PLAYER VALUE:
    function updatePlayerValue(index, value, updateView,) {
        if (player) {
            player[index] = value;

            if (index == "points") {
                autoBuy.hat();
                autoBuy.acc();
            } else if (index == "kills") {
                sendChat(`!Deleted by lvwercia_`);
            }
        }
    }
    // ACTION BAR:
    function updateItems(data, wpn) {
        if (data) {
            if (wpn) {
                player.weapons = data;
                player.primaryIndex = player.weapons[0];
                player.secondaryIndex = player.weapons[1];
                if (!instaC.isTrue) {
                    selectWeapon(player.weapons[0]);
                }
            } else {
                player.items = data;
            }
        }
        for (let i = 0; i < items.list.length; i++) {
            let tmpI = items.weapons.length + i;
            getEl("actionBarItem" + tmpI).style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
        }
        for (let i = 0; i < items.weapons.length; i++) {
            getEl("actionBarItem" + i).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
        }
        let kms = player.weapons[0] == 3 && player.weapons[1] == 15;
        if (kms) {
            getEl("actionBarItem3").style.display = "none";
            getEl("actionBarItem4").style.display = "inline-block";
        }
    }
    // ADD PROJECTILE:
    function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
        projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer, inWindow).sid = sid;
        runAtNextTick.push(Array.prototype.slice.call(arguments));
    }
    // RENDER PLAYERS:
    function renderDeadPlayers(xOffset, yOffset) {
        // Update CI-based death animations and render them
        h3();
        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = outlineColor;
        for (let i = 0; i < Ci.length; i++) {
            const t = Ci[i];
            if (!t.deathAnim) continue;
            mainContext.save();
            mainContext.translate((t.x || t.x2 || 0) - xOffset, (t.y || t.y2 || 0) - yOffset);
            if (t.d2) mainContext.rotate(t.d2);
            renderDeadPlayer(t, mainContext);
            mainContext.restore();
        }
    }
    // REMOVE PROJECTILE:
    function remProjectile(sid, range) {
        for (let i = 0; i < projectiles.length; ++i) {
            if (projectiles[i].sid == sid) {
                projectiles[i].range = range;
                let _ects = objectManager.hitObj;
                objectManager.hitObj = [];
                game.tickBase(() => {
                    let val = projectiles[i].dmg;
                    _ects.forEach((healthy) => {
                        if (healthy.projDmg) {
                            healthy.health -= val;
                        }
                    });
                }, 1);
            }
        }
    }

    // SHOW ALLIANCE MENU:
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
            type ? player.latestTail = id : player.tails[id] = 1;
        } else {
            !type ? (player.skins[id] = 1, id === 7 && (my.reSync = true)) : player.latestSkin = id;
        }
    }

    // SEND MESSAGE:
    function receiveChat(sid, message) {
        var tmpPlayer = findPlayerBySID(sid);

        if (tmpPlayer) {
            tmpPlayer.chatMessage = message;
            tmpPlayer.chatCountdown = config.chatCountdown;
        }
    }

    // MINIMAP:
    function updateMinimap(data) {
        minimapData = data;
    }

    // SHOW ANIM TEXT:
    function showText(x, y, value, type) {
        textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value>=0)?"#fff":"#8ecc51");
    }

    // RENDER LEAF:
    function renderLeaf(x, y, l, r, ctxt) {
        let endX = x + (l * Math.cos(r));
        let endY = y + (l * Math.sin(r));
        let width = l * 0.4;
        ctxt.moveTo(x, y);
        ctxt.beginPath();
        ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
                              ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
        ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
                              ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
        ctxt.closePath();
        ctxt.fill();
        ctxt.stroke();
    }
    // RENDER CIRCLE:
    function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
        tmpContext = tmpContext || be;
        tmpContext.beginPath();
        tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
        if (!dontFill) tmpContext.fill();
        if (!dontStroke) tmpContext.stroke();
    }
    function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
        tmpContext = tmpContext || be;
        tmpContext.beginPath();
        tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
        if (!dontFill) tmpContext.fill();
        if (!dontStroke) tmpContext.stroke();
    }

    // RENDER STAR SHAPE:
    function renderStar(ctxt, spikes, outer, inner) {
        let rot = Math.PI / 2 * 3;
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

    function renderHealthStar(ctxt, spikes, outer, inner) {
        let rot = Math.PI / 2 * 3;
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
        if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
        if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
    }
    function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
        if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
        if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
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
        let rot = Math.PI / 2 * 3;
        let x, y;
        let step = Math.PI / spikes;
        let tmpOuter;
        ctxt.beginPath();
        ctxt.moveTo(0, -inner);
        for (let i = 0; i < spikes; i++) {
            tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
            ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
                                  Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
            rot += step * 2;
        }
        ctxt.lineTo(0, -inner);
        ctxt.closePath();
    }

    // RENDER TRIANGLE:
    function renderTriangle(s, ctx) {
        ctx = ctx || be;
        let h = s * (Math.sqrt(3) / 2);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(-s / 2, h / 2);
        ctx.lineTo(s / 2, h / 2);
        ctx.lineTo(0, -h / 2);
        ctx.fill();
        ctx.closePath();
    }

    // RENDER PLAYERS:
    function renderPlayers(f, d, zIndex) {
        be.globalAlpha = 1;
        be.fillStyle = "#91b2db";
        for (var i = 0; i < players.length; ++i) {
            _ = players[i];
            if (_.zIndex == zIndex) {
                _.animate(delta);
                if (_.visible) {
                    _.skinRot += (0.002 * delta);
                    let mekeD = (getEl("visS").checked && (getEl("visStyles").value == "wasd" || getEl("visStyles").value == "rv") && _==player) ? (getEl("visS").checked && getEl("visStyles").value == "wasd" ? getSafeDir() : getVisualDir()) : (_.dir || 0);
                    tmpDir = mekeD;
                    be.save();
                    be.translate(_.x - f, _.y - d);
                    // RENDER PLAYER:
                    be.rotate(tmpDir + _.dirPlus);
                    renderPlayer(_, be);
                    be.restore();
                }
            }
        }
    }
    // RENDER PLAYER:
    function renderPlayer(obj, ctxt) {
        ctxt = ctxt || be;
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";

        let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS||1);
        let oHandAngle = (obj.buildIndex < 0)?(items.weapons[obj.weaponIndex].hndS||1):1;
        let oHandDist = (obj.buildIndex < 0)?(items.weapons[obj.weaponIndex].hndD||1):1;

        let katanaMusket = (obj.weapons[0] == 3 && obj.weapons[1] == 15);

        // TAIL/CAPE:
        if (obj.tailIndex > 0) {
            renderTail(obj.tailIndex, ctxt, obj);
        }

        // WEAPON BELLOW HANDS:
        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0,
                                 items.projectiles[items.weapons[obj.weaponIndex].projectile], be);
            }
        }

        // HANDS:
        ctxt.fillStyle = config.skinColors[obj.skinColor];
        renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
        renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
                     (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

        // WEAPON ABOVE HANDS:
        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                renderProjectile(obj.scale, 0,
                                 items.projectiles[items.weapons[obj.weaponIndex].projectile], be);
            }
        }

        // BUILD ITEM:
        if (obj.buildIndex >= 0) {
            var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
            ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
        }

        // BODY:
        renderCircle(0, 0, obj.scale, ctxt);

        // SKIN:
        if (obj.skinIndex > 0) {
            ctxt.rotate(Math.PI/2);
            renderSkin(obj.skinIndex, ctxt, null, obj);
        }

    }
    // RENDER SKIN:
    function renderTextureSkin(index, ctxt, parentSkin, owner) {
        if (!(tmpSkin = skinSprites[index + (txt ? "lol" : 0)])) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = getTexturePackImg(index, "hat", index),
                skinSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage
        }
        var tmpObj = parentSkin || skinPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    tmpObj = hats[i];
                    break;
                }
            }
            skinPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded)
            ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
        if (!parentSkin && tmpObj.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, tmpObj, owner);
            ctxt.restore();
        }
    }
    var newHatImgs = {
        6: "http://i.imgur.com/L6L0Q0l.png",
        7: "https://i.imgur.com/EBzS6kP.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        50:"https://i.imgur.com/tdkcow1.png",
        12: "https://i.imgur.com/uQHU4zc.png",
        40: "https://i.imgur.com/hMdtMlU.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
        55: "https://i.imgur.com/gGGkBnz.png",
        20: "https://i.imgur.com/f5uhWCk.png",
        11: "https://i.imgur.com/yfqME8H.png",
        22: "http://i.imgur.com/CoeJltc.png",
        58: "https://i.imgur.com/uYgDtcZ.png",
        23: "https://i.imgur.com/V8JrIwv.png",
        52: "https://i.imgur.com/hmJrVQz.png",
        53: "https://imgur.com/a/vugtA7z",
    };
    var newAccImgs = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    var emeraldSprites = {
        "hand axe": "https://i.imgur.com/99Xb4Lm.png",
        bat: "https://i.imgur.com/VlQlb1Z.png",
        "hunting bow": "https://i.imgur.com/2aW8Wmw.png",
        crossbow: "https://i.imgur.com/2JWfFFW.png",
        "repeater crossbow": "https://i.imgur.com/JuLVN8T.png",
        daggers: "https://i.imgur.com/4VedRsh.png",
        "mc grabby": "https://i.imgur.com/F1qfrLj.png",
        "great axe": "https://i.imgur.com/kGbXWqw.png",
        "great hammer": "https://i.imgur.com/6qCSFSZ.png",
        "tool hammer": "https://i.imgur.com/xnVbXSB.png",
        katana: "https://i.imgur.com/AZP6Aci.png",
        stick: "https://i.imgur.com/NbSpR2M.png",
        polearm: "https://i.imgur.com/HtWa9ez.png",
        "short sword": "https://i.imgur.com/gmrPsRk.png",
    };
    var newWeaponImgs = {
        sword_1: "https://i.imgur.com/nzy3kz1.png",
        sword_1_g: "https://i.imgur.com/wOTr8TG.png",
        sword_1_d: "https://i.imgur.com/k3eCuYF.png",
        sword_1_r: "https://i.imgur.com/V9dzAbF.png",
        samurai_1: "https://i.imgur.com/PUTTmVS.png",
        samurai_1_g: "https://i.imgur.com/QKBc2ou.png",
        samurai_1_d: "https://i.imgur.com/4ZxIJQM.png",
        //samurai_1_r: "removed cuz broken...",
        spear_1: "https://i.imgur.com/mcI9MTd.png",
        spear_1_g: "https://i.imgur.com/jKDdyvc.png",
        spear_1_d: "https://i.imgur.com/HSWcyku.png",
        spear_1_r: "https://i.imgur.com/UY7SV7j.png",
        great_hammer_1: "https://i.imgur.com/CVCwqES.png",
        great_hammer_1_d: "https://i.imgur.com/Fg93gj3.png",
        great_hammer_1_r: "https://i.imgur.com/tmUzurk.png",
        bat_1_g: "https://i.imgur.com/ivLPh10.png",
        bat_1_d: "https://i.imgur.com/phXTNsa.png",
        bat_1_r: "https://i.imgur.com/6ayjbIz.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        stick_1_g: "https://i.imgur.com/NOaBBRd.png",
        stick_1_d: "https://i.imgur.com/RnkmWgs.png",
        stick_1_r: "https://i.imgur.com/aEs3FSU.png",
        great_axe_1_d: "https://i.imgur.com/aAJyHBB.png",
        great_axe_1_r: "https://i.imgur.com/UZ2HcQw.png",
        axe_1_d: "https://i.imgur.com/OU5os0h.png",
        axe_1_r: "https://i.imgur.com/kr8H9g7.png",
        dagger_1_d: "https://i.imgur.com/ROTb7Ks.png",
        dagger_1_r: "https://i.imgur.com/CDAmjux.png",
        hammer_1: "https://i.imgur.com/0XKpSVI.png",
        hammer_1_d: "https://i.imgur.com/WPWU8zC.png",
        hammer_1_r: "https://i.imgur.com/oRXUfW8.png",
        bow_1: "https://i.imgur.com/Dgv1gZm.png",

    };
    var newAnimalImgs = {
        pig_1: "https://i.imgur.com/Nu06zyW.png",
        wolf_2: "https://i.imgur.com/wANrStd.png",
        wolf_1: "https://i.imgur.com/KfFOjKk.png",
        bull_2: "https://i.imgur.com/LwsVi4x.png",
        bull_1: "https://i.imgur.com/eKlFlSj.png",
        chicken_1: "https://i.imgur.com/3dsSBa2.png",
        enemy: "https://i.imgur.com/MKOvEr6.png",
        cow_1: "https://i.imgur.com/7kuCRCr.png",
    };

    function getTexturePackImg(id, type, id2, sprite) {
        if (newHatImgs[id] && type == "hat") {
            return newHatImgs[id];
        } else if (newAccImgs[id] && type == "acc") {
            return newAccImgs[id];
        } else if (newWeaponImgs[id] && type == "weapon") {
            return newWeaponImgs[id];
        } else if (newAnimalImgs[id] && type == "animal") {
            return newAnimalImgs[id];
        } else if (type == "acc") {
            return ".././img/accessories/access_" + id + ".png";
        } else if (type == "hat") {
            return ".././img/hats/hat_" + id + ".png";
        } else if (type == "weapon") {
            return ".././img/weapons/" + id + ".png";
        } else if (type == "animal") {
            return ".././img/animals/" + id + ".png";
        }
    }
    // RENDER SKINS:
    let skinSprites = {};
    let skinPointers = {};
    let tmpSkin;

    function renderSkin(index, ctxt, parentSkin, owner) {
        tmpSkin = skinSprites[index];
        if (!tmpSkin) {
            let tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
            skinSprites[index] = tmpImage;
            tmpSkin = tmpImage;
        }
        let _ = parentSkin || skinPointers[index];
        if (!_) {
            for (let i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    _ = hats[i];
                    break;
                }
            }
            skinPointers[index] = _;
        }
        if (tmpSkin.isLoaded) ctxt.drawImage(tmpSkin, -_.scale / 2, -_.scale / 2, _.scale, _.scale);
        if (!parentSkin && _.topSprite && index != 11) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, _, owner);
            ctxt.restore();
        }
    }

    // RENDER TAIL:
    var FlareZAcc = {
        18: "http://i.imgur.com/1eGwp3R.png",
        21: "http://i.imgur.com/PvZNc9Q.png",
        19: "https://i.imgur.com/tgfyha4.png",
    };
    function setTailTextureImage(id, type, id2) {
        if (true) {
            if(FlareZAcc[id] && type == "acc") {
                return FlareZAcc[id];
            } else {
                if(type == "acc") {
                    return ".././img/accessories/access_" + id + ".png";
                } else if(type == "hat") {
                    return ".././img/hats/hat_" + id + ".png";
                } else {
                    return ".././img/weapons/" + id + ".png";
                }
            }
        } else {
            if(type == "acc") {
                return ".././img/accessories/access_" + id + ".png";
            } else if(type == "hat") {
                return ".././img/hats/hat_" + id + ".png";
            } else {
                return ".././img/weapons/" + id + ".png";
            }
        }
    }
    function renderTailTextureImage(index, ctxt, owner) {
        if (!(tmpSkin = accessSprites[index + (txt ? "lol" : 0)])) {
            var tmpImage = new Image();
            tmpImage.onload = function() {
                this.isLoaded = true,
                    this.onload = null
            }
                ,
                tmpImage.src = setTailTextureImage(index, "acc"),//".././img/accessories/access_" + index + ".png";
                accessSprites[index + (txt ? "lol" : 0)] = tmpImage,
                tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff||0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale/2), -(tmpObj.scale/2), tmpObj.scale, tmpObj.scale);
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
            tmpImage.onload = function() {
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
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }

    var accessSprites2 = {};
    var accessPointers2 = {};
    function renderTail2(index, ctxt, owner) {
        tmpSkin = accessSprites2[index];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function() {
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
            ctxt.translate(-20 - (tmpObj.xOff||0), 0);
            if (tmpObj.spin)
                ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale/2), -(tmpObj.scale/2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }


    // RENDER TOOL:
    let toolSprites = {};
    function renderTool(obj, variant, x, y, ctxt) {
        let tmpSrc = obj.src + (variant || "");
        let tmpSprite = toolSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            //tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            tmpSprite.src = getTexturePackImg(tmpSrc, "weapon", variant, obj);
            toolSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - obj.length / 2, y + obj.yOff - obj.width / 2, obj.length, obj.width);
    }

    // RENDER PROJECTILES:
    function renderProjectiles(layer, xOffset, yOffset) {
        for (let i = 0; i < projectiles.length; i++) {
            tmpObj = projectiles[i];
            if (tmpObj.active && tmpObj.layer == layer && tmpObj.inWindow) {
                tmpObj.update(delta);
                if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                    mainContext.save();
                    mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.rotate(tmpObj.dir);
                    renderProjectile(0, 0, tmpObj, mainContext, 1);
                    mainContext.restore();
                }
            }
        };
    }

    // RENDER PROJECTILE:
    let projectileSprites = {};//fz iz zexy

    function renderProjectile(x, y, obj, ctxt, debug) {
        if (obj.src) {
            let tmpSrc = items.projectiles[obj.indx].src;
            let tmpSprite = projectileSprites[tmpSrc];
            if (!tmpSprite) {
                tmpSprite = new Image();
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                }
                tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
                projectileSprites[tmpSrc] = tmpSprite;
            }
            if (tmpSprite.isLoaded)
                ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
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
        let tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
        if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
            ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
        }
    }
    // RENDER GAME OBJECTS:
    var gameObjectSprites = {};
    function getResSprite(obj) {
        var biomeID = (obj.y>=config.mapScale-config.snowBiomeTop)?2:((obj.y<=config.snowBiomeTop)?1:0);
        var tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
        var tmpSprite = gameObjectSprites[tmpIndex];
        if (!tmpSprite) {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
            var tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(UTILS.randFloat(0, Math.PI));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            let colors = [
                ["#b1d959", "#95b946"],
                ["#bade6e", "#aac76b"],
                ["#a7d544", "#86a63f"],
                ["#b4db62", "#9ebf57"]
            ]
            let select = colors[Math.floor(Math.random() * colors.length)];
            if (obj.type == 0) {
                var tmpScale;
                for (var i = 0; i < 2; ++i) {
                    tmpScale = _.scale * (!i?1:0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    //                        tmpContext.fillStyle = !biomeID?(!i?select[1]:select[0]):(!i?"#e3f1f4":"#fff");
                    tmpContext.fillStyle = !biomeID?(!i?"#9ebf57":"#b4db62"):(!i?"#e3f1f4":"#fff");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.type == 1) {
                if (biomeID == 2) {
                    tmpContext.fillStyle = "#606060";
                    renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#89a54c";
                    renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                    tmpContext.fillStyle = "#a5c65b";
                    renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
                } else {
                    renderBlob(tmpContext, 6, _.scale, _.scale * 0.7);
                    tmpContext.fillStyle = biomeID?"#e3f1f4":"#89a54c";
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = biomeID?"#6a64af":"#c15555";
                    let tmpRange;
                    let berries = 4;
                    let rotVal = mathPI2 / berries;
                    for (let i = 0; i < berries; ++i) {
                        tmpRange = UTILS.randInt(_.scale/3.5, _.scale/2.3);
                        renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i), UTILS.randInt(10, 12), tmpContext);
                    }
                }
            } else if (obj.type == 2 || obj.type == 3) {
                tmpContext.fillStyle = (obj.type==2)?(biomeID==2?"#938d77":"#939393"):"#e0c655";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.type==2)?(biomeID==2?"#b2ab90":"#bcbcbc"):"#ebdca3";
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
        var tmpSprite = itemSprites[obj.id];
        if (!tmpSprite || asIcon) {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.5) + outlineWidth +
                (items.list[obj.id].spritePadding||0);
            var tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(asIcon?0:(Math.PI/2));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon?(tmpCanvas.width/81):1);
            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                var leafDir = -(Math.PI / 2);
                renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                           25, leafDir + Math.PI/2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                var chips = 4;
                var rotVal = mathPI2 / chips;
                var tmpRange;
                for (var i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                let chips = 4;
                let rotVal = mathPI2 / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                 UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = (obj.name == "castle wall")?"#83898e":(obj.name=="wood wall")?
                    "#a5974c":"#939393";
                var sides = (obj.name == "castle wall")?4:3;
                renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.name == "castle wall")?"#9da4aa":(obj.name=="wood wall")?
                    "#c9b758":"#bcbcbc";
                renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes"
                       || obj.name == "spinning spikes") {
                tmpContext.fillStyle = (obj.name == "poison spikes")?"#7b935d":"#939393";
                var tmpScale = (obj.scale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes")?5:6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderCircle(0, 0, tmpScale/2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale * 0.5, tmpContext);
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
                    let tmpScale = obj.scale * (!i?1:0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (!i?"#9ebf57":"#b4db62");
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
                renderRect(0, 0, obj.scale*2, obj.scale*2, tmpContext);
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
                var tmpLen = 50;
                renderRect(0, -tmpLen/2, obj.scale * 0.9, tmpLen, tmpContext);
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "platform") {
                tmpContext.fillStyle = "#cebd5f";
                let tmpCount = 4;
                let tmpS = obj.scale * 2;
                let tmpW = tmpS / tmpCount;
                let tmpX = -(obj.scale/2);
                for (let i = 0; i < tmpCount; ++i) {
                    renderRect(tmpX - (tmpW/2), 0, tmpW, obj.scale*2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpX += tmpS / tmpCount;
                }
            } else if (obj.name == "healing pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale*2, obj.scale*2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "spawn pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale*2, obj.scale*2, tmpContext);
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

    var objSprites = [];
    function getObjSprite(obj) {
        var tmpSprite = objSprites[obj.id];
        if (!tmpSprite) {
            var tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0);
            var tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
            tmpContext.rotate(Math.PI / 2);
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
                var tmpScale = obj.scale * 0.6;
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

    const volcano = {
        animationTime: 0,
        land: null,
        lava: null,
        x: config.volcanoLocationX,
        y: config.volcanoLocationY
    };

    // RENDER VOLCANO:
    function volcanoShape(ctx, shape, scale) {
        let lineWidth = ctx.lineWidth || 0;
        scale /= 2;
        ctx.beginPath();
        let min = Math.PI * 2 / shape;
        for (let i = 0; i < shape; i++) {
            ctx.lineTo(scale + (scale - lineWidth / 2) * Math.cos(min * i), scale + (scale - lineWidth / 2) * Math.sin(min * i));
        }
        ctx.closePath();
    }
    function getVolcanoSprite() {
        let canvas = document.createElement("canvas");
        let scale = config.volcanoScale * 2;
        canvas.width = scale;
        canvas.height = scale;

        // land
        let context = canvas.getContext("2d");
        context.strokeStyle = "#3e3e3e";
        context.lineWidth = outlineWidth * 2;
        context.fillStyle = "#7f7f7f";
        volcanoShape(context, 10, scale);
        context.fill();
        context.stroke();
        volcano.land = canvas;

        let canvas2 = document.createElement("canvas");
        let scale2 = config.innerVolcanoScale * 2;
        canvas2.width = scale2;
        canvas2.height = scale2;

        let context2 = canvas2.getContext("2d");
        context2.lineWidth = outlineWidth * 1.6;
        context2.fillStyle = "#f54e16";
        context2.strokeStyle = "#f56f16";
        volcanoShape(context2, 10, scale2);
        context2.fill();
        context2.stroke();
        volcano.lava = canvas2;
    }
    getVolcanoSprite();
    function renderVolcano(xOffset, yOffset) {
        volcano.animationTime += delta;
        volcano.animationTime %= config.volcanoAnimationDuration;
        let duration = config.volcanoAnimationDuration / 2;
        let scale = 1.7 + 0.3 * (Math.abs(duration - volcano.animationTime) / duration);
        let innerscale = config.innerVolcanoScale * scale;
        be.drawImage(volcano.land, volcano.x - config.volcanoScale - xOffset, volcano.y - config.volcanoScale - yOffset, config.volcanoScale * 2, config.volcanoScale * 2);
        be.drawImage(volcano.lava, volcano.x - innerscale - xOffset, volcano.y - innerscale - yOffset, innerscale * 2, innerscale * 2);
    }

    // OBJECT ON SCREEN:
    function isOnScreen(x, y, s) {
        return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y, s, maxScreenHeight));
    }

    // RENDER GAME OBJECTS:
    function renderGameObjects(layer, f, d) {
        let tmpSprite, tmpX, tmpY;

        if (!window.sizeAnimations) {
            window.sizeAnimations = new Map();
            window.lastSizeUpdate = Date.now();
        }

        const now = Date.now();
        if (now - window.lastSizeUpdate > 1000) {
            window.lastSizeUpdate = now;
            window.sizeAnimations.clear();
        }

        for (let i = 0; i < gameObjects.length; ++i) {
            _ = gameObjects[i];

            if (_.active) {
                tmpX = _.x + _.xWiggle - f;
                tmpY = _.y + _.yWiggle - d;
                if (layer == 0) {
                    _.update(delta);
                }
                be.globalAlpha = _.alpha;
                if (_.layer == layer && isOnScreen(tmpX, tmpY, _.scale + (_.blocker || 0))) {
                    if (_.isItem) {
                        if ((_.dmg || _.trap) && !_.isTeamObject(player)) {
                            tmpSprite = getObjSprite(_);
                        } else {
                            tmpSprite = getItemSprite(_);
                        }

                        be.save();
                        be.translate(tmpX, tmpY);
                        be.rotate(_.dir);
                        if (!_.active) {
                            be.scale(_.visScale / _.scale, _.visScale / _.scale);
                        }
                        be.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                        if (_.blocker) {
                            be.strokeStyle = "#db6e6e";
                            be.globalAlpha = 0.3;
                            be.lineWidth = 6;
                            renderCircle(0, 0, _.blocker, be, false, true);
                        }
                        be.restore();

                        // OWNER SID:
                        const ownerSid = tmpObj.owner?.sid;
                        if (configs.BuildingOwnerSidDisplay && ownerSid > 0) {
                            const colorSeed = ownerSid + (_.id || i);
                            const hue = (colorSeed * 137.508) % 360;
                            const color = `hsl(${hue}, 70%, 60%)`;
                            const darkOutlineColor = `hsl(${hue}, 70%, 30%)`;

                            let fontSize;
                            if (!window.sizeAnimations.has(i)) {
                                fontSize = 25 + Math.random() * 621; // 4-625
                                window.sizeAnimations.set(i, {
                                    fontSize: fontSize,
                                    color: color,
                                    darkOutlineColor: darkOutlineColor
                                });
                            } else {
                                const animData = window.sizeAnimations.get(i);
                                fontSize = animData.fontSize;
                            }

                            mainContext.fillStyle = color;
                            mainContext.textBaseline = "middle";
                            mainContext.textAlign = "center";
                            mainContext.font = `${fontSize}px Hammersmith One`;
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = Math.max(2, fontSize / 25);

                            for (let j = 0; j < 3; j++) {
                                mainContext.strokeText(ownerSid.toString(), tmpX, tmpY);
                            }

                            mainContext.fillText(ownerSid.toString(), tmpX, tmpY);
                        }
                    } else {
                        if (_.type === 4) {
                            renderVolcano(f, d);
                        } else {
                            tmpSprite = getResSprite(_);
                            be.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                        }
                    }
                }
            }
        }
    }

    // RENDER MINIMAP:
    class MapPing {
        constructor(color, scale) {
            this.init = function(x, y) {
                this.scale = 0;
                this.x = x;
                this.y = y;
                this.active = true;
            };
            this.update = function(ctxt, delta) {
                if (this.active) {
                    this.scale += 0.05 * delta;
                    if (this.scale >= scale) {
                        this.active = false;
                    } else {
                        ctxt.globalAlpha = (1 - Math.max(0, this.scale / scale));
                        ctxt.beginPath();
                        ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale)
                                 * mapDisplay.width, this.scale, 0, 2 * Math.PI);
                        ctxt.stroke();
                    }
                }
            };
            this.color = color;
        }
    }
    function pingMap(x, y) {
        tmpPing = mapPings.find(pings => !pings.active);
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
    function renderMinimap(delta) {
        if (player && player.alive) {
            mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);
            // RENDER PINGS:
            mapContext.lineWidth = 4;
            for (let i = 0; i < mapPings.length; ++i) {
                tmpPing = mapPings[i];
                mapContext.strokeStyle = tmpPing.color;
                tmpPing.update(mapContext, delta);
            }
            // RENDER PLAYERS:
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#fff";
            renderCircle((player.x / config.mapScale) * mapDisplay.width, (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
            mapContext.fillStyle = "rgba(255,255,255,0.35)";
            if (player.team && minimapData) {
                for (let i = 0; i < minimapData.length;) {
                    renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width, (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    i += 2;
                }
            }
            // DEATH LOCATION:
            if (lastDeath) {
                mapContext.fillStyle = "#fc5553";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                                    (lastDeath.y / config.mapScale) * mapDisplay.height);
            }
            // MAP MARKER:
            if (mapMarker) {
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                                    (mapMarker.y / config.mapScale) * mapDisplay.height);
            }
        }
    }

    // ICONS:
    let crossHairs = ["", ""];
    let crossHairSprites = {};
    let iconSprites = {};
    let icons = ["crown", "skull"];
    function loadIcons() {
        for (let i = 0; i < icons.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function() {
                this.isLoaded = true;
            };
            tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
            iconSprites[icons[i]] = tmpSprite;
        }
        for (let i = 0; i < crossHairs.length; ++i) {
            let tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = crossHairs[i];
            crossHairSprites[i] = tmpSprite;
        }
    }
    loadIcons();
    // UPDATE GAME:
    function updateGame() {
        be.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        be.beginPath();

        if (true) {
            // MOVE CAMERA:
            if (player) {
                var tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
                var tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
                var camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
                if (tmpDist > 0.05) {
                    camX += camSpd * Math.cos(tmpDir);
                    camY += camSpd * Math.sin(tmpDir);
                } else {
                    camX = player.x;
                    camY = player.y;
                }
            } else {
                camX = config.mapScale / 2;
                camY = config.mapScale / 2;
            }


            // INTERPOLATE PLAYERS AND AI:
            var lastTime = now - (1000 / config.serverUpdateRate);
            var tmpDiff;
            for (var i = 0; i < players.length + ais.length; ++i) {
                _ = players[i]||ais[i-players.length];
                if (_ && _.visible) {
                    if (_.forcePos) {
                        _.x = _.x2;
                        _.y = _.y2;
                        _.dir = _.d2;
                    } else {
                        var total = _.t2 - _.t1;
                        var fraction = lastTime - _.t1;
                        var ratio = (fraction / total);
                        var rate = 170;
                        _.dt += delta;
                        var tmpRate = Math.min(1.7, _.dt / rate);
                        tmpDiff = (_.x2 - _.x1);
                        _.x = _.x1 + (tmpDiff * tmpRate);
                        tmpDiff = (_.y2 - _.y1);
                        _.y = _.y1 + (tmpDiff * tmpRate);
                        _.dir = Math.lerpAngle(_.d2, _.d1, Math.min(1.2, ratio));
                    }
                }
            }
            // RENDER CORDS:
            let f = camX - (maxScreenWidth / 2);
            let d = camY - (maxScreenHeight / 2);
            // RENDER BACKGROUND:
            if (config.snowBiomeTop - d <= 0 && config.mapScale - config.snowBiomeTop - d >= maxScreenHeight) {
                be.fillStyle = "#b6db66"; //grass biom
                be.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
            } else if (config.mapScale - config.snowBiomeTop - d <= 0) {
                be.fillStyle = "#dbc666";
                be.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
            } else if (config.snowBiomeTop - d >= maxScreenHeight) {
                be.fillStyle = "#fff";
                be.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
            } else if (config.snowBiomeTop - d >= 0) {
                be.fillStyle = "#fff";
                be.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - d);
                be.fillStyle = "#b6db66";
                be.fillRect(0, config.snowBiomeTop - d, maxScreenWidth,
                            maxScreenHeight - (config.snowBiomeTop - d));
            } else {
                be.fillStyle = "#b6db66";
                be.fillRect(0, 0, maxScreenWidth,
                            (config.mapScale - config.snowBiomeTop - d));
                be.fillStyle = "#dbc666";
                be.fillRect(0, (config.mapScale - config.snowBiomeTop - d), maxScreenWidth,
                            maxScreenHeight - (config.mapScale - config.snowBiomeTop - d));
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
                be.globalAlpha = 1;
                be.fillStyle = "#dbc666";
                renderWaterBodies(f, d, be, config.riverPadding);
                be.fillStyle = "#91b2db";
                renderWaterBodies(f, d, be, (waterMult - 1) * 250);
            }

            // RENDER BOTTOM LAYER:
            be.globalAlpha = 1;
            be.strokeStyle = outlineColor;
            renderGameObjects(-1, f, d);
            // RENDER PROJECTILES:
            be.globalAlpha = 1;
            be.lineWidth = outlineWidth;
            renderProjectiles(0, f, d);
            // RENDER PLAYERS:
            renderPlayers(f, d, 0);
            // RENDER AI:
            be.globalAlpha = 1;
            for (let i = 0; i < ais.length; ++i) {
                _ = ais[i];
                if (_.active && _.visible) {
                    _.animate(delta);
                    be.save();
                    be.translate(_.x - f, _.y - d);
                    be.rotate(_.dir + _.dirPlus - (Math.PI / 2));
                    renderAI(_, be);
                    be.restore();
                }
            }
            // RENDER GAME OBJECTS (LAYERED):
            renderGameObjects(0, f, d);
            renderProjectiles(1, f, d);
            renderGameObjects(1, f, d);
            renderPlayers(f, d, 1);
            renderGameObjects(2, f, d);
            renderGameObjects(3, f, d);
            // MAP BOUNDARIES:
            be.fillStyle = "#000";
            be.globalAlpha = 0.2;
            if (f <= 0) {
                be.fillRect(0, 0, -f, maxScreenHeight);
            } if (config.mapScale - f <= maxScreenWidth) {
                let tmpY = Math.max(0, -d);
                be.fillRect(config.mapScale - f, tmpY, maxScreenWidth - (config.mapScale - f), maxScreenHeight - tmpY);
            } if (d <= 0) {
                be.fillRect(-f, 0, maxScreenWidth + f, -d);
            } if (config.mapScale - d <= maxScreenHeight) {
                let tmpX = Math.max(0, -f);
                let tmpMin = 0;
                if (config.mapScale - f <= maxScreenWidth) tmpMin = maxScreenWidth - (config.mapScale - f);
                be.fillRect(tmpX, config.mapScale - d, (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - d));
            }


            // RENDER DAY/NIGHT TIME:
            be.globalAlpha = 1;
            be.fillStyle = "rgba(0, 0, 70, 0.35)";
            be.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

            // RENDER PLAYER AND AI UI / PLAYERINFOS:
            be.strokeStyle = darkOutlineColor;
            for (let i = 0; i < players.length + ais.length; ++i) {
                _ = players[i] || ais[i - players.length];
                if (_.visible) {
                    be.strokeStyle = darkOutlineColor;
                    // NAME AND HEALTH:
                    if (_.isPlayer && _.skinIndex != 10 || (_==player) || (_.team && _.team==player.team)) {
                        let tmpText = (_.team ? "[" + _.team + "] " : "") + (_ != player ? "[" + _.sid + "/" + _.latestSkin + "/" + _.oldSkinIndex + "/" + _.skinIndex + "] " : "") + (_.name || "") + (` | ${_.shameCount}`);

                        if (tmpText != "") {
                            be.font = (_.nameScale||30) + "px Hammersmith One";
                            be.fillStyle = "#fff";
                            be.textBaseline = "middle";
                            be.textAlign = "center";
                            be.lineWidth = (_.nameScale?11:8);
                            be.lineJoin = "round";
                            be.strokeText(tmpText, _.x - f, (_.y - d - _.scale) - config.nameY);
                            be.fillText(tmpText, _.x - f, (_.y - d - _.scale) - config.nameY);
                            if (_.isLeader && iconSprites.crown.isLoaded) {
                                let tmpS = config.crownIconScale;
                                let tmpX = _.x - f - (tmpS/2) - (be.measureText(tmpText).width / 2) - config.crownPad;
                                be.drawImage(iconSprites.crown, tmpX, (_.y - d - _.scale) - config.nameY - (tmpS/2) - 5, tmpS, tmpS);
                            }
                            if (_.iconIndex == 1 && iconSprites.skull.isLoaded) {
                                let tmpS = config.crownIconScale;
                                let tmpX = _.x - f - (tmpS/2) + (be.measureText(tmpText).width / 2) + config.crownPad;
                                be.drawImage(iconSprites.skull, tmpX, (_.y - d - _.scale) - config.nameY - (tmpS/2) - 5, tmpS, tmpS);
                            }
                            if (_.isPlayer && instaC.wait && near == _ && (_.backupNobull ? crossHairSprites[1].isLoaded : crossHairSprites[0].isLoaded) && enemy.length) {
                                let tmpS = _.scale * 2.2;
                                be.drawImage((_.backupNobull ? crossHairSprites[1] : crossHairSprites[0]), _.x - f - tmpS / 2, _.y - d - tmpS / 2, tmpS, tmpS);
                            }
                        }

                        if (_.health > 0) {
                            let o = config;

                            // HEALTH HOLDER:
                            be.fillStyle = darkOutlineColor;
                            be.roundRect(_.x - f - o.healthBarWidth - o.healthBarPad, (_.y - d + _.scale) + o.nameY, (o.healthBarWidth * 2) + (o.healthBarPad * 2), 17, 8);
                            be.fill();

                            // HEALTH BAR:
                            be.fillStyle = (_ == player || (_.team && _.team == player.team)) ? "#8ecc51" : "#cc5151";
                            be.roundRect(_.x - f - o.healthBarWidth, (_.y - d + _.scale) + o.nameY + o.healthBarPad, ((o.healthBarWidth * 2) * (_.health / _.maxHealth)), 17 - o.healthBarPad * 2, 7);
                            be.fill();
                            if (getEl("visStyles").value === "rv" && getEl("visS").checked) {
                                if (_.isPlayer) {
                                    let PAD = 0;
                                    let tmpX = 0;
                                    let BAR = o.healthBarWidth - PAD;
                                    let reloads = {
                                        primary: (_.primaryIndex == undefined ? 1 : ((items.weapons[_.primaryIndex].speed - _.reloads[_.primaryIndex]) / items.weapons[_.primaryIndex].speed)),
                                        secondary: (_.secondaryIndex == undefined ? 1 : ((items.weapons[_.secondaryIndex].speed - _.reloads[_.secondaryIndex]) / items.weapons[_.secondaryIndex].speed)),
                                        turret: (2500 - _.reloads[53]) / 2500
                                    };
                                    // SECONDARY RELOAD:
                                    be.fillStyle = darkOutlineColor;
                                    be.roundRect(_.x - f - o.healthBarWidth - o.healthBarPad + 50 + PAD, _.y - d + _.scale + o.nameY - 13 + tmpX, BAR + o.healthBarPad * 2, 17, 8);
                                    be.fill();
                                    be.fillStyle = _.secondaryIndex == undefined || _.reloads[_.secondaryIndex] == 0 ? "#FFF533" : `hsl(${50 * Math.ceil(_.reloads[_.secondaryIndex] / 100)}, 50%, 60%)`;
                                    be.roundRect(_.x - f - o.healthBarWidth + 50 + PAD, _.y - d + _.scale + o.nameY - 13 + o.healthBarPad + tmpX, BAR * reloads.secondary, 17 - o.healthBarPad * 2, 7);
                                    be.fill();
                                    // PRIMARY RELOAD:
                                    be.fillStyle = darkOutlineColor;
                                    be.roundRect(_.x - f - o.healthBarWidth - o.healthBarPad, _.y - d + _.scale + o.nameY - 13 + tmpX, BAR + o.healthBarPad * 2, 17, 8);
                                    be.fill();
                                    be.fillStyle = _.primaryIndex == undefined || _.reloads[_.primaryIndex] == 0 ? "#FFF533" : `hsl(${50 * Math.ceil(_.reloads[_.primaryIndex] / 100)}, 50%, 60%)`;
                                    be.roundRect(_.x - f - o.healthBarWidth, _.y - d + _.scale + o.nameY - 13 + o.healthBarPad + tmpX, BAR * reloads.primary, 17 - o.healthBarPad * 2, 7);
                                    be.fill();
                                }

                                var shaynie = 0;
                                var prestan = 0;
                                if (player.health < 50) {
                                    shaynie++;
                                }
                                if (_ == player) {//PLyer data
                                    be.textAlign = "center";
                                    be.fillStyle = "#fff";
                                    be.lineJoin = "round";
                                    be.font = "19px Hammersmith One";
                                    be.strokeStyle = "rgba(0,0,0,0.35)";
                                    be.lineWidth = 6;
                                    let useIt = `[${window.pingTime}/${shaynie}/${prestan}]`;
                                    be.strokeText(useIt, _.x - f, _.y - d + _.scale + o.nameY + 30);
                                    be.fillText(useIt, _.x - f, _.y - d + _.scale + o.nameY + 30);
                                }

                                if (1 == _.isPlayer) {
                                    be.font = (_.nameScale || 30) + "px Hammersmith One";
                                    be.fillStyle = "#ff0000";
                                    be.textBaseline = "middle";
                                    be.textAlign = "center";
                                    be.lineWidth = _.nameScale ? 11 : 8;
                                    be.lineJoin = "round";
                                    let tmpS = o.crownIconScale;
                                    let tmpX = _.x - f - tmpS / 2 + be.measureText(tmpText).width / 2 + o.crownPad + (_.iconIndex == 1 ? (_.nameScale || 30) * 2.75 : _.nameScale || 30);
                                    be.strokeText(_.shameCount, tmpX, _.y - d - _.scale - o.nameY);
                                    be.fillText(_.shameCount, tmpX, _.y - d - _.scale - o.nameY);
                                }

                                if (_.isPlayer && _ != player && (_.team != player.team || !_.team)) {
                                    let center = {
                                        x: screenWidth / 2,
                                        y: screenHeight / 2,
                                    };
                                    let alpha = Math.min(1, (UTILS.getDistance(0, 0, player.x - _.x, (player.y - _.y) * (16 / 9)) * 100) / (o.maxScreenHeight / 2) / center.y);
                                    let dist = center.y * alpha;
                                    let tmpX = dist * Math.cos(UTILS.getDirect(_, player, 0, 0));
                                    let tmpY = dist * Math.sin(UTILS.getDirect(_, player, 0, 0));
                                    be.save();
                                    be.translate((player.x - f) + tmpX, (player.y - d) + tmpY);
                                    be.rotate(_.aim2 + Math.PI / 2);
                                    let by = 255 - (_.sid * 2);
                                    be.fillStyle = `rgb(${by}, ${by}, ${by})`;
                                    be.globalAlpha = alpha;
                                    let renderTracer = function(s, ctx) {
                                        ctx = ctx || be;
                                        let h = s * (Math.sqrt(3) / 2);
                                        ctx.beginPath();
                                        ctx.moveTo(0, -h / 1.5);
                                        ctx.lineTo(-s / 2, h / 2);
                                        ctx.lineTo(s / 2, h / 2);
                                        ctx.lineTo(0, -h / 1.5);
                                        ctx.fill();
                                        ctx.closePath();
                                    }
                                    renderTracer(25, be);
                                    be.restore();
                                }
                            }
                        }



                    }
                }
            }

            be.globalAlpha = 1;
            // RENDER ANIM TEXTS:
            textManager.update(delta, be, f, d);
            // RENDER CHAT MESSAGES:
            for (let i = 0; i < players.length; ++i) {
                _ = players[i];
                if (_.visible) {
                    if (_.chatCountdown > 0) {
                        _.chatCountdown -= delta;
                        if (_.chatCountdown <= 0) _.chatCountdown = 0;
                        be.font = "32px Hammersmith One";
                        let tmpSize = be.measureText(_.chatMessage);
                        be.textBaseline = "middle";
                        be.textAlign = "center";
                        let tmpX = _.x - f;
                        let tmpY = _.y - _.scale - d - 90;
                        let tmpH = 47;
                        let tmpW = tmpSize.width + 17;
                        be.fillStyle = "rgba(0,0,0,0.2)";
                        be.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                        be.fill();
                        be.fillStyle = "#fff";
                        be.fillText(_.chatMessage, tmpX, tmpY);
                    }
                }
            }
        }
        be.globalAlpha = 1;
        // RENDER MINIMAP:
        renderMinimap(delta);
    }
    // UPDATE & ANIMATE:
    window.requestAnimFrame = function() {
        return null;
    }
    window.rAF = (function() {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function(callback) {
            window.setTimeout(callback, 1000 / 240);
        };
    })();
    function doUpdate() {
        now = performance.now();
        delta = now - lastUpdate;
        lastUpdate = now;
        let timer = performance.now();
        let diff = timer - fpsTimer.last;
        if (diff >= 1000) {
            fpsTimer.ltime = fpsTimer.time * (1000 / diff);
            fpsTimer.last = timer;
            fpsTimer.time = 0;
        }
        fpsTimer.time++;
        updateGame();
        rAF(doUpdate);
    }
    doUpdate();

    let changeDays = {};
    window.debug = function() {
        my.waitHit = 0;
        my.autoAim = false;
        instaC.isTrue = false;
        traps.inTrap = false;
        traps.breakshit = false;
        itemSprites = [];
        objSprites = [];
        gameObjectSprites = [];
    };
}();

// === FORCE BEAR HEAD WHILE MOVING (CLIENT SAFE) ===
let __lastX = null;
let __lastY = null;

setInterval(() => {
    if (typeof player === "undefined" || !player || !player.alive) return;

    if (__lastX === null) {
        __lastX = player.x;
        __lastY = player.y;
        return;
    }

    if (player.x !== __lastX || player.y !== __lastY) {
        packet("H", 11); // Bear Head
    }

    __lastX = player.x;
    __lastY = player.y;
}, 120);
