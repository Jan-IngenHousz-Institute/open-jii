import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import postgres from "postgres";

import { readLatestSignInOtp } from "@repo/devkit/otp";

import { databaseUrl, locale, seedEmail, waitForFreshOtp } from "../helpers.js";
import { ChangeMarker } from "./change-marker.js";

/** The scene actions the outline video's recorder passes to each shot. */
interface SceneActions {
  hoverEnd(button: Locator): Promise<void>;
  clickEnd(button: Locator): Promise<void>;
  clearMarks(): Promise<void>;
  followInSameTab(link: Locator): Promise<void>;
  dragBy(handle: Locator, dx: number, dy?: number): Promise<void>;
}

interface DesktopScene {
  readonly slug: string;
  /** A platform path, or a full address such as one of the desktop app's own file:// pages. */
  readonly route: string | (() => Promise<string>);
  readonly anonymous?: boolean;
  /** Runs before the page loads, such as a stand-in for the desktop app's bridge. */
  readonly initScript?: string;
  /** Appended to the browser's user agent, as the desktop app appends openJII-Desktop/<version>. */
  readonly userAgentSuffix?: string;
  readonly prepare?: (page: Page, scene: SceneActions) => Promise<void>;
}

const PAGES = path.resolve(import.meta.dirname, "..", "..", "desktop", "pages");
const DESKTOP_AGENT = "openJII-Desktop/1.0.0";
const PLATFORM = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DOCS = "http://localhost:3010";

function appPage(name: string, query = ""): string {
  return `${pathToFileURL(path.join(PAGES, name)).href}${query}`;
}

interface ExampleDevice {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly transport: "usb" | "bluetooth";
  readonly signal?: number;
}

const MULTISPEQ_BLUETOOTH: ExampleDevice = {
  id: "multispeq-bt",
  name: "MultispeQ",
  detail: "Bluetooth, paired with this computer",
  transport: "bluetooth",
};
const MULTISPEQ_USB: ExampleDevice = {
  id: "multispeq-usb",
  name: "MultispeQ",
  detail: "USB serial port",
  transport: "usb",
};

interface BridgeActions {
  readonly devices?: readonly { atMs: number; devices: readonly ExampleDevice[] }[];
  readonly chooseDevice?: string;
  readonly retry?: string;
  readonly restartToUpdate?: string;
}

/** Stands in for the app's preload bridge on a page that runs outside Electron. */
function bridge(actions: BridgeActions = {}): string {
  return `
    window.openjiiDesktop = {
      platform: "darwin",
      platformAddress: "https://openjii.org",
      appInfo: { version: "1.0.0", channel: "Stable" },
      onDevices(callback) {
        for (const step of ${JSON.stringify(actions.devices ?? [])}) setTimeout(() => callback(step.devices), step.atMs);
      },
      chooseDevice(id) { ${actions.chooseDevice ?? ""} },
      retry() { ${actions.retry ?? ""} },
      restartToUpdate() { ${actions.restartToUpdate ?? ""} },
      checkForUpdates() { return Promise.resolve(); },
    };
  `;
}

/**
 * One of the app's own pages as a single document, so a platform page can draw it as the app's
 * child window. The frame hands its pointer to the parent, whose cursor the video shows.
 */
function inlineAppPage(name: string, query: string, frameBridge: string): string {
  const read = (file: string) => fs.readFileSync(path.join(PAGES, file), "utf8");
  const font = fs.readFileSync(path.join(PAGES, "..", "assets", "fonts", "inter-latin.woff2")).toString("base64");
  const css = read("app.css").replace('url("../assets/fonts/inter-latin.woff2")', () => `url(data:font/woff2;base64,${font})`);
  const pointer = `
    for (const type of ["mousemove", "mousedown", "mouseup"]) {
      document.addEventListener(type, (event) => {
        const box = frameElement.getBoundingClientRect();
        parent.document.dispatchEvent(new MouseEvent(type, { clientX: event.clientX + box.left, clientY: event.clientY + box.top }));
      }, true);
    }
  `;
  return read(name)
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")
    .replace('<link rel="stylesheet" href="app.css" />', () => `<style>${css}</style>`)
    .replace(/<script src="([^"]+)"><\/script>/, (_match, file: string) => {
      const script = read(file).replaceAll("location.search", JSON.stringify(query));
      return `<script>${frameBridge}${pointer}</script><script>${script}</script>`;
    });
}

