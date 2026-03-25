import Papa from "papaparse";

import type { MetadataColumn, MetadataRow } from "../types";

/**
 * Infer column type by inspecting the actual JS types of values.
 * PapaParse's dynamicTyping handles number conversion, so we just
 * check typeof. Dates still need a pattern check since PapaParse
 * doesn't auto-detect them.
 */
function inferColumnType(rows: MetadataRow[], columnId: string): "string" | "number" | "date" {
  const values = rows
    .map((row) => row[columnId])
    .filter((v) => v !== null && v !== undefined && v !== "");

  if (values.length === 0) return "string";

  if (values.every((v) => typeof v === "number")) return "number";

  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}[/-]\d{2}[/-]\d{4}/;
  if (values.every((v) => typeof v === "string" && datePattern.test(v) && !isNaN(Date.parse(v))))
    return "date";

  return "string";
}

/**
 * Convert PapaParse header-mode result into our MetadataColumn/MetadataRow format.
 */
function toMetadata(parsed: Papa.ParseResult<Record<string, unknown>>): {
  columns: MetadataColumn[];
  rows: MetadataRow[];
} {
  if (!parsed.meta.fields?.length) {
    return { columns: [], rows: [] };
  }

  const columns: MetadataColumn[] = parsed.meta.fields.map((name, index) => ({
    id: `col_${index}`,
    name: name.trim(),
    type: "string" as const,
  }));

  const fieldToColId = new Map(parsed.meta.fields.map((name, index) => [name, `col_${index}`]));

  const rows: MetadataRow[] = [];
  for (let i = 0; i < parsed.data.length; i++) {
    const record = parsed.data[i];
    // Skip rows where every value is empty
    const vals = Object.values(record);
    if (vals.length === 0 || vals.every((v) => v === "" || v === null || v === undefined)) continue;

    const row: MetadataRow = { _id: `row_${i}_${Date.now()}` };
    for (const [field, colId] of fieldToColId) {
      row[colId] = record[field] ?? "";
    }
    rows.push(row);
  }

  columns.forEach((col) => {
    col.type = inferColumnType(rows, col.id);
  });

  return { columns, rows };
}

/**
 * Parse CSV/TSV text into columns and rows using PapaParse.
 * Auto-detects delimiters and dynamically types numeric values.
 */
export function parseDelimitedText(
  text: string,
  delimiter?: "," | "\t" | ";" | "|",
): { columns: MetadataColumn[]; rows: MetadataRow[] } {
  const parsed = Papa.parse<Record<string, unknown>>(text.trim(), {
    delimiter: delimiter ?? "",
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  return toMetadata(parsed);
}

/**
 * Extract the text value from an ExcelJS cell, which can be a primitive,
 * Date, rich text object, formula object, or hyperlink object.
 */
function resolveExcelCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Rich text: { richText: [{ text: '...', font: {...} }] }
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    // Formula: { formula: '...', result: ... }
    if ("result" in obj) return resolveExcelCellValue(obj.result);
    // Hyperlink: { text: '...', hyperlink: '...' }
    if ("text" in obj) return typeof obj.text === "string" ? obj.text : "";
  }
  return "";
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Read and parse a File (CSV or Excel)
 */
export async function parseFile(
  file: File,
): Promise<{ columns: MetadataColumn[]; rows: MetadataRow[] }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "tsv" || extension === "txt") {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(toMetadata(results)),
        error: (err: Error) => reject(err),
      });
    });
  }

  if (extension === "xlsx" || extension === "xls") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    if (workbook.worksheets.length === 0) return { columns: [], rows: [] };
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount === 0) return { columns: [], rows: [] };

    // Collect all rows from the sheet
    const allRows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(resolveExcelCellValue(cell.value));
      });
      allRows.push(cells);
    });
    if (allRows.length === 0) return { columns: [], rows: [] };

    // Skip leading title rows: a title row typically has all cells with the
    // same value (e.g. sheet name in a merged cell) while the real header row
    // has distinct column names.
    let startIdx = 0;
    if (allRows.length > 1) {
      const firstUnique = new Set(allRows[0].filter(Boolean));
      const secondUnique = new Set(allRows[1].filter(Boolean));
      if (firstUnique.size <= 1 && secondUnique.size > firstUnique.size) {
        startIdx = 1;
      }
    }

    // Normalize column count across rows (title rows or merged cells may have fewer)
    const rows = allRows.slice(startIdx);
    const maxCols = Math.max(...rows.map((r) => r.length));
    const csv = rows
      .map((r) => {
        while (r.length < maxCols) r.push("");
        return r.map(escapeCsvField).join(",");
      })
      .join("\n");
    return parseDelimitedText(csv, ",");
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

/**
 * Try to read clipboard using execCommand fallback
 */
function readClipboardWithExecCommand(): Promise<string> {
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();

    const success = document.execCommand("paste");
    const text = textarea.value;
    document.body.removeChild(textarea);

    if (success && text) {
      resolve(text);
    } else {
      reject(new Error("execCommand paste failed"));
    }
  });
}

/**
 * Read clipboard and parse as delimited text
 */
export async function parseClipboard(): Promise<{
  columns: MetadataColumn[];
  rows: MetadataRow[];
}> {
  let text: string | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), 3000);
    });
    text = await Promise.race([navigator.clipboard.readText(), timeoutPromise]);
  } catch {
    text = null;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!text) {
    try {
      text = await readClipboardWithExecCommand();
    } catch {
      throw new Error(
        "Could not read clipboard. Please try pressing Ctrl+V / Cmd+V to paste directly.",
      );
    }
  }

  if (text.trim() === "") {
    throw new Error(
      "Clipboard is empty. Please copy some data (CSV, TSV, or tab-separated) and try again.",
    );
  }

  const result = parseDelimitedText(text);

  if (result.columns.length === 0) {
    throw new Error(
      "Could not parse clipboard data. Please copy tabular data (CSV, TSV, or tab-separated) with headers.",
    );
  }

  return result;
}

/**
 * Parse text directly (for use with paste events)
 */
export function parseClipboardText(text: string): {
  columns: MetadataColumn[];
  rows: MetadataRow[];
} {
  if (!text || text.trim() === "") {
    throw new Error(
      "Clipboard is empty. Please copy some data (CSV, TSV, or tab-separated) and try again.",
    );
  }

  const result = parseDelimitedText(text);

  if (result.columns.length === 0) {
    throw new Error(
      "Could not parse clipboard data. Please copy tabular data (CSV, TSV, or tab-separated) with headers.",
    );
  }

  return result;
}
