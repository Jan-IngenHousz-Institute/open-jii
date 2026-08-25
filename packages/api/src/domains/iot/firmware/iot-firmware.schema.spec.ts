import { describe, expect, it } from "vitest";

import { zFirmwareFamily, zFirmwareRelease } from "./iot-firmware.schema";

describe("zFirmwareFamily", () => {
  it("covers only the families JII builds firmware for", () => {
    expect(zFirmwareFamily.options).toEqual(["ambyte", "minipar", "ambit"]);
  });

  it("rejects families with no JII firmware line", () => {
    expect(zFirmwareFamily.safeParse("mobile").success).toBe(false);
    expect(zFirmwareFamily.safeParse("generic").success).toBe(false);
    expect(zFirmwareFamily.safeParse("multispeq").success).toBe(false);
  });
});

describe("zFirmwareRelease", () => {
  it("accepts a published release with assets", () => {
    expect(
      zFirmwareRelease.safeParse({
        version: "v1.3.0",
        name: "Spring release",
        publishedAt: new Date().toISOString(),
        prerelease: false,
        latest: true,
        notes: "- fixes",
        releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.0",
        assets: [
          {
            name: "firmware.bin",
            sizeBytes: 1024,
            downloadUrl: "https://github.com/org/repo/releases/download/v1.3.0/firmware.bin",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("allows an unnamed release with no notes and no assets", () => {
    expect(
      zFirmwareRelease.safeParse({
        version: "v1.3.1",
        name: null,
        publishedAt: new Date().toISOString(),
        prerelease: true,
        latest: false,
        notes: null,
        releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.1",
        assets: [],
      }).success,
    ).toBe(true);
  });
});
