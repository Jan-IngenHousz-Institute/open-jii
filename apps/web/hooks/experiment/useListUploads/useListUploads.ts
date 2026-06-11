import { tsr } from "@/shared/api/tsr";

/**
 * Lists the upload history for an experiment (active + failed + completed,
 * merged by the backend). Refetches every 3s while the modal is open so the
 * user sees in-flight runs progress without manual reloads.
 */
export const useListUploads = (
  experimentId: string,
  opts: { uploadTableName?: string; enabled: boolean },
) => {
  return tsr.experiments.listUploads.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { uploadTableName: opts.uploadTableName },
    },
    queryKey: ["experiments", experimentId, "uploads", opts.uploadTableName ?? "all"],
    enabled: opts.enabled,
    refetchInterval: opts.enabled ? 3_000 : false,
  });
};
