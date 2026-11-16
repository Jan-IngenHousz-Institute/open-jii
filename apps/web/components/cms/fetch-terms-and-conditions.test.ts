import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";

import { getTermsAndConditions } from "./fetch-terms-and-conditions";

const { published, preview, cached } = vi.hoisted(() => ({
  published: vi.fn(),
  preview: vi.fn(),
  cached: [] as { keys: unknown; options: unknown }[],
}));

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () =>
    Promise.resolve({
      client: { pageTermsAndConditions: published },
      previewClient: { pageTermsAndConditions: preview },
    }),
}));

// Records what the loader asks the cache for, which the global passthrough drops.
vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T, keys: unknown, options: unknown) => {
    cached.push({ keys, options });
    return fn;
  },
}));

beforeEach(() => {
  published.mockReset().mockResolvedValue({ pageTermsAndConditionsCollection: { items: [] } });
  preview.mockReset().mockResolvedValue({ pageTermsAndConditionsCollection: { items: [] } });
});

describe("getTermsAndConditions", () => {
  it("caches the published terms for an hour", () => {
    expect(cached).toEqual([
      {
        keys: ["page-terms-and-conditions"],
        options: { revalidate: PUBLISHED_CONTENT_SECONDS },
      },
    ]);
    expect(PUBLISHED_CONTENT_SECONDS).toBe(3600);
  });

  it("reads the published terms through the cached loader", async () => {
    await getTermsAndConditions("en-US", false);

    expect(published).toHaveBeenCalledExactlyOnceWith({ locale: "en-US", preview: false });
    expect(preview).not.toHaveBeenCalled();
  });

  it("reads drafts live through the preview client", async () => {
    await getTermsAndConditions("de-DE", true);

    expect(preview).toHaveBeenCalledExactlyOnceWith({ locale: "de-DE", preview: true });
    expect(published).not.toHaveBeenCalled();
  });
});
