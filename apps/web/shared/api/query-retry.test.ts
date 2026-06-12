import { describe, it, expect } from "vitest";

import { shouldRetryQuery } from "./query-retry";

describe("shouldRetryQuery", () => {
  describe("4xx client errors", () => {
    it("should NOT retry on 400 Bad Request", () => {
      const error = { status: 400, message: "Bad Request" };
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(shouldRetryQuery(1, error)).toBe(false);
      expect(shouldRetryQuery(2, error)).toBe(false);
    });

    it("should NOT retry on 401 Unauthorized", () => {
      const error = { status: 401, message: "Unauthorized" };
      expect(shouldRetryQuery(0, error)).toBe(false);
    });

    it("should NOT retry on 403 Forbidden", () => {
      const error = { status: 403, message: "Forbidden" };
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(shouldRetryQuery(1, error)).toBe(false);
      expect(shouldRetryQuery(2, error)).toBe(false);
    });

    it("should NOT retry on 404 Not Found", () => {
      const error = { status: 404, message: "Not Found" };
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(shouldRetryQuery(1, error)).toBe(false);
    });

    it("should NOT retry on 422 Unprocessable Entity", () => {
      const error = { status: 422, message: "Unprocessable Entity" };
      expect(shouldRetryQuery(0, error)).toBe(false);
    });

    it("should NOT retry on 429 Too Many Requests", () => {
      const error = { status: 429, message: "Too Many Requests" };
      expect(shouldRetryQuery(0, error)).toBe(false);
    });
  });

  describe("5xx server errors", () => {
    it("should retry on 500 Internal Server Error (up to 3 times)", () => {
      const error = { status: 500, message: "Internal Server Error" };
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(true);
      expect(shouldRetryQuery(3, error)).toBe(false);
    });

    it("should retry on 502 Bad Gateway", () => {
      const error = { status: 502, message: "Bad Gateway" };
      expect(shouldRetryQuery(0, error)).toBe(true);
    });

    it("should retry on 503 Service Unavailable", () => {
      const error = { status: 503, message: "Service Unavailable" };
      expect(shouldRetryQuery(0, error)).toBe(true);
    });

    it("should retry on 504 Gateway Timeout", () => {
      const error = { status: 504, message: "Gateway Timeout" };
      expect(shouldRetryQuery(0, error)).toBe(true);
    });
  });

  describe("network errors", () => {
    it("should retry on network timeout (up to 3 times)", () => {
      const error = new Error("Network timeout");
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(true);
      expect(shouldRetryQuery(3, error)).toBe(false);
    });

    it("should retry on connection refused", () => {
      const error = new Error("Connection refused");
      expect(shouldRetryQuery(0, error)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should retry when error has no status property", () => {
      const error = { message: "Some error" };
      expect(shouldRetryQuery(0, error)).toBe(true);
    });

    it("should retry when error is a string", () => {
      expect(shouldRetryQuery(0, "String error")).toBe(true);
    });

    it("should retry when error has non-numeric status", () => {
      const error = { status: "bad" };
      expect(shouldRetryQuery(0, error)).toBe(true);
    });

    it("should retry when error is an empty object", () => {
      expect(shouldRetryQuery(0, {})).toBe(true);
    });

    it("should retry when error is null", () => {
      expect(shouldRetryQuery(0, null)).toBe(true);
    });

    it("should retry when error is undefined", () => {
      expect(shouldRetryQuery(0, undefined)).toBe(true);
    });
  });
});
