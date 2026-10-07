import { createSecondaryDatabase, eq, resourceVisits } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { VISITS_KEPT_PER_USER, VisitRepository } from "./visit.repository";

describe("VisitRepository", () => {
  const testApp = TestHarness.App;
  let repository: VisitRepository;
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };
  let secondaryRepository: VisitRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
    secondary = createSecondaryDatabase();
    secondaryRepository = new VisitRepository(secondary.database);
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(VisitRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  const visitsOf = (userId: string) =>
    testApp.database.select().from(resourceVisits).where(eq(resourceVisits.userId, userId));

  describe("record", () => {
    it("keeps one row per resource and moves it to the latest visit", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Opened", userId: testUserId });
      const earlier = new Date(Date.now() - 60 * 60_000);
      await testApp.addResourceVisit({
        userId: testUserId,
        resourceId: experiment.id,
        visitedAt: earlier,
      });

      const result = await repository.recordExperiment(testUserId, experiment.id);

      assertSuccess(result);
      const rows = await visitsOf(testUserId);
      expect(rows).toHaveLength(1);
      expect(rows[0].visitedAt.getTime()).toBeGreaterThan(earlier.getTime());
    });

    it("drops the oldest visits past the cap, and only the caller's", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment: otherVisit } = await testApp.createExperiment({
        name: "Other user's",
        userId: otherUserId,
      });
      await testApp.addResourceVisit({
        userId: otherUserId,
        resourceId: otherVisit.id,
        visitedAt: new Date(0),
      });

      const oldestIds: string[] = [];
      for (let index = 0; index < VISITS_KEPT_PER_USER; index++) {
        const { experiment } = await testApp.createExperiment({
          name: `Visited ${index}`,
          userId: testUserId,
        });
        if (index < 2) oldestIds.push(experiment.id);
        await testApp.addResourceVisit({
          userId: testUserId,
          resourceId: experiment.id,
          visitedAt: new Date(Date.now() - (VISITS_KEPT_PER_USER - index) * 60_000),
        });
      }
      const { experiment: latest } = await testApp.createExperiment({
        name: "Latest",
        userId: testUserId,
      });

      const result = await repository.recordExperiment(testUserId, latest.id);

      assertSuccess(result);
      const kept = (await visitsOf(testUserId)).map((row) => row.resourceId);
      expect(kept).toHaveLength(VISITS_KEPT_PER_USER);
      expect(kept).toContain(latest.id);
      expect(kept).not.toContain(oldestIds[0]);
      expect(kept).toContain(oldestIds[1]);
      expect(await visitsOf(otherUserId)).toHaveLength(1);
    });

    it("keeps the cap when two experiments are recorded concurrently", async () => {
      for (let index = 0; index < VISITS_KEPT_PER_USER - 1; index++) {
        const { experiment } = await testApp.createExperiment({
          name: `Existing ${index}`,
          userId: testUserId,
        });
        await testApp.addResourceVisit({
          userId: testUserId,
          resourceId: experiment.id,
          visitedAt: new Date(index * 60_000),
        });
      }
      const { experiment: first } = await testApp.createExperiment({
        name: "Concurrent first",
        userId: testUserId,
      });
      const { experiment: second } = await testApp.createExperiment({
        name: "Concurrent second",
        userId: testUserId,
      });

      const results = await Promise.all([
        repository.recordExperiment(testUserId, first.id),
        secondaryRepository.recordExperiment(testUserId, second.id),
      ]);

      results.forEach(assertSuccess);
      const kept = await visitsOf(testUserId);
      expect(kept).toHaveLength(VISITS_KEPT_PER_USER);
      expect(kept.map((visit) => visit.resourceId)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      );
    });
  });
});
