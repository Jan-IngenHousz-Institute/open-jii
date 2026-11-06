import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { FIXTURES, FixtureServer, parseArgs } from "./status-fixtures.js";

describe("parseArgs", () => {
  it("serves the operational sample on port 3031 by default", () => {
    expect(parseArgs([])).toEqual({ name: "operational", port: 3031 });
    expect(parseArgs(["--", "incident", "--port", "4000"])).toEqual({
      name: "incident",
      port: 4000,
    });
  });

  it("refuses an unknown sample, a second sample or a bad port", () => {
    expect(() => parseArgs(["outage"])).toThrow("Usage");
    expect(() => parseArgs(["incident", "stale"])).toThrow("Usage");
    expect(() => parseArgs(["--port", "zero"])).toThrow("Usage");
  });
});

describe("FixtureServer", () => {
  const sample = FIXTURES.incident;
  const generatedAt = Date.parse(sample.generatedAt);
  let close: (() => void) | undefined;

  afterEach(() => close?.());

  async function serve(fixtures: FixtureServer) {
    const server = createServer((request, response) => fixtures.handle(request, response));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    close = () => server.close();
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("the server has no port");
    return `http://localhost:${address.port}`;
  }

  it("starts its clock two minutes after the sample was generated and lets it run", () => {
    const fixtures = new FixtureServer(sample, 1_000);

    expect(Date.parse(fixtures.dateAt(1_000))).toBe(generatedAt + 120_000);
    expect(Date.parse(fixtures.dateAt(61_000))).toBe(generatedAt + 180_000);
  });

  it("answers the data file with the sample, uncached, on the sample's clock", async () => {
    const origin = await serve(new FixtureServer(sample));

    const response = await fetch(`${origin}/data/status.json`);

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Date.parse(response.headers.get("date") ?? "")).toBeLessThan(generatedAt + 125_000);
    expect(await response.json()).toEqual(sample);
  });

  it("answers anything else with not found", async () => {
    const origin = await serve(new FixtureServer(sample));

    expect((await fetch(`${origin}/index.html`)).status).toBe(404);
  });
});
