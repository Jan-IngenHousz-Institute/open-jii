import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { pathFromRoot, posthogKey, repositoryRoot, requireDevkitKey } from "../lib/config.js";
import { createPostHogClient, createPostHogFileAudit, issueUrl, rowsOf } from "../lib/posthog.js";
import type { IssueStatus, PostHogClient } from "../lib/posthog.js";

export const decisions = ["", "keep", "resolve", "suppress", "ticket"] as const;
export type Decision = (typeof decisions)[number];

export interface ReviewEntry {
  id: string;
  name: string;
  description: string;
  service: string;
  environment: string;
  // Mobile development builds report 1.1.0; store builds report 2.x.
  appVersion: string;
  events: number;
  users: number;
  lastSeen: string | null;
  url: string;
  decision: Decision;
  note: string;
}

export type IssuesArgs =
  | { command: "list"; days: number; output: string }
  | { command: "show"; id: string }
  | { command: "apply"; file: string; confirm: boolean };

const defaultReviewFile = ".claude/posthog/issues-review.json";
const issueId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Events from before the apps named their environment and service are placed by library and host.
const serviceExpression =
  "coalesce(properties.service, multiIf(properties.$lib = 'posthog-react-native', 'mobile', " +
  "properties.$lib = 'posthog-node', 'backend', properties.$lib = 'web', 'web', 'unknown'))";
const environmentExpression =
  "coalesce(properties.environment, multiIf(properties.$host = 'openjii.org', 'prod', " +
  "properties.$host = 'dev.openjii.org', 'dev', 'unknown'))";

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv: string[]): IssuesArgs {
  // The root alias runs `pnpm --filter ... posthog:issues --`, which hands the `--` through.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const [command, first] = args;
  if (command === "list") {
    const days = Number(optionAfter(args, "--days") ?? "90");
    if (!Number.isInteger(days) || days < 1)
      throw new Error("--days must be a positive whole number");
    return { command, days, output: optionAfter(args, "--output") ?? defaultReviewFile };
  }
  if (command === "show") {
    if (!first || !issueId.test(first)) throw new Error("show takes one PostHog issue id");
    return { command, id: first };
  }
  if (command === "apply") {
    return {
      command,
      file: optionAfter(args, "--file") ?? defaultReviewFile,
      confirm: args.includes("--confirm"),
    };
  }
  throw new Error(
    "Usage: posthog:issues list [--days N] [--output file] | show <id> | apply [--file file] [--confirm]",
  );
}

export function listQuery(days: number): string {
  return `SELECT i.id AS id, i.name AS name, i.description AS description, e.service AS service,
  e.environment AS environment, e.app_version AS app_version, e.events AS events, e.users AS users,
  e.last_seen AS last_seen
FROM system.error_tracking_issues AS i
LEFT JOIN (
  SELECT issue_id, count() AS events, uniq(distinct_id) AS users, max(timestamp) AS last_seen,
    any(${serviceExpression}) AS service, any(${environmentExpression}) AS environment,
    any(properties.$app_version) AS app_version
  FROM events
  WHERE event = '$exception' AND timestamp > now() - INTERVAL ${days} DAY
  GROUP BY issue_id
) AS e ON e.issue_id = i.id
WHERE i.status = 'active'
ORDER BY events DESC
LIMIT 5000`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export async function listIssues(client: PostHogClient, days: number): Promise<ReviewEntry[]> {
  const rows = rowsOf(await client.query(listQuery(days)));
  return rows.map((row) => {
    // An issue quiet in the window has no joined row, and ClickHouse fills the gap with the epoch.
    const hasEvents = count(row.events) > 0;
    return {
      id: text(row.id),
      name: text(row.name),
      description: text(row.description).slice(0, 300),
      service: text(row.service) || "unknown",
      environment: text(row.environment) || "unknown",
      appVersion: text(row.app_version),
      events: count(row.events),
      users: count(row.users),
      lastSeen: hasEvents ? text(row.last_seen) || null : null,
      url: issueUrl(text(row.id)),
      decision: "",
      note: "",
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is Decision {
  return decisions.some((decision) => decision === value);
}

export function parseReview(content: string): ReviewEntry[] {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) throw new Error("The review file must hold a JSON array");
  return parsed.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !issueId.test(entry.id)) {
      throw new Error(`Entry ${index} has no valid issue id`);
    }
    if (!isDecision(entry.decision)) {
      throw new Error(`Entry ${index} (${entry.id}) has decision ${String(entry.decision)}`);
    }
    return {
      id: entry.id,
      name: text(entry.name),
      description: text(entry.description),
      service: text(entry.service),
      environment: text(entry.environment),
      appVersion: text(entry.appVersion),
      events: count(entry.events),
      users: count(entry.users),
      lastSeen: text(entry.lastSeen) || null,
      url: text(entry.url),
      decision: entry.decision,
      note: text(entry.note),
    };
  });
}

const statusByDecision: Partial<Record<Decision, IssueStatus>> = {
  resolve: "resolved",
  suppress: "suppressed",
};

export interface ApplyPlan {
  changes: { entry: ReviewEntry; status: IssueStatus }[];
  tickets: ReviewEntry[];
  undecided: number;
}

export function planApply(entries: ReviewEntry[]): ApplyPlan {
  const changes = entries.flatMap((entry) => {
    const status = statusByDecision[entry.decision];
    return status === undefined ? [] : [{ entry, status }];
  });
  return {
    changes,
    tickets: entries.filter((entry) => entry.decision === "ticket"),
    undecided: entries.filter((entry) => entry.decision === "").length,
  };
}

// Applied only with --confirm; a ticket decision is listed for the ticket skills, never filed here.
export async function applyPlan(
  plan: ApplyPlan,
  client: PostHogClient,
  confirm: boolean,
  write: (text: string) => void,
): Promise<void> {
  for (const { entry, status } of plan.changes) {
    write(
      `${confirm ? "" : "would "}set ${entry.id} (${entry.service}: ${entry.name}) to ${status}\n`,
    );
    if (confirm) await client.setIssueStatus(entry.id, status);
  }
  for (const entry of plan.tickets) {
    write(`to ticket: ${entry.url} ${entry.name}: ${entry.description.slice(0, 120)}\n`);
  }
  write(
    `${plan.changes.length} status change(s)${confirm ? "" : " planned; pass --confirm to apply"}, ` +
      `${plan.tickets.length} to ticket, ${plan.undecided} undecided\n`,
  );
}

interface ExceptionFrame {
  function: string;
  location: string;
}

interface ExceptionSample {
  type: string;
  value: string;
  frames: ExceptionFrame[];
}

// Only what triage needs: no person properties, IP or full URLs leave PostHog.
export function sampleQuery(id: string): string {
  return `SELECT timestamp, ${serviceExpression} AS service, ${environmentExpression} AS environment,
  properties.$lib AS lib, properties.$app_version AS app_version, properties.$pathname AS pathname,
  properties.$exception_list AS exceptions
FROM events
WHERE event = '$exception' AND issue_id = '${id}'
ORDER BY timestamp DESC
LIMIT 1`;
}

// Resolved frames carry `line`; raw ones only `lineno`.
function lineOf(frame: Record<string, unknown>): string {
  const line = frame.line ?? frame.lineno;
  return typeof line === "number" ? String(line) : "?";
}

// A development bundle's URL carries a long query string that says nothing about the frame.
function fileOf(frame: Record<string, unknown>): string {
  const file = text(frame.source) || text(frame.filename) || "?";
  return file.replace(/[?&].*$/, "").slice(0, 120);
}

export function exceptionSamples(raw: unknown): ExceptionSample[] {
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isRecord).map((exception) => {
    const stacktrace = isRecord(exception.stacktrace) ? exception.stacktrace : {};
    const frames = Array.isArray(stacktrace.frames) ? stacktrace.frames.filter(isRecord) : [];
    return {
      type: text(exception.type),
      value: text(exception.value).slice(0, 500),
      // Innermost last in PostHog's order; the top of the stack is what triage reads first.
      frames: frames
        .slice(-8)
        .reverse()
        .map((frame) => ({
          function: text(frame.function) || "?",
          location: `${fileOf(frame)}:${lineOf(frame)}`,
        })),
    };
  });
}

