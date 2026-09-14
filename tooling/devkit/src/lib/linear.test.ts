import { describe, expect, it, vi } from "vitest";

import { createLinearClient, describeOperation, isDestructive } from "./linear.js";
import type { AuditEntry } from "./linear.js";

function okResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200 });
}

describe("describeOperation", () => {
  it("names the top-level fields of a query with variables", () => {
    const summary = describeOperation(
      "query($after: String) { issueLabels(first: 100, after: $after) { nodes { id } } teams { nodes { id } } }",
    );

    expect(summary).toEqual({ kind: "query", fields: ["issueLabels", "teams"] });
  });

  it("treats an anonymous selection set as a query", () => {
    expect(describeOperation("{ viewer { name } }")).toEqual({ kind: "query", fields: ["viewer"] });
  });

  it("sees through aliases and ignores arguments", () => {
    const summary = describeOperation(
      'mutation($id: String!) { first: issueUpdate(id: $id, input: { title: "x" }) { success } issueDelete(id: $id) { success } }',
    );

    expect(summary).toEqual({ kind: "mutation", fields: ["issueUpdate", "issueDelete"] });
  });
});

describe("isDestructive", () => {
  it("flags deletes and archives, not retires or updates", () => {
    expect(isDestructive("issueDelete")).toBe(true);
    expect(isDestructive("issueArchive")).toBe(true);
    expect(isDestructive("issueLabelRetire")).toBe(false);
    expect(isDestructive("issueUpdate")).toBe(false);
  });
});

describe("createLinearClient", () => {
  it("sends the key bare in the Authorization header", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(okResponse({ viewer: { name: "P" } }));
    const client = createLinearClient({ apiKey: "lin_api_test", request });

    await expect(client.query("{ viewer { name } }")).resolves.toEqual({ viewer: { name: "P" } });

    const init = request.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({
      "content-type": "application/json",
      authorization: "lin_api_test",
    });
  });

  it("refuses a destructive mutation before any request is made", async () => {
    const request = vi.fn<typeof fetch>();
    const client = createLinearClient({ apiKey: "k", request });

    await expect(
      client.query("mutation($id: String!) { issueDelete(id: $id) { success } }", { id: "1" }),
    ).rejects.toThrow("Refusing destructive mutation issueDelete");
    expect(request).not.toHaveBeenCalled();
  });

  it("allows a destructive mutation only when told to", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(okResponse({ issueDelete: { success: true } }));
    const client = createLinearClient({ apiKey: "k", request, allowDestructive: true });

    await client.query('mutation { issueDelete(id: "1") { success } }');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("audits mutations, with their outcome, and not queries", async () => {
    const entries: AuditEntry[] = [];
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(okResponse({ viewer: { name: "P" } }))
      .mockResolvedValueOnce(okResponse({ issueUpdate: { success: true } }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const client = createLinearClient({
      apiKey: "k",
      request,
      audit: (entry) => {
        entries.push(entry);
      },
    });

    await client.query("{ viewer { name } }");
    await client.query("mutation($id: String!) { issueUpdate(id: $id) { success } }", { id: "1" });
    await expect(client.query('mutation { issueUpdate(id: "2") { success } }')).rejects.toThrow(
      "Linear returned 500",
    );

    expect(entries.map((entry) => [entry.fields, entry.ok])).toEqual([
      [["issueUpdate"], true],
      [["issueUpdate"], false],
    ]);
    expect(entries[0].variables).toBe('{"id":"1"}');
  });

  it("surfaces GraphQL errors as one message", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: "bad" }, { message: "worse" }] })),
      );
    const client = createLinearClient({ apiKey: "k", request });

    await expect(client.query("{ viewer { name } }")).rejects.toThrow(
      "Linear query failed: bad; worse",
    );
  });
});
