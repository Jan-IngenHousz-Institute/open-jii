import type { MetadataRoute } from "next";
import { INDEXABLE } from "~/lib/indexable";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return { rules: INDEXABLE ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" } };
}
