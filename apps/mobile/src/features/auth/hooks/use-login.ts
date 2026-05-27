import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sendEmailLoginOtp,
  signInWithGitHub,
  signInWithOrcid,
  verifyEmailLoginOtp,
} from "~/features/auth/api/login.api";
import { prefetchOfflineData } from "~/shared/db/prefetch-offline-data";
import { createLogger } from "~/shared/utils/logger";

const log = createLogger("auth");

export function useLoginFlow() {
  const queryClient = useQueryClient();

  const prefetch = () => {
    void prefetchOfflineData(queryClient);
  };

  const github = useMutation({
    mutationFn: signInWithGitHub,
    onSuccess: prefetch,
    onError: (error) => log.error("GitHub login error", { err: error?.message }),
  });

  const orcid = useMutation({
    mutationFn: signInWithOrcid,
    onSuccess: prefetch,
    onError: (error) => log.error("ORCID login error", { err: error?.message }),
  });

  const sendOtp = useMutation({
    mutationFn: sendEmailLoginOtp,
    onError: (error) => log.error("Email OTP send error", { err: error?.message }),
  });

  const verifyOtp = useMutation({
    mutationFn: verifyEmailLoginOtp,
    // Better Auth returns { error } on soft-failure rather than throwing; only
    // prefetch when the verify actually succeeded.
    onSuccess: (result) => {
      if (!result?.error) prefetch();
    },
    onError: (error) => log.error("Email OTP verify error", { err: error?.message }),
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
