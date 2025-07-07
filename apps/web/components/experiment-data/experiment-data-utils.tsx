import { flexRender } from "@tanstack/react-table";
import type { Row, HeaderGroup, RowData } from "@tanstack/react-table";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Skeleton, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components";

export function formatValue(value: unknown, type: string) {
  switch (type) {
    case "DOUBLE":
    case "INT":
    case "LONG":
    case "BIGINT":
      return <div className="text-right italic">{value as number}</div>;
    case "TIMESTAMP":
      return (value as string).substring(0, 19).replace("T", " ");
    default: {
      return value as string;
    }
  }
}

export function ExperimentTableHeader({ headerGroups }: { headerGroups: HeaderGroup<RowData>[] }) {
  return headerGroups.map((headerGroup) => (
    <TableHeader key={headerGroup.id}>
      <TableRow className="h-2">
        {headerGroup.headers.map((header) => {
          return (
            <TableHead
              key={header.id}
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
  const { t } = useTranslation(undefined, "common");
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
  const { t } = useTranslation(undefined, "common");
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
