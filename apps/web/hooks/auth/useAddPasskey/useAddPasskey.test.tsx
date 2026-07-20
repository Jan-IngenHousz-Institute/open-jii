import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useAddPasskey } from "./useAddPasskey";

describe("useAddPasskey", () => {
  it("registers a passkey and invalidates the passkeys query", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddPasskey(), { queryClient });
    const data = await result.current.mutateAsync({ name: "MacBook" });

    expect(authClient.passkey.addPasskey).toHaveBeenCalledWith({ name: "MacBook" });
    expect(data).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
  });

  it("throws when the response is undefined", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useAddPasskey());

    await expect(result.current.mutateAsync({ name: "Phone" })).rejects.toThrow(
      "Passkey registration returned no response",
    );
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValue({
      data: null,
      error: { message: "Ceremony cancelled" },
    } as never);

    const { result } = renderHook(() => useAddPasskey());

    await expect(result.current.mutateAsync({ name: "Phone" })).rejects.toThrow(
      "Ceremony cancelled",
    );
  });
});
