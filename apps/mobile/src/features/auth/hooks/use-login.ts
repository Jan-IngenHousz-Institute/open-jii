import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import {
  sendEmailLoginOtp,
  signInWithGitHub,
  signInWithOrcid,
  verifyEmailLoginOtp,
} from "~/features/auth/api/login.api";
import { getAuthClient } from "~/features/auth/services/auth";
import { hasSessionToken } from "~/shared/api/session-cookie";
import { ensureDeviceRegistered } from "~/shared/composition/ensure-device-registered";
import { prefetchOfflineData } from "~/shared/composition/prefetch-offline-data";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("auth");

// Bounded so a lookup that never answers still lets a real sign-in prefetch.
const SESSION_LOOKUP_TIMEOUT_MS = 8_000;

type SessionLookup =
  | { status: "valid"; userId: string }
  | { status: "none" }
  | { status: "unknown" };

async function lookUpSession(authClient: ReturnType<typeof getAuthClient>): Promise<SessionLookup> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SessionLookup>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ status: "unknown" });
    }, SESSION_LOOKUP_TIMEOUT_MS);
  });
  const lookup = authClient.getSession({ fetchOptions: { signal: controller.signal } }).then(
    (res): SessionLookup => {
      const userId = res?.data?.user?.id;
      if (userId) return { status: "valid", userId };
      return res?.error ? { status: "unknown" } : { status: "none" };
    },
    (): SessionLookup => ({ status: "unknown" }),
  );
  return Promise.race([lookup, timeout]).finally(() => clearTimeout(timeoutId));
}

export function useLoginFlow() {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();

  const prefetch = async () => {
    const authClient = getAuthClient();
    // Expo resolves cancelled OAuth as a redirect response; only a completed
    // sign-in writes a session token.
    if (!hasSessionToken(await authClient.getCookie())) return;

    // A leftover token can belong to a revoked session, so the server decides.
    // Only an answer without a user skips the work; a failed lookup still
    // prefetches, as long as the token survived it.
    const session = await lookUpSession(authClient);
    if (session.status === "none" || !hasSessionToken(await authClient.getCookie())) return;

    void prefetchOfflineData(queryClient, session.status === "valid" ? session.userId : undefined);
    void ensureDeviceRegistered();
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
      // A wrong or expired code is the user's to fix, not a bug to report.
      log.error("Email OTP verify error", { err: error?.message, report: false });
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
