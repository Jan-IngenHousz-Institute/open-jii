import type { BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type * as Database from "@repo/database";

const CONTRACT =
  "apps/docs/content/developers/design-decisions/first-party-session-contract-adr.mdx";
const AUTH_URL = "https://api.openjii.org/api/v1/auth";
const SESSION_QUERY = "/get-session?disableCookieCache=true&disableRefresh=true";
const EMAIL = "sibling-contract@example.com";

const sessionAnswer = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.literal(EMAIL),
    emailVerified: z.literal(true),
    image: z.null(),
    registered: z.literal(false),
  }),
  session: z.object({
    id: z.string(),
    userId: z.string(),
    expiresAt: z.string().datetime(),
    token: z.string(),
  }),
});

const { tables } = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  return { tables };
});

vi.mock("better-auth/adapters/drizzle", () => ({
  // Postgres supplies UUID defaults. The memory adapter supplies them in its place.
  drizzleAdapter: () => (options: BetterAuthOptions) => ({
    ...memoryAdapter(tables)({
      ...options,
      advanced: { ...options.advanced, database: { generateId: "uuid" } },
    }),
    id: "drizzle",
  }),
}));

vi.mock("@repo/database", async (importOriginal) => {
  const actual = await importOriginal<typeof Database>();
  return {
    ...actual,
    ensurePersonalOrganization: vi.fn(),
    db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) },
  };
});

async function configuredServer(environment = "prod") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", environment === "local" ? "development" : "production");
  vi.stubEnv("ENVIRONMENT_PREFIX", environment === "local" ? "dev" : environment);
  vi.stubEnv(
    "NEXT_PUBLIC_BASE_URL",
    environment === "local"
      ? "http://localhost:3000"
      : environment === "prod"
        ? "https://openjii.org"
        : "https://dev.openjii.org",
  );
  vi.stubEnv(
    "NEXT_PUBLIC_API_URL",
    environment === "local"
      ? "http://localhost:3020"
      : environment === "dev"
        ? "https://api.dev.openjii.org"
        : "https://api.openjii.org",
  );
  vi.stubEnv(
    "COOKIE_DOMAIN",
    environment === "local"
      ? undefined
      : environment === "prod"
        ? ".openjii.org"
        : ".dev.openjii.org",
  );
  vi.stubEnv("AUTH_SECRET", "test-only-sibling-session-0123456789abcdef");
  for (const key of [
    "AUTH_EMAIL_SERVER",
    "AUTH_EMAIL_FROM",
    "AUTH_PLAY_REVIEW_EMAIL",
    "AUTH_PLAY_REVIEW_OTP",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "AUTH_ORCID_ID",
    "AUTH_ORCID_SECRET",
  ]) {
    vi.stubEnv(key, undefined);
  }
  return (await import("./server.js")).auth;
}

type Server = Awaited<ReturnType<typeof configuredServer>>;

function request(auth: Server, path: string, cookie?: string) {
  return auth.handler(
    new Request(`${AUTH_URL}${path}`, {
      headers: cookie ? { cookie } : undefined,
    }),
  );
}

