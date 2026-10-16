import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { RecentlyOpened } from "@repo/api/domains/visit/visit.schema";
import { eq, resourceVisits, workbookVersions } from "@repo/database";

import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("VisitController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
  const visitsOf = (userId: string) =>
    testApp.database.select().from(resourceVisits).where(eq(resourceVisits.userId, userId));

  describe("recordVisit", () => {
    const path = () => testApp.resolveOrpcPath(contract.visits.recordVisit);

    it("records a visit to an experiment the caller can open", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Mine", userId: testUserId });

      await testApp
        .post(path())
        .withAuth(testUserId)
        .send({ resourceType: "experiment", resourceId: experiment.id })
        .expect(StatusCodes.NO_CONTENT);

      expect(await visitsOf(testUserId)).toEqual([
        expect.objectContaining({ resourceType: "experiment", resourceId: experiment.id }),
      ]);
    });

    it("records protocols, macros and workbooks under their own type", async () => {
      const protocol = await testApp.createProtocol({ name: "P", createdBy: testUserId });
      const macro = await testApp.createMacro({ name: "M", createdBy: testUserId });
      const workbook = await testApp.createWorkbook({ name: "W", createdBy: testUserId });

      for (const [resourceType, resourceId] of [
        ["protocol", protocol.id],
        ["macro", macro.id],
        ["workbook", workbook.id],
      ]) {
        await testApp
          .post(path())
          .withAuth(testUserId)
          .send({ resourceType, resourceId })
          .expect(StatusCodes.NO_CONTENT);
      }

      expect(await visitsOf(testUserId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ resourceType: "protocol", resourceId: protocol.id }),
          expect.objectContaining({ resourceType: "macro", resourceId: macro.id }),
          expect.objectContaining({ resourceType: "workbook", resourceId: workbook.id }),
        ]),
      );
    });

    it("records a visit to a public experiment the caller has no role on", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Public",
        userId: otherUserId,
        visibility: "public",
      });

      await testApp
        .post(path())
        .withAuth(testUserId)
        .send({ resourceType: "experiment", resourceId: experiment.id })
        .expect(StatusCodes.NO_CONTENT);

      expect(await visitsOf(testUserId)).toHaveLength(1);
    });

    it("refuses a resource the caller cannot open", async () => {
      const otherUserId = await testApp.createTestUser({});
      const macro = await testApp.createMacro({
        name: "Private",
        createdBy: otherUserId,
        visibility: "private",
      });

      await testApp
        .post(path())
        .withAuth(testUserId)
        .send({ resourceType: "macro", resourceId: macro.id })
        .expect(StatusCodes.FORBIDDEN);

      expect(await visitsOf(testUserId)).toEqual([]);
    });

    it("returns 404 for a resource that does not exist", async () => {
      await testApp
        .post(path())
        .withAuth(testUserId)
        .send({ resourceType: "workbook", resourceId: faker.string.uuid() })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("rejects a type that records no visits", async () => {
      await testApp
        .post(path())
        .withAuth(testUserId)
        .send({ resourceType: "device", resourceId: faker.string.uuid() })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 401 without a session", async () => {
      await testApp
        .post(path())
        .withoutAuth()
        .send({ resourceType: "experiment", resourceId: faker.string.uuid() })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listRecentlyOpened", () => {
    const path = () => testApp.resolveOrpcPath(contract.visits.listRecentlyOpened);

    it("lists every type, newest visit first, with each type's detail", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const protocol = await testApp.createProtocol({
        name: "Dark adapted",
        family: "ambyte",
        createdBy: testUserId,
      });
      const macro = await testApp.createMacro({
        name: "Efficiency",
        language: "r",
        createdBy: testUserId,
      });
      const workbook = await testApp.createWorkbook({ name: "Leaf gas", createdBy: testUserId });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceId: experiment.id,
        visitedAt: minutesAgo(1),
      });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "protocol",
        resourceId: protocol.id,
        visitedAt: minutesAgo(4),
      });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "macro",
        resourceId: macro.id,
        visitedAt: minutesAgo(2),
      });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "workbook",
        resourceId: workbook.id,
        visitedAt: minutesAgo(3),
      });

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          type: "experiment",
          id: experiment.id,
          status: "active",
          // A personal workspace has no organization name to show.
          organizationName: null,
          callerRole: "owner",
        }),
        expect.objectContaining({ type: "macro", id: macro.id, language: "r" }),
        expect.objectContaining({ type: "workbook", id: workbook.id, latestVersion: null }),
        expect.objectContaining({ type: "protocol", id: protocol.id, family: "ambyte" }),
      ]);
      expect(response.body.types).toEqual(["experiment", "protocol", "macro", "workbook"]);
    });

    it("reports a workbook's newest published version", async () => {
      const workbook = await testApp.createWorkbook({ name: "Published", createdBy: testUserId });
      await testApp.database.insert(workbookVersions).values(
        [1, 2].map((version) => ({
          workbookId: workbook.id,
          version,
          cells: [],
          createdBy: testUserId,
        })),
      );
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "workbook",
        resourceId: workbook.id,
      });

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.items).toEqual([expect.objectContaining({ latestVersion: 2 })]);
    });

    it("narrows to one type and still reports the others", async () => {
      const { experiment } = await testApp.createExperiment({ name: "E", userId: testUserId });
      const protocol = await testApp.createProtocol({ name: "P", createdBy: testUserId });
      await testApp.addResourceVisit({ userId: testUserId, resourceId: experiment.id });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "protocol",
        resourceId: protocol.id,
      });

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .query({ type: "protocol" })
        .expect(StatusCodes.OK);

      expect(response.body.items.map((item) => item.id)).toEqual([protocol.id]);
      expect(response.body.types).toEqual(["experiment", "protocol"]);
    });

    it("lists public work the caller holds no role on, with no role", async () => {
      const otherUserId = await testApp.createTestUser({});
      const protocol = await testApp.createProtocol({
        name: "Public",
        createdBy: otherUserId,
        visibility: "public",
      });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "protocol",
        resourceId: protocol.id,
      });

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.items).toEqual([
        expect.objectContaining({ id: protocol.id, callerRole: null }),
      ]);
    });

    it("drops a resource once the caller can no longer open it, and its type with it", async () => {
      const otherUserId = await testApp.createTestUser({});
      const workbook = await testApp.createWorkbook({
        name: "Shared, then revoked",
        createdBy: otherUserId,
        visibility: "private",
      });
      const grant = await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "user",
        granteeId: testUserId,
        role: "viewer",
      });
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceType: "workbook",
        resourceId: workbook.id,
      });
      await testApp.removeResourceGrant(grant.id);

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ items: [], types: [] });
    });

    it("defaults to five rows", async () => {
      for (let index = 0; index < 6; index++) {
        const macro = await testApp.createMacro({ name: `M${index}`, createdBy: testUserId });
        await testApp.addResourceVisit({
          userId: testUserId,
          resourceType: "macro",
          resourceId: macro.id,
          visitedAt: minutesAgo(index),
        });
      }

      const response: SuperTestResponse<RecentlyOpened> = await testApp
        .get(path())
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.items.map((item) => item.name)).toEqual(["M0", "M1", "M2", "M3", "M4"]);
    });

    it("rejects an unknown type", async () => {
      await testApp
        .get(path())
        .withAuth(testUserId)
        .query({ type: "device" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 401 without a session", async () => {
      await testApp.get(path()).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
