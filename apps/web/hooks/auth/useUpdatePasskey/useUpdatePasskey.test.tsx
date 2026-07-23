import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useUpdatePasskey } from "./useUpdatePasskey";

describe("useUpdatePasskey", () => {
  it("renames the passkey and invalidates the passkeys query", async () => {
    vi.mocked(authClient.passkey.updatePasskey).mockResolvedValue({
      data: { passkey: { id: "p1", name: "Work laptop" } },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePasskey(), { queryClient });
    await result.current.mutateAsync({ id: "p1", name: "Work laptop" });

    expect(authClient.passkey.updatePasskey).toHaveBeenCalledWith({
      id: "p1",
      name: "Work laptop",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.passkey.updatePasskey).mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const { result } = renderHook(() => useUpdatePasskey());

    await expect(result.current.mutateAsync({ id: "missing", name: "x" })).rejects.toThrow(
      "Not found",
    );
  });
});
