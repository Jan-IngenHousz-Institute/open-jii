import type { Logger } from "@nestjs/common";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
  AppError,
  Failure,
  Success,
  assertFailure,
  assertSuccess,
  defaultRepositoryErrorMapper,
  failure,
  handleFailure,
  isFailure,
  isSuccess,
  success,
  tryCatch,
  validate,
} from "./fp-utils";

describe("Functional Programming Utilities", () => {
  describe("Result Type", () => {
    describe("Success", () => {
      const successResult = success("test value");

      it("should create a Success instance with correct tag and value", () => {
        expect(successResult).toBeInstanceOf(Success);
        expect(successResult._tag).toBe("success");
        expect((successResult as Success<string>).value).toBe("test value");
      });

      it("should have correct type guards", () => {
        expect(successResult.isSuccess()).toBe(true);
        expect(successResult.isFailure()).toBe(false);
        expect(isSuccess(successResult)).toBe(true);
        expect(isFailure(successResult)).toBe(false);
      });

      it("should map values correctly", () => {
        const mapped = successResult.map((val: string) => val.toUpperCase());
        expect(mapped.isSuccess()).toBe(true);
        expect((mapped as Success<string>).value).toBe("TEST VALUE");
      });

      it("should chain operations correctly", () => {
        const chained = successResult.chain((val: string) =>
          success(val.toUpperCase()),
        );
        expect((chained as Success<string>).isSuccess()).toBe(true);
        expect((chained as Success<string>).value).toBe("TEST VALUE");
      });

      it("should fold with the success function", () => {
        const folded = successResult.fold(
          (val) => `Success: ${val}`,
          (_) => "Failure",
        );
        expect(folded).toBe("Success: test value");
      });

      it("should unwrap its value", () => {
        expect(successResult.unwrap()).toBe("test value");
      });
    });

    describe("Failure", () => {
      const error = new AppError("Test error", "TEST_ERROR");
      const failureResult = failure(error);

      it("should create a Failure instance with correct tag and error", () => {
        expect(failureResult).toBeInstanceOf(Failure);
        expect(failureResult._tag).toBe("failure");
        expect((failureResult as Failure<AppError>).error).toBe(error);
      });

      it("should have correct type guards", () => {
        expect(failureResult.isSuccess()).toBe(false);
        expect(failureResult.isFailure()).toBe(true);
        expect(isSuccess(failureResult)).toBe(false);
        expect(isFailure(failureResult)).toBe(true);
      });

      it("should pass through the error when mapped", () => {
        const mapped = failureResult.map((val) => String(val).toUpperCase());
        expect(mapped.isFailure()).toBe(true);
        expect((mapped as Failure<AppError>).error).toBe(error);
      });

      it("should pass through the error when chained", async () => {
        const chained = await failureResult.chain((val: string) =>
          success(val.toUpperCase()),
        );
        expect(chained.isFailure()).toBe(true);
        expect((chained as Failure<AppError>).error).toBe(error);
      });

      it("should fold with the failure function", () => {
        const folded = failureResult.fold(
          (_) => "Success",
          (err: AppError) => `Failure: ${err.message}`,
        );
        expect(folded).toBe("Failure: Test error");
      });

      it("should unwrap its error", () => {
        expect(failureResult.unwrap()).toBe(error);
      });
    });
  });

  describe("Assertion Helpers", () => {
    describe("assertSuccess", () => {
      it("should not throw for Success results", () => {
        const result = success("test");
        expect(() => assertSuccess(result)).not.toThrow();
      });

      it("should throw for Failure results", () => {
        const result = failure(new AppError("error", "CODE"));
        expect(() => assertSuccess(result)).toThrow();
      });
    });

    describe("assertFailure", () => {
      it("should not throw for Failure results", () => {
        const result = failure(new AppError("error", "CODE"));
        expect(() => assertFailure(result)).not.toThrow();
      });

      it("should throw for Success results", () => {
        const result = success("test");
        expect(() => assertFailure(result)).toThrow();
      });
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

  describe("handleFailure", () => {
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      } as unknown as jest.Mocked<Logger>;
    });

    it("should handle server errors properly", () => {
      const error = AppError.internal("Server error", "SERVER_ERROR", {
        detail: "test",
      });
      const failureResult = failure(error) as Failure<AppError>;
      const handled = handleFailure(failureResult, mockLogger);

      expect(handled).toEqual({
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        body: {
          message: "Server error",
          code: "SERVER_ERROR",
          details: { detail: "test" },
        },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.error).toHaveBeenCalledWith(
        "SERVER_ERROR: Server error",
        { detail: "test" },
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should handle client errors properly", () => {
      const error = AppError.badRequest("Bad request", "BAD_REQUEST", {
        detail: "test",
      });
      const failureResult = failure(error) as Failure<AppError>;
      const handled = handleFailure(failureResult, mockLogger);

      expect(handled).toEqual({
        status: StatusCodes.BAD_REQUEST,
        body: {
          message: "Bad request",
          code: "BAD_REQUEST",
          details: { detail: "test" },
        },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.error).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.warn).toHaveBeenCalledWith("BAD_REQUEST: Bad request", {
        detail: "test",
      });
    });

    it("should exclude details in production", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as { NODE_ENV?: string }).NODE_ENV = "production";

      const error = AppError.badRequest("Bad request", "BAD_REQUEST", {
        detail: "test",
      });
      const failureResult = failure(error) as Failure<AppError>;
      const handled = handleFailure(failureResult, mockLogger);

      expect(handled.body).not.toHaveProperty("details");

      (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    });

    it("should log errors with status code 500 and above using error level", () => {
      const error = new AppError("Critical error", "CRITICAL_ERROR", 503, {
        service: "external",
      });
      const failureResult = failure(error) as Failure<AppError>;
      handleFailure(failureResult, mockLogger);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.error).toHaveBeenCalledWith(
        "CRITICAL_ERROR: Critical error",
        { service: "external" },
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should log errors with status code below 500 using warn level", () => {
      const error = AppError.unauthorized("Access denied", "UNAUTHORIZED", {
        userId: "123",
      });
      const failureResult = failure(error) as Failure<AppError>;
      handleFailure(failureResult, mockLogger);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "UNAUTHORIZED: Access denied",
        { userId: "123" },
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should handle errors without details", () => {
      const error = AppError.notFound("Resource not found", "NOT_FOUND");
      const failureResult = failure(error) as Failure<AppError>;
      const handled = handleFailure(failureResult, mockLogger);

      expect(handled).toEqual({
        status: StatusCodes.NOT_FOUND,
        body: {
          message: "Resource not found",
          code: "NOT_FOUND",
        },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "NOT_FOUND: Resource not found",
        undefined,
      );
    });

    it("should return proper status codes for different error types", () => {
      const testCases = [
        {
          error: AppError.badRequest(),
          expectedStatus: StatusCodes.BAD_REQUEST,
        },
        {
          error: AppError.unauthorized(),
          expectedStatus: StatusCodes.UNAUTHORIZED,
        },
        {
          error: AppError.forbidden(),
          expectedStatus: StatusCodes.FORBIDDEN,
        },
        {
          error: AppError.notFound(),
          expectedStatus: StatusCodes.NOT_FOUND,
        },
        {
          error: AppError.internal(),
          expectedStatus: StatusCodes.INTERNAL_SERVER_ERROR,
        },
      ];

      testCases.forEach(({ error, expectedStatus }) => {
        const failureResult = failure(error) as Failure<AppError>;
        const handled = handleFailure(failureResult, mockLogger);
        expect(handled.status).toBe(expectedStatus);
      });
    });
  });

  describe("tryCatch", () => {
    it("should return success result when function succeeds", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      const result = await tryCatch(fn);

      expect(result.isSuccess()).toBe(true);
      expect((result as Success<string>).value).toBe("success");
    });

    it("should return failure result when function throws", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const result = await tryCatch(fn);

      expect(result.isFailure()).toBe(true);
      expect((result as Failure<AppError>).error).toBeInstanceOf(AppError);
      expect((result as Failure<AppError>).error.message).toBe("Test error");
    });

    it("should use custom error mapper when provided", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const customMapper = jest
        .fn()
        .mockReturnValue(AppError.badRequest("Custom error"));

      const result = await tryCatch(fn, customMapper);

      expect(result.isFailure()).toBe(true);
      expect(customMapper).toHaveBeenCalledWith(error);
      expect((result as Failure<AppError>).error.message).toBe("Custom error");
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

    it('should map "duplicate" errors correctly', () => {
      const error = new Error("Duplicate entry");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "unique constraint" errors correctly', () => {
      const error = new Error("unique constraint violation");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "already exists" errors correctly', () => {
      const error = new Error("user already exists");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_DUPLICATE");
    });

    it('should map "foreign key" errors correctly', () => {
      const error = new Error("foreign key constraint failed");
      const mappedError = defaultRepositoryErrorMapper(error);

      expect(mappedError.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mappedError.code).toBe("REPOSITORY_REFERENCE");
    });

    it('should map "reference" errors correctly', () => {
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

  describe("validate", () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().min(18),
    });

    it("should return success for valid data", () => {
      const data = { name: "John", age: 25 };
      const result = validate(schema, data);

      expect(result.isSuccess()).toBe(true);
      expect((result as Success<{ name: string; age: number }>).value).toEqual(
        data,
      );
    });

    it("should return failure for invalid data", () => {
      const data = { name: "Jo", age: 16 };
      const result = validate(schema, data);

      expect(result.isFailure()).toBe(true);
      expect((result as Failure<AppError>).error.code).toBe("VALIDATION_ERROR");
      expect((result as Failure<AppError>).error.statusCode).toBe(
        StatusCodes.BAD_REQUEST,
      );
    });

    it("should include validation details in the error", () => {
      const data = { name: "Jo", age: 16 };
      const result = validate(schema, data);

      expect(result.isFailure()).toBe(true);
      const error = (result as Failure<AppError>).error;
      expect(error.details).toBeDefined();
      // The details should contain information about both failed fields
      expect(error.details).toHaveProperty("name");
      expect(error.details).toHaveProperty("age");
    });

    it("should handle non-Zod errors", () => {
      // Create a malicious schema that throws a non-Zod error
      const badSchema = {
        parse: () => {
          throw new Error("Non-Zod error");
        },
      } as unknown as z.ZodType<Record<string, unknown>>;

      const result = validate(badSchema, {});

      expect(result.isFailure()).toBe(true);
      expect((result as Failure<AppError>).error.message).toBe("Invalid input");
      expect((result as Failure<AppError>).error.code).toBe("BAD_REQUEST");
    });
  });
});
