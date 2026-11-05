import { describe, expect, it } from "vitest";

import { isApiHealthy, isWebsiteHealthy } from "./status-probes.js";

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
