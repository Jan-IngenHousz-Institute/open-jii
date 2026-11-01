import { betterAuth } from "better-auth";
import type { BetterAuthPlugin, DBAdapter } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

import { DISABLED_ADMIN_PATHS, openJiiAdmin } from "@repo/auth/admin";
import { openJiiOrganization } from "@repo/auth/organization";
import {
  db,
  and,
  changePlatformRole,
  createSecondaryDatabase,
  ensurePersonalOrganization,
  organizationOwnsPrivateResources,
  eq,
  experiments,
  macros,
  organizationMembers,
  organizations,
  protocols,
  sql,
  users,
  workbooks,
} from "@repo/database";
import * as schema from "@repo/database/schema";

import { backendPidOf, waitUntilBlocked } from "../test/lock-wait";
import { TestHarness } from "../test/test-harness";

const DEMO_MIGRATION = resolve(
  __dirname,
  "../../../../packages/database/postgres/migrations/0063_demo_public_invariants.sql",
);

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const auditLog = vi.fn();
let beforeOrganizationWrite:
  | ((input: Parameters<DBAdapter["update"]>[0]) => Promise<void>)
  | undefined;
const pauseOrganizationWrite: BetterAuthPlugin = {
  id: "test-organization-write-barrier",
  init(context) {
    const adapter = context.adapter;
    return {
      context: {
        adapter: {
          ...adapter,
          async update<T>(input: Parameters<DBAdapter["update"]>[0]) {
            if (input.model === "organization") await beforeOrganizationWrite?.(input);
            return adapter.update<T>(input);
          },
        },
      },
    };
  },
};
const makeAuth = (database = db) =>
  betterAuth({
    secret: "test-secret",
    baseURL: "http://localhost:3020",
    basePath: "/api/v1/auth",
    advanced: { database: { generateId: false } },
    session: { cookieCache: { enabled: true, maxAge: 86400 } },
    user: { additionalFields: { registered: { type: "boolean", defaultValue: false } } },
    logger: { level: "info", log: auditLog },
    disabledPaths: DISABLED_ADMIN_PATHS,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        organization: schema.organizations,
        member: schema.organizationMembers,
        invitation: schema.organizationInvitations,
        team: schema.teams,
        teamMember: schema.teamMembers,
      },
    }),
    plugins: [
      openJiiAdmin(),
      emailOTP({ sendVerificationOTP: () => Promise.resolve() }),
      openJiiOrganization(),
      pauseOrganizationWrite,
    ],
  });
const auth = makeAuth();

async function signIn(name: string) {
  const email = `${name}-${crypto.randomUUID()}@example.com`;
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
  return { id: response.user.id, email, cookie };
}

async function organizationResponse(response: Response) {
  return z
    .object({ id: z.string().uuid(), visibility: z.enum(["public", "private"]) })
    .parse(await response.json());
}

