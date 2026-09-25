import { describe, expect, it } from "vitest";
import { apiErrorCode, isApiStatus } from "~/features/experiments/utils/api-error";

function apiError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status });
}

describe("isApiStatus", () => {
  it("matches the status the error carries", () => {
    expect(isApiStatus(apiError(404), 404)).toBe(true);
  });

  it("matches any of several statuses", () => {
    expect(isApiStatus(apiError(429), 404, 403, 429)).toBe(true);
    expect(isApiStatus(apiError(500), 404, 403, 429)).toBe(false);
  });

  it("says no for an error with no status, which is what a network failure looks like", () => {
    expect(isApiStatus(new Error("Network request failed"), 404)).toBe(false);
  });

  it("says no for a non-error value", () => {
    expect(isApiStatus(null, 404)).toBe(false);
    expect(isApiStatus(undefined, 404)).toBe(false);
    expect(isApiStatus("404", 404)).toBe(false);
  });
});

describe("apiErrorCode", () => {
  it("reads the code the backend sends on data", () => {
    const error = Object.assign(new Error("gone"), {
      status: 404,
      data: { code: "JOIN_CODE_EXPIRED" },
    });
    expect(apiErrorCode(error)).toBe("JOIN_CODE_EXPIRED");
  });

  it("says nothing for an error without data, or data without a string code", () => {
    expect(apiErrorCode(apiError(404))).toBeUndefined();
    expect(apiErrorCode(Object.assign(new Error(), { data: null }))).toBeUndefined();
    expect(apiErrorCode(Object.assign(new Error(), { data: { code: 404 } }))).toBeUndefined();
  });

  it("says nothing for a non-error value", () => {
    expect(apiErrorCode(null)).toBeUndefined();
    expect(apiErrorCode(undefined)).toBeUndefined();
    expect(apiErrorCode("JOIN_CODE_EXPIRED")).toBeUndefined();
  });
});
