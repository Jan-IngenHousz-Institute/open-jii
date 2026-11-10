/**
 * How long a published Contentful read is reused across requests. Pages regenerate every five
 * minutes for the alerts bar, and an hour holds each other query to 24 reads a day however often
 * that happens.
 */
export const PUBLISHED_CONTENT_SECONDS = 3600;
