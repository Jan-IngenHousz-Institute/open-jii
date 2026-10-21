import { useQuery } from "@tanstack/react-query";
import {
  useMeasurementViewer,
  measurementViewerKey,
} from "~/features/recent-measurements/hooks/use-measurement-viewer";
import { queryKeys } from "~/features/recent-measurements/services/measurement-list-cache";
import { countRecentMeasurementsByExperiment } from "~/shared/db/measurements-storage";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Map of experiment name → number of local measurements saved in the last 7
 * days. Drives "recently active experiments first" ordering in the flow
 * picker. Keyed under the `["measurements"]` root so it refreshes alongside
 * the rest of the measurement caches.
 */
export function useRecentExperimentActivity(): Record<string, number> {
  const viewer = useMeasurementViewer();
  const { data } = useQuery({
    queryKey: [...queryKeys.experimentActivity, measurementViewerKey(viewer)],
    queryFn: () =>
      countRecentMeasurementsByExperiment(new Date(Date.now() - WEEK_MS).toISOString(), viewer),
    networkMode: "always",
    refetchOnMount: true,
  });
  return data ?? {};
}
