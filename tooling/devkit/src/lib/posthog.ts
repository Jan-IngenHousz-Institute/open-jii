import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// One PostHog project serves dev and prod; events carry an `environment` property to tell them apart.
export const posthogProjectId = "80726";
export const posthogHost = "https://eu.posthog.com";

export type IssueStatus = "active" | "resolved" | "suppressed";

export interface HogqlResult {
  columns: string[];
  results: unknown[][];
}

export interface PostHogAuditEntry {
  at: string;
  ok: boolean;
  action: string;
  target: string;
  detail: string;
}

export interface PostHogClient {
  query(hogql: string): Promise<HogqlResult>;
  get(path: string): Promise<unknown>;
  setIssueStatus(issueId: string, status: IssueStatus): Promise<void>;
}

export interface PostHogClientOptions {
  apiKey: string;
  projectId?: string;
  host?: string;
  request?: typeof fetch;
  audit?: (entry: PostHogAuditEntry) => void | Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHogqlResult(value: unknown): value is HogqlResult {
  return isRecord(value) && Array.isArray(value.columns) && Array.isArray(value.results);
}

export function issueUrl(issueId: string, projectId = posthogProjectId): string {
  return `${posthogHost}/project/${projectId}/error_tracking/${issueId}`;
}

export function createPostHogClient(options: PostHogClientOptions): PostHogClient {
  const request = options.request ?? fetch;
  const projectId = options.projectId ?? posthogProjectId;
  const host = options.host ?? posthogHost;

  async function send(path: string, init: { method: string; body?: unknown }): Promise<unknown> {
    // Pagination hands back absolute URLs; anything else is a path on the same host.
    const url = path.startsWith(host) ? path : `${host}${path}`;
    const response = await request(url, {
      method: init.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `PostHog refused the key (${response.status}). It may lack a scope or have been rotated; ` +
          "mint a new one and run pbpaste | pnpm posthog:auth in the main checkout",
      );
    }
    if (!response.ok) throw new Error(`PostHog returned ${response.status}: ${text.slice(0, 500)}`);
    return text.length === 0 ? null : JSON.parse(text);
  }

  return {
    async query(hogql) {
      const result = await send(`/api/projects/${projectId}/query/`, {
        method: "POST",
        body: { query: { kind: "HogQLQuery", query: hogql } },
      });
      if (!isHogqlResult(result)) throw new Error("PostHog answered the query without results");
      return result;
    },

    get(path) {
      return send(path, { method: "GET" });
    },

    async setIssueStatus(issueId, status) {
      let ok = false;
      try {
        await send(`/api/environments/${projectId}/error_tracking/issues/${issueId}/`, {
          method: "PATCH",
          body: { status },
        });
        ok = true;
      } finally {
        await options.audit?.({
          at: new Date().toISOString(),
          ok,
          action: "issue.status",
          target: issueId,
          detail: status,
        });
      }
    },
  };
}

// Every write lands in .claude/posthog-writes.log, which .gitignore already excludes, naming the
// agent session and checkout that made it; PostHog itself only sees the key's owner.
export function createPostHogFileAudit(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): (entry: PostHogAuditEntry) => Promise<void> {
  const path = `${root}/.claude/posthog-writes.log`;
  const session = env.CLAUDE_CODE_SESSION_ID ?? "shell";
  return async (entry) => {
    await mkdir(dirname(path), { recursive: true });
    const outcome = entry.ok ? "ok" : "failed";
    await appendFile(
      path,
      `${entry.at} ${outcome} ${entry.action} ${entry.target} ${entry.detail} session=${session} root=${root}\n`,
    );
  };
}

// Rows come back as positional arrays; this names each value by its column.
export function rowsOf(result: HogqlResult): Record<string, unknown>[] {
  return result.results.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}
