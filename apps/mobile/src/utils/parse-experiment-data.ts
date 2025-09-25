import { ExperimentDataTable } from "~/hooks/use-experiment-measurements";

export interface ParsedTableData {
  name: string;
  displayName: string;
  columns: {
    name: string;
    displayName: string;
    type: string;
    isArray: boolean;
    isObject: boolean;
  }[];
  rows: Record<string, any>[];
  totalRows: number;
  hasComplexData: boolean;
}

export function parseExperimentData(tables: ExperimentDataTable[]): ParsedTableData[] {
  return tables
    .filter((table) => table.data) // Filter out tables without data
    .map((table) => {
      const columns = table.data!.columns.map((col) => ({
        name: col.name,
        displayName: formatColumnName(col.name),
        type: col.type_name,
        isArray: col.type_name === "ARRAY",
        isObject: col.type_name === "MAP",
      }));

      const hasComplexData = columns.some((col) => col.isArray || col.isObject);

      return {
        name: table.name,
        displayName: formatTableName(table.name),
        columns,
        rows: table.data!.rows,
        totalRows: table.data!.totalRows,
        hasComplexData,
      };
    });
}

function formatTableName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatColumnName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseJsonField(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function formatCellValue(value: any, isArray: boolean, isObject: boolean): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  if (isArray || isObject) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return getArraySummary(parsed);
      }
      if (typeof parsed === "object") {
        return `{${Object.keys(parsed).length}}`;
      }
      return String(parsed);
    } catch {
      return String(value);
    }
  }

  const stringValue = String(value);
  // Truncate long strings to keep table layout clean
  if (stringValue.length > 20) {
    return stringValue.substring(0, 17) + "...";
  }

  return stringValue;
}

export function getArraySummary(array: any[]): string {
  if (array.length === 0) {
    return "Empty";
  }

  const length = array.length;

  // Determine array type
  let type = "mixed";
  if (array.every((item) => typeof item === "string")) {
    type = "str";
  } else if (array.every((item) => typeof item === "number")) {
    type = "num";
  } else if (array.every((item) => typeof item === "boolean")) {
    type = "bool";
  } else if (array.every((item) => typeof item === "object")) {
    type = "obj";
  }

  // Create compact summary
  return `[${length} ${type}]`;
}

export function getTableSummary(table: ParsedTableData): string {
  const { totalRows, columns } = table;
  const columnCount = columns.length;
  const complexColumns = columns.filter((col) => col.isArray || col.isObject).length;

  let summary = `${totalRows} rows, ${columnCount} columns`;
  if (complexColumns > 0) {
    summary += ` (${complexColumns} complex)`;
  }

  return summary;
}
