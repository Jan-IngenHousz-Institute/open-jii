import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { linearKeychainService, readKeychainSecret } from "./keychain.js";

type EnvRecord = Partial<Record<string, string>>;

export function repositoryRoot(): string {
  return fileURLToPath(new URL("../../../..", import.meta.url));
}

async function readEnvFile(path: string): Promise<EnvRecord> {
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

// Shell first for one-off overrides, then the keychain, then the owner-only env file as the fallback.
export async function resolveLinearApiKey(
  root: string,
  shellEnv: NodeJS.ProcessEnv,
  lookupKeychain: () => Promise<string | null> = () => readKeychainSecret(linearKeychainService),
): Promise<string | null> {
  const shellValue = shellEnv.LINEAR_API_KEY?.trim();
  if (shellValue) return shellValue;
  const keychainValue = await lookupKeychain();
  if (keychainValue) return keychainValue;
  return (await readEnvFile(`${root}/.claude/.env`)).LINEAR_API_KEY ?? null;
}
