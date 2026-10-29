import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP } from "better-auth/plugins";

import { DISABLED_ADMIN_PATHS, openJiiAdmin } from "@repo/auth/admin";
import { hasPlatformRole, isPlatformAdmin } from "@repo/auth/platform-admin";
import {
  db,
  auditLogs,
  changePlatformRole,
  createSecondaryDatabase,
  eq,
  heldPlatformRoles,
  listPlatformRoleAssignments,
  listPlatformRoleHolders,
  PlatformRoleError,
  profiles,
  users,
} from "@repo/database";
import type { PlatformRoleChange } from "@repo/database";
import * as schema from "@repo/database/schema";

import { backendPidOf, waitUntilBlocked } from "../test/lock-wait";
import { TestHarness } from "../test/test-harness";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const auth = betterAuth({
  secret: "test-secret",
  baseURL: "http://localhost:3020",
  basePath: "/api/v1/auth",
  advanced: { database: { generateId: false } },
  user: { additionalFields: { registered: { type: "boolean", defaultValue: false } } },
  disabledPaths: DISABLED_ADMIN_PATHS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  plugins: [openJiiAdmin(), emailOTP({ sendVerificationOTP: () => Promise.resolve() })],
});

async function signIn() {
  const email = `role-${crypto.randomUUID()}@example.com`;
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });
  if (!otp) throw new Error("Missing OTP");
  const { headers, response } = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });
  await db.update(users).set({ registered: true }).where(eq(users.id, response.user.id));
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { id: response.user.id, cookie };
}

