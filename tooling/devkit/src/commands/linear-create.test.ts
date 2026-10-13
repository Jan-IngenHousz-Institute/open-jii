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

interface FixtureOptions {
  // What Linear already holds for an identifier the draft updates or relates to.
  issue?: (identifier: string) => Record<string, unknown>;
}

/** Fixtures are untyped while the client contract is generic; this is the one place that gap is bridged. */
function fixture(options: FixtureOptions = {}): { client: LinearClient; calls: Call[] } {
  const calls: Call[] = [];
  let created = 0;
  const client: LinearClient = {
    query: <T>(document: string, variables: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ document, variables });
      let answer: unknown;
      if (document.includes("teams(filter")) {
        answer = {
          teams: {
            nodes: [
              {
                id: "team-1",
                states: {
                  nodes: [
                    { id: "st-backlog", name: "Backlog" },
                    { id: "st-ready", name: "Ready" },
                  ],
                },
              },
            ],
          },
        };
      } else if (document.includes("projectMilestones(first")) {
        answer = {
          project: {
            projectMilestones: {
              nodes: [
                {
                  id: "ms-1",
                  name: "1. Members see their work",
                  description: null,
                  sortOrder: 1000,
                },
                { id: "ms-2", name: "2. Admins manage it", description: null, sortOrder: 2000 },
              ],
            },
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
          viewer: { id: "me" },
          issue: {
            id: `id-${identifier}`,
            identifier,
            url: `https://linear.app/x/${identifier}`,
            state: { name: "Backlog" },
            project: { id: "proj-1", name: "Platform home" },
            projectMilestone: null,
            labels: { nodes: [] },
            comments: { nodes: [] },
            attachments: { nodes: [] },
            relations: { nodes: [] },
            inverseRelations: { nodes: [] },
            ...options.issue?.(identifier),
          },
        };
      } else if (document.includes("issueUpdate(")) {
        answer = { issueUpdate: { success: true } };
      } else if (document.includes("commentCreate(")) {
        answer = { commentCreate: { success: true } };
      } else if (document.includes("commentUpdate(")) {
        answer = { commentUpdate: { success: true } };
      } else if (document.includes("issueRelationCreate(")) {
        answer = { issueRelationCreate: { success: true } };
      } else if (document.includes("attachmentLinkURL(")) {
        answer = { attachmentLinkURL: { success: true } };
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
  const pauses: number[] = [];
  const value: CreateDependencies = {
    client,
    write: (text) => lines.push(text),
    loadState: () => Promise.resolve(state),
    saveState: (next) => {
      saves.push(structuredClone(next));
      return Promise.resolve();
    },
    pause: (milliseconds) => {
      pauses.push(milliseconds);
      return Promise.resolve();
    },
  };
  return { value, lines, saves, state, pauses };
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
      resolveNames(client, parseDraft(draftText.replace("---\n\n#", "state: Doing\n---\n\n#"))),
    ).rejects.toThrow('no state "Doing"; it has Backlog, Ready');
    await expect(
      resolveNames(client, parseDraft(draftText.replace("blocks: 2", "state: Doing"))),
    ).rejects.toThrow('no state "Doing"; it has Backlog, Ready');
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
    expect(d.state.relations).toEqual(["blocks:1>2"]);
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

describe("createTickets, milestones, states and relations", () => {
  const sort = "# Researcher can sort any resource list";

  it("creates a ticket in its milestone and its own state", async () => {
    const { client, calls } = fixture();
    const text = draftText.replace("blocks: 2", "milestone: 2. Admins manage it\nstate: Ready");

    await createTickets(parseDraft(text), true, deps(client).value);

    const create = calls.find((c) => c.document.includes("issueCreate("))?.variables;
    expect(create).toMatchObject({
      input: { stateId: "st-ready", projectMilestoneId: "ms-2" },
    });
  });

  it("refuses an unknown milestone and points at the command that creates them", async () => {
    const text = draftText.replace("blocks: 2", "milestone: 9. Nowhere");

    await expect(resolveNames(fixture().client, parseDraft(text))).rejects.toThrow(
      'Unknown milestone(s): 9. Nowhere; the project has "1. Members see their work", "2. Admins manage it". Create them with pnpm linear:milestones',
    );
  });

  it("moves an updated ticket into the project, milestone and state the draft names", async () => {
    const { client, calls } = fixture({
      issue: () => ({ project: { id: "proj-9", name: "Old home" } }),
    });
    const d = deps(client);
    const text = draftText
      .replace(sort, `# OJD-1810 Researcher can sort any resource list`)
      .replace("blocks: 2", "blocks: 2\nmilestone: 1. Members see their work\nstate: Ready");

    await createTickets(parseDraft(text), true, d.value);

    const update = calls.find((c) => c.document.includes("issueUpdate("))?.variables;
    expect(update).toMatchObject({
      id: "id-OJD-1810",
      input: { projectId: "proj-1", projectMilestoneId: "ms-1", stateId: "st-ready" },
    });
    expect(d.lines.join("")).toContain(
      'update OJD-1810 (state Backlog to Ready; moves from "Old home"; milestone 1. Members see their work)',
    );
  });

  it("drops unlisted labels on --sync-labels but never a compliance label", async () => {
    const issue = () => ({
      labels: {
        nodes: [
          { id: "l-feature", name: "Feature" },
          { id: "l-old", name: "Improvement" },
          { id: "l-wbso", name: "WBSO2025T1" },
        ],
      },
    });
    const text = draftText.replace(sort, "# OJD-1810 Researcher can sort any resource list");

    const synced = fixture({ issue });
    await createTickets(parseDraft(text), true, deps(synced.client).value, { syncLabels: true });
    const plain = fixture({ issue });
    await createTickets(parseDraft(text), true, deps(plain.client).value);

    const update = (calls: Call[]) => calls.find((c) => c.document.includes("issueUpdate("));
    expect(update(synced.calls)?.variables).toMatchObject({
      input: { removedLabelIds: ["l-old"] },
    });
    expect(update(plain.calls)?.variables).not.toMatchObject({
      input: { removedLabelIds: expect.anything() as unknown },
    });
  });

  it("relates to existing tickets, in both directions, and to a draft ticket as related", async () => {
    const { client, calls } = fixture();
    const d = deps(client);
    const text = draftText.replace(
      "blocks: 2",
      "blocks: 2, OJD-1500\nblocked-by: OJD-1400\nrelated: OJD-1300",
    );

    await createTickets(parseDraft(text), true, d.value);

    const relations = calls
      .filter((c) => c.document.includes("issueRelationCreate("))
      .map((c) => c.variables);
    expect(relations).toEqual([
      { input: { issueId: "id-1", relatedIssueId: "id-2", type: "blocks" } },
      { input: { issueId: "id-1", relatedIssueId: "id-OJD-1500", type: "blocks" } },
      { input: { issueId: "id-OJD-1400", relatedIssueId: "id-1", type: "blocks" } },
      { input: { issueId: "id-1", relatedIssueId: "id-OJD-1300", type: "related" } },
    ]);
    expect(d.state.relations).toEqual([
      "blocks:1>2",
      "blocks:1>OJD-1500",
      "blocks:OJD-1400>1",
      "related:1>OJD-1300",
    ]);
  });

  it("edits the viewer's own comment with the same first line instead of stacking a second", async () => {
    const withComment = (author: string) => () => ({
      comments: {
        nodes: [{ id: "c-1", body: "**Where to start**\n\nOld pointers.", user: { id: author } }],
      },
    });
    const text = draftText
      .replace(sort, "# OJD-1810 Researcher can sort any resource list")
      .replace("See {{2}} for the toolbar.", "**Where to start**\n\nSee {{2}} for the toolbar.");

    const own = fixture({ issue: withComment("me") });
    await createTickets(parseDraft(text), true, deps(own.client).value);
    const someoneElse = fixture({ issue: withComment("them") });
    await createTickets(parseDraft(text), true, deps(someoneElse.client).value);

    expect(mutations(own.calls)).toContain("commentUpdate");
    expect(mutations(own.calls)).not.toContain("commentCreate");
    expect(own.calls.find((c) => c.document.includes("commentUpdate("))?.variables).toEqual({
      id: "c-1",
      input: { body: "**Where to start**\n\nSee OJD-1001 for the toolbar." },
    });
    expect(mutations(someoneElse.calls)).toContain("commentCreate");
    expect(mutations(someoneElse.calls)).not.toContain("commentUpdate");
  });

  it("notes a Web ticket with no screen without failing it", async () => {
    const d = deps(fixture().client);

    await createTickets(parseDraft(draftText), false, d.value);

    expect(d.lines.join("")).toContain(
      "note  2. Researcher can filter any resource list: no screen in the body",
    );
  });
});

describe("createTickets, relations by issue id", () => {
  it("creates a relation once when the draft spells it from both ends", async () => {
    const { client, calls } = fixture();
    const text = draftText
      .replace("# Researcher can sort", "# OJD-1810 Researcher can sort")
      .replace("labels: Feature, Web", "labels: Feature, Web\nblocked-by: OJD-1810");

    await createTickets(parseDraft(text), true, deps(client).value);

    expect(calls.filter((c) => c.document.includes("issueRelationCreate("))).toHaveLength(1);
  });

  it("skips a relation Linear already has, in either direction for related", async () => {
    const { client, calls } = fixture({
      issue: (identifier) =>
        identifier === "OJD-1300"
          ? { relations: { nodes: [{ type: "related", relatedIssue: { id: "id-1" } }] } }
          : identifier === "OJD-1400"
            ? { relations: { nodes: [{ type: "blocks", relatedIssue: { id: "id-1" } }] } }
            : {},
    });
    const d = deps(client);
    const text = draftText.replace("blocks: 2", "blocked-by: OJD-1400\nrelated: OJD-1300");

    await createTickets(parseDraft(text), true, d.value);

    expect(calls.filter((c) => c.document.includes("issueRelationCreate("))).toHaveLength(0);
    expect(d.lines.join("")).toContain("already blocks OJD-1400 -> OJD-1001");
    expect(d.lines.join("")).toContain("already related OJD-1001 -> OJD-1300");
  });

  it("refuses a ticket that relates to itself by identifier", () => {
    const text = draftText
      .replace("# Researcher can sort", "# OJD-1810 Researcher can sort")
      .replace("blocks: 2", "related: OJD-1810");

    expect(() => parseDraft(text)).toThrow("refers to itself");
  });

  it("leaves a milestone alone when the ticket is already in it", async () => {
    const { client, calls } = fixture({ issue: () => ({ projectMilestone: { id: "ms-1" } }) });
    const d = deps(client);
    const text = draftText
      .replace("# Researcher can sort", "# OJD-1810 Researcher can sort")
      .replace("blocks: 2", "milestone: 1. Members see their work");

    await createTickets(parseDraft(text), true, d.value);

    const update = calls.find((c) => c.document.includes("issueUpdate("))?.variables;
    expect(update).not.toMatchObject({
      input: { projectMilestoneId: expect.anything() as unknown },
    });
    expect(d.lines.join("")).not.toContain("milestone 1. Members see their work");
  });
});

describe("createTickets, links", () => {
  const withLinks = (lines: string) => draftText.replace("blocks: 2", `blocks: 2\n${lines}`);

  it("attaches each link once, skipping what the ticket already carries", async () => {
    const { client, calls } = fixture({
      issue: () => ({ attachments: { nodes: [{ url: "https://a.example/kept" }] } }),
    });
    const d = deps(client);
    const text = withLinks(
      "link: Kept | https://a.example/kept\nlink: Sorting guide | https://a.example/sorting",
    ).replace("# Researcher can sort", "# OJD-1810 Researcher can sort");

    await createTickets(parseDraft(text), true, d.value);
    const again = fixture({
      issue: () => ({ attachments: { nodes: [{ url: "https://a.example/kept" }] } }),
    });
    await createTickets(parseDraft(text), true, deps(again.client, d.state).value);

    const links = calls.filter((c) => c.document.includes("attachmentLinkURL("));
    expect(links.map((c) => c.variables)).toEqual([
      { issueId: "id-OJD-1810", url: "https://a.example/sorting", title: "Sorting guide" },
    ]);
    expect(mutations(again.calls)).not.toContain("attachmentLinkURL");
    expect(d.lines.join("")).toContain("link OJD-1810  Sorting guide");
  });

  it("spaces links out only when a run carries more than the burst Linear allows", async () => {
    const few = deps(fixture().client);
    await createTickets(parseDraft(withLinks("link: One | https://a.example/1")), true, few.value);
    const many = deps(fixture().client);
    const lines = Array.from({ length: 21 }, (_, i) => `link: L${i} | https://a.example/${i}`);
    await createTickets(parseDraft(withLinks(lines.join("\n"))), true, many.value);

    expect(few.pauses).toEqual([]);
    expect(many.pauses).toHaveLength(20);
  });
});

describe("parseArgs and statePath", () => {
  it("takes the draft path and the apply flag; state sits next to the draft", () => {
    expect(parseArgs(["drafts/home.md", "--apply"])).toEqual({
      file: "drafts/home.md",
      apply: true,
      syncLabels: false,
    });
    expect(parseArgs(["drafts/home.md", "--sync-labels"])).toMatchObject({ syncLabels: true });
    expect(() => parseArgs(["--apply"])).toThrow("Usage");
    expect(statePath("drafts/home.md")).toBe("drafts/home.md.created.json");
  });
});
