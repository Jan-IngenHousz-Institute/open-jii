import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface LinearClient {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface AuditEntry {
  at: string;
  ok: boolean;
  fields: string[];
  variables: string;
}

export interface LinearClientOptions {
  apiKey: string;
  request?: typeof fetch;
  endpoint?: string;
  // Mutations named *Delete or *Archive are refused unless this is set.
  allowDestructive?: boolean;
  audit?: (entry: AuditEntry) => void | Promise<void>;
}

export interface OperationSummary {
  kind: "query" | "mutation";
  fields: string[];
}

interface GraphqlError {
  message: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

const defaultEndpoint = "https://api.linear.app/graphql";
const identifier = /[A-Za-z_][A-Za-z0-9_]*/y;

function isGraphqlResponse<T>(value: unknown): value is GraphqlResponse<T> {
  return typeof value === "object" && value !== null;
}

export function isDestructive(field: string): boolean {
  return /Delete|(?<!Un)Archive/.test(field);
}

// Comments and string literals carry no structure and may hold braces or field names.
function stripLiterals(document: string): string {
  return document.replace(/"""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"|#[^\n]*/g, " ");
}

// A webhook's signing secret is the one thing a personal key can read that must never be printed.
export function selectsSecret(document: string): boolean {
  return /(^|[^A-Za-z0-9_])(secret|clientSecret)([^A-Za-z0-9_]|$)/.test(stripLiterals(document));
}

// Names the top-level selections. A guard for the policy, not a GraphQL parser.
export function describeOperation(document: string): OperationSummary {
  const source = stripLiterals(document);
  const isMutation = /(^|[^A-Za-z0-9_])mutation([^A-Za-z0-9_]|$)/.test(source);
  const kind: OperationSummary["kind"] = isMutation ? "mutation" : "query";
  const fields: string[] = [];
  let parens = 0;
  let braces = 0;
  let index = 0;

  while (index < source.length) {
    const char = source.charAt(index);
    if (char === "(") {
      parens += 1;
    } else if (char === ")") {
      parens -= 1;
    } else if (char === "{") {
      braces += 1;
    } else if (char === "}") {
      braces -= 1;
    } else if (braces === 1 && parens === 0 && /[A-Za-z_]/.test(char)) {
      identifier.lastIndex = index;
      const match = identifier.exec(source);
      const name = match ? match[0] : char;
      const after = index + name.length;
      const isAlias = /^\s*:/.test(source.slice(after));
      const isSpread = source.slice(Math.max(0, index - 3), index) === "...";
      if (!isAlias && !isSpread) fields.push(name);
      index = after;
      continue;
    }
    index += 1;
  }

  return { kind, fields };
}

// Personal API keys go in the Authorization header bare, without a Bearer prefix.
async function send<T>(
  request: typeof fetch,
  endpoint: string,
  apiKey: string,
  document: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query: document, variables }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Linear returned ${response.status}: ${text}`);
  }

  const parsed: unknown = JSON.parse(text);
  if (!isGraphqlResponse<T>(parsed)) {
    throw new Error(`Linear returned a non-object body: ${text}`);
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    const messages = parsed.errors.map((error) => error.message).join("; ");
    throw new Error(`Linear query failed: ${messages}`);
  }
  if (parsed.data === undefined) {
    throw new Error(`Linear returned no data: ${text}`);
  }
  return parsed.data;
}

export function createLinearClient(options: LinearClientOptions): LinearClient {
  const request = options.request ?? fetch;
  const endpoint = options.endpoint ?? defaultEndpoint;
  const allowDestructive = options.allowDestructive ?? false;

  return {
    async query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
      if (selectsSecret(document)) {
        throw new Error(
          "Refusing to select secret or clientSecret; signing secrets stay in Linear",
        );
      }

      const operation = describeOperation(document);
      if (operation.kind === "mutation" && !allowDestructive) {
        const destructive = operation.fields.filter(isDestructive);
        if (destructive.length > 0) {
          throw new Error(
            `Refusing destructive mutation ${destructive.join(", ")}; pass --allow-destructive only if you mean it`,
          );
        }
      }

      let ok = false;
      try {
        const data = await send<T>(request, endpoint, options.apiKey, document, variables);
        ok = true;
        return data;
      } finally {
        if (operation.kind === "mutation" && options.audit) {
          await options.audit({
            at: new Date().toISOString(),
            ok,
            fields: operation.fields,
            variables: JSON.stringify(variables).slice(0, 500),
          });
        }
      }
    },
  };
}

// Every mutation lands in .claude/linear-writes.log, which .gitignore already excludes. One key
// serves several agent sessions and worktrees, so each line names the session and the checkout
// that wrote it; Linear itself only ever sees the key's owner.
export function createFileAudit(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): (entry: AuditEntry) => Promise<void> {
  const path = `${root}/.claude/linear-writes.log`;
  const session = env.CLAUDE_CODE_SESSION_ID ?? "shell";
  return async (entry) => {
    await mkdir(dirname(path), { recursive: true });
    const outcome = entry.ok ? "ok" : "failed";
    const destructive = entry.fields.some(isDestructive) ? " destructive" : "";
    await appendFile(
      path,
      `${entry.at} ${outcome} ${entry.fields.join(",")} session=${session} root=${root}${destructive} ${entry.variables}\n`,
    );
  };
}
