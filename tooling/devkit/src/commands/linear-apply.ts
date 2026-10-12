import { readFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";

export interface IssueUpdate {
  addedLabelIds?: string[];
  removedLabelIds?: string[];
  projectId?: string;
  stateId?: string;
}

export interface ChangeRow extends IssueUpdate {
  issueId?: string;
  identifier?: string;
  state?: string;
  comment?: string;
  why?: string;
}

export interface ResolvedRow extends IssueUpdate {
  issueId: string;
  identifier?: string;
  comment?: string;
}

export interface ChangeGroup {
  update: IssueUpdate;
  ids: string[];
  identifiers: string[];
}

export interface ApplyDependencies {
  client: LinearClient;
  write: (text: string) => void;
  batchSize: number;
}

const teamKey = "OJD";

const batchUpdateMutation = `mutation($ids: [UUID!]!, $input: IssueUpdateInput!) {
  issueBatchUpdate(ids: $ids, input: $input) { success }
}`;

const commentCreateMutation = `mutation($input: CommentCreateInput!) {
  commentCreate(input: $input) { success }
}`;

const teamStatesQuery = `query($key: String!) {
  teams(filter: { key: { eq: $key } }) { nodes { states { nodes { id name } } } }
}`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifierPattern = /^[A-Z]+-\d+$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  index: number,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Row ${index}: "${key}" must be a string`);
  return value;
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  index: number,
): string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Row ${index}: "${key}" must be an array of strings`);
  const items: unknown[] = value;
  if (!items.every((item): item is string => typeof item === "string")) {
    throw new Error(`Row ${index}: "${key}" must be an array of strings`);
  }
  return items;
}

export function parseChangeFile(text: string): ChangeRow[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("A change file is a JSON array of rows");
  const entries: unknown[] = parsed;

  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Row ${index}: expected an object`);
    const issueId = optionalString(entry, "issueId", index);
    const identifier = optionalString(entry, "identifier", index);
    if (issueId !== undefined && !uuidPattern.test(issueId)) {
      throw new Error(
        `Row ${index}: "issueId" must be the issue's UUID; put an OJD identifier in "identifier"`,
      );
    }
    const hasIdentifier = identifier !== undefined && identifierPattern.test(identifier);
    if (issueId === undefined && !hasIdentifier) {
      throw new Error(`Row ${index}: give "issueId" as a UUID or "identifier" as OJD-####`);
    }

    const comment = optionalString(entry, "comment", index)?.trim();
    const row: ChangeRow = {
      issueId,
      identifier,
      why: optionalString(entry, "why", index),
      comment: comment === "" ? undefined : comment,
      addedLabelIds: optionalStringArray(entry, "addedLabelIds", index),
      removedLabelIds: optionalStringArray(entry, "removedLabelIds", index),
      projectId: optionalString(entry, "projectId", index),
      stateId: optionalString(entry, "stateId", index),
      state: optionalString(entry, "state", index),
    };
    const label = identifier ?? issueId;
    if (row.state !== undefined && row.stateId !== undefined) {
      throw new Error(`Row ${index} (${label}) gives both "state" and "stateId"`);
    }

    const hasChange =
      (row.addedLabelIds?.length ?? 0) > 0 ||
      (row.removedLabelIds?.length ?? 0) > 0 ||
      row.projectId !== undefined ||
      row.stateId !== undefined ||
      row.state !== undefined ||
      row.comment !== undefined;
    if (!hasChange) throw new Error(`Row ${index} (${label}) changes nothing`);
    return row;
  });
}

async function issueIdsFor(
  identifiers: readonly string[],
  client: LinearClient,
): Promise<Map<string, string>> {
  if (identifiers.length === 0) return new Map();
  const params = identifiers.map((_, i) => `$i${i}: String!`).join(", ");
  const fields = identifiers.map((_, i) => `i${i}: issue(id: $i${i}) { id identifier }`).join(" ");
  const variables = Object.fromEntries(identifiers.map((id, i) => [`i${i}`, id]));
  const result = await client.query<Record<string, { id: string; identifier: string } | null>>(
    `query(${params}) { ${fields} }`,
    variables,
  );

  const ids = new Map<string, string>();
  identifiers.forEach((identifier, i) => {
    const issue = result[`i${i}`];
    if (!issue) throw new Error(`No issue ${identifier}`);
    ids.set(identifier.toUpperCase(), issue.id);
  });
  return ids;
}

async function stateIdsFor(
  names: readonly string[],
  client: LinearClient,
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();
  const result = await client.query<{
    teams: { nodes: { states: { nodes: { id: string; name: string }[] } }[] };
  }>(teamStatesQuery, { key: teamKey });
  const states = result.teams.nodes[0]?.states.nodes ?? [];

  const ids = new Map<string, string>();
  for (const name of names) {
    const state = states.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!state) {
      throw new Error(
        `Team ${teamKey} has no state "${name}"; it has ${states.map((s) => s.name).join(", ")}`,
      );
    }
    ids.set(name.toLowerCase(), state.id);
  }
  return ids;
}

