import { z } from "zod";

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

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { success } from "../common/utils/fp-utils";
import { LAMBDA_PORT } from "../macros/core/ports/lambda.port";
import type { LambdaPort } from "../macros/core/ports/lambda.port";
import { TestHarness } from "../test/test-harness";
import { AuthorizationService } from "./authorization.service";
import { guestRouteInventory } from "./core/models/guest-route.model";
import { DEMO_MODE_PORT } from "./core/ports/demo-mode.port";
import type { DemoModePort } from "./core/ports/demo-mode.port";

describe("guest authorization HTTP boundary", () => {
  const app = TestHarness.App;
  let visitor: string;
  let researcher: string;
  let ordinary: string;
  let demo: string;
  let publicExperiment: string;
  let privateExperiment: string;
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    researcher = await app.createTestUser();
    demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
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
      expect(response.status, `${route.method} ${path}: ${JSON.stringify(response.body)}`).toBe(
        403,
      );
      expect(response.body).toMatchObject({ code: "GUEST_ACTION_FORBIDDEN" });
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

  it("issues only Demo guest uploads, enforces size, and caps the 61st before AWS", async () => {
    vi.spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled").mockResolvedValue(true);
    const signer = vi.spyOn(app.module.get(AwsAdapter), "getIotUploadUrl").mockResolvedValue(
      success({
        uploadUrl: "https://example.test/signed",
        key: "large-iot/demo/guest/synthetic.json",
        expiresAt: new Date(),
      }),
    );
    const { experiment } = await app.createExperiment({
      name: "Synthetic demo",
      userId: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const post = (experimentId: string, contentLength?: number) =>
      app
        .post("/api/v1/iot/upload-url")
        .withAuth(visitor)
        .send({ experimentId, ...(contentLength !== undefined ? { contentLength } : {}) });
    expect((await post(publicExperiment, 20)).status).toBe(403);
    for (const size of [undefined, 0, -1, 1.5, 1_048_577])
      expect((await post(experiment.id, size)).status).toBe(400);
    expect(signer).not.toHaveBeenCalled();
    for (let i = 0; i < 60; i++) expect((await post(experiment.id, 20)).status).toBe(200);
    expect(signer).toHaveBeenLastCalledWith(experiment.id, { guestContentLength: 20 });
    const limited = await post(experiment.id, 20);
    expect(limited.status).toBe(429);
    expect(z.object({ message: z.string() }).parse(limited.body).message).toMatch(
      /Try again in \d+ seconds/,
    );
    expect(
      z
        .object({ data: z.object({ retryAfterSeconds: z.number().int().positive().max(3600) }) })
        .parse(limited.body).data.retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect(signer).toHaveBeenCalledTimes(60);
  }, 30_000);

  it("executes only Demo macros while enabled, with an independent persisted cap", async () => {
    const flag = vi
      .spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled")
      .mockResolvedValue(true);
    const lambda = app.module.get<LambdaPort>(LAMBDA_PORT);
    const invoke = vi.spyOn(lambda, "invokeLambda").mockResolvedValue(
      success({
        statusCode: 200,
        payload: {
          status: "success",
          results: [{ id: "single", success: true, output: { value: 1 } }],
        },
      }),
    );
    vi.spyOn(lambda, "getFunctionNameForLanguage").mockReturnValue("synthetic-macro");
    const macro = await app.createMacro({
      name: "Synthetic demo",
      createdBy: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const normal = await app.createMacro({
      name: "Synthetic ordinary",
      createdBy: researcher,
      organizationId: ordinary,
      visibility: "public",
    });
    const run = (id: string) =>
      app
        .post(`/api/v1/macros/${id}/execute`)
        .withAuth(visitor)
        .send({ data: { value: 1 } });
    expect((await run(normal.id)).status).toBe(403);
    flag.mockResolvedValue(false);
    expect((await run(macro.id)).status).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
    flag.mockResolvedValue(true);
    expect(
      (
        await app
          .post(`/api/v1/macros/${macro.id}/execute`)
          .withAuth(visitor)
          .send({ data: { value: 1 }, timeout: -1 })
      ).status,
    ).toBe(400);
    for (let i = 0; i < 60; i++) expect((await run(macro.id)).status).toBe(200);
    const limited = await run(macro.id);
    expect(limited.status).toBe(429);
    expect(
      z
        .object({ data: z.object({ retryAfterSeconds: z.number().int().positive().max(3600) }) })
        .parse(limited.body).data.retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect(invoke).toHaveBeenCalledTimes(60);
  }, 30_000);

  it("a deleted guest cannot use the stale session after purge", async () => {
    await db.delete(resourceGrants).where(eq(resourceGrants.granteeId, visitor));
    await db.delete(users).where(eq(users.id, visitor));
    expect(
      (await app.get(`/api/v1/experiments/${publicExperiment}`).withAuth(visitor)).status,
    ).toBe(401);
  });
});
