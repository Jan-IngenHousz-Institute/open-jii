import { useAsyncCallback } from "react-async-hook";
import { authClient } from "~/lib/auth-client";

export function useLoginFlow() {
  const { execute: startGitHubLogin, loading: githubLoading } = useAsyncCallback(async () => {
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("GitHub login error:", error);
      throw error;
    }
  });

  const { execute: startOrcidLogin, loading: orcidLoading } = useAsyncCallback(async () => {
    try {
      await authClient.signIn.oauth2({
        providerId: "orcid",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("ORCID login error:", error);
      throw error;
    }
  });

  const { execute: sendEmailOTP, loading: emailLoading } = useAsyncCallback(
    async (email: string) => {
      try {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "sign-in",
        });
        return result;
      } catch (error) {
        console.error("Email OTP send error:", error);
        throw error;
      }
    },
  );

  const { execute: verifyEmailOTP, loading: verifyLoading } = useAsyncCallback(
    async (email: string, code: string) => {
      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: code,
        });
        return result;
      } catch (error) {
        console.error("Email OTP verify error:", error);
        throw error;
      }
    },
  );

  return {
    startGitHubLogin,
    startOrcidLogin,
    sendEmailOTP,
    verifyEmailOTP,
    loading: githubLoading || orcidLoading || emailLoading || verifyLoading,
  };
}
