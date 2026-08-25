import type { ConsoleMessage, Page, Request } from "@playwright/test";

const expectedHttpFailures = [
  {
    // Local runs deliberately have no Contentful credentials.
    url: /(?:contentful\.com|graphql\.contentful\.com)/i,
    statuses: new Set([404, 500]),
  },
  {
    // The example environment deliberately points Databricks at an unreachable endpoint.
    url: /\/api\/v1\/experiments\/[^/]+\/data(?:\/|$)/,
    statuses: new Set([500]),
  },
];

function isExpectedHttpFailure(url: string, status: number): boolean {
  return expectedHttpFailures.some(
    (failure) => failure.statuses.has(status) && failure.url.test(url),
  );
}

export interface UnexpectedBrowserErrors {
  stop(): string[];
}

export function watchForUnexpectedBrowserErrors(page: Page): UnexpectedBrowserErrors {
  const errors: string[] = [];

  const onPageError = (error: Error) => errors.push(`pageerror: ${error.message}`);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const failedResource =
      /^Failed to load resource: the server responded with a status of (\d+)/.exec(message.text());
    if (failedResource && isExpectedHttpFailure(message.location().url, Number(failedResource[1])))
      return;
    errors.push(`console.error: ${message.text()}`);
  };
  const onRequestFailed = (request: Request) => {
    if (/(?:contentful\.com|graphql\.contentful\.com)/i.test(request.url())) return;
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
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
