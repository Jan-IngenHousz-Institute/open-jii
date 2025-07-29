/**
 * Utility functions for handling Drizzle ORM errors in a type-safe manner
 *
 * This module provides type-safe error handling for Drizzle ORM operations,
 * particularly when dealing with PostgreSQL constraint violations and other
 * database errors that are wrapped in DrizzleQueryError.
 */
import { DrizzleQueryError } from "@repo/database";

/**
 * Type guard to check if an error is a PostgreSQL error with code and message
 */
export const isPostgresError = (
  cause: unknown,
): cause is { code: string; message: string; detail?: string; hint?: string } => {
  return (
    cause !== null &&
    typeof cause === "object" &&
    "code" in cause &&
    "message" in cause &&
    typeof (cause as { code: unknown }).code === "string" &&
    typeof (cause as { message: unknown }).message === "string"
  );
};

/**
 * Type guard to check if an error is a DrizzleQueryError
 */
export const isDrizzleQueryError = (error: unknown): error is DrizzleQueryError => {
  return error instanceof DrizzleQueryError;
};

/**
 * Extracts PostgreSQL error information from a Drizzle error
 */
export const getPostgresError = (
  error: unknown,
): { code: string; message: string; detail?: string; hint?: string } | null => {
  if (!isDrizzleQueryError(error)) {
    return null;
  }

  const cause = error.cause;
  if (!isPostgresError(cause)) {
    return null;
  }

  return {
    code: cause.code,
    message: cause.message,
    detail: cause.detail,
    hint: cause.hint,
  };
};

/**
 * Common PostgreSQL error codes for easy reference
 */
export const PostgresErrorCodes = {
  // Constraint violations
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
  CHECK_VIOLATION: "23514",

  // Data type errors
  INVALID_TEXT_REPRESENTATION: "22P02", // Type mismatch (e.g., number into string)
  STRING_DATA_TOO_LONG: "22001",
  NUMERIC_VALUE_OUT_OF_RANGE: "22003",

  // Schema errors
  UNDEFINED_TABLE: "42P01",
  UNDEFINED_COLUMN: "42703",
  UNDEFINED_FUNCTION: "42883",

  // Permission errors
  INSUFFICIENT_PRIVILEGE: "42501",
} as const;

/**
 * Convenience functions for checking specific error types
 */
export const isUniqueConstraintError = (error: unknown): boolean => {
  const pgError = getPostgresError(error);
  return pgError?.code === PostgresErrorCodes.UNIQUE_VIOLATION;
};

export const isForeignKeyConstraintError = (error: unknown): boolean => {
  const pgError = getPostgresError(error);
  return pgError?.code === PostgresErrorCodes.FOREIGN_KEY_VIOLATION;
};

export const isNotNullConstraintError = (error: unknown): boolean => {
  const pgError = getPostgresError(error);
  return pgError?.code === PostgresErrorCodes.NOT_NULL_VIOLATION;
};

export const isTypeConversionError = (error: unknown): boolean => {
  const pgError = getPostgresError(error);
  return pgError?.code === PostgresErrorCodes.INVALID_TEXT_REPRESENTATION;
};

export const isDataTooLongError = (error: unknown): boolean => {
  const pgError = getPostgresError(error);
  return pgError?.code === PostgresErrorCodes.STRING_DATA_TOO_LONG;
};
