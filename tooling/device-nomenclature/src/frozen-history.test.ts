import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { main as frozenHistoryMain } from "./frozen-history-cli.js";
import {
  frozenHistoryViolations,
  parseNameStatus,
  readFrozenHistoryChanges,
} from "./frozen-history.js";

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function commit(root: string, message: string): void {
  git(root, "add", ".");
  git(
    root,
    "-c",
    "user.name=Frozen History Test",
    "-c",
    "user.email=frozen-history@example.invalid",
    "commit",
    "-qm",
    message,
  );
}

async function createRepository(): Promise<{ base: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "frozen-history-git-"));
  git(root, "init", "-q");
  await mkdir(join(root, "packages/database/drizzle/meta"), { recursive: true });
  await mkdir(join(root, "apps/mobile/drizzle/meta"), { recursive: true });
  await writeFile(join(root, "packages/database/drizzle/0001_existing.sql"), "select 1;\n");
  await writeFile(join(root, "packages/database/drizzle/meta/0001_snapshot.json"), "{}\n");
  await writeFile(join(root, "packages/database/drizzle/meta/_journal.json"), "{}\n");
  await writeFile(join(root, "apps/mobile/drizzle/migrations.ts"), "export {};\n");
  commit(root, "base");
  return { base: git(root, "rev-parse", "HEAD"), root };
}

describe("frozen history guard", () => {
  it("parses NUL-delimited modifications and renames", () => {
    expect(
      parseNameStatus(
        "M\0packages/database/drizzle/0001.sql\0R100\0apps/mobile/drizzle/0001.sql\0apps/mobile/drizzle/0001-renamed.sql\0",
      ),
    ).toEqual([
      { status: "M", paths: ["packages/database/drizzle/0001.sql"] },
      {
        status: "R100",
        paths: ["apps/mobile/drizzle/0001.sql", "apps/mobile/drizzle/0001-renamed.sql"],
      },
    ]);
  });

  it("rejects changes to existing SQL and snapshots while allowing additions and mutable files", () => {
    const changes = parseNameStatus(
      [
        "M",
        "packages/database/drizzle/0001.sql",
        "D",
        "apps/mobile/drizzle/meta/0001_snapshot.json",
        "T",
        "packages/database/drizzle/meta/0002_snapshot.json",
        "R091",
        "packages/database/drizzle/0003.sql",
        "packages/database/drizzle/0003-renamed.sql",
        "A",
        "packages/database/drizzle/0039_new.sql",
        "A",
        "apps/mobile/drizzle/meta/0004_snapshot.json",
        "M",
        "packages/database/drizzle/meta/_journal.json",
        "M",
        "apps/mobile/drizzle/meta/_journal.json",
        "M",
        "apps/mobile/drizzle/migrations.ts",
        "M",
        "apps/mobile/drizzle/migrations.js",
        "",
      ].join("\0"),
    );

    expect(frozenHistoryViolations(changes)).toEqual([
      { status: "D", paths: ["apps/mobile/drizzle/meta/0001_snapshot.json"] },
      { status: "M", paths: ["packages/database/drizzle/0001.sql"] },
      {
        status: "R091",
        paths: ["packages/database/drizzle/0003.sql", "packages/database/drizzle/0003-renamed.sql"],
      },
      { status: "T", paths: ["packages/database/drizzle/meta/0002_snapshot.json"] },
    ]);
  });

  it("allows newly added history and expected mutable generated files through a real git diff", async () => {
    const { base, root } = await createRepository();
    try {
      await writeFile(join(root, "packages/database/drizzle/0002_new.sql"), "select 2;\n");
      await writeFile(join(root, "packages/database/drizzle/meta/0002_snapshot.json"), "{}\n");
      await writeFile(join(root, "packages/database/drizzle/meta/_journal.json"), '{"v":2}\n');
      await writeFile(join(root, "apps/mobile/drizzle/migrations.ts"), "export const v = 2;\n");
      commit(root, "add migration");

      const changes = await readFrozenHistoryChanges(root, base);
      expect(changes).toHaveLength(4);
      expect(changes).toEqual(
        expect.arrayContaining([
          { status: "A", paths: ["packages/database/drizzle/0002_new.sql"] },
          { status: "A", paths: ["packages/database/drizzle/meta/0002_snapshot.json"] },
          { status: "M", paths: ["packages/database/drizzle/meta/_journal.json"] },
          { status: "M", paths: ["apps/mobile/drizzle/migrations.ts"] },
        ]),
      );
      expect(frozenHistoryViolations(changes)).toEqual([]);
      expect(await frozenHistoryMain(["--root", root, "--base", base])).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an existing migration mutation through a real git diff", async () => {
    const { base, root } = await createRepository();
    try {
      await writeFile(join(root, "packages/database/drizzle/0001_existing.sql"), "select 99;\n");
      commit(root, "mutate migration");

      expect(frozenHistoryViolations(await readFrozenHistoryChanges(root, base))).toEqual([
        { status: "M", paths: ["packages/database/drizzle/0001_existing.sql"] },
      ]);
      expect(await frozenHistoryMain(["--root", root, "--base", base])).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
