"use client";

import { AuthClientError, unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { useLocale } from "@/hooks/useLocale";
import { useMutation } from "@tanstack/react-query";
import { env } from "~/env";
import { useSignInAgainToast } from "~/hooks/auth/useSignInAgainToast/useSignInAgainToast";
import { PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Hook to connect a GitHub or ORCID account to the signed-in one. On success the client
 * follows the provider's URL itself, and the provider returns the person to Security
 * with `connected=` or, through Better Auth's error redirect, `connect=` and `error=`.
 * The provider rides in our own parameter because the error redirect carries only a code.
 */
export function useConnectAccount() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const toastSignInAgain = useSignInAgainToast();

  return useMutation({
    mutationFn: async (provider: ConnectableProvider) => {
      const security = `${env.NEXT_PUBLIC_BASE_URL}/${locale}/platform/account/security`;
      return unwrapAuthResult(
        await authClient.linkSocial({
          provider,
          callbackURL: `${security}?connected=${provider}`,
          errorCallbackURL: `${security}?connect=${provider}`,
        }),
      );
    },
    onError: (error, provider) => {
      if (error instanceof AuthClientError && error.code === "SESSION_NOT_FRESH") {
        toastSignInAgain(t("signInMethods.sessionTooOld"), t("signInMethods.signInAgain"));
        return;
      }
      toast({
        description: t("signInMethods.connectDidNotFinish", { provider: PROVIDER_NAMES[provider] }),
        variant: "destructive",
      });
    },
  });
}
