import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSession } from "~/features/auth/hooks/use-session";
import { prefetchOfflineData } from "~/shared/composition/prefetch-offline-data";
import { useAppState } from "~/shared/ui/hooks/use-app-state";

/**
 * Re-runs the offline prefetch on reconnect/foreground so a precache left
 * incomplete at login heals without a re-login. Throttled + deduped downstream.
 */
export function useOfflineDataSync(): void {
  const queryClient = useQueryClient();
  const { user } = useSession();
  // Via a ref so the always-on subscriptions don't re-bind on session identity change.
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
