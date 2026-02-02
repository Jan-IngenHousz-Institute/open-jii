import { flexRender } from "@tanstack/react-table";
import type { Row, HeaderGroup } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import React from "react";
import { ExperimentDataTableAnnotationsCell } from "~/components/experiment-data/table-cells/annotations/experiment-data-table-annotations-cell";
import type {
  DataRow,
  TableMetadata,
} from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { AnnotationType } from "@repo/api";
import {
  WellKnownColumnTypes,
  ColumnPrimitiveType,
  isNumericType,
  isMapType,
  isStructType,
  isVariantType,
  isStructArrayType,
  isNumericArrayType,
  isSortableType,
} from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Skeleton, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { ExperimentDataTableCellCollapsible } from "./experiment-data-table-cell-collapsible";
import { ExperimentDataTableArrayCell } from "./table-cells/array/experiment-data-table-array-cell";
import { ExperimentDataTableChartCell } from "./table-cells/chart/experiment-data-table-chart-cell";
import { ExperimentDataTableErrorCell } from "./table-cells/error/experiment-data-table-error-cell";
import { ExperimentDataTableMapCell } from "./table-cells/map/experiment-data-table-map-cell";
import { ExperimentDataTableStructCell } from "./table-cells/struct/experiment-data-table-struct-cell";
import { ExperimentDataTableTextCell } from "./table-cells/text/experiment-data-table-text-cell";
import { ExperimentDataTableUserCell } from "./table-cells/user/experiment-data-table-user-cell";
import { ExperimentDataTableVariantCell } from "./table-cells/variant/experiment-data-table-variant-cell";

function getTableHeadClassName(isNumericColumn: boolean, isSortable: boolean): string {
  return cn(
    isNumericColumn ? "text-right" : "text-left",
    isSortable && "hover:bg-muted/50 cursor-pointer select-none",
  );
}

function getSortColumnName(columnName: string, columnType?: string): string {
  // For CONTRIBUTOR struct columns, sort by name field instead of the column name
  if (columnType === WellKnownColumnTypes.CONTRIBUTOR) {
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
  errorColumn?: string,
): string | React.JSX.Element {
  // Check if this is the error column
  if (errorColumn && columnName === errorColumn) {
    return <ExperimentDataTableErrorCell error={value as string} />;
  }

  // Exact type matches
  const exactTypeFormatters: Record<string, () => string | React.JSX.Element> = {
    [ColumnPrimitiveType.DOUBLE]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ColumnPrimitiveType.INT]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ColumnPrimitiveType.LONG]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ColumnPrimitiveType.BIGINT]: () => (
      <div className="text-right tabular-nums">{value as number}</div>
    ),
    [ColumnPrimitiveType.TIMESTAMP]: () => (value as string).substring(0, 19).replace("T", " "),
    [ColumnPrimitiveType.STRING]: () => <ExperimentDataTableTextCell text={value as string} />,
    [WellKnownColumnTypes.CONTRIBUTOR]: () => (
      <ExperimentDataTableUserCell data={value as string} columnName={columnName ?? "User"} />
    ),
    [WellKnownColumnTypes.ANNOTATIONS]: () => (
      <ExperimentDataTableAnnotationsCell
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
      <ExperimentDataTableChartCell
        data={value as string}
        columnName={columnName ?? "Chart"}
        onClick={onChartClick}
      />
    );
  }

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

  if (isStructType(type)) {
    return (
      <ExperimentDataTableStructCell
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
      <ExperimentDataTableVariantCell
        data={value as string}
        columnName={columnName ?? "Variant"}
        rowId={rowId}
        isExpanded={isCellExpanded?.(rowId, columnName ?? "Variant") ?? false}
        onToggleExpansion={onToggleCellExpansion}
      />
    );
  }

  return <ExperimentDataTableTextCell text={value as string} />;
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
          const canSort =
            isSortableType(meta?.type) || meta?.type === WellKnownColumnTypes.CONTRIBUTOR;
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
          {t("experimentDataTable.noResults")}
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
          <ExperimentDataTableCellCollapsible
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
