import { execFile } from "node:child_process";

export const linearKeychainService = "openjii-linear";

export interface ProcessResult {
  stdout: string;
  code: number;
}

export interface KeychainDependencies {
  platform: NodeJS.Platform;
  account: string;
  run: (command: string, args: string[], input?: string) => Promise<ProcessResult>;
}

function runProcess(command: string, args: string[], input?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, (error, stdout) => {
      if (error === null) {
        resolve({ stdout, code: 0 });
        return;
      }
      // A missing tool surfaces as a string code such as ENOENT; a non-zero exit is numeric.
      if (typeof error.code !== "number") {
        reject(new Error(`${command} is not available on this machine`, { cause: error }));
        return;
      }
      resolve({ stdout, code: error.code });
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}

function withDefaults(overrides: Partial<KeychainDependencies>): KeychainDependencies {
  return {
    platform: process.platform,
    account: process.env.USER ?? "openjii",
    run: runProcess,
    ...overrides,
  };
}

function secretOrNull(result: ProcessResult): string | null {
  if (result.code !== 0) return null;
  const value = result.stdout.trim();
  return value.length > 0 ? value : null;
}

export async function readKeychainSecret(
  service: string,
  overrides: Partial<KeychainDependencies> = {},
): Promise<string | null> {
  const deps = withDefaults(overrides);
  try {
    if (deps.platform === "darwin") {
      const args = ["find-generic-password", "-a", deps.account, "-s", service, "-w"];
      return secretOrNull(await deps.run("security", args));
    }
    if (deps.platform === "linux") {
      return secretOrNull(await deps.run("secret-tool", ["lookup", "service", service]));
    }
    return null;
  } catch {
    // No keychain tool on this machine; the caller falls back to the env file.
    return null;
  }
}

export async function writeKeychainSecret(
  service: string,
  value: string,
  overrides: Partial<KeychainDependencies> = {},
): Promise<void> {
  const deps = withDefaults(overrides);
  if (deps.platform === "darwin") {
    const args = ["add-generic-password", "-a", deps.account, "-s", service, "-w", value, "-U"];
    const result = await deps.run("security", args);
    if (result.code !== 0) throw new Error("security add-generic-password did not succeed");
    return;
  }
  if (deps.platform === "linux") {
    const args = ["store", "--label=openJII Linear", "service", service];
    const result = await deps.run("secret-tool", args, value);
    if (result.code !== 0) throw new Error("secret-tool store did not succeed");
    return;
  }
  throw new Error(`No keychain support on ${deps.platform}; use pnpm linear:auth --file`);
}
