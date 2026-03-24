/**
 * Hook to access the current user session.
 *
 * Uses Better Auth's useSession() as the primary source. When offline,
 * Better Auth can't validate the session and returns null — in that case
 * we fall back to the SecureStore cache written by the expo client plugin.
 */
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { useAuthClient } from "~/services/auth";

const SESSION_CACHE_KEY = "openjii_session_data";

function getCachedSession() {
  const raw = SecureStore.getItem(SESSION_CACHE_KEY);
  if (!raw || raw === "{}") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

  // If we have a cached session, consider loaded immediately so the
  // splash screen hides without waiting for server validation.
  const isLoaded = !isPending || !!cachedSession;

  return {
    session,
    isLoaded,
    isPending,
    error,
    user: activeSession?.user,
    signOut: async () => {
      SecureStore.setItem(SESSION_CACHE_KEY, "{}");
      await authClient.signOut();
    },
  };
}
