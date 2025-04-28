import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../test/test-harness";

describe("ExperimentMembersController", () => {
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
      const path = testApp.resolvePath(contract.listExperimentMembers.path, {
        id: experiment.id,
      });

      // Request the members list
      const response = await testApp
        .get(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: testUserId,
            role: "admin",
          }),
          expect.objectContaining({
            userId: memberId,
            role: "member",
          }),
        ]),
      );
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.listExperimentMembers.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-valid-uuid";
      const path = testApp.resolvePath(contract.listExperimentMembers.path, {
        id: invalidId,
      });

      await testApp
        .get(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("addExperimentMember", () => {
    it("should add a new member to an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Adding Member",
        userId: testUserId,
      });

      // Create a user to add as member
      const newMemberId = await testApp.createTestUser({
        email: "new-member@example.com",
      });

      // Define the path and data
      const path = testApp.resolvePath(contract.addExperimentMember.path, {
        id: experiment.id,
      });
      const memberData = { userId: newMemberId, role: "member" };

      // Make the request
      const response = await testApp
        .post(path)
        .query({ userId: testUserId })
        .send(memberData)
        .expect(StatusCodes.CREATED);

      // Assert the response
      expect(response.body).toMatchObject({
        experimentId: experiment.id,
        userId: newMemberId,
        role: "member",
      });

      // Verify the member was added in the database
      const listPath = testApp.resolvePath(
        contract.listExperimentMembers.path,
        { id: experiment.id },
      );
      const listResponse = await testApp
        .get(listPath)
        .query({ userId: testUserId });

      expect(listResponse.body).toHaveLength(2); // Creator + new member
      expect(listResponse.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: newMemberId, role: "member" }),
        ]),
      );
    });

    it("should return 404 when adding member to non-existent experiment", async () => {
      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "nonexistent-exp-member@example.com",
      });

      // Use a non-existent experiment ID
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.addExperimentMember.path, {
        id: nonExistentId,
      });

      // Make the request
      await testApp
        .post(path)
        .query({ userId: testUserId })
        .send({ userId: memberId, role: "member" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid member data", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Member",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.addExperimentMember.path, {
        id: experiment.id,
      });

      // Missing userId
      await testApp
        .post(path)
        .send({ role: "member" })
        .expect(StatusCodes.BAD_REQUEST);

      // Invalid role
      await testApp
        .post(path)
        .send({ userId: faker.string.uuid(), role: "invalid-role" })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("removeExperimentMember", () => {
    it("should remove a member from an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Removing Member",
        userId: testUserId,
      });

      // Create a user to add as member
      const memberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });

      // Add the member
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      // Verify member was added
      const listPath = testApp.resolvePath(
        contract.listExperimentMembers.path,
        { id: experiment.id },
      );
      let listResponse = await testApp
        .get(listPath)
        .query({ userId: testUserId });

      expect(listResponse.body).toHaveLength(2);

      // Remove the member
      const removePath = testApp.resolvePath(
        contract.removeExperimentMember.path,
        {
          id: experiment.id,
          memberId: memberId,
        },
      );

      await testApp
        .delete(removePath)
        .query({ userId: testUserId })
        .expect(StatusCodes.NO_CONTENT);

      // Verify member was removed
      listResponse = await testApp.get(listPath).query({ userId: testUserId });
      expect(listResponse.body).toHaveLength(1); // Only creator remains
      expect(listResponse.body[0].userId).toBe(testUserId);
    });

    it("should return 404 when removing member from non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const memberId = faker.string.uuid();

      const path = testApp.resolvePath(contract.removeExperimentMember.path, {
        id: nonExistentId,
        memberId: memberId,
      });

      await testApp
        .delete(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 404 when member doesn't exist in experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Non-existent Member",
        userId: testUserId,
      });

      // Use a non-existent member ID
      const nonExistentMemberId = faker.string.uuid();

      const path = testApp.resolvePath(contract.removeExperimentMember.path, {
        id: experiment.id,
        memberId: nonExistentMemberId,
      });

      await testApp
        .delete(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUIDs", async () => {
      // Invalid experiment ID
      let path = testApp.resolvePath(contract.removeExperimentMember.path, {
        id: "invalid-experiment-id",
        memberId: faker.string.uuid(),
      });

      await testApp
        .delete(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.BAD_REQUEST);

      // Invalid member ID
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Member ID",
        userId: testUserId,
      });

      path = testApp.resolvePath(contract.removeExperimentMember.path, {
        id: experiment.id,
        memberId: "invalid-member-id",
      });

      await testApp
        .delete(path)
        .query({ userId: testUserId })
        .expect(StatusCodes.BAD_REQUEST);
    });

    // it("should handle authorization correctly when removing members", async () => {
    //   // Create an experiment with the test user
    //   const { experiment } = await testApp.createExperiment({
    //     name: "Test Experiment for Auth Check",
    //     userId: testUserId,
    //   });

    //   // Create another user
    //   const otherUserId = await testApp.createTestUser({
    //     email: "other-user@example.com",
    //   });

    //   // Add that user as a member
    //   await testApp.addExperimentMember(experiment.id, otherUserId, "member");

    //   // Create a third user who is not related to the experiment
    //   const unauthorizedUserId = await testApp.createTestUser({
    //     email: "unauthorized@example.com",
    //   });

    //   // Try to remove a member without permission
    //   const removePath = testApp.resolvePath(
    //     contract.removeExperimentMember.path,
    //     {
    //       id: experiment.id,
    //       memberId: otherUserId,
    //     },
    //   );

    //   await testApp
    //     .delete(removePath)
    //     .query({ userId: unauthorizedUserId })
    //     .expect(StatusCodes.FORBIDDEN);
    // });
  });
});
