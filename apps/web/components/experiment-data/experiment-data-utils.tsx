import { flexRender } from "@tanstack/react-table";
import type { Row, HeaderGroup, RowData } from "@tanstack/react-table";
import React from "react";
import { ExperimentDataTableAnnotationsCell } from "~/components/experiment-data/experiment-data-table-annotations-cell";
import type { DataRow } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { AnnotationType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Skeleton, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components";

import { ExperimentDataTableArrayCell } from "./experiment-data-table-array-cell";
import { ExperimentDataTableChartCell } from "./experiment-data-table-chart-cell";
import { ExperimentDataTableMapCell } from "./experiment-data-table-map-cell";
import { ExperimentDataTableUserCell } from "./experiment-data-table-user-cell";

const ANNOTATIONS_STRUCT_STRING =
  "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>";

export function formatValue(
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], annotationType: AnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], annotationType: AnnotationType) => void,
) {
  switch (type) {
    case "DOUBLE":
    case "INT":
    case "LONG":
    case "BIGINT":
      return <div className="text-right tabular-nums">{value as number}</div>;
    case "TIMESTAMP":
      return (value as string).substring(0, 19).replace("T", " ");
    case "USER":
      return (
        <ExperimentDataTableUserCell data={value as string} columnName={columnName ?? "User"} />
      );
    case "STRING":
      return value as string;
    case ANNOTATIONS_STRUCT_STRING:
      return (
        <ExperimentDataTableAnnotationsCell
          data={value as string}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      );
    case "ARRAY":
    case "ARRAY<DOUBLE>":
    case "ARRAY<REAL>":
    case "ARRAY<FLOAT>":
    case "ARRAY<NUMERIC>":
      return (
        <ExperimentDataTableChartCell
          data={value as string} // Pass the raw string value to be parsed
          columnName={columnName ?? "Chart"}
          onHover={onChartHover}
          onLeave={onChartLeave}
          onClick={onChartClick}
        />
      );
    default: {
      // Check if the type contains ARRAY<STRUCT<...>>
      if (type.includes("ARRAY<STRUCT<")) {
        return (
          <ExperimentDataTableArrayCell data={value as string} columnName={columnName ?? "Array"} />
        );
      }

      // Check if the type contains MAP
      if (type.includes("MAP<STRING,") || type === "MAP") {
        return (
          <ExperimentDataTableMapCell data={value as string} _columnName={columnName ?? "Map"} />
        );
      }

      // Check if the type contains ARRAY and appears to be numeric
      if (
        type.includes("ARRAY") &&
        (type.includes("DOUBLE") ||
          type.includes("REAL") ||
          type.includes("FLOAT") ||
          type.includes("NUMERIC"))
      ) {
        return (
          <ExperimentDataTableChartCell
            data={value as string}
            columnName={columnName ?? "Chart"}
            onHover={onChartHover}
            onLeave={onChartLeave}
            onClick={onChartClick}
          />
        );
      }
      return value as string;
    }
  }
}

export function ExperimentTableHeader({ headerGroups }: { headerGroups: HeaderGroup<DataRow>[] }) {
  return headerGroups.map((headerGroup) => (
    <TableHeader key={headerGroup.id}>
      <TableRow className="h-2">
        {headerGroup.headers.map((header) => {
          const columnDef = header.column.columnDef;
          const meta = columnDef.meta as { type?: string } | undefined;
          const isNumericColumn =
            meta?.type === "DOUBLE" ||
            meta?.type === "INT" ||
            meta?.type === "LONG" ||
            meta?.type === "BIGINT";

          return (
            <TableHead
              key={header.id}
              className={isNumericColumn ? "text-right" : "text-left"}
              style={{
                minWidth: header.column.columnDef.size,
              }}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
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
}: {
  rows: Row<RowData>[];
  columnCount: number;
}) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="h-4 text-center">
          {t("experimentDataTable.noResults")}
        </TableCell>
      </TableRow>
    );
  return rows.map((row) => (
    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          style={{
            minWidth: cell.column.columnDef.size,
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

export function LoadingRows({ rowCount, columnCount }: { rowCount: number; columnCount: number }) {
  const { t } = useTranslation();
  return (
    <>
      <TableRow>
        <TableCell colSpan={columnCount} className="h-4">
          {t("experimentDataTable.loading")}
        </TableCell>
      </TableRow>
      {Array.from({ length: rowCount - 1 }).map((_, index) => (
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
