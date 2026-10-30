import { useEffect, useSyncExternalStore } from "react";
import { useAuthClient } from "~/features/auth/services/auth";
import {
  clearLocalCredentials,
  currentSession,
  expireGuest,
  readCachedSession,
  recordGuestClock,
  sessionClock,
  sessionRevision,
} from "~/features/auth/services/session-cache";
import { subscribeSession } from "~/features/auth/services/session-clock";

export function useSession() {
  const authClient = useAuthClient();
  const { data: betterAuthSession, isPending, error } = authClient.useSession();
  useSyncExternalStore(subscribeSession, sessionRevision);
  const cachedSession = readCachedSession();
  const now = sessionClock();
  const assessed = currentSession(betterAuthSession ?? cachedSession);
  let activeSession = assessed.session;
  let expired = assessed.expired;
  // An authoritative empty response must not resurrect a cached guest.
  if (!betterAuthSession && !isPending && !error && cachedSession?.user.isAnonymous) {
    expired ||= activeSession !== null;
    activeSession = null;
  }
  let rejectedGuestId: string | undefined;
  if (!activeSession && (betterAuthSession?.user.isAnonymous || cachedSession?.user.isAnonymous)) {
    rejectedGuestId = betterAuthSession?.user.id ?? cachedSession?.user.id;
  }
  const guestId = activeSession?.user.isAnonymous ? activeSession.user.id : undefined;
  useEffect(() => {
    if (!guestId) return;
    try {
      recordGuestClock(guestId, now);
    } catch {
      /* The mark is kept in memory even if secure storage fails. */
    }
  }, [guestId, now]);
  useEffect(() => {
    if (!rejectedGuestId || !expired) return;
    try {
      expireGuest(rejectedGuestId);
    } catch {
      /* The identity is revoked in memory even if secure storage fails. */
    }
  }, [rejectedGuestId, expired]);
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