export async function showIssue(
  client: PostHogClient,
  id: string,
  write: (text: string) => void,
): Promise<void> {
  const [issue, stats] = await Promise.all([
    client.query(
      `SELECT name, description, status FROM system.error_tracking_issues WHERE id = '${id}'`,
    ),
    client.query(
      `SELECT count() AS events, uniq(distinct_id) AS users, min(timestamp) AS first_seen,
  max(timestamp) AS last_seen FROM events WHERE event = '$exception' AND issue_id = '${id}'`,
    ),
  ]);
  const record = rowsOf(issue).at(0);
  if (record === undefined) throw new Error(`No issue ${id} in the project`);
  const summary = rowsOf(stats).at(0);
  const sample = rowsOf(await client.query(sampleQuery(id))).at(0);

  write(`${text(record.name)}: ${text(record.description)}\n`);
  write(`status ${text(record.status)}, ${issueUrl(id)}\n`);
  if (summary !== undefined && count(summary.events) > 0) {
    write(
      `${count(summary.events)} events, ${count(summary.users)} users, ` +
        `first ${text(summary.first_seen)}, last ${text(summary.last_seen)}\n`,
    );
  } else {
    write("no events left in PostHog's retention\n");
  }
  if (sample === undefined) return;
  write(
    `latest: ${text(sample.timestamp)} ${text(sample.service)} on ${text(sample.environment)}, ` +
      `lib ${text(sample.lib)}, app ${text(sample.app_version) || "-"}, path ${text(sample.pathname) || "-"}\n`,
  );
  for (const exception of exceptionSamples(sample.exceptions)) {
    write(`  ${exception.type}: ${exception.value}\n`);
    for (const frame of exception.frames) write(`    at ${frame.function} (${frame.location})\n`);
  }
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const client = createPostHogClient({
    apiKey: await requireDevkitKey(root, process.env, posthogKey),
    audit: createPostHogFileAudit(root),
  });
  const write = (line: string) => {
    process.stdout.write(line);
  };

  if (parsed.command === "list") {
    const entries = await listIssues(client, parsed.days);
    const output = pathFromRoot(parsed.output, root);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(entries, null, 2)}\n`);
    write(`wrote ${entries.length} open issues to ${output}; set each decision, then run apply\n`);
    return 0;
  }
  if (parsed.command === "show") {
    await showIssue(client, parsed.id, write);
    return 0;
  }
  const entries = parseReview(await readFile(pathFromRoot(parsed.file, root), "utf8"));
  await applyPlan(planApply(entries), client, parsed.confirm, write);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
