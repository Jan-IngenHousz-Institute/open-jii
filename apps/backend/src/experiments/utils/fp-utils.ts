import { Logger } from "@nestjs/common";
import { StatusCodes } from "http-status-codes";
import { z } from "@repo/validator";

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
export function assertFailure<T, E>(
  result: Result<T, E>,
): asserts result is Failure<E> {
  if (!isFailure(result)) {
    throw new Error(
      `Expected result to be a failure, but got success with value: ${JSON.stringify(
        result._tag === "success" ? result.value : null,
      )}`,
    );
  }
}

/**
 * Assertion function to use in tests - throws if the result is not a Success
 * This allows direct access to value property in tests without type issues
 */
export function assertSuccess<T, E>(
  result: Result<T, E>,
): asserts result is Success<T> {
  if (!isSuccess(result)) {
    throw new Error(
      `Expected result to be a success, but got failure with error: ${JSON.stringify(
        result._tag === "failure" ? result.error : null,
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

  isFailure(): boolean {
    return false;
  }

  // Map and chain for monadic operations
  map<U>(fn: (value: T) => U): Result<U> {
    return success(fn(this.value));
  }

  chain<U>(
    fn: (value: T) => Result<U> | Promise<Result<U>>,
  ): Result<U> | Promise<Result<U>> {
    return fn(this.value);
  }

  // Fold to handle both success and failure cases
  fold<U>(onSuccess: (value: T) => U, _: (error: never) => U): U {
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

  isSuccess(): boolean {
    return false;
  }

  isFailure(): this is Failure<E> {
    return true;
  }

  // Map and chain for monadic operations
  map<U>(_: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  chain<U>(
    _: (value: never) => Result<U> | Promise<Result<U>>,
  ): Result<U, E> | Promise<Result<U, E>> {
    return this as unknown as Result<U, E>;
  }

  // Fold to handle both success and failure cases
  fold<U>(_: (value: never) => U, onFailure: (error: E) => U): U {
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
export const success = <T extends unknown>(value: T): Result<T> =>
  new Success(value);

export const failure = <E extends AppError>(error: E): Result<never, E> =>
  new Failure(error);

/**
 * Base application error type
 */
export class AppError {
  constructor(
    readonly message: string,
    readonly code: string,
    readonly statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    readonly details?: unknown,
  ) {}

  static notFound(
    message: string = "Resource not found",
    code: string = "NOT_FOUND",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.NOT_FOUND, details);
  }

  static badRequest(
    message: string = "Invalid request data",
    code: string = "BAD_REQUEST",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.BAD_REQUEST, details);
  }

  static forbidden(
    message: string = "Access forbidden",
    code: string = "FORBIDDEN",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.FORBIDDEN, details);
  }

  static unauthorized(
    message: string = "Unauthorized access",
    code: string = "UNAUTHORIZED",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.UNAUTHORIZED, details);
  }

  static internal(
    message: string = "Internal server error",
    code: string = "INTERNAL_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(
      message,
      code,
      StatusCodes.INTERNAL_SERVER_ERROR,
      details,
    );
  }

  static repositoryError(
    message: string = "Repository operation failed",
    code: string = "REPOSITORY_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(
      message,
      code,
      StatusCodes.INTERNAL_SERVER_ERROR,
      details,
    );
  }

  static validationError(
    message: string = "Validation error",
    code: string = "VALIDATION_ERROR",
    details?: unknown,
  ): AppError {
    return new AppError(message, code, StatusCodes.BAD_REQUEST, details);
  }
}

/**
 * Response type for API handlers
 */
export type ApiResponse<T = Record<string, unknown>> = 
  | { status: StatusCodes.OK; body: T }
  | { status: StatusCodes; body: { message: string; code: string; details?: unknown } };

/**
 * Utility for handling a Result in a controller context
 * @param result The Result object to handle
 * @param logger Logger to use for logging errors
 */
export function handleResult<T extends unknown>(result: Result<T>, logger: Logger) {
  return result.fold(
    // Success case
    (value) => ({
      status: StatusCodes.OK as const,
      body: value,
    }),
    // Failure case
    (error) => {
      // Log the error
      if (error.statusCode >= 500) {
        logger.error(`${error.code}: ${error.message}`, error.details);
      } else {
        logger.warn(`${error.code}: ${error.message}`, error.details);
      }

      return {
        status: error.statusCode,
        body: {
          message: error.message,
          code: error.code,
          ...(process.env.NODE_ENV !== "production" && error.details
            ? { details: error.details }
            : {}),
        },
      };
    },
  );
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
 * Utility for validating with Zod schema and returning Result
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): Result<T> {
  try {
    const parsed = schema.parse(data);
    return success(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(
        AppError.validationError(
          "Validation failed",
          "VALIDATION_ERROR",
          error.format(),
        ),
      );
    }
    return failure(AppError.badRequest("Invalid input"));
  }
}
