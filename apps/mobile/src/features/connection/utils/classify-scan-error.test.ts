import { describe, expect, it } from "vitest";

import { classifyScanError } from "./classify-scan-error";

describe("classifyScanError", () => {
  it.each([
    "Failed to write to device",
    "device not open",
    "Command timeout",
    "Command executor not initialized. No device connected.",
    "Transport not initialized",
    "Command cancelled",
  ])("classifies %s as disconnected", (message) => {
    expect(classifyScanError(new Error(message))).toBe("disconnected");
  });

  it("classifies a user-cancelled measurement as cancelled (not disconnected)", () => {
    expect(classifyScanError(new Error("Measurement cancelled"))).toBe("cancelled");
  });

  it("classifies an unknown failure as a generic scan error", () => {
    expect(classifyScanError(new Error("Invalid result"))).toBe("scanError");
  });

  it("handles non-Error values", () => {
    expect(classifyScanError("Command timeout")).toBe("disconnected");
    expect(classifyScanError(undefined)).toBe("scanError");
  });
});
