import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import { tsr } from "~/shared/api/tsr";
import { uniq } from "~/shared/utils/uniq";
import { extractAssetIdsFromCells } from "~/shared/utils/workbook-assets";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

interface ExperimentRef {
  id: string;
  workbookId: string | null;
  workbookVersionId: string | null;
}

/** Reads the experiment's workbook refs from the already-cached list. */
function findExperimentRef(
  queryClient: ReturnType<typeof useQueryClient>,
  experimentId: string,
): ExperimentRef | undefined {
  const cached = queryClient.getQueryData<{ body?: ExperimentRef[] }>(["experiments"]);
  return cached?.body?.find((e) => e.id === experimentId);
}

/**
 * Resolves the protocol/macro ids an experiment references, from its workbook
 * version (preferred, also caches the cells for offline branch evaluation) or
 * from the legacy flow graph.
 */
async function resolveAssetIds(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ protocolIds: string[]; macroIds: string[] }> {
  const ref = findExperimentRef(queryClient, experimentId);

  if (ref?.workbookId && ref.workbookVersionId) {
    const workbookId = ref.workbookId;
    const versionId = ref.workbookVersionId;
    try {
      const versionResponse = await queryClient.fetchQuery({
        queryKey: ["workbook-version", workbookId, versionId],
        queryFn: async () =>
          tsr.workbooks.getWorkbookVersion.query({ params: { id: workbookId, versionId } }),
      });
      const cells = (versionResponse as { body?: { cells?: WorkbookCell[] } })?.body?.cells ?? [];
      return extractAssetIdsFromCells(cells);
    } catch {
      // Fall through to legacy flow-graph resolution below.
    }
  }

  const flowResponse: any = await tsr.experiments.getFlow.query({ params: { id: experimentId } });
  const nodes = flowResponse.body?.graph?.nodes ?? [];
  return {
    protocolIds: nodes
      .filter((node: FlowNode) => node.type === "measurement" && node.content?.protocolId)
      .map((node: FlowNode) => node.content.protocolId as string),
    macroIds: nodes
      .filter((node: FlowNode) => node.type === "analysis" && node.content?.macroId)
      .map((node: FlowNode) => node.content.macroId as string),
  };
}

// Refetch window: a successful precache won't churn on reconnect, but a
// stale/failed one becomes eligible to retry once online (with refetchOnReconnect).
const PRECACHE_STALE_TIME = 5 * 60 * 1000;

// fetchQuery (not prefetchQuery) so a failed asset rejects instead of being
// swallowed; throw if any fail so the precache reports incomplete and retries on
// reconnect rather than falsely succeeding and leaving an offline hole.
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

async function precacheExperimentDataFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ macroIds: string[]; protocolIds: string[] }> {
  const { protocolIds, macroIds } = await resolveAssetIds(experimentId, queryClient);

  const uniqueProtocolIds = uniq<string>(protocolIds);
  const uniqueMacroIds = uniq<string>(macroIds);

  await Promise.all([
    cacheAssets(
      uniqueProtocolIds,
      "protocol",
      async (id) => {
        const response = await tsr.protocols.getProtocol.query({ params: { id } });
        return { body: response.body };
      },
      queryClient,
    ),
    cacheAssets(
      uniqueMacroIds,
      "macro",
      async (id) => {
        const response = await tsr.macros.getMacro.query({ params: { id } });
        return { body: response.body };
      },
      queryClient,
    ),
  ]);

  return { macroIds: uniqueMacroIds, protocolIds: uniqueProtocolIds };
}

export function usePrecachedExperimentData(experimentId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["precache-experiment-data", experimentId],
    queryFn: () => precacheExperimentDataFn(experimentId ?? "", queryClient),
    enabled: !!experimentId,
    // Incomplete precache (offline/failed assets) is expected and retried on
    // reconnect; don't blare a technical toast.
    meta: { suppressToast: true },
    // Finite (not Infinity) so an incomplete precache becomes eligible to
    // refetch when connectivity returns and fill the missing assets.
    staleTime: PRECACHE_STALE_TIME,
    gcTime: Infinity,
  });
}
