import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ExperimentMetadata } from "@repo/api";
import { contract } from "@repo/api";

import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ExperimentMetadataRepository } from "../core/repositories/experiment-metadata.repository";

describe("ExperimentMetadataController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getExperimentMetadata", () => {
    it("should return 200 with metadata when it exists", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Get Metadata Test",
        userId: testUserId,
      });

      const metadataRepository = testApp.module.get(ExperimentMetadataRepository);
      vi.spyOn(metadataRepository, "findByExperimentId").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: {
          metadataId: faker.string.uuid(),
          experimentId: experiment.id,
          metadata: { location: "Lab A", temperature: 25 },
          createdBy: testUserId,
          createdAt: new Date("2025-06-01T12:00:00.000Z"),
          updatedAt: new Date("2025-06-02T12:00:00.000Z"),
        },
        chain: function (fn: (val: unknown) => unknown) {
          return fn(this.value);
        },
      } as never);

      const path = testApp.resolvePath(contract.experiments.getExperimentMetadata.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<ExperimentMetadata> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("metadataId");
      expect(response.body).toHaveProperty("experimentId", experiment.id);
      expect(response.body).toHaveProperty("metadata");
    });

    it("should return 200 with null when no metadata exists", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "No Metadata Test",
        userId: testUserId,
      });

      const metadataRepository = testApp.module.get(ExperimentMetadataRepository);
      vi.spyOn(metadataRepository, "findByExperimentId").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: null,
        chain: function (fn: (val: unknown) => unknown) {
          return fn(this.value);
        },
      } as never);

      const path = testApp.resolvePath(contract.experiments.getExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Unauth Metadata Test",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.getExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.getExperimentMetadata.path, {
        id: nonExistentId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("upsertExperimentMetadata", () => {
    it("should return 200 on successful upsert", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Upsert Metadata Test",
        userId: testUserId,
      });

      const metadataRepository = testApp.module.get(ExperimentMetadataRepository);
      const mockResult = {
        metadataId: faker.string.uuid(),
        experimentId: experiment.id,
        metadata: { location: "Lab B" },
        createdBy: testUserId,
        createdAt: new Date("2025-06-01T12:00:00.000Z"),
        updatedAt: new Date("2025-06-01T12:00:00.000Z"),
      };

      vi.spyOn(metadataRepository, "upsert").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: mockResult,
        chain: function (fn: (val: unknown) => unknown) {
          return fn(this.value);
        },
      } as never);

      const path = testApp.resolvePath(contract.experiments.upsertExperimentMetadata.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<ExperimentMetadata> = await testApp
        .put(path)
        .withAuth(testUserId)
        .send({ metadata: { location: "Lab B" } })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("metadataId");
      expect(response.body).toHaveProperty("metadata");
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Unauth Upsert Test",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.upsertExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp
        .put(path)
        .withoutAuth()
        .send({ metadata: { key: "value" } })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 if user has no write access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Forbidden Upsert Test",
        userId: testUserId,
      });

      const otherUserId = await testApp.createTestUser({});

      const path = testApp.resolvePath(contract.experiments.upsertExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp
        .put(path)
        .withAuth(otherUserId)
        .send({ metadata: { key: "value" } })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.upsertExperimentMetadata.path, {
        id: nonExistentId,
      });

      await testApp
        .put(path)
        .withAuth(testUserId)
        .send({ metadata: { key: "value" } })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("deleteExperimentMetadata", () => {
    it("should return 204 on successful deletion", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Delete Metadata Test",
        userId: testUserId,
      });

      const metadataRepository = testApp.module.get(ExperimentMetadataRepository);
      vi.spyOn(metadataRepository, "deleteByExperimentId").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: true,
        chain: function (fn: (val: unknown) => unknown) {
          return fn(this.value);
        },
      } as never);

      const path = testApp.resolvePath(contract.experiments.deleteExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Unauth Delete Test",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.deleteExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 if user has no write access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Forbidden Delete Test",
        userId: testUserId,
      });

      const otherUserId = await testApp.createTestUser({});

      const path = testApp.resolvePath(contract.experiments.deleteExperimentMetadata.path, {
        id: experiment.id,
      });

      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.deleteExperimentMetadata.path, {
        id: nonExistentId,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });
});
