import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// Owner-only, and other lines in the file survive.
export async function upsertEnvFile(path: string, variable: string, value: string): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
  const kept = existing
    .split("\n")
    .filter((line) => !line.startsWith(`${variable}=`) && line.trim() !== "");
  const content = `${[...kept, `${variable}=${value}`].join("\n")}\n`;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}
