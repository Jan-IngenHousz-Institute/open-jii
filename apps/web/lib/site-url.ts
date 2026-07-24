import { env } from "~/env";

export const SITE_URL = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");

// Only the production root domain is crawlable. Local and dev deployments use
// the same production-mode build, so NODE_ENV alone cannot distinguish them.
export function isIndexableSiteUrl(siteUrl: string): boolean {
  return new URL(siteUrl).hostname === "openjii.org";
}

export const INDEXABLE = isIndexableSiteUrl(SITE_URL);
