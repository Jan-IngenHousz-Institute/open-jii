import { StatusCodes } from "http-status-codes";

import { DrizzleQueryError } from "@repo/database";

import {
  AppError,
  defaultRepositoryErrorMapper,
  isPostgresError,
  isDrizzleQueryError,
  getPostgresError,
  PostgresErrorCodes,
  isUniqueConstraintError,
  isForeignKeyConstraintError,
  isNotNullConstraintError,
  isTypeConversionError,
  isDataTooLongError,
} from "./drizzle-error-utils";

describe("drizzle-error-utils", () => {
  describe("isPostgresError", () => {
    it("should return true for valid PostgreSQL error object", () => {
      const pgError = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        detail: "Key (email)=(test@example.com) already exists.",
      };

      expect(isPostgresError(pgError)).toBe(true);
    });

    it("should return true for minimal PostgreSQL error object", () => {
      const pgError = {
        code: "23503",
        message: "foreign key constraint violation",
      };

      expect(isPostgresError(pgError)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isPostgresError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPostgresError(undefined)).toBe(false);
    });

    it("should return false for object without code", () => {
      const error = { message: "some error" };
      expect(isPostgresError(error)).toBe(false);
    });

    it("should return false for object without message", () => {
      const error = { code: "23505" };
      expect(isPostgresError(error)).toBe(false);
    });

    it("should return false for object with non-string code", () => {
      const error = { code: 23505, message: "error" };
      expect(isPostgresError(error)).toBe(false);
    });

    it("should return false for object with non-string message", () => {
      const error = { code: "23505", message: 123 };
      expect(isPostgresError(error)).toBe(false);
    });

    it("should return false for string", () => {
      expect(isPostgresError("error string")).toBe(false);
    });
  });

  describe("isDrizzleQueryError", () => {
    it("should return true for DrizzleQueryError", () => {
      const pgCause = new Error("duplicate key");
      // @ts-expect-error - Adding code property for testing
      pgCause.code = "23505";
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgCause);

      expect(isDrizzleQueryError(error)).toBe(true);
      expect(error.cause).toBeDefined();
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isDrizzleQueryError(error)).toBe(false);
    });

    it("should return false for string", () => {
      expect(isDrizzleQueryError("error string")).toBe(false);
    });
  });

  describe("getPostgresError", () => {
    it("should extract PostgreSQL error from DrizzleQueryError", () => {
      const pgError = new Error("duplicate key value violates unique constraint");
      // @ts-expect-error - Adding PostgreSQL properties for testing
      pgError.code = "23505";
      pgError.detail = "Key (email)=(test@example.com) already exists.";
      const drizzleError = new DrizzleQueryError("INSERT INTO users ...", [], pgError);

      const result = getPostgresError(drizzleError);

      expect(result).toEqual({
        code: "23505",
        message: "duplicate key value violates unique constraint",
        detail: "Key (email)=(test@example.com) already exists.",
        hint: undefined,
      });
    });

    it("should return null for regular Error", () => {
      const regularError = new Error("Regular error");

      expect(getPostgresError(regularError)).toBeNull();
    });

    it("should return null for string", () => {
      expect(getPostgresError("error")).toBeNull();
    });
  });

  describe("PostgresErrorCodes", () => {
    it("should have correct error codes", () => {
      expect(PostgresErrorCodes.UNIQUE_VIOLATION).toBe("23505");
      expect(PostgresErrorCodes.FOREIGN_KEY_VIOLATION).toBe("23503");
      expect(PostgresErrorCodes.NOT_NULL_VIOLATION).toBe("23502");
      expect(PostgresErrorCodes.CHECK_VIOLATION).toBe("23514");
      expect(PostgresErrorCodes.INVALID_TEXT_REPRESENTATION).toBe("22P02");
      expect(PostgresErrorCodes.STRING_DATA_TOO_LONG).toBe("22001");
      expect(PostgresErrorCodes.NUMERIC_VALUE_OUT_OF_RANGE).toBe("22003");
      expect(PostgresErrorCodes.UNDEFINED_TABLE).toBe("42P01");
      expect(PostgresErrorCodes.UNDEFINED_COLUMN).toBe("42703");
      expect(PostgresErrorCodes.UNDEFINED_FUNCTION).toBe("42883");
      expect(PostgresErrorCodes.INSUFFICIENT_PRIVILEGE).toBe("42501");
    });
  });

  describe("isUniqueConstraintError", () => {
    it("should return true for Drizzle error with unique constraint violation", () => {
      const pgError = new Error("Test error");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.UNIQUE_VIOLATION;
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      expect(isUniqueConstraintError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isUniqueConstraintError(error)).toBe(false);
    });
  });

  describe("isForeignKeyConstraintError", () => {
    it("should return true for Drizzle error with foreign key violation", () => {
      const pgError = new Error("Test error");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.FOREIGN_KEY_VIOLATION;
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      expect(isForeignKeyConstraintError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isForeignKeyConstraintError(error)).toBe(false);
    });
  });

  describe("isNotNullConstraintError", () => {
    it("should return true for Drizzle error with not null violation", () => {
      const pgError = new Error("Test error");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.NOT_NULL_VIOLATION;
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      expect(isNotNullConstraintError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isNotNullConstraintError(error)).toBe(false);
    });
  });

  describe("isTypeConversionError", () => {
    it("should return true for Drizzle error with type conversion error", () => {
      const pgError = new Error("Test error");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.INVALID_TEXT_REPRESENTATION;
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      expect(isTypeConversionError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isTypeConversionError(error)).toBe(false);
    });
  });

  describe("isDataTooLongError", () => {
    it("should return true for Drizzle error with data too long error", () => {
      const pgError = new Error("Test error");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.STRING_DATA_TOO_LONG;
      const error = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      expect(isDataTooLongError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isDataTooLongError(error)).toBe(false);
    });
  });

  describe("AppError", () => {
    it("should create AppError with correct properties", () => {
      const error = new AppError("message", "CODE", 400, { detail: "test" });
      expect(error.message).toBe("message");
      expect(error.code).toBe("CODE");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: "test" });
    });

    it("should create notFound error with correct defaults", () => {
      const error = AppError.notFound();
      expect(error.message).toBe("Resource not found");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it("should create badRequest error with correct defaults", () => {
      const error = AppError.badRequest();
      expect(error.message).toBe("Invalid request data");
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("should create forbidden error with correct defaults", () => {
      const error = AppError.forbidden();
      expect(error.message).toBe("Access forbidden");
      expect(error.code).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it("should create unauthorized error with correct defaults", () => {
      const error = AppError.unauthorized();
      expect(error.message).toBe("Unauthorized access");
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it("should create internal error with correct defaults", () => {
      const error = AppError.internal();
      expect(error.message).toBe("Internal server error");
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should create repositoryError with correct defaults", () => {
      const error = AppError.repositoryError();
      expect(error.message).toBe("Repository operation failed");
      expect(error.code).toBe("REPOSITORY_ERROR");
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should create validationError with correct defaults", () => {
      const error = AppError.validationError();
      expect(error.message).toBe("Validation error");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe("defaultRepositoryErrorMapper", () => {
    it("should return the AppError if one is passed", () => {
      const originalError = AppError.badRequest("Bad request");
      const mappedError = defaultRepositoryErrorMapper(originalError);

      expect(mappedError).toBe(originalError);
    });

    it('should map "not found" errors correctly', () => {
      const error = new Error("Entity not found");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(mappedError.code).toBe("REPOSITORY_NOT_FOUND");
    });

    it('should map "no rows" errors correctly', () => {
      const error = new Error("No rows returned");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(mappedError.code).toBe("REPOSITORY_NOT_FOUND");
    });

    it('should map "does not exist" errors correctly', () => {
      const error = new Error("Record does not exist");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(mappedError.code).toBe("REPOSITORY_NOT_FOUND");
    });

    it("should map Drizzle unique constraint errors correctly", () => {
      const pgError = new Error("duplicate key value violates unique constraint");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.UNIQUE_VIOLATION;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it("should map Drizzle foreign key constraint errors correctly", () => {
      const pgError = new Error("foreign key constraint violation");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.FOREIGN_KEY_VIOLATION;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_REFERENCE");
    });

    it("should map Drizzle not null constraint errors correctly", () => {
      const pgError = new Error("null value violates not-null constraint");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.NOT_NULL_VIOLATION;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_NOT_NULL");
    });

    it("should map Drizzle type conversion errors correctly", () => {
      const pgError = new Error("invalid text representation");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.INVALID_TEXT_REPRESENTATION;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_INVALID_TYPE");
    });

    it("should map Drizzle data too long errors correctly", () => {
      const pgError = new Error("value too long for type");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.STRING_DATA_TOO_LONG;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DATA_TOO_LONG");
    });

    it("should map other PostgreSQL errors using switch statement", () => {
      const pgError = new Error("check constraint violation");
      // @ts-expect-error - Adding code property for testing
      pgError.code = PostgresErrorCodes.CHECK_VIOLATION;
      const drizzleError = new DrizzleQueryError("INSERT INTO test ...", [], pgError);

      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_CHECK_CONSTRAINT");
    });

    it('should map "duplicate" message-based errors correctly as fallback', () => {
      const error = new Error("Duplicate entry");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "unique constraint" message-based errors correctly as fallback', () => {
      const error = new Error("unique constraint violation");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "already exists" message-based errors correctly as fallback', () => {
      const error = new Error("user already exists");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "foreign key" message-based errors correctly as fallback', () => {
      const error = new Error("foreign key constraint failed");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_REFERENCE");
    });

    it('should map "reference" message-based errors correctly as fallback', () => {
      const error = new Error("reference integrity constraint violation");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_REFERENCE");
    });

    it("should map unknown errors to repository errors", () => {
      const error = new Error("Unknown error");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(mappedError.code).toBe("REPOSITORY_ERROR");
    });

    it("should handle non-Error objects", () => {
      const error = "String error";
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.message).toBe("String error");
      expect(mappedError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(mappedError.code).toBe("REPOSITORY_ERROR");
    });
  });

  describe("Integration tests", () => {
    it("should demonstrate the DrizzleQueryError structure and utility functions", () => {
      const pgErrorCause = new Error("duplicate key value violates unique constraint");
      // @ts-expect-error - Adding PostgreSQL properties for testing
      pgErrorCause.code = "23505";
      pgErrorCause.detail = "Key (email)=(test@example.com) already exists.";
      const drizzleError = new DrizzleQueryError(
        'INSERT INTO "users" ("email", "name") VALUES ($1, $2)',
        ["test@example.com", "Test User"],
        pgErrorCause,
      );

      // Test that the utility functions work correctly
      expect(isUniqueConstraintError(drizzleError)).toBe(true);
      expect(getPostgresError(drizzleError)).toEqual({
        code: "23505",
        message: "duplicate key value violates unique constraint",
        detail: "Key (email)=(test@example.com) already exists.",
        hint: undefined,
      });

      // Verify the error structure
      expect(drizzleError.cause).toEqual(pgErrorCause);
    });

    it("should validate PostgreSQL error structure independently", () => {
      const pgError = {
        code: "23503",
        message: "insert or update on table violates foreign key constraint",
        detail: 'Key (user_id)=(999) is not present in table "users".',
      };

      expect(isPostgresError(pgError)).toBe(true);
    });

    it("should demonstrate end-to-end error mapping flow", () => {
      const pgErrorCause = new Error("duplicate key value violates unique constraint");
      // @ts-expect-error - Adding PostgreSQL properties for testing
      pgErrorCause.code = PostgresErrorCodes.UNIQUE_VIOLATION;
      pgErrorCause.detail = "Key (email)=(test@example.com) already exists.";
      const drizzleError = new DrizzleQueryError(
        'INSERT INTO "users" ("email", "name") VALUES ($1, $2)',
        ["test@example.com", "Test User"],
        pgErrorCause,
      );

      // Test the full error mapping flow
      const mappedError = defaultRepositoryErrorMapper(drizzleError);

      expect(mappedError).toBeInstanceOf(AppError);
      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
      expect(mappedError.message).toBe(
        'Failed query: INSERT INTO "users" ("email", "name") VALUES ($1, $2)\nparams: test@example.com,Test User',
      );
    });
  });
});
