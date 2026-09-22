import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { repositoryRoot, resolveDatabaseUrl } from "../lib/config.js";
import { readLatestSignInOtp } from "../lib/otp.js";

interface LoginDependencies {
  root: string;
  env: NodeJS.ProcessEnv;
  request: typeof fetch;
  requestTimeoutMs: number;
  readOtp: typeof readLatestSignInOtp;
}

const requestTimeoutMs = 10_000;

function responseCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function storeCookies(jar: Map<string, string>, response: Response): void {
  for (const value of responseCookies(response)) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function postJson(
  request: typeof fetch,
  url: string,
  body: Record<string, string>,
  jar: Map<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const cookie = [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    storeCookies(jar, response);
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Authentication request timed out after ${timeoutMs} ms: ${url}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loginLocal(
  email: string,
  dependencies: Partial<LoginDependencies> = {},
): Promise<string> {
  const deps: LoginDependencies = {
    root: repositoryRoot(),
    env: process.env,
    request: fetch,
    requestTimeoutMs,
    readOtp: readLatestSignInOtp,
    ...dependencies,
  };
  const databaseUrl = await resolveDatabaseUrl(deps.root, deps.env);
  if (!databaseUrl) throw new Error("DATABASE_URL is missing; run pnpm db:setup");
  const baseUrl = deps.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3020";
  const authUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/auth`;
  const jar = new Map<string, string>();

  await postJson(
    deps.request,
    `${authUrl}/email-otp/send-verification-otp`,
    { email, type: "sign-in" },
    jar,
    deps.requestTimeoutMs,
  );
  const otp = await deps.readOtp(databaseUrl, email);
  await postJson(
    deps.request,
    `${authUrl}/sign-in/email-otp`,
    { email, otp },
    jar,
    deps.requestTimeoutMs,
  );
  const session = [...jar].find(([key]) => key.endsWith("session_token"));
  if (!session) throw new Error("Sign-in succeeded without returning a session cookie");
  return `${session[0]}=${session[1]}`;
}

// curl reads the header straight from the file (-H @file), so the cookie never enters a shell.
export async function writeSessionHeader(path: string, cookie: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `cookie: ${cookie}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function run(args: string[]): Promise<number> {
  const emailIndex = args.indexOf("--email");
  const email = emailIndex >= 0 ? args[emailIndex + 1] : "seed@openjii.local";
  if (!email) throw new Error("--email requires an address");

  const cookie = await loginLocal(email);
  if (args.includes("--print")) {
    process.stdout.write(`${cookie}\n`);
    return 0;
  }

  await writeSessionHeader(`${repositoryRoot()}/.claude/session.header`, cookie);
  process.stdout.write(
    "Session header written to .claude/session.header (mode 600). " +
      "Use it without reading it: curl -H @.claude/session.header http://127.0.0.1:3020/api/v1/...\n",
  );
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
