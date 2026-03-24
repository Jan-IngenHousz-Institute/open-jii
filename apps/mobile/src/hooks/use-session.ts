/**
 * Hook to access the current user session using Better Auth
 */
import { useMemo } from "react";
import { useAuthClient } from "~/services/auth";

export function useSession() {
  const authClient = useAuthClient();
  const { data: session, isPending, error } = authClient.useSession();
  // console.log("useSession:", { session, isPending, error });

  const mappedSession = useMemo(
    () =>
      session
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.user.id, session?.session.expiresAt],
  );

  return {
    session: mappedSession,
    isLoaded: !isPending,
    isPending,
    error,
    // For compatibility with Better Auth
    user: session?.user,
    // Actions
    signOut: () => authClient.signOut(),
  };
}
