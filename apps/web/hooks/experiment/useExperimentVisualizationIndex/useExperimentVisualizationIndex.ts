import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME = 2 * 60 * 1000;

// The list endpoint's page ceiling. A dashboard referencing more visualizations
// than this falls back to a per-widget read for the rest.
const PAGE_SIZE = 100;

/**
 * Every visualization of an experiment in one read. Dashboards load this once
 * and each widget starts from its row here instead of its own round trip.
 */
export function experimentVisualizationIndexOptions(experimentId: string) {
  return orpc.experiments.listExperimentVisualizations.queryOptions({
    input: { id: experimentId, limit: PAGE_SIZE, offset: 0 },
    staleTime: STALE_TIME,
  });
}

export const useExperimentVisualizationIndex = (experimentId: string) =>
  useQuery(experimentVisualizationIndexOptions(experimentId));
