import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type {
  CreateExperimentDashboardDto,
  ExperimentDashboardDto,
  UpdateExperimentDashboardDto,
} from "../models/experiment-dashboards.model";
import { ExperimentDashboardRepository } from "./experiment-dashboard.repository";

describe("ExperimentDashboardRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDashboardRepository;
  let testUserId: string;
  let anotherUserId: string;
  let testExperimentId: string;
  let anotherExperimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: "Test User" });
    anotherUserId = await testApp.createTestUser({ name: "Another User" });

    const testExperiment = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    testExperimentId = testExperiment.experiment.id;

    const anotherExperiment = await testApp.createExperiment({
      name: "Another Experiment",
      userId: anotherUserId,
    });
    anotherExperimentId = anotherExperiment.experiment.id;

    repository = testApp.module.get(ExperimentDashboardRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new dashboard", async () => {
      const createDto: CreateExperimentDashboardDto = {
        name: "Test Dashboard",
        description: "Test Description",
        layout: { columns: 12, rowHeight: 80, gap: 16 },
        widgets: [],
      };

      const result = await repository.create(testExperimentId, createDto, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const dashboard = result.value[0];

      expect(typeof dashboard.id).toBe("string");
      expect(dashboard.createdAt).toBeInstanceOf(Date);
      expect(dashboard.updatedAt).toBeInstanceOf(Date);
      expect(dashboard).toMatchObject({
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        createdBy: testUserId,
        createdByName: "Test User",
      });
      expect(dashboard.layout).toMatchObject({ columns: 12, rowHeight: 80, gap: 16 });
      expect(dashboard.widgets).toEqual([]);

      const findResult = await repository.findById(dashboard.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        createdBy: testUserId,
        createdByName: "Test User",
      });
    });

    it("should create a dashboard with null description", async () => {
      const createDto: CreateExperimentDashboardDto = {
        name: "No Description Dashboard",
        description: undefined,
      };

      const result = await repository.create(testExperimentId, createDto, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const dashboard = result.value[0];

      expect(dashboard).toMatchObject({
        name: createDto.name,
        description: null,
        experimentId: testExperimentId,
        createdBy: testUserId,
      });
    });

    it("should apply DB defaults when layout/widgets are omitted", async () => {
      // Use case omits both fields; DB defaults take over.
      const createDto: CreateExperimentDashboardDto = {
        name: "Defaults Dashboard",
      };

      const result = await repository.create(testExperimentId, createDto, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const dashboard = result.value[0];

      expect(dashboard.layout).toMatchObject({ columns: 12, rowHeight: 80, gap: 16 });
      expect(dashboard.widgets).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      const createDto: CreateExperimentDashboardDto = {
        name: "Test Dashboard",
      };

      const invalidExperimentId = faker.string.uuid();

      const result = await repository.create(invalidExperimentId, createDto, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("listDashboards", () => {
    it("should return empty array when no dashboards exist", async () => {
      const result = await repository.listDashboards(testExperimentId, 50, 0);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should list dashboards for a specific experiment", async () => {
      const createDto1: CreateExperimentDashboardDto = { name: "First Dashboard" };
      const createDto2: CreateExperimentDashboardDto = { name: "Second Dashboard" };

      await repository.create(testExperimentId, createDto1, testUserId);
      await repository.create(testExperimentId, createDto2, testUserId);

      // Dashboard in another experiment should not be returned.
      await repository.create(anotherExperimentId, createDto1, anotherUserId);

      const result = await repository.listDashboards(testExperimentId, 50, 0);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const dashboards = result.value;
      expect(dashboards[0].name).toBe("Second Dashboard");
      expect(dashboards[1].name).toBe("First Dashboard");

      dashboards.forEach((dashboard) => {
        expect(dashboard.experimentId).toBe(testExperimentId);
      });
    });

    it("should respect limit and offset pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await repository.create(testExperimentId, { name: `Dashboard ${i}` }, testUserId);
        // Spacing keeps creation timestamps strictly increasing so the
        // descending order is stable to assert against.
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const firstPage = await repository.listDashboards(testExperimentId, 2, 0);
      const secondPage = await repository.listDashboards(testExperimentId, 2, 2);

      assertSuccess(firstPage);
      assertSuccess(secondPage);
      expect(firstPage.value).toHaveLength(2);
      expect(secondPage.value).toHaveLength(2);
      expect(firstPage.value[0].id).not.toBe(secondPage.value[0].id);
      expect(firstPage.value[1].id).not.toBe(secondPage.value[0].id);
    });

    it("should order dashboards by creation date descending", async () => {
      const createDto: CreateExperimentDashboardDto = { name: "Dashboard" };

      await repository.create(
        testExperimentId,
        { ...createDto, name: "First Created" },
        testUserId,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await repository.create(
        testExperimentId,
        { ...createDto, name: "Second Created" },
        testUserId,
      );

      const result = await repository.listDashboards(testExperimentId, 50, 0);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].name).toBe("Second Created");
      expect(result.value[1].name).toBe("First Created");
      expect(result.value[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        result.value[1].createdAt.getTime(),
      );
    });

    it("should still return dashboards whose creator has no profile row", async () => {
      const profilelessUserId = await testApp.createTestUser({
        name: "Profileless",
        createProfile: false,
      });

      await repository.create(testExperimentId, { name: "Orphan Dashboard" }, profilelessUserId);

      const result = await repository.listDashboards(testExperimentId, 50, 0);

      assertSuccess(result);
      const orphan = result.value.find((d) => d.name === "Orphan Dashboard");
      expect(orphan).toBeDefined();
      // The anonymized name SQL (`getAnonymizedFirstName`/`getAnonymizedLastName`)
      // returns 'Unknown' / 'User' when `profiles.activated` is null, which is
      // what a left-join produces for a profile-less creator. The dashboard
      // surfaces with the same placeholder name used for deactivated profiles.
      expect(orphan?.createdByName).toBe("Unknown User");
    });
  });

  describe("findById", () => {
    it("should return null when dashboard does not exist", async () => {
      const nonExistentId = faker.string.uuid();

      const result = await repository.findById(nonExistentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should find and return dashboard by ID", async () => {
      const createDto: CreateExperimentDashboardDto = {
        name: "Test Dashboard",
        description: "Test Description",
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const created = createResult.value[0];

      const result = await repository.findById(created.id);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value).toMatchObject({
        id: created.id,
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        createdBy: testUserId,
        createdByName: "Test User",
      });
    });

    it("should handle database errors gracefully", async () => {
      const invalidId = "not-a-valid-uuid";

      const result = await repository.findById(invalidId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update an existing dashboard", async () => {
      const createResult = await repository.create(
        testExperimentId,
        { name: "Original Name", description: "Original Description" },
        testUserId,
      );
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const updateDto: UpdateExperimentDashboardDto = {
        name: "Updated Name",
        description: "Updated Description",
      };

      const result = await repository.update(dashboard.id, updateDto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updated = result.value[0];

      expect(updated.updatedAt).toBeInstanceOf(Date);
      expect(updated).toMatchObject({
        id: dashboard.id,
        name: updateDto.name,
        description: updateDto.description,
        experimentId: testExperimentId,
        createdBy: testUserId,
        createdByName: "Test User",
        createdAt: dashboard.createdAt,
      });

      const findResult = await repository.findById(dashboard.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: updateDto.name,
        description: updateDto.description,
      });
    });

    it("should return empty array when updating non-existent dashboard", async () => {
      const nonExistentId = faker.string.uuid();
      const updateDto: UpdateExperimentDashboardDto = { name: "Updated Name" };

      const result = await repository.update(nonExistentId, updateDto);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should handle partial updates", async () => {
      const createResult = await repository.create(
        testExperimentId,
        { name: "Original Name", description: "Original Description" },
        testUserId,
      );
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const result = await repository.update(dashboard.id, { name: "Updated Name Only" });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updated = result.value[0];

      expect(updated.name).toBe("Updated Name Only");
      expect(updated.description).toBe("Original Description");
    });

    it("should handle database errors gracefully", async () => {
      const invalidId = "not-a-valid-uuid";
      const updateDto: UpdateExperimentDashboardDto = { name: "Updated Name" };

      const result = await repository.update(invalidId, updateDto);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("delete", () => {
    it("should delete an existing dashboard", async () => {
      const createResult = await repository.create(
        testExperimentId,
        { name: "Test Dashboard" },
        testUserId,
      );
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const findBefore = await repository.findById(dashboard.id);
      assertSuccess(findBefore);
      expect(findBefore.value).not.toBeNull();

      const result = await repository.delete(dashboard.id);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();

      const findAfter = await repository.findById(dashboard.id);
      assertSuccess(findAfter);
      expect(findAfter.value).toBeNull();

      const listResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(0);
    });

    it("should succeed when deleting non-existent dashboard", async () => {
      const nonExistentId = faker.string.uuid();

      const result = await repository.delete(nonExistentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      const invalidId = "not-a-valid-uuid";

      const result = await repository.delete(invalidId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("integration tests", () => {
    it("should handle complete CRUD lifecycle", async () => {
      const createDto: CreateExperimentDashboardDto = {
        name: "Lifecycle Dashboard",
        description: "Testing complete lifecycle",
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const findResult = await repository.findById(dashboard.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: createDto.name,
        description: createDto.description,
      });

      const listResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
      expect(listResult.value[0].id).toBe(dashboard.id);

      const updateDto: UpdateExperimentDashboardDto = {
        name: "Updated Lifecycle Dashboard",
        description: "Updated description",
      };
      const updateResult = await repository.update(dashboard.id, updateDto);
      assertSuccess(updateResult);
      expect(updateResult.value[0]).toMatchObject({
        name: updateDto.name,
        description: updateDto.description,
      });

      const deleteResult = await repository.delete(dashboard.id);
      assertSuccess(deleteResult);

      const findAfterDelete = await repository.findById(dashboard.id);
      assertSuccess(findAfterDelete);
      expect(findAfterDelete.value).toBeNull();
    });

    it("should maintain data integrity across multiple operations", async () => {
      const dashboards: ExperimentDashboardDto[] = [];
      for (let i = 0; i < 3; i++) {
        const createDto: CreateExperimentDashboardDto = {
          name: `Dashboard ${i + 1}`,
          description: `Description ${i + 1}`,
        };
        const result = await repository.create(testExperimentId, createDto, testUserId);
        assertSuccess(result);
        dashboards.push(result.value[0]);
      }

      const listResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(3);

      const updateResult = await repository.update(dashboards[1].id, {
        name: "Updated Middle Dashboard",
      });
      assertSuccess(updateResult);

      const deleteResult = await repository.delete(dashboards[0].id);
      assertSuccess(deleteResult);

      const finalListResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(finalListResult);
      expect(finalListResult.value).toHaveLength(2);

      const remainingNames = finalListResult.value.map((d) => d.name).sort();
      expect(remainingNames).toEqual(["Dashboard 3", "Updated Middle Dashboard"]);
    });
  });

  describe("anonymization", () => {
    it("should return real name for activated users", async () => {
      const activeUserId = await testApp.createTestUser({
        name: "Active Creator",
        activated: true,
      });

      const createResult = await repository.create(
        testExperimentId,
        { name: "Dashboard by Active User" },
        activeUserId,
      );
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const listResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(listResult);
      const listed = listResult.value.find((d) => d.id === dashboard.id);
      expect(listed?.createdByName).toBe("Active Creator");

      const findResult = await repository.findById(dashboard.id);
      assertSuccess(findResult);
      expect(findResult.value?.createdByName).toBe("Active Creator");
    });

    it("should anonymize name for deactivated users", async () => {
      const inactiveUserId = await testApp.createTestUser({
        name: "Hidden Creator",
        activated: false,
      });

      const createResult = await repository.create(
        testExperimentId,
        { name: "Dashboard by Inactive User" },
        inactiveUserId,
      );
      assertSuccess(createResult);
      const dashboard = createResult.value[0];

      const listResult = await repository.listDashboards(testExperimentId, 50, 0);
      assertSuccess(listResult);
      const listed = listResult.value.find((d) => d.id === dashboard.id);
      expect(listed?.createdByName).toBe("Unknown User");

      const findResult = await repository.findById(dashboard.id);
      assertSuccess(findResult);
      expect(findResult.value?.createdByName).toBe("Unknown User");

      const updateResult = await repository.update(dashboard.id, { name: "Renamed Dashboard" });
      assertSuccess(updateResult);
      expect(updateResult.value[0].createdByName).toBe("Unknown User");
    });
  });
});
