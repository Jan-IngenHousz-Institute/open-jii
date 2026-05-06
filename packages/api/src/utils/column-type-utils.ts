import { ColumnPrimitiveType, WellKnownColumnTypes } from "../schemas/experiment.schema";

/**
 * Utility functions for checking column data types.
 * These functions help identify the type of data stored in experiment columns.
 */

/**
 * Check if a column type is numeric (integer or floating point)
 */
export function isNumericType(type?: string): boolean {
  if (!type) return false;
  const numericTypes: string[] = [
    ColumnPrimitiveType.TINYINT,
    ColumnPrimitiveType.SMALLINT,
    ColumnPrimitiveType.INT,
    ColumnPrimitiveType.BIGINT,
    ColumnPrimitiveType.LONG,
    ColumnPrimitiveType.FLOAT,
    ColumnPrimitiveType.DOUBLE,
    ColumnPrimitiveType.REAL,
  ];
  return numericTypes.includes(type) || type.startsWith("DECIMAL") || type.startsWith("NUMERIC");
}

/**
 * Check if a column type is an array (e.g., ARRAY<INT>)
 */
export function isArrayType(type?: string): boolean {
  return !!type && type.startsWith("ARRAY");
}

/**
 * Check if a column type is a map (e.g., MAP<STRING, INT>)
 */
export function isMapType(type?: string): boolean {
  return !!type && type.startsWith("MAP");
}

/**
 * Check if a column type is a struct (e.g., STRUCT<field1: STRING, field2: INT>)
 */
export function isStructType(type?: string): boolean {
  return !!type && type.startsWith("STRUCT");
}

/**
 * Check if a column type is a variant (JSON-like semi-structured data)
 */
export function isVariantType(type?: string): boolean {
  return !!type && type === ColumnPrimitiveType.VARIANT;
}

/**
 * Check if a column type is an array of structs (e.g., ARRAY<STRUCT<...>>)
 */
export function isStructArrayType(type?: string): boolean {
  return !!type && type.startsWith("ARRAY") && type.includes("STRUCT");
}

/**
 * Check if a column type is an array of numeric values
 */
export function isNumericArrayType(type?: string): boolean {
  if (!type || !isArrayType(type)) return false;
  const numericArrays = [
    "ARRAY",
    "ARRAY<TINYINT>",
    "ARRAY<SMALLINT>",
    "ARRAY<INT>",
    "ARRAY<BIGINT>",
    "ARRAY<FLOAT>",
    "ARRAY<DOUBLE>",
    "ARRAY<DECIMAL>",
  ];
  return (
    numericArrays.includes(type) ||
    (type.includes("ARRAY") &&
      (type.includes("DOUBLE") ||
        type.includes("REAL") ||
        type.includes("FLOAT") ||
        type.includes("NUMERIC")))
  );
}

/**
 * Check if a column type can be sorted
 * Complex types (arrays, maps, structs, variants) cannot be sorted
 */
export function isSortableType(type?: string): boolean {
  if (!type) return false;
  // Complex types cannot be sorted
  if (isArrayType(type) || isMapType(type) || isStructType(type) || isVariantType(type))
    return false;
  // All primitive types can be sorted
  return true;
}

/**
 * Check if a column type is a timestamp
 */
export function isTimestampType(type?: string): boolean {
  if (!type) return false;
  return type === ColumnPrimitiveType.TIMESTAMP || type === ColumnPrimitiveType.TIMESTAMP_NTZ;
}

/**
 * Check if a column type is a string type
 */
export function isStringType(type?: string): boolean {
  if (!type) return false;
  return (
    type === ColumnPrimitiveType.STRING ||
    type === ColumnPrimitiveType.VARCHAR ||
    type === ColumnPrimitiveType.CHAR
  );
}

/**
 * Check if a column type is a decimal type (including precision/scale variants)
 */
export function isDecimalType(type?: string): boolean {
  if (!type) return false;
  return type === ColumnPrimitiveType.DECIMAL || type.startsWith(ColumnPrimitiveType.DECIMAL);
}

/**
 * Check if a column type is a well-known type (CONTRIBUTOR, ANNOTATIONS, QUESTIONS)
 */
export function isWellKnownType(type?: string): boolean {
  if (!type) return false;
  return (Object.values(WellKnownColumnTypes) as string[]).includes(type);
}

/**
 * Check if a well-known type is sortable
 * Only CONTRIBUTOR type is sortable (ANNOTATIONS and QUESTIONS are arrays)
 */
export function isWellKnownSortableType(type?: string): boolean {
  if (!type) return false;
  return type === WellKnownColumnTypes.CONTRIBUTOR;
}

/**
 * Get the sort field for a well-known sortable type
 * Returns the field path to use for sorting (e.g., "name" for CONTRIBUTOR)
 * Returns undefined if the type is not a well-known sortable type
 */
export function getWellKnownSortField(type?: string): string | undefined {
  if (!type) return undefined;

  switch (type) {
    case WellKnownColumnTypes.CONTRIBUTOR:
      return "name";
    default:
      return undefined;
  }
}

/**
 * High-level taxonomy of column data for plotting purposes. Every plottable
 * column maps to exactly one kind, and chart-type role contracts declare
 * which kinds each role accepts. This is the single seam between database
 * column types and chart eligibility — adding a new column type means
 * mapping it to a kind here, not editing per-shelf filter functions.
 *
 * - `numeric`: integers/floats/decimals — placed on a linear/log axis or a
 *   continuous color scale.
 * - `temporal`: timestamps and dates — date axis or continuous color scale
 *   ordered by time.
 * - `categorical`: strings and booleans — category axis or one bucket per
 *   unique value when used as a color/group dimension.
 * - `complex`: arrays, structs, maps, variants — not plottable as a single
 *   value; excluded from picker UIs.
 */
export type ColumnKind = "numeric" | "temporal" | "categorical" | "complex";

export function getColumnKind(type?: string): ColumnKind | undefined {
  if (!type) return undefined;
  if (isNumericType(type) || isDecimalType(type)) return "numeric";
  if (isTimestampType(type) || type === ColumnPrimitiveType.DATE) return "temporal";
  if (isArrayType(type) || isMapType(type) || isStructType(type) || isVariantType(type)) {
    return "complex";
  }
  if (isStringType(type) || type === ColumnPrimitiveType.BOOLEAN) return "categorical";
  return undefined;
}

/**
 * Whether a column can be plotted at all. Used as the global filter when
 * surfacing columns in any picker UI — per-role kind constraints (e.g.
 * "Y must be numeric") are then applied on top via
 * `filterColumnsForRole` from the visualization contracts.
 */
export function isPlottableColumn(type?: string): boolean {
  const kind = getColumnKind(type);
  return kind === "numeric" || kind === "temporal" || kind === "categorical";
}

/**
 * Decide whether a column should be treated as categorical for color
 * encoding by default. Categorical-kind columns become per-bucket traces;
 * numeric and temporal types default to continuous (the user can override).
 */
export function isCategoricalColumnType(type?: string): boolean {
  return getColumnKind(type) === "categorical";
}

/**
 * @deprecated Use `isPlottableColumn` plus `filterColumnsForRole` from
 * `@repo/api/utils/visualization-contracts` for per-role constraints.
 * Kept as an alias so existing callers continue to work during migration.
 */
export const isValidAxisSource = isPlottableColumn;

/**
 * @deprecated Use `isPlottableColumn` plus `filterColumnsForRole` from
 * `@repo/api/utils/visualization-contracts` for per-role constraints.
 */
export const isValidColorSource = isPlottableColumn;
