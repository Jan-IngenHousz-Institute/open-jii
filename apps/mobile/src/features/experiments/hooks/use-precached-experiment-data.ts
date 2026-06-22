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
 * version (preferred — also caches the cells for offline branch evaluation) or
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

async function precacheExperimentDataFn(
  experimentId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<{ macroIds: string[]; protocolIds: string[] }> {
  const { protocolIds, macroIds } = await resolveAssetIds(experimentId, queryClient);

  const uniqueProtocolIds = uniq<string>(protocolIds);
  const uniqueMacroIds = uniq<string>(macroIds);

  await Promise.all([
    ...uniqueProtocolIds.map((protocolId) =>
      queryClient.prefetchQuery({
        queryKey: ["protocol", protocolId],
        queryFn: async () => {
          const response = await tsr.protocols.getProtocol.query({ params: { id: protocolId } });
          return { body: response.body };
        },
      }),
    ),
    ...uniqueMacroIds.map((macroId) =>
      queryClient.prefetchQuery({
        queryKey: ["macro", macroId],
        queryFn: async () => {
          const response = await tsr.macros.getMacro.query({ params: { id: macroId } });
          return { body: response.body };
        },
      }),
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
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
