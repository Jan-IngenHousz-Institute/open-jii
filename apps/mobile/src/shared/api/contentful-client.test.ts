import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetContentfulClientForTests, getContentfulClient } from "./contentful-client";

const { mockGetEnvVar, mockCreateClient } = vi.hoisted(() => ({
  mockGetEnvVar: vi.fn(),
  // Fresh object per call so cache-identity assertions are meaningful.
  mockCreateClient: vi.fn((_opts: unknown) => ({ client: {} })),
}));

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (key: string, required?: boolean) => mockGetEnvVar(key, required),
}));

vi.mock("@repo/cms/client", () => ({
  createContentfulClient: (opts: unknown) => mockCreateClient(opts),
}));

const env = (values: Record<string, string>) => {
  mockGetEnvVar.mockImplementation((key: string) => values[key] ?? "");
};

beforeEach(() => {
  _resetContentfulClientForTests();
  mockCreateClient.mockClear();
});

describe("getContentfulClient", () => {
  it("returns null when credentials are absent", () => {
    env({});
    expect(getContentfulClient()).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns null when getEnvVar throws (env not loaded)", () => {
    mockGetEnvVar.mockImplementation(() => {
      throw new Error("env not loaded");
    });
    expect(getContentfulClient()).toBeNull();
  });

  it("builds the client once and caches it for the same credentials", () => {
    env({ CONTENTFUL_SPACE_ID: "space", CONTENTFUL_ACCESS_TOKEN: "token" });
    const first = getContentfulClient();
    const second = getContentfulClient();
    expect(first).toBe(second);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    // Missing environment falls back to master.
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: "space", accessToken: "token", environment: "master" }),
    );
  });

  it("re-creates the client when credentials change", () => {
    env({ CONTENTFUL_SPACE_ID: "space", CONTENTFUL_ACCESS_TOKEN: "token" });
    const first = getContentfulClient();
    env({
      CONTENTFUL_SPACE_ID: "space",
      CONTENTFUL_ACCESS_TOKEN: "token-2",
      CONTENTFUL_SPACE_ENVIRONMENT: "staging",
    });
    const second = getContentfulClient();
    expect(second).not.toBe(first);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
