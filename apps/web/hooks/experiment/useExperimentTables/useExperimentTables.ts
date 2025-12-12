import { tsr } from "~/lib/tsr";

import type { ExperimentTableMetadata, ColumnInfo } from "@repo/api";

// Re-export types for convenience
export type { ExperimentTableMetadata, ColumnInfo };

// Type alias for tables with columns (useful for visualization components)
export type ExperimentTableWithColumns = ExperimentTableMetadata & {
  columns: ColumnInfo[];
};

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

/**
 * Hook to fetch experiment tables metadata (names, display names, row counts, and columns)
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the tables metadata including column information
 */
export const useExperimentTables = (experimentId: string) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentTables.useQuery({
    queryData: {
      params: { id: experimentId },
    },
    queryKey: ["experiment", experimentId, "tables"],
    staleTime: STALE_TIME,
  });

  return { tables: data?.body, isLoading, error };
};
