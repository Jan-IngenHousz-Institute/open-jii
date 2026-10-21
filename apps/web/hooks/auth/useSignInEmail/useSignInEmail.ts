"use client";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";
import { retryAfterSeconds, retryAfterTranslation } from "@repo/auth/rate-limit/retry-after";
import { useTranslation } from "@repo/i18n/client";

/**
 * Hook to sign in with email (sends OTP)
 */
export function useSignInEmail() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (email: string) => {
      // Send verification email with OTP
      let retrySeconds: number | undefined;
      const response = await authClient.emailOtp.sendVerificationOtp(
        {
          email,
          type: "sign-in",
        },
        {
          onError: ({ response }) => {
            retrySeconds = retryAfterSeconds(response.headers);
          },
        },
      );
      if (response.error?.status === 429) {
        return {
          ...response,
          error: {
            ...response.error,
            message: t("auth.rateLimited", retryAfterTranslation(retrySeconds)),
          },
        };
      }
      return response;
    },
  });
}
