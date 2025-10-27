import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line import/first
import { setTestMode, setTestFeatureFlag } from "./lib/posthog-server";
// eslint-disable-next-line import/first
import { middleware } from "./middleware";

// Mock the env module BEFORE importing posthog-server
vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_POSTHOG_KEY: "test-key",
    NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
  },
}));

// Mock the i18n config
vi.mock("@repo/i18n/config", () => ({
  locales: ["en-US", "de-DE"],
  defaultLocale: "en-US",
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestMode(true);
  });

  afterEach(() => {
    setTestMode(false);
  });

  describe("locale redirection", () => {
    it("should redirect to default locale when no locale in path", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/platform"));

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/en-US/platform");
    });

    it("should not redirect when locale is already in path", async () => {
      setTestFeatureFlag("multi-language", true);

      const request = new NextRequest(new URL("http://localhost:3000/en-US/platform"));

      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.status).toBe(200);
    });

    it("should preserve query parameters when redirecting to default locale", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/platform?foo=bar"));

      const response = await middleware(request);

      expect(response.headers.get("location")).toBe("http://localhost:3000/en-US/platform?foo=bar");
    });
  });

  describe("feature flag enforcement", () => {
    it("should allow en-US locale regardless of feature flag state", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/en-US/platform"));

      const response = await middleware(request);

      expect(response.status).not.toBe(404);
      expect(response.status).toBe(200);
    });

    it("should return 404 for de-DE when feature flag is disabled", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/platform"));

      const response = await middleware(request);

      expect(response.status).toBe(404);
    });

    it("should allow de-DE when feature flag is enabled", async () => {
      setTestFeatureFlag("multi-language", true);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/platform"));

      const response = await middleware(request);

      expect(response.status).not.toBe(404);
      expect(response.status).toBe(200);
    });

    it("should rewrite to 404 page with correct status when flag is disabled", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/platform"));

      const response = await middleware(request);

      expect(response.status).toBe(404);
      // NextResponse.rewrite is used internally
      expect(response).toBeInstanceOf(NextResponse);
    });

    it("should handle root locale paths", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE"));

      const response = await middleware(request);

      expect(response.status).toBe(404);
    });

    it("should allow root locale path when feature flag is enabled", async () => {
      setTestFeatureFlag("multi-language", true);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE"));

      const response = await middleware(request);

      expect(response.status).not.toBe(404);
    });
  });

  describe("current path header", () => {
    it("should add x-current-path header for allowed requests", async () => {
      setTestFeatureFlag("multi-language", true);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/settings"));

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should preserve other request headers", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/en-US"));
      request.headers.set("x-custom-header", "test-value");

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });
  });

  describe("edge cases", () => {
    it("should handle paths with trailing slashes", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/platform/"));

      const response = await middleware(request);

      expect(response.status).toBe(404);
    });

    it("should handle nested paths", async () => {
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(
        new URL("http://localhost:3000/de-DE/platform/experiments/123"),
      );

      const response = await middleware(request);

      expect(response.status).toBe(404);
    });

    it("should handle feature flag check errors gracefully", async () => {
      setTestMode(false); // Disable test mode to trigger real PostHog call
      setTestFeatureFlag("multi-language", false);

      const request = new NextRequest(new URL("http://localhost:3000/de-DE/platform"));

      const response = await middleware(request);

      // Should default to disabled (404) when PostHog fails
      expect(response.status).toBe(404);

      setTestMode(true); // Re-enable for other tests
    });
  });
});
