/*
 * edits.js
 *
 * Anchored text edits, shared by the tools that rewrite a client.
 *
 * Every edit is pinned to an exact string in the input, and an anchor that is
 * missing or ambiguous fails loudly: dropping in a newer client shows up as an
 * error rather than as a half-applied script.
 */

class Editor {
  constructor(code) {
    this.code = code;
    this.applied = [];
  }

  /* Replace one occurrence. Missing or ambiguous is an error. */
  edit(label, find, replace) {
    const parts = this.code.split(find);
    if (parts.length === 1) throw new Error(`anchor not found: ${label}`);
    if (parts.length > 2) {
      throw new Error(`anchor is ambiguous (${parts.length - 1} hits): ${label}`);
    }
    this.code = parts[0] + replace + parts[1];
    this.applied.push(label);
  }

  /* Replace every occurrence, optionally asserting how many there are. */
  editAll(label, find, replace, expected) {
    const hits = this.code.split(find).length - 1;
    if (hits === 0) throw new Error(`anchor not found: ${label}`);
    if (expected !== undefined && hits !== expected) {
      throw new Error(`anchor hit ${hits} times, expected ${expected}: ${label}`);
    }
    this.code = this.code.split(find).join(replace);
    this.applied.push(`${label} (${hits})`);
  }

  /*
   * An edit the input may already carry.
   *
   * Used where upstream has since fixed something a build used to patch: the
   * tool says so rather than failing on an anchor that is gone for the right
   * reason.
   */
  editIfPresent(label, find, replace) {
    if (!this.code.includes(find)) {
      this.applied.push(`${label} — already in the base, nothing to do`);
      return false;
    }
    this.edit(label, find, replace);
    return true;
  }

  /*
   * Splice into one of the client's HTML page constants.
   *
   * They are JS string literals on a single line, so decode, splice and
   * re-encode.
   */
  patchPage(constName, anchorHtml, insertHtml) {
    const declaration = `const ${constName} = `;
    const start = this.code.indexOf(declaration);
    if (start === -1) throw new Error(`page constant not found: ${constName}`);

    const lineEnd = this.code.indexOf("\n", start);
    const literal = this.code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");

    // eslint-disable-next-line no-eval
    const html = eval(literal);
    const hits = html.split(anchorHtml).length - 1;
    if (hits === 0) throw new Error(`page anchor not found in ${constName}`);
    if (hits > 1) throw new Error(`page anchor is ambiguous (${hits} hits) in ${constName}`);

    const patched = html.replace(anchorHtml, insertHtml + anchorHtml);
    this.code =
      this.code.slice(0, start + declaration.length) +
      JSON.stringify(patched) +
      ";" +
      this.code.slice(lineEnd);
    this.applied.push(`menu: options added to ${constName}`);
  }

  /* Append to one of the client's CSS string constants. */
  patchStyles(constName, extra) {
    const declaration = `const ${constName} = `;
    const start = this.code.indexOf(declaration);
    if (start === -1) throw new Error(`${constName} not found`);
    const lineEnd = this.code.indexOf("\n", start);
    const literal = this.code.slice(start + declaration.length, lineEnd).replace(/;\s*$/, "");
    // eslint-disable-next-line no-eval
    const css = eval(literal);

    this.code =
      this.code.slice(0, start + declaration.length) +
      JSON.stringify(css + extra) +
      ";" +
      this.code.slice(lineEnd);
    this.applied.push(`menu: styles added to ${constName}`);
  }
}

module.exports = { Editor };
