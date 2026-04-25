import { describe, it, expect } from "vitest";

import { parseApiError } from "./apiError";

describe("parseApiError", () => {
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
