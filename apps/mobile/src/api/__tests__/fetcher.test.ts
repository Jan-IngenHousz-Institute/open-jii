import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSignOut, mockGetCookie, mockIsOnline, mockTsRestFetchApi } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockGetCookie: vi.fn().mockReturnValue("session=abc"),
  mockIsOnline: vi.fn().mockReturnValue(true),
  mockTsRestFetchApi: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: mockIsOnline },
}));

vi.mock("@ts-rest/core", () => ({
  tsRestFetchApi: mockTsRestFetchApi,
}));

vi.mock("~/services/auth", () => ({
  getAuthClient: () => ({
    getCookie: mockGetCookie,
    signOut: mockSignOut,
  }),
}));

vi.mock("~/stores/environment-store", () => ({
  getEnvVar: () => "https://api.example.com",
}));

import { customApiFetcher } from "../fetcher";

const baseArgs = {
  path: "/measurements",
  method: "GET" as const,
  headers: {},
  body: undefined,
  rawBody: undefined,
  contentType: undefined,
  credentials: undefined,
  signal: undefined,
  route: {} as any,
  fetcherOptions: undefined,
};

describe("customApiFetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.mockReturnValue(true);
    mockGetCookie.mockReturnValue("session=abc");
  });

  describe("401 handling", () => {
    it("calls signOut when online and API returns 401", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 401, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockSignOut).toHaveBeenCalledOnce();
    });

    it("does not call signOut when offline and API returns 401", async () => {
      mockIsOnline.mockReturnValue(false);
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 401, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("does not call signOut for non-401 responses", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 200, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("does not call signOut for 403 responses", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 403, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe("request construction", () => {
    it("attaches cookie header when cookie is present", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 200, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockTsRestFetchApi).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Cookie: "session=abc" }),
        }),
      );
    });

    it("omits cookie header when no cookie is present", async () => {
      mockGetCookie.mockReturnValue(undefined);
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 200, body: {} });

      await customApiFetcher(baseArgs);

      const calledWith = mockTsRestFetchApi.mock.calls[0][0];
      expect(calledWith.headers).not.toHaveProperty("Cookie");
    });

    it("constructs the full path from base URL and path", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 200, body: {} });

      await customApiFetcher(baseArgs);

      expect(mockTsRestFetchApi).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "https://api.example.com/measurements",
        }),
      );
    });

    it("strips trailing slashes from base URL and leading slashes from path", async () => {
      mockTsRestFetchApi.mockResolvedValueOnce({ status: 200, body: {} });

      await customApiFetcher({ ...baseArgs, path: "//measurements" });

      expect(mockTsRestFetchApi).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "https://api.example.com/measurements",
        }),
      );
    });
  });

  describe("return value", () => {
    it("returns the result regardless of status", async () => {
      const mockResult = { status: 401, body: { message: "Unauthorized" } };
      mockTsRestFetchApi.mockResolvedValueOnce(mockResult);

      const result = await customApiFetcher(baseArgs);

      expect(result).toBe(mockResult);
    });
  });
});
