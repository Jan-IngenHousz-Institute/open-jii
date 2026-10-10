import { readFile } from "node:fs/promises";

import { optionAfter } from "../lib/args.js";
import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient, expectSuccess } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { findProject } from "../lib/projects.js";
import { parseResources, planResources } from "../lib/resources.js";
import type { ProjectResource, ResourceAction, ResourceFile } from "../lib/resources.js";

export interface ResourcesArgs {
  file: string;
  project: string | null;
  apply: boolean;
}

export interface ResourcesDependencies {
  client: LinearClient;
  write: (text: string) => void;
}

interface ExternalLinksResult {
  project: { externalLinks: { nodes: ProjectResource[] } };
}

const externalLinksQuery = `query($id: String!) {
  project(id: $id) { externalLinks(first: 100) { nodes { id label url sortOrder } } }
}`;
const linkCreateMutation = `mutation($input: EntityExternalLinkCreateInput!) {
  entityExternalLinkCreate(input: $input) { success }
}`;
const linkUpdateMutation = `mutation($id: String!, $input: EntityExternalLinkUpdateInput!) {
  entityExternalLinkUpdate(id: $id, input: $input) { success }
}`;

export function parseArgs(args: string[]): ResourcesArgs {
  const project = optionAfter(args, "--project");
  const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--project");
  if (!file) throw new Error('Usage: linear-resources <file.md> [--project "<name>"] [--apply]');
  return { file, project, apply: args.includes("--apply") };
}

function describeAction(action: ResourceAction): string {
  if (action.kind === "create") return `create  ${action.label}  ${action.url}`;
  if (action.kind === "update") return `update  ${action.label}  (${action.changes.join(", ")})`;
  return `keep    ${action.label}`;
}

export async function writeResources(
  file: ResourceFile,
  projectName: string,
  apply: boolean,
  deps: ResourcesDependencies,
): Promise<void> {
  const project = await findProject(deps.client, projectName);
  const live = await deps.client.query<ExternalLinksResult>(externalLinksQuery, { id: project.id });
  const plan = planResources(file.resources, live.project.externalLinks.nodes);

  const lines = [`project "${project.name}": ${plan.actions.length} resource link(s)`];
  for (const action of plan.actions) lines.push(`  ${describeAction(action)}`);
  for (const resource of plan.leftAlone) {
    lines.push(`  left alone, not in the file: ${resource.label}`);
  }
  deps.write(`${lines.join("\n")}\n`);
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return;
  }

  for (const action of plan.actions) {
    if (action.kind === "create") {
      await expectSuccess(
        deps.client,
        linkCreateMutation,
        {
          input: {
            projectId: project.id,
            label: action.label,
            url: action.url,
            sortOrder: action.sortOrder,
          },
        },
        `Adding ${action.label}`,
      );
      deps.write(`added ${action.label}\n`);
    } else if (action.kind === "update") {
      await expectSuccess(
        deps.client,
        linkUpdateMutation,
        { id: action.id, input: { label: action.label, sortOrder: action.sortOrder } },
        `Updating ${action.label}`,
      );
      deps.write(`updated ${action.label}\n`);
    }
  }
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const file = parseResources(await readFile(pathFromRoot(parsed.file, root), "utf8"));
  const project = parsed.project ?? file.project;
  if (project === null) {
    throw new Error('Name the project in the front matter or with --project "<name>"');
  }
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  await writeResources(file, project, parsed.apply, {
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
