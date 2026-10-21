const params = new URLSearchParams(location.search);
for (const [id, key] of [["version", "version"], ["current", "current"]]) {
  const element = document.getElementById(id);
  if (element) element.textContent = params.get(key) ?? "";
}
document.getElementById("restart")?.addEventListener("click", () => window.openjiiDesktop.restartToUpdate());
document.getElementById("later")?.addEventListener("click", () => window.close());
