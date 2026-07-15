import { describe, expect, it } from "vitest";

import { deviceDisplayName } from "./device-cells";

describe("deviceDisplayName", () => {
  it("returns the serial number from a device struct", () => {
    const struct = JSON.stringify({ id: "d-1", serial_number: "AA:11", status: "active" });
    expect(deviceDisplayName(struct)).toBe("AA:11");
  });

  it("trims and falls back to Unknown device when the serial is blank", () => {
    expect(deviceDisplayName(JSON.stringify({ serial_number: "  " }))).toBe("Unknown device");
    expect(deviceDisplayName(JSON.stringify({ id: "d-1" }))).toBe("Unknown device");
  });

  it("falls back to Unknown device for non-string or malformed values", () => {
    expect(deviceDisplayName(null)).toBe("Unknown device");
    expect(deviceDisplayName(42)).toBe("Unknown device");
    expect(deviceDisplayName("not json")).toBe("Unknown device");
  });
});
