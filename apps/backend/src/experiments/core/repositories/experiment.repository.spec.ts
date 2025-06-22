import {
  experiments as experimentsTable,
  experimentMembers,
  eq,
  and,
} from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
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
        id: expect.any(String) as string,
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

    it("should filter experiments by status", async () => {
      // Arrange
      const userId = await testApp.createTestUser({
        email: "status-test@example.com",
      });

      // Create experiment with active status
      const { experiment: activeExperiment } = await testApp.createExperiment({
        name: "Active Experiment",
        userId,
        status: "active",
      });

      // Create experiment with archived status
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId,
        status: "archived",
      });

      // Act - filter by active status
      const result = await repository.findAll(userId, undefined, "active");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExperiment.id);
      expect(experiments[0].name).toBe("Active Experiment");
      expect(experiments[0].status).toBe("active");
    });

    it("should combine relationship filter with status filter", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "main-combo@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-combo@example.com",
      });

      // Create active experiment owned by main user
      const { experiment: myActive } = await testApp.createExperiment({
        name: "My Active",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment owned by main user
      await testApp.createExperiment({
        name: "My Archived",
        userId: mainUserId,
        status: "archived",
      });

      // Create active experiment owned by other user
      const { experiment: otherActive } = await testApp.createExperiment({
        name: "Other Active",
        userId: otherUserId,
        status: "active",
      });

      // Act - filter by "my" relationship and "active" status
      const result = await repository.findAll(mainUserId, "my", "active");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(myActive.id);
      expect(experiments[0].name).toBe("My Active");
      expect(experiments[0].status).toBe("active");

      // This experiment should be filtered out because it's by another user
      expect(experiments.some((e) => e.id === otherActive.id)).toBe(false);
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

  describe("checkAccess", () => {
    it("should return experiment and access info when user is creator", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Creator Access Test",
        userId: testUserId,
      });

      // Act
      const result = await repository.checkAccess(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(true);

      // Verify directly in database
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

    it("should return experiment and access info when user is an admin member", async () => {
      // Arrange
      const creatorId = await testApp.createTestUser({
        email: "creator@example.com",
      });
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });

      const { experiment } = await testApp.createExperiment({
        name: "Admin Access Test",
        userId: creatorId,
      });

      await testApp.addExperimentMember(experiment.id, adminId, "admin");

      // Act
      const result = await repository.checkAccess(experiment.id, adminId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(true);

      // Verify relationship directly in database
      const membership = await testApp.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, adminId),
            eq(experimentMembers.role, "admin"),
          ),
        );
      expect(membership.length).toBe(1);
    });

    it("should return experiment and access info when user is a regular member", async () => {
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
      const result = await repository.checkAccess(experiment.id, memberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(true);
      expect(result.value.isAdmin).toBe(false);

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

    it("should indicate no access when user has no relation to the experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "No Access Test",
        userId: testUserId,
      });

      const nonMemberId = await testApp.createTestUser({
        email: "non-member@example.com",
      });

      // Act
      const result = await repository.checkAccess(experiment.id, nonMemberId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeTruthy();
      expect(result.value.hasAccess).toBe(false);
      expect(result.value.isAdmin).toBe(false);

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
    });

    it("should return null experiment and no access when experiment does not exist", async () => {
      // Act
      const result = await repository.checkAccess(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(result.value.experiment).toBeNull();
      expect(result.value.hasAccess).toBe(false);
      expect(result.value.isAdmin).toBe(false);

      // Verify directly in database
      const experimentCheck = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, "00000000-0000-0000-0000-000000000000"));
      expect(experimentCheck.length).toBe(0);
    });
  });

  describe("createWithMembers", () => {
    it("should create an experiment with the creator as admin", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Experiment with Admin",
        description: "Test Description",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiment = result.value;

      expect(experiment).toMatchObject({
        id: expect.any(String) as string,
        name: createExperimentDto.name,
        description: createExperimentDto.description,
        status: createExperimentDto.status,
        visibility: createExperimentDto.visibility,
        embargoIntervalDays: createExperimentDto.embargoIntervalDays,
        createdBy: testUserId,
      });

      // Verify the creator is added as admin member
      const members = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));

      expect(members.length).toBe(1);
      expect(members[0]).toMatchObject({
        experimentId: experiment.id,
        userId: testUserId,
        role: "admin",
      });
    });

    it("should create an experiment with additional members", async () => {
      // Arrange
      const member1Id = await testApp.createTestUser({
        email: "member1@example.com",
      });
      const member2Id = await testApp.createTestUser({
        email: "member2@example.com",
      });

      const createExperimentDto = {
        name: "Test Experiment with Members",
        description: "Test Description",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      const members = [
        { userId: member1Id, role: "member" as const },
        { userId: member2Id, role: "admin" as const },
      ];

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
        members,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiment = result.value;

      expect(experiment).toMatchObject({
        name: createExperimentDto.name,
        createdBy: testUserId,
      });

      // Verify all members are added correctly
      const dbMembers = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));

      expect(dbMembers.length).toBe(3); // creator + 2 members

      // Check creator is admin
      const creatorMember = dbMembers.find((m) => m.userId === testUserId);
      expect(creatorMember).toMatchObject({
        userId: testUserId,
        role: "admin",
      });

      // Check member1
      const member1 = dbMembers.find((m) => m.userId === member1Id);
      expect(member1).toMatchObject({
        userId: member1Id,
        role: "member",
      });

      // Check member2
      const member2 = dbMembers.find((m) => m.userId === member2Id);
      expect(member2).toMatchObject({
        userId: member2Id,
        role: "admin",
      });
    });

    it("should filter out duplicate creator from members list", async () => {
      // Arrange
      const member1Id = await testApp.createTestUser({
        email: "member1@example.com",
      });

      const createExperimentDto = {
        name: "Test Duplicate Creator Filter",
        description: "Test Description",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Try to add the creator as a member too (should be filtered out)
      const members = [
        { userId: testUserId, role: "member" as const }, // This should be filtered out
        { userId: member1Id, role: "member" as const },
      ];

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
        members,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiment = result.value;

      // Verify only 2 members: creator as admin + member1
      const dbMembers = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));

      expect(dbMembers.length).toBe(2);

      // Creator should still be admin, not member
      const creatorMember = dbMembers.find((m) => m.userId === testUserId);
      expect(creatorMember).toMatchObject({
        userId: testUserId,
        role: "admin",
      });

      // Member1 should be member
      const member1 = dbMembers.find((m) => m.userId === member1Id);
      expect(member1).toMatchObject({
        userId: member1Id,
        role: "member",
      });
    });

    it("should handle empty members array", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Empty Members",
        description: "Test Description",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
        [],
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiment = result.value;

      // Verify only the creator is added as admin
      const dbMembers = await testApp.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experiment.id));

      expect(dbMembers.length).toBe(1);
      expect(dbMembers[0]).toMatchObject({
        userId: testUserId,
        role: "admin",
      });
    });

    it("should return error for duplicate experiment name", async () => {
      // Arrange
      const experimentName = "Duplicate Name Test";

      // Create first experiment
      await testApp.createExperiment({
        name: experimentName,
        userId: testUserId,
      });

      const createExperimentDto = {
        name: experimentName, // Same name
        description: "Should fail due to duplicate name",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      if (result._tag === "failure") {
        expect(result.error.code).toBe("REPOSITORY_DUPLICATE");
        expect(result.error.message).toContain("already exists");
      }
    });

    it("should return error for empty experiment name", async () => {
      // Arrange
      const createExperimentDto = {
        name: "", // Empty name
        description: "Should fail due to empty name",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      if (result._tag === "failure") {
        expect(result.error.code).toBe("REPOSITORY_ERROR");
        expect(result.error.message).toContain("name");
      }
    });

    it("should return error for whitespace-only experiment name", async () => {
      // Arrange
      const createExperimentDto = {
        name: "   ", // Whitespace only
        description: "Should fail due to whitespace-only name",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      if (result._tag === "failure") {
        expect(result.error.code).toBe("REPOSITORY_ERROR");
        expect(result.error.message).toContain("name");
      }
    });

    it("should return error for invalid user ID in members", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Invalid Member",
        description: "Should fail due to invalid member user ID",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      const members = [
        {
          userId: "00000000-0000-0000-0000-000000000000",
          role: "member" as const,
        }, // Non-existent user
      ];

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
        members,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      if (result._tag === "failure") {
        expect(result.error.code).toBe("REPOSITORY_ERROR");
        expect(result.error.message).toContain("user IDs do not exist");
      }
    });

    it("should rollback transaction if member insertion fails", async () => {
      // Arrange
      const createExperimentDto = {
        name: "Test Transaction Rollback",
        description: "Should rollback if member insertion fails",
        status: "provisioning" as const,
        visibility: "private" as const,
        embargoIntervalDays: 90,
      };

      const members = [
        { userId: "invalid-user-id", role: "member" as const }, // Invalid UUID format
      ];

      // Act
      const result = await repository.createWithMembers(
        createExperimentDto,
        testUserId,
        members,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);

      // Verify no experiment was created (transaction rolled back)
      const experiments = await testApp.database
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.name, createExperimentDto.name));

      expect(experiments.length).toBe(0);
    });
  });
}); // End of describe("ExperimentRepository")
