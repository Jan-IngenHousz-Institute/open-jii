import { SITE_URL } from "@/lib/site-url";
import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/api", "/api/rest", "/api/mqtt"];
  const docRoutes = source.getPages().map((page) => page.url);

  return [...staticRoutes, ...docRoutes].map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
  }));
}
