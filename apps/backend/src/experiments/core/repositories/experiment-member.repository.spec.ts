import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { experiments } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { UserDto } from "../../../users/core/models/user.model";
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
      await repository.addMembers(experiment.id, [
        { userId: memberId1, role: "member" },
        { userId: memberId2, role: "admin" },
      ]);

      // Act
      const result = await repository.getMembers(experiment.id);

      expect(result.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(result);
      const members = result.value;

      // Assert length
      expect(members.length).toBe(3); // Creator + 2 added members
      expect(members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "admin",
            user: expect.objectContaining({
              id: testUserId,
            }) as Partial<UserDto>,
          }),
          expect.objectContaining({
            role: "member",
            user: expect.objectContaining({
              id: memberId1,
            }) as Partial<UserDto>,
          }),
          expect.objectContaining({
            role: "admin",
            user: expect.objectContaining({
              id: memberId2,
            }) as Partial<UserDto>,
          }),
        ]),
      );

      // Assert user info for each member
      const member1 = members.find((m) => m.user.id === memberId1);
      expect(member1).toBeDefined();
      expect(member1?.user.firstName).toBe("Test1");
      expect(member1?.user.lastName).toBe("User");
      expect(member1?.user.email).toBe("member1@example.com");

      const member2 = members.find((m) => m.user.id === memberId2);
      expect(member2).toBeDefined();
      expect(member2?.user.firstName).toBe("Test2");
      expect(member2?.user.lastName).toBe("User");
      expect(member2?.user.email).toBe("member2@example.com");
    });

    it("should return empty array when experiment has no members", async () => {
      // Create a fresh experiment without adding the creator as a member
      const [experiment] = await testApp.database
        .insert(experiments)
        .values({
          name: "Empty Experiment",
          description: "No members",
          status: "active",
          visibility: "private",
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

  describe("anonymization", () => {
    it("should return real name and email for activated users", async () => {
      const activeUserId = await testApp.createTestUser({
        name: "Active User",
        email: "active@example.com",
        activated: true,
      });

      const { experiment } = await testApp.createExperiment({
        name: "Anonymization Test Active",
        userId: testUserId,
      });

      await repository.addMembers(experiment.id, [{ userId: activeUserId, role: "member" }]);

      const result = await repository.getMembers(experiment.id);
      assertSuccess(result);

      const member = result.value.find((m) => m.user.id === activeUserId);
      expect(member).toBeDefined();
      expect(member?.user.firstName).toBe("Active");
      expect(member?.user.lastName).toBe("User");
      expect(member?.user.email).toBe("active@example.com");
    });

    it("should anonymize name and email for deactivated users", async () => {
      const inactiveUserId = await testApp.createTestUser({
        name: "Hidden User",
        email: "hidden@example.com",
        activated: false,
      });

      const { experiment } = await testApp.createExperiment({
        name: "Anonymization Test Inactive",
        userId: testUserId,
      });

      await repository.addMembers(experiment.id, [{ userId: inactiveUserId, role: "member" }]);

      const result = await repository.getMembers(experiment.id);
      assertSuccess(result);

      const member = result.value.find((m) => m.user.id === inactiveUserId);
      expect(member).toBeDefined();
      expect(member?.user.firstName).toBe("Unknown");
      expect(member?.user.lastName).toBe("User");
      expect(member?.user.email).toBeNull();
    });
  });

  describe("addMembers", () => {
    it("should add multiple members to an experiment", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Adding Multiple Members",
        userId: testUserId,
      });

      // Create users to add as members
      const memberId1 = await testApp.createTestUser({
        email: "multi1@example.com",
        name: "Multi User 1",
      });
      const memberId2 = await testApp.createTestUser({
        email: "multi2@example.com",
        name: "Multi User 2",
      });

      // Act
      const result = await repository.addMembers(experiment.id, [
        { userId: memberId1, role: "member" },
        { userId: memberId2, role: "admin" },
      ]);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;

      // Find the specific member instead of assuming array order
      const member1 = members.find((m) => m.user.id === memberId1);
      const member2 = members.find((m) => m.user.id === memberId2);

      // Assert member1
      expect(member1).toMatchObject({
        experimentId: experiment.id,
        role: "member",
        user: expect.objectContaining({
          id: memberId1,
        }) as Partial<UserDto>,
      });
      expect(member1?.user.firstName).toBe("Multi");
      expect(member1?.user.lastName).toBe("User 1");
      expect(member1?.user.email).toBe("multi1@example.com");

      // Assert member2
      expect(member2).toMatchObject({
        experimentId: experiment.id,
        role: "admin",
        user: expect.objectContaining({
          id: memberId2,
        }) as Partial<UserDto>,
      });
      expect(member2?.user.firstName).toBe("Multi");
      expect(member2?.user.lastName).toBe("User 2");
      expect(member2?.user.email).toBe("multi2@example.com");

      // Verify all members are present in the experiment
      const allMembersResult = await repository.getMembers(experiment.id);
      assertSuccess(allMembersResult);
      const allMembers = allMembersResult.value;
      expect(allMembers.some((m) => m.user.id === memberId1)).toBe(true);
      expect(allMembers.some((m) => m.user.id === memberId2)).toBe(true);
    });

    it("should not duplicate memberships if already a member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Duplicate Members Batch Test",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "batch-duplicate@example.com",
      });

      // Add the member first time
      const result1 = await repository.addMembers(experiment.id, [
        { userId: memberId, role: "member" },
      ]);
      expect(result1.isSuccess()).toBe(true);
      assertSuccess(result1);
      const members1 = result1.value;
      expect(members1.length).toBe(1);

      // Try to add the same member again with a different role
      const result2 = await repository.addMembers(experiment.id, [
        { userId: memberId, role: "admin" },
      ]);
      expect(result2.isSuccess()).toBe(false);
      assertFailure(result2);
      expect(result2.error.statusCode).toBe(StatusCodes.BAD_REQUEST);

      // Verify only one membership exists
      const membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      const members = membersResult.value;
      const membershipCount = members.filter((m) => m.user.id === memberId).length;
      expect(membershipCount).toBe(1);
    });

    it("should use the default role if none is provided for some members", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Default Role Batch Test",
        userId: testUserId,
      });

      // Create users to add as members
      const memberId1 = await testApp.createTestUser({
        email: "batch-default1@example.com",
        name: "Batch Default 1",
      });
      const memberId2 = await testApp.createTestUser({
        email: "batch-default2@example.com",
        name: "Batch Default 2",
      });

      // Add the members, omitting role for one
      const result = await repository.addMembers(experiment.id, [
        { userId: memberId1 },
        { userId: memberId2, role: "admin" },
      ]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;
      const member1 = members.find((m) => m.user.id === memberId1);
      const member2 = members.find((m) => m.user.id === memberId2);
      expect(member1?.role).toBe("member");
      expect(member2?.role).toBe("admin");
      expect(member1?.user.firstName).toBe("Batch");
      expect(member1?.user.lastName).toBe("Default 1");
      expect(member2?.user.firstName).toBe("Batch");
      expect(member2?.user.lastName).toBe("Default 2");
    });

    it("should return empty array and not fail if members array is empty", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Empty Members Array Test",
        userId: testUserId,
      });

      // Act
      const result = await repository.addMembers(experiment.id, []);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should add a single member to an experiment (single-member batch)", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Adding Single Member (Batch)",
        userId: testUserId,
      });

      const dummyUser = {
        firstName: "Single",
        lastName: "Batch Member",
        email: "single-batch@example.com",
      };

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: dummyUser.email,
        name: `${dummyUser.firstName} ${dummyUser.lastName}`,
      });

      // Act
      const result = await repository.addMembers(experiment.id, [
        { userId: memberId, role: "member" },
      ]);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;
      const member = members[0];

      // Assert
      expect(member).toMatchObject({
        experimentId: experiment.id,
        role: "member",
        user: {
          id: memberId,
          firstName: dummyUser.firstName,
          lastName: dummyUser.lastName,
          email: dummyUser.email,
        },
      });

      // Verify member was added by checking the database
      const allMembersResult = await repository.getMembers(experiment.id);
      assertSuccess(allMembersResult);
      const allMembers = allMembersResult.value;
      expect(allMembers.some((m) => m.user.id === memberId)).toBe(true);
    });

    it("should use the default role if none is provided (single-member batch)", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Default Role Single Batch Test",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "default-role-batch@example.com",
        name: "Default Role Batch",
      });

      // Add the member without specifying role
      const result = await repository.addMembers(experiment.id, [{ userId: memberId }]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;
      const member = members[0];

      // Assert default role is "member"
      expect(member.role).toBe("member");
      // Assert name and email are present and correct
      expect(member.user.firstName).toBe("Default");
      expect(member.user.lastName).toBe("Role Batch");
      expect(member.user.email).toBe("default-role-batch@example.com");
    });
  });

  describe("findUserFullNameFromProfile", () => {
    it("should find minimum user profile by user id", async () => {
      // Arrange
      const userEmail = faker.internet.email();
      const userId = await testApp.createTestUser({
        email: userEmail,
        name: "First Last",
      });

      // Act
      const result = await repository.findUserFullNameFromProfile(userId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const profile = result.value;
      expect(profile).not.toBeNull();
      expect(profile?.firstName).toBe("First");
      expect(profile?.lastName).toBe("Last");
    });

    it("should return null if profile not found", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Act
      const result = await repository.findUserFullNameFromProfile(nonExistentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
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
      await repository.addMembers(experiment.id, [{ userId: memberId, role: "member" }]);

      // Verify member was added
      let membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      let members = membersResult.value;
      expect(members.some((m) => m.user.id === memberId)).toBe(true);

      // Act: Remove the member
      const removeResult = await repository.removeMember(experiment.id, memberId);
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
      const result = await repository.removeMember(experiment.id, nonExistentId);
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("getMemberRole", () => {
    it("should return the correct role for a member", async () => {
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
      await repository.addMembers(experiment.id, [
        { userId: adminId, role: "admin" },
        { userId: memberId, role: "member" },
      ]);

      // Act & Assert
      const adminRoleResult = await repository.getMemberRole(experiment.id, adminId);
      expect(adminRoleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(adminRoleResult);
      const adminRole = adminRoleResult.value;
      expect(adminRole).toBe("admin");

      const memberRoleResult = await repository.getMemberRole(experiment.id, memberId);
      expect(memberRoleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(memberRoleResult);
      const memberRole = memberRoleResult.value;
      expect(memberRole).toBe("member");

      // Also verify the creator's role
      const creatorRoleResult = await repository.getMemberRole(experiment.id, testUserId);
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
      const roleResult = await repository.getMemberRole(experiment.id, nonMemberId);
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
      const roleResult = await repository.getMemberRole(nonExistentId, testUserId);
      expect(roleResult.isSuccess()).toBe(true);

      // Use assertSuccess to directly access the value
      assertSuccess(roleResult);
      const role = roleResult.value;

      // Assert
      expect(role).toBeNull();
    });
  });

  describe("addMembers", () => {
    it("should add multiple members to an experiment", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Adding Multiple Members",
        userId: testUserId,
      });

      // Create users to add as members
      const memberId1 = await testApp.createTestUser({
        email: "multi1@example.com",
        name: "Multi User 1",
      });
      const memberId2 = await testApp.createTestUser({
        email: "multi2@example.com",
        name: "Multi User 2",
      });

      // Act
      const result = await repository.addMembers(experiment.id, [
        { userId: memberId1, role: "member" },
        { userId: memberId2, role: "admin" },
      ]);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;
      expect(members.length).toBe(2);
      const memberMap = members.reduce<Record<string, string>>((acc, m) => {
        acc[m.user.id] = m.role;
        return acc;
      }, {});
      expect(memberMap).toMatchObject({
        [memberId1]: "member",
        [memberId2]: "admin",
      });

      // Verify all members are present in the experiment
      const allMembersResult = await repository.getMembers(experiment.id);
      assertSuccess(allMembersResult);
      const allMembers = allMembersResult.value;
      expect(allMembers.some((m) => m.user.id === memberId1)).toBe(true);
      expect(allMembers.some((m) => m.user.id === memberId2)).toBe(true);
    });

    it("should not duplicate memberships if already a member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Experiment for Duplicate Members Batch Test",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "batch-duplicate@example.com",
      });

      // Add the member first time
      const result1 = await repository.addMembers(experiment.id, [
        { userId: memberId, role: "member" },
      ]);
      expect(result1.isSuccess()).toBe(true);
      assertSuccess(result1);
      const members1 = result1.value;
      expect(members1.length).toBe(1);

      // Try to add the same member again with a different role
      const result2 = await repository.addMembers(experiment.id, [
        { userId: memberId, role: "admin" },
      ]);
      expect(result2.isSuccess()).toBe(false);
      assertFailure(result2);
      expect(result2.error.statusCode).toBe(StatusCodes.BAD_REQUEST);

      // Verify only one membership exists
      const membersResult = await repository.getMembers(experiment.id);
      assertSuccess(membersResult);
      const members = membersResult.value;
      const membershipCount = members.filter((m) => m.user.id === memberId).length;
      expect(membershipCount).toBe(1);
    });

    it("should use the default role if none is provided for some members", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Default Role Batch Test",
        userId: testUserId,
      });

      // Create users to add as members
      const memberId1 = await testApp.createTestUser({
        email: "batch-default1@example.com",
        name: "Batch Default 1",
      });
      const memberId2 = await testApp.createTestUser({
        email: "batch-default2@example.com",
        name: "Batch Default 2",
      });

      // Add the members, omitting role for one
      const result = await repository.addMembers(experiment.id, [
        { userId: memberId1 },
        { userId: memberId2, role: "admin" },
      ]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const members = result.value;
      const member1 = members.find((m) => m.user.id === memberId1);
      const member2 = members.find((m) => m.user.id === memberId2);
      expect(member1?.role).toBe("member");
      expect(member2?.role).toBe("admin");
      expect(member1?.user.firstName).toBe("Batch");
      expect(member1?.user.lastName).toBe("Default 1");
      expect(member2?.user.firstName).toBe("Batch");
      expect(member2?.user.lastName).toBe("Default 2");
    });

    it("should return empty array and not fail if members array is empty", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Empty Members Array Test",
        userId: testUserId,
      });

      // Act
      const result = await repository.addMembers(experiment.id, []);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("getAdminCount", () => {
    it("should return the correct count of admins", async () => {
      // Create experiment (creator is admin)
      const { experiment } = await testApp.createExperiment({
        name: "Admin Count Test",
        userId: testUserId,
      });

      // Initially should have 1 admin (the creator)
      let result = await repository.getAdminCount(experiment.id);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(1);

      // Add a regular member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await repository.addMembers(experiment.id, [{ userId: memberId, role: "member" }]);

      // Should still have 1 admin
      result = await repository.getAdminCount(experiment.id);
      assertSuccess(result);
      expect(result.value).toBe(1);

      // Add another admin
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });
      await repository.addMembers(experiment.id, [{ userId: adminId, role: "admin" }]);

      // Should now have 2 admins
      result = await repository.getAdminCount(experiment.id);
      assertSuccess(result);
      expect(result.value).toBe(2);
    });

    it("should return 0 when experiment has no admins", async () => {
      // Create a fresh experiment without members
      const [experiment] = await testApp.database
        .insert(experiments)
        .values({
          name: "No Admins Experiment",
          description: "No members",
          status: "provisioning",
          visibility: "private",
          createdBy: testUserId,
        })
        .returning();

      // Act
      const result = await repository.getAdminCount(experiment.id);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(0);
    });
  });

  describe("updateMemberRole", () => {
    it("should update a member's role from member to admin", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Update Role Test",
        userId: testUserId,
      });

      // Add a regular member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
        name: "Test Member",
      });
      await repository.addMembers(experiment.id, [{ userId: memberId, role: "member" }]);

      // Update to admin
      const result = await repository.updateMemberRole(experiment.id, memberId, "admin");
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const updatedMember = result.value;
      expect(updatedMember.role).toBe("admin");
      expect(updatedMember.user.id).toBe(memberId);
      expect(updatedMember.experimentId).toBe(experiment.id);
      expect(updatedMember.user.firstName).toBe("Test");
      expect(updatedMember.user.lastName).toBe("Member");
      expect(updatedMember.user.email).toBe("member@example.com");

      // Verify the role was actually updated
      const roleResult = await repository.getMemberRole(experiment.id, memberId);
      assertSuccess(roleResult);
      expect(roleResult.value).toBe("admin");
    });

    it("should update a member's role from admin to member", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "Demote Admin Test",
        userId: testUserId,
      });

      // Add an admin
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
        name: "Test Admin",
      });
      await repository.addMembers(experiment.id, [{ userId: adminId, role: "admin" }]);

      // Update to member
      const result = await repository.updateMemberRole(experiment.id, adminId, "member");
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const updatedMember = result.value;
      expect(updatedMember.role).toBe("member");
      expect(updatedMember.user.id).toBe(adminId);

      // Verify the role was actually updated
      const roleResult = await repository.getMemberRole(experiment.id, adminId);
      assertSuccess(roleResult);
      expect(roleResult.value).toBe("member");
    });

    it("should return member with complete user information", async () => {
      // Create experiment
      const { experiment } = await testApp.createExperiment({
        name: "User Info Test",
        userId: testUserId,
      });

      // Add a member with complete info
      const memberId = await testApp.createTestUser({
        email: "complete@example.com",
        name: "Complete User",
      });
      await repository.addMembers(experiment.id, [{ userId: memberId, role: "member" }]);

      // Update role
      const result = await repository.updateMemberRole(experiment.id, memberId, "admin");
      assertSuccess(result);

      const updatedMember = result.value;
      expect(updatedMember.user).toEqual({
        id: memberId,
        firstName: "Complete",
        lastName: "User",
        email: "complete@example.com",
      });
    });
  });
});
