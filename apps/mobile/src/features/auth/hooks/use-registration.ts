import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner-native";
import type { ProfileInput } from "~/features/auth/api/registration.api";
import {
  confirmRegistered,
  saveProfile,
  subscribeToNewsletter,
} from "~/features/auth/api/registration.api";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("registration");

export interface RegisterInput extends ProfileInput {
  newsletterOptIn: boolean;
}

// Mailchimp refuses to re-add an address erased on request, so retrying later cannot help.
function isForgottenNewsletterEmail(error: unknown): boolean {
  return (
    error instanceof ORPCError &&
    (error.data as { code?: string } | undefined)?.code === "MAILCHIMP_FORGOTTEN_EMAIL"
  );
}

export function useRegistration() {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();
  // A retry after a failed session refresh must not subscribe a second time.
  const newsletterRequested = useRef(false);

  function requestNewsletter() {
    newsletterRequested.current = true;
    subscribeToNewsletter().catch((error: unknown) => {
      log.warn("newsletter opt-in failed", { err: (error as Error)?.message });
      toast.error(
        isForgottenNewsletterEmail(error)
          ? t("registration.newsletterForgottenEmail")
          : t("registration.newsletterOptInError"),
      );
    });
  }

  return useMutation({
    mutationFn: async ({ newsletterOptIn, ...profile }: RegisterInput) => {
      await saveProfile(profile);
      // The account is registered from here on, even if refreshing the session below fails.
      void queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });
      if (newsletterOptIn && !newsletterRequested.current) requestNewsletter();

      await confirmRegistered();
    },
    onSuccess: () => {
      toast.success(t("registration.successMessage"));
    },
    onError: (error) => {
      log.error("registration failed", { err: error?.message });
      toast.error(t("registration.errorMessage"));
    },
  });
}
