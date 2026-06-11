import { useQueryClient } from "@tanstack/react-query";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useEffect } from "react";
import { mountConnectionLifecycle } from "~/features/connection/services/connection-lifecycle";
import { installFlowRehydrationGuard } from "~/features/measurement-flow/stores/flow-rehydration-guard";
import { mountOutboxBridge } from "~/features/recent-measurements/services/outbox-to-query-cache-bridge";
// Side effect: registers the auth feature on the shared fetcher's 401 seam.
import "~/shared/composition/auth-wiring";
import { db } from "~/shared/db/client";
import { createLogger } from "~/shared/observability/logger";

import { getOutbox } from "./upload";

// Imperative app-boot wiring, mounted once under the query client provider:
// - Forces the Outbox singleton to construct on app start so its network
//   listener, AppState listener, and DB rehydration kick in even before the
//   first user-initiated save, and mounts the bridge that drains Outbox
//   settled events into the measurement list cache.
// - Mounts the connection lifecycle (disconnect detection → scanner cleanup).
// - Installs the flow-store rehydration consistency guard.
export function AppBootstrap() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unmountBridge = mountOutboxBridge({ outbox: getOutbox(), queryClient });
    const unmountLifecycle = mountConnectionLifecycle({ queryClient });
    const unmountGuard = installFlowRehydrationGuard();
    return () => {
      unmountBridge();
      unmountLifecycle();
      unmountGuard();
    };
  }, [queryClient]);

  if (!__DEV__) return null;
  return (
    <>
      <EventLoopLagMonitor />
      <DrizzleDevTools />
    </>
  );
}

function DrizzleDevTools() {
  useDrizzleStudio(db.$client);
  return null;
}

// [perf] App-wide event-loop lag probe. A frozen JS thread (e.g. a heavy
// screen mount) delays this interval; the measured drift is the freeze
// length.
function EventLoopLagMonitor() {
  useEffect(() => {
    const lagLog = createLogger("event-loop");
    const PERIOD_MS = 500;
    const THRESHOLD_MS = 100;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const lag_ms = now - last - PERIOD_MS;
      last = now;
      if (lag_ms > THRESHOLD_MS) lagLog.info("stall", { lag_ms });
    }, PERIOD_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
