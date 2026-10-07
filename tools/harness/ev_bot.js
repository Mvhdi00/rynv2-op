(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById("nameInput").value = "Emontin";
  for (let i = 0; i < 4; i++) { document.getElementById("enterGame").click(); await sleep(1500); if (getComputedStyle(document.getElementById("gameUI")).display !== "none") break; }
  await sleep(1500);
  const fr = document.getElementById("ryn-menu-frame");
  const doc = fr && (fr.contentDocument || fr.contentWindow.document);
  if (!doc) return { err: "no frame" };
  const add = doc.querySelector("#add-bot-dynamic");
  const ids = [...doc.querySelectorAll("[id]")].map(e => e.id).filter(i => /bot/i.test(i)).slice(0, 40);
  if (!add) return { err: "no add button", ids };
  add.click(); await sleep(300);
  const btns = [...doc.querySelectorAll("button")].filter(b => b.textContent === "Connect");
  const inp = doc.querySelector("input[id^=bot]") || doc.querySelector(".bot-row input");
  const row = btns[0] && btns[0].parentNode; const ti = row && row.querySelector("input"); if (ti) ti.value = "Bott";
  btns[0] && btns[0].click();
  await sleep(9000);
  const toasts = [...document.querySelectorAll("div")].filter(d => /BOT|bot/.test(d.textContent) && d.children.length === 0).map(d => d.textContent).slice(0, 10);
  return { addId: add.id, connectButtons: btns.length, toasts, ids };
})()
