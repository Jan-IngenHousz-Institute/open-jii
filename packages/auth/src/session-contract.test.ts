import type { BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type * as Database from "@repo/database";

const ADR = "apps/docs/content/developers/design-decisions/first-party-session-contract-adr.mdx";

// This test is the contract sibling apps such as Equipment sign in against, so each failure says what they rely on.
function relied(reason: string) {
  return `${reason} Equipment's server relies on this; coordinate an Equipment release before changing it. See ${ADR}.`;
}

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
  if (!otp) throw new Error("Missing test sign-in code.");
  const response = await auth.api.signInEmailOTP({ body: { email: EMAIL, otp }, asResponse: true });
  expect(response.status, "Test sign-in failed.").toBe(200);
  const cookies = response.headers.getSetCookie();
  const token = cookies.find((cookie) =>
    cookie.startsWith("__Secure-better-auth.prod.session_token="),
  );
  if (!token) {
    throw new Error(
      relied(
        "Production sign-in must set __Secure-better-auth.prod.session_token. Equipment reads the token by that exact name.",
      ),
    );
  }
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

describe(`first-party session contract (${ADR})`, () => {
  it.each([
    ["prod", "__Secure-better-auth.prod.session_token", ".openjii.org"],
    ["local", "better-auth.dev.session_token", undefined],
    ["dev", "__Secure-better-auth.dev.session_token", ".dev.openjii.org"],
  ])("pins the configured %s cookie name and attributes", async (environment, name, domain) => {
    const auth = await configuredServer(environment);
    const { authCookies } = await auth.$context;
    expect(
      authCookies.sessionToken,
      relied(
        `The ${environment} token cookie name and attributes changed. Equipment reads the token by this exact name, and the domain decides which hosts receive it.`,
      ),
    ).toEqual({
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
      expect(
        tokenHeader,
        relied(
          `The production token cookie lost ${attribute}. It must stay a Secure, HttpOnly, 30-day cookie on .openjii.org.`,
        ),
      ).toContain(attribute);
    }
  });

  it("returns null for an absent or invalid session", async () => {
    const auth = await configuredServer();
    for (const cookie of [undefined, "__Secure-better-auth.prod.session_token=invalid"]) {
      const response = await request(auth, SESSION_QUERY, cookie);
      const signedOut = relied(
        "An absent or invalid session must answer HTTP 200 with JSON null, which Equipment reads as signed out.",
      );
      expect(response.status, signedOut).toBe(200);
      expect(await response.json(), signedOut).toBeNull();
    }
  });

  it("returns the documented fields from the session token alone", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    const response = await request(auth, SESSION_QUERY, token);
    const fields = relied(
      "A session check with only the token cookie must answer HTTP 200 with user (id, name, email, emailVerified, registered, image) and session (id, userId, expiresAt). The answer also holds session.token, so it is never logged.",
    );
    expect(response.status, fields).toBe(200);
    const parsed = sessionAnswer.safeParse(await response.json());
    expect(parsed.success, fields).toBe(true);
    if (parsed.success) {
      expect(parsed.data.session.userId, fields).toBe(parsed.data.user.id);
    }
    expect(
      response.headers.getSetCookie(),
      relied(
        "A valid session check must set no cookies; Equipment never passes openJII cookies back to the browser.",
      ),
    ).toEqual([]);
  });

  it("refuses an expired server session", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    tables.session[0].expiresAt = new Date(Date.now() - 1000);
    const response = await request(auth, SESSION_QUERY, token);
    const expired = relied("An expired session must answer HTTP 200 with JSON null.");
    expect(response.status, expired).toBe(200);
    expect(await response.json(), expired).toBeNull();
  });

  it("bypasses a still-valid cookie cache after the server session is revoked", async () => {
    const auth = await configuredServer();
    const { allCookies } = await signIn(auth);
    const bypass = relied(
      "disableCookieCache=true must check the server session, so a revoked openJII session ends in Equipment even while the session_data cache cookie is still valid.",
    );
    expect(allCookies, "The cookie cache this test bypasses is no longer issued.").toContain(
      "__Secure-better-auth.prod.session_data=",
    );
    tables.session.length = 0;
    const cached = await request(auth, "/get-session", allCookies);
    expect(
      sessionAnswer.safeParse(await cached.json()).success,
      "Without the bypass the cache should still answer, or this test proves nothing.",
    ).toBe(true);
    const checked = await request(auth, SESSION_QUERY, allCookies);
    expect(checked.status, bypass).toBe(200);
    expect(await checked.json(), bypass).toBeNull();
  });

  it("does not refresh an old session or set cookies when refresh is disabled", async () => {
    const auth = await configuredServer();
    const { token } = await signIn(auth);
    const session = tables.session[0];
    session.updatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    session.expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const before = structuredClone(session);
    const response = await request(auth, SESSION_QUERY, token);
    const readOnly = relied(
      "disableRefresh=true must leave the session row and cookies untouched, so Equipment's checks never extend an openJII session.",
    );
    expect(response.status, readOnly).toBe(200);
    expect(await response.json(), readOnly).not.toBeNull();
    expect(tables.session[0], readOnly).toEqual(before);
    expect(response.headers.getSetCookie(), readOnly).toEqual([]);
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
      const member = relied(
        "get-active-member-role must answer HTTP 200 with the role for the organizationId asked for, since Equipment checks JII membership by the organization's stable id.",
      );
      expect(response.status, member).toBe(200);
      expect(await response.json(), member).toEqual({ role });
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
    const refusal = relied(
      "A signed-in non-member must get HTTP 403 YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION and an anonymous request HTTP 401. Equipment reads only that 403 as non-membership and treats any other status, 429 and 5xx included, as no answer.",
    );
    expect(nonMember.status, refusal).toBe(403);
    expect(await nonMember.json(), refusal).toEqual(
      expect.objectContaining({ code: "YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION" }),
    );
    const anonymous = await request(auth, path);
    expect(anonymous.status, refusal).toBe(401);
  });
});
