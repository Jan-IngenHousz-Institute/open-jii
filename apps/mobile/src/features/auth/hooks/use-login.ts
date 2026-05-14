import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sendEmailLoginOtp,
  signInWithGitHub,
  signInWithOrcid,
  verifyEmailLoginOtp,
} from "~/features/auth/api/login.api";
import { prefetchOfflineData } from "~/shared/db/prefetch-offline-data";

export function useLoginFlow() {
  const queryClient = useQueryClient();

  const prefetch = () => {
    void prefetchOfflineData(queryClient);
  };

  const github = useMutation({
    mutationFn: signInWithGitHub,
    onSuccess: prefetch,
    onError: (error) => console.error("GitHub login error:", error),
  });

  const orcid = useMutation({
    mutationFn: signInWithOrcid,
    onSuccess: prefetch,
    onError: (error) => console.error("ORCID login error:", error),
  });

  const sendOtp = useMutation({
    mutationFn: sendEmailLoginOtp,
    onError: (error) => console.error("Email OTP send error:", error),
  });

  const verifyOtp = useMutation({
    mutationFn: verifyEmailLoginOtp,
    // Better Auth returns { error } on soft-failure rather than throwing; only
    // prefetch when the verify actually succeeded.
    onSuccess: (result) => {
      if (!result?.error) prefetch();
    },
    onError: (error) => console.error("Email OTP verify error:", error),
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
