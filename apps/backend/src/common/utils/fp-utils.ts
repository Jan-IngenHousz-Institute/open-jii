import type { Logger } from "@nestjs/common";
import { isAxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

/**
 * Result type that represents either a success or failure
 */
export type Result<T, E = AppError> = Success<T> | Failure<E>;

/**
 * Type guard to check if a Result is a Failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result._tag === "failure";
}

/**
 * Type guard to check if a Result is a Success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result._tag === "success";
}

/**
 * Assertion function to use in tests - throws if the result is not a Failure
 * This allows direct access to error properties in tests without type issues
 */
export function assertFailure<T, E>(result: Result<T, E>): asserts result is Failure<E> {
  if (!isFailure(result)) {
    throw new Error(
      `Expected result to be a failure, but got success with value: ${JSON.stringify(
        result.value,
      )}`,
    );
  }
}

/**
 * Assertion function to use in tests - throws if the result is not a Success
 * This allows direct access to value property in tests without type issues
 */
export function assertSuccess<T, E>(result: Result<T, E>): asserts result is Success<T> {
  if (!isSuccess(result)) {
    throw new Error(
      `Expected result to be a success, but got failure with error: ${JSON.stringify(
        result.error,
      )}`,
    );
  }
}

/**
 * Success case of Result
 */
export class Success<T> {
  readonly _tag = "success";
  constructor(readonly value: T) {}

  isSuccess(): this is Success<T> {
    return true;
  }

  isFailure(): this is Failure<never> {
    return false;
  }

  // Map and chain for monadic operations
  map<U>(fn: (value: T) => U): Result<U> {
    return success(fn(this.value));
  }

  chain<U, E = AppError>(
    fn: (value: T) => Result<U, E> | Promise<Result<U, E>>,
  ): Result<U, E> | Promise<Result<U, E>> {
    return fn(this.value);
  }

  // Fold to handle both success and failure cases
  fold<U>(onSuccess: (value: T) => U, _onFailure: (error: never) => U): U {
    return onSuccess(this.value);
  }

  // Unwrap value (use with caution)
  unwrap(): T {
    return this.value;
  }
}

/**
 * Failure case of Result
 */
export class Failure<E> {
  readonly _tag = "failure";
  constructor(readonly error: E) {}

  isSuccess(): this is Success<never> {
    return false;
  }

  isFailure(): this is Failure<E> {
    return true;
  }

  // Map and chain for monadic operations
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  chain<U, F = E>(
    _fn: (value: never) => Result<U, F> | Promise<Result<U, F>>,
  ): Result<U, E> | Promise<Result<U, E>> {
    return this as unknown as Result<U, E>;
  }

  // Fold to handle both success and failure cases
  fold<U>(_onSuccess: (value: never) => U, onFailure: (error: E) => U): U {
    return onFailure(this.error);
  }

  // Unwrap error (use with caution)
  unwrap(): E {
    return this.error;
  }
}

/**
 * Helper functions to create Result instances
 */
export const success = <T, _>(value: T): Result<T> => new Success(value);

export const failure = <E extends AppError>(error: E): Result<never, E> => new Failure(error);

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
 * Utility for handling errors in a controller context
 * @param failure The AppError object to handle
 * @param logger Logger to use for logging errors
 */
export function handleFailure(failure: Failure<AppError>, logger: Logger) {
  const error = failure.error;

  // Log the error
  if (error.statusCode >= 500) {
    logger.error(`${error.code}: ${error.message}`, error.details);
  } else {
    logger.warn(`${error.code}: ${error.message}`, error.details);
  }

  return {
    // Todo: fix type casting
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    status: error.statusCode as any,
    body: {
      message: error.message,
      code: error.code,
      ...(process.env.NODE_ENV !== "production" && error.details ? { details: error.details } : {}),
    },
  };
}

/**
 * Safely executes a repository function and catches any exceptions, converting them to Result
 * Specifically designed for repository operations
 */
export async function tryCatch<T>(
  fn: () => Promise<T> | T,
  errorMapper: (error: unknown) => AppError = defaultRepositoryErrorMapper,
): Promise<Result<T>> {
  try {
    const result = await fn();
    return success(result);
  } catch (error) {
    return failure(errorMapper(error));
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

  // Check for common database error patterns
  if (
    message.toLowerCase().includes("not found") ||
    message.toLowerCase().includes("no rows") ||
    message.toLowerCase().includes("does not exist")
  ) {
    return AppError.notFound(message, "REPOSITORY_NOT_FOUND");
  }

  if (
    message.toLowerCase().includes("duplicate") ||
    message.toLowerCase().includes("unique constraint") ||
    message.toLowerCase().includes("already exists")
  ) {
    return AppError.badRequest(message, "REPOSITORY_DUPLICATE");
  }

  if (
    message.toLowerCase().includes("foreign key") ||
    message.toLowerCase().includes("reference")
  ) {
    return AppError.badRequest(message, "REPOSITORY_REFERENCE");
  }

  return AppError.repositoryError(message);
}

/**
 * Error mapper for API/external service operations
 * @param error The original error
 * @param context A string describing the operation context
 * @returns AppError instance with appropriate status code and message
 */
export function apiErrorMapper(error: unknown, context?: string): AppError {
  // Return as is if it's already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Handle Axios errors - check if the error object has isAxiosError property or response property
  if (typeof error === "object" && error !== null) {
    const err = error;

    if (isAxiosError<{ message?: string; error_description?: string } | undefined>(err)) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message ??
        err.response?.data?.error_description ??
        (err.message || "Unknown API error");

      const displayMessage = context ? `${context}: ${message}` : message;

      // Map common HTTP status codes to appropriate AppError types
      switch (status) {
        case 400:
          return AppError.badRequest(displayMessage);
        case 401:
          return AppError.unauthorized(displayMessage);
        case 403:
          return AppError.forbidden(displayMessage);
        case 404:
          return AppError.notFound(displayMessage);
        case 429:
          return AppError.badRequest(displayMessage, "RATE_LIMIT_EXCEEDED");
        case 500:
        case 502:
        case 503:
        case 504:
          return AppError.internal(displayMessage, "SERVICE_UNAVAILABLE");
        default:
          return AppError.internal(displayMessage);
      }
    }
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : String(error);
  const displayMessage = context ? `${context}: ${message}` : message;

  return AppError.internal(displayMessage);
}

/**
 * Utility for validating with Zod schema and returning Result
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): Result<T> {
  try {
    const parsed = schema.parse(data);
    return success(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(
        AppError.validationError("Validation failed", "VALIDATION_ERROR", error.format()),
      );
    }
    return failure(AppError.badRequest("Invalid input"));
  }
}
