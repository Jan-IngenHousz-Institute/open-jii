import { describe, expect, it } from "vitest";

import type { LinearClient } from "../lib/linear.js";
import { taxonomy } from "../linear/taxonomy.js";
import type { TaxonomySpec } from "../linear/taxonomy.js";
import { applyTaxonomy, parseArgs, planTaxonomy } from "./linear-taxonomy.js";
import type { LiveLabel, PlannedOperation } from "./linear-taxonomy.js";

const team = "OJD";

function label(name: string, teamKey: string | null = team, isGroup = false): LiveLabel {
  return { id: `id-${name}`, name, isGroup, parentName: null, teamKey };
}

function under(parentName: string, name: string): LiveLabel {
  return { ...label(name), parentName };
}

function hasKind<K extends PlannedOperation["kind"]>(kind: K) {
  return (operation: PlannedOperation): operation is Extract<PlannedOperation, { kind: K }> =>
    operation.kind === kind;
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

// The audit's label set. The workspace-scoped ones are what forces recreate-and-merge.
const auditedLabels: LiveLabel[] = [
  ...["Bug", "Improvement", "Web", "Mobile", "Backend", "Data", "Feature", "Fullstack", "Epic"].map(
    (name) => label(name, null),
  ),
  ...[
    "Blog",
    "Case Study",
    "Event",
    "Newsletter",
    "Social",
    "Whitepaper",
    "Changelog",
    "Platform",
  ].map((name) => label(name, null)),
  ...[
    "enhancement",
    "research",
    "ci/cd",
    "documentation",
    "design",
    "needs_design",
    "Needs UX check",
    "UX fix needed",
    "TestFindings",
    "ApprovedByTester",
    "Blocked - External",
    "help wanted",
    "python",
    "python:uv",
    "Devops testing",
    "question",
    "Ignored_by_Romy",
    "Most Urgent",
    "Roughly_estimated",
    "to_Refine",
    "Migrated",
    "Proposal",
    "planning",
    "WBSO2025T1",
    "No-WBSO",
    "wayfinder:map",
  ].map((name) => label(name)),
];

describe("planTaxonomy", () => {
  it("derives the change list from the audited label set", () => {
    const plan = planTaxonomy(taxonomy, auditedLabels);

    expect(plan.filter(hasKind("create-group")).map((operation) => operation.name)).toEqual([
      "type",
      "triage",
    ]);
    expect(plan.filter(hasKind("rename"))).toHaveLength(11);
    expect(plan.filter(hasKind("create-label"))).toHaveLength(12);
    expect(plan.filter(hasKind("merge"))).toHaveLength(11);
    expect(plan.filter(hasKind("retire"))).toHaveLength(14);
  });

  it("recreates a workspace-scoped label instead of renaming it into a team group", () => {
    const plan = planTaxonomy(taxonomy, auditedLabels);

    expect(plan.filter(hasKind("rename")).map((operation) => operation.from)).not.toContain("Bug");
    expect(plan.filter(hasKind("merge"))).toContainEqual({
      phase: "merges",
      kind: "merge",
      from: "Bug",
      into: ["bug"],
    });
    expect(plan.filter(hasKind("create-label"))).toContainEqual({
      phase: "creates",
      kind: "create-label",
      name: "bug",
      group: "type",
    });
  });

  it("keeps combinable facets flat and puts exclusive ones in a group", () => {
    const plan = planTaxonomy(taxonomy, auditedLabels);
    const groupByTarget = new Map(
      plan.filter(hasKind("rename")).map((operation) => [operation.to, operation.group]),
    );

    expect(groupByTarget.get("feature")).toBe("type");
    expect(groupByTarget.get("infra")).toBeNull();
    expect(groupByTarget.get("needs-ux-check")).toBeNull();
  });

  it("is a no-op once the workspace matches the spec", () => {
    const done: LiveLabel[] = [
      label("type", team, true),
      label("triage", team, true),
      ...["bug", "feature", "improvement", "spike", "chore"].map((name) => under("type", name)),
      ...["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"].map(
        (name) => under("triage", name),
      ),
      ...["web", "mobile", "backend", "data", "infra", "docs", "design"].map((name) => label(name)),
      label("WBSO2025T1"),
      label("Platform", null),
    ];

    const plan = planTaxonomy(taxonomy, done);

    expect(plan.every((operation) => operation.kind === "skip")).toBe(true);
  });

  it("refuses a spec that touches an untouchable or undecided label", () => {
    const touchesWbso: TaxonomySpec = { ...taxonomy, retires: ["WBSO2025T1"] };
    const touchesUndecided: TaxonomySpec = {
      ...taxonomy,
      renames: [{ from: "Platform", to: "platform", facet: "area" }],
    };

    expect(() => planTaxonomy(touchesWbso, auditedLabels)).toThrow(
      'untouchable label "WBSO2025T1"',
    );
    expect(() => planTaxonomy(touchesUndecided, auditedLabels)).toThrow(
      'undecided label "Platform"',
    );
  });

  it("stops when both sides of a rename already exist", () => {
    const both = [...auditedLabels, label("feature")];

    expect(() => planTaxonomy(taxonomy, both)).toThrow('Both "enhancement" and "feature" exist');
  });
});

describe("parseArgs", () => {
  it("requires --step alongside --apply", () => {
    expect(() => parseArgs(["--apply"])).toThrow("--apply requires --step");
    expect(parseArgs(["--apply", "--step", "groups,creates"])).toEqual({
      apply: true,
      phases: ["groups", "creates"],
    });
    expect(parseArgs([])).toEqual({ apply: false, phases: [] });
  });

  it("rejects an unknown phase", () => {
    expect(() => parseArgs(["--step", "labels"])).toThrow('Unknown phase "labels"');
  });
});

interface FakeLabel extends LiveLabel {
  retired: boolean;
}

interface FakeIssue {
  id: string;
  labels: Set<string>;
}

function isLabelInput(
  value: unknown,
): value is { name: string; parentId?: string; isGroup?: boolean } {
  return typeof value === "object" && value !== null && "name" in value;
}

function isBatchInput(value: unknown): value is { addedLabelIds: string[] } {
  return typeof value === "object" && value !== null && "addedLabelIds" in value;
}

// A small in-memory Linear: enough of the schema for the queries and mutations the command sends.
function fakeLinear(initialLabels: LiveLabel[], issues: FakeIssue[]) {
  const labels = new Map<string, FakeLabel>(
    initialLabels.map((entry) => [entry.id, { ...entry, retired: false }]),
  );
  const mutations: string[] = [];
  let nextId = 1;

  const client = fixtureClient((document, variables) => {
    if (document.includes("issueLabels(")) {
      const nodes = [...labels.values()].map((entry) => ({
        id: entry.id,
        name: entry.name,
        isGroup: entry.isGroup,
        retiredAt: entry.retired ? "2026-01-01" : null,
        parent: entry.parentName === null ? null : { name: entry.parentName },
        team: entry.teamKey === null ? null : { key: entry.teamKey },
      }));
      return { issueLabels: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    if (document.includes("teams(")) {
      return { teams: { nodes: [{ id: "team-1" }] } };
    }
    if (document.includes("issues(")) {
      const name = variables.name;
      const nodes = issues
        .filter((issue) => typeof name === "string" && issue.labels.has(name))
        .map((issue) => ({
          id: issue.id,
          labels: { nodes: [...issue.labels].map((entry) => ({ name: entry })) },
        }));
      return { issues: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    if (document.includes("issueLabelCreate")) {
      mutations.push("issueLabelCreate");
      const input = variables.input;
      if (!isLabelInput(input)) throw new Error("bad create input");
      const parent = input.parentId === undefined ? undefined : labels.get(input.parentId);
      const id = `new-${nextId}`;
      nextId += 1;
      labels.set(id, {
        id,
        name: input.name,
        isGroup: input.isGroup === true,
        parentName: parent?.name ?? null,
        teamKey: team,
        retired: false,
      });
      return { issueLabelCreate: { success: true, issueLabel: { id } } };
    }
    if (document.includes("issueLabelUpdate")) {
      mutations.push("issueLabelUpdate");
      const target = typeof variables.id === "string" ? labels.get(variables.id) : undefined;
      const input = variables.input;
      if (!target || !isLabelInput(input)) throw new Error("bad update");
      target.name = input.name;
      if (input.parentId !== undefined) {
        target.parentName = labels.get(input.parentId)?.name ?? null;
      }
      return { issueLabelUpdate: { success: true } };
    }
    if (document.includes("issueLabelRetire")) {
      mutations.push("issueLabelRetire");
      const target = typeof variables.id === "string" ? labels.get(variables.id) : undefined;
      if (!target) throw new Error("bad retire");
      target.retired = true;
      return { issueLabelRetire: { success: true } };
    }
    if (document.includes("issueBatchUpdate")) {
      mutations.push("issueBatchUpdate");
      const ids = variables.ids;
      const input = variables.input;
      if (!Array.isArray(ids) || !isBatchInput(input)) throw new Error("bad batch");
      const idList: unknown[] = ids;
      const added = input.addedLabelIds.map((labelId) => labels.get(labelId)?.name ?? "?");
      for (const issue of issues) {
        if (idList.includes(issue.id)) {
          for (const name of added) issue.labels.add(name);
        }
      }
      return { issueBatchUpdate: { success: true } };
    }
    throw new Error(`unexpected query: ${document}`);
  });

  return { client, mutations, labels };
}

describe("applyTaxonomy", () => {
  it("runs phases in canonical order and merges before retiring", async () => {
    const live = [
      label("Bug", null),
      label("enhancement"),
      label("Fullstack", null),
      label("Migrated"),
    ];
    const issues: FakeIssue[] = [
      { id: "i-1", labels: new Set(["Bug"]) },
      { id: "i-2", labels: new Set(["Fullstack"]) },
    ];
    const spec: TaxonomySpec = {
      ...taxonomy,
      renames: [
        { from: "Bug", to: "bug", facet: "type" },
        { from: "enhancement", to: "feature", facet: "type" },
        { from: "Web", to: "web", facet: "area" },
        { from: "Backend", to: "backend", facet: "area" },
      ],
      creates: [
        { name: "web", facet: "area" },
        { name: "backend", facet: "area" },
      ],
      merges: [{ from: "Fullstack", into: ["web", "backend"] }],
      retires: ["Migrated"],
    };
    const fake = fakeLinear(live, issues);

    await applyTaxonomy(["retires", "merges", "renames", "creates", "groups"], {
      client: fake.client,
      spec,
      write: () => undefined,
      batchSize: 50,
    });

    expect(fake.mutations).toEqual([
      "issueLabelCreate", // type group
      "issueLabelCreate", // triage group
      "issueLabelCreate", // web
      "issueLabelCreate", // backend
      "issueLabelCreate", // bug, recreated at team scope
      "issueLabelUpdate", // enhancement -> feature
      "issueBatchUpdate", // Bug issues get bug
      "issueLabelRetire", // Bug
      "issueBatchUpdate", // Fullstack issues get web and backend
      "issueLabelRetire", // Fullstack
      "issueLabelRetire", // Migrated
    ]);
    expect(issues[0].labels).toEqual(new Set(["Bug", "bug"]));
    expect(issues[1].labels).toEqual(new Set(["Fullstack", "web", "backend"]));
    const retired = [...fake.labels.values()]
      .filter((entry) => entry.retired)
      .map((entry) => entry.name);
    expect(retired).toEqual(["Bug", "Fullstack", "Migrated"]);
  });

  it("only runs the phases it is given", async () => {
    const fake = fakeLinear([label("enhancement")], []);
    const spec: TaxonomySpec = {
      ...taxonomy,
      facets: [{ name: "type", grouped: false }],
      renames: [{ from: "enhancement", to: "feature", facet: "type" }],
      creates: [],
      merges: [],
      retires: [],
    };

    await applyTaxonomy(["renames"], {
      client: fake.client,
      spec,
      write: () => undefined,
      batchSize: 50,
    });

    expect(fake.mutations).toEqual(["issueLabelUpdate"]);
  });
});