/** Draws the app's child windows over the platform page, as the app does over its main window. */
const APP_WINDOWS = `
  window.__openjiiApp = {
    open(doc, width, height, modal) {
      const backdrop = document.createElement("div");
      backdrop.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;transition:background .3s;background:rgba(14,32,34,0)";
      if (!modal) backdrop.style.pointerEvents = "none";
      const frame = document.createElement("iframe");
      frame.srcdoc = doc;
      frame.style.cssText = "width:" + width + "px;height:" + height + "px;border:0;border-radius:10px;pointer-events:auto;opacity:0;transform:translateY(-14px);transition:opacity .3s,transform .3s;box-shadow:0 24px 70px rgba(0,0,0,.32),0 0 0 1px rgba(0,0,0,.12)";
      backdrop.append(frame);
      document.body.append(backdrop);
      frame.addEventListener("load", () => {
        if (modal) backdrop.style.background = "rgba(14,32,34,.32)";
        frame.style.opacity = "1";
        frame.style.transform = "none";
      });
      this.current = backdrop;
    },
    close() {
      const backdrop = this.current;
      this.current = null;
      backdrop.style.background = "rgba(14,32,34,0)";
      backdrop.firstChild.style.opacity = "0";
      setTimeout(() => backdrop.remove(), 320);
    },
    choose(id) {
      this.close();
      this.pending(id);
    },
    // The real app quits and reopens on the new version, which a page can't show, so the prompt only closes.
    restart() {
      this.close();
    },
  };
`;

const CHECKSUM = "4F2A9C11";
const MULTISPEQ_INFO = {
  device_name: "MultispeQ",
  device_version: "2.0",
  device_id: "4f:2a:9c:11",
  device_battery: 87,
  device_firmware: "2.345",
};
const MULTISPEQ_SAMPLE = {
  ...MULTISPEQ_INFO,
  sample: [{ protocol_id: "", Phi2: 0.79, SPAD: 41.6, PAR: 512, temperature: 23.4, humidity: 48.1 }],
};

/**
 * A MultispeQ on a USB cable, answering the commands the platform's MultispeQ driver sends: hello,
 * battery and device_info, and a protocol with one sample. Picking it in the app's device list
 * resolves the platform's requestPort.
 */
const EXAMPLE_MULTISPEQ = `
  (() => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const info = ${JSON.stringify(JSON.stringify(MULTISPEQ_INFO))};
    const sample = ${JSON.stringify(JSON.stringify(MULTISPEQ_SAMPLE))};

    class ExamplePort {
      async open() {
        let controller;
        this.readable = new ReadableStream({ start(c) { controller = c; } });
        const reply = (text, delay) => setTimeout(() => controller.enqueue(encoder.encode(text + "\\r\\n")), delay);
        const answer = (command) => {
          if (command === "hello" || command === "1000") reply("MultispeQ Ready", 31);
          else if (command === "battery") reply("battery:87", 31);
          else if (command === "device_info" || command === "1007") reply(info + "${CHECKSUM}", 31);
          else if (command.startsWith("[")) reply(sample + "${CHECKSUM}", 2400);
          else if (command) reply("", 31);
        };
        let line = "";
        this.writable = new WritableStream({
          write(chunk) {
            line += decoder.decode(chunk);
            for (let end = line.indexOf("\\n"); end >= 0; end = line.indexOf("\\n")) {
              answer(line.slice(0, end).trim());
              line = line.slice(end + 1);
            }
          },
        });
      }
      async close() {}
      getInfo() { return {}; }
      addEventListener() {}
      removeEventListener() {}
      async setSignals() {}
    }

    const serial = {
      requestPort() {
        return new Promise((resolve, reject) => {
          window.__openjiiApp.pending = (id) =>
            id ? resolve(new ExamplePort()) : reject(new DOMException("No port selected by the user.", "NotFoundError"));
          window.__openjiiApp.open(window.__deviceListDoc, 460, 470, true);
        });
      },
      async getPorts() { return []; },
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(Navigator.prototype, "serial", { configurable: true, get: () => serial });
  })();
`;

