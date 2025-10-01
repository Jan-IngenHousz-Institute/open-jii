import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import type { CommentsRowIdentifier } from "~/components/experiment-data/comments/utils";
import {
  getCommentsColumn,
  getRowCheckbox,
  getToggleAllRowsCheckbox,
} from "~/components/experiment-data/comments/utils";
import { tsr } from "~/lib/tsr";

import type { ExperimentData } from "@repo/api";

export type DataValue = string | null;
export type DataRow = Record<string, DataValue>;
export interface DataRenderFunctionParams {
  value: unknown;
  type: string;
  columnName?: string;
  onChartHover?: (data: number[], columnName: string) => void;
  onChartLeave?: () => void;
  onChartClick?: (data: number[], columnName: string) => void;
}
export type DataRenderFunction = (params: DataRenderFunctionParams) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

interface CreateTableColumnsParams {
  experimentId: string;
  tableName?: string;
  data: ExperimentData | undefined;
  formatFunction: DataRenderFunction;
  commentsColumnName?: string;
  onChartHover?: (data: number[], columnName: string) => void;
  onChartLeave?: () => void;
  onChartClick?: (data: number[], columnName: string) => void;
}

function createTableColumns({
  experimentId,
  tableName,
  data,
  formatFunction,
  commentsColumnName,
  onChartHover,
  onChartLeave,
  onChartClick,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeName: string): number => {
    switch (typeName) {
      case "ID":
        return 1;
      case "JSON_COMMENTS":
        return 2;
      case "TIMESTAMP":
        return 3;
      case "STRING":
        return 5;
      case "DOUBLE":
      case "INT":
      case "LONG":
      case "BIGINT":
        return 6;
      default:
        if (typeName === "MAP" || typeName.startsWith("MAP<")) return 4;
        if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 7;
        return 8; // Other types at the end
    }
  };

  // Sort columns by type precedence
  const sortedColumns = [...data.columns].sort((a, b) => {
    const precedenceA = getTypePrecedence(a.type_name);
    const precedenceB = getTypePrecedence(b.type_name);
    return precedenceA - precedenceB;
  });

  let idColumnName: string | undefined;

  sortedColumns.forEach((dataColumn) => {
    // Set smaller width for array columns that contain charts
    const isArrayColumn =
      dataColumn.type_name === "ARRAY" || dataColumn.type_name.startsWith("ARRAY<");

    // Set medium width for map columns that contain collapsible content
    const isMapColumn =
      dataColumn.type_name === "MAP" || dataColumn.type_name.startsWith("MAP<STRING,");

    switch (dataColumn.type_name) {
      case "ID":
        if (tableName === undefined) return;
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            id: dataColumn.name,
            header: () => getToggleAllRowsCheckbox(),
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              return getRowCheckbox(row);
            },
            size: 30,
          }),
        );
        idColumnName = dataColumn.name;
        break;
      case "JSON_COMMENTS":
        if (tableName === undefined) return;
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            header: commentsColumnName ?? "Comments & Flags--",
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              const value = row.getValue(dataColumn.name);
              const rowId = idColumnName ? row.getValue(idColumnName) : undefined;
              if (rowId) {
                const commentRowId: CommentsRowIdentifier = {
                  experimentId,
                  tableName,
                  rowId: rowId as string,
                };
                return getCommentsColumn(commentRowId, value as string);
              }
              return value as string;
            },
          }),
        );
        break;
      default:
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            header: dataColumn.name,
            size: isArrayColumn ? 120 : isMapColumn ? 200 : undefined,
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              const value = row.getValue(dataColumn.name);
              return formatFunction({
                value,
                type: dataColumn.type_name,
                onChartHover,
                onChartLeave,
                onChartClick,
              });
            },
          }),
        );
    }
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, DataValue>[];
  totalRows: number;
  totalPages: number;
}

export interface UseExperimentDataProps {
  experimentId: string; // The ID of the experiment to fetch
  tableName: string; // Name of the table to fetch
  page: number; // Page to fetch; pages start with 1
  pageSize: number; // Page to fetch; pages start with 1
  formatFunction: DataRenderFunction; // Function used to render the column value
  commentsColumnName?: string; // Name for the comments column
  onChartHover?: (data: number[], columnName: string) => void;
  onChartLeave?: () => void;
  onChartClick?: (data: number[], columnName: string) => void;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 */
export const useExperimentData = ({
  experimentId,
  page,
  pageSize,
  tableName,
  formatFunction,
  commentsColumnName,
  onChartHover,
  onChartLeave,
  onChartClick,
}: UseExperimentDataProps) => {
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
          columns: createTableColumns({
            experimentId,
            tableName,
            data: tableData.data,
            formatFunction,
            commentsColumnName,
            onChartHover,
            onChartLeave,
            onChartClick,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [
    tableData,
    experimentId,
    tableName,
    formatFunction,
    commentsColumnName,
    onChartHover,
    onChartLeave,
    onChartClick,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};

export interface SampleTable {
  name: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
}

export interface UseExperimentSampleDataProps {
  experimentId: string; // The ID of the experiment to fetch
  sampleSize?: number; // Number of sample rows to fetch
  formatFunction: DataRenderFunction; // Function used to render the column value
}

/**
 * Hook to fetch experiment sample data by ID
 */
export const useExperimentSampleData = ({
  experimentId,
  sampleSize = 5,
  formatFunction,
}: UseExperimentSampleDataProps) => {
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
          columns: createTableColumns({ experimentId, data: tableData.data, formatFunction }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
      });
    });
    return tables;
  }, [data, experimentId, formatFunction]);

  return { sampleTables, isLoading, error };
};
