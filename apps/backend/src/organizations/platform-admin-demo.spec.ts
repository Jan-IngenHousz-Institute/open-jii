import { betterAuth } from "better-auth";
import type { BetterAuthPlugin, DBAdapter } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { z } from "zod";

import { DISABLED_ADMIN_PATHS, openJiiAdmin } from "@repo/auth/admin";
import { openJiiOrganization } from "@repo/auth/organization";
import {
  db,
  and,
  changePlatformRole,
  createSecondaryDatabase,
  organizationOwnsPrivateResources,
  eq,
  experiments,
  macros,
  organizationMembers,
  organizations,
  protocols,
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
    "refuses conversion while the organization owns a private %s",
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
      const invalid = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.type, "demo"), eq(organizations.visibility, "private")));
      expect(invalid).toHaveLength(0);
    },
  );
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
});
