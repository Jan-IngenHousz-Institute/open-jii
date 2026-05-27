import { useQuery } from "@tanstack/react-query";
import { countRecentMeasurementsByExperiment } from "~/shared/db/measurements-storage";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Map of experiment name → number of local measurements saved in the last 7
 * days. Drives "recently active experiments first" ordering in the flow
 * picker. Keyed under the `["measurements"]` root so it refreshes alongside
 * the rest of the measurement caches.
 */
export function useRecentExperimentActivity(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ["measurements", "experiment-activity"],
    queryFn: () =>
      countRecentMeasurementsByExperiment(new Date(Date.now() - WEEK_MS).toISOString()),
    networkMode: "always",
    refetchOnMount: true,
  });
  return data ?? {};
}
