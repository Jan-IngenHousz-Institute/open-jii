import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveLinearApiKey } from "./config.js";

async function rootWithEnvFile(content: string | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "devkit-config-"));
  if (content !== null) {
    await mkdir(join(root, ".claude"));
    await writeFile(join(root, ".claude", ".env"), content);
  }
  return root;
}

describe("resolveLinearApiKey", () => {
  it("prefers the shell environment", async () => {
    const root = await rootWithEnvFile("LINEAR_API_KEY=from-file\n");

    await expect(
      resolveLinearApiKey(root, { LINEAR_API_KEY: " from-env " }, () =>
        Promise.resolve("from-keychain"),
      ),
    ).resolves.toBe("from-env");
  });

  it("then the keychain", async () => {
    const root = await rootWithEnvFile("LINEAR_API_KEY=from-file\n");

    await expect(
      resolveLinearApiKey(root, {}, () => Promise.resolve("from-keychain")),
    ).resolves.toBe("from-keychain");
  });

  it("then the env file", async () => {
    const root = await rootWithEnvFile("OTHER=1\nLINEAR_API_KEY=from-file\n");

    await expect(resolveLinearApiKey(root, {}, () => Promise.resolve(null))).resolves.toBe(
      "from-file",
    );
  });

  it("is null when nothing holds a key", async () => {
    const root = await rootWithEnvFile(null);

    await expect(resolveLinearApiKey(root, {}, () => Promise.resolve(null))).resolves.toBeNull();
  });
});
