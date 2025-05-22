import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../test/test-harness";

describe("ExperimentController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Reset any mocks before each test
    jest.restoreAllMocks();
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
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send(experimentData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: experimentData.name,
        description: experimentData.description,
        status: experimentData.status,
        visibility: experimentData.visibility,
        embargoIntervalDays: experimentData.embargoIntervalDays,
        createdBy: testUserId,
      });
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          description: "Missing name",
          status: "provisioning",
          visibility: "private",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .post(contract.experiments.createExperiment.path)
        .withoutAuth()
        .send({
          name: "Unauthorized Experiment",
          description: "This should fail",
          status: "provisioning",
          visibility: "private",
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listExperiments", () => {
    it("should return an empty array if no experiments exist", async () => {
      const response = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return a list of experiments", async () => {
      // Create some experiments first
      const { experiment: experiment1 } = await testApp.createExperiment({
        name: "Experiment 1",
        userId: testUserId,
      });
      const { experiment: experiment2 } = await testApp.createExperiment({
        name: "Experiment 2",
        userId: testUserId,
      });

      const response = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
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
      const { experiment } = await testApp.createExperiment({
        name: "My Experiment",
        userId: testUserId,
      });

      // Create an experiment with a different user
      const otherUserId = await testApp.createTestUser({
        email: "other@example.com",
      });

      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
      });

      const response = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .query({ userId: testUserId, filter: "my" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(experiment.id);
      expect(response.body[0].name).toBe("My Experiment");
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.experiments.listExperiments.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getExperiment", () => {
    it("should return an experiment by ID", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Get",
        description: "Detailed description",
        userId: testUserId,
      });

      const path = testApp.resolvePath(
        contract.experiments.getExperiment.path,
        {
          id: experiment.id,
        },
      );

      const response = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        visibility: experiment.visibility,
        createdBy: testUserId,
      });
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(
        contract.experiments.getExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(
        contract.experiments.getExperiment.path,
        {
          id: invalidId,
        },
      );

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(
        contract.experiments.getExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateExperiment", () => {
    it("should update an experiment successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "provisioning",
        userId: testUserId,
      });

      const path = testApp.resolvePath(
        contract.experiments.updateExperiment.path,
        {
          id: experiment.id,
        },
      );

      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
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
      const path = testApp.resolvePath(
        contract.experiments.updateExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ name: "Won't Update" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(
        contract.experiments.updateExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp
        .patch(path)
        .withoutAuth()
        .send({ name: "Won't Update" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteExperiment", () => {
    it("should delete an experiment successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      const path = testApp.resolvePath(
        contract.experiments.deleteExperiment.path,
        {
          id: experiment.id,
        },
      );

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);

      // Verify it's gone
      const getPath = testApp.resolvePath(
        contract.experiments.getExperiment.path,
        {
          id: experiment.id,
        },
      );
      await testApp
        .get(getPath)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(
        contract.experiments.deleteExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(
        contract.experiments.deleteExperiment.path,
        {
          id: nonExistentId,
        },
      );

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("experimentMembers", () => {
    it("should list experiment members", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Member Test Experiment",
        userId: testUserId,
      });

      const path = testApp.resolvePath(
        contract.experiments.listExperimentMembers.path,
        {
          id: experiment.id,
        },
      );

      const response = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        userId: testUserId,
        role: "admin",
      });
    });

    it("should return 401 if not authenticated when listing members", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Member Test Experiment",
        userId: testUserId,
      });

      const path = testApp.resolvePath(
        contract.experiments.listExperimentMembers.path,
        {
          id: experiment.id,
        },
      );

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should add a member to an experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Add Member Test",
        userId: testUserId,
      });
      const newMemberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(
        contract.experiments.addExperimentMember.path,
        {
          id: experiment.id,
        },
      );

      await testApp
        .post(path)
        .withAuth(testUserId)
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
        contract.experiments.listExperimentMembers.path,
        { id: experiment.id },
      );
      const response = await testApp.get(listPath).withAuth(testUserId).query({
        userId: testUserId,
      });
      expect(response.body).toHaveLength(2);
    });

    it("should return 401 if not authenticated when adding a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Add Member Test",
        userId: testUserId,
      });
      const newMemberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(
        contract.experiments.addExperimentMember.path,
        {
          id: experiment.id,
        },
      );

      await testApp
        .post(path)
        .withoutAuth()
        .send({ userId: newMemberId, role: "member" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should remove a member from an experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Remove Member Test",
        userId: testUserId,
      });
      const newMemberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });

      // Add the member first
      await testApp.addExperimentMember(experiment.id, newMemberId, "member");

      // Verify there are 2 members
      const listPath = testApp.resolvePath(
        contract.experiments.listExperimentMembers.path,
        { id: experiment.id },
      );
      let response = await testApp.get(listPath).withAuth(testUserId).query({
        userId: testUserId,
      });

      expect(response.body).toHaveLength(2);

      // Now remove the member
      const removePath = testApp.resolvePath(
        contract.experiments.removeExperimentMember.path,
        {
          id: experiment.id,
          memberId: newMemberId,
        },
      );

      await testApp
        .delete(removePath)
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);

      // Verify member was removed
      response = await testApp.get(listPath).withAuth(testUserId).query({
        userId: testUserId,
      });
      expect(response.body).toHaveLength(1);
      expect(response.body[0].userId).toBe(testUserId);
    });

    it("should return 401 if not authenticated when removing a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Remove Member Test",
        userId: testUserId,
      });
      const newMemberId = await testApp.createTestUser({
        email: "member-to-remove@example.com",
      });

      // Add the member first
      await testApp.addExperimentMember(experiment.id, newMemberId, "member");

      // Now try to remove the member without auth
      const removePath = testApp.resolvePath(
        contract.experiments.removeExperimentMember.path,
        {
          id: experiment.id,
          memberId: newMemberId,
        },
      );

      await testApp
        .delete(removePath)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("createExperiment", () => {
    it("should return 400 if name is too long", async () => {
      const tooLongName = "a".repeat(65);

      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          name: tooLongName,
          description: "Test Description",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: 90,
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if embargoIntervalDays is negative", async () => {
      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          name: "Test Experiment",
          description: "Test Description",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: -1,
        })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });
});
