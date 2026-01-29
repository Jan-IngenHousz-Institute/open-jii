"use client";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to sign in with email (sends OTP)
 */
export function useSignInEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      // Send verification email with OTP
      const response = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      return response;
    },
  });
}
