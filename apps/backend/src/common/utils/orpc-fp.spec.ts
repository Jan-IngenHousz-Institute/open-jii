import { Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";
import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, assertFailure, failure } from "./fp-utils";
import { throwOrpcError, throwOrpcFailure } from "./orpc-fp";

// Bare `instanceof ORPCError` widens both generics to `any`; a guard keeps `code`/`data` typed.
function isOrpcError(err: unknown): err is ORPCError<string, unknown> {
  return err instanceof ORPCError;
}

// throwOrpc* never return; capture the thrown ORPCError so tests can assert on it.
function captureOrpcError(run: () => never): ORPCError<string, unknown> {
  try {
    run();
  } catch (err) {
    if (isOrpcError(err)) {
      return err;
    }
    throw err;
  }
  throw new Error("expected throwOrpc* to throw an ORPCError");
}

describe("orpc-fp", () => {
  let logger: Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger("test");
    errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("throwOrpcError", () => {
    it("maps a server error to an INTERNAL_SERVER_ERROR ORPCError and logs at error level", () => {
      const error = AppError.internal("Server error", "SERVER_ERROR", { detail: "test" });

      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.code).toBe("INTERNAL_SERVER_ERROR");
      expect(thrown.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(thrown.message).toBe("Server error");
      expect(thrown.data).toEqual({ code: "SERVER_ERROR", details: { detail: "test" } });
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("maps a client error to the matching ORPCError code and logs at warn level", () => {
      const error = AppError.badRequest("Bad request", "BAD_REQUEST", { detail: "test" });

      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.code).toBe("BAD_REQUEST");
      expect(thrown.status).toBe(StatusCodes.BAD_REQUEST);
      expect(thrown.data).toEqual({ code: "BAD_REQUEST", details: { detail: "test" } });
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("excludes details in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const error = AppError.badRequest("Bad request", "BAD_REQUEST", { detail: "test" });
      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({ code: "BAD_REQUEST" });
      expect(thrown.data).not.toHaveProperty("details");

      vi.unstubAllEnvs();
    });

    it("keeps allowlisted structural-validation details in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const issues = [
        {
          code: "DYNAMIC_COMMAND_SOURCE_MISSING",
          commandCellId: "c1",
          sourceCellId: "gone",
          field: "toDevice",
          index: 1,
        },
      ];
      const error = AppError.badRequest(
        "Workbook has structural validation errors",
        "WORKBOOK_STRUCTURAL_VALIDATION_FAILED",
        { issues },
      );
      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({
        code: "WORKBOOK_STRUCTURAL_VALIDATION_FAILED",
        details: { issues },
      });

      vi.unstubAllEnvs();
    });

    it("still strips non-allowlisted details in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const error = AppError.badRequest("Nope", "DYNAMIC_COMMAND_PUBLISH_DISABLED", {
        secret: "x",
      });
      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({ code: "DYNAMIC_COMMAND_PUBLISH_DISABLED" });
      expect(thrown.data).not.toHaveProperty("details");

      vi.unstubAllEnvs();
    });

    it("projects away secrets and unknown codes from structural details in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const error = AppError.badRequest(
        "Workbook has structural validation errors",
        "WORKBOOK_STRUCTURAL_VALIDATION_FAILED",
        {
          secret: "top-level-leak",
          issues: [
            {
              code: "DYNAMIC_COMMAND_SOURCE_MISSING",
              commandCellId: "c1",
              sourceCellId: "gone",
              field: "toDevice",
              index: 1,
              rawOutput: "sensitive-device-output",
            },
            { code: "SPOOFED_CODE", commandCellId: "c2", field: "f", index: 2 },
          ],
        },
      );
      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({
        code: "WORKBOOK_STRUCTURAL_VALIDATION_FAILED",
        details: {
          issues: [
            {
              code: "DYNAMIC_COMMAND_SOURCE_MISSING",
              commandCellId: "c1",
              sourceCellId: "gone",
              field: "toDevice",
              index: 1,
            },
          ],
        },
      });
      const serialized = JSON.stringify(thrown.data);
      expect(serialized).not.toContain("top-level-leak");
      expect(serialized).not.toContain("sensitive-device-output");
      expect(serialized).not.toContain("SPOOFED_CODE");

      vi.unstubAllEnvs();
    });

    it("drops malformed structural details entirely in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const error = AppError.badRequest(
        "Workbook has structural validation errors",
        "WORKBOOK_STRUCTURAL_VALIDATION_FAILED",
        { issues: "not-an-array", secret: "x" },
      );
      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({ code: "WORKBOOK_STRUCTURAL_VALIDATION_FAILED" });
      expect(thrown.data).not.toHaveProperty("details");

      vi.unstubAllEnvs();
    });

    it("falls back to INTERNAL_SERVER_ERROR for an unmapped 5xx status and logs at error level", () => {
      const error = new AppError("Service unavailable", "UNAVAILABLE", 503, {
        service: "external",
      });

      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.code).toBe("INTERNAL_SERVER_ERROR");
      expect(thrown.status).toBe(503);
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("logs a sub-500 status at warn level", () => {
      const error = AppError.unauthorized("Access denied", "UNAUTHORIZED", { userId: "123" });

      captureOrpcError(() => throwOrpcError(error, logger));

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("omits details from data when the error carries none", () => {
      const error = AppError.notFound("Resource not found", "NOT_FOUND");

      const thrown = captureOrpcError(() => throwOrpcError(error, logger));

      expect(thrown.data).toEqual({ code: "NOT_FOUND" });
    });

    it("includes operation and context in the structured log when provided", () => {
      const error = AppError.notFound("Missing", "NOT_FOUND");

      captureOrpcError(() => throwOrpcError(error, logger, "getThing", "ThingController"));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "getThing", context: "ThingController" }),
      );
    });

    it("maps each AppError kind to the expected ORPCError code + status", () => {
      const cases = [
        { error: AppError.badRequest(), code: "BAD_REQUEST", status: StatusCodes.BAD_REQUEST },
        { error: AppError.unauthorized(), code: "UNAUTHORIZED", status: StatusCodes.UNAUTHORIZED },
        { error: AppError.forbidden(), code: "FORBIDDEN", status: StatusCodes.FORBIDDEN },
        { error: AppError.notFound(), code: "NOT_FOUND", status: StatusCodes.NOT_FOUND },
        { error: AppError.conflict(), code: "CONFLICT", status: StatusCodes.CONFLICT },
        {
          error: AppError.internal(),
          code: "INTERNAL_SERVER_ERROR",
          status: StatusCodes.INTERNAL_SERVER_ERROR,
        },
      ];

      for (const { error, code, status } of cases) {
        const thrown = captureOrpcError(() => throwOrpcError(error, logger));
        expect(thrown.code).toBe(code);
        expect(thrown.status).toBe(status);
      }
    });
  });

  describe("throwOrpcFailure", () => {
    it("unwraps a Failure and throws the same mapped ORPCError", () => {
      const result = failure(AppError.forbidden("Nope", "FORBIDDEN"));
      assertFailure(result);

      const thrown = captureOrpcError(() => throwOrpcFailure(result, logger));

      expect(thrown.code).toBe("FORBIDDEN");
      expect(thrown.status).toBe(StatusCodes.FORBIDDEN);
      expect(thrown.data).toEqual({ code: "FORBIDDEN" });
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
