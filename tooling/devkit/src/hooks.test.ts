import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { repositoryRoot } from "./lib/config.js";

const hook = join(repositoryRoot(), ".claude", "hooks", "docs-reminder.sh");
const hasJq = spawnSync("jq", ["--version"]).status === 0;

interface Scratch {
  repo: string;
  state: string;
}

function git(repo: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
    cwd: repo,
    stdio: "ignore",
  });
}

async function put(repo: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(repo, path)), { recursive: true });
  await writeFile(join(repo, path), content);
}

// A branch that already changed apps/web before the session starts, the case that used to fire.
async function scratch(): Promise<Scratch> {
  const repo = await mkdtemp(join(tmpdir(), "docs-reminder-repo-"));
  git(repo, "init", "-q", "-b", "main");
  await put(repo, "README.md", "x\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "switch", "-q", "-c", "feat/earlier");
  await put(repo, "apps/web/page.tsx", "earlier\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "earlier web work");
  return { repo, state: await mkdtemp(join(tmpdir(), "docs-reminder-state-")) };
}

function runHook(where: Scratch, event: "SessionStart" | "Stop", session: string): string {
  const result = spawnSync("bash", [hook], {
    cwd: where.repo,
    env: { ...process.env, TMPDIR: where.state },
    input: JSON.stringify({ session_id: session, hook_event_name: event }),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`hook exited ${result.status}: ${result.stderr}`);
  return result.stdout;
}

describe.skipIf(!hasJq)("docs-reminder hook", () => {
  it("ignores web work that was on the branch before the session started", async () => {
    const where = await scratch();

    runHook(where, "SessionStart", "s1");

    expect(runHook(where, "Stop", "s1")).toBe("");
  });

  it("reminds once when the session changes web code, and not again", async () => {
    const where = await scratch();
    runHook(where, "SessionStart", "s1");

    await put(where.repo, "apps/web/page.tsx", "changed in this session\n");

    expect(JSON.parse(runHook(where, "Stop", "s1"))).toMatchObject({ decision: "block" });
    expect(runHook(where, "Stop", "s1")).toBe("");
  });

  it("counts a new file and a commit made during the session, but not edits it found", async () => {
    const found = await scratch();
    await put(found.repo, "apps/web/draft.tsx", "untracked before the session\n");
    await put(found.repo, "apps/web/page.tsx", "dirty before the session\n");
    runHook(found, "SessionStart", "s1");
    expect(runHook(found, "Stop", "s1")).toBe("");

    const added = await scratch();
    runHook(added, "SessionStart", "s2");
    await put(added.repo, "apps/mobile/screen.tsx", "new\n");
    expect(runHook(added, "Stop", "s2")).toContain("block");

    const committed = await scratch();
    runHook(committed, "SessionStart", "s3");
    await put(committed.repo, "apps/web/page.tsx", "committed in this session\n");
    git(committed.repo, "commit", "-q", "-am", "session work");
    expect(runHook(committed, "Stop", "s3")).toContain("block");
  });

  it("stays quiet when the session changed the docs too", async () => {
    const where = await scratch();
    runHook(where, "SessionStart", "s1");

    await put(where.repo, "apps/web/page.tsx", "changed\n");
    await put(where.repo, "apps/docs/content/guide.mdx", "documented\n");

    expect(runHook(where, "Stop", "s1")).toBe("");
  });

  it("keeps the first snapshot when a session resumes", async () => {
    const where = await scratch();
    runHook(where, "SessionStart", "s1");
    await put(where.repo, "apps/web/page.tsx", "changed before the resume\n");

    runHook(where, "SessionStart", "s1");

    expect(runHook(where, "Stop", "s1")).toContain("block");
  });

  it("falls back to the branch diff when no session start was recorded", async () => {
    const where = await scratch();

    expect(runHook(where, "Stop", "unrecorded")).toContain("block");
  });
});
