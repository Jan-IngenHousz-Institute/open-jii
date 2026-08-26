import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

import { listItems } from "@repo/api/shared/listing";

/**
 * The workbook a given experiment is backed by. Reads the same cached (and
 * persisted) `listExperiments` entry the pickers use, so it resolves offline
 * and costs no extra request in the normal case.
 */
export function useExperimentWorkbookRef(experimentId: string | undefined): {
  workbookId: string | undefined;
  isLoading: boolean;
  /** Set when the list read failed (e.g. offline with nothing cached). */
  error: unknown;
  /** offlineFirst paused the retry: the reliable "no network" signal. */
  isPaused: boolean;
} {
  const { data, isLoading, error, isPaused } = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { scope: "related" },
      enabled: !!experimentId,
      networkMode: "offlineFirst",
    }),
  );

  const experiment = experimentId ? listItems(data).find((e) => e.id === experimentId) : undefined;
  return {
    workbookId: experiment?.workbookId ?? undefined,
    isLoading,
    error,
    isPaused,
  };
}
