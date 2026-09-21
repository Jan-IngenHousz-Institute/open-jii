import { repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { findProject, sameName } from "../lib/projects.js";
import { publishDocument } from "./linear-document.js";

export interface ViewArgs {
  project: string;
  apply: boolean;
}

export interface ViewDependencies {
  client: LinearClient;
  write: (text: string) => void;
}

interface OrganizationResult {
  organization: { urlKey: string };
}

interface CustomViewsResult {
  customViews: { nodes: { id: string; name: string; slugId: string }[] };
}

interface CustomViewCreateResult {
  customViewCreate: { success: boolean; customView: { id: string; slugId: string } };
}

const organizationQuery = `{ organization { urlKey } }`;
const customViewsQuery = `{ customViews(first: 100) { nodes { id name slugId } } }`;
const customViewCreateMutation = `mutation($input: CustomViewCreateInput!) {
  customViewCreate(input: $input) { success customView { id slugId } }
}`;

export function parseArgs(args: string[]): ViewArgs {
  const index = args.indexOf("--project");
  const project = index >= 0 ? args[index + 1] : undefined;
  if (!project || project.startsWith("--")) {
    throw new Error('Usage: linear-view --project "<name>" [--apply]');
  }
  return { project, apply: args.includes("--apply") };
}

// Linear builds a view's address from its name and slug id the same way it does for projects.
export function viewUrl(urlKey: string, name: string, slugId: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://linear.app/${urlKey}/view/${slug}-${slugId}`;
}

export function viewDocument(projectName: string, url: string, projectUrl: string): string {
  return [
    `[Open the live ${projectName} ticket view](${url}).`,
    "",
    "This shared view includes every issue in the project. Status, assignee and ticket content come from the live issues.",
    "",
    `[Project scope, deliverables and done-when](${projectUrl}).`,
    "",
  ].join("\n");
}

// One shared view filtered to the project, and the document that points at it. Both are named
// after the project so the artifact index can link them without knowing their ids.
export async function scaffoldView(args: ViewArgs, deps: ViewDependencies): Promise<void> {
  const project = await findProject(deps.client, args.project);
  const organization = await deps.client.query<OrganizationResult>(organizationQuery);
  const views = await deps.client.query<CustomViewsResult>(customViewsQuery);
  const existing = views.customViews.nodes.find((view) => sameName(view.name, project.name));
  const urlKey = organization.organization.urlKey;

  deps.write(
    existing
      ? `view "${project.name}" exists: ${viewUrl(urlKey, project.name, existing.slugId)}\n`
      : `view "${project.name}": create, shared, filtered to the project\n`,
  );

  let slugId = existing?.slugId ?? null;
  if (args.apply && slugId === null) {
    const result = await deps.client.query<CustomViewCreateResult>(customViewCreateMutation, {
      input: {
        name: project.name,
        description: `Every issue in the ${project.name} project, with status and assignee.`,
        projectId: project.id,
        shared: true,
        filterData: { project: { id: { eq: project.id } } },
      },
    });
    if (!result.customViewCreate.success) throw new Error("Creating the view did not succeed");
    slugId = result.customViewCreate.customView.slugId;
    deps.write(`created ${viewUrl(urlKey, project.name, slugId)}\n`);
  }

  const url =
    slugId === null ? "(the view's URL once created)" : viewUrl(urlKey, project.name, slugId);
  const projectUrl = `https://linear.app/${urlKey}/project/${project.id}`;
  await publishDocument(
    viewDocument(project.name, url, projectUrl),
    {
      file: "(generated)",
      project: project.name,
      title: `${project.name}: live ticket view`,
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
