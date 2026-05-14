import { useEffect } from "react";
import { useEnvironmentStore } from "~/shared/stores/environment-store";
import { startTimeSync, stopTimeSync } from "~/shared/utils/time-sync";

/**
 * Starts the time sync service once the environment store is rehydrated.
 * Place near the root of the app tree.
 */
export function TimeSyncProvider({ children }: { children: React.ReactNode }) {
  const isLoaded = useEnvironmentStore((s) => s.isLoaded);

  useEffect(() => {
    if (!isLoaded) return;
    startTimeSync();
    return () => stopTimeSync();
  }, [isLoaded]);

  return <>{children}</>;
}
