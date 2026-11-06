import { z } from "zod";

import { STATUS_UPDATES_LIMIT } from "@repo/monitoring/status-content";
import {
  STATUS_HISTORY_DAYS,
  incidentSchema,
  incidentUpdateSchema,
} from "@repo/monitoring/status-document";
import type { Incident, IncidentUpdate } from "@repo/monitoring/status-document";

export const NEW_UPDATE_ID = "new-update";

// Contentful's short text (Symbol) field holds 256 characters at most:
// https://www.contentful.com/developers/docs/concepts/data-model/
export const TITLE_LIMIT = 256;

const DAY_MS = 86_400_000;

type Stage = IncidentUpdate["stage"];

const STAGES_BY_KIND: Record<Incident["kind"], readonly Stage[]> = {
  incident: ["investigating", "identified", "monitoring", "resolved"],
  maintenance: ["scheduled", "in-progress", "completed"],
};

export const FINAL_STAGES: readonly Stage[] = ["resolved", "completed"];

const incidentInputSchema = z.strictObject({
  title: z.string(),
  kind: z.string(),
  impact: z.string(),
  components: z.array(z.string()),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  resolvedAt: z.string().optional(),
});

const updateInputSchema = z.strictObject({
  stage: z.string(),
  text: z.string(),
  postedAt: z.string().optional(),
  nextUpdateBy: z.string().optional(),
});

// The incident block of an update or resolve file only feeds a dry run, which cannot read it.
const previewIncidentSchema = incidentInputSchema.omit({ resolvedAt: true }).optional();

export const draftFileSchema = z.strictObject({
  incident: incidentInputSchema,
  update: updateInputSchema,
});

export const updateFileSchema = z.strictObject({
  incident: previewIncidentSchema,
  update: updateInputSchema,
});

export const resolveFileSchema = z.strictObject({
  incident: previewIncidentSchema,
  resolvedAt: z.string(),
  update: updateInputSchema,
});

export type UpdateInput = z.infer<typeof updateInputSchema>;

/** What an entry holds, field by field, so a half-written one can still be checked. */
export interface RawUpdate {
  id: string;
  stage?: string | undefined;
  postedAt?: string | undefined;
  text?: string | undefined;
  nextUpdateBy?: string | undefined;
}

export interface RawIncident {
  id: string;
  title?: string | undefined;
  kind?: string | undefined;
  impact?: string | undefined;
  components?: string[] | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  resolvedAt?: string | undefined;
  updates: RawUpdate[];
}

export type Change =
  | { action: "publish"; linked?: number }
  | { action: "draft" | "update" | "resolve"; before?: RawIncident };

export interface Dropped {
  scope: "incident" | "update";
  message: string;
}

export interface Check {
  /** Set when the publisher's contract accepts the incident, whatever the rules say. */
  incident?: Incident | undefined;
  dropped: Dropped[];
  rules: string[];
  /** Things worth saying that do not stop the change. */
  warnings: string[];
}

export function readInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const lines = result.error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `- ${where}${issue.message}`;
  });

  throw new Error(`The file is not valid, so nothing was sent.\n${lines.join("\n")}`);
}

function timeOf(value: string | undefined): number {
  return value === undefined ? Number.NaN : Date.parse(value);
}

function valueAt(root: unknown, path: PropertyKey[]): unknown {
  let current = root;

  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = Reflect.get(current, key);
  }

  return current;
}

function fieldLabel(path: PropertyKey[]): string {
  return path.reduce<string>((label, key) => {
    if (typeof key === "number") {
      return `${label}[${key}]`;
    }
    return label === "" ? String(key) : `${label}.${String(key)}`;
  }, "");
}

function stageOf(stage: string | undefined): Stage | undefined {
  const parsed = incidentUpdateSchema.shape.stage.safeParse(stage);
  return parsed.success ? parsed.data : undefined;
}

function kindOf(kind: string | undefined): Incident["kind"] | undefined {
  const parsed = incidentSchema.shape.kind.safeParse(kind);
  return parsed.success ? parsed.data : undefined;
}

function updateLabel(update: RawUpdate): string {
  return update.id === NEW_UPDATE_ID ? "update" : `update ${update.id}`;
}

function describeIssue(issue: z.core.$ZodIssue, raw: RawIncident): Dropped {
  const [first, index, ...rest] = issue.path;
  const update = first === "updates" && typeof index === "number" ? raw.updates[index] : undefined;
  const subject = update === undefined ? "incident" : updateLabel(update);
  const label = `${subject}.${fieldLabel(update === undefined ? issue.path : rest)}`;
  const received = valueAt(raw, issue.path);
  const scope = update === undefined ? "incident" : "update";

  const isAbsent = received === undefined;

  if (isAbsent && (issue.code === "invalid_type" || issue.code === "invalid_value")) {
    return { scope, message: `${label} is missing` };
  }
  if (issue.code === "invalid_value") {
    const allowed = issue.values.join(", ");
    return { scope, message: `${label} ${JSON.stringify(received)} is not one of: ${allowed}` };
  }
  if (issue.code === "invalid_format") {
    const hint = "a UTC time such as 2026-11-04T10:00:00Z";
    return { scope, message: `${label} ${JSON.stringify(received)} is not ${hint}` };
  }
  if (issue.code === "too_small" && issue.origin === "string") {
    return { scope, message: `${label} is empty` };
  }
  if (issue.code === "too_small" && issue.origin === "array") {
    return { scope, message: `${label} needs at least ${issue.minimum} entry` };
  }

  return { scope, message: `${label}: ${issue.message}` };
}

