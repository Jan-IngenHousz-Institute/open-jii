import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createPostHogClient, createPostHogFileAudit, issueUrl, rowsOf } from "./posthog.js";
import type { PostHogAuditEntry } from "./posthog.js";

function respond(status: number, body: unknown): Response {
  return new Response(body === null ? "" : JSON.stringify(body), { status });
}

describe("createPostHogClient", () => {
  it("sends HogQL to the project's query endpoint with the key as a bearer token", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respond(200, { columns: ["n"], results: [[1]] }));
    const client = createPostHogClient({ apiKey: "phx_secret", request });

    const result = await client.query("SELECT 1 AS n");

    expect(result).toEqual({ columns: ["n"], results: [[1]] });
    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe("https://eu.posthog.com/api/projects/80726/query/");
    expect(init?.headers).toMatchObject({ authorization: "Bearer phx_secret" });
    expect(init?.body).toBe(
      JSON.stringify({ query: { kind: "HogQLQuery", query: "SELECT 1 AS n" } }),
    );
  });

  it("follows an absolute pagination URL without prefixing the host twice", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(respond(200, { results: [] }));
    const client = createPostHogClient({ apiKey: "k", request });

    await client.get("https://eu.posthog.com/api/projects/80726/error_tracking/issues/?offset=100");

    expect(request.mock.calls[0]?.[0]).toBe(
      "https://eu.posthog.com/api/projects/80726/error_tracking/issues/?offset=100",
    );
  });

  it("explains a refused key without echoing it", async () => {
    const client = createPostHogClient({
      apiKey: "phx_secret",
      request: vi.fn<typeof fetch>().mockResolvedValue(respond(403, { detail: "nope" })),
    });

    const failure = client.query("SELECT 1");

    await expect(failure).rejects.toThrow("pnpm posthog:auth");
    await expect(failure).rejects.not.toThrow("phx_secret");
  });

  it("audits a status change whether or not PostHog accepts it", async () => {
    const audited: PostHogAuditEntry[] = [];
    const client = createPostHogClient({
      apiKey: "k",
      request: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(respond(200, { status: "resolved" }))
        .mockResolvedValueOnce(respond(500, { detail: "down" })),
      audit: (entry) => {
        audited.push(entry);
      },
    });

    await client.setIssueStatus("issue-1", "resolved");
    await expect(client.setIssueStatus("issue-2", "suppressed")).rejects.toThrow("500");

    expect(audited.map(({ ok, target, detail }) => ({ ok, target, detail }))).toEqual([
      { ok: true, target: "issue-1", detail: "resolved" },
      { ok: false, target: "issue-2", detail: "suppressed" },
    ]);
  });
});

describe("createPostHogFileAudit", () => {
  it("appends one line per write naming the session and checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "devkit-posthog-"));
    const audit = createPostHogFileAudit(root, { CLAUDE_CODE_SESSION_ID: "session-7" });

    await audit({
      at: "2026-09-27T00:00:00Z",
      ok: true,
      action: "issue.status",
      target: "i",
      detail: "resolved",
    });

    expect(await readFile(join(root, ".claude", "posthog-writes.log"), "utf8")).toBe(
      `2026-09-27T00:00:00Z ok issue.status i resolved session=session-7 root=${root}\n`,
    );
  });
});

describe("rowsOf", () => {
  it("names each value by its column", () => {
    expect(
      rowsOf({
        columns: ["id", "n"],
        results: [
          ["a", 1],
          ["b", 2],
        ],
      }),
    ).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });
});

describe("issueUrl", () => {
  it("links to the issue in the openJII project", () => {
    expect(issueUrl("abc")).toBe("https://eu.posthog.com/project/80726/error_tracking/abc");
  });
});
