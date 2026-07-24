import { INDEXABLE, SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";

import { locales } from "@repo/i18n/config";

export function createRobots(indexable: boolean, siteUrl: string): MetadataRoute.Robots {
  const privateRoutes = ["/api/", ...locales.map((locale) => `/${locale}/platform`)];

  if (!indexable) {
    return { rules: { userAgent: "*", allow: "/", disallow: privateRoutes } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privateRoutes,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots(INDEXABLE, SITE_URL);
}
