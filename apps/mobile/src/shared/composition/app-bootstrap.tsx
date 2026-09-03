import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { mountConnectionLifecycle } from "~/features/connection/services/connection-lifecycle";
import { installFlowRehydrationGuard } from "~/features/measurement-flow/stores/flow-rehydration-guard";
import { queryKeys } from "~/features/recent-measurements/services/measurement-list-cache";
import { mountOutboxBridge } from "~/features/recent-measurements/services/outbox-to-query-cache-bridge";
// Side effect: registers the auth feature on the shared fetcher's 401 seam.
import "~/shared/composition/auth-wiring";
import { backfillDerivedColumns } from "~/shared/db/measurements-backfill";
import { createLogger } from "~/shared/observability/logger";

import { getOutbox } from "./upload";

const log = createLogger("app-bootstrap");

// Imperative app-boot wiring, mounted once under the query client provider:
// - Forces the Outbox singleton to construct on app start so its network
//   listener, AppState listener, and DB rehydration kick in even before the
//   first user-initiated save, and mounts the bridge that drains Outbox
//   settled events into the measurement list cache.
// - Mounts the connection lifecycle (disconnect detection → scanner cleanup).
// - Installs the flow-store rehydration consistency guard.
// - Backfills the measurements table's derived columns (legacy rows). Runs
//   here rather than in the root layout because the query client only exists
//   under this provider: when the pass updated rows, every cached measurement
//   list must refetch or legacy rows stay ungrouped for the whole session.
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

  useEffect(() => {
    void backfillDerivedColumns()
      .then((updated) => {
        if (updated > 0) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.root });
        }
      })
      .catch((e) => log.warn("db backfill failed", { err: (e as Error)?.message }));
  }, [queryClient]);

  if (!__DEV__) return null;
  return <EventLoopLagMonitor />;
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
