import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import { defaultLocale, locales } from "@repo/i18n/config";

import { isIndexableSiteUrl, SITE_URL } from "../../lib/site-url";
import { createRobots } from "../robots";
import sitemap, { dynamic } from "../sitemap";

const nextCache = vi.hoisted(() => {
  const stores: { hasValue: boolean; value?: unknown }[] = [];
  const registrations: {
    keyParts?: string[];
    options?: { revalidate?: number | false; tags?: string[] };
  }[] = [];

  return {
    registrations,
    reset() {
      for (const store of stores) {
        store.hasValue = false;
        store.value = undefined;
      }
    },
    unstableCache: vi.fn(
      (
        fn: (...args: unknown[]) => Promise<unknown>,
        keyParts?: string[],
        options?: { revalidate?: number | false; tags?: string[] },
      ) => {
        registrations.push({ keyParts, options });
        const store = { hasValue: false, value: undefined as unknown };
        stores.push(store);

        return async (...args: unknown[]) => {
          if (!store.hasValue) {
            store.value = await fn(...args);
            store.hasValue = true;
          }
          return store.value;
        };
      },
    ),
  };
});

vi.mock("next/cache", () => ({ unstable_cache: nextCache.unstableCache }));

describe("public SEO routes", () => {
  const sitemapPages =
    vi.fn<(variables: { locale: string; limit: number; skip: number }) => Promise<unknown>>();
  const allReleaseNotes =
    vi.fn<
      (variables: {
        locale: string;
        now: string;
        preview: boolean;
        limit: number;
        skip: number;
      }) => Promise<unknown>
    >();

  beforeEach(() => {
    nextCache.reset();
    sitemapPages.mockResolvedValue({
      pageBlogPostCollection: { items: [] },
    });
    allReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: { items: [] },
    });
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { sitemapPages, allReleaseNotes },
      previewClient: {},
    } as never);
  });

  it("allows indexing only on the production root domain", () => {
    expect(isIndexableSiteUrl("https://openjii.org")).toBe(true);
    expect(isIndexableSiteUrl("https://dev.openjii.org")).toBe(false);
    expect(isIndexableSiteUrl("http://localhost:3000")).toBe(false);
  });

  it("blocks non-production deployments and protects private routes in production", () => {
    expect(createRobots(false, "https://dev.openjii.org")).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });

    expect(createRobots(true, "https://openjii.org")).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/en-US/platform", "/de-DE/platform"],
      },
      sitemap: "https://openjii.org/sitemap.xml",
    });
  });

  it("allows auth pages to be crawled so their layout noindex metadata is observable", () => {
    const productionRules = createRobots(true, "https://openjii.org").rules;
    const disallowed = Array.isArray(productionRules)
      ? productionRules.flatMap((rule) => rule.disallow ?? [])
      : (productionRules.disallow ?? []);

    for (const locale of locales) {
      expect(disallowed).not.toContain(`/${locale}/login`);
      expect(disallowed).not.toContain(`/${locale}/register`);
      expect(disallowed).not.toContain(`/${locale}/verify-request`);
    }
  });

  it("publishes only default-locale routes while locale availability is request-time flagged", async () => {
    const entries = await sitemap();
    const defaultHome = entries.find((entry) => entry.url === `${SITE_URL}/${defaultLocale}`);

    expect(dynamic).toBe("force-dynamic");
    expect(entries.map((entry) => entry.url)).toEqual([
      `${SITE_URL}/${defaultLocale}`,
      `${SITE_URL}/${defaultLocale}/about`,
      `${SITE_URL}/${defaultLocale}/blog`,
      `${SITE_URL}/${defaultLocale}/cookie-policy`,
      `${SITE_URL}/${defaultLocale}/faq`,
      `${SITE_URL}/${defaultLocale}/policies`,
      `${SITE_URL}/${defaultLocale}/releases`,
      `${SITE_URL}/${defaultLocale}/terms-and-conditions`,
    ]);
    expect(entries.some((entry) => entry.url.includes("/de-DE"))).toBe(false);
    expect(defaultHome?.alternates?.languages).toEqual({
      [defaultLocale]: `${SITE_URL}/${defaultLocale}`,
      "x-default": `${SITE_URL}/${defaultLocale}`,
    });
  });

  it("caches Contentful sitemap pagination for five minutes without changing dynamic rendering", async () => {
    const first = await sitemap();
    const second = await sitemap();

    expect(dynamic).toBe("force-dynamic");
    expect(nextCache.registrations).toContainEqual({
      keyParts: ["sitemap-contentful"],
      options: { revalidate: 300 },
    });
    expect(second).toEqual(first);
    expect(getContentfulClients).toHaveBeenCalledTimes(1);
    expect(sitemapPages).toHaveBeenCalledTimes(1);
    expect(allReleaseNotes).toHaveBeenCalledTimes(1);
  });

  it("appends published blog and release detail routes with last-modified dates", async () => {
    sitemapPages.mockResolvedValue({
      pageBlogPostCollection: {
        items: [
          {
            slug: "plant-light-response",
            sys: { publishedAt: "2026-01-10T12:00:00.000Z" },
          },
        ],
      },
    });
    allReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: {
        items: [
          {
            slug: "summer-update",
            active: true,
            publishedAt: "2026-02-15T09:30:00.000Z",
          },
        ],
      },
    });

    const entries = await sitemap();

    expect(entries.slice(8)).toEqual([
      {
        url: `${SITE_URL}/en-US/blog/plant-light-response`,
        lastModified: new Date("2026-01-10T12:00:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: {
            "en-US": `${SITE_URL}/en-US/blog/plant-light-response`,
            "x-default": `${SITE_URL}/en-US/blog/plant-light-response`,
          },
        },
      },
      {
        url: `${SITE_URL}/en-US/releases/summer-update`,
        lastModified: new Date("2026-02-15T09:30:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: {
            "en-US": `${SITE_URL}/en-US/releases/summer-update`,
            "x-default": `${SITE_URL}/en-US/releases/summer-update`,
          },
        },
      },
    ]);
    expect(sitemapPages).toHaveBeenCalledWith({ locale: defaultLocale, limit: 100, skip: 0 });
    expect(allReleaseNotes).toHaveBeenCalledTimes(1);
    expect(allReleaseNotes.mock.calls[0]?.[0]).toMatchObject({
      locale: defaultLocale,
      preview: false,
      limit: 100,
      skip: 0,
    });
    expect(Date.parse(allReleaseNotes.mock.calls[0]?.[0].now ?? "")).not.toBeNaN();
  });

  it("filters unavailable entries and deduplicates each published detail route", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    sitemapPages.mockResolvedValue({
      pageBlogPostCollection: {
        items: [
          null,
          { slug: null, sys: { publishedAt: "2026-01-01T00:00:00.000Z" } },
          { slug: "   ", sys: { publishedAt: "2026-01-01T00:00:00.000Z" } },
          { slug: "preview-only", sys: { publishedAt: null } },
          { slug: "duplicate", sys: { publishedAt: "2026-01-01T00:00:00.000Z" } },
          { slug: " duplicate ", sys: { publishedAt: "2026-01-02T00:00:00.000Z" } },
        ],
      },
    });
    allReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: {
        items: [
          null,
          { slug: "", active: true, publishedAt: "2026-01-01T00:00:00.000Z" },
          { slug: "preview-only", active: true, publishedAt: null },
          { slug: "inactive", active: false, publishedAt: "2026-01-01T00:00:00.000Z" },
          { slug: "future", active: true, publishedAt: future },
          { slug: "duplicate", active: true, publishedAt: "2026-02-01T00:00:00.000Z" },
          { slug: " duplicate ", active: true, publishedAt: "2026-02-02T00:00:00.000Z" },
        ],
      },
    });

    const dynamicEntries = (await sitemap()).slice(8);

    expect(dynamicEntries.map((entry) => entry.url)).toEqual([
      `${SITE_URL}/en-US/blog/duplicate`,
      `${SITE_URL}/en-US/releases/duplicate`,
    ]);
    expect(dynamicEntries.map((entry) => entry.lastModified)).toEqual([
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-02-02T00:00:00.000Z"),
    ]);
  });

  it("aggregates every blog and release page until each collection total is covered", async () => {
    sitemapPages.mockImplementation(({ skip }: { skip: number }) =>
      Promise.resolve({
        pageBlogPostCollection: {
          total: 3,
          items:
            skip === 0
              ? [{ slug: "blog-page-one", sys: { publishedAt: "2026-01-01T00:00:00.000Z" } }]
              : [
                  { slug: "blog-page-one", sys: { publishedAt: "2026-01-03T00:00:00.000Z" } },
                  { slug: "blog-page-two", sys: { publishedAt: "2026-01-02T00:00:00.000Z" } },
                ],
        },
      }),
    );
    allReleaseNotes.mockImplementation(({ skip }) =>
      Promise.resolve({
        componentReleaseNoteCollection: {
          total: 3,
          items:
            skip === 0
              ? [
                  {
                    slug: "release-page-one",
                    active: true,
                    publishedAt: "2026-02-01T00:00:00.000Z",
                  },
                ]
              : [
                  {
                    slug: "release-page-one",
                    active: true,
                    publishedAt: "2026-02-03T00:00:00.000Z",
                  },
                  {
                    slug: "release-page-two",
                    active: true,
                    publishedAt: "2026-02-02T00:00:00.000Z",
                  },
                ],
        },
      }),
    );

    const dynamicEntries = (await sitemap()).slice(8);
    const dynamicUrls = dynamicEntries.map((entry) => entry.url);

    expect(dynamicUrls).toEqual([
      `${SITE_URL}/en-US/blog/blog-page-one`,
      `${SITE_URL}/en-US/blog/blog-page-two`,
      `${SITE_URL}/en-US/releases/release-page-one`,
      `${SITE_URL}/en-US/releases/release-page-two`,
    ]);
    expect(sitemapPages.mock.calls.map(([variables]) => variables.skip)).toEqual([0, 1]);
    expect(allReleaseNotes.mock.calls.map(([variables]) => variables.skip)).toEqual([0, 1]);
    expect(dynamicEntries.map((entry) => entry.lastModified)).toEqual([
      new Date("2026-01-03T00:00:00.000Z"),
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-02-03T00:00:00.000Z"),
      new Date("2026-02-02T00:00:00.000Z"),
    ]);
  });

  it("falls back to the static sitemap when a later Contentful page fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sitemapPages.mockImplementation(({ skip }: { skip: number }) => {
      if (skip > 0) {
        return Promise.reject(new Error("request details must not be logged"));
      }
      return Promise.resolve({
        pageBlogPostCollection: {
          total: 2,
          items: [{ slug: "partial-result", sys: { publishedAt: "2026-01-01T00:00:00.000Z" } }],
        },
      });
    });

    const entries = await sitemap();

    expect(entries).toHaveLength(8);
    expect(entries.every((entry) => !entry.url.includes("/blog/"))).toBe(true);
    expect(sitemapPages.mock.calls.map(([variables]) => variables.skip)).toEqual([0, 1]);
    expect(errorLog).toHaveBeenCalledWith(
      "[sitemap] Dynamic content unavailable; serving static routes.",
      "Error",
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("request details must not be logged");
    errorLog.mockRestore();
  });

  it("falls back instead of looping when a collection ends before its reported total", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sitemapPages.mockImplementation(({ skip }: { skip: number }) =>
      Promise.resolve({
        pageBlogPostCollection: {
          total: 2,
          items:
            skip === 0
              ? [
                  {
                    slug: "incomplete-result",
                    sys: { publishedAt: "2026-01-01T00:00:00.000Z" },
                  },
                ]
              : [],
        },
      }),
    );

    const entries = await sitemap();

    expect(entries).toHaveLength(8);
    expect(sitemapPages.mock.calls.map(([variables]) => variables.skip)).toEqual([0, 1]);
    expect(errorLog).toHaveBeenCalledWith(
      "[sitemap] Dynamic content unavailable; serving static routes.",
      "Error",
    );
    errorLog.mockRestore();
  });
});
