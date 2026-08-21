"use client";

import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import type { ChartClickHandler } from "./output-cell-charts";
import { Sparkline } from "./output-cell-charts";

function isNumericArray(val: unknown): val is number[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val != null && typeof val === "object" && !Array.isArray(val);
}

export interface RenderOptions {
  onChartClick?: ChartClickHandler;
  noDataLabel: string;
}

export function renderCellValue(
  val: unknown,
  columnName: string,
  options: RenderOptions,
): React.ReactNode {
  if (val == null) return <span className="text-muted-foreground/60">—</span>;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-muted-foreground/60">[]</span>;
    if (isNumericArray(val)) {
      return <Sparkline data={val} columnName={columnName} onClick={options.onChartClick} />;
    }
    if (typeof val[0] === "object" && val[0] !== null) return renderDataTable(val, options);
    return val.map((v) => (v == null ? "" : String(v))).join(", ");
  }
  return renderDataTable(val, options);
}

export function renderDataTable(data: unknown, options: RenderOptions): React.ReactNode {
  // Array-of-rows: defensively filter to object rows for the keys union, but render every row in
  // the original order. Primitive/null rows fall back to a single empty-row placeholder so the
  // table doesn't throw or stringify nonsense.
  if (Array.isArray(data) && data.length > 0 && data.some(isPlainObject)) {
    const objectRows = data.filter(isPlainObject);
    const keys = Array.from(new Set(objectRows.flatMap((row) => Object.keys(row))));
    return (
      <div className="border-border overflow-hidden rounded-lg border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-muted">
              {keys.map((key) => (
                <TableHead
                  key={key}
                  className="text-foreground h-auto px-3 py-2 text-left text-xs font-semibold"
                >
                  {key}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                {keys.map((key) => (
                  <TableCell key={key} className="text-foreground px-3 py-2 align-top text-xs">
                    {renderCellValue(isPlainObject(row) ? row[key] : null, key, options)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isPlainObject(data)) {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <p className="text-muted-foreground text-sm">{options.noDataLabel}</p>;
    return (
      <div className="border-border overflow-hidden rounded-lg border">
        <Table className="text-xs">
          <TableBody>
            {entries.map(([k, v]) => (
              <TableRow key={k}>
                <TableHead
                  scope="row"
                  className="bg-muted text-foreground h-auto whitespace-nowrap px-3 py-2 text-left align-top text-xs font-semibold"
                >
                  {k}
                </TableHead>
                <TableCell className="text-foreground px-3 py-2 align-top text-xs">
                  {renderCellValue(v, k, options)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const text =
    typeof data === "string" || typeof data === "number" || typeof data === "boolean"
      ? String(data)
      : JSON.stringify(data);
  return <p className="text-foreground px-3 py-2 text-xs">{text}</p>;
}
