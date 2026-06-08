import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import { tsr } from "~/shared/api/tsr";
import { uniq } from "~/shared/utils/uniq";

// Refetch eligibility window. A successful precache won't churn on every
// reconnect, but a stale/failed one becomes eligible to retry once the device
// is online again (paired with the global refetchOnReconnect default).
const PRECACHE_STALE_TIME = 5 * 60 * 1000;

/**
 * Fetches `assets` into the query cache, one query per id. Uses fetchQuery (not
 * prefetchQuery) so a failed fetch rejects rather than being swallowed: if any
 * asset fails we throw, marking the precache incomplete so it retries on
 * reconnect instead of falsely reporting success and leaving a hole that blocks
 * offline measurement.
 */
async function cacheAssets<T>(
  ids: string[],
  queryKeyPrefix: string,
  queryFn: (id: string) => Promise<{ body: T }>,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      queryClient.fetchQuery({
        queryKey: [queryKeyPrefix, id],
        queryFn: () => queryFn(id),
        // Background cache-warming: a failed asset is retried on reconnect and,
        // for protocols, surfaced precisely at the measurement step. Don't blare
        // a generic global-onError toast here.
        meta: { suppressToast: true },
      }),
    ),
  );

  const failed = ids.filter((_, i) => results[i].status === "rejected");
  if (failed.length > 0) {
    throw new Error(
      `Failed to cache ${failed.length}/${ids.length} ${queryKeyPrefix}(s): ${failed.join(", ")}`,
    );
  }
}

async function precacheExperimentMacrosFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<string[]> {
  // Fetch the experiment flow
  const flowResponse: any = await tsr.experiments.getFlow.query({
    params: { id: experimentId },
  });

  const nodes = flowResponse.body?.graph?.nodes ?? [];

  // Extract all analysis nodes and their macroIds
  const macroIds = nodes
    .filter((node: FlowNode) => node.type === "analysis" && node.content?.macroId)
    .map((node: FlowNode) => node.content.macroId as string)
    .filter((id): id is string => !!id);

  // Remove duplicates
  const uniqueMacroIds = uniq<string>(macroIds);

  await cacheAssets(
    uniqueMacroIds,
    "macro",
    async (macroId) => {
      const response = await tsr.macros.getMacro.query({ params: { id: macroId } });
      return { body: response.body };
    },
    queryClient,
  );

  return uniqueMacroIds;
}

async function precacheExperimentProtocolsFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<string[]> {
  // Fetch the experiment flow
  const flowResponse: any = await tsr.experiments.getFlow.query({
    params: { id: experimentId },
  });

  const nodes = flowResponse.body?.graph?.nodes ?? [];

  // Extract all measurement nodes and their protocolIds
  const protocolIds = nodes
    .filter((node: FlowNode) => node.type === "measurement" && node.content?.protocolId)
    .map((node: FlowNode) => node.content.protocolId as string)
    .filter((id): id is string => !!id);

  // Remove duplicates
  const uniqueProtocolIds = uniq<string>(protocolIds);

  await cacheAssets(
    uniqueProtocolIds,
    "protocol",
    async (protocolId) => {
      const response = await tsr.protocols.getProtocol.query({ params: { id: protocolId } });
      return { body: response.body };
    },
    queryClient,
  );

  return uniqueProtocolIds;
}

async function precacheExperimentDataFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ macroIds: string[]; protocolIds: string[] }> {
  const [macroIds, protocolIds] = await Promise.all([
    precacheExperimentMacrosFn(experimentId, queryClient),
    precacheExperimentProtocolsFn(experimentId, queryClient),
  ]);

  return { macroIds, protocolIds };
}

export function usePrecachedExperimentData(experimentId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["precache-experiment-data", experimentId],
    queryFn: () => precacheExperimentDataFn(experimentId ?? "", queryClient),
    enabled: !!experimentId,
    // Incomplete precache (offline / failed assets) is expected and handled via
    // retry-on-reconnect; don't surface a technical toast for it.
    meta: { suppressToast: true },
    // Finite staleTime (not Infinity) so an incomplete/errored precache becomes
    // eligible to refetch when connectivity returns and fill the missing assets.
    staleTime: PRECACHE_STALE_TIME,
    gcTime: Infinity,
  });
}
