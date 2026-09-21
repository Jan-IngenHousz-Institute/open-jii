import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const router = join(root, ".claude/hooks/role-router.sh");
const sessionStart = join(root, ".claude/hooks/session-start.sh");

interface TranscriptOptions {
  developerTurns?: number;
  toolResults?: number;
  compactions?: number;
}

/**
 * A transcript shaped like the real thing: tool results and compaction summaries are `user` lines
 * too, which is exactly what the turn counter has to see through.
 */
function writeTranscript(directory: string, options: TranscriptOptions): string {
  const lines: string[] = [];
  for (let i = 0; i < (options.developerTurns ?? 0); i += 1) {
    lines.push(JSON.stringify({ type: "user", message: { content: `turn ${i}` } }));
  }
  for (let i = 0; i < (options.toolResults ?? 0); i += 1) {
    lines.push(
      JSON.stringify({
        type: "user",
        message: { content: [{ type: "tool_result", content: "ok" }] },
      }),
    );
  }
  for (let i = 0; i < (options.compactions ?? 0); i += 1) {
    lines.push(
      JSON.stringify({ type: "user", isCompactSummary: true, message: { content: "summary" } }),
    );
  }
  lines.push(JSON.stringify({ type: "assistant", message: { content: "hello" } }));

  const path = join(directory, "transcript.jsonl");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

function runHook(
  script: string,
  payload: Record<string, unknown>,
  temp: string,
  projectDir = root,
): { status: number; stdout: string } {
  const result = spawnSync("bash", [script], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, TMPDIR: temp, CLAUDE_PROJECT_DIR: projectDir },
  });
  return { status: result.status ?? -1, stdout: result.stdout };
}

function contextOf(stdout: string): string {
  if (stdout.trim() === "") return "";
  const parsed: unknown = JSON.parse(stdout);
  const output = (parsed as { hookSpecificOutput?: { additionalContext?: string } })
    .hookSpecificOutput;
  return output?.additionalContext ?? "";
}

let temp: string;
let session: string;

beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), "openjii-roles-test-"));
  session = `s${Math.random().toString(36).slice(2)}`;
});

