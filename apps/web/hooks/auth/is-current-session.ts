import { onlineManager } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

async function getVerifiedSession() {
  // Recovery may run after unmount, before the browser's session hook observes a sign-out.
  try {
    const { data, error } = await authClient.getSession({
      query: { disableCookieCache: true, disableRefresh: true },
    });
    if (error) return error.status === 401 ? null : undefined;
    return data;
  } catch {
    return undefined;
  }
}

export async function isCurrentSession(sessionId: string | undefined): Promise<boolean> {
  return !!sessionId && (await getVerifiedSession())?.session.id === sessionId;
}

export async function waitForCurrentSession(
  queryClient: QueryClient,
  userId: string | undefined,
  sessionId: string | undefined,
): Promise<boolean> {
  if (!userId || !sessionId) return false;

  for (;;) {
    const retry = Promise.withResolvers<void>();
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) retry.resolve();
    });
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success" && !event.action.manual) {
        retry.resolve();
      }
    });
    try {
      const session = await getVerifiedSession();
      if (session === null) return false;
      if (session) return session.user.id === userId && session.session.id === sessionId;
      await retry.promise;
    } finally {
      unsubscribeOnline();
      unsubscribeQueries();
    }
  }
}