async function signIn(auth: Server) {
  await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email: EMAIL, type: "sign-in" } });
  if (!otp) throw new Error(`Missing test code. See ${CONTRACT}`);
  const response = await auth.api.signInEmailOTP({ body: { email: EMAIL, otp }, asResponse: true });
  expect(response.status, CONTRACT).toBe(200);
  const cookies = response.headers.getSetCookie();
  const token = cookies.find((cookie) =>
    cookie.startsWith("__Secure-better-auth.prod.session_token="),
  );
  if (!token) throw new Error(`Missing token cookie. See ${CONTRACT}`);
  return {
    cookies,
    tokenHeader: token,
    token: token.split(";", 1)[0],
    allCookies: cookies.map((cookie) => cookie.split(";", 1)[0]).join("; "),
  };
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  for (const key of [
    "user",
    "session",
    "account",
    "verification",
    "rateLimit",
    "organization",
    "member",
    "team",
    "teamMember",
    "invitation",
    "apikey",
    "passkey",
  ])
    tables[key] = [];
  tables.user.push({
    id: "00000000-0000-4000-8000-000000000001",
    name: "Contract researcher",
    email: EMAIL,
    emailVerified: true,
    image: null,
    registered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterEach(() => vi.unstubAllEnvs());

describe(`first-party session contract: ${CONTRACT}`, () => {
  it.each([
    ["prod", "__Secure-better-auth.prod.session_token", ".openjii.org"],
    ["local", "better-auth.dev.session_token", undefined],
    ["dev", "__Secure-better-auth.dev.session_token", ".dev.openjii.org"],
  ])("pins the configured %s cookie name and attributes", async (environment, name, domain) => {
    const auth = await configuredServer(environment);
    const { authCookies } = await auth.$context;
    expect(authCookies.sessionToken, CONTRACT).toEqual({
      name,
      attributes: {
        secure: environment !== "local",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        ...(domain ? { domain } : {}),
        maxAge: 60 * 60 * 24 * 30,
      },
    });
  });

  it("emits the production session token with the documented attributes", async () => {
    const auth = await configuredServer();
    const { tokenHeader } = await signIn(auth);
    for (const attribute of [
      "Secure",
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Domain=.openjii.org",
      "Max-Age=2592000",
    ]) {
      expect(tokenHeader, CONTRACT).toContain(attribute);
    }
  });

  it("returns null for an absent or invalid session", async () => {
    const auth = await configuredServer();
    for (const cookie of [undefined, "__Secure-better-auth.prod.session_token=invalid"]) {
      const response = await request(auth, SESSION_QUERY, cookie);
      expect(response.status, CONTRACT).toBe(200);
      expect(await response.json(), CONTRACT).toBeNull();
    }
  });

  it("returns the documented fields from the session token alone", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    const response = await request(auth, SESSION_QUERY, token);
    expect(response.status, CONTRACT).toBe(200);
    const parsed = sessionAnswer.safeParse(await response.json());
    expect(parsed.success, CONTRACT).toBe(true);
    if (parsed.success) {
      expect(parsed.data.session.userId, CONTRACT).toBe(parsed.data.user.id);
    }
    expect(response.headers.getSetCookie(), CONTRACT).toEqual([]);
  });

  it("refuses an expired server session", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    tables.session[0].expiresAt = new Date(Date.now() - 1000);
    const response = await request(auth, SESSION_QUERY, token);
    expect(response.status, CONTRACT).toBe(200);
    expect(await response.json(), CONTRACT).toBeNull();
  });

  it("bypasses a still-valid cookie cache after the server session is revoked", async () => {
    const auth = await configuredServer();
    const { allCookies } = await signIn(auth);
    expect(allCookies, CONTRACT).toContain("__Secure-better-auth.prod.session_data=");
    tables.session.length = 0;
    const cached = await request(auth, "/get-session", allCookies);
    expect(sessionAnswer.safeParse(await cached.json()).success, CONTRACT).toBe(true);
    const checked = await request(auth, SESSION_QUERY, allCookies);
    expect(checked.status, CONTRACT).toBe(200);
    expect(await checked.json(), CONTRACT).toBeNull();
  });

  it("does not refresh an old session or set cookies when refresh is disabled", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    const session = tables.session[0];
    session.updatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    session.expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const before = structuredClone(session);
    const response = await request(auth, SESSION_QUERY, token);
    expect(response.status, CONTRACT).toBe(200);
    expect(await response.json(), CONTRACT).not.toBeNull();
    expect(tables.session[0], CONTRACT).toEqual(before);
    expect(response.headers.getSetCookie(), CONTRACT).toEqual([]);
  });

  it.each(["owner", "admin", "member"])(
    "returns a member's %s role for the requested organization",
    async (role) => {
      const auth = await configuredServer();
      const { token } = await signIn(auth);
      tables.member.push({
        id: "membership",
        userId: tables.user[0].id,
        organizationId: "jii-contract-org",
        role,
        createdAt: new Date(),
      });
      const response = await request(
        auth,
        "/organization/get-active-member-role?organizationId=jii-contract-org",
        token,
      );
      expect(response.status, CONTRACT).toBe(200);
      expect(await response.json(), CONTRACT).toEqual({ role });
    },
  );

  it("refuses a signed-in non-member and an anonymous request", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    tables.member.push({
      id: "other-membership",
      userId: tables.user[0].id,
      organizationId: "other-org",
      role: "owner",
      createdAt: new Date(),
    });
    const path = "/organization/get-active-member-role?organizationId=jii-contract-org";
    const nonMember = await request(auth, path, token);
    expect(nonMember.status, CONTRACT).toBe(403);
    expect(await nonMember.json(), CONTRACT).toEqual(
      expect.objectContaining({ code: "YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION" }),
    );
    const anonymous = await request(auth, path);
    expect(anonymous.status, CONTRACT).toBe(401);
  });
});
