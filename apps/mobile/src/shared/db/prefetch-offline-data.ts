import type { QueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";
import { tsr } from "~/shared/api/tsr";
import { createLogger } from "~/shared/observability/logger";
import { uniq } from "~/shared/utils/uniq";
import { extractAssetIdsFromCells } from "~/shared/utils/workbook-assets";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

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
          queryKey: ["userProfile", userId],
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
    queryKey: ["experiments"],
    queryFn: async () => {
      const response = await tsr.experiments.listExperiments.query({
        query: { filter: "member" },
      });
      return response;
    },
    staleTime: 0,
  });

  const experiments = (experimentsResponse?.body ?? []) as {
    id: string;
    workbookId: string | null;
    workbookVersionId: string | null;
  }[];

  // 2. For each experiment, cache its run source and extract protocol/macro IDs.
  //    Workbook-backed experiments cache the workbook version (cells carry the
  //    branch conditions needed for offline evaluation); legacy experiments
  //    cache the flow graph as before.
  const allProtocolIds: string[] = [];
  const allMacroIds: string[] = [];

  const flowResults = await Promise.allSettled(
    experiments.map(async (experiment) => {
      try {
        if (experiment.workbookId && experiment.workbookVersionId) {
          const workbookId = experiment.workbookId;
          const workbookVersionId = experiment.workbookVersionId;
          try {
            const versionResponse = await queryClient.fetchQuery({
              queryKey: ["workbook-version", workbookId, workbookVersionId],
              queryFn: () =>
                tsr.workbooks.getWorkbookVersion.query({
                  params: { id: workbookId, versionId: workbookVersionId },
                }),
              staleTime: 0,
            });

            const cells =
              (versionResponse as { body?: { cells?: WorkbookCell[] } })?.body?.cells ?? [];
            const { protocolIds, macroIds } = extractAssetIdsFromCells(cells);
            allProtocolIds.push(...protocolIds);
            allMacroIds.push(...macroIds);
            return;
          } catch {
            // Fall through to legacy flow-graph resolution below.
          }
        }

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
          `Run-source fetch failed for experiment ${experiment.id}: ${err instanceof Error ? err.message : String(err)}`,
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
