import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextAuthResult } from "@repo/auth/next";

// Mock the auth module dependencies
vi.mock("@repo/auth/next", () => ({
  initAuth: vi.fn(),
}));

vi.mock("./secrets", () => ({
  getSecret: vi.fn(),
  isLambdaEnvironment: vi.fn(),
}));

// Import mocked modules
const mockSecrets = vi.hoisted(() => ({
  getSecret: vi.fn(),
  isLambdaEnvironment: vi.fn(),
}));

describe("auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("in non-Lambda environment", () => {
    it("should initialize auth with empty secrets when not in Lambda", async () => {
      // Mock isLambdaEnvironment to return false
      mockSecrets.isLambdaEnvironment.mockReturnValue(false);

      // Mock the initAuth function
      const mockInitAuth = vi.fn();
      const mockAuthResult = {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        unstable_update: vi.fn(),
        providerMap: [{ id: "github", name: "GitHub" }],
      };
      mockInitAuth.mockReturnValue(mockAuthResult);

      // Setup mocks before importing
      vi.doMock("./secrets", () => mockSecrets);
      vi.doMock("@repo/auth/next", () => ({ initAuth: mockInitAuth }));

      // Import the module under test
      const auth = await import("./auth");

      // Verify initialization was called with empty secrets
      expect(mockInitAuth).toHaveBeenCalledWith({
        authSecrets: {},
        dbSecrets: {},
        sesSecrets: {},
        isLambda: false,
      });

      // Verify all expected exports exist
      expect(auth.handlers).toBeDefined();
      expect(auth.auth).toBeDefined();
      expect(auth.signIn).toBeDefined();
      expect(auth.signOut).toBeDefined();
      expect(auth.providerMap).toBeDefined();
      expect(auth.unstableUpdate).toBeDefined();
    });
  });

  describe("in Lambda environment", () => {
    it("should fetch secrets and initialize auth in Lambda environment", async () => {
      // Mock environment variables
      vi.stubEnv("OAUTH_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123456789012:secret:oauth");
      vi.stubEnv("DB_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123456789012:secret:db");
      vi.stubEnv("SES_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123456789012:secret:ses");

      // Mock isLambdaEnvironment to return true
      mockSecrets.isLambdaEnvironment.mockReturnValue(true);

      // Mock getSecret to return different values
      const authSecrets = { AUTH_SECRET: "auth-secret", AUTH_GITHUB_ID: "github-id" };
      const dbSecrets = { DATABASE_URL: "postgresql://test" };
      const sesSecrets = { AUTH_EMAIL_SERVER: "smtp://test", AUTH_EMAIL_FROM: "test@example.com" };

      mockSecrets.getSecret
        .mockResolvedValueOnce(authSecrets)
        .mockResolvedValueOnce(dbSecrets)
        .mockResolvedValueOnce(sesSecrets);

      // Mock the initAuth function
      const mockInitAuth = vi.fn();
      const mockAuthResult: NextAuthResult & { providerMap: { id: string; name: string }[] } = {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        unstable_update: vi.fn(),
        providerMap: [
          { id: "github", name: "GitHub" },
          { id: "nodemailer", name: "Email" },
        ],
      };
      mockInitAuth.mockReturnValue(mockAuthResult);

      // Setup mocks before importing
      vi.doMock("./secrets", () => mockSecrets);
      vi.doMock("@repo/auth/next", () => ({ initAuth: mockInitAuth }));

      // Import the module under test
      const auth = await import("./auth");

      // Verify secrets were fetched
      expect(mockSecrets.getSecret).toHaveBeenCalledTimes(3);
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(
        1,
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:oauth",
      );
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(
        2,
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:db",
      );
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(
        3,
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:ses",
      );

      // Verify initAuth was called with fetched secrets
      expect(mockInitAuth).toHaveBeenCalledWith({
        authSecrets,
        dbSecrets,
        sesSecrets,
        isLambda: true,
      });

      // Verify all expected exports exist
      expect(auth.handlers).toBeDefined();
      expect(auth.auth).toBeDefined();
      expect(auth.signIn).toBeDefined();
      expect(auth.signOut).toBeDefined();
      expect(auth.providerMap).toBeDefined();
      expect(auth.unstableUpdate).toBeDefined();
    });

    it("should handle missing secret ARNs gracefully", async () => {
      // Mock environment variables as empty
      vi.stubEnv("OAUTH_SECRET_ARN", "");
      vi.stubEnv("DB_SECRET_ARN", "");
      vi.stubEnv("SES_SECRET_ARN", "");

      // Mock isLambdaEnvironment to return true
      mockSecrets.isLambdaEnvironment.mockReturnValue(true);

      // Mock getSecret to return empty objects
      mockSecrets.getSecret.mockResolvedValue({});

      // Mock the initAuth function
      const mockInitAuth = vi.fn();
      const mockAuthResult = {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        unstable_update: vi.fn(),
        providerMap: [{ id: "github", name: "GitHub" }],
      };
      mockInitAuth.mockReturnValue(mockAuthResult);

      // Setup mocks before importing
      vi.doMock("./secrets", () => mockSecrets);
      vi.doMock("@repo/auth/next", () => ({ initAuth: mockInitAuth }));

      // Import the module under test
      await import("./auth");

      // Verify getSecret was called with empty strings
      expect(mockSecrets.getSecret).toHaveBeenCalledTimes(3);
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(1, "");
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(2, "");
      expect(mockSecrets.getSecret).toHaveBeenNthCalledWith(3, "");

      // Verify initAuth was called with empty secrets
      expect(mockInitAuth).toHaveBeenCalledWith({
        authSecrets: {},
        dbSecrets: {},
        sesSecrets: {},
        isLambda: true,
      });
    });
  });

  describe("exported functions", () => {
    it("should export all required auth functions and properties", async () => {
      // Mock isLambdaEnvironment to return false
      mockSecrets.isLambdaEnvironment.mockReturnValue(false);

      // Mock the initAuth function
      const mockInitAuth = vi.fn();
      const mockAuthResult = {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        unstable_update: vi.fn(),
        providerMap: [{ id: "github", name: "GitHub" }],
      };
      mockInitAuth.mockReturnValue(mockAuthResult);

      // Setup mocks before importing
      vi.doMock("./secrets", () => mockSecrets);
      vi.doMock("@repo/auth/next", () => ({ initAuth: mockInitAuth }));

      // Import the module under test
      const auth = await import("./auth");

      // Verify all expected exports exist and are correct types
      expect(auth).toHaveProperty("handlers");
      expect(auth).toHaveProperty("auth");
      expect(auth).toHaveProperty("signIn");
      expect(auth).toHaveProperty("signOut");
      expect(auth).toHaveProperty("providerMap");
      expect(auth).toHaveProperty("unstableUpdate");

      expect(typeof auth.auth).toBe("function");
      expect(typeof auth.signIn).toBe("function");
      expect(typeof auth.signOut).toBe("function");
      expect(typeof auth.unstableUpdate).toBe("function");
      expect(Array.isArray(auth.providerMap)).toBe(true);
      expect(typeof auth.handlers).toBe("object");
    });
  });
});
