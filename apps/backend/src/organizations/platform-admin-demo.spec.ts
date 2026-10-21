import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP } from "better-auth/plugins";
import { z } from "zod";

import { ALLOWED_ADMIN_PATHS, DISABLED_ADMIN_PATHS, openJiiAdmin } from "@repo/auth/admin";
import { openJiiOrganization } from "@repo/auth/organization";
import { configuredAdminUserIds, isPlatformAdmin } from "@repo/auth/platform-admin";
import {
  db,
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

import { TestHarness } from "../test/test-harness";

const auditLog = vi.fn();
const auth = betterAuth({
  secret: "test-secret",
  baseURL: "http://localhost:3020",
  basePath: "/api/v1/auth",
  advanced: { database: { generateId: false } },
  session: { cookieCache: { enabled: true, maxAge: 86400 } },
  user: { additionalFields: { registered: { type: "boolean", defaultValue: false } } },
  logger: { level: "info", log: auditLog },
  disabledPaths: DISABLED_ADMIN_PATHS,
  database: drizzleAdapter(db, {
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
  ],
});

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
async function call(path: string, signed?: Signed, body?: unknown, apiKey = false) {
  return auth.handler(
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

  it("lists configured role=user admins and refuses ordinary callers, anonymous candidates and API keys", async () => {
    const configured = await signIn("configured");
    const ordinary = await signIn("ordinary");
    configuredAdminUserIds.push(configured.id);
    expect(await isPlatformAdmin({ id: configured.id })).toBe(true);
    const debugResponse = await call("/admin/list-users", configured);
    expect(debugResponse.status, await debugResponse.text()).toBe(200);
    expect((await call("/admin/list-users", ordinary)).status).toBe(403);
    expect((await call("/admin/list-users")).status).toBe(403);
    expect((await call("/admin/list-users", configured, undefined, true)).status).toBe(403);
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
    expect((await call("/admin/list-users", target)).status).toBe(200);
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
    expect((await call("/admin/list-users", target)).status).toBe(403);
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
      const invalid = await db.execute(
        sql`select id from organizations where type::text = 'demo' and visibility::text = 'private'`,
      );
      expect(invalid).toHaveLength(0);
    },
  );
  it("serializes conversion against concurrent private resource creation", async () => {
    const userId = await app.createTestUser();
    for (let iteration = 0; iteration < 5; iteration++) {
      const organizationId = await app.createOrganization();
      const outcomes = await Promise.allSettled([
        db.insert(workbooks).values({
          name: "Private concurrent work",
          createdBy: userId,
          organizationId,
          visibility: "private",
        }),
        db
          .update(organizations)
          .set({ type: "demo", visibility: "public" })
          .where(eq(organizations.id, organizationId)),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      const invalid = await db.execute(
        sql`select w.id from workbooks w join organizations o on o.id = w.organization_id where o.type::text = 'demo' and w.visibility::text <> 'public'`,
      );
      expect(invalid).toHaveLength(0);
    }
  });

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
