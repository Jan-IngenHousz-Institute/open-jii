import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type { DataColumn, ExperimentData, AnnotationType } from "@repo/api";

export type DataRow = Record<string, unknown>;
export type DataRenderFunction = (
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void,
) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

export function getColumnWidth(typeName: string): number | undefined {
  // Set medium width for user columns that contain avatar + name
  if (typeName === "USER") return 180;
  // Set medium width for array of struct columns that contain collapsible content
  if (typeName.startsWith("ARRAY<STRUCT<")) return 200;
  // Set smaller width for array columns that contain charts
  if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 120;
  // Set medium width for map columns that contain collapsible content
  if (typeName === "MAP" || typeName.startsWith("MAP<")) return 200;
  return undefined;
}

interface CreateTableColumnsParams {
  data: ExperimentData | undefined;
  formatFunction?: DataRenderFunction;
  onChartHover?: (data: number[], columnName: string) => void;
  onChartLeave?: () => void;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
}

function createTableColumns({
  data,
  formatFunction,
  onChartHover,
  onChartLeave,
  onChartClick,
  onAddAnnotation,
  onDeleteAnnotations,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, unknown>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeName: string): number => {
    switch (typeName) {
      case "TIMESTAMP":
        return 1;
      case "USER":
        return 3;
      case "STRING":
        return 4;
      case "DOUBLE":
      case "INT":
      case "LONG":
      case "BIGINT":
        return 5;
      default:
        if (
          typeName === "MAP" ||
          typeName.startsWith("MAP<") ||
          typeName.startsWith("ARRAY<STRUCT<")
        )
          return 2;
        if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 6;
        return 7; // Other types at the end
    }
  };

  // Sort columns by type precedence
  const sortedColumns = [...data.columns].sort((a, b) => {
    const precedenceA = getTypePrecedence(a.type_text);
    const precedenceB = getTypePrecedence(b.type_text);
    return precedenceA - precedenceB;
  });

  function getHeader(columnName: string) {
    return columnName;
  }

  function getRow(columnName: string, typeName: string, row: Row<DataRow>) {
    const value = row.getValue(columnName);
    const rowId = row.original.id as string | undefined;

    // Format using the provided function
    if (formatFunction) {
      return formatFunction(
        value,
        typeName,
        rowId ?? "",
        columnName,
        onChartHover,
        onChartLeave,
        onChartClick,
        onAddAnnotation,
        onDeleteAnnotations,
      );
    }
    return value as string;
  }

  sortedColumns.forEach((dataColumn) => {
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: getHeader(dataColumn.name),
        size: getColumnWidth(dataColumn.type_text),
        meta: {
          type: dataColumn.type_text,
        },
        cell: ({ row }) => {
          return getRow(dataColumn.name, dataColumn.type_text, row);
        },
      }),
    );
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, unknown>[];
  totalRows: number;
  totalPages: number;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param experimentId The ID of the experiment to fetch
 * @param tableName Name of the table to fetch
 * @param page Page to fetch; pages start with 1
 * @param pageSize Page size to fetch
 * @param orderBy Optional column name to order results by
 * @param orderDirection Optional sort direction for ordering (ASC or DESC)
 * @param formatFunction Function used to render the column value
 * @param onChartHover Event handler for when a chart is hovered
 * @param onChartLeave Event handler for when a chart is no longer hovered
 * @param onChartClick Event handler for when a chart is clicked
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  page: number,
  pageSize: number,
  tableName: string,
  orderBy?: string,
  orderDirection?: "ASC" | "DESC",
  formatFunction?: DataRenderFunction,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[]) => void,
  onDeleteAnnotations?: (rowIds: string[]) => void,
) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize, orderBy, orderDirection },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName, orderBy, orderDirection],
    staleTime: STALE_TIME,
  });

  const tableData = data?.body[0];

  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return tableData
      ? {
          columns: createTableColumns({
            data: tableData.data,
            formatFunction,
            onChartHover,
            onChartLeave,
            onChartClick,
            onAddAnnotation,
            onDeleteAnnotations,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [
    tableData,
    formatFunction,
    onChartHover,
    onChartLeave,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;
  const displayName = tableData?.displayName;

  return { tableMetadata, tableRows, displayName, isLoading, error };
};

export interface SampleTable {
  name: string;
  displayName: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
  columns: DataColumn[]; // Add raw columns for easy access
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
        displayName: tableData.displayName,
        tableMetadata: {
          columns: createTableColumns({ data: tableData.data, formatFunction }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
        columns: tableData.data?.columns ?? [],
      });
    });
    return tables;
  }, [data, formatFunction]);

  return { sampleTables, isLoading, error };
};
