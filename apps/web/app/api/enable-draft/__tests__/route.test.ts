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

const contentfulConfigMock = vi.hoisted(() => ({ previewSecret: "s3cret" }));

vi.mock("~/lib/contentful", () => ({
  contentfulConfig: Promise.resolve(contentfulConfigMock),
}));

const SECRET = "x-contentful-preview-secret=s3cret";

function createMockRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

describe("GET /api/enable-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReturnValue({ value: "bypass-token-value" });
    contentfulConfigMock.previewSecret = "s3cret";
  });

  it("returns 400 when path is missing in production", async () => {
    const request = createMockRequest(`https://example.com/api/enable-draft?path=&${SECRET}`);

    const response = await GET(request);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it("returns 401 without the preview secret", async () => {
    const request = createMockRequest("https://example.com/api/enable-draft?path=%2Fen-US%2Fabout");

    const response = await GET(request);

    expect((response as Response).status).toBe(401);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong preview secret", async () => {
    const request = createMockRequest(
      "https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&x-contentful-preview-secret=guess",
    );

    const response = await GET(request);

    expect((response as Response).status).toBe(401);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it("returns 401 when no preview secret is configured", async () => {
    contentfulConfigMock.previewSecret = "";
    const request = createMockRequest(
      "https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&x-contentful-preview-secret=",
    );

    const response = await GET(request);

    expect((response as Response).status).toBe(401);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an absolute URL", "https%3A%2F%2Fevil.example%2F"],
    ["a protocol-relative URL", "%2F%2Fevil.example%2F"],
  ])("returns 400 when path is %s", async (_label, path) => {
    const request = createMockRequest(
      `https://example.com/api/enable-draft?path=${path}&${SECRET}`,
    );

    const response = await GET(request);

    expect((response as Response).status).toBe(400);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it("enables draft mode and redirects in production", async () => {
    const request = createMockRequest(
      `https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&${SECRET}`,
    );

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
      `https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&x-vercel-protection-bypass=my-token&${SECRET}`,
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

    const request = createMockRequest(
      `https://example.com/api/enable-draft?path=%2Fen-US%2Fabout&${SECRET}`,
    );

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

    it("still refuses to redirect off the site", async () => {
      const { GET: devGET } = await import("../route");

      const request = createMockRequest(
        "https://example.com/api/enable-draft?path=https%3A%2F%2Fevil.example%2F",
      );

      const response = await devGET(request);

      expect((response as Response).status).toBe(400);
      expect(enableMock).not.toHaveBeenCalled();
    });
  });
});
