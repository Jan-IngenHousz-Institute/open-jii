import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { openJiiEmailOTP } from "@repo/auth/email-otp";
import { and, db, eq, sessions, users, accounts } from "@repo/database";
import * as schema from "@repo/database/schema";

import { TestHarness } from "../test/test-harness";

const ORCID_ID = "0000-0002-1825-0097";
const NEW_EMAIL = "carol@uni.edu";

const sendEmail = vi.fn((_message: { email: string; otp: string; type: string }) =>
  Promise.resolve(),
);

/**
 * `src/test/setup.ts` mocks `@repo/auth/server`, so this builds a real instance on the test
 * database with the server config's schema mapping, ids, session and user settings, and its
 * email OTP plugin. The memory adapter in `packages/auth` cannot see Postgres refuse a row the
 * library writes, which is how registration broke before; this can.
 */
const auth = betterAuth({
  secret: "registration-email-change-spec-secret-0123456789",
  baseURL: "http://localhost:3020",
  basePath: "/api/v1/auth",
  emailAndPassword: { enabled: false },
  advanced: { database: { generateId: false } },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
      organization: schema.organizations,
      member: schema.organizationMembers,
      invitation: schema.organizationInvitations,
      team: schema.teams,
      teamMember: schema.teamMembers,
      apikey: schema.apiKeys,
      passkey: schema.passkeys,
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 60 * 24 },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      allowUnlinkingAll: true,
      trustedProviders: ["orcid"],
    },
  },
  user: {
    changeEmail: { enabled: true },
    additionalFields: {
      registered: { type: "boolean", defaultValue: false, required: false },
    },
  },
  plugins: [openJiiEmailOTP({ playReview: { email: undefined, otp: undefined }, sendEmail })],
});

/**
 * What a private-email ORCID sign-up leaves: the iD as its email, unverified, unregistered,
 * one ORCID row and a session. The session comes from a code sign-in, after which the row is
 * turned into that state.
 */
async function orcidSignUp() {
  const email = "signing-up@example.com";
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });
  if (!otp) throw new Error("No sign-in code was stored");

  const { headers: setCookies, response } = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });
  const cookie = setCookies
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  const userId = response.user.id;
  await db
    .update(users)
    .set({ email: ORCID_ID, emailVerified: false, registered: false })
    .where(eq(users.id, userId));
  await db.insert(accounts).values({ userId, providerId: "orcid", accountId: ORCID_ID });
  sendEmail.mockClear();

  return { userId, headers: new Headers({ cookie }) };
}

describe("registration gives a private-email ORCID sign-up an address", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("proves the new address with its code and keeps the ORCID row and the session", async () => {
    const { userId, headers } = await orcidSignUp();
    const [sessionBefore] = await db.select().from(sessions).where(eq(sessions.userId, userId));

    const requested = await auth.api.requestEmailChangeEmailOTP({
      body: { newEmail: NEW_EMAIL },
      headers,
      asResponse: true,
    });
    expect(requested.status).toBe(200);
    const sent = sendEmail.mock.calls.at(-1)?.[0];
    expect(sent).toMatchObject({ email: NEW_EMAIL, type: "change-email" });
    const otp = sent?.otp ?? "";

    const wrong = await auth.api.changeEmailEmailOTP({
      body: { newEmail: NEW_EMAIL, otp: otp === "000000" ? "111111" : "000000" },
      headers,
      asResponse: true,
    });
    expect(wrong.status).toBe(400);
    const [unchanged] = await db.select().from(users).where(eq(users.id, userId));
    expect(unchanged).toMatchObject({ email: ORCID_ID, emailVerified: false });

    const changed = await auth.api.changeEmailEmailOTP({
      body: { newEmail: NEW_EMAIL, otp },
      headers,
      asResponse: true,
    });
    expect(changed.status).toBe(200);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ email: NEW_EMAIL, emailVerified: true });
    const orcidRows = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "orcid")));
    expect(orcidRows).toHaveLength(1);
    const sessionsAfter = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(sessionsAfter.map((row) => row.id)).toEqual([sessionBefore.id]);

    const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    expect(session?.session.id).toBe(sessionBefore.id);
    expect(session?.user).toMatchObject({ email: NEW_EMAIL, emailVerified: true });
  });
});
