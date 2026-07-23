import { expect } from "vitest";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { GetDistinctColumnValuesUseCase } from "../application/use-cases/experiment-data/get-distinct-column-values";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let readableExperimentId: string;
  let getExperimentDataUseCase: GetExperimentDataUseCase;
  let getExperimentTablesUseCase: GetExperimentTablesUseCase;
  let getDistinctColumnValuesUseCase: GetDistinctColumnValuesUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Readable experiment",
      userId: testUserId,
    });
    readableExperimentId = experiment.id;
    getExperimentDataUseCase = testApp.module.get(GetExperimentDataUseCase);
    getExperimentTablesUseCase = testApp.module.get(GetExperimentTablesUseCase);
    getDistinctColumnValuesUseCase = testApp.module.get(GetDistinctColumnValuesUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getExperimentTables", () => {
    it("should return tables metadata successfully", async () => {
      const experimentId = readableExperimentId;
      const mockTables = [
        {
          identifier: "raw_data",
          tableType: "static" as const,
          displayName: "Raw Data",
          totalRows: 1000,
        },
      ];

      vi.spyOn(getExperimentTablesUseCase, "execute").mockResolvedValue(success(mockTables));

      const response = await testApp
        .get(`/api/v1/experiments/${experimentId}/tables`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual(mockTables);
      expect(getExperimentTablesUseCase.execute).toHaveBeenCalledWith(experimentId, testUserId);
    });

    it("should map a use-case failure to its HTTP status", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(getExperimentTablesUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/tables`)
        .withAuth(testUserId)
        .expect(404);
    });
  });

  describe("getExperimentData", () => {
    it("should return experiment data successfully", async () => {
      const experimentId = readableExperimentId;
      const mockData = [
        {
          name: "raw_data",
          catalog_name: "centrum",
          schema_name: "centrum",
          data: {
            columns: [
              { name: "id", type_name: "string", type_text: "string" },
              { name: "value", type_name: "int", type_text: "int" },
            ],
            rows: [
              { id: "1", value: "100" },
              { id: "2", value: "200" },
            ],
            totalRows: 2,
            truncated: false,
          },
          page: 1,
          pageSize: 10,
          totalRows: 2,
          totalPages: 1,
        },
      ];

      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(success(mockData));

      const response = await testApp
        .get(`/api/v1/experiments/${experimentId}/data?tableName=raw_data&page=1&pageSize=10`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual(mockData);
      expect(getExperimentDataUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        testUserId,
        expect.objectContaining({ tableName: "raw_data", page: 1, pageSize: 10 }),
      );
    });

    it("should map a use-case forbidden failure to 403", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(403);
    });

    it("should map a use-case bad-request failure to 400", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("Invalid experiment data request")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data?tableName=test_table`)
        .withAuth(testUserId)
        .expect(400);
    });
  });

  describe("getDistinctColumnValues", () => {
    it("returns distinct values on success", async () => {
      const experimentId = readableExperimentId;
      const body = { values: ["alpha", 2], truncated: false };

      vi.spyOn(getDistinctColumnValuesUseCase, "execute").mockResolvedValue(success(body));

      const response = await testApp
        .get(
          `/api/v1/experiments/${experimentId}/data/distinct?tableName=raw_data&column=site&limit=50`,
        )
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual(body);
      expect(getDistinctColumnValuesUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        testUserId,
        expect.objectContaining({ tableName: "raw_data", column: "site", limit: 50 }),
      );
    });

    it("maps a use-case failure to its HTTP status", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(getDistinctColumnValuesUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/distinct?tableName=raw_data&column=site`)
        .withAuth(testUserId)
        .expect(403);
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "get experiment tables",
        request: (experimentId: string, userId: string) =>
          testApp.get(`/api/v1/experiments/${experimentId}/tables`).withAuth(userId),
      },
      {
        name: "get experiment data",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(`/api/v1/experiments/${experimentId}/data?tableName=raw_data`)
            .withAuth(userId),
      },
      {
        name: "get distinct column values",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(`/api/v1/experiments/${experimentId}/data/distinct?tableName=raw_data&column=site`)
            .withAuth(userId),
      },
    ])("requires read access to $name", async ({ request }) => {
      const unrelatedUserId = await testApp.createTestUser({});
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(readableExperimentId, unrelatedUserId).expect(403);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(unrelatedUserId, {
        resourceType: "experiment",
        resourceId: readableExperimentId,
        action: "read",
      });
    });
  });
});
