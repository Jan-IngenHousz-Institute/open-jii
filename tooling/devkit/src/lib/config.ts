import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type EnvRecord = Partial<Record<string, string>>;

export function repositoryRoot(): string {
  return fileURLToPath(new URL("../../../..", import.meta.url));
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

// Shell first, which is how CI supplies it, then the owner-only env file.
export async function resolveLinearApiKey(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
): Promise<string | null> {
  const shellValue = shellEnv.LINEAR_API_KEY?.trim();
  if (shellValue) return shellValue;
  return (await readEnvFile(devkitEnvPath(root))).LINEAR_API_KEY ?? null;
}
