"use client";

import { NOTIFICATIONS_KEY } from "@/hooks/notifications/useNotifications/useNotifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignInAgainToast } from "~/hooks/auth/useSignInAgainToast/useSignInAgainToast";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Better Auth registers a passkey only on a session created within its fresh age
 * (a day); renewing a session never resets that, so only a new sign-in does.
 */
export class PasskeySessionTooOldError extends Error {
  name = "PasskeySessionTooOldError";
}

export interface UseAddPasskeyOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to register a new passkey (triggers the WebAuthn ceremony).
 * The register response always resolves with { data, error }, so errors
 * (including user cancellation) are rethrown for onError handling, which toasts.
 * Callers use `mutate`; `mutateAsync` would also reject after the toast.
 */
export function useAddPasskey(options: UseAddPasskeyOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("account");
  const toastSignInAgain = useSignInAgainToast();

  return useMutation({
    mutationFn: async (input: { name?: string }) => {
      // Runtime can resolve undefined despite the client types.
      const response = (await authClient.passkey.addPasskey(input)) as
        | Awaited<ReturnType<typeof authClient.passkey.addPasskey>>
        | undefined;
      if (!response) throw new Error("Passkey registration returned no response");
      if (
        response.error &&
        "code" in response.error &&
        response.error.code === "SESSION_NOT_FRESH"
      ) {
        throw new PasskeySessionTooOldError(response.error.message);
      }
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      options.onSuccess?.();
    },
    onError: (error) => {
      if (error instanceof PasskeySessionTooOldError) {
        toastSignInAgain(t("passkeys.sessionTooOld"), t("passkeys.signInAgain"));
      } else {
        toast({ description: t("passkeys.addError"), variant: "destructive" });
      }
      options.onError?.(error);
    },
  });
}
