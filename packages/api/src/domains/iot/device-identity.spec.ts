import { describe, expect, it } from "vitest";

import {
  multispeqAddressMatches,
  normalizeMacSerial,
  normalizeMultispeqReportedId,
} from "./device-identity";

describe("normalizeMacSerial", () => {
  it("normalizes colon, dash and bare forms to uppercase colon form, keeping byte order", () => {
    for (const raw of [
      "a0:b1:c2:d3:e4:f5",
      "A0-B1-C2-D3-E4-F5",
      "a0b1c2d3e4f5",
      " A0:B1:C2:D3:E4:F5 ",
    ]) {
      expect(normalizeMacSerial(raw)).toBe("A0:B1:C2:D3:E4:F5");
    }
  });

  it("rejects placeholders, short ids and mixed separators", () => {
    for (const raw of [
      undefined,
      "",
      "00:00:00:00:00:00",
      "ff:ff:ff:ff:ff:ff",
      "a0:b1:c2:d3",
      "a0:b1:c2:d3:e4:f5:06",
      "a0:b1c2:d3:e4:f5",
      "g0:b1:c2:d3:e4:f5",
    ]) {
      expect(normalizeMacSerial(raw)).toBeNull();
    }
  });
});

describe("normalizeMultispeqReportedId", () => {
  it("normalizes the four reported bytes and refuses anything else", () => {
    expect(normalizeMultispeqReportedId("03:25:05:2a")).toBe("03:25:05:2A");
    expect(normalizeMultispeqReportedId("00:00:00:00")).toBeNull();
    expect(normalizeMultispeqReportedId("98:D3:31:03:25:05")).toBeNull();
  });
});

describe("multispeqAddressMatches", () => {
  it("accepts the reported bytes at either end of the address", () => {
    expect(multispeqAddressMatches("98:d3:31:03", "98:D3:31:03:25:05")).toBe(true);
    expect(multispeqAddressMatches("31:03:25:05", "98:D3:31:03:25:05")).toBe(true);
  });

  it("refuses bytes in the middle, a different unit or malformed input", () => {
    expect(multispeqAddressMatches("d3:31:03:25", "98:D3:31:03:25:05")).toBe(false);
    expect(multispeqAddressMatches("11:22:33:44", "98:D3:31:03:25:05")).toBe(false);
    expect(multispeqAddressMatches("31:03:25:05", "98:D3:31:03:25")).toBe(false);
  });
});
