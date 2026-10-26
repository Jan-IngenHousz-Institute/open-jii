import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type {
  ExperimentListUploadsResponse,
  ExperimentUploadStatus,
} from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";

const POLL_MS = 15_000;
const UNFINISHED_STATUSES = new Set<ExperimentUploadStatus>([
  "receiving",
  "queued",
  "pending",
  "running",
]);

function hasUnfinishedUpload(data: ExperimentListUploadsResponse | undefined): boolean {
  return data?.uploads.some((record) => UNFINISHED_STATUSES.has(record.status)) ?? false;
}

/**
 * Lists an experiment's uploads, polling only while one is still unfinished. A transfer that
 * reaches the backend invalidates the list, which starts polling again.
 */
export const useListUploads = (
  experimentId: string,
  opts: { uploadTableName?: string; enabled: boolean },
) => {
  return useQuery(
    orpc.experiments.listUploads.queryOptions({
      input: { id: experimentId, uploadTableName: opts.uploadTableName },
      enabled: opts.enabled,
      refetchInterval: (query) => (hasUnfinishedUpload(query.state.data) ? POLL_MS : false),
    }),
  );
};
