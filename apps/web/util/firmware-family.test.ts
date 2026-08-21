import { describe, expect, it } from "vitest";

import { hasManagedFirmware, isSameFirmwareVersion } from "./firmware-family";

describe("hasManagedFirmware", () => {
  it("accepts the families JII builds firmware for", () => {
    expect(hasManagedFirmware("ambyte")).toBe(true);
    expect(hasManagedFirmware("ambit")).toBe(true);
    expect(hasManagedFirmware("minipar")).toBe(true);
  });

  it("rejects families with no JII firmware line", () => {
    expect(hasManagedFirmware("mobile")).toBe(false);
    expect(hasManagedFirmware("generic")).toBe(false);
    expect(hasManagedFirmware("multispeq")).toBe(false);
  });
});

describe("isSameFirmwareVersion", () => {
  it("matches a device-reported version against the release tag despite the v prefix", () => {
    expect(isSameFirmwareVersion("1.3.0", "v1.3.0")).toBe(true);
    expect(isSameFirmwareVersion("v1.3.0", "v1.3.0")).toBe(true);
    expect(isSameFirmwareVersion("1.3.0", "1.3.0")).toBe(true);
  });

  it("keeps a dirty or in-between build distinct from the release", () => {
    expect(isSameFirmwareVersion("1.3.0-2-gabc123", "v1.3.0")).toBe(false);
    expect(isSameFirmwareVersion("1.2.0", "v1.3.0")).toBe(false);
  });
});
