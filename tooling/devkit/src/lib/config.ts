import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type EnvRecord = Partial<Record<string, string>>;

export function repositoryRoot(): string {
  return fileURLToPath(new URL("../../../..", import.meta.url));
}

// `pnpm --filter` runs a command inside tooling/devkit and pnpm points INIT_CWD there too, so a
// relative path is taken from the repo root, which is where the aliases are run.
export function pathFromRoot(path: string, root: string): string {
  if (isAbsolute(path)) return path;
  return resolve(root, path);
}

export async function readEnvFile(path: string): Promise<EnvRecord> {
  try {
    return parse(await readFile(path));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
}

export async function resolveDatabaseUrl(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
): Promise<string | null> {
  const shellValue = shellEnv.DATABASE_URL?.trim();
  if (shellValue) return shellValue;
  return (await readEnvFile(`${root}/apps/backend/.env`)).DATABASE_URL ?? null;
}

// The package that uses a credential owns its env file, the way each app owns its own.
export function devkitEnvPath(root: string): string {
  return `${root}/tooling/devkit/.env`;
}

// A linked worktree's `.git` is a file naming `<main>/.git/worktrees/<name>`; the main
// checkout is where `linear:auth` was most likely run.
export async function mainWorktreeRoot(root: string): Promise<string | null> {
  let pointer: string;
  try {
    pointer = await readFile(`${root}/.git`, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const gitdir = /^gitdir:\s*(.+)$/m.exec(pointer)?.[1]?.trim();
  if (!gitdir) return null;
  const marker = gitdir.lastIndexOf("/.git/worktrees/");
  return marker < 0 ? null : gitdir.slice(0, marker);
}

export interface DevkitKey {
  variable: string;
  service: string;
  authCommand: string;
}

export const linearKey: DevkitKey = {
  variable: "LINEAR_API_KEY",
  service: "Linear",
  authCommand: "linear:auth",
};

export const posthogKey: DevkitKey = {
  variable: "POSTHOG_PERSONAL_API_KEY",
  service: "PostHog",
  authCommand: "posthog:auth",
};

// Shell first, which is how CI supplies it, then this checkout's env file, then the main
// worktree's, so one auth run serves every worktree.
export async function resolveDevkitKey(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
  key: DevkitKey,
): Promise<string | null> {
  const shellValue = shellEnv[key.variable]?.trim();
  if (shellValue) return shellValue;
  const local = (await readEnvFile(devkitEnvPath(root)))[key.variable];
  if (local) return local;
  const mainRoot = await mainWorktreeRoot(root);
  if (mainRoot === null) return null;
  return (await readEnvFile(devkitEnvPath(mainRoot)))[key.variable] ?? null;
}

// The refusal names every place it looked, so a key stored in another checkout is a
// one-line fix rather than a hunt.
export async function requireDevkitKey(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
  key: DevkitKey,
): Promise<string> {
  const value = await resolveDevkitKey(root, shellEnv, key);
  if (value) return value;
  const mainRoot = await mainWorktreeRoot(root);
  const looked = [
    `${key.variable} in the shell`,
    devkitEnvPath(root),
    ...(mainRoot === null ? [] : [devkitEnvPath(mainRoot)]),
  ];
  throw new Error(
    `No ${key.service} key found. Looked at ${looked.join(", ")}. Run: pbpaste | pnpm ${key.authCommand}`,
  );
}

export function resolveLinearApiKey(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
): Promise<string | null> {
  return resolveDevkitKey(root, shellEnv, linearKey);
}

export function requireLinearApiKey(root: string, shellEnv: NodeJS.ProcessEnv): Promise<string> {
  return requireDevkitKey(root, shellEnv, linearKey);
}
