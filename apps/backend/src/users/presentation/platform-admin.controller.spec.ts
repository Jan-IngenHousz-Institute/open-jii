import { eq, users } from "@repo/database";

import { TestHarness } from "../../test/test-harness";

describe("Platform admin directory and appointment search", () => {
  const app = TestHarness.App;
  beforeAll(() => app.setup());
  beforeEach(() => app.beforeEach());
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("lists admins and searches registered researchers with only rendered fields", async () => {
    const actor = await app.createTestUser({ name: "Admin Person" });
    const candidate = await app.createTestUser({ name: "Potential Researcher" });
    await app.createTestUser({ name: "Potential Unregistered", registered: false });
    await app.database.update(users).set({ role: "admin" }).where(eq(users.id, actor));
    const list = await app.get("/api/v1/platform-admins").withAuth(actor).expect(200);
    const [stored] = await app.database.select().from(users).where(eq(users.id, actor));
    expect(list.body).toEqual([
      {
        id: actor,
        name: "Admin Person",
        configured: false,
        appointedAt: stored.adminGrantedAt?.toISOString(),
      },
    ]);
    const found = await app
      .get("/api/v1/platform-admins/candidates?search=Potential")
      .withAuth(actor)
      .expect(200);
    expect(found.body).toEqual([{ id: candidate, name: "Potential Researcher" }]);
  });

  it.each(["/api/v1/platform-admins", "/api/v1/platform-admins/candidates?search=Research"])(
    "refuses ordinary and API-key callers at %s",
    async (path) => {
      const ordinary = await app.createTestUser();
      const actor = await app.createTestUser();
      await app.database.update(users).set({ role: "admin" }).where(eq(users.id, actor));
      await app.get(path).withoutAuth().expect(401);
      await app.get(path).withAuth(ordinary).expect(403);
      await app.get(path).withAuth(actor).set("x-api-key", "admin-key").expect(403);
    },
  );

  it("reads fresh roles for capability checks", async () => {
    const actor = await app.createTestUser();
    await app.database.update(users).set({ role: "admin" }).where(eq(users.id, actor));
    expect(
      (await app.get("/api/v1/platform-admins/access").withAuth(actor).expect(200)).body,
    ).toEqual({ isPlatformAdmin: true });
    expect(
      (
        await app
          .get("/api/v1/platform-admins/access")
          .withAuth(actor)
          .set("x-api-key", "key")
          .expect(200)
      ).body,
    ).toEqual({ isPlatformAdmin: false });
    await app.database.update(users).set({ role: "user" }).where(eq(users.id, actor));
    expect(
      (await app.get("/api/v1/platform-admins/access").withAuth(actor).expect(200)).body,
    ).toEqual({ isPlatformAdmin: false });
  });
});
