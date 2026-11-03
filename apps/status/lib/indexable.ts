// Crawling stays blocked unless the deploy opts in (prod only), so dev and local builds are never indexed.
export const INDEXABLE = process.env.STATUS_INDEXABLE === "true";
