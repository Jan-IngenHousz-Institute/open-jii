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

const fileHint = "store the key in a file instead: pnpm linear:auth --file";

async function store(
  deps: KeychainDependencies,
  command: string,
  args: string[],
  input?: string,
): Promise<void> {
  let result: ProcessResult;
  try {
    result = await deps.run(command, args, input);
  } catch (error) {
    throw new Error(`${command} is not available on this machine; ${fileHint}`, { cause: error });
  }
  if (result.code !== 0) throw new Error(`${command} did not store the key; ${fileHint}`);
}

export async function writeKeychainSecret(
  service: string,
  value: string,
  overrides: Partial<KeychainDependencies> = {},
): Promise<void> {
  const deps = withDefaults(overrides);
  if (deps.platform === "darwin") {
    const args = ["add-generic-password", "-a", deps.account, "-s", service, "-w", value, "-U"];
    return store(deps, "security", args);
  }
  if (deps.platform === "linux") {
    const args = ["store", "--label=openJII Linear", "service", service];
    return store(deps, "secret-tool", args, value);
  }
  throw new Error(`No keychain support on ${deps.platform}; ${fileHint}`);
}
