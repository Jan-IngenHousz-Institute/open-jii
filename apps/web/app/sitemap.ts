import { SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { getContentfulClients } from "~/lib/contentful";

import { defaultLocale } from "@repo/i18n/config";

export const dynamic = "force-dynamic";

const CONTENTFUL_PAGE_SIZE = 100;
const MAX_SITEMAP_URLS = 50_000;
// Bound each collection at the sitemap protocol ceiling. The final combined URL count is checked
// separately so inconsistent Contentful totals cannot cause an infinite loop or invalid document.
const MAX_CONTENTFUL_PAGE_REQUESTS = 500;

const publicRoutes = [
  "",
  "/about",
  "/blog",
  "/cookie-policy",
  "/faq",
  "/policies",
  "/releases",
  "/terms-and-conditions",
] as const;

function localizedUrl(locale: string, route: string): string {
  return `${SITE_URL}/${locale}${route}`;
}

function languageAlternates(url: string): Record<string, string> {
  return {
    [defaultLocale]: url,
    "x-default": url,
  };
}

function staticSitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => {
    // Locale availability is request-time feature-flagged. Static crawler output must only
    // advertise the locale that is guaranteed to resolve in every deployment.
    const defaultUrl = localizedUrl(defaultLocale, route);

    return {
      url: defaultUrl,
      changeFrequency:
        route === "" || route === "/blog" || route === "/releases" ? "weekly" : "monthly",
      priority: route === "" ? 1 : 0.7,
      alternates: { languages: languageAlternates(defaultUrl) },
    };
  });
}

function publishedDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDynamicEntry(
  entries: Map<string, Date>,
  routePrefix: "/blog" | "/releases",
  slugValue: unknown,
  publishedAtValue: unknown,
  now: Date,
): void {
  if (typeof slugValue !== "string") {
    return;
  }

  const slug = slugValue.trim();
  const lastModified = publishedDate(publishedAtValue);
  if (!slug || !lastModified || lastModified > now) {
    return;
  }

  const url = localizedUrl(defaultLocale, `${routePrefix}/${slug}`);
  const existing = entries.get(url);
  if (!existing || lastModified > existing) {
    entries.set(url, lastModified);
  }
}

interface ContentfulCollectionPage<T> {
  items: (T | null)[];
  total?: number;
}

async function fetchAllCollectionItems<T>(
  fetchPage: (
    limit: number,
    skip: number,
  ) => Promise<ContentfulCollectionPage<T> | null | undefined>,
): Promise<(T | null)[]> {
  const allItems: (T | null)[] = [];
  let skip = 0;

  for (let requestCount = 0; requestCount < MAX_CONTENTFUL_PAGE_REQUESTS; requestCount += 1) {
    const collection = await fetchPage(CONTENTFUL_PAGE_SIZE, skip);
    const pageItems = collection?.items ?? [];
    allItems.push(...pageItems);

    if (pageItems.length === 0) {
      const reportedTotal = collection?.total;
      if (
        typeof reportedTotal === "number" &&
        Number.isSafeInteger(reportedTotal) &&
        reportedTotal > skip
      ) {
        throw new Error("Contentful pagination ended before the reported total");
      }
      return allItems;
    }

    const nextSkip = skip + pageItems.length;
    const total = collection?.total;
    if (typeof total === "number" && Number.isSafeInteger(total) && total >= 0) {
      if (nextSkip >= total) {
        return allItems;
      }
    } else if (pageItems.length < CONTENTFUL_PAGE_SIZE) {
      return allItems;
    }

    if (nextSkip <= skip) {
      return allItems;
    }
    skip = nextSkip;
  }

  throw new Error("Contentful pagination exceeded the sitemap safety limit");
}

const getCachedSitemapContent = unstable_cache(
  async () => {
    const { client } = await getContentfulClients();
    const now = new Date();
    const [blogPosts, releases] = await Promise.all([
      fetchAllCollectionItems(async (limit, skip) => {
        const data = await client.sitemapPages({ locale: defaultLocale, limit, skip });
        return data.pageBlogPostCollection;
      }),
      fetchAllCollectionItems(async (limit, skip) => {
        const data = await client.allReleaseNotes({
          locale: defaultLocale,
          now: now.toISOString(),
          preview: false,
          limit,
          skip,
        });
        return data.componentReleaseNoteCollection;
      }),
    ]);

    return { blogPosts, releases };
  },
  ["sitemap-contentful"],
  { revalidate: 300 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallback = staticSitemap();

  try {
    const now = new Date();
    const { blogPosts, releases } = await getCachedSitemapContent();
    const dynamicEntries = new Map<string, Date>();

    for (const post of blogPosts) {
      addDynamicEntry(dynamicEntries, "/blog", post?.slug, post?.sys.publishedAt, now);
    }

    for (const release of releases) {
      if (release?.active !== true) {
        continue;
      }
      addDynamicEntry(dynamicEntries, "/releases", release.slug, release.publishedAt, now);
    }

    if (fallback.length + dynamicEntries.size > MAX_SITEMAP_URLS) {
      throw new Error("Dynamic content exceeds the sitemap URL limit");
    }

    return [
      ...fallback,
      ...Array.from(dynamicEntries, ([url, lastModified]) => ({
        url,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: { languages: languageAlternates(url) },
      })),
    ];
  } catch (error) {
    // Do not expose Contentful/AWS error details, which may contain request or secret metadata.
    console.error(
      "[sitemap] Dynamic content unavailable; serving static routes.",
      error instanceof Error ? error.name : typeof error,
    );
    return fallback;
  }
}
