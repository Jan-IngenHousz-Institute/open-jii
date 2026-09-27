import { readFileSync } from "node:fs";

import { devkitEnvPath, posthogKey, repositoryRoot } from "../lib/config.js";
import { upsertEnvFile } from "../lib/env-file.js";
import { createPostHogClient, posthogProjectId } from "../lib/posthog.js";

export interface PostHogAuthDependencies {
  readInput: () => string;
  verify: (key: string) => Promise<string[]>;
  storeFile: (key: string) => Promise<void>;
  write: (text: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The key must reach the openJII project; listing projects proves both validity and scope.
async function verifyKey(key: string): Promise<string[]> {
  const body = await createPostHogClient({ apiKey: key }).get("/api/projects/");
  const results = isRecord(body) && Array.isArray(body.results) ? body.results : [];
  const projects = results.flatMap((project) =>
    isRecord(project) ? [`${String(project.name)} (${String(project.id)})`] : [],
  );
  if (!projects.some((project) => project.endsWith(`(${posthogProjectId})`))) {
    throw new Error(`The key cannot read project ${posthogProjectId}; restrict it to openJII`);
  }
  return projects;
}

export async function authenticate(deps: PostHogAuthDependencies): Promise<void> {
  const key = deps.readInput().trim();
  if (key.length === 0) {
    throw new Error(
      "No key received on stdin. Pipe it in, for example pbpaste | pnpm posthog:auth on macOS",
    );
  }
  if (/\s/.test(key)) throw new Error("The input contains whitespace; paste only the key");

  const projects = await deps.verify(key);
  await deps.storeFile(key);

  deps.write(
    `PostHog key verified for ${projects.join(", ")}; stored in tooling/devkit/.env (mode 600)\n`,
  );
}

async function run(): Promise<number> {
  if (process.stdin.isTTY) {
    throw new Error(
      "The key is read from stdin so it never lands on a command line: pipe it in, for example pbpaste | pnpm posthog:auth on macOS",
    );
  }
  const root = repositoryRoot();
  await authenticate({
    readInput: () => readFileSync(0, "utf8"),
    verify: verifyKey,
    storeFile: (key) => upsertEnvFile(devkitEnvPath(root), posthogKey.variable, key),
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run();
}
