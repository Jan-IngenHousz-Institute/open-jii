import {
  db,
  eq,
  experiments,
  notifications,
  organizationMembers,
  resourceGrants,
  sessions,
  users,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { AuthorizationService } from "./authorization.service";
import { guestRouteInventory } from "./core/models/guest-route.model";

describe("guest authorization HTTP boundary", () => {
  const app = TestHarness.App;
  let visitor: string;
  let researcher: string;
  let ordinary: string;
  let publicExperiment: string;
  let privateExperiment: string;
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    researcher = await app.createTestUser();
    await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    ordinary = await app.createOrganization(undefined, {
      type: "university",
      visibility: "public",
    });
    const [guest] = await db
      .insert(users)
      .values({
        name: "Synthetic visitor",
        email: `${crypto.randomUUID()}@guest.openjii.invalid`,
        isAnonymous: true,
      })
      .returning();
    visitor = guest.id;
    await db.insert(sessions).values({
      userId: visitor,
      token: `test-token-${visitor}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const inserted = await db
      .insert(experiments)
      .values([
        {
          name: "Public ordinary example",
          createdBy: researcher,
          organizationId: ordinary,
          visibility: "public",
        },
        {
          name: "Private ordinary example",
          createdBy: researcher,
          organizationId: ordinary,
          visibility: "private",
        },
      ])
      .returning();
    publicExperiment = inserted[0].id;
    privateExperiment = inserted[1].id;
    await db.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: privateExperiment,
      granteeType: "user",
      granteeId: visitor,
      role: "admin",
      createdBy: researcher,
    });
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("refuses every deny-classified contract mutation before handler effects", async () => {
    const before = {
      users: await db.select().from(users),
      experiments: await db.select().from(experiments),
      grants: await db.select().from(resourceGrants),
      members: await db.select().from(organizationMembers),
      notifications: await db.select().from(notifications),
    };
    for (const route of guestRouteInventory.filter(
      ({ method, classification }) => method !== "GET" && classification === "deny",
    )) {
      const path = route.path.replace(/\{[^}]+\}/g, publicExperiment);
      const body = {
        name: "Must not persist",
        organizationId: ordinary,
        experimentId: publicExperiment,
        role: "admin",
        decision: "approve",
        data: {},
      };
      const response = await app[
        route.method.toLowerCase() === "delete"
          ? "delete"
          : route.method === "PUT"
            ? "put"
            : route.method === "PATCH"
              ? "patch"
              : "post"
      ](path)
        .withAuth(visitor)
        .send(body);
      expect([401, 403], `${route.method} ${path}: ${JSON.stringify(response.body)}`).toContain(
        response.status,
      );
    }
    expect(await db.select().from(users)).toEqual(before.users);
    expect(await db.select().from(experiments)).toEqual(before.experiments);
    expect(await db.select().from(resourceGrants)).toEqual(before.grants);
    expect(await db.select().from(organizationMembers)).toEqual(before.members);
    expect(await db.select().from(notifications)).toEqual(before.notifications);
  }, 30_000);

  it("reads ordinary public experiments, but a private grant cannot expose details or list rows", async () => {
    expect(
      (await app.get(`/api/v1/experiments/${publicExperiment}`).withAuth(visitor)).status,
    ).toBe(200);
    expect(
      (await app.get(`/api/v1/experiments/${privateExperiment}`).withAuth(visitor)).status,
    ).toBe(403);
    const response = await app.get(`/api/v1/experiments?scope=all`).withAuth(visitor);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain(publicExperiment);
    expect(JSON.stringify(response.body)).not.toContain(privateExperiment);
    const access = app.module.get(AuthorizationService);
    for (const action of ["update", "manage", "share", "contribute"] as const) {
      expect(
        await access.can(visitor, {
          resourceType: "experiment",
          resourceId: privateExperiment,
          action,
        }),
      ).toMatchObject({ allow: false });
    }
  });

  it("never exposes credentials or private service feeds, even through GET routes", async () => {
    const paths = [
      "/api/v1/iot/credentials",
      "/api/v1/notifications",
      "/api/v1/newsletter/status",
      "/api/v1/users/search?query=Seed",
      "/api/v1/devices",
      "/api/v1/locations/search?query=example",
      "/api/v1/platform-admins",
    ];
    for (const path of paths)
      expect((await app.get(path).withAuth(visitor)).status, path).toBe(403);
  });

  it("a deleted guest cannot use the stale session after purge", async () => {
    await db.delete(resourceGrants).where(eq(resourceGrants.granteeId, visitor));
    await db.delete(users).where(eq(users.id, visitor));
    expect(
      (await app.get(`/api/v1/experiments/${publicExperiment}`).withAuth(visitor)).status,
    ).toBe(401);
  });
});
