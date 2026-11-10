import type { MetadataRoute } from "next";
import { env } from "~/env";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const isIndexable = env.STATUS_INDEXABLE === "true";

  return {
    rules: isIndexable ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
  };
}
