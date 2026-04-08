import type { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET } from "../route";

// ── mocks ────────────────────────────────────────────────────────────
const enableMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => ({ enable: enableMock })),
  cookies: vi.fn(() => ({ get: getMock, set: setMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    // redirect in Next.js throws to halt execution
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "production",
  },
}));

function createMockRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

describe("GET /api/enable-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReturnValue({ value: "bypass-token-value" });
  });

  it("returns 400 when path is missing in production", async () => {
    const request = createMockRequest("https://example.com/api/enable-draft?path=");

    const response = await GET(request);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it("enables draft mode and redirects in production", async () => {
    const request = createMockRequest("https://example.com/api/enable-draft?path=%2Fen-US%2Fabout");

    await expect(GET(request)).rejects.toThrow("NEXT_REDIRECT");

    expect(enableMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "__prerender_bypass",
        value: "bypass-token-value",
        sameSite: "none",
        secure: true,
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith("https://example.com/en-US/about");
  });

  it("appends bypass token query params when provided", async () => {
    const request = createMockRequest(
      "https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&x-vercel-protection-bypass=my-token",
    );

    await expect(GET(request)).rejects.toThrow("NEXT_REDIRECT");

    const redirectUrl = new URL(redirectMock.mock.calls[0][0] as string);
    expect(redirectUrl.searchParams.get("x-vercel-protection-bypass")).toBe("my-token");
    expect(redirectUrl.searchParams.get("x-vercel-set-bypass-cookie")).toBe("samesitenone");
  });

  it("throws when request url is missing", async () => {
    const request = createMockRequest(undefined as unknown as string);

    await expect(GET(request)).rejects.toThrow("missing `url` value in request");
  });

  it("throws when __prerender_bypass cookie is missing", async () => {
    getMock.mockReturnValue(undefined);

    const request = createMockRequest("https://example.com/api/enable-draft?path=%2Fen-US%2Fabout");

    await expect(GET(request)).rejects.toThrow("Missing '__prerender_bypass' cookie");
  });

  describe("in development mode", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.doMock("~/env", () => ({
        env: { NODE_ENV: "development" },
      }));
    });

    it("skips path validation and enables draft mode even with empty path", async () => {
      // Re-import so the module picks up the development env mock
      const { GET: devGET } = await import("../route");

      // Use empty path — in production this would return 400
      const request = createMockRequest("https://example.com/api/enable-draft?path=");

      await expect(devGET(request)).rejects.toThrow("NEXT_REDIRECT");

      expect(enableMock).toHaveBeenCalled();
      expect(redirectMock).toHaveBeenCalled();
    });
  });
});
