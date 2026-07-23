import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useCreateApiKey } from "./useCreateApiKey";

describe("useCreateApiKey", () => {
  it("creates a key and invalidates the api-keys query", async () => {
    vi.mocked(authClient.apiKey.create).mockResolvedValue({
      data: { id: "k1", key: "jii_abc123" },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateApiKey(), { queryClient });
    const data = await result.current.mutateAsync({ name: "CI key", expiresIn: 86400 });

    expect(authClient.apiKey.create).toHaveBeenCalledWith({ name: "CI key", expiresIn: 86400 });
    expect(data).toEqual({ id: "k1", key: "jii_abc123" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "api-keys"] });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.apiKey.create).mockResolvedValue({
      data: null,
      error: { message: "Name taken" },
    });

    const { result } = renderHook(() => useCreateApiKey());

    await expect(result.current.mutateAsync({ name: "dup" })).rejects.toThrow("Name taken");
  });
});
