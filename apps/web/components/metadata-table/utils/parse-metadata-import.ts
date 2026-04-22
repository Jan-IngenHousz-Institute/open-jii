import Papa from "papaparse";

import type { MetadataColumn, MetadataRow } from "../types";

const CLIPBOARD_TIMEOUT_MS = 30_000;
const DELIMITED_EXTENSIONS = new Set(["csv", "tsv", "txt"]);
const EXCEL_EXTENSIONS = new Set(["xlsx", "xls"]);

function looksLikeDateString(v: unknown): boolean {
  if (typeof v !== "string") return false;
  // Must contain a date separator to avoid false positives on plain numbers/words
  if (!v.includes("-") && !v.includes("/")) return false;
  const parsed = Date.parse(v);
  return !isNaN(parsed);
}

function inferColumnType(rows: MetadataRow[], columnId: string): MetadataColumn["type"] {
  const values = rows.map((row) => row[columnId]).filter((v) => v != null && v !== "");

  if (values.length === 0) return "string";
  if (values.every((v) => typeof v === "number")) return "number";
  if (values.every(looksLikeDateString)) return "date";

  return "string";
}

/**
 * Convert headers + records into MetadataColumn/MetadataRow format.
 * Shared between the CSV (PapaParse) and Excel paths.
 */
function buildMetadata(
  headers: string[],
  records: Record<string, unknown>[],
): { columns: MetadataColumn[]; rows: MetadataRow[] } {
  if (headers.length === 0) return { columns: [], rows: [] };

  const columns: MetadataColumn[] = headers.map((name, i) => ({
    id: `col_${i}`,
    name: name.trim(),
    type: "string" as const,
  }));

  const headerToColId = new Map(headers.map((h, i) => [h, `col_${i}`]));

  const rows: MetadataRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const vals = Object.values(record);
    if (vals.length === 0 || vals.every((v) => v === "" || v == null)) continue;

    const row: MetadataRow = { _id: `row_${i}_${Date.now()}` };
    for (const [header, colId] of headerToColId) {
      row[colId] = record[header] ?? "";
    }
    rows.push(row);
  }

  for (const col of columns) {
    col.type = inferColumnType(rows, col.id);
  }

  return { columns, rows };
}

function fromPapaParse(parsed: Papa.ParseResult<Record<string, unknown>>): {
  columns: MetadataColumn[];
  rows: MetadataRow[];
} {
  return buildMetadata(parsed.meta.fields ?? [], parsed.data);
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

  return fromPapaParse(parsed);
}

// --- Excel ---

/**
 * Resolve an ExcelJS cell value to a native JS primitive.
 * Preserves numbers and booleans instead of stringifying everything.
 */
function resolveExcelCellValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("richText" in obj && Array.isArray(obj.richText))
      return (obj.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    if ("result" in obj) return resolveExcelCellValue(obj.result);
    if ("text" in obj && typeof obj.text === "string") return obj.text;
  }
  return "";
}

/**
 * Detect whether the first row is a merged title row.
 * Title rows have all cells with the same value, while real headers have distinct names.
 */
function findHeaderRowIndex(rows: unknown[][]): number {
  if (rows.length <= 1) return 0;
  const firstUnique = new Set(rows[0].filter(Boolean));
  const secondUnique = new Set(rows[1].filter(Boolean));
  return firstUnique.size <= 1 && secondUnique.size > firstUnique.size ? 1 : 0;
}

async function parseExcelFile(
  file: File,
): Promise<{ columns: MetadataColumn[]; rows: MetadataRow[] }> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0] as (typeof workbook.worksheets)[0] | undefined;
  if (!sheet) return { columns: [], rows: [] };

  const rawRows: (string | number | boolean)[][] = [];
  sheet.eachRow((row) => {
    const cells: (string | number | boolean)[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(resolveExcelCellValue(cell.value));
    });
    rawRows.push(cells);
  });

  if (rawRows.length === 0) return { columns: [], rows: [] };

  const headerIdx = findHeaderRowIndex(rawRows);
  const maxCols = Math.max(...rawRows.slice(headerIdx).map((r) => r.length));

  const headers = rawRows[headerIdx].map((v) => String(v).trim());
  while (headers.length < maxCols) headers.push(`Column ${headers.length + 1}`);

  const records: Record<string, unknown>[] = rawRows.slice(headerIdx + 1).map((cells) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = i < cells.length ? cells[i] : "";
    }
    return record;
  });

  return buildMetadata(headers, records);
}

// --- File parsing ---

export async function parseFile(
  file: File,
): Promise<{ columns: MetadataColumn[]; rows: MetadataRow[] }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && DELIMITED_EXTENSIONS.has(extension)) {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(fromPapaParse(results)),
        error: (err: Error) => reject(err),
      });
    });
  }

  if (extension && EXCEL_EXTENSIONS.has(extension)) {
    return parseExcelFile(file);
  }

  throw new Error(`Unsupported file type: ${extension}`);
}

// --- Clipboard ---

/** execCommand fallback for environments where the Clipboard API is unavailable. */
function readClipboardFallback(): Promise<string> {
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
      reject(new Error("Clipboard read failed"));
    }
  });
}

async function readClipboardText(): Promise<string> {
  let text: string | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), CLIPBOARD_TIMEOUT_MS);
    });
    text = await Promise.race([navigator.clipboard.readText(), timeoutPromise]);
  } catch {
    text = null;
  } finally {
    clearTimeout(timeoutId);
  }

  text ??= await readClipboardFallback();

  return text;
}

function validateAndParse(text: string): { columns: MetadataColumn[]; rows: MetadataRow[] } {
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

export async function parseClipboard(): Promise<{
  columns: MetadataColumn[];
  rows: MetadataRow[];
}> {
  let text: string;
  try {
    text = await readClipboardText();
  } catch {
    throw new Error(
      "Could not read clipboard. Please try pressing Ctrl+V / Cmd+V to paste directly.",
    );
  }
  return validateAndParse(text);
}

export function parseClipboardText(text: string): {
  columns: MetadataColumn[];
  rows: MetadataRow[];
} {
  return validateAndParse(text);
}
