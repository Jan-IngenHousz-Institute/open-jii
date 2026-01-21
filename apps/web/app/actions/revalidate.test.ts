import { describe, it, expect, vi, beforeEach } from "vitest";

import { revalidateAuth } from "./revalidate";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("revalidateAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call revalidatePath with correct arguments", async () => {
    const { revalidatePath } = await import("next/cache");

    await revalidateAuth();

    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/platform", "layout");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("should be an async function", () => {
    expect(revalidateAuth).toBeInstanceOf(Function);
    expect(revalidateAuth.constructor.name).toBe("AsyncFunction");
  });

  it("should complete without errors", async () => {
    await expect(revalidateAuth()).resolves.toBeUndefined();
  });
});
