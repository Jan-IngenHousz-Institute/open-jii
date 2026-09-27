import { revalidatePath } from "next/cache";
import { describe, it, expect, vi } from "vitest";

import { revalidateAuth } from "./revalidate";

// This file tests the real revalidateAuth() function — unmock the global stub.
vi.unmock("~/app/actions/revalidate");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("revalidateAuth", () => {
  it("revalidates from the locale layout down, which decides the viewer's language", async () => {
    await revalidateAuth();
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });
});
