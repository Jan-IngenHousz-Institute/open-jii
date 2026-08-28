import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
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
} from "@repo/api/transforms/column-type-utils";

import type { DataTableFeatures } from "./data-table-features";

export type DataRow = Record<string, unknown>;
export type DataRenderFunction = (
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
  errorColumn?: string,
) => string | React.JSX.Element;

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
export function sortColumnsForDisplay<T extends ExperimentDataColumn>(columns: readonly T[]): T[] {
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
  columns: ExperimentDataColumn[] | undefined;
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
}

/**
 * Tanstack column definitions for a set of warehouse columns: display order,
 * width and per-type cell rendering. Shared with any surface that shows
 * warehouse-shaped rows, so a reading renders the same wherever it appears.
 */
export function createTableColumns({
  columns: dataColumns,
  formatFunction,
  onChartClick,
  onAddAnnotation,
  onDeleteAnnotations,
  onToggleCellExpansion,
  isCellExpanded,
  errorColumn,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataTableFeatures, DataRow>();

  const columns: AccessorKeyColumnDef<DataTableFeatures, DataRow, unknown>[] = [];
  if (!dataColumns) {
    return columns;
  }

  const sortedColumns = sortColumnsForDisplay(dataColumns);

  function getHeader(columnName: string) {
    return columnName;
  }

  function getRow(columnName: string, typeName: string, row: Row<DataTableFeatures, DataRow>) {
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
  columns: AccessorKeyColumnDef<DataTableFeatures, DataRow, unknown>[];
  totalRows: number;
  totalPages: number;
  rawColumns?: ExperimentDataColumn[];
  errorColumn?: string;
}
