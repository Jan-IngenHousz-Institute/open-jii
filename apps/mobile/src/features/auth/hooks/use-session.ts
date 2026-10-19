/**
 * Hook to access the current user session.
 *
 * Uses Better Auth's useSession() as the primary source. When offline,
 * Better Auth can't validate the session and returns null — in that case
 * we fall back to the SecureStore cache written by the expo client plugin.
 */
import { useEffect, useState } from "react";
import { useAuthClient } from "~/features/auth/services/auth";
import { clearCachedSession, getCachedSession } from "~/features/auth/services/session-cache";

export function useSession() {
  const authClient = useAuthClient();
  const { data: betterAuthSession, isPending, error } = authClient.useSession();
  const [cachedSession, setCachedSession] = useState(() => getCachedSession());

  // Re-check cache when Better Auth finishes loading but has no session
  useEffect(() => {
    if (!isPending && !betterAuthSession) {
      setCachedSession(getCachedSession());
    }
  }, [isPending, betterAuthSession]);

  // Use Better Auth session when available, fall back to cache
  const activeSession = betterAuthSession ?? cachedSession;

  // If we have a cached session, consider loaded immediately so the
  // splash screen hides without waiting for server validation.
  const isLoaded = !isPending || !!cachedSession;

  const session = activeSession
    ? {
        data: {
          user: {
            id: activeSession.user?.id,
            name: activeSession.user?.name,
            email: activeSession.user?.email,
            image: activeSession.user?.image,
          },
          expires: activeSession.session?.expiresAt
            ? new Date(activeSession.session.expiresAt).toISOString()
            : undefined,
        },
      }
    : undefined;

  return {
    session,
    isLoaded,
    isPending,
    error,
    user: activeSession?.user,
    signOut: async () => {
      clearCachedSession();
      try {
        await authClient.signOut();
      } catch {
        // Network call may fail offline — that's fine,
        // the server session will expire on its own.
      }
    },
  };
}
