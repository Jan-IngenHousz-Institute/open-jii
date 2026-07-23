import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { checkLocaleParity, formatLocaleParityIssue } from "./locale-parity.js";
import { HOST_SUPPORT_CATALOG } from "./support-catalog.js";

const repoRoot = resolve(import.meta.dirname, "../../..");
const mobileRoot = resolve(repoRoot, "apps/mobile");
const localeRoot = resolve(mobileRoot, "src/shared/i18n/locales");

const retiredMobileKeys = [
  "connection.connectedDevice.turnOffMultispeQ",
  "connection.deviceSheet.currentSubMultispeQ",
  "connection.deviceSheet.currentSubMultispeQNoFirmware",
  "connection.deviceSheet.pair",
  "connection.deviceSheet.pairing",
  "measurement-flow.experimentSelection.sensorBannerTitle",
  "measurement-flow.experimentSelection.sensorBannerBody",
  "measurement-flow.experimentSelection.sensorBannerAction",
  "measurement-flow.experimentSelection.tag.sensorRequired",
  "measurement-flow.experimentSelection.tag.sensorAndQuestions",
] as const;

describe("mobile locale and runtime conformance", () => {
  it("keeps en-US and nl-NL at exact key parity with retired generic keys absent", async () => {
    const issues = await checkLocaleParity({
      host: "mobile",
      base: { locale: "en-US", root: resolve(localeRoot, "en-US") },
      siblings: [{ locale: "nl-NL", root: resolve(localeRoot, "nl-NL") }],
      retiredKeys: retiredMobileKeys,
    });

    expect(issues.map(formatLocaleParityIssue)).toEqual([]);
  });

  it("contains no visible MultiSpeQ fallback in either mobile locale", async () => {
    const localeFiles = ["en-US", "nl-NL"].flatMap((locale) =>
      ["connection.json", "home.json", "measurement-flow.json"].map((namespace) =>
        resolve(localeRoot, locale, namespace),
      ),
    );
    const contents = await Promise.all(localeFiles.map((path) => readFile(path, "utf8")));

    for (const content of contents) expect(content).not.toMatch(/multispeq/iu);
  });

  it("keeps mobile execution current-specific only for MultiSpeQ", () => {
    const currentFamilies = Object.entries(HOST_SUPPORT_CATALOG.mobile)
      .filter(([, support]) => support.state !== "unavailable")
      .map(([family]) => family);

    expect(currentFamilies).toEqual(["multispeq"]);
    expect(HOST_SUPPORT_CATALOG.mobile.multispeq).toMatchObject({
      state: "current-specific",
      deviceType: "multispeq",
      transports: ["bluetooth-classic", "usb-serial"],
    });
  });

  it("keeps the runtime fallback and dispatch wired to the concrete MultiSpeQ executor", async () => {
    const [fallbackSource, dispatchSource] = await Promise.all([
      readFile(
        resolve(mobileRoot, "src/features/connection/services/mobile-runtime-support.ts"),
        "utf8",
      ),
      readFile(
        resolve(
          mobileRoot,
          "src/features/connection/services/device-connection-manager/device-connection.ts",
        ),
        "utf8",
      ),
    ]);

    expect(fallbackSource).toContain('MOBILE_PRE_IDENTITY_FAMILY = "multispeq"');
    expect(dispatchSource).toContain("createMultispeqCommandExecutor");
    expect(dispatchSource).toContain("bluetoothClassicTransport");
    expect(dispatchSource).toContain("serialPortTransport");
    expect(dispatchSource).not.toMatch(/AmbitDriver|MiniParDriver|Ambyte|GenericDeviceDriver/u);
  });
});