function call(path: string, cookie?: string, body?: unknown) {
  return auth.handler(
    new Request(`http://localhost:3020/api/v1/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("platform roles", () => {
  const app = TestHarness.App;
  let engineer: string;
  let researcher: string;
  const change = (overrides: Partial<PlatformRoleChange> = {}): PlatformRoleChange => ({
    action: "grant",
    role: "platform_admin",
    targetUserId: researcher,
    actorUserId: engineer,
    source: "command",
    ...overrides,
  });
  const roleOf = async (id: string) =>
    (await db.select({ role: users.role }).from(users).where(eq(users.id, id)))[0].role;

  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    engineer = await app.createTestUser({});
    researcher = await app.createTestUser({});
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("disables every admin endpoint the installed plugin serves", () => {
    const paths = Object.values(admin().endpoints).map((endpoint) => endpoint.path);
    expect([...DISABLED_ADMIN_PATHS].sort()).toEqual(paths.sort());
  });

  it("answers 404 on every admin route, even for a platform admin", async () => {
    const holder = await signIn();
    const ordinary = await signIn();
    await changePlatformRole(db, change({ targetUserId: holder.id }));
    expect(await isPlatformAdmin({ id: holder.id })).toBe(true);
    for (const path of DISABLED_ADMIN_PATHS) {
      for (const cookie of [holder.cookie, ordinary.cookie, undefined]) {
        expect((await call(path, cookie)).status, path).toBe(404);
        expect(
          (await call(path, cookie, { userId: ordinary.id, role: "platform_admin" })).status,
          path,
        ).toBe(404);
      }
    }
    expect(await roleOf(ordinary.id)).toBe("user");
  });

  it("grants and revokes with an audit row naming the engineer, effective on the next check", async () => {
    expect(await isPlatformAdmin({ id: researcher })).toBe(false);
    expect(
      await changePlatformRole(
        db,
        change({
          targetUserId: researcher.toUpperCase(),
          githubActor: "octocat",
          githubTriggeringActor: "hubot",
          githubRunId: "42",
          githubRunAttempt: "2",
        }),
      ),
    ).toEqual(["platform_admin"]);
    expect(await roleOf(researcher)).toBe("platform_admin");
    expect(await isPlatformAdmin({ id: researcher })).toBe(true);
    expect(await hasPlatformRole({ id: researcher }, "platform_admin")).toBe(true);

    expect(await changePlatformRole(db, change({ action: "revoke" }))).toEqual([]);
    expect(await roleOf(researcher)).toBe("user");
    expect(await isPlatformAdmin({ id: researcher })).toBe(false);

    const rows = await db.select().from(auditLogs).orderBy(auditLogs.timestamp);
    expect(rows.map((row) => [row.userId, row.action])).toEqual([
      [engineer, "platform_role.grant"],
      [engineer, "platform_role.revoke"],
    ]);
    expect(rows[0].details).toEqual({
      targetUserId: researcher,
      role: "platform_admin",
      source: "command",
      githubActor: "octocat",
      githubTriggeringActor: "hubot",
      githubRunId: "42",
      githubRunAttempt: "2",
    });
  });

  it("refuses no-ops, unknown roles and inactive accounts without changing anything", async () => {
    const unregistered = await app.createTestUser({ registered: false });
    const deleted = await app.createTestUser({ deletedAt: new Date() });
    const banned = await app.createTestUser({});
    await db.update(users).set({ banned: true }).where(eq(users.id, banned));
    await changePlatformRole(db, change());
    const auditCount = async () => (await db.select().from(auditLogs)).length;
    expect(await auditCount()).toBe(1);

    for (const refused of [
      change(),
      change({ action: "revoke", targetUserId: engineer }),
      change({ role: "owner" as PlatformRoleChange["role"] }),
      change({ targetUserId: "not-a-uuid" }),
      change({ targetUserId: crypto.randomUUID() }),
      change({ targetUserId: unregistered }),
      change({ targetUserId: deleted }),
      change({ targetUserId: banned }),
      change({ action: "revoke", targetUserId: deleted }),
      change({ actorUserId: unregistered }),
      change({ actorUserId: deleted }),
      change({ actorUserId: banned }),
    ]) {
      await expect(changePlatformRole(db, refused)).rejects.toBeInstanceOf(PlatformRoleError);
    }
    expect(await auditCount()).toBe(1);
    for (const id of [engineer, unregistered, deleted, banned]) {
      expect(await roleOf(id)).toBe("user");
    }
  });

  it("lets a revoke clear a role left on a deleted or banned account", async () => {
    const banned = await app.createTestUser({});
    await changePlatformRole(db, change());
    await changePlatformRole(db, change({ targetUserId: banned }));
    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.userId, researcher));
    await db.update(users).set({ banned: true }).where(eq(users.id, banned));

    expect(await listPlatformRoleHolders(db)).toEqual([]);
    const assignments = await listPlatformRoleAssignments(db);
    expect(Object.fromEntries(assignments.map(({ userId, active }) => [userId, active]))).toEqual({
      [researcher]: false,
      [banned]: false,
    });

    expect(await changePlatformRole(db, change({ action: "revoke" }))).toEqual([]);
    expect(
      await changePlatformRole(db, change({ action: "revoke", targetUserId: banned })),
    ).toEqual([]);
    expect(await listPlatformRoleAssignments(db)).toEqual([]);
    expect(await db.select().from(auditLogs)).toHaveLength(4);
  });

  it("never counts an API key, an anonymous session or a deleted account as a role holder", async () => {
    await changePlatformRole(db, change());
    expect(await isPlatformAdmin({ id: researcher }, new Headers({ "x-api-key": "k" }))).toBe(
      false,
    );
    expect(await isPlatformAdmin({ id: researcher, isAnonymous: true })).toBe(false);
    expect(await isPlatformAdmin(null)).toBe(false);

    await db
      .update(schema.profiles)
      .set({ deletedAt: new Date() })
      .where(eq(schema.profiles.userId, researcher));
    expect(await isPlatformAdmin({ id: researcher })).toBe(false);
  });

  it("records one grant when two runs grant the same role at once", async () => {
    const secondary = createSecondaryDatabase();
    try {
      const outcomes = await Promise.allSettled([
        changePlatformRole(db, change()),
        changePlatformRole(secondary.database, change()),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const refused = outcomes.find((outcome) => outcome.status === "rejected");
      expect(refused?.reason).toBeInstanceOf(PlatformRoleError);
      expect(await db.select().from(auditLogs)).toHaveLength(1);
    } finally {
      await secondary.close();
    }
  });

  it("refuses a grant to an account deleted while the grant waited for its lock", async () => {
    const holder = createSecondaryDatabase();
    const granter = createSecondaryDatabase();
    const locked = gate();
    const release = gate();
    try {
      const deletion = holder.database.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, researcher)).for("update");
        await tx
          .update(profiles)
          .set({ deletedAt: new Date() })
          .where(eq(profiles.userId, researcher));
        locked.resolve();
        await release.promise;
      });
      await locked.promise;
      const granterPid = await backendPidOf(granter.database);
      const grant = changePlatformRole(granter.database, change());
      await waitUntilBlocked(db, granterPid);
      release.resolve();
      await deletion;
      await expect(grant).rejects.toThrow("The target is not an active openJII account");
      expect(await roleOf(researcher)).toBe("user");
    } finally {
      release.resolve();
      await Promise.all([holder.close(), granter.close()]);
    }
  });

  it("reads held roles only from active accounts and tolerates spacing in the stored value", async () => {
    await db.update(users).set({ role: "user, platform_admin" }).where(eq(users.id, researcher));
    expect(await heldPlatformRoles(db, researcher)).toEqual(["platform_admin"]);
    await db.update(users).set({ banned: true }).where(eq(users.id, researcher));
    expect(await heldPlatformRoles(db, researcher)).toEqual([]);
    await db
      .update(users)
      .set({ banned: false, registered: false })
      .where(eq(users.id, researcher));
    expect(await heldPlatformRoles(db, researcher)).toEqual([]);
  });

  it("lists current holders with the date each role was last granted", async () => {
    const other = await app.createTestUser({});
    await changePlatformRole(db, change());
    await changePlatformRole(db, change({ targetUserId: other }));
    await changePlatformRole(db, change({ targetUserId: other, action: "revoke" }));

    const holders = await listPlatformRoleHolders(db);
    expect(holders).toHaveLength(1);
    expect(holders[0]).toMatchObject({ userId: researcher, roles: ["platform_admin"] });
    expect(holders[0].grantedAt.platform_admin).toBeInstanceOf(Date);
  });

  it("dates a role regranted after a revoke from the latest grant", async () => {
    await changePlatformRole(db, change());
    await changePlatformRole(db, change({ action: "revoke" }));
    await changePlatformRole(db, change());
    const grants = await db
      .select({ at: auditLogs.timestamp })
      .from(auditLogs)
      .where(eq(auditLogs.action, "platform_role.grant"))
      .orderBy(auditLogs.timestamp);

    const [holder] = await listPlatformRoleHolders(db);
    expect(holder.grantedAt.platform_admin).toEqual(grants[1].at);
  });
});
