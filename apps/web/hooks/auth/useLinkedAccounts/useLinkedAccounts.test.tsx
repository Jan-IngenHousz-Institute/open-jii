import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useLinkedAccounts } from "./useLinkedAccounts";

const GITHUB_ROW = {
  id: "row-1",
  providerId: "github",
  accountId: "583231",
  userId: "user-1",
  scopes: [],
  createdAt: new Date("2026-11-01"),
  updatedAt: new Date("2026-11-01"),
};

describe("useLinkedAccounts", () => {
  it("lists the person's account rows", async () => {
    vi.mocked(authClient.listAccounts).mockResolvedValue({ data: [GITHUB_ROW], error: null });

    const { result } = renderHook(() => useLinkedAccounts());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([GITHUB_ROW]);
  });

  it("enters the error state when the list is refused", async () => {
    vi.mocked(authClient.listAccounts).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
    });

    const { result } = renderHook(() => useLinkedAccounts());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });
});
