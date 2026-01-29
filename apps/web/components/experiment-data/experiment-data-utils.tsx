import { flexRender } from "@tanstack/react-table";
import type { Row, HeaderGroup, RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import React from "react";
import { ExperimentDataTableAnnotationsCell } from "~/components/experiment-data/experiment-data-table-annotations-cell";
import type {
  DataRow,
  TableMetadata,
} from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { AnnotationType } from "@repo/api";
import { WellKnownColumnTypes, ColumnPrimitiveType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Skeleton, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { ExperimentDataTableArrayCell } from "./experiment-data-table-array-cell";
import { ExperimentDataTableCellCollapsible } from "./experiment-data-table-cell-collapsible";
import { ExperimentDataTableChartCell } from "./experiment-data-table-chart-cell";
import { ExperimentDataTableMapCell } from "./experiment-data-table-map-cell";
import { ExperimentDataTableTextCell } from "./experiment-data-table-text-cell";
import { ExperimentDataTableUserCell } from "./experiment-data-table-user-cell";
import { ExperimentDataTableVariantCell } from "./experiment-data-table-variant-cell";

// Local type utilities (UI-specific, not part of shared API)
function isNumericType(type?: string): boolean {
  if (!type) return false;
  const numericTypes: string[] = [
    ColumnPrimitiveType.TINYINT,
    ColumnPrimitiveType.SMALLINT,
    ColumnPrimitiveType.INT,
    ColumnPrimitiveType.BIGINT,
    ColumnPrimitiveType.LONG,
    ColumnPrimitiveType.FLOAT,
    ColumnPrimitiveType.DOUBLE,
    ColumnPrimitiveType.REAL,
  ];
  return numericTypes.includes(type) || type.startsWith("DECIMAL") || type.startsWith("NUMERIC");
}

function isArrayType(type?: string): boolean {
  return !!type && type.startsWith("ARRAY");
}

function isMapType(type?: string): boolean {
  return !!type && type.startsWith("MAP");
}

function isStructType(type?: string): boolean {
  return !!type && type.startsWith("STRUCT");
}

function isVariantType(type?: string): boolean {
  return !!type && type === "VARIANT";
}

function isStructArrayType(type?: string): boolean {
  return !!type && type.startsWith("ARRAY") && type.includes("STRUCT");
}

function isNumericArrayType(type?: string): boolean {
  if (!type || !isArrayType(type)) return false;
  const numericArrays = [
    "ARRAY",
    "ARRAY<TINYINT>",
    "ARRAY<SMALLINT>",
    "ARRAY<INT>",
    "ARRAY<BIGINT>",
    "ARRAY<FLOAT>",
    "ARRAY<DOUBLE>",
    "ARRAY<DECIMAL>",
  ];
  return (
    numericArrays.includes(type) ||
    (type.includes("ARRAY") &&
      (type.includes("DOUBLE") ||
        type.includes("REAL") ||
        type.includes("FLOAT") ||
        type.includes("NUMERIC")))
  );
}

function isSortableType(type?: string): boolean {
  if (!type) return false;
  // Complex types cannot be sorted
  if (isArrayType(type) || isMapType(type) || isStructType(type) || isVariantType(type))
    return false;
  // All primitive types can be sorted
  return true;
}

function getTableHeadClassName(isNumericColumn: boolean, isSortable: boolean): string {
  return cn(
    isNumericColumn ? "text-right" : "text-left",
    isSortable && "hover:bg-muted/50 cursor-pointer select-none",
  );
}

function getSortColumnName(columnName: string, columnType?: string): string {
  // For USER struct columns, sort by name field instead of the column name
  if (columnType === WellKnownColumnTypes.USER) {
    return `${columnName}.name`;
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
  onAddAnnotation?: (rowIds: string[], annotationType: AnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], annotationType: AnnotationType) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
) {
  switch (type) {
    case ColumnPrimitiveType.DOUBLE:
    case ColumnPrimitiveType.INT:
    case ColumnPrimitiveType.LONG:
    case ColumnPrimitiveType.BIGINT:
      return <div className="text-right tabular-nums">{value as number}</div>;
    case ColumnPrimitiveType.TIMESTAMP:
      return (value as string).substring(0, 19).replace("T", " ");
    case ColumnPrimitiveType.STRING:
      return <ExperimentDataTableTextCell text={value as string} />;
    case WellKnownColumnTypes.CONTRIBUTOR:
      return (
        <ExperimentDataTableUserCell data={value as string} columnName={columnName ?? "User"} />
      );
    case WellKnownColumnTypes.ANNOTATIONS:
      return (
        <ExperimentDataTableAnnotationsCell
          data={value as string}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      );
    default: {
      // Check for numeric arrays (for chart rendering)
      if (isNumericArrayType(type)) {
        return (
          <ExperimentDataTableChartCell
            data={value as string}
            columnName={columnName ?? "Chart"}
            onClick={onChartClick}
          />
        );
      }

      // Check if the type is ARRAY<STRUCT<...>>
      if (isStructArrayType(type)) {
        return (
          <ExperimentDataTableArrayCell
            data={value as string}
            columnName={columnName ?? "Array"}
            rowId={rowId}
            isExpanded={isCellExpanded?.(rowId, columnName ?? "Array") ?? false}
            onToggleExpansion={onToggleCellExpansion}
          />
        );
      }

      // Check if the type is MAP
      if (isMapType(type)) {
        return (
          <ExperimentDataTableMapCell
            data={value as string}
            columnName={columnName ?? "Map"}
            rowId={rowId}
            isExpanded={isCellExpanded?.(rowId, columnName ?? "Map") ?? false}
            onToggleExpansion={onToggleCellExpansion}
          />
        );
      }

      // Check if the type is VARIANT
      if (isVariantType(type)) {
        return (
          <ExperimentDataTableVariantCell
            data={value as string}
            columnName={columnName ?? "Variant"}
            rowId={rowId}
            isExpanded={isCellExpanded?.(rowId, columnName ?? "Variant") ?? false}
            onToggleExpansion={onToggleCellExpansion}
          />
        );
      }

      return value as string;
    }
  }
}

export function ExperimentTableHeader({
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
          const meta = columnDef.meta as { type?: string } | undefined;
          const columnName = header.column.id;

          const isNumericColumn = isNumericType(meta?.type);
          const canSort = isSortableType(meta?.type);
          const isSortable = columnName !== "select" && !!onSort && canSort;
          const columnType = meta?.type;
          const actualSortColumn = getSortColumnName(columnName, columnType);
          const isCurrentlySorted = sortColumn === actualSortColumn;

          return (
            <TableHead
              key={`${headerGroup.id}-${header.id}-${headerIndex}`}
              className={getTableHeadClassName(isNumericColumn, isSortable)}
              style={{
                minWidth: header.column.columnDef.size,
              }}
              onClick={() => isSortable && onSort(columnName, columnType)}
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

export function ExperimentDataRows({
  rows,
  columnCount,
  expandedCells = {},
  tableRows,
  columns = [],
}: {
  rows: Row<RowData>[];
  columnCount: number;
  expandedCells?: Record<string, boolean>;
  tableRows?: DataRow[];
  columns?: TableMetadata["rawColumns"];
}) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="h-4 text-center">
          {t("experimentDataTable.noResults")}
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => {
    const rowId = row.original.id as string;

    // Check if any cell in this row is expanded
    const expandedCell = Object.keys(expandedCells).find((key) => {
      return key.startsWith(`${rowId}:`) && expandedCells[key];
    });

    return (
      <React.Fragment key={row.id}>
        <TableRow data-state={row.getIsSelected() && "selected"}>
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
        {expandedCell && tableRows && (
          <ExperimentDataTableCellCollapsible
            key={`${row.id}-expanded`}
            columnCount={columnCount}
            columnName={expandedCell.split(":")[1]}
            columnType={columns.find((col) => col.name === expandedCell.split(":")[1])?.type ?? ""}
            cellData={row.original[expandedCell.split(":")[1]] as string}
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