describe("role-router.sh", () => {
  const route = (prompt: string, transcript?: string) =>
    runHook(router, { session_id: session, prompt, transcript_path: transcript ?? "" }, temp);

  /** What the prompt was read as, before a role that does not exist yet is swapped out. */
  const candidate = () => readFileSync(join(temp, "openjii-roles", session, "candidate"), "utf8");

  it.each([
    [
      "a pasted stack trace",
      "pls fix\nError: connect ECONNREFUSED 127.0.0.1:5433\n    at TCPConnectWrap.afterConnect (node:net:1595:16)",
      "triage",
    ],
    ["a bare ticket reference", "take a look at OJD-1755 please", "engineer"],
    ["a ticket with design words", "can you refine OJD-1755 and design the project", "pm"],
    ["a design request with no ticket", "I want to design a project for offline sync", "pm"],
    ["a question about what to build", "what should we build for the export flow", "pm"],
    ["a question about production", "why is the backend slow in production right now", "analyst"],
    ["an overnight pipeline failure", "databricks pipeline centrum failed overnight", "analyst"],
    ["a review request", "please review the diff on this branch", "reviewer"],
    ["a release request", "cut a release for this week", "release-manager"],
    ["a documentation request", "the docs page for sharing is out of date", "docs-writer"],
    ["a screenshot request", "re-capture the screenshots for the overview", "docs-writer"],
    ["an implementation request", "add a column for the embargo date", "engineer"],
    [
      "an implementation request with visual words",
      "implement the threshold colour mode",
      "engineer",
    ],
    ["a visual complaint", "make the device list look less cramped", "designer"],
    ["a contrast problem", "the dark mode contrast on the sidebar is too low", "designer"],
    ["a short question with a mark", "which command seeds the database?", "butler"],
    ["a short question without one", "what does the MULTI_LANGUAGE flag do", "butler"],
    [
      "a long open request",
      "walk me through the whole sharing model, I have an hour",
      "generalist",
    ],
  ])("reads %s as the %s role", (_label, prompt, expected) => {
    route(prompt);

    expect(candidate()).toBe(expected);
  });

  it("suggests the role it read, when that role's skill is present", () => {
    route("take a look at OJD-1755 please");

    expect(candidate()).toBe("engineer");
    expect(readFileSync(join(temp, "openjii-roles", session, "role"), "utf8")).toBe("engineer");
  });

  it("only ever suggests a role whose skill exists", () => {
    const prompts = [
      "pls fix\nError: boom\n    at x (y.ts:1:1)",
      "take a look at OJD-1755 please",
      "can you refine OJD-1755 and design the project",
      "why is the backend slow in production right now",
      "please review the diff on this branch",
      "which command seeds the database?",
      "walk me through how sharing works here",
    ];

    for (const prompt of prompts) {
      const fresh = `s${Math.random().toString(36).slice(2)}`;
      runHook(router, { session_id: fresh, prompt }, temp);
      const suggested = readFileSync(join(temp, "openjii-roles", fresh, "role"), "utf8");

      expect(
        existsSync(join(root, ".agents/skills", `openjii-role-${suggested}`, "SKILL.md")),
      ).toBe(true);
    }
  });

  it("says nothing when the prompt already names a role, and records it", () => {
    const result = route("/openjii-role-engineer backend fix the thing");

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  it("stays silent on a second turn", () => {
    route("walk me through how sharing works here");

    expect(route("and what about devices").stdout.trim()).toBe("");
  });

  it("ignores another slash command without consuming the first turn", () => {
    expect(route("/model opus").stdout.trim()).toBe("");
    expect(contextOf(route("which command seeds the database?").stdout)).toContain(
      "openjii-role-butler",
    );
  });

  it("nudges once past thirty developer turns, and not on tool results alone", () => {
    route("walk me through how sharing works here");

    const noisy = writeTranscript(temp, { developerTurns: 5, toolResults: 400 });
    expect(route("carry on", noisy).stdout.trim()).toBe("");

    const long = writeTranscript(temp, { developerTurns: 31, toolResults: 400 });
    expect(contextOf(route("carry on", long).stdout)).toContain("31 developer turns");
    expect(route("carry on", long).stdout.trim()).toBe("");
  });

  it("nudges on a second compaction", () => {
    route("walk me through how sharing works here");
    const compacted = writeTranscript(temp, { developerTurns: 4, compactions: 2 });

    expect(contextOf(route("carry on", compacted).stdout)).toContain("compacted 2 times");
  });

  it("never fails the prompt", () => {
    expect(route("anything at all").status).toBe(0);
    expect(runHook(router, { prompt: "no session id" }, temp).status).toBe(0);
  });
});

describe("the opt-out", () => {
  const offMarker = join(root, ".claude/roles-off");

  afterEach(() => {
    rmSync(offMarker, { force: true });
  });

  it("silences the suggestion when the marker file exists", () => {
    writeFileSync(offMarker, "", "utf8");

    const result = runHook(router, { session_id: session, prompt: "OJD-1755 please" }, temp);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  it("silences the role list when the marker file exists", () => {
    writeFileSync(offMarker, "", "utf8");

    expect(
      runHook(sessionStart, { session_id: session, source: "startup" }, temp).stdout.trim(),
    ).toBe("");
  });

  it("silences both through the environment variable", () => {
    const off = { ...process.env, TMPDIR: temp, CLAUDE_PROJECT_DIR: root, OPENJII_ROLES: "off" };
    const run = (script: string, payload: Record<string, unknown>) =>
      spawnSync("bash", [script], { input: JSON.stringify(payload), encoding: "utf8", env: off });

    expect(run(router, { session_id: session, prompt: "OJD-1755 please" }).stdout.trim()).toBe("");
    expect(run(sessionStart, { session_id: session, source: "startup" }).stdout.trim()).toBe("");
  });

  it("leaves the cloud guard alone, because that one has no opt-out", () => {
    writeFileSync(offMarker, "", "utf8");
    const guard = join(root, ".claude/hooks/analyst-guard.sh");
    const result = spawnSync("bash", [guard], {
      input: JSON.stringify({ session_id: session, tool_input: { command: "tofu apply" } }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: root, OPENJII_ROLES: "off" },
    });

    expect(result.status).toBe(2);
  });
});

describe("openjii_known_role", () => {
  const ask = (role: string) =>
    spawnSync(
      "bash",
      [
        "-c",
        `. "${root}/.claude/hooks/lib/roles-lib.sh"; openjii_known_role "${root}" "${role}" && echo yes || echo no`,
      ],
      { encoding: "utf8" },
    ).stdout.trim();

  it("knows a role that has a skill from one that does not", () => {
    expect(ask("generalist")).toBe("yes");
    expect(ask("nonexistent")).toBe("no");
  });
});

describe("session-start.sh", () => {
  it("lists the roles on a fresh session", () => {
    const result = runHook(sessionStart, { session_id: session, source: "startup" }, temp);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("optional");
    expect(result.stdout).toContain("generalist");
    expect(result.stdout).toContain("analyst");
    expect(result.stdout).toContain("roles-off");
  });

  it("names the remembered role when a session resumes", () => {
    runHook(router, { session_id: session, prompt: "/openjii-role-triage the build" }, temp);
    const result = runHook(sessionStart, { session_id: session, source: "resume" }, temp);

    expect(result.stdout).toContain("triage");
  });

  it("says nothing when a resumed session never had a role", () => {
    const result = runHook(sessionStart, { session_id: session, source: "compact" }, temp);

    expect(result.stdout.trim()).toBe("");
  });
});
