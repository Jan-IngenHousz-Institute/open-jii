import { describe, expect, it } from "vitest";

import { canonicalMultispeqSerial } from "./multispeq-identity";

describe("canonicalMultispeqSerial", () => {
  it("keeps the four Bluetooth MAC bytes in lowercase colon form", () => {
    expect(canonicalMultispeqSerial("03:25:05:25")).toBe("03:25:05:25");
  });

  it("lowercases a firmware that reports uppercase hex", () => {
    expect(canonicalMultispeqSerial("AB:CD:EF:01")).toBe("ab:cd:ef:01");
  });

  it("trims surrounding whitespace", () => {
    expect(canonicalMultispeqSerial("  0a:1b:2c:3d\n")).toBe("0a:1b:2c:3d");
  });

  it.each([
    ["a six-byte address, which it never truncates", "00:11:22:33:44:55"],
    ["compact bytes without colons", "03250525"],
    ["three bytes", "03:25:05"],
    ["non-hex characters", "03:25:05:zz"],
    ["the mobile mock id", "mock-1"],
    ["a name", "MultispeQ v2.0"],
    ["the all-zero placeholder", "00:00:00:00"],
    ["the all-ff placeholder", "FF:FF:FF:FF"],
    ["an empty string", ""],
  ])("rejects %s", (_label, raw) => {
    expect(canonicalMultispeqSerial(raw)).toBeNull();
  });

  it("rejects a missing identity", () => {
    expect(canonicalMultispeqSerial(undefined)).toBeNull();
  });
});
