"use client";

import React from "react";

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
  if (val == null) return <span className="text-[#CDD5DB]">—</span>;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-[#CDD5DB]">[]</span>;
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
      <div className="overflow-auto rounded-lg border border-[#EDF2F6]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-b-[#EDF2F6] bg-[#F7F8FA]">
              {keys.map((key) => (
                <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-[#011111]">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i < data.length - 1 ? "border-b border-b-[#EDF2F6]" : ""}>
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 align-top text-xs text-[#011111]">
                    {renderCellValue(isPlainObject(row) ? row[key] : null, key, options)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isPlainObject(data)) {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <p className="text-sm text-[#68737B]">{options.noDataLabel}</p>;
    return (
      <div className="overflow-auto rounded-lg border border-[#EDF2F6]">
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([k, v], i) => (
              <tr key={k} className={i < entries.length - 1 ? "border-b border-b-[#EDF2F6]" : ""}>
                <th
                  scope="row"
                  className="whitespace-nowrap bg-[#F7F8FA] px-3 py-2 text-left align-top text-xs font-semibold text-[#011111]"
                >
                  {k}
                </th>
                <td className="px-3 py-2 align-top text-xs text-[#011111]">
                  {renderCellValue(v, k, options)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const text =
    typeof data === "string" || typeof data === "number" || typeof data === "boolean"
      ? String(data)
      : JSON.stringify(data);
  return <p className="px-3 py-2 text-xs text-[#011111]">{text}</p>;
}
