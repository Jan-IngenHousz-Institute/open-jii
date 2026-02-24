import Papa from "papaparse";

import type { MetadataColumn, MetadataRow } from "../types";

/**
 * Infer column type by inspecting the actual JS types of values.
 * PapaParse's dynamicTyping handles number conversion, so we just
 * check typeof. Dates still need a pattern check since PapaParse
 * doesn't auto-detect them.
 */
function inferColumnType(
  rows: MetadataRow[],
  columnId: string
): "string" | "number" | "date" {
  const values = rows
    .map((row) => row[columnId])
    .filter((v) => v !== null && v !== undefined && v !== "");

  if (values.length === 0) return "string";

  if (values.every((v) => typeof v === "number")) return "number";

  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}[/-]\d{2}[/-]\d{4}/;
  if (
    values.every(
      (v) => typeof v === "string" && datePattern.test(v) && !isNaN(Date.parse(v))
    )
  )
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

  const fieldToColId = new Map(
    parsed.meta.fields.map((name, index) => [name, `col_${index}`])
  );

  const rows: MetadataRow[] = [];
  for (let i = 0; i < parsed.data.length; i++) {
    const record = parsed.data[i];
    // Skip rows where every value is empty
    const vals = Object.values(record);
    if (vals.length === 0 || vals.every((v) => v === "" || v === null || v === undefined))
      continue;

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
  delimiter?: "," | "\t" | ";" | "|"
): { columns: MetadataColumn[]; rows: MetadataRow[] } {
  const parsed = Papa.parse<Record<string, unknown>>(text.trim(), {
    delimiter: delimiter || "",
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  return toMetadata(parsed);
}

/**
 * Read and parse a File (CSV or Excel)
 */
export async function parseFile(
  file: File
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
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { columns: [], rows: [] };
    const firstSheet = workbook.Sheets[sheetName];
    if (!firstSheet) return { columns: [], rows: [] };

    // Convert sheet to CSV and let PapaParse handle parsing
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
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

  if (navigator.clipboard?.readText) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 3000);
      });
      text = await Promise.race([navigator.clipboard.readText(), timeoutPromise]);
    } catch {
      text = null;
    }
  }

  if (!text) {
    try {
      text = await readClipboardWithExecCommand();
    } catch {
      throw new Error(
        "Could not read clipboard. Please try pressing Ctrl+V / Cmd+V to paste directly."
      );
    }
  }

  if (!text || text.trim() === "") {
    throw new Error(
      "Clipboard is empty. Please copy some data (CSV, TSV, or tab-separated) and try again."
    );
  }

  const result = parseDelimitedText(text);

  if (result.columns.length === 0) {
    throw new Error(
      "Could not parse clipboard data. Please copy tabular data (CSV, TSV, or tab-separated) with headers."
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
      "Clipboard is empty. Please copy some data (CSV, TSV, or tab-separated) and try again."
    );
  }

  const result = parseDelimitedText(text);

  if (result.columns.length === 0) {
    throw new Error(
      "Could not parse clipboard data. Please copy tabular data (CSV, TSV, or tab-separated) with headers."
    );
  }

  return result;
}
