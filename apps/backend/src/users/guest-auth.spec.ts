import { AuthService } from "@thallesp/nestjs-better-auth";
import { betterAuth } from "better-auth";
import { applySetCookies } from "better-auth/cookies";
import { anonymous } from "better-auth/plugins";
import { z } from "zod";

import { DISABLED_ADMIN_PATHS } from "@repo/auth/admin";
import { openJiiGuest } from "@repo/auth/guest";
import type * as AuthServer from "@repo/auth/server";
import {
  and,
  createSecondaryDatabase,
  db,
  eq,
  ensurePersonalOrganization,
  experiments,
  guestUsage,
  organizationMembers,
  organizations,
  notifications,
  profiles,
  resourceVisits,
  rateLimits,
  sessions,
  sql,
  users,
  verifications,
} from "@repo/database";
import type { DbOrTx } from "@repo/database";

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { LAMBDA_PORT } from "../macros/core/ports/lambda.port";
import type { LambdaPort } from "../macros/core/ports/lambda.port";
import { backendPidOf, waitUntilBlocked } from "../test/lock-wait";
import { TestHarness } from "../test/test-harness";
import { PurgeExpiredGuestsUseCase } from "./application/use-cases/purge-expired-guests/purge-expired-guests";
import guestAuthEndpoints from "./guest-auth-endpoints.json";

const enabled = vi.fn().mockResolvedValue(true);
const { auth: productionAuth } = await vi.importActual<typeof AuthServer>("@repo/auth/server");
function createAuth(hooks: typeof productionAuth.options.hooks, limiterEnabled = false) {
  return betterAuth({
    ...productionAuth.options,
    hooks,
    rateLimit: { ...productionAuth.options.rateLimit, enabled: limiterEnabled },
    plugins: productionAuth.options.plugins.map((plugin) =>
      plugin.id === "anonymous" ? openJiiGuest({ isDemoEnabled: enabled }) : plugin,
    ),
  });
}
let auth: ReturnType<typeof createAuth>;
const base = `${productionAuth.options.baseURL}/api/v1/auth`;

