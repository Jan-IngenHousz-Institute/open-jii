import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignInEmail } from "./useSignInEmail";

vi.mock("@repo/auth/client", () => ({
  authClient: { emailOtp: { sendVerificationOtp: vi.fn() } },
}));

describe("useSignInEmail", () => {
  it("calls sendVerificationOtp with email", async () => {
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useSignInEmail());
    await result.current.mutateAsync("test@example.com");

    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "sign-in",
    });
  });
});
