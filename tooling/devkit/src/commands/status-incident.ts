import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";

import {
  STATUS_CONTENTFUL_ENVIRONMENT,
  STATUS_CONTENT_LOCALE,
  isoOf,
} from "@repo/monitoring/status-content";
import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";
import type { Incident } from "@repo/monitoring/status-document";

import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import { publicationState } from "../lib/content-model.js";
import {
  ContentfulManagement,
  createContentfulAudit,
  loadContentfulConfig,
} from "../lib/contentful-management.js";
import type {
  ContentfulAudit,
  ContentfulConfig,
  Entry,
  Preflight as ClientPreflight,
} from "../lib/contentful-management.js";
import { renderPreview } from "../lib/status-incident-preview.js";
import type { Target } from "../lib/status-incident-preview.js";
import { Review } from "../lib/status-incident-review.js";
import type { ReviewSummary } from "../lib/status-incident-review.js";
import {
  FINAL_STAGES,
  NEW_UPDATE_ID,
  checkIncident,
  draftFileSchema,
  problemsOf,
  readInput,
  requireValid,
  resolveFileSchema,
  updateFileSchema,
} from "../lib/status-incident-rules.js";
import type { RawIncident, RawUpdate, UpdateInput } from "../lib/status-incident-rules.js";

export interface Deps {
  request: typeof fetch;
  audit?: ContentfulAudit;
  write: (text: string) => void;
  now: () => Date;
}

export type Action = "preflight" | "inspect" | "draft" | "update" | "resolve" | "publish";

export type Options =
  | { action: "preflight" | "inspect" }
  | { action: "draft"; input: unknown; dryRun: boolean; target?: Target }
  | {
      action: "update" | "resolve";
      entryId: string;
      input: unknown;
      dryRun: boolean;
      target?: Target;
    }
  | {
      action: "publish";
      entryId: string;
      dryRun: boolean;
      review?: string;
      environment?: string;
      target?: Target;
    };

type EntryState = "draft" | "published" | "changed" | "archived";

interface StatusPreflight extends ClientPreflight {
  warnings: string[];
}

interface InspectedUpdate {
  id: string;
  stage: string | undefined;
  postedAt: string | undefined;
  state: EntryState;
  version: number;
}

interface InspectedIncident {
  id: string;
  title: string | undefined;
  kind: string | undefined;
  impact: string | undefined;
  components: string[] | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
  resolvedAt: string | undefined;
  state: EntryState;
  version: number;
  updates: InspectedUpdate[];
  flags: string[];
}

interface Inspection {
  environment: string;
  warnings: string[];
  incidents: InspectedIncident[];
}

interface DryRun {
  dryRun: true;
  networkRequests: 0;
  action: "draft" | "update" | "resolve";
  warnings: string[];
}

interface Drafted {
  drafted: true;
  incident: { id: string; version: number; state: EntryState };
  update: { id: string; version: number };
  review: ReviewSummary;
  next: string;
  note?: string;
  warnings: string[];
}

interface PublishDryRun {
  dryRun: true;
  readsContentful: true;
  writes: 0;
  action: "publish";
  review: ReviewSummary;
  note: string;
  warnings: string[];
}

interface Published {
  published: true;
  updates: { id: string; stage: string | undefined; version: number }[];
  incident: { id: string; version: number };
  note: string;
  warnings: string[];
}

export type Result = StatusPreflight | Inspection | DryRun | Drafted | PublishDryRun | Published;

const PUBLISH_DRY_RUN_NOTE =
  "This dry run reads Contentful, unlike the dry runs of draft, update and resolve, which read nothing. It writes nothing.";
const DRAFT_AGAIN_NOTE =
  "Running draft again creates a second incident. Run inspect to see what exists.";
const NEW_INCIDENT_ID = "new-incident";
const DAY_MS = 86_400_000;
const LOOKUP_CHUNK = 50;

const linksSchema = z.array(z.object({ sys: z.object({ id: z.string() }) }));

const incidentFieldsSchema = z.object({
  title: z.string().optional(),
  kind: z.string().optional(),
  impact: z.string().optional(),
  components: z.array(z.string()).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  updates: linksSchema.optional(),
});

const updateFieldsSchema = z.object({
  stage: z.string().optional(),
  postedAt: z.string().optional(),
  text: z.string().optional(),
  nextUpdateBy: z.string().optional(),
});

