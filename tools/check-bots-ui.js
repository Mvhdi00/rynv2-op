// Checks the Bots page of Ryn_Type_2.user.js: the fleet-name box, the fleet
// slot numbers, and the id shown for each connected bot.
//
//     node tools/check-bots-ui.js [path/to/Ryn_Type_2.user.js]
//
// Two halves.
//
// Static — the page is markup inside a string literal, so a typo in an id is
// invisible until the menu is open in a browser. This unescapes the Bots page,
// checks the ids are unique and present, and checks that every id the code
// looks up actually exists in the markup. It also checks `_botBulkName` is a
// key of Settings, because attachTextInputs refuses to bind a text input whose
// id is not a setting.
//
// Behavioural — the UI object is pulled straight out of the shipped file and
// constructed against a fake document, so the row rendering and the Apply
// button are actually run rather than read.
//
// Exits non-zero if any check fails.
const fs = require("fs");
const vm = require("vm");

const target = process.argv[2] || require("path").join(__dirname, "..", "Ryn_Type_2.user.js");
const src = fs.readFileSync(target, "utf8");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}

// ── extract the Bots page markup ───────────────────────────────────────────
function stringLiteralAt(source, startQuote) {
  let out = "";
  let i = startQuote + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      const n = source[i + 1];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n;
      i += 2;
      continue;
    }
    if (c === '"') return { text: out, end: i };
    out += c;
    i++;
  }
  throw new Error("unterminated string literal");
}

const botsDecl = src.indexOf("const Bots_default = \"");
if (botsDecl < 0) throw new Error("Bots_default not found");
const botsHtml = stringLiteralAt(src, src.indexOf('"', botsDecl)).text;

