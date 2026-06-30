import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Lists the upload history for an experiment (active + failed + completed,
 * merged by the backend). Refetches every 3s while the modal is open so the
 * user sees in-flight runs progress without manual reloads.
 */
export const useListUploads = (
  experimentId: string,
  opts: { uploadTableName?: string; enabled: boolean },
) => {
  return useQuery(
    orpc.experiments.listUploads.queryOptions({
      input: { id: experimentId, uploadTableName: opts.uploadTableName },
      enabled: opts.enabled,
      refetchInterval: opts.enabled ? 3_000 : false,
    }),
  );
};
