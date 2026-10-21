import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useAuthClient } from "~/features/auth/services/auth";
import {
  clearLocalCredentials,
  readCachedSession,
  sessionRevision,
  subscribeSessionCache,
  validLocalSession,
} from "~/features/auth/services/session-cache";

export function useSession() {
  const authClient = useAuthClient();
  const { data: betterAuthSession, isPending, error } = authClient.useSession();
  useSyncExternalStore(subscribeSessionCache, sessionRevision);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setTick((value) => value + 1);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  const cachedSession = readCachedSession();
  let activeSession = validLocalSession(betterAuthSession ?? cachedSession);
  // An authoritative empty response must not resurrect a cached guest.
  if (!betterAuthSession && !isPending && !error && cachedSession?.user.isAnonymous)
    activeSession = null;
  let rejectedGuestId: string | undefined;
  if (!activeSession && (betterAuthSession?.user.isAnonymous || cachedSession?.user.isAnonymous)) {
    rejectedGuestId = betterAuthSession?.user.id ?? cachedSession?.user.id;
  }
  useEffect(() => {
    if (!rejectedGuestId) return;
    try {
      clearLocalCredentials(rejectedGuestId, true);
    } catch {
      /* The identity is revoked in memory even if secure storage fails. */
    }
  }, [rejectedGuestId]);
  const session = activeSession
    ? {
        data: {
          user: activeSession.user,
          expires: activeSession.session.expiresAt
            ? new Date(activeSession.session.expiresAt).toISOString()
            : undefined,
        },
      }
    : undefined;
  return {
    session,
    isLoaded: !isPending || !!activeSession || !!rejectedGuestId,
    isPending,
    error,
    user: activeSession?.user,
    signOut: async () => {
      const id = activeSession?.user.id;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve();
        }, 5_000);
      });
      try {
        await Promise.race([
          authClient.signOut({ fetchOptions: { signal: controller.signal } }),
          deadline,
        ]);
      } catch {
        /* Local departure also works offline. */
      } finally {
        clearTimeout(timer);
        try {
          clearLocalCredentials(id);
        } finally {
          const atom = authClient.$store.atoms.session;
          atom.set({ ...atom.get(), data: null, error: null, isPending: false });
        }
      }
    },
  };
}
