export const SITE_URL = process.env.DOCS_BASE_URL ?? "https://docs.openjii.org";

// Crawling stays blocked unless the deploy explicitly opts in (prod only);
// dev and local builds must never be indexed alongside prod.
export const INDEXABLE = process.env.DOCS_INDEXABLE === "true";
