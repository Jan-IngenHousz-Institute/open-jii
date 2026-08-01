import type { Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";
import { describe, expect, it, vi } from "vitest";

import { createOrpcErrorLoggingInterceptor } from "./orpc-error-logging";

function makeLogger() {
  const error = vi.fn();
  return { logger: { error } as unknown as Logger, error };
}

describe("createOrpcErrorLoggingInterceptor", () => {
  it("passes through the handler result untouched", async () => {
    const { logger, error: logError } = makeLogger();
    const interceptor = createOrpcErrorLoggingInterceptor(logger);

    const result = await interceptor({ next: () => Promise.resolve(["row"]) });

    expect(result).toEqual(["row"]);
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs a 5xx ORPCError with the validation issues from its cause, then rethrows", async () => {
    const { logger, error: logError } = makeLogger();
    const interceptor = createOrpcErrorLoggingInterceptor(logger);
    const issues = [{ code: "unrecognized_keys", path: ["cells", 0, "payload"] }];
    const error = new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Output validation failed",
      cause: { issues },
    });

    await expect(interceptor({ next: () => Promise.reject(error) })).rejects.toBe(error);

    expect(logError).toHaveBeenCalledWith({
      msg: "Output validation failed",
      code: "INTERNAL_SERVER_ERROR",
      issues,
    });
  });

  it("logs a 5xx ORPCError without issues when the cause has none", async () => {
    const { logger, error: logError } = makeLogger();
    const interceptor = createOrpcErrorLoggingInterceptor(logger);
    const error = new ORPCError("INTERNAL_SERVER_ERROR", { message: "boom" });

    await expect(interceptor({ next: () => Promise.reject(error) })).rejects.toBe(error);

    expect(logError).toHaveBeenCalledWith({ msg: "boom", code: "INTERNAL_SERVER_ERROR" });
  });

  it("rethrows 4xx ORPCErrors without logging (handlers already log their own failures)", async () => {
    const { logger, error: logError } = makeLogger();
    const interceptor = createOrpcErrorLoggingInterceptor(logger);
    const error = new ORPCError("NOT_FOUND", { status: 404, message: "missing" });

    await expect(interceptor({ next: () => Promise.reject(error) })).rejects.toBe(error);

    expect(logError).not.toHaveBeenCalled();
  });

  it("rethrows non-ORPC errors without logging (the rethrow plugin hands them to Nest)", async () => {
    const { logger, error: logError } = makeLogger();
    const interceptor = createOrpcErrorLoggingInterceptor(logger);
    const error = new TypeError("unrelated");

    await expect(interceptor({ next: () => Promise.reject(error) })).rejects.toBe(error);

    expect(logError).not.toHaveBeenCalled();
  });
});
