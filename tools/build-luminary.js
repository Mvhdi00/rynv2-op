#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "Luminary_v3.js");
const BOOTSTRAP = path.join(ROOT, "src", "moomoo-bootstrap.js");
const DRIVERS = path.join(ROOT, "drivers", "game-drivers.json");
const OUTPUT = path.join(ROOT, "Luminary_Fixed.user.js");

const HEADER_END = "// ==/UserScript==";

/* The shipped header carries "@match ://*.moomoo.io/*" — an empty scheme,
 * which is not a valid match pattern, so the script never ran anywhere. It
 * also has no @run-at, and the shim has to be in place before the page
 * loads. */
const META = [
    "// ==UserScript==",
    "// @name         luminary",
    "// @author       onion, dreadful",
    "// @description  based on wespire — rebuilt against the current moomoo.io transport",
    "// @version      3 (milestone 4) build 6.1",
    "// @icon         https://f4.bcbits.com/img/a2660869780_10.jpg",
    "// @match        *://*.moomoo.io/*",
    "// @grant        none",
    "// @run-at       document-start",
    "// ==/UserScript=="
].join("\n");

function fail(message) {
    console.error("build-luminary: " + message);
    process.exit(1);
}

function replaceOnce(text, find, into, label) {
    const count = text.split(find).length - 1;
    if (count !== 1) {
        fail("expected exactly one " + label + ", found " + count);
    }
    return text.split(find).join(into);
}

function stripMetadata(text) {
    const end = text.indexOf(HEADER_END);
    if (end === -1) {
        fail("input has no userscript metadata block");
    }
    if (text.indexOf(HEADER_END, end + 1) !== -1) {
        fail("input has more than one userscript metadata block");
    }
    return text.slice(end + HEADER_END.length);
}

function checkShape(body) {
    const required = [
        ['"io-init" == o ? n.socketId = t[0]', "legacy io-init handler"],
        ["i = o.encode([e, t]);", "legacy send"],
        ['e.open("GET", "/serverData", !0)', "legacy server list"]
    ];
    for (const [needle, label] of required) {
        if (!body.includes(needle)) {
            fail("input does not look like luminary — missing the " + label);
        }
    }
}

/* The client rewrites the whole document at load to drop a script called
 * bundle.js. The game has not shipped under that name for years, so it strips
 * nothing; worse, importing the cloned tree re-executes the real bundle,
 * because a cloned script node has not "already started". The bootstrap
 * blocks the entry properly at document-start, so this comes out. */
function removePageRewrite(body) {
    const block = `var xhr = new XMLHttpRequest;
xhr.open("GET", document.URL, false);
xhr.send(null);
var content = xhr.responseText;
var doc = document.implementation.createHTMLDocument("" + (document.title || ""));
doc.open();
doc.write(content);
doc.close();
[...doc.getElementsByTagName("script")].find(e => e?.src.endsWith("bundle.js"))?.remove();
document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);`;
    return replaceOnce(body, block, "/* page rewrite removed — the bootstrap blocks the stock bundle instead */", "page-rewrite block");
}

/* A second socket, to a host that is not the game, opened on every load with
 * no toggle and no notice. Its only outbound payload is a constant, but the
 * inbound side makes the client type in game chat on command, and the
 * connection itself tells whoever runs it your address every session. Off
 * unless the user asks for it. */
function gateSyncSocket(body) {
    const original = "let project = new WebSocket(`${wssws}://steep-goofy-raven.glitch.me`);";
    const gated = `let syncServerEnabled = false;
    let project = syncServerEnabled ? new WebSocket(\`\${wssws}://steep-goofy-raven.glitch.me\`) : {
        readyState: 3,
        send: function () {},
        close: function () {}
    };
    window.enableSyncServer = function () {
        if (project.readyState !== 3) return "already connected";
        project = new WebSocket(\`\${wssws}://steep-goofy-raven.glitch.me\`);
        project.binaryType = "arraybuffer";
        return "connecting to steep-goofy-raven.glitch.me";
    };`;
    return replaceOnce(body, original, gated, "sync socket");
}

function configureBootstrap(bootstrap) {
    const settings = [
        [/var CLIENT = "[^"]*";/, 'var CLIENT = "Luminary";'],
        [/var GLOBAL = "[^"]*";/, 'var GLOBAL = "LuminaryNet";'],
        [/var WITH_MENU = (?:true|false);/, "var WITH_MENU = false;"]
    ];
    for (const [pattern, replacement] of settings) {
        if (!pattern.test(bootstrap)) {
            fail("bootstrap is missing its config line: " + pattern);
        }
        bootstrap = bootstrap.replace(pattern, replacement);
    }
    return bootstrap;
}

function checkBootstrapAgainstDrivers(bootstrap) {
    const protocol = JSON.parse(fs.readFileSync(DRIVERS, "utf8")).protocol;
    const expectations = [
        ["var SIGNATURE_BYTES = " + protocol.signatureBytes + ";", "frame signature width"],
        ["var ENCRYPTED_MODE = " + protocol.encryptedMode + ";", "transport mode"],
        ["var TABLE_SALT = " + protocol.tableSalt + ";", "opcode table salt"],
        ["var C2S_ALPHABET = " + JSON.stringify(protocol.c2sAlphabet).replace(/","/g, '", "') + ";", "c2s alphabet"],
        ["var S2C_ALPHABET = " + JSON.stringify(protocol.s2cAlphabet).replace(/","/g, '", "') + ";", "s2c alphabet"]
    ];
    for (const [needle, label] of expectations) {
        if (!bootstrap.includes(needle)) {
            fail("bootstrap does not match drivers/game-drivers.json: " + label);
        }
    }
}

function build() {
    if (!fs.existsSync(SOURCE)) {
        fail("missing " + path.relative(ROOT, SOURCE));
    }
    let body = stripMetadata(fs.readFileSync(SOURCE, "utf8"));
    checkShape(body);
    body = removePageRewrite(body);
    body = gateSyncSocket(body);

    let bootstrap = fs.readFileSync(BOOTSTRAP, "utf8");
    checkBootstrapAgainstDrivers(bootstrap);
    bootstrap = configureBootstrap(bootstrap);

    const output = [
        META,
        "",
        bootstrap.trimEnd(),
        "",
        "function __luminaryBundle() {",
        body.trim(),
        "}",
        "",
        "__bootClient(__luminaryBundle);",
        ""
    ].join("\n");

    fs.writeFileSync(OUTPUT, output);
    console.log("build-luminary: wrote " + path.relative(ROOT, OUTPUT) + " (" + output.length + " bytes)");
}

build();
