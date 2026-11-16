import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** How often the list looks again while the store is still taking a sheet. */
export const PENDING_STORE_COPY_REFETCH_MS = 5_000;

/**
 * Hook to fetch all metadata records for an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the list of experiment metadata records
 */
export const useExperimentMetadata = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentMetadata.queryOptions({
      input: { id: experimentId },
      refetchInterval: (query) => {
        const isCopyPending =
          query.state.data?.some((sheet) => sheet.storeCopy === "pending") ?? false;
        return isCopyPending ? PENDING_STORE_COPY_REFETCH_MS : false;
      },
    }),
  );
};
