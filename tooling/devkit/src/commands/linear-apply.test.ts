import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { applyChanges, groupChanges, parseArgs, parseChangeFile } from "./linear-apply.js";

const issueA = "11111111-1111-4111-8111-111111111111";
const issueB = "22222222-2222-4222-8222-222222222222";
const issueC = "33333333-3333-4333-8333-333333333333";

interface RecordedCall {
  document: string;
  variables: Record<string, unknown>;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixtureClient(
  answer: (document: string, variables: Record<string, unknown>) => unknown,
): LinearClient {
  return {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> =>
      Promise.resolve(answer(document, variables) as T),
  };
}

function recordingClient(results: readonly unknown[]): {
  client: LinearClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const client = fixtureClient((document, variables) => {
    calls.push({ document, variables });
    return results[calls.length - 1] ?? { issueBatchUpdate: { success: false } };
  });
  return { client, calls };
}

describe("parseChangeFile", () => {
  it("accepts rows that change something and keeps the reason", () => {
    const rows = parseChangeFile(
      JSON.stringify([
        { issueId: issueA, identifier: "OJD-1", addedLabelIds: ["l1"], why: "no type" },
        { issueId: issueB, projectId: "p1" },
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ issueId: issueA, identifier: "OJD-1", why: "no type" });
  });

  it("rejects an OJD identifier where a UUID is required", () => {
    expect(() => parseChangeFile(JSON.stringify([{ issueId: "OJD-1", projectId: "p1" }]))).toThrow(
      "must be the issue's UUID",
    );
  });

  it("accepts an identifier, a state name and a comment in place of ids", () => {
    const rows = parseChangeFile(
      JSON.stringify([
        { identifier: "OJD-7", state: "Ready For Prod", comment: " Verified on dev. " },
        { identifier: "OJD-8", comment: "Partly verified." },
      ]),
    );

    expect(rows[0]).toMatchObject({
      identifier: "OJD-7",
      state: "Ready For Prod",
      comment: "Verified on dev.",
    });
    expect(rows[1]).toMatchObject({ identifier: "OJD-8", comment: "Partly verified." });
  });

  it("rejects a row with neither id nor identifier, or with both state forms", () => {
    expect(() => parseChangeFile(JSON.stringify([{ stateId: "s1" }]))).toThrow("OJD-####");
    expect(() =>
      parseChangeFile(JSON.stringify([{ identifier: "OJD-1", state: "Done", stateId: "s1" }])),
    ).toThrow('both "state" and "stateId"');
  });

  it("rejects a row that changes nothing", () => {
    expect(() => parseChangeFile(JSON.stringify([{ issueId: issueA, addedLabelIds: [] }]))).toThrow(
      "changes nothing",
    );
  });

  it("rejects anything that is not an array of objects", () => {
    expect(() => parseChangeFile("{}")).toThrow("JSON array");
    expect(() => parseChangeFile("[1]")).toThrow("expected an object");
  });
});

describe("groupChanges", () => {
  it("groups rows by identical update regardless of label order", () => {
    const groups = groupChanges([
      { issueId: issueA, addedLabelIds: ["l1", "l2"] },
      { issueId: issueB, addedLabelIds: ["l2", "l1"] },
      { issueId: issueC, addedLabelIds: ["l1"], projectId: "p1" },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      update: { addedLabelIds: ["l1", "l2"] },
      ids: [issueA, issueB],
      identifiers: [issueA, issueB],
    });
  });
});

describe("applyChanges", () => {
  const rows = [
    { issueId: issueA, identifier: "OJD-1", addedLabelIds: ["l1"] },
    { issueId: issueB, identifier: "OJD-2", addedLabelIds: ["l1"] },
    { issueId: issueC, identifier: "OJD-3", stateId: "s1" },
  ];

  it("sends nothing on a dry run", async () => {
    const { client, calls } = recordingClient([]);
    const lines: string[] = [];

    await applyChanges(rows, false, { client, write: (text) => lines.push(text), batchSize: 50 });

    expect(calls).toHaveLength(0);
    expect(lines.join("")).toContain("3 row(s) in 2 distinct update(s)");
    expect(lines.join("")).toContain("dry run");
  });

  it("writes one batch per chunk and stops at the first failure", async () => {
    const { client, calls } = recordingClient([
      { issueBatchUpdate: { success: true } },
      { issueBatchUpdate: { success: true } },
      { issueBatchUpdate: { success: false } },
    ]);

    await expect(
      applyChanges(rows, true, { client, write: () => undefined, batchSize: 1 }),
    ).rejects.toThrow("earlier batches are applied, later ones are not");

    expect(calls).toHaveLength(3);
    expect(calls[0].variables).toEqual({ ids: [issueA], input: { addedLabelIds: ["l1"] } });
    expect(calls[2].variables).toEqual({ ids: [issueC], input: { stateId: "s1" } });
  });

  const namedRows = parseChangeFile(
    JSON.stringify([
      { identifier: "OJD-7", state: "ready for prod", comment: "Verified on dev." },
      { identifier: "ojd-8", comment: "Partly verified." },
    ]),
  );
  const lookups = [
    { i0: { id: issueA, identifier: "OJD-7" }, i1: { id: issueB, identifier: "OJD-8" } },
    { teams: { nodes: [{ states: { nodes: [{ id: "s9", name: "Ready For Prod" }] } }] } },
  ];

  it("resolves identifiers and state names on a dry run and writes nothing", async () => {
    const { client, calls } = recordingClient(lookups);
    const lines: string[] = [];

    await applyChanges(namedRows, false, {
      client,
      write: (text) => lines.push(text),
      batchSize: 50,
    });

    expect(calls.map((call) => call.document.trimStart().split("(")[0])).toEqual([
      "query",
      "query",
    ]);
    expect(calls[0].variables).toEqual({ i0: "OJD-7", i1: "OJD-8" });
    expect(lines.join("")).toContain("1 issue(s): state s9");
    expect(lines.join("")).toContain("2 comment(s), posted before any update");
  });

  it("posts each comment before the updates", async () => {
    const { client, calls } = recordingClient([
      ...lookups,
      { commentCreate: { success: true } },
      { commentCreate: { success: true } },
      { issueBatchUpdate: { success: true } },
    ]);

    await applyChanges(namedRows, true, { client, write: () => undefined, batchSize: 50 });

    expect(calls[2].variables).toEqual({ input: { issueId: issueA, body: "Verified on dev." } });
    expect(calls[3].variables).toEqual({ input: { issueId: issueB, body: "Partly verified." } });
    expect(calls[4].variables).toEqual({ ids: [issueA], input: { stateId: "s9" } });
  });

  it("stops before any update when a comment fails", async () => {
    const { client, calls } = recordingClient([...lookups, { commentCreate: { success: false } }]);

    await expect(
      applyChanges(namedRows, true, { client, write: () => undefined, batchSize: 50 }),
    ).rejects.toThrow("no update is applied");

    expect(calls).toHaveLength(3);
  });

  it("names the team's states when a state name does not exist", async () => {
    const rows = parseChangeFile(JSON.stringify([{ identifier: "OJD-7", state: "Shipped" }]));
    const { client } = recordingClient(lookups);

    await expect(
      applyChanges(rows, false, { client, write: () => undefined, batchSize: 50 }),
    ).rejects.toThrow('no state "Shipped"; it has Ready For Prod');
  });
});

describe("parseArgs", () => {
  it("reads the file, the apply flag and the batch size", () => {
    expect(parseArgs(["changes.json"])).toEqual({
      file: "changes.json",
      apply: false,
      batchSize: 50,
    });
    expect(parseArgs(["--apply", "changes.json", "--batch", "10"])).toEqual({
      file: "changes.json",
      apply: true,
      batchSize: 10,
    });
  });

  it("requires a file and a positive batch size", () => {
    expect(() => parseArgs(["--apply"])).toThrow("Usage");
    expect(() => parseArgs(["changes.json", "--batch", "0"])).toThrow("positive integer");
  });
});
