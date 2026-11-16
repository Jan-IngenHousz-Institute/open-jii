import { describe, expect, it } from "vitest";

import { getSiblingAppOrigins, resolveAuthCallback } from "./redirects";

const settings = { baseUrl: "https://openjii.org", environment: "prod" };

describe("auth return addresses", () => {
  it.each([
    "/platform/experiments?tab=shared#recent",
    "/en-US/platform",
    "HTTPS://lab.openjii.org/login/openjii",
    "https://openjii.org/platform",
    "https://lab.openjii.org/login/openjii?redirect=%2Finstruments#next",
  ])("keeps the approved address %s", (url) => {
    expect(resolveAuthCallback(url, settings)).toBe(
      url.startsWith("HTTPS:") ? new URL(url).href : url,
    );
  });

  it.each([
    undefined,
    "",
    "https://example.com",
    "https://equipment.openjii.org/login/openjii",
    "https://openjii.org//example.com",
    "//example.com",
    "/..//example.com",
    "https://lab.openjii.org.example.com",
    "https://lab.openjii.org:444",
    "http://lab.openjii.org",
    "https://user@lab.openjii.org",
    "javascript:alert(1)",
    "data:text/html,test",
    "openjii://platform",
    "platform",
    "https:lab.openjii.org",
    "https://lab.openjii.org\\@example.com",
    "/\\example.com",
    "/\n/example.com",
    " https://lab.openjii.org",
    "http://localhost:3100/login/openjii",
    "https://[",
  ])("falls back to the platform for %s", (url) => {
    expect(resolveAuthCallback(url, settings)).toBe("/platform");
  });

  it.each(["dev", "local"])("allows local Lab only in %s", (environment) => {
    expect(
      resolveAuthCallback("http://localhost:3100/login/openjii", { ...settings, environment }),
    ).toBe("http://localhost:3100/login/openjii");
  });

  it.each(["dev", "local"])("refuses production Lab in %s", (environment) => {
    expect(
      resolveAuthCallback("https://lab.openjii.org/login/openjii", {
        ...settings,
        environment,
      }),
    ).toBe("/platform");
  });

  it("keeps the production sibling allowlist explicit and refuses unknown environments", () => {
    expect(getSiblingAppOrigins("prod")).toEqual(["https://lab.openjii.org"]);
    expect(getSiblingAppOrigins("unknown")).toEqual([]);
    expect(
      resolveAuthCallback("https://lab.openjii.org", { ...settings, environment: "unknown" }),
    ).toBe("/platform");
  });
});
