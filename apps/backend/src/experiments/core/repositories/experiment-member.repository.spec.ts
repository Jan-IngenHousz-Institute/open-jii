import { StatusCodes } from "http-status-codes";

import { experiments } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentMemberRepository } from "./experiment-member.repository";

describe("ExperimentMemberRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentMemberRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ExperimentMemberRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getMembers", () => {
    it("should return all members of an experiment", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Getting Members",
        userId: testUserId,
      });

      // Create users to add as members
      const memberId1 = await testApp.createTestUser({
        email: "member1@example.com",
        name: "Test1 User",
      });
      const memberId2 = await testApp.createTestUser({
        email: "member2@example.com",
        name: "Test2 User",
      });

      // Add members
      await repository.addMember(experiment.id, memberId1, "member");
      await repository.addMember(experiment.id, memberId2, "admin");

      // Act
      const result = await repository.getMembers(experiment.id);

      expect(result.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result);
      const members = result.value;

      // Assert
      expect(members.length).toBe(3); // Creator + 2 added members
      expect(members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: testUserId, role: "admin" }),
          expect.objectContaining({ userId: memberId1, role: "member" }),
          expect.objectContaining({ userId: memberId2, role: "admin" }),
        ]),
      );

      // Additional assertions for name and email
      const member1 = members.find((m) => m.user.id === memberId1);
      expect(member1).toBeDefined();
      expect(member1?.user.name).toBe("Test1 User");
      expect(member1?.user.email).toBe("member1@example.com");

      const member2 = members.find((m) => m.user.id === memberId2);
      expect(member2).toBeDefined();
      expect(member2?.user.name).toBe("Test2 User");
      expect(member2?.user.email).toBe("member2@example.com");
    });

    it("should return empty array when experiment has no members", async () => {
      // Create a fresh experiment without adding the creator as a member
      const [experiment] = await testApp.database
        .insert(experiments)
        .values({
          name: "Empty Experiment",
          description: "No members",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: testUserId,
        })
        .returning();

      // Act
      const result = await repository.getMembers(experiment.id);

      expect(result.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result);
      const members = result.value;

      // Assert
      expect(members).toEqual([]);
    });
  });

  describe("addMember", () => {
    it("should add a member to an experiment", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Adding Members",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "new-member@example.com",
        name: "New Member",
      });

      // Act
      const result = await repository.addMember(
        experiment.id,
        memberId,
        "member",
      );

      expect(result.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result);
      const members = result.value;
      const member = members[0];

      // Assert
      expect(member).toMatchObject({
        experimentId: experiment.id,
        userId: memberId,
        role: "member",
      });
      // Assert name and email are present and correct
      expect(member.user.name).toBe("New Member");
      expect(member.user.email).toBe("new-member@example.com");

      // Verify member was added by checking the database
      const allMembersResult = await repository.getMembers(experiment.id);
      assertSuccess(allMembersResult);
      const allMembers = allMembersResult.value;
      expect(allMembers.some((m) => m.user.id === memberId)).toBe(true);
    });

    it("should not duplicate membership if already a member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Duplicate Member Test",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "duplicate-member@example.com",
      });

      // Add the member first time
      const result1 = await repository.addMember(
        experiment.id,
        memberId,
        "member",
      );
      expect(result1.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result1);
      const members1 = result1.value;
      const member1 = members1[0];

      // Try to add the same member again with a different role
      const result2 = await repository.addMember(
        member1.experimentId,
        member1.user.id,
        "admin",
      );

      expect(result2.isSuccess()).toBe(false);
      assertFailure(result2);
      expect(result2.error.statusCode).toBe(StatusCodes.BAD_REQUEST);

      // Verify only one membership exists
      const membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      const members = membersResult.value;
      const membershipCount = members.filter(
        (m) => m.user.id === memberId,
      ).length;
      expect(membershipCount).toBe(1);
    });

    it("should use the default role if none is provided", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Default Role Test",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "default-role@example.com",
        name: "Default Role",
      });

      // Add the member without specifying role
      const result = await repository.addMember(experiment.id, memberId);
      expect(result.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result);
      const members = result.value;
      const member = members[0];

      // Assert default role is "member"
      expect(member.role).toBe("member");
      // Assert name and email are present and correct
      expect(member.user.name).toBe("Default Role");
      expect(member.user.email).toBe("default-role@example.com");
    });
  });

  describe("removeMember", () => {
    it("should remove a member from an experiment", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Member Removal",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });

      // Add the member
      await repository.addMember(experiment.id, memberId, "member");

      // Verify member was added
      let membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      let members = membersResult.value;
      expect(members.some((m) => m.user.id === memberId)).toBe(true);

      // Act: Remove the member
      const removeResult = await repository.removeMember(
        experiment.id,
        memberId,
      );
      expect(removeResult.isSuccess()).toBe(true);

      // Verify member was removed
      membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      members = membersResult.value;
      expect(members.some((m) => m.user.id === memberId)).toBe(false);
    });

    it("should not fail when removing a non-existent member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Non-existent Member Test",
        userId: testUserId,
      });

      // Generate a random UUID for a non-existent user
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Act & Assert: Should not throw error
      const result = await repository.removeMember(
        experiment.id,
        nonExistentId,
      );
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("getMemberRole", () => {
    it("should return the role of a member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Role Test Experiment",
        userId: testUserId,
      });

      // Create users to add with different roles
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      // Add members with different roles
      await repository.addMember(experiment.id, adminId, "admin");
      await repository.addMember(experiment.id, memberId, "member");

      // Act & Assert
      const adminRoleResult = await repository.getMemberRole(
        experiment.id,
        adminId,
      );
      expect(adminRoleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(adminRoleResult);
      const adminRole = adminRoleResult.value;
      expect(adminRole).toBe("admin");

      const memberRoleResult = await repository.getMemberRole(
        experiment.id,
        memberId,
      );
      expect(memberRoleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(memberRoleResult);
      const memberRole = memberRoleResult.value;
      expect(memberRole).toBe("member");

      // Also verify the creator's role
      const creatorRoleResult = await repository.getMemberRole(
        experiment.id,
        testUserId,
      );
      expect(creatorRoleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(creatorRoleResult);
      const creatorRole = creatorRoleResult.value;
      expect(creatorRole).toBe("admin");
    });

    it("should return null for non-members", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Non-member Test",
        userId: testUserId,
      });

      // Create a user but don't add them to the experiment
      const nonMemberId = await testApp.createTestUser({
        email: "non-member@example.com",
      });

      // Act
      const roleResult = await repository.getMemberRole(
        experiment.id,
        nonMemberId,
      );
      expect(roleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(roleResult);
      const role = roleResult.value;

      // Assert
      expect(role).toBeNull();
    });

    it("should return null for non-existent experiment", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Act
      const roleResult = await repository.getMemberRole(
        nonExistentId,
        testUserId,
      );
      expect(roleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(roleResult);
      const role = roleResult.value;

      // Assert
      expect(role).toBeNull();
    });
  });
});
