import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveLinearApiKey } from "./config.js";

async function rootWithEnvFile(content: string | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "devkit-config-"));
  if (content !== null) {
    await mkdir(join(root, "tooling", "devkit"), { recursive: true });
    await writeFile(join(root, "tooling", "devkit", ".env"), content);
  }
  return root;
}

describe("resolveLinearApiKey", () => {
  it("prefers the shell environment, which is how CI supplies it", async () => {
    const root = await rootWithEnvFile("LINEAR_API_KEY=from-file\n");

    await expect(resolveLinearApiKey(root, { LINEAR_API_KEY: " from-env " })).resolves.toBe(
      "from-env",
    );
  });

  it("then the devkit env file, keeping its other lines", async () => {
    const root = await rootWithEnvFile("OTHER=1\nLINEAR_API_KEY=from-file\n");

    await expect(resolveLinearApiKey(root, {})).resolves.toBe("from-file");
  });

  it("is null when nothing holds a key", async () => {
    const root = await rootWithEnvFile(null);

    await expect(resolveLinearApiKey(root, {})).resolves.toBeNull();
  });
});
