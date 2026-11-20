import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import type { CompleteRegistrationInput } from "~/features/auth/api/registration.api";
import { completeRegistration, subscribeToNewsletter } from "~/features/auth/api/registration.api";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("registration");

export interface RegisterInput extends CompleteRegistrationInput {
  newsletterOptIn: boolean;
}

export function useRegistration() {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ newsletterOptIn, ...profile }: RegisterInput) => {
      await completeRegistration(profile);
      return { newsletterOptIn };
    },
    onSuccess: ({ newsletterOptIn }) => {
      // The greeting and profile screen cached a 404 for the profile that now exists.
      void queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });

      if (newsletterOptIn) {
        subscribeToNewsletter().catch((error: unknown) => {
          log.warn("newsletter opt-in failed", { err: (error as Error)?.message });
          toast.error(t("registration.newsletterOptInError"));
        });
      }

      toast.success(t("registration.successMessage"));
    },
    onError: (error) => {
      log.error("registration failed", { err: error?.message });
      toast.error(t("registration.errorMessage"));
    },
  });
}
