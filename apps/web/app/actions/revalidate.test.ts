import { describe, it, expect, vi } from "vitest";

import { revalidateAuth } from "./revalidate";

// This file tests the real revalidateAuth() function — unmock the global stub.
vi.unmock("~/app/actions/revalidate");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("revalidateAuth", () => {
  it("calls revalidatePath with the platform layout", async () => {
    const { revalidatePath } = await import("next/cache");
    await revalidateAuth();
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/platform", "layout");
  });
});