function environmentWarnings(environment: string): string[] {
  if (environment === "" || environment === STATUS_CONTENTFUL_ENVIRONMENT) {
    return [];
  }

  return [
    `Environment "${environment}" is not "${STATUS_CONTENTFUL_ENVIRONMENT}". The status publisher reads ${STATUS_CONTENTFUL_ENVIRONMENT} only, so incidents written here never reach the page.`,
  ];
}

function stateOf(sys: Entry["sys"]): EntryState {
  if (sys.archivedVersion !== undefined) {
    return "archived";
  }

  return publicationState(sys.version, sys.publishedVersion);
}

function fieldsOf(entry: Entry): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entry.fields).map(([id, byLocale]) => [id, byLocale[STATUS_CONTENT_LOCALE]]),
  );
}

function rawUpdateOf(entry: Entry): RawUpdate {
  const fields = updateFieldsSchema.parse(fieldsOf(entry));

  return {
    id: entry.sys.id,
    stage: fields.stage,
    text: fields.text,
    postedAt: isoOf(fields.postedAt),
    nextUpdateBy: isoOf(fields.nextUpdateBy),
  };
}

function linkedIdsOf(entry: Entry): string[] {
  const fields = incidentFieldsSchema.parse(fieldsOf(entry));
  return (fields.updates ?? []).map((link) => link.sys.id);
}

function rawIncidentOf(entry: Entry, updates: RawUpdate[]): RawIncident {
  const fields = incidentFieldsSchema.parse(fieldsOf(entry));

  return {
    id: entry.sys.id,
    title: fields.title,
    kind: fields.kind,
    impact: fields.impact,
    components: fields.components,
    startsAt: isoOf(fields.startsAt),
    endsAt: isoOf(fields.endsAt),
    resolvedAt: isoOf(fields.resolvedAt),
    updates,
  };
}

function updateFieldsOf(update: RawUpdate): Entry["fields"] {
  return localized({
    stage: update.stage,
    postedAt: update.postedAt,
    text: update.text,
    nextUpdateBy: update.nextUpdateBy,
  });
}

function localized(fields: Record<string, unknown>): Entry["fields"] {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([id, value]) => [id, { [STATUS_CONTENT_LOCALE]: value }]),
  );
}

function link(id: string) {
  return { sys: { type: "Link", linkType: "Entry", id } };
}

async function fetchEntries(
  client: ContentfulManagement,
  contentType: string,
  ids: string[],
): Promise<Map<string, Entry>> {
  const found = new Map<string, Entry>();

  for (let start = 0; start < ids.length; start += LOOKUP_CHUNK) {
    const list = await client.listEntries(contentType, {
      "sys.id[in]": ids.slice(start, start + LOOKUP_CHUNK).join(","),
      limit: String(LOOKUP_CHUNK),
    });

    for (const entry of list.items) {
      found.set(entry.sys.id, entry);
    }
  }

  return found;
}

function inOrder(ids: string[], found: Map<string, Entry>): Entry[] {
  return ids.flatMap((id) => found.get(id) ?? []);
}

export function preflight(config: ContentfulConfig): StatusPreflight {
  return {
    ...new ContentfulManagement(config).preflight(),
    warnings: environmentWarnings(config.environment),
  };
}

function updateFlags(id: string, entry: Entry | undefined): string[] {
  if (entry === undefined) {
    return [`update ${id} is linked but was not found, so the publisher cannot read it.`];
  }

  switch (stateOf(entry.sys)) {
    case "draft":
      return [`update ${id} is a draft. The publisher cannot read it, so the page leaves it out.`];
    case "archived":
      return [`update ${id} is archived. The publisher cannot read it, so the page leaves it out.`];
    case "changed":
      return [`update ${id} has unpublished changes. The page shows its last published text.`];
    case "published":
      return [];
  }
}

function incidentFlags(entry: Entry): string[] {
  switch (stateOf(entry.sys)) {
    case "draft":
      return [
        "The incident is a draft. The publisher cannot read it, so the page leaves the whole incident out.",
      ];
    case "archived":
      return [
        "The incident is archived. The publisher cannot read it, so the page leaves the whole incident out.",
      ];
    case "changed":
      return [
        "The incident has unpublished changes. The page shows its last published fields, and the checks above read the saved draft.",
      ];
    case "published":
      return [];
  }
}

