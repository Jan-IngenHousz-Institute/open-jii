import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import nock from "nock";

import { openJiiEmailOTP } from "@repo/auth/email-otp";
import { authSchema, sharedAuthOptions } from "@repo/auth/options";
import { orcidProvider } from "@repo/auth/providers/orcid";
import { and, accounts, db, eq, passkeys, sessions, users } from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { UserRepository } from "./core/repositories/user.repository";
import { SignInMethodsAuthHook } from "./presentation/hooks/sign-in-methods-auth.hook";

const API = "http://localhost:3020";
const WEB = "http://localhost:3000";
const SECURITY = `${WEB}/en-US/platform/account/security`;
const ORCID_ID = "0000-0002-1825-0097";
const EMAIL = "researcher@example.com";
const NAME = "Carol Ndlovu";

/**
 * The backend's `@BeforeHook` on `/unlink-account`, reached the way the Nest adapter reaches
 * it: one handler on the instance's own `hooks.before`, matching the path by equality. Inert
 * until a test assigns it.
 */
let signInMethodsHook: SignInMethodsAuthHook | null = null;

/**
 * `src/test/setup.ts` mocks `@repo/auth/server`, so this builds a real instance on the test
 * database from the options the server itself is built from, with the ORCID and GitHub
 * providers configured as they are when their credentials are set.
 */
const auth = betterAuth({
  ...sharedAuthOptions,
  secret: "sign-in-methods-better-auth-spec-secret-0123456789",
  baseURL: API,
  trustedOrigins: [WEB],
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  socialProviders: { github: { clientId: "github-client", clientSecret: "github-secret" } },
  plugins: [
    openJiiEmailOTP({
      playReview: { email: undefined, otp: undefined },
      sendEmail: () => Promise.resolve(),
    }),
    genericOAuth({
      config: [
        orcidProvider({ clientId: "orcid-client", clientSecret: "s", environment: "sandbox" }),
      ],
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!signInMethodsHook || ctx.path !== "/unlink-account") return;
      await signInMethodsHook.guardUnlinkAccount(ctx);
    }),
  },
});

function request(path: string, init: { method?: string; cookie: string; body?: unknown }) {
  const { method = "POST", cookie, body } = init;
  return auth.handler(
    new Request(`${API}${sharedAuthOptions.basePath}${path}`, {
      method,
      headers: { "content-type": "application/json", origin: WEB, cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

function withCookies(response: Response, previous: string) {
  const fresh = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]);
  return [previous, ...fresh].filter(Boolean).join("; ");
}

/** A verified account with a name, a passkey and a session; the passkey is a second way in. */
async function signedInAccount() {
  await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email: EMAIL, type: "sign-in" } });
  if (!otp) throw new Error("No sign-in code was stored");
  const { headers, response } = await auth.api.signInEmailOTP({
    body: { email: EMAIL, otp },
    returnHeaders: true,
  });
  const cookie = withCookies(new Response(null, { headers }), "");
  const userId = response.user.id;

  await db.update(users).set({ name: NAME }).where(eq(users.id, userId));
  await db.insert(passkeys).values({
    publicKey: "public-key",
    userId,
    credentialID: crypto.randomUUID(),
    deviceType: "singleDevice",
  });
  const [session] = await db.select().from(sessions).where(eq(sessions.userId, userId));
  return { userId, cookie, sessionId: session.id };
}

