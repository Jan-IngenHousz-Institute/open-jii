import type { QueryClient } from "@tanstack/react-query";
import { uniq } from "lodash";
import { tsr } from "~/api/tsr";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

/**
 * Prefetches all experiment data needed for offline use.
 * Called after login to ensure measurements can run without network.
 */
export async function prefetchOfflineData(queryClient: QueryClient): Promise<void> {
  // 1. Fetch all user experiments
  const experimentsResponse = await queryClient.fetchQuery({
    queryKey: ["experiments"],
    queryFn: async () => {
      const response = await tsr.experiments.listExperiments.query({
        query: { filter: "member" },
      });
      return response;
    },
    staleTime: Infinity,
  });

  const experiments = (experimentsResponse?.body ?? []) as { id: string }[];

  // 2. For each experiment, fetch the flow and extract protocol/macro IDs
  const allProtocolIds: string[] = [];
  const allMacroIds: string[] = [];

  await Promise.all(
    experiments.map(async (experiment: { id: string }) => {
      // Fetch experiment flow
      const flowResponse: any = await queryClient.fetchQuery({
        queryKey: ["experiment-flow", experiment.id],
        queryFn: async () => {
          const response = await tsr.experiments.getFlow.query({
            params: { id: experiment.id },
          });
          return response;
        },
        staleTime: Infinity,
      });

      const nodes = flowResponse?.body?.graph?.nodes ?? [];

      // Collect protocol IDs from measurement nodes
      const protocolIds = nodes
        .filter((node: FlowNode) => node.type === "measurement" && node.content?.protocolId)
        .map((node: FlowNode) => node.content.protocolId as string);

      // Collect macro IDs from analysis nodes
      const macroIds = nodes
        .filter((node: FlowNode) => node.type === "analysis" && node.content?.macroId)
        .map((node: FlowNode) => node.content.macroId as string);

      allProtocolIds.push(...protocolIds);
      allMacroIds.push(...macroIds);
    }),
  );

  // 3. Fetch all unique protocols and macros
  const uniqueProtocolIds = uniq(allProtocolIds);
  const uniqueMacroIds = uniq(allMacroIds);

  await Promise.all([
    ...uniqueProtocolIds.map((protocolId) =>
      queryClient.prefetchQuery({
        queryKey: ["protocol", protocolId],
        queryFn: async () => {
          const response = await tsr.protocols.getProtocol.query({
            params: { id: protocolId },
          });
          return { body: response.body };
        },
        staleTime: Infinity,
      }),
    ),
    ...uniqueMacroIds.map((macroId) =>
      queryClient.prefetchQuery({
        queryKey: ["macro", macroId],
        queryFn: async () => {
          const response = await tsr.macros.getMacro.query({
            params: { id: macroId },
          });
          return { body: response.body };
        },
        staleTime: Infinity,
      }),
    ),
  ]);

  console.log(
    `[prefetch] Cached ${experiments.length} experiments, ${uniqueProtocolIds.length} protocols, ${uniqueMacroIds.length} macros for offline use`,
  );
}
