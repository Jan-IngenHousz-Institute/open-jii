import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSession } from "~/features/auth/hooks/use-session";
import { prefetchOfflineData } from "~/shared/db/prefetch-offline-data";
import { useAppState } from "~/shared/ui/hooks/use-app-state";

/**
 * Re-runs the offline prefetch when connectivity returns or the app foregrounds,
 * so a precache left incomplete at login (offline) heals without a re-login.
 * The login path already prefetches once; this keeps it fresh. Deduped and
 * throttled inside prefetchOfflineData. No-op until signed in.
 */
export function useOfflineDataSync(): void {
  const queryClient = useQueryClient();
  const { user } = useSession();
  // Read the id through a ref so the always-on subscriptions don't re-bind when
  // the session object identity changes.
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  useEffect(
    () =>
      onlineManager.subscribe(() => {
        if (onlineManager.isOnline() && userIdRef.current) {
          void prefetchOfflineData(queryClient, userIdRef.current, { throttle: true });
        }
      }),
    [queryClient],
  );

  useAppState((next) => {
    if (next === "active" && onlineManager.isOnline() && userIdRef.current) {
      void prefetchOfflineData(queryClient, userIdRef.current, { throttle: true });
    }
  });
}

/** Mounts {@link useOfflineDataSync} as an always-on, render-free service. */
export function OfflineDataSync(): null {
  useOfflineDataSync();
  return null;
}
