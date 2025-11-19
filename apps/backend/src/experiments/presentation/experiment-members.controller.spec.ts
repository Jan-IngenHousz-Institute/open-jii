import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse, ExperimentMemberList } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import type { UserDto } from "../../users/core/models/user.model";
import type { EmailPort } from "../core/ports/email.port";
import { EMAIL_PORT } from "../core/ports/email.port";

describe("ExperimentMembersController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let emailPort: EmailPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listExperimentMembers", () => {
    it("should return all members of an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Members List",
        userId: testUserId,
      });
      // By default, creator is an admin member

      // Add another member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Get the list path
      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

      // Request the members list
      const response: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
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
              id: memberId,
            }) as Partial<UserDto>,
          }),
        ]),
      );
    });
    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Members List",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("addExperimentMember", () => {
    it("should add a new member to an experiment", async () => {
      // Create an experiment first
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Adding Members",
        userId: testUserId,
      });

      // Create a user to be added as member
      const newMemberId = await testApp.createTestUser({
        email: "new-member@example.com",
      });

      // Mock email sending
      emailPort = testApp.module.get(EMAIL_PORT);
      vi.spyOn(emailPort, "sendAddedUserNotification").mockResolvedValue(success(undefined));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      // Create the member data
      const memberData = { members: [{ userId: newMemberId, role: "member" }] };

      // Send the request
      const response: SuperTestResponse<ExperimentMemberList> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(memberData)
        .expect(StatusCodes.CREATED);

      // Assert the response
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        role: "member",
        experimentId: experiment.id,
        user: expect.objectContaining({
          id: newMemberId,
        }) as Partial<UserDto>,
      });

      // Verify with a list request
      const listPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

      const listResponse = await testApp.get(listPath).withAuth(testUserId).expect(StatusCodes.OK);

      expect(listResponse.body).toHaveLength(2);
      expect(listResponse.body).toEqual(
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
              id: newMemberId,
            }) as Partial<UserDto>,
          }),
        ]),
      );
    });

    it("should return 404 when adding member to non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: nonExistentId,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ members: [{ userId: memberId, role: "member" }] })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid member data", async () => {
      // Create an experiment first
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Member Data",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      // Missing userId
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ role: "member" })
        .expect(StatusCodes.BAD_REQUEST);

      // Invalid role
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ userId: faker.string.uuid(), role: "invalid-role" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when adding a member that already exists", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Duplicate Members",
        userId: testUserId,
      });

      // Create a user to be added as member
      const memberId = await testApp.createTestUser({
        email: "duplicate-member@example.com",
      });

      // Add the member first time
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Try to add the same member again
      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ userId: memberId, role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when adding self as a member when already an admin", async () => {
      // Create an experiment - creator is already an admin
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Self Addition",
        userId: testUserId,
      });

      // Try to add self again
      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ userId: testUserId, role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Adding Members",
        userId: testUserId,
      });

      const newMemberId = await testApp.createTestUser({
        email: "new-member@example.com",
      });

      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      const memberData = { userId: newMemberId, role: "member" };

      await testApp.post(path).withoutAuth().send(memberData).expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("removeExperimentMember", () => {
    it("should remove a member from an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Removing Members",
        userId: testUserId,
      });

      // Add a member
      const memberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Verify there are 2 members
      const listPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });
      let listResponse: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(listPath)
        .withAuth(testUserId);

      expect(listResponse.body).toHaveLength(2);

      // Remove the member
      const removePath = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp.delete(removePath).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify the member was removed
      listResponse = await testApp.get(listPath).withAuth(testUserId);
      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].user.id).toBe(testUserId);
    });

    it("should return 404 when removing member from non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: nonExistentId,
        memberId: memberId,
      });

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 404 when member doesn't exist in experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Member Not Found",
        userId: testUserId,
      });

      // Use a non-existent member ID
      const nonExistentMemberId = faker.string.uuid();

      const path = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: nonExistentMemberId,
      });

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUIDs", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: invalidId,
        memberId: "also-not-a-uuid",
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);

      // Invalid member ID
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Member ID",
        userId: testUserId,
      });

      const pathWithInvalidMember = testApp.resolvePath(
        contract.experiments.removeExperimentMember.path,
        {
          id: experiment.id,
          memberId: "not-a-valid-uuid",
        },
      );

      await testApp
        .delete(pathWithInvalidMember)
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when removing the last admin", async () => {
      // Create an experiment - creator is the only admin
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Last Admin Removal",
        userId: testUserId,
      });

      // Attempt to remove self (the only admin)
      const path = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: testUserId,
      });

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Cannot remove the last admin");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Removing Members",
        userId: testUserId,
      });

      const memberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const removePath = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp.delete(removePath).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateExperimentMemberRole", () => {
    it("should update a member's role from member to admin", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Role Update",
        userId: testUserId,
      });

      // Add a regular member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Update the member's role to admin
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: memberId,
      });

      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toMatchObject({
        role: "admin",
        experimentId: experiment.id,
        user: expect.objectContaining({
          id: memberId,
        }) as Partial<UserDto>,
      });

      // Verify with a list request
      const listPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

      const listResponse: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(listPath)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      const updatedMember = listResponse.body.find((m) => m.user.id === memberId);
      expect(updatedMember?.role).toBe("admin");
    });

    it("should update a member's role from admin to member", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Admin Demotion",
        userId: testUserId,
      });

      // Add another admin (so we have 2 admins)
      const adminId = await testApp.createTestUser({
        email: "admin@example.com",
      });
      await testApp.addExperimentMember(experiment.id, adminId, "admin");

      // Demote the admin to member
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: adminId,
      });

      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "member" })
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toMatchObject({
        role: "member",
        experimentId: experiment.id,
        user: expect.objectContaining({
          id: adminId,
        }) as Partial<UserDto>,
      });
    });

    it("should return 404 when updating role in non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: nonExistentId,
        memberId: memberId,
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid role value", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Role",
        userId: testUserId,
      });

      // Add a member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: memberId,
      });

      // Invalid role
      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "invalid-role" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 for invalid UUIDs", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: invalidId,
        memberId: "also-not-a-uuid",
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.BAD_REQUEST);

      // Invalid member ID
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Member ID",
        userId: testUserId,
      });

      const pathWithInvalidMember = testApp.resolvePath(
        contract.experiments.updateExperimentMemberRole.path,
        {
          id: experiment.id,
          memberId: "not-a-valid-uuid",
        },
      );

      await testApp
        .patch(pathWithInvalidMember)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when demoting the last admin", async () => {
      // Create an experiment - creator is the only admin
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Last Admin Demotion",
        userId: testUserId,
      });

      // Attempt to demote self (the only admin)
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: testUserId,
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "member" })
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Cannot demote the last admin of the experiment");
        });
    });

    it("should return 403 when non-admin tries to update role", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Non-Admin Update",
        userId: testUserId,
      });

      // Add a regular member who will try to update roles
      const nonAdminId = await testApp.createTestUser({
        email: "nonadmin@example.com",
      });
      await testApp.addExperimentMember(experiment.id, nonAdminId, "member");

      // Add another member to update
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Try to update role as non-admin
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp
        .patch(path)
        .withAuth(nonAdminId)
        .send({ role: "admin" })
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Only admins can update member roles");
        });
    });

    it("should return 403 when updating role in archived experiment", async () => {
      // Create an archived experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Archived Experiment",
        userId: testUserId,
        status: "archived",
      });

      // Add a member
      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Try to update role
      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ role: "admin" })
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Cannot update member roles in archived experiments");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Role Update",
        userId: testUserId,
      });

      const memberId = await testApp.createTestUser({
        email: "member@example.com",
      });
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const path = testApp.resolvePath(contract.experiments.updateExperimentMemberRole.path, {
        id: experiment.id,
        memberId: memberId,
      });

      await testApp
        .patch(path)
        .withoutAuth()
        .send({ role: "admin" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
