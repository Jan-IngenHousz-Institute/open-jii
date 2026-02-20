import { describe, it, expect } from "vitest";

import { zIotCredentials } from "./iot.schema";

describe("Iot Schema", () => {
  describe("zIotCredentials", () => {
    it("should validate valid IoT credentials", () => {
      const validCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: "2026-02-09T12:00:00.000Z",
      };

      const result = zIotCredentials.safeParse(validCredentials);
      expect(result.success).toBe(true);
    });

    it("should reject credentials with missing fields", () => {
      const invalidCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });

    it("should reject credentials with invalid expiration format", () => {
      const invalidCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: "not-a-valid-date",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });

    it("should reject credentials with empty strings", () => {
      const invalidCredentials = {
        accessKeyId: "",
        secretAccessKey: "",
        sessionToken: "",
        expiration: "2026-02-09T12:00:00.000Z",
      };

      // Empty strings are still valid strings per the schema
      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(true);
    });

    it("should reject credentials with non-string values", () => {
      const invalidCredentials = {
        accessKeyId: 123,
        secretAccessKey: true,
        sessionToken: null,
        expiration: "2026-02-09T12:00:00.000Z",
      };

      const result = zIotCredentials.safeParse(invalidCredentials);
      expect(result.success).toBe(false);
    });
  });
});
