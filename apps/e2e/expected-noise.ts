import type { ConsoleMessage, Page, Request } from "@playwright/test";

const expectedConsoleErrors = [
  // Degraded local data routes can report failed resource loads while their page chrome remains usable.
  /^Failed to load resource: the server responded with a status of (404|500)/,
];

const expectedFailedRequests = [
  // Local runs deliberately have no Contentful credentials.
  /(?:contentful\.com|graphql\.contentful\.com)/i,
  // Local runs deliberately have no Databricks connectivity.
  /\/api\/v1\/experiments\/[^/]+\/data(?:\/|$)/,
];

export interface UnexpectedBrowserErrors {
  stop(): string[];
}

export function watchForUnexpectedBrowserErrors(page: Page): UnexpectedBrowserErrors {
  const errors: string[] = [];

  const onPageError = (error: Error) => errors.push(`pageerror: ${error.message}`);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    if (expectedConsoleErrors.some((pattern) => pattern.test(message.text()))) return;
    errors.push(`console.error: ${message.text()}`);
  };
  const onRequestFailed = (request: Request) => {
    if (expectedFailedRequests.some((pattern) => pattern.test(request.url()))) return;
    errors.push(
      `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
    );
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);

  return {
    stop() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      return errors;
    },
  };
}
