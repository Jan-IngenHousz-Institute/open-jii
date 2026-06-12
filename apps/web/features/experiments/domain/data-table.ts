/**
 * Pure rules for the experiment data table: canonical column display order,
 * column-def building from table metadata, filter compaction, and the
 * query/cache-key derivation for the paginated vs. filtered read paths.
 * `useExperimentData` composes these with the tsr query layer.
 */
import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";

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

// Render-result type stays opaque here; the hook layer narrows it to JSX.
export type DataCellRenderer = (
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
) => unknown;

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

export interface CreateTableColumnsParams {
  data: ExperimentData | undefined;
  formatFunction?: DataCellRenderer;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
}

export function createTableColumns({
  data,
  formatFunction,
  onChartClick,
  onAddAnnotation,
  onDeleteAnnotations,
  onToggleCellExpansion,
  isCellExpanded,
  errorColumn,
}: CreateTableColumnsParams): AccessorKeyColumnDef<DataRow, unknown>[] {
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
    columns.push({
      accessorKey: dataColumn.name,
      header: getHeader(dataColumn.name),
      size: getColumnWidth(dataColumn.type_text, dataColumn.name),
      meta: {
        type: dataColumn.type_text,
      },
      cell: ({ row }) => {
        return getRow(dataColumn.name, dataColumn.type_text, row);
      },
    });
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

export function buildTableMetadata(
  table: { data?: ExperimentData; totalPages: number; totalRows: number } | undefined,
  params: Omit<CreateTableColumnsParams, "data">,
): TableMetadata | undefined {
  if (!table) {
    return undefined;
  }
  return {
    columns: createTableColumns({ data: table.data, ...params }),
    totalPages: table.totalPages,
    totalRows: table.totalRows,
    // Same display order as `columns` above so downstream consumers
    // (filter pickers, dashboard table-widget column picker, etc.)
    // present columns in the canonical "timestamps first, then by
    // type" sequence rather than whatever raw order Databricks
    // returned.
    rawColumns: table.data
      ? sortColumnsForDisplay(
          table.data.columns.map((col) => ({
            name: col.name,
            type_name: col.type_name,
            type_text: col.type_text,
          })),
        )
      : undefined,
    errorColumn: params.errorColumn,
  };
}

export function compactFilters(filters: DataFilter[] | undefined): DataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const compact = filters.filter((f) => zDataFilter.safeParse(f).success);
  return compact.length > 0 ? compact : undefined;
}

export interface ExperimentDataQueryParams {
  experimentId: string;
  tableName: string;
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  filters?: DataFilter[];
}

export interface ExperimentDataQueryPlan {
  query: {
    tableName: string;
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    filters?: string;
  };
  queryKey: (string | number | undefined)[];
}

/**
 * Request query + cache key for one experiment-data read. Filters are
 * compacted (invalid entries dropped) and JSON-encoded with stable output
 * so semantically identical filter sets share a query cache entry. When
 * filters are active the backend switches off the paginated path: sending
 * page/pageSize would be ignored, so they are stripped from the request —
 * and must then not appear in the key either, or we'd split the cache on a
 * value the server never sees.
 */
export function buildExperimentDataQuery({
  experimentId,
  tableName,
  page,
  pageSize,
  orderBy,
  orderDirection,
  filters,
}: ExperimentDataQueryParams): ExperimentDataQueryPlan {
  const cleanedFilters = compactFilters(filters);
  const filtersJson = cleanedFilters ? JSON.stringify(cleanedFilters) : undefined;
  const hasFilters = filtersJson !== undefined;

  return {
    query: {
      tableName,
      page: hasFilters ? undefined : page,
      pageSize: hasFilters ? undefined : pageSize,
      orderBy,
      orderDirection,
      filters: filtersJson,
    },
    queryKey: [
      "experiment",
      experimentId,
      tableName,
      orderBy,
      orderDirection,
      filtersJson,
      ...(hasFilters ? [] : [page, pageSize]),
    ],
  };
}
