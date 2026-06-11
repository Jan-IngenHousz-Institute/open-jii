import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import {
  sendEmailLoginOtp,
  signInWithGitHub,
  signInWithOrcid,
  verifyEmailLoginOtp,
} from "~/features/auth/api/login.api";
import { getAuthClient } from "~/features/auth/services/auth";
import { prefetchOfflineData } from "~/shared/db/prefetch-offline-data";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("auth");

export function useLoginFlow() {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();

  const prefetch = async () => {
    // Resolve the freshly-signed-in userId so the profile prefetch has a target.
    const session = await getAuthClient()
      .getSession()
      .catch(() => null);
    const userId = session?.data?.user?.id;
    void prefetchOfflineData(queryClient, userId);
  };

  const github = useMutation({
    mutationFn: signInWithGitHub,
    onSuccess: prefetch,
    onError: (error) => {
      log.error("GitHub login error", { err: error?.message });
      toast.error(t("errors.loginFailed"));
    },
  });

  const orcid = useMutation({
    mutationFn: signInWithOrcid,
    onSuccess: prefetch,
    onError: (error) => {
      log.error("ORCID login error", { err: error?.message });
      toast.error(t("errors.loginFailed"));
    },
  });

  const sendOtp = useMutation({
    mutationFn: sendEmailLoginOtp,
    onError: (error) => {
      log.error("Email OTP send error", { err: error?.message });
      toast.error(t("errors.sendFailed"));
    },
  });

  const verifyOtp = useMutation({
    mutationFn: verifyEmailLoginOtp,
    // Better Auth returns { error } on soft-failure rather than throwing; only
    // prefetch when the verify actually succeeded.
    onSuccess: (result) => {
      if (!result?.error) prefetch();
    },
    onError: (error) => {
      log.error("Email OTP verify error", { err: error?.message });
      toast.error(t("errors.verifyFailed"));
    },
  });

  return {
    startGitHubLogin: () => github.mutateAsync(),
    startOrcidLogin: () => orcid.mutateAsync(),
    sendEmailOTP: (email: string) => sendOtp.mutateAsync(email),
    verifyEmailOTP: (email: string, code: string) => verifyOtp.mutateAsync({ email, code }),
    githubLoading: github.isPending,
    orcidLoading: orcid.isPending,
    emailLoading: sendOtp.isPending,
    verifyLoading: verifyOtp.isPending,
  };
}
