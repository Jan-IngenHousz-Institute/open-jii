import { getAuthClient } from "~/features/auth/services/auth";

export async function signInWithGitHub() {
  const authClient = getAuthClient();
  await authClient.signIn.social({ provider: "github", callbackURL: "/" });
}

export async function signInWithOrcid() {
  const authClient = getAuthClient();
  // Absolute URL with the app scheme so the OAuth provider redirects back into the app.
  await authClient.signIn.oauth2({
    providerId: "orcid",
    callbackURL: "openjii://(tabs)/",
  });
}

export async function sendEmailLoginOtp(email: string) {
  const authClient = getAuthClient();
  return authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
}

export interface VerifyEmailOtpInput {
  email: string;
  code: string;
}

export async function verifyEmailLoginOtp({ email, code }: VerifyEmailOtpInput) {
  const authClient = getAuthClient();
  return authClient.signIn.emailOtp({ email, otp: code });
}