type Signed = Awaited<ReturnType<typeof signIn>>;
async function call(
  path: string,
  signed?: Signed,
  body?: unknown,
  apiKey = false,
  instance = auth,
) {
  return instance.handler(
    new Request(`http://localhost:3020/api/v1/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(signed ? { cookie: signed.cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(apiKey ? { "x-api-key": "test-key" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function createOrg(signed: Signed, data: Record<string, unknown> = {}) {
  return call("/organization/create", signed, {
    name: "Test organization",
    slug: `org-${crypto.randomUUID()}`,
    ...data,
  });
}

describe("platform admin and Demo security through Better Auth", () => {
  const app = TestHarness.App;
  let engineer: string;
  const grantPlatformAdmin = (targetUserId: string, action: "grant" | "revoke" = "grant") =>
    changePlatformRole(db, {
      action,
      role: "platform_admin",
      targetUserId,
      actorUserId: engineer,
      source: "command",
    });
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    engineer = await app.createTestUser();
    auditLog.mockClear();
    beforeOrganizationWrite = undefined;
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("invalidates stale admin cookies in Demo create and update hooks", async () => {
    const signed = await signIn("appointed");
    await grantPlatformAdmin(signed.id);
    const response = await createOrg(signed, { type: "demo" });
    expect(response.status).toBe(200);
    const org = await organizationResponse(response);
    // Refresh the cookie cache from the database, so it now carries the granted role.
    const refreshed = await call("/get-session?disableCookieCache=true", signed);
    const cookies = new Map(
      [
        ...signed.cookie.split("; "),
        ...refreshed.headers.getSetCookie().map((c) => c.split(";")[0]),
      ]
        .filter(Boolean)
        .map((pair) => [pair.slice(0, pair.indexOf("=")), pair] as const),
    );
    expect(refreshed.headers.getSetCookie()).not.toHaveLength(0);
    const stale = { ...signed, cookie: [...cookies.values()].join("; ") };
    const sessionRole = async () =>
      z
        .object({ user: z.object({ role: z.string() }) })
        .parse(await (await call("/get-session", stale)).json()).user.role;
    expect(await sessionRole()).toBe("platform_admin");

    await grantPlatformAdmin(signed.id, "revoke");
    // The cached session still claims the role; the hooks must not trust it.
    expect(await sessionRole()).toBe("platform_admin");
    expect((await createOrg(stale, { type: "demo" })).status).toBe(403);
    expect(
      (
        await call("/organization/update", stale, {
          organizationId: org.id,
          data: { type: "university" },
        })
      ).status,
    ).toBe(403);
  });

  it("enforces Demo create/update, public visibility, partial edits and personal workspace guards", async () => {
    const signed = await signIn("configured");
    await grantPlatformAdmin(signed.id);
    const ordinary = await signIn("ordinary");
    expect((await createOrg(ordinary, { type: "demo" })).status).toBe(403);
    expect((await createOrg(signed, { type: "demo", visibility: "private" })).status).toBe(400);
    expect((await createOrg(signed, { type: "demo", slug: "personal-forged" })).status).toBe(400);
    const created = await createOrg(signed, { type: "demo" });
    expect(created.status).toBe(200);
    const org = await organizationResponse(created);
    expect(org.visibility).toBe("public");
    expect(
      (
        await call("/organization/update", signed, {
          organizationId: org.id,
          data: { visibility: "private" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("/organization/update", signed, {
          organizationId: org.id,
          data: { name: "New name" },
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("/organization/update", signed, { organizationId: org.id, data: { type: null } }))
        .status,
    ).toBe(200);
    const [stored] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(stored.type).toBeNull();
    expect(stored.visibility).toBe("public");
  });

  it.each(["experiment", "workbook", "protocol", "macro"] as const)(
    "refuses conversion and private ownership writes for %s",
    async (kind) => {
      const signed = await signIn("configured");
      await grantPlatformAdmin(signed.id);
      const org = await organizationResponse(await createOrg(signed));
      const create = {
        experiment: () =>
          app.createExperiment({
            name: "Private",
            userId: signed.id,
            organizationId: org.id,
            visibility: "private",
          }),
        workbook: () =>
          app.createWorkbook({
            name: "Private",
            createdBy: signed.id,
            organizationId: org.id,
            visibility: "private",
          }),
        protocol: () =>
          app.createProtocol({
            name: "Private",
            createdBy: signed.id,
            organizationId: org.id,
            visibility: "private",
          }),
        macro: () =>
          app.createMacro({
            name: "Private",
            createdBy: signed.id,
            organizationId: org.id,
            visibility: "private",
          }),
      };
      const resource = await create[kind]();
      const id = "experiment" in resource ? resource.experiment.id : resource.id;
      expect(
        (
          await call("/organization/update", signed, {
            organizationId: org.id,
            data: { type: "demo" },
          })
        ).status,
      ).toBe(400);
      const table = {
        experiment: experiments,
        workbook: workbooks,
        protocol: protocols,
        macro: macros,
      }[kind];
      await db.update(table).set({ visibility: "public" }).where(eq(table.id, id));
      expect(
        (
          await call("/organization/update", signed, {
            organizationId: org.id,
            data: { type: "demo" },
          })
        ).status,
      ).toBe(200);
      const [stored] = await db.select().from(organizations).where(eq(organizations.id, org.id));
      expect(stored.visibility).toBe("public");
      await expect(
        db.update(table).set({ visibility: "private" }).where(eq(table.id, id)),
      ).rejects.toThrow();
      const invalid = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.type, "demo"), eq(organizations.visibility, "private")));
      expect(invalid).toHaveLength(0);
    },
  );
  it.each(["resource first", "conversion first"])(
    "serializes concurrent writes: %s",
    async (order) => {
      const userId = await app.createTestUser();
      const organizationId = await app.createOrganization();
      const secondary = createSecondaryDatabase();
      const contender = createSecondaryDatabase();
      const held = gate();
      const release = gate();
      const createPrivate = (
        database: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
      ) =>
        database.insert(workbooks).values({
          name: "Private concurrent work",
          createdBy: userId,
          organizationId,
          visibility: "private",
        });
      const convert = (database: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]) =>
        database
          .update(organizations)
          .set({ type: "demo", visibility: "public" })
          .where(eq(organizations.id, organizationId));
      let holding: Promise<unknown> | undefined;
      let competing: Promise<unknown> | undefined;
      try {
        holding = secondary.database.transaction(async (tx) => {
          await (order === "resource first" ? createPrivate(tx) : convert(tx));
          held.resolve();
          await release.promise;
        });
        await held.promise;
        const contenderPid = await backendPidOf(contender.database);
        competing = Promise.resolve(
          order === "resource first"
            ? convert(contender.database)
            : createPrivate(contender.database),
        );
        competing.catch(() => undefined);
        await waitUntilBlocked(db, contenderPid);
        release.resolve();
        await holding;
        await expect(competing).rejects.toMatchObject({ cause: { code: "23514" } });
        const invalid = await db
          .select({ id: workbooks.id })
          .from(workbooks)
          .innerJoin(organizations, eq(organizations.id, workbooks.organizationId))
          .where(and(eq(organizations.type, "demo"), eq(workbooks.visibility, "private")));
        expect(invalid).toHaveLength(0);
      } finally {
        release.resolve();
        await Promise.allSettled([holding, competing]);
        await Promise.all([secondary.close(), contender.close()]);
      }
    },
  );

  it("refuses to migrate over a Demo organization that already breaks the rules", async () => {
    const guard = readFileSync(DEMO_MIGRATION, "utf-8")
      .split("--> statement-breakpoint")
      .find((statement) => statement.includes("DO $$"));
    if (!guard) throw new Error("0063 lost its pre-check");
    const userId = await app.createTestUser();
    const organizationId = await app.createOrganization();
    await db
      .update(organizations)
      .set({ type: "demo", visibility: "public" })
      .where(eq(organizations.id, organizationId));
    await db.execute(sql.raw(guard));

    // Rows written before 0063, which its triggers never checked.
    await db.transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE workbooks DISABLE TRIGGER demo_workbook_public`);
      await tx.insert(workbooks).values({
        name: "Older private work",
        createdBy: userId,
        organizationId,
        visibility: "private",
      });
      await tx.execute(sql`ALTER TABLE workbooks ENABLE TRIGGER demo_workbook_public`);
    });
    await expect(db.execute(sql.raw(guard))).rejects.toMatchObject({ cause: { code: "23514" } });

    await db
      .update(workbooks)
      .set({ visibility: "public" })
      .where(eq(workbooks.organizationId, organizationId));
    await db.transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE organizations DISABLE TRIGGER demo_organization_public`);
      await tx
        .update(organizations)
        .set({ visibility: "private" })
        .where(eq(organizations.id, organizationId));
      await tx.execute(sql`ALTER TABLE organizations ENABLE TRIGGER demo_organization_public`);
    });
    await expect(db.execute(sql.raw(guard))).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  // The two schedules review found deadlocking under the old per-organization advisory lock.
  // Both transactions must now finish.
  it("lets a resource create and a transfer into the same organization run side by side", async () => {
    const userId = await app.createTestUser();
    const organizationId = await app.createOrganization();
    const elsewhere = await app.createOrganization();
    const [membership] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId, role: "owner" })
      .returning({ id: organizationMembers.id });
    const [moving] = await db
      .insert(workbooks)
      .values({
        name: "Moving work",
        createdBy: userId,
        organizationId: elsewhere,
        visibility: "private",
      })
      .returning({ id: workbooks.id });
    const secondary = createSecondaryDatabase();
    const ownersLocked = gate();
    const created = gate();
    try {
      // A transfer locks the destination's owner memberships, then moves the resource.
      const transfer = secondary.database.transaction(async (tx) => {
        await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(eq(organizationMembers.id, membership.id))
          .for("update");
        ownersLocked.resolve();
        await created.promise;
        await tx.update(workbooks).set({ organizationId }).where(eq(workbooks.id, moving.id));
      });
      await ownersLocked.promise;
      // A create inserts the resource, then locks the same memberships to seed its owner.
      const create = db.transaction(async (tx) => {
        await tx
          .insert(workbooks)
          .values({ name: "New work", createdBy: userId, organizationId, visibility: "private" });
        created.resolve();
        await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(eq(organizationMembers.id, membership.id))
          .for("update");
      });
      const outcomes = await Promise.allSettled([transfer, create]);
      expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    } finally {
      created.resolve();
      await secondary.close();
    }
  });

  it("lets account deletion rename a personal workspace while a resource is created in it", async () => {
    const userId = await app.createTestUser();
    const workspaceId = await ensurePersonalOrganization(db, { id: userId, name: "Leaving" });
    const secondary = createSecondaryDatabase();
    const creator = createSecondaryDatabase();
    const userLocked = gate();
    const insertWaiting = gate();
    try {
      // Account deletion locks the user, then scrubs the personal workspace's name.
      const deletion = secondary.database.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
        userLocked.resolve();
        await insertWaiting.promise;
        await tx
          .update(organizations)
          .set({ name: "Deleted workspace" })
          .where(eq(organizations.id, workspaceId));
      });
      await userLocked.promise;
      // The insert's foreign key check on created_by waits for the deletion's user lock.
      const creatorPid = await backendPidOf(creator.database);
      const create = Promise.resolve(
        creator.database.insert(workbooks).values({
          name: "Late work",
          createdBy: userId,
          organizationId: workspaceId,
          visibility: "private",
        }),
      );
      await waitUntilBlocked(db, creatorPid);
      insertWaiting.resolve();
      const outcomes = await Promise.allSettled([deletion, create]);
      expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    } finally {
      insertWaiting.resolve();
      await Promise.all([secondary.close(), creator.close()]);
    }
  });

  it("does not let an ordinary owner overwrite a concurrently converted Demo type", async () => {
    const admin = await signIn("configured");
    const owner = await signIn("ordinary-owner");
    await grantPlatformAdmin(admin.id);
    const org = await organizationResponse(await createOrg(owner, { type: "university" }));
    await db
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId: admin.id, role: "owner" });
    const reachedWrite = gate();
    const release = gate();
    beforeOrganizationWrite = async (input) => {
      if (input.update.name !== "Ordinary raced update") return;
      reachedWrite.resolve();
      await release.promise;
    };
    const secondary = createSecondaryDatabase();
    let ordinary: Promise<Response> | undefined;
    try {
      ordinary = call("/organization/update", owner, {
        organizationId: org.id,
        data: { name: "Ordinary raced update", type: "university", visibility: "private" },
      });
      await reachedWrite.promise;
      const converted = await call(
        "/organization/update",
        admin,
        { organizationId: org.id, data: { type: "demo" } },
        false,
        makeAuth(secondary.database),
      );
      expect(converted.status, await converted.text()).toBe(200);
      release.resolve();
      expect((await ordinary).status).toBe(409);
      const [stored] = await db.select().from(organizations).where(eq(organizations.id, org.id));
      expect(stored).toMatchObject({ type: "demo", visibility: "public" });
      expect(stored.name).not.toBe("Ordinary raced update");
    } finally {
      release.resolve();
      await ordinary;
      await secondary.close();
    }
  });

  it("answers a raced private-resource conversion with a safe actionable 400", async () => {
    const admin = await signIn("configured");
    await grantPlatformAdmin(admin.id);
    const org = await organizationResponse(await createOrg(admin));
    const reachedWrite = gate();
    const release = gate();
    beforeOrganizationWrite = async () => {
      reachedWrite.resolve();
      await release.promise;
    };
    const secondary = createSecondaryDatabase();
    let converting: Promise<Response> | undefined;
    try {
      converting = call("/organization/update", admin, {
        organizationId: org.id,
        data: { type: "demo" },
      });
      await reachedWrite.promise;
      await secondary.database.insert(workbooks).values({
        name: "Raced private workbook",
        createdBy: admin.id,
        organizationId: org.id,
        visibility: "private",
      });
      release.resolve();
      const response = await converting;
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "DEMO_PRIVATE_RESOURCES",
        message: "Publish every experiment, workbook, protocol and macro before choosing Demo",
      });
      const [stored] = await db.select().from(organizations).where(eq(organizations.id, org.id));
      expect(stored.type).not.toBe("demo");
    } finally {
      release.resolve();
      await converting;
      await secondary.close();
    }
  });

  it.each(["experiment", "workbook", "protocol", "macro"] as const)(
    "finds only this organization's private %s resources through the shared query",
    async (kind) => {
      const userId = await app.createTestUser();
      const organizationId = await app.createOrganization();
      const otherId = await app.createOrganization();
      const table = {
        experiment: experiments,
        workbook: workbooks,
        protocol: protocols,
        macro: macros,
      }[kind];
      const create = {
        experiment: () =>
          app.createExperiment({
            name: "Visibility query resource",
            userId,
            organizationId: otherId,
            visibility: "private",
          }),
        workbook: () =>
          app.createWorkbook({
            name: "Visibility query resource",
            createdBy: userId,
            organizationId: otherId,
            visibility: "private",
          }),
        protocol: () =>
          app.createProtocol({
            name: "Visibility query resource",
            createdBy: userId,
            organizationId: otherId,
            visibility: "private",
          }),
        macro: () =>
          app.createMacro({
            name: "Visibility query resource",
            createdBy: userId,
            organizationId: otherId,
            visibility: "private",
          }),
      };
      await create[kind]();
      expect(await organizationOwnsPrivateResources(db, organizationId)).toBe(false);
      await db.update(table).set({ organizationId }).where(eq(table.organizationId, otherId));
      expect(await organizationOwnsPrivateResources(db, organizationId)).toBe(true);
      await db
        .update(table)
        .set({ visibility: "public" })
        .where(eq(table.organizationId, organizationId));
      expect(await organizationOwnsPrivateResources(db, organizationId)).toBe(false);
    },
  );

  it("admits more than 100 Demo members through add and invitation acceptance", async () => {
    const owner = await signIn("configured");
    await grantPlatformAdmin(owner.id);
    const org = await organizationResponse(await createOrg(owner, { type: "demo" }));
    const filler = await db
      .insert(users)
      .values(
        Array.from({ length: 99 }, (_, index) => ({
          name: `Member ${index}`,
          email: `${crypto.randomUUID()}@example.com`,
        })),
      )
      .returning({ id: users.id });
    await db
      .insert(organizationMembers)
      .values(filler.map((user) => ({ organizationId: org.id, userId: user.id, role: "member" })));
    const additional = await signIn("additional");
    const added = await auth.api.addMember({
      headers: new Headers({ cookie: owner.cookie }),
      body: { organizationId: org.id, userId: additional.id, role: "member" },
    });
    expect(added.userId).toBe(additional.id);
    const invited = await signIn("invited");
    const invitation = await auth.api.createInvitation({
      headers: new Headers({ cookie: owner.cookie }),
      body: { organizationId: org.id, email: invited.email, role: "member" },
    });
    await auth.api.acceptInvitation({
      headers: new Headers({ cookie: invited.cookie }),
      body: { invitationId: invitation.id },
    });
    const members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id));
    expect(members).toHaveLength(102);
  });
});