const DEVICE_LIST_DOC = `window.__deviceListDoc = ${JSON.stringify(
  inlineAppPage(
    "device-picker.html",
    "?kind=serial",
    bridge({
      devices: [
        { atMs: 300, devices: [MULTISPEQ_BLUETOOTH] },
        { atMs: 2_800, devices: [MULTISPEQ_BLUETOOTH, MULTISPEQ_USB] },
      ],
      chooseDevice: "parent.__openjiiApp.choose(id);",
    }),
  ),
)};`;

const UPDATE_READY_DOC = `window.__updateReadyDoc = ${JSON.stringify(
  inlineAppPage(
    "update-ready.html",
    "?version=1.4.0&current=1.3.2",
    bridge({ restartToUpdate: "parent.__openjiiApp.restart();" }),
  ),
)};`;

// The desktop app has no passkey suggestion, so the browser stands in without WebAuthn.
const NO_WEBAUTHN = "delete window.PublicKeyCredential;";
// Safari has neither Web Serial nor Web Bluetooth, so Chromium stands in without them.
const NO_DEVICE_APIS = "delete Navigator.prototype.serial; delete Navigator.prototype.bluetooth;";

async function seedProtocolRunPath(): Promise<string> {
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const rows = await sql<{ id: string }[]>`
      select p.id from protocols p join users u on u.id = p.created_by
      where u.email = ${seedEmail} and p.name = '[Seed] Chlorophyll Fluorescence v1'
      limit 1
    `;
    const protocol = rows.at(0);
    if (!protocol) throw new Error(`No seed MultispeQ protocol found for ${seedEmail}`);
    return `/platform/protocols/${protocol.id}/run`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function signIn(page: Page): Promise<void> {
  const email = page.getByPlaceholder("Enter your email...");
  await email.click();
  await email.pressSequentially(seedEmail, { delay: 45 });

  const previous = await readLatestSignInOtp(databaseUrl, seedEmail).catch(() => null);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  const code = await waitForFreshOtp(databaseUrl, seedEmail, previous);

  const field = page.locator('input[autocomplete="one-time-code"]');
  await field.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(900);
  await field.pressSequentially(code, { delay: 160 });
  await page.waitForURL(`**/${locale}/platform`, { timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

const appStartsOffline: DesktopScene = {
  slug: "app-starts-offline",
  route: appPage("offline.html"),
  anonymous: true,
  userAgentSuffix: DESKTOP_AGENT,
  initScript: bridge({ retry: `location.href = "${PLATFORM}/${locale}/login";` }),
  prepare: async (page, scene) => {
    const retry = page.getByRole("button", { name: "Try again" });
    await scene.hoverEnd(retry);
    await new ChangeMarker(page).mark(retry, "New", "below");
    await page.waitForTimeout(1_800);

    await scene.clearMarks();
    await scene.clickEnd(retry);
    await page.mouse.move(1_320, 830);
    await page.getByPlaceholder("Enter your email...").waitFor({ timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
  },
};

const appConnectsMultispeq: DesktopScene = {
  slug: "app-connects-multispeq",
  route: seedProtocolRunPath,
  userAgentSuffix: DESKTOP_AGENT,
  initScript: NO_WEBAUTHN + APP_WINDOWS + DEVICE_LIST_DOC + EXAMPLE_MULTISPEQ,
  prepare: async (page, scene) => {
    const connect = page.getByRole("button", { name: "Connect", exact: true });
    await scene.hoverEnd(connect);
    await page.waitForTimeout(500);
    await scene.clickEnd(connect);

    const list = page.frameLocator("iframe");
    const usb = list.getByRole("option", { name: /USB serial port/ });
    await usb.waitFor({ timeout: 15_000 });
    await new ChangeMarker(page).mark(list.locator("#list"), "New", "above");
    await page.waitForTimeout(900);
    await usb.click();
    await page.waitForTimeout(500);
    await scene.hoverEnd(list.getByRole("button", { name: "Connect" }));
    await page.waitForTimeout(400);
    await scene.clearMarks();
    await scene.clickEnd(list.getByRole("button", { name: "Connect" }));
    await page.getByText("Connect & Test").first().hover();

    await page.getByText("Connected", { exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_400);
    const run = page.getByRole("button", { name: /Run Protocol/ });
    await scene.hoverEnd(run);
    await page.waitForTimeout(400);
    await scene.clickEnd(run);
    await page.getByText("No results yet").waitFor({ state: "hidden", timeout: 20_000 });
    await page.waitForTimeout(1_000);
  },
};

const browserSignInOptions: DesktopScene = {
  slug: "browser-sign-in-options",
  route: "/login",
  anonymous: true,
  prepare: async (page) => {
    const options = page.getByRole("button", { name: /^Github$|^Orcid$|passkey/i });
    await options.first().waitFor();
    await page.mouse.move(1_320, 830);
    await page.waitForTimeout(500);
    await new ChangeMarker(page).mark(await options.all(), "Not in the app", "outside-left");
  },
};

const appSignsIn: DesktopScene = {
  slug: "app-signs-in",
  route: "/login",
  anonymous: true,
  userAgentSuffix: DESKTOP_AGENT,
  initScript: NO_WEBAUTHN,
  prepare: async (page) => {
    await signIn(page);
  },
};

const appUpdateReady: DesktopScene = {
  slug: "app-update-ready",
  route: "/platform",
  userAgentSuffix: DESKTOP_AGENT,
  initScript: NO_WEBAUTHN + APP_WINDOWS + UPDATE_READY_DOC,
  prepare: async (page, scene) => {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      Reflect.get(window, "__openjiiApp").open(Reflect.get(window, "__updateReadyDoc"), 420, 190, false);
    });

    const restart = page.frameLocator("iframe").getByRole("button", { name: "Restart now" });
    await restart.waitFor();
    await page.waitForTimeout(900);
    await scene.hoverEnd(restart);
    await new ChangeMarker(page).mark(restart, "New", "below");
    await page.waitForTimeout(1_600);

    await scene.clearMarks();
    await scene.clickEnd(restart);
    await page.mouse.move(1_320, 830);
  },
};

const appUpdateRequired: DesktopScene = {
  slug: "app-update-required",
  route: appPage("update-required.html", "?version=1.4.0&current=1.0.0"),
  userAgentSuffix: DESKTOP_AGENT,
  initScript: NO_WEBAUTHN + bridge({ restartToUpdate: `location.href = "${PLATFORM}/${locale}/platform";` }),
  prepare: async (page, scene) => {
    const restart = page.getByRole("button", { name: "Restart to update" });
    await scene.hoverEnd(restart);
    await new ChangeMarker(page).mark(restart, "New", "below");
    await page.waitForTimeout(1_800);

    await scene.clearMarks();
    await scene.clickEnd(restart);
    await page.waitForURL(`**/${locale}/platform`, { timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
  },
};

const browserPointsToApp: DesktopScene = {
  slug: "browser-points-to-app",
  route: seedProtocolRunPath,
  initScript: NO_DEVICE_APIS,
  prepare: async (page, scene) => {
    const link = page.getByRole("link", { name: /desktop app/i });
    await link.waitFor({ timeout: 20_000 });

    // Without device support the tester panel opens narrow, so widen it as a researcher would.
    await scene.dragBy(page.locator("[data-panel-resize-handle-id]").first(), -380);
    await page.waitForTimeout(600);
    await scene.hoverEnd(link);
    await new ChangeMarker(page).mark(link, "New", "below");
    await page.waitForTimeout(1_800);

    // The link points at the published docs, and the video follows it to the local docs site.
    await scene.clearMarks();
    await link.evaluate((anchor, docs) => {
      if (!(anchor instanceof HTMLAnchorElement)) throw new Error("not a link");
      anchor.href = docs + new URL(anchor.href).pathname;
    }, DOCS);
    await scene.followInSameTab(link);
    await page.getByRole("heading", { name: "Installing the desktop app" }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1_400);
    await page.mouse.move(1_300, 640);
    for (let step = 0; step < 6; step += 1) {
      await page.mouse.wheel(0, 70);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(500);
    await new ChangeMarker(page).mark(page.locator("table").first(), "New", "above");
  },
};

export const SHOTS: readonly DesktopScene[] = [
  appStartsOffline,
  appConnectsMultispeq,
  browserSignInOptions,
  appSignsIn,
  appUpdateReady,
  appUpdateRequired,
  browserPointsToApp,
];
