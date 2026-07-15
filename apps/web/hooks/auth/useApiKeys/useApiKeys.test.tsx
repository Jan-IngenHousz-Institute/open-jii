import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useApiKeys } from "./useApiKeys";

describe("useApiKeys", () => {
  it("lists API keys sorted by createdAt descending", async () => {
    const apiKeys = [{ id: "k1", name: "CI key" }];
    vi.mocked(authClient.apiKey.list).mockResolvedValue({
      data: { apiKeys, total: 1 },
      error: null,
    });

    const { result } = renderHook(() => useApiKeys());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authClient.apiKey.list).toHaveBeenCalledWith({
      query: { sortBy: "createdAt", sortDirection: "desc" },
    });
    expect(result.current.data).toEqual({ apiKeys, total: 1 });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.apiKey.list).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized" },
    });

    const { result } = renderHook(() => useApiKeys());
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error("Unauthorized"));
  });
});
