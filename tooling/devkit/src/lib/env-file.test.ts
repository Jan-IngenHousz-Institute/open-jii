import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { upsertEnvFile } from "./env-file.js";

describe("upsertEnvFile", () => {
  it("replaces the variable's line, keeps other lines, and sets owner-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devkit-env-"));
    const path = join(dir, ".claude", ".env");

    await upsertEnvFile(path, "LINEAR_API_KEY", "first");
    await upsertEnvFile(path, "POSTHOG_PERSONAL_API_KEY", "other");
    await upsertEnvFile(path, "LINEAR_API_KEY", "second");

    expect(await readFile(path, "utf8")).toBe(
      "POSTHOG_PERSONAL_API_KEY=other\nLINEAR_API_KEY=second\n",
    );
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