function inspectedOf(entry: Entry, updates: Map<string, Entry>, now: Date): InspectedIncident {
  const ids = linkedIdsOf(entry);
  const linked = inOrder(ids, updates);
  const raw = rawIncidentOf(entry, linked.map(rawUpdateOf));
  const check = checkIncident(raw, now);

  return {
    id: entry.sys.id,
    title: raw.title,
    kind: raw.kind,
    impact: raw.impact,
    components: raw.components,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    resolvedAt: raw.resolvedAt,
    state: stateOf(entry.sys),
    version: entry.sys.version,
    updates: linked.map((update, index) => ({
      id: update.sys.id,
      stage: raw.updates[index]?.stage,
      postedAt: raw.updates[index]?.postedAt,
      state: stateOf(update.sys),
      version: update.sys.version,
    })),
    flags: [
      ...incidentFlags(entry),
      ...check.dropped.map(({ scope, message }) => `The publisher drops this ${scope}: ${message}`),
      ...check.rules,
      ...ids.flatMap((id) => updateFlags(id, updates.get(id))),
    ],
  };
}

function listIncidents(client: ContentfulManagement, filter: Record<string, string>) {
  return client.listEntries("statusIncident", {
    order: "-fields.startsAt",
    limit: "100",
    ...filter,
  });
}

async function inspect(client: ContentfulManagement, deps: Deps): Promise<Inspection> {
  client.requireConfig();

  const now = deps.now();
  const since = new Date(now.getTime() - STATUS_HISTORY_DAYS * DAY_MS).toISOString();
  const warnings = environmentWarnings(client.environment);

  const open = await listIncidents(client, { "fields.resolvedAt[exists]": "false" });
  const recent = await listIncidents(client, { "fields.resolvedAt[gte]": since });

  for (const list of [open, recent]) {
    if (list.total > list.items.length) {
      warnings.push(`Contentful has ${list.total} matching incidents; only the newest are listed.`);
    }
  }

  const byId = new Map([...open.items, ...recent.items].map((entry) => [entry.sys.id, entry]));
  const entries = [...byId.values()];
  const updateIds = [...new Set(entries.flatMap(linkedIdsOf))];
  const updates = await fetchEntries(client, "statusUpdate", updateIds);

  return {
    environment: client.environment,
    warnings,
    incidents: entries
      .map((entry) => inspectedOf(entry, updates, now))
      .sort((a, b) => Date.parse(b.startsAt ?? "") - Date.parse(a.startsAt ?? "")),
  };
}

function newUpdateOf(input: UpdateInput, now: Date): RawUpdate {
  return { id: NEW_UPDATE_ID, ...input, postedAt: input.postedAt ?? now.toISOString() };
}

interface PreviewContext {
  now: Date;
  warnings: string[];
  target: Target;
}

function preview(
  before: Incident | undefined,
  after: Incident,
  told: string[],
  { now, warnings, target }: PreviewContext,
): string {
  const heading = warnings.map((warning) => `Warning: ${warning}`);
  const body = renderPreview({ before, after, told, now, target });

  return `${[...heading, ...(heading.length > 0 ? [""] : []), body].join("\n")}\n`;
}

type FindLinking = () => Promise<Entry | undefined>;

async function adviceAfterFailure(
  reason: string,
  updateId: string,
  findLinking: FindLinking,
): Promise<string> {
  let incident: Entry | undefined;

  try {
    incident = await findLinking();
  } catch {
    return `${reason}. The incident could not be read back to check whether it links update draft ${updateId}. Do not delete that update draft yet: run inspect, and delete it only if no incident links it.`;
  }

  if (incident !== undefined) {
    return `${reason}. The write went through anyway: incident ${incident.sys.id} (saved version ${incident.sys.version}) links update ${updateId}, so do not delete that update. Review it with: ${publishDryRunCommand(incident.sys.id)}`;
  }

  return `${reason}. Reading the incident back shows that update draft ${updateId} is not linked, so delete it in Contentful before trying again. After a timeout, wait a minute and run inspect first, in case the write still lands.`;
}

async function afterCreating<T>(
  updateId: string,
  findLinking: FindLinking,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The request failed";
    throw new Error(await adviceAfterFailure(reason, updateId, findLinking));
  }
}

function incidentLinking(client: ContentfulManagement, entryId: string, updateId: string) {
  return async (): Promise<Entry | undefined> => {
    const entry = await client.getEntry(entryId);
    return linkedIdsOf(entry).includes(updateId) ? entry : undefined;
  };
}