function isBlank(text: string | undefined): boolean {
  return text !== undefined && text.length > 0 && text.trim().length === 0;
}

function repeated(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function incidentRules(raw: RawIncident, nowMs: number): string[] {
  const rules: string[] = [];
  const startsAt = timeOf(raw.startsAt);
  const resolvedAt = timeOf(raw.resolvedAt);
  const isIncident = raw.kind === "incident";
  const isMaintenance = raw.kind === "maintenance";
  const horizon = nowMs - STATUS_HISTORY_DAYS * DAY_MS;
  const isOutOfReach = startsAt < horizon && resolvedAt < horizon;
  const duplicates = repeated(raw.components ?? []);

  if (isBlank(raw.title)) {
    rules.push("incident.title is only whitespace. Write what researchers see.");
  }
  if (raw.title !== undefined && raw.title.length > TITLE_LIMIT) {
    rules.push(
      `incident.title is ${raw.title.length} characters. Contentful allows ${TITLE_LIMIT} in a short text field, and a title should be a few words.`,
    );
  }
  if (duplicates.length > 0) {
    rules.push(`incident.components lists ${duplicates.join(", ")} more than once.`);
  }
  if (isOutOfReach) {
    rules.push(
      `incident.startsAt and incident.resolvedAt are both more than ${STATUS_HISTORY_DAYS} days ago. The status publisher reads incidents from the last ${STATUS_HISTORY_DAYS} days only, so this one would never reach the page or Slack.`,
    );
  }
  if (isIncident && startsAt > nowMs) {
    rules.push(
      "incident.startsAt is in the future. An incident never starts in the future, and the page ignores it until then. Use the real start, or kind maintenance for planned work.",
    );
  }
  if (isIncident && raw.endsAt !== undefined) {
    rules.push("incident.endsAt is for maintenance only. Leave it out for an incident.");
  }
  if (isIncident && timeOf(raw.resolvedAt) < startsAt) {
    rules.push("incident.resolvedAt is before incident.startsAt.");
  }
  if (isMaintenance && raw.endsAt === undefined && raw.resolvedAt === undefined) {
    rules.push(
      "incident.endsAt is missing. Maintenance needs a planned end, or the components stay under maintenance until it is resolved.",
    );
  }
  if (isMaintenance && timeOf(raw.endsAt) <= startsAt) {
    rules.push("incident.endsAt must be after incident.startsAt.");
  }

  return rules;
}

function updateRules(raw: RawIncident, update: RawUpdate): string[] {
  const rules: string[] = [];
  const label = updateLabel(update);
  const stage = stageOf(update.stage);
  const kind = kindOf(raw.kind);
  const isFinal = stage !== undefined && FINAL_STAGES.includes(stage);

  if (isBlank(update.text)) {
    rules.push(`${label}.text is only whitespace. Write what researchers need to know.`);
  }
  if (stage !== undefined && kind !== undefined && !STAGES_BY_KIND[kind].includes(stage)) {
    const allowed = STAGES_BY_KIND[kind].join(", ");
    rules.push(`${label}.stage "${stage}" does not fit kind ${kind}. Use one of: ${allowed}.`);
  }
  if (update.nextUpdateBy !== undefined && timeOf(update.nextUpdateBy) <= timeOf(update.postedAt)) {
    rules.push(`${label}.nextUpdateBy must be after ${label}.postedAt.`);
  }
  if (isFinal && update.nextUpdateBy !== undefined) {
    rules.push(`${label}.nextUpdateBy must be empty on the final stage ${stage}.`);
  }

  return rules;
}

function addedUpdateRules(
  raw: RawIncident,
  added: RawUpdate,
  change: Change,
  nowMs: number,
): string[] {
  const rules: string[] = [];
  const stage = stageOf(added.stage);
  const isFinal = stage !== undefined && FINAL_STAGES.includes(stage);
  const isSet = raw.resolvedAt !== undefined;
  const mayPrecedeStart = raw.kind === "maintenance" && stage === "scheduled";

  if (timeOf(added.postedAt) > nowMs) {
    rules.push("update.postedAt is in the future. Leave it out to post now.");
  }
  if (!mayPrecedeStart && timeOf(added.postedAt) < timeOf(raw.startsAt)) {
    rules.push(
      "update.postedAt is before incident.startsAt. An update cannot be posted before the incident began.",
    );
  }
  if (timeOf(added.nextUpdateBy) < nowMs) {
    rules.push("update.nextUpdateBy is in the past. Give a time you can keep, or leave it out.");
  }
  if (change.action === "draft" && isFinal && !isSet) {
    rules.push(`update.stage "${stage}" needs incident.resolvedAt, which is not set.`);
  }
  if (change.action === "draft" && stage !== undefined && !isFinal && isSet) {
    rules.push("incident.resolvedAt is set, so update.stage must be resolved or completed.");
  }
  if (change.action === "update" && isFinal) {
    rules.push(`update.stage "${stage}" ends the incident. Use the resolve action instead.`);
  }
  if (change.action === "resolve" && stage !== undefined && !isFinal) {
    rules.push(
      `update.stage "${stage}" cannot resolve. Use resolved, or completed for maintenance.`,
    );
  }
  if (change.action !== "update" && timeOf(raw.resolvedAt) > nowMs) {
    rules.push(
      "incident.resolvedAt is in the future, which keeps the incident open. Use the time it ended.",
    );
  }

  return rules;
}

function changeRules(raw: RawIncident, change: Change, nowMs: number): string[] {
  if (change.action === "publish") {
    return publishRules(raw, change.linked ?? raw.updates.length);
  }

  const rules: string[] = [];
  const added = raw.updates.find((update) => update.id === NEW_UPDATE_ID);
  const linked = change.before?.updates.length ?? 0;

  if (added !== undefined) {
    rules.push(...addedUpdateRules(raw, added, change, nowMs));
  }
  if (change.action === "resolve" && change.before?.resolvedAt !== undefined) {
    rules.push(
      `The incident is already resolved at ${change.before.resolvedAt}. Add an update instead.`,
    );
  }
  if (change.action === "update" && linked >= STATUS_UPDATES_LIMIT - 1) {
    rules.push(
      `The incident already links ${linked} updates. It links ${STATUS_UPDATES_LIMIT} at most, and the last place is kept for the update that resolves it. Use the resolve action now, or, if the problem goes on, resolve this incident and draft a new one that continues it.`,
    );
  }
  if (change.action === "resolve" && linked >= STATUS_UPDATES_LIMIT) {
    rules.push(
      `The incident already links ${linked} updates, the most it can hold, so the resolving update has no place. In Contentful, unlink one older update that adds nothing from the Updates field, then run resolve again.`,
    );
  }

  return rules;
}

function publishRules(raw: RawIncident, linked: number): string[] {
  const rules: string[] = [];

  if (raw.updates.length === 0) {
    rules.push("The incident has no updates. Link the first update before the first publish.");
  }
  if (linked > STATUS_UPDATES_LIMIT) {
    rules.push(
      `The incident links ${linked} updates, but it holds ${STATUS_UPDATES_LIMIT} at most and the publisher reads no more. In Contentful, unlink the ${linked - STATUS_UPDATES_LIMIT} oldest that add nothing from the Updates field, then review it again.`,
    );
  }

  return rules;
}

function addedUpdateWarnings(raw: RawIncident): string[] {
  const added = raw.updates.find((update) => update.id === NEW_UPDATE_ID);
  const existing = raw.updates.filter((update) => update.id !== NEW_UPDATE_ID);
  const newest = existing
    .filter((update) => update.postedAt !== undefined)
    .sort((a, b) => timeOf(b.postedAt) - timeOf(a.postedAt))
    .at(0);

  const isOlder =
    added !== undefined && newest !== undefined && timeOf(added.postedAt) < timeOf(newest.postedAt);

  if (added === undefined || newest === undefined || !isOlder) {
    return [];
  }

  return [
    `update.postedAt ${added.postedAt} is earlier than the newest existing update, posted ${newest.postedAt}. The page lists updates newest first by posted time, so this one will not show as the newest.`,
  ];
}

/**
 * Parses the incident with the contract the status publisher uses, which drops what fails it
 * without a trace, then applies the writing guide's rules on top.
 */
export function checkIncident(raw: RawIncident, now: Date, change?: Change): Check {
  const parsed = incidentSchema.safeParse(raw);
  const nowMs = now.getTime();

  return {
    incident: parsed.success ? parsed.data : undefined,
    dropped: parsed.success ? [] : parsed.error.issues.map((issue) => describeIssue(issue, raw)),
    rules: [
      ...incidentRules(raw, nowMs),
      ...raw.updates.flatMap((update) => updateRules(raw, update)),
      ...(change === undefined ? [] : changeRules(raw, change, nowMs)),
    ],
    warnings: change === undefined || change.action === "publish" ? [] : addedUpdateWarnings(raw),
  };
}

export function problemsOf(check: Check): string[] {
  return [...check.dropped.map((entry) => entry.message), ...check.rules];
}

export function requireValid(check: Check): Incident {
  const problems = problemsOf(check);

  if (check.incident === undefined || problems.length > 0) {
    throw new Error(
      `The incident would not pass, so nothing was sent.\n${problems.map((line) => `- ${line}`).join("\n")}`,
    );
  }

  return check.incident;
}
