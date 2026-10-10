import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { repositoryRoot } from "./lib/config.js";

const hook = join(repositoryRoot(), ".claude", "hooks", "docs-reminder.sh");
const hasJq = spawnSync("jq", ["--version"]).status === 0;
const temporary: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporary.push(path);
  return path;
}

afterAll(async () => {
  await Promise.all(temporary.map((path) => rm(path, { recursive: true, force: true })));
});

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
  const repo = await temporaryDirectory("docs-reminder-repo-");
  git(repo, "init", "-q", "-b", "main");
  await put(repo, "README.md", "x\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "switch", "-q", "-c", "feat/earlier");
  await put(repo, "apps/web/page.tsx", "earlier\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "earlier web work");
  return { repo, state: await temporaryDirectory("docs-reminder-state-") };
}

function runHook(
  where: Scratch,
  event: "SessionStart" | "Stop",
  session: string,
  cwd = where.repo,
): string {
  const result = spawnSync("bash", [hook], {
    cwd,
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

  it("counts an edit to a file that was already untracked when the session started", async () => {
    const where = await scratch();
    await put(where.repo, "apps/web/draft.tsx", "left untracked by an earlier session\n");
    runHook(where, "SessionStart", "s1");
    expect(runHook(where, "Stop", "s1")).toBe("");

    await put(where.repo, "apps/web/draft.tsx", "rewritten in this session\n");

    expect(runHook(where, "Stop", "s1")).toContain("block");
  });

  it("judges a checkout the session moved into by its own branch, not the first snapshot", async () => {
    const start = await scratch();
    const moved = await scratch();
    runHook(start, "SessionStart", "s1");

    const inMoved = { repo: moved.repo, state: start.state };

    expect(runHook(inMoved, "Stop", "s1")).toContain("block");
  });

  it("reads paths from the repository root when run from a subdirectory", async () => {
    const where = await scratch();
    runHook(where, "SessionStart", "s1");
    await put(where.repo, "apps/web/page.tsx", "changed\n");

    expect(runHook(where, "Stop", "s1", join(where.repo, "apps"))).toContain("block");
  });

  it("stays quiet when the session changed the docs too", async () => {
    const where = await scratch();
    runHook(where, "SessionStart", "s1");

    await put(where.repo, "apps/web/page.tsx", "changed\n");
    await put(where.repo, "apps/docs/content/guide.mdx", "documented\n");

    expect(runHook(where, "Stop", "s1")).toBe("");
  });

  it("counts docs the branch already changed, whichever session wrote them", async () => {
    const where = await scratch();
    await put(where.repo, "apps/docs/content/guide.mdx", "documented earlier on the branch\n");
    git(where.repo, "add", ".");
    git(where.repo, "commit", "-q", "-m", "docs");
    runHook(where, "SessionStart", "s1");

    await put(where.repo, "apps/web/page.tsx", "changed in this session\n");

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
