import { useQuery, useQueryClient } from "@tanstack/react-query";
import { uniq } from "lodash";
import { tsr } from "~/api/tsr";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

interface MacroRef {
  id: string;
  version?: number;
}

interface ProtocolRef {
  id: string;
  version?: number;
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

  // Extract all analysis nodes and their macro refs (id + optional version)
  const macroRefs: MacroRef[] = nodes
    .filter((node: FlowNode) => node.type === "analysis" && node.content?.macroId)
    .map((node: FlowNode) => ({
      id: node.content.macroId as string,
      version: node.content.macroVersion as number | undefined,
    }));

  // Deduplicate by id
  const seen = new Set<string>();
  const uniqueRefs = macroRefs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });

  // Prefetch each macro with its pinned version (or latest if no version)
  await Promise.all(
    uniqueRefs.map((ref) =>
      queryClient.prefetchQuery({
        queryKey: ["macro", ref.id, ref.version],
        queryFn: async () => {
          const response = await tsr.macros.getMacro.query({
            params: { id: ref.id },
            query: { version: ref.version },
          });
          return { body: response.body };
        },
      }),
    ),
  );

  return uniqueRefs.map((ref) => ref.id);
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

  // Extract all measurement nodes and their protocol refs (id + optional version)
  const protocolRefs: ProtocolRef[] = nodes
    .filter((node: FlowNode) => node.type === "measurement" && node.content?.protocolId)
    .map((node: FlowNode) => ({
      id: node.content.protocolId as string,
      version: node.content.protocolVersion as number | undefined,
    }));

  // Deduplicate by id
  const seen = new Set<string>();
  const uniqueRefs = protocolRefs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });

  // Prefetch each protocol with its pinned version (or latest if no version)
  await Promise.all(
    uniqueRefs.map((ref) =>
      queryClient.prefetchQuery({
        queryKey: ["protocol", ref.id, ref.version],
        queryFn: async () => {
          const response = await tsr.protocols.getProtocol.query({
            params: { id: ref.id },
            query: { version: ref.version },
          });
          return { body: response.body };
        },
      }),
    ),
  );

  return uniqueRefs.map((ref) => ref.id);
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
