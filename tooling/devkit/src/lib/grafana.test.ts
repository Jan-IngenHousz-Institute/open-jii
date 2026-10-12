import { describe, expect, it, vi } from "vitest";

import { createGrafanaClient, grafanaKeys, parseGrafanaEnvironment, rulesOf } from "./grafana.js";

function respond(status: number, body: unknown): Response {
  return new Response(body === null ? "" : JSON.stringify(body), { status });
}

const url = "https://g-example.grafana-workspace.eu-central-1.amazonaws.com";

describe("createGrafanaClient", () => {
  it("reads the workspace's API with the token as a bearer token", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(respond(200, { ok: true })));
    const client = createGrafanaClient({ url, token: "glsa_secret", environment: "prod", request });

    await client.get("/api/annotations?type=alert");
    await client.query({ from: "1", to: "2", queries: [{ refId: "A" }] });

    const [getUrl, getInit] = request.mock.calls[0] ?? [];
    expect(getUrl).toBe(`${url}/api/annotations?type=alert`);
    expect(getInit?.method).toBe("GET");
    expect(getInit?.headers).toMatchObject({ authorization: "Bearer glsa_secret" });
    const [queryUrl, queryInit] = request.mock.calls[1] ?? [];
    expect(queryUrl).toBe(`${url}/api/ds/query`);
    expect(queryInit?.method).toBe("POST");
  });

  it("sends the token to the workspace's own host and API only", async () => {
    const request = vi.fn<typeof fetch>();
    const client = createGrafanaClient({ url, token: "t", environment: "prod", request });

    await expect(client.get("https://attacker.example/api/user")).rejects.toThrow(
      "Refusing to send the Grafana token",
    );
    await expect(client.get("/logout")).rejects.toThrow("not under /api/");
    expect(request).not.toHaveBeenCalled();
  });

  it("tells an expired token from a request the Viewer role may not make, without echoing it", async () => {
    const expired = createGrafanaClient({
      url,
      token: "glsa_secret",
      environment: "dev",
      request: vi.fn<typeof fetch>().mockResolvedValue(respond(401, { message: "invalid" })),
    });
    const forbidden = createGrafanaClient({
      url,
      token: "glsa_secret",
      environment: "dev",
      request: vi.fn<typeof fetch>().mockResolvedValue(respond(403, { message: "no" })),
    });

    const failure = expired.get("/api/user");
    await expect(failure).rejects.toThrow("pnpm grafana:auth dev");
    await expect(failure).rejects.not.toThrow("glsa_secret");
    await expect(forbidden.get("/api/admin/users")).rejects.toThrow("Viewer account");
  });
});

describe("grafanaKeys", () => {
  it("names each environment's variables and how a person stores them", () => {
    const keys = grafanaKeys("prod");

    expect([keys.url.variable, keys.token.variable]).toEqual([
      "GRAFANA_PROD_URL",
      "GRAFANA_PROD_TOKEN",
    ]);
    expect(keys.token.remedy).toContain("pnpm grafana:auth prod");
  });
});

describe("parseGrafanaEnvironment", () => {
  it("takes prod or dev and nothing else", () => {
    expect(parseGrafanaEnvironment("dev")).toBe("dev");
    expect(() => parseGrafanaEnvironment("staging")).toThrow("prod or dev");
    expect(() => parseGrafanaEnvironment(undefined)).toThrow("prod or dev");
  });
});

describe("rulesOf", () => {
  it("flattens the groups, with each rule's labels and when it became active", () => {
    const rules = rulesOf({
      data: {
        groups: [
          {
            name: "ingest_path",
            rules: [
              {
                name: "Ingest Stalled",
                state: "firing",
                health: "ok",
                labels: { metric_id: "ingest-idle", severity: "warning" },
                alerts: [
                  { activeAt: "2026-09-29T08:00:00Z" },
                  { activeAt: "2026-09-28T22:30:00.123Z" },
                ],
              },
              {
                name: "Macro Backlog",
                state: "inactive",
                health: "error",
                lastError: "failed to query",
                labels: {},
                alerts: [{ activeAt: "0001-01-01T00:00:00Z" }],
              },
            ],
          },
        ],
      },
    });

    expect(rules).toEqual([
      {
        group: "ingest_path",
        name: "Ingest Stalled",
        metricId: "ingest-idle",
        severity: "warning",
        state: "firing",
        health: "ok",
        activeSince: "2026-09-28T22:30:00.123Z",
        lastError: null,
      },
      {
        group: "ingest_path",
        name: "Macro Backlog",
        metricId: null,
        severity: null,
        state: "inactive",
        health: "error",
        activeSince: null,
        lastError: "failed to query",
      },
    ]);
  });

  it("reads an unexpected answer as no rules", () => {
    expect(rulesOf({ status: "error" })).toEqual([]);
  });
});
