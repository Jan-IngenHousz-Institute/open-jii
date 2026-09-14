import { repositoryRoot, resolveLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { labelPhases, taxonomy } from "../linear/taxonomy.js";
import type { LabelPhase, TaxonomySpec } from "../linear/taxonomy.js";

export interface LiveLabel {
  id: string;
  name: string;
  isGroup: boolean;
  parentName: string | null;
  teamKey: string | null;
}

export type PlannedOperation =
  | { phase: "groups"; kind: "create-group"; name: string }
  | { phase: "creates"; kind: "create-label"; name: string; group: string | null }
  | { phase: "renames"; kind: "rename"; from: string; to: string; group: string | null }
  | { phase: "merges"; kind: "merge"; from: string; into: string[] }
  | { phase: "retires"; kind: "retire"; name: string }
  | { phase: LabelPhase; kind: "skip"; name: string; reason: string };

export interface TaxonomyDependencies {
  client: LinearClient;
  spec: TaxonomySpec;
  write: (text: string) => void;
  batchSize: number;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface LabelsPage {
  issueLabels: {
    nodes: {
      id: string;
      name: string;
      isGroup: boolean;
      retiredAt: string | null;
      parent: { name: string } | null;
      team: { key: string } | null;
    }[];
    pageInfo: PageInfo;
  };
}

interface TeamsResult {
  teams: { nodes: { id: string }[] };
}

interface IssuesPage {
  issues: {
    nodes: { id: string; labels: { nodes: { name: string }[] } }[];
    pageInfo: PageInfo;
  };
}

interface LabelCreateResult {
  issueLabelCreate: { success: boolean; issueLabel: { id: string } | null };
}

interface SuccessResult {
  success: boolean;
}

const labelsQuery = `query($after: String) {
  issueLabels(first: 100, after: $after) {
    nodes { id name isGroup retiredAt parent { name } team { key } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const teamQuery = `query($key: String!) {
  teams(filter: { key: { eq: $key } }) { nodes { id } }
}`;

const issuesByLabelQuery = `query($name: String!, $after: String) {
  issues(first: 100, after: $after, filter: { labels: { name: { eq: $name } } }) {
    nodes { id labels(first: 25) { nodes { name } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const createLabelMutation = `mutation($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) { success issueLabel { id } }
}`;

const updateLabelMutation = `mutation($id: String!, $input: IssueLabelUpdateInput!) {
  issueLabelUpdate(id: $id, input: $input) { success }
}`;

const retireLabelMutation = `mutation($id: String!) {
  issueLabelRetire(id: $id) { success }
}`;

const addLabelsMutation = `mutation($ids: [UUID!]!, $input: IssueUpdateInput!) {
  issueBatchUpdate(ids: $ids, input: $input) { success }
}`;

function skip(phase: LabelPhase, name: string, reason: string): PlannedOperation {
  return { phase, kind: "skip", name, reason };
}

function isUntouchable(spec: TaxonomySpec, name: string): boolean {
  return spec.untouchablePrefixes.some((prefix) => name.startsWith(prefix));
}

function groupFor(spec: TaxonomySpec, facetName: string): string | null {
  const facet = spec.facets.find((candidate) => candidate.name === facetName);
  if (!facet) throw new Error(`Spec names an unknown facet "${facetName}"`);
  return facet.grouped ? facet.name : null;
}

function assertSpecIsSafe(spec: TaxonomySpec): void {
  const touched = [
    ...spec.renames.flatMap((rename) => [rename.from, rename.to]),
    ...spec.creates.map((create) => create.name),
    ...spec.merges.flatMap((merge) => [merge.from, ...merge.into]),
    ...spec.retires,
  ];
  for (const name of touched) {
    if (isUntouchable(spec, name)) throw new Error(`Spec touches untouchable label "${name}"`);
    if (spec.undecided.includes(name)) throw new Error(`Spec touches undecided label "${name}"`);
  }
}

export function planTaxonomy(spec: TaxonomySpec, live: readonly LiveLabel[]): PlannedOperation[] {
  assertSpecIsSafe(spec);
  const byName = new Map(live.map((label) => [label.name, label]));
  const operations: PlannedOperation[] = [];
  const pendingCreates = new Map<string, string | null>();

  for (const facet of spec.facets) {
    if (!facet.grouped) continue;
    const existing = byName.get(facet.name);
    if (existing === undefined) {
      operations.push({ phase: "groups", kind: "create-group", name: facet.name });
    } else if (existing.isGroup) {
      operations.push(skip("groups", facet.name, "group exists"));
    } else {
      throw new Error(`Label "${facet.name}" exists but is not a group; resolve that by hand`);
    }
  }

  for (const create of spec.creates) {
    pendingCreates.set(create.name, groupFor(spec, create.facet));
  }

  for (const rename of spec.renames) {
    const source = byName.get(rename.from);
    const target = byName.get(rename.to);
    const group = groupFor(spec, rename.facet);

    if (source === undefined) {
      const reason = target ? `already renamed to "${rename.to}"` : "source label missing";
      operations.push(skip("renames", rename.from, reason));
      continue;
    }

    const isTeamScoped = source.teamKey === spec.teamKey;
    if (!isTeamScoped) {
      // A workspace label cannot move into a team group, so it is recreated and merged instead.
      if (target === undefined) pendingCreates.set(rename.to, group);
      operations.push({ phase: "merges", kind: "merge", from: rename.from, into: [rename.to] });
      continue;
    }

    const isInPlace = rename.from === rename.to && source.parentName === group;
    if (isInPlace) {
      operations.push(skip("renames", rename.from, "already in place"));
      continue;
    }
    if (target !== undefined && target.id !== source.id) {
      throw new Error(`Both "${rename.from}" and "${rename.to}" exist; merge them by hand first`);
    }
    operations.push({ phase: "renames", kind: "rename", from: rename.from, to: rename.to, group });
  }

  for (const [name, group] of pendingCreates) {
    const existing = byName.get(name);
    operations.push(
      existing === undefined
        ? { phase: "creates", kind: "create-label", name, group }
        : skip("creates", name, "exists"),
    );
  }

  for (const merge of spec.merges) {
    const source = byName.get(merge.from);
    operations.push(
      source === undefined
        ? skip("merges", merge.from, "already merged")
        : { phase: "merges", kind: "merge", from: merge.from, into: [...merge.into] },
    );
  }

  for (const name of spec.retires) {
    operations.push(
      byName.has(name)
        ? { phase: "retires", kind: "retire", name }
        : skip("retires", name, "already retired"),
    );
  }

  return operations;
}

function describe(operation: PlannedOperation): string {
  switch (operation.kind) {
    case "create-group":
      return `create group ${operation.name}`;
    case "create-label":
      return `create ${operation.name}${operation.group ? ` in ${operation.group}` : ""}`;
    case "rename":
      return `rename ${operation.from} -> ${operation.to}${operation.group ? ` in ${operation.group}` : ""}`;
    case "merge":
      return `merge ${operation.from} -> ${operation.into.join(", ")}, then retire ${operation.from}`;
    case "retire":
      return `retire ${operation.name}`;
    case "skip":
      return `skip ${operation.name} (${operation.reason})`;
  }
}

export function printPlan(
  spec: TaxonomySpec,
  operations: readonly PlannedOperation[],
  write: (text: string) => void,
): void {
  for (const phase of labelPhases) {
    const inPhase = operations.filter((operation) => operation.phase === phase);
    const todo = inPhase.filter((operation) => operation.kind !== "skip");
    write(`${phase}: ${todo.length} to do, ${inPhase.length - todo.length} already done\n`);
    for (const operation of inPhase) write(`  ${describe(operation)}\n`);
  }
  write(`undecided, never touched: ${spec.undecided.join(", ")}\n`);
  write(`untouchable prefixes: ${spec.untouchablePrefixes.join(", ")}\n`);
}

export async function fetchLabels(client: LinearClient): Promise<LiveLabel[]> {
  const labels: LiveLabel[] = [];
  let after: string | null = null;
  for (;;) {
    const page: LabelsPage = await client.query<LabelsPage>(labelsQuery, { after });
    for (const node of page.issueLabels.nodes) {
      if (node.retiredAt !== null) continue;
      labels.push({
        id: node.id,
        name: node.name,
        isGroup: node.isGroup,
        parentName: node.parent?.name ?? null,
        teamKey: node.team?.key ?? null,
      });
    }
    if (!page.issueLabels.pageInfo.hasNextPage) return labels;
    after = page.issueLabels.pageInfo.endCursor;
  }
}

async function fetchTeamId(client: LinearClient, key: string): Promise<string> {
  const result = await client.query<TeamsResult>(teamQuery, { key });
  const team = result.teams.nodes.at(0);
  if (!team) throw new Error(`Team "${key}" is not visible to this API key`);
  return team.id;
}

async function fetchIssuesWithLabel(
  client: LinearClient,
  name: string,
): Promise<{ id: string; labelNames: string[] }[]> {
  const issues: { id: string; labelNames: string[] }[] = [];
  let after: string | null = null;
  for (;;) {
    const page: IssuesPage = await client.query<IssuesPage>(issuesByLabelQuery, { name, after });
    for (const node of page.issues.nodes) {
      issues.push({ id: node.id, labelNames: node.labels.nodes.map((label) => label.name) });
    }
    if (!page.issues.pageInfo.hasNextPage) return issues;
    after = page.issues.pageInfo.endCursor;
  }
}

async function createLabel(
  client: LinearClient,
  input: { name: string; teamId: string; parentId?: string; isGroup?: boolean },
): Promise<string> {
  const result = await client.query<LabelCreateResult>(createLabelMutation, { input });
  const created = result.issueLabelCreate.issueLabel;
  if (!result.issueLabelCreate.success || created === null) {
    throw new Error(`Creating label "${input.name}" did not succeed`);
  }
  return created.id;
}

async function expectSuccess(
  client: LinearClient,
  mutation: string,
  variables: Record<string, unknown>,
  what: string,
): Promise<void> {
  const result = await client.query<Record<string, SuccessResult>>(mutation, variables);
  const outcome = Object.values(result).at(0);
  if (!outcome?.success) throw new Error(`${what} did not succeed`);
}

function labelIdOrThrow(labels: ReadonlyMap<string, LiveLabel>, name: string): string {
  const label = labels.get(name);
  if (!label) throw new Error(`Label "${name}" is missing; run the earlier phases first`);
  return label.id;
}

async function applyMerge(
  operation: Extract<PlannedOperation, { kind: "merge" }>,
  labels: ReadonlyMap<string, LiveLabel>,
  deps: TaxonomyDependencies,
): Promise<void> {
  const sourceId = labelIdOrThrow(labels, operation.from);
  const targetIds = operation.into.map((name) => labelIdOrThrow(labels, name));
  const issues = await fetchIssuesWithLabel(deps.client, operation.from);
  deps.write(`  ${operation.from}: ${issues.length} issue(s) get ${operation.into.join(", ")}\n`);

  for (let start = 0; start < issues.length; start += deps.batchSize) {
    const ids = issues.slice(start, start + deps.batchSize).map((issue) => issue.id);
    await expectSuccess(
      deps.client,
      addLabelsMutation,
      { ids, input: { addedLabelIds: targetIds } },
      `Adding ${operation.into.join(", ")} to ${ids.length} issue(s) from ${start}`,
    );
  }

  const stillMissing = (await fetchIssuesWithLabel(deps.client, operation.from)).filter((issue) =>
    operation.into.some((name) => !issue.labelNames.includes(name)),
  );
  if (stillMissing.length > 0) {
    throw new Error(
      `${stillMissing.length} issue(s) still lack a target after merging ${operation.from}; not retiring it`,
    );
  }
  await expectSuccess(
    deps.client,
    retireLabelMutation,
    { id: sourceId },
    `Retiring ${operation.from}`,
  );
}

async function applyOperation(
  operation: PlannedOperation,
  labels: ReadonlyMap<string, LiveLabel>,
  teamId: string,
  deps: TaxonomyDependencies,
): Promise<void> {
  switch (operation.kind) {
    case "create-group":
      await createLabel(deps.client, { name: operation.name, teamId, isGroup: true });
      return;
    case "create-label": {
      const parentId = operation.group ? labelIdOrThrow(labels, operation.group) : undefined;
      await createLabel(deps.client, { name: operation.name, teamId, parentId });
      return;
    }
    case "rename": {
      const id = labelIdOrThrow(labels, operation.from);
      const parentId = operation.group ? labelIdOrThrow(labels, operation.group) : undefined;
      const input = parentId ? { name: operation.to, parentId } : { name: operation.to };
      await expectSuccess(deps.client, updateLabelMutation, { id, input }, describe(operation));
      return;
    }
    case "merge":
      await applyMerge(operation, labels, deps);
      return;
    case "retire": {
      const id = labelIdOrThrow(labels, operation.name);
      await expectSuccess(deps.client, retireLabelMutation, { id }, describe(operation));
      return;
    }
    case "skip":
      return;
  }
}

export async function applyTaxonomy(
  phases: readonly LabelPhase[],
  deps: TaxonomyDependencies,
): Promise<void> {
  const teamId = await fetchTeamId(deps.client, deps.spec.teamKey);

  for (const phase of labelPhases) {
    if (!phases.includes(phase)) continue;
    // Labels are re-read per phase because earlier phases create the ids later ones need.
    const live = await fetchLabels(deps.client);
    const labels = new Map(live.map((label) => [label.name, label]));
    const todo = planTaxonomy(deps.spec, live).filter(
      (operation) => operation.phase === phase && operation.kind !== "skip",
    );
    deps.write(`== ${phase}: ${todo.length} operation(s)\n`);
    for (const operation of todo) {
      deps.write(`  ${describe(operation)}\n`);
      await applyOperation(operation, labels, teamId, deps);
    }
  }
}

export function parseArgs(args: string[]): { apply: boolean; phases: LabelPhase[] } {
  const apply = args.includes("--apply");
  const stepIndex = args.indexOf("--step");
  const phases: LabelPhase[] = [];
  if (stepIndex >= 0) {
    const value = args[stepIndex + 1];
    if (!value) throw new Error("--step requires a comma-separated list of phases");
    for (const raw of value.split(",")) {
      const phase = labelPhases.find((candidate) => candidate === raw.trim());
      if (!phase)
        throw new Error(`Unknown phase "${raw}"; expected one of ${labelPhases.join(", ")}`);
      phases.push(phase);
    }
  }
  if (apply && phases.length === 0) throw new Error("--apply requires --step <phase[,phase]>");
  return { apply, phases };
}

async function run(args: string[]): Promise<number> {
  const { apply, phases } = parseArgs(args);
  const write = (text: string): void => {
    process.stdout.write(text);
  };
  const root = repositoryRoot();
  const apiKey = await resolveLinearApiKey(root, process.env);
  if (!apiKey) throw new Error("No Linear key found; run pnpm linear:auth first");

  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  printPlan(taxonomy, planTaxonomy(taxonomy, await fetchLabels(client)), write);
  if (!apply) {
    write("dry run; pass --apply --step <phase[,phase]> to write\n");
    return 0;
  }

  await applyTaxonomy(phases, { client, spec: taxonomy, write, batchSize: 50 });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
