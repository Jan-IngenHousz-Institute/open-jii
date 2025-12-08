import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GET } from "../route";

// Mock the environment configuration
const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "development",
  ENVIRONMENT_PREFIX: "dev",
}));

vi.mock("~/env", () => ({
  env: mockEnv,
}));

// Helper function to create a mock NextRequest
const createMockRequest = (cookies: Record<string, string> = {}) => {
  const cookieEntries = Object.entries(cookies).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    cookies: {
      get: (name: string) => cookieEntries.find((cookie) => cookie.name === name),
    },
  } as NextRequest;
};

describe("GET /api/auth/mobile-redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to development defaults
    mockEnv.NODE_ENV = "development";
    mockEnv.ENVIRONMENT_PREFIX = "dev";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when session token is present", () => {
    it("should redirect to openjii app with session token in development", () => {
      const sessionToken = "test-session-token-123";
      const mockRequest = createMockRequest({
        "authjs.dev.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);

      // Check if it's a redirect response
      expect(response.status).toBe(307); // NextResponse.redirect uses 307 by default

      // Check the redirect URL
      const location = response.headers.get("location");
      expect(location).toBe(`openjii://callback?session_token=${encodeURIComponent(sessionToken)}`);
    });

    it("should redirect to openjii app with session token in production", () => {
      // Mock production environment
      mockEnv.NODE_ENV = "production";
      mockEnv.ENVIRONMENT_PREFIX = "prod";

      const sessionToken = "test-session-token-456";
      const mockRequest = createMockRequest({
        "__Secure-authjs.prod.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);

      expect(response.status).toBe(307);

      const location = response.headers.get("location");
      expect(location).toBe(`openjii://callback?session_token=${encodeURIComponent(sessionToken)}`);
    });

    it("should handle special characters in session token", () => {
      const sessionToken = "test-session-token-with-special-chars!@#$%^&*()";
      const mockRequest = createMockRequest({
        "authjs.dev.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);

      const location = response.headers.get("location");
      expect(location).toBe(
        `photosynq://callback?session_token=${encodeURIComponent(sessionToken)}`,
      );
    });
  });

  describe("when session token is missing", () => {
    it("should return 400 error when no session token cookie exists", () => {
      const mockRequest = createMockRequest({});

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
    });

    it("should return 400 error when session token cookie exists but is empty", () => {
      const mockRequest = createMockRequest({
        "authjs.dev.session-token": "",
      });

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
    });

    it("should return 400 error when wrong cookie name is present", () => {
      const mockRequest = createMockRequest({
        "some-other-cookie": "some-value",
        "authjs.wrong.session-token": "some-token",
      });

      const response = GET(mockRequest);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
    });
  });

  describe("cookie name construction", () => {
    it("should use correct cookie name format for development environment", () => {
      mockEnv.NODE_ENV = "development";
      mockEnv.ENVIRONMENT_PREFIX = "dev";

      const sessionToken = "test-token";
      const mockRequest = createMockRequest({
        "authjs.dev.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response.status).toBe(307);
    });

    it("should use correct cookie name format for production environment", () => {
      mockEnv.NODE_ENV = "production";
      mockEnv.ENVIRONMENT_PREFIX = "prod";

      const sessionToken = "test-token";
      const mockRequest = createMockRequest({
        "__Secure-authjs.prod.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response.status).toBe(307);
    });

    it("should handle custom environment prefix", () => {
      mockEnv.NODE_ENV = "development";
      mockEnv.ENVIRONMENT_PREFIX = "staging";

      const sessionToken = "test-token";
      const mockRequest = createMockRequest({
        "authjs.staging.session-token": sessionToken,
      });

      const response = GET(mockRequest);

      expect(response.status).toBe(307);
    });
  });

  describe("error response", () => {
    it("should return correct error message when session token is missing", async () => {
      const mockRequest = createMockRequest({});

      const response = GET(mockRequest);

      expect(response.status).toBe(400);

      // Check error message
      const responseText = await response.text();
      expect(responseText).toBe("Invalid request: missing session token");
    });
  });
});
