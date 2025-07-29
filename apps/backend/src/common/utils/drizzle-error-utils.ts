/**
 * Utility functions for handling Drizzle ORM errors in a type-safe manner
 *
 * This module provides type-safe error handling for Drizzle ORM operations,
 * particularly when dealing with PostgreSQL constraint violations and other
 * database errors that are wrapped in DrizzleQueryError.
 */
import { StatusCodes } from "http-status-codes";

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

/**
 * Base application error type
 */
export class AppError extends Error {
  constructor(
    readonly message: string,
    readonly code: string,
    readonly statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    readonly details?: unknown,
  ) {
    super();
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND", details?: unknown): AppError {
    return new AppError(message, code, StatusCodes.NOT_FOUND, details);
  }

  static badRequest(
    message = "Invalid request data",
    code = "BAD_REQUEST",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.BAD_REQUEST, details);
  }

  static forbidden(message = "Access forbidden", code = "FORBIDDEN", details?: unknown): AppError {
    return new AppError(message, code, StatusCodes.FORBIDDEN, details);
  }

  static unauthorized(
    message = "Unauthorized access",
    code = "UNAUTHORIZED",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.UNAUTHORIZED, details);
  }

  static internal(
    message = "Internal server error",
    code = "INTERNAL_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.INTERNAL_SERVER_ERROR, details);
  }

  static repositoryError(
    message = "Repository operation failed",
    code = "REPOSITORY_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.INTERNAL_SERVER_ERROR, details);
  }

  static validationError(
    message = "Validation error",
    code = "VALIDATION_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.BAD_REQUEST, details);
  }
}

/**
 * Default error mapper for repository operations
 */
export function defaultRepositoryErrorMapper(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const messageLower = message.toLowerCase();

  // Check for common database error patterns
  if (
    messageLower.includes("not found") ||
    messageLower.includes("no rows") ||
    messageLower.includes("does not exist")
  ) {
    return AppError.notFound(message, "REPOSITORY_NOT_FOUND");
  }

  // Use single call to get PostgreSQL error and map using switch statement
  const pgError = getPostgresError(error);
  if (pgError) {
    switch (pgError.code) {
      case PostgresErrorCodes.UNIQUE_VIOLATION:
        return AppError.badRequest(message, "REPOSITORY_DUPLICATE");
      case PostgresErrorCodes.FOREIGN_KEY_VIOLATION:
        return AppError.badRequest(message, "REPOSITORY_REFERENCE");
      case PostgresErrorCodes.NOT_NULL_VIOLATION:
        return AppError.badRequest(message, "REPOSITORY_NOT_NULL");
      case PostgresErrorCodes.INVALID_TEXT_REPRESENTATION:
        return AppError.badRequest(message, "REPOSITORY_INVALID_TYPE");
      case PostgresErrorCodes.STRING_DATA_TOO_LONG:
        return AppError.badRequest(message, "REPOSITORY_DATA_TOO_LONG");
      case PostgresErrorCodes.CHECK_VIOLATION:
        return AppError.badRequest(message, "REPOSITORY_CHECK_CONSTRAINT");
      case PostgresErrorCodes.UNDEFINED_TABLE:
        return AppError.internal(message, "REPOSITORY_UNDEFINED_TABLE");
      case PostgresErrorCodes.UNDEFINED_COLUMN:
        return AppError.internal(message, "REPOSITORY_UNDEFINED_COLUMN");
      case PostgresErrorCodes.NUMERIC_VALUE_OUT_OF_RANGE:
        return AppError.badRequest(message, "REPOSITORY_NUMERIC_OUT_OF_RANGE");
      case PostgresErrorCodes.UNDEFINED_FUNCTION:
        return AppError.internal(message, "REPOSITORY_UNDEFINED_FUNCTION");
      case PostgresErrorCodes.INSUFFICIENT_PRIVILEGE:
        return AppError.forbidden(message, "REPOSITORY_INSUFFICIENT_PRIVILEGE");
    }
  }

  // Fallback to message-based detection for cases where Drizzle error detection fails
  if (
    messageLower.includes("duplicate") ||
    messageLower.includes("unique constraint") ||
    messageLower.includes("already exists")
  ) {
    return AppError.badRequest(message, "REPOSITORY_DUPLICATE");
  }

  if (messageLower.includes("foreign key") || messageLower.includes("reference")) {
    return AppError.badRequest(message, "REPOSITORY_REFERENCE");
  }

  return AppError.repositoryError(message);
}
