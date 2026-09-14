import { readFile } from "node:fs/promises";

import { repositoryRoot, resolveLinearApiKey } from "../lib/config.js";
import { createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";

export interface IssueUpdate {
  addedLabelIds?: string[];
  removedLabelIds?: string[];
  projectId?: string;
  stateId?: string;
}

export interface ChangeRow extends IssueUpdate {
  issueId: string;
  identifier?: string;
  why?: string;
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

const batchUpdateMutation = `mutation($ids: [UUID!]!, $input: IssueUpdateInput!) {
  issueBatchUpdate(ids: $ids, input: $input) { success }
}`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (issueId === undefined || !uuidPattern.test(issueId)) {
      throw new Error(`Row ${index}: "issueId" must be the issue's UUID, not its OJD identifier`);
    }
    const row: ChangeRow = {
      issueId,
      identifier: optionalString(entry, "identifier", index),
      why: optionalString(entry, "why", index),
      addedLabelIds: optionalStringArray(entry, "addedLabelIds", index),
      removedLabelIds: optionalStringArray(entry, "removedLabelIds", index),
      projectId: optionalString(entry, "projectId", index),
      stateId: optionalString(entry, "stateId", index),
    };
    const hasChange =
      (row.addedLabelIds?.length ?? 0) > 0 ||
      (row.removedLabelIds?.length ?? 0) > 0 ||
      row.projectId !== undefined ||
      row.stateId !== undefined;
    if (!hasChange) throw new Error(`Row ${index} (${issueId}) changes nothing`);
    return row;
  });
}

function updateOf(row: ChangeRow): IssueUpdate {
  const update: IssueUpdate = {};
  const added = row.addedLabelIds ?? [];
  const removed = row.removedLabelIds ?? [];
  if (added.length > 0) update.addedLabelIds = [...added].sort();
  if (removed.length > 0) update.removedLabelIds = [...removed].sort();
  if (row.projectId !== undefined) update.projectId = row.projectId;
  if (row.stateId !== undefined) update.stateId = row.stateId;
  return update;
}

export function groupChanges(rows: readonly ChangeRow[]): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  for (const row of rows) {
    const update = updateOf(row);
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

export async function applyChanges(
  rows: readonly ChangeRow[],
  apply: boolean,
  deps: ApplyDependencies,
): Promise<void> {
  const groups = groupChanges(rows);
  deps.write(`${rows.length} row(s) in ${groups.length} distinct update(s)\n`);
  for (const group of groups) {
    deps.write(`  ${group.ids.length} issue(s): ${describeUpdate(group.update)}\n`);
    deps.write(`    ${group.identifiers.join(" ")}\n`);
  }
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return;
  }

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
  const rows = parseChangeFile(await readFile(file, "utf8"));
  const write = (text: string): void => {
    process.stdout.write(text);
  };
  const apiKey = await resolveLinearApiKey(repositoryRoot(), process.env);
  if (!apiKey) throw new Error("LINEAR_API_KEY is missing; put it in .claude/.env");

  await applyChanges(rows, apply, { client: createLinearClient({ apiKey }), write, batchSize });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
