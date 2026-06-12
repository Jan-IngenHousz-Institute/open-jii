"use client";

import { revalidateAuth } from "@/shared/api/revalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to verify email OTP and sign in
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await authClient.signIn.emailOtp({
        email,
        otp: code,
      });
      return response;
    },
    onSuccess: async (response) => {
      if (response.data) {
        // Update session cache
        queryClient.setQueryData(["auth", "session"], response.data);

        // Revalidate Next.js cache
        await revalidateAuth();
      }
    },
  });
}
