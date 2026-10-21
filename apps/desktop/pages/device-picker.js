const kind = new URLSearchParams(location.search).get("kind") ?? "serial";
const platform = window.openjiiDesktop.platform;
const list = document.getElementById("list");
const connect = document.getElementById("connect");
const status = document.getElementById("status");
const hint = document.getElementById("hint");
let devices = [];
let selected = null;

const SERIAL_HINTS = {
  darwin: "Using Bluetooth? Pair the device in System Settings first, and it appears in this list.",
  win32: "Using Bluetooth? Pair the device in Windows Settings first, and it appears in this list.",
  linux: "Using Bluetooth? Pair the device in your system's Bluetooth settings first, and it appears in this list.",
};

document.getElementById("subtitle").textContent =
  kind === "bluetooth"
    ? "Bluetooth devices nearby that this measurement can use."
    : "Devices connected by USB cable, and paired Bluetooth devices.";

function icon(device) {
  const usb = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v14"/><path d="m8 6 4-4 4 4"/><circle cx="12" cy="19" r="3"/><path d="M8 10H5v3l3 2"/><path d="M16 9h3v3l-3 2"/></svg>';
  const bt = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>';
  return device.transport === "usb" ? usb : bt;
}

function signal(level) {
  return `<span class="signal" aria-label="Signal ${level} of 4">${[1, 2, 3, 4].map((n) => `<i class="${n <= level ? "on" : ""}" style="height:${3 + n * 2}px"></i>`).join("")}</span>`;
}

function render() {
  list.innerHTML = "";
  if (devices.length === 0) {
    list.innerHTML = `<li class="empty">${kind === "bluetooth" ? "Looking for devices. Make sure the device is switched on and close to this computer." : "No device found. Connect it with a USB cable, or pair it over Bluetooth first."}</li>`;
  }
  for (const device of devices) {
    const row = document.createElement("li");
    row.className = `row${device.id === selected ? " selected" : ""}`;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(device.id === selected));
    row.setAttribute("aria-label", `${device.name}, ${device.detail}`);
    row.tabIndex = device.id === selected || (!selected && device === devices[0]) ? 0 : -1;
    row.innerHTML = `<span class="icon">${icon(device)}</span><span class="text"><div class="name"></div><div class="detail"></div></span>${device.signal ? signal(device.signal) : `<span class="badge">${device.transport === "usb" ? "USB" : "Bluetooth"}</span>`}`;
    row.querySelector(".name").textContent = device.name;
    row.querySelector(".detail").textContent = device.detail;
    row.addEventListener("click", () => { selected = device.id; render(); });
    row.addEventListener("dblclick", () => window.openjiiDesktop.chooseDevice(device.id));
    list.appendChild(row);
  }
  connect.disabled = !devices.some((device) => device.id === selected);
  status.innerHTML = kind === "bluetooth" ? '<span class="spinner"></span>Scanning for Bluetooth devices' : '<span class="spinner"></span>Watching for devices you plug in';
  const text = kind === "serial" ? SERIAL_HINTS[platform] : "";
  hint.hidden = !text;
  hint.textContent = text;
}

window.openjiiDesktop.onDevices((next) => {
  devices = next;
  if (!devices.some((device) => device.id === selected)) selected = null;
  render();
});

// Arrow keys move through the list, Enter connects to the selected device, Escape cancels.
document.addEventListener("keydown", (event) => {
  const index = devices.findIndex((device) => device.id === selected);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = event.key === "ArrowDown" ? Math.min(devices.length - 1, index + 1) : Math.max(0, index - 1);
    selected = devices[next]?.id ?? null;
    render();
    list.querySelector(".row.selected")?.focus();
  } else if (event.key === "Enter" && selected) {
    window.openjiiDesktop.chooseDevice(selected);
  } else if (event.key === "Escape") {
    window.openjiiDesktop.chooseDevice("");
  }
});
connect.addEventListener("click", () => window.openjiiDesktop.chooseDevice(selected));
document.getElementById("cancel").addEventListener("click", () => window.openjiiDesktop.chooseDevice(""));
render();
