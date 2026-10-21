const path = require("node:path");

const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
} = require("electron");

const PLATFORM_URL = process.env.OPENJII_PLATFORM_URL ?? "https://openjii.org";
const platformOrigin = new URL(PLATFORM_URL).origin;
const DEEP_LINK_SCHEME = "openjii";
const SCAFFOLD = process.env.OPENJII_SCAFFOLD === "1";

// The app lives inside the platform; the public site is the only part of the
// platform it does not show. Everything else opens in the browser.
const START_URL = new URL("/platform", platformOrigin).href;
const IN_APP_SECTIONS = new Set(["platform", "register", "join", "desktop-handoff"]);
const SIGN_IN_SECTIONS = new Set(["login", "login-error", "verify-request"]);
const LOCALE_SEGMENT = /^[a-z]{2}-[A-Z]{2}$/;

// Ports macOS creates for itself, which are never a measurement device.
const SYSTEM_SERIAL_PORTS = new Set(["cu.Bluetooth-Incoming-Port", "cu.debug-console"]);

const page = (name) => path.join(__dirname, "pages", name);

let mainWindow = null;
let pendingDeepLink = null;
let lastPlatformUrl = START_URL;

function isPlatformOrigin(url) {
  return URL.canParse(url) && new URL(url).origin === platformOrigin;
}

function platformSection(url) {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  return (LOCALE_SEGMENT.test(segments[0] ?? "") ? segments[1] : segments[0]) ?? "";
}

function isSignInPage(url) {
  return isPlatformOrigin(url) && SIGN_IN_SECTIONS.has(platformSection(url));
}

function belongsInApp(url) {
  if (!isPlatformOrigin(url)) {
    return true;
  }
  return IN_APP_SECTIONS.has(platformSection(url));
}

function showSignIn(window) {
  void window.loadFile(page("signin.html"));
}

// openjii://auth?token=... comes back from the browser once the user has signed in there.
function handleDeepLink(url) {
  if (!mainWindow) {
    pendingDeepLink = url;
    return;
  }

  const link = URL.canParse(url) ? new URL(url) : null;
  const token = link?.searchParams.get("token");
  if (link?.host !== "auth" || !token) {
    return;
  }

  const complete = new URL("/desktop-handoff/complete", platformOrigin);
  complete.searchParams.set("token", token);
  void mainWindow.loadURL(complete.href);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function localWindow(options, file, query) {
  const window = new BrowserWindow({
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    ...options,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void window.loadFile(page(file), { query });
  window.once("ready-to-show", () => window.show());
  return window;
}

// One picker window per device request. Electron offers no chooser of its own
// for Web Serial or Web Bluetooth, so the app draws one and keeps it current.
function openDevicePicker(kind, onChoice) {
  const picker = localWindow(
    { parent: mainWindow, modal: true, width: 460, height: 470, title: "Connect a device" },
    "device-picker.html",
    { kind },
  );

  let settled = false;
  const settle = (deviceId) => {
    if (settled) {
      return;
    }
    settled = true;
    onChoice(deviceId);
    if (!picker.isDestroyed()) {
      picker.close();
    }
  };

  picker.on("closed", () => settle(""));
  picker.webContents.ipc.on("desktop:choose-device", (_event, deviceId) => settle(deviceId ?? ""));

  return {
    update(devices) {
      if (!picker.isDestroyed()) {
        picker.webContents.send("desktop:devices", devices);
      }
    },
    settle,
  };
}

// Chromium reaches a paired Bluetooth device itself and names that port by the
// device's address; macOS also offers its own serial port for the same device.
const BLUETOOTH_ADDRESS = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;

function describeSerialPort(port) {
  const name = port.displayName || port.portName.replace(/^cu\./, "");
  if (port.vendorId) {
    return { id: port.portId, name, detail: `USB, ${port.portName}`, transport: "usb" };
  }
  if (BLUETOOTH_ADDRESS.test(port.portName)) {
    return { id: port.portId, name, detail: "Bluetooth, paired with this computer", transport: "bluetooth" };
  }
  return { id: port.portId, name, detail: `Bluetooth serial port, ${port.portName}`, transport: "bluetooth" };
}

// One entry per device: an operating-system port that duplicates a device Chromium
// already reaches over Bluetooth is left out.
function visiblePorts(ports) {
  const bluetoothNames = new Set(
    ports.filter((port) => BLUETOOTH_ADDRESS.test(port.portName)).map((port) => port.displayName),
  );
  return ports
    .filter((port) => !SYSTEM_SERIAL_PORTS.has(port.portName))
    .filter((port) => !bluetoothNames.has(port.portName.replace(/^cu\./, "")))
    .map(describeSerialPort);
}

function wireSerial(window) {
  const browserSession = session.defaultSession;
  let pending = null;
  let ports = [];

  const visible = () => visiblePorts(ports);

  browserSession.on("select-serial-port", (event, portList, _webContents, callback) => {
    event.preventDefault();
    if (process.env.OPENJII_DEBUG_PORTS === "1") {
      console.log(`[ports] ${JSON.stringify(portList)}`);
    }
    ports = portList;
    pending = openDevicePicker("serial", (portId) => {
      pending = null;
      callback(portId);
    });
    window.webContents.once("destroyed", () => pending?.settle(""));
    setTimeout(() => pending?.update(visible()), 150);
  });

  browserSession.on("serial-port-added", (_event, port) => {
    ports = [...ports.filter((known) => known.portId !== port.portId), port];
    pending?.update(visible());
  });

  browserSession.on("serial-port-removed", (_event, port) => {
    ports = ports.filter((known) => known.portId !== port.portId);
    pending?.update(visible());
  });

  browserSession.setPermissionCheckHandler((_webContents, _permission, requestingOrigin) =>
    isPlatformOrigin(requestingOrigin),
  );

  browserSession.setDevicePermissionHandler(
    (details) =>
      ["serial", "bluetooth"].includes(details.deviceType) && isPlatformOrigin(details.origin),
  );
}

// Scan results arrive through repeated events; the picker shows each new list.
function wireBluetooth(window) {
  let pending = null;
  let latestCallback = null;

  window.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    latestCallback = callback;

    if (!pending) {
      pending = openDevicePicker("bluetooth", (deviceId) => {
        pending = null;
        latestCallback?.(deviceId);
      });
    }

    pending.update(
      devices.map((device) => ({
        id: device.deviceId,
        name: device.deviceName || "Unnamed device",
        detail: "Bluetooth Low Energy",
        transport: "ble",
      })),
    );
  });
}

function showOffline(window, failedUrl) {
  lastPlatformUrl = failedUrl ?? lastPlatformUrl;
  void window.loadFile(page("offline.html"));
}

let aboutWindow = null;

function showAbout() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return aboutWindow;
  }
  aboutWindow = localWindow({ width: 380, height: 420, title: "About openJII" }, "about.html");
  return aboutWindow;
}

