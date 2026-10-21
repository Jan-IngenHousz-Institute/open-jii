import { betterAuth } from "better-auth";
import { z } from "zod";

import { openJiiGuest } from "@repo/auth/guest";
import type * as AuthServer from "@repo/auth/server";
import {
  and,
  createSecondaryDatabase,
  db,
  eq,
  organizationMembers,
  organizations,
  profiles,
  sessions,
  users,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";

const enabled = vi.fn().mockResolvedValue(true);
const { auth: productionAuth } = await vi.importActual<typeof AuthServer>("@repo/auth/server");
const auth = betterAuth({
  ...productionAuth.options,
  plugins: productionAuth.options.plugins.map((plugin) =>
    plugin.id === "anonymous" ? openJiiGuest({ isDemoEnabled: enabled }) : plugin,
  ),
});
const base = `${auth.options.baseURL}/api/v1/auth`;

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

describe("anonymous sessions on the production auth boundary", () => {
  const app = TestHarness.App;
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    enabled.mockResolvedValue(true);
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("creates a named member only in Demo, without a profile or workspace", async () => {
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
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
    ).toMatchObject([{ organizationId: demo, role: "member" }]);
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.email).toMatch(/@guest\.openjii\.invalid$/);
    expect(stored.registered).toBe(false);
    const session = await auth.handler(
      new Request(`${base}/get-session`, { headers: { cookie: user.cookie } }),
    );
    const sessionBody: unknown = await session.json();
    expect(sessionBody).toMatchObject({ user: { id: user.id, isAnonymous: true } });
    expect(sessionBody).not.toHaveProperty("user.email");
  });

  it("uses Guest for an omitted name and refuses invalid names before creating rows", async () => {
    expect((await guest()).name).toBe("Guest");
    const before = await db.select().from(users);
    for (const name of ["a".repeat(61), "https://example.org", "www.example.org", 4, {}]) {
      expect((await post("/sign-in/anonymous", { name })).status).toBe(400);
    }
    expect(await db.select().from(users)).toEqual(before);
  });

  it("admits current guests to later Demo organizations and removes only guests on exit", async () => {
    const visitor = await guest();
    const demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const researcher = await app.createTestUser();
    await db
      .insert(organizationMembers)
      .values({ organizationId: demo, userId: researcher, role: "owner" });
    expect(
      await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, visitor.id),
            eq(organizationMembers.organizationId, demo),
          ),
        ),
    ).toHaveLength(1);
    await db.update(organizations).set({ type: "university" }).where(eq(organizations.id, demo));
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, visitor.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, researcher)),
    ).toHaveLength(1);
    await db.update(organizations).set({ type: "demo" }).where(eq(organizations.id, demo));
    expect(
      await db.select().from(organizationMembers).where(eq(organizationMembers.userId, visitor.id)),
    ).toHaveLength(1);
  });

  it("serializes simultaneous guest and Demo creation across database connections", async () => {
    const other = createSecondaryDatabase();
    let release!: () => void;
    let acquired!: () => void;
    const held = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const visitorId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const creatingGuest = db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: visitorId,
        name: "Synthetic visitor",
        email: `${visitorId}@guest.openjii.invalid`,
        isAnonymous: true,
      });
      acquired();
      await resume;
    });
    try {
      await held;
      let finished = false;
      const creatingOrganization = other.database
        .insert(organizations)
        .values({
          id: organizationId,
          name: "Synthetic demo",
          slug: `demo-${organizationId}`,
          type: "demo",
          visibility: "public",
        })
        .then(() => {
          finished = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(finished).toBe(false);
      release();
      await Promise.all([creatingGuest, creatingOrganization]);
      expect(
        await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, visitorId),
              eq(organizationMembers.organizationId, organizationId),
            ),
          ),
      ).toHaveLength(1);
    } finally {
      release();
      await creatingGuest;
      await other.close();
    }
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
    expect((await post("/update-user", { name: "Renamed" }, visitor.cookie)).status).toBe(200);
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

  it("never deletes a guest through plugin deletion or any sign-in/callback matcher", async () => {
    await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    const visitor = await guest();
    const existingEmail = `existing-${crypto.randomUUID()}@example.test`;
    const otp = await auth.api.createVerificationOTP({
      body: { email: existingEmail, type: "sign-in" },
    });
    expect(
      (await post("/sign-in/email-otp", { email: existingEmail, otp }, visitor.cookie)).status,
    ).toBe(403);
    const before = {
      users: await db.select().from(users).where(eq(users.id, visitor.id)),
      sessions: await db.select().from(sessions).where(eq(sessions.userId, visitor.id)),
      members: await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, visitor.id)),
    };
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

  it("fails closed when the demo flag is off or unavailable", async () => {
    enabled.mockResolvedValue(false);
    expect((await post("/sign-in/anonymous")).status).toBe(403);
    expect(await db.select().from(users).where(eq(users.isAnonymous, true))).toHaveLength(0);
  });
});
