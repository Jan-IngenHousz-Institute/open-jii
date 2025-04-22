import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../test/test-harness";

describe("ExperimentController", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createExperiment", () => {
    it("should successfully create an experiment", async () => {
      const experimentData = {
        name: "Test Experiment",
        description: "Test Description",
        status: "provisioning",
        visibility: "private",
        embargoIntervalDays: 90,
      };

      const response = await testApp
        .post(contract.createExperiment.path)
        .send(experimentData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        name: experimentData.name,
        description: experimentData.description,
        status: experimentData.status,
        visibility: experimentData.visibility,
        embargoIntervalDays: experimentData.embargoIntervalDays,
        createdBy: testApp.testUserId,
      });
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(contract.createExperiment.path)
        .send({
          description: "Missing name",
          status: "provisioning",
          visibility: "private",
        })
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }) => {
          expect(body.message).toContain("name");
        });
    });
  });

  describe("listExperiments", () => {
    it("should return an empty array if no experiments exist", async () => {
      const response = await testApp
        .get(contract.listExperiments.path)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return a list of experiments", async () => {
      // Create some experiments first
      const experiment1 = await testApp.createExperiment({
        name: "Experiment 1",
      });
      const experiment2 = await testApp.createExperiment({
        name: "Experiment 2",
      });

      const response = await testApp
        .get(contract.listExperiments.path)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
          expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
        ]),
      );
    });

    it("should filter experiments correctly with 'my' filter", async () => {
      // Create an experiment owned by test user
      const ownedExperiment = await testApp.createExperiment({
        name: "My Experiment",
      });

      // Create an experiment with a different user
      const otherUserId = await testApp.createTestUser("other@example.com");
      testApp.testUserId = otherUserId;
      const otherExperiment = await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
      });

      // Reset to original test user
      await testApp.createTestUser();

      const response = await testApp
        .get(contract.listExperiments.path)
        .query({ filter: "my" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(ownedExperiment.id);
      expect(response.body[0].name).toBe("My Experiment");
    });
  });

  describe("getExperiment", () => {
    it("should return an experiment by ID", async () => {
      const experiment = await testApp.createExperiment({
        name: "Experiment to Get",
        description: "Detailed description",
      });

      const path = testApp.resolvePath(contract.getExperiment.path, {
        id: experiment.id,
      });

      const response = await testApp.get(path).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        visibility: experiment.visibility,
        createdBy: testApp.testUserId,
      });
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.getExperiment.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(contract.getExperiment.path, {
        id: invalidId,
      });

      await testApp
        .get(path)
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }) => {
          expect(body.message).toContain("Invalid UUID format");
        });
    });
  });

  describe("updateExperiment", () => {
    it("should update an experiment successfully", async () => {
      const experiment = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "provisioning",
      });

      const path = testApp.resolvePath(contract.updateExperiment.path, {
        id: experiment.id,
      });

      const response = await testApp
        .patch(path)
        .send({ name: "Updated Name", status: "active" })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: experiment.id,
        name: "Updated Name",
        status: "active",
      });
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.updateExperiment.path, {
        id: nonExistentId,
      });

      await testApp
        .patch(path)
        .send({ name: "Won't Update" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });
  });

  describe("deleteExperiment", () => {
    it("should delete an experiment successfully", async () => {
      const experiment = await testApp.createExperiment({
        name: "Experiment to Delete",
      });
      const path = testApp.resolvePath(contract.deleteExperiment.path, {
        id: experiment.id,
      });

      await testApp.delete(path).expect(StatusCodes.NO_CONTENT);

      // Verify it's gone
      const getPath = testApp.resolvePath(contract.getExperiment.path, {
        id: experiment.id,
      });
      await testApp.get(getPath).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.deleteExperiment.path, {
        id: nonExistentId,
      });

      await testApp
        .delete(path)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });
  });

  describe("experimentMembers", () => {
    it("should list experiment members", async () => {
      const experiment = await testApp.createExperiment({
        name: "Member Test Experiment",
      });
      // The creator is automatically an admin member

      const path = testApp.resolvePath(contract.listExperimentMembers.path, {
        id: experiment.id,
      });

      const response = await testApp.get(path).expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        userId: testApp.testUserId,
        role: "admin",
      });
    });

    it("should add a member to an experiment", async () => {
      const experiment = await testApp.createExperiment({
        name: "Add Member Test",
      });
      const newMemberId = await testApp.createTestUser("member@example.com");

      const path = testApp.resolvePath(contract.addExperimentMember.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .send({ userId: newMemberId, role: "member" })
        .expect(StatusCodes.CREATED)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            userId: newMemberId,
            role: "member",
          });
        });

      // Verify member was added
      const listPath = testApp.resolvePath(
        contract.listExperimentMembers.path,
        { id: experiment.id },
      );
      const response = await testApp.get(listPath);
      expect(response.body).toHaveLength(2);
    });

    it("should remove a member from an experiment", async () => {
      const experiment = await testApp.createExperiment({
        name: "Remove Member Test",
      });
      const newMemberId = await testApp.createTestUser(
        "member-to-remove@example.com",
      );

      // Add the member first
      await testApp.addExperimentMember(experiment.id, newMemberId, "member");

      // Verify there are 2 members
      const listPath = testApp.resolvePath(
        contract.listExperimentMembers.path,
        { id: experiment.id },
      );
      let response = await testApp.get(listPath);
      expect(response.body).toHaveLength(2);

      // Now remove the member
      const removePath = testApp.resolvePath(
        contract.removeExperimentMember.path,
        {
          id: experiment.id,
          memberId: newMemberId,
        },
      );

      await testApp.delete(removePath).expect(StatusCodes.NO_CONTENT);

      // Verify member was removed
      response = await testApp.get(listPath);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].userId).toBe(testApp.testUserId);
    });
  });
});
