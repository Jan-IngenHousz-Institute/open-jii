import type { QueryClient } from "@tanstack/react-query";
import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";
import type { FlowNode } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";
import { uniq } from "~/shared/utils/uniq";

const log = createLogger("prefetch");

/**
 * Prefetches all experiment data needed for offline use.
 * Called after login to ensure measurements can run without network.
 */
export async function prefetchOfflineData(
  queryClient: QueryClient,
  userId?: string,
): Promise<void> {
  try {
    await _prefetchOfflineData(queryClient, userId);
  } catch (err) {
    log.error("Failed to prefetch offline data", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function _prefetchOfflineData(queryClient: QueryClient, userId?: string): Promise<void> {
  // Kick off the profile prefetch in parallel — it's independent of experiments.
  // 404 is expected for accounts that haven't completed registration on web yet.
  const profilePromise = userId
    ? queryClient
        .prefetchQuery({
          queryKey: contentKeys.userProfile(userId),
          queryFn: () => tsr.users.getUserProfile.query({ params: { id: userId } }),
          staleTime: 0,
          meta: { suppressToast: true },
        })
        .catch((err) => {
          log.warn("user profile prefetch failed", {
            err: err instanceof Error ? err.message : String(err),
          });
        })
    : Promise.resolve();

  // 1. Fetch all user experiments
  const experimentsResponse = await queryClient.fetchQuery({
    queryKey: contentKeys.experiments,
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
        const flowResponse: { body?: { graph?: { nodes?: FlowNode[] } } } | undefined =
          await queryClient.fetchQuery({
            queryKey: contentKeys.experimentFlow(experiment.id),
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
    log.warn("experiment flow(s) failed", {
      failures: flowFailures.length,
      total: experiments.length,
      reasons: flowFailures.map((r) => r.reason?.message ?? String(r.reason)),
    });
  }

  // 3. Fetch all unique protocols and macros
  const uniqueProtocolIds = uniq(allProtocolIds);
  const uniqueMacroIds = uniq(allMacroIds);

  const assetResults = await Promise.allSettled([
    ...uniqueProtocolIds.map((protocolId) =>
      queryClient.prefetchQuery({
        queryKey: contentKeys.protocol(protocolId),
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
        queryKey: contentKeys.macro(macroId),
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
    log.warn("protocol/macro prefetch failures", {
      failures: assetFailures.length,
      total: uniqueProtocolIds.length + uniqueMacroIds.length,
    });
  }

  // Make sure the parallel profile prefetch has settled before returning.
  await profilePromise;

  const flowsCached = experiments.length - flowFailures.length;
  const assetsCached = uniqueProtocolIds.length + uniqueMacroIds.length - assetFailures.length;

  log.info("cached", {
    experiments_cached: flowsCached,
    experiments_total: experiments.length,
    assets_cached: assetsCached,
    assets_total: uniqueProtocolIds.length + uniqueMacroIds.length,
  });
}
