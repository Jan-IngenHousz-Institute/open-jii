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
