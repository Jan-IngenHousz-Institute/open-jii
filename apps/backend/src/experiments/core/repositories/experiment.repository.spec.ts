import { experiments as experimentsTable, experimentMembers, eq, and } from "@repo/database";

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
        status: "active" as const,
        visibility: "private" as const,
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

    it("should exclude archived experiments by default when no status is provided", async () => {
      // Arrange
      const userId = await testApp.createTestUser({ email: "exclude-archived@example.com" });
      const { experiment: active } = await testApp.createExperiment({
        name: "Active Experiment Default",
        userId,
        status: "active",
      });

      // Create an archived experiment for the same user
      await testApp.createExperiment({
        name: "Archived Experiment Default",
        userId,
        status: "archived",
      });

      // Act: call findAll without passing a status
      const result = await repository.findAll(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      // Archived experiment should be excluded by default
      expect(experiments.some((e) => e.status === "archived")).toBe(false);
      // Active experiment should be present
      expect(experiments.some((e) => e.id === active.id)).toBe(true);
    });

    it("should return experiments in the correct order", async () => {
      // Arrange
      const { experiment: experiment1 } = await testApp.createExperiment({
        name: "Experiment 1",
        userId: testUserId,
      });
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Experiment 2",
        userId: testUserId,
      });
      const { experiment: experiment3 } = await testApp.createExperiment({
        name: "Experiment 3",
        userId: testUserId,
      });
      const updateData = {
        status: "active" as const,
      };
      await repository.update(experiment2.id, updateData);

      // Act
      const result = await repository.findAll(testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(3);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
          expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
          expect.objectContaining({ id: experiment3.id, name: "Experiment 3" }),
        ]),
      );
    });

    it("should filter experiments by 'member' filter", async () => {
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
      const result = await repository.findAll(mainUserId, "member");

      // Assert
      expect(result.isSuccess()).toBe(true);

      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(ownedExperiment.id);
      expect(experiments[0].name).toBe("My Experiment");
    });

    it("should not return duplicate experiments when user has access to multiple experiments", async () => {
      // Arrange - Test case where a user is a member of multiple experiments
      // Ensures the CTE-based code doesn't cause duplicates
      const mainUserId = await testApp.createTestUser({
        email: "multi-member-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-owner@example.com",
      });

      // Create user's own experiment
      const { experiment: ownedExp } = await testApp.createExperiment({
        name: "My Experiment",
        userId: mainUserId,
      });

      // Create multiple experiments owned by other user
      const { experiment: exp1 } = await testApp.createExperiment({
        name: "Member Experiment 1",
        userId: otherUserId,
      });

      const { experiment: exp2 } = await testApp.createExperiment({
        name: "Member Experiment 2",
        userId: otherUserId,
      });

      const { experiment: exp3 } = await testApp.createExperiment({
        name: "Member Experiment 3",
        userId: otherUserId,
      });

      // Add main user as a member to all other experiments
      await testApp.addExperimentMember(exp1.id, mainUserId, "member");
      await testApp.addExperimentMember(exp2.id, mainUserId, "member");
      await testApp.addExperimentMember(exp3.id, mainUserId, "member");

      // Act - with no filter (should return all experiments user is a member of)
      const result = await repository.findAll(mainUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      // Should return exactly 4 experiments (1 owned + 3 as member), no duplicates
      expect(experiments.length).toBe(4);

      // Verify no duplicate IDs
      const experimentIds = experiments.map((e) => e.id);
      const uniqueIds = new Set(experimentIds);
      expect(uniqueIds.size).toBe(4);

      // Verify all expected experiments are present
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: ownedExp.id }),
          expect.objectContaining({ id: exp1.id }),
          expect.objectContaining({ id: exp2.id }),
          expect.objectContaining({ id: exp3.id }),
        ]),
      );
    });

    it("should not return private experiments where user is not a member (no filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-test@example.com",
      });

      // Create private experiment owned by other user
      await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Create public experiment owned by other user
      const { experiment: publicExp } = await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      // Act - query without filter as mainUser
      const result = await repository.findAll(mainUserId);

      // Assert - should only see public experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(publicExp.id);
      expect(experiments[0].visibility).toBe("public");
    });

    it("should return private experiments where user is a member (no filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-member-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-member-test@example.com",
      });

      // Create private experiment owned by other user
      const { experiment: privateExp } = await testApp.createExperiment({
        name: "Private Member Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Add mainUser as member
      await testApp.addExperimentMember(privateExp.id, mainUserId, "member");

      // Act - query without filter as mainUser
      const result = await repository.findAll(mainUserId);

      // Assert - should see private experiment because user is a member
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(privateExp.id);
      expect(experiments[0].visibility).toBe("private");
    });

    it("should not return private experiments where user is not a member (with member filter)", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "privacy-filter-test@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "other-privacy-filter-test@example.com",
      });

      // Create private experiment owned by other user
      await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Create public experiment owned by other user
      await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      // Act - query with member filter as mainUser
      const result = await repository.findAll(mainUserId, "member");

      // Assert - should see nothing (not a member of any experiments)
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(0);
    });

    it("should exclude archived experiments by default", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-default-test@example.com",
      });

      // Create active experiment
      const { experiment: activeExp } = await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query without status filter
      const result = await repository.findAll(mainUserId);

      // Assert - should only see active experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExp.id);
      expect(experiments[0].status).toBe("active");
    });

    it("should exclude archived experiments even when filtering by other status", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-status-test@example.com",
      });

      // Create active experiment
      const { experiment: activeExp } = await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create stale experiment
      await testApp.createExperiment({
        name: "Stale Experiment",
        userId: mainUserId,
        status: "stale",
      });

      // Create archived experiment
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query with active status filter
      const result = await repository.findAll(mainUserId, undefined, "active");

      // Assert - should only see active experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(activeExp.id);
      expect(experiments[0].status).toBe("active");
    });

    it("should include archived experiments only when explicitly requested", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "archived-explicit-test@example.com",
      });

      // Create active experiment
      await testApp.createExperiment({
        name: "Active Experiment",
        userId: mainUserId,
        status: "active",
      });

      // Create archived experiment
      const { experiment: archivedExp } = await testApp.createExperiment({
        name: "Archived Experiment",
        userId: mainUserId,
        status: "archived",
      });

      // Act - query with archived status filter
      const result = await repository.findAll(mainUserId, undefined, "archived");

      // Assert - should only see archived experiment
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments.length).toBe(1);
      expect(experiments[0].id).toBe(archivedExp.id);
      expect(experiments[0].status).toBe("archived");
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

      // Act - filter by "member" relationship and "active" status
      const result = await repository.findAll(mainUserId, "member", "active");

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
    it("should filter experiments by search term in name", async () => {
      // Arrange
      const userId = await testApp.createTestUser({ email: "search-test@example.com" });
      await testApp.createExperiment({ name: "Alpha Experiment", userId });
      await testApp.createExperiment({ name: "Beta Experiment", userId });
      await testApp.createExperiment({ name: "Gamma", userId });

      // Act
      const result = await repository.findAll(userId, undefined, undefined, "Experiment");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Alpha Experiment" }),
          expect.objectContaining({ name: "Beta Experiment" }),
        ]),
      );
      expect(experiments.some((e) => e.name === "Gamma")).toBe(false);
    });

    it("should filter experiments by search term, relationship, and status together", async () => {
      // Arrange
      const mainUserId = await testApp.createTestUser({
        email: "search-rel-status-repo@example.com",
      });
      const otherUserId = await testApp.createTestUser({
        email: "search-rel-status-repo-other@example.com",
      });

      // Create experiments with unique names and statuses
      await testApp.createExperiment({
        name: "My Searchable Active",
        userId: mainUserId,
        status: "active",
      });
      await testApp.createExperiment({
        name: "My Searchable Archived",
        userId: mainUserId,
        status: "archived",
      });
      await testApp.createExperiment({
        name: "My Unrelated",
        userId: mainUserId,
        status: "active",
      });
      const { experiment: memberExpActive } = await testApp.createExperiment({
        name: "Member Searchable Active",
        userId: otherUserId,
        status: "active",
      });
      const { experiment: memberExpArchived } = await testApp.createExperiment({
        name: "Member Searchable Archived",
        userId: otherUserId,
        status: "archived",
      });
      await testApp.addExperimentMember(memberExpActive.id, mainUserId, "member");
      await testApp.addExperimentMember(memberExpArchived.id, mainUserId, "member");
      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
        status: "active",
      });

      // Act
      const result = await repository.findAll(mainUserId, undefined, "active", "Searchable");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;
      // Should only return 'My Searchable Active' and 'Member Searchable Active' with status 'active'
      expect(experiments.length).toBe(2);
      expect(experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "My Searchable Active", status: "active" }),
          expect.objectContaining({ name: "Member Searchable Active", status: "active" }),
        ]),
      );
      // Should not return archived or unrelated experiments
      expect(
        experiments.some(
          (e) =>
            e.status === "archived" || e.name === "My Unrelated" || e.name === "Other Experiment",
        ),
      ).toBe(false);
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
      const result = await repository.findOne("00000000-0000-0000-0000-000000000000");

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
          and(eq(experimentsTable.id, experiment.id), eq(experimentsTable.createdBy, testUserId)),
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

    it("should set hasArchiveAccess=false for all users when experiment is archived", async () => {
      // Arrange: create an archived experiment
      const { experiment } = await testApp.createExperiment({
        name: "Archive Access Test",
        userId: testUserId,
        status: "archived",
      });

      // Create a member user and add them as a regular member
      const memberId = await testApp.createTestUser({ email: "archive-member@example.com" });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Act: check access for non-admin member
      const memberResult = await repository.checkAccess(experiment.id, memberId);
      expect(memberResult.isSuccess()).toBe(true);
      assertSuccess(memberResult);

      const memberAccess = memberResult.value;
      expect(memberAccess.experiment).toBeTruthy();
      expect(memberAccess.hasAccess).toBe(true);
      expect(memberAccess.isAdmin).toBe(false);
      expect(memberAccess.hasArchiveAccess).toBe(false);

      // Promote to admin directly
      await testApp.database
        .update(experimentMembers)
        .set({ role: "admin" })
        .where(
          and(
            eq(experimentMembers.experimentId, experiment.id),
            eq(experimentMembers.userId, memberId),
          ),
        );

      // Act again: check access for admin
      const adminResult = await repository.checkAccess(experiment.id, memberId);
      expect(adminResult.isSuccess()).toBe(true);
      assertSuccess(adminResult);

      const adminAccess = adminResult.value;
      expect(adminAccess.experiment).toBeTruthy();
      expect(adminAccess.hasAccess).toBe(true);
      expect(adminAccess.isAdmin).toBe(true);
      expect(adminAccess.hasArchiveAccess).toBe(false);
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

  describe("findExpiredEmbargoes", () => {
    it("should return only private experiments whose embargoUntil is in the past", async () => {
      const now = Date.now();

      // private + past (should be returned)
      const { experiment: pastPrivate } = await testApp.createExperiment({
        name: "Past Private",
        userId: testUserId,
        visibility: "private",
        embargoUntil: new Date(now - 60_000), // 1 min ago
      });

      // private + future (should NOT be returned)
      await testApp.createExperiment({
        name: "Future Private",
        userId: testUserId,
        visibility: "private",
        embargoUntil: new Date(now + 60_000),
      });

      // public + past (should NOT be returned)
      await testApp.createExperiment({
        name: "Past Public",
        userId: testUserId,
        visibility: "public",
        embargoUntil: new Date(now - 60_000),
      });

      const result = await repository.findExpiredEmbargoes();

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const experiments = result.value;

      expect(experiments).toHaveLength(1);
      expect(experiments[0].id).toBe(pastPrivate.id);
      expect(experiments[0].visibility).toBe("private");
    });

    // it("should not return experiments whose embargoUntil is exactly now or in the future", async () => {
    //   const nearFuture = new Date(Date.now() + 10);

    //   await testApp.createExperiment({
    //     name: "Boundary Private",
    //     userId: testUserId,
    //     visibility: "private",
    //     embargoUntil: nearFuture,
    //   });

    //   const result = await repository.findExpiredEmbargoes();

    //   expect(result.isSuccess()).toBe(true);
    //   assertSuccess(result);
    //   const experiments = result.value;

    //   expect(experiments.some((e) => e.name === "Boundary Private")).toBe(false);
    // });
  });
});
