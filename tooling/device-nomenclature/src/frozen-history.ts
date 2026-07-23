import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizePath } from "./matcher.js";

const execFileAsync = promisify(execFile);

const FROZEN_HISTORY_ROOTS = ["packages/database/drizzle/", "apps/mobile/drizzle/"] as const;
const MUTABLE_HISTORY_PATHS = new Set([
  "packages/database/drizzle/meta/_journal.json",
  "apps/mobile/drizzle/meta/_journal.json",
  "apps/mobile/drizzle/migrations.js",
  "apps/mobile/drizzle/migrations.ts",
]);

export interface GitNameStatusChange {
  status: string;
  paths: readonly string[];
}

export type FrozenHistoryViolation = GitNameStatusChange;

function isFrozenHistoryPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (MUTABLE_HISTORY_PATHS.has(normalized)) return false;
  if (!FROZEN_HISTORY_ROOTS.some((root) => normalized.startsWith(root))) return false;
  return normalized.endsWith(".sql") || /\/meta\/\d+_snapshot\.json$/u.test(normalized);
}

/** Parse `git diff --name-status -z` output without relying on path whitespace. */
export function parseNameStatus(output: string): GitNameStatusChange[] {
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes: GitNameStatusChange[] = [];

  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (!status) throw new Error("Malformed git name-status output: missing status");
    const pathCount = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    const paths = fields.slice(index, index + pathCount).map(normalizePath);
    if (paths.length !== pathCount) {
      throw new Error(`Malformed git name-status output for ${status}`);
    }
    index += pathCount;
    changes.push({ status, paths });
  }

  return changes;
}

/**
 * Existing SQL and numbered snapshots are immutable. New history (`A`) is
 * allowed, while modifications, deletions, renames, and type changes fail.
 * Journals and generated mobile migration imports are intentionally mutable.
 */
export function frozenHistoryViolations(
  changes: readonly GitNameStatusChange[],
): FrozenHistoryViolation[] {
  return changes
    .filter(({ status, paths }) => /^(?:M|D|R|T)/u.test(status) && paths.some(isFrozenHistoryPath))
    .map(({ status, paths }) => ({ status, paths }))
    .toSorted(
      (left, right) =>
        left.paths[0].localeCompare(right.paths[0]) || left.status.localeCompare(right.status),
    );
}

export async function readFrozenHistoryChanges(
  root: string,
  base: string,
  head = "HEAD",
): Promise<GitNameStatusChange[]> {
  const { stdout } = await execFileAsync(
    "git",
    [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      base,
      head,
      "--",
      "packages/database/drizzle",
      "apps/mobile/drizzle",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  return parseNameStatus(stdout);
}

export function formatFrozenHistoryViolation(violation: FrozenHistoryViolation): string {
  return violation.paths.length === 2
    ? `${violation.status} ${violation.paths[0]} -> ${violation.paths[1]}`
    : `${violation.status} ${violation.paths[0]}`;
}
