(() => {
  window.__gl = [];
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    if (this.id === "gameCanvas" && /webgl/.test(t)) window.__gl.push((new Error().stack || "").split("\n").slice(1, 4).join(" | ").slice(0, 300));
    return gc.apply(this, arguments);
  };
  const raf = window.requestAnimationFrame;
  window.__rafStacks = new Map();
})();
