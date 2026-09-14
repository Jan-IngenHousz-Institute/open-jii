import { readFileSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { repositoryRoot } from "../lib/config.js";
import { linearKeychainService, writeKeychainSecret } from "../lib/keychain.js";
import { createLinearClient } from "../lib/linear.js";

export interface Identity {
  name: string;
  teams: string[];
}

export interface AuthDependencies {
  readInput: () => string;
  verify: (key: string) => Promise<Identity>;
  storeKeychain: (key: string) => Promise<void>;
  storeFile: (key: string) => Promise<void>;
  write: (text: string) => void;
}

interface ViewerResult {
  viewer: { name: string };
  teams: { nodes: { key: string }[] };
}

async function verifyKey(key: string): Promise<Identity> {
  const client = createLinearClient({ apiKey: key });
  const result = await client.query<ViewerResult>("{ viewer { name } teams { nodes { key } } }");
  return { name: result.viewer.name, teams: result.teams.nodes.map((team) => team.key) };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// The fallback for machines without a keychain. Owner-only, and other lines in the file survive.
export async function upsertEnvFile(path: string, key: string): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
  const kept = existing
    .split("\n")
    .filter((line) => !line.startsWith("LINEAR_API_KEY=") && line.trim() !== "");
  const content = `${[...kept, `LINEAR_API_KEY=${key}`].join("\n")}\n`;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function authenticate(useFile: boolean, deps: AuthDependencies): Promise<void> {
  const key = deps.readInput().trim();
  if (key.length === 0) {
    throw new Error("No key received on stdin. Paste it in: pbpaste | pnpm linear:auth");
  }
  if (/\s/.test(key)) throw new Error("The input contains whitespace; paste only the key");

  const identity = await deps.verify(key);
  if (useFile) {
    await deps.storeFile(key);
  } else {
    await deps.storeKeychain(key);
  }

  const teams = identity.teams.length > 0 ? identity.teams.join(", ") : "none";
  const where = useFile ? ".claude/.env (mode 600)" : "the OS keychain";
  deps.write(`Linear key verified for ${identity.name}, teams ${teams}; stored in ${where}\n`);
}

async function run(args: string[]): Promise<number> {
  const root = repositoryRoot();
  await authenticate(args.includes("--file"), {
    readInput: () => readFileSync(0, "utf8"),
    verify: verifyKey,
    storeKeychain: (key) => writeKeychainSecret(linearKeychainService, key),
    storeFile: (key) => upsertEnvFile(`${root}/.claude/.env`, key),
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