function post(path: string, body: unknown = {}, cookie = "") {
  return auth.handler(
    new Request(`${base}${path}`, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
  );
}

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function guest(name?: unknown) {
  const response = await post("/sign-in/anonymous", name === undefined ? {} : { name });
  expect(response.status, await response.clone().text()).toBe(200);
  const raw: unknown = await response.json();
  const body = z
    .object({
      user: z.object({ id: z.string().uuid(), name: z.string(), isAnonymous: z.boolean() }),
    })
    .parse(raw);
  expect(raw).not.toHaveProperty("user.email");
  return { ...body.user, cookie: cookies(response) };
}

async function legacyCachedSession(cookie: string) {
  // Mint the still-valid identity cache that deployed clients can bring across this change.
  const legacy = betterAuth({
    ...auth.options,
    plugins: auth.options.plugins.map((plugin) =>
      plugin.id === "anonymous" ? anonymous({ disableDeleteAnonymousUser: true }) : plugin,
    ),
  });
  const cached = await legacy.handler(new Request(`${base}/get-session`, { headers: { cookie } }));
  expect(cached.status).toBe(200);
  expect(cached.headers.getSetCookie()).toEqual(
    expect.arrayContaining([expect.stringMatching(/session_data=[^;]/)]),
  );
  const jar = new Headers({ cookie });
  applySetCookies(jar, cached.headers.getSetCookie());
  return { legacy, cookie: z.string().parse(jar.get("cookie")) };
}

describe("anonymous sessions on the production auth boundary", () => {
  const app = TestHarness.App;
  beforeAll(async () => {
    await app.setup();
    // Nest installs its discovered @BeforeHook handlers before plugin hooks.
    auth = createAuth(
      app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
    );
  });
  beforeEach(async () => {
    await app.beforeEach();
    await db.delete(rateLimits);
    enabled.mockResolvedValue(true);
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("uses the persisted ten-per-minute entry limit and resets the window", async () => {
    auth = createAuth(
      app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
      true,
    );
    const initial = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(initial);
    const enter = (ip: string, extraAddress = "198.51.100.99") =>
      auth.handler(
        new Request(`${base}/sign-in/anonymous`, {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            "x-forwarded-for": ip,
            "x-real-ip": extraAddress,
          },
          body: JSON.stringify({ name: "Synthetic" }),
        }),
      );
    try {
      for (let i = 0; i < 10; i++) expect((await enter("192.0.2.1")).status).toBe(200);
      const limited = await enter("192.0.2.1", "198.51.100.100");
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("x-retry-after"))).toBeGreaterThan(0);
      expect((await enter("192.0.2.2")).status).toBe(200);
      clock.mockReturnValue(initial + 61_000);
      expect((await enter("192.0.2.1")).status).toBe(200);
    } finally {
      clock.mockRestore();
      auth = createAuth(
        app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
      );
    }
  });

  it("rejects the trailing-slash anonymous route without creating a user", async () => {
    const before = await db.select({ id: users.id }).from(users);
    const response = await post("/sign-in/anonymous/", { name: "Synthetic visitor" });
    expect(response.status).toBe(404);
    expect(await db.select({ id: users.id }).from(users)).toEqual(before);
  });

  it("records the shared two-hop fallback that gates production demo-mode on OJD-2040", async () => {
    auth = createAuth(
      app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
      true,
    );
    const enter = (forwarded: string) =>
      auth.handler(
        new Request(`${base}/sign-in/anonymous`, {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            "x-forwarded-for": forwarded,
          },
          body: JSON.stringify({ name: "Synthetic" }),
        }),
      );
    try {
      for (let i = 0; i < 10; i++)
        expect((await enter("192.0.2.1, 198.51.100.1")).status).toBe(200);
      expect((await enter("192.0.2.2, 198.51.100.1")).status).toBe(429);
      expect((await enter("203.0.113.99, 192.0.2.2, 198.51.100.1")).status).toBe(429);
    } finally {
      auth = createAuth(
        app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
      );
    }
  });

  it("classifies all installed auth endpoints and refuses every denied HTTP route without effects", async () => {
    const actual = Object.entries(auth.api)
      .map(([name, endpoint]) => ({
        name,
        path: endpoint.path || null,
        methods: Array.isArray(endpoint.options.method)
          ? endpoint.options.method
          : [endpoint.options.method],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(guestAuthEndpoints.map(({ name, path, methods }) => ({ name, path, methods }))).toEqual(
      actual,
    );
    const visitor = await guest();
    const before = {
      users: await db.select().from(users),
      sessions: await db.select().from(sessions),
      members: await db.select().from(organizationMembers),
    };
    for (const endpoint of guestAuthEndpoints) {
      if (!endpoint.path) {
        expect(endpoint.classification).toBe("server-only");
        continue;
      }
      expect(endpoint.classification === "unreachable:404").toBe(
        DISABLED_ADMIN_PATHS.includes(endpoint.path),
      );
      if (!["deny:403", "unreachable:404"].includes(endpoint.classification)) continue;
      for (const method of endpoint.methods) {
        const path = endpoint.path.replace(/:[^/]+/g, "synthetic");
        const response = await auth.handler(
          new Request(`${base}${path}`, {
            method,
            headers: {
              origin: "http://localhost:3000",
              "content-type": "application/json",
              cookie: visitor.cookie,
            },
            ...(method !== "GET"
              ? {
                  body: JSON.stringify({
                    name: "Synthetic",
                    email: "unclaimed@example.test",
                    otp: "000000",
                    userId: visitor.id,
                    role: "admin",
                  }),
                }
              : {}),
          }),
        );
        expect(response.status, `${method} ${path}: ${await response.clone().text()}`).toBe(
          endpoint.classification === "unreachable:404" ? 404 : 403,
        );
      }
    }
    expect(await db.select().from(users)).toEqual(before.users);
    expect(await db.select().from(sessions)).toEqual(before.sessions);
    expect(await db.select().from(organizationMembers)).toEqual(before.members);
  });

  it("creates a named guest without a profile, workspace or membership rows", async () => {
    await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    await app.createOrganization(undefined, { type: "university", visibility: "public" });
    const user = await guest("  Synthetic Visitor  ");
    expect(user).toMatchObject({ name: "Synthetic Visitor", isAnonymous: true });
    expect(await db.select().from(profiles).where(eq(profiles.userId, user.id))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, `personal-${user.id}`)),
    ).toHaveLength(0);
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, user.id)),
    ).toEqual([]);
    expect(await db.select().from(notifications)).toEqual([]);
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.email).toMatch(/@guest\.openjii\.invalid$/);
    expect(stored.registered).toBe(false);
    const session = await auth.handler(
      new Request(`${base}/get-session`, { headers: { cookie: user.cookie } }),
    );
    const sessionBody: unknown = await session.json();
    expect(sessionBody).toMatchObject({ user: { id: user.id, isAnonymous: true } });
    expect(sessionBody).not.toHaveProperty("user.email");
    const internalSession = await auth.api.getSession({
      headers: new Headers({ cookie: user.cookie }),
    });
    expect(internalSession?.user.email).toMatch(/@guest\.openjii\.invalid$/);
  });

  it("ignores forged identity fields and accepts a trimmed Unicode name at the limit", async () => {
    const forgedId = crypto.randomUUID();
    const name = "é".repeat(60);
    const response = await post("/sign-in/anonymous", {
      name: `  ${name}  `,
      id: forgedId,
      userId: forgedId,
      email: "not-used@example.test",
      isAnonymous: false,
      role: "admin",
    });
    expect(response.status).toBe(200);
    const body = z
      .object({ user: z.object({ id: z.string(), name: z.string(), isAnonymous: z.boolean() }) })
      .parse(await response.json());
    expect(body.user.id).not.toBe(forgedId);
    expect(body.user.name).toBe(name);
    const [stored] = await db.select().from(users).where(eq(users.id, body.user.id));
    expect(stored).toMatchObject({ isAnonymous: true, role: "user", registered: false, name });
    expect(stored.email).toMatch(/@guest\.openjii\.invalid$/);
  });

  it("uses Guest for an omitted name and refuses invalid names before creating rows", async () => {
    expect((await guest()).name).toBe("Guest");
    const before = await db.select().from(users);
    for (const name of ["a".repeat(61), "https://example.org", "www.example.org", 4, {}]) {
      expect((await post("/sign-in/anonymous", { name })).status).toBe(400);
    }
    expect(await db.select().from(users)).toEqual(before);
  });

  it("refuses guest membership rows and turning a researcher into a guest", async () => {
    const visitor = await guest();
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const researcher = await app.createTestUser();
    await expect(
      db.insert(organizationMembers).values({ organizationId: demo, userId: visitor.id }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await db.insert(organizationMembers).values({ organizationId: demo, userId: researcher });
    await expect(
      db
        .update(organizationMembers)
        .set({ userId: visitor.id })
        .where(eq(organizationMembers.userId, researcher)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      db.update(users).set({ isAnonymous: true }).where(eq(users.id, researcher)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, visitor.id)),
    ).toEqual([]);
  });

  it("refuses an uncommitted guest before its organization FK can wait and admit it", async () => {
    const organizationId = await app.createOrganization(undefined, {
      type: "university",
      visibility: "private",
    });
    const other = createSecondaryDatabase();
    const userId = crypto.randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          name: "Uncommitted visitor",
          email: `${userId}@guest.openjii.invalid`,
          isAnonymous: true,
        });
        await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .for("update");
        await expect(
          other.database.transaction(async (contender) => {
            await contender.execute(sql`SET LOCAL lock_timeout = '1s'`);
            await contender
              .insert(organizationMembers)
              .values({ organizationId, userId, role: "owner" });
          }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      });
      expect(
        await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId)),
      ).toEqual([]);
    } finally {
      await other.close();
    }
  });

  it("provisions a researcher's personal membership in the transaction creating the user", async () => {
    const userId = crypto.randomUUID();
    const organizationId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ id: userId, name: "New researcher", email: `${userId}@example.test` })
        .returning();
      return ensurePersonalOrganization(tx, user);
    });
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId)),
    ).toMatchObject([{ organizationId, role: "owner" }]);
  });

  it("refuses membership when a researcher is replaced by a guest while its organization FK waits", async () => {
    const organizationId = await app.createOrganization(undefined, {
      type: "university",
      visibility: "private",
    });
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Replaceable researcher",
      email: userId + "@example.test",
    });
    const contender = createSecondaryDatabase();
    const observer = createSecondaryDatabase();
    const pid = await backendPidOf(contender.database);
    let outcome: Promise<unknown> | undefined;
    try {
      await db.transaction(async (tx) => {
        await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .for("update");
        await tx.delete(users).where(eq(users.id, userId));
        await tx.insert(users).values({
          id: userId,
          name: "Replacement visitor",
          email: userId + "@guest.openjii.invalid",
          isAnonymous: true,
        });
        const membership = contender.database.transaction(async (other) => {
          await other.execute(sql`SET LOCAL lock_timeout = '5s'`);
          await other.insert(organizationMembers).values({ organizationId, userId, role: "owner" });
        });
        outcome = membership.then(
          () => null,
          (error: unknown) => error,
        );
        await waitUntilBlocked(observer.database, pid);
      });
      expect(await outcome).toMatchObject({ cause: { code: "23514" } });
      expect(
        await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId)),
      ).toEqual([]);
      expect(await db.select().from(users).where(eq(users.id, userId))).toMatchObject([
        { isAnonymous: true },
      ]);
    } finally {
      await contender.close();
      await observer.close();
    }
  });

  describe("the review deadlock schedules", () => {
    // Each side holds its row locks open while the other runs on its own connection. The second
    // side committing before the first releases proves it never waited; a wait fails it on the
    // lock timeout instead of hanging.
    async function whileHeld(
      hold: (tx: DbOrTx) => Promise<unknown>,
      contend: (database: DbOrTx) => Promise<unknown>,
    ) {
      const other = createSecondaryDatabase();
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let acquired!: () => void;
      const held = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const holder = db.transaction(async (tx) => {
        await hold(tx);
        acquired();
        await released;
      });
      try {
        await held;
        await other.database.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL lock_timeout = '1s'`);
          await contend(tx);
        });
      } finally {
        release();
        await holder;
        await other.close();
      }
    }

    async function demoWithMember() {
      const demo = await app.createOrganization(undefined, {
        type: "demo",
        visibility: "public",
      });
      const member = await app.createTestUser();
      await db.insert(organizationMembers).values({ organizationId: demo, userId: member });
      return { demo, member };
    }

    function convert(database: DbOrTx, demo: string, slug?: string) {
      return database
        .update(organizations)
        .set({ type: "university", ...(slug ? { slug } : {}) })
        .where(eq(organizations.id, demo));
    }

    function updateRole(database: DbOrTx, demo: string, member: string) {
      return database
        .update(organizationMembers)
        .set({ role: "admin" })
        .where(
          and(eq(organizationMembers.organizationId, demo), eq(organizationMembers.userId, member)),
        );
    }

    function createGuestRow(database: DbOrTx) {
      const id = crypto.randomUUID();
      return database.insert(users).values({
        id,
        name: "Synthetic visitor",
        email: `${id}@guest.openjii.invalid`,
        isAnonymous: true,
      });
    }

    it("converts a Demo organization and updates a member's role without either waiting", async () => {
      const first = await demoWithMember();
      await whileHeld(
        (tx) => convert(tx, first.demo),
        (other) => updateRole(other, first.demo, first.member),
      );
      const second = await demoWithMember();
      await whileHeld(
        (tx) => updateRole(tx, second.demo, second.member),
        (other) => convert(other, second.demo),
      );
      expect(
        await db
          .select({ type: organizations.type })
          .from(organizations)
          .where(eq(organizations.id, second.demo)),
      ).toEqual([{ type: "university" }]);
    });

    it("creates a guest and saves a Demo's slug and type without either waiting", async () => {
      const { demo } = await demoWithMember();
      await whileHeld(
        (tx) => convert(tx, demo, `renamed-${demo}`),
        (other) => createGuestRow(other),
      );
      const { demo: second } = await demoWithMember();
      await whileHeld(
        (tx) => createGuestRow(tx),
        (other) => convert(other, second, `renamed-${second}`),
      );
      expect(
        await db
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, second)),
      ).toHaveLength(1);
    });
  });

  it("refuses re-entry without creating a second guest or replacing a researcher's session", async () => {
    const visitor = await guest();
    expect((await post("/sign-in/anonymous", {}, visitor.cookie)).status).toBe(400);
    const before = await db.select().from(users);
    const email = `researcher-${crypto.randomUUID()}@example.test`;
    const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
    const signIn = await post("/sign-in/email-otp", { email, otp });
    expect(signIn.status).toBe(200);
    const researcherCookie = cookies(signIn);
    const refused = await post("/sign-in/anonymous", {}, researcherCookie);
    expect(refused.status).toBe(403);
    expect(refused.headers.getSetCookie()).toHaveLength(0);
    expect(await db.select().from(users)).toHaveLength(before.length + 1);
    const active = await auth.api.getSession({
      headers: new Headers({ cookie: researcherCookie }),
    });
    expect(active?.user.email).toBe(email);
  });

  it("allows only a validated name change, not image, email, role, keys or linking", async () => {
    const visitor = await guest();
    for (const [input, expected] of [
      ["  Ada  ", "Ada"],
      ["   ", "Guest"],
      ["", "Guest"],
      ["Renamed", "Renamed"],
    ]) {
      expect((await post("/update-user", { name: input }, visitor.cookie)).status).toBe(200);
      const [renamed] = await db.select().from(users).where(eq(users.id, visitor.id));
      expect(renamed.name).toBe(expected);
    }
    for (const body of [
      { name: "x", image: "https://example.test/a.png" },
      { email: "real@example.test" },
      { role: "admin" },
    ]) {
      expect((await post("/update-user", body, visitor.cookie)).status).toBe(403);
    }
    expect((await post("/update-user", { name: "example.org" }, visitor.cookie)).status).toBe(400);
    const [stored] = await db.select().from(users).where(eq(users.id, visitor.id));
    expect(stored).toMatchObject({
      name: "Renamed",
      isAnonymous: true,
      role: "user",
      registered: false,
    });
  });

  it("refuses all email entry paths for reserved and authoritative guest addresses", async () => {
    const visitor = await guest();
    const address = `legacy-${crypto.randomUUID()}@example.test`;
    await db.update(users).set({ email: address }).where(eq(users.id, visitor.id));
    const before = await db.select().from(verifications);
    for (const email of [address, "synthetic@guest.openjii.invalid"]) {
      for (const path of [
        "/email-otp/send-verification-otp",
        "/send-verification-email",
        "/email-otp/request-email-change",
        "/organization/invite-member",
      ]) {
        const response = await post(path, { email, type: "sign-in", role: "member" });
        expect(response.status, path).toBe(403);
      }
    }
    expect(await db.select().from(verifications)).toEqual(before);
  });

  it("refuses email repair through the Nest-wired before hook before any user change", async () => {
    const visitor = await guest();
    const [before] = await db.select().from(users).where(eq(users.id, visitor.id));
    const victimEmail = `unclaimed-${crypto.randomUUID()}@example.test`;
    expect(
      (await post("/sign-in/email-otp", { email: victimEmail, otp: "invalid" }, visitor.cookie))
        .status,
    ).toBe(403);
    expect(auth.options.hooks).toBe(
      app.module.get<AuthService<typeof productionAuth>>(AuthService).instance.options.hooks,
    );
    expect(auth.options.hooks).toHaveProperty("before");
    expect(await db.select().from(users).where(eq(users.id, visitor.id))).toEqual([before]);
    const researcherEmail = `researcher-${crypto.randomUUID()}@example.test`;
    const otp = await auth.api.createVerificationOTP({
      body: { email: researcherEmail, type: "sign-in" },
    });
    const signedIn = await post("/sign-in/email-otp", { email: researcherEmail, otp });
    const [researcher] = await db.select().from(users).where(eq(users.email, researcherEmail));
    expect(
      (
        await post(
          "/sign-in/email-otp",
          { email: "reserved@guest.openjii.invalid", otp: "invalid" },
          cookies(signedIn),
        )
      ).status,
    ).toBe(403);
    expect(await db.select().from(users).where(eq(users.id, researcher.id))).toEqual([researcher]);
    const replacement = `verified-${crypto.randomUUID()}@example.test`;
    const replacementOtp = await auth.api.createVerificationOTP({
      body: { email: replacement, type: "sign-in" },
    });
    const repaired = await post(
      "/sign-in/email-otp",
      { email: replacement, otp: replacementOtp },
      cookies(signedIn),
    );
    expect(repaired.status).toBe(200);
    const repairedBody: unknown = await repaired.json();
    expect(repairedBody).toMatchObject({ user: { id: researcher.id, email: replacement } });
  });

  it("never deletes a guest through plugin deletion or any sign-in/callback matcher", async () => {
    await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const visitor = await guest();
    const before = {
      users: await db.select().from(users).where(eq(users.id, visitor.id)),
      sessions: await db.select().from(sessions).where(eq(sessions.userId, visitor.id)),
      members: await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, visitor.id)),
    };
    const existingEmail = `existing-${crypto.randomUUID()}@example.test`;
    const otp = await auth.api.createVerificationOTP({
      body: { email: existingEmail, type: "sign-in" },
    });
    expect(
      (await post("/sign-in/email-otp", { email: existingEmail, otp }, visitor.cookie)).status,
    ).toBe(403);
    const paths = [
      "/delete-anonymous-user",
      "/sign-in/email-otp",
      "/sign-in/social",
      "/sign-up/email",
      "/callback/github",
      "/oauth2/callback/orcid",
      "/email-otp/verify-email",
      "/passkey/verify-authentication",
      "/magic-link/verify",
      "/one-tap/callback",
      "/phone-number/verify",
      "/verify-email",
    ];
    for (const path of paths) {
      const response = await post(
        path,
        { email: "unrelated@example.test", otp: "000000", provider: "github" },
        visitor.cookie,
      );
      expect(response.status, path).toBeGreaterThanOrEqual(400);
    }
    expect(await db.select().from(users).where(eq(users.id, visitor.id))).toEqual(before.users);
    expect(await db.select().from(sessions).where(eq(sessions.userId, visitor.id))).toEqual(
      before.sessions,
    );
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, visitor.id)),
    ).toEqual(before.members);
  });

  it("does not renew a purged guest from the cached session cookie", async () => {
    const visitor = await guest();
    const { cookie } = await legacyCachedSession(visitor.cookie);
    await db.delete(users).where(eq(users.id, visitor.id));
    const rename = await post("/update-user", { name: "Must not renew" }, cookie);
    expect(rename.status).toBe(401);
    expect(
      rename.headers.getSetCookie().filter((value) => /session_data=[^;]/.test(value)),
    ).toEqual([]);
    const session = await auth.handler(new Request(`${base}/get-session`, { headers: { cookie } }));
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
    expect(session.headers.getSetCookie()).toEqual(
      expect.arrayContaining([expect.stringMatching(/session_data=;.*Max-Age=0/)]),
    );
    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).resolves.toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.userId, visitor.id))).toHaveLength(0);
  });

  it.each([0, 6000])(
    "expires guest identity caches with a %i-byte browser description",
    async (length) => {
      const visitor = await guest();
      if (length) {
        await db
          .update(sessions)
          .set({ userAgent: "x".repeat(length) })
          .where(eq(sessions.userId, visitor.id));
      }
      const response = await auth.handler(
        new Request(`${base}/get-session`, { headers: { cookie: visitor.cookie } }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual(
        expect.arrayContaining([expect.stringMatching(/session_data=;.*Max-Age=0/)]),
      );
      expect(
        response.headers
          .getSetCookie()
          .filter((value) => /session_data(?:\.\d+)?=[^;]/.test(value)),
      ).toEqual([]);
      await expect(
        auth.api.getSession({ headers: new Headers({ cookie: visitor.cookie }) }),
      ).resolves.toMatchObject({ user: { id: visitor.id, isAnonymous: true } });
    },
  );

  it("keeps the researcher identity cache unchanged", async () => {
    const email = `researcher-${crypto.randomUUID()}@example.test`;
    const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
    const signedIn = await post("/sign-in/email-otp", { email, otp });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.getSetCookie()).toEqual(
      expect.arrayContaining([expect.stringMatching(/session_data=[^;]/)]),
    );
  });

  it("does not cache guest identity after a name change", async () => {
    const visitor = await guest();
    const renamed = await post("/update-user", { name: "Renamed visitor" }, visitor.cookie);
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({ status: true });
    expect(renamed.headers.getSetCookie()).toEqual(
      expect.arrayContaining([expect.stringMatching(/session_data=;.*Max-Age=0/)]),
    );
    expect(
      renamed.headers.getSetCookie().filter((value) => /session_data(?:\.\d+)?=[^;]/.test(value)),
    ).toEqual([]);
  });

  it("refuses all guest writes through Nest with a still-valid cached cookie after purge", async () => {
    const owner = await app.createTestUser();
    const organizationId = await app.createOrganization(undefined, {
      type: "demo",
      visibility: "public",
    });
    const [experiment] = await db
      .insert(experiments)
      .values({
        name: "Synthetic cached-session example",
        createdBy: owner,
        organizationId,
        visibility: "public",
      })
      .returning();
    const macro = await app.createMacro({
      name: "Synthetic cached-session macro",
      createdBy: owner,
      organizationId,
      visibility: "public",
    });
    const visitor = await guest();
    const { cookie, legacy } = await legacyCachedSession(visitor.cookie);
    const nestAuth = app.module.get<AuthService<typeof productionAuth>>(AuthService).instance;
    let guardIdentity: string | undefined;
    vi.mocked(nestAuth.api.getSession).mockImplementation(async (input) => {
      const session = await auth.api.getSession({ headers: input?.headers ?? new Headers() });
      guardIdentity = session?.user.id ?? "no session";
      if (!session) return null;
      const identity = z
        .object({ isAnonymous: z.boolean(), banned: z.boolean().nullish() })
        .parse(session.user);
      return {
        ...session,
        user: { ...session.user, isAnonymous: identity.isAnonymous, banned: identity.banned },
      };
    });
    await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).resolves.toMatchObject({
      user: { id: visitor.id, isAnonymous: true },
    });
    const live = await app.get(`/api/v1/experiments/${experiment.id}`).set("Cookie", cookie);
    expect(guardIdentity).toBe(visitor.id);
    expect(live.status, JSON.stringify(live.body)).toBe(200);
    const signer = vi.spyOn(app.module.get(AwsAdapter), "getIotUploadUrl");
    const invoke = vi.spyOn(app.module.get<LambdaPort>(LAMBDA_PORT), "invokeLambda");
    await db
      .update(users)
      .set({ createdAt: new Date(Date.now() - 8 * 86_400_000) })
      .where(eq(users.id, visitor.id));
    const purged = await app.module.get(PurgeExpiredGuestsUseCase).execute();
    expect(purged.deleted).toBe(1);
    // This control proves the signed cache has not merely expired or become malformed.
    await expect(
      legacy.api.getSession({ headers: new Headers({ cookie }) }),
    ).resolves.toMatchObject({ user: { id: visitor.id, isAnonymous: true } });
    const writes = [
      {
        path: "/api/v1/iot/upload-url",
        classification: "demo-upload",
        body: { experimentId: experiment.id, contentLength: 100 },
      },
      {
        path: `/api/v1/macros/${macro.id}/execute`,
        classification: "demo-macro",
        body: { data: { value: 1 } },
      },
      {
        path: "/api/v1/visits",
        classification: "visit",
        body: { resourceType: "experiment", resourceId: experiment.id },
      },
    ];
    for (const { path, body } of [
      ...writes,
      { path: `/api/v1/experiments/${experiment.id}/data/uploads`, body: {} },
      { path: "/api/v1/experiments", body: { name: "Must not persist" } },
    ]) {
      expect((await app.post(path).set("Cookie", cookie).send(body)).status, path).toBe(401);
    }
    expect(
      (await app.get(`/api/v1/experiments/${experiment.id}`).set("Cookie", cookie)).status,
    ).toBe(401);
    expect((await app.get("/api/v1/experiments").set("Cookie", cookie)).status).toBe(401);
    expect(signer).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(
      await db.select().from(guestUsage).where(eq(guestUsage.userId, visitor.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(resourceVisits).where(eq(resourceVisits.userId, visitor.id)),
    ).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, visitor.id))).toHaveLength(0);
    const ended = await auth.handler(new Request(`${base}/get-session`, { headers: { cookie } }));
    expect(await ended.json()).toBeNull();
    expect(ended.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/session_token=;.*Max-Age=0/),
        expect.stringMatching(/session_data=;.*Max-Age=0/),
      ]),
    );
  });

  it("fails closed when the demo flag is off or unavailable", async () => {
    enabled.mockResolvedValue(false);
    expect((await post("/sign-in/anonymous")).status).toBe(403);
    expect(await db.select().from(users).where(eq(users.isAnonymous, true))).toHaveLength(0);
  });
});
