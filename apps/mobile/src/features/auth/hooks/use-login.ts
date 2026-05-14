import { useMutation } from "@tanstack/react-query";
import {
  sendEmailLoginOtp,
  signInWithGitHub,
  signInWithOrcid,
  verifyEmailLoginOtp,
} from "~/features/auth/api/login.api";

export function useLoginFlow() {
  const github = useMutation({
    mutationFn: signInWithGitHub,
    onError: (error) => console.error("GitHub login error:", error),
  });

  const orcid = useMutation({
    mutationFn: signInWithOrcid,
    onError: (error) => console.error("ORCID login error:", error),
  });

  const sendOtp = useMutation({
    mutationFn: sendEmailLoginOtp,
    onError: (error) => console.error("Email OTP send error:", error),
  });

  const verifyOtp = useMutation({
    mutationFn: verifyEmailLoginOtp,
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
