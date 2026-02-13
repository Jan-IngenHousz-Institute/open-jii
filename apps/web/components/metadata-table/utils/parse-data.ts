import type { MetadataColumn, MetadataRow } from "../types";

type Delimiter = "," | "\t" | ";" | "|";

/**
 * Detect the most likely delimiter in a text by analyzing the first row.
 * Tries common delimiters and picks the one that produces the most columns.
 * Falls back to comma if no clear winner.
 */
function detectDelimiter(text: string): Delimiter {
  const firstLine = text.trim().split(/\r?\n/)[0];
  if (!firstLine) return ",";

  const delimiters: Delimiter[] = [",", ";", "\t", "|"];

  // Count columns each delimiter would produce on the first row
  const results = delimiters.map((d) => {
    const columns = parseRowForDetection(firstLine, d);
    return { delimiter: d, columnCount: columns.length };
  });

  // Pick delimiter that produces the most columns (minimum 2 to be valid)
  const best = results
    .filter((r) => r.columnCount >= 2)
    .sort((a, b) => b.columnCount - a.columnCount)[0];

  return best?.delimiter ?? ",";
}

/**
 * Simple row parser for delimiter detection (handles quoted values)
 */
function parseRowForDetection(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}



/**
 * Parse CSV/TSV text into columns and rows
 */
export function parseDelimitedText(
  text: string,
  delimiter?: Delimiter
): { columns: MetadataColumn[]; rows: MetadataRow[] } {
  const effectiveDelimiter = delimiter ?? detectDelimiter(text);
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  // Parse header row
  const headers = parseRow(lines[0], effectiveDelimiter);
  const columns: MetadataColumn[] = headers.map((header, index) => ({
    id: `col_${index}`,
    name: header.trim(),
    type: "string",
  }));

  // Parse data rows
  const rows: MetadataRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i], effectiveDelimiter);
    if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

    const row: MetadataRow = { _id: `row_${i - 1}_${Date.now()}` };
    columns.forEach((col, colIndex) => {
      row[col.id] = values[colIndex] ?? "";
    });
    rows.push(row);
  }

  // Infer column types from data
  columns.forEach((col) => {
    col.type = inferColumnType(rows, col.id);
  });

  return { columns, rows };
}

/**
 * Parse a single row, handling quoted values
 */
function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

/**
 * Infer column type from values
 */
function inferColumnType(
  rows: MetadataRow[],
  columnId: string
): "string" | "number" | "date" {
  const values = rows
    .map((row) => row[columnId])
    .filter((v) => v !== null && v !== undefined && v !== "");

  if (values.length === 0) return "string";

  // Check if all values are numbers
  const allNumbers = values.every((v) => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
  if (allNumbers) return "number";

  // Check if all values are dates (ISO format or common formats)
  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}[/-]\d{2}[/-]\d{4}/;
  const allDates = values.every((v) => {
    if (typeof v !== "string") return false;
    return datePattern.test(v) && !isNaN(Date.parse(v));
  });
  if (allDates) return "date";

  return "string";
}

/**
 * Read and parse a File (CSV or Excel)
 */
export async function parseFile(
  file: File
): Promise<{ columns: MetadataColumn[]; rows: MetadataRow[] }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "tsv" || extension === "txt") {
    const text = await file.text();
    // Auto-detect delimiter for all text-based files
    return parseDelimitedText(text);
  }

  if (extension === "xlsx" || extension === "xls") {
    // Dynamic import for xlsx library
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { columns: [], rows: [] };
    }
    const firstSheet = workbook.Sheets[sheetName];
    if (!firstSheet) {
      return { columns: [], rows: [] };
    }
    const data = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
    }) as unknown[][];

    if (data.length === 0) {
      return { columns: [], rows: [] };
    }

    const headers = (data[0] as string[]).map((h) => String(h ?? ""));
    const columns: MetadataColumn[] = headers.map((header, index) => ({
      id: `col_${index}`,
      name: header.trim(),
      type: "string",
    }));

    const rows: MetadataRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const rowData = data[i] as unknown[];
      if (!rowData || rowData.length === 0) continue;

      const row: MetadataRow = { _id: `row_${i - 1}_${Date.now()}` };
      columns.forEach((col, colIndex) => {
        row[col.id] = rowData[colIndex] ?? "";
      });
      rows.push(row);
    }

    columns.forEach((col) => {
      col.type = inferColumnType(rows, col.id);
    });

    return { columns, rows };
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

  // Try clipboard API first
  if (navigator.clipboard?.readText) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 3000);
      });
      
      text = await Promise.race([
        navigator.clipboard.readText(),
        timeoutPromise
      ]);
    } catch {
      // Clipboard API failed, will try fallback
      text = null;
    }
  }

  // Fallback to execCommand
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
