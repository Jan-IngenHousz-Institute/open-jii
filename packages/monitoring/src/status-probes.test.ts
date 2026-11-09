import { describe, expect, it } from "vitest";

import { isApiHealthy, isWebsiteHealthy, websiteProbeUrl } from "./status-probes.js";

describe("isWebsiteHealthy", () => {
  it("is healthy when the page renders the product's name", () => {
    expect(isWebsiteHealthy("<title>openJII - Open-science platform</title>")).toBe(true);
  });

  it("is not healthy for an empty or foreign page", () => {
    expect(isWebsiteHealthy("")).toBe(false);
    expect(isWebsiteHealthy("<h1>Bad gateway</h1>")).toBe(false);
  });
});

describe("isApiHealthy", () => {
  it("is healthy when the health endpoint says ok", () => {
    expect(isApiHealthy('{"status":"ok","timestamp":"2026-11-03T12:00:00Z"}')).toBe(true);
  });

  it.each([
    ["another status", '{"status":"error"}'],
    ["no status", "{}"],
    ["a body that is not JSON", "<html>502</html>"],
    ["an empty body", ""],
  ])("is not healthy for %s", (_case, body) => {
    expect(isApiHealthy(body)).toBe(false);
  });
});

describe("websiteProbeUrl", () => {
  const page = "https://dev.example.org/en-US/verify-request?provider=email";

  it("gives each minute its own address, so the distribution cannot answer from its cache", () => {
    const first = websiteProbeUrl(page, new Date("2026-11-06T12:00:10Z"));
    const sameMinute = websiteProbeUrl(page, new Date("2026-11-06T12:00:50Z"));
    const nextMinute = websiteProbeUrl(page, new Date("2026-11-06T12:01:00Z"));

    expect(sameMinute).toBe(first);
    expect(nextMinute).not.toBe(first);
  });

  it("keeps the page's path and query and adds only the probe parameter", () => {
    const url = new URL(websiteProbeUrl(page, new Date("2026-11-06T12:00:00Z")));

    expect(url.origin + url.pathname).toBe("https://dev.example.org/en-US/verify-request");
    expect([...url.searchParams.keys()]).toEqual(["provider", "probe"]);
    expect(url.searchParams.get("provider")).toBe("email");
  });
});
