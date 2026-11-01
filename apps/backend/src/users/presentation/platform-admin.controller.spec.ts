import { auditLogs, changePlatformRole, eq, profiles, users } from "@repo/database";

import { assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { PlatformAdminRepository } from "../core/repositories/platform-admin.repository";

describe("Platform admin roster", () => {
  const app = TestHarness.App;
  let engineer: string;
  const change = (targetUserId: string, action: "grant" | "revoke" = "grant") =>
    changePlatformRole(app.database, {
      action,
      role: "platform_admin",
      targetUserId,
      actorUserId: engineer,
      source: "command",
    });

  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    engineer = await app.createTestUser({ name: "Granting Engineer" });
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("lists current holders with the date of their grant and only rendered fields", async () => {
    const actor = await app.createTestUser({ name: "Admin Person" });
    const revoked = await app.createTestUser({ name: "Former Admin" });
    await change(actor);
    await change(revoked);
    await change(revoked, "revoke");
    const [grant] = await app.database
      .select({ timestamp: auditLogs.timestamp })
      .from(auditLogs)
      .where(eq(auditLogs.action, "platform_role.grant"))
      .limit(1);

    const list = await app.get("/api/v1/platform-admins").withAuth(actor).expect(200);
    expect(list.body).toEqual([
      { id: actor, name: "Admin Person", grantedAt: grant.timestamp.toISOString() },
    ]);
  });

  it("omits deleted and banned holders and prefers profile names over the account name", async () => {
    const actor = await app.createTestUser({ name: "Account Admin" });
    const deleted = await app.createTestUser({ name: "Deleted Admin" });
    const banned = await app.createTestUser({ name: "Banned Admin" });
    const fallback = await app.createTestUser({ name: "Fallback Admin", createProfile: false });
    for (const id of [actor, deleted, banned, fallback]) await change(id);
    await app.database
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.userId, deleted));
    await app.database.update(users).set({ banned: true }).where(eq(users.id, banned));
    await app.database
      .update(profiles)
      .set({ firstName: "Profile", lastName: "Admin" })
      .where(eq(profiles.userId, actor));

    const list = await app.get("/api/v1/platform-admins").withAuth(actor).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: fallback, name: "Fallback Admin" }),
      expect.objectContaining({ id: actor, name: "Profile Admin" }),
    ]);
  });

  it("returns an empty roster when no account holds a platform role", async () => {
    const result = await app.module.get(PlatformAdminRepository).list();
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("returns an unknown grant date for a stored role without an audit grant", async () => {
    const actor = await app.createTestUser({ name: "Imported Admin", createProfile: false });
    await app.database.update(users).set({ role: "platform_admin" }).where(eq(users.id, actor));
    const result = await app.get("/api/v1/platform-admins").withAuth(actor).expect(200);
    expect(result.body).toEqual([{ id: actor, name: "Imported Admin", grantedAt: null }]);
  });

  it("refuses ordinary and API-key callers", async () => {
    const ordinary = await app.createTestUser();
    const actor = await app.createTestUser();
    await change(actor);
    await app.get("/api/v1/platform-admins").withoutAuth().expect(401);
    await app.get("/api/v1/platform-admins").withAuth(ordinary).expect(403);
    await app
      .get("/api/v1/platform-admins")
      .withAuth(actor)
      .set("x-api-key", "admin-key")
      .expect(403);
  });

  it("reads fresh roles for capability checks", async () => {
    const actor = await app.createTestUser();
    const access = (apiKey = false) => {
      const request = app.get("/api/v1/platform-admins/access").withAuth(actor);
      return (apiKey ? request.set("x-api-key", "key") : request).expect(200);
    };
    expect((await access()).body).toEqual({ isPlatformAdmin: false });
    await change(actor);
    expect((await access()).body).toEqual({ isPlatformAdmin: true });
    expect((await access(true)).body).toEqual({ isPlatformAdmin: false });
    await change(actor, "revoke");
    expect((await access()).body).toEqual({ isPlatformAdmin: false });
  });
});
