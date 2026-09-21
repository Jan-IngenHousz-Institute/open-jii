import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { parseDraft } from "../lib/ticket-draft.js";
import { createTickets, emptyState, parseArgs, resolveNames, statePath } from "./linear-create.js";
import type { CreateDependencies, CreateState } from "./linear-create.js";

const shape = `## User story

**WHO:** A researcher.

**WHAT:** They act.

**WHY:** Nothing works today.

## Acceptance criteria

- BODY

## Dependencies and risks

None.

## Additional context

None.

## How it was built

## Testing criteria
`;

const draftText = `---
project: Platform home
---

# Researcher can sort any resource list

labels: Feature, Fullstack
blocks: 2

${shape.replace("BODY", "Sorting works; {{2}} adds filters.")}
<!-- comment -->
See {{2}} for the toolbar.

# Researcher can filter any resource list

labels: Feature, Web

${shape.replace("BODY", "Filtering works.")}`;

interface Call {
  document: string;
  variables: Record<string, unknown>;
}

const labelNode = (id: string, name: string, teamKey: string | null) => ({
  id,
  name,
  isGroup: false,
  retiredAt: null,
  parent: null,
  team: teamKey === null ? null : { key: teamKey },
});

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixture(): { client: LinearClient; calls: Call[] } {
  const calls: Call[] = [];
  let created = 0;
  const client: LinearClient = {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ document, variables });
      let answer: unknown;
      if (document.includes("teams(filter")) {
        answer = {
          teams: {
            nodes: [{ id: "team-1", states: { nodes: [{ id: "st-backlog", name: "Backlog" }] } }],
          },
        };
      } else if (document.includes("projects(first")) {
        answer = {
          projects: {
            nodes: [
              { id: "proj-1", name: "Platform home", url: "https://linear.app/x/proj-1" },
              { id: "proj-2", name: "Platform home and more", url: "https://linear.app/x/proj-2" },
            ],
          },
        };
      } else if (document.includes("issueLabels(first")) {
        answer = {
          issueLabels: {
            nodes: [
              labelNode("l-feature", "Feature", null),
              labelNode("l-fullstack", "Fullstack", "OJD"),
              labelNode("l-web", "Web", null),
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        };
      } else if (document.includes("issueCreate(")) {
        created += 1;
        const identifier = `OJD-${1000 + created}`;
        answer = {
          issueCreate: {
            success: true,
            issue: { id: `id-${created}`, identifier, url: `https://linear.app/x/${identifier}` },
          },
        };
      } else if (document.includes("issue(id")) {
        const identifier = String(variables.id);
        answer = {
          issue: { id: `id-${identifier}`, identifier, url: `https://linear.app/x/${identifier}` },
        };
      } else if (document.includes("issueUpdate(")) {
        answer = { issueUpdate: { success: true } };
      } else if (document.includes("commentCreate(")) {
        answer = { commentCreate: { success: true } };
      } else if (document.includes("issueRelationCreate(")) {
        answer = { issueRelationCreate: { success: true } };
      } else {
        throw new Error(`unexpected document ${document.slice(0, 40)}`);
      }
      return Promise.resolve(answer as T);
    },
  };
  return { client, calls };
}

function deps(client: LinearClient, state: CreateState = emptyState()) {
  const lines: string[] = [];
  const saves: CreateState[] = [];
  const value: CreateDependencies = {
    client,
    write: (text) => lines.push(text),
    loadState: () => Promise.resolve(state),
    saveState: (next) => {
      saves.push(structuredClone(next));
      return Promise.resolve();
    },
  };
  return { value, lines, saves, state };
}

