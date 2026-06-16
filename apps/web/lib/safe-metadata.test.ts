import { describe, it, expect, vi, afterEach } from "vitest";

import { safeMetadata } from "./safe-metadata";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeMetadata", () => {
  it("returns the built metadata when the builder succeeds", async () => {
    const result = await safeMetadata(() => Promise.resolve({ title: "Home" }));
    expect(result).toEqual({ title: "Home" });
  });

  it("falls back to empty metadata when the builder throws", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await safeMetadata(() => Promise.reject(new Error("Contentful 401")));
    expect(result).toEqual({});
    expect(warn).toHaveBeenCalled();
  });
});
