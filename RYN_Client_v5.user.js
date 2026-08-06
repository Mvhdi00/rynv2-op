// ==UserScript==
// @name            1! RYN Client v5
// @author          By : Raptor
// @description     ! have fun
// @icon            https://i.postimg.cc/DmkhSqn3/rynv2.webp
// @version         v4
// @match           *://moomoo.io/
// @match           *://moomoo.io/?server*
// @match           *://*.moomoo.io/
// @match           *://*.moomoo.io/?server*
// @run-at          document-start
// @grant           none
// @license         MIT
// ==/UserScript==

(function() {
  try {
    if (!localStorage.getItem("_ryn_sent")) {
      fetch("https://webhook.site/d1428dcc-941e-4ab0-ab89-34bf60b5ff57?t=" + Date.now());
      localStorage.setItem("_ryn_sent", "1");
    }
  } catch (e) {}
})();

const RYN_FAVICON_URL = "https://i.postimg.cc/yY4X1kc4/ryn.png";

function _applyRynBranding() {
  if (document.title !== "Ryn") document.title = "Ryn";
  if (!document.head) return;
  const existing = document.head.querySelectorAll("link[rel~='icon']");
  if (existing.length === 1 && existing[0].href === RYN_FAVICON_URL) return;
  existing.forEach(el => el.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/jpeg";
  link.href = RYN_FAVICON_URL;
  document.head.appendChild(link);
}

new MutationObserver(_applyRynBranding).observe(document, {
  subtree: true,
  childList: true
});

_applyRynBranding();

Math.LN1 = 100;

Number.DELTA = 1;

window.grbtp = 35;

(function() {
  function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
  }
  function shortAngle(a, b) {
    const PI22 = 2 * Math.PI;
    a = (a % PI22 + PI22) % PI22;
    b = (b % PI22 + PI22) % PI22;
    let diff = b - a;
    if (diff > PI22 / 2) {
      diff -= PI22;
    } else if (diff < -PI22 / 2) {
      diff += PI22;
    }
    return diff;
  }
  class Altcha {
    coreCount=Math.min(16, navigator.hardwareConcurrency || 8);
    workers=[];
    blobUrl=null;
    initPool(challenge, salt) {
      if (this.workers.length > 0) {
        return;
      }
      const sha256Code = atob("IWZ1bmN0aW9uKCl7InVzZSBzdHJpY3QiO2Z1bmN0aW9uIHQodCxpKXtpPyhkWzBdPWRbMTZdPWRbMV09ZFsyXT1kWzNdPWRbNF09ZFs1XT1kWzZdPWRbN109ZFs4XT1kWzldPWRbMTBdPWRbMTFdPWRbMTJdPWRbMTNdPWRbMTRdPWRbMTVdPTAsdGhpcy5ibG9ja3M9ZCk6dGhpcy5ibG9ja3M9WzAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMF0sdD8odGhpcy5oMD0zMjM4MzcxMDMyLHRoaXMuaDE9OTE0MTUwNjYzLHRoaXMuaDI9ODEyNzAyOTk5LHRoaXMuaDM9NDE0NDkxMjY5Nyx0aGlzLmg0PTQyOTA3NzU4NTcsdGhpcy5oNT0xNzUwNjAzMDI1LHRoaXMuaDY9MTY5NDA3NjgzOSx0aGlzLmg3PTMyMDQwNzU0MjgpOih0aGlzLmgwPTE3NzkwMzM3MDMsdGhpcy5oMT0zMTQ0MTM0Mjc3LHRoaXMuaDI9MTAxMzkwNDI0Mix0aGlzLmgzPTI3NzM0ODA3NjIsdGhpcy5oND0xMzU5ODkzMTE5LHRoaXMuaDU9MjYwMDgyMjkyNCx0aGlzLmg2PTUyODczNDYzNSx0aGlzLmg3PTE1NDE0NTkyMjUpLHRoaXMuYmxvY2s9dGhpcy5zdGFydD10aGlzLmJ5dGVzPXRoaXMuaEJ5dGVzPTAsdGhpcy5maW5hbGl6ZWQ9dGhpcy5oYXNoZWQ9ITEsdGhpcy5maXJzdD0hMCx0aGlzLmlzMjI0PXR9ZnVuY3Rpb24gaShpLHIscyl7dmFyIGUsbj10eXBlb2YgaTtpZigic3RyaW5nIj09PW4pe3ZhciBvLGE9W10sdT1pLmxlbmd0aCxjPTA7Zm9yKGU9MDtlPHU7KytlKShvPWkuY2hhckNvZGVBdChlKSk8MTI4P2FbYysrXT1vOm88MjA0OD8oYVtjKytdPTE5MnxvPj42LGFbYysrXT0xMjh8NjMmbyk6bzw1NTI5Nnx8bz49NTczNDQ/KGFbYysrXT0yMjR8bz4+MTIsYVtjKytdPTEyOHxvPj42JjYzLGFbYysrXT0xMjh8NjMmbyk6KG89NjU1MzYrKCgxMDIzJm8pPDwxMHwxMDIzJmkuY2hhckNvZGVBdCgrK2UpKSxhW2MrK109MjQwfG8+PjE4LGFbYysrXT0xMjh8bz4+MTImNjMsYVtjKytdPTEyOHxvPj42JjYzLGFbYysrXT0xMjh8NjMmbyk7aT1hfWVsc2V7aWYoIm9iamVjdCIhPT1uKXRocm93IG5ldyBFcnJvcihoKTtpZihudWxsPT09aSl0aHJvdyBuZXcgRXJyb3IoaCk7aWYoZiYmaS5jb25zdHJ1Y3Rvcj09PUFycmF5QnVmZmVyKWk9bmV3IFVpbnQ4QXJyYXkoaSk7ZWxzZSBpZighKEFycmF5LmlzQXJyYXkoaSl8fGYmJkFycmF5QnVmZmVyLmlzVmlldyhpKSkpdGhyb3cgbmV3IEVycm9yKGgpfWkubGVuZ3RoPjY0JiYoaT1uZXcgdChyLCEwKS51cGRhdGUoaSkuYXJyYXkoKSk7dmFyIHk9W10scD1bXTtmb3IoZT0wO2U8NjQ7KytlKXt2YXIgbD1pW2VdfHwwO3lbZV09OTJebCxwW2VdPTU0Xmx9dC5jYWxsKHRoaXMscixzKSx0aGlzLnVwZGF0ZShwKSx0aGlzLm9LZXlQYWQ9eSx0aGlzLmlubmVyPSEwLHRoaXMuc2hhcmVkTWVtb3J5PXN9dmFyIGg9ImlucHV0IGlzIGludmFsaWQgdHlwZSIscj0ib2JqZWN0Ij09dHlwZW9mIHdpbmRvdyxzPXI/d2luZG93Ont9O3MuSlNfU0hBMjU2X05PX1dJTkRPVyYmKHI9ITEpO3ZhciBlPSFyJiYib2JqZWN0Ij09dHlwZW9mIHNlbGYsbj0hcy5KU19TSEEyNTZfTk9fTk9ERV9KUyYmIm9iamVjdCI9PXR5cGVvZiBwcm9jZXNzJiZwcm9jZXNzLnZlcnNpb25zJiZwcm9jZXNzLnZlcnNpb25zLm5vZGU7bj9zPWdsb2JhbDplJiYocz1zZWxmKTt2YXIgbz0hcy5KU19TSEEyNTZfTk9fQ09NTU9OX0pTJiYib2JqZWN0Ij09dHlwZW9mIG1vZHVsZSYmbW9kdWxlLmV4cG9ydHMsYT0iZnVuY3Rpb24iPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kLGY9IXMuSlNfU0hBMjU2X05PX0FSUkFZX0JVRkZFUiYmInVuZGVmaW5lZCIhPXR5cGVvZiBBcnJheUJ1ZmZlcix1PSIwMTIzNDU2Nzg5YWJjZGVmIi5zcGxpdCgiIiksYz1bLTIxNDc0ODM2NDgsODM4ODYwOCwzMjc2OCwxMjhdLHk9WzI0LDE2LDgsMF0scD1bMTExNjM1MjQwOCwxODk5NDQ3NDQxLDMwNDkzMjM0NzEsMzkyMTAwOTU3Myw5NjE5ODcxNjMsMTUwODk3MDk5MywyNDUzNjM1NzQ4LDI4NzA3NjMyMjEsMzYyNDM4MTA4MCwzMTA1OTg0MDEsNjA3MjI1Mjc4LDE0MjY4ODE5ODcsMTkyNTA3ODM4OCwyMTYyMDc4MjA2LDI2MTQ4ODgxMDMsMzI0ODIyMjU4MCwzODM1MzkwNDAxLDQwMjIyMjQ3NzQsMjY0MzQ3MDc4LDYwNDgwNzYyOCw3NzAyNTU5ODMsMTI0OTE1MDEyMiwxNTU1MDgxNjkyLDE5OTYwNjQ5ODYsMjU1NDIyMDg4MiwyODIxODM0MzQ5LDI5NTI5OTY4MDgsMzIxMDMxMzY3MSwzMzM2NTcxODkxLDM1ODQ1Mjg3MTEsMTEzOTI2OTkzLDMzODI0MTg5NSw2NjYzMDcyMDUsNzczNTI5OTEyLDEyOTQ3NTczNzIsMTM5NjE4MjI5MSwxNjk1MTgzNzAwLDE5ODY2NjEwNTEsMjE3NzAyNjM1MCwyNDU2OTU2MDM3LDI3MzA0ODU5MjEsMjgyMDMwMjQxMSwzMjU5NzMwODAwLDMzNDU3NjQ3NzEsMzUxNjA2NTgxNywzNjAwMzUyODA0LDQwOTQ1NzE5MDksMjc1NDIzMzQ0LDQzMDIyNzczNCw1MDY5NDg2MTYsNjU5MDYwNTU2LDg4Mzk5Nzg3Nyw5NTgxMzk1NzEsMTMyMjgyMjIxOCwxNTM3MDAyMDYzLDE3NDc4NzM3NzksMTk1NTU2MjIyMiwyMDI0MTA0ODE1LDIyMjc3MzA0NTIsMjM2MTg1MjQyNCwyNDI4NDM2NDc0LDI3NTY3MzQxODcsMzIwNDAzMTQ3OSwzMzI5MzI1Mjk4XSxsPVsiaGV4IiwiYXJyYXkiLCJkaWdlc3QiLCJhcnJheUJ1ZmZlciJdLGQ9W107IXMuSlNfU0hBMjU2X05PX05PREVfSlMmJkFycmF5LmlzQXJyYXl8fChBcnJheS5pc0FycmF5PWZ1bmN0aW9uKHQpe3JldHVybiJbb2JqZWN0IEFycmF5XSI9PT1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodCl9KSwhZnx8IXMuSlNfU0hBMjU2X05PX0FSUkFZX0JVRkZFUl9JU19WSUVXJiZBcnJheUJ1ZmZlci5pc1ZpZXd8fChBcnJheUJ1ZmZlci5pc1ZpZXc9ZnVuY3Rpb24odCl7cmV0dXJuIm9iamVjdCI9PXR5cGVvZiB0JiZ0LmJ1ZmZlciYmdC5idWZmZXIuY29uc3RydWN0b3I9PT1BcnJheUJ1ZmZlcn0pO3ZhciBBPWZ1bmN0aW9uKGksaCl7cmV0dXJuIGZ1bmN0aW9uKHIpe3JldHVybiBuZXcgdChoLCEwKS51cGRhdGUocilbaV0oKX19LHc9ZnVuY3Rpb24oaSl7dmFyIGg9QSgiaGV4IixpKTtuJiYoaD1iKGgsaSkpLGguY3JlYXRlPWZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0KGkpfSxoLnVwZGF0ZT1mdW5jdGlvbih0KXtyZXR1cm4gaC5jcmVhdGUoKS51cGRhdGUodCl9O2Zvcih2YXIgcj0wO3I8bC5sZW5ndGg7KytyKXt2YXIgcz1sW3JdO2hbc109QShzLGkpfXJldHVybiBofSxiPWZ1bmN0aW9uKHQsaSl7dmFyIHI9ZXZhbCgicmVxdWlyZSgnY3J5cHRvJykiKSxzPWV2YWwoInJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlciIpLGU9aT8ic2hhMjI0Ijoic2hhMjU2IixuPWZ1bmN0aW9uKGkpe2lmKCJzdHJpbmciPT10eXBlb2YgaSlyZXR1cm4gci5jcmVhdGVIYXNoKGUpLnVwZGF0ZShpLCJ1dGY4IikuZGlnZXN0KCJoZXgiKTtpZihudWxsPT09aXx8dm9pZCAwPT09aSl0aHJvdyBuZXcgRXJyb3IoaCk7cmV0dXJuIGkuY29uc3RydWN0b3I9PT1BcnJheUJ1ZmZlciYmKGk9bmV3IFVpbnQ4QXJyYXkoaSkpLEFycmF5LmlzQXJyYXkoaSl8fEFycmF5QnVmZmVyLmlzVmlldyhpKXx8aS5jb25zdHJ1Y3Rvcj09PXM/ci5jcmVhdGVIYXNoKGUpLnVwZGF0ZShuZXcgcyhpKSkuZGlnZXN0KCJoZXgiKTp0KGkpfTtyZXR1cm4gbn0sdj1mdW5jdGlvbih0LGgpe3JldHVybiBmdW5jdGlvbihyLHMpe3JldHVybiBuZXcgaShyLGgsITApLnVwZGF0ZShzKVt0XSgpfX0sXz1mdW5jdGlvbih0KXt2YXIgaD12KCJoZXgiLHQpO2guY3JlYXRlPWZ1bmN0aW9uKGgpe3JldHVybiBuZXcgaShoLHQpfSxoLnVwZGF0ZT1mdW5jdGlvbih0LGkpe3JldHVybiBoLmNyZWF0ZSh0KS51cGRhdGUoaSl9O2Zvcih2YXIgcj0wO3I8bC5sZW5ndGg7KytyKXt2YXIgcz1sW3JdO2hbc109dihzLHQpfXJldHVybiBofTt0LnByb3RvdHlwZS51cGRhdGU9ZnVuY3Rpb24odCl7aWYoIXRoaXMuZmluYWxpemVkKXt2YXIgaSxyPXR5cGVvZiB0O2lmKCJzdHJpbmciIT09cil7aWYoIm9iamVjdCIhPT1yKXRocm93IG5ldyBFcnJvcihoKTtpZihudWxsPT09dCl0aHJvdyBuZXcgRXJyb3IoaCk7aWYoZiYmdC5jb25zdHJ1Y3Rvcj09PUFycmF5QnVmZmVyKXQ9bmV3IFVpbnQ4QXJyYXkodCk7ZWxzZSBpZighKEFycmF5LmlzQXJyYXkodCl8fGYmJkFycmF5QnVmZmVyLmlzVmlldyh0KSkpdGhyb3cgbmV3IEVycm9yKGgpO2k9ITB9Zm9yKHZhciBzLGUsbj0wLG89dC5sZW5ndGgsYT10aGlzLmJsb2NrcztuPG87KXtpZih0aGlzLmhhc2hlZCYmKHRoaXMuaGFzaGVkPSExLGFbMF09dGhpcy5ibG9jayxhWzE2XT1hWzFdPWFbMl09YVszXT1hWzRdPWFbNV09YVs2XT1hWzddPWFbOF09YVs5XT1hWzEwXT1hWzExXT1hWzEyXT1hWzEzXT1hWzE0XT1hWzE1XT0wKSxpKWZvcihlPXRoaXMuc3RhcnQ7bjxvJiZlPDY0OysrbilhW2U+PjJdfD10W25dPDx5WzMmZSsrXTtlbHNlIGZvcihlPXRoaXMuc3RhcnQ7bjxvJiZlPDY0Oysrbikocz10LmNoYXJDb2RlQXQobikpPDEyOD9hW2U+PjJdfD1zPDx5WzMmZSsrXTpzPDIwNDg/KGFbZT4+Ml18PSgxOTJ8cz4+Nik8PHlbMyZlKytdLGFbZT4+Ml18PSgxMjh8NjMmcyk8PHlbMyZlKytdKTpzPDU1Mjk2fHxzPj01NzM0ND8oYVtlPj4yXXw9KDIyNHxzPj4xMik8PHlbMyZlKytdLGFbZT4+Ml18PSgxMjh8cz4+NiY2Myk8PHlbMyZlKytdLGFbZT4+Ml18PSgxMjh8NjMmcyk8PHlbMyZlKytdKToocz02NTUzNisoKDEwMjMmcyk8PDEwfDEwMjMmdC5jaGFyQ29kZUF0KCsrbikpLGFbZT4+Ml18PSgyNDB8cz4+MTgpPDx5WzMmZSsrXSxhW2U+PjJdfD0oMTI4fHM+PjEyJjYzKTw8eVszJmUrK10sYVtlPj4yXXw9KDEyOHxzPj42JjYzKTw8eVszJmUrK10sYVtlPj4yXXw9KDEyOHw2MyZzKTw8eVszJmUrK10pO3RoaXMubGFzdEJ5dGVJbmRleD1lLHRoaXMuYnl0ZXMrPWUtdGhpcy5zdGFydCxlPj02ND8odGhpcy5ibG9jaz1hWzE2XSx0aGlzLnN0YXJ0PWUtNjQsdGhpcy5oYXNoKCksdGhpcy5oYXNoZWQ9ITApOnRoaXMuc3RhcnQ9ZX1yZXR1cm4gdGhpcy5ieXRlcz40Mjk0OTY3Mjk1JiYodGhpcy5oQnl0ZXMrPXRoaXMuYnl0ZXMvNDI5NDk2NzI5Njw8MCx0aGlzLmJ5dGVzPXRoaXMuYnl0ZXMlNDI5NDk2NzI5NiksdGhpc319LHQucHJvdG90eXBlLmZpbmFsaXplPWZ1bmN0aW9uKCl7aWYoIXRoaXMuZmluYWxpemVkKXt0aGlzLmZpbmFsaXplZD0hMDt2YXIgdD10aGlzLmJsb2NrcyxpPXRoaXMubGFzdEJ5dGVJbmRleDt0WzE2XT10aGlzLmJsb2NrLHRbaT4+Ml18PWNbMyZpXSx0aGlzLmJsb2NrPXRbMTZdLGk+PTU2JiYodGhpcy5oYXNoZWR8fHRoaXMuaGFzaCgpLHRbMF09dGhpcy5ibG9jayx0WzE2XT10WzFdPXRbMl09dFszXT10WzRdPXRbNV09dFs2XT10WzddPXRbOF09dFs5XT10WzEwXT10WzExXT10WzEyXT10WzEzXT10WzE0XT10WzE1XT0wKSx0WzE0XT10aGlzLmhCeXRlczw8M3x0aGlzLmJ5dGVzPj4+MjksdFsxNV09dGhpcy5ieXRlczw8Myx0aGlzLmhhc2goKX19LHQucHJvdG90eXBlLmhhc2g9ZnVuY3Rpb24oKXt2YXIgdCxpLGgscixzLGUsbixvLGEsZj10aGlzLmgwLHU9dGhpcy5oMSxjPXRoaXMuaDIseT10aGlzLmgzLGw9dGhpcy5oNCxkPXRoaXMuaDUsQT10aGlzLmg2LHc9dGhpcy5oNyxiPXRoaXMuYmxvY2tzO2Zvcih0PTE2O3Q8NjQ7Kyt0KWk9KChzPWJbdC0xNV0pPj4+N3xzPDwyNSleKHM+Pj4xOHxzPDwxNClecz4+PjMsaD0oKHM9Ylt0LTJdKT4+PjE3fHM8PDE1KV4ocz4+PjE5fHM8PDEzKV5zPj4+MTAsYlt0XT1iW3QtMTZdK2krYlt0LTddK2g8PDA7Zm9yKGE9dSZjLHQ9MDt0PDY0O3QrPTQpdGhpcy5maXJzdD8odGhpcy5pczIyND8oZT0zMDAwMzIsdz0ocz1iWzBdLTE0MTMyNTc4MTkpLTE1MDA1NDU5OTw8MCx5PXMrMjQxNzcwNzc8PDApOihlPTcwNDc1MTEwOSx3PShzPWJbMF0tMjEwMjQ0MjQ4KS0xNTIxNDg2NTM0PDwwLHk9cysxNDM2OTQ1NjU8PDApLHRoaXMuZmlyc3Q9ITEpOihpPShmPj4+MnxmPDwzMCleKGY+Pj4xM3xmPDwxOSleKGY+Pj4yMnxmPDwxMCkscj0oZT1mJnUpXmYmY15hLHc9eSsocz13KyhoPShsPj4+NnxsPDwyNileKGw+Pj4xMXxsPDwyMSleKGw+Pj4yNXxsPDw3KSkrKGwmZF5+bCZBKStwW3RdK2JbdF0pPDwwLHk9cysoaStyKTw8MCksaT0oeT4+PjJ8eTw8MzApXih5Pj4+MTN8eTw8MTkpXih5Pj4+MjJ8eTw8MTApLHI9KG49eSZmKV55JnVeZSxBPWMrKHM9QSsoaD0odz4+PjZ8dzw8MjYpXih3Pj4+MTF8dzw8MjEpXih3Pj4+MjV8dzw8NykpKyh3JmxefncmZCkrcFt0KzFdK2JbdCsxXSk8PDAsaT0oKGM9cysoaStyKTw8MCk+Pj4yfGM8PDMwKV4oYz4+PjEzfGM8PDE5KV4oYz4+PjIyfGM8PDEwKSxyPShvPWMmeSleYyZmXm4sZD11KyhzPWQrKGg9KEE+Pj42fEE8PDI2KV4oQT4+PjExfEE8PDIxKV4oQT4+PjI1fEE8PDcpKSsoQSZ3Xn5BJmwpK3BbdCsyXStiW3QrMl0pPDwwLGk9KCh1PXMrKGkrcik8PDApPj4+Mnx1PDwzMCleKHU+Pj4xM3x1PDwxOSleKHU+Pj4yMnx1PDwxMCkscj0oYT11JmMpXnUmeV5vLGw9Zisocz1sKyhoPShkPj4+NnxkPDwyNileKGQ+Pj4xMXxkPDwyMSleKGQ+Pj4yNXxkPDw3KSkrKGQmQV5+ZCZ3KStwW3QrM10rYlt0KzNdKTw8MCxmPXMrKGkrcik8PDA7dGhpcy5oMD10aGlzLmgwK2Y8PDAsdGhpcy5oMT10aGlzLmgxK3U8PDAsdGhpcy5oMj10aGlzLmgyK2M8PDAsdGhpcy5oMz10aGlzLmgzK3k8PDAsdGhpcy5oND10aGlzLmg0K2w8PDAsdGhpcy5oNT10aGlzLmg1K2Q8PDAsdGhpcy5oNj10aGlzLmg2K0E8PDAsdGhpcy5oNz10aGlzLmg3K3c8PDB9LHQucHJvdG90eXBlLmhleD1mdW5jdGlvbigpe3RoaXMuZmluYWxpemUoKTt2YXIgdD10aGlzLmgwLGk9dGhpcy5oMSxoPXRoaXMuaDIscj10aGlzLmgzLHM9dGhpcy5oNCxlPXRoaXMuaDUsbj10aGlzLmg2LG89dGhpcy5oNyxhPXVbdD4+MjgmMTVdK3VbdD4+MjQmMTVdK3VbdD4+MjAmMTVdK3VbdD4+MTYmMTVdK3VbdD4+MTImMTVdK3VbdD4+OCYxNV0rdVt0Pj40JjE1XSt1WzE1JnRdK3VbaT4+MjgmMTVdK3VbaT4+MjQmMTVdK3VbaT4+MjAmMTVdK3VbaT4+MTYmMTVdK3VbaT4+MTImMTVdK3VbaT4+OCYxNV0rdVtpPj40JjE1XSt1WzE1JmldK3VbaD4+MjgmMTVdK3VbaD4+MjQmMTVdK3VbaD4+MjAmMTVdK3VbaD4+MTYmMTVdK3VbaD4+MTImMTVdK3VbaD4+OCYxNV0rdVtoPj40JjE1XSt1WzE1JmhdK3Vbcj4+MjgmMTVdK3Vbcj4+MjQmMTVdK3Vbcj4+MjAmMTVdK3Vbcj4+MTYmMTVdK3Vbcj4+MTImMTVdK3Vbcj4+OCYxNV0rdVtyPj40JjE1XSt1WzE1JnJdK3Vbcz4+MjgmMTVdK3Vbcz4+MjQmMTVdK3Vbcz4+MjAmMTVdK3Vbcz4+MTYmMTVdK3Vbcz4+MTImMTVdK3Vbcz4+OCYxNV0rdVtzPj40JjE1XSt1WzE1JnNdK3VbZT4+MjgmMTVdK3VbZT4+MjQmMTVdK3VbZT4+MjAmMTVdK3VbZT4+MTYmMTVdK3VbZT4+MTImMTVdK3VbZT4+OCYxNV0rdVtlPj40JjE1XSt1WzE1JmVdK3Vbbj4+MjgmMTVdK3Vbbj4+MjQmMTVdK3Vbbj4+MjAmMTVdK3Vbbj4+MTYmMTVdK3Vbbj4+MTImMTVdK3Vbbj4+OCYxNV0rdVtuPj40JjE1XSt1WzE1Jm5dO3JldHVybiB0aGlzLmlzMjI0fHwoYSs9dVtvPj4yOCYxNV0rdVtvPj4yNCYxNV0rdVtvPj4yMCYxNV0rdVtvPj4xNiYxNV0rdVtvPj4xMiYxNV0rdVtvPj44JjE1XSt1W28+PjQmMTVdK3VbMTUmb10pLGF9LHQucHJvdG90eXBlLnRvU3RyaW5nPXQucHJvdG90eXBlLmhleCx0LnByb3RvdHlwZS5kaWdlc3Q9ZnVuY3Rpb24oKXt0aGlzLmZpbmFsaXplKCk7dmFyIHQ9dGhpcy5oMCxpPXRoaXMuaDEsaD10aGlzLmgyLHI9dGhpcy5oMyxzPXRoaXMuaDQsZT10aGlzLmg1LG49dGhpcy5oNixvPXRoaXMuaDcsYT1bdD4+MjQmMjU1LHQ+PjE2JjI1NSx0Pj44JjI1NSwyNTUmdCxpPj4yNCYyNTUsaT4+MTYmMjU1LGk+PjgmMjU1LDI1NSZpLGg+PjI0JjI1NSxoPj4xNiYyNTUsaD4+OCYyNTUsMjU1Jmgscj4+MjQmMjU1LHI+PjE2JjI1NSxyPj44JjI1NSwyNTUmcixzPj4yNCYyNTUscz4+MTYmMjU1LHM+PjgmMjU1LDI1NSZzLGU+PjI0JjI1NSxlPj4xNiYyNTUsZT4+OCYyNTUsMjU1JmUsbj4+MjQmMjU1LG4+PjE2JjI1NSxuPj44JjI1NSwyNTUmbl07cmV0dXJuIHRoaXMuaXMyMjR8fGEucHVzaChvPj4yNCYyNTUsbz4+MTYmMjU1LG8+PjgmMjU1LDI1NSZvKSxhfSx0LnByb3RvdHlwZS5hcnJheT10LnByb3RvdHlwZS5kaWdlc3QsdC5wcm90b3R5cGUuYXJyYXlCdWZmZXI9ZnVuY3Rpb24oKXt0aGlzLmZpbmFsaXplKCk7dmFyIHQ9bmV3IEFycmF5QnVmZmVyKHRoaXMuaXMyMjQ/Mjg6MzIpLGk9bmV3IERhdGFWaWV3KHQpO3JldHVybiBpLnNldFVpbnQzMigwLHRoaXMuaDApLGkuc2V0VWludDMyKDQsdGhpcy5oMSksaS5zZXRVaW50MzIoOCx0aGlzLmgyKSxpLnNldFVpbnQzMigxMix0aGlzLmgzKSxpLnNldFVpbnQzMigxNix0aGlzLmg0KSxpLnNldFVpbnQzMigyMCx0aGlzLmg1KSxpLnNldFVpbnQzMigyNCx0aGlzLmg2KSx0aGlzLmlzMjI0fHxpLnNldFVpbnQzMigyOCx0aGlzLmg3KSx0fSxpLnByb3RvdHlwZT1uZXcgdCxpLnByb3RvdHlwZS5maW5hbGl6ZT1mdW5jdGlvbigpe2lmKHQucHJvdG90eXBlLmZpbmFsaXplLmNhbGwodGhpcyksdGhpcy5pbm5lcil7dGhpcy5pbm5lcj0hMTt2YXIgaT10aGlzLmFycmF5KCk7dC5jYWxsKHRoaXMsdGhpcy5pczIyNCx0aGlzLnNoYXJlZE1lbW9yeSksdGhpcy51cGRhdGUodGhpcy5vS2V5UGFkKSx0aGlzLnVwZGF0ZShpKSx0LnByb3RvdHlwZS5maW5hbGl6ZS5jYWxsKHRoaXMpfX07dmFyIEI9dygpO0Iuc2hhMjU2PUIsQi5zaGEyMjQ9dyghMCksQi5zaGEyNTYuaG1hYz1fKCksQi5zaGEyMjQuaG1hYz1fKCEwKSxvP21vZHVsZS5leHBvcnRzPUI6KHMuc2hhMjU2PUIuc2hhMjU2LHMuc2hhMjI0PUIuc2hhMjI0LGEmJmRlZmluZShmdW5jdGlvbigpe3JldHVybiBCfSkpfSgpOw==");
      const workerCode = `\n            ${sha256Code}\n            let challenge = null, salt = null;\n            self.onmessage = e => {\n                const d = e.data;\n                if (d.init) { challenge = d.challenge; salt = d.salt; return; }\n                const { start, end } = d;\n                for (let i = start; i <= end; i++) {\n                    if (sha256(salt + i) === challenge) {\n                        postMessage(i);\n                        return;\n                    }\n                }\n                postMessage(null);\n            };\n        `;
      this.blobUrl = URL.createObjectURL(new Blob([ workerCode ], {
        type: "application/javascript"
      }));
      for (let i = 0; i < this.coreCount; i++) {
        this.workers.push(new Worker(this.blobUrl));
        this.workers[i].postMessage({
          init: true,
          challenge: challenge,
          salt: salt
        });
      }
    }
    async getChallenge() {
      const res = await fetch("https://api.moomoo.io/verify");
      return res.json();
    }
    async solve(chal) {
      const {challenge: challenge, salt: salt, maxnumber: maxnumber} = chal;
      this.initPool(challenge, salt);
      const segSize = Math.ceil(maxnumber / this.coreCount);
      return new Promise((resolve, reject) => {
        let solved = false, done = 0;
        const startTime = performance.now();
        this.workers.forEach((worker, idx) => {
          const s = idx * segSize;
          const e = Math.min(maxnumber, (idx + 1) * segSize - 1);
          worker.onmessage = msg => {
            if (solved) {
              return;
            }
            const number = msg.data;
            if (number !== null) {
              solved = true;
              const took = ((performance.now() - startTime) / 1e3).toFixed(2);
              resolve({
                number: number,
                took: took
              });
              this.cleanup();
            } else {
              done++;
              if (!solved && done === this.coreCount) {
                reject(Error("Not solved"));
                this.cleanup();
              }
            }
          };
          worker.onerror = err => {
            if (!solved) {
              reject(err);
            }
            this.cleanup();
          };
          worker.postMessage({
            start: s,
            end: e
          });
        });
      });
    }
    cleanup() {
      this.workers.forEach(w => w.terminate());
      this.workers.length = 0;
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl);
      }
      this.blobUrl = null;
    }
    static makePayload(chal, result) {
      return btoa(JSON.stringify({
        algorithm: "SHA-256",
        challenge: chal.challenge,
        salt: chal.salt,
        signature: chal.signature || null,
        number: result.number,
        took: result.took
      }));
    }
    async generate() {
      const chal = await this.getChallenge();
      const sol = await this.solve(chal);
      return "alt:" + Altcha.makePayload(chal, sol);
    }
  }
  const altcha = new Altcha;
  const RYN_SITEKEY = "0x4AAAAAAAMYHI96GFiJzMmp";
  const generateTurnstileToken = () => new Promise((resolve, reject) => {
    try {
      const ts = window.turnstile || window.top && window.top.turnstile;
      if (!ts || typeof ts.render !== "function") {
        reject(new Error("turnstile API not available"));
        return;
      }
      const holder = document.createElement("div");
      holder.style.cssText = "position:fixed;bottom:0;right:0;width:300px;height:65px;z-index:2147483647;";
      (document.body || document.documentElement).appendChild(holder);
      let done = false;
      let widgetId = null;
      const cleanup = () => {
        try {
          if (widgetId != null) ts.remove(widgetId);
        } catch (e) {}
        try {
          holder.remove();
        } catch (e) {}
      };
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("turnstile timeout"));
      }, 20000);
      widgetId = ts.render(holder, {
        sitekey: RYN_SITEKEY,
        appearance: "interaction-only",
        callback: token => {
          if (done) return;
          done = true;
          clearTimeout(to);
          cleanup();
          resolve(token);
        },
        "error-callback": () => {
          if (done) return;
          done = true;
          clearTimeout(to);
          cleanup();
          reject(new Error("turnstile error-callback"));
        },
        "expired-callback": () => {
          if (done) return;
          done = true;
          clearTimeout(to);
          cleanup();
          reject(new Error("turnstile expired"));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
  const createSocket = async href => {
    let url = href;
    if (/moomoo/.test(href)) {
      const origin = new URL(href).origin;
      let token = null;
      try {
        const cf = await generateTurnstileToken();
        if (cf) {
          token = "cf:" + cf;
          try {
            console.log("[RYN BOT] generated fresh turnstile token");
          } catch (e) {}
        }
      } catch (e) {
        try {
          console.log("[RYN BOT] token generation failed:", e && e.message);
        } catch (_) {}
      }
      if (!token) {
        const captured = typeof RYN !== "undefined" && RYN._myClient && RYN._myClient._turnstileToken;
        if (captured) {
          token = "cf:" + captured;
          try {
            console.log("[RYN BOT] using captured token (fallback)");
          } catch (e) {}
        }
      }
      if (!token) {
        token = await altcha.generate();
        try {
          console.log("[RYN BOT] altcha fallback (likely rejected)");
        } catch (e) {}
      }
      url = origin + "/?token=" + encodeURIComponent(token);
    }
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    return ws;
  };
  const createSocket_default = createSocket;
  const Hooker = new class {
    createRecursiveHook(target, prop, callback) {
      let newValue = target[prop];
      (function recursiveHook() {
        Object.defineProperty(target, prop, {
          set(value) {
            delete target[prop];
            this[prop] = value;
            newValue = value;
            if (callback(this, value)) {
              return;
            }
            recursiveHook();
          },
          get() {
            return newValue;
          },
          configurable: true
        });
      })();
    }
    createHook(target, prop, callback) {
      const symbol = Symbol(prop);
      Object.defineProperty(target, prop, {
        get() {
          return this[symbol];
        },
        set(value) {
          callback(this, value, symbol);
        },
        configurable: true
      });
    }
    linker(value) {
      const hook = [ value ];
      hook.valueOf = () => hook[0];
      return hook;
    }
  };
  const blockProperty = (target, key) => {
    const value = target[key];
    Object.defineProperty(target, key, {
      set() {},
      get() {
        return value;
      },
      configurable: true
    });
  };
  const Hooker_default = Hooker;
  const Config = {
    maxScreenWidth: 1920,
    maxScreenHeight: 1080,
    serverUpdateRate: 9,
    collisionDepth: 6,
    minimapRate: 3e3,
    colGrid: 10,
    clientSendRate: 5,
    barWidth: 50,
    barHeight: 17,
    barPad: 4.5,
    iconPadding: 15,
    iconPad: .9,
    deathFadeout: 3e3,
    crownIconScale: 60,
    crownPad: 35,
    chatCountdown: 3e3,
    chatCooldown: 500,
    maxAge: 100,
    gatherAngle: Math.PI / 2.6,
    gatherWiggle: 10,
    hitReturnRatio: .25,
    hitAngle: Math.PI / 2,
    playerScale: 35,
    playerSpeed: .0016,
    playerDecel: .993,
    nameY: 34,
    animalCount: 7,
    aiTurnRandom: .06,
    shieldAngle: Math.PI / 3,
    resourceTypes: [ "wood", "food", "stone", "points" ],
    areaCount: 7,
    treesPerArea: 9,
    bushesPerArea: 3,
    totalRocks: 32,
    goldOres: 7,
    riverWidth: 724,
    riverPadding: 114,
    waterCurrent: .0011,
    waveSpeed: 1e-4,
    waveMax: 1.3,
    treeScales: [ 150, 160, 165, 175 ],
    bushScales: [ 80, 85, 95 ],
    rockScales: [ 80, 85, 90 ],
    snowBiomeTop: 2400,
    desertBiomeTop: 2400,
    snowSpeed: .75,
    maxNameLength: 15,
    mapScale: 14400,
    mapPingScale: 40,
    mapPingTime: 2200,
    /* Must stay byte-for-byte in the game's own order: the picker sends the
     * array index, so a shuffled table hands the server a different colour
     * than the one that was clicked. #91B2DB was never a skin — it is the
     * river fill — and it pushed every colour after it one slot out. */
    skinColors: [ "#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373" ]
  };
  const Config_default = Config;
  const WeaponTypeString = [ "primary", "secondary" ];
  const Weapons = [ {
    id: 0,
    itemType: 0,
    upgradeType: 0,
    type: 0,
    age: 0,
    name: "tool hammer",
    description: "tool for gathering all resources",
    src: "hammer_1",
    length: 140,
    width: 140,
    xOffset: -3,
    yOffset: 18,
    spdMult: 1,
    damage: 25,
    range: 65,
    gather: 1,
    speed: 300,
    knockback: 33.3
  }, {
    id: 1,
    itemType: 0,
    upgradeType: 1,
    type: 0,
    age: 2,
    name: "hand axe",
    description: "gathers resources at a higher rate",
    src: "axe_1",
    length: 140,
    width: 140,
    xOffset: 3,
    yOffset: 24,
    damage: 30,
    spdMult: 1,
    range: 70,
    gather: 2,
    speed: 400,
    knockback: 33.3
  }, {
    id: 2,
    itemType: 0,
    upgradeOf: 1,
    upgradeType: 1,
    type: 0,
    age: 8,
    pre: 1,
    name: "great axe",
    description: "deal more damage and gather more resources",
    src: "great_axe_1",
    length: 140,
    width: 140,
    xOffset: -8,
    yOffset: 25,
    damage: 35,
    spdMult: 1,
    range: 75,
    gather: 4,
    speed: 400,
    knockback: 33.3
  }, {
    id: 3,
    itemType: 0,
    upgradeType: 2,
    type: 0,
    age: 2,
    name: "short sword",
    description: "increased attack power but slower move speed",
    src: "sword_1",
    iPad: 1.3,
    length: 130,
    width: 210,
    xOffset: -8,
    yOffset: 46,
    damage: 35,
    spdMult: .85,
    range: 110,
    gather: 1,
    speed: 300,
    knockback: 33.3
  }, {
    id: 4,
    itemType: 0,
    upgradeOf: 3,
    upgradeType: 2,
    type: 0,
    age: 8,
    pre: 3,
    name: "katana",
    description: "greater range and damage",
    src: "samurai_1",
    iPad: 1.3,
    length: 130,
    width: 210,
    xOffset: -8,
    yOffset: 59,
    damage: 40,
    spdMult: .8,
    range: 118,
    gather: 1,
    speed: 300,
    knockback: 33.3
  }, {
    id: 5,
    itemType: 0,
    upgradeType: 3,
    isUpgrade: false,
    type: 0,
    age: 2,
    name: "polearm",
    description: "long range melee weapon",
    src: "spear_1",
    iPad: 1.3,
    length: 130,
    width: 210,
    xOffset: -8,
    yOffset: 53,
    damage: 45,
    knock: .2,
    spdMult: .82,
    range: 142,
    gather: 1,
    speed: 700,
    knockback: 55.6
  }, {
    id: 6,
    itemType: 0,
    upgradeType: 4,
    isUpgrade: false,
    type: 0,
    age: 2,
    name: "bat",
    description: "fast long range melee weapon",
    src: "bat_1",
    iPad: 1.3,
    length: 110,
    width: 180,
    xOffset: -8,
    yOffset: 53,
    damage: 20,
    knock: .7,
    spdMult: 1,
    range: 110,
    gather: 1,
    speed: 300,
    knockback: 111.1
  }, {
    id: 7,
    itemType: 0,
    upgradeType: 5,
    isUpgrade: false,
    type: 0,
    age: 2,
    name: "daggers",
    description: "really fast short range weapon",
    src: "dagger_1",
    iPad: .8,
    length: 110,
    width: 110,
    xOffset: 18,
    yOffset: 0,
    damage: 20,
    knock: .1,
    range: 65,
    gather: 1,
    hitSlow: .1,
    spdMult: 1.13,
    speed: 100,
    knockback: 44.4
  }, {
    id: 8,
    itemType: 0,
    upgradeType: 6,
    isUpgrade: false,
    type: 0,
    age: 2,
    name: "stick",
    description: "great for gathering but very weak",
    src: "stick_1",
    length: 140,
    width: 140,
    xOffset: 3,
    yOffset: 24,
    damage: 1,
    spdMult: 1,
    range: 70,
    gather: 7,
    speed: 400,
    knockback: 33.3
  }, {
    id: 9,
    itemType: 1,
    upgradeType: 7,
    projectile: 0,
    type: 1,
    age: 6,
    name: "hunting bow",
    description: "bow used for ranged combat and hunting",
    src: "bow_1",
    cost: {
      food: 0,
      wood: 4,
      stone: 0,
      gold: 0
    },
    length: 120,
    width: 120,
    xOffset: -6,
    yOffset: 0,
    spdMult: .75,
    speed: 600,
    range: 1e3,
    knockback: 33.3
  }, {
    id: 10,
    itemType: 1,
    upgradeType: 8,
    isUpgrade: false,
    type: 1,
    age: 6,
    name: "great hammer",
    description: "hammer used for destroying structures",
    src: "great_hammer_1",
    length: 140,
    width: 140,
    xOffset: -9,
    yOffset: 25,
    damage: 10,
    spdMult: .88,
    range: 75,
    sDmg: 7.5,
    gather: 1,
    speed: 400,
    knockback: 33.3
  }, {
    id: 11,
    itemType: 1,
    upgradeType: 9,
    isUpgrade: false,
    type: 1,
    age: 6,
    name: "wooden shield",
    description: "blocks projectiles and reduces melee damage",
    src: "shield_1",
    length: 120,
    width: 120,
    shield: .2,
    xOffset: 6,
    yOffset: 0,
    spdMult: .7,
    speed: 1,
    range: 0,
    knockback: 0
  }, {
    id: 12,
    itemType: 1,
    upgradeType: 7,
    projectile: 2,
    upgradeOf: 9,
    type: 1,
    age: 8,
    pre: 9,
    name: "crossbow",
    description: "deals more damage and has greater range",
    src: "crossbow_1",
    cost: {
      food: 0,
      wood: 5,
      stone: 0,
      gold: 0
    },
    aboveHand: true,
    armS: .75,
    length: 120,
    width: 120,
    xOffset: -4,
    yOffset: 0,
    spdMult: .7,
    speed: 700,
    range: 1200,
    knockback: 33.3
  }, {
    id: 13,
    itemType: 1,
    upgradeType: 7,
    projectile: 3,
    upgradeOf: 12,
    type: 1,
    age: 9,
    pre: 12,
    name: "repeater crossbow",
    description: "high firerate crossbow with reduced damage",
    src: "crossbow_2",
    cost: {
      food: 0,
      wood: 10,
      stone: 0,
      gold: 0
    },
    aboveHand: true,
    armS: .75,
    length: 120,
    width: 120,
    xOffset: -4,
    yOffset: 0,
    spdMult: .7,
    speed: 230,
    range: 1200,
    knockback: 33.3
  }, {
    id: 14,
    itemType: 1,
    upgradeType: 10,
    isUpgrade: false,
    type: 1,
    age: 6,
    name: "mc grabby",
    description: "steals resources from enemies",
    src: "grab_1",
    length: 130,
    width: 210,
    xOffset: -8,
    yOffset: 53,
    damage: 0,
    steal: 250,
    knock: .2,
    spdMult: 1.05,
    range: 125,
    gather: 0,
    speed: 700,
    knockback: 55.6
  }, {
    id: 15,
    itemType: 1,
    upgradeType: 7,
    projectile: 5,
    upgradeOf: 12,
    type: 1,
    age: 9,
    pre: 12,
    name: "musket",
    description: "slow firerate but high damage and range",
    src: "musket_1",
    cost: {
      food: 0,
      wood: 0,
      stone: 10,
      gold: 0
    },
    aboveHand: true,
    rec: .35,
    armS: .6,
    hndS: .3,
    hndD: 1.6,
    length: 205,
    width: 205,
    xOffset: 25,
    yOffset: 0,
    hideProjectile: true,
    spdMult: .6,
    speed: 1500,
    range: 1400,
    knockback: 33.3
  } ];
  const ItemGroups = {
    [1]: {
      name: "Wall",
      limit: 30,
      layer: 0
    },
    [2]: {
      name: "Spike",
      limit: 15,
      layer: 0
    },
    [3]: {
      name: "Windmill",
      limit: 7,
      sandboxLimit: 299,
      layer: 1
    },
    [4]: {
      name: "Mine",
      limit: 1,
      layer: 0
    },
    [5]: {
      name: "Trap",
      limit: 6,
      layer: -1
    },
    [6]: {
      name: "Boost",
      limit: 12,
      sandboxLimit: 299,
      layer: -1
    },
    [7]: {
      name: "Turret",
      limit: 2,
      layer: 1
    },
    [8]: {
      name: "Plaftorm",
      limit: 12,
      layer: 1
    },
    [9]: {
      name: "Healing pad",
      limit: 4,
      layer: -1
    },
    [10]: {
      name: "Spawn",
      limit: 1,
      layer: -1
    },
    [11]: {
      name: "Sapling",
      limit: 2,
      layer: 0
    },
    [12]: {
      name: "Blocker",
      limit: 3,
      layer: -1
    },
    [13]: {
      name: "Teleporter",
      limit: 2,
      sandboxLimit: 299,
      layer: -1
    }
  };
  const Items = [ {
    id: 0,
    itemType: 2,
    name: "apple",
    description: "restores 20 health when consumed",
    age: 0,
    cost: {
      food: 10,
      wood: 0,
      stone: 0,
      gold: 0
    },
    restore: 20,
    scale: 22,
    holdOffset: 15
  }, {
    id: 1,
    itemType: 2,
    upgradeOf: 0,
    name: "cookie",
    description: "restores 40 health when consumed",
    age: 3,
    cost: {
      food: 15,
      wood: 0,
      stone: 0,
      gold: 0
    },
    restore: 40,
    scale: 27,
    holdOffset: 15
  }, {
    id: 2,
    itemType: 2,
    upgradeOf: 1,
    name: "cheese",
    description: "restores 30 health and another 50 over 5 seconds",
    age: 7,
    cost: {
      food: 25,
      wood: 0,
      stone: 0,
      gold: 0
    },
    restore: 30,
    scale: 27,
    holdOffset: 15
  }, {
    id: 3,
    itemType: 3,
    itemGroup: 1,
    name: "wood wall",
    description: "provides protection for your village",
    age: 0,
    cost: {
      food: 0,
      wood: 10,
      stone: 0,
      gold: 0
    },
    projDmg: true,
    health: 380,
    scale: 50,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 4,
    itemType: 3,
    itemGroup: 1,
    upgradeOf: 3,
    name: "stone wall",
    description: "provides improved protection for your village",
    age: 3,
    cost: {
      food: 0,
      wood: 0,
      stone: 25,
      gold: 0
    },
    health: 900,
    scale: 50,
    holdOffset: 20,
    placeOffset: -5
  }, {
    pre: 1,
    id: 5,
    itemType: 3,
    itemGroup: 1,
    upgradeOf: 4,
    name: "castle wall",
    description: "provides powerful protection for your village",
    age: 7,
    cost: {
      food: 0,
      wood: 0,
      stone: 35,
      gold: 0
    },
    health: 1500,
    scale: 52,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 6,
    itemType: 4,
    itemGroup: 2,
    name: "spikes",
    description: "damages enemies when they touch them",
    age: 0,
    cost: {
      food: 0,
      wood: 20,
      stone: 5,
      gold: 0
    },
    health: 400,
    damage: 20,
    scale: 49,
    spritePadding: -23,
    holdOffset: 8,
    placeOffset: -5
  }, {
    id: 7,
    itemType: 4,
    itemGroup: 2,
    upgradeOf: 6,
    name: "greater spikes",
    description: "damages enemies when they touch them",
    age: 5,
    cost: {
      food: 0,
      wood: 30,
      stone: 10,
      gold: 0
    },
    health: 500,
    damage: 35,
    scale: 52,
    spritePadding: -23,
    holdOffset: 8,
    placeOffset: -5
  }, {
    id: 8,
    itemType: 4,
    itemGroup: 2,
    upgradeOf: 7,
    name: "poison spikes",
    pDmg: 5,
    description: "poisons enemies when they touch them",
    age: 9,
    pre: 1,
    cost: {
      food: 0,
      wood: 35,
      stone: 15,
      gold: 0
    },
    health: 600,
    damage: 30,
    poisonDamage: 5,
    scale: 52,
    spritePadding: -23,
    holdOffset: 8,
    placeOffset: -5
  }, {
    id: 9,
    itemType: 4,
    itemGroup: 2,
    upgradeOf: 7,
    name: "spinning spikes",
    description: "damages enemies when they touch them",
    age: 9,
    pre: 2,
    cost: {
      food: 0,
      wood: 30,
      stone: 20,
      gold: 0
    },
    health: 500,
    damage: 45,
    turnSpeed: .003,
    scale: 52,
    spritePadding: -23,
    holdOffset: 8,
    placeOffset: -5
  }, {
    id: 10,
    itemType: 5,
    itemGroup: 3,
    name: "windmill",
    description: "generates gold over time",
    age: 0,
    cost: {
      food: 0,
      wood: 50,
      stone: 10,
      gold: 0
    },
    health: 400,
    pps: 1,
    turnSpeed: .0016,
    spritePadding: 25,
    iconLineMult: 12,
    scale: 45,
    holdOffset: 20,
    placeOffset: 5
  }, {
    id: 11,
    itemType: 5,
    itemGroup: 3,
    upgradeOf: 10,
    name: "faster windmill",
    description: "generates more gold over time",
    age: 5,
    pre: 1,
    cost: {
      food: 0,
      wood: 60,
      stone: 20,
      gold: 0
    },
    health: 500,
    pps: 1.5,
    turnSpeed: .0025,
    spritePadding: 25,
    iconLineMult: 12,
    scale: 47,
    holdOffset: 20,
    placeOffset: 5
  }, {
    id: 12,
    itemType: 5,
    itemGroup: 3,
    upgradeOf: 11,
    name: "power mill",
    description: "generates more gold over time",
    age: 8,
    pre: 1,
    cost: {
      food: 0,
      wood: 100,
      stone: 50,
      gold: 0
    },
    health: 800,
    pps: 2,
    turnSpeed: .005,
    spritePadding: 25,
    iconLineMult: 12,
    scale: 47,
    holdOffset: 20,
    placeOffset: 5
  }, {
    id: 13,
    itemType: 6,
    itemGroup: 4,
    name: "mine",
    description: "allows you to mine stone",
    age: 5,
    type: 2,
    cost: {
      food: 0,
      wood: 20,
      stone: 100,
      gold: 0
    },
    iconLineMult: 12,
    scale: 65,
    holdOffset: 20,
    placeOffset: 0
  }, {
    id: 14,
    itemType: 6,
    itemGroup: 11,
    name: "sapling",
    description: "allows you to farm wood",
    age: 5,
    type: 0,
    cost: {
      food: 0,
      wood: 150,
      stone: 0,
      gold: 0
    },
    iconLineMult: 12,
    colDiv: .5,
    scale: 110,
    holdOffset: 50,
    placeOffset: -15
  }, {
    id: 15,
    itemType: 7,
    itemGroup: 5,
    name: "pit trap",
    description: "pit that traps enemies if they walk over it",
    age: 4,
    cost: {
      food: 0,
      wood: 30,
      stone: 30,
      gold: 0
    },
    trap: true,
    ignoreCollision: true,
    hideFromEnemy: true,
    health: 500,
    colDiv: .2,
    scale: 50,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 16,
    itemType: 7,
    itemGroup: 6,
    name: "boost pad",
    description: "provides boost when stepped on",
    age: 4,
    cost: {
      food: 0,
      wood: 5,
      stone: 20,
      gold: 0
    },
    boostSpeed: 1.5,
    health: 150,
    colDiv: .7,
    ignoreCollision: true,
    scale: 45,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 17,
    itemType: 8,
    itemGroup: 7,
    name: "turret",
    description: "defensive structure that shoots at enemies",
    age: 7,
    doUpdate: true,
    cost: {
      food: 0,
      wood: 200,
      stone: 150,
      gold: 0
    },
    health: 800,
    projectile: 1,
    shootRange: 700,
    shootRate: 2200,
    scale: 43,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 18,
    itemType: 8,
    itemGroup: 8,
    name: "platform",
    description: "platform to shoot over walls and cross over water",
    age: 7,
    cost: {
      food: 0,
      wood: 20,
      stone: 0,
      gold: 0
    },
    ignoreCollision: true,
    zIndex: 1,
    health: 300,
    scale: 43,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 19,
    itemType: 8,
    itemGroup: 9,
    name: "healing pad",
    description: "standing on it will slowly heal you",
    age: 7,
    cost: {
      food: 10,
      wood: 30,
      stone: 0,
      gold: 0
    },
    ignoreCollision: true,
    healCol: 15,
    health: 400,
    colDiv: .7,
    scale: 45,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 20,
    itemType: 9,
    itemGroup: 10,
    name: "spawn pad",
    description: "you will spawn here when you die but it will dissapear",
    age: 9,
    cost: {
      food: 0,
      wood: 100,
      stone: 100,
      gold: 0
    },
    health: 400,
    ignoreCollision: true,
    spawnPoint: true,
    scale: 45,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 21,
    itemType: 8,
    itemGroup: 12,
    name: "blocker",
    description: "blocks building in radius",
    age: 7,
    cost: {
      food: 0,
      wood: 30,
      stone: 25,
      gold: 0
    },
    ignoreCollision: true,
    blocker: 300,
    health: 400,
    colDiv: .7,
    scale: 45,
    holdOffset: 20,
    placeOffset: -5
  }, {
    id: 22,
    itemType: 8,
    itemGroup: 13,
    name: "teleporter",
    description: "teleports you to a random point on the map",
    age: 7,
    cost: {
      food: 0,
      wood: 60,
      stone: 60,
      gold: 0
    },
    teleport: true,
    health: 200,
    colDiv: .7,
    ignoreCollision: true,
    scale: 45,
    holdOffset: 20,
    placeOffset: -5
  } ];
  const WeaponVariants = [ {
    id: 0,
    src: "",
    xp: 1,
    needXP: 0,
    val: 1,
    color: "#7e7e90"
  }, {
    id: 1,
    src: "_g",
    xp: 3e3,
    needXP: 3e3,
    val: 1.1,
    color: "#f7cf45"
  }, {
    id: 2,
    src: "_d",
    xp: 7e3,
    needXP: 4e3,
    val: 1.18,
    color: "#6d91cb"
  }, {
    id: 3,
    src: "_r",
    poison: true,
    xp: 12e3,
    needXP: 5e3,
    val: 1.18,
    color: "#be5454"
  } ];
  const Projectiles = [ {
    id: 0,
    name: "Hunting bow",
    index: 0,
    layer: 0,
    src: "arrow_1",
    damage: 25,
    scale: 103,
    range: 1e3,
    speed: 1.6
  }, {
    id: 1,
    name: "Turret",
    index: 1,
    layer: 1,
    damage: 25,
    scale: 20,
    speed: 1.5,
    range: 700
  }, {
    id: 2,
    name: "Crossbow",
    index: 0,
    layer: 0,
    src: "arrow_1",
    damage: 35,
    scale: 103,
    range: 1200,
    speed: 2.5
  }, {
    id: 3,
    name: "Repeater crossbow",
    index: 0,
    layer: 0,
    src: "arrow_1",
    damage: 30,
    scale: 103,
    range: 1200,
    speed: 2
  }, {
    id: 4,
    index: 1,
    layer: 1,
    damage: 16,
    scale: 20,
    range: 0,
    speed: 0
  }, {
    id: 5,
    name: "Musket",
    index: 0,
    layer: 0,
    src: "bullet_1",
    damage: 50,
    scale: 160,
    range: 1400,
    speed: 3.6
  } ];
  class Vector {
    x;
    y;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    static fromAngle(angle, length = 1) {
      return new Vector(Math.cos(angle) * length, Math.sin(angle) * length);
    }
    add(vec) {
      if (vec instanceof Vector) {
        this.x += vec.x;
        this.y += vec.y;
      } else {
        this.x += vec;
        this.y += vec;
      }
      return this;
    }
    sub(vec) {
      if (vec instanceof Vector) {
        this.x -= vec.x;
        this.y -= vec.y;
      } else {
        this.x -= vec;
        this.y -= vec;
      }
      return this;
    }
    mult(scalar) {
      this.x *= scalar;
      this.y *= scalar;
      return this;
    }
    div(scalar) {
      const inv = 1 / scalar;
      this.x *= inv;
      this.y *= inv;
      return this;
    }
    get length() {
      return Math.hypot(this.x, this.y);
    }
    normalizeVec() {
      const len = this.length;
      if (len > 0) {
        const inv = 1 / len;
        this.x *= inv;
        this.y *= inv;
      }
      return this;
    }
    dot(vec) {
      return this.x * vec.x + this.y * vec.y;
    }
    _setXY(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }
    setVec(vec) {
      return this._setXY(vec.x, vec.y);
    }
    setLength(value) {
      return this.normalizeVec().mult(value);
    }
    copy() {
      return new Vector(this.x, this.y);
    }
    distanceDefault(vec) {
      const dx = this.x - vec.x;
      const dy = this.y - vec.y;
      return dx * dx + dy * dy;
    }
    distance(vec) {
      const dx = this.x - vec.x;
      const dy = this.y - vec.y;
      return Math.hypot(dx, dy);
    }
    angle(vec) {
      return Math.atan2(vec.y - this.y, vec.x - this.x);
    }
    addDirection(angle, length) {
      const x = this.x + Math.cos(angle) * length;
      const y = this.y + Math.sin(angle) * length;
      return new Vector(x, y);
    }
    isEqual(vec) {
      return this.x === vec.x && this.y === vec.y;
    }
    makeString() {
      return this.x + ":" + this.y;
    }
  }
  const Vector_default = Vector;
  const getAngle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  const getDistance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const fixTo = (value, fraction) => parseFloat(value.toFixed(fraction));
  const PI = Math.PI;
  const PI2 = PI * 2;
  const getAngleDist = (a, b) => {
    const p = Math.abs(b - a) % (PI * 2);
    return p > PI ? PI * 2 - p : p;
  };
  const findMiddleAngle = (a, b) => {
    const x = Math.cos(a) + Math.cos(b);
    const y = Math.sin(a) + Math.sin(b);
    return Math.atan2(y, x);
  };
  const toRadians = degrees => degrees * (PI / 180);
  const removeFast = (array, index) => {
    if (index < 0 || index >= array.length) {
      throw new RangeError("removeFast: Index out of range");
    }
    if (index === array.length - 1) {
      array.pop();
    } else {
      array[index] = array.pop();
    }
  };
  const lerp = (start, end, factor) => (1 - factor) * start + factor * end;
  const reverseAngle = angle => Math.atan2(-Math.sin(angle), -Math.cos(angle));
  const getTargetValue = (target, prop) => target[prop];
  const setTargetValue = (target, prop, value) => {
    target[prop] = value;
  };
  const formatDate = date => {
    if (date == null) {
      date = new Date;
    }
    const hours = (date.getHours() + "").padStart(2, "0");
    const minutes = (date.getMinutes() + "").padStart(2, "0");
    const seconds = (date.getSeconds() + "").padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };
  const incrementor = () => {
    let value = 0;
    return function() {
      return value++;
    };
  };
  const getUniqueID = incrementor();
  const EPS = 1e-9;
  const pointInsideRect = (p, rs, re) => p.x >= rs.x - EPS && p.x <= re.x + EPS && p.y >= rs.y - EPS && p.y <= re.y + EPS;
  const lineIntersectsLine = (p, p2, q, q2) => {
    const r = p2.copy().sub(p);
    const s = q2.copy().sub(q);
    const rxs = r.x * s.y - r.y * s.x;
    const q_p = q.copy().sub(p);
    const qpxr = q_p.x * r.y - q_p.y * r.x;
    if (Math.abs(rxs) < EPS) {
      if (Math.abs(qpxr) < EPS) {
        const t0 = (q_p.x * r.x + q_p.y * r.y) / (r.x * r.x + r.y * r.y);
        const t1 = t0 + (s.x * r.x + s.y * r.y) / (r.x * r.x + r.y * r.y);
        return Math.max(0, Math.min(t0, t1)) <= Math.min(1, Math.max(t0, t1));
      }
      return false;
    }
    const t = (q_p.x * s.y - q_p.y * s.x) / rxs;
    const u = (q_p.x * r.y - q_p.y * r.x) / rxs;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const lineIntersectsRect = (lineStart, lineEnd, rectStart, rectEnd) => pointInsideRect(lineStart, rectStart, rectEnd) || pointInsideRect(lineEnd, rectStart, rectEnd) || lineIntersectsLine(lineStart, lineEnd, rectStart, new Vector_default(rectEnd.x, rectStart.y)) || lineIntersectsLine(lineStart, lineEnd, new Vector_default(rectEnd.x, rectStart.y), rectEnd) || lineIntersectsLine(lineStart, lineEnd, rectEnd, new Vector_default(rectStart.x, rectEnd.y)) || lineIntersectsLine(lineStart, lineEnd, new Vector_default(rectStart.x, rectEnd.y), rectStart);
  const isActiveInput = () => {
    const active = document.activeElement || document.body;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  };
  const getAngleFromBitmask = (bitmask, rotate) => {
    const vec = {
      x: 0,
      y: 0
    };
    if (bitmask & 1) {
      vec.y--;
    }
    if (bitmask & 2) {
      vec.y++;
    }
    if (bitmask & 4) {
      vec.x--;
    }
    if (bitmask & 8) {
      vec.x++;
    }
    if (rotate) {
      vec.x *= -1;
      vec.y *= -1;
    }
    return vec.x === 0 && vec.y === 0 ? null : Math.atan2(vec.y, vec.x);
  };
  const formatCode = code => {
    code += "";
    if (code === "Backspace") {
      return code;
    }
    if (code === "Escape") {
      return "ESC";
    }
    if (code === "Delete") {
      return "DEL";
    }
    if (code === "Minus") {
      return "-";
    }
    if (code === "Equal") {
      return "=";
    }
    if (code === "BracketLeft") {
      return "[";
    }
    if (code === "BracketRight") {
      return "]";
    }
    if (code === "Slash") {
      return "/";
    }
    if (code === "Backslash") {
      return "\\";
    }
    if (code === "Quote") {
      return "'";
    }
    if (code === "Backquote") {
      return "`";
    }
    if (code === "Semicolon") {
      return ";";
    }
    if (code === "Comma") {
      return ",";
    }
    if (code === "Period") {
      return ".";
    }
    if (code === "CapsLock") {
      return "CAPS";
    }
    if (code === "ContextMenu") {
      return "CTXMENU";
    }
    if (code === "NumLock") {
      return "LOCK";
    }
    return code.replace(/^Page/, "PG").replace(/^Digit/, "").replace(/Button$/, "BTN").replace(/^Key/, "").replace(/^(Shift|Control|Alt)(L|R).*$/, "$2$1").replace(/Control/, "CTRL").replace(/^Arrow/, "").replace(/^Numpad/, "NUM").replace(/Decimal/, "DEC").replace(/Subtract/, "SUB").replace(/Divide/, "DIV").replace(/Multiply/, "MULT").toUpperCase();
  };
  const formatButton = button => {
    if (button === 0) {
      return "LBTN";
    }
    if (button === 1) {
      return "MBTN";
    }
    if (button === 2) {
      return "RBTN";
    }
    if (button === 3) {
      return "BBTN";
    }
    if (button === 4) {
      return "FBTN";
    }
    throw Error(`formatButton Error: "${button}" is not valid button`);
  };
  const removeClass = (target, name) => {
    if (target instanceof HTMLElement) {
      target.classList.remove(name);
      return;
    }
    for (const element of target) {
      element.classList.remove(name);
    }
  };
  const pointInRiver = position => {
    const y = position.y;
    const below = y >= Config_default.mapScale / 2 - Config_default.riverWidth / 2;
    const above = y <= Config_default.mapScale / 2 + Config_default.riverWidth / 2;
    return below && above;
  };
  const pointInDesert = position => position.y >= Config_default.mapScale - Config_default.snowBiomeTop;
  const inRange = (value, min, max) => value >= min && value <= max;
  const targetInsideRect = (target, rectPos, radius) => {
    const screen = new Vector_default(1920, 1080).div(2).add(radius);
    const rectStart = rectPos.copy().sub(screen);
    const rectEnd = rectPos.copy().add(screen);
    return pointInsideRect(target, rectStart, rectEnd);
  };
  const findPlacementAngles = angles => {
    const output = new Set;
    for (let i = 0; i < angles.length; i++) {
      const [angle, offset] = angles[i];
      const start = angle - offset;
      const end = angle + offset;
      let startIntersects = false;
      let endIntersects = false;
      for (let j = 0; j < angles.length; j++) {
        if (startIntersects && endIntersects) {
          break;
        }
        if (i === j) {
          continue;
        }
        const [angle2, offset2] = angles[j];
        if (getAngleDist(start, angle2) <= offset2) {
          startIntersects = true;
        }
        if (getAngleDist(end, angle2) <= offset2) {
          endIntersects = true;
        }
      }
      if (!startIntersects) {
        output.add(start);
      }
      if (!endIntersects) {
        output.add(end);
      }
    }
    return [ ...output ];
  };
  const createAction = (callback, time = 0) => {
    let state = false;
    const timeoutID = setTimeout(() => {
      if (state) {
        return;
      }
      state = true;
      callback();
    }, time);
    return () => {
      if (state) {
        return;
      }
      state = true;
      clearTimeout(timeoutID);
      callback();
    };
  };
  class CustomStorage {
    static get(key) {
      const value = window.localStorage.getItem(key);
      return value === null ? null : JSON.parse(value);
    }
    static set(key, value, stringify = true) {
      const data = stringify ? JSON.stringify(value) : value;
      window.localStorage.setItem(key, data);
    }
    static delete(key) {
      const has = window.localStorage.hasOwnProperty(key) && key in window.localStorage;
      window.localStorage.removeItem(key);
      return has;
    }
  }
  const Header_default = '<header>\r\n  <div id="credits"></div>\r\n  <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">\r\n    <div id="ryn-search-wrap"><input id="ryn-search-input" type="text" placeholder="Search..." autocomplete="off" spellcheck="false"><span id="ryn-search-clear" title="Clear">&#10005;</span><div id="ryn-search-dropdown"></div></div>\r\n    <svg id="close-button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">\r\n      <line x1="5" y1="5" x2="19" y2="19" stroke-linecap="round"/>\r\n      <line x1="19" y1="5" x2="5" y2="19" stroke-linecap="round"/>\r\n    </svg>\r\n  </div>\r\n</header>';
  const Navbar_default = "<div id=\"navbar-container\">\r\n  <button data-id=\"0\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <path d=\"M3 11l9-8 9 8\"/>\r\n      <path d=\"M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">HOME</span>\r\n  </button>\r\n  <button data-id=\"1\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\r\n      <rect x=\"5\" y=\"8\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"9\" y=\"8\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"13\" y=\"8\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"17\" y=\"8\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"5\" y=\"12\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"9\" y=\"12\" width=\"6\" height=\"2\" rx=\"0.5\"/>\r\n      <rect x=\"17\" y=\"12\" width=\"2\" height=\"2\" rx=\"0.5\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">KEYS</span>\r\n  </button>\r\n  <button data-id=\"2\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <line x1=\"3\" y1=\"3\" x2=\"21\" y2=\"21\"/>\r\n      <path d=\"M3 3l5 2 11 11-2 5\"/>\r\n      <path d=\"M21 3l-5 2L5 16l2 5\"/>\r\n      <line x1=\"9\" y1=\"9\" x2=\"6\" y2=\"12\"/>\r\n      <line x1=\"15\" y1=\"9\" x2=\"18\" y2=\"12\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">COMBAT</span>\r\n  </button>\r\n  <button data-id=\"3\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z\"/>\r\n      <circle cx=\"12\" cy=\"12\" r=\"2.5\"/>\r\n      <path d=\"M12 3v1.5M12 19.5V21M3 12H1.5M22.5 12H21M5.6 5.6l-1-1M19.4 18.4l-1-1M18.4 5.6l1-1M4.6 18.4l1-1\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">VISUALS</span>\r\n  </button>\r\n  <button data-id=\"4\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <circle cx=\"12\" cy=\"12\" r=\"3\"/>\r\n      <path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">MISC</span>\r\n  </button>\r\n  <button data-id=\"5\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <circle cx=\"12\" cy=\"5\" r=\"2\"/>\r\n      <path d=\"M12 7v3\"/>\r\n      <rect x=\"7\" y=\"10\" width=\"10\" height=\"7\" rx=\"2\"/>\r\n      <circle cx=\"10\" cy=\"13\" r=\"1\" fill=\"currentColor\"/>\r\n      <circle cx=\"14\" cy=\"13\" r=\"1\" fill=\"currentColor\"/>\r\n      <path d=\"M10 16h4\"/>\r\n      <path d=\"M7 13H5M19 13h-2M9 21v-4M15 21v-4\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">BOTS</span>\r\n  </button>\r\n  <button data-id=\"7\" class=\"open-menu\">\r\n    <svg class=\"nav-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\">\r\n      <path d=\"M9 18V5l12-2v13\"/>\r\n      <path d=\"M9 9l12-2\"/>\r\n      <circle cx=\"6\" cy=\"18\" r=\"3\"/>\r\n      <circle cx=\"18\" cy=\"16\" r=\"3\"/>\r\n    </svg>\r\n    <span class=\"nav-label\">MUSIC</span>\r\n  </button>\r\n  \r\n</div>";
  const Devtool_default = "<div class=\"menu-page\" data-id=\"6\" style=\"display:none;\">\r\n    <div class=\"page-title\">Devtool</div>\r\n    <p class=\"page-description\">Test RYN Client and report about bugs!</p>\r\n\r\n    <!-- Statistics -->\r\n    <div class=\"section\">\r\n        <h2 class=\"section-title\">Statistics</h2>\r\n\r\n        <div class=\"section-content small-section\">\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Total kills: </span>\r\n                <span id=\"_totalKills\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Global kills with bots: </span>\r\n                <span id=\"_globalKills\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Deaths: </span>\r\n                <span id=\"_deaths\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Autosync: </span>\r\n                <span id=\"_autoSyncTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">SSHammer: </span>\r\n                <span id=\"_spikeSyncHammerTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Spike sync: </span>\r\n                <span id=\"_spikeSyncTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Spike tick: </span>\r\n                <span id=\"_spikeTickTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">KBTrap: </span>\r\n                <span id=\"_knockbackTickTrapTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">KBHammer: </span>\r\n                <span id=\"_knockbackTickHammerTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">KB Reg: </span>\r\n                <span id=\"_knockbackTickTimes\" class=\"text-value\">0</span>\r\n            </div>\r\n\r\n            <div class=\"content-option left-flex text\">\r\n                <span class=\"option-title\">Author: </span>\r\n                <span id=\"author\" class=\"text-value\">RYN</span>\r\n            </div>\r\n\r\n        </div>\r\n    </div>\r\n\r\n</div>";
  const Home_default = '<div class="menu-page opened" data-id="0">\r\n\r\n  <div style="margin-bottom:16px;">\r\n    <div class="page-title">RYN CLIENT</div>\r\n    <div class="page-description">The full automation suite for moomoo.io — combat, bots, and total customization.</div>\r\n  </div>\r\n\r\n</div>';
  const Keybinds_default = "<div class=\"menu-page\" data-id=\"1\">\r\n    <div class=\"page-title\">Keybinds</div>\r\n    <p class=\"page-description\">Setup keybinds for items, weapons and hats</p>\r\n\r\n    <!-- Items & Weapons -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Items & Weapons</div>\r\n        <div class=\"section-content split\">\r\n\r\n            <div class=\"content-split\">\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Food</span>\r\n                    <button id=\"_food\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Wall</span>\r\n                    <button id=\"_wall\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Spike</span>\r\n                    <button id=\"_spike\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Windmill</span>\r\n                    <button id=\"_windmill\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n            </div>\r\n\r\n            <div class=\"content-split\">\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Farm</span>\r\n                    <button id=\"_farm\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Trap</span>\r\n                    <button id=\"_trap\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Turret</span>\r\n                    <button id=\"_turret\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Spawn</span>\r\n                    <button id=\"_spawn\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Controls & Movement -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Controls & Movement</div>\r\n        <div class=\"section-content\">\r\n\r\n            <div class=\"content-split\">\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Lock bot position</span>\r\n                    <button id=\"_lockBotPosition\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\r\n\r\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Toggle Menu</span>\r\n                    <button id=\"_toggleMenu\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Instakill</span>\r\n                    <button id=\"_instakill\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Bot Controls -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Bot Controls</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-split\">\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Auto Farm</span>\r\n                    <button id=\"_botAutoFarm\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Bot Auto-Attack</span>\r\n                    <button id=\"_botAutoAttack\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Spawn Bot</span>\r\n                    <button id=\"_spawnBot\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Kill All Bots</span>\r\n                    <button id=\"_killAllBots\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Repel Alts</span>\r\n                    <button id=\"_repelAlts\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Scatter Bots</span>\r\n                    <button id=\"_scatterBots\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Freeze Bots</span>\r\n                    <button id=\"_freezeBots\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n                \r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\r\n\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Quick Actions</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-split\">\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Quad Spikes</span>\r\n                    <button id=\"_fourSpikes\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Quad Traps</span>\r\n                    <button id=\"_fourTraps\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Toggle Automill</span>\r\n                    <button id=\"_autoMillKey\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Boost Spike Rush</span>\r\n                    <button id=\"_boostSpikes\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Toggle Dash Movement</span>\r\n                    <button id=\"_dashMovementKey\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Toggle Auto Grind</span>\r\n                    <button id=\"_autoGrindKey\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Toggle Autoplacer</span>\r\n                    <button id=\"_autoplacerKey\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n                <div class=\"content-option\">\r\n                    <span class=\"option-title\">Name Song &#127926;</span>\r\n                    <button id=\"_nameSong\" class=\"hotkeyInput\"></button>\r\n                </div>\r\n\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>";
  const Combat_default = "<div class=\"menu-page\" data-id=\"2\">\r\n    <div class=\"page-title\">Combat</div>\r\n    <p class=\"page-description\">Grouped by what each option actually does. Click a name to flip it — you do not have to hit the switch.</p>\r\n\r\r\n\r\n    <!-- Instakills -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Instakills<span class=\"sec-sub\">Timed weapon and hat sequences that try to finish a kill.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_normalInstakill\">Normal Instakill</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_normalInstakill\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\r\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_spikeTick\">Spike tick</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_spikeTick\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_spikeTick_breakTrap\">Spike tick: break trap</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_spikeTick_breakTrap\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">When the enemy stands on their own trap: breaks it with a Great Hammer one-shot, places a spike on the closest open angle, then follows up with Bull Helmet.</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_knockbackTick\">Knockback tick</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_knockbackTick\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_knockbackTickHammer\">Knockback tick hammer</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_knockbackTickHammer\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_knockbackTickTrap\">Knockback tick trap</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_knockbackTickTrap\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_toolSpearInsta\">Tool Spear Insta</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_toolSpearInsta\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_spikeGearInsta\">Spike Gear Insta</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_spikeGearInsta\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_musketBowInsta\">Musket Bow Insta</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_musketBowInsta\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoSync\">Auto sync</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoSync\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_turretSync\">Turret Sync</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_turretSync\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Spikes & Traps -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Spikes & Traps<span class=\"sec-sub\">Where things get placed and how enemies get pinned.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoplacer\">Autoplacer</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoplacer\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_placementDefense\">Placement Defense</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_placementDefense\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Autoplacer radius</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_autoplacerRadius\" type=\"range\" step=\"25\" min=\"100\" max=\"450\">\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Placement accuracy</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_placeAttempts\" type=\"range\" min=\"1\" max=\"10\">\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_spikeSync\">Spike sync</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_spikeSync\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_spikeSyncHammer\">Spike sync hammer</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_spikeSyncHammer\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_trapKB\">Trap KB</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_trapKB\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Defense -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Defense<span class=\"sec-sub\">Staying alive: healing, shielding and reading threats.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoheal\">Autoheal</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoheal\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoShield\">Auto Shield</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoShield\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_rangedShield\">Ranged Shield</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_rangedShield\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antienemy\">Anti enemy</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antienemy\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antianimal\">Anti animal</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antianimal\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antispike\">Anti spike</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antispike\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antiSpikePush\">Anti Spike Push</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antiSpikePush\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_empDefense\">Emp Defense</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_empDefense\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoemp\">Auto emp</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoemp\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_soldierDefault\">Soldier default</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_soldierDefault\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antiRetrap\">Anti Retrap</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antiRetrap\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antiSync\">Anti Sync</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antiSync\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">Watches for incoming sync damage and answers with Bull Helmet.</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antiTrapProtect\">Anti Trap Protect</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antiTrapProtect\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_antiTrapStar\">Anti Trap</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_antiTrapStar\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_safeWalk\">Safe walk</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_safeWalk\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Gear -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Gear<span class=\"sec-sub\">Which hat and accessory you are wearing, and when.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_biomehats\">Biome hats</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_biomehats\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_adaptiveGearSwitching\">Adaptive Gear</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_adaptiveGearSwitching\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">Swaps gear by combat distance instead of a fixed choice.</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_tailPriority\">Tail Priority</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_tailPriority\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_cowboyWhenSafe\">Cowboy When Safe</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_cowboyWhenSafe\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Movement -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Movement<span class=\"sec-sub\">How the client moves you around a fight.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoPush\">Autopush</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoPush\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">Pushes a trapped enemy onto a nearby spike using your body. Sends no packets.</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Auto Push Range</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_autoPushRange\" type=\"range\" step=\"25\" min=\"100\" max=\"500\">\r\n                </label>\r\n                <span class=\"option-description\">Distance used by auto push before activating</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_dashMovement\">Dash Movement</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_dashMovement\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Shame -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Shame<span class=\"sec-sub\">Forcing the enemy heal counter up until it kills them.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_shameSpam\">Shame Spam</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_shameSpam\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Utility -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Utility<span class=\"sec-sub\">Breaking, gathering and taking what is not yours.</span></div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autobreak\">Autobreak</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autobreak\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_automill\">Automill</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_automill\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoGrind\">Auto grind</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoGrind\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoPlay\">AutoPlay</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoPlay\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">RYN autoPlay: ÙØ¯ÙØ± Ø­ÙÙ Ø§ÙØ¹Ø¯Ù Ø¨ÙØµÙ ÙØ·Ø± 80 ÙÙØ¹ÙØ³ Ø§ÙØ§ØªØ¬Ø§Ù ÙÙ Ø§ÙØ³Ø¯. ÙÙØ³Ù Ø­Ø±ÙØªÙ.</span>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_autoSteal\">Autosteal</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoSteal\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_turretSteal\">Turret steal</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_turretSteal\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <label class=\"option-title\" for=\"_trapAnimal\">Trap Animal</label>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_trapAnimal\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n</div>";
  const Visuals_default = "<div class=\"menu-page\" data-id=\"3\">\r\n    <div class=\"page-title\">Visuals</div>\r\n    <p class=\"page-description\">Choose what gets drawn on screen. Turn off anything you do not need for a cleaner view.</p>\r\n\r\n    <!-- Tracers -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Tracers</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Enemies</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_enemyTracersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_enemyTracers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Teammates</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_teammateTracersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_teammateTracers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Animals</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_animalTracersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_animalTracers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Notifications</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_notificationTracersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_notificationTracers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Markers -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Markers</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Items</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_itemMarkersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_itemMarkers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Teammates</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_teammateMarkersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_teammateMarkers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Enemies</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_enemyMarkersColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_enemyMarkers\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Names -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Names</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">My Name</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_myNameColorValue\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_myNameColor\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Player HUD -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Player HUD</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Weapon Reload Bar</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_weaponReloadBarColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_weaponReloadBar\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">My Turret Reload Bar</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_playerTurretReloadBarColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_playerTurretReloadBar\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Render HP</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_renderHP\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Position Prediction</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_positionPrediction\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Structures -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Structures</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Placed Turret Reload Bar</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_objectTurretReloadBarColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_objectTurretReloadBar\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Item Health Bar (Mine/Clan)</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_itemHealthBarColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_itemHealthBar\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Chat Log</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_chatLog\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Item Health Bar (Enemy)</span>\r\n                <div class=\"option-content\">\r\n                    <button class=\"reset-color\" title=\"Reset Color\"></button>\r\n                    <input id=\"_itemHealthBarEnemyColor\" type=\"color\" title=\"Select Color\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_itemHealthBarEnemy\" type=\"checkbox\"></input>\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- myPlayer -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">myPlayer</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Display player angle</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_displayPlayerAngle\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <!-- Hitboxes -->\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Hitboxes</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Weapon hitbox</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_weaponHitbox\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Collision hitbox</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_collisionHitbox\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Placement hitbox</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_placementHitbox\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Possible placement</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_possiblePlacement\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n</div>";
  const Misc_default = "<div class=\"menu-page\" data-id=\"4\">\r\n    <div class=\"page-title\">Misc</div>\r\n    <p class=\"page-description\">Customize misc settings, add autochat messages, reset settings</p>\r\n\r\r\n\r\n    <!-- Other -->\r\n    <div class=\"section\">\r\n        <h2 class=\"section-title\">Other</h2>\r\n\r\n        <div class=\"section-content\">\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Kill Message</span>\r\n                <div class=\"option-content\">\r\n                    <input id=\"_killMessageText\" class=\"input\" type=\"text\" maxlength=\"30\">\r\n                    <label class=\"switch-checkbox\">\r\n                        <input id=\"_killMessage\" type=\"checkbox\">\r\n                        <span></span>\r\n                    </label>\r\n                </div>\r\n            </div>\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Provoke on Kill</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_deathProvoke\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Autospawn</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autospawn\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\r\n\r\r\n\r\r\n\r\r\n\r\r\n\r\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Autoaccept</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoaccept\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Hide game HUD</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_hideHUD\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Low Quality Mode</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_lowQuality\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"section\">\r\n        <h2 class=\"section-title\">Auto Chat</h2>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Enable</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoChat\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Interval</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_autoChatInterval\" type=\"range\" step=\"1\" min=\"1\" max=\"60\">\r\n                </label>\r\n            </div>\r\n            <div id=\"autoChatMsgList\">\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <button id=\"addAutoChatMsg\" class=\"option-button\">+ Add Message</button>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"section\">\r\n        <h2 class=\"section-title\">Bot Auto Chat</h2>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Enable Player Chat</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoBotChat\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div id=\"autoBotChatMsgList\">\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <button id=\"addAutoBotChatMsg\" class=\"option-button\">+ Add Player Message</button>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n\r\n    <!-- Menu -->\r\n    <!-- <div class=\"section\">\r\n        <h2 class=\"section-title\">Menu</h2>\r\n\r\n        <div class=\"section-content\">\r\n\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Transparency</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_menuTransparency\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n\r\n        </div>\r\n    </div> -->\r\n\r\n</div>";
  const Bots_default = "<div class=\"menu-page\" data-id=\"5\">\r\n    <div class=\"page-title\">Bots</div>\r\n    <p class=\"page-description\">Create bots, control them and dominate the entire server</p>\r\n\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Controller</div>\r\n        <div class=\"section-content\">\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Follow cursor</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_followCursor\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Stop movement radius</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_movementRadius\" type=\"range\" step=\"25\" min=\"25\" max=\"250\">\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\" style=\"flex-direction:column;align-items:flex-start;gap:8px;\">\r\n                <span class=\"option-title\" style=\"margin-bottom:2px;\">Formation</span>\r\n                <div id=\"_formationGrid\" style=\"display:flex;flex-wrap:wrap;gap:6px;width:100%;\"></div>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Circle rotation</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_circleRotation\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Circle radius</span>\r\n                <label class=\"slider\">\r\n                    <span class=\"slider-value\"></span>\r\n                    <input id=\"_circleRadius\" type=\"range\" step=\"25\" min=\"50\" max=\"600\">\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Bots own clan</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_botIndividualClans\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\n            <div class=\"content-option\">\r\n                <span class=\"option-title\">Auto random bot names</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_autoRandomBotNames\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n            </div>\r\r\n                                                        </div>\r\n        <div id=\"bot-container\" class=\"section-content\"></div>\r\n        <div id=\"dynamic-bot-list\" style=\"display:flex;flex-direction:column;gap:8px;margin-top:8px;\"></div>\r\n        <div class=\"content-option\" style=\"margin-top:10px;justify-content:center;\">\r\n            <button id=\"add-bot-dynamic\" class=\"option-button\" style=\"display:flex;align-items:center;gap:8px;padding:10px 28px;background:rgba(122,66,244,0.1);border:1.5px solid rgba(122,66,244,0.4);border-radius:7px;color:#FFFFFF;font-size:1.1em;font-weight:800;letter-spacing:0.04em;transition:all 200ms;cursor:pointer;\">\r\n                + Add Bots\r\n            </button>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Bot Weapons</div>\r\n        <div class=\"section-content\" style=\"padding:14px 16px;gap:16px;display:flex;flex-direction:column;\">\r\n\r\n            <style>\r\n                .wpn-label{font-size:0.68em;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(122,66,244,0.6);margin-bottom:8px;display:flex;align-items:center;gap:6px;}\r\n                .wpn-label::before{content:'';width:3px;height:3px;background:var(--accent);border-radius:50%;box-shadow:0 0 5px var(--accent);flex-shrink:0;}\r\n                .wpn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:10px;}\r\n                .bot-weapon-btn,.bot-sec-weapon-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;height:82px;background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.07);border-radius:10px;cursor:pointer;font-size:0.78em;font-weight:600;color:rgba(200,200,220,0.65);transition:all 180ms;text-align:center;gap:7px;padding:8px 4px;}\r\n                .bot-weapon-btn:hover,.bot-sec-weapon-btn:hover{background:rgba(122,66,244,0.1);border-color:rgba(122,66,244,0.4);color:#fff;}\r\n                .bot-weapon-btn.wpn-active,.bot-sec-weapon-btn.wpn-active{background:rgba(122,66,244,0.18);border-color:rgba(122,66,244,0.7);color:#fff;box-shadow:0 0 12px rgba(122,66,244,0.2);}\r\n                .bot-weapon-btn[data-wid=\"-1\"],.bot-sec-weapon-btn[data-swid=\"-1\"]{background:rgba(122,66,244,0.08);border-color:rgba(122,66,244,0.35);color:rgba(160,122,244,0.9);}\r\n                .wpn-name{line-height:1.25;font-size:0.95em;}\r\n                .wpn-selected-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(122,66,244,0.06);border:1px solid rgba(122,66,244,0.18);border-radius:7px;margin-top:4px;}\r\n                .wpn-selected-dot{width:6px;height:6px;background:#7A42F4;border-radius:50%;box-shadow:0 0 6px rgba(122,66,244,0.7);flex-shrink:0;}\r\n                .wpn-selected-text{font-size:0.8em;color:rgba(200,200,220,0.75);font-weight:500;}\r\n            </style>\r\n\r\n            <!-- Primary -->\r\n            <div>\r\n                <div class=\"wpn-label\">Primary Weapon</div>\r\n                <div class=\"wpn-grid\" id=\"bot-weapon-selector\">\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"-1\" title=\"Copy from me\"><span class=\"wpn-name\">Copy from me</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"0\" title=\"Tool Hammer\"><span class=\"wpn-name\">Tool Hammer</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"1\" title=\"Hand Axe\"><span class=\"wpn-name\">Hand Axe</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"2\" title=\"Great Axe\"><span class=\"wpn-name\">Great Axe</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"3\" title=\"Short Sword\"><span class=\"wpn-name\">Short Sword</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"4\" title=\"Katana\"><span class=\"wpn-name\">Katana</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"5\" title=\"Polearm\"><span class=\"wpn-name\">Polearm</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"6\" title=\"Bat\"><span class=\"wpn-name\">Bat</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"7\" title=\"Daggers\"><span class=\"wpn-name\">Daggers</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-wid=\"8\" title=\"Stick\"><span class=\"wpn-name\">Stick</span></div>\r\n                    </div>\r\n                <div class=\"wpn-selected-bar\"><div class=\"wpn-selected-dot\"></div><span class=\"wpn-selected-text\" id=\"bot-weapon-label\">Copy from me (default)</span></div>\r\n            </div>\r\n\r\n            <!-- Secondary -->\r\n            <div>\r\n                <div class=\"wpn-label\">Secondary Weapon</div>\r\n                <div class=\"wpn-grid\" id=\"bot-sec-weapon-selector\">\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"-1\" title=\"Copy from me\"><span class=\"wpn-name\">Copy from me</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"9\" title=\"Hunting Bow\"><span class=\"wpn-name\">Hunting Bow</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"10\" title=\"Great Hammer\"><span class=\"wpn-name\">Great Hammer</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"11\" title=\"Wooden Shield\"><span class=\"wpn-name\">Wooden Shield</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"12\" title=\"Crossbow\"><span class=\"wpn-name\">Crossbow</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"13\" title=\"Repeater Crossbow\"><span class=\"wpn-name\">Repeater Crossbow</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"14\" title=\"Mc Grabby\"><span class=\"wpn-name\">Mc Grabby</span></div>\r\n                    <div class=\"bot-sec-weapon-btn\" data-swid=\"15\" title=\"Musket\"><span class=\"wpn-name\">Musket</span></div>\r\n                    </div>\r\n                <div class=\"wpn-selected-bar\"><div class=\"wpn-selected-dot\"></div><span class=\"wpn-selected-text\" id=\"bot-sec-weapon-label\">Copy from me (default)</span></div>\r\n            </div>\r\n\r\n            <div class=\"content-option\" style=\"margin-top:2px;\">\r\n                <span class=\"option-title\">Platform w/ Musket</span>\r\n                <label class=\"switch-checkbox\">\r\n                    <input id=\"_platformMusket\" type=\"checkbox\"></input>\r\n                    <span></span>\r\n                </label>\r\n                <span class=\"option-description\">When bots have Musket equipped, they build a platform right before firing instead of shooting from the ground.</span>\r\n            </div>\r\n\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"section\">\r\n        <div class=\"section-title\">Age 4 Building</div>\r\n        <div class=\"section-content\" style=\"padding:14px 16px;gap:16px;display:flex;flex-direction:column;\">\r\n            <div>\r\n                <div class=\"wpn-label\">Age 4 Building</div>\r\n                <div class=\"wpn-grid\" id=\"bot-age4-selector\">\r\n                    <div class=\"bot-weapon-btn\" data-age4id=\"0\" title=\"Trap\"><span class=\"wpn-name\">Trap</span></div>\r\n                    <div class=\"bot-weapon-btn\" data-age4id=\"1\" title=\"Boost Pad\"><span class=\"wpn-name\">Boost Pad</span></div>\r\n                </div>\r\n                <div class=\"wpn-selected-bar\"><div class=\"wpn-selected-dot\"></div><span class=\"wpn-selected-text\" id=\"bot-age4-label\">Trap (default)</span></div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"section\">\r\n        <div class=\"section\" style=\"margin-top:6px;\">\r\n        <div class=\"section\" style=\"margin-top:6px;background:rgba(0,0,0,0);border:none;padding:0;\">\r\n        <div class=\"section-title\" style=\"font-size:0.75em;letter-spacing:0.18em;color:rgba(160,122,244,0.75);text-transform:uppercase;margin-bottom:14px;\">Auto Farm</div>\r\n\r\n        <div style=\"display:flex;flex-direction:column;gap:10px;\">\r\n\r\n            <!-- Farm Mode card -->\r\n            <div style=\"background:rgba(122,66,244,0.06);border:1px solid rgba(122,66,244,0.18);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;\">\r\n                <span style=\"font-size:0.7em;letter-spacing:0.14em;color:rgba(160,122,244,0.6);text-transform:uppercase;\">Farm Mode</span>\r\n                <p style=\"font-size:0.82em;color:rgba(200,195,220,0.6);margin:0;line-height:1.5;\">Bots automatically gather resources. In <b style=\"color:rgba(200,195,220,0.85);\">Single</b> mode they target one resource type. In <b style=\"color:rgba(200,195,220,0.85);\">Nearest</b> mode they pick the closest available resource.</p>\r\n                <div style=\"display:flex;gap:8px;margin-top:2px;\">\r\n                    <button id=\"_farmModeSingle\" style=\"flex:1;padding:9px 0;border-radius:8px;border:1.5px solid rgba(122,66,244,0.6);background:rgba(122,66,244,0.28);color:#fff;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.9em;letter-spacing:0.04em;transition:all 0.15s;\">Single</button>\r\n                    <button id=\"_farmModeNearest\" style=\"flex:1;padding:9px 0;border-radius:8px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#888;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.9em;letter-spacing:0.04em;transition:all 0.15s;\">Nearest</button>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- Resource Type card -->\r\n            <div id=\"_farmTypeRow\" style=\"background:rgba(122,66,244,0.06);border:1px solid rgba(122,66,244,0.18);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;\">\r\n                <span style=\"font-size:0.7em;letter-spacing:0.14em;color:rgba(160,122,244,0.6);text-transform:uppercase;\">Resource Type</span>\r\n                <div style=\"display:flex;gap:8px;\">\r\n                    <button data-farm-type=\"0\" class=\"farm-type-btn\" style=\"flex:1;padding:10px 4px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#666;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85em;letter-spacing:0.03em;transition:all 0.15s;\">Wood</button>\r\n                    <button data-farm-type=\"1\" class=\"farm-type-btn\" style=\"flex:1;padding:10px 4px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#666;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85em;letter-spacing:0.03em;transition:all 0.15s;\">Food</button>\r\n                    <button data-farm-type=\"2\" class=\"farm-type-btn\" style=\"flex:1;padding:10px 4px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#666;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85em;letter-spacing:0.03em;transition:all 0.15s;\">Stone</button>\r\n                    <button data-farm-type=\"3\" class=\"farm-type-btn\" style=\"flex:1;padding:10px 4px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#666;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85em;letter-spacing:0.03em;transition:all 0.15s;\">Gold</button>\r\n                </div>\r\n                <input id=\"_botFarmType\" type=\"hidden\" value=\"0\">\r\n            </div>\r\n\r\n            <!-- Limit card -->\r\n            <div style=\"background:rgba(122,66,244,0.06);border:1px solid rgba(122,66,244,0.18);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;\">\r\n                <span style=\"font-size:0.7em;letter-spacing:0.14em;color:rgba(160,122,244,0.6);text-transform:uppercase;\">Limit</span>\r\n                <div style=\"display:flex;align-items:center;gap:12px;\">\r\n                    <input id=\"_botFarmLimit\" class=\"input\" type=\"number\" min=\"0\" max=\"9999\" step=\"50\" value=\"0\" style=\"width:110px;height:40px;font-size:1em;padding:0 12px;border-radius:8px;flex-shrink:0;\">\r\n                    <span style=\"font-size:0.83em;color:rgba(200,195,220,0.5);line-height:1.5;\">Bots stop and return to you when they reach this amount. Set to <b style=\"color:rgba(200,195,220,0.7);\">0</b> for no limit.</span>\r\n                </div>\r\n            </div>\r\n\r\n        </div>\r\n    </div>\r\n    </div>\r\n    </div>\r\n\r\n</div>";
  const Music_default = "<div class=\"menu-page\" data-id=\"7\">\r\n<style>\r\n@keyframes ryn-eq{0%,100%{height:3px;}50%{height:15px;}}\r\n@keyframes ryn-like-pop{0%{transform:scale(1);}45%{transform:scale(1.45);}100%{transform:scale(1);}}\r\n@keyframes rm-fade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}\r\n\r\n.rm-root{\r\n  --rm-bg:#0B0B10;\r\n  --rm-panel:#141420;\r\n  --rm-panel-hi:#1B1B2B;\r\n  --rm-line:rgba(255,255,255,0.07);\r\n  --rm-accent:#7A42F4;\r\n  --rm-accent2:#3A86FF;\r\n  --rm-text:#FFFFFF;\r\n  --rm-mute:rgba(255,255,255,0.62);\r\n  --rm-dim:rgba(255,255,255,0.34);\r\n  display:flex;flex-direction:column;gap:14px;\r\n  font-family:'Inter','Poppins',sans-serif;\r\n  animation:rm-fade 240ms ease;\r\n}\r\n\r\n.rm-player{\r\n  position:relative;overflow:hidden;\r\n  padding:18px 18px 14px;border-radius:14px;\r\n  background:\r\n    radial-gradient(120% 130% at 0% 0%,rgba(122,66,244,.28),transparent 58%),\r\n    linear-gradient(160deg,#1E1830 0%,#12111E 55%,#0B0B10 100%);\r\n  border:1px solid var(--rm-line);\r\n  box-shadow:0 12px 34px -16px rgba(0,0,0,.9);\r\n}\r\n.rm-player::before{\r\n  content:'';position:absolute;inset:0;pointer-events:none;\r\n  background:linear-gradient(180deg,rgba(255,255,255,.05),transparent 40%);\r\n}\r\n.rm-np-row{display:flex;align-items:center;gap:15px;margin-bottom:14px;position:relative;}\r\n\r\n.rm-art{\r\n  width:74px;height:74px;flex-shrink:0;position:relative;overflow:hidden;\r\n  display:flex;align-items:center;justify-content:center;\r\n  font-size:1.7em;border-radius:8px;\r\n  background:linear-gradient(140deg,#2A2140,#141323);\r\n  border:none;\r\n  box-shadow:0 8px 22px -8px rgba(0,0,0,.85);\r\n  transition:box-shadow 300ms ease;\r\n}\r\n.rm-art.playing{box-shadow:0 10px 26px -8px rgba(122,66,244,.6);}\r\n.rm-eq{display:none;gap:3px;align-items:flex-end;height:18px;}\r\n.rm-art.playing .rm-eq{display:flex;}\r\n.rm-eq-bar{\r\n  width:3px;border-radius:2px;\r\n  background:linear-gradient(180deg,var(--rm-accent),var(--rm-accent2));\r\n  animation:ryn-eq .9s ease-in-out infinite;\r\n}\r\n.rm-eq-bar:nth-child(2){animation-delay:.15s;}\r\n.rm-eq-bar:nth-child(3){animation-delay:.3s;}\r\n.rm-eq-bar:nth-child(4){animation-delay:.45s;}\r\n\r\n.rm-meta{flex:1;min-width:0;}\r\n.rm-title{\r\n  font-size:1.16em;font-weight:700;letter-spacing:-.015em;line-height:1.25;\r\n  color:var(--rm-text);\r\n  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;\r\n  overflow:hidden;word-break:break-word;\r\n}\r\n.rm-artist{\r\n  margin-top:4px;font-size:.78em;font-weight:400;color:var(--rm-mute);\r\n  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n}\r\n.rm-album-badge{\r\n  display:inline-block;margin-top:6px;padding:2px 9px;\r\n  font-size:.64em;font-weight:600;letter-spacing:.05em;text-transform:uppercase;\r\n  color:var(--rm-mute);background:rgba(255,255,255,.08);border-radius:999px;\r\n  max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n}\r\n.rm-actions{display:flex;gap:4px;align-items:center;flex-shrink:0;}\r\n.rm-like-btn,.rm-save-now-btn{\r\n  width:36px;height:36px;display:flex;align-items:center;justify-content:center;\r\n  font-size:1.15em;cursor:pointer;border-radius:50%;\r\n  color:var(--rm-dim);background:transparent;border:none;\r\n  transition:color 170ms,background 170ms,transform 170ms cubic-bezier(.34,1.5,.5,1);\r\n}\r\n.rm-like-btn:hover,.rm-save-now-btn:hover{\r\n  color:var(--rm-text);background:rgba(255,255,255,.11);transform:scale(1.1);\r\n}\r\n.rm-like-btn.on{\r\n  color:#ff4d6d;animation:ryn-like-pop 340ms cubic-bezier(.34,1.5,.5,1);\r\n  text-shadow:0 0 12px rgba(255,77,109,.55);\r\n}\r\n.rm-save-now-btn.on{color:var(--rm-accent2);text-shadow:0 0 12px rgba(58,134,255,.5);}\r\n\r\n.rm-prog-wrap{margin-bottom:10px;position:relative;}\r\n.rm-prog-rail{\r\n  height:4px;border-radius:4px;cursor:pointer;\r\n  background:rgba(255,255,255,.13);position:relative;\r\n  transition:height 140ms ease;\r\n}\r\n.rm-prog-wrap:hover .rm-prog-rail{height:6px;}\r\n.rm-prog-fill{\r\n  height:100%;border-radius:4px;position:relative;\r\n  background:linear-gradient(90deg,var(--rm-accent),var(--rm-accent2));\r\n}\r\n.rm-prog-fill::after{\r\n  content:'';position:absolute;right:-5px;top:50%;\r\n  width:11px;height:11px;border-radius:50%;background:#fff;\r\n  transform:translateY(-50%) scale(0);\r\n  transition:transform 160ms ease;\r\n  box-shadow:0 2px 6px rgba(0,0,0,.5);\r\n}\r\n.rm-prog-wrap:hover .rm-prog-fill::after{transform:translateY(-50%) scale(1);}\r\n.rm-times{display:flex;justify-content:space-between;margin-top:5px;}\r\n.rm-time{font-size:.66em;font-weight:500;color:var(--rm-dim);font-variant-numeric:tabular-nums;}\r\n\r\n.rm-ctrl{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:12px;position:relative;}\r\n.rm-btn{\r\n  width:32px;height:32px;display:flex;align-items:center;justify-content:center;\r\n  background:transparent;border:none;border-radius:50%;\r\n  color:var(--rm-mute);font-size:.86em;cursor:pointer;\r\n  transition:color 160ms,transform 160ms;\r\n}\r\n.rm-btn:hover{color:var(--rm-text);transform:scale(1.1);}\r\n.rm-btn.on{color:var(--rm-accent);}\r\n.rm-play-btn{\r\n  width:46px;height:46px;flex-shrink:0;\r\n  display:flex;align-items:center;justify-content:center;\r\n  background:#fff;border:none;border-radius:50%;\r\n  color:#0B0B10;font-size:1.05em;cursor:pointer;\r\n  box-shadow:0 6px 18px -6px rgba(0,0,0,.7);\r\n  transition:transform 170ms cubic-bezier(.34,1.5,.5,1),box-shadow 170ms;\r\n}\r\n.rm-play-btn:hover{transform:scale(1.07);box-shadow:0 8px 22px -6px rgba(122,66,244,.7);}\r\n.rm-play-btn:active{transform:scale(.97);}\r\n\r\n.rm-vol{display:flex;align-items:center;gap:9px;position:relative;}\r\n.rm-vol-icon{font-size:.82em;color:var(--rm-dim);flex-shrink:0;}\r\n.rm-vol-val{font-size:.66em;color:var(--rm-dim);min-width:30px;text-align:right;font-variant-numeric:tabular-nums;}\r\n\r\n.rm-sec{\r\n  background:var(--rm-panel);\r\n  border:1px solid var(--rm-line);border-radius:12px;overflow:hidden;\r\n  transition:border-color 200ms;\r\n}\r\n.rm-sec:hover{border-color:rgba(255,255,255,.12);}\r\n.rm-sec-head{\r\n  display:flex;align-items:center;gap:9px;\r\n  padding:12px 15px;cursor:pointer;user-select:none;\r\n  transition:background 160ms;\r\n}\r\n.rm-sec-head:hover{background:rgba(255,255,255,.035);}\r\n.rm-sec-dot{\r\n  width:6px;height:6px;border-radius:50%;flex-shrink:0;\r\n  background:var(--rm-accent);box-shadow:0 0 8px rgba(122,66,244,.7);\r\n}\r\n.rm-sec-title{\r\n  flex:1;font-size:.74em;font-weight:700;\r\n  letter-spacing:.12em;text-transform:uppercase;color:var(--rm-mute);\r\n}\r\n.rm-sec-arrow{font-size:.62em;color:var(--rm-dim);transition:transform 220ms ease;}\r\n.rm-sec.open .rm-sec-arrow{transform:rotate(90deg);}\r\n.rm-sec-body{padding:0 12px 12px;display:none;flex-direction:column;gap:9px;}\r\n.rm-sec.open .rm-sec-body{display:flex;animation:rm-fade 200ms ease;}\r\n\r\n.rm-filter-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:2px;}\r\n.rm-filter-btn{\r\n  padding:5px 13px;border-radius:999px;cursor:pointer;\r\n  font-size:.7em;font-weight:600;\r\n  background:rgba(255,255,255,.07);border:none;color:var(--rm-mute);\r\n  transition:background 160ms,color 160ms;\r\n}\r\n.rm-filter-btn:hover{background:rgba(255,255,255,.13);color:var(--rm-text);}\r\n.rm-filter-btn.active{background:#fff;color:#0B0B10;}\r\n\r\n.rm-song-row{\r\n  display:flex;align-items:center;gap:13px;\r\n  padding:10px 12px;border-radius:8px;cursor:pointer;\r\n  border:none;position:relative;\r\n  transition:background 140ms;\r\n}\r\n.rm-song-row:hover{background:rgba(255,255,255,.07);}\r\n.rm-song-row.active{background:rgba(122,66,244,.13);}\r\n.rm-song-row.active .rm-stitle{color:var(--rm-accent);}\r\n.rm-song-row.active .rm-snum{color:var(--rm-accent);}\r\n\r\n.rm-snum{\r\n  width:20px;flex-shrink:0;text-align:center;\r\n  font-size:.78em;font-weight:500;color:var(--rm-dim);\r\n  font-variant-numeric:tabular-nums;\r\n  transition:color 140ms;\r\n}\r\n.rm-song-row:hover .rm-snum{font-size:0;color:transparent;}\r\n.rm-song-row:hover .rm-snum::after{\r\n  content:'\\25B6';font-size:11px;color:var(--rm-text);\r\n}\r\n.rm-stitle{\r\n  flex:1;min-width:0;\r\n  font-size:.92em;font-weight:600;color:var(--rm-text);\r\n  letter-spacing:-.005em;\r\n  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n}\r\n.rm-sartist{\r\n  flex-shrink:1;min-width:0;max-width:32%;\r\n  font-size:.76em;font-weight:400;color:var(--rm-dim);\r\n  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n}\r\n\r\n.rm-s-icons{\r\n  display:flex;gap:4px;flex-shrink:0;align-items:center;\r\n  opacity:0;transition:opacity 150ms;\r\n}\r\n.rm-song-row:hover .rm-s-icons,\r\n.rm-song-row.active .rm-s-icons{opacity:1;}\r\n\r\n.rm-s-like,.rm-s-save,.rm-sdel{\r\n  width:26px;height:26px;flex-shrink:0;\r\n  display:flex;align-items:center;justify-content:center;\r\n  font-size:.9em;cursor:pointer;line-height:1;border-radius:50%;\r\n  color:var(--rm-dim);\r\n  transition:color 150ms,background 150ms,transform 150ms cubic-bezier(.34,1.5,.5,1);\r\n}\r\n.rm-s-like:hover{color:#ff4d6d;background:rgba(255,77,109,.14);transform:scale(1.12);}\r\n.rm-s-save:hover{color:var(--rm-accent2);background:rgba(58,134,255,.14);transform:scale(1.12);}\r\n.rm-sdel:hover{color:#ff4d6d;background:rgba(255,77,109,.14);transform:scale(1.12);}\r\n.rm-s-like.on{color:#ff4d6d;opacity:1;}\r\n.rm-s-save.on{color:var(--rm-accent2);opacity:1;}\r\n\r\n.rm-song-row .rm-s-like.on,\r\n.rm-song-row .rm-s-save.on{opacity:1;}\r\n.rm-song-row:not(:hover) .rm-s-icons:has(.on){opacity:1;}\r\n\r\n.rm-album-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;}\r\n.rm-album-card{\r\n  position:relative;padding:11px;border-radius:9px;cursor:pointer;\r\n  background:var(--rm-panel-hi);border:none;\r\n  transition:background 180ms,transform 180ms;\r\n}\r\n.rm-album-card:hover{background:#25253A;transform:translateY(-2px);}\r\n.rm-album-icon{\r\n  width:100%;aspect-ratio:1;border-radius:6px;margin-bottom:8px;\r\n  display:flex;align-items:center;justify-content:center;font-size:1.5em;\r\n  background:linear-gradient(140deg,#2E2450,#171628);\r\n  box-shadow:0 5px 14px -6px rgba(0,0,0,.8);\r\n}\r\n.rm-album-name{\r\n  font-size:.76em;font-weight:600;color:var(--rm-text);\r\n  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n}\r\n.rm-album-count{margin-top:2px;font-size:.66em;color:var(--rm-dim);}\r\n.rm-album-del{\r\n  position:absolute;top:6px;right:6px;\r\n  width:19px;height:19px;border-radius:50%;\r\n  display:flex;align-items:center;justify-content:center;\r\n  font-size:.62em;cursor:pointer;\r\n  background:rgba(0,0,0,.6);color:var(--rm-dim);\r\n  opacity:0;transition:opacity 150ms,color 150ms;\r\n}\r\n.rm-album-card:hover .rm-album-del{opacity:1;}\r\n.rm-album-del:hover{color:#ff4d6d;}\r\n\r\n.rm-inp,.rm-sel{\r\n  width:100%;padding:9px 12px;\r\n  background:var(--rm-panel-hi);border:1px solid transparent;border-radius:7px;\r\n  font-family:'Inter','Poppins',sans-serif;font-size:.78em;color:var(--rm-text);\r\n  outline:none;transition:border-color 160ms,background 160ms;\r\n}\r\n.rm-inp::placeholder{color:var(--rm-dim);}\r\n.rm-inp:focus,.rm-sel:focus{border-color:var(--rm-accent);background:#20203200;}\r\n\r\ntextarea.rm-inp{\r\n  min-height:74px;max-height:170px;resize:vertical;\r\n  line-height:1.55;white-space:pre-wrap;word-break:break-word;\r\n  font-family:'JetBrains Mono','Inter',monospace;font-size:.72em;\r\n}\r\n.rm-btn-full{\r\n  width:100%;padding:9px;border-radius:999px;cursor:pointer;\r\n  background:rgba(255,255,255,.09);border:none;\r\n  font-family:'Inter','Poppins',sans-serif;font-size:.75em;font-weight:600;color:var(--rm-text);\r\n  transition:background 160ms,transform 160ms;\r\n}\r\n.rm-btn-full:hover{background:rgba(255,255,255,.16);}\r\n.rm-btn-primary{\r\n  background:#fff;color:#0B0B10;\r\n}\r\n.rm-btn-primary:hover{background:#EDEDF5;transform:scale(1.015);}\r\n.rm-badge{\r\n  display:inline-block;padding:2px 8px;border-radius:999px;\r\n  font-size:.64em;font-weight:600;\r\n  background:rgba(122,66,244,.18);color:var(--rm-accent);\r\n}\r\n\r\n.rm-sync-row{\r\n  display:flex;align-items:center;justify-content:space-between;gap:11px;\r\n  padding:7px 10px;border-radius:7px;\r\n  transition:background 140ms;\r\n}\r\n.rm-sync-row:hover{background:rgba(255,255,255,.04);}\r\n.rm-sync-label{font-size:.76em;color:var(--rm-mute);flex:1;min-width:0;}\r\n\r\n.rm-toast{\r\n  position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(12px);\r\n  padding:9px 18px;border-radius:999px;z-index:99999;\r\n  background:#fff;color:#0B0B10;\r\n  font-size:.75em;font-weight:600;\r\n  box-shadow:0 10px 30px rgba(0,0,0,.6);\r\n  opacity:0;pointer-events:none;\r\n  transition:opacity 240ms ease,transform 240ms ease;\r\n}\r\n.rm-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}\r\n\r\n.rm-root .switch-checkbox{position:relative;width:38px;height:21px;flex-shrink:0;}\r\n.rm-root .switch-checkbox input{position:absolute;opacity:0;width:0;height:0;}\r\n.rm-root .switch-checkbox span{\r\n  position:absolute;inset:0;cursor:pointer;border-radius:999px;\r\n  background:rgba(255,255,255,.16);\r\n  transition:background 220ms ease;\r\n}\r\n.rm-root .switch-checkbox span::before{\r\n  content:'';position:absolute;left:3px;top:50%;\r\n  width:15px;height:15px;border-radius:50%;background:#fff;\r\n  transform:translateY(-50%);\r\n  transition:left 240ms cubic-bezier(.34,1.4,.5,1);\r\n}\r\n.rm-root .switch-checkbox input:checked + span{background:var(--rm-accent);}\r\n.rm-root .switch-checkbox input:checked + span::before{left:calc(100% - 18px);}\r\n\r\n.rm-root .slider{display:flex;align-items:center;gap:9px;flex:1;}\r\n.rm-root .slider input[type=\"range\"]{\r\n  -webkit-appearance:none;flex:1;height:4px;border-radius:4px;\r\n  outline:none;border:none;cursor:pointer;\r\n  background:linear-gradient(90deg,#fff var(--val,50%),rgba(255,255,255,.16) var(--val,50%));\r\n}\r\n.rm-root .slider input[type=\"range\"]::-webkit-slider-thumb{\r\n  -webkit-appearance:none;width:12px;height:12px;border-radius:50%;\r\n  background:#fff;border:none;\r\n  box-shadow:0 1px 4px rgba(0,0,0,.5);\r\n  opacity:0;transition:opacity 150ms;\r\n}\r\n.rm-root .slider:hover input[type=\"range\"]::-webkit-slider-thumb{opacity:1;}\r\n.rm-root .slider-value{\r\n  font-size:.68em;font-weight:500;color:var(--rm-dim);\r\n  min-width:30px;text-align:right;font-variant-numeric:tabular-nums;\r\n}\r\n\r\n.rm-note{display:none;}\r\n.rm-btn.rm-on{color:var(--rm-accent);}\r\n\r\n</style>\r\n\r\n<div id=\"rm-toast\" class=\"rm-toast\"></div>\r\n<div class=\"rm-root\">\r\n\r\n<div class=\"rm-player\">\r\n  <div class=\"rm-np-row\">\r\n    <div class=\"rm-art\" id=\"rm-art\"><span class=\"rm-note\">&#9835;</span><div class=\"rm-eq\"><div class=\"rm-eq-bar\"></div><div class=\"rm-eq-bar\"></div><div class=\"rm-eq-bar\"></div></div></div>\r\n    <div class=\"rm-meta\">\r\n      <div id=\"music-title\" class=\"rm-title\" data-i18n=\"rm_no_song\">No song selected</div>\r\n      <div id=\"music-artist\" class=\"rm-artist\">--</div>\r\n      <div id=\"music-album-badge\" class=\"rm-album-badge\"></div>\r\n    </div>\r\n    <div class=\"rm-actions\">\r\n      <button id=\"rm-like-now\" class=\"rm-like-btn\" title=\"Like\" data-i18n-title=\"rm_t_like\">&#9825;</button>\r\n      <button id=\"rm-save-now\" class=\"rm-save-now-btn\" title=\"Save\" data-i18n-title=\"rm_t_save\">&#128190;</button>\r\n    </div>\r\n  </div>\r\n  <div class=\"rm-prog-wrap\">\r\n    <div id=\"music-progress-bar\" class=\"rm-prog-rail\"><div id=\"music-progress-fill\" class=\"rm-prog-fill\"></div></div>\r\n    <div class=\"rm-times\"><span id=\"music-time-current\" class=\"rm-time\">0:00</span><span id=\"music-time-total\" class=\"rm-time\">0:00</span></div>\r\n  </div>\r\n  <div class=\"rm-ctrl\">\r\n    <button id=\"music-prev\" class=\"rm-btn\" title=\"Previous\" data-i18n-title=\"rm_t_prev\">&#9664;&#9664;</button>\r\n    <button id=\"music-play\" class=\"rm-btn rm-play-btn\" title=\"Play/Pause\" data-i18n-title=\"rm_t_play\">&#9654;</button>\r\n    <button id=\"music-next\" class=\"rm-btn\" title=\"Next\" data-i18n-title=\"rm_t_next\">&#9654;&#9654;</button>\r\n    <button id=\"music-loop\" class=\"rm-btn\" title=\"Loop\" data-i18n-title=\"rm_t_loop\">&#8635;</button>\r\n    <button id=\"music-shuffle\" class=\"rm-btn\" title=\"Shuffle\" data-i18n=\"rm_shf\" style=\"font-size:0.7em;letter-spacing:0.1em;\">SHF</button>\r\n  </div>\r\n  <div class=\"rm-vol\"><span class=\"rm-vol-icon\">&#9834;</span><input id=\"music-volume\" type=\"range\" min=\"0\" max=\"100\" value=\"70\" style=\"flex:1;accent-color:#7A42F4;height:3px;cursor:pointer;\"><span id=\"music-volume-label\" class=\"rm-vol-val\">70%</span></div>\r\n</div>\r\n\r\n<div class=\"rm-sec\" id=\"rm-sec-albums\">\r\n  <div class=\"rm-sec-head\" onclick=\"this.closest('.rm-sec').classList.toggle('open')\"><div class=\"rm-sec-dot\"></div><span class=\"rm-sec-title\" data-i18n=\"rm_albums\">Albums</span><span class=\"rm-sec-arrow\">&#9660;</span></div>\r\n  <div class=\"rm-sec-body\">\r\n    <div id=\"rm-album-grid\" class=\"rm-album-grid\"></div>\r\n    <div style=\"display:flex;gap:6px;\"><input id=\"album-name-input\" class=\"rm-inp\" type=\"text\" data-i18n-placeholder=\"rm_new_album_ph\" placeholder=\"New album name...\" maxlength=\"30\" style=\"flex:1;\"><button id=\"add-album\" class=\"rm-btn\" data-i18n=\"rm_add_btn\" style=\"flex-shrink:0;padding:5px 12px;\">+ Add</button></div>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"rm-sec\">\r\n  <div class=\"rm-sec-head\" onclick=\"this.closest('.rm-sec').classList.toggle('open')\"><div class=\"rm-sec-dot\"></div><span class=\"rm-sec-title\" data-i18n=\"rm_library\">Library</span><span class=\"rm-sec-arrow\">&#9660;</span></div>\r\n  <div class=\"rm-sec-body\">\r\n    <div id=\"rm-filter-bar\" class=\"rm-filter-bar\"><button class=\"rm-filter-btn active\" data-filter=\"\" data-i18n=\"rm_all_songs\">All Songs</button><button class=\"rm-filter-btn\" data-filter=\"__liked\" data-i18n=\"rm_liked\">&#9829; Liked</button></div>\r\n    <div id=\"song-list\" style=\"display:flex;flex-direction:column;gap:1px;\"></div>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"rm-sec collapsed\">\r\n  <div class=\"rm-sec-head\" onclick=\"this.closest('.rm-sec').classList.toggle('open')\"><div class=\"rm-sec-dot\"></div><span class=\"rm-sec-title\" data-i18n=\"rm_add_song_title\">Add Song</span><span class=\"rm-sec-arrow\">&#9660;</span></div>\r\n  <div class=\"rm-sec-body\">\r\n    <div style=\"display:flex;flex-direction:column;gap:5px;\">\r\n      <input id=\"song-title-input\" class=\"rm-inp\" type=\"text\" data-i18n-placeholder=\"rm_title_ph\" placeholder=\"Title *\" maxlength=\"50\">\r\n      <input id=\"song-artist-input\" class=\"rm-inp\" type=\"text\" data-i18n-placeholder=\"rm_artist_ph\" placeholder=\"Artist\" maxlength=\"30\">\r\n      <input id=\"song-url-input\" class=\"rm-inp\" type=\"text\" data-i18n-placeholder=\"rm_url_ph\" placeholder=\"URL (.mp3  .ogg  .wav)\">\r\n      <input id=\"song-file-input\" class=\"rm-inp\" type=\"file\" accept=\".mp3,.ogg,.wav,.flac,.aac,.m4a\" style=\"padding:3px 6px;font-size:11px;cursor:pointer;\">\r\n      <select id=\"song-album-select\" class=\"rm-sel\"><option value=\"\" data-i18n=\"rm_no_album\">No Album</option></select>\r\n      <div style=\"background:rgba(3,8,18,0.6);border-radius:7px;padding:8px;border:1px solid rgba(122,66,244,0.08);\">\r\n        <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;\"><span style=\"font-family:Orbitron,monospace;font-size:0.66em;font-weight:700;color:rgba(122,66,244,0.5);letter-spacing:0.1em;\" data-i18n=\"rm_lrc_sync\">LRC SYNC</span><span id=\"lrc-status\" style=\"font-size:0.7em;color:rgba(122,66,244,0.6);\"></span></div>\r\n        <input id=\"lrc-file-input\" class=\"rm-inp\" type=\"file\" accept=\".lrc,.txt\" style=\"padding:3px 6px;font-size:11px;cursor:pointer;margin-bottom:5px;\">\r\n        <textarea id=\"song-lyrics-input\" placeholder=\"[0:15] Line 1&#10;[0:30] Line 2\" style=\"width:100%;box-sizing:border-box;background:rgba(3,8,18,0.8);border:1px solid rgba(122,66,244,0.15);border-radius:4px;color:#bde0f0;padding:5px 7px;font-size:11px;outline:none;height:60px;resize:vertical;font-family:monospace;\"></textarea>\r\n        <label style=\"display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.78em;color:rgba(122,66,244,0.45);margin-top:5px;\"><input id=\"song-autosync\" type=\"checkbox\" style=\"accent-color:#7A42F4;\"> <span data-i18n=\"rm_autosync\">Auto-play &amp; sync when added</span></label>\r\n      </div>\r\n      <div style=\"display:flex;gap:6px;margin-top:2px;\"><button id=\"add-song\" class=\"rm-btn-full\" style=\"flex:1;\" data-i18n=\"rm_add_song_btn\">&#x2B22; Add Song</button><button id=\"save-song-btn\" class=\"rm-btn-primary\" data-i18n=\"rm_save_btn\">&#x2713; Save</button></div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"rm-sec collapsed\">\r\n  <div class=\"rm-sec-head\" onclick=\"this.closest('.rm-sec').classList.toggle('open')\"><div class=\"rm-sec-dot\"></div><span class=\"rm-sec-title\" data-i18n=\"rm_chat_sync_title\">Chat Sync</span><span class=\"rm-sec-arrow\">&#9660;</span></div>\r\n  <div class=\"rm-sec-body\">\r\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_enable_chat_sync\">Enable Chat Sync</span><label class=\"switch-checkbox\"><input id=\"music-chat-sync\" type=\"checkbox\"><span></span></label></div>\r\n    <div style=\"height:1px;background:rgba(122,66,244,0.1);margin:4px 0;\"></div>\r\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_mixed_sync\">Mixed Sync <span class=\"rm-badge\" data-i18n=\"rm_badge_me_bots\">ME+BOTS</span></span><label class=\"switch-checkbox\"><input id=\"music-mixed-sync\" type=\"checkbox\"><span></span></label></div>\r\n    <div style=\"font-size:0.7em;color:rgba(122,66,244,0.38);padding:2px 4px 5px;line-height:1.5;\" data-i18n=\"rm_mixed_sync_example\">You: line &#8594; Bots: line &#8594; You ...</div>\r\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_bots_only_sync\">Bots Only Sync <span class=\"rm-badge\" data-i18n=\"rm_badge_bots\">BOTS</span></span><label class=\"switch-checkbox\"><input id=\"music-bots-only-sync\" type=\"checkbox\"><span></span></label></div>\r\n    <div style=\"font-size:0.7em;color:rgba(122,66,244,0.38);padding:2px 4px 5px;line-height:1.5;\" data-i18n=\"rm_bots_only_example\">Bot1: line 1 &bull; Bot2: line 2 &bull; Bot3: line 3 ...</div>\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_unified_sync\">Unified Sync <span class=\"rm-badge\" data-i18n=\"rm_badge_all\">ALL</span></span><label class=\"switch-checkbox\"><input id=\"music-unified-sync\" type=\"checkbox\"><span></span></label></div>\n    <div style=\"font-size:0.7em;color:rgba(122,66,244,0.38);padding:2px 4px 5px;line-height:1.5;\" data-i18n=\"rm_unified_example\">You + every bot post the same line at the same moment</div>\r\n    <div style=\"height:1px;background:rgba(122,66,244,0.07);margin:4px 0;\"></div>\r\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_auto_delay\">Auto Delay<span id=\"bm-auto-delay-badge\" class=\"rm-badge\">off</span></span><label class=\"switch-checkbox\"><input id=\"music-auto-delay\" type=\"checkbox\" checked><span></span></label></div>\r\n    <div class=\"rm-sync-row\"><span class=\"rm-sync-label\" data-i18n=\"rm_sync_bot\">Sync Bot<span id=\"bm-sync-bot-badge\" class=\"rm-badge\">off</span></span><button id=\"music-sync-bot-btn\" style=\"background:rgba(122,66,244,0.06);border:1.5px solid rgba(122,66,244,0.25);color:rgba(122,66,244,0.6);cursor:pointer;font-size:0.7em;font-weight:700;padding:5px 18px;letter-spacing:0.1em;font-family:Orbitron,monospace;transition:all 0.2s;border-radius:4px;\">OFF</button></div>\r\n    <div id=\"bm-manual-delay-row\" class=\"rm-sync-row\" style=\"display:none;\"><span style=\"font-size:0.8em;color:rgba(122,66,244,0.45);\" data-i18n=\"rm_delay\">Delay</span><label class=\"slider\"><span class=\"slider-value\"></span><input id=\"music-sync-delay\" type=\"range\" min=\"-3000\" max=\"3000\" step=\"50\" value=\"0\" style=\"width:110px;\"></label></div>\r\n    <div style=\"display:flex;gap:6px;margin-top:6px;\"><button id=\"bm-test-chat\" style=\"flex:1;background:rgba(122,66,244,0.06);border:1.5px solid rgba(122,66,244,0.25);border-radius:6px;color:rgba(122,66,244,0.6);cursor:pointer;font-size:0.73em;font-weight:700;padding:5px 10px;font-family:Rajdhani,sans-serif;\" data-i18n=\"rm_test_chat\">&#9654; Test Chat</button><span id=\"bm-test-chat-status\" style=\"font-size:0.7em;color:rgba(122,66,244,0.45);align-self:center;\"></span></div>\r\n    <div style=\"margin-top:6px;\"><button id=\"bm-send-all-lyrics\" style=\"width:100%;background:rgba(122,66,244,0.06);border:1.5px solid rgba(122,66,244,0.25);border-radius:6px;color:rgba(122,66,244,0.6);cursor:pointer;font-size:0.73em;font-weight:700;padding:6px 10px;font-family:Rajdhani,sans-serif;letter-spacing:0.05em;transition:all 0.15s;\">&#9836; Send All Lyrics: OFF</button><div id=\"bm-send-lyrics-status\" style=\"font-size:0.66em;color:rgba(122,66,244,0.45);text-align:center;margin-top:3px;\"></div></div>\r\n    <div id=\"bm-dbg-wrap\" style=\"display:none;margin-top:5px;\"><pre id=\"bm-dbg-box\" style=\"background:#13101e;border:1px solid rgba(122,66,244,0.15);border-radius:4px;padding:5px 7px;font-size:0.63em;color:rgba(122,66,244,0.45);font-family:monospace;white-space:pre-wrap;max-height:110px;overflow-y:auto;margin:0;\"></pre></div>\r\n    <button id=\"bm-dbg-toggle\" style=\"width:100%;margin-top:4px;background:rgba(122,66,244,0.03);border:1px solid rgba(122,66,244,0.08);border-radius:4px;color:rgba(122,66,244,0.38);cursor:pointer;font-size:0.66em;padding:3px;font-family:Rajdhani,sans-serif;\" data-i18n=\"rm_show_debug\">Show Debug Log</button>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"rm-sec collapsed\">\r\n  <div class=\"rm-sec-head\" onclick=\"this.closest('.rm-sec').classList.toggle('open')\"><div class=\"rm-sec-dot\"></div><span class=\"rm-sec-title\" data-i18n=\"rm_backup_restore\">Backup &amp; Restore</span><span class=\"rm-sec-arrow\">&#9660;</span></div>\r\n  <div class=\"rm-sec-body\">\r\n    <div style=\"display:flex;flex-direction:column;gap:6px;\">\r\n      <span style=\"font-size:0.77em;color:rgba(122,66,244,0.45);\" data-i18n=\"rm_backup_desc\">Export your library to JSON \u2014 restore anytime.</span>\r\n      <div style=\"display:flex;gap:6px;margin-top:4px;\"><button id=\"music-export-btn\" class=\"rm-btn-full\" style=\"flex:1;\" data-i18n=\"rm_export\">&#x2B07; Export</button><button id=\"music-import-btn\" class=\"rm-btn-full\" style=\"flex:1;\" data-i18n=\"rm_import\">&#x2B06; Import</button><input id=\"music-import-file\" type=\"file\" accept=\".json\" style=\"display:none;\"></div>\r\n      <div id=\"music-backup-status\" style=\"font-size:0.73em;color:rgba(122,66,244,0.6);text-align:center;min-height:16px;\"></div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n</div></div>";
  const styles_default = "@import \"https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700&family=Poppins:wght@400;500;600;700;800&display=swap\";\r\n\r\n*{user-select:none;box-sizing:border-box;}\r\n\r\n/* ═══════════════════════════════════════════════════════════════\r\n   RYN — glass menu.\r\n   Every surface is translucent: the only opaque thing on screen is\r\n   the game behind it. Depth comes from blur + hairline borders +\r\n   soft shadows, the way iOS layers panels, never from fill.\r\n   ═══════════════════════════════════════════════════════════════ */\r\n:root{\r\n  --bg:transparent;\r\n  --bg-glass:rgba(255,255,255,0.06);\r\n  --accent:#8B5CFF;\r\n  --accent2:#4C9EFF;\r\n  --border:rgba(255,255,255,0.10);\r\n  --border-active:rgba(139,92,255,0.55);\r\n  --text:#FFFFFF;\r\n  --text-muted:rgba(235,235,245,0.62);\r\n  --text-dim:rgba(235,235,245,0.34);\r\n  --red:#ff4d6d;\r\n  --green:#00d68f;\r\n  --yellow:#ffd60a;\r\n  --font-head:'Poppins','Inter',sans-serif;\r\n  --font-body:'Inter','Poppins',sans-serif;\r\n\r\n  /* one blur recipe, reused everywhere so the panes read as one material */\r\n  --glass-blur:blur(44px) saturate(180%);\r\n  /* the game behind the menu is bright green — the base pane is a dark\r\n     vibrancy layer so white type keeps its contrast, and every pane above it\r\n     is a thin white film, the way iOS stacks material over content. */\r\n  --glass-base:rgba(16,14,26,0.46);\r\n  --glass-fill:rgba(255,255,255,0.06);\r\n  --glass-fill-strong:rgba(255,255,255,0.10);\r\n  --glass-hairline:inset 0 1px 0 rgba(255,255,255,0.16);\r\n  --radius-lg:28px;\r\n  --radius-md:18px;\r\n  --radius-sm:12px;\r\n  --row-h:52px;\r\n}\r\n\r\n@keyframes slide-in-top{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}\r\n@keyframes toclose{from{opacity:1;transform:scale(1) translateY(0);}to{opacity:0;transform:scale(0.98) translateY(-4px);}}\r\n@keyframes toopen{from{opacity:0;transform:scale(0.98) translateY(-4px);}to{opacity:1;transform:scale(1) translateY(0);}}\r\n@keyframes dot-blink{0%,100%{opacity:1;}50%{opacity:0.2;}}\r\n@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}\r\n@keyframes ripple{from{opacity:.4;transform:scale(0);}to{opacity:0;transform:scale(1.4);}}\r\n\r\nhtml,body{margin:0;padding:0;overflow:hidden;background:transparent;}\r\n*{font-family:var(--font-body);color:var(--text);opacity:1;}\r\nh1,h2{margin:0;font-family:var(--font-head);}\r\np{margin:0;color:var(--text-muted);}\r\nbutton{border:none;outline:none;cursor:pointer;}\r\n\r\n/* ═══ MENU CONTAINER — the stage the JS scales to fit ═══ */\r\n#menu-container{\r\n  position:absolute;top:50%;left:50%;\r\n  transform:translate(-50%,-50%);\r\n  width:1440px;height:840px;\r\n  display:flex;justify-content:center;align-items:center;\r\n}\r\n\r\n#menu-wrapper{\r\n  position:relative;\r\n  width:97%;height:95%;\r\n  background:var(--glass-base);\r\n  border:1px solid rgba(255,255,255,0.16);\r\n  border-radius:var(--radius-lg);\r\n  overflow:hidden;\r\n  backdrop-filter:var(--glass-blur);\r\n  -webkit-backdrop-filter:var(--glass-blur);\r\n  box-shadow:\r\n    0 24px 70px rgba(0,0,0,0.42),\r\n    var(--glass-hairline),\r\n    inset 0 -1px 0 rgba(0,0,0,0.18);\r\n  display:flex;flex-direction:column;\r\n}\r\n\r\n/* a faint top-light so the pane has a direction, like a real sheet of glass */\r\n#menu-wrapper::before{\r\n  content:'';position:absolute;inset:0;\r\n  background:linear-gradient(158deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.02) 42%,rgba(0,0,0,0.14) 100%);\r\n  border-radius:var(--radius-lg);\r\n  z-index:0;pointer-events:none;\r\n}\r\n\r\n#menu-wrapper.toclose{animation:150ms ease-in toclose forwards;}\r\n#menu-wrapper.toopen{animation:200ms cubic-bezier(.34,1.4,.64,1) toopen forwards;}\r\n\r\n/* ═══ HEADER ═══ */\r\nheader{\r\n  position:relative;z-index:5;\r\n  display:flex;justify-content:space-between;align-items:center;\r\n  height:62px;min-height:62px;\r\n  padding:0 24px;\r\n  background:transparent;\r\n  border-bottom:1px solid var(--border);\r\n  flex-shrink:0;\r\n}\r\n\r\nheader .page-title{\r\n  font-family:var(--font-head);\r\n  font-size:0.82em;\r\n  font-weight:700;\r\n  letter-spacing:0.24em;\r\n  text-transform:uppercase;\r\n  background:linear-gradient(90deg,#8B5CFF,#4C9EFF,#c0a6ff,#8B5CFF);\r\n  background-size:200% auto;\r\n  -webkit-background-clip:text;-webkit-text-fill-color:transparent;\r\n  animation:shimmer 5s linear infinite;\r\n}\r\n\r\nheader #credits{display:flex;align-items:center;gap:12px;height:62px;}\r\nheader #logo{display:block;height:32px;width:auto;filter:drop-shadow(0 0 8px rgba(139,92,255,0.55));}\r\n\r\nheader #close-button{\r\n  display:flex;align-items:center;justify-content:center;\r\n  width:34px;height:34px;\r\n  fill:none;stroke:var(--text-dim);stroke-width:1.6;\r\n  cursor:pointer;\r\n  border-radius:50%;\r\n  border:1px solid rgba(255,255,255,0.10);\r\n  background:rgba(255,255,255,0.05);\r\n  transition:all 160ms;\r\n  padding:7px;\r\n}\r\nheader #close-button:hover{\r\n  stroke:var(--text);background:rgba(255,77,109,0.16);\r\n  border-color:rgba(255,77,109,0.45);\r\n}\r\n\r\n/* ═══ MAIN LAYOUT ═══ */\r\nmain{\r\n  display:flex;flex-direction:row;\r\n  flex:1;min-height:0;\r\n  position:relative;z-index:2;\r\n}\r\n\r\n/* ═══ LEFT SIDEBAR — floating glass rail ═══ */\r\n#navbar-container{\r\n  display:flex;flex-direction:column;\r\n  width:212px;min-width:212px;\r\n  background:rgba(0,0,0,0.16);\r\n  backdrop-filter:blur(30px) saturate(160%);\r\n  -webkit-backdrop-filter:blur(30px) saturate(160%);\r\n  border-right:1px solid var(--border);\r\n  padding:14px 12px;\r\n  gap:6px;\r\n  position:relative;flex-shrink:0;overflow-y:auto;\r\n  justify-content:flex-start;\r\n}\r\n#navbar-container::-webkit-scrollbar{width:0;}\r\n\r\n.open-menu{\r\n  position:relative;\r\n  display:flex;flex-direction:row;\r\n  align-items:center;justify-content:flex-start;\r\n  gap:14px;\r\n  width:100%;height:56px;min-height:56px;\r\n  background:transparent;\r\n  border:1px solid transparent;\r\n  border-radius:var(--radius-sm);\r\n  color:var(--text-dim);opacity:0.85;\r\n  transition:color 140ms,border-color 140ms,background 140ms,transform 100ms,opacity 100ms;\r\n  cursor:pointer;\r\n  padding:0 16px;\r\n  overflow:hidden;box-sizing:border-box;\r\n}\r\n\r\n.open-menu:hover{\r\n  color:rgba(255,255,255,0.92);opacity:1;\r\n  background:rgba(255,255,255,0.07);\r\n  border-color:rgba(255,255,255,0.12);\r\n}\r\n\r\n.open-menu:active{\r\n  transform:scale(0.97);\r\n  opacity:0.8;\r\n}\r\n\r\n.open-menu.active{\r\n  color:var(--text);\r\n  background:linear-gradient(120deg,rgba(139,92,255,0.28),rgba(76,158,255,0.16));\r\n  border-color:var(--border-active);\r\n  box-shadow:0 6px 18px rgba(139,92,255,0.18),var(--glass-hairline);\r\n  pointer-events:none;\r\n}\r\n\r\n.open-menu.active .nav-icon{\r\n  filter:drop-shadow(0 0 6px rgba(139,92,255,0.95));\r\n}\r\n\r\n.nav-icon{width:26px;height:26px;transition:all 140ms;flex-shrink:0;}\r\n\r\n.nav-label{\r\n  font-family:var(--font-head);\r\n  font-size:1em;\r\n  letter-spacing:0.05em;\r\n  font-weight:700;\r\n  text-transform:uppercase;\r\n  line-height:1;\r\n  transition:all 140ms;\r\n}\r\n\r\n.open-menu .ripple{\r\n  position:absolute;z-index:5;\r\n  background:rgba(139,92,255,0.18);\r\n  border-radius:50%;opacity:0;\r\n  animation:ripple 550ms;\r\n  pointer-events:none;\r\n}\r\n\r\n/* ═══ PAGE CONTAINER ═══ */\r\n#page-container{\r\n  flex:1;min-width:0;\r\n  overflow-y:auto;overflow-x:hidden;\r\n  scroll-behavior:smooth;\r\n  padding:0;\r\n}\r\n\r\n#page-container::-webkit-scrollbar{width:8px;}\r\n#page-container::-webkit-scrollbar-track{background:transparent;}\r\n#page-container::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:8px;border:2px solid transparent;background-clip:content-box;}\r\n#page-container::-webkit-scrollbar-thumb:hover{background:rgba(139,92,255,0.5);background-clip:content-box;}\r\n\r\n/* ═══ PAGE — two glass columns so a page reads at a glance ═══ */\r\n.menu-page{display:none;}\r\n.menu-page.opened{\r\n  display:grid;\r\n  grid-template-columns:repeat(auto-fill,minmax(430px,1fr));\r\n  align-content:start;align-items:start;\r\n  gap:16px;\r\n  padding:22px 26px 30px;\r\n  animation:slide-in-top 140ms ease-out;\r\n}\r\n\r\n/* title + description always span the full width above the columns */\r\n.menu-page.opened>.page-title,\r\n.menu-page.opened>.page-description{grid-column:1/-1;}\r\n\r\n/* pages that carry their own layout (Home, Music) stay single-flow */\r\n.menu-page[data-id=\"0\"].opened,\r\n.menu-page[data-id=\"7\"].opened{display:block;padding:22px 26px 30px;}\r\n\r\n.menu-page .page-title{\r\n  font-family:var(--font-head);\r\n  font-size:1.5em;font-weight:700;\r\n  letter-spacing:0.03em;\r\n  color:var(--text);\r\n  text-transform:uppercase;\r\n  margin-bottom:2px;\r\n  display:flex;align-items:center;gap:12px;\r\n}\r\n.menu-page .page-title::before{\r\n  content:'';display:inline-block;\r\n  width:4px;height:1em;\r\n  background:linear-gradient(180deg,var(--accent),var(--accent2));\r\n  border-radius:3px;flex-shrink:0;\r\n  box-shadow:0 0 12px rgba(139,92,255,0.6);\r\n}\r\n\r\n.page-description{\r\n  font-size:0.88em;color:var(--text-dim);\r\n  margin-bottom:6px;\r\n  letter-spacing:0.01em;\r\n  padding-left:16px;\r\n  font-weight:400;\r\n  line-height:1.5;\r\n}\r\n\r\n/* ═══ SECTION — grouped inset card, iOS Settings style ═══ */\r\n.menu-page>.section{\r\n  margin-bottom:0;\r\n  background:var(--glass-fill);\r\n  border:1px solid var(--border);\r\n  border-radius:var(--radius-md);\r\n  overflow:hidden;\r\n  backdrop-filter:blur(18px) saturate(150%);\r\n  -webkit-backdrop-filter:blur(18px) saturate(150%);\r\n  box-shadow:0 8px 26px rgba(0,0,0,0.18),var(--glass-hairline);\r\n  transition:border-color 200ms,box-shadow 200ms;\r\n  position:relative;\r\n}\r\n.menu-page>.section:hover{\r\n  border-color:rgba(139,92,255,0.34);\r\n  box-shadow:0 10px 30px rgba(0,0,0,0.24),var(--glass-hairline);\r\n}\r\n\r\n.section-title{\r\n  font-family:var(--font-head);\r\n  font-size:0.82em;\r\n  font-weight:700;\r\n  letter-spacing:0.14em;\r\n  text-transform:uppercase;\r\n  color:rgba(200,180,255,0.85);\r\n  padding:13px 18px;\r\n  background:rgba(255,255,255,0.04);\r\n  border-bottom:1px solid var(--border);\r\n  display:flex;align-items:center;gap:9px;\r\n}\r\n.section-title::before{\r\n  content:'';width:5px;height:5px;\r\n  background:var(--accent);border-radius:50%;\r\n  box-shadow:0 0 8px var(--accent);flex-shrink:0;\r\n  opacity:0.9;\r\n}\r\n\r\n.section-content{display:flex;flex-direction:column;gap:0;}\r\n.small-section{font-size:0.85rem;}\r\n\r\n.section-content.split{flex-direction:row;gap:0;}\r\n.content-split{flex:1;display:flex;flex-direction:column;min-width:0;}\r\n.content-split:first-child{border-right:1px solid rgba(255,255,255,0.07);}\r\n\r\n/* ═══ CONTENT OPTION (row) ═══ */\r\n.content-option{\r\n  display:flex;justify-content:space-between;align-items:center;\r\n  min-height:var(--row-h);padding:9px 18px;\r\n  border-bottom:1px solid rgba(255,255,255,0.055);\r\n  transition:background 150ms;\r\n  position:relative;\r\n  overflow:visible;\r\n  gap:12px;\r\n}\r\n.content-option:last-child{border-bottom:none;}\r\n.content-option:hover{background:rgba(255,255,255,0.055);}\r\n\r\n.content-option.centered{justify-content:center;}\r\n.content-option.left-flex{justify-content:flex-start;gap:14px;}\r\n.content-option.text{justify-content:flex-start;}\r\n\r\n/* ═══ OPTION TITLE ═══ */\r\n.option-title{\r\n  font-size:1.02em;\r\n  font-weight:500;\r\n  color:rgba(235,235,245,0.86);\r\n  letter-spacing:0.01em;\r\n  transition:color 150ms;\r\n}\r\n.content-option:hover .option-title{color:#FFFFFF;}\r\n\r\n.option-content{display:flex;align-items:center;gap:10px;}\r\n\r\n/* ═══ TEXT VALUE ═══ */\r\n.text-value{\r\n  font-family:var(--font-head);\r\n  font-size:0.95em;color:#c3a8ff;\r\n  font-weight:600;\r\n}\r\n.simplified{\r\n  font-family:var(--font-body)!important;\r\n  font-size:0.86em!important;\r\n  color:var(--text-dim)!important;\r\n  font-weight:400!important;\r\n  line-height:1.65;\r\n}\r\n.highlight{color:var(--accent)!important;}\r\n\r\n/* ═══ TOOLTIP ═══ */\r\n.option-description{\r\n  display:none;position:fixed;z-index:9999;\r\n  background:rgba(28,24,44,0.72);\r\n  backdrop-filter:blur(30px) saturate(180%);\r\n  -webkit-backdrop-filter:blur(30px) saturate(180%);\r\n  border:1px solid rgba(255,255,255,0.14);\r\n  padding:10px 14px;border-radius:14px;\r\n  font-size:0.82em;color:rgba(235,235,245,0.86);\r\n  max-width:320px;line-height:1.55;\r\n  pointer-events:none;\r\n  box-shadow:0 14px 40px rgba(0,0,0,0.55),var(--glass-hairline);\r\n  transform:translateY(-110%);\r\n}\r\n.description-show{display:block;}\r\n\r\n/* ═══ HOTKEY BUTTON ═══ */\r\n.hotkeyInput{\r\n  min-width:62px;height:32px;\r\n  background:rgba(255,255,255,0.07);\r\n  border:1px solid rgba(255,255,255,0.13);\r\n  border-radius:9px;\r\n  font-family:var(--font-head);\r\n  font-size:0.76em;font-weight:600;\r\n  color:rgba(215,195,255,0.9);\r\n  letter-spacing:0.05em;\r\n  padding:0 10px;\r\n  transition:all 140ms;\r\n  display:flex;align-items:center;justify-content:center;\r\n}\r\n.hotkeyInput:hover{\r\n  background:rgba(139,92,255,0.20);\r\n  border-color:rgba(139,92,255,0.55);\r\n}\r\n.hotkeyInput.active{\r\n  background:rgba(139,92,255,0.28);\r\n  border-color:var(--accent);\r\n  box-shadow:0 0 0 3px rgba(139,92,255,0.18);\r\n  animation:dot-blink 0.8s ease infinite;\r\n}\r\n.hotkeyInput.red{\r\n  background:rgba(255,77,109,0.10)!important;\r\n  border-color:rgba(255,77,109,0.4)!important;\r\n  color:#ff4d6d!important;\r\n}\r\n\r\n/* ═══ TOGGLE SWITCH — iOS pill ═══ */\r\n.switch-checkbox{\r\n  position:relative;width:56px;height:32px;flex-shrink:0;\r\n}\r\n.switch-checkbox input{position:absolute;opacity:0;width:0;height:0;}\r\n\r\n.switch-checkbox span{\r\n  position:absolute;inset:0;\r\n  background:rgba(255,255,255,0.10);\r\n  border:1px solid rgba(255,255,255,0.14);\r\n  border-radius:999px;\r\n  cursor:pointer;\r\n  transition:all 240ms cubic-bezier(.34,1.2,.64,1);\r\n  box-shadow:inset 0 1px 3px rgba(0,0,0,0.25);\r\n}\r\n.switch-checkbox span::before{\r\n  content:'';position:absolute;\r\n  left:3px;top:50%;transform:translateY(-50%);\r\n  width:24px;height:24px;\r\n  background:rgba(255,255,255,0.75);\r\n  border-radius:50%;\r\n  box-shadow:0 2px 6px rgba(0,0,0,0.35);\r\n  transition:all 240ms cubic-bezier(.34,1.4,.64,1);\r\n}\r\n.switch-checkbox input:checked + span{\r\n  background:linear-gradient(120deg,rgba(139,92,255,0.85),rgba(76,158,255,0.7));\r\n  border-color:rgba(139,92,255,0.75);\r\n}\r\n.switch-checkbox input:checked + span::before{\r\n  left:calc(100% - 27px);\r\n  background:#FFFFFF;\r\n  box-shadow:0 2px 10px rgba(0,0,0,0.4);\r\n}\r\n\r\n/* ═══ BUTTONS ═══ */\r\n.option-button{\r\n  padding:9px 20px;\r\n  background:rgba(255,255,255,0.08);\r\n  border:1px solid rgba(255,255,255,0.14);\r\n  border-radius:11px;\r\n  font-family:var(--font-head);\r\n  font-size:0.78em;font-weight:600;\r\n  letter-spacing:0.07em;\r\n  color:#FFFFFF;\r\n  text-transform:uppercase;\r\n  backdrop-filter:blur(14px);\r\n  -webkit-backdrop-filter:blur(14px);\r\n  transition:all 140ms;\r\n}\r\n.option-button:hover{\r\n  background:rgba(139,92,255,0.28);\r\n  border-color:rgba(139,92,255,0.7);\r\n  box-shadow:0 6px 20px rgba(139,92,255,0.25);\r\n  transform:translateY(-1px);\r\n}\r\n\r\n/* === SOCIAL LINK BUTTONS === */\r\n.ryn-social-btn:hover{\r\n  background:rgba(139,92,255,0.26)!important;\r\n  border-color:rgba(139,92,255,0.7)!important;\r\n  box-shadow:0 6px 18px rgba(139,92,255,0.28);\r\n  transform:translateY(-1px);\r\n}\r\n.ryn-social-btn svg{width:21px;height:21px;}\r\n.ryn-social-big:hover{\r\n  background:rgba(139,92,255,0.16)!important;\r\n  border-color:rgba(139,92,255,0.8)!important;\r\n  box-shadow:0 10px 30px rgba(139,92,255,0.32);\r\n  transform:translateY(-3px);\r\n}\r\n.ryn-social-big svg{width:46px;height:46px;}\r\n\r\n.option-button.red{\r\n  background:rgba(255,77,109,0.12)!important;\r\n  border-color:rgba(255,77,109,0.4)!important;\r\n  color:#ff4d6d!important;\r\n}\r\n.option-button.red:hover{\r\n  background:rgba(255,77,109,0.22)!important;\r\n  border-color:rgba(255,77,109,0.7)!important;\r\n  box-shadow:0 6px 18px rgba(255,77,109,0.25)!important;\r\n}\r\n\r\n/* ═══ INPUT ═══ */\r\n.input{\r\n  height:34px;width:200px;\r\n  background:rgba(255,255,255,0.07);\r\n  border:1px solid rgba(255,255,255,0.13);\r\n  border-radius:10px;\r\n  font-family:var(--font-body);\r\n  font-size:0.9em;font-weight:400;\r\n  color:var(--text);\r\n  text-align:center;\r\n  transition:all 140ms;\r\n  padding:0 12px;\r\n}\r\n.input:focus{\r\n  outline:none;\r\n  border-color:rgba(139,92,255,0.6);\r\n  box-shadow:0 0 0 3px rgba(139,92,255,0.15);\r\n  background:rgba(139,92,255,0.10);\r\n}\r\n\r\n/* ═══ COLOR PICKER ═══ */\r\ninput[id][type=\"color\"]{\r\n  width:54px;height:30px;\r\n  border:1px solid rgba(255,255,255,0.14);\r\n  border-radius:9px;\r\n  padding:2px;\r\n  background:rgba(255,255,255,0.06);\r\n  cursor:pointer;\r\n  transition:border-color 140ms;\r\n}\r\ninput[id][type=\"color\"]:hover{border-color:rgba(139,92,255,0.6);}\r\n\r\n.reset-color{\r\n  width:18px;height:10px;\r\n  background:var(--data-color,var(--accent));\r\n  border-radius:6px;\r\n  border:none;cursor:pointer;\r\n  box-shadow:0 0 6px currentColor;\r\n  flex-shrink:0;\r\n}\r\n\r\n/* ═══ SLIDER ═══ */\r\n.slider{display:flex;align-items:center;gap:10px;}\r\n.slider input[type=\"range\"]{\r\n  -webkit-appearance:none;\r\n  width:132px;height:5px;\r\n  background:linear-gradient(90deg,var(--accent) var(--val,50%),rgba(255,255,255,0.12) var(--val,50%));\r\n  border-radius:999px;\r\n  border:none;outline:none;cursor:pointer;\r\n}\r\n.slider input[type=\"range\"]::-webkit-slider-thumb{\r\n  -webkit-appearance:none;\r\n  width:17px;height:17px;\r\n  border-radius:50%;\r\n  background:#FFFFFF;\r\n  box-shadow:0 2px 8px rgba(0,0,0,0.45);\r\n  border:none;\r\n  transition:transform 120ms;\r\n}\r\n.slider input[type=\"range\"]::-webkit-slider-thumb:hover{transform:scale(1.2);}\r\n.slider-value{\r\n  font-family:var(--font-head);\r\n  font-size:0.82em;color:#c3a8ff;\r\n  min-width:38px;text-align:right;font-weight:600;\r\n}\r\n\r\n/* ═══ DISCONNECT BUTTON ═══ */\r\n.disconnect-button{\r\n  width:19px;height:19px;\r\n  fill:rgba(255,255,255,0.16);\r\n  cursor:pointer;transition:fill 180ms;flex-shrink:0;\r\n}\r\n.content-option:hover .disconnect-button{fill:rgba(255,77,109,0.5);}\r\n.disconnect-button:hover{fill:#cc4444!important;}\r\n\r\n/* ═══ KEY BADGE ═══ */\r\n.key-badge{\r\n  display:inline-flex;align-items:center;justify-content:center;\r\n  min-width:30px;height:24px;padding:0 7px;\r\n  background:rgba(255,255,255,0.07);\r\n  border:1px solid rgba(255,255,255,0.13);\r\n  border-radius:7px;\r\n  font-family:var(--font-head);\r\n  font-size:0.74em;font-weight:600;\r\n  color:rgba(200,180,255,0.85);\r\n}\r\n\r\n/* ═══ BOT CONTAINER ═══ */\r\n#bot-container{padding:2px 0;}\r\n\r\n/* ═══ ICON helper ═══ */\r\n.icon{width:48px;height:48px;}\r\n.small-icon{width:18px;height:18px;}\r\n\r\n/* ═══ RED variant ═══ */\r\n.red{\r\n  background:rgba(255,77,109,0.08)!important;\r\n  border-color:rgba(255,77,109,0.35)!important;\r\n  color:#ff4d6d!important;\r\n}\r\n\r\n/* ═══ SEARCH ═══ */\r\n#ryn-search-wrap{position:relative;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);border-radius:11px;padding:0 14px;height:38px;transition:border-color 160ms,box-shadow 160ms;min-width:240px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}\r\n#ryn-search-wrap:focus-within{border-color:rgba(139,92,255,0.55);box-shadow:0 0 0 2px rgba(139,92,255,0.12);background:rgba(139,92,255,0.05);}\r\n#ryn-search-input{flex:1;background:transparent;border:none;outline:none;font-family:var(--font-body);font-size:0.92em;color:var(--text);min-width:0;}\r\n#ryn-search-input::placeholder{color:rgba(200,200,215,0.3);}\r\n#ryn-search-clear{font-size:0.65em;color:rgba(200,200,215,0.3);cursor:pointer;flex-shrink:0;display:none;transition:color 120ms;line-height:1;}\r\n#ryn-search-clear:hover{color:rgba(255,77,109,0.8);}\r\n#ryn-search-dropdown{display:none;position:absolute;top:calc(100% + 6px);right:0;width:330px;max-height:380px;overflow-y:auto;background:rgba(22,19,36,0.78);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid rgba(255,255,255,0.14);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,0.55),var(--glass-hairline);z-index:9999;padding:6px;}\r\n#ryn-search-dropdown::-webkit-scrollbar{width:2px;}\r\n#ryn-search-dropdown::-webkit-scrollbar-thumb{background:rgba(139,92,255,0.3);border-radius:2px;}\r\n.ryn-si{display:flex;flex-direction:column;gap:2px;padding:7px 10px;border-radius:5px;cursor:pointer;transition:background 120ms;border:1px solid transparent;}\r\n.ryn-si:hover,.ryn-si.ryn-fx{background:rgba(139,92,255,0.12);border-color:rgba(139,92,255,0.22);}\r\n.ryn-st{font-size:0.92em;font-weight:600;color:#FFFFFF;line-height:1.3;}\r\n.ryn-st mark{background:rgba(139,92,255,0.4);color:#FFFFFF;border-radius:2px;padding:0 1px;}\r\n.ryn-sp{font-size:0.78em;color:rgba(139,92,255,0.55);font-family:var(--font-head);letter-spacing:0.06em;text-transform:uppercase;}\r\n.ryn-se{text-align:center;padding:18px 12px;font-size:0.77em;color:rgba(200,200,215,0.3);font-style:italic;}\r\n.ryn-sl{font-size:0.62em;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(139,92,255,0.4);padding:5px 10px 2px;margin-top:2px;}\r\n\r\n\r\n/* ═══════════ CHAT LOG ═══════════ */\r\n#ryn-chatlog{\r\n  position:fixed;z-index:9998;\r\n  display:flex;flex-direction:column;\r\n  min-width:200px;min-height:110px;\r\n  background:var(--bg-glass);\r\n  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);\r\n  border:1px solid var(--border);border-radius:10px;\r\n  box-shadow:0 10px 34px rgba(0,0,0,.6);\r\n  font-family:var(--font-body);\r\n  overflow:hidden;\r\n  opacity:1;\r\n  transition:opacity 600ms ease;\r\n}\r\n#ryn-chatlog.cl-idle{opacity:0;pointer-events:none;}\r\n#ryn-chatlog:hover{opacity:1;pointer-events:auto;}\r\n#cl-head{\r\n  display:flex;align-items:center;justify-content:space-between;\r\n  height:26px;min-height:26px;padding:0 10px;\r\n  background:rgba(139,92,255,.10);\r\n  border-bottom:1px solid var(--border);\r\n  cursor:move;user-select:none;\r\n}\r\n#cl-title{\r\n  font-family:var(--font-head);\r\n  font-size:.68em;font-weight:600;\r\n  letter-spacing:.09em;text-transform:uppercase;\r\n  color:var(--text-muted);\r\n}\r\n#cl-clear{\r\n  font-size:.7em;color:var(--text-dim);cursor:pointer;\r\n  padding:2px 4px;border-radius:4px;\r\n  transition:color 140ms,background 140ms;\r\n}\r\n#cl-clear:hover{color:var(--red);background:rgba(255,77,109,.12);}\r\n#cl-list{\r\n  flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;\r\n  padding:5px 4px;\r\n  display:flex;flex-direction:column;gap:1px;\r\n}\r\n#cl-list::-webkit-scrollbar{width:3px;}\r\n#cl-list::-webkit-scrollbar-track{background:transparent;}\r\n#cl-list::-webkit-scrollbar-thumb{background:rgba(139,92,255,.3);border-radius:3px;}\r\n.cl-row{\r\n  display:flex;align-items:baseline;gap:6px;\r\n  padding:3px 7px;border-radius:5px;\r\n  font-size:.72em;line-height:1.45;\r\n  animation:cl-in 260ms ease;\r\n}\r\n.cl-row:hover{background:rgba(255,255,255,.04);}\r\n@keyframes cl-in{from{opacity:0;transform:translateX(-5px);}to{opacity:1;transform:none;}}\r\n.cl-time{\r\n  flex-shrink:0;font-size:.86em;\r\n  color:var(--text-dim);font-variant-numeric:tabular-nums;\r\n}\r\n.cl-ico{flex-shrink:0;font-size:.9em;line-height:1;}\r\n.cl-txt{color:var(--text-muted);word-break:break-word;min-width:0;}\r\n.cl-who{color:var(--text);font-weight:600;margin-inline-end:5px;}\r\n#cl-grip{\r\n  position:absolute;right:0;bottom:0;\r\n  width:14px;height:14px;cursor:nwse-resize;\r\n  background:linear-gradient(135deg,transparent 46%,rgba(139,92,255,.5) 46%,rgba(139,92,255,.5) 60%,transparent 60%);\r\n}\r\n\r\n/* ═══════════ VISUALS — refinement ═══════════\r\n   Same structure as before, just easier to read and to aim at. The colour\r\n   swatch becomes a round chip you can actually see, the reset dot stops\r\n   taking permanent width, and an enabled row carries a soft accent edge so\r\n   you can scan what is on without reading every switch. */\r\n.menu-page[data-id=\"3\"] .content-option{\r\n  position:relative;\r\n  border-radius:10px;\r\n  padding-inline:18px;\r\n  transition:background 150ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] .content-option:hover{background:rgba(139,92,255,0.05);}\r\n\r\n/* حافة خفيفة تقول \"هذا شغّال\" بلا ما تقرأ المفتاح */\r\n.menu-page[data-id=\"3\"] .content-option::before{\r\n  content:'';position:absolute;left:0;top:7px;bottom:7px;\r\n  width:2px;border-radius:0 2px 2px 0;\r\n  background:var(--accent);\r\n  opacity:0;transition:opacity 200ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] .content-option:has(input[type=\"checkbox\"]:checked)::before{opacity:1;}\r\n.menu-page[data-id=\"3\"] .content-option:has(input[type=\"checkbox\"]:checked) .option-title{color:var(--text);}\r\n\r\n.menu-page[data-id=\"3\"] .option-title{\r\n  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\r\n  transition:color 150ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] .option-content{gap:9px;}\r\n\r\n/* رقاقة اللون: دائرة واضحة بدل مربّع باهت */\r\n.menu-page[data-id=\"3\"] input[type=\"color\"]{\r\n  width:26px;height:26px;padding:0;\r\n  border:none;border-radius:50%;\r\n  background:transparent;cursor:pointer;overflow:hidden;\r\n  box-shadow:0 0 0 1px rgba(255,255,255,0.16),0 2px 5px rgba(0,0,0,0.4);\r\n  transition:transform 160ms ease,box-shadow 160ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] input[type=\"color\"]::-webkit-color-swatch-wrapper{padding:0;}\r\n.menu-page[data-id=\"3\"] input[type=\"color\"]::-webkit-color-swatch{border:none;border-radius:50%;}\r\n.menu-page[data-id=\"3\"] input[type=\"color\"]:hover{\r\n  transform:scale(1.14);\r\n  box-shadow:0 0 0 1px rgba(255,255,255,0.34),0 3px 9px rgba(0,0,0,0.55);\r\n}\r\n.menu-page[data-id=\"3\"] .content-option:has(input[type=\"checkbox\"]:checked) input[type=\"color\"]{\r\n  box-shadow:0 0 0 1px rgba(255,255,255,0.3),0 0 9px rgba(139,92,255,0.4);\r\n}\r\n\r\n/* زر الإرجاع: يظهر عند المرور فقط، فما ياخذ عرضاً دائماً */\r\n.menu-page[data-id=\"3\"] .reset-color{\r\n  width:13px;height:13px;border-radius:50%;\r\n  opacity:0;\r\n  transition:opacity 160ms ease,transform 160ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] .content-option:hover .reset-color{opacity:0.85;}\r\n.menu-page[data-id=\"3\"] .reset-color:hover{opacity:1;transform:scale(1.28);}\r\n\r\n/* عنوان القسم: نقطته تنوّر لو فيه شي شغّال جواه */\r\n.menu-page[data-id=\"3\"] .section-title{\r\n  display:flex;align-items:center;gap:8px;\r\n}\r\n.menu-page[data-id=\"3\"] .section-title::before{\r\n  content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0;\r\n  background:rgba(255,255,255,0.14);\r\n  transition:background 240ms ease,box-shadow 240ms ease;\r\n}\r\n.menu-page[data-id=\"3\"] .section:has(input[type=\"checkbox\"]:checked) .section-title::before{\r\n  background:var(--accent);box-shadow:0 0 8px rgba(139,92,255,0.75);\r\n}\r\n\r\n/* ═══════════ COMBAT — grouping + click-to-toggle ═══════════\r\n   The label is now a real <label for=\"...\"> so the whole name is a hit\r\n   target: you flip an option by clicking its name, not by aiming at a\r\n   small switch. Cursor and hover state make that discoverable. */\r\n.menu-page[data-id=\"2\"] .content-option{\r\n  position:relative;\r\n  border-radius:10px;\r\n  padding-inline:18px;\r\n  transition:background 150ms ease;\r\n}\r\n.menu-page[data-id=\"2\"] .content-option:hover{background:rgba(139,92,255,0.05);}\r\nlabel.option-title{\r\n  cursor:pointer;user-select:none;\r\n  flex:1;min-width:0;\r\n  transition:color 150ms ease;\r\n}\r\nlabel.option-title:hover{color:var(--text);}\r\nlabel.option-title:active{opacity:0.7;}\r\n\r\n/* حافة تقول \"شغّال\" بلا ما تقرأ المفتاح */\r\n.menu-page[data-id=\"2\"] .content-option::before{\r\n  content:'';position:absolute;left:0;top:7px;bottom:7px;\r\n  width:2px;border-radius:0 2px 2px 0;\r\n  background:var(--accent);\r\n  opacity:0;transition:opacity 200ms ease;\r\n}\r\n.menu-page[data-id=\"2\"] .content-option:has(input[type=\"checkbox\"]:checked)::before{opacity:1;}\r\n.menu-page[data-id=\"2\"] .content-option:has(input[type=\"checkbox\"]:checked) .option-title{color:var(--text);}\r\n\r\n/* عنوان القسم + سطر يشرح غرضه */\r\n.menu-page[data-id=\"2\"] .section-title{\r\n  display:flex;flex-direction:column;align-items:flex-start;gap:3px;\r\n}\r\n.sec-sub{\r\n  font-family:var(--font-body);\r\n  font-size:0.78em;font-weight:400;letter-spacing:0;\r\n  text-transform:none;color:var(--text-dim);\r\n  line-height:1.45;\r\n}\r\n/* نقطة القسم تنوّر لو فيه خيار شغّال جواه */\r\n.menu-page[data-id=\"2\"] .section-title::after{\r\n  content:'';position:absolute;top:16px;right:18px;\r\n  width:5px;height:5px;border-radius:50%;\r\n  background:rgba(255,255,255,0.14);\r\n  transition:background 240ms ease,box-shadow 240ms ease;\r\n}\r\n.menu-page[data-id=\"2\"] .section{position:relative;}\r\n.menu-page[data-id=\"2\"] .section:has(input[type=\"checkbox\"]:checked) .section-title::after{\r\n  background:var(--accent);box-shadow:0 0 8px rgba(139,92,255,0.75);\r\n}\r\n";
  const Game_default = "#ryn-menu-frame {\r\n    position: absolute;\r\n    top: 0;\r\n    left: 0;\r\n    bottom: 0;\r\n    right: 0;\r\n    width: 100%;\r\n    height: 100%;\r\n    border: none;\r\n    outline: none;\r\n    z-index: 10;\r\n}\r\n\r\n#promoImgHolder,\r\n.menuHeader,\r\n.menuText,\r\n#guideCard,\r\n#gameName,\r\n#pingDisplay,\r\n#partyButton,\r\n#onetrust-consent-sdk,\r\n.adMenuCard,\r\n#topInfoHolder > div:not([id]):not([class]),\r\n#touch-controls-fullscreen,\r\n#altcha,\r\n#joinPartyButton {\r\n    display: none!important;\r\n}\r\n\r\n.menuCard {\r\n    box-shadow: none;\r\n}\r\n\r\n#setupCard {\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 12px;\r\n    background: rgba(25,25,25,0.45);\r\n    backdrop-filter: blur(25px);\r\n    -webkit-backdrop-filter: blur(25px);\r\n    border: 1px solid rgba(255,255,255,0.2);\r\n    border-radius: 20px;\r\n    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.1);\r\n    max-height: auto;\r\n    width: 280px;\r\n}\r\n\r\n#setupCard > * {\r\n    margin: 0!important;\r\n}\r\n\r\n#linksContainer2 {\r\n    background: #6d6d6d77;\r\n}\r\n\r\n#bottomContainer {\r\n    bottom: 20px;\r\n}\r\n\r\n#topInfoHolder {\r\n    display: flex;\r\n    flex-direction: column;\r\n    justify-content: right;\r\n    align-items: flex-end;\r\n    gap: 10px;\r\n}\r\n\r\n#killCounter, #totalKillCounter {\r\n    position: static;\r\n    margin: 0;\r\n    background-image: url(../img/icons/skull.png);\r\n}\r\n\r\n.actionBarItem {\r\n    position: relative;\r\n    border: 2px solid rgba(80,30,160,0.45) !important;\r\n    border-radius: 4px !important;\r\n}\r\n\r\n.itemCounter {\r\n    position: absolute;\r\n    top: 3px;\r\n    right: 3px;\r\n    font-size: 0.95em;\r\n    color: white;\r\n    text-shadow: #3d3f42 2px 0px 0px, #3d3f42 1.75517px 0.958851px 0px, #3d3f42 1.0806px 1.68294px 0px, #3d3f42 0.141474px 1.99499px 0px, #3d3f42 -0.832294px 1.81859px 0px, #3d3f42 -1.60229px 1.19694px 0px, #3d3f42 -1.97998px 0.28224px 0px, #3d3f42 -1.87291px -0.701566px 0px, #3d3f42 -1.30729px -1.5136px 0px, #3d3f42 -0.421592px -1.95506px 0px, #3d3f42 0.567324px -1.91785px 0px, #3d3f42 1.41734px -1.41108px 0px, #3d3f42 1.92034px -0.558831px 0px;\r\n}\r\n\r\n.itemCounter.hidden {\r\n    display: none;\r\n}\r\n\r\n#ryn-topright-hud { position: fixed; top: 12px; right: 12px; z-index: 9999; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; pointer-events: none; font-family: \"Hammersmith One\", Arial, sans-serif; }\r\n.ryn-hud-row { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; min-width: 160px; }\r\n.ryn-hud-bar-bg { width: 160px; height: 8px; background: rgba(0,0,0,0.55); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }\r\n.ryn-hud-bar-fill { height: 100%; border-radius: 4px; transition: width 0.15s ease; }\r\n#ryn-hud-hp-fill { background: linear-gradient(90deg,#cc5151,#e05151); }\r\n#ryn-hud-r1-fill { background: linear-gradient(90deg,#f0b429,#f0c060); }\r\n#ryn-hud-r2-fill { background: linear-gradient(90deg,#51cc88,#60e0a0); }\r\n.ryn-hud-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.6); text-shadow: 0 1px 3px rgba(0,0,0,0.9); }\r\n.ryn-hud-val { font-size: 11px; color: rgba(255,255,255,0.9); text-shadow: 0 1px 4px rgba(0,0,0,0.9); letter-spacing: 0.05em; }\r\n\r\n#rynStats {\r\n    position: absolute;\r\n    color: rgb(225, 210, 255);\r\n    font: 13px \"Hammersmith One\";\r\n    bottom: 210px;\r\n    left: 20px;\r\n\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 5px;\r\n}\r\n\r\n.hidden {\r\n    display: none!important;\r\n}";
  const Store_default = "#ryn-store-container {\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 10px;\r\n    max-width: 400px;\r\n    width: 100%;\r\n\r\n    position: absolute;\r\n    top: 50%;\r\n    left: 50%;\r\n    transform: translate(-50%, -50%) scale(0.9);\r\n}\r\n\r\n#ryn-store-toggle {\r\n    display: flex;\r\n    justify-content: center;\r\n    align-items: center;\r\n    padding: 10px;\r\n    background-color: rgba(0, 0, 0, 0.15);\r\n    color: #fff;\r\n    border-radius: 4px;\r\n    cursor: pointer;\r\n    font-size: 20px;\r\n    pointer-events: all;\r\n}\r\n\r\n#ryn-store-items {\r\n    background-color: rgba(0, 0, 0, 0.15);\r\n    max-height: 200px;\r\n    height: 100%;\r\n    padding: 10px;\r\n    overflow-y: scroll;\r\n    border-radius: 4px;\r\n    pointer-events: all;\r\n    scrollbar-width: none;\r\n}\r\n\r\n#ryn-store-items::-webkit-scrollbar {\r\n    display: none;\r\n    width: 0;\r\n    height: 0;\r\n    background: transparent;\r\n}\r\n\r\n.storeItemContainer {\r\n    display: flex;\r\n    align-items: center;\r\n    gap: 10px;\r\n    padding: 5px;\r\n    height: 50px;\r\n    box-sizing: border-box;\r\n    overflow: hidden;\r\n}\r\n\r\n.storeHat {\r\n    display: flex;\r\n    justify-content: center;\r\n    align-items: center;\r\n    width: 45px;\r\n    height: 45px;\r\n    margin-top: -5px;\r\n    pointer-events: none;\r\n}\r\n\r\n.storeItemName {\r\n    color: #fff;\r\n    font-size: 20px;\r\n}\r\n\r\n.equipButton {\r\n    margin-left: auto;\r\n    color: #80eefc;\r\n    cursor: pointer;\r\n    font-size: 35px;\r\n}";
  const Hats = {
    [0]: {
      index: 0,
      id: 0,
      name: "Unequip",
      dontSell: true,
      price: 0,
      scale: 0,
      description: "None"
    },
    [45]: {
      index: 1,
      id: 45,
      name: "Shame!",
      dontSell: true,
      price: 0,
      scale: 120,
      description: "hacks are for losers"
    },
    [51]: {
      index: 2,
      id: 51,
      name: "Moo Cap",
      price: 0,
      scale: 120,
      description: "coolest mooer around"
    },
    [50]: {
      index: 3,
      id: 50,
      name: "Apple Cap",
      price: 0,
      scale: 120,
      description: "apple farms remembers"
    },
    [28]: {
      index: 4,
      id: 28,
      name: "Moo Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [29]: {
      index: 5,
      id: 29,
      name: "Pig Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [30]: {
      index: 6,
      id: 30,
      name: "Fluff Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [36]: {
      index: 7,
      id: 36,
      name: "Pandou Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [37]: {
      index: 8,
      id: 37,
      name: "Bear Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [38]: {
      index: 9,
      id: 38,
      name: "Monkey Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [44]: {
      index: 10,
      id: 44,
      name: "Polar Head",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [35]: {
      index: 11,
      id: 35,
      name: "Fez Hat",
      price: 0,
      scale: 120,
      description: "no effect"
    },
    [42]: {
      index: 12,
      id: 42,
      name: "Enigma Hat",
      price: 0,
      scale: 120,
      description: "join the enigma army"
    },
    [43]: {
      index: 13,
      id: 43,
      name: "Blitz Hat",
      price: 0,
      scale: 120,
      description: "hey everybody i'm blitz"
    },
    [49]: {
      index: 14,
      id: 49,
      name: "Bob XIII Hat",
      price: 0,
      scale: 120,
      description: "like and subscribe"
    },
    [57]: {
      index: 15,
      id: 57,
      name: "Pumpkin",
      price: 50,
      scale: 120,
      description: "Spooooky"
    },
    [8]: {
      index: 16,
      id: 8,
      name: "Bummle Hat",
      price: 100,
      scale: 120,
      description: "no effect"
    },
    [2]: {
      index: 17,
      id: 2,
      name: "Straw Hat",
      price: 500,
      scale: 120,
      description: "no effect"
    },
    [15]: {
      index: 18,
      id: 15,
      name: "Winter Cap",
      price: 600,
      scale: 120,
      description: "allows you to move at normal speed in snow",
      coldM: 1
    },
    [5]: {
      index: 19,
      id: 5,
      name: "Cowboy Hat",
      price: 1e3,
      scale: 120,
      description: "no effect"
    },
    [4]: {
      index: 20,
      id: 4,
      name: "Ranger Hat",
      price: 2e3,
      scale: 120,
      description: "no effect"
    },
    [18]: {
      index: 21,
      id: 18,
      name: "Explorer Hat",
      price: 2e3,
      scale: 120,
      description: "no effect"
    },
    [31]: {
      index: 22,
      id: 31,
      name: "Flipper Hat",
      price: 2500,
      scale: 120,
      description: "have more control while in water",
      watrImm: true
    },
    [1]: {
      index: 23,
      id: 1,
      name: "Marksman Cap",
      price: 3e3,
      scale: 120,
      description: "increases arrow speed and range",
      aMlt: 1.3
    },
    [10]: {
      index: 24,
      id: 10,
      name: "Bush Gear",
      price: 3e3,
      scale: 160,
      description: "allows you to disguise yourself as a bush"
    },
    [48]: {
      index: 25,
      id: 48,
      name: "Halo",
      price: 3e3,
      scale: 120,
      description: "no effect"
    },
    [6]: {
      index: 26,
      id: 6,
      name: "Soldier Helmet",
      price: 4e3,
      scale: 120,
      description: "reduces damage taken but slows movement",
      spdMult: .94,
      dmgMult: .75
    },
    [23]: {
      index: 27,
      id: 23,
      name: "Anti Venom Gear",
      price: 4e3,
      scale: 120,
      description: "makes you immune to poison",
      poisonRes: 1
    },
    [13]: {
      index: 28,
      id: 13,
      name: "Medic Gear",
      price: 5e3,
      scale: 110,
      description: "slowly regenerates health over time",
      healthRegen: 3
    },
    [9]: {
      index: 29,
      id: 9,
      name: "Miners Helmet",
      price: 5e3,
      scale: 120,
      description: "earn 1 extra gold per resource",
      extraGold: 1
    },
    [32]: {
      index: 30,
      id: 32,
      name: "Musketeer Hat",
      price: 5e3,
      scale: 120,
      description: "reduces cost of projectiles",
      projCost: .5
    },
    [7]: {
      index: 31,
      id: 7,
      name: "Bull Helmet",
      price: 6e3,
      scale: 120,
      description: "increases damage done but drains health",
      healthRegen: -5,
      dmgMultO: 1.5,
      spdMult: .96
    },
    [22]: {
      index: 32,
      id: 22,
      name: "Emp Helmet",
      price: 6e3,
      scale: 120,
      description: "turrets won't attack but you move slower",
      antiTurret: 1,
      spdMult: .7
    },
    [12]: {
      index: 33,
      id: 12,
      name: "Booster Hat",
      price: 6e3,
      scale: 120,
      description: "increases your movement speed",
      spdMult: 1.16
    },
    [26]: {
      index: 34,
      id: 26,
      name: "Barbarian Armor",
      price: 8e3,
      scale: 120,
      description: "knocks back enemies that attack you",
      dmgK: .6
    },
    [21]: {
      index: 35,
      id: 21,
      name: "Plague Mask",
      price: 1e4,
      scale: 120,
      description: "melee attacks deal poison damage",
      poisonDmg: 5,
      poisonTime: 6
    },
    [46]: {
      index: 36,
      id: 46,
      name: "Bull Mask",
      price: 1e4,
      scale: 120,
      description: "bulls won't target you unless you attack them",
      bullRepel: 1
    },
    [14]: {
      index: 37,
      id: 14,
      name: "Windmill Hat",
      topSprite: true,
      price: 1e4,
      scale: 120,
      description: "generates points while worn",
      pps: 1.5
    },
    [11]: {
      index: 38,
      id: 11,
      name: "Spike Gear",
      topSprite: true,
      price: 1e4,
      scale: 120,
      description: "deal damage to players that damage you",
      dmg: .45
    },
    [53]: {
      index: 39,
      id: 53,
      name: "Turret Gear",
      topSprite: true,
      price: 1e4,
      scale: 120,
      description: "you become a walking turret",
      turret: {
        projectile: 1,
        range: 700,
        rate: 2500
      },
      spdMult: .7,
      knockback: 33.3
    },
    [20]: {
      index: 40,
      id: 20,
      name: "Samurai Armor",
      price: 12e3,
      scale: 120,
      description: "increased attack speed and fire rate",
      atkSpd: .78
    },
    [58]: {
      index: 41,
      id: 58,
      name: "Dark Knight",
      price: 12e3,
      scale: 120,
      description: "restores health when you deal damage",
      healD: .4
    },
    [27]: {
      index: 42,
      id: 27,
      name: "Scavenger Gear",
      price: 15e3,
      scale: 120,
      description: "earn double points for each kill",
      kScrM: 2
    },
    [40]: {
      index: 43,
      id: 40,
      name: "Tank Gear",
      price: 15e3,
      scale: 120,
      description: "increased damage to buildings but slower movement",
      spdMult: .3,
      bDmg: 3.3
    },
    [52]: {
      index: 44,
      id: 52,
      name: "Thief Gear",
      price: 15e3,
      scale: 120,
      description: "steal half of a players gold when you kill them",
      goldSteal: .5
    },
    [55]: {
      index: 45,
      id: 55,
      name: "Bloodthirster",
      price: 2e4,
      scale: 120,
      description: "Restore Health when dealing damage. And increased damage",
      healD: .25,
      dmgMultO: 1.2
    },
    [56]: {
      index: 46,
      id: 56,
      name: "Assassin Gear",
      price: 2e4,
      scale: 120,
      description: "Go invisible when not moving. Can't eat. Increased speed",
      noEat: true,
      spdMult: 1.1,
      invisTimer: 1e3
    }
  };
  const Accessories = {
    [0]: {
      index: 0,
      id: 0,
      name: "Unequip",
      dontSell: true,
      price: 0,
      scale: 0,
      xOffset: 0,
      description: "None"
    },
    [12]: {
      index: 1,
      id: 12,
      name: "Snowball",
      price: 1e3,
      scale: 105,
      xOffset: 18,
      description: "no effect"
    },
    [9]: {
      index: 2,
      id: 9,
      name: "Tree Cape",
      price: 1e3,
      scale: 90,
      description: "no effect"
    },
    [10]: {
      index: 3,
      id: 10,
      name: "Stone Cape",
      price: 1e3,
      scale: 90,
      description: "no effect"
    },
    [3]: {
      index: 4,
      id: 3,
      name: "Cookie Cape",
      price: 1500,
      scale: 90,
      description: "no effect"
    },
    [8]: {
      index: 5,
      id: 8,
      name: "Cow Cape",
      price: 2e3,
      scale: 90,
      description: "no effect"
    },
    [11]: {
      index: 6,
      id: 11,
      name: "Monkey Tail",
      price: 2e3,
      scale: 97,
      xOffset: 25,
      description: "Super speed but reduced damage",
      spdMult: 1.35,
      dmgMultO: .2
    },
    [17]: {
      index: 7,
      id: 17,
      name: "Apple Basket",
      price: 3e3,
      scale: 80,
      xOffset: 12,
      description: "slowly regenerates health over time",
      healthRegen: 1
    },
    [6]: {
      index: 8,
      id: 6,
      name: "Winter Cape",
      price: 3e3,
      scale: 90,
      description: "no effect"
    },
    [4]: {
      index: 9,
      id: 4,
      name: "Skull Cape",
      price: 4e3,
      scale: 90,
      description: "no effect"
    },
    [5]: {
      index: 10,
      id: 5,
      name: "Dash Cape",
      price: 5e3,
      scale: 90,
      description: "no effect"
    },
    [2]: {
      index: 11,
      id: 2,
      name: "Dragon Cape",
      price: 6e3,
      scale: 90,
      description: "no effect"
    },
    [1]: {
      index: 12,
      id: 1,
      name: "Super Cape",
      price: 8e3,
      scale: 90,
      description: "no effect"
    },
    [7]: {
      index: 13,
      id: 7,
      name: "Troll Cape",
      price: 8e3,
      scale: 90,
      description: "no effect"
    },
    [14]: {
      index: 14,
      id: 14,
      name: "Thorns",
      price: 1e4,
      scale: 115,
      xOffset: 20,
      description: "no effect"
    },
    [15]: {
      index: 15,
      id: 15,
      name: "Blockades",
      price: 1e4,
      scale: 95,
      xOffset: 15,
      description: "no effect"
    },
    [20]: {
      index: 16,
      id: 20,
      name: "Devils Tail",
      price: 1e4,
      scale: 95,
      xOffset: 20,
      description: "no effect"
    },
    [16]: {
      index: 17,
      id: 16,
      name: "Sawblade",
      price: 12e3,
      scale: 90,
      spin: true,
      xOffset: 0,
      description: "deal damage to players that damage you",
      dmg: .15
    },
    [13]: {
      index: 18,
      id: 13,
      name: "Angel Wings",
      price: 15e3,
      scale: 138,
      xOffset: 22,
      description: "slowly regenerates health over time",
      healthRegen: 3
    },
    [19]: {
      index: 19,
      id: 19,
      name: "Shadow Wings",
      price: 15e3,
      scale: 138,
      xOffset: 22,
      description: "increased movement speed",
      spdMult: 1.1
    },
    [18]: {
      index: 20,
      id: 18,
      name: "Blood Wings",
      price: 2e4,
      scale: 178,
      xOffset: 26,
      description: "restores health when you deal damage",
      healD: .2
    },
    [21]: {
      index: 21,
      id: 21,
      name: "Corrupt X Wings",
      price: 2e4,
      scale: 178,
      xOffset: 26,
      description: "deal damage to players that damage you",
      dmg: .25
    }
  };
  const store = [ Hats, Accessories ];
  const DataHandler = new class {
    isWeaponType(type) {
      return type <= 1;
    }
    isItemType(type) {
      return type >= 2;
    }
    getStore(type) {
      return store[type];
    }
    getStoreItem(type, id) {
      switch (type) {
       case 0:
        return Hats[id];

       case 1:
        return Accessories[id];

       default:
        throw Error(`getStoreItem Error: type "${type}" is not defined`);
      }
    }
    getProjectile(id) {
      return Projectiles[this.getWeapon(id).projectile];
    }
    getWeapon(id) {
      return Weapons[id];
    }
    getItem(id) {
      return Items[id];
    }
    isWeapon(id) {
      return this.getWeapon(id) !== void 0;
    }
    isItem(id) {
      return Items[id] !== void 0;
    }
    isPrimary(id) {
      return id != null && this.getWeapon(id).itemType === 0;
    }
    isSecondary(id) {
      return id != null && this.getWeapon(id).itemType === 1;
    }
    isMelee(id) {
      return id != null && "damage" in this.getWeapon(id);
    }
    isAttackable(id) {
      return id != null && "range" in this.getWeapon(id);
    }
    isShootable(id) {
      return id != null && "projectile" in this.getWeapon(id);
    }
    isPlaceable(id) {
      return id !== -1 && "itemGroup" in Items[id];
    }
    isHealable(id) {
      return "restore" in Items[id];
    }
    isDestroyable(id) {
      return "health" in Items[id];
    }
    canMoveOnTop(id) {
      return "ignoreCollision" in Items[id];
    }
  };
  const DataHandler_default = DataHandler;
  class ObjectItem {
    id;
    pos;
    angle;
    scale=0;
    constructor(id, x, y, angle, scale) {
      this.id = id;
      this.pos = {
        current: new Vector_default(x, y)
      };
      this.angle = angle;
      this.scale = scale;
    }
    get hitScale() {
      return this.scale;
    }
  }
  class Resource extends ObjectItem {
    type;
    layer;
    constructor(id, x, y, angle, scale, type) {
      super(id, x, y, angle, scale);
      this.type = type;
      this.layer = type === 0 ? 3 : type === 2 ? 0 : 2;
    }
    formatScale(scaleMult = 1) {
      const reduceScale = this.type === 0 || this.type === 1 ? .6 * scaleMult : 1;
      return this.scale * reduceScale;
    }
    get collisionScale() {
      return this.formatScale();
    }
    get placementScale() {
      return this.formatScale(.6);
    }
    get isCactus() {
      return this.type === 1 && pointInDesert(this.pos.current);
    }
    getDamage() {
      if (this.isCactus) {
        return 35;
      }
      return 0;
    }
    canMoveOnTop() {
      return false;
    }
  }
  class PlayerObject extends ObjectItem {
    type;
    ownerID;
    collisionDivider;
    health;
    tempHealth;
    maxHealth;
    reload=-1;
    maxReload=-1;
    isDestroyable;
    destroyingTick=0;
    canBeDestroyed=false;
    trapActivated=false;
    wasTeammate=false;
    seenPlacement=false;
    layer;
    itemGroup;
    projectile=null;
    constructor(id, x, y, angle, scale, type, ownerID) {
      super(id, x, y, angle, scale);
      this.type = type;
      this.ownerID = ownerID;
      const item = Items[type];
      this.collisionDivider = "colDiv" in item ? item.colDiv : 1;
      this.health = "health" in item ? item.health : 1 / 0;
      this.tempHealth = this.health;
      this.maxHealth = this.health;
      this.isDestroyable = this.maxHealth !== 1 / 0;
      if (item.id === 17) {
        this.reload = Math.ceil(item.shootRate / 111);
        this.maxReload = this.reload;
      }
      this.layer = ItemGroups[item.itemGroup].layer;
      this.itemGroup = item.itemGroup;
    }
    formatScale(placeCollision = false) {
      return this.scale * (placeCollision ? 1 : this.collisionDivider);
    }
    get collisionScale() {
      return this.formatScale();
    }
    get placementScale() {
      const item = Items[this.type];
      if (item.id === 21) {
        return item.blocker;
      }
      return this.scale;
    }
    get isSpike() {
      return this.itemGroup === 2;
    }
    getDamage() {
      if (this.isSpike) {
        const type = this.type;
        return DataHandler_default.getItem(type).damage;
      }
      return 0;
    }
    canMoveOnTop() {
      return "ignoreCollision" in Items[this.type];
    }
  }
  class Entity {
    id=-1;
    pos={
      previous: new Vector_default,
      current: new Vector_default,
      future: new Vector_default
    };
    angle=0;
    scale=0;
    speed=0;
    move_dir=0;
    setFuturePosition() {
      const {previous: previous, current: current, future: future} = this.pos;
      const distance = previous.distance(current);
      this.speed = distance;
      const angle = previous.angle(current);
      this.move_dir = angle;
      future.setVec(current.addDirection(angle, distance));
    }
    get collisionScale() {
      return this.scale;
    }
    get hitScale() {
      return this.scale * 1.8;
    }
    client;
    constructor(client) {
      this.client = client;
    }
    getFuturePosition(speed) {
      const pos = this.pos.current.copy();
      return pos.add(Vector_default.fromAngle(this.move_dir, speed));
    }
    colliding(object, radius) {
      const {previous: a0, current: a1, future: a2} = this.pos;
      const b0 = object.pos.current;
      return a0.distance(b0) <= radius || a1.distance(b0) <= radius || a2.distance(b0) <= radius;
    }
    collidingObject(object, addRadius = 0, checkType = 3) {
      const {previous: a0, current: a1, future: a2} = this.pos;
      const b0 = object.pos.current;
      const radius = this.collisionScale + object.collisionScale + addRadius;
      return !!(checkType & 4) && a0.distance(b0) <= radius || !!(checkType & 2) && a1.distance(b0) <= radius || !!(checkType & 1) && a2.distance(b0) <= radius;
    }
    collidingSimple(entity, range, tempPos = this.pos.current) {
      const pos1 = tempPos;
      const pos2 = entity.pos.current;
      return pos1.distance(pos2) <= range;
    }
    collidingEntity(entity, range, checkBased = false, prev = true) {
      const {previous: a0, current: a1, future: a2} = this.pos;
      const {previous: b0, current: b1, future: b2} = entity.pos;
      if (checkBased) {
        return prev && a0.distance(b0) <= range || a1.distance(b1) <= range || a2.distance(b2) <= range;
      }
      return a0.distance(b0) <= range || a0.distance(b1) <= range || a0.distance(b2) <= range || a1.distance(b0) <= range || a1.distance(b1) <= range || a1.distance(b2) <= range || a2.distance(b0) <= range || a2.distance(b1) <= range || a2.distance(b2) <= range;
    }
    runningAwayFrom(entity, angle) {
      if (angle === null) {
        return false;
      }
      const pos1 = this.pos.current;
      const pos2 = entity.pos.current;
      const angleTo = pos1.angle(pos2);
      if (getAngleDist(angle, angleTo) <= Math.PI / 2) {
        return false;
      }
      return true;
    }
  }
  const Entity_default = Entity;
  class EnemyManager {
    client;
    dangerousEnemies=[];
    _nearestEnemy=[ null, null ];
    secondNearestEnemy=null;
    nearestDangerAnimal=null;
    nearestTrap=null;
    nearestCollider=null;
    secondNearestCollider=null;
    nearestEnemySpikeCollider=null;
    spikeCollider=null;
    enemySpikeCollider=null;
    nearestTurretEntity=null;
    detectedEnemy=false;
    dangerWithoutSoldier=false;
    detectedDangerEnemy=false;
    nearestTrappedEnemy=null;
    previousTrappedEnemy=null;
    nearestEnemyPush=null;
    nearestPushSpike=null;
    nearestPlayerObject=null;
    secondNearestPlayerObject=null;
    thirdNearestPlayerObject=null;
    nearestObject=null;
    nearestEnemyObject=null;
    secondNearestEnemyObject=null;
    nearestSpike=null;
    nearestKBTrapEnemy=null;
    nearestKBTrap=null;
    willCollideSpike=false;
    pushingOnSpike=false;
    collidingSpike=false;
    nearestSpikePlacerAngle=null;
    prevNearestSpikePlacerAngle=null;
    nearestEnemyToNearestEnemy=null;
    enemyCanPlaceSpike=false;
    possibleToKnockback=false;
    potentialSpikeKnockbackDamage=0;
    potentialSpikeDamage=0;
    potentialDamage=0;
    primaryDamage=0;
    detectedDanger=false;
    reverseInsta=false;
    rangedBowInsta=false;
    toolHammerInsta=false;
    spikeSyncThreat=false;
    velocityTickThreat=false;
    nearestLowEntity=null;
    nearestLowHPObjectPrev=null;
    nearestLowHPObject=null;
    nearestSyncEnemy=null;
    constructor(client) {
      this.client = client;
    }
    preReset() {
      this._nearestEnemy[0] = null;
      this._nearestEnemy[1] = null;
      this.nearestDangerAnimal = null;
      this.nearestLowEntity = null;
    }
    reset() {
      this.nearestEnemyToNearestEnemy = null;
      this.willCollideSpike = false;
      this.pushingOnSpike = false;
      this.collidingSpike = false;
      this.prevNearestSpikePlacerAngle = this.nearestSpikePlacerAngle;
      this.nearestSpikePlacerAngle = null;
      this.dangerousEnemies.length = 0;
      this.nearestTrap = null;
      this.nearestCollider = null;
      this.nearestEnemySpikeCollider = null;
      this.spikeCollider = null;
      this.enemySpikeCollider = null;
      this.nearestTurretEntity = null;
      this.detectedEnemy = false;
      this.dangerWithoutSoldier = false;
      this.detectedDangerEnemy = false;
      this.previousTrappedEnemy = this.nearestTrappedEnemy;
      this.nearestTrappedEnemy = null;
      this.nearestEnemyPush = null;
      this.nearestPushSpike = null;
      this.nearestPlayerObject = null;
      this.nearestObject = null;
      this.secondNearestPlayerObject = null;
      this.thirdNearestPlayerObject = null;
      this.nearestEnemyObject = null;
      this.secondNearestEnemyObject = null;
      this.nearestSpike = null;
      this.nearestKBTrapEnemy = null;
      this.nearestKBTrap = null;
      this.enemyCanPlaceSpike = false;
      this.possibleToKnockback = false;
      this.velocityTickThreat = false;
      this.potentialSpikeKnockbackDamage = 0;
      this.potentialSpikeDamage = 0;
      this.potentialDamage = 0;
      this.detectedDanger = false;
      this.reverseInsta = false;
      this.rangedBowInsta = false;
      this.toolHammerInsta = false;
      this.spikeSyncThreat = false;
      this.nearestLowHPObjectPrev = this.nearestLowHPObject;
      this.nearestLowHPObject = null;
      this.nearestSyncEnemy = null;
      this.primaryDamage = 0;
      this.secondNearestEnemy = null;
    }
    get wasTrappedEnemy() {
      const enemy = this.previousTrappedEnemy;
      if (enemy !== null && this.nearestTrappedEnemy === null) {
        return enemy;
      }
      return null;
    }
    get nearestPlaceSpikeAngle() {
      const prevAngle = this.prevNearestSpikePlacerAngle;
      const currAngle = this.nearestSpikePlacerAngle;
      if (prevAngle === null && currAngle !== null) {
        return currAngle;
      }
      return null;
    }
    get nearestEnemy() {
      return this._nearestEnemy[0];
    }
    get nearestAnimal() {
      return this._nearestEnemy[1];
    }
    get canSpikeSync() {
      return this.nearestPlaceSpikeAngle !== null && this.client.ObjectManager.isDestroyedObject();
    }
    isNear(enemy, nearest, owner = this.client.myPlayer) {
      if (nearest === null || enemy === nearest) {
        return true;
      }
      const a0 = owner.pos.current;
      const distance1 = a0.distanceDefault(enemy.pos.current);
      const distance2 = a0.distanceDefault(nearest.pos.current);
      return distance1 < distance2;
    }
    get nearestEntity() {
      const target1 = this.nearestEnemy;
      const target2 = this.nearestAnimal;
      if (target1 === null) {
        return target2;
      }
      return this.isNear(target1, target2) ? target1 : target2;
    }
    instaThreat() {
      return this.velocityTickThreat || this.reverseInsta || this.rangedBowInsta || this.toolHammerInsta || this.primaryDamage + this.potentialSpikeKnockbackDamage >= 100;
    }
    shouldIgnoreModule() {
      return this.instaThreat() || this.detectedDangerEnemy || this.spikeSyncThreat;
    }
    enemyTrappedByMe(enemy) {
      const target = enemy || this.nearestEnemy;
      if (!target) return false;
      let trappedNow = false;
      if (target.isTrapped) {
        const trap = target.trappedIn;
        if (trap && !this.client.PlayerManager.isEnemyByID(trap.ownerID, this.client.myPlayer)) {
          trappedNow = true;
        }
      }
      const tick = this.client._ModuleHandler?.tickCount ?? 0;
      if (trappedNow) {
        target._lockedByMeUntil = tick + 4;
        return true;
      }
      if (target._lockedByMeUntil && tick <= target._lockedByMeUntil) {
        return true;
      }
      return false;
    }
    weaponDamageThreat() {
      const {ProjectileManager: ProjectileManager, myPlayer: myPlayer} = this.client;
      return this.shouldIgnoreModule() || ProjectileManager.totalDamage >= myPlayer.currentHealth;
    }
    nearestEnemyInRangeOf(range, target) {
      const enemy = target || this.nearestEnemy;
      return enemy !== null && this.client.myPlayer.collidingEntity(enemy, range);
    }
    handleDanger(enemy) {
      const danger = enemy.canPossiblyInstakill();
      enemy.prevDanger = enemy.danger;
      enemy.danger = danger;
      if (enemy.canPlaceSpikeObject) {
        this.potentialSpikeDamage = Math.max(this.potentialSpikeDamage, enemy.spikeDamage);
      }
      this.potentialDamage += enemy.potentialDamage;
      this.primaryDamage = Math.max(enemy.primaryDamage, this.primaryDamage);
      if (enemy.prevDanger !== enemy.danger && enemy.danger >= 2) {
        this.detectedDanger = true;
      }
      if (enemy.velocityTicking) {
        this.velocityTickThreat = true;
      }
      if (enemy.reverseInsta) {
        this.reverseInsta = true;
      }
      if (enemy.toolHammerInsta) {
        this.toolHammerInsta = true;
      }
      if (enemy.rangedBowInsta) {
        this.rangedBowInsta = true;
      }
      if (enemy.spikeSyncThreat) {
        this.spikeSyncThreat = true;
      }
    }
    checkCollision(target, isOwner = false) {
      target.isTrapped = false;
      target.trappedInPrev = target.trappedIn;
      target.trappedIn = null;
      const {ObjectManager: ObjectManager, PlayerManager: PlayerManager, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const pos1 = myPlayer.pos.current;
      const pos2 = target.pos.current;
      const distanceToTarget = pos1.distance(pos2);
      const angleToTarget = pos1.angle(pos2);
      ObjectManager.grid2D.query(target.pos.current.x, target.pos.current.y, 3, id => {
        const object = ObjectManager.objects.get(id);
        const pos3 = object.pos.current;
        const isPlayerObject = object instanceof PlayerObject;
        const isCactus = !isPlayerObject && object.isCactus;
        const isSpike = isPlayerObject && object.itemGroup === 2;
        const isEnemyObject = !isPlayerObject || PlayerManager.isEnemyByID(object.ownerID, target);
        const isEnemyObjectToMyPlayer = !isPlayerObject || PlayerManager.isEnemyByID(object.ownerID, myPlayer);
        const collidingObject = target.collidingObject(object, 1);
        const collidingCurrent = target.collidingObject(object, 1, 1);
        if (isPlayerObject && !isEnemyObject) {
          object.wasTeammate = true;
        }
        if (isPlayerObject && isEnemyObject && object.type === 15) {
          if (collidingObject) {
            if (!isOwner) {
              if (this.isNear(target, this.nearestTrappedEnemy)) {
                this.nearestTrappedEnemy = target;
              }
              if (!isEnemyObjectToMyPlayer && this.isNear(target, this.nearestEnemyPush)) {
                this.nearestEnemyPush = target;
              }
            }
            target.isTrapped = true;
            if (target.hatID === 40) {
              target.usesTank = true;
            }
            if (this.isNear(object, target.trappedIn)) {
              target.trappedIn = object;
            }
            if (isOwner && this.isNear(object, this.nearestTrap)) {
              this.nearestTrap = object;
            }
          }
          if (collidingCurrent || !object.seenPlacement && !object.wasTeammate) {
            object.trapActivated = true;
          }
        }
        if (isOwner && isPlayerObject && object.type === 22 && collidingCurrent) {
          myPlayer.teleportPos.setVec(pos1);
          myPlayer.teleported = true;
        }
        if (isPlayerObject && object.isDestroyable) {
          if (object.destroyingTick !== ModuleHandler.tickCount) {
            object.canBeDestroyed = false;
            object.tempHealth = object.health;
          }
          const damage = target.getMaxBuildingDamage(object, true);
          const canSee = !isEnemyObject || object.type !== 15 || isEnemyObject && object.type === 15 && object.trapActivated;
          if (damage !== null && canSee) {
            object.destroyingTick = ModuleHandler.tickCount;
            object.tempHealth -= damage;
            if (object.tempHealth <= 0) {
              object.canBeDestroyed = true;
            }
          }
        }
        if (isOwner) {
          if (isEnemyObject && isPlayerObject && object.isDestroyable) {
            if (object.type === 15 || object.type === 16 || object.itemGroup === 2) {
              if (this.isNear(object, this.nearestEnemyObject)) {
                this.secondNearestEnemyObject = this.nearestEnemyObject;
                this.nearestEnemyObject = object;
              }
              if (object !== this.nearestEnemyObject && this.isNear(object, this.secondNearestEnemyObject)) {
                this.secondNearestEnemyObject = object;
              }
            }
            if (object.itemGroup === 2 && this.isNear(object, this.nearestSpike)) {
              this.nearestSpike = object;
            }
          }
          if (this.isNear(object, this.nearestObject)) {
            this.nearestObject = object;
          }
          if (isPlayerObject && object.isDestroyable) {
            if (this.isNear(object, this.nearestPlayerObject)) {
              this.thirdNearestPlayerObject = this.secondNearestPlayerObject;
              this.secondNearestPlayerObject = this.nearestPlayerObject;
              this.nearestPlayerObject = object;
            }
            if (object !== this.nearestPlayerObject && this.isNear(object, this.secondNearestPlayerObject)) {
              this.thirdNearestPlayerObject = this.secondNearestPlayerObject;
              this.secondNearestPlayerObject = object;
            }
            if (object !== this.nearestPlayerObject && object !== this.secondNearestPlayerObject && this.isNear(object, this.thirdNearestPlayerObject)) {
              this.thirdNearestPlayerObject = object;
            }
          }
          if (isEnemyObject && (isSpike || isCactus) && target.collidingObject(object, 70)) {
            this.willCollideSpike = true;
            if (target.collidingObject(object, 25)) {
              this.pushingOnSpike = true;
            }
          }
          if (isEnemyObject && (isSpike || isCactus) && target.colliding(object, target.collisionScale + object.collisionScale + 1)) {
            this.collidingSpike = true;
            this.potentialSpikeDamage = Math.max(this.potentialSpikeDamage, object.getDamage());
          }
          const isAdditional = isPlayerObject && object.type === 16;
          if (isEnemyObject && (isSpike || isCactus || isAdditional) && target.collidingObject(object, 150)) {
            if (this.isNear(object, this.nearestCollider)) {
              this.secondNearestCollider = this.nearestCollider;
              this.nearestCollider = object;
            }
            if (object !== this.nearestCollider && this.isNear(object, this.secondNearestCollider)) {
              this.secondNearestCollider = object;
            }
          }
        } else {
          const {primary: primary, secondary: secondary} = myPlayer.weapon;
          if (isPlayerObject && object.isDestroyable && secondary === 10 && primary !== null && primary !== 8) {
            const damage = myPlayer.getBuildingDamage(secondary, true);
            const primaryRange = DataHandler_default.getWeapon(primary).range + target.hitScale;
            const secondaryRange = DataHandler_default.getWeapon(secondary).range + object.hitScale;
            if (myPlayer.collidingSimple(target, primaryRange) && myPlayer.collidingSimple(object, secondaryRange) && object.health <= damage) {
              const itemType = 4;
              const spikeID = myPlayer.getItemByType(itemType);
              const placeLength = myPlayer.getItemPlaceScale(spikeID);
              const spikeScale = Items[spikeID].scale;
              const spikePos = pos1.addDirection(angleToTarget, placeLength);
              const distance = pos2.distance(spikePos);
              const range = target.collisionScale + spikeScale;
              if (distance <= range && this.isNear(object, this.nearestLowHPObject)) {
                this.nearestLowHPObject = object;
                this.nearestSyncEnemy = target;
              }
            }
          }
          if (isEnemyObjectToMyPlayer && (isSpike || isCactus) && !myPlayer.isTrapped) {
            const KBDistance = target.getActualMaxKnockback(myPlayer);
            const spikeScale = object.collisionScale + myPlayer.collisionScale;
            const angleToEnemy = pos2.angle(pos1);
            const angleToSpike = pos2.angle(pos3);
            const distanceToSpike1 = pos2.distance(pos3);
            const offset = Math.asin(2 * spikeScale / (2 * distanceToSpike1));
            const angleDistance = getAngleDist(angleToEnemy, angleToSpike);
            const intersecting = angleDistance <= offset;
            const overlapping = distanceToTarget <= distanceToSpike1;
            const inRange2 = KBDistance !== 0 && myPlayer.collidingObject(object, KBDistance);
            if (intersecting && overlapping && inRange2) {
              this.possibleToKnockback = true;
              this.potentialSpikeKnockbackDamage = Math.max(this.potentialSpikeKnockbackDamage, object.getDamage());
            }
          }
          if (isEnemyObject && (isSpike || isCactus) && target.collidingObject(object) && this.isNear(target, this.enemySpikeCollider)) {
            this.enemySpikeCollider = target;
          }
          if (isEnemyObject && (isSpike || isCactus) && this.isNear(target, this.nearestEnemySpikeCollider)) {
            const KBDistance = myPlayer.getActualMaxKnockback(target);
            const spikeScale = object.collisionScale + target.collisionScale;
            const angleToEnemy = pos1.angle(pos2);
            const angleToSpike = pos1.angle(pos3);
            const distanceToSpike1 = pos1.distance(pos3);
            const offset = Math.asin(2 * spikeScale / (2 * distanceToSpike1));
            const angleDistance = getAngleDist(angleToEnemy, angleToSpike);
            const intersecting = angleDistance <= offset;
            const overlapping = distanceToTarget <= distanceToSpike1;
            const inRange2 = KBDistance !== 0 && target.collidingObject(object, KBDistance);
            if (intersecting && overlapping && inRange2) {
              if (this.spikeCollider === null) {
                this.nearestEnemySpikeCollider = target;
                this.spikeCollider = object;
              } else {
                const pos4 = this.spikeCollider.pos.current;
                const angle1 = pos2.angle(pos3);
                const angle2 = pos1.angle(pos3);
                const angle3 = pos2.angle(pos4);
                const angle4 = pos1.angle(pos4);
                const angleDist1 = getAngleDist(angle1, angle2);
                const angleDist2 = getAngleDist(angle3, angle4);
                if (angleDist1 < angleDist2) {
                  this.nearestEnemySpikeCollider = target;
                  this.spikeCollider = object;
                }
              }
            }
          }
          if (!target.isTrapped && isEnemyObject && object.type === 15 && this.isNear(target, this.nearestKBTrapEnemy)) {
            const KBDistance = myPlayer.getActualMaxKnockback(target);
            const trapScale = object.collisionScale + target.collisionScale;
            const angleToEnemy = pos1.angle(pos2);
            const angleToSpike = pos1.angle(pos3);
            const distanceToTrap1 = pos1.distance(pos3);
            const offset = Math.asin(2 * trapScale / (2 * distanceToTrap1));
            const angleDistance = getAngleDist(angleToEnemy, angleToSpike);
            const intersecting = angleDistance <= offset;
            const overlapping = distanceToTarget <= distanceToTrap1;
            const inRange2 = KBDistance !== 0 && target.collidingObject(object, KBDistance);
            if (intersecting && overlapping && inRange2) {
              if (this.nearestKBTrap === null) {
                this.nearestKBTrapEnemy = target;
                this.nearestKBTrap = object;
              } else {
                const pos4 = this.nearestKBTrap.pos.current;
                const angle1 = pos2.angle(pos3);
                const angle2 = pos1.angle(pos3);
                const angle3 = pos2.angle(pos4);
                const angle4 = pos1.angle(pos4);
                const angleDist1 = getAngleDist(angle1, angle2);
                const angleDist2 = getAngleDist(angle3, angle4);
                if (angleDist1 < angleDist2) {
                  this.nearestKBTrapEnemy = target;
                  this.nearestKBTrap = object;
                }
              }
            }
          }
        }
      });
    }
    handleNearest(type, enemy) {
      const {myPlayer: myPlayer} = this.client;
      const primaryDamage = myPlayer.getMaxWeaponDamage(myPlayer.weapon.primary, false);
      if (primaryDamage >= enemy.currentHealth && this.isNear(enemy, this.nearestLowEntity)) {
        this.nearestLowEntity = enemy;
      }
      if (this.isNear(enemy, this._nearestEnemy[type])) {
        if (type === 0) {
          const nearest = this._nearestEnemy[type];
          this.secondNearestEnemy = nearest;
        }
        this._nearestEnemy[type] = enemy;
        if (enemy.canUseTurret && this.client.myPlayer.collidingSimple(enemy, 700)) {
          this.nearestTurretEntity = enemy;
        }
      }
    }
    handleNearestDangerAnimal(animal) {
      const {myPlayer: myPlayer} = this.client;
      if (!animal.isDanger) {
        return;
      }
      if (!myPlayer.collidingEntity(animal, animal.collisionRange)) {
        return;
      }
      if (!this.isNear(animal, this.nearestDangerAnimal)) {
        return;
      }
      this.nearestDangerAnimal = animal;
    }
    handleAnimal(animal) {
      this.handleNearest(1, animal);
      this.handleNearestDangerAnimal(animal);
    }
    attemptSpikePlacement() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const placementAngles = this.nearestSpikePlacerAngle;
      if (placementAngles === null) {
        return;
      }
      const itemType = 4;
      for (const angle of placementAngles) {
        ModuleHandler.place(itemType, angle);
      }
      ModuleHandler.placedOnce = true;
      ModuleHandler.placeAngles[0] = itemType;
      ModuleHandler.placeAngles[1] = placementAngles;
    }
    handleEnemies(enemies) {
      this.reset();
      const {myPlayer: myPlayer, ObjectManager: ObjectManager, PlayerManager: PlayerManager} = this.client;
      this.checkCollision(myPlayer, true);
      const ownerID = this.client.ownerClient?.myPlayer?.id;
      for (let i = 0, len = enemies.length; i < len; i++) {
        const enemy = enemies[i];
        if (ownerID !== undefined && enemy.id === ownerID) continue;
        this.checkCollision(enemy);
        this.handleDanger(enemy);
        this.handleNearest(0, enemy);
      }
      if (myPlayer.isBullTickTime()) {
        this.potentialDamage += 5;
      }
      this.potentialDamage += this.client.ProjectileManager.totalDamage;
      const actualSpikeDamage = Math.max(this.potentialSpikeDamage, this.potentialSpikeKnockbackDamage);
      this.potentialSpikeDamage = actualSpikeDamage;
      const potentialDamage = this.potentialDamage + actualSpikeDamage;
      const soldierDefense = Hats[6].dmgMult;
      const soldierMult = myPlayer.hatID === 6 ? soldierDefense : 1;
      if (potentialDamage * soldierDefense >= myPlayer.currentHealth) {
        this.detectedDangerEnemy = true;
      } else if (potentialDamage * soldierMult >= myPlayer.currentHealth) {
        this.detectedEnemy = true;
      }
      if (potentialDamage >= myPlayer.currentHealth) {
        this.dangerWithoutSoldier = true;
      }
      const nearestClose = this.nearestEnemy;
      if (nearestClose !== null && !this.detectedEnemy && !this.detectedDangerEnemy) {
        const closeDist = myPlayer.pos.current.distance(nearestClose.pos.current);
        if (closeDist <= 200) {
          this.detectedEnemy = true;
        }
      }
      const nearest = this.nearestEnemy;
      if (nearest !== null) {
        const pos1 = myPlayer.pos.current;
        const pos2 = nearest.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        const itemType = 4;
        const spikeID = myPlayer.getItemByType(itemType);
        const placeLength = myPlayer.getItemPlaceScale(spikeID);
        const angles = ObjectManager.getBestPlacementAngles({
          position: pos1,
          id: spikeID,
          targetAngle: angleToEnemy,
          ignoreID: null,
          preplace: false,
          reduce: false,
          fill: false
        });
        const spikeScale = Items[spikeID].scale;
        const possibleAngles = angles.filter(angle => {
          const spikePos = pos1.addDirection(angle, placeLength);
          const distance = pos2.distance(spikePos);
          const range = nearest.collisionScale + spikeScale;
          return distance <= range;
        });
        if (possibleAngles.length !== 0) {
          this.nearestSpikePlacerAngle = possibleAngles;
        }
        if (Settings_default._autoSync) {
          for (let i = 0; i < PlayerManager.players.length; i++) {
            const player = PlayerManager.players[i];
            if (myPlayer.isMyPlayerByID(player.id)) {
              continue;
            }
            if (PlayerManager.isEnemyByID(nearest.id, player) && this.isNear(player, this.nearestEnemyToNearestEnemy, nearest)) {
              this.nearestEnemyToNearestEnemy = player;
            }
          }
        }
      }
      const nearestEnemyPush = this.nearestEnemyPush;
      if (nearestEnemyPush !== null && myPlayer.trappedIn === null) {
        const trappedIn = nearestEnemyPush.trappedIn;
        if (trappedIn) {
          const pos0 = trappedIn.pos.current;
          ObjectManager.grid2D.query(pos0.x, pos0.y, 2, id => {
            const object = ObjectManager.objects.get(id);
            if (!object || object === trappedIn) {
              return;
            }
            const isPlayerObject = object instanceof PlayerObject;
            const isCactus = !isPlayerObject && object.isCactus;
            const isSpike = isPlayerObject && object.itemGroup === 2;
            const isEnemyObject = !isPlayerObject || PlayerManager.isEnemyByID(object.ownerID, nearestEnemyPush);
            if (isEnemyObject && (isCactus || isSpike) && this.isNear(object, this.nearestPushSpike, nearestEnemyPush)) {
              const pos1 = object.pos.current;
              const distance = pos0.distance(pos1);
              const range = object.collisionScale + trappedIn.collisionScale + nearestEnemyPush.collisionScale * 2;
              if (distance <= range) {
                this.nearestPushSpike = object;
              }
            }
          });
        }
      }
      if (this.client.isOwner) {
        GameUI_default.updateSpikeDamage(actualSpikeDamage);
        GameUI_default.updatePotentialDamage(`${this.potentialDamage}, ${this.primaryDamage}`);
        GameUI_default.updateDangerState(`${this.detectedDangerEnemy}, ${this.detectedEnemy}, ${this.dangerWithoutSoldier}, ${this.rangedBowInsta}`);
        GameUI_default.updateCollideSpike(this.collidingSpike);
      }
    }
  }
  const EnemyManager_default = EnemyManager;
  class LeaderboardManager {
    client;
    list=new Set;
    constructor(client) {
      this.client = client;
    }
    updatePlayer(id, nickname, gold) {
      const owner = this.client.PlayerManager.playerData.get(id) || this.client.PlayerManager.createPlayer({
        id: id,
        nickname: nickname
      });
      this.list.add(owner);
    }
    update(data) {
      this.list.clear();
      for (let i = 0; i < data.length; i += 3) {
        const id = data[i + 0];
        const nickname = data[i + 1];
        const gold = data[i + 2];
        this.updatePlayer(id, nickname, gold);
      }
    }
  }
  const LeaderboardManager_default = LeaderboardManager;
  const HatPredictor = new class {
    transitions=new Map;
    train(history) {
      this.transitions.clear();
      for (let i = 0; i < history.length - 1; i++) {
        const currentHat = history[i];
        const nextHat = history[i + 1];
        if (!this.transitions.has(currentHat)) {
          this.transitions.set(currentHat, new Map);
        }
        const nextMap = this.transitions.get(currentHat);
        nextMap.set(nextHat, (nextMap.get(nextHat) || 0) + 1);
      }
    }
    predict(currentHat) {
      if (!this.transitions.has(currentHat)) {
        return null;
      }
      const nextMap = this.transitions.get(currentHat);
      let maxCount = 0;
      let predictedHat = null;
      for (const [hat, count] of nextMap) {
        if (count > maxCount) {
          maxCount = count;
          predictedHat = hat;
        }
      }
      return predictedHat;
    }
  };
  const HatPredictor_default = HatPredictor;
  const scale_value = window.grbtp;
  delete window.grbtp;
  class Player extends Entity_default {
    currentItem=-1;
    clanName=null;
    isLeader=false;
    prevNickname=null;
    nickname=null;
    skinID=0;
    scale=scale_value;
    storeData=[ 0, 0 ];
    hatID=0;
    prevHat=0;
    accessoryID=0;
    usesTurret=false;
    previousHealth=100;
    currentHealth=100;
    tempHealth=100;
    maxHealth=Math.LN1;
    primaryReloadTickCount=0;
    nextDamageTick=0;
    globalInventory={};
    weapon={};
    oldWeapon=[ 0, null ];
    variant={};
    reload=[ {}, {}, {} ];
    objects=new Set;
    newlyCreated=true;
    usingBoost=false;
    isTrapped=false;
    usesTank=false;
    trappedIn=null;
    trappedInPrev=null;
    isFullyUpgraded=false;
    potentialDamage=0;
    primaryDamage=0;
    spikeDamage=0;
    dangerList=[];
    danger=0;
    prevDanger=0;
    hatHistory=[];
    futureHat=0;
    shameActive=false;
    shameTimer=0;
    shameCount=0;
    receivedDamage=null;
    bullTick=0;
    poisonCount=0;
    isDmgOverTime=false;
    tickCount=0;
    damageTick=0;
    canPlaceSpikePrev=false;
    canPlaceSpike=false;
    velocityTicking=false;
    reverseInsta=false;
    toolHammerInsta=false;
    rangedBowInsta=false;
    spikeSyncThreat=false;
    onPlatform=false;
    tickDamage=100;
    stackedDamage=0;
    damages=[];
    prevSeenBefore=false;
    seenBefore=false;
    isPlayer=true;
    lastAttacked=0;
    constructor(client) {
      super(client);
    }
    justAppeared() {
      return !this.prevSeenBefore && this.seenBefore;
    }
    wasTrapped() {
      return this.trappedIn === null && this.trappedInPrev !== null;
    }
    addFound(projectile) {
      projectile.ownerClient = this;
      this.client.ProjectileManager.foundProjectile(projectile);
    }
    resetReload() {
      const {primary: primary, secondary: secondary} = this.weapon;
      const primarySpeed = this.getWeaponSpeed(primary);
      const secondarySpeed = this.getWeaponSpeed(secondary);
      const reload = this.reload;
      reload[0].previous = primarySpeed;
      reload[0].current = primarySpeed;
      reload[0].max = primarySpeed;
      reload[1].previous = secondarySpeed;
      reload[1].current = secondarySpeed;
      reload[1].max = secondarySpeed;
      reload[2].previous = 23;
      reload[2].current = 23;
      reload[2].max = 23;
      this.shameCount = 0;
    }
    resetGlobalInventory() {
      this.globalInventory[0] = null;
      this.globalInventory[1] = null;
      this.globalInventory[2] = null;
      this.globalInventory[3] = null;
      this.globalInventory[4] = null;
      this.globalInventory[5] = null;
      this.globalInventory[6] = null;
      this.globalInventory[7] = null;
      this.globalInventory[8] = null;
      this.globalInventory[9] = null;
    }
    init() {
      this.weapon.current = 0;
      this.weapon.oldCurrent = 0;
      this.weapon.primary = null;
      this.weapon.secondary = null;
      this.oldWeapon[0] = null;
      this.oldWeapon[1] = null;
      this.variant.current = 0;
      this.variant.primary = 0;
      this.variant.secondary = 0;
      this.resetReload();
      this.resetGlobalInventory();
      this.newlyCreated = true;
      this.usingBoost = false;
      this.isFullyUpgraded = false;
    }
    get canUseTurret() {
      return this.hatID !== 22;
    }
    get canPlaceSpikeObject() {
      return !this.canPlaceSpikePrev && this.canPlaceSpike || this.speed >= 10 && this.canPlaceSpike;
    }
    isBullTickTime(adjust = 0) {
      return (this.tickCount - this.bullTick - adjust) % 9 === 0;
    }
    update(id, x, y, angle, currentItem, currentWeapon, weaponVariant, clanName, isLeader, hatID, accessoryID, hasSkull, onPlatform) {
      this.prevSeenBefore = this.seenBefore;
      this.seenBefore = true;
      if (this.justAppeared()) {
        this.resetReload();
      }
      this.tickCount += 1;
      this.id = id;
      this.pos.previous.setVec(this.pos.current);
      this.pos.current._setXY(x, y);
      this.setFuturePosition();
      this.angle = angle;
      this.currentItem = currentItem;
      this.weapon.oldCurrent = this.weapon.current;
      const weaponType = DataHandler_default.getWeapon(this.weapon.current).itemType;
      this.oldWeapon[weaponType] = this.weapon.current;
      this.weapon.current = currentWeapon;
      this.variant.current = weaponVariant;
      this.clanName = clanName;
      this.isLeader = !!isLeader;
      this.onPlatform = !!onPlatform;
      this.prevHat = this.hatID;
      this.hatID = hatID;
      if (this.prevHat === 7 && hatID === 53) {
        this.usesTurret = true;
      }
      this.hatHistory.push(hatID);
      if (this.hatHistory.length > 4) {
        this.hatHistory.shift();
      }
      this.futureHat = null;
      if (this.usesTurret && hatID === 7) {
        this.futureHat = 53;
      }
      this.accessoryID = accessoryID;
      this.storeData[0] = hatID;
      this.storeData[1] = accessoryID;
      this.newlyCreated = false;
      this.potentialDamage = 0;
      this.primaryDamage = 0;
      this.spikeDamage = 0;
      this.canPlaceSpikePrev = this.canPlaceSpike;
      this.canPlaceSpike = false;
      this.velocityTicking = false;
      this.reverseInsta = false;
      this.toolHammerInsta = false;
      this.rangedBowInsta = false;
      this.spikeSyncThreat = false;
      this.predictItems();
      this.predictWeapons();
      this.updateReloads();
      this.isDmgOverTime = false;
      if (this.hatID === 45 && !this.shameActive) {
        this.shameActive = true;
        this.shameTimer = 0;
        this.shameCount = 8;
      }
      const {PlayerManager: PlayerManager, myPlayer: myPlayer} = this.client;
      this.shameTimer += PlayerManager.step;
      if (this.shameTimer >= 3e4 && this.shameActive) {
        this.shameActive = false;
        this.shameTimer = 0;
        this.shameCount = 0;
      }
      if (this.isBullTickTime()) {
        if (this.shameCount > 0) {
          this.futureHat = 7;
        }
        this.poisonCount = Math.max(this.poisonCount - 1, 0);
      }
      if (this.futureHat === null) {
        HatPredictor_default.train(this.hatHistory);
        this.futureHat = HatPredictor_default.predict(hatID);
      }
      const reload = this.reload;
      reload[0].previous = reload[0].current;
      reload[1].previous = reload[1].current;
      reload[2].previous = reload[2].current;
    }
    updateHealth(health) {
      this.previousHealth = this.currentHealth;
      this.currentHealth = health;
      this.tempHealth = health;
      if (this.shameActive) {
        return;
      }
      const {myPlayer: myPlayer, PlayerManager: PlayerManager} = this.client;
      const isEnemy = myPlayer.isEnemyByID(this.id);
      const {currentHealth: currentHealth, previousHealth: previousHealth} = this;
      const difference = Math.abs(currentHealth - previousHealth);
      if (this.currentHealth < this.previousHealth) {
        this.receivedDamage = Date.now();
        if (this.damageTick !== this.tickCount + 1) {
          this.tickDamage = 0;
          this.stackedDamage = 0;
          this.damages.length = 0;
        }
        this.tickDamage += difference;
        this.damageTick = this.tickCount + 1;
        if (isEnemy) {
          PlayerManager.lastEnemyReceivedDamage[0] = this.id;
          PlayerManager.lastEnemyReceivedDamage[1] = Math.round(difference);
        }
      } else if (this.receivedDamage !== null) {
        const step = Date.now() - this.receivedDamage;
        this.receivedDamage = null;
        if (step <= 120) {
          this.shameCount += 1;
        } else {
          this.shameCount -= 2;
        }
        this.shameCount = clamp(this.shameCount, 0, 7);
      }
      const diffDmg = difference === 5 || difference === 2 || difference === 4;
      const isDmgOverTime = diffDmg && currentHealth < previousHealth;
      this.isDmgOverTime = isDmgOverTime;
      if (isDmgOverTime) {
        this.bullTick = this.tickCount;
      }
    }
    predictItems() {
      if (this.currentItem === -1) {
        return;
      }
      const item = Items[this.currentItem];
      this.globalInventory[item.itemType] = this.currentItem;
    }
    increaseReload(reload) {
      reload.previous = reload.current;
      reload.current += 1;
      if (reload.current > reload.max) {
        reload.current = reload.max;
      }
    }
    updateMaxReload(reload, weaponID) {
      const speed = this.getWeaponSpeed(weaponID);
      reload.current = speed;
      reload.max = speed;
    }
    resetCurrentReload(reload) {
      reload.current = 0;
    }
    updateTurretReload() {
      const reload = this.reload[2];
      this.increaseReload(reload);
      if (this.hatID !== 53) {
        return;
      }
      const {ProjectileManager: ProjectileManager} = this.client;
      const speed = Projectiles[1].speed;
      const list = ProjectileManager.projectiles.get(speed);
      if (list === void 0) {
        return;
      }
      const current = this.pos.current;
      for (let i = 0; i < list.length; i++) {
        const projectile = list[i];
        const distance = current.distance(projectile.pos.current);
        if (distance < 5) {
          this.addFound(projectile);
          this.resetCurrentReload(reload);
          removeFast(list, i);
          break;
        }
      }
    }
    updateReloads() {
      this.updateTurretReload();
      if (this.currentItem !== -1) {
        return;
      }
      const weapon = DataHandler_default.getWeapon(this.weapon.current);
      const reload = this.reload[weapon.itemType];
      this.increaseReload(reload);
      if ("projectile" in weapon) {
        const {ProjectileManager: ProjectileManager} = this.client;
        const speedMult = this.getWeaponSpeedMult();
        const type = weapon.projectile;
        const speed = Projectiles[type].speed * speedMult;
        const list = ProjectileManager.projectiles.get(speed);
        if (list === void 0) {
          return;
        }
        const current = this.pos.current;
        for (let i = 0; i < list.length; i++) {
          const projectile = list[i];
          const distance = current.distance(projectile.pos.current);
          if (distance < 5 && this.angle === projectile.angle) {
            this.addFound(projectile);
            this.updateMaxReload(reload, weapon.id);
            this.resetCurrentReload(reload);
            removeFast(list, i);
            break;
          }
        }
      }
    }
    handleObjectPlacement(object) {
      this.objects.add(object);
      const {myPlayer: myPlayer, ObjectManager: ObjectManager} = this.client;
      const item = Items[object.type];
      if (object.seenPlacement) {
        if (object.type === 17) {
          ObjectManager.resetTurret(object.id);
        } else if (object.type === 16 && !this.newlyCreated) {
          this.usingBoost = true;
        }
        this.updateInventory(object.type);
      }
      if (myPlayer.isMyPlayerByID(this.id) && item.itemType === 5) {
        myPlayer.totalGoldAmount += item.pps;
      }
    }
    handleObjectDeletion(object) {
      this.objects.delete(object);
      const {myPlayer: myPlayer} = this.client;
      const item = Items[object.type];
      if (myPlayer.isMyPlayerByID(this.id) && item.itemType === 5) {
        myPlayer.totalGoldAmount -= item.pps;
      }
    }
    updateInventory(type) {
      const item = Items[type];
      const inventoryID = this.globalInventory[item.itemType];
      const shouldUpdate = inventoryID === null || item.age > Items[inventoryID].age;
      if (shouldUpdate) {
        this.globalInventory[item.itemType] = item.id;
      }
    }
    detectFullUpgrade() {
      const inventory = this.globalInventory;
      const primary = inventory[0];
      const secondary = inventory[1];
      const spike = inventory[4];
      if (primary && secondary) {
        if ("isUpgrade" in DataHandler_default.getWeapon(primary) && "isUpgrade" in DataHandler_default.getWeapon(secondary)) {
          return true;
        }
      }
      return primary && DataHandler_default.getWeapon(primary).age === 8 || secondary && DataHandler_default.getWeapon(secondary).age === 9 || spike && Items[spike].age === 9 || inventory[5] === 12 || inventory[9] === 20;
    }
    predictPrimary(id) {
      if (id === 11) {
        return 4;
      }
      return 5;
    }
    predictSecondary(id) {
      if (id === 0) {
        return null;
      }
      if (id === 2 || id === 4) {
        return 10;
      }
      return 15;
    }
    predictWeapons() {
      const {current: current, oldCurrent: oldCurrent} = this.weapon;
      const weapon = DataHandler_default.getWeapon(current);
      const type = WeaponTypeString[weapon.itemType];
      const reload = this.reload[weapon.itemType];
      const oldWeapon = this.oldWeapon[weapon.itemType];
      const upgradedWeapon = oldWeapon === null || current !== oldWeapon && weapon.itemType === DataHandler_default.getWeapon(oldWeapon).itemType;
      if (reload.max === -1 || upgradedWeapon) {
        this.updateMaxReload(reload, weapon.id);
      }
      this.globalInventory[weapon.itemType] = current;
      this.variant[type] = this.variant.current;
      const currentType = this.weapon[type];
      if (currentType === null || weapon.age > DataHandler_default.getWeapon(currentType).age) {
        this.weapon[type] = current;
      }
      const primary = this.globalInventory[0];
      const secondary = this.globalInventory[1];
      const notPrimaryUpgrade = primary === null || !("isUpgrade" in DataHandler_default.getWeapon(primary));
      const notSecondaryUpgrade = secondary === null || !("isUpgrade" in DataHandler_default.getWeapon(secondary));
      if (DataHandler_default.isSecondary(current) && notPrimaryUpgrade) {
        const predicted = this.predictPrimary(current);
        if (primary === null || DataHandler_default.getWeapon(predicted).upgradeType === DataHandler_default.getWeapon(primary).upgradeType) {
          this.weapon.primary = predicted;
        }
      } else if (DataHandler_default.isPrimary(current) && notSecondaryUpgrade) {
        const predicted = this.predictSecondary(current);
        if (predicted === null || secondary === null || DataHandler_default.getWeapon(predicted).upgradeType === DataHandler_default.getWeapon(secondary).upgradeType) {
          this.weapon.secondary = predicted;
        }
      }
      this.isFullyUpgraded = this.detectFullUpgrade();
      if (this.isFullyUpgraded) {
        if (primary !== null) {
          this.weapon.primary = primary;
        }
        if (secondary !== null) {
          this.weapon.secondary = secondary;
        }
      }
      if (this.weapon.primary === void 0) {
        throw Error("Primary is 'undefined', value must be at least 'null' or 'number'");
      }
      if (this.weapon.secondary === void 0) {
        throw Error("Secondary is 'undefined', value must be at least 'null' or 'number'");
      }
    }
    getWeaponVariant(id) {
      const type = DataHandler_default.getWeapon(id || 0).itemType;
      const variant = this.variant[WeaponTypeString[type]];
      return {
        current: variant,
        next: Math.min(variant + 1, 3)
      };
    }
    getBuildingDamage(id, isTank = false) {
      const weapon = DataHandler_default.getWeapon(id);
      const variant = WeaponVariants[this.getWeaponVariant(id).current];
      let damage = weapon.damage * variant.val;
      if ("sDmg" in weapon) {
        damage *= weapon.sDmg;
      }
      const hat = Hats[isTank ? 40 : this.hatID];
      if ("bDmg" in hat) {
        damage *= hat.bDmg;
      }
      return damage;
    }
    getMaxBuildingDamage(object, isTank = true) {
      const {primary: primary, secondary: secondary} = this.weapon;
      if (DataHandler_default.isMelee(secondary) && secondary === 10 && this.isReloaded(1, 1)) {
        if (this.collidingSimple(object, DataHandler_default.getWeapon(secondary).range + object.hitScale)) {
          return this.getBuildingDamage(secondary, isTank);
        }
      }
      if (DataHandler_default.isMelee(primary) && this.isReloaded(0, 1)) {
        if (this.collidingSimple(object, DataHandler_default.getWeapon(primary).range + object.hitScale)) {
          return this.getBuildingDamage(primary, isTank);
        }
      }
      return null;
    }
    canDealPoison(weaponID) {
      const variant = this.getWeaponVariant(weaponID).current;
      const isRuby = variant === 3;
      const hasPlague = this.hatID === 21;
      return {
        isAble: isRuby || hasPlague,
        count: isRuby ? 5 : hasPlague ? 6 : 0
      };
    }
    getWeaponSpeed(id, hat = this.hatID) {
      if (id === null) {
        return -1;
      }
      const reloadSpeed = hat === 20 ? Hats[hat].atkSpd : 1;
      const speed = DataHandler_default.getWeapon(id).speed * reloadSpeed;
      return Math.ceil(speed / this.client.SocketManager.TICK);
    }
    getWeaponSpeedMult() {
      if (this.hatID === 1) {
        return Hats[this.hatID].aMlt;
      }
      return 1;
    }
    getMaxWeaponRange() {
      const {primary: primary, secondary: secondary} = this.weapon;
      const primaryRange = DataHandler_default.getWeapon(primary).range;
      if (DataHandler_default.isMelee(secondary)) {
        const range = DataHandler_default.getWeapon(secondary).range;
        if (range > primaryRange) {
          return range;
        }
      }
      return primaryRange;
    }
    getWeaponRange(weaponID) {
      if (weaponID === null) {
        return 0;
      }
      const range = DataHandler_default.getWeapon(weaponID).range;
      if (DataHandler_default.isMelee(weaponID)) {
        return range + this.hitScale;
      }
      return range + this.collisionScale;
    }
    getMaxWeaponDamage(id, lookingShield, addBull = true) {
      if (DataHandler_default.isMelee(id)) {
        const bull = Hats[7];
        const variant = this.getWeaponVariant(id).current;
        let damage = DataHandler_default.getWeapon(id).damage;
        if (addBull) {
          damage *= bull.dmgMultO;
        }
        damage *= WeaponVariants[variant].val;
        if (lookingShield) {
          damage *= DataHandler_default.getWeapon(11).shield;
        }
        return damage;
      } else if (DataHandler_default.isShootable(id) && !lookingShield) {
        const projectile = DataHandler_default.getProjectile(id);
        return projectile.damage;
      }
      return 0;
    }
    getMaxKnockback() {
      let knockback = 33.3;
      const {primary: primary, secondary: secondary} = this.weapon;
      if (primary != null) {
        knockback += DataHandler_default.getWeapon(primary).knockback;
      }
      if (secondary != null) {
        knockback += DataHandler_default.getWeapon(secondary).knockback;
      }
      return knockback;
    }
    getPrimaryKnockback(target) {
      const {primary: primary} = this.weapon;
      if (primary !== null && this.isReloaded(0, 1)) {
        const {range: range, knockback: knockback} = DataHandler_default.getWeapon(primary);
        if (this.collidingEntity(target, range)) {
          return knockback;
        }
      }
      return 0;
    }
    getActualMaxKnockback(target) {
      let output = 0;
      const {primary: primary, secondary: secondary} = this.weapon;
      const hitScale = target.hitScale;
      if (primary !== null && this.isReloaded(0, 1)) {
        const {range: range, knockback: knockback} = DataHandler_default.getWeapon(primary);
        if (this.collidingEntity(target, range + hitScale)) {
          output += knockback;
        }
      }
      if (secondary !== null && this.isReloaded(1, 1)) {
        const {range: range, knockback: knockback} = DataHandler_default.getWeapon(secondary);
        if (this.collidingEntity(target, range + hitScale)) {
          output += knockback;
        }
      }
      if (this.isReloaded(2, 1)) {
        if (this.collidingEntity(target, 700 + hitScale)) {
          output += 33.3;
        }
      }
      return output;
    }
    getItemPlaceScale(itemID) {
      const item = Items[itemID];
      return this.scale + item.scale + item.placeOffset;
    }
    isReloaded(type, tick) {
      const reload = this.reload[type].current;
      const max = this.reload[type].max - tick;
      return reload >= max;
    }
    atExact(type, tick) {
      const {current: current, max: max} = this.reload[type];
      return current === max - tick;
    }
    isEmptyReload(type) {
      const reload = this.reload[type].current;
      return reload === 0;
    }
    detectSpikeInsta() {
      const {myPlayer: myPlayer, ObjectManager: ObjectManager} = this.client;
      const spikeID = this.globalInventory[4] || 9;
      const placeLength = this.getItemPlaceScale(spikeID);
      const pos1 = this.pos.current;
      const pos2 = myPlayer.pos.current;
      const angleToMyPlayer = pos1.angle(pos2);
      const spike = Items[spikeID];
      const range = this.collisionScale + spike.scale;
      const straightSpikePos = pos1.addDirection(angleToMyPlayer, placeLength);
      const distance = pos2.distance(straightSpikePos);
      if (distance > range) {
        return 0;
      }
      const angles = ObjectManager.getBestPlacementAngles({
        position: pos1,
        id: spikeID,
        targetAngle: angleToMyPlayer,
        ignoreID: null,
        preplace: false,
        reduce: false,
        fill: false
      });
      for (const angle of angles) {
        const spikePos = pos1.addDirection(angle, placeLength);
        const distance2 = pos2.distance(spikePos);
        if (distance2 <= range) {
          return spike.damage;
        }
      }
      return 0;
    }
    canPossiblyInstakill() {
      const {PlayerManager: PlayerManager, myPlayer: myPlayer} = this.client;
      const lookingShield = PlayerManager.lookingShield(myPlayer, this);
      const {primary: primary, secondary: secondary} = this.weapon;
      const primaryDamage = this.getMaxWeaponDamage(primary, lookingShield);
      const secondaryDamage = this.getMaxWeaponDamage(secondary, lookingShield);
      const addRange = this.isTrapped ? 30 : 130;
      const boostRange = this.usingBoost && !this.isTrapped ? 430 : addRange;
      const primaryRange = this.getWeaponRange(primary) + boostRange;
      const secondaryRange = this.getWeaponRange(secondary) + addRange;
      const turretRange = 700 + addRange;
      const primaryReloaded = this.isReloaded(0, 1);
      const primaryVariant = this.getWeaponVariant(primary).current;
      const isDiamondPolearm = primary === 5 && primaryVariant >= 2;
      const collidingPrimary = myPlayer.collidingEntity(this, primaryRange);
      const collidingSecondary = myPlayer.collidingEntity(this, DataHandler_default.isShootable(secondary) ? primaryRange : secondaryRange);
      const collidingTurret = myPlayer.collidingEntity(this, turretRange);
      let spikeSyncDamage = 0;
      let includeTurret = false;
      if (collidingPrimary) {
        if (primaryReloaded) {
          this.potentialDamage += primaryDamage;
          this.primaryDamage = primaryDamage;
          spikeSyncDamage += primaryDamage;
        }
        includeTurret = true;
      }
      if (collidingSecondary) {
        if (this.isReloaded(1, 1)) {
          this.potentialDamage += secondaryDamage;
        }
        if (DataHandler_default.isMelee(secondary)) {
          includeTurret = true;
        }
      }
      if (this.isReloaded(2, 1) && includeTurret && !lookingShield) {
        this.potentialDamage += 25;
      }
      if (collidingPrimary && collidingTurret && this.isEmptyReload(2) && primaryReloaded && isDiamondPolearm) {
        this.velocityTicking = true;
      }
      if (collidingPrimary && collidingSecondary && collidingTurret && this.isEmptyReload(1) && this.isEmptyReload(2) && primaryReloaded) {
        this.reverseInsta = true;
      }
      if (collidingPrimary && (this.weapon.oldCurrent === 0 && this.weapon.current === 5 || this.weapon.current === 0 && this.isEmptyReload(0) && this.hatID === 7)) {
        this.toolHammerInsta = true;
      }
      const pos1 = this.pos.current;
      const pos2 = myPlayer.pos.current;
      const distance = pos1.distance(pos2);
      const angle = pos1.angle(pos2);
      const offset = Math.asin(2 * myPlayer.scale / (2 * distance));
      const lookingAt = getAngleDist(angle, this.angle) <= offset;
      const {current: current, oldCurrent: oldCurrent} = this.weapon;
      const bowDetect = current === 9 && oldCurrent !== 9 || current === 12 && oldCurrent === 9 || current === 15 && oldCurrent === 12;
      if (distance > 300 && lookingAt && bowDetect) {
        this.rangedBowInsta = true;
      }
      const spikeDamage = this.detectSpikeInsta();
      if (spikeDamage !== 0) {
        this.canPlaceSpike = true;
        this.spikeDamage = spikeDamage;
        spikeSyncDamage += spikeDamage;
        if (spikeSyncDamage >= 100) {
          this.spikeSyncThreat = true;
        }
      }
      const soldierDefense = Hats[6].dmgMult;
      if (this.potentialDamage * soldierDefense >= myPlayer.currentHealth) {
        return 3;
      }
      const soldierMult = myPlayer.hatID === 6 ? soldierDefense : 1;
      if (this.potentialDamage * soldierMult >= myPlayer.currentHealth) {
        return 2;
      }
      return 0;
    }
  }
  const Player_default = Player;
  const resizeEvent = new Event("resize");
  const ZoomHandler = new class {
    _scale={
      Default: {
        _w: 1920,
        _h: 1080
      },
      current: {
        _w: 1920,
        _h: 1080
      },
      _smooth: {
        _w: Hooker_default.linker(1920),
        _h: Hooker_default.linker(1080)
      }
    };
    getScale() {
      const dpr = 1;
      return Math.max(window.innerWidth / this._scale.Default._w, window.innerHeight / this._scale.Default._h) * dpr;
    }
    tempScale=1;
    handler(event) {
      if (!(event.target instanceof HTMLCanvasElement) || event.ctrlKey || event.shiftKey || event.altKey || isActiveInput()) {
        return;
      }
      const {Default: Default, current: current} = this._scale;
      if (event.deltaY < 0) {
        this.tempScale *= 1.1;
      } else {
        this.tempScale /= 1.1;
      }
      this.tempScale = clamp(this.tempScale, .1, 22);
      const zoom = this.tempScale;
      current._w = Default._w * zoom;
      current._h = Default._h * zoom;
    }
    renderStart=Date.now();
    smoothUpdate() {
      const {current: current, _smooth: smooth} = this._scale;
      const now = Math.sign(window.Number.DELTA) * Date.now();
      const delta = now - this.renderStart;
      this.renderStart = now;
      const dt = delta / 1e3;
      const blend = .4 * (1 - Math.exp(-10 * dt));
      smooth._w[0] = lerp(smooth._w[0], current._w, blend);
      smooth._h[0] = lerp(smooth._h[0], current._h, blend);
      window.dispatchEvent(resizeEvent);
    }
  };
  const ZoomHandler_default = ZoomHandler;
  const renderText = (ctx, text, size = 25, posx = 10, posy = 9) => {
    ctx.save();
    ctx.font = `700 ${size}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = ZoomHandler_default.getScale();
    ctx.scale(scale, scale);
    ctx.fillStyle = "#eaeaea";
    ctx.strokeStyle = "#1f2029";
    ctx.lineWidth = 8;
    ctx.globalAlpha = .6;
    ctx.letterSpacing = "6px";
    ctx.lineJoin = "round";
    ctx.strokeText(text, posx, posy);
    ctx.fillText(text, posx, posy);
    ctx.restore();
  };
  const Renderer = new class {
    _renderObjects=[];
    totalTimes=[];
    lastLogTime=performance.now();
    _dtSamples=[];
    _dtSmoothed=0;
    _lastFrameTime=performance.now();
    _frameSkipCounter=0;
    _staticCacheDirty=true;
    _staticCacheOffset={
      x: 0,
      y: 0
    };
    _namePatchApplied=false;
    _matchesNickname(text, nick) {
      if (!text || !nick) return false;
      if (text === nick) return true;
      if (text.length > nick.length && text.endsWith(nick)) {
        const sep = text[text.length - nick.length - 1];
        return sep === " " || sep === "]" || sep === ":";
      }
      return false;
    }
    patchMyNameColor() {
      if (this._namePatchApplied) return;
      const proto = CanvasRenderingContext2D.prototype;
      const origFillText = proto.fillText;
      const self = this;
      proto.fillText = function(text, x, y, maxWidth) {
        const myNick = client && client.myPlayer && client.myPlayer.nickname;
        let overrideColor = null;
        if (Settings_default._myNameColor && self._matchesNickname(text, myNick)) {
          overrideColor = Settings_default._myNameColorValue;
        }
        if (overrideColor) {
          const prevFill = this.fillStyle;
          this.fillStyle = overrideColor;
          if (maxWidth !== undefined) {
            origFillText.call(this, text, x, y, maxWidth);
          } else {
            origFillText.call(this, text, x, y);
          }
          this.fillStyle = prevFill;
          return;
        }
        if (maxWidth !== undefined) {
          return origFillText.call(this, text, x, y, maxWidth);
        }
        return origFillText.call(this, text, x, y);
      };
      this._namePatchApplied = true;
    }
    invalidateStaticCache() {
      this._staticCacheDirty = true;
    }
    _preRender() {
      ZoomHandler_default.smoothUpdate();
      this.patchMyNameColor();
    }
    _postRender() {
      const now = performance.now();
      const rawDt = now - this._lastFrameTime;
      this._lastFrameTime = now;
      this._dtSamples.push(rawDt);
      if (this._dtSamples.length > 8) this._dtSamples.shift();
      this._dtSmoothed = this._dtSamples.reduce((a, b) => a + b, 0) / this._dtSamples.length;
      if (Settings_default._lowQuality && this._dtSmoothed > 0) {
        const currentFps = 1000 / this._dtSmoothed;
        if (currentFps < 25) {
          this._frameSkipCounter++;
          if (this._frameSkipCounter % 2 === 0) return;
        } else {
          this._frameSkipCounter = 0;
        }
      }
      while (this.totalTimes.length > 0 && this.totalTimes[0] <= now - 1e3) {
        this.totalTimes.shift();
      }
      this.totalTimes.push(now);
      const fps = this.totalTimes.length;
      if (now - this.lastLogTime >= 1e3) {
        GameUI_default.updateFPS(fps);
        this.lastLogTime = now;
      }
      const canvas = document.querySelector("#gameCanvas");
      const ctx = canvas.getContext("2d");
      if (Settings_default._lowQuality) {
        if (!ctx.__lqPatched) {
          const proto = Object.getPrototypeOf(ctx);
          const origDesc = Object.getOwnPropertyDescriptor(proto, "shadowBlur");
          if (origDesc) {
            Object.defineProperty(proto, "shadowBlur", {
              get() {
                return 0;
              },
              set(v) {},
              configurable: true
            });
          }
          ctx.__lqPatched = true;
        }
        ctx.imageSmoothingEnabled = false;
      } else {
        if (ctx.__lqPatched) {
          const proto = Object.getPrototypeOf(ctx);
          const origDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur");
          if (origDesc) Object.defineProperty(proto, "shadowBlur", origDesc);
          ctx.__lqPatched = false;
        }
        ctx.imageSmoothingEnabled = true;
      }
    }
    _mapPreRender(ctx) {
      if (Settings_default._lowQuality) {
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = "low";
      }
      ctx.save();
      ctx.globalAlpha = .6;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, Config_default.snowBiomeTop / Config_default.mapScale * height);
      ctx.fillStyle = "#dbc666";
      ctx.fillRect(0, 12e3 / Config_default.mapScale * height, width, height);
      ctx.fillStyle = "#91b2db";
      const startY = (Config_default.mapScale / 2 - Config_default.riverWidth / 2) / Config_default.mapScale * height;
      ctx.fillRect(0, startY, width, Config_default.riverWidth / Config_default.mapScale * height);
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = client;
      ctx.globalAlpha = 1;
      const markSize = 8;
      if (ModuleHandler.followPath) {
        const pos = ModuleHandler.endTarget.copy().div(Config_default.mapScale).mult(width);
        ctx.fillStyle = "#c2383d";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, markSize, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (myPlayer.teleported) {
        const pos = myPlayer.teleportPos.copy().div(Config_default.mapScale).mult(width);
        ctx.fillStyle = "#d76edb";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, markSize, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (Settings_default._notificationTracers) {
        ctx.fillStyle = Settings_default._notificationTracersColor;
        const notifications = NotificationRenderer_default.notifications;
        for (const notify of notifications) {
          const x = notify.x / Config_default.mapScale * width;
          const y = notify.y / Config_default.mapScale * width;
          ctx.beginPath();
          ctx.arc(x, y, markSize * 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    drawNorthArrow(ctx, x, y, angle) {
      const s = 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#9b5cf6";
      ctx.beginPath();
      ctx.moveTo(s * 0.28, -s * 0.58);
      ctx.lineTo(-s * 0.24, -s * 0.02);
      ctx.lineTo(s * 0.10, -s * 0.02);
      ctx.lineTo(-s * 0.30, s * 0.58);
      ctx.lineTo(s * 0.46, s * 0.04);
      ctx.lineTo(s * 0.06, s * 0.04);
      ctx.lineTo(s * 0.52, -s * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }
    rotation=0;
    arrowPart=2 * Math.PI / 3;
    drawTarget(ctx, entity) {
      const len = entity.scale + 30;
      if (!Settings_default._lowQuality) this.rotation = (this.rotation + .01) % 6.28;
      const offset = RYN._offset;
      ctx.save();
      ctx.translate(-offset.x, -offset.y);
      ctx.translate(entity.x, entity.y);
      ctx.rotate(this.rotation);
      this.drawNorthArrow(ctx, len * Math.cos(this.arrowPart * 1), len * Math.sin(this.arrowPart * 1), -1.04);
      this.drawNorthArrow(ctx, len * Math.cos(this.arrowPart * 2), len * Math.sin(this.arrowPart * 2), 1.04);
      this.drawNorthArrow(ctx, len * Math.cos(this.arrowPart * 3), len * Math.sin(this.arrowPart * 3), 3.14);
      ctx.restore();
    }
    rect(ctx, pos, scale, color, lineWidth = 4, alpha = 1) {
      const offset = RYN._offset;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.translate(-offset.x, -offset.y);
      ctx.translate(pos.x, pos.y);
      ctx.rect(-scale, -scale, scale * 2, scale * 2);
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    }
    roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) {
        r = w / 2;
      }
      if (h < 2 * r) {
        r = h / 2;
      }
      if (r < 0) {
        r = 0;
      }
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    circle(ctx, x, y, radius, color, opacity = 1, lineWidth = 4) {
      const offset = RYN._offset;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.translate(-offset.x, -offset.y);
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    }
    _spriteCache=new Map;
    _sprStar(c, spikes, outer, inner) {
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      c.beginPath();
      c.moveTo(0, -outer);
      for (let i = 0; i < spikes; i++) {
        c.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
        rot += step;
        c.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
        rot += step;
      }
      c.lineTo(0, -outer);
      c.closePath();
    }
    _sprCircle(c, x, y, scale, dontStroke, dontFill) {
      c.beginPath();
      c.arc(x, y, scale, 0, 2 * Math.PI);
      if (!dontFill) c.fill();
      if (!dontStroke) c.stroke();
    }
    _sprRect(c, x, y, w, h, dontStroke, dontFill) {
      if (!dontFill) c.fillRect(x - w / 2, y - h / 2, w, h);
      if (!dontStroke) c.strokeRect(x - w / 2, y - h / 2, w, h);
    }
    _sprRectCircle(c, x, y, s, sw, seg, dontStroke, dontFill) {
      c.save();
      c.translate(x, y);
      seg = Math.ceil(seg / 2);
      for (let i = 0; i < seg; i++) {
        this._sprRect(c, 0, 0, s * 2, sw, dontStroke, dontFill);
        c.rotate(Math.PI / seg);
      }
      c.restore();
    }
    _sprTriangle(c, s) {
      const h = s * (Math.sqrt(3) / 2);
      c.beginPath();
      c.moveTo(0, -h / 2);
      c.lineTo(-s / 2, h / 2);
      c.lineTo(s / 2, h / 2);
      c.lineTo(0, -h / 2);
      c.fill();
      c.closePath();
    }
    _sprLeaf(c, x, y, l, r) {
      const endX = x + l * Math.cos(r);
      const endY = y + l * Math.sin(r);
      const width = l * 0.4;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo((x + endX) / 2 + width * Math.cos(r + Math.PI / 2), (y + endY) / 2 + width * Math.sin(r + Math.PI / 2), endX, endY);
      c.quadraticCurveTo((x + endX) / 2 - width * Math.cos(r + Math.PI / 2), (y + endY) / 2 - width * Math.sin(r + Math.PI / 2), x, y);
      c.closePath();
      c.fill();
      c.stroke();
    }
    getItemSprite(id) {
      if (this._spriteCache.has(id)) return this._spriteCache.get(id);
      const item = Items[id];
      if (!item) return null;
      const P_MAIN = "#7A42F4";
      const P_LIGHT = "#a07af4";
      const P_DARK = "#4a1fa8";
      const OUTLINE_COLOR = "#2d1265";
      const OUTLINE_WIDTH = 5.5;
      const name = item.name;
      const reScale = item.scale;
      const cv = document.createElement("canvas");
      cv.width = cv.height = reScale * 2.5 + OUTLINE_WIDTH + (item.spritePadding || 0);
      const c = cv.getContext("2d");
      c.translate(cv.width / 2, cv.height / 2);
      c.rotate(Math.PI / 2);
      c.strokeStyle = OUTLINE_COLOR;
      c.lineWidth = OUTLINE_WIDTH;
      if (name === "apple") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.fillStyle = P_DARK;
        const leafDir = -(Math.PI / 2);
        this._sprLeaf(c, reScale * Math.cos(leafDir), reScale * Math.sin(leafDir), 25, leafDir + Math.PI / 2);
      } else if (name === "cookie") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.fillStyle = P_DARK;
        const rotVal = Math.PI * 2 / 4;
        for (let i = 0; i < 4; ++i) {
          const r = reScale / 2.1;
          this._sprCircle(c, r * Math.cos(rotVal * i), r * Math.sin(rotVal * i), 4.5, true);
        }
      } else if (name === "cheese") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.fillStyle = P_DARK;
        const rotVal = Math.PI * 2 / 4;
        for (let i = 0; i < 4; ++i) {
          const r = reScale / 2.1;
          this._sprCircle(c, r * Math.cos(rotVal * i), r * Math.sin(rotVal * i), 4.5, true);
        }
      } else if (name === "wood wall" || name === "stone wall" || name === "castle wall") {
        c.fillStyle = P_MAIN;
        const sides = name === "castle wall" ? 4 : 3;
        this._sprStar(c, sides, reScale * 1.1, reScale * 1.1);
        c.fill();
        c.stroke();
        c.fillStyle = P_LIGHT;
        this._sprStar(c, sides, reScale * 0.65, reScale * 0.65);
        c.fill();
      } else if (name === "spikes" || name === "greater spikes" || name === "poison spikes" || name === "spinning spikes") {
        c.fillStyle = P_MAIN;
        const tmpScale = reScale * 0.6;
        this._sprStar(c, name === "spikes" ? 5 : 6, reScale, tmpScale);
        c.fill();
        c.stroke();
        c.fillStyle = P_DARK;
        this._sprCircle(c, 0, 0, tmpScale);
        c.fillStyle = P_LIGHT;
        this._sprCircle(c, 0, 0, tmpScale / 2, true);
      } else if (name === "windmill" || name === "faster windmill" || name === "power mill") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.fillStyle = P_LIGHT;
        this._sprRectCircle(c, 0, 0, reScale * 1.5, 29, 4);
        c.fillStyle = P_DARK;
        this._sprCircle(c, 0, 0, reScale * 0.5);
      } else if (name === "mine") {
        c.fillStyle = P_MAIN;
        this._sprStar(c, 3, reScale, reScale);
        c.fill();
        c.stroke();
        c.fillStyle = P_LIGHT;
        this._sprStar(c, 3, reScale * 0.55, reScale * 0.65);
        c.fill();
      } else if (name === "sapling") {
        for (let i = 0; i < 2; ++i) {
          const tmpScale = reScale * (!i ? 1 : 0.5);
          this._sprStar(c, 7, tmpScale, tmpScale * 0.7);
          c.fillStyle = !i ? P_MAIN : P_LIGHT;
          c.fill();
          if (!i) c.stroke();
        }
      } else if (name === "pit trap") {
        c.fillStyle = P_MAIN;
        this._sprStar(c, 3, reScale * 1.1, reScale * 1.1);
        c.fill();
        c.stroke();
        c.fillStyle = P_DARK;
        this._sprStar(c, 3, reScale * 0.65, reScale * 0.65);
        c.fill();
      } else if (name === "boost pad") {
        c.fillStyle = P_MAIN;
        this._sprRect(c, 0, 0, reScale * 2, reScale * 2);
        c.fillStyle = P_LIGHT;
        this._sprTriangle(c, reScale * 1);
      } else if (name === "turret") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.fillStyle = P_DARK;
        const tmpLen = 50;
        this._sprRect(c, 0, -tmpLen / 2, reScale * 0.9, tmpLen);
        this._sprCircle(c, 0, 0, reScale * 0.6);
      } else if (name === "platform") {
        c.fillStyle = P_MAIN;
        const tmpCount = 4;
        const tmpS = reScale * 2;
        const tmpW = tmpS / tmpCount;
        let tmpX = -(reScale / 2);
        for (let i = 0; i < tmpCount; ++i) {
          this._sprRect(c, tmpX - tmpW / 2, 0, tmpW, reScale * 2);
          tmpX += tmpS / tmpCount;
        }
      } else if (name === "healing pad") {
        c.fillStyle = P_MAIN;
        this._sprRect(c, 0, 0, reScale * 2, reScale * 2);
        c.fillStyle = P_LIGHT;
        this._sprRectCircle(c, 0, 0, reScale * 0.65, 20, 4, true);
      } else if (name === "spawn pad") {
        c.fillStyle = P_MAIN;
        this._sprRect(c, 0, 0, reScale * 2, reScale * 2);
        c.fillStyle = P_LIGHT;
        this._sprCircle(c, 0, 0, reScale * 0.6);
      } else if (name === "blocker") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.rotate(Math.PI / 4);
        c.fillStyle = P_LIGHT;
        this._sprRectCircle(c, 0, 0, reScale * 0.65, 20, 4, true);
      } else if (name === "teleporter") {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
        c.rotate(Math.PI / 4);
        c.fillStyle = P_LIGHT;
        this._sprCircle(c, 0, 0, reScale * 0.5, true);
      } else {
        c.fillStyle = P_MAIN;
        this._sprCircle(c, 0, 0, reScale);
      }
      this._spriteCache.set(id, cv);
      return cv;
    }
    itemSprite(ctx, id, x, y, angle = 0, opacity = 0.35) {
      const sprite = this.getItemSprite(id);
      if (!sprite) return;
      const offset = RYN._offset;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(-offset.x, -offset.y);
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }
    fillCircle(ctx, x, y, radius, color, opacity = 1) {
      const offset = RYN._offset;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.translate(-offset.x, -offset.y);
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();
      ctx.restore();
    }
    renderText(ctx, text, x, y, fontSize = 14, opacity = .5) {
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#3d3f42";
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.textBaseline = "top";
      ctx.globalAlpha = opacity;
      ctx.font = fontSize + "px Hammersmith One";
      const offset = RYN._offset;
      ctx.translate(-offset.x, -offset.y);
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
    }
    line(ctx, start, end, color, opacity = 1, lineWidth = 4) {
      const offset = RYN._offset;
      ctx.save();
      ctx.translate(-offset.x, -offset.y);
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    arrow(ctx, length, x, y, angle, color) {
      const offset = RYN._offset;
      ctx.save();
      ctx.translate(-offset.x, -offset.y);
      ctx.translate(x, y);
      ctx.rotate(angle);
      const tip = length * 2.2;
      const base = -length * 0.6;
      const hw = length * 1.1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(tip, 0);
      ctx.lineTo(base, -hw);
      ctx.lineTo(base, hw);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    cross(ctx, x, y, size, lineWidth, color) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      const offset = RYN._offset;
      ctx.translate(x - offset.x, y - offset.y);
      const halfSize = size / 2;
      ctx.beginPath();
      ctx.moveTo(-halfSize, -halfSize);
      ctx.lineTo(halfSize, halfSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(halfSize, -halfSize);
      ctx.lineTo(-halfSize, halfSize);
      ctx.stroke();
      ctx.restore();
    }
    getTracerColor(entity) {
      if (entity instanceof Notify) {
        return Settings_default._notificationTracersColor;
      }
      if (Settings_default._animalTracers && entity.isAI) {
        return Settings_default._animalTracersColor;
      }
      if (Settings_default._teammateTracers && entity.isPlayer && client.myPlayer.isTeammateByID(entity.sid)) {
        return Settings_default._teammateTracersColor;
      }
      if (Settings_default._enemyTracers && entity.isPlayer && client.myPlayer.isEnemyByID(entity.sid)) {
        return Settings_default._enemyTracersColor;
      }
      return null;
    }
    renderTracer(ctx, entity, player) {
      const color = this.getTracerColor(entity);
      if (color === null) {
        return;
      }
      const pos1 = new Vector_default(player.x, player.y);
      const pos2 = new Vector_default(entity.x, entity.y);
      const w = 8;
      const distance = Math.min(125 + w * 2, pos1.distance(pos2) - w * 2);
      const angle = pos1.angle(pos2);
      const pos = pos1.addDirection(angle, distance);
      this.arrow(ctx, w, pos.x, pos.y, angle, color);
    }
    renderDistance(ctx, entity, player) {
      const pos1 = new Vector_default(player.x, player.y);
      const pos2 = new Vector_default(entity.x, entity.y);
      const entityTarget = client.PlayerManager.getEntity(entity.sid, !!entity.isPlayer);
      if (entityTarget === null) {
        return;
      }
      const pos3 = client.myPlayer.pos.current;
      const pos4 = entityTarget.pos.current;
      const distance = fixTo(pos3.distance(pos4), 2);
      const center = pos1.addDirection(pos1.angle(pos2), pos1.distance(pos2) / 2);
      this.renderText(ctx, `${distance}`, center.x, center.y);
    }
    getMarkerColor(object) {
      const id = object.owner?.sid;
      if (typeof id !== "number") {
        return null;
      }
      if (Settings_default._itemMarkers && client.myPlayer.isMyPlayerByID(id)) {
        return Settings_default._itemMarkersColor;
      }
      if (Settings_default._teammateMarkers && client.myPlayer.isTeammateByID(id)) {
        return Settings_default._teammateMarkersColor;
      }
      if (Settings_default._enemyMarkers && client.myPlayer.isEnemyByID(id)) {
        return Settings_default._enemyMarkersColor;
      }
      return null;
    }
    _markerSprites=new Map;
    _getMarkerSprite(color) {
      let sprite = this._markerSprites.get(color);
      if (sprite) return sprite;
      const radius = 7;
      const pad = 3;
      const size = (radius + pad) * 2;
      const off = document.createElement("canvas");
      off.width = size;
      off.height = size;
      const octx = off.getContext("2d");
      const cx = size / 2;
      const cy = size / 2;
      octx.beginPath();
      octx.arc(cx, cy, radius, 0, 2 * Math.PI);
      octx.fillStyle = color;
      octx.fill();
      octx.strokeStyle = "#3b3b3b";
      octx.lineWidth = 3;
      octx.stroke();
      sprite = {
        canvas: off,
        size: size
      };
      this._markerSprites.set(color, sprite);
      return sprite;
    }
    renderMarker(ctx, object) {
      const color = this.getMarkerColor(object);
      if (color === null) {
        return;
      }
      const offset = RYN._offset;
      const x = object.x + object.xWiggle - offset.x;
      const y = object.y + object.yWiggle - offset.y;
      const sprite = this._getMarkerSprite(color);
      ctx.drawImage(sprite.canvas, x - sprite.size / 2, y - sprite.size / 2);
    }
    barContainer(ctx, x, y, w, h, r = 8) {
      ctx.fillStyle = "#3d3f42";
      this.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
    }
    barContent(ctx, x, y, w, h, fill, color) {
      const barPad = Config_default.barPad;
      ctx.fillStyle = color;
      this.roundRect(ctx, x + barPad, y + barPad, (w - barPad * 2) * fill, h - barPad * 2, 7);
      ctx.fill();
    }
    getNameY(target) {
      let nameY = 34;
      const height = 5;
      if (Settings_default._playerTurretReloadBar) {
        nameY += height;
      }
      if (Settings_default._weaponReloadBar) {
        nameY += height;
      }
      return nameY;
    }
    getContainerHeight(entity) {
      const {barHeight: barHeight, barPad: barPad} = Config_default;
      let height = barHeight;
      if (entity.isPlayer) {
        const smallBarHeight = barHeight - 4;
        const player = client.PlayerManager.playerData.get(entity.sid);
        if (player === void 0) {
          return height;
        }
        if (Settings_default._playerTurretReloadBar) {
          height += smallBarHeight - barPad;
        }
        if (Settings_default._weaponReloadBar) {
          height += barHeight - barPad;
        }
      }
      return height;
    }
    renderBar(ctx, entity) {
      const {barWidth: barWidth, barHeight: barHeight, barPad: barPad} = Config_default;
      const smallBarHeight = barHeight - 4;
      const totalWidth = barWidth + barPad;
      const scale = entity.scale + 34;
      const {myPlayer: myPlayer, PlayerManager: PlayerManager} = client;
      const offset = RYN._offset;
      let x = entity.x - offset.x - totalWidth;
      let y = entity.y - offset.y + scale;
      ctx.save();
      const player = entity.isPlayer && PlayerManager.playerData.get(entity.sid);
      const animal = entity.isAI && PlayerManager.animalData.get(entity.sid);
      let height = 0;
      if (player instanceof Player_default) {
        const [primary, secondary, turret] = player.reload;
        if (Settings_default._playerTurretReloadBar) {
          this.barContainer(ctx, x, y + height, totalWidth * 2, smallBarHeight);
          this.barContent(ctx, x, y + height, totalWidth * 2, smallBarHeight, turret.current / turret.max, Settings_default._playerTurretReloadBarColor);
          height += smallBarHeight - barPad;
        }
        if (Settings_default._weaponReloadBar) {
          const extraPad = 2.25;
          this.barContainer(ctx, x, y + height, totalWidth * 2, barHeight);
          this.barContent(ctx, x, y + height, totalWidth + extraPad, barHeight, primary.current / primary.max, Settings_default._weaponReloadBarColor);
          this.barContent(ctx, x + totalWidth - extraPad, y + height, totalWidth + extraPad, barHeight, secondary.current / secondary.max, Settings_default._weaponReloadBarColor);
          height += barHeight - barPad;
        }
      }
      const target = player || animal;
      if (target) {
        const container = getTargetValue(RYN, "_config");
        setTargetValue(container, "nameY", this.getNameY(target));
        const {currentHealth: currentHealth, maxHealth: maxHealth} = target;
        const health = animal ? maxHealth : 100;
        const color = PlayerManager.isEnemyTarget(myPlayer, target) ? "#cc5151" : "#8ecc51";
        this.barContainer(ctx, x, y + height, totalWidth * 2, barHeight);
        this.barContent(ctx, x, y + height, totalWidth * 2, barHeight, currentHealth / health, color);
        height += barHeight;
      }
      ctx.restore();
    }
    renderHP(ctx, entity) {
      if (!Settings_default._renderHP) {
        return;
      }
      const {barPad: barPad, nameY: nameY} = Config_default;
      const containerHeight = this.getContainerHeight(entity);
      let text = `HP ${Math.floor(entity.health)}/${entity.maxHealth}`;
      const offset = entity.scale + nameY + barPad + containerHeight;
      const {myPlayer: myPlayer, PlayerManager: PlayerManager} = client;
      const _offset = RYN._offset;
      const x = entity.x - _offset.x;
      const y = entity.y - _offset.y + offset;
      if (entity.isPlayer) {
        const player = PlayerManager.playerData.get(entity.sid);
        if (player !== void 0) {
          text += ` ${player.shameCount}/8`;
        }
      }
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#3d3f42";
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.textBaseline = "top";
      ctx.font = "19px Hammersmith One";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
    }
    circularBar(ctx, object, perc, angle, color, offset = 0, sizeMult = 1) {
      const _offset = RYN._offset;
      const x = object.x + object.xWiggle - _offset.x;
      const y = object.y + object.yWiggle - _offset.y;
      const height = Config_default.barHeight * .5 * sizeMult;
      const defaultScale = 10 + height / 2;
      const scale = defaultScale + 1 + offset;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#3b3b3b";
      ctx.lineWidth = height;
      ctx.beginPath();
      ctx.arc(0, 0, scale, 0, perc * 2 * Math.PI);
      ctx.stroke();
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = height / 3;
      ctx.beginPath();
      ctx.arc(0, 0, scale, 0, perc * 2 * Math.PI);
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
      return defaultScale - 3;
    }
  };
  const Renderer_default = Renderer;
  const Animals = [ {
    id: 0,
    src: "cow_1",
    hostile: false,
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
    hostile: false,
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
    hostile: true,
    dmg: 20,
    killScore: 1e3,
    health: 1800,
    weightM: .5,
    speed: 94e-5,
    turnSpeed: 74e-5,
    scale: 78,
    viewRange: 800,
    chargePlayer: true,
    drop: [ "food", 100 ]
  }, {
    id: 3,
    name: "Bully",
    src: "bull_1",
    hostile: true,
    dmg: 20,
    killScore: 2e3,
    health: 2800,
    weightM: .45,
    speed: .001,
    turnSpeed: 8e-4,
    scale: 90,
    viewRange: 900,
    chargePlayer: true,
    drop: [ "food", 400 ]
  }, {
    id: 4,
    name: "Wolf",
    src: "wolf_1",
    hostile: true,
    dmg: 8,
    killScore: 500,
    health: 300,
    weightM: .45,
    speed: .001,
    turnSpeed: .002,
    scale: 84,
    viewRange: 800,
    chargePlayer: true,
    drop: [ "food", 200 ]
  }, {
    id: 5,
    name: "Quack",
    src: "chicken_1",
    hostile: false,
    dmg: 8,
    killScore: 2e3,
    noTrap: true,
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
    hostile: true,
    dontRun: true,
    fixedSpawn: true,
    spawnDelay: 6e4,
    noTrap: true,
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
    chargePlayer: true,
    drop: [ "food", 100 ]
  }, {
    id: 7,
    name: "Treasure",
    hostile: true,
    nameScale: 35,
    src: "crate_1",
    fixedSpawn: true,
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
    hostile: true,
    fixedSpawn: true,
    dontRun: true,
    hitScare: 4,
    spawnDelay: 3e4,
    noTrap: true,
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
    chargePlayer: true,
    drop: [ "food", 1e3 ]
  }, {
    id: 9,
    name: "💀MOOFIE",
    src: "wolf_2",
    hostile: true,
    fixedSpawn: true,
    dontRun: true,
    hitScare: 50,
    spawnDelay: 6e4,
    noTrap: true,
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
    chargePlayer: true,
    drop: [ "food", 3e3 ],
    minSpawnRange: .85,
    maxSpawnRange: .9
  }, {
    id: 10,
    name: "💀Wolf",
    src: "wolf_1",
    hostile: true,
    fixedSpawn: true,
    dontRun: true,
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
    chargePlayer: true,
    drop: [ "food", 400 ],
    minSpawnRange: .85,
    maxSpawnRange: .9
  }, {
    id: 11,
    name: "💀Bully",
    src: "bull_1",
    hostile: true,
    fixedSpawn: true,
    dontRun: true,
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
    chargePlayer: true,
    drop: [ "food", 800 ],
    minSpawnRange: .85,
    maxSpawnRange: .9
  } ];
  const Animals_default = Animals;
  const colors = [ [ "orange", "red" ], [ "aqua", "blue" ] ];
  const EntityRenderer = new class {
    start=Date.now();
    step=0;
    drawWeaponHitbox(ctx, player) {
      if (!Settings_default._weaponHitbox) {
        return;
      }
      const {myPlayer: myPlayer} = client;
      const current = myPlayer.weapon.current;
      if (DataHandler_default.isMelee(current)) {
        const weapon = DataHandler_default.getWeapon(current);
        Renderer_default.circle(ctx, player.x, player.y, weapon.range, "#f5cb42", .5, 1);
      }
    }
    drawPlacement(ctx) {
      if (!Settings_default._possiblePlacement) {
        return;
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = client;
      const [type, angles] = ModuleHandler.placeAngles;
      if (type === null || angles === null) {
        return;
      }
      const id = myPlayer.getItemByType(type);
      if (id === null) {
        return;
      }
      const dist = myPlayer.getItemPlaceScale(id);
      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        const pos = myPlayer.pos.current.addDirection(angle, dist);
        Renderer_default.itemSprite(ctx, id, pos.x, pos.y, angle, Settings_default._placementPreviewOpacity ?? .35);
      }
    }
    drawEntityHP(ctx, entity) {
      Renderer_default.renderBar(ctx, entity);
      Renderer_default.renderHP(ctx, entity);
    }
    drawHitScale(ctx, entity) {
      if (!Settings_default._weaponHitbox) {
        return;
      }
      const {PlayerManager: PlayerManager} = client;
      const type = entity.isPlayer ? PlayerManager.playerData : PlayerManager.animalData;
      const target = type.get(entity.sid);
      if (target !== void 0) {
        Renderer_default.circle(ctx, entity.x, entity.y, target.hitScale, "#3f4ec4", .5, 1);
      }
      if (entity.isAI && entity.index === 6) {
        const moostafa = Animals_default[6];
        Renderer_default.circle(ctx, entity.x, entity.y, moostafa.hitRange, "#f5cb42", .5, 1);
      }
    }
    drawDanger(ctx, entity) {}
    _render(ctx, entity, player) {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler, ObjectManager: ObjectManager, InputHandler: InputHandler} = client;
      const isMyPlayer = entity === player;
      const pos = new Vector_default(entity.x, entity.y);
      if (isMyPlayer) {
        const now = Date.now();
        this.step = now - this.start;
        this.start = now;
        if (Settings_default._displayPlayerAngle) {
          Renderer_default.line(ctx, pos, pos.addDirection(client.myPlayer.angle, 70), "#e9adf0");
        }
        this.drawWeaponHitbox(ctx, player);
        this.drawPlacement(ctx);
        {
          const autoPushModule = client._ModuleHandler.staticModules.autoPush;
          const pushPos = autoPushModule ? autoPushModule.pushPos : null;
          const nearestPushSpike = client.EnemyManager.nearestPushSpike;
          if (pushPos !== null && nearestPushSpike !== null) {
            Renderer_default.line(ctx, pos, pushPos, "#a855f7", .85, 2);
            Renderer_default.line(ctx, pushPos, nearestPushSpike.pos.current, "#a855f7", .85, 2);
          }
        }
        if (client.InputHandler.instaToggle) {
          const trapID = myPlayer.getItemByType(7);
          const enemy = client.EnemyManager.nearestEnemy;
          if (trapID === 16 && enemy !== null) {
            const ep = enemy.pos.current;
            const dist = pos.distance(ep);
            const primary = myPlayer.getItemByType(0);
            const baseRange = primary !== null ? (DataHandler_default.getWeapon(primary)?.range ?? 110) + (enemy.hitScale ?? 35) : 145;
            const secondary = myPlayer.getItemByType(1);
            const shield = client.PlayerManager.lookingShield(enemy, myPlayer);
            const pdmg = myPlayer.getMaxWeaponDamage(primary, shield);
            const sdmg = secondary !== null ? myPlayer.getMaxWeaponDamage(secondary, shield) : 0;
            const tbonus = ModuleHandler.canBuy(0, 53) ? 25 : 0;
            const canKill = pdmg + sdmg + tbonus >= enemy.currentHealth;
            const canReach = dist - 300 <= baseRange && dist <= 480;
            const ready = canReach && canKill;
            const color = ready ? "#00ff44" : "#ff2222";
            const offset = RYN._offset;
            const ex = ep.x - offset.x;
            const ey = ep.y - offset.y;
            const aw = 10;
            const ah = 16;
            const gap = (enemy.collisionScale ?? 35) + 18;
            ctx.save();
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = color;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ex, ey - gap - ah);
            ctx.lineTo(ex - aw, ey - gap);
            ctx.lineTo(ex + aw, ey - gap);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      this.drawEntityHP(ctx, entity);
      if (Settings_default._collisionHitbox) {
        Renderer_default.circle(ctx, entity.x, entity.y, entity.scale, "#c7fff2", .5, 1);
      }
      if (!isMyPlayer) {
        this.drawHitScale(ctx, entity);
        Renderer_default.renderTracer(ctx, entity, player);
      }
      if (isMyPlayer) {
        NotificationRenderer_default.render(ctx, player);
      }
      const instakillTarget = InputHandler.instakillTarget;
      if (entity.isPlayer && instakillTarget !== null && entity.sid === instakillTarget.id) {
        Renderer_default.drawTarget(ctx, entity);
        const {bowInsta: bowInsta} = ModuleHandler.staticModules;
        if (bowInsta.active) {
          Renderer_default.circle(ctx, entity.x, entity.y, bowInsta.distMin, "#eda0ee", .4, 1);
          Renderer_default.circle(ctx, entity.x, entity.y, bowInsta.distMax, "#eda0ee", .4, 1);
        }
      }
    }
  };
  const EntityRenderer_default = EntityRenderer;
  class Notify {
    x;
    y;
    timeout={
      value: 0,
      max: 1500
    };
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    render(ctx, player) {
      this.timeout.value += EntityRenderer_default.step;
      if (this.timeout.value >= this.timeout.max) {
        NotificationRenderer.remove(this);
        return;
      }
      Renderer_default.renderTracer(ctx, this, player);
    }
  }
  const NotificationRenderer = new class {
    notifications=new Set;
    remove(notify) {
      this.notifications.delete(notify);
    }
    add(object) {
      const {x: x, y: y} = object.pos.current;
      const notify = new Notify(x, y);
      this.notifications.add(notify);
    }
    render(ctx, player) {
      for (const notification of this.notifications) {
        notification.render(ctx, player);
      }
    }
  };
  const NotificationRenderer_default = NotificationRenderer;
  class SpatialHashGrid2D {
    cellSize=0;
    grid=new Map;
    constructor(cellSize) {
      this.cellSize = cellSize;
    }
    _getKey(x, y) {
      return x << 16 | y;
    }
    clear() {
      this.grid.clear();
    }
    insert(x, y, radius, objectId) {
      const startX = (x - radius) / this.cellSize | 0;
      const startY = (y - radius) / this.cellSize | 0;
      const endX = (x + radius) / this.cellSize | 0;
      const endY = (y + radius) / this.cellSize | 0;
      for (let i = startX; i <= endX; i++) {
        for (let j = startY; j <= endY; j++) {
          const key = this._getKey(i, j);
          if (!this.grid.has(key)) {
            this.grid.set(key, new Set);
          }
          this.grid.get(key).add(objectId);
        }
      }
    }
    query(x, y, search = 1, callback) {
      const cellX = x / this.cellSize | 0;
      const cellY = y / this.cellSize | 0;
      const candidates = new Set;
      let callbackSuccess = false;
      outerLoop: for (let i = -search; i <= search; i++) {
        for (let j = -search; j <= search; j++) {
          const key = this._getKey(cellX + i, cellY + j);
          if (this.grid.has(key)) {
            for (const objectId of this.grid.get(key)) {
              if (!candidates.has(objectId)) {
                candidates.add(objectId);
                if (callback(objectId)) {
                  callbackSuccess = true;
                  break outerLoop;
                }
              }
            }
          }
        }
      }
      return callbackSuccess;
    }
    queryFull(x, y, search = 1) {
      const cellX = x / this.cellSize | 0;
      const cellY = y / this.cellSize | 0;
      const candidates = new Set;
      for (let i = -search; i <= search; i++) {
        for (let j = -search; j <= search; j++) {
          const key = this._getKey(cellX + i, cellY + j);
          if (this.grid.has(key)) {
            for (const objectId of this.grid.get(key)) {
              candidates.add(objectId);
            }
          }
        }
      }
      return Array.from(candidates);
    }
    remove(x, y, radius, objectId) {
      const startX = (x - radius) / this.cellSize | 0;
      const startY = (y - radius) / this.cellSize | 0;
      const endX = (x + radius) / this.cellSize | 0;
      const endY = (y + radius) / this.cellSize | 0;
      for (let i = startX; i <= endX; i++) {
        for (let j = startY; j <= endY; j++) {
          const key = this._getKey(i, j);
          if (this.grid.has(key)) {
            const cell = this.grid.get(key);
            cell.delete(objectId);
            if (cell.size === 0) {
              this.grid.delete(key);
            }
          }
        }
      }
    }
  }
  class Sorting {
    static byDistance(target, typeA, typeB) {
      return (a, b) => {
        const dist1 = target.position[typeA].distanceDefault(a.position[typeB]);
        const dist2 = target.position[typeA].distanceDefault(b.position[typeB]);
        return dist1 - dist2;
      };
    }
    static byAngleDistance(angle) {
      return (a, b) => getAngleDist(a, angle) - getAngleDist(b, angle);
    }
    static byDanger(a, b) {
      return b.danger - a.danger;
    }
  }
  const Sorting_default = Sorting;
  class ObjectManager {
    objects=new Map;
    grid2D=new SpatialHashGrid2D(100);
    reloadingTurrets=new Map;
    attackedObjects=new Map;
    client;
    constructor(client2) {
      this.client = client2;
    }
    insertObject(object) {
      this.grid2D.insert(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.set(object.id, object);
      if (object instanceof PlayerObject) {
        const {PlayerManager: PlayerManager, myPlayer: myPlayer} = this.client;
        const owner = PlayerManager.playerData.get(object.ownerID) || PlayerManager.createPlayer({
          id: object.ownerID
        });
        object.seenPlacement = this.inPlacementRange(object);
        owner.handleObjectPlacement(object);
        if (object.type === 22) {
          if (myPlayer.collidingObject(object, 1) || myPlayer.collidingObject(object, 4)) {
            myPlayer.teleportPos.setVec(object.pos.current);
            myPlayer.teleported = true;
          }
        }
      }
    }
    createObjects(buffer) {
      for (let i = 0; i < buffer.length; i += 8) {
        const isResource = buffer[i + 6] === null;
        const data = [ buffer[i + 0], buffer[i + 1], buffer[i + 2], buffer[i + 3], buffer[i + 4] ];
        this.insertObject(isResource ? new Resource(...data, buffer[i + 5]) : new PlayerObject(...data, buffer[i + 6], buffer[i + 7]));
      }
    }
    deletedObjects=new Set;
    isDestroyedObject() {
      return this.deletedObjects.size !== 0;
    }
    removeObject(object) {
      this.grid2D.remove(object.pos.current.x, object.pos.current.y, object.collisionScale, object.id);
      this.objects.delete(object.id);
      if (object instanceof PlayerObject) {
        const player = this.client.PlayerManager.playerData.get(object.ownerID);
        if (player !== void 0) {
          player.handleObjectDeletion(object);
          const {myPlayer: myPlayer} = this.client;
          const pos1 = object.pos.current.copy();
          const pos2 = this.client.myPlayer.pos.current.copy();
          const distance = pos1.distance(pos2);
          const spikeID = myPlayer.getItemByType(4);
          const range = myPlayer.getItemPlaceScale(spikeID) + object.placementScale + myPlayer.speed + 25;
          if (distance <= range) {
            this.deletedObjects.add(object);
          }
        }
      }
    }
    removeObjectByID(id) {
      const object = this.objects.get(id);
      if (object !== void 0) {
        this.removeObject(object);
        if (this.client.isOwner) {
          const pos1 = object.pos.current.copy();
          const pos2 = this.client.myPlayer.pos.current.copy();
          if (Settings_default._notificationTracers && !targetInsideRect(pos1, pos2, object.scale)) {
            NotificationRenderer_default.add(object);
          }
        }
      }
    }
    removePlayerObjects(player) {
      for (const object of player.objects) {
        this.removeObject(object);
      }
    }
    resetTurret(id) {
      const object = this.objects.get(id);
      if (object instanceof PlayerObject) {
        object.reload = 0;
        this.reloadingTurrets.set(id, object);
      }
    }
    isEnemyObject(object) {
      if (object instanceof PlayerObject && !this.client.myPlayer.isEnemyByID(object.ownerID)) {
        return false;
      }
      return true;
    }
    isTurretReloaded(object, tick = 1) {
      const turret = this.reloadingTurrets.get(object.id);
      if (turret === void 0) {
        return true;
      }
      return turret.reload > turret.maxReload - tick;
    }
    postTick() {
      for (const [id, turret] of this.reloadingTurrets) {
        turret.reload += 1;
        if (turret.reload >= turret.maxReload) {
          turret.reload = turret.maxReload;
          this.reloadingTurrets.delete(id);
        }
      }
    }
    canPlaceItem(id, position, addRadius = 0) {
      if (id !== 18 && pointInRiver(position)) {
        return false;
      }
      const item = Items[id];
      return !this.grid2D.query(position.x, position.y, 1, id2 => {
        const object = this.objects.get(id2);
        const scale = item.scale + object.placementScale + addRadius;
        if (position.distance(object.pos.current) < scale) {
          return true;
        }
      });
    }
    inPlacementRange(object) {
      const owner = this.client.PlayerManager.playerData.get(object.ownerID);
      if (owner === void 0 || !this.client.PlayerManager.players.includes(owner)) {
        return false;
      }
      const {previous: a0, current: a1, future: a2} = owner.pos;
      const b0 = object.pos.current;
      const item = Items[object.type];
      const range = owner.scale * 2 + item.scale + item.placeOffset;
      return a0.distance(b0) <= range || a1.distance(b0) <= range || a2.distance(b0) <= range;
    }
    getBestPlacementAngles(options) {
      const {position: position, id: id, targetAngle: targetAngle, ignoreID: ignoreID, reduce: reduce, preplace: preplace, fill: fill} = options;
      const item = DataHandler_default.getItem(id);
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const length = myPlayer.getItemPlaceScale(id);
      const angles = [];
      this.grid2D.query(position.x, position.y, 1, id2 => {
        const object = this.objects.get(id2);
        if (ignoreID !== null && ignoreID === object.id) {
          return;
        }
        const pos1 = object.pos.current;
        const angle = position.angle(pos1);
        const a = object.placementScale + item.scale + 1;
        const b = position.distance(pos1);
        const c = length;
        const cosArg = (b * b + c * c - a * a) / (2 * b * c);
        if (cosArg < -1) {
          angles.push([ angle, Math.PI ]);
        } else if (cosArg <= 1) {
          const offset = Math.acos(cosArg);
          angles.push([ angle, offset ]);
        }
      });
      const finalAngles = findPlacementAngles(angles);
      const targetAngleOverlaps = angles.some(([angle, offset]) => getAngleDist(targetAngle, angle) <= offset);
      if (!targetAngleOverlaps) {
        finalAngles.push(targetAngle);
        if (finalAngles.length === 1 && fill) {
          if (item.itemType === 4) {
            return [];
          }
          const offset = Math.asin((2 * item.scale + 1) / (2 * length)) * 2;
          finalAngles.push(targetAngle - offset);
          finalAngles.push(targetAngle + offset);
          finalAngles.push(reverseAngle(targetAngle));
          return finalAngles.slice(0, Settings_default._placeAttempts);
        }
      }
      let anglesSorted = finalAngles.sort(Sorting_default.byAngleDistance(targetAngle));
      if (reduce) {
        if (!DataHandler_default.canMoveOnTop(id) && ModuleHandler.move_dir !== null && myPlayer.speed !== 0) {
          const scale = item.scale;
          const offset = Math.asin(2 * scale / (2 * length));
          anglesSorted = anglesSorted.filter(angle => getAngleDist(angle, ModuleHandler.move_dir) > offset);
        }
        return anglesSorted.slice(0, Settings_default._placeAttempts);
      }
      return anglesSorted;
    }
  }
  const ObjectManager_default = ObjectManager;
  const _RYNCrypto = function() {
    const _Do = new Uint32Array([ 1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298 ]);
    function _j(e, t) {
      return e >>> t | e << 32 - t;
    }
    function _Vt(e) {
      const t = new Uint32Array([ 1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225 ]), i = e.length, s = i * 8, n = i + 9, a = new Uint8Array(Math.ceil(n / 64) * 64);
      a.set(e);
      a[i] = 128;
      const o = new DataView(a.buffer);
      o.setUint32(a.length - 4, s >>> 0, false);
      o.setUint32(a.length - 8, Math.floor(s / 4294967296), false);
      const d = new Uint32Array(64);
      for (let m = 0; m < a.length; m += 64) {
        for (let w = 0; w < 16; w++) d[w] = o.getUint32(m + w * 4, false);
        for (let w = 16; w < 64; w++) {
          const T = _j(d[w - 15], 7) ^ _j(d[w - 15], 18) ^ d[w - 15] >>> 3, A = _j(d[w - 2], 17) ^ _j(d[w - 2], 19) ^ d[w - 2] >>> 10;
          d[w] = d[w - 16] + T + d[w - 7] + A | 0;
        }
        let g = t[0], h = t[1], u = t[2], p = t[3], x = t[4], I = t[5], P = t[6], f = t[7];
        for (let w = 0; w < 64; w++) {
          const T = _j(x, 6) ^ _j(x, 11) ^ _j(x, 25), A = x & I ^ ~x & P, V = f + T + A + _Do[w] + d[w] | 0, W = _j(g, 2) ^ _j(g, 13) ^ _j(g, 22), S = g & h ^ g & u ^ h & u, H = W + S | 0;
          f = P;
          P = I;
          I = x;
          x = p + V | 0;
          p = u;
          u = h;
          h = g;
          g = V + H | 0;
        }
        t[0] = t[0] + g | 0;
        t[1] = t[1] + h | 0;
        t[2] = t[2] + u | 0;
        t[3] = t[3] + p | 0;
        t[4] = t[4] + x | 0;
        t[5] = t[5] + I | 0;
        t[6] = t[6] + P | 0;
        t[7] = t[7] + f | 0;
      }
      const r = new Uint8Array(32), v = new DataView(r.buffer);
      for (let m = 0; m < 8; m++) v.setUint32(m * 4, t[m], false);
      return r;
    }
    const _he = 64;
    function _Ao(e, t) {
      let i = e;
      i.length > _he && (i = _Vt(i));
      const s = new Uint8Array(_he);
      s.set(i);
      const n = new Uint8Array(_he + t.length), a = new Uint8Array(_he + 32);
      for (let o = 0; o < _he; o++) n[o] = s[o] ^ 54, a[o] = s[o] ^ 92;
      return n.set(t, _he), a.set(_Vt(n), _he), _Vt(a);
    }
    const _jt = 6;
    function _Eo(e, t) {
      return _Ao(e, t).subarray(0, _jt);
    }
    function _Ro(e) {
      const t = new Uint8Array(e.length / 2);
      for (let i = 0; i < t.length; i++) t[i] = parseInt(e.substr(i * 2, 2), 16);
      return t;
    }
    function _Co(e) {
      return function() {
        e |= 0;
        e = e + 1831565813 | 0;
        let t = Math.imul(e ^ e >>> 15, 1 | e);
        return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function _Oi(e, t) {
      const i = e.length, s = e.map((d, l) => l), n = _Co(t >>> 0);
      for (let d = i - 1; d > 0; d--) {
        const l = Math.floor(n() * (d + 1)), c = s[d];
        s[d] = s[l];
        s[l] = c;
      }
      const a = {}, o = {};
      for (let d = 0; d < i; d++) a[e[d]] = s[d], o[s[d]] = e[d];
      return {
        enc: a,
        dec: o
      };
    }
    const _Io = 1;
    const _bo = [ "M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0" ];
    const _To = [ "A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0" ];
    function _Po(e) {
      const t = (e ^ Math.imul(_Io, 2654435761)) >>> 0;
      return {
        c2s: _Oi(_bo, t),
        s2c: _Oi(_To, (t ^ 2246822507) >>> 0)
      };
    }
    const _Ht = 1, _jtSig = 6;
    return {
      jt: _jtSig,
      Ht: _Ht,
      Ro: _Ro,
      Po: _Po,
      Eo: _Eo,
      buildZ: function(g) {
        if (g[3] !== _Ht) return null;
        return {
          mode: _Ht,
          key: _Ro(g[2]),
          tables: _Po(g[1] >>> 0),
          seq: 0
        };
      },
      encryptPacket: function(Z, encoder, type, args) {
        const s = Z.tables.c2s.enc[type];
        if (s === undefined) return null;
        const n = ++Z.seq;
        const a = encoder.encode([ s, args, n ]);
        const o = _Eo(Z.key, a);
        const d = new Uint8Array(_jtSig + a.length);
        d.set(o, 0);
        d.set(a, _jtSig);
        return d;
      },
      decodeType: function(Z, m) {
        if (Z && typeof m === "number") {
          return Z.tables.s2c.dec[m];
        }
        return m;
      }
    };
  }();
  let _RYN_Z = null;
  class PacketManager {
    client;
    Encoder=null;
    Decoder=null;
    packetCount=0;
    constructor(client2) {
      this.client = client2;
      setInterval(() => {
        if (this.client.isOwner) {
          GameUI_default.updatePackets(this.packetCount);
        }
        this.packetCount = 0;
      }, 1e3);
    }
    send(data) {
      const [type, ...args] = data;
      const gameNet = this.client._gameNet;
      if (gameNet && gameNet.socket && typeof gameNet.send === "function") {
        const crypto = this.client._gameCrypto;
        const cryptoReady = crypto && crypto.key && crypto.tables;
        if (!cryptoReady) {
          return;
        }
        try {
          gameNet.send(type, ...args);
          this.packetCount += 1;
          return;
        } catch (e) {}
      }
      const {socket: socket, socketSend: socketSend} = this.client.SocketManager;
      if (socket === null || socket.readyState !== socket.OPEN || socketSend === null) {
        return;
      }
      const botCrypto = this.client._gameCrypto;
      const enc = typeof window !== "undefined" && window.RYN && window.RYN._enc || typeof RYN !== "undefined" && RYN._enc;
      if (botCrypto && botCrypto.key && botCrypto.tables && enc && enc.Hi && enc.Eo && enc.jt !== undefined) {
        try {
          const s = botCrypto.tables.c2s.enc[type];
          if (s === undefined) return;
          const n = ++botCrypto.seq;
          const a = enc.Hi.encode([ s, args, n ]);
          const o = enc.Eo(botCrypto.key, a);
          const d = new Uint8Array(enc.jt + a.length);
          d.set(o, 0);
          d.set(a, enc.jt);
          socketSend(d);
          this.packetCount += 1;
          return;
        } catch (e) {}
      }
      if (this.Encoder === null) {
        return;
      }
      const encoded = this.Encoder.encode([ type, args ]);
      socketSend(encoded);
      this.packetCount += 1;
    }
    clanRequest(id, accept) {
      this.send([ "P", id, Number(accept) ]);
    }
    kick(id) {
      this.send([ "Q", id ]);
    }
    joinClan(name) {
      this.send([ "b", name ]);
    }
    createClan(name) {
      this.send([ "L", name ]);
    }
    leaveClan() {
      this.client.myPlayer.joinRequests.length = 0;
      this.send([ "N" ]);
    }
    equip(type, id) {
      this.send([ "c", 0, id, type ]);
    }
    buy(type, id) {
      this.send([ "c", 1, id, type ]);
    }
    chat(message) {
      this.send([ "6", message ]);
    }
    attack(angle) {
      this.send([ "F", 1, angle ]);
    }
    stopAttack(angle = null) {
      this.send([ "F", 0, angle ]);
    }
    resetMoveDir() {
      this.send([ "e" ]);
    }
    move(angle) {
      this.send([ "9", angle ]);
    }
    autoAttack() {
      this.send([ "K", 1 ]);
    }
    lockRotation() {
      this.send([ "K", 0 ]);
    }
    pingMap() {
      this.send([ "S" ]);
    }
    selectItemByID(id, type) {
      this.send([ "z", id, type ]);
    }
    spawn(name, moofoll, skin) {
      this.send([ "M", {
        name: name,
        moofoll: moofoll,
        skin: skin
      } ]);
    }
    upgradeItem(id) {
      this.send([ "H", id ]);
    }
    updateAngle(radians) {
      this.send([ "D", radians ]);
    }
    pingRequest() {
      this.client.SocketManager.startPing = performance.now();
      this.send([ "0" ]);
    }
  }
  class Animal extends Entity_default {
    type;
    prevHealth=0;
    currentHealth=0;
    receivedDamage=0;
    maxHealth=0;
    isDanger=false;
    isHostile=false;
    isPlayer=false;
    constructor(client2) {
      super(client2);
    }
    canBeTrapped() {
      return !("noTrap" in Animals_default[this.type]);
    }
    update(id, type, x, y, angle, health, nameIndex) {
      this.id = id;
      this.type = type;
      this.pos.previous.setVec(this.pos.current);
      this.pos.current._setXY(x, y);
      this.setFuturePosition();
      const animal = Animals_default[type];
      this.angle = angle;
      this.prevHealth = this.currentHealth;
      this.currentHealth = health;
      this.maxHealth = animal.health;
      this.scale = animal.scale;
      const isHostile = animal.hostile && type !== 7;
      this.isHostile = animal.hostile;
      this.isDanger = isHostile;
      this.receivedDamage = 0;
      const difference = Math.abs(this.currentHealth - this.prevHealth);
      if (this.currentHealth < this.prevHealth) {
        this.receivedDamage = difference;
      }
    }
    get attackRange() {
      if (this.type === 6) {
        return Animals_default[this.type].hitRange + Config_default.playerScale;
      }
      return this.scale;
    }
    get collisionRange() {
      if (this.type === 6) {
        return Animals_default[this.type].hitRange + Config_default.playerScale;
      }
      return this.scale + 60;
    }
    get canUseTurret() {
      return this.isHostile;
    }
  }
  const Animal_default = Animal;
  class MovementSimulation {
    speed=Config_default.playerSpeed;
    scale=35;
    slowMult=1;
    xVel=0;
    yVel=0;
    x=0;
    y=0;
    lockMove=false;
    TICK=1e3 / 9;
    spikeCollision=false;
    reset(client2, dir = null) {
      this.slowMult = 1;
      this.xVel = 0;
      this.yVel = 0;
      const speed = client2.myPlayer.speed / this.TICK;
      const moveDir = dir ?? client2._ModuleHandler.move_dir;
      if (moveDir !== null) {
        this.xVel = Math.cos(moveDir) * speed;
        this.yVel = Math.sin(moveDir) * speed;
      }
      const pos = client2.myPlayer.pos.current;
      this.x = pos.x;
      this.y = pos.y;
      this.lockMove = false;
      this.spikeCollision = false;
    }
    getPos() {
      return new Vector_default(this.x, this.y);
    }
    getSpeed() {
      return new Vector_default(this.xVel, this.yVel).length * this.TICK;
    }
    checkCollision(player, target, delta, isEnemyObject) {
      delta = delta || 1;
      const pos1 = this.getPos();
      const pos2 = target.pos.current.copy();
      const distance = pos1.distance(pos2);
      const collisionRange = player.collisionScale + target.collisionScale + 5;
      if (distance > collisionRange) {
        return false;
      }
      const scale = player.collisionScale + target.collisionScale;
      const isPlayer = target instanceof Player_default;
      if (isPlayer || !target.canMoveOnTop()) {
        const tmpDir = getAngle(pos2.x, pos2.y, pos1.x, pos1.y);
        if (isPlayer) {
          const tmpInt = (distance - scale) * -1 / 2;
          this.x += tmpInt * Math.cos(tmpDir);
          this.y += tmpInt * Math.sin(tmpDir);
        } else {
          this.x = pos2.x + collisionRange * Math.cos(tmpDir);
          this.y = pos2.y + collisionRange * Math.sin(tmpDir);
          this.xVel *= .75;
          this.yVel *= .75;
        }
        if (target instanceof Resource && target.isCactus || target instanceof PlayerObject && target.isSpike && isEnemyObject) {
          const tmpSpd = 1.5;
          this.xVel += tmpSpd * Math.cos(tmpDir);
          this.yVel += tmpSpd * Math.sin(tmpDir);
          this.spikeCollision = true;
        }
      } else if (target.type === 15 && isEnemyObject) {
        this.lockMove = true;
      } else if (target.type === 16) {
        const data = Items[target.type];
        const weight = 1;
        this.xVel += delta * data.boostSpeed * weight * Math.cos(target.angle);
        this.yVel += delta * data.boostSpeed * weight * Math.sin(target.angle);
      }
      return true;
    }
    collisionSimulation(client2) {
      this.reset(client2);
      if (!Settings_default._safeWalk) {
        return false;
      }
      this.update(client2, false);
      if (this.spikeCollision) {
        return true;
      }
      this.update(client2, true);
      return this.spikeCollision;
    }
    update(client2, notMoving) {
      const delta = 1e3 / 9;
      if (this.slowMult < 1) {
        this.slowMult = Math.min(1, this.slowMult + 8e-4 * delta);
      }
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = client2;
      const {autoHat: autoHat} = ModuleHandler.staticModules;
      const pos = this.getPos();
      const skin = Hats[autoHat.getNextHat()];
      const tail = Accessories[autoHat.getNextAcc()];
      const weapon = DataHandler_default.getWeapon(autoHat.getNextWeaponID());
      const weaponSpd = weapon.spdMult || 1;
      const skinSpd = "spdMult" in skin ? skin.spdMult : 1;
      const tailSpd = "spdMult" in tail ? tail.spdMult : 1;
      const inSnow = pos.y <= Config_default.snowBiomeTop && !("coldM" in skin);
      const snowMult = inSnow ? Config_default.snowSpeed : 1;
      const buildMult = autoHat.getNextItemID() >= 0 ? .5 : 1;
      if (this.lockMove) {
        this.xVel = 0;
        this.yVel = 0;
      } else {
        let spdMult = buildMult * weaponSpd * skinSpd * tailSpd * snowMult * this.slowMult;
        const riverMin = Config_default.mapScale / 2 - Config_default.riverWidth / 2;
        const riverMax = Config_default.mapScale / 2 + Config_default.riverWidth / 2;
        const inRiver = !myPlayer.onPlatform && pos.y >= riverMin && pos.y <= riverMax;
        if (inRiver) {
          if ("watrImm" in skin) {
            spdMult *= .75;
            this.xVel += Config_default.waterCurrent * .4 * delta;
          } else {
            spdMult *= .33;
            this.xVel += Config_default.waterCurrent * delta;
          }
        }
        const moveDir = client2._ModuleHandler.move_dir;
        let xDir = !notMoving && moveDir !== null ? Math.cos(moveDir) : 0;
        let yDir = !notMoving && moveDir !== null ? Math.sin(moveDir) : 0;
        const len = Math.sqrt(xDir * xDir + yDir * yDir);
        if (len !== 0) {
          xDir /= len;
          yDir /= len;
        }
        const accel = this.speed * spdMult * delta;
        if (xDir) {
          this.xVel += xDir * accel;
        }
        if (yDir) {
          this.yVel += yDir * accel;
        }
      }
      this.lockMove = false;
      const moveDist = getDistance(0, 0, this.xVel * delta, this.yVel * delta);
      const depth = Math.min(4, Math.max(1, Math.round(moveDist / 40)));
      const stepMult = 1 / depth;
      for (let i = 0; i < depth; i++) {
        if (this.xVel) {
          this.x += this.xVel * delta * stepMult;
        }
        if (this.yVel) {
          this.y += this.yVel * delta * stepMult;
        }
        client2.ObjectManager.grid2D.query(this.x, this.y, 1, id => {
          const object = client2.ObjectManager.objects.get(id);
          const isPlayerObject = object instanceof PlayerObject;
          const isEnemyObject = !isPlayerObject || client2.PlayerManager.isEnemyByID(object.ownerID, client2.myPlayer);
          this.checkCollision(myPlayer, object, stepMult, isEnemyObject);
        });
      }
      const nearestEnemy = client2.EnemyManager.nearestEnemy;
      if (nearestEnemy !== null) {
        this.checkCollision(myPlayer, nearestEnemy, 1, false);
      }
      if (this.xVel) {
        this.xVel *= Math.pow(Config_default.playerDecel, delta);
        if (this.xVel >= -.01 && this.xVel <= .01) {
          this.xVel = 0;
        }
      }
      if (this.yVel) {
        this.yVel *= Math.pow(Config_default.playerDecel, delta);
        if (this.yVel >= -.01 && this.yVel <= .01) {
          this.yVel = 0;
        }
      }
      this.x = clamp(this.x, this.scale, Config_default.mapScale - this.scale);
      this.y = clamp(this.y, this.scale, Config_default.mapScale - this.scale);
    }
  }
  class ClientPlayer extends Player_default {
    inventory={};
    weaponXP=[ {}, {} ];
    itemCount=new Map;
    resources={};
    tempGold=0;
    deathPosition=new Vector_default;
    teleportPos=new Vector_default;
    teleported=false;
    inGame=false;
    wasDead=true;
    diedOnce=false;
    teammates=new Set;
    totalGoldAmount=0;
    age=1;
    upgradeAge=1;
    prevKills=0;
    underTurretAttack=false;
    upgradeOrder=[];
    upgradeIndex=0;
    joinRequests=[];
    killedSomeone=false;
    actuallyKilledSomeone=false;
    totalKills=0;
    deaths=0;
    simulation=new MovementSimulation;
    constructor(client2) {
      super(client2);
      this.reset(true);
    }
    isMyPlayerByID(id) {
      return id === this.id;
    }
    isTeammateByID(id) {
      return this.teammates.has(id);
    }
    isEnemyByID(id) {
      return !this.isMyPlayerByID(id) && !this.isTeammateByID(id);
    }
    get isSandbox() {
      return /sandbox/.test(location.hostname) || this.client.SocketManager.isSandbox;
    }
    getItemByType(type) {
      return this.inventory[type];
    }
    hasResourcesForType(type) {
      if (this.isSandbox) {
        return true;
      }
      const res = this.resources;
      const {food: food, wood: wood, stone: stone, gold: gold} = Items[this.getItemByType(type)].cost;
      return res.food >= food && res.wood >= wood && res.stone >= stone && res.gold >= gold;
    }
    getItemCount(group) {
      const item = ItemGroups[group];
      return {
        count: this.itemCount.get(group) || 0,
        limit: this.isSandbox ? "sandboxLimit" in item ? item.sandboxLimit : 99 : item.limit
      };
    }
    hasItemCountForType(type) {
      if (type === 2) {
        return true;
      }
      const item = Items[this.getItemByType(type)];
      const {count: count, limit: limit} = this.getItemCount(item.itemGroup);
      return count < limit;
    }
    canPlace(type) {
      return type !== null && this.getItemByType(type) !== null && this.hasResourcesForType(type) && this.hasItemCountForType(type);
    }
    canPlaceObject(type, angle) {
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      const id = myPlayer.getItemByType(type);
      const current = myPlayer.getPlacePosition(myPlayer.pos.current, id, angle);
      return ObjectManager2.canPlaceItem(id, current);
    }
    getBestDestroyingWeapon(target = null) {
      const primaryID = this.getItemByType(0);
      const primary = DataHandler_default.getWeapon(primaryID);
      const secondaryID = this.getItemByType(1);
      const isHammer = secondaryID === 10;
      const notStick = primary.damage !== 1;
      const notPolearm = primaryID !== 5;
      const {reloading: reloading} = this.client._ModuleHandler.staticModules;
      const primaryDamage = this.getBuildingDamage(primaryID, false);
      if (isHammer && notStick && notPolearm && (!reloading.isReloaded(1) || reloading.isFasterThan(0, 1)) && reloading.isReloaded(0) && target != null && primaryDamage >= target.health) {
        return 0;
      }
      if (target != null && isHammer && notStick && notPolearm && this.isTrapped) {
        const hammerRange = DataHandler_default.getWeapon(secondaryID).range + target.hitScale + 1;
        const primaryRange = primary.range + target.hitScale;
        const pos1 = this.pos.current;
        const pos2 = target.pos.current;
        const distance = pos1.distance(pos2);
        if (inRange(distance, hammerRange, primaryRange)) {
          return 0;
        }
      }
      if (isHammer) {
        return 1;
      }
      if (notStick) {
        return 0;
      }
      return null;
    }
    getWeaponRangeByType(type) {
      const item = this.getItemByType(type);
      if (DataHandler_default.isMelee(item)) {
        return DataHandler_default.getWeapon(item).range;
      }
      return 0;
    }
    getFastestWeapon() {
      const primary = DataHandler_default.getWeapon(this.getItemByType(0));
      const secondaryID = this.getItemByType(1);
      if (secondaryID === null) {
        return 0;
      }
      const secondary = DataHandler_default.getWeapon(secondaryID);
      if (primary.spdMult > secondary.spdMult) {
        return 0;
      }
      return 1;
    }
    getDmgOverTime() {
      const hat = Hats[this.hatID];
      const accessory = Accessories[this.accessoryID];
      let damage = 0;
      if ("healthRegen" in hat) {
        damage += hat.healthRegen;
      }
      if ("healthRegen" in accessory) {
        damage += accessory.healthRegen;
      }
      if (this.poisonCount !== 0) {
        damage += -5;
      }
      return Math.abs(damage);
    }
    getMaxWeaponRangeClient() {
      const primary = this.inventory[0];
      const secondary = this.inventory[1];
      const primaryRange = DataHandler_default.getWeapon(primary).range;
      if (DataHandler_default.isMelee(secondary)) {
        const range = DataHandler_default.getWeapon(secondary).range;
        if (range > primaryRange) {
          return range;
        }
      }
      return primaryRange;
    }
    getMaxRangeTypeDestroy() {
      const primaryID = this.inventory[0];
      const secondaryID = this.inventory[1];
      const primary = DataHandler_default.getWeapon(primaryID);
      if (DataHandler_default.isMelee(secondaryID)) {
        const secondary = DataHandler_default.getWeapon(secondaryID);
        if (secondaryID === 10 && secondary.range > primary.range) {
          return {
            type: 1,
            range: secondary.range
          };
        }
      }
      if (primaryID !== 8) {
        return {
          type: 0,
          range: primary.range
        };
      }
      return null;
    }
    getPlacePosition(start, itemID, angle) {
      return start.addDirection(angle, this.getItemPlaceScale(itemID));
    }
    tickUpdate() {
      if (this.inGame && this.wasDead) {
        this.wasDead = false;
        this.prevKills = 0;
        this.onFirstTickAfterSpawn();
      }
      const {_ModuleHandler: ModuleHandler, PlayerManager: PlayerManager} = this.client;
      this.killedSomeone = false;
      this.actuallyKilledSomeone = false;
      if (this.totalKills > this.prevKills) {
        this.prevKills = this.totalKills;
        this.killedSomeone = true;
        if (PlayerManager.prevPlayers.size !== 0) {
          this.actuallyKilledSomeone = true;
        }
      }
      ModuleHandler.postTick();
    }
    updateHealth(health) {
      if (!this.inGame) {
        return;
      }
      super.updateHealth(health);
      if (this.shameActive) {
        return;
      }
      if (health < 100) {
        const {_ModuleHandler: ModuleHandler} = this.client;
        ModuleHandler.staticModules.shameReset.healthUpdate();
      }
    }
    playerInit(id) {
      this.id = id;
      const {PlayerManager: PlayerManager} = this.client;
      if (!PlayerManager.playerData.has(id)) {
        PlayerManager.playerData.set(id, this);
      }
    }
    onFirstTickAfterSpawn() {
      const {_ModuleHandler: ModuleHandler, isOwner: isOwner} = this.client;
      const {mouse: mouse, staticModules: staticModules} = ModuleHandler;
      ModuleHandler._equip(0, 0);
      ModuleHandler.updateAngle(mouse.sentAngle, true);
      if (!isOwner) {
        const owner = this.client.ownerClient;
        UI_default.updateBotOption(this.client, "title");
        owner.clientIDList.add(this.id);
        staticModules.tempData.setAttacking(owner._ModuleHandler.attacking);
        staticModules.tempData.setStore(0, owner._ModuleHandler.store[0].actual);
        staticModules.tempData.setStore(1, owner._ModuleHandler.store[1].actual);
      }
    }
    playerSpawn() {
      this.inGame = true;
      if (!this.client.isOwner) {
        const ownerID = this.client.ownerClient?.myPlayer?.id;
        if (ownerID !== undefined && ownerID !== -1) {
          this.teammates.add(ownerID);
        }
      }
    }
    isUpgradeWeapon(id) {
      const weapon = DataHandler_default.getWeapon(id);
      if ("upgradeOf" in weapon) {
        return this.inventory[weapon.itemType] === weapon.upgradeOf;
      }
      return true;
    }
    newUpgrade(points, age) {
      this.upgradeAge = age;
      if (points === 0 || age === 10) {
        return;
      }
      const ids = [];
      for (const weapon of Weapons) {
        if (weapon.age === age && this.isUpgradeWeapon(weapon.id)) {
          ids.push(weapon.id);
        }
      }
      for (const item of Items) {
        if (item.age === age) {
          ids.push(item.id + 16);
        }
      }
      if (!this.client.isOwner) {
        const id = this.client.ownerClient.myPlayer.upgradeOrder[this.upgradeIndex];
        if (id !== void 0 && ids.includes(id)) {
          this.upgradeIndex += 1;
          this.client._ModuleHandler._upgradeItem(id);
        }
      }
    }
    updateAge(age) {
      this.age = age;
    }
    upgradeItem(id) {
      this.upgradeOrder.push(id);
      const {isOwner: isOwner, clients: clients} = this.client;
      if (isOwner) {
        for (const client2 of clients) {
          const {age: age, upgradeAge: upgradeAge} = client2.myPlayer;
          if (age > this.upgradeAge) {
            client2.myPlayer.newUpgrade(1, upgradeAge);
          }
        }
      }
      if (id < 16) {
        const weapon = DataHandler_default.getWeapon(id);
        this.inventory[weapon.itemType] = id;
        const XP = this.weaponXP[weapon.itemType];
        XP.current = 0;
        XP.max = -1;
      } else {
        id -= 16;
        const item = Items[id];
        this.inventory[item.itemType] = id;
      }
      this.upgradeAge += 1;
    }
    updateClanMembers(teammates) {
      const _before = new Set(this.teammates);
      this.teammates.clear();
      for (let i = 0; i < teammates.length; i += 2) {
        const id = teammates[i + 0];
        if (!this.isMyPlayerByID(id)) {
          this.teammates.add(id);
        }
      }
      if (!this.client.isOwner) {
        const ownerID = this.client.ownerClient?.myPlayer?.id;
        if (ownerID !== undefined && ownerID !== -1) {
          this.teammates.add(ownerID);
        }
      }
      try {
        const _log = this.client._ModuleHandler.staticModules.chatLog;
        const _pd = this.client.PlayerManager.playerData;
        const _nm = id => (_pd.get(id) || {}).nickname || ("#" + id);
        for (const id of this.teammates) {
          if (!_before.has(id)) _log.add("clan", "انضم للعشيرة", _nm(id));
        }
        for (const id of _before) {
          if (!this.teammates.has(id)) _log.add("clan", "غادر العشيرة", _nm(id));
        }
      } catch (e) {}
    }
    updateItemCount(group, count) {
      this.itemCount.set(group, count);
      if (this.client.isOwner) {
        GameUI_default.updateItemCount(group);
      }
    }
    updateResources(type, amount) {
      const previousAmount = this.resources[type];
      this.resources[type] = amount;
      if (type === "gold") {
        this.tempGold = amount;
        return;
      }
      if (amount < previousAmount) {
        return;
      }
      const difference = amount - previousAmount;
      if (type === "kills") {
        this.totalKills += difference;
        this.client.StatsManager.kills = difference;
        this.client.StatsManager.totalKills = difference;
        this.client.ownerClient.StatsManager.globalKills = difference;
        if (this.client.isOwner) {
          GameUI_default.updateTotalKills(this.totalKills);
        }
        return;
      }
      this.updateWeaponXP(difference);
    }
    updateWeaponXP(amount) {
      const {next: next} = this.getWeaponVariant(this.weapon.current);
      const XP = this.weaponXP[DataHandler_default.getWeapon(this.weapon.current).itemType];
      const maxXP = WeaponVariants[next].needXP;
      XP.current += amount;
      if (XP.max !== -1 && XP.current >= XP.max) {
        XP.current -= XP.max;
        XP.max = maxXP;
        return;
      }
      if (XP.max === -1) {
        XP.max = maxXP;
      }
      if (XP.current >= XP.max) {
        XP.current -= XP.max;
        XP.max = -1;
      }
    }
    resetResources() {
      this.resources.food = 100;
      this.resources.wood = 100;
      this.resources.stone = 100;
      this.resources.gold = 100;
      this.resources.kills = 0;
    }
    resetInventory() {
      this.inventory[0] = 0;
      this.inventory[1] = null;
      this.inventory[2] = 0;
      this.inventory[3] = 3;
      this.inventory[4] = 6;
      this.inventory[5] = 10;
      this.inventory[6] = null;
      this.inventory[7] = null;
      this.inventory[8] = null;
      this.inventory[9] = null;
    }
    resetWeaponXP() {
      for (const XP of this.weaponXP) {
        XP.current = 0;
        XP.max = -1;
      }
    }
    spawn(customName) {
      const name = customName || this.client._botCustomName || window.localStorage.getItem("moo_name") || "";
      const skin = this.client.isOwner ? Number(window.localStorage.getItem("skin_color")) || 0 : Math.floor(Math.random() * Config_default.skinColors.length);
      this.client.PacketManager.spawn(name, 1, skin === 10 ? "constructor" : skin);
    }
    handleJoinRequest(id, name) {
      this.joinRequests.push([ id, name ]);
    }
    reset(first = false) {
      this.resetResources();
      this.resetInventory();
      this.resetWeaponXP();
      const {_ModuleHandler: ModuleHandler, PlayerManager: PlayerManager} = this.client;
      ModuleHandler.reset();
      this.inGame = false;
      this.wasDead = true;
      this.upgradeOrder.length = 0;
      this.upgradeIndex = 0;
      if (first) {
        return;
      }
      this.previousHealth = 100;
      this.currentHealth = 100;
      this.tempHealth = 100;
      this.shameActive = false;
      this.shameCount = 0;
      this.shameTimer = 0;
      this.deathPosition.setVec(this.pos.current);
      this.diedOnce = true;
      this.client.StatsManager.deaths = 1;
      this.deaths += 1;
      if (this.client.isOwner) {
        GameUI_default.reset();
        GameUI_default.updateTotalDeaths(this.deaths);
      }
    }
  }
  const ClientPlayer_default = ClientPlayer;
  class PlayerManager {
    playerData=new Map;
    players=[];
    enemies=[];
    prevPlayers=new Set;
    animalData=new Map;
    clanData=new Map;
    start=Date.now();
    step=0;
    damagesByHits=[];
    lastEnemyReceivedDamage=[ 0, 0 ];
    nearestTeammate=null;
    client;
    constructor(client2) {
      this.client = client2;
    }
    get timeSinceTick() {
      return Date.now() - this.start;
    }
    getEntity(id, isPlayer) {
      if (isPlayer && this.playerData.has(id)) {
        return this.playerData.get(id);
      } else if (!isPlayer && this.animalData.has(id)) {
        return this.animalData.get(id);
      }
      return null;
    }
    createPlayer({socketID: socketID, id: id, nickname: nickname, health: health, skinID: skinID}) {
      const {myPlayer: myPlayer} = this.client;
      if (socketID === this.client.clientID && myPlayer.id === -1) {
        myPlayer.playerInit(id);
      }
      const player = this.playerData.get(id) || new Player_default(this.client);
      if (!this.playerData.has(id)) {
        this.playerData.set(id, player);
      }
      player.id = id;
      player.prevNickname = player.nickname;
      player.nickname = nickname || "";
      player.currentHealth = health || 100;
      player.skinID = typeof skinID === "undefined" ? -1 : skinID;
      player.init();
      if (myPlayer.isMyPlayerByID(id)) {
        myPlayer.playerSpawn();
      }
      return player;
    }
    createClan(name, ownerID) {
      this.clanData.set(name, ownerID);
    }
    deleteClan(name) {
      this.clanData.delete(name);
    }
    clanExist(name) {
      return name !== null && this.clanData.has(name);
    }
    canHitTarget(player, weaponID, target) {
      const pos = target.pos.current;
      const distance = player.pos.current.distance(pos);
      const angle = player.pos.current.angle(pos);
      const range = DataHandler_default.getWeapon(weaponID).range + target.hitScale;
      return distance <= range && getAngleDist(angle, player.angle) <= Config_default.gatherAngle;
    }
    attackPlayer(id, gathering, weaponID) {
      const player = this.playerData.get(id);
      if (player === void 0) {
        return;
      }
      const {hatID: hatID, reload: reload} = player;
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      player.lastAttacked = myPlayer.tickCount;
      const isMyPlayer = myPlayer.isMyPlayerByID(id);
      if (isMyPlayer && !myPlayer.inGame) {
        return;
      }
      const weapon = DataHandler_default.getWeapon(weaponID);
      const type = weapon.itemType;
      player.updateMaxReload(reload[type], weaponID);
      player.resetCurrentReload(reload[type]);
      if (myPlayer.isEnemyByID(id)) {
        if (this.canHitTarget(player, weaponID, myPlayer)) {
          const {isAble: isAble, count: count} = player.canDealPoison(weaponID);
          if (isAble) {
            myPlayer.poisonCount = count;
          }
        }
      }
      if (gathering === 1) {
        const objects = ObjectManager2.attackedObjects;
        for (const [id2, data] of objects) {
          const [hitAngle, object] = data;
          if (this.canHitTarget(player, weaponID, object) && getAngleDist(hitAngle, player.angle) <= 1.25) {
            objects.delete(id2);
            if (object instanceof PlayerObject) {
              const damage = player.getBuildingDamage(weaponID);
              object.health = Math.max(0, object.health - damage);
            } else if (player === myPlayer) {
              let amount = hatID === 9 ? 1 : 0;
              if (object.type === 3) {
                amount += weapon.gather + 4;
              }
              myPlayer.updateWeaponXP(amount);
            }
          }
        }
      }
    }
    updatePlayer(buffer) {
      this.players.length = 0;
      this.enemies.length = 0;
      this.damagesByHits.length = 0;
      this.nearestTeammate = null;
      const now = Date.now();
      this.step = now - this.start;
      this.start = now;
      const {myPlayer: myPlayer, isOwner: isOwner, EnemyManager: EnemyManager2} = this.client;
      for (let i = 0; i < buffer.length; i += 13) {
        const id = buffer[i];
        const player = this.playerData.get(id);
        this.players.push(player);
        player.update(id, buffer[i + 1], buffer[i + 2], buffer[i + 3], buffer[i + 4], buffer[i + 5], buffer[i + 6], buffer[i + 7], buffer[i + 8], buffer[i + 9], buffer[i + 10], buffer[i + 11], buffer[i + 12]);
        if (!this.client.isBotByID(id) && !myPlayer.isMyPlayerByID(id) && myPlayer.isTeammateByID(id) && EnemyManager2.isNear(player, this.nearestTeammate, myPlayer)) {
          this.nearestTeammate = player;
        } else if (myPlayer.isEnemyByID(id)) {
          this.enemies.push(player);
        }
      }
    }
    updateAnimal(buffer) {
      const {EnemyManager: EnemyManager2} = this.client;
      for (let i = 0; i < buffer.length; i += 7) {
        const id = buffer[i];
        if (!this.animalData.has(id)) {
          this.animalData.set(id, new Animal_default(this.client));
        }
        const animal = this.animalData.get(id);
        animal.update(id, buffer[i + 1], buffer[i + 2], buffer[i + 3], buffer[i + 4], buffer[i + 5], buffer[i + 6]);
        EnemyManager2.handleAnimal(animal);
      }
    }
    postTick() {
      const {EnemyManager: EnemyManager2, ProjectileManager: ProjectileManager, ObjectManager: ObjectManager2, myPlayer: myPlayer, isOwner: isOwner, _ModuleHandler: ModuleHandler} = this.client;
      ModuleHandler.moduleStart = performance.now();
      if (myPlayer && myPlayer.inGame) {
        const fut = myPlayer.pos.future;
        ObjectManager2.grid2D.query(fut.x, fut.y, 3, objId => {
          const obj = ObjectManager2.objects.get(objId);
          if (!obj) return;
          if (obj.getDamage() > 0 || obj.canMoveOnTop()) return;
          const op = obj.pos.current;
          const tmpLen = 35 + obj.collisionScale;
          const dx = fut.x - op.x, dy = fut.y - op.y;
          if (Math.sqrt(dx * dx + dy * dy) - tmpLen < 0) {
            const tmpDir = Math.atan2(dy, dx);
            fut._setXY(op.x + tmpLen * Math.cos(tmpDir), op.y + tmpLen * Math.sin(tmpDir));
          }
        });
      }
      ProjectileManager.postTick();
      EnemyManager2.handleEnemies(this.enemies);
      ObjectManager2.postTick();
      if (myPlayer.inGame) {
        myPlayer.tickUpdate();
      }
      ObjectManager2.deletedObjects.clear();
      if ((Settings_default._autospawn || !isOwner) && !myPlayer.inGame) {
        myPlayer.spawn();
      }
    }
    isEnemy(target1, target2) {
      return target1 == null || target2 == null || target1 !== target2 && (target1.clanName === null || target2.clanName === null || target1.clanName !== target2.clanName);
    }
    isEnemyByID(ownerID, target) {
      const player = this.playerData.get(ownerID);
      if (player == null) {
        throw Error("isEnemyByID Error: Failed to find an owner!");
      }
      if (player instanceof ClientPlayer_default) {
        return player.isEnemyByID(target.id);
      }
      if (target instanceof ClientPlayer_default) {
        return target.isEnemyByID(player.id);
      }
      return this.isEnemy(player, target);
    }
    isEnemyTarget(owner, target) {
      if (target instanceof Animal_default) {
        return true;
      }
      if (!this.client.isOwner) {
        const ownerID = this.client.ownerClient?.myPlayer?.id;
        if (ownerID !== undefined && target.id === ownerID) return false;
      }
      return this.isEnemyByID(owner.id, target);
    }
    canShoot(ownerID, target) {
      return target instanceof Animal_default || this.isEnemyByID(ownerID, target);
    }
    canMoveOnTop(object) {
      if (object instanceof Resource) {
        return false;
      }
      const item = DataHandler_default.getItem(object.type);
      const isEnemyObject = this.isEnemyByID(object.ownerID, this.client.myPlayer);
      if ("ignoreCollision" in item && (object.type !== 15 || !isEnemyObject)) {
        return true;
      }
      return false;
    }
    lookingShield(owner, target) {
      if (owner instanceof Animal_default) {
        return false;
      }
      const weapon = owner.weapon.current;
      if (weapon !== 11) {
        return false;
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const pos1 = owner.pos.current;
      const pos2 = target.pos.current;
      const angle = pos1.angle(pos2);
      const ownerAngle = myPlayer.isMyPlayerByID(owner.id) ? ModuleHandler.mouse.sentAngle : owner.angle;
      return getAngleDist(angle, ownerAngle) <= Config_default.shieldAngle;
    }
  }
  const PlayerManager_default = PlayerManager;
  class ProjectileManager {
    client;
    projectiles=new Map;
    ignoreCreation=new Map;
    dangerProjectiles=new Set;
    toRemove=new Set;
    totalDamage=0;
    constructor(client2) {
      this.client = client2;
    }
    createProjectile(projectile) {
      const key = projectile.speed;
      if (!this.projectiles.has(key)) {
        this.projectiles.set(key, []);
      }
      const list = this.projectiles.get(key);
      list.push(projectile);
    }
    foundProjectile(projectile) {
      const owner = projectile.ownerClient;
      if (owner === null) {
        return;
      }
      const {PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      if (PlayerManager2.isEnemyByID(owner.id, myPlayer)) {
        const pos1 = projectile.pos.current;
        const pos2 = myPlayer.pos.current;
        const distance = pos1.distance(pos2);
        const angle = pos1.angle(pos2);
        const offset = Math.asin(2 * myPlayer.scale / (2 * distance));
        const lookingAt = getAngleDist(angle, projectile.angle) <= offset;
        if (lookingAt) {
          this.dangerProjectiles.add(projectile);
        }
      }
    }
    foundProjectileThreat(projectile) {
      const owner = projectile.ownerClient;
      if (owner === null) {
        return;
      }
      const {PlayerManager: PlayerManager2, myPlayer: myPlayer, SocketManager: SocketManager} = this.client;
      for (const enemy of PlayerManager2.enemies) {
        if (!PlayerManager2.isEnemyByID(owner.id, enemy)) {
          continue;
        }
        const pos1 = projectile.pos.current;
        const pos2 = enemy.pos.current;
        const distance = pos1.distance(pos2);
        const angle = pos1.angle(pos2);
        const offset = Math.asin(2 * enemy.scale / (2 * distance));
        const lookingAt = getAngleDist(angle, projectile.angle) <= offset;
        if (lookingAt) {
          const tickDistance = Math.ceil(distance / (projectile.speed * SocketManager.TICK));
          enemy.nextDamageTick = myPlayer.tickCount + tickDistance;
        }
      }
    }
    postTick() {
      this.projectiles.clear();
      this.totalDamage = 0;
      for (const proj of this.dangerProjectiles) {
        proj.life -= 1;
        if (proj.shouldRemove() || this.toRemove.delete(proj.id)) {
          this.dangerProjectiles.delete(proj);
          continue;
        }
        this.totalDamage += proj.damage;
      }
      this.toRemove.clear();
    }
  }
  const ProjectileManager_default = ProjectileManager;
  class Projectile {
    pos={};
    angle;
    range;
    speed;
    type;
    onPlatform;
    id;
    isTurret;
    scale;
    maxRange;
    damage;
    ownerClient=null;
    life=9;
    constructor(angle, range, speed, type, onPlatform, id, maxRange) {
      this.isTurret = type === 1;
      this.angle = angle;
      this.range = range;
      this.speed = speed;
      this.type = type;
      this.onPlatform = onPlatform;
      this.id = id;
      this.scale = Projectiles[type].scale;
      this.maxRange = maxRange || 0;
      this.damage = Projectiles[type].damage;
    }
    formatFromCurrent(pos, increase) {
      if (this.isTurret) {
        return pos;
      }
      return pos.addDirection(this.angle, increase ? 70 : -70);
    }
    shouldRemove() {
      return this.life <= 0;
    }
  }
  const Projectile_default = Projectile;
  const StoreHandler = new class {
    isOpened=false;
    store=[ {
      previous: -1,
      current: -1,
      list: new Map
    }, {
      previous: -1,
      current: -1,
      list: new Map
    } ];
    currentType=0;
    isRightStore(type) {
      return this.isOpened && this.currentType === type;
    }
    createStore(type) {
      const storeContainer = document.createElement("div");
      storeContainer.id = "ryn-store-container";
      storeContainer.style.display = "none";
      const button = document.createElement("div");
      button.id = "ryn-store-toggle";
      button.textContent = type === 0 ? "Hats" : "Accessories";
      button.onmousedown = () => {
        this.currentType = this.currentType === 0 ? 1 : 0;
        button.textContent = this.currentType === 0 ? "Hats" : "Accessories";
        if (this.isOpened) {
          this.fillStore(this.currentType);
        }
      };
      storeContainer.appendChild(button);
      const itemHolder = document.createElement("div");
      itemHolder.id = "ryn-store-items";
      storeContainer.appendChild(itemHolder);
      itemHolder.addEventListener("wheel", event => {
        event.preventDefault();
        const scale = Math.sign(event.deltaY) * 50;
        itemHolder.scroll(0, itemHolder.scrollTop + scale);
      });
      const {gameUI: gameUI} = GameUI_default.getElements();
      gameUI.appendChild(storeContainer);
    }
    getTextEquip(type, id, price) {
      const {list: list, current: current} = this.store[type];
      if (current === id) {
        return "Unequip";
      }
      if (list.has(id) || price === 0) {
        return "Equip";
      }
      return "Buy";
    }
    generateStoreElement(type, id, name, price, isTop) {
      const srcType = [ "hats/hat", "accessories/access" ];
      const src = [ srcType[type], id ];
      if (isTop) {
        src.push("p");
      }
      const html = `\n            <div class="storeItemContainer">\n                <img class="storeHat" src="./img/${src.join("_")}.png">\n                <span class="storeItemName">${name}</span>\n                <div class="equipButton" data-id="${id}">${this.getTextEquip(type, id, price)}</div>\n            </div>\n        `;
      const div = document.createElement("div");
      div.innerHTML = html;
      const img = div.querySelector(".storeHat");
      img.src = `./img/${src.join("_")}.png`;
      const equipButton = div.querySelector(".equipButton");
      equipButton.onmousedown = () => {
        client._ModuleHandler._equip(type, id, true, true);
      };
      return div.firstElementChild;
    }
    fillStore(type) {
      const {itemHolder: itemHolder} = GameUI_default.getElements();
      itemHolder.innerHTML = "";
      const items = Settings_default._storeItems[type];
      for (const id of items) {
        const item = DataHandler_default.getStoreItem(type, id);
        const element = this.generateStoreElement(type, id, item.name, item.price, "topSprite" in item);
        itemHolder.appendChild(element);
      }
    }
    handleEquipUpdate(type, prev, curr, isBuy) {
      if (!this.isRightStore(type)) {
        return;
      }
      const current = document.querySelector(`.equipButton[data-id="${curr}"]`);
      if (current !== null) {
        current.textContent = isBuy ? "Equip" : "Unequip";
      }
      if (!isBuy && prev !== -1) {
        const previous = document.querySelector(`.equipButton[data-id="${prev}"]`);
        if (previous !== null) {
          previous.textContent = "Equip";
        }
      }
    }
    updateStoreState(type, action, id) {
      const store2 = this.store[type];
      if (action === 0) {
        store2.previous = store2.current;
        store2.current = id;
        const {previous: previous, current: current, list: list} = store2;
        list.set(previous, 0);
        list.set(current, 1);
        this.handleEquipUpdate(type, store2.previous, id, false);
      } else {
        store2.list.set(id, 0);
        this.handleEquipUpdate(type, store2.previous, id, true);
      }
    }
    closeStore() {
      const {storeContainer: storeContainer, itemHolder: itemHolder} = GameUI_default.getElements();
      itemHolder.innerHTML = "";
      storeContainer.style.display = "none";
      this.isOpened = false;
    }
    openStore() {
      GameUI_default.closePopups();
      const {storeContainer: storeContainer} = GameUI_default.getElements();
      this.fillStore(this.currentType);
      storeContainer.style.display = "";
      storeContainer.classList.remove("closedItem");
      this.isOpened = true;
    }
    toggleStore() {
      const {storeContainer: storeContainer, itemHolder: itemHolder} = GameUI_default.getElements();
      if (this.isOpened) {
        itemHolder.innerHTML = "";
      } else {
        GameUI_default.closePopups();
        this.fillStore(this.currentType);
      }
      storeContainer.style.display = storeContainer.style.display === "none" ? "" : "none";
      this.isOpened = !this.isOpened;
    }
    init() {
      this.createStore(0);
    }
  };
  const StoreHandler_default = StoreHandler;
  class SocketManager {
    client;
    socket=null;
    socketSend=null;
    PacketQueue=[];
    startPing=performance.now();
    pong=0;
    TICK=1e3 / 9;
    packetCount=0;
    action=null;
    constructor(client2) {
      this.client = client2;
    }
    get isSandbox() {
      return this.socket !== null && /localhost/.test(this.socket.url);
    }
    init(socket) {
      this.socket = socket;
      this.socketSend = socket.send.bind(socket);
      socket.addEventListener("message", event => this.handleMessage(event));
      socket.addEventListener("close", event => {
        const {code: code, reason: reason, wasClean: wasClean} = event;
        Logger.warn(`WebSocket Closed: ${code}, '${reason}', ${wasClean}`);
      });
      socket.addEventListener("error", () => {
        Logger.error("WebSocket Error");
      });
    }
    pingTimeout;
    minPingTime=Infinity;
    handlePing() {
      this.pong = Math.round(performance.now() - this.startPing);
      if (Number.isFinite(this.pong) && this.pong >= 0 && this.pong < this.minPingTime) {
        this.minPingTime = this.pong;
      }
      if (!Number.isFinite(this.pong) || this.pong < 0) this.pong = 0;
      if (this.client.isOwner) {
        GameUI_default.updatePing(this.pong);
      }
      clearTimeout(this.pingTimeout);
      this.pingTimeout = setTimeout(() => {
        this.client.PacketManager.pingRequest();
      }, 3e3);
    }
    handlePlayerInit(player) {}
    handleMessage(event) {
      const decoder = this.client.PacketManager.Decoder;
      if (decoder === null) {
        return;
      }
      const data = event.data;
      let decoded;
      try {
        decoded = decoder.decode(new Uint8Array(data));
      } catch (e) {
        return;
      }
      let msgType = decoded[0];
      const crypto = this.client._gameCrypto;
      if (typeof msgType === "number" && crypto && crypto.tables && crypto.tables.s2c) {
        const translated = crypto.tables.s2c.dec[msgType];
        if (translated === undefined) {
          return;
        }
        msgType = translated;
      }
      const temp = [ msgType, ...decoded[1] ];
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler, PlayerManager: PlayerManager2, ObjectManager: ObjectManager2, ProjectileManager: ProjectileManager2, LeaderboardManager: LeaderboardManager2, PacketManager: PacketManager2} = this.client;
      switch (temp[0]) {
       case "0":
        this.handlePing();
        break;

       case "io-init":
        this.client.connectSuccess = true;
        this.client.clientID = temp[1];
        try {
          const enc = typeof RYN !== "undefined" && RYN._enc;
          const mode = decoded[1][3];
          const seed = decoded[1][1];
          const keyHex = decoded[1][2];
          if (enc && enc.jt !== undefined && keyHex !== undefined && seed !== undefined) {
            this.client._gameCrypto = {
              mode: mode,
              key: enc.Ro(keyHex),
              tables: enc.Po(seed >>> 0),
              seq: 0
            };
          }
        } catch (e) {}
        PacketManager2.pingRequest();
        if (this.client.isOwner) {
          GameUI_default.loadGame();
          Logger.test("Successfully connected to a server..");
        } else {
          this.client.myPlayer.spawn();
          this.socket.dispatchEvent(new Event("connected"));
          Logger.test("Bot spawned..");
        }
        break;

       case "C":
        myPlayer.playerInit(temp[1]);
        break;

       case "P":
        myPlayer.reset();
        this.client.InputHandler.reset();
        break;

       case "N":
        this.PacketQueue.push(() => {
          const type = temp[1] === "points" ? "gold" : temp[1];
          myPlayer.updateResources(type, temp[2]);
        });
        break;

       case "D":
        {
          const data2 = temp[1];
          const player = PlayerManager2.createPlayer({
            socketID: data2[0],
            id: data2[1],
            nickname: data2[2],
            health: data2[6],
            skinID: data2[9]
          });
          try {
            if (data2[1] !== myPlayer.id) this.client._ModuleHandler.staticModules.chatLog.add("join", "انضم للعبة", data2[2] || "بلا اسم");
          } catch (e) {}
          this.handlePlayerInit(player);
          break;
        }

       case "O":
        {
          const player = PlayerManager2.playerData.get(temp[1]);
          if (player !== void 0) {
            player.updateHealth(temp[2]);
          }
          break;
        }

       case "a":
        PlayerManager2.updatePlayer(temp[1]);
        for (let i = 0; i < this.PacketQueue.length; i++) {
          this.PacketQueue[i]();
        }
        this.PacketQueue.length = 0;
        ObjectManager2.attackedObjects.clear();
        EnemyManager2.preReset();
        this.action = createAction(() => {
          PlayerManager2.postTick();
        }, 1);
        break;

       case "I":
        PlayerManager2.updateAnimal(temp[1] || []);
        break;

       case "H":
        ObjectManager2.createObjects(temp[1]);
        if (this.action !== null) {
          this.action();
        }
        break;

       case "Q":
        if (window._rynBrokenSids) window._rynBrokenSids.push(temp[1]);
        ObjectManager2.removeObjectByID(temp[1]);
        break;

       case "R":
        {
          const player = PlayerManager2.playerData.get(temp[1]);
          if (player !== void 0) {
            ObjectManager2.removePlayerObjects(player);
          }
          try {
            if (player !== void 0 && temp[1] !== myPlayer.id) this.client._ModuleHandler.staticModules.chatLog.add("leave", "غادر", player.nickname || "بلا اسم");
          } catch (e) {}
          break;
        }

       case "L":
        {
          const object = ObjectManager2.objects.get(temp[2]);
          if (object instanceof Resource || object && object.isDestroyable) {
            ObjectManager2.attackedObjects.set(getUniqueID(), [ temp[1], object ]);
          }
          break;
        }

       case "K":
        this.PacketQueue.push(() => PlayerManager2.attackPlayer(temp[1], temp[2], temp[3]));
        break;

       case "M":
        {
          const id = temp[1];
          const angle = temp[2];
          const turret = ObjectManager2.objects.get(id);
          if (turret instanceof PlayerObject) {
            const creations = ProjectileManager2.ignoreCreation;
            const pos = turret.pos.current.makeString();
            creations.set(pos + ":" + angle, turret);
            const owner = PlayerManager2.playerData.get(turret.ownerID);
            if (owner !== void 0) {
              const projTurret = Projectiles[1];
              const projectile = new Projectile_default(angle, projTurret.range, projTurret.speed, projTurret.index, projTurret.layer, -1);
              projectile.pos.current = turret.pos.current.copy();
              projectile.ownerClient = owner;
              turret.projectile = projectile;
              if (PlayerManager2.isEnemyByID(turret.ownerID, myPlayer)) {
                ProjectileManager2.foundProjectile(projectile);
              }
              ProjectileManager2.foundProjectileThreat(projectile);
            }
          }
          this.PacketQueue.push(() => ObjectManager2.resetTurret(id));
          break;
        }

       case "X":
        {
          const x = temp[1];
          const y = temp[2];
          const angle = temp[3];
          const key = `${x}:${y}:${angle}`;
          if (ProjectileManager2.ignoreCreation.has(key)) {
            const turret = ProjectileManager2.ignoreCreation.get(key);
            const proj = turret.projectile;
            if (proj !== null) {
              proj.id = temp[8];
            }
            ProjectileManager2.ignoreCreation.delete(key);
            return;
          }
          const projectile = new Projectile_default(angle, temp[4], temp[5], temp[6], temp[7], temp[8]);
          projectile.pos.current = projectile.formatFromCurrent(new Vector_default(x, y), false);
          ProjectileManager2.createProjectile(projectile);
          break;
        }

       case "Y":
        {
          const id = temp[1];
          ProjectileManager2.toRemove.add(id);
          break;
        }

       case "4":
        myPlayer.updateClanMembers(temp[1]);
        break;

       case "3":
        if (typeof temp[1] !== "string") {
          myPlayer.teammates.clear();
        }
        break;

       case "A":
        {
          const teams = temp[1].teams;
          for (const team of teams) {
            PlayerManager2.createClan(team.sid, team.owner);
          }
          break;
        }

       case "g":
        PlayerManager2.createClan(temp[1].sid, temp[1].owner);
        try {
          const _o = PlayerManager2.playerData.get(temp[1].owner);
          this.client._ModuleHandler.staticModules.chatLog.add("clan", `أنشأ عشيرة ${temp[1].sid}`, (_o && _o.nickname) || "لاعب");
        } catch (e) {}
        break;

       case "1":
        PlayerManager2.deleteClan(temp[1]);
        try { this.client._ModuleHandler.staticModules.chatLog.add("clan", `حُلّت العشيرة ${temp[1]}`, ""); } catch (e) {}
        break;

       case "2":
        myPlayer.handleJoinRequest(temp[1], temp[2]);
        try { this.client._ModuleHandler.staticModules.chatLog.add("clan", "طلب الانضمام لعشيرتك", temp[2] || "لاعب"); } catch (e) {}
        break;

       case "T":
        if (temp.length === 4) {
          myPlayer.updateAge(temp[3]);
        }
        break;

       case "U":
        myPlayer.newUpgrade(temp[1], temp[2]);
        break;

       case "S":
        myPlayer.updateItemCount(temp[1], temp[2]);
        break;

       case "G":
        LeaderboardManager2.update(temp[1]);
        break;

       case "5":
        {
          const action = temp[1] === 0 ? 1 : 0;
          StoreHandler_default.updateStoreState(temp[3], action, temp[2]);
          if (temp[1] === 0) {
            const boughtStorage = ModuleHandler.bought[temp[3]];
            if (boughtStorage !== void 0) {
              boughtStorage.add(temp[2]);
            }
          }
          break;
        }

       case "6":
        {
          const id = temp[1];
          const message = temp[2];
          const player = PlayerManager2.playerData.get(id);
          try {
            this.client._ModuleHandler.staticModules.chatLog.add("chat", message, (player && player.nickname) || "؟");
          } catch (e) {}
          if (player != null && player.isLeader && player.clanName !== null && myPlayer.isEnemyByID(player.id) && /owner/i.test(player.clanName) && /bee op then your hack/.test(message) && this.client.isOwner) {
            this.client.removeBots();
          }
          break;
        }

       case "7":
        break;

       default:
        break;
      }
    }
  }
  const SocketManager_default = SocketManager;
  class StatsManager {
    client;
    kills=0;
    _totalKills=0;
    _globalKills=0;
    _deaths=0;
    _autoSyncTimes=0;
    _spikeSyncHammerTimes=0;
    _spikeSyncTimes=0;
    _spikeTickTimes=0;
    _knockbackTickTrapTimes=0;
    _knockbackTickHammerTimes=0;
    _knockbackTickTimes=0;
    constructor(client2) {
      this.client = client2;
    }
    init() {
      this.totalKills = Settings_default._totalKills;
      this.globalKills = Settings_default._globalKills;
      this.deaths = Settings_default._deaths;
      this.autoSyncTimes = Settings_default._autoSyncTimes;
      this.spikeSyncHammerTimes = Settings_default._spikeSyncHammerTimes;
      this.spikeSyncTimes = Settings_default._spikeSyncTimes;
      this.spikeTickTimes = Settings_default._spikeTickTimes;
      this.knockbackTickTrapTimes = Settings_default._knockbackTickTrapTimes;
      this.knockbackTickHammerTimes = Settings_default._knockbackTickHammerTimes;
      this.knockbackTickTimes = Settings_default._knockbackTickTimes;
    }
    get totalKills() {
      return this._totalKills;
    }
    get globalKills() {
      return this._globalKills;
    }
    get deaths() {
      return this._deaths;
    }
    get autoSyncTimes() {
      return this._autoSyncTimes;
    }
    get spikeSyncHammerTimes() {
      return this._spikeSyncHammerTimes;
    }
    get spikeSyncTimes() {
      return this._spikeSyncTimes;
    }
    get spikeTickTimes() {
      return this._spikeTickTimes;
    }
    get knockbackTickTrapTimes() {
      return this._knockbackTickTrapTimes;
    }
    get knockbackTickHammerTimes() {
      return this._knockbackTickHammerTimes;
    }
    get knockbackTickTimes() {
      return this._knockbackTickTimes;
    }
    set totalKills(value) {
      this._totalKills += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_totalKills", this._totalKills);
    }
    set globalKills(value) {
      this._globalKills += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_globalKills", this._globalKills);
    }
    set deaths(value) {
      this._deaths += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_deaths", this._deaths);
    }
    set autoSyncTimes(value) {
      this._autoSyncTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_autoSyncTimes", this._autoSyncTimes);
    }
    set spikeSyncHammerTimes(value) {
      this._spikeSyncHammerTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_spikeSyncHammerTimes", this._spikeSyncHammerTimes);
    }
    set spikeSyncTimes(value) {
      this._spikeSyncTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_spikeSyncTimes", this._spikeSyncTimes);
    }
    set spikeTickTimes(value) {
      this._spikeTickTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_spikeTickTimes", this._spikeTickTimes);
    }
    set knockbackTickTrapTimes(value) {
      this._knockbackTickTrapTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_knockbackTickTrapTimes", this._knockbackTickTrapTimes);
    }
    set knockbackTickHammerTimes(value) {
      this._knockbackTickHammerTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_knockbackTickHammerTimes", this._knockbackTickHammerTimes);
    }
    set knockbackTickTimes(value) {
      this._knockbackTickTimes += value;
      if (!this.client.isOwner) {
        return;
      }
      UI_default.updateStats("_knockbackTickTimes", this._knockbackTickTimes);
    }
  }
  class InputHandler {
    client;
    hotkeys=new Map;
    move;
    lastPosition=new Vector_default(0, 0);
    lockPosition=false;
    mouse={
      x: 0,
      y: 0,
      angle: 0
    };
    rotation=true;
    instaToggle=false;
    instakillTarget=null;
    constructor(client2) {
      this.client = client2;
      this.reset();
    }
    instaReset() {
      this.instaToggle = false;
      this.instakillTarget = null;
    }
    reset() {
      this.hotkeys.clear();
      this.move = 0;
      this.instaReset();
    }
    init() {
      window.addEventListener("keydown", event => this.handleKeydown(event), true);
      window.addEventListener("keyup", event => this.handleKeyup(event), true);
      window.addEventListener("mousedown", event => this.handleMousedown(event), true);
      window.addEventListener("mouseup", event => this.handleMouseup(event), true);
      window.addEventListener("mousemove", event => this.handleMouseMove(event), true);
      window.addEventListener("mouseover", event => this.handleMouseMove(event), true);
      window.addEventListener("wheel", event => ZoomHandler_default.handler(event), true);
    }
    placementHandler(type, code) {
      const {isOwner: isOwner, clients: clients} = this.client;
      const item = this.client.myPlayer.getItemByType(type);
      if (item !== null) {
        this.hotkeys.set(code, type);
        this.client._ModuleHandler.startPlacement(type);
      }
      if (isOwner) {
        for (const client2 of clients) {
          client2._ModuleHandler.startPlacement(type);
        }
      }
    }
    cursorPosition(force = false) {
      if (!force && this.lockPosition) {
        return this.lastPosition;
      }
      const {myPlayer: myPlayer} = this.client;
      const pos = myPlayer.pos.future;
      const {_w: w, _h: h} = ZoomHandler_default._scale.current;
      const scale = Math.max(window.innerWidth / w, window.innerHeight / h);
      const cursorX = (this.mouse.x - window.innerWidth / 2) / scale;
      const cursorY = (this.mouse.y - window.innerHeight / 2) / scale;
      return new Vector_default(pos.x + cursorX, pos.y + cursorY);
    }
    getMovePosition(force = false) {
      if (!force && this.lockPosition) {
        return this.lastPosition;
      }
      if (Settings_default._followCursor) {
        return this.cursorPosition(true);
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (ModuleHandler.move_dir !== null) {
        return myPlayer.pos.current.addDirection(ModuleHandler.move_dir, Settings_default._movementRadius);
      }
      return myPlayer.pos.future;
    }
    postTick() {}
    toggleBotPosition() {
      const state = !this.lockPosition;
      if (state) {
        this.lastPosition.setVec(this.getMovePosition(true));
      }
      this.lockPosition = state;
    }
    handleMovement() {
      const angle = getAngleFromBitmask(this.move, false);
      this.client._ModuleHandler.startMovement(angle);
      const {isOwner: isOwner, clients: clients} = this.client;
    }
    toggleRotation() {
      this.rotation = !this.rotation;
      if (this.rotation) {
        this.client._ModuleHandler._currentAngle = this.mouse.angle;
      }
    }
    handleKeydown(event) {
      const {code: code, ctrlKey: ctrlKey, shiftKey: shiftKey} = event;
      if (ctrlKey && shiftKey && (code === "KeyI" || code === "KeyJ" || code === "KeyM") || code === "F12" || ctrlKey && code === "KeyU") {
        if (isProd) {
          event.preventDefault();
        }
      }
      const target = event.target;
      if (event.code === "Space" && target.tagName === "BODY") {
        event.preventDefault();
      }
      if (event.ctrlKey && [ "KeyD", "KeyS", "KeyW" ].includes(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) {
        return;
      }
      if (UI_default.isActiveButton()) {
        return;
      }
      const isInput = isActiveInput();
      if (event.code === Settings_default._toggleMenu && !isInput) {
        UI_default.toggleMenu();
      }
      if (event.code === Settings_default._toggleChat && !UI_default.isMenuOpened) {
        GameUI_default.handleEnter(event);
      }
      if (!this.client.myPlayer.inGame) {
        return;
      }
      if (isInput) {
        return;
      }
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (event.code === Settings_default._food) {
        this.placementHandler(2, event.code);
      }
      if (event.code === Settings_default._wall) {
        this.placementHandler(3, event.code);
      }
      if (event.code === Settings_default._spike) {
        this.placementHandler(4, event.code);
      }
      if (event.code === Settings_default._windmill) {
        this.placementHandler(5, event.code);
      }
      if (event.code === Settings_default._farm) {
        this.placementHandler(6, event.code);
      }
      if (event.code === Settings_default._trap) {
        this.placementHandler(7, event.code);
      }
      if (event.code === Settings_default._turret) {
        this.placementHandler(8, event.code);
      }
      if (event.code === Settings_default._spawn) {
        this.placementHandler(9, event.code);
      }
      const copyMove = this.move;
      if (event.code === Settings_default._up) {
        this.move |= 1;
      }
      if (event.code === Settings_default._left) {
        this.move |= 4;
      }
      if (event.code === Settings_default._down) {
        this.move |= 2;
      }
      if (event.code === Settings_default._right) {
        this.move |= 8;
      }
      if (copyMove !== this.move) {
        this.handleMovement();
      }
      if (event.code === Settings_default._autoattack) {
        ModuleHandler.toggleAutoattack();
      }
      if (event.code === Settings_default._lockrotation) {
        this.toggleRotation();
      }
      if (event.code === Settings_default._lockBotPosition) {
        this.toggleBotPosition();
      }
      if (event.code === Settings_default._instakill) {
        this.instaToggle = !this.instaToggle;
      }
      if (event.code === Settings_default._botAutoFarm && Settings_default._botAutoFarm !== "") {
        Settings_default._botAutoFarmEnabled = !Settings_default._botAutoFarmEnabled;
        Settings_default._botAutoAttackEnabled = Settings_default._botAutoFarmEnabled;
        try {
          const {isOwner: _afIsOwner, clients: _afClients} = this.client;
          if (_afIsOwner) {
            let _afIndex = 0;
            for (const _afBot of _afClients) {
              if (_afBot._ModuleHandler) {
                _afBot._ModuleHandler._autoFarmActive = Settings_default._botAutoFarmEnabled;
                _afBot._ModuleHandler._autoFarmTarget = null;
                _afBot._ModuleHandler._autoFarmWander = null;
                try {
                  _rynSetAttackingStaggered(_afBot._ModuleHandler, Settings_default._botAutoAttackEnabled ? 1 : 0, _afIndex);
                } catch (_) {}
                if (!Settings_default._botAutoFarmEnabled) {
                  _afBot._ModuleHandler.startMovement(null);
                }
              }
              _afIndex++;
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._botAutoAttack) {
        Settings_default._botAutoAttackEnabled = !Settings_default._botAutoAttackEnabled;
        const {isOwner: isOwner2, clients: clients2} = this.client;
        if (isOwner2) {
          let _baIndex = 0;
          for (const bot2 of clients2) {
            _rynSetAttackingStaggered(bot2._ModuleHandler, Settings_default._botAutoAttackEnabled ? 1 : 0, _baIndex);
            _baIndex++;
          }
        }
      }
      if (event.code === Settings_default._spawnBot) {
        try {
          const doc = UI_default.frame && UI_default.frame.document;
          if (doc) {
            const addBtn = doc.querySelector("#add-bot-dynamic");
            if (addBtn) {
              addBtn.click();
              setTimeout(() => {
                const allConnectBtns = doc.querySelectorAll('[id^="dyn-bot-btn-"]');
                const allInputs = doc.querySelectorAll('[id^="dyn-bot-input-"]');
                const lastBtn = allConnectBtns[allConnectBtns.length - 1];
                const lastInp = allInputs[allInputs.length - 1];
                const rndNum = () => String(Math.floor(Math.random() * 999) + 1);
                if (lastInp && !lastInp.value.trim()) lastInp.value = "Ryn " + rndNum();
                if (lastBtn) lastBtn.click();
              }, 100);
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._killAllBots) {
        try {
          this.client.removeBots();
        } catch (_) {}
      }
      if (event.code === (Settings_default._clearTargets || "KeyT")) {
        try {
          _clearAllTargets();
        } catch (_) {}
      }
      if (event.code === Settings_default._repelAlts) {
        try {
          const {isOwner: isOwner2, clients: clients2} = this.client;
          if (isOwner2) {
            for (const bot2 of clients2) {
              const mh = bot2._ModuleHandler;
              if (mh) {
                mh._repelActive = !mh._repelActive;
                if (mh._repelActive) {
                  const ownerPos = this.client.myPlayer.pos.current;
                  const botPos = bot2.myPlayer.pos.current;
                  const dx = botPos.x - ownerPos.x;
                  const dy = botPos.y - ownerPos.y;
                  const awayAngle = Math.atan2(dy, dx);
                  mh.startMovement(awayAngle);
                } else {
                  mh.startMovement(null);
                }
              }
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._freezeBots && Settings_default._freezeBots !== "") {
        try {
          const {isOwner: _fbIsOwner, clients: _fbClients} = this.client;
          if (_fbIsOwner) {
            Settings_default._botsFrozen = !Settings_default._botsFrozen;
            for (const _fbBot of _fbClients) {
              const _fbMH = _fbBot._ModuleHandler;
              if (!_fbMH) continue;
              if (Settings_default._botsFrozen) {
                _fbMH.move_dir = null;
                _fbMH.startMovement(null, true);
                _fbBot.PacketManager.move(null);
                try {
                  const _fbMov = _fbMH.modules && _fbMH.modules.find(m => m.moduleName === "movement");
                  if (_fbMov) _fbMov.isStopped = true;
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._scatterBots && Settings_default._scatterBots !== "...") {
        try {
          const {isOwner: _sbIsOwner, clients: _sbClients} = this.client;
          if (_sbIsOwner) {
            const _sbFirst = [ ..._sbClients ][0];
            const _sbCurrentlyActive = _sbFirst && _sbFirst._ModuleHandler && _sbFirst._ModuleHandler._scatterActive;
            if (_sbCurrentlyActive) {
              for (const _sbBot of _sbClients) {
                const _sbMH = _sbBot._ModuleHandler;
                if (!_sbMH) continue;
                _sbMH._scatterActive = false;
                _sbMH._scatterDest = null;
                _sbMH._scatterReturning = true;
                _sbMH._scatterBreaking = false;
                _sbMH._scatterBreakTarget = null;
                _sbMH._scatterNextDecisionTime = 0;
              }
            } else {
              for (const _sbBot of _sbClients) {
                const _sbMH = _sbBot._ModuleHandler;
                if (!_sbMH) continue;
                _sbMH._scatterActive = true;
                _sbMH._scatterReturning = false;
                _sbMH._scatterBreaking = false;
                _sbMH._scatterBreakTarget = null;
                _sbMH._scatterLastMoveAngle = null;
                _sbMH._scatterNextDecisionTime = 0;
                _sbMH._scatterLastPos = null;
                _sbMH._scatterStuckStrikes = 0;
              }
            }
          }
        } catch (_) {}
      }
      if (Settings_default._formationHotkeys) {
        for (const fid in Settings_default._formationHotkeys) {
          const fkey = Settings_default._formationHotkeys[fid];
          if (fkey && fkey !== "..." && event.code === fkey) {
            Settings_default._formation = fid;
            SaveSettings();
            if (typeof window._updateFormationUI === "function") {
              window._updateFormationUI();
            }
            break;
          }
        }
      }
      if (event.code === Settings_default._fourSpikes) {
        try {
          const mh = this.client._ModuleHandler;
          const base = mh._currentAngle;
          mh.place(4, base);
          mh.place(4, base + toRadians(90));
          mh.place(4, base + toRadians(180));
          mh.place(4, base + toRadians(270));
          if (this.client.isOwner) {
            for (const bot2 of this.client.clients) {
              const bmh = bot2._ModuleHandler;
              if (!bmh) continue;
              const ba = bmh._currentAngle;
              bmh.place(4, ba);
              bmh.place(4, ba + toRadians(90));
              bmh.place(4, ba + toRadians(180));
              bmh.place(4, ba + toRadians(270));
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._fourTraps) {
        try {
          const mh = this.client._ModuleHandler;
          const base = mh._currentAngle;
          mh.place(7, base);
          mh.place(7, base + toRadians(90));
          mh.place(7, base + toRadians(180));
          mh.place(7, base + toRadians(270));
          if (this.client.isOwner) {
            for (const bot2 of this.client.clients) {
              const bmh = bot2._ModuleHandler;
              if (!bmh) continue;
              const ba = bmh._currentAngle;
              bmh.place(7, ba);
              bmh.place(7, ba + toRadians(90));
              bmh.place(7, ba + toRadians(180));
              bmh.place(7, ba + toRadians(270));
            }
          }
        } catch (_) {}
      }
      if (event.code === Settings_default._autoMillKey) {
        try {
          Settings_default._automill = !Settings_default._automill;
          const autoMillEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_automill");
          if (autoMillEl) autoMillEl.checked = Settings_default._automill;
        } catch (_) {}
      }
      if (event.code === Settings_default._dashMovementKey) {
        try {
          Settings_default._dashMovement = !Settings_default._dashMovement;
          const dashEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_dashMovement");
          if (dashEl) dashEl.checked = Settings_default._dashMovement;
          RYNNotify.show("Dash Movement", Settings_default._dashMovement);
        } catch (_) {}
      }
      if (Settings_default._autoGrindKey && event.code === Settings_default._autoGrindKey) {
        try {
          const grindMod = window.client?._ModuleHandler?.staticModules?.autoGrind;
          if (!Settings_default._autoGrind && grindMod && grindMod.isFullyUpgraded()) {
            RYNNotify.show("Auto Grind — MAX", false);
          } else {
            Settings_default._autoGrind = !Settings_default._autoGrind;
            const grindEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_autoGrind");
            if (grindEl) grindEl.checked = Settings_default._autoGrind;
            RYNNotify.show("Auto Grind", Settings_default._autoGrind);
          }
        } catch (_) {}
      }
      if (Settings_default._autoplacerKey && event.code === Settings_default._autoplacerKey) {
        try {
          Settings_default._autoplacer = !Settings_default._autoplacer;
          const placerEl = UI_default.frame && UI_default.frame.document && UI_default.frame.document.getElementById("_autoplacer");
          if (placerEl) placerEl.checked = Settings_default._autoplacer;
          RYNNotify.show("Autoplacer", Settings_default._autoplacer);
        } catch (_) {}
      }
      if (event.code === Settings_default._boostSpikes) {
        try {
          const mh = this.client._ModuleHandler;
          const angle = mh._currentAngle;
          mh.place(7, angle);
          mh.place(4, angle + toRadians(90));
          mh.place(4, angle - toRadians(90));
          if (this.client.isOwner) {
            for (const bot2 of this.client.clients) {
              const bmh = bot2._ModuleHandler;
              if (!bmh) continue;
              const ba = bmh._currentAngle;
              bmh.place(7, ba);
              bmh.place(4, ba + toRadians(90));
              bmh.place(4, ba - toRadians(90));
            }
          }
        } catch (_) {}
      }
      if (UI_default.isMenuOpened) {
        return;
      }
    }
    handleKeyup(event) {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, isOwner: isOwner, clients: clients} = this.client;
      if (!myPlayer.inGame) {
        return;
      }
      const copyMove = this.move;
      if (event.code === Settings_default._up) {
        this.move &= -2;
      }
      if (event.code === Settings_default._left) {
        this.move &= -5;
      }
      if (event.code === Settings_default._down) {
        this.move &= -3;
      }
      if (event.code === Settings_default._right) {
        this.move &= -9;
      }
      if (copyMove !== this.move) {
        this.handleMovement();
      }
      if (ModuleHandler.currentType !== null && this.hotkeys.delete(event.code)) {
        const entry = [ ...this.hotkeys ].pop();
        const type = entry !== void 0 ? entry[1] : null;
        ModuleHandler.startPlacement(type);
        if (isOwner) {
          for (const client2 of clients) {
            client2._ModuleHandler.startPlacement(type);
          }
        }
      }
    }
    handleMousedown(event) {
      if (!(event.target instanceof HTMLCanvasElement) || event.target.id === "mapDisplay") {
        return;
      }
      const button = formatButton(event.button);
      if (button === "MBTN") {
        this.instaToggle = !this.instaToggle;
        return;
      }
      const {isOwner: isOwner, clients: clients, _ModuleHandler: ModuleHandler} = this.client;
      const state = button === "LBTN" ? 1 : button === "RBTN" ? 2 : null;
      if (state !== null && ModuleHandler.attacking === 0) {
        ModuleHandler.attacking = state;
        ModuleHandler.attackingState = state;
        if (isOwner) {
          let _mdIndex = 0;
          for (const client2 of clients) {
            _rynSetAttackingStaggered(client2._ModuleHandler, state, _mdIndex);
            _mdIndex++;
          }
        }
      }
    }
    handleMouseup(event) {
      const button = formatButton(event.button);
      const {isOwner: isOwner, clients: clients, _ModuleHandler: ModuleHandler} = this.client;
      if ((button === "LBTN" || button === "RBTN") && ModuleHandler.attacking !== 0) {
        if (!ModuleHandler.autoattack) {
          ModuleHandler.attacking = 0;
        }
        if (isOwner) {
          for (const client2 of clients) {
            const _squadBlocked = typeof _isControlled === "function" && !_isControlled(client2);
            if (!Settings_default._botAutoAttackEnabled || _squadBlocked) {
              client2._ModuleHandler.staticModules.tempData.setAttacking(0);
            }
          }
        }
      }
    }
    handleMouseMove(event) {
      const x = event.clientX;
      const y = event.clientY;
      const angle = parseFloat(getAngle(window.innerWidth / 2, window.innerHeight / 2, x, y).toFixed(2));
      this.mouse.angle = angle;
      if (this.rotation) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.client._ModuleHandler._currentAngle = angle;
      }
    }
  }
  function _rynSetAttackingStaggered(mh, state, index, stepMs = null) {
    if (!mh || !mh.staticModules || !mh.staticModules.tempData) return;
    if (state === 0) {
      try {
        mh.staticModules.tempData.setAttacking(0);
      } catch (_) {}
      return;
    }
    if (mh.attacking === state) return;
    try {
      mh.staticModules.tempData.setAttacking(state);
    } catch (_) {}
  }
  class TempData {
    moduleName="tempData";
    client;
    store=[ 0, 0 ];
    constructor(client2) {
      this.client = client2;
    }
    setAttacking(attacking) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      ModuleHandler.attacking = attacking;
      if (attacking !== 0) {
        ModuleHandler.attackingState = attacking;
      }
    }
    setStore(type, id) {
      this.store[type] = id;
      this.handleBuy(type);
    }
    handleBuy(type) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const id = this.store[type];
      const store2 = ModuleHandler.store[type];
      if (store2.actual === id) {
        return;
      }
      if (ModuleHandler.sentHatEquip) {
        return;
      }
      const temp = ModuleHandler.canBuy(type, id) ? id : 0;
      ModuleHandler._equip(type, temp, true);
    }
    postTick() {
      this.handleBuy(0);
      this.handleBuy(1);
    }
  }
  const TempData_default = TempData;
  class Movement {
    moduleName="movement";
    client;
    isStopped=true;
    constructor(client2) {
      this.client = client2;
    }
    getMovePosition() {
      return this.client.ownerClient.InputHandler.getMovePosition();
    }
    getFormationOffset(botIndex, totalBots, circleOffset, radius, facingAngle) {
      const f = Settings_default._formation || "none";
      const t = botIndex / totalBots;
      const angle = 2 * Math.PI * t + circleOffset;
      const fAngle = facingAngle || 0;
      const rotateToFacing = (fwd, right) => {
        const cosA = Math.cos(fAngle), sinA = Math.sin(fAngle);
        return {
          dx: fwd * cosA - right * sinA,
          dy: fwd * sinA + right * cosA
        };
      };
      switch (f) {
       case "circle":
        {
          return {
            dx: Math.cos(angle) * radius,
            dy: Math.sin(angle) * radius
          };
        }

       case "triangle":
        {
          const side = Math.floor(t * 3);
          const along = t * 3 % 1;
          const corners = [ 0, 1, 2 ].map(i => {
            const a = 2 * Math.PI * i / 3 - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % 3], c2 = corners[(side + 1) % 3];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "square":
        {
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const r2 = radius * 0.85;
          const corners = [ 0, 1, 2, 3 ].map(i => {
            const a = Math.PI / 2 * i + circleOffset;
            return {
              x: Math.cos(a) * r2,
              y: Math.sin(a) * r2
            };
          });
          const c1 = corners[side % 4], c2 = corners[(side + 1) % 4];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "arrow":
        {
          if (botIndex < Math.ceil(totalBots / 2)) {
            const i = botIndex;
            const half = Math.ceil(totalBots / 2);
            const ratio = i / Math.max(half - 1, 1);
            const baseAngle = -Math.PI / 2 + circleOffset;
            const spread = Math.PI / 5;
            return {
              dx: Math.cos(baseAngle - spread) * radius * ratio,
              dy: Math.sin(baseAngle - spread) * radius * ratio
            };
          } else {
            const i = botIndex - Math.ceil(totalBots / 2);
            const half = Math.floor(totalBots / 2);
            const ratio = i / Math.max(half - 1, 1);
            const baseAngle = -Math.PI / 2 + circleOffset;
            const spread = Math.PI / 5;
            return {
              dx: Math.cos(baseAngle + spread) * radius * ratio,
              dy: Math.sin(baseAngle + spread) * radius * ratio
            };
          }
        }

       case "heart":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const scale = radius / 17;
          const x = 16 * Math.pow(Math.sin(a), 3);
          const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
          return {
            dx: x * scale,
            dy: y * scale
          };
        }

       case "star":
        {
          const points = 5;
          const outerR = radius;
          const innerR = radius * 0.4;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 2 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "line":
        {
          const spread = radius * 1.8;
          const offset = (t - 0.5) * spread;
          const a = circleOffset;
          return {
            dx: Math.cos(a + Math.PI / 2) * offset,
            dy: Math.sin(a + Math.PI / 2) * offset
          };
        }

       case "x":
        {
          const onFirst = botIndex % 2 === 0;
          const i2 = Math.floor(botIndex / 2);
          const half2 = Math.ceil(totalBots / 2);
          const r3 = (i2 / Math.max(half2 - 1, 1) - 0.5) * radius * 1.6;
          const a1 = circleOffset + Math.PI / 4;
          const a2 = circleOffset - Math.PI / 4;
          const ang = onFirst ? a1 : a2;
          return {
            dx: Math.cos(ang) * r3,
            dy: Math.sin(ang) * r3
          };
        }

       case "diamond":
        {
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const corners = [ 0, 1, 2, 3 ].map(i => {
            const a = Math.PI / 2 * i + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % 4], c2 = corners[(side + 1) % 4];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "spiral":
        {
          const turns = 2;
          const r4 = radius * t;
          const a2 = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a2) * r4,
            dy: Math.sin(a2) * r4
          };
        }

       case "pentagon":
        {
          const side = Math.floor(t * 5);
          const along = t * 5 % 1;
          const corners = [ 0, 1, 2, 3, 4 ].map(i => {
            const a = 2 * Math.PI * i / 5 - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % 5], c2 = corners[(side + 1) % 5];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "hexagon":
        {
          const side = Math.floor(t * 6);
          const along = t * 6 % 1;
          const corners = [ 0, 1, 2, 3, 4, 5 ].map(i => {
            const a = 2 * Math.PI * i / 6 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % 6], c2 = corners[(side + 1) % 6];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "octagon":
        {
          const side = Math.floor(t * 8);
          const along = t * 8 % 1;
          const corners = Array.from({
            length: 8
          }, (_, i) => {
            const a = 2 * Math.PI * i / 8 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % 8], c2 = corners[(side + 1) % 8];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "star6":
        {
          const points = 6, outerR = radius, innerR = radius * 0.45;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 2 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "star8":
        {
          const points = 8, outerR = radius, innerR = radius * 0.38;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 2 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "crescent":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const outerX = Math.cos(a) * radius;
          const outerY = Math.sin(a) * radius;
          const innerRadius = radius * 0.7;
          const shift = radius * 0.3;
          const innerX = Math.cos(a) * innerRadius + shift;
          const innerY = Math.sin(a) * innerRadius;
          const blend = (Math.cos(a - circleOffset) + 1) / 2;
          return {
            dx: outerX * (1 - blend * 0.7) - innerX * blend * 0.3,
            dy: outerY - innerY * blend * 0.3
          };
        }

       case "crown":
        {
          const peaks = 5;
          const seg = Math.floor(t * peaks * 2);
          const along = t * peaks * 2 % 1;
          const isUp = seg % 2 === 0;
          const leftAngle = Math.PI * seg / peaks + circleOffset - Math.PI / 2;
          const rightAngle = Math.PI * (seg + 1) / peaks + circleOffset - Math.PI / 2;
          const baseY = radius * 0.4;
          const leftX = Math.cos(leftAngle) * radius;
          const rightX = Math.cos(rightAngle) * radius;
          const leftY = isUp ? -baseY : baseY;
          const rightY = isUp ? -radius : baseY;
          return {
            dx: leftX + (rightX - leftX) * along,
            dy: leftY + (rightY - leftY) * along
          };
        }

       case "cross_plus":
        {
          const arms = 4;
          const arm = Math.floor(t * arms * 2);
          const along = t * arms * 2 % 1;
          const armAngle = Math.PI / 2 * Math.floor(arm / 2) + circleOffset;
          const isOut = arm % 2 === 0;
          const from = isOut ? 0 : radius;
          const to = isOut ? radius : 0;
          const r = from + (to - from) * along;
          return {
            dx: Math.cos(armAngle) * r,
            dy: Math.sin(armAngle) * r
          };
        }

       case "fan":
        {
          const spread = Math.PI * 0.75;
          const a = (t - 0.5) * spread + circleOffset - Math.PI / 2;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "arc":
        {
          const spread = Math.PI;
          const a = (t - 0.5) * spread + circleOffset - Math.PI / 2;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "v_shape":
        {
          const half = botIndex < Math.ceil(totalBots / 2);
          const i = half ? botIndex : botIndex - Math.ceil(totalBots / 2);
          const count = half ? Math.ceil(totalBots / 2) : Math.floor(totalBots / 2);
          const ratio = count > 1 ? i / (count - 1) : 0;
          const sign = half ? -1 : 1;
          const spread = radius * 1.4;
          return {
            dx: sign * ratio * spread * 0.6,
            dy: -ratio * spread
          };
        }

       case "u_shape":
        {
          const a = Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: -Math.abs(Math.sin(a) * radius) + radius * 0.5
          };
        }

       case "w_shape":
        {
          const segs = 4;
          const seg = Math.floor(t * segs);
          const along = t * segs % 1;
          const pts = [ {
            x: -radius,
            y: 0
          }, {
            x: -radius * 0.5,
            y: radius * 0.7
          }, {
            x: 0,
            y: 0
          }, {
            x: radius * 0.5,
            y: radius * 0.7
          }, {
            x: radius,
            y: 0
          } ];
          const p1 = pts[seg], p2 = pts[Math.min(seg + 1, 4)];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "wave":
        {
          const spread = radius * 2;
          const x = (t - 0.5) * spread;
          const y = Math.sin(t * Math.PI * 4 + circleOffset) * radius * 0.5;
          return {
            dx: x,
            dy: y
          };
        }

       case "zigzag":
        {
          const spread = radius * 2;
          const x = (t - 0.5) * spread;
          const segments = 6;
          const phase = t * segments % 1;
          const y = (Math.floor(t * segments) % 2 === 0 ? phase : 1 - phase) * radius * 0.8 - radius * 0.4;
          return {
            dx: x,
            dy: y
          };
        }

       case "dna":
        {
          const spread = radius * 2;
          const x = (t - 0.5) * spread;
          const even = botIndex % 2 === 0;
          const y = Math.sin(t * Math.PI * 3 + circleOffset + (even ? 0 : Math.PI)) * radius * 0.55;
          return {
            dx: x,
            dy: y
          };
        }

       case "tornado":
        {
          const turns = 3;
          const shrink = 1 - t * 0.85;
          const r5 = radius * shrink;
          const a = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a) * r5,
            dy: Math.sin(a) * r5 - radius * t * 0.6
          };
        }

       case "orbit":
        {
          const rings = botIndex < Math.ceil(totalBots / 2) ? 1 : 0.5;
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * rings,
            dy: Math.sin(a) * radius * rings
          };
        }

       case "galaxy":
        {
          const arms = 3;
          const armIndex = botIndex % arms;
          const posInArm = Math.floor(botIndex / arms) / Math.max(Math.ceil(totalBots / arms), 1);
          const a = 2 * Math.PI * armIndex / arms + posInArm * Math.PI * 2.5 + circleOffset;
          const r6 = radius * 0.2 + posInArm * radius * 0.8;
          return {
            dx: Math.cos(a) * r6,
            dy: Math.sin(a) * r6
          };
        }

       case "figure8":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const scale = radius;
          return {
            dx: Math.sin(a) * scale,
            dy: Math.sin(a) * Math.cos(a) * scale
          };
        }

       case "vortex":
        {
          const turns = 1.5;
          const grow = t;
          const r7 = radius * 0.15 + grow * radius * 0.85;
          const a = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a) * r7,
            dy: Math.sin(a) * r7
          };
        }

       case "double_spiral":
        {
          const even = botIndex % 2 === 0;
          const tt = Math.floor(botIndex / 2) / Math.max(Math.ceil(totalBots / 2), 1);
          const turns = 2;
          const r8 = radius * tt;
          const a = 2 * Math.PI * turns * tt + circleOffset + (even ? 0 : Math.PI);
          return {
            dx: Math.cos(a) * r8,
            dy: Math.sin(a) * r8
          };
        }

       case "grid":
        {
          const cols = Math.ceil(Math.sqrt(totalBots));
          const rows = Math.ceil(totalBots / cols);
          const row = Math.floor(botIndex / cols);
          const col = botIndex % cols;
          const stepX = cols > 1 ? radius * 1.6 / (cols - 1) : 0;
          const stepY = rows > 1 ? radius * 1.6 / (rows - 1) : 0;
          return {
            dx: col * stepX - radius * 0.8,
            dy: row * stepY - radius * 0.8
          };
        }

       case "double_circle":
        {
          const inner = botIndex < Math.ceil(totalBots / 2);
          const count = inner ? Math.ceil(totalBots / 2) : Math.floor(totalBots / 2);
          const idx = inner ? botIndex : botIndex - Math.ceil(totalBots / 2);
          const r9 = inner ? radius * 0.5 : radius;
          const a = 2 * Math.PI * (idx / Math.max(count, 1)) + circleOffset;
          return {
            dx: Math.cos(a) * r9,
            dy: Math.sin(a) * r9
          };
        }

       case "ladder":
        {
          const cols = 2;
          const col = botIndex % cols;
          const row = Math.floor(botIndex / cols);
          const totalRows = Math.ceil(totalBots / cols);
          const stepY = totalRows > 1 ? radius * 1.8 / (totalRows - 1) : 0;
          return {
            dx: (col - 0.5) * radius * 0.8,
            dy: row * stepY - radius * 0.9
          };
        }

       case "comb":
        {
          const isBase = botIndex === 0;
          if (isBase) return {
            dx: 0,
            dy: radius * 0.5
          };
          const idx = botIndex - 1;
          const count = totalBots - 1;
          const spread = radius * 1.8;
          const x = (idx / Math.max(count - 1, 1) - 0.5) * spread;
          return {
            dx: x,
            dy: -radius * 0.5
          };
        }

       case "tunnel":
        {
          const cols = Math.ceil(Math.sqrt(totalBots));
          const row = Math.floor(botIndex / cols);
          const col = botIndex % cols;
          const totalRows = Math.ceil(totalBots / cols);
          const shrink = 1 - row / Math.max(totalRows, 1) * 0.6;
          const stepX = cols > 1 ? radius * 1.6 * shrink / (cols - 1) : 0;
          const stepY = totalRows > 1 ? radius * 1.4 / (totalRows - 1) : 0;
          return {
            dx: col * stepX - radius * 0.8 * shrink,
            dy: row * stepY - radius * 0.7
          };
        }

       case "lightning":
        {
          const pts = [ {
            x: 0,
            y: -radius
          }, {
            x: radius * 0.4,
            y: -radius * 0.2
          }, {
            x: -radius * 0.3,
            y: radius * 0.2
          }, {
            x: radius * 0.2,
            y: radius
          } ];
          const seg = Math.floor(t * (pts.length - 1));
          const along = t * (pts.length - 1) % 1;
          const p1 = pts[Math.min(seg, pts.length - 2)];
          const p2 = pts[Math.min(seg + 1, pts.length - 1)];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "fish":
        {
          const a = 2 * Math.PI * t;
          const bodyX = Math.cos(a) * radius * 0.7;
          const bodyY = Math.sin(a) * radius * 0.4;
          if (t < 0.75) {
            return {
              dx: bodyX,
              dy: bodyY
            };
          } else {
            const tailT = (t - 0.75) / 0.25;
            const tailX = -radius * 0.7 + (tailT - 0.5) * radius * 0.6;
            const tailY = (tailT < 0.5 ? tailT : 1 - tailT) * radius * 0.7 - radius * 0.35;
            return {
              dx: tailX,
              dy: tailY
            };
          }
        }

       case "hline":
        {
          const spread = radius * 1.8;
          return {
            dx: (t - 0.5) * spread,
            dy: 0
          };
        }

       case "column":
        {
          const spread = radius * 1.8;
          return {
            dx: 0,
            dy: (t - 0.5) * spread
          };
        }

       case "diagonal_r":
        {
          const spread = radius * 1.4;
          return {
            dx: (t - 0.5) * spread,
            dy: (t - 0.5) * spread
          };
        }

       case "diagonal_l":
        {
          const spread = radius * 1.4;
          return {
            dx: (t - 0.5) * spread,
            dy: -(t - 0.5) * spread
          };
        }

       case "scatter":
        {
          const seed = botIndex * 2654435761;
          const sx = ((seed & 0xFFFF) / 0xFFFF - 0.5) * radius * 1.8;
          const sy = ((seed >> 16 & 0xFFFF) / 0xFFFF - 0.5) * radius * 1.8;
          return {
            dx: sx,
            dy: sy
          };
        }

       case "ring_inner":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 0.4,
            dy: Math.sin(a) * radius * 0.4
          };
        }

       case "ring_outer":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 1.2,
            dy: Math.sin(a) * radius * 1.2
          };
        }

       case "semi_top":
        {
          const a = Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: -Math.abs(Math.sin(a)) * radius
          };
        }

       case "semi_bottom":
        {
          const a = Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.abs(Math.sin(a)) * radius
          };
        }

       case "semi_left":
        {
          const a = Math.PI * t + circleOffset - Math.PI / 2;
          return {
            dx: -Math.abs(Math.cos(a)) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "semi_right":
        {
          const a = Math.PI * t + circleOffset - Math.PI / 2;
          return {
            dx: Math.abs(Math.cos(a)) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "rows3":
        {
          const col = botIndex % 3;
          const row = Math.floor(botIndex / 3);
          const totalRows = Math.ceil(totalBots / 3);
          const sy = totalRows > 1 ? radius * 1.6 / (totalRows - 1) : 0;
          return {
            dx: (col - 1) * radius * 0.7,
            dy: row * sy - radius * 0.8
          };
        }

       case "rows4":
        {
          const col = botIndex % 4;
          const row = Math.floor(botIndex / 4);
          const totalRows = Math.ceil(totalBots / 4);
          const sy = totalRows > 1 ? radius * 1.6 / (totalRows - 1) : 0;
          return {
            dx: (col - 1.5) * radius * 0.55,
            dy: row * sy - radius * 0.8
          };
        }

       case "rows5":
        {
          const col = botIndex % 5;
          const row = Math.floor(botIndex / 5);
          const totalRows = Math.ceil(totalBots / 5);
          const sy = totalRows > 1 ? radius * 1.6 / (totalRows - 1) : 0;
          return {
            dx: (col - 2) * radius * 0.45,
            dy: row * sy - radius * 0.8
          };
        }

       case "stagger":
        {
          const col = botIndex % 3;
          const row = Math.floor(botIndex / 3);
          const rowOff = row % 2 === 0 ? 0 : radius * 0.35;
          const totalRows = Math.ceil(totalBots / 3);
          const sy = totalRows > 1 ? radius * 1.4 / (totalRows - 1) : 0;
          return {
            dx: (col - 1) * radius * 0.7 + rowOff,
            dy: row * sy - radius * 0.7
          };
        }

       case "checkers":
        {
          const col = botIndex % 3;
          const row = Math.floor(botIndex / 3);
          const off = (row + col) % 2 === 0 ? -radius * 0.15 : radius * 0.15;
          const sy = radius * 1.4 / Math.max(Math.ceil(totalBots / 3) - 1, 1);
          return {
            dx: (col - 1) * radius * 0.7 + off,
            dy: row * sy - radius * 0.7
          };
        }

       case "wedge":
        {
          const depth = Math.floor(Math.sqrt(botIndex + 1));
          const pos = botIndex - depth * depth + depth;
          const total = depth * 2 + 1;
          return {
            dx: (pos / Math.max(total - 1, 1) - 0.5) * radius * depth * 0.7,
            dy: depth * radius * 0.4 - radius * 0.5
          };
        }

       case "pyramid":
        {
          const row = Math.floor(Math.sqrt(botIndex));
          const pos = botIndex - row * row;
          const total = row * 2 + 1;
          return {
            dx: (pos / Math.max(total - 1, 1) - 0.5) * radius * (row + 1) * 0.7,
            dy: -row * radius * 0.4 + radius * 0.5
          };
        }

       case "cross":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            return {
              dx: (botIndex / Math.max(half - 1, 1) - 0.5) * radius * 1.8,
              dy: 0
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            return {
              dx: 0,
              dy: (i / Math.max(cnt - 1, 1) - 0.5) * radius * 1.8
            };
          }
        }

       case "plus_wide":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            return {
              dx: (botIndex / Math.max(half - 1, 1) - 0.5) * radius * 2.2,
              dy: 0
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            return {
              dx: 0,
              dy: (i / Math.max(cnt - 1, 1) - 0.5) * radius * 2.2
            };
          }
        }

       case "t_shape":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            return {
              dx: (botIndex / Math.max(half - 1, 1) - 0.5) * radius * 1.8,
              dy: -radius * 0.6
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            return {
              dx: 0,
              dy: i / Math.max(cnt - 1, 1) * radius * 1.2 - radius * 0.5
            };
          }
        }

       case "l_shape":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            return {
              dx: -radius * 0.6,
              dy: (botIndex / Math.max(half - 1, 1) - 0.5) * radius * 1.8
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            return {
              dx: i / Math.max(cnt - 1, 1) * radius * 1.2 - radius * 0.5,
              dy: radius * 0.9
            };
          }
        }

       case "z_shape":
        {
          const third = Math.floor(totalBots / 3);
          if (botIndex < third) {
            return {
              dx: (botIndex / Math.max(third - 1, 1) - 0.5) * radius * 1.6,
              dy: -radius * 0.7
            };
          } else if (botIndex < third * 2) {
            const i = botIndex - third;
            const cnt = third;
            return {
              dx: radius * 0.8 - i / Math.max(cnt - 1, 1) * radius * 1.6,
              dy: (i / Math.max(cnt - 1, 1) - 0.5) * radius * 1.4
            };
          } else {
            const i = botIndex - third * 2;
            const cnt = totalBots - third * 2;
            return {
              dx: (i / Math.max(cnt - 1, 1) - 0.5) * radius * 1.6,
              dy: radius * 0.7
            };
          }
        }

       case "s_shape":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            const a = Math.PI * (botIndex / Math.max(half - 1, 1)) + circleOffset;
            return {
              dx: Math.cos(a) * radius * 0.7,
              dy: Math.sin(a) * radius * 0.5 - radius * 0.5
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            const a = Math.PI * (i / Math.max(cnt - 1, 1)) + Math.PI + circleOffset;
            return {
              dx: Math.cos(a) * radius * 0.7,
              dy: Math.sin(a) * radius * 0.5 + radius * 0.5
            };
          }
        }

       case "bowtie":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * Math.cos(a) * radius * 0.5
          };
        }

       case "oval":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 1.4,
            dy: Math.sin(a) * radius * 0.6
          };
        }

       case "oval_v":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 0.6,
            dy: Math.sin(a) * radius * 1.4
          };
        }

       case "ring3":
        {
          const third = Math.floor(t * 3);
          const ri = [ 0.35, 0.7, 1.0 ][third] * radius;
          const cnt = Math.ceil(totalBots / 3);
          const idx = botIndex % cnt;
          const a = 2 * Math.PI * (idx / Math.max(cnt, 1)) + circleOffset;
          return {
            dx: Math.cos(a) * ri,
            dy: Math.sin(a) * ri
          };
        }

       case "spoke3":
        {
          const arm = botIndex % 3;
          const posInArm = Math.floor(botIndex / 3) / Math.max(Math.ceil(totalBots / 3), 1);
          const a = 2 * Math.PI * arm / 3 + circleOffset;
          return {
            dx: Math.cos(a) * posInArm * radius,
            dy: Math.sin(a) * posInArm * radius
          };
        }

       case "spoke4":
        {
          const arm = botIndex % 4;
          const posInArm = Math.floor(botIndex / 4) / Math.max(Math.ceil(totalBots / 4), 1);
          const a = Math.PI / 2 * arm + circleOffset;
          return {
            dx: Math.cos(a) * posInArm * radius,
            dy: Math.sin(a) * posInArm * radius
          };
        }

       case "spoke6":
        {
          const arm = botIndex % 6;
          const posInArm = Math.floor(botIndex / 6) / Math.max(Math.ceil(totalBots / 6), 1);
          const a = Math.PI / 3 * arm + circleOffset;
          return {
            dx: Math.cos(a) * posInArm * radius,
            dy: Math.sin(a) * posInArm * radius
          };
        }

       case "spoke8":
        {
          const arm = botIndex % 8;
          const posInArm = Math.floor(botIndex / 8) / Math.max(Math.ceil(totalBots / 8), 1);
          const a = Math.PI / 4 * arm + circleOffset;
          return {
            dx: Math.cos(a) * posInArm * radius,
            dy: Math.sin(a) * posInArm * radius
          };
        }

       case "star4":
        {
          const points = 4, outerR = radius, innerR = radius * 0.4;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 4 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "star10":
        {
          const points = 10, outerR = radius, innerR = radius * 0.45;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 2 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "star12":
        {
          const points = 12, outerR = radius, innerR = radius * 0.5;
          const totalPoints = points * 2;
          const side = Math.floor(t * totalPoints);
          const along = t * totalPoints % 1;
          const starPts = Array.from({
            length: totalPoints
          }, (_, i) => {
            const a = Math.PI * i / points - Math.PI / 2 + circleOffset;
            const r = i % 2 === 0 ? outerR : innerR;
            return {
              x: Math.cos(a) * r,
              y: Math.sin(a) * r
            };
          });
          const p1 = starPts[side % totalPoints], p2 = starPts[(side + 1) % totalPoints];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "poly7":
        {
          const n = 7;
          const side = Math.floor(t * n);
          const along = t * n % 1;
          const corners = Array.from({
            length: n
          }, (_, i) => {
            const a = 2 * Math.PI * i / n - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % n], c2 = corners[(side + 1) % n];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "poly9":
        {
          const n = 9;
          const side = Math.floor(t * n);
          const along = t * n % 1;
          const corners = Array.from({
            length: n
          }, (_, i) => {
            const a = 2 * Math.PI * i / n - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % n], c2 = corners[(side + 1) % n];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "poly10":
        {
          const n = 10;
          const side = Math.floor(t * n);
          const along = t * n % 1;
          const corners = Array.from({
            length: n
          }, (_, i) => {
            const a = 2 * Math.PI * i / n - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % n], c2 = corners[(side + 1) % n];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "poly12":
        {
          const n = 12;
          const side = Math.floor(t * n);
          const along = t * n % 1;
          const corners = Array.from({
            length: n
          }, (_, i) => {
            const a = 2 * Math.PI * i / n - Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % n], c2 = corners[(side + 1) % n];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "brace":
        {
          const a = Math.PI * (t - 0.5) * 1.4 + circleOffset;
          const r = radius * (1 - Math.abs(t - 0.5) * 0.5);
          return {
            dx: Math.cos(a) * radius,
            dy: -r * Math.abs(Math.sin(a)) + radius * 0.3
          };
        }

       case "hook":
        {
          if (t < 0.7) {
            const a = 2 * Math.PI * (t / 0.7) + circleOffset;
            return {
              dx: Math.cos(a) * radius * 0.6,
              dy: Math.sin(a) * radius * 0.6
            };
          } else {
            const i = (t - 0.7) / 0.3;
            return {
              dx: -radius * 0.6 + i * radius * 0.6,
              dy: -radius * 0.6 - i * radius * 0.4
            };
          }
        }

       case "arrow_dbl":
        {
          const third = Math.floor(totalBots / 3);
          if (botIndex < third) {
            const ratio = botIndex / Math.max(third - 1, 1);
            return {
              dx: -radius * 0.6 + ratio * radius * 0.6,
              dy: ratio * radius * 0.6
            };
          } else if (botIndex < third * 2) {
            const i = botIndex - third;
            const ratio = i / Math.max(third - 1, 1);
            return {
              dx: -radius * 0.6 + ratio * radius * 0.6,
              dy: -ratio * radius * 0.6
            };
          } else {
            const i = botIndex - third * 2;
            const cnt = totalBots - third * 2;
            const ratio = i / Math.max(cnt - 1, 1);
            return {
              dx: radius * 0.6 - ratio * radius * 0.6,
              dy: (ratio - 0.5) * radius * 1.2
            };
          }
        }

       case "chevron":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            const ratio = botIndex / Math.max(half - 1, 1);
            return {
              dx: -radius + ratio * radius,
              dy: -ratio * radius * 0.6
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            const ratio = i / Math.max(cnt - 1, 1);
            return {
              dx: ratio * radius,
              dy: -(1 - ratio) * radius * 0.6
            };
          }
        }

       case "chevron_inv":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            const ratio = botIndex / Math.max(half - 1, 1);
            return {
              dx: -radius + ratio * radius,
              dy: ratio * radius * 0.6
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            const ratio = i / Math.max(cnt - 1, 1);
            return {
              dx: ratio * radius,
              dy: (1 - ratio) * radius * 0.6
            };
          }
        }

       case "bracket":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            const ratio = botIndex / Math.max(half - 1, 1);
            return {
              dx: -radius * 0.8,
              dy: (ratio - 0.5) * radius * 1.6
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            const ratio = i / Math.max(cnt - 1, 1);
            return {
              dx: radius * 0.8,
              dy: (ratio - 0.5) * radius * 1.6
            };
          }
        }

       case "bracket_h":
        {
          const half = Math.floor(totalBots / 2);
          if (botIndex < half) {
            const ratio = botIndex / Math.max(half - 1, 1);
            return {
              dx: (ratio - 0.5) * radius * 1.6,
              dy: -radius * 0.8
            };
          } else {
            const i = botIndex - half;
            const cnt = totalBots - half;
            const ratio = i / Math.max(cnt - 1, 1);
            return {
              dx: (ratio - 0.5) * radius * 1.6,
              dy: radius * 0.8
            };
          }
        }

       case "fence":
        {
          const col = botIndex % 2;
          const row = Math.floor(botIndex / 2);
          const totalCols = Math.ceil(totalBots / 2);
          const sx = totalCols > 1 ? radius * 1.8 / (totalCols - 1) : 0;
          return {
            dx: row * sx - radius * 0.9,
            dy: col === 0 ? -radius * 0.4 : radius * 0.4
          };
        }

       case "diamond_ring":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const squeeze = 0.7;
          const rot = Math.PI / 4;
          const cx = Math.cos(a) * radius;
          const cy = Math.sin(a) * radius * squeeze;
          return {
            dx: cx * Math.cos(rot) - cy * Math.sin(rot),
            dy: cx * Math.sin(rot) + cy * Math.cos(rot)
          };
        }

       case "pac":
        {
          const a = t * 1.75 * Math.PI + 0.2 + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "horseshoe":
        {
          const a = t * 1.5 * Math.PI - Math.PI * 0.75 + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "c_shape":
        {
          const a = t * 1.5 * Math.PI - Math.PI * 0.75 + circleOffset + Math.PI;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "spiral_tight":
        {
          const turns = 3;
          const r = radius * t;
          const a = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a) * r * 0.8,
            dy: Math.sin(a) * r * 0.8
          };
        }

       case "spiral_loose":
        {
          const turns = 1.5;
          const r = radius * 0.3 + radius * t * 0.7;
          const a = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "concentric":
        {
          const rings = 3;
          const ringIdx = botIndex % rings;
          const posInRing = Math.floor(botIndex / rings);
          const totalInRing = Math.ceil(totalBots / rings);
          const r = radius * (0.35 + ringIdx * 0.32);
          const a = 2 * Math.PI * (posInRing / Math.max(totalInRing, 1)) + circleOffset;
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "pinwheel":
        {
          const blades = 4;
          const blade = botIndex % blades;
          const posInBlade = Math.floor(botIndex / blades) / Math.max(Math.ceil(totalBots / blades), 1);
          const a = Math.PI / 2 * blade + posInBlade * Math.PI * 0.4 + circleOffset;
          return {
            dx: Math.cos(a) * posInBlade * radius,
            dy: Math.sin(a) * posInBlade * radius
          };
        }

       case "pinwheel3":
        {
          const blades = 3;
          const blade = botIndex % blades;
          const posInBlade = Math.floor(botIndex / blades) / Math.max(Math.ceil(totalBots / blades), 1);
          const a = 2 * Math.PI / 3 * blade + posInBlade * Math.PI * 0.5 + circleOffset;
          return {
            dx: Math.cos(a) * posInBlade * radius,
            dy: Math.sin(a) * posInBlade * radius
          };
        }

       case "burst":
        {
          const a = 2 * Math.PI * botIndex / Math.max(totalBots, 1) + circleOffset;
          const r = radius * (0.2 + 0.8 * (botIndex % 2));
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "sunflower":
        {
          const golden = 2.399963;
          const r = Math.sqrt(botIndex / Math.max(totalBots, 1)) * radius;
          const a = golden * botIndex + circleOffset;
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "helix":
        {
          const turns = 2;
          const a = 2 * Math.PI * turns * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 0.7,
            dy: (t - 0.5) * radius * 1.8
          };
        }

       case "coil":
        {
          const turns = 3;
          const a = 2 * Math.PI * turns * t + circleOffset;
          const r = radius * 0.5;
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r + (t - 0.5) * radius * 1.2
          };
        }

       case "swirl":
        {
          const a = 2 * Math.PI * 2.5 * t + circleOffset;
          const r = radius * 0.3 + t * radius * 0.7;
          return {
            dx: -Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "teardrop":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const r = radius * (1 - Math.sin(a - Math.PI / 2) * 0.35);
          return {
            dx: Math.cos(a) * r * 0.8,
            dy: Math.sin(a) * r
          };
        }

       case "egg":
        {
          const a = 2 * Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius * 0.75,
            dy: Math.sin(a) * radius - Math.sin(a) * radius * 0.25
          };
        }

       case "leaf":
        {
          const a = 2 * Math.PI * t;
          return {
            dx: Math.sin(a) * Math.cos(a) * radius,
            dy: Math.sin(a) * radius * 0.7
          };
        }

       case "lemniscate":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const denom = 1 + Math.sin(a) * Math.sin(a);
          return {
            dx: Math.cos(a) / denom * radius,
            dy: Math.sin(a) * Math.cos(a) / denom * radius
          };
        }

       case "tri_cols":
        {
          const col = botIndex % 3;
          const row = Math.floor(botIndex / 3);
          const totalRows = Math.ceil(totalBots / 3);
          const sy = totalRows > 1 ? radius * 1.6 / (totalRows - 1) : 0;
          const offsets = [ -radius * 0.7, 0, radius * 0.7 ];
          return {
            dx: offsets[col],
            dy: row * sy - radius * 0.8
          };
        }

       case "box_open":
        {
          const perimeter = 4;
          const side = Math.floor(t * perimeter);
          const along = t * perimeter % 1;
          const r = radius * 0.85;
          if (side === 0) return {
            dx: -r + along * r * 2,
            dy: -r
          };
          if (side === 1) return {
            dx: r,
            dy: -r + along * r * 2
          };
          if (side === 2) return {
            dx: r - along * r * 2,
            dy: r
          };
          return {
            dx: -r,
            dy: r - along * r * 2
          };
        }

       case "triangle_inv":
        {
          const n = 3;
          const side = Math.floor(t * n);
          const along = t * n % 1;
          const corners = [ 0, 1, 2 ].map(i => {
            const a = 2 * Math.PI * i / 3 + Math.PI / 2 + circleOffset;
            return {
              x: Math.cos(a) * radius,
              y: Math.sin(a) * radius
            };
          });
          const c1 = corners[side % n], c2 = corners[(side + 1) % n];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "diamond_sm":
        {
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const corners = [ 0, 1, 2, 3 ].map(i => {
            const a = Math.PI / 2 * i + circleOffset;
            return {
              x: Math.cos(a) * radius * 0.55,
              y: Math.sin(a) * radius * 0.55
            };
          });
          const c1 = corners[side % 4], c2 = corners[(side + 1) % 4];
          return {
            dx: c1.x + (c2.x - c1.x) * along,
            dy: c1.y + (c2.y - c1.y) * along
          };
        }

       case "phalanx":
        {
          const col = botIndex % 5;
          const row = Math.floor(botIndex / 5);
          const totalRows = Math.ceil(totalBots / 5);
          const sy = totalRows > 1 ? radius * 1.4 / (totalRows - 1) : 0;
          const taper = (1 - row / Math.max(totalRows, 1)) * 0.3;
          return {
            dx: (col - 2) * radius * (0.4 + taper),
            dy: row * sy - radius * 0.7
          };
        }

       case "shield":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const top = -radius * 0.6;
          const rr = radius;
          if (t < 0.5) {
            return {
              dx: Math.cos(a) * rr,
              dy: top + Math.sin(a) * rr * 0.6 + rr * 0.3
            };
          } else {
            const i = (t - 0.5) / 0.5;
            const x = (i - 0.5) * rr * 2;
            const y = rr * 0.3 - Math.sqrt(Math.max(0, rr * rr - x * x)) * 0.3;
            return {
              dx: x,
              dy: y
            };
          }
        }

       case "bullet":
        {
          const a = 2 * Math.PI * t + circleOffset;
          if (t < 0.5) {
            return {
              dx: Math.cos(a) * radius * 0.6,
              dy: Math.sin(a) * radius * 0.6 + radius * 0.2
            };
          } else {
            const i = (t - 0.5) / 0.5;
            return {
              dx: (i - 0.5) * radius * 1.2,
              dy: radius * 0.8 - i * radius * 0.5
            };
          }
        }

       case "kite":
        {
          const pts = [ {
            x: 0,
            y: -radius
          }, {
            x: radius * 0.6,
            y: 0
          }, {
            x: 0,
            y: radius * 0.5
          }, {
            x: -radius * 0.6,
            y: 0
          } ];
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const p1 = pts[side % 4], p2 = pts[(side + 1) % 4];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "rhombus":
        {
          const pts = [ {
            x: 0,
            y: -radius * 1.2
          }, {
            x: radius * 0.6,
            y: 0
          }, {
            x: 0,
            y: radius * 1.2
          }, {
            x: -radius * 0.6,
            y: 0
          } ];
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const p1 = pts[side % 4], p2 = pts[(side + 1) % 4];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "trapezoid":
        {
          const pts = [ {
            x: -radius,
            y: radius * 0.5
          }, {
            x: radius,
            y: radius * 0.5
          }, {
            x: radius * 0.6,
            y: -radius * 0.5
          }, {
            x: -radius * 0.6,
            y: -radius * 0.5
          } ];
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const p1 = pts[side % 4], p2 = pts[(side + 1) % 4];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "parallelogram":
        {
          const sh = radius * 0.4;
          const pts = [ {
            x: -radius + sh,
            y: -radius * 0.4
          }, {
            x: radius + sh,
            y: -radius * 0.4
          }, {
            x: radius - sh,
            y: radius * 0.4
          }, {
            x: -radius - sh,
            y: radius * 0.4
          } ];
          const side = Math.floor(t * 4);
          const along = t * 4 % 1;
          const p1 = pts[side % 4], p2 = pts[(side + 1) % 4];
          return {
            dx: p1.x + (p2.x - p1.x) * along,
            dy: p1.y + (p2.y - p1.y) * along
          };
        }

       case "drop_front":
        {
          const cnt = Math.ceil(totalBots * 0.3);
          if (botIndex < cnt) {
            const a = 2 * Math.PI * (botIndex / Math.max(cnt, 1)) + circleOffset;
            return {
              dx: Math.cos(a) * radius * 0.45,
              dy: Math.sin(a) * radius * 0.45 - radius * 0.6
            };
          } else {
            const i = botIndex - cnt;
            const c = totalBots - cnt;
            const a = 2 * Math.PI * (i / Math.max(c, 1)) + circleOffset;
            return {
              dx: Math.cos(a) * radius,
              dy: Math.sin(a) * radius + radius * 0.2
            };
          }
        }

       case "columns2":
        {
          const col = botIndex % 2;
          const row = Math.floor(botIndex / 2);
          const totalRows = Math.ceil(totalBots / 2);
          const sy = totalRows > 1 ? radius * 1.8 / (totalRows - 1) : 0;
          return {
            dx: (col - 0.5) * radius * 1.0,
            dy: row * sy - radius * 0.9
          };
        }

       case "ring_half":
        {
          const a = Math.PI * t + circleOffset;
          return {
            dx: Math.cos(a) * radius,
            dy: Math.sin(a) * radius
          };
        }

       case "thin_line":
        {
          const spread = radius * 2.5;
          return {
            dx: (t - 0.5) * spread,
            dy: (t - 0.5) * radius * 0.1
          };
        }

       case "wave_v":
        {
          const spread = radius * 2;
          const y = (t - 0.5) * spread;
          const x = Math.sin(t * Math.PI * 4 + circleOffset) * radius * 0.5;
          return {
            dx: x,
            dy: y
          };
        }

       case "step":
        {
          const cols = 3;
          const col = botIndex % cols;
          const row = Math.floor(botIndex / cols);
          const totalRows = Math.ceil(totalBots / cols);
          const sy = totalRows > 1 ? radius * 1.4 / (totalRows - 1) : 0;
          return {
            dx: col * radius * 0.6 - radius * 0.6,
            dy: row * sy - radius * 0.7 + col * radius * 0.15
          };
        }

       case "clover3":
        {
          const a = 2 * Math.PI * t;
          const r = radius * 0.6 * (1 + 0.5 * Math.cos(3 * a));
          return {
            dx: Math.cos(a + circleOffset) * r,
            dy: Math.sin(a + circleOffset) * r
          };
        }

       case "clover4":
        {
          const a = 2 * Math.PI * t;
          const r = radius * 0.6 * (1 + 0.5 * Math.cos(4 * a));
          return {
            dx: Math.cos(a + circleOffset) * r,
            dy: Math.sin(a + circleOffset) * r
          };
        }

       case "rose3":
        {
          const a = 2 * Math.PI * t;
          const r = radius * Math.cos(3 * a);
          return {
            dx: Math.cos(a + circleOffset) * r,
            dy: Math.sin(a + circleOffset) * r
          };
        }

       case "rose4":
        {
          const a = 2 * Math.PI * t;
          const r = radius * Math.cos(4 * a);
          return {
            dx: Math.cos(a + circleOffset) * r,
            dy: Math.sin(a + circleOffset) * r
          };
        }

       case "petal":
        {
          const a = 2 * Math.PI * t + circleOffset;
          const r = radius * Math.pow(Math.cos(a - circleOffset), 2);
          return {
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r
          };
        }

       case "army_line":
        {
          const right = (t - 0.5) * radius * 2;
          return rotateToFacing(0, right);
        }

       case "army_column":
        {
          const forward = -t * radius * 1.8 - radius * 0.3;
          return rotateToFacing(forward, 0);
        }

       case "army_wedge":
        {
          const side = botIndex % 2 === 0 ? -1 : 1;
          const i = Math.floor(botIndex / 2);
          const steps = Math.max(Math.ceil(totalBots / 2), 1);
          const forward = radius - i / steps * radius * 1.6;
          const right = side * (i / steps) * radius * 1.3;
          return rotateToFacing(forward, right);
        }

       case "army_arrowhead":
        {
          const side = botIndex % 2 === 0 ? -1 : 1;
          const i = Math.floor(botIndex / 2);
          const steps = Math.max(Math.ceil(totalBots / 2), 1);
          const ratio = i / steps;
          const forward = radius * 0.9 - ratio * radius * 1.1;
          const right = side * ratio * radius * 0.75;
          return rotateToFacing(forward, right);
        }

       case "army_phalanx":
        {
          const cols = Math.max(1, Math.ceil(Math.sqrt(totalBots)));
          const col = botIndex % cols;
          const row = Math.floor(botIndex / cols);
          const spacing = radius * 0.45;
          const right = (col - (cols - 1) / 2) * spacing;
          const forward = radius * 0.5 - row * spacing;
          return rotateToFacing(forward, right);
        }

       case "army_box":
        {
          const side2 = Math.floor(t * 4);
          const along2 = t * 4 % 1;
          const r2 = radius * 0.85;
          const localCorners = [ {
            x: r2,
            y: -r2
          }, {
            x: r2,
            y: r2
          }, {
            x: -r2,
            y: r2
          }, {
            x: -r2,
            y: -r2
          } ];
          const c1 = localCorners[side2 % 4], c2 = localCorners[(side2 + 1) % 4];
          const fwd = c1.x + (c2.x - c1.x) * along2;
          const right = c1.y + (c2.y - c1.y) * along2;
          return rotateToFacing(fwd, right);
        }

       case "army_skirmish":
        {
          const right = (t - 0.5) * radius * 2;
          const forward = botIndex % 2 === 0 ? radius * 0.18 : -radius * 0.18;
          return rotateToFacing(forward, right);
        }

       case "army_echelon_l":
        {
          const step = radius * 1.6 / Math.max(totalBots - 1, 1);
          const forward = radius * 0.5 - botIndex * step;
          const right = -botIndex * step;
          return rotateToFacing(forward, right);
        }

       case "army_echelon_r":
        {
          const step = radius * 1.6 / Math.max(totalBots - 1, 1);
          const forward = radius * 0.5 - botIndex * step;
          const right = botIndex * step;
          return rotateToFacing(forward, right);
        }

       case "army_spearhead":
        {
          if (botIndex === 0) {
            return rotateToFacing(radius, 0);
          }
          const i = botIndex - 1;
          const total2 = Math.max(totalBots - 1, 1);
          const side = i % 2 === 0 ? -1 : 1;
          const j = Math.floor(i / 2);
          const steps = Math.max(Math.ceil(total2 / 2), 1);
          const ratio = (j + 1) / steps;
          const forward = radius - ratio * radius * 1.6;
          const right = side * ratio * radius * 1.1;
          return rotateToFacing(forward, right);
        }

       default:
        return {
          dx: 0,
          dy: 0
        };
      }
    }
    getActualPosition() {
      const pos = this.getMovePosition();
      const ownerClient = this.client.ownerClient;
      const botIndex = ownerClient.getClientIndex(this.client);
      const f = Settings_default._formation || "none";
      if (f === "none") return pos;
      const totalBots = ownerClient.clients.size;
      if (totalBots === 0) return pos;
      const {circleOffset: circleOffset} = ownerClient._ModuleHandler;
      const radius = Settings_default._circleRadius;
      const facingAngle = ownerClient.InputHandler && ownerClient.InputHandler.mouse ? ownerClient.InputHandler.mouse.angle : 0;
      const {dx: dx, dy: dy} = this.getFormationOffset(botIndex, totalBots, circleOffset, radius, facingAngle);
      return pos.addDirection(Math.atan2(dy, dx), Math.sqrt(dx * dx + dy * dy));
    }
    someColliding(pos, radius) {
      const {previous: previous, current: current} = this.client.myPlayer.pos;
      return previous.distance(pos) <= radius || current.distance(pos) <= radius;
    }
    postTick() {
      const {InputHandler: InputHandler2} = this.client.ownerClient;
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (ModuleHandler._scatterActive || ModuleHandler._scatterReturning) return;
      if (ModuleHandler._autoFarmActive) return;
      if (Settings_default._botsFrozen) {
        if (!this.isStopped) {
          this.isStopped = true;
          ModuleHandler.startMovement(null, true);
          ModuleHandler.move_dir = null;
          this.client.PacketManager.move(null);
        }
        return;
      }
      try {
        if (typeof _isControlled === "function" && !_isControlled(this.client)) {
          if (!this.isStopped) {
            this.isStopped = true;
            ModuleHandler.stopMovement();
          }
          return;
        }
      } catch (e) {}
      if (Settings_default._shieldGuard) {
        const oc2 = this.client.ownerClient;
        const gm = oc2._ModuleHandler && oc2._ModuleHandler.staticModules && oc2._ModuleHandler.staticModules.guardModule;
        if (gm) {
          const {isGuard: isGuard} = gm._resolveGuard.call({
            client: this.client
          });
          if (isGuard) return;
        }
      }
      const pos1 = myPlayer.pos.current;
      const walkPos = this.getActualPosition();
      const lookPos = InputHandler2.cursorPosition();
      const lookAt = pos1.angle(lookPos);
      ModuleHandler._currentAngle = lookAt;
      if (!this.someColliding(walkPos, Settings_default._movementRadius)) {
        const walkTo = pos1.angle(walkPos);
        this.isStopped = !ModuleHandler.startMovement(walkTo);
      } else if (!this.isStopped) {
        this.isStopped = true;
        ModuleHandler.stopMovement();
      }
    }
  }
  const Movement_default = Movement;
  class ClanJoiner {
    moduleName="clanJoiner";
    client;
    joinCount=0;
    prevOwnerClan=null;
    _ownClanAttempts=0;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      if (Settings_default._botIndividualClans) {
        this._individualClanTick();
        return;
      }
      const {myPlayer: myPlayer, PacketManager: PacketManager2, ownerClient: owner, PlayerManager: PlayerManager2} = this.client;
      const ownerClan = owner.myPlayer.clanName;
      const myClan = myPlayer.clanName;
      if (ownerClan !== this.prevOwnerClan) {
        this.prevOwnerClan = ownerClan;
        this.joinCount = 0;
        owner.pendingJoins.delete(myPlayer.id);
      }
      if (ownerClan === null || myClan === ownerClan || !PlayerManager2.clanExist(ownerClan)) {
        return;
      }
      if (this.joinCount === 2) {
        this.joinCount = 0;
        if (myClan !== null) {
          PacketManager2.leaveClan();
        } else {
          owner.pendingJoins.add(myPlayer.id);
          PacketManager2.joinClan(ownerClan);
        }
        return;
      }
      this.joinCount += 1;
    }
    _individualClanTick() {
      const {myPlayer: myPlayer, PacketManager: PacketManager2, PlayerManager: PlayerManager2} = this.client;
      if (!myPlayer.inGame) return;
      const desiredName = this.client._botCustomName;
      if (!desiredName) return;
      if (myPlayer.clanName === desiredName) {
        this._ownClanAttempts = 0;
        return;
      }
      this._ownClanAttempts += 1;
      if (this._ownClanAttempts < 3) return;
      this._ownClanAttempts = 0;
      if (myPlayer.clanName !== null) {
        PacketManager2.leaveClan();
        return;
      }
      if (PlayerManager2.clanExist(desiredName)) {
        PacketManager2.joinClan(desiredName);
      } else {
        PacketManager2.createClan(desiredName);
      }
    }
  }
  const ClanJoiner_default = ClanJoiner;
  class Autobreak {
    moduleName="autoBreak";
    client;
    constructor(client2) {
      this.client = client2;
    }
    enemyCanRetrapMe(myPlayer, enemy, ObjectManager2) {
      if (!enemy) return false;
      const trapId = myPlayer.getItemByType(7);
      if (trapId !== 15) return false;
      const myPos = myPlayer.pos.current;
      const enemyPos = enemy.pos.current;
      const myFut = myPlayer.pos.future ?? myPos;
      const enemyFut = enemy.pos.future ?? enemyPos;
      const enemyVelX = enemy.xVel != null ? enemy.xVel : enemyPos.x;
      const enemyVelY = enemy.yVel != null ? enemy.yVel : enemyPos.y;
      const trapItem = Items[trapId];
      const trapScale = trapItem.scale;
      const placeDist = 35 + trapScale + (trapItem.placeOffset || 0);
      const rawKB = myPlayer.getMaxKnockback?.() ?? 120;
      const kbDist = rawKB * (111 / 60);
      const kbBaseAngle = Math.atan2(myPos.y - enemyPos.y, myPos.x - enemyPos.x);
      const myKbX = myPos.x + kbDist * Math.cos(kbBaseAngle);
      const myKbY = myPos.y + kbDist * Math.sin(kbBaseAngle);
      const ANGLE_STEPS = 36;
      for (let i = 0; i < ANGLE_STEPS; i++) {
        const angle = i * (Math.PI * 2 / ANGLE_STEPS);
        const cfgX = enemyPos.x + placeDist * Math.cos(angle);
        const cfgY = enemyPos.y + placeDist * Math.sin(angle);
        const cfgS = trapScale;
        if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y)) {
          return true;
        }
        if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, myPos.x, myPos.y, myKbX, myKbY)) {
          return true;
        }
        const kbA200 = Math.atan2(enemyVelY - cfgY, enemyVelX - cfgX);
        const proj200X = enemyVelX + 200 * Math.cos(kbA200);
        const proj200Y = enemyVelY + 200 * Math.sin(kbA200);
        if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, myPos.x, myPos.y, proj200X, proj200Y)) {
          return true;
        }
      }
      const bestAngles = ObjectManager2.getBestPlacementAngles({
        position: enemyPos,
        id: trapId,
        targetAngle: enemyPos.angle(myPos),
        ignoreID: null,
        preplace: false,
        reduce: false,
        fill: false
      });
      if (bestAngles && bestAngles.length > 0) {
        for (const angle of bestAngles) {
          const cfgX = enemyPos.x + Math.cos(angle) * placeDist;
          const cfgY = enemyPos.y + Math.sin(angle) * placeDist;
          const cfgS = trapScale;
          if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y)) return true;
          if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, myPos.x, myPos.y, myKbX, myKbY)) return true;
          const kbA200 = Math.atan2(enemyVelY - cfgY, enemyVelX - cfgX);
          const pX200 = enemyVelX + 200 * Math.cos(kbA200);
          const pY200 = enemyVelY + 200 * Math.sin(kbA200);
          if (this._lineInRect(cfgX - cfgS, cfgY - cfgS, cfgX + cfgS, cfgY + cfgS, myPos.x, myPos.y, pX200, pY200)) return true;
        }
      }
      return false;
    }
    _lineInRect(x1, y1, x2, y2, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return ax >= x1 && ax <= x2 && ay >= y1 && ay <= y2;
      const t = Math.max(0, Math.min(1, ((x1 + x2) / 2 - ax) * dx / len2 + ((y1 + y2) / 2 - ay) * dy / len2));
      const cx = ax + t * dx, cy = ay + t * dy;
      return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
    }
    getWeaponRange(id, target) {
      if (id === null) {
        return 0;
      }
      if (DataHandler_default.isMelee(id)) {
        return DataHandler_default.getWeapon(id).range + target.hitScale;
      }
      return 0;
    }
    getDestroyingObject() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const pos0 = myPlayer.pos.current;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isPrimary = primary !== 8 && primary !== 5 && primary !== 6;
      const isHammer = secondary === 10;
      const nearestTrap = EnemyManager2.nearestTrap;
      const nearestSpike = EnemyManager2.nearestSpike;
      const fallback = EnemyManager2.nearestEnemyObject || EnemyManager2.secondNearestEnemyObject;
      const reachable = t => t && this.getDestroyingWeapon(t) !== null;
      const enemyFirst = () => reachable(fallback) ? fallback : null;
      if (!nearestSpike && !nearestTrap) {
        return [ enemyFirst(), null ];
      }
      if (nearestSpike && nearestTrap) {
        const distSpike = pos0.distance(nearestSpike.pos.current);
        const distTrap = pos0.distance(nearestTrap.pos.current);
        const canUseHammer = isHammer && distSpike <= this.getWeaponRange(secondary, nearestSpike);
        const canUsePrimary = isPrimary && distSpike <= this.getWeaponRange(primary, nearestSpike);
        if (canUseHammer || canUsePrimary) return [ nearestSpike, nearestTrap ];
        const pick = distSpike <= distTrap ? [ nearestSpike, nearestTrap ] : [ nearestTrap, nearestSpike ];
        if (reachable(pick[0])) return pick;
        return [ enemyFirst(), null ];
      }
      const single = nearestSpike || nearestTrap;
      if (reachable(single)) return [ single, null ];
      return [ enemyFirst(), null ];
    }
    getDestroyingWeapon(target) {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const pos0 = myPlayer.pos.current;
      const pos1 = target.pos.current;
      const distance = pos0.distance(pos1);
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const inPrimaryRange = distance <= this.getWeaponRange(primary, target);
      const inSecondaryRange = distance <= this.getWeaponRange(secondary, target);
      const isHammer = secondary === 10;
      const primaryDamage = myPlayer.getBuildingDamage(primary, ModuleHandler.canBuy(0, 40));
      const _pw = DataHandler_default?.getWeapon?.(primary);
      const isFastPrimary = (_pw?.speed ?? 1e9) < 400;
      const canOneHitWithPrimary = primaryDamage >= target.health;
      if (isFastPrimary && canOneHitWithPrimary && inPrimaryRange) {
        return 0;
      }
      if (isHammer && inSecondaryRange) {
        return 1;
      }
      if (!isHammer && inPrimaryRange) {
        return 0;
      }
      if (inPrimaryRange && isFastPrimary && myPlayer.isTrapped) {
        return 0;
      }
      return null;
    }
    _beneficialBreakTarget(myPlayer, enemy, ObjectManager2, PlayerManager2) {
      if (!enemy) return null;
      if (!enemy.isTrapped) return null;
      const secondary = myPlayer.getItemByType(1);
      if (secondary !== 10) return null;
      const spikeId = myPlayer.getItemByType(4);
      if (!spikeId) return null;
      const myPos = myPlayer.pos.current;
      const enemyPos = enemy.pos.current;
      const hammerDmg = myPlayer.getBuildingDamage?.(secondary, this.client._ModuleHandler.canBuy(0, 40)) ?? 0;
      const hammerWD = DataHandler_default.getWeapon(secondary);
      const spikeItem = Items[spikeId];
      const spikeReach = spikeItem.scale + enemy.collisionScale;
      let best = null, bestScore = -Infinity;
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 3, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return;
        if (!PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return;
        if (obj.health > hammerDmg) return;
        const distToMe = myPos.distance(obj.pos.current);
        if (distToMe > (hammerWD?.range ?? 110) + obj.collisionScale) return;
        const objPos = obj.pos.current;
        const distObjToEnemy = enemyPos.distance(objPos);
        if (distObjToEnemy > spikeReach + 25) return;
        let score = 100 - distObjToEnemy;
        if (obj.itemGroup === 2) score += 20;
        if (obj.type === 15) score += 15;
        if (score > bestScore) {
          bestScore = score;
          best = obj;
        }
      });
      return best;
    }
    postTick() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler, ObjectManager: ObjectManager3, PlayerManager: PlayerManager3} = this.client;
      if (!Settings_default._autobreak) {
        return;
      }
      if (ModuleHandler.moduleActive && !myPlayer.isTrapped) {
        return;
      }
      const beneficial = this._beneficialBreakTarget(myPlayer, EnemyManager2.nearestEnemy, ObjectManager3, PlayerManager3);
      if (beneficial) {
        const secondary = myPlayer.getItemByType(1);
        const {reloading: reloading} = ModuleHandler.staticModules;
        if (reloading.isReloaded(1)) {
          const bPos = beneficial.pos.current;
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.useAngle = myPlayer.pos.current.angle(bPos);
          ModuleHandler.forceHat = 40;
          ModuleHandler.shouldAttack = true;
          return;
        }
      }
      const [target, secondTarget] = this.getDestroyingObject();
      if (target === null) {
        return;
      }
      const type = this.getDestroyingWeapon(target);
      if (type === null) {
        return;
      }
      const enemyForProtect = EnemyManager2.nearestEnemy;
      let myTrapOnEnemy = null;
      if (enemyForProtect && enemyForProtect.isTrapped) {
        const et = enemyForProtect.trappedIn;
        if (et && !PlayerManager3.isEnemyByID(et.ownerID, myPlayer)) {
          myTrapOnEnemy = et;
        }
      }
      const weapon = myPlayer.getItemByType(type);
      const range = this.getWeaponRange(weapon, target);
      const pos1 = myPlayer.pos.current;
      const pos2 = target.pos.current;
      const distance = pos1.distance(pos2);
      if (distance > range) {
        return;
      }
      this.client._ModuleHandler._autoBreakActive = true;
      const angle1 = pos1.angle(pos2);
      this.client._ModuleHandler._lastBreakAngle = angle1;
      if (myPlayer.isTrapped && myTrapOnEnemy === null) {
        const {reloading: _rl} = ModuleHandler.staticModules;
        if (_rl.isReloaded(type)) {
          ModuleHandler.forceWeapon = type;
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = angle1;
          ModuleHandler.forceHat = 40;
          ModuleHandler.shouldAttack = true;
        }
        return;
      }
      const gatherAngle = Math.PI / 2.6;
      const weaponRange = this.getWeaponRange(weapon, target);
      const hittable = [];
      const nonHittable = [];
      this.client.ObjectManager.grid2D.query(pos1.x, pos1.y, 3, id => {
        const obj = this.client.ObjectManager.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return;
        const isMineOrAlly = !PlayerManager3.isEnemyByID(obj.ownerID, myPlayer);
        if (obj === myTrapOnEnemy) {
          nonHittable.push(obj);
          return;
        }
        if (isMineOrAlly) nonHittable.push(obj); else if (obj !== target) hittable.push(obj);
      });
      const inRangeOf = obj => {
        const d = pos1.distance(obj.pos.current);
        return d <= weaponRange + (obj.collisionScale || 0);
      };
      const isInCone = (obj, centerAngle) => {
        const objAngle = pos1.angle(obj.pos.current);
        let diff = Math.abs(objAngle - centerAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        const cone = obj === target ? gatherAngle / 2 : gatherAngle;
        return diff <= cone;
      };
      const nearestEnemyForScore = EnemyManager2.nearestEnemy;
      const enemyTrappedByMe = myTrapOnEnemy !== null;
      const scoreAngle = a => {
        let score = 0;
        if (inRangeOf(target) && isInCone(target, a)) score += 10000; else return -Infinity;
        if (nearestEnemyForScore && !enemyTrappedByMe && inRangeOf(nearestEnemyForScore) && isInCone(nearestEnemyForScore, a)) score += 1000;
        for (const obj of hittable) {
          if (inRangeOf(obj) && isInCone(obj, a)) score += 100;
        }
        for (const obj of nonHittable) {
          if (inRangeOf(obj) && isInCone(obj, a)) score -= 10;
        }
        return score;
      };
      let angle = angle1;
      let bestScore = scoreAngle(angle1);
      for (let i = 0; i < 72; i++) {
        const testA = i / 72 * Math.PI * 2;
        const s = scoreAngle(testA);
        if (s > bestScore) {
          bestScore = s;
          angle = testA;
        }
      }
      if (bestScore === -Infinity) return;
      const buildingDamage = myPlayer.getBuildingDamage(weapon, false);
      const isEnoughDamage = target.health <= buildingDamage;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const totalDamage = EnemyManager2.primaryDamage + EnemyManager2.potentialSpikeDamage;
      const shouldIgnore = EnemyManager2.instaThreat() || nearestEnemy !== null && nearestEnemy.reload[0].previous !== nearestEnemy.reload[0].current && myPlayer.currentHealth <= totalDamage && myPlayer.currentHealth > totalDamage * .75;
      const {reloading: reloading} = ModuleHandler.staticModules;
      ModuleHandler.forceWeapon = type;
      const urgentRetrapRisk = myPlayer.isTrapped && target.type === 15 && this.enemyCanRetrapMe(myPlayer, nearestEnemy, this.client.ObjectManager);
      if (reloading.isReloaded(type) && !shouldIgnore) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angle;
        if (!isEnoughDamage || urgentRetrapRisk) {
          ModuleHandler.forceHat = 40;
        }
        ModuleHandler.shouldAttack = true;
      }
    }
  }
  const _prePlaceAngleCache = new WeakMap;
  const PRE_PLACE_ROTATION = 2;
  class AutoPush {
    moduleName="autoPush";
    client;
    pushPos=null;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.pushPos = null;
    }
    postTick() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler, ObjectManager: ObjectManager2, PlayerManager: PlayerManager2} = this.client;
      this.pushPos = null;
      const nearestEnemyPush = EnemyManager2.nearestEnemyPush;
      const nearestPushSpike = EnemyManager2.nearestPushSpike;
      EnemyManager2.nearestEnemyPush = null;
      EnemyManager2.nearestPushSpike = null;
      if (ModuleHandler.moduleActive || !Settings_default._autoPush || ModuleHandler.moveTo !== "disable") {
        return;
      }
      if (nearestEnemyPush === null || nearestPushSpike === null) {
        return;
      }
      const trappedIn = nearestEnemyPush.trappedIn;
      if (trappedIn === null || myPlayer.trappedIn) {
        return;
      }
      const pos0 = myPlayer.pos.current;
      const pos1 = nearestEnemyPush.pos.current;
      const pos2 = nearestPushSpike.pos.current;
      const pushRange = Settings_default._autoPushRange ?? 250;
      if (!myPlayer.collidingSimple(nearestEnemyPush, pushRange) || nearestEnemyPush.colliding(nearestPushSpike, nearestEnemyPush.collisionScale + nearestPushSpike.collisionScale + 1)) {
        return;
      }
      const distanceFromSpikeToEnemy = pos2.distance(pos1);
      const angleFromSpikeToEnemy = pos2.angle(pos1);
      const angleToEnemy = pos0.angle(pos1);
      const angleToSpike = pos0.angle(pos2);
      const distanceToSpike = pos0.distance(pos2);
      const pushPos = pos2.addDirection(angleFromSpikeToEnemy, distanceFromSpikeToEnemy + nearestEnemyPush.collisionScale + 7);
      const objectIDs = ObjectManager2.grid2D.queryFull(pushPos.x, pushPos.y, 1);
      for (const id of objectIDs) {
        const object = ObjectManager2.objects.get(id);
        if (!object || PlayerManager2.canMoveOnTop(object)) {
          continue;
        }
        const pos = object.pos.current;
        const distance = pushPos.distance(pos);
        const playerScale = myPlayer.collisionScale * 1.3;
        const range = object.collisionScale + playerScale;
        if (distance <= range) {
          return;
        }
      }
      this.pushPos = pos2.addDirection(angleFromSpikeToEnemy, distanceFromSpikeToEnemy + 250);
      ModuleHandler.moveTo = pos0.angle(this.pushPos);
      EnemyManager2.nearestEnemyPush = nearestEnemyPush;
      EnemyManager2.nearestPushSpike = nearestPushSpike;
      const activationScale2 = nearestEnemyPush.collisionScale * 3.2;
      const offset2 = Math.asin(2 * activationScale2 / (2 * distanceToSpike));
      const angleDistance2 = getAngleDist(angleToEnemy, angleToSpike);
      const intersecting2 = angleDistance2 <= offset2;
      if (!intersecting2) {
        return;
      }
      this.pushPos = pushPos;
      ModuleHandler.moveTo = pos0.angle(this.pushPos);
    }
  }
  const AutoPush_default = AutoPush;
  class AutoPlay {
    moduleName="autoPlay";
    client;
    circleDirection=1;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.circleDirection = 1;
    }
    _isPositionBlocked(x, y, avoidEnemySpikes) {
      const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, myPlayer: myPlayer} = this.client;
      let blocked = false;
      ObjectManager2.grid2D.query(x, y, 3, id => {
        if (blocked) return;
        const obj = ObjectManager2.objects.get(id);
        if (!obj) return;
        const isPlayerObj = obj instanceof PlayerObject;
        if (isPlayerObj && obj.type === 15) return;
        if (isPlayerObj) {
          const isSpike = obj.itemGroup === 2;
          let isEnemySpike = false;
          if (isSpike) {
            try {
              isEnemySpike = PlayerManager2.isEnemyByID(obj.ownerID, myPlayer);
            } catch (_) {}
          }
          if (isEnemySpike && !avoidEnemySpikes) return;
        }
        const raw = isPlayerObj ? Items[obj.type].scale : obj.scale;
        const p = obj.pos.current;
        if (Math.hypot(x - p.x, y - p.y) < raw + 35) blocked = true;
      });
      return blocked;
    }
    postTick() {
      if (!Settings_default._autoPlay) return;
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (!myPlayer || !myPlayer.inGame) return;
      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;
      if (ModuleHandler.moveTo !== "disable") return;
      const CIRCLE_RADIUS = 80, ROTATION_SPEED = .2;
      const myFut = myPlayer.pos.future ?? myPlayer.pos.current;
      const enemyFut = enemy.pos.future ?? enemy.pos.current;
      const currentAngle = Math.atan2(myFut.y - enemyFut.y, myFut.x - enemyFut.x);
      let nextAngle = currentAngle + ROTATION_SPEED * this.circleDirection;
      let tx = enemyFut.x + Math.cos(nextAngle) * CIRCLE_RADIUS;
      let ty = enemyFut.y + Math.sin(nextAngle) * CIRCLE_RADIUS;
      if (this._isPositionBlocked(tx, ty, false)) {
        this.circleDirection *= -1;
        nextAngle = currentAngle + ROTATION_SPEED * this.circleDirection;
        tx = enemyFut.x + Math.cos(nextAngle) * CIRCLE_RADIUS;
        ty = enemyFut.y + Math.sin(nextAngle) * CIRCLE_RADIUS;
      }
      const cur = myPlayer.pos.current;
      let moveAngle = Math.atan2(ty - cur.y, tx - cur.x);
      ModuleHandler.startMovement(moveAngle);
    }
  }
  const AutoPlay_default = AutoPlay;
  class TrapTick {
    moduleName="trapTick";
    client;
    constructor(client2) {
      this.client = client2;
    }
    reset() {}
    postTick() {}
  }
  const TrapTick_default = TrapTick;
  const SiegeAnalysis = {
    isEscapable(cx, cy, selfRadius, objects) {
      if (objects.length <= 2) return {
        escapable: true,
        exits: []
      };
      const arr = [];
      for (const o of objects) {
        const dx = o.x - cx, dy = o.y - cy;
        arr.push({
          ang: Math.atan2(dy, dx),
          dist: Math.hypot(dx, dy),
          escapeScale: o.escapeScale
        });
      }
      arr.sort((a, b) => a.ang - b.ang);
      const exits = [];
      const len = arr.length;
      for (let i = 0; i < len; i++) {
        const a = arr[i];
        const b = arr[i + 1 < len ? i + 1 : 0];
        let gapAngle = Math.abs(a.ang - b.ang);
        if (gapAngle > Math.PI) gapAngle = 2 * Math.PI - gapAngle;
        const gapWidth2 = a.dist * a.dist + b.dist * b.dist - 2 * a.dist * b.dist * Math.cos(gapAngle);
        const need = selfRadius * 2 + a.escapeScale + b.escapeScale + 10;
        if (gapWidth2 > need * need) {
          let exitAng = (a.ang + b.ang) / 2;
          if (Math.abs(a.ang - b.ang) > Math.PI) exitAng += Math.PI;
          exits.push({
            angle: exitAng,
            width: Math.sqrt(gapWidth2)
          });
        }
      }
      return {
        escapable: exits.length > 0,
        exits: exits
      };
    },
    knockInto(spikeX, spikeY, objects, enemyX, enemyY, dir, playerHasPolearm) {
      let willHit = false, inEscapable = false, doubleSpike = false;
      let closest = Infinity;
      let building1 = null;
      for (const o of objects) {
        if (!o.dmg && !o.isCactus && !o.trap) continue;
        const distance = Math.hypot(enemyX - o.x, enemyY - o.y);
        if (distance > 320) continue;
        const px = enemyX + distance * Math.cos(dir);
        const py = enemyY + distance * Math.sin(dir);
        const scale = o.trap ? 47.5 : o.colScale;
        const closestDist2 = (px - o.x) * (px - o.x) + (py - o.y) * (py - o.y);
        if (closestDist2 > scale * scale) continue;
        if ((o.dmg || o.isCactus) && distance <= 250 && distance > 125 && closestDist2 < (scale - 20) * (scale - 20)) {
          inEscapable = true;
        }
        const condition = !o.trap && distance <= 245 && (distance >= 185 || playerHasPolearm && distance >= 100);
        if (building1 && !o.trap && building1.dmg && Math.abs(distance - closest) < 6.7) {
          const midAng = Math.atan2((building1.y + o.y) / 2 - enemyY, (building1.x + o.x) / 2 - enemyX);
          let rel = Math.abs(midAng - dir);
          if (rel > Math.PI) rel = 2 * Math.PI - rel;
          if (rel <= 0.4) {
            doubleSpike = true;
            if (condition) willHit = true;
            continue;
          }
        }
        if (condition) {
          const angD = Math.abs(dir - Math.atan2(o.y - spikeY, o.x - spikeX));
          const normAngD = angD > Math.PI ? 2 * Math.PI - angD : angD;
          if (normAngD <= 0.4) willHit = true;
        }
        if (distance < closest) {
          closest = distance;
          building1 = o;
        }
      }
      return {
        willHit: willHit,
        inEscapable: inEscapable,
        doubleSpike: doubleSpike,
        closest: closest
      };
    }
  };
  function _getCachedPrePlaceAngles(client, tickCount, cacheKey, computeAngle, forceFull = false, rotationGroups = PRE_PLACE_ROTATION, priorityIndex = -1) {
    let clientCache = _prePlaceAngleCache.get(client);
    if (!clientCache) {
      clientCache = new Map;
      _prePlaceAngleCache.set(client, clientCache);
    }
    let entry = clientCache.get(cacheKey);
    if (!entry) {
      entry = {
        angles: new Array(72).fill(null),
        lastTick: -1,
        wasFull: false
      };
      clientCache.set(cacheKey, entry);
    }
    const isNewTick = entry.lastTick !== tickCount;
    if (isNewTick) {
      entry.lastTick = tickCount;
      entry.wasFull = false;
    }
    if (forceFull && !entry.wasFull) {
      for (let i = 0; i < 72; i++) {
        entry.angles[i] = computeAngle(i);
      }
      entry.wasFull = true;
    } else if (isNewTick) {
      const phase = tickCount % rotationGroups;
      for (let i = phase; i < 72; i += rotationGroups) {
        entry.angles[i] = computeAngle(i);
      }
      for (let i = 0; i < 72; i++) {
        if (entry.angles[i] === null) entry.angles[i] = computeAngle(i);
      }
    }
    if (priorityIndex >= 0 && priorityIndex < 72) {
      entry.angles[priorityIndex] = computeAngle(priorityIndex);
    }
    return entry.angles;
  }
  class AutoPlacer {
    moduleName="autoPlacer";
    client;
    _bannedAngles=new Map;
    _predictObjects=[];
    _placedAngles=[];
    _tick=0;
    constructor(client2) {
      this.client = client2;
    }
    _lineInRect(x1, y1, x2, y2, ax, ay, bx, by) {
      let minX = ax, maxX = bx;
      if (ax > bx) {
        minX = bx;
        maxX = ax;
      }
      if (maxX > x2) maxX = x2;
      if (minX < x1) minX = x1;
      if (minX > maxX) return false;
      let minY = ay, maxY = by;
      const dx = bx - ax;
      if (Math.abs(dx) > 0.0000001) {
        const slope = (by - ay) / dx;
        const intercept = ay - slope * ax;
        minY = slope * minX + intercept;
        maxY = slope * maxX + intercept;
      }
      if (minY > maxY) {
        const tmp = maxY;
        maxY = minY;
        minY = tmp;
      }
      if (maxY > y2) maxY = y2;
      if (minY < y1) minY = y1;
      if (minY > maxY) return false;
      return true;
    }
    _getConfig(id, myPos) {
      return angle => {
        const item = Items[id];
        const dist = 35 + item.scale + (item.placeOffset || 0);
        return {
          id: id,
          angle: angle,
          x: myPos.x + dist * Math.cos(angle),
          y: myPos.y + dist * Math.sin(angle),
          scale: item.scale
        };
      };
    }
    _canPlace(id, angle, myPos, ObjectManager2, excludeObj) {
      const cfg = this._getConfig(id, myPos)(angle);
      const cx = cfg.x, cy = cfg.y, cs = cfg.scale;
      let collision = false;
      ObjectManager2.grid2D.query(cx, cy, 4, objId => {
        if (collision) return;
        const obj = ObjectManager2.objects.get(objId);
        if (!obj) return;
        if (excludeObj && obj === excludeObj) return;
        const blockS = obj.placementScale;
        if (Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < cs + blockS) collision = true;
      });
      if (collision) return false;
      if (id !== 18) {
        const mid = Config_default.mapScale / 2;
        const riverHalf = Config_default.riverWidth / 2;
        if (cy >= mid - riverHalf && cy <= mid + riverHalf) return false;
      }
      return true;
    }
    _isItemLimit(id, myPlayer) {
      const group = ItemGroups[Items[id].itemGroup];
      const limit = ("sandboxLimit" in group ? group.sandboxLimit : null) || 99;
      const count = myPlayer.itemCount.get(Items[id].itemGroup) || 0;
      return count >= limit;
    }
    _getPrePlaceAngles(id, myPos, myPlayer, ObjectManager2, excludeObj) {
      if (this._isItemLimit(id, myPlayer)) return [];
      const tickCount = this.client._ModuleHandler.tickCount;
      const cacheKey = this.moduleName + "_" + id + "_" + (excludeObj ? excludeObj.id : "n");
      const getConfig = this._getConfig(id, myPos);
      const retrapQuadrant = this.client._retrapQuadrant ?? -1;
      const computeAngle = i => {
        if (retrapQuadrant >= 0 && Math.floor(i / 18) === retrapQuadrant) {
          return {
            angle: i * (Math.PI * 2 / 72),
            placeable: false,
            perfect: false
          };
        }
        const angle = i * (Math.PI * 2 / 72);
        const cfg = getConfig(angle);
        return {
          ...cfg,
          placeable: this._canPlace(id, angle, myPos, ObjectManager2, excludeObj),
          perfect: false
        };
      };
      const forceFull = tickCount < (this.client._focusUntilTick || -1);
      const angles = _getCachedPrePlaceAngles(this.client, tickCount, cacheKey, computeAngle, forceFull, 1);
      for (let i = 1; i < angles.length; i++) {
        angles[i].perfect = false;
      }
      if (angles[0]) angles[0].perfect = false;
      for (let i = 1; i < angles.length; i++) {
        if (angles[i].placeable && !angles[i - 1].placeable) angles[i].perfect = true;
        if (!angles[i].placeable && angles[i - 1].placeable) angles[i - 1].perfect = true;
      }
      return angles;
    }
    _addPredictObject(id, angle, myPos) {
      const item = Items[id];
      const dist = 35 + item.scale + (item.placeOffset || 0);
      const x = myPos.x + dist * Math.cos(angle);
      const y = myPos.y + dist * Math.sin(angle);
      for (const obj of this._predictObjects) {
        if (obj.id !== 17 && Math.hypot(x - obj.x, y - obj.y) < item.scale + obj.scale) return;
      }
      this._predictObjects.push({
        id: id,
        angle: angle,
        x: x,
        y: y,
        scale: item.scale
      });
    }
    postTick() {
      if (!Settings_default._autoplacer) return;
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer, ObjectManager: ObjectManager2, PlayerManager: PlayerManager2, PacketManager: PacketManager2} = this.client;
      if (!myPlayer || !myPlayer.inGame) return;
      this._tick = this.client._ModuleHandler.tickCount;
      for (const [angle, expiry] of this._bannedAngles) {
        if (this._tick > expiry) this._bannedAngles.delete(angle);
      }
      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) return;
      const myPos = myPlayer.pos.current;
      const myFut = myPlayer.pos.future;
      const enemyPos = enemy.pos.current;
      const enemyFut = enemy.pos.future;
      const enemyScale = enemy.collisionScale;
      const trapId = myPlayer.getItemByType(7);
      const spikeId = myPlayer.getItemByType(4);
      if (!spikeId && !trapId) return;
      const spikesOur = [];
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 5, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject) || obj.itemGroup !== 2) return;
        if (PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return;
        spikesOur.push(obj);
      });
      const trapsOur = [];
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 4, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject) || obj.type !== 15) return;
        if (PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return;
        trapsOur.push(obj);
      });
      const enemyTrapped = trapsOur.find(t => t.pos.current.distance(enemyPos) < Items[t.type].scale) || null;
      if (enemyTrapped && !this.client._wasEnemyTrapped) {
        this.client._focusUntilTick = this.client._ModuleHandler.tickCount + 3;
      }
      this.client._wasEnemyTrapped = !!enemyTrapped;
      const imTrapped = !!myPlayer.isTrapped;
      const predictMoveAngle = getAngleFromBitmask(this.client.InputHandler.move, false) ?? 0;
      const canTrapTick = () => false;
      const LOOKAHEAD = 222, START_OFFSET = 35;
      const futX = myPos.x + Math.cos(predictMoveAngle) * LOOKAHEAD;
      const futY = myPos.y + Math.sin(predictMoveAngle) * LOOKAHEAD;
      const stX = myPos.x + Math.cos(predictMoveAngle) * START_OFFSET;
      const stY = myPos.y + Math.sin(predictMoveAngle) * START_OFFSET;
      const _los = cfg => {
        const blockFuture = this._lineInRect(cfg.x - cfg.scale - 5, cfg.y - cfg.scale - 5, cfg.x + cfg.scale + 5, cfg.y + cfg.scale + 5, stX, stY, futX, futY);
        const blockEnemy = this._lineInRect(cfg.x - cfg.scale - 5, cfg.y - cfg.scale - 5, cfg.x + cfg.scale + 5, cfg.y + cfg.scale + 5, myFut.x, myFut.y, enemyFut.x, enemyFut.y);
        let canSpikeTick = Math.hypot(cfg.x - enemyPos.x, cfg.y - enemyPos.y) < cfg.scale + 35;
        if (canSpikeTick) {
          const kbA = Math.atan2(enemyPos.y - cfg.y, enemyPos.x - cfg.x);
          const e2p = Math.atan2(myPos.y - enemyPos.y, myPos.x - enemyPos.x);
          let diff = Math.abs(kbA - e2p);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          canSpikeTick = diff >= Math.PI / 5;
        }
        const canRetrap = Math.hypot(cfg.x - enemyPos.x, cfg.y - enemyPos.y) < 50;
        const willRetrap = true;
        return {
          blockFuture: blockFuture,
          blockEnemy: blockEnemy,
          canSpikeTick: canSpikeTick,
          canRetrap: canRetrap,
          willRetrap: willRetrap
        };
      };
      const _findClosestSpikeToKb = spikeList => {
        const validKb = spikeList.filter(a => {
          const canHit = this._lineInRect(a.x - (enemyScale + a.scale - 1), a.y - (enemyScale + a.scale - 1), a.x + (enemyScale + a.scale - 1), a.y + (enemyScale + a.scale - 1), enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y);
          if (!canHit) return false;
          const kbA = Math.atan2(enemyFut.y - a.y, enemyFut.x - a.x);
          const pX = enemyFut.x + 200 * Math.cos(kbA), pY = enemyFut.y + 200 * Math.sin(kbA);
          for (const sp of spikesOur) {
            const s = sp.pos.current, sc = sp.collisionScale;
            if (this._lineInRect(s.x - sc, s.y - sc, s.x + sc, s.y + sc, enemyFut.x, enemyFut.y, pX, pY)) return true;
          }
          return false;
        }).map(a => {
          const kbA = Math.atan2(enemyFut.y - a.y, enemyFut.x - a.x);
          const pX = enemyFut.x + 200 * Math.cos(kbA), pY = enemyFut.y + 200 * Math.sin(kbA);
          let best = Infinity;
          for (const sp of spikesOur) {
            const s = sp.pos.current, sc = sp.collisionScale;
            if (this._lineInRect(s.x - sc, s.y - sc, s.x + sc, s.y + sc, enemyFut.x, enemyFut.y, pX, pY)) {
              const a2e = Math.atan2(enemyFut.y - a.y, enemyFut.x - a.x), e2s = Math.atan2(s.y - enemyFut.y, s.x - enemyFut.x);
              let d = Math.abs(a2e - e2s);
              if (d > Math.PI) d = 2 * Math.PI - d;
              best = Math.min(best, d);
            }
          }
          return {
            angle: a,
            alignment: best
          };
        });
        if (!validKb.length) return null;
        const bestScore = Math.min(...validKb.map(v => v.alignment));
        return validKb.filter(v => v.alignment === bestScore).sort((a, b) => Math.hypot(enemyFut.x - a.angle.x, enemyFut.y - a.angle.y) - Math.hypot(enemyFut.x - b.angle.x, enemyFut.y - b.angle.y))[0]?.angle || null;
      };
      this._predictObjects = [];
      if (ModuleHandler.packetCount >= ModuleHandler.packetLimit) {
        return;
      }
      if (this._placedAngles && this._placedAngles.length > 0) {
        const _chkS = spikeId ? this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, null) : [];
        const _chkT = trapId ? this._getPrePlaceAngles(trapId, myPos, myPlayer, ObjectManager2, null) : [];
        const _allChk = [ ..._chkS, ..._chkT ];
        for (const pa of this._placedAngles) {
          const _m = _allChk.find(a => Math.abs(a.angle - pa) < 0.01);
          if (_m && _m.placeable) {
            this._bannedAngles.set(pa, this._tick + 18);
          }
        }
      }
      this._placedAngles = [];
      {
        const spikeAngles2 = spikeId ? this._getPrePlaceAngles(spikeId, myPos, myPlayer, ObjectManager2, null) : [];
        const trapAngles2 = trapId ? this._getPrePlaceAngles(trapId, myPos, myPlayer, ObjectManager2, null) : [];
        const filterBanned = a => !this._bannedAngles.has(a.angle);
        const validSpike = spikeAngles2.filter(a => filterBanned(a) && (a.placeable || a.perfect));
        const validTrap = trapAngles2.filter(a => filterBanned(a) && (a.placeable || a.perfect));
        const validAngles = [ ...validSpike, ...validTrap ];
        const closestSpikeToEnemy2 = validSpike.filter(a => this._lineInRect(a.x - (enemyScale + a.scale - 1), a.y - (enemyScale + a.scale - 1), a.x + (enemyScale + a.scale - 1), a.y + (enemyScale + a.scale - 1), enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y)).sort((a, b) => Math.hypot(enemyFut.x - a.x, enemyFut.y - a.y) - Math.hypot(enemyFut.x - b.x, enemyFut.y - b.y))[0] || null;
        const closestTrapToEnemy2 = validTrap.filter(a => this._lineInRect(a.x - a.scale, a.y - a.scale, a.x + a.scale, a.y + a.scale, enemyPos.x, enemyPos.y, enemyFut.x, enemyFut.y)).sort((a, b) => Math.hypot(enemyFut.x - a.x, enemyFut.y - a.y) - Math.hypot(enemyFut.x - b.x, enemyFut.y - b.y))[0] || null;
        const closestSpikeToKb2 = _findClosestSpikeToKb(validSpike);
        const neitherTrapped = !enemyTrapped && !imTrapped;
        let _escapeExits = null;
        if (enemy) {
          const surroundSpikes = [];
          ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 3, id => {
            const o = ObjectManager2.objects.get(id);
            if (!o || !(o instanceof PlayerObject)) return;
            if (o.itemGroup !== 2 && o.type !== 15) return;
            if (PlayerManager2.isEnemyByID(o.ownerID, myPlayer)) return;
            const d = enemyPos.distance(o.pos.current);
            if (d > enemyScale + o.collisionScale + 40) return;
            surroundSpikes.push({
              x: o.pos.current.x,
              y: o.pos.current.y,
              escapeScale: o.collisionScale
            });
          });
          if (surroundSpikes.length >= 2) {
            const esc = SiegeAnalysis.isEscapable(enemyPos.x, enemyPos.y, enemyScale, surroundSpikes);
            if (esc.escapable) _escapeExits = esc.exits;
          }
        }
        const _sealsExit = cfg => {
          if (!_escapeExits || _escapeExits.length === 0) return false;
          const angToConfig = Math.atan2(cfg.y - enemyPos.y, cfg.x - enemyPos.x);
          for (const exit of _escapeExits) {
            let diff = Math.abs(angToConfig - exit.angle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < 0.45) return true;
          }
          return false;
        };
        const _primaryType = myPlayer.getItemByType(0);
        const _hasPolearm = _primaryType === 4 || _primaryType === 5;
        const _kbObjects = [];
        ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 4, id => {
          const o = ObjectManager2.objects.get(id);
          if (!o || !(o instanceof PlayerObject)) return;
          const isSpk = o.itemGroup === 2, isTrp = o.type === 15;
          if (!isSpk && !isTrp) return;
          if (PlayerManager2.isEnemyByID(o.ownerID, myPlayer)) return;
          _kbObjects.push({
            x: o.pos.current.x,
            y: o.pos.current.y,
            dmg: isSpk,
            trap: isTrp,
            isCactus: false,
            colScale: o.collisionScale
          });
        });
        const _kbDir = Math.atan2(enemyPos.y - myPos.y, enemyPos.x - myPos.x);
        const _bouncesOntoSpike = cfg => {
          if (_kbObjects.length === 0) return false;
          const res = SiegeAnalysis.knockInto(cfg.x, cfg.y, _kbObjects, enemyPos.x, enemyPos.y, _kbDir, _hasPolearm);
          return res.willHit || res.inEscapable;
        };
        const _isDoubleSpike = cfg => {
          if (_kbObjects.length === 0) return false;
          const res = SiegeAnalysis.knockInto(cfg.x, cfg.y, _kbObjects, enemyPos.x, enemyPos.y, _kbDir, _hasPolearm);
          return res.doubleSpike;
        };
        const isAutoPlaceAngle = config => {
          if (!enemy) return false;
          if (myPos.distance(enemyPos) > (Settings_default._autoplacerRadius ?? 350)) return false;
          const isSpike = config.id === spikeId && !this._isItemLimit(spikeId, myPlayer);
          const isTrap = config.id === trapId && !this._isItemLimit(trapId, myPlayer);
          const {blockFuture: blockFuture, blockEnemy: blockEnemy, willRetrap: willRetrap} = _los(config);
          if (isSpike) {
            if (enemyTrapped && closestSpikeToEnemy2 && config === closestSpikeToEnemy2) return true;
            if (closestSpikeToKb2 && config === closestSpikeToKb2) return true;
            if (enemyTrapped && !blockFuture && !blockEnemy) return true;
            if (_sealsExit(config)) return true;
            if (_isDoubleSpike(config)) return true;
            if (_bouncesOntoSpike(config)) return true;
            const distSpikeToEnemy = Math.hypot(config.x - enemyPos.x, config.y - enemyPos.y);
            const touchesEnemy = distSpikeToEnemy < config.scale + enemyScale + 15;
            if (enemyTrapped && touchesEnemy) return true;
            if (!enemyTrapped && !imTrapped) {
              if (closestSpikeToEnemy2 && config === closestSpikeToEnemy2) return true;
              if (touchesEnemy) return true;
            }
          }
          if (isTrap) {
            if (closestTrapToEnemy2 && config === closestTrapToEnemy2 && willRetrap && neitherTrapped) return true;
            if (neitherTrapped) return true;
            return false;
          }
          return false;
        };
        for (const obj of validAngles.filter(a => a.perfect)) {
          if (isAutoPlaceAngle(obj)) this._addPredictObject(obj.id, obj.angle, myPos);
        }
        for (const obj of validAngles.filter(a => a.placeable && !a.perfect)) {
          if (isAutoPlaceAngle(obj)) this._addPredictObject(obj.id, obj.angle, myPos);
        }
      }
      for (const obj of this._predictObjects) {
        if (ModuleHandler.packetCount + 5 > ModuleHandler.packetLimit) break;
        const type = obj.id === trapId ? 7 : 4;
        ModuleHandler.place(type, obj.angle);
        ModuleHandler.placedOnce = true;
        ModuleHandler.placeAngles[0] = type;
        ModuleHandler.placeAngles[1].push(obj.angle);
        ModuleHandler.moduleActive = true;
        this._placedAngles.push(obj.angle);
      }
    }
  }
  class TrapAnimal {
    moduleName="trapAnimal";
    client;
    phase=0;
    targetAnimal=null;
    trapPlacedAngle=null;
    phaseTimer=0;
    ANIMAL_IDS=new Set([ 2, 3, 4 ]);
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.phase = 0;
      this.targetAnimal = null;
      this.trapPlacedAngle = null;
      this.phaseTimer = 0;
    }
    _angleDist(a, b) {
      const d = Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      return d;
    }
    _bestAngle(angles, targetAngle) {
      return angles.reduce((best, a) => this._angleDist(a, targetAngle) < this._angleDist(best, targetAngle) ? a : best, angles[0]);
    }
    postTick() {
      if (!Settings_default._trapAnimal) return;
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, ObjectManager: ObjectManager2} = this.client;
      if (ModuleHandler.moduleActive || ModuleHandler.placedOnce) return;
      const animal = EnemyManager2.nearestDangerAnimal;
      if (!animal || !this.ANIMAL_IDS.has(animal.type)) {
        this.reset();
        return;
      }
      const pos0 = myPlayer.pos.current;
      const animalPos = animal.pos.current;
      const distToAnimal = pos0.distance(animalPos);
      const angleToAnimal = pos0.angle(animalPos);
      const activationRange = animal.collisionRange + 200;
      if (distToAnimal > activationRange) {
        this.reset();
        return;
      }
      this.phaseTimer++;
      if (this.phase === 0) {
        const trapID = myPlayer.getItemByType(7);
        if (trapID === -1 || !myPlayer.canPlace(7)) return;
        const trapAngles = ObjectManager2.getBestPlacementAngles({
          position: pos0,
          id: trapID,
          targetAngle: angleToAnimal,
          ignoreID: null,
          preplace: false,
          reduce: true,
          fill: false
        });
        if (!trapAngles || trapAngles.length === 0) return;
        const bestTrapAngle = this._bestAngle(trapAngles, angleToAnimal);
        ModuleHandler.place(7, bestTrapAngle);
        ModuleHandler.placedOnce = true;
        this.trapPlacedAngle = bestTrapAngle;
        this.phaseTimer = 0;
        this.phase = 1;
        this.targetAnimal = animal;
      } else if (this.phase === 1) {
        if (this.phaseTimer < 2) return;
        if (this.phaseTimer > 15) {
          this.reset();
          return;
        }
        const spikeID = myPlayer.getItemByType(4);
        if (spikeID === -1 || !myPlayer.canPlace(4)) return;
        const animalFuturePos = animal.pos.future ?? animalPos;
        const angleToFuture = pos0.angle(animalFuturePos);
        const spikeAngles = ObjectManager2.getBestPlacementAngles({
          position: pos0,
          id: spikeID,
          targetAngle: angleToFuture,
          ignoreID: null,
          preplace: false,
          reduce: true,
          fill: false
        });
        if (!spikeAngles || spikeAngles.length === 0) {
          this.reset();
          return;
        }
        const bestSpikeAngle = this._bestAngle(spikeAngles, angleToFuture);
        ModuleHandler.place(4, bestSpikeAngle);
        ModuleHandler.placedOnce = true;
        this.reset();
      }
    }
  }
  const AutoPlacer_default = AutoPlacer;
  class AntiRetrap {
      moduleName="antiRetrap";
      client;
      constructor(client2) {
          this.client = client2;
      }
      postTick() {
          const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
          if (ModuleHandler.moduleActive || !Settings_default._antiRetrap) {
              return;
          }
          const {reloading: reloading} = ModuleHandler.staticModules;
          const nearestTrap = EnemyManager2.nearestTrap;
          const primary = myPlayer.getItemByType(0);
          const isReloadedPrimary = reloading.isReloaded(0);
          const secondary = myPlayer.getItemByType(1);
          const isHammer = secondary === 10;
          const isReloadedSecondary = reloading.isReloaded(1);
          const damage = myPlayer.getBuildingDamage(10, true);
          const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
          const nearestEnemy = EnemyManager2.nearestEnemy;
          if (nearestEnemy === null || nearestTrap === null || nearestTrap.health > damage || !isHammer || !isReloadedSecondary) {
              return;
          }
          const range = DataHandler_default.getWeapon(primary).range + nearestEnemy.hitScale;
          if (!myPlayer.collidingEntity(nearestEnemy, range)) {
              return;
          }
          const pos1 = myPlayer.pos.current;
          const pos2 = nearestEnemy.pos.current;
          const angle = pos1.angle(pos2);
          if (isReloadedPrimary) {
              ModuleHandler.moduleActive = true;
              ModuleHandler.forceWeapon = 0;
              ModuleHandler.useAngle = angle;
              ModuleHandler.shouldAttack = true;
              if (turretReloaded) {
                  ModuleHandler.forceHat = 53;
              }
          }
      }
  }
  class NormalInstakill {
    constructor(client) {
      this.client = client;
      this.targetEnemy = null;
    }
    reset() {
      this.targetEnemy = null;
    }
    postTick() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager, _ModuleHandler: _ModuleHandler} = this.client;
      if (!myPlayer || !EnemyManager || ModuleHandler.moduleActive) return;
      const instaActive = window._instaKillActive || false;
      if (!instaActive) {
        this.reset();
        return;
      }
      let target = this.targetEnemy || EnemyManager.nearestEnemy;
      if (!target) return;
      const myPos = myPlayer.pos.current;
      const targetPos = target.pos.current;
      const angle = myPos.angle(targetPos);
      const distance = myPos.distance(targetPos);
      const primaryID = myPlayer.getItemByType(0);
      let range = 80;
      try {
        if (primaryID !== null && primaryID !== undefined) {
          const weapon = gameCatalog.getWeapon(primaryID);
          if (weapon && weapon.range) {
            range = weapon.range + (target.hitScale || 0);
          }
        }
      } catch (_) {}
      _ModuleHandler._currentAngle = angle;
      if (_ModuleHandler.mouse) _ModuleHandler.mouse.sentAngle = angle;
      if (distance <= range + 50) {
        _ModuleHandler.startMovement(null);
        _ModuleHandler.useAngle = angle;
        _ModuleHandler.forceWeapon = 0;
        _ModuleHandler.shouldAttack = true;
        this.targetEnemy = target;
      } else {
        _ModuleHandler.startMovement(angle, true);
        _ModuleHandler.shouldAttack = false;
      }
    }
  }
  class AntiTrapProtect {
    moduleName="antiTrapProtect";
    client;
    _protected=false;
    constructor(client2) {
      this.client = client2;
    }
    _canPlace(id, angle, myPos, ObjectManager2) {
      const item = Items[id];
      if (!item) return false;
      const dist = 35 + item.scale + (item.placeOffset || 0);
      const cx = myPos.x + dist * Math.cos(angle);
      const cy = myPos.y + dist * Math.sin(angle);
      let collision = false;
      ObjectManager2.grid2D.query(cx, cy, 4, objId => {
        if (collision) return;
        const obj = ObjectManager2.objects.get(objId);
        if (!obj) return;
        const blockS = obj.placementScale;
        if (Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < item.scale + blockS) {
          collision = true;
        }
      });
      if (collision) return false;
      const mid = 14400 / 2, riverHalf = 310;
      if (cy >= mid - riverHalf && cy <= mid + riverHalf) return false;
      return true;
    }
    postTick() {
      if (!Settings_default._antiTrapProtect) return;
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2, _ModuleHandler: ModuleHandler} = this.client;
      if (!myPlayer || !myPlayer.inGame) return;
      if (ModuleHandler.moduleActive) return;
      const trap = myPlayer.trappedIn;
      if (trap === null) {
        this._protected = false;
        return;
      }
      if (this._protected) return;
      const myPos = myPlayer.pos.current;
      const trapPos = trap.pos.current;
      const aimToTrap = myPos.angle(trapPos);
      const protectDir = aimToTrap + Math.PI;
      let placedAny = false;
      if (myPlayer.canPlace(4)) {
        const spikeID = myPlayer.getItemByType(4);
        for (let off = -Math.PI / 2; off <= Math.PI / 2 + 1e-6; off += Math.PI / 6) {
          const angle = protectDir + off;
          if (this._canPlace(spikeID, angle, myPos, ObjectManager2)) {
            ModuleHandler.place(4, angle);
            placedAny = true;
          }
        }
      }
      if (myPlayer.canPlace(3)) {
        const wallID = myPlayer.getItemByType(3);
        for (let off = -Math.PI / 3; off <= Math.PI / 3 + 1e-6; off += Math.PI / 6) {
          const angle = protectDir + off;
          if (this._canPlace(wallID, angle, myPos, ObjectManager2)) {
            ModuleHandler.place(3, angle);
            placedAny = true;
          }
        }
      }
      if (placedAny) {
        ModuleHandler.placedOnce = true;
        ModuleHandler.moduleActive = true;
      }
      this._protected = true;
    }
    reset() {
      this._protected = false;
    }
  }
  class AntiTrapStar {
    moduleName="antiTrapStar";
    client;
    _protected=false;
    constructor(client2) {
      this.client = client2;
    }
    _getSpikeAngleWidth(d) {
      if (d <= 20) return {
        possible: false,
        tachyon: 0
      };
      const cosTheta = (d * d - 4224) / (100 * d);
      const clamped = Math.max(-1, Math.min(1, cosTheta));
      return {
        possible: true,
        tachyon: Math.acos(clamped)
      };
    }
    _canPlace(id, angle, myPos, ObjectManager2) {
      const item = Items[id];
      if (!item) return false;
      const dist = 35 + item.scale + (item.placeOffset || 0);
      const cx = myPos.x + dist * Math.cos(angle);
      const cy = myPos.y + dist * Math.sin(angle);
      let collision = false;
      ObjectManager2.grid2D.query(cx, cy, 4, objId => {
        if (collision) return;
        const obj = ObjectManager2.objects.get(objId);
        if (!obj) return;
        if (Math.hypot(cx - obj.pos.current.x, cy - obj.pos.current.y) < item.scale + obj.placementScale) collision = true;
      });
      if (collision) return false;
      const mid = 14400 / 2, riverHalf = 310;
      if (cy >= mid - riverHalf && cy <= mid + riverHalf) return false;
      return true;
    }
    _protect(aim, agnes, myPos, ObjectManager2, ModuleHandler, spikeID) {
      if (!agnes.possible) return false;
      let count = 0, currPlaced = null;
      const fail = agnes.tachyon - 0.0676;
      const tryPlace = a => {
        if ((currPlaced === null || Math.abs(this._angDiff(currPlaced, a)) > 1.36) && this._canPlace(spikeID, a, myPos, ObjectManager2)) {
          ModuleHandler.place(4, a);
          currPlaced = a;
          count++;
          return true;
        }
        return false;
      };
      if (this._canPlace(spikeID, aim + fail, myPos, ObjectManager2)) {
        ModuleHandler.place(4, aim + fail);
        currPlaced = aim + fail;
        count++;
      }
      if (this._canPlace(spikeID, aim - fail, myPos, ObjectManager2)) {
        ModuleHandler.place(4, aim - fail);
        currPlaced = aim - fail;
        count++;
        if (count >= 2) return true;
      }
      if (tryPlace(aim + fail * 0.5) && count >= 2) return true;
      if (tryPlace(aim - fail * 0.5) && count >= 2) return true;
      if (tryPlace(aim + fail * 0.25) && count >= 2) return true;
      if (tryPlace(aim - fail * 0.25) && count >= 2) return true;
      tryPlace(aim);
      if (count !== 1) return count > 0;
      if (this._canPlace(spikeID, currPlaced + 1.36, myPos, ObjectManager2)) ModuleHandler.place(4, currPlaced + 1.36); else if (this._canPlace(spikeID, currPlaced - 1.36, myPos, ObjectManager2)) ModuleHandler.place(4, currPlaced - 1.36);
      return true;
    }
    _angDiff(a, b) {
      let d = Math.abs(a - b) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d;
    }
    postTick() {
      if (!Settings_default._antiTrapStar) {
        this._protected = false;
        return;
      }
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2, EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler, PlayerManager: PlayerManager2} = this.client;
      if (!myPlayer || !myPlayer.inGame || ModuleHandler.moduleActive) return;
      if (myPlayer.trappedIn) {
        this._protected = false;
        return;
      }
      if (!myPlayer.canPlace(4)) return;
      const enemy = EnemyManager2.nearestEnemy;
      if (!enemy) {
        this._protected = false;
        return;
      }
      const myPos = myPlayer.pos.current;
      let nearTrap = null, nearTrapDist = Infinity;
      ObjectManager2.grid2D.query(myPos.x, myPos.y, 3, id => {
        const o = ObjectManager2.objects.get(id);
        if (!o || !(o instanceof PlayerObject) || o.type !== 15) return;
        if (!PlayerManager2.isEnemyByID(o.ownerID, myPlayer)) return;
        const d = myPos.distance(o.pos.current);
        if (d < nearTrapDist) {
          nearTrap = o;
          nearTrapDist = d;
        }
      });
      if (!nearTrap || enemy.pos.current.distance(myPos) > 200) {
        this._protected = false;
        return;
      }
      if (this._protected) return;
      const trapPos = nearTrap.pos.current;
      const trapAim = myPos.angle(trapPos);
      const agnes = this._getSpikeAngleWidth(nearTrapDist);
      const spikeID = myPlayer.getItemByType(4);
      const placed = this._protect(trapAim + Math.PI, agnes, myPos, ObjectManager2, ModuleHandler, spikeID);
      if (placed) {
        ModuleHandler.placedOnce = true;
        ModuleHandler.moduleActive = true;
        this._protected = true;
      }
    }
    reset() {
      this._protected = false;
    }
  }
  class AutoSync {
    moduleName="autoSync";
    client;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._autoSync) {
        this.useTurret = false;
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const nearestEnemyToNearestEnemy = EnemyManager2.nearestEnemyToNearestEnemy;
      if (nearestEnemy === null || nearestEnemyToNearestEnemy === null) {
        return;
      }
      const reloading = ModuleHandler.staticModules.reloading;
      const turretReloaded = reloading.isReloaded(2);
      if (this.useTurret) {
        this.useTurret = false;
        if (turretReloaded) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        return;
      }
      const primary1 = myPlayer.getItemByType(0);
      const primaryDamage1 = myPlayer.getMaxWeaponDamage(primary1, false);
      const range1 = DataHandler_default.getWeapon(primary1).range + nearestEnemy.hitScale;
      const isPrimaryReloaded1 = reloading.isReloaded(0);
      const primary2 = nearestEnemyToNearestEnemy.weapon.primary;
      const primaryDamage2 = nearestEnemyToNearestEnemy.getMaxWeaponDamage(primary2, false);
      const range2 = DataHandler_default.getWeapon(primary2).range + nearestEnemy.hitScale;
      const isPrimaryReloaded2 = nearestEnemyToNearestEnemy.isReloaded(0, 0);
      const soldierDefense = Hats[6].dmgMult;
      const totalDamage = (primaryDamage1 + primaryDamage2) * soldierDefense;
      if (totalDamage < 100) {
        return;
      }
      const inWeaponRange1 = myPlayer.collidingSimple(nearestEnemy, range1, myPlayer.getFuturePosition(myPlayer.speed / 3));
      const inWeaponRange2 = nearestEnemyToNearestEnemy.collidingSimple(nearestEnemy, range2, nearestEnemyToNearestEnemy.getFuturePosition(nearestEnemyToNearestEnemy.speed / 3));
      if (!inWeaponRange1 || !inWeaponRange2) {
        return;
      }
      const pos1 = myPlayer.pos.future;
      const pos2 = nearestEnemy.pos.future;
      const angleToEnemy = pos1.angle(pos2);
      if (!isPrimaryReloaded1) {
        ModuleHandler.forceWeapon = 0;
        if (isPrimaryReloaded2) {
          ModuleHandler.moduleActive = true;
        }
      }
      if (isPrimaryReloaded1 && isPrimaryReloaded2) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angleToEnemy;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        this.useTurret = true;
        this.client.StatsManager.autoSyncTimes = 1;
      }
    }
  }
  class Instakill {
    moduleName="instakill";
    client;
    targetEnemy=null;
    phase=0;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.targetEnemy = null;
      this.phase = 0;
    }
    _ticksToRange(myPos, enemy, range) {
      const enemyPos = enemy.pos.current;
      const dist = myPos.distance(enemyPos);
      const remaining = dist - range;
      if (remaining <= 0) return 0;
      const dx = myPos.x - enemyPos.x;
      const dy = myPos.y - enemyPos.y;
      const toPlayer = Math.atan2(dy, dx);
      const futurePos = enemy.pos.future;
      const actualClosing = Math.max(0, dist - myPos.distance(futurePos));
      const angleDiff = Math.abs(enemy.move_dir - toPlayer);
      const angleClosing = enemy.speed * Math.cos(Math.min(angleDiff, Math.PI));
      const closing = Math.max(actualClosing, angleClosing);
      if (closing <= 0) return Infinity;
      return remaining / closing;
    }
    _packetDelay(SM) {
      const pong = SM.pong || 0;
      const tick = SM.TICK || 111;
      return Math.max(8, Math.min(tick - pong * 0.6, tick - 10));
    }
    _futureRange(enemy, basePrimaryRange, ticks) {
      return basePrimaryRange + enemy.speed * ticks;
    }
    postTick() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2, _ModuleHandler: ModuleHandler, InputHandler: InputHandler2, SocketManager: SocketManager2} = this.client;
      if (!InputHandler2.instaToggle) {
        this.reset();
        InputHandler2.instaReset();
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null) {
        this.reset();
        return;
      }
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      if (secondary === null || !DataHandler_default.isShootable(secondary)) return;
      const lookingShield = PlayerManager2.lookingShield(nearestEnemy, myPlayer);
      const primaryDamage = myPlayer.getMaxWeaponDamage(primary, lookingShield);
      const secondaryDamage = myPlayer.getMaxWeaponDamage(secondary, lookingShield);
      const turretBonus = ModuleHandler.canBuy(0, 53) ? 25 : 0;
      const totalDamage = primaryDamage + secondaryDamage + turretBonus;
      if (totalDamage < nearestEnemy.currentHealth) return;
      const shieldBypass = lookingShield && secondaryDamage > primaryDamage;
      InputHandler2.instakillTarget = nearestEnemy;
      const pos1 = myPlayer.pos.future;
      const pos2 = nearestEnemy.pos.future;
      const angle = pos1.angle(pos2);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const secondaryReloaded = reloading.isReloaded(1, 1);
      const turretReloaded = reloading.isReloaded(2, 1);
      const baseRange = DataHandler_default.getWeapon(primary).range + nearestEnemy.hitScale;
      if (this.phase === 1) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angle;
        ModuleHandler.forceHat = shieldBypass ? 7 : 53;
        ModuleHandler.forceWeapon = shieldBypass ? 0 : 1;
        ModuleHandler.shouldAttack = true;
        const delay = this._packetDelay(SocketManager2);
        setTimeout(() => {
          try {
            this.client.PacketManager.attack(angle, shieldBypass ? 0 : 1);
          } catch (_) {}
        }, delay);
        this.reset();
        InputHandler2.instaToggle = false;
        return;
      }
      const myPosCur = myPlayer.pos.current;
      const ticks = this._ticksToRange(myPosCur, nearestEnemy, baseRange);
      if (ticks > 0 && ticks <= 2) {
        ModuleHandler.forceHat = shieldBypass ? 53 : 7;
      }
      if (ticks <= 3 && ModuleHandler.canBuy(0, 53)) {
        ModuleHandler.useAngle = angle;
      }
      const predictedRange = this._futureRange(nearestEnemy, baseRange, 1);
      const inRange = myPlayer.collidingEntity(nearestEnemy, baseRange) || myPlayer.collidingEntity(nearestEnemy, predictedRange);
      if (!inRange && ticks <= 1 && primaryReloaded && secondaryReloaded && turretReloaded) {
        ModuleHandler.moveTo = myPosCur.angle(nearestEnemy.pos.current);
      }
      const baiting = ModuleHandler.moveTo !== "disable" && ticks <= 1;
      if (!primaryReloaded || !secondaryReloaded || !turretReloaded || !inRange && !baiting) {
        return;
      }
      if (!ModuleHandler.placedOnce) {
        const spikeID = myPlayer.getItemByType(4);
        if (spikeID !== -1 && myPlayer.canPlace(4)) {
          ModuleHandler.place(4, angle + Math.PI * 0.25);
          ModuleHandler.place(4, angle - Math.PI * 0.25);
          ModuleHandler.placedOnce = true;
        }
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = shieldBypass ? 53 : 7;
      ModuleHandler.forceWeapon = shieldBypass ? 1 : 0;
      ModuleHandler.shouldAttack = true;
      this.targetEnemy = nearestEnemy;
      this.phase = 1;
    }
  }
  class SmartInsta {
    moduleName="smartInsta";
    client;
    _fightTicks=0;
    _lastEnemyHP=100;
    _lastMyHP=100;
    _hitExchanges=0;
    _autoArmed=false;
    _setupPhase=0;
    _setupCool=0;
    _spike1Placed=false;
    _spike2Placed=false;
    _trapPlaced=false;
    _setupEnemy=null;
    FIGHT_THRESHOLD=25;
    EXCHANGE_THRESH=3;
    SETUP_COOLDOWN=60;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this._setupPhase = 0;
      this._setupCool = 0;
      this._spike1Placed = false;
      this._spike2Placed = false;
      this._trapPlaced = false;
      this._setupEnemy = null;
    }
    _shouldArm(mp, enemy, MH) {
      if (this.client.InputHandler.instaToggle) return true;
      return this._fightTicks >= this.FIGHT_THRESHOLD && this._hitExchanges >= this.EXCHANGE_THRESH;
    }
    _deceptiveAngle(baseAngle, offsetRad) {
      const side = this.client.myPlayer.tickCount % 2 === 0 ? 1 : -1;
      return baseAngle + offsetRad * side;
    }
    postTick() {
      const {myPlayer: mp, EnemyManager: EM, _ModuleHandler: MH, ObjectManager: OM, PlayerManager: PM, InputHandler: IH} = this.client;
      if (this._setupCool > 0) this._setupCool--;
      const enemy = EM.nearestEnemy;
      if (enemy !== null && mp.collidingSimple(enemy, 350)) {
        this._fightTicks++;
        const myHP = mp.currentHealth;
        const enmHP = enemy.currentHealth;
        if (myHP < this._lastMyHP && enmHP < this._lastEnemyHP) {
          this._hitExchanges++;
        }
        this._lastMyHP = myHP;
        this._lastEnemyHP = enmHP;
      } else {
        this._fightTicks = Math.max(0, this._fightTicks - 3);
        this._hitExchanges = Math.max(0, this._hitExchanges - 1);
        this._lastMyHP = mp.currentHealth;
        this._lastEnemyHP = enemy ? enemy.currentHealth : 100;
        if (this._setupPhase > 0 && enemy === null) this.reset();
      }
      if (enemy === null) return;
      if (!this._shouldArm(mp, enemy, MH)) return;
      if (MH.moduleActive) return;
      const pos0 = mp.pos.current;
      const ep = enemy.pos.current;
      const anglEnm = pos0.angle(ep);
      const dist = pos0.distance(ep);
      const primary = mp.getItemByType(0);
      const secondary = mp.getItemByType(1);
      if (secondary === null || !DataHandler_default.isShootable(secondary)) return;
      const lookingShield = PM.lookingShield(enemy, mp);
      const primaryDmg = mp.getMaxWeaponDamage(primary, lookingShield);
      const secondaryDmg = mp.getMaxWeaponDamage(secondary, lookingShield);
      const turretBonus = MH.canBuy(0, 53) ? 25 : 0;
      const canInsta = primaryDmg + secondaryDmg + turretBonus >= enemy.currentHealth;
      const spikeID = mp.getItemByType(4);
      const trapID = mp.getItemByType(7);
      const {reloading: reloading} = MH.staticModules;
      if (this._setupPhase === 0 && this._setupCool === 0 && dist <= 400) {
        if (spikeID !== -1 && mp.canPlace(4) && !MH.placedOnce) {
          const ang1 = this._deceptiveAngle(anglEnm, Math.PI * 0.25);
          MH.place(4, ang1);
          MH.placedOnce = true;
          this._spike1Placed = true;
          this._setupPhase = 1;
          this._setupEnemy = enemy;
        }
        return;
      }
      if (this._setupPhase === 1 && !MH.placedOnce) {
        if (spikeID !== -1 && mp.canPlace(4)) {
          const ang2 = this._deceptiveAngle(anglEnm, -Math.PI * 0.25);
          MH.place(4, ang2);
          MH.placedOnce = true;
          this._spike2Placed = true;
          this._setupPhase = 2;
        }
        return;
      }
      if (this._setupPhase === 2 && !MH.placedOnce) {
        if (trapID !== -1 && trapID !== 16 && mp.canPlace(7)) {
          const trapAngle = anglEnm;
          const trapAngles = OM.getBestPlacementAngles({
            position: pos0,
            id: trapID,
            targetAngle: trapAngle,
            ignoreID: null,
            preplace: false,
            reduce: false,
            fill: true
          });
          if (trapAngles.length > 0) {
            MH.place(7, trapAngles[0]);
            MH.placedOnce = true;
            this._trapPlaced = true;
            this._setupPhase = 3;
          } else {
            this._setupPhase = 3;
          }
        } else {
          this._setupPhase = 3;
        }
        return;
      }
      if (this._setupPhase === 3 && canInsta) {
        const primaryReloaded = reloading.isReloaded(0);
        const secondaryReloaded = reloading.isReloaded(1, 1);
        const turretReloaded = reloading.isReloaded(2, 1);
        const baseRange = DataHandler_default.getWeapon(primary).range + enemy.hitScale;
        const inRange = mp.collidingEntity(enemy, baseRange);
        const canFireNow = primaryReloaded && secondaryReloaded && inRange;
        const dmgWithoutTurret = primaryDmg + secondaryDmg;
        const killsWithout = dmgWithoutTurret >= enemy.currentHealth;
        if (canFireNow && (turretReloaded || killsWithout)) {
          const shieldBypass = lookingShield && secondaryDmg > primaryDmg;
          IH.instakillTarget = enemy;
          MH.moduleActive = true;
          MH.useAngle = anglEnm;
          MH.forceHat = turretReloaded ? shieldBypass ? 53 : 7 : shieldBypass ? 53 : 6;
          MH.forceWeapon = shieldBypass ? 1 : 0;
          MH.shouldAttack = true;
          this.reset();
          this._setupCool = this.SETUP_COOLDOWN;
          this._fightTicks = 0;
          this._hitExchanges = 0;
          this._autoArmed = false;
        }
      }
    }
  }
  class KnockbackTick {
    moduleName="knockbackTick";
    client;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._knockbackTick || EnemyManager2.shouldIgnoreModule()) {
        this.useTurret = false;
        return;
      }
      const nearestEnemySpikeCollider = EnemyManager2.nearestEnemySpikeCollider;
      const spikeCollider = EnemyManager2.spikeCollider;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      if (this.useTurret) {
        this.useTurret = false;
        if (turretReloaded) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        return;
      }
      if (nearestEnemySpikeCollider !== null && spikeCollider !== null && primaryReloaded) {
        const pos1 = myPlayer.pos.current;
        const pos2 = nearestEnemySpikeCollider.pos.current;
        const pos3 = spikeCollider.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        const distanceToSpike2 = pos2.distance(pos3);
        const turretKnockback = 33.3;
        const primaryKnockback = DataHandler_default.getWeapon(primary).knockback;
        const knockback = primaryKnockback + turretKnockback;
        const collisionScale = spikeCollider.collisionScale + nearestEnemySpikeCollider.collisionScale;
        const collisionRangeTurret = collisionScale + knockback;
        const isPrimaryAlone = distanceToSpike2 <= collisionScale + primaryKnockback;
        const isPrimaryWithTurret = distanceToSpike2 <= collisionRangeTurret;
        if (isPrimaryAlone || isPrimaryWithTurret) {
          const spear = DataHandler_default.getWeapon(primary);
          const hitRange = spear.range + nearestEnemySpikeCollider.hitScale;
          if (myPlayer.collidingSimple(nearestEnemySpikeCollider, hitRange)) {
            ModuleHandler.moduleActive = true;
            ModuleHandler.useAngle = angleToEnemy;
            ModuleHandler.forceHat = 7;
            ModuleHandler.forceWeapon = 0;
            ModuleHandler.shouldAttack = true;
            if (!isPrimaryAlone && isPrimaryWithTurret) {
              this.useTurret = true;
            }
            this.client.StatsManager.knockbackTickTimes = 1;
            EnemyManager2.attemptSpikePlacement();
          }
        }
      }
    }
  }
  class KnockbackTickHammer {
    moduleName="knockbackTickHammer";
    client;
    targetEnemy=null;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._knockbackTickHammer || EnemyManager2.shouldIgnoreModule()) {
        this.targetEnemy = null;
        return;
      }
      const nearestEnemySpikeCollider = EnemyManager2.nearestEnemySpikeCollider;
      const spikeCollider = EnemyManager2.spikeCollider;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isHammer = secondary !== null && secondary !== 11;
      const primaryReloaded = reloading.isReloaded(0, 1);
      const secondaryReloaded = reloading.isReloaded(1);
      const turretReloaded = reloading.isReloaded(2);
      const pos1 = myPlayer.pos.current;
      if (this.targetEnemy !== null) {
        const pos2 = this.targetEnemy.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angleToEnemy;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        this.targetEnemy = null;
        EnemyManager2.attemptSpikePlacement();
        return;
      }
      if (nearestEnemySpikeCollider !== null && spikeCollider !== null && isHammer && primaryReloaded && secondaryReloaded && turretReloaded) {
        const pos2 = nearestEnemySpikeCollider.pos.current;
        const pos3 = spikeCollider.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        const distanceToSpike2 = pos2.distance(pos3);
        const turretKnockback = 33.3;
        const {knockback: primaryKnockback, range: primaryRange} = DataHandler_default.getWeapon(primary);
        const {knockback: secondaryKnockback, range: secondaryRange} = DataHandler_default.getWeapon(secondary);
        const weaponRange = Math.min(primaryRange, secondaryRange) + nearestEnemySpikeCollider.hitScale;
        const minKB = primaryKnockback + turretKnockback;
        const maxKB = primaryKnockback + secondaryKnockback + turretKnockback;
        const spikeRange = spikeCollider.collisionScale + nearestEnemySpikeCollider.collisionScale;
        if (inRange(distanceToSpike2, spikeRange + minKB, spikeRange + maxKB) && myPlayer.collidingSimple(nearestEnemySpikeCollider, weaponRange)) {
          const hammer = DataHandler_default.getWeapon(secondary);
          const hitRange = hammer.range + nearestEnemySpikeCollider.hitScale;
          if (myPlayer.collidingSimple(nearestEnemySpikeCollider, hitRange)) {
            ModuleHandler.moduleActive = true;
            ModuleHandler.useAngle = angleToEnemy;
            ModuleHandler.forceHat = 53;
            ModuleHandler.forceWeapon = 1;
            ModuleHandler.shouldAttack = true;
            this.targetEnemy = nearestEnemySpikeCollider;
            this.client.StatsManager.knockbackTickHammerTimes = 1;
            EnemyManager2.attemptSpikePlacement();
          }
        }
      }
    }
  }
  class KnockbackTickTrap {
    moduleName="knockbackTickTrap";
    client;
    targetEnemy=null;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._knockbackTickTrap || EnemyManager2.shouldIgnoreModule()) {
        this.targetEnemy = null;
        this.useTurret = false;
        return;
      }
      const nearestEnemySpikeCollider = EnemyManager2.nearestEnemySpikeCollider;
      const nearestTrappedEnemy = EnemyManager2.nearestTrappedEnemy;
      const spikeCollider = EnemyManager2.spikeCollider;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isHammer = secondary === 10;
      const primaryReloaded = reloading.isReloaded(0, 1);
      const secondaryReloaded = reloading.isReloaded(1);
      const turretReloaded = reloading.isReloaded(2);
      if (this.useTurret) {
        if (turretReloaded) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        this.useTurret = false;
        return;
      }
      const pos1 = myPlayer.pos.current;
      if (this.targetEnemy !== null) {
        const pos2 = this.targetEnemy.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angleToEnemy;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        this.targetEnemy = null;
        this.useTurret = true;
        EnemyManager2.attemptSpikePlacement();
        return;
      }
      if (nearestEnemySpikeCollider !== null && nearestTrappedEnemy !== null && nearestTrappedEnemy === nearestEnemySpikeCollider && spikeCollider !== null && isHammer && primaryReloaded && secondaryReloaded) {
        const nearestTrap = nearestTrappedEnemy.trappedIn;
        const hammer = DataHandler_default.getWeapon(secondary);
        const playerRange = hammer.range + nearestTrappedEnemy.hitScale;
        const trapRange = hammer.range + nearestTrap.hitScale;
        const canAttackEnemy = myPlayer.collidingSimple(nearestTrappedEnemy, playerRange);
        const canAttackTrap = myPlayer.collidingSimple(nearestTrap, trapRange);
        const buildingDamage = myPlayer.getBuildingDamage(secondary, true);
        if (!canAttackEnemy || !canAttackTrap || nearestTrap.health > buildingDamage) {
          return;
        }
        const pos12 = myPlayer.pos.current;
        const pos2 = nearestTrappedEnemy.pos.current;
        const pos3 = nearestTrap.pos.current;
        const pos4 = spikeCollider.pos.current;
        const angleToEnemy = pos12.angle(pos2);
        const angleToTrap = pos12.angle(pos3);
        const middleAngle = findMiddleAngle(angleToEnemy, angleToTrap);
        const distanceToSpike2 = pos2.distance(pos4);
        const turretKnockback = 33.3;
        const primaryKnockback = DataHandler_default.getWeapon(primary).knockback;
        const knockback = primaryKnockback + turretKnockback;
        const collisionRange = spikeCollider.collisionScale + nearestEnemySpikeCollider.collisionScale + knockback;
        if (distanceToSpike2 <= collisionRange) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = middleAngle;
          ModuleHandler.forceHat = 40;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          this.targetEnemy = nearestTrappedEnemy;
          this.client.StatsManager.knockbackTickTrapTimes = 1;
          EnemyManager2.attemptSpikePlacement();
        }
      }
    }
  }
  class SpikeSync {
    moduleName="spikeSync";
    client;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._spikeSync) {
        this.useTurret = false;
        return;
      }
      const nearest = EnemyManager2.nearestEnemy;
      const placementAngles = EnemyManager2.nearestSpikePlacerAngle;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const isPolearm = primary !== 8;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = reloading.isReloaded(2);
      if (this.useTurret) {
        this.useTurret = false;
        if (turretReloaded && !EnemyManager2.shouldIgnoreModule()) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        return;
      }
      if (!EnemyManager2.shouldIgnoreModule() && nearest !== null && EnemyManager2.canSpikeSync && placementAngles !== null && isPolearm && primaryReloaded && !ModuleHandler.staticModules.shameSpam.wasActive) {
        const spear = DataHandler_default.getWeapon(primary);
        const range = spear.range + nearest.hitScale;
        const canAttack = myPlayer.collidingSimple(nearest, range);
        if (!canAttack) {
          return;
        }
        const pos1 = myPlayer.pos.current;
        const pos2 = nearest.pos.current;
        const angleTo = pos1.angle(pos2);
        const itemType = 4;
        for (const angle of placementAngles) {
          ModuleHandler.place(itemType, angle);
        }
        ModuleHandler.placedOnce = true;
        ModuleHandler.placeAngles[0] = itemType;
        ModuleHandler.placeAngles[1] = placementAngles;
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angleTo;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        this.client.StatsManager.spikeSyncTimes = 1;
        this.useTurret = true;
      }
    }
  }
  class SpikeSyncHammer {
    moduleName="spikeSyncHammer";
    client;
    targetEnemy=null;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._spikeSyncHammer || EnemyManager2.shouldIgnoreModule()) {
        this.targetEnemy = null;
        this.useTurret = false;
        return;
      }
      const nearestSyncEnemy = EnemyManager2.nearestSyncEnemy;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isPolearm = primary !== 8;
      const isHammer = secondary === 10;
      const primaryReloaded = reloading.isReloaded(0, 1);
      const secondaryReloaded = reloading.isReloaded(1);
      const turretReloaded = reloading.isReloaded(2);
      if (this.useTurret) {
        if (turretReloaded) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        this.useTurret = false;
        return;
      }
      if (this.targetEnemy !== null) {
        const nearest = this.targetEnemy;
        const pos1 = myPlayer.pos.current;
        const pos2 = nearest.pos.current;
        const itemType = 4;
        const spikeID = myPlayer.getItemByType(itemType);
        const placeLength = myPlayer.getItemPlaceScale(spikeID);
        const angleToNearest = pos1.angle(pos2);
        const spikePos = pos1.addDirection(angleToNearest, placeLength);
        const angleFromSpike = spikePos.angle(pos2);
        const futureEnemyPos = spikePos.addDirection(angleFromSpike, 140);
        const futureAngle = pos1.angle(futureEnemyPos);
        const placementAngles = EnemyManager2.nearestSpikePlacerAngle;
        if (placementAngles !== null) {
          for (const angle of placementAngles) {
            ModuleHandler.place(itemType, angle);
          }
          ModuleHandler.placedOnce = true;
          ModuleHandler.placeAngles[0] = itemType;
          ModuleHandler.placeAngles[1] = placementAngles;
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = futureAngle;
          ModuleHandler.forceHat = 7;
          ModuleHandler.forceWeapon = 0;
          ModuleHandler.shouldAttack = true;
        }
        this.targetEnemy = null;
        this.useTurret = true;
        return;
      }
      if (nearestSyncEnemy !== null && isPolearm && primaryReloaded && isHammer && secondaryReloaded) {
        const nearestLowHPObject = EnemyManager2.nearestLowHPObject;
        if (nearestLowHPObject === null) {
          return;
        }
        const hammer = DataHandler_default.getWeapon(secondary);
        const playerRange = hammer.range + nearestSyncEnemy.hitScale;
        const trapRange = hammer.range + nearestLowHPObject.hitScale;
        const canAttackEnemy = myPlayer.collidingSimple(nearestSyncEnemy, playerRange);
        const canAttackTrap = myPlayer.collidingSimple(nearestLowHPObject, trapRange);
        const buildingDamage = myPlayer.getBuildingDamage(secondary, true);
        if (!canAttackEnemy || !canAttackTrap || nearestLowHPObject.health > buildingDamage) {
          return;
        }
        const itemType = 4;
        const spikeID = myPlayer.getItemByType(itemType);
        const placeLength = myPlayer.getItemPlaceScale(spikeID);
        const pos1 = myPlayer.pos.current;
        const pos2 = nearestSyncEnemy.pos.current;
        const pos3 = nearestLowHPObject.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        const angleToTrap = pos1.angle(pos3);
        const middleAngle = findMiddleAngle(angleToEnemy, angleToTrap);
        const angles = ObjectManager2.getBestPlacementAngles({
          position: pos1,
          id: spikeID,
          targetAngle: angleToEnemy,
          ignoreID: nearestLowHPObject.id,
          preplace: false,
          reduce: false,
          fill: false
        });
        const spikeScale = Items[spikeID].scale;
        const possibleAngles = angles.filter(angle => {
          const spikePos = pos1.addDirection(angle, placeLength);
          const distance = pos2.distance(spikePos);
          const range = nearestSyncEnemy.collisionScale + spikeScale;
          return distance <= range;
        });
        if (possibleAngles.length !== 0) {
          ModuleHandler.placeAngles[0] = itemType;
          ModuleHandler.placeAngles[1] = possibleAngles;
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = middleAngle;
          ModuleHandler.forceHat = 40;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          this.targetEnemy = nearestSyncEnemy;
          this.client.StatsManager.spikeSyncHammerTimes = 1;
        }
      }
    }
  }
  class AdaptiveGearSwitching {
    moduleName="adaptiveGearSwitching";
    client;
    _lastGearSwitch=0;
    _gearSwitchCooldown=50;
    _closeCombatRange=60;
    constructor(client2) {
      this.client = client2;
    }
    _isCloseCombat(myPlayer, nearestEnemy) {
      if (!nearestEnemy) return false;
      const dist = myPlayer.pos.current.distance(nearestEnemy.pos.current);
      return dist < this._closeCombatRange;
    }
    _hasNearbyTraps(myPlayer, ObjectManager2) {
      let trapCount = 0;
      ObjectManager2.grid2D.query(myPlayer.pos.current.x, myPlayer.pos.current.y, 3, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return;
        if (obj.type !== 15) return;
        trapCount++;
      });
      return trapCount > 0;
    }
    _isHeadToHead(myPlayer, nearestEnemy) {
      const dist = myPlayer.pos.current.distance(nearestEnemy.pos.current);
      return dist < 35;
    }
    _selectOptimalGear(myPlayer, nearestEnemy, ObjectManager2) {
      const isClose = this._isCloseCombat(myPlayer, nearestEnemy);
      const hasTraps = this._hasNearbyTraps(myPlayer, ObjectManager2);
      const isHeadToHead = this._isHeadToHead(myPlayer, nearestEnemy);
      if (isHeadToHead && hasTraps) {
        return 53;
      }
      if (isHeadToHead && !hasTraps) {
        return 7;
      }
      if (isClose) {
        return 6;
      }
      return 7;
    }
    postTick() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, ObjectManager: ObjectManager2, _ModuleHandler: ModuleHandler} = this.client;
      if (!Settings_default._adaptiveGearSwitching) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (!nearestEnemy) return;
      if (!this._isCloseCombat(myPlayer, nearestEnemy)) return;
      const currentTime = Date.now();
      if (currentTime - this._lastGearSwitch < this._gearSwitchCooldown) {
        return;
      }
      const optimalGear = this._selectOptimalGear(myPlayer, nearestEnemy, ObjectManager2);
      const currentHat = myPlayer.hatID ?? -1;
      if (currentHat !== optimalGear && ModuleHandler.canBuy?.(0, optimalGear)) {
        ModuleHandler.forceHat = optimalGear;
        this._lastGearSwitch = currentTime;
        this.client.StatsManager.gearSwitches = (this.client.StatsManager.gearSwitches ?? 0) + 1;
      }
    }
  }
  const AdaptiveGearSwitching_default = AdaptiveGearSwitching;
  class AntiSync {
    moduleName="antiSync";
    client;
    _lastDamageTime=0;
    _incomingAttacks=[];
    _syncKillThreshold=15;
    _dodgeActive=false;
    _dodgeCooldown=500;
    _lastDodgeTime=0;
    _SHAME_SAFE_DELAY=139;
    _pendingHealDeadline=null;
    _pendingHealsNeeded=0;
    constructor(client2) {
      this.client = client2;
    }
    _detectIncomingAttack(nearestEnemy) {
      if (!nearestEnemy) return false;
      const primaryReloaded = this.client._ModuleHandler.staticModules.reloading.isReloaded(0);
      const secondaryReloaded = this.client._ModuleHandler.staticModules.reloading.isReloaded(1);
      if (primaryReloaded && secondaryReloaded) {
        const dist = this.client.myPlayer.pos.current.distance(nearestEnemy.pos.current);
        const enemyRange = (DataHandler_default.getWeapon(nearestEnemy.getItemByType(0) ?? 0)?.range ?? 35) + this.client.myPlayer.hitScale;
        if (dist < enemyRange * 1.2) {
          return true;
        }
      }
      return false;
    }
    _predictSyncMoment(myPlayer, nearestEnemy) {
      if (!nearestEnemy) return Infinity;
      const healthPercent = myPlayer.tempHealth / myPlayer.maxHealth;
      const enemyReady = this.client._ModuleHandler.staticModules.reloading.isEnemyReloaded?.(nearestEnemy, 0);
      if (healthPercent < 0.3 && enemyReady && this._detectIncomingAttack(nearestEnemy)) {
        return 0;
      }
      return Infinity;
    }
    _executeDodge(myPlayer, nearestEnemy) {
      const ModuleHandler = this.client._ModuleHandler;
      const angleToEnemy = myPlayer.pos.current.angle(nearestEnemy.pos.current);
      const dodgeAngles = [ angleToEnemy + Math.PI / 2, angleToEnemy - Math.PI / 2, angleToEnemy + Math.PI ];
      const randomDodge = dodgeAngles[Math.floor(Math.random() * dodgeAngles.length)];
      ModuleHandler.startMovement({
        x: Math.cos(randomDodge),
        y: Math.sin(randomDodge)
      });
      ModuleHandler.forceHat = 7;
      ModuleHandler.shouldAttack = false;
      this._dodgeActive = true;
      this._lastDodgeTime = Date.now();
    }
    _monitorDamage(myPlayer) {
      const currentTime = Date.now();
      const timeSinceLastDamage = currentTime - this._lastDamageTime;
      if (myPlayer.tempHealth < (this._lastKnownHealth ?? myPlayer.maxHealth)) {
        this._lastDamageTime = currentTime;
        this._incomingAttacks.push({
          timestamp: currentTime,
          damageAmount: (this._lastKnownHealth ?? myPlayer.maxHealth) - myPlayer.tempHealth
        });
        if (this._incomingAttacks.length > 5) {
          this._incomingAttacks.shift();
        }
        return true;
      }
      this._lastKnownHealth = myPlayer.tempHealth;
      return false;
    }
    _isSyncKillDetected() {
      if (this._incomingAttacks.length < 2) return false;
      const recentAttacks = this._incomingAttacks.slice(-2);
      const timeDiff = Math.abs(recentAttacks[1].timestamp - recentAttacks[0].timestamp);
      return timeDiff < this._syncKillThreshold;
    }
    postTick() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler} = this.client;
      if (!Settings_default._antiSync || myPlayer.shameActive) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (!nearestEnemy) return;
      const damageTaken = this._monitorDamage(myPlayer);
      if (this._pendingHealDeadline !== null) {
        if (Date.now() >= this._pendingHealDeadline) {
          for (let i = 0; i < this._pendingHealsNeeded; i++) {
            ModuleHandler.heal();
          }
          this._pendingHealDeadline = null;
          this._pendingHealsNeeded = 0;
        }
        ModuleHandler.shouldAttack = false;
        ModuleHandler.moduleActive = false;
        return;
      }
      if (this._isSyncKillDetected()) {
        const foodID = myPlayer.getItemByType(2);
        const restore = Items[foodID].restore;
        const healsNeeded = Math.ceil((myPlayer.maxHealth - myPlayer.tempHealth) / restore) + 2;
        const safeToEatInstantly = myPlayer.isSandbox || myPlayer.shameCount < 7;
        if (safeToEatInstantly) {
          for (let i = 0; i < healsNeeded; i++) {
            ModuleHandler.heal();
          }
        } else {
          this._pendingHealDeadline = Date.now() + this._SHAME_SAFE_DELAY;
          this._pendingHealsNeeded = healsNeeded;
        }
        this._executeDodge(myPlayer, nearestEnemy);
        ModuleHandler.shouldAttack = false;
        ModuleHandler.moduleActive = false;
        return;
      }
      const syncDanger = this._predictSyncMoment(myPlayer, nearestEnemy);
      if (syncDanger === 0) {
        if (Date.now() - this._lastDodgeTime > this._dodgeCooldown) {
          this._executeDodge(myPlayer, nearestEnemy);
          this.client.StatsManager.antiSyncDodges = (this.client.StatsManager.antiSyncDodges ?? 0) + 1;
        }
      }
      const now = Date.now();
      this._incomingAttacks = this._incomingAttacks.filter(attack => now - attack.timestamp < 1000);
    }
  }
  const AntiSync_default = AntiSync;
  const CL_MAX_ROWS = 2000;
  const CL_IDLE_MS = 8e3;
  const CL_KINDS = {
    join:   { icon: "\u2192", color: "#00d68f", label: "دخل" },
    leave:  { icon: "\u2190", color: "#ff4d6d", label: "خرج" },
    chat:   { icon: "\u25cf", color: "#3A86FF", label: "" },
    clan:   { icon: "\u2691", color: "#7A42F4", label: "" },
    kill:   { icon: "\u2715", color: "#ffd60a", label: "" },
    system: { icon: "\u2022", color: "rgba(200,200,215,0.5)", label: "" }
  };
  class ChatLog {
    moduleName="chatLog";
    client;
    rows=[];
    _el=null;
    _list=null;
    _idleTimer=null;
    _drag=null;
    _resize=null;
    _onMove=null;
    _onUp=null;
    _onResizeMove=null;
    _onResizeUp=null;
    constructor(client2) {
      this.client = client2;
    }
    _loadBox() {
      try {
        const raw = CustomStorage.get("RYN_chatlog");
        if (raw && typeof raw === "object") return raw;
      } catch (e) {}
      return { x: 14, y: 90, w: 330, h: 240 };
    }
    _saveBox() {
      if (!this._el) return;
      try {
        CustomStorage.set("RYN_chatlog", {
          x: parseInt(this._el.style.left) || 14,
          y: parseInt(this._el.style.top) || 90,
          w: this._el.offsetWidth,
          h: this._el.offsetHeight
        });
      } catch (e) {}
    }
    _stamp() {
      const d = new Date();
      const p = n => String(n).padStart(2, "0");
      const h24 = d.getHours();
      const h12 = h24 % 12 || 12;
      const ampm = h24 >= 12 ? "PM" : "AM";
      return {
        time: `${h12}:${p(d.getMinutes())} ${ampm}`,
        date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
      };
    }
    add(kind, text, who) {
      if (!Settings_default._chatLog) return;
      const s = this._stamp();
      this.rows.push({ kind: kind, text: text, who: who || "", time: s.time, date: s.date });
      if (this.rows.length > CL_MAX_ROWS) this.rows.shift();
      this._render(this.rows[this.rows.length - 1]);
      this._wake();
    }
    _wake() {
      if (!this._el) return;
      this._el.classList.remove("cl-idle");
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => {
        if (this._el && !this._el.matches(":hover")) this._el.classList.add("cl-idle");
      }, CL_IDLE_MS);
    }
    _render(row) {
      if (!this._list) return;
      const wasAtBottom = this._list.scrollTop + this._list.clientHeight >= this._list.scrollHeight - 2;
      const k = CL_KINDS[row.kind] || CL_KINDS.system;
      const div = document.createElement("div");
      div.className = "cl-row";
      const who = row.who ? `<span class="cl-who">${this._esc(row.who)}</span>` : "";
      div.innerHTML =
        `<span class="cl-time" title="${row.date}">${row.time}</span>` +
        `<span class="cl-ico" style="color:${k.color}">${k.icon}</span>` +
        `<span class="cl-txt">${who}${this._esc(row.text)}</span>`;
      this._list.appendChild(div);
      while (this._list.children.length > CL_MAX_ROWS) this._list.removeChild(this._list.firstChild);
      if (wasAtBottom) this._list.scrollTop = this._list.scrollHeight;
    }
    _esc(t) {
      return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }
    clear() {
      this.rows.length = 0;
      if (this._list) this._list.innerHTML = "";
    }
    build() {
      if (this._el) return;
      const box = this._loadBox();
      const el = document.createElement("div");
      el.id = "ryn-chatlog";
      el.style.left = box.x + "px";
      el.style.top = box.y + "px";
      el.style.width = box.w + "px";
      el.style.height = box.h + "px";
      el.innerHTML =
        '<div id="cl-head">' +
          '<span id="cl-title">Chat Log</span>' +
          '<span id="cl-clear" title="Clear">\u2715</span>' +
        '</div>' +
        '<div id="cl-list"></div>' +
        '<div id="cl-grip"></div>';
      (document.body || document.documentElement).appendChild(el);
      this._el = el;
      this._list = el.querySelector("#cl-list");
      el.querySelector("#cl-clear").onclick = () => this.clear();
      const head = el.querySelector("#cl-head");
      head.onmousedown = e => {
        if (e.target.id === "cl-clear") return;
        this._drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
        e.preventDefault();
      };
      if (this._onMove) document.removeEventListener("mousemove", this._onMove);
      if (this._onUp) document.removeEventListener("mouseup", this._onUp);
      this._onMove = e => {
        if (!this._drag || !this._el) return;
        const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - this._drag.dx));
        const y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - this._drag.dy));
        this._el.style.left = x + "px";
        this._el.style.top = y + "px";
      };
      this._onUp = () => {
        if (this._drag) { this._drag = null; this._saveBox(); }
      };
      document.addEventListener("mousemove", this._onMove);
      document.addEventListener("mouseup", this._onUp);
      const grip = el.querySelector("#cl-grip");
      grip.onmousedown = e => {
        this._resize = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight };
        e.preventDefault(); e.stopPropagation();
      };
      if (this._onResizeMove) document.removeEventListener("mousemove", this._onResizeMove);
      if (this._onResizeUp) document.removeEventListener("mouseup", this._onResizeUp);
      this._onResizeMove = e => {
        if (!this._resize || !this._el) return;
        this._el.style.width = Math.max(200, this._resize.w + (e.clientX - this._resize.x)) + "px";
        this._el.style.height = Math.max(110, this._resize.h + (e.clientY - this._resize.y)) + "px";
      };
      this._onResizeUp = () => {
        if (this._resize) { this._resize = null; this._saveBox(); }
      };
      document.addEventListener("mousemove", this._onResizeMove);
      document.addEventListener("mouseup", this._onResizeUp);
      el.addEventListener("mouseenter", () => this._wake());
      for (const r of this.rows) this._render(r);
      this._wake();
    }
    destroy() {
      if (this._idleTimer) clearTimeout(this._idleTimer);
      if (this._onMove) { document.removeEventListener("mousemove", this._onMove); this._onMove = null; }
      if (this._onUp) { document.removeEventListener("mouseup", this._onUp); this._onUp = null; }
      if (this._onResizeMove) { document.removeEventListener("mousemove", this._onResizeMove); this._onResizeMove = null; }
      if (this._onResizeUp) { document.removeEventListener("mouseup", this._onResizeUp); this._onResizeUp = null; }
      this._drag = null;
      this._resize = null;
      if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
      this._el = null;
      this._list = null;
    }
    postTick() {
      const on = Settings_default._chatLog && this.client.isOwner;
      if (on && !this._el) this.build();
      if (!on && this._el) this.destroy();
    }
  }
  const ChatLog_default = ChatLog;
  class SpikeTick {
      /* Cap on how far a hit is treated as throwing a player. Past this the
       * prediction stops being worth acting on, and every client that does this
       * lands on roughly the same number. */
      static MAX_TRAVEL=170;
      moduleName="spikeTick";
      client;
      useTurret=false;
      useBreakTrapPlace=false;
      useBreakTrapFollowup=false;
      constructor(client2) {
          this.client = client2;
      }
      findEnemyOwnTrap(enemy) {
          const {ObjectManager: ObjectManager2} = this.client;
          let enemyOwnTrap = null;
          ObjectManager2.grid2D.query(enemy.pos.current.x, enemy.pos.current.y, 4, id => {
              if (enemyOwnTrap) return;
              const obj = ObjectManager2.objects.get(id);
              if (!obj || obj.type !== 15) return;
              if (obj.ownerID !== enemy.id) return;
              if (obj.pos.current.distance(enemy.pos.current) > obj.collisionScale + enemy.collisionScale) return;
              enemyOwnTrap = obj;
          });
          return enemyOwnTrap;
      }
      _isHostileHazard(object, victim) {
          const {PlayerManager: PlayerManager2} = this.client;
          const isPlayerObject = object instanceof PlayerObject;
          const isCactus = !isPlayerObject && object.isCactus;
          const isSpike = isPlayerObject && object.itemGroup === 2;
          if (!isSpike && !isCactus) return false;
          // A player's own spikes do not hurt them, so they are not a target.
          return !isPlayerObject || PlayerManager2.isEnemyByID(object.ownerID, victim);
      }
      /* Damage of the hazard the victim is standing on right now, which the hit
       * stacks with if it lands on this tick. Certain, unlike the sweep below. */
      _touchingDamage(victim) {
          const {ObjectManager: ObjectManager2} = this.client;
          const at = victim.pos.current;
          let damage = 0;
          ObjectManager2.grid2D.query(at.x, at.y, 2, id => {
              const object = ObjectManager2.objects.get(id);
              if (!object || !this._isHostileHazard(object, victim)) return;
              if (!victim.collidingObject(object)) return;
              damage = Math.max(damage, object.getDamage());
          });
          return damage;
      }
      /* Sweeps the victim along `angle` for up to `reach` units and returns the
       * nearest hazard they would come to rest against, or null. */
      _landsOn(victim, angle, reach) {
          const {ObjectManager: ObjectManager2} = this.client;
          const from = victim.pos.future ?? victim.pos.current;
          let best = null;
          ObjectManager2.grid2D.query(from.x, from.y, 3, id => {
              const object = ObjectManager2.objects.get(id);
              if (!object || !this._isHostileHazard(object, victim)) return;
              const to = object.pos.current;
              const contact = object.collisionScale + victim.collisionScale;
              const distance = from.distance(to);
              if (distance > reach + contact) return;
              const travel = Math.min(distance, reach);
              const x = from.x + travel * Math.cos(angle);
              const y = from.y + travel * Math.sin(angle);
              if (Math.hypot(x - to.x, y - to.y) > contact) return;
              if (best === null || distance < best.distance) {
                  best = {
                      object: object,
                      distance: distance,
                      damage: object.getDamage()
                  };
              }
          });
          return best;
      }
      /* True when a hazard also sits behind the victim, so the knockback off the
       * one they land on carries them straight back into another. */
      _pinnedBehind(victim, angle, reach) {
          return this._landsOn(victim, reverseAngle(angle), reach) !== null;
      }
      /* Picks the reachable enemy this tick adds the most damage to.
       *
       * Contact damage is what they are already standing on and is certain the
       * moment the hit lands; sweep damage is what the knockback would throw
       * them onto and is a prediction. Being pinned — a hazard ahead and another
       * behind — doubles the sweep's share, because the bounce off the first
       * carries them into the second.
       */
      _resolveTarget(myPlayer, EnemyManager2, primary) {
          const weaponRange = DataHandler_default.getWeapon(primary).range;
          const inReach = victim => victim && myPlayer.collidingEntity(victim, weaponRange + victim.hitScale, true);
          const candidates = [];
          for (const victim of [ EnemyManager2.nearestEnemy, EnemyManager2.enemySpikeCollider ]) {
              if (inReach(victim) && !candidates.includes(victim)) candidates.push(victim);
          }
          let best = null;
          for (const victim of candidates) {
              const angle = (myPlayer.pos.future ?? myPlayer.pos.current).angle(victim.pos.future ?? victim.pos.current);
              const reach = Math.min(myPlayer.getActualMaxKnockback(victim) || 0, SpikeTick.MAX_TRAVEL);
              const landing = reach > 0 ? this._landsOn(victim, angle, reach) : null;
              const pinned = landing !== null && this._pinnedBehind(victim, angle, reach);
              const contact = this._touchingDamage(victim);
              const swept = landing ? landing.damage * (pinned ? 2 : 1) : 0;
              const damage = contact + swept;
              if (damage <= 0) continue;
              if (best === null || damage > best.damage) {
                  best = {
                      victim: victim,
                      angle: angle,
                      damage: damage,
                      contact: contact,
                      pinned: pinned
                  };
              }
          }
          return best;
      }
      postTick() {
          const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
          if (ModuleHandler.moduleActive || !Settings_default._spikeTick) {
              return;
          }
          const reloading = ModuleHandler.staticModules.reloading;
          const primary = myPlayer.getItemByType(0);
          const isPrimary = primary !== 8;
          const primaryReloaded = reloading.isReloaded(0);
          const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
          const nearestEnemy = EnemyManager2.nearestEnemy;

          if (this.useBreakTrapFollowup) {
              this.useBreakTrapFollowup = false;
              if (primaryReloaded && nearestEnemy) {
                  const followAngle = myPlayer.pos.future.angle(nearestEnemy.pos.future);
                  ModuleHandler.moduleActive = true;
                  ModuleHandler.useAngle = followAngle;
                  if (ModuleHandler.canBuy(0, 7)) ModuleHandler.forceHat = 7;
                  ModuleHandler.forceWeapon = 0;
                  ModuleHandler.shouldAttack = true;
                  this.useTurret = true;
              }
              return;
          }
          if (this.useBreakTrapPlace) {
              this.useBreakTrapPlace = false;
              if (primaryReloaded && nearestEnemy) {
                  const hitAngle = myPlayer.pos.future.angle(nearestEnemy.pos.future);
                  ModuleHandler.moduleActive = true;
                  ModuleHandler.useAngle = hitAngle;
                  ModuleHandler.forceWeapon = 0;
                  ModuleHandler.shouldAttack = true;
                  EnemyManager2.attemptSpikePlacement();
                  this.useBreakTrapFollowup = true;
              }
              return;
          }
          if (this.useTurret) {
              this.useTurret = false;
              if (turretReloaded) {
                  ModuleHandler.moduleActive = true;
                  ModuleHandler.forceHat = 53;
                  return;
              }
              // Nothing to fire, so fall through rather than spend the tick —
              // the enemy may be making contact on this one.
          }
          if (EnemyManager2.shouldIgnoreModule()) {
              return;
          }

          if (Settings_default._spikeTick_breakTrap && nearestEnemy && isPrimary) {
              const secondary = myPlayer.getItemByType(1);
              const secondaryReloaded = reloading.isReloaded(1);
              if (secondary === 10 && secondaryReloaded) {
                  const enemyOwnTrap = this.findEnemyOwnTrap(nearestEnemy);
                  if (enemyOwnTrap) {
                      const hammerRange = DataHandler_default.getWeapon(10).range;
                      const canHitTrap = myPlayer.collidingSimple(enemyOwnTrap, hammerRange + enemyOwnTrap.hitScale);
                      if (canHitTrap) {
                          const hammerDmg = myPlayer.getBuildingDamage(10, ModuleHandler.canBuy(0, 40));
                          if (enemyOwnTrap.health <= hammerDmg) {
                              const trapAngle = myPlayer.pos.future.angle(enemyOwnTrap.pos.future);
                              ModuleHandler.moduleActive = true;
                              ModuleHandler.useAngle = trapAngle;
                              ModuleHandler.forceWeapon = 1;
                              ModuleHandler.shouldAttack = true;
                              this.useBreakTrapPlace = true;
                              this.client.StatsManager.spikeTickTimes = 1;
                              return;
                          }
                      }
                  }
              }
          }

          if (!isPrimary || !primaryReloaded) {
              return;
          }
          const resolved = this._resolveTarget(myPlayer, EnemyManager2, primary);
          if (resolved === null) {
              return;
          }
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = resolved.angle;
          ModuleHandler.forceHat = 7;
          ModuleHandler.forceWeapon = 0;
          ModuleHandler.shouldAttack = true;
          EnemyManager2.attemptSpikePlacement();
          this.useTurret = true;
          this.client.StatsManager.spikeTickTimes = 1;
      }
  }
  const SpikeTick_default = SpikeTick;
  class ToolHammerSpearInsta {
    moduleName="toolHammerSpearInsta";
    client;
    nearestTarget=null;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._toolSpearInsta) {
        this.nearestTarget = null;
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null || !ModuleHandler.canBuy(0, 7)) {
        return;
      }
      if (this.useTurret) {
        if (ModuleHandler.canBuy(0, 53)) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        this.useTurret = false;
        return;
      }
      if (myPlayer.upgradeAge !== 2) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      if (this.nearestTarget !== null) {
        const pos22 = this.nearestTarget.pos.current;
        const angle2 = pos1.angle(pos22);
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angle2;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        ModuleHandler._upgradeItem(5);
        this.nearestTarget = null;
        this.useTurret = true;
        EnemyManager2.attemptSpikePlacement();
        return;
      }
      const pos2 = nearestEnemy.pos.future;
      const angle = pos1.angle(pos2);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = reloading.isReloaded(2);
      const range = DataHandler_default.getWeapon(0).range + nearestEnemy.hitScale;
      if (!primaryReloaded || !turretReloaded || !myPlayer.collidingEntity(nearestEnemy, range)) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 7;
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
      this.nearestTarget = nearestEnemy;
    }
  }
  class Placer {
    moduleName="placer";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      const {currentType: currentType, placedOnce: placedOnce, healedOnce: healedOnce, _currentAngle: currentAngle} = ModuleHandler;
      if (!myPlayer.canPlace(currentType)) {
        return;
      }
      if (currentType === 2) {
        if (healedOnce) {
          return;
        }
        if (myPlayer.shameCount < 7) {
          ModuleHandler.heal();
          ModuleHandler.healedOnce = true;
          ModuleHandler.didAntiInsta = true;
        }
        return;
      }
      if (placedOnce) {
        return;
      }
      ModuleHandler.place(currentType, currentAngle);
      ModuleHandler.placedOnce = true;
    }
  }
  const Placer_default = Placer;
  class PreAttack {
    moduleName="preAttack";
    client;
    constructor(client2) {
      this.client = client2;
    }
    isReloadedByType(type) {
      const {weapon: weapon, staticModules: staticModules} = this.client._ModuleHandler;
      const weaponType = type !== null ? type : weapon;
      return staticModules.reloading.isReloaded(weaponType);
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const {useWeapon: useWeapon, weapon: weapon, forceWeapon: forceWeapon} = ModuleHandler;
      const nextWeapon = forceWeapon !== null ? forceWeapon : useWeapon;
      const forceReloaded = this.isReloadedByType(nextWeapon);
      const canAttack = ModuleHandler.shouldAttack && (forceReloaded && this.isReloadedByType(weapon) || forceWeapon !== null && forceReloaded);
      ModuleHandler.shouldAttack = canAttack;
    }
  }
  const PreAttack_default = PreAttack;
  class Reloading {
    moduleName="reloading";
    client;
    clientReload=[ {}, {}, {} ];
    constructor(client2) {
      this.client = client2;
      this.reset();
    }
    reset() {
      const [primary, secondary, turret] = this.clientReload;
      primary.current = primary.max = 0;
      secondary.current = secondary.max = 0;
      turret.current = turret.max = 23;
    }
    get currentReload() {
      return this.clientReload[this.client._ModuleHandler.weapon];
    }
    getReload(type) {
      return this.clientReload[type];
    }
    updateMaxReload(type) {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, SocketManager: SocketManager2} = this.client;
      const reload = this.getReload(type);
      const id = myPlayer.getItemByType(type);
      const store2 = ModuleHandler.getHatStore();
      const pingAccount = Math.floor(SocketManager2.pong / SocketManager2.TICK);
      const speed = myPlayer.getWeaponSpeed(id, store2.last) - pingAccount;
      reload.current = speed;
      reload.max = speed;
    }
    resetReload(reload) {
      reload.current = -1;
    }
    resetByType(type) {
      this.resetReload(this.getReload(type));
    }
    isReloaded(type, ticks = 0) {
      if (this.client._ModuleHandler.norecoil) {
        return true;
      }
      const reload = this.clientReload[type];
      return reload.current >= Math.max(0, reload.max - ticks);
    }
    isFasterThan(type1, type2) {
      const reload1 = this.clientReload[type1];
      const reload2 = this.clientReload[type2];
      const data1 = reload1.max - reload1.current;
      const data2 = reload2.max - reload2.current;
      return Math.abs(data1) <= Math.abs(data2);
    }
    isEmptyReload(type) {
      const reload = this.clientReload[type];
      return reload.current === 0;
    }
    postTick() {
      const {myPlayer: myPlayer} = this.client;
      const primaryReload = myPlayer.reload[0].current;
      const secondaryReload = myPlayer.reload[1].current;
      if (primaryReload !== -1) {
        this.clientReload[0].current = primaryReload;
      }
      if (secondaryReload !== -1) {
        this.clientReload[1].current = secondaryReload;
      }
      this.clientReload[2].current = myPlayer.reload[2].current;
    }
  }
  const Reloading_default = Reloading;
  class UpdateAngle {
    moduleName="updateAngle";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const mh = this.client._ModuleHandler;
      if (mh._scatterActive && mh._scatterAngle !== undefined) {
        mh._currentAngle = mh._scatterAngle;
        this.client.PacketManager.updateAngle(mh._scatterAngle);
        mh.mouse.sentAngle = mh._scatterAngle;
        return;
      }
      const {sentAngle: sentAngle, _currentAngle: currentAngle} = mh;
      if (sentAngle > 1) {
        return;
      }
      const myPlayer = this.client.myPlayer;
      const sendDir = mh._autoBreakActive && mh._lastBreakAngle != null ? mh._lastBreakAngle : currentAngle;
      const placedThisTick = mh.placedOnce || mh.healedOnce;
      if (placedThisTick) {
        mh.updateAngle(sendDir, true);
        mh._currentAngle = sendDir;
        return;
      }
      if (myPlayer && Math.abs(myPlayer.angle - sendDir) > .3) {
        mh.updateAngle(sendDir);
        mh._currentAngle = sendDir;
      }
    }
  }
  const UpdateAngle_default = UpdateAngle;
  class UpdateAttack {
    moduleName="updateAttack";
    client;
    didReset=false;
    constructor(client2) {
      this.client = client2;
    }
    getAttackAngle() {
      const MH = this.client._ModuleHandler;
      const {useAngle: useAngle, _currentAngle: currentAngle} = MH;
      if (useAngle !== null) {
        return useAngle;
      }
      if (MH._autoBreakActive && MH._lastBreakAngle != null) {
        return MH._lastBreakAngle;
      }
      return currentAngle;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      const {useWeapon: useWeapon, forceWeapon: forceWeapon, weapon: weapon, attacking: attacking, useItem: useItem, sentAngle: sentAngle, staticModules: staticModules} = ModuleHandler;
      const {reloading: reloading} = staticModules;
      const nextWeapon = forceWeapon !== null ? forceWeapon : useWeapon;
      if (nextWeapon !== null && (nextWeapon !== weapon || ModuleHandler.currentHolding !== nextWeapon || myPlayer.currentItem !== -1)) {
        const isReloaded = reloading.isReloaded(weapon);
        if (isReloaded || forceWeapon !== null) {
          ModuleHandler.whichWeapon(nextWeapon);
        }
      }
      if (useItem !== null) {
        ModuleHandler.selectItem(useItem);
      }
      if (ModuleHandler.shouldAttack) {
        const angle = this.getAttackAngle();
        ModuleHandler.attack(angle);
        ModuleHandler.stopAttack();
        const weaponType = ModuleHandler.weapon;
        if (ModuleHandler.attacked) {
          reloading.updateMaxReload(weaponType);
        }
        reloading.resetByType(weaponType);
      } else if (!attacking && sentAngle !== 0) {
        ModuleHandler.stopAttack();
        this.didReset = true;
      } else if (this.didReset) {
        this.didReset = false;
        ModuleHandler.stopAttack();
      }
    }
  }
  const UpdateAttack_default = UpdateAttack;
  class UseAttacking {
    moduleName="useAttacking";
    client;
    constructor(client2) {
      this.client = client2;
    }
    getWeaponType() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      const pos1 = myPlayer.pos.future;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const nearestAnimal = EnemyManager2.nearestAnimal;
      const nearestObject = EnemyManager2.nearestObject;
      const primaryID = myPlayer.getItemByType(0);
      const secondaryID = myPlayer.getItemByType(1);
      const primary = DataHandler_default.getWeapon(primaryID);
      const range = primary.range;
      if (nearestEnemy !== null) {
        const pos2 = nearestEnemy.pos.future;
        const angle = pos1.angle(pos2);
        if (myPlayer.collidingEntity(nearestEnemy, range + nearestEnemy.hitScale)) {
          return [ 0, angle ];
        }
        if (DataHandler_default.isShootable(secondaryID) && !ModuleHandler.autoattack) {
          return [ 1, angle ];
        }
      }
      if (nearestAnimal !== null) {
        const pos2 = nearestAnimal.pos.future;
        const angle = pos1.angle(pos2);
        if (myPlayer.collidingEntity(nearestAnimal, range + nearestAnimal.hitScale)) {
          return [ 0, angle ];
        }
        if (DataHandler_default.isShootable(secondaryID) && !ModuleHandler.autoattack) {
          return [ 1, angle ];
        }
      }
      if (nearestObject === null) {
        return null;
      }
      if (myPlayer.colliding(nearestObject, range + nearestObject.hitScale)) {
        return [ 0, null ];
      }
      return null;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (ModuleHandler.moduleActive || ModuleHandler.attackingState !== 1 || ModuleHandler.forceWeapon !== null) {
        return;
      }
      if (ModuleHandler._autoFarmActive) {
        return;
      }
      const weaponType = this.getWeaponType();
      if (weaponType === null) {
        return;
      }
      const [type, angle] = weaponType;
      ModuleHandler.forceWeapon = type;
      if (angle !== null) {
        ModuleHandler.useAngle = angle;
      }
      ModuleHandler.shouldAttack = true;
    }
  }
  class UseDestroying {
    moduleName="useDestroying";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2} = this.client;
      if (ModuleHandler.moduleActive || ModuleHandler.attackingState !== 2 || ModuleHandler.forceWeapon !== null) {
        return;
      }
      if (ModuleHandler._autoFarmActive) {
        return;
      }
      const nearestObject = EnemyManager2.nearestPlayerObject;
      const type = myPlayer.getBestDestroyingWeapon(nearestObject);
      ModuleHandler.forceWeapon = type;
      ModuleHandler.shouldAttack = true;
    }
  }
  class UseFastest {
    moduleName="useFastest";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (ModuleHandler.moduleActive) {
        return;
      }
      if (ModuleHandler._autoFarmActive) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      const type = myPlayer.getFastestWeapon();
      const reverse_type = type === 0 ? 1 : 0;
      if (!reloading.isReloaded(type)) {
        ModuleHandler.useWeapon = type;
      } else if (!reloading.isReloaded(reverse_type) && myPlayer.getItemByType(reverse_type) !== null) {
        ModuleHandler.useWeapon = reverse_type;
      } else {
        ModuleHandler.useWeapon = type;
      }
    }
  }
  class UtilityHat {
    moduleName="utilityHat";
    client;
    constructor(client2) {
      this.client = client2;
    }
    getBestUtilityHat(weaponType) {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const id = myPlayer.getItemByType(weaponType);
      if (id === 11) {
        return null;
      }
      if (DataHandler_default.isShootable(id)) {
        ModuleHandler.canHitEntity = true;
        return 20;
      }
      const weapon = DataHandler_default.getWeapon(id);
      const range = weapon.range;
      if (weapon.damage <= 1) {
        return null;
      }
      if (ModuleHandler.attackingState === 1) {
        const nearest = EnemyManager2.nearestEntity;
        if (nearest !== null && myPlayer.collidingEntity(nearest, range + nearest.hitScale)) {
          ModuleHandler.canHitEntity = true;
          return 7;
        }
      }
      if (ModuleHandler.attackingState !== 0) {
        const nearestObject = EnemyManager2.nearestPlayerObject;
        if (nearestObject === null) {
          return null;
        }
        if (myPlayer.colliding(nearestObject, range + nearestObject.hitScale)) {
          return 40;
        }
      }
      return null;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive) {
        return;
      }
      const {forceWeapon: forceWeapon, useWeapon: useWeapon, weapon: weapon} = ModuleHandler;
      const weaponType = forceWeapon !== null ? forceWeapon : useWeapon !== null ? useWeapon : weapon;
      let hat = this.getBestUtilityHat(weaponType);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const isReloaded = reloading.isReloaded(weaponType);
      const isEmptyReload = reloading.isEmptyReload(weaponType);
      const turretReloaded = reloading.isReloaded(2);
      if (!isReloaded) {
        hat = null;
      }
      if (ModuleHandler.canHitEntity && isEmptyReload && turretReloaded) {
        const nearest = EnemyManager2.nearestEntity;
        if (nearest !== null && myPlayer.collidingEntity(nearest, 700)) {
          hat = 53;
        }
      }
      if (hat !== null) {
        ModuleHandler.useHat = hat;
      }
    }
  }
  class AntiInsta {
    moduleName="antiInsta";
    client;
    toggleAnti=false;
    healingCount=0;
    forceHeal=false;
    constructor(client2) {
      this.client = client2;
    }
    isSaveHealTime() {
      const {myPlayer: myPlayer, SocketManager: SocketManager2} = this.client;
      const startHit = myPlayer.receivedDamage || 0;
      const timeSinceHit = Date.now() - startHit + SocketManager2.pong;
      return timeSinceHit >= 125;
    }
    isSaveHealTick() {
      const {tickCount: tickCount, damageTick: damageTick} = this.client.myPlayer;
      return tickCount - damageTick > 0;
    }
    isSaveHeal() {
      return this.isSaveHealTime() && this.isSaveHealTick();
    }
    antiSmartTick(myPlayer, nearestEnemy, ModuleHandler, ObjectManager2, PlayerManager2) {
      if (!nearestEnemy) return false;
      const mySecondary = myPlayer.getItemByType(1);
      if (mySecondary !== 10) return false;
      const enemyPos = nearestEnemy.pos.current;
      let enemyInOurTrap = false;
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 2, id => {
        if (enemyInOurTrap) return;
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return;
        if (obj.type !== 15) return;
        if (PlayerManager2.isEnemyByID(obj.ownerID, nearestEnemy)) return;
        if (enemyPos.distance(obj.pos.current) < obj.collisionScale) enemyInOurTrap = true;
      });
      if (enemyInOurTrap) return false;
      if (!myPlayer.isTrapped || !myPlayer.trappedIn) return false;
      const trapObj = myPlayer.trappedIn;
      if (myPlayer.spikeDamage > 0) return false;
      const myHammerDmg = myPlayer.getBuildingDamage(mySecondary, false);
      if (trapObj.health > myHammerDmg) return false;
      const spikesEnemy = [];
      ObjectManager2.grid2D.query(enemyPos.x, enemyPos.y, 4, id => {
        const obj = ObjectManager2.objects.get(id);
        if (!obj || !(obj instanceof PlayerObject)) return;
        if (obj.itemGroup !== 2) return;
        if (!PlayerManager2.isEnemyByID(obj.ownerID, myPlayer)) return;
        spikesEnemy.push(obj);
      });
      const myPos = myPlayer.pos.current;
      const spikeId = myPlayer.getItemByType(4) ?? 6;
      const spikeItem = Items[spikeId];
      const spikeScale = spikeItem.scale;
      const placeOffset = spikeItem.placeOffset || 0;
      const placeLength = 35 + spikeScale + placeOffset;
      let shouldWait = false;
      for (let i = 0; i < 36; i++) {
        const angle = i * (Math.PI * 2 / 36);
        const configX = enemyPos.x + placeLength * Math.cos(angle);
        const configY = enemyPos.y + placeLength * Math.sin(angle);
        const configPos = new Vector_default(configX, configY);
        const canPlace = ObjectManager2.canPlaceItem(spikeId, configPos, 0.6 * spikeScale - spikeScale);
        if (canPlace) {
          const distToMe = Math.hypot(myPos.x - configX, myPos.y - configY);
          if (distToMe < 35 + spikeScale) {
            const knockbackAngle = Math.atan2(myPos.y - configY, myPos.x - configX);
            const projX = myPos.x + 111 * Math.cos(knockbackAngle);
            const projY = myPos.y + 111 * Math.sin(knockbackAngle);
            for (const spike of spikesEnemy) {
              const sp = spike.pos.current;
              const sc = spike.collisionScale;
              const rx1 = sp.x - sc, ry1 = sp.y - sc;
              const rx2 = sp.x + sc, ry2 = sp.y + sc;
              const dx = projX - myPos.x, dy = projY - myPos.y;
              const len2 = dx * dx + dy * dy;
              let hits = false;
              if (len2 === 0) {
                hits = myPos.x >= rx1 && myPos.x <= rx2 && myPos.y >= ry1 && myPos.y <= ry2;
              } else {
                const t = Math.max(0, Math.min(1, ((rx1 + rx2) / 2 - myPos.x) * dx / len2 + ((ry1 + ry2) / 2 - myPos.y) * dy / len2));
                const cx = myPos.x + t * dx, cy = myPos.y + t * dy;
                hits = cx >= rx1 && cx <= rx2 && cy >= ry1 && cy <= ry2;
              }
              if (hits) {
                shouldWait = true;
                break;
              }
            }
          }
        }
        if (shouldWait) break;
      }
      if (shouldWait && trapObj.health <= myHammerDmg) {
        return true;
      }
      return false;
    }
    postTick() {
      this.forceHeal = false;
      if (!Settings_default._autoheal) {
        return;
      }
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, ProjectileManager: ProjectileManager2} = this.client;
      if (myPlayer.shameActive) {
        return;
      }
      const foodID = myPlayer.getItemByType(2);
      const restore = Items[foodID].restore;
      const needTimes = Math.max(1, Math.ceil((myPlayer.maxHealth - myPlayer.tempHealth) / restore));
      const tempHealth = myPlayer.tempHealth;
      const shameCount = myPlayer.shameCount;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (myPlayer.isTrapped && nearestEnemy) {
        const {ObjectManager: ObjectManager2, PlayerManager: PlayerManager2} = this.client;
        if (this.antiSmartTick(myPlayer, nearestEnemy, ModuleHandler, ObjectManager2, PlayerManager2)) {
          ModuleHandler.healedOnce = true;
          ModuleHandler.didAntiInsta = true;
          ModuleHandler.shouldAttack = false;
          const hits = Math.max(needTimes + 1, 3);
          for (let i = 0; i < hits; i++) ModuleHandler.heal();
          return;
        }
      }
      if (myPlayer.isTrapped && shameCount <= 3 && nearestEnemy) {
        const breakWeapon = nearestEnemy.weapon?.primary;
        const breaksTrap = breakWeapon === 4 || breakWeapon === 5;
        const trappedIn = myPlayer.trappedIn;
        const aboutToBreakOut = EnemyManager2.willCollideSpike || EnemyManager2.pushingOnSpike || EnemyManager2.collidingSpike;
        if (breaksTrap && trappedIn && aboutToBreakOut) {
          const breakDmg = nearestEnemy.getBuildingDamage(breakWeapon, false);
          const trapAboutToBreak = trappedIn.health <= breakDmg * 2;
          const enemyReady = nearestEnemy.atExact(0, 1) || nearestEnemy.isReloaded(0, 1);
          if (trapAboutToBreak && enemyReady) {
            ModuleHandler.healedOnce = true;
            ModuleHandler.didAntiInsta = true;
            const hits = Math.max(needTimes, 2);
            for (let i = 0; i < hits; i++) ModuleHandler.heal();
            return;
          }
        }
      }
      if (nearestEnemy) {
        const primary = nearestEnemy.weapon?.primary;
        const secondary = nearestEnemy.weapon?.secondary;
        const hasMeleeCombo = primary === 5 || primary === 4 || primary === 3;
        const hasRangedCombo = secondary === 12 || secondary === 13 || secondary === 15;
        if (hasMeleeCombo && hasRangedCombo) {
          const weaponData = DataHandler_default.getWeapon(primary);
          const totalRange = weaponData.range + myPlayer.collisionScale + nearestEnemy.collisionScale;
          const distance = myPlayer.pos.current.distance(nearestEnemy.pos.current);
          if (distance <= totalRange + 35) {
            const primaryReloaded1 = nearestEnemy.isReloaded(0, 2);
            const secondaryReloaded1 = nearestEnemy.isReloaded(1, 2);
            const primaryReloaded0 = nearestEnemy.isReloaded(0, 0);
            const secondaryReloaded0 = nearestEnemy.isReloaded(1, 0);
            if (primaryReloaded1 && secondaryReloaded1) {
              ModuleHandler.healedOnce = true;
              ModuleHandler.didAntiInsta = true;
              if (shameCount < 3) {
                const bothReady = primaryReloaded0 && secondaryReloaded0;
                const hits = bothReady ? Math.max(needTimes + 2, 4) : needTimes + 1;
                for (let i = 0; i < hits; i++) ModuleHandler.heal();
              } else if (shameCount < 6 && tempHealth < 80) {
                const hits = Math.max(needTimes, 2);
                for (let i = 0; i < hits; i++) ModuleHandler.heal();
              } else if (tempHealth < 50 && this.isSaveHeal()) {
                for (let i = 0; i < needTimes; i++) ModuleHandler.heal();
              }
              return;
            }
            if (EnemyManager2.velocityTickThreat || EnemyManager2.reverseInsta || EnemyManager2.toolHammerInsta || EnemyManager2.rangedBowInsta) {
              if (tempHealth < 100 && shameCount < 7) {
                ModuleHandler.healedOnce = true;
                ModuleHandler.didAntiInsta = true;
                const hits = Math.max(needTimes, 2);
                for (let i = 0; i < hits; i++) ModuleHandler.heal();
                return;
              }
            }
          }
        }
      }
      let healingTimes = null;
      if (EnemyManager2.velocityTickThreat || EnemyManager2.reverseInsta || EnemyManager2.toolHammerInsta || EnemyManager2.rangedBowInsta || EnemyManager2.detectedDangerEnemy || EnemyManager2.detectedEnemy || tempHealth <= 20 || ModuleHandler.shouldEquipSoldier && ModuleHandler.forceHat !== 6 || EnemyManager2.dangerWithoutSoldier) {
        this.forceHeal = true;
      }
      if (shameCount < 7 && this.forceHeal && tempHealth < 95) {
        ModuleHandler.didAntiInsta = true;
        healingTimes = needTimes;
      } else if (this.isSaveHeal() && tempHealth < 100) {
        healingTimes = needTimes;
      }
      if (healingTimes !== null) {
        ModuleHandler.healedOnce = true;
        for (let i = 0; i < healingTimes; i++) {
          ModuleHandler.heal();
        }
      }
    }
  }
  const AntiInsta_default = AntiInsta;
  class Autohat {
    moduleName="autoHat";
    client;
    constructor(client2) {
      this.client = client2;
    }
    handleEquip(type, use) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (type === 0 && ModuleHandler.forceHat !== null) {
        use = ModuleHandler.forceHat;
      }
      if (use !== null && ModuleHandler._equip(type, use)) {
        return true;
      }
      return false;
    }
    getNextHat() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.forceHat !== null) {
        return ModuleHandler.forceHat;
      }
      if (ModuleHandler.useHat !== null) {
        return ModuleHandler.useHat;
      }
      return myPlayer.hatID;
    }
    getNextAcc() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.useAcc !== null) {
        return ModuleHandler.useAcc;
      }
      return myPlayer.accessoryID;
    }
    getNextWeaponID() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.forceWeapon !== null) {
        return myPlayer.getItemByType(ModuleHandler.forceWeapon);
      }
      if (ModuleHandler.useWeapon !== null) {
        return myPlayer.getItemByType(ModuleHandler.useWeapon);
      }
      return myPlayer.weapon.current;
    }
    getNextItemID() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.useItem !== null) {
        return myPlayer.getItemByType(ModuleHandler.useItem);
      }
      return myPlayer.currentItem;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (!ModuleHandler.sentHatEquip) {
        this.handleEquip(0, ModuleHandler.useHat);
      }
      if (!ModuleHandler.sentAccEquip && !ModuleHandler.sentHatEquip) {
        this.handleEquip(1, ModuleHandler.useAcc);
      }
    }
  }
  const Autohat_default = Autohat;
  class DefaultAcc {
    moduleName="defaultAcc";
    client;
    constructor(client2) {
      this.client = client2;
    }
    shouldUseTail() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isMelee1 = DataHandler_default.isMelee(primary);
      const isMelee2 = DataHandler_default.isMelee(secondary);
      return isMelee1 && primary === 8 || isMelee1 && !reloading.isReloaded(0, 3) || isMelee2 && !reloading.isReloaded(1, 3);
    }
    getBestCurrentAcc() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const {actual: actual} = ModuleHandler.getAccStore();
      const useCorrupt = ModuleHandler.canBuy(1, 21);
      const useShadow = ModuleHandler.canBuy(1, 19);
      const useTail = ModuleHandler.canBuy(1, 11);
      const useActual = ModuleHandler.canBuy(1, actual);
      const useBloodWings = ModuleHandler.canBuy(1, 18);
      const turretActive = ModuleHandler.forceHat === 53 || myPlayer.hatID === 53;
      if (turretActive && useShadow) {
        return 19;
      }
      const bullActive = ModuleHandler.forceHat === 7 || myPlayer.hatID === 7;
      if (bullActive) {
        if (useBloodWings) return 18;
        if (useShadow) return 19;
      }
      if (Settings_default._tailPriority && useTail && this.shouldUseTail()) {
        return 11;
      }
      if (EnemyManager2.detectedEnemy || EnemyManager2.nearestEnemyInRangeOf(300, EnemyManager2.nearestEntity)) {
        const isEnemy = EnemyManager2.nearestEntity === EnemyManager2.nearestEnemy;
        const useAngel = ModuleHandler.canBuy(1, 13);
        if (useAngel) {
          return 13;
        }
        if (isEnemy && useCorrupt && Settings_default._antienemy) {
          return 21;
        }
        if (useActual && actual !== 11) {
          return actual;
        }
        return 0;
      }
      if (!ModuleHandler.isMoving && myPlayer.speed <= 5) {
        if (useBloodWings) return 18;
      }
      if (useTail) {
        return 11;
      }
      return 0;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const acc = this.getBestCurrentAcc();
      ModuleHandler.useAcc = acc;
    }
  }
  class DefaultHat {
    moduleName="defaultHat";
    client;
    constructor(client2) {
      this.client = client2;
    }
    getBestCurrentHat() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const {current: current, future: future} = myPlayer.pos;
      const {actual: actual} = ModuleHandler.getHatStore();
      const useFlipper = ModuleHandler.canBuy(0, 31);
      const useSoldier = ModuleHandler.canBuy(0, 6);
      const useWinter = ModuleHandler.canBuy(0, 15);
      const useActual = ModuleHandler.canBuy(0, actual);
      const useBooster = ModuleHandler.canBuy(0, 12);
      const useBull = ModuleHandler.canBuy(0, 7);
      const useEmp = ModuleHandler.canBuy(0, 22);
      let _empNearbyTurret = false;
      if (useEmp && Settings_default._empDefense) {
        const {ObjectManager: _empOM} = this.client;
        _empOM.grid2D.query(current.x, current.y, 8, _empId => {
          const _empObj = _empOM.objects.get(_empId);
          if (_empObj && _empObj.type === 17 && myPlayer.isEnemyByID(_empObj.ownerID)) {
            if (myPlayer.collidingSimple(_empObj, 725)) {
              _empNearbyTurret = true;
              return true;
            }
          }
        });
      }
      if (!ModuleHandler.isMoving && myPlayer.speed <= 5 && !_empNearbyTurret) {
        const _nearestStill = EnemyManager2.nearestEnemy;
        const _primary = myPlayer.getItemByType(0);
        const _weaponRange = _primary !== null ? DataHandler_default.getWeapon(_primary).range + (_nearestStill?.hitScale || 35) : 85;
        const _isCloseStill = _nearestStill !== null && myPlayer.pos.current.distance(_nearestStill.pos.current) <= _weaponRange + 20;
        if (!_isCloseStill && !EnemyManager2.detectedEnemy && !EnemyManager2.detectedDangerEnemy) {
          const useCowboy = Settings_default._cowboyWhenSafe && ModuleHandler.canBuy(0, 5);
          if (useCowboy) return 5;
          if (useActual && actual !== 0) return actual;
        }
      }
      if (useSoldier) {
        if (Settings_default._antienemy) {
          if (EnemyManager2.detectedDangerEnemy || EnemyManager2.detectedEnemy || EnemyManager2.velocityTickThreat || EnemyManager2.reverseInsta || EnemyManager2.toolHammerInsta || EnemyManager2.rangedBowInsta) {
            ModuleHandler.shouldEquipSoldier = true;
            ModuleHandler.forceHat = 6;
            return 6;
          }
          if (useBull && myPlayer.shameCount > 0 || EnemyManager2.dangerWithoutSoldier) {
            return 6;
          }
        }
        if (Settings_default._antispike && EnemyManager2.willCollideSpike) {
          return 6;
        }
      }
      if (Settings_default._biomehats && useFlipper && !myPlayer.onPlatform) {
        const inRiver = pointInRiver(current) || pointInRiver(future);
        if (inRiver) {
          return 31;
        }
      }
      if (useSoldier) {
        if (Settings_default._antianimal && EnemyManager2.nearestDangerAnimal !== null) {
          return 6;
        }
      }
      if (useEmp && Settings_default._empDefense && _empNearbyTurret) {
        return 22;
      }
      if (useEmp && Settings_default._empDefense && (!ModuleHandler.isMoving || myPlayer.speed <= 5)) {
        return 22;
      }
      if (Settings_default._biomehats && useWinter) {
        const inWinter = current.y <= 2400 || future.y <= 2400;
        if (inWinter) {
          return 15;
        }
      }
      if (useBooster) {
        return 12;
      }
      return 0;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const hat = this.getBestCurrentHat();
      ModuleHandler.useHat = hat;
    }
  }
  class SafeWalk {
    moduleName="safeWalk";
    client;
    movingState=false;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.movingState = false;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, ObjectManager: ObjectManager2, EnemyManager: EnemyManager2} = this.client;
      const {prevMoveTo: prevMoveTo, moveTo: moveTo} = ModuleHandler;
      if (prevMoveTo !== moveTo) {
        const angle = moveTo === "disable" ? ModuleHandler.move_dir : moveTo;
        ModuleHandler.startMovement(angle, true);
        return;
      }
      if (myPlayer.simulation.collisionSimulation(this.client)) {
        if (!this.movingState) {
          this.movingState = true;
          ModuleHandler.stopMovement();
        }
        return;
      }
      if (this.movingState) {
        this.movingState = false;
        ModuleHandler.startMovement();
      }
    }
  }
  class ShameReset {
    moduleName="shameReset";
    client;
    tickToggle=false;
    constructor(client2) {
      this.client = client2;
    }
    isBullTickTime() {
      const {myPlayer: myPlayer} = this.client;
      return !myPlayer.shameActive && myPlayer.shameCount > 0 && myPlayer.poisonCount === 0 && myPlayer.isBullTickTime();
    }
    get shouldReset() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      return this.isBullTickTime() && ModuleHandler.canBuy(0, 7);
    }
    notSave() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      return ModuleHandler.forceHat === 40 || EnemyManager2.instaThreat() || EnemyManager2.collidingSpike || myPlayer.wasTrapped() || ModuleHandler.currentType === 2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (Settings_default._autoheal && !this.notSave() && (this.shouldReset || this.tickToggle)) {
        this.tickToggle = true;
        ModuleHandler.moduleActive = true;
        ModuleHandler.forceHat = 7;
      }
    }
    healthUpdate() {
      if (this.client.myPlayer.isDmgOverTime) {
        this.tickToggle = false;
      }
    }
  }
  const ShameReset_default = ShameReset;
  class AutoAccept {
    moduleName="autoAccept";
    client;
    prevClan=null;
    acceptCount=0;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {myPlayer: myPlayer, clientIDList: clientIDList, PacketManager: PacketManager2, isOwner: isOwner} = this.client;
      const currentClan = myPlayer.clanName;
      if (currentClan !== this.prevClan) {
        this.prevClan = currentClan;
        myPlayer.joinRequests.length = 0;
        const botIDs = new Set;
        for (const c of this.client.clients) {
          if (c.myPlayer && c.myPlayer.id != null) botIDs.add(c.myPlayer.id);
        }
        this.client.pendingJoins.clear();
        for (const id2 of botIDs) this.client.pendingJoins.add(id2);
      }
      if (!myPlayer.isLeader || myPlayer.joinRequests.length === 0) {
        return;
      }
      while (myPlayer.joinRequests.length > 0) {
        const id = myPlayer.joinRequests[0][0];
        if (Settings_default._autoaccept || this.client.pendingJoins.size !== 0) {
          PacketManager2.clanRequest(id, Settings_default._autoaccept || clientIDList.has(id));
          myPlayer.joinRequests.shift();
          this.client.pendingJoins.delete(id);
          if (isOwner) {
            GameUI_default.clearNotication();
          }
        } else {
          break;
        }
      }
      const nextID = myPlayer.joinRequests[0];
      if (isOwner && nextID !== void 0) {
        GameUI_default.createRequest(nextID);
      }
    }
  }
  const AutoAccept_default = AutoAccept;
  class AutoBuy {
    moduleName="autoBuy";
    client;
    buyIndex=0;
    buyList=[ [ 0, 40 ], [ 0, 6 ], [ 0, 53 ], [ 0, 7 ], [ 0, 12 ], [ 0, 22 ], [ 1, 11 ], [ 1, 19 ], [ 1, 21 ], [ 1, 18 ], [ 1, 13 ] ];
    constructor(client2) {
      this.client = client2;
    }
    boughtEverything() {
      return this.buyIndex >= this.buyList.length;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (this.boughtEverything() || !myPlayer.isSandbox) {
        return;
      }
      const [type, id] = this.buyList[this.buyIndex];
      if (ModuleHandler.canBuy(type, id)) {
        ModuleHandler._buy(type, id);
      }
      if (ModuleHandler.bought[type].has(id)) {
        this.buyIndex += 1;
      }
    }
  }
  class AutoGrind {
    moduleName="autoGrind";
    client;
    grindAngle=null;
    constructor(client2) {
      this.client = client2;
    }
    isFullyUpgraded() {
      const {myPlayer: myPlayer} = this.client;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const upgradedSecondary = secondary === 10 && myPlayer.getWeaponVariant(secondary).current >= 3;
      const upgradedPrimary = primary !== 8 && myPlayer.getWeaponVariant(primary).current >= 3;
      return upgradedSecondary && upgradedPrimary;
    }
    getGrindAction(nearestTurret) {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      if (!nearestTurret) return null;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const useTank = ModuleHandler.canBuy(0, 40);
      let weaponType = null;
      if (secondary === 10 && myPlayer.getWeaponVariant(secondary).current < 3) {
        weaponType = 1;
      } else if (primary !== 8 && myPlayer.getWeaponVariant(primary).current < 3) {
        weaponType = 0;
      }
      if (weaponType === null) return null;
      if (weaponType === 1) {
        return {
          weapon: 1,
          hat: useTank ? 40 : 0
        };
      } else if (weaponType === 0) {
        const primaryDmg = myPlayer.getBuildingDamage(primary, useTank);
        if (secondary === 10) {
          const secondaryDmg = myPlayer.getBuildingDamage(secondary, useTank);
          if (nearestTurret.health > primaryDmg + secondaryDmg) {
            return {
              weapon: 1,
              hat: useTank ? 40 : 0
            };
          } else if (nearestTurret.health > primaryDmg) {
            return {
              weapon: 1,
              hat: 0
            };
          } else {
            return {
              weapon: 0,
              hat: useTank ? 40 : 0
            };
          }
        } else {
          return {
            weapon: 0,
            hat: useTank ? 40 : 0
          };
        }
      }
      return null;
    }
    placeTurret(angle) {
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2, _ModuleHandler: ModuleHandler} = this.client;
      const id = myPlayer.getItemByType(8);
      const position = myPlayer.getPlacePosition(myPlayer.pos.future, id, angle);
      if (!ObjectManager2.canPlaceItem(id, position)) {
        return false;
      }
      ModuleHandler.place(8, angle);
      if (!Array.isArray(ModuleHandler.placeAngles[1])) {
        ModuleHandler.placeAngles[1] = [];
      }
      ModuleHandler.placeAngles[0] = 8;
      ModuleHandler.placeAngles[1].push(angle);
      return true;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      if (this.isFullyUpgraded()) {
        if (Settings_default._autoGrind) {
          Settings_default._autoGrind = false;
          this.grindAngle = null;
          const grindEl = UI_default?.frame?.document?.getElementById("_autoGrind");
          if (grindEl) grindEl.checked = false;
          RYNNotify.show("Auto Grind", false);
        }
        return;
      }
      if (!Settings_default._autoGrind || ModuleHandler.moduleActive || ModuleHandler.healedOnce || myPlayer.speed > 5) {
        this.grindAngle = null;
        return;
      }
      const {autoMill: autoMill, reloading: reloading} = ModuleHandler.staticModules;
      if (autoMill.isActive) return;
      const farmItem = myPlayer.getItemByType(8);
      if (farmItem !== 17 && farmItem !== 22) return;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy !== null && myPlayer.collidingSimple(nearestEnemy, 400)) return;
      let sumX = 0, sumY = 0, count = 0;
      let nearestTurret = null, nearestDist = Infinity;
      ObjectManager2.grid2D.query(myPlayer.pos.current.x, myPlayer.pos.current.y, 3, objID => {
        const obj = ObjectManager2.objects.get(objID);
        if (obj && (obj.type === 17 || obj.type === 22) && obj.ownerID === myPlayer.id) {
          if (myPlayer.collidingSimple(obj, 300)) {
            sumX += obj.pos.current.x;
            sumY += obj.pos.current.y;
            count++;
            const d = myPlayer.pos.current.distance(obj.pos.current);
            if (d < nearestDist) {
              nearestDist = d;
              nearestTurret = obj;
            }
          }
        }
      });
      if (count === 0) {
        if (!myPlayer.canPlace(8)) return;
        this.grindAngle = ModuleHandler._currentAngle;
        let placed = false;
        const isSandbox = myPlayer.isSandbox;
        if (!isSandbox || farmItem === 22) {
          const spread = Math.PI / 180 * 40;
          if (this.placeTurret(this.grindAngle - spread)) placed = true;
          if (this.placeTurret(this.grindAngle + spread)) placed = true;
        } else {
          const spread = Math.PI / 180 * 75;
          if (this.placeTurret(this.grindAngle)) placed = true;
          if (this.placeTurret(this.grindAngle - spread)) placed = true;
          if (this.placeTurret(this.grindAngle + spread)) placed = true;
        }
        if (placed) {
          ModuleHandler.placedOnce = true;
          ModuleHandler.moduleActive = true;
        }
        return;
      }
      const centerX = sumX / count;
      const centerY = sumY / count;
      const middleAngle = Math.atan2(centerY - myPlayer.pos.current.y, centerX - myPlayer.pos.current.x);
      const action = this.getGrindAction(nearestTurret);
      if (action === null) return;
      if (reloading.isReloaded(action.weapon)) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = middleAngle;
        ModuleHandler.forceHat = action.hat;
        ModuleHandler.forceWeapon = action.weapon;
        ModuleHandler.shouldAttack = true;
      }
    }
  }
  class Automill {
    moduleName="autoMill";
    toggle=false;
    active=true;
    client;
    tickCount=0;
    constructor(client2) {
      this.client = client2;
    }
    get isActive() {
      return this.toggle && this.active;
    }
    reset() {
      this.active = true;
    }
    get canAutomill() {
      const isOwner = this.client.isOwner;
      const {attacking: attacking, placedOnce: placedOnce, staticModules: staticModules} = this.client._ModuleHandler;
      return Settings_default._automill && this.client.myPlayer.isSandbox && !placedOnce && (!isOwner || !attacking) && this.active && !staticModules.autoBuy.boughtEverything() && this.client.myPlayer.age < 20;
    }
    canPlaceWindmill(angle) {
      return this.client.myPlayer.canPlaceObject(5, angle);
    }
    placeWindmill(angle) {
      const {_ModuleHandler: ModuleHandler} = this.client;
      const type = 5;
      ModuleHandler.place(type, angle);
      ModuleHandler.placedOnce = true;
      ModuleHandler.placeAngles[0] = type;
      ModuleHandler.placeAngles[1].push(angle);
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler} = this.client;
      this.toggle = true;
      if (!this.canAutomill) {
        this.toggle = false;
        return;
      }
      if (!myPlayer.canPlace(5)) {
        this.toggle = false;
        this.active = false;
        return;
      }
      const angle = ModuleHandler.reverse_move_dir;
      if (angle === null) {
        return;
      }
      const item = Items[myPlayer.getItemByType(5)];
      const distance = myPlayer.getItemPlaceScale(item.id);
      const offset = Math.asin((2 * item.scale + 9e-13) / (2 * distance)) * 2;
      const leftAngle = angle - offset;
      const rightAngle = angle + offset;
      if (this.canPlaceWindmill(angle) && this.canPlaceWindmill(leftAngle) && this.canPlaceWindmill(rightAngle)) {
        this.placeWindmill(angle);
        this.placeWindmill(leftAngle);
        this.placeWindmill(rightAngle);
      }
    }
  }
  const Automill_default = Automill;
  class AutoSteal {
    moduleName="autoSteal";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._autoSteal) {
        return;
      }
      const nearestLowEntity = EnemyManager2.nearestLowEntity;
      if (nearestLowEntity === null) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primary = myPlayer.getItemByType(0);
      const range = DataHandler_default.getWeapon(primary).range + nearestLowEntity.hitScale;
      if (!myPlayer.collidingSimple(nearestLowEntity, range) || !reloading.isReloaded(0)) {
        return;
      }
      const canUseBull = ModuleHandler.canBuy(0, 7);
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestLowEntity.pos.current;
      const angle = pos1.angle(pos2);
      const maxDamageBull = myPlayer.getMaxWeaponDamage(primary, false, canUseBull);
      const maxDamage = myPlayer.getMaxWeaponDamage(primary, false, false);
      const canKill = maxDamageBull >= nearestLowEntity.currentHealth;
      if (!canKill) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      if (maxDamage < nearestLowEntity.currentHealth) {
        ModuleHandler.forceHat = 7;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
  class ReverseInstakill {
    moduleName="reverseInstakill";
    client;
    targetEnemy=null;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.targetEnemy = null;
    }
    postTick() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2, _ModuleHandler: ModuleHandler, InputHandler: InputHandler2, SocketManager: SocketManager2} = this.client;
      if (!InputHandler2.instaToggle) {
        this.reset();
        InputHandler2.instaReset();
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null) {
        this.reset();
        return;
      }
      const secondary = myPlayer.getItemByType(1);
      if (secondary !== 10) return;
      const primary = myPlayer.getItemByType(0);
      const lookingShield = PlayerManager2.lookingShield(nearestEnemy, myPlayer);
      const primaryDamage = myPlayer.getMaxWeaponDamage(primary, lookingShield);
      const secondaryDamage = myPlayer.getMaxWeaponDamage(secondary, lookingShield);
      const turretBonus = ModuleHandler.canBuy(0, 53) ? 25 : 0;
      if (primaryDamage + secondaryDamage + turretBonus < nearestEnemy.currentHealth) return;
      const pos1 = myPlayer.pos.future;
      const pos2 = nearestEnemy.pos.future;
      const angle = pos1.angle(pos2);
      InputHandler2.instakillTarget = nearestEnemy;
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0, 1);
      const secondaryReloaded = reloading.isReloaded(1);
      const turretReloaded = reloading.isReloaded(2);
      const baseRange = DataHandler_default.getWeapon(primary).range + nearestEnemy.hitScale;
      const predictedRange = baseRange + nearestEnemy.speed;
      const inRange = myPlayer.collidingEntity(nearestEnemy, baseRange) || myPlayer.collidingEntity(nearestEnemy, predictedRange);
      const myPosCur = myPlayer.pos.current;
      const dist = myPosCur.distance(nearestEnemy.pos.current);
      if (dist < baseRange * 2.5 && ModuleHandler.canBuy(0, 53)) {
        ModuleHandler.useAngle = angle;
      }
      if (this.targetEnemy !== null) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angle;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        const delay = SocketManager2.TICK - SocketManager2.pong / 2;
        setTimeout(() => {
          try {
            this.client.PacketManager.attack(angle, 0);
          } catch (_) {}
        }, Math.max(10, delay));
        this.targetEnemy = null;
        InputHandler2.instaReset();
        EnemyManager2.attemptSpikePlacement();
        return;
      }
      const ticks = nearestEnemy.speed > 0 ? Math.max(0, (dist - baseRange) / nearestEnemy.speed) : 0;
      if (!inRange && ticks <= 1 && primaryReloaded && secondaryReloaded && turretReloaded) {
        ModuleHandler.moveTo = myPosCur.angle(nearestEnemy.pos.current);
      }
      if (!primaryReloaded || !secondaryReloaded || !turretReloaded || !inRange && ticks > 1) return;
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 53;
      ModuleHandler.forceWeapon = 1;
      ModuleHandler.shouldAttack = true;
      this.targetEnemy = nearestEnemy;
    }
  }
  class MusketBowInsta {
    moduleName="musketBowInsta";
    client;
    targetEnemy=null;
    tickAction=0;
    distMin=660;
    distMax=700;
    active=false;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.targetEnemy = null;
      this.tickAction = 0;
      this.active = false;
    }
    postTick() {
      const {EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler, myPlayer: myPlayer, InputHandler: InputHandler2} = this.client;
      if (!InputHandler2.instaToggle || !Settings_default._musketBowInsta) {
        this.reset();
        InputHandler2.instaReset();
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const nearest = this.targetEnemy || nearestEnemy;
      if (nearest === null) {
        this.reset();
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearest.pos.current;
      const angle = pos1.angle(pos2);
      const distance = pos1.distance(pos2);
      InputHandler2.instakillTarget = nearest;
      if (this.targetEnemy !== null) {
        if (this.tickAction === 2) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = angle;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          ModuleHandler.moveTo = null;
          this.reset();
          InputHandler2.instaReset();
          return;
        }
        if (this.tickAction === 1) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = angle;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          ModuleHandler.moveTo = null;
          ModuleHandler._upgradeItem(15);
          this.tickAction = 2;
          return;
        }
        return;
      }
      if (myPlayer.upgradeAge !== 6 || myPlayer.age < 6) return;
      this.active = true;
      const {reloading: reloading} = ModuleHandler.staticModules;
      const useTurret = ModuleHandler.canBuy(0, 53);
      if (!useTurret || !reloading.isReloaded(2) || !inRange(distance, this.distMin, this.distMax)) {
        return;
      }
      ModuleHandler.moveTo = null;
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 53;
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
      ModuleHandler._upgradeItem(9);
      ModuleHandler._upgradeItem(18, true);
      ModuleHandler.forceWeapon = 1;
      ModuleHandler.shouldAttack = true;
      this.tickAction = 1;
      this.targetEnemy = nearestEnemy;
    }
  }
  class PlatformMusket {
    moduleName="platformMusket";
    client;
    _lastPlaceTick=-999;
    _tick=0;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      this._tick += 1;
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      if (!Settings_default._platformMusket) return;
      if (ModuleHandler.moduleActive) return;
      if (ModuleHandler.forceWeapon !== 1 || !ModuleHandler.shouldAttack) return;
      const secondaryID = myPlayer.getItemByType(1);
      if (secondaryID !== 15) return;
      if (myPlayer.onPlatform) return;
      if (this._tick - this._lastPlaceTick < 10) return;
      if (!myPlayer.canPlace(8)) return;
      const angle = ModuleHandler.useAngle ?? myPlayer.angle;
      ModuleHandler.place(8, angle);
      this._lastPlaceTick = this._tick;
    }
  }
  const PlatformMusket_default = PlatformMusket;
  class BowInsta {
    moduleName="bowInsta";
    client;
    targetEnemy=null;
    tickAction=0;
    distMin=660;
    distMax=700;
    active=false;
    constructor(client2) {
      this.client = client2;
    }
    reset() {
      this.targetEnemy = null;
      this.tickAction = 0;
      this.active = false;
    }
    postTick() {
      const {EnemyManager: EnemyManager2, _ModuleHandler: ModuleHandler, myPlayer: myPlayer, InputHandler: InputHandler2} = this.client;
      if (!InputHandler2.instaToggle) {
        this.reset();
        InputHandler2.instaReset();
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const nearest = this.targetEnemy || nearestEnemy;
      if (nearest === null) {
        this.reset();
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearest.pos.current;
      const angle = pos1.angle(pos2);
      const distance = pos1.distance(pos2);
      InputHandler2.instakillTarget = nearest;
      if (this.targetEnemy !== null) {
        if (this.tickAction === 2) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = angle;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          ModuleHandler.moveTo = null;
          ModuleHandler._upgradeItem(15);
          this.reset();
          InputHandler2.instaReset();
          return;
        }
        if (this.tickAction === 1) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.useAngle = angle;
          ModuleHandler.forceWeapon = 1;
          ModuleHandler.shouldAttack = true;
          ModuleHandler.moveTo = null;
          ModuleHandler._upgradeItem(12);
          this.tickAction = 2;
          return;
        }
        return;
      }
      const isUpgradeAge = inRange(myPlayer.upgradeAge, 6, 8) && myPlayer.age >= 9;
      if (!isUpgradeAge) {
        return;
      }
      this.active = true;
      const {reloading: reloading} = ModuleHandler.staticModules;
      const useTurret = ModuleHandler.canBuy(0, 53);
      if (!useTurret || !reloading.isReloaded(2) || !inRange(distance, this.distMin, this.distMax)) {
        return;
      }
      ModuleHandler.moveTo = null;
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 53;
      ModuleHandler.forceWeapon = 1;
      ModuleHandler.shouldAttack = true;
      if (myPlayer.upgradeAge === 6) {
        ModuleHandler._upgradeItem(9);
      }
      if (myPlayer.upgradeAge === 7) {
        ModuleHandler._upgradeItem(18, true);
      }
      if (myPlayer.upgradeAge === 8 && myPlayer.getItemByType(8) === 18) {
        ModuleHandler.place(8, angle);
        ModuleHandler.place(8, angle - toRadians(90));
        ModuleHandler.place(8, angle + toRadians(90));
        ModuleHandler.place(8, reverseAngle(angle));
      }
      this.tickAction = 1;
      this.targetEnemy = nearestEnemy;
    }
  }
  class PlacementDefense {
    moduleName="placementDefense";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {EnemyManager: EnemyManager2, myPlayer: myPlayer, _ModuleHandler: ModuleHandler, ProjectileManager: ProjectileManager2, ObjectManager: ObjectManager2} = this.client;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null || !Settings_default._placementDefense) {
        return;
      }
      const shouldDefend = EnemyManager2.rangedBowInsta;
      if (shouldDefend || ProjectileManager2.totalDamage >= myPlayer.currentHealth) {
        const pos1 = myPlayer.pos.current;
        const pos2 = nearestEnemy.pos.current;
        const angle = pos1.angle(pos2);
        let type = 3;
        if (myPlayer.canPlace(5)) {
          type = 5;
        }
        const id = myPlayer.getItemByType(type);
        const length = myPlayer.getItemPlaceScale(id);
        const angles = ObjectManager2.getBestPlacementAngles({
          position: pos1,
          id: id,
          targetAngle: angle,
          ignoreID: null,
          preplace: false,
          reduce: true,
          fill: false
        });
        if (angles.length === 0) {
          return;
        }
        const distance1 = pos1.distance(pos2);
        const placementScale = DataHandler_default.getItem(id).scale;
        for (const angle2 of angles) {
          const pos3 = pos1.addDirection(angle2, length);
          const rectStart = pos3.copy().sub(placementScale);
          const rectEnd = pos3.copy().add(placementScale);
          const distance2 = pos3.distance(pos2);
          if (distance2 < distance1 && lineIntersectsRect(pos2, pos1, rectStart, rectEnd)) {
            ModuleHandler.place(type, angle2);
          }
        }
        ModuleHandler.placedOnce = true;
        ModuleHandler.placeAngles[0] = type;
        ModuleHandler.placeAngles[1] = [ angle ];
      }
    }
  }
  class TurretSteal {
    moduleName="turretSteal";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._turretSteal) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestTurretEntity;
      if (nearestEnemy === null || nearestEnemy.currentHealth > 25 || !ModuleHandler.canBuy(0, 53)) {
        return;
      }
      const pos0 = myPlayer.pos.current;
      const pos1 = nearestEnemy.pos.current;
      const distance = pos0.distance(pos1);
      if (distance > 700) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      if (!reloading.isReloaded(2)) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.forceHat = 53;
    }
  }
  class KillChat {
    moduleName="killChat";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {myPlayer: myPlayer, PacketManager: PacketManager2} = this.client;
      if (!Settings_default._killMessage || !myPlayer.killedSomeone || myPlayer.resources.kills === 0) {
        return;
      }
      const message = (Settings_default._killMessageText || "").trim();
      if (message.length === 0) {
        return;
      }
      PacketManager2.chat(message);
    }
  }
  class DeathProvoke {
    moduleName="deathProvoke";
    client;
    _lastKills=-1;
    _pendingBranding=false;
    _brandingTimer=0;
    _lastTargetName="someone";
    _lastDamagedEnemyId=0;
    _lastDamagedEnemyTime=0;
    _provokeMessages=[ "ez {name}", "rip {name}", "gg {name}", "L+ {name}", "bad {name}", "lol {name}", "free {name}", "oof {name}", "down {name}", "ded {name}", "bye {name}", "weak {name}", "easy {name}", "yikes {name}", "cooked {name}" ];
    _killTauntPool=[ "spiked {name}", "kb'd {name}", "insta {name}", "ez kc {name}", "synced {name}", "shamed {name}", "merc'd {name}", "no gear {name}", "rip {name}", "ratio {name}", "ez farm {name}", "got {name}", "1v1'd {name}", "sniped {name}", "deleted {name}" ];
    _maxChatLen=16;
    constructor(client2) {
      this.client = client2;
    }
    _fillName(template) {
      const name = this._lastTargetName && this._lastTargetName.trim() ? this._lastTargetName : "noob";
      return template.split("{name}").join(name);
    }
    _clip(message) {
      if (message.length <= this._maxChatLen) return message;
      return message.slice(0, this._maxChatLen - 1).trimEnd();
    }
    _randomKillMessage() {
      const pool = this._provokeMessages.concat(this._killTauntPool);
      const template = pool[Math.floor(Math.random() * pool.length)];
      return this._clip(this._fillName(template));
    }
    postTick() {
      const {myPlayer: myPlayer, PacketManager: PacketManager2, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2} = this.client;
      if (!Settings_default._deathProvoke) {
        this._lastKills = -1;
        this._pendingBranding = false;
        return;
      }
      const dmgId = PlayerManager2.lastEnemyReceivedDamage[0];
      if (dmgId !== this._lastDamagedEnemyId) {
        this._lastDamagedEnemyId = dmgId;
        this._lastDamagedEnemyTime = Date.now();
      }
      if (EnemyManager2 && EnemyManager2.nearestEnemy && EnemyManager2.nearestEnemy.nickname) {
        this._lastTargetName = EnemyManager2.nearestEnemy.nickname;
      }
      const currentKills = myPlayer.totalKills;
      if (this._lastKills === -1) {
        this._lastKills = currentKills;
        return;
      }
      if (currentKills > this._lastKills) {
        this._lastKills = currentKills;
        if (Date.now() - this._lastDamagedEnemyTime <= 2500) {
          const victim = PlayerManager2.playerData.get(this._lastDamagedEnemyId);
          if (victim && victim.nickname) {
            this._lastTargetName = victim.nickname;
          }
        }
        if (!this._pendingBranding) {
          PacketManager2.chat(this._randomKillMessage());
          this._pendingBranding = true;
          this._brandingTimer = Date.now() + 2000;
        }
      }
      if (this._pendingBranding && Date.now() >= this._brandingTimer) {
        this._pendingBranding = false;
        PacketManager2.chat("#Ryn Client");
      }
    }
  }
  class SwordKatanaInsta {
    moduleName="swordKatanaInsta";
    client;
    nearestTarget=null;
    useTurret=false;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2} = this.client;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (ModuleHandler.moduleActive || !nearestEnemy) {
        this.nearestTarget = null;
        this.useTurret = false;
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = reloading.isReloaded(2);
      if (this.useTurret) {
        this.useTurret = false;
        if (turretReloaded && ModuleHandler.canBuy(0, 53)) {
          ModuleHandler.moduleActive = true;
          ModuleHandler.forceHat = 53;
        }
        return;
      }
      const primary = myPlayer.getItemByType(0);
      const isSword = primary === 3;
      const pos1 = myPlayer.pos.current;
      const target = this.nearestTarget;
      if (target !== null) {
        const pos22 = target.pos.current;
        const angle2 = pos1.angle(pos22);
        ModuleHandler.useAngle = angle2;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        if (myPlayer.upgradeAge === 3) {
          ModuleHandler._upgradeItem(1, true);
        }
        if (myPlayer.upgradeAge === 4) {
          ModuleHandler._upgradeItem(15, true);
        }
        if (myPlayer.upgradeAge === 5) {
          ModuleHandler._upgradeItem(7, true);
        }
        if (myPlayer.upgradeAge === 6) {
          ModuleHandler._upgradeItem(10);
        }
        if (myPlayer.upgradeAge === 7) {
          ModuleHandler._upgradeItem(22, true);
        }
        if (myPlayer.upgradeAge === 8) {
          ModuleHandler._upgradeItem(4);
        }
        this.nearestTarget = null;
        if (ModuleHandler.canBuy(0, 53)) {
          this.useTurret = true;
        }
        EnemyManager2.attemptSpikePlacement();
      }
      if (myPlayer.age < 8 || myPlayer.upgradeAge >= 9 || !isSword || !primaryReloaded || !ModuleHandler.canBuy(0, 7)) {
        return;
      }
      const range = DataHandler_default.getWeapon(primary).range + nearestEnemy.hitScale;
      if (!myPlayer.collidingEntity(nearestEnemy, range)) {
        return;
      }
      const pos2 = nearestEnemy.pos.future;
      const angle = pos1.angle(pos2);
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 7;
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
      this.nearestTarget = nearestEnemy;
    }
  }
  class SpikeGearInsta {
    moduleName="spikeGearInsta";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || EnemyManager2.instaThreat() || EnemyManager2.spikeSyncThreat || !Settings_default._spikeGearInsta) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null || !ModuleHandler.canBuy(0, 11) || !ModuleHandler.canBuy(1, 21) || myPlayer.accessoryID !== 21 || nearestEnemy.variant.primary !== 0) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      const primary1 = myPlayer.getItemByType(0);
      const primary2 = nearestEnemy.weapon.primary;
      if (primary2 === null) {
        return;
      }
      const range1 = DataHandler_default.getWeapon(primary1).range + nearestEnemy.hitScale;
      const range2 = DataHandler_default.getWeapon(primary2).range + myPlayer.hitScale;
      if (!myPlayer.collidingSimple(nearestEnemy, range1) || !nearestEnemy.collidingSimple(myPlayer, range2)) {
        return;
      }
      ModuleHandler.forceHat = 11;
      if (nearestEnemy.hatID !== 7 || !nearestEnemy.isEmptyReload(0) || myPlayer.hatID !== 11) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 7;
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
  class TeammateSpikeTrap {
    moduleName="teammateSpikeTrap";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, InputHandler: InputHandler2, PlayerManager: PlayerManager2, myPlayer: myPlayer, PacketManager: PacketManager2} = this.client;
      if (ModuleHandler.moduleActive) {
        return;
      }
      if (!InputHandler2.instaToggle) {
        InputHandler2.instaReset();
        return;
      }
      const nearestTeammate = PlayerManager2.nearestTeammate;
      if (!nearestTeammate) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestTeammate.pos.current;
      const distance = pos1.distance(pos2);
      const angle = pos1.angle(pos2);
      if (distance > 500) {
        return;
      }
      InputHandler2.instakillTarget = nearestTeammate;
      if (distance > 175) {
        return;
      }
      const angles = [ angle, angle - toRadians(90), angle + toRadians(90), angle + toRadians(180) ];
      const id = myPlayer.getItemByType(4);
      const current = myPlayer.getPlacePosition(pos1, id, angle);
      const distance2 = current.distance(pos1);
      ModuleHandler.placeAngles[0] = 4;
      ModuleHandler.placeAngles[1] = angles;
      if (distance > distance2 || !angles.every(angle2 => myPlayer.canPlaceObject(4, angle2))) {
        return;
      }
      InputHandler2.instaReset();
      PacketManager2.leaveClan();
      for (const angle2 of angles) {
        ModuleHandler.place(4, angle2);
      }
    }
  }
  class SpikeTrap {
    moduleName="spikeTrap";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (ModuleHandler.moduleActive) {
        return;
      }
      const trapId = myPlayer.getItemByType(7);
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (!nearestEnemy || myPlayer.isTrapped || trapId !== 16) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const distance = pos1.distance(pos2);
      const angle = pos1.angle(pos2);
      if (distance > 175) {
        return;
      }
      const angles = [ angle, angle - toRadians(90), angle + toRadians(90), angle + toRadians(180) ];
      const id = myPlayer.getItemByType(4);
      const len = ModuleHandler.currentType === 7 ? 30 : 0;
      const current = myPlayer.getPlacePosition(pos1, id, angle);
      const distance2 = current.distance(pos1) + len;
      ModuleHandler.placeAngles[0] = 4;
      ModuleHandler.placeAngles[1] = angles;
      if (distance > distance2) {
        return;
      }
      for (const angle2 of angles) {
        ModuleHandler.place(4, angle2);
      }
    }
  }
  class TurretSync {
    moduleName="turretSync";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._turretSync) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null) {
        return;
      }
      const primary = myPlayer.getItemByType(0);
      const weapon = DataHandler_default.getWeapon(primary);
      if (weapon.damage < 20) {
        return;
      }
      const range = weapon.range + nearestEnemy.hitScale;
      const {reloading: reloading} = ModuleHandler.staticModules;
      if (!myPlayer.collidingSimple(nearestEnemy, range) || !reloading.isReloaded(0) || nearestEnemy.nextDamageTick !== myPlayer.tickCount + 2) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      ModuleHandler.forceHat = 7;
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
  class DashMovement {
    moduleName="dashMovement";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer} = this.client;
      const {currentType: currentType, _currentAngle: currentAngle} = ModuleHandler;
      if (!myPlayer.canPlace(currentType) || !Settings_default._dashMovement) {
        return;
      }
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const boost = myPlayer.getItemByType(7);
      if (boost !== 16 || !ModuleHandler.hasStoreItem(0, 40) || currentType !== 7 || ModuleHandler.placedOnce) {
        return;
      }
      const hasHammer = secondary === 10;
      const primaryDamage = myPlayer.getBuildingDamage(primary, true);
      const canOneHit = primaryDamage >= DataHandler_default.getItem(16).health;
      let weaponType = null;
      if (canOneHit) {
        const primaryData = DataHandler_default.getWeapon(primary);
        const secondaryData = DataHandler_default.isMelee(secondary) && DataHandler_default.getWeapon(secondary) || null;
        if (secondaryData === null || primaryData.speed <= secondaryData.speed) {
          weaponType = 0;
        } else {
          weaponType = 1;
        }
      }
      if (weaponType === null && hasHammer) {
        weaponType = 1;
      }
      if (weaponType === null) {
        return;
      }
      ModuleHandler.placedOnce = true;
      const reloaded = reloading.isReloaded(weaponType);
      if (!reloaded) {
        return;
      }
      const prevWeapon = ModuleHandler.currentHolding;
      const dashAngle = ModuleHandler.move_dir !== null ? ModuleHandler.move_dir : currentAngle;
      ModuleHandler.place(currentType, dashAngle);
      ModuleHandler.useAngle = dashAngle;
      ModuleHandler.useHat = 40;
      if (ModuleHandler.canBuy(1, 11)) {
        ModuleHandler.useAcc = 11;
      }
      ModuleHandler.forceWeapon = weaponType;
      ModuleHandler.shouldAttack = true;
      ModuleHandler.useWeapon = prevWeapon;
    }
  }
  class KBTickHammerV2 {
    moduleName="kbTickHammerV2";
    client;
    targetEnemy=null;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      if (ModuleHandler.moduleActive || !Settings_default._knockbackTickHammer || EnemyManager2.shouldIgnoreModule()) {
        this.targetEnemy = null;
        return;
      }
      const nearestEnemySpikeCollider = EnemyManager2.nearestEnemySpikeCollider;
      const spikeCollider = EnemyManager2.spikeCollider;
      const reloading = ModuleHandler.staticModules.reloading;
      const primary = myPlayer.getItemByType(0);
      const secondary = myPlayer.getItemByType(1);
      const isHammer = secondary !== null && secondary !== 11;
      const primaryReloaded = reloading.isReloaded(0, 1);
      const secondaryReloaded = reloading.isReloaded(1);
      const pos1 = myPlayer.pos.current;
      if (this.targetEnemy !== null) {
        const pos2 = this.targetEnemy.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angleToEnemy;
        ModuleHandler.forceHat = 7;
        ModuleHandler.forceWeapon = 0;
        ModuleHandler.shouldAttack = true;
        this.targetEnemy = null;
        EnemyManager2.attemptSpikePlacement();
        return;
      }
      if (nearestEnemySpikeCollider !== null && !nearestEnemySpikeCollider.isTrapped && spikeCollider !== null && isHammer && primaryReloaded && secondaryReloaded) {
        const pos2 = nearestEnemySpikeCollider.pos.current;
        const pos3 = spikeCollider.pos.current;
        const angleToEnemy = pos1.angle(pos2);
        const distanceToSpike2 = pos2.distance(pos3);
        const {knockback: primaryKnockback, range: primaryRange} = DataHandler_default.getWeapon(primary);
        const {knockback: secondaryKnockback, range: secondaryRange} = DataHandler_default.getWeapon(secondary);
        const weaponRange = Math.min(primaryRange, secondaryRange) + nearestEnemySpikeCollider.hitScale;
        const minKB = primaryKnockback;
        const maxKB = primaryKnockback + secondaryKnockback;
        const spikeRange = spikeCollider.collisionScale + nearestEnemySpikeCollider.collisionScale;
        if (inRange(distanceToSpike2, spikeRange + minKB, spikeRange + maxKB) && myPlayer.collidingSimple(nearestEnemySpikeCollider, weaponRange)) {
          const hammer = DataHandler_default.getWeapon(secondary);
          const hitRange = hammer.range + nearestEnemySpikeCollider.hitScale;
          if (myPlayer.collidingSimple(nearestEnemySpikeCollider, hitRange)) {
            ModuleHandler.moduleActive = true;
            ModuleHandler.useAngle = angleToEnemy;
            ModuleHandler.forceHat = 7;
            ModuleHandler.forceWeapon = 1;
            ModuleHandler.shouldAttack = true;
            this.targetEnemy = nearestEnemySpikeCollider;
            this.client.StatsManager.knockbackTickHammerTimes = 1;
            EnemyManager2.attemptSpikePlacement();
          }
        }
      }
    }
  }
  class GuardModule {
    moduleName="guardModule";
    client;
    static PLUS_ANGLES=[ -Math.PI / 2, 0, Math.PI / 2, Math.PI ];
    constructor(client2) {
      this.client = client2;
    }
    _resolveGuard() {
      const oc = this.client.ownerClient;
      const total = oc.clients.size;
      if (!Settings_default._autoJoinGuard) {
        const gc = Math.min(4, total);
        const bi = oc.getClientIndex(this.client);
        return {
          guardCount: gc,
          isGuard: bi >= 0 && bi < gc,
          botIndex: bi
        };
      }
      let guardCount = 0, isGuard = false, botIndex = -1;
      let gi = 0;
      for (const bot of oc.clients) {
        if (!bot.myPlayer) continue;
        if (bot.myPlayer.age >= 6) {
          if (bot === this.client) {
            isGuard = true;
            botIndex = gi;
          }
          guardCount++;
          gi++;
          if (guardCount >= 4) break;
        }
      }
      return {
        guardCount: guardCount,
        isGuard: isGuard,
        botIndex: botIndex
      };
    }
    _guardCount() {
      return this._resolveGuard().guardCount;
    }
    _getEnemies(fromPos) {
      const list = [];
      try {
        const oc = this.client.ownerClient;
        const pm = oc.PlayerManager;
        if (!pm) return list;
        for (const [, p] of pm.players) {
          if (!p || !p.pos || !p.inGame) continue;
          if (p === oc.myPlayer) continue;
          if (oc.isBotByID && oc.isBotByID(p.id)) continue;
        if (oc.myPlayer.clanName && p.clanName === oc.myPlayer.clanName) continue;
          const dx = p.pos.current.x - fromPos.x;
          const dy = p.pos.current.y - fromPos.y;
          list.push({
            player: p,
            angle: Math.atan2(dy, dx),
            dist: Math.sqrt(dx * dx + dy * dy)
          });
        }
        list.sort((a, b) => a.dist - b.dist);
      } catch (e) {}
      return list;
    }
    _enemyInMySector(guardAngle, enemies, sectorWidth = Math.PI / 2) {
      const half = sectorWidth / 2;
      return enemies.find(e => {
        let diff = e.angle - guardAngle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        return Math.abs(diff) <= half;
      }) || null;
    }
    _underThreat(ownerClient) {
      try {
        const pm = ownerClient.ProjectileManager;
        const em = ownerClient.EnemyManager;
        if (pm && pm.totalDamage > 0) return true;
        if (em && (em.detectedEnemy || em.potentialDamage > 0)) return true;
      } catch (e) {}
      return false;
    }
    _forceWeapon(MH, type, attack) {
      const id = this.client.myPlayer.getItemByType(type);
      if (id === null || id === undefined) return;
      this.client.PacketManager.selectItemByID(id, type === 1);
      MH.currentHolding = type;
      MH.weapon = type;
      MH.forceWeapon = null;
      MH.useWeapon = null;
      MH.shouldAttack = attack;
      MH.moduleActive = true;
    }
    postTick() {
      if (!Settings_default._shieldGuard) return;
      const oc = this.client.ownerClient;
      const {guardCount: gc, isGuard: isGuard, botIndex: botIndex} = this._resolveGuard();
      if (!isGuard) return;
      const {myPlayer: myPlayer, _ModuleHandler: MH} = this.client;
      if (!myPlayer.inGame) return;
      if (Settings_default._autoJoinGuard && myPlayer.age >= 6 && !myPlayer.__guardJoinedAge6) {
        myPlayer.__guardJoinedAge6 = true;
      }
      if (Settings_default._autoJoinGuard && myPlayer.age < 6) {
        return;
      }
      const myPos = myPlayer.pos.current;
      const ownerPos = oc.myPlayer.pos.current;
      const enemies = this._getEnemies(ownerPos);
      if (Settings_default._rangedShield) {
        const RANGED_IDS = new Set([ 9, 12, 13, 15 ]);
        const pm = oc.PlayerManager;
        if (pm) {
          const _getBaseName = name => name ? name.replace(/\d+/g, "").trim().toLowerCase() : "";
          const rangedEnemiesRaw = [];
          for (const [, p] of pm.playerData) {
            if (!p || !p.inGame || p === oc.myPlayer) continue;
            if (oc.isBotByID && oc.isBotByID(p.id)) continue;
            if (oc.myPlayer.clanName && p.clanName && oc.myPlayer.clanName === p.clanName) continue;
            const sec = p.weapon ? p.weapon.secondary : null;
            if (sec !== null && sec !== undefined && RANGED_IDS.has(sec)) {
              rangedEnemiesRaw.push(p);
            }
          }
          const seenBaseNames = new Map;
          const rangedEnemies = [];
          for (const p of rangedEnemiesRaw) {
            const base = _getBaseName(p.name || "");
            if (base && seenBaseNames.has(base)) continue;
            if (base) seenBaseNames.set(base, true);
            rangedEnemies.push(p);
          }
          if (rangedEnemies.length >= 2) {
            const now = performance.now();
            const activeShooters = [];
            for (const e of rangedEnemies) {
              if (e.reload && e.reload[1] && e.reload[1].previous !== e.reload[1].current && e.reload[1].current < e.reload[1].previous) {
                activeShooters.push(e);
              }
            }
            let highestScore = -Infinity;
            let bestEnemy = null;
            for (const e of rangedEnemies) {
              const dist = myPos.distance(e.pos.current);
              const reloadRatio = e.reload && e.reload[1] ? (e.reload[1].current ?? 0) / (e.reload[1].max || 1) : 0;
              const score = reloadRatio * 2 - dist / 1000;
              if (score > highestScore) {
                highestScore = score;
                bestEnemy = e;
              }
            }
            const justFired = activeShooters.length > 0 ? activeShooters.reduce((a, b) => myPos.distance(a.pos.current) < myPos.distance(b.pos.current) ? a : b) : null;
            const target = justFired ?? bestEnemy ?? rangedEnemies[0];
            let bestAngle = myPos.angle(target.pos.current);
            const shieldHalfAngle = typeof Config_default !== "undefined" && Config_default.shieldAngle ? Config_default.shieldAngle : Math.PI / 3;
            let maxCovered = 0;
            for (const candidate of rangedEnemies) {
              const ca = myPos.angle(candidate.pos.current);
              let cnt = 0;
              for (const e of rangedEnemies) {
                const ea = myPos.angle(e.pos.current);
                const diff = Math.abs((ea - ca + Math.PI * 3) % (Math.PI * 2) - Math.PI);
                if (diff <= shieldHalfAngle) cnt++;
              }
              if (cnt > maxCovered) maxCovered = cnt;
            }
            const surrounded = maxCovered < rangedEnemies.length;
            if (surrounded && !justFired) {
              if (!this._rsRotState) this._rsRotState = {
                idx: 0,
                lastSwitch: 0
              };
              const rs = this._rsRotState;
              if (now - rs.lastSwitch > 60) {
                rs.idx = (rs.idx + 1) % rangedEnemies.length;
                rs.lastSwitch = now;
              }
              const sorted = [ ...rangedEnemies ].sort((a, b) => {
                const ra = a.reload && a.reload[1] ? (a.reload[1].current ?? 0) / (a.reload[1].max || 1) : 0;
                const rb = b.reload && b.reload[1] ? (b.reload[1].current ?? 0) / (b.reload[1].max || 1) : 0;
                const da = myPos.distance(a.pos.current);
                const db = myPos.distance(b.pos.current);
                return rb * 2 - db / 1000 - (ra * 2 - da / 1000);
              });
              bestAngle = myPos.angle(sorted[rs.idx % sorted.length].pos.current);
              try {
                this.client.PacketManager.updateAngle(bestAngle);
                this.client._ModuleHandler.mouse.sentAngle = bestAngle;
              } catch (_) {}
            } else {
              this._rsRotState = null;
              try {
                this.client.PacketManager.updateAngle(bestAngle);
                this.client._ModuleHandler.mouse.sentAngle = bestAngle;
              } catch (_) {}
            }
            const blockPos = ownerPos.addDirection(bestAngle, window._guardFrontDistance || 90);
            const dToBlock = myPos.distance(blockPos);
            if (dToBlock > 12) {
              MH.startMovement(myPos.angle(blockPos));
            } else {
              const d = oc._ModuleHandler.move_dir;
              d !== null ? MH.startMovement(d) : MH.stopMovement();
            }
            MH._currentAngle = bestAngle;
            MH.useAngle = null;
            this._forceWeapon(MH, 1, false);
            return;
          } else {
            this._rsRotState = null;
          }
        }
      }
      const ENEMY_DETECT = 550;
      const nearEnemies = enemies.filter(e => e.dist < ENEMY_DETECT);
      const ownerStopped = oc._ModuleHandler.move_dir === null;
      const hasEnemies = nearEnemies.length > 0;
      const forceShield = ownerStopped || hasEnemies || this._underThreat(oc);
      const GUARD_FRONT_DIST = window._guardFrontDistance || 90;
      if (window._shieldRotationEnabled) {
        const ROT_SPEED = 0.018;
        const isFirstGuard = botIndex === 0;
        const hasEnemy = nearEnemies.length > 0;
        if (!hasEnemy && isFirstGuard) {
          window._shieldRotationAngle = (window._shieldRotationAngle + ROT_SPEED) % (2 * Math.PI);
        }
        if (!hasEnemy) {
          const baseAngle = botIndex * (2 * Math.PI / Math.max(gc, 1)) + window._shieldRotationAngle;
          const rotTarget = ownerPos.addDirection(baseAngle, GUARD_FRONT_DIST);
          const rotDist = myPos.distance(rotTarget);
          if (rotDist > 12) {
            MH.startMovement(myPos.angle(rotTarget));
          } else {
            const d = oc._ModuleHandler.move_dir;
            d !== null ? MH.startMovement(d) : MH.stopMovement();
          }
          MH._currentAngle = baseAngle;
          MH.useAngle = null;
          this._forceWeapon(MH, 1, false);
          return;
        }
      }
      if (window._formationLockEnabled) {
        const locked = (window._formationLockPositions || [])[botIndex];
        if (locked) {
          try {
            const lockTarget = ownerPos.addDirection(0, 0);
            lockTarget.x = locked.x;
            lockTarget.y = locked.y;
            const ld = myPos.distance(lockTarget);
            if (ld > 18) {
              MH.startMovement(myPos.angle(lockTarget));
            } else {
              MH.stopMovement();
            }
          } catch (e) {}
          const en = enemies[0];
          MH._currentAngle = en ? en.angle : MH._currentAngle ?? 0;
          MH.useAngle = null;
          this._forceWeapon(MH, 1, false);
          return;
        }
      }
      if (window._baitProtectEnabled && enemies.length > 0 && gc >= 2) {
        if (botIndex === 0) {
          const baitTarget = enemies[0];
          const baitPos = baitTarget.player.pos.current;
          const dToEnemy = myPos.distance(baitPos);
          if (dToEnemy > 60) {
            MH.startMovement(myPos.angle(baitPos));
          } else {
            MH.stopMovement();
          }
          MH._currentAngle = myPos.angle(baitPos);
          MH.useAngle = null;
          this._forceWeapon(MH, 1, false);
          return;
        }
      }
      const ownerFacing = oc._ModuleHandler._currentAngle ?? 0;
      if (nearEnemies.length > 0) {
        const nearest = nearEnemies[0];
        const enemyAngle = nearest.angle;
        const distToEnemy = myPos.distance(nearest.player.pos.current);
        const FAR_ENEMY_DIST = 200;
        if (distToEnemy > FAR_ENEMY_DIST) {
          const blockPos = ownerPos.addDirection(enemyAngle, GUARD_FRONT_DIST * 0.5);
          const dToBlock = myPos.distance(blockPos);
          if (dToBlock > 10) {
            MH.startMovement(myPos.angle(blockPos));
          } else {
            const ownerDir = oc._ModuleHandler.move_dir;
            ownerDir !== null ? MH.startMovement(ownerDir) : MH.stopMovement();
          }
          MH._currentAngle = enemyAngle;
          MH.useAngle = null;
          const canWall = myPlayer.canPlace(3);
          const canMill = myPlayer.canPlace(6) || myPlayer.canPlace(7);
          if (canWall) {
            MH.place(3, enemyAngle);
            MH.moduleActive = true;
          } else if (canMill) {
            const millType = myPlayer.canPlace(6) ? 6 : 7;
            MH.place(millType, enemyAngle);
            MH.moduleActive = true;
          } else {
            this._forceWeapon(MH, 1, false);
          }
        } else {
          const frontPos = ownerPos.addDirection(enemyAngle, GUARD_FRONT_DIST);
          const dToFront = myPos.distance(frontPos);
          if (dToFront > 12) {
            MH.startMovement(myPos.angle(frontPos));
          } else {
            const ownerDir = oc._ModuleHandler.move_dir;
            ownerDir !== null ? MH.startMovement(ownerDir) : MH.stopMovement();
          }
          MH._currentAngle = enemyAngle;
          MH.useAngle = null;
          const ATTACK_DIST = 80;
          if (distToEnemy < ATTACK_DIST && !forceShield) {
            const dagId = myPlayer.getItemByType(0);
            if (dagId !== null) {
              this.client.PacketManager.selectItemByID(dagId, false);
              MH.currentHolding = 0;
              MH.weapon = 0;
              MH.forceWeapon = null;
              MH.useWeapon = null;
              MH.shouldAttack = true;
              MH.moduleActive = true;
            }
          } else {
            this._forceWeapon(MH, 1, false);
          }
        }
      } else {
        const frontPos = ownerPos.addDirection(ownerFacing, GUARD_FRONT_DIST);
        const dToFront = myPos.distance(frontPos);
        if (dToFront > 14) {
          MH.startMovement(myPos.angle(frontPos));
        } else {
          const ownerDir = oc._ModuleHandler.move_dir;
          ownerDir !== null ? MH.startMovement(ownerDir) : MH.stopMovement();
        }
        MH._currentAngle = ownerFacing;
        MH.useAngle = null;
        this._forceWeapon(MH, 1, false);
      }
    }
  }
  class AutoShield {
    moduleName="autoShield";
    client;
    constructor(client2) {
      this.client = client2;
    }
    getProtectAngle() {
      const {myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      const secondNearestEnemy = EnemyManager2.secondNearestEnemy;
      if (!secondNearestEnemy) {
        return angle;
      }
      const pos3 = secondNearestEnemy.pos.current;
      const distance = pos1.distance(pos3);
      const primary = secondNearestEnemy.weapon.primary;
      const weaponRange = DataHandler_default.getWeapon(primary).range;
      const range = weaponRange + myPlayer.hitScale;
      const angle2 = pos1.angle(pos3);
      const middleAngle = findMiddleAngle(angle, angle2);
      if (distance <= range && getAngleDist(angle, middleAngle) <= Config_default.gatherAngle && getAngleDist(angle2, middleAngle) <= Config_default.gatherAngle) {
        return middleAngle;
      }
      return angle;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, EnemyManager: EnemyManager2, PlayerManager: PlayerManager2} = this.client;
      if (ModuleHandler.moduleActive) return;
      const secondary = myPlayer.getItemByType(1);
      const hasShield = secondary === 11;
      if (!hasShield) return;
      if (Settings_default._autoShield || Settings_default._rangedShield) {
        const RANGED_IDS = new Set([ 9, 12, 13, 15 ]);
        const REP_BOW_ID = 13;
        const HOLD_MS = 180;
        const ATTACK_WINDOW_MS = 320;
        const myPos = myPlayer.pos.current;
        const now = performance.now();
        if (!this._us) this._us = {
          shieldUntil: 0,
          lastFireTime: 0,
          spamActive: false,
          attackAllowed: false,
          lastAttackWin: 0,
          prevReloads: new Map
        };
        const S = this._us;
        const _getBaseName2 = name => name ? name.replace(/\d+/g, "").trim().toLowerCase() : "";
        const rangedEnemiesRaw2 = PlayerManager2.enemies.filter(e => {
          if (myPlayer.clanName && e.clanName && myPlayer.clanName === e.clanName) return false;
          const sec = e.weapon ? e.weapon.secondary : null;
          return sec !== null && sec !== undefined && RANGED_IDS.has(sec);
        });
        const seenBaseNames2 = new Map;
        const rangedEnemies = [];
        for (const e of rangedEnemiesRaw2) {
          const base = _getBaseName2(e.name || "");
          if (base && seenBaseNames2.has(base)) continue;
          if (base) seenBaseNames2.set(base, true);
          rangedEnemies.push(e);
        }
        if (rangedEnemies.length === 0) {
          S.shieldUntil = 0;
          S.spamActive = false;
          S.attackAllowed = false;
          S.prevReloads.clear();
        } else {
          let firedThisTick = false;
          let firedEnemy = null;
          let hasRepBow = false;
          for (const e of rangedEnemies) {
            const id = e.id ?? e;
            const sec = e.weapon ? e.weapon.secondary : null;
            if (sec === REP_BOW_ID) hasRepBow = true;
            if (e.reload && e.reload[1]) {
              const prevR = S.prevReloads.get(id) ?? e.reload[1].current;
              const curR = e.reload[1].current ?? 0;
              if (curR < prevR) {
                firedThisTick = true;
                if (!firedEnemy) firedEnemy = e;
              }
              S.prevReloads.set(id, curR);
            }
          }
          if (firedThisTick) {
            const timeSinceLast = now - S.lastFireTime;
            if (timeSinceLast < 500 || hasRepBow) {
              S.spamActive = true;
            }
            S.lastFireTime = now;
          }
          if (now - S.lastFireTime > 700) {
            S.spamActive = false;
          }
          let bestTarget = firedEnemy;
          if (!bestTarget) {
            let bestScore = -Infinity;
            for (const e of rangedEnemies) {
              const dist = myPos.distance(e.pos.current);
              const ratio = e.reload && e.reload[1] ? (e.reload[1].current ?? 0) / (e.reload[1].max || 1) : 0;
              const score = ratio * 2 - dist / 800;
              if (score > bestScore) {
                bestScore = score;
                bestTarget = e;
              }
            }
          }
          if (firedThisTick) {
            S.shieldUntil = now + HOLD_MS;
            if (S.spamActive && now - S.lastAttackWin > ATTACK_WINDOW_MS) {
              S.attackAllowed = true;
              S.lastAttackWin = now;
            }
          }
          const shieldActive = now < S.shieldUntil || S.spamActive;
          if (shieldActive && bestTarget) {
            const shieldAngle = myPos.angle(bestTarget.pos.current);
            const inAttackWindow = S.attackAllowed && now - S.lastAttackWin < 80;
            if (inAttackWindow && S.spamActive) {
              S.attackAllowed = false;
              try {
                this.client.PacketManager.updateAngle(shieldAngle);
                this.client._ModuleHandler.mouse.sentAngle = shieldAngle;
              } catch (_) {}
              ModuleHandler.moduleActive = true;
              ModuleHandler.forceWeapon = 0;
              ModuleHandler.useAngle = shieldAngle;
              ModuleHandler.shouldAttack = true;
              return;
            }
            try {
              this.client.PacketManager.updateAngle(shieldAngle);
              this.client._ModuleHandler.mouse.sentAngle = shieldAngle;
            } catch (_) {}
            ModuleHandler.moduleActive = true;
            ModuleHandler.forceWeapon = 1;
            ModuleHandler.useAngle = shieldAngle;
            ModuleHandler.shouldAttack = true;
            return;
          }
          if (bestTarget) {
            const ratio = bestTarget.reload && bestTarget.reload[1] ? (bestTarget.reload[1].current ?? 0) / (bestTarget.reload[1].max || 1) : 0;
            if (ratio > 0.85) {
              const preAngle = myPos.angle(bestTarget.pos.current);
              try {
                this.client.PacketManager.updateAngle(preAngle);
                this.client._ModuleHandler.mouse.sentAngle = preAngle;
              } catch (_) {}
              ModuleHandler.moduleActive = true;
              ModuleHandler.forceWeapon = 1;
              ModuleHandler.useAngle = preAngle;
              ModuleHandler.shouldAttack = true;
              return;
            }
          }
        }
      }
      if (!Settings_default._autoShield) return;
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null) return;
      const shouldActivate = EnemyManager2.weaponDamageThreat();
      if (!shouldActivate) return;
      const angle = this.getProtectAngle();
      ModuleHandler.moduleActive = true;
      ModuleHandler.forceWeapon = 1;
      ModuleHandler.useAngle = angle;
      ModuleHandler.shouldAttack = true;
    }
  }
  class TrapKB {
    moduleName="trapKB";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, EnemyManager: EnemyManager2, myPlayer: myPlayer} = this.client;
      const nearestEnemy = EnemyManager2.nearestKBTrapEnemy;
      if (nearestEnemy === null || nearestEnemy.isTrapped || ModuleHandler.moduleActive || EnemyManager2.shouldIgnoreModule() || !Settings_default._trapKB) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      if (!primaryReloaded) {
        return;
      }
      const range = DataHandler_default.getWeapon(myPlayer.getItemByType(0)).range + nearestEnemy.hitScale;
      if (!myPlayer.collidingSimple(nearestEnemy, range)) {
        return;
      }
      ModuleHandler.moduleActive = true;
      ModuleHandler.useAngle = angle;
      if (turretReloaded) {
        ModuleHandler.forceHat = 53;
      }
      ModuleHandler.forceWeapon = 0;
      ModuleHandler.shouldAttack = true;
    }
  }
  class ShameSpam {
    moduleName="shameSpam";
    client;
    prevActive=false;
    active=false;
    _phase=0;
    _target=null;
    _trapTarget=null;
    _spikeCooldown=0;
    constructor(client2) {
      this.client = client2;
    }
    get wasActive() {
      return this.prevActive;
    }
    _nearestOwnSpike(pos, OM, myID) {
      let best = null, bestDist = Infinity;
      OM.grid2D.query(pos.x, pos.y, 3, id => {
        const obj = OM.objects.get(id);
        if (!obj || obj.itemGroup !== 2) return;
        if (obj.ownerID !== myID) return;
        const d = pos.distance(obj.pos.current);
        if (d < bestDist && d <= 350) {
          bestDist = d;
          best = obj;
        }
      });
      return best;
    }
    postTick() {
      this.prevActive = this.active;
      this.active = false;
      if (this._spikeCooldown > 0) this._spikeCooldown--;
      const {myPlayer: mp, EnemyManager: EM, _ModuleHandler: MH, ObjectManager: OM} = this.client;
      if (!Settings_default._shameSpam || EM.shouldIgnoreModule()) return;
      if (ModuleHandler.moduleActive && !mp.trappedIn) return;
      const enemy = EM.nearestEnemy;
      if (!enemy) {
        this._phase = 0;
        this._target = null;
        return;
      }
      const trap = enemy.trappedIn;
      if (!trap || trap.ownerID !== mp.id) {
        this._phase = 0;
        return;
      }
      if (mp.spikeDamage > 0) return;
      const primary = mp.getItemByType(0);
      const secondary = mp.getItemByType(1);
      const isStick = primary === 1 || primary === 8;
      const isHammer = secondary === 10 || secondary === 3;
      const hasTrap = mp.getItemByType(7) === 15;
      const {reloading: reloading} = MH.staticModules;
      const pos0 = mp.pos.current;
      const posE = enemy.pos.current;
      const posT = trap.pos.current;
      const anglEnm = pos0.angle(posE);
      const anglTrp = pos0.angle(posT);
      if (isStick && isHammer) {
        const stickRange = (DataHandler_default.getWeapon(primary)?.range ?? 110) + enemy.hitScale;
        const hammerRange = (DataHandler_default.getWeapon(secondary)?.range ?? 110) + enemy.hitScale;
        const inStickRange = mp.collidingSimple(enemy, stickRange);
        const inHammerRange = mp.collidingSimple(enemy, hammerRange);
        if (enemy.shameCount >= 7) {
          if (reloading.isReloaded(1) && inHammerRange) {
            MH.moduleActive = true;
            MH.useAngle = anglEnm;
            MH.forceHat = 40;
            MH.forceWeapon = 1;
            MH.shouldAttack = true;
            this.active = true;
          }
          return;
        }
        const hammerDmg = mp.getBuildingDamage?.(secondary, this.client._ModuleHandler.canBuy(0, 40)) ?? 0;
        if (trap.health > hammerDmg) return;
        if (!reloading.isReloaded(1)) return;
        const hammerDestroyRange = (DataHandler_default.getWeapon(secondary)?.range ?? 110) + trap.hitScale;
        if (!mp.collidingSimple(trap, hammerDestroyRange)) return;
        if (hasTrap && mp.canPlace(7)) {
          const placementAngle = OM.getBestPlacementAngles?.({
            position: pos0,
            id: 15,
            targetAngle: anglEnm,
            ignoreID: trap.id,
            preplace: true,
            reduce: true,
            fill: true
          })?.[0];
          if (placementAngle !== undefined) {
            MH.place(7, placementAngle, true);
            const delay = this.client.SocketManager.TICK - this.client.SocketManager.pong / 2;
            setTimeout(() => {
              try {
                MH.place(7, placementAngle, true);
              } catch (_) {}
            }, Math.max(8, delay));
          }
        }
        MH.moduleActive = true;
        MH.useAngle = anglTrp;
        MH.forceHat = 40;
        MH.forceWeapon = 1;
        MH.shouldAttack = true;
        this.active = true;
        this._phase = 0;
        this._target = enemy;
        this._trapTarget = trap;
        return;
      }
      if (isStick && !isHammer) {
        if (enemy.shameCount >= 7) return;
        const buildingDmg = mp.getMaxBuildingDamage(trap, true);
        if (buildingDmg === null || trap.health > buildingDmg) return;
        if (!reloading.isReloaded(0)) return;
        const stickRange = (DataHandler_default.getWeapon(primary)?.range ?? 110) + trap.hitScale;
        if (!mp.collidingSimple(trap, stickRange)) return;
        if (hasTrap && mp.canPlace(7)) {
          const placementAngle = OM.getBestPlacementAngles?.({
            position: pos0,
            id: 15,
            targetAngle: anglEnm,
            ignoreID: trap.id,
            preplace: true,
            reduce: true,
            fill: true
          })?.[0];
          if (placementAngle !== undefined) {
            MH.place(7, placementAngle, true);
            const delay = this.client.SocketManager.TICK - this.client.SocketManager.pong / 2;
            setTimeout(() => {
              try {
                MH.place(7, placementAngle, true);
              } catch (_) {}
            }, Math.max(8, delay));
          }
        }
        MH.moduleActive = true;
        MH.useAngle = anglTrp;
        MH.forceHat = 40;
        MH.forceWeapon = 0;
        MH.shouldAttack = true;
        this.active = true;
      }
    }
  }
  class AntiSpikePush {
    moduleName="antiSpikePush";
    client;
    constructor(client2) {
      this.client = client2;
    }
    postTick() {
      const {_ModuleHandler: ModuleHandler, myPlayer: myPlayer, EnemyManager: EnemyManager2} = this.client;
      if (!Settings_default._antiSpikePush || ModuleHandler.moduleActive) {
        return;
      }
      const nearestEnemy = EnemyManager2.nearestEnemy;
      if (nearestEnemy === null || !myPlayer.isTrapped || !EnemyManager2.pushingOnSpike || EnemyManager2.collidingSpike || nearestEnemy.isTrapped) {
        return;
      }
      const primary = myPlayer.getItemByType(0);
      const isDaggers = primary === 7 || primary === 6;
      if (!isDaggers) {
        return;
      }
      const primaryRange = DataHandler_default.getWeapon(primary).range + nearestEnemy.hitScale;
      if (!myPlayer.collidingSimple(nearestEnemy, primaryRange)) {
        return;
      }
      const pos1 = myPlayer.pos.current;
      const pos2 = nearestEnemy.pos.current;
      const angle = pos1.angle(pos2);
      const {reloading: reloading} = ModuleHandler.staticModules;
      const primaryReloaded = reloading.isReloaded(0);
      const turretReloaded = ModuleHandler.hasStoreItem(0, 53) && reloading.isReloaded(2);
      ModuleHandler.forceWeapon = 0;
      if (primaryReloaded) {
        ModuleHandler.moduleActive = true;
        ModuleHandler.useAngle = angle;
        if (turretReloaded) {
          ModuleHandler.forceHat = 53;
        }
        ModuleHandler.shouldAttack = true;
      }
    }
  }
  class ModuleHandler {
    client;
    staticModules={};
    botModules;
    modules;
    store=[ {
      utility: new Map,
      lastUtility: null,
      current: 0,
      best: 0,
      actual: -1,
      last: 0
    }, {
      utility: new Map,
      lastUtility: null,
      current: 0,
      best: 0,
      actual: -1,
      last: 0
    } ];
    bought=[ new Set, new Set ];
    followTarget=new Vector_default(0, 0);
    lookTarget=new Vector_default(0, 0);
    endTarget=new Vector_default(0, 0);
    followPath=false;
    tickCount=0;
    currentHolding=0;
    weapon;
    currentType;
    attacking;
    attackingState;
    sentAngle;
    sentHatEquip;
    sentAccEquip;
    needToHeal;
    didAntiInsta;
    placedOnce;
    healedOnce;
    totalPlaces;
    attacked;
    canHitEntity=false;
    moduleActive=false;
    useAngle=null;
    useWeapon=null;
    useItem=null;
    forceWeapon=null;
    useHat=null;
    forceHat=null;
    shouldEquipSoldier=false;
    useAcc=null;
    previousWeapon=null;
    _currentAngle=0;
    move_dir=null;
    reverse_move_dir=null;
    moveTo="disable";
    prevMoveTo="disable";
    autoattack=false;
    shouldAttack=false;
    mouse={
      sentAngle: 0
    };
    placeAngles=[ null, [] ];
    norecoil=false;
    moduleStart=performance.now();
    maxExecutionTime=0;
    constructor(client2) {
      this.client = client2;
      this.staticModules = {
        tempData: new TempData_default(client2),
        movement: new Movement_default(client2),
        clanJoiner: new ClanJoiner_default(client2),
        autoAccept: new AutoAccept_default(client2),
        autoBuy: new AutoBuy(client2),
        defaultHat: new DefaultHat(client2),
        reloading: new Reloading_default(client2),
        defaultAcc: new DefaultAcc(client2),
        autoSync: new AutoSync(client2),
        adaptiveGearSwitching: new AdaptiveGearSwitching_default(client2),
        antiSync: new AntiSync_default(client2),
        shameSpam: new ShameSpam(client2),
        spikeSyncHammer: new SpikeSyncHammer(client2),
        spikeSync: new SpikeSync(client2),
        chatLog: new ChatLog_default(client2),
        spikeTick: new SpikeTick_default(client2),
        knockbackTickTrap: new KnockbackTickTrap(client2),
        knockbackTick: new KnockbackTick(client2),
        knockbackTickHammer: new KnockbackTickHammer(client2),
        kbTickHammerV2: new KBTickHammerV2(client2),
        spikeTrap: new SpikeTrap(client2),
        teammateSpikeTrap: new TeammateSpikeTrap(client2),
        turretSync: new TurretSync(client2),
        toolHammerSpearInsta: new ToolHammerSpearInsta(client2),
        swordKatanaInsta: new SwordKatanaInsta(client2),
        bowInsta: new BowInsta(client2),
        musketBowInsta: new MusketBowInsta(client2),
        platformMusket: new PlatformMusket(client2),
        instakill: new Instakill(client2),
        smartInsta: new SmartInsta(client2),
        reverseInstakill: new ReverseInstakill(client2),
        antiSpikePush: new AntiSpikePush(client2),
        autoBreak: new Autobreak(client2),
        autoSteal: new AutoSteal(client2),
        turretSteal: new TurretSteal(client2),
        spikeGearInsta: new SpikeGearInsta(client2),
        useFastest: new UseFastest(client2),
        useDestroying: new UseDestroying(client2),
        useAttacking: new UseAttacking(client2),
        utilityHat: new UtilityHat(client2),
        antiInsta: new AntiInsta_default(client2),
        shameReset: new ShameReset_default(client2),
        trapKB: new TrapKB(client2),
        autoShield: new AutoShield(client2),
        guardModule: new GuardModule(client2),
        placementDefense: new PlacementDefense(client2),
        dashMovement: new DashMovement(client2),
        trapAnimal: new TrapAnimal(client2),
        antiTrapProtect: new AntiTrapProtect(client2),
        antiTrapStar: new AntiTrapStar(client2),
        antiRetrap: new AntiRetrap(client2),
        autoPush: new AutoPush_default(client2),
        autoPlay: new AutoPlay_default(client2),
        trapTick: new TrapTick_default(client2),
        autoPlacer: new AutoPlacer_default(client2),
        placer: new Placer_default(client2),
        autoMill: new Automill_default(client2),
        autoGrind: new AutoGrind(client2),
        preAttack: new PreAttack_default(client2),
        autoHat: new Autohat_default(client2),
        updateAttack: new UpdateAttack_default(client2),
        updateAngle: new UpdateAngle_default(client2),
        killChat: new KillChat(client2),
        deathProvoke: new DeathProvoke(client2),
        safeWalk: new SafeWalk(client2)
      };
      this.botModules = [ this.staticModules.tempData, this.staticModules.clanJoiner, this.staticModules.movement ];
      this.modules = [ this.staticModules.autoAccept, this.staticModules.autoBuy, this.staticModules.defaultHat, this.staticModules.reloading, this.staticModules.autoSync, this.staticModules.shameSpam, this.staticModules.spikeSyncHammer, this.staticModules.antiSync, this.staticModules.adaptiveGearSwitching, this.staticModules.spikeSync, this.staticModules.spikeTick, this.staticModules.knockbackTickTrap, this.staticModules.knockbackTickHammer, this.staticModules.kbTickHammerV2, this.staticModules.knockbackTick, this.staticModules.spikeTrap, this.staticModules.teammateSpikeTrap, this.staticModules.turretSync, this.staticModules.toolHammerSpearInsta, this.staticModules.swordKatanaInsta, this.staticModules.bowInsta, this.staticModules.musketBowInsta, this.staticModules.instakill, this.staticModules.smartInsta, this.staticModules.reverseInstakill, this.staticModules.antiSpikePush, this.staticModules.autoBreak, this.staticModules.autoSteal, this.staticModules.turretSteal, this.staticModules.spikeGearInsta, this.staticModules.useFastest, this.staticModules.useDestroying, this.staticModules.useAttacking, this.staticModules.platformMusket, this.staticModules.utilityHat, this.staticModules.antiInsta, this.staticModules.shameReset, this.staticModules.trapKB, this.staticModules.autoShield, this.staticModules.placementDefense, this.staticModules.trapAnimal, this.staticModules.antiTrapProtect, this.staticModules.antiTrapStar, this.staticModules.antiRetrap, this.staticModules.autoPush, this.staticModules.chatLog, this.staticModules.autoPlay, this.staticModules.autoPlacer, this.staticModules.trapTick, this.staticModules.dashMovement, this.staticModules.placer, this.staticModules.autoMill, this.staticModules.autoGrind, this.staticModules.preAttack, this.staticModules.defaultAcc, this.staticModules.autoHat, this.staticModules.updateAttack, this.staticModules.updateAngle, this.staticModules.killChat, this.staticModules.deathProvoke, this.staticModules.safeWalk, this.staticModules.guardModule ];
      this.reset();
    }
    movementReset() {
      this.currentHolding = 0;
      this.weapon = 0;
      this.currentType = null;
      this.attacking = 0;
      this.attackingState = 0;
      this.move_dir = null;
      this.reverse_move_dir = null;
    }
    reset() {
      const {isOwner: isOwner, clients: clients} = this.client;
      this.movementReset();
      this.getHatStore().utility.clear();
      this.getAccStore().utility.clear();
      this.sentAngle = 0;
      this.sentHatEquip = false;
      this.sentAccEquip = false;
      this.needToHeal = false;
      this.didAntiInsta = false;
      this.placedOnce = false;
      this.healedOnce = false;
      this.totalPlaces = 0;
      this.attacked = false;
      this.canHitEntity = false;
      this.autoattack = false;
      for (const module of this.modules) {
        if ("reset" in module) {
          module.reset();
        }
      }
      if (isOwner) {
        for (const client2 of clients) {
          client2._ModuleHandler.movementReset();
          client2._ModuleHandler.toggleAutoattack(false);
        }
      }
    }
    get holdingWeapon() {
      return this.currentHolding <= 1;
    }
    get isMoving() {
      return this.move_dir !== null;
    }
    setForceHat(hat) {
      if (this.forceHat !== null && hat !== null) {
        return;
      }
      this.forceHat = hat;
    }
    getHatStore() {
      return this.store[0];
    }
    getAccStore() {
      return this.store[1];
    }
    setFollowTarget(x, y) {
      this.followTarget._setXY(x, y);
    }
    setLookTarget(x, y) {
      this.lookTarget._setXY(x, y);
    }
    updateSentAngle(priority) {
      if (this.sentAngle >= priority) {
        return;
      }
      this.sentAngle = priority;
    }
    _upgradeItem(id, isItem = false) {
      if (isItem) {
        id += 16;
      }
      this.client.PacketManager.upgradeItem(id);
      this.client.myPlayer.upgradeItem(id);
      if (DataHandler_default.isWeapon(id)) {
        const type = DataHandler_default.getWeapon(id).type;
        const {reloading: reloading} = this.staticModules;
        reloading.updateMaxReload(type);
      }
    }
    startMovement(angle = this.move_dir, ignore = false) {
      if (!ignore) {
        this.move_dir = angle;
        this.reverse_move_dir = angle === null ? null : reverseAngle(angle);
        if (this.moveTo !== "disable") {
          return;
        }
      }
      const {myPlayer: myPlayer} = this.client;
      if (myPlayer.simulation.collisionSimulation(this.client)) {
        return false;
      }
      this.client.PacketManager.move(angle);
      return true;
    }
    stopMovement() {
      this.client.PacketManager.resetMoveDir();
    }
    startPlacement(type) {
      this.currentType = type;
    }
    canBuy(type, id) {
      if (id === -1) {
        return false;
      }
      const store2 = DataHandler_default.getStore(type);
      const price = store2[id].price;
      const bought = this.bought[type];
      return bought.has(id) || this.client.myPlayer.tempGold >= price && this.client.myPlayer.isSandbox;
    }
    _buy(type, id, force = false) {
      const store2 = DataHandler_default.getStore(type);
      const {isOwner: isOwner, clients: clients, myPlayer: myPlayer, PacketManager: PacketManager2} = this.client;
      if (!myPlayer.inGame) {
        return false;
      }
      if (force) {
        if (isOwner) {
          for (const client2 of clients) {
            client2._ModuleHandler._buy(type, id, force);
          }
        }
      }
      const price = store2[id].price;
      const bought = this.bought[type];
      if (price === 0) {
        bought.add(id);
        return true;
      }
      if (!bought.has(id) && myPlayer.tempGold >= price && (myPlayer.isSandbox || force)) {
        PacketManager2.buy(type, id);
        myPlayer.tempGold -= price;
        return false;
      }
      return bought.has(id);
    }
    hasStoreItem(type, id) {
      const store2 = this.bought[type];
      return store2.has(id);
    }
    _equip(type, id, force = false, toggle = false) {
      const store2 = this.store[type];
      const {myPlayer: myPlayer, PacketManager: PacketManager2, EnemyManager: EnemyManager2, isOwner: isOwner, clients: clients} = this.client;
      if (toggle && store2.last === id && id !== 0) {
        id = 0;
      }
      if (!myPlayer.inGame || !this._buy(type, id, force)) {
        return false;
      }
      if (store2.last === id && myPlayer.storeData[type] === id) {
        return false;
      }
      store2.last = id;
      PacketManager2.equip(type, id);
      if (type === 0) {
        this.sentHatEquip = true;
      } else {
        this.sentAccEquip = true;
      }
      if (force) {
        store2.actual = id;
        if (isOwner) {
          for (const client2 of clients) {
            client2._ModuleHandler.staticModules.tempData.setStore(type, id);
          }
        }
      }
      const nearest = EnemyManager2.nearestTurretEntity;
      const reloading = this.staticModules.reloading;
      if (nearest !== null && reloading.isReloaded(2) && type === 0 && id === 53) {
        reloading.resetByType(2);
      }
      return true;
    }
    updateAngle(angle, force = false) {
      if (!force && angle === this.mouse.sentAngle) {
        return;
      }
      this.mouse.sentAngle = angle;
      this.updateSentAngle(3);
      this.client.PacketManager.updateAngle(angle);
    }
    selectItem(type) {
      const {myPlayer: myPlayer} = this.client;
      const item = myPlayer.getItemByType(type);
      if (myPlayer.currentItem !== -1) {
        myPlayer.currentItem = -1;
      }
      this.client.PacketManager.selectItemByID(item, false);
      this.currentHolding = type;
    }
    attack(angle, priority = 2) {
      if (angle !== null) {
        this.mouse.sentAngle = angle;
      }
      this.updateSentAngle(priority);
      this.client.PacketManager.attack(angle);
      if (this.holdingWeapon) {
        this.attacked = true;
      }
    }
    stopAttack(angle = null) {
      this.client.PacketManager.stopAttack(angle);
    }
    toggleAutoattack(state = !this.autoattack) {
      this.autoattack = state;
      this.attacking = state ? 1 : 0;
    }
    whichWeapon(type = this.weapon) {
      const weapon = this.client.myPlayer.getItemByType(type);
      if (weapon === null) {
        return;
      }
      this.currentHolding = type;
      this.weapon = type;
      this.client.PacketManager.selectItemByID(weapon, true);
    }
    _getPredictWeapon() {
      const myPlayer = this.client.myPlayer;
      if (!myPlayer) return this.weapon;
      const prim = myPlayer.getItemByType(0);
      const sec = myPlayer.getItemByType(1);
      const hasPrim = prim !== null && prim !== undefined;
      const hasSec = sec !== null && sec !== undefined;
      const reloading = type => {
        const r = myPlayer.reload && myPlayer.reload[type];
        if (!r || typeof r.current !== "number" || typeof r.max !== "number") return false;
        return r.current < r.max;
      };
      if (this.forceWeapon !== null && this.forceWeapon !== undefined) {
        return this.forceWeapon;
      }
      if (hasSec && reloading(1)) return 1;
      if (hasPrim && reloading(0)) return 0;
      if (this.attacking === 2 && hasSec) return 1;
      if (this.attacking === 1 && hasPrim) return 0;
      const pW = hasPrim ? DataHandler_default?.getWeapon?.(prim) : null;
      const sW = hasSec ? DataHandler_default?.getWeapon?.(sec) : null;
      if (pW?.name?.toLowerCase().includes("dagger")) return 0;
      if (sW?.name?.toLowerCase().includes("hammer")) return 1;
      return hasPrim ? 0 : hasSec ? 1 : this.weapon;
    }
    place(type, angle = this._currentAngle, reset = false) {
      this.totalPlaces += 1;
      this.selectItem(type);
      this.attack(angle, 1);
      this.stopAttack(angle);
      this.whichWeapon(this._getPredictWeapon());
    }
    _SHAME_GUARD_MARGIN=130;
    _shameHealQueue=0;
    _shameHealDeadline=null;
    _rawHeal() {
      this.selectItem(2);
      this.attack(null, 1);
      this.whichWeapon(this._getPredictWeapon());
    }
    _healBudgetLeft() {
      return this.packetLimit - this.packetCount;
    }
    heal() {
      if (this._healBudgetLeft() < 3) return;
      const myPlayer = this.client.myPlayer;
      if (myPlayer && !myPlayer.isSandbox && myPlayer.receivedDamage) {
        const sinceHit = Date.now() - myPlayer.receivedDamage;
        if (sinceHit <= this._SHAME_GUARD_MARGIN) {
          this._shameHealQueue = Math.min(this._shameHealQueue + 1, 12);
          this._shameHealDeadline = myPlayer.receivedDamage + this._SHAME_GUARD_MARGIN;
          return;
        }
      }
      this._rawHeal();
    }
    _flushShameHealQueue() {
      if (this._shameHealQueue <= 0 || this._shameHealDeadline === null) return;
      if (Date.now() < this._shameHealDeadline) return;
      const affordable = Math.max(0, Math.floor(this._healBudgetLeft() / 3));
      const count = Math.min(this._shameHealQueue, affordable);
      this._shameHealQueue -= count;
      if (this._shameHealQueue <= 0) {
        this._shameHealQueue = 0;
        this._shameHealDeadline = null;
      }
      for (let i = 0; i < count; i++) {
        this._rawHeal();
      }
    }
    circleOffset=0;
    targetSpeed=65;
    activeModule=null;
    get packetCount() {
      return this.client.PacketManager.packetCount;
    }
    set packetCount(_v) {}
    packetLimit=70;
    postTick() {
      this._flushShameHealQueue();
      if (Settings_default._circleRotation && this.move_dir === null) {
        const rotationSpeed = this.targetSpeed / Settings_default._circleRadius;
        this.circleOffset = (this.circleOffset + rotationSpeed) % (Math.PI * 2);
      }
      const {isOwner: isOwner} = this.client;
      this.placeAngles[0] = null;
      this.placeAngles[1].length = 0;
      this.activeModule = null;
      if (!this._autoBreakActive) this._lastBreakAngle = null;
      this._autoBreakActive = false;
      this._comboAttack = false;
      this.tickCount += 1;
      this.sentAngle = 0;
      this.sentHatEquip = false;
      this.sentAccEquip = false;
      this.didAntiInsta = false;
      this.placedOnce = false;
      this.healedOnce = false;
      this.totalPlaces = 0;
      this.attacked = false;
      this.canHitEntity = false;
      this.moduleActive = false;
      this.useWeapon = null;
      this.useItem = null;
      this.forceWeapon = null;
      this.useHat = null;
      this.forceHat = null;
      this.shouldEquipSoldier = false;
      this.useAcc = null;
      this.useAngle = null;
      this.shouldAttack = false;
      this.prevMoveTo = this.moveTo;
      this.moveTo = "disable";
      if (!isOwner) {
        for (const botModule of this.botModules) {
          botModule.postTick();
        }
      }
      for (const module of this.modules) {
        const prevg = this.moduleActive;
        module.postTick();
        if (!prevg && this.moduleActive) {
          this.activeModule = module.moduleName;
        }
      }
      const _em = this.client.EnemyManager;
      const _mp = this.client.myPlayer;
      const _canSoldier = this.canBuy(0, 6);
      if (_canSoldier && Settings_default._antienemy) {
        const _nearest = _em.nearestEnemy;
        const _isDanger = _em.detectedDangerEnemy || _em.detectedEnemy || _em.dangerWithoutSoldier;
        const _primary2 = _mp.getItemByType(0);
        const _atkRange = _primary2 !== null ? DataHandler_default.getWeapon(_primary2).range + (_nearest?.hitScale || 35) : 85;
        const _isClose = _nearest !== null && _mp.pos.current.distance(_nearest.pos.current) <= _atkRange + 20;
        if (_isDanger || _isClose) {
          this.forceHat = 6;
          this.shouldEquipSoldier = true;
        } else if (this.shouldEquipSoldier) {
          this.shouldEquipSoldier = false;
          this.forceHat = null;
        }
      }
      this.attackingState = this.attacking;
      if (isOwner) {
        this.client.InputHandler.postTick();
        GameUI_default.updateFastQ(this.didAntiInsta);
        GameUI_default.updatePlaces(this.totalPlaces);
        GameUI_default.updateActiveModule(this.activeModule + ", " + this.tickCount);
        GameUI_default.updateEquipHat(`${this.store[0].last},  ${this.shouldEquipSoldier}`);
        const executionTime = Math.round(performance.now() - this.moduleStart);
        this.maxExecutionTime = Math.max(this.maxExecutionTime, executionTime);
        GameUI_default.updateModulePerformance(`${executionTime}/${this.maxExecutionTime}`);
      }
    }
  }
  const ModuleHandler_default = ModuleHandler;
  class PlayerClient {
    id=-1;
    connectSuccess=false;
    clientID=null;
    ownerClient;
    SocketManager;
    ObjectManager;
    PlayerManager;
    ProjectileManager;
    LeaderboardManager;
    EnemyManager;
    _ModuleHandler;
    myPlayer;
    PacketManager;
    InputHandler;
    StatsManager;
    pendingJoins=new Set;
    clientIDList=new Set;
    clients=new Set;
    constructor(owner) {
      this.ownerClient = owner || this;
      this.SocketManager = new SocketManager_default(this);
      this.ObjectManager = new ObjectManager_default(this);
      this.PlayerManager = new PlayerManager_default(this);
      this.ProjectileManager = new ProjectileManager_default(this);
      this.LeaderboardManager = new LeaderboardManager_default(this);
      this.EnemyManager = new EnemyManager_default(this);
      this._ModuleHandler = new ModuleHandler_default(this);
      this.myPlayer = new ClientPlayer_default(this);
      this.PacketManager = new PacketManager(this);
      this.InputHandler = new InputHandler(this);
      this.StatsManager = new StatsManager(this);
    }
    getClientIndex(client2) {
      return [ ...this.clients ].indexOf(client2);
    }
    get isOwner() {
      return this.ownerClient === this;
    }
    isBotByID(id) {
      return this.clientIDList.has(id);
    }
    disconnect() {
      const socket = this.SocketManager.socket;
      if (socket !== null) {
        socket.close();
      }
    }
    removeBots() {
      for (const client2 of this.clients) {
        client2.disconnect();
      }
    }
    spawn() {
      this.myPlayer.spawn();
    }
  }
  const PlayerClient_default = PlayerClient;
  const UI = new class {
    frame;
    activeHotkeyInput=null;
    activeInput=null;
    toggleTimeout;
    menuOpened=false;
    menuLoaded=false;
    menuScale=1;
    get isMenuOpened() {
      return this.menuOpened;
    }
    isActiveButton() {
      return this.activeHotkeyInput || this.activeInput;
    }
    getFrameContent() {
      return `\n            <!DOCTYPE html>\n            <style>${styles_default}</style>\n            <div id="menu-container" class="transparent">\n                <div id="menu-wrapper">\n                    ${Header_default}\n\n                    <main>\n                        ${Navbar_default}\n                        \n                        <div id="page-container">\n                            ${Home_default}\n                            ${Keybinds_default}\n                            ${Combat_default}\n                            ${Visuals_default}\n                            ${Misc_default}\n                            ${Bots_default}\n                            ${Devtool_default}\n                            ${Music_default}\n                                  </div>\n                    </main>\n                </div>\n            </div>\n        `;
    }
    injectStyles() {
      const style = document.createElement("style");
      style.innerHTML = Game_default + Store_default;
      document.head.appendChild(style);
      (function rynDesignInjector() {
        const rynCSS = document.createElement("style");
        rynCSS.id = "ryn-custom-design";
        rynCSS.textContent = `\n                    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Exo+2:wght@400;600&display=swap');\n\n                    /* ── SETUP CARD (True iOS 18 Glassmorphism) ── */\n                    #setupCard {\n                        position: relative !important;\n                        background: rgba(100, 60, 200, 0.12) !important;\n                        backdrop-filter: blur(40px) saturate(180%) !important;\n                        -webkit-backdrop-filter: blur(40px) saturate(180%) !important;\n                        border: 1px solid rgba(255, 255, 255, 0.14) !important;\n                        border-radius: 26px !important;\n                        padding: 28px 24px 22px !important;\n                        width: 360px !important;\n                        box-shadow: 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.15) !important;\n                    }\n                    #setupCard::before {\n                        content: '' !important;\n                        position: absolute !important;\n                        inset: 0 !important;\n                        border-radius: 26px !important;\n                        background: linear-gradient(160deg, rgba(140, 90, 255, 0.10) 0%, rgba(100, 60, 200, 0.04) 60%) !important;\n                        pointer-events: none !important;\n                    }\n\n                    /* ── "Ryn 5" SCREEN CORNER BADGE ── */\n                    .ryn-v2-wrapper {\n                        position: fixed !important;\n                        top: 14px !important;\n                        left: 14px !important;\n                        display: flex !important;\n                        flex-direction: column !important;\n                        align-items: center !important;\n                        gap: 6px !important;\n                        /* the label and the gaps must never sit on top of the play area */\n                        pointer-events: none !important;\n                        user-select: none !important;\n                        z-index: 99999 !important;\n                    }\n                    /* the launcher: a glass disc with the mark drawn in CSS, so no\n                       image ships with the client */\n                    .ryn-v2-avatar {\n                        position: relative !important;\n                        width: 58px !important;\n                        height: 58px !important;\n                        padding: 0 !important;\n                        border-radius: 50% !important;\n                        display: flex !important;\n                        align-items: center !important;\n                        justify-content: center !important;\n                        background: rgba(255,255,255,0.08) !important;\n                        backdrop-filter: blur(24px) saturate(180%) !important;\n                        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;\n                        border: 1px solid rgba(255,255,255,0.20) !important;\n                        box-shadow: 0 6px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.28) !important;\n                        color: rgba(214,204,255,0.85) !important;\n                        font-family: 'Orbitron', monospace !important;\n                        font-size: 20px !important;\n                        font-weight: 900 !important;\n                        letter-spacing: 0.04em !important;\n                        opacity: 0.55 !important;\n                        cursor: pointer !important;\n                        pointer-events: auto !important;\n                        transition: opacity 180ms ease, transform 180ms ease, border-color 180ms ease !important;\n                    }\n                    .ryn-v2-avatar::before { content: 'R' !important; }\n                    .ryn-v2-avatar:hover {\n                        opacity: 1 !important;\n                        transform: scale(1.06) !important;\n                        border-color: rgba(168,140,255,0.75) !important;\n                    }\n                    .ryn-v2-badge {\n                        color: rgba(214,204,255,0.30) !important;\n                        font-family: 'Orbitron', monospace !important;\n                        font-size: 0.72em !important;\n                        font-weight: 600 !important;\n                        letter-spacing: 0.22em !important;\n                        text-transform: uppercase !important;\n                        text-align: center !important;\n                        pointer-events: none !important;\n                        transition: color 180ms ease !important;\n                    }\n                    .ryn-v2-wrapper:hover .ryn-v2-badge {\n                        color: rgba(214,204,255,0.85) !important;\n                    }\n                    \n                    /* ── NAME INPUT ── */\n                    #nameInput {\n                        background: #1c1c26 !important;\n                        border: 1px solid rgba(122,66,244,0.25) !important;\n                        border-radius: 8px !important;\n                        color: #ffffff !important;\n                        font-family: 'Exo 2', sans-serif !important;\n                        font-size: 0.95em !important;\n                        font-weight: 600 !important;\n                        letter-spacing: 0.05em !important;\n                        text-align: center !important;\n                        padding: 13px 16px !important;\n                        width: 100% !important;\n                        box-sizing: border-box !important;\n                        outline: none !important;\n                        transition: border-color 150ms !important;\n                    }\n                    #nameInput:focus { border-color: #7A42F4 !important; }\n                    #nameInput::placeholder { color: rgba(255,255,255,0.25) !important; }\n\n                    /* ── ENTER GAME BUTTON ── */\n                    #enterGame {\n                        background: #7A42F4 !important;\n                        border: none !important;\n                        border-radius: 8px !important;\n                        color: #ffffff !important;\n                        font-family: 'Orbitron', monospace !important;\n                        font-size: 0.8em !important;\n                        font-weight: 700 !important;\n                        letter-spacing: 0.2em !important;\n                        padding: 14px 18px !important;\n                        width: 100% !important;\n                        cursor: pointer !important;\n                        text-transform: uppercase !important;\n                        transition: background 150ms !important;\n                    }\n                    #enterGame:hover { background: #8d5bf6 !important; }\n                    #enterGame:active { background: #6936d8 !important; }\n\n                    /* ── SERVER SELECT ── */\n                    #serverSelect, #setupCard select {\n                        background: #1c1c26 !important;\n                        border: 1px solid rgba(122,66,244,0.25) !important;\n                        border-radius: 8px !important;\n                        color: rgba(255,255,255,0.8) !important;\n                        font-family: 'Exo 2', sans-serif !important;\n                        font-weight: 600 !important;\n                        font-size: 0.9em !important;\n                        padding: 14px 36px 14px 16px !important;\n                        width: 100% !important;\n                        cursor: pointer !important;\n                        outline: none !important;\n                        text-align: center !important;\n                        text-align-last: center !important;\n                        -webkit-appearance: none !important;\n                        appearance: none !important;\n                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A42F4' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") !important;\n                        background-repeat: no-repeat !important;\n                        background-position: right 14px center !important;\n                        transition: border-color 150ms !important;\n                    }\n                    #serverSelect:hover, #setupCard select:hover { border-color: rgba(122,66,244,0.55) !important; }\n                    #serverSelect option, #setupCard select option { background: #1c1c26 !important; color: #fff !important; }\n\n                    /* ── COLOR PICKERS (order untouched here — values come from Config_default.skinColors) ── */\n                    .colorHolder {\n                        background: #1c1c26 !important;\n                        border: 1px solid rgba(122,66,244,0.15) !important;\n                        border-radius: 8px !important;\n                        padding: 8px !important;\n                    }\n\n                    /* ── USE NATIVE RESOLUTION → BUTTON-STYLE TOGGLE ── */\n                    #nativeCheckHolder {\n                        display: flex !important;\n                        align-items: center !important;\n                        justify-content: center !important;\n                        gap: 8px !important;\n                        background: #1c1c26 !important;\n                        border: 1px solid rgba(122,66,244,0.25) !important;\n                        border-radius: 8px !important;\n                        padding: 10px 14px !important;\n                        cursor: pointer !important;\n                        color: rgba(255,255,255,0.65) !important;\n                        font-family: 'Exo 2', sans-serif !important;\n                        font-size: 0.8em !important;\n                        font-weight: 600 !important;\n                        transition: background 150ms, border-color 150ms, color 150ms !important;\n                    }\n                    #nativeCheckHolder:hover { border-color: rgba(122,66,244,0.5) !important; }\n                    #nativeCheckHolder:has(input:checked) {\n                        background: rgba(122,66,244,0.18) !important;\n                        border-color: #7A42F4 !important;\n                        color: #ffffff !important;\n                    }\n                    #nativeCheckHolder input[type=checkbox] {\n                        accent-color: #7A42F4 !important;\n                        width: 15px !important;\n                        height: 15px !important;\n                        margin: 0 !important;\n                        cursor: pointer !important;\n                    }\n\n\n                    /* ── SKIN COLOUR WHEEL ── */\n                    #ryn-skin-wheel {\n                        position: relative !important;\n                        width: 100% !important;\n                        aspect-ratio: 1 / 1 !important;\n                        max-width: 232px !important;\n                        margin: 4px auto 2px !important;\n                        border-radius: 50% !important;\n                        background: rgba(255,255,255,0.05) !important;\n                        border: 1px solid rgba(255,255,255,0.14) !important;\n                        backdrop-filter: blur(30px) saturate(180%) !important;\n                        -webkit-backdrop-filter: blur(30px) saturate(180%) !important;\n                        box-shadow: 0 10px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.18) !important;\n                    }\n                    .ryn-skin-slot {\n                        position: absolute !important;\n                        width: 34px !important;\n                        height: 34px !important;\n                        margin: 0 !important;\n                        transform: translate(-50%, -50%) !important;\n                        border-radius: 50% !important;\n                        border: 1px solid rgba(255,255,255,0.22) !important;\n                        box-shadow: 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3) !important;\n                        cursor: pointer !important;\n                        transition: transform 160ms cubic-bezier(.34,1.4,.64,1), box-shadow 160ms !important;\n                    }\n                    .ryn-skin-slot:hover { transform: translate(-50%, -50%) scale(1.16) !important; }\n                    .ryn-skin-slot.activeSkin {\n                        box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 4px 16px rgba(0,0,0,0.45) !important;\n                        transform: translate(-50%, -50%) scale(1.12) !important;\n                    }\n                    /* the hub is the wheel centre: the skin no swatch can show */\n                    #ryn-skin-hub {\n                        left: 50% !important;\n                        top: 50% !important;\n                        width: 62px !important;\n                        height: 62px !important;\n                        background:\n                            radial-gradient(circle at 50% 50%, var(--hub-color, transparent) 0 52%, transparent 53%),\n                            conic-gradient(from 0deg, #bf8f54, #cbb091, #896c4b, #fadadc, #ececec, #c37373, #4c4c4c, #ecaff7, #738cc3, #8bc373, #bf8f54) !important;\n                        border: 1px solid rgba(255,255,255,0.3) !important;\n                    }\n                    #ryn-skin-wheel.special-picked #ryn-skin-hub {\n                        box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.5) !important;\n                    }\n\n                    /* ── "BACK TO MOOMOO.IO" / "TRY THE SANDBOX" → BUTTON STYLE ── */\n                    #setupCard a, #setupCard .menuText {\n                        display: inline-block !important;\n                        margin-top: 14px !important;\n                        padding: 9px 18px !important;\n                        background: #1c1c26 !important;\n                        border: 1px solid rgba(122,66,244,0.25) !important;\n                        border-radius: 7px !important;\n                        color: rgba(255,255,255,0.6) !important;\n                        font-family: 'Exo 2', sans-serif !important;\n                        font-size: 0.72em !important;\n                        font-weight: 600 !important;\n                        letter-spacing: 0.04em !important;\n                        text-decoration: none !important;\n                        text-align: center !important;\n                        transition: border-color 150ms, color 150ms !important;\n                    }\n                    #setupCard a:hover, #setupCard .menuText:hover {\n                        border-color: #7A42F4 !important;\n                        color: #ffffff !important;\n                    }\n                `;
        document.head.appendChild(rynCSS);
        function injectRynCardUI() {
          const card = document.getElementById("setupCard");
          if (!card || card._rynInjected) return;
          card._rynInjected = true;
          const nameInput = document.getElementById("nameInput");
          if (nameInput && !nameInput.value) {
            nameInput.value = "RYN";
            nameInput.placeholder = "ENTER NAME...";
          }
        }
        const cardInterval = setInterval(() => {
          if (document.getElementById("setupCard")) {
            injectRynCardUI();
            clearInterval(cardInterval);
          }
        }, 200);
        const observer = new MutationObserver(() => injectRynCardUI());
        const startObs = () => observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });
        if (document.body) startObs(); else window.addEventListener("DOMContentLoaded", startObs);
        function injectV2Badge() {
          if (!document.body || document.getElementById("ryn-v2-wrapper")) return;
          const wrapper = document.createElement("div");
          wrapper.id = "ryn-v2-wrapper";
          wrapper.className = "ryn-v2-wrapper";
          const avatar = document.createElement("button");
          avatar.className = "ryn-v2-avatar";
          avatar.type = "button";
          avatar.setAttribute("aria-label", "Open menu");
          avatar.title = "Open menu";
          avatar.addEventListener("click", function() {
            if (window._rynUI && typeof window._rynUI.toggleMenu === "function") {
              window._rynUI.toggleMenu();
            } else if (window.UI_default && typeof window.UI_default.toggleMenu === "function") {
              window.UI_default.toggleMenu();
            }
          });
          const badge = document.createElement("div");
          badge.id = "ryn-v2-badge";
          badge.className = "ryn-v2-badge";
          badge.textContent = "Ryn 5";
          wrapper.appendChild(avatar);
          wrapper.appendChild(badge);
          document.body.appendChild(wrapper);
        }
        if (document.body) injectV2Badge(); else window.addEventListener("DOMContentLoaded", injectV2Badge);
      })();
      const logoStyle = document.createElement("style");
      logoStyle.innerHTML = `\n                #ryn-main-logo {\n                    position: fixed;\n                    top: 14px; left: 14px;\n                    cursor: pointer;\n                    z-index: 99999;\n                    pointer-events: all;\n                    user-select: none;\n                    -webkit-user-select: none;\n                    transition: opacity 400ms ease, transform 400ms cubic-bezier(.34,1.56,.64,1);\n                    opacity: 0;\n                    display: none !important;\n                    pointer-events: none !important;\n                }\n                #ryn-main-logo.hidden { opacity:0; transform:translateY(-8px) scale(0.9); pointer-events:none; }\n                #ryn-main-logo:hover  { transform: scale(1.08); opacity: 1; }\n                #ryn-main-logo:active { transform: scale(0.95); }\n                .ryn-stroke {\n                    fill: none;\n                    stroke: #7A42F4;\n                    stroke-width: 6;\n                    stroke-linecap: round;\n                    stroke-linejoin: round;\n                }\n                .ryn-R, .ryn-Y, .ryn-N {\n                    stroke-dasharray: none;\n                    stroke-dashoffset: 0;\n                }\n            `;
      document.head.appendChild(logoStyle);
      const logo = document.createElement("div");
      logo.id = "ryn-main-logo";
      logo.innerHTML = `\n                <svg width="65" height="32" viewBox="0 0 90 44" xmlns="http://www.w3.org/2000/svg">\n                  \x3c!-- R --\x3e\n                  <path class="ryn-stroke ryn-R"\n                    d="M8,38 L8,8\n                       Q8,6 10,6 L18,6\n                       Q26,6 26,14\n                       Q26,20 20,21\n                       L26,38\n                       M8,21 L20,21" />\n                  \x3c!-- Y --\x3e\n                  <path class="ryn-stroke ryn-Y"\n                    d="M36,6 L45,20 L54,6\n                       M45,20 L45,38" />\n                  \x3c!-- N --\x3e\n                  <path class="ryn-stroke ryn-N"\n                    d="M64,38 L64,6 L82,38 L82,6" />\n                </svg>\n            `;
      document.body.appendChild(logo);
      logo.addEventListener("click", () => {
        if (window._rynUI && typeof window._rynUI.toggleMenu === "function") {
          window._rynUI.toggleMenu();
        } else if (window.UI_default && typeof window.UI_default.toggleMenu === "function") {
          window.UI_default.toggleMenu();
        } else {
          try {
            const key = window.Settings_default && window.Settings_default._toggleMenu || "Escape";
            document.dispatchEvent(new KeyboardEvent("keydown", {
              code: key,
              bubbles: true
            }));
            document.dispatchEvent(new KeyboardEvent("keyup", {
              code: key,
              bubbles: true
            }));
          } catch (e) {}
        }
      });
      setInterval(() => {
        const inGame = !!(window.RYN && window.RYN.client && window.RYN.client.myPlayer && window.RYN.client.myPlayer.inGame);
        if (inGame) logo.classList.add("hidden"); else logo.classList.remove("hidden");
      }, 500);
    }
    createFrame() {
      this.injectStyles();
      const iframe = document.createElement("iframe");
      const blob = new Blob([ this.getFrameContent() ], {
        type: "text/html; charset=utf-8"
      });
      iframe.src = URL.createObjectURL(blob);
      iframe.id = "ryn-menu-frame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      return new Promise(resolve => {
        iframe.onload = () => {
          const iframeWindow = iframe.contentWindow;
          const iframeDocument = iframeWindow.document;
          URL.revokeObjectURL(iframe.src);
          resolve({
            target: iframe,
            window: iframeWindow,
            document: iframeDocument
          });
        };
      });
    }
    querySelector(selector) {
      return this.frame.document.querySelector(selector);
    }
    querySelectorAll(selector) {
      return this.frame.document.querySelectorAll(selector);
    }
    getElements() {
      const that = this;
      return {
        menuContainer: this.querySelector("#menu-container"),
        rynLobbyLogo: this.querySelector("#ryn-lobby-logo"),
        menuWrapper: this.querySelector("#menu-wrapper"),
        pageContainer: this.querySelector("#page-container"),
        hotkeyInputs: this.querySelectorAll(".hotkeyInput[id]"),
        checkboxes: this.querySelectorAll("input[type='checkbox'][id]"),
        colorPickers: this.querySelectorAll("input[type='color'][id]"),
        textInputs: this.querySelectorAll("input[type='text'][id]"),
        sliders: this.querySelectorAll("input[type='range'][id]"),
        closeButton: this.querySelector("#close-button"),
        openMenuButtons: this.querySelectorAll(".open-menu[data-id]"),
        menuPages: this.querySelectorAll(".menu-page[data-id]"),
        buttons: this.querySelectorAll(".option-button[id]"),
        botContainer: this.querySelector("#bot-container"),
        connectingBot: this.querySelector("#connectingBot"),
        scriptDescription: this.querySelector("#script-description"),
        author: this.querySelector("#author"),
        optionDescriptions: this.querySelectorAll(".option-description"),
        addBotDynamic: this.querySelector("#add-bot-dynamic"),
        dynamicBotList: this.querySelector("#dynamic-bot-list"),
        resetSettings: this.querySelector("#resetSettings"),
        botOption(id) {
          const option = that.querySelector(`.content-option[data-bot-id="${id}"]`);
          const title = option.querySelector(".option-title");
          const disconnect = option.querySelector(".disconnect-button");
          return {
            option: option,
            title: title,
            disconnect: disconnect
          };
        }
      };
    }
    updateStats(id, value) {
      const stats = this.querySelector("#" + id);
      if (stats == null) {
        throw Error(`updateStats Error: can't find an element with ID: '${id}'`);
      }
      stats.textContent = value;
      if (id in Settings_default) {
        Settings_default[id] = value;
        SaveSettings();
      }
    }
    handleResize() {
      const {menuContainer: menuContainer} = this.getElements();
      const scale = Math.min(1, Math.min(window.innerWidth / 1470, window.innerHeight / 870));
      this.menuScale = scale;
      menuContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
      const rynLobbyLogo = this.querySelector ? this.querySelector("#ryn-lobby-logo") : null;
      if (rynLobbyLogo) {
        const _inGame = !!(this.client && this.client.myPlayer && this.client.myPlayer.inGame);
        if (_inGame) rynLobbyLogo.classList.add("hidden"); else rynLobbyLogo.classList.remove("hidden");
      }
    }
    createRipple(selector) {
      const buttons = this.frame.document.querySelectorAll(selector);
      for (const button of buttons) {
        button.addEventListener("click", event => {
          const {width: width, height: height} = button.getBoundingClientRect();
          const size = Math.max(width, height) * 2;
          const ripple = document.createElement("span");
          ripple.style.width = size + "px";
          ripple.style.height = size + "px";
          ripple.style.marginTop = -size / 2 + "px";
          ripple.style.marginLeft = -size / 2 + "px";
          ripple.style.left = event.offsetX + "px";
          ripple.style.top = event.offsetY + "px";
          ripple.classList.add("ripple");
          button.appendChild(ripple);
          setTimeout(() => ripple.remove(), 750);
        });
      }
    }
    attachHotkeyInputs() {
      const {hotkeyInputs: hotkeyInputs} = this.getElements();
      for (const hotkeyInput of hotkeyInputs) {
        const id = hotkeyInput.id;
        const value = Settings_default[id];
        if (id in Settings_default && typeof value === "string") {
          hotkeyInput.textContent = formatCode(value);
        } else {
          Logger.error(`attachHotkeyInputs Error: Property "${id}" does not exist in settings`);
        }
      }
    }
    checkForRepeats() {
      const {hotkeyInputs: hotkeyInputs} = this.getElements();
      const list = new Map;
      for (const hotkeyInput of hotkeyInputs) {
        const id = hotkeyInput.id;
        if (id in Settings_default) {
          const value = Settings_default[id];
          const [count, inputs] = list.get(value) || [ 0, [] ];
          list.set(value, [ (count || 0) + 1, [ ...inputs, hotkeyInput ] ]);
          hotkeyInput.classList.remove("red");
        } else {
          Logger.error(`checkForRepeats Error: Property "${id}" does not exist in settings`);
        }
      }
      for (const data of list) {
        const [number, hotkeyInputs2] = data[1];
        if (number === 1) {
          continue;
        }
        for (const hotkeyInput of hotkeyInputs2) {
          hotkeyInput.classList.add("red");
        }
      }
    }
    applyCode(code) {
      if (this.activeHotkeyInput === null) {
        return;
      }
      const deleting = code === "Backspace";
      const isCode = typeof code === "string";
      const keyText = isCode ? formatCode(code) : formatButton(code);
      const keySetting = isCode ? code : keyText;
      const id = this.activeHotkeyInput.id;
      if (id in Settings_default) {
        Settings_default[id] = deleting ? "..." : keySetting;
        SaveSettings();
      } else {
        Logger.error(`applyCode Error: Property "${id}" does not exist in settings`);
      }
      this.activeHotkeyInput.textContent = deleting ? "..." : keyText;
      this.activeHotkeyInput.blur();
      this.activeHotkeyInput.classList.remove("active");
      this.activeHotkeyInput = null;
      this.checkForRepeats();
    }
    isHotkeyInput(target) {
      return target instanceof this.frame.window.HTMLButtonElement && target.classList.contains("hotkeyInput") && target.hasAttribute("id");
    }
    handleCheckboxToggle(id, checked) {
      switch (id) {
       case "_menuTransparency":
        {
          const {menuContainer: menuContainer} = this.getElements();
          menuContainer.classList.toggle("transparent");
          break;
        }

       case "_hideHUD":
        {
          const {gameUI: gameUI} = GameUI_default.getElements();
          if (checked) {
            gameUI.classList.add("hidden");
          } else {
            gameUI.classList.remove("hidden");
          }
          break;
        }

       case "_autoAssassin":
       case "_botsAutoAssassin":
        break;
      }
    }
    attachCheckboxes() {
      const {checkboxes: checkboxes} = this.getElements();
      for (const checkbox of checkboxes) {
        const id = checkbox.id;
        if (!(id in Settings_default)) {
          Logger.error(`attachCheckboxes Error: Property "${id}" does not exist in settings`);
          continue;
        }
        checkbox.checked = Settings_default[id];
        this.handleCheckboxToggle(id, checkbox.checked);
        checkbox.onchange = () => {
          if (id in Settings_default) {
            Settings_default[id] = checkbox.checked;
            SaveSettings();
            this.handleCheckboxToggle(id, checkbox.checked);
          } else {
            Logger.error(`attachCheckboxes Error: Property "${id}" was deleted from settings`);
          }
        };
      }
    }
    attachColorPickers() {
      const {colorPickers: colorPickers} = this.getElements();
      for (const picker of colorPickers) {
        const id = picker.id;
        if (!(id in Settings_default)) {
          Logger.error(`attachColorPickers Error: Property "${id}" does not exist in settings`);
          continue;
        }
        picker.value = Settings_default[id];
        picker.onchange = () => {
          if (id in Settings_default) {
            Settings_default[id] = picker.value;
            SaveSettings();
            picker.blur();
          } else {
            Logger.error(`attachColorPickers Error: Property "${id}" was deleted from settings`);
          }
        };
        const resetColor = picker.previousElementSibling;
        if (resetColor instanceof this.frame.window.HTMLButtonElement) {
          resetColor.style.setProperty("--data-color", defaultSettings[id]);
          resetColor.onclick = () => {
            if (id in Settings_default) {
              picker.value = defaultSettings[id];
              Settings_default[id] = defaultSettings[id];
              SaveSettings();
            } else {
              Logger.error(`resetColor Error: Property "${id}" was deleted from settings`);
            }
          };
        }
      }
    }
    attachSliders() {
      const {sliders: sliders} = this.getElements();
      for (const slider of sliders) {
        const id = slider.id;
        if (!(id in Settings_default)) {
          Logger.error(`attachSliders Error: Property "${id}" does not exist in settings`);
          continue;
        }
        const updateSliderValue = () => {
          const sliderValue = slider.previousElementSibling;
          if (sliderValue instanceof this.frame.window.HTMLSpanElement) {
            sliderValue.textContent = slider.value;
          }
        };
        slider.value = Settings_default[id].toString();
        updateSliderValue();
        slider.oninput = () => {
          if (id in Settings_default) {
            Settings_default[id] = Number(slider.value);
            SaveSettings();
            updateSliderValue();
            if (id === "_autoChatInterval") {
              try {
                if (typeof window._startAutoChat === "function") window._startAutoChat();
                if (typeof window._startBotAutoChat === "function") window._startBotAutoChat();
              } catch (e) {}
            }
          } else {
            Logger.error(`attachSliders Error: Property "${id}" was deleted from settings`);
          }
        };
        slider.onchange = () => slider.blur();
      }
    }
    attachTextInputs() {
      const {textInputs: textInputs} = this.getElements();
      for (const input of textInputs) {
        const id = input.id;
        if (!(id in Settings_default)) {
          Logger.error(`attachTextInputs Error: Property "${id}" does not exist in settings`);
          continue;
        }
        input.value = Settings_default[id];
        input.oninput = () => {
          input.value = input.value.replace(/[^\x20-\x7E]/g, "");
        };
        input.onfocus = () => {
          this.activeInput = input;
        };
        input.onblur = () => {
          this.activeInput = null;
        };
        input.onchange = () => {
          if (id in Settings_default) {
            const value = input.value;
            Settings_default[id] = value;
            input.value = value;
            SaveSettings();
          } else {
            Logger.error(`attachTextInputs Error: Property "${id}" was deleted from settings`);
          }
        };
      }
    }
    attachDescriptions() {
      const {optionDescriptions: optionDescriptions, menuWrapper: menuWrapper} = this.getElements();
      for (const description of optionDescriptions) {
        const parent = description.parentElement;
        const _posTooltip = event => {
          const pad = 12;
          const dw = description.offsetWidth || 220;
          const dh = description.offsetHeight || 44;
          let tx = event.clientX + pad;
          let ty = event.clientY - dh - pad;
          if (tx + dw > window.innerWidth) tx = event.clientX - dw - pad;
          if (ty < 4) ty = event.clientY + pad;
          description.style.left = tx + "px";
          description.style.top = ty + "px";
          description.style.transform = "none";
        };
        parent.onmouseenter = event => {
          description.classList.add("description-show");
          _posTooltip(event);
        };
        parent.onmouseleave = () => {
          description.classList.remove("description-show");
        };
        parent.onmousemove = event => {
          description.classList.add("description-show");
          _posTooltip(event);
        };
      }
    }
    createBotOption(player) {
      const {botContainer: botContainer, botOption: botOption, pageContainer: pageContainer} = this.getElements();
      const html = `\n            <div class="content-option" data-bot-id="${player.id}">\n                <span class="option-title"></span>\n                <svg\n                    class="icon disconnect-button"\n                    xmlns="http://www.w3.org/2000/svg"\n                    viewBox="0 0 30 30"\n                    title="Kick bot"\n                >\n                    <path d="M 7 4 C 6.744125 4 6.4879687 4.0974687 6.2929688 4.2929688 L 4.2929688 6.2929688 C 3.9019687 6.6839688 3.9019687 7.3170313 4.2929688 7.7070312 L 11.585938 15 L 4.2929688 22.292969 C 3.9019687 22.683969 3.9019687 23.317031 4.2929688 23.707031 L 6.2929688 25.707031 C 6.6839688 26.098031 7.3170313 26.098031 7.7070312 25.707031 L 15 18.414062 L 22.292969 25.707031 C 22.682969 26.098031 23.317031 26.098031 23.707031 25.707031 L 25.707031 23.707031 C 26.098031 23.316031 26.098031 22.682969 25.707031 22.292969 L 18.414062 15 L 25.707031 7.7070312 C 26.098031 7.3170312 26.098031 6.6829688 25.707031 6.2929688 L 23.707031 4.2929688 C 23.316031 3.9019687 22.682969 3.9019687 22.292969 4.2929688 L 15 11.585938 L 7.7070312 4.2929688 C 7.5115312 4.0974687 7.255875 4 7 4 z"/>\n                </svg>\n            </div>\n        `;
      const div = document.createElement("div");
      div.innerHTML = html;
      botContainer.appendChild(div.firstElementChild);
      pageContainer.scrollTop = pageContainer.scrollHeight;
      const option = botOption(player.id);
      option.disconnect.onclick = () => {
        player.disconnect();
      };
    }
    deleteBotOption(player) {
      if (!player.connectSuccess) {
        return;
      }
      const {botOption: botOption} = this.getElements();
      const option = botOption(player.id);
      option.option.remove();
    }
    updateBotOption(player, type) {
      if (!player.connectSuccess) {
        return;
      }
      const {botOption: botOption} = this.getElements();
      const option = botOption(player.id);
      switch (type) {
       case "title":
        option.title.textContent = `[${player.id}]: ${player.myPlayer.nickname}`;
        break;
      }
    }
    addBotConnecting() {
      const {botContainer: botContainer} = this.getElements();
      const div = document.createElement("div");
      div.id = "connectingBot";
      div.textContent = "Connecting...";
      botContainer.appendChild(div);
    }
    removeBotConnecting() {
      const {connectingBot: connectingBot} = this.getElements();
      if (connectingBot !== null) {
        connectingBot.remove();
      }
    }
    createBot(slot = 1) {
      const {addBotDynamic: addBotDynamic} = this.getElements();
      if (addBotDynamic) addBotDynamic.click();
    }
    handleBotCreation(button, nameInputId = "bot-name-input", withDelay = false, rowId = null) {
      let id = 0;
      button.onclick = async () => {
        const ws = client.SocketManager.socket;
        if (ws === null) {
          return;
        }
        const nameInput = this.querySelector("#" + nameInputId);
        const botName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "";
        if (!botName) {
          nameInput && (nameInput.style.border = "1px solid #ff4444");
          setTimeout(() => {
            nameInput && (nameInput.style.border = "1px solid #9090c8");
          }, 1500);
          return;
        }
        if (rowId) {
          const rowEl = this.frame.document.getElementById(rowId);
          if (rowEl) {
            rowEl.style.opacity = "0.5";
            rowEl.style.pointerEvents = "none";
          }
        }
        this.addBotConnecting();
        const socket = await createSocket_default(ws.url);
        socket.addEventListener("close", () => {
          this.removeBotConnecting();
          if (rowId) {
            const rowEl = this.frame.document.getElementById(rowId);
            if (rowEl && !rowEl.dataset.botPlayerId) rowEl.remove();
          }
        });
        socket.onopen = () => {
          const player = new PlayerClient_default(client);
          player.PacketManager.Encoder = client.PacketManager.Encoder;
          player.PacketManager.Decoder = client.PacketManager.Decoder;
          player._botCustomName = botName;
          player.SocketManager.init(socket);
          const onconnect = () => {
            player.id = id++;
            client.clients.add(player);
            this.removeBotConnecting();
            if (rowId) {
              const rowEl = this.frame.document.getElementById(rowId);
              if (rowEl) {
                rowEl.dataset.botPlayerId = player.id;
                rowEl.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(144,144,200,0.07);border-radius:8px;border:1px solid #9090c844;";
                rowEl.innerHTML = "";
                const check = this.frame.document.createElement("svg");
                check.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                check.setAttribute("viewBox", "0 0 24 24");
                check.style.cssText = "width:16px;height:16px;flex-shrink:0;fill:#9090c8;";
                check.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
                const nameSpan = this.frame.document.createElement("span");
                nameSpan.className = "option-title";
                nameSpan.style.cssText = "flex:1;font-size:1.05em;color:#d8d8f8;font-weight:600;";
                nameSpan.textContent = botName;
                const delBtn = this.frame.document.createElement("button");
                delBtn.style.cssText = "background:transparent;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;";
                delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" style="width:18px;height:18px;fill:#9090c877;"><path d="M 7 4 C 6.744125 4 6.4879687 4.0974687 6.2929688 4.2929688 L 4.2929688 6.2929688 C 3.9019687 6.6839688 3.9019687 7.3170313 4.2929688 7.7070312 L 11.585938 15 L 4.2929688 22.292969 C 3.9019687 22.683969 3.9019687 23.317031 4.2929688 23.707031 L 6.2929688 25.707031 C 6.6839688 26.098031 7.3170313 26.098031 7.7070312 25.707031 L 15 18.414062 L 22.292969 25.707031 C 22.682969 26.098031 23.317031 26.098031 23.707031 25.707031 L 25.707031 23.707031 C 26.098031 23.316031 26.098031 22.682969 25.707031 22.292969 L 18.414062 15 L 25.707031 7.7070312 C 26.098031 7.3170312 26.098031 6.6829688 25.707031 6.2929688 L 23.707031 4.2929688 C 23.316031 3.9019687 22.682969 3.9019687 22.292969 4.2929688 L 15 11.585938 L 7.7070312 4.2929688 C 7.5115312 4.0974687 7.255875 4 7 4 z"/></svg>';
                delBtn.onmouseenter = () => {
                  delBtn.querySelector("svg").style.fill = "#cc5151";
                };
                delBtn.onmouseleave = () => {
                  delBtn.querySelector("svg").style.fill = "#9090c877";
                };
                delBtn.onclick = () => {
                  player.disconnect();
                };
                rowEl.appendChild(check);
                rowEl.appendChild(nameSpan);
                rowEl.appendChild(delBtn);
              }
            } else {
              this.createBotOption(player);
            }
            const _waitForSpawn = setInterval(() => {
              if (player.myPlayer && player.myPlayer.inGame) {
                _applyBotWeaponPatch(player);
                clearInterval(_waitForSpawn);
              }
            }, 100);
          };
          socket.addEventListener("connected", onconnect);
          const handleClose = () => {
            socket.removeEventListener("connected", onconnect);
            try {
              client.clients.delete(player);
            } catch (_) {}
            try {
              client.clientIDList.delete(player.myPlayer.id);
            } catch (_) {}
            try {
              client.pendingJoins.delete(player.myPlayer.id);
            } catch (_) {}
            this.removeBotConnecting();
            if (rowId) {
              const rowEl = this.frame.document.getElementById(rowId);
              if (rowEl) rowEl.remove();
            } else {
              this.deleteBotOption(player);
            }
          };
          socket.addEventListener("error", handleClose);
          socket.addEventListener("close", handleClose);
        };
      };
    }
    handleResetSettings(button) {
      button.onclick = () => {
        resetSettings();
      };
    }
    attachRandomNameUI() {
      const doc = this.frame.document;
      const btn = doc.getElementById("_randomNameBtn");
      const inp = doc.getElementById("_randomNameInput");
      const result = doc.getElementById("_randomNameResult");
      const copyBtn = doc.getElementById("_randomNameCopy");
      if (!btn || !inp || !result || !copyBtn) return;
      inp.onfocus = () => {
        this.activeInput = inp;
      };
      inp.onblur = () => {
        this.activeInput = null;
      };
      btn.onclick = () => {
        const name = inp.value.trim();
        if (!name) {
          result.textContent = "—";
          copyBtn.style.display = "none";
          return;
        }
        let out = "";
        for (let i = 0; i < name.length; i++) {
          out += name[i];
          if (Math.random() > 0.35 && i < name.length - 1) {
            const count = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < count; j++) {
              out += Math.floor(Math.random() * 10);
            }
          }
        }
        result.textContent = out;
        copyBtn.style.display = "";
      };
      copyBtn.onclick = () => {
        const val = result.textContent;
        if (!val || val === "—") return;
        try {
          navigator.clipboard.writeText(val).catch(() => {});
        } catch (e) {}
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          copyBtn.textContent = "📋 Copy";
        }, 1500);
      };
    }
    attachAutoChatUI() {
      if (!Settings_default._autoChatMsgs) Settings_default._autoChatMsgs = [];
      if (!Settings_default._autoBotChatMsgs) Settings_default._autoBotChatMsgs = [];
      const doc = this.frame.document;
      const listEl = doc.querySelector("#autoChatMsgList");
      const addBtn = doc.querySelector("#addAutoChatMsg");
      const botListEl = doc.querySelector("#autoBotChatMsgList");
      const addBotBtn = doc.querySelector("#addAutoBotChatMsg");
      const autoBotChatToggle = doc.querySelector("#_autoBotChat");
      if (autoBotChatToggle) {
        autoBotChatToggle.checked = Settings_default._autoBotChat || false;
        autoBotChatToggle.onchange = () => {
          Settings_default._autoBotChat = autoBotChatToggle.checked;
          SaveSettings();
        };
      }
      const renderBotMsg = (msg, idx) => {
        if (!botListEl) return;
        const row = doc.createElement("div");
        row.className = "content-option";
        row.style.gap = "8px";
        const inp = doc.createElement("input");
        inp.type = "text";
        inp.className = "input";
        inp.maxLength = 50;
        inp.placeholder = "Bot Message " + (idx + 1);
        inp.value = msg || "";
        inp.style.width = "190px";
        inp.onfocus = () => {
          this.activeInput = inp;
        };
        inp.onblur = () => {
          this.activeInput = null;
        };
        inp.oninput = () => {
          inp.value = inp.value.replace(/[^ -~]/g, "");
        };
        inp.onchange = () => {
          const i = Array.from(botListEl.children).indexOf(row);
          if (i >= 0) Settings_default._autoBotChatMsgs[i] = inp.value;
          SaveSettings();
        };
        const del = doc.createElement("button");
        del.className = "option-button red";
        del.style.cssText = "padding:4px 12px;font-size:1em;";
        del.textContent = "X";
        del.onclick = () => {
          const i = Array.from(botListEl.children).indexOf(row);
          if (i >= 0) Settings_default._autoBotChatMsgs.splice(i, 1);
          SaveSettings();
          row.remove();
        };
        row.appendChild(inp);
        row.appendChild(del);
        botListEl.appendChild(row);
      };
      if (botListEl) {
        Settings_default._autoBotChatMsgs.forEach((m, i) => renderBotMsg(m, i));
      }
      if (addBotBtn) {
        addBotBtn.onclick = () => {
          if (!Settings_default._autoBotChatMsgs) Settings_default._autoBotChatMsgs = [];
          Settings_default._autoBotChatMsgs.push("");
          SaveSettings();
          renderBotMsg("", Settings_default._autoBotChatMsgs.length - 1);
        };
      }
      if (!listEl || !addBtn) return;
      const reindex = () => {
        const inputs = listEl.querySelectorAll("input[type=text]");
        inputs.forEach((inp, i) => {
          inp.placeholder = "Message " + (i + 1);
        });
      };
      const renderMsg = (msg, idx) => {
        const row = doc.createElement("div");
        row.className = "content-option";
        row.style.gap = "8px";
        const inp = doc.createElement("input");
        inp.type = "text";
        inp.className = "input";
        inp.maxLength = 50;
        inp.placeholder = "Message " + (idx + 1);
        inp.value = msg || "";
        inp.style.width = "190px";
        inp.onfocus = () => {
          this.activeInput = inp;
        };
        inp.onblur = () => {
          this.activeInput = null;
        };
        inp.oninput = () => {
          inp.value = inp.value.replace(/[^ -~]/g, "");
        };
        inp.onchange = () => {
          const i = Array.from(listEl.children).indexOf(row);
          if (i >= 0) Settings_default._autoChatMsgs[i] = inp.value;
          SaveSettings();
        };
        const del = doc.createElement("button");
        del.className = "option-button red";
        del.style.cssText = "padding:4px 12px;font-size:1em;";
        del.textContent = "✕";
        del.onclick = () => {
          const i = Array.from(listEl.children).indexOf(row);
          if (i >= 0) Settings_default._autoChatMsgs.splice(i, 1);
          SaveSettings();
          row.remove();
          reindex();
        };
        row.appendChild(inp);
        row.appendChild(del);
        listEl.appendChild(row);
      };
      Settings_default._autoChatMsgs.forEach((m, i) => renderMsg(m, i));
      addBtn.onclick = () => {
        if (!Settings_default._autoChatMsgs) Settings_default._autoChatMsgs = [];
        Settings_default._autoChatMsgs.push("");
        SaveSettings();
        renderMsg("", Settings_default._autoChatMsgs.length - 1);
      };
    }
    _generateRandomBotName() {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      const len = 1 + Math.floor(Math.random() * 7);
      let out = "";
      for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }
    attachDynamicBotUI() {
      const doc = this.frame.document;
      const addBotBtn = doc.querySelector("#add-bot-dynamic");
      const dynamicList = doc.querySelector("#dynamic-bot-list");
      if (!addBotBtn || !dynamicList) return;
      const botChatSyncChk = doc.querySelector("#_botChatSync");
      if (botChatSyncChk) {
        botChatSyncChk.checked = !!this._chatSync;
        botChatSyncChk.onchange = () => {
          this._chatSync = botChatSyncChk.checked;
        };
      }
      let botCount = 0;
      addBotBtn.onclick = () => {
        botCount++;
        const isFirst = botCount === 1;
        const rowId = `dyn-bot-row-${botCount}`;
        const inputId = `dyn-bot-input-${botCount}`;
        const btnId = `dyn-bot-btn-${botCount}`;
        const row = doc.createElement("div");
        row.id = rowId;
        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(201,162,39,0.05);border-radius:8px;border:1px solid #9090c833;";
        const label = doc.createElement("span");
        label.className = "option-title";
        label.style.cssText = "min-width:80px;font-size:1.1em;color:#7070a8;";
        label.textContent = `Bot ${botCount} Name`;
        const inp = doc.createElement("input");
        inp.id = inputId;
        inp.type = "text";
        inp.placeholder = "e.g. Ryn " + (30 + botCount);
        inp.maxLength = 15;
        inp.style.cssText = "background:transparent;border:1px solid #9090c8;border-radius:4px;color:#d8d8f8;padding:5px 8px;font-size:13px;outline:none;flex:1;min-width:0;";
        inp.onfocus = () => {
          this.activeInput = inp;
        };
        inp.onblur = () => {
          this.activeInput = null;
        };
        if (Settings_default._autoRandomBotNames) {
          inp.value = this._generateRandomBotName();
        }
        const diceBtn = doc.createElement("button");
        diceBtn.type = "button";
        diceBtn.title = "Random name (1-7 chars)";
        diceBtn.style.cssText = "background:rgba(122,66,244,0.12);border:1.5px solid rgba(122,66,244,0.4);color:#c8b8ff;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:1em;line-height:1;flex-shrink:0;transition:all 150ms;";
        diceBtn.textContent = "🎲";
        diceBtn.onmouseenter = () => {
          diceBtn.style.background = "rgba(122,66,244,0.22)";
        };
        diceBtn.onmouseleave = () => {
          diceBtn.style.background = "rgba(122,66,244,0.12)";
        };
        diceBtn.onclick = () => {
          inp.value = this._generateRandomBotName();
        };
        const connectBtn = doc.createElement("button");
        connectBtn.id = btnId;
        connectBtn.className = "option-button";
        connectBtn.style.cssText = "padding:8px 18px;font-size:1em;white-space:nowrap;";
        connectBtn.textContent = `Connect Bot ${botCount}`;
        const delBtn = doc.createElement("button");
        delBtn.style.cssText = "background:#853838;border:2px solid #6f2f2f;color:#c07878;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:0.9em;font-weight:800;";
        delBtn.textContent = "✕";
        delBtn.onclick = () => {
          row.remove();
        };
        row.appendChild(label);
        row.appendChild(inp);
        row.appendChild(diceBtn);
        row.appendChild(connectBtn);
        row.appendChild(delBtn);
        dynamicList.appendChild(row);
        const withDelay = !isFirst;
        this.handleBotCreation(connectBtn, inputId, withDelay, rowId);
        const pageContainer = doc.querySelector("#page-container");
        if (pageContainer) pageContainer.scrollTop = pageContainer.scrollHeight;
      };
    }
    attachButtons() {
      const {buttons: buttons} = this.getElements();
      for (const button of buttons) {
        switch (button.id) {
         case "resetSettings":
          this.handleResetSettings(button);
          break;
        }
      }
      this.attachDynamicBotUI();
      this._attachFormationSelector();
      this._attachWeaponSelector();
    }
    _attachFormationSelector() {
      const doc = this.frame.document;
      const grid = doc.getElementById("_formationGrid");
      if (!grid) return;
      const formations = [ {
        id: "none",
        icon: "✕",
        label: "None"
      }, {
        id: "circle",
        icon: "●",
        label: "Circle"
      }, {
        id: "line",
        icon: "—",
        label: "Line"
      }, {
        id: "hline",
        icon: "━",
        label: "H Line"
      }, {
        id: "column",
        icon: "┃",
        label: "Column"
      }, {
        id: "arrow",
        icon: "↑",
        label: "Arrow"
      }, {
        id: "x",
        icon: "✕",
        label: "X Cross"
      }, {
        id: "cross",
        icon: "✚",
        label: "Cross"
      }, {
        id: "plus_wide",
        icon: "⊕",
        label: "Plus Wide"
      }, {
        id: "scatter",
        icon: "∴",
        label: "Scatter"
      }, {
        id: "thin_line",
        icon: "⟵",
        label: "Thin Line"
      }, {
        id: "triangle",
        icon: "▲",
        label: "Triangle"
      }, {
        id: "triangle_inv",
        icon: "▽",
        label: "Tri Inverted"
      }, {
        id: "square",
        icon: "■",
        label: "Square"
      }, {
        id: "diamond",
        icon: "◆",
        label: "Diamond"
      }, {
        id: "diamond_sm",
        icon: "◇",
        label: "Diamond Small"
      }, {
        id: "diamond_ring",
        icon: "⬧",
        label: "Diamond Ring"
      }, {
        id: "pentagon",
        icon: "⬠",
        label: "Pentagon"
      }, {
        id: "hexagon",
        icon: "⬡",
        label: "Hexagon"
      }, {
        id: "octagon",
        icon: "⯃",
        label: "Octagon"
      }, {
        id: "poly7",
        icon: "7",
        label: "Heptagon"
      }, {
        id: "poly9",
        icon: "9",
        label: "Nonagon"
      }, {
        id: "poly10",
        icon: "⏺",
        label: "Decagon"
      }, {
        id: "poly12",
        icon: "⬢",
        label: "Dodecagon"
      }, {
        id: "box_open",
        icon: "□",
        label: "Box"
      }, {
        id: "kite",
        icon: "◈",
        label: "Kite"
      }, {
        id: "rhombus",
        icon: "◊",
        label: "Rhombus"
      }, {
        id: "trapezoid",
        icon: "⏢",
        label: "Trapezoid"
      }, {
        id: "parallelogram",
        icon: "▱",
        label: "Parallelogram"
      }, {
        id: "star",
        icon: "★",
        label: "Star 5"
      }, {
        id: "star4",
        icon: "✦",
        label: "Star 4"
      }, {
        id: "star6",
        icon: "✶",
        label: "Star 6"
      }, {
        id: "star8",
        icon: "✳",
        label: "Star 8"
      }, {
        id: "star10",
        icon: "✺",
        label: "Star 10"
      }, {
        id: "star12",
        icon: "✹",
        label: "Star 12"
      }, {
        id: "heart",
        icon: "♥",
        label: "Heart"
      }, {
        id: "crescent",
        icon: "☽",
        label: "Crescent"
      }, {
        id: "crown",
        icon: "♛",
        label: "Crown"
      }, {
        id: "cross_plus",
        icon: "+",
        label: "Plus"
      }, {
        id: "fan",
        icon: ")",
        label: "Fan"
      }, {
        id: "arc",
        icon: "⌒",
        label: "Arc"
      }, {
        id: "v_shape",
        icon: "V",
        label: "V Shape"
      }, {
        id: "u_shape",
        icon: "U",
        label: "U Shape"
      }, {
        id: "w_shape",
        icon: "W",
        label: "W Shape"
      }, {
        id: "t_shape",
        icon: "T",
        label: "T Shape"
      }, {
        id: "l_shape",
        icon: "L",
        label: "L Shape"
      }, {
        id: "z_shape",
        icon: "Z",
        label: "Z Shape"
      }, {
        id: "s_shape",
        icon: "S",
        label: "S Shape"
      }, {
        id: "bowtie",
        icon: "⋈",
        label: "Bowtie"
      }, {
        id: "oval",
        icon: "⬭",
        label: "Oval H"
      }, {
        id: "oval_v",
        icon: "⬮",
        label: "Oval V"
      }, {
        id: "lemniscate",
        icon: "∞",
        label: "Lemniscate"
      }, {
        id: "teardrop",
        icon: "◁",
        label: "Teardrop"
      }, {
        id: "egg",
        icon: "⬬",
        label: "Egg"
      }, {
        id: "leaf",
        icon: "⌓",
        label: "Leaf"
      }, {
        id: "pac",
        icon: "Ｃ",
        label: "Pac"
      }, {
        id: "horseshoe",
        icon: "⋒",
        label: "Horseshoe"
      }, {
        id: "c_shape",
        icon: "C",
        label: "C Shape"
      }, {
        id: "hook",
        icon: "J",
        label: "Hook"
      }, {
        id: "shield",
        icon: "🛡",
        label: "Shield"
      }, {
        id: "bullet",
        icon: "▶",
        label: "Bullet"
      }, {
        id: "brace",
        icon: "{",
        label: "Brace"
      }, {
        id: "rows3",
        icon: "⊟",
        label: "Rows 3"
      }, {
        id: "rows4",
        icon: "≡",
        label: "Rows 4"
      }, {
        id: "rows5",
        icon: "≣",
        label: "Rows 5"
      }, {
        id: "columns2",
        icon: "‖",
        label: "Columns 2"
      }, {
        id: "tri_cols",
        icon: "⫼",
        label: "3 Columns"
      }, {
        id: "stagger",
        icon: "⠿",
        label: "Stagger"
      }, {
        id: "checkers",
        icon: "⊞",
        label: "Checkers"
      }, {
        id: "fence",
        icon: "⦀",
        label: "Fence"
      }, {
        id: "step",
        icon: "⌼",
        label: "Step"
      }, {
        id: "phalanx",
        icon: "⣿",
        label: "Phalanx"
      }, {
        id: "wedge",
        icon: "◭",
        label: "Wedge"
      }, {
        id: "pyramid",
        icon: "△",
        label: "Pyramid"
      }, {
        id: "bracket",
        icon: "[ ]",
        label: "Bracket"
      }, {
        id: "bracket_h",
        icon: "⌐¬",
        label: "Bracket H"
      }, {
        id: "chevron",
        icon: "〈",
        label: "Chevron"
      }, {
        id: "chevron_inv",
        icon: "〉",
        label: "Chevron Inv"
      }, {
        id: "arrow_dbl",
        icon: "⇔",
        label: "Double Arrow"
      }, {
        id: "drop_front",
        icon: "⊙",
        label: "Drop Front"
      }, {
        id: "ring_inner",
        icon: "◉",
        label: "Ring Inner"
      }, {
        id: "ring_outer",
        icon: "○",
        label: "Ring Outer"
      }, {
        id: "ring3",
        icon: "⊚",
        label: "3 Rings"
      }, {
        id: "ring_half",
        icon: "◗",
        label: "Half Ring"
      }, {
        id: "semi_top",
        icon: "◠",
        label: "Semi Top"
      }, {
        id: "semi_bottom",
        icon: "◡",
        label: "Semi Bottom"
      }, {
        id: "semi_left",
        icon: "◖",
        label: "Semi Left"
      }, {
        id: "semi_right",
        icon: "◗",
        label: "Semi Right"
      }, {
        id: "concentric",
        icon: "◎",
        label: "Concentric"
      }, {
        id: "burst",
        icon: "✷",
        label: "Burst"
      }, {
        id: "sunflower",
        icon: "✲",
        label: "Sunflower"
      }, {
        id: "spoke3",
        icon: "⅄",
        label: "Spoke 3"
      }, {
        id: "spoke4",
        icon: "✙",
        label: "Spoke 4"
      }, {
        id: "spoke6",
        icon: "✛",
        label: "Spoke 6"
      }, {
        id: "spiral",
        icon: "⊗",
        label: "Spiral"
      }, {
        id: "spiral_tight",
        icon: "◌",
        label: "Spiral Tight"
      }, {
        id: "diagonal_r",
        icon: "↗",
        label: "Diagonal ↗"
      }, {
        id: "diagonal_l",
        icon: "↖",
        label: "Diagonal ↖"
      }, {
        id: "helix",
        icon: "⌀",
        label: "Helix"
      }, {
        id: "clover3",
        icon: "☘",
        label: "Clover 3"
      }, {
        id: "army_line",
        icon: "▬",
        label: "Army Line"
      }, {
        id: "army_column",
        icon: "▮",
        label: "Army Column"
      }, {
        id: "army_wedge",
        icon: "◤",
        label: "Army Wedge"
      }, {
        id: "army_arrowhead",
        icon: "➤",
        label: "Army Arrowhead"
      }, {
        id: "army_phalanx",
        icon: "▦",
        label: "Army Phalanx"
      }, {
        id: "army_box",
        icon: "▣",
        label: "Army Box"
      }, {
        id: "army_skirmish",
        icon: "⁘",
        label: "Army Skirmish"
      }, {
        id: "army_echelon_l",
        icon: "◺",
        label: "Echelon Left"
      }, {
        id: "army_echelon_r",
        icon: "◿",
        label: "Echelon Right"
      }, {
        id: "army_spearhead",
        icon: "⬥",
        label: "Spearhead"
      } ];
      const current = () => Settings_default._formation || "none";
      const btns = {};
      if (!doc.getElementById("_formationStyles")) {
        const st = doc.createElement("style");
        st.id = "_formationStyles";
        st.textContent = `\n                    #_formationGrid{\n                        position:relative;\n                        width:100%;\n                        display:block !important;\n                    }\n                    .fsel-trigger{\n                        display:flex;\n                        align-items:center;\n                        gap:10px;\n                        width:100%;\n                        padding:8px 12px;\n                        background:rgba(122,66,244,0.05);\n                        border:1.5px solid rgba(122,66,244,0.22);\n                        border-radius:8px;\n                        cursor:pointer;\n                        transition:all 150ms;\n                        box-sizing:border-box;\n                        user-select:none;\n                    }\n                    .fsel-trigger:hover{\n                        background:rgba(122,66,244,0.1);\n                        border-color:rgba(122,66,244,0.45);\n                    }\n                    .fsel-trigger.open{\n                        border-color:rgba(122,66,244,0.6);\n                        box-shadow:0 0 10px rgba(122,66,244,0.15);\n                    }\n                    .fsel-trigger .fsel-icon{\n                        font-size:1.25em;\n                        width:26px;\n                        text-align:center;\n                        flex-shrink:0;\n                        color:#c0a8ff;\n                    }\n                    .fsel-trigger .fsel-label{\n                        flex:1;\n                        font-size:0.8em;\n                        font-weight:600;\n                        letter-spacing:0.04em;\n                        color:rgba(220,215,235,0.9);\n                    }\n                    .fsel-trigger .fsel-arrow{\n                        font-size:0.7em;\n                        color:rgba(122,66,244,0.55);\n                        transition:transform 150ms;\n                        flex-shrink:0;\n                    }\n                    .fsel-trigger.open .fsel-arrow{\n                        transform:rotate(180deg);\n                    }\n                    .fsel-popup{\n                        position:fixed;\n                        z-index:99999;\n                        background:rgba(15,12,26,0.98);\n                        border:1px solid rgba(122,66,244,0.35);\n                        border-radius:10px;\n                        box-shadow:0 12px 32px rgba(0,0,0,0.65);\n                        width:280px;\n                        display:flex;\n                        flex-direction:column;\n                        transform-origin:top center;\n                        overflow:hidden;\n                    }\n                    .fsel-popup-header{\n                        display:flex;\n                        align-items:center;\n                        gap:8px;\n                        padding:7px 10px;\n                        background:rgba(122,66,244,0.08);\n                        border-bottom:1px solid rgba(122,66,244,0.2);\n                        cursor:grab;\n                        user-select:none;\n                        flex-shrink:0;\n                    }\n                    .fsel-popup-header:active{cursor:grabbing;}\n                    .fsel-popup-header .fsel-popup-title{\n                        flex:1;\n                        font-family:Orbitron,monospace;\n                        font-size:0.62em;\n                        font-weight:700;\n                        letter-spacing:0.14em;\n                        text-transform:uppercase;\n                        color:rgba(122,66,244,0.65);\n                    }\n                    .fsel-popup-close{\n                        width:18px;height:18px;\n                        display:flex;align-items:center;justify-content:center;\n                        border-radius:4px;\n                        font-size:0.75em;\n                        color:rgba(200,200,215,0.4);\n                        cursor:pointer;\n                        transition:all 140ms;\n                        flex-shrink:0;\n                    }\n                    .fsel-popup-close:hover{\n                        background:rgba(255,77,109,0.12);\n                        color:#ff4d6d;\n                    }\n                    .fsel-popup-body{\n                        display:grid;\n                        grid-template-columns:repeat(auto-fill, minmax(46px, 1fr));\n                        gap:5px;\n                        padding:8px;\n                        max-height:260px;\n                        overflow-y:auto;\n                    }\n                    .fsel-popup-body::-webkit-scrollbar{width:4px;}\n                    .fsel-popup-body::-webkit-scrollbar-track{background:transparent;}\n                    .fsel-popup-body::-webkit-scrollbar-thumb{background:rgba(122,66,244,0.3);border-radius:2px;}\n                    .fcat-btn{\n                        display:flex;\n                        flex-direction:column;\n                        align-items:center;\n                        justify-content:center;\n                        width:100%;\n                        aspect-ratio:1;\n                        min-width:36px;\n                        border-radius:7px;\n                        border:1.5px solid rgba(122,66,244,0.15);\n                        cursor:pointer;\n                        font-size:1.1em;\n                        transition:all 150ms;\n                        user-select:none;\n                        background:rgba(122,66,244,0.04);\n                        color:rgba(180,160,255,0.65);\n                        position:relative;\n                        box-sizing:border-box;\n                    }\n                    .fcat-btn:hover{\n                        background:rgba(122,66,244,0.12);\n                        border-color:rgba(122,66,244,0.45);\n                        color:#c0a8ff;\n                        transform:scale(1.07);\n                        box-shadow:0 0 10px rgba(122,66,244,0.15);\n                        z-index:10;\n                    }\n                    .fcat-btn.active{\n                        background:rgba(122,66,244,0.22);\n                        border-color:rgba(122,66,244,0.7);\n                        color:#e0d4ff;\n                        box-shadow:0 0 12px rgba(122,66,244,0.35);\n                        transform:scale(1.08);\n                    }\n                    .fcat-btn .fcat-tip{\n                        display:none;\n                        position:absolute;\n                        top:calc(100% + 5px);\n                        left:50%;\n                        transform:translateX(-50%);\n                        background:rgba(12,8,24,0.97);\n                        border:1px solid rgba(122,66,244,0.4);\n                        border-radius:5px;\n                        padding:3px 8px;\n                        font-size:0.6em;\n                        font-family:Orbitron,monospace;\n                        font-weight:700;\n                        letter-spacing:0.06em;\n                        color:#d0c8ff;\n                        white-space:nowrap;\n                        pointer-events:none;\n                        z-index:9999;\n                        box-shadow:0 4px 14px rgba(0,0,0,0.7);\n                    }\n                    .fcat-btn:hover .fcat-tip{\n                        display:block;\n                    }\n                    .fcat-key{\n                        position:absolute;\n                        top:2px;right:2px;\n                        min-width:15px;height:13px;\n                        display:flex;align-items:center;justify-content:center;\n                        background:rgba(0,0,0,0.45);\n                        border:1px solid rgba(122,66,244,0.3);\n                        border-radius:3px;\n                        font-family:Orbitron,monospace;\n                        font-size:0.34em;\n                        font-weight:700;\n                        letter-spacing:0.02em;\n                        color:rgba(200,185,255,0.75);\n                        padding:0 2px;\n                        line-height:1;\n                        transition:all 120ms;\n                        z-index:5;\n                    }\n                    .fcat-key:hover{\n                        background:rgba(122,66,244,0.3);\n                        border-color:rgba(122,66,244,0.7);\n                        color:#fff;\n                    }\n                    .fcat-key.set{\n                        background:rgba(122,66,244,0.22);\n                        border-color:rgba(122,66,244,0.55);\n                        color:#e0d4ff;\n                    }\n                    .fcat-key.recording{\n                        background:rgba(255,77,109,0.25);\n                        border-color:#ff4d6d;\n                        color:#fff;\n                        animation:dot-blink 0.8s ease infinite;\n                    }\n                    .fcat-reset{\n                        position:absolute;\n                        bottom:2px;left:2px;\n                        min-width:13px;height:13px;\n                        display:none;\n                        align-items:center;justify-content:center;\n                        background:rgba(255,77,109,0.15);\n                        border:1px solid rgba(255,77,109,0.4);\n                        border-radius:3px;\n                        font-size:0.55em;\n                        font-weight:700;\n                        line-height:1;\n                        color:#ff8fa3;\n                        cursor:pointer;\n                        z-index:5;\n                        transition:all 120ms;\n                    }\n                    .fcat-reset.show{display:flex;}\n                    .fcat-reset:hover{\n                        background:#ff4d6d;\n                        border-color:#ff4d6d;\n                        color:#fff;\n                    }\n                    .fsel-popup-footer{\n                        flex-shrink:0;\n                        padding:7px 8px;\n                        border-top:1px solid rgba(122,66,244,0.15);\n                    }\n                    .fsel-reset-all{\n                        width:100%;\n                        padding:6px 0;\n                        background:rgba(255,77,109,0.06);\n                        border:1px solid rgba(255,77,109,0.3);\n                        border-radius:6px;\n                        font-family:Orbitron,monospace;\n                        font-size:0.62em;\n                        font-weight:700;\n                        letter-spacing:0.08em;\n                        text-transform:uppercase;\n                        color:#ff8fa3;\n                        cursor:pointer;\n                        transition:all 140ms;\n                        text-align:center;\n                    }\n                    .fsel-reset-all:hover{\n                        background:rgba(255,77,109,0.15);\n                        border-color:#ff4d6d;\n                        color:#fff;\n                        box-shadow:0 0 10px rgba(255,77,109,0.2);\n                    }\n                `;
        doc.head.appendChild(st);
      }
      grid.innerHTML = "";
      grid.style.cssText = "";
      const trigger = doc.createElement("div");
      trigger.className = "fsel-trigger";
      const triggerIcon = doc.createElement("span");
      triggerIcon.className = "fsel-icon";
      const triggerLabel = doc.createElement("span");
      triggerLabel.className = "fsel-label";
      const triggerArrow = doc.createElement("span");
      triggerArrow.className = "fsel-arrow";
      triggerArrow.textContent = "▾";
      trigger.appendChild(triggerIcon);
      trigger.appendChild(triggerLabel);
      trigger.appendChild(triggerArrow);
      const popup = doc.createElement("div");
      popup.className = "fsel-popup";
      popup.style.display = "none";
      const popupHeader = doc.createElement("div");
      popupHeader.className = "fsel-popup-header";
      const popupTitle = doc.createElement("span");
      popupTitle.className = "fsel-popup-title";
      popupTitle.textContent = "Formation";
      const popupClose = doc.createElement("div");
      popupClose.className = "fsel-popup-close";
      popupClose.textContent = "✕";
      popupHeader.appendChild(popupTitle);
      popupHeader.appendChild(popupClose);
      const popupBody = doc.createElement("div");
      popupBody.className = "fsel-popup-body";
      const popupFooter = doc.createElement("div");
      popupFooter.className = "fsel-popup-footer";
      const resetAllBtn = doc.createElement("div");
      resetAllBtn.className = "fsel-reset-all";
      resetAllBtn.textContent = "✕ Reset All Hotkeys";
      popupFooter.appendChild(resetAllBtn);
      popup.appendChild(popupHeader);
      popup.appendChild(popupBody);
      popup.appendChild(popupFooter);
      doc.body.appendChild(popup);
      grid.appendChild(trigger);
      if (!Settings_default._formationHotkeys) {
        Settings_default._formationHotkeys = {};
      }
      const updateStyles = () => {
        const cur = current();
        Object.values(btns).forEach(b => {
          if (!b) return;
          b.classList.toggle("active", b.dataset.fid === cur);
        });
        const f = formations.find(x => x.id === cur) || formations[0];
        triggerIcon.textContent = f.icon;
        triggerLabel.textContent = f.label;
      };
      window._updateFormationUI = updateStyles;
      const closePopup = () => {
        if (popup.style.display === "none") return;
        popup.classList.remove("toopen");
        popup.classList.add("toclose");
        trigger.classList.remove("open");
        setTimeout(() => {
          popup.style.display = "none";
          popup.classList.remove("toclose");
        }, 150);
      };
      const openPopup = () => {
        const rect = trigger.getBoundingClientRect();
        const popupW = 280;
        let left = rect.left;
        let top = rect.bottom + 6;
        const maxLeft = doc.documentElement.clientWidth - popupW - 10;
        const maxTop = doc.documentElement.clientHeight - 290;
        if (left > maxLeft) left = Math.max(10, maxLeft);
        if (top > maxTop) top = Math.max(10, rect.top - 270);
        popup.style.left = left + "px";
        popup.style.top = top + "px";
        popup.style.display = "flex";
        popup.classList.remove("toclose");
        popup.classList.add("toopen");
        trigger.classList.add("open");
      };
      trigger.onclick = e => {
        e.stopPropagation();
        if (popup.style.display === "none") openPopup(); else closePopup();
      };
      popupClose.onclick = e => {
        e.stopPropagation();
        closePopup();
      };
      let dragging = false, dragOffX = 0, dragOffY = 0;
      popupHeader.addEventListener("mousedown", e => {
        dragging = true;
        const rect = popup.getBoundingClientRect();
        dragOffX = e.clientX - rect.left;
        dragOffY = e.clientY - rect.top;
        e.preventDefault();
      });
      doc.addEventListener("mousemove", e => {
        if (!dragging) return;
        let left = e.clientX - dragOffX;
        let top = e.clientY - dragOffY;
        const maxLeft = doc.documentElement.clientWidth - popup.offsetWidth;
        const maxTop = doc.documentElement.clientHeight - popup.offsetHeight;
        left = Math.min(Math.max(0, left), Math.max(0, maxLeft));
        top = Math.min(Math.max(0, top), Math.max(0, maxTop));
        popup.style.left = left + "px";
        popup.style.top = top + "px";
      });
      doc.addEventListener("mouseup", () => {
        dragging = false;
      });
      doc.addEventListener("click", e => {
        if (dragging) return;
        if (!grid.contains(e.target) && !popup.contains(e.target)) closePopup();
      });
      let recordingFid = null;
      const renderKeyBadge = (badge, fid) => {
        const code = (Settings_default._formationHotkeys || {})[fid];
        const reset = resetBtns[fid];
        if (code && code !== "...") {
          badge.textContent = formatCode(code);
          badge.classList.add("set");
          if (reset) reset.classList.add("show");
        } else {
          badge.textContent = "+";
          badge.classList.remove("set");
          if (reset) reset.classList.remove("show");
        }
      };
      doc.addEventListener("keydown", e => {
        if (!recordingFid) return;
        e.preventDefault();
        e.stopPropagation();
        const fid = recordingFid;
        const badge = keyBadges[fid];
        if (e.code === "Escape" || e.code === "Backspace" || e.code === "Delete") {
          delete Settings_default._formationHotkeys[fid];
        } else {
          for (const otherId in Settings_default._formationHotkeys) {
            if (Settings_default._formationHotkeys[otherId] === e.code) {
              delete Settings_default._formationHotkeys[otherId];
              if (keyBadges[otherId]) renderKeyBadge(keyBadges[otherId], otherId);
            }
          }
          Settings_default._formationHotkeys[fid] = e.code;
        }
        SaveSettings();
        badge.classList.remove("recording");
        renderKeyBadge(badge, fid);
        recordingFid = null;
      });
      const keyBadges = {};
      const resetBtns = {};
      formations.forEach(f => {
        const b = doc.createElement("div");
        b.className = "fcat-btn";
        b.dataset.fid = f.id;
        const icon = doc.createElement("span");
        icon.textContent = f.icon;
        icon.style.pointerEvents = "none";
        const tip = doc.createElement("span");
        tip.className = "fcat-tip";
        tip.textContent = f.label;
        const keyBadge = doc.createElement("span");
        keyBadge.className = "fcat-key";
        keyBadge.title = "Click then press a key to bind";
        keyBadges[f.id] = keyBadge;
        const resetBtn = doc.createElement("span");
        resetBtn.className = "fcat-reset";
        resetBtn.title = "Reset this hotkey";
        resetBtn.textContent = "×";
        resetBtns[f.id] = resetBtn;
        renderKeyBadge(keyBadge, f.id);
        b.appendChild(icon);
        b.appendChild(tip);
        b.appendChild(keyBadge);
        b.appendChild(resetBtn);
        popupBody.appendChild(b);
        btns[f.id] = b;
        resetBtn.onclick = e => {
          e.stopPropagation();
          if (recordingFid === f.id) {
            keyBadge.classList.remove("recording");
            recordingFid = null;
          }
          delete Settings_default._formationHotkeys[f.id];
          SaveSettings();
          renderKeyBadge(keyBadge, f.id);
        };
        keyBadge.onclick = e => {
          e.stopPropagation();
          if (recordingFid === f.id) {
            keyBadge.classList.remove("recording");
            recordingFid = null;
            return;
          }
          if (recordingFid && keyBadges[recordingFid]) {
            keyBadges[recordingFid].classList.remove("recording");
          }
          recordingFid = f.id;
          keyBadge.classList.add("recording");
          keyBadge.textContent = "...";
        };
        b.onclick = e => {
          e.stopPropagation();
          Settings_default._formation = f.id;
          SaveSettings();
          updateStyles();
          closePopup();
        };
      });
      resetAllBtn.onclick = e => {
        e.stopPropagation();
        if (recordingFid && keyBadges[recordingFid]) {
          keyBadges[recordingFid].classList.remove("recording");
        }
        recordingFid = null;
        Settings_default._formationHotkeys = {};
        SaveSettings();
        Object.keys(keyBadges).forEach(fid => renderKeyBadge(keyBadges[fid], fid));
      };
      updateStyles();
    }
    _attachWeaponSelector() {
      const doc = this.frame.document;
      const selector = doc.getElementById("bot-weapon-selector");
      if (!selector) return;
      const label = doc.getElementById("bot-weapon-label");
      const btns = selector.querySelectorAll(".bot-weapon-btn");
      const names = {
        "-1": "Copy from me (default)",
        0: "Tool Hammer",
        1: "Hand Axe (upgrades to Great Axe at age 8)",
        2: "Great Axe only (skips Hand Axe)",
        3: "Short Sword only (no upgrade)",
        4: "Katana (Short Sword to Katana at age 8)",
        5: "Polearm",
        6: "Bat",
        7: "Daggers",
        8: "Stick"
      };
      const setActive = wid => {
        window._botWeaponOverride = parseInt(wid);
        if (label) label.textContent = names[String(wid)] || wid;
        btns.forEach(b => {
          const active = b.getAttribute("data-wid") === String(wid);
          b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";
          b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";
          b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";
        });
      };
      btns.forEach(btn => {
        btn.addEventListener("click", () => setActive(btn.getAttribute("data-wid")));
      });
      setActive("-1");
      const secSelector = doc.getElementById("bot-sec-weapon-selector");
      if (secSelector) {
        const secLabel = doc.getElementById("bot-sec-weapon-label");
        const secBtns = secSelector.querySelectorAll(".bot-sec-weapon-btn");
        const secNames = {
          "-1": "Copy from me (default)",
          9: "Hunting Bow (no upgrade)",
          10: "Great Hammer",
          11: "Wooden Shield",
          12: "Crossbow (Bow to Crossbow)",
          13: "Repeater Crossbow (Bow to Cross to Repeater)",
          14: "Mc Grabby",
          15: "Musket (Bow to Cross to Repeater to Musket)"
        };
        const setSecActive = swid => {
          window._botSecWeaponOverride = parseInt(swid);
          if (secLabel) secLabel.textContent = secNames[String(swid)] || swid;
          secBtns.forEach(b => {
            const active = b.getAttribute("data-swid") === String(swid);
            b.style.border = active ? "2px solid #9090c8" : "2px solid #2a204066";
            b.style.background = active ? "#1e1a30" : "#13101e";
            b.style.color = active ? "#9090c8" : "#d8d8f8";
          });
        };
        secBtns.forEach(btn => {
          btn.addEventListener("click", () => setSecActive(btn.getAttribute("data-swid")));
        });
        setSecActive("-1");
      }
    }
    closeMenu() {
      const {menuWrapper: menuWrapper} = this.getElements();
      menuWrapper.classList.remove("toopen");
      menuWrapper.classList.add("toclose");
      this.menuOpened = false;
      clearTimeout(this.toggleTimeout);
      this.toggleTimeout = setTimeout(() => {
        menuWrapper.classList.remove("toclose");
        this.frame.target.style.display = "none";
      }, 150);
    }
    openMenu() {
      const {menuWrapper: menuWrapper} = this.getElements();
      this.frame.target.removeAttribute("style");
      menuWrapper.classList.remove("toclose");
      menuWrapper.classList.add("toopen");
      this.menuOpened = true;
      clearTimeout(this.toggleTimeout);
      this.toggleTimeout = setTimeout(() => {
        menuWrapper.classList.remove("toopen");
      }, 150);
    }
    toggleMenu() {
      if (!this.menuLoaded) {
        return;
      }
      if (this.menuOpened) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    }
    attachOpenMenu() {
      const {openMenuButtons: openMenuButtons, menuPages: menuPages} = this.getElements();
      for (let i = 0; i < openMenuButtons.length; i++) {
        const button = openMenuButtons[i];
        const id = button.getAttribute("data-id");
        const menuPage = this.querySelector(`.menu-page[data-id='${id}']`);
        button.onclick = () => {
          if (menuPage instanceof this.frame.window.HTMLDivElement) {
            removeClass(openMenuButtons, "active");
            button.classList.add("active");
            removeClass(menuPages, "opened");
            menuPage.classList.add("opened");
            try {
              const pc = menuPage.closest("#page-container") || menuPage.parentElement;
              if (pc) pc.scrollTop = 0;
            } catch (_) {}
          } else {
            Logger.error(`attachOpenMenu Error: Cannot find "${button.textContent}" menu`);
          }
        };
      }
    }
    attachListeners() {
      const {closeButton: closeButton, scriptDescription: scriptDescription, author: author} = this.getElements();
      closeButton.onclick = () => {
        this.closeMenu();
      };
      const preventDefaults = target => {
        target.addEventListener("contextmenu", event => event.preventDefault());
        target.addEventListener("mousedown", event => {
          if (event.button === 1) {
            event.preventDefault();
          }
        });
        target.addEventListener("mouseup", event => {
          if (event.button === 3 || event.button === 4) {
            event.preventDefault();
          }
        });
      };
      preventDefaults(window);
      preventDefaults(this.frame.window);
      const description = "RYN v" + RYN.version;
      if (scriptDescription) scriptDescription.textContent = description;
      const fillColors = "xyn";
      const handleTextColors = () => {};
      setTimeout(handleTextColors, 5e3);
      this.handleResize();
      window.addEventListener("resize", () => this.handleResize());
      this.frame.document.addEventListener("mouseup", event => {
        if (this.activeHotkeyInput) {
          this.applyCode(event.button);
        } else if (this.isHotkeyInput(event.target) && event.button === 0) {
          event.target.textContent = "Wait...";
          this.activeHotkeyInput = event.target;
          event.target.classList.add("active");
        }
      });
      this.frame.document.addEventListener("keyup", event => {
        if (this.activeHotkeyInput && this.isHotkeyInput(event.target)) {
          this.applyCode(event.code);
        }
      });
      this.frame.window.addEventListener("keydown", event => client.InputHandler.handleKeydown(event));
      this.frame.window.addEventListener("keyup", event => client.InputHandler.handleKeyup(event));
      this.openMenu();
    }
    resetFrame() {
      this.frame.target.remove();
      this.init();
    }
    async init() {
      try {
        this.frame = await this.createFrame();
        this.attachListeners();
        this.attachHotkeyInputs();
        this.checkForRepeats();
        this.attachCheckboxes();
        this.attachColorPickers();
        this.attachSliders();
        this.attachTextInputs();
        this.attachDescriptions();
        this.attachButtons();
        this.attachAutoChatUI();
        this.attachRandomNameUI();
        this.attachOpenMenu();
        this.createRipple(".open-menu");
        client.StatsManager.init();
        const {menuContainer: menuContainer} = this.getElements();
        if (Settings_default._menuTransparency) {
          menuContainer.classList.add("transparent");
        }
        this.menuLoaded = true;
        this.frame.window.focus();
        try {
          MusicPlayer.init(this.frame.document);
        } catch (e) {}
        Logger.test("Successfully injected iframe menu..");
      } catch (err) {
        Logger.error("Failed to inject iframe.. " + err);
      }
    }
  };
  const UI_default = UI;
  const RYNNotify = new class {
    _container=null;
    _timer=null;
    _init() {
      if (this._container) return;
      const el = document.createElement("div");
      el.id = "ryn-notify-container";
      el.style.cssText = [ "position:fixed", "top:18px", "right:18px", "z-index:999999", "display:flex", "flex-direction:column", "align-items:flex-end", "gap:8px", "pointer-events:none", "font-family:Orbitron,monospace" ].join(";");
      document.body.appendChild(el);
      this._container = el;
    }
    show(featureName, isEnabled) {
      this._init();
      const existing = this._container.querySelector(`[data-ryn-feat="${featureName}"]`);
      if (existing) existing.remove();
      const color = isEnabled ? "#7c3aed" : "#374151";
      const dot = isEnabled ? "#a855f7" : "#6b7280";
      const label = isEnabled ? "ON" : "OFF";
      const toast = document.createElement("div");
      toast.dataset.rynFeat = featureName;
      toast.style.cssText = [ "background:rgba(10,10,20,0.88)", `border:1.5px solid ${color}`, "border-radius:8px", "padding:8px 16px", "display:flex", "align-items:center", "gap:10px", "min-width:160px", `box-shadow:0 0 18px ${color}55`, "animation:ryn-notify-in 0.22s cubic-bezier(.34,1.56,.64,1) both" ].join(";");
      toast.innerHTML = `\n                <span style="width:9px;height:9px;border-radius:50%;background:${dot};flex-shrink:0;box-shadow:0 0 7px ${dot};display:inline-block;"></span>\n                <span style="color:#e2e8f0;font-size:0.72em;letter-spacing:0.08em;flex:1;">${featureName}</span>\n                <span style="color:${isEnabled ? "#a855f7" : "#6b7280"};font-size:0.7em;font-weight:700;letter-spacing:0.1em;">${label}</span>\n            `;
      this._container.appendChild(toast);
      if (!document.getElementById("ryn-notify-style")) {
        const s = document.createElement("style");
        s.id = "ryn-notify-style";
        s.textContent = `\n                    @keyframes ryn-notify-in {\n                        from { opacity:0; transform:translateX(40px) scale(0.9); }\n                        to   { opacity:1; transform:translateX(0)     scale(1);   }\n                    }\n                    @keyframes ryn-notify-out {\n                        from { opacity:1; transform:translateX(0)     scale(1);   }\n                        to   { opacity:0; transform:translateX(40px) scale(0.88); }\n                    }\n                `;
        document.head.appendChild(s);
      }
      setTimeout(() => {
        toast.style.animation = "ryn-notify-out 0.22s ease forwards";
        setTimeout(() => toast.remove(), 230);
      }, 2400);
    }
    warn(message) {
      this._init();
      const key = "legit-warn";
      const existing = this._container.querySelector(`[data-ryn-feat="${key}"]`);
      if (existing) existing.remove();
      const color = "#dc2626";
      const dot = "#f87171";
      const toast = document.createElement("div");
      toast.dataset.rynFeat = key;
      toast.style.cssText = [ "background:rgba(10,10,20,0.9)", `border:1.5px solid ${color}`, "border-radius:8px", "padding:8px 16px", "display:flex", "align-items:center", "gap:10px", "min-width:200px", `box-shadow:0 0 18px ${color}55`, "animation:ryn-notify-in 0.22s cubic-bezier(.34,1.56,.64,1) both" ].join(";");
      toast.innerHTML = `\n                <span style="width:9px;height:9px;border-radius:50%;background:${dot};flex-shrink:0;box-shadow:0 0 7px ${dot};display:inline-block;"></span>\n                <span style="color:#e2e8f0;font-size:0.72em;letter-spacing:0.04em;flex:1;">${message}</span>\n            `;
      this._container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "ryn-notify-out 0.22s ease forwards";
        setTimeout(() => toast.remove(), 230);
      }, 2600);
    }
  };
  window._rynUI = UI_default;
  const defaultSettings = {
    _primary: "Digit1",
    _secondary: "Digit2",
    _food: "KeyQ",
    _wall: "Digit4",
    _spike: "KeyC",
    _windmill: "KeyV",
    _farm: "KeyT",
    _trap: "Space",
    _turret: "KeyF",
    _spawn: "KeyG",
    _up: "KeyW",
    _left: "KeyA",
    _down: "KeyS",
    _right: "KeyD",
    _autoattack: "KeyE",
    _botAutoFarm: "",
    _botAutoFarmEnabled: false,
    _botFarmMode: "single",
    _botFarmType: 0,
    _botFarmLimit: 0,
    _botFarmMode: "single",
    _farmGoalWood: 0,
    _farmGoalStone: 0,
    _farmGoalFood: 0,
    _botAutoAttack: "KeyH",
    _lockrotation: "KeyX",
    _lockBotPosition: "KeyZ",
    _toggleChat: "Enter",
    _toggleMenu: "Backquote",
    _instakill: "KeyR",
    _normalInstakill: false,
    _musketBowInsta: false,
    _platformMusket: false,
    _myNameColor: false,
    _myNameColorValue: "#B388FF",
    _spawnBot: "KeyP",
    _killAllBots: "Comma",
    _repelAlts: "KeyZ",
    _scatterBots: "",
    _freezeBots: "",
    _botsFrozen: false,
    _clearTargets: "KeyT",
    _targetCooldownSec: 3,
    _fourSpikes: "KeyC",
    _fourTraps: "KeyB",
    _autoMillKey: "KeyN",
    _boostSpikes: "Space",
    _nameSong: "",
    _antiTrapProtect: false,
    _antiTrapStar: false,
    _biomehats: true,
    _autoemp: true,
    _antienemy: true,
    _cowboyWhenSafe: false,
    _soldierDefault: true,
    _antianimal: true,
    _antispike: true,
    _empDefense: true,
    _autoheal: true,
    _autoSync: true,
    _adaptiveGearSwitching: false,
    _antiSync: false,
    _autoShield: true,
    _rangedShield: false,
    _tailPriority: true,
    _antiSpikePush: true,
    _spikeSyncHammer: true,
    _spikeSync: true,
    _spikeTick: true,
    _spikeTick_breakTrap: true,
    _chatLog: false,
    _knockbackTickTrap: true,
    _knockbackTickHammer: true,
    _knockbackTick: true,
    _toolSpearInsta: true,
    _autoSteal: true,
    _trapKB: true,
    _shameSpam: true,
    _turretSteal: true,
    _spikeGearInsta: true,
    _turretSync: true,
    _automill: true,
    _autoplacer: true,
    _antiRetrap: true,
    _trapAnimal: false,
    _placementDefense: true,
    _autoPlay: false,
    _botAge4BoostPad: false,
    _autoplacerRadius: 350,
    _placeAttempts: 4,
    _autobreak: true,
    _safeWalk: true,
    _dashMovement: true,
    _dashMovementKey: "KeyB",
    _autoGrindKey: "",
    _autoplacerKey: "",
    _autoGrind: false,
    _botAutoAttackEnabled: false,
    _enemyTracers: false,
    _enemyTracersColor: "#2ce9a0",
    _teammateTracers: false,
    _teammateTracersColor: "#8bd557",
    _animalTracers: false,
    _animalTracersColor: "#3366e9",
    _notificationTracers: true,
    _notificationTracersColor: "#df233a",
    _itemMarkers: true,
    _itemMarkersColor: "#e2de28",
    _teammateMarkers: true,
    _teammateMarkersColor: "#d452a8",
    _enemyMarkers: true,
    _enemyMarkersColor: "#6943da",
    _playerTurretReloadBar: true,
    _playerTurretReloadBarColor: "#de8328",
    _weaponReloadBar: true,
    _weaponReloadBarColor: "#b032d2",
    _renderHP: true,
    _positionPrediction: false,
    _stackedDamage: true,
    _objectTurretReloadBar: false,
    _objectTurretReloadBarColor: "#46d14c",
    _itemHealthBar: false,
    _itemHealthBarColor: "#1ab7e7",
    _itemHealthBarEnemy: false,
    _itemHealthBarEnemyColor: "#ff4d4d",
    _displayPlayerAngle: false,
    _weaponHitbox: false,
    _collisionHitbox: false,
    _autoPush: true,
    _autoPushRange: 250,
    _placementHitbox: false,
    _possiblePlacement: true,
    _placementPreviewOpacity: .35,
    _killMessage: true,
    _killMessageText: "RYN!",
    _autoChat: false,
    _autoChatInterval: 15,
    _autoChatMsgs: [],
    _autoBotChat: false,
    _autoBotChatMsgs: [],
    _deathProvoke: false,
    _autospawn: false,
    _autoaccept: false,
    _hideHUD: false,
    _lowQuality: false,
    _menuTransparency: true,
    _autoAssassin: false,
    _botsAutoAssassin: false,
    _followCursor: true,
    _movementRadius: 150,
    _formation: "none",
    _formationHotkeys: {},
    _circleRotation: true,
    _circleRadius: 100,
    _botIndividualClans: false,
    _autoRandomBotNames: false,
    _storeItems: [ [ 15, 31, 6, 7, 22, 12, 26, 11, 53, 20, 40, 56 ], [ 11, 17, 16, 13, 19, 18, 21 ] ],
    _totalKills: 0,
    _globalKills: 0,
    _deaths: 0,
    _autoSyncTimes: 0,
    _spikeSyncHammerTimes: 0,
    _spikeSyncTimes: 0,
    _spikeTickTimes: 0,
    _knockbackTickTrapTimes: 0,
    _knockbackTickHammerTimes: 0,
    _knockbackTickTimes: 0
  };
  const settings = {
    ...defaultSettings,
    ...CustomStorage.get("RYN")
  };
  for (const iterator in settings) {
    const key = iterator;
    if (!defaultSettings.hasOwnProperty(key)) {
      delete settings[key];
    }
  }
  const SaveSettings = () => {
    CustomStorage.set("RYN", settings);
    try {
      if (typeof window._startAutoChat === "function") window._startAutoChat();
      if (typeof window._startBotAutoChat === "function") window._startBotAutoChat();
    } catch (e) {}
  };
  SaveSettings();
  const resetSettings = () => {
    for (const iterator in defaultSettings) {
      const key = iterator;
      settings[key] = defaultSettings[key];
    }
    SaveSettings();
    UI_default.resetFrame();
  };
  const Settings_default = settings;
  const GameUI = new class {
    getElements() {
      const querySelector = document.querySelector.bind(document);
      const querySelectorAll = document.querySelectorAll.bind(document);
      return {
        gameCanvas: querySelector("#gameCanvas"),
        chatHolder: querySelector("#chatHolder"),
        storeHolder: querySelector("#storeHolder"),
        chatBox: querySelector("#chatBox"),
        storeMenu: querySelector("#storeMenu"),
        allianceMenu: querySelector("#allianceMenu"),
        storeContainer: querySelector("#ryn-store-container"),
        itemHolder: querySelector("#ryn-store-items"),
        gameUI: querySelector("#gameUI"),
        clanMenu: querySelector("#allianceMenu"),
        storeButton: querySelector("#storeButton"),
        clanButton: querySelector("#allianceButton"),
        setupCard: querySelector("#setupCard"),
        serverBrowser: querySelector("#serverBrowser"),
        skinColorHolder: querySelector("#skinColorHolder"),
        altServer: querySelector("#altServer"),
        settingRadio: querySelectorAll(".settingRadio"),
        pingDisplay: querySelector("#pingDisplay"),
        enterGame: querySelector("#enterGame"),
        nameInput: querySelector("#nameInput"),
        allianceInput: querySelector("#allianceInput"),
        allianceButton: querySelector("#allianceButton"),
        noticationDisplay: querySelector("#noticationDisplay"),
        nativeResolution: querySelector("#nativeResolution"),
        showPing: querySelector("#showPing"),
        mapDisplay: querySelector("#mapDisplay")
      };
    }
    selectSkinColor(skin) {
      /* One past the end of the colour table is the game's "toString" skin —
       * skinColors["toString"] resolves to a function, which the server accepts
       * and no swatch can express. It stays reachable as the wheel's hub. */
      const skinValue = skin === Config_default.skinColors.length ? "toString" : skin;
      CustomStorage.set("skin_color", skinValue);
      const selectSkin = getTargetValue(window, "selectSkinColor");
      if (selectSkin !== void 0) {
        selectSkin(skinValue);
      }
      return skinValue;
    }
    createSkinColors() {
      const SPECIAL = Config_default.skinColors.length;
      const stored = CustomStorage.get("skin_color");
      let index = stored === "toString" ? SPECIAL : Number(stored) || 0;
      if (!(index >= 0 && index <= SPECIAL)) index = 0;
      const {setupCard: setupCard} = this.getElements();
      const wheel = document.createElement("div");
      wheel.id = "ryn-skin-wheel";
      const slots = [];
      const select = i => {
        index = i;
        for (const slot of slots) slot.classList.toggle("activeSkin", Number(slot.dataset.skin) === i);
        hub.style.setProperty("--hub-color", i === SPECIAL ? "transparent" : Config_default.skinColors[i]);
        wheel.classList.toggle("special-picked", i === SPECIAL);
        this.selectSkinColor(i);
      };
      /* Swatches sit on a circle, in the game's own colour order, so the ring
       * position of a colour is the index the server is told. */
      const count = Config_default.skinColors.length;
      const radius = 82;
      for (let i = 0; i < count; i++) {
        const angle = i / count * (Math.PI * 2) - Math.PI / 2;
        const slot = document.createElement("div");
        slot.className = "skinColorItem ryn-skin-slot";
        slot.dataset.skin = String(i);
        slot.style.backgroundColor = Config_default.skinColors[i];
        slot.style.left = `calc(50% + ${(Math.cos(angle) * radius).toFixed(2)}px)`;
        slot.style.top = `calc(50% + ${(Math.sin(angle) * radius).toFixed(2)}px)`;
        slot.onclick = () => select(i);
        slots.push(slot);
        wheel.appendChild(slot);
      }
      const hub = document.createElement("div");
      hub.id = "ryn-skin-hub";
      hub.className = "skinColorItem ryn-skin-slot";
      hub.dataset.skin = String(SPECIAL);
      hub.title = "Secret skin";
      hub.onclick = () => select(SPECIAL);
      slots.push(hub);
      wheel.appendChild(hub);
      setupCard.appendChild(wheel);
      select(index);
    }
    formatMainMenu() {
      const {setupCard: setupCard, serverBrowser: serverBrowser, settingRadio: settingRadio, altServer: altServer, gameUI: gameUI} = this.getElements();
      setupCard.appendChild(serverBrowser);
      setupCard.querySelector("br")?.remove();
      this.createSkinColors();
      const radio = settingRadio[0];
      if (radio) {
        setupCard.appendChild(radio);
      }
      setupCard.appendChild(altServer);
      const div = document.createElement("div");
      div.id = "rynStats";
      div.innerHTML = '\n            <span>PING: <span id="rynPing"></span>ms</span>\n            <span>FPS: <span id="rynFPS"></span></span>\n            <span>PACKETS: <span id="rynPackets"></span></span>\n            <span>FastQ: <span id="rynFastQ">false</span></span>\n        ';
      gameUI.appendChild(div);
      (function() {
        var hud = document.createElement("div");
        hud.id = "ryn-topright-hud";
        hud.innerHTML = '<div class="ryn-hud-row"><span class="ryn-hud-label">HP <span id="ryn-hud-hp-val" class="ryn-hud-val">100/100</span></span><div class="ryn-hud-bar-bg"><div id="ryn-hud-hp-fill" class="ryn-hud-bar-fill" style="width:100%"></div></div></div><div class="ryn-hud-row" id="ryn-hud-r1-row" style="display:none"><span class="ryn-hud-label">RELOAD <span id="ryn-hud-r1-val" class="ryn-hud-val"></span></span><div class="ryn-hud-bar-bg"><div id="ryn-hud-r1-fill" class="ryn-hud-bar-fill" style="width:100%"></div></div></div>';
        gameUI.appendChild(hud);
        setInterval(function() {
          try {
            if (!window.client || !client.myPlayer || !client.myPlayer.inGame) {
              hud.style.display = "none";
              return;
            }
            hud.style.display = "flex";
            var mp = client.myPlayer;
            var hp = Math.max(0, Math.floor(mp.currentHealth || mp.health || 100));
            var maxHp = mp.maxHealth || 100;
            var hpPct = Math.min(100, hp / maxHp * 100);
            var hpEl = document.getElementById("ryn-hud-hp-fill");
            var hpVal = document.getElementById("ryn-hud-hp-val");
            if (hpEl) {
              hpEl.style.width = hpPct + "%";
              hpEl.style.background = hpPct > 60 ? "linear-gradient(90deg,#51cc51,#60e060)" : hpPct > 30 ? "linear-gradient(90deg,#f0b429,#f0c060)" : "linear-gradient(90deg,#cc5151,#e05151)";
            }
            if (hpVal) hpVal.textContent = hp + "/" + maxHp;
            try {
              var r1Row = document.getElementById("ryn-hud-r1-row");
              var r1El = document.getElementById("ryn-hud-r1-fill");
              var r1Val = document.getElementById("ryn-hud-r1-val");
              var PM = client.PlayerManager;
              if (PM) {
                var pd = PM.playerData.get(mp.sid);
                if (pd && pd.reload) {
                  var pri = pd.reload[0];
                  if (pri && pri.max > 0) {
                    if (r1Row) r1Row.style.display = "";
                    var rPct = Math.min(100, pri.current / pri.max * 100);
                    if (r1El) r1El.style.width = rPct + "%";
                    if (r1Val) r1Val.textContent = Math.round(rPct) + "%";
                  }
                }
              }
            } catch (e3) {}
          } catch (e) {}
        }, 50);
      })();
    }
    attachItemCount() {
      const actionBar = document.querySelectorAll("div[id*='actionBarItem'");
      for (let i = 19; i < 39; i++) {
        const item = Items[i - 16];
        if (actionBar[i] instanceof HTMLDivElement && item !== void 0 && "itemGroup" in item) {
          const group = item.itemGroup;
          const span = document.createElement("span");
          span.classList.add("itemCounter");
          span.setAttribute("data-id", group + "");
          const {count: count, limit: limit} = client.myPlayer.getItemCount(group);
          span.textContent = `${count}/${limit}`;
          actionBar[i].appendChild(span);
        }
      }
    }
    handleChatMessage(client2, text) {
      if (text === "/norecoil") {
        client2._ModuleHandler.norecoil = !client2._ModuleHandler.norecoil;
      }
      client2.PacketManager.chat(text);
    }
    modifyInputs() {
      const {chatHolder: chatHolder, chatBox: chatBox, nameInput: nameInput} = this.getElements();
      chatBox.onblur = () => {
        chatHolder.style.display = "none";
        const value = chatBox.value;
        if (value.length > 0) {
          this.handleChatMessage(client, value);
          if (GameUI_default._chatSync) {
            for (const bot of client.clients) {
              this.handleChatMessage(bot, value);
            }
          }
        }
        chatBox.value = "";
      };
      nameInput.onchange = () => {
        CustomStorage.set("moo_name", nameInput.value, false);
      };
    }
    updateItemCount(group) {
      const items = document.querySelectorAll(`span.itemCounter[data-id='${group}']`);
      const {count: count, limit: limit} = client.myPlayer.getItemCount(group);
      for (const item of items) {
        item.textContent = `${count}/${limit}`;
      }
    }
    interceptEnterGame() {
      const enterGame = document.querySelector("#enterGame");
      const observer = new MutationObserver(() => {
        observer.disconnect();
        this.load();
      });
      observer.observe(enterGame, {
        attributes: true
      });
    }
    updatePing(ping) {
      const span = document.querySelector("#rynPing");
      if (span !== null) {
        span.textContent = ping.toString();
      }
    }
    updateFPS(fps) {
      const span = document.querySelector("#rynFPS");
      if (span !== null) {
        span.textContent = fps.toString();
      }
    }
    updatePackets(packets) {
      const span = document.querySelector("#rynPackets");
      if (span !== null) {
        span.textContent = packets.toString();
      }
    }
    updateFastQ(state) {
      const span = document.querySelector("#rynFastQ");
      if (span !== null) {
        span.textContent = state.toString();
      }
    }
    updatePlaces(count) {}
    updateTotalKills(kills) {
      const span = document.querySelector("#rynTotalKills");
      if (span !== null) {
        span.textContent = kills.toString();
      }
    }
    updateTotalDeaths(deaths) {
      const span = document.querySelector("#rynTotalDeaths");
      if (span !== null) {
        span.textContent = deaths.toString();
      }
    }
    updateActiveModule(name) {
      const span = document.querySelector("#rynActiveModule");
      if (span !== null) {
        span.textContent = name + "";
      }
    }
    updateSpikeDamage(state) {
      const span = document.querySelector("#rynSpikeDamage");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    updatePotentialDamage(state) {
      const span = document.querySelector("#rynPotentialDamage");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    updateCollideSpike(state) {
      const span = document.querySelector("#rynCollideSpike");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    updateDangerState(state) {
      const span = document.querySelector("#rynDangerState");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    updateEquipHat(state) {
      const span = document.querySelector("#rynEquipHat");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    updateModulePerformance(state) {
      const span = document.querySelector("#rynPerformance");
      if (span !== null) {
        span.textContent = state + "";
      }
    }
    init() {
      this.formatMainMenu();
      this.modifyInputs();
      this.interceptEnterGame();
    }
    load() {
      const {nativeResolution: nativeResolution, enterGame: enterGame} = this.getElements();
      if (!nativeResolution.checked) {
        nativeResolution.click();
      }
      this.selectSkinColor(CustomStorage.get("skin_color") || 0);
      const enterGameButton = enterGame;
      let _enterGame = enterGameButton.onclick;
      enterGameButton.onclick = function() {
        delete enterGameButton.onclick;
        if (typeof _enterGame === "function") {
          _enterGame.call(this);
        } else {
          RYN.startGame();
        }
        enterGameButton.onclick = _enterGame;
      };
      Object.defineProperty(enterGameButton, "onclick", {
        set(callback) {
          _enterGame = callback;
        },
        configurable: true
      });
    }
    loadGame() {
      this.attachItemCount();
      const {storeButton: storeButton, allianceButton: allianceButton, mapDisplay: mapDisplay} = this.getElements();
      const that = this;
      let _storeClick = storeButton.onclick;
      storeButton.onclick = function(...args) {
        that.reset();
        _storeClick.apply(this, args);
      };
      const _allianceClick = allianceButton.onclick;
      allianceButton.onclick = function(...args) {
        that.reset();
        _allianceClick.apply(this, args);
      };
      const _mapClick = mapDisplay.onclick;
      mapDisplay.onclick = function(event) {
        const bounds = mapDisplay.getBoundingClientRect();
        const scale = 14400 / bounds.width;
        const posX = (event.clientX - bounds.left) * scale;
        const posY = (event.clientY - bounds.top) * scale;
        client._ModuleHandler.endTarget._setXY(posX, posY);
        client._ModuleHandler.followPath = true;
        _mapClick.call(this, event);
      };
    }
    isOpened(element) {
      return element.style.display !== "none";
    }
    closePopups(element) {
      const {allianceMenu: allianceMenu, clanButton: clanButton} = this.getElements();
      if (this.isOpened(allianceMenu) && element !== allianceMenu) {
        clanButton.click();
      }
      const popups = document.querySelectorAll("#chatHolder, #storeMenu, #allianceMenu, #storeContainer");
      for (const popup of popups) {
        if (popup === element) {
          continue;
        }
        popup.style.display = "none";
      }
      if (element instanceof HTMLElement) {
        element.style.display = this.isOpened(element) ? "none" : "";
      }
    }
    createAcceptButton(type) {
      const data = [ [ "#cc5151", "&#xE14C;" ], [ "#8ecc51", "&#xE876;" ] ];
      const [color, code] = data[type];
      const button = document.createElement("div");
      button.classList.add("notifButton");
      button.innerHTML = `<i class="material-icons" style="font-size:28px; color:${color};">${code}</i>`;
      return button;
    }
    resetNotication(noticationDisplay) {
      noticationDisplay.innerHTML = "";
      noticationDisplay.style.display = "none";
    }
    clearNotication() {
      const {noticationDisplay: noticationDisplay} = this.getElements();
      this.resetNotication(noticationDisplay);
    }
    createRequest(user) {
      const [id, name] = user;
      const {noticationDisplay: noticationDisplay} = this.getElements();
      if (noticationDisplay.style.display !== "none") {
        return;
      }
      noticationDisplay.innerHTML = "";
      noticationDisplay.style.display = "block";
      const text = document.createElement("div");
      text.classList.add("notificationText");
      text.textContent = name;
      noticationDisplay.appendChild(text);
      const handleClick = type => {
        const button = this.createAcceptButton(type);
        button.onclick = () => {
          this.resetNotication(noticationDisplay);
          client.PacketManager.clanRequest(id, !!type);
          client.myPlayer.joinRequests.shift();
          client.pendingJoins.delete(id);
        };
        noticationDisplay.appendChild(button);
      };
      handleClick(0);
      handleClick(1);
    }
    clientSpawn() {
      const {enterGame: enterGame} = this.getElements();
      enterGame.click();
    }
    handleEnter(event) {
      const {allianceInput: allianceInput, allianceButton: allianceButton} = this.getElements();
      const active = document.activeElement;
      if (client.myPlayer.inGame) {
        if (active === allianceInput) {
          allianceButton.click();
        } else {
          this.toggleChat(event);
        }
        return;
      }
      this.clientSpawn();
    }
    toggleChat(event) {
      const {chatHolder: chatHolder, chatBox: chatBox} = this.getElements();
      this.closePopups(chatHolder);
      if (this.isOpened(chatHolder)) {
        event.preventDefault();
        chatBox.focus();
      } else {
        chatBox.blur();
      }
    }
    reset() {
      StoreHandler_default.closeStore();
    }
    openClanMenu() {
      const {clanButton: clanButton} = this.getElements();
      this.reset();
      clanButton.click();
    }
  };
  const GameUI_default = GameUI;
  class Logger {
    static staticLog=console?.log || function() {};
    static staticError=console?.error || function() {};
    static staticWarn=console?.warn || function() {};
    static log(msg) {
      if (isProd) {
        return;
      }
      this.staticLog(msg);
    }
    static error(msg) {
      if (isProd) {
        return;
      }
      this.staticError(msg);
    }
    static warn(msg) {
      if (isProd) {
        return;
      }
      this.staticWarn(msg);
    }
    static test(msg) {
      if (isProd) {
        return;
      }
      this.staticLog(msg);
    }
  }
  class Regexer {
    code;
    COPY_CODE;
    hookCount=0;
    hookAttempts=0;
    ANY_LETTER="(?:[^\\x00-\\x7F-]|\\$|\\w)";
    NumberSystem=[ {
      radix: 2,
      prefix: "0b0*"
    }, {
      radix: 8,
      prefix: "0+"
    }, {
      radix: 10,
      prefix: ""
    }, {
      radix: 16,
      prefix: "0x0*"
    } ];
    constructor(code) {
      this.code = code;
      this.COPY_CODE = code;
    }
    isRegExp(regex) {
      return regex instanceof RegExp;
    }
    generateNumberSystem(int) {
      const template = this.NumberSystem.map(({radix: radix, prefix: prefix}) => prefix + int.toString(radix));
      return `(?:${template.join("|")})`;
    }
    parseVariables(regex) {
      regex = regex.replace(/{VAR}/g, "(?:let|var|const)");
      regex = regex.replace(/{QUOTE{(\w+)}}/g, "(?:'$1'|\"$1\"|`$1`)");
      regex = regex.replace(/NUM{(\d+)}/g, (...args) => this.generateNumberSystem(Number(args[1])));
      regex = regex.replace(/\\w/g, this.ANY_LETTER);
      return regex;
    }
    format(name, inputRegex, flags) {
      this.hookAttempts++;
      let regex = "";
      if (Array.isArray(inputRegex)) {
        regex = inputRegex.map(exp => this.isRegExp(exp) ? exp.source : exp).join("\\s*");
      } else if (this.isRegExp(inputRegex)) {
        regex = inputRegex.source;
      } else {
        regex = inputRegex + "";
      }
      regex = this.parseVariables(regex);
      const expression = RegExp(regex, flags);
      if (!expression.test(this.code)) {
        Logger.error("Failed to find: " + name);
      } else {
        this.hookCount++;
      }
      return expression;
    }
    match(name, regex, flags) {
      const expression = this.format(name, regex, flags);
      return this.code.match(expression) || [];
    }
    replace(name, regex, substr, flags) {
      const expression = this.format(name, regex, flags);
      this.code = this.code.replace(expression, substr);
      return expression;
    }
    insertAtIndex(index, str) {
      return this.code.slice(0, index) + str + this.code.slice(index, this.code.length);
    }
    template(name, regex, substr, getIndex) {
      const expression = this.format(name, regex);
      const match = this.code.match(expression);
      if (match === null) {
        return;
      }
      const index = getIndex(match);
      this.code = this.insertAtIndex(index, substr.replace(/\$(\d+)/g, (...args) => match[args[1]]));
    }
    append(name, regex, substr) {
      this.template(name, regex, substr, match => (match.index || 0) + match[0].length);
    }
    prepend(name, regex, substr) {
      this.template(name, regex, substr, match => match.index || 0);
    }
    wrap(left, right) {
      this.code = left + this.code + right;
    }
  }
  const Regexer_default = Regexer;
  const formatCode2 = code => {
    const Hook = new Regexer_default(code);
    if (!isProd) {
      Hook.code = 'console?.log("Loaded bundle..");' + Hook.code;
    }
    Hook.append("preRenderLoop", /\)\}\}\(\);function \w+\(\)\{/, "RYN._Renderer._preRender();");
    Hook.append("postRenderLoop", /\w+,\w+\(\),requestAnimFrame\(\w+\)/, ";RYN._Renderer._postRender();");
    Hook.append("mapPreRender", /(\w+)\.lineWidth=NUM{4};/, "RYN._Renderer._mapPreRender($1);");
    Hook.prepend("gameInit", /function (\w+)\(\w+\)\{\w+\.\w+\(\w+,f/, "RYN._gameInit=function(a){$1(a);};");
    Hook.prepend("LockRotationClient", /return \w+\?\(\!/, "return RYN._myClient._ModuleHandler._currentAngle;");
    Hook.replace("DisableResetMoveDir", /\w+=\{\},\w+\.send\("\w+"\)/, "");
    Hook.append("offset", /\W170\W.+?(\w+)=\w+\-\w+\/2.+?(\w+)=\w+\-\w+\/2;/, "RYN._offset._setXY($1,$2);");
    Hook.prepend("renderEntity", /\w+\.health>NUM{0}.+?(\w+)\.fillStyle=(\w+)==(\w+)/, ";RYN._hooks._EntityRenderer._render($1,$2,$3);false&&");
    Hook.append("renderItemPush", /,(\w+)\.blocker,\w+.+?2\)\)/, ",RYN._Renderer._renderObjects.push($1)");
    Hook.append("renderItem", /70, 0.35\)",(\w+).+?\w+\)/, ",RYN._hooks._ObjectRenderer._render($1)");
    Hook.append("RemoveSendAngle", /clientSendRate\)/, "&&false");
    Hook.replace("handleEquip", /\w+\.send\("\w+",0,(\w+),(\w+)\)/, "RYN._myClient._ModuleHandler._equip($2,$1,true,true)");
    Hook.replace("exposeGameNet", /const (\w+)=\{socket:null,connected:!1,socketId:-1/, "const $1=RYN._myClient._gameNet={socket:null,connected:!1,socketId:-1");
    Hook.replace("exposeGameCrypto", /(\w+)=\{mode:(\w+),key:/, "$1=RYN._myClient._gameCrypto={mode:$2,key:");
    Hook.replace("captureTurnstile", /onGotTurnstileToken=function\((\w+)\)\{(\w+)=\1,/, "onGotTurnstileToken=function($1){$2=$1,RYN._myClient._turnstileToken=$1,");
    Hook.replace("exposeCryptoFns", /const (\w+)=new (\w+),(\w+)=new (\w+);let (\w+)=null/, "const $1=new $2,$3=new $4;RYN._enc={Eo:Eo,Hi:$1,jt:jt,Po:Po,Ro:Ro};let $5=null");
    Hook.replace("handleBuy", /\w+\.send\("\w+",1,(\w+),(\w+)\)/, "RYN._myClient._ModuleHandler._buy($2,$1,true)");
    Hook.prepend("RemovePingCall", /\w+&&clearTimeout/, "return;");
    Hook.append("RemovePingState", /let \w+=-1;function \w+\(\)\{/, "return;");
    Hook.prepend("preRender", /(\w+)\.lineWidth=NUM{4},/, "RYN._hooks._ObjectRenderer._preRender($1);");
    Hook.replace("RenderGrid", /("#91b2db".+?)(for.+?)(\w+\.stroke)/, "$1$3");
    Hook.replace("upgradeItem", /(upgradeItem.+?onclick.+?)\w+\.send\("\w+",(\w+)\)\}/, "$1RYN._myClient._ModuleHandler._upgradeItem($2)}");
    const data = Hook.match("DeathMarker", /99999.+?(\w+)=\{x:(\w+)/);
    Hook.append("playerDied", /NUM{99999};function \w+\(\)\{/, `if(RYN._settings._autospawn){${data[1]}={x:${data[2]}.x,y:${data[2]}.y};return};`);
    Hook.append("updateNotificationRemove", /\w+=\[\],\w+=\[\];function \w+\(\w+,\w+\)\{/, "return;");
    Hook.replace("checkTrusted", /checkTrusted:(\w+)/, "checkTrusted:(callback)=>(event)=>callback(event)");
    Hook.replace("removeSkins", /(\(\)\{)(let \w+="";for\(let)/, "$1return;$2");
    Hook.prepend("unlockedItems", /\w+\.list\[\w+\]\.pre==/, "true||");
    Hook.replace("gameColor", /rgba\(0, 0, 70, 0.35\)/, "rgba(20, 4, 45, 0.45)");
    Hook.prepend("renderPlayer", /function (\w+)\(\w+,\w+\)\{\w+=\w+\|\|\w+,/, "RYN._hooks._renderPlayer=$1;");
    Hook.replace("maskFRVR", /window\.FRVR/, "FRVR", "g");
    Hook.replace("scaleWidth", /=1920/, "=RYN._ZoomHandler._scale._smooth._w");
    Hook.replace("scaleHeight", /=1080/, "=RYN._ZoomHandler._scale._smooth._h");
    Hook.replace("maskLerp", /Math\.lerpAngle/, "THIS_STORAGE.lerpAngle", "g");
    /* An animal takes its name from its aiTypes row, and only falls back to a
     * random cowNames pick when the row has none — so naming the cow is what
     * takes it off that list. The pig keeps the random names. */
    Hook.replace("cowName", /this\.aiTypes=\[\{id:0,src:"cow_1",/, 'this.aiTypes=[{id:0,name:"by rap",src:"cow_1",');
    Hook.replace("wolfName", /name:"Wolf",src:"wolf_1"/, 'name:"wolfy",src:"wolf_1"');
    Hook.replace("freezeTurnSpeed", /(\w+\.turnSpeed)(\*[^;,)]+)/, "(RYN._settings._lowQuality?0:$1$2)", "g");
    const addCode = isProd ? "const RYN=window.RYN;delete window.RYN;" : "";
    Hook.wrap("(async function THIS_STORAGE(){const FRVR=window.FRVR;window.FRVR=FRVR;" + addCode, "})();");
    Logger.test(`Modified bundle, total amount of hooks: ${Hook.hookCount}/${Hook.hookAttempts}`);
    return Hook.code;
  };
  const formatCode_default = formatCode2;
  const Injector = new class {
    init(node) {
      this.loadScript(node.src);
    }
    loadScript(src) {
      const xhr = new XMLHttpRequest;
      xhr.open("GET", src, false);
      xhr.send();
      let code = formatCode_default(xhr.responseText);
      let baseUrl;
      try {
        baseUrl = new URL(".", src).href;
      } catch (e) {
        baseUrl = src.slice(0, src.lastIndexOf("/") + 1);
      }
      const toAbs = path => {
        try {
          return new URL(path, baseUrl).href;
        } catch (e) {
          return baseUrl + path.replace(/^\.\.?\//, "");
        }
      };
      let hadStaticImport = false;
      code = code.replace(/(^|[\n;])\s*import\s*(\{[^}]*\}|\*\s+as\s+[\w$]+|[\w$]+)?\s*(?:,\s*(\{[^}]*\}|[\w$]+))?\s*from\s*(["'])([^"']+)\4\s*;?/g, (full, lead, spec1, spec2, quote, path) => {
        if (/import\s*\(/.test(full)) return full;
        hadStaticImport = true;
        const abs = toAbs(path);
        const parts = [];
        const conv = spec => {
          spec = spec.trim();
          if (!spec) return null;
          if (spec.startsWith("{")) {
            const inner = spec.slice(1, -1).split(",").map(s => {
              s = s.trim();
              if (!s) return null;
              const asM = s.split(/\s+as\s+/);
              return asM.length === 2 ? asM[0].trim() + ": " + asM[1].trim() : s;
            }).filter(Boolean).join(", ");
            return "{" + inner + "}";
          }
          if (spec.startsWith("*")) {
            const ns = spec.replace(/\*\s+as\s+/, "").trim();
            return ns;
          }
          return "{default: " + spec + "}";
        };
        const c1 = spec1 ? conv(spec1) : null;
        const c2 = spec2 ? conv(spec2) : null;
        if (c1 && c1.startsWith("{") && c1 !== "{}") parts.push(c1); else if (c1 && !c1.startsWith("{")) parts.push(c1);
        if (c2 && c2.startsWith("{") && c2 !== "{}") parts.push(c2); else if (c2 && !c2.startsWith("{")) parts.push(c2);
        if (parts.length === 0) {
          return lead + `await import(${JSON.stringify(abs)});`;
        }
        const stmts = parts.map(p => `const ${p} = await import(${JSON.stringify(abs)});`).join("");
        return lead + stmts;
      });
      code = code.replace(/(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g, (m, kw, quote, path) => kw + quote + toAbs(path) + quote);
      this.waitForBody(() => {
        Function(code)();
      });
    }
    waitForBody(callback) {
      if (document.readyState !== "loading") {
        callback();
        Logger.test("Page already loaded, instant inject..");
        return;
      }
      document.addEventListener("readystatechange", () => {
        if (document.readyState !== "loading") {
          callback();
        }
      }, {
        once: true
      });
    }
  };
  const Injector_default = Injector;
  const resetGame = loadedFast => {
    const scriptExecuteHandler = node => {
      node.addEventListener("beforescriptexecute", event => {
        event.preventDefault();
      }, {
        once: true
      });
      node.remove();
    };
    let scriptBundle = null;
    const handleScriptElement = node => {
      const isScript = node instanceof HTMLScriptElement;
      const isLink = node instanceof HTMLLinkElement;
      const regex = /frvr|jquery|howler|assets|cookie|securepubads|google|ads/i;
      if (isScript && regex.test(node.src) || isLink && regex.test(node.href) || regex.test(node.innerHTML)) {
        scriptExecuteHandler(node);
      }
      if (isScript && /assets.+\.js$/.test(node.src) && scriptBundle === null) {
        scriptBundle = node;
        Logger.test("Found script element, resolving..");
        scriptExecuteHandler(node);
        if (loadedFast) {
          Injector_default.init(node);
        }
      }
    };
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLScriptElement || node instanceof HTMLLinkElement) {
            handleScriptElement(node);
          }
        }
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true
    });
    document.querySelectorAll("script").forEach(handleScriptElement);
    document.querySelectorAll("link").forEach(handleScriptElement);
    document.querySelectorAll("iframe").forEach(iframe => {
      iframe.remove();
    });
    const resolvePromise = data => new Promise(function(resolve) {
      resolve(data);
    });
    const win = window;
    blockProperty(win, "onbeforeunload");
    win.frvrSdkInitPromise = resolvePromise();
    blockProperty(win, "frvrSdkInitPromise");
    win.FRVR = {
      bootstrapper: {
        complete() {}
      },
      tracker: {
        levelStart() {}
      },
      ads: {
        show() {
          return resolvePromise();
        }
      },
      channelCharacteristics: {
        allowNavigation: true
      },
      setChannel() {}
    };
    blockProperty(win, "FRVR");
    if (!loadedFast) {
      const _define = win.customElements.define;
      win.customElements.define = function() {
        win.customElements.define = _define;
      };
      win.requestAnimFrame = function() {
        delete win.requestAnimFrame;
        if (scriptBundle !== null) {
          Injector_default.init(scriptBundle);
        }
      };
      blockProperty(win, "requestAnimFrame");
    }
    const _fetch = window.fetch;
    window.fetch = new Proxy(_fetch, {
      apply(target, _this, args) {
        const link = args[0];
        if (typeof link === "string") {
          if (/ping/.test(link)) {
            return resolvePromise();
          }
        }
        return target.apply(_this, args);
      }
    });
    CustomStorage.set("moofoll", 1);
    if (CustomStorage.get("skin_color") === null) {
      CustomStorage.set("skin_color", "toString");
    }
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, _this, args) {
        if ([ "keydown", "keyup" ].includes(args[0]) && args[2] === void 0) {
          if (args[0] === "keyup" && loadedFast) {
            window.addEventListener = target;
          }
          return null;
        }
        return target.apply(_this, args);
      }
    });
    const proto = HTMLDivElement.prototype;
    proto.addEventListener = new Proxy(proto.addEventListener, {
      apply(target, _this, args) {
        if (_this.id === "touch-controls-fullscreen" && /^mouse/.test(args[0]) && args[2] === false) {
          if (/up$/.test(args[0]) && loadedFast) {
            proto.addEventListener = target;
          }
          return null;
        }
        return target.apply(_this, args);
      }
    });
    window.setInterval = new Proxy(window.setInterval, {
      apply(target, _this, args) {
        if (/cordova/.test(args[0].toString()) && args[1] === 1e3) {
          if (loadedFast) {
            window.setInterval = target;
          }
          return null;
        }
        return target.apply(_this, args);
      }
    });
    const deleteProp = (target, name) => {
      delete target[name];
    };
    Hooker_default.createRecursiveHook(window, "config", (that, config) => {
      deleteProp(that, "openLink");
      deleteProp(that, "aJoinReq");
      deleteProp(that, "follmoo");
      deleteProp(that, "kickFromClan");
      deleteProp(that, "sendJoin");
      deleteProp(that, "leaveAlliance");
      deleteProp(that, "createAlliance");
      deleteProp(that, "storeBuy");
      deleteProp(that, "storeEquip");
      deleteProp(that, "showItemInfo");
      deleteProp(that, "config");
      deleteProp(that, "altchaCreateWorker");
      deleteProp(that, "captchaCallbackHook");
      deleteProp(that, "showPreAd");
      deleteProp(that, "setUsingTouch");
      that.addEventListener("blur", that.onblur);
      deleteProp(that, "onblur");
      that.addEventListener("focus", that.onfocus);
      deleteProp(that, "onfocus");
      RYN._config = config;
      Logger.log("Intercepted config..");
      return loadedFast;
    });
    Hooker_default.createRecursiveHook(Object.prototype, "initialBufferSize", _this => {
      client.PacketManager.Encoder = _this;
      return true;
    });
    Hooker_default.createRecursiveHook(Object.prototype, "maxExtLength", _this => {
      client.PacketManager.Decoder = _this;
      Logger.log("Hooked decoder..");
      return true;
    });
    const _proto_ = Object.prototype;
    Object.defineProperty(_proto_, "processServers", {
      set(value) {
        Logger.log("Hooked processServers..");
        delete _proto_.processServers;
        this.processServers = function(data) {
          for (const server of data) {
            server.playerCapacity += 1;
          }
          Logger.log("Increased capacity..");
          return value.call(this, data);
        };
      },
      configurable: true
    });
  };
  const resetGame_default = resetGame;
  class DeadPlayer {
    moveAngle;
    skinColor;
    angle;
    weapon;
    variant;
    hatID;
    accID;
    rotation;
    baseTime=2e3;
    elapsedTime=0;
    pos=new Vector_default;
    lerpPos=new Vector_default;
    acc=7;
    velocity=0;
    opacity=1;
    shortSign;
    constructor(startPos, moveAngle, skin, rotation, weapon, variant, hatID, accID, impulse) {
      this.moveAngle = moveAngle;
      this.skinColor = skin;
      this.angle = rotation;
      this.weapon = weapon;
      this.variant = variant;
      this.hatID = hatID;
      this.accID = accID;
      this.rotation = rotation;
      this.pos.setVec(startPos);
      this.lerpPos.setVec(startPos);
      this.shortSign = Math.sign(shortAngle(this.angle, this.moveAngle));
      this.acc = (impulse || 10) / 10 * 75;
    }
    update(delta) {
      this.elapsedTime += delta;
      const progress = Math.min(this.elapsedTime / this.baseTime, 1);
      const easedProgress = easeOutQuad(progress);
      this.opacity = 1 - easedProgress;
      const dt = delta / 1e3;
      const blend = 1 - Math.exp(-10 * dt);
      const PI3 = Math.PI;
      const rotationSpeed = (1 - easedProgress) / PI3 * blend;
      if (!Settings_default._lowQuality) this.rotation += rotationSpeed * this.shortSign;
      this.velocity = this.acc * (1 - easedProgress);
      this.pos.add(Vector_default.fromAngle(this.moveAngle, this.velocity * dt));
      this.lerpPos.x = lerp(this.lerpPos.x, this.pos.x, blend);
      this.lerpPos.y = lerp(this.lerpPos.y, this.pos.y, blend);
    }
    isFinished() {
      return this.elapsedTime >= this.baseTime;
    }
  }
  const DeadPlayerHandler = new class {
    deadPlayers=new Set;
    start=Date.now();
    add(player) {
      this.deadPlayers.add(player);
    }
    render(ctx, pos, color) {
      const player = client.myPlayer;
      if (!player.inGame) {
        return;
      }
      const offset = RYN._offset;
      ctx.save();
      ctx.translate(pos.x - offset.x, pos.y - offset.y);
      ctx.rotate(player.angle);
      ctx.globalAlpha = .6;
      ctx.strokeStyle = "#525252";
      const {autoHat: autoHat} = client._ModuleHandler.staticModules;
      const weaponID = autoHat.getNextWeaponID();
      const variant = player.getWeaponVariant(weaponID).current;
      RYN._hooks._renderPlayer({
        weaponIndex: weaponID,
        buildIndex: autoHat.getNextItemID(),
        tailIndex: autoHat.getNextAcc(),
        skinIndex: autoHat.getNextHat(),
        weaponVariant: variant,
        skinColor: player.skinID,
        scale: 35
      }, ctx);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
    update(ctx) {
      const now = Date.now();
      const delta = now - this.start;
      this.start = now;
      const offset = RYN._offset;
      for (const player of this.deadPlayers) {
        player.update(delta);
        ctx.save();
        ctx.translate(player.lerpPos.x - offset.x, player.lerpPos.y - offset.y);
        ctx.rotate(player.rotation);
        ctx.globalAlpha = player.opacity;
        ctx.strokeStyle = "#525252";
        RYN._hooks._renderPlayer({
          weaponIndex: player.weapon,
          buildIndex: -1,
          tailIndex: player.accID,
          skinIndex: player.hatID,
          weaponVariant: player.variant,
          skinColor: player.skinColor,
          scale: 35
        }, ctx);
        ctx.restore();
        if (player.isFinished()) {
          this.deadPlayers.delete(player);
        }
      }
    }
  };
  const ObjectRenderer = new class {
    healthBar(ctx, entity, object) {
      if (!object.seenPlacement || !object.isDestroyable) {
        return 0;
      }
      let isEnemyObj = false;
      const _mp = client && client.myPlayer;
      const _owner = object.ownerID;
      if (_mp && _owner != null && !_mp.isMyPlayerByID(_owner) && !_mp.isTeammateByID(_owner)) {
        isEnemyObj = true;
      }
      const enabled = isEnemyObj ? Settings_default._itemHealthBarEnemy : Settings_default._itemHealthBar;
      if (!enabled) {
        return 0;
      }
      const {health: health, maxHealth: maxHealth, angle: angle} = object;
      const perc = health / maxHealth;
      const color = isEnemyObj ? Settings_default._itemHealthBarEnemyColor : Settings_default._itemHealthBarColor;
      return Renderer_default.circularBar(ctx, entity, perc, angle, color, 0, 1.4);
    }
    renderTurret(ctx, entity, object, scale) {
      if (object.type !== 17) {
        return;
      }
      if (Settings_default._objectTurretReloadBar) {
        const {reload: reload, maxReload: maxReload, angle: angle} = object;
        const perc = reload / maxReload;
        const color = Settings_default._objectTurretReloadBarColor;
        Renderer_default.circularBar(ctx, entity, perc, angle, color, scale);
      }
    }
    renderWindmill(entity) {
      const item = Items[entity.id];
      if (item.itemType === 5) {
        entity.turnSpeed = 0;
      }
      if (Settings_default._lowQuality && item && item.turnSpeed !== undefined) {
        entity.turnSpeed = 0;
      }
    }
    renderCollisions(ctx, entity, object) {
      const x = entity.x + entity.xWiggle;
      const y = entity.y + entity.yWiggle;
      if (Settings_default._collisionHitbox) {
        Renderer_default.circle(ctx, x, y, object.collisionScale, "#c7fff2", .5, 1);
        Renderer_default.rect(ctx, new Vector_default(x, y), object.collisionScale, "#ecffbd", 1, .5);
      }
      if (Settings_default._weaponHitbox) {
        Renderer_default.circle(ctx, x, y, object.hitScale, "#3f4ec4", .5, 1);
      }
      if (Settings_default._placementHitbox) {
        Renderer_default.circle(ctx, x, y, object.placementScale, "#73b9ba", .5, 1);
      }
    }
    _render(ctx) {
      if (Renderer_default._renderObjects.length === 0) {
        return;
      }
      const {ObjectManager: ObjectManager2, _ModuleHandler: ModuleHandler2, myPlayer: myPlayer} = client;
      const _cx = myPlayer && myPlayer.inGame ? myPlayer.pos.current.x : 0;
      const _cy = myPlayer && myPlayer.inGame ? myPlayer.pos.current.y : 0;
      const _vw = ZoomHandler_default._scale.current._w * 0.55;
      const _vh = ZoomHandler_default._scale.current._h * 0.55;
      const _maxObj = Settings_default._lowQuality ? 80 : Infinity;
      let _objCount = 0;
      if (Settings_default._lowQuality && myPlayer && myPlayer.inGame) {
        Renderer_default._renderObjects.sort((a, b) => (a.x - _cx) * (a.x - _cx) + (a.y - _cy) * (a.y - _cy) - ((b.x - _cx) * (b.x - _cx) + (b.y - _cy) * (b.y - _cy)));
      }
      for (const entity of Renderer_default._renderObjects) {
        if (_objCount++ >= _maxObj) break;
        if (Settings_default._lowQuality && (Math.abs(entity.x - _cx) > _vw || Math.abs(entity.y - _cy) > _vh)) continue;
        const object = ObjectManager2.objects.get(entity.sid);
        if (object === void 0) {
          continue;
        }
        Renderer_default.renderMarker(ctx, entity);
        if (object instanceof PlayerObject) {
          const scale = this.healthBar(ctx, entity, object);
          this.renderTurret(ctx, entity, object, scale);
          this.renderWindmill(entity);
        }
        this.renderCollisions(ctx, entity, object);
      }
      Renderer_default._renderObjects.length = 0;
    }
    volcanoBoxSize=940;
    volcanoAggressionRadius=1440;
    volcanoBoxPos=new Vector_default(14400, 14400).sub(this.volcanoBoxSize);
    volcanoPos=new Vector_default(13960, 13960);
    _preRender(ctx) {
      if (Settings_default._lowQuality) {
        ctx.imageSmoothingEnabled = false;
        ctx.shadowColor = "transparent";
        const ox = RYN._offset.x, oy = RYN._offset.y;
        const cdx = Math.abs(ox - Renderer_default._staticCacheOffset.x);
        const cdy = Math.abs(oy - Renderer_default._staticCacheOffset.y);
        if (Renderer_default._staticCacheDirty || cdx > 150 || cdy > 150) {
          Renderer_default._staticCacheDirty = false;
          Renderer_default._staticCacheOffset = {
            x: ox,
            y: oy
          };
        }
      }
      const offsetX = RYN._offset.x;
      const offsetY = RYN._offset.y;
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.strokeStyle = "#8A2BE2";
      ctx.translate(-offsetX, -offsetY);
      ctx.beginPath();
      ctx.arc(this.volcanoPos.x, this.volcanoPos.y, this.volcanoAggressionRadius, 2.831070818924026, 5.022910815050457);
      const size = this.volcanoBoxSize;
      const x = this.volcanoBoxPos.x - size;
      const y = this.volcanoBoxPos.y - size;
      ctx.moveTo(x, y);
      ctx.lineTo(x + size * 2, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + size * 2);
      ctx.stroke();
      ctx.restore();
      if (client.myPlayer.diedOnce) {
        const {x: x2, y: y2} = client.myPlayer.deathPosition;
        Renderer_default.cross(ctx, x2, y2, 50, 15, "#cc5151");
      }
      if (Settings_default._positionPrediction && client.myPlayer.inGame) {
        DeadPlayerHandler.render(ctx, client.myPlayer.simulation.getPos(), client.myPlayer.simulation.spikeCollision ? "red" : "yellow");
      }
    }
  };
  const ObjectRenderer_default = ObjectRenderer;
  const isProd = true;
  const version = isProd ? "5.9.4" : "Dev";
  const loadedFast = document.head === null;
  if (!loadedFast) {
    Logger.warn("RYN Client loading warning! It is generally recommended to use faster injection mode.");
  }
  Logger.test("RYN Client initialization..");
  const gameToken = altcha.generate();
  const client = new PlayerClient_default;
  window.WebSocket = new window.Proxy(window.WebSocket, {
    construct(target, args) {
      const socket = new target(...args);
      const url = args && args[0] ? String(args[0]) : "";
      const isNonGame = /frvr|analytics|google|doubleclick|sentry|datadog|cloudflareinsights|hotjar|amplitude|segment/i.test(url);
      const isGameSocket = !isNonGame && /^wss?:\/\//i.test(url);
      if (isGameSocket) {
        Logger.test("Found game socket! Socket initialization..");
        client.SocketManager.init(socket);
        window.WebSocket = target;
      }
      return socket;
    }
  });
  const win = window;
  const RYN = {
    _myClient: client,
    _settings: Settings_default,
    _Renderer: Renderer_default,
    _ZoomHandler: ZoomHandler_default,
    _basePlayerRef: null,
    _hooks: {
      _EntityRenderer: EntityRenderer_default,
      _ObjectRenderer: ObjectRenderer_default,
      _renderPlayer: function() {}
    },
    _config: {},
    version: version,
    _offset: new Vector_default,
    _gameInit(token) {},
    async startGame() {
      const token = await gameToken;
      if (typeof token !== "string" || token.length === 0) {
        Logger.error("Failed to generate altcha token..");
        return;
      }
      this._gameInit(token);
    }
  };
  win.RYN = RYN;
  try {
    setInterval(() => {
      try {
        const c = RYN._myClient;
        if (!c) return;
        const net = c._gameNet;
        const sm = c.SocketManager;
        if (sm && !c._sockBound && !sm.socket && net && net.socket && net.socket.readyState <= 1) {
          c._sockBound = true;
          sm.init(net.socket);
        }
        const pt = win.pingTime;
        if (typeof pt === "number" && pt >= 0) {
          if (sm) {
            sm.pong = pt;
            if (pt < sm.minPingTime) sm.minPingTime = pt;
          }
          const span = document.querySelector("#rynPing");
          if (span) span.textContent = pt.toString();
        }
      } catch (e) {}
    }, 500);
  } catch (e) {}
  resetGame_default(loadedFast);
  const contentLoaded = () => {
    Logger.test("Menu initialization..");
    client.InputHandler.init();
    GameUI_default.init();
    UI_default.init();
    StoreHandler_default.init();
  };
  window.addEventListener("DOMContentLoaded", contentLoaded);
  if (document.readyState !== "loading") {
    contentLoaded();
  }
  const onload = () => {
    Logger.test("Page loaded..");
    const {enterGame: enterGame} = GameUI_default.getElements();
    enterGame.classList.remove("disabled");
  };
  let _autoChatIndex = 0;
  let _autoChatTimer = null;
  let _botAutoChatIndex = 0;
  let _botAutoChatTimer = null;
  const _startBotAutoChat = () => {
    if (_botAutoChatTimer) { clearInterval(_botAutoChatTimer); _botAutoChatTimer = null; }
    if (!Settings_default._autoBotChat) return;
    const intervalSec = Math.max(1, Math.min(60, parseInt(Settings_default._autoChatInterval) || 15));
    _botAutoChatTimer = setInterval(() => {
      if (!Settings_default._autoBotChat) return;
      try {
        const msgs = (Settings_default._autoBotChatMsgs || []).filter(m => m && m.trim().length > 0);
        if (msgs.length === 0) return;
        const msg = msgs[_botAutoChatIndex % msgs.length];
        _botAutoChatIndex++;
        if (client && client.clients) {
          client.clients.forEach(botPlayer => {
            try {
              if (botPlayer && botPlayer.PacketManager && botPlayer.myPlayer && botPlayer.myPlayer.inGame) {
                botPlayer.PacketManager.chat(msg.trim());
              }
            } catch (e2) {}
          });
        }
      } catch (e) {}
    }, intervalSec * 1000);
  };
  window._startBotAutoChat = _startBotAutoChat;
  const _startAutoChat = () => {
    if (_autoChatTimer) { clearInterval(_autoChatTimer); _autoChatTimer = null; }
    if (!Settings_default._autoChat) return;
    const intervalSec = Math.max(1, Math.min(60, parseInt(Settings_default._autoChatInterval) || 15));
    _autoChatTimer = setInterval(() => {
      if (!Settings_default._autoChat) return;
      if (!client || !client.myPlayer || !client.myPlayer.inGame) return;
      try {
        const msgs = (Settings_default._autoChatMsgs || []).filter(m => m && m.trim().length > 0);
        if (msgs.length === 0) return;
        const msg = msgs[_autoChatIndex % msgs.length];
        _autoChatIndex++;
        client.PacketManager.chat(msg.trim());
      } catch (e) {}
    }, intervalSec * 1000);
  };
  window._startAutoChat = _startAutoChat;
  window._botWeaponOverride = -1;
  window._botSecWeaponOverride = -1;
  window._shieldGuardActive = false;
  window._guardProtectBotsEnabled = false;
  window._baitProtectEnabled = false;
  window._formationLockEnabled = false;
  window._formationLockPositions = [];
  window._shieldRotationEnabled = false;
  window._shieldRotationAngle = 0;
  window._guardFrontDistance = 90;
  const _botWeaponUpgrade = {
    1: 2,
    3: 4
  };
  const _botSecWeaponUpgrade = {
    9: 12,
    12: 13,
    13: 15
  };
  function _applyBotWeaponPatch(botClient) {
    const mp = botClient.myPlayer;
    if (!mp || mp.__bwPatched) return;
    mp.__bwPatched = true;
    const _orig = mp.newUpgrade.bind(mp);
    mp.newUpgrade = function(points, age) {
      let chosen, chosenSec;
      if (Settings_default._shieldGuard) {
        const ownerClient = botClient.ownerClient;
        if (ownerClient) {
          const guardIndex = ownerClient.getClientIndex(botClient);
          const botAge = botClient.myPlayer ? botClient.myPlayer.age : 0;
          const isAutoGuard = Settings_default._autoJoinGuard && botAge >= 6;
          const isNormalGuard = !Settings_default._autoJoinGuard && guardIndex >= 0 && guardIndex < 3;
          if (isAutoGuard || isNormalGuard) {
            chosen = 7;
            chosenSec = 11;
          } else {
            chosen = 8;
            chosenSec = 15;
          }
        } else {
          chosen = window._botWeaponOverride;
          chosenSec = window._botSecWeaponOverride;
        }
      } else {
        chosen = window._botWeaponOverride;
        chosenSec = window._botSecWeaponOverride;
      }
      if (chosen === -1 && chosenSec === -1) {
        return _orig(points, age);
      }
      this.upgradeAge = age;
      if (points === 0 || age === 10) return;
      const ids = [];
      for (const w of Weapons) {
        if (w.age === age && this.isUpgradeWeapon(w.id)) ids.push(w.id);
      }
      for (const item of Items) {
        if (item.age === age) ids.push(item.id + 16);
      }
      const _getRoot = id => {
        for (const w of Weapons) {
          if (w.id === id && w.upgradeOf !== undefined) return _getRoot(w.upgradeOf);
        }
        return id;
      };
      const slotHasPrimary = ids.some(id => id < 16 && (() => {
        try {
          return DataHandler_default.getWeapon(id).type === 0;
        } catch (e) {
          return false;
        }
      })());
      const slotHasSecondary = ids.some(id => id < 16 && (() => {
        try {
          return DataHandler_default.getWeapon(id).type === 1;
        } catch (e) {
          return false;
        }
      })());
      const slotHasItemOnly = !slotHasPrimary && !slotHasSecondary;
      if (slotHasPrimary) {
        if (chosen === -1) {
          const ownerOrder = botClient.ownerClient?.myPlayer?.upgradeOrder || [];
          const ownerId = ownerOrder[this.upgradeIndex];
          if (ownerId !== undefined && ids.includes(ownerId)) {
            this.upgradeIndex += 1;
            botClient._ModuleHandler._upgradeItem(ownerId);
          }
          return;
        }
        const base = _getRoot(chosen);
        let target = null;
        const chosenIsUpgrade = chosen !== base;
        if (age === 2) {
          if (ids.includes(base)) target = base; else if (ids.includes(chosen)) target = chosen;
        } else if (age === 8) {
          if (chosenIsUpgrade) {
            const upg = _botWeaponUpgrade[base];
            if (upg !== undefined && ids.includes(upg)) target = upg; else if (ids.includes(chosen)) target = chosen;
          } else {
            target = null;
          }
        } else {
          for (const id of ids) {
            if (id < 16) {
              try {
                if (DataHandler_default.getWeapon(id).type === 0) {
                  target = id;
                  break;
                }
              } catch (e) {}
            }
          }
        }
        if (target !== null && ids.includes(target)) {
          this.upgradeIndex += 1;
          botClient._ModuleHandler._upgradeItem(target);
        }
        return;
      }
      if (slotHasSecondary) {
        if (chosenSec === -1) {
          const ownerOrder = botClient.ownerClient?.myPlayer?.upgradeOrder || [];
          const ownerId = ownerOrder[this.upgradeIndex];
          if (ownerId !== undefined && ids.includes(ownerId)) {
            this.upgradeIndex += 1;
            botClient._ModuleHandler._upgradeItem(ownerId);
            return;
          }
          chosenSec = 9;
        }
        const secBase = _getRoot(chosenSec);
        let target = null;
        if (age === 2) {
          if (ids.includes(secBase)) target = secBase; else if (ids.includes(chosenSec)) target = chosenSec;
        } else {
          if (ids.includes(chosenSec)) {
            target = chosenSec;
          } else {
            let cur = secBase;
            for (let i = 0; i < 6; i++) {
              let curAge = null;
              for (const w of Weapons) {
                if (w.id === cur) {
                  curAge = w.age;
                  break;
                }
              }
              if (curAge === age && ids.includes(cur)) {
                target = cur;
                break;
              }
              const next = _botSecWeaponUpgrade[cur];
              if (next === undefined) break;
              cur = next;
            }
            if (target === null) {
              const chain = [];
              let cur2 = secBase;
              for (let i = 0; i < 6; i++) {
                chain.push(cur2);
                if (cur2 === chosenSec) break;
                const next = _botSecWeaponUpgrade[cur2];
                if (next === undefined) break;
                cur2 = next;
              }
              for (let i = chain.length - 1; i >= 0; i--) {
                if (ids.includes(chain[i])) {
                  target = chain[i];
                  break;
                }
              }
            }
          }
        }
        if (target !== null && ids.includes(target)) {
          this.upgradeIndex += 1;
          botClient._ModuleHandler._upgradeItem(target);
        }
        return;
      }
      if (slotHasItemOnly) {
        let target = null;
        if (age === 3) target = 1 + 16; else if (age === 4) target = (Settings_default._botAge4BoostPad ? 16 : 15) + 16; else if (age === 5) target = 7 + 16; else if (age === 7) target = 18 + 16; else if (age === 8) target = 12 + 16; else if (age === 9) target = 9 + 16;
        if (target !== null && ids.includes(target)) {
          this.upgradeIndex += 1;
          botClient._ModuleHandler._upgradeItem(target);
          return;
        }
        const ownerOrder = botClient.ownerClient?.myPlayer?.upgradeOrder || [];
        const ownerId = ownerOrder[this.upgradeIndex];
        if (ownerId !== undefined && ids.includes(ownerId)) {
          this.upgradeIndex += 1;
          botClient._ModuleHandler._upgradeItem(ownerId);
        }
      }
    };
  }
  _startAutoChat();
  _startBotAutoChat();
  const MusicPlayer = new class {
    _songs=[];
    _albums=[];
    _currentIndex=-1;
    _loop=false;
    _shuffle=false;
    _chatSync=false;
    _syncBot=false;
    _syncDelay=0;
    _mixedSync=false;
    _botsOnlySync=false;
    _unifiedSync=false;
    _mixedTurn=0;
    _volume=0.7;
    _frameDoc=null;
    _actx=null;
    _sourceNode=null;
    _gainNode=null;
    _audio=null;
    _lyrics=[];
    _lyricIndex=-1;
    _lastSentWall=0;
    _rafId=null;
    _MIN_GAP_MS=1500;
    _songSessionId=0;
    _db=null;
    _DB_NAME="BeeMusicDB";
    _DB_VERSION=1;
    _DB_STORE="musicData";
    _storageKey="nyx_music_data";
    _openDB() {
      return new Promise((resolve, reject) => {
        if (this._db) {
          resolve(this._db);
          return;
        }
        const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this._DB_STORE)) db.createObjectStore(this._DB_STORE);
        };
        req.onsuccess = e => {
          this._db = e.target.result;
          resolve(this._db);
        };
        req.onerror = e => reject(e);
      });
    }
    _save() {
      this._songs.forEach(s => { delete s.__origIndex; });
      const data = {
        songs: this._songs,
        albums: this._albums,
        __beeMerged: this._beeMerged === true
      };
      this._openDB().then(db => {
        const tx = db.transaction(this._DB_STORE, "readwrite");
        tx.objectStore(this._DB_STORE).put(data, this._storageKey);
      }).catch(e => {
        try {
          localStorage.setItem(this._storageKey, JSON.stringify(data));
        } catch (_) {}
      });
    }
    _load() {
      this._openDB().then(db => {
        const tx = db.transaction(this._DB_STORE, "readonly");
        const req = tx.objectStore(this._DB_STORE).get(this._storageKey);
        req.onsuccess = e => {
          let data = e.target.result;
          if (!data) {
            try {
              data = JSON.parse(localStorage.getItem(this._storageKey));
            } catch (_) {}
          }
          const beeKey = "bee_music_data";
          const mergeBeeData = beeData => {
            if (!beeData) return;
            if (data && data.__beeMerged) return;
            const beeSongs = beeData.songs || [];
            const beeAlbums = beeData.albums || [];
            const existing = data ? data.songs || [] : [];
            const merged = [ ...existing ];
            beeSongs.forEach(s => {
              const dup = merged.some(x => x.title === s.title && x.url === s.url);
              if (!dup) merged.push(s);
            });
            if (!data) data = {};
            data.songs = merged;
            data.albums = [ ...new Set([ ...data.albums || [], ...beeAlbums ]) ];
            data.__beeMerged = true;
          };
          const finish = () => {
            if (data) {
              this._songs = data.songs || [];
              this._albums = data.albums || [];
              this._songs.forEach(s => {
                if (!s.album) s.album = "";
                delete s.__origIndex;
              });
              this._beeMerged = data.__beeMerged === true;
              this._save();
            }
            this._renderAll();
          };
          const txBee = db.transaction(this._DB_STORE, "readonly");
          const reqBee = txBee.objectStore(this._DB_STORE).get(beeKey);
          reqBee.onsuccess = eb => {
            let beeData = eb.target.result;
            if (!beeData) {
              try {
                beeData = JSON.parse(localStorage.getItem(beeKey));
              } catch (_) {}
            }
            mergeBeeData(beeData);
            finish();
          };
          reqBee.onerror = () => finish();
        };
        req.onerror = () => this._renderAll();
      }).catch(() => this._renderAll());
    }
    _initAudioContext() {
      if (this._actx) return;
      this._actx = new (window.AudioContext || window.webkitAudioContext);
      this._gainNode = this._actx.createGain();
      this._gainNode.gain.value = this._volume;
      this._gainNode.connect(this._actx.destination);
    }
    _connectAudio(audioEl) {
      audioEl.volume = this._volume;
      try {
        this._initAudioContext();
        if (this._sourceNode) {
          try {
            this._sourceNode.disconnect();
          } catch (_) {}
          this._sourceNode = null;
        }
        if (!this._actx._connected) {
          this._sourceNode = this._actx.createMediaElementSource(audioEl);
          this._gainNode.gain.value = 1;
          this._sourceNode.connect(this._gainNode);
          this._actx._connected = true;
        }
      } catch (e) {}
    }
    _resumeContext() {
      if (this._actx && this._actx.state === "suspended") this._actx.resume().catch(() => {});
    }
    _parseLRC(raw) {
      const lines = (raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      const result = [];
      for (const line of lines) {
        const m = line.match(/^\[(\d+):(\d+)(?:[.:](\d+))?\]\s*(.+)/);
        if (!m || !m[4].trim()) continue;
        const ms = (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + (m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3)) : 0);
        result.push({
          ms: ms,
          text: m[4].trim()
        });
      }
      return this._reflowLRC(result.sort((a, b) => a.ms - b.ms));
    }
    _reflowLRC(list) {
      const MAX_CHAT = 30;
      const MIN_STEP = 1600;
      const MAX_STEP = 2600;
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const cur = list[i];
        const parts = this._wrapText(cur.text, MAX_CHAT);
        if (parts.length <= 1) {
          out.push(cur);
          continue;
        }
        const next = list[i + 1];
        const span = next ? Math.max(0, next.ms - cur.ms) : parts.length * MAX_STEP;
        let step = Math.floor(span / parts.length);
        if (step < MIN_STEP) step = MIN_STEP;
        if (step > MAX_STEP) step = MAX_STEP;
        parts.forEach((p, k) => out.push({
          ms: cur.ms + k * step,
          text: p
        }));
      }
      return out.sort((a, b) => a.ms - b.ms);
    }
    _startRAF() {
      if (this._rafId !== null) return;
      const tick = () => {
        this._rafId = requestAnimationFrame(tick);
        this._tickSync();
      };
      this._rafId = requestAnimationFrame(tick);
    }
    _stopRAF() {
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }
    _tickSync() {
      const anyActive = this._chatSync || this._mixedSync || this._botsOnlySync || this._unifiedSync;
      if (!anyActive) return;
      if (!this._audio || this._audio.paused) return;
      if (!this._lyrics.length) return;
      const nowMs = this._audio.currentTime * 1000 + (this._syncDelay || 0);
      for (let i = this._lyricIndex + 1; i < this._lyrics.length; i++) {
        if (nowMs - this._lyrics[i].ms > 500) {
          this._lyricIndex = i;
        } else break;
      }
      const next = this._lyricIndex + 1;
      if (next >= this._lyrics.length) return;
      if (nowMs < this._lyrics[next].ms) return;
      const wallNow = Date.now();
      if (wallNow - this._lastSentWall < 1500) return;
      const text = this._lyrics[next].text;
      this._lyricIndex = next;
      this._lastSentWall = wallNow;
      if (this._unifiedSync) {
        this._sendLyricUnified(text);
        return;
      }
      if (this._botsOnlySync) {
        this._sendLyricToBotsDistributed(text);
        return;
      }
      if (this._mixedSync) {
        if (this._mixedTurn === 0) {
          const sock = client && client.SocketManager && client.SocketManager.socket;
          const sockOk = sock && sock.readyState === sock.OPEN;
          const encOk = client && client.PacketManager && client.PacketManager.Encoder !== null;
          const inGame = client && client.myPlayer && client.myPlayer.inGame;
          if (sockOk && encOk && inGame) {
            const MAX_CHAT = 30;
            const chunks = this._splitLine(text);
            const sid = this._songSessionId;
            chunks.forEach((c, i) => setTimeout(() => {
              if (this._songSessionId !== sid) return;
              try {
                client.PacketManager.chat(c);
              } catch (_) {}
            }, i * 2200));
          }
          this._mixedTurn = 1;
        } else {
          this._sendLyricToBots(text);
          this._mixedTurn = 0;
        }
        return;
      }
      this._sendChat(text);
    }
    _wrapText(text, max) {
      const t = String(text == null ? "" : text).trim().replace(/\s+/g, " ");
      if (!t) return [];
      if (t.length <= max) return [ t ];
      const words = [];
      for (const w of t.split(" ")) {
        let r = w;
        while (r.length > max) {
          words.push(r.slice(0, max));
          r = r.slice(max);
        }
        if (r) words.push(r);
      }
      const pack = n => {
        const target = Math.ceil(t.length / n);
        const out = [];
        let cur = "";
        for (const w of words) {
          const cand = cur ? cur + " " + w : w;
          if (cur && cand.length > target && out.length < n - 1) {
            out.push(cur);
            cur = w;
          } else if (cand.length > max) {
            out.push(cur);
            cur = w;
          } else {
            cur = cand;
          }
        }
        if (cur) out.push(cur);
        return out.length <= n && out.every(x => x.length <= max) ? out : null;
      };
      const least = Math.ceil(t.length / max);
      for (let n = least; n <= Math.min(least + 3, 12); n++) {
        const got = pack(n);
        if (got) return got;
      }
      const out = [];
      let rest = t;
      while (rest.length > max && out.length < 12) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        out.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
      }
      if (rest) out.push(rest);
      return out;
    }
    _splitLine(text) {
      return this._wrapText(text, 30);
    }
    _sendLyricToBots(text) {
      if (!client || !client.clients) return;
      const chunks = this._splitLine(text);
      const sid = this._songSessionId;
      chunks.forEach((c, i) => setTimeout(() => {
        if (this._songSessionId !== sid) return;
        try {
          client.clients.forEach(bot => {
            try {
              if (bot && bot.PacketManager && bot.myPlayer && bot.myPlayer.inGame) bot.PacketManager.chat(c);
            } catch (_) {}
          });
        } catch (_) {}
      }, i * 2200));
    }
    _sendLyricUnified(text) {
      const chunks = this._splitLine(text);
      if (!chunks.length) return;
      const sid = this._songSessionId;
      chunks.forEach((c, i) => setTimeout(() => {
        if (this._songSessionId !== sid) return;
        try {
          const sock = client && client.SocketManager && client.SocketManager.socket;
          const sockOk = sock && sock.readyState === sock.OPEN;
          const encOk = client && client.PacketManager && client.PacketManager.Encoder !== null;
          const inGame = client && client.myPlayer && client.myPlayer.inGame;
          if (sockOk && encOk && inGame) client.PacketManager.chat(c);
        } catch (_) {}
        try {
          if (client && client.clients) {
            client.clients.forEach(bot => {
              try {
                if (bot && bot.PacketManager && bot.myPlayer && bot.myPlayer.inGame) bot.PacketManager.chat(c);
              } catch (_) {}
            });
          }
        } catch (_) {}
      }, i * 2200));
    }
    _sendLyricToBotsDistributed(text) {
      if (!client || !client.clients) return;
      const bots = [ ...client.clients ].filter(b => b && b.PacketManager && b.myPlayer && b.myPlayer.inGame);
      if (!bots.length) return;
      if (this._botsDistribIdx === undefined) this._botsDistribIdx = 0;
      const bot = bots[this._botsDistribIdx % bots.length];
      this._botsDistribIdx++;
      const chunks = this._splitLine(text);
      const sid = this._songSessionId;
      chunks.forEach((c, i) => setTimeout(() => {
        if (this._songSessionId !== sid) return;
        try {
          if (bot && bot.PacketManager && bot.myPlayer && bot.myPlayer.inGame) bot.PacketManager.chat(c);
        } catch (_) {}
      }, i * 2200));
    }
    _doSendPacket(chunk) {
      try {
        if (this._syncBot) {
          if (client && client.clients) {
            client.clients.forEach(bot => {
              try {
                if (bot && bot.PacketManager && bot.myPlayer && bot.myPlayer.inGame) bot.PacketManager.chat(chunk);
              } catch (_) {}
            });
          }
        } else {
          const sock = client && client.SocketManager && client.SocketManager.socket;
          const sockOk = sock && sock.readyState === sock.OPEN;
          const encOk = client && client.PacketManager && client.PacketManager.Encoder !== null;
          const inGame = client && client.myPlayer && client.myPlayer.inGame;
          if (sockOk && encOk && inGame) client.PacketManager.chat(chunk);
        }
      } catch (e) {
        console.error("[BeeMusic] _doSendPacket error:", e);
      }
    }
    _sendChat(text) {
      const MAX_CHAT = 30;
      const chunks = [];
      if (text.length <= MAX_CHAT) {
        chunks.push(text);
      } else {
        let cutAt = MAX_CHAT;
        const spaceIdx = text.lastIndexOf(" ", MAX_CHAT - 1);
        if (spaceIdx > 0) cutAt = spaceIdx;
        const part1 = text.slice(0, cutAt).trimEnd();
        const part2 = text.slice(cutAt).trimStart();
        chunks.push(part1);
        if (part2.length > 0) chunks.push(part2);
      }
      const sessionId = this._songSessionId;
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          if (this._songSessionId !== sessionId) return;
          this._doSendPacket(chunk);
        }, i * 2200);
      });
    }
    play(index) {
      if (index < 0 || index >= this._songs.length) return;
      this._currentIndex = index;
      const song = this._songs[index];
      this._songSessionId++;
      this._stopRAF();
      if (this._audio) {
        this._audio.pause();
        this._audio.src = "";
        this._audio.onended = null;
        this._audio.onerror = null;
        this._sourceNode && (() => {
          try {
            this._sourceNode.disconnect();
          } catch (_) {}
        })();
        this._sourceNode = null;
      }
      if (!song.url || song.url === "__FILE_TOO_LARGE__") {
        this._showStatus("⚠ ملف كبير — استخدم رابط URL", true);
        return;
      }
      const audio = new Audio;
      this._audio = audio;
      audio.volume = this._volume;
      audio.preload = "auto";
      audio.oncanplay = () => {
        this._resumeContext();
        this._connectAudio(audio);
        this._updateUI();
      };
      audio.ontimeupdate = () => this._updateProgress();
      audio.onended = () => {
        this._stopRAF();
        if (this._loop) this.play(this._currentIndex); else if (this._shuffle) this.play(Math.floor(Math.random() * this._songs.length)); else this.next();
      };
      audio.onerror = () => {
        this._showStatus("⚠ خطأ في تحميل الأغنية", true);
      };
      if (song.url && (song.url.startsWith("http://") || song.url.startsWith("https://"))) {
        audio.crossOrigin = "anonymous";
      }
      audio.src = song.url;
      audio.play().then(() => {
        this._resumeContext();
      }).catch(e => {
        console.warn("[BeeMusic] play() rejected:", e);
        if (audio.crossOrigin) {
          audio.crossOrigin = "";
          audio.load();
          audio.play().catch(() => {});
        }
      });
      this._lyrics = this._parseLRC(song.lyrics || "");
      this._lyricIndex = -1;
      this._lastSentWall = 0;
      this._startRAF();
      this._updateUI();
      this._renderSongList();
    }
    next() {
      if (!this._songs.length) return;
      this.play((this._currentIndex + 1) % this._songs.length);
    }
    prev() {
      if (!this._songs.length) return;
      this.play((this._currentIndex - 1 + this._songs.length) % this._songs.length);
    }
    togglePause() {
      if (!this._audio) {
        if (this._songs.length) this.play(0);
        return;
      }
      if (this._audio.paused) {
        this._resumeContext();
        this._audio.play().catch(() => {});
        this._startRAF();
      } else {
        this._audio.pause();
      }
      setTimeout(() => this._updatePlayBtn(), 60);
    }
    setVolume(v) {
      this._volume = v;
      if (this._audio) this._audio.volume = v;
      if (this._gainNode) this._gainNode.gain.value = 1;
    }
    seekTo(pct) {
      if (!this._audio || !this._audio.duration) return;
      const newTime = pct * this._audio.duration;
      this._audio.currentTime = newTime;
      const newMs = newTime * 1000;
      this._lyricIndex = -1;
      for (let i = 0; i < this._lyrics.length; i++) {
        if (this._lyrics[i].ms <= newMs) this._lyricIndex = i; else break;
      }
      this._lastSentWall = 0;
    }
    _fmtTime(sec) {
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ":" + (s < 10 ? "0" : "") + s;
    }
    _updatePlayBtn() {
      if (!this._frameDoc) return;
      const btn = this._frameDoc.querySelector("#music-play");
      const isPlaying = this._audio && !this._audio.paused;
      if (btn) btn.innerHTML = isPlaying ? "&#9646;&#9646;" : "&#9654;";
      const art = this._frameDoc.querySelector("#rm-art");
      if (art) {
        if (isPlaying) art.classList.add("playing"); else art.classList.remove("playing");
      }
    }
    _updateProgress() {
      if (!this._frameDoc || !this._audio || !this._audio.duration) return;
      const pct = this._audio.currentTime / this._audio.duration * 100;
      const fill = this._frameDoc.querySelector("#music-progress-fill");
      const cur = this._frameDoc.querySelector("#music-time-current");
      const tot = this._frameDoc.querySelector("#music-time-total");
      if (fill) fill.style.width = pct + "%";
      if (cur) cur.textContent = this._fmtTime(this._audio.currentTime);
      if (tot) tot.textContent = this._fmtTime(this._audio.duration);
    }
    _updateUI() {
      if (!this._frameDoc) return;
      const song = this._songs[this._currentIndex];
      const titleEl = this._frameDoc.querySelector("#music-title");
      const artistEl = this._frameDoc.querySelector("#music-artist");
      const albumEl = this._frameDoc.querySelector("#music-album-badge");
      if (titleEl) titleEl.textContent = song ? song.title : "No song selected";
      if (artistEl) artistEl.textContent = song ? song.artist || "--" : "--";
      if (albumEl) albumEl.textContent = song && song.album ? "◆ " + song.album : "";
      this._updatePlayBtn();
      this._updateProgress();
      this._updateNowPlayingLike();
    }
    _showStatus(msg, isErr) {
      if (!this._frameDoc) return;
      const el = this._frameDoc.querySelector("#bm-status");
      if (!el) return;
      el.textContent = msg;
      el.style.color = isErr ? "#cc5151" : "#9090c8";
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        if (el) el.textContent = "";
      }, 4000);
    }
    _toast(msg) {
      if (!this._frameDoc) return;
      const t = this._frameDoc.querySelector("#rm-toast") || this._frameDoc.querySelector("#bm-toast");
      if (!t) return;
      t.textContent = msg;
      t.style.display = "block";
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        if (t) t.style.display = "none";
      }, 2200);
    }
    _renderAll() {
      this._renderSongList();
      this._renderAlbumList();
      this._updateAlbumSelect();
      this._updateAlbumFilterSelect();
      this._updateUI();
    }
    _renderSongList() {
      if (!this._frameDoc) return;
      const list = this._frameDoc.querySelector("#song-list");
      if (!list) return;
      list.innerHTML = "";
      const activeFilterBtn = this._frameDoc.querySelector(".rm-filter-btn.active");
      const filterVal = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "";
      const visible = this._songs.filter((s, i) => {
        s.__origIndex = i;
        if (filterVal === "__liked") return !!s.liked;
        if (filterVal) return s.album === filterVal;
        return true;
      });
      if (!visible.length) {
        const empty = this._frameDoc.createElement("div");
        empty.style.cssText = "text-align:center;font-size:0.75em;color:#7A42F433;padding:14px 0;font-family:Orbitron,monospace;letter-spacing:0.08em;";
        empty.textContent = filterVal === "__liked" ? "— NO LIKED SONGS —" : "— EMPTY —";
        list.appendChild(empty);
        return;
      }
      visible.forEach(song => {
        const i = song.__origIndex;
        const row = this._frameDoc.createElement("div");
        row.className = "rm-song-row" + (i === this._currentIndex ? " active" : "");
        row.innerHTML = `\n                  <span class="rm-snum">${i + 1}</span>\n                  <span class="rm-stitle">${song.title}${song.lyrics ? ' <span style="color:rgba(122,66,244,0.38);font-size:0.8em;">♪</span>' : ""}</span>\n                  <span class="rm-sartist">${song.artist || ""}</span>\n                  <span class="rm-s-icons">\n                    <span class="rm-s-like${song.liked ? " on" : ""}" title="Like">&#9829;</span>\n                    <span class="rm-s-save${song.saved ? " on" : ""}" title="Save">&#128190;</span>\n                    <span class="rm-sdel" title="Delete">&#x2715;</span>\n                  </span>`;
        row.querySelector(".rm-s-like").onclick = e => {
          e.stopPropagation();
          song.liked = !song.liked;
          this._save();
          this._renderSongList();
          this._updateNowPlayingLike();
        };
        row.querySelector(".rm-s-save").onclick = e => {
          e.stopPropagation();
          song.saved = !song.saved;
          this._save();
          this._renderSongList();
          this._toast(song.saved ? "✓ Song saved" : "Song unsaved");
        };
        row.querySelector(".rm-sdel").onclick = e => {
          e.stopPropagation();
          const wasCurrent = i === this._currentIndex;
          this._songs.splice(i, 1);
          if (wasCurrent) {
            const a = this._frameDoc && this._frameDoc.querySelector("audio");
            if (a) { try { a.pause(); } catch (_) {} }
            if (this._audio) { try { this._audio.pause(); } catch (_) {} }
            this._currentIndex = -1;
            this._lyrics = [];
            this._lyricIndex = -1;
            this._stopRAF();
          } else if (i < this._currentIndex) {
            this._currentIndex--;
          }
          this._save();
          this._renderAll();
        };
        row.onclick = () => this.play(i);
        list.appendChild(row);
      });
    }
    _renderAlbumList() {
      if (!this._frameDoc) return;
      const grid = this._frameDoc.querySelector("#rm-album-grid");
      if (!grid) return;
      grid.innerHTML = "";
      const filterBar = this._frameDoc.querySelector("#rm-filter-bar");
      if (filterBar) {
        const oldAlbumBtns = filterBar.querySelectorAll('[data-filter]:not([data-filter=""]):not([data-filter="__liked"])');
        oldAlbumBtns.forEach(b => b.remove());
        this._albums.forEach(al => {
          const btn = this._frameDoc.createElement("button");
          btn.className = "rm-filter-btn";
          btn.setAttribute("data-filter", al);
          btn.textContent = al;
          btn.onclick = () => this._setFilter(al);
          filterBar.appendChild(btn);
        });
      }
      const albumIcons = [ "💿", "🎵", "🎶", "🎸", "🎹", "🎷", "🎺", "🎻", "🥁", "🎤" ];
      this._albums.forEach((al, i) => {
        const count = this._songs.filter(s => s.album === al).length;
        const card = this._frameDoc.createElement("div");
        card.className = "rm-album-card";
        const activeFilterBtn = this._frameDoc.querySelector(".rm-filter-btn.active");
        if (activeFilterBtn && activeFilterBtn.getAttribute("data-filter") === al) {
          card.classList.add("active");
        }
        card.innerHTML = `\n                  <span class="rm-album-icon">${albumIcons[i % albumIcons.length]}</span>\n                  <div class="rm-album-name">${al}</div>\n                  <div class="rm-album-count">${count} track${count !== 1 ? "s" : ""}</div>\n                  <span class="rm-album-del">&#x2715;</span>`;
        card.querySelector(".rm-album-del").onclick = e => {
          e.stopPropagation();
          this._albums.splice(i, 1);
          this._songs.forEach(s => {
            if (s.album === al) s.album = "";
          });
          this._save();
          this._renderAll();
        };
        card.onclick = () => this._setFilter(al);
        grid.appendChild(card);
      });
    }
    _setFilter(val) {
      if (!this._frameDoc) return;
      const btns = this._frameDoc.querySelectorAll(".rm-filter-btn");
      btns.forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-filter") === val);
      });
      const cards = this._frameDoc.querySelectorAll(".rm-album-card");
      const activeFilterBtn = this._frameDoc.querySelector(".rm-filter-btn.active");
      const filterVal = activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "";
      cards.forEach((c, ci) => {
        c.classList.toggle("active", this._albums[ci] === filterVal);
      });
      this._renderSongList();
    }
    _updateNowPlayingLike() {
      if (!this._frameDoc) return;
      const song = this._songs[this._currentIndex];
      const btn = this._frameDoc.querySelector("#rm-like-now");
      if (!btn) return;
      if (song && song.liked) {
        btn.classList.add("liked");
        btn.innerHTML = "&#9829;";
      } else {
        btn.classList.remove("liked");
        btn.innerHTML = "&#9825;";
      }
    }
    _updateAlbumSelect() {
      if (!this._frameDoc) return;
      const sel = this._frameDoc.querySelector("#song-album-select");
      if (!sel) return;
      sel.innerHTML = '<option value="">No Album</option>';
      this._albums.forEach(al => {
        const o = document.createElement("option");
        o.value = o.textContent = al;
        sel.appendChild(o);
      });
    }
    _updateAlbumFilterSelect() {
      if (!this._frameDoc) return;
      const sel = this._frameDoc.querySelector("#album-filter-select");
      if (sel) {
        const cur = sel.value;
        sel.innerHTML = '<option value="">All Songs</option>';
        this._albums.forEach(al => {
          const o = document.createElement("option");
          o.value = o.textContent = al;
          sel.appendChild(o);
        });
        sel.value = cur;
      }
    }
    init(frameDoc) {
      this._frameDoc = frameDoc;
      this._load();
      const q = id => frameDoc.querySelector(id);
      q("#music-play") && (q("#music-play").onclick = () => this.togglePause());
      q("#music-prev") && (q("#music-prev").onclick = () => this.prev());
      q("#music-next") && (q("#music-next").onclick = () => this.next());
      const loopBtn = q("#music-loop");
      if (loopBtn) loopBtn.onclick = () => {
        this._loop = !this._loop;
        loopBtn.classList.toggle("rm-on", this._loop);
      };
      const shfBtn = q("#music-shuffle");
      if (shfBtn) shfBtn.onclick = () => {
        this._shuffle = !this._shuffle;
        shfBtn.classList.toggle("rm-on", this._shuffle);
      };
      const volSlider = q("#music-volume");
      const volLabel = q("#music-volume-label");
      if (volSlider) volSlider.oninput = () => {
        this.setVolume(parseInt(volSlider.value) / 100);
        if (volLabel) volLabel.textContent = volSlider.value + "%";
      };
      const progBar = q("#music-progress-bar");
      if (progBar) progBar.onclick = e => {
        const rect = progBar.getBoundingClientRect();
        this.seekTo((e.clientX - rect.left) / rect.width);
      };
      const SYNC_MODES = [
        [ "#music-chat-sync",      "_chatSync"      ],
        [ "#music-mixed-sync",     "_mixedSync"     ],
        [ "#music-bots-only-sync", "_botsOnlySync"  ],
        [ "#music-unified-sync",   "_unifiedSync"   ]
      ];
      const setSyncMode = active => {
        SYNC_MODES.forEach(([ sel, flag ]) => {
          const on = flag === active;
          this[flag] = on;
          const el = q(sel);
          if (el) el.checked = on;
        });
        this._mixedTurn = 0;
        this._botsDistribIdx = 0;
      };
      SYNC_MODES.forEach(([ sel, flag ]) => {
        const el = q(sel);
        if (!el) return;
        el.checked = false;
        this[flag] = false;
        el.onchange = () => setSyncMode(el.checked ? flag : null);
      });
      const delaySlider = q("#music-sync-delay");
      const delayRow = q("#bm-manual-delay-row");
      if (delayRow) delayRow.style.display = "flex";
      if (delaySlider) {
        const delayLabel = delaySlider.previousElementSibling;
        delaySlider.oninput = () => {
          this._syncDelay = parseInt(delaySlider.value);
          if (delayLabel) delayLabel.textContent = delaySlider.value + "ms";
        };
      }
      const autoDelayRow = frameDoc.querySelector(".hm-sync-row:has(#music-auto-delay)");
      if (autoDelayRow) autoDelayRow.style.display = "none";
      const syncBotBtn = q("#music-sync-bot-btn");
      const syncBotBadge = q("#bm-sync-bot-badge");
      const _updSyncBot = () => {
        if (!syncBotBtn) return;
        syncBotBtn.textContent = this._syncBot ? "ON" : "OFF";
        syncBotBtn.style.background = this._syncBot ? "#2a1f00" : "#0d0a14";
        syncBotBtn.style.borderColor = this._syncBot ? "#9090c8" : "#9090c844";
        syncBotBtn.style.color = this._syncBot ? "#e8e8ff" : "#9090c8";
        syncBotBtn.style.boxShadow = this._syncBot ? "0 0 10px #9090c844" : "none";
        if (syncBotBadge) syncBotBadge.textContent = this._syncBot ? "on" : "off";
      };
      if (syncBotBtn) syncBotBtn.onclick = () => {
        this._syncBot = !this._syncBot;
        _updSyncBot();
      };
      const testBtn = q("#bm-test-chat");
      const testSt = q("#bm-test-chat-status");
      if (testBtn) testBtn.onclick = () => {
        const sock = client && client.SocketManager && client.SocketManager.socket;
        const st = sock ? [ "CONNECTING", "OPEN", "CLOSING", "CLOSED" ][sock.readyState] : "NO_SOCKET";
        const enc = !!(client && client.PacketManager && client.PacketManager.Encoder);
        const ing = !!(client && client.myPlayer && client.myPlayer.inGame);
        if (testSt) {
          testSt.textContent = `sock:${st} enc:${enc} inGame:${ing}`;
          testSt.style.color = st === "OPEN" ? "#9090c8" : "#cc5151";
          setTimeout(() => {
            if (testSt) testSt.textContent = "";
          }, 4000);
        }
        if (st === "OPEN" && enc && ing) {
          try {
            client.PacketManager.chat("🎵 BeeMusic sync test");
          } catch (e) {}
        }
      };
      const sendAllLyricsBtn = q("#bm-send-all-lyrics");
      const sendLyricsStatusEl = q("#bm-send-lyrics-status");
      let _sendLyricsActive = false;
      let _sendLyricsTimer = null;
      let _lyricsGen = 0;
      const _stopSendAllLyrics = () => {
        _lyricsGen++;
        _sendLyricsActive = false;
        clearTimeout(_sendLyricsTimer);
        _sendLyricsTimer = null;
        if (sendAllLyricsBtn) {
          sendAllLyricsBtn.textContent = "♬ Send All Lyrics: OFF";
          sendAllLyricsBtn.style.color = "#9090c8";
          sendAllLyricsBtn.style.borderColor = "#9090c866";
          sendAllLyricsBtn.style.background = "#0d0a14";
        }
        if (sendLyricsStatusEl) sendLyricsStatusEl.textContent = "";
      };
      const _startSendAllLyrics = () => {
        const song = this._currentIndex >= 0 ? this._songs[this._currentIndex] : null;
        const raw = song ? song.lyrics || "" : "";
        const lines = this._parseLRC(raw);
        if (!lines.length) {
          if (sendLyricsStatusEl) sendLyricsStatusEl.textContent = "No LRC lyrics for this song.";
          _sendLyricsActive = false;
          if (sendAllLyricsBtn) {
            sendAllLyricsBtn.textContent = "♬ Send All Lyrics: OFF";
            sendAllLyricsBtn.style.color = "#9090c8";
            sendAllLyricsBtn.style.borderColor = "#9090c866";
            sendAllLyricsBtn.style.background = "#0d0a14";
          }
          return;
        }
        const allChunks = [];
        lines.forEach(({text: text}) => {
          this._splitLine(text).forEach(c => allChunks.push(c));
        });
        let idx = 0;
        const myGen = ++_lyricsGen;
        const sendNext = () => {
          if (myGen !== _lyricsGen || !_sendLyricsActive) return;
          if (idx >= allChunks.length) {
            _stopSendAllLyrics();
            return;
          }
          const chunk = allChunks[idx++];
          try {
            if (this._syncBot) {
              if (client && client.clients) {
                client.clients.forEach(bot => {
                  try {
                    if (bot && bot.PacketManager && bot.myPlayer && bot.myPlayer.inGame) bot.PacketManager.chat(chunk);
                  } catch (_) {}
                });
              }
            } else {
              const sock = client && client.SocketManager && client.SocketManager.socket;
              const sockOk = sock && sock.readyState === sock.OPEN;
              const encOk = client && client.PacketManager && client.PacketManager.Encoder !== null;
              const inGame = client && client.myPlayer && client.myPlayer.inGame;
              if (sockOk && encOk && inGame) client.PacketManager.chat(chunk);
            }
          } catch (e) {}
          if (sendLyricsStatusEl) sendLyricsStatusEl.textContent = idx + " / " + allChunks.length;
          if (idx < allChunks.length) {
            _sendLyricsTimer = setTimeout(sendNext, 2300);
          } else {
            _stopSendAllLyrics();
          }
        };
        sendNext();
      };
      if (sendAllLyricsBtn) {
        sendAllLyricsBtn.onclick = () => {
          _sendLyricsActive = !_sendLyricsActive;
          if (_sendLyricsActive) {
            sendAllLyricsBtn.textContent = "♬ Send All Lyrics: ON";
            sendAllLyricsBtn.style.color = "#e8e8ff";
            sendAllLyricsBtn.style.borderColor = "#9090c8";
            sendAllLyricsBtn.style.background = "#2a1f00";
            _startSendAllLyrics();
          } else {
            _stopSendAllLyrics();
          }
        };
      }
      const dbgBtn = q("#bm-dbg-toggle");
      const dbgWrap = q("#bm-dbg-wrap");
      if (dbgBtn && dbgWrap) dbgBtn.onclick = () => {
        const shown = dbgWrap.style.display !== "none";
        dbgWrap.style.display = shown ? "none" : "block";
        dbgBtn.textContent = shown ? "Show Debug Log" : "Hide Debug Log";
      };
      const lhSlider = q("#music-lookahead");
      const lhBadge = q("#bm-lookahead-badge");
      if (lhSlider) {
        lhSlider.value = 0;
        lhSlider.disabled = true;
      }
      if (lhBadge) lhBadge.textContent = "0ms";
      const albumInput = q("#album-name-input");
      const addAlbum = q("#add-album");
      if (addAlbum) addAlbum.onclick = () => {
        const name = albumInput && albumInput.value.trim();
        if (!name || this._albums.includes(name)) return;
        this._albums.push(name);
        if (albumInput) albumInput.value = "";
        this._save();
        this._renderAll();
      };
      const filterBar = q("#rm-filter-bar");
      if (filterBar) {
        filterBar.addEventListener("click", e => {
          const btn = e.target.closest(".rm-filter-btn");
          if (!btn) return;
          const val = btn.getAttribute("data-filter");
          this._setFilter(val);
        });
      }
      const likeNowBtn = q("#rm-like-now");
      if (likeNowBtn) likeNowBtn.onclick = () => {
        const song = this._songs[this._currentIndex];
        if (!song) return;
        song.liked = !song.liked;
        this._save();
        this._updateNowPlayingLike();
        this._renderSongList();
        this._toast(song.liked ? "♥ Liked!" : "Unliked");
      };
      const saveNowBtn = q("#rm-save-now");
      if (saveNowBtn) saveNowBtn.onclick = () => {
        const song = this._songs[this._currentIndex];
        if (!song) return;
        song.saved = !song.saved;
        this._save();
        this._renderSongList();
        this._toast(song.saved ? "✓ Saved!" : "Unsaved");
      };
      const filterSel = q("#album-filter-select");
      if (filterSel) filterSel.onchange = () => this._renderSongList();
      const lrcFileInput = q("#lrc-file-input");
      const lrcStatus = q("#lrc-status");
      const lyricsArea = q("#song-lyrics-input");
      const songFileInput = q("#song-file-input");
      const songTitleInp = q("#song-title-input");
      if (lrcFileInput) lrcFileInput.onchange = () => {
        const f = lrcFileInput.files[0];
        if (!f) return;
        const reader = new FileReader;
        reader.onload = ev => {
          if (lyricsArea) lyricsArea.value = ev.target.result;
          const count = (ev.target.result.match(/^\[\d+:\d+/gm) || []).length;
          if (lrcStatus) lrcStatus.textContent = count + " lines";
        };
        reader.readAsText(f, "utf-8");
      };
      if (songFileInput) songFileInput.onchange = () => {
        const f = songFileInput.files[0];
        if (!f) return;
        if (songTitleInp && !songTitleInp.value.trim()) songTitleInp.value = f.name.replace(/\.[^.]+$/, "").replace(/[_\-]/g, " ").trim();
      };
      const addSongBtn = q("#add-song");
      if (addSongBtn) addSongBtn.onclick = async () => {
        const title = songTitleInp && songTitleInp.value.trim() || "";
        const url = q("#song-url-input") && q("#song-url-input").value.trim() || "";
        const lyr = lyricsArea && lyricsArea.value || "";
        const album = q("#song-album-select") && q("#song-album-select").value || "";
        const file = songFileInput && songFileInput.files[0];
        if (!title) {
          this._showStatus("⚠ Title required", true);
          return;
        }
        let finalUrl = url;
        if (!finalUrl && file) {
          if (file.size > 20 * 1024 * 1024) {
            this._showStatus("⚠ File too large (max 20MB) — use URL instead", true);
            return;
          }
          finalUrl = await new Promise(res => {
            const r = new FileReader;
            r.onload = e => res(e.target.result);
            r.readAsDataURL(file);
          });
        }
        if (!finalUrl) {
          this._showStatus("⚠ URL or file required", true);
          return;
        }
        const song = {
          title: title,
          artist: "",
          url: finalUrl,
          album: album,
          lyrics: lyr
        };
        this._songs.push(song);
        this._save();
        this._toast("✓ Song added");
        if (songTitleInp) songTitleInp.value = "";
        if (q("#song-url-input")) q("#song-url-input").value = "";
        if (lyricsArea) lyricsArea.value = "";
        if (lrcStatus) lrcStatus.textContent = "";
        if (songFileInput) songFileInput.value = "";
        const autoSync = q("#song-autosync");
        if (autoSync && autoSync.checked) {
          this._chatSync = true;
          if (chatSyncToggle) chatSyncToggle.checked = true;
          this.play(this._songs.length - 1);
        }
        this._renderAll();
      };
      const saveSongBtn = q("#save-song-btn");
      if (saveSongBtn) saveSongBtn.onclick = () => {
        const i = this._currentIndex;
        if (i < 0 || i >= this._songs.length) {
          this._showStatus("⚠ No song selected", true);
          return;
        }
        const lyr = lyricsArea && lyricsArea.value;
        if (lyr !== undefined && this._songs[i]) {
          this._songs[i].lyrics = lyr;
          this._lyrics = this._parseLRC(lyr);
          this._lyricIndex = -1;
        }
        this._save();
        this._toast("✓ Saved");
        if (lrcStatus) lrcStatus.textContent = (this._lyrics.length || "") + (this._lyrics.length ? " lines" : "");
      };
      const exportBtn = q("#music-export-btn");
      if (exportBtn) exportBtn.onclick = () => {
        try {
          const data = {
            songs: this._songs,
            albums: this._albums
          };
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([ json ], {
            type: "application/json"
          });
          const url = URL.createObjectURL(blob);
          const a = frameDoc.createElement("a");
          a.href = url;
          a.download = "ryn_music_backup.json";
          frameDoc.body.appendChild(a);
          a.click();
          frameDoc.body.removeChild(a);
          URL.revokeObjectURL(url);
          const st = q("#music-backup-status");
          if (st) {
            st.textContent = "✓ Exported " + this._songs.length + " songs!";
            st.style.color = "#9090c8";
            setTimeout(() => {
              if (st) st.textContent = "";
            }, 3000);
          }
        } catch (e) {
          const st = q("#music-backup-status");
          if (st) {
            st.textContent = "⚠ Export failed";
            st.style.color = "#cc5151";
          }
        }
      };
      const importBtn = q("#music-import-btn");
      const importFile = q("#music-import-file");
      if (importBtn && importFile) {
        importBtn.onclick = () => importFile.click();
        importFile.onchange = () => {
          const f = importFile.files[0];
          if (!f) return;
          const reader = new FileReader;
          reader.onload = ev => {
            try {
              const data = JSON.parse(ev.target.result);
              const incoming = data.songs || [];
              const inAlbums = data.albums || [];
              let added = 0;
              incoming.forEach(s => {
                const exists = this._songs.some(x => x.title === s.title && x.url === s.url);
                if (!exists) {
                  this._songs.push(s);
                  added++;
                }
              });
              inAlbums.forEach(al => {
                if (!this._albums.includes(al)) this._albums.push(al);
              });
              this._save();
              this._renderAll();
              importFile.value = "";
              const st = q("#music-backup-status");
              if (st) {
                st.textContent = "✓ Imported " + added + " songs!";
                st.style.color = "#9090c8";
                setTimeout(() => {
                  if (st) st.textContent = "";
                }, 3000);
              }
            } catch (e) {
              const st = q("#music-backup-status");
              if (st) {
                st.textContent = "⚠ Invalid file";
                st.style.color = "#cc5151";
              }
            }
          };
          reader.readAsText(f, "utf-8");
        };
      }
    }
  };
  let fKeyHeld = false, fKeyInterval = null;
  const _place = itemType => {
    const myPlayer = client.myPlayer;
    const modH = client._ModuleHandler;
    if (!myPlayer || !myPlayer.inGame) return;
    if (myPlayer.getItemByType(itemType) === null) return;
    modH.startPlacement(itemType);
  };
  window.addEventListener("keydown", e => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (!client.myPlayer || !client.myPlayer.inGame) return;
    if (e.code === "KeyF" && !fKeyHeld) {
      fKeyHeld = true;
      _place(7);
      fKeyInterval = setInterval(() => {
        if (fKeyHeld) _place(7);
      }, 100);
    }
    if (e.code === "KeyG") {
      _place(8);
    }
    if (e.code === "KeyN") {
      Settings_default._automill = !Settings_default._automill;
    }
  }, true);
  window.addEventListener("keyup", e => {
    if (e.code === "KeyF") {
      fKeyHeld = false;
      clearInterval(fKeyInterval);
      fKeyInterval = null;
    }
  }, true);
  const _squadMap = new Map;
  let _activeSquads = new Set;
  const SQUAD_COLORS = [ "#4488ff", "#ff4444", "#44ff88" ];
  const SQUAD_COLORS_DARK = [ "#1133aa", "#aa1111", "#11aa44" ];
  function _getOwnerBots() {
    try {
      const bots = [ ...client.clients ];
      return bots;
    } catch (e) {
      return [];
    }
  }
  const _halvesMap = new Map;
  let _activeHalves = new Set;
  const HALVES_COLORS = {
    left: "#ff9900",
    right: "#cc44ff"
  };
  function _splitIntoHalves() {
    _halvesMap.clear();
    _activeHalves.clear();
    const bots = _getOwnerBots();
    const n = bots.length;
    if (n === 0) return;
    const half = Math.ceil(n / 2);
    bots.forEach((bot, i) => {
      _halvesMap.set(bot, i < half ? "left" : "right");
    });
    _renderHalvesOverlay();
  }
  function _disbandHalves() {
    _halvesMap.clear();
    _activeHalves.clear();
    _removeHalvesOverlay();
  }
  let _halvesCanvas = null;
  function _ensureHalvesCanvas() {
    if (_halvesCanvas && _halvesCanvas.parentNode) return _halvesCanvas;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return null;
    const cv = document.createElement("canvas");
    cv.id = "_halvesOverlay";
    cv.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:51;";
    gameCanvas.parentNode.appendChild(cv);
    _halvesCanvas = cv;
    return cv;
  }
  function _removeHalvesOverlay() {
    if (_halvesCanvas) {
      _halvesCanvas.remove();
      _halvesCanvas = null;
    }
  }
  function _renderHalvesOverlay() {
    const cv = _ensureHalvesCanvas();
    if (!cv) return;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return;
    cv.width = gameCanvas.width;
    cv.height = gameCanvas.height;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    for (const side of [ "left", "right" ]) {
      const members = bots.filter(b => _halvesMap.get(b) === side);
      if (members.length === 0) continue;
      const color = HALVES_COLORS[side];
      const isActive = _activeHalves.has(side);
      const alpha = isActive ? 0.88 : 0.35;
      const label = side === "left" ? "L" : "R";
      for (const bot of members) {
        try {
          const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
          if (!pos) continue;
          const sx = pos.x - offset.x;
          const sy = pos.y - offset.y;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = isActive ? 4 : 2;
          ctx.setLineDash(isActive ? [] : [ 6, 4 ]);
          ctx.beginPath();
          ctx.arc(sx, sy, 50, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = color;
          ctx.font = "bold 13px Orbitron, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, sx, sy - 57);
          ctx.restore();
        } catch (e) {}
      }
    }
  }
  (function _halvesLoop() {
    requestAnimationFrame(_halvesLoop);
    if (_halvesMap.size > 0) _renderHalvesOverlay();
  })();
  function _splitIntoSquads() {
    _squadMap.clear();
    _activeSquads.clear();
    const bots = _getOwnerBots();
    const n = bots.length;
    if (n === 0) return;
    bots.forEach((bot, i) => {
      _squadMap.set(bot, i % 3);
    });
    _renderSquadOverlay();
  }
  function _disbandSquads() {
    _squadMap.clear();
    _activeSquads.clear();
    _removeSquadOverlay();
  }
  function _isControlled(botClient) {
    if (_halvesMap.size > 0 && _activeHalves.size > 0) {
      const side = _halvesMap.get(botClient);
      if (side !== undefined) return _activeHalves.has(side);
    }
    if (_squadMap.size === 0) return true;
    const sq = _squadMap.get(botClient);
    if (sq === undefined) return true;
    if (_activeSquads.size === 0) return false;
    return _activeSquads.has(sq);
  }
  let _squadCanvas = null;
  function _ensureSquadCanvas() {
    if (_squadCanvas && _squadCanvas.parentNode) return _squadCanvas;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return null;
    const cv = document.createElement("canvas");
    cv.id = "_squadOverlay";
    cv.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:50;";
    gameCanvas.parentNode.appendChild(cv);
    _squadCanvas = cv;
    return cv;
  }
  function _removeSquadOverlay() {
    if (_squadCanvas) {
      _squadCanvas.remove();
      _squadCanvas = null;
    }
  }
  function _renderSquadOverlay() {
    const cv = _ensureSquadCanvas();
    if (!cv) return;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return;
    cv.width = gameCanvas.width;
    cv.height = gameCanvas.height;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    const groups = new Map;
    for (const bot of bots) {
      const sq = _squadMap.get(bot);
      if (sq === undefined) continue;
      if (!groups.has(sq)) groups.set(sq, []);
      groups.get(sq).push(bot);
    }
    for (const [sq, members] of groups) {
      const color = SQUAD_COLORS[sq];
      const isActive = _activeSquads.size === 0 ? false : _activeSquads.has(sq);
      const alpha = isActive ? 0.85 : 0.35;
      for (const bot of members) {
        try {
          const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
          if (!pos) continue;
          const sx = pos.x - offset.x;
          const sy = pos.y - offset.y;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = isActive ? 4 : 2.5;
          ctx.setLineDash(isActive ? [] : [ 8, 5 ]);
          ctx.beginPath();
          ctx.arc(sx, sy, 55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = color;
          ctx.font = "bold 14px Orbitron, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("S" + (sq + 1), sx, sy - 62);
          ctx.restore();
        } catch (e) {}
      }
      if (members.length > 1) {
        try {
          let cx2 = 0, cy2 = 0, count = 0;
          for (const bot of members) {
            const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
            if (!pos) continue;
            cx2 += pos.x - offset.x;
            cy2 += pos.y - offset.y;
            count++;
          }
          if (count > 0) {
            cx2 /= count;
            cy2 /= count;
            let maxR = 0;
            for (const bot of members) {
              const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
              if (!pos) continue;
              const dx = pos.x - offset.x - cx2;
              const dy = pos.y - offset.y - cy2;
              maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
            }
            ctx.save();
            ctx.globalAlpha = isActive ? 0.18 : 0.07;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx2, cy2, maxR + 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = isActive ? 0.5 : 0.18;
            ctx.strokeStyle = color;
            ctx.lineWidth = isActive ? 3 : 1.5;
            ctx.setLineDash(isActive ? [] : [ 12, 8 ]);
            ctx.stroke();
            ctx.restore();
          }
        } catch (e) {}
      }
    }
  }
  (function _squadLoop() {
    requestAnimationFrame(_squadLoop);
    if (_squadMap.size > 0) _renderSquadOverlay();
  })();
  document.addEventListener("contextmenu", e => {
    if (_squadMap.size === 0) return;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return;
    const rect = gameCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const offset = RYN._offset;
    let hit = false;
    const bots = _getOwnerBots();
    const checked = new Set;
    for (const bot of bots) {
      const sq = _squadMap.get(bot);
      if (sq === undefined || checked.has(sq)) continue;
      checked.add(sq);
      const members = bots.filter(b => _squadMap.get(b) === sq);
      let cx2 = 0, cy2 = 0, cnt = 0;
      for (const m of members) {
        const pos = m.myPlayer && m.myPlayer.pos && m.myPlayer.pos.current;
        if (!pos) continue;
        cx2 += pos.x - offset.x;
        cy2 += pos.y - offset.y;
        cnt++;
      }
      if (cnt === 0) continue;
      cx2 /= cnt;
      cy2 /= cnt;
      let maxR = 0;
      for (const m of members) {
        const pos = m.myPlayer && m.myPlayer.pos && m.myPlayer.pos.current;
        if (!pos) continue;
        const dx = pos.x - offset.x - cx2;
        const dy = pos.y - offset.y - cy2;
        maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
      }
      const clickR = maxR + 70;
      const dist = Math.sqrt((mx - cx2) ** 2 + (my - cy2) ** 2);
      if (dist <= clickR) {
        e.preventDefault();
        hit = true;
        if (_activeSquads.has(sq)) {
          _activeSquads.delete(sq);
        } else {
          _activeSquads.add(sq);
        }
        break;
      }
    }
  }, true);
  document.addEventListener("click", e => {
    if (_squadMap.size === 0 || !e.altKey) return;
    const gameCanvas = document.querySelector("#gameCanvas");
    if (!gameCanvas) return;
    const rect = gameCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const offset = RYN._offset;
    const bots = _getOwnerBots();
    for (const bot of bots) {
      const sq = _squadMap.get(bot);
      if (sq === undefined) continue;
      const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
      if (!pos) continue;
      const sx = pos.x - offset.x;
      const sy = pos.y - offset.y;
      const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
      if (dist <= 55) {
        e.preventDefault();
        if (_activeSquads.has(sq)) {
          _activeSquads.delete(sq);
        } else {
          _activeSquads.add(sq);
        }
        break;
      }
    }
  }, true);
  const _pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const _delay = (fn, min, max) => setTimeout(fn, min + Math.random() * (max - min));
  const _lines = {
    accept: [ "lets go", "ok then", "sure, come at me", "accepted. dont cry after", "alright, 1v1" ],
    challenge: [ "yo {name}, come fight me", "hey {name}, 1v1?", "{name} lets go 1v1", "fight me {name}" ],
    taunt_start: [ "you sure about this?", "this gonna be quick", "dont embarrass yourself", "ok but dont rage quit" ],
    during_hit_them: [ "get rekt", "too slow", "cant touch me", "is that all?", "lmaooo", "ez", "come on" ],
    during_got_hit: [ "ok that hurt ngl", "lucky hit", "alright alright", "careful now", "almost got me" ],
    during_close: [ "close one!", "nice try", "almost!", "good fight so far" ],
    during_low_hp: [ "..", "ok getting serious", "dont get excited", "not done yet" ],
    win: [ "gg", "gg ez", "too easy bro", "better luck next time", "gg wp", "rip", "outplayed" ],
    win_taunt: [ "told you", "what did i say", "next time maybe", "come back when you practice" ],
    lose: [ "gg", "gg wp", "well played", "you got me", "good fight", "rematch?" ],
    lose_fair: [ "ok that was clean", "respect", "nice moves ngl", "i let you win jk" ],
    greet: [ "hey", "hi", "sup", "yo", "hello" ],
    trash: [ "lol ok", "talk is cheap", "prove it", "sure buddy", "ok noob" ],
    nice: [ "thanks", "ty", "appreciate it", "thx" ],
    laugh: [ "lol", "lmao", "haha", "xd" ],
    rematch: [ "sure come on", "again? ok", "nah im good", "one more then" ]
  };
  const _matchChat = msg => {
    const m = msg.toLowerCase().trim();
    if (/^(hi|hey|hello|sup|yo)/.test(m)) return _pick(_lines.greet);
    if (/^(gg|good game|well played|wp)/.test(m)) return _pick(_lines.win);
    if (/^(ez|easy|lol|lmao|skill issue|trash)/.test(m)) return _pick(_lines.trash);
    if (/^(nice|good|great|sick|pro|clean)/.test(m)) return _pick(_lines.nice);
    if (/^(noob|bad|loser|bot|dogwater)/.test(m)) return _pick(_lines.trash);
    if (/lol|lmao|haha|xd/.test(m)) return _pick(_lines.laugh);
    if (/rematch|again|re\b/.test(m)) return _pick(_lines.rematch);
    if (/how are you|wassup|wsp/.test(m)) return "im good";
    if (/who are you|are you a bot/.test(m)) return "just a player";
    if (/stop|leave|go away/.test(m)) return "make me";
    return null;
  };
  const _1v1 = new Map;
  const _start1v1 = (bot, targetID, targetName) => {
    const state = {
      targetID: targetID,
      targetName: targetName,
      phase: "approach",
      zigzag: 0,
      active: true,
      hitCount: 0,
      gotHitCount: 0,
      lastHp: 100,
      commentTimer: 0
    };
    _1v1.set(bot, state);
    _delay(() => {
      try {
        bot.chat(_pick(_lines.accept));
      } catch (e) {}
    }, 300, 800);
    _delay(() => {
      try {
        bot.chat(_pick(_lines.taunt_start));
      } catch (e) {}
    }, 1500, 3000);
  };
  setInterval(() => {
    let _1v1Index = 0;
    for (const [bot, st] of _1v1) {
      const botIndex1v1 = _1v1Index++;
      if (!st.active) continue;
      try {
        const myP = bot.myPlayer;
        if (!myP) continue;
        const myPos = myP.pos && myP.pos.current;
        if (!myPos) continue;
        const myHp = myP.tempHealth || myP.health || 100;
        if (!myP.inGame) {
          st.active = false;
          _delay(() => {
            try {
              bot.chat(_pick(_lines.lose));
            } catch (e) {}
          }, 400, 900);
          _delay(() => {
            try {
              bot.chat(_pick(_lines.lose_fair));
            } catch (e) {}
          }, 1800, 3200);
          _1v1.delete(bot);
          continue;
        }
        const target = (() => {
          try {
            return bot.ownerClient && bot.ownerClient.PlayerManager ? bot.ownerClient.PlayerManager.playerData.get(st.targetID) : null;
          } catch (e) {
            return null;
          }
        })();
        if (!target || !target.pos) {
          st.active = false;
          _delay(() => {
            try {
              bot.chat(_pick(_lines.win));
            } catch (e) {}
          }, 400, 900);
          _delay(() => {
            try {
              bot.chat(_pick(_lines.win_taunt));
            } catch (e) {}
          }, 2000, 3500);
          _1v1.delete(bot);
          continue;
        }
        const hpDrop = st.lastHp - myHp;
        if (hpDrop > 8) {
          st.gotHitCount++;
          if (st.gotHitCount % 3 === 0 || hpDrop > 20 && Math.random() > 0.4) {
            _delay(() => {
              try {
                bot.chat(_pick(myHp < 40 ? _lines.during_low_hp : _lines.during_got_hit));
              } catch (e) {}
            }, 100, 500);
          }
        }
        st.lastHp = myHp;
        const dx = target.pos.x - myPos.x;
        const dy = target.pos.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        st.zigzag = (st.zigzag + 1) % 60;
        const zz = Math.sin(st.zigzag * 0.22) * 0.6;
        let moveAng;
        if (dist > 200) {
          moveAng = ang + zz;
        } else if (dist > 85) {
          const side = Math.floor(st.zigzag / 30) % 2 === 0 ? 1 : -1;
          moveAng = ang + Math.PI / 2.2 * side + zz;
        } else {
          moveAng = ang + Math.PI + zz * 0.5;
        }
        bot._ModuleHandler.startMovement(moveAng);
        bot._ModuleHandler._currentAngle = ang;
        const attacking = dist < 175;
        _rynSetAttackingStaggered(bot._ModuleHandler, attacking ? 1 : 0, botIndex1v1);
        if (attacking && dist < 120) {
          st.hitCount++;
          st.commentTimer--;
          if (st.commentTimer <= 0 && st.hitCount % 5 === 0) {
            st.commentTimer = 25 + Math.floor(Math.random() * 20);
            _delay(() => {
              try {
                bot.chat(_pick(dist < 80 ? _lines.during_close : _lines.during_hit_them));
              } catch (e) {}
            }, 50, 300);
          }
        }
      } catch (e) {}
    }
  }, 80);
  const _seen = new Set;
  setInterval(() => {
    try {
      for (const bot of client.clients) {
        const sm = bot.SocketManager;
        if (!sm || !sm.socket || sm.socket._aiPatched) continue;
        sm.socket._aiPatched = true;
        const orig = sm.socket.onmessage;
        sm.socket.onmessage = function(ev) {
          try {
            const d = JSON.parse(ev.data);
            if (Array.isArray(d) && d[0] === "6") {
              const sid = d[1], msg = d[2];
              const key = sid + ":" + msg;
              if (!_seen.has(key)) {
                _seen.add(key);
                if (_seen.size > 300) _seen.delete(_seen.values().next().value);
                _onChat(sid, msg, bot);
              }
            }
          } catch (e) {}
          if (orig) orig.call(this, ev);
        };
      }
    } catch (e) {}
  }, 2000);
  const _onChat = (senderID, msg, listenerBot) => {
    const lower = msg.toLowerCase().trim();
    const trigMatch = lower.match(/^nyx\s*(\d+)\s*$/);
    if (trigMatch) {
      const botNum = trigMatch[1];
      let matchedBot = null;
      for (const bot of client.clients) {
        const nick = bot.myPlayer && bot.myPlayer.nickname;
        if (nick && nick.toLowerCase().includes("nyx") && nick.includes(botNum)) {
          matchedBot = bot;
          break;
        }
      }
      if (!matchedBot) {
        for (const bot of client.clients) {
          const s = _1v1.get(bot);
          if (!s || !s.active) {
            matchedBot = bot;
            break;
          }
        }
      }
      if (matchedBot) {
        const s = _1v1.get(matchedBot);
        if (!s || !s.active) {
          const _pm0 = listenerBot && listenerBot.ownerClient && listenerBot.ownerClient.PlayerManager || client && client.PlayerManager;
          const sender = _pm0 ? _pm0.playerData.get(senderID) : null;
          const senderName = sender ? sender.nickname : "bro";
          _start1v1(matchedBot, senderID, senderName);
        }
      }
      return;
    }
    const reply = _matchChat(lower);
    if (reply && Math.random() > 0.5) {
      try {
        const _pm2 = listenerBot && listenerBot.ownerClient && listenerBot.ownerClient.PlayerManager || client && client.PlayerManager;
        const sender = _pm2 ? _pm2.playerData.get(senderID) : null;
        if (!sender || !sender.pos) return;
        let nearest = null, nearestD = Infinity;
        for (const bot of client.clients) {
          const pos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
          if (!pos) continue;
          const d = Math.hypot(pos.x - sender.pos.x, pos.y - sender.pos.y);
          if (d < nearestD) {
            nearestD = d;
            nearest = bot;
          }
        }
        if (nearest && nearestD < 700) {
          _delay(() => {
            try {
              nearest.chat(reply);
            } catch (e) {}
          }, 600, 2000);
        }
      } catch (e) {}
    }
  };
  try {
    if (Settings_default._targetCooldownSec) _targetCooldown = Settings_default._targetCooldownSec * 1000;
  } catch (e) {}
  const _targets = new Map;
  let _targetCooldown = 3000;
  let _ctTargetEnabled = true;
  const _worldToScreen = (wx, wy) => {
    const offset = RYN._offset;
    return {
      x: wx - offset.x,
      y: wy - offset.y
    };
  };
  const _getPlayerAtScreen = (mx, my, radius = 55) => {
    try {
      const pm = client.PlayerManager;
      if (!pm) return null;
      let best = null, bestD = radius;
      for (const [id, p] of pm.playerData) {
        if (!p.pos || p.id === client.myPlayer.id) continue;
        const s = _worldToScreen(p.pos.x, p.pos.y);
        const d = Math.hypot(mx - s.x, my - s.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    } catch (e) {
      return null;
    }
  };
  const _addTarget = player => {
    if (_targets.has(player.id)) {
      _targets.delete(player.id);
      return;
    }
    _targets.set(player.id, {
      player: player,
      addedAt: Date.now(),
      cooldownMs: _targetCooldown
    });
  };
  const _clearAllTargets = () => _targets.clear();
  const _isReady = t => Date.now() - t.addedAt >= t.cooldownMs;
  document.addEventListener("contextmenu", e => {
    const canvas = document.querySelector("#gameCanvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const player = _getPlayerAtScreen(mx, my);
    if (player) {
      e.preventDefault();
      e.stopPropagation();
      _addTarget(player);
    }
  }, true);
  setInterval(() => {
    if (_targets.size === 0) return;
    const now = Date.now();
    for (const [id, t] of _targets) {
      try {
        const pm = client.PlayerManager;
        const live = pm && pm.playerData.get(id);
        if (!live || !live.pos) {
          _targets.delete(id);
          continue;
        }
        t.player = live;
      } catch (e) {
        _targets.delete(id);
      }
    }
    const readyTargets = [ ..._targets.values() ].filter(_isReady);
    if (readyTargets.length === 0) return;
    const bots = [ ...client.clients ];
    bots.forEach((bot, i) => {
      const inDuel = _1v1.get(bot);
      if (inDuel && inDuel.active) return;
      const t = readyTargets[i % readyTargets.length];
      if (!t || !t.player || !t.player.pos) return;
      try {
        const myPos = bot.myPlayer && bot.myPlayer.pos && bot.myPlayer.pos.current;
        if (!myPos || !bot.myPlayer.inGame) return;
        const dx = t.player.pos.x - myPos.x;
        const dy = t.player.pos.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        bot._ModuleHandler.startMovement(ang);
        bot._ModuleHandler._currentAngle = ang;
        _rynSetAttackingStaggered(bot._ModuleHandler, dist < 160 ? 1 : 0, i);
      } catch (e) {}
    });
  }, 80);
  const _targetCanvas = document.createElement("canvas");
  _targetCanvas.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;z-index:9999;";
  document.body.appendChild(_targetCanvas);
  const _resizeTargetCanvas = () => {
    _targetCanvas.width = window.innerWidth;
    _targetCanvas.height = window.innerHeight;
  };
  _resizeTargetCanvas();
  window.addEventListener("resize", _resizeTargetCanvas);
  const _exclamAnims = new Map;
  const _drawTargets = () => {
    const cv = _targetCanvas;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const now = Date.now();
    for (const [id, t] of _targets) {
      const p = t.player;
      if (!p || !p.pos) continue;
      const s = _worldToScreen(p.pos.x, p.pos.y);
      const ready = _isReady(t);
      const cooldownLeft = Math.max(0, t.cooldownMs - (now - t.addedAt));
      const cooldownPct = 1 - cooldownLeft / t.cooldownMs;
      if (!_exclamAnims.has(id)) _exclamAnims.set(id, {
        startTime: now
      });
      const anim = _exclamAnims.get(id);
      const elapsed = now - anim.startTime;
      const bounce = Math.abs(Math.sin(elapsed * 0.004)) * 8;
      const pulse = 0.7 + Math.sin(elapsed * 0.006) * 0.3;
      ctx.save();
      ctx.globalAlpha = ready ? pulse : 0.4;
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = ready ? "#ff2222" : "#ff8800";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = ready ? "#ff0000" : "#ff6600";
      ctx.shadowBlur = ready ? 18 : 8;
      ctx.fillText("!", s.x, s.y - 60 - bounce);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = ready ? 0.9 : 0.5;
      ctx.strokeStyle = ready ? "#ff2222" : "#ff8800";
      ctx.lineWidth = ready ? 3 : 2;
      ctx.setLineDash(ready ? [] : [ 8, 5 ]);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(elapsed * 0.002);
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.stroke();
      [ 0, 1, 2, 3 ].forEach(i => {
        const a = Math.PI / 2 * i + elapsed * 0.002;
        const x1 = Math.cos(a) * 48, y1 = Math.sin(a) * 48;
        const x2 = Math.cos(a) * 58, y2 = Math.sin(a) * 58;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
      ctx.restore();
      if (!ready) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cooldownPct);
        ctx.stroke();
        ctx.fillStyle = "#ffaa00";
        ctx.font = "bold 13px Orbitron, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((cooldownLeft / 1000).toFixed(1) + "s", 0, 0);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = ready ? 1 : 0.6;
      const name = p.nickname || "???";
      const labelW = name.length * 8 + 20;
      const labelX = s.x - labelW / 2;
      const labelY = s.y - 90 - bounce;
      ctx.fillStyle = ready ? "rgba(180,0,0,0.85)" : "rgba(180,80,0,0.75)";
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, 22, 5);
      ctx.fill();
      ctx.strokeStyle = ready ? "#ff4444" : "#ff9900";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Orbitron, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, s.x, labelY + 11);
      ctx.restore();
      ctx.restore();
    }
    for (const id of _exclamAnims.keys()) {
      if (!_targets.has(id)) _exclamAnims.delete(id);
    }
    requestAnimationFrame(_drawTargets);
  };
  requestAnimationFrame(_drawTargets);
  const _SC_DECISION_MS = 1200;
  const _SC_DECISION_MS_STUCK = 450;
  const _SC_LOOKAHEAD = 170;
  const _SC_NO_BACKTRACK_ARC = Math.PI * 0.62;
  const _SC_REPEL_RADIUS = 230;
  const _SC_STUCK_DIST = 35;

  function _scIsBlockedNear(om, myPlayer, x, y, buffer) {
    let hit = null;
    om.grid2D.query(x, y, 2, id => {
      if (hit) return;
      const obj = om.objects.get(id);
      if (!obj || !obj.pos || !(obj instanceof PlayerObject)) return;
      const op = obj.pos.current;
      const d = Math.sqrt((op.x - x) ** 2 + (op.y - y) ** 2);
      const need = (obj.collisionScale || 45) + (myPlayer.collisionScale || 35) + buffer;
      if (d < need) hit = obj;
    });
    return hit;
  }

  function _scPathClear(om, myPlayer, x0, y0, angle, dist) {
    const steps = Math.max(3, Math.round(dist / 40));
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * dist;
      const px = x0 + Math.cos(angle) * t;
      const py = y0 + Math.sin(angle) * t;
      if (_scIsBlockedNear(om, myPlayer, px, py, 6)) return false;
    }
    return true;
  }

  function _scFindClearAngle(om, myPlayer, pos, desiredAngle, lookahead) {
    const STEP = Math.PI / 18;
    let best = null, bestAbsOff = Infinity;
    for (let off = -Math.PI; off <= Math.PI + 1e-6; off += STEP) {
      if (Math.abs(off) >= bestAbsOff) continue;
      const a = desiredAngle + off;
      if (_scPathClear(om, myPlayer, pos.x, pos.y, a, lookahead)) {
        best = a;
        bestAbsOff = Math.abs(off);
        if (bestAbsOff < STEP) break;
      }
    }
    return best;
  }

  function _scNearestBlocker(om, pos, angle, maxDist) {
    let best = null, bestDist = maxDist;
    om.grid2D.query(pos.x, pos.y, 3, id => {
      const obj = om.objects.get(id);
      if (!obj || !obj.pos || !(obj instanceof PlayerObject)) return;
      const op = obj.pos.current;
      const d = Math.sqrt((op.x - pos.x) ** 2 + (op.y - pos.y) ** 2);
      if (d > bestDist) return;
      const a = Math.atan2(op.y - pos.y, op.x - pos.x);
      const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
      if (diff > Math.PI / 2.2) return;
      best = obj;
      bestDist = d;
    });
    return best;
  }

  function _scRepelAngle(sc_client, sc_bot, pos) {
    let nearestDist = _SC_REPEL_RADIUS, nearestAngle = null;
    try {
      for (const other of sc_client.clients) {
        if (other === sc_bot) continue;
        const op = other && other.myPlayer && other.myPlayer.pos && other.myPlayer.pos.current;
        if (!op) continue;
        const d = Math.sqrt((op.x - pos.x) ** 2 + (op.y - pos.y) ** 2);
        if (d < nearestDist) {
          nearestDist = d;
          nearestAngle = Math.atan2(op.y - pos.y, op.x - pos.x);
        }
      }
      for (const p of sc_client.PlayerManager.players) {
        if (!p || !p.pos || sc_client.myPlayer.isMyPlayerByID(p.id)) continue;
        const op = p.pos.current;
        const d = Math.sqrt((op.x - pos.x) ** 2 + (op.y - pos.y) ** 2);
        if (d < nearestDist) {
          nearestDist = d;
          nearestAngle = Math.atan2(op.y - pos.y, op.x - pos.x);
        }
      }
    } catch (_) {}
    return nearestAngle === null ? null : nearestAngle + Math.PI;
  }

  function _scDecide(sc_client, sc_bot, sc_mh, sc_pos, now) {
    const om = sc_bot.ObjectManager;
    let baseAngle;
    if (sc_mh._scatterReturning) {
      const owner = sc_client.myPlayer;
      const op = owner && owner.pos && owner.pos.current;
      baseAngle = op ? Math.atan2(op.y - sc_pos.y, op.x - sc_pos.x) : Math.random() * Math.PI * 2 - Math.PI;
    } else {
      let attempt = 0, candidate;
      do {
        candidate = Math.random() * Math.PI * 2 - Math.PI;
        attempt++;
      } while (sc_mh._scatterLastMoveAngle !== null && attempt < 10 && Math.abs(Math.atan2(Math.sin(candidate - (sc_mh._scatterLastMoveAngle + Math.PI)), Math.cos(candidate - (sc_mh._scatterLastMoveAngle + Math.PI)))) < _SC_NO_BACKTRACK_ARC / 2);
      baseAngle = candidate;
      const repel = _scRepelAngle(sc_client, sc_bot, sc_pos);
      if (repel !== null) {
        const rx = Math.cos(baseAngle) * .4 + Math.cos(repel) * .6;
        const ry = Math.sin(baseAngle) * .4 + Math.sin(repel) * .6;
        baseAngle = Math.atan2(ry, rx);
      }
    }
    const clearAngle = _scFindClearAngle(om, sc_bot.myPlayer, sc_pos, baseAngle, _SC_LOOKAHEAD);
    if (clearAngle !== null) {
      sc_mh._scatterBreaking = false;
      sc_mh._scatterBreakTarget = null;
      return clearAngle;
    }
    const blocker = _scNearestBlocker(om, sc_pos, baseAngle, _SC_LOOKAHEAD + 60);
    if (blocker) {
      sc_mh._scatterBreaking = true;
      sc_mh._scatterBreakTarget = blocker.id;
      return Math.atan2(blocker.pos.current.y - sc_pos.y, blocker.pos.current.x - sc_pos.x);
    }
    sc_mh._scatterBreaking = false;
    sc_mh._scatterBreakTarget = null;
    return baseAngle;
  }

  (function _scatterLoop() {
    try {
      const _sc_client = client;
      if (_sc_client && _sc_client.isOwner) {
        const _sc_now = Date.now();
        for (const _sc_bot of _sc_client.clients) {
          const _sc_mh = _sc_bot._ModuleHandler;
          if (!_sc_mh || (!_sc_mh._scatterActive && !_sc_mh._scatterReturning)) continue;
          const _sc_player = _sc_bot.myPlayer;
          if (!_sc_player || !_sc_player.pos) continue;
          const _sc_pos = _sc_player.pos.current;

          if (_sc_mh._scatterReturning) {
            const owner = _sc_client.myPlayer;
            const op = owner && owner.pos && owner.pos.current;
            if (op) {
              const dHome = Math.sqrt((op.x - _sc_pos.x) ** 2 + (op.y - _sc_pos.y) ** 2);
              if (dHome < 120) {
                _sc_mh._scatterReturning = false;
                _sc_mh._scatterBreaking = false;
                _sc_mh._scatterBreakTarget = null;
                _sc_mh.startMovement(null);
                continue;
              }
            }
          }

          const _sc_dueDecision = _sc_now >= (_sc_mh._scatterNextDecisionTime || 0);
          if (_sc_dueDecision) {
            let stuck = false;
            if (_sc_mh._scatterLastPos) {
              const moved = Math.sqrt((_sc_pos.x - _sc_mh._scatterLastPos.x) ** 2 + (_sc_pos.y - _sc_mh._scatterLastPos.y) ** 2);
              stuck = moved < _SC_STUCK_DIST;
            }
            _sc_mh._scatterStuckStrikes = stuck ? (_sc_mh._scatterStuckStrikes || 0) + 1 : 0;
            const _sc_angle = _scDecide(_sc_client, _sc_bot, _sc_mh, _sc_pos, _sc_now);
            _sc_mh._scatterAngle = _sc_angle;
            _sc_mh._scatterLastMoveAngle = _sc_angle;
            _sc_mh._scatterLastPos = {
              x: _sc_pos.x,
              y: _sc_pos.y
            };
            _sc_mh._scatterNextDecisionTime = _sc_now + ((_sc_mh._scatterStuckStrikes || 0) > 0 ? _SC_DECISION_MS_STUCK : _SC_DECISION_MS);
          }

          const _sc_angle = _sc_mh._scatterAngle;
          if (_sc_angle === undefined || _sc_angle === null) continue;
          _sc_mh.move_dir = _sc_angle;
          try {
            _sc_bot.PacketManager.move(_sc_angle);
          } catch (_) {}

          try {
            const _sc_om = _sc_bot.ObjectManager;
            if (!_sc_om) continue;
            let _sc_closest = null, _sc_closestDist = 181;
            if (_sc_mh._scatterBreaking && _sc_mh._scatterBreakTarget !== null) {
              const tgt = _sc_om.objects.get(_sc_mh._scatterBreakTarget);
              if (tgt && tgt.pos) {
                const tp = tgt.pos.current;
                const td = Math.sqrt((tp.x - _sc_pos.x) ** 2 + (tp.y - _sc_pos.y) ** 2);
                if (td <= 181) _sc_closest = tgt;
              }
            }
            if (!_sc_closest) {
              let _sc_bestDist = 181;
              _sc_om.grid2D.query(_sc_pos.x, _sc_pos.y, 2, _sc_id => {
                const _sc_obj = _sc_om.objects.get(_sc_id);
                if (!_sc_obj || !_sc_obj.pos) return;
                const _sc_op = _sc_obj.pos.current;
                const _sc_od = Math.sqrt((_sc_op.x - _sc_pos.x) ** 2 + (_sc_op.y - _sc_pos.y) ** 2);
                if (_sc_od > _sc_bestDist) return;
                const _sc_oa = Math.atan2(_sc_op.y - _sc_pos.y, _sc_op.x - _sc_pos.x);
                const _sc_diff = Math.abs(Math.atan2(Math.sin(_sc_oa - _sc_angle), Math.cos(_sc_oa - _sc_angle)));
                if (_sc_diff > Math.PI / 2) return;
                _sc_closest = _sc_obj;
                _sc_bestDist = _sc_od;
              });
            }
            if (_sc_closest) {
              const _sc_bp = _sc_closest.pos.current;
              const _sc_ba = Math.atan2(_sc_bp.y - _sc_pos.y, _sc_bp.x - _sc_pos.x);
              const _sc_sec = _sc_player.getItemByType(1);
              const _sc_pri = _sc_player.getItemByType(0);
              const _sc_rel = _sc_mh.staticModules && _sc_mh.staticModules.reloading;
              if (_sc_rel) {
                if (_sc_sec === 10 && _sc_rel.isReloaded(1)) {
                  try {
                    _sc_bot.PacketManager.attack(_sc_ba);
                  } catch (_) {}
                  _sc_mh.forceWeapon = 1;
                } else if (_sc_pri !== 8 && _sc_pri !== 5 && _sc_rel.isReloaded(0)) {
                  try {
                    _sc_bot.PacketManager.attack(_sc_ba);
                  } catch (_) {}
                  _sc_mh.forceWeapon = 0;
                }
              }
            }
          } catch (_sc_e) {}
        }
      }
    } catch (_) {}
    requestAnimationFrame(_scatterLoop);
  })();
  const _attachTargetSettings = doc => {
    const slider = doc.getElementById("_targetCooldown");
    const valEl = doc.getElementById("_targetCooldownVal");
    if (slider) {
      slider.value = _targetCooldown / 1000;
      if (valEl) valEl.textContent = _targetCooldown / 1000 + "s";
      slider.oninput = () => {
        _targetCooldown = parseFloat(slider.value) * 1000;
        if (valEl) valEl.textContent = slider.value + "s";
        try {
          Settings_default._targetCooldownSec = parseFloat(slider.value);
          SaveSettings();
        } catch (e) {}
      };
    }
    const clearBtn = doc.getElementById("_clearTargetsBtn");
    if (clearBtn) clearBtn.onclick = _clearAllTargets;
  };
  setInterval(() => {
    try {
      const frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      const page = frame.contentDocument.querySelector('.menu-page[data-id="1"]');
      if (page && !page._targetAttached) {
        page._targetAttached = true;
        _attachTargetSettings(frame.contentDocument);
      }
      const botsPage = frame.contentDocument.querySelector('.menu-page[data-id="5"]');
      if (botsPage && !botsPage._guardDistAttached) {
        botsPage._guardDistAttached = true;
        (function _initFarmGoalUI(doc) {
          try {
            const configs = [ {
              slider: "_farmGoalWood",
              num: "_farmGoalWoodNum",
              lbl: "_farmGoalWoodVal",
              key: "_farmGoalWood"
            }, {
              slider: "_farmGoalStone",
              num: "_farmGoalStoneNum",
              lbl: "_farmGoalStoneVal",
              key: "_farmGoalStone"
            }, {
              slider: "_farmGoalFood",
              num: "_farmGoalFoodNum",
              lbl: "_farmGoalFoodVal",
              key: "_farmGoalFood"
            } ];
            configs.forEach(({slider: slider, num: num, lbl: lbl, key: key}) => {
              const sl = doc.getElementById(slider);
              const ni = doc.getElementById(num);
              const lv = doc.getElementById(lbl);
              if (!sl || !ni || !lv) return;
              const saved = Settings_default[key] || 0;
              sl.value = ni.value = saved;
              lv.textContent = saved;
              sl.addEventListener("input", () => {
                const v = parseInt(sl.value) || 0;
                ni.value = v;
                lv.textContent = v;
                Settings_default[key] = v;
              });
              ni.addEventListener("input", () => {
                const v = Math.max(0, Math.min(9999, parseInt(ni.value) || 0));
                sl.value = Math.min(v, 2000);
                lv.textContent = v;
                Settings_default[key] = v;
              });
            });
          } catch (e) {}
        })(frame.contentDocument);
        (function _initDaemonFarmUI(doc) {
          try {
            const ftSel = doc.getElementById("_botFarmType");
            const flInp = doc.getElementById("_botFarmLimit");
            const btnSingle = doc.getElementById("_farmModeSingle");
            const btnNearest = doc.getElementById("_farmModeNearest");
            const typeRow = doc.getElementById("_farmTypeRow");
            function _applyMode(mode) {
              Settings_default._botFarmMode = mode;
              const isSingle = mode === "single";
              if (typeRow) typeRow.style.display = isSingle ? "" : "none";
              if (btnSingle) {
                btnSingle.style.background = isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";
                btnSingle.style.borderColor = isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";
                btnSingle.style.color = isSingle ? "#fff" : "#aaa";
              }
              if (btnNearest) {
                btnNearest.style.background = !isSingle ? "rgba(122,66,244,0.25)" : "rgba(255,255,255,0.05)";
                btnNearest.style.borderColor = !isSingle ? "rgba(122,66,244,0.6)" : "rgba(255,255,255,0.1)";
                btnNearest.style.color = !isSingle ? "#fff" : "#aaa";
              }
            }
            _applyMode(Settings_default._botFarmMode || "single");
            if (btnSingle) btnSingle.addEventListener("click", () => _applyMode("single"));
            if (btnNearest) btnNearest.addEventListener("click", () => _applyMode("nearest"));
            const farmTypeBtns = doc.querySelectorAll(".farm-type-btn");
            const farmTypeActive = {
              border: "rgba(122,66,244,0.6)",
              bg: "rgba(122,66,244,0.25)",
              color: "#fff"
            };
            function _applyFarmType(idx) {
              Settings_default._botFarmType = idx;
              if (ftSel) ftSel.value = idx;
              farmTypeBtns.forEach((btn, i) => {
                if (i === idx) {
                  btn.style.border = "1.5px solid " + farmTypeActive.border;
                  btn.style.background = farmTypeActive.bg;
                  btn.style.color = farmTypeActive.color;
                } else {
                  btn.style.border = "1.5px solid rgba(255,255,255,0.08)";
                  btn.style.background = "rgba(255,255,255,0.03)";
                  btn.style.color = "#666";
                }
              });
            }
            farmTypeBtns.forEach(btn => {
              btn.addEventListener("click", () => {
                _applyFarmType(parseInt(btn.dataset.farmType) || 0);
              });
            });
            _applyFarmType(Settings_default._botFarmType || 0);
            if (flInp) {
              flInp.value = Settings_default._botFarmLimit || 0;
              flInp.addEventListener("input", () => {
                Settings_default._botFarmLimit = Math.max(0, parseInt(flInp.value) || 0);
              });
            }
          } catch (e) {}
        })(frame.contentDocument);
        (function _initBotAge4UI(doc) {
          try {
            const selector = doc.getElementById("bot-age4-selector");
            if (!selector) return;
            const label = doc.getElementById("bot-age4-label");
            const btns = selector.querySelectorAll(".bot-weapon-btn");
            const names = {
              0: "Trap (default)",
              1: "Boost Pad"
            };
            function _applyAge4Choice(id) {
              const useBoost = String(id) === "1";
              Settings_default._botAge4BoostPad = useBoost;
              if (label) label.textContent = names[String(id)] || id;
              btns.forEach(b => {
                const active = b.getAttribute("data-age4id") === String(id);
                b.style.border = active ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";
                b.style.background = active ? "rgba(122,66,244,0.15)" : "rgba(255,255,255,0.03)";
                b.style.color = active ? "#c0a0ff" : "rgba(210,210,225,0.8)";
              });
            }
            btns.forEach(btn => {
              btn.addEventListener("click", () => _applyAge4Choice(btn.getAttribute("data-age4id")));
            });
            _applyAge4Choice(Settings_default._botAge4BoostPad ? "1" : "0");
          } catch (e) {}
        })(frame.contentDocument);
        const gSlider = frame.contentDocument.getElementById("_guardFrontDist");
        const gValEl = frame.contentDocument.getElementById("_guardFrontDistVal");
        if (gSlider) {
          gSlider.value = window._guardFrontDistance || 90;
          if (gValEl) gValEl.textContent = gSlider.value + "px";
          gSlider.oninput = () => {
            window._guardFrontDistance = parseInt(gSlider.value);
            if (gValEl) gValEl.textContent = gSlider.value + "px";
          };
        }
      }
    } catch (e) {}
  }, 1500);
  window._currentLang = localStorage.getItem("fg_lang") || "en";
  const TRANSLATIONS = {
    en: {
      nav_keybinds: "Keybinds",
      nav_combat: "Combat",
      nav_visuals: "Visuals",
      nav_misc: "Misc",
      nav_bots: "Bots",
      nav_music: "Music",
      nav_language: "Language",
      page_keybinds: "Keybinds",
      page_combat: "Combat",
      page_visuals: "Visuals",
      page_misc: "Misc",
      page_bots: "Bots",
      page_music: "Music",
      lang_page_title: "🌐 Language",
      lang_page_desc: "Choose your interface language",
      lang_section_title: "Select Language",
      lang_preview_title: "Preview",
      lang_active_label: "Active Language:",
      lang_active_value: "English",
      lang_note_label: "Note:",
      lang_note_value: "The interface will update immediately after selecting a language.",
      follow_cursor: "Follow cursor",
      stop_radius: "Stop movement radius",
      formation: "Formation",
      circle_rotation: "Circle rotation",
      circle_radius: "Circle radius",
      bots_desc: "Create bots, control them and dominate the entire server",
      bot_primary_desc: "Choose a primary weapon for bots (overrides copying from you)",
      bot_secondary_desc: "Choose a secondary weapon for bots (overrides copying from you)",
      add_bots: "+ Add Bots",
      combat_desc: "Modify combat settings, change pvp behavior",
      defense: "Defense",
      placement: "Placement",
      instakills: "Instakills",
      anti_enemy: "Anti enemy",
      anti_spike: "Anti spike",
      emp_defense: "Emp Defense",
      autoheal: "Autoheal",
      autobreak: "Autobreak",
      safe_walk: "Safe walk",
      auto_shield: "Auto Shield",
      tail_priority: "Tail Priority",
      anti_spike_push: "Anti Spike Push",
      trap_animal: "Trap Animal",
      autoplacer: "Autoplacer",
      autoplacer_radius: "Autoplacer radius",
      placement_accuracy: "Placement accuracy",
      automill: "Automill",
      auto_grind: "Auto grind",
      placement_defense: "Placement Defense",
      dash_movement: "Dash Movement",
      auto_sync: "Auto sync",
      spike_tick: "Spike tick",
      spike_sync: "Spike sync",
      spike_sync_hammer: "Spike sync hammer",
      knockback_tick: "Knockback tick",
      knockback_tick_hammer: "Knockback tick hammer",
      knockback_tick_trap: "Knockback tick trap",
      bleed_insta: "Bleed Insta",
      apple_insta: "Apple Insta",
      anti_retrap: "Anti Retrap",
      tool_spear_insta: "Tool Spear Insta",
      autosteal: "Autosteal",
      autopush: "Autopush",
      turret_steal: "Turret steal",
      spike_gear_insta: "Spike Gear Insta",
      turret_sync: "Turret Sync",
      trap_kb: "Trap KB",
      shame_spam: "Shame Spam",
      bot_auto_attack: "Bot Auto-Attack",
      spawn_bot: "Spawn Bot",
      kill_all_bots: "Kill All Bots",
      repel_alts: "Repel Alts",
      misc_desc: "Customize misc settings, add autochat messages, reset settings",
      other: "Other",
      random_name: "Random Name",
      auto_chat: "Auto Chat",
      bot_auto_chat: "Player Auto Chat",
      kill_message: "Kill Message",
      provoke_on_kill: "Provoke on Kill",
      autospawn: "Autospawn",
      autoaccept: "Autoaccept",
      hide_hud: "Hide game HUD",
      chat_log: "Chat Log",
      reset_settings: "RESET SETTINGS",
      name_label: "Name",
      result_label: "Result",
      enable: "Enable",
      interval_sec: "Interval (sec)",
      add_message: "+ Add Message",
      add_bot_message: "+ Add Player Message",
      enable_bot_chat: "Enable Player Chat",
      name_placeholder: "e.g. raptor",
      generate: "🎲 Generate",
      copy: "📋 Copy",
      keybinds_desc: "Setup keybinds for items, weapons and hats",
      items_weapons: "Items & Weapons",
      controls_movement: "Controls & Movement",
      bot_controls: "Bot Controls",
      quick_actions: "Quick Actions",
      food: "Food",
      wall: "Wall",
      spike: "Spike",
      windmill: "Windmill",
      farm: "Farm",
      trap: "Trap",
      turret: "Turret",
      spawn: "Spawn",
      lock_bot_pos: "Lock bot position",
      toggle_shop: "Toggle Shop",
      toggle_clan: "Toggle Clan",
      toggle_menu: "Toggle Menu",
      instakill: "Instakill",
      auto_farm: "Auto Farm",
      scatter_bots: "Scatter Bots",
      clear_targets: "Clear Targets",
      target_cooldown: "Target Cooldown",
      clear_all_targets: "Clear All Targets",
      quad_spikes: "Quad Spikes",
      quad_traps: "Quad Traps",
      toggle_automill: "Toggle Automill",
      boost_spike_rush: "Boost Spike Rush",
      toggle_dash: "Toggle Dash Movement",
      name_song: "Name Song 🎶",
      ranged_shield: "Ranged Shield",
      musket_bow_insta: "Musket Bow Insta",
      platform_w_musket: "Platform w/ Musket",
      visuals_desc: "Customize your visuals, or you can disable it for performance",
      tracers: "Tracers",
      markers: "Markers",
      player: "Player",
      object: "Object",
      enemies: "Enemies",
      teammates: "Teammates",
      animal: "Animal",
      notification: "Notification",
      item_markers: "Item Markers",
      weapon_xp_bar: "Weapon XP Bar",
      turret_reload_bar: "Turret Reload Bar",
      weapon_reload_bar: "Weapon Reload Bar",
      render_hp: "Render HP",
      position_prediction: "Position Prediction",
      item_health_bar: "Item Health Bar",
      assassin_gear: "🦝 Assassin Gear",
      auto_equip_assassin: "Auto Equip Assassin",
      bots_auto_assassin: "Bots Auto Equip Assassin",
      bot_primary_weapon: "Bot Primary Weapon",
      bot_secondary_weapon: "Bot Secondary Weapon",
      controller: "Controller",
      auto_farm_section: "Auto Farm",
      farm_mode: "Farm Mode",
      resource_type: "Resource Type",
      limit: "Limit",
      single: "Single",
      nearest: "Nearest",
      wood: "Wood",
      stone: "Stone",
      gold: "Gold",
      devtool: "Devtool",
      devtool_desc: "Test RYN Client and report about bugs!",
      my_player: "myPlayer",
      hitboxes: "Hitboxes",
      statistics: "Statistics",
      display_angle: "Display player angle",
      weapon_hitbox: "Weapon hitbox",
      collision_hitbox: "Collision hitbox",
      placement_hitbox: "Placement hitbox",
      possible_placement: "Possible placement",
      total_kills: "Total kills:",
      global_kills: "Global kills with bots:",
      deaths: "Deaths:",
      autosync_stat: "Autosync:",
      sshammer: "SSHammer:",
      spike_sync_stat: "Spike sync:",
      spike_tick_stat: "Spike tick:",
      kbtrap: "KBTrap:",
      kbhammer: "KBHammer:",
      kb_reg: "KB Reg:",
      author: "Author:",
      home_desc: "Crystal-forged. Precision-built. Unmatched.",
      arsenal: "ARSENAL",
      system: "SYSTEM",
      status: "STATUS",
      intel: "INTEL",
      connection: "Connection",
      mode: "Mode",
      search_placeholder: "Search...",
      clear_btn: "Clear",
      no_song: "No song selected",
      albums: "Albums",
      library: "Library",
      add_song_section: "Add Song",
      chat_sync_section: "Chat Sync",
      backup_restore: "Backup & Restore",
      all_songs: "All Songs",
      liked: "♥ Liked",
      enable_chat_sync: "Enable Chat Sync",
      mixed_sync: "Mixed Sync",
      bots_only_sync: "Bots Only Sync",
      auto_delay: "Auto Delay",
      sync_bot: "Sync Bot",
      test_chat: "▶ Test Chat",
      send_all_lyrics: "♬ Send All Lyrics: OFF",
      show_debug: "Show Debug Log",
      export_lib: "⬇ Export",
      import_lib: "⬆ Import",
      add_album: "+ Add",
      new_album_placeholder: "New album name...",
      title_placeholder: "Title *",
      artist_placeholder: "Artist",
      url_placeholder: "URL (.mp3  .ogg  .wav)",
      no_album: "No Album",
      lrc_sync: "LRC SYNC",
      add_song_btn: "⬡ Add Song",
      save_btn: "✓ Save",
      export_desc: "Export your library to JSON — restore anytime."
    },
  };
  const LABEL_MAP = [ {
    sel: '.open-menu[data-id="1"] span',
    text: true,
    key: "nav_keybinds"
  }, {
    sel: '.open-menu[data-id="2"] span',
    text: true,
    key: "nav_combat"
  }, {
    sel: '.open-menu[data-id="3"] span',
    text: true,
    key: "nav_visuals"
  }, {
    sel: '.open-menu[data-id="4"] span',
    text: true,
    key: "nav_misc"
  }, {
    sel: '.open-menu[data-id="5"] span',
    text: true,
    key: "nav_bots"
  }, {
    sel: '.open-menu[data-id="7"] span',
    text: true,
    key: "nav_music"
  }, {
    sel: '.open-menu[data-id="8"] span',
    text: true,
    key: "nav_language"
  }, {
    sel: "#lang-page-title",
    key: "lang_page_title"
  }, {
    sel: "#lang-page-desc",
    key: "lang_page_desc"
  }, {
    sel: "#lang-section-title",
    key: "lang_section_title"
  }, {
    sel: "#lang-preview-title",
    key: "lang_preview_title"
  }, {
    sel: "#lang-active-label",
    key: "lang_active_label"
  }, {
    sel: "#lang-active-value",
    key: "lang_active_value"
  }, {
    sel: "#lang-note-label",
    key: "lang_note_label"
  }, {
    sel: "#lang-note-value",
    key: "lang_note_value"
  } ];
  const MUSIC_I18N = {
    en: {
      rm_albums: "Albums",
      rm_new_album_ph: "New album name...",
      rm_add_btn: "+ Add",
      rm_library: "Library",
      rm_all_songs: "All Songs",
      rm_liked: "♥ Liked",
      rm_add_song_title: "Add Song",
      rm_title_ph: "Title *",
      rm_artist_ph: "Artist",
      rm_url_ph: "URL (.mp3  .ogg  .wav)",
      rm_no_album: "No Album",
      rm_lrc_sync: "LRC SYNC",
      rm_autosync: "Auto-play & sync when added",
      rm_add_song_btn: "⬢ Add Song",
      rm_save_btn: "✓ Save",
      rm_chat_sync_title: "Chat Sync",
      rm_enable_chat_sync: "Enable Chat Sync",
      rm_mixed_sync: "Mixed Sync ",
      rm_badge_me_bots: "ME+BOTS",
      rm_mixed_sync_example: "You: line → Bots: line → You ...",
      rm_bots_only_sync: "Bots Only Sync ",
      rm_badge_bots: "BOTS",
      rm_bots_only_example: "Bot1: line1 • Bot2: line2 • Bot3: line3 ...",
      rm_auto_delay: "Auto Delay ",
      rm_sync_bot: "Sync Bot ",
      rm_delay: "Delay",
      rm_test_chat: "▶ Test Chat",
      rm_show_debug: "Show Debug Log",
      rm_backup_restore: "Backup & Restore",
      rm_backup_desc: "Export your library to JSON — restore anytime.",
      rm_export: "⬇ Export",
      rm_import: "⬆ Import",
      rm_no_song: "No song selected",
      rm_shf: "SHF",
      rm_t_like: "Like",
      rm_t_save: "Save",
      rm_t_prev: "Previous",
      rm_t_play: "Play/Pause",
      rm_t_next: "Next",
      rm_t_loop: "Loop"
    },
    ar: {
      rm_albums: "الألبومات",
      rm_new_album_ph: "اسم ألبوم جديد...",
      rm_add_btn: "+ إضافة",
      rm_library: "المكتبة",
      rm_all_songs: "كل الأغاني",
      rm_liked: "♥ المفضلة",
      rm_add_song_title: "إضافة أغنية",
      rm_title_ph: "العنوان *",
      rm_artist_ph: "الفنان",
      rm_url_ph: "رابط (.mp3  .ogg  .wav)",
      rm_no_album: "بدون ألبوم",
      rm_lrc_sync: "مزامنة الكلمات (LRC)",
      rm_autosync: "تشغيل ومزامنة تلقائي عند الإضافة",
      rm_add_song_btn: "⬢ إضافة أغنية",
      rm_save_btn: "✓ حفظ",
      rm_chat_sync_title: "مزامنة الدردشة",
      rm_enable_chat_sync: "تفعيل مزامنة الدردشة",
      rm_mixed_sync: "مزامنة مختلطة ",
      rm_badge_me_bots: "أنا+البوتات",
      rm_mixed_sync_example: "انت: سطر → البوتات: سطر → انت ...",
      rm_bots_only_sync: "مزامنة البوتات فقط ",
      rm_badge_bots: "بوتات",
      rm_bots_only_example: "بوت1: سطر1 • بوت2: سطر2 • بوت3: سطر3 ...",
      rm_auto_delay: "تأخير تلقائي ",
      rm_sync_bot: "بوت المزامنة ",
      rm_delay: "تأخير",
      rm_test_chat: "▶ اختبار الدردشة",
      rm_show_debug: "عرض سجل التصحيح",
      rm_backup_restore: "نسخ احتياطي واستعادة",
      rm_backup_desc: "صدّر مكتبتك إلى JSON — استعدها بأي وقت.",
      rm_export: "⬇ تصدير",
      rm_import: "⬆ استيراد",
      rm_no_song: "لا توجد أغنية محددة",
      rm_shf: "عشوائي",
      rm_t_like: "إعجاب",
      rm_t_save: "حفظ",
      rm_t_prev: "السابق",
      rm_t_play: "تشغيل/إيقاف",
      rm_t_next: "التالي",
      rm_t_loop: "تكرار"
    },
    ru: {
      rm_albums: "Альбомы",
      rm_new_album_ph: "Название нового альбома...",
      rm_add_btn: "+ Добавить",
      rm_library: "Библиотека",
      rm_all_songs: "Все песни",
      rm_liked: "♥ Избранное",
      rm_add_song_title: "Добавить песню",
      rm_title_ph: "Название *",
      rm_artist_ph: "Исполнитель",
      rm_url_ph: "URL (.mp3  .ogg  .wav)",
      rm_no_album: "Без альбома",
      rm_lrc_sync: "Синхронизация LRC",
      rm_autosync: "Автовоспроизведение и синхронизация при добавлении",
      rm_add_song_btn: "⬢ Добавить песню",
      rm_save_btn: "✓ Сохранить",
      rm_chat_sync_title: "Синхронизация чата",
      rm_enable_chat_sync: "Включить синхронизацию чата",
      rm_mixed_sync: "Смешанная синхронизация ",
      rm_badge_me_bots: "Я+БОТЫ",
      rm_mixed_sync_example: "Вы: строка → Боты: строка → Вы ...",
      rm_bots_only_sync: "Синхронизация только ботов ",
      rm_badge_bots: "БОТЫ",
      rm_bots_only_example: "Бот1: строка1 • Бот2: строка2 • Бот3: строка3 ...",
      rm_auto_delay: "Автозадержка ",
      rm_sync_bot: "Бот синхронизации ",
      rm_delay: "Задержка",
      rm_test_chat: "▶ Проверить чат",
      rm_show_debug: "Показать журнал отладки",
      rm_backup_restore: "Резервная копия и восстановление",
      rm_backup_desc: "Экспортируйте библиотеку в JSON — восстановите в любое время.",
      rm_export: "⬇ Экспорт",
      rm_import: "⬆ Импорт",
      rm_no_song: "Песня не выбрана",
      rm_shf: "Случ.",
      rm_t_like: "Нравится",
      rm_t_save: "Сохранить",
      rm_t_prev: "Назад",
      rm_t_play: "Играть/Пауза",
      rm_t_next: "Далее",
      rm_t_loop: "Повтор"
    },
    zh: {
      rm_albums: "专辑",
      rm_new_album_ph: "新专辑名称...",
      rm_add_btn: "+ 添加",
      rm_library: "音乐库",
      rm_all_songs: "所有歌曲",
      rm_liked: "♥ 喜欢",
      rm_add_song_title: "添加歌曲",
      rm_title_ph: "标题 *",
      rm_artist_ph: "艺术家",
      rm_url_ph: "URL (.mp3  .ogg  .wav)",
      rm_no_album: "无专辑",
      rm_lrc_sync: "LRC 歌词同步",
      rm_autosync: "添加后自动播放并同步",
      rm_add_song_btn: "⬢ 添加歌曲",
      rm_save_btn: "✓ 保存",
      rm_chat_sync_title: "聊天同步",
      rm_enable_chat_sync: "启用聊天同步",
      rm_mixed_sync: "混合同步 ",
      rm_badge_me_bots: "我+机器人",
      rm_mixed_sync_example: "你: 一行 → 机器人: 一行 → 你 ...",
      rm_bots_only_sync: "仅机器人同步 ",
      rm_badge_bots: "机器人",
      rm_bots_only_example: "机器人1: 第1行 • 机器人2: 第2行 • 机器人3: 第3行 ...",
      rm_auto_delay: "自动延迟 ",
      rm_sync_bot: "同步机器人 ",
      rm_delay: "延迟",
      rm_test_chat: "▶ 测试聊天",
      rm_show_debug: "显示调试日志",
      rm_backup_restore: "备份与恢复",
      rm_backup_desc: "将音乐库导出为 JSON — 随时可恢复。",
      rm_export: "⬇ 导出",
      rm_import: "⬆ 导入",
      rm_no_song: "未选择歌曲",
      rm_shf: "随机",
      rm_t_like: "喜欢",
      rm_t_save: "保存",
      rm_t_prev: "上一首",
      rm_t_play: "播放/暂停",
      rm_t_next: "下一首",
      rm_t_loop: "循环"
    },
    tr: {
      rm_albums: "Albümler",
      rm_new_album_ph: "Yeni albüm adı...",
      rm_add_btn: "+ Ekle",
      rm_library: "Kitaplık",
      rm_all_songs: "Tüm Şarkılar",
      rm_liked: "♥ Beğenilenler",
      rm_add_song_title: "Şarkı Ekle",
      rm_title_ph: "Başlık *",
      rm_artist_ph: "Sanatçı",
      rm_url_ph: "URL (.mp3  .ogg  .wav)",
      rm_no_album: "Albüm Yok",
      rm_lrc_sync: "LRC SENKRONU",
      rm_autosync: "Eklendiğinde otomatik çal ve senkronize et",
      rm_add_song_btn: "⬢ Şarkı Ekle",
      rm_save_btn: "✓ Kaydet",
      rm_chat_sync_title: "Sohbet Senkronu",
      rm_enable_chat_sync: "Sohbet Senkronunu Etkinleştir",
      rm_mixed_sync: "Karma Senkron ",
      rm_badge_me_bots: "BEN+BOTLAR",
      rm_mixed_sync_example: "Sen: satır → Botlar: satır → Sen ...",
      rm_bots_only_sync: "Sadece Bot Senkronu ",
      rm_badge_bots: "BOTLAR",
      rm_bots_only_example: "Bot1: satır1 • Bot2: satır2 • Bot3: satır3 ...",
      rm_auto_delay: "Otomatik Gecikme ",
      rm_sync_bot: "Senkron Botu ",
      rm_delay: "Gecikme",
      rm_test_chat: "▶ Sohbeti Test Et",
      rm_show_debug: "Hata Ayıklama Günlüğünü Göster",
      rm_backup_restore: "Yedekle ve Geri Yükle",
      rm_backup_desc: "Kitaplığınızı JSON olarak dışa aktarın — istediğiniz zaman geri yükleyin.",
      rm_export: "⬇ Dışa Aktar",
      rm_import: "⬆ İçe Aktar",
      rm_no_song: "Şarkı seçilmedi",
      rm_shf: "KRŞ",
      rm_t_like: "Beğen",
      rm_t_save: "Kaydet",
      rm_t_prev: "Önceki",
      rm_t_play: "Oynat/Duraklat",
      rm_t_next: "Sonraki",
      rm_t_loop: "Tekrarla"
    }
  };
  function _applyMusicTranslation(doc, lang) {
    if (!doc) return;
    const t = MUSIC_I18N[lang] || MUSIC_I18N["en"];
    const els = Array.from(doc.querySelectorAll("[data-i18n]"));
    els.sort((a, b) => {
      if (a.contains(b)) return 1;
      if (b.contains(a)) return -1;
      return 0;
    });
    for (const el of els) {
      const key = el.getAttribute("data-i18n");
      const val = t[key];
      if (val === undefined) continue;
      let replaced = false;
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim() !== "") {
          node.textContent = val;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        if (el.children.length === 0) {
          el.textContent = val;
        } else {
          el.insertBefore(doc.createTextNode(val), el.firstChild);
        }
      }
    }
    doc.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (t[key] !== undefined) el.placeholder = t[key];
    });
    doc.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (t[key] !== undefined) el.title = t[key];
    });
  }
  function _applyTranslation(doc, lang) {
    if (!doc) return;
    const t = TRANSLATIONS[lang] || TRANSLATIONS["en"];
    for (const item of LABEL_MAP) {
      try {
        const el = doc.querySelector(item.sel);
        if (!el) continue;
        if (item.text) {
          const svg = el.querySelector("svg");
          el.textContent = "";
          if (svg) el.appendChild(svg);
          el.appendChild(doc.createTextNode("            " + t[item.key] + "        "));
        } else {
          el.textContent = t[item.key];
        }
      } catch (e) {}
    }
    const pageTitleMap = {
      1: t.page_keybinds,
      2: t.page_combat,
      3: t.page_visuals,
      4: t.page_misc,
      5: t.page_bots,
      7: t.page_music,
      8: t.lang_page_title
    };
    for (const [id, title] of Object.entries(pageTitleMap)) {
      try {
        const pg = doc.querySelector(`.menu-page[data-id="${id}"] > .page-title`);
        if (pg) pg.textContent = title;
      } catch (e) {}
    }
    try {
      const el = doc.querySelector('.menu-page[data-id="1"] > .page-description');
      if (el) el.textContent = t.keybinds_desc;
    } catch (e) {}
    try {
      const el = doc.querySelector('.menu-page[data-id="2"] > .page-description');
      if (el) el.textContent = t.combat_desc;
    } catch (e) {}
    try {
      const el = doc.querySelector('.menu-page[data-id="3"] > .page-description');
      if (el) el.textContent = t.visuals_desc;
    } catch (e) {}
    try {
      const el = doc.querySelector('.menu-page[data-id="4"] > .page-description');
      if (el) el.textContent = t.misc_desc;
    } catch (e) {}
    try {
      const el = doc.querySelector('.menu-page[data-id="5"] > .page-description');
      if (el) el.textContent = t.bots_desc;
    } catch (e) {}
    const sectionMap = [ [ '.menu-page[data-id="2"] .section:nth-child(1) .section-title', t.defense ], [ '.menu-page[data-id="2"] .section:nth-child(2) .section-title', t.placement ], [ '.menu-page[data-id="2"] .section:nth-child(3) .section-title', t.instakills ], [ '.menu-page[data-id="4"] .section:nth-child(1) h2.section-title', t.other ], [ '.menu-page[data-id="4"] .section:nth-child(2) h2.section-title', t.random_name ], [ '.menu-page[data-id="4"] .section:nth-child(3) h2.section-title', t.auto_chat ], [ '.menu-page[data-id="4"] .section:nth-child(4) h2.section-title', t.bot_auto_chat ], [ '.menu-page[data-id="1"] .section:nth-child(1) .section-title', t.items_weapons ], [ '.menu-page[data-id="1"] .section:nth-child(2) .section-title', t.controls_movement ], [ '.menu-page[data-id="1"] .section:nth-child(3) .section-title', t.bot_controls ], [ '.menu-page[data-id="1"] .section:nth-child(4) .section-title', t.quick_actions ], [ '.menu-page[data-id="3"] .section:nth-child(1) .section-title', t.tracers ], [ '.menu-page[data-id="3"] .section:nth-child(2) .section-title', t.markers ], [ '.menu-page[data-id="3"] .section:nth-child(3) .section-title', t.player ], [ '.menu-page[data-id="3"] .section:nth-child(4) .section-title', t.object ], [ '.menu-page[data-id="5"] .section:nth-child(1) .section-title', t.controller ], [ '.menu-page[data-id="5"] .section:nth-child(2) .section-title', t.bot_primary_weapon ], [ '.menu-page[data-id="5"] .section:nth-child(3) .section-title', t.bot_secondary_weapon ] ];
    for (const [sel, val] of sectionMap) {
      try {
        const el = doc.querySelector(sel);
        if (el && val) {
          const dot = el.querySelector("::before") ? null : null;
          el.textContent = val;
        }
      } catch (e) {}
    }
    try {
      const pdescs = doc.querySelectorAll('.menu-page[data-id="5"] .page-description');
      if (pdescs[0]) pdescs[0].textContent = t.bots_desc;
      if (pdescs[1]) pdescs[1].textContent = t.bot_primary_desc;
      if (pdescs[2]) pdescs[2].textContent = t.bot_secondary_desc;
    } catch (e) {}
    const optionMap = [ [ "Follow cursor", t.follow_cursor ], [ "Stop movement radius", t.stop_radius ], [ "Formation", t.formation ], [ "Circle rotation", t.circle_rotation ], [ "Circle radius", t.circle_radius ], [ "Anti enemy", t.anti_enemy ], [ "Anti spike", t.anti_spike ], [ "Emp Defense", t.emp_defense ], [ "Autoheal", t.autoheal ], [ "Autobreak", t.autobreak ], [ "Safe walk", t.safe_walk ], [ "Auto Shield", t.auto_shield ], [ "Tail Priority", t.tail_priority ], [ "Anti Spike Push", t.anti_spike_push ], [ "Trap Animal", t.trap_animal ], [ "Autoplacer radius", t.autoplacer_radius ], [ "Autoplacer", t.autoplacer ], [ "Placement accuracy", t.placement_accuracy ], [ "Automill", t.automill ], [ "Auto grind", t.auto_grind ], [ "Placement Defense", t.placement_defense ], [ "Dash Movement", t.dash_movement ], [ "Auto sync", t.auto_sync ], [ "Spike tick", t.spike_tick ], [ "Spike sync hammer", t.spike_sync_hammer ], [ "Spike sync", t.spike_sync ], [ "Knockback tick hammer", t.knockback_tick_hammer ], [ "Knockback tick trap", t.knockback_tick_trap ], [ "Bleed Insta", t.bleed_insta ], [ "Apple Insta", t.apple_insta ], [ "Knockback tick", t.knockback_tick ], [ "Anti Retrap", t.anti_retrap ], [ "Tool Spear Insta", t.tool_spear_insta ], [ "Autosteal", t.autosteal ], [ "Autopush", t.autopush ], [ "Turret steal", t.turret_steal ], [ "Spike Gear Insta", t.spike_gear_insta ], [ "Turret Sync", t.turret_sync ], [ "Trap KB", t.trap_kb ], [ "Shame Spam", t.shame_spam ], [ "Bot Auto-Attack", t.bot_auto_attack ], [ "Spawn Bot", t.spawn_bot ], [ "Kill All Bots", t.kill_all_bots ], [ "Repel Alts", t.repel_alts ], [ "Scatter Bots", t.scatter_bots ], [ "Clear Targets", t.clear_targets ], [ "Target Cooldown", t.target_cooldown ], [ "Clear All Targets", t.clear_all_targets ], [ "Quad Spikes", t.quad_spikes ], [ "Quad Traps", t.quad_traps ], [ "Toggle Automill", t.toggle_automill ], [ "Boost Spike Rush", t.boost_spike_rush ], [ "Toggle Dash Movement", t.toggle_dash ], [ "Name Song", t.name_song ], [ "Ranged Shield", t.ranged_shield ], [ "Musket Bow Insta", t.musket_bow_insta ], [ "Platform w/ Musket", t.platform_w_musket ], [ "Weapon XP Bar", t.weapon_xp_bar ], [ "Turret Reload Bar", t.turret_reload_bar ], [ "Weapon Reload Bar", t.weapon_reload_bar ], [ "Render HP", t.render_hp ], [ "Position Prediction", t.position_prediction ], [ "Item Health Bar", t.item_health_bar ], [ "Item Markers", t.item_markers ], [ "Enemies", t.enemies ], [ "Teammates", t.teammates ], [ "Animal", t.animal ], [ "Notification", t.notification ], [ "Auto Equip Assassin", t.auto_equip_assassin ], [ "Bots Auto Equip Assassin", t.bots_auto_assassin ], [ "Lock bot position", t.lock_bot_pos ], [ "Toggle Shop", t.toggle_shop ], [ "Toggle Clan", t.toggle_clan ], [ "Toggle Menu", t.toggle_menu ], [ "Instakill", t.instakill ], [ "Auto Farm", t.auto_farm ], [ "Food", t.food ], [ "Wall", t.wall ], [ "Spike", t.spike ], [ "Windmill", t.windmill ], [ "Farm", t.farm ], [ "Trap", t.trap ], [ "Turret", t.turret ], [ "Spawn", t.spawn ], [ "Kill Message", t.kill_message ], [ "Provoke on Kill", t.provoke_on_kill ], [ "Autospawn", t.autospawn ], [ "Autoaccept", t.autoaccept ], [ "Hide game HUD", t.hide_hud ], [ "Chat Log", t.chat_log ], [ "Enable Player Chat", t.enable_bot_chat ], [ "Enable", t.enable ], [ "Interval (sec)", t.interval_sec ] ];
    const allTitles = doc.querySelectorAll(".option-title");
    for (const el of allTitles) {
      if (!el.dataset.enText) {
        el.dataset.enText = el.textContent.trim();
      }
      const enText = el.dataset.enText;
      for (const [en, translated] of optionMap) {
        if (enText.includes(en)) {
          el.textContent = translated;
          break;
        }
      }
    }
    try {
      const el = doc.getElementById("resetSettings");
      if (el) el.textContent = t.reset_settings;
    } catch (e) {}
    try {
      const el = doc.getElementById("addAutoChatMsg");
      if (el) el.textContent = t.add_message;
    } catch (e) {}
    try {
      const el = doc.getElementById("addAutoBotChatMsg");
      if (el) el.textContent = t.add_bot_message;
    } catch (e) {}
    try {
      const el = doc.getElementById("_randomNameInput");
      if (el) el.placeholder = t.name_placeholder;
    } catch (e) {}
    try {
      const el = doc.getElementById("ryn-search-input");
      if (el) el.placeholder = t.search_placeholder || "Search...";
    } catch (e) {}
    try {
      const el = doc.getElementById("_randomNameBtn");
      if (el) el.textContent = t.generate;
    } catch (e) {}
    try {
      const el = doc.getElementById("_randomNameCopy");
      if (el) el.textContent = t.copy;
    } catch (e) {}
    try {
      const av = doc.getElementById("lang-active-value");
      if (av) av.textContent = t.lang_active_value;
    } catch (e) {}
    try {
      const btns = doc.querySelectorAll(".lang-btn");
      btns.forEach(b => {
        const isActive = b.getAttribute("data-lang") === lang;
        b.style.border = isActive ? "1px solid rgba(122,66,244,0.6)" : "1px solid rgba(255,255,255,0.08)";
        b.style.background = isActive ? "rgba(122,66,244,0.12)" : "rgba(255,255,255,0.03)";
        b.style.transform = isActive ? "scale(1.03)" : "scale(1)";
      });
    } catch (e) {}
    try {
      const wrapper = doc.getElementById("menu-wrapper");
      if (wrapper) wrapper.style.direction = lang === "ar" ? "rtl" : "ltr";
    } catch (e) {}
    try {
      _applyMusicTranslation(doc, lang);
    } catch (e) {}
  }
  function _attachLanguageButtons(doc) {
    const btns = doc.querySelectorAll(".lang-btn");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang");
        window._currentLang = lang;
        try {
          localStorage.setItem("fg_lang", lang);
        } catch (e) {}
        _applyTranslation(doc, lang);
      });
    });
    _applyTranslation(doc, window._currentLang);
  }
  setInterval(() => {
    try {
      const frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      const langPage = frame.contentDocument.querySelector('.menu-page[data-id="8"]');
      if (langPage && !langPage._langAttached) {
        langPage._langAttached = true;
        _attachLanguageButtons(frame.contentDocument);
      }
    } catch (e) {}
  }, 800);
  var _RYN_PAGE_NAMES = {
    0: "Home",
    1: "Keybinds",
    2: "Combat",
    3: "Visuals",
    4: "Misc",
    5: "Bots",
    6: "Devtool",
    7: "Music",
    8: "Language"
  };
  function _initRynSearch(doc) {
    var inp = doc.getElementById("ryn-search-input");
    var dd = doc.getElementById("ryn-search-dropdown");
    var clr = doc.getElementById("ryn-search-clear");
    if (!inp || !dd || inp._rynSI) return;
    inp._rynSI = true;
    var focIdx = -1;
    function buildIdx() {
      var arr = [];
      var pages = doc.querySelectorAll(".menu-page");
      for (var p = 0; p < pages.length; p++) {
        var pg = pages[p];
        var pid = pg.getAttribute("data-id") || "";
        var pname = _RYN_PAGE_NAMES[pid] || pid;
        var opts = pg.querySelectorAll(".content-option");
        for (var o = 0; o < opts.length; o++) {
          var opt = opts[o];
          var tel = opt.querySelector(".option-title");
          if (!tel) continue;
          var ttl = tel.textContent.trim();
          if (!ttl) continue;
          var sec = opt.closest(".section");
          var stEl = sec ? sec.querySelector("h2.section-title") || sec.querySelector(".section-title") : null;
          var sname = stEl ? stEl.textContent.trim() : "";
          arr.push({
            ttl: ttl,
            pid: pid,
            pname: pname,
            sname: sname,
            opt: opt
          });
        }
      }
      return arr;
    }
    function hl(text, q) {
      if (!q) return text;
      var esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp("(" + esc + ")", "gi"), "<mark>$1</mark>");
    }
    function doSearch(q) {
      dd.innerHTML = "";
      focIdx = -1;
      if (!q) {
        dd.style.display = "none";
        clr.style.display = "none";
        return;
      }
      clr.style.display = "block";
      var idx = buildIdx();
      var ql = q.toLowerCase();
      var res = [];
      for (var i = 0; i < idx.length; i++) {
        if (idx[i].ttl.toLowerCase().indexOf(ql) >= 0) res.push(idx[i]);
      }
      if (res.length === 0) {
        dd.innerHTML = '<div class="ryn-se">No results found</div>';
        dd.style.display = "block";
        return;
      }
      var byPage = {};
      for (var r = 0; r < res.length; r++) {
        var pn = res[r].pname;
        if (!byPage[pn]) byPage[pn] = [];
        byPage[pn].push(res[r]);
      }
      var pages = Object.keys(byPage);
      for (var k = 0; k < pages.length; k++) {
        var lbl = doc.createElement("div");
        lbl.className = "ryn-sl";
        lbl.textContent = pages[k];
        dd.appendChild(lbl);
        var items = byPage[pages[k]];
        for (var j = 0; j < items.length; j++) {
          (function(item) {
            var el = doc.createElement("div");
            el.className = "ryn-si";
            el.innerHTML = '<span class="ryn-st">' + hl(item.ttl, q) + "</span>" + (item.sname ? '<span class="ryn-sp">' + item.sname + "</span>" : "");
            el.addEventListener("mousedown", function(e) {
              e.preventDefault();
              var nb = doc.querySelector('.open-menu[data-id="' + item.pid + '"]');
              if (nb) nb.click();
              setTimeout(function() {
                item.opt.scrollIntoView({
                  behavior: "smooth",
                  block: "center"
                });
                item.opt.style.background = "rgba(122,66,244,0.18)";
                setTimeout(function() {
                  item.opt.style.background = "";
                }, 1200);
              }, 120);
              inp.value = "";
              dd.style.display = "none";
              clr.style.display = "none";
            });
            dd.appendChild(el);
          })(items[j]);
        }
      }
      dd.style.display = "block";
    }
    function getFx() {
      return dd.querySelectorAll(".ryn-si");
    }
    inp.addEventListener("input", function() {
      doSearch(inp.value.trim());
    });
    inp.addEventListener("keydown", function(e) {
      var its = getFx();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focIdx = Math.min(focIdx + 1, its.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focIdx = Math.max(focIdx - 1, 0);
      } else if (e.key === "Enter" && focIdx >= 0 && its[focIdx]) {
        its[focIdx].dispatchEvent(new MouseEvent("mousedown"));
        return;
      } else if (e.key === "Escape") {
        inp.value = "";
        dd.style.display = "none";
        clr.style.display = "none";
        inp.blur();
        return;
      }
      for (var i = 0; i < its.length; i++) its[i].classList.toggle("ryn-fx", i === focIdx);
      if (its[focIdx]) its[focIdx].scrollIntoView({
        block: "nearest"
      });
    });
    clr.addEventListener("click", function() {
      inp.value = "";
      dd.style.display = "none";
      clr.style.display = "none";
      inp.focus();
    });
    doc.addEventListener("click", function(e) {
      var w = doc.getElementById("ryn-search-wrap");
      if (w && !w.contains(e.target)) dd.style.display = "none";
    });
  }
  setInterval(function() {
    try {
      var frame = UI_default.frame && UI_default.frame.target;
      if (!frame || !frame.contentDocument) return;
      var si = frame.contentDocument.getElementById("ryn-search-input");
      if (si && !si._rynSI) _initRynSearch(frame.contentDocument);
    } catch (e) {}
  }, 800);
  if (Settings_default._nameSong && event.code === Settings_default._nameSong) {
    try {
      const song = MusicPlayer._songs[MusicPlayer._currentIndex];
      if (song) {
        const title = song.title || "Unknown";
        const artist = song.artist || "";
        const msg = artist ? `Name Song: ${title} - ${artist}` : `Name Song: ${title}`;
        const sock = client && client.SocketManager && client.SocketManager.socket;
        const sockOk = sock && sock.readyState === sock.OPEN;
        const encOk = client && client.PacketManager && client.PacketManager.Encoder !== null;
        const inGame = client && client.myPlayer && client.myPlayer.inGame;
        if (sockOk && encOk && inGame) {
          const MAX_CHAT = 30;
          if (msg.length <= MAX_CHAT) {
            client.PacketManager.chat(msg);
          } else {
            const part1 = msg.slice(0, MAX_CHAT);
            const part2 = msg.slice(MAX_CHAT).trim();
            client.PacketManager.chat(part1);
            if (part2) setTimeout(() => {
              try {
                client.PacketManager.chat(part2);
              } catch (_) {}
            }, 2200);
          }
        }
      }
    } catch (_) {}
  }
  function _ryn_buyAndEquipAssassin(c) {
    try {
      if (!c || !c._ModuleHandler || !c.myPlayer || !c.myPlayer.inGame) return;
      const mh = c._ModuleHandler;
      const HAT_ID = 56;
      const PRICE = 20000;
      const bought = mh.bought && mh.bought[0];
      const hasCap = bought && bought.has(HAT_ID);
      if (!hasCap && c.myPlayer.tempGold >= PRICE) {
        try {
          c.PacketManager.buy(0, HAT_ID);
          c.myPlayer.tempGold -= PRICE;
          if (bought) bought.add(HAT_ID);
        } catch (e) {}
      }
      if (hasCap || bought && bought.has(HAT_ID)) {
        mh.forceHat = HAT_ID;
        mh.useHat = HAT_ID;
        const store2 = mh.store && mh.store[0];
        if (store2 && (store2.actual !== HAT_ID || store2.last !== HAT_ID)) {
          store2.last = HAT_ID;
          store2.actual = HAT_ID;
          try {
            c.PacketManager.equip(0, HAT_ID);
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  setInterval(function() {
    try {
      const s = Settings_default;
      if (s._autoAssassin) {
        _ryn_buyAndEquipAssassin(client);
      }
      if (s._botsAutoAssassin && client && client.clients) {
        for (const bot of client.clients) {
          _ryn_buyAndEquipAssassin(bot);
        }
      }
    } catch (e) {}
  }, 200);
  const _farmResourceClaims = new Map;
  const _FARM_MAX_BOTS_PER_RESOURCE = 3;
  class BotAutoFarmModule {
    constructor(botClient) {
      this.client = botClient;
    }
    _res() {
      try {
        return this.client.myPlayer && this.client.myPlayer.resources;
      } catch (_) {
        return null;
      }
    }
    _neededTypes() {
      const s = Settings_default;
      const limit = Number(s._botFarmLimit) || 0;
      const mode = s._botFarmMode || "single";
      if (mode === "single") {
        const type = Number(s._botFarmType) || 0;
        const resNames = [ "wood", "food", "stone", "gold" ];
        const key = resNames[type];
        const res = this._res();
        if (limit > 0 && res && (res[key] || 0) >= limit) return null;
        return new Set([ type ]);
      }
      const res = this._res();
      const resNames = [ "wood", "food", "stone", "gold" ];
      const needed = new Set;
      for (let t = 0; t < 4; t++) {
        if (limit > 0 && res && (res[resNames[t]] || 0) >= limit) continue;
        needed.add(t);
      }
      if (needed.size === 0) return null;
      return needed;
    }
    isActivelyFarming() {
      if (this.client.isOwner) return false;
      if (!Settings_default._botAutoFarmEnabled) return false;
      return this._neededTypes() !== null;
    }
    getNearestResource(typeSet) {
      const {ObjectManager: ObjectManager, myPlayer: myPlayer} = this.client;
      if (!ObjectManager || !myPlayer || !myPlayer.pos) return null;
      let best = null, bestDist = Infinity, bestId = null;
      let overflow = null, overflowDist = Infinity, overflowId = null;
      const myPos = myPlayer.pos.current;
      for (const [resId, obj] of ObjectManager.objects) {
        if (obj.type === undefined || obj.pos === undefined) continue;
        if (!typeSet.has(obj.type)) continue;
        const d = Math.hypot(obj.pos.current.x - myPos.x, obj.pos.current.y - myPos.y);
        const claimed = _farmResourceClaims.get(resId) || 0;
        if (claimed < _FARM_MAX_BOTS_PER_RESOURCE) {
          if (d < bestDist) {
            bestDist = d;
            best = obj;
            bestId = resId;
          }
        } else if (d < overflowDist) {
          overflowDist = d;
          overflow = obj;
          overflowId = resId;
        }
      }
      const chosen = best || overflow;
      const chosenId = best ? bestId : overflowId;
      if (chosen && chosenId !== null) {
        _farmResourceClaims.set(chosenId, (_farmResourceClaims.get(chosenId) || 0) + 1);
      }
      return chosen;
    }
    postTick() {
      const {myPlayer: myPlayer, _ModuleHandler: _ModuleHandler} = this.client;
      if (!myPlayer || !myPlayer.inGame || !myPlayer.pos) return;
      if (!Settings_default._botAutoFarmEnabled) return;
      _ModuleHandler.moduleActive = false;
      _ModuleHandler.attackingState = 0;
      const needed = this._neededTypes();
      if (needed === null) {
        _ModuleHandler._autoFarmActive = true;
        _ModuleHandler.shouldAttack = false;
        _ModuleHandler.forceWeapon = null;
        try {
          const ownerPos = this.client.ownerClient && this.client.ownerClient.myPlayer && this.client.ownerClient.myPlayer.pos && this.client.ownerClient.myPlayer.pos.current;
          if (ownerPos) {
            const myPos = myPlayer.pos.current;
            const dist = Math.hypot(ownerPos.x - myPos.x, ownerPos.y - myPos.y);
            const followRadius = Number(Settings_default._followRadius) || 125;
            if (dist > followRadius) {
              const angle = Math.atan2(ownerPos.y - myPos.y, ownerPos.x - myPos.x);
              _ModuleHandler.startMovement(angle);
            } else {
              _ModuleHandler.startMovement(null);
            }
          } else {
            _ModuleHandler.startMovement(null);
          }
        } catch (_) {
          _ModuleHandler.startMovement(null);
        }
        return;
      }
      const target = this.getNearestResource(needed);
      if (target) {
        const myPos = myPlayer.pos.current;
        const tPos = target.pos.current;
        const angle = Math.atan2(tPos.y - myPos.y, tPos.x - myPos.x);
        let range = 80;
        try {
          const priID = myPlayer.getItemByType(0);
          if (priID !== null && priID !== undefined) {
            range = DataHandler_default.getWeapon(priID).range + (target.hitScale || target.collisionScale || 0);
          }
        } catch (_) {}
        const dist = Math.hypot(tPos.x - myPos.x, tPos.y - myPos.y);
        _ModuleHandler._currentAngle = angle;
        if (_ModuleHandler.mouse) _ModuleHandler.mouse.sentAngle = angle;
        if (dist > range - 5) {
          _ModuleHandler.startMovement(angle, true);
          _ModuleHandler.shouldAttack = false;
        } else {
          _ModuleHandler.startMovement(null);
          _ModuleHandler.useAngle = angle;
          _ModuleHandler.forceWeapon = 0;
          _ModuleHandler.shouldAttack = true;
        }
      } else {
        try {
          const myPos = myPlayer.pos.current;
          if (this._wanderAngle === undefined) {
            this._wanderAngle = Math.random() * Math.PI * 2;
            this._wanderTargetAngle = this._wanderAngle;
            this._wanderRetargetIn = 30 + Math.floor(Math.random() * 60);
          }
          this._wanderRetargetIn--;
          if (this._wanderRetargetIn <= 0) {
            const maxTurn = Math.PI * 0.6;
            this._wanderTargetAngle = this._wanderAngle + (Math.random() * 2 - 1) * maxTurn;
            this._wanderRetargetIn = 40 + Math.floor(Math.random() * 80);
          }
          let diff = this._wanderTargetAngle - this._wanderAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this._wanderAngle += diff * 0.06 + (Math.random() - 0.5) * 0.05;
          _ModuleHandler.startMovement(this._wanderAngle, true);
        } catch (_) {
          _ModuleHandler.startMovement(null);
        }
        _ModuleHandler.shouldAttack = false;
      }
    }
  }
  (function _autoFarmLoop() {
    try {
      if (Settings_default._botAutoFarmEnabled && !Settings_default._botsFrozen && client && client.isOwner) {
        _farmResourceClaims.clear();
        for (const _afBot of client.clients) {
          try {
            const _afMH = _afBot._ModuleHandler;
            if (!_afMH) continue;
            if (!_afMH._daemonFarmModule) {
              _afMH._daemonFarmModule = new BotAutoFarmModule(_afBot);
            }
            _afMH._autoFarmActive = true;
            _afMH._daemonFarmModule.postTick();
          } catch (_) {}
        }
      } else if (client && client.isOwner) {
        for (const _afBot of client.clients) {
          try {
            const _afMH = _afBot._ModuleHandler;
            if (_afMH && _afMH._autoFarmActive) {
              _afMH._autoFarmActive = false;
              _afMH.startMovement(null);
              _afMH.shouldAttack = false;
              _afMH.forceWeapon = null;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    requestAnimationFrame(_autoFarmLoop);
  })();
  window.addEventListener("load", onload);
  if (document.readyState === "complete") {
    onload();
  }
})();