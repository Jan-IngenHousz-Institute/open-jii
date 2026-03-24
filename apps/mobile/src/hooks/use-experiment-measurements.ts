import { tsr } from "~/api/tsr";

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

export function useExperimentMeasurements(experimentId?: string, tableName = "raw_data") {
  return tsr.experiments.getExperimentData.useQuery({
    queryKey: ["experiment-data", experimentId, tableName],
    queryData: {
      params: { id: experimentId ?? "" },
      query: { tableName },
    },
    enabled: !!experimentId,
  });
}
