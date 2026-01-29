import { describe, it, expect } from "vitest";

import {
  zErrorResponse,
  zSessionResponse,
  zSignInEmailBody,
  zSignInEmailResponse,
  zSignOutResponse,
  zUpdateUserBody,
  zUpdateUserResponse,
  zVerifyEmailBody,
  zVerifyEmailResponse,
} from "./auth.contract";

describe("Auth Contract Schemas", () => {
  describe("zSignInEmailBody", () => {
    it("should validate a valid email", () => {
      const data = { email: "test@example.com" };
      const result = zSignInEmailBody.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject an invalid email", () => {
      const data = { email: "invalid-email" };
      const result = zSignInEmailBody.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("zSignInEmailResponse", () => {
    it("should validate success response", () => {
      const data = { success: true, message: "OTP sent" };
      const result = zSignInEmailResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zVerifyEmailBody", () => {
    it("should validate valid verify request", () => {
      const data = { email: "test@example.com", code: "123456" };
      const result = zVerifyEmailBody.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject missing code", () => {
      const data = { email: "test@example.com" };
      const result = zVerifyEmailBody.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("zVerifyEmailResponse", () => {
    it("should validate valid verify response", () => {
      const data = {
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
          image: null,
          registered: true,
          emailVerified: true,
        },
        session: {
          token: "session-token",
          expiresAt: "2024-01-01T00:00:00Z",
        },
      };
      const result = zVerifyEmailResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zSessionResponse", () => {
    it("should validate valid session response", () => {
      const data = {
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/avatar.png",
          registered: true,
          emailVerified: true,
        },
        session: {
          token: "session-token",
          expiresAt: "2024-01-01T00:00:00Z",
        },
      };
      const result = zSessionResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zSignOutResponse", () => {
    it("should validate success validation", () => {
      const data = { success: true };
      const result = zSignOutResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zUpdateUserBody", () => {
    it("should validate partial update", () => {
      const data = { name: "New Name" };
      const result = zUpdateUserBody.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate boolean update", () => {
      const data = { registered: true };
      const result = zUpdateUserBody.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zUpdateUserResponse", () => {
    it("should validate update response", () => {
      const data = {
        user: {
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
          image: null,
          registered: true,
          emailVerified: true,
        },
      };
      const result = zUpdateUserResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("zErrorResponse", () => {
    it("should validate error response", () => {
      const data = { error: "Something went wrong", message: "Details" };
      const result = zErrorResponse.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate error response without message", () => {
      const data = { error: "Unauthorized" };
      const result = zErrorResponse.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
