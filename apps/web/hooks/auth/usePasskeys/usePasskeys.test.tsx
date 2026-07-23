import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { usePasskeys } from "./usePasskeys";

describe("usePasskeys", () => {
  it("lists the user's passkeys", async () => {
    const passkeys = [{ id: "p1", name: "MacBook", backedUp: true }];
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: passkeys,
      error: null,
    });

    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authClient.passkey.listUserPasskeys).toHaveBeenCalled();
    expect(result.current.data).toEqual(passkeys);
  });

  it("throws when the response contains an error", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: null,
      error: { message: "Unauthorized" },
    });

    const { result } = renderHook(() => usePasskeys());
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error("Unauthorized"));
  });
});
