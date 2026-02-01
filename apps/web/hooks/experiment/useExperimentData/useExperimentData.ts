import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type { ExperimentData, AnnotationType, DataColumn } from "@repo/api";
import {
  isTimestampType,
  isStringType,
  isNumericType,
  isVariantType,
  isMapType,
  isStructArrayType,
  isArrayType,
  isDecimalType,
  isWellKnownType,
  isStructType,
} from "@repo/api";

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
  errorColumn?: string,
) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

export function getColumnWidth(typeText: string): number | undefined {
  // Set medium width for well-known columns (user columns with avatar + name)
  if (isWellKnownType(typeText)) return 180;
  // Set medium width for struct/map columns that contain collapsible JSON
  if (isStructArrayType(typeText) || isMapType(typeText) || isStructType(typeText)) return 180;
  // Set smaller width for array columns that contain charts
  if (isArrayType(typeText)) return 120;
  // Set medium width for VARIANT columns that contain collapsible JSON
  if (isVariantType(typeText)) return 180;
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
  errorColumn?: string;
}

function createTableColumns({
  data,
  formatFunction,
  onChartClick,
  onAddAnnotation,
  onDeleteAnnotations,
  onToggleCellExpansion,
  isCellExpanded,
  errorColumn,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, unknown>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeText: string): number => {
    // Timestamp types (precedence 1)
    if (isTimestampType(typeText)) {
      return 1;
    }

    // Variant types (precedence 2)
    if (isVariantType(typeText)) {
      return 2;
    }

    // Well-known types (CONTRIBUTOR, etc.), MAP, and ARRAY<STRUCT< types (precedence 3)
    if (
      isWellKnownType(typeText) ||
      isMapType(typeText) ||
      isStructArrayType(typeText) ||
      isStructType(typeText)
    ) {
      return 3;
    }

    // String types (precedence 4)
    if (isStringType(typeText)) {
      return 4;
    }

    // Numeric types (precedence 5)
    if (isNumericType(typeText) || isDecimalType(typeText)) {
      return 5;
    }

    // Array types (precedence 6)
    if (isArrayType(typeText)) {
      return 6;
    }

    // Other types (precedence 7)
    return 7;
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
        errorColumn,
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
  rawColumns?: DataColumn[];
  errorColumn?: string;
}

export interface UseExperimentDataParams {
  experimentId: string;
  page: number;
  pageSize: number;
  tableName: string;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
  enabled?: boolean;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param params Parameters for fetching experiment data
 * @param params.experimentId The ID of the experiment to fetch
 * @param params.tableName Name of the table to fetch
 * @param params.page Page to fetch; pages start with 1
 * @param params.pageSize Page size to fetch
 * @param params.orderBy Optional column name to order results by
 * @param params.orderDirection Optional sort direction for ordering (ASC or DESC)
 * @param params.formatFunction Function used to render the column value
 * @param params.onChartClick Event handler for when a chart is clicked
 * @param params.onAddAnnotation Event handler for adding annotations
 * @param params.onDeleteAnnotations Event handler for deleting annotations
 * @param params.onToggleCellExpansion Event handler for toggling cell expansion
 * @param params.isCellExpanded Function to check if cell is expanded
 * @param params.errorColumn Optional error column name
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (params: UseExperimentDataParams) => {
  const {
    experimentId,
    page,
    pageSize,
    tableName,
    orderBy,
    orderDirection,
    formatFunction,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
    onToggleCellExpansion,
    isCellExpanded,
    errorColumn,
  } = params;
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize, orderBy, orderDirection },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName, orderBy, orderDirection],
    staleTime: STALE_TIME,
    enabled: !!tableName,
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
            errorColumn,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
          rawColumns: tableData.data?.columns.map((col) => ({
            name: col.name,
            type_name: col.type_name,
            type_text: col.type_text,
          })),
          errorColumn,
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
    errorColumn,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};
