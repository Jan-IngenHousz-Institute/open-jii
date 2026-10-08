import { writeFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import { parseGrafanaEnvironment, requireGrafanaClient } from "../lib/grafana.js";
import type { GrafanaEnvironment } from "../lib/grafana.js";

export interface GetArgs {
  environment: GrafanaEnvironment;
  path: string;
  // pnpm prints its own lines around stdout, so a caller that wants clean JSON names a file.
  output: string | null;
}

export function parseArgs(argv: string[]): GetArgs {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const environment = args.at(0);
  const path = args.at(1);
  if (!path?.startsWith("/api/")) {
    throw new Error("Usage: pnpm grafana:get <prod|dev> /api/<path> [--output <file>]");
  }
  const index = args.indexOf("--output");
  const output = index < 0 ? null : (args[index + 1] ?? null);
  if (index >= 0 && output === null) throw new Error("--output requires a value");
  return { environment: parseGrafanaEnvironment(environment), path, output };
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const client = await requireGrafanaClient(root, process.env, parsed.environment);
  const json = `${JSON.stringify(await client.get(parsed.path), null, 2)}\n`;

  if (parsed.output === null) {
    process.stdout.write(json);
    return 0;
  }
  const output = pathFromRoot(parsed.output, root);
  await writeFile(output, json);
  process.stdout.write(`wrote ${output}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
