/**
 * Hook to access the current user session using Better Auth
 */
import { authClient } from "~/lib/auth-client";

export function useSession() {
  const { data: session, isPending, error } = authClient.useSession();

  return {
    session: session
      ? {
          data: {
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            },
            expires: new Date(session.session.expiresAt).toISOString(),
          },
        }
      : undefined,
    isLoaded: !isPending,
    isPending,
    error,
    // For compatibility with Better Auth
    user: session?.user,
    // Actions
    signOut: () => authClient.signOut(),
  };
}

// Export a compatibility hook name
export { useSession as useSessionStore };
