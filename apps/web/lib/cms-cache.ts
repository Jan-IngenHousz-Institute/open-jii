/**
 * How long a published Contentful read is reused across requests. An hour holds each query to 24
 * reads a day however often the pages that use it regenerate.
 */
export const PUBLISHED_CONTENT_SECONDS = 3600;
