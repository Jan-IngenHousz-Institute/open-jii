import { readFile, writeFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { parseDraft, substituteReferences } from "../lib/ticket-draft.js";
import type { Draft, DraftTicket } from "../lib/ticket-draft.js";
import { checkDraft, formatReports } from "./linear-check.js";
import { fetchLabels } from "./linear-taxonomy.js";

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
}

export interface Resolved {
  teamId: string;
  projectId: string;
  projectName: string;
  stateId: string;
  labelIds: ReadonlyMap<string, string>;
}

export interface CreateDependencies {
  client: LinearClient;
  write: (text: string) => void;
  loadState: () => Promise<CreateState>;
  saveState: (state: CreateState) => Promise<void>;
}

interface TeamResult {
  teams: { nodes: { id: string; states: { nodes: { id: string; name: string }[] } }[] };
}

interface ProjectsResult {
  projects: { nodes: { id: string; name: string }[] };
}

interface IssueCreateResult {
  issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
}

const teamQuery = `query($key: String!) {
  teams(filter: { key: { eq: $key } }) { nodes { id states { nodes { id name } } } }
}`;
const projectsQuery = `query($name: String!) {
  projects(first: 10, filter: { name: { containsIgnoreCase: $name } }) { nodes { id name } }
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
const relationCreateMutation = `mutation($input: IssueRelationCreateInput!) {
  issueRelationCreate(input: $input) { success }
}`;

export const emptyState = (): CreateState => ({ tickets: {}, relations: [] });

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function resolveNames(client: LinearClient, draft: Draft): Promise<Resolved> {
  if (draft.project === null) {
    throw new Error("The draft names no project; a ticket without a project fails the gate");
  }

  const teams = await client.query<TeamResult>(teamQuery, { key: draft.team });
  const team = teams.teams.nodes.at(0);
  if (!team) throw new Error(`No team with key ${draft.team}`);
  const state = team.states.nodes.find((s) => sameName(s.name, draft.state));
  if (!state) {
    const names = team.states.nodes.map((s) => s.name).join(", ");
    throw new Error(`Team ${draft.team} has no state "${draft.state}"; it has ${names}`);
  }

  const projectName = draft.project;
  const projects = await client.query<ProjectsResult>(projectsQuery, { name: projectName });
  const exact = projects.projects.nodes.filter((p) => sameName(p.name, projectName));
  const project = exact.at(0);
  if (exact.length !== 1 || !project) {
    const candidates = projects.projects.nodes.map((p) => `"${p.name}"`).join(", ") || "none";
    throw new Error(
      `Expected one project named "${projectName}", found ${exact.length}; close matches: ${candidates}`,
    );
  }

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

function describePlan(draft: Draft, state: CreateState, resolved: Resolved): string {
  const lines = [
    `${draft.tickets.length} ticket(s) for project "${resolved.projectName}", state ${draft.state}`,
  ];
  for (const ticket of draft.tickets) {
    const existing = state.tickets[String(ticket.index)];
    const status = existing ? `exists as ${existing.identifier}` : "to create";
    const blocks = ticket.blocks.length > 0 ? `; blocks ${ticket.blocks.join(", ")}` : "";
    const comment = ticket.comment === null ? "" : "; with comment";
    lines.push(
      `  ${ticket.index}. ${ticket.title}  [${ticket.labels.join(", ")}] ${status}${blocks}${comment}`,
    );
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

export async function createTickets(
  draft: Draft,
  apply: boolean,
  deps: CreateDependencies,
): Promise<void> {
  const check = formatReports(checkDraft(draft));
  if (!check.ok) {
    deps.write(check.text);
    throw new Error("The draft fails the ticket standard; fix it before creating anything");
  }

  const resolved = await resolveNames(deps.client, draft);
  const state = await deps.loadState();
  deps.write(describePlan(draft, state, resolved));
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return;
  }

  for (const ticket of draft.tickets) {
    const key = String(ticket.index);
    if (state.tickets[key]) continue;
    const result = await deps.client.query<IssueCreateResult>(issueCreateMutation, {
      input: {
        teamId: resolved.teamId,
        projectId: resolved.projectId,
        stateId: resolved.stateId,
        title: ticket.title,
        description: ticket.body,
        labelIds: labelIdsFor(ticket, resolved),
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
      await expectSuccess(
        deps.client,
        commentCreateMutation,
        { input: { issueId: created.id, body: substituteReferences(ticket.comment, identifiers) } },
        `Commenting on ${created.identifier}`,
      );
      created.commentDone = true;
      await deps.saveState(state);
      deps.write(`comment ${created.identifier}\n`);
    }
  }

  for (const ticket of draft.tickets) {
    for (const target of ticket.blocks) {
      const tag = `${ticket.index}>${target}`;
      if (state.relations.includes(tag)) continue;
      const blocker = state.tickets[String(ticket.index)];
      const blocked = state.tickets[String(target)];
      if (!blocker || !blocked) continue;
      await expectSuccess(
        deps.client,
        relationCreateMutation,
        { input: { issueId: blocker.id, relatedIssueId: blocked.id, type: "blocks" } },
        `Relating ${blocker.identifier} to ${blocked.identifier}`,
      );
      state.relations.push(tag);
      await deps.saveState(state);
      deps.write(`blocks ${blocker.identifier} -> ${blocked.identifier}\n`);
    }
  }

  deps.write("\n");
  for (const ticket of draft.tickets) {
    const created = state.tickets[String(ticket.index)];
    if (created) deps.write(`${created.identifier}  ${created.title}\n${created.url}\n`);
  }
}

export function parseArgs(args: string[]): { file: string; apply: boolean } {
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Usage: linear-create <draft.md> [--apply]");
  return { file, apply: args.includes("--apply") };
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
  const apply = parsed.apply;
  const draft = parseDraft(await readFile(file, "utf8"));
  const root = repositoryRoot();
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  const path = statePath(file);
  await createTickets(draft, apply, {
    client,
    write: (text) => {
      process.stdout.write(text);
    },
    loadState: () => loadStateFile(path),
    saveState: (state) => writeFile(path, `${JSON.stringify(state, null, 2)}\n`),
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
