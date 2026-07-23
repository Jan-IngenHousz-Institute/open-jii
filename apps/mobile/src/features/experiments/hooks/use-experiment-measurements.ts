import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

export interface ExperimentDataTable {
  name: string;
  catalog_name: string;
  schema_name: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  data?: {
    columns: {
      name: string;
      type_name: string;
      type_text: string;
    }[];
    rows: Record<string, any>[];
    totalRows: number;
    truncated: boolean;
  };
}

export function useExperimentMeasurements(experimentId: string | undefined) {
  return useQuery(
    orpc.experiments.getExperimentData.queryOptions({
      input: { id: experimentId ?? "", tableName: "raw_data" },
      enabled: !!experimentId,
      networkMode: "offlineFirst",
    }),
  );
}
