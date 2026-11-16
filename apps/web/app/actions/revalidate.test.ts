import { revalidatePath } from "next/cache";
import { describe, it, expect, vi } from "vitest";

import { revalidateAuth } from "./revalidate";

// This file tests the real revalidateAuth() function, so it unmocks the global stub.
vi.unmock("~/app/actions/revalidate");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("revalidateAuth", () => {
  it("revalidates the platform layout, which no public page shares", async () => {
    await revalidateAuth();
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/[locale]/platform", "layout");
  });
});