function newestIncidentLinking(client: ContentfulManagement, updateId: string) {
  return async (): Promise<Entry | undefined> => {
    const list = await client.listEntries("statusIncident", {
      order: "-sys.createdAt",
      limit: "20",
    });
    return list.items.find((entry) => linkedIdsOf(entry).includes(updateId));
  };
}

function publishDryRunCommand(id: string): string {
  return `pnpm status:incident publish --entry-id ${id} --dry-run`;
}

function publishCommand(id: string, token: string): string {
  return `pnpm status:incident publish --entry-id ${id} --review ${token} --environment <environment>`;
}

async function draft(
  options: Extract<Options, { action: "draft" }>,
  client: ContentfulManagement,
  deps: Deps,
): Promise<DryRun | Drafted> {
  const file = readInput(draftFileSchema, options.input);
  const now = deps.now();
  const added = newUpdateOf(file.update, now);
  const raw: RawIncident = { id: NEW_INCIDENT_ID, ...file.incident, updates: [added] };
  const check = checkIncident(raw, now, { action: "draft" });
  const incident = requireValid(check);
  const warnings = [...environmentWarnings(client.environment), ...check.warnings];

  if (!options.dryRun) {
    client.requireConfig();
  }

  deps.write(preview(undefined, incident, [], { now, warnings, target: options.target ?? "prod" }));

  if (options.dryRun) {
    return { dryRun: true, networkRequests: 0, action: "draft", warnings };
  }

  const update = await client.createEntry("statusUpdate", updateFieldsOf(added));
  const created = await afterCreating(
    update.sys.id,
    newestIncidentLinking(client, update.sys.id),
    () =>
      client.createEntry(
        "statusIncident",
        localized({ ...file.incident, updates: [link(update.sys.id)] }),
      ),
  );
  const review = Review.of(created, [update]);

  return {
    drafted: true,
    incident: { id: created.sys.id, version: created.sys.version, state: stateOf(created.sys) },
    update: { id: update.sys.id, version: update.sys.version },
    review: review.summary(),
    next: `Review both drafts in Contentful, then run: ${publishCommand(created.sys.id, review.token)}`,
    note: DRAFT_AGAIN_NOTE,
    warnings,
  };
}

interface Loaded {
  entry: Entry;
  linked: string[];
  updates: Entry[];
  raw: RawIncident;
}

async function loadIncident(client: ContentfulManagement, entryId: string): Promise<Loaded> {
  const entry = await client.getEntry(entryId);
  const type = entry.sys.contentType.sys.id;

  if (type !== "statusIncident") {
    throw new Error(`Entry ${entryId} is a ${type}, not a statusIncident`);
  }

  const linked = linkedIdsOf(entry);
  const updates = inOrder(linked, await fetchEntries(client, "statusUpdate", linked));

  return { entry, linked, updates, raw: rawIncidentOf(entry, updates.map(rawUpdateOf)) };
}

function isAnnounced(entry: Entry): boolean {
  const state = stateOf(entry.sys);
  return state === "published" || state === "changed";
}

function previousOf(after: Incident, action: "update" | "resolve"): Incident {
  const updates = after.updates.filter((update) => update.id !== NEW_UPDATE_ID);

  if (action === "update") {
    return { ...after, updates };
  }

  const { resolvedAt: _resolvedAt, ...open } = after;
  return { ...open, updates };
}

interface Basis {
  before: RawIncident;
  told: string[];
  wasAnnounced: boolean;
}

interface AmendFile {
  incident?: Omit<RawIncident, "id" | "updates" | "resolvedAt"> | undefined;
  resolvedAt?: string | undefined;
  update: UpdateInput;
}

function basisOfLoaded(loaded: Loaded): Basis {
  return {
    before: loaded.raw,
    told: loaded.updates.filter(isAnnounced).map((update) => update.sys.id),
    wasAnnounced: loaded.entry.sys.publishedVersion !== undefined,
  };
}