// ── static checks ──────────────────────────────────────────────────────────
{
  const ids = [...botsHtml.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  check("bots page: ids are unique", dupes.length === 0, dupes.length ? "duplicated: " + [...new Set(dupes)].join(", ") : ids.length + " ids");

  // Every id the bot-fleet code reaches for has to be in the markup.
  const required = ["bot-container", "dynamic-bot-list", "add-bot-dynamic", "_botBulkName", "_botBulkNameApply", "_autoRandomBotNames"];
  const missing = required.filter(id => !ids.includes(id));
  check("bots page: every id the code looks up exists", missing.length === 0, missing.length ? "missing: " + missing.join(", ") : required.join(", "));

  const bulkTag = botsHtml.match(/<input[^>]*id="_botBulkName"[^>]*>/);
  check("fleet name box: is a text input", !!bulkTag && /type="text"/.test(bulkTag[0]),
    bulkTag ? bulkTag[0].slice(0, 90) + "…" : "tag not found");
  check("fleet name box: capped at the game's name length", !!bulkTag && /maxlength="15"/i.test(bulkTag[0]));

  // attachTextInputs logs an error and skips any text input whose id is not a
  // setting, so the box would silently not persist.
  check("fleet name box: is a setting, so attachTextInputs binds it",
    /^\s*_botBulkName: "",\s*$/m.test(src));

  // Tag balance across the whole page, which is what a bad splice breaks.
  const opens = [...botsHtml.matchAll(/<(\w[\w-]*)(\s[^>]*)?>/g)].filter(m => !/\/>$/.test(m[0]) && !/^(input|br|hr|img|meta|link)$/i.test(m[1]));
  const closes = [...botsHtml.matchAll(/<\/(\w[\w-]*)>/g)];
  check("bots page: tags balance", opens.length === closes.length,
    opens.length + " open vs " + closes.length + " close");

  for (const rule of ["#_botBulkRow .input", ".bot-row-id", ".input.invalid"]) {
    check("css: " + rule + " is defined", src.includes(rule));
  }
}

// ── behavioural checks ─────────────────────────────────────────────────────
// A fake document, just enough of one for the row rendering and the Apply
// handler: element creation, class/id lookup, and the bits of Element they use.
class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = { cssText: "" };
    this.attrs = {};
    this._class = "";
    this._text = "";
    this.title = "";
    this.value = "";
    this.classList = {
      _s: new Set(),
      add: c => this.classList._s.add(c),
      remove: c => this.classList._s.delete(c),
      contains: c => this.classList._s.has(c)
    };
  }
  get className() { return this._class; }
  set className(v) { this._class = String(v); }
  get textContent() {
    return this._text + this.children.map(c => c.textContent).join("");
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(v) { if (v === "") { this.children = []; this._text = ""; } else { this._text = String(v); } }
  setAttribute(k, v) { if (k === "class") this.className = v; else this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  _classes() { return new Set(String(this._class).split(/\s+/).filter(Boolean)); }
  *walk() { yield this; for (const c of this.children) yield* c.walk(); }
}
function makeDoc() {
  const roots = [];
  const doc = {
    createElement: t => new FakeEl(t),
    _add(el) { roots.push(el); return el; },
    _all() { const out = []; for (const r of roots) for (const el of r.walk()) out.push(el); return out; },
    getElementById(id) { return doc._all().find(el => el.attrs.id === id || el.id === id) || null; },
    querySelector(sel) { return doc.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      // Only the shapes this code actually uses.
      const byId = sel.match(/^#([\w-]+)$/);
      if (byId) { const el = doc.getElementById(byId[1]); return el ? [el] : []; }
      const byData = sel.match(/^\.bot-row\[data-bot-player-id="([^"]+)"\]$/);
      if (byData) return doc._all().filter(el => el._classes().has("bot-row") && String(el.dataset.botPlayerId) === byData[1]);
      const pending = sel.match(/^#dynamic-bot-list \.bot-row:not\(\.connected\) input\.input$/);
      if (pending) {
        return doc._all().filter(el => el.tagName === "INPUT" && el._classes().has("input")
          && el._parentRow && el._parentRow._classes().has("bot-row") && !el._parentRow._classes().has("connected"));
      }
      const botOpt = sel.match(/^\.content-option\[data-bot-id="([^"]+)"\]$/);
      if (botOpt) return doc._all().filter(el => String(el.dataset.botId) === botOpt[1]);
      return [];
    }
  };
  return doc;
}

// Pull the UI object out of the file and construct it with everything it
// touches at construction time stubbed.
const uiStart = src.indexOf("const UI = new class {");
const uiEnd = src.indexOf("\n  const UI_default = UI;");
if (uiStart < 0 || uiEnd < 0) throw new Error("could not locate the UI object");
const uiSource = src.slice(uiStart, uiEnd);

let saves = 0;
const ctx = vm.createContext({
  console, Math, Date, Map, Set, JSON, setTimeout, clearTimeout,
  Settings_default: { _botBulkName: "", _autoRandomBotNames: false },
  SaveSettings: () => { saves++; },
  client: { clients: new Set() },
  Logger: { error: () => {}, test: () => {} },
  window: {}, document: undefined
});
vm.runInContext(uiSource + "\n this.UI = UI;", ctx);
const UI = ctx.UI;

function fakeBot(slot, customName, opts = {}) {
  return {
    id: slot,
    connectSuccess: true,
    _botCustomName: customName,
    myPlayer: { id: opts.gameID === undefined ? -1 : opts.gameID, nickname: opts.nickname || null, inGame: !!opts.inGame },
    disconnect() {}
  };
}

{
  const doc = makeDoc();
  UI.frame = { document: doc };
  const row = doc._add(new FakeEl("div"));
  row.className = "bot-row";

  // Before the server has answered: the row shows what it asked to be called.
  UI.renderBotRow(row, fakeBot(3, "Raptor"));
  check("row: shows the fleet slot", row.textContent.includes("Bot 3"), JSON.stringify(row.textContent));
  check("row: shows the name", row.textContent.includes("Raptor"));
  check("row: id is blank until the server answers", row.textContent.includes("id —"));

  // Once it has spawned: the server's name and the server's id.
  UI.renderBotRow(row, fakeBot(3, "Raptor", { gameID: 1247, nickname: "Raptor", inGame: true }));
  check("row: shows the in-game id once spawned", row.textContent.includes("id 1247"), JSON.stringify(row.textContent));
  check("row: no pending marker when the names agree", !row.textContent.includes("→"));

  // Renamed while alive: a moomoo name only changes at spawn, so the row has to
  // show both rather than claim the rename already happened.
  UI.renderBotRow(row, fakeBot(3, "Wolf", { gameID: 1247, nickname: "Raptor", inGame: true }));
  check("row: renaming a live bot shows current → pending",
    row.textContent.includes("Raptor") && row.textContent.includes("→ Wolf"), JSON.stringify(row.textContent));
}

{
  // Apply to all: pending rows get filled, connected bots get the name, and the
  // setting is saved.
  const doc = makeDoc();
  UI.frame = { document: doc };
  const input = doc._add(new FakeEl("input"));
  input.attrs.id = "_botBulkName";
  const btn = doc._add(new FakeEl("button"));
  btn.attrs.id = "_botBulkNameApply";

  const list = doc._add(new FakeEl("div"));
  list.attrs.id = "dynamic-bot-list";
  const pendingRow = new FakeEl("div");
  pendingRow.className = "bot-row";
  const pendingInput = new FakeEl("input");
  pendingInput.className = "input";
  pendingInput._parentRow = pendingRow;
  pendingRow.appendChild(pendingInput);
  list.appendChild(pendingRow);
  const connectedRow = new FakeEl("div");
  connectedRow.className = "bot-row connected";
  const connectedInput = new FakeEl("input");
  connectedInput.className = "input";
  connectedInput._parentRow = connectedRow;
  connectedRow.appendChild(connectedInput);
  list.appendChild(connectedRow);

  const live = fakeBot(1, "Bot1", { gameID: 10, nickname: "Bot1", inGame: true });
  const dead = fakeBot(2, "Bot2", { gameID: 11, nickname: "Bot2", inGame: false });
  ctx.client.clients = new Set([live, dead]);
  ctx.Settings_default._botBulkName = "";
  saves = 0;

  UI.attachBulkNameUI(doc);
  input.value = "  Raptor  ";
  btn.onclick();

  check("apply: trims and stores the name", ctx.Settings_default._botBulkName === "Raptor" && saves === 1,
    JSON.stringify(ctx.Settings_default._botBulkName) + ", " + saves + " save(s)");
  check("apply: fills rows that have not connected yet", pendingInput.value === "Raptor");
  check("apply: leaves a connected row's box alone", connectedInput.value === "");
  check("apply: every connected bot takes the name",
    live._botCustomName === "Raptor" && dead._botCustomName === "Raptor");
  check("apply: reports what happened", /Raptor|bot|row/i.test(btn.textContent), JSON.stringify(btn.textContent));

  // Empty name is refused rather than wiping every bot's name.
  input.value = "   ";
  const before = live._botCustomName;
  btn.onclick();
  check("apply: an empty name is refused", live._botCustomName === before && input.classList.contains("invalid"));

  // The name a new row is pre-filled with.
  ctx.Settings_default._botBulkName = "Raptor";
  check("new rows: pre-filled with the fleet name", UI.bulkName() === "Raptor");
  ctx.Settings_default._botBulkName = "";
  check("new rows: nothing to pre-fill when the box is empty", UI.bulkName() === "");
}

{
  // Fleet slots must be unique. The counter used to live inside
  // handleBotCreation, which runs once per row, so every bot came out as bot 0.
  UI.botSequence = 0;
  const slots = [++UI.botSequence, ++UI.botSequence, ++UI.botSequence];
  check("slots: one counter for the whole fleet", new Set(slots).size === 3, "handed out " + slots.join(", "));
  check("slots: the counter is a field on the shared UI object", /\n\s*botSequence=0;/.test(src));
  check("slots: no per-row counter left in handleBotCreation",
    !/handleBotCreation\([^)]*\)\s*\{\s*\n\s*let id = 0;/.test(src));
}

{
  // A bot connected through the dynamic list has no #bot-container option, and
  // botOption used to dereference that miss and throw — inside
  // onFirstTickAfterSpawn, which then skipped clientIDList.add.
  const doc = makeDoc();
  UI.frame = { document: doc };
  let threw = null;
  try {
    UI.updateBotOption(fakeBot(7, "Ghost", { gameID: 22, nickname: "Ghost", inGame: true }), "title");
  } catch (e) {
    threw = e;
  }
  check("missing row: updating a bot the menu is not showing does not throw",
    threw === null, threw ? String(threw.message) : "returned quietly");
  check("missing row: botOption reports a miss as null",
    UI.getElements().botOption(999) === null);
}

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
