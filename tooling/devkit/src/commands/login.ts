import { repositoryRoot, resolveDatabaseUrl } from "../lib/config.js";
import { readLatestSignInOtp } from "../lib/otp.js";

interface LoginDependencies {
  root: string;
  env: NodeJS.ProcessEnv;
  request: typeof fetch;
  readOtp: typeof readLatestSignInOtp;
  write: (text: string) => void;
}

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
): Promise<Response> {
  const cookie = [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
  const response = await request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  storeCookies(jar, response);
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
  return response;
}

export async function loginLocal(
  email: string,
  dependencies: Partial<LoginDependencies> = {},
): Promise<string> {
  const deps: LoginDependencies = {
    root: repositoryRoot(),
    env: process.env,
    request: fetch,
    readOtp: readLatestSignInOtp,
    write: (text) => process.stdout.write(text),
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
  );
  const otp = await deps.readOtp(databaseUrl, email);
  await postJson(deps.request, `${authUrl}/sign-in/email-otp`, { email, otp }, jar);
  const session = [...jar].find(([key]) => key.endsWith("session_token"));
  if (!session) throw new Error("Sign-in succeeded without returning a session cookie");
  const cookie = `${session[0]}=${session[1]}`;
  deps.write(`${cookie}\n`);
  return cookie;
}

async function run(args: string[]): Promise<number> {
  const emailIndex = args.indexOf("--email");
  const email = emailIndex >= 0 ? args[emailIndex + 1] : "seed@openjii.local";
  if (!email) throw new Error("--email requires an address");
  await loginLocal(email);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
