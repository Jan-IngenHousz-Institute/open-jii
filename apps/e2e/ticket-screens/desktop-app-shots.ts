import type { Page, Route } from "@playwright/test";

import { experimentId, protocolId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import { FixtureTransform } from "./fixture-transform.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import { trialTables } from "./shots-b.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");

/** Stands in for the desktop app, which appends openJII-Desktop/<version> to its user agent. */
class DesktopUserAgent implements Fixture {
  async install(page: Page): Promise<void> {
    const agent = await page.evaluate(() => navigator.userAgent);
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setUserAgentOverride", {
      userAgent: `${agent} openJII-Desktop/1.0.0`,
    });
  }
}

/** Holds an upload open, so the message a running upload shows stays on screen. */
class PendingUpload implements Fixture {
  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname.endsWith("/data/uploads"),
      async (route: Route) => {
        if (route.request().method() !== "POST") {
          await route.fallback();
        }
      },
    );
  }
}

/**
 * A generic test board on a USB cable, answering the generic driver's JSON commands. Its INFO
 * reply carries a name, which is what the bug fails to show.
 */
class ExampleGenericBoard implements Fixture {
  // A string, because tsx wraps named functions in a helper the page does not have.
  private static readonly SCRIPT = `
    (() => {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const info = ${JSON.stringify({
        device_name: "Test board (example)",
        device_type: "sensor",
        device_id: "EX-0001",
        firmware_version: "1.0.0",
      })};

      class ExamplePort {
        async open() {
          let controller;
          this.readable = new ReadableStream({ start(started) { controller = started; } });
          const reply = (body) =>
            setTimeout(() => controller.enqueue(encoder.encode(JSON.stringify(body) + "\\n")), 30);

          let line = "";
          this.writable = new WritableStream({
            write(chunk) {
              line += decoder.decode(chunk);
              for (let end = line.indexOf("\\n"); end >= 0; end = line.indexOf("\\n")) {
                const command = line.slice(0, end).trim();
                line = line.slice(end + 1);
                reply(command.includes('"INFO"') ? { status: "success", data: info } : { status: "success" });
              }
            },
          });
        }
        async close() {}
        addEventListener() {}
        removeEventListener() {}
      }

      const serial = {
        requestPort: async () => new ExamplePort(),
        getPorts: async () => [],
        addEventListener() {},
        removeEventListener() {},
      };
      Object.defineProperty(Navigator.prototype, "serial", { configurable: true, get: () => serial });
    })();
  `;

  async install(page: Page): Promise<void> {
    await page.addInitScript({ content: ExampleGenericBoard.SCRIPT });
  }
}

const GENERIC_PROTOCOL: Resolvable = () => protocolId("[Seed] Chlorophyll Fluorescence v1");

/** The seed has no Generic-family protocol, so one MultispeQ protocol reads as Generic. */
const genericProtocol = new FixtureTransform(
  (url) => /^\/api\/v1\/protocols\/[^/]+$/.test(url.pathname),
  (_url, body) =>
    typeof body === "object" && body !== null ? { ...body, family: "generic" } : body,
);

const bugUnknownDeviceBefore: TicketShot = {
  slug: "bug-unknown-device-before",
  route: async () => `/platform/protocols/${await resolve(GENERIC_PROTOCOL)}/run`,
  fixtures: [genericProtocol, new ExampleGenericBoard()],
  prepare: async (page) => {
    await page.getByRole("button", { name: /USB\/serial/ }).first().click();
    await page.getByRole("button", { name: "Connect", exact: true }).first().click();
    await page.getByText("Connected", { exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_000);

    const panel = page.getByText("Connect & Test").first().locator("xpath=ancestor::div[2]");
    const box = await panel.boundingBox();
    if (!box) throw new Error("Connect & Test is not on the page");
    return { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: 420 };
  },
};

const EXAMPLE_CSV = "plot,note\nA1,Leaves curled at noon\nA2,No change\n";

const webOpenInDesktopApp: TicketShot = {
  slug: "web-open-in-desktop-app",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`,
  prepare: async (page) => {
    const trigger = page.locator('[data-sidebar="footer"] [data-sidebar="menu-button"]').first();
    await trigger.waitFor();
    await trigger.click();

    // Radix hides the rest of the page from role queries while the menu is open.
    const item = page.locator('[data-testid="open-in-desktop-app"]');
    await item.waitFor();
    const menu = page.locator('[role="menu"]');

    const marker = new ChangeMarker(page);
    await marker.mark(item, "New", "outside-left");
    return marker.frame([menu, trigger], 24);
  },
};

const desktopUploadWording: TicketShot = {
  slug: "desktop-upload-wording",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/data`,
  fixtures: [trialTables, new DesktopUserAgent(), new PendingUpload()],
  prepare: async (page) => {
    await page.getByRole("button", { name: "Upload Data" }).click();
    await page.getByRole("button", { name: "New upload" }).click();
    await page.locator('[role="menuitem"]', { hasText: /^CSV$/ }).click();

    await page.locator("#new-table-name").fill("plot_notes");
    await page.locator('input[type="file"]').setInputFiles({
      name: "plot-notes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(EXAMPLE_CSV),
    });
    await page.getByRole("button", { name: "Upload", exact: true }).click();

    const message = page.locator("ol > li", { hasText: "keep this window open" }).last();
    await message.waitFor();

    // The message says the dialog can be closed, so the shot shows it over the page.
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForTimeout(400);

    const marker = new ChangeMarker(page);
    await marker.mark(message, "New", "above");
    return marker.frame([message], 40);
  },
};

export const DESKTOP_APP_SHOTS: readonly TicketShot[] = [
  webOpenInDesktopApp,
  desktopUploadWording,
  bugUnknownDeviceBefore,
];
