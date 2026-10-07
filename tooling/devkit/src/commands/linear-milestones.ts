import { readFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { checkMilestones, parseMilestones, planMilestones } from "../lib/milestones.js";
import type { MilestoneAction, MilestoneFile, MilestonePlan } from "../lib/milestones.js";
import { findProject, listMilestones } from "../lib/projects.js";

export interface MilestonesArgs {
  file: string;
  project: string | null;
  apply: boolean;
}

export interface MilestonesDependencies {
  client: LinearClient;
  write: (text: string) => void;
}

const milestoneCreateMutation = `mutation($input: ProjectMilestoneCreateInput!) {
  projectMilestoneCreate(input: $input) { success }
}`;
const milestoneUpdateMutation = `mutation($id: String!, $input: ProjectMilestoneUpdateInput!) {
  projectMilestoneUpdate(id: $id, input: $input) { success }
}`;

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(args: string[]): MilestonesArgs {
  const project = optionAfter(args, "--project");
  const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--project");
  if (!file) throw new Error('Usage: linear-milestones <file.md> [--project "<name>"] [--apply]');
  return { file, project, apply: args.includes("--apply") };
}

function describeAction(action: MilestoneAction): string {
  if (action.kind === "create") return `create  ${action.name}`;
  if (action.kind === "update") return `update  ${action.name}  (${action.changes.join(", ")})`;
  return `keep    ${action.name}`;
}

function describePlan(projectName: string, plan: MilestonePlan): string {
  const lines = [`project "${projectName}": ${plan.actions.length} milestone(s) in order of work`];
  for (const action of plan.actions) lines.push(`  ${describeAction(action)}`);
  for (const milestone of plan.leftAlone) {
    lines.push(`  left alone, not in the file: ${milestone.name}`);
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
  if (!Object.values(result).at(0)?.success) throw new Error(`${what} did not succeed`);
}

// Linear owns the final position, so the order is read back rather than assumed.
async function verifyOrder(
  client: LinearClient,
  projectId: string,
  file: MilestoneFile,
): Promise<string[]> {
  const wanted = file.milestones.map((milestone) => milestone.name);
  const live = (await listMilestones(client, projectId)).map((milestone) => milestone.name);
  const present = live.filter((name) => wanted.includes(name));
  const isInOrder = present.length === wanted.length && present.every((n, i) => n === wanted[i]);
  return isInOrder
    ? []
    : [`Linear returned the order ${present.join(" | ")}; the file asks for ${wanted.join(" | ")}`];
}

export async function writeMilestones(
  file: MilestoneFile,
  projectName: string,
  apply: boolean,
  deps: MilestonesDependencies,
): Promise<boolean> {
  const findings = checkMilestones(file);
  if (findings.length > 0) {
    for (const finding of findings) deps.write(`${finding.rule}: ${finding.detail}\n`);
    throw new Error("The milestone file fails the standard; fix it before writing anything");
  }

  const project = await findProject(deps.client, projectName);
  const plan = planMilestones(file.milestones, await listMilestones(deps.client, project.id));
  deps.write(describePlan(project.name, plan));
  if (!apply) {
    deps.write("dry run; pass --apply to write\n");
    return true;
  }

  for (const action of plan.actions) {
    if (action.kind === "create") {
      await expectSuccess(
        deps.client,
        milestoneCreateMutation,
        {
          input: {
            projectId: project.id,
            name: action.name,
            description: action.description,
            sortOrder: action.sortOrder,
          },
        },
        `Creating ${action.name}`,
      );
      deps.write(`created ${action.name}\n`);
    } else if (action.kind === "update") {
      await expectSuccess(
        deps.client,
        milestoneUpdateMutation,
        {
          id: action.id,
          input: {
            name: action.name,
            description: action.description,
            sortOrder: action.sortOrder,
          },
        },
        `Updating ${action.name}`,
      );
      deps.write(`updated ${action.name}\n`);
    }
  }

  const problems = await verifyOrder(deps.client, project.id, file);
  for (const problem of problems) deps.write(`order: ${problem}\n`);
  if (problems.length === 0) deps.write("order: read back and matches the file\n");
  return problems.length === 0;
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const file = parseMilestones(await readFile(pathFromRoot(parsed.file, root), "utf8"));
  const project = parsed.project ?? file.project;
  if (project === null) {
    throw new Error('Name the project in the front matter or with --project "<name>"');
  }
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  const isOk = await writeMilestones(file, project, parsed.apply, {
    client,
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return isOk ? 0 : 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