/** Turns identifiers and state names into the ids the mutations take, with one read each. */
export async function resolveRows(
  rows: readonly ChangeRow[],
  client: LinearClient,
): Promise<ResolvedRow[]> {
  const identifiers = [
    ...new Set(
      rows
        .filter((row) => row.issueId === undefined)
        .flatMap((row) => (row.identifier ? [row.identifier.toUpperCase()] : [])),
    ),
  ];
  const stateNames = [...new Set(rows.flatMap((row) => (row.state ? [row.state] : [])))];
  const issueIds = await issueIdsFor(identifiers, client);
  const stateIds = await stateIdsFor(stateNames, client);

  return rows.map(({ state, ...row }) => {
    const issueId = row.issueId ?? issueIds.get(row.identifier?.toUpperCase() ?? "");
    if (issueId === undefined) throw new Error(`No issue id for ${row.identifier ?? "a row"}`);
    const stateId = state === undefined ? row.stateId : stateIds.get(state.toLowerCase());
    return { ...row, issueId, stateId };
  });
}

function updateOf(row: ResolvedRow): IssueUpdate {
  const update: IssueUpdate = {};
  const added = row.addedLabelIds ?? [];
  const removed = row.removedLabelIds ?? [];
  if (added.length > 0) update.addedLabelIds = [...added].sort();
  if (removed.length > 0) update.removedLabelIds = [...removed].sort();
  if (row.projectId !== undefined) update.projectId = row.projectId;
  if (row.stateId !== undefined) update.stateId = row.stateId;
  return update;
}

export function groupChanges(rows: readonly ResolvedRow[]): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  for (const row of rows) {
    const update = updateOf(row);
    const isCommentOnly = Object.keys(update).length === 0;
    if (isCommentOnly) continue;
    const key = JSON.stringify(update);
    const group = groups.get(key) ?? { update, ids: [], identifiers: [] };
    group.ids.push(row.issueId);
    group.identifiers.push(row.identifier ?? row.issueId);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function describeUpdate(update: IssueUpdate): string {
  const parts: string[] = [];
  if (update.addedLabelIds) parts.push(`+labels ${update.addedLabelIds.join(",")}`);
  if (update.removedLabelIds) parts.push(`-labels ${update.removedLabelIds.join(",")}`);
  if (update.projectId !== undefined) parts.push(`project ${update.projectId}`);
  if (update.stateId !== undefined) parts.push(`state ${update.stateId}`);
  return parts.join("; ");
}

async function postComments(rows: readonly ResolvedRow[], deps: ApplyDependencies): Promise<void> {
  for (const row of rows) {
    if (row.comment === undefined) continue;
    const result = await deps.client.query<{ commentCreate: { success: boolean } }>(
      commentCreateMutation,
      { input: { issueId: row.issueId, body: row.comment } },
    );
    const name = row.identifier ?? row.issueId;
    if (!result.commentCreate.success) {
      throw new Error(
        `Comment failed on ${name}; comments before it are posted and no update is applied`,
      );
    }
    deps.write(`commented on ${name}\n`);
  }
}

/**
 * Comments go first, so a ticket never moves without the evidence its row carries, and a failed
 * comment stops the run before any update.
 */
export async function applyChanges(
  rows: readonly ChangeRow[],
  apply: boolean,
  deps: ApplyDependencies,
): Promise<void> {
  const resolved = await resolveRows(rows, deps.client);
  const groups = groupChanges(resolved);
  const commented = resolved.filter((row) => row.comment !== undefined);

  deps.write(`${rows.length} row(s) in ${groups.length} distinct update(s)\n`);
  for (const group of groups) {
    deps.write(`  ${group.ids.length} issue(s): ${describeUpdate(group.update)}\n`);
    deps.write(`    ${group.identifiers.join(" ")}\n`);
  }
  if (commented.length > 0) {
    deps.write(`  ${commented.length} comment(s), posted before any update\n`);
    deps.write(`    ${commented.map((row) => row.identifier ?? row.issueId).join(" ")}\n`);
  }
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return;
  }

  await postComments(resolved, deps);
  for (const group of groups) {
    for (let start = 0; start < group.ids.length; start += deps.batchSize) {
      const ids = group.ids.slice(start, start + deps.batchSize);
      const result = await deps.client.query<{ issueBatchUpdate: { success: boolean } }>(
        batchUpdateMutation,
        { ids, input: group.update },
      );
      if (!result.issueBatchUpdate.success) {
        throw new Error(
          `Batch failed at ${describeUpdate(group.update)}, issues ${start} to ${start + ids.length - 1}; ` +
            "earlier batches are applied, later ones are not",
        );
      }
      deps.write(`applied ${describeUpdate(group.update)} to ${ids.length} issue(s)\n`);
    }
  }
}

export function parseArgs(args: string[]): { file: string; apply: boolean; batchSize: number } {
  const apply = args.includes("--apply");
  const batchIndex = args.indexOf("--batch");
  const batchValue = batchIndex >= 0 ? Number(args[batchIndex + 1]) : 50;
  if (!Number.isInteger(batchValue) || batchValue < 1) {
    throw new Error("--batch requires a positive integer");
  }
  const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--batch");
  if (!file) throw new Error("Usage: linear-apply <change-file.json> [--apply] [--batch N]");
  return { file, apply, batchSize: batchValue };
}

async function run(args: string[]): Promise<number> {
  const { file, apply, batchSize } = parseArgs(args);
  const rows = parseChangeFile(await readFile(pathFromRoot(file, repositoryRoot()), "utf8"));
  const write = (text: string): void => {
    process.stdout.write(text);
  };
  const root = repositoryRoot();
  const apiKey = await requireLinearApiKey(root, process.env);

  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  await applyChanges(rows, apply, { client, write, batchSize });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
