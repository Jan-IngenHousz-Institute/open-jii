import { betterAuth } from "better-auth";
import type { BetterAuthPlugin, DBAdapter } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP } from "better-auth/plugins";
import { z } from "zod";

import { ALLOWED_ADMIN_PATHS, DISABLED_ADMIN_PATHS, openJiiAdmin } from "@repo/auth/admin";
import { openJiiOrganization } from "@repo/auth/organization";
import { configuredAdminUserIds, isPlatformAdmin } from "@repo/auth/platform-admin";
import {
  db,
  and,
  createSecondaryDatabase,
  organizationOwnsPrivateResources,
  eq,
  experiments,
  macros,
  organizationMembers,
  organizations,
  protocols,
  profiles,
  users,
  workbooks,
} from "@repo/database";
import * as schema from "@repo/database/schema";

import { TestHarness } from "../test/test-harness";

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
      openJiiAdmin(configuredAdminUserIds),
      emailOTP({ sendVerificationOTP: () => Promise.resolve() }),
      openJiiOrganization(configuredAdminUserIds),
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
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    configuredAdminUserIds.length = 0;
    auditLog.mockClear();
    beforeOrganizationWrite = undefined;
  });
  afterEach(() => app.afterEach());
  afterAll(async () => {
    configuredAdminUserIds.length = 0;
    await app.teardown();
  });

  it("classifies every installed admin endpoint, with no new endpoint allowed implicitly", () => {
    const paths = Object.values(admin().endpoints)
      .map((endpoint) => endpoint.path)
      .sort();
    expect([...ALLOWED_ADMIN_PATHS, ...DISABLED_ADMIN_PATHS].sort()).toEqual(paths);
  });

  it("checks current admin roles and disables the email-returning list endpoint for every caller", async () => {
    const configured = await signIn("configured");
    const ordinary = await signIn("ordinary");
    configuredAdminUserIds.push(configured.id);
    expect(await isPlatformAdmin({ id: configured.id })).toBe(true);
    expect((await call("/admin/list-users", configured)).status).toBe(404);
    expect((await call("/admin/list-users", ordinary)).status).toBe(404);
    expect((await call("/admin/list-users")).status).toBe(404);
    expect((await call("/admin/list-users", configured, undefined, true)).status).toBe(404);
    expect(await isPlatformAdmin({ id: configured.id, isAnonymous: true })).toBe(false);
    expect(await isPlatformAdmin({ id: configured.id }, new Headers({ "x-api-key": "test" }))).toBe(
      false,
    );
  });

  it("denies every account takeover, impersonation and unrelated admin route for both admin sources", async () => {
    const configured = await signIn("configured");
    const appointed = await signIn("appointed");
    configuredAdminUserIds.push(configured.id);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, appointed.id));
    for (const signed of [configured, appointed]) {
      for (const path of DISABLED_ADMIN_PATHS) {
        expect((await call(path, signed, { userId: configured.id })).status, path).toBe(404);
        expect((await call(path, signed)).status, path).toBe(404);
      }
    }
  });

  it("appoints/removes with a stored date and email-free logs, refusing self/configured/arbitrary roles", async () => {
    const configured = await signIn("configured");
    const target = await signIn("target");
    configuredAdminUserIds.push(configured.id);
    expect(
      (
        await call("/admin/set-role", configured, {
          userId: target.id.toUpperCase(),
          role: "admin",
        })
      ).status,
    ).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row.adminGrantedAt).toBeInstanceOf(Date);
    expect(await isPlatformAdmin({ id: target.id })).toBe(true);
    expect(
      (await call("/admin/set-role", target, { userId: target.id, role: "user" })).status,
    ).toBe(403);
    expect(
      (await call("/admin/set-role", target, { userId: configured.id, role: "user" })).status,
    ).toBe(403);
    for (const role of ["owner", ["admin"], "user,admin"])
      expect((await call("/admin/set-role", configured, { userId: target.id, role })).status).toBe(
        400,
      );
    expect(
      (await call("/admin/set-role", configured, { userId: target.id, role: "user" })).status,
    ).toBe(200);
    const events = auditLog.mock.calls.filter((args) =>
      JSON.stringify(args).includes("Platform admin role changed"),
    );
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).toContain(configured.id);
    expect(JSON.stringify(events)).toContain(target.id);
    expect(JSON.stringify(events)).toContain("timestamp");
    expect(JSON.stringify(events)).not.toContain("@example.com");
    expect(await isPlatformAdmin({ id: target.id })).toBe(false);
  });

  it("returns only id and role and refuses both no-op changes without an audit event", async () => {
    const configured = await signIn("configured");
    const target = await signIn("target");
    configuredAdminUserIds.push(configured.id);
    const roleEvents = () =>
      auditLog.mock.calls.filter((args) =>
        JSON.stringify(args).includes("Platform admin role changed"),
      );
    for (const [role, expectedStatus, expectedEvents] of [
      ["user", 400, 0],
      ["admin", 200, 1],
      ["admin", 400, 1],
      ["user", 200, 2],
    ] as const) {
      const response = await call("/admin/set-role", configured, { userId: target.id, role });
      expect(response.status).toBe(expectedStatus);
      const body = await response.json();
      if (expectedStatus === 200) {
        expect(body).toEqual({ user: { id: target.id, role } });
      } else {
        expect(body).toMatchObject({ message: "The researcher already has this role" });
        expect(body).not.toHaveProperty("user");
      }
      expect(JSON.stringify(body)).not.toContain(target.email);
      expect(JSON.stringify(body)).not.toContain('"email"');
      expect(roleEvents()).toHaveLength(expectedEvents);
    }
    const forbidden = await call("/admin/set-role", configured, {
      userId: configured.id,
      role: "admin",
    });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).not.toHaveProperty("user");
    expect(roleEvents()).toHaveLength(2);
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, target.id));
    expect(row.role).toBe("user");
  });

  it.each(["uppercase", "mixed case"])(
    "refuses %s self and configured admin UUIDs",
    async (casing) => {
      const configured = await signIn("configured");
      const appointed = await signIn("appointed");
      configuredAdminUserIds.push(configured.id);
      await db.update(users).set({ role: "admin" }).where(eq(users.id, appointed.id));
      const variant = (id: string) =>
        casing === "uppercase"
          ? id.toUpperCase()
          : id.replace(/[a-f]/g, (letter, index: number) =>
              index % 2 === 0 ? letter.toUpperCase() : letter,
            );
      for (const [id, role] of [
        [appointed.id, "user"],
        [configured.id, "admin"],
        [configured.id, "user"],
      ]) {
        expect(
          (await call("/admin/set-role", appointed, { userId: variant(id), role })).status,
        ).toBe(403);
      }
      const rows = await db.select({ id: users.id, role: users.role }).from(users);
      expect(rows).toEqual(
        expect.arrayContaining([
          { id: configured.id, role: "user" },
          { id: appointed.id, role: "admin" },
        ]),
      );
      expect(
        auditLog.mock.calls.filter((args) =>
          JSON.stringify(args).includes("Platform admin role changed"),
        ),
      ).toHaveLength(0);
    },
  );

  it("refuses deleted accounts as administrators and appointment targets", async () => {
    const configured = await signIn("configured");
    const deleted = await signIn("deleted");
    const active = await signIn("active");
    configuredAdminUserIds.push(configured.id);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, deleted.id));
    await db.insert(profiles).values({
      userId: deleted.id,
      firstName: "Deleted",
      lastName: "User",
      deletedAt: new Date(),
    });
    expect(await isPlatformAdmin({ id: deleted.id })).toBe(false);
    expect(
      (await call("/admin/set-role", deleted, { userId: active.id, role: "admin" })).status,
    ).toBe(403);
    expect(
      (await call("/admin/set-role", configured, { userId: deleted.id, role: "admin" })).status,
    ).toBe(400);
  });

  it("invalidates stale admin cookies in Demo create and update hooks", async () => {
    const signed = await signIn("appointed");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, signed.id));
    const response = await createOrg(signed, { type: "demo" });
    expect(response.status).toBe(200);
    const org = await organizationResponse(response);
    const cached = await call("/get-session", signed);
    const cacheCookies = cached.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const stale = { ...signed, cookie: `${signed.cookie}; ${cacheCookies}` };
    await db.update(users).set({ role: "user" }).where(eq(users.id, signed.id));
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
    configuredAdminUserIds.push(signed.id);
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
      configuredAdminUserIds.push(signed.id);
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
        competing = Promise.resolve(order === "resource first" ? convert(db) : createPrivate(db));
        const outcome = competing.then(
          () => "completed",
          () => "rejected",
        );
        expect(
          await Promise.race([
            outcome,
            new Promise<string>((resolve) => setTimeout(() => resolve("blocked"), 100)),
          ]),
        ).toBe("blocked");
        release.resolve();
        await holding;
        await expect(competing).rejects.toThrow();
        const invalid = await db
          .select({ id: workbooks.id })
          .from(workbooks)
          .innerJoin(organizations, eq(organizations.id, workbooks.organizationId))
          .where(and(eq(organizations.type, "demo"), eq(workbooks.visibility, "private")));
        expect(invalid).toHaveLength(0);
      } finally {
        release.resolve();
        await Promise.allSettled([holding, competing]);
        await secondary.close();
      }
    },
  );

  it("does not let an ordinary owner overwrite a concurrently converted Demo type", async () => {
    const admin = await signIn("configured");
    const owner = await signIn("ordinary-owner");
    configuredAdminUserIds.push(admin.id);
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
    configuredAdminUserIds.push(admin.id);
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
    configuredAdminUserIds.push(owner.id);
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
