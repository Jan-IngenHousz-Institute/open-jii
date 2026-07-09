import { ORPCError } from "@orpc/client";
import { describe, it, expect } from "vitest";

import { parseApiError } from "./apiError";

describe("parseApiError", () => {
  it("reads message from .message and app code from .data.code on an ORPCError", () => {
    const error = new ORPCError("NOT_FOUND", {
      status: 404,
      message: "Experiment not found",
      data: { code: "EXPERIMENT_NOT_FOUND" },
    });
    expect(parseApiError(error)).toEqual({
      message: "Experiment not found",
      code: "EXPERIMENT_NOT_FOUND",
    });
  });

  it("returns an undefined code when the ORPCError data carries no app code", () => {
    const error = new ORPCError("INTERNAL_SERVER_ERROR", { message: "Boom" });
    expect(parseApiError(error)).toEqual({ message: "Boom", code: undefined });
  });

  it("digs the real message out of an OpenAPILink-wrapped non-envelope error (.data.body)", () => {
    // OpenAPILink wraps a non-oRPC response (e.g. the auth guard's 401) like this,
    // with a generic top-level .message and the server payload under .data.body.
    const error = new ORPCError("FORBIDDEN", {
      status: 403,
      data: { body: { message: "Not allowed to transfer" }, status: 403, headers: {} },
    });
    expect(parseApiError(error)).toEqual({ message: "Not allowed to transfer" });
  });

  it("returns undefined for a wrapped error whose body has no message", () => {
    const error = new ORPCError("INTERNAL_SERVER_ERROR", {
      status: 500,
      data: { body: { unexpected: true }, status: 500, headers: {} },
    });
    expect(parseApiError(error)).toBeUndefined();
  });

  it("returns parsed data when body has code and message", () => {
    const error = { body: { code: "NOT_FOUND", message: "Resource not found" } };
    expect(parseApiError(error)).toEqual({ code: "NOT_FOUND", message: "Resource not found" });
  });

  it("returns parsed data when body has message but no code", () => {
    const error = { body: { message: "Something went wrong" } };
    expect(parseApiError(error)).toEqual({ message: "Something went wrong" });
  });

  it("returns undefined when body has no message", () => {
    const error = { body: { code: "ERR" } };
    expect(parseApiError(error)).toBeUndefined();
  });

  it("returns undefined for non-object input", () => {
    expect(parseApiError("string error")).toBeUndefined();
    expect(parseApiError(42)).toBeUndefined();
    expect(parseApiError(null)).toBeUndefined();
    expect(parseApiError(undefined)).toBeUndefined();
  });

  it("returns undefined when error has no body property", () => {
    expect(parseApiError({ status: 500 })).toBeUndefined();
    expect(parseApiError({})).toBeUndefined();
  });

  it("returns undefined when body is not a valid shape", () => {
    expect(parseApiError({ body: "not an object" })).toBeUndefined();
    expect(parseApiError({ body: 123 })).toBeUndefined();
    expect(parseApiError({ body: null })).toBeUndefined();
  });
});
