document.getElementById("continue").addEventListener("click", () => {
  window.openjiiDesktop.signInWithBrowser();
  document.getElementById("waiting").hidden = false;
});
