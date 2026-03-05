"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to verify an email address using an OTP (used during registration)
 */
export function useVerifyOtpRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const response = await authClient.emailOtp.verifyEmail({ email, otp });
      return response;
    },
    onSuccess: async (response) => {
      if (response.data) {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
      }
    },
  });
}
