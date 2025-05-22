import {
  experiments as experimentsTable,
  experimentMembers,
  eq,
  and,
} from "@repo/database";

import { TestHarness } from "../../../test/test-harness";
import { assertSuccess } from "../../utils/fp-utils";
import { ExperimentRepository } from "./experiment.repository";

describe("ExperimentRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new experiment", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Experiment",
        description: "Test Description",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.create(createExperimentDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      const experiment = experiments[0];

      expect(experiment).toMatchObject({
        id: expect.any(String),
        name: createExperimentDto.name,
        description: createExperimentDto.description,
        status: createExperimentDto.status,
        visibility: createExperimentDto.visibility,
        embargoIntervalDays: createExperimentDto.embargoIntervalDays,
        createdBy: testUserId,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createExperimentDto.name,
        description: createExperimentDto.description,
        status: createExperimentDto.status,
        visibility: createExperimentDto.visibility,
        embargoIntervalDays: createExperimentDto.embargoIntervalDays,
        createdBy: testUserId,
      });
    });
  });

  describe("findAll", () => {
    it("should return all experiments without filter", async () => {
      // Arrange
      const { experiment: experiment1 } = await testApp.createExperiment({
        name: "Experiment 1",
        userId: testUserId,
      });
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Experiment 2",
        userId: testUserId,
      });

      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
          expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
        ]),
      );
    });

    it("should filter experiments by 'my' filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-user@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-user@example.com",
      });

      // Create experiment owned by main user
      const { experiment: ownedExperiment } = await testApp.createExperiment({
        name: "My Experiment",
        userId: mainUserId,
      });

      // Create experiment owned by other user
      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
      });

      // Act
      const result = await repository.findAll(mainUserId, "my");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(ownedExperiment.id);
      expect(experiments[0].name).toBe("My Experiment");
    });

    it("should filter experiments by 'member' filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-user@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-user@example.com",
      });

      // Create experiment owned by other user
      const { experiment } = await testApp.createExperiment({
        name: "Member Experiment",
        userId: otherUserId,
      });

      // Add main user as a member
      await testApp.addExperimentMember(experiment.id, mainUserId, "member");

      // Act
      const result = await repository.findAll(mainUserId, "member");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(experiment.id);
      expect(experiments[0].name).toBe("Member Experiment");
    });

    it("should filter experiments by 'related' filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-user@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-user@example.com",
      });

      // Create experiment owned by main user
      const { experiment: ownedExperiment } = await testApp.createExperiment({
        name: "My Experiment",
        userId: mainUserId,
      });

      // Create experiment owned by other user
      const { experiment: memberExperiment } = await testApp.createExperiment({
        name: "Member Experiment",
        userId: otherUserId,
      });

      // Add main user as a member of the other experiment
      await testApp.addExperimentMember(
        memberExperiment.id,
        mainUserId,
        "member",
      );

      // Create an unrelated experiment
      await testApp.createExperiment({
        name: "Unrelated Experiment",
        userId: otherUserId,
      });

      // Act
      const result = await repository.findAll(mainUserId, "related");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: ownedExperiment.id,
            name: "My Experiment",
          }),
          expect.objectContaining({
            id: memberExperiment.id,
            name: "Member Experiment",
          }),
        ]),
      );
    });
  });

  describe("findOne", () => {
    it("should find an experiment by id", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Find",
        description: "Should be found by ID",
        userId: testUserId,
      });

      // Act
      const result = await repository.findOne(experiment.id);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const foundExperiment = result.value;
      expect(foundExperiment).toMatchObject({
        id: experiment.id,
        name: "Experiment to Find",
        description: "Should be found by ID",
        createdBy: testUserId,
      });
    });

    it("should return null if experiment not found", async () => {
      // Act
      const result = await repository.findOne(
        "00000000-0000-0000-0000-000000000000",
      );

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Original Name",
        description: "Original Description",
        userId: testUserId,
      });

      const updateData = {
        name: "Updated Name",
        description: "Updated Description",
        status: "active" as const,
      };

      // Act
      const updateResult = await repository.update(experiment.id, updateData);

      // Assert
      expect(updateResult.isSuccess()).toBe(true);
      expect(updateResult._tag).toBe("success");

      assertSuccess(updateResult);
      const updatedExperiments = updateResult.value;
      const updatedExperiment = updatedExperiments[0];

      expect(updatedExperiment).toMatchObject({
        id: experiment.id,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status,
        createdBy: testUserId,
      });

      // Verify database directly
      const dbExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      expect(dbExperiment.length).toBe(1);
      expect(dbExperiment[0].name).toBe(updateData.name);
      expect(dbExperiment[0].description).toBe(updateData.description);
      expect(dbExperiment[0].status).toBe(updateData.status);
    });

    it("should update the updatedAt timestamp when an experiment is modified", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Timestamp Test Experiment",
        description: "Testing updatedAt",
        userId: testUserId,
      });

      // Store the original updatedAt timestamp
      const originalExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      const originalUpdatedAt = originalExperiment[0].updatedAt;

      // Add a small delay to ensure timestamp will be different
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act: update the experiment
      const updateData = {
        name: "Updated Timestamp Experiment",
      };

      const updateResult = await repository.update(experiment.id, updateData);
      expect(updateResult.isSuccess()).toBe(true);

      // Assert: verify updatedAt was changed
      const updatedExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id))
        .limit(1);

      expect(updatedExperiment[0].updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedExperiment[0].updatedAt > originalUpdatedAt).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete an experiment and its members", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      // Add a member to the experiment
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Act
      const deleteResult = await repository.delete(experiment.id);

      // Assert
      expect(deleteResult.isSuccess()).toBe(true);

      // Assert directly from database
      const deletedExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, experiment.id));
      expect(deletedExperiment.length).toBe(0);

      // Verify members were deleted
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));
      expect(members.length).toBe(0);
    });
  });

  describe("hasAccess", () => {
    it("should return true if user created the experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Creator Access Test",
        userId: testUserId,
      });

      // Act
      const result = await repository.hasAccess(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);

      // Verify relationship directly in database
      const dbExperiment = await testApp.database
        .select()
        .from(experimentsTable)
        .where(
          and(
            eq(experimentsTable.id, experiment.id),
            eq(experimentsTable.createdBy, testUserId),
          ),
        );
      expect(dbExperiment.length).toBe(1);
    });

    it("should return true if user is a member of the experiment", async () => {
      // Arrange
      const creatorId = await testApp.createTestUser({
        email: "creator@example.com",
      });
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Member Access Test",
        userId: creatorId,
      });

      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Act
      const result = await repository.hasAccess(experiment.id, memberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);

      // Verify relationship directly in database
      const membership = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, memberId),
          ),
        );
      expect(membership.length).toBe(1);
    });

    it("should return false if user has no relation to the experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "No Access Test",
        userId: testUserId,
      });

      const nonMemberId = await testApp.createTestUser({
        email: "non-member@example.com",
      });

      // Act
      const result = await repository.hasAccess(experiment.id, nonMemberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value).toBe(false);

      // Verify absence of relationship directly in database
      const membership = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, nonMemberId),
          ),
        );
      expect(membership.length).toBe(0);

      const creatorCheck = await testApp.database
        .select()
        .from(experimentsTable)
        .where(
          and(
            eq(experimentsTable.id, experiment.id),
            eq(experimentsTable.createdBy, nonMemberId),
          ),
        );
      expect(creatorCheck.length).toBe(0);
    });

    it("should return false if experiment does not exist", async () => {
      // Act
      const result = await repository.hasAccess(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(false);

      // Verify directly in database
      const experimentCheck = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, "00000000-0000-0000-0000-000000000000"));
      expect(experimentCheck.length).toBe(0);
    });
  });
});
