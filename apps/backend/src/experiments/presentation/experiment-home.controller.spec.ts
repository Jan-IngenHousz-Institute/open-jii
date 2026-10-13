import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { HomeExperiments } from "@repo/api/domains/experiment/experiment.schema";
import {
  eq,
  experiments,
  organizationMembers,
  resourceGrants,
  resourceVisits,
} from "@repo/database";

import { AppError, failure } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ExperimentRepository } from "../core/repositories/experiment.repository";

describe("Experiment home read", () => {
  const app = TestHarness.App;
  const path = () => app.resolveOrpcPath(contract.experiments.listHomeExperiments);
  let userId: string;

  beforeAll(async () => app.setup({ mock: { AnalyticsAdapter: true } }));
  beforeEach(async () => {
    await app.beforeEach();
    userId = await app.createTestUser({});
  });
  afterEach(() => app.afterEach());
  afterAll(async () => app.teardown());

  it("resolves the static home route and returns an empty related result", async () => {
    const response: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(response.body).toEqual({ source: "related", experiments: [] });
  });

  it("requires authentication", async () => {
    await app.get(path()).expect(StatusCodes.UNAUTHORIZED);
  });

  it.each([0, 21, 1.5])("rejects invalid limit %s", async (limit) => {
    await app.get(path()).withAuth(userId).query({ limit }).expect(StatusCodes.BAD_REQUEST);
  });

  it("defaults to three recent updates without creating visits", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 5; index++) {
      const { experiment } = await app.createExperiment({ name: `Work ${index}`, userId });
      await app.database
        .update(experiments)
        .set({ updatedAt: new Date(2026, 0, index + 1) })
        .where(eq(experiments.id, experiment.id));
      ids.push(experiment.id);
    }
    const response: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(response.body.source).toBe("related");
    expect(response.body.experiments.map((e: { id: string }) => e.id)).toEqual(
      ids.slice(2).reverse(),
    );
    expect(
      response.body.experiments.every((e) => e.callerRole === "owner" && !("openedAt" in e)),
    ).toBe(true);
    expect(await app.database.select().from(resourceVisits)).toEqual([]);
  });

  it("orders ties by ID even when a shared row competes with an owned row", async () => {
    const otherId = await app.createTestUser({});
    const { experiment: shared } = await app.createExperiment({ name: "Shared", userId: otherId });
    await app.addExperimentCollaborator(shared.id, userId);
    const { experiment: owned } = await app.createExperiment({ name: "Owned", userId });
    const tiedAt = new Date("2026-01-01T00:00:00Z");
    await app.database
      .update(experiments)
      .set({ id: "10000000-0000-4000-8000-000000000001", updatedAt: tiedAt })
      .where(eq(experiments.id, shared.id));
    await app.database
      .update(resourceGrants)
      .set({ resourceId: "10000000-0000-4000-8000-000000000001" })
      .where(eq(resourceGrants.resourceId, shared.id));
    await app.database
      .update(experiments)
      .set({ id: "20000000-0000-4000-8000-000000000001", updatedAt: tiedAt })
      .where(eq(experiments.id, owned.id));
    const response: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(response.body.experiments.map((e: { name: string }) => e.name)).toEqual([
      "Shared",
      "Owned",
    ]);
  });

  it("excludes archived, unrelated public and inaccessible private work", async () => {
    const otherId = await app.createTestUser({});
    await app.createExperiment({ name: "Archived", userId, status: "archived" });
    await app.createExperiment({ name: "Unrelated public", userId: otherId, visibility: "public" });
    await app.createExperiment({ name: "Private", userId: otherId });
    const { experiment } = await app.createExperiment({ name: "Allowed", userId });
    const response: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(response.body.experiments.map((e: { id: string }) => e.id)).toEqual([experiment.id]);
  });

  it("resolves overlapping viewer and member roles, then responds to revocation", async () => {
    const ownerId = await app.createTestUser({});
    const orgId = await app.createOrganization();
    await app.addOrganizationMember(orgId, ownerId, "owner");
    await app.addOrganizationMember(orgId, userId, "member");
    const { experiment } = await app.createExperiment({
      name: "Shared",
      userId: ownerId,
      organizationId: orgId,
    });
    await app.addExperimentCollaborator(experiment.id, userId);
    const viewer: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(viewer.body.experiments[0].callerRole).toBe("viewer");
    await app.database.delete(resourceGrants).where(eq(resourceGrants.granteeId, userId));
    const member: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(member.body.experiments[0].callerRole).toBe("member");
    await app.database.delete(organizationMembers).where(eq(organizationMembers.userId, userId));
    const revoked: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(revoked.body.experiments).toEqual([]);
  });

  it("keeps eligible real visits separate, then falls back when their access is revoked", async () => {
    const otherId = await app.createTestUser({});
    const { experiment: visited } = await app.createExperiment({
      name: "Visited",
      userId: otherId,
    });
    await app.addExperimentCollaborator(visited.id, userId);
    await app.addResourceVisit({ userId, resourceId: visited.id });
    const { experiment: unvisited } = await app.createExperiment({ name: "Unvisited", userId });
    const response: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(response.body.source).toBe("recently-opened");
    expect(response.body.experiments).toHaveLength(1);
    expect(response.body.experiments[0]).toMatchObject({ id: visited.id, callerRole: "viewer" });
    expect(response.body.experiments[0]).toHaveProperty("openedAt", expect.any(String));
    await app.database.delete(resourceGrants).where(eq(resourceGrants.granteeId, userId));
    const fallback: SuperTestResponse<HomeExperiments> = await app
      .get(path())
      .withAuth(userId)
      .expect(StatusCodes.OK);
    expect(fallback.body.source).toBe("related");
    expect(fallback.body.experiments.map((e: { id: string }) => e.id)).toEqual([unvisited.id]);
  });

  it.each(["findRecentlyOpened", "findRecentlyUpdatedRelated"] as const)(
    "propagates a %s failure",
    async (method) => {
      vi.spyOn(app.module.get(ExperimentRepository), method).mockResolvedValue(
        failure(AppError.notFound("read failed")),
      );
      await app.get(path()).withAuth(userId).expect(StatusCodes.NOT_FOUND);
    },
  );
});
