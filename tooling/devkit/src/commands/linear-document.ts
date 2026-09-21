import { readFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";
import { checkMermaid, extractMermaidBlocks } from "../lib/mermaid.js";
import { findProject, listProjectDocuments, sameName } from "../lib/projects.js";
import { proseFindings } from "../lib/ticket-standard.js";
import type { Finding } from "../lib/ticket-standard.js";

export interface DocumentArgs {
  file: string;
  project: string;
  title: string;
  apply: boolean;
}

export interface DocumentDependencies {
  client: LinearClient;
  write: (text: string) => void;
}

interface DocumentCreateResult {
  documentCreate: { success: boolean; document: { url: string } };
}

interface DocumentUpdateResult {
  documentUpdate: { success: boolean; document: { url: string } };
}

const documentCreateMutation = `mutation($input: DocumentCreateInput!) {
  documentCreate(input: $input) { success document { url } }
}`;
const documentUpdateMutation = `mutation($id: String!, $input: DocumentUpdateInput!) {
  documentUpdate(id: $id, input: $input) { success document { url } }
}`;

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(args: string[]): DocumentArgs {
  const project = optionAfter(args, "--project");
  const title = optionAfter(args, "--title");
  const valued = new Set(["--project", "--title"]);
  const file = args.find((arg, index) => !arg.startsWith("--") && !valued.has(args[index - 1]));
  if (!file || project === null || title === null) {
    throw new Error(
      'Usage: linear-document <file.md> --project "<name>" --title "<title>" [--apply]',
    );
  }
  return { file, project, title, apply: args.includes("--apply") };
}

// A document is prose with diagrams: the prose rules that apply to any body, plus every mermaid
// block parsed by mermaid itself, since a diagram that does not parse renders as an error box.
export async function checkDocument(markdown: string): Promise<Finding[]> {
  return [...proseFindings(markdown), ...(await checkMermaid(extractMermaidBlocks(markdown)))];
}

export function formatFindings(findings: readonly Finding[]): string {
  return `${findings.map((finding) => `  ${finding.rule}: ${finding.detail}`).join("\n")}\n`;
}

export async function publishDocument(
  markdown: string,
  args: DocumentArgs,
  deps: DocumentDependencies,
): Promise<string | null> {
  const findings = await checkDocument(markdown);
  if (findings.length > 0) {
    deps.write(`FAIL  ${args.title}\n${formatFindings(findings)}`);
    throw new Error("The document fails the checks; fix it before publishing");
  }

  const project = await findProject(deps.client, args.project);
  const existing = (await listProjectDocuments(deps.client, project.id)).find((document) =>
    sameName(document.title, args.title),
  );
  const diagrams = extractMermaidBlocks(markdown).length;
  const action = existing ? `update ${existing.url}` : "create";
  deps.write(
    `"${args.title}" on project "${project.name}": ${action}; ${markdown.length} characters, ${diagrams} diagram(s)\n`,
  );
  if (!args.apply) {
    deps.write("dry run; pass --apply to write\n");
    return null;
  }

  let url: string;
  if (existing) {
    const result = await deps.client.query<DocumentUpdateResult>(documentUpdateMutation, {
      id: existing.id,
      input: { content: markdown },
    });
    if (!result.documentUpdate.success) throw new Error(`Updating "${args.title}" did not succeed`);
    url = result.documentUpdate.document.url;
  } else {
    const result = await deps.client.query<DocumentCreateResult>(documentCreateMutation, {
      input: { projectId: project.id, title: args.title, content: markdown },
    });
    if (!result.documentCreate.success) throw new Error(`Creating "${args.title}" did not succeed`);
    url = result.documentCreate.document.url;
  }
  deps.write(`${url}\n`);
  return url;
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const markdown = await readFile(pathFromRoot(parsed.file, root), "utf8");
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  await publishDocument(markdown, parsed, {
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
