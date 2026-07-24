import { INDEXABLE, SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";

import { locales } from "@repo/i18n/config";

export function createRobots(indexable: boolean, siteUrl: string): MetadataRoute.Robots {
  if (!indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...locales.map((locale) => `/${locale}/platform`)],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots(INDEXABLE, SITE_URL);
}
