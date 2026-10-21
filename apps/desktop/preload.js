const { contextBridge, ipcRenderer } = require("electron");

// The app's own screens are local files; only they get the bridge.
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("openjiiDesktop", {
    platform: process.platform,
    platformAddress: ipcRenderer.sendSync("desktop:platform-address"),
    appInfo: ipcRenderer.sendSync("desktop:app-info"),
    signInWithBrowser: () => ipcRenderer.send("desktop:sign-in-with-browser"),
    onDevices: (callback) => ipcRenderer.on("desktop:devices", (_event, devices) => callback(devices)),
    chooseDevice: (id) => ipcRenderer.send("desktop:choose-device", id),
    retry: () => ipcRenderer.send("desktop:retry"),
    restartToUpdate: () => ipcRenderer.send("desktop:restart-to-update"),
    checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  });
}

// Lets the web app tell it is inside the desktop shell, e.g. to drop the public chrome.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.openjiiDesktop = "true";
});

// Same-origin links route client-side and never reach the main process, so
// clicks on links that do not belong in the app are handed over here.
window.addEventListener(
  "click",
  (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.origin !== location.origin) {
      return;
    }
    if (!ipcRenderer.sendSync("desktop:belongs-in-app", anchor.href)) {
      event.preventDefault();
      ipcRenderer.send("desktop:open-external", anchor.href);
    }
  },
  true,
);
