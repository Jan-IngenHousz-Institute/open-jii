import {
  ExperimentColumnPrimitiveType,
  WellKnownColumnTypes,
} from "../domains/experiment/data/experiment-data.schema";

/**
 * Utility functions for checking column data types.
 * These functions help identify the type of data stored in experiment columns.
 *
 * ## DB type → chart kind mapping
 *
 * Single source of truth for how raw column types collapse into the
 * plotting taxonomy used by chart-type role contracts. The `is*Type`
 * predicates below are implementation details of this table; adding a
 * new column type means adding it here, not editing per-shelf filters.
 *
 * | Chart kind     | Axis / encoding behavior                                  | DB types                                                                                  |
 * | -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
 * | `numeric`      | linear / log axis, continuous color scale                 | TINYINT, SMALLINT, INT, BIGINT, LONG, FLOAT, DOUBLE, REAL, DECIMAL[(p,s)], NUMERIC[(p,s)] |
 * | `temporal`     | date axis, continuous color scale ordered by time         | TIMESTAMP, TIMESTAMP_NTZ, DATE                                                            |
 * | `categorical`  | category axis, one trace per unique value                 | STRING, VARCHAR, CHAR, BOOLEAN, well-known CONTRIBUTOR struct                             |
 * | `complex`      | not plottable as a single value (excluded from pickers)   | ARRAY<...>, MAP<...>, STRUCT<...>, VARIANT                                                |
 *
 * `getColumnKind()` resolves any DB type string to one of these kinds (or
 * `undefined` for unknown types). Chart-type role contracts in
 * `visualization-contracts.ts` declare which kinds each role accepts, and
 * `filterColumnsForRole()` is the one place that consults both.
 */

/**
 * Check if a column type is numeric (integer or floating point)
 */
export function isNumericType(type?: string): boolean {
  if (!type) return false;
  const numericTypes: string[] = [
    ExperimentColumnPrimitiveType.TINYINT,
    ExperimentColumnPrimitiveType.SMALLINT,
    ExperimentColumnPrimitiveType.INT,
    ExperimentColumnPrimitiveType.BIGINT,
    ExperimentColumnPrimitiveType.LONG,
    ExperimentColumnPrimitiveType.FLOAT,
    ExperimentColumnPrimitiveType.DOUBLE,
    ExperimentColumnPrimitiveType.REAL,
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
  return !!type && type === ExperimentColumnPrimitiveType.VARIANT;
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
  return (
    type === ExperimentColumnPrimitiveType.TIMESTAMP ||
    type === ExperimentColumnPrimitiveType.TIMESTAMP_NTZ
  );
}

/**
 * Check if a column type is a string type
 */
export function isStringType(type?: string): boolean {
  if (!type) return false;
  return (
    type === ExperimentColumnPrimitiveType.STRING ||
    type === ExperimentColumnPrimitiveType.VARCHAR ||
    type === ExperimentColumnPrimitiveType.CHAR
  );
}

/**
 * Check if a column type is a decimal type (including precision/scale variants)
 */
export function isDecimalType(type?: string): boolean {
  if (!type) return false;
  return (
    type === ExperimentColumnPrimitiveType.DECIMAL ||
    type.startsWith(ExperimentColumnPrimitiveType.DECIMAL)
  );
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

/** High-level chart-kind taxonomy. See the DB type → kind table at the top of this file. */
export type ColumnKind = "numeric" | "temporal" | "categorical" | "complex";

export function getColumnKind(type?: string): ColumnKind | undefined {
  if (!type) return undefined;
  if (isNumericType(type) || isDecimalType(type)) return "numeric";
  if (isTimestampType(type) || type === ExperimentColumnPrimitiveType.DATE) return "temporal";
  // Well-known sortable structs project as categorical via their sort field
  // (CONTRIBUTOR groups by name). Must short-circuit before the generic
  // complex branch since the underlying type is still STRUCT.
  if (isWellKnownSortableType(type)) return "categorical";
  if (isArrayType(type) || isMapType(type) || isStructType(type) || isVariantType(type)) {
    return "complex";
  }
  if (isStringType(type) || type === ExperimentColumnPrimitiveType.BOOLEAN) return "categorical";
  return undefined;
}

/**
 * Whether a column can be plotted at all. Used as the global filter when
 * surfacing columns in any picker UI; per-role kind constraints (e.g.
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
 * `@repo/api/domains/experiment/experiment-visualization-role-rules` for per-role constraints.
 * Kept as an alias so existing callers continue to work during migration.
 */
export const isValidAxisSource = isPlottableColumn;

/**
 * @deprecated Use `isPlottableColumn` plus `filterColumnsForRole` from
 * `@repo/api/domains/experiment/experiment-visualization-role-rules` for per-role constraints.
 */
export const isValidColorSource = isPlottableColumn;
