import { DrizzleQueryError } from "@repo/database";

import {
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
  });
});
