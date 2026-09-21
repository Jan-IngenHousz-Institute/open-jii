import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  mainWorktreeRoot,
  pathFromRoot,
  requireLinearApiKey,
  resolveLinearApiKey,
} from "./config.js";

async function rootWithEnvFile(content: string | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "devkit-config-"));
  if (content !== null) {
    await mkdir(join(root, "tooling", "devkit"), { recursive: true });
    await writeFile(join(root, "tooling", "devkit", ".env"), content);
  }
  return root;
}

// A linked worktree, the way `git worktree add` lays it out: `.git` is a file, not a directory.
async function linkedWorktree(main: string, name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `devkit-wt-${name}-`));
  await writeFile(join(root, ".git"), `gitdir: ${main}/.git/worktrees/${name}\n`);
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

  it("then the main worktree's env file, so one linear:auth serves every worktree", async () => {
    const main = await rootWithEnvFile("LINEAR_API_KEY=from-main\n");
    const worktree = await linkedWorktree(main, "feature");

    await expect(resolveLinearApiKey(worktree, {})).resolves.toBe("from-main");
  });

  it("lets a worktree's own key win over the main one", async () => {
    const main = await rootWithEnvFile("LINEAR_API_KEY=from-main\n");
    const worktree = await linkedWorktree(main, "feature");
    await mkdir(join(worktree, "tooling", "devkit"), { recursive: true });
    await writeFile(join(worktree, "tooling", "devkit", ".env"), "LINEAR_API_KEY=own\n");

    await expect(resolveLinearApiKey(worktree, {})).resolves.toBe("own");
  });

  it("is null when nothing holds a key", async () => {
    const root = await rootWithEnvFile(null);

    await expect(resolveLinearApiKey(root, {})).resolves.toBeNull();
  });
});

describe("mainWorktreeRoot", () => {
  it("is null for a main checkout and for a pointer it cannot read", async () => {
    await expect(mainWorktreeRoot(await rootWithEnvFile(null))).resolves.toBeNull();
    const odd = await mkdtemp(join(tmpdir(), "devkit-odd-"));
    await writeFile(join(odd, ".git"), "gitdir: /elsewhere/.git\n");
    await expect(mainWorktreeRoot(odd)).resolves.toBeNull();
  });
});

describe("pathFromRoot", () => {
  it("resolves a relative path against the repo root, and leaves absolute ones alone", () => {
    expect(pathFromRoot("drafts/home.md", "/repo")).toBe("/repo/drafts/home.md");
    expect(pathFromRoot("/tmp/home.md", "/repo")).toBe("/tmp/home.md");
  });
});

describe("requireLinearApiKey", () => {
  it("names every place it looked, including the main worktree", async () => {
    const main = await rootWithEnvFile(null);
    const worktree = await linkedWorktree(main, "feature");

    await expect(requireLinearApiKey(worktree, {})).rejects.toThrow(
      `Looked at LINEAR_API_KEY in the shell, ${worktree}/tooling/devkit/.env, ${main}/tooling/devkit/.env. Run: pbpaste | pnpm linear:auth`,
    );
  });
});
