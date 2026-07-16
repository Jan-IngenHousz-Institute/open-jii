import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignInPasskey } from "./useSignInPasskey";

describe("useSignInPasskey", () => {
  it("signs in with a passkey and invalidates auth queries", async () => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({ data: null, error: null } as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSignInPasskey(), { queryClient });
    const data = await result.current.mutateAsync(undefined);

    expect(authClient.signIn.passkey).toHaveBeenCalledWith(undefined);
    expect(data).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth"] });
  });

  it("passes autoFill through for conditional UI", async () => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({ data: null, error: null } as never);

    const { result } = renderHook(() => useSignInPasskey());
    await result.current.mutateAsync({ autoFill: true });

    expect(authClient.signIn.passkey).toHaveBeenCalledWith({ autoFill: true });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.signIn.passkey).mockResolvedValue({
      data: null,
      error: { message: "Ceremony cancelled" },
    } as never);

    const { result } = renderHook(() => useSignInPasskey());

    await expect(result.current.mutateAsync(undefined)).rejects.toThrow("Ceremony cancelled");
  });
});