function planAmend(
  action: "update" | "resolve",
  basis: Basis,
  file: AmendFile,
  context: PreviewContext,
) {
  const { now } = context;
  const added = newUpdateOf(file.update, now);
  const after: RawIncident = {
    ...basis.before,
    resolvedAt: file.resolvedAt ?? basis.before.resolvedAt,
    updates: [...basis.before.updates, added],
  };
  const check = checkIncident(after, now, { action, before: basis.before });
  const incident = requireValid(check);
  const previous = basis.wasAnnounced ? previousOf(incident, action) : undefined;
  const warnings = [...context.warnings, ...check.warnings];

  return {
    added,
    warnings,
    text: preview(previous, incident, basis.told, { ...context, warnings }),
  };
}

async function amend(
  options: Extract<Options, { action: "update" | "resolve" }>,
  client: ContentfulManagement,
  deps: Deps,
): Promise<DryRun | Drafted> {
  ContentfulManagement.requireEntryId(options.entryId);

  const file =
    options.action === "resolve"
      ? readInput(resolveFileSchema, options.input)
      : { ...readInput(updateFileSchema, options.input), resolvedAt: undefined };
  const context: PreviewContext = {
    now: deps.now(),
    warnings: environmentWarnings(client.environment),
    target: options.target ?? "prod",
  };

  if (options.dryRun) {
    return amendOffline(options.action, options.entryId, file, context, deps);
  }

  client.requireConfig();

  if (file.incident !== undefined) {
    deps.write(
      "Note: the incident block in the file is ignored; the incident is read from Contentful.\n",
    );
  }

  const loaded = await loadIncident(client, options.entryId);
  const plan = planAmend(options.action, basisOfLoaded(loaded), file, context);

  deps.write(plan.text);

  const update = await client.createEntry("statusUpdate", updateFieldsOf(plan.added));
  const { entry } = loaded;
  const saved = await afterCreating(
    update.sys.id,
    incidentLinking(client, entry.sys.id, update.sys.id),
    () =>
      client.updateEntry(entry, {
        ...entry.fields,
        ...localized({
          updates: [...loaded.linked, update.sys.id].map(link),
          resolvedAt: file.resolvedAt,
        }),
      }),
  );
  const review = Review.of(saved, [...loaded.updates, update]);

  return {
    drafted: true,
    incident: { id: saved.sys.id, version: saved.sys.version, state: stateOf(saved.sys) },
    update: { id: update.sys.id, version: update.sys.version },
    review: review.summary(),
    next: `Review the drafts in Contentful, then run: ${publishCommand(saved.sys.id, review.token)}`,
    warnings: plan.warnings,
  };
}

function amendOffline(
  action: "update" | "resolve",
  entryId: string,
  file: AmendFile,
  context: PreviewContext,
  deps: Deps,
): DryRun {
  if (file.incident === undefined) {
    throw new Error(
      "A dry run makes no requests, so it cannot read the incident. Add an incident block to the file (title, kind, impact, components, startsAt, endsAt) to preview offline.",
    );
  }

  const basis: Basis = {
    before: { id: entryId, ...file.incident, updates: [] },
    told: [],
    wasAnnounced: true,
  };
  const plan = planAmend(action, basis, file, context);

  deps.write(plan.text);

  return { dryRun: true, networkRequests: 0, action, warnings: plan.warnings };
}

async function publishEntry(client: ContentfulManagement, entry: Entry): Promise<number> {
  const version = entry.sys.version;
  const published = await client.publishEntry(entry);

  if (published.sys.publishedVersion !== version) {
    throw new Error(`Published version of ${entry.sys.id} differs; inspect it before continuing`);
  }

  return version;
}

function publishFailure(error: unknown, subject: string, published: Published["updates"]): Error {
  const reason = error instanceof Error ? error.message : "The request failed";
  const done = published.map((update) => update.id).join(", ") || "none";

  return new Error(
    `${reason}. Publishing ${subject} failed. Updates published so far: ${done}. A rerun is safe: it skips what is published and publishes the rest, the incident last, and the same review token still applies unless someone edits an entry. If the rerun says there is nothing to publish, the publish that stopped had gone through.`,
  );
}

// Of the updates the publisher has not announced, a final one means this publish ends the incident.
function announcedView(after: Incident, loaded: Loaded, told: string[]): Incident | undefined {
  if (loaded.entry.sys.publishedVersion === undefined) {
    return undefined;
  }

  const updates = after.updates.filter((update) => told.includes(update.id));
  const isEnding = after.updates.some(
    (update) => !told.includes(update.id) && FINAL_STAGES.includes(update.stage),
  );
  const { resolvedAt: _resolvedAt, ...open } = after;

  return isEnding ? { ...open, updates } : { ...after, updates };
}

