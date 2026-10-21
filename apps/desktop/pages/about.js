const info = window.openjiiDesktop.appInfo;
const meta = document.getElementById("meta");
for (const [label, value] of [["Version", info.version], ["Channel", info.channel], ["Platform", info.platformAddress], ["Engine", `Chromium ${info.chrome}, Electron ${info.electron}`]]) {
  meta.insertAdjacentHTML("beforeend", "<dt></dt><dd></dd>");
  meta.lastElementChild.previousElementSibling.textContent = label;
  meta.lastElementChild.textContent = value;
}
document.getElementById("check").addEventListener("click", async () => {
  document.getElementById("result").textContent = "Checking for updates...";
  document.getElementById("result").textContent = await window.openjiiDesktop.checkForUpdates();
});
