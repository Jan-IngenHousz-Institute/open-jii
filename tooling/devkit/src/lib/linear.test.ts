import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createFileAudit,
  createLinearClient,
  describeOperation,
  isDestructive,
  selectsSecret,
} from "./linear.js";
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

  it("is not fooled by a leading comment or braces inside a string", () => {
    expect(
      describeOperation('# housekeeping\nmutation { issueDelete(id: "1") { success } }'),
    ).toEqual({
      kind: "mutation",
      fields: ["issueDelete"],
    });
    expect(
      describeOperation(
        'mutation { issueUpdate(id: "1", input: { title: "}" }) { success } issueDelete(id: "1") { success } }',
      ).fields,
    ).toEqual(["issueUpdate", "issueDelete"]);
  });
});

describe("isDestructive", () => {
  it("flags deletes and archives, not retires, updates or unarchives", () => {
    expect(isDestructive("issueDelete")).toBe(true);
    expect(isDestructive("issueArchive")).toBe(true);
    expect(isDestructive("projectArchive")).toBe(true);
    expect(isDestructive("issueLabelRetire")).toBe(false);
    expect(isDestructive("issueUpdate")).toBe(false);
    expect(isDestructive("issueUnarchive")).toBe(false);
  });
});

describe("selectsSecret", () => {
  it("catches the secret fields wherever they sit in the selection", () => {
    expect(selectsSecret("{ webhooks { nodes { id secret } } }")).toBe(true);
    expect(selectsSecret("{ webhooks { nodes { id\nsecret\n} } }")).toBe(true);
    expect(selectsSecret("{ oauth { clientSecret } }")).toBe(true);
  });

  it("ignores the word inside string arguments, block strings, comments and longer names", () => {
    expect(selectsSecret('{ issueSearch(query: "secret rotation") { nodes { id } } }')).toBe(false);
    expect(
      selectsSecret('mutation { issueCreate(input: { description: """a secret""" }) { success } }'),
    ).toBe(false);
    expect(selectsSecret("# secret\n{ viewer { id } }")).toBe(false);
    expect(selectsSecret("{ webhooks { nodes { id secretless } } }")).toBe(false);
  });
});

describe("createLinearClient", () => {
  it("refuses to select a secret before any request is made", async () => {
    const request = vi.fn<typeof fetch>();
    const client = createLinearClient({ apiKey: "k", request, allowDestructive: true });

    await expect(client.query("{ webhooks { nodes { secret } } }")).rejects.toThrow(
      "Refusing to select secret",
    );
    expect(request).not.toHaveBeenCalled();
  });

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
    await expect(
      client.query('# tidy\nmutation { issueArchive(id: "1") { success } }'),
    ).rejects.toThrow("Refusing destructive mutation issueArchive");
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

describe("createFileAudit", () => {
  it("names the session and checkout on every line, and marks destructive mutations", async () => {
    const root = await mkdtemp(join(tmpdir(), "devkit-audit-"));
    const audit = createFileAudit(root, { CLAUDE_CODE_SESSION_ID: "sess-1" });

    await audit({ at: "t1", ok: true, fields: ["issueCreate"], variables: "{}" });
    await audit({ at: "t2", ok: false, fields: ["projectUpdateArchive"], variables: '{"id":"x"}' });

    expect(await readFile(join(root, ".claude", "linear-writes.log"), "utf8")).toBe(
      `t1 ok issueCreate session=sess-1 root=${root} {}\n` +
        `t2 failed projectUpdateArchive session=sess-1 root=${root} destructive {"id":"x"}\n`,
    );
  });

  it("records a plain shell when no agent session is set", async () => {
    const root = await mkdtemp(join(tmpdir(), "devkit-audit-"));

    await createFileAudit(
      root,
      {},
    )({ at: "t", ok: true, fields: ["issueUpdate"], variables: "{}" });

    expect(await readFile(join(root, ".claude", "linear-writes.log"), "utf8")).toContain(
      "session=shell",
    );
  });
});
