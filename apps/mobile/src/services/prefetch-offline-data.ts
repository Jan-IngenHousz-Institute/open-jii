import type { QueryClient } from "@tanstack/react-query";
import { uniq } from "lodash";
import { tsr } from "~/api/tsr";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

/**
 * Prefetches all experiment data needed for offline use.
 * Called after login to ensure measurements can run without network.
 */
export async function prefetchOfflineData(queryClient: QueryClient): Promise<void> {
  try {
    await _prefetchOfflineData(queryClient);
  } catch (err) {
    console.error(
      "[prefetch] Failed to prefetch offline data:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function _prefetchOfflineData(queryClient: QueryClient): Promise<void> {
  // 1. Fetch all user experiments
  const experimentsResponse = await queryClient.fetchQuery({
    queryKey: ["experiments"],
    queryFn: async () => {
      const response = await tsr.experiments.listExperiments.query({
        query: { filter: "member" },
      });
      return response;
    },
    staleTime: 0,
  });

  const experiments = (experimentsResponse?.body ?? []) as { id: string }[];

  // 2. For each experiment, fetch the flow and extract protocol/macro IDs
  const allProtocolIds: string[] = [];
  const allMacroIds: string[] = [];

  const flowResults = await Promise.allSettled(
    experiments.map(async (experiment: { id: string }) => {
      try {
        const flowResponse: any = await queryClient.fetchQuery({
          queryKey: ["experiment-flow", experiment.id],
          queryFn: async () => {
            const response = await tsr.experiments.getFlow.query({
              params: { id: experiment.id },
            });
            return response;
          },
          staleTime: 0,
        });

        const nodes = flowResponse?.body?.graph?.nodes ?? [];

        const protocolIds = nodes
          .filter((node: FlowNode) => node.type === "measurement" && node.content?.protocolId)
          .map((node: FlowNode) => node.content.protocolId as string);

        const macroIds = nodes
          .filter((node: FlowNode) => node.type === "analysis" && node.content?.macroId)
          .map((node: FlowNode) => node.content.macroId as string);

        allProtocolIds.push(...protocolIds);
        allMacroIds.push(...macroIds);
      } catch (err) {
        throw new Error(
          `Flow fetch failed for experiment ${experiment.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  const flowFailures = flowResults.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (flowFailures.length > 0) {
    console.warn(
      `[prefetch] ${flowFailures.length}/${experiments.length} experiment flow(s) failed:`,
      flowFailures.map((r) => r.reason?.message ?? String(r.reason)),
    );
  }

  // 3. Fetch all unique protocols and macros
  const uniqueProtocolIds = uniq(allProtocolIds);
  const uniqueMacroIds = uniq(allMacroIds);

  const assetResults = await Promise.allSettled([
    ...uniqueProtocolIds.map((protocolId) =>
      queryClient.prefetchQuery({
        queryKey: ["protocol", protocolId],
        queryFn: async () => {
          const response = await tsr.protocols.getProtocol.query({
            params: { id: protocolId },
          });
          return { body: response.body };
        },
        staleTime: 0,
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
        staleTime: 0,
      }),
    ),
  ]);

  const assetFailures = assetResults.filter((r) => r.status === "rejected");
  if (assetFailures.length > 0) {
    console.warn(
      `[prefetch] ${assetFailures.length}/${uniqueProtocolIds.length + uniqueMacroIds.length} protocol/macro(s) failed to prefetch`,
    );
  }

  const flowsCached = experiments.length - flowFailures.length;
  const assetsCached = uniqueProtocolIds.length + uniqueMacroIds.length - assetFailures.length;

  console.log(
    `[prefetch] Cached ${flowsCached}/${experiments.length} experiments, ${assetsCached}/${uniqueProtocolIds.length + uniqueMacroIds.length} protocols+macros`,
  );
}
