import { flexRender } from "@tanstack/react-table";
import type { Row, HeaderGroup } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import React from "react";
import { DataTableAnnotationsCell } from "~/components/data-table/cells/annotations/data-table-annotations-cell";
import type { DataRow, TableMetadata } from "~/components/data-table/data-table-columns";
import { deviceDisplayName } from "~/components/experiment-visualizations/charts/data/device-cells";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import {
  WellKnownColumnTypes,
  ExperimentColumnPrimitiveType,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  isNumericType,
  isMapType,
  isStructType,
  isVariantType,
  isStructArrayType,
  isNumericArrayType,
  isSortableType,
  isWellKnownSortableType,
  getWellKnownSortField,
} from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import { TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { DataTableArrayCell } from "./cells/array/data-table-array-cell";
import { DataTableChartCell } from "./cells/chart/data-table-chart-cell";
import { DataTableErrorCell } from "./cells/error/data-table-error-cell";
import { DataTableMapCell } from "./cells/map/data-table-map-cell";
import { DataTableStructCell } from "./cells/struct/data-table-struct-cell";
import { DataTableTextCell } from "./cells/text/data-table-text-cell";
import { DataTableUserCell } from "./cells/user/data-table-user-cell";
import { DataTableVariantCell } from "./cells/variant/data-table-variant-cell";
import { DataTableCellCollapsible } from "./data-table-cell-collapsible";

function getTableHeadClassName(isNumericColumn: boolean, isSortable: boolean): string {
  return cn(
    isNumericColumn ? "text-right" : "text-left",
    isSortable && "hover:bg-muted/50 cursor-pointer select-none",
  );
}

function getSortColumnName(columnName: string, columnType?: string): string {
  // For well-known sortable types (e.g., CONTRIBUTOR), sort by a specific field in their struct
  const sortField = getWellKnownSortField(columnType);
  if (sortField) {
    return `${columnName}.${sortField}`;
  }
  return columnName;
}

function getSortIcon(
  isSortable: boolean,
  isCurrentlySorted: boolean,
  sortDirection?: "ASC" | "DESC",
): React.ReactNode {
  if (!isSortable) return null;

  if (isCurrentlySorted) {
    return sortDirection === "ASC" ? (
      <ArrowUp className="ml-2 inline h-4 w-4 text-green-700 dark:text-green-600" />
    ) : (
      <ArrowDown className="ml-2 inline h-4 w-4 text-green-700 dark:text-green-600" />
    );
  }

  return <ArrowUpDown className="ml-2 inline h-4 w-4 opacity-50" />;
}

export function formatValue(
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], annotationType: ExperimentAnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], annotationType: ExperimentAnnotationType) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
  errorColumn?: string,
): string | React.JSX.Element {
  // Check if this is the error column
  if (errorColumn && columnName === errorColumn) {
    return <DataTableErrorCell error={value as string} />;
  }

  // Exact type matches
  const exactTypeFormatters: Record<string, () => string | React.JSX.Element> = {
    [ExperimentColumnPrimitiveType.DOUBLE]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ExperimentColumnPrimitiveType.INT]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ExperimentColumnPrimitiveType.LONG]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ExperimentColumnPrimitiveType.BIGINT]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ExperimentColumnPrimitiveType.TIMESTAMP]: () =>
      (value as string).substring(0, 19).replace("T", " "),
    [ExperimentColumnPrimitiveType.STRING]: () => <DataTableTextCell text={value as string} />,
    [WellKnownColumnTypes.CONTRIBUTOR]: () => (
      <DataTableUserCell data={value as string} columnName={columnName ?? "User"} />
    ),
    [WellKnownColumnTypes.DEVICE]: () => <DataTableTextCell text={deviceDisplayName(value)} />,
    [WellKnownColumnTypes.ANNOTATIONS]: () => (
      <DataTableAnnotationsCell
        data={value as string}
        rowId={rowId}
        onAddAnnotation={onAddAnnotation}
        onDeleteAnnotations={onDeleteAnnotations}
      />
    ),
  };

  if (!value) {
    return "";
  }

  // Check for exact type match
  if (type in exactTypeFormatters) {
    return exactTypeFormatters[type]();
  }

  // Pattern-based type checks
  if (isNumericArrayType(type)) {
    return (
      <DataTableChartCell
        data={value as string}
        columnName={columnName ?? "Chart"}
        onClick={onChartClick}
      />
    );
  }

  if (isStructArrayType(type)) {
    return (
      <DataTableArrayCell
        data={value as string}
        columnName={columnName ?? "Array"}
        rowId={rowId}
        isExpanded={isCellExpanded?.(rowId, columnName ?? "Array") ?? false}
        onToggleExpansion={onToggleCellExpansion}
      />
    );
  }

  if (isMapType(type)) {
    return (
      <DataTableMapCell
        data={value as string}
        columnName={columnName ?? "Map"}
        rowId={rowId}
        isExpanded={isCellExpanded?.(rowId, columnName ?? "Map") ?? false}
        onToggleExpansion={onToggleCellExpansion}
      />
    );
  }

  if (isStructType(type)) {
    return (
      <DataTableStructCell
        data={value as string}
        columnName={columnName ?? "Struct"}
        rowId={rowId}
        isExpanded={isCellExpanded?.(rowId, columnName ?? "Struct") ?? false}
        onToggleExpansion={onToggleCellExpansion}
      />
    );
  }

  if (isVariantType(type)) {
    return (
      <DataTableVariantCell
        data={value as string}
        columnName={columnName ?? "Variant"}
        rowId={rowId}
        isExpanded={isCellExpanded?.(rowId, columnName ?? "Variant") ?? false}
        onToggleExpansion={onToggleCellExpansion}
      />
    );
  }

  return <DataTableTextCell text={value as string} />;
}

