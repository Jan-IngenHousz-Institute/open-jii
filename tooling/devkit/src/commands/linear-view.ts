import { repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { findProject, projectLabel } from "../lib/projects.js";
import { publishDocument } from "./linear-document.js";

export interface ViewArgs {
  project: string;
  // The short name a new view and the document title carry; the project's own by default.
  label: string | null;
  apply: boolean;
}

export interface ViewDependencies {
  client: LinearClient;
  write: (text: string) => void;
}

interface OrganizationResult {
  organization: { urlKey: string };
}

interface ViewNode {
  id: string;
  name: string;
  slugId: string;
  filterData: unknown;
}

interface CustomViewsResult {
  customViews: { nodes: ViewNode[] };
}

interface CustomViewCreateResult {
  customViewCreate: { success: boolean; customView: { id: string; slugId: string } };
}

const organizationQuery = `{ organization { urlKey } }`;
const customViewsQuery = `{ customViews(first: 100) { nodes { id name slugId filterData } } }`;
const customViewCreateMutation = `mutation($input: CustomViewCreateInput!) {
  customViewCreate(input: $input) { success customView { id slugId } }
}`;

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(args: string[]): ViewArgs {
  const project = optionAfter(args, "--project");
  if (project === null) {
    throw new Error('Usage: linear-view --project "<name>" [--label "<short name>"] [--apply]');
  }
  return { project, label: optionAfter(args, "--label"), apply: args.includes("--apply") };
}

// Linear builds a view's address from its name and slug id the same way it does for projects.
export function viewUrl(urlKey: string, name: string, slugId: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://linear.app/${urlKey}/view/${slug}-${slugId}`;
}

// A view belongs to a project when it filters on it, whatever it is called, because the team names
// its own views freely. Linear writes that filter as `eq`, as `in`, or nested under `and` and
// `or`, so the id is looked for in the serialised filter rather than at one fixed path.
export function filtersProject(filterData: unknown, projectId: string): boolean {
  return JSON.stringify(filterData ?? null).includes(projectId);
}

export function viewDocument(label: string, url: string, projectUrl: string): string {
  return [
    `[Open the live ${label} ticket view](${url}).`,
    "",
    "This shared view includes every issue in the project. Status, assignee and ticket content come from the live issues.",
    "",
    `[Project scope, deliverables and done-when](${projectUrl}).`,
    "",
  ].join("\n");
}

// One shared view filtered to the project, and the document that points at it.
//
// The view is a workspace view carrying a project filter, never one created with `projectId`: a
// project-scoped view is absent from `customViews` even when filtered by name and asked for
// archived rows, so a second run would create a duplicate instead of finding it.
export async function scaffoldView(args: ViewArgs, deps: ViewDependencies): Promise<void> {
  const project = await findProject(deps.client, args.project);
  const label = args.label ?? projectLabel(project.name);
  const organization = await deps.client.query<OrganizationResult>(organizationQuery);
  const views = await deps.client.query<CustomViewsResult>(customViewsQuery);
  const existing = views.customViews.nodes.find((view) =>
    filtersProject(view.filterData, project.id),
  );
  const urlKey = organization.organization.urlKey;

  deps.write(
    existing
      ? `view "${existing.name}" already filters this project: ${viewUrl(urlKey, existing.name, existing.slugId)}\n`
      : `view "${label}": create, shared, filtered to the project\n`,
  );

  let url = existing === undefined ? null : viewUrl(urlKey, existing.name, existing.slugId);
  if (args.apply && url === null) {
    const result = await deps.client.query<CustomViewCreateResult>(customViewCreateMutation, {
      input: {
        name: label,
        description: `Every issue in the ${project.name} project, with status and assignee.`,
        shared: true,
        filterData: { project: { id: { eq: project.id } } },
      },
    });
    if (!result.customViewCreate.success) throw new Error("Creating the view did not succeed");
    url = viewUrl(urlKey, label, result.customViewCreate.customView.slugId);
    deps.write(`created ${url}\n`);
  }

  await publishDocument(
    viewDocument(label, url ?? "(the view's URL once created)", project.url),
    {
      file: "(generated)",
      project: project.name,
      title: `${label}: live ticket view`,
      apply: args.apply,
    },
    deps,
  );
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  await scaffoldView(parsed, {
    client,
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
