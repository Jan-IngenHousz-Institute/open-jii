"use client";

import { AuthClientError, unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LINKED_ACCOUNTS_KEY } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { useSignInAgainToast } from "~/hooks/auth/useSignInAgainToast/useSignInAgainToast";
import { PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Hook to disconnect an `accounts` row by its row id. The server refuses with
 * `LAST_SIGN_IN_METHOD` when the page was stale and this was the only way in left.
 */
export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("account");
  const toastSignInAgain = useSignInAgainToast();

  return useMutation({
    mutationFn: async (input: { accountId: string; provider: ConnectableProvider }) =>
      unwrapAuthResult(await authClient.unlinkAccount({ accountId: input.accountId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_KEY });
    },
    onError: (error, { provider }) => {
      const code = error instanceof AuthClientError ? error.code : undefined;
      if (code === "SESSION_NOT_FRESH") {
        toastSignInAgain(t("signInMethods.sessionTooOld"), t("signInMethods.signInAgain"));
      } else if (code === "LAST_SIGN_IN_METHOD") {
        toast({ description: t("signInMethods.lastSignInMethod"), variant: "destructive" });
      } else {
        toast({
          description: t("signInMethods.disconnectError", { provider: PROVIDER_NAMES[provider] }),
          variant: "destructive",
        });
      }
    },
  });
}
