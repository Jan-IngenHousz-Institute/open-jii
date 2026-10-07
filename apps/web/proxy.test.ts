import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isFeatureFlagEnabledForRequest } from "~/lib/posthog-server";

import { config, proxy } from "./proxy";

vi.mock("~/lib/posthog-server", () => ({
  isFeatureFlagEnabledForRequest: vi.fn().mockResolvedValue(true),
}));

const flag = vi.mocked(isFeatureFlagEnabledForRequest);

describe("locale proxy", () => {
  afterEach(() => {
    flag.mockReset();
    flag.mockResolvedValue(true);
  });

  it.each(["/opengraph-image", "/opengraph-image/", "/twitter-image", "/twitter-image/"])(
    "does not localize the root metadata image route %s",
    async (pathname) => {
      const response = await proxy(new NextRequest(`https://openjii.org${pathname}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("still redirects ordinary unlocalized routes to the default locale", async () => {
    const response = await proxy(new NextRequest("https://openjii.org/about?source=e2e"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://openjii.org/en-US/about?source=e2e");
  });

  it("passes a default-locale route's path on without asking PostHog", async () => {
    const response = await proxy(
      new NextRequest("https://openjii.org/en-US/login?callbackUrl=%2Fplatform"),
    );

    expect(response.headers.get("x-middleware-request-x-current-path")).toBe("/en-US/login");
    expect(flag).not.toHaveBeenCalled();
  });

  it("lets a viewer with multi-language through to another locale", async () => {
    const request = new NextRequest("https://openjii.org/de-DE/about", {
      headers: { cookie: "session=abc" },
    });

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-current-path")).toBe("/de-DE/about");
    expect(flag).toHaveBeenCalledWith("multi-language", request.headers);
  });

  it("sends a viewer without multi-language to the same page in the default locale", async () => {
    flag.mockResolvedValue(false);

    const response = await proxy(
      new NextRequest("https://openjii.org/de-DE/login?callbackUrl=%2Fplatform"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://openjii.org/en-US/login?callbackUrl=%2Fplatform",
    );
  });

  it("leaves a client navigation within the locale to the document load that passed the gate", async () => {
    flag.mockResolvedValue(false);

    const response = await proxy(
      new NextRequest("https://openjii.org/de-DE/about", {
        headers: { rsc: "1", referer: "https://openjii.org/de-DE/blog" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(flag).not.toHaveBeenCalled();
  });

  it("checks a client navigation into the locale from another one", async () => {
    flag.mockResolvedValue(false);

    const response = await proxy(
      new NextRequest("https://openjii.org/de-DE/about", {
        headers: { rsc: "1", referer: "https://openjii.org/en-US/blog" },
      }),
    );

    expect(response.headers.get("location")).toBe("https://openjii.org/en-US/about");
  });

  it("keeps the bare locale root in the default locale", async () => {
    flag.mockResolvedValue(false);

    const response = await proxy(new NextRequest("https://openjii.org/de-DE"));

    expect(response.headers.get("location")).toBe("https://openjii.org/en-US");
  });
});

describe("locale proxy matcher", () => {
  // The matcher is a regular expression over the path. Next's own matcher helper is not used
  // here: it loads Next's server runtime into the shared test worker and breaks later files.
  const runsFor = (path: string) =>
    config.matcher.some((matcher) => new RegExp(`^${matcher}$`).test(path));

  it.each(["/de-DE/releases/v2.71.0", "/en-US/about", "/", "/de-DE"])(
    "runs for page %s",
    (path) => {
      expect(runsFor(path)).toBe(true);
    },
  );

  it.each([
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/logo-jii-yellow.svg",
    "/login-background-1.jpg",
    "/_next/static/chunks/app.js",
    "/api/enable-draft",
    "/ingest/flags",
  ])("skips %s", (path) => {
    expect(runsFor(path)).toBe(false);
  });
});
