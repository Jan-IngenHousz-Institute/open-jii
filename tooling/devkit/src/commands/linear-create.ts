import { readFile, writeFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { findProject, listMilestones, sameName } from "../lib/projects.js";
import { parseDraft, substituteReferences } from "../lib/ticket-draft.js";
import type { Draft, DraftTicket, Target } from "../lib/ticket-draft.js";
import { taxonomy } from "../linear/taxonomy.js";
import { checkDraft, formatReports } from "./linear-check.js";
import { fetchLabels, isUntouchable } from "./linear-taxonomy.js";

export interface CreatedTicket {
  id: string;
  identifier: string;
  url: string;
  title: string;
  referencesDone?: boolean;
  commentDone?: boolean;
}

// Written next to the draft after every mutation, so a failed run resumes instead of duplicating.
export interface CreateState {
  tickets: Partial<Record<string, CreatedTicket>>;
  relations: string[];
  links?: string[];
}

export interface Resolved {
  teamId: string;
  projectId: string;
  projectName: string;
  stateId: string;
  stateIds: ReadonlyMap<string, string>;
  milestoneIds: ReadonlyMap<string, string>;
  labelIds: ReadonlyMap<string, string>;
}

export interface CreateOptions {
  // An update drops the labels the draft does not list, except the compliance and wayfinder series.
  syncLabels: boolean;
}

export interface CreateDependencies {
  client: LinearClient;
  write: (text: string) => void;
  loadState: () => Promise<CreateState>;
  saveState: (state: CreateState) => Promise<void>;
  pause: (milliseconds: number) => Promise<void>;
}

// Linear refused link attachments beyond about 20 a minute in practice, so a run with more than
// that spaces them out.
const LINK_BURST = 20;
const LINK_SPACING_MS = 3100;

interface TeamResult {
  teams: { nodes: { id: string; states: { nodes: { id: string; name: string }[] } }[] };
}

interface ExistingIssue {
  id: string;
  identifier: string;
  url: string;
  state: { name: string };
  project: { id: string; name: string } | null;
  labels: { nodes: { id: string; name: string }[] };
  comments: { nodes: { id: string; body: string; user: { id: string } | null }[] };
  attachments: { nodes: { url: string }[] };
}

interface IssueResult {
  viewer: { id: string };
  issue: ExistingIssue;
}

interface IssueCreateResult {
  issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
}

// The issues a draft touches that already exist: the ones it updates and the ones it relates to.
interface Existing {
  viewerId: string | null;
  issues: ReadonlyMap<string, ExistingIssue>;
}

interface Edge {
  tag: string;
  type: "blocks" | "related";
  from: Target;
  to: Target;
}

const teamQuery = `query($key: String!) {
  teams(filter: { key: { eq: $key } }) { nodes { id states { nodes { id name } } } }
}`;
const issueByIdentifierQuery = `query($id: String!) {
  viewer { id }
  issue(id: $id) {
    id identifier url
    state { name }
    project { id name }
    labels { nodes { id name } }
    comments(first: 50) { nodes { id body user { id } } }
    attachments(first: 50) { nodes { url } }
  }
}`;
const issueCreateMutation = `mutation($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id identifier url } }
}`;
const issueUpdateMutation = `mutation($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) { success }
}`;
const commentCreateMutation = `mutation($input: CommentCreateInput!) {
  commentCreate(input: $input) { success }
}`;
const commentUpdateMutation = `mutation($id: String!, $input: CommentUpdateInput!) {
  commentUpdate(id: $id, input: $input) { success }
}`;
const relationCreateMutation = `mutation($input: IssueRelationCreateInput!) {
  issueRelationCreate(input: $input) { success }
}`;
const linkMutation = `mutation($issueId: String!, $url: String!, $title: String) {
  attachmentLinkURL(issueId: $issueId, url: $url, title: $title) { success }
}`;

export const emptyState = (): CreateState => ({ tickets: {}, relations: [], links: [] });

function requireState(team: TeamResult["teams"]["nodes"][number], name: string, key: string) {
  const state = team.states.nodes.find((s) => sameName(s.name, name));
  if (!state) {
    const names = team.states.nodes.map((s) => s.name).join(", ");
    throw new Error(`Team ${key} has no state "${name}"; it has ${names}`);
  }
  return state;
}

async function resolveMilestones(
  client: LinearClient,
  draft: Draft,
  projectId: string,
): Promise<Map<string, string>> {
  const milestoneIds = new Map<string, string>();
  const wanted = new Set(
    draft.tickets.map((ticket) => ticket.milestone).filter((name) => name !== null),
  );
  if (wanted.size === 0) return milestoneIds;

  const live = await listMilestones(client, projectId);
  for (const milestone of live) milestoneIds.set(milestone.name.toLowerCase(), milestone.id);
  const unknown = [...wanted].filter((name) => !milestoneIds.has(name.toLowerCase()));
  if (unknown.length > 0) {
    const have = live.map((milestone) => `"${milestone.name}"`).join(", ") || "none";
    throw new Error(
      `Unknown milestone(s): ${unknown.join(", ")}; the project has ${have}. Create them with pnpm linear:milestones`,
    );
  }
  return milestoneIds;
}

export async function resolveNames(client: LinearClient, draft: Draft): Promise<Resolved> {
  if (draft.project === null) {
    throw new Error("The draft names no project; a ticket without a project fails the gate");
  }

  const teams = await client.query<TeamResult>(teamQuery, { key: draft.team });
  const team = teams.teams.nodes.at(0);
  if (!team) throw new Error(`No team with key ${draft.team}`);
  const state = requireState(team, draft.state, draft.team);
  for (const ticket of draft.tickets) {
    if (ticket.state !== null) requireState(team, ticket.state, draft.team);
  }
  const stateIds = new Map(team.states.nodes.map((s) => [s.name.toLowerCase(), s.id]));

  const project = await findProject(client, draft.project);
  const milestoneIds = await resolveMilestones(client, draft, project.id);

  const labelIds = new Map<string, string>();
  for (const label of await fetchLabels(client, draft.team)) {
    labelIds.set(label.name.toLowerCase(), label.id);
  }
  const unknown = new Set<string>();
  for (const ticket of draft.tickets) {
    for (const name of ticket.labels) {
      if (!labelIds.has(name.toLowerCase())) unknown.add(name);
    }
  }
  if (unknown.size > 0) {
    throw new Error(`Unknown label(s): ${[...unknown].join(", ")}`);
  }

  return {
    teamId: team.id,
    projectId: project.id,
    projectName: project.name,
    stateId: state.id,
    stateIds,
    milestoneIds,
    labelIds,
  };
}

function labelIdsFor(ticket: DraftTicket, resolved: Resolved): string[] {
  return ticket.labels.map((name) => {
    const id = resolved.labelIds.get(name.toLowerCase());
    if (id === undefined) throw new Error(`Unknown label ${name}`);
    return id;
  });
}

function stateIdFor(ticket: DraftTicket, resolved: Resolved): string {
  if (ticket.state === null) return resolved.stateId;
  return resolved.stateIds.get(ticket.state.toLowerCase()) ?? resolved.stateId;
}

function milestoneIdFor(ticket: DraftTicket, resolved: Resolved): string | null {
  if (ticket.milestone === null) return null;
  return resolved.milestoneIds.get(ticket.milestone.toLowerCase()) ?? null;
}

export function edgesOf(ticket: DraftTicket): Edge[] {
  const edge = (type: Edge["type"], from: Target, to: Target): Edge => ({
    tag: `${type}:${from}>${to}`,
    type,
    from,
    to,
  });
  return [
    ...ticket.blocks.map((target) => edge("blocks", ticket.index, target)),
    ...ticket.blockedBy.map((target) => edge("blocks", target, ticket.index)),
    ...ticket.related.map((target) => edge("related", ticket.index, target)),
  ];
}

async function loadExisting(client: LinearClient, draft: Draft): Promise<Existing> {
  const identifiers = new Set<string>();
  for (const ticket of draft.tickets) {
    if (ticket.identifier !== null) identifiers.add(ticket.identifier);
    for (const edge of edgesOf(ticket)) {
      for (const end of [edge.from, edge.to]) {
        if (typeof end === "string") identifiers.add(end);
      }
    }
  }

  const issues = new Map<string, ExistingIssue>();
  let viewerId: string | null = null;
  for (const identifier of identifiers) {
    const found = await client.query<IssueResult>(issueByIdentifierQuery, { id: identifier });
    issues.set(identifier, found.issue);
    viewerId = found.viewer.id;
  }
  return { viewerId, issues };
}

interface UpdatePlan {
  input: Record<string, unknown>;
  notes: string[];
}

// What an update changes. Title, body and the listed labels always go; state, project and
// milestone only when the draft names them, so an update never moves a ticket by accident.
function planUpdate(
  ticket: DraftTicket,
  issue: ExistingIssue,
  resolved: Resolved,
  options: CreateOptions,
): UpdatePlan {
  const listed = labelIdsFor(ticket, resolved);
  const input: Record<string, unknown> = {
    title: ticket.title,
    description: ticket.body,
    addedLabelIds: listed,
  };
  const notes: string[] = [];

  if (options.syncLabels) {
    const removed = issue.labels.nodes.filter(
      (label) => !listed.includes(label.id) && !isUntouchable(taxonomy, label.name),
    );
    if (removed.length > 0) {
      input.removedLabelIds = removed.map((label) => label.id);
      notes.push(`drops ${removed.map((label) => label.name).join(", ")}`);
    }
  }
  if (ticket.state !== null && !sameName(ticket.state, issue.state.name)) {
    input.stateId = stateIdFor(ticket, resolved);
    notes.push(`state ${issue.state.name} to ${ticket.state}`);
  }
  if (issue.project?.id !== resolved.projectId) {
    input.projectId = resolved.projectId;
    notes.push(`moves from ${issue.project === null ? "no project" : `"${issue.project.name}"`}`);
  }
  const milestoneId = milestoneIdFor(ticket, resolved);
  if (milestoneId !== null) {
    input.projectMilestoneId = milestoneId;
    notes.push(`milestone ${ticket.milestone ?? ""}`);
  }
  return { input, notes };
}

function describeTicket(
  ticket: DraftTicket,
  state: CreateState,
  resolved: Resolved,
  existing: Existing,
  options: CreateOptions,
): string {
  const created = state.tickets[String(ticket.index)];
  const issue = ticket.identifier === null ? undefined : existing.issues.get(ticket.identifier);
  const notes = issue === undefined ? [] : planUpdate(ticket, issue, resolved, options).notes;
  const detail = notes.length > 0 ? ` (${notes.join("; ")})` : "";
  const intent = ticket.identifier === null ? "to create" : `update ${ticket.identifier}${detail}`;
  const parts = [created ? `exists as ${created.identifier}` : intent];
  if (ticket.blocks.length > 0) parts.push(`blocks ${ticket.blocks.join(", ")}`);
  if (ticket.blockedBy.length > 0) parts.push(`blocked by ${ticket.blockedBy.join(", ")}`);
  if (ticket.related.length > 0) parts.push(`related to ${ticket.related.join(", ")}`);
  if (ticket.milestone !== null && ticket.identifier === null) {
    parts.push(`milestone ${ticket.milestone}`);
  }
  if (ticket.state !== null && ticket.identifier === null) parts.push(`state ${ticket.state}`);
  if (ticket.comment !== null) parts.push("with comment");
  if (ticket.links.length > 0) parts.push(`${ticket.links.length} link(s)`);
  return `  ${ticket.index}. ${ticket.title}  [${ticket.labels.join(", ")}] ${parts.join("; ")}`;
}

function describePlan(
  draft: Draft,
  state: CreateState,
  resolved: Resolved,
  existing: Existing,
  options: CreateOptions,
): string {
  const lines = [
    `${draft.tickets.length} ticket(s) for project "${resolved.projectName}", state ${draft.state}`,
  ];
  for (const ticket of draft.tickets) {
    lines.push(describeTicket(ticket, state, resolved, existing, options));
  }
  return `${lines.join("\n")}\n`;
}

async function expectSuccess(
  client: LinearClient,
  mutation: string,
  variables: Record<string, unknown>,
  what: string,
): Promise<void> {
  const result = await client.query<Record<string, { success: boolean }>>(mutation, variables);
  const outcome = Object.values(result).at(0);
  if (!outcome?.success) throw new Error(`${what} did not succeed`);
}

// A comment is keyed by its first line, so a rerun edits the pointer comment instead of stacking
// a second one. Only the key owner's own comment is ever edited.
function commentKey(body: string): string {
  const first = body.split("\n").at(0) ?? "";
  return first
    .replace(/[*_`#\s]+/g, " ")
    .trim()
    .toLowerCase();
}

function ownComment(
  issue: ExistingIssue | undefined,
  viewerId: string | null,
  body: string,
): string | null {
  if (issue === undefined || viewerId === null) return null;
  const key = commentKey(body);
  const match = issue.comments.nodes.find(
    (comment) => comment.user?.id === viewerId && commentKey(comment.body) === key,
  );
  return match?.id ?? null;
}

export async function createTickets(
  draft: Draft,
  apply: boolean,
  deps: CreateDependencies,
  options: CreateOptions = { syncLabels: false },
): Promise<void> {
  const reports = checkDraft(draft);
  const check = formatReports(reports);
  if (!check.ok) {
    deps.write(check.text);
    throw new Error("The draft fails the ticket standard; fix it before creating anything");
  }
  for (const { index, title, advisories } of reports) {
    for (const note of advisories) deps.write(`note  ${index}. ${title}: ${note}\n`);
  }

  const resolved = await resolveNames(deps.client, draft);
  const existing = await loadExisting(deps.client, draft);
  const state = await deps.loadState();
  deps.write(describePlan(draft, state, resolved, existing, options));
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return;
  }

  for (const ticket of draft.tickets) {
    const key = String(ticket.index);
    if (state.tickets[key]) continue;
    const issue = ticket.identifier === null ? undefined : existing.issues.get(ticket.identifier);
    if (issue !== undefined) {
      await expectSuccess(
        deps.client,
        issueUpdateMutation,
        { id: issue.id, input: planUpdate(ticket, issue, resolved, options).input },
        `Updating ${issue.identifier}`,
      );
      state.tickets[key] = {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url,
        title: ticket.title,
      };
      await deps.saveState(state);
      deps.write(`updated ${issue.identifier}  ${ticket.title}\n`);
      continue;
    }
    const milestoneId = milestoneIdFor(ticket, resolved);
    const result = await deps.client.query<IssueCreateResult>(issueCreateMutation, {
      input: {
        teamId: resolved.teamId,
        projectId: resolved.projectId,
        stateId: stateIdFor(ticket, resolved),
        title: ticket.title,
        description: ticket.body,
        labelIds: labelIdsFor(ticket, resolved),
        ...(milestoneId === null ? {} : { projectMilestoneId: milestoneId }),
      },
    });
    if (!result.issueCreate.success) throw new Error(`Creating "${ticket.title}" did not succeed`);
    state.tickets[key] = { ...result.issueCreate.issue, title: ticket.title };
    await deps.saveState(state);
    deps.write(`created ${result.issueCreate.issue.identifier}  ${ticket.title}\n`);
  }

  const identifiers = new Map<number, string>();
  for (const [key, created] of Object.entries(state.tickets)) {
    if (created) identifiers.set(Number(key), created.identifier);
  }

  for (const ticket of draft.tickets) {
    const created = state.tickets[String(ticket.index)];
    if (!created) continue;
    const body = substituteReferences(ticket.body, identifiers);
    if (body !== ticket.body && !created.referencesDone) {
      await expectSuccess(
        deps.client,
        issueUpdateMutation,
        { id: created.id, input: { description: body } },
        `Rewriting references on ${created.identifier}`,
      );
      created.referencesDone = true;
      await deps.saveState(state);
      deps.write(`references ${created.identifier}\n`);
    }
    if (ticket.comment !== null && !created.commentDone) {
      const comment = substituteReferences(ticket.comment, identifiers);
      const prior = ownComment(
        ticket.identifier === null ? undefined : existing.issues.get(ticket.identifier),
        existing.viewerId,
        comment,
      );
      if (prior === null) {
        await expectSuccess(
          deps.client,
          commentCreateMutation,
          { input: { issueId: created.id, body: comment } },
          `Commenting on ${created.identifier}`,
        );
      } else {
        await expectSuccess(
          deps.client,
          commentUpdateMutation,
          { id: prior, input: { body: comment } },
          `Editing the comment on ${created.identifier}`,
        );
      }
      created.commentDone = true;
      await deps.saveState(state);
      deps.write(`${prior === null ? "comment" : "comment edited"} ${created.identifier}\n`);
    }
  }

  const issueOf = (end: Target): { id: string; identifier: string } | undefined => {
    if (typeof end === "string") return existing.issues.get(end);
    return state.tickets[String(end)];
  };
  for (const edge of draft.tickets.flatMap(edgesOf)) {
    if (state.relations.includes(edge.tag)) continue;
    const from = issueOf(edge.from);
    const to = issueOf(edge.to);
    if (!from || !to) continue;
    await expectSuccess(
      deps.client,
      relationCreateMutation,
      { input: { issueId: from.id, relatedIssueId: to.id, type: edge.type } },
      `Relating ${from.identifier} to ${to.identifier}`,
    );
    state.relations.push(edge.tag);
    await deps.saveState(state);
    deps.write(`${edge.type} ${from.identifier} -> ${to.identifier}\n`);
  }

  await attachLinks(draft, state, existing, deps);

  deps.write("\n");
  for (const ticket of draft.tickets) {
    const created = state.tickets[String(ticket.index)];
    if (created) deps.write(`${created.identifier}  ${created.title}\n${created.url}\n`);
  }
}

// A link the ticket already carries, or one this draft attached in an earlier run, is skipped.
async function attachLinks(
  draft: Draft,
  state: CreateState,
  existing: Existing,
  deps: CreateDependencies,
): Promise<void> {
  const done = state.links ?? [];
  state.links = done;
  const pending = draft.tickets.flatMap((ticket) => {
    const created = state.tickets[String(ticket.index)];
    if (!created) return [];
    const issue = ticket.identifier === null ? undefined : existing.issues.get(ticket.identifier);
    const attached = new Set(issue?.attachments.nodes.map((node) => node.url) ?? []);
    return ticket.links
      .map((link) => ({ link, created, tag: `${ticket.index}>${link.url}` }))
      .filter(({ link, tag }) => !attached.has(link.url) && !done.includes(tag));
  });
  const isPaced = pending.length > LINK_BURST;

  for (const [position, { link, created, tag }] of pending.entries()) {
    if (isPaced && position > 0) await deps.pause(LINK_SPACING_MS);
    await expectSuccess(
      deps.client,
      linkMutation,
      { issueId: created.id, url: link.url, title: link.title },
      `Linking ${link.url} on ${created.identifier}`,
    );
    done.push(tag);
    await deps.saveState(state);
    deps.write(`link ${created.identifier}  ${link.title}\n`);
  }
}

export function parseArgs(args: string[]): { file: string; apply: boolean; syncLabels: boolean } {
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Usage: linear-create <draft.md> [--apply] [--sync-labels]");
  return { file, apply: args.includes("--apply"), syncLabels: args.includes("--sync-labels") };
}

export function statePath(file: string): string {
  return `${file}.created.json`;
}

function isCreateState(value: unknown): value is CreateState {
  return (
    typeof value === "object" &&
    value !== null &&
    "tickets" in value &&
    "relations" in value &&
    Array.isArray(value.relations)
  );
}

async function loadStateFile(path: string): Promise<CreateState> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyState();
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (!isCreateState(parsed)) throw new Error(`${path} is not a linear-create state file`);
  return parsed;
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const file = pathFromRoot(parsed.file, repositoryRoot());
  const { apply, syncLabels } = parsed;
  const draft = parseDraft(await readFile(file, "utf8"));
  const root = repositoryRoot();
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  const path = statePath(file);
  await createTickets(
    draft,
    apply,
    {
      client,
      write: (text) => {
        process.stdout.write(text);
      },
      loadState: () => loadStateFile(path),
      saveState: (state) => writeFile(path, `${JSON.stringify(state, null, 2)}\n`),
      pause: (milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        }),
    },
    { syncLabels },
  );
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