function mutations(calls: readonly Call[]): string[] {
  return calls
    .map((call) => /^mutation[^{]*\{\s*(\w+)/.exec(call.document)?.[1])
    .filter((name): name is string => name !== undefined);
}

describe("resolveNames", () => {
  it("takes the one exact project match among close ones and maps labels case-insensitively", async () => {
    const resolved = await resolveNames(fixture().client, parseDraft(draftText));

    expect(resolved).toMatchObject({
      teamId: "team-1",
      projectId: "proj-1",
      projectName: "Platform home",
      stateId: "st-backlog",
    });
    expect(resolved.labelIds.get("fullstack")).toBe("l-fullstack");
  });

  it("refuses a missing project, an unknown state, and unknown labels by name", async () => {
    const { client } = fixture();

    await expect(
      resolveNames(client, parseDraft(draftText.replace("project: Platform home\n", ""))),
    ).rejects.toThrow("names no project");
    await expect(
      resolveNames(client, parseDraft(draftText.replace("---\n\n#", "state: Ready\n---\n\n#"))),
    ).rejects.toThrow('no state "Ready"; it has Backlog');
    await expect(
      resolveNames(client, parseDraft(draftText.replace("Feature, Web", "Feature, Mobile"))),
    ).rejects.toThrow("Unknown label(s): Mobile");
  });
});

describe("createTickets", () => {
  it("refuses a draft that fails the standard before resolving anything", async () => {
    const { client, calls } = fixture();
    const broken = parseDraft(draftText.replace("**WHY:** Nothing works today.\n", ""));

    await expect(createTickets(broken, true, deps(client).value)).rejects.toThrow(
      "fails the ticket standard",
    );
    expect(calls).toEqual([]);
  });

  it("dry-runs by printing the plan and writing nothing", async () => {
    const { client, calls } = fixture();
    const d = deps(client);

    await createTickets(parseDraft(draftText), false, d.value);

    expect(mutations(calls)).toEqual([]);
    expect(d.lines.join("")).toContain('2 ticket(s) for project "Platform home", state Backlog');
    expect(d.lines.join("")).toContain(
      "1. Researcher can sort any resource list  [Feature, Fullstack] to create; blocks 2; with comment",
    );
    expect(d.lines.join("")).toContain("dry run; pass --apply to write");
    expect(d.saves).toEqual([]);
  });

  it("creates, rewrites references, comments, relates, and prints the links", async () => {
    const { client, calls } = fixture();
    const d = deps(client);

    await createTickets(parseDraft(draftText), true, d.value);

    expect(mutations(calls)).toEqual([
      "issueCreate",
      "issueCreate",
      "issueUpdate",
      "commentCreate",
      "issueRelationCreate",
    ]);
    const create = calls.find((c) => c.document.includes("issueCreate("))?.variables;
    expect(create).toEqual({
      input: {
        teamId: "team-1",
        projectId: "proj-1",
        stateId: "st-backlog",
        title: "Researcher can sort any resource list",
        description: expect.stringContaining("{{2}} adds filters") as unknown,
        labelIds: ["l-feature", "l-fullstack"],
      },
    });
    const update = calls.find((c) => c.document.includes("issueUpdate("))?.variables;
    expect(update).toEqual({
      id: "id-1",
      input: { description: expect.stringContaining("OJD-1002 adds filters") as unknown },
    });
    const comment = calls.find((c) => c.document.includes("commentCreate("))?.variables;
    expect(comment).toEqual({ input: { issueId: "id-1", body: "See OJD-1002 for the toolbar." } });
    const relation = calls.find((c) => c.document.includes("issueRelationCreate("))?.variables;
    expect(relation).toEqual({
      input: { issueId: "id-1", relatedIssueId: "id-2", type: "blocks" },
    });
    expect(d.state.relations).toEqual(["1>2"]);
    expect(d.state.tickets["1"]).toMatchObject({
      identifier: "OJD-1001",
      referencesDone: true,
      commentDone: true,
    });
    expect(d.lines.join("")).toContain(
      "OJD-1001  Researcher can sort any resource list\nhttps://linear.app/x/OJD-1001\n",
    );
  });

  it("updates a ticket headed by an identifier instead of creating it, and still relates it", async () => {
    const { client, calls } = fixture();
    const d = deps(client);
    const text = draftText.replace(
      "# Researcher can sort any resource list",
      "# OJD-1810 Researcher can sort any resource list",
    );

    await createTickets(parseDraft(text), true, d.value);

    expect(mutations(calls)).toEqual([
      "issueUpdate",
      "issueCreate",
      "issueUpdate",
      "commentCreate",
      "issueRelationCreate",
    ]);
    const update = calls.find((c) => c.document.includes("issueUpdate("))?.variables;
    expect(update).toEqual({
      id: "id-OJD-1810",
      input: {
        title: "Researcher can sort any resource list",
        description: expect.stringContaining("{{2}} adds filters") as unknown,
        addedLabelIds: ["l-feature", "l-fullstack"],
      },
    });
    const relation = calls.find((c) => c.document.includes("issueRelationCreate("))?.variables;
    expect(relation).toEqual({
      input: { issueId: "id-OJD-1810", relatedIssueId: "id-1", type: "blocks" },
    });
    expect(d.lines.join("")).toContain("updated OJD-1810  Researcher can sort any resource list");
  });

  it("plans an update for an identifier-headed ticket in the dry run", async () => {
    const { client } = fixture();
    const d = deps(client);
    const text = draftText.replace("# Researcher can sort", "# OJD-1810 Researcher can sort");

    await createTickets(parseDraft(text), false, d.value);

    expect(d.lines.join("")).toContain(
      "1. Researcher can sort any resource list  [Feature, Fullstack] update OJD-1810",
    );
  });

  it("resumes from the state file without creating or commenting twice", async () => {
    const first = fixture();
    const d = deps(first.client);
    await createTickets(parseDraft(draftText), true, d.value);

    const second = fixture();
    const again = deps(second.client, d.state);
    await createTickets(parseDraft(draftText), true, again.value);

    expect(mutations(second.calls)).toEqual([]);
    expect(again.lines.join("")).toContain("exists as OJD-1001");
  });
});

describe("parseArgs and statePath", () => {
  it("takes the draft path and the apply flag; state sits next to the draft", () => {
    expect(parseArgs(["drafts/home.md", "--apply"])).toEqual({
      file: "drafts/home.md",
      apply: true,
    });
    expect(() => parseArgs(["--apply"])).toThrow("Usage");
    expect(statePath("drafts/home.md")).toBe("drafts/home.md.created.json");
  });
});
