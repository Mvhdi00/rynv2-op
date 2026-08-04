#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "Ae86_v10.js");
const BOOTSTRAP = path.join(ROOT, "src", "moomoo-bootstrap.js");
const DRIVERS = path.join(ROOT, "drivers", "game-drivers.json");
const OUTPUT = path.join(ROOT, "Ae86_Fixed.user.js");

const HEADER_END = "// ==/UserScript==";
const STRAY_LICENSE = "\n\n// @license      MIT\n";

const META = [
    "// ==UserScript==",
    "// @name         Ae86",
    "// @author       NOTxxNOT",
    "// @description  katana hammer module — rebuilt against the current moomoo.io transport",
    "// @version      v10.1",
    "// @match        *://*.moomoo.io/*",
    "// @grant        none",
    "// @run-at       document-start",
    "// @license      MIT",
    "// @namespace    https://greasyfork.org/users/1023980",
    "// ==/UserScript=="
].join("\n");

function fail(message) {
    console.error("build-ae86: " + message);
    process.exit(1);
}

function readSource() {
    if (!fs.existsSync(SOURCE)) {
        fail("missing " + path.relative(ROOT, SOURCE));
    }
    return fs.readFileSync(SOURCE, "utf8");
}

function stripMetadata(text) {
    const end = text.indexOf(HEADER_END);
    if (end === -1) {
        fail("input has no userscript metadata block");
    }
    if (text.indexOf(HEADER_END, end + 1) !== -1) {
        fail("input has more than one userscript metadata block");
    }
    let body = text.slice(end + HEADER_END.length);
    if (!body.startsWith(STRAY_LICENSE)) {
        fail("input does not start with the expected post-header license line");
    }
    return body.slice(STRAY_LICENSE.length);
}

function anchor(text, needle, label) {
    const first = text.indexOf(needle);
    if (first === -1) {
        fail("anchor not found: " + label);
    }
    if (text.indexOf(needle, first + 1) !== -1) {
        fail("anchor is ambiguous: " + label);
    }
    return first;
}

function checkBundleShape(body) {
    anchor(body, "'./src/js/libs/io-client.js':function(", "io-client module");
    anchor(body, "'./src/js/app.js':function(", "app module");
    anchor(body, "'./node_modules/msgpack-lite/lib/browser.js':function(", "msgpack-lite module");
}

function checkBootstrapAgainstDrivers(bootstrap) {
    const drivers = JSON.parse(fs.readFileSync(DRIVERS, "utf8"));
    const protocol = drivers.protocol;
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

function configureBootstrap(bootstrap, options) {
    const settings = [
        [/var CLIENT = "[^"]*";/, `var CLIENT = "${options.client}";`],
        [/var GLOBAL = "[^"]*";/, `var GLOBAL = "${options.global}";`],
        [/var WITH_MENU = (?:true|false);/, `var WITH_MENU = ${options.menu};`]
    ];
    for (const [pattern, replacement] of settings) {
        if (!pattern.test(bootstrap)) {
            fail("bootstrap is missing its config line: " + pattern);
        }
        bootstrap = bootstrap.replace(pattern, replacement);
    }
    return bootstrap;
}

function build() {
    const raw = readSource();
    const body = stripMetadata(raw);
    checkBundleShape(body);

    let bootstrap = fs.readFileSync(BOOTSTRAP, "utf8");
    checkBootstrapAgainstDrivers(bootstrap);
    bootstrap = configureBootstrap(bootstrap, {
        client: "Ae86",
        global: "Ae86Net",
        menu: true
    });

    const parts = [
        META,
        "",
        bootstrap.trimEnd(),
        "",
        "function __ae86Bundle() {",
        body.trim(),
        "}",
        "",
        "__bootClient(__ae86Bundle);",
        ""
    ];

    const output = parts.join("\n");
    fs.writeFileSync(OUTPUT, output);
    console.log("build-ae86: wrote " + path.relative(ROOT, OUTPUT) + " (" + output.length + " bytes)");
}

build();
