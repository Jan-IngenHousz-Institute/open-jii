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

export async function checkCurrentSession(sessionId: string | undefined) {
  if (!sessionId) return "changed";
  const session = await getVerifiedSession();
  if (session === undefined) return "unknown";
  return session?.session.id === sessionId ? "current" : "changed";
}

export async function isCurrentSession(sessionId: string | undefined): Promise<boolean> {
  return (await checkCurrentSession(sessionId)) === "current";
}

export async function waitForCurrentSession(
  queryClient: QueryClient,
  userId: string | undefined,
  sessionId: string | undefined,
): Promise<boolean> {
  if (!userId || !sessionId) return false;

  for (;;) {
    let resolveRetry!: () => void;
    const retry = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) resolveRetry();
    });
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success" && !event.action.manual) {
        resolveRetry();
      }
    });
    try {
      const session = await getVerifiedSession();
      if (session === null) return false;
      if (session) return session.user.id === userId && session.session.id === sessionId;
      await retry;
    } finally {
      unsubscribeOnline();
      unsubscribeQueries();
    }
  }
}
