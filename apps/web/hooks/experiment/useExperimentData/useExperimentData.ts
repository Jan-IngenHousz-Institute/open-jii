import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type { ExperimentData } from "@repo/api";

export type DataValue = string | null;
export type DataRow = Record<string, DataValue>;
export type DataRenderFunction = (
  value: unknown,
  type: string,
  columnName?: string,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

function createTableColumns(
  data: ExperimentData | undefined,
  formatFunction?: DataRenderFunction,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeName: string): number => {
    switch (typeName) {
      case "TIMESTAMP":
        return 1;
      case "STRING":
        return 3;
      case "DOUBLE":
      case "INT":
      case "LONG":
      case "BIGINT":
        return 4;
      default:
        if (typeName === "MAP" || typeName.startsWith("MAP<")) return 2;
        if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 5;
        return 6; // Other types at the end
    }
  };

  // Sort columns by type precedence
  const sortedColumns = [...data.columns].sort((a, b) => {
    const precedenceA = getTypePrecedence(a.type_name);
    const precedenceB = getTypePrecedence(b.type_name);
    return precedenceA - precedenceB;
  });

  sortedColumns.forEach((dataColumn) => {
    // Set smaller width for array columns that contain charts
    const isArrayColumn =
      dataColumn.type_name === "ARRAY" || dataColumn.type_name.startsWith("ARRAY<");

    // Set medium width for map columns that contain collapsible content
    const isMapColumn =
      dataColumn.type_name === "MAP" || dataColumn.type_name.startsWith("MAP<STRING,");

    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: dataColumn.name,
        size: isArrayColumn ? 120 : isMapColumn ? 200 : undefined,
        meta: {
          type: dataColumn.type_name,
        },
        cell: ({ row }) => {
          const value = row.getValue(dataColumn.name);
          if (formatFunction) {
            return formatFunction(
              value,
              dataColumn.type_name,
              dataColumn.name,
              onChartHover,
              onChartLeave,
              onChartClick,
            );
          }
          return value as string;
        },
      }),
    );
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, DataValue>[];
  totalRows: number;
  totalPages: number;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param experimentId The ID of the experiment to fetch
 * @param tableName Name of the table to fetch
 * @param page Page to fetch; pages start with 1
 * @param pageSize Page size to fetch
 * @param formatFunction Function used to render the column value
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  page: number,
  pageSize: number,
  tableName: string,
  formatFunction?: DataRenderFunction,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName],
    staleTime: STALE_TIME,
  });

  const tableData = data?.body[0];
  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return tableData
      ? {
          columns: createTableColumns(
            tableData.data,
            formatFunction,
            onChartHover,
            onChartLeave,
            onChartClick,
          ),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [tableData, formatFunction, onChartHover, onChartLeave, onChartClick]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};

export interface SampleTable {
  name: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
}

/**
 * Hook to fetch experiment sample data by ID
 * @param experimentId The ID of the experiment to fetch
 * @param sampleSize Number of sample rows to fetch
 * @param formatFunction Function used to render the column value
 * @returns Query result containing the experiment sample data
 */
export const useExperimentSampleData = (
  experimentId: string,
  sampleSize = 5,
  formatFunction?: DataRenderFunction,
) => {
  const page = 1;
  const pageSize = sampleSize;
  const tableName = undefined;
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName],
    staleTime: STALE_TIME,
  });

  const sampleTables = useMemo(() => {
    const tables: SampleTable[] = [];
    if (!data) return tables;
    data.body.forEach((tableData) => {
      tables.push({
        name: tableData.name,
        tableMetadata: {
          columns: createTableColumns(tableData.data, formatFunction, undefined, undefined),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
      });
    });
    return tables;
  }, [data, formatFunction]);

  return { sampleTables, isLoading, error };
};