export function DataTableHeader({
  headerGroups,
  sortColumn,
  sortDirection,
  onSort,
}: {
  headerGroups: HeaderGroup<DataRow>[];
  sortColumn?: string;
  sortDirection?: "ASC" | "DESC";
  onSort?: (columnName: string, columnType?: string) => void;
}) {
  return headerGroups.map((headerGroup) => (
    <TableHeader key={headerGroup.id}>
      <TableRow className="h-2">
        {headerGroup.headers.map((header, headerIndex) => {
          const columnDef = header.column.columnDef;
          const meta: { type?: string } | undefined = columnDef.meta;
          const columnName = header.column.id;

          const isNumericColumn = isNumericType(meta?.type);
          const canSort = isSortableType(meta?.type) || isWellKnownSortableType(meta?.type);
          const isSortable = columnName !== "select" && !!onSort && canSort;
          const columnType = meta?.type;
          const actualSortColumn = getSortColumnName(columnName, columnType);
          // Check if this column is currently sorted - handle both exact match and nested field match
          // For well-known types like CONTRIBUTOR, sortColumn might be "created_by.name" while columnName is "created_by"
          const isCurrentlySorted = !!(
            sortColumn === actualSortColumn ||
            sortColumn === columnName ||
            sortColumn?.startsWith(`${columnName}.`)
          );

          return (
            <TableHead
              key={`${headerGroup.id}-${header.id}-${headerIndex}`}
              className={getTableHeadClassName(isNumericColumn, isSortable)}
              style={{
                minWidth: header.column.columnDef.size,
              }}
              onClick={() => isSortable && onSort(actualSortColumn, columnType)}
            >
              {header.isPlaceholder ? null : (
                <div className="flex items-center justify-between">
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                  {getSortIcon(isSortable, isCurrentlySorted, sortDirection)}
                </div>
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  ));
}

export function DataTableRows({
  rows,
  columnCount,
  expandedCell,
  tableRows,
  columns = [],
  errorColumn,
}: {
  rows: Row<DataRow>[];
  columnCount: number;
  expandedCell?: { rowId: string; columnName: string } | null;
  tableRows?: DataRow[];
  columns?: TableMetadata["rawColumns"];
  errorColumn?: string;
}) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="h-4 text-center">
          {t("dataTable.noResults")}
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => {
    const rowId = String(row.original.id);

    // Check if this row has an error
    const hasError = errorColumn && !!row.original[errorColumn];

    // Check if this row has an expanded cell
    const expandedColumn =
      expandedCell?.rowId === rowId
        ? columns.find((col) => col.name === expandedCell.columnName)
        : undefined;

    return (
      <React.Fragment key={row.id}>
        <TableRow
          data-state={row.getIsSelected() && "selected"}
          className={cn("", hasError && "border-l-destructive bg-destructive/5 border-l-2")}
        >
          {row.getVisibleCells().map((cell, cellIndex) => (
            <TableCell
              key={`${cell.id}-${cellIndex}`}
              style={{
                minWidth: cell.column.columnDef.size,
                whiteSpace: "nowrap",
              }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>

        {/* Render expanded row if any cell is expanded */}
        {expandedColumn && tableRows && (
          <DataTableCellCollapsible
            key={`${row.id}-expanded`}
            columnCount={columnCount}
            columnName={expandedColumn.name}
            columnType={expandedColumn.type_text}
            cellData={row.original[expandedColumn.name]}
          />
        )}
      </React.Fragment>
    );
  });
}

export function LoadingRows({ rowCount, columnCount }: { rowCount: number; columnCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4" key={`skeleton-col-${colIndex}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
