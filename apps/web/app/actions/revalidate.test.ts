import { describe, it, expect, vi } from "vitest";

import { revalidateAuth } from "./revalidate";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("revalidateAuth", () => {
  it("calls revalidatePath with the platform layout", async () => {
    const { revalidatePath } = await import("next/cache");
    await revalidateAuth();
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/platform", "layout");
  });
});
