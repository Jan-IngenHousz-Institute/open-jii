import { describe, expect, it } from "vitest";

import { parseArgs } from "./grafana-get.js";

describe("parseArgs", () => {
  it("takes an environment, an API path and an optional output file", () => {
    expect(parseArgs(["prod", "/api/annotations?type=alert"])).toEqual({
      environment: "prod",
      path: "/api/annotations?type=alert",
      output: null,
    });
    expect(parseArgs(["dev", "/api/dashboards/uid/x", "--output", "out.json"])).toMatchObject({
      output: "out.json",
    });
  });

  it("refuses anything outside the API, a missing output, or an unknown environment", () => {
    expect(() => parseArgs(["prod", "/logout"])).toThrow("Usage");
    expect(() => parseArgs(["prod"])).toThrow("Usage");
    expect(() => parseArgs(["prod", "/api/user", "--output"])).toThrow("--output");
    expect(() => parseArgs(["staging", "/api/user"])).toThrow("prod or dev");
  });
});
