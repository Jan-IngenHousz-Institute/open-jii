import { readFile, writeFile } from "node:fs/promises";

import { pathFromRoot, posthogKey, repositoryRoot, requireDevkitKey } from "../lib/config.js";
import { createPostHogClient } from "../lib/posthog.js";
import type { PostHogClient } from "../lib/posthog.js";

export interface QueryArgs {
  query: string | null;
  file: string | null;
  // pnpm prints its own lines around stdout, so a caller that wants clean JSON names a file.
  output: string | null;
}

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(args: string[]): QueryArgs {
  const query = optionAfter(args, "--query");
  const file = optionAfter(args, "--file");
  if ((query === null) === (file === null)) {
    throw new Error("Pass exactly one of --query <hogql> or --file <path.sql>");
  }
  if (file !== null && !file.endsWith(".sql")) throw new Error("--file must point at a .sql file");
  return { query, file, output: optionAfter(args, "--output") };
}

export async function runQuery(
  hogql: string,
  client: PostHogClient,
  write: (text: string) => void,
): Promise<void> {
  const result = await client.query(hogql);
  write(`${JSON.stringify({ columns: result.columns, results: result.results }, null, 2)}\n`);
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const hogql = parsed.query ?? (await readFile(pathFromRoot(parsed.file ?? "", root), "utf8"));
  const client = createPostHogClient({
    apiKey: await requireDevkitKey(root, process.env, posthogKey),
  });

  if (parsed.output === null) {
    await runQuery(hogql, client, (text) => {
      process.stdout.write(text);
    });
    return 0;
  }
  let json = "";
  await runQuery(hogql, client, (text) => {
    json += text;
  });
  const output = pathFromRoot(parsed.output, root);
  await writeFile(output, json);
  process.stdout.write(`wrote ${output}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
