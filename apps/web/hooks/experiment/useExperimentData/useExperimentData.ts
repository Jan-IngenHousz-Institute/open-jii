import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type { ExperimentData, AnnotationType } from "@repo/api";
import { ColumnPrimitiveType, WellKnownColumnTypes } from "@repo/api";

export type DataRow = Record<string, unknown>;
export type DataRenderFunction = (
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

export function getColumnWidth(typeName: string): number | undefined {
  // Set medium width for user columns that contain avatar + name
  if (typeName === WellKnownColumnTypes.CONTRIBUTOR) return 180;
  // Set medium width for array of struct columns that contain collapsible content
  if (typeName.startsWith("ARRAY<STRUCT<")) return 180;
  // Set smaller width for array columns that contain charts
  if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 120;
  // Set medium width for map columns that contain collapsible content
  if (typeName === "MAP" || typeName.startsWith("MAP<")) return 180;
  // Set medium width for VARIANT columns that contain collapsible JSON
  if (typeName === ColumnPrimitiveType.VARIANT) return 180;
  return undefined;
}

interface CreateTableColumnsParams {
  data: ExperimentData | undefined;
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
}

function createTableColumns({
  data,
  formatFunction,
  onChartClick,
  onAddAnnotation,
  onDeleteAnnotations,
  onToggleCellExpansion,
  isCellExpanded,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, unknown>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeName: string): number => {
    switch (typeName) {
      case ColumnPrimitiveType.TIMESTAMP:
      case ColumnPrimitiveType.TIMESTAMP_NTZ:
        return 1;
      case WellKnownColumnTypes.CONTRIBUTOR:
        return 3;
      case ColumnPrimitiveType.STRING:
      case ColumnPrimitiveType.VARCHAR:
      case ColumnPrimitiveType.CHAR:
        return 4;
      case ColumnPrimitiveType.DOUBLE:
      case ColumnPrimitiveType.FLOAT:
      case ColumnPrimitiveType.REAL:
      case ColumnPrimitiveType.INT:
      case ColumnPrimitiveType.LONG:
      case ColumnPrimitiveType.BIGINT:
      case ColumnPrimitiveType.TINYINT:
      case ColumnPrimitiveType.SMALLINT:
        return 5;
      case ColumnPrimitiveType.VARIANT:
        return 2;
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
        onChartClick,
        onAddAnnotation,
        onDeleteAnnotations,
        onToggleCellExpansion,
        isCellExpanded,
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
  rawColumns?: { name: string; type: string }[];
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
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[]) => void,
  onDeleteAnnotations?: (rowIds: string[]) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
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
            onChartClick,
            onAddAnnotation,
            onDeleteAnnotations,
            onToggleCellExpansion,
            isCellExpanded,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
          rawColumns: tableData.data?.columns.map((col) => ({
            name: col.name,
            type: col.type_text,
          })),
        }
      : undefined;
  }, [
    tableData,
    formatFunction,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
    onToggleCellExpansion,
    isCellExpanded,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;
  const displayName = tableData?.displayName;

  return { tableMetadata, tableRows, displayName, isLoading, error };
};
