import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Signed links work for 15 minutes, so they are fetched again well before they stop. */
const LINKS_REFRESH_MS = 10 * 60_000;

/** Query options for an export's signed part links, shared by the hook and one-off fetches. */
export function exportDownloadLinksQuery(experimentId: string, exportId: string) {
  return orpc.experiments.getExportDownloadLinks.queryOptions({
    input: { id: experimentId, exportId },
    staleTime: LINKS_REFRESH_MS,
  });
}

/** An export's signed part links, kept fresh while they are on screen. */
export const useExportDownloadLinks = ({
  experimentId,
  exportId,
}: {
  experimentId: string;
  exportId: string;
}) => {
  return useQuery({
    ...exportDownloadLinksQuery(experimentId, exportId),
    refetchInterval: LINKS_REFRESH_MS,
  });
};
