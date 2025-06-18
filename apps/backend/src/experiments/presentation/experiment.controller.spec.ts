import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type {
  ErrorResponse,
  Experiment,
  ExperimentMemberList,
} from "@repo/api";
import type { ExperimentList } from "@repo/api";
import { contract } from "@repo/api";

import { DatabricksService } from "../../common/services/databricks/databricks.service";
import { success, failure } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import type { UserDto } from "../../users/core/models/user.model";

describe("ExperimentController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get the databricks service instance for create experiment tests
    databricksService = testApp.module.get(DatabricksService);

    // Reset any mocks before each test
    jest.restoreAllMocks();

    // Set up default mocks for databricks service (only needed for create experiment)
    jest.spyOn(databricksService, "triggerJob").mockResolvedValue(
      success({
        run_id: 12345,
        number_in_job: 1,
      }),
    );
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

      expect(response.body).toHaveProperty("id");

      // Type the response properly
      const responseBody = response.body as { id: string };

      // Verify that Databricks job was triggered
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).toHaveBeenCalledWith({
        experimentId: responseBody.id,
        experimentName: experimentData.name,
        userId: testUserId,
      });
    });

    it("should successfully create an experiment even if Databricks fails", async () => {
      // Mock Databricks to fail
      jest.spyOn(databricksService, "triggerJob").mockResolvedValue(
        failure({
          name: "DatabricksError",
          code: "INTERNAL_ERROR",
          message: "Databricks API error",
          statusCode: 500,
        }),
      );

      const experimentData = {
        name: "Test Experiment with Databricks Failure",
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

      expect(response.body).toHaveProperty("id");

      // Type the response properly
      const responseBody = response.body as { id: string };

      // Verify that Databricks job was attempted
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).toHaveBeenCalledWith({
        experimentId: responseBody.id,
        experimentName: experimentData.name,
        userId: testUserId,
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

      // Verify that Databricks was not called for invalid requests
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).not.toHaveBeenCalled();
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

      // Verify that Databricks was not called for unauthenticated requests
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).not.toHaveBeenCalled();
    });

    it("should return 400 if name is too long", async () => {
      const tooLongName = "a".repeat(300);

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

      // Verify that Databricks was not called for invalid requests
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).not.toHaveBeenCalled();
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

      // Verify that Databricks was not called for invalid requests
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.triggerJob).not.toHaveBeenCalled();
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

      const response: SuperTestResponse<ExperimentList> = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .query({ userId: testUserId, filter: "my" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(experiment.id);
      expect(response.body[0].name).toBe("My Experiment");
    });

    it("should filter experiments by status", async () => {
      // Create an active experiment
      const { experiment: activeExperiment } = await testApp.createExperiment({
        name: "Active Experiment",
        userId: testUserId,
        status: "active",
      });

      // Create an archived experiment
      await testApp.createExperiment({
        name: "Archived Experiment",
        userId: testUserId,
        status: "archived",
      });

      const response: SuperTestResponse<ExperimentList> = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .query({ status: "active" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(activeExperiment.id);
      expect(response.body[0].name).toBe("Active Experiment");
      expect(response.body[0].status).toBe("active");
    });

    it("should combine filter and status parameters", async () => {
      // Create an active experiment owned by test user
      const { experiment: myActive } = await testApp.createExperiment({
        name: "My Active Experiment",
        userId: testUserId,
        status: "active",
      });

      // Create an archived experiment owned by test user
      await testApp.createExperiment({
        name: "My Archived Experiment",
        userId: testUserId,
        status: "archived",
      });

      // Create an experiment with a different user
      const otherUserId = await testApp.createTestUser({
        email: "other-combo@example.com",
      });
      await testApp.createExperiment({
        name: "Other Active Experiment",
        userId: otherUserId,
        status: "active",
      });

      const response: SuperTestResponse<ExperimentList> = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .query({ filter: "my", status: "active" })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(myActive.id);
      expect(response.body[0].name).toBe("My Active Experiment");
      expect(response.body[0].status).toBe("active");
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

      const response: SuperTestResponse<Experiment> = await testApp
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

      // Verify no data is included (since we removed experiment data functionality)
      expect(response.body.data).toBeUndefined();
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
        .expect(({ body }: { body: ErrorResponse }) => {
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
        .expect(({ body }: { body: ErrorResponse }) => {
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
        .expect(({ body }: { body: ErrorResponse }) => {
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

      const response: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        role: "admin",
        user: expect.objectContaining({
          id: testUserId,
        }) as Partial<UserDto>,
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
        contract.experiments.addExperimentMembers.path,
        {
          id: experiment.id,
        },
      );

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ members: [{ userId: newMemberId, role: "member" }] })
        .expect(StatusCodes.CREATED)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            role: "member",
            user: expect.objectContaining({
              id: newMemberId,
            }) as Partial<UserDto>,
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
        contract.experiments.addExperimentMembers.path,
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
      let response: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(listPath)
        .withAuth(testUserId)
        .query({
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
      expect(response.body[0].user.id).toBe(testUserId);
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
});
