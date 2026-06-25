import { describe, expect, it } from "vitest";

import { classifyScanError } from "./classify-scan-error";

describe("classifyScanError", () => {
  it.each([
    "Failed to write to device",
    "Command timeout",
    "Command executor not initialized. No device connected.",
    "Transport not initialized",
  ])("classifies %s as disconnected", (message) => {
    expect(classifyScanError(new Error(message))).toBe("disconnected");
  });

  it("classifies a cancelled measurement as cancelled", () => {
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
