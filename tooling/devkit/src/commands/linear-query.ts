import { readFile } from "node:fs/promises";

import { repositoryRoot, resolveLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";

export interface QueryArgs {
  document: string | null;
  file: string | null;
  variables: Record<string, unknown>;
  allowDestructive: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(args: string[]): QueryArgs {
  const document = optionAfter(args, "--query");
  const file = optionAfter(args, "--file");
  if ((document === null) === (file === null)) {
    throw new Error("Pass exactly one of --query <document> or --file <path>");
  }

  const rawVariables = optionAfter(args, "--variables");
  let variables: Record<string, unknown> = {};
  if (rawVariables !== null) {
    const parsed: unknown = JSON.parse(rawVariables);
    if (!isRecord(parsed)) throw new Error("--variables must be a JSON object");
    variables = parsed;
  }

  return { document, file, variables, allowDestructive: args.includes("--allow-destructive") };
}

export async function runQuery(
  document: string,
  variables: Record<string, unknown>,
  client: LinearClient,
  write: (text: string) => void,
): Promise<void> {
  const result = await client.query<unknown>(document, variables);
  write(`${JSON.stringify(result, null, 2)}\n`);
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  let document: string;
  if (parsed.document !== null) {
    document = parsed.document;
  } else if (parsed.file !== null) {
    document = await readFile(parsed.file, "utf8");
  } else {
    throw new Error("Pass exactly one of --query <document> or --file <path>");
  }

  const root = repositoryRoot();
  const apiKey = await resolveLinearApiKey(root, process.env);
  if (!apiKey) throw new Error("No Linear key found; run pnpm linear:auth first");

  const client = createLinearClient({
    apiKey,
    allowDestructive: parsed.allowDestructive,
    audit: createFileAudit(root),
  });
  await runQuery(document, parsed.variables, client, (text) => {
    process.stdout.write(text);
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