function showUpdateReady(version) {
  return localWindow(
    { parent: mainWindow, width: 420, height: 190, title: "Update ready" },
    "update-ready.html",
    { version },
  );
}

function showUpdateRequired(current, version) {
  void mainWindow.loadFile(page("update-required.html"), { query: { current, version } });
}

function buildMenu() {
  const about = { label: "About openJII", click: showAbout };
  const check = { label: "Check for Updates...", click: showAbout };
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: "openJII",
            submenu: [about, check, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }],
          },
        ]
      : []),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    ...(process.platform === "darwin" ? [] : [{ label: "Help", submenu: [about, check] }]),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "openJII",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (belongsInApp(url) && isPlatformOrigin(url)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // The platform sends signed-out users to its web login; the app shows its own screen instead.
  window.webContents.on("will-redirect", (event, url) => {
    if (isSignInPage(url)) {
      event.preventDefault();
      showSignIn(window);
    }
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isSignInPage(url)) {
      event.preventDefault();
      showSignIn(window);
      return;
    }
    if (belongsInApp(url)) {
      return;
    }
    event.preventDefault();
    void shell.openExternal(url);
  });

  window.webContents.on("did-navigate-in-page", (_event, url) => {
    if (isSignInPage(url)) {
      showSignIn(window);
    }
  });

  window.webContents.on("did-navigate", (_event, url) => {
    if (isPlatformOrigin(url)) {
      lastPlatformUrl = url;
    }
  });

  // ERR_ABORTED (-3) is a navigation the app cancelled itself, not a lost connection.
  window.webContents.on("did-fail-load", (_event, errorCode, _description, url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && isPlatformOrigin(url)) {
      showOffline(window, url);
    }
  });

  wireSerial(window);
  wireBluetooth(window);
  void window.loadURL(START_URL);
  return window;
}

ipcMain.on("desktop:belongs-in-app", (event, url) => {
  event.returnValue = belongsInApp(url);
});

ipcMain.on("desktop:open-external", (_event, url) => {
  if (isPlatformOrigin(url) && !belongsInApp(url)) {
    void shell.openExternal(url);
  }
});

const fromLocalPage = (event) => event.senderFrame?.url.startsWith("file://") === true;

ipcMain.on("desktop:sign-in-with-browser", (event) => {
  if (!fromLocalPage(event)) {
    return;
  }
  void shell.openExternal(new URL("/platform/desktop-handoff", platformOrigin).href);
});

ipcMain.on("desktop:platform-address", (event) => {
  event.returnValue = platformOrigin;
});

// Unpackaged runs report Electron's own version from app.getVersion().
const appVersion = () => (app.isPackaged ? app.getVersion() : require("./package.json").version);

ipcMain.on("desktop:app-info", (event) => {
  event.returnValue = {
    version: appVersion(),
    channel: "Stable",
    platformAddress: platformOrigin.replace(/^https?:\/\//, ""),
    electron: process.versions.electron,
    chrome: process.versions.chrome.split(".")[0],
  };
});

ipcMain.on("desktop:retry", (event) => {
  if (fromLocalPage(event) && mainWindow) {
    void mainWindow.loadURL(lastPlatformUrl);
  }
});

ipcMain.on("desktop:restart-to-update", (event) => {
  if (fromLocalPage(event)) {
    app.relaunch();
    app.quit();
  }
});

ipcMain.handle("desktop:check-for-updates", () => `openJII ${appVersion()} is the newest version.`);

// Without a name the profile is the folder every unnamed Electron app shares, whose
// locked storage made every first page load wait about four seconds on a dev Mac.
app.setName("openJII");
app.setPath("userData", path.join(app.getPath("appData"), "openJII"));
app.userAgentFallback = `${app.userAgentFallback} openJII-Desktop/${appVersion()}`;

// macOS delivers links as an event; Windows and Linux start a second instance with the
// link in argv. Packaged builds register the scheme through Info.plist or the installer.
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

const findDeepLink = (argv) => argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = findDeepLink(argv);
    if (link) {
      handleDeepLink(link);
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.setIcon(nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")));
    }
    buildMenu();
    mainWindow = createWindow();

    if (SCAFFOLD) {
      global.openjiiScaffold = { showAbout, showUpdateReady, showUpdateRequired, showOffline: () => showOffline(mainWindow) };
    }

    const launchLink = pendingDeepLink ?? findDeepLink(process.argv);
    pendingDeepLink = null;
    if (launchLink) {
      handleDeepLink(launchLink);
    }
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
