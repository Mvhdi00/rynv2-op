(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById("nameInput").value = "Emontin";
  for (let i = 0; i < 4; i++) { document.getElementById("enterGame").click(); await sleep(1500); if (getComputedStyle(document.getElementById("gameUI")).display !== "none") break; }
  await sleep(1500); try { document.getElementById("ryn-boot") && document.getElementById("ryn-boot").remove(); } catch (e) {}
  const sb = document.getElementById("storeButton");
  sb.click(); await sleep(1200);
  const imgs = [...document.querySelectorAll("#storeHolder img, #ryn-store-items img")];
  return { storeMenu: getComputedStyle(document.getElementById("storeMenu")).display, rynStore: (document.getElementById("ryn-store-container")||{}).style?.display, n: imgs.length, imgs: imgs.slice(0, 6).map(i => ({ src: i.getAttribute("src"), full: i.src, complete: i.complete, nw: i.naturalWidth, cls: i.className })) };
})()
