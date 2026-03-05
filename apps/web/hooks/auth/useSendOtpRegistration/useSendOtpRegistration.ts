"use client";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to send an email verification OTP (used during registration)
 */
export function useSendOtpRegistration() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      return response;
    },
  });
}