function movedMessage(reviewed: string, review: Review): string {
  const state = review
    .covers()
    .map((line) => `- ${line}`)
    .join("\n");

  return [
    `The incident or its updates changed since the review, so nothing was published. The review token was ${reviewed} and the live state gives ${review.token}. The live state is:`,
    state,
    `The preview above is the text as it stands now. Show it to the person again and ask before publishing with --review ${review.token}.`,
  ].join("\n");
}

async function publish(
  options: Extract<Options, { action: "publish" }>,
  client: ContentfulManagement,
  deps: Deps,
): Promise<Published | PublishDryRun> {
  ContentfulManagement.requireEntryId(options.entryId);
  client.requireConfig();

  if (!options.dryRun) {
    client.requireNamedEnvironment(options.environment);
  }
  if (!options.dryRun && (options.review === undefined || options.review === "")) {
    throw new Error(
      "publish requires --review <token>, the one printed after the review by draft, update, resolve or publish --dry-run.",
    );
  }

  const loaded = await loadIncident(client, options.entryId);
  const { entry } = loaded;
  const now = deps.now();
  const missing = loaded.linked.filter((id) => !loaded.updates.some((u) => u.sys.id === id));
  const unreadable = loaded.updates.filter((update) => stateOf(update.sys) === "archived");
  const pending = loaded.updates.filter((update) =>
    ["draft", "changed"].includes(stateOf(update.sys)),
  );
  const isUnchanged = stateOf(entry.sys) === "published" && pending.length === 0;

  const check = checkIncident(loaded.raw, now, { action: "publish", linked: loaded.linked.length });
  const problems = [
    ...problemsOf(check),
    ...missing.map((id) => `update ${id} is linked but was not found.`),
    ...unreadable.map((update) => `update ${update.sys.id} is archived. Unarchive it first.`),
  ];

  if (problems.length > 0 || check.incident === undefined) {
    throw new Error(
      `The incident would not pass, so nothing was published.\n${problems.map((line) => `- ${line}`).join("\n")}`,
    );
  }
  if (isUnchanged) {
    throw new Error("Nothing to publish: the incident and its updates are all published.");
  }

  const review = Review.of(entry, loaded.updates);
  const { told } = basisOfLoaded(loaded);
  const warnings = environmentWarnings(client.environment);
  const text = preview(announcedView(check.incident, loaded, told), check.incident, told, {
    now,
    warnings,
    target: options.target ?? "prod",
  });

  if (options.dryRun) {
    deps.write(`${PUBLISH_DRY_RUN_NOTE}\n\n${text}`);

    return {
      dryRun: true,
      readsContentful: true,
      writes: 0,
      action: "publish",
      review: review.summary(),
      note: PUBLISH_DRY_RUN_NOTE,
      warnings,
    };
  }

  deps.write(text);

  if (review.token !== options.review) {
    throw new Error(movedMessage(options.review ?? "", review));
  }

  const published: Published["updates"] = [];

  for (const update of pending) {
    const version = await publishEntry(client, update).catch((error: unknown) => {
      throw publishFailure(error, `update ${update.sys.id}`, published);
    });
    published.push({ id: update.sys.id, stage: rawUpdateOf(update).stage, version });
  }

  const incidentVersion = await publishEntry(client, entry).catch((error: unknown) => {
    throw publishFailure(error, `incident ${entry.sys.id}`, published);
  });

  return {
    published: true,
    updates: published,
    incident: { id: entry.sys.id, version: incidentVersion },
    note: "The status publisher picks this up within about two minutes and posts each new update to Slack once. Slack posts are final.",
    warnings,
  };
}

export async function statusIncident(
  options: Options,
  config: ContentfulConfig,
  deps: Deps,
): Promise<Result> {
  const client = new ContentfulManagement(config, deps.request, deps.audit);

  switch (options.action) {
    case "preflight":
      return preflight(config);
    case "inspect":
      return inspect(client, deps);
    case "draft":
      return draft(options, client, deps);
    case "update":
    case "resolve":
      return amend(options, client, deps);
    case "publish":
      return publish(options, client, deps);
  }
}

export interface Args {
  action: Action;
  file?: string;
  entryId?: string;
  review?: string;
  environment?: string;
  target?: Target;
  dryRun: boolean;
}

