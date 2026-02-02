import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { ErrorResponse, Experiment, ExperimentMemberList } from "@repo/api";
import type { ExperimentList } from "@repo/api";
import { contract } from "@repo/api";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import type { UserDto } from "../../users/core/models/user.model";

describe("ExperimentController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let analyticsAdapter: MockAnalyticsAdapter;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get the databricks service instance for create experiment tests
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);

    // Reset any mocks before each test
    vi.restoreAllMocks();
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
        status: "active",
        visibility: "private",
      };

      const response = await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send(experimentData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          description: "Missing name",
          status: "active",
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
          status: "active",
          visibility: "private",
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 if name is too long", async () => {
      const tooLongName = "a".repeat(300);

      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          name: tooLongName,
          description: "Test Description",
          status: "active",
          visibility: "private",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should successfully create an experiment with embargoUntil as ISO string", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
      const embargoUntilISO = futureDate.toISOString();

      const experimentData = {
        name: "Test Experiment with Embargo",
        description: "Test Description",
        status: "active",
        visibility: "private",
        embargoUntil: embargoUntilISO,
      };

      const response = await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send(experimentData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("embargoUntil");

      // Type the response properly
      const responseBody = response.body as { id: string; embargoUntil: string };

      // The response should contain the embargoUntil as an ISO string (formatted by date-formatter)
      expect(responseBody.embargoUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should return 400 if embargoUntil is not a valid ISO date string", async () => {
      await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          name: "Test Experiment",
          description: "Test Description",
          status: "active",
          visibility: "private",
          embargoUntil: "invalid-date-string",
        })
        .expect(StatusCodes.BAD_REQUEST);
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

    it("should filter experiments by search term in name", async () => {
      // Create experiments
      await testApp.createExperiment({ name: "Alpha Experiment", userId: testUserId });
      await testApp.createExperiment({ name: "Beta Experiment", userId: testUserId });
      await testApp.createExperiment({ name: "Gamma", userId: testUserId });

      // Act
      const response = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(testUserId)
        .query({ search: "Experiment" })
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Alpha Experiment" }),
          expect.objectContaining({ name: "Beta Experiment" }),
        ]),
      );
      const experiments = response.body as { name: string }[];
      expect(experiments.some((e) => e.name === "Gamma")).toBe(false);
    });

    it("should filter experiments by search term with other filters", async () => {
      // Create users
      const mainUserId = await testApp.createTestUser({ email: "search-ctrl@example.com" });
      const otherUserId = await testApp.createTestUser({ email: "search-ctrl-other@example.com" });

      // Create experiments
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
      const response = await testApp
        .get(contract.experiments.listExperiments.path)
        .withAuth(mainUserId)
        .query({ status: "active", search: "Searchable" })
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "My Searchable Active", status: "active" }),
          expect.objectContaining({ name: "Member Searchable Active", status: "active" }),
        ]),
      );
      const experiments = response.body as { name: string; status: string }[];
      expect(
        experiments.some(
          (e) =>
            e.status === "archived" || e.name === "My Unrelated" || e.name === "Other Experiment",
        ),
      ).toBe(false);
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

    it("should filter experiments correctly with 'member' filter", async () => {
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
        .query({ userId: testUserId, filter: "member" })
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
        .query({ filter: "member", status: "active" })
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

      const path = testApp.resolvePath(contract.experiments.getExperiment.path, {
        id: experiment.id,
      });

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
      const path = testApp.resolvePath(contract.experiments.getExperiment.path, {
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

    it("should return 400 for invalid UUID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(contract.experiments.getExperiment.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.getExperiment.path, {
        id: nonExistentId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateExperiment", () => {
    it("should update an experiment successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "active",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.updateExperiment.path, {
        id: experiment.id,
      });

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
      const path = testApp.resolvePath(contract.experiments.updateExperiment.path, {
        id: nonExistentId,
      });

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
      const path = testApp.resolvePath(contract.experiments.updateExperiment.path, {
        id: nonExistentId,
      });

      await testApp
        .patch(path)
        .withoutAuth()
        .send({ name: "Won't Update" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should update an experiment with embargoUntil as ISO string", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "active",
        userId: testUserId,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60); // 60 days from now
      const embargoUntilISO = futureDate.toISOString();

      const path = testApp.resolvePath(contract.experiments.updateExperiment.path, {
        id: experiment.id,
      });

      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({
          name: "Updated Name with Embargo",
          status: "active",
          embargoUntil: embargoUntilISO,
        })
        .expect(StatusCodes.OK);

      // Type the response properly
      const responseBody = response.body as {
        id: string;
        name: string;
        status: string;
        embargoUntil: string;
      };

      expect(responseBody).toMatchObject({
        id: experiment.id,
        name: "Updated Name with Embargo",
        status: "active",
      });

      // The response should contain the embargoUntil as an ISO string (formatted by date-formatter)
      expect(responseBody.embargoUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should return 400 if embargoUntil is not a valid ISO date string on update", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "active",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.updateExperiment.path, {
        id: experiment.id,
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({
          name: "Updated Name",
          embargoUntil: "invalid-date-string",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("deleteExperiment", () => {
    beforeEach(() => {
      analyticsAdapter.setFlag(FEATURE_FLAGS.EXPERIMENT_DELETION, true);
    });

    it("should delete an experiment successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.deleteExperiment.path, {
        id: experiment.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify it's gone
      const getPath = testApp.resolvePath(contract.experiments.getExperiment.path, {
        id: experiment.id,
      });
      await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 403 if experiment deletion is disabled", async () => {
      // Override mock to disable feature flag
      analyticsAdapter.setFlag(FEATURE_FLAGS.EXPERIMENT_DELETION, false);

      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.deleteExperiment.path, {
        id: experiment.id,
      });

      await testApp
        .delete(path)
        .withAuth(testUserId)
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toBe("Experiment deletion is currently disabled");
        });
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.deleteExperiment.path, {
        id: nonExistentId,
      });

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
      const path = testApp.resolvePath(contract.experiments.deleteExperiment.path, {
        id: nonExistentId,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("experimentMembers", () => {
    it("should list experiment members", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Member Test Experiment",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

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

      const path = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should add a member to an experiment", { timeout: 10000 }, async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Add Member Test",
        userId: testUserId,
      });
      const newMemberId = await testApp.createTestUser({
        email: "member@example.com",
      });

      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ members: [{ userId: newMemberId, role: "member" }] })
        .expect(StatusCodes.CREATED)
        .expect(({ body }: { body: ExperimentMemberList }) => {
          expect(body).toHaveLength(1);
          expect(body[0]).toMatchObject({
            experimentId: experiment.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            joinedAt: expect.any(String),
            role: "member",
            user: expect.objectContaining({
              id: newMemberId,
            }) as Partial<UserDto>,
          });
        });

      // Verify member was added
      const listPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });
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

      const path = testApp.resolvePath(contract.experiments.addExperimentMembers.path, {
        id: experiment.id,
      });

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
      const listPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });
      let response: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(listPath)
        .withAuth(testUserId)
        .query({
          userId: testUserId,
        });

      expect(response.body).toHaveLength(2);

      // Now remove the member
      const removePath = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: newMemberId,
      });

      await testApp.delete(removePath).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

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
      const removePath = testApp.resolvePath(contract.experiments.removeExperimentMember.path, {
        id: experiment.id,
        memberId: newMemberId,
      });

      await testApp.delete(removePath).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
