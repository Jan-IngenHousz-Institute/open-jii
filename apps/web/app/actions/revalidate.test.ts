import { refresh } from "next/cache";
import { describe, it, expect, vi } from "vitest";

import { revalidateAuth } from "./revalidate";

// This file tests the real revalidateAuth() function — unmock the global stub.
vi.unmock("~/app/actions/revalidate");
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

describe("revalidateAuth", () => {
  it("refreshes the browser's pages without purging the server's", async () => {
    await revalidateAuth();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
