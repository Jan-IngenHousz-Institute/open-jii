import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

/**
 * The workbook a given experiment is backed by. Reads the same cached (and
 * persisted) `listExperiments` entry the pickers use, so it resolves offline
 * and costs no extra request in the normal case.
 */
export function useExperimentWorkbookRef(experimentId: string | undefined): {
  workbookId: string | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { filter: "member" },
      enabled: !!experimentId,
      networkMode: "offlineFirst",
    }),
  );

  const experiment = experimentId ? data?.find((e) => e.id === experimentId) : undefined;
  return {
    workbookId: experiment?.workbookId ?? undefined,
    isLoading,
  };
}