interface ActionFlags {
  allowed: string[];
  required: string[];
  requiredToWrite?: string[];
}

const ACTIONS: Record<Action, ActionFlags> = {
  preflight: { allowed: [], required: [] },
  inspect: { allowed: [], required: [] },
  draft: { allowed: ["file", "dry-run", "target"], required: ["file"] },
  update: { allowed: ["file", "entry-id", "dry-run", "target"], required: ["file", "entry-id"] },
  resolve: { allowed: ["file", "entry-id", "dry-run", "target"], required: ["file", "entry-id"] },
  publish: {
    allowed: ["entry-id", "review", "environment", "dry-run", "target"],
    required: ["entry-id"],
    requiredToWrite: ["review", "environment"],
  },
};

const USAGE =
  "Usage: status:incident preflight | inspect | draft --file <json> [--dry-run] [--target dev|prod] | update --entry-id <id> --file <json> [--dry-run] [--target dev|prod] | resolve --entry-id <id> --file <json> [--dry-run] [--target dev|prod] | publish --entry-id <id> --dry-run [--target dev|prod] | publish --entry-id <id> --review <token> --environment <name> [--target dev|prod]";

function isAction(value: string | undefined): value is Action {
  return value !== undefined && value in ACTIONS;
}

function isTarget(value: string): value is Target {
  return value === "dev" || value === "prod";
}

function targetOf(value: string | undefined): { target?: Target } {
  if (value === undefined) {
    return {};
  }
  if (!isTarget(value)) {
    throw new Error(`--target must be dev or prod. ${USAGE}`);
  }

  return { target: value };
}

export function parseCommandLine(argv: string[]): Args {
  // The root alias runs `pnpm --filter ... status:incident --`, which hands the `--` through.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      file: { type: "string" },
      "entry-id": { type: "string" },
      review: { type: "string" },
      environment: { type: "string" },
      target: { type: "string" },
      // Declared so a leftover --version gets the usage text instead of a parser error.
      version: { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  const [action] = positionals;

  if (positionals.length !== 1 || !isAction(action)) {
    throw new Error(USAGE);
  }

  const { allowed, required, requiredToWrite = [] } = ACTIONS[action];
  const given = Object.keys(values);
  const needed = values["dry-run"] === true ? required : [...required, ...requiredToWrite];

  for (const option of given.filter((name) => !allowed.includes(name))) {
    throw new Error(`${action} does not accept --${option}. ${USAGE}`);
  }
  for (const option of needed.filter((name) => !given.includes(name))) {
    throw new Error(`${action} requires --${option}. ${USAGE}`);
  }

  return {
    action,
    ...(values.file === undefined ? {} : { file: values.file }),
    ...(values["entry-id"] === undefined ? {} : { entryId: values["entry-id"] }),
    ...(values.review === undefined ? {} : { review: values.review }),
    ...(values.environment === undefined ? {} : { environment: values.environment }),
    ...targetOf(values.target),
    dryRun: values["dry-run"] === true,
  };
}

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new Error("The file is not valid JSON, so nothing was sent.");
  }
}

async function optionsOf(args: Args, root: string): Promise<Options> {
  const input = args.file === undefined ? undefined : await readJson(pathFromRoot(args.file, root));
  const target = args.target === undefined ? {} : { target: args.target };

  switch (args.action) {
    case "preflight":
    case "inspect":
      return { action: args.action };
    case "draft":
      return { action: "draft", input, dryRun: args.dryRun, ...target };
    case "update":
    case "resolve":
      return {
        action: args.action,
        entryId: args.entryId ?? "",
        input,
        dryRun: args.dryRun,
        ...target,
      };
    case "publish":
      return {
        action: "publish",
        entryId: args.entryId ?? "",
        dryRun: args.dryRun,
        ...(args.review === undefined ? {} : { review: args.review }),
        ...(args.environment === undefined ? {} : { environment: args.environment }),
        ...target,
      };
  }
}

async function run(): Promise<void> {
  const args = parseCommandLine(process.argv.slice(2));
  const root = repositoryRoot();
  const config = await loadContentfulConfig(root, process.env);
  const result = await statusIncident(await optionsOf(args, root), config, {
    request: fetch,
    audit: createContentfulAudit(root),
    write: (text) => process.stdout.write(text),
    now: () => new Date(),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Status incident command failed"}\n`,
    );
    process.exitCode = 1;
  }
}
