import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/lib/orpc";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { experimentTablesQuery } from "./experiment-tables-query";

// Re-export types for convenience
export type { ExperimentTableMetadata };

/**
 * Hook to fetch experiment tables metadata (names, display names, row counts)
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the tables metadata
 */
export const useExperimentTables = (experimentId: string) => {
  const { data, isLoading, error } = useQuery(experimentTablesQuery(orpc, experimentId));

  return { tables: data, isLoading, error };
};
