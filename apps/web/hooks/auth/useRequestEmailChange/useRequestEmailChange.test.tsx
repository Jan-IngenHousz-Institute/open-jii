import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useRequestEmailChange } from "./useRequestEmailChange";

describe("useRequestEmailChange", () => {
  it("asks for a code for the new address", async () => {
    const { result } = renderHook(() => useRequestEmailChange());

    const response = await result.current.mutateAsync("carol@uni.edu");

    expect(authClient.emailOtp.requestEmailChange).toHaveBeenCalledWith({
      newEmail: "carol@uni.edu",
    });
    expect(response.data).toEqual({ success: true });
  });

  it("hands back a refusal for the form to show", async () => {
    vi.mocked(authClient.emailOtp.requestEmailChange).mockResolvedValue({
      data: null,
      error: {
        message: "This email is already associated with another account",
        status: 400,
        statusText: "Bad Request",
      },
    });

    const { result } = renderHook(() => useRequestEmailChange());
    const response = await result.current.mutateAsync("taken@uni.edu");

    expect(response.error?.message).toBe("This email is already associated with another account");
  });
});
