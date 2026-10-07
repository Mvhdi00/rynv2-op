(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById("nameInput").value = "Emontin";
  for (let i = 0; i < 6; i++) { document.getElementById("enterGame").click(); await sleep(1500); if (window.client && client.myPlayer && client.myPlayer.inGame) break; }
  await sleep(2500); try { document.getElementById("ryn-boot") && document.getElementById("ryn-boot").remove(); } catch (e) {}
  const mp = window.client && client.myPlayer;
  return { inGame: !!(mp && mp.inGame), hat: mp && mp.hatID, gameUI: getComputedStyle(document.getElementById("gameUI")).display, mainMenu: getComputedStyle(document.getElementById("mainMenu")).display };
})()
