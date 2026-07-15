import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useDeletePasskey } from "./useDeletePasskey";

describe("useDeletePasskey", () => {
  it("deletes the passkey and invalidates the passkeys query", async () => {
    vi.mocked(authClient.passkey.deletePasskey).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePasskey(), { queryClient });
    await result.current.mutateAsync({ id: "p1" });

    expect(authClient.passkey.deletePasskey).toHaveBeenCalledWith({ id: "p1" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.passkey.deletePasskey).mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const { result } = renderHook(() => useDeletePasskey());

    await expect(result.current.mutateAsync({ id: "missing" })).rejects.toThrow("Not found");
  });
});
