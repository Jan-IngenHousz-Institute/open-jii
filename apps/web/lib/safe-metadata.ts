import type { Metadata } from "next";

/**
 * Wraps a CMS-backed `generateMetadata` so a Contentful outage degrades to the
 * root layout's fallback metadata instead of throwing.
 *
 * Errors thrown in `generateMetadata` run outside React rendering, so they are
 * NOT caught by `error.tsx` and surface as a bare HTTP 500 — bypassing the
 * maintenance page. Swallowing them here lets the page body's own fetch throw
 * instead, which the segment error boundary catches and renders as maintenance.
 */
export async function safeMetadata(build: () => Promise<Metadata>): Promise<Metadata> {
  try {
    return await build();
  } catch (error) {
    console.error("generateMetadata failed; falling back to default metadata:", error);
    return {};
  }
}
