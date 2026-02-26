import { renderHook, createTestQueryClient } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useVerifyEmail } from "./useVerifyEmail";

describe("useVerifyEmail", () => {
  it("verifies email OTP and caches session", async () => {
    const mockSession = { user: { id: "1", email: "test@example.com" } };
    vi.mocked(authClient.signIn.emailOtp).mockResolvedValue({
      data: mockSession as never,
      error: null,
    });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useVerifyEmail(), { queryClient });

    await result.current.mutateAsync({ email: "test@example.com", code: "123456" });

    expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      otp: "123456",
    });
    expect(queryClient.getQueryData(["auth", "session"])).toEqual(mockSession);
  });
});
