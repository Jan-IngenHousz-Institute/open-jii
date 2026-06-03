import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type {
  ExperimentData,
  AnnotationType,
  DataColumn,
  DataFilter,
} from "@repo/api/schemas/experiment.schema";
import { zDataFilter } from "@repo/api/schemas/experiment.schema";
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
} from "@repo/api/utils/column-type-utils";

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

// Pinned to the front in a fixed display order. Shared across the rendered
// table columns AND the `rawColumns` array so consumers like the dashboard
// table-widget column picker see the same default order the data tab
// presents (timestamps first, then variants, structs, ...).
const PINNED_TIME_COLUMNS = ["measurement_time_local", "local_time", "measurement_time_utc"];

function getTypePrecedence(typeText: string): number {
  if (isTimestampType(typeText)) {
    return 1;
  }
  if (isVariantType(typeText)) {
    return 2;
  }
  if (
    isWellKnownType(typeText) ||
    isMapType(typeText) ||
    isStructArrayType(typeText) ||
    isStructType(typeText)
  ) {
    return 3;
  }
  if (isStringType(typeText)) {
    return 4;
  }
  if (isNumericType(typeText) || isDecimalType(typeText)) {
    return 5;
  }
  if (isArrayType(typeText)) {
    return 6;
  }
  return 7;
}

/**
 * Default display order for an experiment's columns. The pinned-time
 * columns (measurement_time_*) come first in their fixed order, then
 * remaining columns are grouped by type precedence (timestamps, variants,
 * structs, strings, numerics, arrays, other). Used as the canonical
 * starting order whenever the user hasn't explicitly reordered.
 */
export function sortColumnsForDisplay<T extends DataColumn>(columns: readonly T[]): T[] {
  return [...columns].sort((a, b) => {
    const pinnedA = PINNED_TIME_COLUMNS.indexOf(a.name);
    const pinnedB = PINNED_TIME_COLUMNS.indexOf(b.name);
    if (pinnedA !== -1 && pinnedB !== -1) {
      return pinnedA - pinnedB;
    }
    if (pinnedA !== -1) {
      return -1;
    }
    if (pinnedB !== -1) {
      return 1;
    }
    return getTypePrecedence(a.type_text) - getTypePrecedence(b.type_text);
  });
}

export function getColumnWidth(typeText: string, columnName?: string): number | undefined {
  // Fixed widths for local time columns
  if (columnName === "measurement_time_local") {
    return 220;
  }
  if (columnName === "local_time") {
    return 90;
  }
  if (columnName === "measurement_time_utc") {
    return 175;
  }
  // Set medium width for well-known columns (user columns with avatar + name)
  if (isWellKnownType(typeText)) {
    return 180;
  }
  // Set medium width for struct/map columns that contain collapsible JSON
  if (isStructArrayType(typeText) || isMapType(typeText) || isStructType(typeText)) {
    return 180;
  }
  // Set smaller width for array columns that contain charts
  if (isArrayType(typeText)) {
    return 120;
  }
  // Set medium width for VARIANT columns that contain collapsible JSON
  if (isVariantType(typeText)) {
    return 180;
  }
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
  if (!data) {
    return columns;
  }

  const sortedColumns = sortColumnsForDisplay(data.columns);

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
        size: getColumnWidth(dataColumn.type_text, dataColumn.name),
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
  /**
   * Optional structured filter conditions. Forwarded to the backend as a
   * JSON-encoded query param. When non-empty the backend's ad-hoc path
   * takes over from the paginated read: the response is the full filtered
   * result capped by the server's hard limit, `totalPages` is always 1,
   * and `totalRows` reports the row count returned (not the unfiltered
   * table size).
   */
  filters?: DataFilter[];
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
  enabled?: boolean;
}

function compactFilters(filters: DataFilter[] | undefined): DataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const compact = filters.filter((f) => zDataFilter.safeParse(f).success);
  return compact.length > 0 ? compact : undefined;
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
    filters,
    formatFunction,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
    onToggleCellExpansion,
    isCellExpanded,
    errorColumn,
    enabled = true,
  } = params;

  const cleanedFilters = compactFilters(filters);
  // Stable JSON for both cache key and request encoding so semantically
  // identical filter sets share a query cache entry.
  const filtersJson = useMemo(
    () =>
      cleanedFilters && cleanedFilters.length > 0 ? JSON.stringify(cleanedFilters) : undefined,
    [cleanedFilters],
  );
  // When filters are active the backend switches off the paginated path.
  // Sending page/pageSize would be ignored; stripping them keeps the cache
  // key tight and the URL readable.
  const hasFilters = filtersJson !== undefined;

  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: {
        tableName,
        page: hasFilters ? undefined : page,
        pageSize: hasFilters ? undefined : pageSize,
        orderBy,
        orderDirection,
        filters: filtersJson,
      },
    },
    // page/pageSize are stripped from the request when filters are active, so
    // they must not appear in the key or we'd split the cache on a value the
    // server never sees.
    queryKey: [
      "experiment",
      experimentId,
      tableName,
      orderBy,
      orderDirection,
      filtersJson,
      ...(hasFilters ? [] : [page, pageSize]),
    ],
    staleTime: STALE_TIME,
    enabled,
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
          // Same display order as `columns` above so downstream consumers
          // (filter pickers, dashboard table-widget column picker, etc.)
          // present columns in the canonical "timestamps first, then by
          // type" sequence rather than whatever raw order Databricks
          // returned.
          rawColumns: tableData.data
            ? sortColumnsForDisplay(
                tableData.data.columns.map((col) => ({
                  name: col.name,
                  type_name: col.type_name,
                  type_text: col.type_text,
                })),
              )
            : undefined,
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
