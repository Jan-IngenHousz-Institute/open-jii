import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";

import { useConfirmEmailChange } from "./useConfirmEmailChange";

describe("useConfirmEmailChange", () => {
  it("proves the address with its code and refreshes the session everywhere", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConfirmEmailChange(), { queryClient });
    await result.current.mutateAsync({ newEmail: "carol@uni.edu", otp: "123456" });

    expect(authClient.emailOtp.changeEmail).toHaveBeenCalledWith({
      newEmail: "carol@uni.edu",
      otp: "123456",
    });
    expect(authClient.$store.notify).toHaveBeenCalledWith("$sessionSignal");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth"] });
    expect(revalidateAuth).toHaveBeenCalled();
  });

  it("changes nothing on a wrong code and hands the refusal back", async () => {
    vi.mocked(authClient.emailOtp.changeEmail).mockResolvedValue({
      data: null,
      error: {
        code: "INVALID_OTP",
        message: "Invalid OTP",
        status: 400,
        statusText: "Bad Request",
      },
    });

    const { result } = renderHook(() => useConfirmEmailChange());
    const response = await result.current.mutateAsync({ newEmail: "carol@uni.edu", otp: "000000" });

    expect(response.error?.message).toBe("Invalid OTP");
    expect(authClient.$store.notify).not.toHaveBeenCalled();
    expect(revalidateAuth).not.toHaveBeenCalled();
  });
});
