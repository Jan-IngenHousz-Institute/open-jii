import { readFileSync } from "node:fs";

import { devkitEnvPath, repositoryRoot } from "../lib/config.js";
import { upsertEnvFile } from "../lib/env-file.js";
import {
  createGrafanaClient,
  grafanaKeys,
  parseGrafanaEnvironment,
  rulesOf,
  rulesPath,
} from "../lib/grafana.js";
import type { GrafanaEnvironment } from "../lib/grafana.js";

export interface GrafanaAuthArgs {
  environment: GrafanaEnvironment;
  url: string;
}

export interface GrafanaAuthDependencies {
  readInput: () => string;
  verify: (url: string, token: string) => Promise<number>;
  store: (values: Record<string, string>) => Promise<void>;
  write: (text: string) => void;
}

// A workspace's address is its id under the regional Amazon Managed Grafana domain.
export function parseArgs(argv: string[]): GrafanaAuthArgs {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const environment = parseGrafanaEnvironment(args.at(0));
  const index = args.indexOf("--workspace");
  const workspace = index < 0 ? undefined : args[index + 1];
  if (!workspace || !/^g-[a-z0-9]+$/.test(workspace)) {
    throw new Error("Pass the workspace id the token was minted in: --workspace g-<id>");
  }
  return {
    environment,
    url: `https://${workspace}.grafana-workspace.eu-central-1.amazonaws.com`,
  };
}

export async function authenticate(
  args: GrafanaAuthArgs,
  deps: GrafanaAuthDependencies,
): Promise<void> {
  const token = deps.readInput().trim();
  if (token.length === 0) {
    throw new Error(
      "No token received on stdin. Pipe it in, as tooling/devkit/README.md shows for pnpm grafana:auth",
    );
  }
  if (/\s/.test(token)) throw new Error("The input contains whitespace; pipe in only the token");

  const rules = await deps.verify(args.url, token);
  const keys = grafanaKeys(args.environment);
  await deps.store({ [keys.url.variable]: args.url, [keys.token.variable]: token });

  deps.write(
    `Grafana ${args.environment} token verified: it reads ${rules} alert rules. ` +
      "Stored in tooling/devkit/.env (mode 600)\n",
  );
}

// The token must read what the round reads first, so a token for the wrong account or
// workspace is refused before it is stored.
async function countRules(
  environment: GrafanaEnvironment,
  url: string,
  token: string,
): Promise<number> {
  const rules = rulesOf(await createGrafanaClient({ url, token, environment }).get(rulesPath));
  if (rules.length === 0) throw new Error(`The token reads no alert rules in ${environment}`);
  return rules.length;
}

async function run(argv: string[]): Promise<number> {
  if (process.stdin.isTTY) {
    throw new Error(
      "The token is read from stdin so it never lands on a command line: pipe it in, as tooling/devkit/README.md shows",
    );
  }
  const args = parseArgs(argv);
  const root = repositoryRoot();
  await authenticate(args, {
    readInput: () => readFileSync(0, "utf8"),
    verify: (url, token) => countRules(args.environment, url, token),
    store: async (values) => {
      for (const [variable, value] of Object.entries(values)) {
        await upsertEnvFile(devkitEnvPath(root), variable, value);
      }
    },
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