/** Starts a link the way Security does and follows the provider back to the callback. */
async function connect(cookie: string, provider: "orcid" | "github") {
  const started = await request("/link-social", {
    cookie,
    body: {
      provider,
      callbackURL: `${SECURITY}?connected=${provider}`,
      errorCallbackURL: `${SECURITY}?connect=${provider}`,
    },
  });
  expect(started.status).toBe(200);
  const withState = withCookies(started, cookie);
  const { url } = (await started.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";

  const callback = await request(`/callback/${provider}?code=a-code&state=${state}`, {
    method: "GET",
    cookie: withState,
  });
  return new URL(callback.headers.get("location") ?? "", WEB);
}

const accountRows = (userId: string) =>
  db
    .select({ id: accounts.id, providerId: accounts.providerId, accountId: accounts.accountId })
    .from(accounts)
    .where(eq(accounts.userId, userId));

describe("linking and unlinking sign-in methods on the real library", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
    nock.disableNetConnect();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    signInMethodsHook = null;
  });

  afterEach(() => {
    nock.cleanAll();
    testApp.afterEach();
  });

  afterAll(async () => {
    nock.enableNetConnect();
    await testApp.teardown();
  });

  async function expectAccountUntouched(
    userId: string,
    cookie: string,
    sessionId: string,
  ): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ email: EMAIL, emailVerified: true, name: NAME });
    expect(await db.select().from(passkeys).where(eq(passkeys.userId, userId))).toHaveLength(1);
    const sessionRows = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(sessionRows.map((row) => row.id)).toEqual([sessionId]);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableCookieCache: true },
    });
    expect(session?.session.id).toBe(sessionId);
  }

  it("connects a private-email ORCID record to an account with another address", async () => {
    const { userId, cookie, sessionId } = await signedInAccount();
    nock("https://sandbox.orcid.org")
      .post("/oauth/token")
      .reply(200, { access_token: "orcid-token", token_type: "bearer", orcid: ORCID_ID });
    nock("https://pub.sandbox.orcid.org")
      .get(`/v3.0/${ORCID_ID}`)
      .reply(200, {
        person: {
          name: { "given-names": { value: "Carol" }, "family-name": { value: "Ndlovu" } },
          emails: { email: [] },
        },
      });

    const landed = await connect(cookie, "orcid");

    expect(landed.searchParams.get("connected")).toBe("orcid");
    expect(nock.isDone()).toBe(true);
    expect(await accountRows(userId)).toEqual([
      expect.objectContaining({ providerId: "orcid", accountId: ORCID_ID }),
    ]);
    await expectAccountUntouched(userId, cookie, sessionId);
  });

  it("connects a GitHub account whose email differs, beside an existing ORCID row", async () => {
    const { userId, cookie, sessionId } = await signedInAccount();
    await db.insert(accounts).values({ userId, providerId: "orcid", accountId: ORCID_ID });
    nock("https://github.com")
      .post("/login/oauth/access_token")
      .reply(200, { access_token: "github-token", token_type: "bearer", scope: "read:user" });
    nock("https://api.github.com")
      .get("/user")
      .reply(200, { id: 583231, login: "cndlovu", name: "Carol N", email: null })
      .get("/user/emails")
      .reply(200, [
        { email: "carol@github.example", primary: true, verified: true, visibility: "public" },
      ]);

    const landed = await connect(cookie, "github");

    expect(landed.searchParams.get("connected")).toBe("github");
    expect(nock.isDone()).toBe(true);
    const rows = await accountRows(userId);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ providerId: "orcid", accountId: ORCID_ID }),
        expect.objectContaining({ providerId: "github", accountId: "583231" }),
      ]),
    );
    await expectAccountUntouched(userId, cookie, sessionId);
  });

  describe("unlinking through the backend's guard", () => {
    /** The account a private-email ORCID sign-up leaves: the iD as its email, unverified. */
    async function orcidOnlyAccount() {
      const account = await signedInAccount();
      await db
        .update(users)
        .set({ email: ORCID_ID, emailVerified: false })
        .where(eq(users.id, account.userId));
      await db.delete(passkeys).where(eq(passkeys.userId, account.userId));
      const [row] = await db
        .insert(accounts)
        .values({ userId: account.userId, providerId: "orcid", accountId: ORCID_ID })
        .returning({ id: accounts.id });
      return { ...account, accountId: row.id };
    }

    beforeEach(() => {
      signInMethodsHook = new SignInMethodsAuthHook(testApp.module.get(UserRepository));
    });

    it("refuses to remove the only way in, and the row stays", async () => {
      const { userId, cookie, accountId } = await orcidOnlyAccount();

      const response = await request("/unlink-account", { cookie, body: { accountId } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "LAST_SIGN_IN_METHOD" });
      expect(await accountRows(userId)).toHaveLength(1);
    });

    it("removes the connection once a passkey is another way in", async () => {
      const { userId, cookie, accountId } = await orcidOnlyAccount();
      await db.insert(passkeys).values({
        publicKey: "public-key",
        userId,
        credentialID: crypto.randomUUID(),
        deviceType: "singleDevice",
      });

      const response = await request("/unlink-account", { cookie, body: { accountId } });

      expect(response.status).toBe(200);
      expect(
        await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))),
      ).toEqual([]);
    });
  });
});
