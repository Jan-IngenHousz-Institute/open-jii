"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";
import { retryAfterSeconds } from "@repo/auth/rate-limit/retry-after";
import { useTranslation } from "@repo/i18n/client";

/**
 * Hook to verify email OTP and sign in
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      let retrySeconds: number | undefined;
      const response = await authClient.signIn.emailOtp(
        {
          email,
          otp: code,
        },
        {
          onError: ({ response }) => {
            retrySeconds = retryAfterSeconds(response.headers);
          },
        },
      );
      if (response.error?.status === 429) {
        let context: string | undefined;
        if (retrySeconds !== undefined) context = "timed";
        return {
          ...response,
          error: {
            ...response.error,
            message: t("auth.rateLimited", { context, count: retrySeconds }),
          },
        };
      }
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
