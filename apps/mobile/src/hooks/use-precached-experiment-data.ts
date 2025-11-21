import { useQuery, useQueryClient } from "@tanstack/react-query";
import { uniq } from "lodash";
import { tsr } from "~/api/tsr";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

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

  // Prefetch each macro
  await Promise.all(
    uniqueMacroIds.map((macroId: string) =>
      queryClient.prefetchQuery({
        queryKey: ["macro", macroId],
        queryFn: async () => {
          const response = await tsr.macros.getMacro.query({
            params: { id: macroId },
          });
          return { body: response.body };
        },
      }),
    ),
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

  // Prefetch each protocol
  await Promise.all(
    uniqueProtocolIds.map((protocolId: string) =>
      queryClient.prefetchQuery({
        queryKey: ["protocol", protocolId],
        queryFn: async () => {
          const response = await tsr.protocols.getProtocol.query({
            params: { id: protocolId },
          });
          return { body: response.body };
        },
      }),
    ),
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
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
