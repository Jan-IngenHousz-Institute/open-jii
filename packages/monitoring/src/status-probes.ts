import { z } from "zod/mini";

import { minuteOf } from "./status-history.js";

const apiHealthSchema = z.object({ status: z.literal("ok") });

/**
 * The website check's address for one minute. The web distribution keeps a page for as long as its
 * origin allows stale copies, so a fresh query string each minute makes it ask the web server.
 */
export function websiteProbeUrl(pageUrl: string, now: Date): string {
  const url = new URL(pageUrl);
  url.searchParams.set("probe", String(minuteOf(now)));
  return url.toString();
}

/** A page that renders the product's name is up; an empty 200 from a broken deploy is not. */
export function isWebsiteHealthy(body: string): boolean {
  return body.includes("openJII");
}

/** The API's anonymous health endpoint answers `{"status":"ok"}` while it serves. */
export function isApiHealthy(body: string): boolean {
  try {
    return apiHealthSchema.safeParse(JSON.parse(body)).success;
  } catch {
    return false;
  }
}
