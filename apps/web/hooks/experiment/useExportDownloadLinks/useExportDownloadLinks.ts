import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { parseApiError } from "~/util/apiError";

/** Fresh links are fetched this long before the ones on screen stop working. */
const REFRESH_MARGIN_MS = 5 * 60_000;
const MIN_REFRESH_MS = 30_000;

/** Query options for an export's signed part links, shared by the hook and one-off fetches. */
export function exportDownloadLinksQuery(experimentId: string, exportId: string) {
  return orpc.experiments.getExportDownloadLinks.queryOptions({
    input: { id: experimentId, exportId },
    retry: false,
  });
}

/** True when the links were refused because the export's files are gone. */
export function isExportExpiredError(error: unknown): boolean {
  return parseApiError(error)?.code === "EXPORT_EXPIRED";
}

function untilRefresh(expiresAt: string | undefined): number | false {
  if (!expiresAt) {
    return false;
  }
  return Math.max(Date.parse(expiresAt) - Date.now() - REFRESH_MARGIN_MS, MIN_REFRESH_MS);
}

/** An export's signed part links, fetched fresh when shown and again before they stop working. */
export const useExportDownloadLinks = ({
  experimentId,
  exportId,
}: {
  experimentId: string;
  exportId: string;
}) => {
  return useQuery({
    ...exportDownloadLinksQuery(experimentId, exportId),
    refetchOnMount: "always",
    refetchInterval: (query) => untilRefresh(query.state.data?.expiresAt),
  });
};
