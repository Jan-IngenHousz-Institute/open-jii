import type { Instrumentation } from "next";

// notFound() and redirect() travel as errors with these digests; they are answers, not failures.
const NAVIGATION_DIGESTS = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/;

function digestOf(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
    ? error.digest
    : undefined;
}

/**
 * Reports errors thrown while the server renders a page, runs a route handler or a server action.
 * Nothing else sees them: they happen before any error boundary reaches the browser.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = digestOf(error);
  // Next replaces this exact expression per runtime at build time, so it cannot go through ~/env.
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME !== "nodejs" || (digest && NAVIGATION_DIGESTS.test(digest))) {
    return;
  }

  // Loaded here so posthog-node never reaches the edge runtime.
  const { reportServerError } = await import("./lib/posthog-server");
  await reportServerError(error, {
    http_method: request.method,
    route: context.routePath,
    route_type: context.routeType,
    router: context.routerKind,
    digest,
  });
};
