import { matchQuery, useQueryClient } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";
import { useMemo, useState, useSyncExternalStore } from "react";
import { orpc } from "~/lib/orpc";

import type {
  ExperimentDataResponse,
  ExperimentRelativeTimeWindow,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  relativeTimeFilterIdentity,
  relativeTimeMinute,
} from "@repo/api/domains/experiment/data/relative-time-filter";

/** A local preview until a matching read supplies the server's actual rolling-window anchor. */
export function useFilterEvaluationTime(
  experimentId: string | undefined,
  tableName: string | undefined,
  column: string | undefined,
  window: ExperimentRelativeTimeWindow | undefined,
) {
  const client = useQueryClient();
  const [preview] = useState(() => ({ at: relativeTimeMinute(Date.now()), server: false }));
  const identity = window && column ? relativeTimeFilterIdentity(column, window) : undefined;
  const observation = useMemo(() => {
    let snapshot = preview;
    let latest: number | undefined;
    const queryKey = orpc.experiments.getExperimentData.key({
      input: { id: experimentId ?? "", tableName: tableName ?? "" },
    });
    const matches = (query: Query) =>
      Boolean(experimentId && tableName && identity) &&
      matchQuery({ queryKey }, query) &&
      Array.isArray(query.meta?.relativeTimeFilters) &&
      query.meta.relativeTimeFilters.includes(identity);
    const adopt = (query: Query) => {
      const at = client.getQueryData<ExperimentDataResponse>(query.queryKey)?.[0]
        ?.filterEvaluatedAt;
      const timestamp = at ? Date.parse(at) : NaN;
      // Concurrent chart, table and zoom requests may complete out of order.
      if (Number.isFinite(timestamp) && (latest === undefined || timestamp > latest)) {
        latest = timestamp;
        snapshot = { at: timestamp, server: true };
      }
    };
    const cache = client.getQueryCache();
    const readCached = () => {
      for (const query of cache.findAll({ queryKey }).filter(matches)) adopt(query);
    };
    if (experimentId && tableName && identity) readCached();
    return {
      getSnapshot: () => snapshot,
      subscribe: (changed: () => void) => {
        if (!experimentId || !tableName || !identity) return () => undefined;
        if (!snapshot.server) snapshot = { at: relativeTimeMinute(Date.now()), server: false };
        readCached();
        changed();
        return cache.subscribe((event) => {
          if (event.type === "updated" && event.action.type === "success") {
            const query = cache.get(event.query.queryHash);
            if (query && matches(query)) {
              adopt(query);
              changed();
            }
          }
        });
      },
    };
  }, [client, experimentId, tableName, identity, preview]);

  return useSyncExternalStore(observation.subscribe, observation.getSnapshot, () => preview);
}
