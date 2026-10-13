import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { eq, resourceVisits } from "@repo/database";

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

  const path = (id: string) =>
    testApp.resolveOrpcPath(contract.visits.recordExperimentVisit, { id });
  const visitsOf = (userId: string) =>
    testApp.database.select().from(resourceVisits).where(eq(resourceVisits.userId, userId));

  describe("recordExperimentVisit", () => {
    it("records a visit to an experiment the caller can open", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Mine", userId: testUserId });

      await testApp.post(path(experiment.id)).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      expect(await visitsOf(testUserId)).toEqual([
        expect.objectContaining({ resourceType: "experiment", resourceId: experiment.id }),
      ]);
    });

    it("records a visit to a public experiment the caller has no role on", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Public",
        userId: otherUserId,
        visibility: "public",
      });

      await testApp.post(path(experiment.id)).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      expect(await visitsOf(testUserId)).toHaveLength(1);
    });

    it("refuses an experiment the caller cannot open", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Private",
        userId: otherUserId,
      });

      await testApp.post(path(experiment.id)).withAuth(testUserId).expect(StatusCodes.FORBIDDEN);

      expect(await visitsOf(testUserId)).toEqual([]);
    });

    it("returns 404 for an experiment that does not exist", async () => {
      await testApp
        .post(path(faker.string.uuid()))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("returns 401 without a session", async () => {
      await testApp.post(path(faker.string.uuid())).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
