import { authClient } from "@repo/auth/client";

export async function isCurrentSession(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return false;

  // Recovery may run after unmount, before the browser's session hook observes a sign-out.
  const session = await authClient
    .getSession({ query: { disableCookieCache: true, disableRefresh: true } })
    .catch(() => null);
  return session?.data?.session.id === sessionId;
}
