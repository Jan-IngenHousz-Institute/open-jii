import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useDeleteApiKey } from "./useDeleteApiKey";

describe("useDeleteApiKey", () => {
  it("deletes the key and invalidates the api-keys query", async () => {
    vi.mocked(authClient.apiKey.delete).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteApiKey(), { queryClient });
    await result.current.mutateAsync({ keyId: "k1" });

    expect(authClient.apiKey.delete).toHaveBeenCalledWith({ keyId: "k1" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "api-keys"] });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.apiKey.delete).mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const { result } = renderHook(() => useDeleteApiKey());

    await expect(result.current.mutateAsync({ keyId: "missing" })).rejects.toThrow("Not found");
  });
});
