import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { ExperimentContributors } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import type { Experiment, ExperimentList } from "@repo/api/domains/experiment/experiment.schema";
import type { ErrorResponse } from "@repo/api/shared/errors";
import { eq, experiments } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AppError, failure } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";

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
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
        .withAuth(testUserId)
        .send(experimentData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
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
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
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
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
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
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
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
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
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

    it("should return 400 when embargoUntil is set on an explicitly public experiment", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
        .withAuth(testUserId)
        .send({
          name: "Public With Embargo",
          description: "Test Description",
          status: "active",
          visibility: "public",
          embargoUntil: futureDate.toISOString(),
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when embargoUntil is set and visibility is omitted (defaults public)", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
        .withAuth(testUserId)
        .send({
          name: "Defaulted Public With Embargo",
          description: "Test Description",
          status: "active",
          embargoUntil: futureDate.toISOString(),
        })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("listExperiments paginated", () => {
    it("returns the page envelope when a page is requested", async () => {
      await testApp.createExperiment({ name: "Paged one", userId: testUserId });

      const response: SuperTestResponse<{ items: { id: string }[]; totalCount: number }> =
        await testApp
          .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
          .query({ page: 1, pageSize: 10 })
          .withAuth(testUserId)
          .expect(StatusCodes.OK);

      expect(response.body.totalCount).toBe(1);
      expect(response.body.items).toHaveLength(1);
    });

    it("returns 500 when the paginated use case fails", async () => {
      vi.spyOn(testApp.module.get(ListExperimentsUseCase), "executePaginated").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
        .query({ page: 1 })
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listExperiments", () => {
    it("should return an empty array if no experiments exist", async () => {
      const response = await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
      await testApp.addExperimentCollaborator(memberExpActive.id, mainUserId);
      await testApp.addExperimentCollaborator(memberExpArchived.id, mainUserId);
      await testApp.createExperiment({
        name: "Other Experiment",
        userId: otherUserId,
        status: "active",
      });

      // Act
      const response = await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
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

      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
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

    it("allows a plain owning-organization member to read a private experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Organization experiment",
        userId: testUserId,
        visibility: "private",
      });
      const organizationMemberId = await testApp.createTestUser({});
      if (!experiment.organizationId) throw new Error("Experiment has no owning organization");
      await testApp.addOrganizationMember(
        experiment.organizationId,
        organizationMemberId,
        "member",
      );

      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: experiment.id,
      });

      await testApp.get(path).withAuth(organizationMemberId).expect(StatusCodes.OK);
    });

    it("allows an explicit read grantee to read a private experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Granted experiment",
        userId: testUserId,
        visibility: "private",
      });
      const granteeId = await testApp.createTestUser({});
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId,
        role: "viewer",
      });

      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: experiment.id,
      });

      await testApp.get(path).withAuth(granteeId).expect(StatusCodes.OK);
    });

    it("denies an unrelated user access to a private experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Private experiment",
        userId: testUserId,
        visibility: "private",
      });
      const unrelatedUserId = await testApp.createTestUser({});
      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: experiment.id,
      });

      await testApp.get(path).withAuth(unrelatedUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: nonExistentId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  /**
   * The handler does not receive the route params the authorization guard checked; it
   * receives them merged with the client-supplied payload, payload last — the query
   * string on a GET, the parsed body otherwise. So a payload key named after a path
   * param would replace the id that was authorized, and a caller could be checked
   * against an experiment it may read while being served one it may not. A request
   * may restate a path param verbatim; anything else is refused. Only reachable over
   * HTTP, because the merge happens in the request-decoding pipeline.
   */
  describe("getExperiment with a query param that shadows the path id", () => {
    it("is rejected when the query id differs from the path id", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Reachable experiment",
        userId: testUserId,
      });
      // Owned by somebody else and private: the caller is neither an organization
      // member nor a grantee, so every action on it is denied.
      const strangerId = await testApp.createTestUser({});
      const { experiment: offLimits } = await testApp.createExperiment({
        name: "Off-limits experiment",
        userId: strangerId,
        visibility: "private",
      });

      const response: SuperTestResponse<unknown> = await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.getExperiment, { id: experiment.id }))
        .query({ id: offLimits.id })
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST);

      // Nothing about the experiment the caller cannot read may leak into the reply.
      expect(JSON.stringify(response.body)).not.toContain(offLimits.id);
      expect(JSON.stringify(response.body)).not.toContain(offLimits.name);
    });

    it("is served normally when the query restates the path id", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Restated id experiment",
        userId: testUserId,
      });

      const response: SuperTestResponse<Experiment> = await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.getExperiment, { id: experiment.id }))
        .query({ id: experiment.id })
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(experiment.id);
    });

    it("is rejected when the query id differs from the path id only in letter case", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Case variant experiment",
        userId: testUserId,
      });

      // Postgres would resolve the uppercased uuid to the same row and serve a 200, so
      // only the strict comparison stops it: a restatement has to be character for
      // character what the path says.
      await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.getExperiment, { id: experiment.id }))
        .query({ id: experiment.id.toUpperCase() })
        .withAuth(testUserId)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("getExperimentAccess", () => {
    it("reports read access without granting manage access to an organization member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Organization access experiment",
        userId: testUserId,
        visibility: "private",
      });
      const organizationMemberId = await testApp.createTestUser({});
      if (!experiment.organizationId) throw new Error("Experiment has no owning organization");
      await testApp.addOrganizationMember(
        experiment.organizationId,
        organizationMemberId,
        "member",
      );

      const path = testApp.resolveOrpcPath(contract.experiments.getExperimentAccess, {
        id: experiment.id,
      });
      const response = await testApp
        .get(path)
        .withAuth(organizationMemberId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        experiment: { id: experiment.id },
        hasAccess: true,
        isAdmin: false,
      });
    });
  });

  describe("updateExperiment", () => {
    it("should update an experiment successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Update",
        status: "active",
        userId: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
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

    it("should return 403 when updating an experiment without update access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment owned by someone else",
        userId: testUserId,
      });
      const otherUserId = await testApp.createTestUser({});
      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
        id: experiment.id,
      });

      await testApp
        .patch(path)
        .withAuth(otherUserId)
        .send({ name: "Unauthorized update" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
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

      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
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

      const path = testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
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

  describe("setVisibility", () => {
    it("publishes a private experiment (private → public)", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "To Publish",
        visibility: "private",
        userId: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.experiments.setVisibility, {
        id: experiment.id,
      });

      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ visibility: "public" })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ id: experiment.id, visibility: "public" });

      // The change persisted.
      const getPath = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: experiment.id,
      });
      const getResponse = await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.OK);
      expect((getResponse.body as { visibility: string }).visibility).toBe("public");
    });

    it("rejects public → private (monotonic rule)", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already Public",
        visibility: "public",
        userId: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.experiments.setVisibility, {
        id: experiment.id,
      });

      await testApp
        .patch(path)
        .withAuth(testUserId)
        .send({ visibility: "private" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 403 without manage access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Not Mine",
        visibility: "private",
        userId: testUserId,
      });
      const otherUserId = await testApp.createTestUser({});
      const path = testApp.resolveOrpcPath(contract.experiments.setVisibility, {
        id: experiment.id,
      });

      await testApp
        .patch(path)
        .withAuth(otherUserId)
        .send({ visibility: "public" })
        .expect(StatusCodes.FORBIDDEN);
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

      const path = testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
        id: experiment.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify it's gone
      const getPath = testApp.resolveOrpcPath(contract.experiments.getExperiment, {
        id: experiment.id,
      });
      await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 403 when deleting an experiment without manage access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Experiment another user cannot delete",
        userId: testUserId,
      });
      const otherUserId = await testApp.createTestUser({});
      const path = testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
        id: experiment.id,
      });

      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 403 if experiment deletion is disabled", async () => {
      // Override mock to disable feature flag
      analyticsAdapter.setFlag(FEATURE_FLAGS.EXPERIMENT_DELETION, false);

      const { experiment } = await testApp.createExperiment({
        name: "Experiment to Delete",
        userId: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
        id: nonExistentId,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("experimentContributors", () => {
    /**
     * **The count agreement**, the overview's half of it. The Details card and the
     * organization's resource card print the same word, so they have to print the
     * same number — asserted against the collaborators surface itself rather than an
     * integer, so neither can drift without this failing.
     */
    async function expectCountAgreesWithCollaborators(experimentId: string, callerId: string) {
      const contributors: SuperTestResponse<ExperimentContributors> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.experiments.listExperimentContributors, {
            id: experimentId,
          }),
        )
        .withAuth(callerId)
        .expect(StatusCodes.OK);

      const collaborators = await testApp
        .get(
          testApp.resolveOrpcPath(contract.sharing.listGrants, {
            resourceType: "experiment",
            id: experimentId,
          }),
        )
        .withAuth(callerId)
        .expect(StatusCodes.OK);

      expect(contributors.body.collaboratorCount).toBe((collaborators.body as unknown[]).length);
      return contributors.body;
    }

    it("counts every collaborator row, not only the faces it may credit", async () => {
      const organizationId = await testApp.createOrganization("Photosynthesis Lab");
      await testApp.addOrganizationMember(organizationId, testUserId, "owner");
      const quiet = await testApp.createTestUser({ email: "quiet-member@example.com" });
      await testApp.addOrganizationMember(organizationId, quiet, "member");
      const { experiment } = await testApp.createExperiment({
        name: "Org-owned Experiment",
        userId: testUserId,
      });
      await testApp.database
        .update(experiments)
        .set({ organizationId })
        .where(eq(experiments.id, experiment.id));

      const body = await expectCountAgreesWithCollaborators(experiment.id, testUserId);

      // One creditable face — the creator's seeded grant — against two rows: their
      // own owner row, which absorbs that grant, and the summary standing in for the
      // member who holds nothing explicit. The faces were never the total.
      expect(body.contributors.map((c) => c.userId)).toEqual([testUserId]);
      expect(body.collaboratorCount).toBe(2);
    });

    it("agrees with the collaborators surface once grants are added too", async () => {
      const collaboratorId = await testApp.createTestUser({ email: "counted@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Counted Experiment",
        userId: testUserId,
      });
      await testApp.addExperimentCollaborator(experiment.id, collaboratorId);

      await expectCountAgreesWithCollaborators(experiment.id, testUserId);
    });

    it("credits everyone who holds a grant on the experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Contributor Test Experiment",
        userId: testUserId,
      });
      const collaboratorId = await testApp.createTestUser({ email: "collaborator@example.com" });
      await testApp.addExperimentCollaborator(experiment.id, collaboratorId);

      const path = testApp.resolveOrpcPath(contract.experiments.listExperimentContributors, {
        id: experiment.id,
      });

      const response: SuperTestResponse<ExperimentContributors> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Credit is names and avatars only — no emails, no tiers. Who holds which
      // tier is the sharing surface's business, and it is gated on can(share).
      expect(response.body.contributors.map((c) => c.userId).sort()).toEqual(
        [testUserId, collaboratorId].sort(),
      );
      for (const contributor of response.body.contributors) {
        expect(Object.keys(contributor).sort()).toEqual([
          "avatarUrl",
          "firstName",
          "lastName",
          "userId",
        ]);
      }
    });

    it("pseudonymises every identity when the experiment anonymizes contributors", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Anonymized Contributor Test",
        userId: testUserId,
        visibility: "public",
        anonymizeContributors: true,
      });
      const collaboratorId = await testApp.createTestUser({
        email: "anon-collaborator@example.com",
        name: "Real Name",
      });
      await testApp.addExperimentCollaborator(experiment.id, collaboratorId);
      const readerId = await testApp.createTestUser({ email: "public-reader@example.com" });

      const path = testApp.resolveOrpcPath(contract.experiments.listExperimentContributors, {
        id: experiment.id,
      });

      // A public reader is exactly the caller this protects: read access alone must
      // not undo the experiment's own anonymization setting.
      const response: SuperTestResponse<ExperimentContributors> = await testApp
        .get(path)
        .withAuth(readerId)
        .expect(StatusCodes.OK);

      expect(response.body.contributors).toHaveLength(2);
      for (const contributor of response.body.contributors) {
        expect(contributor.firstName).toMatch(/^Contributor-[0-9A-F]{6}$/);
        expect(contributor.lastName).toBe("");
        expect(contributor.avatarUrl).toBeNull();
        // The real user id would be enough to join this list back to the data grid
        // and recover the name, so it is pseudonymised too.
        expect(contributor.userId).toBe(contributor.firstName);
      }
      expect(response.body.contributors.map((c) => c.userId)).not.toContain(collaboratorId);
      expect(response.body.contributors.map((c) => c.userId)).not.toContain(testUserId);

      // The admin sees the same pseudonyms here; real identities live on the
      // can(share)-gated collaborators list instead.
      const asAdmin: SuperTestResponse<ExperimentContributors> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);
      expect(asAdmin.body.contributors.map((c) => c.userId).sort()).toEqual(
        response.body.contributors.map((c) => c.userId).sort(),
      );
    });

    it("is read-gated: a stranger on a private experiment gets 403", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Private Contributor Test",
        userId: testUserId,
        visibility: "private",
      });
      const strangerId = await testApp.createTestUser({ email: "stranger@example.com" });

      const path = testApp.resolveOrpcPath(contract.experiments.listExperimentContributors, {
        id: experiment.id,
      });
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await testApp.get(path).withAuth(strangerId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledWith(strangerId, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action: "read",
      });
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Contributor Auth Test",
        userId: testUserId,
      });

      const path = testApp.resolveOrpcPath(contract.experiments.listExperimentContributors, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "get experiment",
        action: "read",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.experiments.getExperiment, { id: experimentId }))
            .withAuth(userId),
      },
      {
        name: "get experiment access",
        action: "read",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(
              testApp.resolveOrpcPath(contract.experiments.getExperimentAccess, {
                id: experimentId,
              }),
            )
            .withAuth(userId),
      },
      {
        name: "update experiment",
        action: "update",
        request: (experimentId: string, userId: string) =>
          testApp
            .patch(
              testApp.resolveOrpcPath(contract.experiments.updateExperiment, {
                id: experimentId,
              }),
            )
            .withAuth(userId)
            .send({ name: "Blocked update" }),
      },
      {
        name: "delete experiment",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .delete(
              testApp.resolveOrpcPath(contract.experiments.deleteExperiment, {
                id: experimentId,
              }),
            )
            .withAuth(userId),
      },
      {
        name: "set experiment visibility",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .patch(
              testApp.resolveOrpcPath(contract.experiments.setVisibility, {
                id: experimentId,
              }),
            )
            .withAuth(userId)
            .send({ visibility: "public" }),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const { experiment } = await testApp.createExperiment({
        name: "Guarded private experiment",
        userId: testUserId,
        visibility: "private",
      });
      const unrelatedUserId = await testApp.createTestUser({});
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(experiment.id, unrelatedUserId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(unrelatedUserId, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action,
      });
    });

    it("returns 403 when creating an experiment in an organization the caller is not a member of", async () => {
      const organizationId = faker.string.uuid();
      const isOrgMemberSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "isOrgMember")
        .mockResolvedValue(false);

      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.createExperiment))
        .withAuth(testUserId)
        .send({
          name: "Org experiment",
          description: "x",
          status: "active",
          visibility: "private",
          organizationId,
        })
        .expect(StatusCodes.FORBIDDEN);

      expect(isOrgMemberSpy).toHaveBeenCalledWith(testUserId, organizationId);
    });
  });
});
