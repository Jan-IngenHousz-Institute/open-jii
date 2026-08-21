import { describe, expect, it } from "vitest";

import { hasManagedFirmware } from "./firmware-family";

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
